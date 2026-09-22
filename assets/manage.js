'use strict';
const $ = id => document.getElementById(id);
const KEY = 'collection-draft-v1';
let published, draft, baseline, editing = null, history = [];
const clone = value => JSON.parse(JSON.stringify(value));
function status(message, error = false) { $('status').textContent = message; $('status').className = error ? 'error' : ''; }
function validate(data) {
  if (data?.schema_version !== 1 || !['people','categories','items'].every(k => Array.isArray(data[k]))) throw Error('檔案格式不符。');
  if (data.items.length > 10000) throw Error('最多支援 10,000 筆收藏。');
  const people = new Set(), names = new Set(), cats = new Set(), codes = new Set();
  data.people.forEach(p => {
    if (typeof p.id !== 'string' || !p.id || people.has(p.id) || !Array.isArray(p.aliases)) throw Error('女優資料或 ID 重複。');
    people.add(p.id);
    [p.name,...p.aliases].forEach(n => {if (typeof n !== 'string' || !n.trim() || names.has(n)) throw Error('姓名或別名重複。'); names.add(n);});
  });
  data.categories.forEach(c => {
    if (typeof c.id !== 'string' || !c.id || cats.has(c.id) || typeof c.name !== 'string' || !c.name.trim() || !['person','group','compilation','pending'].includes(c.kind) || !Array.isArray(c.people) || c.people.some(x => !people.has(x))) throw Error('分類資料不正確。');
    cats.add(c.id);
    if (c.links !== undefined && !Array.isArray(c.links)) throw Error('連結資料不正確。');
    (c.links || []).forEach(l => {if (typeof l.name !== 'string' || new URL(l.url).protocol !== 'https:') throw Error('連結格式不正確。');});
  });
  data.items.forEach(x => {
    if (typeof x.code !== 'string' || !/^\d*[A-Z]+-\d{3,6}(?:-V)?$/.test(x.code) || codes.has(x.code)) throw Error(`番號格式錯誤或重複：${x.code || ''}`);
    codes.add(x.code);
    if (!cats.has(x.category) || !Array.isArray(x.people) || x.people.some(p => !people.has(p)) || new Set(x.people).size !== x.people.length || (x.note !== undefined && typeof x.note !== 'string')) throw Error('作品分類或參與者不正確。');
  });
  if (codes.has('SNOS-323') || codes.has('YUJ-172')) throw Error('包含已知誤植番號，請確認。');
  if (baseline.some(code => !codes.has(code))) throw Error('不得移除原有核對過的收藏；如需更正原始番號，請同步更新核對基準。');
}
function save(next, message) {
  validate(next);
  const saved = JSON.stringify({base: JSON.stringify(published), catalog: next});
  localStorage.setItem(KEY, saved); // Do not claim success if storage is unavailable/full.
  history.push(clone(draft)); if (history.length > 20) history.shift();
  draft = next; render(); status(message + '（僅保存於此瀏覽器，尚未發布）');
}
function options(select, entries, selected = []) {
  select.replaceChildren(); entries.forEach(([value,label]) => {const o = new Option(label,value); o.selected = selected.includes(value); select.add(o);});
}
function render() {
  const selected = $('item-category').value;
  options($('item-category'),draft.categories.map(c=>[c.id,c.name]),[selected]);
  const cast = [...$('cast').selectedOptions].map(o=>o.value);
  options($('cast'),draft.people.map(p=>[p.id,[p.name,...p.aliases].join('／')]),cast);
  $('undo').disabled = !history.length;
  const term = $('manage-search').value.trim().toLowerCase();
  const categories = new Map(draft.categories.map(c=>[c.id,c.name]));
  const list = draft.items.filter(x=>(x.code+' '+categories.get(x.category)).toLowerCase().includes(term));
  $('summary').textContent = `草稿共 ${draft.items.length} 部 · 正式版 ${published.items.length} 部 · 顯示 ${list.length} 部`;
  $('items').replaceChildren();
  list.forEach(item=>{
    const tr = document.createElement('tr');
    [item.code,categories.get(item.category)].forEach(text=>{const td=document.createElement('td');td.textContent=text;tr.append(td);});
    const td=document.createElement('td'),edit=document.createElement('button');edit.textContent='編輯';edit.addEventListener('click',()=>editItem(item));td.append(edit);
    if(!baseline.includes(item.code)){const remove=document.createElement('button');remove.textContent='刪除';remove.addEventListener('click',()=>{if(confirm(`刪除草稿中的 ${item.code}？`)) attempt(()=>{const next=clone(draft);next.items=next.items.filter(x=>x.code!==item.code);save(next,'已刪除');resetForm();});});td.append(remove);}
    tr.append(td);$('items').append(tr);
  });
}
function resetForm(){editing=null;$('item-form').reset();$('form-title').textContent='新增收藏';}
function editItem(item){editing=item.code;$('form-title').textContent='編輯 '+item.code;$('code').value=item.code;$('item-category').value=item.category;options($('cast'),draft.people.map(p=>[p.id,p.name]),item.people);$('note').value=item.note||'';$('item-form').scrollIntoView({behavior:'smooth',block:'center'});$('code').focus();}
function attempt(fn){try{fn();}catch(e){status(e.message,true);}}
function download(data,name){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)+'\n'],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('item-form').addEventListener('submit',e=>{e.preventDefault();attempt(()=>{
  const next=clone(draft),code=$('code').value.trim().toUpperCase(),category=$('item-category').value;
  const people=[...$('cast').selectedOptions].map(o=>o.value);
  const item={code,category,people:people.length?people:next.categories.find(c=>c.id===category).people.slice(),note:$('note').value.trim()};
  if(editing){const index=next.items.findIndex(x=>x.code===editing);next.items[index]=item;}else next.items.push(item);
  save(next,'已儲存');resetForm();
});});
$('category-form').addEventListener('submit',e=>{e.preventDefault();attempt(()=>{const next=clone(draft),name=$('person-name').value.trim(),aliases=$('aliases').value.split(/[／/]/).map(x=>x.trim()).filter(Boolean),id=crypto.randomUUID();next.people.push({id:'person-'+id,name,aliases});const cat={id:'category-'+id,name:[name,...aliases].join('／'),kind:'person',people:['person-'+id],links:[]};let at=next.categories.findIndex(c=>c.kind!=='person');if(at<0)at=next.categories.length;next.categories.splice(at,0,cat);save(next,'已新增分類');$('category-form').reset();});});
$('cancel').addEventListener('click',resetForm);
$('manage-search').addEventListener('input',render);
$('export').addEventListener('click',()=>attempt(()=>{validate(draft);download(draft,'catalog.json');status('已匯出 catalog.json；請依發布步驟上傳 GitHub。');}));
$('backup').addEventListener('click',()=>download(published,'catalog-backup.json'));
$('undo').addEventListener('click',()=>attempt(()=>{if(!history.length)return;const previous=history[history.length-1];localStorage.setItem(KEY,JSON.stringify({base:JSON.stringify(published),catalog:previous}));history.pop();draft=previous;resetForm();render();status('已復原上一步（本機草稿）。');}));
$('reset').addEventListener('click',()=>{if(confirm('放棄本機草稿並重新使用目前載入的正式版？'))attempt(()=>{localStorage.removeItem(KEY);draft=clone(published);history=[];resetForm();render();status('已放棄草稿。');});});
$('import').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>5000000)throw Error('檔案過大。');const next=JSON.parse(await file.text());validate(next);if(confirm(`匯入 ${next.items.length} 部收藏並替換本機草稿？`)){save(next,'已匯入');resetForm();}}catch(err){status(err.message,true);}finally{e.target.value='';}});
async function init(){try{
  const responses=await Promise.all(['data/catalog.json','data/migration-baseline.json'].map(url=>fetch(url,{cache:'no-store'})));
  if(responses.some(r=>!r.ok))throw Error('讀取資料失敗，請重新整理。');
  [published,baseline]=await Promise.all(responses.map(r=>r.json()));validate(published);draft=clone(published);
  let message='已載入正式版。修改後請儲存草稿，再匯出發布。';
  try{const saved=JSON.parse(localStorage.getItem(KEY)||'null');if(saved){validate(saved.catalog);if(saved.base===JSON.stringify(published)){draft=saved.catalog;message='已恢復尚未發布的本機草稿。';}else{message='正式版已有更新。舊草稿未自動套用；請先匯出舊草稿備份，再重新整理資料。';const b=document.createElement('button');b.textContent='下載舊草稿';b.onclick=()=>download(saved.catalog,'previous-draft.json');$('status').after(b);}}}catch(e){message='無法恢復本機草稿；已載入正式版。'+e.message;}
  $('editor').hidden=false;render();status(message);
}catch(e){status(e.message,true);}}
init();
