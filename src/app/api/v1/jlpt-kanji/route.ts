import { NextResponse } from "next/server";
import { levels, type Level } from "@/lib/content";

const source = "https://raw.githubusercontent.com/evanclan/OpenJLPT/main/data/json/kanji";
const translationSource = "https://translate.googleapis.com/translate_a/single";
const cacheForOneWeek = 60 * 60 * 24 * 7;

type OpenJlptKanji = {
  character: string;
  level: Level;
  onyomi: string[];
  kunyomi: string[];
  meanings: string[];
};

async function translateChunk(lines: string[]) {
  const url = new URL(translationSource);
  url.searchParams.set("client", "gtx");
  url.searchParams.set("sl", "en");
  url.searchParams.set("tl", "th");
  url.searchParams.set("dt", "t");
  url.searchParams.set("q", lines.join("\n"));

  try {
    const response = await fetch(url, {
      next: { revalidate: cacheForOneWeek },
    });
    if (!response.ok) return lines;
    const payload = (await response.json()) as unknown;
    if (!Array.isArray(payload) || !Array.isArray(payload[0])) return lines;
    const translated = payload[0]
      .map((part) => (Array.isArray(part) && typeof part[0] === "string" ? part[0] : ""))
      .join("")
      .split("\n")
      .map((line) => line.trim());
    return translated.length === lines.length && translated.every(Boolean)
      ? translated
      : lines;
  } catch {
    return lines;
  }
}

async function translateMeaningsToThai(meanings: string[]) {
  const chunks: string[][] = [];
  let chunk: string[] = [];
  let length = 0;
  for (const meaning of meanings) {
    if (chunk.length && length + meaning.length + 1 > 2_500) {
      chunks.push(chunk);
      chunk = [];
      length = 0;
    }
    chunk.push(meaning);
    length += meaning.length + 1;
  }
  if (chunk.length) chunks.push(chunk);
  return (await Promise.all(chunks.map(translateChunk))).flat();
}

export async function GET(request: Request) {
  const requested = new URL(request.url).searchParams.get("levels")?.split(",") ?? [];
  const selected = requested.filter((level): level is Level => levels.includes(level as Level));
  if (!selected.length) {
    return NextResponse.json({ error: "เลือกอย่างน้อยหนึ่งระดับ N5–N1" }, { status: 400 });
  }
  try {
    const data = await Promise.all(
      selected.map(async (level) => {
        const response = await fetch(`${source}/${level.toLowerCase()}.json`, {
          next: { revalidate: cacheForOneWeek },
        });
        if (!response.ok) throw Error(`OpenJLPT ${level} unavailable`);
        return (await response.json()) as OpenJlptKanji[];
      }),
    );
    const kanji = data.flat();
    const englishMeanings = kanji.map((item) => item.meanings.slice(0, 3).join(", "));
    const thaiMeanings = await translateMeaningsToThai(englishMeanings);
    return NextResponse.json({
      data: kanji.map((item, index) => ({
        id: `openjlpt-${item.level}-${item.character}`,
        japanese: item.character,
        reading: [...item.onyomi, ...item.kunyomi].slice(0, 3).join("・"),
        meaning: thaiMeanings[index] || englishMeanings[index],
      })),
      attribution: "OpenJLPT 0.3.0 · CC BY-SA 4.0",
      source: "https://github.com/evanclan/OpenJLPT",
      translation: "English meanings translated to Thai automatically",
    });
  } catch {
    return NextResponse.json({ error: "ไม่สามารถโหลดชุดคันจิ OpenJLPT ได้" }, { status: 502 });
  }
}
