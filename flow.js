// 화면 진행만 관리합니다. 장소 검색·정렬과 analytics 계약은 변경하지 않습니다.
export function flowAvailability(filters) {
  const intent = Boolean(filters.desires?.length || filters.query?.trim());
  const companions = Boolean(filters.companions?.length);
  // 핵심 선택은 '오늘 무엇이 당기는지' 하나뿐입니다. 동행/시간/이동은 선택 사항입니다.
  return { intent, companions, steps: [true, intent, intent], ready: intent };
}

function prepareQuickFlow(root) {
  const step1 = root.querySelector('#flow-step-1');
  const step2 = root.querySelector('#flow-step-2');
  const step3 = root.querySelector('#flow-step-3');
  if (!step1 || !step2 || !step3) return { step1, quickButton: root.querySelector('#recommend-button') };

  const progress = step1.querySelector('.step-progress');
  if (progress) progress.hidden = true;
  const title = step1.querySelector('#intent-title > span:nth-child(2)');
  if (title) title.textContent = '오늘 뭐 하고 싶으세요?';
  const instruction = step1.querySelector('.step-instruction');
  if (instruction) instruction.textContent = '지금 당기는 것 하나만 골라도 바로 추천해드려요.';

  const oldFinal = step3.querySelector('#recommend-button');
  if (oldFinal) oldFinal.id = 'advanced-recommend-button';

  const quickButton = step1.querySelector('[data-next-step="2"]');
  if (quickButton) {
    quickButton.removeAttribute('data-next-step');
    quickButton.id = 'recommend-button';
    quickButton.type = 'submit';
    quickButton.setAttribute('form', 'search-form');
    quickButton.className = 'button accent full quick-recommend';
    quickButton.innerHTML = '바로 추천 보기 <span aria-hidden="true">→</span>';
    quickButton.hidden = true;
  }

  const refine = document.createElement('details');
  refine.className = 'quick-refine';
  refine.innerHTML = '<summary><span>조금 더 맞춤 추천</span><small>동행 · 시간 · 이동 · 편안함</small></summary><div class="quick-refine-body"></div>';
  const body = refine.querySelector('.quick-refine-body');

  const addGroup = (label, node) => {
    if (!node) return;
    const section = document.createElement('section');
    section.className = 'quick-refine-group';
    const heading = document.createElement('h3');
    heading.textContent = label;
    section.append(heading, node);
    body.append(section);
  };

  addGroup('누구와', step2.querySelector('.companion-choices'));
  const companionHelp = step2.querySelector('#companion-help');
  if (companionHelp) body.append(companionHelp);

  addGroup('시간', step3.querySelector('[aria-labelledby="duration-title"]'));
  addGroup('이동', step3.querySelector('[aria-labelledby="transport-title"]'));

  [...step3.querySelectorAll(':scope > details')].forEach(details => body.append(details));

  const searchForm = step1.querySelector('#search-form');
  if (searchForm) step1.insertBefore(refine, quickButton || null);
  else step1.append(refine);

  step2.remove();
  step3.remove();

  const searchInput = root.querySelector('#search-input');
  searchInput?.addEventListener('keydown', event => {
    if (event.key !== 'Enter' || event.isComposing || !quickButton) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    searchInput.form?.requestSubmit(quickButton);
  }, true);

  return { step1, quickButton };
}

export function createProgressiveFlow(root, { reducedMotion = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? true } = {}) {
  const explore = root.querySelector('#explore');
  const { step1, quickButton } = prepareQuickFlow(root);
  const steps = step1 ? [step1] : [...root.querySelectorAll('[data-flow-step]')];
  const results = root.querySelector('#rhythm-results');
  let started = false, selection = {}, showingResults = false, activeStep = 1;

  function visible(element, show) {
    if (!element) return;
    const reveal = element.hidden && show;
    element.hidden = !show;
    if (reveal && !reducedMotion() && typeof element.animate === 'function') {
      element.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 160, easing: 'ease-out' });
    }
  }

  function paint() {
    const available = flowAvailability(selection);
    visible(explore, started);
    steps.forEach((step, i) => {
      const activeNow = started && i === 0 && !showingResults;
      visible(step, activeNow);
      step.open = activeNow;
      step.dataset.available = String(i === 0);
    });
    if (quickButton) visible(quickButton, started && available.ready && !showingResults);
    visible(results, started && available.ready && showingResults);
  }

  function update(filters) {
    selection = filters;
    showingResults = false;
    activeStep = 1;
    paint();
  }

  function activate(number) {
    if (!started || number !== 1 || !steps[0]) return false;
    activeStep = 1;
    showingResults = false;
    paint();
    return true;
  }

  return {
    update,
    start(filters) { started = true; activeStep = 1; selection = filters; showingResults = false; paint(); },
    activate,
    submit(filters) {
      selection = filters;
      if (!started || !flowAvailability(filters).ready) { paint(); return false; }
      showingResults = true;
      paint();
      return true;
    },
  };
}
