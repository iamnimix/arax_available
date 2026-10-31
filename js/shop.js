const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fa=n=>Number(n).toLocaleString('fa-IR');
let db={settings:{},categories:[],products:[]}, cat='', lastN=0;

function normalize(d){
  if(Array.isArray(d))return {settings:{},categories:[],products:d};
  return {settings:d?.settings||{},categories:d?.categories||[],products:d?.products||[]};
}
let failed=false;
async function load(){
  // ۱) فوراً از حافظه‌ی قبلی نشان بده (باز شدن آنی)
  try{const c=localStorage.getItem('arax_cache');if(c){db=normalize(JSON.parse(c));render()}}catch(e){}
  // ۲) اطلاعات تازه
  let d=null;
  try{d=await (window.__p||fetch('data/products.json?t='+Date.now()).then(r=>r.ok?r.json():null))}catch(e){}
  if(d){db=normalize(d);try{localStorage.setItem('arax_cache',JSON.stringify(d))}catch(e){}}
  else if(!db.products.length)failed=true;
  const gc=db.settings.gc;
  if(gc){const s=document.createElement('script');s.async=true;s.dataset.goatcounter=`https://${gc}.goatcounter.com/count`;s.src='//gc.zgo.at/count.js';document.head.appendChild(s)}
  render();
}
// اندازه واقعی عکس حفظ می‌شود (فقط عکس‌های خیلی بلند کمی کوتاه می‌شوند)
function imgFit(i){
  const r=i.naturalHeight/i.naturalWidth;
  i.style.aspectRatio='auto';
  if(r>1.8){i.style.aspectRatio='1/1.8';i.style.objectFit='cover';i.style.objectPosition='top'}
}
function imgErr(i){i.style.aspectRatio='1/1';i.removeAttribute('src')}
const colsN=()=>innerWidth<640?2:innerWidth<1000?3:4;

function cardHtml(p,i){
  const meta=[p.material,p.colors?p.colors+' رنگ':'',p.pack?p.pack+' در پک':''].filter(Boolean).join(' · ');
  const im=p.images?.[0]||'';
  return `<div class="card ${p.pinned?'pin':''}" data-id="${esc(p.id)}">
    <div class="im"><img src="${esc(im)}" alt="" style="aspect-ratio:3/4" onload="imgFit(this)" onerror="imgErr(this)" decoding="async" ${i>5?'loading="lazy"':''}>
      <span class="tag ${p.stock>0?'':'out'}">${p.stock>0?'موجود':'ناموجود'}</span>
      ${p.pinned?'<span class="pinbadge">📌 ویژه</span>':''}
    </div>
    <div class="in"><h3>${esc(p.name)}</h3>
      <div class="meta">${esc(meta)||'&nbsp;'}</div>
      <div class="prow"><span class="price">${fa(p.price)} <small>تومان</small></span><span class="more">جزئیات</span></div>
    </div></div>`;
}
function render(){
  const q=$('#q').value.trim().toLowerCase();
  const all=db.products.filter(p=>(!cat||p.category===cat)&&(!q||(p.name+' '+(p.material||'')).toLowerCase().includes(q)));
  const list=[...all.filter(p=>p.pinned),...all.filter(p=>!p.pinned)];
  $('#empty').classList.toggle('hide',list.length>0);
  $('#empty').innerHTML=failed&&!db.products.length?'دریافت اطلاعات انجام نشد. اینترنت را بررسی کنید.<br><button class="btn sm" style="margin-top:10px" onclick="location.reload()">تلاش دوباره</button>':'محصولی برای نمایش وجود ندارد.';
  $('#fpill').innerHTML=cat?`<span class="fpill" data-clear>🗂 ${esc(cat)} <b>×</b></span>`:'';
  const n=lastN=colsN(), cols=Array.from({length:n},()=>[]);
  list.forEach((p,i)=>cols[i%n].push(cardHtml(p,i)));
  $('#grid').innerHTML=cols.map(c=>`<div class="col">${c.join('')}</div>`).join('');
  $('#nHome').classList.toggle('on',!cat);
  $('#nCat').classList.toggle('on',!!cat);
}
function openCats(){
  const used=db.categories.filter(c=>db.products.some(p=>p.category===c));
  const tile=(name,label,items)=>{
    const img=items.find(p=>p.images?.[0])?.images[0]||'';
    return `<button class="tile ${name===cat?'on':''}" data-c="${esc(name)}" style="${img?`background-image:url('${esc(img)}')`:''}"><span>${esc(label)}<small>${fa(items.length)} محصول</small></span></button>`;
  };
  $('#tiles').innerHTML=used.length
    ? tile('','همه محصولات',db.products)+used.map(c=>tile(c,c,db.products.filter(p=>p.category===c))).join('')
    : '<div class="empty" style="grid-column:1/-1;padding:30px 0">هنوز دسته‌بندی ثبت نشده.</div>';
  $('#catm').classList.add('on');
}
function closeAll(){document.querySelectorAll('.modal').forEach(m=>m.classList.remove('on'))}
function setCat(c){cat=c;closeAll();render();scrollTo({top:0,behavior:'smooth'})}

