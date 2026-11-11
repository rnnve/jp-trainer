import Link from "next/link";
import { BookOpen, Code2, Heart } from "lucide-react";

export const metadata = { title: "เกี่ยวกับ Kotoba" };

export default function AboutPage() {
  return (
    <main className="about-page">
      <Link className="about-brand" href="/hn/learn">
        <BookOpen size={25} /> kotoba.
      </Link>
      <section className="about-card">
        <span className="about-kana" lang="ja">ことば</span>
        <h1>สมุดฝึกภาษาญี่ปุ่นทีละนิด ทุกวัน</h1>
        <p>
          Kotoba คือพื้นที่ฝึกภาษาญี่ปุ่นที่ให้เลือกชุดคำศัพท์ ฝึกแปล
          ทบทวนแฟลชการ์ด และติดตามความก้าวหน้าได้ในที่เดียว
        </p>
        <div className="about-divider" />
        <h2>ผู้สร้าง</h2>
        <p>
          สร้างโดย <strong>rnnve</strong> ร่วมกับ ChatGPT Codex
          เพื่อให้การฝึกภาษาญี่ปุ่นเริ่มต้นได้ง่ายและยืดหยุ่น
        </p>
        <div className="about-actions">
          <Link href="/hn/learn">เริ่มฝึกคำศัพท์</Link>
          <a href="https://github.com/rnnve/jp-trainer" target="_blank" rel="noreferrer">
            <Code2 size={17} /> ดูโค้ดบน GitHub
          </a>
        </div>
        <small><Heart size={14} /> เรียนได้ทุกคน ทั้งแบบผู้เยี่ยมชมและบัญชี</small>
      </section>
    </main>
  );
}
