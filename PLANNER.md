# 📋 생명의 삶 일일 QT 웹사이트 (DailyBible) 진행 플래너

> **프로젝트 경로**: `/Users/hyg/Desktop/project/DailyBible`  
> **환경 변수 관리 규칙**: 모든 API Key 및 Secret은 프로젝트 루트의 **`.env`** 파일에서 직접 관리합니다. (Next.js 및 `npm run crawl` 스크립트가 실행 시 `.env`를 자동으로 읽어오도록 설정 완료)

---

## ✅ Phase 1. 프로젝트 기본 코드 및 아키텍처 구현 (완료)

- [x] **1-1. Next.js + TypeScript + Tailwind CSS 프로젝트 초기 구조 생성**
  - 파일: `package.json`, `tsconfig.json`, `tailwind.config.ts`, `next.config.mjs`, `.env.example`
- [x] **1-2. 새벽 00:30 KST 기준일(QT Day) 마감 로직 구현**
  - 파일: `src/lib/qt-date.ts`
  - 내용: 자정(`00:00`) ~ 새벽 `00:29:59` 사이에는 아직 새 말씀이 올라오기 전이므로 **이전 날(당일 하루)의 QT 기준일**을 유지하여 당일 QT 완료 체크를 마감할 수 있도록 처리
- [x] **1-3. 두란노 생명의 삶 본문 크롤러 구현**
  - 파일: `src/lib/crawler.ts`, `scripts/crawl-qt.ts`, `src/app/api/crawl/route.ts`
  - 내용: `euc-kr` 한글 인코딩 자동 변환, 본문 장절·제목·오늘의 찬송·절별 말씀·묵상 도우미 파싱
- [x] **1-4. 노션(Notion) 3개 데이터베이스 연동 및 로컬 폴백 저장소 구현**
  - 파일: `src/lib/notion.ts`, `src/app/api/qt/route.ts`
  - 내용: `.env`에 노션 키 입력 전에도 로컬(`.data/local-store.json`)에서 즉시 동작하며, 키 입력 시 노션 DB와 실시간 동기화
- [x] **1-5. 카카오 · 네이버 · 구글 3사 소셜 로그인 & 최초 닉네임 온보딩 구현**
  - 파일: `src/lib/auth-options.ts`, `src/app/api/auth/[...nextauth]/route.ts`, `src/app/api/user/profile/route.ts`
- [x] **1-6. 메인 QT 말씀 뷰어 + 월간 출석 캘린더 + 선택형 느낀점 에디터 UI 구현**
  - 파일: `src/app/page.tsx`
- [x] **1-7. GitHub Actions 일일 00:30 KST 자동 크롤링 워크플로우 작성**
  - 파일: `.github/workflows/crawl-qt.yml` (`cron: "30 15 * * *"` UTC = 매일 00:30 KST)

---

## ✅ Phase 2. 로컬 패키지 설치 · 빌드 · 크롤러 검증 (완료)

- [x] **2-1. 패키지 설치 (`npm install`) 및 Git 저장소 초기화 (`git init`)**
- [x] **2-2. TypeScript 타입 검증 (`npx tsc --noEmit`) 및 프로덕션 빌드 검증 (`npm run build`)**
- [x] **2-3. 크롤러 단독 실행 검증 (`npm run crawl`)**
  - `.data/local-store.json`에 오늘자 생명의 삶 본문(`빌레몬서 1 : 1~14 | 사랑으로 결단하는 용서의 복음`) 저장 확인 완료
- [x] **2-4. 로컬 개발 서버 실행 (`npm run dev`) 및 브라우저 확인**
  - 터미널에서 `npm run dev` 실행 후 `http://localhost:3000` (메인 QT 웹페이지) 및 `http://localhost:3000/planner` (플래너 & `.env` 설정 가이드 웹페이지) 접속

---

## ✅ Phase 3. `.env` 파일 생성 및 노션(Notion) DB 3개 연동 (완료)

> 프로젝트 루트의 **`.env`** 파일에 노션 API 토큰 및 3개 DB ID가 모두 자동 설정되었고, 노션 테이블 스키마 구축 및 초기 말씀 적재까지 완료되었습니다.

- [x] **3-1. 노션 API 통합(Integration) 토큰 발급 (`dailybible`)**
- [x] **3-2. 노션 워크스페이스에 3개 데이터베이스 생성 및 속성(Property) 자동 구축 완료**
  1. **`말씀 DB` (`Daily_Word`, ID: `40cc3da9-50be-8082-bc24-dfaa7c4e53a4`)**
     - 생성된 컬럼: `Title` (제목), `Date` (텍스트), `Scripture` (텍스트), `ContentJson` (텍스트)
  2. **`회원 DB` (`Users`, ID: `40cc3da9-50be-803d-8c26-dab05dfcc061`)**
     - 생성된 컬럼: `UserId` (제목), `Provider` (텍스트), `Email` (텍스트), `Nickname` (텍스트), `IsOnboarded` (체크박스)
  3. **`QT 기록 DB` (`QT_Logs`, ID: `40cc3da9-50be-8085-9400-eee4a12458f2`)**
     - 생성된 컬럼: `LogId` (제목), `UserId` (텍스트), `Date` (텍스트), `IsCompleted` (체크박스), `Reflection` (텍스트), `UpdatedAt` (텍스트)
- [x] **3-3. 3개 데이터베이스에 노션 API 통합(Integration) 연결 권한 부여 및 말씀 적재 완료**

---

## 🔐 Phase 4. 카카오 · 네이버 · 구글 소셜 로그인 키 발급 (사용자 설정 필요)

- [ ] **4-1. 카카오 로그인 설정 ([Kakao Developers](https://developers.kakao.com/))**
  - Redirect URI 등록: `http://localhost:3000/api/auth/callback/kakao`
  - `.env`의 `KAKAO_CLIENT_ID`, `KAKAO_CLIENT_SECRET`에 입력
- [ ] **4-2. 네이버 로그인 설정 ([Naver Developers](https://developers.naver.com/))**
  - Callback URL 등록: `http://localhost:3000/api/auth/callback/naver`
  - `.env`의 `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`에 입력
- [ ] **4-3. 구글 로그인 설정 ([Google Cloud Console](https://console.cloud.google.com/))**
  - 승인된 리디렉션 URI 등록: `http://localhost:3000/api/auth/callback/google`
  - `.env`의 `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`에 입력

---

## ☁️ Phase 5. GitHub 저장소 업로드 & Vercel 배포

- [x] **5-1. GitHub 원격 저장소(`hope9901/DailyBible`) 생성 및 푸시 완료**
- [x] **5-2. GitHub Actions Secrets 등록 완료 (매일 00:30 자동 크롤링용)**
  - `NOTION_API_KEY`, `NOTION_DAILY_WORD_DB_ID`, `NOTION_USERS_DB_ID`, `NOTION_QT_LOGS_DB_ID` 모두 자동 등록 완료
- [ ] **5-3. Vercel 프로젝트 연결 및 배포 ([Vercel](https://vercel.com/))**
  - GitHub 저장소(`hope9901/DailyBible`)를 Import하고 아래 환경 변수를 등록 후 Deploy 클릭
