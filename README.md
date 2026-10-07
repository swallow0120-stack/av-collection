# 我的收藏

個人收藏管理網站：靜態網頁、結構化資料、可備份的本機編輯器。

## 使用方式

購買前在首頁「購買前查重」貼上番號，可一次查多筆。查詢會重新讀取正式收藏；資料無法確認時不會把查無結果當成可放心購買。
`SNOS-309` 是已確認的查詢別名，會對應原始收藏 `9SNOS-309`，顯示「已收藏，勿重複購買」。其他未確認的數字前綴或版本差異只顯示可能重複，原始番號不會被改寫。

首頁可搜尋番號、姓名、別名及備註，也可以按分類篩選。所有數量與排序由資料自動產生。

點「管理收藏」可新增收藏、修改歸屬分類、維護共演名單、加入備註、新增女優分類與別名。
「儲存草稿」只儲存於目前瀏覽器；清除瀏覽器資料會清除草稿，請經常下載備份。
沒有登入後端，不會在網頁存放 GitHub token。

## 發布更新

1. 管理頁點「匯出更新檔」，取得 `catalog.json`。
2. 在 GitHub 的 `data` 資料夾，選 Add file → Upload files，替換 `catalog.json` 並提交到 main。
3. Actions 會驗證、產生 index.html，再透過 GitHub Actions 發布 Pages。
4. Actions 成功後重新整理網站。下載檔案本身不代表已發布。

當正式版已更新，管理頁不會自動將舊草稿覆蓋回去；可先下載舊草稿，再人工合併。

## 資料架構

- `data/catalog.json`：唯一維護來源，包括 people（姓名與別名）、categories（顯示顺序和分類）及 items（番號、歸屬分類、參與者、備註）。
- `data/migration-baseline.json`：本次遷移核對的 203 個番號，避免誤刪；合法新增可超過 203。若確實更正或刪除基準番號，需人工審查並同步調整此檔。
- `data/pre-migration.html`：升級前完整快照。
- `index.html`：由 Python 在每次發布時產生（repository 內保留初始產出快照），保留靜態 `.code` 收藏元素，不依赖 JavaScript 才能查看。
- `manage.html`、`assets/`：搜尋與本機草稿管理介面。
- `scripts/build_site.py`：驗證、排序、產生網頁。

共演名單和歸屬分類分開保存；移動分類不會移除其他參與者。同一人的別名指向同一個 person ID。
舊 latest.json 與 scraper 保留供歷史查閱，未接入網站；舊自動抓取排程已停用，避免繼續寫出錯誤的收藏數。

## 本機開發

Python 3.12，無第三方套件依賴。

```sh
python scripts/build_site.py
python validate_collection.py
python -m unittest discover -s tests -v
node --test tests/test_duplicate_check.cjs
python -m http.server 8000
```

從 http://localhost:8000 開啟網頁（不要直接以 file:// 開啟管理頁）。
`python scripts/build_site.py --check` 可檢查輸出是否與資料同步。

## 還原

GitHub 每次提交均保留歷史。可還原某次 `data/catalog.json`，重新提交後網站會自動生成。
遷移前快照與基準檔請保留；不需要因新增收藏就修改基準。

## 內容預覽來源

在 `scripts/build_site.py` 的 `POSTER_URL_TEMPLATES` 依優先順序設定 HTTPS 網址範本。
`{code}` 是小寫且移除連字號的番號（例如 `sone219`），`{code5}` 將數字補到至少五位（例如 `sone00219`）。
目前使用 example.com 示範來源。網址路徑以 jpg、jpeg、png、webp、gif、avif、svg 結尾時嘗試圖片，其他網址以網頁 iframe 預覽；這不是自動識別任意媒體內容。
圖片失敗或超過 10 秒會試下一個來源。網頁是否被禁止嵌入無法可靠偵測，因此始終保留「開啟原網頁」與「下一個來源」按鈕；最後一個來源按下一個會回到第一個。
第三方網頁使用 sandbox，部分互動或登入功能可能無法在框內使用，請直接開啟原網頁。
驗證預覽行為：`node --test tests/test_preview.cjs`。