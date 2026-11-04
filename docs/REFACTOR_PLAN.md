# fuxaViewEditor 重構分析與計畫

> 分析基準：commit `b25675f`（工作樹乾淨）。基準驗證：`tsc -b` 通過、`vitest run` 50 檔／232 測試通過、`eslint` 通過。
> 本文件只做分析與規劃，尚未修改任何程式碼。行號為基準 commit 的近似值，動工前請重新確認。

## 1. 結論

- **需要重構，範圍集中在 `src/App.tsx`**，其餘 63 個檔案不需要動結構。
- `src/domain/`、`src/features/` 已是 React-free 的純函式，且有 50 個測試檔覆蓋，是這個專案目前最健康的部分。重構的方向是**把 `App.tsx` 內仍混在 UI 裡的邏輯搬回這兩層**，不是重寫這兩層。
- 重構是為了降低後續加功能的成本與風險（最近三次功能都是直接堆進 `App.tsx`），不是為了改變行為。**全程不得改變使用者可見行為。**

## 2. 現況量測

| 項目 | 數據 |
|---|---|
| `src/` 檔案數 | 64 個（`.tsx` 只有 `App.tsx`、`main.tsx`） |
| `App.tsx` | **4848 行**；`function App()` 佔 L296–L4846，約 4550 行 |
| 次大檔案 | `prepareFuxaConfigExport.ts` 531、`validateGeneratedView.ts` 479 行（合理） |
| `useState` | 約 61 個（L303–L377 全部宣告在同一元件） |
| `useMemo` | 約 30 個 |
| `useEffect` | 2 個（宿主訊息、預覽 debounce） |
| `dispatchEditor(` | 34 處 |
| `parseUpdatedConfig(` | 25 處 |
| `error instanceof Error ? error.message : String(error)` | 32 處 |
| `Parser: DOMParser` / `XMLSerializer` / `window.crypto` 組裝 | 24 處 |
| `Modal.confirm` | 3 處 |
| `App.css` | 885 行，單一檔案 |
| UI 自動化測試 | **0**（vitest 為 node 環境，無 jsdom／testing-library） |

### `App.tsx` 區塊地圖

| 行號（約） | 內容 | 規模 |
|---|---|---|
| L1–L295 | import、型別、常數、`isRecord`、`parseUpdatedConfig`、`createPreviewState`、`measureSvgBounds` | ~295 |
| L296–L400 | 5 個 `Form.useForm`、約 61 個 state、`useReducer`、`replaceWorkspace` | ~105 |
| L401–L456 | FUXA 宿主 `postMessage` 協定 effect | ~55 |
| L457–L800 | 衍生資料 `useMemo`（重名 Tag、Tag 所屬 View、告警設定、設備與 Tag、批次／建立 Tag 預覽、樓層分組…） | ~340 |
| L803–L875 | 預覽 debounce、`prepareCurrentExport`、`handleSyncToFuxa` | ~75 |
| L877–L1030 | View 新增／改名／刪除 | ~155 |
| L1033–L1315 | 元件移除／排序／跨 View 移動／批次移動／圖形／多狀態綁定／Grid | ~280 |
| L1315–L1475 | 分頁開啟、告警 handler | ~160 |
| L1477–L1700 | `renderTagAlarmSettings()`（JSX） | ~225 |
| L1703–L2005 | `renderTagCreateForm()`（JSX）＋ `handleCreateTags` | ~300 |
| L1949–L2117 | 批次加入 Tag handler ＋ `renderBatchAddForm()` | ~170 |
| L2118–L2535 | 設備管理：設備 CRUD、Tag 編輯／批次移動／刪除、位址 ±step／補位 | ~420 |
| L2535–L2680 | 樓層管理、View 設定（樓層框／View 屬性） | ~145 |
| L2683–L2940 | 圖示庫（新增／匯入匯出／刪除／多狀態狀態增刪移） | ~260 |
| L2950–L3042 | `tagLabel`、`tagOptions`、`previewPanel`（JSX） | ~95 |
| L3043–L4237 | 9 個 `<Modal>` JSX（元件移動、批次移動、View 名稱、View 設定、圖示庫、多狀態圖示、專案管理、批次移動 Tag、修改 Tag） | ~1195 |
| L4238–L4846 | Header／Sider／Workspace（Grid 設定、元件清單、預覽） | ~610 |

