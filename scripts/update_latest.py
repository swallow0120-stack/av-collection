import json,re,time
from pathlib import Path
from urllib.parse import quote
from datetime import datetime,timezone
import requests
from bs4 import BeautifulSoup

ACTRESSES=["青空ひかり","鈴村あいり","凰かなめ","木下ひまり","石川澪","明里つむぎ","桃乃木かな","白上咲花","河北彩花","博多彩葉","金松季歩","瀬戸環奈","小宵こなん","三上悠亞","安齋らら","七沢みあ","七海那美","神木麗"]
CODE=re.compile(r"\b(?:\d[A-Z]{2,}|[A-Z]{2,})-\d{2,6}(?:-V)?\b",re.I)
DATE=re.compile(r"(20\d{2})[./\-年](\d{1,2})[./\-月](\d{1,2})")
s=requests.Session();s.headers["User-Agent"]="Mozilla/5.0"

html=Path("index.html").read_text(encoding="utf-8")
owned={x.upper() for x in CODE.findall(html)}

def latest(name):
    url="https://av-wiki.net/?s="+quote(name)+""
    r=s.get(url,timeout=30);r.raise_for_status()
    soup=BeautifulSoup(r.text,"html.parser")
    found=[]
    for node in soup.select("article,.post,.product,.entry,li"):
        text=" ".join(node.stripped_strings)
        codes=CODE.findall(text)
        if not codes: continue
        m=DATE.search(text)
        date=f"{int(m.group(1)):04d}-{int(m.group(2)):02d}-{int(m.group(3)):02d}" if m else ""
        a=node.find("a",href=True)
        for code in codes:
            found.append({"code":code.upper(),"date":date,"url":a["href"] if a else url,"owned":code.upper() in owned})
    seen=set();out=[]
    for x in sorted(found,key=lambda z:z["date"],reverse=True):
        if x["code"] not in seen:
            seen.add(x["code"]);out.append(x)
        if len(out)==5: break
    return out

data=[]
for name in ACTRESSES:
    try: items=latest(name); error=""
    except Exception as e: items=[];error=type(e).__name__
    data.append({"actress":name,"latest":items,"error":error})
    time.sleep(1)
Path("latest.json").write_text(json.dumps({"updated_at":datetime.now(timezone.utc).isoformat(),"collection_count":len(owned),"data":data},ensure_ascii=False,indent=2),encoding="utf-8")
