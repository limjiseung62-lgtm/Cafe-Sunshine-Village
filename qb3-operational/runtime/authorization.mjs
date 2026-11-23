import {verifyBytes,requireThat,SHA,digest} from './integrity.mjs';
const grants=new WeakSet();
export function hasVerifiedGrant(x){return grants.has(x);}
const parse=b=>JSON.parse(new TextDecoder('utf8',{fatal:true}).decode(b));
export function checkTargetConsumer(c,policy){
 requireThat(c?.consumerId===policy.consumerId&&c.gameId===policy.gameId,'CONSUMER_NOT_ALLOWED');
 const u=new URL(c.targetURL);requireThat(u.protocol==='https:'&&u.origin===policy.origin&&!u.username&&!u.password&&u.pathname.startsWith(policy.basePath)&&!/%(?:2e|2f|5c)/i.test(u.pathname),'HOST_PATH_NOT_ALLOWED');
}
export async function verifyAuthority({trust,manifestBytes,receiptBytes,approvalBytes,scopeBytes,codeClosureBytes,dataInventoryBytes,compatibilityBytes,supplyPolicyBytes}){
 requireThat(trust?.state==='ISSUED_EXACT_SCOPE'&&[trust.manifestSHA256,trust.receiptSHA256,trust.approvalRecordSHA256,trust.scopeDigest].every(x=>SHA.test(x??'')),'OPERATING_APPROVAL_NOT_ISSUED');
 await verifyBytes(manifestBytes,trust.manifestSHA256);await verifyBytes(receiptBytes,trust.receiptSHA256);await verifyBytes(approvalBytes,trust.approvalRecordSHA256);await verifyBytes(scopeBytes,trust.scopeDigest);
 const m=parse(manifestBytes),r=parse(receiptBytes),a=parse(approvalBytes),s=parse(scopeBytes),policy=parse(supplyPolicyBytes);
 requireThat(m.state==='ISSUED'&&m.operationalApproval===true&&r.schemaVersion==='common-learning-operational-approval/1'&&r.status==='APPROVED_EXACT_SCOPE'&&r.issued===true&&r.operationalApproval===true,'RECEIPT_OR_MANIFEST_NOT_ISSUED');
 requireThat(r.scopeDigest===trust.scopeDigest&&m.scopeDigest===trust.scopeDigest&&m.receiptSHA256===trust.receiptSHA256&&r.approvalRecordSHA256===trust.approvalRecordSHA256&&a.status==='EXPLICIT_USER_OPERATING_SUPPLY_APPROVAL'&&a.scopeDigest===trust.scopeDigest,'APPROVAL_REFERENCE_MISMATCH');
 requireThat(typeof a.userInstructionQuote==='string'&&a.userInstructionQuote.length>0&&typeof a.recordedAt==='string'&&Number.isFinite(Date.parse(a.recordedAt))&&typeof r.approvalId==='string'&&r.approvalId.length>0,'ACTUAL_AUTHORITY_EVIDENCE_REQUIRED');
 requireThat(s.subject==='math'&&s.grade===4&&s.objectives===638&&s.profiles===840&&s.conditions===124375&&s.excludedSourceConditions===3023,'EXACT_SUPPLY_SCOPE_MISMATCH');
 requireThat(r.scope.subject==='math'&&r.scope.objectives===638&&r.scope.profiles===840&&r.scope.conditions===124375&&r.scope.excludedSourceConditions===3023,'RECEIPT_SCOPE_MISMATCH');
 requireThat(s.consumerId==='cafe-learning-tycoon'&&policy.consumerId===s.consumerId&&r.consumerId===s.consumerId&&r.allowedOrigin===policy.origin&&r.allowedBasePath===policy.basePath&&policy.unitWideSelectionAllowed===false,'POLICY_SCOPE_MISMATCH');
 requireThat(r.studentActivation===false&&r.gameDeploymentApproved===false&&m.studentSupplyEnabled===false&&m.productionReady===false,'ISSUANCE_IS_NOT_STUDENT_ACTIVATION');
 await verifyBytes(codeClosureBytes,s.codeClosureSHA256);await verifyBytes(dataInventoryBytes,s.dataInventorySHA256);await verifyBytes(compatibilityBytes,r.compatibilitySHA256);await verifyBytes(supplyPolicyBytes,s.supplyPolicySHA256);
 requireThat(parse(compatibilityBytes).targetScopeDigest===trust.scopeDigest,'COMPATIBILITY_TARGET_MISMATCH');
 requireThat(m.codeClosureSHA256===s.codeClosureSHA256&&r.codeClosureSHA256===s.codeClosureSHA256&&r.compatibilitySHA256===m.compatibilitySHA256&&s.dataInventorySHA256===m.dataInventorySHA256&&r.dataInventorySHA256===s.dataInventorySHA256,'CODE_DATA_POLICY_REFERENCE_MISMATCH');
 const g=Object.freeze({approvalId:r.approvalId,scopeDigest:trust.scopeDigest,manifestSHA256:trust.manifestSHA256,policy,scope:s});grants.add(g);return g;
}
export async function verifyCodeClosure(root,readBytes,closureBytes){
 const c=parse(closureBytes);requireThat(c.files?.length>0,'CODE_CLOSURE_REQUIRED');
 for(const f of c.files){requireThat(/^runtime\/[a-zA-Z0-9.-]+\.mjs$/.test(f.path),'UNSAFE_CODE_CLOSURE_PATH');await verifyBytes(await readBytes(new URL(f.path,root),33554432),f.sha256);}
 return true;
}
