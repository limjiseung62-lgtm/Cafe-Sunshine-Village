import{openStudentBank,GAME}from'./student-release.mjs';
export const STUDENT_MANIFEST='1e4acf80c8fb806b3b53339eca14252f4b6cace0c88c065d78e32b1545ce0f0e';
export const studentCatalogMode=()=>globalThis.__QB3_MODE==='student';
const cache=new Map();
export function adaptBank(bank,learningRecordId,pins){const get=bank.getQuestion.bind(bank);return {...bank,info:{...bank.info,learningRecordId,reusedEngine:pins.engineVersion,policy:pins.policyVersion,runtimeVersion:'receipt-verified-cafe-local/1'},getEquivalentCandidates:ref=>bank.getEquivalentCandidates(typeof ref==='string'?ref:ref.questionId).map(r=>bank.getRef(r.questionId)),getQuestion(ref){const r=get(ref);return {...r,questionRef:bank.getRef(r.questionId),metadata:{...r.metadata,questionType:'single-choice',subject:'math',grade:4,semester:r.semester,unitId:r.unitId,skillIds:[r.skillId],difficulty:r.level,packId:bank.info.packId,packVersion:bank.info.packVersion,contentVersion:bank.info.contentVersion,semanticConditionKey:r.semanticConditionKey}};}};}

export async function loadStudentMath(choices){
 if(!choices?.length||choices.some(c=>!c.skillIds?.length))throw Error('학습목표를 명시적으로 선택해 주세요.');
 const key=JSON.stringify(choices);if(cache.has(key))return cache.get(key);cache.clear();
 const promise=(async()=>{const selection={subject:'math',grade:4,choices:choices.map(c=>({unitId:c.unitId,objectiveIds:c.skillIds,...c.levels?{levels:c.levels}:{}}))},api=await openStudentBank({...GAME,selection});
 if(!['READY','QA_READY'].includes(api.status))throw Object.assign(Error('수학 학생 공급 보류: '+api.reason),{code:'STUDENT_SUPPLY_HELD',result:api});
 if(api.manifestSHA256!==STUDENT_MANIFEST||typeof api.createCafeBank!=='function'||!api.codec)throw Error('STUDENT_CAFE_PORT_REQUIRED');
 const base=new URL('assets/common-learning/math/',document.baseURI),[reports,reportPort,png]=await Promise.all(['report.mjs','report-port.mjs','png.mjs'].map(f=>import(new URL(f,base).href)));
 globalThis.__STUDENT_API_DIAGNOSTICS={status:api.status,authorityMode:api.authorityMode,manifestSHA256:api.manifestSHA256,studentSupplyEnabled:api.studentSupplyEnabled,rewardEligible:api.rewardEligible,selection};
 return{subject:'math',manifestSHA256:STUDENT_MANIFEST,module:api.codec,reports,reportPort,png,runtime:{info:{version:'3.0.0-operational.1',manifestSHA256:STUDENT_MANIFEST,operationalApproval:true,purpose:'student-api-contract',studentSupply:api.studentSupplyEnabled?1:0},createBank:({semesterKey,learningRecordId})=>{const raw=api.createCafeBank(Number(semesterKey.at(-1)),learningRecordId),b=adaptBank(raw,learningRecordId,{engineVersion:raw.info.reusedEngine,policyVersion:raw.info.policy});const create=b.createReviewEngine;b.createReviewEngine=storage=>{const e=create(storage),p={};for(const[k,fn]of Object.entries(e))p[k]=k==='decodeState'?fn:async(...args)=>{const r=await fn(...args);if(r?.status==='HELD'){cache.delete(key);throw Object.assign(Error(r.reason),{code:'STUDENT_SUPPLY_HELD',result:r})}return r};return p};return b}}};})();
 cache.set(key,promise);promise.catch(()=>{if(cache.get(key)===promise)cache.delete(key)});return promise;
}
export async function restrictStudentCatalog(subjects){
 const response=await fetch(new URL('../qb3-operational/assets/objectives.json',import.meta.url));if(!response.ok)throw Error('운영 학습목표 목록을 읽지 못했어요.');const bytes=new Uint8Array(await response.arrayBuffer());
 const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');if(digest!=='a340a6a65539f8082e1cf24f23e886c5cd3b9cf919a864e97d3836a4f981e772')throw Error('운영 학습목표 목록 해시 불일치');
 const {objectives}=JSON.parse(new TextDecoder().decode(bytes));return subjects.map(s=>s.subject!=='math'?s:{...s,units:s.units.map(u=>u.grade!==4?u:{...u,unitLabel:u.unitLabel.replace(' [비공개 QA 후보]','')+' [승인 운영팩]',skills:objectives.filter(o=>o.portalUnitId===u.unitId).map(o=>({id:o.portalObjectiveId,label:o.label}))})});
}