> 注意：L3744–L4130（專案管理的「設備與 Tag」分頁）與 L4420–L4846（工作區卡片）本次只以抽樣方式閱讀，拆分前需逐段細讀。

## 3. 問題診斷

### 3.1 單一元件承擔所有責任（主要問題）
61 個 state 與 100+ 個函式共用同一個閉包。任何 handler 都能讀寫任何 state，導致：
- 新增功能時只能繼續往 `App()` 內追加（最近的「批次移動 Tag」「位址步進」都是如此）。
- 無法單獨測試任何 UI 流程；改一處需要通讀整份 4800 行才能確認沒有 state 互相干擾。
- Modal 的開關、表單草稿、選取集合、搜尋字串都是頂層 state，關閉後是否重置全靠 `open*()` 函式手動歸零（例如 `openDeviceManager` 手動重置 8 個 state，L2118）。

### 3.2 業務邏輯混在 UI 裡（可無風險搬出，且可補測試）
這些是純資料運算，卻寫在元件內，因此**目前沒有測試**：
- `tagViewOptions`（L480）、`duplicateTagGroups`（L466）、`alarmSettingsByTag`（L523）、`alarmInversionByTag`（L562）、`modbusDevices`／`managedDeviceTags`（L623–L652）。
- View 新增／改名（`handleViewNameSubmit`，L888）：內嵌組裝 `ExportViewModel` 初始值（11 個欄位），改名時直接改 SVG 標題。
- 跨 View 移動元件（`moveComponentsToView`，L1086）：key 重新產生、seq 重排、modifiedViewIds 合併，約 60 行純邏輯。
- 刪除 Tag 前的引用掃描（`handleDeleteDeviceTag`，L2273）。
- 設備表單初值轉換在 `openDeviceManager`（L2118）與 `selectManagedDevice`（L2165）**逐字重複**。
- `prepareCurrentExport`（L832）：判斷是否需要匯出、組依賴，是純流程。

### 3.3 重複樣板
- 「`try { 產生 nextConfig → dispatchEditor({type:'document-edit', document: parseUpdatedConfig(next, config), models}) → messageApi.success } catch { messageApi.error(前綴 + 錯誤訊息) }`」出現 30 次以上，每次手寫。
- 瀏覽器相依（`DOMParser`、`XMLSerializer`、`window.crypto`）組裝 24 處。
- `isRecord` 在 `App.tsx`、`fuxaConfigExportDependencies.ts`、`validateFuxaConfig.ts` 各定義一份。
- 「找第一個可移動的目標 View」在 `openComponentMoveDialog`／`openBatchMoveDialog` 重複。

### 3.4 JSX 規模
`renderTagAlarmSettings`／`renderTagCreateForm`／`renderBatchAddForm` 是「元件寫成函式」，共約 630 行，共用外層 state 所以無法被 React 獨立最佳化或測試。9 個 Modal 約 1200 行全部內嵌在 `return` 中。

### 3.5 其他
- `App.css` 885 行單檔，與元件沒有對應關係，拆元件時容易漏搬或誤刪樣式。
- `README.md` 的功能描述仍有「開啟 JSON／清空專案／匯出下載」流程，與 `App.tsx` 目前以 FUXA 宿主同步為主的流程不完全一致（待確認，屬文件漂移，非本次重構範圍）。

## 4. 必須遵守的約束（踩雷清單）

1. **React Compiler 已啟用**（`vite.config.ts` 的 `reactCompilerPreset`）＋ `eslint-plugin-react-hooks`。新 hooks 必須符合 Rules of Hooks，禁止在 render 中 mutate 物件；不要為了「優化」手動加 `useMemo`／`useCallback`，保持與現有風格一致即可。
2. **`Form.useForm` 實例目前在 `App` 層，且在 Modal 掛載前就呼叫 `setFieldsValue`**（`openDeviceManager`、`openDeviceTagEditor`、`openViewDialog` 等）。把 Form 搬進子元件後，若子元件在 Modal 關閉時被卸載（`destroyOnHidden`），開啟前呼叫 `setFieldsValue` 會**無效或警告**。解法：改用 `initialValues` ＋ `key`，或在子元件掛載後的 effect 設值。這是本次重構**最容易靜默壞掉**的地方。
3. **`README.md` 把 `domain/`、`features/` 與 `App.tsx` 操作流程定位為日後 FUXA 原生實作的參考**。因此：
   - `domain/`、`features/` 必須維持 **React-free**（不得 import react／antd）。
   - 元件與 hooks 放新目錄（建議 `src/ui/`、`src/app/hooks/`），不要混進 `features/`。
   - 流程不再只在 `App.tsx` 一個檔，需在 README 補一段「流程在哪個檔案」的索引。
