# v44 외부 장소명 자동 검색

- 관리자 화면에서 외부 장소 검색 → 장소명을 입력하고 검색 → 결과 선택 → 장소명, 주소, Google 지도 검색 링크 자동 입력 → 실제 장소와 지역·유형 확인 → 확인 체크 → 등록. 지도 검색 링크는 위치 정보 확인용이며 정확한 업체 상세 페이지나 예약을 보장하지 않습니다.
- 데이터는 Geoapify의 OpenStreetMap 기반 결과만 사용하며 한국 범위의 장소명·주소 후보만 표시합니다. 네이버·구글 지도 결과를 크롤링하거나 API 콘텐츠를 복제하지 않습니다. 자동 검색 결과가 없으면 직접 등록합니다.
- Geoapify Free 계정에서 새 프로젝트/API key 발급: https://myprojects.geoapify.com/ . 별도 유료 플랜/카드 등록 금지. Supabase 프로젝트 hnfljhuwowaekkwbtxpt → Edge Functions → Secrets에 이름 GEOAPIFY_API_KEY, 값은 발급 키를 직접 입력. 채팅이나 GitHub에 키를 공개하지 않습니다. 키가 없으면 자동 검색은 비활성 안내가 나오고 직접 입력 및 지도 검색 링크 생성은 작동합니다.
- 운영 서버에 place-search-v44.sql 적용 및 nagachi-place-search Edge Function 배포. JWT 필수, 별도 DB 관리자 allowlist 확인, 전체 프로젝트 하루 50회 및 2초 간격 제한, 검색 요청 외에 회원정보 전달 금지. 원본 API 응답은 저장하지 않고 운영자가 선택한 이름/주소/지도 링크와 출처만 저장합니다. 고객 공개 화면에 Geoapify 및 OSM 저작자 표시를 유지합니다. 일반 고객은 검색 API를 사용할 수 없습니다.
- https://www.geoapify.com/geocoding-api/ 및 https://www.geoapify.com/pricing/ 참고. 실제 키 등록 후 검색 정확도/응답과 무료 사용량 검증이 필요합니다. 한국 내 식당·카페의 검색 범위는 네이버·구글과 다를 수 있습니다.
