import * as cheerio from "cheerio";
import iconv from "iconv-lite";

export interface BibleVerse {
  verse: number;
  text: string;
}

export interface BibleSection {
  subheading: string;
  verses: BibleVerse[];
}

export interface DailyWordData {
  date: string; // YYYY-MM-DD
  title: string; // 말씀 제목 (예: 사랑으로 결단하는 용서의 복음)
  scripture: string; // 본문 장절 (예: 빌레몬서 1 : 1~14)
  hymn: string; // 오늘의 찬송
  sections: BibleSection[]; // 소제목별 성경 본문 절 목록
  meditationGuide: string[]; // 묵상 도우미 해설 목록
  sourceUrl: string;
  crawledAt: string;
}

/**
 * 기본 내장 샘플 데이터 (두란노 생명의 삶 실제 본문 기준)
 * 크롤링 전이거나 오프라인 테스트 시에도 즉시 화면에서 말씀을 볼 수 있도록 제공합니다.
 */
export const FALLBACK_DAILY_WORDS: Record<string, DailyWordData> = {
  "2026-11-01": {
    date: "2026-11-01",
    title: "사랑으로 결단하는 용서의 복음",
    scripture: "빌레몬서 1 : 1~14",
    hymn: "새찬송가 218장 (네 맘과 정성을 다하여서)\n네 맘과 정성을 다하여서 주 너의 하나님을 사랑하라 네 몸을 아끼고 사랑하듯 형제와 이웃을 사랑하라 주께서 우리게 명하시니 그 명령 따라서 살아가리",
    sections: [
      {
        subheading: "빌레몬의 사랑과 믿음을 칭찬함 1:1~7",
        verses: [
          {
            verse: 1,
            text: "그리스도 예수를 위하여 갇힌 자 된 바울과 및 형제 디모데는 우리의 사랑을 받는 자요 동역자인 빌레몬과",
          },
          {
            verse: 2,
            text: "자매 압비아와 우리와 함께 병사 된 아킵보와 네 집에 있는 교회에 편지하노니",
          },
          {
            verse: 3,
            text: "하나님 우리 아버지와 주 예수 그리스도로부터 은혜와 평강이 너희에게 있을지어다",
          },
          {
            verse: 4,
            text: "내가 항상 내 하나님께 감사하고 기도할 때에 너를 말함은",
          },
          {
            verse: 5,
            text: "주 예수와 및 모든 성도에 대한 네 사랑과 믿음이 있음을 들음이니",
          },
          {
            verse: 6,
            text: "이로써 네 믿음의 교제가 우리 가운데 있는 선을 알게 하고 그리스도께 이르도록 역사하느니라",
          },
          {
            verse: 7,
            text: "형제여 성도들의 마음이 너로 말미암아 평안함을 얻었으니 내가 너의 사랑으로 많은 기쁨과 위로를 받았노라",
          },
        ],
      },
      {
        subheading: "오네시모를 위한 부탁 1:8~14",
        verses: [
          {
            verse: 8,
            text: "이러므로 내가 그리스도 안에서 아주 담대하게 네게 마땅한 일로 명할 수도 있으나",
          },
          {
            verse: 9,
            text: "도리어 사랑으로써 간구하노라 나이가 많은 나 바울은 지금 또 예수 그리스도를 위하여 갇힌 자 되어",
          },
          {
            verse: 10,
            text: "갇힌 중에서 낳은 아들 오네시모를 위하여 네게 간구하노라",
          },
          {
            verse: 11,
            text: "그가 전에는 네게 무익하였으나 이제는 나와 네게 유익하므로",
          },
          {
            verse: 12,
            text: "네게 그를 돌려 보내노니 그는 내 심복이라",
          },
          {
            verse: 13,
            text: "그를 내게 머물러 있게 하여 내 복음을 위하여 갇힌 중에서 네 대신 나를 섬기게 하고자 하나",
          },
          {
            verse: 14,
            text: "다만 네 승낙이 없이는 내가 아무 것도 하기를 원하지 아니하노니 이는 너의 선한 일이 억지 같이 되지 아니하고 자의로 되게 하려 함이라",
          },
        ],
      },
    ],
    meditationGuide: [
      "빌레몬, 압비아, 아킵보(1~2절): 골로새 성도들은 빌레몬의 집에서 가정교회로 모였다. 압비아는 빌레몬의 아내로, 아킵보는 동역자로 알려져 있다.",
      "오네시모(10절): '유익한' 또는 '쓸모 있는'이란 뜻의 이름을 지닌, 빌레몬의 종이다.",
    ],
    sourceUrl: "https://www.duranno.com/qt/view/bible.asp?qtDate=2026-11-01",
    crawledAt: "2026-11-01T00:30:00+09:00",
  },
};

/**
 * 두란노 생명의 삶 웹페이지에서 특정 날짜(YYYY-MM-DD)의 본문 말씀을 크롤링합니다.
 */
