import {accountToken,accountRole,finishKakaoLogin,startKakaoLogin,pendingActivities,saveAccountActivities,readAccountNews,signOutAccount,configured,accountSetupIdentity,takeReturn} from './v40-account-auth.js?v=20261125-v45';
import {GROUP_ACTIVITIES,companionRpc} from './v19-companion-service.js';
import {escapeHtml} from '../ui.js';
const root=document.querySelector('#n40-account'),status=document.querySelector('#n40-status');
const show=t=>{status.textContent=t};
let revision=0;
async function render(redirectAdmin=false){
 const seq=++revision,t=accountToken();
 root.replaceChildren();
 if(!t){root.innerHTML='<h2>카카오로 시작하기</h2><p>둘러보기는 로그인 없이 이용할 수 있어요. 관심 동행의 일정 소식은 로그인 후 확인하세요.</p><button class="n40-kakao" type="button" data-login '+(configured?'':'disabled')+'>카카오 로그인</button><p><a href="/privacy.html">개인정보 안내</a></p>';return}
 const role=await accountRole();if(seq!==revision||accountToken()!==t)return;
 if(redirectAdmin){const target=takeReturn();if(target){location.replace(target);return;}}
 if(redirectAdmin&&role.ok&&role.data===true){location.replace('/admin.html');return}
 root.innerHTML='<h2>내 동행 소식</h2><p>로그인한 계정에서 관심 활동의 운영자 공지를 확인합니다. 카카오톡·문자·푸시 발송은 아직 제공하지 않습니다.</p>'+
 (role.ok&&role.data===true?'<p><a class="button primary" href="/admin.html">관리자 운영실 들어가기</a></p>':'')+
 (!role.ok?'<p>관리자 권한 확인 서버가 아직 연결되지 않았습니다.</p>':'')+
 '<form id="n40-preferences"><fieldset><legend>일정 소식 받을 활동</legend>'+GROUP_ACTIVITIES.map(a=>'<label><input type="checkbox" name="activity" value="'+a.id+'"> '+escapeHtml(a.label)+'</label>').join('')+'</fieldset><p>선택한 활동과 계정 ID를 90일 동안 소식 제공에 사용합니다. 저장하면 기존 선택을 변경합니다.</p><button type="submit" class="button primary">소식 받기 저장</button></form>'+
 '<section id="n45-meetup-news" aria-live="polite">모임별 소식 확인 중</section><p><a href="/community.html">나가치 커뮤니티</a></p><div id="n40-news" aria-live="polite">소식 확인 중</div><button type="button" data-refresh>새 소식 확인</button> <button type="button" data-stop>소식 받기 해지</button><details><summary>내 계정 정보</summary><p>운영자 등록 시에만 사용하는 내 계정 식별번호입니다. 이 번호만으로 관리자 권한이 생기지 않습니다.</p><button type="button" data-identity>내 계정 식별번호 확인</button><p id="n41-identity" aria-live="polite"></p></details><p><button type="button" data-logout>로그아웃</button></p>';
 const [r,meet,apps]=await Promise.all([readAccountNews(),companionRpc('nagachi_account_meetup_news',{},t),companionRpc('nagachi_account_party_list',{},t)]);
 if(seq!==revision||accountToken()!==t)return;
 const m=root.querySelector('#n45-meetup-news');const dates=v=>v?new Date(v).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}):'일정 조율 중';const labels={pending:'승인 대기',approved:'참가 승인',waitlisted:'대기자',cancelled:'운영자 취소'};
 m.innerHTML='<h3>내 모임 알림</h3>'+(!meet.ok||!Array.isArray(meet.data)?'연결 확인 필요':meet.data.length?meet.data.map(x=>'<article class="n40-news"><strong>'+escapeHtml(x.title)+'</strong><p>'+escapeHtml(dates(x.meet_at))+' · '+(x.recruitment_open?'모집 중':x.stage==='closed'?'종료':'준비 중')+'</p><a href="/#n22-public-programs">모임 보기</a> <button data-unsub="'+Number(x.meetup_id)+'" type="button">알림 해지</button></article>').join(''):'<p>신청한 모임 알림이 없어요.</p>')+'<h3>내 참가 신청</h3>'+(!apps.ok||!Array.isArray(apps.data)?'연결 확인 필요':apps.data.length?apps.data.map(x=>'<article class="n40-news"><strong>'+escapeHtml(x.title)+'</strong><p>'+escapeHtml(labels[x.status]||'상태 확인 중')+' · '+escapeHtml(dates(x.meet_at))+'</p>'+(x.meet_place?'<p>집결지: '+escapeHtml(x.meet_place)+'</p>':'')+'<button data-withdraw="'+Number(x.meetup_id)+'" type="button">참가 신청 취소</button></article>').join(''):'<p>참가 신청 내역이 없어요.</p>');if(seq!==revision||accountToken()!==t)return;
 const news=root.querySelector('#n40-news');
 const pending=pendingActivities();
 if(!r.ok||!r.data){news.textContent='소식 서버 설정 또는 연결을 확인해 주세요.';root.querySelector('[type=submit]').disabled=true;return}
 const activities=Array.isArray(r.data.activities)?r.data.activities:[];
 root.querySelectorAll('[name=activity]').forEach(e=>{e.checked=activities.includes(e.value)||pending.includes(e.value)});
 const items=Array.isArray(r.data.items)?r.data.items:[];
 news.innerHTML=items.length?items.map(n=>'<article class="n40-news"><h3>'+escapeHtml(n.title)+'</h3><p>'+escapeHtml(n.body)+'</p><p>'+escapeHtml(n.meet_at?new Date(n.meet_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}):'일정 조율 중')+' · '+escapeHtml(n.meet_place||'장소 조율 중')+'</p><small>참가 확정 아님</small></article>').join(''):'<p>아직 새 일정 소식이 없어요.</p>';
 if(pending.length)show('관심을 남긴 활동을 불러왔어요. 선택 내용을 확인하고 소식 받기를 저장하세요.');
}
root.addEventListener('click',async e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.hasAttribute('data-login')){b.disabled=true;try{await startKakaoLogin()}catch{show('카카오 로그인 연결을 확인해 주세요.');b.disabled=false}}
 if(b.hasAttribute('data-logout')){revision++;root.replaceChildren();await signOutAccount();show('로그아웃했습니다.');await render()}
 if(b.hasAttribute('data-identity')){const seq=revision;const r=await accountSetupIdentity();if(seq!==revision)return;const el=root.querySelector('#n41-identity');if(el)el.textContent=r.ok?r.id:'계정 확인에 실패했습니다. 다시 로그인해 주세요.';}
 if(b.hasAttribute('data-unsub')||b.hasAttribute('data-withdraw')){const unsub=b.hasAttribute('data-unsub'),t=accountToken();if(!t||!confirm(unsub?'모임 알림을 해지할까요?':'참가 신청을 취소하고 기록을 삭제할까요?'))return;b.disabled=true;const r=await companionRpc(unsub?'nagachi_account_meetup_subscribe':'nagachi_account_party_withdraw',unsub?{p_meetup_id:Number(b.dataset.unsub),p_enabled:false}:{p_meetup_id:Number(b.dataset.withdraw)},t);show(r.ok&&r.data===true?'처리했습니다.':'처리하지 못했습니다.');await render();}
 if(b.hasAttribute('data-refresh'))await render();
 if(b.hasAttribute('data-stop')&&confirm('이 계정의 동행 소식 받기를 해지할까요?')){b.disabled=true;const r=await saveAccountActivities([]);show(r.ok?'소식 받기를 해지했습니다.':'해지에 실패했습니다.');await render()}
});
root.addEventListener('submit',async e=>{if(e.target.id!=='n40-preferences')return;e.preventDefault();const b=e.target.querySelector('[type=submit]');b.disabled=true;const r=await saveAccountActivities([...new FormData(e.target).getAll('activity')]);show(r.ok?'소식 수신 설정을 저장했습니다.':'설정을 저장하지 못했습니다.');await render()});
const result=await finishKakaoLogin();
if(!configured)show('현재 로그인 서버 연결 설정이 필요합니다.');
else if(result.callback&&!result.ok)show('로그인이 완료되지 않았습니다. 다시 시도해 주세요.');
await render(result.callback&&result.ok);
let hadSession=!!accountToken();setInterval(()=>{const live=!!accountToken();if(hadSession&&!live){show('로그인이 만료되었습니다. 다시 로그인하세요.');void render();}hadSession=live;},5000);
