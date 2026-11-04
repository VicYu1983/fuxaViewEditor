# JSON 同步架構：以 `extra` 為唯一來源，SVG 每次重建

狀態：**Phase 0–4 已完成（2026-11-04）**。待決事項已於 2026-11-04 決議（見第 12 節）。未完成項目：D5（瀏覽器冒煙測試）與第 9.2 節的手動 FUXA 檢查。
撰寫日期：2026-11-04。適用範圍：View Editor 與 FUXA 之間的 JSON 匯入／匯出。

相關文件：[FLOOR_VIEW_FEATURE.md](./FLOOR_VIEW_FEATURE.md)（樓層與平面圖功能）、[REFACTOR_PLAN.md](./REFACTOR_PLAN.md)（App 拆分，與本文件獨立）。

## 1. 為什麼需要這份文件

View Editor 產生的 JSON 要交給 FUXA 載入，使用者也會在 FUXA 內再編輯、再匯出，然後再匯回 View Editor。
這條「往返」路徑一旦出錯，使用者拿到的是壞掉的專案，而且常常到現場才發現。

### 1.1 已發生的事件

| # | 現象 | 根因 | 處置 |
|---|---|---|---|
| 1 | FUXA 匯入 → View Editor → FUXA，樓層按鈕被破壞 | 按鈕的 `data-name` 與標記在 FUXA 往返後遺失，工具無法辨識自己產生的元件 | 在 `extra` 保存按鈕索引 `buildingFloorButtons` 作為補救 |
| 2 | 往返後樓層按鈕只剩文字（`測試樓層demo2.json`） | 工具以 XHTML namespace 建立 `<BUTTON>`，序列化後變成 `html:BUTTON`；同時同步判斷不檢查 `<BUTTON>` 是否存在，所以不會重建 | 改用 SVG namespace 建立；同步判斷加入 `<BUTTON>` 數量檢查（已 commit） |
| 3 | 平面圖 View 仍殘留群組標題「未設定樓層」 | 舊版輸出留在 SVG 裡，工具把 SVG 內容當成事實保留 | 平面圖分支不再建立群組標題，驗證同步調整 |
| 4 | 匯出 `demo2` 直接報錯（事件 3 的修正造成，Phase 0 發現） | 殘留標題的平面圖 View 未被重新套用，卻被驗證器檢查 | 殘留標題的平面圖 View 於匯出時重新套用（`findStaleFloorPlanViewIds`） |

三件事的共同點：**工具把 FUXA 回傳的 SVG 當成狀態來源，再去「猜」自己曾經做過什麼。**
FUXA 對 SVG 的改寫行為工具無法控制，也沒有契約保證，所以每次猜都可能猜錯。

### 1.2 本文件要解決的問題

1. 工具的設定與意圖只存放在一個我們完全控制的地方（`extra`）。
2. 所有由工具產生的 SVG 與 `items` 都可以由 `extra` 重新算出，FUXA 弄壞或弄丟都無所謂。
3. 把「FUXA 會怎麼改我們的資料」寫成文件與測試，而不是靠記憶。

## 2. 設計原則

| 編號 | 原則 | 說明 |
|---|---|---|
| P1 | **`extra` 是工具意圖的唯一來源** | 哪些 View 是平面圖、Tag 偏移多少、樓層按鈕 id、版面設定，一律從 `extra.fuxaSetting` 讀。 |
| P2 | **SVG 與 `items` 是輸出產物** | 受管元件每次匯出都由 `extra` 與 View 清單重新產生，不依賴上一次輸出的結果。 |
| P3 | **SVG 只能「量測」，不能「還原狀態」** | 可以讀 SVG 取得幾何資訊（例如標題文字底部 y、元件邊界）；不可以用 SVG 內的標記推斷工具狀態或元件身分。 |
| P4 | **只動受管元件，不動使用者內容** | 受管元件以明確的 id 集合識別（見 6.1）。其他節點與 `items` 原樣保留。 |
| P5 | **不認得的資料原樣保留** | `extra` 與 `extra.fuxaSetting` 內的未知鍵一律保留，避免新舊版工具互相覆蓋。 |
| P6 | **匯出必須可重複且可往返** | 同樣輸入得到同樣輸出；輸出經 FUXA 往返後再匯出，受管元件結果不變（見第 8 節 INV-2、INV-3）。 |
| P7 | **寧可擋下匯出，也不輸出壞檔** | 匯出前驗證失敗時，列出原因並中止，不寫出檔案。 |
| P8 | **不做匯入反推** | 已決議：一律從 View Editor 計算並匯出，不從 FUXA 的修改反推位置或設定。 |

## 3. 現況盤點

### 3.1 `extra.fuxaSetting` 內目前的資料

所有資料都位於 `config.extra.fuxaSetting`。各模組各自宣告 `TOOL_SETTINGS_KEY = 'fuxaSetting'`，各自實作讀寫與錯誤訊息（共 9 個模組）。

| 鍵 | 結構 | 讀寫位置 | 用途 |
|---|---|---|---|
| `version` | `2`（Phase 4 起） | `config/toolSettings.ts`、`layout/gridSettings.ts`（寫入時不降級較新版本） | 資料結構版本，見 5.2；版本 1 的舊檔不需遷移 |
| `viewGrids` | `{ [viewId]: GridSettings }` | `layout/gridSettings.ts` | 每個 View 的排列格線 |
| `floorGroupFrames` | `FloorGroupFrameSettings` | `layout/floorGroupFrame.ts` | 群組框樣式 |
| `floorFrameLayoutVersion` | `1` | `layout/floorGroupFrame.ts` | 群組框排版演算法版本（不是資料版本） |
| `floorGroupArtifacts` | `{ [viewId]: { [floorKey]: { titleId, frameId, frameShapeId } } }` | `layout/floorGroupArtifacts.ts` | 群組標題與底框的 SVG id 索引 |
| `viewComponents` | `{ [viewId]: StoredViewComponent[] }` | `views/viewComponents.ts` | 每個 View 的受管 Tag 元件定義（Phase 4；不含位置） |
| `buildingFloorButtons` | `{ [viewId]: { [targetViewId]: buttonItemId } }` | `buildingFloors/buildingFloorButtons.ts` | 樓層按鈕的 `items` id 索引 |
| `floorPlanViewIds` | `string[]` | `layout/floorPlanViews.ts` | 開啟「平面圖 View」的 View |
| `floorPlanTagOffsets` | `{ [viewId]: { [tagId]: { dx, dy } } }` | `layout/floorPlanViews.ts` | 平面圖 Tag 的手動偏移 |
| `viewTitleLabel` | `{ color, fontSize }` | `views/viewTitleLabel.ts` | View 名稱標籤樣式 |
| `siteNameLabel` | `{ name, color, fontSize, bold, italic, underline }` | `views/siteNameLabel.ts` | 專案名稱標籤 |
| `voiceRepeat` | `{ highhigh, high, low, info }` | `config/voiceRepeat.ts` | 語音播放次數 |
| `icons` | 圖示庫 | `icons/iconLibrary.ts` | 圖示庫 |

