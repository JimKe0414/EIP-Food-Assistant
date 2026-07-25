# AGENTS.md — 一食之選 (EIP Food Assistant) 專案架構

> 給 AI 助理（Claude / Copilot / Cursor 等）與新加入工程師的架構速覽。
> 內容以「讀 code 得到的事實」為準；若與 README 或程式碼衝突，以程式碼為準。

## 1. 這是什麼專案

一個記錄員工餐食、分析營養趨勢、提供午餐推薦的 PWA。整包是 **單一 Nuxt 3 專案**（前端頁面 + 後端 API 都在同一個 repo、同一個 build 產物內），另外有一個獨立的背景 worker process 處理 AI 任務佇列。

不是傳統的「前端 repo + C# ASP.NET API repo」兩包分離架構 — 這裡前後端在同一個 Nuxt 應用內，靠 `server/` 目錄提供 API（Nitro 引擎），靠 `pages/`／`components/` 提供畫面（Vue 3）。

## 2. 技術棧（跟你熟悉的 C# / npm / JS 世界的對應關係）

| 項目 | 這個專案 | 你熟悉的對應物 |
|---|---|---|
| 套件管理器 | **pnpm**（`packageManager: pnpm@11.6.0`，用 `corepack` 啟用） | npm |
| 語言 | **TypeScript**（全專案，前端、後端、worker 都是 .ts） | 前端 JS → 前端 TS；後端 C# → 後端 TS |
| 前端框架 | **Vue 3 + Nuxt 3**（檔案系統路由：`pages/*.vue`） | — |
| 後端 / API 框架 | **Nitro**（Nuxt 內建的伺服器引擎，`server/api/**` 為檔案系統路由的 API） | ASP.NET Web API |
| ORM / DB | **Drizzle ORM**（`db/schema.ts`）+ **PostgreSQL**（`postgres` 套件為底層 driver） | Entity Framework + SQL Server |
| DB migration | **drizzle-kit** 產生 SQL，**自寫的 `scripts/migrate.mjs`** 執行並記錄 checksum | EF Migrations |
| 背景工作／佇列 | **pg-boss**（架在同一個 Postgres 上的 job queue），獨立進程 `worker/index.ts` | Hangfire / Windows Service |
| 驗證 | **Zod**（`shared/domain/**` 的 schema，前後端共用） | FluentValidation / DataAnnotations |
| 測試 | **Vitest**（單元）+ **Playwright**（E2E） | xUnit / Playwright |
| 容器化 | **Docker multi-stage build**（`Dockerfile`）＋ **Docker Compose**（`compose*.yml`） | 無直接對應；概念上取代「IIS 部署 / GUI 封裝」 |
| CI | GitHub Actions（`.github/workflows/ci.yml`） | Azure DevOps Pipeline |

**沒有** C# / .NET 專案，也沒有 `.sln` / `.csproj`。「封裝」在這裡的意思不是 VS 的 GUI publish，而是 `pnpm build` + Docker image build（詳見第 5 節）。

## 3. 目錄結構

```
.
├── pages/                 Vue 頁面（首頁、記錄、推薦、趨勢、個人資料、登入）— 檔案系統路由
├── layouts/                共用版面
├── components/             UI 元件（依頁面分子目錄：app/common/home/profile/recommend/record）
├── composables/            Vue composables（前端共用邏輯，useXxx）
├── assets/                 CSS 等靜態資源（build 時處理）
├── public/                 原樣輸出的靜態檔（icons 等）
│
├── server/                 ★ 後端 API（Nitro，等同你熟悉的 "API專案"）
│   ├── api/                 檔案系統路由的 API endpoint（檔名/路徑即路由，方法後綴 .get/.post.ts）
│   ├── middleware/           全域 middleware（00.security, 01.csrf；數字前綴 = 執行順序）
│   ├── plugins/               Nitro 啟動時掛載的 plugin（CSP nonce、AI 設定驗證）
│   ├── services/                業務邏輯（ai/ provider 抽象、eip/ 解析、tfda/ 同步）
│   └── utils/                    共用工具（db 連線、身分 HMAC、queue、rate-limit）
│
├── shared/domain/           前後端共用的 Zod schema ＋ 純領域邏輯（沒有框架依賴）
│
├── db/
│   ├── schema.ts             ★ Drizzle ORM 資料表定義（唯一的 schema 真實來源）
│   └── migrations/            drizzle-kit 產生 / 手動維護的 SQL migration 檔
│
├── worker/index.ts          ★ 獨立進程：pg-boss worker（AI 任務佇列 + 每日 TFDA 同步排程）
├── whisper/                 獨立的 Python (FastAPI) 服務，跑語音轉文字（faster-whisper），非 Node
│
├── scripts/                 Node 維運腳本（migrate.mjs、check-gpu.mjs、generate-icons.mjs）
├── tests/                   unit/、e2e/
│
├── nuxt.config.ts           Nuxt 設定（含 runtimeConfig = 環境變數對應、PWA 設定）
├── drizzle.config.ts        drizzle-kit 設定（schema 位置、輸出 migration 位置、DB 連線）
├── tsup.config.ts           worker 的獨立 bundle 設定（見第5節）
├── Dockerfile                multi-stage build：web-runtime / worker-runtime / migrator 三種 image
├── compose.yml / compose.gpu.yml / compose.cloud.yml   本機／GPU／雲端 AI 三種佈署組合
└── .env.example              所有環境變數範例
```

