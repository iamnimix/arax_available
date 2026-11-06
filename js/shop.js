const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fa=n=>Number(n||0).toLocaleString('fa-IR');
const TG='https://t.me/arax_mood';
let db={settings:{},categories:[],products:[]}, cat='', sort='', onlyIn=false, lastN=0, failed=false, dq=1;
let cart={};try{cart=JSON.parse(localStorage.getItem('arax_cart')||'{}')}catch(e){}

function normalize(d){
  if(Array.isArray(d))return {settings:{},categories:[],products:d};
  return {settings:d?.settings||{},categories:d?.categories||[],products:d?.products||[]};
}
const vis=()=>db.products.filter(p=>!p.hidden);
const byId=id=>vis().find(p=>p.id===id);
const toNum=s=>{const t=String(s??'').replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d));const m=t.match(/\d+/);return m?+m[0]:0};
function prices(p){
  const n=toNum(p.pack);let each=0,pack=0;
  if(p.priceUnit==='pack'){pack=p.price;each=n?Math.round(p.price/n):0}
  else{each=p.price;pack=n?p.price*n:0}
  return {each,pack,n};
}
const unitLabel=p=>p.priceUnit==='pack'?'پک':'عدد';
const unitPrice=p=>p.price;
// جمع یک ردیف سبد: قیمت وارد‌شده × تعداد (اگر قیمت تکی است: × تعداد در پک)
function line(p,q){
  const n=toNum(p.pack);
  if(p.priceUnit==='pack')return {total:p.price*q,text:`${fa(q)} پک × ${fa(p.price)}`};
  if(n)return {total:p.price*n*q,text:`${fa(q)} پک (${fa(n*q)} عدد) × ${fa(p.price)}`};
  return {total:p.price*q,text:`${fa(q)} × ${fa(p.price)}`};
}
const created=p=>p.created||parseInt(String(p.id).slice(1),36)||0;
const isNew=p=>created(p)&&Date.now()-created(p)<7*864e5;

function ago(iso){
  if(!iso)return '';
  const tz={timeZone:'Asia/Tehran'},d=new Date(iso),day=x=>x.toLocaleDateString('en-CA',tz);
  const diff=Math.round((new Date(day(new Date()))-new Date(day(d)))/864e5);
  if(diff<=0)return 'امروز '+d.toLocaleTimeString('fa-IR',{...tz,hour:'2-digit',minute:'2-digit'});
  return diff===1?'دیروز':fa(diff)+' روز پیش';
}
function toast(t){const e=$('#toast');e.textContent=t;e.classList.add('on');clearTimeout(toast.t);toast.t=setTimeout(()=>e.classList.remove('on'),1800)}
function gcEvent(p){try{if(window.goatcounter&&goatcounter.count)goatcounter.count({path:'product/'+p.id,title:p.name,event:true})}catch(e){}}

async function load(){
  try{const c=localStorage.getItem('arax_cache');if(c){db=normalize(JSON.parse(c));render();openFromHash()}}catch(e){}
  let d=null;
  try{d=await (window.__p||fetch('data/products.json?t='+Date.now()).then(r=>r.ok?r.json():null))}catch(e){}
  if(d){db=normalize(d);try{localStorage.setItem('arax_cache',JSON.stringify(d))}catch(e){}}
  else if(!db.products.length)failed=true;
  const gc=db.settings.gc;
  if(gc){const s=document.createElement('script');s.async=true;s.dataset.goatcounter=`https://${gc}.goatcounter.com/count`;s.src='//gc.zgo.at/count.js';document.head.appendChild(s)}
  render();openFromHash();
}
function imgFit(i){
  const r=i.naturalHeight/i.naturalWidth;i.style.aspectRatio='auto';
  if(r>1.8){i.style.aspectRatio='1/1.8';i.style.objectFit='cover';i.style.objectPosition='top'}
}
function imgErr(i){i.removeAttribute('src');i.style.display='none'}
const colsN=()=>innerWidth<640?2:innerWidth<1000?3:4;

