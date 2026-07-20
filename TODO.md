# TODO — 本機驗證與功能開發進度

> 最後更新 2026-07-19 晚上。給明天接續用,也給隊友看目前狀態。

## 分支與 push 狀態

工作都在 `feature/meal-recording-nutrition-db` 分支,**`master` 完全沒被動到**。

- 這個 GitHub 帳號（Louis06719）對原始 repo（`JimKe0414/EIP-Food-Assistant`，git remote 叫 `origin`）**沒有寫入權限**，push 會 403
- 已改推到自己的 fork：git remote 叫 `fork`，指向 `https://github.com/Louis06719/EIP-Food-Assistant`，分支已經推上去了
- 之後拿到 collaborator 權限，直接 `git push origin feature/meal-recording-nutrition-db` 即可，兩個 remote 不衝突
- 目前 5 個 commit：TFDA 解析器/功能串接 → Docker 環境三個 bug 修復 → CSP inline style 修復 → Qwen provider 設定準備

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

## AI Provider：公司測試環境的雲端 Qwen（準備好了，還沒啟用）

公司最終測試網址是 OpenAI-相容端點，`.env`/`.env.example`/`compose.yml` 都已經補上對應變數：

- `OPENAI_COMPAT_BASE_URL=https://api.focusit.tw/openai/v1`
- 兩個模型：`Qwen3.6-35B-A3B-fast`（一般用）／`Qwen3.6-35B-A3B-thinking`（複雜任務，`OPENAI_COMPAT_MAX_TOKENS` 要 ≥ 4000，已經加進 provider 程式碼會自動帶進 request body）
- `.env` 的 `OPENAI_COMPAT_API_KEY` 現在是隨機佔位字串。等真的 key 補上，且把 `AI_EGRESS_MODE` 改成 `cloud-approved`、`AI_TEXT_PROVIDER`/`AI_VISION_PROVIDER` 改成 `openai-compatible`，才會真的切過去用（`server/services/ai/index.ts` 的 `validateAiConfiguration()` 會擋住 egress mode 沒開就用雲端 provider 的情況）
- 本機開發資源應該不夠跑 35B 模型，計畫改用 Ollama 跑同系列 Qwen 的低精度版本本地測試，跟公司雲端環境分開（`OLLAMA_BASE_URL` 記得用 `http://host.docker.internal:11434`，不是 `localhost`，因為 worker 跑在容器裡）

## 已知問題，還沒處理

- ⚠️ CSP 行內樣式問題可能不只一處，今天只確認修了會擋住錄音流程那一個，其他頁面可能還有沒踩到的殘留問題
- ⚠️ `nutrients` 表是空的：手上有 xlsx，之後透過 `/api/tfda/sync` 上傳即可（解析器已修好），同步完 `findBestFoodMatch` 那段才會真的比對到東西
- ⚠️ `pages/index.vue`、`recommend.vue`、`trend.vue` 還在用 `~/data/mock` 假資料，樣式對齊 PM 原型但內容邏輯還沒串
- ⚠️ 原生 Windows `pnpm dev` 的框架 bug 還沒解決，之後想拿回 HMR 要另外處理
- ⚠️ 這個檔案本身今天被 git 操作誤刪過一次（從沒 commit 過），之後如果要保留規劃文件，記得也 commit 進 git，不要留 untracked

## 接下來（依 [FEATURE-PLAN.md](FEATURE-PLAN.md) 分期）

- [ ] 上傳 xlsx 到 `/api/tfda/sync`，確認同步成功、`nutrients` 表有資料
- [ ] 接上 Ollama 本地測試（`.env` 的 `AI_TEXT_MODEL`/`AI_VISION_MODEL` 已填好，Docker 環境下 `OLLAMA_BASE_URL` 要用 `host.docker.internal`）
- [ ] 拿到公司真的 API key 後，測試雲端 Qwen provider
- [ ] 第二期：拍照辨識的份量範圍選擇 UI（一碗/半碗/四分之一碗）
- [ ] 全頁面走一輪，確認畫面跟 Console 都乾淨
