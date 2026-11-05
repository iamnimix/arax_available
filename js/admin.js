const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fa=n=>Number(n||0).toLocaleString('fa-IR');
const b64enc=s=>btoa(unescape(encodeURIComponent(s)));
const b64dec=s=>decodeURIComponent(escape(atob(s.replace(/\n/g,''))));
let cfg=JSON.parse(localStorage.getItem('arax_cfg')||'null');
let db={settings:{},categories:[],products:[]}, editing=null, imgs=[], clicks={};
const preview={};
const say=(el,t,err)=>{$(el).innerHTML=t?`<div class="msg ${err?'err':''}">${esc(t)}</div>`:''};
const normalize=d=>Array.isArray(d)?{settings:{},categories:[],products:d}:{settings:d?.settings||{},categories:d?.categories||[],products:d?.products||[]};

async function gh(path,opts={}){
  const r=await fetch('https://api.github.com'+path,{...opts,headers:{
    Authorization:'Bearer '+cfg.token,Accept:'application/vnd.github+json',...(opts.headers||{})}});
  if(r.status===404&&opts.allow404)return null;
  if(!r.ok){let m='';try{m=(await r.json()).message}catch(e){}throw new Error(r.status+' '+m)}
  return r.json();
}
const rp=p=>`/repos/${cfg.owner}/${cfg.repo}/contents/${p}`;
async function readDB(){
  const d=await gh(rp('data/products.json')+'?ref='+cfg.branch+'&t='+Date.now(),{allow404:true});
  if(!d)return {db:normalize([]),sha:null};
  return {db:normalize(JSON.parse(b64dec(d.content)||'[]')),sha:d.sha};
}
const putFile=(path,c,msg,sha)=>gh(rp(path),{method:'PUT',body:JSON.stringify({message:msg,content:c,branch:cfg.branch,...(sha?{sha}:{})})});
async function delFile(path){
  try{
    const d=await gh(rp(path)+'?ref='+cfg.branch,{allow404:true});
    if(d)await gh(rp(path),{method:'DELETE',body:JSON.stringify({message:'delete image',sha:d.sha,branch:cfg.branch})});
  }catch(e){}
}
async function saveDB(next,msg){
  const cur=await readDB();
  next={...next,settings:{...next.settings,updated:new Date().toISOString()}};
  await putFile('data/products.json',b64enc(JSON.stringify(next,null,1)),msg,cur.sha);
  db=next;
}
const siteBase=()=>location.href.replace(/admin\.html.*$/,'');
const productLink=id=>siteBase()+'#p='+id;

/* ورود */
(function(){
  const h=location.hostname, parts=location.pathname.split('/').filter(Boolean);
  if(h.endsWith('.github.io')){$('#owner').value=h.split('.')[0];$('#repo').value=parts[0]&&!parts[0].endsWith('.html')?parts[0]:h}
  if(cfg)start();
})();
$('#loginBtn').onclick=async()=>{
  cfg={token:$('#token').value.trim(),owner:$('#owner').value.trim(),repo:$('#repo').value.trim(),branch:$('#branch').value.trim()||'main'};
  say('#lmsg','در حال بررسی...');
  try{
    const r=await gh(`/repos/${cfg.owner}/${cfg.repo}`);
    if(!r.permissions||!r.permissions.push)throw new Error('این توکن اجازه‌ی نوشتن ندارد (Contents: Read and write)');
    localStorage.setItem('arax_cfg',JSON.stringify(cfg));start();
  }catch(e){cfg=null;say('#lmsg','ورود ناموفق: '+e.message,true)}
};
$('#logout').onclick=()=>{localStorage.removeItem('arax_cfg');location.reload()};
async function start(){
  localStorage.setItem('skipgc','t');
  $('#login').classList.add('hide');$('#app').classList.remove('hide');$('#logout').classList.remove('hide');
  say('#gmsg','در حال بارگذاری...');
  try{db=(await readDB()).db;say('#gmsg','');renderAll();loadStats()}
  catch(e){say('#gmsg','خطا: '+e.message+' — اگر توکن منقضی شده، خروج بزنید و دوباره وارد شوید.',true)}
}
const src=p=>preview[p]||p;
function renderAll(){renderCats();renderList()}