function arrange(list){
  let a=[...list];
  if(sort==='new')a.sort((x,y)=>created(y)-created(x));
  else if(sort==='low')a.sort((x,y)=>unitPrice(x)-unitPrice(y));
  else if(sort==='high')a.sort((x,y)=>unitPrice(y)-unitPrice(x));
  else a=[...a.filter(p=>p.pinned),...a.filter(p=>!p.pinned)];
  return [...a.filter(p=>p.stock>0),...a.filter(p=>!(p.stock>0))];
}
function stockTag(p){
  if(!(p.stock>0))return '<span class="tag out">ناموجود</span>';
  if(p.stock<=3)return `<span class="tag low">فقط ${fa(p.stock)} پک مانده</span>`;
  return '<span class="tag">موجود</span>';
}
function cardHtml(p,i){
  const r=prices(p);
  const meta=[p.material,p.colors?p.colors+' رنگ':'',p.pack?p.pack+' در پک':''].filter(Boolean).join(' · ');
  const im=p.images?.[0]||'';
  const priceTxt=`${fa(p.price)} <small>تومان / ${unitLabel(p)}</small>`;
  return `<div class="card ${p.pinned?'pin':''}" data-id="${esc(p.id)}">
    <div class="im"><div class="bg" style="background-image:url('${esc(im)}')"></div><img src="${esc(im)}" alt="" onerror="imgErr(this)" decoding="async" ${i>5?'loading="lazy"':''}>
      ${stockTag(p)}
      ${isNew(p)?'<span class="newbadge">جدید</span>':''}
      ${p.pinned?'<span class="pinbadge">📌 ویژه</span>':''}
    </div>
    <div class="in"><h3>${esc(p.name)}</h3>
      <div class="meta">${esc(meta)||'&nbsp;'}</div>
      <div class="price">${priceTxt}</div>
      <div class="btns"><span class="more">جزئیات</span>${p.stock>0?`<button class="addbtn" data-add="${esc(p.id)}">+ سفارش</button>`:''}</div>
    </div></div>`;
}
function render(){
  const q=$('#q').value.trim().toLowerCase();
  const all=vis().filter(p=>(!cat||p.category===cat)&&(!onlyIn||p.stock>0)&&(!q||(p.name+' '+(p.material||'')).toLowerCase().includes(q)));
  const list=arrange(all);
  $('#empty').classList.toggle('hide',list.length>0);
  $('#empty').innerHTML=failed&&!db.products.length?'دریافت اطلاعات انجام نشد. اینترنت را بررسی کنید.<br><button class="btn sm" style="margin-top:10px" onclick="location.reload()">تلاش دوباره</button>':'محصولی برای نمایش وجود ندارد.';
  $('#fpill').innerHTML=cat?`<span class="fpill" data-clear>🗂 ${esc(cat)} <b>×</b></span>`:'';
  const up=db.settings.updated||vis().map(p=>p.updated).filter(Boolean).sort().pop();
  $('#upd').textContent=up?'🕒 آخرین به‌روزرسانی موجودی: '+ago(up):'';
  $('#grid').innerHTML=list.map((p,i)=>cardHtml(p,i)).join('');
  $('#nHome').classList.toggle('on',!cat);
  $('#nCat').classList.toggle('on',!!cat);
  updateBadge();
}

