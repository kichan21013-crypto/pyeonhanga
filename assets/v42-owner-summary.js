import {companionRpc} from './v19-companion-service.js';
import {escapeHtml} from '../ui.js';
const fmt=n=>n!=null&&n!==''&&Number.isSafeInteger(Number(n))&&Number(n)>=0?Number(n).toLocaleString('ko-KR'):'—';
export function renderOwnerSummary(d){
 const card=(label,n,unit)=>'<div><span>'+escapeHtml(label)+'</span><strong>'+fmt(n)+escapeHtml(unit)+'</strong></div>';
 const pending=Array.isArray(d.pending_groups)?d.pending_groups.filter(x=>Number.isSafeInteger(Number(x.id))&&Number(x.id)>0&&Number(x.pending)>0):[];
 return '<h3>회원 현황 · 오늘 할 일</h3><div class="n42-kpis">'+card('일반 가입 회원',d.members,'명')+card('오늘 신규 회원',d.new_today,'명')+card('일정 수신 회원',d.subscribed_members,'명')+card('승인 대기 신청',d.pending,'건')+'</div><p class="n42-note">관리자 '+fmt(d.owners)+'명 제외 · 회원 수와 기기별 신청 건수는 별도 집계</p><p class="n42-workline">모집 중 '+fmt(d.open_meetups)+' · 코스 초안 '+fmt(d.draft_courses)+' · 공지 초안 '+fmt(d.draft_notices)+'</p>'+
 (pending.length?'<div class="n42-pending">'+pending.map(x=>'<div><span>'+escapeHtml(x.title)+' · '+fmt(x.pending)+'건</span><button type="button" data-n39-pending-meetup="'+Number(x.id)+'">신청 처리</button></div>').join('')+'</div>':'<p class="n42-note">현재 승인 대기 신청 '+fmt(d.pending)+'건</p>');
}
export function mountOwnerSummary(root,getToken){
 const panel=root.querySelector('#n42-owner-summary');let revision=0;
 async function load(){const token=getToken();if(!panel||!token)return;const seq=++revision;panel.textContent='회원 현황 확인 중';const r=await companionRpc('nagachi_admin_owner_summary',{},token);if(seq!==revision||getToken()!==token)return;if(!r.ok||!r.data){panel.textContent='회원 현황 연결 실패 · 새로고침해 주세요.';return;}panel.innerHTML=renderOwnerSummary(r.data);}
 return {load,reset:()=>{revision++;panel?.replaceChildren();}};
}
