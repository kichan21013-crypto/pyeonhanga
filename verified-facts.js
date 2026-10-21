const clean = value => String(value || '').replace(/\s+/g,' ').trim();

const barrierLabels = {
  parking: '무장애 주차', route: '이동 경로', publictransport: '대중교통', wheelchair: '휠체어', exit: '출입구',
  elevator: '엘리베이터', restroom: '무장애 화장실', stroller: '유모차', lactationroom: '수유실', helpdog: '보조견',
};

export function verifiedFactItems(place) {
  const facts = place?.verifiedFacts;
  if (!facts) return [];
  const g = facts.general || {};
  const items = [];
  const add = (label, value, kind='general') => { const text = clean(value); if (text) items.push({ label, text, kind }); };
  add('주차', g.parkingText);
  add('이용시간', g.operatingHoursText);
  add('휴무', g.restDayText);
  add('화장실', g.restroomText);
  add('이용요금', g.feeText);
  add('대표메뉴', g.firstMenuText);
  add('메뉴', g.menuText);
  add('좌석', g.seatText);
  add('예약', g.reservationText);
  const barrier = facts.barrierFree || {};
  for (const [key,label] of Object.entries(barrierLabels)) add(label, barrier[key], 'barrier');
  return items;
}

export function verifiedFactBadges(place, limit = 3) {
  const preferred = verifiedFactItems(place).filter(item => ['주차','화장실','무장애 주차','이동 경로','출입구','무장애 화장실','이용시간'].includes(item.label));
  return preferred.slice(0, limit);
}

export function verifiedRecommendationReason(place) {
  const items = verifiedFactItems(place);
  if (!items.length) return '';
  const labels = new Set(items.map(item => item.label));
  const pair = (...wanted) => wanted.every(label => labels.has(label));

  if (pair('주차','이용시간')) return '주차와 이용시간 정보를 확인해 두었어요';
  if (pair('이용시간','휴무')) return '이용시간과 휴무 정보를 확인해 두었어요';
  if (pair('대표메뉴','이용시간')) return '대표메뉴와 이용시간 정보를 확인해 두었어요';

  const barrier = items.filter(item => item.kind === 'barrier').slice(0,2).map(item => item.label);
  if (barrier.length >= 2) return `${barrier.join('·')} 정보를 확인해 두었어요`;

  const preferred = ['주차','이용시간','휴무','화장실','대표메뉴','이용요금'].filter(label => labels.has(label)).slice(0,2);
  if (preferred.length) return `${preferred.join('·')} 정보를 확인해 두었어요`;
  return `${items[0].label} 정보를 확인해 두었어요`;
}
