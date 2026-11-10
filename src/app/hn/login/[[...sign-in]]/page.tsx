import Link from "next/link";
import { SignIn } from "@clerk/nextjs";
import { ArrowLeft, BookOpen, Layers, RefreshCw, KeyRound } from "lucide-react";
import { redirect } from "next/navigation";
import { accountId } from "@/lib/account-session";
import { clerkConfigured, safeReturnTo } from "@/lib/auth-policy";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "เข้าสู่ระบบ",
  robots: { index: false, follow: false },
};
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const params = await searchParams;
  const target = safeReturnTo(params.returnTo);
  if (await accountId()) redirect(target);
  return (
    <main className="login-page login-split">
      <Link href={target} className="login-back">
        <ArrowLeft />
        เรียนต่อแบบผู้เยี่ยมชม
      </Link>
      <div className="login-split-layout">
      <section className="login-card clerk-login-card">
        <Link href="/" className="brand">
          <span className="brand-icon">
            <BookOpen />
          </span>
          <span>
            kotoba<span className="brand-dot">.</span>
            <small>เรียนญี่ปุ่น ทีละนิด ทุกวัน</small>
          </span>
        </Link>
        {clerkConfigured() ? (
          <SignIn
            routing="path"
            path="/hn/login"
            signUpUrl="/hn/register"
            forceRedirectUrl={target}
          />
        ) : (
          <div className="login-message" role="status">
            ระบบบัญชียังไม่ได้ตั้งค่า Clerk
            แต่คุณสามารถเรียนแบบผู้เยี่ยมชมได้ทันที
          </div>
        )}
        <Link className="text-link guest-continue" href={target}>
          เรียนต่อโดยไม่เข้าสู่ระบบ
        </Link>
      </section>
      <aside className="login-info" aria-labelledby="login-info-title">
        <span className="login-info-kana" lang="ja">ことば</span>
        <p className="login-info-caption">ทีละคำ ทีละวัน</p>
        <h2 id="login-info-title">พื้นที่เล็ก ๆ<br />สำหรับภาษาญี่ปุ่นของคุณ</h2>
        <p className="login-info-intro">กลับมาเรียนต่อในจังหวะของคุณ ตั้งแต่คำศัพท์แรก ไปจนถึงบทสนทนาในชีวิตประจำวัน</p>
        <div className="login-info-features">
          <div><Layers /><div><h3>ฝึกได้หลายแบบ</h3><p>คำศัพท์ ไวยากรณ์ คันจิ แฟลชการ์ด และบทสนทนา ตั้งแต่ N5 ถึง N1</p></div></div>
          <div><RefreshCw /><div><h3>เรียนต่อข้ามอุปกรณ์</h3><p>เข้าสู่ระบบเพื่อเก็บความก้าวหน้าไว้กับบัญชีของคุณ</p></div></div>
          <div><KeyRound /><div><h3>เชื่อมต่อข้อมูลของคุณ</h3><p>จัดการ API key และเรียกใช้ข้อมูลการเรียนผ่าน API ส่วนตัว</p></div></div>
        </div>
        <p className="login-info-note">ยังไม่พร้อมสมัคร? เรียนแบบผู้เยี่ยมชมได้เสมอ</p>
      </aside>
      </div>
    </main>
  );
}
