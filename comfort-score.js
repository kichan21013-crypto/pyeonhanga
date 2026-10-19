// 각 값은 'good' | 'moderate' | 'poor' | 'unknown'. 실제 확인한 근거가 있을 때만 채웁니다.
export const WEIGHTS = {
  default: { parking: 15, stairs: 15, accessibility: 10, restroom: 10, seating: 15, walking: 15, noise: 10, waiting: 10 },
  '50s': { parking: 15, stairs: 10, accessibility: 10, restroom: 10, seating: 15, walking: 15, noise: 10, waiting: 15 },
  '60s': { parking: 15, stairs: 15, accessibility: 10, restroom: 10, seating: 15, walking: 15, noise: 10, waiting: 10 },
  '70plus': { parking: 10, stairs: 20, accessibility: 15, restroom: 10, seating: 15, walking: 20, noise: 5, waiting: 5 },
};
export const COMFORT_LABELS = { parking: '주차', stairs: '계단', accessibility: '접근성', restroom: '화장실', seating: '좌석', walking: '보행부담', noise: '소음', waiting: '대기' };
export const VALUE_LABELS = {
  parking: ['주차 편함', '주차 조건 확인', '주차 불편'], stairs: ['계단 없음', '일부 계단 있음', '계단 부담 있음'],
  accessibility: ['출입 편함', '일부 접근 제약', '접근 제약 있음'], restroom: ['이용 편함', '이용 조건 확인', '이용 불편'],
  seating: ['편안한 좌석', '좌석 조건 확인', '좌석 부담 있음'], walking: ['걷기 부담 적음', '어느 정도 걸어요', '많이 걸어요'],
  noise: ['조용한 편', '보통', '소음 있음'], waiting: ['대기 적음', '대기할 수 있어요', '대기 긴 편'],
};
export function comfortText(key, value) {
  const i = ['good', 'moderate', 'poor'].indexOf(value);
  return i < 0 ? '아직 확인하지 못했어요' : VALUE_LABELS[key][i];
}
export function calculateComfort(comfort = {}, profile = 'default') {
  const weights = WEIGHTS[profile] || WEIGHTS.default;
  let known = 0, earned = 0;
  const points = { good: 1, moderate: 0.5, poor: 0 };
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  for (const [key, weight] of Object.entries(weights)) {
    const field = comfort[key];
    // 출처 없는 값과 메모만 있는 값은 계산하지 않습니다.
    if (field && Object.hasOwn(points, field.value) && field.sourceUrl && field.verifiedAt) {
      known += weight; earned += weight * points[field.value];
    }
  }
  const coverage = known / total;
  return { score: coverage < 0.4 ? null : Math.round(earned / known * 100), coverage,
    confidence: coverage >= 0.8 ? '높음' : coverage >= 0.6 ? '보통' : '낮음',
    label: coverage < 0.4 ? '정보 더 필요' : '정보 기반 편안함' };
}
