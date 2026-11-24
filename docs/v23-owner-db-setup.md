# 나가치 v23 — 운영 DB 연결 및 실제 작동 확인

기존 v22 관리자 UI를 유지합니다. 새로운 유료 서비스와 개인 연락처 수집은 추가하지 않습니다.

## 1. 운영 DB 연결 (최초 1회)

1. [Supabase 대시보드](https://supabase.com/dashboard)에서 **기존 나가치 프로젝트**를 선택합니다. 새 프로젝트를 만들지 않습니다. 프로젝트 URL을 확인하고 운영 데이터 백업 및 기존 스키마 호환성을 검토합니다.
2. SQL Editor → New query에서 [통합 설치 SQL](../supabase/install-v23.sql)의 전체 내용을 붙여 넣고 Run 합니다. 기존 네 SQL(schema, companion-groups, popular-companion, operations-studio)을 한 트랜잭션으로 적용합니다. 오류가 발생하면 해당 트랜잭션은 롤백되므로 오류 메시지를 확인하고 중단합니다.
3. New query에서 [연결 점검 SQL](../supabase/check-v23.sql)을 전체 실행합니다. TABLE/RPC 각 행의 status가 OK인지 확인합니다. MISSING, RLS OFF, DIRECT ACCESS, CHECK GRANTS 등의 항목이 있으면 운영 시작 전에 점검합니다.
4. Authentication → Users에서 본인 소유 이메일 계정이 있는지 확인합니다. 없다면 Add user → Create new user로 생성하고 본인 이메일/고유 비밀번호를 직접 입력합니다. 자동 가입 또는 다른 이용자 계정의 관리자 승격은 하지 않습니다.
5. Users에서 본인 계정의 UUID를 복사하고 SQL Editor에서 아래 한 줄의 자리표시자를 해당 UUID로 바꾸어 실행합니다.

```sql
insert into public.nagachi_companion_admins(user_id)
values ('본인-Auth-사용자-UUID') on conflict do nothing;
```

6. 관리자 등록 수를 확인합니다.

```sql
select count(*) as registered_admins from public.nagachi_companion_admins;
```

본인만 등록했다면 1이어야 합니다. 1보다 크면 기존 관리자 권한 부여 사유를 먼저 확인하세요. 계정이나 권한을 임의로 삭제하지 않습니다.

7. Cloudflare의 실제 배포 설정에서 기존 Supabase 프로젝트 URL과 **publishable/anon key**가 연결되어 있는지 확인합니다. 비밀번호, service_role/secret 키를 GitHub, 앱 코드, 채팅에 넣지 않습니다.

## 2. 실제 앱 검증 (관리자 본인)

[관리자 운영실](https://pyeonhanga.kichan21013.workers.dev/admin.html)을 엽니다.

- 로그인 후 운영 현황을 조회합니다.
- 테스트용 코스를 만들되 공개 체크를 하지 않고 저장합니다.
- 새로고침/재로그인 후 저장된 코스가 유지되는지 확인합니다.
- 일반 앱을 별도 브라우저에서 열고 비공개 코스가 보이지 않는지 확인합니다.
- 실제 공개 가능한 코스만 공개 후 일반 앱 새로고침에서 표시 여부를 확인합니다.
- 공개 체크를 해제하면 다시 일반 앱에서 사라지는지 확인합니다.
- 동행 관심 저장은 동의한 실제 사용자 테스트로 확인합니다. 테스트 수치를 실제 고객 수요처럼 표시하지 않습니다.
- 비관리자는 관리자 조회/저장을 할 수 없어야 합니다.

## 3. 완료 기준

통합 SQL 자체는 운영 데이터에 아직 실행되지 않았을 수 있습니다. SQL 구조/권한 확인과 실제 앱 검증은 별개입니다. 관리자 인증·초안 저장·재조회·공개/비공개 전환·일반 사용자 접근 차단까지 확인 후 다음 개발(모임별 참가 의사, 승인, 취소)을 검토합니다. 실명·전화번호·결제 기능은 개인정보/안전/법률 검토 전에 추가하지 않습니다.
