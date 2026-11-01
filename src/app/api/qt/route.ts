import { NextRequest, NextResponse } from "next/server";
import { getQtDayStatus } from "@/lib/qt-date";
import {
  getDailyWord,
  getUserQtLogsByMonth,
  upsertUserQtLog,
  getOrCreateUserProfile,
  isNotionConfigured,
} from "@/lib/notion";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const qtStatus = getQtDayStatus(new Date());

    // 요청된 날짜가 없으면 00:30 KST 기준 활성 QT 날짜를 기본값으로 사용
    const targetDate = searchParams.get("date") || qtStatus.activeQtDate;
    const targetMonth =
      searchParams.get("month") || targetDate.slice(0, 7); // YYYY-MM
    const userId = searchParams.get("userId") || "guest_default";
    const provider = (searchParams.get("provider") || "kakao") as
      | "kakao"
      | "naver"
      | "google"
      | "demo";

    const [dailyWord, monthLogs, userProfile] = await Promise.all([
      getDailyWord(targetDate),
      getUserQtLogsByMonth(userId, targetMonth),
      getOrCreateUserProfile({
        userId,
        provider,
        email: "",
        defaultName: "묵상하는 성도",
      }),
    ]);

    return NextResponse.json({
      qtStatus,
      selectedDate: targetDate,
      selectedMonth: targetMonth,
      dailyWord,
      monthLogs,
      currentDateLog: monthLogs[targetDate] || {
        logId: `${userId}_${targetDate}`,
        userId,
        date: targetDate,
        isCompleted: false,
        reflection: "",
        updatedAt: "",
      },
      userProfile,
      storageMode: isNotionConfigured() ? "notion" : "local-fallback",
      oauthConfigured: {
        kakao: Boolean(process.env.KAKAO_CLIENT_ID),
        naver: Boolean(process.env.NAVER_CLIENT_ID),
        google: Boolean(process.env.GOOGLE_CLIENT_ID),
      },
    });
  } catch (error: any) {
    console.error("[API /api/qt GET] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to load QT data" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, date, isCompleted, reflection } = body;

    if (!userId || !date) {
      return NextResponse.json(
        { error: "userId and date are required" },
        { status: 400 }
      );
    }

    const saved = await upsertUserQtLog({
      userId,
      date,
      isCompleted: Boolean(isCompleted),
      reflection: typeof reflection === "string" ? reflection : undefined,
    });

    return NextResponse.json({
      success: true,
      log: saved,
      storageMode: isNotionConfigured() ? "notion" : "local-fallback",
    });
  } catch (error: any) {
    console.error("[API /api/qt POST] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to save QT check" },
      { status: 500 }
    );
  }
}
