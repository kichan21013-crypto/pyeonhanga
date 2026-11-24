/* Supabase Kakao OAuth PKCE, same-origin tab session. No provider secret in client. */
import config from '../config.js';
import {companionRpc,cleanGroupActivities} from './v19-companion-service.js';
const KEY='nagachi.v40.auth', VERIFIER='nagachi.v40.pkce', PENDING='nagachi.v40.pending';
export const configured=/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(config.supabaseUrl||'')&&!!config.supabaseAnonKey;
function get(k){try{return JSON.parse(sessionStorage.getItem(k)||'null')}catch{return null}}
function put(k,v){try{sessionStorage.setItem(k,JSON.stringify(v));return true}catch{return false}}
function del(k){try{sessionStorage.removeItem(k)}catch{}}
export function accountToken(){const s=get(KEY);if(!s||typeof s.token!=='string'||!Number.isFinite(s.expires)||s.expires<=Date.now()+10000){del(KEY);return null}return s.token}
export function pendingActivities(){return cleanGroupActivities(get(PENDING))}
export function rememberActivities(a){return put(PENDING,cleanGroupActivities(a))}
export function clearPending(){del(PENDING)}
export function forgetAccount(){del(KEY);del(VERIFIER);del(PENDING)}
const b64=b=>btoa(String.fromCharCode(...b)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
export async function startKakaoLogin(){
 if(!configured||!globalThis.crypto?.subtle)throw Error('로그인 서버 연결이 필요합니다.');
 const verifier=b64(crypto.getRandomValues(new Uint8Array(48)));
 const challenge=b64(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))));
 if(!put(VERIFIER,{value:verifier,at:Date.now()}))throw Error('브라우저 저장 공간을 허용해 주세요.');
 const url=new URL(config.supabaseUrl+'/auth/v1/authorize');
 url.search=new URLSearchParams({provider:'kakao',redirect_to:location.origin+'/account.html',code_challenge:challenge,code_challenge_method:'s256'}).toString();
 location.assign(url.href);
}
export async function finishKakaoLogin(){
 const q=new URLSearchParams(location.search),code=q.get('code'),error=q.has('error')||q.has('error_code')||location.hash.includes('error=');
 if(!code&&!error)return {callback:false,ok:true};
 history.replaceState(null,'','/account.html');
 const v=get(VERIFIER);del(VERIFIER);del(KEY);
 if(error||!configured||!code||!v||typeof v.value!=='string'||Date.now()-v.at>600000)return {callback:true,ok:false};
 try{
 const r=await fetch(config.supabaseUrl+'/auth/v1/token?grant_type=pkce',{method:'POST',headers:{apikey:config.supabaseAnonKey,'Content-Type':'application/json'},body:JSON.stringify({auth_code:code,code_verifier:v.value}),signal:AbortSignal.timeout(10000)});
 if(!r.ok)return {callback:true,ok:false};
 const d=await r.json(),seconds=Number(d.expires_in);
 if(typeof d.access_token!=='string'||!Number.isFinite(seconds)||seconds<=0||!put(KEY,{token:d.access_token,expires:Date.now()+Math.min(seconds,3600)*1000}))return {callback:true,ok:false};
 return {callback:true,ok:true};
 }catch{return {callback:true,ok:false}}
}
export async function accountRole(){const t=accountToken();if(!t)return {ok:false,reason:'login'};return companionRpc('nagachi_account_is_admin',{},t)}
export async function saveAccountActivities(activities){
 const t=accountToken();if(!t)return {ok:false,reason:'login'};
 const r=await companionRpc('nagachi_account_subscribe',{p_activities:cleanGroupActivities(activities)},t);
 if(accountToken()!==t)return {ok:false,reason:'login'};
 if(r.ok&&r.data===true){clearPending();return {ok:true}}return {ok:false,reason:r.reason||'server'};
}
export async function accountSetupIdentity(){
 const t=accountToken();if(!t)return {ok:false,reason:'login'};
 try{
  const r=await fetch(config.supabaseUrl+'/auth/v1/user',{headers:{apikey:config.supabaseAnonKey,Authorization:'Bearer '+t},signal:AbortSignal.timeout(7000)});
  if(!r.ok||accountToken()!==t)return {ok:false,reason:'login'};
  const u=await r.json();
  if(accountToken()!==t||!(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(u.id||'')))return {ok:false,reason:'identity'};
  return {ok:true,id:u.id};
 }catch{return {ok:false,reason:'offline'}}
}
export async function readAccountNews(){const t=accountToken();return t?companionRpc('nagachi_account_news',{},t):{ok:false,reason:'login'}}
export async function signOutAccount(){
 const t=accountToken();forgetAccount();
 if(t)try{await fetch(config.supabaseUrl+'/auth/v1/logout?scope=local',{method:'POST',headers:{apikey:config.supabaseAnonKey,Authorization:'Bearer '+t},signal:AbortSignal.timeout(5000)})}catch{}
}
