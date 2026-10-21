const clean = value => String(value || '').replace(/\s+/g, ' ').trim();

function has(value) {
  return clean(value).length > 0;
}

function repeatedFacts(item = {}) {
  let restroom = false;
  let fee = false;
  for (const row of item.repeatedInfo || []) {
    const name = clean(row.infoname);
    const text = clean(row.infotext);
    if (!text) continue;
    if (/화장실/.test(name)) restroom = true;
    if (/입\s*장\s*료|이용요금|요금/.test(name)) fee = true;
  }
  return { restroom, fee };
}

function parseTourDate(value) {
  const raw = String(value || '');
  const compact = raw.match(/^(\d{4})(\d{2})(\d{2})/);
  if (compact) return new Date(`${compact[1]}-${compact[2]}-${compact[3]}T00:00:00Z`);
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function freshnessScore(modifiedTime, referenceDate) {
  const modified = parseTourDate(modifiedTime);
  const reference = parseTourDate(referenceDate);
  if (!modified || !reference) return 0;
  const days = Math.max(0, (reference - modified) / 86400000);
  if (days <= 90) return 15;
  if (days <= 180) return 12;
  if (days <= 365) return 9;
  if (days <= 730) return 5;
  return 2;
}

export function scoreRecommendationReadiness({ place = {}, audit = {}, detail = null, barrier = null, referenceDate = null } = {}) {
  const facts = detail?.facts || {};
  const repeated = repeatedFacts(detail || {});

  let operational = 0;
  if (has(facts.operatingHoursText)) operational += 10;
  if (has(facts.restDayText)) operational += 5;
  if (has(facts.parkingText)) operational += 8;
  if (has(facts.infoCenterText)) operational += 4;
  if (has(facts.reservationText)) operational += 2;
  if (has(facts.seatText)) operational += 2;
  if (repeated.restroom) operational += 2;
  if (repeated.fee) operational += 2;

  const knownBarrierFields = Number(barrier?.completeness?.knownFields || 0);
  const accessibility = Math.min(15, knownBarrierFields * 3);

  let detailQuality = 0;
  if (has(facts.overview)) detailQuality += 6;
  if (has(facts.homepage)) detailQuality += 3;
  if (has(facts.telephone)) detailQuality += 3;
  if ((detail?.images || []).length > 0) detailQuality += 3;

  const visual = audit?.hasRealImage || place?.tourApi?.imageSourceUrl ? 10 : 0;
  const freshness = freshnessScore(detail?.modifiedTime || place?.tourApi?.modifiedTime, referenceDate);
  const sourceQuality = Math.round(Math.max(0, Math.min(100, Number(audit?.score || 0))) / 10);

  const score = Math.max(0, Math.min(100, operational + accessibility + detailQuality + visual + freshness + sourceQuality));
  const signals = [];
  if (has(facts.operatingHoursText)) signals.push('이용시간 확인');
  if (has(facts.restDayText)) signals.push('휴무 정보 확인');
  if (has(facts.parkingText)) signals.push('주차 정보 확인');
  if (knownBarrierFields > 0) signals.push(`무장애 ${knownBarrierFields}항목 확인`);
  if (has(facts.overview)) signals.push('상세 설명 확인');
  if ((detail?.images || []).length > 0) signals.push('추가 이미지 확인');

  return {
    score,
    factors: {
      operational,
      accessibility,
      detail: detailQuality,
      visual,
      freshness,
      source: sourceQuality,
    },
    signals,
  };
}
