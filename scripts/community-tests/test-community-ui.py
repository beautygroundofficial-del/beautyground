"""Two fake users exercise a local app against the isolated community SQL bridge.

No production Supabase request is forwarded. Auth, analytics and auxiliary data
are fixtures; this is not a live-backend or login/payment integration test.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
from urllib.parse import urlsplit, parse_qs
import json, time, base64, urllib.request, urllib.error, re, os, tempfile

APP=os.environ.get('APP','http://127.0.0.1:5199').rstrip('/')
app_url=urlsplit(APP)
if (app_url.scheme not in ('http','https') or app_url.hostname not in ('127.0.0.1','localhost','::1')
        or app_url.username or app_url.password or app_url.path or app_url.query or app_url.fragment):
    raise ValueError('APP must be a loopback HTTP(S) origin, for example http://127.0.0.1:5199')
PORT=int(os.environ.get('PORT','5201'))
if not 1 <= PORT <= 65535:
    raise ValueError('PORT must be 1..65535')
API=f'http://127.0.0.1:{PORT}'
TEST_OUTPUT=Path(os.environ['TEST_OUTPUT']).expanduser().resolve() if os.environ.get('TEST_OUTPUT') else Path(tempfile.mkdtemp(prefix='bg-community-ui-'))
TEST_OUTPUT.mkdir(parents=True,exist_ok=True)
print('Test artifacts:',TEST_OUTPUT,flush=True)
A='11111111-1111-4111-8111-111111111111'
B='22222222-2222-4222-8222-222222222222'
DIARY='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
ANSWER='dddddddd-dddd-4ddd-8ddd-ddddddddddd1'
BOARD='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'
checks=[]; errors=[]; failures=[]; outside=[]; auxiliary=[]; inject={}

def request(path,body=None):
    r=urllib.request.Request(API+path,data=json.dumps(body).encode() if body is not None else None,headers={'Content-Type':'application/json'})
    with urllib.request.urlopen(r,timeout=30) as response:return json.load(response)

def passed(name):
    checks.append(name)
    print('PASS',name,flush=True)

def user(uid):
    name='Fixture A' if uid==A else 'Fixture B'
    return {'id':uid,'aud':'authenticated','role':'authenticated','email':('fixture-a' if uid==A else 'fixture-b')+'@invalid.example','email_confirmed_at':'2026-01-01T00:00:00Z','created_at':'2026-01-01T00:00:00Z','app_metadata':{'provider':'email','providers':['email']},'user_metadata':{'name':name,'nickname':name}}

def session(uid):
    def enc(obj):return base64.urlsafe_b64encode(json.dumps(obj).encode()).decode().rstrip('=')
    token=enc({'alg':'HS256','typ':'JWT'})+'.'+enc({'sub':uid,'aud':'authenticated','role':'authenticated','exp':int(time.time())+7200})+'.fixture-only'
    return {'access_token':token,'refresh_token':'fixture-refresh-'+uid,'token_type':'bearer','expires_in':7200,'expires_at':int(time.time())+7200,'user':user(uid)}

def setup(browser,uid):
    context=browser.new_context(viewport={'width':390,'height':844},service_workers='block')
    # Seed whichever default Supabase storage key this local app uses. The token
    # is deliberately invalid outside this fixture; no real project ID is stored.
    # Each key is seeded once, so an explicit sign-out cannot recreate a session.
    context.add_init_script('const fixtureToken='+json.dumps(json.dumps(session(uid)))+''';
        const originalGet=Storage.prototype.getItem;
        const originalSet=Storage.prototype.setItem;
        Storage.prototype.getItem=function(key) {
            if(this===window.localStorage && typeof key==='string' && /^sb-.+-auth-token$/.test(key)) {
                const marker='fixture-session-seeded:'+key;
                if(!originalGet.call(this,marker)) {
                    originalSet.call(this,key,fixtureToken);
                    originalSet.call(this,marker,'1');
                }
            }
            return originalGet.call(this,key);
        };
    ''')
    def route(route):
        url=route.request.url
        parsed=urlsplit(url)
        if (parsed.scheme,parsed.netloc)==(app_url.scheme,app_url.netloc):
            if parsed.path.startswith('/api/'):
                auxiliary.append('local app API: explicit empty fixture')
                return route.fulfill(status=200,content_type='application/json',body='[]')
            return route.continue_()
        # Supabase HTTP requests always terminate here or at the loopback bridge.
        # No route.continue_()/route.fetch() is allowed for an external origin.
        if parsed.hostname=='supabase.co' or (parsed.hostname or '').endswith('.supabase.co'):
            path=parsed.path+('?' + parsed.query if parsed.query else '')
            if path.startswith('/rest/v1/site_visits'):
                auxiliary.append('site_visits analytics: fixture only')
                return route.fulfill(status=201,content_type='application/json',body='{}')
            rpc=path.split('?')[0].split('/')[-1]
            if inject.get((uid,rpc),0)>0:
                inject[(uid,rpc)]-=1
                return route.fulfill(status=503,content_type='application/json',body=json.dumps({'message':'Test-only temporary outage','code':'FIXTURE_OUTAGE'}))
            if path.startswith('/auth/v1/user'):
                return route.fulfill(status=200,content_type='application/json',body=json.dumps(user(uid)))
            if path.startswith('/auth/v1/'):
                return route.fulfill(status=200,content_type='application/json',body=json.dumps(session(uid)))
            body=route.request.post_data_json if route.request.post_data else None
            result=request('/request',{'uid':uid,'method':route.request.method,'path':path,'body':body,'headers':route.request.headers})
            if result.get('status',200)>=400: failures.append({'path':path,'body':result.get('body')})
            return route.fulfill(status=result.get('status',200),content_type='application/json',body=json.dumps(result.get('body')))
        outside.append(url)
        return route.fulfill(status=200,content_type='image/svg+xml',body='<svg xmlns="http://www.w3.org/2000/svg"/>')
    context.route('**/*',route)
    # Service workers and sockets must not bypass the HTTP interception boundary.
    # Playwright >= 1.48: do not connect_to_server() for any routed WebSocket.
    context.route_web_socket('**/*',lambda socket:socket.close())
    page=context.new_page()
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('dialog',lambda d:d.accept())
    return context,page

request('/reset',{})
with sync_playwright() as pw:
    # Separate browser processes, not just tabs, reproduce two independent users.
    ba=pw.chromium.launch(headless=True);bb=pw.chromium.launch(headless=True)
    ca,a=setup(ba,A);cb,b=setup(bb,B)
    b.goto(APP+'/app/diary?focus='+DIARY+'&comments='+DIARY)
    expect(b.get_by_role('textbox',name='댓글 내용')).to_be_visible()
    b.get_by_role('textbox',name='댓글 내용').fill('같은 마음을 느껴서 제 경험도 나누고 싶어요.')
    b.get_by_role('button',name='남기기',exact=True).click()
    expect(b.get_by_text('같은 마음을 느껴서 제 경험도 나누고 싶어요.',exact=True)).to_be_visible()
    passed('B posts a real SQL-backed comment through the app')

    a.goto(APP+'/app/news')
    notice=a.get_by_role('button').filter(has_text='같은 마음을 느껴서 제 경험도')
    expect(notice).to_have_count(1)
    notice.click()
    expect(a).to_have_url(re.compile(r'comment='))
    comment=a.locator('[id^="comment-diary-"]').filter(has_text='같은 마음을 느껴서 제 경험도').first
    expect(comment).to_be_visible()
    passed('A opens the exact comment from news, including an old diary')
    comment.get_by_role('button',name='답글',exact=True).click()
    reply=a.get_by_placeholder('답글을 남겨주세요')
    reply.fill('마음을 알아주셔서 고마워요. 덕분에 한결 편안해졌어요.')
    comment.get_by_role('button',name='남기기',exact=True).click()
    expect(a.get_by_text('마음을 알아주셔서 고마워요. 덕분에 한결 편안해졌어요.',exact=True)).to_be_visible()
    b.goto(APP+'/app/news')
    expect(b.get_by_text('내 댓글에 답글을 남겼어요',exact=False)).to_be_visible()
    b.get_by_role('button').filter(has_text='마음을 알아주셔서 고마워요.').click()
    expect(b).to_have_url(re.compile(r'comment='))
    passed('A replies and B receives and opens that reply')

    a.goto(APP+'/app/people/'+B)
    expect(a.get_by_role('button',name='친구 신청',exact=True)).to_be_enabled()
    a.get_by_role('button',name='친구 신청',exact=True).click()
    b.goto(APP+'/app/news')
    expect(b.get_by_text('친구 신청을 보냈어요',exact=False)).to_be_visible()
    b.get_by_role('button').filter(has_text='친구 신청을 보냈어요').click()
    expect(b).to_have_url(APP+'/app/friends')
    b.get_by_role('button',name='수락',exact=True).click()
    expect(b.get_by_role('button',name='끊기',exact=True)).to_be_visible()
    a.goto(APP+'/app/news')
    expect(a.get_by_text('친구 신청을 받아줬어요',exact=False)).to_be_visible()
    a.get_by_role('button').filter(has_text='친구 신청을 받아줬어요').click()
    expect(a.get_by_role('button',name=re.compile('친구'))).to_be_visible()
    passed('Friend request, received news, acceptance and both profiles stay consistent')

    b.goto(APP+'/app/friends')
    b.get_by_role('button',name='끊기',exact=True).click()
    expect(b.get_by_text('아직 친구가 없어요',exact=True)).to_be_visible()
    a.goto(APP+'/app/people/'+B)
    expect(a.get_by_role('button',name='친구 신청',exact=True)).to_be_visible()
    a.get_by_role('button',name='친구 신청',exact=True).click()
    a.goto(APP+'/app/friends')
    a.get_by_role('button',name='취소',exact=True).click()
    b.goto(APP+'/app/friends')
    expect(b.get_by_role('button',name='수락',exact=True)).to_have_count(0)
    passed('Unfriend and cancel request propagate to the other account')

    b.goto(APP+'/app/home?answer='+ANSWER)
    expect(b.get_by_role('textbox',name='댓글 내용')).to_be_visible()
    expect(b.get_by_text('Old answer',exact=True)).to_be_visible()
    b.get_by_role('textbox',name='댓글 내용').fill('지난 이야기도 다시 읽으니 공감이 되네요.')
    b.get_by_role('button',name='남기기',exact=True).click()
    a.goto(APP+'/app/news')
    a.get_by_role('button').filter(has_text='지난 이야기도 다시 읽으니').click()
    expect(a).to_have_url(re.compile(r'/app/home\?answer=.*&comment='))
    expect(a.get_by_text('지난 이야기도 다시 읽으니 공감이 되네요.',exact=True)).to_be_visible()
    passed('Old daily-answer comment notification returns to its original answer')

    a.goto(APP+'/app/diary?focus='+DIARY+'&comments='+DIARY)
    a.get_by_role('textbox',name='댓글 내용').fill('아직 보내지 않은 마음을 잠시 남겨둡니다.')
    a.reload()
    expect(a.get_by_role('textbox',name='댓글 내용')).to_have_value('아직 보내지 않은 마음을 잠시 남겨둡니다.')
    b.goto(APP+'/app/diary?focus='+DIARY+'&comments='+DIARY)
    expect(b.get_by_role('textbox',name='댓글 내용')).to_have_value('')
    passed('Draft survives reload and is isolated between users')

    a.get_by_role('textbox',name='댓글 내용').fill('프로필을 보고 돌아와도 남아 있어야 하는 초안')
    a.locator('[id^="comment-diary-"]').filter(has_text='같은 마음을 느껴서').first.get_by_role('button',name=re.compile('님의 이야기 보기')).click()
    expect(a).to_have_url(APP+'/app/people/'+B)
    a.get_by_role('button',name='뒤로 가기',exact=True).click()
    expect(a).to_have_url(re.compile(r'/app/diary\?focus=.*&comments=.*&comment='))
    expect(a.get_by_role('textbox',name='댓글 내용')).to_have_value('프로필을 보고 돌아와도 남아 있어야 하는 초안')
    passed('Comment profile visit returns to the same thread with its draft')

    # Start without a deep-link query, then use browser/hardware back rather
    # than the profile's in-app back button. Both paths must restore the thread.
    a.goto(APP+'/app/diary')
    expect(a).to_have_url(APP+'/app/diary')
    diary=a.locator('#diary-'+DIARY)
    diary.get_by_role('button',name=re.compile(r'^댓글 \d+개 보기$')).click()
    diary.get_by_role('textbox',name='댓글 내용').fill('브라우저 뒤로 가기로 돌아와도 남아 있어야 하는 초안')
    visited=diary.locator('[id^="comment-diary-"]').filter(has_text='같은 마음을 느껴서').first
    visited_dom_id=visited.get_attribute('id')
    visited_id=visited_dom_id.removeprefix('comment-diary-'+DIARY+'-')
    visited.get_by_role('button',name=re.compile('님의 이야기 보기')).click()
    expect(a).to_have_url(APP+'/app/people/'+B)
    a.go_back()
    expect(a).to_have_url(re.compile(r'/app/diary\?focus=.*&comments=.*&comment='))
    restored=parse_qs(urlsplit(a.url).query)
    assert restored.get('focus')==[DIARY] and restored.get('comments')==[DIARY],restored
    assert restored.get('comment')==[visited_id],restored
    expect(a.locator('#'+visited_dom_id)).to_be_visible()
    expect(a.get_by_role('textbox',name='댓글 내용')).to_have_value('브라우저 뒤로 가기로 돌아와도 남아 있어야 하는 초안')
    passed('Browser back restores a manually opened thread, exact comment and draft')

    inject[(A,'get_user_profile')]=1
    a.goto(APP+'/app/people/'+B)
    expect(a.get_by_role('alert').filter(has_text='이야기를 불러오지 못했어요')).to_be_visible()
    expect(a.get_by_text('찾을 수 없는 사람이에요',exact=True)).to_have_count(0)
    a.get_by_role('button',name='다시 불러오기',exact=True).click()
    expect(a.get_by_role('button',name='친구 신청',exact=True)).to_be_enabled()
    expect(a.get_by_role('alert')).to_have_count(0)
    passed('Profile read failure is distinct from a missing user and retry restores it')

    b.goto(APP+'/app/board/'+BOARD+'?comments=1')
    expect(b.get_by_role('textbox',name='댓글 내용')).to_be_visible()
    b.get_by_role('textbox',name='댓글 내용').fill('속 이야기는 서로의 신원을 드러내지 않고 나눠요.')
    b.get_by_role('button',name='남기기',exact=True).click()
    expect(b.get_by_text('속 이야기는 서로의 신원을 드러내지 않고 나눠요.',exact=True)).to_be_visible()
    a.goto(APP+'/app/news')
    a.get_by_role('button').filter(has_text='속 이야기는 서로의 신원을 드러내지').click()
    expect(a).to_have_url(re.compile(r'/app/board/.*\?comments=1&comment='))
    row=a.locator('[id^="comment-board-"]').filter(has_text='속 이야기는 서로의 신원을 드러내지').first
    expect(row).to_be_visible()
    expect(row.get_by_role('button',name=re.compile('님의 이야기 보기'))).to_have_count(0)
    passed('Board comment and exact news link work while keeping profile identity private')

    inject[(B,'get_diary_comment_thread')]=1
    b.goto(APP+'/app/diary?focus='+DIARY+'&comments='+DIARY)
    expect(b.get_by_role('alert').filter(has_text='댓글을 불러오지 못했어요')).to_be_visible()
    b.get_by_role('button',name='다시 불러오기',exact=True).click()
    expect(b.get_by_text('같은 마음을 느껴서 제 경험도 나누고 싶어요.',exact=True)).to_be_visible()
    inject[(B,'create_diary_comment')]=1
    b.get_by_role('textbox',name='댓글 내용').fill('전송 실패 후에도 남아 있어야 하는 댓글')
    b.get_by_role('button',name='남기기',exact=True).click()
    expect(b.get_by_role('textbox',name='댓글 내용')).to_have_value('전송 실패 후에도 남아 있어야 하는 댓글')
    expect(b.get_by_role('button',name='남기기',exact=True)).to_be_enabled()
    b.get_by_role('button',name='남기기',exact=True).click()
    expect(b.get_by_text('전송 실패 후에도 남아 있어야 하는 댓글',exact=True)).to_be_visible()
    expect(b.get_by_role('textbox',name='댓글 내용')).to_have_value('')
    passed('Read failure is retryable; failed send retains draft and retry succeeds')

    seeded=request('/seed',{'comments':51,'target':'diary','author':'B'})
    b.goto(APP+'/app/diary?focus='+DIARY+'&comments='+DIARY)
    expect(b.get_by_role('button',name='댓글 더 보기',exact=True)).to_be_visible()
    b.get_by_role('button',name='댓글 더 보기',exact=True).click()
    expect(b.get_by_text('Fixture comment 51',exact=True)).to_be_visible()
    b.get_by_role('textbox',name='댓글 내용').fill('50개 뒤에 작성한 새 댓글도 바로 보여야 해요.')
    b.get_by_role('button',name='남기기',exact=True).click()
    expect(b.get_by_text('50개 뒤에 작성한 새 댓글도 바로 보여야 해요.',exact=True)).to_be_visible()
    a.goto(APP+'/app/news')
    a.get_by_role('button').filter(has_text='50개 뒤에 작성한 새 댓글도').click()
    expect(a.get_by_text('50개 뒤에 작성한 새 댓글도 바로 보여야 해요.',exact=True)).to_be_visible()
    passed('Pagination and new/exact comments beyond the first 50 remain reachable')

    a.goto(APP+'/app/news')
    mark_seen=a.get_by_role('button',name='모두 확인했어요',exact=True)
    expect(mark_seen).to_be_enabled()
    mark_seen.click()
    expect(mark_seen).to_have_count(0)
    expect(a.locator('[aria-label="새 소식"]')).to_have_count(0)
    b.get_by_role('textbox',name='댓글 내용').fill('모두 확인한 다음에 도착한 새로운 마음이에요.')
    b.get_by_role('button',name='남기기',exact=True).click()
    expect(b.get_by_text('모두 확인한 다음에 도착한 새로운 마음이에요.',exact=True)).to_be_visible()
    a.get_by_role('button',name='새로 확인',exact=True).click()
    fresh=a.get_by_role('button').filter(has_text='모두 확인한 다음에 도착한 새로운 마음이에요.')
    expect(fresh).to_be_visible()
    expect(fresh.locator('[aria-label="새 소식"]')).to_have_count(1)
    expect(a.get_by_role('button',name='모두 확인했어요',exact=True)).to_be_enabled()
    passed('Mark all seen refreshes the list and preserves subsequently arriving news')

    a.goto(APP+'/app/people/'+A)
    expect(a.get_by_role('button',name='친구 신청',exact=True)).to_have_count(0)
    passed('Users cannot send themselves a friend request')

    for page,label in [(a,'A'),(b,'B')]:
        for width in [320,390,480,1440]:
            page.set_viewport_size({'width':width,'height':900})
            page.goto(APP+'/app/news')
            assert not page.evaluate('document.documentElement.scrollWidth>innerWidth'),(label,width)
        page.set_viewport_size({'width':390,'height':844})
    passed('Both users: 320/390/480/1440px news layouts fit the viewport')
    a.screenshot(path=str(TEST_OUTPUT/'community-app-news.png'),full_page=True)
    b.goto(APP+'/app/diary?focus='+DIARY+'&comments='+DIARY)
    expect(b.get_by_role('textbox',name='댓글 내용')).to_be_visible()
    expect(b.get_by_text('Fixture comment 1',exact=True)).to_be_visible()
    b.screenshot(path=str(TEST_OUTPUT/'community-app-conversation.png'),full_page=True)
    ca.close();cb.close();ba.close();bb.close()

result={'passed':len(checks),'checks':checks,'javascript_errors':errors,'failed_fixture_requests':failures,'blocked_external_requests':outside,'auxiliary_fixture_requests':auxiliary}
report=TEST_OUTPUT/'community-ui-results.json'
temporary=report.with_suffix('.json.tmp')
temporary.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
json.loads(temporary.read_text(encoding='utf-8'))
temporary.replace(report)
assert not errors,errors
assert not failures,failures
print(json.dumps(result,ensure_ascii=False,indent=2))
