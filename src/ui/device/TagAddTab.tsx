import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react'
import { Checkbox, Empty, Input, Select, Space, Switch, Typography } from 'antd'
import type { IconLibraryEntry } from '../../domain/icons/iconLibrary'
import type { ExportViewModel } from '../../domain/config/prepareFuxaConfigExport'
import { isCoilTag, type IndexedTag } from '../../domain/tags/index'
import { getComponentGraphicChoices } from '../../features/icons/componentGraphics'

const { Text } = Typography

export interface TagAddRequest {
  tagIds: Set<string>
  graphic: string
  coilSwitchEnabled: boolean
}

export interface TagAddStatus {
  selectedCount: number
}

export interface TagAddTabHandle {
  submit: () => void
}

export interface TagAddTabProps {
  /** Candidate tags, already excluding auto-filled tags. */
  tags: IndexedTag[]
  models: Map<string, ExportViewModel>
  /** Tag ids already used by the currently selected view. */
  currentViewTagIds: Set<string>
  iconLibrary: IconLibraryEntry[]
  onSubmit: (request: TagAddRequest) => void
  onStatusChange: (status: TagAddStatus) => void
}

function isBooleanTag(tag: IndexedTag) {
  return ['bool', 'boolean'].includes(tag.type.toLocaleLowerCase())
}

export const TagAddTab = forwardRef<TagAddTabHandle, TagAddTabProps>(
  function TagAddTab({
    tags,
    models,
    currentViewTagIds,
    iconLibrary,
    onSubmit,
    onStatusChange,
  }, ref) {
    const [search, setSearch] = useState('')
    const [onlyUnused, setOnlyUnused] = useState(false)
    const [selection, setSelection] = useState<Set<string>>(() => new Set())
    const [graphic, setGraphic] = useState('rect')
    const [coilSwitchEnabled, setCoilSwitchEnabled] = useState(true)

    const filteredTags = useMemo(() => {
      const query = search.trim().toLocaleLowerCase()
      const used = new Set<string>()
      for (const model of models.values()) {
        for (const component of model.components) {
          if (component.tagId) used.add(component.tagId)
          for (const binding of component.multiStateBindings ?? []) {
            if (binding.tagId) used.add(binding.tagId)
          }
        }
      }
      return tags.filter((tag) => (
        (!onlyUnused || !used.has(tag.id))
        && `${tag.deviceName} ${tag.name} ${tag.type} ${tag.memaddress} ${tag.id} ${tag.floor}`
          .toLocaleLowerCase()
          .includes(query)
      ))
    }, [search, tags, onlyUnused, models])
    const filteredSelectedCount = filteredTags.filter((tag) => selection.has(tag.id)).length
    const selectedTags = tags.filter((tag) => selection.has(tag.id))
    const selectedCoilTags = selectedTags.filter(isCoilTag)
    const selectedCoilSwitchTags = selectedCoilTags.filter(isBooleanTag)
    const canUseBooleanGraphic = selectedTags.length > 0 && selectedTags.every(isBooleanTag)

    useEffect(() => {
      onStatusChange({ selectedCount: selection.size })
    }, [onStatusChange, selection])

    useImperativeHandle(ref, () => ({
      submit: () => onSubmit({ tagIds: new Set(selection), graphic, coilSwitchEnabled }),
    }), [onSubmit, selection, graphic, coilSwitchEnabled])

    function handleSelectAll(checked: boolean) {
      setSelection((current) => {
        const next = new Set(current)
        for (const tag of filteredTags) {
          if (checked) next.add(tag.id)
          else next.delete(tag.id)
        }
        return next
      })
    }

    return (
      <>
        <Text type="secondary">
          Tag 會沿用配置中的樓層；未設定樓層的 Tag 會歸入「未設定樓層」。
        </Text>
        <Select
          aria-label="批次圖形"
          value={graphic}
          options={getComponentGraphicChoices(
            iconLibrary,
            {
              key: 'batch',
              seq: 0,
              tagId: selectedTags[0]?.id ?? '',
              label: '',
              template: 'rect',
              shapeId: '',
              managed: true,
            },
            canUseBooleanGraphic,
          )}
          onChange={setGraphic}
          style={{ width: '100%', marginTop: 12 }}
        />
        {selectedCoilTags.length > 0 && (
          <Space orientation="vertical" size={4} style={{ marginTop: 12 }}>
            <Checkbox
              checked={coilSwitchEnabled}
              onChange={(event) => setCoilSwitchEnabled(event.target.checked)}
            >
              Coil Tag 建立為 Switch，並顯示 Tag 名稱標籤
            </Checkbox>
            <Text type="secondary">
              {coilSwitchEnabled
                ? `將建立 ${selectedCoilSwitchTags.length} 個 Switch、${selectedTags.length - selectedCoilSwitchTags.length} 個一般元件。`
                : `將建立 ${selectedTags.length} 個一般元件。`}
            </Text>
            {selectedCoilSwitchTags.length < selectedCoilTags.length && (
              <Text type="warning">
                非 Boolean 型別的 Coil 不可轉為 Switch。
              </Text>
            )}
          </Space>
        )}
        {graphic.startsWith('multi:') && (
          <Text type="secondary">
            每筆 Tag 各建立一個元件，並綁定至所選多狀態圖示組的最高優先狀態。
          </Text>
        )}
        <Input
          aria-label="搜尋 Tag"
          allowClear
          placeholder="搜尋設備、Tag 名稱、型別或 ID"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          style={{ margin: '16px 0 12px' }}
        />
        <Space style={{ marginBottom: 12 }}>
          <Switch
            aria-label="只顯示尚未加入任何 View 的 Tag"
            checked={onlyUnused}
            onChange={setOnlyUnused}
          />
          <Text>只顯示還沒有加入任何 View 的 Tag</Text>
        </Space>
        <div className="batch-tag-toolbar">
          <Checkbox
            checked={filteredTags.length > 0 && filteredSelectedCount === filteredTags.length}
            indeterminate={filteredSelectedCount > 0 && filteredSelectedCount < filteredTags.length}
            disabled={filteredTags.length === 0}
            onChange={(event) => handleSelectAll(event.target.checked)}
          >
            全選目前搜尋結果
          </Checkbox>
          <Text type="secondary">
            已選 {selection.size} 筆 / {tags.length} 筆
          </Text>
        </div>
        <div className="batch-tag-list" role="group" aria-label="可加入的 Tag">
          {filteredTags.length ? filteredTags.map((tag) => (
            <Checkbox
              key={tag.id}
              checked={selection.has(tag.id)}
              onChange={(event) => {
                setSelection((current) => {
                  const next = new Set(current)
                  if (event.target.checked) next.add(tag.id)
                  else next.delete(tag.id)
                  return next
                })
              }}
            >
              <span className="batch-tag-option">
                <span>{tag.deviceName} / {tag.name} ({tag.type || '未設定型別'})</span>
                <Text type="secondary">
                  {tag.floor || '未設定樓層'} · {tag.memaddress || '未設定區段'}
                  {isCoilTag(tag) ? ' · Coil' : ''}
                  {' · '}{tag.id}
                  {currentViewTagIds.has(tag.id) ? ' · 此 View 已使用' : ''}
                </Text>
              </span>
            </Checkbox>
          )) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="沒有符合的 Tag。" />
          )}
        </div>
      </>
    )
  },
)
