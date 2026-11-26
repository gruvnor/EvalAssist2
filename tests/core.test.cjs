const assert=require('node:assert/strict');
const C=require('../src/lib/core.cjs');
const r=C.blank();Object.assign(r,{name:'Mitchell, "Jordan"',mission:'Led 12 officers.\nImproved readiness by 20%.',parking:'=SUM(1,2)',duty:'  leading and trailing  ',people:"'literal",resources:' - not a formula',unit:'@test',reviewer:'🙂'});
assert.deepEqual(C.importCSV(C.serialize([r])),[r]);
for(const value of ['','a,b','a"b','a\rb','a\nb',"'=x",'\t=1','+2','-3','@X',"''x",'"', '\n']){const a={...r,parking:value};assert.deepEqual(C.importCSV(C.serialize([a])),[a]);}
assert.deepEqual(C.csvParse('a,b\r\n"c,d","e""f"\r\n'),[['a','b'],['c,d','e"f']]);
assert.throws(()=>C.csvParse('"unfinished'),/Unclosed/);
assert.throws(()=>C.csvParse('"closed"junk'),/Unexpected/);
assert.throws(()=>C.importCSV('name\nJoe'),/Missing/);
assert.throws(()=>C.importCSV(C.serialize([r,r])),/unique/);
for(const f of C.fields){const a=C.blank();a[f.key]='x'.repeat(f.limit);assert(!C.issues(a).some(x=>x.key===f.key&&x.type==='over'));a[f.key]+='x';assert(C.issues(a).some(x=>x.key===f.key&&x.type==='over'));}
const a=C.blank();a.period_start='2026-10-01';a.period_end='2026-01-01';assert(C.issues(a).some(x=>x.key==='period_end'));
assert.equal(C.issues(C.blank()).filter(x=>x.type==='missing').length,6);
console.log('Passed: CSV lossless round trips, formula escaping, malformed input, duplicate IDs, six character boundaries, blank fields, and date checks.');
