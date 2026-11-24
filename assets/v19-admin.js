/* 나가치 운영자 콘솔: Supabase Auth 사용자 + DB의 명시적 관리자 allowlist 필수.
 * 로그인 비밀번호/토큰은 이 탭의 메모리에만 보관, 영속 저장하지 않습니다.
 * 공개 key로 읽기/쓰기 RPC 요청만 사용하며 서버의 auth.uid() 검사가 진짜 접근 통제입니다.
 */
import { GROUP_ACTIVITIES,authenticateCompanionAdmin,companionRpc } from './v19-companion-service.js';
import { escapeHtml } from '../ui.js';
import { mountOperations } from './v22-operations-admin.js?v=20261124-v39';
const $=s=>document.querySelector(s);
const labels=Object.fromEntries(GROUP_ACTIVITIES.map(x=>[x.id,x.label]));
let jwt=null;
const login=$('#n19-admin-login');
const panel=$('#n19-admin-panel');
const status=$('#n19-admin-status');
const msg=t=>{status.textContent=t;};
const operations=mountOperations({getToken:()=>jwt,notify:msg});
function clearSession(){
 jwt=null;login.hidden=false;panel.hidden=true;operations.reset();
 $('#n19-admin-counts').replaceChildren();$('#n19-admin-notices').replaceChildren();
 const form=$('#n19-admin-notice-form');form.reset();form.elements.notice_id.value='';form._notices=[];
 login.reset();
}
const number=(rows,key,id,field)=>Array.isArray(rows)?
  (rows.find(r=>r[key]===id)?.[field]??0):0;
