"""Isolated board retry and header account-change checks; no live requests.

APP must be a loopback production preview. BEFORE_ONLY=1 records the old board
failure. Auth notifications are controlled fixtures, not a real login test.
"""
import base64
import json
import os
from pathlib import Path
import re
import time
from urllib.parse import urlsplit

from playwright.sync_api import expect, sync_playwright

APP = os.environ.get('APP', 'http://127.0.0.1:5212').rstrip('/')
ORIGIN = urlsplit(APP)
if (ORIGIN.scheme not in ('http', 'https') or ORIGIN.hostname not in ('127.0.0.1', 'localhost', '::1')
        or ORIGIN.username or ORIGIN.password or ORIGIN.path or ORIGIN.query or ORIGIN.fragment):
    raise ValueError('APP must be a loopback HTTP(S) origin')
OUTPUT = Path(os.environ['TEST_OUTPUT']).resolve()
OUTPUT.mkdir(parents=True, exist_ok=True)
A = '11111111-1111-4111-8111-111111111111'
B = '22222222-2222-4222-8222-222222222222'
POST = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'
COMMENT = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1'
POST_URL = f'{APP}/app/board/{POST}?comments&comment={COMMENT}'
CONTENT = '검증용 이야기입니다. 오늘 나눈 따뜻한 한마디가 오래 기억나요.'
REPLY = '검증용 댓글입니다. 저도 비슷한 하루를 보냈어요.'
state = {'uid': A, 'board': '503'}
checks, errors, unexpected, requests = [], [], [], []


def user(uid):
    return {'id': uid, 'aud': 'authenticated', 'role': 'authenticated',
            'email': ('fixture-a' if uid == A else 'fixture-b') + '@invalid.example',
            'created_at': '2026-01-01T00:00:00Z', 'email_confirmed_at': '2026-01-01T00:00:00Z',
            'app_metadata': {'provider': 'email', 'providers': ['email']},
            'user_metadata': {'name': '검증가' if uid == A else '검증나'}}


def session(uid):
    def enc(value):
        return base64.urlsafe_b64encode(json.dumps(value).encode()).decode().rstrip('=')
    token = enc({'alg': 'HS256', 'typ': 'JWT'}) + '.' + enc({
        'sub': uid, 'aud': 'authenticated', 'role': 'authenticated',
        'exp': int(time.time()) + 7200}) + '.fixture-only'
    return {'access_token': token, 'refresh_token': 'fixture-only', 'token_type': 'bearer',
            'expires_in': 7200, 'expires_at': int(time.time()) + 7200, 'user': user(uid)}


def record(name):
    checks.append(name)
    print('PASS', name, flush=True)


def route_handler(route):
    req = route.request
    parsed = urlsplit(req.url)
    path = parsed.path
    def reply(body, status=200):
        route.fulfill(status=status, content_type='application/json', body=json.dumps(body))
    if (parsed.scheme, parsed.netloc) == (ORIGIN.scheme, ORIGIN.netloc):
        return reply([]) if path.startswith('/api/') else route.continue_()
    if not (parsed.hostname or '').endswith('.supabase.co'):
        return route.fulfill(status=200, content_type='image/svg+xml',
                             body='<svg xmlns="http://www.w3.org/2000/svg"/>')
    if path == '/auth/v1/user':
        return reply(user(state['uid'])) if state['uid'] else reply({'message': 'No fixture session'}, 401)
    if path.startswith('/rest/v1/rpc/'):
        rpc = path.rsplit('/', 1)[-1]
        if rpc == 'get_board_post':
            requests.append({'rpc': rpc, 'args': req.post_data_json, 'mode': state['board']})
            if state['board'] in ('403', '503'):
                return reply({'code': 'FIXTURE_ERROR', 'message': 'Test-only request failure'}, int(state['board']))
            if state['board'] == 'missing':
                return reply([])
            return reply([{'id': POST, 'user_id': B, 'nickname': '검증나', 'category': 'chat',
                           'content': CONTENT, 'images': [], 'video_url': None, 'created_at': '2026-09-28T00:00:00Z',
                           'is_mine': False, 'like_count': 0, 'liked_by_me': False, 'comment_count': 1,
                           'pat': 0, 'same': 0, 'cheer': 0, 'my_kind': None}])
        if rpc == 'get_board_comments':
            return reply([{'id': COMMENT, 'user_id': B, 'nickname': '검증나', 'content': REPLY,
                           'is_mine': False, 'created_at': '2026-09-28T00:01:00Z', 'parent_comment_id': None}])
        if rpc == 'get_member_count':
            return reply(7340)
        if rpc == 'is_admin':
            return reply(False)
        if rpc == 'get_my_nickname':
            return reply('검증가')
        if rpc.startswith('get_'):
            return reply([])
    if path.startswith('/rest/v1/') and req.method == 'GET':
        return reply([])
    if path == '/rest/v1/site_visits' and req.method == 'POST':
        return reply({}, 201)
    unexpected.append(req.method + ' ' + path)
    return reply({'code': 'UNEXPECTED_FIXTURE_REQUEST'}, 500)


