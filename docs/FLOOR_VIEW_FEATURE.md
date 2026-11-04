# 樓層 View 功能開發文件

狀態：功能已實作；FUXA 實際載入與點擊的煙霧測試待執行。範例資料：`testjson/測試樓層demo.json`。

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
- 樓層部分須符合：`^\d+F$`（不分大小寫）、`^\d+樓$` 或 `^B\d+F$`（不分大小寫）。
- 例：`排風系統/2F`、`排風系統/3樓`、`排風系統/B1F` 符合；`排風系統/FAN`、`MainView` 不符合。
- 系統名稱為 `/` 之前的字串，同系統名稱的樓層 view 屬於同一組。
- 同系統只有一個樓層時，不產生樓層按鈕。
- 排序：地下樓層先依樓層數字由大到小（`B2F`、`B1F`），再接地面樓層由小到大（`1F`、`2F`、`3F`）。

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
- `BUTTON` 必須以無命名空間前綴的形式寫入（與 FUXA 原生一致）。若寫成 `html:BUTTON`，FUXA 匯入後只會剩下文字。同步時若發現按鈕缺少 `<BUTTON>` 元素，會自動重建。
- 導覽項目位於 `hmi.layout.navigation.items`：`{ text: "<系統>", view: "<最低樓層 view id>", icon, image, permission, children }`。
- 平面圖為 `svg-ext-own_ctrl-image`，`property.address` 為 `resources/xxx.svg` 路徑。

## 5. 設計

### 5.1 純函式（`src/domain/buildingFloors/`）

- `parseBuildingFloorName(viewName)`：回傳 `{ system, floorLabel, floorNumber }` 或 `null`。
- `groupBuildingFloors(views)`：回傳 `Map<system, 樓層清單（已排序，含 View id）>`；地下樓層排在地面樓層之前。
- `syncBuildingFloorButtons(...)`：依樓層清單產生按鈕的 `items` 項目與 SVG 節點。沿用範例的 80×32 尺寸與間距；若有 View 標題標籤，按鈕列移至標籤下方；目前樓層按鈕以藍底白字標示。
- `syncNavigationItems(config)`：每個系統一筆，更新或新增，不動使用者自訂的其他項目。

### 5.2 重建策略

- 樓層按鈕以專用 `data-name`（`fuxa_building_floor_button`）標記，仿照現有 `FLOOR_ARTIFACT_NAMES` 的做法。
- 同時將每個 View 的樓層按鈕 id 索引保存於 `extra.fuxaSetting.buildingFloorButtons`，供 FUXA 往返匯入後 SVG 自訂標記或項目名稱遭移除時，仍可安全辨識並修復按鈕。
- 每次匯出時檢查樓層按鈕是否與 View 清單一致；需要更新時先移除受管按鈕再重建，避免殘留與重複。
- 不可使用 `shape_1` 之類通用名稱，避免誤刪使用者自己的元件。
- **後續方向**：目前仍有「認領既有按鈕」與依 SVG 標記判斷是否同步的啟發式。已決議改為以 `extra` 為唯一來源、SVG 每次重建，詳見 [EXTRA_SOURCE_OF_TRUTH.md](./EXTRA_SOURCE_OF_TRUTH.md)（尚未實作）。

### 5.3 導覽項目歸屬

- 以 `text` 與系統名稱相同，且 `view` 指向該系統任一樓層 view，視為編輯器管理的項目。
- 系統已不存在樓層時，才移除對應項目；非編輯器建立的項目不處理。
- 不符合編輯器管理條件的自訂導覽項目需原樣保留。

### 5.4 編輯器提示

- View 名稱符合樓層規則時，在編輯器標題區顯示「樓層功能已開啟」。同系統僅有一個樓層時仍顯示提示，但不產生按鈕。

### 5.5 平面圖 View（手動開關）

- 每個 View 可在編輯器的「平面圖 View」卡片手動開啟，設定保存於 `extra.fuxaSetting.floorPlanViewIds`。
- 平面圖 View 保留 view 標題（`view_title`），不產生群組框與群組標題（`fuxa_floor_section_title`，例如「未設定樓層」）。
- Tag 仍由自動排列（排排站）配置。在簡易畫面（SVG 預覽）中點選 Tag 會以藍色虛線框標示選取，並顯示其名稱與 ID。SVG 預覽保持靜態，不支援拖拉。
- 拖拉改由獨立的互動卡片（`FloorPlanLayoutPanel`，位於編輯區下方）完成。卡片以 React 渲染每個受管 Tag 的方塊與 label，拖拉放開後才寫入偏移量。
- 偏移量（`dx`、`dy`，單位為 SVG 座標）保存於 `extra.fuxaSetting.floorPlanTagOffsets[viewId][tagId]`，以 tagId 為鍵，因此變更 Tag 類型（例如 switch 改為正常/告警）後位置仍會保留。
- **單一來源**：預覽與匯出都透過 `layoutFloorViewComponents`（`src/domain/layout/floorPlanViews.ts`）計算位置，偏移量在同一處套用。
- **匯出**：每次匯出時由 view editor 重新計算並寫入 SVG 與 `view.items`，匯出結果只取決於 view editor 的資料，不保留 FUXA 端的修改。
- **匯入**：不考慮。不從 FUXA 或 SVG 反推位置。

## 6. 匯入與匯出的保護

已完成自動化回歸測試：

- 樣板既有的樓層按鈕會被辨識並接管，不會重複產生；產生或清理按鈕時，`resources/Drawing2.svg` 路徑保持不變。
- 匯出測試確認樓層按鈕與 `layout.navigation.items` 寫入正確，其他 SVG 圖面內容保留。
- [serialization.ts](../src/domain/config/serialization.ts) 以 `JSON.stringify` 輸出整份設定，不過濾欄位。
- [removeManagedFromView.ts](../src/domain/svg/removeManagedFromView.ts) 只刪除明確標記的群組底框、樓層按鈕與受管元件，不含 `shape_1`，因此使用者底圖不會被誤刪。

## 7. 實作順序

1. 已完成：樓層相關純邏輯與測試。
2. 已完成：舊 Tag「樓層」介面文字改為「群組」、加入程式碼註解並更新 README。
3. 已完成：新增 `domain/buildingFloors/` 純函式與測試。
4. 已完成：樓層按鈕產生與重建，接入現有匯出流程。
5. 已完成：導覽項目同步。
6. 已完成：底圖路徑保留、樣板按鈕不重複、單樓層不產生按鈕等回歸測試。
7. 待執行：在 FUXA 實際載入匯出的 JSON，確認按鈕可切換。

## 8. 不在第一階段範圍

- 樓層平面圖上傳，以及平面圖路徑的編輯欄位（由使用者在 FUXA 中處理）。
- 非數字樓層名稱與不符合 `B<number>F` 格式的地下樓層名稱。
- 程式識別字改名。
- 在 `extra` 中保存「樓層平面圖底圖」設定（底圖仍由使用者在 FUXA 處理；樓層按鈕索引與平面圖 View 設定已保存於 `extra`，見 5.2、5.5）。

## 9. 已確認決策

- 同系統只有一個樓層時，不產生樓層按鈕。
- 目前所在樓層的按鈕需有不同外觀。
- 第一階段沿用範例按鈕尺寸與位置（80×32，位於上方），先完成可用功能，再討論美化。
- 編輯器 UI 顯示「樓層功能已開啟」提示。
