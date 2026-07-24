# 一食之選

依《一食之選：智慧飲食系統計畫書 v3》與 UI v5 原型實作的 Nuxt 3 / Nitro、PostgreSQL、pg-boss 與 PWA 應用。

## 已實作範圍

- 五頁獨立路由與共用元件：首頁、餐食記錄、午餐推薦、趨勢、個人資料。
- mobile / tablet / desktop / wide 四段 RWD，桌面側欄、wide 資訊欄、鍵盤 focus trap、reduced motion。
- 文字、照片、麥克風輸入 → AI 候選 → 使用者確認 → 正式餐食 API；文字可離線暫存並背景同步。
- PostgreSQL schema、快照式個人資料、HMAC 身分、強制 RLS 與可校驗 migration runner。
- Google Workspace OAuth（state + PKCE）、CSRF、CSP nonce、HTTP 方法／路徑／smuggling 防護。
- Ollama、local-whisper、OpenAI-compatible、Google GenAI Provider 與共用 Zod contract。
- 單一 pg-boss AI queue（GPU concurrency 固定為 1）、優先順序、逾時與稽核事件。
- EIP CSV/XLSX 私有匯入、整批驗證；TFDA XLSX staging、雜湊、版本、降級與每日排程。
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

不啟動資料庫也能使用四筆固定假菜單直接測試 API：

```bash
pnpm test:api:lunch
```

測試指令會從同一個 secret 檔或 `OPENAI_COMPAT_API_KEY` 環境變數讀取 key，不會輸出 key。
完整系統啟動後，也可登入 `/recommend`，按「假資料測試 API」從前端走完整的 Web API、queue、worker 與 FocusIT 回傳流程。

## 登入與資料匯入

- 個人開發可設定 `AUTH_MODE=google` 並將 `GOOGLE_WORKSPACE_DOMAIN` 留空，接受任何已驗證的 Google 帳號；如需限制組織帳號，再填入 Workspace 網域。`ALLOW_DEV_AUTH=true` 時仍保留本機測試登入。
- 在 Google Cloud Console 同時加入 `https://localhost:3000/api/auth/google-callback` 和 `https://localhost:3003/api/auth/google-callback`，讓自動切換 port 後仍可登入。
- 本機可設定 `ALLOW_DEV_AUTH=true`，從 `/login` 使用開發登入；正式環境須保持 `false`。
- 午餐推薦頁可匯入個人 EIP CSV/XLSX。資料不接受 request 指定 `user_id`，並以登入者 HMAC 與 RLS 綁定。
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