/* دسته‌بندی */
function renderCats(){
  $('#catList').innerHTML=db.categories.length?db.categories.map((c,i)=>`<span>${esc(c)} <button class="cat-edit" data-rc="${i}" title="ویرایش نام">✏️</button><button data-dc="${i}" title="حذف">×</button></span>`).join(''):'<small>هنوز دسته‌ای نساخته‌اید.</small>';
}
$('#addCat').onclick=async()=>{
  const n=$('#newCat').value.trim();if(!n)return;
  if(db.categories.includes(n))return say('#gmsg','این دسته قبلاً وجود دارد',true);
  try{await saveDB({...db,categories:[...db.categories,n]},'add category');$('#newCat').value='';renderAll();say('#gmsg','')}
  catch(e){say('#gmsg','خطا: '+e.message,true)}
};
$('#catList').onclick=async e=>{
  const ri=e.target.dataset.rc;
  if(ri!==undefined){
    const old=db.categories[ri];
    const n=(prompt('نام جدید دسته‌بندی:',old)||'').trim();
    if(!n||n===old)return;
    if(db.categories.includes(n))return say('#gmsg','این نام قبلاً وجود دارد',true);
    say('#gmsg','در حال ذخیره...');
    try{
      await saveDB({...db,categories:db.categories.map((c,k)=>k==ri?n:c),products:db.products.map(p=>p.category===old?{...p,category:n}:p)},'rename category');
      renderAll();say('#gmsg','نام دسته تغییر کرد ✅');
    }catch(err){say('#gmsg','خطا: '+err.message,true)}
    return;
  }
  const i=e.target.dataset.dc;if(i===undefined)return;
  const n=db.categories[i];
  if(!confirm(`دسته «${n}» حذف شود؟ (محصولاتش حذف نمی‌شوند، فقط بدون دسته می‌شوند)`))return;
  try{
    await saveDB({...db,categories:db.categories.filter((_,k)=>k!=i),products:db.products.map(p=>p.category===n?{...p,category:''}:p)},'delete category');
    renderAll();
  }catch(err){say('#gmsg','خطا: '+err.message,true)}
};

/* لیست محصولات */
function renderList(){
  const q=($('#search').value||'').trim().toLowerCase();
  const f=db.products.filter(p=>!q||(p.name+' '+(p.category||'')+' '+(p.material||'')).toLowerCase().includes(q));
  const arr=[...f.filter(p=>p.pinned),...f.filter(p=>!p.pinned)];
  $('#list').innerHTML=arr.length?arr.map(p=>{
    const id=esc(p.id),c=clicks[p.id];
    return `<div class="item ${p.pinned?'pinned':''} ${p.hidden?'hidden':''}">
    <div class="th" style="background-image:url('${esc(src(p.images?.[0]||''))}')"></div>
    <div class="nm"><b>${esc(p.name)}</b> ${p.hidden?'<span class="hid">مخفی</span>':''}<br><small>${p.category?esc(p.category)+' — ':''}${fa(p.price)} تومان${p.priceUnit==='pack'?' (هر پک)':''}${c?` — 👁 ${fa(c)} کلیک`:''}</small></div>
    <div class="stp" title="موجودی (پک)"><button data-sm="${id}">−</button><b>${fa(p.stock)}</b><button data-sp="${id}">+</button></div>
    <div class="acts">
      <button class="pin ${p.pinned?'on':''}" data-pn="${id}">${p.pinned?'📌 پین شده':'📍 پین'}</button>
      <button class="btn ghost sm" data-hd="${id}">${p.hidden?'نمایش دادن':'مخفی کردن'}</button>
      <button class="btn ghost sm" data-cl="${id}">🔗 کپی لینک</button>
      <button class="btn ghost sm" data-dp="${id}">⎘ کپی محصول</button>
      <button class="btn ghost sm" data-e="${id}">ویرایش</button>
      <button class="btn danger sm" data-d="${id}">حذف</button>
    </div></div>`}).join('')
   :`<div class="empty">${q?'محصولی پیدا نشد.':'هنوز محصولی اضافه نشده.'}</div>`;
}
/* ذخیره‌ی گروهی تغییر موجودی */
let tm,busy=false,dirty=false;
function queueSave(){dirty=true;clearTimeout(tm);say('#gmsg','تغییر موجودی در حال ثبت...');tm=setTimeout(flush,1200)}
async function flush(){
  if(busy){tm=setTimeout(flush,600);return}
  busy=true;dirty=false;
  try{await saveDB(db,'update stock');if(!dirty)say('#gmsg','موجودی ذخیره شد ✅ (تا ۱–۲ دقیقه‌ی دیگر در ویترین اعمال می‌شود)')}
  catch(err){say('#gmsg','خطا در ذخیره: '+err.message,true)}
  busy=false;if(dirty)flush();
}
const upd=(id,fn)=>{db={...db,products:db.products.map(x=>x.id===id?fn(x):x)}};
$('#list').onclick=async e=>{
  const d=e.target.dataset;
  if(d.sm||d.sp){
    const id=d.sm||d.sp,dl=d.sm?-1:1;
    upd(id,x=>({...x,stock:Math.max(0,(+x.stock||0)+dl),updated:new Date().toISOString()}));renderList();queueSave();return;
  }
  if(d.pn||d.hd){
    const id=d.pn||d.hd,k=d.pn?'pinned':'hidden';
    upd(id,x=>({...x,[k]:!x[k]}));renderList();queueSave();return;
  }
  if(d.cl){
    const u=productLink(d.cl);
    try{await navigator.clipboard.writeText(u);say('#gmsg','لینک محصول کپی شد: '+u)}catch(err){prompt('لینک محصول:',u)}
    return;
  }
  if(d.dp){openForm(db.products.find(p=>p.id===d.dp),true);return}
  if(d.e){openForm(db.products.find(p=>p.id===d.e));return}
  if(d.d){
    const p=db.products.find(x=>x.id===d.d);
    if(!confirm(`«${p.name}» حذف شود؟`))return;
    say('#gmsg','در حال حذف...');
    try{
      await saveDB({...db,products:db.products.filter(x=>x.id!==d.d)},'delete '+p.name);
      for(const im of p.images||[])await delFile(im);
      renderList();say('#gmsg','حذف شد. تا ۱–۲ دقیقه‌ی دیگر در ویترین اعمال می‌شود.');
    }catch(err){say('#gmsg','خطا: '+err.message,true)}
  }
};
$('#backup').onclick=()=>{
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([JSON.stringify(db,null,1)],{type:'application/json'}));
  a.download='arax-backup-'+new Date().toISOString().slice(0,10)+'.json';a.click();
};

