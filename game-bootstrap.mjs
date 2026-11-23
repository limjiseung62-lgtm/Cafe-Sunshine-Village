if(!document.querySelector('link[rel=icon]')){const icon=document.createElement('link');icon.rel='icon';icon.href='data:,';document.head.append(icon)}
import{installQb3Transport}from'./qb3-transport.mjs?v=20261119-QB3-PUBLIC-1';
import{RELEASE,releaseEnvironment}from'./release-config.mjs';
const environment=releaseEnvironment(location.href);if(environment!=='local-qa'&&!RELEASE.studentActivation)throw Error('정식 출시 승인 대기: 학생 공급은 아직 활성화하지 않았어요.');installQb3Transport();globalThis.__QB3_MODE='student';globalThis.__QA_CANDIDATE_MANIFEST='2947f91645686b9fc3b13bae9aa4c7f26e6180e1c623c91da5f935efe4a361fb';
import{storageFailure}from'./storage-errors.mjs?v=20261119-3';
import{installStorage}from'./storage-init.mjs?v=20261119-3';import{recoverJournal}from'./transactions.mjs?v=20261119-3';
if(parent===window){location.replace(new URL('./',import.meta.url));}else try{await installStorage();recoverJournal(localStorage);await globalThis.__SUNSHINE_STORAGE_FLUSH();await import('./game/v30CommonEntry.js?storageBuild=20261119-3');await import('./game/mobilePlay.mjs?v=20261119-3');await import('./src/rc2-bridge.mjs');await import('./native-backup-bridge.mjs?v=20261119-3')}catch(e){const p=document.createElement('p');p.textContent='테스트 카페를 안전하게 열지 못했어요. 기존 저장은 유지돼요. '+(['QuotaExceededError','SecurityError','NotAllowedError'].includes(e.name)||e.code?.startsWith?.('SUNSHINE_')?storageFailure(e).message:e.message);document.body.append(p)}

const releaseBanner=document.querySelector('.mega-candidate-banner');if(releaseBanner)releaseBanner.textContent='다시, 햇살마을 · 정식판 · 카페 v3.2 · 수학 3.0 승인 운영팩';