`demo2.json` 的 `extra.fuxaSetting`（約 L636–L710）可作為實例。注意其中 `floorGroupArtifacts` 對平面圖 View 為空物件 `{}`。

### 3.2 工具目前「從 SVG 反推狀態」的位置

這是本次重構要處理的核心清單。

| 位置 | 做法 | 風險 | 本文件處置 |
|---|---|---|---|
| `buildingFloorButtons.ts`：`containsManagedButtons`、`viewHasExpectedButtons` | 以 SVG 內 `data-name`、`data-building-floor-*` 字串與數量判斷是否已同步 | FUXA 往返後這些屬性會遺失，判斷結果不可靠 | **Phase 2 取代** |
| `buildingFloorButtons.ts`：`adoptExistingFloorButtons` | 比對 `items` 內文字與事件，把既有按鈕「認領」為受管按鈕 | 認領失敗就改走刪除重建並換新 id；認領成功但內部結構已壞（缺 `<BUTTON>`）也會誤判 | **已於 Phase 2 移除** |
| `buildingFloorButtons.ts`：`buttonPositionsMatch` | 讀 SVG 的 `x`、`y` 與期望值比對 | 同上，且浮點與序列化差異可能造成無限重建 | **Phase 2 取代** |
| `buildingFloorButtons.ts`：`buildingFloorButtonY` | 讀 `view_title` 文字的 `y` 與字級決定按鈕位置 | 屬於幾何量測，符合 P3；但結果必須是確定的，不能因 FUXA 微調而震盪 | 保留，補測試 |
| `svg/readFloorArtifacts.ts` | 先用 `extra.floorGroupArtifacts`，再用 `data-floor-group`、文字「未設定樓層」等推測 | 推測規則是為了修補先前的遺失而加，容易誤認 | Phase 3 縮小為「只做舊檔遷移」 |
| `views/viewTitleLabel.ts`、`views/siteNameLabel.ts` | `extra` 沒有設定時，從 SVG 讀取標題樣式當預設 | 屬於舊檔遷移，合理，但應明確標示且只在缺資料時發生 | Phase 3 標示為遷移路徑 |
| `svg/readManagedComponents.ts`、`svg/readMovableTags.ts`、`views/buildViewEditorModels.ts` | 從 `items`（`name` 為 `tc_<seq>`）、`property`、SVG 的 `data-fuxa-*` 還原 Tag 元件的樣板、圖示、多狀態 | 與本次問題同一類，但範圍大 | 已於 Phase 4 處理（定義保存於 `extra.fuxaSetting.viewComponents`，見第 7 節 Phase 4；D3） |

### 3.3 FUXA 對往返資料的行為（觀察）

以下為在 `測試樓層demo2.json`（FUXA 匯出的結果）中**實際看到**的現象。FUXA 內部的原因尚未驗證，請勿當成保證。

| 項目 | 觀察結果 | 可靠度 |
|---|---|---|
| `extra`（含 `fuxaSetting`） | 完整保留 | 已在 demo2 看到；FUXA 是否正式支援此欄位未驗證 |
| `items[id].name`、`type`、`property` | 保留（樓層按鈕的 `name` 皆為 `fuxa_building_floor_button`） | 已觀察 |
| 一般 `<text>` 的 `data-name`（`view_title`、`tc_1_label`） | 保留 | 已觀察 |
| Switch 元件群組 `<g data-name="tc_1">` | 保留 | 已觀察 |
| 樓層按鈕 `<g>` 的 `data-name`、`data-building-floor-*` | **遺失**（2F、3F 皆是） | 已觀察，原因未知 |
| 樓層按鈕內 `<BUTTON>` | 2F **遺失**，只剩文字 `2F`；3F **保留**且無前綴 | 已觀察，兩個 View 結果不同，原因未知 |
| 根 `<svg>` | 多出 `xmlns:svg`、`xmlns:html` 宣告 | 已觀察 |

結論：同一種元件在不同 View 的往返結果可能不同，所以**不能**依賴 SVG 內的標記判斷狀態。可以依賴的只有 `extra`，以及 `items` 的 `name`／`type`／`property`（仍視為「觀察到的行為」，見 INV-3 的測試）。

### 3.4 FUXA 執行階段對樓層按鈕的最低要求

來源：`FUXA/client/src/app/gauges/controls/html-button/html-button.component.ts` 與 `_helpers/utils.ts`。

- `items` 的 key 必須等於 SVG 內 `<g>` 的 `id`（FUXA 以 `document.getElementById(gab.id)` 取得元件）。
- `<g>` 的後代中，必須有一個 `id` 以 `B-HXB_` 開頭的元素（`Utils.searchTreeStartWith`，遞迴比對 `id` 前綴）。FUXA 在這個元素上設定文字與樣式。
- `items[id].type` 為 `svg-ext-html_button`；`property.events` 內 `action: "onpage"`、`actparam` 為目標 View id；`property.text` 為顯示文字。
- `<BUTTON>` 本身的標籤名稱並非 FUXA 執行階段的硬性條件（只比對 `id` 前綴），但**FUXA 編輯器匯出後的實際結果顯示它可能被丟掉**，所以工具必須用與 FUXA 原生相同、無前綴的形式輸出。

