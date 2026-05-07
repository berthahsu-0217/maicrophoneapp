# Implementation Plans

## Phase 1：登入與使用者系統

### 後端
- [ ] 在 Supabase 建立 `users` table（含 username、五項最高分、稱號欄位與索引）。
- [ ] 實作 `POST /api/login`：驗證 username 長度 2–20，upsert user，回傳 userId、username、title、scores。
- [ ] 實作 `GET /api/users/[userId]`：回傳使用者資訊與五項最高分。

### 前端
- [ ] 建立登入頁（歡迎頁）：Logo、標語、username 輸入框、「開始挑戰」按鈕。
- [ ] 實作 localStorage 登入狀態管理：登入成功存 `{ userId, username }`，頁面載入時檢查並導向。
- [ ] 實作登出功能：清除 localStorage 並導回登入頁。

---

## Phase 2：挑戰關卡首頁

### 後端
- [ ] 確認 `GET /api/users/[userId]` 回傳格式滿足首頁需求（稱號、五項分數、total）。

### 前端
- [ ] 建立挑戰關卡首頁：四張卡片（魔法少女Do Re Mi、一口氣到底、K哥之王、超級星光大道）。
- [ ] 右上角使用者資訊區：顯示 username、五項歷史最高分、稱號。
- [ ] 登出按鈕整合。

---

## Phase 3：錄音上傳

### 後端
- [ ] 擴充 `POST /api/upload-audio`：接收 `userId`、`durationSeconds`，上傳至 Supabase Storage，回傳 `url`、`storagePath`。

### 前端
- [ ] 錄音元件整合：請求麥克風權限、錄音、回放、取消、送出。
- [ ] 上傳時帶入 `userId`，接收並使用回傳的 `url`。

---

## Phase 4：AI 評分與分數更新

### 後端
- [ ] 在 `lib/tools.ts` 新增 `uploadScore` tool：接收 `scoreType`（rhythm / expression / technique 等）與 `score`，從 request context 取 `userId`，比較現有分數後更新 `users` 最高分與稱號。
- [ ] 確保 `/api/chat` route 從 request body 取出 `userId` 並注入 tool context。
- [ ] 更新 system prompt，指導 agent 分析音檔後呼叫 `uploadScore`（最多三次）。

### 前端
- [ ] `useChat` 設定 `body: { userId }`，確保每次請求帶入 userId。
- [ ] 第三關（K哥之王）頁面：聊天視窗 UI，顯示文字回覆與工具結果卡片（YouTube 影片卡片等）。

---

## Phase 5：排行榜

### 後端
- [ ] 實作 `GET /api/leaderboard?type={type}&limit={limit}`：從 `users` 讀取分數，API 端計算總分排序，回傳排名列表。

### 前端
- [ ] 建立排行榜頁面：切換總分 / 單項排行，顯示排名、username、稱號、各項分數。

---

## Phase 6：Placeholder 關卡

### 前端
- [ ] 第一關（魔法少女Do Re Mi）placeholder 頁面：顯示關卡標題、說明文字、「敬請期待」。
- [ ] 第二關（一口氣到底）placeholder 頁面：顯示關卡標題、說明文字、「敬請期待」。
