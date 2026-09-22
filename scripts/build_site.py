"""Validate the catalog and generate the static collection page (stdlib only)."""
import argparse
import html
import json
import re
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
CODE = re.compile(r'([0-9]*)([A-Z]+)-([0-9]{3,6})(-V)?')

def sort_key(code):
    m = CODE.fullmatch(code)
    if not m: raise ValueError(f'Invalid code: {code}')
    return m[2], int(m[3]), m[1], m[4] or ''

def validate(catalog):
    if catalog.get('schema_version') != 1: raise ValueError('Unsupported schema version')
    for field in ('people', 'categories', 'items'):
        if not isinstance(catalog.get(field), list): raise ValueError(f'{field} must be an array')
    people = {p['id'] for p in catalog['people']}
    categories = {c['id'] for c in catalog['categories']}
    if len(people) != len(catalog['people']) or len(categories) != len(catalog['categories']):
        raise ValueError('Duplicate IDs')
    aliases = set()
    for p in catalog['people']:
        for name in [p['name'], *p['aliases']]:
            if not isinstance(name, str) or not name.strip() or name in aliases: raise ValueError('Duplicate or empty person name/alias')
            aliases.add(name)
    for c in catalog['categories']:
        if not c['name'].strip() or c['kind'] not in ('person', 'group', 'compilation', 'pending'): raise ValueError('Invalid category')
        if not set(c['people']) <= people: raise ValueError('Unknown category person')
        for link in c.get('links', []):
            if urlparse(link['url']).scheme != 'https' or not urlparse(link['url']).netloc: raise ValueError('Unsafe link')
    seen = set()
    for item in catalog['items']:
        sort_key(item['code'])
        if item['code'] in seen: raise ValueError('Duplicate code: '+item['code'])
        seen.add(item['code'])
        if item['category'] not in categories: raise ValueError('Unknown category: '+item['code'])
        if not set(item['people']) <= people or len(item['people']) != len(set(item['people'])): raise ValueError('Invalid cast')
        if not isinstance(item.get('note', ''), str): raise ValueError('Invalid note')
    if not seen: raise ValueError('Empty catalog')
    if 'SNOS-323' in seen or 'YUJ-172' in seen: raise ValueError('Known incorrect code')
    # Protect the original verified collection; later additions may increase the total.
    baseline = set(json.loads((ROOT / 'data/migration-baseline.json').read_text(encoding='utf-8')))
    if not baseline <= seen: raise ValueError('Verified entries missing: '+', '.join(sorted(baseline-seen)))
    return len(seen)

def render(catalog):
    total = validate(catalog)
    esc = html.escape
    people = {p['id']: p for p in catalog['people']}
    sections = []
    options = ['<option value="">全部分類</option>']
    pending = 0
    for c in catalog['categories']:
        items = sorted((x for x in catalog['items'] if x['category'] == c['id']), key=lambda x: sort_key(x['code']))
        if not items: continue
        if c['kind'] == 'pending': pending += len(items)
        options.append(f'<option value="{esc(c["id"])}">{esc(c["name"])}</option>')
        title = esc(c['name'])
        for link in sorted(c.get('links', []), key=lambda x: len(x['name']), reverse=True):
            title = title.replace(esc(link['name']), f'<a class="person" href="{esc(link["url"], quote=True)}" target="_blank" rel="noopener noreferrer">{esc(link["name"])}</a>', 1)
        rows = []
        for item in items:
            cast = '／'.join(people[x]['name'] for x in item['people'])
            search = ' '.join([item['code'], c['name'], item.get('note', ''), *[n for pid in item['people'] for n in [people[pid]['name'], *people[pid]['aliases']]]])
            detail = f'<small class="cast">共演：{esc(cast)}</small>' if len(item['people']) > 1 else ''
            note = f'<small class="cast">{esc(item["note"])}</small>' if item.get('note') else ''
            rows.append(f'<div class="entry" data-search="{esc(search, quote=True)}"><div class="code">{esc(item["code"])}</div>{detail}{note}</div>')
        sections.append(f'<section class="category" data-category="{esc(c["id"])}"><h2>【{title}】（<span>{len(items)}</span> 部）</h2>'+''.join(rows)+'</section>')
    return f'''<!doctype html>
<html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>我的收藏（{total} 部）</title><link rel="stylesheet" href="assets/site.css"><script src="assets/site.js" defer></script></head>
<body><main><header><p class="eyebrow">MY COLLECTION</p><h1>我的收藏</h1><p class="muted">依分類整理，隨時查找。</p><a class="button" href="manage.html">管理收藏</a></header>
<div class="stats"><strong>{total}<small>收藏總數</small></strong><strong>0<small>重複</small></strong><strong>{pending}<small>待確認</small></strong></div>
<div class="filters"><label>搜尋番號、姓名或別名<input id="search" type="search" placeholder="輸入關鍵字" autocomplete="off"></label><label>分類<select id="category">{''.join(options)}</select></label><button id="clear" type="button">清除</button></div>
<p id="result-count" role="status">共 {total} 部</p><p id="empty" hidden>找不到符合的收藏，請調整搜尋條件。</p>
<div id="collection">{''.join(sections)}</div><footer>資料驗證通過 · 原始收藏完整保留 · <a href="data/catalog.json" download>下載收藏備份</a></footer></main></body></html>\n'''

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    catalog = json.loads((ROOT / 'data/catalog.json').read_text(encoding='utf-8'))
    output = render(catalog)
    if args.check:
        if (ROOT / 'index.html').read_text(encoding='utf-8') != output: raise SystemExit('index.html is out of date; run python scripts/build_site.py')
    else:
        (ROOT / 'index.html').write_text(output, encoding='utf-8', newline='\n')
    print(f'PASS: {len(catalog["items"])} unique entries; baseline preserved; categories and aliases valid')

if __name__ == '__main__': main()