/* ---------- سبد سفارش ---------- */
function saveCart(){try{localStorage.setItem('arax_cart',JSON.stringify(cart))}catch(e){}updateBadge()}
function cartItems(){return Object.entries(cart).map(([id,q])=>({p:byId(id),q})).filter(i=>i.p&&i.q>0)}
function updateBadge(){
  const n=cartItems().reduce((a,i)=>a+i.q,0),b=$('#cb');
  b.textContent=fa(n);b.classList.toggle('hide',!n);
}
function addToCart(id,q=1){
  const p=byId(id);if(!p||!(p.stock>0))return;
  const cur=cart[id]||0,nq=Math.min(p.stock,cur+q);
  if(nq===cur){toast('بیشتر از موجودی ('+fa(p.stock)+' پک) ممکن نیست');return}
  cart[id]=nq;saveCart();toast('✓ به سفارش اضافه شد');
}
function orderMessage(){
  const items=cartItems(),name=($('#cName')?.value||'').trim();
  let total=0;
  const lines=items.map((i,k)=>{const l=line(i.p,i.q);total+=l.total;return `${fa(k+1)}) ${i.p.name}\n   ${l.text} = ${fa(l.total)} تومان`});
  return `سلام، سفارش من از ویترین آراکس ARAX:\n\n${lines.join('\n')}\n\nجمع کل: ${fa(total)} تومان${name?`\nنام/شماره: ${name}`:''}\n\n${location.href.split('#')[0]}`;
}
function renderCart(){
  const items=cartItems();
  if(!items.length){$('#cartBody').innerHTML='<div class="empty" style="padding:30px 0">سبد سفارش خالی است.<br><small>از کارت هر محصول دکمه «+ سفارش» را بزنید.</small></div>';return}
  let total=0;
  const rows=items.map(({p,q})=>{const l=line(p,q),t=l.total;total+=t;return `
   <div class="crow2"><div class="cth" style="background-image:url('${esc(p.images?.[0]||'')}')"></div>
    <div class="cin"><b>${esc(p.name)}</b><small>${fa(p.price)} تومان / ${unitLabel(p)}</small><small>${l.text}</small><small>جمع: <b>${fa(t)}</b> تومان</small></div>
    <div class="step"><button data-cm="${esc(p.id)}">−</button><span>${fa(q)}</span><button data-cp="${esc(p.id)}">+</button></div>
    <button class="del" data-cd="${esc(p.id)}" aria-label="حذف">🗑</button></div>`}).join('');
  const saved=localStorage.getItem('arax_name')||'';
  $('#cartBody').innerHTML=`${rows}
   <div class="ctotal"><span>جمع کل</span><b>${fa(total)} تومان</b></div>
   <input id="cName" placeholder="نام یا شماره شما (اختیاری)" value="${esc(saved)}" style="margin:8px 0">
   <textarea id="cMsg" rows="6" readonly></textarea>
   <button class="btn" id="sendOrder" style="width:100%;margin-top:8px">کپی پیام و ارسال در تلگرام</button>
   <p style="font-size:12px;color:#6b6b6b;margin-top:6px;text-align:center">تلگرام باز می‌شود و پیام داخل کادر نوشتن آماده است؛ فقط «ارسال» را بزنید. اگر خالی بود، Paste کنید (پیام کپی شده است).</p>
   <button class="btn danger sm" id="clearCart" style="margin-top:6px">خالی کردن سبد</button>`;
  $('#cMsg').value=orderMessage();
}
function openCart(){closeAll();renderCart();$('#cartm').classList.add('on')}
async function sendOrder(){
  const msg=orderMessage();
  try{localStorage.setItem('arax_name',($('#cName')?.value||'').trim())}catch(e){}
  try{await navigator.clipboard.writeText(msg)}catch(e){const m=$('#cMsg');m.select();try{document.execCommand('copy')}catch(_){}}
  toast('پیام کپی شد و در تلگرام آماده ارسال است ✓');
  window.open(TG+'?text='+encodeURIComponent(msg),'_blank');
}

