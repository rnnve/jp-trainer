"use client";
import { useEffect, useState } from "react";
import { Copy, KeyRound, RotateCcw, Trash2, X } from "lucide-react";
import { AccountControls, useLearnerSession } from "./account-session";
import type { ApiKeyMetadata } from "@/lib/api-key-crypto";
export default function ApiKeyManager() {
  const session = useLearnerSession();
  if (!session.ready)
    return (
      <section className="panel api-key-panel">
        <p role="status">กำลังโหลดบัญชี</p>
      </section>
    );
  if (!session.userId)
    return (
      <section className="panel api-key-panel">
        <h2>API keys ของฉัน</h2>
        <p>
          เข้าสู่ระบบด้วย Clerk
          เพื่อสร้างคีย์สำหรับเรียกข้อมูลบัญชีจากโปรแกรมภายนอก
        </p>
        <AccountControls />
      </section>
    );
  return <SignedInKeys key={session.userId} />;
}
function SignedInKeys() {
  const [keys, setKeys] = useState<ApiKeyMetadata[]>([]),
    [name, setName] = useState(""),
    [scope, setScope] = useState<"read" | "read-write">("read"),
    [days, setDays] = useState(90),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [message, setMessage] = useState(""),
    [issued, setIssued] = useState<{
      data: ApiKeyMetadata;
      key: string;
    } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/v1/me/api-keys", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw Error(result.error ?? "ไม่สามารถโหลดคีย์ได้");
        setKeys(result.data);
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setMessage(
            error instanceof Error ? error.message : "ไม่สามารถโหลดคีย์ได้",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);
  async function operate(
    operation: "create" | "rotate" | "revoke",
    key?: ApiKeyMetadata,
  ) {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const path =
        "/api/v1/me/api-keys" +
        (key ? "/" + key.id : "") +
        (operation === "rotate" ? "/rotate" : "");
      const response = await fetch(path, {
        method: operation === "revoke" ? "DELETE" : "POST",
        headers: {
          "Content-Type": "application/json",
          ...(operation === "rotate"
            ? { "If-Match": `"${key!.version}"` }
            : {}),
        },
        body:
          operation === "create"
            ? JSON.stringify({ name, scope, expiresInDays: days })
            : undefined,
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error ?? "ไม่สามารถจัดการคีย์ได้");
      if (operation === "revoke") {
        setKeys((current) =>
          current.map((item) =>
            item.id === key!.id
              ? { ...item, revokedAt: new Date().toISOString() }
              : item,
          ),
        );
        setIssued((current) => (current?.data.id === key!.id ? null : current));
        setMessage("ยกเลิกคีย์แล้ว");
      } else {
        setIssued(result);
        setKeys((current) =>
          operation === "create"
            ? [...current, result.data]
            : current.map((item) => (item.id === key!.id ? result.data : item)),
        );
        if (operation === "create") setName("");
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "ไม่สามารถจัดการคีย์ได้",
      );
    } finally {
      setBusy(false);
    }
  }
  const date = (value: string) =>
    new Intl.DateTimeFormat("th-TH", { dateStyle: "medium" }).format(
      new Date(value),
    );
  return (
    <section className="panel api-key-panel">
      <div className="section-heading">
        <div>
          <h2>API keys ของฉัน</h2>
          <p>
            สร้างคีย์ได้สูงสุด 10 คีย์ที่ยังใช้งานอยู่ เก็บเฉพาะ hash
            ฝั่งเซิร์ฟเวอร์
          </p>
        </div>
        <KeyRound />
      </div>
      <form
        className="api-key-form"
        onSubmit={(event) => {
          event.preventDefault();
          void operate("create");
        }}
      >
        <label>
          ชื่อคีย์
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={64}
            placeholder="เช่น Personal script"
            required
            autoComplete="off"
          />
        </label>
        <label>
          สิทธิ์
          <select
            value={scope}
            onChange={(event) =>
              setScope(event.target.value as "read" | "read-write")
            }
          >
            <option value="read">อ่านข้อมูลเท่านั้น</option>
            <option value="read-write">อ่านและบันทึกความก้าวหน้า</option>
          </select>
        </label>
        <label>
          หมดอายุ
          <select
            value={days}
            onChange={(event) => setDays(Number(event.target.value))}
          >
            <option value={30}>30 วัน</option>
            <option value={90}>90 วัน</option>
            <option value={365}>365 วัน</option>
          </select>
        </label>
        <button
          className="fallback"
          type="submit"
          disabled={busy || loading || !name.trim()}
        >
          สร้าง API key
        </button>
      </form>
      {issued && (
        <div className="issued-api-key" role="status">
          <div>
            <strong>
              {issued.data.version > 1
                ? "หมุนเวียนคีย์แล้ว คีย์เดิมใช้ไม่ได้ทันที"
                : "สร้างคีย์แล้ว"}
            </strong>
            <button
              className="icon-button"
              aria-label="ซ่อนคีย์"
              onClick={() => setIssued(null)}
            >
              <X />
            </button>
          </div>
          <p>
            คัดลอกก่อนปิดข้อความนี้ ระบบจะแสดงคีย์เต็มเฉพาะตอนสร้างหรือหมุนเวียน
          </p>
          <div className="api-key-secret">
            <input
              aria-label="API key ที่สร้างแล้ว"
              value={issued.key}
              readOnly
              autoComplete="off"
              spellCheck={false}
              onFocus={(event) => event.target.select()}
            />
            <button
              className="icon-button"
              aria-label="คัดลอก API key"
              onClick={() => {
                void navigator.clipboard
                  .writeText(issued.key)
                  .then(() => setMessage("คัดลอกคีย์แล้ว"))
                  .catch(() => setMessage("กรุณาเลือกคีย์และคัดลอกด้วยตนเอง"));
              }}
            >
              <Copy />
            </button>
          </div>
        </div>
      )}
      {message && (
        <p className="api-key-message" role="status">
          {message}
        </p>
      )}
      {loading ? (
        <p role="status">กำลังโหลดคีย์</p>
      ) : keys.length === 0 ? (
        <p className="support-note">ยังไม่มี API key</p>
      ) : (
        <div className="api-key-list">
          {keys.map((key) => {
            const active =
              !key.revokedAt && Date.parse(key.expiresAt) > Date.now();
            return (
              <article key={key.id} className="api-key-row">
                <div>
                  <strong>{key.name}</strong>
                  <code>{key.prefix}</code>
                  <p>
                    {key.scope === "read" ? "อ่านอย่างเดียว" : "อ่านและบันทึก"}{" "}
                    · เวอร์ชัน {key.version} · หมดอายุ {date(key.expiresAt)}
                  </p>
                  {key.rotatedAt && (
                    <p>หมุนเวียนล่าสุด {date(key.rotatedAt)}</p>
                  )}
                  {!active && (
                    <span className="small-label">
                      {key.revokedAt ? "ยกเลิกแล้ว" : "หมดอายุแล้ว"}
                    </span>
                  )}
                </div>
                <div className="api-key-actions">
                  <button
                    className="icon-button"
                    aria-label={`หมุนเวียนคีย์ ${key.name}`}
                    disabled={busy || !active}
                    onClick={() => void operate("rotate", key)}
                  >
                    <RotateCcw />
                  </button>
                  <button
                    className="icon-button"
                    aria-label={`ยกเลิกคีย์ ${key.name}`}
                    disabled={busy || !active}
                    onClick={() => void operate("revoke", key)}
                  >
                    <Trash2 />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
      <p className="support-note">
        การหมุนเวียนเปลี่ยนเฉพาะ secret และยกเลิก secret เดิมทันที
        โดยคงสิทธิ์และวันหมดอายุเดิม คีย์ไม่สามารถจัดการคีย์อื่นได้
      </p>
      <pre>
        <code>
          {
            'curl -H "Authorization: Bearer $KOTOBA_API_KEY" https://YOUR_DOMAIN/api/v1/me/export'
          }
        </code>
      </pre>
    </section>
  );
}
