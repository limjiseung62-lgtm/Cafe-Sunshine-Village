import{RELEASE,releaseEnvironment}from'./release-config.mjs';
export async function verifyConsumerBinding(){
 const environment=releaseEnvironment(location.href),r=await fetch(new URL('consumer-binding.local.json',import.meta.url),{cache:'no-store'});if(!r.ok)throw Error('게임 바인딩 파일이 없어요.');const b=await r.json();
 if(b.version!==RELEASE.version||b.build!==RELEASE.build||b.targetURL!==RELEASE.origin+RELEASE.basePath||b.namespace!==RELEASE.namespace||b.manifestSHA256!==RELEASE.manifestSHA256||b.studentActivation!==false)throw Error('게임 바인딩 pin 불일치');
 for(const f of b.entries){const q=await fetch(new URL(f.path,import.meta.url),{cache:'no-store'});if(!q.ok)throw Error('게임 entry 누락');const bytes=await q.arrayBuffer(),actual=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');if(actual!==f.sha256)throw Error('게임 entry 해시 불일치: '+f.path);}
 globalThis.__SUNSHINE_CONSUMER_BINDING={status:'LOCAL_BINDING_VERIFIED',environment,...b};return b;
}
