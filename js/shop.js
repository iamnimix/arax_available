const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const PD='۰۱۲۳۴۵۶۷۸۹';
const fa=n=>String(Math.round(+n||0)).replace(/\B(?=(\d{3})+(?!\d))/g,',').replace(/\d/g,d=>PD[d]);
const faS=s=>String(s??'').replace(/\d/g,d=>PD[d]);
const toLatin=s=>String(s??'').replace(/[۰-۹]/g,d=>PD.indexOf(d)).replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d));
const toNum=s=>{const m=toLatin(s).match(/\d+/);return m?+m[0]:0};
const lsGet=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch(e){return d}};
const lsSet=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
const TG='https://t.me/arax_mood';
const SHIPS=['تیپاکس','چاپار','ماهکس','پست','باربری'];
const ST={new:['در انتظار بررسی','#d08a0b'],confirmed:['تایید شد – منتظر پرداخت','#2f5be0'],receipt:['رسید دریافت شد','#7c3aed'],paid:['پرداخت تایید شد','#1d9b57'],shipped:['ارسال شد','#0f766e'],rejected:['رد شد','#c0392b']};
const SVG=p=>`<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
let db={settings:{},categories:[],products:[]},cat='',sort='',onlyIn=false,failed=false,dq=1;
let cart=lsGet('arax_cart',{}),refs=lsGet('arax_orders',[]),seen=lsGet('arax_seen',{}),ocache={};
let cv={tab:'cart',view:'list',code:null,form:lsGet('arax_cust',{name:'',phone:'',addr:'',ship:''})};

const normalize=d=>Array.isArray(d)?{settings:{},categories:[],products:d}:{settings:d?.settings||{},categories:d?.categories||[],products:d?.products||[]};
const vis=()=>db.products.filter(p=>!p.hidden);
const byId=id=>vis().find(p=>p.id===id);
const unitLabel=p=>p.priceUnit==='pack'?'پک':'عدد';
const created=p=>p.created||parseInt(String(p.id).slice(1),36)||0;
const jdate=iso=>{if(!iso)return '';const d=new Date(iso),tz={timeZone:'Asia/Tehran'};return d.toLocaleDateString('fa-IR-u-ca-persian',{...tz,year:'numeric',month:'2-digit',day:'2-digit'})+' '+d.toLocaleTimeString('fa-IR',{...tz,hour:'2-digit',minute:'2-digit',hour12:false})};
function toast(t){const e=$('#toast');e.textContent=t;e.classList.add('on');clearTimeout(toast.t);toast.t=setTimeout(()=>e.classList.remove('on'),2200)}
function gcEvent(p){try{if(window.goatcounter&&goatcounter.count)goatcounter.count({path:'product/'+p.id,title:p.name,event:true})}catch(e){}}

async function load(){
  try{const c=localStorage.getItem('arax_cache');if(c){db=normalize(JSON.parse(c));render();openFromHash()}}catch(e){}
  let d=null;
  try{d=await (window.__p||fetch('data/products.json?t='+Date.now()).then(r=>r.ok?r.json():null))}catch(e){}
  if(d){db=normalize(d);try{localStorage.setItem('arax_cache',JSON.stringify(d))}catch(e){}}
  else if(!db.products.length)failed=true;
  const gc=db.settings.gc;
  if(gc){const s=document.createElement('script');s.async=true;s.dataset.goatcounter=`https://${gc}.goatcounter.com/count`;s.src='//gc.zgo.at/count.js';document.head.appendChild(s)}
  render();openFromHash();pollOrders();setInterval(pollOrders,25000);
}
function imgErr(i){i.removeAttribute('src');i.style.display='none'}
function arrange(list){
  let a=[...list];
  if(sort==='new')a.sort((x,y)=>created(y)-created(x));
  else if(sort==='low')a.sort((x,y)=>x.price-y.price);
  else if(sort==='high')a.sort((x,y)=>y.price-x.price);
  else a=[...a.filter(p=>p.pinned),...a.filter(p=>!p.pinned)];
  return [...a.filter(p=>p.stock>0),...a.filter(p=>!(p.stock>0))];
}
function cardHtml(p,i){
  const n=toNum(p.pack),im=p.images?.[0]||'';
  const pk=n?`${fa(n)} عدد در پک`:(p.pack?`${esc(p.pack)} در پک`:'');
  return `<div class="card ${p.stock>0?'':'out'}" data-id="${esc(p.id)}">
    <div class="im"><div class="bg" style="background-image:url('${esc(im)}')"></div><img src="${esc(im)}" alt="" onerror="imgErr(this)" decoding="async" ${i>5?'loading="lazy"':''}>
      ${p.pinned?`<span class="pinic">${SVG('<path d="M9 4h6l-1 6 3 3H7l3-3-1-6z"/><path d="M12 13v7"/>')}</span>`:''}
      ${p.stock>0?'':'<span class="soldout">ناموجود</span>'}</div>
    <div class="in"><h3>${esc(p.name)}</h3>
      <div class="price"><b>${fa(p.price)}</b> <small>تومان${p.priceUnit==='pack'?' (هر پک)':''}</small></div>
      <div class="pk"><span>${pk}</span><i class="spark">${SVG('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z"/>')}</i></div>
    </div></div>`;
}
function render(){
  const q=$('#q').value.trim().toLowerCase();
  const all=vis().filter(p=>(!cat||p.category===cat)&&(!onlyIn||p.stock>0)&&(!q||(p.name+' '+(p.material||'')+' '+(p.code||'')).toLowerCase().includes(q)));
  const list=arrange(all);
  $('#empty').classList.toggle('hide',list.length>0);
  $('#empty').innerHTML=failed&&!db.products.length?'دریافت اطلاعات انجام نشد. اینترنت را بررسی کنید.<br><button class="btn sm" style="margin-top:10px" onclick="location.reload()">تلاش دوباره</button>':'محصولی برای نمایش وجود ندارد.';
  $('#fpill').innerHTML=cat?`<span class="fpill" data-clear>🗂 ${esc(cat)} <b>×</b></span>`:'';
  $('#grid').innerHTML=list.map((p,i)=>cardHtml(p,i)).join('');
  setNav(cat?'nCat':'nAll');updateBadge();
}
function setNav(id){document.querySelectorAll('.bnav button').forEach(b=>b.classList.toggle('on',b.id===id))}

