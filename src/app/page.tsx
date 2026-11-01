"use client";

import React, { useEffect, useState, useCallback } from "react";
import { signIn } from "next-auth/react";
import {
  BookOpen,
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Sparkles,
  UserCheck,
  LogOut,
  Music,
  HelpCircle,
  PenLine,
  Database,
  AlertTriangle,
} from "lucide-react";

interface BibleVerse {
  verse: number;
  text: string;
}

interface BibleSection {
  subheading: string;
  verses: BibleVerse[];
}

interface DailyWordData {
  date: string;
  title: string;
  scripture: string;
  hymn: string;
  sections: BibleSection[];
  meditationGuide: string[];
  sourceUrl: string;
  crawledAt: string;
}

interface QtLogEntry {
  logId: string;
  userId: string;
  date: string;
  isCompleted: boolean;
  reflection: string;
  updatedAt: string;
}

interface QtDayStatus {
  activeQtDate: string;
  actualCalendarDate: string;
  currentKstTime: string;
  isPreUpdateClosingWindow: boolean;
  countdown: {
    hours: number;
    minutes: number;
    seconds: number;
    totalSeconds: number;
    formatted: string;
  };
}

interface SessionUser {
  userId: string;
  provider: "kakao" | "naver" | "google";
  nickname: string;
  isOnboarded: boolean;
}

