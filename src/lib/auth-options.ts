import type { NextAuthOptions } from "next-auth";
import KakaoProvider from "next-auth/providers/kakao";
import NaverProvider from "next-auth/providers/naver";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { getOrCreateUserProfile } from "./notion";

export const authOptions: NextAuthOptions = {
  providers: [
    // 1. 카카오 로그인
    KakaoProvider({
      clientId: process.env.KAKAO_CLIENT_ID || "kakao_placeholder_id",
      clientSecret:
        process.env.KAKAO_CLIENT_SECRET || "kakao_placeholder_secret",
    }),
    // 2. 네이버 로그인
    NaverProvider({
      clientId: process.env.NAVER_CLIENT_ID || "naver_placeholder_id",
      clientSecret:
        process.env.NAVER_CLIENT_SECRET || "naver_placeholder_secret",
    }),
    // 3. 구글 로그인
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "google_placeholder_id",
      clientSecret:
        process.env.GOOGLE_CLIENT_SECRET || "google_placeholder_secret",
    }),
    // 4. OAuth 키 발급 전 로컬/데모 환경에서도 즉시 로그인 흐름을 테스트할 수 있는 간편 로그인
    CredentialsProvider({
      id: "quick-login",
      name: "간편 테스트 로그인",
      credentials: {
        provider: { label: "Provider", type: "text" },
        nickname: { label: "Nickname", type: "text" },
      },
      async authorize(credentials) {
        const provider = (credentials?.provider || "kakao") as
          | "kakao"
          | "naver"
          | "google";
        const nickname = credentials?.nickname?.trim() || "";
        const id = `${provider}_user_default`;
        return {
          id,
          name: nickname || `${provider.toUpperCase()} 사용자`,
          email: `${provider}_user@example.com`,
          image: provider,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        const provider = (account?.provider ||
          (user as any).image ||
          "kakao") as "kakao" | "naver" | "google" | "demo";
        const userId = `${provider}_${user.id || user.email || "user"}`;
        const profile = await getOrCreateUserProfile({
          userId,
          provider,
          email: user.email || "",
          defaultName: user.name || "묵상하는 성도",
        });

        token.userId = profile.userId;
        token.provider = profile.provider;
        token.nickname = profile.nickname;
        token.isOnboarded = profile.isOnboarded;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).userId = token.userId;
        (session.user as any).provider = token.provider;
        (session.user as any).nickname = token.nickname;
        (session.user as any).isOnboarded = token.isOnboarded;
      }
      return session;
    },
  },
  secret:
    process.env.NEXTAUTH_SECRET || "daily-bible-qt-default-development-secret",
};
