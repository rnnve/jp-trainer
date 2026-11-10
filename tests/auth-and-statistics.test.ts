import {expect,test} from 'bun:test';
import {safeReturnTo,sameAppOrigin} from '../src/lib/auth-policy';
import {emptyProgress,type Progress} from '../src/lib/progress';
import {publicStatistics,refreshStatistics} from '../src/lib/public-statistics';

test('Clerk return destinations stay inside the trainer',()=>{
 expect(safeReturnTo('/hn/library?category=grammar')).toBe('/hn/library?category=grammar');
 for(const url of ['https://evil.example','//evil.example','/hn/\\evil.example','/hn/api/auth/signout','/hn/login','/hn/%2f%2fevil','/hnetwork',null])expect(safeReturnTo(url)).toBe('/hn/learn');
});
const progress:Progress={...emptyProgress,saved:['N5-v2'],completed:['N5-v1'],reviews:{'N5-v1':{due:99,interval:1,repetitions:1}},activity:[{date:'2026-11-06',kind:'lesson',id:'N5-v1'},{date:'2026-11-07',kind:'review',id:'N5-v1',correct:true},{date:'2026-11-07',kind:'quiz',id:'N5-v1',correct:true},{date:'2026-11-07',kind:'quiz',id:'N5-v2',correct:false}]};
test('public projection shares aggregate statistics but no raw answers, bookmarks, or review schedule',()=>{
 const stats=publicStatistics(progress,new Date('2026-11-07T10:00:00Z'));
 expect(stats.completed).toBe(1);expect(stats.accuracy).toBe(50);expect(stats.reviews).toBe(1);expect(stats.streak).toBe(2);expect(stats.today).toBe(3);
 expect(stats.byLevel.N5).toBe(1);expect(stats.week.at(-1)).toEqual({date:'2026-11-07',count:3});
 expect(Object.keys(stats)).not.toContain('activity');expect(Object.keys(stats)).not.toContain('saved');expect(JSON.stringify(stats)).not.toContain('N5-v1');expect(JSON.stringify(stats)).not.toContain('email');
});
test('streak and daily counts expire using Bangkok calendar days even when no new snapshot is published',()=>{
 const stats=publicStatistics(progress,new Date('2026-11-07T10:00:00Z'));
 const nextDay=refreshStatistics(stats,new Date('2026-11-07T17:01:00Z'));
 expect(nextDay.today).toBe(0);expect(nextDay.streak).toBe(2);expect(nextDay.week.at(-1)).toEqual({date:'2026-11-08',count:0});
 expect(refreshStatistics(stats,new Date('2026-11-08T17:01:00Z')).streak).toBe(0);
 const latePublication=publicStatistics({...progress,activity:[{date:'2026-11-06',kind:'lesson',id:'N5-v1'}]},new Date('2026-11-07T10:00:00Z'));
 expect(latePublication.streak).toBe(1);expect(refreshStatistics(latePublication,new Date('2026-11-08T10:00:00Z')).streak).toBe(0);
});

test('mutation origin uses canonical app URL behind proxies and requires the exact scheme, host and port',()=>{
 expect(sameAppOrigin('https://kotoba.example','https://kotoba.example')).toBe(true);
 expect(sameAppOrigin('http://localhost:3000','http://localhost:3000')).toBe(true);
 for(const origin of ['https://untrusted.example','http://kotoba.example','https://kotoba.example:444',null])expect(sameAppOrigin(origin,'https://kotoba.example')).toBe(false);
 expect(sameAppOrigin('http://localhost:3000','')).toBe(false);
});
