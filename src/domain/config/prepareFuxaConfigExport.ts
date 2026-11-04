import type {
  FloorGroupFrameSettings,
  FuxaConfig,
  SourceTextFormat,
} from './types'
import { serializeFuxaConfig } from './serialization'
import { saveViewGridSettings } from '../layout/gridSettings'
import { navigationNeedsSync, syncNavigationItems } from '../views/syncNavigation'
import { saveFloorGroupFrameSettings } from '../layout/floorGroupFrame'
import { saveFloorPlanTagOffsets, saveFloorPlanViewSettings } from '../layout/floorPlanViews'
import type { FloorPlanTagOffsets } from '../layout/floorPlanViews'
import { saveFloorGroupArtifacts } from '../layout/floorGroupArtifacts'
import { groupComponentsByFloor } from '../layout/floorLayout'
import type { FloorTag } from '../layout/floorLayout'
import { saveIconLibrary } from '../icons/iconLibrary'
import { buildingFloorButtonsNeedSync } from '../buildingFloors/buildingFloorButtons'
import {
  deviceTagsNeedAddressSorting,
  sortDeviceTagsByAddress,
} from '../devices/deviceTagAddressSort'
import { generateId } from '../ids'
import { isRecord } from './validateFuxaConfig'
import {
  getVoiceRepeatSettings,
  normalizeVoiceRepeat,
  VOICE_REPEAT_MAX,
  VOICE_REPEAT_MIN,
} from './voiceRepeat'
import type { GeneratedViewModel } from '../svg/validateGeneratedView'

const VOICE_TRIGGER_TAG_NAME = 'voiceOn'
const VOICE_MESSAGE_TAG_NAME = 'voiceMessage'
const VOICE_REPEAT_TAG_NAME = 'voiceRepeat'
const VOICE_ALARM_LEVELS = ['highhigh', 'high', 'low', 'info'] as const

export { VOICE_REPEAT_MAX, VOICE_REPEAT_MIN, normalizeVoiceRepeat } from './voiceRepeat'

export function buildVoiceScriptCode(
  triggerTagId: string,
  messageTagId: string,
  repeatTagId: string,
): string {
  return [
    `const voiceOn = $getTag(${JSON.stringify(triggerTagId)} /* FUXA - ${VOICE_TRIGGER_TAG_NAME} */);`,
    'if (voiceOn) {',
    `  $setTag(${JSON.stringify(triggerTagId)} /* FUXA - ${VOICE_TRIGGER_TAG_NAME} */, false);`,
    `  const message = $getTag(${JSON.stringify(messageTagId)} /* FUXA - ${VOICE_MESSAGE_TAG_NAME} */);`,
    `  const repeatTag = $getTag(${JSON.stringify(repeatTagId)} /* FUXA - ${VOICE_REPEAT_TAG_NAME} */);`,
    `  const repeat = Math.min(${VOICE_REPEAT_MAX}, Math.max(${VOICE_REPEAT_MIN}, Math.round(Number(repeatTag) || ${VOICE_REPEAT_MIN})));`,
    "  const voice = speechSynthesis.getVoices().find(v => v.lang === 'zh-TW' && v.localService);",
    '  let played = 0;',
    '  const speakOnce = () => {',
    '    const u = new SpeechSynthesisUtterance(message);',
    '    if (voice) u.voice = voice;',
    "    u.lang = 'zh-TW';",
    '    u.onend = () => {',
    '      played += 1;',
    '      if (played < repeat) speakOnce();',
    '    };',
    '    speechSynthesis.speak(u);',
    '  };',
    '  speakOnce();',
    '}',
  ].join('\n')
}

export interface ExportViewModel extends GeneratedViewModel {
  floorFrameShapeIds: Record<string, string>
  originalFloorTitleIds?: Record<string, string[]>
  originalFloorFrameIds?: Record<string, string[]>
}

export interface PrepareFuxaConfigExportInput {
  config: FuxaConfig
  originalText: string
  sourceFormat: SourceTextFormat
  dirty: boolean
  projectName?: string
  models?: readonly ExportViewModel[]
  modifiedViewIds?: ReadonlySet<string>
  tags?: Map<string, FloorTag> | Record<string, FloorTag>
  floorGroupFrame?: FloorGroupFrameSettings
  iconLibrary?: unknown
  originalIconLibrary?: string
}

