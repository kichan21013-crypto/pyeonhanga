/* 운영자가 실제로 게시한 코스/모임 준비 소식만 일반 홈에서 보여줍니다.
 * 운영 초안, 예상 수익, 정확한 만남 장소, 실제 참가 정보는 공개하지 않습니다.
 */
import { companionRpc } from './v19-companion-service.js';
import { readLocal, writeLocal } from '../storage.js';
import { escapeHtml, safeUrl, placeUrl } from '../ui.js';
import { ADMIN_ACTIVITY_LABELS, sanitizePublicCourses } from './v22-operations-model.js?v=20261125-v44';
import {externalPlace} from './v43-external-places.js?v=20261125-v44';
import {rememberActivities} from './v40-account-auth.js?v=20261124-v41';
const $=(s,root=document)=>root.querySelector(s);
const activityToInvite={food:'eat',hike:'hike',outing:'outing',travel:'travel'};
function dateText(value){
 if(!value)return '일정 조율 중';
 const d=new Date(value);
 return Number.isNaN(d.getTime())?'일정 조율 중':
   new Intl.DateTimeFormat('ko-KR',{dateStyle:'medium',timeStyle:'short'}).format(d);
}
export function courseCard(course){
 const photo=safeUrl(course.places[0]?.image)||'/assets/garden.svg';
 const first=course.places[0];
 const title=escapeHtml(course.title);
 const stops=course.places.map(p=>p.name).join(' → ');
 const photoMarkup=first.external?'<div class="n43-map-cover"><span aria-hidden="true">⌖</span><strong>'+escapeHtml(first.name)+'</strong><small>운영자 등록 · 지도에서 장소 확인</small></div>':'<a href="'+placeUrl(first)+'" class="n22-public-photo" aria-label="'+escapeHtml(first.name)+' 장소 정보"><img src="'+photo+'" alt="'+escapeHtml(first.name)+' 장소 사진" loading="lazy"></a>';
 const links=course.places.filter(p=>p.external).map(p=>'<a class="n43-map-link" href="'+safeUrl(p.map_url)+'" target="_blank" rel="noopener noreferrer"><strong>'+escapeHtml(p.name)+'</strong><small>'+escapeHtml(p.address)+'</small><span>'+escapeHtml(p.provider)+'에서 확인 ↗</span></a>').join('');
 return '<article class="n22-public-card">'+
  photoMarkup+
  '<div class="n22-public-card-copy"><span class="n22-public-tag">나가치 제안 · '+
    escapeHtml(ADMIN_ACTIVITY_LABELS[course.activity]||'동행')+'</span>'+
  '<h3>'+title+'</h3><p class="n22-public-desc">'+escapeHtml(course.description)+'</p>'+
  '<p class="n22-public-route">'+escapeHtml(stops)+'</p>'+links+(course.places.some(p=>p.source==='geoapify')?'<small class="n44-attribution">Powered by <a href="https://www.geoapify.com/" target="_blank" rel="noopener">Geoapify</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap contributors</a></small>':'')+
  '<div class="n22-public-bottom"><span>'+escapeHtml(course.region||'')+' · '+
    escapeHtml(course.duration||'하루')+'</span>'+
  (first.external?'<button type="button" data-n43-course-news="'+escapeHtml(course.activity)+'">이 활동 일정 소식 받기 →</button>':'<button type="button" data-companion-interest="'+escapeHtml(first.id)+'" data-companion-activity="'+escapeHtml(course.activity)+'">이 코스 함께 가고 싶어요 →</button>')+'</div></div></article>';
}
const interestKey='nagachi.meetup-interest-token';
const validToken=t=>typeof t==='string'&&/^[0-9a-f]{64}$/.test(t);
function storedToken(){const t=readLocal(interestKey,'');return validToken(t)?t:'';}
function ensureToken(){
 const existing=storedToken();if(existing)return existing;
 if(!globalThis.crypto?.getRandomValues)return '';
 const t=[...globalThis.crypto.getRandomValues(new Uint8Array(32))].map(b=>b.toString(16).padStart(2,'0')).join('');
 return writeLocal(interestKey,t)&&storedToken()===t?t:'';
}
const partyKey='nagachi.party-token';
function partyToken(create=false){
 const t=readLocal(partyKey,'');if(validToken(t))return t;
 if(!create||!globalThis.crypto?.getRandomValues)return '';
 const fresh=[...globalThis.crypto.getRandomValues(new Uint8Array(32))].map(b=>b.toString(16).padStart(2,'0')).join('');
 return writeLocal(partyKey,fresh)&&readLocal(partyKey,'')===fresh?fresh:'';
}
const partyLabels={pending:'승인 대기',approved:'참가 승인',waitlisted:'대기자',cancelled:'운영자 취소'};
function meetupCard(meetup){
 return '<article class="n22-meetup-preview">'+
   '<span class="n22-meetup-kicker">모임 준비 소식 · '+escapeHtml(ADMIN_ACTIVITY_LABELS[meetup.activity]||'동행')+'</span>'+
   '<h3>'+escapeHtml(meetup.title)+'</h3><p>'+escapeHtml(meetup.intro)+'</p>'+
   '<div class="n22-meetup-bottom"><small>예정: '+escapeHtml(dateText(meetup.meet_at))+
    ' · 실제 참가 확정 아님</small>'+
   '<button type="button" data-n22-open-activity="'+escapeHtml(activityToInvite[meetup.activity]||'outing')+
   '">관련 장소 살펴보기 →</button></div>'+
   '<div class="n24-interest"><button type="button" data-n24-interest="'+Number(meetup.id)+'" aria-pressed="false" disabled>관심 확인 중</button>'+
   '<p role="status" data-n24-message></p></div><div class="n24-interest" data-n25-slot="'+Number(meetup.id)+'" hidden></div></article>';
}
export function setupPublicPrograms({home,loadPlaces}){
 const section=$('#n22-public-programs',home);
 if(!section)return;
 const list=$('#n22-public-course-list',home);
 const meetups=$('#n22-public-meetups',home);
 let mine=new Set(),openIds=new Set(),ready=false,busy=false;
 let partyOpen=new Set(),partyRows=[],partyReady=false,partyBusy=false;
 async function refreshParty(){
  const token=partyToken();
  const [open,own]=await Promise.all([companionRpc('nagachi_public_party_open'),token?companionRpc('nagachi_my_party_applications',{p_token:token}):Promise.resolve({ok:true,data:[]})]);
  partyReady=open.ok&&Array.isArray(open.data)&&own.ok&&Array.isArray(own.data);
  partyOpen=open.ok&&Array.isArray(open.data)?new Set(open.data.map(x=>Number(x.meetup_id))):new Set();
  if(own.ok&&Array.isArray(own.data))partyRows=own.data.filter(x=>Number.isSafeInteger(Number(x.meetup_id))&&Object.hasOwn(partyLabels,x.status));
  else partyRows=[];
  renderParty();
 }
 function renderParty(){
  for(const slot of meetups.querySelectorAll('[data-n25-slot]')){
   const id=Number(slot.dataset.n25Slot),own=partyRows.find(x=>Number(x.meetup_id)===id);
   slot.hidden=!partyReady||(!partyOpen.has(id)&&!own);
   slot.innerHTML=own?'<strong>'+escapeHtml(partyLabels[own.status])+'</strong>':
    '<button type="button" data-n25-apply="'+id+'" '+(partyBusy?'disabled':'')+'>무료 동행 참가 신청</button>';
  }
  const panel=meetups.querySelector('[data-n25-own]');
  if(!panel)return;
  panel.hidden=!partyToken()&&!partyOpen.size;
  panel.innerHTML='<h3>내 동행 신청</h3>'+
   (!partyReady?'<p>신청 상태를 확인하지 못했습니다. 새로고침 후 다시 확인해 주세요.</p>':
    partyRows.length?partyRows.map(x=>'<article class="n22-meetup-preview"><strong>'+escapeHtml(x.title)+'</strong><p>'+escapeHtml(dateText(x.meet_at))+' · '+escapeHtml(partyLabels[x.status])+'</p>'+
     (x.status==='approved'&&x.meet_place?'<p>집결지: '+escapeHtml(x.meet_place)+'</p>':'')+
     '<button type="button" data-n25-withdraw="'+Number(x.meetup_id)+'" '+(partyBusy?'disabled':'')+'>신청 취소·기록 삭제</button></article>').join(''):'<p>등록한 참가 신청이 없습니다.</p>');
 }

 function renderInterest(){
  for(const b of meetups.querySelectorAll('[data-n24-interest]')){
   const id=Number(b.dataset.n24Interest),active=mine.has(id),open=openIds.has(id);
   b.disabled=busy||!ready||(!active&&!open);
   b.setAttribute('aria-pressed',String(active));
   b.textContent=!ready?'관심 확인 불가':active?'관심 등록됨 · 취소하기':!open?'관심 접수 종료':'이 모임 함께 가고 싶어요';
  }
  const clear=meetups.querySelector('[data-n24-clear]');if(clear)clear.disabled=busy;
 }
 async function loadMine(){
  const token=storedToken();
  if(!token){mine=new Set();ready=true;return;}
  const r=await companionRpc('nagachi_my_meetup_interest',{p_token:token});
  ready=r.ok&&Array.isArray(r.data);
  if(ready)mine=new Set(r.data.map(x=>Number(x.meetup_id)).filter(x=>Number.isSafeInteger(x)&&x>0));
 }
 async function load(){
  const [courseRes,meetRes,externalRes]=await Promise.all([
   companionRpc('nagachi_public_courses'),companionRpc('nagachi_public_meetups'),companionRpc('nagachi_public_external_places_v44')
  ]);
  const courses=courseRes.ok&&Array.isArray(courseRes.data)?courseRes.data:[];
  const events=meetRes.ok&&Array.isArray(meetRes.data)?meetRes.data:[];
  let shownCourses=[];
  if(courses.length){
   let catalog=[];try{catalog=await loadPlaces();}catch{}
   const external=externalRes.ok&&Array.isArray(externalRes.data)?externalRes.data.map(externalPlace).filter(Boolean):[];
   shownCourses=sanitizePublicCourses(courses,[...(Array.isArray(catalog)?catalog:[]),...external]);
  }
  const shownEvents=events.filter(m=>m&&Number.isSafeInteger(Number(m.id))&&
     ['food','hike','outing','travel'].includes(m.activity)&&
     m.stage==='announced'&&typeof m.title==='string'&&typeof m.intro==='string');
  openIds=new Set(shownEvents.filter(m=>!m.meet_at||new Date(m.meet_at).getTime()>Date.now()).map(m=>Number(m.id)));
  if(!shownCourses.length&&!shownEvents.length&&!storedToken()&&!partyToken()){
   section.hidden=true;return;
  }
  list.innerHTML=shownCourses.length?shownCourses.map(courseCard).join(''):'';
  meetups.innerHTML=shownEvents.length?
   '<div class="n22-meetup-header"><h3>운영자가 준비 중인 동행</h3>'+
   '<p>관심을 모으고 운영자가 모집을 시작한 무료 시범 모임에 신청할 수 있어요. 결제는 제공하지 않아요.</p></div>'+
   '<div class="n22-meetup-grid">'+shownEvents.slice(0,6).map(meetupCard).join('')+'</div>':'';
  if(shownEvents.length||storedToken())meetups.insertAdjacentHTML('beforeend','<div class="n24-interest-privacy"><small>관심은 기기 단위로 저장되며 참가 예약이 아닙니다. <a href="/privacy.html">데이터 안내</a></small> <button type="button" data-n24-clear>이 기기의 모든 모임 관심 취소</button><p role="status" data-n24-clear-message></p></div>');
  meetups.insertAdjacentHTML('beforeend','<div class="n24-interest" data-n25-own hidden></div><p role="status" data-n25-message></p>');
  section.hidden=false;
  await Promise.all([loadMine(),refreshParty()]);renderInterest();
 }
 home.addEventListener('click',async e=>{
  const news=e.target.closest('[data-n43-course-news]');if(news){rememberActivities([news.dataset.n43CourseNews]);location.href='/account.html';return;}
  const apply=e.target.closest('[data-n25-apply]'),withdraw=e.target.closest('[data-n25-withdraw]');
  if(apply||withdraw){
   if(partyBusy||!partyReady||!meetups.contains(apply||withdraw))return;
   const id=Number(apply?apply.dataset.n25Apply:withdraw.dataset.n25Withdraw);
   if(apply&&(!partyOpen.has(id)||partyRows.some(x=>Number(x.meetup_id)===id)))return;
   if(withdraw&&!partyRows.some(x=>Number(x.meetup_id)===id))return;
   if(apply&&!confirm('만 19세 이상이며 무료 시범 동행에 참가 신청하시겠습니까? 모임 ID, 무작위 기기 비밀값의 해시, 신청·변경 시각과 상태를 저장합니다. 승인 전에는 참가가 확정되지 않습니다. 일정 30일 이후 운영자가 기록을 정리하며, 이 기기에서 신청 취소·삭제할 수 있습니다. 식비 등 현장 비용은 각자 부담합니다. 개인정보·안전 안내를 확인하고 동의할 때만 신청해 주세요.'))return;
   if(withdraw&&!confirm('신청을 취소하고 서버의 해당 신청 기록을 삭제할까요?'))return;
   const msg=meetups.querySelector('[data-n25-message]');
   const token=partyToken(!!apply);
   if(!token){msg.textContent='이 기기의 안전한 저장 공간을 확인해 주세요.';return;}
   partyBusy=true;renderParty();msg.textContent='서버 확인 중…';
   const result=await companionRpc(apply?'nagachi_party_apply':'nagachi_party_withdraw',{p_meetup_id:id,p_token:token});
   partyBusy=false;await refreshParty();
   msg.textContent=result.ok&&result.data===true?(apply?'신청을 접수했습니다. 운영자 승인 여부는 내 동행 신청에서 확인하세요.':'신청을 취소하고 기록을 삭제했습니다.'):'처리 여부를 확인하지 못했습니다. 내 동행 신청을 확인하고 다시 시도해 주세요.';
   return;
  }
  const interest=e.target.closest('[data-n24-interest]');
  const clear=e.target.closest('[data-n24-clear]');
  if(interest||clear){
   if(busy||!meetups.contains(interest||clear))return;
   const id=interest?Number(interest.dataset.n24Interest):0;
   const msg=interest?interest.parentElement.querySelector('[data-n24-message]'):meetups.querySelector('[data-n24-clear-message]');
   if(interest&&(!ready||(!mine.has(id)&&!openIds.has(id))))return;
   const add=interest&&!mine.has(id);
   if(add&&!confirm('이 모임에 대한 관심 의사와 무작위 기기 비밀값의 해시를 서버에 기록하고 90일간 집계하는 데 동의하시나요? 만료 기록은 운영자가 정리합니다. 참가 신청·확정이나 결제가 아닙니다. 언제든 이 기기에서 취소할 수 있습니다.'))return;
   if(clear&&!confirm('이 기기에 등록한 모든 모임 관심을 취소할까요?'))return;
   const token=add?ensureToken():storedToken();
   if(!token){msg.textContent=add?'이 기기에서 안전한 저장 공간을 사용할 수 없습니다.':'취소할 기기 관심 기록이 없습니다.';return;}
   busy=true;renderInterest();msg.textContent='서버 확인 중…';
   const r=clear?await companionRpc('nagachi_clear_meetup_interest',{p_token:token}):await companionRpc('nagachi_set_meetup_interest',{p_meetup_id:id,p_token:token,p_interested:!!add});
   if(r.ok&&r.data===true){
    if(clear)mine.clear();else if(add)mine.add(id);else mine.delete(id);
    msg.textContent=clear?'모든 모임 관심을 취소했습니다.':add?'관심 의사를 저장했어요. 참가 확정은 아닙니다.':'관심 의사를 취소했습니다.';
    if(clear)ready=true;
   }else{msg.textContent='저장 또는 취소 여부를 확인하지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요.';await loadMine();}
   busy=false;renderInterest();return;
  }
  const button=e.target.closest('[data-n22-open-activity]');
  if(!button)return;
  home.querySelector('[data-v16-invite="'+button.dataset.n22OpenActivity+'"]')?.click();
 });
 document.addEventListener('nagachi:interest-saved',()=>{ /* public listing does not expose individual responses */ });
 load().catch(()=>{section.hidden=true;});
}
