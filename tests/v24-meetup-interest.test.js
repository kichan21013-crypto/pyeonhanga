import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('v24 관심은 모임과 기기별 한 건, 공개 미래 모임에만 추가, 취소는 상태 무관',async()=>{
 const sql=await read('supabase/meetup-interest.sql');
 assert.match(sql,/primary key\(meetup_id,token_hash\)/);
 assert.match(sql,/m\.stage='announced' and \(m\.meet_at is null or m\.meet_at>now\(\)\) for update/);
 assert.match(sql,/on conflict\(meetup_id,token_hash\) do update/);
 assert.ok(sql.indexOf('if not p_interested then')<sql.indexOf("m.stage='announced'"));
 assert.match(sql,/i\.expires_at>now\(\)/);
});
test('v24 관리자 집계는 서버 허용목록, 해시 원문과 공개 집계 차단',async()=>{
 const sql=await read('supabase/meetup-interest.sql');
 assert.match(sql,/alter table public\.nagachi_meetup_interest enable row level security/);
 assert.match(sql,/revoke all on public\.nagachi_meetup_interest from public,anon,authenticated/);
 assert.match(sql,/pg_catalog\.sha256\(pg_catalog\.convert_to\(p_token,'UTF8'\)\)/);
 assert.match(sql,/a\.user_id=auth\.uid\(\)/);
 assert.match(sql,/grant execute on function public\.nagachi_admin_meetup_interest_counts\(\) to authenticated/);
 assert.doesNotMatch(sql,/grant execute on function public\.nagachi_admin_meetup_interest_counts\(\) to anon/);
});
test('v24 명시 동의 후 기기 토큰 저장 및 서버 성공에만 관심 완료 표시',async()=>{
 const js=await read('assets/v22-public-programs.js');
 assert.match(js,/if\(add&&!confirm\(/);
 assert.match(js,/globalThis\.crypto\.getRandomValues\(new Uint8Array\(32\)\)/);
 assert.match(js,/writeLocal\(interestKey,t\)&&storedToken\(\)===t/);
 assert.match(js,/if\(r\.ok&&r\.data===true\)/);
 assert.match(js,/nagachi_clear_meetup_interest/);
 assert.match(js,/nagachi_my_meetup_interest/);
 assert.doesNotMatch(js,/nagachi_admin_meetup_interest_counts/);
});
test('v24 관리자 모임별 집계 연결 실패를 0으로 표시하지 않음',async()=>{
 const admin=await read('assets/v22-operations-admin.js');
 assert.match(admin,/companionRpc\('nagachi_admin_meetup_interest_counts',\{\},jwt\)/);
 assert.match(admin,/Number\.isSafeInteger\(count\)/);
 assert.match(admin,/모임 관심 집계 연결 확인 필요/);
 const privacy=await read('dist/privacy.html');
 assert.match(privacy,/모임별 관심 등록·취소/);
 assert.match(privacy,/90일이 지나면 집계에서 제외/);
});
