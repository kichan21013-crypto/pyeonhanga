import { emptyRhythmFilters } from '../rhythm.js';

// 하나의 화면에는 하나의 활동 선택 상태만 있습니다.
// '기분 따라 고르기'와 빠른 선택을 서로 눌러 동기화하지 않습니다.
export const BROWSE_CATEGORIES = Object.freeze([
  { id:'seafood', label:'회·해산물', emoji:'🐟', tone:'coral', desire:'eat' },
  { id:'korean_food', label:'한식', emoji:'🍚', tone:'peach', desire:'eat' },
  { id:'meat', label:'고기', emoji:'🥩', tone:'rose', desire:'eat' },
  { id:'noodle', label:'면요리', emoji:'🍜', tone:'yellow', desire:'eat' },
  { id:'cafe', label:'카페', emoji:'☕', tone:'latte', desire:'rest' },
  { id:'walk', label:'산책', emoji:'🌿', tone:'mint', desire:'outdoor' },
  { id:'drive', label:'드라이브', emoji:'🚙', tone:'sky', desire:'explore' },
  { id:'outing', label:'나들이', emoji:'🏞️', tone:'lilac', desire:'explore' },
]);

export function toggleBrowseCategory(current, clicked) {
  if (!BROWSE_CATEGORIES.some(item => item.id === clicked)) return current || null;
  return current === clicked ? null : clicked;
}

export function createBrowseFilters({ activity = null, region = '', query = '', broadCategory = '' } = {}) {
  const filters = emptyRhythmFilters();
  const selected = BROWSE_CATEGORIES.find(item => item.id === activity);
  if (selected) {
    filters.desires = [selected.desire];
    filters.activities = [selected.id];
  }
  filters.region = ['서울','경기','강릉','경주','부산','제주'].includes(region) ? region : '';
  filters.query = typeof query === 'string' ? query.trim().slice(0,160) : '';
  filters.category = !selected && ['맛집','나들이','여행'].includes(broadCategory) ? broadCategory : 'auto';
  filters.allowActivityFallback = false;
  return filters;
}

export function browseHeading({activity = null, region = '', broadCategory = ''} = {}) {
  const label = BROWSE_CATEGORIES.find(item => item.id === activity)?.label || broadCategory || '전체 장소';
  return region ? `${region} · ${label}` : label;
}
