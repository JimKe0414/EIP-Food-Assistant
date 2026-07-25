# 部署交接 — 給接手公司環境架設的人看

> 2026-07-25 整理。這份文件只講「架構怎麼運作、還缺什麼、要注意什麼」，不重複介紹整個專案——完整架構請先看 [AGENTS.md](AGENTS.md)，這是給任何 AI 助理／新工程師看的架構速覽，本機的 Docker Compose 開發環境也已經照那份文件跑起來過、驗證可行。
>
> 開發過程的細節記錄在 [TODO.md](TODO.md)（逐次修復/驗證的操作紀錄）與 [FEATURE-PLAN.md](FEATURE-PLAN.md)（功能分期與決策理由），這份文件不重複那些內容，只挑「跟部署到公司環境直接相關」的部分整理。

## 1. AI Provider 現在的狀態

系統用同一套 provider 抽象層（`server/services/ai/**`），文字/照片/語音三種功能各自可以獨立指定要用哪個 provider，靠 `.env` 的環境變數切換，**不用改任何程式碼**。目前有兩組已經測過：

| | 地端（目前本機用這組） | 雲端（公司 Qwen API，還沒真正可用） |
|---|---|---|
| 文字分析 | `AI_TEXT_PROVIDER=ollama`（本機 Ollama，`qwen2.5:14b`） | `AI_TEXT_PROVIDER=openai-compatible` |
| 照片分析 | `AI_VISION_PROVIDER=ollama`（本機 Ollama，`qwen3.5:9b`，有視覺能力） | `AI_VISION_PROVIDER=openai-compatible` |
| 語音辨識 | `AI_AUDIO_PROVIDER=whisper-cpp`（見第 3 節，**只在這台開發機能用**） | 還沒測試（見第 2 節） |
| 總開關 | `AI_EGRESS_MODE=local-only` | `AI_EGRESS_MODE=cloud-approved` |

`.env` 裡把這兩組用註解區塊分開放好了（地端/雲端各一組 `AI_EGRESS_MODE`/`AI_TEXT_PROVIDER`/`AI_VISION_PROVIDER`），要切換時把其中一組整組加 `#` 註解掉、另一組取消註解即可——**同一時間只能有一組是沒加 `#` 的狀態，也不能兩組都註解掉**（兩組都關掉的話，系統會 fallback 回 `stub` 假資料，不會報錯，但會很難察覺哪裡出錯，切換時務必確認）。改完 `.env` 後只要重啟 `worker` 容器（`docker compose up -d worker`），不用重新 build image——因為這是環境變數層級的切換，不是程式碼變更。

## 2. 雲端 API 卡住的地方：IP 白名單，需要對方（IT／API 管理者）處理

公司測試環境的 OpenAI 相容端點：

- Base URL：`https://api.focusit.tw/openai/v1`
- 兩個文字模型：`Qwen3.6-35B-A3B-fast`（一般用）／`Qwen3.6-35B-A3B-thinking`（複雜任務，`OPENAI_COMPAT_MAX_TOKENS` 要 ≥ 4000，程式碼已經處理）
- 限用 **60 requests/分鐘、100,000 tokens/分鐘**，這把測試 key **90 天後到期**

**實測結果：拿到真的 key、正確切到雲端 provider 之後，打過去直接收到 `403 Forbidden`。** 已經在 [`base.ts`](server/services/ai/base.ts) 把上游回傳的錯誤內容（最多 500 字）一起包進錯誤訊息裡，並讓 [`jobs/[id].get.ts`](server/api/jobs/[id].get.ts) 把真實錯誤傳回前端（不再是寫死的「AI task failed」），所以之後不管是誰接手測試，一失敗就能直接在畫面上看到對方伺服器實際回了什麼，不用再回頭查資料庫或重現。

403 通常代表**這台機器的來源 IP 不在對方的白名單裡**——這件事沒辦法用程式碼繞過，需要請公司負責這組 API 的人，把之後實際會發送請求的那台機器（也就是 `worker` 容器所在的主機）的對外 IP 加進允許清單。**這是接手部署時第一件要跟對方確認清楚的事**：架設在公司環境、機器在該部門內的話，實際對外 IP 可能跟現在測試用的這台完全不同，白名單要用「正式部署主機的 IP」去申請，不是這次測試失敗的那個 IP。

另外 `.env` 目前把雲端那組 key 已經改回佔位字串（`replaceKey`），不是真的 key——真的 key 值本身沒有存在任何 git 追蹤的檔案裡（`.env` 本來就有被 `.gitignore` 排除），需要另外跟原本給 key 的人要。

**還沒驗證的事**：這組端點支不支援 `/audio/transcriptions`（語音轉文字）。`openai-compatible.ts` 這個 provider 程式碼**已經把這個功能寫好了**（[`openai-compatible.ts:42-48`](server/services/ai/openai-compatible.ts:42-48)），但因為 403 卡住，連文字/照片都還沒測過，音訊這條路完全沒機會驗證。等 IP 白名單解決、key 能正常打通之後，下一步就是試著把 `AI_AUDIO_PROVIDER` 也切成 `openai-compatible` 測一次——如果支援，語音就完全不用另外在公司環境部署任何東西，直接跟文字/照片共用同一組雲端設定即可。

