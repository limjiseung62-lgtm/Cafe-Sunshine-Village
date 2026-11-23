// Isolated candidate. No approval authority, game state or learner storage here.
export const SHA = /^[a-f0-9]{64}$/;
export function requireThat(ok, reason) { if (!ok) throw new Error(reason); }
export async function digest(bytes) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
}
export async function verifyBytes(bytes, expected) {
  requireThat(SHA.test(expected ?? ''), 'UNSEALED_HASH');
  requireThat(bytes instanceof Uint8Array, 'BYTES_REQUIRED');
  requireThat(await digest(bytes) === expected, 'HASH_MISMATCH');
  return bytes;
}
async function bounded(stream, limit) {
  const reader=stream.getReader(), chunks=[]; let length=0;
  try { for (;;) { const {done,value}=await reader.read(); if(done)break; length+=value.byteLength;
    requireThat(length<=limit,'RESOURCE_TOO_LARGE'); chunks.push(value); }
  } catch(e) { await reader.cancel().catch(()=>{}); throw e; } finally { reader.releaseLock(); }
  const result=new Uint8Array(length); let at=0; for(const c of chunks){result.set(c,at);at+=c.length;} return result;
}
export async function checkedFetch(url,{expectedSHA256,maxBytes=33554432,fetchImpl=globalThis.fetch,signal}={}) {
  requireThat(SHA.test(expectedSHA256 ?? ''),'UNSEALED_HASH');
  const response=await fetchImpl(url,{signal,cache:'no-store'});
  requireThat(response.ok,'RESOURCE_LOAD_FAILED'); requireThat(response.body,'EMPTY_RESPONSE_BODY');
  const declared=Number(response.headers.get('content-length'));
  requireThat(!Number.isFinite(declared)||declared<=maxBytes,'RESOURCE_TOO_LARGE');
  return verifyBytes(await bounded(response.body,maxBytes),expectedSHA256);
}
export async function checkedGzip(bytes,{transportSHA256,decodedSHA256,maxDecodedBytes=33554432}={}) {
  await verifyBytes(bytes,transportSHA256);
  const decoded=await bounded(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')),maxDecodedBytes);
  return verifyBytes(decoded,decodedSHA256);
}