/* ---------- دسته‌ها ---------- */
function openCats(){
  const V=vis(),used=db.categories.filter(c=>V.some(p=>p.category===c));
  const tile=(name,label,items)=>{
    const img=items.find(p=>p.images?.[0])?.images[0]||'';
    return `<button class="tile ${name===cat?'on':''}" data-c="${esc(name)}" style="${img?`background-image:url('${esc(img)}')`:''}"><span>${esc(label)}<small>${fa(items.length)} محصول</small></span></button>`;
  };
  $('#tiles').innerHTML=used.length
    ?tile('','همه محصولات',V)+used.map(c=>tile(c,c,V.filter(p=>p.category===c))).join('')
    :'<div class="empty" style="grid-column:1/-1;padding:30px 0">هنوز دسته‌بندی ثبت نشده.</div>';
  $('#catm').classList.add('on');
}
function closeAll(){
  document.querySelectorAll('.modal').forEach(m=>m.classList.remove('on'));
  if(location.hash.startsWith('#p='))history.replaceState(null,'',location.pathname+location.search);
}
function setCat(c){cat=c;closeAll();render();scrollTo({top:0,behavior:'smooth'})}

/* ---------- جزئیات محصول ---------- */
const prodUrl=id=>location.href.split('#')[0]+'#p='+id;
function open_(id,fromHash){
  const p=byId(id);if(!p)return;
  const imgs=p.images?.length?p.images:[''],r=prices(p);dq=1;
  $('#pbox').innerHTML=`<button class="x" data-close>×</button>
  <div class="pgal">
    <div class="gal" id="gal">${imgs.map(s=>`<div class="slide"><img src="${esc(s)}" alt="" data-zoom></div>`).join('')}</div>
    ${imgs.length>1?`<div class="thumbs">${imgs.map((s,i)=>`<div class="${i?'':'on'}" data-i="${i}" style="background-image:url('${esc(s)}')"></div>`).join('')}</div>`:''}
  </div>
  <div class="pright">
    <div class="pinfo">
      <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
        ${p.pinned?'<span class="pinbadge static">📌 پیشنهاد ویژه</span>':''}${isNew(p)?'<span class="pinbadge static nb">جدید</span>':''}
        ${p.stock>0&&p.stock<=3?`<span class="pinbadge static lowb">فقط ${fa(p.stock)} پک مانده</span>`:''}
      </div>
      <h2>${esc(p.name)}</h2>
      ${p.category?`<div class="cat">دسته: ${esc(p.category)}</div>`:''}
      <ul class="specs">
        <li class="hl" style="grid-column:1/-1"><span>قیمت هر ${unitLabel(p)}</span><b>${fa(p.price)} تومان</b></li>
        <li><span>جنس</span><b>${esc(p.material||'-')}</b></li>
        <li><span>تعداد رنگ</span><b>${esc(p.colors||'-')}</b></li>
        <li><span>تعداد در پک</span><b>${esc(p.pack||'-')}</b></li>
        <li><span>موجودی</span><b>${p.stock>0?fa(p.stock)+' پک':'ناموجود'}</b></li>
      </ul>
      ${p.desc?`<p style="font-size:14px;margin-bottom:10px">${esc(p.desc)}</p>`:''}
      <div class="order">ثبت سفارش از طریق لینک زیر:<a class="go" href="${TG}" target="_blank" rel="noopener">https://t.me/arax_mood</a>
        <div class="tel">📞 شماره تماس: <a href="tel:09193127255"><b>۰۹۱۹۳۱۲۷۲۵۵</b></a></div></div>
    </div>
    <div class="pbar">
      ${p.stock>0?`<div class="addrow"><div class="step"><button data-dm>−</button><span id="dq">۱</span><button data-dp="${p.stock}">+</button></div>
        <button class="btn" data-addd="${esc(p.id)}" style="flex:1">افزودن به سفارش</button>
        <button class="btn ghost" data-share="${esc(p.id)}" aria-label="اشتراک‌گذاری">🔗</button></div>`
       :`<div class="addrow"><button class="btn ghost" data-share="${esc(p.id)}" style="flex:1">🔗 اشتراک‌گذاری لینک محصول</button></div>`}
    </div>
  </div>`;
  $('#pbox').scrollTop=0;
  const g=$('#gal');
  g.onscroll=()=>{const i=Math.round(Math.abs(g.scrollLeft)/g.clientWidth);document.querySelectorAll('.thumbs div').forEach((d,k)=>d.classList.toggle('on',k===i))};
  $('#pm').classList.add('on');
  if(!fromHash)history.replaceState(null,'','#p='+id);
  gcEvent(p);
}
function openFromHash(){
  const m=location.hash.match(/^#p=(.+)$/);
  if(m&&byId(decodeURIComponent(m[1]))&&!$('#pm').classList.contains('on'))open_(decodeURIComponent(m[1]),true);
}
async function share(id){
  const p=byId(id),url=prodUrl(id);
  if(navigator.share){try{await navigator.share({title:p.name,text:p.name+' — آراکس ARAX',url});return}catch(e){if(e.name==='AbortError')return}}
  try{await navigator.clipboard.writeText(url);toast('لینک محصول کپی شد ✓')}catch(e){prompt('لینک محصول:',url)}
}

/* ---------- رویدادها ---------- */
document.addEventListener('click',e=>{
  const t=e.target,$c=s=>t.closest(s);
  if($c('[data-close]')||t.classList.contains('modal')){
    if(t.id==='lb'||$c('#lb'))$('#lb').classList.remove('on');else closeAll();
    return;
  }
  if($c('[data-clear]'))return setCat('');
  let el;
  if(el=$c('.tile'))return setCat(el.dataset.c);
  if(el=$c('[data-add]'))return addToCart(el.dataset.add,1);
  if(el=$c('[data-addd]')){addToCart(el.dataset.addd,dq);return}
  if(el=$c('[data-share]'))return share(el.dataset.share);
  if($c('[data-dm]')){dq=Math.max(1,dq-1);$('#dq').textContent=fa(dq);return}
  if(el=$c('[data-dp]')){dq=Math.min(+el.dataset.dp,dq+1);$('#dq').textContent=fa(dq);return}
  if(el=$c('[data-cm]')){const id=el.dataset.cm;cart[id]=(cart[id]||1)-1;if(cart[id]<=0)delete cart[id];saveCart();return renderCart()}
  if(el=$c('[data-cp]')){const id=el.dataset.cp,p=byId(id);cart[id]=Math.min(p.stock,(cart[id]||0)+1);saveCart();return renderCart()}
  if(el=$c('[data-cd]')){delete cart[el.dataset.cd];saveCart();return renderCart()}
  if($c('#sendOrder'))return sendOrder();
  if($c('#clearCart')){cart={};saveCart();return renderCart()}
  if(el=$c('.thumbs div')){$('#gal').children[+el.dataset.i]?.scrollIntoView({behavior:'smooth',inline:'center',block:'nearest'});return}
  if(el=$c('[data-zoom]')){$('#lbi').src=el.src;$('#lb').classList.add('on');return}
  if(el=$c('.card'))open_(el.dataset.id);
});
document.addEventListener('input',e=>{if(e.target.id==='cName'){$('#cMsg').value=orderMessage()}});
$('#openContact').onclick=()=>$('#contact').classList.add('on');
$('#nCall').onclick=()=>{closeAll();$('#contact').classList.add('on')};
$('#nCat').onclick=()=>{closeAll();openCats()};
$('#nCart').onclick=openCart;
$('#nHome').onclick=()=>{closeAll();cat='';sort='';onlyIn=false;$('#sort').value='';$('#onlyIn').classList.remove('on');$('#q').value='';render();scrollTo({top:0,behavior:'smooth'})};
$('#q').oninput=render;
$('#sort').onchange=e=>{sort=e.target.value;render()};
$('#onlyIn').onclick=e=>{onlyIn=!onlyIn;e.currentTarget.classList.toggle('on',onlyIn);render()};
addEventListener('hashchange',openFromHash);
let dip;addEventListener('beforeinstallprompt',e=>{e.preventDefault();dip=e;$('#installBtn').classList.remove('hide')});
$('#installBtn').onclick=async()=>{if(dip){dip.prompt();dip=null;$('#installBtn').classList.add('hide')}};
load();
