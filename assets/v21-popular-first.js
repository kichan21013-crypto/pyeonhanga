/* 나가치 홈 인기 동행 먼저: 실제 동의 기반 관심만 공개하며 데이터 없으면 취향 탐색 제공.
   실제 참가 확정자/운영 중인 모임/좋아요 수를 가장하거나 만들지 않습니다. */
import { escapeHtml, safeUrl, placeUrl } from '../ui.js';
import { fetchPublicInterestCounts, fetchPopularCompanionPlaces } from './v19-companion-service.js';
import { POPULAR_ACTIVITIES, normalizePopularPlaces, rankPopularActivities,choosePopularView } from './v21-popular-model.js';
const $=(s,root=document)=>root.querySelector(s);
const labelFor=id=>POPULAR_ACTIVITIES.find(a=>a.id===id);
const bottomLine='<p class="n21-real-note">최근 90일 동의·저장된 관심을 집계한 결과입니다. 실제 참가 확정이나 현재 모집 중인 모임은 아닙니다.</p>';
function placeCard(entry){
 const p=entry.place;
 const image=safeUrl(p.image)||'/assets/garden.svg';
 const title=escapeHtml(p.name);
 return '<article class="n21-popular-card n21-place-card">'+
    '<a class="n21-popular-photo" href="'+placeUrl(p)+'" aria-label="'+title+' 장소 자세히 보기">'+
    '<img src="'+image+'" alt="'+title+' 실제 장소 사진" loading="lazy" width="480" height="340"></a>'+
    '<div class="n21-popular-content"><span class="n21-popular-type">'+escapeHtml(entry.activity.tag)+
      ' · '+escapeHtml(p.region)+'</span>'+
    '<h3>'+title+'</h3><span class="n21-popular-count">♥ 가고 싶은 마음 '+entry.interestedCount+'명</span>'+
    '<button type="button" data-companion-interest="'+escapeHtml(p.id)+
      '" data-companion-activity="'+entry.activity.id+'" class="n21-popular-action">'+
      '나도 가보고 싶어요 <span aria-hidden="true">→</span></button></div></article>';
}
function activityCard(item){
 return '<article class="n21-popular-card n21-activity-card">'+
    '<div class="n21-popular-activity-art"><img src="/assets/'+item.image+'" alt="" loading="lazy"></div>'+
    '<div class="n21-popular-content"><span class="n21-popular-type">'+escapeHtml(item.tag)+'</span>'+
    '<h3>'+escapeHtml(item.name)+'</h3><span class="n21-popular-count">♥ 관심 표현 '+item.interestedCount+'명</span>'+
    '<button type="button" data-n21-activity="'+item.id+'" class="n21-popular-action">'+
    '함께 갈 곳 보기 <span aria-hidden="true">→</span></button></div></article>';
}
function discovery(state){
 const status=state==='unconfigured'?'아직 관심 데이터 연결을 준비하고 있어요.':'아직 공개할 만큼 관심이 쌓인 동행이 없어요.';
 return '<div class="n21-popular-empty"><div class="n21-empty-illustration" aria-hidden="true">♡</div>'+
    '<div class="n21-empty-text"><strong>첫 번째 동행을 찾아볼까요?</strong>'+
    '<p>'+status+'<br>마음에 드는 활동부터 골라보세요.</p></div></div>'+
    '<div class="n21-discovery-picks" role="group" aria-label="찾아볼 동행 선택">'+
     POPULAR_ACTIVITIES.map(item=>'<button type="button" data-n21-activity="'+item.id+'">'+
      '<img src="/assets/'+item.image+'" alt="" loading="lazy"><span>'+escapeHtml(item.name)+'</span></button>').join('')+
    '</div>';
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
    heading.textContent='어떤 동행을 찾아볼까요?';
    sub.textContent='아직 인기 순위가 없어요. 내가 원하는 하루부터 찾아볼 수 있어요.';
    const state=(!pop.ok&&!acts.ok)?'unconfigured':'empty';
    content.innerHTML=discovery(state);
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
