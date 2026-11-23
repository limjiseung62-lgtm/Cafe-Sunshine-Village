import{entries,PLAYER,newPlayer,effectiveCafeLevel}from'./transactions.mjs';
import{emptyProgress}from'./src/story-state.mjs';
import{validateRows,NS}from'./storage-engine.mjs';
import{restoreBeforeRestart}from'./start-over.mjs';
export const IMPORT_ARCHIVE='sunshine-before-growth-import/1',IMPORT_HISTORY='sunshine-growth-import-history/1';
const formats=new Set(['cafe-growth-backup-v30','cafe-growth-backup-v19c','cafe-growth-backup-v16']);
export function classifyGrowthImport(v){
 const wrapped=v?.format==='cafe-common-complete-v1',native=wrapped?v.cafe:v;
 if(!formats.has(native?.format))throw Error('지원하는 카페 성장형 JSON 형식이 아니에요. 다른 게임·출처가 없는 저장은 가져오지 않아요.');
 const unknown=Object.keys(native).filter(k=>!['format','exportedAt','save'].includes(k));if(unknown.length)throw Error('변환할 수 없는 백업 필드: '+unknown.join(', '));
 if(wrapped){const extra=Object.keys(v).filter(k=>!['format','cafe','records'].includes(k));if(extra.length)throw Error('변환할 수 없는 학습 묶음 필드: '+extra.join(', '));if(!Array.isArray(v.records))throw Error('학습 기록 목록이 없어요.');}
 if(native.save?.schemaVersion!==1||native.save?.mode!=='CAFE_GROWTH')throw Error('지원하지 않는 저장 버전 또는 게임 모드예요.');
 return{native,records:wrapped?v.records.length:0};
}
const sha=async text=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(x=>x.toString(16).padStart(2,'0')).join('');
export function installGrowthImporter({rpc,commit,say}){
 const dialog=document.createElement('dialog');dialog.id='growth-import-preview';dialog.style.cssText='width:min(600px,94vw);max-height:88vh;overflow:auto;padding:24px';document.body.append(dialog);
 const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 async function inspect(file){
  if(file.size>32000000)throw Error('백업은32MB까지 확인해요.');const text=await file.text(),v=JSON.parse(text),source=classifyGrowthImport(v),hash=await sha(text),history=JSON.parse(localStorage.getItem(IMPORT_HISTORY)??'[]');
  if(history.length>=200)throw Error('가져오기 보관 한도에 도달했어요. 기록을 지우지 않고 중단했어요.');if(!Array.isArray(history))throw Error('기존 가져오기 이력을 확인하지 못했어요.');if(history.some(x=>x.sha256===hash))throw Error('이미 가져온 파일이에요. 중복 적용하지 않았어요. 이어하기 또는 이전 카페 보관본을 사용해 주세요.');
  const before=JSON.stringify(entries(localStorage)),prepared=await rpc('inspect',{text});
  if(JSON.stringify(entries(localStorage))!==before)throw Error('검사 중 카페 기록이 바뀌었어요. 다시 선택해 주세요.');
  const c=prepared.save,current=JSON.parse(localStorage.getItem('cafe-v30-mega-common-rc1/cafe-learning-tycoon.growth.v1')??'null');
  dialog.innerHTML='<h2>성장형 카페를 새 이야기 프로필로 가져오기</h2><p>파일 '+escape(file.name)+'</p><p>성장 Lv.'+effectiveCafeLevel(c)+' · 보유금 '+c.money.toLocaleString()+'원 · 직원 '+c.staffOwned.length+'명 · 메뉴 '+c.unlockedMenuIds.length+'종</p><p>현재 카페 '+(current?'Lv.'+effectiveCafeLevel(current)+' · '+current.money.toLocaleString()+'원':'없음')+'</p><ul><li>현금·직원·메뉴·가구·재고·성장·영수증과 진행 중 영업 시각을 원본 그대로 보존해요.</li><li>이 파일의 부가 학습 보관기록 '+source.records+'개를 검증해 함께 가져와요. 파일에 없는 기록은 복구할 수 없어요.</li><li>이전 문제은행 이력은 원래 공급기를 사용해요. 운영팩 이력으로 자동 바꾸지 않아요.</li><li>이야기·사진·엔딩 완료를 만들지 않아요. 프롤로그부터 순서대로 만나거나 나중에 시작할 수 있어요.</li><li>지금 카페와 이야기는 이전 카페 보관본에 남겨요. 원본 JSON과 다른 사이트 기록은 변경하지 않아요.</li></ul><label>이야기 시작 방식<select id="import-story-policy"><option value="sequence">프롤로그부터 순서대로</option><option value="deferred">다음 영업 종료 후 이야기 안내</option></select></label><button id="growth-import-confirm">확인 · 이 성장 기록 가져오기</button><button id="growth-import-cancel">취소 · 현재 기록 유지</button><p id="growth-import-status" role="status"></p>';
  dialog.querySelectorAll('button,select').forEach(x=>x.style.cssText='min-height:48px;margin:8px;padding:10px');let writing=false,failed=false;
  const cancel=()=>{if(writing)return;if(failed){location.reload();return;}dialog.close();void rpc('cancel-inspect').catch(()=>{});};dialog.querySelector('#growth-import-cancel').onclick=cancel;dialog.oncancel=e=>{e.preventDefault();cancel()};
  dialog.querySelector('#growth-import-confirm').onclick=async()=>{writing=true;dialog.querySelectorAll('button').forEach(b=>b.disabled=true);try{
   if(JSON.stringify(entries(localStorage))!==before)throw Error('카페가 바뀌었어요. 다시 검사해 주세요.');
   const player={...newPlayer(),createdAt:c.createdAt,lastLevel:effectiveCafeLevel(c)},story=emptyProgress(player.id);story.observed.level=player.lastLevel;story.autoFlow={version:1,mode:dialog.querySelector('#import-story-policy').value,summaryThrough:0};
   const rows=entries(localStorage).filter(([k])=>k!==IMPORT_ARCHIVE);validateRows(rows.map(([k,v])=>[NS+k,v]));
   const archive={format:'sunshine-before-restart/1',reason:'growth-json-import',savedAt:new Date().toISOString(),rows,sha256:await sha(JSON.stringify(rows))};
   await commit(async()=>{if(JSON.stringify(entries(localStorage))!==before)throw Error('카페가 바뀌었어요. 다시 검사해 주세요.');localStorage.setItem(IMPORT_ARCHIVE,JSON.stringify(archive));for(const[k]of rows)if(k.startsWith('learning/'+encodeURIComponent(c.createdAt)+'/'))globalThis.__SUNSHINE_STORAGE_INTERNAL.remove(localStorage,k);localStorage.setItem(PLAYER,JSON.stringify(player));localStorage.setItem('sunshine-story-v1/'+player.id,JSON.stringify(story));await rpc('commit',{token:prepared.token});localStorage.setItem(IMPORT_HISTORY,JSON.stringify([...history,{sha256:hash,playerId:player.id,at:new Date().toISOString()}]));});location.reload();
  }catch(e){writing=false;failed=true;dialog.querySelector('#growth-import-cancel').textContent='기존 기록 다시 열기 · 파일 재선택';dialog.querySelectorAll('button').forEach(b=>b.disabled=false);dialog.querySelector('#growth-import-confirm').disabled=true;dialog.querySelector('#growth-import-status').textContent='가져오지 못했어요. 이전 정상 기록은 보존했어요. 닫은 뒤 파일을 다시 선택해 주세요. '+e.message;}};
  document.getElementById('settings-dialog').close();dialog.showModal();
 }
 const input=document.createElement('input');input.type='file';input.accept='.json,application/json';input.id='growth-native-file';input.hidden=true;input.onchange=()=>{const f=input.files?.[0];if(f)void inspect(f).catch(e=>say(e.message));};
 const b=document.createElement('button');b.id='growth-native-import';b.textContent='기존 성장형 카페 JSON 가져오기';b.style.minHeight='48px';b.onclick=()=>{input.value='';input.click()};document.getElementById('settings-dialog').append(b,input);
 const restore=document.createElement('button');restore.id='restore-before-growth-import';restore.textContent='성장형 가져오기 전 카페로 되돌리기';restore.style.minHeight='48px';restore.hidden=!localStorage.getItem(IMPORT_ARCHIVE);restore.onclick=async()=>{if(!confirm('가져오기 전 카페와 이야기로 돌아갈까요? 현재 기록도 보관본으로 교환해요.'))return;try{await commit(()=>restoreBeforeRestart(localStorage,IMPORT_ARCHIVE,true));location.reload()}catch(e){say(e.message)}};document.getElementById('settings-dialog').append(restore);
}