/* فرم محصول */
const F=['name','price','stock','material','colors','pack','desc'];
let copyMode=false;
function openForm(p,copy){
  copyMode=!!copy;editing=p&&!copy?p:null;
  $('#ftitle').textContent=copy?'کپی محصول (عکس و اسم را عوض کنید)':p?'ویرایش محصول':'محصول جدید';
  F.forEach(k=>$('#f_'+k).value=p?(p[k]??''):'');
  if(copy)$('#f_name').value=p.name+' (کپی)';
  $('#f_unit').value=p?.priceUnit||'piece';
  $('#f_category').innerHTML='<option value="">— بدون دسته —</option>'+db.categories.map(c=>`<option ${p&&p.category===c?'selected':''}>${esc(c)}</option>`).join('');
  imgs=copy?[]:(p?.images||[]).map(path=>({path}));
  $('#f_wm').checked=localStorage.getItem('arax_wm')!=='0';
  say('#fmsg','');drawSlots();$('#fm').classList.add('on');
}
$('#newBtn').onclick=()=>openForm(null);
$('#search').oninput=renderList;
$('#multiBtn').onclick=()=>$('#file').click();
$('#fclose').onclick=()=>$('#fm').classList.remove('on');
function drawSlots(){
  let h='';
  for(let i=0;i<10;i++){
    const im=imgs[i];
    h+=im?`<div class="slot" style="background-image:url('${im.dataUrl||src(im.path)}')"><button class="rm" data-rm="${i}">×</button></div>`
         :`<div class="slot" data-add="${i}">+</div>`;
  }
  $('#slots').innerHTML=h;
}
$('#slots').onclick=e=>{
  if(e.target.dataset.rm!==undefined){imgs.splice(+e.target.dataset.rm,1);drawSlots();return}
  if(e.target.dataset.add!==undefined)$('#file').click();
};
$('#file').onchange=async e=>{
  const files=[...e.target.files];e.target.value='';
  const room=10-imgs.length;
  if(files.length>room)say('#fmsg',`فقط ${room} عکس دیگر جا دارد؛ بقیه نادیده گرفته شد`,true);
  const wm=$('#f_wm').checked;localStorage.setItem('arax_wm',wm?'1':'0');
  const res=await Promise.allSettled(files.slice(0,room).map(f=>shrink(f,1200,wm)));
  res.forEach(r=>{if(r.status==='fulfilled')imgs.push({dataUrl:r.value})});
  drawSlots();
};
/* عکس + واترمارک کوچک */
const loadImg=s=>new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=()=>rej(new Error('فایل تصویر معتبر نیست'));i.src=s});
let logoP;const getLogo=()=>logoP||(logoP=loadImg('images/logo.png?t='+Date.now()).catch(()=>null));
function rr(x,a,b,w,h,r){x.beginPath();x.moveTo(a+r,b);x.arcTo(a+w,b,a+w,b+h,r);x.arcTo(a+w,b+h,a,b+h,r);x.arcTo(a,b+h,a,b,r);x.arcTo(a,b,a+w,b,r);x.closePath()}
async function shrink(file,max=1200,wm=true){
  const u=URL.createObjectURL(file);let img;
  try{img=await loadImg(u)}finally{URL.revokeObjectURL(u)}
  const k=Math.min(1,max/Math.max(img.width,img.height));
  const c=document.createElement('canvas');c.width=Math.round(img.width*k);c.height=Math.round(img.height*k);
  const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.drawImage(img,0,0,c.width,c.height);
  if(wm){
    const logo=await getLogo(),m=Math.round(c.width*.03);
    if(logo){
      const w=Math.round(c.width*.15),h=Math.round(w*logo.naturalHeight/logo.naturalWidth),p=Math.round(w*.12);
      x.globalAlpha=.6;x.fillStyle='#fff';rr(x,c.width-w-2*p-m,c.height-h-2*p-m,w+2*p,h+2*p,p);x.fill();
      x.globalAlpha=.95;x.drawImage(logo,c.width-w-p-m,c.height-h-p-m,w,h);
    }else{
      const fs=Math.round(c.width*.045);x.font=`700 ${fs}px Tahoma,Arial,sans-serif`;
      const w=x.measureText('ARAX').width,p=Math.round(fs*.4);
      x.globalAlpha=.55;x.fillStyle='#000';rr(x,c.width-w-2*p-m,c.height-fs-2*p-m+4,w+2*p,fs+2*p-4,p);x.fill();
      x.globalAlpha=.95;x.fillStyle='#fff';x.textBaseline='top';x.fillText('ARAX',c.width-w-p-m,c.height-fs-p-m+4);
    }
    x.globalAlpha=1;
  }
  return c.toDataURL('image/jpeg',.82);
}
$('#saveBtn').onclick=async()=>{
  const name=$('#f_name').value.trim();
  if(!name)return say('#fmsg','نام محصول را وارد کنید',true);
  const btn=$('#saveBtn');btn.disabled=true;say('#fmsg','در حال ذخیره و آپلود... (چند ثانیه صبر کنید)');
  try{
    const id=editing?editing.id:'p'+Date.now().toString(36);
    const paths=[];
    for(const im of imgs){
      if(im.path){paths.push(im.path);continue}
      const path=`images/products/${id}-${Math.random().toString(36).slice(2,8)}.jpg`;
      await putFile(path,im.dataUrl.split(',')[1],'add image');
      preview[path]=im.dataUrl;paths.push(path);
    }
    const p={id,name,category:$('#f_category').value,pinned:!!editing?.pinned,hidden:!!editing?.hidden,
      price:+$('#f_price').value||0,priceUnit:$('#f_unit').value,stock:+$('#f_stock').value||0,
      material:$('#f_material').value.trim(),colors:$('#f_colors').value.trim(),pack:$('#f_pack').value.trim(),
      desc:$('#f_desc').value.trim(),images:paths,created:editing?.created||Date.now(),updated:new Date().toISOString()};
    const products=editing?db.products.map(x=>x.id===id?p:x):[p,...db.products];
    await saveDB({...db,products},(editing?'update ':'add ')+name);
    if(editing)for(const old of editing.images||[])if(!paths.includes(old))await delFile(old);
    renderList();$('#fm').classList.remove('on');
    say('#gmsg','ذخیره شد ✅ تا ۱–۲ دقیقه‌ی دیگر در ویترین مشتری‌ها اعمال می‌شود.');
  }catch(e){say('#fmsg','خطا: '+e.message,true)}
  btn.disabled=false;
};

