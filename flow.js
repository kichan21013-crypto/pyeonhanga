// 화면 진행만 관리합니다. 장소 검색·정렬과 analytics 계약은 변경하지 않습니다.
export function flowAvailability(filters) {
  const intent = Boolean(filters.desires?.length || filters.query?.trim());
  const companions = Boolean(filters.companions?.length);
  // 핵심 선택은 '오늘 무엇이 당기는지' 하나뿐입니다. 동행/시간/이동은 선택 사항입니다.
  return { intent, companions, steps: [true, intent, intent], ready: intent };
}
export function createProgressiveFlow(root, { reducedMotion = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? true } = {}) {
  const explore = root.querySelector('#explore');
  const steps = [...root.querySelectorAll('[data-flow-step]')];
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
      const availableNow = available.steps[i];
      const activeNow = started && availableNow && i === activeStep - 1 && !showingResults;
      // 이전/다음 질문을 화면 아래에 쌓지 않고 현재 질문 하나만 보여줍니다.
      visible(step, activeNow);
      step.open = activeNow;
      step.dataset.available = String(availableNow);
    });
    root.querySelectorAll('[data-next-step]').forEach(button => visible(button, available.steps[Number(button.dataset.nextStep) - 1]));
    const final = root.querySelector('#recommend-button');
    if (final) final.disabled = !available.ready;
    visible(results, started && available.ready && showingResults);
  }
  function update(filters) {
    selection = filters; showingResults = false;
    const available = flowAvailability(selection);
    if (!available.steps[activeStep - 1]) activeStep = available.intent ? 2 : 1;
    paint();
  }
  function activate(number) {
    const available = flowAvailability(selection);
    if (!started || !available.steps[number - 1] || !steps[number - 1]) return false;
    activeStep = number;
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
      showingResults = true; paint(); return true;
    },
  };
}