4. **`yarn build`（`vite.config.ts`）的 `outDir` 是 `../FUXA/server/view-editor` 且 `emptyOutDir: true`**。重構驗證時**不要直接跑 `yarn build`**，改用 `npx vite build --outDir <暫存目錄> --emptyOutDir`，避免覆蓋 FUXA 內已部署的檔案。
5. **沒有 UI 測試**：`App.tsx` 目前是「零自動化覆蓋」。必須採「先抽純邏輯補測試，再搬 UI」的順序，並搭配手動煙霧測試清單（第 7 節）。
6. **`document-edit` 的語意**：`dispatchEditor` 的 `document-edit` 會把 `configurationDirty` 設為 true 並寫入 history（上限 50）。抽 helper 時必須保持「一次操作一筆 history」，不可把一個操作拆成多次 dispatch。`moveComponentsToView` 傳入的是原 `config`（不重新 parse），抽出時要保留這個差異。
7. 部分 `src/` 檔含中文字串；編輯時避免用會改編碼的工具。

## 5. 目標結構

```
src/
  App.tsx                      # 目標 < 250 行：Provider + 版面 + 掛載各區塊
  main.tsx
  app/
    store/editorHistory.ts     # 既有，不動
    EditorProvider.tsx         # context：config, models, modifiedViewIds, dispatch, messageApi
    hooks/
      useFuxaHost.ts           # postMessage 協定、同步狀態、handleSyncToFuxa
      useConfigEdit.ts         # 統一「try → parse → dispatch → 訊息」樣板
      usePreview.ts            # 預覽 debounce、snapshot、stale 判斷
      useWorkspaceSelectors.ts # 呼叫 domain 的衍生資料（tags、devices…）
    lib/
      browserSvgDeps.ts        # 一處組裝 { Parser, serialize, crypto }
      errorMessage.ts          # getErrorMessage(error)
      measureSvgBounds.ts      # 目前在 App.tsx 的 DOM 量測
  ui/                          # 只放 React 元件（含各自的 state 與表單）
    layout/        AppHeader.tsx, ViewSidebar.tsx
    views/         ViewNameDialog.tsx, ViewSettingsModal.tsx
    workspace/     GridSettingsCard.tsx, ManagedComponentList.tsx,
                   ComponentMoveDialog.tsx, BatchMoveDialog.tsx, PreviewPanel.tsx
    project/       ProjectManagerModal.tsx
                   DevicesTab.tsx, DeviceForm.tsx, DeviceTagList.tsx,
                   DeviceTagMoveDialog.tsx, DeviceTagEditDialog.tsx,
                   TagAlarmsTab.tsx, TagCreateTab.tsx, TagAddTab.tsx, FloorsTab.tsx
    icons/         IconLibraryModal.tsx, MultiStateIconModal.tsx
  domain/                      # 維持 React-free
    shared/isRecord.ts         # 合併 3 份重複
    tags/tagViews.ts           # tagViewOptions、duplicateTagGroups
    alarms/readTagAlarms.ts    # alarmSettingsByTag、alarmInversionByTag
    devices/readModbusDevices.ts   # modbusDevices、managedDeviceTags、設備表單初值
  features/                    # 維持 React-free
    views/createViewModel.ts   # 新增空白 View 的 model 初值、改名同步標題
    views/moveComponentsBetweenViews.ts
    devices/findTagReferences.ts   # 刪除 Tag 前的引用掃描
  styles/                      # 依主題拆分（index.css 匯入順序即層疊順序）
```

預期結果：`App.tsx` 由 4848 → 約 200 行；最大的新元件（`DevicesTab`）預估 400–500 行，仍需視情況再拆。

### 關鍵抽象：`useConfigEdit`
取代 30+ 處重複樣板。草案（僅示意，實作時依現有 handler 逐一確認是否適用）：

