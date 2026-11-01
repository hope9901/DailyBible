import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { Client } from "@notionhq/client";
import { isNotionConfigured } from "@/lib/notion";

const PLANNER_PATH = path.join(process.cwd(), "PLANNER.md");

function isRealEnvValue(val?: string): boolean {
  if (!val) return false;
  const trimmed = val.trim();
  if (!trimmed) return false;
  if (trimmed.includes("xxxx") || trimmed.includes("replace_with")) return false;
  return true;
}

export async function GET() {
  try {
    const plannerMarkdown = fs.existsSync(PLANNER_PATH)
      ? fs.readFileSync(PLANNER_PATH, "utf-8")
      : "";

    const envStatus = {
      envFileExists: fs.existsSync(path.join(process.cwd(), ".env")),
      notion: {
        configured: isNotionConfigured(),
        apiKey: isRealEnvValue(process.env.NOTION_API_KEY),
        dailyWordDbId: isRealEnvValue(process.env.NOTION_DAILY_WORD_DB_ID),
        usersDbId: isRealEnvValue(process.env.NOTION_USERS_DB_ID),
        qtLogsDbId: isRealEnvValue(process.env.NOTION_QT_LOGS_DB_ID),
      },
      oauth: {
        nextAuthUrl: process.env.NEXTAUTH_URL || "http://localhost:3000",
        nextAuthSecret: isRealEnvValue(process.env.NEXTAUTH_SECRET),
        kakao:
          isRealEnvValue(process.env.KAKAO_CLIENT_ID) &&
          isRealEnvValue(process.env.KAKAO_CLIENT_SECRET),
        naver:
          isRealEnvValue(process.env.NAVER_CLIENT_ID) &&
          isRealEnvValue(process.env.NAVER_CLIENT_SECRET),
        google:
          isRealEnvValue(process.env.GOOGLE_CLIENT_ID) &&
          isRealEnvValue(process.env.GOOGLE_CLIENT_SECRET),
      },
      cronSecret: isRealEnvValue(process.env.CRON_SECRET),
    };

    return NextResponse.json({
      plannerMarkdown,
      envStatus,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to read planner status" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // 1. 노션 DB 연결 실시간 테스트 액션
    if (body.action === "test-notion") {
      if (!isRealEnvValue(process.env.NOTION_API_KEY)) {
        return NextResponse.json({
          ok: false,
          message:
            ".env 파일에 유효한 NOTION_API_KEY가 아직 설정되지 않았습니다.",
        });
      }

      const notion = new Client({ auth: process.env.NOTION_API_KEY });
      const results: Record<string, { ok: boolean; title?: string; error?: string }> = {};

      const dbList = [
        { key: "Daily_Word", id: process.env.NOTION_DAILY_WORD_DB_ID },
        { key: "Users", id: process.env.NOTION_USERS_DB_ID },
        { key: "QT_Logs", id: process.env.NOTION_QT_LOGS_DB_ID },
      ];

      for (const db of dbList) {
        if (!isRealEnvValue(db.id)) {
          results[db.key] = {
            ok: false,
            error: "DB ID 미입력 (.env 확인 필요)",
          };
          continue;
        }
        try {
          const info: any = await notion.databases.retrieve({
            database_id: db.id!,
          });
          const title =
            info.title?.map((t: any) => t.plain_text).join("") || db.key;
          results[db.key] = { ok: true, title };
        } catch (err: any) {
          results[db.key] = {
            ok: false,
            error: err?.message || "접근 권한 없음 또는 잘못된 DB ID",
          };
        }
      }

      const allOk = Object.values(results).every((r) => r.ok);
      return NextResponse.json({
        ok: allOk,
        results,
        message: allOk
          ? "3개 노션 데이터베이스가 모두 정상 연결되었습니다!"
          : "일부 노션 데이터베이스 연결을 확인해 주세요.",
      });
    }

    // 2. PLANNER.md 체크박스 토글 액션
    if (body.action === "toggle-task" && typeof body.lineIndex === "number") {
      if (!fs.existsSync(PLANNER_PATH)) {
        return NextResponse.json(
          { error: "PLANNER.md not found" },
          { status: 404 }
        );
      }
      const lines = fs.readFileSync(PLANNER_PATH, "utf-8").split("\n");
      const idx = body.lineIndex;
      if (idx >= 0 && idx < lines.length) {
        if (lines[idx].includes("- [ ] ")) {
          lines[idx] = lines[idx].replace("- [ ] ", "- [x] ");
        } else if (lines[idx].includes("- [x] ")) {
          lines[idx] = lines[idx].replace("- [x] ", "- [ ] ");
        }
        const updated = lines.join("\n");
        fs.writeFileSync(PLANNER_PATH, updated, "utf-8");
        return NextResponse.json({
          ok: true,
          plannerMarkdown: updated,
        });
      }
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to process planner action" },
      { status: 500 }
    );
  }
}
