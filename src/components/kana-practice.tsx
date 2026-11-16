"use client";

import { useState } from "react";
import { ArrowRight, CheckCircle2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createKanaRound, kanaRows, type KanaMode, type KanaQuestion } from "@/lib/kana";

const modes = [
  { value: "hiragana", label: "ฮิรางานะ · あいうえお" },
  { value: "katakana", label: "คาตาคานะ · アイウエオ" },
  { value: "combined", label: "รวมฮิรางานะและคาตาคานะ" },
];

export default function KanaPractice() {
  const [mode, setMode] = useState<KanaMode>("hiragana");
  const [selectedRows, setSelectedRows] = useState(() => kanaRows.map((row) => row.id));
  const [questions, setQuestions] = useState<KanaQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const question = questions[index];
  const finished = questions.length > 0 && index === questions.length;

  function start() {
    if (!selectedRows.length) return;
    setQuestions(createKanaRound(mode, selectedRows));
    setIndex(0);
    setAnswer(null);
    setScore(0);
  }
  function changeRows(rows: string[]) {
    setSelectedRows(rows);
    setQuestions([]);
    setIndex(0);
    setAnswer(null);
    setScore(0);
  }

  return (
    <>
      <div className="page-heading subpage-heading">
        <div>
          <span className="eyebrow">かな / ตัวอักษรญี่ปุ่น</span>
          <h1>ฝึกฮิรางานะและคาตาคานะ</h1>
          <p>ดูตัวอักษรแล้วเลือกเสียงอ่านโรมาจิ ฝึกครั้งละไม่เกิน 10 ข้อตามวรรคที่เลือก</p>
        </div>

      </div>
      <section className="panel kana-settings" aria-label="ตั้งค่าการฝึกตัวอักษร">
        <div className="select-field">
          <label htmlFor="kana-mode">ชุดตัวอักษร</label>
          <Select value={mode} items={modes} onValueChange={(value) => {
            if (!value) return;
            setMode(value as KanaMode);
            setQuestions([]);
            setIndex(0);
            setAnswer(null);
            setScore(0);
          }}>
            <SelectTrigger id="kana-mode"><SelectValue /></SelectTrigger>
            <SelectContent>
              {modes.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <fieldset className="kana-rows">
          <legend>เลือกวรรค</legend>
          <div className="kana-row-actions">
            <span>เลือกแล้ว {selectedRows.length} / {kanaRows.length} วรรค</span>
            <Button variant="ghost" onClick={() => changeRows(kanaRows.map((row) => row.id))}>เลือกทั้งหมด</Button>
            <Button variant="ghost" onClick={() => changeRows([])}>ล้างการเลือก</Button>
          </div>
          <div className="kana-row-grid">
            {kanaRows.map((row) => (
              <label key={row.id}>
                <input type="checkbox" checked={selectedRows.includes(row.id)}
                  onChange={(event) => changeRows(event.target.checked
                    ? [...selectedRows, row.id]
                    : selectedRows.filter((id) => id !== row.id))} />
                <span>
                  <span lang="ja">{mode === "hiragana" ? row.hiragana : mode === "katakana" ? row.katakana : `${row.hiragana} / ${row.katakana}`}</span>
                  <small>{row.readings}</small>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <p>เปลี่ยนชุดตัวอักษรหรือวรรคจะเริ่มรอบใหม่ โดยไม่สุ่มคำถามนอกวรรคที่เลือก</p>
        <p>ตัวอักษรพื้นฐานชุดละ 46 ตัว ยังไม่รวมเสียงขุ่น เสียงกึ่งขุ่น และเสียงควบ</p>
        <p>ใช้ shi, chi, tsu, fu และ wo สำหรับ を / ヲ ซึ่งเมื่อใช้เป็นคำช่วยจะออกเสียง o</p>
        {!selectedRows.length && <p role="status">เลือกอย่างน้อยหนึ่งวรรคเพื่อเริ่มฝึก</p>}
        <Button className="min-h-11" onClick={start} disabled={!selectedRows.length}>
          {questions.length ? "เริ่มรอบใหม่" : "เริ่มฝึก"} <RotateCcw size={16} />
        </Button>
      </section>
      {finished ? (
        <section className="quiz-result" aria-label="ผลการฝึกตัวอักษร">
          <h2>ผลการฝึกตัวอักษร</h2>
          <div className="quiz-score">{score}<span> / {questions.length}</span></div>
          <p>ตอบถูก {Math.round(score / questions.length * 100)}% · ฝึกซ้ำเพื่อจดจำตัวอักษรให้คล่องขึ้น</p>
          <Button className="min-h-11" onClick={start}>ฝึกอีกครั้ง <RotateCcw size={16} /></Button>
        </section>
      ) : question ? (
        <section className="quiz-panel" aria-label="แบบฝึกตัวอักษร">
          <div className="session-top">
            <span>เลือกเสียงอ่านที่ถูกต้อง</span>
            <span>{index + 1} / {questions.length}</span>
          </div>
          <div className="progress-track"><span style={{ transform: `scaleX(${index / questions.length})` }} /></div>
          <h2 className="kana-prompt" lang="ja">{question.character}</h2>
          <div className="quiz-options">
            {question.options.map((option, i) => (
              <button key={option} type="button" disabled={answer !== null}
                className={answer === null ? "" : option === question.reading ? "correct" : option === answer ? "incorrect" : ""}
                onClick={() => {
                  if (answer !== null) return;
                  if (option === question.reading) {
                    setScore((value) => value + 1);
                    setIndex((value) => value + 1);
                  } else setAnswer(option);
                }}>
                <span>{i + 1}</span>
                {option}
                {answer !== null && option === question.reading && <CheckCircle2 size={20} />}
              </button>
            ))}
          </div>
          {answer !== null && (
            <div className="answer-feedback practice-feedback">
              <strong role="status">คำตอบที่ถูกคือ {question.reading}</strong>
              <p><span lang="ja">{question.character}</span> อ่านว่า {question.reading}</p>
              <Button className="min-h-11" onClick={() => { setIndex((value) => value + 1); setAnswer(null); }}>
                {index + 1 === questions.length ? "ดูผลการฝึก" : "ข้อถัดไป"} <ArrowRight size={16} />
              </Button>
            </div>
          )}
        </section>
      ) : null}
    </>
  );
}
