import {notFound,redirect} from 'next/navigation';
const sections=['learn','library','flashcards','practice','conversations','books','settings','api'];
export default async function Page({params,searchParams}:{params:Promise<{section:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const {section}=await params;
 if(section==='statistics')redirect('/');
 if(!sections.includes(section))notFound();
 const query=new URLSearchParams();
 for(const [key,value] of Object.entries(await searchParams)){if(typeof value==='string')query.set(key,value);}
 redirect(`/hn/${section}${query.size?'?'+query.toString():''}`);
}
