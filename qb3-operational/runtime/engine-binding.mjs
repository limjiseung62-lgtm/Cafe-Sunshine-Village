import {takeVerifiedPack} from './scoped-loader.mjs';
import {requireThat,verifyBytes} from './integrity.mjs';
// Finite data/provider adapter only. SharedReviewPolicy and sharedGradeAnswer are
// existing core primitives, not a new generator, grader or review algorithm.
export async function loadPinnedCore(readCode,codePins){
 const bytes=await readCode('shared-core.mjs');await verifyBytes(bytes,codePins.sharedCoreSHA256);
 if(typeof process!=='undefined'&&process.versions?.node)return import('data:text/javascript;base64,'+Buffer.from(bytes).toString('base64'));
 const url=URL.createObjectURL(new Blob([bytes],{type:'text/javascript'}));try{return await import(url);}finally{URL.revokeObjectURL(url);}
}
export function bindVerifiedEngine(handle,core){
 const pack=takeVerifiedPack(handle),byId=new Map(pack.rows.map(r=>[r.questionId,r])),byFp=new Map(pack.rows.map(r=>[r.contentFingerprint,r.semanticConditionKey]));
 const clone=structuredClone,base={packId:pack.packId,packVersion:pack.version,contentVersion:pack.contentVersion};
 const ref=r=>({...base,questionId:r.questionId,questionVersion:r.questionVersion,contentHash:r.contentHash});
 const resolve=x=>{requireThat(x&&x.packId===base.packId&&x.packVersion===base.packVersion&&x.contentVersion===base.contentVersion&&Object.keys(x).every(k=>['packId','packVersion','contentVersion','questionId','questionVersion','contentHash'].includes(k)),'PACK_REFERENCE_MISMATCH');const r=byId.get(x.questionId);requireThat(r&&r.questionVersion===x.questionVersion&&r.contentHash===x.contentHash,'HELD_OR_CHANGED_QUESTION');return r;};
 const skillSet=unit=>[...new Set(pack.rows.filter(r=>r.unitId===unit).map(r=>r.skillId))];
 const supply={
  blocked:new Set(pack.rows.filter(r=>!r.authorPreviewEligible).map(r=>r.contentHash)),
  ref,resolve,scope(x){requireThat(x&&Object.keys(x).every(k=>['packId','packVersion','contentVersion','subject','grade','semester','unitId','skillIds','levels','style'].includes(k))&&x.subject==='math'&&x.grade===4&&x.semester===Number(x.unitId?.[3])&&x.packId===base.packId&&x.packVersion===base.packVersion&&x.contentVersion===base.contentVersion,'SCOPE_IDENTITY_MISMATCH');requireThat(Array.isArray(x.skillIds)&&x.skillIds.length&&new Set(x.skillIds).size===x.skillIds.length&&x.skillIds.every(s=>skillSet(x.unitId).includes(s)),'UNKNOWN_SKILL');requireThat(Array.isArray(x.levels)&&x.levels.length&&x.levels.every(n=>Number.isInteger(n)&&n>=1&&n<=5)&&['mixed','calculation','word-problem'].includes(x.style),'INVALID_FILTER');requireThat(supply.rows(x).length,'NO_APPROVED_CANDIDATES');return clone(x);},
  rows:x=>pack.rows.filter(r=>r.unitId===x.unitId&&x.skillIds.includes(r.skillId)&&x.levels.includes(r.level)&&(x.style==='mixed'||x.style===r.style)),
  semanticKey:r=>r.semanticConditionKey,
  historyKey(fp){requireThat(byFp.has(fp),'UNKNOWN_HISTORY_FINGERPRINT');return byFp.get(fp);},
  isExcluded:(r,h)=>h.some(fp=>supply.historyKey(fp)===r.semanticConditionKey),
  candidates(root,excluded=[]){const seen=new Set([root.semanticConditionKey,...excluded.map(fp=>supply.historyKey(fp))]);return (pack.equivalenceGroups[root.equivalenceKey]??[]).map(id=>byId.get(id)).filter(r=>r&&!seen.has(r.semanticConditionKey)&&seen.add(r.semanticConditionKey));},
  async twin(root,excluded,seed){const cs=supply.candidates(root,excluded);let n=0;for(const c of seed)n=(n*31+c.charCodeAt(0))>>>0;return cs[n%cs.length]??null;},
  find:q=>{const r=byId.get(q.question.id);return r&&r.contentHash===q.contentHash&&core.canonicalJSON(q)===core.canonicalJSON(r.reviewItem)?r:undefined;},
  provider:()=>({templates:[],generate:async()=>{throw Error('UNBOUNDED_GENERATION_DISABLED');},verify:async q=>!!supply.find(q),authorize:async()=>false}),
  view:r=>clone(r.render),
  metadata:r=>({packageId:base.packId,templateId:r.templateId,templateVersion:r.templateVersion,familyId:r.familyId,variantId:r.exampleId,seed:r.seed,parameters:clone(r.parameters),generatorVersion:'existing-pinned-finite-and-rich-v2',mathConditionKey:r.contentFingerprint,structureFingerprint:r.structureFingerprint,equivalenceKey:r.equivalenceKey,grade:4,semester:r.semester,unitId:r.unitId,skillIds:[r.skillId],reasoningType:r.reviewItem.task.query,difficulty:r.level,difficultyScale:r.proof.type==='cafe190'?'source-ordinal-not-calibrated-L1-L5':'estimated-grade-local-L1-L5',rendererVersion:r.rendererVersion,explanationVersion:r.source.displayAdapter??r.source.newDefinitionVersion??'source-preserved',answerPolicy:'native-gradeAnswer',semanticConditionKey:r.semanticConditionKey,reviewOnly:true}),
  assessment:(x,response)=>{const r=resolve(x),g=core.sharedGradeAnswer(r.reviewItem.question,response);return {status:g.status,correctChoiceId:r.assessment.answer.choiceId??r.assessment.answerLabel,explanation:r.assessment.explanation,hint:r.assessment.hint,questionRef:ref(r)};}
 };
 return {info:{...base,mode:'isolated-connected-candidate',operational:false,studentSupply:0,policy:'equivalent-two/1.0.0'},defaultScope:unitId=>({...base,subject:'math',grade:4,semester:Number(unitId[3]),unitId,skillIds:skillSet(unitId),levels:[1,2,3,4,5],style:'mixed'}),selectScope:(unitId,skillIds)=>supply.scope({...base,subject:'math',grade:4,semester:Number(unitId[3]),unitId,skillIds,levels:[1,2,3,4,5],style:'mixed'}),getQuestion:x=>clone(resolve(x)),getRef:id=>ref(resolve(ref(byId.get(id)??{}))),getCandidates:x=>clone(supply.rows(supply.scope(x))),getCandidateMetadata:x=>supply.rows(supply.scope(x)).map(r=>({questionId:r.questionId,questionRef:ref(r),difficulty:r.level,level:r.level,skillId:r.skillId,unitId:r.unitId,semanticConditionKey:r.semanticConditionKey,contentFingerprint:r.contentFingerprint,templateId:r.templateId,solutionStructureId:r.solutionStructureId})),getEquivalentCandidates:id=>clone(supply.candidates(resolve(ref(byId.get(id)??{})))),gradeAnswer:supply.assessment,createReviewEngine:storage=>new core.SharedReviewPolicy(supply,storage),operationalSupply:()=>({status:'HELD',items:[],rewardEligible:false,studentSupplyEnabled:false})};
}
