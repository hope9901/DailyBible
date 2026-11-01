import * as cheerio from "cheerio";
import iconv from "iconv-lite";

export type BibleTranslation = "krv" | "klb"; // krv: 개역개정, klb: 우리말성경

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
  sections: BibleSection[]; // 개역개정(기본) 소제목별 성경 본문 절 목록
  sectionsKlb: BibleSection[]; // 우리말성경 소제목별 성경 본문 절 목록
  meditationGuide: string[]; // 묵상 도우미 해설 목록
  sourceUrl: string;
  crawledAt: string;
}

/**
 * 기본 내장 샘플 데이터 (두란노 생명의 삶 실제 본문 기준 - 개역개정 & 우리말성경 모두 포함)
 */
export const FALLBACK_DAILY_WORDS: Record<string, DailyWordData> = {
  "2026-11-01": {
    date: "2026-11-01",
    title: "사랑으로 결단하는 용서의 복음",
    scripture: "빌레몬서 1 : 1~14",
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
    sectionsKlb: [
      {
        subheading: "빌레몬의 사랑과 믿음을 칭찬함 1:1~7",
        verses: [
          {
            verse: 1,
            text: "그리스도 예수를 위해 갇힌 사람이 된 바울과 형제 디모데는 우리의 사랑하는 사람이며 동역자인 빌레몬과",
          },
          {
            verse: 2,
            text: "자매 압비아와 우리와 함께 군사가 된 아킵보와 그대의 가정 교회에 편지를 씁니다.",
          },
          {
            verse: 3,
            text: "하나님 우리 아버지와 주 예수 그리스도의 은혜와 평강이 여러분에게 있기를 빕니다.",
          },
          {
            verse: 4,
            text: "내가 기도할 때 그대를 기억하고 내 하나님께 항상 감사드리는 것은",
          },
          {
            verse: 5,
            text: "주 예수와 모든 성도에 대한 그대의 사랑과 믿음에 대해 들었기 때문입니다.",
          },
          {
            verse: 6,
            text: "그대가 믿음 안에서 교제하므로 우리 가운데 있는 모든 선한 것을 깨달아 그리스도께 이르게 되기를 바랍니다.",
          },
          {
            verse: 7,
            text: "형제여, 나는 그대의 사랑으로 큰 기쁨과 위로를 얻었습니다. 이는 성도들의 마음이 그대로 인해 새 힘을 얻었기 때문입니다.",
          },
        ],
      },
      {
        subheading: "오네시모를 위한 부탁 1:8~14",
        verses: [
          {
            verse: 8,
            text: "그러므로 나는 그리스도 안에서 그대가 마땅히 행할 것을 매우 담대하게 명령할 수도 있지만",
          },
          {
            verse: 9,
            text: "오히려 사랑으로 인해 간곡하게 부탁합니다. 이렇게 나이가 많고 또 지금은 예수 그리스도를 위해 갇힌 사람이 된 나 바울은",
          },
          {
            verse: 10,
            text: "갇힌 중에서 낳은 내 아들 오네시모를 위해 그대에게 간곡히 부탁합니다.",
          },
          {
            verse: 11,
            text: "전에는 그가 그대에게 무익한 사람이었으나 이제는 그대와 내게 유익한 사람이 되었습니다.",
          },
          {
            verse: 12,
            text: "내가 그를 그대에게 돌려보내는데 그는 내 심장입니다.",
          },
          {
            verse: 13,
            text: "나는 그를 내 곁에 머물게 해서 내가 복음을 위해 갇혀 있는 동안 그대 대신 나를 돕게 하고 싶었습니다.",
          },
          {
            verse: 14,
            text: "그러나 그대의 동의 없이는 내가 아무것도 하고 싶지 않습니다. 이는 그대의 선한 일이 억지에 의해서가 아니라 자발적으로 하는 일이 되게 하려는 것입니다.",
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

async function fetchDurannoVersionHtml(
  date: string,
  div: "k" | "w"
): Promise<string> {
  const url = `https://www.duranno.com/qt/view/bible.asp?qtDate=${encodeURIComponent(date)}&d=${div}`;
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      Cookie: `biblediv=${div}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} from Duranno (${div})`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const contentType = response.headers.get("content-type") || "";
  const asciiPreview = buffer.slice(0, 1024).toString("ascii").toLowerCase();
  const isEucKr =
    contentType.toLowerCase().includes("euc-kr") ||
    asciiPreview.includes("euc-kr") ||
    asciiPreview.includes("ks_c_5601");

  return isEucKr
    ? iconv.decode(buffer, "euc-kr")
    : buffer.toString("utf-8");
}

/**
 * 두란노 생명의 삶 웹페이지에서 특정 날짜(YYYY-MM-DD)의
 * 개역개정(d=k)과 우리말성경(d=w) 본문을 모두 크롤링합니다.
 */
export async function crawlDurannoQt(date: string): Promise<DailyWordData> {
  const sourceUrl = `https://www.duranno.com/qt/view/bible.asp?qtDate=${encodeURIComponent(date)}`;

  try {
    const [htmlKrv, htmlKlb] = await Promise.all([
      fetchDurannoVersionHtml(date, "k"),
      fetchDurannoVersionHtml(date, "w").catch(() => ""),
    ]);

    const parsedKrv = parseDurannoHtml(htmlKrv, date, sourceUrl);
    const parsedKlb = htmlKlb
      ? parseDurannoHtml(htmlKlb, date, sourceUrl)
      : null;

    if (
      parsedKrv.sections.length > 0 &&
      parsedKrv.sections[0].verses.length > 0
    ) {
      return {
        ...parsedKrv,
        sectionsKlb:
          parsedKlb &&
          parsedKlb.sections.length > 0 &&
          parsedKlb.sections[0].verses.length > 0
            ? parsedKlb.sections
            : parsedKrv.sections,
      };
    }

    if (FALLBACK_DAILY_WORDS[date]) {
      return FALLBACK_DAILY_WORDS[date];
    }
    return parsedKrv;
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
 * 두란노 생명의 삶 HTML 본문에서 제목, 성경 장절, 절별 말씀, 묵상 도우미를 추출합니다.
 */
export function parseDurannoHtml(
  html: string,
  date: string,
  sourceUrl: string
): DailyWordData {
  const $ = cheerio.load(html);

  let scripture = $(".font-size h1 span").first().text().replace(/\s+/g, " ").trim();
  let title = $(".font-size h1 em").first().text().replace(/\s+/g, " ").trim();

  const sections: BibleSection[] = [];
  const bibleContainer = $(".bible");

  if (bibleContainer.length > 0) {
    let currentSection: BibleSection = {
      subheading: scripture || "오늘의 본문 말씀",
      verses: [],
    };

    bibleContainer.children().each((_, el) => {
      const tag = $(el);
      if (tag.is("p.title")) {
        if (currentSection.verses.length > 0) {
          sections.push(currentSection);
        }
        currentSection = {
          subheading: tag.text().replace(/\s+/g, " ").trim(),
          verses: [],
        };
      } else if (tag.is("table")) {
        const verseNum = parseInt(tag.find("th").text().trim(), 10);
        const verseText = tag.find("td").text().replace(/\s+/g, " ").trim();
        if (!isNaN(verseNum) && verseText) {
          currentSection.verses.push({
            verse: verseNum,
            text: verseText,
          });
        }
      }
    });

    if (currentSection.verses.length > 0) {
      sections.push(currentSection);
    }
  }

  // 텍스트 기반 폴백 파싱
  $("script, style, noscript").remove();
  const rawText = $("body")
    .text()
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  if (!scripture || !title) {
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
    }
  }

  if (sections.length === 0) {
    const startMarkerIdx = rawText.findIndex(
      (l) => l.includes("개역개정") || l.includes("역본 선택")
    );
    const endMarkerIdx = rawText.findIndex(
      (l) =>
        l.includes("아멘하셨습니다") ||
        l.includes("저작권은") ||
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

      const verseMatch = line.match(/^(\d{1,3})\s+(.+)$/);
      if (verseMatch) {
        currentSection.verses.push({
          verse: parseInt(verseMatch[1], 10),
          text: verseMatch[2].trim(),
        });
        continue;
      }

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
  }

  // 묵상 도우미 추출
  const meditationGuide: string[] = [];
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
    sections,
    sectionsKlb: sections,
    meditationGuide,
    sourceUrl,
    crawledAt: new Date().toISOString(),
  };
}
