"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  BookOpen,
  Calendar as CalendarIcon,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Sparkles,
  UserCheck,
  LogOut,
  HelpCircle,
  PenLine,
  Settings,
  X,
} from "lucide-react";

type BibleTranslation = "krv" | "klb"; // krv: 개역개정(기본), klb: 우리말성경

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
  sections: BibleSection[]; // 개역개정
  sectionsKlb: BibleSection[]; // 우리말성경
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
  provider: "local";
  nickname: string;
  preferredTranslation: BibleTranslation;
  isOnboarded: boolean;
}

export default function DailyQtHomePage() {
  // 로그인 및 회원가입 / 회원설정 상태
  const [user, setUser] = useState<SessionUser | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authTab, setAuthTab] = useState<"login" | "register">("login");

  // 로그인 / 회원가입 입력 폼 상태
  const [authUserId, setAuthUserId] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authPasswordConfirm, setAuthPasswordConfirm] = useState("");
  const [authNickname, setAuthNickname] = useState("");
  const [authTranslation, setAuthTranslation] =
    useState<BibleTranslation>("krv");
  const [authError, setAuthError] = useState<string | null>(null);

  const resetAuthForm = (nextTab?: "login" | "register") => {
    if (nextTab) setAuthTab(nextTab);
    setAuthUserId("");
    setAuthPassword("");
    setAuthPasswordConfirm("");
    setAuthNickname("");
    setAuthTranslation("krv");
    setAuthError(null);
  };

  // 회원설정(비밀번호 및 기본 역본 변경) 모달
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsNickname, setSettingsNickname] = useState("");
  const [settingsTranslation, setSettingsTranslation] =
    useState<BibleTranslation>("krv");
  const [settingsNewPassword, setSettingsNewPassword] = useState("");
  const [settingsConfirmPassword, setSettingsConfirmPassword] = useState("");
  const [settingsError, setSettingsError] = useState<string | null>(null);

  // 현재 화면에서 보고 있는 성경 역본 토글 상태 (기본값: 개역개정 "krv")
  const [translation, setTranslation] = useState<BibleTranslation>("krv");

  // 날짜 및 캘린더 팝업 상태
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [currentMonth, setCurrentMonth] = useState<string>(""); // YYYY-MM
  const [qtStatus, setQtStatus] = useState<QtDayStatus | null>(null);
  const [showCalendarModal, setShowCalendarModal] = useState(false);

  // 말씀 및 기록 데이터 상태
  const [dailyWord, setDailyWord] = useState<DailyWordData | null>(null);
  const [monthLogs, setMonthLogs] = useState<Record<string, QtLogEntry>>({});
  const [isCompleted, setIsCompleted] = useState(false);
  const [reflection, setReflection] = useState("");
  const [showReflectionEditor, setShowReflectionEditor] = useState(false);
  const [fontSize, setFontSize] = useState<"base" | "lg" | "xl">("lg");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [crawling, setCrawling] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3000);
  };

  // 로컬 스토리지에 저장된 로그인 사용자 복원 및 선호 역본으로 초기화면 설정
  useEffect(() => {
    try {
      const savedUser = localStorage.getItem("daily_qt_user");
      if (savedUser) {
        const parsed = JSON.parse(savedUser) as SessionUser;
        const pref: BibleTranslation =
          parsed.preferredTranslation === "klb" ? "klb" : "krv";
        const normalizedUser: SessionUser = {
          ...parsed,
          provider: "local",
          preferredTranslation: pref,
        };
        setUser(normalizedUser);
        setTranslation(pref);
      } else {
        setTranslation("krv");
      }
    } catch {
      setTranslation("krv");
    }
  }, []);

  const fetchQtData = useCallback(
    async (
      dateParam?: string,
      monthParam?: string,
      activeUser?: SessionUser | null
    ) => {
      setLoading(true);
      try {
        const currentUser = activeUser !== undefined ? activeUser : user;
        const params = new URLSearchParams();
        if (dateParam) params.set("date", dateParam);
        if (monthParam) params.set("month", monthParam);
        if (currentUser?.userId) {
          params.set("userId", currentUser.userId);
          params.set("provider", "local");
        }

        const res = await fetch(`/api/qt?${params.toString()}`);
        const data = await res.json();

        if (data.qtStatus) setQtStatus(data.qtStatus);
        if (data.selectedDate) setSelectedDate(data.selectedDate);
        if (data.selectedMonth) setCurrentMonth(data.selectedMonth);
        if (data.dailyWord) setDailyWord(data.dailyWord);
        if (data.monthLogs) setMonthLogs(data.monthLogs);

        if (data.currentDateLog) {
          setIsCompleted(Boolean(data.currentDateLog.isCompleted));
          const savedNote = data.currentDateLog.reflection || "";
          setReflection(savedNote);
          setShowReflectionEditor(false);
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

  // 날짜 변경 핸들러
  const handleSelectDate = async (dateStr: string, closePopup = false) => {
    const nextMonth = dateStr.slice(0, 7);
    setSelectedDate(dateStr);
    if (nextMonth !== currentMonth) {
      setCurrentMonth(nextMonth);
    }
    if (closePopup) {
      setShowCalendarModal(false);
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

  // 아이디 / 비밀번호 로그인 & 회원가입 제출 처리
  const handleLocalAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    if (!authUserId.trim() || !authPassword.trim()) {
      setAuthError("아이디와 비밀번호를 입력해 주세요.");
      return;
    }

    if (authTab === "register" && authPassword !== authPasswordConfirm) {
      setAuthError("비밀번호와 비밀번호 확인이 일치하지 않습니다.");
      return;
    }

    try {
      const res = await fetch("/api/user/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: authTab,
          userId: authUserId.trim(),
          password: authPassword,
          nickname:
            authTab === "register"
              ? authNickname.trim() || authUserId.trim()
              : undefined,
          preferredTranslation:
            authTab === "register" ? authTranslation : undefined,
          provider: "local",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setAuthError(data.error || "로그인/회원가입에 실패했습니다.");
        return;
      }

      const pref: BibleTranslation =
        data.profile.preferredTranslation === "klb" ? "klb" : "krv";
      const loggedInUser: SessionUser = {
        userId: data.profile.userId,
        provider: "local",
        nickname: data.profile.nickname,
        preferredTranslation: pref,
        isOnboarded: true,
      };

      setUser(loggedInUser);
      setTranslation(pref); // 회원가입/로그인한 유저의 기본 역본으로 초기화면 설정
      localStorage.setItem("daily_qt_user", JSON.stringify(loggedInUser));
      setShowAuthModal(false);
      resetAuthForm("login");
      showToast(
        `${loggedInUser.nickname}님 환영합니다! (${
          pref === "klb" ? "우리말성경" : "개역개정"
        }으로 표시됩니다)`
      );
      await fetchQtData(selectedDate, currentMonth, loggedInUser);
    } catch {
      setAuthError("요청 처리 중 오류가 발생했습니다.");
    }
  };

  // 회원설정 모달 열기
  const handleOpenSettings = () => {
    if (!user) return;
    setSettingsNickname(user.nickname);
    setSettingsTranslation(user.preferredTranslation || "krv");
    setSettingsNewPassword("");
    setSettingsConfirmPassword("");
    setSettingsError(null);
    setShowSettingsModal(true);
  };

  // 회원설정 저장 (닉네임, 비밀번호 변경, 기본 성경 역본 변경)
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSettingsError(null);

    if (
      settingsNewPassword.trim() &&
      settingsNewPassword !== settingsConfirmPassword
    ) {
      setSettingsError("새 비밀번호와 비밀번호 확인이 일치하지 않습니다.");
      return;
    }

    try {
      const res = await fetch("/api/user/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.userId,
          nickname: settingsNickname.trim() || user.nickname,
          newPassword: settingsNewPassword.trim() || undefined,
          preferredTranslation: settingsTranslation,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setSettingsError(data.error || "설정 저장에 실패했습니다.");
        return;
      }

      const updatedUser: SessionUser = {
        ...user,
        nickname: settingsNickname.trim() || user.nickname,
        preferredTranslation: settingsTranslation,
      };
      setUser(updatedUser);
      setTranslation(settingsTranslation); // 변경된 기본 역본으로 즉시 반영
      localStorage.setItem("daily_qt_user", JSON.stringify(updatedUser));
      setShowSettingsModal(false);
      showToast(
        `회원설정이 저장되었습니다. (기본 역본: ${
          settingsTranslation === "klb" ? "우리말성경" : "개역개정"
        })`
      );
    } catch {
      setSettingsError("회원설정 저장 중 오류가 발생했습니다.");
    }
  };

  const handleLogout = () => {
    setUser(null);
    setTranslation("krv"); // 로그아웃 시 기본값 개역개정으로 복귀
    resetAuthForm("login");
    localStorage.removeItem("daily_qt_user");
    showToast("로그아웃되었습니다.");
  };

  // 오늘(00:30 KST 기준 활성 날짜)인지 판별
  const isTodayActiveQt =
    !selectedDate ||
    !qtStatus?.activeQtDate ||
    selectedDate === qtStatus.activeQtDate;

  // QT 읽음 체크 토글 (오늘 활성 QT 날짜에서만 가능)
  const handleToggleQtCheck = async (nextChecked: boolean) => {
    if (!isTodayActiveQt) return;

    if (!user) {
      setShowAuthModal(true);
      showToast("로그인 후 QT 완료를 체크할 수 있습니다.");
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
            ? `✅ 오늘의 QT 완료!`
            : `QT 완료 체크가 해제되었습니다.`
        );
      }
    } catch (err) {
      console.error("Failed to save QT check:", err);
    } finally {
      setSaving(false);
    }
  };

  // 느낀점(은혜 받은점) 저장 (오늘 활성 QT 날짜에서만 가능)
  const handleSaveReflection = async () => {
    if (!isTodayActiveQt) return;

    if (!user) {
      setShowAuthModal(true);
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
          isCompleted: true,
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
        setShowReflectionEditor(false);
        showToast("📝 묵상 메모와 QT 완료가 저장되었습니다.");
      }
    } catch (err) {
      console.error("Failed to save reflection:", err);
    } finally {
      setSaving(false);
    }
  };

  // 수동 크롤링 동기화 버튼 (개역개정 + 우리말성경 동시 크롤링)
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
          `🔄 ${selectedDate} 말씀(개역개정·우리말성경)을 새로 불러왔습니다.`
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
          onClick={() => handleSelectDate(dateStr, true)}
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

  const fontSizeClass =
    fontSize === "xl"
      ? "text-lg leading-relaxed"
      : fontSize === "lg"
      ? "text-base leading-relaxed"
      : "text-sm leading-relaxed";

  // 현재 선택된 역본(개역개정 vs 우리말성경)에 따른 본문 섹션
  const activeSections =
    translation === "klb" &&
    dailyWord?.sectionsKlb &&
    dailyWord.sectionsKlb.length > 0
      ? dailyWord.sectionsKlb
      : dailyWord?.sections || [];

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      {/* 토스트 알림 */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3.5 text-sm font-medium text-white shadow-xl">
          <Sparkles className="h-4 w-4 text-amber-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 심플 메인 헤더 */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm">
              <BookOpen className="h-5 w-5" />
            </div>
            <h1 className="text-lg font-bold tracking-tight text-slate-900">
              생명의 삶 QT
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {/* 우측 상단 QT 현황 캘린더 팝업 버튼 */}
            <button
              onClick={() => setShowCalendarModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2 text-xs sm:text-sm font-semibold text-amber-900 hover:bg-amber-100 transition-colors"
            >
              <CalendarIcon className="h-4 w-4 text-amber-600" />
              <span>QT 캘린더</span>
              <span className="ml-0.5 rounded-full bg-amber-500 px-2 py-0.5 text-[11px] font-bold text-white">
                {completedCountThisMonth}일
              </span>
            </button>

            {user ? (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleOpenSettings}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100"
                  title="회원설정 (비밀번호 및 기본 성경 역본 변경)"
                >
                  <UserCheck className="h-3.5 w-3.5 text-emerald-600" />
                  <span>{user.nickname}님</span>
                  <Settings className="ml-0.5 h-3.5 w-3.5 text-slate-500" />
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
                onClick={() => {
                  resetAuthForm("login");
                  setShowAuthModal(true);
                }}
                className="rounded-xl bg-slate-900 px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
              >
                로그인 / 회원가입
              </button>
            )}
          </div>
        </div>
      </header>

      {/* 본문 1단 레이아웃: 1) 성경 말씀 카드 -> 2) 말씀 밑에 위치한 오늘 QT 완료 체크 카드 */}
      <main className="mx-auto mt-6 max-w-4xl space-y-5 px-4">
        {/* 1. 생명의 삶 본문 말씀 카드 (개역개정 / 우리말성경 토글 지원) */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {/* 상단 날짜 및 역본 토글(개역개정 / 우리말성경) / 글자 크기 조절 */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-900">
                {selectedDate || "오늘"} 말씀
              </span>
              {!isTodayActiveQt && qtStatus?.activeQtDate && (
                <button
                  onClick={() => handleSelectDate(qtStatus.activeQtDate)}
                  className="text-xs font-semibold text-amber-700 underline hover:text-amber-800"
                >
                  오늘 말씀으로 돌아가기
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* 개역개정 / 우리말성경 토글 버튼 */}
              <div className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-100 p-0.5 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setTranslation("krv")}
                  className={`rounded-lg px-3 py-1.5 transition-all ${
                    translation === "krv"
                      ? "bg-amber-500 text-white shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  개역개정
                </button>
                <button
                  type="button"
                  onClick={() => setTranslation("klb")}
                  className={`rounded-lg px-3 py-1.5 transition-all ${
                    translation === "klb"
                      ? "bg-amber-500 text-white shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  우리말성경
                </button>
              </div>

              {/* 글자 크기 조절 */}
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
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 p-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                title="개역개정·우리말성경 말씀 새로고침"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${crawling ? "animate-spin" : ""}`}
                />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="py-16 text-center text-sm text-slate-400">
              말씀을 불러오는 중입니다...
            </div>
          ) : dailyWord ? (
            <div className="mt-5 space-y-6">
              {/* 말씀 제목 및 본문 장절 */}
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-amber-700">
                    {dailyWord.scripture}
                  </p>
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                    {translation === "klb" ? "우리말성경" : "개역개정"}
                  </span>
                </div>
                <h2 className="mt-1 text-2xl font-bold text-slate-900">
                  {dailyWord.title}
                </h2>
              </div>

              {/* 성경 본문 절별 리스트 */}
              <div className="space-y-6">
                {activeSections.map((section, idx) => (
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
                <span>
                  출처: 두란노 생명의 삶 (
                  {translation === "klb" ? "우리말성경" : "개역개정"})
                </span>
                <a
                  href={dailyWord.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="underline hover:text-slate-600"
                >
                  원문 보기 ↗
                </a>
              </div>
            </div>
          ) : null}
        </section>

        {/* 2. 말씀 밑 QT 완료 체크 영역: 오늘 날짜일 때만 완료 체크 버튼 노출, 과거 날짜일 때는 버튼 숨김 */}
        {isTodayActiveQt ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleToggleQtCheck(!isCompleted)}
                  disabled={saving}
                  className={`flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold transition-all shadow-sm ${
                    isCompleted
                      ? "bg-emerald-600 text-white hover:bg-emerald-700"
                      : "bg-amber-500 text-white hover:bg-amber-600"
                  }`}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>
                    {isCompleted ? "오늘 QT 완료됨" : "오늘 QT 완료 체크"}
                  </span>
                </button>

                <div>
                  <p className="text-sm font-bold text-slate-900">
                    {selectedDate || "오늘"} QT 점검
                  </p>
                  <p className="text-xs text-slate-500">
                    {isCompleted
                      ? "오늘 말씀을 읽고 캘린더에 기록했습니다."
                      : "말씀을 다 읽으셨다면 완료 체크를 눌러주세요."}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowReflectionEditor((prev) => !prev)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                <PenLine className="h-3.5 w-3.5 text-amber-600" />
                <span>
                  {showReflectionEditor
                    ? "메모 닫기"
                    : reflection
                    ? "내 묵상 메모 수정"
                    : "느낀점 메모 (선택)"}
                </span>
              </button>
            </div>

            {/* 저장된 느낀점 한눈에 보기 (편집기가 닫혀 있을 때) */}
            {!showReflectionEditor && reflection && (
              <div className="mt-3.5 flex items-start justify-between gap-2 rounded-xl bg-amber-50/70 px-3.5 py-2.5 text-xs text-slate-700">
                <p className="whitespace-pre-line leading-relaxed">
                  <strong className="mr-1.5 text-amber-900">나의 메모:</strong>
                  {reflection}
                </p>
              </div>
            )}

            {/* 선택형 느낀점 입력창 */}
            {showReflectionEditor && (
              <div className="mt-3.5 space-y-2.5 border-t border-slate-100 pt-3.5">
                <textarea
                  rows={3}
                  value={reflection}
                  onChange={(e) => setReflection(e.target.value)}
                  placeholder="오늘 말씀을 통해 받은 은혜나 짧은 기도문을 남겨보세요. (선택사항)"
                  className="w-full rounded-xl border border-slate-200 p-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-amber-500 focus:outline-none"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowReflectionEditor(false)}
                    className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveReflection}
                    disabled={saving}
                    className="rounded-xl bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                  >
                    {saving ? "저장 중..." : "메모 저장"}
                  </button>
                </div>
              </div>
            )}
          </section>
        ) : (
          /* 과거 날짜 조회 시: QT 완료 체크 버튼은 숨기고, 기존에 작성된 기록이 있으면 읽기 전용으로만 표시 */
          reflection && (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-bold text-amber-900">
                {selectedDate} 작성했던 묵상 메모
              </p>
              <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-slate-700">
                {reflection}
              </p>
            </section>
          )
        )}
      </main>

      {/* 우측 상단 버튼 클릭 시 열리는 QT 현황 캘린더 팝업 모달 */}
      {showCalendarModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
          onClick={() => setShowCalendarModal(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5 text-amber-600" />
                <h3 className="text-base font-bold text-slate-900">
                  나의 QT 현황 캘린더
                </h3>
              </div>
              <button
                onClick={() => setShowCalendarModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* 월 이동 및 완료 일수 요약 */}
            <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-2.5">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleChangeMonth(-1)}
                  className="rounded-lg border border-slate-200 bg-white p-1 text-slate-600 hover:bg-slate-100"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="px-2.5 text-sm font-bold text-slate-800">
                  {currentMonth}
                </span>
                <button
                  onClick={() => handleChangeMonth(1)}
                  className="rounded-lg border border-slate-200 bg-white p-1 text-slate-600 hover:bg-slate-100"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              <span className="text-xs font-bold text-emerald-700">
                이달 {completedCountThisMonth}일 완료
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

            {/* 범례 및 오늘 이동 */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3.5 text-[11px] text-slate-500">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 text-[9px] text-white">
                    ✓
                  </span>
                  QT 완료
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  메모 작성됨
                </span>
              </div>
              <button
                onClick={() =>
                  qtStatus?.activeQtDate &&
                  handleSelectDate(qtStatus.activeQtDate, true)
                }
                className="font-semibold text-amber-700 hover:underline"
              >
                오늘 날짜로 이동
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 아이디/비밀번호 로그인 & 회원가입 모달 (소셜 로그인 제거 완료) */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">
                {authTab === "login" ? "로그인" : "회원가입"}
              </h3>
              <button
                onClick={() => setShowAuthModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* 로그인 / 회원가입 탭 전환 */}
            <div className="mt-4 grid grid-cols-2 rounded-xl bg-slate-100 p-1 text-xs font-bold">
              <button
                type="button"
                onClick={() => resetAuthForm("login")}
                className={`rounded-lg py-2 transition-all ${
                  authTab === "login"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                로그인
              </button>
              <button
                type="button"
                onClick={() => resetAuthForm("register")}
                className={`rounded-lg py-2 transition-all ${
                  authTab === "register"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                회원가입
              </button>
            </div>

            <form
              onSubmit={handleLocalAuthSubmit}
              autoComplete="off"
              className="mt-4 space-y-3"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  아이디
                </label>
                <input
                  type="text"
                  required
                  autoComplete="off"
                  value={authUserId}
                  onChange={(e) => setAuthUserId(e.target.value)}
                  placeholder="아이디 입력"
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  비밀번호
                </label>
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="비밀번호 입력"
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>

              {authTab === "register" && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      비밀번호 확인
                    </label>
                    <input
                      type="password"
                      required
                      autoComplete="new-password"
                      value={authPasswordConfirm}
                      onChange={(e) => setAuthPasswordConfirm(e.target.value)}
                      placeholder="비밀번호 다시 입력"
                      className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-amber-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      닉네임 (이름)
                    </label>
                    <input
                      type="text"
                      required
                      autoComplete="off"
                      value={authNickname}
                      onChange={(e) => setAuthNickname(e.target.value)}
                      placeholder="예: 홍길동"
                      className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-amber-500 focus:outline-none"
                    />
                  </div>

                  {/* 회원가입 시 기본 성경 역본 선택 (기본값: 개역개정) */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      기본 성경 역본 선택 (초기화면 표시)
                    </label>
                    <div className="mt-1.5 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setAuthTranslation("krv")}
                        className={`rounded-xl border py-2.5 text-xs font-bold transition-all ${
                          authTranslation === "krv"
                            ? "border-amber-500 bg-amber-50 text-amber-900 ring-2 ring-amber-500/20"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        개역개정 (기본)
                      </button>
                      <button
                        type="button"
                        onClick={() => setAuthTranslation("klb")}
                        className={`rounded-xl border py-2.5 text-xs font-bold transition-all ${
                          authTranslation === "klb"
                            ? "border-amber-500 bg-amber-50 text-amber-900 ring-2 ring-amber-500/20"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        우리말성경
                      </button>
                    </div>
                  </div>
                </>
              )}

              {authError && (
                <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600">
                  {authError}
                </p>
              )}

              <button
                type="submit"
                className="w-full rounded-xl bg-amber-500 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-amber-600"
              >
                {authTab === "login" ? "로그인하기" : "회원가입 완료"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 회원설정 모달 (비밀번호 변경 및 기본 성경 역본 변경) */}
      {showSettingsModal && user && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
          onClick={() => setShowSettingsModal(false)}
        >
          <form
            onSubmit={handleSaveSettings}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-amber-600" />
                <h3 className="text-base font-bold text-slate-900">회원설정</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  닉네임 (이름)
                </label>
                <input
                  type="text"
                  required
                  value={settingsNickname}
                  onChange={(e) => setSettingsNickname(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>

              {/* 기본 성경 역본 변경 */}
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  기본 성경 역본 (초기화면 설정)
                </label>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSettingsTranslation("krv")}
                    className={`rounded-xl border py-2.5 text-xs font-bold transition-all ${
                      settingsTranslation === "krv"
                        ? "border-amber-500 bg-amber-50 text-amber-900 ring-2 ring-amber-500/20"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    개역개정 (기본)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettingsTranslation("klb")}
                    className={`rounded-xl border py-2.5 text-xs font-bold transition-all ${
                      settingsTranslation === "klb"
                        ? "border-amber-500 bg-amber-50 text-amber-900 ring-2 ring-amber-500/20"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    우리말성경
                  </button>
                </div>
              </div>

              {/* 비밀번호 변경 */}
              <div className="border-t border-slate-100 pt-3.5 space-y-3">
                <p className="text-xs font-bold text-slate-800">
                  비밀번호 변경 (변경 시에만 입력)
                </p>
                <div>
                  <label className="block text-xs font-medium text-slate-600">
                    새 비밀번호
                  </label>
                  <input
                    type="password"
                    value={settingsNewPassword}
                    onChange={(e) => setSettingsNewPassword(e.target.value)}
                    placeholder="새 비밀번호 입력"
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600">
                    새 비밀번호 확인
                  </label>
                  <input
                    type="password"
                    value={settingsConfirmPassword}
                    onChange={(e) => setSettingsConfirmPassword(e.target.value)}
                    placeholder="새 비밀번호 다시 입력"
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              {settingsError && (
                <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600">
                  {settingsError}
                </p>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                취소
              </button>
              <button
                type="submit"
                className="rounded-xl bg-amber-500 px-5 py-2 text-xs font-bold text-white hover:bg-amber-600"
              >
                설정 저장
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
