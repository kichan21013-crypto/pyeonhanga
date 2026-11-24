/* 오늘의 인기 동행: 실제 동의·저장된 관심만 순위화합니다.
 * 모집/예약 확정이나 별점/좋아요 데이터를 만들지 않습니다.
 */
export const POPULAR_ACTIVITIES=Object.freeze([
 {id:'food',invite:'eat',name:'맛있는 한 끼',tag:'식사 동행',image:'v18-eat.svg'},
 {id:'hike',invite:'hike',name:'주말 산행',tag:'함께 걷기',image:'v18-hike.svg'},
 {id:'outing',invite:'outing',name:'산책·카페',tag:'가벼운 동행',image:'v18-outing.svg'},
 {id:'travel',invite:'travel',name:'근교 나들이',tag:'하루 나들이',image:'v18-travel.svg'},
]);
const supported = new Map(POPULAR_ACTIVITIES.map(x=>[x.id,x]));
const count=value=>{
 const n=Number(value);
 return Number.isSafeInteger(n)&&n>=5?n:null;
};
// 등록된 관광공사 장소 사진/주소만 연결. DB에 없는 장소/모임은 만들지 않음.
export function normalizePopularPlaces(rows,catalog,limit=6){
 if(!Array.isArray(rows)||!Array.isArray(catalog))return [];
 const places=new Map(catalog.filter(p=>p&&typeof p.id==='string').map(p=>[p.id,p]));
 const sorted=[];
 for(const row of rows){
  if(!row||!supported.has(row.activity)||typeof row.place_id!=='string')continue;
  const n=count(row.interested_count);
  const p=places.get(row.place_id);
  if(!n||!p||p.isDemo||typeof p.image!=='string'||!p.image.startsWith('https://'))continue;
  sorted.push({place:p,activity:supported.get(row.activity),interestedCount:n});
 }
 sorted.sort((a,b)=>b.interestedCount-a.interestedCount||a.place.name.localeCompare(b.place.name,'ko'));
 const seen=new Set();
 return sorted.filter(item=>{
  if(seen.has(item.place.id))return false;
  seen.add(item.place.id);
  return true;
 }).slice(0,limit);
}
export function rankPopularActivities(rawCounts){
 const counts=rawCounts&&typeof rawCounts==='object'?rawCounts:{};
 return POPULAR_ACTIVITIES
  .map(item=>({...item,interestedCount:count(counts[item.id])}))
  .filter(item=>item.interestedCount!==null)
  .sort((a,b)=>b.interestedCount-a.interestedCount||POPULAR_ACTIVITIES.indexOf(supported.get(a.id))-POPULAR_ACTIVITIES.indexOf(supported.get(b.id)));
}
export function choosePopularView({places=[],activities=[]}={}){
 if(places.length)return 'places';
 if(activities.length)return 'activities';
 return 'discovery';
}