function dateText(iso){
  if(!iso)return '미정';
  const d=new Date(iso);
  return Number.isNaN(d.getTime())?'미정':
    new Intl.DateTimeFormat('ko-KR',{dateStyle:'medium',timeStyle:'short'}).format(d);
}
async function dashboard(){
 if(!jwt)return;
 msg('운영 데이터를 확인하는 중입니다.');
 const token=jwt;
 const result=await companionRpc('nagachi_admin_dashboard',{},token);
 if(jwt!==token)return;
 if(!result.ok){
   if(result.reason==='forbidden'){
     clearSession();
     msg('관리 권한이 없습니다. Supabase Auth 사용자 ID를 관리자 허용 목록에 추가했는지 확인해 주세요.');
   } else msg('운영 데이터 조회 실패: 연결 상태와 SQL 설치 여부를 확인해 주세요.');
   return;
 }
 const data=result.data||{};
 const counts=$('#n19-admin-counts');
 counts.innerHTML=GROUP_ACTIVITIES.map(item=>{
   const interest=number(data.interest_counts,'activity',item.id,'people');
   const recipients=number(data.subscribers,'activity',item.id,'devices');
   return '<article class="n19-admin-metric"><span>'+escapeHtml(item.label)+'</span>' +
    '<strong>'+interest+'명</strong><small>동의한 익명 기기 기준, 참가 확정 아님</small>' +
    '<p>앱 내 공지 수신 기기 <b>'+recipients+'개</b></p></article>';
 }).join('');
 const list=$('#n19-admin-notices');
 list.innerHTML=Array.isArray(data.notices)&&data.notices.length?
   data.notices.map(n=>'<article class="n19-admin-notice"><span>'+
     escapeHtml(labels[n.activity]||n.activity)+' · '+(n.status==='published'?'게시 중':'초안') +
     '</span><h3>'+escapeHtml(n.title)+'</h3><p>'+escapeHtml(n.body)+'</p>' +
     '<small>일정: '+escapeHtml(dateText(n.meet_at))+' · 장소: '+escapeHtml(n.meet_place||'미정')+'</small>' +
     '<button type="button" data-n19-edit="'+Number(n.id)+'">수정하기</button></article>').join(''):
   '<p class="n19-empty-state">아직 작성한 모임 공지가 없습니다.</p>';
 const form=$('#n19-admin-notice-form');
 form._notices=data.notices||[];
 msg('운영자 로그인이 확인되었습니다. 코스·모임·수익 계획을 관리할 수 있습니다.');
 await operations.load();
}
login.addEventListener('submit',async event=>{
 event.preventDefault();
 const button=login.querySelector('button[type=submit]');
 button.disabled=true;
 msg('로그인 정보를 확인하고 있습니다.');
 const email=login.elements.email.value.trim();
 const password=login.elements.password.value;
 login.elements.password.value='';
 const auth=await authenticateCompanionAdmin(email,password);
 button.disabled=false;
 if(!auth.ok){msg(auth.reason==='unconfigured'?'서버 연결이 설정되지 않았습니다. 아래 운영 연결 안내를 확인하세요.':'로그인하지 못했습니다. 관리자 계정과 연결 상태를 확인해 주세요.');return;}
 jwt=auth.token;
 const check=await companionRpc('nagachi_admin_dashboard',{},jwt);
 if(!check.ok){jwt=null;msg('로그인은 되었지만 관리자 권한이 확인되지 않았습니다. 허용 목록을 확인해 주세요.');return;}
 login.hidden=true;panel.hidden=false;
 dashboard();
});
$('#n19-admin-notice-form').addEventListener('submit',async event=>{
 event.preventDefault();
 if(!jwt){msg('관리자 로그인이 필요합니다.');return;}
 const form=event.currentTarget;
 const button=form.querySelector('[type=submit]');
 const p_meet_at=form.elements.meet_at.value?
   new Date(form.elements.meet_at.value).toISOString():null;
 const args={
  p_activity:form.elements.activity.value,
  p_title:form.elements.title.value.trim(),
  p_body:form.elements.body.value.trim(),
  p_meet_at,p_meet_place:form.elements.meet_place.value.trim()||null,
  p_publish:form.elements.publish.checked,
  p_notice_id:form.elements.notice_id.value?Number(form.elements.notice_id.value):null,
 };
 if(args.p_publish&&!confirm('선택한 활동의 소식 수신 신청 기기에만 공지를 게시합니다. 이 앱에 다시 방문해야 보입니다. 게시할까요?'))return;
 button.disabled=true;
 const token=jwt;
 const r=await companionRpc('nagachi_admin_save_notice',args,token);
 button.disabled=false;
 if(jwt!==token)return;
 if(!r.ok){msg('공지 저장에 실패했습니다. 서버 권한/필수값을 확인해 주세요.');return;}
 form.reset();
 form.elements.notice_id.value='';
 msg(args.p_publish?'선택한 활동에 공지를 게시했습니다. 실제 전달은 이용자 앱 재방문 시 이뤄집니다.':'공지 초안을 저장했습니다. 구독 사용자에게는 노출되지 않습니다.');
 dashboard();
});
$('#n19-admin-notices').addEventListener('click',event=>{
 const button=event.target.closest('[data-n19-edit]');
 if(!button)return;
 const form=$('#n19-admin-notice-form');
 const item=(form._notices||[]).find(n=>Number(n.id)===Number(button.dataset.n19Edit));
 if(!item)return;
 form.elements.notice_id.value=item.id;
 form.elements.activity.value=item.activity;
 form.elements.title.value=item.title;
 form.elements.body.value=item.body;
 form.elements.meet_place.value=item.meet_place||'';
 if(item.meet_at){
   const d=new Date(item.meet_at);
   form.elements.meet_at.value=Number.isNaN(d.getTime())?'':new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);
 }else form.elements.meet_at.value='';
 form.elements.publish.checked=item.status==='published';
 form.scrollIntoView({behavior:'smooth',block:'start'});
 form.elements.title.focus({preventScroll:true});
});
$('#n19-admin-refresh').addEventListener('click',dashboard);
$('#n19-admin-logout').addEventListener('click',()=>{
 clearSession();msg('로그아웃했습니다. 로그인 정보는 이 화면을 닫으면 남지 않습니다.');
});
