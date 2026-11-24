/* Owner-only aggregate demand view; no tracking, no identity joins. */
import {companionRpc} from './v19-companion-service.js';
import {escapeHtml} from '../ui.js';
const number=n=>Number.isSafeInteger(Number(n))&&Number(n)>=0&&n!==null&&n!==''?Number(n):null;
const fmt=n=>number(n)===null?'—':number(n).toLocaleString('ko-KR');
export function percent(n,d){
 const a=number(n),b=number(d);
 return a===null||b===null||b===0||a>b?'—':(100*a/b).toFixed(1)+'%';
}
export function demandScenario(approved,fee,conversion){
 const n=number(approved),f=number(fee),c=number(conversion);
 if(n===null||f===null||c===null||f>100000||c>100)return null;
 return Math.round(n*f*c/100);
}
const rows=v=>Array.isArray(v)?v:[];
function table(headers,body){
 return '<div class="n26-scroll"><table class="n26-table"><thead><tr>'+headers.map(x=>'<th scope="col">'+escapeHtml(x)+'</th>').join('')+'</tr></thead><tbody>'+
 (body.length?body.map(r=>'<tr>'+r.map(x=>'<td>'+escapeHtml(String(x))+'</td>').join('')+'</tr>').join(''):'<tr><td colspan="'+headers.length+'">집계된 기록 없음</td></tr>')+'</tbody></table></div>';
}
function kpi(label,value,detail){
 return '<div class="n22-metric"><span>'+escapeHtml(label)+'</span><strong>'+escapeHtml(value)+'</strong><small>'+escapeHtml(detail)+'</small></div>';
}
export function renderBusiness(d,catalog=[]){
 const map=new Map(rows(catalog).filter(p=>p&&typeof p.id==='string'&&!p.isDemo).map(p=>[p.id,p.name]));
 const daily=rows(d.daily),max=Math.max(1,...daily.flatMap(x=>[number(x.survey_devices)||0,number(x.interest_records)||0,number(x.application_records)||0]));
 const chart=daily.map(x=>'<div class="n26-chart-day"><span>'+escapeHtml(String(x.day).slice(5))+'</span>'+
  ['survey_devices','interest_records','application_records'].map((key,i)=>'<div class="n26-bar-row"><span class="n26-bar n26-bar-'+i+'" style="width:'+100*(number(x[key])||0)/max+'%"></span><small>'+fmt(x[key])+'</small></div>').join('')+'</div>').join('');
 return '<p class="n26-period">'+escapeHtml(String(d.from))+' ~ '+escapeHtml(String(d.through))+' (한국시간 · 오늘 포함)</p>'+
 '<div class="n22-metrics">'+
 kpi('동의 설문 기기',fmt(d.survey_devices),'기간 내 중복 제거 · 전체 방문자 아님')+
 kpi('모임 관심 기록',fmt(d.interest_records),'모임×기기 · 현재 유효 기록')+
 kpi('참가 신청 기록',fmt(d.application_records),'기간 내 생성 · 현재 남아 있는 기록')+
 kpi('참가 승인',fmt(d.approved),'현재 승인 상태 · 실제 참석 아님')+
 kpi('신청 대비 승인율',percent(d.approved,d.application_records),'현재 남은 신청 기록 기준')+
 kpi('유료 지불의향',percent(d.paid_intent,d.valid_willingness),'기기별 최신 설문 · 실제 결제율 아님')+'</div>'+
 '<p class="n26-note">관심·신청·설문은 서로 다른 식별 체계입니다. 같은 고객을 연결할 수 없어 관심→신청 전환율은 산출하지 않습니다. 전체 방문자 수와 코스 조회수도 수집하지 않습니다. 취소로 삭제된 기록은 집계에서 빠지므로 과거 수치가 바뀔 수 있습니다.</p>'+
 '<h3>일별 수요 추이</h3><p class="n26-note">설문 기기 / 모임 관심 기록 / 참가 신청 기록 (각각 다른 단위)</p>'+
 '<div class="n26-legend"><span>● 설문</span><span>● 관심</span><span>● 신청</span></div><div class="n26-chart">'+chart+'</div>'+
 table(['일자','설문 기기','관심 기록','신청 기록'],daily.map(x=>[x.day,fmt(x.survey_devices),fmt(x.interest_records),fmt(x.application_records)]))+
 '<h3>모임별 수요 TOP 10</h3>'+table(['모임','관심','신청','승인','대기','승인율'],rows(d.meetups).map(x=>[x.title,fmt(x.interests),fmt(x.applications),fmt(x.approved),fmt(x.waitlisted),percent(x.approved,x.applications)]))+
 '<p class="n26-note">현재 신청 상태: 승인 대기 '+fmt(d.pending)+'건 / 대기자 '+fmt(d.waitlisted)+'건 / 운영자 취소 '+fmt(d.cancelled)+'건. 본인 삭제 건은 제외.</p>'+
 '<h3>연결 코스별 수요 TOP 10</h3>'+table(['코스','관심','신청'],rows(d.courses).map(x=>[x.title,fmt(x.interests),fmt(x.applications)]))+
 '<p class="n26-note">연결된 모임의 수요 합계이며 코스 자체 조회수나 순고객 수가 아닙니다.</p>'+
 '<h3>인기 지역 · 장소 TOP 10</h3>'+table(['지역','설문 기기'],rows(d.regions).map(x=>[x.name,fmt(x.n)]))+
 table(['장소','설문 기기'],rows(d.places).map(x=>[map.get(x.place_id)||x.place_id,fmt(x.n)]))+
 '<h3>서비스비 지불의향</h3>'+table(['응답','기기','비중'],rows(d.willingness).map(x=>[x.label,fmt(x.n),percent(x.n,d.valid_willingness)]))+
 '<p class="n26-note">전체 동의 설문 '+fmt(d.survey_responses)+'건, 유효 지불의향 최신 응답 '+fmt(d.valid_willingness)+'개 기기. 설문 의향은 실제 유료 전환율이 아니므로 자동으로 수익 가정에 대입하지 않습니다.</p>'+
 '<h3>승인 수요 기반 서비스비 가정</h3>'+
 '<div class="n26-controls" data-n26-scenario data-approved="'+(number(d.approved)??'')+'"><label>1인 서비스비(원)<input type="number" data-n26-fee min="0" max="100000" step="1000" value="10000"></label><label>가정 유료전환율(%)<input type="number" data-n26-conversion min="0" max="100" step="1" value="25"></label></div>'+
 '<p>기간 내 현재 승인 기록 기준 예상 서비스비 총액: <strong data-n26-estimate>'+fmt(demandScenario(d.approved,10000,25))+'원</strong></p>'+
 '<p class="n26-note">무료 시범 승인 기록을 기준으로 한 가상 서비스비입니다. 실제 매출·순이익·월 환산이 아니며 식비·교통비 등은 포함하지 않습니다.</p>'+
 '<button type="button" data-n22-go="revenue">수익 계획에서 비용 포함 가정별 비교하기 →</button>';
}
export function mountBusinessDashboard(root,getToken){
 const panel=root.querySelector('#n26-business-results'),select=root.querySelector('#n26-days');
 if(!panel||!select)return {load:async()=>{},reset:()=>{}};
 let request=0,catalog=null;
 async function load(){
  const token=getToken();if(!token)return;
  const id=++request,days=Number(select.value);
  panel.textContent='사업 지표를 불러오고 있습니다.';
  const result=await companionRpc('nagachi_admin_business_dashboard',{p_days:days},token);
  if(id!==request||getToken()!==token)return;
  if(!result.ok||!result.data||!Array.isArray(result.data.daily)){
   panel.textContent='사업 지표를 확인하지 못했습니다. v26 SQL 설치·관리자 권한·네트워크를 확인하고 다시 시도해 주세요.';return;
  }
  if(!catalog){
   try{const r=await fetch('/data/places.json');if(r.ok){const v=await r.json();if(Array.isArray(v))catalog=v;}}catch{}
  }
  if(id!==request||getToken()!==token)return;
  panel.innerHTML=renderBusiness(result.data,catalog||[]);
 }
 panel.addEventListener('input',event=>{
  if(!event.target.matches('[data-n26-fee],[data-n26-conversion]'))return;
  const form=panel.querySelector('[data-n26-scenario]'),out=panel.querySelector('[data-n26-estimate]');
  if(!form||!out)return;
  const value=demandScenario(form.dataset.approved,form.querySelector('[data-n26-fee]').value,form.querySelector('[data-n26-conversion]').value);
  out.textContent=value===null?'입력 범위 확인':fmt(value)+'원';
 });
 select.addEventListener('change',load);
 root.querySelector('#n26-refresh')?.addEventListener('click',load);
 return {load,reset:()=>{request++;panel.replaceChildren();select.value='7';}};
}
