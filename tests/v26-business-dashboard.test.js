import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('v26 private aggregate RPC, KST periods and demo exclusion',async()=>{
 const s=await read('supabase/business-dashboard.sql');
 assert.match(s,/a\.user_id=auth\.uid\(\)/);
 assert.match(s,/p_days not in \(1,7,30\)/);
 assert.match(s,/Asia\/Seoul/);
 assert.match(s,/e\.event_name='premium_willingness' and e\.is_demo=false/);
 assert.match(s,/distinct on \(s\.session_id\)/);
 assert.match(s,/i\.expires_at>v_end/);
 assert.match(s,/revoke all on function public\.nagachi_admin_business_dashboard\(integer\) from public,anon,authenticated/);
 assert.match(s,/grant execute on function public\.nagachi_admin_business_dashboard\(integer\) to authenticated/);
 assert.doesNotMatch(s,/token_hash/);
});
test('v26 dashboard is admin-only, clears data on logout, no fake conversion or tracking',async()=>{
 const [s,admin,markup]=await Promise.all([read('assets/v26-business-dashboard.js'),read('assets/v22-operations-admin.js'),read('assets/v22-admin-markup.js')]);
 assert.match(s,/nagachi_admin_business_dashboard',\{p_days:days\},token/);
 assert.match(s,/getToken\(\)!==token/);
 assert.match(s,/panel\.replaceChildren\(\)/);
 assert.match(s,/관심→신청 전환율은 산출하지 않습니다/);
 assert.match(s,/전체 방문자 수와 코스 조회수도 수집하지 않습니다/);
 assert.match(s,/실제 결제율 아님/);
 assert.match(admin,/business\.reset\(\)/);
 assert.match(markup,/id="n26-business-results"/);
 assert.match(markup,/id="n26-days"/);
});
test('v26 calculation and escaped display',async()=>{
 // Module has browser imports; extract only the pure functions for Node test.
 const s=await read('assets/v26-business-dashboard.js');
 const source=s.replace(/^import .*?;\s*$/gm,'').replace(/^export /gm,'');
 const escapeHtml=x=>String(x).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
 const {percent,demandScenario,renderBusiness}=new Function('escapeHtml',source+'\nreturn {percent,demandScenario,renderBusiness};')(escapeHtml);
 assert.equal(percent(0,0),'—');
 assert.equal(percent(3,8),'37.5%');
 assert.equal(percent(9,8),'—');
 assert.equal(demandScenario(8,10000,25),20000);
 assert.equal(demandScenario(8,10000,101),null);
 assert.equal(demandScenario(0,10000,25),0);
 assert.equal(demandScenario(8,'',25),null);
 const html=renderBusiness({from:'2026-11-01',through:'2026-11-07',approved:3,application_records:8,meetups:[{title:'<script>danger</script>'}]});
 assert.match(html,/37\.5%/);
 assert.match(html,/&lt;script&gt;danger/);
 assert.doesNotMatch(html,/<script>/);
});
