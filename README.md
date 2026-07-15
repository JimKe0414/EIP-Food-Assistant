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

預設位址：`http://localhost:3000`。需要 API 資料流程時，請使用下方 Compose 啟動 PostgreSQL 與 worker。

## CPU／stub 容器模式

```bash
cp .env.example .env
docker compose up --build -d
docker compose ps
```

請先替換 `.env` 中的資料庫密碼與三個獨立 secret。基礎模式包含：

- `web`：Nuxt / Nitro，唯一發布至主機的服務，預設 `http://localhost:3000`
- `postgres`：只在內部 Docker network 暴露 5432，不發布主機 port
- `migrate`：啟動時一次性執行、校驗 SQL migration
- `worker`：pg-boss queue，預設 stub provider，適合 CI 與無 GPU 環境

健康端點：`/api/health`；含 DB readiness：`/api/ready`。

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

## 登入與資料匯入

- 設定 Google OAuth redirect URI 為 `http://localhost:3000/api/auth/google-callback`（生產環境改用 HTTPS）。
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
