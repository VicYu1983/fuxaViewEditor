import {
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from 'react'
import {
  Alert,
  Button,
  ConfigProvider,
  Empty,
  Form,
  Layout,
  Modal,
  Space,
  Tag,
  Typography,
  message,
} from 'antd'
import zhTW from 'antd/locale/zh_TW'
import { normalizeProjectName, projectFileName } from './domain/config/serialization'
import { getErrorMessage } from './domain/shared/getErrorMessage'
import { isRecord } from './domain/shared/isRecord'
import { parseUpdatedConfig } from './app/lib/parseUpdatedConfig'
import { measureSvgBounds } from './app/lib/measureSvgBounds'
import { createBrowserSvgDeps } from './app/lib/browserSvgDeps'
import {
  buildDuplicateTagGroups,
} from './domain/tags/tagViews'
import {
  readDeviceFormValues,
  readManagedDeviceTags,
  readModbusDevices,
  type ModbusDeviceFormValues,
} from './domain/devices/readModbusDevices'
import {
  findEditableTargetView,
  planComponentsMove,
} from './features/views/moveComponentsBetweenViews'
import { findTagReferences } from './features/devices/findTagReferences'
import { buildViewTargetOptions } from './domain/views/viewTargetOptions'
import { BatchMoveDialog, type BatchMoveItem } from './ui/view/BatchMoveDialog'
import { AutoViewDialog, type AutoViewApplyOptions } from './ui/view/AutoViewDialog'
import { ComponentMoveDialog } from './ui/view/ComponentMoveDialog'
import { DevicesTab } from './ui/device/DevicesTab'
import { EditorHeader } from './ui/layout/EditorHeader'
import { IconLibraryDialog, type IconAddDraft, type MultiStateIconDraft } from './ui/icons/IconLibraryDialog'
import { FloorPlanLibraryDialog } from './ui/floorPlans/FloorPlanLibraryDialog'
import {
  createFloorPlanDataUrl,
  createFloorPlanImage,
  floorPlanKeyForView,
  getFloorPlanLibrary,
  saveFloorPlanLibrary,
  type FloorPlanLibrary,
} from './domain/floorPlans/floorPlanLibrary'
import { MultiStateIconDialog } from './ui/icons/MultiStateIconDialog'
import {
  ViewSettingsDialog,
  type FloorGroupFrameFormValues,
  type ViewPropertiesFormValues,
} from './ui/view/ViewSettingsDialog'
import { ProjectManagerDialog } from './ui/device/ProjectManagerDialog'
import {
  TagCreateTab,
  type TagCreateRequest,
  type TagCreateStatus,
  type TagCreateTabHandle,
} from './ui/device/TagCreateTab'
import {
  TagAlarmsTab,
  type TagAlarmStatus,
  type TagAlarmsTabHandle,
} from './ui/device/TagAlarmsTab'
import {
  TagAddTab,
  type TagAddRequest,
  type TagAddStatus,
  type TagAddTabHandle,
} from './ui/device/TagAddTab'
import { PreviewPanel } from './ui/preview/PreviewPanel'
import { FloorPlanLayoutPanel } from './ui/view/FloorPlanLayoutPanel'
import { FloorsTab } from './ui/device/FloorsTab'
import { ViewSidebar } from './ui/view/ViewSidebar'
import { ViewNameDialog } from './ui/view/ViewNameDialog'
import { FloorPlanViewCard } from './ui/view/FloorPlanViewCard'
import { GridSettingsCard } from './ui/view/GridSettingsCard'
import { ManagedComponentCard } from './ui/view/ManagedComponentCard'
import {
  findViewIdsNeedingReapply,
  needsVoiceBridgeUpdate,
  prepareFuxaConfigExport,
} from './domain/config/prepareFuxaConfigExport'
import { createFuxaConfigExportDependencies } from './domain/config/fuxaConfigExportDependencies'
import { buildViewEditorModels } from './domain/views/buildViewEditorModels'
import { deleteView, renameView, validateViewName } from './domain/views/viewManagement'
import {
  getViewBackgroundInputColor,
  updateAllViewBackgrounds,
} from './domain/views/viewBackground'
import {
  getViewTitleLabelSettings,
  updateAllViewTitleLabels,
} from './domain/views/viewTitleLabel'
import { getSiteNameSettings, updateAllSiteNameLabels } from './domain/views/siteNameLabel'
import { navigationNeedsSync } from './domain/views/syncNavigation'
import { buildingFloorButtonsNeedSync } from './domain/buildingFloors/buildingFloorButtons'
import {
  TOOL_SETTINGS_OUTDATED_MESSAGE,
  isToolSettingsOutdated,
} from './domain/config/toolSettings'
import { groupBuildingFloors, parseBuildingFloorName } from './domain/buildingFloors/buildingFloors'
import {
  AUTO_FILLED_TAG_DESCRIPTION,
  buildTagIndex,
  isAutoFilledTag,
  isCoilTag,
} from './domain/tags/index'
import {
  deviceTagsNeedAddressSorting,
} from './domain/devices/deviceTagAddressSort'
import { getIconLibrary } from './domain/icons/iconLibrary'
import type { MultiStateIconSet } from './domain/icons/iconLibrary'
import { generateId } from './domain/ids'
import {
  deleteManagedDevice,
  fillModbusDeviceAddressGaps,
  previewModbusAddressFill,
  saveModbusDevice,
  shiftModbusDeviceTags,
} from './features/devices/manageModbusDevice'
import {
  deleteAllAutoFilledModbusDeviceTags,
  deleteModbusDeviceTag,
  updateModbusDeviceTag,
} from './features/devices/manageDeviceTags'
import type { DeviceTagUpdate } from './features/devices/manageDeviceTags'
import { moveModbusDeviceTags } from './features/devices/moveDeviceTags'
import { groupComponentsByFloor } from './domain/layout/floorLayout'
import { getFloorGroupFrameSettings } from './domain/layout/floorGroupFrame'
import { hasCurrentFloorFrameLayout } from './domain/layout/floorGroupFrame'
import { parseSvg } from './domain/svg/parseSvg'
import { usePreview } from './app/hooks/usePreview'
import { useFuxaHost } from './app/hooks/useFuxaHost'
import { applyTagFloors } from './features/floors/applyTagFloors'
import { updateFloorGroupFrame } from './features/floors/updateFloorGroupFrame'
import { createViewComponents } from './features/tags/createViewComponents'
import { createTagsForDevice } from './features/tags/createTagsForDevice'
import { getNextAvailableAddress } from './domain/tags/batch'
import { createBlankView } from './features/views/createBlankView'
import { createAutoViews } from './features/views/createAutoViews'
import type { AutoViewGroup } from './domain/views/autoViewMapping'
import { readAutoViewMapping } from './domain/views/autoViewMapping'
import { createEmptyViewModel } from './features/views/createViewModel'
import { syncViewTitleText } from './features/views/syncViewTitleText'
import { moveManagedComponent } from './features/views/moveManagedComponent'
import {
  addMultiStateIconState,
  addIconLibraryEntry,
  createIconLibraryExport,
  findIconLibraryUsages,
  findIconLibrarySvgUsages,
  importIconLibrary,
  moveMultiStateIconState,
  removeMultiStateIconState,
  removeIconLibraryEntry,
} from './features/icons/iconLibraryManagement'
import {
  updateComponentGraphic,
} from './features/icons/componentGraphics'
import type { FuxaViewSummary, ParsedFuxaConfig } from './domain/config/types'
import type { ExportViewModel } from './domain/config/prepareFuxaConfigExport'
import type { GeneratedComponent } from './domain/svg/validateGeneratedView'
import type { GridSettings } from './domain/config/types'
import { EditorProvider } from './app/store/EditorProvider'
import { useConfigEdit } from './app/hooks/useConfigEdit'
import './styles/index.css'

const { Content } = Layout
const { Text, Title } = Typography

type ModbusTagFormValues = DeviceTagUpdate

function getSelectedView(
  views: FuxaViewSummary[],
  selectedViewId: string,
): FuxaViewSummary | undefined {
  return views.find((view) => (view.id || view.key) === selectedViewId) ?? views[0]
}

function EditorWorkspace() {
  const {
    editor,
    commitDocumentEdit,
    replaceDocument,
    editView,
    resetEditor,
    undo,
    redo,
  } = useConfigEdit()
  const [viewNameForm] = Form.useForm<{ name: string }>()
  const [deviceManagerForm] = Form.useForm<ModbusDeviceFormValues>()
  const [deviceTagForm] = Form.useForm<ModbusTagFormValues>()
  const [floorFrameForm] = Form.useForm<FloorGroupFrameFormValues>()
  const [viewPropertiesForm] = Form.useForm<ViewPropertiesFormValues>()
  const [messageApi, contextHolder] = message.useMessage()
  const [projectName, setProjectName] = useState('新專案')
  const [selectedViewId, setSelectedViewId] = useState('')
  const [viewDialogMode, setViewDialogMode] = useState<'create' | 'rename' | null>(null)
  const [viewDialogTargetId, setViewDialogTargetId] = useState('')
  const [componentMoveSource, setComponentMoveSource] = useState<{
    viewId: string
    componentKey: string
  } | null>(null)
  const [componentMoveTargetId, setComponentMoveTargetId] = useState('')
  const [batchMoveDialogOpen, setBatchMoveDialogOpen] = useState(false)
  const [batchMoveSelection, setBatchMoveSelection] = useState<Set<string>>(new Set())
  const tagCreateRef = useRef<TagCreateTabHandle>(null)
  const [tagCreateStatus, setTagCreateStatus] = useState<TagCreateStatus>({ specCount: 0, canCreate: false })
  const tagAlarmRef = useRef<TagAlarmsTabHandle>(null)
  const [tagAlarmStatus, setTagAlarmStatus] = useState<TagAlarmStatus>({ selectedCount: 0, canSubmit: false })
  const tagAddRef = useRef<TagAddTabHandle>(null)
  const [tagAddStatus, setTagAddStatus] = useState<TagAddStatus>({ selectedCount: 0 })
  const [tagAddSession, setTagAddSession] = useState(0)
  const [projectManagerTab, setProjectManagerTab] = useState<
    'devices' | 'floors' | 'alarms' | 'tag-create' | 'tag-add'
  >('devices')
  const [floorSession, setFloorSession] = useState(0)
  const [iconLibraryOpen, setIconLibraryOpen] = useState(false)
  const [floorPlanLibraryOpen, setFloorPlanLibraryOpen] = useState(false)
  const [autoViewDialogOpen, setAutoViewDialogOpen] = useState(false)
  const [editingMultiStateIconId, setEditingMultiStateIconId] = useState('')
  const [multiStateAddDrafts, setMultiStateAddDrafts] = useState<
    Record<string, MultiStateIconDraft>
  >({})
  const [deviceManagerOpen, setDeviceManagerOpen] = useState(false)
  const [viewSettingsOpen, setViewSettingsOpen] = useState(false)
  const [viewSettingsTab, setViewSettingsTab] = useState<'floor-frame' | 'view-properties'>('floor-frame')
  const [deviceManagerMode, setDeviceManagerMode] = useState<'create' | 'edit'>('edit')
  const [managedDeviceId, setManagedDeviceId] = useState('')
  const [deviceTagSession, setDeviceTagSession] = useState(0)
  const [deviceAddressShiftStep, setDeviceAddressShiftStep] = useState<number | null>(1)
  const fuxaSync = useFuxaHost({
    messageApi,
    loadProject: (parsed) => {
      replaceWorkspace(parsed)
      const configuredName = parsed.rawConfig.name
      setProjectName(typeof configuredName === 'string' && configuredName.trim()
        ? normalizeProjectName(configuredName)
        : '新專案')
    },
    buildSyncProject: () => {
      const prepared = prepareCurrentExport()
      return prepared ? JSON.parse(prepared.text) as unknown : null
    },
  })
  const [modelErrors, setModelErrors] = useState<Map<string, string>>(new Map())
  const [unsupported, setUnsupported] = useState<Map<string, string[]>>(new Map())
  const [modelWarnings, setModelWarnings] = useState<Map<string, string[]>>(new Map())
  const { models, modifiedViewIds } = editor
  const config = editor.document
  const normalizedProjectName = normalizeProjectName(projectName)
  const projectNameNeedsExport = Boolean(config)
    && config?.rawConfig.name !== normalizedProjectName
  const isDirty = editor.configurationDirty || modifiedViewIds.size > 0 || projectNameNeedsExport

  function replaceWorkspace(parsed: ParsedFuxaConfig) {
    getIconLibrary(parsed.rawConfig)
    const editorModels = buildViewEditorModels(parsed.rawConfig, DOMParser, measureSvgBounds)
    resetEditor(editorModels.models, parsed)
    setModelErrors(editorModels.errors)
    setUnsupported(editorModels.unsupported)
    setModelWarnings(editorModels.warnings)
    setTagAddSession((session) => session + 1)
    const firstView = parsed.views[0]
    setSelectedViewId(firstView ? firstView.id || firstView.key : '')
  }

  const selectedView = useMemo(
    () => config ? getSelectedView(config.views, selectedViewId) : undefined,
    [config, selectedViewId],
  )
  const selectedModel = selectedView ? models.get(selectedView.id) : undefined
  const tags = useMemo(
    () => config ? [...buildTagIndex(config.rawConfig).values()] : [],
    [config],
  )
  const duplicateTagGroups = useMemo(() => buildDuplicateTagGroups(tags), [tags])
  const duplicateTagIds = useMemo(() => new Set(
    duplicateTagGroups.flatMap((group) => group.map((tag) => tag.id)),
  ), [duplicateTagGroups])
  const managedComponentGroups = useMemo(() => {
    if (!selectedModel) return []
    const components = selectedModel.components.filter(
      (component): component is GeneratedComponent => component.managed !== false,
    )
    const componentsByKey = new Map(components.map((component) => [component.key, component]))
    return groupComponentsByFloor(
      components,
      new Map(tags.map((tag) => [tag.id, tag] as const)),
    ).map((group) => ({
      ...group,
      items: group.items.flatMap((component) => {
        const managed = componentsByKey.get(component.key)
        return managed ? [managed] : []
      }),
    }))
  }, [selectedModel, tags])
  const iconLibrary = useMemo(
    () => config ? getIconLibrary(config.rawConfig) : [],
    [config],
  )
  const floorPlanLibrary = useMemo(
    () => config ? getFloorPlanLibrary(config.rawConfig) : {},
    [config],
  )
  const autoViewMapping = useMemo(
    () => config ? readAutoViewMapping(config.rawConfig) : [],
    [config],
  )
  const buildingFloorGroups = useMemo(
    () => groupBuildingFloors(config?.views ?? []),
    [config],
  )
  const editingMultiStateIcon = iconLibrary.find((icon): icon is MultiStateIconSet =>
    icon.type === 'multi-state' && icon.id === editingMultiStateIconId)
  const modbusDevices = useMemo(
    () => config ? readModbusDevices(config.rawConfig.devices) : [],
    [config],
  )
  const managedDevice = modbusDevices.find((device) => device.id === managedDeviceId)
  const managedDeviceTags = useMemo(
    () => managedDevice ? readManagedDeviceTags(managedDevice.record) : [],
    [managedDevice],
  )
  const autoFilledManagedDeviceTags = managedDeviceTags.filter(
    (tag) => tag.description === AUTO_FILLED_TAG_DESCRIPTION,
  )
  const deviceTagMoveTargets = useMemo(() => (
    modbusDevices.filter((device) => device.id !== managedDeviceId && device.id !== '0')
  ), [managedDeviceId, modbusDevices])
  const addressFillState = useMemo(() => {
    if (!config || !managedDevice || deviceManagerMode !== 'edit') return null
    try {
      return { plan: previewModbusAddressFill(config.rawConfig, managedDeviceId) }
    } catch (error) {
      return { error: getErrorMessage(error) }
    }
  }, [config, deviceManagerMode, managedDevice, managedDeviceId])
  const addressFillPlan = addressFillState && 'plan' in addressFillState
    ? addressFillState.plan
    : null
  const addressFillError = addressFillState && 'error' in addressFillState
    ? addressFillState.error
    : null
  const batchableTags = useMemo(() => tags.filter((tag) => !isAutoFilledTag(tag)), [tags])
  const canBatchCreateTags = Boolean(config)
    && !Object.keys(config?.rawConfig.devices ?? {}).every((id) => id === '0')
  const usedTagIds = new Set(selectedModel?.components.map((component) => component.tagId) ?? [])
  const {
    preview,
    realtime: previewRealtime,
    setRealtime: setPreviewRealtime,
    stale: previewStale,
    refresh: handleRefreshPreview,
  } = usePreview({ config, models, selectedView })

  function prepareCurrentExport() {
    if (!config) return null
    const hasFloorFrames = [...models.values()].some((model) =>
      model.components.length > 0 || Object.keys(model.floorFrames).length > 0)
    const floorFrameLayoutNeedsUpdate = !hasCurrentFloorFrameLayout(config.rawConfig)
      && hasFloorFrames
    const exportDirty = isDirty
      || findViewIdsNeedingReapply([...models.values()]).size > 0
      || floorFrameLayoutNeedsUpdate
      || deviceTagsNeedAddressSorting(config.rawConfig)
      || needsVoiceBridgeUpdate(config.rawConfig)
      || navigationNeedsSync(config.rawConfig)
      || buildingFloorButtonsNeedSync(config.rawConfig, DOMParser)
    const dependencies = exportDirty
      ? createFuxaConfigExportDependencies(config.rawConfig, createBrowserSvgDeps())
      : undefined
    return prepareFuxaConfigExport({
        config: config.rawConfig,
        originalText: config.originalText,
        sourceFormat: config.sourceFormat,
        dirty: exportDirty,
        projectName: normalizedProjectName,
        models: [...models.values()],
        modifiedViewIds,
        tags: buildTagIndex(config.rawConfig),
      }, dependencies)
  }

  function handleExportConfig() {
    if (!config) return

    try {
      const prepared = prepareCurrentExport()
      if (!prepared) return
      const blob = new Blob([prepared.text], { type: 'application/json;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = projectFileName(normalizedProjectName)
      link.hidden = true
      document.body.append(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 0)
      let modelsToReset = models
      if (prepared.dirty) {
        const savedModels = new Map<string, ExportViewModel>()
        for (const model of prepared.models) {
          savedModels.set(model.viewId, {
            ...model,
            originalComponents: structuredClone(model.components),
            originalFloorTitleIds: structuredClone(model.floorTitleIds),
            originalFloorFrameIds: structuredClone(model.floorFrameIds),
          })
        }
        modelsToReset = savedModels
      }
      const savedConfig = prepared.dirty
        ? parseUpdatedConfig(prepared.config, config)
        : config
      resetEditor(modelsToReset, savedConfig)
      messageApi.success(prepared.dirty ? '已匯出修改後的配置 JSON。' : '已另存配置 JSON。')
    } catch (error) {
      messageApi.error(`匯出失敗：${getErrorMessage(error)}`)
    }
  }

  function openViewDialog(mode: 'create' | 'rename') {
    if (!config) return
    const targetId = mode === 'rename' ? selectedView?.id ?? '' : ''
    if (mode === 'rename' && !targetId) return
    setViewDialogMode(mode)
    setViewDialogTargetId(targetId)
    viewNameForm.setFieldsValue({
      name: mode === 'rename' ? selectedView?.name ?? '' : '',
    })
  }

  function validateViewNameInput(value: unknown) {
    if (!config) throw new Error('請先載入配置。')
    const validation = validateViewName(
      config.rawConfig.hmi.views,
      value,
      viewDialogMode === 'rename' ? viewDialogTargetId : undefined,
    )
    if (!validation.valid && validation.reason === 'duplicate') {
      throw new Error('此 View 名稱已存在，請使用不同名稱。')
    }
  }

  function handleViewNameSubmit(values: { name: string }) {
    if (!config || !viewDialogMode) return
    const validation = validateViewName(
      config.rawConfig.hmi.views,
      values.name,
      viewDialogMode === 'rename' ? viewDialogTargetId : undefined,
    )
    if (!validation.valid) {
      const message = validation.reason === 'empty'
        ? 'View 名稱不可空白。'
        : validation.reason === 'duplicate'
          ? `View「${values.name.trim()}」已存在，請使用不同名稱。`
          : '找不到要修改的 View。'
      messageApi.error(message)
      return
    }

    try {
      const nextRaw = structuredClone(config.rawConfig)
      const nextModels = new Map(models)
      let selectedId = selectedView ? selectedView.id || selectedView.key : ''
      if (viewDialogMode === 'create') {
        const { view } = createBlankView(
          nextRaw,
          validation.name,
          selectedView?.id ?? '',
          createBrowserSvgDeps(),
        )
        const viewId = view.id
        if (typeof viewId !== 'string') throw new Error('新增 View 缺少有效 ID。')
        nextRaw.hmi.views.push(view)
        nextModels.set(viewId, createEmptyViewModel(nextRaw, viewId))
        selectedId = viewId
      } else {
        const result = renameView(nextRaw.hmi.views, viewDialogTargetId, validation.name)
        if (!result.renamed) throw new Error('找不到要修改的 View。')
        if (!result.changed) {
          setViewDialogMode(null)
          return
        }
        syncViewTitleText(result.view, validation.name, createBrowserSvgDeps())
      }

      commitDocumentEdit(config, nextRaw, nextModels)
      setSelectedViewId(selectedId)
      setViewDialogMode(null)
      messageApi.success(viewDialogMode === 'create'
        ? `已新增空白 View「${validation.name}」。`
        : `已將 View 名稱修改為「${validation.name}」。`)
    } catch (error) {
      const detail = getErrorMessage(error)
      messageApi.error(`View 操作失敗：${detail}`)
    }
  }

  function handleDeleteSelectedView() {
    if (!config || !selectedView || config.views.length <= 1 || !selectedView.id) return

    const previewConfig = structuredClone(config.rawConfig)
    const previewResult = deleteView(previewConfig, selectedView.id)
    if (!previewResult.deleted) {
      messageApi.error(previewResult.reason === 'last-view'
        ? '至少必須保留一個 View。'
        : '找不到要刪除的 View。')
      return
    }
    const fallbackId = previewResult.fallbackView?.id
    if (typeof fallbackId !== 'string' || !fallbackId) {
      messageApi.error('找不到可切換的替代 View。')
      return
    }
    const layout = isRecord(config.rawConfig.hmi.layout)
      ? config.rawConfig.hmi.layout
      : undefined
    const startWasDeleted = layout?.start === selectedView.id
    const referenceCount = previewResult.referenceCount ?? 0
    const referenceMessage = referenceCount > 0
      ? `將自動移除 ${referenceCount - (startWasDeleted ? 1 : 0)} 個導覽引用，${startWasDeleted ? `並將起始頁改為「${previewResult.fallbackView?.name || fallbackId}」。` : ''}`
      : '此 View 沒有導覽引用。'

    Modal.confirm({
      title: `確定刪除「${selectedView.name || selectedView.id}」？`,
      content: `${referenceMessage} 無法還原的 JSON 輸出前仍可使用復原功能。`,
      okText: '刪除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk() {
        try {
          const nextRaw = structuredClone(config.rawConfig)
          const result = deleteView(nextRaw, selectedView.id)
          if (!result.deleted) {
            throw new Error(result.reason === 'last-view'
              ? '至少必須保留一個 View。'
              : '找不到要刪除的 View。')
          }
          const nextModels = new Map(models)
          nextModels.delete(selectedView.id)
          const nextModifiedIds = new Set(modifiedViewIds)
          nextModifiedIds.delete(selectedView.id)
          commitDocumentEdit(config, nextRaw, nextModels, nextModifiedIds)
          setSelectedViewId(fallbackId)
          messageApi.success('已刪除 View，並處理其起始頁／導覽引用。')
        } catch (error) {
          const detail = getErrorMessage(error)
          messageApi.error(`刪除 View 失敗：${detail}`)
        }
      },
    })
  }

  function handleApplyAutoViews(groups: AutoViewGroup[], options: AutoViewApplyOptions) {
    if (!config) return

    try {
      const result = createAutoViews(config.rawConfig, {
        groups,
        tags,
        includeAutoFilled: options.includeAutoFilled,
        coilSwitchEnabled: options.coilSwitchEnabled,
      }, createBrowserSvgDeps())
      const nextModifiedViewIds = new Set(result.viewIds)
      commitDocumentEdit(config, result.config, result.models, nextModifiedViewIds)
      setSelectedViewId(result.viewIds[0] ?? '')
      setAutoViewDialogOpen(false)

      if (result.addedTagCount === 0) {
        messageApi.success(`沒有可加入的 Tag，已建立 ${result.viewIds.length} 個空白 View。`)
        return
      }
      const skippedMessage = result.skippedTagCount > 0
        ? `，並排除 ${result.skippedTagCount} 筆自動補位 Tag`
        : ''
      messageApi.success(
        `已清除舊 View，建立 ${result.viewIds.length} 個 View，加入 ${result.addedTagCount} 個 Tag 元件${skippedMessage}。`,
      )
    } catch (error) {
      messageApi.error(`一鍵配置失敗：${getErrorMessage(error)}`)
    }
  }

  function handleRemoveComponent(viewId: string, key: string) {
    const model = models.get(viewId)
    if (!model) return
    const component = model.components.find((item) => item.key === key)
    if (!component || component.managed === false) return
    editView(viewId, {
      ...model,
      components: model.components.filter((item) => item.key !== key),
    })
  }

  function handleMoveComponent(viewId: string, key: string, direction: -1 | 1) {
    const model = models.get(viewId)
    if (!model) return
    const nextComponents = moveManagedComponent(
      model.components,
      key,
      direction,
      new Map(tags.map((tag) => [tag.id, tag] as const)),
    )
    if (nextComponents.every((component, index) => component === model.components[index])) return
    editView(viewId, { ...model, components: nextComponents })
  }

  function openComponentMoveDialog(viewId: string, componentKey: string) {
    const targetView = config
      ? findEditableTargetView(config.views, viewId, models)
      : undefined
    if (!targetView) {
      messageApi.info('沒有其他可編輯的 View 可移動元件。')
      return
    }
    setComponentMoveSource({ viewId, componentKey })
    setComponentMoveTargetId(targetView.id || targetView.key)
  }

  function openBatchMoveDialog(viewId: string) {
    const targetView = config
      ? findEditableTargetView(config.views, viewId, models)
      : undefined
    if (!targetView) {
      messageApi.info('沒有其他可編輯的 View 可移動元件。')
      return
    }
    setBatchMoveSelection(new Set())
    setComponentMoveTargetId(targetView.id || targetView.key)
    setBatchMoveDialogOpen(true)
  }

  function moveComponentsToView(
    sourceViewId: string,
    componentKeys: readonly string[],
    targetViewId: string,
  ): boolean {
    if (!config || !componentKeys.length || !targetViewId) return false
    const plan = planComponentsMove({
      models,
      modifiedViewIds,
      sourceViewId,
      componentKeys,
      targetViewId,
      randomValues: window.crypto,
    })
    if (!plan.ok) {
      messageApi.error(plan.error)
      return false
    }
    replaceDocument(config, plan.models, plan.modifiedViewIds)
    setSelectedViewId(targetViewId)
    const targetName = config.views.find((view) =>
      (view.id || view.key) === targetViewId)?.name || targetViewId
    messageApi.success(`已將 ${plan.movedCount} 個元件移動至 View「${targetName}」。`)
    return true
  }

  function handleMoveComponentToView() {
    if (!config || !componentMoveSource || !componentMoveTargetId) return
    const { viewId: sourceViewId, componentKey } = componentMoveSource
    const component = models.get(sourceViewId)?.components.find((item) =>
      item.key === componentKey && item.managed !== false)
    if (!component) {
      messageApi.error('找不到要移動的受管理元件。')
      return
    }
    if (moveComponentsToView(sourceViewId, [componentKey], componentMoveTargetId)) {
      setComponentMoveSource(null)
      setComponentMoveTargetId('')
    }
  }

  function handleUpdateComponent(
    viewId: string,
    key: string,
    update: Partial<Pick<
      GeneratedComponent,
      | 'label' | 'tagId' | 'palette' | 'template' | 'iconId'
      | 'normalIconId' | 'alarmIconId' | 'alarmShapeId' | 'invertIconState'
      | 'multiIconSetId' | 'multiStateBindings'
    >>,
  ) {
    const model = models.get(viewId)
    if (!model) return
    const component = model.components.find((item) => item.key === key)
    if (!component || component.managed === false) return
    if (component.template === 'switch' && update.tagId) {
      const tag = tags.find((candidate) => candidate.id === update.tagId)
      if (!tag || !isCoilTag(tag)
          || !['bool', 'boolean'].includes(tag.type.toLocaleLowerCase())) {
        messageApi.warning('Switch 只能綁定 Boolean Coil Tag。')
        return
      }
    }

    editView(viewId, {
      ...model,
      components: model.components.map((item) => (
        item.key === key ? { ...item, ...update } : item
      )),
    })
  }

  function handleUpdateGraphic(viewId: string, component: GeneratedComponent, value: string) {
    const model = models.get(viewId)
    if (!model || !config) return
    try {
      if (value.startsWith('pair:')
          && !['bool', 'boolean'].includes(
            tags.find((tag) => tag.id === component.tagId)?.type.toLocaleLowerCase() ?? '',
          )) {
        messageApi.warning('正常／告警圖示組需要綁定 Boolean Tag，請先變更 Tag 型別。')
        return
      }
      if (value.startsWith('multi:')
          && !['bool', 'boolean'].includes(
            tags.find((tag) => tag.id === component.tagId)?.type.toLocaleLowerCase() ?? '',
          )) {
        messageApi.warning('多狀態圖示組需要 Boolean Tag，請先選擇 Boolean Tag。')
        return
      }
      const usedIds = new Set(buildTagIndex(config.rawConfig).keys())
      for (const view of config.rawConfig.hmi.views) {
        if (!isRecord(view)) continue
        if (isRecord(view.items)) Object.keys(view.items).forEach((id) => usedIds.add(id))
        if (typeof view.svgcontent === 'string') {
          const doc = parseSvg(view.svgcontent, DOMParser)
          for (const node of Array.from(doc.getElementsByTagName('*'))) {
            const id = node.getAttribute('id')
            if (id) usedIds.add(id)
          }
        }
      }
      for (const currentModel of models.values()) {
        for (const item of currentModel.components) {
          if (item.shapeId) usedIds.add(item.shapeId)
          if (item.labelId) usedIds.add(item.labelId)
          if (item.alarmShapeId) usedIds.add(item.alarmShapeId)
          for (const binding of item.multiStateBindings ?? []) {
            if (binding.shapeId) usedIds.add(binding.shapeId)
          }
        }
      }
      const updated = updateComponentGraphic(
        component,
        value,
        iconLibrary,
        () => generateId('SHE', usedIds, window.crypto),
      )
      if (updated === component
          || (updated.template === component.template
            && updated.iconId === component.iconId
            && updated.normalIconId === component.normalIconId
            && updated.alarmIconId === component.alarmIconId
            && updated.multiIconSetId === component.multiIconSetId
            && JSON.stringify(updated.multiStateBindings) ===
              JSON.stringify(component.multiStateBindings))) return
      editView(viewId, {
        ...model,
        components: model.components.map((item) => (
          item.key === component.key ? updated : item
        )),
      })
    } catch (error) {
      messageApi.error(`更新元件圖形失敗：${getErrorMessage(error)}`)
    }
  }

  function handleUpdateMultiStateBinding(
    viewId: string,
    component: GeneratedComponent,
    stateKey: string,
    tagId: string,
  ) {
    const bindings = component.multiStateBindings ?? []
    const binding = bindings.find((candidate) => candidate.stateKey === stateKey)
    if (!binding) return
    const selectedTag = tags.find((tag) => tag.id === tagId)
    if (tagId && (!selectedTag || !['bool', 'boolean'].includes(
      selectedTag.type.toLocaleLowerCase(),
    ))) {
      messageApi.warning('多狀態規則只能綁定 Boolean Tag。')
      return
    }
    if (tagId && bindings.some(
      (candidate) => candidate.stateKey !== stateKey && candidate.tagId === tagId,
    )) {
      messageApi.warning('同一元件的多個狀態不能重複使用相同的 Tag。')
      return
    }
    const nextBindings = bindings.map((candidate) => (
      candidate.stateKey === stateKey ? { ...candidate, tagId } : candidate
    ))
    handleUpdateComponent(viewId, component.key, {
      multiStateBindings: nextBindings,
      tagId: nextBindings[0]?.tagId ?? '',
    })
  }

  function handleUpdateGrid(
    viewId: string,
    update: Partial<GridSettings>,
  ) {
    const model = models.get(viewId)
    if (!model) return
    editView(viewId, {
      ...model,
      grid: { ...model.grid, ...update },
    })
  }

  function handleUpdateFloorPlan(viewId: string, floorPlan: boolean) {
    const model = models.get(viewId)
    if (!model) return
    editView(viewId, { ...model, floorPlan })
  }

  function handleMoveFloorTag(viewId: string, tagId: string, dx: number, dy: number) {
    const model = models.get(viewId)
    if (!model) return
    const offsets = model.floorPlanTagOffsets ?? {}
    const current = offsets[tagId] ?? { dx: 0, dy: 0 }
    editView(viewId, {
      ...model,
      floorPlanTagOffsets: {
        ...offsets,
        [tagId]: {
          dx: Math.round((current.dx + dx) * 10) / 10,
          dy: Math.round((current.dy + dy) * 10) / 10,
        },
      },
    })
  }

  function openBatchAddTab() {
    setTagAddSession((session) => session + 1)
    setProjectManagerTab('tag-add')
    setDeviceManagerOpen(true)
  }

  const deviceIdsForTagCreate = config
    ? Object.keys(config.rawConfig.devices).filter((id) => id !== '0')
    : []
  const tagCreateDefaultDeviceId = deviceIdsForTagCreate.includes(managedDeviceId)
    ? managedDeviceId
    : deviceIdsForTagCreate[0] ?? ''

  function openTagCreateTab() {
    if (!config) return
    setProjectManagerTab('tag-create')
    setDeviceManagerOpen(true)
  }

  function handleCreateTags(request: TagCreateRequest): number | null {
    if (!config) return null
    const { deviceId, memaddress, specs, alsoAddView } = request
    const device = config.rawConfig.devices[deviceId]
    const deviceName = isRecord(device) && typeof device.name === 'string' ? device.name : ''

    try {
      const result = createTagsForDevice(
        config.rawConfig,
        deviceId,
        specs,
        window.crypto,
      )
      const document = parseUpdatedConfig(result.config, config)
      const nextModels = new Map(models)
      let addedToViewCount = 0
      if (alsoAddView && selectedView && selectedModel) {
        const createdIds = new Set(result.created.map((tag) => tag.id))
        const createdTags = [...buildTagIndex(result.config).values()]
          .filter((tag) => createdIds.has(tag.id))
        const coilSwitchTagIds = new Set(createdTags
          .filter((tag) => isCoilTag(tag)
            && ['bool', 'boolean'].includes(tag.type.toLocaleLowerCase()))
          .map((tag) => tag.id))
        nextModels.set(selectedView.id, createViewComponents(
          result.config,
          selectedModel,
          nextModels,
          createdTags,
          { Parser: DOMParser, crypto: window.crypto },
          'rect',
          [],
          coilSwitchTagIds,
        ))
        addedToViewCount = createdTags.length
      }
      replaceDocument(document, nextModels)
      const autoFillMessage = result.autoFilled.length
        ? `，並自動補齊 ${result.autoFilled.length} 個地址`
        : ''
      const viewMessage = addedToViewCount
        ? `，並加入目前 View ${addedToViewCount} 個元件`
        : ''
      messageApi.success(
        `已為設備「${deviceName || deviceId}」批次建立 ${result.created.length} 個 Tag${autoFillMessage}${viewMessage}。`,
      )
      return getNextAvailableAddress(result.config.devices[deviceId], memaddress)
    } catch (error) {
      const detail = getErrorMessage(error)
      messageApi.error(`批次建立 Tag 失敗：${detail}`)
      return null
    }
  }

  function handleBatchAdd({ tagIds, graphic, coilSwitchEnabled }: TagAddRequest) {
    if (!config || !selectedView || !selectedModel) return
    const selectedTags = tags.filter((tag) => tagIds.has(tag.id))
    const selectedCoilTags = selectedTags.filter(isCoilTag)
    const selectedCoilSwitchTags = selectedCoilTags.filter((tag) =>
      ['bool', 'boolean'].includes(tag.type.toLocaleLowerCase()))
    if (!selectedTags.length) {
      messageApi.warning('請至少選取一個 Tag。')
      return
    }
    if (graphic.startsWith('multi:')
        && selectedTags.some((tag) => !['bool', 'boolean'].includes(tag.type.toLocaleLowerCase()))) {
      messageApi.warning('多狀態圖示組只能套用至 Boolean Tag；請調整選取的 Tag。')
      return
    }
    if (coilSwitchEnabled
        && selectedCoilTags.some((tag) =>
          !['bool', 'boolean'].includes(tag.type.toLocaleLowerCase()))) {
      messageApi.warning('Coil Switch 需要 Boolean Tag；請取消選取型別不符的 Coil Tag，或關閉 Coil Switch 選項。')
      return
    }

    try {
      const switchTagIds = coilSwitchEnabled
        ? new Set(selectedCoilSwitchTags.map((tag) => tag.id))
        : new Set<string>()
      const nextModels = createViewComponents(
        config.rawConfig,
        selectedModel,
        models,
        selectedTags,
        { Parser: DOMParser, crypto: window.crypto },
        graphic,
        iconLibrary,
        switchTagIds,
      )
      editView(selectedView.id, nextModels)
      setDeviceManagerOpen(false)
      messageApi.success(`已加入 ${selectedTags.length} 筆 Tag 元件。`)
    } catch (error) {
      const detail = getErrorMessage(error)
      messageApi.error(`批次加入 Tag 失敗：${detail}`)
    }
  }

  function openDeviceManager() {
    setProjectManagerTab('devices')
    setDeviceTagSession((value) => value + 1)
    setFloorSession((value) => value + 1)
    const firstDevice = modbusDevices[0]
    if (firstDevice) {
      setDeviceManagerMode('edit')
      setManagedDeviceId(firstDevice.id)
      deviceManagerForm.setFieldsValue(readDeviceFormValues(firstDevice.record))
    } else {
      setDeviceManagerMode('create')
      setManagedDeviceId('')
      deviceManagerForm.setFieldsValue({
        name: '',
        address: '127.0.0.1:502',
        addressCount: 0,
        slaveid: 1,
        enabled: true,
        polling: 200,
      })
    }
    setDeviceManagerOpen(true)
  }

  function selectManagedDevice(deviceId: string) {
    const device = modbusDevices.find((candidate) => candidate.id === deviceId)
    if (!device) return
    setDeviceManagerMode('edit')
    setManagedDeviceId(device.id)
    setDeviceTagSession((value) => value + 1)
    deviceManagerForm.setFieldsValue(readDeviceFormValues(device.record))
  }

  function openDeviceTagEditor(tagId: string): boolean {
    const tag = managedDeviceTags.find((candidate) => candidate.id === tagId)
    if (!tag) {
      messageApi.error('找不到要修改的 Tag。')
      return false
    }
    const address = Number(tag.address)
    deviceTagForm.setFieldsValue({
      name: tag.name,
      address: Number.isSafeInteger(address) && address >= 0 && address <= 65535
        ? address
        : undefined,
      type: tag.type || 'Bool',
      memaddress: tag.memaddress,
      description: tag.description,
      floor: tag.floor,
    })
    return true
  }

  function handleUpdateDeviceTag(values: ModbusTagFormValues, tagId: string): boolean {
    if (!config) return false
    try {
      const nextConfig = updateModbusDeviceTag(
        config.rawConfig,
        managedDeviceId,
        tagId,
        values,
      )
      commitDocumentEdit(config, nextConfig)
      messageApi.success(`已更新 Tag「${values.name.trim()}」。`)
      return true
    } catch (error) {
      const detail = getErrorMessage(error)
      messageApi.error(`Tag 更新失敗：${detail}`)
      return false
    }
  }

  function handleMoveDeviceTags(targetId: string, tagIds: string[]): boolean {
    if (!config || !managedDevice) return false
    if (!targetId) {
      messageApi.error('請選擇目標設備。')
      return false
    }
    try {
      const { config: nextConfig, moved, renamed } = moveModbusDeviceTags(
        config.rawConfig,
        managedDeviceId,
        targetId,
        tagIds,
      )
      commitDocumentEdit(config, nextConfig)
      const renameNote = renamed.length ? `，其中 ${renamed.length} 個因名稱重複已自動改名` : ''
      messageApi.success(`已移動 ${moved} 個 Tag${renameNote}。`)
      return true
    } catch (error) {
      const detail = getErrorMessage(error)
      messageApi.error(`Tag 移動失敗：${detail}`)
      return false
    }
  }

  function handleDeleteDeviceTag(tagId: string) {
    if (!config || !managedDevice) return
    const referencedModels = findTagReferences(models, new Set([tagId]))
    const readonlyReferences = referencedModels.flatMap(({ viewId, components }) => {
      const count = components.filter((component) => component.managed === false).length
      if (!count) return []
      const view = config.views.find((candidate) => candidate.id === viewId)
      return [`${view?.name || viewId} (${count} 個唯讀元件)`]
    })
    if (readonlyReferences.length) {
      messageApi.error(
        `無法刪除此 Tag：以下 View 有無法安全修改的唯讀元件引用：${readonlyReferences.join('、')}`,
      )
      return
    }

    const managedReferenceCount = referencedModels.reduce(
      (count, entry) => count + entry.components.length,
      0,
    )
    const tag = managedDeviceTags.find((candidate) => candidate.id === tagId)
    Modal.confirm({
      title: `確定刪除 Tag「${tag?.name || tagId}」？`,
      content: managedReferenceCount
        ? `此 Tag 被 ${managedReferenceCount} 個受管理元件使用；刪除時會一併移除這些元件。`
        : '此操作無法復原。',
      okText: '刪除 Tag',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk() {
        try {
          const nextConfig = deleteModbusDeviceTag(config.rawConfig, managedDeviceId, tagId)
          const nextModels = new Map(models)
          for (const { viewId, model, components } of referencedModels) {
            const removeKeys = new Set(components.map((component) => component.key))
            nextModels.set(viewId, {
              ...model,
              components: model.components.filter((component) => !removeKeys.has(component.key)),
            })
          }
          commitDocumentEdit(config, nextConfig, nextModels)
          messageApi.success(
            `已刪除 Tag「${tag?.name || tagId}」。`
            + (managedReferenceCount ? `並移除 ${managedReferenceCount} 個相關元件。` : ''),
          )
        } catch (error) {
          const detail = getErrorMessage(error)
          messageApi.error(`Tag 刪除失敗：${detail}`)
        }
      },
    })
  }

  function handleDeleteAutoFilledDeviceTags() {
    if (!config || !managedDevice || !autoFilledManagedDeviceTags.length) return
    const autoFilledTagIds = new Set(autoFilledManagedDeviceTags.map((tag) => tag.id))
    const referencedModels = findTagReferences(models, autoFilledTagIds)
    const readonlyReferences = referencedModels.flatMap(({ viewId, components }) => {
      const count = components.filter((component) => component.managed === false).length
      if (!count) return []
      const view = config.views.find((candidate) => candidate.id === viewId)
      return [`${view?.name || viewId} (${count} 個唯讀元件)`]
    })
    if (readonlyReferences.length) {
      messageApi.error(
        `無法移除補位 Tag：以下 View 有無法安全修改的唯讀元件引用：${readonlyReferences.join('、')}`,
      )
      return
    }

    const managedReferenceCount = referencedModels.reduce(
      (count, entry) => count + entry.components.length,
      0,
    )
    Modal.confirm({
      title: `確定移除設備「${managedDevice.record.name || managedDeviceId}」的所有補位 Tag？`,
      content: managedReferenceCount
        ? `將移除 ${autoFilledManagedDeviceTags.length} 個補位 Tag，並一併移除 ${managedReferenceCount} 個引用它們的受管理元件。此操作無法復原。`
        : `將移除 ${autoFilledManagedDeviceTags.length} 個補位 Tag。此操作無法復原。`,
      okText: '移除補位 Tag',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk() {
        try {
          const result = deleteAllAutoFilledModbusDeviceTags(config.rawConfig, managedDeviceId)
          const nextModels = new Map(models)
          for (const { viewId, model, components } of referencedModels) {
            const removeKeys = new Set(components.map((component) => component.key))
            nextModels.set(viewId, {
              ...model,
              components: model.components.filter((component) => !removeKeys.has(component.key)),
            })
          }
          commitDocumentEdit(config, result.config, nextModels)
          messageApi.success(
            `已移除 ${result.deletedTagIds.length} 個補位 Tag。`
            + (managedReferenceCount ? `並移除 ${managedReferenceCount} 個相關元件。` : ''),
          )
        } catch (error) {
          const detail = getErrorMessage(error)
          messageApi.error(`補位 Tag 移除失敗：${detail}`)
        }
      },
    })
  }

  function startCreateModbusDevice() {
    setDeviceManagerMode('create')
    setManagedDeviceId('')
    deviceManagerForm.setFieldsValue({
      name: '',
      address: '127.0.0.1:502',
      addressCount: 0,
      slaveid: 1,
      enabled: true,
      polling: 200,
    })
  }

  function handleModbusDeviceSave(values: ModbusDeviceFormValues) {
    if (!config) return
    try {
      const result = saveModbusDevice(
        config.rawConfig,
        deviceManagerMode === 'create' ? '' : managedDeviceId,
        values,
        window.crypto,
      )
      const document = parseUpdatedConfig(result.config, config)
      replaceDocument(document, models)
      setManagedDeviceId(result.deviceId)
      setDeviceManagerMode('edit')
      deviceManagerForm.setFieldsValue(values)
      messageApi.success(result.created
        ? `已建立設備「${values.name.trim()}」。`
        : `已更新設備「${values.name.trim()}」。`)
      if (result.fill.created.length) {
        messageApi.success(
          `已自動建立 ${result.fill.created.length} 個補位 Tag（${result.fill.startAddress}–${result.fill.endAddress}）。`,
        )
      }
    } catch (error) {
      const detail = getErrorMessage(error)
      messageApi.error(`設備儲存失敗：${detail}`)
    }
  }

  function handleShiftDeviceAddresses(direction: 1 | -1) {
    if (!config || !managedDevice) return
    if (!deviceAddressShiftStep || !Number.isSafeInteger(deviceAddressShiftStep) || deviceAddressShiftStep < 1) {
      messageApi.error('調整數值必須是大於 0 的整數。')
      return
    }
    const delta = direction * deviceAddressShiftStep
    try {
      const shifted = shiftModbusDeviceTags(config.rawConfig, managedDeviceId, delta)
      if (!shifted.count) {
        messageApi.info(shifted.skippedInvalid
          ? `沒有可調整的有效數字 address；另有 ${shifted.skippedInvalid} 個無效 address 保持不變。`
          : '此設備沒有可調整的數字 address。')
        return
      }
      const deltaLabel = delta > 0 ? `+${delta}` : String(delta)
      if (!window.confirm(
        `確定將設備「${managedDevice.record.name || managedDeviceId}」的 ${shifted.count} 個 Tag address 全部 ${deltaLabel}？\n此操作跨所有 memaddress 區段；沒有 address 的 Tag 不變。`,
      )) return
      commitDocumentEdit(config, shifted.config)
      messageApi.success(
        `已調整 ${shifted.count} 個 Tag address。`
        + (shifted.skippedInvalid ? ` ${shifted.skippedInvalid} 個無效 address 未變更。` : ''),
      )
    } catch (error) {
      const detail = getErrorMessage(error)
      messageApi.error(`位址調整已取消：${detail}`)
    }
  }

  function handleFillDeviceAddresses() {
    if (!config || !managedDevice) return
    try {
      const plan = previewModbusAddressFill(config.rawConfig, managedDeviceId)
      if (!plan.hasAnchor) {
        messageApi.warning('目前沒有可作為起點的 Tag；新增第一個 Tag 後才能自動補位。')
        return
      }
      if (!plan.missing.length) {
        messageApi.info('指定範圍內沒有缺漏位址。')
        return
      }
      if (!window.confirm(
        `將在 ${plan.memaddress} 位址區段建立 ${plan.missing.length} 個補位 Tag（${plan.startAddress}–${plan.endAddress}），確定繼續？`,
      )) return
      const result = fillModbusDeviceAddressGaps(config.rawConfig, managedDeviceId, window.crypto)
      commitDocumentEdit(config, result.config)
      messageApi.success(`已建立 ${result.fill.created.length} 個補位 Tag。`)
    } catch (error) {
      const detail = getErrorMessage(error)
      messageApi.error(`Modbus 位址補位失敗：${detail}`)
    }
  }

  function handleDeleteManagedDevice() {
    if (!config || !managedDevice || managedDeviceId === '0') return
    const linkedViews: string[] = []
    for (const [viewId, model] of models) {
      const view = config.views.find((candidate) => candidate.id === viewId)
      const count = model.components.filter((component) => {
        const tag = tags.find((candidate) => candidate.id === component.tagId)
        return tag?.deviceId === managedDeviceId
      }).length
      if (count) linkedViews.push(`View「${view?.name || viewId}」(${count} 個元件)`)
    }
    const warning = linkedViews.length
      ? `\n\n以下 View 使用此設備的 Tag，刪除後會留下無效 Tag 參照：\n${linkedViews.join('\n')}`
      : ''
    if (!window.confirm(
      `確定刪除設備「${managedDevice.record.name || managedDeviceId}」及其所有 Tag 嗎？${warning}`,
    )) return
    try {
      const nextConfig = deleteManagedDevice(config.rawConfig, managedDeviceId)
      const document = parseUpdatedConfig(nextConfig, config)
      replaceDocument(document, models)
      const fallback = modbusDevices.find((candidate) => candidate.id !== managedDeviceId)
      if (fallback) selectManagedDevice(fallback.id)
      else {
        setDeviceManagerMode('create')
        setManagedDeviceId('')
        deviceManagerForm.setFieldsValue({
          name: '',
          address: '127.0.0.1:502',
          addressCount: 0,
          slaveid: 1,
          enabled: true,
          polling: 200,
        })
      }
      messageApi.success('已刪除設備及其系統連線 Tag。')
    } catch (error) {
      const detail = getErrorMessage(error)
      messageApi.error(`設備刪除失敗：${detail}`)
    }
  }

  function applyFloorChange(tagIds: readonly string[], value: string) {
    if (!config || !tagIds.length) return
    try {
      const result = applyTagFloors(config.rawConfig, tagIds, value)
      if (!result.changedCount) {
        messageApi.info('選取的 Tag 群組沒有變更。')
        return
      }
      commitDocumentEdit(config, result.config)
      messageApi.success(`已更新 ${result.changedCount} 個 Tag 的群組。`)
    } catch (error) {
      const detail = getErrorMessage(error)
      messageApi.error(`更新 Tag 群組失敗：${detail}`)
    }
  }

  function openFloorFrameDialog() {
    if (!config) return
    const settings = getFloorGroupFrameSettings(config.rawConfig)
    floorFrameForm.setFieldsValue({
      ...settings,
      fillOpacityPercent: Math.round(settings.fillOpacity * 100),
    })
    const selected = getSelectedView(config.views, selectedViewId)
    const index = selected ? config.views.indexOf(selected) : 0
    try {
      const titleStyle = getViewTitleLabelSettings(
        config.rawConfig,
        selected?.id,
        DOMParser,
      )
      const siteSettings = getSiteNameSettings(config.rawConfig)
      viewPropertiesForm.setFieldsValue({
        bkcolor: getViewBackgroundInputColor(config.rawConfig, Math.max(index, 0)),
        viewTitleColor: titleStyle.color,
        viewTitleFontSize: titleStyle.fontSize,
        siteName: siteSettings.name,
        siteColor: siteSettings.color,
        siteFontSize: siteSettings.fontSize,
        siteBold: siteSettings.bold,
        siteItalic: siteSettings.italic,
        siteUnderline: siteSettings.underline,
      })
    } catch (error) {
      messageApi.error(`讀取 View 屬性失敗：${getErrorMessage(error)}`)
    }
    setViewSettingsTab('floor-frame')
    setViewSettingsOpen(true)
  }

  function handleFloorFrameSubmit(values: FloorGroupFrameFormValues) {
    if (!config) return
    try {
      const result = updateFloorGroupFrame(config.rawConfig, {
        ...values,
        fillOpacity: values.fillOpacityPercent / 100,
      })
      if (!result.changed) {
        setViewSettingsOpen(false)
        messageApi.info('群組底框設定沒有變更。')
        return
      }
      const updatedFrame = getFloorGroupFrameSettings(result.config)
      const nextModels = new Map(
        [...models].map(([viewId, model]) => [
          viewId,
          { ...model, floorGroupFrame: updatedFrame },
        ]),
      )
      commitDocumentEdit(config, result.config, nextModels)
      setViewSettingsOpen(false)
      messageApi.success('已更新所有 View 的群組底框設定。')
    } catch (error) {
      messageApi.error(`更新群組底框設定失敗：${getErrorMessage(error)}`)
    }
  }

  function handleViewPropertiesSubmit(values: ViewPropertiesFormValues) {
    if (!config) return
    try {
      const backgroundResult = updateAllViewBackgrounds(config.rawConfig, values.bkcolor)
      const titleResult = updateAllViewTitleLabels(
        backgroundResult.config,
        { color: values.viewTitleColor, fontSize: values.viewTitleFontSize },
        DOMParser,
        (doc) => new XMLSerializer().serializeToString(doc),
      )
      const siteResult = updateAllSiteNameLabels(
        titleResult.config,
        {
          name: values.siteName ?? '',
          color: values.siteColor,
          fontSize: values.siteFontSize,
          bold: values.siteBold,
          italic: values.siteItalic,
          underline: values.siteUnderline,
        },
        createBrowserSvgDeps(),
      )
      if (!backgroundResult.changed && !titleResult.changed && !siteResult.changed) {
        setViewSettingsOpen(false)
        messageApi.info('View 屬性沒有變更。')
        return
      }
      commitDocumentEdit(config, siteResult.config)
      setViewSettingsOpen(false)
      messageApi.success('已更新所有 View 的背景色與名稱標籤樣式。')
    } catch (error) {
      messageApi.error(`更新 View 屬性失敗：${getErrorMessage(error)}`)
    }
  }

  async function handleAddIcon(draft: IconAddDraft): Promise<boolean> {
    if (!config) return false
    try {
      const stateNames = draft.type === 'multi-state'
        ? draft.multiStateDrafts.map((state) => state.name.trim())
        : []
      const files = draft.type === 'single'
        ? draft.singleFile ? [draft.singleFile] : []
        : draft.type === 'pair'
          ? [draft.normalFile, draft.alarmFile].filter((file): file is File => file !== null)
          : [draft.normalFile, ...draft.multiStateDrafts.map((state) => state.file)]
            .filter((file): file is File => file !== null)
      const images = await Promise.all(files.map(async (file) => (
        new Uint8Array(await file.arrayBuffer())
      )))
      const nextConfig = addIconLibraryEntry(
        config.rawConfig,
        draft.name,
        draft.type,
        images,
        window.crypto,
        stateNames,
      )
      commitDocumentEdit(config, nextConfig)
      messageApi.success('已新增圖示。')
      return true
    } catch (error) {
      messageApi.error(`新增圖示失敗：${getErrorMessage(error)}`)
      return false
    }
  }

  function commitFloorPlanLibrary(nextLibrary: FloorPlanLibrary, floorKey: string) {
    if (!config) return
    const nextConfig = structuredClone(config.rawConfig)
    saveFloorPlanLibrary(nextConfig, nextLibrary)
    // Plan changes are not auto-detected by export, so mark every plan view on this floor for re-apply.
    const affectedIds = new Set(modifiedViewIds)
    for (const view of config.views) {
      if (floorPlanKeyForView(view.name) === floorKey && models.get(view.id)?.floorPlan === true) {
        affectedIds.add(view.id)
      }
    }
    commitDocumentEdit(config, nextConfig, undefined, affectedIds)
  }

  async function handleSetFloorPlan(floorKey: string, file: File): Promise<boolean> {
    if (!config) return false
    try {
      if (file.type !== 'image/png') throw new Error('平面圖只接受 PNG 圖片。')
      const image = createFloorPlanImage(
        createFloorPlanDataUrl(new Uint8Array(await file.arrayBuffer())),
      )
      commitFloorPlanLibrary({ ...floorPlanLibrary, [floorKey]: image }, floorKey)
      messageApi.success('已更新平面圖。')
      return true
    } catch (error) {
      messageApi.error(`設定平面圖失敗：${getErrorMessage(error)}`)
      return false
    }
  }

  function handleRemoveFloorPlan(floorKey: string) {
    const nextLibrary = { ...floorPlanLibrary }
    delete nextLibrary[floorKey]
    commitFloorPlanLibrary(nextLibrary, floorKey)
    messageApi.success('已移除平面圖。')
  }

  function handleExportIconLibrary() {
    try {
      const contents = `${JSON.stringify(createIconLibraryExport(iconLibrary), null, 2)}\n`
      const blob = new Blob([contents], { type: 'application/json;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = '圖示庫.json'
      link.hidden = true
      document.body.append(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 0)
      messageApi.success('已匯出圖示庫 JSON。')
    } catch (error) {
      messageApi.error(`圖示庫匯出失敗：${getErrorMessage(error)}`)
    }
  }

  async function handleImportIconLibrary(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file || !config) return
    try {
      const input: unknown = JSON.parse(await file.text())
      const nextConfig = importIconLibrary(config.rawConfig, input)
      const importedCount = getIconLibrary(nextConfig).length - iconLibrary.length
      commitDocumentEdit(config, nextConfig)
      messageApi.success(`已匯入 ${importedCount} 個圖示。`)
    } catch (error) {
      messageApi.error(`圖示庫匯入失敗：${getErrorMessage(error)}`)
    }
  }

  function handleRemoveIcon(iconId: string) {
    if (!config) return
    try {
      const viewNames = new Map(config.views.map((view) => [view.id, view.name]))
      const tagNames = new Map(tags.map((tag) => [tag.id, tag.name]))
      const usages = [
        ...findIconLibraryUsages(iconLibrary, models, viewNames, tagNames, iconId),
        ...findIconLibrarySvgUsages(iconLibrary, config.rawConfig, iconId, DOMParser),
      ]
      if (usages.length) {
        messageApi.error(`此圖示仍被使用，無法刪除：${usages.join('、')}`)
        return
      }
      if (!window.confirm('確定刪除此圖示？此操作可使用「復原」還原。')) return
      const nextConfig = removeIconLibraryEntry(config.rawConfig, iconId, usages)
      commitDocumentEdit(config, nextConfig)
      messageApi.success('已刪除圖示。')
    } catch (error) {
      messageApi.error(`刪除圖示失敗：${getErrorMessage(error)}`)
    }
  }

  function handleMoveMultiStateIconState(
    iconSetId: string,
    stateKey: string,
    direction: -1 | 1,
  ) {
    if (!config) return
    try {
      const nextConfig = moveMultiStateIconState(config.rawConfig, iconSetId, stateKey, direction)
      const nextIcon = getIconLibrary(nextConfig).find((icon) =>
        icon.type === 'multi-state' && icon.id === iconSetId)
      if (!nextIcon || nextIcon.type !== 'multi-state') {
        throw new Error('找不到更新後的多狀態圖示組。')
      }
      const modifiedIds = new Set(modifiedViewIds)
      const nextModels = new Map<string, ExportViewModel>()
      for (const [viewId, model] of models) {
        const hasSet = model.components.some((component) =>
          component.managed !== false && component.multiIconSetId === iconSetId)
        if (hasSet) modifiedIds.add(viewId)
        nextModels.set(viewId, {
          ...model,
          components: model.components.map((component) => {
            if (component.managed === false || component.multiIconSetId !== iconSetId) {
              return component
            }
            const bindings = component.multiStateBindings ?? []
            const orderedBindings = nextIcon.states.flatMap((state) => {
              const binding = bindings.find((candidate) => candidate.stateKey === state.key)
              return binding ? [binding] : []
            })
            return {
              ...component,
              multiStateBindings: orderedBindings,
              tagId: orderedBindings[0]?.tagId ?? '',
            }
          }),
        })
      }
      commitDocumentEdit(config, nextConfig, nextModels, modifiedIds)
    } catch (error) {
      messageApi.error(`調整狀態優先順序失敗：${getErrorMessage(error)}`)
    }
  }

  async function handleAddMultiStateIconState(iconSetId: string) {
    if (!config) return
    const draft = multiStateAddDrafts[iconSetId]
    if (!draft?.file) {
      messageApi.warning('請選擇狀態圖片。')
      return
    }
    try {
      const bytes = new Uint8Array(await draft.file.arrayBuffer())
      const nextConfig = addMultiStateIconState(
        config.rawConfig,
        iconSetId,
        draft.name,
        bytes,
        window.crypto,
      )
      const nextIcon = getIconLibrary(nextConfig).find((icon) =>
        icon.type === 'multi-state' && icon.id === iconSetId)
      if (!nextIcon || nextIcon.type !== 'multi-state') {
        throw new Error('找不到更新後的多狀態圖示組。')
      }
      const newState = nextIcon.states[nextIcon.states.length - 1]
      if (!newState) throw new Error('新增的狀態資料不完整。')
      const usedIds = new Set(buildTagIndex(config.rawConfig).keys())
      for (const view of config.rawConfig.hmi.views) {
        if (!isRecord(view)) continue
        if (isRecord(view.items)) {
          Object.keys(view.items).forEach((id) => usedIds.add(id))
        }
        if (typeof view.svgcontent === 'string') {
          const doc = parseSvg(view.svgcontent, DOMParser)
          for (const node of Array.from(doc.getElementsByTagName('*'))) {
            const id = node.getAttribute('id')
            if (id) usedIds.add(id)
          }
        }
      }
      for (const model of models.values()) {
        for (const component of [...model.components, ...(model.originalComponents ?? [])]) {
          if (component.shapeId) usedIds.add(component.shapeId)
          if (component.labelId) usedIds.add(component.labelId)
          if (component.alarmShapeId) usedIds.add(component.alarmShapeId)
          for (const binding of component.multiStateBindings ?? []) {
            if (binding.shapeId) usedIds.add(binding.shapeId)
          }
        }
      }
      const modifiedIds = new Set(modifiedViewIds)
      const nextModels = new Map<string, ExportViewModel>()
      for (const [viewId, model] of models) {
        const hasSet = model.components.some((component) =>
          component.managed !== false && component.multiIconSetId === iconSetId)
        if (hasSet) modifiedIds.add(viewId)
        nextModels.set(viewId, {
          ...model,
          components: model.components.map((component) => (
            component.managed === false || component.multiIconSetId !== iconSetId
              ? component
              : {
                ...component,
                multiStateBindings: [
                  ...(component.multiStateBindings ?? []),
                  {
                    stateKey: newState.key,
                    iconId: newState.asset.id,
                    tagId: '',
                    shapeId: generateId('SHE', usedIds, window.crypto),
                  },
                ],
              }
          )),
        })
      }
      commitDocumentEdit(config, nextConfig, nextModels, modifiedIds)
      setMultiStateAddDrafts((current) => ({ ...current, [iconSetId]: { name: '', file: null } }))
      messageApi.success('已新增狀態；請在使用此圖示組的元件中綁定 Boolean Tag。')
    } catch (error) {
      messageApi.error(`新增狀態失敗：${getErrorMessage(error)}`)
    }
  }

  function handleRemoveMultiStateIconState(iconSetId: string, stateKey: string) {
    if (!config) return
    try {
      const usages: string[] = []
      for (const [viewId, model] of models) {
        for (const component of model.components) {
          if (component.managed === false
              || component.multiIconSetId !== iconSetId
              || !component.multiStateBindings?.some((binding) => binding.stateKey === stateKey)) continue
          usages.push(`「${config.views.find((view) => view.id === viewId)?.name || viewId}」的 ${
            component.label || `元件 #${component.seq}`
          }`)
        }
      }
      for (const view of config.rawConfig.hmi.views) {
        if (!isRecord(view) || typeof view.svgcontent !== 'string') continue
        const doc = parseSvg(view.svgcontent, DOMParser)
        const used = Array.from(doc.getElementsByTagName('*')).some((node) =>
          node.getAttribute('data-fuxa-icon-set-id') === iconSetId
          && node.getAttribute('data-fuxa-state-key') === stateKey)
        if (used) {
          usages.push(`「${typeof view.name === 'string' ? view.name : String(view.id || '未知 View')}」的 SVG 元件`)
        }
      }
      const nextConfig = removeMultiStateIconState(
        config.rawConfig,
        iconSetId,
        stateKey,
        usages,
      )
      commitDocumentEdit(config, nextConfig)
      messageApi.success('已刪除多狀態圖示定義。')
    } catch (error) {
      messageApi.error(`刪除狀態失敗：${getErrorMessage(error)}`)
    }
  }

  const previewPanel = (
    <PreviewPanel
      preview={preview}
      realtime={previewRealtime}
      onRealtimeChange={setPreviewRealtime}
      onRefresh={handleRefreshPreview}
      hasSelection={Boolean(config && selectedView)}
      viewName={selectedView?.name}
      stale={previewStale}
    />
  )

  const selectedRawView = config?.rawConfig.hmi.views.find(
    (view) => isRecord(view) && view.id === selectedView?.id,
  )
  const selectedFloorKey = selectedView ? floorPlanKeyForView(selectedView.name) : null
  const selectedFloorPlan = selectedFloorKey ? floorPlanLibrary[selectedFloorKey] ?? null : null
  const floorPlanLayoutPanel = config && selectedView && selectedModel?.floorPlan === true ? (
    <FloorPlanLayoutPanel
      model={selectedModel}
      profile={isRecord(selectedRawView) ? selectedRawView.profile : undefined}
      tags={buildTagIndex(config.rawConfig)}
      floorGroupFrame={getFloorGroupFrameSettings(config.rawConfig)}
      floorPlanImage={selectedFloorPlan}
      onMoveTag={(tagId, dx, dy) => handleMoveFloorTag(selectedView.id, tagId, dx, dy)}
    />
  ) : null

  const batchMoveItems: BatchMoveItem[] = (selectedModel?.components ?? [])
    .filter((component) => component.managed !== false)
    .map((component) => {
      const tagName = tags.find((tag) => tag.id === component.tagId)?.name
      return {
        key: component.key,
        label: `${component.label || tagName || '未命名元件'}${tagName ? ` · ${tagName}` : ''}`,
      }
    })

  return (
    <ConfigProvider
      locale={zhTW}
      theme={{
        token: {
          colorPrimary: '#2563eb',
          colorInfo: '#2563eb',
          colorLink: '#2563eb',
          colorError: '#dc2626',
          colorSuccess: '#16a34a',
          colorWarning: '#d97706',
          colorTextBase: '#1e293b',
          colorBgLayout: '#f4f6fa',
          borderRadius: 8,
          controlHeight: 32,
          fontFamily: '"Segoe UI", "Microsoft JhengHei", sans-serif',
        },
      }}
    >
      {contextHolder}
      <ComponentMoveDialog
        open={componentMoveSource !== null}
        targetOptions={buildViewTargetOptions(config?.views ?? [], models, componentMoveSource?.viewId)}
        targetId={componentMoveTargetId}
        onTargetChange={setComponentMoveTargetId}
        onCancel={() => {
          setComponentMoveSource(null)
          setComponentMoveTargetId('')
        }}
        onOk={handleMoveComponentToView}
      />
      <BatchMoveDialog
        open={batchMoveDialogOpen}
        items={batchMoveItems}
        selectedKeys={batchMoveSelection}
        onToggleItem={(key, checked) => {
          setBatchMoveSelection((current) => {
            const next = new Set(current)
            if (checked) next.add(key)
            else next.delete(key)
            return next
          })
        }}
        targetOptions={buildViewTargetOptions(config?.views ?? [], models, selectedView?.id)}
        targetId={componentMoveTargetId}
        onTargetChange={setComponentMoveTargetId}
        onCancel={() => {
          setBatchMoveDialogOpen(false)
          setBatchMoveSelection(new Set())
          setComponentMoveTargetId('')
        }}
        onOk={() => {
          if (!selectedView) return
          const moved = moveComponentsToView(
            selectedView.id,
            [...batchMoveSelection],
            componentMoveTargetId,
          )
          if (moved) {
            setBatchMoveDialogOpen(false)
            setBatchMoveSelection(new Set())
            setComponentMoveTargetId('')
          }
        }}
      />
      <ViewNameDialog
        mode={viewDialogMode}
        form={viewNameForm}
        validateName={validateViewNameInput}
        onSubmit={handleViewNameSubmit}
        onCancel={() => setViewDialogMode(null)}
        onOk={() => viewNameForm.submit()}
      />
      <AutoViewDialog
        open={autoViewDialogOpen}
        mapping={autoViewMapping}
        tags={tags}
        onApply={handleApplyAutoViews}
        onCancel={() => setAutoViewDialogOpen(false)}
      />
      <ViewSettingsDialog
        open={viewSettingsOpen}
        tab={viewSettingsTab}
        onTabChange={setViewSettingsTab}
        floorFrameForm={floorFrameForm}
        viewPropertiesForm={viewPropertiesForm}
        onFloorFrameSubmit={handleFloorFrameSubmit}
        onViewPropertiesSubmit={handleViewPropertiesSubmit}
        onCancel={() => setViewSettingsOpen(false)}
      />
      <IconLibraryDialog
        open={iconLibraryOpen}
        onClose={() => setIconLibraryOpen(false)}
        canEdit={Boolean(config)}
        iconLibrary={iconLibrary}
        onExport={handleExportIconLibrary}
        onImport={handleImportIconLibrary}
        onAddIcon={handleAddIcon}
        onRemoveIcon={handleRemoveIcon}
        onEditMultiStateIcon={setEditingMultiStateIconId}
      />
      <FloorPlanLibraryDialog
        open={floorPlanLibraryOpen}
        onClose={() => setFloorPlanLibraryOpen(false)}
        canEdit={Boolean(config)}
        floorGroups={buildingFloorGroups}
        library={floorPlanLibrary}
        onSetPlan={handleSetFloorPlan}
        onRemovePlan={handleRemoveFloorPlan}
      />
      <MultiStateIconDialog
        icon={editingMultiStateIcon}
        addDrafts={multiStateAddDrafts}
        setAddDrafts={setMultiStateAddDrafts}
        onClose={() => setEditingMultiStateIconId('')}
        onMoveState={handleMoveMultiStateIconState}
        onRemoveState={handleRemoveMultiStateIconState}
        onAddState={handleAddMultiStateIconState}
      />
      <ProjectManagerDialog
        open={deviceManagerOpen}
        tab={projectManagerTab}
        onTabChange={setProjectManagerTab}
        okText={deviceManagerMode === 'create' ? '建立設備' : '儲存設備'}
        footer={projectManagerTab === 'devices'
          ? undefined
          : projectManagerTab === 'alarms'
            ? [
              <Button key="cancel" onClick={() => setDeviceManagerOpen(false)}>
                關閉
              </Button>,
              <Button
                key="apply-alarms"
                type="primary"
                disabled={!tagAlarmStatus.canSubmit}
                onClick={() => tagAlarmRef.current?.submit()}
              >
                設定 {tagAlarmStatus.selectedCount} 個告警
              </Button>,
            ]
            : projectManagerTab === 'tag-create'
              ? [
                <Button key="cancel" onClick={() => setDeviceManagerOpen(false)}>
                  關閉
                </Button>,
                <Button
                  key="create-tags"
                  type="primary"
                  disabled={!tagCreateStatus.canCreate}
                  onClick={() => tagCreateRef.current?.submit()}
                >
                  建立 {tagCreateStatus.specCount} 個 Tag
                </Button>,
              ]
              : projectManagerTab === 'tag-add'
                ? [
                  <Button key="cancel" onClick={() => setDeviceManagerOpen(false)}>
                    關閉
                  </Button>,
                  <Button
                    key="add-tags"
                    type="primary"
                    disabled={tagAddStatus.selectedCount === 0}
                    onClick={() => tagAddRef.current?.submit()}
                  >
                    加入 {tagAddStatus.selectedCount} 筆
                  </Button>,
                ]
            : [
              <Button key="close" onClick={() => setDeviceManagerOpen(false)}>
                關閉
              </Button>,
            ]}
        onCancel={() => setDeviceManagerOpen(false)}
        onOk={projectManagerTab === 'devices'
          ? () => deviceManagerForm.submit()
          : projectManagerTab === 'tag-create'
            ? () => tagCreateRef.current?.submit()
            : projectManagerTab === 'tag-add'
              ? () => tagAddRef.current?.submit()
            : undefined}
        width={projectManagerTab === 'tag-create' ? 1000 : 900}
        items={[
            {
              key: 'devices',
              label: '設備與 Tag',
              children: <DevicesTab
                mode={deviceManagerMode}
                managedDeviceId={managedDeviceId}
                devices={modbusDevices}
                managedDevice={managedDevice}
                managedDeviceTags={managedDeviceTags}
                autoFilledTagCount={autoFilledManagedDeviceTags.length}
                duplicateTagGroups={duplicateTagGroups}
                duplicateTagIds={duplicateTagIds}
                moveTargets={deviceTagMoveTargets}
                existingTags={tags}
                canBatchAddTags={Boolean(selectedModel) && batchableTags.length > 0}
                canBatchCreateTags={canBatchCreateTags}
                addressFillPlan={addressFillPlan ?? null}
                addressFillError={addressFillError ?? null}
                addressShiftStep={deviceAddressShiftStep}
                deviceManagerForm={deviceManagerForm}
                deviceTagForm={deviceTagForm}
                deviceTagSession={deviceTagSession}
                onSelectDevice={selectManagedDevice}
                onCreateDevice={startCreateModbusDevice}
                onOpenBatchAddTags={openBatchAddTab}
                onOpenTagCreate={openTagCreateTab}
                onAddressShiftStepChange={setDeviceAddressShiftStep}
                onShiftAddresses={handleShiftDeviceAddresses}
                onFillAddresses={handleFillDeviceAddresses}
                onDeleteAutoFilledTags={handleDeleteAutoFilledDeviceTags}
                onDeleteDevice={handleDeleteManagedDevice}
                onSaveDevice={handleModbusDeviceSave}
                onPrepareTagEdit={openDeviceTagEditor}
                onUpdateTag={handleUpdateDeviceTag}
                onMoveTags={handleMoveDeviceTags}
                onDeleteTag={handleDeleteDeviceTag}
              />,
            },
            {
              key: 'alarms',
              label: '告警設定',
              children: <TagAlarmsTab
                ref={tagAlarmRef}
                config={config}
                tags={tags}
                models={models}
                onDocumentEdit={(document) => replaceDocument(document, models)}
                onNotify={(type, content) => messageApi[type](content)}
                onStatusChange={setTagAlarmStatus}
              />,
            },
            {
              key: 'tag-create',
              label: '批次建立 Tag',
              children: <TagCreateTab
                ref={tagCreateRef}
                config={config}
                initialDeviceId={tagCreateDefaultDeviceId}
                canAddToView={Boolean(selectedView && selectedModel)}
                onCreate={handleCreateTags}
                onWarning={(warning) => messageApi.warning(warning)}
                onStatusChange={setTagCreateStatus}
              />,
            },
            {
              key: 'tag-add',
              label: '批次加入 Tag',
              children: <TagAddTab
                key={tagAddSession}
                ref={tagAddRef}
                tags={batchableTags}
                models={models}
                currentViewTagIds={usedTagIds}
                iconLibrary={iconLibrary}
                onSubmit={handleBatchAdd}
                onStatusChange={setTagAddStatus}
              />,
            },
            {
              key: 'floors',
              label: '群組管理',
              children: <FloorsTab
                key={floorSession}
                tags={tags}
                onApplyFloor={applyFloorChange}
                onNotify={(type, content) => messageApi[type](content)}
              />,
            },
          ]}
        />
      <Layout className="editor-shell">
        <EditorHeader
          projectName={projectName}
          onProjectNameChange={setProjectName}
          canUndo={editor.past.length > 0}
          canRedo={editor.future.length > 0}
          onUndo={() => undo()}
          onRedo={() => redo()}
          fuxaSyncStatus={fuxaSync.status}
          hasConfig={Boolean(config)}
          isDirty={isDirty}
          onExportConfig={handleExportConfig}
          onSyncToFuxa={fuxaSync.sync}
          onOpenProjectManager={openDeviceManager}
          onOpenAutoView={() => setAutoViewDialogOpen(true)}
          onOpenIconLibrary={() => setIconLibraryOpen(true)}
          onOpenFloorPlanLibrary={() => setFloorPlanLibraryOpen(true)}
          onOpenViewSettings={openFloorFrameDialog}
        />

        <Layout className="editor-body">
          <ViewSidebar
            views={config?.views ?? null}
            selectedView={selectedView}
            onSelectView={setSelectedViewId}
            onCreateView={() => openViewDialog('create')}
            onRenameView={() => openViewDialog('rename')}
            onDeleteView={handleDeleteSelectedView}
          />

          <Content className="workspace">
            {!config ? (
              <div className="welcome-panel">
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={(
                    <Space orientation="vertical" size={4}>
                      <Title level={4}>開始編輯 FUXA View</Title>
                      <Text type="secondary">
                        請從 FUXA 編輯器開啟本工具，以載入目前專案並進行同步。
                      </Text>
                    </Space>
                  )}
                />
              </div>
            ) : (
              <div className="workspace-content">
                <div className="workspace-title">
                  <div>
                    <Text className="eyebrow">CONFIGURATION</Text>
                    <Title level={3}>{selectedView?.name ?? 'View'}</Title>
                  </div>
                  <Space size="small">
                    {selectedView && parseBuildingFloorName(selectedView.name) && (
                      <Tag color="blue">樓層功能已開啟</Tag>
                    )}
                    <Tag color={isDirty ? 'orange' : 'blue'}>
                      {isDirty ? '有未匯出修改' : 'View 元件管理'}
                    </Tag>
                  </Space>
                </div>

                {isToolSettingsOutdated(config.rawConfig) && (
                  <Alert
                    type="warning"
                    showIcon
                    title="工具版本可能過舊"
                    description={TOOL_SETTINGS_OUTDATED_MESSAGE}
                  />
                )}

                {selectedView ? (
                  <Space className="view-panels" orientation="vertical" size="middle">
                    {modelErrors.has(selectedView.id) ? (
                      <div className="editor-columns">
                        <Alert
                          type="warning"
                          showIcon
                          title="此 View 無法編輯"
                          description={modelErrors.get(selectedView.id)}
                        />
                        {previewPanel}
                      </div>
                    ) : (
                      <>
                        <div className="editor-columns">
                          <div className="editor-controls">
                        {selectedModel && (
                          <GridSettingsCard
                            viewId={selectedView.id}
                            grid={selectedModel.grid}
                            onUpdateGrid={handleUpdateGrid}
                          />
                        )}
                        {selectedModel && (
                          <FloorPlanViewCard
                            floorPlan={selectedModel.floorPlan === true}
                            onChange={(floorPlan) => handleUpdateFloorPlan(selectedView.id, floorPlan)}
                          />
                        )}
                      <ManagedComponentCard
                        viewId={selectedView.id}
                        managedCount={selectedModel?.components.filter(
                          (component) => component.managed !== false,
                        ).length ?? 0}
                        groups={managedComponentGroups}
                        tags={tags}
                        iconLibrary={iconLibrary}
                        batchAddDisabled={!selectedModel || tags.length === 0}
                        batchMoveDisabled={
                          !selectedView
                          || !selectedModel?.components.some(
                            (component) => component.managed !== false,
                          )
                          || !config?.views.some((view) => {
                            const id = view.id || view.key
                            return id !== selectedView.id && models.has(id)
                          })
                        }
                        onOpenBatchAdd={openBatchAddTab}
                        onOpenBatchMove={openBatchMoveDialog}
                        onUpdateComponent={handleUpdateComponent}
                        onUpdateGraphic={handleUpdateGraphic}
                        onUpdateMultiStateBinding={handleUpdateMultiStateBinding}
                        onMoveComponent={handleMoveComponent}
                        onOpenComponentMove={openComponentMoveDialog}
                        onRemoveComponent={handleRemoveComponent}
                      />
                    {(modelWarnings.get(selectedView.id)?.length ?? 0) > 0 && (
                      <Alert
                        type="warning"
                        showIcon
                        title="部分 Tag 元件已被移除"
                        description={modelWarnings.get(selectedView.id)?.join('；')}
                      />
                    )}
                    {(unsupported.get(selectedView.id)?.length ?? 0) > 0 && (
                      <Alert
                        type="info"
                        showIcon
                        title="部分既有 SVG 元件不會自動移動"
                        description={unsupported.get(selectedView.id)?.join('；')}
                      />
                    )}
                        </div>
                        {previewPanel}
                        </div>
                        {floorPlanLayoutPanel}
                      </>
                    )}
                  </Space>
                ) : (
                  <Alert type="info" showIcon title="此配置沒有可選取的 View。" />
                )}
              </div>
            )}
          </Content>
        </Layout>
      </Layout>
    </ConfigProvider>
  )
}

export default function App() {
  return (
    <EditorProvider>
      <EditorWorkspace />
    </EditorProvider>
  )
}
