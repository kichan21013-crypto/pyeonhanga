import {companionRpc} from './v19-companion-service.js';
import {accountToken,accountRole,rememberReturn} from './v40-account-auth.js?v=20261125-v45';
import {escapeHtml as e} from '../ui.js';

const board=document.querySelector('#n45-board');
const cats={all:'전체',daily:'일상·자랑',trip:'여행·나들이',food:'맛집',hike:'산행',review:'동행 후기'};
let filter='all',rows=[],mine=new Set(),admin=false,manage=false,busy=false,loaded=false,loading=true,seq=0,view='list',selected=null;
board.innerHTML='<div id="n45-status" role="status"></div><div id="n45-screen"></div>';
const screen=board.querySelector('#n45-screen'),status=board.querySelector('#n45-status');
const say=t=>{status.textContent=t};
const date=x=>e(new Date(x.created_at).toLocaleDateString('ko-KR',{year:'numeric',month:'2-digit',day:'2-digit'}));
function login(){rememberReturn('/community.html');location.href='/account.html'}
function go(next,id=null,focus=true){
 view=next;selected=id;draw();
 if(focus){const h=screen.querySelector('[data-screen-heading]');h?.focus();board.scrollIntoView?.({block:'start'});}
}
function rowMarkup(x){
 const id=Number(x.id);
 return '<li><button type="button" class="n46-row" data-open="'+id+'"><span class="n46-row-copy"><span class="n46-category">'+e(cats[x.category]||'일상')+(manage&&x.hidden?' · 숨김':'')+'</span><strong>'+e(x.title)+'</strong><span class="n46-meta">'+e(x.nickname)+' <span aria-hidden="true">·</span> '+date(x)+(manage?' · 신고 '+Number(x.reports||0)+'건':'')+'</span></span><span class="n46-chevron" aria-hidden="true">›</span></button></li>';
}
function draw(){
 if(view==='detail'){
  const x=rows.find(x=>Number(x.id)===selected);
  if(!x){view='list';selected=null;draw();return;}
  const id=Number(x.id);
  const action=manage?'<button type="button" class="n46-outline" data-hide="'+id+'" data-state="'+(!x.hidden)+'">'+(x.hidden?'공개 복원':'숨김 처리')+'</button>':mine.has(id)?'<button type="button" class="n46-danger" data-delete="'+id+'">내 글 삭제</button>':'<button type="button" class="n46-danger" data-report="'+id+'">신고</button>';
  screen.innerHTML='<div class="n46-detail"><button type="button" class="n46-back" data-back>‹ 게시글 목록</button><div class="n46-detail-head"><span class="n46-category">'+e(cats[x.category]||'일상')+'</span><h2 tabindex="-1" data-screen-heading>'+e(x.title)+'</h2><p class="n46-meta">'+e(x.nickname)+' · '+date(x)+(manage?' · 신고 '+Number(x.reports||0)+'건 · '+(x.hidden?'숨김':'공개'):'')+'</p></div><p class="n46-body">'+e(x.body)+'</p><div class="n46-detail-actions">'+action+'</div></div>';
  return;
 }
 if(view==='compose'&&accountToken()){
  screen.innerHTML='<div class="n46-compose"><button type="button" class="n46-back" data-back>‹ 게시글 목록</button><h2 tabindex="-1" data-screen-heading>이야기 쓰기</h2><form id="n45-write"><label>별명<input name="nickname" minlength="2" maxlength="16" required placeholder="공개할 별명"></label><label>분류<select name="category">'+Object.entries(cats).filter(([k])=>k!=='all').map(([k,v])=>'<option value="'+k+'"'+(filter===k?' selected':'')+'>'+e(v)+'</option>').join('')+'</select></label><label>제목<input name="title" minlength="2" maxlength="80" required placeholder="제목을 입력하세요"></label><label>이야기<textarea name="body" minlength="2" maxlength="1500" required placeholder="오늘의 즐거웠던 순간을 남겨주세요."></textarea></label><p class="n45-note">누구나 읽을 수 있는 글입니다. 연락처나 타인의 개인정보는 올리지 마세요.</p><button class="n46-write" type="submit">게시글 등록</button></form></div>';
  return;
 }
 view='list';selected=null;
 const items=rows.filter(x=>filter==='all'||x.category===filter);
 const state=loading?'게시글 불러오는 중':!loaded?'연결 확인 필요':rows.length?'게시판 이용 가능':'게시판 이용 가능 · 첫 글을 기다려요';
 screen.innerHTML='<div class="n46-toolbar"><div><span class="n46-state" data-ready="'+(loaded&&!loading)+'">'+e(state)+'</span><h2 tabindex="-1" data-screen-heading>'+(manage?'게시글 관리':'자유게시판')+'</h2></div><button type="button" class="n46-write" data-write>＋ 글쓰기</button></div>'+
 '<div class="n45-filter" role="group" aria-label="게시글 분류">'+Object.entries(cats).map(([k,v])=>'<button type="button" data-filter="'+k+'" aria-pressed="'+(k===filter)+'">'+e(v)+'</button>').join('')+'</div>'+
 '<div class="n46-list-head"><strong>'+e(cats[filter])+' 게시글</strong><span>'+(loaded?'최근 게시글 '+items.length+'개':'')+'</span></div>'+
 (loading?'<p class="n46-empty">게시글을 불러오고 있습니다.</p>':!loaded?'<div class="n46-empty"><strong>게시판에 연결하지 못했어요.</strong><p>잠시 후 다시 시도해 주세요.</p><button type="button" class="n46-outline" data-retry>다시 불러오기</button></div>':items.length?'<ul class="n46-list">'+items.map(rowMarkup).join('')+'</ul>':'<div class="n46-empty"><strong>아직 등록된 게시글이 없어요.</strong><p>소소한 일상부터 맛집과 나들이 후기까지 자유롭게 남겨보세요.</p></div>')+
 (!accountToken()?'<p class="n45-note">게시글은 누구나 읽을 수 있으며, 글쓰기는 카카오 로그인 후 가능합니다.</p>':'')+
 (admin?'<div class="n46-admin"><button type="button" class="n46-outline" data-manage>'+(manage?'일반 게시판 보기':'관리자 신고·숨김 관리')+'</button></div>':'');
}
async function load(){
 const s=++seq,t=accountToken();loading=true;
 try{
  const role=t?await accountRole():{ok:false};
  if(s!==seq||accountToken()!==t)return;
  admin=role.ok&&role.data===true;if(!admin)manage=false;
  const [r,m]=await Promise.all([manage?companionRpc('nagachi_admin_community',{},t):companionRpc('nagachi_community_feed'),t?companionRpc('nagachi_community_mine',{},t):Promise.resolve({ok:true,data:[]})]);
  if(s!==seq||accountToken()!==t)return;
  loaded=r.ok&&Array.isArray(r.data);rows=loaded?r.data:[];mine=new Set(m.ok&&Array.isArray(m.data)?m.data.map(x=>Number(x.id)):[]);
 }catch{if(s!==seq||accountToken()!==t)return;loaded=false;rows=[];mine.clear();admin=false;manage=false;}
 loading=false;draw();
}
board.addEventListener('click',async ev=>{
 const b=ev.target.closest('button');if(!b||busy)return;
 if(b.dataset.filter){filter=b.dataset.filter;draw();screen.querySelector('[data-filter="'+filter+'"]')?.focus();return}
 if(b.hasAttribute('data-open')){go('detail',Number(b.dataset.open));return}
 if(b.hasAttribute('data-back')){if(view==='compose'&&screen.querySelector('form')&&[...screen.querySelectorAll('input,textarea')].some(x=>x.value.trim())&&!confirm('작성 중인 글을 닫을까요?'))return;go('list');return}
 if(b.hasAttribute('data-write')){if(!accountToken()){login();return}go('compose');return}
 if(b.hasAttribute('data-retry')){loading=true;draw();await load();return}
 if(b.hasAttribute('data-manage')){manage=!manage;rows=[];loaded=false;loading=true;draw();await load();return}
 if(!b.hasAttribute('data-delete')&&!b.hasAttribute('data-report')&&!b.hasAttribute('data-hide'))return;
 const t=accountToken();if(!t){login();return}
 let name,args;
 if(b.hasAttribute('data-delete')){if(!confirm('내 게시글을 삭제할까요?'))return;name='nagachi_community_delete';args={p_id:Number(b.dataset.delete)}}
 else if(b.hasAttribute('data-report')){if(!confirm('운영자에게 이 게시글을 신고할까요?'))return;name='nagachi_community_report';args={p_id:Number(b.dataset.report)}}
 else{if(!confirm('게시글 공개 상태를 변경할까요?'))return;name='nagachi_admin_community_hide';args={p_id:Number(b.dataset.hide),p_hidden:b.dataset.state==='true'}}
 busy=true;b.disabled=true;
 let ok=false;try{const r=await companionRpc(name,args,t);ok=r.ok&&r.data===true}catch{}
 busy=false;b.disabled=false;say(ok?'처리했습니다.':'처리하지 못했습니다.');
 if(ok){if(name==='nagachi_community_delete'){view='list';selected=null}await load()}
});
board.addEventListener('submit',async ev=>{
 if(ev.target.id!=='n45-write')return;ev.preventDefault();if(busy)return;
 const t=accountToken();if(!t){login();return}
 const f=new FormData(ev.target),args={p_nickname:String(f.get('nickname')).trim(),p_category:String(f.get('category')),p_title:String(f.get('title')).trim(),p_body:String(f.get('body')).trim()};
 if(!confirm('작성한 이야기를 공개 게시판에 등록할까요?'))return;
 busy=true;const b=ev.target.querySelector('[type="submit"]');b.disabled=true;
 let ok=false;try{const r=await companionRpc('nagachi_community_post',args,t);ok=r.ok&&Number(r.data)>0}catch{}
 busy=false;b.disabled=false;
 if(ok){say('이야기를 등록했습니다.');filter='all';view='list';selected=null;await load()}
 else say('등록하지 못했습니다. 입력 내용과 연결 상태를 확인해 주세요.');
});
let last=accountToken();
setInterval(()=>{const t=accountToken();if(t!==last){last=t;admin=false;manage=false;mine.clear();rows=[];loaded=false;loading=true;go('list',null,false);void load()}},5000);
draw();void load();
