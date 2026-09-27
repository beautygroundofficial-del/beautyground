"""Local-only writing regression checks with fake Auth and explicit write fixtures.

Run against a local app plus the existing community-ui-server.mjs bridge:
    APP=http://127.0.0.1:5199 PORT=5201 python test-community-writing.py

The Auth seeding and HTTP/WebSocket boundary follow test-community-ui.py. Only
allowlisted reads reach the loopback SQL bridge. Diary/board creates and Storage
uploads terminate in this script's memory; no live Supabase request is forwarded.
This does not test production Auth, Storage, RLS, points or real-user engagement.
"""
from __future__ import annotations

import base64
import json
import os
from pathlib import Path
import re
import struct
import tempfile
import time
import traceback
import urllib.request
from urllib.parse import parse_qs, urlsplit
import zlib

from playwright.sync_api import expect, sync_playwright


APP = os.environ.get("APP", "http://127.0.0.1:5199").rstrip("/")
APP_URL = urlsplit(APP)
if (APP_URL.scheme not in ("http", "https")
        or APP_URL.hostname not in ("127.0.0.1", "localhost", "::1")
        or APP_URL.username or APP_URL.password
        or APP_URL.path or APP_URL.query or APP_URL.fragment):
    raise ValueError("APP must be a loopback HTTP(S) origin")
PORT = int(os.environ.get("PORT", "5201"))
if not 1 <= PORT <= 65535:
    raise ValueError("PORT must be 1..65535")
API = f"http://127.0.0.1:{PORT}"
A = "11111111-1111-4111-8111-111111111111"
B = "22222222-2222-4222-8222-222222222222"
NEW_IDS = {
    "diary": "cccccccc-cccc-4ccc-8ccc-ccccccccccc1",
    "board": "cccccccc-cccc-4ccc-8ccc-ccccccccccc2",
}
EDIT_IDS = {
    "diary": "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1",
    "board": "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2",
}
READ_RPCS = {
    "is_admin", "get_my_nickname", "get_diary_feed", "get_community_diary",
    "get_board_feed", "get_board_post", "get_monthly_best_diaries",
    "get_diary_comment_thread", "get_diary_comments", "get_board_comments",
    "get_friend_statuses", "get_friend_diary_feed", "get_friend_request_count",
    "get_my_friends", "get_friend_requests", "get_my_news", "get_my_news_count",
    "get_community_news", "get_my_missions", "get_active_missions",
    "get_mission_progress", "get_home_banners", "get_my_points",
    "get_today_question", "get_member_count",
}


def fake_user(uid):
    label = "Fixture A" if uid == A else "Fixture B"
    return {
        "id": uid, "aud": "authenticated", "role": "authenticated",
        "email": ("fixture-a" if uid == A else "fixture-b") + "@invalid.example",
        "email_confirmed_at": "2026-01-01T00:00:00Z",
        "created_at": "2026-01-01T00:00:00Z",
        "app_metadata": {"provider": "email", "providers": ["email"]},
        "user_metadata": {"name": label, "nickname": label},
    }


def fake_session(uid):
    def encode(value):
        return base64.urlsafe_b64encode(json.dumps(value).encode()).decode().rstrip("=")
    token = (encode({"alg": "HS256", "typ": "JWT"}) + "."
             + encode({"sub": uid, "aud": "authenticated", "role": "authenticated",
                       "exp": int(time.time()) + 7200}) + ".fixture-only")
    return {
        "access_token": token, "refresh_token": "fixture-refresh-" + uid,
        "token_type": "bearer", "expires_in": 7200,
        "expires_at": int(time.time()) + 7200, "user": fake_user(uid),
    }


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *_args, **_kwargs):
        raise RuntimeError("Fixture bridge redirects are forbidden")


def bridge(path, body=None):
    if path not in ("/health", "/request"):
        raise ValueError("Only local bridge health/read requests are allowed")
    request = urllib.request.Request(
        API + path, data=json.dumps(body).encode() if body is not None else None,
        headers={"Content-Type": "application/json"},
    )
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
    with opener.open(request, timeout=30) as response:
        return json.load(response)


