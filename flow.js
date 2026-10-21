// 화면 진행만 관리합니다. 장소 검색·정렬과 analytics 계약은 변경하지 않습니다.
export function flowAvailability(filters) {
  const intent = Boolean(filters.desires?.length || filters.query?.trim());
  const companions = Boolean(filters.companions?.length);
  return { intent, companions, steps: [true, intent, intent && companions], ready: intent && companions };
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
      element.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 180, easing: 'ease-out' });
    }
  }
  function paint() {
    const available = flowAvailability(selection);
    visible(explore, started);
    steps.forEach((step, i) => {
      const availableNow = available.steps[i];
      visible(step, availableNow);
      if (!availableNow) step.open = false;
      else step.open = started && i === activeStep - 1;
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
    const target = steps[number - 1];
    if (!target || target.hidden || !started) return false;
    activeStep = number;
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
