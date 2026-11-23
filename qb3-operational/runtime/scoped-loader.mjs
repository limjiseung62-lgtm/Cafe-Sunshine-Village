import {verifyBytes,checkedGzip,requireThat,digest} from './integrity.mjs';
const sealed=new WeakMap();
export function takeVerifiedPack(handle){requireThat(sealed.has(handle),'VERIFIED_PACK_CAPABILITY_REQUIRED');return sealed.get(handle);}
function frozen(x){if(x&&typeof x==='object'&&!Object.isFrozen(x)){Object.values(x).forEach(frozen);Object.freeze(x);}return x;}
// Reuses the B3 exact row gate and existing scoped descriptor format. No generator.
export function createScopedLoader(io,config,mapping){
 const cache=new Map();let cacheBytes=0;const limit=16777216;let rootPromise,gatePromise,blockedPromise;
 const metrics={reads:0,chunks:0,rows:0,cachePeak:0,cacheBytes:0,selected:[]};
 const transport=new Map(config.transportFiles.map(x=>[x.path,x]));
 async function scoped(file,decodedHash){
  requireThat(!file.includes('..')&&!file.startsWith('/')&&!file.includes('\\'),'UNSAFE_RESOURCE_PATH');
  const zipped=file+'.gz',t=file==='index.json'?{sha256:config.rootTransportSHA256}:transport.get(zipped);
  requireThat(t,'UNPINNED_TRANSPORT');metrics.reads++;
  const bytes=await io.readScoped(zipped);return JSON.parse(new TextDecoder('utf8',{fatal:true}).decode(await checkedGzip(bytes,{transportSHA256:t.sha256,decodedSHA256:decodedHash})));
 }
 async function data(role,pin){const bytes=await io.readSource(role);await verifyBytes(bytes,pin);return JSON.parse(new TextDecoder('utf8',{fatal:true}).decode(bytes));}
 async function foundations(){
  rootPromise??=scoped('index.json',config.rootDecodedSHA256).then(x=>{requireThat(x.sourceManifestSHA256===config.pins.sourceReleaseManifest&&x.conditions===config.scopeConditions&&x.profiles===config.scopeProfiles&&x.operationalApproval===false,'SOURCE_CONTRACT_MISMATCH');return x;});
  gatePromise??=data('gate',config.pins.approvedRowGate);blockedPromise??=data('excluded',config.pins.excludedConditions);
  return Promise.all([rootPromise,gatePromise,blockedPromise]);
 }
 function plan(selection){
  requireThat(selection?.subject==='math'&&selection.grade===4&&Array.isArray(selection.choices)&&selection.choices.length,'INVALID_QA_SCOPE');
  const plans=[];let semester;
  for(const c of selection.choices){
   requireThat(/^sem[12]_unit[1-6]$/.test(c.unitId),'UNIT_OUTSIDE_SCOPE');const sem=Number(c.unitId[3]);semester??=sem;requireThat(semester===sem,'SEPARATE_SEMESTER_BANKS_REQUIRED');
   const candidates=mapping.objectives.filter(m=>m.portalUnitId===c.unitId);
   requireThat(c.unitOptIn===undefined&&c.auditProfileId===undefined,'OBJECTIVE_ONLY_NO_UNIT_OR_QA_BYPASS');
   {
    requireThat(Array.isArray(c.objectiveIds)&&c.objectiveIds.length&&new Set(c.objectiveIds).size===c.objectiveIds.length,'EXPLICIT_OBJECTIVES_OR_UNIT_OPT_IN_REQUIRED');
    const matched=c.objectiveIds.map(id=>candidates.find(m=>m.portalObjectiveId===id));
    requireThat(matched.every(m=>m?.state==='EXACT_SAFE_ID_AND_EXISTING_NAME'),'OBJECTIVE_UNCONFIRMED_OR_NO_APPROVED_SUPPLY');
    plans.push({unitId:c.unitId,profiles:new Set(matched.flatMap(m=>m.profiles.map(p=>p.id))),levels:c.levels});
   }
   if(c.levels!==undefined)requireThat(Array.isArray(c.levels)&&c.levels.length&&c.levels.every(n=>Number.isInteger(n)&&n>=1&&n<=5),'INVALID_LEVEL_FILTER');
   requireThat(c.profileIds===undefined,'PUBLIC_PROFILE_SELECTOR_NOT_SUPPORTED');
  }
  return plans;
 }
 async function load(selection){
  const plans=plan(selection),[root,pins,blocked]=await foundations();const deniedId=new Set(blocked.map(b=>b.questionId)),deniedKey=new Set(blocked.map(b=>b.semanticConditionKey));
  let header;const rows=[],seen=new Set();
  for(const unitId of new Set(plans.map(p=>p.unitId))){
   const u=root.units.find(x=>x.unitId===unitId);requireThat(u,'UNIT_OUTSIDE_APPROVED_INDEX');const meta=await scoped(u.file,u.sha256);header??=meta.header;
   const policies=plans.filter(p=>p.unitId===unitId),profiles=meta.profiles.filter(p=>policies.some(s=>(s.profiles===null||s.profiles.has(p.equivalenceKey))&&(!s.levels||p.levels.some(l=>s.levels.includes(l)))));
   // Reject an empty individual filter rather than filling from another choice.
   for(const s of policies)requireThat(profiles.some(p=>(s.profiles===null||s.profiles.has(p.equivalenceKey))&&(!s.levels||p.levels.some(l=>s.levels.includes(l)))),'NO_APPROVED_CANDIDATES_IN_EXACT_FILTER');
   for(const p of profiles)for(const chunk of p.chunks){
    let rs=cache.get(chunk.file);
    if(!rs){rs=await scoped(chunk.file,chunk.sha256);requireThat(rs.length===chunk.count,'CHUNK_COUNT_MISMATCH');
     for(const r of rs){requireThat(!deniedId.has(r.questionId)&&!deniedKey.has(r.semanticConditionKey),'EXCLUDED_CONDITION');requireThat(r.grade===4&&r.unitId===unitId&&r.semester===Number(unitId[3])&&r.equivalenceKey===p.equivalenceKey,'ROW_SCOPE_MISMATCH');requireThat(Object.hasOwn(pins,r.questionId)&&await digest(new TextEncoder().encode(JSON.stringify(r)))===pins[r.questionId],'APPROVED_ROW_HASH_MISMATCH');frozen(r);}
     metrics.chunks++;while(cacheBytes+chunk.bytes>limit&&cache.size){const [key,v]=cache.entries().next().value;cache.delete(key);cacheBytes-=v.bytes;}
     if(chunk.bytes<=limit){cache.set(chunk.file,{rows:rs,bytes:chunk.bytes});cacheBytes+=chunk.bytes;}
    }else rs=rs.rows;
    for(const r of rs){if(!policies.some(s=>(s.profiles===null||s.profiles.has(r.equivalenceKey))&&(!s.levels||s.levels.includes(r.level))))continue;if(seen.has(r.questionId))continue;seen.add(r.questionId);rows.push(r);}
   }
  }
  requireThat(rows.length,'NO_APPROVED_CANDIDATES');const groups={};for(const r of rows)(groups[r.equivalenceKey]??=[]).push(r.questionId);
  const pack={...header,rows,equivalenceGroups:groups};const handle=Object.freeze({kind:'verified-finite-pack',rows:rows.length,unitIds:[...new Set(rows.map(r=>r.unitId))]});sealed.set(handle,pack);
  metrics.rows=rows.length;metrics.cacheBytes=cacheBytes;metrics.cachePeak=Math.max(metrics.cachePeak,cacheBytes);metrics.selected=handle.unitIds;return handle;
 }
 return {load,metrics,clearCache(){cache.clear();cacheBytes=0;metrics.cacheBytes=0;}};
}
