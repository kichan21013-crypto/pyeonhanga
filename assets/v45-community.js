import {companionRpc} from './v19-companion-service.js';
import {accountToken,accountRole,rememberReturn} from './v40-account-auth.js?v=20261125-v45';
import {escapeHtml as e} from '../ui.js';

const board=document.querySelector('#n45-board');
const cats={all:'전체',daily:'일상·자랑',trip:'여행·나들이',food:'맛집',hike:'산행',review:'동행 후기'};
let filter='all',rows=[],mine=new Set(),admin=false,manage=false,busy=false,loaded=false,loading=true,seq=0,view='list',selected=null;
board.innerHTML='<div id="n45-status" role="status"></div><div id="n45-screen"></div>';
const screen=board.querySelector('#n45-screen'),status=board.querySelector('#n45-status');
const say=t=>{status.textContent=t};
let engagement=new Map(),commentQueue=new Map(),detailRevision=0;
const metrics=x=>{const a=engagement.get(Number(x.id));return a?' · 공감 '+Number(a.likes)+' · 댓글 '+Number(a.comments):''};
const date=x=>e(new Date(x.created_at).toLocaleDateString('ko-KR',{year:'numeric',month:'2-digit',day:'2-digit'}));
async function photoBase64(file){
 if(!file||!file.size)return null;
 if(file.size>12*1024*1024||!/^image\/(jpeg|png|webp)$/.test(file.type))throw Error('JPG·PNG·WebP 사진 12MB 이하만 가능합니다.');
 const url=URL.createObjectURL(file);
 try{
  const img=new Image();img.src=url;await img.decode();
  if(!img.naturalWidth||!img.naturalHeight||img.naturalWidth*img.naturalHeight>40000000)throw Error('사진 크기가 너무 큽니다.');
  const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
  for(const edge of [1000,800,600,400]){
   const ratio=Math.min(1,edge/Math.max(img.naturalWidth,img.naturalHeight));
   canvas.width=Math.max(1,Math.round(img.naturalWidth*ratio));canvas.height=Math.max(1,Math.round(img.naturalHeight*ratio));
   ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
   for(const q of [.8,.65,.5]){
    const data=canvas.toDataURL('image/jpeg',q);
    if(data.startsWith('data:image/jpeg;base64,')&&data.length-23<=160000)return data.slice(23);
   }
  }
  throw Error('사진을 압축하지 못했습니다. 다른 사진을 선택해 주세요.');
 }finally{URL.revokeObjectURL(url)}
}
async function drawPhoto(id){
 const slot=screen.querySelector('#n47-photo'),t=accountToken(),mode=manage;
 if(!slot)return;
 const r=await companionRpc('nagachi_community_photo',{p_id:id,p_admin:mode},t);
 if(!slot.isConnected||selected!==id||view!=='detail'||accountToken()!==t||manage!==mode)return;
 if(r.ok&&typeof r.data==='string'&&r.data.length<=160000&&/^[A-Za-z0-9+/]+={0,2}$/.test(r.data)){
  const img=document.createElement('img');img.alt='게시글 첨부 사진';img.src='data:image/jpeg;base64,'+r.data;img.loading='lazy';slot.replaceChildren(img);
 }else if(!r.ok)slot.textContent='사진 연결 상태를 확인해 주세요.';
}
function login(){rememberReturn('/community.html');location.href='/account.html'}
function go(next,id=null,focus=true){
 view=next;selected=id;draw();
 if(focus){const h=screen.querySelector('[data-screen-heading]');h?.focus();board.scrollIntoView?.({block:'start'});}
}
function rowMarkup(x){
 const id=Number(x.id);
 return '<li><button type="button" class="n46-row" data-open="'+id+'"><span class="n46-row-copy"><span class="n46-category">'+e(cats[x.category]||'일상')+(manage&&x.hidden?' · 숨김':'')+'</span><strong>'+e(x.title)+'</strong><span class="n46-meta">'+e(x.nickname)+' <span aria-hidden="true">·</span> '+date(x)+metrics(x)+(manage?' · 글 신고 '+Number(x.reports||0)+'건 · 댓글 신고 '+(commentQueue.get(id)||0)+'건':'')+'</span></span><span class="n46-chevron" aria-hidden="true">›</span></button></li>';
}
function draw(){
 if(view==='detail'){
  const x=rows.find(x=>Number(x.id)===selected);
  if(!x){view='list';selected=null;draw();return;}
  const id=Number(x.id);
  const action=manage?'<button type="button" class="n46-outline" data-hide="'+id+'" data-state="'+(!x.hidden)+'">'+(x.hidden?'공개 복원':'숨김 처리')+'</button>':mine.has(id)?'<button type="button" class="n46-danger" data-delete="'+id+'">내 글 삭제</button>':'<button type="button" class="n46-danger" data-report="'+id+'">신고</button>';
  screen.innerHTML='<div class="n46-detail"><button type="button" class="n46-back" data-back>‹ 게시글 목록</button><div class="n46-detail-head"><span class="n46-category">'+e(cats[x.category]||'일상')+'</span><h2 tabindex="-1" data-screen-heading>'+e(x.title)+'</h2><p class="n46-meta">'+e(x.nickname)+' · '+date(x)+(manage?' · 신고 '+Number(x.reports||0)+'건 · '+(x.hidden?'숨김':'공개'):'')+'</p></div><p class="n46-body">'+e(x.body)+'</p><div id="n47-photo"></div><div class="n46-detail-actions">'+action+'</div><section id="n47-engagement" aria-label="공감과 댓글"><p>공감과 댓글을 불러오는 중입니다.</p></section></div>';
  void drawEngagement(id);void drawPhoto(id);return;
 }
 if(view==='compose'&&accountToken()){
  screen.innerHTML='<div class="n46-compose"><button type="button" class="n46-back" data-back>‹ 게시글 목록</button><h2 tabindex="-1" data-screen-heading>이야기 쓰기</h2><form id="n45-write"><label>별명<input name="nickname" minlength="2" maxlength="16" required placeholder="공개할 별명"></label><label>분류<select name="category">'+Object.entries(cats).filter(([k])=>k!=='all').map(([k,v])=>'<option value="'+k+'"'+(filter===k?' selected':'')+'>'+e(v)+'</option>').join('')+'</select></label><label>제목<input name="title" minlength="2" maxlength="80" required placeholder="제목을 입력하세요"></label><label>이야기<textarea name="body" minlength="2" maxlength="1500" required placeholder="오늘의 즐거웠던 순간을 남겨주세요."></textarea></label><label>사진 (선택, 1장)<input type="file" name="photo" accept="image/jpeg,image/png,image/webp"></label><p class="n45-note">사진은 자동 압축됩니다. 다른 사람의 얼굴이나 개인정보를 동의 없이 올리지 마세요.</p><p class="n45-note">누구나 읽을 수 있는 글입니다. 연락처나 타인의 개인정보는 올리지 마세요.</p><button class="n46-write" type="submit">게시글 등록</button></form></div>';
  return;
 }
 view='list';selected=null;
 const items=rows.filter(x=>filter==='all'||x.category===filter);
 const state=loading?'게시글 불러오는 중':!loaded?'연결 확인 필요':rows.length?'게시판 이용 가능':'게시판 이용 가능 · 첫 글을 기다려요';
 screen.innerHTML='<div class="n46-toolbar"><div><span class="n46-state" data-ready="'+(loaded&&!loading)+'">'+e(state)+'</span><h2 tabindex="-1" data-screen-heading>'+(manage?'게시글 관리':'자유게시판')+'</h2></div><button type="button" class="n46-write" data-write'+(loading?' disabled':'')+'>＋ 글쓰기</button></div>'+
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
 const ids=rows.map(x=>Number(x.id));
 const [counts,queue]=await Promise.all([ids.length?companionRpc('nagachi_community_engagement',{p_ids:ids},t):Promise.resolve({ok:true,data:[]}),manage?companionRpc('nagachi_admin_comment_report_queue',{},t):Promise.resolve({ok:true,data:[]})]);
 if(s!==seq||accountToken()!==t)return;
 engagement=new Map(counts.ok&&Array.isArray(counts.data)?counts.data.map(x=>[Number(x.post_id),x]):[]);
 commentQueue=new Map(queue.ok&&Array.isArray(queue.data)?queue.data.map(x=>[Number(x.post_id),Number(x.reports)]):[]);
 if(manage)rows.sort((a,b)=>((commentQueue.get(Number(b.id))||0)+Number(b.reports||0))-((commentQueue.get(Number(a.id))||0)+Number(a.reports||0)));
 loading=false;draw();
}
async function drawEngagement(id){
 const rev=++detailRevision,t=accountToken(),mode=manage,slot=screen.querySelector('#n47-engagement');
 if(!slot)return;
 const [counts,comments]=await Promise.all([companionRpc('nagachi_community_engagement',{p_ids:[id]},t),companionRpc('nagachi_community_comments_list',{p_id:id,p_admin:mode},t)]);
 if(rev!==detailRevision||view!=='detail'||selected!==id||accountToken()!==t||manage!==mode||!slot.isConnected)return;
 const a=counts.ok&&Array.isArray(counts.data)?counts.data[0]:null;
 if(a)engagement.set(id,a);
 const list=comments.ok&&Array.isArray(comments.data)?comments.data:null;
 slot.innerHTML=(a&&!mode?'<button type="button" class="n47-like" data-like="'+(!a.liked)+'" aria-pressed="'+Boolean(a.liked)+'">'+(a.liked?'♥':'♡')+' 공감 '+Number(a.likes)+'</button>':'')+
 '<h3>댓글'+(a?' '+Number(a.comments):'')+'</h3>'+
 (list===null?'<p>댓글 연결을 확인해 주세요.</p><button type="button" class="n46-outline" data-comment-retry>다시 확인</button>':list.length?'<ul class="n47-comments">'+list.map(c=>'<li><div class="n47-comment-head"><strong>'+e(c.nickname)+'</strong><span>'+date(c)+(mode?' · 신고 '+Number(c.reports)+'건 · '+(c.hidden?'숨김':'공개'):'')+'</span></div><p>'+e(c.body)+'</p>'+(mode?'<button type="button" class="n46-outline" data-comment-hide="'+Number(c.id)+'" data-hidden="'+(!c.hidden)+'">'+(c.hidden?'복원':'숨김')+'</button>':c.mine?'<button type="button" class="n46-danger" data-comment-delete="'+Number(c.id)+'">삭제</button>':'<button type="button" class="n46-danger" data-comment-report="'+Number(c.id)+'">신고</button>')+'</li>').join('')+'</ul>':'<p class="n45-note">첫 댓글을 남겨보세요.</p>')+
 (!mode&&list!==null?(t?'<form id="n47-comment-form"><label>별명<input name="nickname" required minlength="2" maxlength="16" placeholder="공개 별명"></label><label>댓글<textarea name="body" required minlength="2" maxlength="500" placeholder="따뜻한 이야기를 남겨주세요."></textarea></label><button type="submit" class="n46-write">댓글 등록</button></form>':'<button type="button" class="n46-outline" data-comment-login>카카오 로그인 후 댓글 쓰기</button>'):'');
}
async function engagementAction(b){
 if(b.hasAttribute('data-comment-retry')){await drawEngagement(selected);return true}
 if(b.hasAttribute('data-comment-login')){login();return true}
 let name,args;
 if(b.hasAttribute('data-like')){name='nagachi_community_set_like';args={p_id:selected,p_enabled:b.dataset.like==='true'}}
 else if(b.hasAttribute('data-comment-delete')){name='nagachi_community_comment_delete';args={p_id:Number(b.dataset.commentDelete)}}
 else if(b.hasAttribute('data-comment-report')){name='nagachi_community_comment_report';args={p_id:Number(b.dataset.commentReport)}}
 else if(b.hasAttribute('data-comment-hide')){name='nagachi_admin_comment_hide';args={p_id:Number(b.dataset.commentHide),p_hidden:b.dataset.hidden==='true'}}
 else return false;
 const t=accountToken();if(!t){login();return true}
 if(name!=='nagachi_community_set_like'&&!confirm('댓글을 처리할까요?'))return true;
 const id=selected;busy=true;b.disabled=true;const r=await companionRpc(name,args,t);busy=false;b.disabled=false;
 say(r.ok&&r.data===true?'처리했습니다.':'처리하지 못했습니다.');
 if(view==='detail'&&selected===id){await drawEngagement(id);if(manage){const q=await companionRpc('nagachi_admin_comment_report_queue',{},t);if(accountToken()===t&&manage&&q.ok&&Array.isArray(q.data))commentQueue=new Map(q.data.map(x=>[Number(x.post_id),Number(x.reports)]));}}
 return true;
}
board.addEventListener('click',async ev=>{
 const b=ev.target.closest('button');if(!b||busy)return;
 if(await engagementAction(b))return;
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
 if(ev.target.id==='n47-comment-form'){
  ev.preventDefault();if(busy)return;const t=accountToken();if(!t){login();return}const id=selected,f=new FormData(ev.target),b=ev.target.querySelector('[type="submit"]');busy=true;b.disabled=true;
  const r=await companionRpc('nagachi_community_comment_add',{p_id:id,p_nickname:String(f.get('nickname')).trim(),p_body:String(f.get('body')).trim()},t);busy=false;b.disabled=false;
  if(r.ok&&Number(r.data)>0){say('댓글을 등록했습니다.');if(view==='detail'&&selected===id)await drawEngagement(id)}else say('댓글을 등록하지 못했어요. 입력 내용과 하루 등록 한도를 확인해 주세요.');return;
 }
 if(ev.target.id!=='n45-write')return;ev.preventDefault();if(busy)return;
 const t=accountToken();if(!t){login();return}
 const f=new FormData(ev.target),args={p_nickname:String(f.get('nickname')).trim(),p_category:String(f.get('category')),p_title:String(f.get('title')).trim(),p_body:String(f.get('body')).trim()};
 if(!confirm('작성한 이야기를 공개 게시판에 등록할까요?'))return;
 busy=true;const b=ev.target.querySelector('[type="submit"]');b.disabled=true;
 let ok=false;try{const photo=await photoBase64(f.get('photo'));if(accountToken()!==t)throw Error('다시 로그인해 주세요.');const r=await companionRpc(photo?'nagachi_community_post_photo':'nagachi_community_post',photo?{...args,p_photo:photo}:args,t);ok=r.ok&&Number(r.data)>0}catch(err){say(err.message||'사진을 처리하지 못했습니다.');busy=false;b.disabled=false;return}
 busy=false;b.disabled=false;
 if(ok){say('이야기를 등록했습니다.');filter='all';view='list';selected=null;await load()}
 else say('등록하지 못했습니다. 입력 내용과 연결 상태를 확인해 주세요.');
});
let last=accountToken();
setInterval(()=>{const t=accountToken();if(t!==last){last=t;admin=false;manage=false;mine.clear();engagement.clear();commentQueue.clear();rows=[];loaded=false;loading=true;go('list',null,false);void load()}},5000);
draw();void load();
