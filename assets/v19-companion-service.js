/* 나가치 동행 관심 그룹 | 공개 집계(5+), 앱 내 구독, 관리자 RPC.
 * Supabase public key만 사용. service_role 또는 관리자 비밀번호를 보관하지 않습니다.
 * 미연결/미설치/오류는 빈 숫자로 가장하지 않고 구분해 반환합니다.
 */
import config from '../config.js';
import { analyticsEnabled } from '../analytics.js';
import { readLocal, writeLocal } from '../storage.js';
export const GROUP_ACTIVITIES = Object.freeze([
 {id:'food',label:'맛있는 한 끼'},
 {id:'hike',label:'함께 산행'},
 {id:'outing',label:'산책·카페'},
 {id:'travel',label:'근교 나들이'},
]);
const allowed = new Set(GROUP_ACTIVITIES.map(x=>x.id));
const TOKEN_KEY='nagachi.news-token';
const hex=/^[0-9a-f]{64}$/;
const headers=auth=>{
  const h={'Content-Type':'application/json','apikey':config.supabaseAnonKey};
  if(auth)h.Authorization='Bearer '+auth;
  else if(!config.supabaseAnonKey.startsWith('sb_publishable_')) h.Authorization='Bearer '+config.supabaseAnonKey;
  return h;
};
export async function companionRpc(name,args={},auth=null){
  if(!analyticsEnabled)return {ok:false,reason:'unconfigured'};
  try{
    const res=await fetch(config.supabaseUrl+'/rest/v1/rpc/'+name,{
      method:'POST',headers:headers(auth),body:JSON.stringify(args),
      signal:AbortSignal.timeout(7000),
    });
    if(!res.ok)return {ok:false,reason:res.status===404?'not-installed':res.status===401||res.status===403?'forbidden':'server'};
    const body=await res.text();
    return {ok:true,data:body?JSON.parse(body):null};
  }catch{return {ok:false,reason:'offline'};}
}
export function cleanGroupActivities(values){
 if(!Array.isArray(values))return [];
 return [...new Set(values.filter(x=>allowed.has(x)))].slice(0,4);
}
export async function fetchPublicInterestCounts(){
 const result=await companionRpc('nagachi_public_interest_counts');
 if(!result.ok)return result;
 const counts={};
 for(const row of Array.isArray(result.data)?result.data:[]){
   if(allowed.has(row.activity)&&Number.isSafeInteger(Number(row.interest_count))&&Number(row.interest_count)>=5)
     counts[row.activity]=Number(row.interest_count);
 }
 return {ok:true,counts};
}
export async function fetchPopularCompanionPlaces(){
 const result=await companionRpc('nagachi_public_popular_places');
 if(!result.ok)return result;
 // 정확한 순위는 서버의 저장된 동의 데이터에서만 나옵니다.
 return {ok:true,items:Array.isArray(result.data)?result.data:[]};
}
export function localSubscriptionToken(){
 const token=readLocal(TOKEN_KEY,'');
 return typeof token==='string' && hex.test(token)?token:'';
}
function newSecretToken(){
 const bytes=new Uint8Array(32);
 if(!globalThis.crypto?.getRandomValues)throw new Error('Secure browser required');
 globalThis.crypto.getRandomValues(bytes);
 return [...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');
}
export async function optInCompanionUpdates(responseId,activities){
 const interests=cleanGroupActivities(activities);
 if(!/^[0-9a-f-]{36}$/.test(responseId||'') || !interests.length)
   return {ok:false,reason:'invalid'};
 let token;
 try{token=localSubscriptionToken()||newSecretToken();}
 catch{return {ok:false,reason:'security'};}
 const result=await companionRpc('nagachi_subscribe_updates',{
   p_token:token,p_response_id:responseId,p_activities:interests
 });
 if(result.ok&&result.data===true){
   if(!writeLocal(TOKEN_KEY,token))return {ok:false,reason:'local-storage'};
   document.dispatchEvent(new CustomEvent('nagachi:updates-subscribed'));
   return {ok:true};
 }
 return {ok:false,reason:result.reason||'not-saved'};
}
export async function myCompanionUpdates(){
 const token=localSubscriptionToken();
 if(!token)return {ok:false,reason:'not-subscribed'};
 const result=await companionRpc('nagachi_my_updates',{p_token:token});
 if(!result.ok)return result;
 return {ok:true,items:Array.isArray(result.data)?result.data:[]};
}
export async function stopCompanionUpdates(){
 const token=localSubscriptionToken();
 if(!token)return {ok:false,reason:'not-subscribed'};
 const result=await companionRpc('nagachi_unsubscribe_updates',{p_token:token});
 if(!result.ok||result.data!==true)return {ok:false,reason:result.reason||'server'};
 if(!writeLocal(TOKEN_KEY,''))return {ok:false,reason:'local-storage'};
 document.dispatchEvent(new CustomEvent('nagachi:updates-subscribed'));
 return {ok:true};
}
export async function authenticateCompanionAdmin(email,password){
 if(!analyticsEnabled)return {ok:false,reason:'unconfigured'};
 if(!email||!password)return {ok:false,reason:'missing'};
 try{
  const res=await fetch(config.supabaseUrl+'/auth/v1/token?grant_type=password',{
   method:'POST',headers:headers(),body:JSON.stringify({email,password}),
   signal:AbortSignal.timeout(8000),
  });
  if(!res.ok)return {ok:false,reason:'credentials'};
  const data=await res.json();
  // 메모리에만 보관; 사용자 비밀번호를 앱 저장소/쿼리에 기록하지 않습니다.
  return typeof data.access_token==='string'?{ok:true,token:data.access_token}:{ok:false,reason:'credentials'};
 }catch{return {ok:false,reason:'offline'};}
}
