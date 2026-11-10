import { lessons, type Level } from './content';
export type Review = {due:number; interval:number; repetitions:number};
export type Activity = {date:string; kind:'lesson'|'review'|'quiz'; id:string; correct?:boolean};
export type Progress = {version:1;level:Level;goal:number;completed:string[];saved:string[];reviews:Record<string,Review>;activity:Activity[]};
export const emptyProgress:Progress = {version:1,level:'N5',goal:10,completed:[],saved:[],reviews:{},activity:[]};
export const STORAGE_KEY = 'kotoba.progress.v1';
export function localDate(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
export function scheduleReview(previous:Review|undefined, remembered:boolean, now=Date.now()):Review {
 const repetitions=remembered?(previous?.repetitions??0)+1:0;
 const interval=remembered?(repetitions===1?1:repetitions===2?3:Math.min(180,Math.round((previous?.interval??3)*2.2))):0;
 return {repetitions,interval,due:now+(remembered?interval*86400000:600000)};
}
export function parseProgress(value:unknown):Progress {
 if(!value || typeof value!=='object') throw Error('รูปแบบข้อมูลไม่ถูกต้อง');
 const p=value as Partial<Progress>;
 if(p.version!==1 || !['N5','N4','N3','N2','N1'].includes(p.level??'') || !Number.isInteger(p.goal) || p.goal!<1 || p.goal!>100) throw Error('ข้อมูลระดับหรือเป้าหมายไม่ถูกต้อง');
 const validIds = new Set(lessons.map(x=>x.id));
 if(!Array.isArray(p.completed)||!Array.isArray(p.saved)||![...p.completed,...p.saved].every(id=>typeof id==='string'&&validIds.has(id))) throw Error('ข้อมูลบทเรียนไม่ถูกต้อง');
 if(!p.reviews||typeof p.reviews!=='object'||Array.isArray(p.reviews)||!Object.entries(p.reviews).every(([id,r])=>validIds.has(id)&&r&&[r.due,r.interval,r.repetitions].every(v=>typeof v==='number'&&Number.isFinite(v)&&v>=0))) throw Error('ข้อมูลทบทวนไม่ถูกต้อง');
 if(!Array.isArray(p.activity)||!p.activity.every(a=>a&&/^\d{4}-\d{2}-\d{2}$/.test(a.date)&&['lesson','review','quiz'].includes(a.kind)&&validIds.has(a.id)&&(a.correct===undefined||typeof a.correct==='boolean'))) throw Error('ข้อมูลกิจกรรมไม่ถูกต้อง');
 return {version:1,level:p.level!,goal:p.goal!,completed:[...new Set(p.completed)],saved:[...new Set(p.saved)],reviews:p.reviews,activity:p.activity};
}
export function streak(activity:Activity[], now=new Date()) {
 const days=new Set(activity.map(a=>a.date));const d=new Date(now);let count=0;
 if(!days.has(localDate(d)))d.setDate(d.getDate()-1);
 while(days.has(localDate(d))){count++;d.setDate(d.getDate()-1);}return count;
}
