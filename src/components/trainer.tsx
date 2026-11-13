"use client";

import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import ApiKeyManager from "@/components/api-key-manager";
import {
  AccountControls,
  useLearnerSession,
} from "@/components/account-session";
import { useLearnerProgress } from "@/hooks/use-learner-progress";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Bookmark,
  Check,
  ChevronDown,
  ChevronRight,
  Code2,
  Download,
  Flame,
  GraduationCap,
  Headphones,
  Layers,
  Leaf,
  Menu,
  MessageCircle,
  Play,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  Target,
  TrendingUp,
  Volume2,
  WifiOff,
  X,
  ChartNoAxesCombined,
  CheckCircle2,
  Upload,
  ExternalLink,
  Clock,
  Keyboard,
  Library,
} from "lucide-react";
import {
  books,
  categoryNames,
  contentStats,
  lessons,
  levels,
  practiceBooks,
  type Category,
  type Lesson,
  type Level,
  type PracticeWord,
} from "@/lib/content";
import {
  localDate,
  parseProgress,
  scheduleReview,
  streak,
  type Progress,
} from "@/lib/progress";


function Action({
  children,
  onClick,
  variant = "filled",
  disabled = false,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "filled" | "tonal" | "outlined" | "text";
  disabled?: boolean;
  className?: string;
}) {
  const variants = { filled: "default", tonal: "secondary", outlined: "outline", text: "ghost" } as const;
  return <Button type="button" disabled={disabled} onClick={onClick} variant={variants[variant]} className={`min-h-11 gap-2 px-4 ${className}`}>{children}</Button>;
}
const nav = [
  { path: "learn", label: "พื้นที่เรียน", icon: GraduationCap },
  { path: "library", label: "คลังบทเรียน", icon: BookOpen },
  { path: "flashcards", label: "แฟลชการ์ด", icon: Layers },
  { path: "practice", label: "แบบฝึกหัด", icon: Keyboard },
  { path: "conversations", label: "ฝึกฟังและสนทนา", icon: Headphones },
  { path: "statistics", label: "สถิติของฉัน", icon: ChartNoAxesCombined },
];
const titles: Record<string, string> = {
  learn: "พื้นที่เรียน",
  library: "คลังบทเรียน",
  flashcards: "แฟลชการ์ด",
  practice: "แบบฝึกหัด",
  conversations: "ฝึกฟังและสนทนา",
  statistics: "สถิติการเรียนของฉัน",
  books: "หนังสืออ้างอิง",
  settings: "ตั้งค่าการเรียน",
  api: "Developer API",
};
const categoryIcons = {
  vocabulary: MessageCircle,
  grammar: BookOpen,
  kanji: GraduationCap,
  conversation: Headphones,
};
function download(name: string, data: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
function shuffle<T>(items: T[], seedText: string) {
  let seed = [...seedText].reduce(
    (value, character) => (value * 31 + character.charCodeAt(0)) >>> 0,
    2166136261,
  );
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const swapIndex = seed % (index + 1);
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

export default function Trainer({ section }: { section: string }) {
  const router = useRouter();
  function navigate(path: string) {
    if (!navigator.onLine) {
      window.location.assign(path);
      return;
    }
    router.push(path);
  }

  const session = useLearnerSession();
  const {
    progress,
    setProgress,
    loaded,
    storageError,
    syncPhase,
    retrySync,
    loadAccountCopy,
    importGuest,
  } = useLearnerProgress();
  const [menu, setMenu] = useState(false),
    [query, setQuery] = useState(""),
    [category, setCategory] = useState<Category | "all">("all"),
    [savedOnly, setSavedOnly] = useState(false),
    [active, setActive] = useState<Lesson | null>(null),
    [toast, setToast] = useState(""),
    [offline, setOffline] = useState(false),
    [install, setInstall] = useState<InstallPrompt | null>(null);
  const [flashIndex, setFlashIndex] = useState(0),
    [flipped, setFlipped] = useState(false),
    [reviewed, setReviewed] = useState<string[]>([]),
    [allCards, setAllCards] = useState(false);
  const [furigana, setFurigana] = useState(false);
  useEffect(() => {
    try {
      setFurigana(localStorage.getItem("kotoba.furigana.v1") === "true");
    } catch {
      // Keep the default when browser storage is unavailable.
    }
  }, []);
  function updateFurigana(enabled: boolean) {
    setFurigana(enabled);
    try {
      localStorage.setItem("kotoba.furigana.v1", String(enabled));
    } catch {
      // The setting still applies to the current screen.
    }
  }
  const [practiceBook, setPracticeBook] = useState(practiceBooks[0].id),
    [selectedPracticeUnits, setSelectedPracticeUnits] = useState<string[]>(
      practiceBooks[0].units.map((unit) => unit.id),
    ),
    [practiceDirection, setPracticeDirection] = useState<
      "thai-to-japanese" | "japanese-to-thai"
    >("thai-to-japanese"),
    [practiceIndex, setPracticeIndex] = useState(0),
    [practiceShuffleSeed, setPracticeShuffleSeed] = useState(0),
    [practiceAnswer, setPracticeAnswer] = useState(""),
    [practiceChecked, setPracticeChecked] = useState(false),
    [practiceCorrect, setPracticeCorrect] = useState(0),
    [practiceDone, setPracticeDone] = useState(false);
  const [openJlptKanji, setOpenJlptKanji] = useState<PracticeWord[]>([]),
    [openJlptKanjiLoading, setOpenJlptKanjiLoading] = useState(false);
  const [speaking, setSpeaking] = useState(false),
    [audioMessage, setAudioMessage] = useState("");
  const dialog = useRef<HTMLDialogElement>(null),
    fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onOnline = () => setOffline(!navigator.onLine);
    onOnline();
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOnline);
    const prompt = (e: Event) => {
      e.preventDefault();
      setInstall(e as InstallPrompt);
    };
    window.addEventListener("beforeinstallprompt", prompt);
    const offlineNavigation = (e: MouseEvent) => {
      if (
        navigator.onLine ||
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      )
        return;
      const anchor = (e.target as Element).closest("a");
      if (
        anchor &&
        anchor.origin === location.origin &&
        !anchor.target &&
        !anchor.hasAttribute("download") &&
        !anchor.hash
      ) {
        e.preventDefault();
        e.stopPropagation();
        location.assign(anchor.href);
      }
    };
    document.addEventListener("click", offlineNavigation, true);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOnline);
      window.removeEventListener("beforeinstallprompt", prompt);
      document.removeEventListener("click", offlineNavigation, true);
      window.speechSynthesis?.cancel();
    };
  }, []);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setQuery(p.get("q") ?? "");
    const c = p.get("category");
    setCategory(c && Object.hasOwn(categoryNames, c) ? (c as Category) : "all");
    setMenu(false);
  }, [section]);
  useEffect(() => {
    if (!menu) return;
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [menu]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 4200);
    return () => clearTimeout(id);
  }, [toast]);
  useEffect(() => {
    setMenu(false);
    setActive(null);
    setReviewed([]);
    setFlashIndex(0);
    setFlipped(false);
    resetTranslationPractice();
    setSpeaking(false);
    window.speechSynthesis?.cancel();
  }, [session.userId]);
  useEffect(() => {
    if (active) {
      dialog.current?.showModal();
    } else dialog.current?.close();
  }, [active]);
  const level = progress.level,
    today = localDate(),
    todayCount = progress.activity.filter((a) => a.date === today).length;
  const levelLessons = lessons.filter((l) => l.level === level);
  const due = levelLessons.filter(
    (l) =>
      l.category !== "conversation" &&
      (!progress.reviews[l.id] || progress.reviews[l.id].due <= Date.now()),
  );
  const cards = (
    allCards ? levelLessons.filter((l) => l.category !== "conversation") : due
  ).filter((l) => !reviewed.includes(l.id));
  const card = cards[flashIndex % Math.max(1, cards.length)];
  const learned = levelLessons.filter((l) =>
    progress.completed.includes(l.id),
  ).length;
  const nextLesson =
    levelLessons.find((l) => !progress.completed.includes(l.id)) ??
    levelLessons[0];
  const activePracticeBook =
    practiceBooks.find((book) => book.id === practiceBook) ?? practiceBooks[0];
  const selectedPracticeWords = activePracticeBook.units
    .filter((unit) => selectedPracticeUnits.includes(unit.id))
    .flatMap((unit) => unit.words);
  const openJlptSelectedLevels = activePracticeBook.units
    .filter((unit) => selectedPracticeUnits.includes(unit.id))
    .map((unit) => unit.lesson)
    .filter((lesson): lesson is Level => typeof lesson === "string");
  const allPracticeWords =
    practiceBook === "jlpt-kanji" ? openJlptKanji : activePracticeBook.units.flatMap((unit) => unit.words);
  const practiceQuestions =
    practiceBook === "jlpt-kanji" ? openJlptKanji : selectedPracticeWords;
  const practiceQuestion = practiceQuestions[practiceIndex];
  const practiceOptions = practiceQuestion
    ? (() => {
        const correctOption =
          practiceDirection === "thai-to-japanese"
            ? practiceQuestion.japanese
            : practiceQuestion.meaning;
        const distractors = [...new Set(
          allPracticeWords
            .map((word) =>
              practiceDirection === "thai-to-japanese"
                ? word.japanese
                : word.meaning,
            )
            .filter((option) => option !== correctOption),
        )];
        const seed = `${practiceQuestion.id}-${practiceShuffleSeed}`;
        return shuffle(
          [
            correctOption,
            ...shuffle(distractors, `${seed}-distractors`).slice(0, 3),
          ],
          seed,
        );
      })()
    : [];
  const filtered = levelLessons.filter(
    (l) =>
      (category === "all" || l.category === category) &&
      (!savedOnly || progress.saved.includes(l.id)) &&
      `${l.japanese} ${l.reading} ${l.meaning}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  useEffect(() => {
    if (practiceBook !== "jlpt-kanji") {
      setOpenJlptKanji([]);
      setOpenJlptKanjiLoading(false);
      return;
    }
    if (!openJlptSelectedLevels.length) {
      setOpenJlptKanji([]);
      return;
    }
    const controller = new AbortController();
    setOpenJlptKanjiLoading(true);
    fetch(`/api/v1/jlpt-kanji?levels=${openJlptSelectedLevels.join(",")}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw Error();
        return (await response.json()) as { data: PracticeWord[] };
      })
      .then((response) => setOpenJlptKanji(response.data))
      .catch(() => {
        if (!controller.signal.aborted) {
          setOpenJlptKanji([]);
          notify("ไม่สามารถโหลดชุดคันจิ OpenJLPT ได้");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setOpenJlptKanjiLoading(false);
      });
    return () => controller.abort();
  }, [practiceBook, selectedPracticeUnits]);
  function notify(message: string) {
    setToast(message);
  }
  function changeLevel(value: Level) {
    setProgress((p) => ({ ...p, level: value }));
    setFlashIndex(0);
    setReviewed([]);
    setFlipped(false);
    resetTranslationPractice();
  }
  function resetTranslationPractice() {
    setPracticeIndex(0);
    setPracticeAnswer("");
    setPracticeChecked(false);
    setPracticeCorrect(0);
    setPracticeDone(false);
    setPracticeShuffleSeed((seed) => seed + 1);
  }
  function save(id: string) {
    setProgress((p) => ({
      ...p,
      saved: p.saved.includes(id)
        ? p.saved.filter((x) => x !== id)
        : [...p.saved, id],
    }));
  }
  function complete(l: Lesson) {
    setProgress((p) => ({
      ...p,
      completed: [...new Set([...p.completed, l.id])],
      activity: [
        ...p.activity,
        { date: localDate(), kind: "lesson", id: l.id },
      ],
    }));
    setActive(null);
    notify("บันทึกบทเรียนแล้ว");
  }
  function review(remembered: boolean) {
    if (!card) return;
    setProgress((p) => ({
      ...p,
      reviews: {
        ...p.reviews,
        [card.id]: scheduleReview(p.reviews[card.id], remembered),
      },
      activity: [
        ...p.activity,
        { date: localDate(), kind: "review", id: card.id, correct: remembered },
      ],
    }));
    setReviewed((p) => [...p, card.id]);
    setFlipped(false);
    setFlashIndex(0);
  }
  function checkPracticeAnswer(value: string) {
    if (practiceChecked || !practiceQuestion) return;
    const expected =
      practiceDirection === "thai-to-japanese"
        ? practiceQuestion.japanese
        : practiceQuestion.meaning;
    const correct = value === expected;
    setPracticeAnswer(value);
    setPracticeChecked(true);
    if (correct) setPracticeCorrect((n) => n + 1);
    setProgress((p) => ({
      ...p,
      activity: [
        ...p.activity,
        {
          date: localDate(),
          kind: "quiz",
          id: practiceQuestion.id,
          correct,
        },
      ],
    }));
  }
  function nextPracticeQuestion() {
    if (!practiceQuestion) return;
    if (practiceIndex + 1 === practiceQuestions.length) {
      setPracticeDone(true);
      return;
    }
    setPracticeIndex((i) => i + 1);
    setPracticeAnswer("");
    setPracticeChecked(false);
    setPracticeShuffleSeed((seed) => seed + 1);
  }
  function speak(text: string) {
    if (!("speechSynthesis" in window)) {
      notify("เบราว์เซอร์นี้ไม่รองรับเสียงสังเคราะห์");
      return;
    }
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const synth = window.speechSynthesis;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ja-JP";
    utterance.rate = 0.85;
    const voice = synth.getVoices().find((v) => v.lang.startsWith("ja"));
    if (voice) utterance.voice = voice;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => {
      setSpeaking(false);
      setAudioMessage(
        "ไม่สามารถเล่นเสียงได้ กรุณาตรวจสอบเสียงภาษาญี่ปุ่นในการตั้งค่าอุปกรณ์",
      );
    };
    setAudioMessage("");
    synth.speak(utterance);
  }
  function libraryCategory(c: Category) {
    navigate(`/hn/library?category=${c}`);
  }
  async function installApp() {
    if (install) {
      await install.prompt();
      setInstall(null);
    } else
      notify(
        "ติดตั้งผ่านเมนูเบราว์เซอร์ “ติดตั้งแอป” หรือบน iOS เลือกแชร์ → เพิ่มไปยังหน้าจอโฮม",
      );
  }
  async function importProgress(file: File) {
    try {
      if (file.size > 5_000_000) throw Error("ไฟล์ต้องมีขนาดไม่เกิน 5 MB");
      const parsed = parseProgress(JSON.parse(await file.text()));
      setProgress(parsed);
      notify("นำเข้าความก้าวหน้าเรียบร้อย");
    } catch (e) {
      notify(e instanceof Error ? e.message : "ไม่สามารถนำเข้าไฟล์ได้");
    }
    if (fileInput.current) fileInput.current.value = "";
  }
  if (!loaded)
    return (
      <main className="trainer-loading" role="status">
        <h1>กำลังเตรียมพื้นที่เรียน</h1>
        <p>กำลังโหลดความก้าวหน้าของคุณ</p>
        <Link href="/">ดูคลังเนื้อหาสาธารณะ</Link>
      </main>
    );
  const app = (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        ข้ามไปเนื้อหา
      </a>
      {menu && (
        <button
          className="nav-backdrop"
          aria-label="ปิดเมนู"
          onClick={() => setMenu(false)}
        />
      )}
      <aside
        id="main-navigation"
        className={`sidebar ${menu ? "is-open" : ""}`}
        onClick={(e) => {
          if ((e.target as Element).closest("a")) setMenu(false);
        }}
      >
        <button
          type="button"
          className="icon-button sidebar-close"
          aria-label="ปิดแถบเมนู"
          onClick={() => setMenu(false)}
        >
          <X size={22} />
        </button>
        <Link
          href="/hn/learn"
          className="brand"
          aria-label="Kotoba พื้นที่เรียน"
        >
          <span className="brand-icon">
            <BookOpen size={26} />
          </span>
          <span>
            kotoba<span className="brand-dot">.</span>
            <small>ญี่ปุ่น ทีละนิด ทุกวัน</small>
          </span>
        </Link>
        <div className="workspace-label">พื้นที่เรียนภาษาญี่ปุ่น</div>
        <nav aria-label="เมนูหลัก">
          {nav.map((n) => (
            <Link
              key={n.path}
              className={`nav-item ${section === n.path ? "selected" : ""}`}
              href={`/hn/${n.path}`}
            >
              <n.icon size={21} />
              <span>{n.label}</span>
              {n.path === "flashcards" && (
                <span className="nav-count">{due.length}</span>
              )}
              {section === n.path && <span className="nav-dot" />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-divider" />
        <nav aria-label="เพิ่มเติม">
          <Link className="nav-item" href="/">
            <ChartNoAxesCombined size={21} />
            ภาพรวมคลังเนื้อหา
            <ArrowUpRight size={15} className="ml-auto" />
          </Link>
          <Link
            className={`nav-item ${section === "books" ? "selected" : ""}`}
            href="/hn/books"
          >
            <Library size={21} />
            หนังสืออ้างอิง
          </Link>
          <Link
            className={`nav-item ${section === "api" ? "selected" : ""}`}
            href="/hn/api"
          >
            <Code2 size={21} />
            Developer API
          </Link>
        </nav>
        <div className="sidebar-bottom">
          <div className="open-card">
            <span className="open-icon">
              <Leaf size={21} />
            </span>
            <strong>สมุดฝึกภาษาญี่ปุ่นของฉัน</strong>
            <p>
              ฝึกวันละนิด ตามจังหวะของฉัน
              <br />
              เรียนได้ทั้งแบบผู้เยี่ยมชมและบัญชี
            </p>
            <Link href="/">
              ดูภาพรวมคลังบทเรียน <ArrowUpRight size={14} />
            </Link>
          </div>
          <Link
            href="/hn/settings"
            className={`nav-item ${section === "settings" ? "selected" : ""}`}
          >
            <Settings size={20} />
            ตั้งค่าการเรียน
          </Link>
          <AccountControls />
          <div className="sidebar-foot">
            สมุดฝึกภาษาญี่ปุ่น <span>ことば</span>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="เปิดเมนู"
              aria-expanded={menu}
              aria-controls="main-navigation"
              type="button"
              onClick={() => setMenu((open) => !open)}
            >
              <Menu size={22} />
            </button>
            <span className="topbar-logo">kotoba.</span>
            <span className="desktop-crumb">การเรียนรู้ของฉัน</span>
            <ChevronRight size={14} />
            <strong>{titles[section]}</strong>
          </div>
          <div className="top-actions">
            <form
              className="search-box"
              onSubmit={(e) => {
                e.preventDefault();
                navigate(`/hn/library?q=${encodeURIComponent(query)}`);
              }}
            >
              <Search size={17} />
              <input
                aria-label="ค้นหาบทเรียน"
                placeholder="ค้นหาบทเรียน"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <kbd>↵</kbd>
            </form>
            <AccountControls compact />
          </div>
        </header>
        {offline && (
          <div className="notice">
            <WifiOff size={17} />
            กำลังใช้งานออฟไลน์ · ความก้าวหน้าบันทึกไว้ในเครื่อง ·
            ระบบบัญชีจะซิงก์อีกครั้งเมื่อเชื่อมต่ออินเทอร์เน็ต
          </div>
        )}
        {session.userId &&
          (syncPhase === "error" || syncPhase === "conflict") && (
            <div className="notice warning" role="status">
              {syncPhase === "conflict"
                ? "มีความก้าวหน้าใหม่จากอีกอุปกรณ์ ข้อมูลในเครื่องยังไม่ถูกเขียนทับ"
                : "ยังซิงก์บัญชีไม่ได้ ความก้าวหน้าบนเครื่องยังอยู่"}{" "}
              <Link className="text-link" href="/hn/settings">
                จัดการข้อมูล
              </Link>
            </div>
          )}
        {storageError && (
          <div className="notice warning">
            ไม่สามารถอ่านหรือบันทึกข้อมูลในเครื่องได้
            กรุณาส่งออกความก้าวหน้าเพื่อสำรองข้อมูล
          </div>
        )}
        <main id="main" className="content">
          {section === "learn" && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">
                    <span className="green-dot" /> สมุดฝึกภาษาญี่ปุ่น
                  </div>
                  <h1>การเรียนวันนี้</h1>
                  <p>เลือกบทเรียนหรือทบทวนสิ่งที่เรียนไปแล้ว</p>
                </div>
                <div className="streak-pill">
                  <Flame size={20} />
                  <div>
                    <strong>{streak(progress.activity)} วัน</strong>
                    <small>เรียนรู้อย่างต่อเนื่อง</small>
                  </div>
                </div>
              </div>
              <section className="hero">
                <div className="hero-copy">
                  <span className="hero-label">
                    บทเรียนถัดไป · {level} ·{" "}
                    {categoryNames[nextLesson.category]}
                  </span>
                  <h2>{nextLesson.meaning}</h2>
                  <p>
                    อ่านคำอธิบาย ฟังการออกเสียง
                    <br />
                    แล้วบันทึกบทเรียนที่เรียนแล้ว
                  </p>
                  <Action onClick={() => setActive(nextLesson)}>
                    ไปเรียนกัน <ArrowRight size={18} />
                  </Action>
                </div>
                <div className="hero-lesson">
                  <span className="word-caption">
                    {categoryNames[nextLesson.category]} / {level}
                  </span>
                  <span className="hero-japanese" lang="ja">
                    {nextLesson.japanese}
                  </span>
                  <span className="hero-reading" lang="ja">
                    {nextLesson.reading}
                  </span>
                  <span className="hero-translation">{nextLesson.meaning}</span>
                </div>
              </section>
              <div className="summary-grid">
                <div className="summary-card">
                  <div>
                    <span>บทเรียนที่เรียนแล้ว</span>
                    <strong>
                      {progress.completed.length}
                      <small> / {lessons.length} บท</small>
                    </strong>
                  </div>
                </div>
                <div className="summary-card">
                  <div>
                    <span>การ์ดพร้อมทบทวน</span>
                    <strong>
                      {due.length}
                      <small> ใบ ในระดับ {level}</small>
                    </strong>
                  </div>
                  <Link
                    href="/hn/flashcards"
                    className="round-link"
                    aria-label="ทบทวนแฟลชการ์ด"
                  >
                    <ArrowUpRight size={19} />
                  </Link>
                </div>
                <div className="summary-card">
                  <div>
                    <span>เป้าหมายวันนี้</span>
                    <strong>
                      {Math.min(todayCount, progress.goal)}
                      <small> / {progress.goal} กิจกรรม</small>
                    </strong>
                  </div>
                </div>
              </div>
              <div className="learning-layout">
                <div className="learning-main">
                  <div className="section-heading">
                    <div>
                      <h2>เลือกประเภทบทเรียน</h2>
                      <p>คำศัพท์ ไวยากรณ์ คันจิ และบทสนทนา</p>
                    </div>
                    <label className="level-select">
                      ระดับ{" "}
                      <select
                        aria-label="เลือกระดับ JLPT"
                        value={level}
                        onChange={(e) => changeLevel(e.target.value as Level)}
                      >
                        {levels.map((l) => (
                          <option key={l}>{l}</option>
                        ))}
                      </select>
                      <ChevronDown size={15} />
                    </label>
                  </div>
                  <div className="category-grid">
                    {(Object.keys(categoryNames) as Category[]).map((c, i) => {
                      const Icon = categoryIcons[c];
                      return (
                        <button
                          onClick={() => libraryCategory(c)}
                          key={c}
                          className={`category-card category-${c}`}
                        >
                          <span className="category-symbol">
                            {c === "kanji" ? (
                              <span>字</span>
                            ) : (
                              <Icon size={26} />
                            )}
                          </span>
                          <span className="category-arrow">
                            <ArrowUpRight size={19} />
                          </span>
                          <h3>{categoryNames[c]}</h3>
                          <p>
                            {
                              [
                                "คำอ่าน ความหมาย และตัวอย่าง",
                                "รูปประโยคพร้อมคำอธิบาย",
                                "ตัวอักษร คำอ่าน และความหมาย",
                                "ฝึกฟังพร้อมคำแปลไทย",
                              ][i]
                            }
                          </p>
                          <span className="category-bottom">
                            {
                              levelLessons.filter((l) => l.category === c)
                                .length
                            }{" "}
                            บทเรียน{" "}
                            <span>{["ことば", "文法", "漢字", "会話"][i]}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="section-heading continue-heading">
                    <div>
                      <h2>
                        {learned > 0
                          ? "เรียนต่อจากครั้งก่อน"
                          : "เริ่มบทเรียนแรก"}
                      </h2>
                      <p>เริ่มจากบทเรียนสั้น ๆ เพียงไม่กี่นาที</p>
                    </div>
                    <Link className="text-link" href="/hn/library">
                      ดูทั้งหมด <ArrowRight size={16} />
                    </Link>
                  </div>
                  <button
                    className="continue-card"
                    onClick={() => setActive(nextLesson)}
                  >
                    <span className="continue-glyph">
                      {nextLesson.category === "kanji"
                        ? nextLesson.japanese
                        : "あ"}
                    </span>
                    <span className="continue-copy">
                      <span className="small-label">
                        {level} <span>·</span>{" "}
                        {categoryNames[nextLesson.category]}
                      </span>
                      <strong>{nextLesson.meaning}</strong>
                      <span className="muted">
                        {nextLesson.japanese} <span>·</span> ประมาณ 3 นาที
                      </span>
                    </span>
                    <span className="continue-play">
                      <Play size={19} fill="currentColor" />
                    </span>
                  </button>
                </div>
                <aside className="learning-aside">
                  <div className="daily-card">
                    <div className="daily-header">
                      <span>
                        <span className="green-dot" /> คำศัพท์ประจำวัน
                      </span>
                      <span>今日の言葉</span>
                    </div>
                    <div className="word-display">
                      <span className="word-reading">こもれび</span>
                      <h3>木漏れ日</h3>
                      <span className="word-romaji">komorebi</span>
                    </div>
                    <p className="word-meaning">แสงแดดที่ลอดผ่านใบไม้</p>
                    <div className="word-divider" />
                    <button
                      className="listen-word"
                      onClick={() => speak("木漏れ日")}
                    >
                      <Volume2 size={18} />
                      {speaking ? "หยุดเสียง" : "ฟังการออกเสียง"}
                      <span>เสียงสังเคราะห์</span>
                    </button>
                  </div>
                  <div className="level-card">
                    <div className="flex items-center justify-between">
                      <strong>เส้นทางของคุณ</strong>
                      <span className="small-chip">{level}</span>
                    </div>
                    <p>
                      {learned === levelLessons.length
                        ? "เรียนครบชุดเริ่มต้นระดับนี้แล้ว"
                        : "บทเรียนที่บันทึกว่าเรียนแล้ว"}
                    </p>
                    <div className="progress-track">
                      <span
                        style={{
                          transform: `scaleX(${learned / levelLessons.length})`,
                        }}
                      />
                    </div>
                    <div className="level-progress">
                      <span>
                        {learned} จาก {levelLessons.length} บทเรียน
                      </span>
                      <strong>
                        {Math.round((learned / levelLessons.length) * 100)}%
                      </strong>
                    </div>
                    <div className="level-steps">
                      {levels.map((l) => (
                        <button
                          key={l}
                          onClick={() => changeLevel(l)}
                          className={l === level ? "active" : ""}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>
                </aside>
              </div>
              <div className="bottom-note">
                <span lang="ja">少しずつ、毎日。</span>
                <span>ทีละนิด ในทุกวัน</span>
              </div>
            </>
          )}

          {section === "library" && (
            <>
              <PageHeading
                eyebrow="เนื้อหาการเรียน"
                title="คลังบทเรียน"
                description="เลือกหนึ่งเรื่อง แล้วเรียนให้เข้าใจ · เนื้อหาชุดเริ่มต้นที่เขียนขึ้นใหม่"
              />
              <div className="filter-toolbar">
                <div className="tabs">
                  {levels.map((l) => (
                    <button
                      className={level === l ? "active" : ""}
                      key={l}
                      onClick={() => changeLevel(l)}
                    >
                      {l}
                    </button>
                  ))}
                </div>
                <button
                  className={`filter-bookmark ${savedOnly ? "active" : ""}`}
                  onClick={() => setSavedOnly(!savedOnly)}
                >
                  <Bookmark size={17} />
                  {savedOnly ? "ที่บันทึกไว้" : "บันทึกของฉัน"}
                </button>
              </div>
              <div className="category-filters">
                <button
                  className={category === "all" ? "active" : ""}
                  onClick={() => setCategory("all")}
                >
                  ทั้งหมด
                </button>
                {(Object.keys(categoryNames) as Category[]).map((c) => (
                  <button
                    key={c}
                    className={category === c ? "active" : ""}
                    onClick={() => setCategory(c)}
                  >
                    {categoryNames[c]}
                  </button>
                ))}
              </div>
              <div className="results-caption">
                {filtered.length} บทเรียน{" "}
                {query && (
                  <>
                    {" "}
                    · ค้นหา “{query}”{" "}
                    <button onClick={() => setQuery("")}>ล้างการค้นหา</button>
                  </>
                )}
              </div>
              <div className="lesson-grid">
                {filtered.map((l) => (
                  <LessonCard
                    key={l.id}
                    lesson={l}
                    completed={progress.completed.includes(l.id)}
                    saved={progress.saved.includes(l.id)}
                    furigana={furigana}
                    onOpen={() => setActive(l)}
                    onSave={() => save(l.id)}
                  />
                ))}
              </div>
              {filtered.length === 0 && (
                <Empty
                  title="ยังไม่พบบทเรียน"
                  text="ลองเปลี่ยนคำค้น ระดับ หรือประเภทบทเรียน"
                  action="ล้างตัวกรอง"
                  onClick={() => {
                    setQuery("");
                    setCategory("all");
                    setSavedOnly(false);
                  }}
                />
              )}
            </>
          )}

          {section === "flashcards" && (
            <>
              <PageHeading
                eyebrow="ทบทวนแบบเว้นระยะ"
                title="ทบทวนให้จำขึ้นใจ"
                description="พลิกการ์ด นึกคำตอบ แล้วให้เราช่วยวางแผนทบทวนครั้งต่อไป"
              />
              <div className="filter-toolbar">
                <LevelTabs level={level} onChange={changeLevel} />
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={allCards}
                    onChange={(e) => {
                      setAllCards(e.target.checked);
                      setReviewed([]);
                      setFlipped(false);
                    }}
                  />
                  รวมการ์ดที่ยังไม่ถึงกำหนด
                </label>
              </div>
              {card ? (
                <div className="flash-session">
                  <div className="session-top">
                    <span>
                      {level} · {categoryNames[card.category]}
                    </span>
                    <span>
                      เหลือ {cards.length} ใบ{" "}
                      <span className="muted">
                        {" "}
                        / ทบทวนแล้ว {reviewed.length}
                      </span>
                    </span>
                  </div>
                  <button
                    className={`flash-card ${flipped ? "is-flipped" : ""}`}
                    onClick={() => setFlipped(!flipped)}
                    aria-label={flipped ? "พลิกดูคำภาษาญี่ปุ่น" : "พลิกดูคำตอบ"}
                  >
                    <span className="flash-label">
                      {flipped ? "ความหมาย" : "ลองนึกความหมายของคำนี้"}
                    </span>
                    <span
                      className={`flash-japanese ${flipped ? "thai-answer" : ""}`}
                    >
                      {flipped ? (
                        card.meaning
                      ) : (
                        <JapaneseWord
                          furigana={furigana}
                          reading={card.reading}
                          text={card.japanese}
                        />
                      )}
                    </span>
                    <span className="flash-reading">
                      {flipped || furigana ? card.example : card.reading}
                    </span>
                    {flipped && (
                      <span className="muted">{card.translation}</span>
                    )}
                    <span className="flip-hint">
                      <RotateCcw size={15} /> แตะเพื่อพลิกการ์ด
                    </span>
                  </button>
                  <div className="flash-sound">
                    <Action
                      variant="text"
                      onClick={() => speak(card.japanese.replaceAll("〜", ""))}
                    >
                      <Volume2 size={18} />
                      ฟังการออกเสียง
                    </Action>
                  </div>
                  {flipped ? (
                    <div className="review-actions">
                      <Action variant="outlined" onClick={() => review(false)}>
                        <RotateCcw size={17} />
                        ยังจำไม่ได้ <small>10 นาที</small>
                      </Action>
                      <Action onClick={() => review(true)}>
                        <Check size={18} />
                        จำได้แล้ว{" "}
                        <small>
                          {
                            scheduleReview(progress.reviews[card.id], true)
                              .interval
                          }{" "}
                          วัน
                        </small>
                      </Action>
                    </div>
                  ) : (
                    <div className="review-actions">
                      <Action onClick={() => setFlipped(true)}>
                        แสดงคำตอบ <ArrowRight size={17} />
                      </Action>
                    </div>
                  )}
                  <p className="session-note">
                    <ShieldCheck size={14} />
                    {session.userId
                      ? "กำหนดทบทวนและคำตอบบันทึกในบัญชีของคุณ"
                      : "กำหนดทบทวนและคำตอบบันทึกเฉพาะในเบราว์เซอร์นี้"}
                  </p>
                </div>
              ) : (
                <Empty
                  title={
                    reviewed.length
                      ? "ทบทวนชุดนี้ครบแล้ว"
                      : "วันนี้ทบทวนครบแล้ว"
                  }
                  text="พักสักนิด แล้วกลับมาเรียนรู้ด้วยกันอีกครั้ง หรือฝึกการ์ดทั้งหมดได้เลย"
                  action="ฝึกการ์ดทั้งหมดอีกครั้ง"
                  onClick={() => {
                    setReviewed([]);
                    setAllCards(true);
                    setFlashIndex(0);
                    setFlipped(false);
                  }}
                />
              )}
            </>
          )}

          {section === "practice" && (
            <>
              <PageHeading
                eyebrow="ฝึกแปลคำศัพท์"
                title="ฝึกคำศัพท์"
                description="เลือกหนังสือ บท และทิศทางการแปล แล้วเลือกคำตอบที่ถูกต้องจาก 4 ตัวเลือก"
              />
              <div className="practice-settings" aria-label="ตั้งค่าการฝึกคำศัพท์">
                <label>
                  หนังสือ
                  <select
                    value={practiceBook}
                    onChange={(e) => {
                      setPracticeBook(e.target.value);
                      const selectedBook = practiceBooks.find(
                        (book) => book.id === e.target.value,
                      );
                      setSelectedPracticeUnits(
                        selectedBook?.units.map((unit) => unit.id) ?? [],
                      );
                      resetTranslationPractice();
                    }}
                  >
                    {practiceBooks.map((book) => (
                      <option key={book.id} value={book.id}>
                        {book.title}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="practice-unit-picker">
                  <div>
                    <strong>เลือกบทและ れんしゅう</strong>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPracticeUnits(
                          activePracticeBook.units.map((unit) => unit.id),
                        );
                        resetTranslationPractice();
                      }}
                    >
                      เลือกทั้งหมด
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPracticeUnits([]);
                        resetTranslationPractice();
                      }}
                    >
                      ล้าง
                    </button>
                  </div>
                  {[...new Set(activePracticeBook.units.map((unit) => unit.lesson))].map(
                    (lesson) => (
                      <fieldset key={lesson}>
                        <legend>
                          {typeof lesson === "number" ? `บท ${lesson}` : lesson}
                        </legend>
                        <div>
                          {activePracticeBook.units
                            .filter((unit) => unit.lesson === lesson)
                            .map((unit) => (
                              <label key={unit.id}>
                                <input
                                  type="checkbox"
                                  checked={selectedPracticeUnits.includes(unit.id)}
                                  onChange={(e) => {
                                    setSelectedPracticeUnits((current) =>
                                      e.target.checked
                                        ? [...current, unit.id]
                                        : current.filter((id) => id !== unit.id),
                                    );
                                    resetTranslationPractice();
                                  }}
                                />
                                {unit.exercise === null
                                  ? "คำศัพท์ทั้งหมด"
                                  : `れんしゅう ${unit.exercise}`}
                                <small>{unit.wordCount ?? unit.words.length} คำ</small>
                              </label>
                            ))}
                        </div>
                      </fieldset>
                    ),
                  )}
                </div>
                <fieldset>
                  <legend>ทิศทางการแปล</legend>
                  <div className="practice-direction">
                    <button
                      aria-pressed={practiceDirection === "thai-to-japanese"}
                      className={
                        practiceDirection === "thai-to-japanese" ? "active" : ""
                      }
                      onClick={() => {
                        setPracticeDirection("thai-to-japanese");
                        resetTranslationPractice();
                      }}
                      type="button"
                    >
                      ไทย → ญี่ปุ่น
                    </button>
                    <button
                      aria-pressed={practiceDirection === "japanese-to-thai"}
                      className={
                        practiceDirection === "japanese-to-thai" ? "active" : ""
                      }
                      onClick={() => {
                        setPracticeDirection("japanese-to-thai");
                        resetTranslationPractice();
                      }}
                      type="button"
                    >
                      ญี่ปุ่น → ไทย
                    </button>
                  </div>
                </fieldset>
              </div>
              {openJlptKanjiLoading ? (
                <div className="quiz-result" role="status">
                  <h2>กำลังโหลดคันจิ</h2>
                  <p>กำลังเตรียมชุดคันจิ JLPT ตามระดับที่เลือก</p>
                </div>
              ) : practiceQuestions.length === 0 ? (
                <Empty
                  title="ยังไม่ได้เลือก れんしゅう"
                  text="เลือกอย่างน้อยหนึ่ง れんしゅう เพื่อเริ่มฝึกคำศัพท์"
                  action="เลือกทั้งหมด"
                  onClick={() => {
                    setSelectedPracticeUnits(
                      activePracticeBook.units.map((unit) => unit.id),
                    );
                    resetTranslationPractice();
                  }}
                />
              ) : practiceDone ? (
                <div className="quiz-result">
                  <span className="small-label">結果 / ผลการฝึก</span>
                  <h2>ผลการฝึกคำศัพท์</h2>
                  <div className="quiz-score">
                    {practiceCorrect}
                    <span> / {practiceQuestions.length}</span>
                  </div>
                  <p>
                    ตอบถูก{" "}
                    {Math.round((practiceCorrect / practiceQuestions.length) * 100)}% ·
                    ลองทบทวนคำที่ยังไม่คุ้นอีกครั้ง
                  </p>
                  <Action onClick={resetTranslationPractice}>
                    ฝึกอีกครั้ง <RotateCcw size={17} />
                  </Action>
                </div>
              ) : (
                <div className="quiz-panel">
                  <div className="session-top">
                    <span>
                      {practiceDirection === "thai-to-japanese"
                        ? "เลือกคำภาษาญี่ปุ่นที่ถูกต้อง"
                        : "เลือกคำแปลภาษาไทยที่ถูกต้อง"}
                    </span>
                    <span>
                      {practiceIndex + 1} / {practiceQuestions.length}
                    </span>
                  </div>
                  <div className="progress-track">
                    <span
                      style={{
                        transform: `scaleX(${practiceIndex / practiceQuestions.length})`,
                      }}
                    />
                  </div>
                  <h2
                    className={
                      practiceDirection === "thai-to-japanese" ? "thai-prompt" : ""
                    }
                    lang={practiceDirection === "thai-to-japanese" ? "th" : "ja"}
                  >
                    {practiceDirection === "thai-to-japanese" ? (
                      practiceQuestion.meaning
                    ) : (
                      <JapaneseWord
                        furigana={furigana}
                        reading={practiceQuestion.reading}
                        text={practiceQuestion.japanese}
                      />
                    )}
                  </h2>
                  {practiceDirection === "japanese-to-thai" && !furigana && (
                    <p className="quiz-reading">{practiceQuestion.reading}</p>
                  )}
                  <div className="quiz-options">
                    {practiceOptions.map((option, i) => {
                      const correct =
                        option ===
                        (practiceDirection === "thai-to-japanese"
                          ? practiceQuestion.japanese
                          : practiceQuestion.meaning);
                      const optionWord =
                        practiceDirection === "thai-to-japanese"
                          ? allPracticeWords.find((word) => word.japanese === option)
                          : undefined;
                      return (
                      <button
                        key={option}
                        disabled={practiceChecked}
                        onClick={() => checkPracticeAnswer(option)}
                        className={
                          !practiceChecked
                            ? ""
                            : correct
                              ? "correct"
                              : practiceAnswer === option
                                ? "incorrect"
                                : ""
                        }
                      >
                        <span>{i + 1}</span>
                        {optionWord ? (
                          <JapaneseWord
                            furigana={furigana}
                            reading={optionWord.reading}
                            text={option}
                          />
                        ) : (
                          option
                        )}
                        {practiceChecked && correct && (
                          <CheckCircle2 size={20} />
                        )}
                      </button>
                      );
                    })}
                  </div>
                  {practiceChecked && (
                    <div
                      className={`answer-feedback practice-feedback ${practiceAnswer === (practiceDirection === "thai-to-japanese" ? practiceQuestion.japanese : practiceQuestion.meaning) ? "good" : ""}`}
                    >
                      <strong role="status">
                        {practiceAnswer ===
                        (practiceDirection === "thai-to-japanese"
                          ? practiceQuestion.japanese
                          : practiceQuestion.meaning)
                          ? "ตอบถูกต้อง"
                          : `คำตอบที่ถูกคือ ${practiceDirection === "thai-to-japanese" ? practiceQuestion.japanese : practiceQuestion.meaning}`}
                      </strong>
                      <p>
                        คำอ่าน: <span lang="ja">{practiceQuestion.reading}</span>
                        <br />
                        ความหมาย: {practiceQuestion.meaning}
                      </p>
                      <Action onClick={nextPracticeQuestion}>
                        {practiceIndex + 1 === practiceQuestions.length
                          ? "ดูผลการฝึก"
                          : "ข้อถัดไป"}
                        <ArrowRight size={17} />
                      </Action>
                    </div>
                  )}
                </div>
              )}
              {practiceBook === "jlpt-kanji" && (
                <p className="support-note practice-source-note">
                  รายการคันจิ OpenJLPT 0.3.0 · CC BY-SA 4.0 · ความหมายแปลไทยอัตโนมัติจากต้นฉบับภาษาอังกฤษ · ระดับเป็นรายการอ้างอิงทั่วไป ไม่ใช่รายการทางการของ JLPT
                </p>
              )}
            </>
          )}

          {section === "conversations" && (
            <>
              <PageHeading
                eyebrow="การฟังและการสนทนา"
                title="ฝึกฟังและสนทนา"
                description="บทสนทนาสั้น ๆ ในชีวิตประจำวัน พร้อมคำแปลไทยและเสียงสังเคราะห์ภาษาญี่ปุ่น"
              />
              <LevelTabs level={level} onChange={changeLevel} />
              {levelLessons
                .filter((l) => l.category === "conversation")
                .map((l) => (
                  <section className="conversation-panel" key={l.id}>
                    <div className="conversation-heading">
                      <div>
                        <span className="small-chip">{level} · บทสนทนา</span>
                        <h2 lang="ja">{l.japanese}</h2>
                        <p>{l.meaning}</p>
                      </div>
                      <Action
                        onClick={() =>
                          speak(l.lines!.map((x) => x.japanese).join("。"))
                        }
                      >
                        {speaking ? <X size={18} /> : <Play size={18} />}{" "}
                        {speaking ? "หยุดเสียง" : "ฟังทั้งบท"}
                      </Action>
                    </div>
                    <div className="dialogue-lines">
                      {l.lines?.map((line, i) => (
                        <div
                          className={`dialogue-line ${i % 2 ? "other" : ""}`}
                          key={i}
                        >
                          <span className="speaker">{line.speaker}</span>
                          <div>
                            <p lang="ja">{line.japanese}</p>
                            <span>{line.thai}</span>
                          </div>
                          <button
                            className="icon-button"
                            aria-label={`ฟังประโยคที่ ${i + 1}`}
                            onClick={() => speak(line.japanese)}
                          >
                            <Volume2 size={20} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="conversation-footer">
                      <p>
                        <Volume2 size={16} />
                        เสียง TTS ของอุปกรณ์ · ความเร็ว 0.85×
                      </p>
                      <Action variant="tonal" onClick={() => complete(l)}>
                        <Check size={17} />
                        {progress.completed.includes(l.id)
                          ? "ฝึกบทนี้อีกครั้งแล้ว"
                          : "ฝึกบทนี้แล้ว"}
                      </Action>
                    </div>
                  </section>
                ))}
              <p className="support-note">
                คุณภาพและการใช้งานออฟไลน์ของเสียงขึ้นอยู่กับเสียงภาษาญี่ปุ่นที่ติดตั้งบนอุปกรณ์
                ไม่ใช่ไฟล์เสียงจากหนังสือ
              </p>
            </>
          )}

          {section === "statistics" && (
            <>
              <PageHeading
                eyebrow="สรุปการเรียน"
                title="สถิติการเรียน"
                description="ภาพรวมคลังเนื้อหาและสถิติส่วนตัวในพื้นที่ฝึกของฉัน"
              />
              <div className="public-banner">
                <span className="public-icon">
                  <ChartNoAxesCombined size={33} />
                </span>
                <div>
                  <h2>ภาพรวมคลังบทเรียน</h2>
                  <p>ภาพรวมคลังบทเรียน · หน้าสถิติสาธารณะอยู่ที่ /</p>
                </div>
                <Link
                  className="text-link"
                  href="/api/v1/stats"
                  target="_blank"
                >
                  ดู JSON <ArrowUpRight size={17} />
                </Link>
              </div>
              <div className="stats-four">
                {[
                  {
                    value: lessons.length,
                    label: "บทเรียนเริ่มต้น",
                    icon: BookOpen,
                  },
                  { value: 5, label: "ระดับ N5–N1", icon: TrendingUp },
                  { value: 4, label: "ประเภทการเรียน", icon: Layers },
                  { value: 2, label: "ISBN ที่อ้างอิง", icon: Library },
                ].map((s) => (
                  <div className="stat-tile" key={s.label}>
                    <s.icon size={24} />
                    <strong>{s.value}</strong>
                    <span>{s.label}</span>
                  </div>
                ))}
              </div>
              <div className="stats-columns">
                <section className="panel">
                  <h2>เนื้อหาในแต่ละระดับ</h2>
                  <p className="muted">จำนวนบทเรียนที่พร้อมให้เรียน</p>
                  <div className="bar-chart">
                    {levels.map((l) => (
                      <div className="bar-row" key={l}>
                        <span>{l}</span>
                        <div>
                          <span
                            style={{
                              transform: `scaleX(${contentStats().byLevel[l] / 12})`,
                            }}
                          />
                        </div>
                        <strong>{contentStats().byLevel[l]}</strong>
                      </div>
                    ))}
                  </div>
                  <div className="chart-legend">
                    <span className="green-dot" /> บทเรียนต้นฉบับของโครงการ
                  </div>
                </section>
                <section className="panel">
                  <h2>เนื้อหาแต่ละประเภท</h2>
                  <p className="muted">สัดส่วนเนื้อหาในคลัง</p>
                  <div className="category-stat-list">
                    {(Object.keys(categoryNames) as Category[]).map((c) => {
                      const Icon = categoryIcons[c];
                      return (
                        <div key={c}>
                          <span className={`summary-icon category-${c}`}>
                            <Icon size={20} />
                          </span>
                          <span>{categoryNames[c]}</span>
                          <strong>
                            {contentStats().byCategory[c]} <small>บท</small>
                          </strong>
                        </div>
                      );
                    })}
                  </div>
                </section>
              </div>
              <section className="panel personal-stats">
                <div className="section-heading">
                  <div>
                    <h2>ความก้าวหน้าของคุณ</h2>
                    <p>
                      รายละเอียดจากเครื่องนี้ ·
                      ไม่มีการเผยแพร่ความก้าวหน้าของคุณต่อสาธารณะ
                    </p>
                  </div>
                  <span className="small-chip">
                    <ShieldCheck size={14} /> ในเครื่องนี้
                  </span>
                </div>
                <div className="personal-stat-row">
                  <span>
                    <strong>{progress.completed.length}</strong>
                    บทเรียนที่เรียนแล้ว
                  </span>
                  <span>
                    <strong>
                      {
                        progress.activity.filter((a) => a.kind === "review")
                          .length
                      }
                    </strong>
                    ครั้งที่ทบทวน
                  </span>
                  <span>
                    <strong>{streak(progress.activity)}</strong>
                    วันที่เรียนต่อเนื่อง
                  </span>
                  <span>
                    <strong>
                      {
                        progress.activity.filter(
                          (a) => a.kind === "quiz" && a.correct,
                        ).length
                      }
                    </strong>
                    คำตอบที่ถูกต้อง
                  </span>
                </div>
                <div className="activity-week">
                  {Array.from({ length: 7 }, (_, i) => {
                    const date = new Date();
                    date.setDate(date.getDate() - 6 + i);
                    const count = progress.activity.filter(
                      (a) => a.date === localDate(date),
                    ).length;
                    return (
                      <div key={i}>
                        <div className="activity-track">
                          <span
                            style={{
                              height: count
                                ? `${Math.min(100, Math.max(8, (count / progress.goal) * 100))}%`
                                : "0%",
                            }}
                          />
                        </div>
                        <span>
                          {date.toLocaleDateString("th-TH", {
                            weekday: "short",
                          })}
                        </span>
                        <strong>{count}</strong>
                      </div>
                    );
                  })}
                </div>
              </section>
              <p className="support-note">
                เนื้อหาเป็นชุดเริ่มต้น ยังไม่ครอบคลุมหลักสูตร JLPT ทั้งหมด
                การจัดระดับเป็นแนวทางของโครงการ ไม่ใช่รายการทางการ
              </p>
            </>
          )}

          {section === "books" && (
            <>
              <PageHeading
                eyebrow="แหล่งอ้างอิง"
                title="ชั้นหนังสืออ้างอิง"
                description="ติดตามข้อมูลหนังสือและสถานะการเชื่อมเนื้อหากับบทเรียน"
              />
              <div className="books-grid">
                {books.map((b, i) => (
                  <article className="book-card" key={b.isbn}>
                    <div className={`book-cover book-${i}`} aria-hidden="true">
                      <span>หนังสืออ้างอิง</span>
                      <BookOpen size={48} />
                      <strong>
                        {i === 0 ? "あきこと\n友だち" : "みんなの\n日本語 1"}
                      </strong>
                      <span>{b.title}</span>
                    </div>
                    <div className="book-info">
                      <span
                        className={`status-chip ${b.status === "metadata-verified" || b.status === "user-confirmed" ? "verified" : ""}`}
                      >
                        <Check size={13} />{" "}
                        {b.status === "metadata-verified"
                          ? "ยืนยันข้อมูลบรรณานุกรม"
                          : "ยืนยันชื่อโดยผู้ใช้"}
                      </span>
                      <h2>{b.title}</h2>
                      <p>ISBN {b.isbn}</p>
                      <p>{b.publisher ?? "ยังไม่มีข้อมูลสำนักพิมพ์"}</p>
                      <div className="book-note">{b.note}</div>
                      {b.url && (
                        <a
                          className="text-link"
                          href={b.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          ข้อมูลจากสำนักพิมพ์ <ExternalLink size={15} />
                        </a>
                      )}
                    </div>
                  </article>
                ))}
              </div>
              <section className="panel source-note">
                <ShieldCheck size={25} />
                <div>
                  <h2>สถานะการนำเข้าเนื้อหา</h2>
                  <p>
                    บทเรียนและบทสนทนาที่ใช้งานอยู่เป็นเนื้อหาที่เขียนขึ้นใหม่สำหรับโครงการ
                    (CC0) ไม่ใช่การคัดลอกหนังสือ
                    ยังไม่มีการนำเข้าแบบฝึกหัดหรือไฟล์เสียงของหนังสือทั้งสอง
                    ISBN
                    การเชื่อมบทเรียนรายบทจะเพิ่มได้เมื่อมีสารบัญและเนื้อหาที่ได้รับอนุญาต
                  </p>
                </div>
              </section>
            </>
          )}

          {section === "settings" && (
            <>
              <PageHeading
                eyebrow="การตั้งค่า"
                title="ตั้งค่าการเรียน"
                description="ตั้งเป้าหมายเล็ก ๆ และดูแลความก้าวหน้าของตัวเอง"
              />
              <div className="settings-grid">
                <section className="panel">
                  <h2>ระดับที่กำลังเรียน</h2>
                  <p>เปลี่ยนระดับได้ทุกเมื่อ ความก้าวหน้าเดิมยังอยู่</p>
                  <LevelTabs level={level} onChange={changeLevel} />
                  <div className="setting-divider" />
                  <h2>เป้าหมายต่อวัน</h2>
                  <p>นับจากการเรียนบทเรียน ทบทวนการ์ด และตอบคำถาม</p>
                  <label className="goal-input">
                    <input
                      type="number"
                      min="1"
                      max="100"
                      aria-label="เป้าหมายกิจกรรมต่อวัน"
                      value={progress.goal}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        if (Number.isInteger(n) && n >= 1 && n <= 100)
                          setProgress((p) => ({ ...p, goal: n }));
                      }}
                    />{" "}
                    กิจกรรม / วัน
                  </label>
                  <div className="setting-divider" />
                  <h2>ฟุริงานะ</h2>
                  <p>แสดงคำอ่านเหนือคำศัพท์ที่มีคันจิ</p>
                  <label className="furigana-toggle">
                    <input
                      type="checkbox"
                      checked={furigana}
                      onChange={(e) => updateFurigana(e.target.checked)}
                    />
                    แสดงฟุริงานะ
                  </label>
                </section>
                <section className="panel">
                  <h2>เรียนได้ทุกที่</h2>
                  <p>
                    ติดตั้ง Kotoba ไว้บนหน้าจอหลักเพื่อเข้าถึงได้สะดวก
                    ต้องออนไลน์เพื่อเข้าสู่ระบบและฝึก
                  </p>
                  <Action variant="tonal" onClick={installApp}>
                    <Download size={18} />
                    ติดตั้งแอป
                  </Action>
                  <div className="setting-divider" />
                  <h2>เสียงภาษาญี่ปุ่น</h2>
                  <p>ใช้เสียงสังเคราะห์จากอุปกรณ์ ไม่ต้องใช้ API key</p>
                  <Action
                    variant="outlined"
                    onClick={() =>
                      speak("こんにちは。いっしょに日本語を勉強しましょう。")
                    }
                  >
                    <Volume2 size={18} />
                    ทดสอบเสียง
                  </Action>
                </section>
                <section className="panel data-panel">
                  <div>
                    <h2>ข้อมูลของคุณ อยู่กับคุณ</h2>
                    <p>
                      {session.userId
                        ? "บัญชีของคุณบันทึกความก้าวหน้าเพื่อใช้ข้ามอุปกรณ์และเรียกผ่าน API"
                        : "แบบผู้เยี่ยมชมเก็บความก้าวหน้าในเบราว์เซอร์นี้ เข้าสู่ระบบเมื่อต้องการเก็บไว้ในบัญชี"}
                      <br />
                      ข้อมูลการเรียนของคุณไม่ถูกเผยแพร่ต่อสาธารณะ
                    </p>
                  </div>
                  <div className="data-actions">
                    <Action
                      onClick={() => download("kotoba-progress.json", progress)}
                    >
                      <Download size={18} />
                      ส่งออกความก้าวหน้า
                    </Action>
                    <Action
                      variant="outlined"
                      onClick={() => fileInput.current?.click()}
                    >
                      <Upload size={18} />
                      นำเข้าข้อมูล
                    </Action>
                    <input
                      ref={fileInput}
                      type="file"
                      accept="application/json,.json"
                      hidden
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void importProgress(f);
                      }}
                    />
                  </div>
                  <div className="publication-status">
                    <span role="status">
                      {syncPhase === "guest"
                        ? "โหมดผู้เยี่ยมชม · บันทึกในเบราว์เซอร์นี้"
                        : syncPhase === "saved"
                          ? "บันทึกความก้าวหน้าในบัญชีแล้ว"
                          : syncPhase === "saving"
                            ? "กำลังบันทึกในบัญชี"
                            : syncPhase === "conflict"
                              ? "มีข้อมูลใหม่จากอีกอุปกรณ์ ส่งออกข้อมูลในเครื่องก่อนโหลดข้อมูลจากบัญชี"
                              : syncPhase === "error"
                                ? "ยังซิงก์บัญชีไม่ได้ ความก้าวหน้ายังเก็บอยู่ในเครื่อง"
                                : "รอบันทึกความก้าวหน้าในบัญชี"}
                    </span>
                    {session.userId ? (
                      <>
                        <Action
                          variant="tonal"
                          onClick={retrySync}
                          disabled={syncPhase === "saving"}
                        >
                          ซิงก์อีกครั้ง
                        </Action>
                        <Action
                          variant="outlined"
                          onClick={() => {
                            try {
                              importGuest();
                              notify("นำเข้าความก้าวหน้าผู้เยี่ยมชมแล้ว");
                            } catch (e) {
                              notify(
                                e instanceof Error
                                  ? e.message
                                  : "ไม่สามารถนำเข้าได้",
                              );
                            }
                          }}
                        >
                          นำเข้าความก้าวหน้าผู้เยี่ยมชม
                        </Action>
                        {syncPhase === "conflict" && (
                          <Action variant="outlined" onClick={loadAccountCopy}>
                            ใช้ข้อมูลบัญชีแทนข้อมูลในเครื่อง
                          </Action>
                        )}
                        <Link className="text-link" href="/hn/api">
                          ดู API ข้อมูลของฉัน <ArrowUpRight />
                        </Link>
                      </>
                    ) : (
                      <AccountControls />
                    )}
                  </div>
                  <p className="support-note">
                    การนำเข้าจะแทนที่ความก้าวหน้าปัจจุบัน
                    ข้อมูลผู้เยี่ยมชมและแต่ละบัญชีเก็บแยกกัน
                  </p>
                </section>
              </div>
            </>
          )}

          {section === "api" && (
            <>
              <PageHeading
                eyebrow="ข้อมูลสำหรับนักพัฒนา"
                title="Developer API"
                description="API สาธารณะสำหรับคลังบทเรียน และ API ส่วนตัวสำหรับข้อมูลบัญชีผ่าน Clerk"
              />
              <div className="api-callout">
                <Code2 size={30} />
                <div>
                  <h2>API คลังบทเรียน</h2>
                  <p>
                    เนื้อหาเริ่มต้นเป็น CC0 · โค้ดแอปเป็น MIT · พร้อมทำงานบน
                    Vercel
                  </p>
                </div>
              </div>
              <div className="endpoint-list">
                {[
                  {
                    path: "/api/v1/content",
                    description:
                      "ดูบทเรียนทั้งหมด รองรับ level, category, q, limit และ offset",
                    example: "/api/v1/content?level=N5&category=vocabulary",
                  },
                  {
                    path: "/api/v1/stats",
                    description: "สถิติคลังเนื้อหาสาธารณะ แยกตามระดับและประเภท",
                    example: "/api/v1/stats",
                  },
                  {
                    path: "/api/v1/books",
                    description: "ข้อมูลหนังสืออ้างอิง และสถานะการยืนยัน ISBN",
                    example: "/api/v1/books",
                  },
                  {
                    path: "/api/v1/export",
                    description:
                      "ดาวน์โหลดบทเรียนทั้งหมดในรูปแบบ JSON หรือ CSV",
                    example: "/api/v1/export?format=csv",
                  },
                ].map((e) => (
                  <article className="endpoint" key={e.path}>
                    <div>
                      <span className="http-method">GET</span>
                      <code>{e.path}</code>
                      <a
                        href={e.example}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`เปิด ${e.path}`}
                      >
                        <ArrowUpRight size={20} />
                      </a>
                    </div>
                    <p>{e.description}</p>
                    <code className="api-example">{e.example}</code>
                  </article>
                ))}
              </div>
              <ApiKeyManager />
              <section className="panel account-api-docs">
                <h2>ข้อมูลบัญชีของฉัน</h2>
                <p>
                  ยืนยันบัญชีด้วย Clerk session ในเว็บ หรือใช้ API key
                  สำหรับโปรแกรมภายนอก
                </p>
                <div className="endpoint-list">
                  {[
                    "/api/v1/me",
                    "/api/v1/me/progress",
                    "/api/v1/me/statistics",
                    "/api/v1/me/export",
                  ].map((path) => (
                    <article className="endpoint" key={path}>
                      <div>
                        <span className="http-method">GET</span>
                        <code>{path}</code>
                      </div>
                    </article>
                  ))}
                </div>
                <pre>
                  <code>{`// ในเว็บที่เข้าสู่ระบบแล้ว
const response = await fetch('/api/v1/me/progress');
const { data, revision } = await response.json();

// ภายนอกเว็บ: ใช้ API key ของบัญชี
curl -H "Authorization: Bearer $KOTOBA_API_KEY" \
  https://YOUR_DOMAIN/api/v1/me/export`}</code>
                </pre>
                <p className="support-note">
                  PUT /api/v1/me/progress ใช้ If-Match จาก ETag ที่ได้จาก GET
                  เพื่อป้องกันการเขียนทับข้อมูลจากอีกอุปกรณ์
                </p>
              </section>
              <section className="panel">
                <h2>ตัวอย่างการเรียกใช้งาน</h2>
                <pre>
                  <code>{`const response = await fetch(\n  '/api/v1/content?level=N5&limit=10'\n);\nconst { data, total } = await response.json();\nconsole.log(data, total);`}</code>
                </pre>
                <p className="support-note">
                  API /me ใช้ Clerk session cookie หรือ API key ตามตัวอย่าง
                  ข้อมูลที่ได้เป็นของบัญชีที่ยืนยันตัวตนเท่านั้น
                </p>
              </section>
            </>
          )}
          <footer className="page-footer">
            <span>
              kotoba. <span>สมุดฝึกภาษาญี่ปุ่น</span>
            </span>
            <span>
              <span className="green-dot" /> เรียนได้ทุกคน · โค้ดเปิดเผย
            </span>
            <Link href="/hn/api">
              API & Data <ArrowUpRight size={12} />
            </Link>
          </footer>
        </main>
      </div>
      <dialog
        ref={dialog}
        aria-label="บทเรียนภาษาญี่ปุ่น"
        className="lesson-dialog"
        onCancel={() => setActive(null)}
        onClick={(e) => {
          if (e.target === dialog.current) setActive(null);
        }}
      >
        {active && (
          <>
            <div className="modal-top">
              <span className="small-chip">
                {active.level} · {categoryNames[active.category]}
              </span>
              <button
                autoFocus
                className="icon-button"
                aria-label="ปิดบทเรียน"
                onClick={() => setActive(null)}
              >
                <X size={22} />
              </button>
            </div>
            <div className="modal-word">
              {!furigana && <p>{active.reading}</p>}
              <h2 lang="ja">
                <JapaneseWord
                  furigana={furigana}
                  reading={active.reading}
                  text={active.japanese}
                />
              </h2>
              <h3>{active.meaning}</h3>
              <Action
                variant="text"
                onClick={() => speak(active.japanese.replaceAll("〜", ""))}
              >
                <Volume2 size={19} />
                ฟังการออกเสียง
              </Action>
            </div>
            {active.explanation && (
              <p className="grammar-explanation">{active.explanation}</p>
            )}
            {active.lines ? (
              <div className="modal-dialogue">
                {active.lines.map((l, i) => (
                  <div key={i}>
                    <span>{l.speaker}</span>
                    <p lang="ja">
                      {l.japanese}
                      <small>{l.thai}</small>
                    </p>
                    <button
                      className="icon-button"
                      aria-label={`ฟังประโยคที่ ${i + 1}`}
                      onClick={() => speak(l.japanese)}
                    >
                      <Volume2 size={18} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="example-box">
                <span>ลองใช้ในประโยค</span>
                <p lang="ja">
                  <ExampleSentence
                    furigana={furigana}
                    reading={active.reading}
                    sentence={active.example}
                    target={active.japanese}
                  />
                </p>
                <span>{active.translation}</span>
                <button
                  className="icon-button"
                  aria-label="ฟังประโยคตัวอย่าง"
                  onClick={() => speak(active.example)}
                >
                  <Volume2 size={18} />
                </button>
              </div>
            )}
            <div className="modal-actions">
              <button
                className={`bookmark-button ${progress.saved.includes(active.id) ? "saved" : ""}`}
                onClick={() => save(active.id)}
              >
                <Bookmark
                  size={18}
                  fill={
                    progress.saved.includes(active.id) ? "currentColor" : "none"
                  }
                />
                {progress.saved.includes(active.id)
                  ? "บันทึกไว้แล้ว"
                  : "บันทึกไว้ทบทวน"}
              </button>
              <Action onClick={() => complete(active)}>
                <Check size={17} />
                เรียนบทนี้แล้ว
              </Action>
            </div>
            <p className="modal-source">
              เนื้อหาต้นฉบับของโครงการ · เสียงสังเคราะห์จากอุปกรณ์
            </p>
          </>
        )}
      </dialog>
      {audioMessage && (
        <div className="audio-message" role="status">
          {audioMessage}
          <button
            aria-label="ปิดข้อความเสียง"
            onClick={() => setAudioMessage("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={19} />
          {toast}
          <button aria-label="ปิดข้อความ" onClick={() => setToast("")}>
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
  return app;
}

interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
}
function PageHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="page-heading subpage-heading">
      <div>
        <div className="eyebrow">
          <span className="green-dot" />
          {eyebrow}
        </div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
    </div>
  );
}
function LevelTabs({
  level,
  onChange,
}: {
  level: Level;
  onChange: (l: Level) => void;
}) {
  return (
    <div className="tabs" aria-label="ระดับ JLPT">
      {levels.map((l) => (
        <button
          aria-pressed={level === l}
          className={level === l ? "active" : ""}
          key={l}
          onClick={() => onChange(l)}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
function LessonCard({
  lesson: l,
  completed,
  furigana,
  saved,
  onOpen,
  onSave,
}: {
  lesson: Lesson;
  completed: boolean;
  furigana: boolean;
  saved: boolean;
  onOpen: () => void;
  onSave: () => void;
}) {
  return (
    <article className={`lesson-card category-${l.category}`}>
      <div className="lesson-card-top">
        <span className="small-label">
          {l.level} · {categoryNames[l.category]}
        </span>
        <button
          className="icon-button"
          aria-label={saved ? "เลิกบันทึกบทเรียน" : "บันทึกบทเรียน"}
          onClick={onSave}
        >
          <Bookmark size={18} fill={saved ? "currentColor" : "none"} />
        </button>
      </div>
      <button className="lesson-open" onClick={onOpen}>
        {!furigana && (
          <span className="lesson-reading">{l.reading || "会話"}</span>
        )}
        <h2 lang="ja">
          <JapaneseWord
            furigana={furigana}
            reading={l.reading}
            text={l.japanese}
          />
        </h2>
        <p>{l.meaning}</p>
        <span className="lesson-card-bottom">
          {completed ? (
            <>
              <CheckCircle2 size={16} />
              เรียนแล้ว
            </>
          ) : (
            <>
              <Clock size={15} />3 นาที
            </>
          )}
          <span>
            เปิดบทเรียน <ArrowUpRight size={15} />
          </span>
        </span>
      </button>
    </article>
  );
}
function JapaneseWord({
  text,
  reading,
  furigana,
}: {
  text: string;
  reading: string;
  furigana: boolean;
}) {
  if (!furigana || !reading || !/\p{Script=Han}/u.test(text)) return text;
  return (
    <ruby className="furigana-word">
      {text}<rt>{reading}</rt>
    </ruby>
  );
}
function ExampleSentence({
  sentence,
  target,
  reading,
  furigana,
}: {
  sentence: string;
  target: string;
  reading: string;
  furigana: boolean;
}) {
  if (!furigana || !target || !sentence.includes(target)) return sentence;
  return sentence.split(target).flatMap((part, index, parts) => [
    part,
    ...(index < parts.length - 1
      ? [
          <JapaneseWord
            furigana
            key={`${target}-${index}`}
            reading={reading}
            text={target}
          />,
        ]
      : []),
  ]);
}
function Empty({
  title,
  text,
  action,
  onClick,
}: {
  title: string;
  text: string;
  action: string;
  onClick: () => void;
}) {
  return (
    <div className="empty-state">
      <span className="empty-japanese" lang="ja">
        ひと休み
      </span>
      <h2>{title}</h2>
      <p>{text}</p>
      <Action variant="tonal" onClick={onClick}>
        {action}
        <ArrowRight size={17} />
      </Action>
    </div>
  );
}
