import { Client } from "@notionhq/client";
import fs from "fs";
import path from "path";
import { DailyWordData, BibleTranslation, crawlDurannoQt } from "./crawler";
import {
  hashPassword,
  verifyPassword,
  sanitizeUserProfile,
  MIN_PASSWORD_LENGTH,
} from "./security";

export interface UserProfile {
  userId: string;
  provider: "kakao" | "naver" | "google" | "local" | "demo";
  email: string;
  nickname: string;
  password?: string;
  preferredTranslation: BibleTranslation; // "krv" (개역개정, 기본) | "klb" (우리말성경)
  isOnboarded: boolean;
  createdAt: string;
}

export interface QtLogEntry {
  logId: string; // `${userId}_${date}`
  userId: string;
  date: string; // YYYY-MM-DD
  isCompleted: boolean; // 오늘 QT 읽었는지 체크 여부
  reflection: string; // 오늘 느낀점 / 은혜 받은점 (선택 작성, 빈 문자열 가능)
  updatedAt: string;
}

interface LocalStoreSchema {
  dailyWords: Record<string, DailyWordData>;
  users: Record<string, UserProfile>;
  qtLogs: Record<string, QtLogEntry>;
}

const LOCAL_STORE_PATH = path.join(process.cwd(), ".data", "local-store.json");

/**
 * Notion API 환경 변수가 모두 설정되어 있는지 확인합니다.
 */
export function isNotionConfigured(): boolean {
  return Boolean(
    process.env.NOTION_API_KEY &&
      !process.env.NOTION_API_KEY.includes("xxxx") &&
      process.env.NOTION_DAILY_WORD_DB_ID &&
      process.env.NOTION_QT_LOGS_DB_ID
  );
}

function getNotionClient(): Client {
  return new Client({
    auth: process.env.NOTION_API_KEY,
  });
}

function readLocalStore(): LocalStoreSchema {
  try {
    if (fs.existsSync(LOCAL_STORE_PATH)) {
      const raw = fs.readFileSync(LOCAL_STORE_PATH, "utf-8");
      return JSON.parse(raw) as LocalStoreSchema;
    }
  } catch (err) {
    console.warn("[LocalStore] Failed to read local store:", err);
  }
  return { dailyWords: {}, users: {}, qtLogs: {} };
}