function open_(id){
  const p=db.products.find(x=>x.id===id); if(!p)return;
  const imgs=p.images||[];
  $('#pbox').innerHTML=`<button class="x" data-close>×</button>
  <div class="detail">
    <div><div class="mainwrap"><img class="mainimg" id="mi" src="${esc(imgs[0]||'')}" alt="" data-zoom></div>
      ${imgs.length>1?`<div class="thumbs">${imgs.map((s,i)=>`<div class="${i?'':'on'}" data-src="${esc(s)}" style="background-image:url('${esc(s)}')"></div>`).join('')}</div>`:''}</div>
    <div>
      ${p.pinned?'<span class="pinbadge static">📌 پیشنهاد ویژه</span>':''}
      <h2>${esc(p.name)}</h2>
      ${p.category?`<div class="cat">دسته: ${esc(p.category)}</div>`:''}
      <div class="price" style="font-size:20px">${fa(p.price)} تومان</div>
      <ul class="specs">
        <li><span>جنس</span><b>${esc(p.material||'-')}</b></li>
        <li><span>تعداد رنگ</span><b>${esc(p.colors||'-')}</b></li>
        <li><span>تعداد در پک</span><b>${esc(p.pack||'-')}</b></li>
        <li><span>موجودی</span><b>${p.stock>0?fa(p.stock)+' پک':'ناموجود'}</b></li>
      </ul>
      ${p.desc?`<p style="font-size:14px;margin-bottom:10px">${esc(p.desc)}</p>`:''}
      <div class="order">ثبت سفارش از طریق لینک زیر:<a class="go" href="https://t.me/arax_mood" target="_blank" rel="noopener">https://t.me/arax_mood</a>
        <div class="tel">📞 شماره تماس: <a href="tel:09193127255"><b>۰۹۱۹۳۱۲۷۲۵۵</b></a></div></div>
    </div>
  </div>`;
  $('#pm').classList.add('on');
}
document.addEventListener('click',e=>{
  const t=e.target;
  if(t.closest('[data-close]')||t.classList.contains('modal')){
    if(t.closest('#lb')||t.id==='lb'){$('#lb').classList.remove('on')}else closeAll();
    return;
  }
  if(t.closest('[data-clear]')){setCat('');return}
  const tl=t.closest('.tile'); if(tl){setCat(tl.dataset.c);return}
  const z=t.closest('[data-zoom]'); if(z){$('#lbi').src=z.src;$('#lb').classList.add('on');return}
  const th=t.closest('.thumbs div'); if(th){$('#mi').src=th.dataset.src;document.querySelectorAll('.thumbs div').forEach(d=>d.classList.remove('on'));th.classList.add('on');return}
  const c=t.closest('.card'); if(c)open_(c.dataset.id);
});
$('#openContact').onclick=()=>$('#contact').classList.add('on');
$('#nCall').onclick=()=>{closeAll();$('#contact').classList.add('on')};
$('#nCat').onclick=()=>{closeAll();openCats()};
$('#nHome').onclick=()=>{closeAll();cat='';$('#q').value='';render();scrollTo({top:0,behavior:'smooth'})};
$('#q').oninput=render;
let rt;addEventListener('resize',()=>{clearTimeout(rt);rt=setTimeout(()=>{if(colsN()!==lastN)render()},150)});
load();
