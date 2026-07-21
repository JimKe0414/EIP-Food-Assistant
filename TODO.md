# TODO — 本機驗證與功能開發進度

> 最後更新 2026-07-20。給明天接續用,也給隊友看目前狀態。

## 分支與 push 狀態

工作都在 `feature/meal-recording-nutrition-db` 分支,**`master` 完全沒被動到**。

- 這個 GitHub 帳號（Louis06719）對原始 repo（`JimKe0414/EIP-Food-Assistant`，git remote 叫 `origin`）**沒有寫入權限**，push 會 403
- 已改推到自己的 fork：git remote 叫 `fork`，指向 `https://github.com/Louis06719/EIP-Food-Assistant`，分支已經推上去了
- 之後拿到 collaborator 權限，直接 `git push origin feature/meal-recording-nutrition-db` 即可，兩個 remote 不衝突
- 目前 8 個 commit：TFDA 解析器/功能串接 → Docker 環境三個 bug 修復 → CSP inline style 修復 → Qwen provider 設定準備 → TODO.md 補回來 → migration 檔案換行符修正（`.gitattributes`）
- ⚠️ 這幾個 commit 除了最早 push 的那批，**還沒 push 上 fork**，之後記得補推

## 本機執行方式

- **執行/測試 `pnpm test`、`pnpm typecheck` 現在可以直接在這台機器跑**（node v22.23.1、pnpm 11.6.0 都已經裝好、可用），不用再繞 Docker
- **但 `pnpm dev` 仍然不能用**：原生 Windows 跑 Nuxt dev server 在每個 request 都會炸 `ERR_UNSUPPORTED_ESM_URL_SCHEME`，判斷是 Nitro/Vite 在這個 Windows + Node 版本組合下的框架底層 bug，已排除過自己的程式碼跟乾淨重裝，暫時繞不過去
- **實際跑起來測試畫面，一律用 Docker Compose**：

  ```powershell
  docker compose up --build -d      # 改了程式碼要重新跑這個（Docker Desktop 要先開著）
  docker compose ps                  # 看服務狀態（migrate 顯示不出來是正常的，跑完就結束了）
  docker compose logs -f web         # 或 worker，追即時 log
  docker compose down                # 全部停掉
  ```

  這是正式建置版本，沒有 HMR。用的是 Docker Compose 自己的 Postgres 容器（全新、自動建表），跟你之前手動裝的原生 PostgreSQL 是兩份分開的資料庫。

## 今天修好、驗證過的東西

- ✅ Docker 環境下的登入（開發登入 + CSRF + session）、AI 分析工作佇列——原本兩個環境相關 bug 導致完全不能用，已修好並用 curl 驗證整條鏈路
- ✅ TFDA 解析器支援政府現行（2025版UPDATE1）xlsx 格式，保留舊格式相容
- ✅ `findBestFoodMatch()` 已接進 `meals/analyze` 流程（`nutrients` 表目前是空的，還沒同步資料，見下方待辦）
- ✅ `meals.summary` 欄位補上，AI 產生的摘要不再被丟棄
- ✅ 語音輸入整條機制驗證可動（麥克風錄音 → 上傳 → 轉錄 job → 分析 job → 候選卡片 → 確認存檔），內容是 stub 假資料（`AI_AUDIO_PROVIDER=stub` 本來就不會真的聽你說什麼，這是預期行為）
- ✅ CSP 行內 style 屬性放行（`style-src-attr 'unsafe-inline'`，只影響屬性層級，不影響 `<style>` 標籤的 nonce 或 script-src）
- ✅ 準備好公司測試環境用的雲端 Qwen provider 設定（見下一節），還沒啟用
- ✅ **真的用本機 Ollama 跑完一次完整分析**（不是 stub）：文字輸入「雞胸肉便當，飯半碗，燙青菜一份」→ `qwen2.5:7b` 在 ~18 秒內回傳結構化 JSON，`portionDescription` 正確帶出「一碗」這種份量用詞（prompt 調整有生效）。模型辨識結果本身不準（猜成「牛肉麵」）是模型能力問題，不是程式碼 bug——本機用的是 7B 小模型，跟公司正式環境的 35B 差很多，預期之內
- ✅ 修好 migration 檔案的換行符問題：Windows `core.autocrlf` 把 `db/migrations/0001_add_meal_summary.sql` 從 LF 轉成 CRLF，導致 `scripts/migrate.mjs` 的 checksum 校驗失敗、`docker compose up` 卡在 migrate 這步。已手動校正資料庫記錄的 checksum，並加 `.gitattributes` 鎖住 `db/migrations/*.sql` 用 LF，避免以後再發生

## AI Provider：公司測試環境的雲端 Qwen（準備好了，還沒啟用）

