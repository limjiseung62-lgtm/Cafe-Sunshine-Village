import{RELEASE,releaseEnvironment}from'./release-config.mjs';
export const held=reason=>Object.freeze({status:'HELD',reason,items:Object.freeze([]),studentSupplyEnabled:false,rewardEligible:false});
export function studentPolicy(){try{releaseEnvironment(location.href)}catch{return held('UNAPPROVED_CONSUMER_HOST_OR_PATH')}if(!RELEASE.studentActivation)return held('FINAL_STUDENT_ACTIVATION_NOT_APPROVED');return held('ISSUED_STUDENT_API_CONTRACT_NOT_AVAILABLE')}
export const localContractQA=()=>!!globalThis.location&&['localhost','127.0.0.1','[::1]'].includes(location.hostname);
