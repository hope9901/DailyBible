import crypto from "crypto";
import type { NextRequest, NextResponse } from "next/server";

export const SESSION_COOKIE_NAME = "daily_qt_session";
export const MIN_PASSWORD_LENGTH = 4;

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30일

function getSessionSecret(): string {
  return (
    process.env.SESSION_SECRET ||
    process.env.NOTION_API_KEY ||
    "daily-bible-qt-default-hmac-secret-2026"
  );
}

/**
 * 1. 비밀번호 단방향 암호화 (scrypt + random salt)
 * 형식: scrypt$<saltHex>$<derivedKeyHex>
 */
export function isHashedPassword(stored?: string): boolean {
  return Boolean(stored && stored.startsWith("scrypt$"));
}

export function hashPassword(plainPassword: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(plainPassword, salt, 64).toString("hex");
  return `scrypt$${salt}$${derivedKey}`;
}

export function verifyPassword(
  inputPassword: string,
  storedPassword?: string
): { valid: boolean; needsRehash: boolean } {
  if (!storedPassword || !inputPassword) {
    return { valid: false, needsRehash: false };
  }

  if (isHashedPassword(storedPassword)) {
    const parts = storedPassword.split("$");
    if (parts.length !== 3) {
      return { valid: false, needsRehash: false };
    }
    const [, salt, originalHashHex] = parts;
    try {
      const derivedBuf = crypto.scryptSync(inputPassword, salt, 64);
      const originalBuf = Buffer.from(originalHashHex, "hex");
      if (derivedBuf.length !== originalBuf.length) {
        return { valid: false, needsRehash: false };
      }
      const valid = crypto.timingSafeEqual(derivedBuf, originalBuf);
      return { valid, needsRehash: false };
    } catch {
      return { valid: false, needsRehash: false };
    }
  }

  // 기존 평문 비밀번호 호환 (로그인 성공 시 자동으로 scrypt 해시로 마이그레이션)
  const valid = storedPassword === inputPassword;
  return { valid, needsRehash: valid };
}

/**
 * 2. HMAC-SHA256 서명 기반 HttpOnly 세션 토큰
 */
export function createSessionToken(userId: string): string {
  const payload = {
    u: userId,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url"
  );
  const sig = crypto
    .createHmac("sha256", getSessionSecret())
    .update(payloadB64)
    .digest("base64url");
  return `${payloadB64}.${sig}`;
}

export function verifySessionToken(token?: string | null): string | null {
  if (!token || !token.includes(".")) return null;
  const [payloadB64, sig] = token.split(".");
  if (!payloadB64 || !sig) return null;

  try {
    const expectedSig = crypto
      .createHmac("sha256", getSessionSecret())
      .update(payloadB64)
      .digest("base64url");

    const sigBuf = Buffer.from(sig);
    const expectedBuf = Buffer.from(expectedSig);
    if (
      sigBuf.length !== expectedBuf.length ||
      !crypto.timingSafeEqual(sigBuf, expectedBuf)
    ) {
      return null;
    }

    const decoded = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf8")
    );
    if (
      !decoded ||
      typeof decoded.u !== "string" ||
      typeof decoded.exp !== "number"
    ) {
      return null;
    }
    if (decoded.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return decoded.u;
  } catch {
    return null;
  }
}

export function getAuthenticatedUserId(req: NextRequest): string | null {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  return verifySessionToken(token);
}

export function setSessionCookie(res: NextResponse, userId: string): void {
  const token = createSessionToken(userId);
  res.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export function clearSessionCookie(res: NextResponse): void {
  res.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

/**
 * 3. API 응답용 프로필 정제 (password 필드 완전 제거)
 */
export function sanitizeUserProfile<T extends Record<string, any>>(
  profile: T
): Omit<T, "password"> {
  const { password: _removed, ...safeProfile } = profile;
  return safeProfile;
}

/**
 * 4. 로그인 무차별 대입(Brute-force) 방지 Rate Limiter
 */
interface LoginAttemptRecord {
  count: number;
  resetAt: number;
}

const loginAttempts = new Map<string, LoginAttemptRecord>();
const MAX_LOGIN_ATTEMPTS = 7;
const LOGIN_WINDOW_MS = 5 * 60 * 1000; // 5분

export function checkLoginRateLimit(key: string): {
  allowed: boolean;
  retryAfterSeconds?: number;
} {
  const now = Date.now();
  const record = loginAttempts.get(key);
  if (!record || now > record.resetAt) {
    return { allowed: true };
  }
  if (record.count >= MAX_LOGIN_ATTEMPTS) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((record.resetAt - now) / 1000)),
    };
  }
  return { allowed: true };
}

export function recordLoginFailure(key: string): void {
  const now = Date.now();
  const record = loginAttempts.get(key);
  if (!record || now > record.resetAt) {
    loginAttempts.set(key, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
  } else {
    record.count += 1;
  }
}

export function clearLoginFailures(key: string): void {
  loginAttempts.delete(key);
}