export interface PrepareFuxaConfigExportDependencies {
  syncBuildingFloors?: (config: FuxaConfig) => ReadonlySet<string> | void
  applyView?: (
    view: Record<string, unknown>,
    model: ExportViewModel,
    models: readonly ExportViewModel[],
    options?: { preview?: { tagOffsets: FloorPlanTagOffsets } },
  ) => void
  validate?: (
    config: FuxaConfig,
    modifiedViewIds: ReadonlySet<string>,
    models: readonly ExportViewModel[],
  ) => void
  alignFloorFrames?: (config: FuxaConfig) => void
}

export interface PreparedFuxaConfigExport {
  config: FuxaConfig
  text: string
  dirty: boolean
  modifiedViewIds: ReadonlySet<string>
  models: readonly ExportViewModel[]
}

interface VoiceBridgeTags {
  triggerId: string
  messageId: string
  repeatId: string
}

function getFuxaServerDevice(config: FuxaConfig): Record<string, unknown> {
  const server = Object.values(config.devices).find((device) =>
    isRecord(device) && device.type === 'FuxaServer')
  if (!isRecord(server)) throw new Error('找不到 FUXA Server 設備，無法設定語音告警。')
  if (server.tags !== undefined && !isRecord(server.tags)) {
    throw new Error('FUXA Server tags 欄位格式無效，無法設定語音告警。')
  }
  return server
}

function getVoiceBridgeTags(config: FuxaConfig): VoiceBridgeTags | undefined {
  const server = getFuxaServerDevice(config)
  const tags = isRecord(server.tags) ? server.tags : {}
  const findTag = (name: string, expectedType: string): string | undefined => {
    const matches = Object.entries(tags).filter(([, value]) =>
      isRecord(value) && value.name === name)
    if (matches.length > 1) {
      throw new Error(`FUXA Server 中有多個「${name}」Tag，無法設定語音告警。`)
    }
    const match = matches[0]
    if (!match) return undefined
    const [key, value] = match
    if (!isRecord(value) || value.type !== expectedType) {
      throw new Error(`FUXA Server 的「${name}」Tag 必須是 ${expectedType} 型別。`)
    }
    return typeof value.id === 'string' && value.id ? value.id : key
  }

  const triggerId = findTag(VOICE_TRIGGER_TAG_NAME, 'boolean')
  const messageId = findTag(VOICE_MESSAGE_TAG_NAME, 'string')
  const repeatId = findTag(VOICE_REPEAT_TAG_NAME, 'number')
  return triggerId && messageId && repeatId
    ? { triggerId, messageId, repeatId }
    : undefined
}

function expectedVoiceActions(
  alarm: Record<string, unknown>,
  tags: VoiceBridgeTags,
  repeats: Record<string, number>,
): Record<string, unknown>[] {
  return VOICE_ALARM_LEVELS.flatMap((levelName) => {
    const level = alarm[levelName]
    if (!isRecord(level) || level.enabled !== true) return []
    const min = typeof level.min === 'number' ? level.min : 1
    const max = typeof level.max === 'number' ? level.max : 1
    const message = typeof level.text === 'string' ? level.text : ''
    const repeat = normalizeVoiceRepeat(repeats[levelName])
    return [
      {
        type: 'setValue',
        actparam: 'true',
        variableId: tags.triggerId,
        actoptions: {},
        checkdelay: 1,
        timedelay: 0,
        min,
        max,
      },
      {
        type: 'setValue',
        actparam: message,
        variableId: tags.messageId,
        actoptions: {},
        checkdelay: 1,
        timedelay: 0,
        min,
        max,
      },
      {
        type: 'setValue',
        actparam: String(repeat),
        variableId: tags.repeatId,
        actoptions: {},
        checkdelay: 1,
        timedelay: 0,
        min,
        max,
      },
    ]
  })
}

function alarmHasVoiceActions(
  alarm: unknown,
  tags: VoiceBridgeTags,
  repeats: Record<string, number>,
): boolean {
  if (!isRecord(alarm)) return true
  const expected = expectedVoiceActions(alarm, tags, repeats)
  if (!expected.length) return true
  if (!isRecord(alarm.actions) || alarm.actions.enabled !== true
      || !Array.isArray(alarm.actions.values)) return false
  const values = alarm.actions.values
  return expected.every((expectedAction) => values.some((value) => (
    isRecord(value)
    && value.type === expectedAction.type
    && value.variableId === expectedAction.variableId
    && value.actparam === expectedAction.actparam
    && value.min === expectedAction.min
    && value.max === expectedAction.max
  )))
}

