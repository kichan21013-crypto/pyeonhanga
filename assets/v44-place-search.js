import config from '../config.js';
export function generatedMapLink(name,address,provider='google'){
 const q=[name,address].map(x=>String(x||'').trim()).filter(Boolean).join(' ');
 if(q.length<2)return '';
 return provider==='naver'?'https://map.naver.com/p/search/'+encodeURIComponent(q):'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(q);
}
export function searchCandidates(data){
 if(!Array.isArray(data?.items))return [];
 return data.items.filter(x=>x&&typeof x.name==='string'&&x.name.trim()&&x.name.length<=100&&typeof x.address==='string'&&x.address.trim()&&x.address.length<=240&&Number.isFinite(x.lat)&&Number.isFinite(x.lon)&&x.lat>=33&&x.lat<=39&&x.lon>=124&&x.lon<=132).slice(0,5);
}
export async function lookupPlaces(query,token){
 if(!token||!config.supabaseUrl||!config.supabaseAnonKey)return {ok:false,error:'login'};
 try{
  const r=await fetch(config.supabaseUrl+'/functions/v1/nagachi-place-search',{method:'POST',headers:{Authorization:'Bearer '+token,apikey:config.supabaseAnonKey,'Content-Type':'application/json'},body:JSON.stringify({query}),signal:AbortSignal.timeout(15000)});
  const data=await r.json();
  return r.ok?{ok:true,items:searchCandidates(data)}:{ok:false,error:data.error||'connection'};
 }catch{return {ok:false,error:'connection'};}
}
