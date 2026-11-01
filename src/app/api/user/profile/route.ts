import { NextRequest, NextResponse } from "next/server";
import { updateUserNickname } from "@/lib/notion";

export async function POST(req: NextRequest) {
  try {
    const { userId, nickname } = await req.json();
    if (!userId || !nickname?.trim()) {
      return NextResponse.json(
        { error: "userId and nickname are required" },
        { status: 400 }
      );
    }

    const updated = await updateUserNickname(userId, nickname.trim());
    return NextResponse.json({
      success: true,
      profile: updated,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to update profile" },
      { status: 500 }
    );
  }
}
