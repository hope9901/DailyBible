import { NextRequest, NextResponse } from "next/server";
import {
  registerOrLoginUser,
  updateUserProfileSettings,
} from "@/lib/notion";
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

    if (!userId || !String(userId).trim()) {
      return NextResponse.json(
        { ok: false, error: "아이디가 필요합니다." },
        { status: 400 }
      );
    }

    // 1. 회원가입 또는 로그인
    if (action === "register" || action === "login") {
      const result = await registerOrLoginUser({
        mode: action,
        userId: String(userId).trim(),
        password: password ? String(password) : "",
        nickname: nickname ? String(nickname).trim() : undefined,
        preferredTranslation: (preferredTranslation === "klb"
          ? "klb"
          : "krv") as BibleTranslation,
        provider: provider || "local",
      });

      if (!result.ok) {
        return NextResponse.json(result, { status: 400 });
      }
      return NextResponse.json({
        success: true,
        ok: true,
        profile: result.profile,
      });
    }

    // 2. 회원설정 변경 (닉네임 / 비밀번호 변경 / 기본 역본 변경)
    const updated = await updateUserProfileSettings({
      userId: String(userId).trim(),
      nickname: nickname ? String(nickname).trim() : undefined,
      currentPassword: currentPassword ? String(currentPassword) : undefined,
      newPassword: newPassword ? String(newPassword) : undefined,
      preferredTranslation: preferredTranslation
        ? ((preferredTranslation === "klb" ? "klb" : "krv") as BibleTranslation)
        : undefined,
    });

    if (!updated.ok) {
      return NextResponse.json(updated, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      ok: true,
      profile: updated.profile,
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to update profile" },
      { status: 500 }
    );
  }
}
