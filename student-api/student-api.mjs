import {initialize} from './verified-session.mjs';
// Install these pins as release configuration, never from a request, save or query.
// This is a browser-only student entry. Node QA has a separate explicit harness.
export function createStudentClient(installed){
 const fixed=structuredClone(installed??{});
 return Object.freeze({async openOperatingBank(request){
  return initialize(fixed,request,{mode:'production',context:()=>({url:globalThis.location?.href,browser:typeof window!=='undefined'&&typeof document!=='undefined'}),read:async(url,max)=>{
   if(url.protocol!=='https:')throw Error('HTTPS_RESOURCE_REQUIRED');
   const r=await fetch(url,{cache:'no-store',redirect:'error'});if(!r.ok)throw Error('RESOURCE_LOAD_FAILED');
   const reader=r.body.getReader(),parts=[];let n=0;try{for(;;){const x=await reader.read();if(x.done)break;n+=x.value.length;if(n>max)throw Error('RESOURCE_TOO_LARGE');parts.push(x.value);}}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
   const out=new Uint8Array(n);let i=0;for(const p of parts){out.set(p,i);i+=p.length;}return out;
  }});
 }});
}
export async function openOperatingBank(request){return createStudentClient(null).openOperatingBank(request);}
