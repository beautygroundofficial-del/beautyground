"""Local UI regression: home feed failures, retry, same-sort clicks and video.

Every non-loopback request is fulfilled from fixtures or blocked. This does not
exercise production auth, SQL, Storage or real video playback. Run against a
local Vite/preview server with APP=http://127.0.0.1:<port>.
"""
import json
import os
import re
import tempfile
from pathlib import Path
from urllib.parse import urlsplit

from playwright.sync_api import expect, sync_playwright

APP = os.environ.get('APP', 'http://127.0.0.1:5199').rstrip('/')
origin = urlsplit(APP)
if (origin.scheme not in ('http', 'https') or origin.hostname not in ('127.0.0.1', 'localhost', '::1')
        or origin.username or origin.password or origin.path or origin.query or origin.fragment):
    raise ValueError('APP must be a loopback HTTP(S) origin')
OUTPUT = Path(os.environ['TEST_OUTPUT']).resolve() if os.environ.get('TEST_OUTPUT') else Path(tempfile.mkdtemp(prefix='bg-community-feed-'))
OUTPUT.mkdir(parents=True, exist_ok=True)
DIARY = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
STORY = '테스트 이야기: 서로의 평범한 하루를 읽고 마음을 나누어요.'
ROW = {
    'id': DIARY, 'user_id': '22222222-2222-4222-8222-222222222222',
    'nickname': '검증회원', 'content': STORY, 'images': [], 'video_url': None,
    'like_count': 0, 'liked_by_me': False, 'is_mine': False,
    'pat': 0, 'same': 0, 'cheer': 0, 'my_kind': None, 'comment_count': 0,
    'steps': None, 'pets': [], 'created_at': '2026-09-28T00:00:00Z',
}
state = {'failures': 1, 'rows': [ROW]}
checks, errors, auxiliary, blocked, feed_requests = [], [], [], [], []


def passed(name):
    checks.append(name)
    print('PASS', name, flush=True)


print('Starting isolated feed browser', flush=True)
with sync_playwright() as pw:
    print('Playwright ready; launching Chromium', flush=True)
    browser = pw.chromium.launch(headless=True, timeout=20000)
    print('Chromium ready; configuring fixtures', flush=True)
    context = browser.new_context(viewport={'width': 390, 'height': 844}, service_workers='block')

    def route(request_route):
        request = request_route.request
        parsed = urlsplit(request.url)
        if (parsed.scheme, parsed.netloc) == (origin.scheme, origin.netloc):
            if parsed.path.startswith('/api/') or parsed.path.startswith('/fixture-'):
                return request_route.fulfill(status=200, content_type='application/json', body='[]')
            return request_route.continue_()
        if parsed.hostname == 'supabase.co' or (parsed.hostname or '').endswith('.supabase.co'):
            if parsed.path == '/rest/v1/rpc/get_diary_feed':
                feed_requests.append(request.post_data_json)
                if state['failures']:
                    state['failures'] -= 1
                    return request_route.fulfill(status=503, content_type='application/json', body=json.dumps({'code': 'FIXTURE_OUTAGE', 'message': 'Local test outage'}))
                return request_route.fulfill(status=200, content_type='application/json', body=json.dumps(state['rows']))
            if parsed.path == '/rest/v1/rpc/get_member_count':
                return request_route.fulfill(status=200, content_type='application/json', body='0')
            auxiliary.append(parsed.path)
            return request_route.fulfill(status=200, content_type='application/json', body='[]')
        blocked.append(request.url)
        return request_route.fulfill(status=200, content_type='image/svg+xml', body='<svg xmlns="http://www.w3.org/2000/svg"/>')

    context.route('**/*', route)
    context.route_web_socket('**/*', lambda socket: socket.close())
    page = context.new_page()
    page.set_default_timeout(10000)
    page.set_default_navigation_timeout(20000)
    page.on('pageerror', lambda error: errors.append(str(error)))
    try:
        print('Opening local home', flush=True)
        page.goto(APP + '/app/home', wait_until='domcontentloaded')
        print('Local home DOM ready', flush=True)
        home = page.locator('section').filter(has=page.get_by_role('heading', name='사람들의 이야기', exact=True))
        expect(home.get_by_role('alert')).to_contain_text('이야기를 불러오지 못했어요')
        expect(home.get_by_text('아직 아무도 오늘을 남기지 않았어요', exact=True)).to_have_count(0)
        passed('Home RPC failure is an error, not an empty community')

        home.get_by_role('button', name='다시 불러오기', exact=True).click()
        expect(home.get_by_text(STORY, exact=True)).to_be_visible()
        expect(home.get_by_role('alert')).to_have_count(0)
        passed('Home retry recovers the real feed fixture')

        home.get_by_role('button', name=STORY, exact=True).click()
        expect(page).to_have_url(re.compile(r'/app/diary\?focus=' + DIARY + '$'))
        expect(page.get_by_text(STORY, exact=True)).to_be_visible()
        passed('Home story still opens the exact diary')

        for label in ('최신', '최신', '인기', '인기', '산책', '산책', '최신'):
            page.get_by_role('button', name=label, exact=True).click()
            expect(page.get_by_text(STORY, exact=True)).to_be_visible()
            expect(page.get_by_role('button', name=label, exact=True)).to_have_attribute('aria-pressed', 'true')
            expect(page.get_by_text('불러오는 중…', exact=True)).to_have_count(0)
        passed('Repeated active sort clicks do not hide the diary or stall loading')

        state['rows'] = []
        page.goto(APP + '/app/home', wait_until='domcontentloaded')
        expect(home.get_by_text('아직 아무도 오늘을 남기지 않았어요', exact=True)).to_be_visible()
        expect(home.get_by_role('alert')).to_have_count(0)
        passed('Successful empty feed retains the genuine empty state')

        state['rows'] = [{**ROW, 'video_url': APP + '/fixture-video.mp4'}]
        page.goto(APP + '/app/home', wait_until='domcontentloaded')
        video = home.locator('video')
        expect(video).to_have_count(1)
        assert video.evaluate('(node) => node.closest("button") === null')
        video.dispatch_event('click')
        expect(page).to_have_url(APP + '/app/home')
        home.get_by_role('button', name=STORY, exact=True).click()
        expect(page).to_have_url(re.compile(r'/app/diary\?focus=' + DIARY + '$'))
        passed('Video is outside navigation buttons; video click stays and story click opens')
        assert not errors, errors
    except Exception:
        page.screenshot(path=str(OUTPUT / 'feed-failure.png'), full_page=True, timeout=5000)
        raise
    finally:
        (OUTPUT / 'feed-results.json').write_text(json.dumps({
            'checks': checks, 'page_errors': errors, 'feed_requests': feed_requests,
            'auxiliary_fixture_paths': sorted(set(auxiliary)), 'blocked_external_requests': blocked,
            'limits': 'Fixture HTTP responses only; no actual auth, DB writes, Storage or video decoding tested',
        }, ensure_ascii=False, indent=2), encoding='utf-8')
        context.close()
        browser.close()

print(f'{len(checks)}/6 feed checks passed; artifacts: {OUTPUT}', flush=True)
