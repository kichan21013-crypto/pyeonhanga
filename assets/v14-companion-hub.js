/* NAGACHI v14 companion interest → place → anonymous preference survey.
   Real matching is not offered. Uses the same approved public place data as the app. */
import { escapeHtml, safeUrl, placeUrl } from '../ui.js';
import { COMPANION_INTERESTS, normalizeCompanionInterest, normalizeCompanionRegion, companionPlaceMatches } from './v14-companion-model.js';
const params = new URLSearchParams(location.search);
const state = {
  interest:normalizeCompanionInterest(params.get('interest')),
  region:normalizeCompanionRegion(params.get('region')),
  visible:8,
  places:[],
};
const $=selector=>document.querySelector(selector);
const $$=selector=>[...document.querySelectorAll(selector)];
function placeCard(place){
  const id=escapeHtml(place.id);
  const name=escapeHtml(place.name);
  const image=safeUrl(place.image) || '/assets/garden.svg';
  return '<article class="n13-location">' +
    '<a href="'+placeUrl(place)+'" aria-label="'+name+' 장소 상세 보기"><img loading="lazy" src="'+image+
    '" alt="'+name+' 장소 사진" width="450" height="320"></a>'+
    '<div class="n13-location-body"><small>'+escapeHtml(place.region)+' · '+escapeHtml(place.category)+'</small>'+
    '<h3>'+name+'</h3>'+
    '<button type="button" data-companion-interest="'+id+'">이곳 동행 희망 남기기</button></div></article>';
}
function render() {
  $$('[data-n14-interest]').forEach(button=>
    button.setAttribute('aria-pressed',String(button.dataset.n14Interest===state.interest)));
  $('#n14-hub-region').value=state.region;
  const grid=$('#n14-hub-grid'),more=$('#n14-hub-more'),count=$('#n14-hub-count');
  if(!state.interest) {
    grid.innerHTML='<div class="n14-hub-empty"><strong>어떤 동행을 해보고 싶으세요?</strong><p>위에서 산책·식사·나들이·여행 중 하나를 선택해 주세요.</p></div>';
    count.textContent='활동 선택 전';
    more.hidden=true;
    $('#n14-hub-status').textContent='동행 활동을 선택해 주세요.';
    return;
  }
  const matches=state.places.filter(place=>companionPlaceMatches(place,state));
  count.textContent=matches.length+'곳 · '+COMPANION_INTERESTS[state.interest];
  grid.innerHTML=matches.length
    ? matches.slice(0,state.visible).map(placeCard).join('')
    : '<div class="n14-hub-empty">이 지역에서 확인된 장소가 부족해요. 다른 지역이나 동행 유형을 선택해 주세요.</div>';
  more.hidden=matches.length<=state.visible;
  more.textContent='장소 더 보기 ('+Math.min(matches.length,state.visible)+' / '+matches.length+')';
  $('#n14-hub-status').textContent=matches.length+'곳의 장소를 찾았습니다. 현재 동행 모집 중이라는 뜻은 아닙니다.';
}
async function setup() {
  if(document.body.dataset.companion!=='true' || !$('#n14-hub-types')) return;
  $('#n14-hub-types').addEventListener('click',event=>{
    const button=event.target.closest('[data-n14-interest]');
    if(!button) return;
    state.interest=button.dataset.n14Interest===state.interest?null:button.dataset.n14Interest;
    state.visible=8;
    render();
  });
  $('#n14-hub-region').addEventListener('change',event=>{
    state.region=normalizeCompanionRegion(event.target.value);
    state.visible=8;
    render();
  });
  $('#n14-hub-more').addEventListener('click',()=>{
    state.visible+=8;
    render();
  });
  $('#n14-hub-region').value=state.region;
  $('#n14-hub-grid').innerHTML='<div class="n14-hub-empty">동행할 장소를 불러오는 중이에요.</div>';
  try {
    const res=await fetch('/data/places.json',{cache:'default'});
    if(!res.ok) throw new Error('Public place data unavailable');
    const data=await res.json();
    if(!Array.isArray(data)) throw new Error('Invalid place data');
    state.places=data;
    render();
  } catch {
    $('#n14-hub-grid').innerHTML='<div class="n14-hub-empty">장소 정보를 불러오지 못했어요. 연결 상태를 확인한 후 새로고침해 주세요.</div>';
    $('#n14-hub-more').hidden=true;
    $('#n14-hub-count').textContent='불러오기 실패';
    $('#n14-hub-status').textContent='동행 장소 정보 로딩 실패';
  }
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',setup,{once:true});
else setup();
