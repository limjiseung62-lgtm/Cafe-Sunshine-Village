import {createScopedLoader} from './scoped-loader.mjs';
import {loadPinnedCore,bindVerifiedEngine} from './engine-binding.mjs';
import {requireThat,verifyBytes} from './integrity.mjs';
// Shared assembly path: loader -> finite verified capability -> existing core.
// QA is explicit and never alters the public receipt/activation boundary.
export async function createConnectedRuntime(io,config,codePins){
 const mappingBytes=await io.readMetadata('objective-mapping.json');await verifyBytes(mappingBytes,codePins.objectiveMappingSHA256);
 const mapping=JSON.parse(new TextDecoder('utf8',{fatal:true}).decode(mappingBytes));
 const core=await loadPinnedCore(io.readCode,codePins),loader=createScopedLoader(io,config,mapping);
 return {core,loader,async prepare(selection){const handle=await loader.load(selection);return bindVerifiedEngine(handle,core);},
  async prepareBySemester(selection){requireThat(selection.choices?.length,'CHOICES_REQUIRED');const banks=new Map();for(const sem of new Set(selection.choices.map(c=>Number(c.unitId[3])))){const bank=await this.prepare({...selection,choices:selection.choices.filter(c=>Number(c.unitId[3])===sem)});banks.set(`g4s${sem}`,bank);}return banks;}};
}
