import {checkedFetch,checkedGzip,verifyBytes,requireThat} from './integrity.mjs';
const safe=(root,file)=>{requireThat(typeof file==='string'&&!file.includes('..')&&!file.startsWith('/')&&!file.includes('\\')&&!file.includes(':')&&!file.includes('?')&&!file.includes('#'),'UNSAFE_ASSET_PATH');return new URL(file,root);};
export async function createAssetIO(root,{readBytes,resources,codePins}){
 const read=async(file,pin)=>{const url=safe(root,file);const bytes=await readBytes(url,33554432);await verifyBytes(bytes,pin);return bytes;};
 return {mode:'SEALED_FINITE_SUPPLY',readCode:async name=>{requireThat(name==='shared-core.mjs','UNKNOWN_CODE_ASSET');return read('runtime/shared-core.mjs',codePins.sharedCoreSHA256);},
  readMetadata:async name=>{requireThat(name==='objective-mapping.json','UNKNOWN_METADATA_ASSET');return read('assets/objectives.json',codePins.objectiveMappingSHA256);},
  readSource:async role=>{const d=resources.sourceFiles[role];requireThat(d,'UNKNOWN_SOURCE_ASSET');return checkedGzip(await read(d.path,d.sha256),{transportSHA256:d.sha256,decodedSHA256:d.decodedSHA256});},
  readScoped:async file=>{const pin=file==='index.json.gz'?resources.rootTransportSHA256:resources.transportFiles.find(x=>x.path===file)?.sha256;requireThat(pin,'UNPINNED_CHUNK');return read('scoped/'+file,pin);}};
}
export const browserRead=async(url,maxBytes)=>{const r=await fetch(url,{cache:'no-store'});requireThat(r.ok,'RESOURCE_LOAD_FAILED');const reader=r.body.getReader(),parts=[];let n=0;try{for(;;){const x=await reader.read();if(x.done)break;n+=x.value.length;requireThat(n<=maxBytes,'RESOURCE_TOO_LARGE');parts.push(x.value);}}catch(e){await reader.cancel().catch(()=>{});throw e;}finally{reader.releaseLock();}const out=new Uint8Array(n);let at=0;for(const x of parts){out.set(x,at);at+=x.length;}return out;};
