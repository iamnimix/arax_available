const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fa=n=>Number(n).toLocaleString('fa-IR');
let products=[];
async function load(){
  try{products=await (await fetch('data/products.json?t='+Date.now())).json()}catch(e){products=[]}
  render();
}
function render(){
  const q=$('#q').value.trim().toLowerCase();
  const list=products.filter(p=>!q||(p.name+' '+(p.material||'')).toLowerCase().includes(q));
  $('#empty').classList.toggle('hide',list.length>0);
  $('#grid').innerHTML=list.map(p=>`
    <div class="card" data-id="${esc(p.id)}">
      <span class="tag ${p.stock>0?'':'out'}">${p.stock>0?'موجود':'ناموجود'}</span>
      <div class="im" style="background-image:url('${esc(p.images?.[0]||'')}')"></div>
      <div class="in"><h3>${esc(p.name)}</h3><div class="price">${fa(p.price)} تومان</div></div>
    </div>`).join('');
}
function open_(id){
  const p=products.find(x=>x.id===id); if(!p)return;
  const imgs=p.images||[];
  $('#pbox').innerHTML=`<button class="x" data-close>×</button>
  <div class="detail">
    <div><div class="main-img" id="mi" style="background-image:url('${esc(imgs[0]||'')}')"></div>
      <div class="thumbs">${imgs.map((s,i)=>`<div class="${i?'':'on'}" data-src="${esc(s)}" style="background-image:url('${esc(s)}')"></div>`).join('')}</div></div>
    <div>
      <h2>${esc(p.name)}</h2>
      <div class="price" style="font-size:20px">${fa(p.price)} تومان</div>
      <ul class="specs">
        <li><span>جنس</span><b>${esc(p.material||'-')}</b></li>
        <li><span>تعداد رنگ</span><b>${esc(p.colors||'-')}</b></li>
        <li><span>تعداد در پک</span><b>${esc(p.pack||'-')}</b></li>
        <li><span>موجودی</span><b>${p.stock>0?fa(p.stock)+' پک':'ناموجود'}</b></li>
      </ul>
      ${p.desc?`<p style="font-size:14px">${esc(p.desc)}</p>`:''}
      <div class="order">ثبت سفارش از طریق لینک زیر:<br><a href="https://t.me/arax_mood" target="_blank" rel="noopener">https://t.me/arax_mood</a></div>
    </div>
  </div>`;
  $('#pm').classList.add('on');
}
document.addEventListener('click',e=>{
  const t=e.target;
  if(t.closest('[data-close]')||t.classList.contains('modal')){document.querySelectorAll('.modal').forEach(m=>m.classList.remove('on'));return}
  const c=t.closest('.card'); if(c)open_(c.dataset.id);
  const th=t.closest('.thumbs div'); if(th){$('#mi').style.backgroundImage=`url('${th.dataset.src}')`;document.querySelectorAll('.thumbs div').forEach(d=>d.classList.remove('on'));th.classList.add('on')}
});
$('#openContact').onclick=()=>$('#contact').classList.add('on');
$('#q').oninput=render;
load();
