# TODO — 本機驗證與功能開發進度

> 最後更新 2026-07-25。給明天接續用,也給隊友看目前狀態。
>
> **要準備跟隊友合併、交接公司環境部署的人，先看 [DEPLOYMENT-HANDOFF.md](DEPLOYMENT-HANDOFF.md)**——那份文件整理了雲端 API 目前卡在哪（403，IP 白名單問題）、語音辨識為什麼不能直接搬過去、公司 DGX 資源要注意什麼，這份 TODO.md 只留逐次修復/驗證的操作紀錄，兩份文件分工不重複。

## 2026-07-25：測試公司雲端 Qwen API，卡在 403（IP 白名單）

拿到測試 key 後把 `.env` 切到雲端組（`AI_EGRESS_MODE=cloud-approved` + `AI_TEXT_PROVIDER`/`AI_VISION_PROVIDER=openai-compatible`），實測直接收到 `403 Forbidden`——判斷是這台機器的來源 IP 不在對方白名單。**這不是程式碼問題，需要請公司 IT／API 管理者把之後正式部署主機的 IP 加進允許清單**（不是這次測試失敗的這台開發機的 IP，部署到公司環境後對外 IP 會不一樣），詳細寫在 [DEPLOYMENT-HANDOFF.md](DEPLOYMENT-HANDOFF.md) 第 2 節。

順手做了兩個錯誤訊息改善（之後任何人測雲端 API 失敗都受益）：
- [`base.ts`](server/services/ai/base.ts) 呼叫失敗時，把上游回傳內容（最多 500 字）一起包進錯誤訊息，不再只有 HTTP 狀態碼
- [`jobs/[id].get.ts`](server/api/jobs/[id].get.ts) 把 pg-boss 存的真實失敗訊息傳回前端，不再是寫死的「AI task failed」

`.env` 現在已經切回地端組（key 也改回佔位字串），把地端／雲端兩組設定整理成註解區塊方便之後切換，用法見 [DEPLOYMENT-HANDOFF.md](DEPLOYMENT-HANDOFF.md) 第 1 節。

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

## 2026-07-23 補充：語音輸入接上真的 whisper.cpp，本機驗證過辨識準確