function expectedVoiceScriptCode(tags: VoiceBridgeTags): string {
  return buildVoiceScriptCode(tags.triggerId, tags.messageId, tags.repeatId)
}

function generateVoiceScriptId(scripts: readonly unknown[]): string {
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error('目前環境無法產生語音方法 ID，請使用支援 Web Crypto 的瀏覽器。')
  }
  const usedIds = new Set(scripts.flatMap((script) => (
    isRecord(script) && typeof script.id === 'string' ? [script.id] : []
  )))
  return generateId('s', usedIds, globalThis.crypto)
}

export function needsVoiceBridgeUpdate(config: FuxaConfig): boolean {
  if (config.scripts !== undefined && !Array.isArray(config.scripts)) {
    throw new Error('FUXA scripts 欄位格式無效，無法加入語音方法。')
  }
  if (config.alarms !== undefined && !Array.isArray(config.alarms)) {
    throw new Error('FUXA alarms 欄位格式無效，無法設定語音告警。')
  }
  const tags = getVoiceBridgeTags(config)
  if (!tags) return true
  const voiceScripts = Array.isArray(config.scripts)
    ? config.scripts.filter((script) => isRecord(script) && script.name === 'voice')
    : []
  if (voiceScripts.length !== 1) return true
  const script = voiceScripts[0]
  if (!isRecord(script)
      || typeof script.id !== 'string'
      || !script.id
      || script.code !== expectedVoiceScriptCode(tags)
      || script.mode !== 'CLIENT'
      || script.sync !== false
      || !Array.isArray(script.parameters)
      || script.parameters.length !== 0
      || !isRecord(script.scheduling)
      || script.scheduling.mode !== 'interval'
      || script.scheduling.interval !== 1
      || !Array.isArray(script.scheduling.schedules)) return true
  return Array.isArray(config.alarms)
    && config.alarms.some((alarm) => !alarmHasVoiceActions(
      alarm,
      tags,
      getVoiceRepeatSettings(config),
    ))
}

function createVoiceBridgeTag(
  id: string,
  name: string,
  type: 'boolean' | 'string' | 'number',
  init: string | null,
): Record<string, unknown> {
  return {
    id,
    name,
    type,
    daq: { enabled: false, interval: 60, changed: false, restored: false },
    init,
    description: null,
    timestamp: Date.now(),
  }
}

function ensureVoiceBridgeTags(config: FuxaConfig): VoiceBridgeTags {
  const server = getFuxaServerDevice(config)
  const tags = isRecord(server.tags) ? server.tags : {}
  server.tags = tags
  const allIds = new Set<string>()
  for (const device of Object.values(config.devices)) {
    if (!isRecord(device) || !isRecord(device.tags)) continue
    for (const [key, tag] of Object.entries(device.tags)) {
      allIds.add(key)
      if (isRecord(tag) && typeof tag.id === 'string') allIds.add(tag.id)
    }
  }
  const findOrCreate = (
    name: string,
    type: 'boolean' | 'string' | 'number',
    init: string | null,
  ): string => {
    const matches = Object.entries(tags).filter(([, value]) =>
      isRecord(value) && value.name === name)
    if (matches.length > 1) {
      throw new Error(`FUXA Server 中有多個「${name}」Tag，無法設定語音告警。`)
    }
    const match = matches[0]
    if (match) {
      const [key, value] = match
      if (!isRecord(value) || value.type !== type) {
        throw new Error(`FUXA Server 的「${name}」Tag 必須是 ${type} 型別。`)
      }
      if (typeof value.id !== 'string' || !value.id) value.id = key
      return value.id as string
    }
    if (!globalThis.crypto?.getRandomValues) {
      throw new Error('目前環境無法產生語音 Tag ID，請使用支援 Web Crypto 的瀏覽器。')
    }
    const id = generateId('t', allIds, globalThis.crypto)
    tags[id] = createVoiceBridgeTag(id, name, type, init)
    return id
  }

  return {
    triggerId: findOrCreate(VOICE_TRIGGER_TAG_NAME, 'boolean', '0'),
    messageId: findOrCreate(VOICE_MESSAGE_TAG_NAME, 'string', null),
    repeatId: findOrCreate(VOICE_REPEAT_TAG_NAME, 'number', String(VOICE_REPEAT_MIN)),
  }
}

