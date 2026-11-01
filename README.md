# 생명의 삶 일일 QT & 묵상 캘린더 (DailyBible)

매일 새벽 **00시 30분(KST)**에 두란노 **생명의 삶** 본문 말씀을 자동으로 크롤링하여 노션(Notion) 데이터베이스에 저장하고, 00:30 새 말씀 업데이트 전까지 당일 QT 완료 여부 체크와 선택형 느낀점(은혜 받은점)을 기록할 수 있는 웹 서비스입니다.

---

## 1. 주요 기능 요약

1. **00:30 KST 기준 일일 QT 마감 로직 (`src/lib/qt-date.ts`)**
   - 매일 새벽 00:30에 새 말씀이 크롤링되기 전(`00:00 ~ 00:29:59 KST`)까지는 **이전 날(당일 하루)의 QT 기준일**이 유지되어, 자정이 살짝 넘은 시간에도 오늘 하루 QT를 완료했는지 체크하고 마감할 수 있습니다.
2. **두란노 생명의 삶 자동 크롤러 & GitHub Actions (`src/lib/crawler.ts`, `.github/workflows/crawl-qt.yml`)**
   - 한국 시간 매일 00:30(`cron: "30 15 * * *"` UTC)에 GitHub Actions가 실행되어 오늘의 본문 말씀, 찬송가, 소제목별 절 본문, 묵상 도우미를 수집해 노션 DB에 저장합니다.
3. **카카오 · 네이버 · 구글 소셜 로그인 & 닉네임 설정 (`src/lib/auth-options.ts`)**
   - 3개 소셜 로그인 Provider가 모두 연결되어 있으며, 최초 로그인 시 닉네임(이름)만 간단히 입력받아 사용자별로 출석과 묵상 노트를 관리합니다.
4. **선택형 은혜 나눔(느낀점) 기록 (`src/app/page.tsx`)**
   - 캘린더에서 **읽음 완료 체크만 단독**으로 할 수도 있고, 원할 때만 **`+ 느낀점 작성하기`**를 열어 은혜 받은점을 함께 기록할 수도 있습니다.

---

## 2. 노션(Notion) 데이터베이스 3개 생성 방법

노션에서 새 페이지를 만들고 아래 3개의 **데이터베이스(전체 페이지 또는 인라인)**를 생성한 뒤, [Notion Developers](https://www.notion.so/my-integrations)에서 발급한 API 통합(Integration)을 각 데이터베이스 우측 상단 `•••` -> `연결 추가(Connect to)`로 연결해 주세요.

### ① `Daily_Word` DB (일일 말씀 저장소)
| 속성 이름 (대소문자 일치) | 노션 속성 유형 (Type) | 설명 |
| :--- | :--- | :--- |
| `Title` | **제목 (Title)** | `2026-11-01 \| 사랑으로 결단하는 용서의 복음` |
| `Date` | **텍스트 (Text / Rich Text)** | `YYYY-MM-DD` (예: `2026-11-01`) |
| `Scripture` | **텍스트 (Text / Rich Text)** | 성경 본문 장절 (예: `빌레몬서 1 : 1~14`) |
| `ContentJson` | **텍스트 (Text / Rich Text)** | 절별 본문 및 묵상 도우미 JSON 데이터 |

### ② `Users` DB (회원 프로필 저장소)
| 속성 이름 (대소문자 일치) | 노션 속성 유형 (Type) | 설명 |
| :--- | :--- | :--- |
| `UserId` | **제목 (Title)** | 소셜 로그인 고유 식별자 (예: `kakao_12345`) |
| `Provider` | **텍스트 (Text / Rich Text)** | `kakao` / `naver` / `google` |
| `Email` | **텍스트 (Text / Rich Text)** | 사용자 이메일 |
| `Nickname` | **텍스트 (Text / Rich Text)** | 사용자가 설정한 이름/닉네임 |
| `IsOnboarded` | **체크박스 (Checkbox)** | 최초 닉네임 입력 완료 여부 |

### ③ `QT_Logs` DB (사용자별 일일 QT 체크 & 느낀점 저장소)
| 속성 이름 (대소문자 일치) | 노션 속성 유형 (Type) | 설명 |
| :--- | :--- | :--- |
| `LogId` | **제목 (Title)** | `${UserId}_${Date}` 고유 키 |
| `UserId` | **텍스트 (Text / Rich Text)** | 사용자 고유 ID |
| `Date` | **텍스트 (Text / Rich Text)** | QT 기준 날짜 (`YYYY-MM-DD`) |
| `IsCompleted` | **체크박스 (Checkbox)** | 오늘 QT 읽음 완료 체크 여부 |
| `Reflection` | **텍스트 (Text / Rich Text)** | 오늘 느낀점 / 은혜 받은점 (미작성 시 빈칸) |
| `UpdatedAt` | **텍스트 (Text / Rich Text)** | 마지막 체크/작성 시각 |

---

## 3. 소셜 로그인 Redirect URI 설정 (카카오 · 네이버 · 구글)

로컬(`http://localhost:3000`) 및 Vercel 배포 도메인(`https://your-domain.vercel.app`) 기준으로 각 개발자 센터에 아래 Redirect URI를 등록합니다.

- **카카오 ([Kakao Developers](https://developers.kakao.com))**:
  - `http://localhost:3000/api/auth/callback/kakao`
  - `https://your-domain.vercel.app/api/auth/callback/kakao`
- **네이버 ([Naver Developers](https://developers.naver.com))**:
  - `http://localhost:3000/api/auth/callback/naver`
  - `https://your-domain.vercel.app/api/auth/callback/naver`
- **구글 ([Google Cloud Console](https://console.cloud.google.com))**:
  - `http://localhost:3000/api/auth/callback/google`
  - `https://your-domain.vercel.app/api/auth/callback/google`

---

## 4. 로컬 실행 및 GitHub Actions / Vercel 배포 방법

```bash
# 1. 패키지 설치
npm install

# 2. 환경 변수 파일 생성 (.env.example 복사 후 값 입력)
cp .env.example .env.local

# 3. 수동 크롤링 테스트 (두란노 생명의 삶 -> 노션/로컬 DB 저장)
npm run crawl

# 4. 개발 서버 실행
npm run dev
```

- **GitHub Actions 설정**: GitHub 저장소의 `Settings > Secrets and variables > Actions`에 `NOTION_API_KEY`와 `NOTION_DAILY_WORD_DB_ID`를 등록하면 매일 새벽 **00:30 KST**에 자동으로 말씀이 수집됩니다.
- **Vercel 배포**: GitHub 저장소를 Vercel에 연결하고 `.env.local`의 환경 변수들을 Vercel Project Settings에 동일하게 등록하면 배포가 완료됩니다.
