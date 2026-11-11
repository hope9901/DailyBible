import { NextRequest, NextResponse } from "next/server";
import {
  registerOrLoginUser,
  updateUserProfileSettings,
} from "@/lib/notion";
import {
  checkLoginRateLimit,
  recordLoginFailure,
  clearLoginFailures,
  setSessionCookie,
  clearSessionCookie,
  getAuthenticatedUserId,
  sanitizeUserProfile,
} from "@/lib/security";
import type { BibleTranslation } from "@/lib/crawler";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      action,
      userId,
      nickname,
      password,
      currentPassword,
      newPassword,
      preferredTranslation,
      provider,
    } = body;

    // 0. 로그아웃: HttpOnly 세션 쿠키 제거
    if (action === "logout") {
      const res = NextResponse.json({ success: true, ok: true });
      clearSessionCookie(res);
      return res;
    }

    if (!userId || !String(userId).trim()) {
      return NextResponse.json(
        { ok: false, error: "아이디가 필요합니다." },
        { status: 400 }
      );
    }

    const cleanUserId = String(userId).trim();

    // 1. 회원가입 또는 로그인
    if (action === "register" || action === "login") {
      const ip =
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
      const rateKey = `${ip}:${cleanUserId}`;

      if (action === "login") {
        const rateCheck = checkLoginRateLimit(rateKey);
        if (!rateCheck.allowed) {
          return NextResponse.json(
            {
              ok: false,
              error: `로그인 시도가 너무 많습니다. ${rateCheck.retryAfterSeconds}초 후 다시 시도해 주세요.`,
            },
            { status: 429 }
          );
        }
      }

      const result = await registerOrLoginUser({
        mode: action,
        userId: cleanUserId,
        password: password ? String(password) : "",
        nickname: nickname ? String(nickname).trim() : undefined,
        preferredTranslation: (preferredTranslation === "klb"
          ? "klb"
          : "krv") as BibleTranslation,
        provider: provider || "local",
      });

      if (!result.ok || !result.profile) {
        if (action === "login") {
          recordLoginFailure(rateKey);
        }
        return NextResponse.json(result, { status: 400 });
      }

      if (action === "login") {
        clearLoginFailures(rateKey);
      }

      const res = NextResponse.json({
        success: true,
        ok: true,
        profile: sanitizeUserProfile(result.profile),
      });
      setSessionCookie(res, result.profile.userId);
      return res;
    }

    // 2. 회원설정 변경 (닉네임 / 비밀번호 변경 / 기본 역본 변경)
    // 서명된 HttpOnly 세션 쿠키로 본인 인증 검증
    const sessionUserId = getAuthenticatedUserId(req);
    if (!sessionUserId || sessionUserId !== cleanUserId) {
      return NextResponse.json(
        {
          ok: false,
          error: "로그인 세션이 만료되었거나 권한이 없습니다. 다시 로그인해 주세요.",
        },
        { status: 401 }
      );
    }

    const updated = await updateUserProfileSettings({
      userId: cleanUserId,
      nickname: nickname ? String(nickname).trim() : undefined,
      currentPassword: currentPassword ? String(currentPassword) : undefined,
      newPassword: newPassword ? String(newPassword) : undefined,
      preferredTranslation: preferredTranslation
        ? ((preferredTranslation === "klb" ? "klb" : "krv") as BibleTranslation)
        : undefined,
    });

    if (!updated.ok || !updated.profile) {
      return NextResponse.json(updated, { status: 400 });
    }

    const res = NextResponse.json({
      success: true,
      ok: true,
      profile: sanitizeUserProfile(updated.profile),
    });
    setSessionCookie(res, updated.profile.userId);
    return res;
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to update profile" },
      { status: 500 }
    );
  }
}
