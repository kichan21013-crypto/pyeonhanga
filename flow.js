// 화면 진행만 관리합니다. 장소 검색·정렬과 analytics 계약은 변경하지 않습니다.
export function flowAvailability(filters) {
  const intent = Boolean(filters.desires?.length || filters.query?.trim());
  return { intent, companions: Boolean(filters.companions?.length), steps: [true, false, false], ready: intent };
}

function compactMarkup(root) {
  if (typeof root.createElement !== 'function') return;
  const step1 = root.querySelector('#flow-step-1');
  const step2 = root.querySelector('#flow-step-2');
  const step3 = root.querySelector('#flow-step-3');
  if (!step1 || !step2 || !step3 || root.querySelector('#quick-refine')) return;

  const progress = step1.querySelector('.step-progress');
  if (progress) progress.textContent = '오늘';
  step1.querySelector('.step-toggle')?.remove();
  step1.querySelector('[data-next-step]')?.remove();

  const recommend = step3.querySelector('#recommend-button');
  const refine = root.createElement('details');
  refine.id = 'quick-refine';
  refine.className = 'quick-refine';
  const summary = root.createElement('summary');
  summary.innerHTML = '<strong>조금 더 맞추기</strong><span>선택</span>';
  const body = root.createElement('div');
  body.className = 'quick-refine-body';

  const section = (title, source, selector) => {
    const node = source.querySelector(selector);
    if (!node) return;
    const heading = root.createElement('h3');
    heading.textContent = title;
    body.append(heading, node);
  };

  section('누구와?', step2, '.companion-choices');
  for (const selector of ['#companion-summary', '#companion-help']) {
    const node = step2.querySelector(selector); if (node) body.append(node);
  }
  const durationHeading = step3.querySelector('#duration-title');
  const durationGrid = durationHeading?.nextElementSibling;
  if (durationHeading && durationGrid) body.append(durationHeading, durationGrid);
  const transportHeading = step3.querySelector('#transport-title');
  const transportGrid = transportHeading?.nextElementSibling;
  if (transportHeading && transportGrid) body.append(transportHeading, transportGrid);
  for (const selector of ['#condition-summary', '.optional-conditions', '.legacy-filters']) {
    const node = step3.querySelector(selector); if (node) body.append(node);
  }
  refine.append(summary, body);

  if (recommend) step1.append(recommend);
  step1.append(refine);
  step2.remove();
  step3.remove();
}

export function createProgressiveFlow(root, { reducedMotion = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? true } = {}) {
  compactMarkup(root);
  const explore = root.querySelector('#explore');
  const steps = [...root.querySelectorAll('[data-flow-step]')];
  const results = root.querySelector('#rhythm-results');
  let started = false, selection = {}, showingResults = false;
  function visible(element, show) {
    if (!element) return;
    const reveal = element.hidden && show;
    element.hidden = !show;
    if (reveal && !reducedMotion() && typeof element.animate === 'function') {
      element.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 180, easing: 'ease-out' });
    }
  }
  function paint() {
    const available = flowAvailability(selection);
    visible(explore, started);
    steps.forEach((step, i) => {
      visible(step, i === 0);
      step.open = started && i === 0;
      step.dataset.available = String(i === 0);
    });
    root.querySelectorAll('[data-next-step]').forEach(button => visible(button, false));
    const final = root.querySelector('#recommend-button');
    if (final) final.disabled = !available.ready;
    visible(results, started && available.ready && showingResults);
  }
  function update(filters) { selection = filters; showingResults = false; paint(); }
  function activate(number) {
    if (number !== 1 || !started || !steps[0]) return false;
    steps[0].open = true; return true;
  }
  return {
    update,
    start(filters) { started = true; selection = filters; showingResults = false; paint(); },
    activate,
    submit(filters) {
      selection = filters;
      if (!started || !flowAvailability(filters).ready) { paint(); return false; }
      showingResults = true; paint(); return true;
    },
  };
}
