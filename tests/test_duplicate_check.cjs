const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {normalize,check}=require('../assets/duplicate-check.js');
const {items}=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/catalog.json'),'utf8'));
test('both reported repurchases are owned',()=>{
  assert.deepEqual(check('START-568\n9SNOS-309',items).map(x=>x.state),['owned','owned']);
});
test('case, full width, hyphens, spaces normalize',()=>{
  for(const code of ['start568','START 568','ＳＴＡＲＴ－５６８','START–568'])assert.equal(normalize(code),'START-568');
  assert.equal(check('start568',items)[0].state,'owned');
  assert.equal(check('9snos309',items)[0].state,'owned');
});
test('confirmed SNOS-309 alias reports owned without changing stored code',()=>{
  const row=check('SNOS-309',items)[0];assert.equal(row.state,'owned');assert.equal(row.matches[0].code,'9SNOS-309');
});
test('unconfirmed prefix difference warns without merging',()=>assert.equal(check('SNOS-059',items)[0].state,'possible'));
test('version difference warns',()=>assert.equal(check('START-568-V',items)[0].state,'possible'));
test('duplicates in shopping list are flagged',()=>assert.equal(check('START568, start-568',items)[1].inList,true));
test('prefix variants in same list flagged even when unowned',()=>assert.equal(check('TEST-001\n9TEST-001',items)[1].similarInList,true));
test('invalid input cannot report not owned',()=>assert.equal(check('unknown ??',items)[0].state,'invalid'));
test('unknown valid code reports missing',()=>assert.equal(check('TEST-999999',items)[0].state,'missing'));
test('unpublished local entry flagged',()=>assert.equal(check('TEST-001',items,[{code:'TEST-001'}])[0].state,'draft'));
test('local deletion cannot hide published ownership',()=>assert.equal(check('START-568',items,[])[0].state,'owned'));
test('bulk text preserves both items',()=>assert.equal(check('START-568  跟 9SNOS-309',items).length,2));
test('empty input returns no misleading result',()=>assert.deepEqual(check('',items),[]));
