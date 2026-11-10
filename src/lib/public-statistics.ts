import {lessons,levels} from './content';
import {localDate,streak,type Progress} from './progress';
export type LearningStatistics={completed:number;reviews:number;quizAnswers:number;quizCorrect:number;accuracy:number|null;streak:number;level:string;goal:number;today:number;byLevel:Record<string,number>;week:{date:string;count:number}[];updatedAt:string;lastActivityDate:string|null};
export function publicStatistics(progress:Progress,now=new Date()):LearningStatistics{
 const dateKey=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 const calendar=new Date(dateKey+'T12:00:00');
 const quiz=progress.activity.filter(a=>a.kind==='quiz');const correct=quiz.filter(a=>a.correct).length;
 return {lastActivityDate:progress.activity.map(a=>a.date).filter(date=>date<=dateKey).sort().at(-1)??null,completed:progress.completed.length,reviews:progress.activity.filter(a=>a.kind==='review').length,quizAnswers:quiz.length,quizCorrect:correct,accuracy:quiz.length?Math.round(correct/quiz.length*100):null,streak:streak(progress.activity,calendar),level:progress.level,goal:progress.goal,today:progress.activity.filter(a=>a.date===dateKey).length,byLevel:Object.fromEntries(levels.map(level=>[level,lessons.filter(l=>l.level===level&&progress.completed.includes(l.id)).length])),week:Array.from({length:7},(_,i)=>{const day=new Date(calendar);day.setDate(day.getDate()-6+i);const date=localDate(day);return {date,count:progress.activity.filter(a=>a.date===date).length};}),updatedAt:now.toISOString()};
}

export function refreshStatistics(snapshot:LearningStatistics,now=new Date()):LearningStatistics{
 const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 const today=new Date(date+'T12:00:00');const previous=new Date(today);previous.setDate(previous.getDate()-1);
 return {...snapshot,today:snapshot.week.find(w=>w.date===date)?.count??0,streak:snapshot.lastActivityDate===date||snapshot.lastActivityDate===localDate(previous)?snapshot.streak:0,week:Array.from({length:7},(_,i)=>{const d=new Date(today);d.setDate(d.getDate()-6+i);const key=localDate(d);return {date:key,count:snapshot.week.find(w=>w.date===key)?.count??0};})};
}
