/* 선택한 동행 관심 인원: 실제 동의/저장된 서로 다른 브라우저 수만 공개(5명 이상).
 * 신청/확정/좌석 수가 아니라 관심 표현 수임을 항상 밝힙니다.
 * 선택적 '앱 내 동행 소식'은 토큰을 가진 신청 브라우저에만 표시합니다.
 */
import { escapeHtml } from '../ui.js';
import { fetchPublicInterestCounts,myCompanionUpdates,stopCompanionUpdates,
         localSubscriptionToken,GROUP_ACTIVITIES } from './v19-companion-service.js';
const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const names=Object.fromEntries(GROUP_ACTIVITIES.map(x=>[x.id,x.label]));

function formattedDate(raw){
 if(!raw)return '';
 const d=new Date(raw);
 return Number.isNaN(d.getTime())?'':new Intl.DateTimeFormat('ko-KR',{dateStyle:'medium',timeStyle:'short'}).format(d);
}
export function setupGroupExperience(home){
 if(!home||home.dataset.n19Groups)return;
 home.dataset.n19Groups='ready';
 const journey=$('#n16-journey',home);
 const countLabel=journey?.querySelector('.n16-results-bar');
 if(countLabel){
   const span=document.createElement('span');
   span.id='n19-selected-interest-count';
   span.className='n19-selected-interest-count';
   span.textContent='동행 관심 인원 확인 중';
   countLabel.insertAdjacentElement('afterend',span);
 }
 const foot=document.createElement('p');
 foot.className='n19-group-privacy';
 foot.textContent='관심 인원은 동의 후 저장된 서로 다른 브라우저 기준입니다. 실제 참가 인원이나 모집 확정 수가 아닙니다.';
 journey?.append(foot);
 let counts={};
 let countReady=false;
 async function refreshCounts(){
  const result=await fetchPublicInterestCounts();
  countReady=result.ok;
  counts=result.ok?result.counts:{};
  $$('[data-n19-count]',home).forEach(node=>{
    const number=counts[node.dataset.n19Count];
    node.textContent=number?('관심 '+number+'명'):(result.ok?'관심 집계 중':'집계 연결 준비 중');
    node.hidden=false;
  });
  const updateSelected=()=>{
   const selected=$('[data-v16-invite][aria-pressed="true"]',home);
   const id=selected?.dataset.v16Invite;
   const activity=id==='eat'?'food':id;
   const number=counts[activity];
   if(!countLabel||!id)return;
   const target=$('#n19-selected-interest-count',home);
   if(target)target.textContent=number?('이 활동에 관심을 남긴 분 '+number+'명 · 참가 확정 아님'):
     countReady?'아직 공개할 수 있는 관심 인원 집계가 없어요.':'관심 인원은 저장 서버 연결 후 확인돼요.';
  };
  updateSelected();
 }
 home.addEventListener('click',event=>{
  if(event.target.closest('[data-v16-invite]'))queueMicrotask(()=>{
   const selected=$('[data-v16-invite][aria-pressed="true"]',home);
   const value=selected?.dataset.v16Invite;
   const number=counts[value==='eat'?'food':value];
   const target=$('#n19-selected-interest-count',home);
   if(target)target.textContent=number?'이 활동에 관심을 남긴 분 '+number+'명 · 참가 확정 아님':
     countReady?'아직 공개할 수 있는 관심 인원 집계가 없어요.':'관심 인원은 저장 서버 연결 후 확인돼요.';
  });
 });
 document.addEventListener('nagachi:interest-saved',refreshCounts);
 refreshCounts();

 const inbox=document.createElement('section');
 inbox.className='n19-inbox';
 inbox.id='n19-my-updates';
 inbox.setAttribute('aria-labelledby','n19-updates-title');
 inbox.innerHTML='<div class="n19-inbox-heading"><div><span>MY TOGETHER</span>' +
   '<h2 id="n19-updates-title">내가 고른 동행 소식</h2>' +
   '<p>관심을 남긴 활동의 새로운 일정과 모임 장소를 앱에서 확인해요.</p></div>' +
   '<span class="n19-inbox-symbol" aria-hidden="true">✦</span></div>' +
   '<div id="n19-update-list" role="status"></div>' +
   '<div class="n19-inbox-actions"><button type="button" data-n19-refresh>새 소식 확인</button>' +
   '<button type="button" data-n19-stop hidden>소식 받기 해지</button></div>' +
   '<p class="n19-inbox-note">이메일·문자·푸시는 보내지 않습니다. 공지는 수신 신청한 기기에서만 확인되며, 모임 참가 확정이 아닙니다.</p>';
 const dialog=document.createElement('dialog');
 dialog.id='n33-updates-dialog';
 dialog.className='n33-updates-dialog';
 dialog.setAttribute('aria-labelledby','n19-updates-title');
 const close=document.createElement('button');
 close.type='button';close.className='n33-updates-close';
 close.setAttribute('aria-label','동행 소식 닫기');close.textContent='×';
 close.addEventListener('click',()=>dialog.close());
 dialog.append(close,inbox);
 home.append(dialog);
 dialog.addEventListener('close',()=>document.querySelector('[data-n30-updates]')?.focus({preventScroll:true}));
 const results=$('#n19-update-list',inbox);
 const stop=$('[data-n19-stop]',inbox);
 async function refreshInbox(){
   if(!localSubscriptionToken()){
     results.innerHTML='<p class="n19-inbox-empty">아직 소식 수신을 선택하지 않았어요. 마음에 드는 장소를 고른 뒤 <strong>“동행 소식도 보고 싶어요”</strong>를 체크하면, 해당 활동의 공지를 이곳에서 확인할 수 있어요.</p>';
     stop.hidden=true;return;
   }
   stop.hidden=false;
   results.textContent='내 동행 소식을 확인하고 있어요.';
   const updates=await myCompanionUpdates();
   if(!updates.ok){
     results.textContent='동행 소식을 연결하지 못했어요. 서버 설정이나 네트워크를 확인해 주세요.';
     return;
   }
   if(!updates.items.length){
     results.innerHTML='<p class="n19-inbox-empty">지금은 새 공지가 없어요. 운영자가 실제 일정과 장소를 안내하면 여기에 표시됩니다.</p>';
     return;
   }
   results.innerHTML=updates.items.map(item=>
     '<article class="n19-update"><span>'+escapeHtml(names[item.activity]||'동행 소식')+'</span>' +
     '<h3>'+escapeHtml(item.title)+'</h3><p>'+escapeHtml(item.body)+'</p>' +
     (item.meet_at?'<p class="n19-update-date"><strong>예정 일정</strong> '+escapeHtml(formattedDate(item.meet_at))+'</p>':'') +
     (item.meet_place?'<p class="n19-update-date"><strong>모일 곳</strong> '+escapeHtml(item.meet_place)+'</p>':'') +
     '<small>준비 상황 공지 · 참가/예약 확정이 아닙니다.</small></article>'
   ).join('');
 }
 inbox.addEventListener('click',async event=>{
  if(event.target.closest('[data-n19-refresh]'))refreshInbox();
  if(event.target.closest('[data-n19-stop]')){
    if(!confirm('이 기기에서 관심 동행 소식 받기를 해지할까요?'))return;
    const result=await stopCompanionUpdates();
    if(!result.ok)results.textContent='해지가 완료되지 않았어요. 연결을 확인한 후 다시 시도해 주세요.';
  }
 });
 document.addEventListener('nagachi:updates-subscribed',()=>{if(dialog.open)refreshInbox();});
 document.addEventListener('click',event=>{if(event.target.closest('[data-n30-updates]')&&dialog.open)refreshInbox();});
 results.textContent='동행 소식을 열면 확인할 수 있어요.';
}
