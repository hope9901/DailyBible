import { crawlDurannoQt } from "../src/lib/crawler";
import { saveDailyWord, isNotionConfigured } from "../src/lib/notion";
import { getKstComponents } from "../src/lib/qt-date";

async function main() {
  // 매일 00:30 KST에 실행될 때 당일 KST 날짜(YYYY-MM-DD)의 생명의 삶 말씀을 수집합니다.
  const targetDate =
    process.env.TARGET_DATE?.trim() || getKstComponents(new Date()).dateString;

  console.log(
    `[DailyQT Crawler] Starting crawl for date: ${targetDate} (KST)...`
  );

  const wordData = await crawlDurannoQt(targetDate);

  console.log(`[DailyQT Crawler] Crawled successfully:`);
  console.log(` - Date: ${wordData.date}`);
  console.log(` - Scripture: ${wordData.scripture}`);
  console.log(` - Title: ${wordData.title}`);
  console.log(` - Sections: ${wordData.sections.length}`);

  await saveDailyWord(wordData);

  if (isNotionConfigured()) {
    console.log(`[DailyQT Crawler] Saved to Notion Daily_Word DB.`);
  } else {
    console.log(
      `[DailyQT Crawler] Saved to local store (.data/local-store.json). Set NOTION_API_KEY and NOTION_DAILY_WORD_DB_ID to sync with Notion.`
    );
  }
}

main().catch((err) => {
  console.error("[DailyQT Crawler] Fatal error:", err);
  process.exit(1);
});
