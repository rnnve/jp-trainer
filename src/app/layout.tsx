import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import PwaClient from "@/components/pwa-client";
import { ClerkLearnerSession } from "@/components/account-session";
import { clerkConfigured } from "@/lib/auth-policy";
export const metadata: Metadata = {
  title: {
    default: "Kotoba — เรียนญี่ปุ่น ทีละนิด ทุกวัน",
    template: "%s · Kotoba",
  },
  description:
    "เรียนภาษาญี่ปุ่นได้ทั้งแบบผู้เยี่ยมชมและบัญชีส่วนตัว พร้อมคำศัพท์ ไวยากรณ์ คันจิ และแฟลชการ์ด",
  applicationName: "Kotoba",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Kotoba" },
  icons: { icon: "/icon.svg", apple: "/icons/icon-192.png" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#090909",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  const content = (
    <html lang="th">
      <body>
        <PwaClient />
        {clerkConfigured() ? (
          <ClerkLearnerSession>{children}</ClerkLearnerSession>
        ) : (
          children
        )}
      </body>
    </html>
  );
  return clerkConfigured() ? (
    <ClerkProvider
      signInUrl="/hn/login"
      signUpUrl="/hn/register"
      signInFallbackRedirectUrl="/hn/learn"
      signUpFallbackRedirectUrl="/hn/learn"
      afterSignOutUrl="/hn/learn"
      appearance={{
        variables: {
          colorPrimary: "#f4f4f5",
          colorBackground: "#121212",
          colorForeground: "#f4f4f5",
          colorMutedForeground: "#a1a1aa",
          colorInput: "#1c1c1f",
          colorInputForeground: "#f4f4f5",
          colorNeutral: "#f4f4f5",
          fontFamily: "var(--font-ui)",
          borderRadius: "12px",
        },
      }}
    >
      {content}
    </ClerkProvider>
  ) : (
    content
  );
}