`AI_AUDIO_PROVIDER=stub` 之前只驗證過機制（錄音→job→分析），內容是固定假文字。這次改成本機自己編一份 [whisper.cpp](https://github.com/ggml-org/whisper.cpp) 的 `examples/server`，原生跑在 Windows 主機上（不是 Docker），新增 `server/services/ai/whisper-cpp.ts` provider 讓 worker 透過 `host.docker.internal` 連過去。**實測：講中文，候選卡片內容跟講的話對得上，確認真的辨識準確，不是只有機制通。**

- ✅ 新增 `WhisperCppProvider`（`whisper-cpp.ts`），`ProviderName`/`createAiProvider` 都已註冊，`AI_AUDIO_PROVIDER=whisper-cpp` 可用，`WHISPER_BASE_URL` 沿用同一個環境變數（跟 `local-whisper` 共用，同時只會啟用一個）
- ⚠️ **踩坑一：Windows 把 8080 port 保留給 Hyper-V/Docker NAT**，whisper.cpp server 綁定 `--port 8080` 會直接失敗（`couldn't bind to server socket`）。用 `netsh interface ipv4 show excludedportrange protocol=tcp` 可以查出哪些範圍被排除，本機最後改用 `9000`
- ⚠️ **踩坑二：whisper.cpp 只認得原始 WAV/PCM**，瀏覽器 `MediaRecorder` 錄音預設是 WebM/Opus，直接丟給 whisper.cpp 會報 `failed to decode audio data from memory buffer`。修法是在 `whisper-cpp.ts` 裡先用 `ffmpeg` 把音檔轉成 16kHz mono WAV 再上傳，`worker-runtime` 這個 Docker stage 也補裝了 `ffmpeg`（faster-whisper 那條路不會踩到這個問題，因為它底層本來就有更完整的解碼能力）
- ⚠️ **這整套是本機測試用的，不代表正式環境部署方式**：whisper.cpp 是 Windows 原生執行檔，不在任何 Docker image 裡，正式環境如果 Linux 主機要用同一份，得另外寫 Linux 版 Dockerfile 重新編譯——這是接下來要做的事（見下方待辦）

## 2026-07-23 補充：照片辨識接上真的視覺模型，順便修掉逾時問題

發現照片辨識一直回傳一模一樣的結果，不管拍什麼都是「照片中的餐點」、520 kcal 那組固定值——查證後是 `AI_VISION_PROVIDER` 從頭到尾都還是 `stub`（`stub.ts` 的 `analyzeMeal()` 對圖片輸入本來就是回傳寫死的假資料，之前只有 `AI_TEXT_PROVIDER` 換成過 `ollama`，視覺這條線沒人記得換）。

- ✅ 本機 Ollama 的 `qwen3.5:9b` 本身就有 `vision` 能力（`ollama list` API 回傳的 `capabilities` 裡看得到），不用額外下載模型，`.env` 改成 `AI_VISION_PROVIDER=ollama`、`AI_VISION_MODEL=qwen3.5:9b` 即可
- ✅ 順便處理掉最上面「接下來」清單裡一直沒做的那項：`ollama.ts`/`openai-compatible.ts` 的 `analyzeMeal()` 逾時從寫死的 30 秒拉長到 90 秒——`qwen3.5:9b` 是 thinking 模型，回答前會先想一段時間，30 秒本來就不夠，這也是公司正式環境 `-thinking` 模型會遇到的同一個問題
- ⚠️ **接上後第一次真的用手機照片測試直接失敗（`AI TASK FAILED`）**，查 Ollama 自己的 server log（`%LOCALAPPDATA%\Ollama\server.log`）才看到真正原因，是兩個問題疊在一起：
  1. Ollama 呼叫預設的上下文視窗只有 **4096 tokens**，真實照片編碼成 base64 塞進 prompt 後輕鬆超過（log：`request (4357 tokens) exceeds the available context size (4096 tokens)`），直接 400 失敗——`ollama.ts` 原本沒有帶 `options.num_ctx`，已改成明確帶 `16384`
  2. 就算上下文夠大，`qwen3.5:9b` 這個 thinking 模型對這個任務會陷入長篇「自我懷疑」式的思考迴圈，實測一張測試小圖它想了 4000+ token 也沒真的給出答案，直接把輸出額度燒光——已在請求加 `think: false` 關掉思考模式，同一張測試圖改善後 5 秒內就給出乾淨的 JSON
  3. 這兩個修正都在 `ollama.ts` 的 `chat()`，`openai-compatible.ts` 目前沒有equivalent的 `think` 參數可關（OpenAI 相容 API 沒這個欄位），公司雲端 `-thinking` 模型如果之後也出現同樣的「想很久但沒答案」問題，需要另外想辦法（例如 prompt 明確要求不要展示思考過程，或看雲端 API 是否有對應參數）

## 已知問題，還沒處理

- ⚠️ CSP 行內樣式問題可能不只一處，今天只確認修了會擋住錄音流程那一個，其他頁面可能還有沒踩到的殘留問題
- ⚠️ `pages/index.vue`、`recommend.vue`、`trend.vue` 還在用 `~/data/mock` 假資料，樣式對齊 PM 原型但內容邏輯還沒串
- ⚠️ 原生 Windows `pnpm dev` 的框架 bug 還沒解決，之後想拿回 HMR 要另外處理

## 接下來（依 [FEATURE-PLAN.md](FEATURE-PLAN.md) 分期）

- [ ] 決定怎麼處理食物辨識準確度問題（換模型 / 收緊比對門檻，見上）
- [ ] 把這次的新 commit push 到 fork
- [ ] 拿到公司真的 API key 後，測試雲端 Qwen provider
- [ ] 第二期：拍照辨識的份量範圍選擇 UI（一碗/半碗/四分之一碗）
- [ ] 全頁面走一輪，確認畫面跟 Console 都乾淨
- [ ] 幫 whisper.cpp 寫一份 Linux 版 Dockerfile，讓語音辨識也能跟著 `docker compose build` 走，而不是綁死在這台 Windows 機器上手動編譯的執行檔
