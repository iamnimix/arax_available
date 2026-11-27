#!/usr/bin/env python3
"""
افزودن خودکار محصولِ جدید آلسات به ویترین (فقط افزودن؛ محصولات قبلی را دست نمی‌زند).
- اولین اجرا: فقط لیست محصولات فعلی آلسات را «به‌عنوان قبلی» ثبت می‌کند (چیزی وارد نمی‌شود).
- اجراهای بعدی: هر محصولی که تازه در آلسات پیدا شود وارد data/products.json می‌شود.
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

KNOWN = os.getenv('KNOWN_FILE', 'data/alsat_known.json')
def now_iso(): return datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')

def load():
    try: d = json.load(open(DATA, encoding='utf8'))
    except FileNotFoundError: d = {}
    if isinstance(d, list): d = {'settings': {}, 'categories': [], 'products': d}
    d.setdefault('settings', {}); d.setdefault('categories', []); d.setdefault('products', [])
    return d

def load_known():
    try: return set(map(str, json.load(open(KNOWN, encoding='utf8')).get('ids', [])))
    except FileNotFoundError: return None

def save_known(ids):
    os.makedirs(os.path.dirname(KNOWN) or '.', exist_ok=True)
    json.dump({'ids': sorted(ids, key=int), 'updated': now_iso()}, open(KNOWN, 'w', encoding='utf8'), ensure_ascii=False)

def run(dry=False, import_all=False):
    if not robots_ok(): return 1
    ids = discover()
    if not ids:
        log('هیچ محصولی در صفحه‌ی فروشگاه پیدا نشد (ساختار صفحه عوض شده یا دسترسی بسته است).'); return 1
    known = load_known()
    if known is None and not import_all:
        log(f'اولین اجرا: {len(ids)} محصول فعلی آلسات به‌عنوان «قبلی» ثبت شد. از این به بعد فقط محصولِ جدید وارد می‌شود.')
        if not dry: save_known(ids)
        return 0
    known = known or set()
    new = [i for i in ids if i not in known]
    if not new: log('محصول جدیدی در آلسات نیست.'); return 0
    log(f'{len(new)} محصول جدید پیدا شد.')
    db = load(); have = {p.get('alsatId') for p in db['products'] if p.get('alsatId')}
    ign = set(map(str, db['settings'].get('alsatIgnore', [])))
    fresh = []; now_ms = int(time.time() * 1000)
    for pid in new:
        if pid in have or pid in ign: known.add(pid); continue
        try: info = parse_product(fetch(f'{BASE}/product/{pid}/'), pid)
        except Exception as e: log(f'⚠ محصول {pid} خوانده نشد (ساعت بعد دوباره تلاش می‌شود):', e); continue
        known.add(pid)
        if not info: log(f'⚠ محصول {pid}: ساختار صفحه شناخته نشد'); continue
        if '/shop/' + SHOP.strip('/').split('/')[-1] not in info['brandUrl']: continue   # محصول فروشگاه دیگر
        if dry: log('➕ وارد می‌شد:', info['name']); continue
        imgs = [save_image(u, pid, k) for k, u in enumerate(info['images'][:10])]
        p = {'id': 'a' + pid, 'alsatId': pid, 'category': info['category'], 'priceUnit': 'piece',
             'stock': DEFAULT_STOCK if info['inStock'] else 0, 'images': imgs, 'created': now_ms,
             'updated': info['updatedSrc'] or now_iso()}
        for f in ['name', 'price', 'pack', 'colors', 'sizing', 'height', 'material', 'code', 'desc']: p[f] = info[f]
        if info['category'] and info['category'] not in db['categories']: db['categories'].append(info['category'])
        fresh.append(p); log('➕ جدید:', info['name'])
    if dry: log('🧪 اجرای آزمایشی: چیزی ذخیره نشد.'); return 0
    if fresh:
        db['products'] = fresh + db['products']; db['settings']['updated'] = now_iso()
        os.makedirs(os.path.dirname(DATA) or '.', exist_ok=True)
        json.dump(db, open(DATA, 'w', encoding='utf8'), ensure_ascii=False, indent=1)
    save_known(known)
    log(f'✅ پایان: {len(fresh)} محصول به ویترین اضافه شد.')
    return 0

if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('--file'); ap.add_argument('--dry', action='store_true'); ap.add_argument('--import-all', action='store_true'); a = ap.parse_args()
    if a.file:
        print(json.dumps(parse_product(open(a.file, encoding='utf8').read()), ensure_ascii=False, indent=1)); sys.exit(0)
    try: sys.exit(run(a.dry, a.import_all))
    except Exception as e:
        log('❌ خطا:', e); sys.exit(1)
