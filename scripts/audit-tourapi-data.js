import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditTourApiPlaces } from './tourapi-quality.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = resolve(root, process.env.TOUR_API_AUDIT_SOURCE || 'data/places.json');
const reportPath = resolve(root, process.env.TOUR_API_AUDIT_REPORT || 'data/tourapi-quality-report.json');
const topLimit = Math.min(100, Math.max(1, Number(process.env.TOUR_API_AUDIT_TOP) || 60));

const places = JSON.parse(await readFile(sourcePath, 'utf8'));
const { summary, audited, candidates } = auditTourApiPlaces(places);

const report = {
  generatedAt: new Date().toISOString(),
  source: sourcePath.replace(root + '/', ''),
  summary,
  topCandidates: candidates.slice(0, topLimit),
  courses: audited.filter(item => item.role === 'course'),
  facilities: audited.filter(item => item.role === 'facility'),
  sourceOnly: audited.filter(item => item.status === 'source_only'),
};

await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');

console.log(`TourAPI 품질 점검 완료: ${summary.total}개`);
console.log(`- 추천 후보: ${(summary.byStatus.candidate || 0) + (summary.byStatus.review || 0)}개`);
console.log(`- 코스 별도 검토: ${summary.byStatus.review_course || 0}개`);
console.log(`- 원천 데이터만 보관: ${summary.byStatus.source_only || 0}개`);
console.log(`- 한국 좌표 범위 오류: ${summary.invalidCoordinate}개`);
console.log(`- 주소 누락: ${summary.missingAddress}개`);
console.log(`- 편안함 근거 0개: ${summary.comfortUnknown}개`);
console.log(`리포트: ${reportPath.replace(root + '/', '')}`);