def fixture_png():
    """A valid in-memory 2x2 PNG; no image library or private file is required."""
    def chunk(kind, data):
        return (struct.pack(">I", len(data)) + kind + data
                + struct.pack(">I", zlib.crc32(kind + data) & 0xffffffff))
    row = b"\x00" + bytes((150, 110, 170, 255)) * 2
    return (b"\x89PNG\r\n\x1a\n"
            + chunk(b"IHDR", struct.pack(">IIBBBBB", 2, 2, 8, 6, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(row * 2)) + chunk(b"IEND", b""))


PNG = fixture_png()


def post_row(kind, post_id, uid, content, args=None):
    args = args or {}
    return {
        "id": post_id, "user_id": uid, "nickname": fake_user(uid)["user_metadata"]["name"],
        "content": content, "category": args.get("p_category", "chat"),
        "images": args.get("p_images", []), "video_url": args.get("p_video"),
        "steps": args.get("p_steps"), "pet_ids": args.get("p_pet_ids", []), "pets": [],
        "created_at": "2026-09-28T00:00:00Z", "is_mine": True,
        "like_count": 0, "liked_by_me": False, "pat": 0, "same": 0,
        "cheer": 0, "my_kind": None, "comment_count": 0,
    }


class WritingFixture:
    def __init__(self, uid=A):
        self.uid = uid
        self.creates = []
        self.uploads = []
        self.fail_upload_number = None
        self.errors = []
        self.unexpected = []
        self.blocked_external = []
        self.bridge_failures = []
        self.posts = {"diary": {}, "board": {}}
        for kind in self.posts:
            self.posts[kind][EDIT_IDS[kind]] = post_row(
                kind, EDIT_IDS[kind], A, f"고쳐 쓰기 복귀를 확인하는 {kind} 테스트 이야기입니다.")

    def reply(self, route, body, status=200):
        route.fulfill(status=status, content_type="application/json", body=json.dumps(body))

    def reject(self, route, reason):
        self.unexpected.append(reason)
        self.reply(route, {"code": "FIXTURE_NOT_IMPLEMENTED", "message": reason}, 500)

    def handle(self, route):
        request = route.request
        parsed = urlsplit(request.url)
        path = parsed.path
        if (parsed.scheme, parsed.netloc) == (APP_URL.scheme, APP_URL.netloc):
            if path.startswith("/api/"):
                return self.reply(route, [])
            return route.continue_()
        if not (parsed.hostname == "supabase.co"
                or (parsed.hostname or "").endswith(".supabase.co")):
            self.blocked_external.append(f"{parsed.scheme}://{parsed.netloc}{path}")
            return route.fulfill(status=200, content_type="image/svg+xml",
                                 body='<svg xmlns="http://www.w3.org/2000/svg"/>')

        # Every Supabase request terminates here. Never fetch/continue this origin.
        if path == "/auth/v1/token" and request.method == "POST":
            data = request.post_data_json or {}
            uid = next((candidate for candidate in (A, B)
                        if fake_user(candidate)["email"] == data.get("email")), None)
            if uid is None:
                return self.reject(route, "Only fake fixture emails may sign in")
            self.uid = uid
            return self.reply(route, fake_session(uid))
        if path == "/auth/v1/user":
            return self.reply(route, fake_user(self.uid) if self.uid else
                              {"message": "No fixture session"}, 200 if self.uid else 401)
        if path == "/auth/v1/logout":
            self.uid = None
            return self.reply(route, {})
        if path.startswith("/auth/v1/"):
            return self.reject(route, "Unexpected fake Auth endpoint: " + path)
        if path.startswith("/storage/v1/object/public/") and request.method == "GET":
            return route.fulfill(status=200, content_type="image/png", body=PNG)
        if path.startswith("/storage/v1/object/product-images/") and request.method == "POST":
            self.uploads.append(path)
            if len(self.uploads) == self.fail_upload_number:
                return self.reply(route, {"statusCode": "503", "error": "Fixture upload failure",
                                          "message": "Test-only second-image failure"}, 503)
            return self.reply(route, {"Key": path.removeprefix("/storage/v1/object/"),
                                      "Id": "fixture-upload-" + str(len(self.uploads))})
        if path == "/rest/v1/site_visits" and request.method == "POST":
            return self.reply(route, {}, 201)

        body = request.post_data_json if request.post_data else None
        args = body if isinstance(body, dict) else {}
        rpc = path.removeprefix("/rest/v1/rpc/") if path.startswith("/rest/v1/rpc/") else None
        if rpc in ("create_diary", "create_board_post"):
            kind = "diary" if rpc == "create_diary" else "board"
            required = {"p_content", "p_images", "p_nickname", "p_video"}
            required |= {"p_steps", "p_pet_ids"} if kind == "diary" else {"p_category"}
            if request.method != "POST" or not self.uid or set(args) != required:
                return self.reject(route, f"Unexpected {rpc} method/session/argument contract")
            self.creates.append({"kind": kind, "uid": self.uid, "args": args})
            self.posts[kind][NEW_IDS[kind]] = post_row(
                kind, NEW_IDS[kind], self.uid, args["p_content"], args)
            return self.reply(route, [{"diary_id" if kind == "diary" else "post_id": NEW_IDS[kind],
                                       "awarded": 0, "message": "Fixture write only"}])
        if path == "/rest/v1/diaries" and request.method == "GET":
            post_id = parse_qs(parsed.query).get("id", [""])[0].removeprefix("eq.")
            row = self.posts["diary"].get(post_id)
            if row:
                single = "application/vnd.pgrst.object+json" in request.headers.get("accept", "")
                return self.reply(route, row if single else [row])
        if rpc in ("get_community_diary", "get_board_post"):
            kind = "diary" if rpc == "get_community_diary" else "board"
            row = self.posts[kind].get(args.get("p_diary_id" if kind == "diary" else "p_id"))
            if row:
                return self.reply(route, [{**row, "is_mine": row["user_id"] == self.uid}])
        if rpc == "get_diary_feed" and NEW_IDS["diary"] in self.posts["diary"]:
            rows = [] if args.get("p_offset", 0) else [self.posts["diary"][NEW_IDS["diary"]]]
            return self.reply(route, rows)

        is_table_read = bool(re.fullmatch(r"/rest/v1/[a-z_]+", path)) and request.method == "GET"
        if not (is_table_read or rpc in READ_RPCS):
            return self.reject(route, "Non-allowlisted request: " + request.method + " " + path)
        result = bridge("/request", {"uid": self.uid, "method": request.method,
                                     "path": path + ("?" + parsed.query if parsed.query else ""),
                                     "body": body, "headers": request.headers})
        if result.get("status", 200) >= 400:
            self.bridge_failures.append({"path": path, "body": result.get("body")})
        return self.reply(route, result.get("body"), result.get("status", 200))

    def setup(self, browser, initial_storage=None):
        context = browser.new_context(viewport={"width": 390, "height": 844}, service_workers="block")
        token = json.dumps(fake_session(self.uid)) if self.uid else None
        context.add_init_script("""(() => {
            const fixtureToken = TOKEN;
            const seeds = SEEDS;
            const originalGet = Storage.prototype.getItem;
            const originalSet = Storage.prototype.setItem;
            Storage.prototype.getItem = function(key) {
                if (this === window.localStorage && typeof key === 'string' && /^sb-.+-auth-token$/.test(key)) {
                    const marker = 'fixture-session-seeded:' + key;
                    if (!originalGet.call(this, marker)) {
                        if (fixtureToken) originalSet.call(this, key, fixtureToken);
                        originalSet.call(this, marker, '1');
                    }
                }
                return originalGet.call(this, key);
            };
            if (!originalGet.call(localStorage, 'fixture-writing-initial-data')) {
                for (const [key, value] of Object.entries(seeds)) originalSet.call(localStorage, key, value);
                originalSet.call(localStorage, 'fixture-writing-initial-data', '1');
            }
        })();""".replace("TOKEN", json.dumps(token)).replace("SEEDS", json.dumps(initial_storage or {})))
        context.route("**/*", self.handle)
        context.route_web_socket("**/*", lambda socket: socket.close())
        page = context.new_page()
        page.set_default_timeout(12000)
        page.on("pageerror", lambda error: self.errors.append(str(error)))
        page.on("dialog", lambda dialog: dialog.accept())
        return context, page

    def switch_account(self, page, uid):
        self.uid = uid
        keys = page.evaluate("Object.keys(localStorage).filter(key => /^sb-.+-auth-token$/.test(key))")
        assert keys, "The local app did not create its Supabase session storage key"
        page.evaluate("""({keys, token}) => {
            for (const key of keys) {
                if (token) localStorage.setItem(key, JSON.stringify(token));
                else localStorage.removeItem(key);
            }
        }""", {"keys": keys, "token": fake_session(uid) if uid else None})
        page.reload()


def writer(page, kind):
    page.goto(f"{APP}/app/{kind}/write")
    # Keep the interaction usable on the before build so the behavioral faults
    # are reproduced independently; the new accessible name is checked below.
    box = page.locator("textarea").first
    expect(box).to_be_visible()
    expect(box).to_be_enabled()
    return box


def fill_writer(page, kind, text):
    box = writer(page, kind)
    box.fill(text)
    if kind == "board":
        summary = category_summary(page)
        if summary.count() and not summary.locator("..").evaluate("node => node.open"):
            summary.click()
        # Closed details are excluded from accessible-role queries. Open the
        # visible summary first, then select the now-visible category button.
        category = page.get_by_role("button", name="그냥 하는 이야기", exact=True)
        expect(category).to_have_count(1)
        category.click()
    return box


def category_summary(page):
    return page.locator("summary").filter(
        has_text=re.compile(r"^(이야기 주제 고르기|그냥 하는 이야기)"))


def submit_button(page):
    button = page.get_by_role("button", name="이야기 올리기", exact=True)
    return button if button.count() else page.get_by_role("button", name="올리기", exact=True).first


def attach_images(page, count):
    disclosure = page.locator("summary").filter(has_text="사진·영상·이모지 더하기")
    if disclosure.count() and not disclosure.locator("..").evaluate("node => node.open"):
        disclosure.click()
    page.locator('input[type="file"][accept="image/*"][multiple]').set_input_files([
        {"name": f"fixture-{number}.png", "mimeType": "image/png", "buffer": PNG}
        for number in range(1, count + 1)
    ])
    expect(page.get_by_role("button", name=f"{count}번째 사진 빼기", exact=True)).to_be_visible()


def wait_draft(page, kind, uid, text):
    page.wait_for_function("""({key, text}) => {
        const draft = JSON.parse(localStorage.getItem(key) || '{}');
        return draft.content === text;
    }""", arg={"key": f"bg_draft_{kind}:{uid}", "text": text})


def assert_posted(page, fixture, kind, text):
    expected = (f"{APP}/app/diary?focus={NEW_IDS[kind]}" if kind == "diary"
                else f"{APP}/app/board/{NEW_IDS[kind]}")
    expect(page).to_have_url(expected)
    expect(page.get_by_text(text, exact=True)).to_be_visible()
    assert len(fixture.creates) == 1, fixture.creates
    assert fixture.creates[0]["args"]["p_content"] == text
    assert page.evaluate("key => localStorage.getItem(key)", f"bg_draft_{kind}:{fixture.uid}") is None


def draft_isolation(page, fixture, kind, output):
    box = writer(page, kind)
    expect(box).to_have_value("")  # The old accountless draft must not be imported.
    first = f"첫 번째 계정만 볼 수 있는 {kind} 작성 중 이야기입니다."
    second = f"두 번째 계정만 볼 수 있는 {kind} 작성 중 이야기입니다."
    box.fill(first)
    wait_draft(page, kind, A, first)
    fixture.switch_account(page, B)
    expect(box).to_be_enabled()
    expect(box).to_have_value("")
    box.fill(second)
    wait_draft(page, kind, B, second)
    fixture.switch_account(page, A)
    expect(box).to_have_value(first)
    wait_draft(page, kind, B, second)
    assert page.evaluate("key => JSON.parse(localStorage.getItem(key)).content", f"bg_draft_{kind}") == "LEGACY PRIVATE DRAFT"


def partial_upload(page, fixture, kind, output):
    text = f"사진이 일부 실패해도 잃어버리면 안 되는 {kind} 이야기입니다."
    box = fill_writer(page, kind, text)
    attach_images(page, 2)
    fixture.fail_upload_number = 2
    submit_button(page).click()
    expect(page.get_by_role("status").filter(has_text="사진을 모두 올리지 못했어요")).to_be_visible()
    expect(submit_button(page)).to_be_enabled()
    expect(box).to_have_value(text)
    wait_draft(page, kind, A, text)
    assert len(fixture.uploads) == 2 and not fixture.creates, (fixture.uploads, fixture.creates)
    expect(page.get_by_role("button", name="2번째 사진 빼기", exact=True)).to_be_visible()
    fixture.fail_upload_number = None
    submit_button(page).click()
    assert_posted(page, fixture, kind, text)
    assert len(fixture.creates[0]["args"]["p_images"]) == 2


def decode_retry(page, fixture, kind, output):
    text = f"이미지를 읽지 못해도 다시 올릴 수 있는 {kind} 이야기입니다."
    box = fill_writer(page, kind, text)
    attach_images(page, 1)
    page.evaluate("""() => {
        const original = window.createImageBitmap.bind(window);
        window.fixtureDecodeFailures = 0;
        window.createImageBitmap = (...args) => {
            if (window.fixtureDecodeFailures++ === 0)
                return Promise.reject(new DOMException('Fixture image decode failure', 'EncodingError'));
            return original(...args);
        };
    }""")
    submit_button(page).click()
    expect(page.get_by_role("status").filter(has_text="작성한 내용은 유지돼요")).to_be_visible()
    expect(submit_button(page)).to_be_enabled()
    expect(box).to_have_value(text)
    assert not fixture.uploads and not fixture.creates
    assert page.evaluate("window.fixtureDecodeFailures") == 1
    submit_button(page).click()
    assert_posted(page, fixture, kind, text)


def login_edit_return(page, fixture, kind, output):
    target = f"/app/{kind}/write?id={EDIT_IDS[kind]}&returnTest=1"
    page.goto(APP + target)
    expect(page).to_have_url(APP + "/app/login")
    assert page.evaluate("window.history.state?.usr?.from") == target
    page.locator('input[type="email"]').fill(fake_user(A)["email"])
    page.locator('input[type="password"]').fill("fixture-password-not-a-real-account")
    page.get_by_role("button", name="로그인", exact=True).click()
    expect(page).to_have_url(APP + target)
    expect(page.get_by_role("textbox", name="이야기 내용", exact=True)).to_have_value(
        fixture.posts[kind][EDIT_IDS[kind]]["content"])
    assert not fixture.creates


def category_required_disclosure(page, fixture, kind, output):
    text = "주제를 고르기 전에 본문부터 편하게 쓰고 이어서 올리는 이야기입니다."
    box = writer(page, kind)
    summary = category_summary(page)
    expect(summary).to_have_text("이야기 주제 고르기 (필수)")
    details = summary.locator("..")
    expect(details).to_have_js_property("open", False)
    box.fill(text)
    submit_button(page).click()
    expect(page.get_by_role("status").filter(has_text="어떤 이야기인지 하나만 골라주세요")).to_be_visible()
    expect(details).to_have_js_property("open", True)
    expect(summary).to_be_focused()
    expect(summary).to_be_in_viewport(ratio=1)
    expect(box).to_have_value(text)
    assert not fixture.creates and not fixture.uploads
    page.screenshot(path=str(output / "board-required-category-open-390.png"), full_page=True)
    page.get_by_role("button", name="그냥 하는 이야기", exact=True).click()
    expect(summary).to_have_text("그냥 하는 이야기 · 바꾸기")
    expect(details).to_have_js_property("open", False)
    expect(box).to_have_value(text)
    submit_button(page).click()
    assert_posted(page, fixture, kind, text)
    assert fixture.creates[0]["args"]["p_category"] == "chat"


def layout(page, fixture, kind, output):
    for width in (390, 320, 480, 1440):
        page.set_viewport_size({"width": width, "height": 900})
        box = writer(page, kind)
        page.screenshot(path=str(output / f"{kind}-writing-empty-{width}.png"), full_page=True)
        if width == 390:
            page.screenshot(path=str(output / f"{kind}-writing-top-390.png"), full_page=False)
        expect(box).to_have_css("font-size", "16px")
        expect(page.get_by_role("textbox", name="이야기 내용", exact=True)).to_have_count(1)
        details = page.locator("details")
        assert details.count() > 0, "Optional choices should use an initially closed disclosure"
        assert details.evaluate_all("nodes => nodes.every(node => !node.open)")
        box.fill("편하게 쓰는 오늘의 이야기입니다. 긴 문장이 좁은 화면에서도 자연스럽게 이어지는지 확인해요. " * 3)
        buttons = page.get_by_role("button", name=re.compile(r"^(이야기 올리기|올리기)$"))
        assert buttons.count() > 0
        sizes = buttons.evaluate_all("nodes => nodes.map(node => ({height: node.getBoundingClientRect().height, width: node.getBoundingClientRect().width}))")
        assert all(size["height"] >= 43.5 and size["width"] >= 43.5 for size in sizes), sizes
        measure = page.evaluate("({viewport: document.documentElement.clientWidth, width: document.documentElement.scrollWidth})")
        assert measure["width"] <= measure["viewport"] + 1, (kind, width, measure)
        page.screenshot(path=str(output / f"{kind}-writing-{width}.png"), full_page=True)
    assert not fixture.creates


def main():
    output = (Path(os.environ["TEST_OUTPUT"]).expanduser().resolve() if os.environ.get("TEST_OUTPUT")
              else Path(tempfile.mkdtemp(prefix="bg-community-writing-")))
    output.mkdir(parents=True, exist_ok=True)
    print("Test artifacts:", output, flush=True)
    assert bridge("/health").get("ready"), "Start the local community-ui-server.mjs bridge first"
    results = []
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        try:
            for kind in ("diary", "board"):
                cases = [
                    ("account-draft-isolation-and-legacy-exclusion", draft_isolation),
                    ("partial-upload-no-create-and-retry-focus", partial_upload),
                    ("decode-exception-retry-and-focus", decode_retry),
                    ("login-preserves-edit-query-and-returns", login_edit_return),
                    ("readable-input-disclosures-touch-targets-and-widths", layout),
                ]
                if kind == "board":
                    cases.append(("missing-category-opens-focuses-selects-and-publishes", category_required_disclosure))
                for name, test in cases:
                    fixture = WritingFixture(None if test == login_edit_return else A)
                    legacy = {f"bg_draft_{item}": json.dumps({"content": "LEGACY PRIVATE DRAFT", "category": "chat", "steps": "12"})
                              for item in ("diary", "board")} if test == draft_isolation else {}
                    context, page = fixture.setup(browser, legacy)
                    result = {"name": f"{kind}:{name}", "passed": False}
                    try:
                        test(page, fixture, kind, output)
                        assert not fixture.errors, fixture.errors
                        assert not fixture.unexpected, fixture.unexpected
                        assert not fixture.bridge_failures, fixture.bridge_failures
                        result["passed"] = True
                        print("PASS", result["name"], flush=True)
                    except Exception as error:
                        result["error"] = str(error)
                        result["traceback"] = traceback.format_exc()
                        print("FAIL", result["name"], str(error), flush=True)
                        try:
                            page.screenshot(path=str(output / f"failed-{kind}-{name}.png"), full_page=True)
                        except Exception:
                            pass
                    finally:
                        result.update({"javascript_errors": fixture.errors,
                                       "unexpected_requests": fixture.unexpected,
                                       "failed_bridge_reads": fixture.bridge_failures,
                                       "blocked_external_requests": fixture.blocked_external,
                                       "fixture_create_count": len(fixture.creates),
                                       "fixture_upload_count": len(fixture.uploads)})
                        results.append(result)
                        context.close()
        finally:
            browser.close()
    report = {"passed": sum(row["passed"] for row in results), "total": len(results),
              "app": APP, "checks": results,
              "boundary": "Fake Auth; explicit in-memory create/Storage responses; only allowlisted reads reach the loopback SQL bridge. No production writes or external HTTP/WebSocket forwarding."}
    (output / "community-writing-results.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"{report['passed']}/{report['total']} writing scenarios passed", flush=True)
    return 0 if all(row["passed"] for row in results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
