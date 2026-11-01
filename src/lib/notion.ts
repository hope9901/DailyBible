import { Client } from "@notionhq/client";
import fs from "fs";
import path from "path";
import { DailyWordData, crawlDurannoQt } from "./crawler";

export interface UserProfile {
  userId: string;
  provider: "kakao" | "naver" | "google" | "demo";
  email: string;
  nickname: string;
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
    // Vercel 서버리스 환경 등 읽기 전용 파일시스템일 경우 무시
    console.warn("[LocalStore] Write skipped:", err);
  }
}

/**
 * 1. 일일 말씀(Daily_Word) 조회 및 저장 (Notion DB 연동 + 자동 크롤링 폴백)
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
          return JSON.parse(rawJson) as DailyWordData;
        }
      }
    } catch (err) {
      console.warn("[Notion] getDailyWord query fallback:", err);
    }
  }

  // 로컬 캐시 확인
  const store = readLocalStore();
  if (store.dailyWords[date]) {
    return store.dailyWords[date];
  }

  // 아직 저장된 말씀이 없으면 실시간 크롤링 후 저장
  const crawled = await crawlDurannoQt(date);
  await saveDailyWord(crawled);
  return crawled;
}

export async function saveDailyWord(word: DailyWordData): Promise<void> {
  // 로컬 저장소에 항상 백업
  const store = readLocalStore();
  store.dailyWords[word.date] = word;
  writeLocalStore(store);

  if (!isNotionConfigured()) return;

  try {
    const notion = getNotionClient();
    const dbId = process.env.NOTION_DAILY_WORD_DB_ID!;

    // 이미 해당 날짜 레코드가 있는지 확인
    const existing = await notion.databases.query({
      database_id: dbId,
      filter: {
        property: "Date",
        rich_text: { equals: word.date },
      },
      page_size: 1,
    });

    const contentJsonStr = JSON.stringify(word).slice(0, 1990);

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
        rich_text: [{ text: { content: contentJsonStr } }],
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
 * 3. 사용자 프로필(닉네임) 조회 및 저장
 */
export async function getOrCreateUserProfile(params: {
  userId: string;
  provider: "kakao" | "naver" | "google" | "demo";
  email: string;
  defaultName: string;
}): Promise<UserProfile> {
  const store = readLocalStore();
  if (store.users[params.userId]) {
    return store.users[params.userId];
  }

  if (isNotionConfigured() && process.env.NOTION_USERS_DB_ID) {
    try {
      const notion = getNotionClient();
      const dbId = process.env.NOTION_USERS_DB_ID;
      const existing = await notion.databases.query({
        database_id: dbId,
        filter: {
          property: "UserId",
          title: { equals: params.userId },
        },
        page_size: 1,
      });

      if (existing.results.length > 0) {
        const page: any = existing.results[0];
        const props = page.properties;
        const getText = (prop: any) =>
          prop?.rich_text?.map((t: any) => t.plain_text).join("") || "";
        const profile: UserProfile = {
          userId: params.userId,
          provider: (getText(props.Provider) as any) || params.provider,
          email: getText(props.Email) || params.email,
          nickname: getText(props.Nickname) || params.defaultName,
          isOnboarded: Boolean(props.IsOnboarded?.checkbox),
          createdAt: page.created_time,
        };
        store.users[params.userId] = profile;
        writeLocalStore(store);
        return profile;
      }
    } catch (err) {
      console.warn("[Notion] getOrCreateUserProfile fallback:", err);
    }
  }

  const newProfile: UserProfile = {
    userId: params.userId,
    provider: params.provider,
    email: params.email,
    nickname: params.defaultName,
    isOnboarded: false,
    createdAt: new Date().toISOString(),
  };

  store.users[params.userId] = newProfile;
  writeLocalStore(store);
  return newProfile;
}

export async function updateUserNickname(
  userId: string,
  nickname: string
): Promise<UserProfile> {
  const store = readLocalStore();
  const existing = store.users[userId] || {
    userId,
    provider: "demo",
    email: "",
    nickname,
    isOnboarded: true,
    createdAt: new Date().toISOString(),
  };

  existing.nickname = nickname.trim();
  existing.isOnboarded = true;
  store.users[userId] = existing;
  writeLocalStore(store);

  if (isNotionConfigured() && process.env.NOTION_USERS_DB_ID) {
    try {
      const notion = getNotionClient();
      const dbId = process.env.NOTION_USERS_DB_ID;
      const query = await notion.databases.query({
        database_id: dbId,
        filter: {
          property: "UserId",
          title: { equals: userId },
        },
        page_size: 1,
      });

      const properties: any = {
        UserId: { title: [{ text: { content: userId } }] },
        Provider: { rich_text: [{ text: { content: existing.provider } }] },
        Email: { rich_text: [{ text: { content: existing.email } }] },
        Nickname: { rich_text: [{ text: { content: existing.nickname } }] },
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
      console.warn("[Notion] updateUserNickname error:", err);
    }
  }

  return existing;
}
