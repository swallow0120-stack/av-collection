const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../assets/site.js'),'utf8');
function fixture(urls){
 const probes=[],timers=new Map();let id=0;
 const stub=()=>({cloneNode:stub});
 const stage={firstElementChild:stub(),replaceChildren(node){this.node=node;}};
 const link={removeAttribute(){delete this.href;}};
 const next={addEventListener(_,fn){this.click=fn;}};
 const status={};
 const box={dataset:{previewUrls:JSON.stringify(urls),code:'TEST-123'},querySelector(s){return {'.preview-stage':stage,'.preview-open':link,'.preview-next':next,'.preview-status':status}[s];}};
 const context={URL,Image:class{constructor(){probes.push(this);}},setTimeout(fn){timers.set(++id,fn);return id;},clearTimeout(id){timers.delete(id);},document:{createElement(tag){return {tag,setAttribute(k,v){this[k]=v;}};}}};
 vm.createContext(context);
 vm.runInContext(source.slice(source.indexOf('function setupPreview'),source.indexOf('const previewStarts')),context);
 const start=context.setupPreview(box);start();
 return {probes,timers,stage,link,next,status,start};
}
const image='https://example.com/images/test123.jpg',page='https://example.com/details/test00123';
test('successful image stops fallback',()=>{const f=fixture([image,page]);f.probes[0].naturalWidth=100;f.probes[0].onload();assert.equal(f.stage.node,f.probes[0]);assert.equal(f.link.href,image);assert.equal(f.timers.size,0);});
test('failure shows webpage message and retains original link',()=>{const f=fixture([image,page]);f.probes[0].onerror();assert.equal(f.stage.node.tag,'div');assert.match(f.stage.node.textContent,/開啟原網頁/);assert.equal(f.link.href,page);assert.match(f.status.textContent,/已準備開啟連結/);});
test('timeout advances and late success cannot replace new source',()=>{const f=fixture([image,page]);const late=f.probes[0].onload;[...f.timers.values()][0]();late();assert.match(f.stage.node.textContent,/開啟原網頁/);assert.equal(f.link.href,page);});
test('manual next protects against stale callbacks and wraps',()=>{const f=fixture([image,page]);const late=f.probes[0].onload;f.next.click();late();assert.match(f.stage.node.textContent,/開啟原網頁/);f.next.click();assert.equal(f.link.href,image);assert.equal(f.probes.length,2);});
test('all image failures retain placeholder and link',()=>{const f=fixture([image]);f.probes[0].onerror();assert.equal(f.next.disabled,true);assert.equal(f.link.href,image);assert.match(f.status.textContent,/失敗/);assert.equal(f.timers.size,0);});
