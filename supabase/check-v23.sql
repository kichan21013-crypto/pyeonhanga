-- 나가치 v23 운영 DB 점검 (읽기 전용, 데이터/권한 수정 없음).
-- Supabase SQL Editor에서 실행. 결과의 모든 status가 OK인지 확인합니다.
-- 계정 UUID, 이메일, 이용자별 정보, 토큰, 비밀 키는 반환하지 않습니다.
with expected_tables(name) as (
 values ('analytics_events'),('nagachi_notice_subscriptions'),('nagachi_companion_admins'),
 ('nagachi_group_notices'),('nagachi_curated_courses'),('nagachi_operated_meetups'),
 ('nagachi_revenue_scenarios')
), expected_functions(signature,public_rpc) as (
 values ('record_event(jsonb)',true),
 ('nagachi_public_interest_counts()',true),('nagachi_public_popular_places()',true),
 ('nagachi_subscribe_updates(text,text,text[])',true),('nagachi_my_updates(text)',true),
 ('nagachi_unsubscribe_updates(text)',true),('nagachi_public_courses()',true),
 ('nagachi_public_meetups()',true),('nagachi_admin_dashboard()',false),
 ('nagachi_admin_save_notice(text,text,text,timestamptz,text,boolean,bigint)',false),
 ('nagachi_admin_operations()',false),
 ('nagachi_admin_save_course(text,text,text,text,text[],text,boolean,bigint)',false),
 ('nagachi_admin_save_meetup(text,text,text,bigint,timestamptz,text,integer,text,bigint)',false),
 ('nagachi_admin_save_pricing(text,integer,integer,integer,integer,integer,text,bigint)',false)
), table_checks as (
 select 'TABLE' as kind,t.name as item,
 case when c.oid is null then 'MISSING'
 when not c.relrowsecurity then 'RLS OFF'
 when pg_catalog.has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
   or pg_catalog.has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
 then 'DIRECT ACCESS'
 else 'OK' end as status
 from expected_tables t
 left join pg_catalog.pg_class c on c.oid=pg_catalog.to_regclass('public.'||t.name)
), function_checks as (
 select 'RPC' as kind,f.signature as item,
 case when p.oid is null then 'MISSING'
 when not p.prosecdef then 'SECURITY DEFINER MISSING'
 when pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE') is distinct from f.public_rpc
 or pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE') is distinct from (not f.public_rpc)
 then 'CHECK GRANTS'
 else 'OK' end as status
 from expected_functions f
 left join pg_catalog.pg_proc p on p.oid=pg_catalog.to_regprocedure('public.'||f.signature)
)
select * from table_checks union all select * from function_checks order by kind,item;
-- 참고: 위 점검은 구조와 권한 설정의 확인입니다. 함수 내부 로직, Auth 사용자 권한,
-- 실제 앱 저장, Cloudflare 배포 확인을 대신하지 않습니다.
-- 설치 후 별도로 본인 관리자 등록 여부를 확인하세요 (개인정보를 반환하지 않음):
-- select count(*) as registered_admins from public.nagachi_companion_admins;
