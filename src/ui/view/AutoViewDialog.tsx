import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  DeleteOutlined,
  PlusOutlined,
} from '@ant-design/icons'
import { Alert, Button, Checkbox, Divider, Empty, Input, Modal, Space, Tag, Typography } from 'antd'
import type { IndexedTag } from '../../domain/tags/index'
import {
  classifyTagsForViews,
  filterAutoViewTags,
  UNCLASSIFIED_VIEW_NAME,
  validateAutoViewMapping,
  type AutoViewGroup,
} from '../../domain/views/autoViewMapping'

const { Text } = Typography

export interface AutoViewApplyOptions {
  includeAutoFilled: boolean
  coilSwitchEnabled: boolean
}

export interface AutoViewDialogProps {
  open: boolean
  mapping: readonly AutoViewGroup[]
  tags: readonly IndexedTag[]
  onApply: (groups: AutoViewGroup[], options: AutoViewApplyOptions) => void
  onCancel: () => void
}

interface GroupDraft {
  id: number
  name: string
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

export function AutoViewDialog({
  open,
  mapping,
  tags,
  onApply,
  onCancel,
}: AutoViewDialogProps) {
  const nextDraftId = useRef(0)
  const [drafts, setDrafts] = useState<GroupDraft[]>([])
  const [includeAutoFilled, setIncludeAutoFilled] = useState(false)
  const [coilSwitchEnabled, setCoilSwitchEnabled] = useState(true)

  useEffect(() => {
    if (!open) return
    nextDraftId.current = 0
    setDrafts(mapping.map((group) => ({
      id: nextDraftId.current++,
      name: group.name,
      keywordsText: group.keywords.join(', '),
    })))
    setIncludeAutoFilled(false)
    setCoilSwitchEnabled(true)
  }, [open, mapping])

  const groups = useMemo<AutoViewGroup[]>(() => drafts.map((draft) => ({
    name: draft.name.trim(),
    keywords: splitKeywords(draft.keywordsText),
  })), [drafts])

  const eligibleTags = useMemo(
    () => filterAutoViewTags(tags, includeAutoFilled),
    [tags, includeAutoFilled],
  )
  const classification = useMemo(
    () => classifyTagsForViews(eligibleTags, groups),
    [eligibleTags, groups],
  )
  const errors = useMemo(() => validateAutoViewMapping(groups), [groups])

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

  return (
    <Modal
      open={open}
      title="一鍵配置"
      width={960}
      onCancel={onCancel}
      destroyOnHidden
      footer={[
        <Button key="cancel" onClick={onCancel}>取消</Button>,
        <Button
          key="apply"
          type="primary"
          danger
          disabled={errors.length > 0}
          onClick={() => onApply(groups, { includeAutoFilled, coilSwitchEnabled })}
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
          description="系統會依下方分類表重新建立 View 並加入 Tag 元件。尚未匯出的修改請先確認；套用後仍可使用 Undo 復原。"
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

        {errors.length > 0 && (
          <Alert
            type="error"
            showIcon
            title="分類表需要修正"
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
              {classification.groups.map((group, index) => (
                <div className="auto-view-preview-row" key={`mapped-${index}`}>
                  <Tag color={group.tags.length > 0 ? 'blue' : 'default'}>
                    {group.tags.length} 筆
                  </Tag>
                  <Text strong>{group.name || `（未命名分類 ${index + 1}）`}</Text>
                  <Text type="secondary">{tagSummary(group.tags)}</Text>
                </div>
              ))}
              {classification.unclassified.length > 0 && (
                <div className="auto-view-preview-row">
                  <Tag color="orange">{classification.unclassified.length} 筆</Tag>
                  <Text strong>{UNCLASSIFIED_VIEW_NAME}</Text>
                  <Text type="secondary">{tagSummary(classification.unclassified)}</Text>
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
