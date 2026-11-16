import { describe, expect, test } from "bun:test";
import { kanaCharacters, createKanaRound, type KanaMode } from "../src/lib/kana";

describe("kana practice", () => {
  test("contains the 46 basic characters for each script with consistent readings", () => {
    for (const script of ["hiragana", "katakana"] as const) {
      const characters = kanaCharacters.filter((item) => item.script === script);
      expect(characters).toHaveLength(46);
      expect(new Set(characters.map((item) => item.character)).size).toBe(46);
      expect(new Set(characters.map((item) => item.reading)).size).toBe(46);
    }
    for (const [character, reading] of [["し", "shi"], ["チ", "chi"], ["つ", "tsu"], ["フ", "fu"], ["を", "wo"], ["ン", "n"]]) {
      expect(kanaCharacters.find((item) => item.character === character)?.reading).toBe(reading);
    }
  });
  for (const mode of ["hiragana", "katakana", "combined"] as KanaMode[]) {
    test(`${mode} rounds contain ten distinct questions and unambiguous choices`, () => {
      const round = createKanaRound(mode, () => 0.37);
      expect(round).toHaveLength(10);
      expect(new Set(round.map((item) => item.character)).size).toBe(10);
      if (mode === "combined") {
        expect(round.filter((item) => item.script === "hiragana")).toHaveLength(5);
        expect(round.filter((item) => item.script === "katakana")).toHaveLength(5);
      } else expect(round.every((item) => item.script === mode)).toBe(true);
      for (const question of round) {
        expect(question.options).toHaveLength(4);
        expect(new Set(question.options).size).toBe(4);
        expect(question.options.filter((option) => option === question.reading)).toHaveLength(1);
      }
    });
  }
});