## 4. API 架構細節（Nitro）

`server/api/` 底下的檔名就是路由，檔名結尾決定 HTTP method：

- `server/api/meals/index.get.ts` → `GET /api/meals`
- `server/api/meals/index.post.ts` → `POST /api/meals`
- `server/api/meals/analyze.post.ts` → `POST /api/meals/analyze`
- `server/api/jobs/[id].get.ts` → `GET /api/jobs/:id`（`[id]` = 路由參數，等同 ASP.NET 的 `{id}`）

現有 API 清單（`server/api/**`）：

- `auth/`：`dev.post`（開發登入）、`google.get` + `google-callback.get`（Google OAuth）、`session.get`、`logout.post`
- `csrf-token.get`
- `eip/import.post`、`eip/menu.get`、`eip/menu.post`：員工餐廳 CSV/XLSX 匯入與選單
- `health.get`、`ready.get`：健康檢查（Docker healthcheck 用）
- `internal/tfda-sync.post`：只給 worker 用內部 token 呼叫的內部端點
- `jobs/[id].get`：查詢非同步 AI 任務狀態
- `meals/index.get`、`meals/index.post`、`meals/analyze.post`、`meals/summary.get`
- `nutrients/index.get`
- `profile/index.get`、`profile/index.post`
- `preferences/index.get`、`preferences/index.post`
- `recommend-lunch.post`、`recommend-lunch/confirm.post`
- `tfda/sync.post`

中介層執行順序由檔名數字前綴決定：`00.security.ts` → `01.csrf.ts`（全部 request 都會先經過這裡：CSRF、CSP nonce、HTTP method/path 防護、smuggling 防護等，對應 README 提到的安全機制）。

業務邏輯不直接寫在 `api/*.ts` 裡，而是委派給 `server/services/`：
- `services/ai/`：多 provider 抽象（`ollama`、`local-whisper`、`openai-compatible`、`google-genai`、`stub`），由 `services/ai/index.ts` 依環境變數選擇 provider
- `services/eip/parser.ts`：員工餐廳 CSV/XLSX 解析
- `services/tfda/sync.ts`：台灣 TFDA 營養資料庫同步

## 5. 資料庫（回答你的第三個問題）

**有，是 PostgreSQL。** 不是內嵌/檔案型資料庫，需要一個真的 Postgres instance（本機開發用 `docker compose up` 起的 `postgres:17-alpine` 服務，或你自己裝一個）。

### Schema 真實來源

`db/schema.ts` 是唯一的 schema 定義（Drizzle ORM，TypeScript 寫的），對應 SQL migration 在 `db/migrations/0000_initial.sql`。目前的資料表：

| 表 | 用途 |
|---|---|
| `users` | 使用者（以 `identity_hmac` 做去識別化的身分識別，非明文 email） |
| `profile_snapshots` | 個人身體數值快照（年齡/性別/身高/體重/體脂...），時間序列 |
| `user_preferences` | 健康目標與提醒開關；依使用者保存 |
| `meals` | 使用者的餐食記錄（來源：manual/photo/voice/eip/custom/tfda），`client_request_id` 防止重複提交 |
| `custom_foods` | 使用者自訂食物 |
| `eip_menu_items` | 員工餐廳（EIP）當日菜單匯入資料 |
| `eip_orders` | 員工餐廳訂餐記錄匯入資料 |
| `nutrients` | TFDA 營養資料庫（正式表） |
| `nutrients_staging` | TFDA 資料同步用的暫存表 |
| `nutrient_versions` | TFDA 來源檔案版本追蹤（hash、etag、row count） |
| `nutrient_sync_logs` | TFDA 同步歷史紀錄 |
| `meal_import_batches` | 使用者匯入批次紀錄（用 file hash 防重複匯入） |
| `ai_audit_events` | AI 任務稽核紀錄（provider、狀態、耗時） |

