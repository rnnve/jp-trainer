# Kotoba · ことば

เรียนภาษาญี่ปุ่นได้ทุกคน ทั้งแบบผู้เยี่ยมชมและบัญชี **Clerk** ไม่มี owner allowlist อีกต่อไป

Next.js App Router · React · TypeScript · Tailwind CSS 4 · Bun · Material 3 Expressive (`@m3e/web`) · Clerk · Upstash Redis

## เริ่มต้นแบบไม่ต้องมีบัญชี

```sh
bun install --frozen-lockfile
bun run dev
```

เปิด http://localhost:3000/hn/learn เรียนได้ทันทีโดยไม่ต้องมี Clerk keys ความก้าวหน้าเดิมแบบ local ยังคงอ่านจาก `kotoba.progress.v1`

ถ้า port 3000 มีโปรเจกต์อื่นใช้อยู่ ให้รัน `bun run dev --port 3002` และตั้ง `APP_URL` / `CLERK_AUTHORIZED_PARTIES` ให้ตรงกับ port นั้น (dev server ในรอบงานนี้เปิดค้างไว้ที่ http://localhost:3002)

`/` แสดงภาพรวมคลังเนื้อหาสาธารณะ ไม่มีการเผยแพร่ความก้าวหน้าของผู้เรียน

```sh
bun test
bun run typecheck
bun run build
bun run test:access
bun run start
```

`test:access` เปิด production server ชั่วคราวที่ port 3101 เพื่อตรวจ guest access และ unauthenticated APIs ไม่สร้างบัญชีทดสอบภายนอกและไม่แก้ `.env.local`

## ตั้งค่าบัญชี Clerk

1. สร้างแอปใน [Clerk Dashboard](https://dashboard.clerk.com) แล้วเลือกวิธีเข้าสู่ระบบที่ต้องการ (อีเมล, GitHub, Google ฯลฯ ตามที่เปิดใน Clerk)
2. คัดลอก `.env.example` เป็น `.env.local` เฉพาะกรณียังไม่มีไฟล์นี้ แล้วตั้ง:
   - `APP_URL`: origin ของแอป เช่น `http://localhost:3000`
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`: publishable key ของ Clerk
   - `CLERK_SECRET_KEY`: secret key ฝั่ง server ห้ามใส่ในตัวแปร `NEXT_PUBLIC_*`
   - `CLERK_AUTHORIZED_PARTIES`: frontend origins ที่อนุญาต คั่นด้วย comma เช่น `http://localhost:3000,https://YOUR_DOMAIN`
3. ตั้ง `UPSTASH_REDIS_REST_URL` และ `UPSTASH_REDIS_REST_TOKEN` สำหรับข้อมูลบัญชีถาวรบน Vercel
4. Restart dev server; production ต้อง rebuild หลังเปลี่ยน `NEXT_PUBLIC_*`

Auth.js, owner GitHub ID, Client ID/Secret เดิม และ owner-only callbacks ถูกถอดออกแล้ว Clerk จัดการ sign-in, sign-up, sign-out และโปรไฟล์ผ่าน UI ของ Clerk

- `/hn/login` — เข้าสู่ระบบด้วย Clerk
- `/hn/register` — สร้างบัญชีด้วย Clerk
- ทุกหน้าฝึกยังเปิดให้ guest แม้ตั้งค่า Clerk ไม่ครบ หน้า login มีทางเลือกเรียนต่อโดยไม่สมัคร
- `src/proxy.ts` เรียก `clerkMiddleware()` เพื่ออ่าน session โดยไม่ protect หน้าฝึก ตรวจสิทธิ์จริงที่ account API
- Account API ยอมรับ Clerk **session tokens** หรือ API key ที่สร้างจากบัญชี ไม่ยอมรับ user ID จาก query, body หรือ custom header เป็นหลักฐานยืนยันตัวตน

อ้างอิง [Clerk Next.js quickstart](https://clerk.com/docs/nextjs/getting-started/quickstart), [middleware](https://clerk.com/docs/reference/nextjs/clerk-middleware), [route handlers](https://clerk.com/docs/reference/nextjs/app-router/route-handlers)

## การเก็บความก้าวหน้า

### ผู้เยี่ยมชม

ความก้าวหน้าบันทึกใน localStorage ของเบราว์เซอร์ปัจจุบัน ไม่เรียก account API และไม่ส่งไปยังคลังข้อมูลสาธารณะ ส่งออก/นำเข้า JSON ได้ที่ `/hn/settings`

### ผู้ใช้บัญชี

- โหลดและบันทึกข้อมูลผ่าน `/api/v1/me/progress` โดย key ผูกกับ Clerk user ID ที่ server ตรวจแล้ว
- แต่ละบัญชีมี browser cache ของตัวเอง แยกจาก guest และบัญชีอื่น
- มี local cache สำหรับข้อมูลที่ยังซิงก์ไม่ได้ เมื่อเชื่อมต่อกลับให้ลองซิงก์อีกครั้ง
- ไม่โอนความก้าวหน้า guest เข้า account โดยอัตโนมัติ ผู้ใช้กด “นำเข้าความก้าวหน้าผู้เยี่ยมชม” ที่ settings เมื่อต้องการ **แทนที่** ความก้าวหน้าบัญชีด้วยข้อมูล guest
- ข้อมูล guest ยังคงอยู่เมื่อเข้าสู่ระบบหรือออกจากระบบ
- ใช้ revision/ETag และ atomic compare-and-set ป้องกันอีกอุปกรณ์เขียนทับข้อมูลใหม่ หาก conflict จะหยุดซิงก์และให้เลือกส่งออก local changes หรือโหลดข้อมูลจากบัญชี
- ปุ่ม “ใช้ข้อมูลบัญชีแทนข้อมูลในเครื่อง” ในกรณี conflict ทิ้ง local changes ของบัญชีนั้น ผู้ใช้ควรส่งออกก่อนถ้าต้องการเก็บทั้งสองชุด
- Dev ใช้ไฟล์แยกบัญชีใน `.data/accounts/` (hash ของ user ID; directory ถูก ignore)
- Production ใช้ Redis เท่านั้น ถ้ายังไม่ตั้ง storage API จะคืน 503 และหน้าเรียนยังรักษา local cache ไว้ ไม่แกล้งรายงานว่าซิงก์สำเร็จ

ไม่มีการแชร์คำตอบ, bookmarks, review schedule, อีเมล หรือข้อมูลบัญชีไปยัง public stats เก่า `/hn/api/statistics` หยุดรับการเขียนแล้ว (410)

## เส้นทางหน้าเรียน

`/hn` → `/hn/learn`; ทุกหน้าต่อไปนี้ไม่ต้องล็อกอิน:

- `/hn/learn`, `/hn/library`, `/hn/flashcards`
- `/hn/practice`, `/hn/conversations`, `/hn/statistics`
- `/hn/books`, `/hn/settings`, `/hn/api`

เส้นทางเดิม เช่น `/learn` redirect ไป `/hn/learn`; `/statistics` redirect ไป `/`

## Account API: ข้อมูลของบัญชีที่ยืนยันตัวตน

ทุก endpoint คืน JSON ที่มี `Cache-Control: private, no-store` และไม่เปิด public CORS

| Endpoint | ข้อมูล |
| --- | --- |
| `GET /api/v1/me` | โปรไฟล์ whitelist: ID, username, first/last name, primary email, image URL, created date ไม่มี Clerk metadata หรือ tokens |
| `GET /api/v1/me/progress` | `{ data, revision, updatedAt }` และ `ETag`; `data: null` เมื่อบัญชียังไม่บันทึก |
| `PUT /api/v1/me/progress` | แทนที่ความก้าวหน้าของบัญชีที่ยืนยันแล้วเท่านั้น พร้อม optimistic concurrency |
| `GET /api/v1/me/statistics` | สถิติการเรียนส่วนตัวจากข้อมูลบัญชี |
| `GET /api/v1/me/export` | ดาวน์โหลด JSON รวม profile, progress, statistics และ revision |

ใน browser ที่ลงชื่อเข้าใช้แล้ว ใช้ session cookie อัตโนมัติ:

```ts
const response = await fetch('/api/v1/me/progress');
if (!response.ok) throw new Error(`Account API: ${response.status}`);
const { data, revision } = await response.json();
```

สำหรับ script หรือระบบภายนอก แนะนำ API key ด้านล่าง หรือใช้ **Clerk session token ของผู้ใช้** (เช่น `await getToken()` จาก `useAuth()` ในแอปที่ลงชื่อเข้าใช้แล้ว) ไม่ใช่ Clerk secret key:

```sh
curl -H "Authorization: Bearer $CLERK_SESSION_TOKEN" \
  https://YOUR_DOMAIN/api/v1/me/export
```

Session tokens มีอายุจำกัด ขอ token ใหม่จาก session ที่ยังใช้งานได้เมื่อจำเป็น ไม่เก็บ token ลง repository หรือ URL

### บันทึกผ่าน API

1. `GET /api/v1/me/progress` เพื่อรับ `ETag` เช่น `"3"` (บัญชีใหม่ `"0"`)
2. ส่ง progress schema version 1 เป็น JSON body พร้อม `If-Match: "3"`
3. server เพิ่ม revision และคืน ETag ใหม่

```ts
const current = await fetch('/api/v1/me/progress');
const etag = current.headers.get('ETag');
const result = await fetch('/api/v1/me/progress', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json', 'If-Match': etag! },
  body: JSON.stringify(progress),
});
```

Cookie-based PUT ต้องมี Origin ที่ตรงกับ `APP_URL`; authenticated Bearer / X-API-Key clients อาจไม่มี Origin แต่ถ้าส่งมาต้องตรงเช่นกัน

HTTP status: 401 ไม่ได้เข้าสู่ระบบ, 403 Origin ไม่ถูกต้องหรือคีย์ไม่มีสิทธิ์เขียน, 400 JSON/schema ไม่ถูกต้อง, 409 revision เก่า, 413 body เกิน 5 MB, 428 ไม่มี If-Match, 503 auth/storage ไม่พร้อม

## API keys และการหมุนเวียน

เข้าสู่ระบบด้วย Clerk แล้วเปิด `/hn/api` เพื่อสร้าง หมุนเวียน หรือยกเลิกคีย์ ระบบแสดง secret เต็มเฉพาะตอนสร้างและหมุนเวียน เก็บ secret ในที่ปลอดภัยก่อนปิดข้อความ ไม่มีการเก็บคีย์ใน localStorage

- คีย์ผูกกับบัญชีผู้สร้างและใช้กับ personal endpoints ในตารางด้านบนเท่านั้น ไม่ใช้ user ID จากผู้เรียก
- `read` (ค่าเริ่มต้น): อ่านโปรไฟล์ ความก้าวหน้า สถิติ และ export
- `read-write`: อ่านและบันทึกความก้าวหน้าด้วย PUT; ยังต้องส่ง `If-Match` ของ progress
- อายุเริ่มต้น 90 วัน ตั้งได้ 1–365 วัน; UI มี 30/90/365 วัน สูงสุด 10 คีย์ที่ยังใช้งานต่อบัญชี
- ส่ง `Authorization: Bearer <key>` หรือ `X-API-Key: <key>` อย่างใดอย่างหนึ่ง ห้ามส่งทั้งสอง header พร้อมกัน
- คีย์ผิด หมดอายุ หรือยกเลิกแล้ว ไม่สามารถใช้ session cookie เพื่อข้ามการตรวจคีย์ได้ ตรวจสถานะบัญชี Clerk ด้วย และปฏิเสธบัญชีที่ถูกลบ แบน หรือล็อก
- เก็บเฉพาะ SHA-256 ของ secret ที่สุ่ม 256 บิต ตรวจด้วย constant-time comparison; metadata และ key ID ไม่ใช่ secret
- Production ใช้ Upstash Redis ตามตัวแปรเดิม; dev เก็บ hash ใน `.data/api-keys.json` ซึ่งถูก ignore ห้ามใช้ไฟล์ dev เป็น storage บน Vercel

```sh
curl -H "Authorization: Bearer $KOTOBA_API_KEY" \
  https://YOUR_DOMAIN/api/v1/me/export

# หรือ
curl -H "X-API-Key: $KOTOBA_API_KEY" \
  https://YOUR_DOMAIN/api/v1/me/statistics
```

การจัดการคีย์ต้องใช้ **Clerk session เท่านั้น** API key ไม่สามารถ list, สร้าง, ยกเลิก หรือหมุนเวียนคีย์ใดได้ ทุก response เป็น private/no-store และไม่มี public CORS

| Endpoint | Request / Response |
| --- | --- |
| `GET /api/v1/me/api-keys` | `{ data: metadata[] }`; ไม่มี secret หรือ hash |
| `POST /api/v1/me/api-keys` | JSON `{ name, scope?: "read" \| "read-write", expiresInDays?: 90 }`; 201 `{ data: metadata, key: secret }` |
| `DELETE /api/v1/me/api-keys/:id` | ยกเลิกทันที; ทำซ้ำได้สำหรับคีย์ของตนเอง |
| `POST /api/v1/me/api-keys/:id/rotate` | ส่ง `If-Match: "<version>"` จาก metadata; `{ data: metadata, key: newSecret }` |

การหมุนเวียนคง ID ชื่อ สิทธิ์ และวันหมดอายุเดิม เปลี่ยน secret และเพิ่ม version แบบ atomic คีย์เก่าจะไม่ผ่านการยืนยันครั้งถัดไป ไม่มีช่วงใช้สอง secret พร้อมกัน คำขอที่ยืนยันตัวตนไปแล้วก่อนหมุนเวียนอาจยังทำงานจนจบ คีย์หมดอายุหรือถูกยกเลิกต้องสร้างใหม่

```sh
# ใช้ Clerk session token สำหรับจัดการคีย์
curl -X POST -H "Authorization: Bearer $CLERK_SESSION_TOKEN" \
  -H 'If-Match: "1"' \
  "https://YOUR_DOMAIN/api/v1/me/api-keys/$KEY_ID/rotate"
```

หากหมุนเวียนพร้อมกัน จะสำเร็จเพียงคำขอเดียว อีกคำขอได้ 409 ให้โหลด metadata ใหม่ ขาด `If-Match` ได้ 428 หากไม่ได้รับ secret จาก response (เช่น network ขาด) ให้โหลด version ใหม่แล้วหมุนเวียนอีกครั้ง หรือยกเลิกและสร้างคีย์ใหม่ คีย์ของบัญชีอื่นคืน 404; storage/auth ไม่พร้อมคืน 503 และไม่อนุญาตให้ผ่าน

## Public API

- `GET /api/v1/content`: `level=N5…N1`, `category=vocabulary|grammar|kanji|conversation`, `q`, `limit`, `offset`
- `GET /api/v1/stats`: สถิติ **คลังเนื้อหาเท่านั้น** ไม่มีข้อมูลการเรียนของบัญชีใด
- `GET /api/v1/books`: แหล่งอ้างอิงและสถานะ ISBN
- `GET /api/v1/export?format=json|csv`: ดาวน์โหลดบทเรียน

Public endpoints อ่านอย่างเดียว และเปิด CORS `*` โดยไม่ส่ง credentials

## เนื้อหาและ PWA

มีบทเรียนต้นฉบับเริ่มต้น 50 รายการ ครบ N5–N1: คำศัพท์ 25, ไวยากรณ์ 10, คันจิ 10, บทสนทนา 5 พร้อม flashcards แบบเว้นระยะ แบบฝึกหัดพร้อมเฉลย และ Web Speech API (`ja-JP`)

นี่เป็นชุดเริ่มต้น ไม่ใช่หลักสูตร JLPT ฉบับสมบูรณ์ ยังไม่ได้นำเข้าเนื้อหาหรือเสียงจากหนังสือ:

- `9789744436955` อะกิโกะโตะโทะโมะดะจิ 1 ฉบับปรับปรุง ([TPA Book](https://tpabook.com/product/akiko-to-tomodachi-1/))
- `9789749569412` มินนะ โนะ นิฮงโกะ 1 (ผู้ใช้ยืนยัน)

PWA ติดตั้งผ่าน browser หรือ settings ได้ ใช้ HTTPS/localhost ใน production; cache เฉพาะ static assets และหน้า offline ไม่ cache หน้า `/hn`, RSC หรือ account APIs การเปิดบทเรียนครั้งใหม่และซิงก์บัญชีต้องออนไลน์ ความก้าวหน้า local ยังคงอยู่เมื่อ network มีปัญหา

Dev ใช้ cleanup worker เพื่อเลี่ยง cache เก่ารบกวน Hot Reload; ฟอนต์มี system fallback

## Deploy บน Vercel

Framework Next.js, install `bun install --frozen-lockfile`, build `bun run build` ตั้ง Clerk keys, `APP_URL`, authorized parties และ Redis keys ตาม `.env.example` ห้าม deploy `.env.local` หรือ `.data`

## โครงสร้าง

```text
src/proxy.ts                       Clerk session middleware, public trainer
src/components/account-session.tsx Guest/account context and Clerk controls
src/hooks/use-learner-progress.ts   Separate local progress and account sync
src/lib/account-session.ts         Verified Clerk identity + profile whitelist
src/lib/account-api.ts             Protected per-user API handlers
src/lib/account-principal.ts       Clerk session / scoped API key verification
src/lib/api-key-crypto.ts          Token generation, hashing, public metadata
src/lib/api-key-store.ts           Atomic create/rotate/revoke in Redis/dev file
src/lib/api-key-api.ts             Clerk-only key management
src/components/api-key-manager.tsx One-time secret display and key controls
src/lib/account-store.ts           Namespaced Redis/dev files + revision CAS
src/lib/learner-cache.ts            Separate guest/account browser keys
src/app/api/v1/me/                  Personal APIs
src/app/hn/(trainer)/               Public learning screens
```

โค้ด MIT; บทเรียนต้นฉบับ CC0 ดู [LICENSE](LICENSE), [CONTENT-LICENSE.md](CONTENT-LICENSE.md), [CONTRIBUTING.md](CONTRIBUTING.md)
