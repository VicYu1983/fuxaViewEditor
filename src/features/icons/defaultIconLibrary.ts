import { isRecord } from '../../domain/config/validateFuxaConfig'
import {
  getIconAssets,
  validateIconLibrary,
  type IconLibraryEntry,
} from '../../domain/icons/iconLibrary'

export const DEFAULT_ICON_LIBRARY_FILE = 'default-icon-library.json'
const ICON_LIBRARY_EXPORT_FORMAT = 'fuxaSetting-icon-library'

/** 驗證預設圖示庫 JSON；格式與「圖示庫 → 匯出」相同。 */
export function parseDefaultIconLibrary(input: unknown): IconLibraryEntry[] {
  if (!isRecord(input)
      || input.format !== ICON_LIBRARY_EXPORT_FORMAT
      || input.version !== 1) {
    throw new Error('預設圖示庫格式無效或版本不支援。')
  }
  return validateIconLibrary(input.icons)
}

/**
 * 開啟一鍵配置時才載入預設圖示庫，避免 5 MiB 的圖片資料進入 JS bundle。
 * URL 相對於目前頁面，因此可直接從 view-editor/default-icon-library.json 取得。
 */
export async function loadDefaultIconLibrary(
  fetcher: typeof fetch = fetch,
  baseUrl: string | undefined = typeof document === 'undefined' ? undefined : document.baseURI,
): Promise<IconLibraryEntry[]> {
  const url = new URL(DEFAULT_ICON_LIBRARY_FILE, baseUrl ?? 'http://localhost/')
  const response = await fetcher(url.toString())
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return parseDefaultIconLibrary(await response.json())
}

/**
 * 合併兩份圖示庫；以第一份為優先（專案既有圖示優先於預設圖示），
 * 名稱或任一圖片 ID 重複時略過後來的項目。
 */
export function mergeIconLibraries(
  primary: readonly IconLibraryEntry[],
  secondary: readonly IconLibraryEntry[],
): IconLibraryEntry[] {
  const usedIds = new Set<string>()
  const usedNames = new Set<string>()
  const merged: IconLibraryEntry[] = []

  for (const icon of [...primary, ...secondary]) {
    const name = icon.name.trim().toLocaleLowerCase()
    const iconIds = [icon.id, ...getIconAssets(icon).map((asset) => asset.id)]
    if (usedNames.has(name) || iconIds.some((id) => usedIds.has(id))) continue
    usedNames.add(name)
    for (const id of iconIds) usedIds.add(id)
    merged.push(icon)
  }
  return merged
}
