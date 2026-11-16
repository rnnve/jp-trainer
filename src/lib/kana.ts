export type KanaMode = "hiragana" | "katakana" | "combined";
export type KanaCharacter = { character: string; reading: string; script: Exclude<KanaMode, "combined"> };
export type KanaQuestion = KanaCharacter & { options: string[] };

const rows = [
  ["あいうえお", "アイウエオ", "a i u e o"],
  ["かきくけこ", "カキクケコ", "ka ki ku ke ko"],
  ["さしすせそ", "サシスセソ", "sa shi su se so"],
  ["たちつてと", "タチツテト", "ta chi tsu te to"],
  ["なにぬねの", "ナニヌネノ", "na ni nu ne no"],
  ["はひふへほ", "ハヒフヘホ", "ha hi fu he ho"],
  ["まみむめも", "マミムメモ", "ma mi mu me mo"],
  ["やゆよ", "ヤユヨ", "ya yu yo"],
  ["らりるれろ", "ラリルレロ", "ra ri ru re ro"],
  ["わをん", "ワヲン", "wa wo n"],
];

export const kanaCharacters: KanaCharacter[] = rows.flatMap(([hiragana, katakana, readings]) =>
  readings.split(" ").flatMap((reading, index) => [
    { character: hiragana[index], reading, script: "hiragana" as const },
    { character: katakana[index], reading, script: "katakana" as const },
  ]),
);

function shuffled<T>(items: T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function createKanaRound(mode: KanaMode, random = Math.random): KanaQuestion[] {
  const pool = kanaCharacters.filter((item) => mode === "combined" || item.script === mode);
  // A combined round always includes both scripts.
  const selected = mode === "combined"
    ? shuffled([
        ...shuffled(pool.filter((item) => item.script === "hiragana"), random).slice(0, 5),
        ...shuffled(pool.filter((item) => item.script === "katakana"), random).slice(0, 5),
      ], random)
    : shuffled(pool, random).slice(0, 10);
  const readings = [...new Set(pool.map((item) => item.reading))];
  return selected.map((item) => ({
    ...item,
    options: shuffled([
      item.reading,
      ...shuffled(readings.filter((reading) => reading !== item.reading), random).slice(0, 3),
    ], random),
  }));
}