/* آمار بازدید و کلیک محصولات (GoatCounter) */
function statsSetup(msg){
  $('#statsBox').innerHTML=`${msg?`<div class="msg err">${esc(msg)}</div>`:''}
   <div class="msg">برای دیدن آمار، یک‌بار در goatcounter.com ثبت‌نام کنید. سپس اینجا وارد کنید:</div>
   <div class="row"><div class="field"><label>کد سایت (قسمت اول آدرس)</label><input id="gcCode" dir="ltr" placeholder="arax" value="${esc(db.settings.gc||'')}"></div>
   <div class="field"><label>توکن API (فقط خواندن آمار)</label><input id="gcTok" type="password" dir="ltr"></div></div>
   <button class="btn sm" id="gcSave">ذخیره و نمایش آمار</button>`;
  $('#gcSave').onclick=async()=>{
    const code=$('#gcCode').value.trim().toLowerCase(), tok=$('#gcTok').value.trim();
    if(!code||!tok)return;
    try{
      cfg.gcToken=tok;localStorage.setItem('arax_cfg',JSON.stringify(cfg));
      if(db.settings.gc!==code)await saveDB({...db,settings:{...db.settings,gc:code}},'enable analytics');
      loadStats();
    }catch(e){statsSetup('خطا: '+e.message)}
  };
}
async function loadStats(){
  const code=db.settings.gc;
  if(!code||!cfg.gcToken)return statsSetup();
  try{
    const start=new Date(Date.now()-31*864e5).toISOString().slice(0,13)+':00:00Z';
    const r=await fetch(`https://${code}.goatcounter.com/api/v0/stats/hits?daily=true&limit=100&start=${start}`,
      {headers:{Authorization:'Bearer '+cfg.gcToken,'Content-Type':'application/json'}});
    if(!r.ok)throw new Error('پاسخ '+r.status+' — کد سایت یا توکن را بررسی کنید');
    const j=await r.json(), byDay={}; clicks={};
    (j.hits||[]).forEach(h=>{
      const path=String(h.path||'').replace(/^\//,'');
      if(h.event||path.startsWith('product/')){
        const m=path.match(/^product\/(.+)$/);if(m)clicks[m[1]]=(clicks[m[1]]||0)+(h.count||0);
        return;
      }
      (h.stats||[]).forEach(s=>{byDay[s.day]=(byDay[s.day]||0)+(s.daily||0)});
    });
    const tz={timeZone:'Asia/Tehran'},iso=d=>new Date(d).toLocaleDateString('en-CA',tz);
    const days=[...Array(7)].map((_,i)=>iso(Date.now()-i*864e5));
    const label=d=>new Date(d+'T12:00:00Z').toLocaleDateString('fa-IR',{timeZone:'UTC',month:'short',day:'numeric'});
    const sum7=days.reduce((a,d)=>a+(byDay[d]||0),0);
    const top=Object.entries(clicks).sort((a,b)=>b[1]-a[1]).slice(0,5);
    const nm=id=>db.products.find(p=>p.id===id)?.name||id;
    $('#statsBox').innerHTML=`<div class="stats">
      <div class="stat"><b>${fa(byDay[days[0]])}</b>امروز</div>
      <div class="stat"><b>${fa(byDay[days[1]])}</b>دیروز</div>
      <div class="stat"><b>${fa(sum7)}</b>۷ روز اخیر</div></div>
      <div class="days">${days.map(d=>`<span>${label(d)}: <b>${fa(byDay[d])}</b></span>`).join('')}</div>
      <h4 style="margin-top:12px">🔥 پربازدیدترین محصولات (۳۰ روز اخیر)</h4>
      <div class="top5">${top.length?top.map(([id,c])=>`<div><span>${esc(nm(id))}</span><b>${fa(c)} کلیک</b></div>`).join(''):'<small>هنوز کلیکی ثبت نشده.</small>'}</div>
      <p style="margin-top:8px"><button class="btn ghost sm" id="gcReset">تغییر تنظیمات آمار</button></p>`;
    $('#gcReset').onclick=()=>statsSetup();
    renderList();
  }catch(e){statsSetup(e.message)}
}