/* ---------- محاسبه اقلام ---------- */
function mkItem(p,packs){
  const n=toNum(p.pack),isPack=p.priceUnit==='pack';
  const qty=isPack?packs:(n?n*packs:packs);
  return {id:p.id,name:p.name,code:p.code||'',packs,perPack:n,unit:isPack?'پک':'عدد',unitPrice:p.price,qty,total:p.price*qty};
}
const cartItems=()=>Object.entries(cart).map(([id,q])=>({p:byId(id),q})).filter(i=>i.p&&i.q>0);
const sumItems=its=>its.reduce((a,i)=>a+(+i.total||0),0);
function saveCart(){lsSet('arax_cart',cart);updateBadge()}
function addToCart(id,q=1){
  const p=byId(id);if(!p||!(p.stock>0))return toast('این محصول ناموجود است');
  const cur=cart[id]||0,nq=Math.min(p.stock,cur+q);
  if(nq===cur)return toast('موجودی کافی نیست');
  cart[id]=nq;saveCart();toast('✓ به سبد اضافه شد');
}
function updateBadge(){
  const n=cartItems().reduce((a,i)=>a+i.q,0),unread=refs.some(r=>ocache[r.code]&&ocache[r.code].status!==seen[r.code]);
  const b=$('#cb');b.textContent=n?fa(n):'';b.classList.toggle('hide',!n&&!unread);b.classList.toggle('dotonly',!n&&unread);
}

/* ---------- فاکتور ---------- */
function invoiceHtml(o){
  const rows=o.items.map((i,k)=>`<tr><td>${faS(k+1)}</td><td class="n">${esc(i.name)}${i.code?`<br><small>${esc(i.code)}</small>`:''}</td><td>${fa(i.packs)}</td><td>${fa(i.qty)} ${esc(i.unit)}</td><td>${fa(i.unitPrice)}</td><td><b>${fa(i.total)}</b></td></tr>`).join('');
  return `<div class="inv"><div class="h"><img src="images/logo.png" alt="" onerror="this.style.display='none'"><div><b>ثبت سفارشات آراکس ARAX</b><small>تولید و پخش عمده پوشاک — فاکتور سفارش</small></div></div>
   <div class="meta"><span>شماره فاکتور: <b>${esc(o.code||'پیش‌نمایش')}</b></span><span>تاریخ: ${jdate(o.created_at||new Date().toISOString())}</span></div>
   ${o.name?`<div class="cu">مشتری: <b>${esc(o.name)}</b> — تلفن: ${faS(esc(o.phone))}<br>آدرس: ${esc(o.address)}<br>روش ارسال: ${esc(o.shipping)}</div>`:''}
   <div class="tw"><table><thead><tr><th>ردیف</th><th>شرح کالا</th><th>تعداد پک</th><th>تعداد کل</th><th>قیمت واحد</th><th>جمع (تومان)</th></tr></thead><tbody>${rows}</tbody></table></div>
   <div class="tt"><span>جمع کل فاکتور</span><b>${fa(o.total??sumItems(o.items))} تومان</b></div></div>`;
}
function printInvoice(code){const o=ocache[code];if(!o)return;$('#printArea').innerHTML=invoiceHtml(o);window.print()}

