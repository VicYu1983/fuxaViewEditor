import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  DeleteOutlined,
  PlusOutlined,
} from '@ant-design/icons'
import {
  Alert,
  Button,
  Checkbox,
  Divider,
  Empty,
  Input,
  Modal,
  Select,
  Space,
  Tag,
  Typography,
} from 'antd'
import type { IconLibraryEntry } from '../../domain/icons/iconLibrary'
import type { IndexedTag } from '../../domain/tags/index'
import {
  classifyTagsForViews,
  filterAutoViewTags,
  UNCLASSIFIED_VIEW_NAME,
  validateAutoViewMapping,
  type AutoViewGroup,
} from '../../domain/views/autoViewMapping'
import {
  AUTO_VIEW_ICON_AUTO,
  AUTO_VIEW_ICON_ENTRY_PREFIX,
  AUTO_VIEW_ICON_NONE,
  buildAutoViewComponentPlans,
  summarizeAutoViewPlans,
  type AutoViewDevicePlan,
  type AutoViewIconOverrides,
} from '../../domain/views/autoViewComponentPlans'
import { getAutoViewIconTypeLabel } from '../../domain/views/autoViewIconMatching'
import {
  DEFAULT_AUTO_STATE_MAPPING,
  validateAutoViewStateMapping,
  type AutoViewStateGroup,
} from '../../domain/views/autoViewStateMapping'

const { Text } = Typography

export interface AutoViewApplyOptions {
  includeAutoFilled: boolean
  coilSwitchEnabled: boolean
  stateMapping: AutoViewStateGroup[]
  iconOverrides: AutoViewIconOverrides
}

export interface AutoViewDialogProps {
  open: boolean
  mapping: readonly AutoViewGroup[]
  tags: readonly IndexedTag[]
  stateMapping?: readonly AutoViewStateGroup[]
  iconLibrary?: readonly IconLibraryEntry[]
  iconLibraryLoading?: boolean
  iconLibraryError?: string
  onApply: (groups: AutoViewGroup[], options: AutoViewApplyOptions) => void
  onCancel: () => void
}

interface GroupDraft {
  id: number
  name: string
  keywordsText: string
}

interface StateDraft {
  id: number
  state: string
  keywordsText: string
}

function splitKeywords(value: string): string[] {
  return value
    .split(/[,，;；]/)
    .map((keyword) => keyword.trim())
    .filter(Boolean)
}

function tagSummary(tags: readonly IndexedTag[]): string {
  if (tags.length === 0) return '沒有 Tag，不會建立'
  const names = tags.slice(0, 6).map((tag) => tag.name)
  return tags.length > names.length
    ? `${names.join('、')}…（共 ${tags.length} 筆）`
    : names.join('、')
}

function summaryText(plans: readonly AutoViewDevicePlan[]): string {
  const summary = summarizeAutoViewPlans(plans)
  const parts = [
    summary.multiComponentCount > 0 ? `多狀態 ${summary.multiComponentCount}` : '',
    summary.pairComponentCount > 0 ? `正常／告警 ${summary.pairComponentCount}` : '',
    summary.singleIconComponentCount > 0 ? `一般圖示 ${summary.singleIconComponentCount}` : '',
    summary.switchComponentCount > 0 ? `Switch ${summary.switchComponentCount}` : '',
    summary.rectComponentCount > 0 ? `矩形 ${summary.rectComponentCount}` : '',
  ].filter(Boolean)
  return parts.length > 0 ? parts.join('、') : '沒有可建立的元件'
}

