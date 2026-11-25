// External places are manually verified links, never scraped photos or ratings.
const externalId=/^ext-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export function mapLink(raw){
 if(typeof raw!=='string'||raw.length>1000||/[\s\\\x00-\x1f\x7f]/.test(raw))return null;
 if(/^https:\/\/(?:map\.naver\.com|place\.map\.naver\.com|m\.place\.naver\.com|naver\.me)(?:\/|$)/.test(raw))return {url:raw,provider:'네이버 지도'};
 if(/^https:\/\/(?:maps\.app\.goo\.gl|maps\.google\.com)(?:\/|$)/.test(raw)||/^https:\/\/(?:www\.google\.com|google\.com)\/maps(?:\/|\?|$)/.test(raw))return {url:raw,provider:'구글 지도'};
 return null;
}
export function externalPlace(row){
 if(!row||!externalId.test(row.id||'')||typeof row.name!=='string'||!row.name.trim()||typeof row.address!=='string'||!row.address.trim())return null;
 const link=mapLink(row.map_url);if(!link)return null;
 return {id:row.id,name:row.name,address:row.address,region:row.region,category:row.category,external:true,map_url:link.url,provider:link.provider,source:row.source==='geoapify'?'geoapify':'manual'};
}
export const isExternalId=id=>externalId.test(id||'');