/* ---------- Supabase (بدون کتابخانه) ---------- */
const sbc=()=>db.settings.sb&&db.settings.sb.url&&db.settings.sb.key?db.settings.sb:null;
const sbh=()=>({apikey:sbc().key,...(sbc().key.startsWith('eyJ')?{Authorization:'Bearer '+sbc().key}:{})});
async function rpc(fn,args){
  const r=await fetch(sbc().url+'/rest/v1/rpc/'+fn,{method:'POST',headers:{...sbh(),'Content-Type':'application/json'},body:JSON.stringify(args)});
  const j=await r.json().catch(()=>null);
  if(!r.ok)throw new Error(j?.message||('خطای سرور '+r.status));
  return j;
}
function notifyStatus(o){
  const m={confirmed:'سفارش شما تایید شد؛ می‌توانید پرداخت کنید ✅',receipt:'رسید شما دریافت شد',paid:'پرداخت شما تایید شد ✅',shipped:'سفارش شما ارسال شد 📦',rejected:'سفارش شما رد شد'}[o.status];
  if(!m)return;toast(m);
  try{if(window.Notification&&Notification.permission==='granted'&&document.hidden)new Notification('آراکس — سفارش '+o.code,{body:m,icon:'images/logo.png'})}catch(e){}
}
async function pollOrders(){
  if(!sbc()||!refs.length)return;
  for(const r of refs.slice(0,15)){
    try{
      const o=await rpc('get_order',{p_code:r.code,p_token:r.token});if(!o)continue;
      const prev=ocache[r.code]?.status;ocache[r.code]=o;
      if(prev&&prev!==o.status)notifyStatus(o);
      if(seen[r.code]===undefined){seen[r.code]=o.status;lsSet('arax_seen',seen)}
    }catch(e){}
  }
  updateBadge();
  if($('#cartm').classList.contains('on')&&(cv.tab==='orders'))renderSheet(true);
}

