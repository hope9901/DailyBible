"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Circle,
  Copy,
  Database,
  ExternalLink,
  KeyRound,
  RefreshCw,
  Rocket,
  ShieldCheck,
  Sparkles,
  ArrowLeft,
  AlertCircle,
} from "lucide-react";

interface PlannerTask {
  lineIndex: number;
  checked: boolean;
  title: string;
  details: string[];
}

interface PlannerPhase {
  heading: string;
  tasks: PlannerTask[];
}

interface EnvStatus {
  envFileExists: boolean;
  notion: {
    configured: boolean;
    apiKey: boolean;
    dailyWordDbId: boolean;
    usersDbId: boolean;
    qtLogsDbId: boolean;
  };
  oauth: {
    nextAuthUrl: string;
    nextAuthSecret: boolean;
    kakao: boolean;
    naver: boolean;
    google: boolean;
  };
  cronSecret: boolean;
}

function parsePlannerMarkdown(md: string): PlannerPhase[] {
  const lines = md.split("\n");
  const phases: PlannerPhase[] = [];
  let currentPhase: PlannerPhase | null = null;
  let currentTask: PlannerTask | null = null;

  lines.forEach((rawLine, index) => {
    const line = rawLine.trimEnd();
    if (line.startsWith("## ")) {
      if (currentPhase) phases.push(currentPhase);
      currentPhase = {
        heading: line.replace(/^##\s+/, "").trim(),
        tasks: [],
      };
      currentTask = null;
      return;
    }

    const taskMatch = line.match(/^- \[(x| )\]\s+(.*)$/i);
    if (taskMatch && currentPhase) {
      currentTask = {
        lineIndex: index,
        checked: taskMatch[1].toLowerCase() === "x",
        title: taskMatch[2].replace(/\*\*/g, "").trim(),
        details: [],
      };
      currentPhase.tasks.push(currentTask);
      return;
    }

    if (currentTask && (line.startsWith("  -") || line.match(/^\s+\d+\./))) {
      currentTask.details.push(
        line
          .replace(/^\s*-\s*/, "")
          .replace(/\*\*/g, "")
          .trim()
      );
    }
  });

  if (currentPhase) phases.push(currentPhase);
  return phases;
}

export default function PlannerDashboardPage() {
  const [phases, setPhases] = useState<PlannerPhase[]>([]);
  const [envStatus, setEnvStatus] = useState<EnvStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [testingNotion, setTestingNotion] = useState(false);
  const [notionTestResult, setNotionTestResult] = useState<{
    ok: boolean;
    message: string;
    results?: Record<string, { ok: boolean; title?: string; error?: string }>;
  } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast((prev) => (prev === msg ? null : prev));
    }, 2800);
  };

  const loadPlanner = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/planner");
      const data = await res.json();
      if (data.plannerMarkdown) {
        setPhases(parsePlannerMarkdown(data.plannerMarkdown));
      }
      if (data.envStatus) {
        setEnvStatus(data.envStatus);
      }
    } catch (err) {
      console.error("Failed to load planner:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlanner();
  }, [loadPlanner]);

  const handleToggleTask = async (lineIndex: number) => {
    try {
      const res = await fetch("/api/planner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle-task", lineIndex }),
      });
      const data = await res.json();
      if (data.plannerMarkdown) {
        setPhases(parsePlannerMarkdown(data.plannerMarkdown));
        showToast("PLANNER.md 진행 상태가 업데이트되었습니다.");
      }
    } catch (err) {
      console.error("Failed to toggle task:", err);
    }
  };

  const handleTestNotion = async () => {
    setTestingNotion(true);
    setNotionTestResult(null);
    try {
      const res = await fetch("/api/planner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test-notion" }),
      });
      const data = await res.json();
      setNotionTestResult(data);
    } catch (err: any) {
      setNotionTestResult({
        ok: false,
        message: err?.message || "노션 연결 테스트 중 오류가 발생했습니다.",
      });
    } finally {
      setTestingNotion(false);
    }
  };

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showToast(`${label} 복사 완료: ${text}`);
  };

  const allTasks = phases.flatMap((p) => p.tasks);
  const completedTasks = allTasks.filter((t) => t.checked).length;
  const progressPercent =
    allTasks.length > 0
      ? Math.round((completedTasks / allTasks.length) * 100)
      : 0;

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3.5 text-sm font-medium text-white shadow-xl">
          <Sparkles className="h-4 w-4 text-amber-400" />
          <span>{toast}</span>
        </div>
      )}

      {/* 상단 헤더 */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>QT 메인 화면으로</span>
            </Link>
            <div>
              <h1 className="text-lg font-bold text-slate-900">
                DailyBible 진행 플래너 & 환경 설정 가이드
              </h1>
              <p className="text-xs text-slate-500">
                PLANNER.md 실시간 연동 · Phase 2-4 ~ Phase 5 설정 도우미
              </p>
            </div>
          </div>

          <button
            onClick={loadPlanner}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>.env 및 상태 새로고침</span>
          </button>
        </div>
      </header>

      <main className="mx-auto mt-6 max-w-6xl space-y-6 px-4">
        {/* 전체 진행률 요약 카드 */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">
                전체 로드맵 진행률
              </span>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">
                총 {allTasks.length}개 단계 중 {completedTasks}개 완료 ({progressPercent}%)
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                아래 체크리스트 항목을 클릭하면 프로젝트 루트의{" "}
                <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-slate-800">
                  PLANNER.md
                </code>{" "}
                파일에 즉시 반영됩니다.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs">
                <p className="text-slate-500">.env 파일 상태</p>
                <p className="mt-0.5 font-bold text-slate-900">
                  {envStatus?.envFileExists ? "✅ 생성 완료 (.env)" : "⚠️ 미생성"}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs">
                <p className="text-slate-500">Notion DB 연동</p>
                <p className="mt-0.5 font-bold text-slate-900">
                  {envStatus?.notion.configured
                    ? "✅ 3개 DB 키 입력됨"
                    : "🕒 로컬 폴백 동작 중"}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-amber-500 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </section>

        {/* 실시간 환경 변수(.env) 점검 & 노션/소셜 로그인 설정 도우미 */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Phase 3 도우미: 노션 DB 3개 스키마 및 연결 테스트 */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-amber-600" />
                <h3 className="text-base font-bold text-slate-900">
                  Phase 3. 노션(Notion) 3개 DB 연동 점검
                </h3>
              </div>
              <a
                href="https://www.notion.so/my-integrations"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 hover:underline"
              >
                <span>Notion API 토큰 발급</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            <p className="mt-1.5 text-xs text-slate-500">
              프로젝트 루트의 <code className="font-mono font-semibold">.env</code> 파일에 아래 4개 값을 입력한 뒤 연결 테스트를 눌러보세요.
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              {[
                { label: "NOTION_API_KEY", ok: envStatus?.notion.apiKey },
                {
                  label: "NOTION_DAILY_WORD_DB_ID",
                  ok: envStatus?.notion.dailyWordDbId,
                },
                { label: "NOTION_USERS_DB_ID", ok: envStatus?.notion.usersDbId },
                {
                  label: "NOTION_QT_LOGS_DB_ID",
                  ok: envStatus?.notion.qtLogsDbId,
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className={`flex items-center justify-between rounded-xl border px-3 py-2 ${
                    item.ok
                      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                      : "border-slate-200 bg-slate-50 text-slate-600"
                  }`}
                >
                  <span className="font-mono text-[11px] font-semibold">
                    {item.label}
                  </span>
                  <span>{item.ok ? "✅ 입력됨" : "미입력"}</span>
                </div>
              ))}
            </div>

            {/* 3개 DB 필수 컬럼 복사 표 */}
            <div className="mt-4 space-y-2.5 rounded-xl border border-slate-100 bg-slate-50 p-3.5 text-xs">
              <p className="font-bold text-slate-800">
                노션 데이터베이스 3개 필수 속성(컬럼명 클릭 시 복사)
              </p>
              {[
                {
                  db: "① Daily_Word (말씀 DB)",
                  cols: ["Title (제목)", "Date (텍스트)", "Scripture (텍스트)", "ContentJson (텍스트)"],
                },
                {
                  db: "② Users (회원 DB)",
                  cols: [
                    "UserId (제목)",
                    "Provider (텍스트)",
                    "Email (텍스트)",
                    "Nickname (텍스트)",
                    "IsOnboarded (체크박스)",
                  ],
                },
                {
                  db: "③ QT_Logs (출석/묵상 DB)",
                  cols: [
                    "LogId (제목)",
                    "UserId (텍스트)",
                    "Date (텍스트)",
                    "IsCompleted (체크박스)",
                    "Reflection (텍스트)",
                    "UpdatedAt (텍스트)",
                  ],
                },
              ].map((group) => (
                <div key={group.db} className="space-y-1">
                  <p className="font-semibold text-slate-700">{group.db}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {group.cols.map((col) => {
                      const rawName = col.split(" ")[0];
                      return (
                        <button
                          key={col}
                          type="button"
                          onClick={() => copyText(rawName, "컬럼명")}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:border-amber-400 hover:bg-amber-50"
                        >
                          <span>{col}</span>
                          <Copy className="h-2.5 w-2.5 text-slate-400" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4">
              <button
                type="button"
                onClick={handleTestNotion}
                disabled={testingNotion}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                <ShieldCheck className="h-4 w-4 text-amber-400" />
                <span>
                  {testingNotion
                    ? "노션 API 연결 확인 중..."
                    : "노션 3개 데이터베이스 연결 실시간 테스트"}
                </span>
              </button>

              {notionTestResult && (
                <div
                  className={`mt-3 rounded-xl border p-3 text-xs ${
                    notionTestResult.ok
                      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                      : "border-amber-200 bg-amber-50 text-amber-900"
                  }`}
                >
                  <p className="font-bold">{notionTestResult.message}</p>
                  {notionTestResult.results && (
                    <ul className="mt-1.5 space-y-1">
                      {Object.entries(notionTestResult.results).map(([k, v]) => (
                        <li key={k}>
                          • <strong>{k}</strong>:{" "}
                          {v.ok ? `✅ 연결됨 (${v.title})` : `❌ ${v.error}`}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Phase 4 & 5 도우미: 소셜 로그인 Redirect URI 복사 및 배포 안내 */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-amber-600" />
                <h3 className="text-base font-bold text-slate-900">
                  Phase 4. 카카오 · 네이버 · 구글 OAuth 설정 도우미
                </h3>
              </div>
            </div>

            <p className="mt-1.5 text-xs text-slate-500">
              각 개발자 센터에 아래 Redirect URI를 복사해 등록하고 Client ID / Secret을 <code className="font-mono font-semibold">.env</code>에 입력해 주세요.
            </p>

            <div className="mt-4 space-y-2.5">
              {[
                {
                  name: "카카오 (Kakao)",
                  configured: envStatus?.oauth.kakao,
                  consoleUrl: "https://developers.kakao.com",
                  callbackUrl: "http://localhost:3000/api/auth/callback/kakao",
                },
                {
                  name: "네이버 (Naver)",
                  configured: envStatus?.oauth.naver,
                  consoleUrl: "https://developers.naver.com",
                  callbackUrl: "http://localhost:3000/api/auth/callback/naver",
                },
                {
                  name: "구글 (Google)",
                  configured: envStatus?.oauth.google,
                  consoleUrl: "https://console.cloud.google.com",
                  callbackUrl: "http://localhost:3000/api/auth/callback/google",
                },
              ].map((provider) => (
                <div
                  key={provider.name}
                  className="rounded-xl border border-slate-200 p-3 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">
                      {provider.name}
                    </span>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          provider.configured
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {provider.configured
                          ? "✅ OAuth 키 입력됨"
                          : "체험 모드 동작 중"}
                      </span>
                      <a
                        href={provider.consoleUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-0.5 text-amber-700 hover:underline"
                      >
                        <span>콘솔</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-1.5 font-mono text-[11px] text-slate-700">
                    <span className="truncate">{provider.callbackUrl}</span>
                    <button
                      type="button"
                      onClick={() =>
                        copyText(provider.callbackUrl, `${provider.name} Redirect URI`)
                      }
                      className="ml-2 inline-flex shrink-0 items-center gap-1 rounded border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-sans font-semibold text-slate-700 hover:bg-amber-50"
                    >
                      <Copy className="h-2.5 w-2.5" />
                      <span>복사</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-xl border border-amber-200/80 bg-amber-50/60 p-3.5 text-xs text-amber-950">
              <div className="flex items-center gap-1.5 font-bold">
                <Rocket className="h-4 w-4 text-amber-600" />
                <span>Phase 5. GitHub Actions (매일 00:30 KST) & Vercel 배포 팁</span>
              </div>
              <p className="mt-1 leading-relaxed text-amber-900/90">
                GitHub 저장소의 <code className="font-mono">Settings → Secrets and variables → Actions</code>에{" "}
                <code className="font-mono font-bold">NOTION_API_KEY</code>와{" "}
                <code className="font-mono font-bold">NOTION_DAILY_WORD_DB_ID</code>만 등록하면 매일 새벽 00:30에 자동으로 생명의 삶 본문이 노션 DB에 업데이트됩니다.
              </p>
            </div>
          </div>
        </section>

        {/* PLANNER.md 단계별 인터랙티브 체크리스트 */}
        <section className="space-y-4">
          {phases.map((phase) => (
            <div
              key={phase.heading}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <h3 className="text-base font-bold text-slate-900">
                {phase.heading}
              </h3>

              <div className="mt-4 space-y-2.5">
                {phase.tasks.map((task) => (
                  <div
                    key={task.lineIndex}
                    onClick={() => handleToggleTask(task.lineIndex)}
                    className={`cursor-pointer rounded-xl border p-3.5 transition-all ${
                      task.checked
                        ? "border-emerald-200 bg-emerald-50/40"
                        : "border-slate-200 bg-white hover:border-amber-400"
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      {task.checked ? (
                        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                      ) : (
                        <Circle className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
                      )}
                      <div className="flex-1">
                        <p
                          className={`text-sm font-bold ${
                            task.checked
                              ? "text-emerald-950 line-through decoration-emerald-500/50"
                              : "text-slate-900"
                          }`}
                        >
                          {task.title}
                        </p>
                        {task.details.length > 0 && (
                          <ul className="mt-1.5 space-y-1 text-xs text-slate-600">
                            {task.details.map((detail, idx) => (
                              <li key={idx}>• {detail}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