export async function crawlDurannoQt(date: string): Promise<DailyWordData> {
  const sourceUrl = `https://www.duranno.com/qt/view/bible.asp?qtDate=${encodeURIComponent(date)}`;

  try {
    const response = await fetch(sourceUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} from Duranno`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Content-Type 또는 meta 태그에서 인코딩 판별 (두란노 ASP 페이지는 주로 euc-kr 사용)
    const contentType = response.headers.get("content-type") || "";
    const asciiPreview = buffer.slice(0, 1024).toString("ascii").toLowerCase();
    const isEucKr =
      contentType.toLowerCase().includes("euc-kr") ||
      asciiPreview.includes("euc-kr") ||
      asciiPreview.includes("ks_c_5601");

    const html = isEucKr
      ? iconv.decode(buffer, "euc-kr")
      : buffer.toString("utf-8");

    const parsed = parseDurannoHtml(html, date, sourceUrl);
    if (parsed.sections.length > 0 && parsed.sections[0].verses.length > 0) {
      return parsed;
    }

    if (FALLBACK_DAILY_WORDS[date]) {
      return FALLBACK_DAILY_WORDS[date];
    }
    return parsed;
  } catch (error) {
    console.warn(`[Crawler] Failed to fetch live page for ${date}:`, error);
    if (FALLBACK_DAILY_WORDS[date]) {
      return FALLBACK_DAILY_WORDS[date];
    }
    return {
      ...FALLBACK_DAILY_WORDS["2026-11-01"],
      date,
      sourceUrl,
    };
  }
}

/**
 * 두란노 생명의 삶 HTML 본문에서 제목, 성경 장절, 찬송가, 절별 말씀, 묵상 도우미를 추출합니다.
 */
export function parseDurannoHtml(
  html: string,
  date: string,
  sourceUrl: string
): DailyWordData {
  const $ = cheerio.load(html);

  // 스크립트/스타일 제거 후 순수 텍스트 라인 배열 추출
  $("script, style, noscript").remove();

  const rawText = $("body")
    .text()
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  let scripture = "";
  let title = "";
  let hymnTitle = "";
  let hymnLyrics = "";
  const sections: BibleSection[] = [];
  const meditationGuide: string[] = [];

  // 1. 성경 장절 + 제목 추출 (예: "빌레몬서 1 : 1~14사랑으로 결단하는 용서의 복음" 또는 분리된 라인)
  for (let i = 0; i < rawText.length; i++) {
    const line = rawText[i];
    const matchCombined = line.match(
      /^([가-힣]+(?:\s*[가-힣]+)?\s*\d+\s*:\s*\d+\s*~\s*\d+)\s*(.+)$/
    );
    if (matchCombined) {
      scripture = matchCombined[1].trim();
      title = matchCombined[2].trim();
      break;
    }
    const matchScriptureOnly = line.match(
      /^([가-힣]+(?:\s*[가-힣]+)?\s*\d+\s*:\s*\d+\s*~\s*\d+)$/
    );
    if (matchScriptureOnly && rawText[i + 1]) {
      scripture = matchScriptureOnly[1].trim();
      title = rawText[i + 1].trim();
      break;
    }
  }

  // 2. 오늘의 찬송 추출
  const hymnIndex = rawText.findIndex((l) => l.includes("오늘의 찬송"));
  if (hymnIndex !== -1) {
    for (let i = hymnIndex + 1; i < Math.min(hymnIndex + 6, rawText.length); i++) {
      const line = rawText[i];
      if (line.includes("역본 선택") || line.includes("개역개정")) break;
      if (line.startsWith("(") && line.endsWith(")")) {
        hymnTitle = line.slice(1, -1).trim();
      } else if (!hymnLyrics) {
        hymnLyrics = line;
      }
    }
  }

  // 3. 본문 말씀 섹션 및 절(Verse) 추출
  const startMarkerIdx = rawText.findIndex(
    (l) => l.includes("개역개정") || l.includes("역본 선택")
  );
  const endMarkerIdx = rawText.findIndex(
    (l) =>
      l.includes("아멘하셨습니다") ||
      l.includes("저작권은 대한성서공회") ||
      l.includes("묵상 도우미")
  );

  const verseRegion =
    startMarkerIdx !== -1
      ? rawText.slice(
          startMarkerIdx + 1,
          endMarkerIdx !== -1 ? endMarkerIdx : rawText.length
        )
      : rawText;

  let currentSection: BibleSection = {
    subheading: scripture || "오늘의 본문 말씀",
    verses: [],
  };

  for (const line of verseRegion) {
    if (
      line.includes("우리말성경") ||
      line.includes("개역개정") ||
      line.includes("역본 선택")
    ) {
      continue;
    }

    // 절 번호 + 본문 매칭 (예: "1 그리스도 예수를 위하여...")
    const verseMatch = line.match(/^(\d{1,3})\s+(.+)$/);
    if (verseMatch) {
      const verseNum = parseInt(verseMatch[1], 10);
      const verseText = verseMatch[2].trim();
      currentSection.verses.push({
        verse: verseNum,
        text: verseText,
      });
      continue;
    }

    // 소제목 매칭 (예: "빌레몬의 사랑과 믿음을 칭찬함 1:1~7")
    if (/\d+\s*:\s*\d+/.test(line) && line.length < 60) {
      if (currentSection.verses.length > 0) {
        sections.push(currentSection);
      }
      currentSection = {
        subheading: line,
        verses: [],
      };
    }
  }

  if (currentSection.verses.length > 0) {
    sections.push(currentSection);
  }

  // 4. 묵상 도우미 추출
  const helperIdx = rawText.findIndex((l) => l === "묵상 도우미");
  if (helperIdx !== -1) {
    for (let i = helperIdx + 1; i < rawText.length; i++) {
      const line = rawText[i];
      if (
        line.includes("회사소개") ||
        line.includes("이용약관") ||
        line.includes("Copyright")
      ) {
        break;
      }
      if (line.startsWith("-")) {
        meditationGuide.push(line.replace(/^-\s*/, "").trim());
      } else if (meditationGuide.length > 0 && line.length > 10) {
        meditationGuide[meditationGuide.length - 1] += ` ${line}`;
      }
    }
  }

  return {
    date,
    title: title || "오늘의 생명의 삶 QT",
    scripture: scripture || "오늘의 본문",
    hymn: [hymnTitle, hymnLyrics].filter(Boolean).join("\n"),
    sections,
    meditationGuide,
    sourceUrl,
    crawledAt: new Date().toISOString(),
  };
}