### 重要：Row-Level Security（RLS）

`meals`、`custom_foods`、`profile_snapshots`、`user_preferences`、`eip_menu_items`、`eip_orders`、`meal_import_batches` 都開了 **`ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY`**，policy 綁定 Postgres session 變數 `app.current_user_id`。意味著：**就算 API 程式碼寫錯、忘記加 WHERE user_id = ...，資料庫層也會擋掉跨使用者存取**。這是這個專案的核心安全設計，之後你自己建表／改表時要留意是否也要套用同樣的 RLS pattern（可以參考 `db/migrations/0000_initial.sql` 第 90 行左右的 policy 產生邏輯）。

### 建表 / 加欄位的正確流程

這裡**不是**直接手改 DB 或用 GUI 工具建表，流程是：

1. 修改 `db/schema.ts`（用 Drizzle 的 TS API 定義/調整欄位）
2. 執行 `pnpm db:generate`（= `drizzle-kit generate`）→ 會在 `db/migrations/` 產生新的 SQL migration 檔
3. 檢查產生的 SQL（尤其如果你新表也需要 RLS，要手動補上 policy，drizzle-kit 不會自動加）
4. 執行 `pnpm db:migrate`（= `node scripts/migrate.mjs`）→ 連到 `DATABASE_URL` 指定的 Postgres，依序執行尚未套用的 migration，並把 checksum 記錄到自動建立的 `app_migrations` 表。**如果已套用的 migration 檔內容被改過，這支腳本會直接丟錯拒絕執行**（防止線上/本機 schema 對不齊）。

### 連線設定

- 本機：`DATABASE_URL` 環境變數，範例見 `.env.example` / `drizzle.config.ts` 的 fallback 值（`postgresql://food_app:local-only-change-me@localhost:5432/first_choice_food`）
- Docker Compose：`compose.yml` 裡 `migrate` 服務會在 `web`／`worker` 啟動前先跑一次性 migration（`depends_on: service_completed_successfully`）
- 連線程式碼：`server/utils/db.ts`（Nuxt/Nitro 端，用 `drizzle-orm/postgres-js`）、`worker/index.ts`（worker 端另開一條 `postgres` 連線，主要用來寫 `ai_audit_events`）

## 6. 建置與封裝流程（回答你的第二個問題）

C# 世界的「在 VS 按右鍵 Publish → 產生一包可以丟到 IIS/伺服器的東西」，這裡的等價流程是 **`pnpm build` + Docker multi-stage build**，細節如下。

### 本地端只是想跑起來看效果（開發模式，不算封裝）

```bash
pnpm install
pnpm dev          # http://localhost:3000，前端有 HMR；沒有接資料庫的話，API會因為DATABASE_URL缺失而在需要時報503
```

### 「封裝」實際上分三個獨立產物

專案裡有 **三種要跑的東西**：Web（前端+API）、Worker（背景 AI 佇列處理）、Migrator（一次性資料庫遷移），三個都是從同一份原始碼、同一個 `Dockerfile` 用不同的 build target 產生：

```
Dockerfile 內的 stage：
  base → dependencies → build（跑 `pnpm build`）
                          ├─→ web-runtime     （只複製 .output/，跑 Nuxt/Nitro server）
                          ├─→ worker-runtime  （只複製 dist/worker/，跑 pg-boss worker）
                          └─→ migrator        （複製整個 build 產物，跑 db:migrate）
```

`pnpm build` 實際上做兩件事（見 `package.json`）：

```jsonc
"build": "nuxt build && pnpm build:worker"
```

1. **`nuxt build`**：把 `pages/`、`components/`、`server/api/**` 全部編譯打包成 `.output/`，這是一個可以直接 `node .output/server/index.mjs` 執行的獨立 Node server（前端靜態檔＋API 都在裡面，Nitro 會處理路由）。這就是「封裝好的 API + 前端」。
2. **`pnpm build:worker`**（= `tsup`，設定在 `tsup.config.ts`）：把 `worker/index.ts` 單獨打包成 `dist/worker/index.js`（純 ESM、bundle 進 node_modules 依賴），因為 worker 是**獨立進程**，不會被 `nuxt build` 打包進去。

### 完整封裝流程（等同「打包發佈」）

```bash
# 1. 建立三個 Docker image：web / worker / migrator
docker compose build

# 或針對正式環境的雲端 AI 配置
docker compose -f compose.yml -f compose.cloud.yml build

# 2. 啟動（會自動先跑 migrate，成功後才啟動 web / worker）
docker compose up -d

# 3. 確認健康狀態
docker compose ps
curl http://localhost:3000/api/health
curl http://localhost:3000/api/ready   # 含 DB 連線檢查
```

