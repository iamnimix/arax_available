#!/usr/bin/env python3
"""
همگام‌سازی خودکار محصولات فروشگاه آراکس در «آلسات» با ویترین.
- لیست محصولات را از صفحه‌ی فروشگاه می‌خواند، هر محصول را باز می‌کند و در data/products.json وارد/به‌روز می‌کند.
- فقط از کتابخانه‌های استاندارد پایتون (+ اختیاری Pillow برای کوچک‌کردن عکس‌ها) استفاده می‌کند.
اجرا:  python tools/alsat_sync.py            (همگام‌سازی کامل)
        python tools/alsat_sync.py --file page.html   (فقط تست خواندن یک صفحه‌ی محصول)
"""
import re, os, sys, json, time, html, hashlib, datetime, argparse, urllib.request, urllib.parse, urllib.robotparser

BASE = os.getenv('ALSAT_BASE', 'https://alsatmal.com').rstrip('/')
SHOP = os.getenv('ALSAT_SHOP', '/shop/arax/')
DATA = os.getenv('DATA_FILE', 'data/products.json')
IMGDIR = os.getenv('IMG_DIR', 'images/products')
DEFAULT_STOCK = int(os.getenv('DEFAULT_STOCK', '10'))
DELAY = float(os.getenv('DELAY', '0.8'))
MAX_PAGES = int(os.getenv('MAX_PAGES', '40'))
UA = 'ARAX-Showcase-Sync/1.0 (sync of own shop listings)'
PD = '۰۱۲۳۴۵۶۷۸۹'

def log(*a): print(*a, flush=True)
def to_fa(s): return re.sub(r'\d', lambda m: PD[int(m.group())], str(s))
def to_en(s): return str(s).translate({ord(c): str(i) for i, c in enumerate(PD)})
def num(s):
    m = re.search(r'\d+', to_en(s or '').replace(',', ''))
    return int(m.group()) if m else 0

def fetch(url, binary=False, tries=3):
    last = None
    for k in range(tries):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept-Language': 'fa'})
            with urllib.request.urlopen(req, timeout=40) as r:
                data = r.read()
            time.sleep(DELAY)
            return data if binary else data.decode('utf-8', 'replace')
        except Exception as e:
            last = e; time.sleep(2 + k * 2)
    raise RuntimeError(f'دریافت ناموفق: {url} ({last})')

