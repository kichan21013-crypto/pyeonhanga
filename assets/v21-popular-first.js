/* 나가치 홈 인기 동행 먼저: 실제 동의 기반 관심만 공개하며 데이터 없으면 취향 탐색 제공.
   실제 참가 확정자/운영 중인 모임/좋아요 수를 가장하거나 만들지 않습니다. */
import { escapeHtml, safeUrl, placeUrl, icon } from '../ui.js';
import { savedIds } from '../storage.js';
import { togetherPlaceMatches } from './v16-together-model.js';
import { fetchPublicInterestCounts, fetchPopularCompanionPlaces } from './v19-companion-service.js';
import { POPULAR_ACTIVITIES, normalizePopularPlaces, rankPopularActivities,choosePopularView } from './v21-popular-model.js';
const $=(s,root=document)=>root.querySelector(s);
const labelFor=id=>POPULAR_ACTIVITIES.find(a=>a.id===id);
const bottomLine='<p class="n21-real-note">최근 90일 동의·저장된 관심 기기 기준 · 실제 모집 인원 아님</p>';
const categoryLabel={food:'맛집',outing:'나들이',travel:'여행',hike:'산행'};
const headlineSuffix={food:' 함께 가요',outing:' 산책 동행',travel:' 나들이 동행',hike:' 산행 동행'};
function placeCard(entry,index=0){
 const p=entry.place,ranked=Number.isSafeInteger(entry.interestedCount)&&entry.interestedCount>=5;
 const image=safeUrl(p.image)||'/assets/garden.svg',title=escapeHtml(p.name);
 const saved=savedIds().includes(p.id);
 return '<article class="n21-popular-card n21-place-card">'+
  '<div class="n30-card-media"><a class="n21-popular-photo" href="'+placeUrl(p)+'" aria-label="'+title+' 장소 자세히 보기">'+
  '<img src="'+image+'" alt="'+title+' 실제 장소 사진" loading="lazy" width="480" height="340"></a>'+
  '<span class="n30-rank '+(ranked?'is-ranked':'')+'">'+(ranked?'인기 '+(index+1)+'위':'동행 추천')+'</span>'+
  '<button type="button" class="save-icon n12-save n30-save '+(saved?'is-saved':'')+'" data-save="'+escapeHtml(p.id)+'" aria-label="'+title+' 저장하기" aria-pressed="'+saved+'">'+icon('heart')+'</button></div>'+
  '<div class="n21-popular-content"><h3>'+title+escapeHtml(headlineSuffix[entry.activity.id]||' 함께 가요')+'</h3>'+
  '<div class="n30-meta"><span class="n21-popular-type">'+icon('pin')+escapeHtml(p.region||'')+' · '+escapeHtml(p.category||categoryLabel[entry.activity.id])+'</span>'+
  (ranked?'<span class="n30-count">'+icon('people')+entry.interestedCount+'건 관심</span>':'')+'</div>'+
  '<button type="button" data-companion-interest="'+escapeHtml(p.id)+'" data-companion-activity="'+entry.activity.id+'" class="n21-popular-action">관심 남기기 <span aria-hidden="true">→</span></button></div></article>';
}
function activityCard(item){
 return '<article class="n21-popular-card n21-activity-card">'+
    
    '<div class="n21-popular-content"><span class="n21-popular-type">'+escapeHtml(item.tag)+'</span>'+
    '<h3>'+escapeHtml(item.name)+'</h3><span class="n21-popular-count">♥ 관심 표현 '+item.interestedCount+'건</span>'+
    '<button type="button" data-n21-activity="'+item.id+'" class="n21-popular-action">'+
    '함께 갈 곳 보기 <span aria-hidden="true">→</span></button></div></article>';
}
function discovery(catalog){
 const candidates=[];
 for(const activity of ['food','outing','travel','hike']){
   const item=labelFor(activity);
   const place=catalog.find(p=>p&&!p.isDemo&&p.id&&p.name&&safeUrl(p.image)&&!candidates.some(x=>x.place.id===p.id)&&togetherPlaceMatches(p,{interest:item.invite}));
   if(place)candidates.push({place,activity:item});
 }
 return candidates.length?'<div class="n21-popular-rail n29-candidate-rail">'+candidates.map(placeCard).join('')+'</div>':'<p class="n29-empty-note">해당 지역의 동행 후보를 찾지 못했어요. 다른 지역을 선택해 주세요.</p>';
}
export function setupPopularFirst({home,loadPlaces,scrollToInvites}){
 if(!home||home.dataset.n21Popular)return;
 home.dataset.n21Popular='ready';
 const target=$('#n21-popular',home);
 const heading=$('#n21-popular-heading',target);
 const sub=$('#n21-popular-sub',target);
 const content=$('#n21-popular-content',target);
 const find=$('[data-n21-find]',target);
 const regionSelect=$('#n29-region',home);
 const all=$('[data-n30-all]',target),heroLabel=$('[data-n30-hero-label]',home);
 function setExpanded(value){target.classList.toggle('n30-expanded',value);if(!all)return;all.setAttribute('aria-expanded',String(value));all.textContent=value?'접기 ↑':'전체보기 →';}
 all?.addEventListener('click',()=>setExpanded(all.getAttribute('aria-expanded')!=='true'));
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
  const region=regionSelect?.value||'';
  const regionalCatalog=Array.isArray(catalog)?catalog.filter(p=>!region||p.region===region):[];
  const places=pop.ok?normalizePopularPlaces(pop.items,regionalCatalog):[];
  const activities=acts.ok&&!region?rankPopularActivities(acts.counts):[];
  const view=choosePopularView({places,activities});
  target.dataset.view=view;
  setExpanded(false);
  if(heroLabel)heroLabel.textContent=view==='discovery'?'추천 동행 보기':'지금 인기 있는 동행 보기';
  if(view==='places'){
    heading.textContent=(region?region+' · ':'')+'지금 인기 있는 동행';
    sub.textContent='지금 가장 많은 관심을 받고 있는 동행을 만나보세요.';
    content.innerHTML='<div class="n21-popular-rail">'+places.map(placeCard).join('')+'</div>'+bottomLine;
  }else if(view==='activities'){
    heading.textContent='지금 인기 있는 활동';
    sub.textContent='많은 분이 함께하고 싶다고 고른 활동부터 만나보세요.';
    content.innerHTML='<div class="n21-popular-rail">'+activities.map(activityCard).join('')+'</div>'+bottomLine;
  }else{
    heading.textContent=(region?region+' · ':'')+'나가치 추천 동행';
    sub.textContent='가고 싶은 곳에 관심을 남겨주세요. 참가 신청은 아니에요.';
    content.innerHTML=discovery(regionalCatalog)+'<p class="n21-real-note">추천 후보 · 실제 모집 중인 모임은 아닙니다.</p>';
  }
  if(all)all.hidden=content.querySelectorAll('.n21-popular-card').length<3;
  find.textContent='직접 동행 찾아보기 →';
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
 regionSelect?.addEventListener('change',refresh);
 document.addEventListener('nagachi:interest-saved',refresh);
 refresh();
}
