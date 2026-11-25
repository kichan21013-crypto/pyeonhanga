// Operator-only lookup. No third-party key or user token returned to the browser.
const origin='https://pyeonhanga.kichan21013.workers.dev';
const cors={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin','Cache-Control':'no-store'};
const reply=(status,body)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST'||req.headers.get('origin')&&req.headers.get('origin')!==origin)return reply(405,{error:'method'});
 const auth=req.headers.get('authorization')||'';
 if(!/^Bearer [A-Za-z0-9._-]+$/.test(auth))return reply(401,{error:'login'});
 const url=Deno.env.get('SUPABASE_URL'),anon=Deno.env.get('SUPABASE_ANON_KEY');
 if(!url||!anon)return reply(503,{error:'server'});
 const rpc=async name=>fetch(url+'/rest/v1/rpc/'+name,{method:'POST',headers:{Authorization:auth,apikey:anon,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(5000)});
 try{
  const role=await rpc('nagachi_account_is_admin');
  if(!role.ok||await role.json()!==true)return reply(403,{error:'forbidden'});
  const key=Deno.env.get('GEOAPIFY_API_KEY');if(!key)return reply(503,{error:'not-configured'});
  const raw=await req.text();if(raw.length>1000)return reply(400,{error:'query'});
  const body=JSON.parse(raw);const q=typeof body.query==='string'?body.query.trim():'';
  if(q.length<2||q.length>100||/[\x00-\x1f\x7f]/.test(q))return reply(400,{error:'query'});
  const quota=await rpc('nagachi_admin_claim_place_search');
  if(!quota.ok)return reply(403,{error:'forbidden'});
  if(await quota.json()!==true)return reply(429,{error:'quota'});
  const params=new URLSearchParams({text:q,filter:'countrycode:kr',lang:'ko',format:'json',limit:'5',apiKey:key});
  const result=await fetch('https://api.geoapify.com/v1/geocode/search?'+params,{signal:AbortSignal.timeout(8000)});
  if(!result.ok)return reply(502,{error:'provider'});
  const data=await result.json();
  const rows=Array.isArray(data.results)?data.results:[];
  const items=rows.filter(x=>x&&x.country_code==='kr'&&typeof x.name==='string'&&x.name.trim()&&typeof x.formatted==='string'&&x.formatted.trim()&&Number.isFinite(x.lat)&&Number.isFinite(x.lon)&&x.lat>=33&&x.lat<=39&&x.lon>=124&&x.lon<=132&&x.datasource?.sourcename==='openstreetmap').slice(0,5).map(x=>({name:x.name.slice(0,100),address:x.formatted.slice(0,240),lat:x.lat,lon:x.lon}));
  return reply(200,{items});
 }catch{return reply(502,{error:'connection'});}
});
