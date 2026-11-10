import { describe, expect, test } from 'bun:test';
import { lessons, levels, books, contentStats } from '../src/lib/content';
import { emptyProgress, localDate, parseProgress, scheduleReview, streak } from '../src/lib/progress';
import { GET as contentGET } from '../src/app/api/v1/content/route';
import { GET as exportGET } from '../src/app/api/v1/export/route';

describe('content integrity',()=>{
 test('all five levels have every learning category and unique IDs',()=>{expect(new Set(lessons.map(l=>l.id)).size).toBe(lessons.length);for(const level of levels){for(const category of ['vocabulary','grammar','kanji','conversation'])expect(lessons.some(l=>l.level===level&&l.category===category)).toBe(true);}expect(contentStats().total).toBe(50);});
 test('book provenance remains explicit',()=>{expect(books[0].status).toBe('metadata-verified');expect(books[1].status).toBe('user-confirmed');expect(books[1].title).toBe('มินนะ โนะ นิฮงโกะ 1');});
});
describe('spaced repetition and progress',()=>{
 test('remembered cards advance and forgotten cards return in ten minutes',()=>{const first=scheduleReview(undefined,true,0);expect(first).toEqual({interval:1,repetitions:1,due:86400000});const second=scheduleReview(first,true,0);expect(second.interval).toBe(3);expect(scheduleReview(second,true,0).interval).toBe(7);expect(scheduleReview(second,false,0)).toEqual({interval:0,repetitions:0,due:600000});});
 test('import accepts a valid export and rejects malformed data',()=>{expect(parseProgress(JSON.parse(JSON.stringify(emptyProgress)))).toEqual(emptyProgress);expect(()=>parseProgress({...emptyProgress,goal:-1})).toThrow();expect(()=>parseProgress({...emptyProgress,completed:['unknown']})).toThrow();expect(()=>parseProgress({...emptyProgress,reviews:{'N5-v1':{due:'x'}}})).toThrow();expect(()=>parseProgress({...emptyProgress,activity:[{date:'bad',id:'N5-v1',kind:'review'}]})).toThrow();});
 test('streak handles today, yesterday, and a gap using local calendar days',()=>{const today=new Date(2026,10,7,12);const activity=[{date:'2026-11-05',kind:'lesson' as const,id:'N5-v1'},{date:'2026-11-06',kind:'lesson' as const,id:'N5-v2'}];expect(streak(activity,today)).toBe(2);expect(streak([...activity,{date:'2026-11-07',kind:'review',id:'N5-v1'}],today)).toBe(3);expect(streak([{date:'2026-11-04',kind:'lesson',id:'N5-v1'}],today)).toBe(0);expect(localDate(today)).toBe('2026-11-07');});
});
describe('public API',()=>{
 test('filters, searches, and paginates',async()=>{const response=contentGET(new Request('http://localhost/api/v1/content?level=N4&category=vocabulary&limit=2&offset=1'));const body=await response.json();expect(body.total).toBe(5);expect(body.data).toHaveLength(2);expect(body.data.every((l:{level:string;category:string})=>l.level==='N4'&&l.category==='vocabulary')).toBe(true);const search=await contentGET(new Request('http://localhost/api/v1/content?q=学校')).json();expect(search.total).toBeGreaterThan(0);});
 test('rejects invalid filters and pagination',()=>{for(const query of ['level=N0','category=bad','limit=abc','offset=-1','category=constructor'])expect(contentGET(new Request(`http://localhost/api/v1/content?${query}`)).status).toBe(400);});
 test('exports UTF-8 CSV and structured JSON',async()=>{const csv=exportGET(new Request('http://localhost/api/v1/export?format=csv'));expect(csv.headers.get('content-type')).toContain('text/csv');expect((await csv.text()).split('\r\n')).toHaveLength(51);const json=await exportGET(new Request('http://localhost/api/v1/export')).json();expect(json.data).toHaveLength(50);expect(exportGET(new Request('http://localhost/api/v1/export?format=exe')).status).toBe(400);});
});
