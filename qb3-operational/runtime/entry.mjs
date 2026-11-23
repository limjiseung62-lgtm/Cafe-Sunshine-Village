import {verifyAuthority,verifyCodeClosure,checkTargetConsumer} from './authorization.mjs';
import {createConnectedRuntime} from './connected-runtime.mjs';
import {createAssetIO,browserRead} from './asset-io.mjs';
import {verifyBytes,requireThat,SHA} from './integrity.mjs';
const decode=b=>JSON.parse(new TextDecoder('utf8',{fatal:true}).decode(b));
const root=new URL('../',import.meta.url);
const held=e=>Object.freeze({status:'HELD',reason:e.message,items:Object.freeze([]),studentSupplyEnabled:false,rewardEligible:false});
// Trust roots are installed publisher/consumer configuration, never extracted
// from the caller's question request, learner save, URL query or receipt itself.
async function installed(read,bootstrap){
 requireThat(bootstrap?.state==='PINNED_ISSUED_SUPPLIER'&&[bootstrap.publisherTrustSHA256,bootstrap.manifestSHA256,bootstrap.scopeDigest].every(x=>SHA.test(x??'')),'TRUSTED_CONSUMER_BOOTSTRAP_NOT_INSTALLED');
 const trustBytes=await read(new URL('controls/publisher-trust.json',root),1048576);await verifyBytes(trustBytes,bootstrap.publisherTrustSHA256);const trust=decode(trustBytes);
 requireThat(trust.state==='ISSUED_EXACT_SCOPE','OPERATING_APPROVAL_NOT_ISSUED');
 requireThat(trust.manifestSHA256===bootstrap.manifestSHA256&&trust.scopeDigest===bootstrap.scopeDigest,'CONSUMER_BOOTSTRAP_MISMATCH');
 const get=f=>read(new URL(f,root),33554432);
 const [manifestBytes,receiptBytes,approvalBytes,scopeBytes,codeClosureBytes,dataInventoryBytes,compatibilityBytes,supplyPolicyBytes]=await Promise.all(['operating-manifest.json','operating-receipt.json','operating-approval.json','scope.json','code-closure.json','data-inventory.json','policies/compatibility.json','policies/supply.json'].map(get));
 const grant=await verifyAuthority({trust,manifestBytes,receiptBytes,approvalBytes,scopeBytes,codeClosureBytes,dataInventoryBytes,compatibilityBytes,supplyPolicyBytes});
 return {get,grant,manifest:decode(manifestBytes),scope:decode(scopeBytes),codeClosureBytes};
}
async function prepareSealed(x,read,selection){
 await verifyCodeClosure(root,read,x.codeClosureBytes);
 const resourceBytes=await x.get('assets/resources.json'),pinsBytes=await x.get('assets/code-input-pins.json'),mappingBytes=await x.get('assets/objectives.json');
 await verifyBytes(resourceBytes,x.scope.resourceConfigSHA256);await verifyBytes(pinsBytes,x.scope.codeInputPinsSHA256);await verifyBytes(mappingBytes,x.scope.objectiveMappingSHA256);
 const resources=decode(resourceBytes),pins=decode(pinsBytes);
 requireThat(resources.scopeConditions===124375&&resources.scopeProfiles===840,'RESOURCE_SCOPE_MISMATCH');
 const io=await createAssetIO(root,{readBytes:read,resources,codePins:pins}),runtime=await createConnectedRuntime(io,resources,pins),banks=await runtime.prepareBySemester(selection);
 return {status:'RECEIPT_VERIFIED_PREPARED',grant:x.grant,runtime,banks,studentSupplyEnabled:false,rewardEligible:false};
}
export async function openOperatingBank(request){
 return held(Error('TRUSTED_CONSUMER_INITIALIZATION_AND_STUDENT_ACTIVATION_REQUIRED'));
}
// Call ONCE with constants pinned in the café build, not request/save/query data.
// The bootstrap is generated after receipt/manifest issuance, outside the
// supplier code/scope digest; the later café entry hash pins that bootstrap.
export function createTrustedConsumerClient(bootstrap){
 const fixed=Object.freeze(structuredClone(bootstrap));
 return Object.freeze({async openAuthorizedDeveloperSession(request){
 try{
  requireThat(['localhost','127.0.0.1','[::1]'].includes(globalThis.location?.hostname),'PRIVATE_LOCAL_DEVELOPER_ENVIRONMENT_REQUIRED');
  const x=await installed(browserRead,fixed);checkTargetConsumer(request?.consumer,x.grant.policy);
  return prepareSealed(x,browserRead,request.selection);
 }catch(e){return held(e);}
 },async openOperatingBank(){return held(Error('STUDENT_ACTIVATION_NOT_INCLUDED_IN_THIS_HANDOFF'));}});
}
// Explicit NODE-only, real-receipt verification path. No forged receipt or
// activation flag is needed. Until issuance, this returns the same HELD state.
export async function openIssuedLocalVerification(request){
 try{
  requireThat(typeof process!=='undefined'&&process.versions?.node,'LOCAL_ISSUED_VERIFICATION_NODE_ONLY');
  const fs=await import('node:fs/promises');const read=async(url,max)=>{requireThat(url.protocol==='file:','LOCAL_FILE_ONLY');const stat=await fs.stat(url);requireThat(stat.size<=max,'RESOURCE_TOO_LARGE');return new Uint8Array(await fs.readFile(url));};
  const bootstrap=decode(await read(new URL('controls/consumer-bootstrap.json',root),1048576));
  const x=await installed(read,bootstrap);checkTargetConsumer(request?.consumer,x.grant.policy);return prepareSealed(x,read,request.selection);
 }catch(e){return held(e);}
}
