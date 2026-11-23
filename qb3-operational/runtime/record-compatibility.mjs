import {requireThat,digest} from './integrity.mjs';
export async function inspectOptionalRC1Migration({sourceGeneration,sourceManifestSHA256,nativeBackup,core,positiveGate,mapping}){
 if(sourceGeneration==='math-1.1.x')return {status:'KEEP_LEGACY_PROVIDER',canMigrate:false,originalUnchanged:true};
 requireThat(sourceManifestSHA256==='2947f91645686b9fc3b13bae9aa4c7f26e6180e1c623c91da5f935efe4a361fb','UNKNOWN_RC1_SOURCE_MANIFEST');
 const raw=await core.decode(nativeBackup),safe=new Set(mapping.objectives.map(m=>m.portalObjectiveId));
 const unresolved=raw.deliveries.filter(d=>!Object.hasOwn(positiveGate,d.ref.questionId)).map(d=>d.ref.questionId);
 const badScope=raw.sessions.some(s=>s.scope.skillIds.some(id=>!safe.has(id)));
 if(unresolved.length||badScope)return {status:'KEEP_ORIGINAL_PROVIDER_OR_ARCHIVE_READONLY',canMigrate:false,outsideSubsetRefs:unresolved,originalUnchanged:true};
 return {status:'ELIGIBLE_ONLY_AFTER_USER_CHOICE_AND_TARGET_MANIFEST_VERIFICATION',canMigrate:false,requiresExplicitChoice:true,sourceBackupSHA256:await digest(new TextEncoder().encode(nativeBackup)),requiredChoices:raw.sessions.map(s=>({unitId:s.scope.unitId,objectiveIds:[...s.scope.skillIds],levels:[...s.scope.levels]})),preserveSessionAttemptRewardIDs:true,originalUnchanged:true};
}
