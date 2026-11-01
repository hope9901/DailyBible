import { NextRequest, NextResponse } from "next/server";
import { crawlDurannoQt } from "@/lib/crawler";
import { saveDailyWord, isNotionConfigured } from "@/lib/notion";
import { getKstComponents } from "@/lib/qt-date";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const targetDate =
      body.date || getKstComponents(new Date()).dateString;

    const crawled = await crawlDurannoQt(targetDate);
    await saveDailyWord(crawled);

    return NextResponse.json({
      success: true,
      date: targetDate,
      dailyWord: crawled,
      storageMode: isNotionConfigured() ? "notion" : "local-fallback",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Crawl failed" },
      { status: 500 }
    );
  }
}
