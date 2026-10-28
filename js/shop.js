const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fa=n=>Number(n).toLocaleString('fa-IR');
let db={settings:{},categories:[],products:[]}, cat='';

function normalize(d){
  if(Array.isArray(d))return {settings:{},categories:[],products:d};
  return {settings:d?.settings||{},categories:d?.categories||[],products:d?.products||[]};
}
async function load(){
  try{
    const r=await fetch('data/products.json?t='+Date.now());
    if(r.ok)db=normalize(await r.json());
  }catch(e){}
  // شمارنده بازدید (اگر در پنل مدیریت فعال شده باشد)
  const gc=db.settings.gc;
  if(gc){
    const s=document.createElement('script');
    s.async=true;s.dataset.goatcounter=`https://${gc}.goatcounter.com/count`;
    s.src='//gc.zgo.at/count.js';document.head.appendChild(s);
  }
  render();
}
function render(){
  const used=db.categories.filter(c=>db.products.some(p=>p.category===c));
  $('#chips').innerHTML=used.length?
    [''].concat(used).map(c=>`<button class="chip ${c===cat?'on':''}" data-cat="${esc(c)}">${c?esc(c):'همه'}</button>`).join(''):'';
  const q=$('#q').value.trim().toLowerCase();
  const all=db.products.filter(p=>(!cat||p.category===cat)&&(!q||(p.name+' '+(p.material||'')).toLowerCase().includes(q)));
  const list=[...all.filter(p=>p.pinned),...all.filter(p=>!p.pinned)];
  $('#empty').classList.toggle('hide',list.length>0);
  $('#grid').innerHTML=list.map(p=>`
    <div class="card" data-id="${esc(p.id)}">
      <span class="tag ${p.stock>0?'':'out'}">${p.stock>0?'موجود':'ناموجود'}</span>
      <div class="im" style="background-image:url('${esc(p.images?.[0]||'')}')"></div>
      <div class="in"><h3>${esc(p.name)}</h3><div class="price">${fa(p.price)} تومان</div></div>
      <button class="more">جزئیات</button>
    </div>`).join('');
}
function open_(id){
  const p=db.products.find(x=>x.id===id); if(!p)return;
  const imgs=p.images||[];
  $('#pbox').innerHTML=`<button class="x" data-close>×</button>
  <div class="detail">
    <div><div class="main-img" id="mi" style="background-image:url('${esc(imgs[0]||'')}')"></div>
      <div class="thumbs">${imgs.map((s,i)=>`<div class="${i?'':'on'}" data-src="${esc(s)}" style="background-image:url('${esc(s)}')"></div>`).join('')}</div></div>
    <div>
      <h2>${esc(p.name)}</h2>
      ${p.category?`<div class="cat">دسته: ${esc(p.category)}</div>`:''}
      <div class="price" style="font-size:20px">${fa(p.price)} تومان</div>
      <ul class="specs">
        <li><span>جنس</span><b>${esc(p.material||'-')}</b></li>
        <li><span>تعداد رنگ</span><b>${esc(p.colors||'-')}</b></li>
        <li><span>تعداد در پک</span><b>${esc(p.pack||'-')}</b></li>
        <li><span>موجودی</span><b>${p.stock>0?fa(p.stock)+' پک':'ناموجود'}</b></li>
      </ul>
      ${p.desc?`<p style="font-size:14px">${esc(p.desc)}</p>`:''}
      <div class="order">ثبت سفارش از طریق لینک زیر:<br><a href="https://t.me/arax_mood" target="_blank" rel="noopener">https://t.me/arax_mood</a>
        <span class="tel">📞 شماره تماس: <a href="tel:09193127255"><b>۰۹۱۹۳۱۲۷۲۵۵</b></a></span></div>
    </div>
  </div>`;
  $('#pm').classList.add('on');
}
document.addEventListener('click',e=>{
  const t=e.target;
  if(t.closest('[data-close]')||t.classList.contains('modal')){document.querySelectorAll('.modal').forEach(m=>m.classList.remove('on'));return}
  const ch=t.closest('.chip'); if(ch){cat=ch.dataset.cat;render();return}
  const c=t.closest('.card'); if(c)open_(c.dataset.id);
  const th=t.closest('.thumbs div'); if(th){$('#mi').style.backgroundImage=`url('${th.dataset.src}')`;document.querySelectorAll('.thumbs div').forEach(d=>d.classList.remove('on'));th.classList.add('on')}
});
$('#openContact').onclick=()=>$('#contact').classList.add('on');
$('#q').oninput=render;
load();
