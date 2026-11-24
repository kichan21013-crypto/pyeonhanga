/* 운영자가 실제로 게시한 코스/모임 준비 소식만 일반 홈에서 보여줍니다.
 * 운영 초안, 예상 수익, 정확한 만남 장소, 실제 참가 정보는 공개하지 않습니다.
 */
import { companionRpc } from './v19-companion-service.js';
import { readLocal, writeLocal } from '../storage.js';
import { escapeHtml, safeUrl, placeUrl } from '../ui.js';
import { ADMIN_ACTIVITY_LABELS, sanitizePublicCourses } from './v22-operations-model.js';
const $=(s,root=document)=>root.querySelector(s);
const activityToInvite={food:'eat',hike:'hike',outing:'outing',travel:'travel'};
function dateText(value){
 if(!value)return '일정 조율 중';
 const d=new Date(value);
 return Number.isNaN(d.getTime())?'일정 조율 중':
   new Intl.DateTimeFormat('ko-KR',{dateStyle:'medium',timeStyle:'short'}).format(d);
}
function courseCard(course){
 const photo=safeUrl(course.places[0]?.image)||'/assets/garden.svg';
 const first=course.places[0];
 const title=escapeHtml(course.title);
 const stops=course.places.map(p=>p.name).join(' → ');
 return '<article class="n22-public-card">'+
  '<a href="'+placeUrl(first)+'" class="n22-public-photo" aria-label="'+escapeHtml(first.name)+' 장소 정보">'+
  '<img src="'+photo+'" alt="'+escapeHtml(first.name)+' 실제 장소 사진" loading="lazy"></a>'+
  '<div class="n22-public-card-copy"><span class="n22-public-tag">나가치 제안 · '+
    escapeHtml(ADMIN_ACTIVITY_LABELS[course.activity]||'동행')+'</span>'+
  '<h3>'+title+'</h3><p class="n22-public-desc">'+escapeHtml(course.description)+'</p>'+
  '<p class="n22-public-route">'+escapeHtml(stops)+'</p>'+
  '<div class="n22-public-bottom"><span>'+escapeHtml(course.region||'')+' · '+
    escapeHtml(course.duration||'하루')+'</span>'+
  '<button type="button" data-companion-interest="'+escapeHtml(first.id)+
  '" data-companion-activity="'+escapeHtml(course.activity)+'">'+
   '이 코스 함께 가고 싶어요 →</button></div></div></article>';
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
function meetupCard(meetup){
 return '<article class="n22-meetup-preview">'+
   '<span class="n22-meetup-kicker">모임 준비 소식 · '+escapeHtml(ADMIN_ACTIVITY_LABELS[meetup.activity]||'동행')+'</span>'+
   '<h3>'+escapeHtml(meetup.title)+'</h3><p>'+escapeHtml(meetup.intro)+'</p>'+
   '<div class="n22-meetup-bottom"><small>예정: '+escapeHtml(dateText(meetup.meet_at))+
    ' · 실제 참가 확정 아님</small>'+
   '<button type="button" data-n22-open-activity="'+escapeHtml(activityToInvite[meetup.activity]||'outing')+
   '">관련 장소 살펴보기 →</button></div>'+
   '<div class="n24-interest"><button type="button" data-n24-interest="'+Number(meetup.id)+'" aria-pressed="false" disabled>관심 확인 중</button>'+
   '<p role="status" data-n24-message></p></div></article>';
}
export function setupPublicPrograms({home,loadPlaces}){
 const section=$('#n22-public-programs',home);
 if(!section)return;
 const list=$('#n22-public-course-list',home);
 const meetups=$('#n22-public-meetups',home);
 let mine=new Set(),openIds=new Set(),ready=false,busy=false;
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
  const [courseRes,meetRes]=await Promise.all([
   companionRpc('nagachi_public_courses'),companionRpc('nagachi_public_meetups')
  ]);
  const courses=courseRes.ok&&Array.isArray(courseRes.data)?courseRes.data:[];
  const events=meetRes.ok&&Array.isArray(meetRes.data)?meetRes.data:[];
  let shownCourses=[];
  if(courses.length){
   try{shownCourses=sanitizePublicCourses(courses,await loadPlaces());}
   catch{shownCourses=[];}
  }
  const shownEvents=events.filter(m=>m&&Number.isSafeInteger(Number(m.id))&&
     ['food','hike','outing','travel'].includes(m.activity)&&
     m.stage==='announced'&&typeof m.title==='string'&&typeof m.intro==='string');
  openIds=new Set(shownEvents.filter(m=>!m.meet_at||new Date(m.meet_at).getTime()>Date.now()).map(m=>Number(m.id)));
  if(!shownCourses.length&&!shownEvents.length&&!storedToken()){
   section.hidden=true;return;
  }
  list.innerHTML=shownCourses.length?shownCourses.map(courseCard).join(''):'';
  meetups.innerHTML=shownEvents.length?
   '<div class="n22-meetup-header"><h3>운영자가 준비 중인 동행</h3>'+
   '<p>관심을 함께 모으는 단계입니다. 아직 참가 예약·결제는 제공하지 않아요.</p></div>'+
   '<div class="n22-meetup-grid">'+shownEvents.slice(0,6).map(meetupCard).join('')+'</div>':'';
  if(shownEvents.length||storedToken())meetups.insertAdjacentHTML('beforeend','<div class="n24-interest-privacy"><small>관심은 기기 단위로 저장되며 참가 예약이 아닙니다. <a href="/privacy.html">데이터 안내</a></small> <button type="button" data-n24-clear>이 기기의 모든 모임 관심 취소</button><p role="status" data-n24-clear-message></p></div>');
  section.hidden=false;
  await loadMine();renderInterest();
 }
 home.addEventListener('click',async e=>{
  const interest=e.target.closest('[data-n24-interest]');
  const clear=e.target.closest('[data-n24-clear]');
  if(interest||clear){
   if(busy||!meetups.contains(interest||clear))return;
   const id=interest?Number(interest.dataset.n24Interest):0;
   const msg=interest?interest.parentElement.querySelector('[data-n24-message]'):meetups.querySelector('[data-n24-clear-message]');
   if(interest&&(!ready||(!mine.has(id)&&!openIds.has(id))))return;
   const add=interest&&!mine.has(id);
   if(add&&!confirm('이 모임에 대한 관심 의사와 무작위 기기 비밀값의 해시를 서버에 최대 90일간 보관하는 데 동의하시나요? 참가 신청·확정이나 결제가 아닙니다. 언제든 이 기기에서 취소할 수 있습니다.'))return;
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