function updateVoiceScripts(config: FuxaConfig, tags: VoiceBridgeTags): void {
  const scripts = Array.isArray(config.scripts) ? config.scripts : []
  const voiceScripts = scripts.filter((script) => isRecord(script) && script.name === 'voice')
  if (voiceScripts.length) {
    if (voiceScripts.length > 1) {
      throw new Error('FUXA scripts 中有多個 voice 方法，請先保留一個後再匯出。')
    }
    for (const script of voiceScripts) {
      if (!isRecord(script)) continue
      if (typeof script.id !== 'string' || !script.id) {
        script.id = generateVoiceScriptId(scripts)
      }
      script.sync = false
      script.parameters = []
      script.mode = 'CLIENT'
      script.code = expectedVoiceScriptCode(tags)
      script.scheduling = { mode: 'interval', interval: 1, schedules: [] }
    }
    config.scripts = scripts
    return
  }

  const id = generateVoiceScriptId(scripts)
  config.scripts = [
    ...scripts,
    {
      id,
      name: 'voice',
      sync: false,
      parameters: [],
      mode: 'CLIENT',
      code: expectedVoiceScriptCode(tags),
      scheduling: { mode: 'interval', interval: 1, schedules: [] },
    },
  ]
}

function updateVoiceAlarmActions(config: FuxaConfig, tags: VoiceBridgeTags): void {
  if (!Array.isArray(config.alarms)) return
  const repeats = getVoiceRepeatSettings(config)
  for (const alarm of config.alarms) {
    if (!isRecord(alarm)) continue
    const expected = expectedVoiceActions(alarm, tags, repeats)
    if (!expected.length) continue
    const previousActions = isRecord(alarm.actions) ? alarm.actions : {}
    const previousValues = Array.isArray(previousActions.values) ? previousActions.values : []
    const values = previousValues.filter((value) => (
      !isRecord(value)
      || (value.type !== 'setValue'
        || (value.variableId !== tags.triggerId
          && value.variableId !== tags.messageId
          && value.variableId !== tags.repeatId))
    ))
    alarm.actions = {
      ...previousActions,
      enabled: true,
      values: [...values, ...expected],
    }
  }
}

export function updateVoiceBridge(config: FuxaConfig): void {
  const tags = ensureVoiceBridgeTags(config)
  updateVoiceScripts(config, tags)
  updateVoiceAlarmActions(config, tags)
}

// 舊版輸出的 Switch 內層 id 為 SHE_，FUXA 無法掛載開關元件，需重建
export function findLegacySwitchViewIds(
  models: readonly ExportViewModel[],
): Set<string> {
  const ids = new Set<string>()
  for (const model of models) {
    const legacy = model.components.some((component) =>
      component.managed !== false
      && component.template === 'switch'
      && !(component.shapeInnerIds?.[1] ?? '').startsWith('H-HXT_')
      || component.managed !== false
      && component.template === 'switch'
      && !(component.shapeInnerIds?.[2] ?? '').startsWith('T-HXT_'))
    if (legacy) ids.add(model.viewId)
  }
  return ids
}

// 平面圖 View 不保留群組標題與底框；舊輸出殘留時需重新套用該 View 以清除
export function findStaleFloorPlanViewIds(
  models: readonly ExportViewModel[],
): Set<string> {
  const ids = new Set<string>()
  for (const model of models) {
    if (model.floorPlan !== true) continue
    const hasArtifacts = Object.keys(model.floorTitles).length > 0
      || Object.keys(model.floorFrames).length > 0
      || Object.values(model.floorTitleIds).some((values) => values.length > 0)
      || Object.values(model.floorFrameIds).some((values) => values.length > 0)
    if (hasArtifacts) ids.add(model.viewId)
  }
  return ids
}

function viewsById(config: FuxaConfig, viewId: string): Record<string, unknown>[] {
  if (!Array.isArray(config.hmi.views)) return []
  return config.hmi.views.filter(
    (view): view is Record<string, unknown> => isRecord(view) && view.id === viewId,
  )
}

function floorArtifactsForModel(
  model: ExportViewModel,
  tags: Map<string, FloorTag> | Record<string, FloorTag>,
): Record<string, { titleId: string; frameId: string; frameShapeId: string }> {
  const artifacts: Record<string, { titleId: string; frameId: string; frameShapeId: string }> = {}
  for (const group of groupComponentsByFloor(model.components, tags)) {
    const key = `floor:${group.floor}`
    const titleId = model.floorTitles[key]
    const frameId = model.floorFrames[key]
    const frameShapeId = model.floorFrameShapeIds[key]
    if (titleId && frameId && frameShapeId) {
      artifacts[key] = { titleId, frameId, frameShapeId }
    }
  }
  return artifacts
}