`docker compose up` 時序：`postgres` 起來 → `migrate` 一次性跑完 SQL migration 且成功結束 → `web` 啟動並通過 healthcheck → `worker` 啟動（依賴 `web` healthy，因為 worker 會呼叫 `web` 的內部 API 觸發 TFDA 同步）。

### 部署到正式機器

沒有「VS 打包成一個 exe / MSI 丟上去」這種形式；正式環境就是把這三個 Docker image build 好（或用 CI 建好）之後，在目標主機用 `docker compose -f compose.yml -f compose.cloud.yml up -d` 起服務（`compose.cloud.yml` 是雲端 AI provider 的覆寫設定，`compose.gpu.yml` 是本地 GPU Whisper 的覆寫設定）。API key 不放 `.env`，而是放 `secrets/*.txt`（gitignore）給 Docker secrets 機制讀。

### CI（`.github/workflows/ci.yml`）驗證了什麼

`pnpm install` → `pnpm typecheck` → `pnpm test`（vitest）→ `pnpm build` → `pnpm test:e2e`（playwright）→ 檢查 `.output/public` 靜態檔裡沒有洩漏 API key 字串 → `docker compose config --quiet`（驗證三種 compose 組合語法正確）。CI 目前**沒有** build/push Docker image 到任何 registry 的 step，只驗證能建置。

## 7. 常用指令

| 指令 | 作用 |
|---|---|
| `pnpm dev` | 本地開發伺服器（HMR） |
| `pnpm build` | 正式封裝（nuxt build + worker bundle），對應 `.output/` 與 `dist/worker/` |
| `pnpm typecheck` | `nuxt typecheck`（vue-tsc） |
| `pnpm test` | Vitest 單元測試 |
| `pnpm test:e2e` | Playwright E2E（需先 `pnpm exec playwright install chromium`） |
| `pnpm db:generate` | 依 `db/schema.ts` 產生新的 SQL migration |
| `pnpm db:migrate` | 對 `DATABASE_URL` 執行尚未套用的 migration |
| `docker compose up --build -d` | 起完整本機環境（web + worker + migrate + postgres，AI 用 stub provider） |
| `docker compose --profile local-ai up --build -d` | 加開本機 Ollama |

## 8. 環境變數

完整清單見 [.env.example](.env.example)；重點分類：

- **資料庫**：`DATABASE_URL`（或 `POSTGRES_DB/USER/PASSWORD` 由 compose 組出來）
- **安全**：`SESSION_PASSWORD`、`IDENTITY_HMAC_SECRET`、`INTERNAL_WORKER_TOKEN` — 三個獨立密鑰，正式環境務必各自換成隨機值
- **登入**：`GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI`、`GOOGLE_WORKSPACE_DOMAIN`、`ALLOW_DEV_AUTH`（正式環境必須是 `false`）
- **AI**：`AI_EGRESS_MODE`（`local-only` / `cloud-approved`）、`AI_TEXT_PROVIDER`/`AI_VISION_PROVIDER`/`AI_AUDIO_PROVIDER`（`stub`/`ollama`/`openai-compatible`/`google-genai`/`local-whisper`）、對應的 model 名稱與 base URL
- **TFDA**：`TFDA_AUTO_DOWNLOAD`、`TFDA_NUTRIENT_XLSX_URL`
- **API key（雲端 AI）**：不放 `.env`，放 `secrets/google_genai_api_key.txt`、`secrets/openai_compat_api_key.txt`（gitignored）

## 9. 部署 topology 一覽

```
                        ┌─────────────┐
                        │  postgres   │  (內部 network，不對外)
                        └──────┬──────┘
                               │
              ┌────────────────┼────────────────┐
              │ (一次性，跑完就結束)               │
        ┌─────▼─────┐                     ┌──────▼──────┐
        │  migrate  │                     │     web     │──▶ 對外 :3000
        └───────────┘                     │ (Nuxt/Nitro)│
                                           └──────┬──────┘
                                                  │ 內部 API 呼叫（帶 INTERNAL_WORKER_TOKEN）
                                           ┌──────▼──────┐
                                           │   worker    │──▶ pg-boss queue（同一個 Postgres）
                                           │ (pg-boss)   │──▶ AI provider (ollama / whisper / 雲端)
                                           └─────────────┘
```

`whisper/` 是獨立的 Python FastAPI 服務（非本專案 Node/TS 範疇），只在啟用 `local-audio` profile 時才會起。
