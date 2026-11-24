pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
const $=id=>document.getElementById(id);
let tabs=[],cur=-1,tool=null,mode='cont',zoom=.8,folder='Geral';
/* ---------- Biblioteca (IndexedDB) ---------- */
let db;const req=indexedDB.open('icm',1);
req.onupgradeneeded=e=>e.target.result.createObjectStore('files',{keyPath:'id',autoIncrement:true});
req.onsuccess=e=>{db=e.target.result;loadLib()};
const tx=m=>db.transaction('files',m).objectStore('files');
const folders=()=>JSON.parse(localStorage.getItem('folders')||'["Geral"]');
function loadLib(){
  tx('readonly').getAll().onsuccess=e=>{
    const files=e.target.result,q=$('search').value.toLowerCase(),L=$('library');L.innerHTML='';
    folders().forEach(f=>{
      const d=document.createElement('div');d.className='folder'+(f===folder?' sel':'');d.textContent='📁 '+f;
      d.onclick=()=>{folder=f;loadLib()};L.appendChild(d);
      files.filter(x=>x.folder===f&&x.name.toLowerCase().includes(q)).forEach(x=>{
        const r=document.createElement('div');r.className='file';
        r.innerHTML='<span>'+x.name.replace(/</g,'&lt;')+'</span><b>✕</b>';
        r.firstChild.onclick=()=>openBuf(x.blob,x.name);
        r.lastChild.onclick=()=>{if(confirm('Remover "'+x.name+'"?'))tx('readwrite').delete(x.id).onsuccess=loadLib};
        L.appendChild(r);
      });
    });
  };
}
$('newFolder').onclick=()=>{const n=prompt('Nome da pasta:');if(n){const f=folders();f.push(n);localStorage.setItem('folders',JSON.stringify(f));folder=n;loadLib()}};
$('refresh').onclick=loadLib;$('search').oninput=loadLib;
$('addLib').onchange=e=>{[...e.target.files].forEach(f=>tx('readwrite').add({name:f.name,folder,blob:f}).onsuccess=loadLib);e.target.value=''};
$('menuBtn').onclick=()=>$('side').classList.toggle('open');
/* ---------- Abrir arquivos ---------- */
[$('openBtn'),$('o1')].forEach(b=>b.onclick=()=>$('fileIn').click());
$('o2').onclick=()=>$('imgIn').click();
$('fileIn').onchange=e=>{[...e.target.files].forEach(f=>openBuf(f,f.name));e.target.value=''};
$('imgIn').onchange=e=>{const f=e.target.files[0];if(!f)return;const img=new Image();img.onload=()=>addTab({name:f.name,img,n:1,ann:{}});img.src=URL.createObjectURL(f);e.target.value=''};
document.addEventListener('dragover',e=>e.preventDefault());
document.addEventListener('drop',e=>{e.preventDefault();[...e.dataTransfer.files].forEach(f=>f.type==='application/pdf'&&openBuf(f,f.name))});
async function openBuf(blob,name){
  const pdf=await pdfjsLib.getDocument({data:await blob.arrayBuffer()}).promise;
  addTab({name,pdf,n:pdf.numPages,ann:{},blob});
}
function addTab(t){t.page=1;tabs.push(t);cur=tabs.length-1;drawTabs();render()}
function drawTabs(){
  $('tabs').innerHTML='';
  tabs.forEach((t,i)=>{const d=document.createElement('div');d.className='tab'+(i===cur?' active':'');
    d.innerHTML='<span>'+t.name.replace(/</g,'&lt;')+'</span><b>✕</b>';
    d.firstChild.onclick=()=>{cur=i;drawTabs();render()};
    d.lastChild.onclick=()=>{tabs.splice(i,1);cur=Math.min(cur,tabs.length-1);drawTabs();render()};
    $('tabs').appendChild(d)});
}
/* ---------- Renderização ---------- */
async function render(){
  const P=$('pages');P.innerHTML='';P.className=mode==='lat'?'lat':'';
  const t=tabs[cur];$('empty').hidden=!!t;$('nav').hidden=!t||mode==='cont';
  if(!t)return;
  const list=mode==='cont'?[...Array(t.n).keys()].map(i=>i+1):[t.page];
  $('pg').textContent=t.page+' / '+t.n;
  for(const n of list){
    const box=document.createElement('div');box.className='page';P.appendChild(box);
    const c=document.createElement('canvas');c.className='pdf';box.appendChild(c);
    const o=document.createElement('canvas');o.className='ov';box.appendChild(o);
    let w,h;const dpr=Math.min(devicePixelRatio||1,2);
    if(t.img){const s=zoom*Math.min(1,innerWidth/t.img.width*1.2);w=t.img.width*s;h=t.img.height*s;
      c.width=w*dpr;c.height=h*dpr;c.style.width=w+'px';c.style.height=h+'px';
      c.getContext('2d').drawImage(t.img,0,0,c.width,c.height)}
    else{const pg=await t.pdf.getPage(n),vp=pg.getViewport({scale:zoom*1.3});w=vp.width;h=vp.height;
      c.width=w*dpr;c.height=h*dpr;c.style.width=w+'px';c.style.height=h+'px';
      pg.render({canvasContext:c.getContext('2d'),viewport:pg.getViewport({scale:zoom*1.3*dpr})})}
    o.width=w;o.height=h;o.style.width=w+'px';o.style.height=h+'px';
    box._n=n;setupOverlay(box,o,t,n);redraw(box,o,t,n);
  }
}
function A(t,n){return t.ann[n]||(t.ann[n]={s:[],x:[]})}
function redraw(box,o,t,n){
  const g=o.getContext('2d');g.clearRect(0,0,o.width,o.height);g.lineCap='round';g.lineJoin='round';
  A(t,n).s.forEach(s=>{g.strokeStyle=s.c;g.lineWidth=s.w;g.beginPath();s.p.forEach(([x,y],i)=>i?g.lineTo(x*o.width,y*o.height):g.moveTo(x*o.width,y*o.height));g.stroke()});
  box.querySelectorAll('.tx').forEach(e=>e.remove());
  A(t,n).x.forEach(x=>{const d=document.createElement('div');d.className='tx';d.textContent=x.t;d.style.color=x.c;
    d.style.left=x.x*o.width+'px';d.style.top=x.y*o.height+'px';
    d.ondblclick=()=>{const v=prompt('Editar (vazio apaga):',x.t);if(v===null)return;if(v==='')A(t,n).x.splice(A(t,n).x.indexOf(x),1);else x.t=v;redraw(box,o,t,n)};
    let drag=0;d.onpointerdown=e=>{drag=1;d.setPointerCapture(e.pointerId)};
    d.onpointermove=e=>{if(!drag)return;const r=o.getBoundingClientRect();x.x=(e.clientX-r.left)/r.width;x.y=(e.clientY-r.top)/r.height;d.style.left=x.x*o.width+'px';d.style.top=x.y*o.height+'px'};
    d.onpointerup=()=>drag=0;box.appendChild(d)});
}
function setupOverlay(box,o,t,n){
  let s=null;const pt=e=>{const r=o.getBoundingClientRect();return[(e.clientX-r.left)/r.width,(e.clientY-r.top)/r.height]};
  o.onpointerdown=e=>{
    if(tool==='pen'){s={c:$('color').value,w:+$('thick').value,p:[pt(e)]};A(t,n).s.push(s);o.setPointerCapture(e.pointerId)}
    else if(tool==='text'){const v=prompt('Texto (ex.: ♯ ♭ ♮, acordes, notas):');if(v){const[x,y]=pt(e);A(t,n).x.push({t:v,x,y,c:$('color').value});redraw(box,o,t,n)}}};
  o.onpointermove=e=>{if(s){s.p.push(pt(e));redraw(box,o,t,n)}};
  o.onpointerup=()=>s=null;
}
function setTool(x){tool=tool===x?null:x;$('penBtn').classList.toggle('on',tool==='pen');$('textBtn').classList.toggle('on',tool==='text');document.body.classList.toggle('drawing',!!tool)}
$('penBtn').onclick=()=>setTool('pen');$('textBtn').onclick=()=>setTool('text');
$('undoBtn').onclick=()=>{const t=tabs[cur];if(!t)return;const a=A(t,mode==='cont'?[...document.querySelectorAll('.page')].pop()._n:t.page);a.s.pop();render()};
$('zoomSel').onchange=e=>{zoom=parseInt(e.target.value)/100;render()};
$('modeSel').onchange=e=>{mode=e.target.value;render()};
$('prev').onclick=()=>{const t=tabs[cur];if(t.page>1){t.page--;render()}};
$('next').onclick=()=>{const t=tabs[cur];if(t.page<t.n){t.page++;render()}};
$('darkBtn').onclick=()=>{document.body.classList.toggle('dark');localStorage.dark=document.body.classList.contains('dark')?1:''};
if(localStorage.dark)document.body.classList.add('dark');
/* ---------- Afinador ---------- */
let ctx,raf,stream;
$('tunerBtn').onclick=async()=>{
  if(!$('tuner').hidden)return stopTuner();
  try{stream=await navigator.mediaDevices.getUserMedia({audio:true})}catch(e){return alert('Permita o uso do microfone para usar o afinador.')}
  ctx=new AudioContext();const an=ctx.createAnalyser();an.fftSize=2048;ctx.createMediaStreamSource(stream).connect(an);
  $('tuner').hidden=false;const buf=new Float32Array(2048);
  const NN=['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
  (function loop(){an.getFloatTimeDomainData(buf);const f=pitch(buf,ctx.sampleRate);
    if(f>0){const m=12*Math.log2(f/440)+69,r=Math.round(m),c=Math.round((m-r)*100);
      $('note').textContent=NN[((r%12)+12)%12]+(Math.floor(r/12)-1);$('hz').textContent=f.toFixed(1)+' Hz';
      $('cents').textContent=(c>0?'+':'')+c+' cents';$('needle').style.left=(50+c)+'%'}
    raf=requestAnimationFrame(loop)})();
};
function pitch(b,sr){let rms=0;for(const v of b)rms+=v*v;if(Math.sqrt(rms/b.length)<.01)return-1;
  let best=-1,bc=0;const min=Math.floor(sr/1200),max=Math.floor(sr/60);
  for(let l=min;l<max;l++){let c=0;for(let i=0;i<b.length-max;i++)c+=b[i]*b[i+l];if(c>bc){bc=c;best=l}}
  return best>0?sr/best:-1}
function stopTuner(){cancelAnimationFrame(raf);stream&&stream.getTracks().forEach(t=>t.stop());ctx&&ctx.close();$('tuner').hidden=true}
$('tunerClose').onclick=stopTuner;
if('serviceWorker'in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('sw.js').catch(()=>{});
