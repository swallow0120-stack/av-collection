# 我的收藏

個人收藏管理網站：靜態網頁、結構化資料、可備份的本機編輯器。

## 使用方式

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
python -m http.server 8000
```

從 http://localhost:8000 開啟網頁（不要直接以 file:// 開啟管理頁）。
`python scripts/build_site.py --check` 可檢查輸出是否與資料同步。

## 還原

GitHub 每次提交均保留歷史。可還原某次 `data/catalog.json`，重新提交後網站會自動生成。
遷移前快照與基準檔請保留；不需要因新增收藏就修改基準。
