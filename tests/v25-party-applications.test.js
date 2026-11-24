import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('v25 모집은 운영자 명시 설정 후에만, 기기별 중복 차단',async()=>{
 const sql=await read('supabase/party-applications.sql');
 assert.match(sql,/recruitment_open boolean not null default false/);
 assert.match(sql,/unique\(meetup_id,token_hash\)/);
 assert.match(sql,/on conflict\(meetup_id,token_hash\) do nothing/);
 assert.match(sql,/m\.recruitment_open and m\.stage='announced'/);
 assert.match(sql,/m\.meet_at<=now\(\)\+interval '90 days'/);
});
test('v25 정원 초과 승인 및 기존 신청 이후 일정 변경 금지',async()=>{
 const sql=await read('supabase/party-applications.sql');
 assert.match(sql,/for update/g);
 assert.match(sql,/a\.status='approved' and a\.id<>p_application_id\)>=m\.preferred_size/);
 assert.match(sql,/Capacity below approvals/);
 assert.match(sql,/Cancel active applications before changing meetup details/);
 assert.match(sql,/before update on public\.nagachi_operated_meetups/);
});
test('v25 관리자 권한 보호 및 승인된 본인 기기만 집결지 조회',async()=>{
 const sql=await read('supabase/party-applications.sql');
 assert.match(sql,/alter table public\.nagachi_party_applications enable row level security/);
 assert.match(sql,/revoke all on public\.nagachi_party_applications from public,anon,authenticated/);
 assert.equal((sql.match(/x\.user_id=auth\.uid\(\)/g)||[]).length,3);
 assert.match(sql,/case when a\.status='approved' and m\.stage in \('announced','closed'\) and m\.meet_at>now\(\)/);
 assert.match(sql,/a\.token_hash=pg_catalog\.encode\(pg_catalog\.sha256/);
 assert.match(sql,/delete from public\.nagachi_party_applications a where a\.meetup_id=p_meetup_id/);
 assert.match(sql,/grant execute on function public\.nagachi_admin_party_open\(bigint,boolean\),public\.nagachi_admin_party_list\(bigint\),public\.nagachi_admin_party_decide\(bigint,bigint,text\) to authenticated/);
});
test('v25 신청 동의, 내 상태, 운영실 관리 및 데이터 안내',async()=>{
 const [pub,admin,markup,privacy]=await Promise.all([read('assets/v22-public-programs.js'),read('assets/v22-operations-admin.js'),read('assets/v22-admin-markup.js'),read('dist/privacy.html')]);
 assert.match(pub,/if\(apply&&!confirm\(/);
 assert.match(pub,/만 19세 이상/);
 assert.match(pub,/nagachi_my_party_applications/);
 assert.match(pub,/nagachi_party_withdraw/);
 assert.match(pub,/result\.ok&&result\.data===true/);
 assert.match(admin,/nagachi_admin_party_decide/);
 assert.match(admin,/form\.elements\.meet_place\.value='';/);
 assert.match(markup,/id="n25-party-panel"/);
 assert.match(privacy,/무료 시범 동행 참가 신청/);
});
