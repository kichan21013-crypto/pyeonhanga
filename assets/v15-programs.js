/* NAGACHI v15 — illustrative party programmes, NOT live recruitment.
   Prices, dates, seats, member counts, and transport inventory are NOT asserted. */
export const PROGRAMS=Object.freeze([
 {id:'program-food',interest:'eat',title:'맛있는 하루 · 미식 동행',icon:'🍲',category:'식사·미식',tone:'peach',summary:'음식을 좋아하는 사람들과 한 끼 식사하고 편안하게 이야기 나누는 하루',
  outline:['모이기 편한 장소에서 만나기','취향에 맞는 식사','여유로운 카페와 대화'],group:'소규모(기획 예시)',transport:'개별 이동 및 현장 결제',purpose:'식사동행'},
 {id:'program-hike',interest:'hike',title:'자연 속 하루 · 산행 동행',icon:'🥾',category:'산행·트레킹',tone:'sage',summary:'걷는 속도와 체력을 고려해 무리 없이 함께 걷는 취향 모임',
  outline:['난이도와 코스 사전 안내','함께 걷는 트레킹','식사 또는 휴식'],group:'소규모(기획 예시)',transport:'집합장소 안내 · 적법한 교통수단 이용',purpose:'취미친구'},
 {id:'program-outing',interest:'outing',title:'취향 따라 · 나들이 동행',icon:'🎨',category:'전시·산책',tone:'lilac',summary:'전시와 산책, 카페를 좋아하는 사람들끼리 취향을 나누는 모임',
  outline:['취향에 맞는 전시·문화 공간','가볍게 산책','카페에서 자유로운 대화'],group:'소규모(기획 예시)',transport:'개별 이동 · 현장 비용 각자 결제',purpose:'나들이동행'},
 {id:'program-travel',interest:'travel',title:'함께 떠나는 · 당일여행 동행',icon:'🗺️',category:'근교·당일여행',tone:'blue',summary:'비슷한 여행 취향을 가진 사람과 근교 코스를 즐길 하루',
  outline:['당일 코스 및 집합 안내','풍경과 휴식이 있는 일정','각자의 선택을 존중하는 자유 시간'],group:'소규모(기획 예시)',transport:'교통은 허가된 업체·수단 또는 직접 이용',purpose:'여행동행'},
]);
export const PROGRAM_IDS=Object.freeze(PROGRAMS.map(p=>p.id));
export function programById(id){return PROGRAMS.find(p=>p.id===id)||null;}
export function programContext(program){
  if(!program) return null;
  // Interim validated analytics bridge: current DB stores required place_id as text.
  // Prefixed programme IDs are distinct from real Tourism API venue IDs.
  return {id:program.id,name:program.title,region:null,category:null,isDemo:false};
}