## 3. 語音辨識：目前這條路完全綁在這台開發機，不能直接搬過去

現在 `.env` 的 `AI_AUDIO_PROVIDER=whisper-cpp` 對應的是**手動編譯的 [whisper.cpp](https://github.com/ggml-org/whisper.cpp) `examples/server`**，原生跑在這台 Windows 機器上（不在 Docker 裡），細節：

- 執行檔：`C:\Users\otiyu\Downloads\ggml\whisper.cpp\build\bin\whisper-server.exe`（Windows 原生編譯，**Linux 機器沒辦法直接執行**）
- 模型檔：手動下載的 `ggml-medium.bin`（1.5GB），沒有進 git
- 監聽 port 9000（8080 被 Windows/Hyper-V 保留的 port range 卡住，改用 9000）
- `worker` 容器透過 `host.docker.internal:9000` 連過去，這個位址只在「Docker Desktop for Windows/Mac」的網路架構下有效，**Linux 上的 Docker 沒有 `host.docker.internal` 這個機制**（除非額外設定 `extra_hosts`），公司環境如果是純 Linux 主機，這個連法本身就不通
- `server/services/ai/whisper-cpp.ts` 這個 provider 裡還做了一件事：瀏覽器錄音是 WebM/Opus 格式，whisper.cpp 只認得原始 WAV，所以會先用 `ffmpeg`（已裝進 `worker-runtime` 這個 Docker stage）轉檔再送出——這部分程式碼是通用的，不受環境影響

**結論：這整套只是本機驗證「語音辨識真的準」用的個人測試環境，不要嘗試把這個原樣搬到公司環境。** 公司環境語音辨識的優先順序建議是：

1. **先確認雲端 API 支不支援音訊轉錄**（見第 2 節）——如果支援，直接用，不用管以下兩個選項
2. 如果雲端不支援，改用專案裡**已經 Docker 化好**的 [`whisper/`](whisper/)（faster-whisper，Python FastAPI），這個已經寫好 `Dockerfile`、接在 `compose.gpu.yml` 的 `local-audio` profile 裡，`docker compose --profile local-audio up` 就能起來，公司的 DGX 機器上直接可用，不需要額外工程
3. whisper.cpp（今天在測的這個）目前**沒有** Linux 版 Dockerfile，如果之後真的想在公司環境也用 whisper.cpp（例如覺得比 faster-whisper 省資源），需要另外寫一份 Linux 版建置方式——這件事還沒做，已記在 [TODO.md](TODO.md) 的待辦清單，不是這次交接範圍內完成的東西

## 4. 公司 DGX 資源使用注意事項

- `worker/index.ts` 已經**寫死限制**：`GPU_CONCURRENCY` 一定要是 1，同時間只會處理一個 AI 任務，不會有多個推論同時搶 GPU 資源的情況——這是既有設計，不用額外調整
- 但這代表多人同時使用時會排隊，已經在前端加了排隊提示（「前面還有 N 個任務在處理」），使用者不會誤以為系統壞掉，但實際等待時間會隨排隊人數疊加，正式上線前建議跟會用到這個系統的人抓一下預期同時使用人數，評估等待時間能不能接受
- DGX 是跟公司其他專案共用、額度會被限制——如果本機驗證用的 `qwen3.5:9b`／`qwen2.5:14b` 之類的模型在公司環境改用配額內的資源跑會太慢或跑不動，可能需要換更小的模型，或者這正是第 2 節「乾脆全部切雲端 API」比較有利的原因（運算完全發生在對方服務那邊，不佔用公司自己申請到的這份 GPU 額度）

## 5. 部署到正式環境前，這些一定要換掉（不是這次交接才提醒，AGENTS.md 也寫了，但容易漏掉）

- `SESSION_PASSWORD`、`IDENTITY_HMAC_SECRET`、`INTERNAL_WORKER_TOKEN`：現在 `.env` 裡都是這台開發機用的固定/簡單值，正式環境要換成各自獨立的隨機值，**不要照抄這份 `.env`**
- `ALLOW_DEV_AUTH` 必須是 `false`（現在開發環境是 `true`，方便不用真的 Google 帳號登入測試）
- `COOKIE_SECURE` 正式環境應該保持預設（`true`／不設定），現在開發環境因為本機用 plain HTTP 測試才特別設成 `false`
- `GOOGLE_REDIRECT_URI` 要指向正式環境的網域，不是 `localhost`
- API key（`OPENAI_COMPAT_API_KEY` 等）正式環境建議走 `secrets/*.txt`（Docker secrets 機制，`.gitignore` 已排除），不要直接寫在 `.env` 裡

## 6. 這次沒有跟著交接過去的東西（純本機測試用，不用管）

- ngrok 對外連結：純粹是這次開發過程中拿來讓手機能連進本機測試用的臨時通道，公司環境會有自己的網域/內部網路，跟這個完全無關，不用理解或延續這個設定
