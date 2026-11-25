import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('v45 회원 참가와 모임 소식, 커뮤니티 권한 분리',async()=>{const s=await read('supabase/v45-member-actions-community.sql'),p=await read('assets/v22-public-programs.js'),c=await read('assets/v45-community.js');assert.match(s,/revoke execute on function public\.nagachi_party_apply\(bigint,text\)/);assert.match(s,/a\.user_id=auth\.uid\(\)/);assert.match(s,/grant execute on function public\.nagachi_community_feed\(\) to anon,authenticated/);assert.match(s,/nagachi_companion_admins a where a\.user_id=auth\.uid\(\)/);assert.match(p,/nagachi_account_party_apply/);assert.match(p,/nagachi_account_meetup_subscribe/);assert.match(p,/nagachi_set_meetup_interest/);assert.match(c,/escapeHtml/);assert.match(c,/nagachi_community_post/);assert.match(c,/nagachi_admin_community_hide/)});

test('v46 게시판 목록·상세·글쓰기 분리 및 상태 표현',async()=>{
 const js=await read('assets/v45-community.js'),css=await read('assets/v45-community.css'),build=await read('scripts/build-core.js'),home=await read('assets/v12-direct-home.js'),actions=await read('assets/v22-public-programs.css');
 const row=js.slice(js.indexOf('function rowMarkup'),js.indexOf('function draw()',js.indexOf('function rowMarkup')));
 assert.match(row,/data-open/);assert.match(row,/e\(x.title\)/);assert.doesNotMatch(row,/x.body/);
 assert.match(js,/view==='detail'/);assert.match(js,/e\(x.body\)/);assert.match(js,/view==='compose'&&accountToken\(\)/);
 assert.match(js,/게시판에 연결하지 못했어요/);assert.match(js,/아직 등록된 게시글이 없어요/);assert.match(js,/data-retry/);
 assert.match(css,/\.n46-list li/);assert.match(css,/\.n46-write\{background:#ac492d/);
 assert.match(build,/v45-community\.js\?v=20261125-v47/);assert.match(build,/aria-current="page"/);
 assert.match(home,/<span>게시판<\/span>/);assert.match(actions,/data-n45-subscribe\]/);assert.match(actions,/data-n25-apply\]/);
});

test('v47 댓글 공감 사진의 보안 및 무료 한도 계약',async()=>{
 const js=await read('assets/v45-community.js'),sql=await read('supabase/v47-community-engagement.sql'),photo=await read('supabase/v47-community-photo.sql');
 assert.match(sql,/primary key\(post_id,user_id\)/);assert.match(sql,/enable row level security/);assert.match(sql,/not p.hidden and not c.hidden/);assert.match(sql,/c.user_id=auth.uid\(\)/);
 assert.match(js,/nagachi_community_set_like/);assert.match(js,/nagachi_community_comment_add/);assert.match(js,/e\(c.body\)/);
 assert.match(photo,/octet_length\(jpeg\) between 4 and 120000/);assert.match(photo,/count\(\*\) from nagachi_photo.images\)>=300/);assert.match(photo,/on delete cascade/);assert.match(photo,/security invoker/);
 assert.match(js,/canvas.toDataURL\('image\/jpeg'/);assert.match(js,/nagachi_community_post_photo/);assert.match(js,/nagachi_community_photo/);
});

test('v47 community module is valid JavaScript',async()=>{const {execFileSync}=await import('node:child_process');const {fileURLToPath}=await import('node:url');execFileSync(process.execPath,['--check',fileURLToPath(new URL('../assets/v45-community.js',import.meta.url))]);});
