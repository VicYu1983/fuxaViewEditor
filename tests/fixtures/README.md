# 測試 fixtures

這些是**真實的 FUXA 專案 JSON**，用來驗證匯出與往返（FUXA ⇄ View Editor）行為。
請勿手動修改內容；需要變體時，在測試中以 `structuredClone` 或文字取代產生。

| 檔案 | 來源 | 用途 |
|---|---|---|
| `floor-demo.json` | 在 FUXA 內建立樓層按鈕後的專案（`extra` 內尚無 `fuxaSetting`）。「排風系統/2F」「排風系統/3F」各有 2 個按鈕。 | 樓層按鈕尚未被工具管理的初始狀態（認領／重建路徑）。 |
| `floor-demo2.json` | 經過「View Editor 匯出 → FUXA 匯入並匯出」後的結果。「排風/2F」是平面圖 View，按鈕只剩文字（`<BUTTON>` 遺失）且殘留群組標題「未設定樓層」；「排風/3F」按鈕完整。 | 重現 2026-11-04 的往返事件（見 [EXTRA_SOURCE_OF_TRUTH.md](../../docs/EXTRA_SOURCE_OF_TRUTH.md) 1.1）。 |
| `fuxa-empty-project.json` | 空專案。 | 基本載入測試。 |
| `旭峰建設.json` | 實際專案。 | 大型專案的載入與匯出測試。 |

往返模擬請使用 [fuxaRoundTrip.ts](../helpers/fuxaRoundTrip.ts) 的 `simulateFuxaRoundTrip`。
發現 FUXA 有新的改寫行為時，先更新該函式與文件第 3.3 節，再寫測試。
