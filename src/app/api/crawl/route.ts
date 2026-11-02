import { NextRequest, NextResponse } from "next/server";
import { crawlDurannoQt } from "@/lib/crawler";
import { saveDailyWord, isNotionConfigured } from "@/lib/notion";
import { getKstComponents } from "@/lib/qt-date";

async function runCrawl(targetDate: string) {
  const crawled = await crawlDurannoQt(targetDate);
  await saveDailyWord(crawled);

  return NextResponse.json({
    success: true,
    date: targetDate,
    dailyWord: crawled,
    storageMode: isNotionConfigured() ? "notion" : "local-fallback",
  });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const targetDate =
      searchParams.get("date") || getKstComponents(new Date()).dateString;
    return await runCrawl(targetDate);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Crawl failed" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const targetDate =
      body.date || getKstComponents(new Date()).dateString;
    return await runCrawl(targetDate);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Crawl failed" },
      { status: 500 }
    );
  }
}
