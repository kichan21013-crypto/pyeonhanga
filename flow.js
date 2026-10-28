// 화면 진행만 관리합니다. 장소 검색·정렬과 analytics 계약은 변경하지 않습니다.
export function flowAvailability(filters) {
  const intent = Boolean(filters.desires?.length || filters.query?.trim());
  const companions = Boolean(filters.companions?.length);
  return { intent, companions, steps: [true, intent], ready: intent };
}

function prepareHomeMessage(root) {
  const eyebrow = root.querySelector?.('.rhythm-hero .eyebrow');
  const description = root.querySelector?.('.rhythm-hero .hero-description');
  const support = root.querySelector?.('.rhythm-hero .hero-support');
  if (eyebrow) eyebrow.textContent = '오늘 뭐 할지 고민될 때, 나가치';
  if (description) description.innerHTML = '먹기·산책·운동·휴식·드라이브처럼<br>오늘 하고 싶은 걸 고르면,';
  if (support) support.textContent = '내 상황과 취향에 맞는 장소를 골라드려요.';
}

function prepareTwoStepFlow(root) {
  const step1 = root.querySelector('#flow-step-1');
  const step2 = root.querySelector('#flow-step-2');
  const step3 = root.querySelector('#flow-step-3');
  if (!step1 || !step2 || !step3 || typeof step1.querySelector !== 'function') {
    return {
      steps: [...root.querySelectorAll('[data-flow-step]')].slice(0, 2),
      nextButton: [...root.querySelectorAll('[data-next-step]')][0],
      finalButton: root.querySelector('#recommend-button'),
    };
  }

  prepareHomeMessage(root);

  const step1Progress = step1.querySelector('.step-progress');
  if (step1Progress) { step1Progress.hidden = false; step1Progress.textContent = '1 / 2'; }
  const step1Title = step1.querySelector('#intent-title > span:nth-child(2)');
  if (step1Title) step1Title.textContent = '오늘 뭐 하고 싶으세요?';
  const step1Instruction = step1.querySelector('.step-instruction');
  if (step1Instruction) step1Instruction.textContent = '하나만 골라도 좋아요. 오늘 마음이 가는 쪽을 선택해보세요.';

  const nextButton = step1.querySelector('[data-next-step="2"]');
  if (nextButton) {
    nextButton.hidden = true;
    nextButton.className = 'button accent full two-step-next';
    nextButton.innerHTML = '선택 완료 · 다음 <span aria-hidden="true">→</span>';
  }

  // 세부 활동은 2단계로 옮겨 첫 화면을 가볍게 유지합니다.
  const activityOptions = step1.querySelector('#activity-options');
  const searchForm = step1.querySelector('#search-form');
  if (searchForm) searchForm.classList.add('two-step-search');

  const step2Progress = step2.querySelector('.step-progress');
  if (step2Progress) { step2Progress.hidden = false; step2Progress.textContent = '2 / 2'; }
  const step2Title = step2.querySelector('#companions-title > span:nth-child(2)');
  if (step2Title) step2Title.textContent = '오늘의 조건은 어때요?';
  const step2Instruction = step2.querySelector('.step-instruction');
  if (step2Instruction) step2Instruction.textContent = '필요한 것만 골라주세요. 아무것도 선택하지 않아도 괜찮아요.';
  step2.classList.add('condition-stage');

  const conditionBody = document.createElement('div');
  conditionBody.className = 'condition-stage-body';

  const selectedCue = document.createElement('div');
  selectedCue.className = 'condition-stage-cue';
  selectedCue.innerHTML = '<span>✓</span><p><strong>하고 싶은 건 골랐어요.</strong><br><small>이제 오늘 상황만 살짝 알려주세요.</small></p>';
  conditionBody.append(selectedCue);

  const addGroup = (label, node, extraClass = '') => {
    if (!node) return;
    const section = document.createElement('section');
    section.className = `condition-stage-group ${extraClass}`.trim();
    const heading = document.createElement('h3');
    heading.textContent = label;
    section.append(heading, node);
    conditionBody.append(section);
  };

  if (activityOptions) addGroup('원하면 더 구체적으로', activityOptions, 'condition-activities');
  addGroup('누구와', step2.querySelector('.companion-choices'));
  const companionHelp = step2.querySelector('#companion-help');
  if (companionHelp) conditionBody.append(companionHelp);
  addGroup('시간', step3.querySelector('[aria-labelledby="duration-title"]'));
  addGroup('이동', step3.querySelector('[aria-labelledby="transport-title"]'));

  const optional = document.createElement('details');
  optional.className = 'condition-more';
  optional.innerHTML = '<summary>편안함·지역까지 더 맞추기 <span aria-hidden="true">＋</span></summary><div class="condition-more-body"></div>';
  const optionalBody = optional.querySelector('.condition-more-body');
  [...step3.querySelectorAll(':scope > details')].forEach(details => optionalBody.append(details));
  conditionBody.append(optional);

  const oldStep2Next = step2.querySelector('[data-next-step="3"]');
  oldStep2Next?.remove();
  const finalButton = step3.querySelector('#recommend-button');
  if (finalButton) {
    finalButton.className = 'button accent full condition-recommend';
    finalButton.innerHTML = '이 조건으로 추천 보기 <span aria-hidden="true">→</span>';
    finalButton.hidden = false;
  }

  const backButton = document.createElement('button');
  backButton.type = 'button';
  backButton.className = 'condition-back';
  backButton.dataset.nextStep = '1';
  backButton.textContent = '← 하고 싶은 것 다시 고르기';

  step2.append(conditionBody);
  if (finalButton) step2.append(finalButton);
  step2.append(backButton);
  step3.remove();

  return { steps: [step1, step2], nextButton, finalButton };
}

export function createProgressiveFlow(root, { reducedMotion = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? true } = {}) {
  const explore = root.querySelector('#explore');
  const { steps, nextButton, finalButton } = prepareTwoStepFlow(root);
  const results = root.querySelector('#rhythm-results');
  let started = false, selection = {}, showingResults = false, activeStep = 1;

  function visible(element, show) {
    if (!element) return;
    const reveal = element.hidden && show;
    element.hidden = !show;
    if (reveal && !reducedMotion() && typeof element.animate === 'function') {
      element.animate([{ opacity: 0, transform: 'translateX(14px)' }, { opacity: 1, transform: 'translateX(0)' }], { duration: 190, easing: 'ease-out' });
    }
  }

  function paint() {
    const available = flowAvailability(selection);
    visible(explore, started);
    steps.forEach((step, i) => {
      const number = i + 1;
      const activeNow = started && number === activeStep && !showingResults && (number === 1 || available.intent);
      visible(step, activeNow);
      step.open = activeNow;
      step.dataset.available = String(number === 1 || available.intent);
    });
    if (nextButton) visible(nextButton, started && activeStep === 1 && available.intent && !showingResults);
    if (finalButton) visible(finalButton, started && activeStep === 2 && available.intent && !showingResults);
    visible(results, started && available.ready && showingResults);
  }

  function update(filters) {
    selection = filters;
    showingResults = false;
    if (!flowAvailability(selection).intent) activeStep = 1;
    paint();
  }

  function activate(number) {
    const available = flowAvailability(selection);
    if (!started || !steps[number - 1] || (number === 2 && !available.intent)) return false;
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
      showingResults = true;
      paint();
      return true;
    },
  };
}
