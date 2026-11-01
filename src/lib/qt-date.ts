/**
 * 00:30 KST 기준일(QT Day) 계산 유틸리티
 *
 * 핵심 규칙 (사용자 요구사항 1-B):
 * - 매일 00:30(KST)에 크롤러가 새로운 본문 말씀을 업데이트합니다.
 * - 따라서 자정(00:00)부터 새벽 00:29:59(KST)까지는 아직 새 말씀이 업데이트되기 전이며,
 *   사용자가 '전날(당일 하루)'의 QT를 마치고 읽음 체크를 마감하는 시간대입니다.
 * - KST 시각에서 30분을 뺀 날짜를 '현재 활성 QT 기준일(Active QT Date)'로 계산합니다.
 */

export interface QtDayStatus {
  /** 00:30 KST 기준 활성 QT 날짜 (YYYY-MM-DD) */
  activeQtDate: string;
  /** 실제 달력상의 KST 날짜 (YYYY-MM-DD) */
  actualCalendarDate: string;
  /** 현재 KST 시:분:초 문자열 */
  currentKstTime: string;
  /** 00:00 ~ 00:29:59 사이(새 말씀 크롤링 직전 마감 30분 구간)인지 여부 */
  isPreUpdateClosingWindow: boolean;
  /** 다음 00:30 말씀 업데이트(마감)까지 남은 시/분/초 */
  countdown: {
    hours: number;
    minutes: number;
    seconds: number;
    totalSeconds: number;
    formatted: string;
  };
}

/**
 * Date 객체를 KST(UTC+9) 기준 연/월/일/시/분/초 컴포넌트로 변환합니다.
 */
export function getKstComponents(now: Date = new Date()) {
  const kstOffsetMs = 9 * 60 * 60 * 1000;
  const kstDate = new Date(now.getTime() + kstOffsetMs);

  const year = kstDate.getUTCFullYear();
  const month = kstDate.getUTCMonth() + 1;
  const day = kstDate.getUTCDate();
  const hours = kstDate.getUTCHours();
  const minutes = kstDate.getUTCMinutes();
  const seconds = kstDate.getUTCSeconds();

  const pad = (n: number) => String(n).padStart(2, "0");
  const dateString = `${year}-${pad(month)}-${pad(day)}`;
  const timeString = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;

  return {
    year,
    month,
    day,
    hours,
    minutes,
    seconds,
    dateString,
    timeString,
    kstTimestampMs: kstDate.getTime(),
  };
}

/**
 * 00:30 KST 기준 현재 활성 QT 날짜(YYYY-MM-DD)를 반환합니다.
 * 예: 11월 2일 00:15 KST -> '2026-11-01' (아직 11월 1일 하루 QT 마감 전)
 * 예: 11월 2일 00:30 KST -> '2026-11-02' (새 말씀 업데이트 완료 및 새 하루 시작)
 */
export function getActiveQtDate(now: Date = new Date()): string {
  const thirtyMinutesMs = 30 * 60 * 1000;
  const shifted = new Date(now.getTime() - thirtyMinutesMs);
  return getKstComponents(shifted).dateString;
}

/**
 * 현재 시각 기준 QT 마감 상태 및 다음 00:30 업데이트까지 남은 시간을 계산합니다.
 */
export function getQtDayStatus(now: Date = new Date()): QtDayStatus {
  const actual = getKstComponents(now);
  const activeQtDate = getActiveQtDate(now);

  // 00:00:00 ~ 00:29:59 KST 사이는 새 말씀 크롤링 직전 '당일 마감 구간'
  const isPreUpdateClosingWindow = actual.hours === 0 && actual.minutes < 30;

  // 다음 00:30 KST까지 남은 초 계산
  const currentSecondsOfDay =
    actual.hours * 3600 + actual.minutes * 60 + actual.seconds;
  const targetSecondsOfDay = 30 * 60; // 00:30:00 = 1800초

  let remainingSeconds = targetSecondsOfDay - currentSecondsOfDay;
  if (remainingSeconds <= 0) {
    remainingSeconds += 24 * 3600;
  }

  const hours = Math.floor(remainingSeconds / 3600);
  const minutes = Math.floor((remainingSeconds % 3600) / 60);
  const seconds = remainingSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");

  return {
    activeQtDate,
    actualCalendarDate: actual.dateString,
    currentKstTime: actual.timeString,
    isPreUpdateClosingWindow,
    countdown: {
      hours,
      minutes,
      seconds,
      totalSeconds: remainingSeconds,
      formatted:
        hours > 0
          ? `${pad(hours)}시간 ${pad(minutes)}분 ${pad(seconds)}초`
          : `${pad(minutes)}분 ${pad(seconds)}초`,
    },
  };
}

/**
 * 특정 연-월(YYYY-MM)의 모든 날짜 배열과 달력 그리드 정보를 생성합니다.
 */
export function getCalendarDays(year: number, month: number) {
  const firstDayOfWeek = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const pad = (n: number) => String(n).padStart(2, "0");

  const days: Array<{
    date: string;
    dayNumber: number;
    dayOfWeek: number;
  }> = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${pad(month)}-${pad(d)}`;
    const dow = new Date(Date.UTC(year, month - 1, d)).getUTCDay();
    days.push({
      date: dateStr,
      dayNumber: d,
      dayOfWeek: dow,
    });
  }

  return {
    year,
    month,
    monthKey: `${year}-${pad(month)}`,
    firstDayOfWeek,
    daysInMonth,
    days,
  };
}
