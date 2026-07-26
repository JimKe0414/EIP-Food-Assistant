# 一食之選

依《一食之選：智慧飲食系統計畫書 v3》與 UI v5 原型實作的 Nuxt 3 / Nitro、PostgreSQL、pg-boss 與 PWA 應用。

## 已實作範圍

- 五頁獨立路由與共用元件：首頁、餐食記錄、午餐推薦、趨勢、個人資料。
- mobile / tablet / desktop / wide 四段 RWD，桌面側欄、wide 資訊欄、鍵盤 focus trap、reduced motion。
- 文字、照片、麥克風輸入 → AI 候選 → 使用者確認 → 正式餐食 API；文字可離線暫存並背景同步。
- 首頁、今日餐食、近 7 日趨勢、個人快照、健康目標、提醒偏好與午餐候選均由 PostgreSQL 讀取；餐食、推薦確認與 EIP 匯入具重複提交保護。
- PostgreSQL schema、快照式個人資料、HMAC 身分、強制 RLS 與可校驗 migration runner。
- Google Workspace OAuth（state + PKCE）、CSRF、CSP nonce、HTTP 方法／路徑／smuggling 防護。
- Ollama、local-whisper、OpenAI-compatible、Google GenAI Provider 與共用 Zod contract。
- 單一 pg-boss AI queue（GPU concurrency 固定為 1）、優先順序、逾時與稽核事件。
- EIP 個人訂餐紀錄維持私有匯入；餐廳菜單以「餐廳＋餐點」去重後全系統共用，重複匯入採更新；TFDA XLSX staging、雜湊、版本、降級與每日排程。
- PWA manifest、maskable icon、Workbox 快取、更新提示、安裝延遲、IndexedDB／Background Sync。
- Vitest、Playwright、GitHub Actions 與 Docker Compose CPU／GPU／雲端配置。

## 本機開發

```bash
pnpm install
pnpm dev
```

`pnpm dev` 會以 Docker Compose 啟動 PostgreSQL、worker、Nuxt 與 Caddy HTTPS proxy。預設網址是 `https://localhost:3000`；若 3000 已被其他程式占用，會自動改用 `https://localhost:3003`，並同步調整 Google OAuth callback。若需要在終端持續顯示 Compose log，使用 `pnpm dev:foreground`。

## CPU／stub 容器模式

```bash
cp .env.example .env
pnpm dev
docker compose ps
```

請先替換 `.env` 中的資料庫密碼與三個獨立 secret。基礎模式包含：

- `caddy`：唯一發布至主機的 HTTPS 入口，預設 `https://localhost:3000`
- `web`：Nuxt / Nitro，只接受 Docker 內部的 Caddy 與 worker 連線
- `postgres`：只在內部 Docker network 暴露 5432，不發布主機 port
- `migrate`：啟動時一次性執行、校驗 SQL migration
- `worker`：pg-boss queue，預設 stub provider，適合 CI 與無 GPU 環境

若 3000 和 3003 都已被占用，啟動器會停止並列出錯誤，不會任意改用其他 port。

健康端點：`/api/health`；含 DB readiness：`/api/ready`。

Docker 會把 `.env` 中的應用設定映射成 Nuxt runtimeConfig 使用的 `NUXT_` 環境變數；修改 Google OAuth、session 或資料庫設定後，需要重新建立 `web` 容器才會生效。

### AI 設定值說明

| 設定值 | 用途 | 可用值與注意事項 |
|---|---|---|
| `AI_EGRESS_MODE` | 控制 worker 是否允許連到雲端 AI | `local-only` 只允許本機或測試 provider；`cloud-approved` 只是允許雲端連線，不會自動選用雲端 AI |
| `AI_TEXT_PROVIDER` | 文字餐點分析、語音轉錄後的餐點分析、午餐推薦、份量重量修正 | `stub`、`ollama`、`openai-compatible`、`google-genai` |
| `AI_VISION_PROVIDER` | 照片餐點分析 | `stub`、`ollama`、`openai-compatible`、`google-genai` |
| `AI_AUDIO_PROVIDER` | 只負責把錄音轉成文字；轉錄文字仍交給 `AI_TEXT_PROVIDER` 分析 | `stub`、`local-whisper`、`whisper-cpp`、`openai-compatible`、`google-genai` |
| `AI_TEXT_MODEL` / `AI_VISION_MODEL` | Ollama 使用的模型名稱 | 只有對應 provider 設為 `ollama` 時才生效 |
| `OPENAI_COMPAT_*` | OpenAI-compatible endpoint、模型與輸出 token 上限 | 只有對應 provider 設為 `openai-compatible` 時才生效 |

`stub` 是供 CI、畫面串接與無 AI 環境測試使用的固定假資料，不會分析輸入內容。文字與照片會固定回傳相同的營養基準，語音則會回傳固定轉錄文字；即使同時填了 Qwen、Llama 或其他 model 名稱，只要 provider 仍是 `stub`，該 model 就不會被呼叫。