export function prepareFuxaConfigExport(
  input: PrepareFuxaConfigExportInput,
  dependencies: PrepareFuxaConfigExportDependencies = {},
): PreparedFuxaConfigExport {
  const projectNameChanged = input.projectName !== undefined
    && input.config.name !== input.projectName
  const deviceTagsNeedSorting = deviceTagsNeedAddressSorting(input.config)
  if (!input.dirty
      && !projectNameChanged
      && !deviceTagsNeedSorting
      && !needsVoiceBridgeUpdate(input.config)
      && !navigationNeedsSync(input.config)
      && !buildingFloorButtonsNeedSync(input.config)
      && findLegacySwitchViewIds(input.models ?? []).size === 0
      && findStaleFloorPlanViewIds(input.models ?? []).size === 0) {
    return {
      config: input.config,
      text: input.originalText,
      dirty: false,
      modifiedViewIds: new Set(),
      models: input.models ?? [],
    }
  }

  const output = structuredClone(input.config)
  updateVoiceBridge(output)
  syncNavigationItems(output)
  sortDeviceTagsByAddress(output)
  if (input.projectName !== undefined) output.name = input.projectName
  const models = (input.models ?? []).map((model) => structuredClone(model))
  const modifiedViewIds = new Set<string>()
  const tags = input.tags ?? {}
  const modelIds = new Set<string>()
  for (const model of models) {
    if (modelIds.has(model.viewId)) {
      throw new Error(`編輯模型包含重複的 View ID「${model.viewId}」，無法安全匯出。`)
    }
    modelIds.add(model.viewId)
  }
  const allViewIds = output.hmi.views.flatMap((view) =>
    isRecord(view) && typeof view.id === 'string' ? [view.id] : [],
  )

  const requestedViewIds = new Set([
    ...(input.modifiedViewIds ?? []),
    ...findLegacySwitchViewIds(models),
    ...findStaleFloorPlanViewIds(models),
  ])
  for (const viewId of requestedViewIds) {
    const model = models.find((candidate) => candidate.viewId === viewId)
    if (!model) {
      throw new Error(`找不到 View「${viewId}」的編輯模型，無法匯出修改。`)
    }
    const matchingViews = viewsById(output, viewId)
    if (matchingViews.length !== 1) {
      throw new Error(
        matchingViews.length === 0
          ? `配置中找不到已修改的 View「${viewId}」。`
          : `配置中 View ID「${viewId}」重複，無法安全匯出。`,
      )
    }
    const view = matchingViews[0]!
    if (!dependencies.applyView) {
      throw new Error('尚未設定 SVG View 套用函式，無法匯出修改後的配置。')
    }
    dependencies.applyView(view, model, models)
    modifiedViewIds.add(viewId)
  }

  const floorButtonViewIds = dependencies.syncBuildingFloors?.(output)
  if (buildingFloorButtonsNeedSync(output)) {
    throw new Error('尚未設定樓層按鈕同步函式，無法匯出樓層 View。')
  }
  for (const viewId of floorButtonViewIds ?? []) modifiedViewIds.add(viewId)
  dependencies.alignFloorFrames?.(output)

  if (input.iconLibrary !== undefined
      && JSON.stringify(input.iconLibrary) !== input.originalIconLibrary) {
    saveIconLibrary(output, input.iconLibrary)
  }

  saveViewGridSettings(
    output,
    allViewIds,
    new Map(models.map((model) => [model.viewId, model.grid])),
  )
  if (input.floorGroupFrame) {
    saveFloorGroupFrameSettings(output, input.floorGroupFrame)
  }
  saveFloorPlanViewSettings(
    output,
    allViewIds,
    new Map(models.map((model) => [model.viewId, model.floorPlan === true])),
  )
  saveFloorPlanTagOffsets(
    output,
    allViewIds,
    new Map(models.map((model) => [model.viewId, model.floorPlanTagOffsets ?? {}])),
  )
  saveFloorGroupArtifacts(
    output,
    allViewIds,
    new Map(models.map((model) => [model.viewId, floorArtifactsForModel(model, tags)])),
  )

  if (!dependencies.validate) {
    throw new Error('尚未設定輸出驗證函式，無法匯出修改後的配置。')
  }
  const text = serializeFuxaConfig(output, input.sourceFormat)
  const parsedOutput = JSON.parse(text) as FuxaConfig
  dependencies.validate(parsedOutput, modifiedViewIds, models)

  return { config: output, text, dirty: true, modifiedViewIds, models }
}