with sync_playwright() as pw:
    browser = pw.chromium.launch(headless=True)
    context = browser.new_context(viewport={'width': 390, 'height': 844}, service_workers='block')
    context.add_init_script("""(() => {
      const token = TOKEN;
      const get = Storage.prototype.getItem;
      const set = Storage.prototype.setItem;
      Storage.prototype.getItem = function(key) {
        if (this === localStorage && /^sb-.+-auth-token$/.test(key) && !get.call(this,'fixture-seeded:'+key)) {
          set.call(this,key,JSON.stringify(token)); set.call(this,'fixture-seeded:'+key,'1');
        }
        return get.call(this,key);
      };
    })();""".replace('TOKEN', json.dumps(session(A))))
    context.route('**/*', route_handler)
    context.route_web_socket('**/*', lambda ws: ws.close())
    page = context.new_page()
    page.set_default_timeout(12000)
    page.on('pageerror', lambda err: errors.append(str(err)))
    try:
        page.goto(POST_URL, wait_until='domcontentloaded')
        if os.environ.get('BEFORE_ONLY') == '1':
            expect(page.get_by_text('이미 지워진 이야기예요', exact=True)).to_be_visible()
            page.screenshot(path=str(OUTPUT / 'board-before-503.png'), full_page=True)
            record('Before: a simulated 503 is incorrectly shown as a deleted story')
        else:
            expect(page.get_by_role('alert')).to_contain_text('이야기를 불러오지 못했어요')
            expect(page.get_by_text('이미 지워진 이야기예요', exact=True)).to_have_count(0)
            retry = page.get_by_role('button', name='다시 불러오기', exact=True)
            assert retry.bounding_box()['height'] >= 44
            page.screenshot(path=str(OUTPUT / 'board-after-503.png'), full_page=True)
            record('503 presents a retry, not a deleted-story claim')

            state['board'] = 'ok'
            retry.click()
            expect(page.get_by_text(CONTENT, exact=True)).to_be_visible()
            expect(page.get_by_text(REPLY, exact=True)).to_be_visible()
            expect(page.locator(f'#comment-board-{POST}-{COMMENT}')).to_have_class(re.compile('ring-1'))
            expect(page).to_have_url(POST_URL)
            record('Retry restores the original post and the linked comment without losing its URL')

            state['board'] = '403'
            page.goto(POST_URL, wait_until='domcontentloaded')
            expect(page.get_by_role('alert')).to_contain_text('이야기를 불러오지 못했어요')
            expect(page.get_by_text('이미 지워진 이야기예요', exact=True)).to_have_count(0)
            record('403 is a retrieval error instead of a deleted-story claim')

            state['board'] = 'missing'
            page.goto(POST_URL, wait_until='domcontentloaded')
            expect(page.get_by_text('이미 지워진 이야기예요', exact=True)).to_be_visible()
            expect(page.get_by_role('alert')).to_have_count(0)
            record('A successful empty response retains the distinct missing-story state')

            state['board'] = 'ok'
            for width in (320, 390, 480, 1440):
                page.set_viewport_size({'width': width, 'height': 900})
                page.goto(POST_URL, wait_until='domcontentloaded')
                expect(page.get_by_text(CONTENT, exact=True)).to_be_visible()
                assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')
                page.screenshot(path=str(OUTPUT / f'board-recovered-{width}.png'), full_page=True)
            record('Recovered story and comments fit 320/390/480/1440px without horizontal overflow')

            page.set_viewport_size({'width': 390, 'height': 844})
            page.goto(APP + '/app/home', wait_until='domcontentloaded')
            expect(page.get_by_text('환영합니다, 검증가님', exact=True)).to_be_visible()
            session_keys = page.evaluate("Object.keys(localStorage).filter(k => /^sb-.+-auth-token$/.test(k))")
            assert session_keys, 'Missing fixture session key'
            for uid in (B, None, A):
                state['uid'] = uid
                page.evaluate("""({token, keys}) => {
                  for (const key of keys) {
                    if (token) localStorage.setItem(key,JSON.stringify(token)); else localStorage.removeItem(key);
                    const channel = new BroadcastChannel(key);
                    channel.postMessage({event:token?'SIGNED_IN':'SIGNED_OUT',session:token});
                    setTimeout(()=>channel.close(),1000);
                  }
                }""", {'token': session(uid) if uid else None, 'keys': session_keys})
                if uid:
                    expect(page.get_by_text('환영합니다, '+('검증가' if uid == A else '검증나')+'님', exact=True)).to_be_visible()
                else:
                    expect(page.get_by_text(re.compile('환영합니다,'))).to_have_count(0)
                    expect(page.get_by_role('img', name='뷰티그라운드', exact=True)).to_be_visible()
            record('Header responds to controlled cross-tab account changes and logout without reload')
            assert not errors, errors
            assert not unexpected, unexpected
    except Exception:
        page.screenshot(path=str(OUTPUT / 'failure.png'), full_page=True)
        raise
    finally:
        result = {'checks': checks, 'page_errors': errors, 'unexpected_requests': unexpected,
                  'board_requests': requests, 'before_only': os.environ.get('BEFORE_ONLY') == '1',
                  'limits': 'Mock HTTP and Auth broadcast messages only; no live requests or real users'}
        target = OUTPUT / 'return-ui-results.json'
        temp = target.with_suffix('.tmp')
        temp.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
        temp.replace(target)
        context.close()
        browser.close()
print(f'{len(checks)} checks passed; {OUTPUT}', flush=True)