## 4. 目標架構

### 4.1 資料流

```
                  ┌───────────────────────────┐
  使用者操作 ───▶ │ View Editor 狀態           │
                  │  models（元件、群組、偏移） │
                  └────────────┬──────────────┘
                               │ 匯出
        ┌──────────────────────▼───────────────────────┐
        │ extra.fuxaSetting（唯一來源）                  │
        │  floorPlanViewIds / floorPlanTagOffsets        │
        │  viewGrids / floorGroupFrames / ...            │
        │  buildingFloorButtons（id 索引）               │
        └──────────────────────┬───────────────────────┘
                               │ 規格計算（純函式）
        ┌──────────────────────▼───────────────────────┐
        │ 受管元件規格：按鈕、群組標題與底框、Tag 位置   │
        └──────────────────────┬───────────────────────┘
                               │ 重建（先移除受管，再寫入）
        ┌──────────────────────▼───────────────────────┐
        │ view.svgcontent + view.items（輸出產物）       │
        └──────────────────────┬───────────────────────┘
                               │ 匯出前驗證 → 序列化
                               ▼
                         FUXA JSON 檔案
```

### 4.2 資料歸屬

| 資料 | 擁有者 | 匯出時的處理 |
|---|---|---|
| `extra.fuxaSetting.*` | 工具 | 正規化後寫回，未知鍵保留 |
| 樓層按鈕（SVG 節點與 `items` 項目） | 工具（產物） | 先移除再依規格重建，id 優先沿用索引 |
| 群組標題、群組底框 | 工具（產物） | 同上；平面圖 View 不產生 |
| Tag 元件位置（含平面圖偏移） | 工具（產物） | 由 `layoutFloorViewComponents` 計算並寫入 |
| Tag 元件（`tc_<seq>`）的樣板與屬性 | 工具（定義存於 `extra.fuxaSetting.viewComponents`，SVG 為產物） | 以 `extra` 的定義為主重建；舊檔沒有定義時由 SVG 還原（Phase 4） |
| 使用者自行加入的元件、底圖、`items` | 使用者／FUXA | 原樣保留，不碰 |
| `layout.navigation.items` 中使用者自訂項目 | 使用者 | 原樣保留，只管理工具建立的項目 |

## 5. `extra` 資料契約

### 5.1 存取層

現況：9 個模組各自讀寫，錯誤訊息與驗證分散。

規格（Phase 1 實作）：新增 `src/domain/config/toolSettings.ts`，提供唯一入口。

- `readToolSettings(config)`：回傳唯讀快照；`extra` 或 `fuxaSetting` 不是物件時拋出明確錯誤，不吞掉。
- `updateToolSettings(config, patch)`：只更新指定鍵，**保留所有其他鍵**；回傳新的設定物件，不就地修改傳入的設定（現況有些函式會就地改 `config.extra`，匯出流程的 `structuredClone` 才讓它安全）。
- 各領域模組（格線、群組框、平面圖、按鈕索引…）只負責「該鍵的正規化與驗證」，不再自己處理 `extra` 的外層結構。
- 對外維持原函式名稱與簽名，先不改呼叫端，降低風險。

### 5.2 版本

- 目前 `fuxaSetting.version` 已存在於既有檔案（值為 `1`），但語意不明。
- 規格：**把 `fuxaSetting.version` 定義為資料結構版本**。`1` 為 Phase 0–3 之前的結構；Phase 4 新增 `viewComponents`，升為 **`2`**（目前版本）。版本 1 的檔案不需遷移，缺少 `viewComponents` 時沿用 SVG 還原。
- 之後任何不相容的結構改動，必須：`version` +1、新增遷移函式、新增含舊版 fixture 的測試。
- `floorFrameLayoutVersion` 維持現狀，它是排版演算法版本，與資料版本無關。
- 缺少 `version` 的檔案視為版本 1（舊檔），匯出時補上。
- **前向相容（D4 決議：不阻擋，只提示）**：若讀到的 `version` 大於工具支援的版本：
  1. 載入配置時顯示提示：「此檔案由較新版本的工具產生，目前工具版本可能過舊，部分設定可能無法正確處理」。
  2. 仍允許編輯與匯出。
  3. 匯出時**保留較高的 `version` 值，不降級**，並保留所有未知鍵（P5）。
  4. 已知鍵照常正規化與寫回。若新版改變了已知鍵的結構，舊版工具可能誤讀或丟棄單筆資料，這是此決議接受的風險；因此提示文字必須明確，且丟棄單筆資料時要列入警告。

### 5.3 讀寫規則

1. 讀取一律經過正規化：缺欄位補預設值，型別錯誤的**單筆**資料可以丟棄並記錄警告，整體結構錯誤才拋錯。
2. 寫入一律只寫正規化後的值。
3. 已不存在的 View id 對應的資料，匯出時清除（平面圖 id、偏移、索引、群組索引都適用；現有程式已對部分鍵這樣做）。
4. 空資料不寫入空殼（例如 `floorPlanTagOffsets` 沒有任何偏移時整個鍵刪除，現況已如此）。

### 5.4 樓層按鈕索引

現況：`buildingFloorButtons[viewId][targetViewId] = buttonItemId`，只記錄最外層 `<g>` 與 `items` 的 id。
內部的 `rect`、`foreignObject`、`<BUTTON>` 的 id 每次重建都重新隨機產生。

規格：

- 索引結構維持不變，不需遷移。
- 內部 id 由外層 id 決定，**重建結果因此可重複**（決議 D2）：
  - 外層 `HXB_<s>`
  - `rect`：`svg_<s>`
  - `foreignObject`：`H-HXB_<s>`
  - `<BUTTON>`：`B-HXB_<s>`（符合 3.4 的前綴要求）
  其中 `<s>` 為外層 id 去掉 `HXB_` 前綴的部分。建立前用既有的 id 保留機制（`reserveExistingIds`）確認不衝突。
- 既有檔案中舊的隨機內部 id 在第一次重建時會被換掉，之後即穩定。

