# FLY RACING Confirmed FOB Price List

FLY RACING 제품의 시즌별 최종 FOB 가격을 버전으로 관리하고, 만료·해제가 가능한 읽기 전용 링크로 공유하는 웹 애플리케이션입니다. 관리자만 직접 입력, Excel 분석/가져오기, 수정, 이력 조회와 링크 관리를 할 수 있습니다. 공유 사용자는 현재 활성 가격만 검색할 수 있습니다.

## 구성

- React 19 + Vite + TypeScript
- Supabase Auth, PostgreSQL, RLS
- SheetJS Community Edition (브라우저 내 Excel 분석)
- Cloudflare Pages Functions (공유 토큰 검증 API)
- Vitest

## 로컬 실행

Node.js 20 이상이 필요합니다.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Pages Functions까지 로컬에서 확인하려면 `npm run build` 후 `npx wrangler pages dev dist`를 실행합니다.

## Supabase 생성 및 연결

1. Supabase에서 새 프로젝트를 생성합니다.
2. Project Settings > API에서 Project URL, anon key, service role key를 확인합니다.
3. `.env.local`에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`를 설정합니다. 이 두 값만 브라우저 번들에 포함됩니다.
4. Pages Functions 환경에는 `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PUBLIC_APP_URL`을 설정합니다.
5. service role key와 공유 토큰 암호화 키를 `VITE_` 변수나 프런트엔드 소스에 절대 넣지 마십시오.

## DB migration과 최초 관리자

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

신규 DB는 migration 파일을 파일명 순서대로 적용합니다. 기존 운영 DB에는 기존 migration 이력을 확인한 뒤 `202608280001_price_options_batches.sql`만 적용합니다. 이 migration은 기존 Style, 가격 버전, Sample FOB, 사용자와 공유 링크를 삭제하지 않습니다. 운영 적용 전 별도 Supabase branch/clone에서 백업과 SQL 검증을 수행하십시오.

SQL Editor로 적용할 때도 다음 순서를 지킵니다.

1. `202608270001_initial.sql` (신규 DB만)
2. `202608280001_price_options_batches.sql`

이어서 Authentication > Users에서 사용자를 생성하고 UUID를 복사하여 실행합니다.

```sql
insert into public.admin_users(user_id) values ('AUTH_USER_UUID');
```

Auth 사용자라는 이유만으로 관리 권한이 생기지 않습니다. `admin_users` 등록 전에는 RLS와 RPC가 쓰기를 거부합니다.

## 환경변수

| 변수 | 위치 | 설명 |
|---|---|---|
| `VITE_SUPABASE_URL` | Frontend | Supabase Project URL |
| `VITE_SUPABASE_ANON_KEY` | Frontend | 공개 가능한 anon key (RLS 적용) |
| `SUPABASE_URL` | Pages Functions | Supabase Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Pages Functions secret | 서버 전용 service role key |
| `PUBLIC_APP_URL` | Pages Functions | 배포 원본 URL |
| `SHARE_TOKEN_ENCRYPTION_KEY` | Pages Functions secret | 공유 토큰 AES-256-GCM 키(Base64 32 bytes) |

실제 값이 든 `.env`, `.env.local`은 커밋하지 않습니다. `.env.example`에는 변수명만 있습니다.

## Cloudflare Pages 배포

1. GitHub 저장소를 Cloudflare Pages에 연결합니다.
2. Build command는 `npm run build`, Output directory는 `dist`로 설정합니다.
3. 환경변수에 프런트 변수 두 개와 `SUPABASE_URL`, `PUBLIC_APP_URL`을 등록합니다.
4. `SUPABASE_SERVICE_ROLE_KEY`와 `SHARE_TOKEN_ENCRYPTION_KEY`는 암호화된 Secret으로 등록합니다.
5. Production/Preview 값을 각각 검토하고 배포합니다.
6. 배포 후 `dist`에 service role key나 암호화 키 문자열이 없는지 확인합니다.

암호화 키는 안전한 로컬 터미널에서 `openssl rand -base64 32`로 생성합니다. 출력값은 Git이나 일반 환경변수 파일에 저장하지 말고 `npx wrangler pages secret put SHARE_TOKEN_ENCRYPTION_KEY --project-name YOUR_PROJECT`로 Production secret에 등록합니다. Preview도 별도로 등록하십시오. 키를 분실하거나 교체하면 기존 암호화 URL은 복호화할 수 없지만 token hash 검증을 통한 기존 공유 URL 자체는 계속 동작합니다.

커스텀 not-found 설정을 사용한다면 `/admin/*`, `/share/*`가 `index.html`로 fallback되게 설정하십시오.

## Excel 업로드 규칙

관리자 > Excel Import에서 `.xlsx` 또는 `.xls`를 선택합니다. 원본은 서버로 전송하지 않고 브라우저 메모리에서 모든 시트를 읽습니다. 헤더 별칭, 반복 헤더, 상단 2~4행의 다중 헤더, 실제 병합 범위와 저장된 수식 결과를 분석합니다.

분석 후 Product Group, Item Type, Price Option, Bulk FOB와 공개/내부 Remark를 검토합니다. Sample FOB는 UI와 신규 import에서 사용하거나 계산하지 않지만 기존 DB 열과 데이터는 보존됩니다. 동일 Style의 Roller/Digital은 별도 현재 가격이며, 동일 Style + Price Option에 서로 다른 값이 중복될 때만 `Needs Decision`입니다.

실제 가격 Excel은 `.gitignore`의 `*.xlsx`, `*.xls` 규칙으로 커밋되지 않습니다. 테스트는 코드에서 생성하는 비민감 합성 워크북만 사용합니다.

## 가격 저장과 이력

직접 입력과 Confirm Import는 PostgreSQL 함수에서 처리됩니다. 같은 가격은 새 버전을 만들지 않지만 Batch snapshot에는 연결됩니다. 가격이 다르면 Change Reason이 필수이며 기존 버전을 보존합니다. 현재 버전은 Style + Price Option마다 하나입니다. `OTHER` 사유는 Public Remark (English)가 필수입니다. 한글 또는 비 ASCII legacy Remark는 Internal Remark에만 보존하고 ASCII legacy Remark만 공개 필드로 backfill합니다.

## 공유 링크

관리자 > 공유 링크에서 이름과 선택적 만료일을 입력합니다. SHA-256 hash는 검증에 사용하고, 재표시용 토큰은 서버 secret의 AES-256-GCM으로 암호화합니다. hash만 있는 기존 링크는 `Original URL unavailable`로 표시되며 복원하지 않습니다. Regenerate Link로 새 링크를 만든 뒤 확인 후 기존 링크를 해제하십시오.

공유 API는 토큰 해시, 만료, 해제를 확인하고 현재 가격에 필요한 열만 반환합니다. 응답은 `Cache-Control: no-store`이며 원본 토큰을 로그에 쓰지 않습니다. 쓰기 메서드는 405로 차단됩니다.

## RLS와 권한 구조

- `anon`: pricing 테이블 직접 권한 없음
- 로그인한 비관리자: RLS 및 RPC에서 읽기/쓰기 거부
- `admin_users` 등록 사용자: 관리자 UI와 RLS로 관리
- 공유 사용자: Supabase 직접 접근 불가, Pages Function의 제한된 GET만 가능
- service role: Pages Functions에서 링크 검증과 제한 조회에만 사용

`noindex,nofollow,noarchive`가 모든 화면에 적용됩니다. 보안을 UI 버튼 숨김에 의존하지 않습니다.

## 백업 및 복구

Supabase Dashboard의 자동 백업/PITR 가용성은 요금제를 확인하십시오. 논리 백업은 안전한 관리자 환경에서 `npx supabase db dump --linked -f backup.sql`로 생성합니다. 백업에는 가격과 사용자 식별자가 포함될 수 있으므로 암호화된 비공개 저장소에 보관하고 Git에 커밋하지 마십시오. 복구 전 별도 프로젝트에서 migration과 백업을 검증한 뒤 Supabase 공식 복구 절차를 따르십시오.

## 품질 확인

```bash
npm run lint
npm run test
npm run build
```

외부 계정이 없는 CI에서는 파서, 검색, SQL 보안 계약을 단위 테스트합니다. 로그인부터 공유 링크까지의 실제 통합 흐름은 환경변수와 migration이 적용된 Preview 환경에서 최종 확인해야 합니다.