export function AutoViewDialog({
  open,
  mapping,
  tags,
  stateMapping = DEFAULT_AUTO_STATE_MAPPING,
  iconLibrary = [],
  iconLibraryLoading = false,
  iconLibraryError,
  onApply,
  onCancel,
}: AutoViewDialogProps) {
  const nextDraftId = useRef(0)
  const nextStateDraftId = useRef(0)
  const [drafts, setDrafts] = useState<GroupDraft[]>([])
  const [stateDrafts, setStateDrafts] = useState<StateDraft[]>([])
  const [includeAutoFilled, setIncludeAutoFilled] = useState(false)
  const [coilSwitchEnabled, setCoilSwitchEnabled] = useState(true)
  const [iconOverrides, setIconOverrides] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open) return
    nextDraftId.current = 0
    nextStateDraftId.current = 0
    setDrafts(mapping.map((group) => ({
      id: nextDraftId.current++,
      name: group.name,
      keywordsText: group.keywords.join(', '),
    })))
    setStateDrafts(stateMapping.map((group) => ({
      id: nextStateDraftId.current++,
      state: group.state,
      keywordsText: group.keywords.join(', '),
    })))
    setIncludeAutoFilled(false)
    setCoilSwitchEnabled(true)
    setIconOverrides({})
  }, [open, mapping, stateMapping])

  const groups = useMemo<AutoViewGroup[]>(() => drafts.map((draft) => ({
    name: draft.name.trim(),
    keywords: splitKeywords(draft.keywordsText),
  })), [drafts])

  const stateGroups = useMemo<AutoViewStateGroup[]>(() => stateDrafts.map((draft) => ({
    state: draft.state.trim(),
    keywords: splitKeywords(draft.keywordsText),
  })), [stateDrafts])

  const eligibleTags = useMemo(
    () => filterAutoViewTags(tags, includeAutoFilled),
    [tags, includeAutoFilled],
  )
  const classification = useMemo(
    () => classifyTagsForViews(eligibleTags, groups),
    [eligibleTags, groups],
  )
  const mappingErrors = useMemo(() => validateAutoViewMapping(groups), [groups])
  const stateErrors = useMemo(
    () => validateAutoViewStateMapping(stateGroups),
    [stateGroups],
  )
  const errors = useMemo(
    () => [...mappingErrors, ...stateErrors],
    [mappingErrors, stateErrors],
  )

  const viewPlans = useMemo(() => classification.groups
    .filter((group) => group.tags.length > 0)
    .map((group) => ({
      viewKey: group.name,
      name: group.name,
      plans: buildAutoViewComponentPlans({
        tags: group.tags,
        viewKey: group.name,
        stateMapping: stateGroups,
        icons: iconLibrary,
        coilSwitchEnabled,
        iconOverrides,
      }),
    }))
    .concat(classification.unclassified.length > 0
      ? [{
        viewKey: '__unclassified__',
        name: UNCLASSIFIED_VIEW_NAME,
        plans: buildAutoViewComponentPlans({
          tags: classification.unclassified,
          viewKey: '__unclassified__',
          stateMapping: stateGroups,
          icons: iconLibrary,
          coilSwitchEnabled,
          iconOverrides,
        }),
      }]
      : []), [
    classification,
    stateGroups,
    iconLibrary,
    coilSwitchEnabled,
    iconOverrides,
  ])

  const allPlans = useMemo(
    () => viewPlans.flatMap((view) => view.plans),
    [viewPlans],
  )
  const totalSummary = useMemo(() => summarizeAutoViewPlans(allPlans), [allPlans])

  const excludedTagCount = tags.length - eligibleTags.length
  const willCreateCount = classification.groups.filter((group) => group.tags.length > 0).length
    + (classification.unclassified.length > 0 ? 1 : 0)
  const effectiveViewCount = Math.max(1, willCreateCount)

  function updateDraft(index: number, patch: Partial<GroupDraft>) {
    setDrafts((current) => current.map((draft, draftIndex) => (
      draftIndex === index ? { ...draft, ...patch } : draft
    )))
  }

  function removeDraft(index: number) {
    setDrafts((current) => current.filter((_, draftIndex) => draftIndex !== index))
  }

  function moveDraft(index: number, direction: -1 | 1) {
    setDrafts((current) => {
      const target = index + direction
      if (target < 0 || target >= current.length) return current
      const next = [...current]
      const moved = next[index]
      const replaced = next[target]
      if (!moved || !replaced) return current
      next[index] = replaced
      next[target] = moved
      return next
    })
  }

  function addDraft() {
    const id = nextDraftId.current
    nextDraftId.current += 1
    setDrafts((current) => [...current, { id, name: '', keywordsText: '' }])
  }

  function updateStateDraft(index: number, patch: Partial<StateDraft>) {
    setStateDrafts((current) => current.map((draft, draftIndex) => (
      draftIndex === index ? { ...draft, ...patch } : draft
    )))
  }

  function removeStateDraft(index: number) {
    setStateDrafts((current) => current.filter((_, draftIndex) => draftIndex !== index))
  }

  function addStateDraft() {
    const id = nextStateDraftId.current
    nextStateDraftId.current += 1
    setStateDrafts((current) => [...current, { id, state: '', keywordsText: '' }])
  }

  function updateIconOverride(plan: AutoViewDevicePlan, value: string) {
    setIconOverrides((current) => ({ ...current, [plan.key]: value }))
  }

  return (
    <Modal
      open={open}
      title="一鍵配置"
      width={1040}
      onCancel={onCancel}
      destroyOnHidden
      footer={[
        <Button key="cancel" onClick={onCancel}>取消</Button>,
        <Button
          key="apply"
          type="primary"
          danger
          disabled={errors.length > 0 || iconLibraryLoading}
          onClick={() => onApply(groups, {
            includeAutoFilled,
            coilSwitchEnabled,
            stateMapping: stateGroups,
            iconOverrides,
          })}
        >
          {`清除並建立 ${effectiveViewCount} 個 View`}
        </Button>,
      ]}
    >
      <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
        <Alert
          type="warning"
          showIcon
          title="套用後會刪除目前所有 View"
          description="系統會依下方分類表重新建立 View 並加入 Tag 元件，同時依 Tag 名稱自動綁定狀態與圖示。尚未匯出的修改請先確認；套用後仍可使用 Undo 復原。"
        />

        <div>
          <Text strong>分類對應表</Text>
          <div>
            <Text type="secondary">
              Tag 名稱包含任一關鍵字即歸入該 View；多組同時符合時，依列表順序取第一組。未符合任何規則的 Tag 會集中到「{UNCLASSIFIED_VIEW_NAME}」。
            </Text>
          </div>
          <Space orientation="vertical" size="small" style={{ width: '100%', marginTop: 8 }}>
            {drafts.map((draft, index) => (
              <div className="auto-view-mapping-row" key={draft.id}>
                <Input
                  aria-label={`第 ${index + 1} 列 View 名稱`}
                  placeholder="View 名稱，例如：消防系統"
                  value={draft.name}
                  onChange={(event) => updateDraft(index, { name: event.target.value })}
                />
                <Input
                  aria-label={`第 ${index + 1} 列關鍵字`}
                  placeholder="關鍵字，以逗號分隔，例如：消防, co2"
                  value={draft.keywordsText}
                  onChange={(event) => updateDraft(index, { keywordsText: event.target.value })}
                />
                <Space size={4}>
                  <Button
                    aria-label={`第 ${index + 1} 列上移`}
                    title="上移（提高優先順序）"
                    icon={<ArrowUpOutlined />}
                    disabled={index === 0}
                    onClick={() => moveDraft(index, -1)}
                  />
                  <Button
                    aria-label={`第 ${index + 1} 列下移`}
                    title="下移（降低優先順序）"
                    icon={<ArrowDownOutlined />}
                    disabled={index === drafts.length - 1}
                    onClick={() => moveDraft(index, 1)}
                  />
                  <Button
                    aria-label={`刪除第 ${index + 1} 列`}
                    title="刪除分類"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => removeDraft(index)}
                  />
                </Space>
              </div>
            ))}
          </Space>
          <Button
            icon={<PlusOutlined />}
            onClick={addDraft}
            style={{ marginTop: 8 }}
          >
            新增分類
          </Button>
        </div>

        <div>
          <Text strong>狀態關鍵字對應表</Text>
          <div>
            <Text type="secondary">
              Tag 名稱結尾符合關鍵字時，會去掉關鍵字後依裝置名稱分組；多個狀態 Tag 搭配多狀態圖示組，單一 Tag 搭配正常／告警圖示組。`(NC)` 會自動反轉正常／告警狀態。
            </Text>
          </div>
          <Space orientation="vertical" size="small" style={{ width: '100%', marginTop: 8 }}>
            {stateDrafts.map((draft, index) => (
              <div className="auto-view-state-row" key={draft.id}>
                <Input
                  aria-label={`第 ${index + 1} 列狀態名稱`}
                  placeholder="狀態名稱，例如：運轉"
                  value={draft.state}
                  onChange={(event) => updateStateDraft(index, { state: event.target.value })}
                />
                <Input
                  aria-label={`第 ${index + 1} 列狀態關鍵字`}
                  placeholder="狀態關鍵字，以逗號分隔，例如：運轉, 啟動"
                  value={draft.keywordsText}
                  onChange={(event) => updateStateDraft(index, {
                    keywordsText: event.target.value,
                  })}
                />
                <Button
                  aria-label={`刪除第 ${index + 1} 列狀態`}
                  title="刪除狀態"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => removeStateDraft(index)}
                />
              </div>
            ))}
          </Space>
          <Button
            icon={<PlusOutlined />}
            onClick={addStateDraft}
            style={{ marginTop: 8 }}
          >
            新增狀態
          </Button>
        </div>

        {errors.length > 0 && (
          <Alert
            type="error"
            showIcon
            title={mappingErrors.length > 0 ? '分類表需要修正' : '狀態表需要修正'}
            description={(
              <ul className="auto-view-error-list">
                {errors.map((error) => <li key={error}>{error}</li>)}
              </ul>
            )}
          />
        )}

        <Divider style={{ margin: 0 }} />

        <div>
          <Text strong>預覽</Text>
          <div>
            <Text type="secondary">
              可分類 Tag {eligibleTags.length} 筆
              {excludedTagCount > 0 ? `（已排除 ${excludedTagCount} 筆自動補位 Tag）` : ''}
              ；將建立 {effectiveViewCount} 個 View。
              多狀態 {totalSummary.multiComponentCount}、正常／告警 {totalSummary.pairComponentCount}
              、Switch {totalSummary.switchComponentCount}、矩形 {totalSummary.rectComponentCount}
              {totalSummary.warningDeviceCount > 0
                ? `；${totalSummary.warningDeviceCount} 個裝置有配對警告。`
                : '。'}
            </Text>
          </div>
          {eligibleTags.length === 0 && drafts.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="目前沒有可加入的 Tag；套用後會建立一個空白 MainView。"
              style={{ margin: '12px 0' }}
            />
          ) : (
            <div className="auto-view-preview">
              {classification.groups.map((group, index) => {
                const plans = viewPlans.find((view) => view.viewKey === group.name)?.plans ?? []
                return (
                  <div className="auto-view-preview-row" key={`mapped-${index}`}>
                    <Tag color={group.tags.length > 0 ? 'blue' : 'default'}>
                      {group.tags.length} 筆
                    </Tag>
                    <div className="auto-view-preview-meta">
                      <Text strong>{group.name || `（未命名分類 ${index + 1}）`}</Text>
                      <Text type="secondary">{tagSummary(group.tags)}</Text>
                      {group.tags.length > 0 && (
                        <Text type="secondary">{summaryText(plans)}</Text>
                      )}
                    </div>
                  </div>
                )
              })}
              {classification.unclassified.length > 0 && (
                <div className="auto-view-preview-row">
                  <Tag color="orange">{classification.unclassified.length} 筆</Tag>
                  <div className="auto-view-preview-meta">
                    <Text strong>{UNCLASSIFIED_VIEW_NAME}</Text>
                    <Text type="secondary">{tagSummary(classification.unclassified)}</Text>
                    <Text type="secondary">
                      {summaryText(
                        viewPlans.find((view) => view.viewKey === '__unclassified__')?.plans ?? [],
                      )}
                    </Text>
                  </div>
                </div>
              )}
            </div>
          )}
          {classification.ambiguous.length > 0 && (
            <Alert
              type="info"
              showIcon
              title={`${classification.ambiguous.length} 個 Tag 同時符合多組`}
              description={`已依列表順序歸入第一組，例如：${classification.ambiguous
                .slice(0, 3)
                .map((item) => `${item.tag.name} → ${item.groupNames[0]}`)
                .join('、')}`}
            />
          )}
        </div>

        <div>
          <Text strong>圖示與狀態配對</Text>
          <div>
            <Text type="secondary">
              依 Tag 名稱自動配對圖示組；名稱越長優先，並套用異體字、水位與通用泵浦後備規則。可在下方逐一改選。
            </Text>
          </div>
          {iconLibraryLoading && (
            <Alert
              type="info"
              showIcon
              title="正在載入預設圖示庫"
              description="載入完成後會自動更新配對結果。"
            />
          )}
          {iconLibraryError && (
            <Alert
              type="warning"
              showIcon
              title="預設圖示庫載入失敗"
              description={iconLibraryError}
            />
          )}
          <details className="auto-view-plan-details">
            <summary>
              {`檢視／調整 ${allPlans.length} 個裝置（已配對 ${totalSummary.matchedDeviceCount}，警告 ${totalSummary.warningDeviceCount}）`}
            </summary>
            <div className="auto-view-plan-list">
              {viewPlans.map((view) => (
                <div key={view.viewKey}>
                  <Text strong>{view.name}</Text>
                  {view.plans.map((plan) => (
                    <div className="auto-view-plan-row" key={plan.key}>
                      <div className="auto-view-plan-meta">
                        <Tag color={plan.warnings.length > 0 ? 'orange' : plan.iconId ? 'blue' : 'default'}>
                          {plan.iconId ? (plan.autoIconName ?? '已選圖示') : '無圖示'}
                        </Tag>
                        <Text strong>{plan.base}</Text>
                        <Text type="secondary">{tagSummary(plan.tags)}</Text>
                        {plan.warnings.map((warning) => (
                          <Text type="warning" key={warning}>{warning}</Text>
                        ))}
                      </div>
                      <Select
                        aria-label={`${plan.base} 圖示組`}
                        showSearch
                        optionFilterProp="label"
                        value={plan.overrideValue}
                        options={[
                          {
                            value: AUTO_VIEW_ICON_AUTO,
                            label: plan.autoIconId
                              ? `自動（${plan.autoIconName ?? plan.autoIconId}）`
                              : '自動（未配對）',
                          },
                          { value: AUTO_VIEW_ICON_NONE, label: '不使用圖示' },
                          ...iconLibrary.map((icon) => ({
                            value: `${AUTO_VIEW_ICON_ENTRY_PREFIX}${icon.id}`,
                            label: `${icon.name}（${getAutoViewIconTypeLabel(icon)}）`,
                          })),
                        ]}
                        onChange={(value) => updateIconOverride(plan, value)}
                      />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </details>
        </div>

        <Space size="large">
          <Checkbox
            checked={includeAutoFilled}
            onChange={(event) => setIncludeAutoFilled(event.target.checked)}
          >
            包含自動補位 Tag
          </Checkbox>
          <Checkbox
            checked={coilSwitchEnabled}
            onChange={(event) => setCoilSwitchEnabled(event.target.checked)}
          >
            Boolean Coil 建立 Switch
          </Checkbox>
        </Space>
      </Space>
    </Modal>
  )
}
