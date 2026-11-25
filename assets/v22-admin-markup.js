/* Built into static admin.html; logged-out visitors can see this shell,
 * but all management data/actions are protected by Supabase Auth + DB allowlist.
 */
export function operatorMarkup(){
 return `
<section class="n19-admin n22-admin" aria-labelledby="n19-admin-title">
  <header class="n22-admin-heading">
    <span class="n22-owner-badge">관리자 전용 · v42</span>
    <h1 id="n19-admin-title">나가치 운영실</h1>
    <p>회원 · 코스 · 모임 · 공지 관리</p>
  </header>
  <p id="n19-admin-status" class="n22-admin-status" role="status">운영자 로그인 후 관리 기능을 사용할 수 있습니다.</p>
  <form class="n19-admin-form n19-admin-card n22-login" id="n19-admin-login" autocomplete="off">
    <div class="n22-login-mark" aria-hidden="true">✦</div>
    <h2>관리자만 입장할 수 있어요</h2><a class="button primary" href="/account.html">카카오 로그인으로 입장</a>
    <p>운영자 계정으로 로그인하면 코스·모임·수익 계획을 관리할 수 있습니다.</p>
    <label>관리자 이메일<input type="email" name="email" required autocomplete="username" placeholder="Supabase Auth에 등록한 이메일"></label>
    <label>비밀번호<input type="password" name="password" required autocomplete="current-password"></label>
    <button type="submit">관리자 운영실 들어가기 →</button>
    <small>비밀번호는 브라우저에 저장하지 않습니다. 관리자 계정은 Supabase Auth와 DB 허용 목록에 모두 등록돼 있어야 합니다.</small><a class="n39-setup-link" href="https://github.com/kichan21013-crypto/pyeonhanga/blob/main/docs/v41-connection-guide.md" target="_blank" rel="noopener noreferrer">최초 운영 연결 안내 보기</a>
  </form>
  <div id="n19-admin-panel" hidden>
    <div class="n22-admin-toolbar">
      <span>운영자 전용 · 코스/모임/수익 관리</span>
      <div><button type="button" id="n19-admin-refresh">새로고침</button>
        <button type="button" id="n19-admin-logout">로그아웃</button></div>
    </div>
    <p id="n22-load-status" class="n22-load-status" role="status">운영 자료 연결 대기 중</p>
    <nav class="n22-admin-tabs" aria-label="운영 관리 메뉴">
      <button type="button" data-n22-tab="overview" aria-pressed="true">◫ <span>운영 현황</span></button>
      <button type="button" data-n22-tab="courses" aria-pressed="false">◉ <span>코스 만들기</span></button>
      <button type="button" data-n22-tab="meetups" aria-pressed="false">♧ <span>동행 모임</span></button>
      <button type="button" data-n22-tab="revenue" aria-pressed="false">▥ <span>수익 계획</span></button>
    </nav>
    <section data-n22-panel="overview" aria-labelledby="n22-overview-title">
      <div class="n22-panel-title"><span>OVERVIEW</span><h2 id="n22-overview-title">나의 운영 현황</h2>
        <p>관심 의사를 남긴 분과 실제 확정 참여자를 혼동하지 않습니다.</p></div>
      <section class="n42-summary" aria-label="회원 및 운영 현황"><div id="n42-owner-summary" aria-live="polite">회원 현황 확인 중</div><div class="n42-actions"><button type="button" data-n22-go="courses">+ 코스 등록</button><button type="button" data-n22-go="meetups">+ 모임 등록</button><button type="button" data-n42-notice>+ 일정 공지</button><button type="button" data-n22-go="revenue">수익 계획</button></div></section><div id="n22-operation-metrics" class="n22-metrics" aria-live="polite"></div>
      <section class="n19-admin-card n22-overview-card n26-business" aria-labelledby="n26-title">
        <h3 id="n26-title">사업 운영 지표</h3>
        <div class="n26-controls"><label>조회 기간<select id="n26-days"><option value="1">오늘</option><option value="7" selected>최근 7일</option><option value="30">최근 30일</option></select></label><button type="button" id="n26-refresh">지표 새로고침</button></div>
        <div id="n26-business-results" aria-live="polite">운영자 로그인 후 확인할 수 있습니다.</div>
      </section>
      <div class="n19-admin-card n22-overview-card">
        <h3>활동별 관심 및 수신자</h3>
        <p>최근 90일 동의 응답의 서로 다른 익명 브라우저 수입니다. 실제 파티 참가 확정은 아닙니다.</p>
        <div id="n19-admin-counts" class="n19-admin-counts"></div>
      </div>
      
      <p class="n22-operating-note">이 화면에는 실제 응답·작성한 코스·모임·시나리오만 표시합니다. 예약, 결제, 차량 알선은 아직 제공하지 않습니다.</p>
    </section>
    <section data-n22-panel="courses" aria-labelledby="n22-course-title" hidden>
      <div class="n22-panel-title"><span>COURSE CURATION</span><h2 id="n22-course-title">새 동행 코스 만들기</h2>
        <p>기존 관광공사 등록 장소를 골라 나만의 하루 코스를 구성하세요. 기본은 비공개 초안입니다.</p></div>
      <form id="n22-course-form" class="n19-admin-form n22-editor">
        <input type="hidden" name="id">
        <label>코스 이름<input name="title" minlength="4" maxlength="90" required placeholder="예: 북한산 산책 후 커피 한 잔"></label>
        <div class="n22-two-cols">
          <label>함께할 활동<select name="activity" required><option value="food">맛있는 한 끼</option>
            <option value="hike">산행</option><option value="outing">산책·카페</option>
            <option value="travel">근교 나들이</option></select></label>
          <label>지역<select name="region" required>
            <option value="서울">서울</option><option value="경기">경기</option>
            <option value="강릉">강릉</option><option value="경주">경주</option>
            <option value="부산">부산</option><option value="제주">제주</option></select></label>
        </div>
        <label>일정 길이<select name="duration"><option value="반나절">반나절</option><option value="하루">하루</option></select></label>
        <label>코스 소개<textarea name="description" minlength="12" maxlength="600" required
          placeholder="예: 오전 10시에 산책하고, 점심에는 근처 맛집에서 한 끼, 오후에는 카페에 들르는 하루"></textarea></label>
        <div class="n22-place-builder">
          <div class="n22-inline-heading"><strong>코스에 포함할 실제 장소</strong><span>순서대로 최대 5곳</span></div>
          <label for="n22-place-query" class="n22-search-label">장소 이름 검색</label>
          <input type="search" id="n22-place-query" placeholder="예: 서대문독립공원 / 도일처" autocomplete="off">
          <div id="n22-place-suggestions" class="n22-place-suggestions" role="status">검색하면 등록된 장소가 나옵니다.</div>
          <div id="n22-course-picked" class="n22-place-picked"></div>
        </div>
        <label class="n22-publish"><input name="publish" type="checkbox">
          <span><strong>이 코스를 일반 앱에 공개하기</strong><small>기본은 비공개. 공개 체크 후 저장한 코스만 이용자에게 보입니다.</small></span>
        </label>
        <div class="n22-action-row"><button type="submit">코스 저장하기</button>
          <button type="button" data-n22-clear-course>새 코스로 초기화</button></div>
        <p id="n22-course-status" role="status"></p>
      </form>
      <div class="n22-list-card"><h3>내가 만든 코스</h3><div id="n22-course-list"></div></div>
    </section>
    <section data-n22-panel="meetups" aria-labelledby="n22-meetup-title" hidden>
      <div class="n22-panel-title"><span>TOGETHER PLANNING</span><h2 id="n22-meetup-title">동행 모임 운영하기</h2>
        <p>코스에 맞춰 모임 계획을 만들고 진행 단계를 관리하세요. 공개된 모임도 아직 참가 확정이나 예약은 아닙니다.</p></div>
      <form id="n22-meetup-form" class="n19-admin-form n22-editor">
        <input type="hidden" name="id">
        <label>모임 이름<input name="title" minlength="4" maxlength="90" required placeholder="예: 주말 서대문 산책 모임"></label>
        <div class="n22-two-cols">
          <label>활동<select name="activity"><option value="food">맛있는 한 끼</option>
            <option value="hike">산행</option><option value="outing">산책·카페</option>
            <option value="travel">근교 나들이</option></select></label>
          <label>연결할 코스<select name="course_id"><option value="">코스 지정 없음</option></select></label>
        </div>
        <label>모임 소개<textarea name="intro" minlength="12" maxlength="600" required
          placeholder="어떤 취향의 사람들이 어떻게 하루를 보낼지 적어주세요."></textarea></label>
        <div class="n22-two-cols">
          <label>예정 시각(모집 시 필수)<input type="datetime-local" name="meet_at"></label>
          <label>모집 정원<select name="preferred_size"><option value="2">2명</option>
            <option value="4" selected>4명</option><option value="6">6명</option>
            <option value="8">8명</option></select></label>
        </div>
        <label>모일 곳(승인된 신청자 안내용)<input name="meet_place" maxlength="120"
          placeholder="예: ○○역 근처, 정확한 집결지는 별도 공지"></label>
        <label>진행 단계<select name="stage"><option value="draft">내 초안 · 비공개</option>
          <option value="planning">구성 준비 · 비공개</option>
          <option value="announced">준비 소식 공개 · 참가 확정 아님</option>
          <option value="closed">마감 · 비공개</option></select></label>
        <p class="n22-operating-note">무료 시범 동행의 기기별 참가 신청과 승인을 관리합니다. 실명 확인·결제·유상 운송은 제공하지 않습니다. 집결지는 승인된 신청자에게만 안내하세요.</p>
        <div class="n22-action-row"><button type="submit">모임 계획 저장</button>
          <button type="button" data-n22-clear-meetup>새 모임으로 초기화</button></div>
        <p id="n22-meetup-status" role="status"></p>
      </form>
      <div class="n22-list-card"><h3>내 동행 모임</h3><div id="n22-meetup-list"></div></div><div id="n25-party-panel" class="n22-list-card" hidden></div>
      <details class="n22-notice-drawer" id="n22-notice-drawer">
        <summary>활동별 일정 공지 작성</summary>
        <div class="n22-notice-body">
          <p>수신 동의 회원과 기존 기기 구독자가 앱에서 확인합니다. 카카오톡·문자·푸시는 발송하지 않습니다.</p>
          <form class="n19-admin-form n19-admin-card" id="n19-admin-notice-form">
            <input type="hidden" name="notice_id">
            <label>관련 동행<select name="activity">
              <option value="food">맛있는 한 끼</option><option value="hike">산행</option>
              <option value="outing">산책·카페</option><option value="travel">근교 나들이</option></select></label>
            <label>공지 제목<input name="title" minlength="3" maxlength="80" required placeholder="예: 주말 산행 모임 안내"></label>
            <label>내용<textarea name="body" minlength="5" maxlength="800" required placeholder="일정과 필요한 안내를 적어주세요."></textarea></label>
            <label>모일 일시<input name="meet_at" type="datetime-local"></label>
            <label>일반 공지 장소(정확한 집결지 제외)<input name="meet_place" maxlength="120"></label>
            <label class="n22-publish"><input type="checkbox" name="publish"><span>공지 게시하기(선택 활동의 수신 동의 회원 및 기존 기기)</span></label>
            <button type="submit">동행 소식 저장</button>
          </form>
          <div id="n19-admin-notices"></div>
        </div>
      </details>
    </section>
    <section data-n22-panel="revenue" aria-labelledby="n22-revenue-title" hidden>
      <div class="n22-panel-title"><span>BUSINESS SCENARIO</span><h2 id="n22-revenue-title">서비스 수익 계획</h2>
        <p>동행 구성·코스 제안·일정 조율 서비스비의 사업성을 무료로 계산합니다. 현재는 실제 결제·매출이 없습니다.</p></div>
      <form id="n22-revenue-form" class="n19-admin-form n22-editor">
        <input type="hidden" name="id">
        <label>계획 이름<input name="name" minlength="3" maxlength="80" required placeholder="예: 반나절 동행 · 1만원 서비스비"></label>
        <div class="n22-two-cols">
          <label>1인 서비스비 가정(원)<input name="service_fee_krw" type="number" min="0" max="100000" step="1000" value="10000" required></label>
          <label>모임당 예상 인원<input name="expected_people" type="number" min="2" max="30" value="4" required></label>
          <label>월 예상 모임 횟수<input name="meetings_per_month" type="number" min="1" max="20" value="4" required></label>
          <label>유료 전환 가정(%)<input name="paid_conversion_pct" type="number" min="0" max="100" value="25" required></label>
          <label>모임당 운영 비용 가정(원)<input name="cost_per_meeting_krw" type="number" min="0" max="3000000" step="1000" value="0" required></label>
        </div>
        <label>메모<textarea name="note" maxlength="400" placeholder="예: 음식·카페·교통·입장료는 개인 직접 결제. 유상 모집 시작 전 법적 검토"></textarea></label>
        <div id="n22-revenue-preview" class="n22-revenue-preview" aria-live="polite"></div>
        <div class="n22-action-row"><button type="submit">수익 가정 저장</button>
          <button type="button" data-n22-clear-revenue>새 시나리오로 초기화</button></div>
        <p id="n22-revenue-status" role="status"></p>
      </form>
      <div class="n22-list-card"><h3>저장한 사업성 시나리오</h3><div id="n22-revenue-list"></div></div>
      <p class="n22-operating-note">계산 결과는 순수 가정입니다. 세금·환불·실제 광고비·인건비·법적 등록비 등이 빠질 수 있으며, 실제 수익이나 매출을 뜻하지 않습니다.</p>
    </section>
  </div>
  <p class="n22-legal-footer">관리자 권한은 웹 주소 비공개가 아니라 Supabase 로그인과 서버 측 허용 목록으로 확인합니다. 실제 모임 모집·결제·운송·여행상품 판매 전에는 별도 법적·안전 검토가 필요합니다.</p>
</section>`;
}
