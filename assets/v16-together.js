/* 나가치 v16 실제 장소를 통해 "같이 가고 싶다"는 의향을 구체화하는 화면. */
import { escapeHtml, safeUrl, placeUrl } from '../ui.js';
import { trackRhythm } from '../analytics.js';
import { TOGETHER_INVITES, invitationById, TOGETHER_REGIONS, MEAL_TAGS,
  cleanTogetherRegion, cleanMealTag, togetherPlaceMatches } from './v16-together-model.js';
const $=(sel,root=document)=>root.querySelector(sel);
const $$=(sel,root=document)=>[...root.querySelectorAll(sel)];
const prefersReducedMotion=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function venueCard(place,interest){
  const name=escapeHtml(place.name);
  const photo=safeUrl(place.image)||'/assets/garden.svg';
  const link=placeUrl(place);
  return '<article class="n16-venue-card n18-venue-card">' +
    '<div class="n18-venue-visual">' +
    '<a href="'+link+'" class="n16-venue-photo" aria-label="'+name+' 장소 상세 보기">' +
    '<img loading="lazy" src="'+photo+'" alt="'+name+' 장소 사진" width="640" height="450"></a>' +
    '<span class="n18-photo-label">같이 가볼 곳</span></div>' +
    '<div class="n16-venue-info">' +
    '<span class="n16-venue-category">'+escapeHtml(place.region)+' · '+escapeHtml(place.category)+'</span>' +
    '<h3><a href="'+link+'">'+name+'</a></h3>' +
    '<p>자세한 위치와 방문정보를 확인해 보세요.</p>' +
    '<button type="button" class="n16-venue-together" data-companion-interest="'+escapeHtml(place.id)+
    '" data-companion-activity="'+interest+'">여기, 같이 가보고 싶어요 <span aria-hidden="true">→</span></button>' +
    '</div></article>';
}
export function setupTogetherJourney({home,loadPlaces}){
  const invites=$('#n16-invites',home);
  const section=$('#n16-journey',home);
  if(!invites||!section)return;
  const region=$('#n16-region',section);
  const menu=$('#n16-meals',section);
  const grid=$('#n16-venues',section);
  const count=$('#n16-count',section);
  const more=$('#n16-more',section);
  const heading=$('#n16-journey-heading',section);
  const subtitle=$('#n16-journey-subtitle',section);
  const status=$('#n16-journey-status',section);
  const state={interest:null,region:'',mealTag:'',visible:6,requestId:0};
  const scrollToSection=()=>section.scrollIntoView({
    behavior:prefersReducedMotion()?'auto':'smooth',block:'start',
  });
  const sync=()=>{
    $$('[data-v16-invite]',invites).forEach(button=>
      button.setAttribute('aria-pressed',String(button.dataset.v16Invite===state.interest)));
    region.value=state.region;
    menu.hidden=state.interest!=='eat';
    $$('[data-v16-meal]',menu).forEach(button=>
      button.setAttribute('aria-pressed',String(button.dataset.v16Meal===state.mealTag)));
    const item=invitationById(state.interest);
    heading.textContent=item?item.label:'어디로 함께 갈까요?';
    subtitle.textContent='실제 등록된 장소 중 취향에 맞는 곳을 보여드릴게요. 아직 진행 중인 동행 모임은 없습니다.';
  };
  const render=async({scroll=false}={})=>{
    const requestId=++state.requestId;
    sync();
    grid.setAttribute('aria-busy','true');
    grid.innerHTML='<div class="n16-loading" aria-hidden="true"></div><div class="n16-loading" aria-hidden="true"></div>';
    count.textContent='장소를 찾는 중';
    more.hidden=true;
    try{
      const catalog=await loadPlaces();
      if(requestId!==state.requestId)return;
      const matches=catalog.filter(place=>togetherPlaceMatches(place,state));
      count.textContent=matches.length+'곳';
      grid.innerHTML=matches.length
        ? matches.slice(0,state.visible).map(place=>venueCard(place,state.interest)).join('')
        : '<div class="n16-empty"><strong>확인된 장소가 없어요</strong>' +
          '<p>선택한 지역·활동에 맞는 장소가 아직 부족합니다. 다른 지역이나 메뉴를 선택해 주세요.</p></div>';
      more.hidden=matches.length<=state.visible;
      more.textContent='다른 장소 더 보기 ('+Math.min(state.visible,matches.length)+' / '+matches.length+')';
      grid.removeAttribute('aria-busy');
      status.textContent=matches.length+'곳의 실제 장소를 찾았습니다. 동행 모집 확정 정보는 아닙니다.';
    }catch{
      if(requestId!==state.requestId)return;
      grid.removeAttribute('aria-busy');
      grid.innerHTML='<div class="n16-empty"><strong>장소를 불러오지 못했어요</strong>' +
        '<p>네트워크 상태를 확인한 후 다시 시도해 주세요.</p>' +
        '<button type="button" data-v16-retry>다시 시도</button></div>';
      count.textContent='불러오기 실패';
      status.textContent='장소 데이터 연결 실패';
    }
    if(scroll)scrollToSection();
  };
  invites.addEventListener('click',event=>{
    const button=event.target.closest('[data-v16-invite]');
    if(!button)return;
    const item=invitationById(button.dataset.v16Invite);
    if(!item)return;
    state.interest=item.id;
    state.visible=6;
    state.mealTag='';
    section.hidden=false;
    trackRhythm('activity_selected',{activities:[item.activity],desires:[item.desire]});
    // 결과가 느린 네트워크에서도 먼저 선택 영역을 보여줍니다.
    render();
    scrollToSection();
  });
  region.addEventListener('change',event=>{
    state.region=cleanTogetherRegion(event.target.value);
    state.visible=6;
    render();
  });
  menu.addEventListener('click',event=>{
    const button=event.target.closest('[data-v16-meal]');
    if(!button)return;
    state.mealTag=cleanMealTag(button.dataset.v16Meal);
    state.visible=6;
    render();
  });
  section.addEventListener('click',event=>{
    if(event.target.closest('[data-v16-retry]'))render();
    if(event.target.closest('#n16-more')){state.visible+=6;render();}
  });
  const requested=new URLSearchParams(location.search).get('together');
  if(invitationById(requested)){
    state.interest=requested;
    section.hidden=false;
    render({scroll:true});
  }
}