## 6. SVG 重建規範

### 6.1 受管元件的識別

受管元件**只**以下列 id 集合識別，不使用 `data-name` 或文字內容：

- 樓層按鈕：`extra.buildingFloorButtons[viewId]` 的值，加上 `items` 內 `name === 'fuxa_building_floor_button'` 的 key。
- 群組標題與底框：`extra.floorGroupArtifacts[viewId]` 與 `items` 內 `name` 為 `fuxa_floor_section_title`／`fuxa_floor_section_frame` 的 key。
- Tag 元件：以 `extra.fuxaSetting.viewComponents` 保存的 `shapeId`、`labelId`、`alarmShapeId`、多狀態圖示 id 與內部元素 id 識別（Phase 4）。

`data-name`、`data-building-floor-*`、`data-floor-group` 仍會**寫入**（方便人工閱讀與除錯），但**不得**作為判斷依據讀回（P3）。
唯一例外是舊檔遷移（見 10 節），且必須標註。

### 6.2 樓層按鈕

輸入：View 清單、`parseBuildingFloorName` 與 `groupBuildingFloors` 的結果、`extra.buildingFloorButtons`、View 標題的幾何量測。

規則：

1. 同系統只有一個樓層，或 View 不屬於任何樓層系統：不產生按鈕，並移除所有受管按鈕（現況行為不變）。
2. 同系統有多個樓層：每個樓層一個按鈕，順序依 `groupBuildingFloors`（地下樓層在前）。
3. 目前樓層的按鈕為藍底白字，其他為白底黑字（現況行為不變）。
4. 位置：`x = 42 + 序號 × (80 + 16)`；`y` 為標題文字底部下方（`buildingFloorButtonY`，量測 SVG）。尺寸 80×32。
5. 輸出格式與 FUXA 原生一致：

```xml
<g id="HXB_<s>" type="svg-ext-html_button" data-name="fuxa_building_floor_button" ...>
  <rect id="svg_<s>" x=".." y=".." width="80" height="32" stroke-width="0"/>
  <foreignObject id="H-HXB_<s>" x=".." y=".." width="80" height="32">
    <BUTTON id="B-HXB_<s>" class="md-btn  md-btn-raised" style="...">2F</BUTTON>
  </foreignObject>
</g>
```

   `g`、`rect`、`foreignObject`、`BUTTON` 都必須在 SVG namespace 內，序列化結果不得含 `html:` 前綴（INV-6）。
6. `items[HXB_<s>]`：`type: svg-ext-html_button`、`name: fuxa_building_floor_button`、`property.events = [{type:'click', action:'onpage', actparam:<目標 View id>, actoptions:{}}]`、`property.text`、`ranges`、`actions: []`（與現行 `buttonEntry` 相同）。

### 6.3 「是否需要同步」的判斷（取代現行啟發式）

現況：`buildingFloorButtonsNeedSync` 靠多個啟發式（計數、字串、位置）判斷，每次發現新的壞法就再加一條。

規格：改為**規格比對**。

1. 以 6.2 的規則計算每個 View 的「期望按鈕規格」（目標 View id、文字、是否為目前樓層、x、y、id）。
2. 從目前的 `svgcontent` 與 `items` 以 id 取出實際狀態（只用 id，不用 `data-*`）。
3. 逐項比對；任一項不符就需要同步。必須檢查的項目：
   - `items` 項目存在，`type`、`name`、`property.text`、`events` 正確。
   - `<g>` 存在且 `id` 相符。
   - `<g>` 後代存在 `id` 以 `B-HXB_` 開頭的 `BUTTON`（任何大小寫），且為無前綴、SVG namespace。
   - `rect`、`foreignObject` 的位置與尺寸相符。
   - 目前樓層樣式正確。
   - 沒有多餘的受管按鈕（不在期望集合內的 id）。
4. 比對時以數值容差處理浮點，避免序列化差異造成每次都要重建。

優點：新增任何必要條件，只需在規格與比對各加一處，且有一處測試可以涵蓋。

### 6.4 重建流程（取代 `adoptExistingFloorButtons`）

對每個需要同步的 View：

1. 蒐集該 View 所有受管按鈕的 id（6.1）。
2. 從 SVG 移除這些節點（整個 `<g>`），並從 `items` 移除。
3. 依規格產生新節點與 `items`；外層 id 優先沿用索引中的舊值（若該 id 不與其他元件衝突），否則重新配置。
4. 更新 `extra.buildingFloorButtons[viewId]`。
5. 不再嘗試「認領」既有節點。例外：在 FUXA 內手動建立、指向同系統樓層且文字相同的舊樣板按鈕，會在首次同步時被視為前身並取代（見 Phase 2 的遷移說明）。

這會移除 `adoptExistingFloorButtons` 約 90 行與相關分支。使用者在 FUXA 對按鈕所做的修改（例如改顏色）將被覆寫，這是 P1／P8 的直接結果，需在使用說明中註明。

### 6.5 群組標題與底框

- 一般 View：維持現行（`buildFloorArtifactNodes`）。
- 平面圖 View：不產生群組標題與底框（已實作）。驗證：`items` 與 SVG 都不得出現 `fuxa_floor_section_*`，`extra.floorGroupArtifacts[viewId]` 為空。
- 識別以 id 為準（6.1）。`readFloorArtifacts` 內以 `data-floor-group` 與文字「未設定樓層」推測的分支，縮小為舊檔遷移用途（Phase 3）。

### 6.6 平面圖 View

- 開關：`extra.floorPlanViewIds`。
- 偏移：`extra.floorPlanTagOffsets[viewId][tagId]`，以 `tagId` 為鍵。
- 位置計算：預覽與匯出共用 `layoutFloorViewComponents`（單一來源，已實作）。
- 匯出：每次由 View Editor 計算並寫入，不保留 FUXA 端的改動。

### 6.7 導覽項目

維持現行（`views/syncNavigation.ts`）：每個系統一筆、指向最低樓層、不處理使用者自訂項目。本次重構不改動。

## 7. 分階段實作計畫