export default function DailyQtHomePage() {
  // 로그인 세션 상태 (카카오 / 네이버 / 구글)
  const [user, setUser] = useState<SessionUser | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [nicknameInput, setNicknameInput] = useState("");

  // 날짜 및 캘린더 상태
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [currentMonth, setCurrentMonth] = useState<string>(""); // YYYY-MM
  const [qtStatus, setQtStatus] = useState<QtDayStatus | null>(null);
  const [simulateClosingWindow, setSimulateClosingWindow] = useState(false);

  // 말씀 및 기록 데이터 상태
  const [dailyWord, setDailyWord] = useState<DailyWordData | null>(null);
  const [monthLogs, setMonthLogs] = useState<Record<string, QtLogEntry>>({});
  const [isCompleted, setIsCompleted] = useState(false);
  const [reflection, setReflection] = useState("");
  const [showReflectionEditor, setShowReflectionEditor] = useState(false);
  const [fontSize, setFontSize] = useState<"base" | "lg" | "xl">("lg");
  const [showHymn, setShowHymn] = useState(false);

  // 서버/연동 상태
  const [storageMode, setStorageMode] = useState<"notion" | "local-fallback">(
    "local-fallback"
  );
  const [oauthConfigured, setOauthConfigured] = useState({
    kakao: false,
    naver: false,
    google: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [crawling, setCrawling] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3200);
  };

  // 로컬 스토리지에 저장된 로그인 사용자 복원
  useEffect(() => {
    try {
      const savedUser = localStorage.getItem("daily_qt_user");
      if (savedUser) {
        const parsed = JSON.parse(savedUser) as SessionUser;
        setUser(parsed);
      }
    } catch {
      // ignore
    }
  }, []);

  const fetchQtData = useCallback(
    async (dateParam?: string, monthParam?: string, activeUser?: SessionUser | null) => {
      setLoading(true);
      try {
        const currentUser = activeUser !== undefined ? activeUser : user;
        const params = new URLSearchParams();
        if (dateParam) params.set("date", dateParam);
        if (monthParam) params.set("month", monthParam);
        if (currentUser?.userId) {
          params.set("userId", currentUser.userId);
          params.set("provider", currentUser.provider);
        }

        const res = await fetch(`/api/qt?${params.toString()}`);
        const data = await res.json();

        if (data.qtStatus) setQtStatus(data.qtStatus);
        if (data.selectedDate) setSelectedDate(data.selectedDate);
        if (data.selectedMonth) setCurrentMonth(data.selectedMonth);
        if (data.dailyWord) setDailyWord(data.dailyWord);
        if (data.monthLogs) setMonthLogs(data.monthLogs);
        if (data.storageMode) setStorageMode(data.storageMode);
        if (data.oauthConfigured) setOauthConfigured(data.oauthConfigured);

        if (data.currentDateLog) {
          setIsCompleted(Boolean(data.currentDateLog.isCompleted));
          const savedNote = data.currentDateLog.reflection || "";
          setReflection(savedNote);
          setShowReflectionEditor(Boolean(savedNote));
        }
      } catch (err) {
        console.error("Failed to fetch QT data:", err);
      } finally {
        setLoading(false);
      }
    },
    [user]
  );

  useEffect(() => {
    fetchQtData(selectedDate || undefined, currentMonth || undefined, user);
  }, [user]);

  // 1초마다 KST 00:30 기준 카운트다운 갱신
  useEffect(() => {
    const timer = setInterval(() => {
      setQtStatus((prev) => {
        if (!prev) return prev;
        const total = Math.max(prev.countdown.totalSeconds - 1, 0);
        const hours = Math.floor(total / 3600);
        const minutes = Math.floor((total % 3600) / 60);
        const seconds = total % 60;
        const pad = (n: number) => String(n).padStart(2, "0");
        return {
          ...prev,
          countdown: {
            hours,
            minutes,
            seconds,
            totalSeconds: total,
            formatted:
              hours > 0
                ? `${pad(hours)}시간 ${pad(minutes)}분 ${pad(seconds)}초`
                : `${pad(minutes)}분 ${pad(seconds)}초`,
          },
        };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 날짜 변경 핸들러
  const handleSelectDate = async (dateStr: string) => {
    const nextMonth = dateStr.slice(0, 7);
    setSelectedDate(dateStr);
    if (nextMonth !== currentMonth) {
      setCurrentMonth(nextMonth);
    }
    await fetchQtData(dateStr, nextMonth, user);
  };

  // 이전/다음 달 이동
  const handleChangeMonth = async (offset: number) => {
    if (!currentMonth) return;
    const [y, m] = currentMonth.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 1 + offset, 1));
    const nextYear = d.getUTCFullYear();
    const nextMonth = String(d.getUTCMonth() + 1).padStart(2, "0");
    const nextMonthKey = `${nextYear}-${nextMonth}`;
    setCurrentMonth(nextMonthKey);
    await fetchQtData(selectedDate, nextMonthKey, user);
  };

  // 소셜 로그인 처리 (카카오 / 네이버 / 구글)
  const handleSocialLogin = async (provider: "kakao" | "naver" | "google") => {
    // 실제 OAuth Client ID가 설정된 경우 NextAuth OAuth 플로우 실행
    if (oauthConfigured[provider]) {
      await signIn(provider, { callbackUrl: "/" });
      return;
    }

    // 로컬/테스트 환경에서 즉시 체험 가능한 소셜 계정 연결 및 최초 닉네임 온보딩
    const defaultLabels = {
      kakao: "카카오 성도",
      naver: "네이버 성도",
      google: "구글 성도",
    };

    const tempUser: SessionUser = {
      userId: `${provider}_member_01`,
      provider,
      nickname: defaultLabels[provider],
      isOnboarded: false,
    };

    setUser(tempUser);
    setNicknameInput("");
    setShowLoginModal(false);
    setShowOnboardingModal(true);
  };

  // 최초 로그인 후 간단 회원정보(닉네임) 저장
  const handleCompleteOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const finalNickname = nicknameInput.trim() || user.nickname;

    try {
      await fetch("/api/user/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.userId,
          nickname: finalNickname,
        }),
      });

      const updatedUser: SessionUser = {
        ...user,
        nickname: finalNickname,
        isOnboarded: true,
      };
      setUser(updatedUser);
      localStorage.setItem("daily_qt_user", JSON.stringify(updatedUser));
      setShowOnboardingModal(false);
      showToast(`${finalNickname}님, 환영합니다! 오늘의 QT를 시작해 보세요.`);
      await fetchQtData(selectedDate, currentMonth, updatedUser);
    } catch (err) {
      console.error("Failed to save profile:", err);
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("daily_qt_user");
    showToast("로그아웃되었습니다.");
  };

  // QT 읽음 체크 토글 (느낀점 작성 여부와 무관하게 즉시 체크 가능)
  const handleToggleQtCheck = async (nextChecked: boolean) => {
    if (!user) {
      setShowLoginModal(true);
      showToast("로그인 후 나만의 QT 캘린더에 체크할 수 있습니다.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/qt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.userId,
          date: selectedDate,
          isCompleted: nextChecked,
          reflection: showReflectionEditor ? reflection : undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setIsCompleted(nextChecked);
        setMonthLogs((prev) => ({
          ...prev,
          [selectedDate]: data.log,
        }));
        showToast(
          nextChecked
            ? `✅ ${selectedDate} QT 완료가 캘린더에 기록되었습니다!`
            : `${selectedDate} QT 완료 체크가 해제되었습니다.`
        );
      }
    } catch (err) {
      console.error("Failed to save QT check:", err);
    } finally {
      setSaving(false);
    }
  };

  // 느낀점(은혜 받은점) 저장 (선택 사항)
  const handleSaveReflection = async () => {
    if (!user) {
      setShowLoginModal(true);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/qt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.userId,
          date: selectedDate,
          isCompleted: true, // 느낀점을 저장하면 자동으로 오늘 QT 읽음 완료 처리
          reflection: reflection.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setIsCompleted(true);
        setMonthLogs((prev) => ({
          ...prev,
          [selectedDate]: data.log,
        }));
        showToast("📝 오늘의 은혜 나눔(느낀점)과 QT 체크가 저장되었습니다!");
      }
    } catch (err) {
      console.error("Failed to save reflection:", err);
    } finally {
      setSaving(false);
    }
  };

  // 수동 크롤링 동기화 버튼
  const handleManualCrawl = async () => {
    if (!selectedDate) return;
    setCrawling(true);
    try {
      const res = await fetch("/api/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: selectedDate }),
      });
      const data = await res.json();
      if (data.dailyWord) {
        setDailyWord(data.dailyWord);
        showToast(
          `🔄 ${selectedDate} 생명의 삶 본문 말씀을 최신 상태로 동기화했습니다.`
        );
      }
    } catch (err) {
      console.error("Crawl failed:", err);
    } finally {
      setCrawling(false);
    }
  };

  // 달력 계산
  const renderCalendarCells = () => {
    if (!currentMonth) return null;
    const [year, month] = currentMonth.split("-").map(Number);
    const firstDayOfWeek = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const pad = (n: number) => String(n).padStart(2, "0");

    const cells: React.ReactNode[] = [];
    for (let i = 0; i < firstDayOfWeek; i++) {
      cells.push(<div key={`empty-${i}`} className="h-12" />);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${pad(month)}-${pad(day)}`;
      const log = monthLogs[dateStr];
      const isSelected = dateStr === selectedDate;
      const isActiveQtToday = dateStr === qtStatus?.activeQtDate;
      const checked = Boolean(log?.isCompleted);
      const hasReflection = Boolean(log?.reflection?.trim());

      cells.push(
        <button
          key={dateStr}
          onClick={() => handleSelectDate(dateStr)}
          className={`relative flex flex-col items-center justify-center h-12 rounded-xl border text-sm font-medium transition-all ${
            isSelected
              ? "border-amber-600 bg-amber-50 text-amber-950 ring-2 ring-amber-500/30"
              : checked
              ? "border-emerald-200 bg-emerald-50/70 text-emerald-900 hover:bg-emerald-100/70"
              : "border-slate-100 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          <span className="text-xs font-semibold">{day}</span>
          <div className="mt-0.5 flex items-center gap-0.5">
            {checked ? (
              <span
                title="QT 완료"
                className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[10px] text-white"
              >
                ✓
              </span>
            ) : isActiveQtToday ? (
              <span className="text-[10px] font-bold text-amber-600">오늘</span>
            ) : (
              <span className="h-4" />
            )}
            {hasReflection && (
              <span
                title="느낀점 작성됨"
                className="h-1.5 w-1.5 rounded-full bg-amber-500"
              />
            )}
          </div>
        </button>
      );
    }

    return cells;
  };

  const completedCountThisMonth = Object.values(monthLogs).filter(
    (l) => l.isCompleted
  ).length;

  const isClosingMode =
    simulateClosingWindow || Boolean(qtStatus?.isPreUpdateClosingWindow);

  const fontSizeClass =
    fontSize === "xl"
      ? "text-lg leading-relaxed"
      : fontSize === "lg"
      ? "text-base leading-relaxed"
      : "text-sm leading-relaxed";

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      {/* 토스트 알림 */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3.5 text-sm font-medium text-white shadow-xl">
          <Sparkles className="h-4 w-4 text-amber-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 상단 00:30 KST 마감 기준 안내 배너 */}
      <div
        className={`border-b px-4 py-2.5 text-xs sm:text-sm transition-colors ${
          isClosingMode
            ? "bg-amber-600 text-white border-amber-700"
            : "bg-slate-900 text-slate-100 border-slate-800"
        }`}
      >
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {isClosingMode ? (
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-200 animate-pulse" />
            ) : (
              <Clock className="h-4 w-4 shrink-0 text-amber-400" />
            )}
            <span>
              {isClosingMode ? (
                <>
                  <strong>[00:00 ~ 00:30 마감 시간]</strong> 새 말씀 크롤링(00:30)
                  직전입니다!{" "}
                  <strong className="underline">
                    {qtStatus?.activeQtDate || selectedDate} 하루 QT
                  </strong>
                  를 마쳤다면 지금 체크해 주세요.
                </>
              ) : (
                <>
                  오늘의 QT 기준일:{" "}
                  <strong className="text-amber-300">
                    {qtStatus?.activeQtDate || selectedDate}
                  </strong>{" "}
                  (매일 새벽 <strong>00:30</strong> 새 말씀 업데이트 전까지 당일 QT
                  체크 가능)
                </>
              )}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="rounded-full bg-white/10 px-3 py-0.5 text-xs font-medium">
              다음 00:30 업데이트까지:{" "}
              <strong>{qtStatus?.countdown.formatted || "계산 중..."}</strong>
            </span>
            <button
              onClick={() => setSimulateClosingWindow((prev) => !prev)}
              className="rounded-lg border border-white/25 px-2.5 py-0.5 text-[11px] hover:bg-white/10"
              title="자정~00:30 사이 마감 배너 상태를 미리 확인합니다"
            >
              {simulateClosingWindow ? "일반 시간대 보기" : "00:15 마감구간 미리보기"}
            </button>
          </div>
        </div>
      </div>

      {/* 메인 네비게이션 헤더 */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-slate-900">
                생명의 삶 일일 QT
              </h1>
              <p className="text-xs text-slate-500">
                매일 00:30 자동 크롤링 · 노션 DB 연동 묵상 캘린더
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* 노션 연동 상태 표시 배지 */}
            <div
              className={`hidden sm:flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border ${
                storageMode === "notion"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-slate-200 bg-slate-100 text-slate-600"
              }`}
              title={
                storageMode === "notion"
                  ? "Notion API 데이터베이스와 실시간 연동 중입니다"
                  : ".env.local에 Notion API 키를 입력하면 노션 DB와 즉시 동기화됩니다"
              }
            >
              <Database className="h-3.5 w-3.5" />
              <span>
                {storageMode === "notion" ? "Notion DB 연결됨" : "로컬 저장소 모드"}
              </span>
            </div>

            {user ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setNicknameInput(user.nickname);
                    setShowOnboardingModal(true);
                  }}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100"
                >
                  <UserCheck className="h-3.5 w-3.5 text-emerald-600" />
                  <span>{user.nickname}님</span>
                  <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] uppercase text-slate-600">
                    {user.provider}
                  </span>
                </button>
                <button
                  onClick={handleLogout}
                  className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                  title="로그아웃"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowLoginModal(true)}
                className="rounded-xl bg-slate-900 px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
              >
                로그인 / 시작하기
              </button>
            )}
          </div>
        </div>
      </header>

      {/* 본문 2단 레이아웃 */}
      <main className="mx-auto mt-6 grid max-w-6xl grid-cols-1 gap-6 px-4 lg:grid-cols-12">
        {/* 좌측(7칸): 생명의 삶 본문 말씀 뷰어 */}
        <section className="space-y-5 lg:col-span-7">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            {/* 상단 날짜 및 크롤링 새로고침 / 글자 크기 조절 */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-900">
                  {selectedDate || "오늘"} 말씀
                </span>
                {selectedDate === qtStatus?.activeQtDate && (
                  <span className="rounded-lg bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                    오늘의 활성 QT
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <div className="flex items-center rounded-lg border border-slate-200 p-0.5 text-xs">
                  <button
                    onClick={() => setFontSize("base")}
                    className={`rounded px-2 py-1 ${
                      fontSize === "base"
                        ? "bg-slate-900 text-white"
                        : "text-slate-600"
                    }`}
                  >
                    가
                  </button>
                  <button
                    onClick={() => setFontSize("lg")}
                    className={`rounded px-2 py-1 font-medium ${
                      fontSize === "lg"
                        ? "bg-slate-900 text-white"
                        : "text-slate-600"
                    }`}
                  >
                    가+
                  </button>
                  <button
                    onClick={() => setFontSize("xl")}
                    className={`rounded px-2 py-1 font-bold ${
                      fontSize === "xl"
                        ? "bg-slate-900 text-white"
                        : "text-slate-600"
                    }`}
                  >
                    가++
                  </button>
                </div>

                <button
                  onClick={handleManualCrawl}
                  disabled={crawling}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                  title="두란노 생명의 삶에서 이 날짜의 말씀을 즉시 다시 크롤링합니다"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${crawling ? "animate-spin" : ""}`}
                  />
                  <span>말씀 동기화</span>
                </button>
              </div>
            </div>

            {loading ? (
              <div className="py-16 text-center text-sm text-slate-400">
                생명의 삶 본문 말씀을 불러오는 중입니다...
              </div>
            ) : dailyWord ? (
              <div className="mt-5 space-y-6">
                {/* 말씀 제목 및 본문 장절 */}
                <div>
                  <p className="text-sm font-semibold text-amber-700">
                    {dailyWord.scripture}
                  </p>
                  <h2 className="mt-1 text-2xl font-bold text-slate-900">
                    {dailyWord.title}
                  </h2>
                </div>

                {/* 오늘의 찬송 토글 */}
                {dailyWord.hymn && (
                  <div className="rounded-xl border border-amber-200/70 bg-amber-50/50 p-3.5">
                    <button
                      onClick={() => setShowHymn((prev) => !prev)}
                      className="flex w-full items-center justify-between text-left text-xs font-semibold text-amber-900"
                    >
                      <span className="flex items-center gap-1.5">
                        <Music className="h-4 w-4 text-amber-600" />
                        <span>
                          오늘의 찬송:{" "}
                          {dailyWord.hymn.split("\n")[0] || "찬송가 보기"}
                        </span>
                      </span>
                      <span className="text-amber-700 underline">
                        {showHymn ? "가사 접기" : "가사 펼치기"}
                      </span>
                    </button>
                    {showHymn && (
                      <p className="mt-2.5 whitespace-pre-line text-xs leading-relaxed text-amber-950/80">
                        {dailyWord.hymn}
                      </p>
                    )}
                  </div>
                )}

                {/* 성경 본문 절별 리스트 */}
                <div className="space-y-6">
                  {dailyWord.sections.map((section, idx) => (
                    <div key={idx} className="space-y-3">
                      <h3 className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700">
                        {section.subheading}
                      </h3>
                      <div className={`space-y-2.5 ${fontSizeClass}`}>
                        {section.verses.map((v) => (
                          <div
                            key={v.verse}
                            className="flex items-baseline gap-2.5 rounded-lg px-2 py-1 hover:bg-amber-50/40"
                          >
                            <span className="w-6 shrink-0 select-none text-right text-xs font-bold text-amber-700">
                              {v.verse}
                            </span>
                            <p className="text-slate-800">{v.text}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* 묵상 도우미 */}
                {dailyWord.meditationGuide &&
                  dailyWord.meditationGuide.length > 0 && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                        <HelpCircle className="h-4 w-4 text-slate-500" />
                        <span>묵상 도우미</span>
                      </div>
                      <ul className="mt-2.5 space-y-1.5 text-xs leading-relaxed text-slate-600">
                        {dailyWord.meditationGuide.map((item, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="text-amber-600">•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-[11px] text-slate-400">
                  <span>출처: 두란노 생명의 삶 (개역개정)</span>
                  <a
                    href={dailyWord.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="underline hover:text-slate-600"
                  >
                    원문 페이지 보기 ↗
                  </a>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        {/* 우측(5칸): 오늘 QT 완료 체크 & 선택형 느낀점 & 월간 QT 캘린더 */}
        <aside className="space-y-5 lg:col-span-5">
          {/* 1. 오늘 하루 QT 완료 체크 & 선택적 느낀점 작성 카드 */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-500">
                  {selectedDate} 묵상 점검
                </span>
                <h3 className="text-lg font-bold text-slate-900">
                  오늘 QT를 완료하셨나요?
                </h3>
              </div>
              {isCompleted && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  읽음 완료
                </span>
              )}
            </div>

            <p className="mt-1.5 text-xs text-slate-500">
              새벽 00:30 다음 말씀이 업데이트되기 전까지 오늘 하루 QT 여부를 체크할
              수 있습니다. 느낀점은 선택 사항입니다.
            </p>

            {/* 원클릭 읽음 완료 체크 버튼 */}
            <button
              onClick={() => handleToggleQtCheck(!isCompleted)}
              disabled={saving}
              className={`mt-4 flex w-full items-center justify-center gap-2.5 rounded-xl px-5 py-3.5 text-sm font-bold shadow-sm transition-all ${
                isCompleted
                  ? "border-2 border-emerald-600 bg-emerald-50 text-emerald-900 hover:bg-emerald-100"
                  : "bg-amber-500 text-white hover:bg-amber-600"
              }`}
            >
              <CheckCircle2 className="h-5 w-5" />
              <span>
                {isCompleted
                  ? "오늘 말씀 읽음 완료됨 (클릭 시 해제)"
                  : "오늘의 QT 말씀 읽음 체크하기"}
              </span>
            </button>

            {/* 선택형 느낀점(은혜 받은점) 토글 영역 */}
            <div className="mt-4 border-t border-slate-100 pt-4">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                  <PenLine className="h-3.5 w-3.5 text-amber-600" />
                  <span>오늘 느낀점 / 은혜 받은점 (선택사항)</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowReflectionEditor((prev) => !prev)}
                  className="text-xs font-medium text-amber-700 underline hover:text-amber-800"
                >
                  {showReflectionEditor ? "입력창 접기" : "+ 느낀점 작성하기"}
                </button>
              </div>

              {showReflectionEditor ? (
                <div className="mt-3 space-y-2.5">
                  <textarea
                    rows={4}
                    value={reflection}
                    onChange={(e) => setReflection(e.target.value)}
                    placeholder="오늘 말씀을 통해 깨달은 점이나 받은 은혜, 짧은 기도문을 자유롭게 남겨보세요. (작성하지 않고 읽음 체크만 해도 됩니다)"
                    className="w-full rounded-xl border border-slate-200 p-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-amber-500 focus:outline-none"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={handleSaveReflection}
                      disabled={saving}
                      className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                    >
                      {saving ? "저장 중..." : "느낀점 저장 + QT 완료 체크"}
                    </button>
                  </div>
                </div>
              ) : (
                reflection && (
                  <div className="mt-2.5 rounded-xl bg-amber-50/70 p-3 text-xs text-slate-700">
                    <p className="font-semibold text-amber-900">기록된 은혜 나눔:</p>
                    <p className="mt-1 whitespace-pre-line">{reflection}</p>
                  </div>
                )
              )}
            </div>
          </div>

          {/* 2. 월간 QT 체크 캘린더 카드 */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5 text-amber-600" />
                <h3 className="text-base font-bold text-slate-900">
                  나의 QT 캘린더
                </h3>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleChangeMonth(-1)}
                  className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="px-2.5 text-sm font-bold text-slate-800">
                  {currentMonth}
                </span>
                <button
                  onClick={() => handleChangeMonth(1)}
                  className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* 이번 달 통계 요약 */}
            <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs">
              <span className="text-slate-600">이번 달 QT 완료 일수</span>
              <span className="font-bold text-emerald-700">
                총 {completedCountThisMonth}일 완료
              </span>
            </div>

            {/* 요일 헤더 */}
            <div className="mt-4 grid grid-cols-7 text-center text-[11px] font-semibold text-slate-400">
              <span className="text-rose-500">일</span>
              <span>월</span>
              <span>화</span>
              <span>수</span>
              <span>목</span>
              <span>금</span>
              <span className="text-blue-500">토</span>
            </div>

            {/* 날짜 그리드 */}
            <div className="mt-2 grid grid-cols-7 gap-1.5">
              {renderCalendarCells()}
            </div>

            {/* 범례 */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-[11px] text-slate-500">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 text-[9px] text-white">
                    ✓
                  </span>
                  QT 읽음 완료
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  은혜 나눔 작성됨
                </span>
              </div>
              <button
                onClick={() =>
                  qtStatus?.activeQtDate &&
                  handleSelectDate(qtStatus.activeQtDate)
                }
                className="font-semibold text-amber-700 hover:underline"
              >
                오늘 기준일로 이동
              </button>
            </div>
          </div>
        </aside>
      </main>

      {/* 소셜 로그인 모달 (카카오 / 네이버 / 구글 모두 지원) */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">
                소셜 계정으로 시작하기
              </h3>
              <button
                onClick={() => setShowLoginModal(false)}
                className="text-sm text-slate-400 hover:text-slate-600"
              >
                닫기 ✕
              </button>
            </div>
            <p className="mt-1.5 text-xs text-slate-500">
              카카오, 네이버, 구글 계정으로 로그인하여 나만의 QT 출석 캘린더와
              묵상 노트를 관리하세요.
            </p>

            <div className="mt-5 space-y-2.5">
              <button
                onClick={() => handleSocialLogin("kakao")}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#FEE500] px-4 py-3 text-sm font-bold text-[#191919] hover:opacity-95"
              >
                <span>💬 카카오로 계속하기</span>
              </button>

              <button
                onClick={() => handleSocialLogin("naver")}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#03C75A] px-4 py-3 text-sm font-bold text-white hover:opacity-95"
              >
                <span>N 네이버로 계속하기</span>
              </button>

              <button
                onClick={() => handleSocialLogin("google")}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                <span>G Google 계정으로 계속하기</span>
              </button>
            </div>

            <p className="mt-4 text-center text-[11px] text-slate-400">
              최초 로그인 시 캘린더에 표시할 닉네임(이름)만 간단히 설정합니다.
            </p>
          </div>
        </div>
      )}

      {/* 최초 로그인 시 간단 회원정보(닉네임) 설정 모달 */}
      {showOnboardingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleCompleteOnboarding}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
          >
            <h3 className="text-lg font-bold text-slate-900">
              간단 회원정보 설정
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              QT 캘린더와 묵상 기록에서 사용할 이름(닉네임)을 입력해 주세요.
            </p>

            <div className="mt-4">
              <label className="block text-xs font-semibold text-slate-700">
                이름 또는 닉네임
              </label>
              <input
                type="text"
                required
                value={nicknameInput}
                onChange={(e) => setNicknameInput(e.target.value)}
                placeholder="예: 홍길동"
                className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowOnboardingModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600"
              >
                취소
              </button>
              <button
                type="submit"
                className="rounded-xl bg-amber-500 px-5 py-2 text-xs font-bold text-white hover:bg-amber-600"
              >
                저장하고 시작하기
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