```ts
const { commit } = useConfigEdit()
// 使用端
commit({
  failurePrefix: 'Tag 更新失敗',
  run: (raw) => {
    const next = updateModbusDeviceTag(raw, deviceId, tagId, values)
    return { config: next, success: `已更新 Tag「${values.name.trim()}」。` }
  },
  onSuccess: () => setDeviceTagDialogOpen(false),
})
```
- 內部負責：`try/catch`、`parseUpdatedConfig`、`dispatchEditor({type:'document-edit'…})`、`messageApi.success/error`。
- 不適用的情況（保留手寫）：`type:'edit'`（只改 model）、`moveComponentsToView`（傳原 config 與 `modifiedViewIds`）、需要 `Modal.confirm` 的刪除流程。

## 6. 執行階段

每階段獨立 commit，結束時必須通過 `npx tsc -b --pretty false`、`npx vitest run`、`npx eslint .`；階段 2 起加上第 7 節手動煙霧測試。任一階段出現行為差異就回退該 commit，不往下做。

### 階段 0：安全網（半天）
- 確認 commit 基準與驗證數字（已完成：232 測試）。
- 決策點：是否新增 `jsdom` ＋ `@testing-library/react` 做 3–5 個 UI 煙霧測試（開啟專案管理、批次移動 Tag、位址 ±step、存檔驗證）。這會改 `package.json`，**需使用者同意**；不新增則完全依賴手動煙霧測試。
- 驗收：基準數字記錄於 PR／commit 說明。

### 階段 1：抽純邏輯＋補測試（風險低，收益最高）
1. `isRecord` 合併到 `domain/shared/isRecord.ts`，三處改為 import。
2. `parseUpdatedConfig`、`getErrorMessage`、`createBrowserSvgDeps()`、`measureSvgBounds` 搬到 `app/lib/`，取代 24＋32 處重複。
3. 衍生資料搬到 `domain/`：`tagViewOptions`／`duplicateTagGroups`、`alarmSettingsByTag`／`alarmInversionByTag`、`modbusDevices`／`managedDeviceTags`／設備表單初值（同時消除 L2118／L2165 的逐字重複）。**每個都補 node 單元測試**。
4. `features/views/`：`moveComponentsBetweenViews`（輸入 models／keys／目標，回傳 `{ models, modifiedViewIds }`）、`createViewModel`／改名同步標題。
5. `features/devices/findTagReferences`：刪除 Tag 前的引用掃描。
- 驗收：`App.tsx` 減少約 600–800 行；新增測試 ≥ 15 個；既有 232 個不變且通過。
- 風險：低（純函式，輸入輸出可逐一對照）。

### 階段 2：靜態 UI 拆分（行為不變，仍用 props 傳遞）
由耦合度低到高：`PreviewPanel` → `ViewSidebar`／`AppHeader` → `ViewNameDialog` → `ComponentMoveDialog`／`BatchMoveDialog` → `ViewSettingsModal` → `IconLibraryModal`／`MultiStateIconModal` → `ProjectManagerModal`（先只拆外殼與 Tabs）。
- 三個 `render*Form()` 改為真正的元件（`TagAlarmsTab`、`TagCreateTab`、`TagAddTab`）。
- 此階段**先不搬 state**，只搬 JSX，props 會很多，屬暫時狀態。
- 驗收：`App.tsx` 降到約 2000 行；煙霧測試全數通過。
- 風險：中。留意第 4 節第 2 點（Form 與 `destroyOnHidden`）。

### 階段 3：state 歸屬下放
- 各區塊專屬 state 移入各自元件：`tagCreate*`（9 個）→ `TagCreateTab`、`tagAlarm*`（8 個）→ `TagAlarmsTab`、圖示表單（8 個）→ `IconLibraryModal`、`batch*`（6 個）→ `TagAddTab`／`BatchMoveDialog`、樓層（4 個）→ `FloorsTab`、設備管理與 Tag 選取（約 10 個）→ `DevicesTab`。
- 頂層只保留跨區塊共享的：`selectedViewId`、`projectName`、`projectManagerTab`、各 Modal 開關。
- `openDeviceManager` 的手動重置改由元件掛載／卸載承擔。**需逐項確認**：目前「重開專案管理會重置搜尋與選取」的行為，在元件被卸載後是否仍等價（Tabs 內容預設是否保留，要實測）。
- 驗收：`App.tsx` 約 800–1200 行；`useState` 數量 < 20。
- 風險：**高**（行為最容易偏移），建議每搬一個區塊就 commit 一次。