/* ---------- سبد / سفارش‌ها ---------- */
function openCart(tab){closeAll();cv.tab=tab||cv.tab||'cart';cv.view='list';renderSheet();$('#cartm').classList.add('on');setNav('nCart');if(cv.tab==='orders')pollOrders()}
function tabsHtml(){
  const un=refs.some(r=>ocache[r.code]&&ocache[r.code].status!==seen[r.code]);
  return `<div class="tabs"><button data-tab="cart" class="${cv.tab==='cart'?'on':''}">سبد فعلی</button><button data-tab="orders" class="${cv.tab==='orders'?'on':''}">سفارش‌های من${un?'<i class="dot"></i>':''}</button></div>`;
}
function renderSheet(keepScroll){
  const body=$('#cartBody');let h='';
  if(cv.tab==='cart'){h=cv.view==='checkout'?checkoutHtml():cv.view==='done'?doneHtml():cartHtml()}
  else{h=cv.view==='order'?orderHtml(cv.code):ordersListHtml()}
  body.innerHTML=h;
  if(cv.tab==='cart'&&cv.view==='checkout')checkForm();
}
function cartHtml(){
  const items=cartItems();let list;
  if(!items.length)list='<div class="empty" style="padding:30px 0">سبد خرید خالی است.<br><small>روی هر محصول بزنید و «افزودن به سفارش» را انتخاب کنید.</small></div>';
  else{
    const its=items.map(i=>mkItem(i.p,i.q));
    list=items.map((it,k)=>`<div class="crow2"><div class="cth" style="background-image:url('${esc(it.p.images?.[0]||'')}')"></div>
      <div class="cin"><b>${esc(it.p.name)}</b><small>${fa(its[k].qty)} ${its[k].unit} × ${fa(it.p.price)}</small><small class="t">${fa(its[k].total)} تومان</small></div>
      <div class="step"><button data-cm="${esc(it.p.id)}">−</button><span>${fa(it.q)}</span><button data-cp="${esc(it.p.id)}">+</button></div>
      <button class="del" data-cd="${esc(it.p.id)}" aria-label="حذف">🗑</button></div>`).join('')
      +`<div class="ctotal"><span>جمع کل</span><b>${fa(sumItems(its))} تومان</b></div>
       <button class="btn wide" data-checkout>ادامه و صدور فاکتور</button>
       <button class="btn danger sm" id="clearCart" style="margin-top:10px">خالی کردن سبد</button>`;
  }
  return `<h2>🛒 سبد خرید</h2>${tabsHtml()}${list}`;
}
function checkoutHtml(){
  const items=cartItems().map(i=>mkItem(i.p,i.q)),f=cv.form;
  const inv=invoiceHtml({items,total:sumItems(items)});
  return `<button class="btn ghost sm" data-back>‹ بازگشت به سبد</button><h2 style="margin-top:10px">صدور فاکتور و ثبت سفارش</h2>${inv}
   <div class="fld"><label>نام و نام خانوادگی *</label><input id="cuName" value="${esc(f.name)}" autocomplete="name"></div>
   <div class="fld"><label>شماره تماس *</label><input id="cuPhone" inputmode="tel" dir="ltr" placeholder="09123456789" value="${esc(f.phone)}" autocomplete="tel"></div>
   <div class="fld"><label>آدرس کامل *</label><textarea id="cuAddr" rows="3" autocomplete="street-address">${esc(f.addr)}</textarea></div>
   <div style="font-size:13.5px;margin-bottom:6px">روش ارسال * (قبل از پرداخت انتخاب کنید)</div>
   <div class="ships">${SHIPS.map(s=>`<label><input type="radio" name="ship" value="${s}" ${f.ship===s?'checked':''}> ${s}</label>`).join('')}</div>
   <div class="hint" id="coHint"></div>
   <button class="btn wide" id="submitOrder" data-submit disabled>${sbc()?'ثبت سفارش':'ارسال سفارش در تلگرام'}</button>`;
}
function readForm(){
  const f={name:($('#cuName')?.value||'').trim(),phone:toLatin($('#cuPhone')?.value||'').replace(/[\s-]/g,''),addr:($('#cuAddr')?.value||'').trim(),ship:document.querySelector('input[name=ship]:checked')?.value||''};
  return f;
}
function checkForm(){
  const f=readForm(),miss=[];
  if(f.name.split(/\s+/).filter(w=>w.length>=2).length<2)miss.push('نام و نام خانوادگی (هر دو)');
  if(!/^09\d{9}$/.test(f.phone))miss.push('شماره تماس معتبر (مثل 09123456789)');
  if(f.addr.length<10)miss.push('آدرس کامل');
  if(!f.ship)miss.push('روش ارسال');
  cv.form=f;lsSet('arax_cust',f);
  $('#coHint').textContent=miss.length?'برای ثبت سفارش تکمیل کنید: '+miss.join('، '):'';
  $('#submitOrder').disabled=!!miss.length;
  return !miss.length;
}
function fallbackMsg(f,items){
  const lines=items.map((i,k)=>`${faS(k+1)}) ${i.name}\n   ${fa(i.qty)} ${i.unit} × ${fa(i.unitPrice)} = ${fa(i.total)} تومان`);
  return `سلام، سفارش من از ویترین آراکس ARAX:\n\n${lines.join('\n')}\n\nجمع کل: ${fa(sumItems(items))} تومان\nنام: ${f.name}\nتلفن: ${f.phone}\nآدرس: ${f.addr}\nروش ارسال: ${f.ship}`;
}
async function submitOrder(){
  if(!checkForm())return;
  const f=cv.form,items=cartItems().map(i=>mkItem(i.p,i.q)),btn=$('#submitOrder');
  if(!sbc()){const m=fallbackMsg(f,items);try{navigator.clipboard.writeText(m)}catch(e){}window.open(TG+'?text='+encodeURIComponent(m),'_blank');return}
  btn.disabled=true;btn.textContent='در حال ثبت...';
  try{
    const r=await rpc('create_order',{p_name:f.name,p_phone:f.phone,p_address:f.addr,p_shipping:f.ship,p_items:items});
    refs.unshift({code:r.code,token:r.token});lsSet('arax_orders',refs);seen[r.code]='new';lsSet('arax_seen',seen);
    cart={};saveCart();cv.view='done';cv.code=r.code;renderSheet();pollOrders();
    try{if(window.Notification&&Notification.permission==='default')Notification.requestPermission()}catch(e){}
  }catch(e){btn.disabled=false;btn.textContent='ثبت سفارش';$('#coHint').textContent='خطا: '+e.message}
}
function doneHtml(){
  return `<div style="text-align:center;padding:24px 6px"><div style="font-size:54px">✅</div><h2>سفارش شما ثبت شد</h2>
   <p style="margin:8px 0">شماره سفارش: <b>${esc(cv.code)}</b></p>
   <p style="color:#7b8294;font-size:14px">پس از بررسی و تایید مدیر، وضعیت سفارش و اطلاعات پرداخت در بخش «سفارش‌های من» نمایش داده می‌شود. لطفاً این صفحه را دوباره باز کنید.</p>
   <button class="btn wide" style="margin-top:14px" data-vieworder="${esc(cv.code)}">مشاهده فاکتور و وضعیت سفارش</button></div>`;
}
function ordersListHtml(){
  if(!refs.length)return `<h2>🧾 سفارش‌های من</h2>${tabsHtml()}<div class="empty" style="padding:30px 0">هنوز سفارشی ثبت نکرده‌اید.</div>`;
  const rows=refs.map(r=>{const o=ocache[r.code];if(!o)return `<div class="ord"><div><b>${esc(r.code)}</b><small>در حال دریافت...</small></div></div>`;
    const [t,c]=ST[o.status]||[o.status,'#777'],un=o.status!==seen[r.code];
    return `<div class="ord" data-vieworder="${esc(r.code)}"><div><b>${esc(o.code)} ${un?'<i class="dot" style="position:static;display:inline-block"></i>':''}</b><small>${jdate(o.created_at)} — ${fa(o.total)} تومان</small></div><span class="badge" style="background:${c}">${t}</span></div>`}).join('');
  return `<h2>🧾 سفارش‌های من</h2>${tabsHtml()}${rows}`;
}
function orderHtml(code){
  const o=ocache[code];if(!o)return '<div class="empty">در حال دریافت...</div>';
  seen[code]=o.status;lsSet('arax_seen',seen);
  const [t,c]=ST[o.status]||[o.status,'#777'];
  const msg={new:'سفارش شما ثبت شد و در انتظار بررسی مدیر است. پس از تایید، اینجا اطلاع داده می‌شود.',confirmed:'سفارش شما تایید شد. مبلغ فاکتور را به شماره کارت زیر واریز کنید و عکس رسید را بارگذاری کنید.',receipt:'رسید شما دریافت شد و در حال بررسی است.',paid:'پرداخت شما تایید شد. سفارش به‌زودی ارسال می‌شود.',shipped:'سفارش شما ارسال شد.',rejected:'متاسفانه سفارش شما رد شد.'}[o.status]||'';
  let pay='';
  if(o.status==='confirmed'||o.status==='receipt'){
    const cd=o.card||{},num=cd.number?faS(String(cd.number).replace(/\D/g,'').replace(/(\d{4})(?=\d)/g,'$1 ')):'';
    pay=`<div class="paybox"><b>💳 پرداخت</b><p style="margin:6px 0">مبلغ قابل پرداخت: <b style="color:#1d9b57">${fa(o.total)} تومان</b></p>
     ${num?`<div>به شماره کارت زیر واریز کنید:</div><div class="card-no">${num}</div><div style="text-align:center;font-size:14px">به نام <b>${esc(cd.holder||'')}</b> ${cd.bank?'— '+esc(cd.bank):''}</div>
      <button class="btn ghost sm" style="margin:8px auto;display:flex" data-copy="${esc(String(cd.number).replace(/\D/g,''))}">کپی شماره کارت</button>`:'<p style="color:#c0392b">شماره کارت هنوز توسط مدیر ثبت نشده؛ با ما تماس بگیرید.</p>'}
     <hr style="border:0;border-top:1px solid #e3e8f5;margin:10px 0">
     <b>📎 بارگذاری رسید پرداخت</b>
     ${o.status==='receipt'?'<p style="color:#7c3aed;font-size:13px">رسید قبلی دریافت شده است؛ در صورت نیاز می‌توانید رسید جدید بفرستید.</p>':''}
     <div class="fld" style="margin-top:8px"><input type="file" id="rcFile" accept="image/*"></div>
     <div class="fld"><textarea id="rcNote" rows="2" placeholder="متن رسید یا توضیحات (مثلاً ۴ رقم آخر کارت، ساعت واریز، شماره پیگیری) — اختیاری"></textarea></div>
     <div class="hint" id="rcErr"></div>
     <button class="btn wide" data-sendreceipt="${esc(code)}">ارسال رسید برای مدیر</button></div>`;
  }
  return `<button class="btn ghost sm" data-back>‹ سفارش‌های من</button>
   <h2 style="margin-top:10px">سفارش ${esc(o.code)} <span class="badge" style="background:${c}">${t}</span></h2>
   <div class="msgbox">${msg}${o.tracking?`<br>کد رهگیری: <b>${esc(o.tracking)}</b>`:''}${o.admin_note?`<br><small>توضیحات مدیر: ${esc(o.admin_note)}</small>`:''}</div>
   ${pay}${invoiceHtml(o)}
   <button class="btn ghost wide" data-printinv="${esc(code)}">🖨 چاپ / ذخیره فاکتور (PDF)</button>`;
}
async function shrinkImg(file,max=1600){
  const u=URL.createObjectURL(file);
  const img=await new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=()=>rej(new Error('فایل تصویر معتبر نیست'));i.src=u});
  URL.revokeObjectURL(u);
  const k=Math.min(1,max/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=img.width*k;c.height=img.height*k;
  const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.drawImage(img,0,0,c.width,c.height);
  return new Promise(r=>c.toBlob(r,'image/jpeg',.85));
}
async function sendReceipt(code){
  const ref=refs.find(r=>r.code===code),file=$('#rcFile').files[0],err=$('#rcErr'),btn=document.querySelector('[data-sendreceipt]');
  if(!file){err.textContent='ابتدا عکس رسید را انتخاب کنید';return}
  btn.disabled=true;btn.textContent='در حال ارسال...';err.textContent='';
  try{
    const blob=await shrinkImg(file),path=`${code}/${Date.now()}.jpg`;
    const r=await fetch(`${sbc().url}/storage/v1/object/receipts/${path}`,{method:'POST',headers:{...sbh(),'Content-Type':'image/jpeg'},body:blob});
    if(!r.ok)throw new Error('آپلود رسید ناموفق بود ('+r.status+')');
    const ok=await rpc('attach_receipt',{p_code:code,p_token:ref.token,p_path:path,p_note:($('#rcNote').value||'').trim()});
    if(!ok)throw new Error('ثبت رسید ممکن نبود');
    toast('رسید ارسال شد ✓');await pollOrders();cv.view='order';renderSheet();
  }catch(e){err.textContent='خطا: '+e.message;btn.disabled=false;btn.textContent='ارسال رسید برای مدیر'}
}

