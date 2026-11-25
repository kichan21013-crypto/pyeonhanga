// External places are manually verified links, never scraped photos or ratings.
const externalId=/^ext-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export function mapLink(raw){
 if(typeof raw!=='string'||raw.length>1000||/\s/.test(raw))return null;
 try{
  const u=new URL(raw);if(u.protocol!=='https:'||u.username||u.password||u.port)return null;
  const h=u.hostname;
  if(['map.naver.com','place.map.naver.com','m.place.naver.com','naver.me'].includes(h))return {url:u.href,provider:'네이버 지도'};
  if(['maps.app.goo.gl','maps.google.com'].includes(h)||(['www.google.com','google.com'].includes(h)&&/^\/maps(?:\/|$)/.test(u.pathname)))return {url:u.href,provider:'구글 지도'};
 }catch{}
 return null;
}
export function externalPlace(row){
 if(!row||!externalId.test(row.id||'')||typeof row.name!=='string'||!row.name.trim()||typeof row.address!=='string'||!row.address.trim())return null;
 const link=mapLink(row.map_url);if(!link)return null;
 return {id:row.id,name:row.name,address:row.address,region:row.region,category:row.category,external:true,map_url:link.url,provider:link.provider};
}
export const isExternalId=id=>externalId.test(id||'');