每個 Phase 結束時都必須：`npx tsc -b --pretty false`、`npx vitest run`、`npx eslint .`、`npm run build` 全部通過，並可單獨 commit。**Phase 之間不合併，方便回退。**

### Phase 0：安全網（不改正式程式碼）

**狀態：已完成（2026-11-04）。** 過程中發現並修正一個既有缺陷，見下方「Phase 0 發現」。

- 將 `測試樓層demo.json`、`測試樓層demo2.json` 複製到 `tests/fixtures/`，改英文檔名（`floor-demo.json`、`floor-demo2.json`），並在 [tests/fixtures/README.md](../tests/fixtures/README.md) 說明來源與用途。
- 新增 [tests/helpers/fuxaRoundTrip.ts](../tests/helpers/fuxaRoundTrip.ts)：`exportText`（載入後不編輯直接匯出）、`simulateFuxaRoundTrip`（依 3.3 的觀察模擬 FUXA 往返）、`summarizeFloorButtons`（摘要按鈕狀態以便比對）。
- 新增特徵測試 [tests/domain/syncRoundTrip.test.ts](../tests/domain/syncRoundTrip.test.ts)，涵蓋 INV-2～INV-9、INV-12 在目前行為下的表現。
- 以 `it.fails` 標記尚未達成的不變量：**INV-3（`<BUTTON>` 遺失後重建的按鈕 id 與第一次匯出相同）**，Phase 2 完成後改為一般 `it`。
- 完成條件：新測試通過；既有測試不受影響。

**Phase 0 發現：** 匯出 `floor-demo2.json` 會直接丟出「平面圖 View 不應保留…群組標題」。原因是樓層按鈕同步把 2F 標為已修改，驗證器隨即檢查該 View，而 2F 殘留舊版輸出的群組標題；此 View 並未重新套用，所以標題沒被清除。已修正：
- 平面圖 View 若仍有群組標題或底框，匯出時視為「需重新套用」（`findStaleFloorPlanViewIds`），套用後清除（INV-8）。
- 對應的 App 匯出判斷（`exportDirty`）一併更新。
- 這個缺陷在 Phase 0 之前沒有被任何測試覆蓋，是先有 fixture 與端對端測試才發現的。

### Phase 1：集中 `extra` 存取（不改行為）

**狀態：已完成（2026-11-04）。**

- 新增 [toolSettings.ts](../src/domain/config/toolSettings.ts)：`getToolSettings`（寬鬆讀取）、`readToolSettingsForWrite`（嚴格讀取以便寫入，錯誤訊息與原本逐字相同）、版本函式（`getToolSettingsVersion`、`isToolSettingsOutdated`、`nextToolSettingsVersion`）。
- 9 個模組已改用它：格線、群組框、群組元件索引、平面圖、樓層按鈕索引、View 名稱標籤、案場名稱、語音重複、圖示庫。各模組仍負責自己那個鍵的正規化與驗證。
- 格線寫入的 `version` 不再固定為 `1`，改為不降級較新的版本（`nextToolSettingsVersion`）。
- App 載入配置後，若 `version` 高於工具支援版本，在工作區顯示「工具版本可能過舊」警告，不阻擋編輯與匯出（D4）。
- 測試：[toolSettings.test.ts](../tests/domain/toolSettings.test.ts)（寬鬆／嚴格讀取、版本缺少、INV-10 不降級且保留未知鍵）。
- 驗證：重構前後以固定亂數與固定時間匯出 4 份 fixture（含 `旭峰建設.json`），輸出**逐位元相同**。

原計畫（保留供對照）：

- 實作 `toolSettings.ts`（5.1）。
- 逐一改寫 9 個模組使用它，每改一個跑一次完整測試。
- 新增測試：未知鍵保留、`extra` 型別錯誤的錯誤訊息、`version` 缺少與高於支援版本的行為（提示、不阻擋、不降級）。
- 新增 `toolSettings.ts` 的版本檢查函式，供 UI 載入時顯示「版本可能過舊」提示（UI 接線在此 Phase 一併完成）。
- 風險：低。只搬移程式，不改輸出。
- 完成條件：輸出對所有現有 fixture 逐位元相同（可用匯出文字比對）。

### Phase 2：樓層按鈕改為規格比對與重建（本次重構的核心）

**狀態：已完成（2026-11-04）。**

實作內容（[buildingFloorButtons.ts](../src/domain/buildingFloors/buildingFloorButtons.ts)）：

- 規格比對（6.3）：`viewNeedsButtonSync` 只用 id 取得實際狀態，逐項比對 `items` 欄位、`<g>`、`rect`／`foreignObject` 的位置與尺寸（容差 0.01）、`BUTTON` 的存在、無命名空間前綴、文字與目前樓層樣式。不再讀取 `data-name`、`data-building-floor-*` 判斷狀態。
- 重建（6.4）：需要同步的 View 先移除所有受管按鈕再重建；外層 id 優先沿用索引，內部 `rect`、`foreignObject`、`BUTTON` 的 id 由外層 id 決定（`svg_<s>`、`H-HXB_<s>`、`B-HXB_<s>`）。衍生 id 與文件中其他 id 衝突時改用新的外層 id。
- 已移除：`adoptExistingFloorButtons`、`viewHasExpectedButtons`、`buttonPositionsMatch`。
- 內部 id 採**嚴格比對**：舊檔中已正常運作、但內部 id 是隨機值的按鈕，第一次匯出會被重建一次（結果只與內部 id 有關），之後穩定。這是為了讓輸出可重複（INV-2、INV-3）。

與原計畫的差異：

- `buildingFloorButtonsNeedSync(config, Parser)` 現在需要 `Parser`（規格比對要解析 SVG）。`prepareFuxaConfigExport` 改由依賴提供 `buildingFloorsNeedSync`，App 以 `DOMParser` 呼叫。
- **舊樣板按鈕的遷移**：在 FUXA 內手動建立、`property.text` 為樓層名稱且有 `onpage` 事件指向同系統樓層的按鈕（例如 `floor-demo.json`），視為受管按鈕的前身，在多樓層 View 首次同步時被取代，避免出現兩組按鈕。原本「認領並保留既有 id」的行為因此改變：既有按鈕的 id 不再保留。單一樓層或非樓層 View 中使用者自己的按鈕不受影響。

