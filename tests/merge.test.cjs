const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const C=require('../src/lib/core.cjs');
const draft=Object.fromEntries(Object.values(C.legacyKeys).map(k=>[k,'']));
const defaults={version:2,updatedAt:'',draft,verbs:[{verb:'Led',category:'Leadership'}],acronyms:['AF'],reports:[],activeReportId:''};
const legacy={version:1,draft:{...draft,executing_mission:'x'.repeat(501),parking_lot:'notes, "quotes"\nsecond line'},verbs:[{verb:'Custom',category:'<img src=x onerror=alert(1)>'}],acronyms:[]};
const imported=C.sanitizeBackup({state:legacy},defaults);
assert.equal(imported.draft.executing_mission.length,501,'Never truncate legacy JSON');
assert.equal(imported.reports[0].mission.length,501);
assert.deepEqual(imported.acronyms,[],'Preserve empty custom lists');
assert.deepEqual(C.importCSV(C.serialize(imported.reports)),imported.reports);
assert.equal(C.draftFromReport(imported.reports[0]).parking_lot,legacy.draft.parking_lot);
assert.throws(()=>C.sanitizeBackup({},defaults),/recognized/);
assert.throws(()=>C.sanitizeBackup({draft:[]},defaults),/recognized/);
assert.throws(()=>C.sanitizeBackup({draft:{...draft,duty_description:{bad:1}}},defaults),/Invalid text/);
assert.throws(()=>C.sanitizeBackup({...legacy,reports:[imported.reports[0],imported.reports[0]]},defaults),/duplicate/);
const two=C.sanitizeBackup({...legacy,reports:[imported.reports[0],{...C.blank(),id:'second',name:'Second officer'}],activeReportId:imported.activeReportId},defaults);
assert.equal(two.reports[1].name,'Second officer');
assert.equal(C.sanitizeBackup({state:two},defaults).reports.length,2);
assert.equal(C.mergeVerbs([{verb:'Led',category:'Leadership'}],[{verb:'led',category:'leadership'},{verb:'Led',category:'Project'}]).length,2);
assert(!C.advisory('Led a team. Mission improved.','executing_mission',defaults.verbs,[]).some(t=>/passed|another concise/.test(t)));
assert(!C.advisory('THIS SECTION NOT USED','executing_mission',[],[]).some(t=>/acronym/.test(t)));

// Execute actual app + storage functions without a browser; isolate storage and DOM status.
const status={};const memory=new Map();
const context={console,setTimeout,clearTimeout,crypto:require('node:crypto').webcrypto,document:{getElementById:()=>status,addEventListener(){},querySelectorAll:()=>[]},localStorage:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)}};
context.window=context;context.globalThis=context;vm.createContext(context);
for(const name of ['core.cjs','data.js','storage.js','writing.js']){
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..','src','lib',name),'utf8'),context);
}
const source=fs.readFileSync(path.join(__dirname,'..','src','lib','app.js'),'utf8').replace(/\s*initialize\(\)\.catch\([\s\S]*?;\s*$/,'');
vm.runInContext(source+'\nglobalThis.testAPI={sanitizeState,createDefaultState,initializeStorage,saveStateNow,queueSave,insertAtCursor,importBackup,markMutated,getState:()=>state,setState:s=>state=s};',context);
(async()=>{
 const A=context.testAPI;
 A.setState(A.sanitizeState(legacy));await A.saveStateNow();
 assert(memory.has('OPBPrepToolFallbackState'),'Save falls back without IndexedDB');
 A.setState(A.createDefaultState());await A.initializeStorage();assert.equal(A.getState().draft.executing_mission.length,501,'Fallback restores all text');
 const element={selectionStart:0,selectionEnd:0,value:'a'.repeat(350),maxLength:350,focus(){},setSelectionRange(){},dispatchEvent(){}};
 context.Event=function(){};A.insertAtCursor(element,'Led ');assert.equal(element.value.length,354,'Insertion preserves remainder beyond limit');
 memory.delete('OPBPrepToolFallbackState');const first={...C.blank(),id:'first',mission:'Original work'};memory.set('opb-studio-v1',JSON.stringify({reports:[first],currentId:'first'}));A.setState(A.createDefaultState());await A.initializeStorage();assert.equal(A.getState().draft.executing_mission,'Original work','Earlier Studio migration retains draft');
 context.confirm=()=>true;
 context.FileReader=function(){this.readAsText=file=>{this.result=file.content;this.completion=this.onload();context.pendingImport=this.completion;};};
 vm.runInContext('renderReportControls=()=>{};renderFields=()=>{};renderVerbControls=()=>{};renderCustomAcronyms=()=>{};updatePreview=()=>{};',context);
 A.importBackup({size:1000,content:JSON.stringify({state:legacy})});await context.pendingImport;
 assert.match(status.textContent,/imported and saved/,'Import callback completes successfully');
 assert.equal(A.getState().draft.executing_mission.length,501);

 // Race-condition check: a stale queued save cannot overwrite a newer mutation/report switch.
 const v1 = A.markMutated();
 A.getState().draft.duty_description = 'Report A edit';
 const staleSave = A.saveStateNow(v1 - 1);
 await staleSave;
 const v2 = A.markMutated();
 A.getState().draft.duty_description = 'Report B newer edit';
 await A.saveStateNow(v2);
 const persisted = JSON.parse(memory.get('OPBPrepToolFallbackState'));
 assert.equal(persisted.draft.duty_description, 'Report B newer edit', 'Newer edit must win over stale save version');

 // Race-condition check: an older slower async import cannot overwrite a newer import.
 const readers = [];
 context.FileReader = function(){ this.readAsText = file => { this.file = file; readers.push(this); }; };
 const newerLegacy = { ...legacy, draft: { ...draft, duty_description: 'Newer import wins' } };
 const olderLegacy = { ...legacy, draft: { ...draft, duty_description: 'Older stale import' } };
 A.importBackup({ size: 500, content: JSON.stringify({ state: olderLegacy }) });
 A.importBackup({ size: 500, content: JSON.stringify({ state: newerLegacy }) });
 readers[1].result = readers[1].file.content;
 await readers[1].onload();
 readers[0].result = readers[0].file.content;
 await readers[0].onload();
 assert.equal(A.getState().draft.duty_description, 'Newer import wins', 'Stale async import must be ignored');

 context.localStorage.setItem=()=>{throw Error('Storage blocked');};
 assert.equal(await A.saveStateNow(),false);assert.match(status.textContent,/unavailable/);
 console.log('Passed: legacy JSON migration, full backup round trips, multiple reports, validation, advisory behavior, storage fallback/recovery, race guards, old Studio recovery, and lossless verb insertion.');
})().catch(e=>{console.error(e);process.exitCode=1;});
