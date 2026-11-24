# 나가치 v40 — 카카오 로그인 및 계정별 동행 일정

어차ON의 OAuth → Supabase Auth(PKCE) 인증 흐름만 참고하고, 기존 어차ON 프로젝트·키·회원 DB를 복제하지 않습니다. 나가치 전용 Kakao Developers 앱 및 기존 나가치 Supabase 프로젝트를 사용합니다.

1. 운영 DB 백업과 v26 설치 확인 후 SQL Editor에서 supabase/account-notices-v40.sql 전체를 실행합니다. v26 미설치 상태라면 기존 설치를 먼저 마칩니다.
2. Kakao Developers에서 나가치 앱을 등록하고 카카오 로그인을 활성화합니다. 나가치 REST API Key와 Client Secret은 Supabase Authentication의 Kakao 공급자 화면에 직접 입력합니다. Kakao Redirect URI에는 나가치 Supabase 화면의 callback URL을 등록합니다. 어차ON 설정은 변경하지 않습니다. 비밀키를 GitHub/채팅/브라우저 코드에 넣지 않습니다.
3. Supabase Auth URL Configuration: Site URL https://pyeonhanga.kichan21013.workers.dev/ 및 Redirect URLs https://pyeonhanga.kichan21013.workers.dev/account.html 을 등록합니다. Cloudflare 빌드에는 나가치 Supabase 공개 URL과 anon/publishable key만 사용합니다.
4. 고객 앱 사람 아이콘 → 카카오 로그인 → Supabase Authentication Users의 본인 UUID 확인 → 기존 nagachi_companion_admins 허용 목록에 본인 UUID 추가. 이메일·닉네임으로 권한을 판정하지 않습니다. 새 로그인 시 관리자면 운영실로 이동합니다. 기존 이메일 로그인도 유지합니다.

고객: 탐색·익명 관심 설문 → 일정 소식 선택 → 관심 저장 → 로그인하고 일정 소식 받기 → 카카오 로그인 → 관심 활동 재확인 및 수신 설정 저장. 활동별 앱 내 공지만 제공하며 특정 모임별 알림·카카오톡 메시지·푸시·계정형 참가 신청은 별도 개발 대상입니다. 기존 기기 구독은 종 아이콘에서 조회·해지할 수 있고 새 기기 구독 권한은 SQL 적용 후 폐지됩니다. 탭 세션 만료 또는 새 탭에서는 재로그인이 필요합니다. 계정 삭제/탈퇴, 개인정보 처리방침을 정비하기 전 일반 회원 모집을 시작하지 않습니다.

운영 전 검증: SQL, 별도 카카오 계정 두 개로 로그인, 일반 사용자 관리자 접근 거부, 관리자 이동, 구독/해지, 다른 기기에서 같은 계정으로 로그인해 조회, 만료/로그아웃, 실제 공지. GitHub 병합은 실서비스 인증 성공이 아닙니다.
