/* Owner studio: front-end convenience only. ALL reads/writes are authorized by
 * Supabase Auth + public.nagachi_companion_admins in each SECURITY DEFINER RPC.
 * No private service_role keys, no stored passwords and no real transactions.
 */
import { companionRpc } from './v19-companion-service.js';
import { escapeHtml } from '../ui.js';
import { estimateRevenue, cleanCoursePlaceIds, ADMIN_ACTIVITY_LABELS, MEETUP_STAGE_LABELS } from './v22-operations-model.js';

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
 let places=[];
 let selectedPlaceIds=[];
 let requestId=0;
 let placesLoaded=false;
 const placeMap=()=>new Map(places.map(p=>[p.id,p]));
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
      escapeHtml(place?.name||id)+' <small>'+escapeHtml(place?.region||'')+'</small></span>'+
      '<button type="button" data-n22-remove-place="'+escapeHtml(id)+'" aria-label="'+escapeHtml(place?.name||id)+' 제외">×</button></div>';
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
    '</b><small>'+escapeHtml(p.region)+' · '+escapeHtml(p.category)+'</small><span>추가 +</span></button>'
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
    '</div><button type="button" data-n22-edit-course="'+Number(c.id)+'">수정</button></article>'
  ).join(''):listEmpty('아직 만든 코스가 없어요. 첫 코스를 만들어 보세요.');
  const select=meetupForm.elements.course_id;
  const current=select.value;
  select.innerHTML='<option value="">코스 지정 없음</option>'+
   data.courses.filter(c=>c.activity===meetupForm.elements.activity.value).map(c=>
   '<option value="'+Number(c.id)+'">'+escapeHtml(c.title)+(c.status==='draft'?' (초안)':'')+'</option>').join('');
  select.value=[...select.options].some(o=>o.value===current)?current:'';
 }
 function renderMeetups(){
  $('#n22-meetup-list').innerHTML=data.meetups.length?data.meetups.map(m=>{
   const course=data.courses.find(c=>Number(c.id)===Number(m.course_id));
   return '<article class="n22-list-item"><div><span class="n22-chip '+(m.stage==='announced'?'live':'')+'">'+
    escapeHtml(MEETUP_STAGE_LABELS[m.stage]||m.stage)+'</span> <small>'+
    escapeHtml(activityLabel(m.activity))+'</small><h4>'+selectedText(m,'title')+'</h4>'+
    '<p>'+escapeHtml(safeDate(m.meet_at))+' · 희망 '+Number(m.preferred_size)+'명'+
    (course?' · '+escapeHtml(course.title):'')+'</p></div>'+
    '<div class="n22-item-actions"><button type="button" data-n22-edit-meetup="'+Number(m.id)+'">수정</button>'+
    '<button type="button" data-n22-notice-meetup="'+Number(m.id)+'">해당 관심자 공지</button></div></article>';
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
  const status=$('#n22-load-status');
  status.textContent='운영 자료를 불러오고 있어요.';
  const result=await companionRpc('nagachi_admin_operations',{},jwt);
  if(request!==requestId||!getToken())return;
  if(!result.ok){
   status.textContent=friendlyError(result.reason);
   status.dataset.error='true';
   return;
  }
  const body=result.data||{};
  data={
   courses:Array.isArray(body.courses)?body.courses:[],
   meetups:Array.isArray(body.meetups)?body.meetups:[],
   pricing:Array.isArray(body.pricing)?body.pricing:[]
  };
  status.textContent='운영 자료를 불러왔습니다. 각 메뉴에서 새 코스나 모임을 만들 수 있습니다.';
  status.dataset.error='false';
  renderMetrics();renderCourses();renderMeetups();renderPricing();
  if(!placesLoaded){
   try{
    const response=await fetch('/data/places.json');
    if(!response.ok)throw new Error('places unavailable');
    const list=await response.json();
    if(!Array.isArray(list))throw new Error('invalid places');
    places=list.filter(p=>typeof p.id==='string'&&typeof p.name==='string'&&!p.isDemo);
    placesLoaded=true;
    renderPicked();renderSearch();renderCourses();
   }catch{
    results.textContent='장소 목록을 가져오지 못했습니다. 네트워크를 확인하고 새로고침해 주세요.';
   }
  }
 }
 function clearCourse(){
  courseForm.reset();courseForm.elements.id.value='';selectedPlaceIds=[];search.value='';
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
  selectedPlaceIds=cleanCoursePlaceIds(c.place_ids,new Set(places.map(p=>p.id)));
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
  form.elements.meet_place.value=m.meet_place||'';
  form.elements.publish.checked=false; // never publish automatically
  drawer.scrollIntoView({block:'start'});
  form.elements.title.focus({preventScroll:true});
  notify('동행 모임 내용을 공지 초안에 옮겼습니다. 확인 후 저장해 주세요. 공개 여부는 직접 선택해야 합니다.');
 }
 root.addEventListener('click',event=>{
  const go=event.target.closest('[data-n22-tab],[data-n22-go]');
  if(go){tab(go.dataset.n22Tab||go.dataset.n22Go);return;}
  const add=event.target.closest('[data-n22-add-place]');
  if(add){
   const id=add.dataset.n22AddPlace;
   if(selectedPlaceIds.includes(id))return;
   if(!places.some(p=>p.id===id))return;
   if(selectedPlaceIds.length>=5){info(courseStatus,'장소는 최대 5곳까지 선택할 수 있어요.',true);return;}
   selectedPlaceIds.push(id);renderPicked();search.value='';renderSearch();
   info(courseStatus,'장소를 추가했어요. 위에서부터 코스 순서가 됩니다.');return;
  }
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
  const result=await companionRpc(name,args,getToken());
  button.disabled=false;
  if(!result.ok){
   info(status,friendlyError(result.reason)+' 작성한 내용은 아직 저장되지 않았습니다.',true);
   return;
  }
  info(status,successMessage);
  await load();
 }
 courseForm.addEventListener('submit',async event=>{
  event.preventDefault();
  if(!courseForm.reportValidity())return;
  if(!selectedPlaceIds.length){info(courseStatus,'먼저 코스에 포함할 실제 장소를 하나 이상 추가해 주세요.',true);return;}
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
   requestId++;data={courses:[],meetups:[],pricing:[]};
   $('#n22-operation-metrics').replaceChildren();
   $('#n22-course-list').replaceChildren();
   $('#n22-meetup-list').replaceChildren();
   $('#n22-revenue-list').replaceChildren();
   tab('overview');clearCourse();clearMeetup();clearRevenue();
 }};
}
