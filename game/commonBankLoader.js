import{loadStudentMath}from'./student-cafe-supply.js';
import {issuedLocal,loadIssuedMath,ISSUED_MANIFEST} from './issuedMathLocal.js';
import { assertScienceOperational } from './scienceOperational.js';
import { scopedMathKey, verifyScopedMathCode } from './scopedMathTransport.js';
import { commonBankPins } from './commonBankPins.js';
const cache = new Map();
async function digest(b) { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(b).buffer)), x => x.toString(16).padStart(2, '0')).join(''); }
/** Transport compression is lossless. Supplier manifest/data/reference hashes remain unchanged. */
export function loadCommonRuntime(subject, choices, options = {}) {
    if(subject==='math'&&choices?.length&&choices.every(c=>/^g4s[12]$/.test(c.semesterKey))&&globalThis.__QB3_MODE==='student'&&(!(options.manifestSHA256??globalThis.__SUNSHINE_EXPECTED_MATH_PIN)||(options.manifestSHA256??globalThis.__SUNSHINE_EXPECTED_MATH_PIN)==='1e4acf80c8fb806b3b53339eca14252f4b6cace0c88c065d78e32b1545ce0f0e'))return loadStudentMath(choices);
    const expected=options.manifestSHA256??globalThis.__SUNSHINE_EXPECTED_MATH_PIN;if(subject==='math'&&issuedLocal()&&expected&&![ISSUED_MANIFEST,'2947f91645686b9fc3b13bae9aa4c7f26e6180e1c623c91da5f935efe4a361fb',...commonBankPins.filter(p=>p.subject==='math').map(p=>p.manifestSHA256)].includes(expected))throw Error('알 수 없는 수학 공급 버전이에요. 기존 기록을 유지하고 공급을 보류해요.');
    if(subject==='math' && issuedLocal() && choices?.length && choices.every(c=>/^g4s[12]$/.test(c.semesterKey)) && (!(options.manifestSHA256??globalThis.__SUNSHINE_EXPECTED_MATH_PIN)||(options.manifestSHA256??globalThis.__SUNSHINE_EXPECTED_MATH_PIN)===ISSUED_MANIFEST))return loadIssuedMath(choices);
    if (subject === 'math' && (globalThis.__QB3_MODE === 'candidate'||(issuedLocal()&&(options.manifestSHA256??globalThis.__SUNSHINE_EXPECTED_MATH_PIN)==='2947f91645686b9fc3b13bae9aa4c7f26e6180e1c623c91da5f935efe4a361fb')) && ['127.0.0.1','localhost','[::1]'].includes(location.hostname) && choices?.length && choices.every(c=>/^g4s[12]$/.test(c.semesterKey)) && (!(options.manifestSHA256 ?? globalThis.__SUNSHINE_EXPECTED_MATH_PIN) || (options.manifestSHA256 ?? globalThis.__SUNSHINE_EXPECTED_MATH_PIN)==='2947f91645686b9fc3b13bae9aa4c7f26e6180e1c623c91da5f935efe4a361fb'))
        return import(new URL('./qa-provider.js', document.baseURI).href).then(m => m.loadQA(choices));
    if (subject === 'korean-literacy' || subject === 'social-studies') {
        for (const old of cache.keys())
            if (old.startsWith('math:'))
                cache.delete(old);
        return (async () => { const code = new URL('sq-learning/approved-runtime.mjs', document.baseURI).href, module = await import(code), runtime = await module.loadApprovedSubject(subject, 'cafe-learning-tycoon'), base = new URL('assets/common-learning/math/', document.baseURI), [reports, reportPort, png] = await Promise.all(['report.mjs', 'report-port.mjs', 'png.mjs'].map(f => import(new URL(f, base).href))); return { subject, module, runtime, reports, reportPort, png, manifestSHA256: runtime.info.manifestSHA256 }; })();
    }
    const key = subject === 'math' ? 'math:' + JSON.stringify(scopedMathKey(choices)) : subject;
    for (const old of cache.keys())
        if (old.startsWith('math:') && old !== key)
            cache.delete(old);
    if (!cache.has(key)) {
        const promise = (async () => {
            const p = commonBankPins.find(p => p.subject === subject);
            if (!p)
                throw Error('지원하지 않는 과목이에요.');
            const loaded = new Map();
            const readAsset = (name) => { if (!loaded.has(name))
                loaded.set(name, (async () => { const f = p.files.find(f => f.path === name); if (!f)
                    throw Error('승인 목록에 없는 자산이에요: ' + name); const r = await fetch(p.base + f.url); if (!r.ok)
                    throw Error('공통 학습 자료를 불러오지 못했어요.'); let b = new Uint8Array(await r.arrayBuffer()); if (b.length !== f.transportBytes || await digest(b) !== f.transportSHA256)
                    throw Error('공통 학습 운송 해시가 달라요.'); if (f.gzip) {
                    const stream = new Blob([b]).stream().pipeThrough(new DecompressionStream('gzip'));
                    b = new Uint8Array(await new Response(stream).arrayBuffer());
                } if (b.length !== f.bytes || await digest(b) !== f.sha256)
                    throw Error('승인된 원본 해시가 달라요.'); return b; })()); return loaded.get(name); };
            // Verify fixed code pins before importing any supplier module. No admin/demo UI or styles are mounted.
            await Promise.all(p.files.filter(f => f.path.endsWith('.mjs')).map(f => readAsset(f.path)));
            const base = new URL(p.base, document.baseURI);
            const module = await import(subject === 'math' ? await verifyScopedMathCode() : new URL(p.runtime, base).href);
            const runtime = await module.loadCommonBank({ manifestBytes: await readAsset(p.manifest), expectedManifestSHA256: p.manifestSHA256, readAsset, consumer: 'cafe-learning-tycoon', purpose: 'operational-supply', ...(subject === 'math' ? { cafeScope: choices } : {}) });
            if (subject === 'science')
                assertScienceOperational(p.manifestSHA256, runtime);
            const [reports, reportPort, png] = await Promise.all(['report.mjs', 'report-port.mjs', 'png.mjs'].map(f => import(new URL(f, base).href)));
            return { subject, module, runtime, reports, reportPort, png, manifestSHA256: p.manifestSHA256 };
        })().catch(error => { if (cache.get(key) === promise)
            cache.delete(key); throw error; });
        cache.set(key, promise);
    }
    return cache.get(key);
}