測試：

- [buildingFloorButtons.test.ts](../tests/domain/buildingFloorButtons.test.ts)：`<BUTTON>` 遺失後以相同 id 重建且輸出相同、`html:BUTTON` 前綴被重建、不依賴 `data-*`、座標偏移會重新定位、使用者自己的按鈕不受影響、衍生 id 衝突時改用新 id、舊樣板按鈕被取代。
- [syncRoundTrip.test.ts](../tests/domain/syncRoundTrip.test.ts)：INV-3 的「`<BUTTON>` 遺失後重建的按鈕 id 與第一次匯出相同」由 `it.fails` 改為一般測試；新增再次匯出 SVG 與 items 完全相同、內部 id 由外層 id 決定的測試。

驗證：完整測試 369 個全數通過，`tsc`、`eslint`、`build` 通過。尚未在真實 FUXA 中驗證（見 9.2）。

原計畫（保留供對照）：

- 實作 `buildFloorButtonSpecs`、規格比對（6.3）、重建（6.4）、內部 id 由外層 id 決定（5.4）。
- 移除 `adoptExistingFloorButtons`、`viewHasExpectedButtons`、`buttonPositionsMatch` 與相關的字串計數。
- 保留 `BUILDING_FLOOR_BUTTON_NAME` 與 `items` 的結構不變。
- 測試：
  - 兩份 fixture 的往返冪等（INV-2、INV-3）。
  - 以 `simulateFuxaRoundTrip` 破壞後能重建。
  - 輸出不含 `html:`、`svg:` 前綴。
  - 使用者自訂元件與底圖原樣保留（INV-4）。
  - 重建後 id 穩定（連續匯出兩次，受管元件 id 不變）。
- 風險：中。`items` 結構不變，但 SVG 內部 id 規則改變；舊檔第一次匯出會換掉內部 id。
- 完成條件：第 8 節所有不變量在兩份 fixture 上通過。

### Phase 3：群組標題與底框、標題樣式遷移路徑整理

**狀態：已完成（2026-11-04）。**

- [readFloorArtifacts.ts](../src/domain/svg/readFloorArtifacts.ts)：
  - 以 `extra.floorGroupArtifacts` 認定的標題與底框優先，且之後不再被 `data-floor-group` 或文字推測重複登記到其他群組。**修正一個實際缺陷**：原本即使索引已認定，只要標題文字與群組名稱不同，同一個標題還會被登記到第二個群組。
  - 以 `data-floor-group`、文字推測的分支加註「僅用於 extra 索引不存在的舊檔」。FUXA 往返後 `data-floor-group` 會遺失（demo2 可見），所以索引是主要來源。
  - 索引認定的標題也納入標題位置比對，供沒有 id 對應的底框使用。
- [viewTitleLabel.ts](../src/domain/views/viewTitleLabel.ts)：從 SVG 讀標題樣式的分支加註為舊檔遷移；`extra` 已有設定時一律以 `extra` 為準。
- INV-8：除了 Phase 0 的「匯出時重新套用」，另外補上驗證器與套用函式的單元測試：
  - 平面圖 View 保留群組標題或底框時，驗證器拒絕。
  - 套用平面圖 View 時清除殘留標題與底框，且不重新產生（有元件與沒有元件兩種情況）。
- 測試：[readFloorArtifacts.test.ts](../tests/domain/readFloorArtifacts.test.ts)（索引優先於衝突的 SVG 標記、FUXA 移除標記後仍可由索引解析）、[applyModelToView.test.ts](../tests/domain/applyModelToView.test.ts)、[validateGeneratedView.test.ts](../tests/domain/validateGeneratedView.test.ts)、[viewTitleLabel.test.ts](../tests/domain/viewTitleLabel.test.ts)。
- 驗證：完整測試 376 個全數通過，`tsc`、`eslint`、`build` 通過。

原計畫（保留供對照）：

- `readFloorArtifacts` 的推測分支加註「僅舊檔遷移」，並以 `extra.floorGroupArtifacts` 優先。
- 平面圖 View 的不變量（INV-8）已在 Phase 0 以「重新套用」修正；此處補上匯出前驗證與更完整的測試。
- `viewTitleLabel`、`siteNameLabel` 從 SVG 取預設值的分支明確標示為遷移。
- 風險：低到中。

### Phase 4：Tag 元件的資料來源

**狀態：已完成（2026-11-04）。** 範圍與行為於開發前經使用者確認（D3、D7）。

#### 設計

- **保存**：每次匯出時，把每個 View 的受管 Tag 元件定義存入 `extra.fuxaSetting.viewComponents[viewId]`（陣列，按顯示順序）。由 [viewComponents.ts](../src/domain/views/viewComponents.ts) 的 `saveViewComponents` 負責，格式為 `ManagedComponentRecord` 去掉 `key`、`managed`：`seq`、`tagId`、`label`、`template`、`palette`、`shapeId`、`labelId`、`shapeInnerIds`，以及依樣板而定的 `iconId`、`normalIconId`、`alarmIconId`、`alarmShapeId`、`invertIconState`、`multiIconSetId`、`multiStateBindings`。**位置不保存**，仍由格線與平面圖偏移每次計算。只保存受管元件；既有的 FUXA 原生 Tag 元件（只能移動）不屬於此範圍。沒有元件的 View 不寫入鍵。
- **載入**（`buildViewEditorModels` → `reconcileManagedComponents`）：
  1. 有保存的定義：以定義為主，與從 SVG 還原的結果合併。
  2. 定義在 SVG 找不到（例如在 FUXA 被刪除或弄丟）：**仍然保留**，匯出時重建（D7 決議：刪除要在工具內進行）。
  3. 對應的 Tag 已不存在：自動移除該元件並在畫面顯示警告；匯出時一併從 View 清除。多狀態元件任一綁定的 Tag 不存在即整個移除。
  4. SVG 還原到、但沒有定義的元件（舊檔或工具外新增）：照舊保留。
  5. 沒有保存的定義（舊檔）：完全沿用 SVG 還原結果，第一次匯出時寫入定義（遷移）。
