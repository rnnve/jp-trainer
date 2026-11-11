import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";
import { AccountControls } from "./account-session";
import {
  categoryNames,
  contentStats,
  lessons,
  levels,
  type Category,
} from "@/lib/content";
export default function PublicStatistics() {
  const catalog = contentStats(),
    word = lessons.find((lesson) => lesson.id === "N5-k2")!;
  return (
    <div className="public-site">
      <header className="public-header">
        <Link href="/" className="brand" aria-label="Kotoba หน้าสถิติ">
          <span className="brand-icon">
            <BookOpen />
          </span>
          <span>
            kotoba<span className="brand-dot">.</span>
            <small>เรียนญี่ปุ่น ทีละนิด ทุกวัน</small>
          </span>
        </Link>
        <div className="public-header-actions">
          <Link href="/about" className="account-sign-in">
            เกี่ยวกับ
          </Link>
          <AccountControls compact />
          <Link href="/hn/learn" className="owner-link">
            เริ่มเรียน
            <ArrowRight />
          </Link>
        </div>
      </header>
      <main className="public-main" id="main">
        <section className="public-hero">
          <div className="public-hero-copy">
            <div className="eyebrow">ことば / เรียนภาษาญี่ปุ่น</div>
            <h1>
              เรียนญี่ปุ่น
              <br />
              ในจังหวะของคุณ
            </h1>
            <p>
              คำศัพท์ ไวยากรณ์ คันจิ และบทสนทนา
              <br />
              ทุกคนเรียนได้ทั้งแบบผู้เยี่ยมชมและบัญชีส่วนตัว
            </p>
            <Link className="text-link public-view-badge" href="/hn/learn">
              เรียนได้โดยไม่ต้องสมัคร <ArrowRight />
            </Link>
          </div>
          <div className="public-word" aria-label="ตัวอย่างคันจิจากคลังบทเรียน">
            <span className="word-caption">จากคลังบทเรียน · {word.level}</span>
            <span className="public-word-kanji" lang="ja">
              {word.japanese}
            </span>
            <div className="word-definition">
              <span lang="ja">{word.reading}</span>
              <strong>{word.meaning}</strong>
            </div>
          </div>
        </section>
        <div className="public-section-title">
          <div>
            <h2>ภาพรวมคลังบทเรียน</h2>
            <p>
              ข้อมูลเนื้อหาที่พร้อมให้ทุกคนเรียน · ไม่แสดงความก้าวหน้าส่วนบุคคล
            </p>
          </div>
        </div>
        <div className="stats-four">
          {[
            { value: catalog.total, label: "บทเรียนในคลัง", unit: "บท" },
            { value: levels.length, label: "ระดับ N5–N1", unit: "ระดับ" },
            {
              value: Object.keys(categoryNames).length,
              label: "ประเภทการเรียน",
              unit: "ประเภท",
            },
            { value: catalog.books, label: "หนังสืออ้างอิง", unit: "เล่ม" },
          ].map((metric) => (
            <div className="stat-tile" key={metric.label}>
              <span>{metric.label}</span>
              <strong>
                {metric.value}
                <small>{metric.unit}</small>
              </strong>
            </div>
          ))}
        </div>
        <div className="stats-columns public-learning-charts">
          <section className="panel level-overview">
            <div className="section-heading">
              <div>
                <h2>เนื้อหาในแต่ละระดับ</h2>
                <p>จำนวนบทเรียนต้นฉบับของโครงการ</p>
              </div>
            </div>
            <div className="bar-chart">
              {levels.map((level) => (
                <div className="bar-row" key={level}>
                  <span>{level}</span>
                  <div aria-hidden="true">
                    <span
                      style={{
                        transform: `scaleX(${catalog.byLevel[level] / Math.max(...Object.values(catalog.byLevel))})`,
                      }}
                    />
                  </div>
                  <strong>
                    {catalog.byLevel[level]}
                    <small> บท</small>
                  </strong>
                </div>
              ))}
            </div>
            <div className="chart-legend">
              ชุดเริ่มต้น ยังไม่ครอบคลุมหลักสูตร JLPT ทั้งหมด
            </div>
          </section>
          <section className="panel learning-modes">
            <div className="section-heading">
              <div>
                <h2>เลือกวิธีเก็บความก้าวหน้า</h2>
                <p>เนื้อหาและแบบฝึกหัดชุดเดียวกันสำหรับทุกคน</p>
              </div>
            </div>
            <div>
              <h3>เรียนแบบผู้เยี่ยมชม</h3>
              <p>
                เปิดเรียนได้ทันที ความก้าวหน้าบันทึกในเบราว์เซอร์นี้
                และส่งออกเป็นไฟล์ได้
              </p>
              <Link className="text-link" href="/hn/learn">
                เริ่มเรียนโดยไม่เข้าสู่ระบบ
                <ArrowRight />
              </Link>
            </div>
            <div>
              <h3>เรียนด้วยบัญชี</h3>
              <p>
                ใช้ Clerk เข้าสู่ระบบเพื่อเก็บความก้าวหน้าข้ามอุปกรณ์
                และเรียกข้อมูลส่วนตัวผ่าน API
              </p>
              <Link className="text-link" href="/hn/login">
                เข้าสู่ระบบหรือสร้างบัญชี
                <ArrowRight />
              </Link>
            </div>
          </section>
        </div>
        <section className="public-catalog panel">
          <div className="section-heading">
            <div>
              <h2>เนื้อหาที่เรียนได้</h2>
              <p>เนื้อหาต้นฉบับ {lessons.length} บทเรียน · N5–N1</p>
            </div>
            <span className="catalog-caption">ชุดเริ่มต้น</span>
          </div>
          <div className="public-categories">
            {(Object.keys(categoryNames) as Category[]).map((category) => (
              <div key={category}>
                <span>{categoryNames[category]}</span>
                <strong>
                  {catalog.byCategory[category]}
                  <small> บท</small>
                </strong>
              </div>
            ))}
          </div>
          <p className="support-note">
            ระดับเป็นแนวทางของโครงการ ไม่ใช่รายการ JLPT ทางการ
            <br />
            หนังสืออ้างอิง: มินนะ โนะ นิฮงโกะ 1 และอะกิโกะโตะโทะโมะดะจิ 1
          </p>
        </section>
        <div className="bottom-note">
          <span lang="ja">少しずつ、毎日。</span>
          <span>ทีละนิด ในทุกวัน</span>
        </div>
        <footer className="page-footer">
          <span>
            kotoba. <span>เรียนได้ทุกคน · โค้ดเปิดเผย</span>
          </span>
          <span>ข้อมูลบัญชีเป็นส่วนตัว</span>
          <Link href="/hn/api">
            Developer API
            <ArrowRight />
          </Link>
        </footer>
      </main>
    </div>
  );
}
