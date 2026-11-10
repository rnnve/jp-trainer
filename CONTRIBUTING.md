# ร่วมพัฒนา Kotoba

ยินดีรับบทเรียน คำแปล การแก้ภาษาญี่ปุ่น การปรับ accessibility และโค้ด

1. ติดตั้ง Bun และรัน `bun install --frozen-lockfile`
2. เพิ่มบทเรียนที่ `src/lib/content.ts` โดยใช้ ID ไม่ซ้ำ ระบุระดับ ประเภท คำอ่าน ความหมาย และตัวอย่างพร้อมคำแปล
3. เขียนเนื้อหาใหม่ด้วยตัวเอง และตรวจความถูกต้องกับผู้รู้ภาษาญี่ปุ่น ระดับ JLPT เป็นการจัดกลุ่มของโครงการ จึงควรอธิบายที่มาหากเปลี่ยนระดับ
4. ไม่คัดลอกบทเรียน แบบฝึกหัด หรือเสียงจากหนังสือโดยไม่มีสิทธิ์เผยแพร่ เพิ่ม provenance และ license ให้ชัดเจนเมื่อเพิ่มแหล่งข้อมูล
5. รัน `bun test`, `bun run typecheck`, `bun run build` และตรวจจอมือถือ/คีย์บอร์ดก่อนส่ง pull request

การส่งโค้ดถือว่ายอมให้ใช้ภายใต้ MIT; เนื้อหาบทเรียนใหม่ใช้ CC0 ตาม CONTENT-LICENSE.md

โหมด guest ไม่ต้องใช้ auth และเก็บข้อมูลใน browser ส่วนบัญชีใช้ Clerk และ storage แยกตาม user ID ที่ตรวจฝั่ง server ห้ามเชื่อ user ID จาก request body/query ห้ามเปิด raw progress, bookmarks, tokens หรือ account metadata ผ่าน public API เพิ่มการทดสอบ account isolation และ revision conflicts เมื่อแก้ API/sync
