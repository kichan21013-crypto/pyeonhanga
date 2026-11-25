/* Owner studio: front-end convenience only. ALL reads/writes are authorized by
 * Supabase Auth + public.nagachi_companion_admins in each SECURITY DEFINER RPC.
 * No private credentials, no stored passwords and no real transactions.
 */
import { companionRpc } from './v19-companion-service.js';
import { mountBusinessDashboard } from './v26-business-dashboard.js?v=20261125-v42';
import { escapeHtml } from '../ui.js';
import {mapLink,externalPlace,isExternalId} from './v43-external-places.js';
import { mountOwnerSummary } from './v42-owner-summary.js?v=20261125-v42';
import { estimateRevenue, cleanCoursePlaceIds, ADMIN_ACTIVITY_LABELS, MEETUP_STAGE_LABELS, draftCourseFromPlace } from './v22-operations-model.js?v=20261124-v39';

const $=(sel,root=document)=>root.querySelector(sel);
const $$=(sel,root=document)=>[...root.querySelectorAll(sel)];
const money=n=>Number(n||0).toLocaleString('ko-KR')+'원';
const selectedText=(row,key)=>escapeHtml(String(row[key]??''));
const activityLabel=a=>ADMIN_ACTIVITY_LABELS[a]||a;
function localDateTime(iso){
 if(!iso)return '';
 const date=new Date(iso);
 return Number.isNaN(date.getTime())?'':new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);
}
function toIso(value){
 if(!value)return null;
 const d=new Date(value);
 return Number.isNaN(d.getTime())?null:d.toISOString();
}
function safeDate(raw){
 if(!raw)return '일정 조율 중';
 const d=new Date(raw);
 return Number.isNaN(d.getTime())?'일정 조율 중':new Intl.DateTimeFormat('ko-KR',{dateStyle:'medium',timeStyle:'short'}).format(d);
}
function friendlyError(reason){
 return ({
  unconfigured:'Supabase 연결 설정이 필요합니다. 운영 연결 안내를 확인해 주세요.',
  'not-installed':'관리 기능이 서버에 아직 설치되지 않았습니다. 관리자 DB 설정 안내를 확인해 주세요.',
  forbidden:'관리자 권한이 만료되었거나 등록되지 않았습니다. 다시 로그인해 주세요.',
  offline:'연결에 실패했습니다. 네트워크를 확인하고 다시 시도해 주세요.'
 })[reason]||'서버에 저장하거나 조회하지 못했습니다. 데이터베이스 설정을 확인해 주세요.';
}
export function mountOperations({getToken,notify}){
 const root=$('#n19-admin-panel');
 // Markup is in n19-admin-panel, so unauthenticated users cannot operate anything.
 if(!root)return {load:async()=>{},reset:()=>{}};
 document.body.classList.add('n22-admin-page');
 const business=mountBusinessDashboard(root,getToken);
 const ownerSummary=mountOwnerSummary(root,getToken);
 const courseForm=$('#n22-course-form');
 const meetupForm=$('#n22-meetup-form');
 const revenueForm=$('#n22-revenue-form');
 const courseStatus=$('#n22-course-status');
 const meetupStatus=$('#n22-meetup-status');
 const revenueStatus=$('#n22-revenue-status');
 const search=$('#n22-place-query');
 const results=$('#n22-place-suggestions');
 const picked=$('#n22-course-picked');
 let data={courses:[],meetups:[],pricing:[]};
 let interestCounts=null;
 let partyId=null,partyRequest=0,partyBusy=false;
 let places=[],catalogPlaces=[],externalPlaces=[];
 let externalReady=false,externalBusy=false,externalRevision=0;
 let selectedPlaceIds=[];
 let requestId=0;
 let placesLoaded=false;
 const placeMap=()=>new Map(places.map(p=>[p.id,p]));
 const mergePlaces=()=>{places=[...catalogPlaces,...externalPlaces];};
 const info=(element,text,error=false)=>{
  element.textContent=text;element.dataset.error=error?'true':'false';
 };
 function tab(id){
  $$('[data-n22-tab]',root).forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.n22Tab===id)));
  $$('[data-n22-panel]',root).forEach(panel=>{panel.hidden=panel.dataset.n22Panel!==id;});
  const target=$('[data-n22-panel="'+id+'"]',root);
  target?.scrollIntoView({behavior:'auto',block:'start'});
 }
 function metric(label,value,tip){
  return '<div class="n22-metric"><span>'+escapeHtml(label)+'</span><strong>'+escapeHtml(String(value))+'</strong>'+
   '<small>'+escapeHtml(tip)+'</small></div>';
 }
 function renderMetrics(){
  $('#n22-operation-metrics').innerHTML=
   metric('등록한 코스',data.courses.length+'개','초안+공개')+
   metric('공개한 코스',data.courses.filter(x=>x.status==='published').length+'개','실제 앱에 노출')+
   metric('관리 중인 모임',data.meetups.filter(x=>x.stage!=='closed').length+'개','참가 확정 아님')+
   metric('수익 가정',data.pricing.length+'개','실제 매출 0건');
 }
 function listEmpty(text){return '<p class="n22-list-empty">'+escapeHtml(text)+'</p>';}
 function renderPicked(){
  const map=placeMap();
  picked.innerHTML=selectedPlaceIds.length?selectedPlaceIds.map((id,index)=>{
    const place=map.get(id);
    return '<div class="n22-place-chip"><span><b>'+(index+1)+'</b> '+
      escapeHtml(place?.name||id)+' <small>'+escapeHtml(place?.region||'')+(place?.external?' · 외부 지도':'')+'</small></span>'+
      '<div class="n42-place-actions"><button type="button" data-n42-move-place="'+index+'" data-step="-1" aria-label="위로 이동" '+(index===0?'disabled':'')+'>↑</button><button type="button" data-n42-move-place="'+index+'" data-step="1" aria-label="아래로 이동" '+(index===selectedPlaceIds.length-1?'disabled':'')+'>↓</button><button type="button" data-n22-remove-place="'+escapeHtml(id)+'" aria-label="'+escapeHtml(place?.name||id)+' 제외">×</button></div></div>';
  }).join(''):'<p class="n22-list-empty">아직 고른 장소가 없어요. 검색해서 추가해 주세요.</p>';
 }
 function renderSearch(){
  const query=search.value.trim().toLocaleLowerCase('ko');
  if(!placesLoaded){results.textContent='장소 정보를 연결하는 중입니다.';return;}
  if(!query){results.textContent='장소 이름을 입력하면 추천 목록이 나타납니다.';return;}
  const filtered=places.filter(p=>!selectedPlaceIds.includes(p.id)&&
    [p.name,p.region,p.category,p.address].some(x=>String(x||'').toLocaleLowerCase('ko').includes(query))
  ).slice(0,8);
  results.innerHTML=filtered.length?filtered.map(p=>
    '<button type="button" data-n22-add-place="'+escapeHtml(p.id)+'"><b>'+escapeHtml(p.name)+
    '</b><small>'+escapeHtml(p.region)+' · '+escapeHtml(p.category)+(p.external?' · 외부 지도':'')+'</small><span>추가 +</span></button>'
  ).join(''):listEmpty('찾는 장소가 없어요. 다른 이름이나 지역을 입력해 보세요.');
 }
 function renderCourses(){
  const map=placeMap();
  $('#n22-course-list').innerHTML=data.courses.length?data.courses.map(c=>
    '<article class="n22-list-item"><div><span class="n22-chip '+(c.status==='published'?'live':'')+'">'+
    (c.status==='published'?'앱에 공개':'비공개 초안')+'</span> <small>'+
    escapeHtml(activityLabel(c.activity))+' · '+escapeHtml(c.region)+'</small>'+
    '<h4>'+selectedText(c,'title')+'</h4><p>'+
    escapeHtml((Array.isArray(c.place_ids)?c.place_ids:[]).map(id=>map.get(id)?.name||id).join(' → '))+'</p>'+
    '</div><div class="n22-item-actions"><button type="button" data-n22-edit-course="'+Number(c.id)+'">수정</button>'+(c.status==='published'?'<button type="button" data-n39-course-meetup="'+Number(c.id)+'">모임 초안 만들기</button>':'')+'</div></article>'
  ).join(''):listEmpty('아직 만든 코스가 없어요. 첫 코스를 만들어 보세요.');
  const select=meetupForm.elements.course_id;
  const current=select.value;
  select.innerHTML='<option value="">코스 지정 없음</option>'+
   data.courses.filter(c=>c.activity===meetupForm.elements.activity.value).map(c=>
   '<option value="'+Number(c.id)+'">'+escapeHtml(c.title)+(c.status==='draft'?' (초안)':'')+'</option>').join('');
  select.value=[...select.options].some(o=>o.value===current)?current:'';
 }
 const partyStatus={pending:'승인 대기',approved:'승인',waitlisted:'대기자',cancelled:'취소'};
 async function showParty(id){
  const token=getToken(),panel=$('#n25-party-panel');
  if(!token||!panel)return;
  partyId=id;const seq=++partyRequest;
  panel.hidden=false;panel.textContent='신청 현황을 확인하고 있습니다.';
  const r=await companionRpc('nagachi_admin_party_list',{p_meetup_id:id},token);
  if(seq!==partyRequest||getToken()!==token)return;
  const m=data.meetups.find(x=>Number(x.id)===id);
  if(!m||!r.ok||!r.data||!Array.isArray(r.data.applications)){panel.textContent='신청 관리 연결을 확인해 주세요. '+friendlyError(r.reason);return;}
  const rows=r.data.applications.filter(x=>Number.isSafeInteger(Number(x.id))&&Object.hasOwn(partyStatus,x.status));
  const capacity=Number(r.data.capacity),approved=rows.filter(x=>x.status==='approved').length;
  const active=m.stage==='announced'&&m.meet_at&&new Date(m.meet_at).getTime()>Date.now()&&new Date(m.meet_at).getTime()<=Date.now()+90*86400000&&!!m.meet_place;
  const canDecide=['announced','closed'].includes(m.stage)&&m.meet_at&&new Date(m.meet_at).getTime()>Date.now();
  const toggle=r.data.open===true;
  panel.innerHTML='<h3>'+escapeHtml(m.title)+' · 참가 신청 관리</h3>'+
   '<p>신청 대기 '+rows.filter(x=>x.status==='pending').length+'건 · 승인 '+approved+'/'+capacity+' · 대기자 '+rows.filter(x=>x.status==='waitlisted').length+'건 · 취소 '+rows.filter(x=>x.status==='cancelled').length+'건</p>'+
   '<p>기기 단위 신청입니다. 실제 신원이나 참석 여부가 확인된 것은 아닙니다.</p>'+
   '<div class="n22-action-row"><button type="button" data-n25-toggle="'+(toggle?'close':'open')+'" '+(!toggle&&!active?'disabled':'')+'>'+(toggle?'신청 접수 마감':'무료 시범 모집 시작')+'</button><button type="button" data-n25-reload>새로고침</button></div>'+
   (!active&&!toggle?'<p>모집하려면 모임을 공개하고 90일 이내 미래 일정과 집결지를 입력하세요.</p>':'')+
   '<p role="status" data-n25-admin-message></p>'+
   (rows.length?rows.map(a=>'<article class="n22-list-item"><div><strong>신청 #'+Number(a.id)+' · '+escapeHtml(partyStatus[a.status])+'</strong><p>'+escapeHtml(safeDate(a.requested_at))+'</p></div>'+
    (a.status==='cancelled'?'':'<div class="n22-item-actions">'+
      (canDecide&&a.status!=='approved'&&approved<capacity?'<button type="button" data-n25-decision="approved" data-n25-id="'+Number(a.id)+'">승인</button>':'')+
      (canDecide&&a.status!=='waitlisted'?'<button type="button" data-n25-decision="waitlisted" data-n25-id="'+Number(a.id)+'">대기</button>':'')+
      '<button type="button" data-n25-decision="cancelled" data-n25-id="'+Number(a.id)+'">취소</button></div>')+'</article>').join(''):'<p>아직 신청한 기기가 없습니다.</p>');
 }
 function renderMeetups(){
  $('#n22-meetup-list').innerHTML=data.meetups.length?data.meetups.map(m=>{
   const course=data.courses.find(c=>Number(c.id)===Number(m.course_id));
   const count=interestCounts?.get(Number(m.id));
   const interestText=Number.isSafeInteger(count)?'관심 기기 '+count+'개 (참가 확정 아님)':'모임 관심 집계 연결 확인 필요';
   return '<article class="n22-list-item"><div><span class="n22-chip '+(m.stage==='announced'?'live':'')+'">'+
    escapeHtml(MEETUP_STAGE_LABELS[m.stage]||m.stage)+'</span> <small>'+
    escapeHtml(activityLabel(m.activity))+'</small><h4>'+selectedText(m,'title')+'</h4>'+
    '<p>'+escapeHtml(safeDate(m.meet_at))+' · 희망 '+Number(m.preferred_size)+'명'+
    (course?' · '+escapeHtml(course.title):'')+'</p><p><strong>'+escapeHtml(interestText)+'</strong></p></div>'+
    '<div class="n22-item-actions"><button type="button" data-n22-edit-meetup="'+Number(m.id)+'">수정</button>'+
    '<button type="button" data-n22-notice-meetup="'+Number(m.id)+'">해당 관심자 공지</button><button type="button" data-n25-manage="'+Number(m.id)+'">참가 신청 관리</button></div></article>';
  }).join(''):listEmpty('아직 준비 중인 동행 모임이 없어요.');
 }
 function renderPricing(){
  $('#n22-revenue-list').innerHTML=data.pricing.length?data.pricing.map(p=>{
   const calc=estimateRevenue(p);
   return '<article class="n22-list-item"><div><span class="n22-chip">비공개 수익 가정</span>'+
    '<h4>'+selectedText(p,'name')+'</h4><p>1인 서비스비 '+money(p.service_fee_krw)+
    ' · 월 '+Number(p.meetings_per_month)+'회 · 유료 전환 '+Number(p.paid_conversion_pct)+'%'+
    '</p><strong>월 예상 서비스비 매출 '+money(calc?.expectedRevenue||0)+'</strong></div>'+
    '<button type="button" data-n22-edit-revenue="'+Number(p.id)+'">수정</button></article>';
  }).join(''):listEmpty('아직 저장한 수익 가정이 없습니다.');
 }
 function renderRevenuePreview(){
  const f=revenueForm.elements;
  const calc=estimateRevenue({
   service_fee_krw:f.service_fee_krw.value,expected_people:f.expected_people.value,
   meetings_per_month:f.meetings_per_month.value,paid_conversion_pct:f.paid_conversion_pct.value,
   cost_per_meeting_krw:f.cost_per_meeting_krw.value
  });
  const target=$('#n22-revenue-preview');
  if(!calc){target.textContent='수치를 범위 내에서 입력하면 예상 결과가 표시됩니다.';return;}
  target.innerHTML='<span>월 기준 가정 · 실제 매출 아님</span>'+
   '<div class="n22-revenue-metrics"><div><small>예상 유료 참여(평균)</small><strong>'+
    calc.expectedPaying.toFixed(1)+'명</strong></div><div><small>서비스비 매출 가정</small><strong>'+
    money(calc.expectedRevenue)+'</strong></div><div><small>운영비 가정</small><strong>'+
    money(calc.estimatedCosts)+'</strong></div><div><small>운영비 차감 예상 잔여</small><strong>'+
    money(calc.estimateAfterCosts)+'</strong></div></div>';
 }
 async function load(){
  const jwt=getToken();
  if(!jwt)return;
  const request=++requestId;
  void business.load();void ownerSummary.load();
  const status=$('#n22-load-status');
  status.textContent='운영 자료를 불러오고 있어요.';
  const [result,interestResult,externalResult]=await Promise.all([
   companionRpc('nagachi_admin_operations',{},jwt),
   companionRpc('nagachi_admin_meetup_interest_counts',{},jwt),companionRpc('nagachi_admin_external_places',{},jwt)
  ]);
  if(request!==requestId||getToken()!==jwt)return;
  if(!result.ok){
   status.textContent=friendlyError(result.reason);
   status.dataset.error='true';
   return;
  }
  interestCounts=interestResult.ok&&Array.isArray(interestResult.data)?new Map(interestResult.data.filter(x=>Number.isSafeInteger(Number(x.meetup_id))&&Number.isSafeInteger(Number(x.interest_count))&&Number(x.interest_count)>=0).map(x=>[Number(x.meetup_id),Number(x.interest_count)])):null;
  externalReady=externalResult.ok&&Array.isArray(externalResult.data);
  if(externalReady)externalPlaces=externalResult.data.map(externalPlace).filter(Boolean);
  mergePlaces();$('#n43-add').disabled=!externalReady;
  $('#n43-status').textContent=externalReady?'':'외부 장소 서버 연결을 확인해 주세요.';
  const body=result.data||{};
  data={
   courses:Array.isArray(body.courses)?body.courses:[],
   meetups:Array.isArray(body.meetups)?body.meetups:[],
   pricing:Array.isArray(body.pricing)?body.pricing:[]
  };
  status.textContent='운영 자료를 불러왔습니다. 각 메뉴에서 새 코스나 모임을 만들 수 있습니다.';
  status.dataset.error='false';
  renderMetrics();renderCourses();renderMeetups();renderPricing();
  renderPicked();renderSearch();
  if(partyId!==null&&!partyBusy)await showParty(partyId);
  if(!placesLoaded){
   try{
    const response=await fetch('/data/places.json');
    if(!response.ok)throw new Error('places unavailable');
    const list=await response.json();
    if(request!==requestId||getToken()!==jwt)return;
    if(!Array.isArray(list))throw new Error('invalid places');
    catalogPlaces=list.filter(p=>typeof p.id==='string'&&typeof p.name==='string'&&!p.isDemo);mergePlaces();
    placesLoaded=true;
    renderPicked();renderSearch();renderCourses();
   }catch{
    results.textContent='장소 목록을 가져오지 못했습니다. 네트워크를 확인하고 새로고침해 주세요.';
   }
  }
 }
 function clearCourse(){
  courseForm.reset();courseForm.elements.id.value='';selectedPlaceIds=[];search.value='';externalRevision++;$('#n43-external').open=false;$('#n43-status').textContent=externalReady?'':'외부 장소 서버 연결을 확인해 주세요.';
  renderPicked();renderSearch();info(courseStatus,'새 코스를 작성할 수 있어요.');
 }
 function clearMeetup(){
  meetupForm.reset();meetupForm.elements.id.value='';
  renderCourses();info(meetupStatus,'새 동행 모임을 작성할 수 있어요.');
 }
 function clearRevenue(){
  revenueForm.reset();revenueForm.elements.id.value='';
  renderRevenuePreview();info(revenueStatus,'새 수익 가정을 작성할 수 있어요.');
 }
 function editCourse(id){
  const c=data.courses.find(x=>Number(x.id)===id);
  if(!c)return;
  tab('courses');clearCourse();
  const f=courseForm.elements;
  for(const key of ['id','title','activity','region','description','duration'])f[key].value=c[key];
  f.publish.checked=c.status==='published';
  selectedPlaceIds=cleanCoursePlaceIds(c.place_ids,new Set(Array.isArray(c.place_ids)?c.place_ids:[]));
  renderPicked();info(courseStatus,'수정할 내용을 확인한 뒤 저장해 주세요.');
  courseForm.scrollIntoView({block:'start'});
 }
 function editMeetup(id){
  const m=data.meetups.find(x=>Number(x.id)===id);
  if(!m)return;
  tab('meetups');clearMeetup();
  const f=meetupForm.elements;
  for(const key of ['id','title','activity','intro','meet_place','preferred_size','stage'])f[key].value=m[key]??'';
  f.meet_at.value=localDateTime(m.meet_at);
  renderCourses();
  f.course_id.value=m.course_id?String(m.course_id):'';
  info(meetupStatus,'이 모임의 진행 단계와 일정을 수정할 수 있어요.');
  meetupForm.scrollIntoView({block:'start'});
 }
 function editRevenue(id){
  const p=data.pricing.find(x=>Number(x.id)===id);
  if(!p)return;
  tab('revenue');clearRevenue();
  const f=revenueForm.elements;
  for(const key of ['id','name','service_fee_krw','expected_people','meetings_per_month',
                     'paid_conversion_pct','cost_per_meeting_krw','note'])f[key].value=p[key]??'';
  renderRevenuePreview();
  info(revenueStatus,'수치 수정 후 저장하면 가정이 갱신됩니다.');
  revenueForm.scrollIntoView({block:'start'});
 }
 function prepNotice(id){
  const m=data.meetups.find(x=>Number(x.id)===id);
  if(!m)return;
  tab('meetups');
  const drawer=$('#n22-notice-drawer');drawer.open=true;
  const form=$('#n19-admin-notice-form');
  form.reset();
  form.elements.notice_id.value='';
  form.elements.activity.value=m.activity;
  form.elements.title.value=m.title;
  form.elements.body.value=m.intro;
  form.elements.meet_at.value=localDateTime(m.meet_at);
  form.elements.meet_place.value=''; // exact assembly location is for approved applications, not broad activity subscribers
  form.elements.publish.checked=false; // never publish automatically
  drawer.scrollIntoView({block:'start'});
  form.elements.title.focus({preventScroll:true});
  notify('동행 모임 내용을 공지 초안에 옮겼습니다. 확인 후 저장해 주세요. 공개 여부는 직접 선택해야 합니다.');
 }
 function prepareDemandCourse(id){
  if(!getToken())return;
  const p=places.find(x=>x.id===id),draft=draftCourseFromPlace(p);
  if(!draft){notify('장소 목록 연결을 확인하고 다시 시도해 주세요.');return;}
  if((courseForm.elements.title.value||selectedPlaceIds.length)&&!confirm('작성 중인 코스 내용을 새 초안으로 바꿀까요? 저장한 코스는 변경하지 않습니다.'))return;
  tab('courses');clearCourse();const f=courseForm.elements;
  f.title.value=draft.title;f.activity.value=draft.activity;f.region.value=draft.region;f.publish.checked=false;
  f.description.value=p.name+'을(를) 중심으로 함께 시간을 보내는 동행 코스입니다. 세부 일정과 이용 조건은 운영자가 확인 후 안내합니다.';
  selectedPlaceIds=[draft.placeId];renderPicked();renderSearch();
  info(courseStatus,'관심 장소와 소개 초안을 넣었습니다. 운영시간·세부 일정 등을 확인하고 수정한 뒤 저장해 주세요.');
  courseForm.scrollIntoView({block:'start'});f.description.focus({preventScroll:true});
 }
 function prepareCourseMeetup(id){
  if(!getToken())return;
  const c=data.courses.find(x=>Number(x.id)===id&&x.status==='published');if(!c)return;
  if(meetupForm.elements.title.value&&!confirm('작성 중인 모임 내용을 새 초안으로 바꿀까요? 저장한 모임은 변경하지 않습니다.'))return;
  tab('meetups');clearMeetup();const f=meetupForm.elements;
  f.title.value=c.title;f.activity.value=c.activity;renderCourses();f.course_id.value=String(c.id);f.intro.value=c.description;f.stage.value='draft';
  info(meetupStatus,'코스와 소개를 불러왔습니다. 일정·집결지·정원을 확인하고 비공개 초안으로 저장하세요.');
  meetupForm.scrollIntoView({block:'start'});f.meet_at.focus({preventScroll:true});
 }
 root.addEventListener('click',async event=>{
  const demand=event.target.closest('[data-n39-demand-place]');if(demand){prepareDemandCourse(demand.dataset.n39DemandPlace);return;}
  const fromCourse=event.target.closest('[data-n39-course-meetup]');if(fromCourse){prepareCourseMeetup(Number(fromCourse.dataset.n39CourseMeetup));return;}
  const pending=event.target.closest('[data-n39-pending-meetup]');if(pending){if(!getToken()||partyBusy)return;const id=Number(pending.dataset.n39PendingMeetup);if(!data.meetups.some(m=>Number(m.id)===id)){notify('모임 목록을 새로고침해 주세요.');return;}tab('meetups');await showParty(id);if(getToken())$('#n25-party-panel')?.scrollIntoView({block:'start'});return;}
  const manage=event.target.closest('[data-n25-manage]');
  const toggle=event.target.closest('[data-n25-toggle]');
  const decide=event.target.closest('[data-n25-decision]');
  const reload=event.target.closest('[data-n25-reload]');
  if(manage||toggle||decide||reload){
   const token=getToken();if(!token||partyBusy)return;
   if(manage||reload){await showParty(manage?Number(manage.dataset.n25Manage):partyId);return;}
   if(!partyId)return;
   const id=partyId,action=toggle?toggle.dataset.n25Toggle:decide.dataset.n25Decision;
   if(!confirm(toggle?(action==='open'?'무료 시범 모임 모집을 시작할까요? 성인 신청자 안전 안내, 운영자 현장 진행 및 취소 방법을 확인했습니다.':'새로운 신청 접수를 마감할까요? 기존 승인·대기 신청은 유지됩니다.'):'이 신청을 '+partyStatus[action]+' 처리할까요?'))return;
   partyBusy=true;
   const panel=$('#n25-party-panel');panel.querySelectorAll('button').forEach(b=>b.disabled=true);
   const r=await companionRpc(toggle?'nagachi_admin_party_open':'nagachi_admin_party_decide',
    toggle?{p_meetup_id:id,p_open:action==='open'}:{p_meetup_id:id,p_application_id:Number(decide.dataset.n25Id),p_status:action},token);
   partyBusy=false;if(getToken()!==token)return;
   await showParty(id);void ownerSummary.load();void business.load();
   const msg=panel.querySelector('[data-n25-admin-message]');
   if(msg)msg.textContent=r.ok&&r.data===true?'서버에 반영했습니다.':'처리 여부를 확인하지 못했습니다. 모집 조건·정원·서버 상태를 확인해 주세요.';
   return;
  }
  if(event.target.closest('[data-n42-notice]')){tab('meetups');const drawer=$('#n22-notice-drawer');drawer.open=true;drawer.scrollIntoView({block:'start'});return;}
  const go=event.target.closest('[data-n22-tab],[data-n22-go]');
  if(go){tab(go.dataset.n22Tab||go.dataset.n22Go);return;}
  const mapSearch=event.target.closest('[data-n43-search]');if(mapSearch){const q=($('#n43-name').value||search.value||'').trim();const url=mapSearch.dataset.n43Search==='naver'?'https://map.naver.com/p/search/'+encodeURIComponent(q):'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(q);window.open(url,'_blank','noopener,noreferrer');return;}
  if(event.target.closest('#n43-add')){
   const token=getToken(),revision=externalRevision;if(!token||!externalReady||externalBusy)return;
   const status=$('#n43-status'),name=$('#n43-name').value.trim(),address=$('#n43-address').value.trim(),link=mapLink($('#n43-url').value.trim());
   if(name.length<2||address.length<2||!link||!$('#n43-verified').checked){status.textContent='장소명, 주소, 올바른 HTTPS 지도 링크 및 확인 체크가 필요합니다.';return;}
   if(selectedPlaceIds.length>=5){status.textContent='코스에는 최대 5곳까지 추가할 수 있습니다.';return;}
   const button=$('#n43-add');externalBusy=true;button.disabled=true;status.textContent='장소를 저장하고 있습니다.';
   const r=await companionRpc('nagachi_admin_save_external_place',{p_name:name,p_address:address,p_region:courseForm.elements.region.value,p_category:$('#n43-category').value,p_map_url:link.url},token);
   externalBusy=false;button.disabled=!externalReady;if(getToken()!==token||externalRevision!==revision)return;
   const place=r.ok?externalPlace(r.data):null;if(!place){status.textContent='등록 결과를 확인하지 못했습니다. 새로고침한 후 확인해 주세요.';return;}
   externalPlaces=[...externalPlaces.filter(p=>p.id!==place.id),place];mergePlaces();
   if(!selectedPlaceIds.includes(place.id)&&selectedPlaceIds.length<5)selectedPlaceIds.push(place.id);
   renderPicked();renderSearch();$('#n43-name').value='';$('#n43-address').value='';$('#n43-url').value='';$('#n43-verified').checked=false;status.textContent='장소 등록 완료. 코스 저장 시 함께 반영됩니다.';info(courseStatus,'외부 장소를 추가했습니다. 코스를 확인하고 저장해 주세요.');return;
  }
  const add=event.target.closest('[data-n22-add-place]');
  if(add){
   const id=add.dataset.n22AddPlace;
   if(selectedPlaceIds.includes(id))return;
   if(!places.some(p=>p.id===id))return;
   if(selectedPlaceIds.length>=5){info(courseStatus,'장소는 최대 5곳까지 선택할 수 있어요.',true);return;}
   selectedPlaceIds.push(id);renderPicked();search.value='';renderSearch();
   info(courseStatus,'장소를 추가했어요. 위에서부터 코스 순서가 됩니다.');return;
  }
  const move=event.target.closest('[data-n42-move-place]');
  if(move){const i=Number(move.dataset.n42MovePlace),j=i+Number(move.dataset.step);if(Number.isInteger(i)&&Number.isInteger(j)&&i>=0&&j>=0&&i<selectedPlaceIds.length&&j<selectedPlaceIds.length){[selectedPlaceIds[i],selectedPlaceIds[j]]=[selectedPlaceIds[j],selectedPlaceIds[i]];renderPicked();}return;}
  const remove=event.target.closest('[data-n22-remove-place]');
  if(remove){
   selectedPlaceIds=selectedPlaceIds.filter(id=>id!==remove.dataset.n22RemovePlace);
   renderPicked();renderSearch();return;
  }
  const editC=event.target.closest('[data-n22-edit-course]');
  if(editC){editCourse(Number(editC.dataset.n22EditCourse));return;}
  const editM=event.target.closest('[data-n22-edit-meetup]');
  if(editM){editMeetup(Number(editM.dataset.n22EditMeetup));return;}
  const editR=event.target.closest('[data-n22-edit-revenue]');
  if(editR){editRevenue(Number(editR.dataset.n22EditRevenue));return;}
  const notice=event.target.closest('[data-n22-notice-meetup]');
  if(notice){prepNotice(Number(notice.dataset.n22NoticeMeetup));return;}
  if(event.target.closest('[data-n22-clear-course]')){clearCourse();return;}
  if(event.target.closest('[data-n22-clear-meetup]')){clearMeetup();return;}
  if(event.target.closest('[data-n22-clear-revenue]')){clearRevenue();return;}
 });
 search.addEventListener('input',renderSearch);
 meetupForm.elements.activity.addEventListener('change',renderCourses);
 revenueForm.addEventListener('input',renderRevenuePreview);
 async function submit(form,status,name,args,successMessage){
  if(!getToken()){info(status,'관리자 로그인이 필요합니다.',true);return;}
  const button=$('[type=submit]',form);
  if(button.disabled)return;
  button.disabled=true;
  info(status,'서버에 안전하게 저장하고 있어요.');
  const token=getToken();
  const result=await companionRpc(name,args,token);
  button.disabled=false;
  if(getToken()!==token)return;
  if(!result.ok){
   info(status,friendlyError(result.reason)+' 작성한 내용은 아직 저장되지 않았습니다.',true);
   return;
  }
  const savedId=Number(result.data);
  if(!Number.isSafeInteger(savedId)||savedId<=0){info(status,'저장 결과 ID를 확인할 수 없습니다. 목록을 새로고침해 중복 저장을 피하세요.',true);return;}
  form.elements.id.value=String(savedId);
  info(status,successMessage+' 다시 저장하면 같은 항목을 수정합니다.');
  await load();
 }
 courseForm.addEventListener('submit',async event=>{
  event.preventDefault();
  if(!courseForm.reportValidity())return;
  if(!selectedPlaceIds.length){info(courseStatus,'먼저 코스에 포함할 실제 장소를 하나 이상 추가해 주세요.',true);return;}
  if(selectedPlaceIds.some(id=>isExternalId(id)&&(!externalReady||!placeMap().has(id)))){info(courseStatus,'외부 장소 정보를 다시 불러온 후 저장하세요.',true);return;}
  const f=courseForm.elements;
  if(f.publish.checked&&!confirm('이 코스를 일반 이용자의 앱에 공개할까요?'))return;
  const args={p_title:f.title.value.trim(),p_activity:f.activity.value,p_region:f.region.value,
   p_description:f.description.value.trim(),p_place_ids:selectedPlaceIds.slice(),
   p_duration:f.duration.value,p_publish:f.publish.checked,p_id:f.id.value?Number(f.id.value):null};
  await submit(courseForm,courseStatus,'nagachi_admin_save_course',args,
    f.publish.checked?'코스를 저장했습니다. 일반 앱의 코스 추천에 공개될 수 있습니다.':'비공개 코스 초안을 저장했습니다.');
 });
 meetupForm.addEventListener('submit',async event=>{
  event.preventDefault();
  if(!meetupForm.reportValidity())return;
  const f=meetupForm.elements;
  if(f.stage.value==='announced'&&!confirm('이 모임 준비 소식을 일반 앱에 공개할까요? 모집/참여 확정은 아직 아닙니다.'))return;
  const args={p_title:f.title.value.trim(),p_activity:f.activity.value,p_intro:f.intro.value.trim(),
   p_course_id:f.course_id.value?Number(f.course_id.value):null,
   p_meet_at:toIso(f.meet_at.value),p_meet_place:f.meet_place.value.trim()||null,
   p_preferred_size:Number(f.preferred_size.value),p_stage:f.stage.value,
   p_id:f.id.value?Number(f.id.value):null};
  await submit(meetupForm,meetupStatus,'nagachi_admin_save_meetup',args,
    f.stage.value==='announced'?'모임 준비 소식을 공개했습니다. 실제 모집/예약은 아닙니다.':'모임 운영 계획을 저장했습니다.');
 });
 revenueForm.addEventListener('submit',async event=>{
  event.preventDefault();
  if(!revenueForm.reportValidity())return;
  const f=revenueForm.elements;
  const args={p_name:f.name.value.trim(),p_service_fee_krw:Number(f.service_fee_krw.value),
   p_expected_people:Number(f.expected_people.value),p_meetings_per_month:Number(f.meetings_per_month.value),
   p_paid_conversion_pct:Number(f.paid_conversion_pct.value),
   p_cost_per_meeting_krw:Number(f.cost_per_meeting_krw.value),
   p_note:f.note.value.trim(),p_id:f.id.value?Number(f.id.value):null};
  if(!estimateRevenue(args)){info(revenueStatus,'비용과 인원 수치를 다시 확인해 주세요.',true);return;}
  await submit(revenueForm,revenueStatus,'nagachi_admin_save_pricing',args,
    '비공개 수익 가정을 저장했습니다. 실제 매출·결제 데이터는 아닙니다.');
 });
 renderPicked();renderRevenuePreview();
 return {load,reset:()=>{
   business.reset();ownerSummary.reset();externalRevision++;externalReady=false;externalPlaces=[];mergePlaces();requestId++;partyRequest++;partyId=null;partyBusy=false;const partyPanel=$('#n25-party-panel');if(partyPanel){partyPanel.hidden=true;partyPanel.replaceChildren();}data={courses:[],meetups:[],pricing:[]};interestCounts=null;
   $('#n22-operation-metrics').replaceChildren();
   $('#n22-course-list').replaceChildren();
   $('#n22-meetup-list').replaceChildren();
   $('#n22-revenue-list').replaceChildren();
   tab('overview');clearCourse();clearMeetup();clearRevenue();
 }};
}