function writeLocalStore(data: LocalStoreSchema): void {
  try {
    const dir = path.dirname(LOCAL_STORE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(LOCAL_STORE_PATH, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.warn("[LocalStore] Write skipped:", err);
  }
}

/**
 * 1. 일일 말씀(Daily_Word) 조회 및 저장 (개역개정 + 우리말성경 모두 포함)
 */
export async function getDailyWord(date: string): Promise<DailyWordData> {
  if (isNotionConfigured()) {
    try {
      const notion = getNotionClient();
      const dbId = process.env.NOTION_DAILY_WORD_DB_ID!;
      const response = await notion.databases.query({
        database_id: dbId,
        filter: {
          property: "Date",
          rich_text: {
            equals: date,
          },
        },
        page_size: 1,
      });

      if (response.results.length > 0) {
        const page: any = response.results[0];
        const props = page.properties;
        const getText = (prop: any) =>
          prop?.rich_text?.map((t: any) => t.plain_text).join("") ||
          prop?.title?.map((t: any) => t.plain_text).join("") ||
          "";

        const rawJson = getText(props.ContentJson);
        if (rawJson) {
          const parsed = JSON.parse(rawJson) as DailyWordData;
          if (parsed.sectionsKlb && parsed.sectionsKlb.length > 0) {
            return parsed;
          }
        }
      }
    } catch (err) {
      console.warn("[Notion] getDailyWord query fallback:", err);
    }
  }

  // 로컬 캐시 확인 (우리말성경 sectionsKlb까지 있는지 확인)
  const store = readLocalStore();
  const cached = store.dailyWords[date];
  if (
    cached &&
    Array.isArray(cached.sectionsKlb) &&
    cached.sectionsKlb.length > 0 &&
    cached.sectionsKlb[0]?.verses?.[0]?.text !==
      cached.sections?.[0]?.verses?.[0]?.text
  ) {
    return cached;
  }

  // 아직 저장된 말씀이 없거나 구버전 캐시이면 개역개정 + 우리말성경 실시간 크롤링 후 저장
  const crawled = await crawlDurannoQt(date);
  await saveDailyWord(crawled);
  return crawled;
}

export async function saveDailyWord(word: DailyWordData): Promise<void> {
  const store = readLocalStore();
  store.dailyWords[word.date] = word;
  writeLocalStore(store);

  if (!isNotionConfigured()) return;

  try {
    const notion = getNotionClient();
    const dbId = process.env.NOTION_DAILY_WORD_DB_ID!;

    const existing = await notion.databases.query({
      database_id: dbId,
      filter: {
        property: "Date",
        rich_text: { equals: word.date },
      },
      page_size: 1,
    });

    const fullJson = JSON.stringify(word);
    const chunks: { text: { content: string } }[] = [];
    for (let i = 0; i < fullJson.length; i += 1900) {
      chunks.push({ text: { content: fullJson.slice(i, i + 1900) } });
    }

    const properties: any = {
      Title: {
        title: [{ text: { content: `${word.date} | ${word.title}` } }],
      },
      Date: {
        rich_text: [{ text: { content: word.date } }],
      },
      Scripture: {
        rich_text: [{ text: { content: word.scripture } }],
      },
      ContentJson: {
        rich_text: chunks.slice(0, 5),
      },
    };

    if (existing.results.length > 0) {
      await notion.pages.update({
        page_id: existing.results[0].id,
        properties,
      });
    } else {
      await notion.pages.create({
        parent: { database_id: dbId },
        properties,
      });
    }
  } catch (err) {
    console.warn("[Notion] Failed to upsert Daily_Word to Notion:", err);
  }
}

/**
 * 2. 사용자별 QT 체크 및 느낀점(은혜 받은점) 조회 / 저장
 */
export async function getUserQtLogsByMonth(
  userId: string,
  yearMonth: string // YYYY-MM
): Promise<Record<string, QtLogEntry>> {
  const result: Record<string, QtLogEntry> = {};

  if (isNotionConfigured()) {
    try {
      const notion = getNotionClient();
      const dbId = process.env.NOTION_QT_LOGS_DB_ID!;
      const response = await notion.databases.query({
        database_id: dbId,
        filter: {
          and: [
            {
              property: "UserId",
              rich_text: { equals: userId },
            },
            {
              property: "Date",
              rich_text: { starts_with: yearMonth },
            },
          ],
        },
        page_size: 100,
      });

      for (const page of response.results as any[]) {
        const props = page.properties;
        const getText = (prop: any) =>
          prop?.rich_text?.map((t: any) => t.plain_text).join("") ||
          prop?.title?.map((t: any) => t.plain_text).join("") ||
          "";
        const date = getText(props.Date);
        if (date) {
          result[date] = {
            logId: `${userId}_${date}`,
            userId,
            date,
            isCompleted: Boolean(props.IsCompleted?.checkbox),
            reflection: getText(props.Reflection),
            updatedAt: getText(props.UpdatedAt) || page.last_edited_time,
          };
        }
      }
      return result;
    } catch (err) {
      console.warn("[Notion] getUserQtLogsByMonth fallback:", err);
    }
  }

  const store = readLocalStore();
  for (const entry of Object.values(store.qtLogs)) {
    if (entry.userId === userId && entry.date.startsWith(yearMonth)) {
      result[entry.date] = entry;
    }
  }
  return result;
}

export async function upsertUserQtLog(params: {
  userId: string;
  date: string;
  isCompleted: boolean;
  reflection?: string;
}): Promise<QtLogEntry> {
  const logId = `${params.userId}_${params.date}`;
  const store = readLocalStore();
  const prev = store.qtLogs[logId];

  const entry: QtLogEntry = {
    logId,
    userId: params.userId,
    date: params.date,
    isCompleted: params.isCompleted,
    reflection:
      params.reflection !== undefined
        ? params.reflection
        : prev?.reflection || "",
    updatedAt: new Date().toISOString(),
  };

  store.qtLogs[logId] = entry;
  writeLocalStore(store);

  if (isNotionConfigured()) {
    try {
      const notion = getNotionClient();
      const dbId = process.env.NOTION_QT_LOGS_DB_ID!;
      const existing = await notion.databases.query({
        database_id: dbId,
        filter: {
          property: "LogId",
          title: { equals: logId },
        },
        page_size: 1,
      });

      const properties: any = {
        LogId: {
          title: [{ text: { content: logId } }],
        },
        UserId: {
          rich_text: [{ text: { content: entry.userId } }],
        },
        Date: {
          rich_text: [{ text: { content: entry.date } }],
        },
        IsCompleted: {
          checkbox: entry.isCompleted,
        },
        Reflection: {
          rich_text: [{ text: { content: entry.reflection.slice(0, 1990) } }],
        },
        UpdatedAt: {
          rich_text: [{ text: { content: entry.updatedAt } }],
        },
      };

      if (existing.results.length > 0) {
        await notion.pages.update({
          page_id: existing.results[0].id,
          properties,
        });
      } else {
        await notion.pages.create({
          parent: { database_id: dbId },
          properties,
        });
      }
    } catch (err) {
      console.warn("[Notion] upsertUserQtLog error:", err);
    }
  }

  return entry;
}

/**
 * 3. 사용자 프로필(닉네임, 비밀번호, 선호 역본) 조회 및 저장
 */
function parseUserMetadataFromEmailField(raw: string): {
  email: string;
  preferredTranslation: BibleTranslation;
  password: string;
} {
  if (raw.startsWith("META:")) {
    try {
      const parsed = JSON.parse(raw.slice(5));
      return {
        email: parsed.email || "",
        preferredTranslation:
          parsed.preferredTranslation === "klb" ? "klb" : "krv",
        password: parsed.password || "",
      };
    } catch {
      // ignore
    }
  }
  if (raw.startsWith("역본:")) {
    const pref = raw.replace("역본:", "").trim();
    return {
      email: "",
      preferredTranslation: pref === "klb" ? "klb" : "krv",
      password: "",
    };
  }
  return {
    email: raw,
    preferredTranslation: "krv",
    password: "",
  };
}

function encodeUserMetadataToEmailField(user: UserProfile): string {
  return `META:${JSON.stringify({
    email: user.email || "",
    preferredTranslation: user.preferredTranslation || "krv",
  })}`;
}

async function fetchUserFromNotion(userId: string): Promise<UserProfile | null> {
  if (!isNotionConfigured() || !process.env.NOTION_USERS_DB_ID) return null;
  try {
    const notion = getNotionClient();
    const dbId = process.env.NOTION_USERS_DB_ID;
    const existing = await notion.databases.query({
      database_id: dbId,
      filter: {
        property: "UserId",
        title: { equals: userId },
      },
      page_size: 1,
    });

    if (existing.results.length > 0) {
      const page: any = existing.results[0];
      const props = page.properties;
      const getText = (prop: any) =>
        prop?.rich_text?.map((t: any) => t.plain_text).join("") || "";
      const meta = parseUserMetadataFromEmailField(getText(props.Email));
      const directPassword = getText(props.Password) || meta.password;
      const rawPref =
        getText(props.PreferredTranslation) || meta.preferredTranslation;
      const preferredTranslation: BibleTranslation =
        rawPref === "klb" || rawPref === "우리말성경" ? "klb" : "krv";

      return {
        userId,
        provider: (getText(props.Provider) as any) || "local",
        email: meta.email,
        nickname: getText(props.Nickname) || userId,
        password: directPassword,
        preferredTranslation,
        isOnboarded: Boolean(props.IsOnboarded?.checkbox),
        createdAt: page.created_time,
      };
    }
  } catch (err) {
    console.warn("[Notion] fetchUserFromNotion error:", err);
  }
  return null;
}

export async function getOrCreateUserProfile(params: {
  userId: string;
  provider: "kakao" | "naver" | "google" | "local" | "demo";
  email: string;
  defaultName: string;
}): Promise<UserProfile> {
  const store = readLocalStore();
  if (store.users[params.userId]) {
    const u = store.users[params.userId];
    if (!u.preferredTranslation) {
      u.preferredTranslation = "krv";
    }
    return sanitizeUserProfile(u);
  }

  const notionUser = await fetchUserFromNotion(params.userId);
  if (notionUser) {
    store.users[params.userId] = notionUser;
    writeLocalStore(store);
    return sanitizeUserProfile(notionUser);
  }

  const newProfile: UserProfile = {
    userId: params.userId,
    provider: params.provider,
    email: params.email,
    nickname: params.defaultName,
    preferredTranslation: "krv",
    isOnboarded: false,
    createdAt: new Date().toISOString(),
  };

  store.users[params.userId] = newProfile;
  writeLocalStore(store);
  return sanitizeUserProfile(newProfile);
}

export async function registerOrLoginUser(params: {
  mode: "register" | "login";
  userId: string;
  password?: string;
  nickname?: string;
  preferredTranslation?: BibleTranslation;
  provider?: "kakao" | "naver" | "google" | "local";
}): Promise<{ ok: boolean; error?: string; profile?: UserProfile }> {
  const store = readLocalStore();
  const cleanId = params.userId.trim();
  const inputPassword = (params.password || "").trim();

  if (!cleanId || !inputPassword) {
    return { ok: false, error: "아이디와 비밀번호를 모두 입력해 주세요." };
  }

  // 노션 DB가 연결된 경우 노션 DB에서 최신 회원 정보를 우선 조회하여 아이디/비밀번호 검증
  let existing = await fetchUserFromNotion(cleanId);
  if (existing) {
    store.users[cleanId] = existing;
    writeLocalStore(store);
  } else {
    existing = store.users[cleanId] || null;
  }

  if (params.mode === "register") {
    if (inputPassword.length < MIN_PASSWORD_LENGTH) {
      return {
        ok: false,
        error: `비밀번호는 최소 ${MIN_PASSWORD_LENGTH}자리 이상 입력해 주세요.`,
      };
    }

    if (existing && existing.isOnboarded) {
      return { ok: false, error: "이미 가입된 아이디입니다." };
    }

    const hashedPassword = hashPassword(inputPassword);
    const profile: UserProfile = {
      userId: cleanId,
      provider: params.provider || "local",
      email: "",
      nickname: params.nickname?.trim() || cleanId,
      password: hashedPassword,
      preferredTranslation: params.preferredTranslation || "krv",
      isOnboarded: true,
      createdAt: new Date().toISOString(),
    };
    store.users[cleanId] = profile;
    writeLocalStore(store);
    await syncUserToNotion(profile);
    return { ok: true, profile: sanitizeUserProfile(profile) };
  }

  // login: 아이디 존재 여부 및 비밀번호(scrypt 해시 또는 기존 평문) 일치 여부 엄격 검증
  if (!existing || !existing.isOnboarded) {
    return {
      ok: false,
      error: "존재하지 않는 아이디입니다. 먼저 회원가입을 진행해 주세요.",
    };
  }

  const verification = verifyPassword(inputPassword, existing.password);
  if (!verification.valid) {
    return { ok: false, error: "아이디 또는 비밀번호가 일치하지 않습니다." };
  }

  // 기존 평문 비밀번호 계정인 경우 로그인 시 자동으로 scrypt 단방향 해시로 업그레이드
  if (verification.needsRehash) {
    existing.password = hashPassword(inputPassword);
    store.users[cleanId] = existing;
    writeLocalStore(store);
    await syncUserToNotion(existing);
  }

  if (!existing.preferredTranslation) {
    existing.preferredTranslation = "krv";
  }
  return { ok: true, profile: sanitizeUserProfile(existing) };
}

export async function updateUserProfileSettings(params: {
  userId: string;
  nickname?: string;
  currentPassword?: string;
  newPassword?: string;
  preferredTranslation?: BibleTranslation;
}): Promise<{ ok: boolean; error?: string; profile?: UserProfile }> {
  const store = readLocalStore();
  let existing: UserProfile | null = await fetchUserFromNotion(params.userId);
  if (!existing) {
    existing = store.users[params.userId] || null;
  }
  if (!existing) {
    return { ok: false, error: "회원 정보를 찾을 수 없습니다." };
  }

  if (params.newPassword !== undefined && params.newPassword.trim() !== "") {
    const trimmedNewPw = params.newPassword.trim();
    if (trimmedNewPw.length < MIN_PASSWORD_LENGTH) {
      return {
        ok: false,
        error: `새 비밀번호는 최소 ${MIN_PASSWORD_LENGTH}자리 이상 입력해 주세요.`,
      };
    }

    if (existing.password) {
      const currentPw = (params.currentPassword || "").trim();
      if (!currentPw) {
        return {
          ok: false,
          error: "비밀번호를 변경하려면 현재 비밀번호를 입력해 주세요.",
        };
      }
      const pwCheck = verifyPassword(currentPw, existing.password);
      if (!pwCheck.valid) {
        return { ok: false, error: "현재 비밀번호가 일치하지 않습니다." };
      }
    }

    existing.password = hashPassword(trimmedNewPw);
  }

  if (params.nickname && params.nickname.trim()) {
    existing.nickname = params.nickname.trim();
  }

  if (params.preferredTranslation) {
    existing.preferredTranslation = params.preferredTranslation;
  }

  existing.isOnboarded = true;
  store.users[params.userId] = existing;
  writeLocalStore(store);

  await syncUserToNotion(existing);

  return { ok: true, profile: sanitizeUserProfile(existing) };
}

async function syncUserToNotion(user: UserProfile): Promise<void> {
  if (!isNotionConfigured() || !process.env.NOTION_USERS_DB_ID) return;
  try {
    const notion = getNotionClient();
    const dbId = process.env.NOTION_USERS_DB_ID;
    const query = await notion.databases.query({
      database_id: dbId,
      filter: {
        property: "UserId",
        title: { equals: user.userId },
      },
      page_size: 1,
    });

    const properties: any = {
      UserId: { title: [{ text: { content: user.userId } }] },
      Password: { rich_text: [{ text: { content: user.password || "" } }] },
      Nickname: { rich_text: [{ text: { content: user.nickname } }] },
      PreferredTranslation: {
        rich_text: [{ text: { content: user.preferredTranslation || "krv" } }],
      },
      Provider: { rich_text: [{ text: { content: user.provider } }] },
      Email: {
        rich_text: [
          {
            text: {
              content: encodeUserMetadataToEmailField(user),
            },
          },
        ],
      },
      IsOnboarded: { checkbox: true },
    };

    if (query.results.length > 0) {
      await notion.pages.update({
        page_id: query.results[0].id,
        properties,
      });
    } else {
      await notion.pages.create({
        parent: { database_id: dbId },
        properties,
      });
    }
  } catch (err) {
    console.warn("[Notion] syncUserToNotion error:", err);
  }
}
