import { NextRequest, NextResponse } from "next/server";
import { getQtDayStatus } from "@/lib/qt-date";
import {
  getDailyWord,
  getUserQtLogsByMonth,
  upsertUserQtLog,
  getOrCreateUserProfile,
  isNotionConfigured,
} from "@/lib/notion";
import { getAuthenticatedUserId, sanitizeUserProfile } from "@/lib/security";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const qtStatus = getQtDayStatus(new Date());

    // 요청된 날짜가 없으면 00:30 KST 기준 활성 QT 날짜를 기본값으로 사용
    const targetDate = searchParams.get("date") || qtStatus.activeQtDate;
    const targetMonth =
      searchParams.get("month") || targetDate.slice(0, 7); // YYYY-MM

    const requestedUserId = searchParams.get("userId") || "guest_default";
    const sessionUserId = getAuthenticatedUserId(req);

    // 서명된 세션 쿠키와 일치하는 경우에만 해당 회원의 QT 기록 조회 허용
    const isAuthenticatedUser =
      requestedUserId !== "guest_default" && sessionUserId === requestedUserId;
    const effectiveUserId = isAuthenticatedUser
      ? requestedUserId
      : "guest_default";

    const provider = (searchParams.get("provider") || "local") as
      | "kakao"
      | "naver"
      | "google"
      | "local"
      | "demo";

    const [dailyWord, monthLogs, userProfile] = await Promise.all([
      getDailyWord(targetDate),
      getUserQtLogsByMonth(effectiveUserId, targetMonth),
      getOrCreateUserProfile({
        userId: effectiveUserId,
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
        logId: `${effectiveUserId}_${targetDate}`,
        userId: effectiveUserId,
        date: targetDate,
        isCompleted: false,
        reflection: "",
        updatedAt: "",
      },
      userProfile: sanitizeUserProfile(userProfile),
      sessionAuthenticated: isAuthenticatedUser,
      storageMode: isNotionConfigured() ? "notion" : "local-fallback",
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

    const sessionUserId = getAuthenticatedUserId(req);
    if (!sessionUserId || sessionUserId !== String(userId).trim()) {
      return NextResponse.json(
        {
          error:
            "로그인 세션이 만료되었거나 권한이 없습니다. 다시 로그인해 주세요.",
        },
        { status: 401 }
      );
    }

    const qtStatus = getQtDayStatus(new Date());
    if (date !== qtStatus.activeQtDate) {
      return NextResponse.json(
        { error: "과거 날짜에는 QT 완료 체크를 할 수 없습니다." },
        { status: 403 }
      );
    }

    const saved = await upsertUserQtLog({
      userId: sessionUserId,
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
