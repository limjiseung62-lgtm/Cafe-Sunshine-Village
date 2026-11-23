// Authority/transport adapter only. Question, grading, review and ledger algorithms
// are imported unchanged from the hash-verified issued common engine.
const SCOPE='3d77e661b90e46641daa27eb37b4b8a8399a83f68105a5d274b45def3907300b';
const MANIFEST='1e4acf80c8fb806b3b53339eca14252f4b6cace0c88c065d78e32b1545ce0f0e';
const TRUST='d484e8d9e96106291a4084c5c2f49709fcee7e25c3be9bb87d497295d073284e';
const CLOSURE='857b3a5c540a0daf0d98681ae4e966f9e44ffd2edf7349254537883e7be0ee2e';
const ORIGIN='https://limjiseung62-lgtm.github.io',BASE='/Cafe-Sunshine-Village/';
const ok=(v,s)=>{if(!v)throw Error(s);};
export const held=e=>Object.freeze({status:'HELD',reason:e.message??String(e),items:[],studentSupplyEnabled:false,rewardEligible:false,rewardUnits:0});
export async function hash(b){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(x=>x.toString(16).padStart(2,'0')).join('');}
const parse=b=>JSON.parse(new TextDecoder('utf8',{fatal:true}).decode(b));
export async function initialize(config,request,env){
 try{
  const qa=env.mode==='isolated-qa';
  if(qa){if(typeof window!=='undefined')ok(['127.0.0.1','localhost','[::1]'].includes(globalThis.location?.hostname),'PRIVATE_ISOLATED_QA_HOST_REQUIRED');else ok(typeof process!=='undefined'&&!!process.versions?.node,'PRIVATE_ISOLATED_QA_HOST_REQUIRED');}
  ok(config.state==='PINNED_STUDENT_RELEASE','STUDENT_ACTIVATION_AND_GAME_BINDING_NOT_INSTALLED');
  ok(qa||env.context().browser,'STUDENT_BROWSER_REQUIRED');
  const root=new URL(config.supplierRoot),read=env.read;
  ok(qa||root.protocol==='https:','HTTPS_SUPPLIER_REQUIRED');
  const pinned=async(url,pin,max=33554432)=>{ok(/^[a-f0-9]{64}$/.test(pin??''),'RELEASE_PIN_REQUIRED');const b=await read(url,max);ok(await hash(b)===pin,'HASH_MISMATCH');return b;};
  const apiFiles=['student-api.mjs','verified-session.mjs'];
  for(const f of apiFiles)await pinned(new URL(f,import.meta.url),config.apiFiles?.[f]);
  const binding=parse(await pinned(new URL(config.bindingURL),config.bindingSHA256,1048576));
  const activation=parse(await pinned(new URL(config.activationURL),config.activationSHA256,1048576));
  ok(binding.schemaVersion==='qb3-game-binding/1'&&activation.schemaVersion==='qb3-student-activation/1','AUTHORITY_SCHEMA');
  ok(binding.state===(qa?'ISOLATED_QA_CONTRACT':'APPROVED_GAME_BINDING')&&activation.state===(qa?'ISOLATED_QA_CONTRACT':'APPROVED_STUDENT_ACTIVATION'),'ACTUAL_STUDENT_APPROVAL_REQUIRED');
  ok(binding.manifestSHA256===MANIFEST&&activation.manifestSHA256===MANIFEST&&binding.scopeDigest===SCOPE&&activation.scopeDigest===SCOPE,'AUTHORITY_SCOPE_MISMATCH');
  ok(activation.bindingSHA256===config.bindingSHA256&&activation.studentSupplyEnabled===true,'ACTIVATION_BINDING_MISMATCH');
  for(const a of [binding,activation])ok(typeof a.approvalId==='string'&&a.approvalId&&typeof a.evidence==='string'&&a.evidence&&Number.isFinite(Date.parse(a.approvedAt)),'APPROVAL_EVIDENCE_REQUIRED');
  ok(binding.consumerId==='cafe-learning-tycoon'&&binding.gameId==='cafe'&&binding.origin===ORIGIN&&binding.basePath===BASE,'CONSUMER_CONTRACT_MISMATCH');
  ok(typeof binding.version==='string'&&binding.version&&typeof binding.build==='string'&&binding.build&&/^[a-f0-9]{64}$/.test(binding.entrySHA256??''),'EXACT_GAME_BUILD_REQUIRED');
  ok(JSON.stringify(activation.apiFiles)===JSON.stringify(config.apiFiles),'API_CLOSURE_MISMATCH');
  const guard=()=>{
   const now=Date.now();for(const a of [binding,activation])ok(Number.isFinite(Date.parse(a.expiresAt))&&now<Date.parse(a.expiresAt)&&Date.parse(a.approvedAt)<=now,'EXPIRED_OR_FUTURE_APPROVAL');
   const u=new URL(env.context().url);ok(u.origin===ORIGIN&&!u.username&&!u.password&&u.pathname.startsWith(BASE)&&!/%(?:2e|2f|5c)/i.test(u.pathname),'HOST_PATH_NOT_ALLOWED');
   ok(binding.entryPath===u.pathname,'EXACT_ENTRY_PATH_REQUIRED');
   ok(request?.consumerId===binding.consumerId&&request.gameId===binding.gameId&&request.version===binding.version&&request.build===binding.build&&request.entrySHA256===binding.entrySHA256,'GAME_BINDING_MISMATCH');
  };guard();
  const entry=new URL(binding.entryPath,ORIGIN);await pinned(entry,binding.entrySHA256);
  const closureBytes=await pinned(new URL('code-closure.json',root),CLOSURE);
  const verifiedCode=new Map(),moduleURLs=new Map(),blobs=[];
  for(const f of parse(closureBytes).files){ok(/^runtime\/[a-zA-Z0-9.-]+\.mjs$/.test(f.path),'UNSAFE_CODE_PATH');verifiedCode.set(f.path.slice(8),await pinned(new URL(f.path,root),f.sha256));}
  // Execute the bytes just verified, not a second unverified URL fetch.
  function moduleURL(name){
   if(moduleURLs.has(name))return moduleURLs.get(name);
   ok(verifiedCode.has(name),'UNPINNED_MODULE_IMPORT');let source=new TextDecoder().decode(verifiedCode.get(name));
   for(const match of source.matchAll(/(?:from\s*|import\s*)['"]\.\/([a-zA-Z0-9.-]+\.mjs)['"]/g))source=source.replaceAll("'./"+match[1]+"'",JSON.stringify(moduleURL(match[1]))).replaceAll('"./'+match[1]+'"',JSON.stringify(moduleURL(match[1])));
   const url=typeof process!=='undefined'&&process.versions?.node?'data:text/javascript;base64,'+Buffer.from(source).toString('base64'):URL.createObjectURL(new Blob([source],{type:'text/javascript'}));
   moduleURLs.set(name,url);if(url.startsWith('blob:'))blobs.push(url);return url;
  }
  let auth,ioMod,connected;
  try{[auth,ioMod,connected]=await Promise.all(['authorization.mjs','asset-io.mjs','connected-runtime.mjs'].map(name=>import(moduleURL(name))));}finally{for(const u of blobs)URL.revokeObjectURL(u);}
  const trust=parse(await pinned(new URL('controls/publisher-trust.json',root),TRUST));
  const raw={trust};for(const [k,f] of Object.entries({manifestBytes:'operating-manifest.json',receiptBytes:'operating-receipt.json',approvalBytes:'operating-approval.json',scopeBytes:'scope.json',codeClosureBytes:'code-closure.json',dataInventoryBytes:'data-inventory.json',compatibilityBytes:'policies/compatibility.json',supplyPolicyBytes:'policies/supply.json'}))raw[k]=await read(new URL(f,root),33554432);
  const grant=await auth.verifyAuthority(raw);ok(grant.manifestSHA256===MANIFEST&&grant.scopeDigest===SCOPE,'ISSUED_GRANT_MISMATCH');
  const scope=parse(raw.scopeBytes),resources=parse(await pinned(new URL('assets/resources.json',root),scope.resourceConfigSHA256)),pins=parse(await pinned(new URL('assets/code-input-pins.json',root),scope.codeInputPinsSHA256));
  await pinned(new URL('assets/objectives.json',root),scope.objectiveMappingSHA256);
  const selection=structuredClone(request.selection),io=await ioMod.createAssetIO(root,{readBytes:read,resources,codePins:pins}),runtime=await connected.createConnectedRuntime(io,resources,pins),banks=await runtime.prepareBySemester(selection);
  guard();const cafePins=new Map();for(const[sem,bank]of banks){const e=bank.createReviewEngine(runtime.core.memoryStorage());cafePins.set(sem,(await runtime.core.decode(await e.serialize())).pins);}let closed=false,tail=Promise.resolve();
  const invoke=fn=>{const run=tail.then(async()=>{try{ok(!closed,'SESSION_CLOSED');guard();return await fn();}catch(e){closed=true;runtime.loader.clearCache();return held(e);}});tail=run.then(()=>{});return run;};
  const open=new Set(),scopeOptions=[];
  for(const c of selection.choices)scopeOptions.push({unitId:c.unitId,objectiveIds:c.objectiveIds,semester:Number(c.unitId[3])});
  return Object.freeze({status:qa?'QA_READY':'READY',authorityMode:qa?'ISOLATED_QA_NOT_ACTIVATION':'APPROVED_STUDENT_BINDING',studentSupplyEnabled:!qa,rewardEligible:!qa,scopeDigest:SCOPE,manifestSHA256:MANIFEST,scopeOptions,
   codec:Object.freeze({memoryStorage:runtime.core.memoryStorage,encode:runtime.core.encode,decode:runtime.core.decode}),
   // Cafe compatibility port: existing bank views and the SAME existing engine, guarded at every call.
   createCafeBank(semester,learningRecordId){
    const checked=()=>{ok(!closed,'SESSION_CLOSED');guard();};checked();const bank=banks.get(`g4s${semester}`);ok(bank,'SEMESTER_NOT_SELECTED');
    const port={info:{...bank.info,learningRecordId,reusedEngine:cafePins.get(`g4s${semester}`).engineVersion,runtimeVersion:'student-api-cafe-port/1'}};
    for(const method of ['defaultScope','selectScope','getQuestion','getRef','getCandidates','getCandidateMetadata','getEquivalentCandidates'])port[method]=(...args)=>{checked();return bank[method](...args)};
    port.createReviewEngine=storage=>{checked();const engine=bank.createReviewEngine(storage),facade={};
     facade.openSession=scope=>invoke(()=>{const selected=selection.choices.find(c=>c.unitId===scope.unitId);ok(selected&&scope.skillIds?.length&&scope.skillIds.every(x=>selected.objectiveIds.includes(x)),'OBJECTIVE_OUTSIDE_REQUEST');ok(scope.levels?.length&&scope.levels.every(x=>(selected.levels??[1,2,3,4,5]).includes(x)),'LEVEL_OUTSIDE_REQUEST');return engine.openSession(scope)});
     for(const method of ['nextQuestion','applyAttemptEvent','requestEquivalentTwin','getReviewQueue','startChallenge','nextChallenge','getReviewSummary','serialize','restore'])facade[method]=(...args)=>invoke(()=>engine[method](...args));
     facade.decodeState=(...args)=>{checked();return engine.decodeState(...args)};return Object.freeze(facade);};return Object.freeze(port);
   },
   async createLearningSession(semester,snapshot){return invoke(async()=>{
    const bank=banks.get(`g4s${semester}`);ok(bank,'SEMESTER_NOT_SELECTED');const engine=bank.createReviewEngine(runtime.core.memoryStorage());
    if(snapshot!==undefined)await engine.restore(snapshot);
    const methods=['openSession','nextQuestion','applyAttemptEvent','requestEquivalentTwin','getReviewQueue','startChallenge','nextChallenge','getReviewSummary','serialize'];
    const facade={};for(const method of methods)facade[method]=(...args)=>invoke(()=>engine[method](...args));
    facade.openObjectiveSession=(unitId,objectiveIds)=>invoke(()=>{const c=selection.choices.find(c=>c.unitId===unitId);ok(c&&objectiveIds?.length&&objectiveIds.every(x=>c.objectiveIds.includes(x)),'OBJECTIVE_OUTSIDE_REQUEST');const s=bank.selectScope(unitId,objectiveIds);if(c.levels)s.levels=c.levels;return engine.openSession(s);});
    // No raw openSession: the caller cannot widen a selected objective or level.
    delete facade.openSession;facade.close=()=>{open.delete(facade);};open.add(facade);return Object.freeze(facade);
   });},close(){closed=true;open.clear();banks.clear();runtime.loader.clearCache();}
  });
 }catch(e){return held(e);}
}
