/* 나가치 v16: "같이 갈 사람?" -> 실제 장소 -> 동행 희망.
 * 장소는 한국관광공사 수집 데이터만 사용하며 확정 모집/운송/영업시간을 주장하지 않습니다.
 */
export const TOGETHER_INVITES=Object.freeze([
  {id:'eat',icon:'🍲',label:'같이 맛있는 거 먹으러 갈 사람?',short:'맛있는 거 먹으러',help:'어떤 메뉴가 끌리세요?',tone:'peach',activity:'food',desire:'eat',category:'맛집'},
  {id:'hike',icon:'🥾',label:'주말에 산행 같이할 사람?',short:'산행하러',help:'걸음이 맞는 사람과 함께',tone:'sage',activity:'hike',desire:'outdoor',category:'나들이'},
  {id:'outing',icon:'☕',label:'산책하고 카페 갈 사람?',short:'산책·나들이',help:'가볍게 걷고 이야기 나누기',tone:'lilac',activity:'outing',desire:'explore',category:'나들이'},
  {id:'travel',icon:'🚙',label:'근교 나들이 함께 갈 사람?',short:'근교 나들이',help:'하루를 천천히 즐기기',tone:'blue',activity:'travel',desire:'explore',category:'여행'},
]);
export const TOGETHER_REGIONS=Object.freeze(['서울','경기','강릉','경주','부산','제주']);
export const MEAL_TAGS=Object.freeze([
  {id:'',label:'모든 음식'},
  {id:'seafood',label:'회·해산물'},
  {id:'korean_food',label:'한식'},
  {id:'meat',label:'고기'},
  {id:'noodle',label:'면요리'},
]);
export function invitationById(id){return TOGETHER_INVITES.find(item=>item.id===id)||null;}
export function cleanTogetherRegion(value){return TOGETHER_REGIONS.includes(value)?value:'';}
export function cleanMealTag(value){return MEAL_TAGS.some(x=>x.id===value)?value:'';}
export function togetherPlaceMatches(place,{interest='',region='',mealTag=''}={}){
  if(!place || place.isDemo || typeof place.image!=='string' || !/^https:\/\//.test(place.image))return false;
  if(region && place.region!==region)return false;
  const tags=Array.isArray(place.intentTags)?place.intentTags:[];
  if(interest==='eat')return place.category==='맛집' && (!mealTag || tags.includes(mealTag));
  if(interest==='hike')return tags.includes('hike') || tags.includes('trail');
  if(interest==='outing')return (place.category==='나들이'||place.category==='여행') &&
    tags.some(tag=>['walk','outing','culture','scenery'].includes(tag));
  if(interest==='travel')return place.category==='여행'||tags.some(tag=>['drive','travel'].includes(tag));
  return false;
}
