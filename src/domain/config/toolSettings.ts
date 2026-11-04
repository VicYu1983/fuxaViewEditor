import { isRecord } from '../shared/isRecord'

// extra.fuxaSetting 的唯一存取入口。設計見 docs/EXTRA_SOURCE_OF_TRUTH.md 第 5 節。
export const TOOL_SETTINGS_KEY = 'fuxaSetting'
export const TOOL_SETTINGS_VERSION = 1
export const TOOL_SETTINGS_OUTDATED_MESSAGE
  = '此檔案由較新版本的工具產生，目前工具版本可能過舊，部分設定可能無法正確處理。'

export interface WritableToolSettings {
  extra: Record<string, unknown>
  toolSettings: Record<string, unknown>
}

/** 寬鬆讀取：extra 或 fuxaSetting 不是物件時回傳 undefined。 */
export function getToolSettings(config: unknown): Record<string, unknown> | undefined {
  if (!isRecord(config) || !isRecord(config.extra)) return undefined
  const toolSettings = config.extra[TOOL_SETTINGS_KEY]
  return isRecord(toolSettings) ? toolSettings : undefined
}

/**
 * 嚴格讀取以便寫入：結構不是物件就拋出錯誤，避免覆蓋未知資料。
 * 不修改 config；缺少的層級回傳新的空物件。`action` 接在「無法」之後。
 */
export function readToolSettingsForWrite(
  config: unknown,
  action: string,
): WritableToolSettings {
  const currentExtra = isRecord(config) ? config.extra : undefined
  if (currentExtra !== undefined && !isRecord(currentExtra)) {
    throw new Error(`配置的 extra 欄位不是物件，無法${action}。`)
  }
  const extra = isRecord(currentExtra) ? currentExtra : {}
  const currentToolSettings = extra[TOOL_SETTINGS_KEY]
  if (currentToolSettings !== undefined && !isRecord(currentToolSettings)) {
    throw new Error(`配置的 extra.${TOOL_SETTINGS_KEY} 欄位不是物件，無法${action}。`)
  }
  return {
    extra,
    toolSettings: isRecord(currentToolSettings) ? currentToolSettings : {},
  }
}

/** 回傳目前設定結構的版本；沒有 version 的舊檔視為 1。 */
export function getToolSettingsVersion(config: unknown): number {
  const version = getToolSettings(config)?.version
  return typeof version === 'number' && Number.isFinite(version) ? version : TOOL_SETTINGS_VERSION
}

/** 檔案的設定版本高於工具支援的版本時為 true。 */
export function isToolSettingsOutdated(config: unknown): boolean {
  return getToolSettingsVersion(config) > TOOL_SETTINGS_VERSION
}

/** 寫入用的版本值：不降級較新的版本。 */
export function nextToolSettingsVersion(toolSettings: Record<string, unknown>): number {
  const version = toolSettings.version
  return typeof version === 'number' && Number.isFinite(version)
    ? Math.max(version, TOOL_SETTINGS_VERSION)
    : TOOL_SETTINGS_VERSION
}

export function getToolSettingsOutdatedWarning(config: unknown): string | undefined {
  return isToolSettingsOutdated(config) ? TOOL_SETTINGS_OUTDATED_MESSAGE : undefined
}
