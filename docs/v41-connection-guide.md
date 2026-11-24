# 나가치 v41 카카오 전환 준비

어차ON 기존 카카오 Developers 앱을 재사용할 수 있으나, 나가치 전용 Supabase 프로젝트 및 회원 데이터 분리는 유지합니다. 어차ON 앱/DB/계정/데이터 삭제나 인증 설정 변경은 이번 코드 작업에 포함되지 않습니다.

1. 나가치 프로젝트의 기존 v26 설치 여부 확인 및 백업. 신규 설치에만 install-v26.sql을 먼저 적용. 기존 운영 스키마가 다르면 확인 후 진행합니다.
2. account-notices-v41.sql 전체 실행(v40 포함, 별도 v40 실행 불필요). check-account-v41.sql로 7개 항목 OK 확인. 기존 v26 스크립트를 다시 실행하면 구독 권한이 바뀔 수 있으므로 v41을 마지막 적용합니다.
3. 기존 어차ON 카카오 앱을 나가치로 전환할 경우 앱 소유권 및 기존 서비스 영향을 확인합니다. 이름/아이콘 변경, 나가치 Supabase callback URI 추가, 해당 프로젝트의 Kakao provider에 REST API Key 및 Client Secret 직접 설정. 비밀키를 채팅이나 저장소에 넣지 않습니다. 기존 callback 제거는 전환 검증 후 별도 진행합니다.
4. 나가치 Supabase URL Configuration의 Site URL: https://pyeonhanga.kichan21013.workers.dev/ ; Redirect URL: https://pyeonhanga.kichan21013.workers.dev/account.html . Cloudflare 빌드에는 해당 프로젝트의 공개 URL과 anon/publishable key만 설정합니다.
5. 나가치 카카오 로그인 후 내 계정 정보 → 내 계정 식별번호 확인. 실제 Auth 사용자와 운영자 본인 계정 일치 확인 후 서버 허용 목록에 UUID 등록. 첫 로그인 자동 관리자 승격 금지. 기존 회원 정보 이관 금지. 기존 관리자 권한 제거는 새 계정 검증 후 별도 결정합니다.
6. 일반 사용자 및 운영자 계정으로 각각 로그인하고, 일반 사용자의 관리자 RPC 거부 및 운영자 접속, 구독/해지, 실제 공지 조회와 계정 수신자 집계를 확인합니다. 기기 구독은 별도로 표시됩니다. 실제 카카오 메시지/푸시 발송은 미구현입니다.

관리자 코드, DB 설치 파일, 진단 SQL은 준비되었지만 실제 서버 적용, 인증 설정, 실서비스 배포는 별도입니다. 일반 회원 모집 전에 개인정보 처리방침과 탈퇴 절차를 준비합니다.