### 階段 4：hooks 與 context
- `useFuxaHost`（宿主協定＋同步）、`usePreview`、`useConfigEdit`、`EditorProvider`。
- 以 `useConfigEdit` 逐步取代 30+ 處樣板，**一次改一個檔案／一個區塊**，不一次全改。
- 驗收：`App.tsx` < 250 行；`dispatchEditor(` 只出現在 hooks／provider 內。
- 風險：中。留意 `handleFuxaMessage` 的 effect 依賴 `[messageApi]`，抽出後需維持相同依賴語意（目前內部只呼叫穩定的 setter 與 `replaceWorkspace`）。

### 階段 5：收尾
- `App.css` 依主題拆分到 `src/styles/`（已完成；採純 CSS 拆分，未改 CSS Module，類別名稱不變；建置 CSS 與拆分前逐位元組相同）。
- README 補「流程索引」（功能 → 檔案），並確認／修正與現況不符的段落。
- 驗收：全部驗證通過；`npx vite build --outDir <暫存目錄>` 成功；README 索引可用。

## 7. 手動煙霧測試清單（階段 2 起每個 commit 執行）

1. 從 FUXA 開啟（或以測試 fixture）載入專案，View 清單與預覽正常顯示。
2. 新增空白 View、改名、刪除；起始頁與導覽引用處理正確。
3. 批次加入 Tag（含 Coil Switch）；縮放比改為 150% 後可同步（回歸 `b25675f`）。
4. 元件上移／下移、移除、移動至其他 View、批次移動元件。
5. 專案管理 → 設備：新增／修改／刪除設備；Tag 編輯；**批次移動 Tag**；位址「全部 +N／-N」與步進輸入；補位；刪除自動補位 Tag。
6. 專案管理 → 告警／批次建立 Tag／批次加入 Tag／樓層：各走一次主要流程。
7. 圖示庫：新增、匯入、匯出、刪除；多狀態圖示的新增／排序／刪除狀態。
8. View 設定：樓層框與 View 屬性。
9. 復原／重做在以上各操作後行為正確；「同步至 FUXA」可送出。
10. 重新開啟專案管理時，搜尋與選取狀態重置（階段 3 重點）。

## 8. 不做的事（避免範圍蔓延）

- 不改 `domain/`、`features/` 既有函式的行為與簽章（階段 1 只新增與搬移）。
- 不引入狀態管理套件（Redux、Zustand 等）；`useReducer` 加 context 已足夠。
- 不升級依賴、不調整 `vite.config.ts` 的 `outDir`。
- 不順手改 UI 文案、樣式或功能。
- 不處理 README 與現況不符之外的文件。

## 9. 預估與順序建議

| 階段 | 預估工作量 | 風險 | 可獨立交付 |
|---|---|---|---|
| 0 安全網 | 0.5 天 | 低 | 是 |
| 1 抽純邏輯＋測試 | 1–1.5 天 | 低 | 是（收益最高，建議先做） |
| 2 靜態 UI 拆分 | 1.5–2 天 | 中 | 是 |
| 3 state 下放 | 2–3 天 | 高 | 否，需接在 2 之後 |
| 4 hooks 與 context | 1–1.5 天 | 中 | 是 |
| 5 收尾 | 0.5–1 天 | 低 | 是 |

若時間有限，**只做階段 0＋1 就能拿到大部分收益**：邏輯可測、重複樣板消除、`App.tsx` 縮小約 15%，且風險最低。

## 10. 需要使用者決定的事項

1. 是否同意新增 `jsdom` ＋ `@testing-library/react` 作為 UI 煙霧測試（階段 0）？
2. 新目錄命名：元件放 `src/ui/`，hooks 放 `src/app/hooks/`，是否接受？
3. CSS：單純依元件拆檔，還是改用 CSS Module？
4. 做到哪個階段為止（建議先 0＋1，再評估是否繼續）？
5. 「批次移動 Tag」目標設備已有相同位址時是否阻擋（先前未確認；與重構無關，但會影響 `moveDeviceTags.ts` 的測試）。