修改 `AI_EGRESS_MODE`、`AI_*_PROVIDER` 或模型設定後，必須重新建立 worker 容器才會套用，例如：

```bash
docker compose up -d --force-recreate worker
```

## 本機 Ollama／GPU Whisper

Ollama CPU 或既有 Ollama 服務可用 `.env` 調整 provider。啟用 Compose Ollama profile：

```bash
docker compose --profile local-ai up --build -d
```

GPU worker 與按需載入／釋放 VRAM 的 faster-whisper：

```bash
docker compose -f compose.yml -f compose.gpu.yml --profile local-ai --profile local-audio up --build -d
```

需先安裝 NVIDIA Container Toolkit。`scripts/check-gpu.mjs` 會檢查 `nvidia-smi`、`GPU_CONCURRENCY=1` 與目前模型所需最低 VRAM，不足時拒絕啟動。

## 核准的雲端 AI 模式

API key 不放 `.env`。先建立 Git 忽略的 secrets：

```text
secrets/google_genai_api_key.txt
secrets/openai_compat_api_key.txt
```

未使用的 provider secret 可留空，然後：

```bash
docker compose -f compose.yml -f compose.cloud.yml up --build -d
```

雲端覆寫不啟動 Ollama 或 whisper profile。`AI_EGRESS_MODE=local-only` 若配置雲端 provider，worker 會在啟動階段直接退出。

### FocusIT OpenAI-compatible 午餐推薦

把 API key 存到 Git 忽略的 `secrets/openai_compat_api_key.txt`，檔案只放一行 key。使用快速模型啟動午餐推薦：

```bash
pnpm dev:focusit
docker compose logs -f worker
```

`compose.focusit.yml` 預設使用 `https://api.focusit.tw/openai/v1`、`Qwen3.6-35B-A3B-fast` 與 `max_tokens=4096`；影像和語音仍使用 stub。若要切換思考模型，在 `.env` 設定：

```dotenv
OPENAI_COMPAT_TEXT_MODEL=Qwen3.6-35B-A3B-thinking
OPENAI_COMPAT_MAX_TOKENS=4096
```

開發者仍可用獨立腳本直接測試 FocusIT API；這不會寫入應用程式資料庫，也不會出現在使用者畫面：

```bash
pnpm test:api:lunch
```

測試指令會從同一個 secret 檔或 `OPENAI_COMPAT_API_KEY` 環境變數讀取 key，不會輸出 key。
完整系統的 `/recommend` 只使用登入者可見的 DB 候選；DB 沒有當日菜單時會顯示 0 筆，不會自動放入固定假菜單。

## 登入與資料匯入

- 個人開發可設定 `AUTH_MODE=google` 並將 `GOOGLE_WORKSPACE_DOMAIN` 留空，接受任何已驗證的 Google 帳號；如需限制組織帳號，再填入 Workspace 網域。`ALLOW_DEV_AUTH=true` 時仍保留本機測試登入。
- 在 Google Cloud Console 同時加入 `https://localhost:3000/api/auth/google-callback` 和 `https://localhost:3003/api/auth/google-callback`，讓自動切換 port 後仍可登入。
- 本機可設定 `ALLOW_DEV_AUTH=true`，從 `/login` 使用開發登入；正式環境須保持 `false`。
- 午餐推薦頁可匯入共用 EIP 餐廳菜單 CSV/XLSX，必要欄位只有「餐廳名稱、餐點名稱」。營養欄位可空白；系統保留原檔已有數值，缺少欄位由 AI 依一般單份批次估算並完成驗證後匯入。同一餐廳的同名餐點會更新既有項目。個人訂餐紀錄仍由 `/api/eip/import` 私有匯入，以登入者 HMAC 與 RLS 綁定。
- 使用者可搜尋並保存每日選擇的餐廳；選定後推薦只使用該餐廳菜單，未選定時則可跨餐廳推薦。未登入進入應用頁面或 API 回傳 401 時會提示並導向 `/login`。
- `TFDA_AUTO_DOWNLOAD=false` 是預設合法模式；管理員可手動上傳 XLSX。確認授權後才改為 `true`，worker 會每日 02:00 Asia/Taipei 同步。

## 驗證

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
docker compose config --quiet
```

## 主要目錄

- `pages/`、`components/`：拆頁與模組化 UI
- `server/api/`、`server/services/`：Nitro API、EIP／TFDA／AI Provider
- `shared/domain/`：前後端共用 Zod schema 與純領域邏輯
- `db/`、`scripts/migrate.mjs`：Drizzle schema、SQL migration
- `worker/`、`whisper/`：背景 queue 與 GPU 音訊服務
- `tests/unit/`、`tests/e2e/`：領域、安全、RWD 與互動驗證

本系統提供日常飲食記錄與分析，不提供疾病診斷、處方或用藥建議。
