/* 운영자가 실제로 게시한 코스/모임 준비 소식만 일반 홈에서 보여줍니다.
 * 운영 초안, 예상 수익, 정확한 만남 장소, 실제 참가 정보는 공개하지 않습니다.
 */
import { companionRpc } from './v19-companion-service.js';
import { escapeHtml, safeUrl, placeUrl } from '../ui.js';
import { ADMIN_ACTIVITY_LABELS } from './v22-operations-model.js';
const $=(s,root=document)=>root.querySelector(s);
const activityToInvite={food:'eat',hike:'hike',outing:'outing',travel:'travel'};
function dateText(value){
 if(!value)return '일정 조율 중';
 const d=new Date(value);
 return Number.isNaN(d.getTime())?'일정 조율 중':
   new Intl.DateTimeFormat('ko-KR',{dateStyle:'medium',timeStyle:'short'}).format(d);
}
export function sanitizePublicCourses(rows,catalog){
 if(!Array.isArray(rows)||!Array.isArray(catalog))return [];
 const places=new Map(catalog.filter(p=>p&&typeof p.id==='string'&&!p.isDemo).map(p=>[p.id,p]));
 return rows.filter(c=>c&&Number.isSafeInteger(Number(c.id))&&Number(c.id)>0
   &&typeof c.title==='string'&&typeof c.description==='string'
   &&['food','hike','outing','travel'].includes(c.activity)
   &&Array.isArray(c.place_ids)&&c.place_ids.length>0)
   .map(c=>({...c,places:c.place_ids.map(id=>places.get(id)).filter(Boolean)}))
   .filter(c=>c.places.length>0).slice(0,12);
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
function meetupCard(meetup){
 return '<article class="n22-meetup-preview">'+
   '<span class="n22-meetup-kicker">모임 준비 소식 · '+escapeHtml(ADMIN_ACTIVITY_LABELS[meetup.activity]||'동행')+'</span>'+
   '<h3>'+escapeHtml(meetup.title)+'</h3><p>'+escapeHtml(meetup.intro)+'</p>'+
   '<div class="n22-meetup-bottom"><small>예정: '+escapeHtml(dateText(meetup.meet_at))+
    ' · 실제 참가 확정 아님</small>'+
   '<button type="button" data-n22-open-activity="'+escapeHtml(activityToInvite[meetup.activity]||'outing')+
   '">관련 장소 살펴보기 →</button></div></article>';
}
export function setupPublicPrograms({home,loadPlaces}){
 const section=$('#n22-public-programs',home);
 if(!section)return;
 const list=$('#n22-public-course-list',home);
 const meetups=$('#n22-public-meetups',home);
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
  if(!shownCourses.length&&!shownEvents.length){
   section.hidden=true;return;
  }
  list.innerHTML=shownCourses.length?shownCourses.map(courseCard).join(''):'';
  meetups.innerHTML=shownEvents.length?
   '<div class="n22-meetup-header"><h3>운영자가 준비 중인 동행</h3>'+
   '<p>관심을 함께 모으는 단계입니다. 아직 참가 예약·결제는 제공하지 않아요.</p></div>'+
   '<div class="n22-meetup-grid">'+shownEvents.slice(0,6).map(meetupCard).join('')+'</div>':'';
  section.hidden=false;
 }
 home.addEventListener('click',e=>{
  const button=e.target.closest('[data-n22-open-activity]');
  if(!button)return;
  home.querySelector('[data-v16-invite="'+button.dataset.n22OpenActivity+'"]')?.click();
 });
 document.addEventListener('nagachi:interest-saved',()=>{ /* public listing does not expose individual responses */ });
 load().catch(()=>{section.hidden=true;});
}
