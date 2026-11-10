"use client";
import { createContext, useContext, type ReactNode } from "react";
import { useAuth, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogIn } from "lucide-react";
type LearnerSession = {
  ready: boolean;
  configured: boolean;
  userId: string | null;
};
export const LearnerSessionContext = createContext<LearnerSession>({
  ready: true,
  configured: false,
  userId: null,
});
export function useLearnerSession() {
  return useContext(LearnerSessionContext);
}
export function ClerkLearnerSession({ children }: { children: ReactNode }) {
  const { isLoaded, userId } = useAuth();
  return (
    <LearnerSessionContext.Provider
      value={{ ready: isLoaded, configured: true, userId: userId ?? null }}
    >
      {children}
    </LearnerSessionContext.Provider>
  );
}
export function AccountControls({ compact = false }: { compact?: boolean }) {
  const session = useLearnerSession(),
    pathname = usePathname();
  if (!session.ready)
    return (
      <span className="account-caption" role="status">
        กำลังโหลดบัญชี
      </span>
    );
  if (session.userId)
    return (
      <div className={`account-controls ${compact ? "compact" : ""}`}>
        <UserButton />
        {!compact && <span>บัญชีของฉัน</span>}
      </div>
    );
  return (
    <Link
      href={`/hn/login?returnTo=${encodeURIComponent(pathname)}`}
      className={compact ? "account-sign-in" : "nav-item"}
    >
      <LogIn />
      <span>เข้าสู่ระบบ</span>
    </Link>
  );
}
