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
    lookup_names = set(seen)
    for item in catalog['items']:
        for alias in item.get('lookup_aliases', []):
            sort_key(alias)
            if alias in lookup_names: raise ValueError('Ambiguous lookup alias: '+alias)
            lookup_names.add(alias)
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
            search = ' '.join([item['code'], *item.get('lookup_aliases', []), c['name'], item.get('note', ''), *[n for pid in item['people'] for n in [people[pid]['name'], *people[pid]['aliases']]]])
            detail = f'<div><dt>演員</dt><dd>{esc(cast) if cast else "尚未記錄"}</dd></div>'
            note = f'<div><dt>備註</dt><dd>{esc(item["note"])}</dd></div>' if item.get('note') else ''
            poster = '<div class="poster-slot" role="img" aria-label="暫無圖片"><svg viewBox="0 0 48 48" aria-hidden="true" focusable="false"><rect x="5" y="7" width="38" height="34" rx="4"/><circle cx="17" cy="18" r="4"/><path d="m6 34 11-10 8 7 7-8 10 11"/></svg><span>NO IMAGE</span><small>暫無圖片</small></div>'
            rows.append(f'<article class="entry" data-search="{esc(search, quote=True)}">{poster}<div class="entry-heading"><div class="code" role="heading" aria-level="3">{esc(item["code"])}</div><span class="owned-badge">已收藏</span></div><dl class="entry-details">{detail}{note}</dl></article>')
        sections.append(f'<section class="category" data-category="{esc(c["id"])}"><h2>【{title}】（<span>{len(items)}</span> 部）</h2><div class="collection-grid">'+''.join(rows)+'</div></section>')
    return f'''<!doctype html>
<html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>購買前查重 · 我的收藏（{total} 部）</title><link rel="stylesheet" href="assets/site.css"><script src="assets/duplicate-check.js" defer></script><script src="assets/purchase.js" defer></script><script src="assets/site.js" defer></script></head>
<body><main><header><p class="eyebrow">CHECK BEFORE YOU BUY</p><h1>先查有沒有，再購買</h1><p class="muted">輸入番號，避免重複購買。</p><a class="button" href="manage.html">管理收藏</a></header>
<section class="purchase-panel" aria-label="購買前查重"><label for="purchase-codes">要買哪些？<textarea id="purchase-codes" rows="3" placeholder="輸入番號；多筆請一行一個" autocapitalize="characters" spellcheck="false"></textarea></label><p class="muted">大小寫、空格、連字號會自動整理。已確認別名直接顯示已收藏；其他前綴或版本差異會提醒核對。</p><div class="actions"><button id="purchase-check" type="button">更新資料並查重</button><button id="purchase-clear" type="button">清空</button></div><p id="purchase-freshness" role="status">正在載入正式收藏…</p><p id="purchase-summary" role="status"></p><div id="purchase-results" aria-live="polite"></div></section>
<h2>瀏覽已有收藏</h2>
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
