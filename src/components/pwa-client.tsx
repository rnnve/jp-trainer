'use client';
import {useEffect} from 'react';
export default function PwaClient(){
 useEffect(()=>{
  if(!('serviceWorker' in navigator))return;
  if(process.env.NODE_ENV==='production'){
   void navigator.serviceWorker.register('/sw.js').catch(()=>{});
  }else{
   void navigator.serviceWorker.getRegistration('/').then(registration=>{
    if(registration&&new URL(registration.active?.scriptURL??registration.waiting?.scriptURL??registration.installing?.scriptURL??location.href).pathname==='/sw.js')return registration.update();
   }).catch(()=>{});
  }
 },[]);
 return null;
}
