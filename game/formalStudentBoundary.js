import{ISSUED_MANIFEST}from'./issuedMathLocal.js';
// No public activation artifact exists. Requests cannot override this build policy.
export async function openStudentSupply(){return{status:'HELD',reason:'GAME_BINDING_AND_STUDENT_ACTIVATION_REQUIRED',manifestSHA256:ISSUED_MANIFEST,studentSupplyEnabled:false,rewardEligible:false,items:[]};}
