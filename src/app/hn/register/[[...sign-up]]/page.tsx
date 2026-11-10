import Link from "next/link";
import { SignUp } from "@clerk/nextjs";
import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { accountId } from "@/lib/account-session";
import { clerkConfigured } from "@/lib/auth-policy";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "สร้างบัญชี",
  robots: { index: false, follow: false },
};
export default async function Register() {
  if (await accountId()) redirect("/hn/learn");
  return (
    <main className="login-page">
      <Link href="/hn/learn" className="login-back">
        <ArrowLeft />
        เรียนต่อแบบผู้เยี่ยมชม
      </Link>
      <section className="login-card clerk-login-card">
        <div className="eyebrow">アカウント / บัญชีผู้เรียน</div>
        <h1>สร้างบัญชีผู้เรียน</h1>
        <p>บัญชีของคุณเก็บความก้าวหน้าไว้ให้เรียกใช้ข้ามอุปกรณ์และผ่าน API</p>
        {clerkConfigured() ? (
          <SignUp
            routing="path"
            path="/hn/register"
            signInUrl="/hn/login"
            forceRedirectUrl="/hn/learn"
          />
        ) : (
          <div className="login-message" role="status">
            ระบบบัญชียังไม่ได้ตั้งค่า Clerk คุณยังเรียนแบบผู้เยี่ยมชมได้
          </div>
        )}
        <Link className="text-link guest-continue" href="/hn/learn">
          เรียนต่อโดยไม่สร้างบัญชี
        </Link>
      </section>
    </main>
  );
}