- **重建條件**：SVG 與保存的定義不一致（缺少元件、樣板／圖示／綁定／標籤不同）時，`componentsNeedRebuild` 為 true，匯出時即使使用者沒有修改該 View 也會重新套用（`findViewIdsNeedingReapply`，與舊版 Switch、平面圖殘留標題併為同一判斷）。`undefined`、空字串與 `false` 視為相同，避免誤判。
- **受損元件不會變成「既有 Tag」**：已保存元件的 id（含 label、alarm、多狀態圖示、內部元素）會預先保留，`readMovableTags` 不會把 FUXA 弄壞的殘骸當成可移動的既有 Tag，否則重建後會重複。
- **版本**：`fuxaSetting.version` 由 1 升為 **2**。舊版工具開啟新檔時會顯示「版本可能過舊」（D4），避免舊版工具改了 SVG 卻沒更新 `viewComponents`，導致新版工具載入時以過期定義覆蓋。版本 1 的舊檔不需遷移。
- **附帶修正**：FUXA 空白 View 的 `svgcontent` 可以是空字串，原本會讓「檢查既有 SVG ID」拋出「無法解析」，使整個專案無法匯出任何修改；現在空字串視為沒有任何 SVG ID。

#### 與原計畫的差異

- 原計畫以 `tagId` 為鍵；實際以 View 為單位的陣列，因為同一個 Tag 可以在同一 View 出現多次，且元件以 `shapeId` 為唯一識別。
- 原計畫的「Tag 元件」不含樣板之外的使用者客製欄位；`applyModelToView` 本來就會保留原有 `items` 的未知欄位，行為不變。

#### 測試

- [viewComponents.test.ts](../tests/domain/viewComponents.test.ts)：保存與清除、多狀態與圖示配對往返、格式錯誤與重複項目、定義不完整時拒絕保存、`reconcileManagedComponents` 的各種情況（舊檔、一致、定義優先、SVG 缺少、SVG 獨有、Tag 不存在、多狀態任一 Tag 不存在）。
- [componentRoundTrip.test.ts](../tests/domain/componentRoundTrip.test.ts)：保存定義與版本、新匯出不需重建、重新套用所有 View 後不需重建、FUXA 弄丟元件後由 extra 重建且 id 相同（INV-1）、重建後再次匯出不再變動（INV-2）、受損元件不會變成既有 Tag、Tag 不存在時移除並警告、舊檔沿用 SVG、真實專案（34 個元件）遷移穩定。
- 一次性驗證（未納入測試套件，因為檔案過大）：5 個真實專案（66～158 個受管元件，含多狀態圖示與圖示配對，最大 30 MB）載入後重新套用所有含元件的 View，元件數量不變、沒有誤判重建、沒有警告；其中 3 個再模擬 FUXA 弄丟第一個元件，匯出後完整還原。

#### 已知限制

- 在 FUXA 內對受管元件的修改（例如改標籤文字、換圖示）在下次匯出時會被 `extra` 的定義覆蓋。這是 P1／P8 的直接結果，需在使用說明註明；FUXA 內為這些元件新增的自訂屬性（`items` 的未知欄位）會保留。
- 在工具外（FUXA 內）複製出來的受管元件不會被保存定義，需在下次匯出時才寫入。

原評估（保留供對照）：

目前 `readManagedComponents` 從 `items` 與 `data-fuxa-*` 還原樣板、圖示、多狀態。這與本文件的原則相反，但範圍大、牽涉編輯器所有功能。
建議在 Phase 0–3 完成並穩定後，再單獨立案評估：是否把元件定義也存到 `extra`（以 `tagId` 為鍵），讓 SVG 完全成為產物。

## 8. 不變量（Invariants）

以下每一條都要有自動化測試。編號會在測試名稱中引用。

| 編號 | 不變量 |
|---|---|
| INV-1 | 樓層、平面圖相關的工具決策只取決於 `extra`、View 清單與 View 名稱；改變 SVG 內的 `data-*` 標記不影響結果。 |
| INV-2 | **冪等**：`export(export(x))` 與 `export(x)` 在受管元件（節點與 `items`）上完全相同，包含 id。 |
| INV-3 | **往返穩定**：`export(simulateFuxaRoundTrip(export(x)))` 與 `export(x)` 在受管元件上相同。 |
| INV-4 | 非受管的節點與 `items`（使用者元件、底圖、`resources/*.svg` 路徑）在匯出前後內容不變。 |
| INV-5 | `extra` 與 `extra.fuxaSetting` 內未知的鍵原樣保留。 |
| INV-6 | 匯出文字中，受管元件不含任何 namespace 前綴（`html:`、`svg:`）。 |
| INV-7 | 同系統樓層數 > 1 的樓層 View：按鈕數等於樓層數，每個按鈕含 `id` 以 `B-HXB_` 開頭的 `<BUTTON>`，且 `items` 內有對應項目。樓層數 ≤ 1 的 View：沒有任何受管按鈕。 |
| INV-8 | 平面圖 View：沒有 `fuxa_floor_section_title`／`fuxa_floor_section_frame` 的節點、`items`，也沒有 `floorGroupArtifacts` 索引。 |
| INV-9 | `extra` 內所有 View id 與按鈕索引都指向存在的 View，沒有殘留。 |
| INV-10 | `fuxaSetting.version` 高於工具支援版本時：顯示「版本可能過舊」提示，仍可匯出；匯出後 `version` 不被降級，未知鍵保留。 |
| INV-11 | 匯出前驗證失敗時，不產生檔案，並回報具體 View 與原因。 |
| INV-12 | 平面圖 Tag 偏移以 `tagId` 為鍵；變更 Tag 類型後偏移保留（已有測試）。 |

## 9. 測試與驗證計畫

### 9.1 自動化

