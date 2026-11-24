/* 나가치 운영자 수익 예상치 / 코스 장소 선택의 순수 검증 도우미.
   계산은 목표/가정이며 매출, 거래, 예치금 등 실제 결제 결과가 아닙니다. */
export const ADMIN_ACTIVITY_LABELS=Object.freeze({
 food:'맛있는 한 끼',hike:'함께 산행',outing:'산책·카페',travel:'근교 나들이'
});
export const MEETUP_STAGE_LABELS=Object.freeze({
 draft:'내 초안',planning:'모임 구성 준비',announced:'준비 소식 공개',closed:'마감'
});
export function estimateRevenue(input={}){
 const fee=Number(input.service_fee_krw);
 const people=Number(input.expected_people);
 const meetings=Number(input.meetings_per_month);
 const conversion=Number(input.paid_conversion_pct);
 const cost=Number(input.cost_per_meeting_krw);
 if(![fee,people,meetings,conversion,cost].every(Number.isFinite)
   ||fee<0||fee>100000||people<2||people>30||meetings<1||meetings>20
   ||conversion<0||conversion>100||cost<0||cost>3000000)
   return null;
 const expectedPaying=people*meetings*conversion/100;
 const expectedRevenue=Math.round(expectedPaying*fee);
 const estimatedCosts=meetings*cost;
 return {
  expectedPaying,expectedRevenue,estimatedCosts,
  estimateAfterCosts:expectedRevenue-estimatedCosts
 };
}
export function cleanCoursePlaceIds(ids,allowed=new Set()){
 if(!Array.isArray(ids))return [];
 return [...new Set(ids.filter(id=>typeof id==='string'&&allowed.has(id)))].slice(0,5);
}
export function safePublicMeetupStatus(stage){
 return stage==='announced'?'모임 준비 소식':'준비 중';
}

export function sanitizePublicCourses(rows,catalog){
 if(!Array.isArray(rows)||!Array.isArray(catalog))return [];
 const places=new Map(catalog.filter(p=>p&&typeof p.id==='string'&&!p.isDemo).map(p=>[p.id,p]));
 return rows.filter(c=>c&&Number.isSafeInteger(Number(c.id))&&Number(c.id)>0
   &&typeof c.title==='string'&&typeof c.description==='string'
   &&['food','hike','outing','travel'].includes(c.activity)
   &&Array.isArray(c.place_ids)&&c.place_ids.length>0)
   .map(c=>({...c,places:c.place_ids.map(id=>places.get(id)).filter(Boolean)}))
   .filter(c=>c.places.length>0).slice(0,12);
}
