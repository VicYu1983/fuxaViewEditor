# 樓層 View 功能開發文件

狀態：規劃中（尚未開發）。範例資料：`testjson/測試樓層demo.json`。

## 1. 名詞定義（重要，避免 AI 與開發者混淆）

| 名詞 | 意義 | 程式中的識別字 |
|---|---|---|
| **群組**（舊稱「樓層」） | 同一個 view 內，Tag 元件的分區（群組框、群組標題） | `floorGroupFrame`、`FloorsTab`、`applyTagFloors`、`floorLayout`、`fuxa_floor_section_*` |
| **樓層**（新功能） | 跨 view 的樓層，例如 `排風系統/2F`、`排風系統/3F` 各是一個 view | 新程式一律用 `buildingFloor` 前綴 |

- 第一階段只把畫面文字的「樓層」改為「群組」，程式識別字**不改名**。
- 舊樓層相關檔案頂端需加注解：此處 floor 指同一 view 內的 Tag「群組」，不是跨 view 的樓層。

## 2. 需求

1. view 名稱符合樓層規則時，開啟「樓層功能」。
2. 同系統的每個樓層 view，畫面上方都有各樓層按鈕，點擊後切換到對應 view。
3. `layout.navigation.items` 每個系統只建一筆，指向該系統最低樓層。
4. 每個系統的每個樓層都是獨立 view，可個別編輯，不混在一起。
5. 平面圖底圖由使用者在 FUXA 中上傳與擺放，編輯器第一階段不提供上傳；平面圖路徑不可在匯入與匯出後被清除。

## 3. 樓層判斷規則

- view 名稱格式：`<系統>/<樓層>`，以第一個 `/` 切分。
- 樓層部分須符合：`^\d+F$`（不分大小寫）或 `^\d+樓$`。
- 例：`排風系統/2F`、`排風系統/3樓` 符合；`排風系統/FAN`、`MainView` 不符合。
- 系統名稱為 `/` 之前的字串，同系統名稱的樓層 view 屬於同一組。
- 同系統只有一個樓層時，不產生樓層按鈕（待確認，見 §9）。
- 排序：依樓層數字由小到大（`1F`、`2F`、`3F`）。`B1` 之類的地下樓層不在第一階段範圍。

## 4. FUXA 資料格式（依範例 JSON）

樓層按鈕是一般的 `svg-ext-html_button`，不需修改 FUXA 本體：

```json
{
  "type": "svg-ext-html_button",
  "property": {
    "events": [
      { "type": "click", "action": "onpage", "actparam": "<目標 view id>", "actoptions": {} }
    ],
    "text": "2F"
  }
}
```

- 對應的 SVG 為 `<g type="svg-ext-html_button" id="HXB_...">`，內含 `rect` 與 `foreignObject > BUTTON`。
- 導覽項目位於 `hmi.layout.navigation.items`：`{ text: "<系統>", view: "<最低樓層 view id>", icon, image, permission, children }`。
- 平面圖為 `svg-ext-own_ctrl-image`，`property.address` 為 `resources/xxx.svg` 路徑。

## 5. 設計

### 5.1 純函式（`src/domain/buildingFloors/`）

- `parseBuildingFloorName(viewName)`：回傳 `{ system, floorLabel, floorNumber }` 或 `null`。
- `groupBuildingFloors(views)`：回傳 `Map<system, 樓層清單（已排序，含 viewId）>`。
- `buildFloorButtonNodes(...)`：依樓層清單產生按鈕的 `items` 項目與 SVG 節點。位置固定在畫面上方，按鈕間距一致，目前樓層標示為選取狀態（待確認）。
- `syncNavigationItems(layout, groups)`：每個系統一筆，更新或新增，不動使用者自訂的其他項目。

### 5.2 重建策略

- 樓層按鈕以專用 `data-name`（例如 `fuxa_building_floor_button`）標記，仿照現有 `FLOOR_ARTIFACT_NAMES` 的做法。
- 每次樓層增減、改名或匯出時，先移除舊的樓層按鈕再整批重建，避免殘留與重複。
- 不可使用 `shape_1` 之類通用名稱，避免誤刪使用者自己的元件。

### 5.3 導覽項目歸屬

- 以 `text` 與系統名稱相同，且 `view` 指向該系統任一樓層 view，視為編輯器管理的項目。
- 系統已不存在樓層時，才移除對應項目；非編輯器建立的項目不處理。

## 6. 匯入與匯出的保護

已讀過程式碼，尚未實測：

- [serialization.ts](../src/domain/config/serialization.ts) 以 `JSON.stringify` 輸出整份設定，不過濾欄位。
- [removeManagedFromView.ts](../src/domain/svg/removeManagedFromView.ts) 只刪除 `FLOOR_ARTIFACT_NAMES`（`fuxa_floor_section_title`、`fuxa_floor_section_frame`）與受管元件 id，不含 `shape_1`，因此底圖不會被誤刪。

需補回歸測試：以 `測試樓層demo.json` 走完整的匯入、套用、匯出流程，確認兩個樓層 view 的底圖 `items` 項目與 `<IMG src="resources/Drawing2.svg">` 不變。

## 7. 實作順序

1. REFACTOR_PLAN 第 12 節 D 與 J：只搬樓層相關純邏輯並補測試。
2. 畫面文字「樓層」改為「群組」，加上第 1 節的程式碼注解，並核對 README。
3. 新增 `domain/buildingFloors/` 純函式與測試。
4. 樓層按鈕的產生與重建，接入現有匯出流程。
5. 導覽項目同步。
6. 回歸測試：底圖路徑保留、按鈕重複產生、增減樓層。
7. 瀏覽器煙霧測試：REFACTOR_PLAN §7，並在 FUXA 實際載入匯出的 JSON，確認按鈕可切換。

## 8. 不在第一階段範圍

- 樓層平面圖上傳，以及平面圖路徑的編輯欄位（由使用者在 FUXA 中處理）。
- 地下樓層（`B1`）與非數字樓層名稱。
- 程式識別字改名。
- 在 `extra` 中保存樓層設定（因為不做平面圖欄位，目前不需要）。

## 9. 待確認

- 同系統只有一個樓層時，是否仍產生按鈕。
- 目前所在樓層的按鈕是否需要不同外觀。
- 按鈕的大小、位置與顏色是否沿用範例（80×32，位於上方）。
- 編輯器是否需要在 UI 上顯示「樓層功能已開啟」的提示。
