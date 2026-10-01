'use strict';
const input = document.getElementById('purchase-codes');
const result = document.getElementById('purchase-results');
const freshness = document.getElementById('purchase-freshness');
const checkButton = document.getElementById('purchase-check');
let catalog = null, loadedAt = 0, loading = false, loadError = false;
const snapshot = [...document.querySelectorAll('.category')].flatMap(section => [...section.querySelectorAll('.code')].map(node => ({code:node.textContent, category:section.dataset.category})));
function draftData() {
  try {
    const saved = JSON.parse(localStorage.getItem('collection-draft-v1') || 'null');
    if (saved && (!Array.isArray(saved.catalog?.items) || saved.catalog.items.some(x=>typeof x.code!=='string'))) throw Error();
    return {items: saved?.catalog?.items || [], error: false};
  } catch { return {items: [], error: true}; }
}
function draw() {
  result.replaceChildren();
  const local = draftData();
  const rows = CollectionCheck.check(input.value, catalog?.items || snapshot, local.items);
  const categories = new Map((catalog?.categories || []).map(c=>[c.id,c.name]));
  const fresh = loadedAt > 0 && Date.now()-loadedAt < 60000 && !loading && !loadError;
  const labels = {owned:'已收藏，勿重複購買', possible:'可能已收藏，先核對版本', draft:'本機已有紀錄，尚未發布', missing: fresh && !local.error ? '正式收藏中未找到' : '資料未確認，請勿據此購買', invalid:'無法辨識，請確認完整番號'};
  rows.forEach(row=>{
    const card=document.createElement('article');card.className='check-result '+row.state;
    const title=document.createElement('h3');title.textContent=(row.code||row.raw)+' · '+labels[row.state];card.append(title);
    if(row.inList || row.similarInList){const warning=document.createElement('p');warning.className='list-warning';warning.textContent=row.inList?'這張購物清單也重複列出此番號。':'清單前面已有相同系列與號碼，請核對前綴或版本。';card.append(warning);}
    row.matches.forEach(item=>{const p=document.createElement('p');p.textContent='已有紀錄：'+item.code+(categories.has(item.category)?'｜'+categories.get(item.category):'');card.append(p);});
    if(row.state==='possible'){const p=document.createElement('p');p.textContent='數字前綴或 -V 可能代表不同版本；不自動視為同一部，也不直接當成未收藏。';card.append(p);}
    if(row.state==='missing' && fresh){const p=document.createElement('p');p.textContent='這只表示目前紀錄沒有；尚未記錄或其他裝置的未發布草稿不在此範圍。';card.append(p);}
    result.append(card);
  });
  if(local.error){const p=document.createElement('p');p.className='error';p.textContent='無法讀取本機草稿，查重範圍不完整。';result.prepend(p);}
  const count = rows.filter(r=>r.state==='owned').length;
  document.getElementById('purchase-summary').textContent = rows.length ? `檢查 ${rows.length} 筆，${count} 筆已收藏。` : '購買前先查一次；可一次貼上整張購物清單。';
}
async function refresh() {
  if(loading)return;
  loading=true;checkButton.disabled=true;freshness.textContent='正在重新讀取正式收藏…';draw();
  try {
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
    let data, baseline;
    try {
      const responses=await Promise.all(['data/catalog.json','data/migration-baseline.json'].map(url=>fetch(url+'?t='+Date.now(),{cache:'no-store',signal:controller.signal})));
      if(responses.some(r=>!r.ok))throw Error('讀取失敗');
      [data,baseline]=await Promise.all(responses.map(r=>r.json()));
    } finally {clearTimeout(timer);}
    if(data.schema_version!==1 || !Array.isArray(data.items) || !data.items.length || !Array.isArray(data.categories))throw Error('資料格式異常');
    const codes=data.items.map(x=>CollectionCheck.normalize(x.code));
    if(codes.some(x=>!x) || new Set(codes).size!==codes.length)throw Error('番號格式或重複異常');
    if(!Array.isArray(baseline)||baseline.some(c=>!codes.includes(c)))throw Error('正式資料未包含完整基準');
    catalog=data;loadedAt=Date.now();loadError=false;
    freshness.textContent=`正式資料 ${data.items.length} 筆 · 本次載入 ${new Date(loadedAt).toLocaleTimeString('zh-TW')} · 本機草稿另行提示`;
  } catch(e){loadError=true;freshness.textContent='無法確認最新資料。已收藏項目仍可提示，但「未找到」不能作為購買依據。';}
  finally {loading=false;checkButton.disabled=false;draw();}
}
input.addEventListener('input',draw);
checkButton.addEventListener('click',refresh);
document.getElementById('purchase-clear').addEventListener('click',()=>{input.value='';draw();input.focus();});
document.getElementById('purchase-example').addEventListener('click',()=>{input.value='START-568\n9SNOS-309';draw();refresh();});
window.addEventListener('focus',()=>{if(Date.now()-loadedAt>60000)refresh();else draw();});
window.addEventListener('storage',draw);
setInterval(()=>{if(input.value)draw();},15000);
refresh();
