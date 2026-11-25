import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('v45 회원 참가와 모임 소식, 커뮤니티 권한 분리',async()=>{const s=await read('supabase/v45-member-actions-community.sql'),p=await read('assets/v22-public-programs.js'),c=await read('assets/v45-community.js');assert.match(s,/revoke execute on function public\.nagachi_party_apply\(bigint,text\)/);assert.match(s,/a\.user_id=auth\.uid\(\)/);assert.match(s,/grant execute on function public\.nagachi_community_feed\(\) to anon,authenticated/);assert.match(s,/nagachi_companion_admins a where a\.user_id=auth\.uid\(\)/);assert.match(p,/nagachi_account_party_apply/);assert.match(p,/nagachi_account_meetup_subscribe/);assert.match(p,/nagachi_set_meetup_interest/);assert.match(c,/escapeHtml/);assert.match(c,/nagachi_community_post/);assert.match(c,/nagachi_admin_community_hide/)});

test('v46 게시판 목록·상세·글쓰기 분리 및 상태 표현',async()=>{
 const js=await read('assets/v45-community.js'),css=await read('assets/v45-community.css'),build=await read('scripts/build-core.js'),home=await read('assets/v12-direct-home.js'),actions=await read('assets/v22-public-programs.css');
 const row=js.slice(js.indexOf('function rowMarkup'),js.indexOf('function draw'));
 assert.match(row,/data-open/);assert.match(row,/e\(x.title\)/);assert.doesNotMatch(row,/x.body/);
 assert.match(js,/view==='detail'/);assert.match(js,/e\(x.body\)/);assert.match(js,/view==='compose'&&accountToken\(\)/);
 assert.match(js,/게시판에 연결하지 못했어요/);assert.match(js,/아직 등록된 게시글이 없어요/);assert.match(js,/data-retry/);
 assert.match(css,/\.n46-list li/);assert.match(css,/\.n46-write\{background:#ac492d/);
 assert.match(build,/v45-community\.js\?v=20261125-v46/);assert.match(build,/aria-current="page"/);
 assert.match(home,/<span>게시판<\/span>/);assert.match(actions,/data-n45-subscribe\]/);assert.match(actions,/data-n25-apply\]/);
});