公司最終測試網址是 OpenAI-相容端點，`.env`/`.env.example`/`compose.yml` 都已經補上對應變數：

- `OPENAI_COMPAT_BASE_URL=https://api.focusit.tw/openai/v1`
- 兩個模型：`Qwen3.6-35B-A3B-fast`（一般用）／`Qwen3.6-35B-A3B-thinking`（複雜任務，`OPENAI_COMPAT_MAX_TOKENS` 要 ≥ 4000，已經加進 provider 程式碼會自動帶進 request body）
- `.env` 的 `OPENAI_COMPAT_API_KEY` 現在是隨機佔位字串。等真的 key 補上，且把 `AI_EGRESS_MODE` 改成 `cloud-approved`、`AI_TEXT_PROVIDER`/`AI_VISION_PROVIDER` 改成 `openai-compatible`，才會真的切過去用（`server/services/ai/index.ts` 的 `validateAiConfiguration()` 會擋住 egress mode 沒開就用雲端 provider 的情況）
- 本機開發資源不夠跑 35B 模型，改用 Ollama 跑同系列 Qwen 的低精度版本本地測試，跟公司雲端環境分開（`OLLAMA_BASE_URL` 記得用 `http://host.docker.internal:11434`，不是 `localhost`，因為 worker 跑在容器裡）
- 本機已裝三顆 Qwen 模型：`qwen2.5:7b`、`qwen2.5:14b`、`qwen3.5:9b`，**目前 `.env` 用 `qwen2.5:7b`**（`qwen3.5:9b` 是會先長篇思考才回答的「thinking」模型，目前 `ollama.ts`/`openai-compatible.ts` 寫死 30 秒逾時，撐不到它想完，會逾時失敗兩次後正式失敗——這跟公司要用的 `-thinking` 模型是同一類問題，逾時時間之後要一起調大，不要只用一個寫死的 30 秒常數）
- 三個模型都只有文字能力，沒有視覺（圖片辨識），`AI_VISION_PROVIDER` 目前還是留 `stub`

## 2026-07-21 補充：xlsx 真的同步進去了，發現食物辨識準確度問題

- ✅ **`nutrients` 表已經有真資料了**：xlsx 上傳過程中又踩到兩個只有正式建置版本才會出現的 bug（`xlsx` 套件的 `cpexcel.js` 沒被 Nitro 打包進去、真實檔案裡有空白列被解析器擋掉），都修好了，最後成功同步 **2213 筆**進 `nutrients` 表
- ⚠️ **新發現：`qwen2.5:7b` 常常認錯食物**——輸入「白飯一碗」，模型卻回「牛肉麵」（資料庫裡根本沒有「牛肉麵」這筆，`findBestFoodMatch` 模糊比對硬是配到別的相近名稱，導致「數字看起來精確、但方向就已經錯了」）。確認了比對/資料庫這條管線本身是對的（有查到帶小數點的真實資料），問題出在**小模型本身識別不準**，跟第一期做的比對邏輯是兩回事
- 這代表「量的精確度」要處理，得先解決「食物辨識準確度」，不然份量算得再準也是算在錯的食物上。方向大概兩個：(1) 開發時直接用準確度更高的模型（`qwen2.5:14b`，本機也有）；(2) `findBestFoodMatch` 的比對門檻/邏輯可能也要收緊，不要讓不夠像的名稱也配對成功

## 已知問題，還沒處理

- ⚠️ CSP 行內樣式問題可能不只一處，今天只確認修了會擋住錄音流程那一個，其他頁面可能還有沒踩到的殘留問題
- ⚠️ `pages/index.vue`、`recommend.vue`、`trend.vue` 還在用 `~/data/mock` 假資料，樣式對齊 PM 原型但內容邏輯還沒串
- ⚠️ 原生 Windows `pnpm dev` 的框架 bug 還沒解決，之後想拿回 HMR 要另外處理

## 接下來（依 [FEATURE-PLAN.md](FEATURE-PLAN.md) 分期）

- [ ] 決定怎麼處理食物辨識準確度問題（換模型 / 收緊比對門檻，見上）
- [ ] 把這次的新 commit push 到 fork
- [ ] 把 `ollama.ts`/`openai-compatible.ts` 寫死的 30 秒逾時改成可設定、拉長，讓 thinking 類模型（本機 `qwen3.5:9b`、公司的 `-thinking`）跑得完
- [ ] 拿到公司真的 API key 後，測試雲端 Qwen provider
- [ ] 第二期：拍照辨識的份量範圍選擇 UI（一碗/半碗/四分之一碗）
- [ ] 全頁面走一輪，確認畫面跟 Console 都乾淨