- **Fixtures**：`tests/fixtures/` 內的 `floor-demo.json`、`floor-demo2.json`，以及既有的 `旭峰建設.json`、`fuxa-empty-project.json`。
- **往返模擬**：`simulateFuxaRoundTrip`（Phase 0）。每當實際發現 FUXA 新的改寫行為，先把它加進這個函式，再寫測試，最後才修程式。這樣 3.3 的觀察表與測試保持同步。
- **Golden 比對**：對每份 fixture，匯出後的受管元件摘要（id、位置、文字）以快照保存；快照變動必須在 PR 說明中解釋。
- **屬性式檢查**：隨機組合樓層數、單／多樓層、平面圖開關，檢查 INV-7、INV-8。
- **已知限制**：測試在 jsdom 執行，其序列化行為可能與瀏覽器不同（先前診斷發現 jsdom 重新序列化會把根元素變成 `<svg:svg>`，**未在真實瀏覽器驗證**）。因此 INV-6 還需要 9.2 的人工檢查，並建議未來評估以真實瀏覽器（例如 Playwright）跑一組匯出與序列化的冒煙測試。

### 9.2 手動（每個 Phase 結束時執行）

**狀態：未完成。** 以下檢查尚未在真實 FUXA 中執行；完成後請逐項記錄結果與日期。

1. 用 View Editor 開啟 `floor-demo2.json`，不做任何修改直接匯出。
2. 檢查匯出檔文字：搜尋 `html:`、`svg:BUTTON`，不應出現在 `<BUTTON>` 與按鈕節點上。
3. 在 FUXA 載入匯出檔：每個多樓層 View 的按鈕可點擊並切換 View；目前樓層為藍底。
4. 在 FUXA 不修改內容直接匯出，再匯入 View Editor，再匯出，再載入 FUXA：按鈕仍正常（本次事件的重現路徑）。
5. 平面圖 View：確認沒有「未設定樓層」標題，Tag 位置與 View Editor 預覽一致。
6. 單一樓層系統：確認沒有按鈕。
7. 匯出前後以文字比對工具比較：除受管元件外沒有差異。

## 10. 相容與遷移

- **舊檔（沒有 `version`）**：視為版本 1。第一次匯出補上。
- **舊檔（SVG 內有舊版樓層按鈕、`html:BUTTON`、平面圖殘留群組標題）**：
  1. 第一次匯出時，依 6.1 以 id 集合移除，再依 6.2 重建。
  2. 平面圖 View 內的 `fuxa_floor_section_*` 一併移除。
  3. 這是**唯一**允許讀取舊標記的情境，且程式碼必須註明為遷移。
- **新檔交給舊版工具**：舊版工具不認得的 `extra` 鍵會保留（INV-5）；`version` 較高時只提示、不阻擋，且不降級（INV-10）。
- **回退**：每個 Phase 獨立 commit；匯出不改動原檔，使用者保有原始 JSON。

## 11. 風險登記

| 風險 | 影響 | 緩解 |
|---|---|---|
| FUXA 的改寫行為我們無法完全掌握 | 匯出的檔案在 FUXA 被破壞 | P1／P2 讓每次匯出都重建；INV-3 與往返模擬；9.2 手動檢查 |
| 重建會覆寫使用者在 FUXA 對按鈕的手動修改 | 使用者困惑 | 在使用說明註明「樓層按鈕由工具管理，修改請在 View Editor 進行」 |
| 內部 id 規則改變導致舊檔第一次匯出有大量差異 | 版本控制 diff 變大 | 只發生一次；文件與 PR 說明註明 |
| jsdom 與真實瀏覽器序列化不同 | 測試通過但實際輸出有前綴 | 9.1 已知限制；人工檢查；評估瀏覽器冒煙測試 |
| Phase 1 搬移 9 個模組時誤改行為 | 匯出內容改變 | Phase 1 要求輸出逐位元相同；逐模組提交 |
| Tag 元件在 FUXA 內被改動後，下次匯出會被 `extra` 的定義覆蓋 | 使用者困惑 | 已知限制（見 Phase 4）；在使用說明註明「Tag 元件請在 View Editor 內修改」 |
| 規格比對的容差設定錯誤 | 無限重建或漏重建 | 規格比對有獨立單元測試；連續匯出的冪等測試（INV-2） |

## 12. 決議事項（2026-11-04）

| 編號 | 問題 | 決議 |
|---|---|---|
| D1 | 資料版本欄位 | 沿用 `fuxaSetting.version`；Phase 4 起為 `2`，版本 1 的檔案不需遷移 |
| D2 | 按鈕內部 id 是否由外層 id 決定（5.4） | 是，以取得可重複的輸出 |
| D3 | Tag 元件是否也改為以 `extra` 為來源（Phase 4） | 是，Phase 0–3 完成後執行（2026-11-04） |
| D4 | `version` 高於工具支援版本時 | **不阻擋編輯與匯出，但提示「工具版本可能過舊」**；行為細節見 5.2 |
| D5 | 是否引入真實瀏覽器的冒煙測試 | **未決**：Phase 2 已完成，尚待評估成本 |
| D6 | 使用者在 FUXA 內修改樓層按鈕外觀是否保留 | 不保留（P1／P8），在使用說明註明 |
| D7 | `extra` 有、SVG 沒有的 Tag 元件（Phase 4） | **以 `extra` 為主**：元件仍存在，匯出時重建；刪除要在工具內進行；對應 Tag 已不存在的元件自動移除並提示 |

## 13. 之後修改同步邏輯時的檢查清單

任何會影響匯出 JSON 的修改（新增 `extra` 鍵、新增受管元件、改變 SVG 輸出）都必須：

1. 先在本文件第 3 節或第 6 節記錄資料位置與規格。
2. 新增的 `extra` 鍵：寫明結構、預設值、清除規則；並確認不破壞 INV-5。
3. 新增的受管元件：定義 id 如何決定與如何識別（6.1），不得使用 `data-*` 讀回狀態。
4. 同步更新 `simulateFuxaRoundTrip` 與測試，確認 INV-2、INV-3。
5. 若是不相容的結構改動：`version` +1，並寫遷移與舊版 fixture 測試。
6. 在 FUXA 實際載入執行 9.2 的手動檢查。