/* ---------- دسته‌ها / فیلتر ---------- */
function openCats(){
  closeAll();setNav('nCat');
  const V=vis(),used=db.categories.filter(c=>V.some(p=>p.category===c));
  const tile=(name,label,items)=>{const img=items.find(p=>p.images?.[0])?.images[0]||'';
    return `<button class="tile ${name===cat?'on':''}" data-c="${esc(name)}" style="${img?`background-image:url('${esc(img)}')`:''}"><span>${esc(label)}<small>${fa(items.length)} محصول</small></span></button>`};
  const so=[['','پیش‌فرض'],['new','جدیدترین'],['low','ارزان‌ترین'],['high','گران‌ترین']];
  $('#catBody').innerHTML=`<h2>دسته‌بندی محصولات</h2>
   <div class="chips">${so.map(([v,l])=>`<button class="chip ${sort===v?'on':''}" data-sort="${v}">${l}</button>`).join('')}<button class="chip ${onlyIn?'on':''}" data-onlyin>فقط موجودها</button></div>
   <div class="tiles">${used.length?tile('','همه محصولات',V)+used.map(c=>tile(c,c,V.filter(p=>p.category===c))).join(''):'<div class="empty" style="grid-column:1/-1;padding:30px 0">هنوز دسته‌بندی ثبت نشده.</div>'}</div>`;
  $('#catm').classList.add('on');
}
function closeAll(){
  document.querySelectorAll('.modal').forEach(m=>m.classList.remove('on'));
  if(location.hash.startsWith('#p='))history.replaceState(null,'',location.pathname+location.search);
  setNav(cat?'nCat':'nAll');
}
function setCat(c){cat=c;closeAll();render();scrollTo({top:0,behavior:'smooth'})}