# ---------- تاریخ شمسی -> میلادی ----------
def j2g(jy, jm, jd):
    jy += 1595
    days = -355668 + (365 * jy) + ((jy // 33) * 8) + (((jy % 33) + 3) // 4) + jd
    days += (jm - 1) * 31 if jm < 7 else ((jm - 7) * 30) + 186
    gy = 400 * (days // 146097); days %= 146097
    if days > 36524:
        days -= 1; gy += 100 * (days // 36524); days %= 36524
        if days >= 365: days += 1
    gy += 4 * (days // 1461); days %= 1461
    if days > 365:
        gy += (days - 1) // 365; days = (days - 1) % 365
    gd = days + 1
    sal = [0, 31, 29 if ((gy % 4 == 0 and gy % 100 != 0) or gy % 400 == 0) else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    gm = 0
    while gm < 13 and gd > sal[gm]:
        gd -= sal[gm]; gm += 1
    return gy, gm, gd

def jalali_text_to_iso(t):
    m = re.search(r'(\d{4})/(\d{1,2})/(\d{1,2})\s+(\d{1,2}):(\d{2})', to_en(t or ''))
    if not m: return None
    jy, jm, jd, hh, mm = map(int, m.groups())
    gy, gm, gd = j2g(jy, jm, jd)
    dt = datetime.datetime(gy, gm, gd, hh, mm) - datetime.timedelta(hours=3, minutes=30)  # تهران → UTC
    return dt.strftime('%Y-%m-%dT%H:%M:%SZ')

# ---------- خواندن صفحه‌ی محصول ----------
def clean(s): return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', s or ''))).strip()

def parse_product(src, pid=None):
    prod = None
    for m in re.finditer(r'<script[^>]*application/ld\+json[^>]*>(.*?)</script>', src, re.S):
        try: j = json.loads(m.group(1))
        except Exception: continue
        for n in (j.get('@graph') if isinstance(j, dict) and '@graph' in j else [j]):
            if isinstance(n, dict) and n.get('@type') == 'Product': prod = n
    if not prod: return None
    specs = {clean(k): clean(v) for k, v in re.findall(r'class="pd-spec__k">\s*(.*?)\s*</span>\s*<(?:span|div)[^>]*class="[^"]*pd-spec__v[^"]*"[^>]*>\s*(.*?)\s*</(?:span|div)>', src, re.S)}
    rows = {clean(k): clean(v) for k, v in re.findall(r'class="pd-price__lbl">\s*(.*?)\s*</span>\s*<span[^>]*class="pd-price__val[^"]*"[^>]*>\s*(.*?)\s*</span>', src, re.S)}
    offer = prod.get('offers') or {}
    if isinstance(offer, list): offer = offer[0] if offer else {}
    cat = ''
    for ap in prod.get('additionalProperty') or []:
        if 'دسته' in str(ap.get('name', '')): cat = ap.get('value', '')
    if not cat:
        m = re.search(r'pd-dest__label">\s*(.*?)\s*</span>', src, re.S); cat = clean(m.group(1)) if m else ''
    upd = re.search(r'pd-updated">\s*(.*?)\s*</p>', src, re.S)
    brand = (prod.get('brand') or {}).get('url', '')
    price = num(rows.get('قیمت هر عدد')) or num(offer.get('price'))
    pack = num(rows.get('تعداد در پک'))
    pid = pid or (re.search(r'/product/(\d+)/', prod.get('url', '') or '') or [None, None])[1]
    return {
        'alsatId': str(pid), 'brandUrl': brand,
        'name': clean(prod.get('name')), 'price': price, 'pack': to_fa(pack) if pack else '',
        'colors': to_fa(specs.get('تعداد رنگ در پک', '')), 'sizing': specs.get('سایزبندی', ''),
        'height': specs.get('قد', ''), 'material': specs.get('جنس') or prod.get('material', ''),
        'code': specs.get('کد محصول') or prod.get('sku', ''), 'desc': specs.get('توضیحات') or clean(prod.get('description')),
        'category': cat, 'images': [i for i in (prod.get('image') or [])] if isinstance(prod.get('image'), list) else [prod.get('image')] if prod.get('image') else [],
        'inStock': 'InStock' in str(offer.get('availability', '')) , 'updatedSrc': jalali_text_to_iso(clean(upd.group(1)) if upd else ''),
    }

# ---------- پیدا کردن شناسه‌ی محصولات فروشگاه ----------
def robots_ok():
    rp = urllib.robotparser.RobotFileParser()
    try:
        rp.parse(fetch(BASE + '/robots.txt').splitlines())
    except Exception as e:
        log('⚠ robots.txt خوانده نشد (ادامه می‌دهیم):', e); return True
    ok = rp.can_fetch(UA, BASE + SHOP)
    if not ok: log('⛔ robots.txt اجازه‌ی خواندن صفحه‌ی فروشگاه را نمی‌دهد؛ همگام‌سازی انجام نشد.')
    return ok

def discover():
    ids = []
    for page in range(1, MAX_PAGES + 1):
        url = BASE + SHOP + ('' if page == 1 else f'?page={page}')
        try: src = fetch(url)
        except Exception as e:
            if page == 1: raise
            log('پایان صفحه‌بندی:', e); break
        found = []
        for i in re.findall(r'/product/(\d+)/', src):
            if i not in found: found.append(i)
        new = [i for i in found if i not in ids]
        log(f'صفحه {page}: {len(found)} لینک محصول، {len(new)} جدید')
        if not new: break
        ids += new
    return ids

# ---------- عکس‌ها ----------
def save_image(url, pid, k):
    h = hashlib.md5(url.encode()).hexdigest()[:8]
    path = f'{IMGDIR}/alsat-{pid}-{k}-{h}.jpg'
    if os.path.exists(path): return path
    data = fetch(url, binary=True)
    os.makedirs(IMGDIR, exist_ok=True)
    try:
        from PIL import Image; import io
        im = Image.open(io.BytesIO(data)).convert('RGB'); im.thumbnail((1200, 1200)); im.save(path, 'JPEG', quality=82, optimize=True)
    except ImportError:
        open(path, 'wb').write(data)
    return path

# ---------- ادغام ----------
SYNC = ['name', 'price', 'pack', 'colors', 'sizing', 'height', 'material', 'code', 'desc']
def load():
    try: d = json.load(open(DATA, encoding='utf8'))
    except FileNotFoundError: d = {}
    if isinstance(d, list): d = {'settings': {}, 'categories': [], 'products': d}
    d.setdefault('settings', {}); d.setdefault('categories', []); d.setdefault('products', [])
    return d

def run(dry=False):
    if not robots_ok(): return 1
    ids = discover()
    if not ids: log('هیچ محصولی در صفحه‌ی فروشگاه پیدا نشد (ساختار صفحه عوض شده یا دسترسی بسته است).'); return 1
    db = load(); ign = set(map(str, db['settings'].get('alsatIgnore', [])))
    byA = {p['alsatId']: p for p in db['products'] if p.get('alsatId')}
    now_ms = int(time.time() * 1000); changed = 0; seen = set(); fresh = []
    for pid in ids:
        if pid in ign: continue
        try: info = parse_product(fetch(f'{BASE}/product/{pid}/'), pid)
        except Exception as e: log(f'⚠ محصول {pid} خوانده نشد:', e); continue
        if not info: log(f'⚠ محصول {pid}: ساختار صفحه شناخته نشد'); continue
        if '/shop/' + SHOP.strip('/').split('/')[-1] not in info['brandUrl']:
            continue  # محصول فروشگاه دیگر (مثلاً پیشنهادهای مشابه)
        seen.add(pid)
        p = byA.get(pid)
        if p is None:
            if dry: log('جدید:', info['name']); continue
            imgs = [save_image(u, pid, k) for k, u in enumerate(info['images'][:10])]
            p = {'id': 'a' + pid, 'alsatId': pid, 'category': info['category'], 'priceUnit': 'piece',
                 'stock': DEFAULT_STOCK if info['inStock'] else 0, 'alsatOut': not info['inStock'],
                 'images': imgs, 'alsatImgs': info['images'][:10], 'created': now_ms,
                 'updated': info['updatedSrc'] or datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')}
            for f in SYNC: p[f] = info[f]
            p['alsatHash'] = hashlib.md5(json.dumps([info[f] for f in SYNC], ensure_ascii=False).encode()).hexdigest()
            if info['category'] and info['category'] not in db['categories']: db['categories'].append(info['category'])
            fresh.append(p); changed += 1; log('➕ جدید:', info['name'])
            continue
        if p.get('locked'): continue
        h = hashlib.md5(json.dumps([info[f] for f in SYNC], ensure_ascii=False).encode()).hexdigest()
        ch = False
        if h != p.get('alsatHash'):
            for f in SYNC: p[f] = info[f]
            p['priceUnit'] = 'piece'; p['alsatHash'] = h; ch = True
            p['updated'] = info['updatedSrc'] or datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
        if info['images'][:10] != p.get('alsatImgs') and not dry:
            p['images'] = [save_image(u, pid, k) for k, u in enumerate(info['images'][:10])]; p['alsatImgs'] = info['images'][:10]; ch = True
        if not info['inStock'] and p.get('stock', 0) != 0: p['stock'] = 0; p['alsatOut'] = True; ch = True
        elif info['inStock'] and p.get('alsatOut'): p['stock'] = DEFAULT_STOCK; p['alsatOut'] = False; ch = True
        if p.get('alsatGone'): p['hidden'] = False; p['alsatGone'] = False; ch = True
        if ch: changed += 1; log('✏ به‌روز شد:', p['name'])
    # محصولاتی که دیگر در آلسات نیستند → مخفی (فقط اگر لیست کامل به نظر برسد)
    known = [p for p in db['products'] if p.get('alsatId') and not p.get('locked')]
    if known and len(seen) >= 0.5 * len(known):
        for p in known:
            if p['alsatId'] not in seen and p['alsatId'] not in ign and not p.get('alsatGone'):
                p['hidden'] = True; p['alsatGone'] = True; changed += 1; log('🙈 دیگر در آلسات نیست (مخفی شد):', p['name'])
    elif known: log('⚠ تعداد محصولات پیداشده خیلی کمتر از قبل است؛ برای ایمنی چیزی مخفی نشد.')
    if not changed: log('تغییری وجود نداشت.'); return 0
    db['products'] = fresh + db['products']
    db['settings']['updated'] = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    if not dry:
        os.makedirs(os.path.dirname(DATA) or '.', exist_ok=True)
        json.dump(db, open(DATA, 'w', encoding='utf8'), ensure_ascii=False, indent=1)
    log(f'✅ پایان: {changed} تغییر');
    return 0

if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('--file'); ap.add_argument('--dry', action='store_true'); a = ap.parse_args()
    if a.file:
        print(json.dumps(parse_product(open(a.file, encoding='utf8').read()), ensure_ascii=False, indent=1)); sys.exit(0)
    try: sys.exit(run(a.dry))
    except Exception as e:
        log('❌ خطا:', e); sys.exit(1)
