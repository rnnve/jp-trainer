import { NextResponse } from "next/server";
import { levels, type Level } from "@/lib/content";

const source = "https://raw.githubusercontent.com/evanclan/OpenJLPT/main/data/json/kanji";

type OpenJlptKanji = {
  character: string;
  level: Level;
  onyomi: string[];
  kunyomi: string[];
  meanings: string[];
};

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
          next: { revalidate: 60 * 60 * 24 * 7 },
        });
        if (!response.ok) throw Error(`OpenJLPT ${level} unavailable`);
        return (await response.json()) as OpenJlptKanji[];
      }),
    );
    return NextResponse.json({
      data: data.flat().map((item) => ({
        id: `openjlpt-${item.level}-${item.character}`,
        japanese: item.character,
        reading: [...item.onyomi, ...item.kunyomi].slice(0, 3).join("・"),
        meaning: item.meanings.slice(0, 3).join(", "),
      })),
      attribution: "OpenJLPT 0.3.0 · CC BY-SA 4.0",
      source: "https://github.com/evanclan/OpenJLPT",
    });
  } catch {
    return NextResponse.json({ error: "ไม่สามารถโหลดชุดคันจิ OpenJLPT ได้" }, { status: 502 });
  }
}