/* ---------- جزئیات محصول ---------- */
const prodUrl=id=>location.href.split('#')[0]+'#p='+id;
function open_(id,fromHash){
  const p=byId(id);if(!p)return;
  const imgs=p.images?.length?p.images:[''],n=toNum(p.pack);dq=1;
  let rows;
  if(n){const each=p.priceUnit==='pack'?Math.round(p.price/n):p.price,tot=p.priceUnit==='pack'?p.price:p.price*n;
    rows=[['قیمت هر عدد',fa(each)+' تومان','g'],['تعداد در پک',fa(n)+' عدد',''],['قیمت کل',fa(tot)+' تومان','g']]}
  else{rows=[['قیمت هر '+unitLabel(p),fa(p.price)+' تومان','g']];if(p.pack)rows.push(['تعداد در پک',esc(p.pack),''])}
  const specs=[['کد محصول',p.code],['تعداد رنگ در پک',p.colors],['سایزبندی',p.sizing],['قد',p.height],['جنس',p.material],['توضیحات',p.desc]].filter(x=>x[1]);
  $('#pbox').innerHTML=`<button class="x" data-close>×</button>
  <div class="pgal"><div class="gal" id="gal">${imgs.map(s=>`<div class="slide"><img src="${esc(s)}" alt="" data-zoom></div>`).join('')}</div>
    ${imgs.length>1?`<div class="thumbs">${imgs.map((s,i)=>`<div class="${i?'':'on'}" data-i="${i}" style="background-image:url('${esc(s)}')"></div>`).join('')}</div>`:''}</div>
  <div class="pinfo">
    <h2>${esc(p.name)}</h2>
    <div class="wc">${rows.map(r=>`<div class="r"><span>${r[0]}</span><b class="${r[2]}">${r[1]}</b></div>`).join('')}</div>
    ${p.category?`<div class="catrow" data-gocat="${esc(p.category)}"><span class="ic">${SVG('<rect x="4" y="4" width="7" height="16" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>')}</span><div><small>دسته‌بندی</small><b>${esc(p.category)}</b></div>‹</div>`:''}
    <div class="sp"><h3>مشخصات</h3>${specs.map(s=>`<div class="it"><small>${s[0]}</small><b>${esc(s[1])}</b></div>`).join('')}</div>
    ${p.updated?`<div class="upd">آخرین به‌روزرسانی: ${jdate(p.updated)}</div>`:''}
    <div class="tgbox">ثبت سفارش از طریق لینک زیر:<a href="${TG}" target="_blank" rel="noopener">https://t.me/arax_mood</a><div style="margin-top:4px">📞 <a href="tel:09193127255" style="display:inline;color:inherit">۰۹۱۹۳۱۲۷۲۵۵</a></div></div>
  </div>
  <div class="pbar">${p.stock>0?`<div class="addrow"><div class="step"><button data-dm>−</button><span id="dq">۱</span><button data-dp="${p.stock}">+</button></div>
    <button class="btn" data-addd="${esc(p.id)}" style="flex:1">افزودن به سفارش</button>
    <button class="btn ghost" data-share="${esc(p.id)}" aria-label="اشتراک‌گذاری">🔗</button></div>`
   :`<div class="addrow"><button class="btn ghost" disabled style="flex:1">ناموجود</button><button class="btn ghost" data-share="${esc(p.id)}">🔗</button></div>`}</div>`;
  const g=$('#gal');g.onscroll=()=>{const i=Math.round(Math.abs(g.scrollLeft)/g.clientWidth);document.querySelectorAll('.thumbs div').forEach((d,k)=>d.classList.toggle('on',k===i))};
  $('#pm').classList.add('on');
  if(!fromHash)history.replaceState(null,'','#p='+id);
  gcEvent(p);
}
function openFromHash(){
  const m=location.hash.match(/^#p=(.+)$/);
  if(m&&byId(decodeURIComponent(m[1]))&&!$('#pm').classList.contains('on'))open_(decodeURIComponent(m[1]),true);
}
async function share(url,title){
  if(navigator.share){try{await navigator.share({title,text:title,url});return}catch(e){if(e.name==='AbortError')return}}
  try{await navigator.clipboard.writeText(url);toast('لینک کپی شد ✓')}catch(e){prompt('لینک:',url)}
}

/* ---------- رویدادها ---------- */
document.addEventListener('click',e=>{
  const t=e.target,$c=s=>t.closest(s);let el;
  if($c('[data-close]')||t.classList.contains('modal')){if(t.id==='lb'||$c('#lb'))$('#lb').classList.remove('on');else closeAll();return}
  if($c('[data-clear]'))return setCat('');
  if(el=$c('.tile'))return setCat(el.dataset.c);
  if(el=$c('[data-gocat]'))return setCat(el.dataset.gocat);
  if(el=$c('[data-sort]')){sort=el.dataset.sort;render();return openCats()}
  if($c('[data-onlyin]')){onlyIn=!onlyIn;render();return openCats()}
  if(el=$c('[data-addd]'))return addToCart(el.dataset.addd,dq);
  if(el=$c('[data-share]'))return share(prodUrl(el.dataset.share),byId(el.dataset.share).name+' — آراکس ARAX');
  if($c('[data-dm]')){dq=Math.max(1,dq-1);$('#dq').textContent=fa(dq);return}
  if(el=$c('[data-dp]')){dq=Math.min(+el.dataset.dp,dq+1);$('#dq').textContent=fa(dq);return}
  if(el=$c('[data-tab]')){cv.tab=el.dataset.tab;cv.view='list';renderSheet();if(cv.tab==='orders')pollOrders();return}
  if(el=$c('[data-cm]')){const id=el.dataset.cm;cart[id]=(cart[id]||1)-1;if(cart[id]<=0)delete cart[id];saveCart();return renderSheet()}
  if(el=$c('[data-cp]')){const id=el.dataset.cp,p=byId(id);if((cart[id]||0)>=p.stock)return toast('موجودی کافی نیست');cart[id]=(cart[id]||0)+1;saveCart();return renderSheet()}
  if(el=$c('[data-cd]')){delete cart[el.dataset.cd];saveCart();return renderSheet()}
  if($c('#clearCart')){cart={};saveCart();return renderSheet()}
  if($c('[data-checkout]')){cv.view='checkout';return renderSheet()}
  if($c('[data-back]')){cv.view='list';return renderSheet()}
  if($c('[data-submit]'))return submitOrder();
  if(el=$c('[data-vieworder]')){cv.tab='orders';cv.view='order';cv.code=el.dataset.vieworder;renderSheet();updateBadge();return}
  if(el=$c('[data-printinv]'))return printInvoice(el.dataset.printinv);
  if(el=$c('[data-sendreceipt]'))return sendReceipt(el.dataset.sendreceipt);
  if(el=$c('[data-copy]')){navigator.clipboard?.writeText(el.dataset.copy).then(()=>toast('شماره کارت کپی شد ✓'));return}
  if(el=$c('.thumbs div')){$('#gal').children[+el.dataset.i]?.scrollIntoView({behavior:'smooth',inline:'center',block:'nearest'});return}
  if(el=$c('[data-zoom]')){$('#lbi').src=el.src;$('#lb').classList.add('on');return}
  if(el=$c('.card'))open_(el.dataset.id);
});
document.addEventListener('input',e=>{if(['cuName','cuPhone','cuAddr'].includes(e.target.id)||e.target.name==='ship')checkForm()});
$('#openContact').onclick=()=>{closeAll();$('#contact').classList.add('on')};
$('#nAbout').onclick=()=>{closeAll();$('#contact').classList.add('on');setNav('nAbout')};
$('#nCat').onclick=openCats;
$('#nCart').onclick=()=>openCart(cartItems().length||!refs.length?'cart':'orders');
$('#nAll').onclick=()=>{closeAll();cat='';sort='';onlyIn=false;$('#q').value='';render();scrollTo({top:0,behavior:'smooth'})};
$('#shareSite').onclick=()=>share(location.href.split('#')[0],'ثبت سفارشات آراکس ARAX');
$('#q').oninput=render;
addEventListener('hashchange',openFromHash);
let dip;addEventListener('beforeinstallprompt',e=>{e.preventDefault();dip=e;$('#installBtn').classList.remove('hide')});
$('#installBtn').onclick=async()=>{if(dip){dip.prompt();dip=null;$('#installBtn').classList.add('hide')}};
load();
