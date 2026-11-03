import { useMemo, useState } from 'react'
import { Button, Checkbox, Empty, Input, Radio, Typography } from 'antd'
import { groupByFloor, normalizeFloor } from '../../domain/tags/floor'
import type { IndexedTag } from '../../domain/tags/index'

const { Text } = Typography

export interface FloorsTabProps {
  tags: IndexedTag[]
  /** Applies a floor value to the given tag ids. */
  onApplyFloor: (tagIds: readonly string[], value: string) => void
  onNotify: (type: 'warning', content: string) => void
}

export function FloorsTab({ tags, onApplyFloor, onNotify }: FloorsTabProps) {
  const [search, setSearch] = useState('')
  const [displayMode, setDisplayMode] = useState<'group' | 'list'>('group')
  const [selection, setSelection] = useState<Set<string>>(() => new Set())
  const [bulkFloor, setBulkFloor] = useState('')

  const filteredTags = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    return tags.filter((tag) => (
      `${tag.deviceName} ${tag.name} ${tag.floor} ${tag.type} ${tag.id} ${String(tag.record.address ?? '')}`
        .toLocaleLowerCase()
        .includes(query)
    ))
  }, [search, tags])
  const tagGroups = useMemo(() => displayMode === 'group'
    ? groupByFloor(filteredTags, (tag) => tag.floor)
    : [{ floor: '', title: '', items: filteredTags }],
  [filteredTags, displayMode])
  const allFloors = useMemo(
    () => [...new Set(tags.map((tag) => tag.floor).filter(Boolean))],
    [tags],
  )

  function toggleVisibleTags(checked: boolean) {
    setSelection((current) => {
      const next = new Set(current)
      for (const tag of filteredTags) {
        if (checked) next.add(tag.id)
        else next.delete(tag.id)
      }
      return next
    })
  }

  function handleApplyBulkFloor() {
    if (!selection.size) {
      onNotify('warning', '請先選取要設定樓層的 Tag。')
      return
    }
    onApplyFloor([...selection], bulkFloor)
    setBulkFloor('')
  }

  return (
    <>
      <Input
        aria-label="搜尋樓層 Tag"
        allowClear
        placeholder="搜尋設備、Tag、型別、ID 或樓層"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        style={{ margin: '12px 0' }}
      />
      <div className="floor-manager-toolbar">
        <Radio.Group
          aria-label="樓層顯示方式"
          optionType="button"
          buttonStyle="solid"
          value={displayMode}
          onChange={(event) => setDisplayMode(event.target.value)}
          options={[
            { label: '依樓層分組', value: 'group' },
            { label: '平面清單', value: 'list' },
          ]}
        />
        <Text type="secondary">{tags.length} 個 Tag · 已選 {selection.size} 個</Text>
      </div>
      <div className="floor-bulk-toolbar">
        <Checkbox
          checked={filteredTags.length > 0
            && filteredTags.every((tag) => selection.has(tag.id))}
          indeterminate={filteredTags.some((tag) => selection.has(tag.id))
            && !filteredTags.every((tag) => selection.has(tag.id))}
          disabled={filteredTags.length === 0}
          onChange={(event) => toggleVisibleTags(event.target.checked)}
        >
          全選可見 Tag
        </Checkbox>
        <Input
          aria-label="批次設定樓層"
          list="known-floor-options"
          placeholder="輸入或選擇樓層"
          value={bulkFloor}
          onChange={(event) => setBulkFloor(event.target.value)}
          style={{ maxWidth: 220 }}
        />
        <datalist id="known-floor-options">
          {allFloors.map((floor) => <option key={floor} value={floor} />)}
        </datalist>
        <Button
          type="primary"
          disabled={!selection.size}
          onClick={handleApplyBulkFloor}
        >
          套用至選取項目
        </Button>
      </div>
      <div className="floor-tag-list" role="group" aria-label="Tag 樓層清單">
        {filteredTags.length ? tagGroups.map((group) => (
          <section className="floor-tag-group" key={group.floor || 'all'}>
            {group.title && (
              <div className="floor-tag-group-title">
                {group.title} · {group.items.length} 個 Tag
              </div>
            )}
            {group.items.map((tag) => (
              <div className="floor-tag-row" key={tag.id}>
                <Checkbox
                  aria-label={`選取 ${tag.deviceName}／${tag.name}`}
                  checked={selection.has(tag.id)}
                  onChange={(event) => {
                    setSelection((current) => {
                      const next = new Set(current)
                      if (event.target.checked) next.add(tag.id)
                      else next.delete(tag.id)
                      return next
                    })
                  }}
                />
                <span className="floor-tag-name" title={tag.name}>{tag.name}</span>
                <Text className="floor-tag-device" type="secondary" title={tag.deviceName}>
                  {tag.deviceName}
                </Text>
                <Text
                  className="floor-tag-address"
                  type="secondary"
                  title={`Address: ${String(tag.record.address ?? '未設定')}`}
                >
                  Address: {String(tag.record.address ?? '未設定')}
                </Text>
                <Input
                  aria-label={`${tag.name} 的樓層`}
                  key={`${tag.id}-${tag.floor}`}
                  defaultValue={tag.floor}
                  placeholder="未設定樓層"
                  onPressEnter={(event) => event.currentTarget.blur()}
                  onBlur={(event) => {
                    const value = normalizeFloor(event.currentTarget.value)
                    if (value !== tag.floor || event.currentTarget.value.trim() !== value) {
                      onApplyFloor([tag.id], value)
                    }
                  }}
                />
              </div>
            ))}
          </section>
        )) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="沒有符合條件的 Tag。" />
        )}
      </div>
    </>
  )
}
