const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fa=n=>Number(n||0).toLocaleString('fa-IR');
const b64enc=s=>btoa(unescape(encodeURIComponent(s)));
const b64dec=s=>decodeURIComponent(escape(atob(s.replace(/\n/g,''))));
let cfg=JSON.parse(localStorage.getItem('arax_cfg')||'null');
let products=[], editing=null, imgs=[];
const preview={};
function say(el,t,err){$(el).innerHTML=t?`<div class="msg ${err?'err':''}">${esc(t)}</div>`:''}
async function gh(path,opts={}){
  const r=await fetch('https://api.github.com'+path,{...opts,headers:{
    Authorization:'Bearer '+cfg.token,Accept:'application/vnd.github+json',...(opts.headers||{})}});
  if(r.status===404&&opts.allow404)return null;
  if(!r.ok){let m='';try{m=(await r.json()).message}catch(e){}throw new Error(r.status+' '+m)}
  return r.json();
}
const rp=p=>`/repos/${cfg.owner}/${cfg.repo}/contents/${p}`;
async function readProducts(){
  const d=await gh(rp('data/products.json')+'?ref='+cfg.branch+'&t='+Date.now(),{allow404:true});
  if(!d)return {list:[],sha:null};
  return {list:JSON.parse(b64dec(d.content)||'[]'),sha:d.sha};
}
async function putFile(path,contentB64,msg,sha){
  return gh(rp(path),{method:'PUT',body:JSON.stringify({message:msg,content:contentB64,branch:cfg.branch,...(sha?{sha}:{})})});
}
async function delFile(path){
  try{
    const d=await gh(rp(path)+'?ref='+cfg.branch,{allow404:true});
    if(d)await gh(rp(path),{method:'DELETE',body:JSON.stringify({message:'delete image',sha:d.sha,branch:cfg.branch})});
  }catch(e){}
}
async function saveProducts(list,msg){
  const cur=await readProducts();
  await putFile('data/products.json',b64enc(JSON.stringify(list,null,1)),msg,cur.sha);
}
(function init(){
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
    localStorage.setItem('arax_cfg',JSON.stringify(cfg));
    start();
  }catch(e){cfg=null;say('#lmsg','ورود ناموفق: '+e.message,true)}
};
$('#logout').onclick=()=>{localStorage.removeItem('arax_cfg');location.reload()};
async function start(){
  $('#login').classList.add('hide');$('#app').classList.remove('hide');$('#logout').classList.remove('hide');
  say('#gmsg','در حال بارگذاری...');
  try{products=(await readProducts()).list;say('#gmsg','');renderList()}
  catch(e){say('#gmsg','خطا: '+e.message+' — اگر توکن منقضی شده، خروج بزنید و دوباره وارد شوید.',true)}
}
const src=p=>preview[p]||p;
function renderList(){
  $('#list').innerHTML=products.length?products.map(p=>`
   <div class="item"><div class="th" style="background-image:url('${esc(src(p.images?.[0]||''))}')"></div>
    <div class="nm"><b>${esc(p.name)}</b><br><small>${fa(p.price)} تومان — موجودی: ${fa(p.stock)} پک</small></div>
    <button class="btn ghost sm" data-e="${esc(p.id)}">ویرایش</button>
    <button class="btn danger sm" data-d="${esc(p.id)}">حذف</button></div>`).join('')
   :'<div class="empty">هنوز محصولی اضافه نشده.</div>';
}
$('#list').onclick=async e=>{
  const ed=e.target.dataset.e, dl=e.target.dataset.d;
  if(ed)openForm(products.find(p=>p.id===ed));
  if(dl){
    const p=products.find(x=>x.id===dl);
    if(!confirm(`«${p.name}» حذف شود؟`))return;
    say('#gmsg','در حال حذف...');
    try{
      await saveProducts(products.filter(x=>x.id!==dl),'delete '+p.name);
      for(const im of p.images||[])await delFile(im);
      products=products.filter(x=>x.id!==dl);renderList();say('#gmsg','حذف شد. تا ۱–۲ دقیقه‌ی دیگر در ویترین اعمال می‌شود.');
    }catch(err){say('#gmsg','خطا: '+err.message,true)}
  }
};
const F=['name','price','stock','material','colors','pack','desc'];
function openForm(p){
  editing=p||null;
  $('#ftitle').textContent=p?'ویرایش محصول':'محصول جدید';
  F.forEach(k=>$('#f_'+k).value=p?(p[k]??''):'');
  imgs=(p?.images||[]).map(path=>({path}));
  say('#fmsg','');drawSlots();$('#fm').classList.add('on');
}
$('#newBtn').onclick=()=>openForm(null);
$('#fclose').onclick=()=>$('#fm').classList.remove('on');
function drawSlots(){
  let h='';
  for(let i=0;i<4;i++){
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
  const f=e.target.files[0];e.target.value='';if(!f||imgs.length>=4)return;
  try{imgs.push({dataUrl:await shrink(f)});drawSlots()}catch(err){say('#fmsg',err.message,true)}
};
function shrink(file,max=1200){
  return new Promise((res,rej)=>{
    const img=new Image(),u=URL.createObjectURL(file);
    img.onload=()=>{
      const k=Math.min(1,max/Math.max(img.width,img.height));
      const c=document.createElement('canvas');c.width=img.width*k;c.height=img.height*k;
      const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.drawImage(img,0,0,c.width,c.height);
      URL.revokeObjectURL(u);res(c.toDataURL('image/jpeg',.82));
    };
    img.onerror=()=>rej(new Error('فایل تصویر معتبر نیست'));img.src=u;
  });
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
    const p={id,name,price:+$('#f_price').value||0,stock:+$('#f_stock').value||0,
      material:$('#f_material').value.trim(),colors:$('#f_colors').value.trim(),pack:$('#f_pack').value.trim(),
      desc:$('#f_desc').value.trim(),images:paths,updated:new Date().toISOString()};
    const list=editing?products.map(x=>x.id===id?p:x):[p,...products];
    await saveProducts(list,(editing?'update ':'add ')+name);
    if(editing)for(const old of editing.images||[])if(!paths.includes(old))await delFile(old);
    products=list;renderList();$('#fm').classList.remove('on');
    say('#gmsg','ذخیره شد ✅ تا ۱–۲ دقیقه‌ی دیگر در ویترین مشتری‌ها اعمال می‌شود.');
  }catch(e){say('#fmsg','خطا: '+e.message,true)}
  btn.disabled=false;
};
