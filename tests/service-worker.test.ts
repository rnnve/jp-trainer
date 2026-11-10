import {expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

test('switching to dev removes Kotoba caches and releases control without touching other apps',async()=>{
 const handlers:Record<string,(event:{waitUntil:(p:Promise<unknown>)=>void})=>void>={};
 const removed:string[]=[];let claimed=false,unregistered=false;
 runInNewContext(readFileSync(new URL('../public/dev-sw.js',import.meta.url),'utf8'),{
  self:{addEventListener:(name:string,fn:typeof handlers[string])=>{handlers[name]=fn;},skipWaiting:()=>Promise.resolve(),clients:{claim:async()=>{claimed=true;}},registration:{unregister:async()=>{unregistered=true;}}},
  caches:{keys:async()=>['kotoba-v1','kotoba-v2','other-app-cache'],delete:async(key:string)=>{removed.push(key);}}
 });
 let done:Promise<unknown>=Promise.resolve();handlers.activate({waitUntil:p=>{done=p;}});await done;
 expect(removed).toEqual(['kotoba-v1','kotoba-v2']);expect(claimed).toBe(true);expect(unregistered).toBe(true);expect(handlers.fetch).toBeUndefined();
});

test('production worker does not cache development assets marked no-store',async()=>{
 type FetchEvent={request:Request;respondWith:(p:Promise<Response>)=>void;waitUntil:(p:Promise<unknown>)=>void};
 const handlers:Record<string,(event:FetchEvent)=>void>={};let writes=0;let responsePromise:Promise<Response>|undefined;
 runInNewContext(readFileSync(new URL('../public/sw.js',import.meta.url),'utf8'),{
  URL,
  self:{location:{origin:'http://localhost:3000'},addEventListener:(name:string,fn:typeof handlers[string])=>{handlers[name]=fn;}},
  caches:{match:async()=>undefined,open:async()=>({put:async()=>{writes++;}})},
  fetch:async()=>new Response('dev javascript',{headers:{'Cache-Control':'no-store, must-revalidate'}})
 });
 handlers.fetch({request:new Request('http://localhost:3000/_next/static/chunks/app.js'),respondWith:p=>{responsePromise=p;},waitUntil:()=>{}});
 expect(await (await responsePromise!).text()).toBe('dev javascript');expect(writes).toBe(0);
});

test('private pages, authentication, private APIs, and RSC responses bypass all PWA caches',()=>{
 let handler:((event:{request:Request;respondWith:()=>void})=>void)|undefined;let responses=0;
 runInNewContext(readFileSync(new URL('../public/sw.js',import.meta.url),'utf8'),{
  URL,self:{location:{origin:'http://localhost:3000'},addEventListener:(name:string,fn:typeof handler)=>{if(name==='fetch')handler=fn;}},
  caches:{match:()=>{throw Error('Private response must not touch cache');}}
 });
 for(const path of ['/hn','/hn/learn','/hn/library','/hn/api/auth/session','/hn/api/statistics','/api/v1/stats'])handler!({request:new Request(`http://localhost:3000${path}`),respondWith:()=>{responses++;}});
 handler!({request:new Request('http://localhost:3000/',{headers:{RSC:'1'}}),respondWith:()=>{responses++;}});
 expect(responses).toBe(0);
});
