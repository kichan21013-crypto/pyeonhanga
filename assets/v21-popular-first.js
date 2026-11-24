/* 나가치 홈 인기 동행 먼저: 실제 동의 기반 관심만 공개하며 데이터 없으면 취향 탐색 제공.
   실제 참가 확정자/운영 중인 모임/좋아요 수를 가장하거나 만들지 않습니다. */
import { escapeHtml, safeUrl, placeUrl } from '../ui.js';
import { fetchPublicInterestCounts, fetchPopularCompanionPlaces } from './v19-companion-service.js';
import { POPULAR_ACTIVITIES, normalizePopularPlaces, rankPopularActivities,choosePopularView } from './v21-popular-model.js';
const $=(s,root=document)=>root.querySelector(s);
const labelFor=id=>POPULAR_ACTIVITIES.find(a=>a.id===id);
const bottomLine='<p class="n21-real-note">최근 90일 관심을 남긴 기기 기준 · 실제 모집 인원 아님</p>';
function placeCard(entry){
 const p=entry.place;
 const image=safeUrl(p.image)||'/assets/garden.svg';
 const title=escapeHtml(p.name);
 return '<article class="n21-popular-card n21-place-card">'+
    '<a class="n21-popular-photo" href="'+placeUrl(p)+'" aria-label="'+title+' 장소 자세히 보기">'+
    '<img src="'+image+'" alt="'+title+' 실제 장소 사진" loading="lazy" width="480" height="340"></a>'+
    '<div class="n21-popular-content"><span class="n21-popular-type">'+escapeHtml(entry.activity.tag)+
      ' · '+escapeHtml(p.region)+'</span>'+
    '<h3>'+title+'</h3><span class="n21-popular-count">♥ 가고 싶은 마음 '+entry.interestedCount+'건</span>'+
    '<button type="button" data-companion-interest="'+escapeHtml(p.id)+
      '" data-companion-activity="'+entry.activity.id+'" class="n21-popular-action">'+
      '나도 가보고 싶어요 <span aria-hidden="true">→</span></button></div></article>';
}
function activityCard(item){
 return '<article class="n21-popular-card n21-activity-card">'+
    
    '<div class="n21-popular-content"><span class="n21-popular-type">'+escapeHtml(item.tag)+'</span>'+
    '<h3>'+escapeHtml(item.name)+'</h3><span class="n21-popular-count">♥ 관심 표현 '+item.interestedCount+'건</span>'+
    '<button type="button" data-n21-activity="'+item.id+'" class="n21-popular-action">'+
    '함께 갈 곳 보기 <span aria-hidden="true">→</span></button></div></article>';
}
function discovery(state,catalog){
 const candidates=[];
 for(const activity of ['travel','outing','food','hike']){
   const item=labelFor(activity);
   const place=catalog.find(p=>p&&!p.isDemo&&p.id&&p.name&&safeUrl(p.image)&&!candidates.some(x=>x.place.id===p.id)&&
     (activity==='food'?p.category==='맛집':activity==='travel'?p.category==='여행':activity==='outing'?p.category==='나들이':/산|등산|둘레길/.test(p.name)));
   if(place)candidates.push({place,activity:item});
 }
 const status=state==='unconfigured'?'인기 집계가 준비되면 순위를 보여드려요.':'아직 공개할 수 있는 관심 순위가 없어요.';
 return '<p class="n29-empty-note">'+status+'</p>'+
  (candidates.length?'<div class="n21-popular-rail n29-candidate-rail">'+candidates.map(({place:p,activity})=>
    '<article class="n21-popular-card n21-place-card"><a class="n21-popular-photo" href="'+placeUrl(p)+'"><img src="'+escapeHtml(safeUrl(p.image))+'" alt="'+escapeHtml(p.name)+'" loading="lazy" width="480" height="340"></a>'+
    '<div class="n21-popular-content"><span class="n21-popular-type">'+escapeHtml(p.region||'')+' · '+escapeHtml(activity.tag)+'</span><h3>'+escapeHtml(p.name)+'</h3>'+
    '<button type="button" class="n21-popular-action" data-companion-interest="'+escapeHtml(p.id)+'" data-companion-activity="'+activity.id+'">같이 가보고 싶어요 <span aria-hidden="true">→</span></button></div></article>').join('')+'</div>':'');
}
export function setupPopularFirst({home,loadPlaces,scrollToInvites}){
 if(!home||home.dataset.n21Popular)return;
 home.dataset.n21Popular='ready';
 const target=$('#n21-popular',home);
 const heading=$('#n21-popular-heading',target);
 const sub=$('#n21-popular-sub',target);
 const content=$('#n21-popular-content',target);
 const find=$('[data-n21-find]',target);
 let serial=0;
 async function refresh(){
  const request=++serial;
  // 빠른 로컬 장소 자료와 Supabase 공개 집계만 사용; 로그인/연락처 요구 없음.
  const [popularResult,activityResult,catalogResult]=await Promise.allSettled([
   fetchPopularCompanionPlaces(),fetchPublicInterestCounts(),loadPlaces()
  ]);
  if(request!==serial||!target.isConnected)return;
  const pop=popularResult.status==='fulfilled'?popularResult.value:{ok:false};
  const acts=activityResult.status==='fulfilled'?activityResult.value:{ok:false};
  const catalog=catalogResult.status==='fulfilled'?catalogResult.value:[];
  const places=pop.ok?normalizePopularPlaces(pop.items,catalog):[];
  const activities=acts.ok?rankPopularActivities(acts.counts):[];
  const view=choosePopularView({places,activities});
  target.dataset.view=view;
  if(view==='places'){
    heading.textContent='지금 관심 많은 동행 장소';
    sub.textContent='직접 “가고 싶어요”를 남긴 분들이 많은 장소부터 보여드려요.';
    content.innerHTML='<div class="n21-popular-rail">'+places.map(placeCard).join('')+'</div>'+bottomLine;
  }else if(view==='activities'){
    heading.textContent='요즘 관심 많은 동행';
    sub.textContent='많은 분이 함께하고 싶다고 고른 활동부터 만나보세요.';
    content.innerHTML='<div class="n21-popular-rail">'+activities.map(activityCard).join('')+'</div>'+bottomLine;
  }else{
    heading.textContent='함께 가보고 싶은 곳';
    sub.textContent='실제 장소 중 동행 후보를 골라보세요. 인기 순위나 모집 중인 모임은 아니에요.';
    const state=(!pop.ok&&!acts.ok)?'unconfigured':'empty';
    content.innerHTML=discovery(state,Array.isArray(catalog)?catalog:[]);
  }
  find.textContent=view==='discovery'?'직접 동행 찾아보기 →':'다른 동행도 찾아보기 →';
 }
 target.addEventListener('click',event=>{
  const activity=event.target.closest('[data-n21-activity]');
  if(activity){
    const item=labelFor(activity.dataset.n21Activity);
    if(!item)return;
    const button=home.querySelector('[data-v16-invite="'+item.invite+'"]');
    if(button){
      button.click(); // 기존 636개 장소 추천 로직을 그대로 사용
      return;
    }
    scrollToInvites();
  }
  if(event.target.closest('[data-n21-find]'))scrollToInvites();
 });
 document.addEventListener('nagachi:interest-saved',refresh);
 refresh();
}
