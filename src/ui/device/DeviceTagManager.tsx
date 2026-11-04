import { useMemo, useState } from 'react'
import { Button, Checkbox, Empty, Input, Space, Typography } from 'antd'
import type { FormInstance } from 'antd'
import type { ManagedDeviceTag } from '../../domain/devices/readModbusDevices'
import type { DeviceTagUpdate } from '../../features/devices/manageDeviceTags'
import { DeviceTagEditDialog } from './DeviceTagEditDialog'
import { DeviceTagMoveDialog, type DeviceTagMoveTarget } from './DeviceTagMoveDialog'

const { Text } = Typography

export interface DeviceTagManagerProps {
  sourceName: string
  tags: ManagedDeviceTag[]
  duplicateTagIds: Set<string>
  moveTargets: DeviceTagMoveTarget[]
  existingTags: Array<{ id: string; name: string }>
  editForm: FormInstance<DeviceTagUpdate>
  onPrepareEdit: (tagId: string) => boolean
  onUpdateTag: (values: DeviceTagUpdate, tagId: string) => boolean
  onMoveTags: (targetId: string, tagIds: string[]) => boolean
  onDeleteTag: (tagId: string) => void
}

export function DeviceTagManager({
  sourceName,
  tags,
  duplicateTagIds,
  moveTargets,
  existingTags,
  editForm,
  onPrepareEdit,
  onUpdateTag,
  onMoveTags,
  onDeleteTag,
}: DeviceTagManagerProps) {
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [moveOpen, setMoveOpen] = useState(false)
  const [moveTargetId, setMoveTargetId] = useState('')
  const [editingId, setEditingId] = useState('')
  const [editOpen, setEditOpen] = useState(false)

  const filteredTags = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    return tags.filter((tag) => (
      `${tag.name} ${tag.type} ${String(tag.address ?? '')} ${tag.memaddress} ${tag.floor}`
        .toLocaleLowerCase()
        .includes(query)
    ))
  }, [search, tags])
  const selectedTags = useMemo(() => (
    tags.filter((tag) => selectedIds.includes(tag.id))
  ), [tags, selectedIds])
  const visibleSelectedCount = filteredTags.filter((tag) => (
    selectedIds.includes(tag.id)
  )).length

  function toggleTagSelection(tagId: string, checked: boolean) {
    setSelectedIds((current) => checked
      ? [...current.filter((id) => id !== tagId), tagId]
      : current.filter((id) => id !== tagId))
  }

  function toggleVisibleSelection(checked: boolean) {
    const visibleIds = filteredTags.map((tag) => tag.id)
    setSelectedIds((current) => checked
      ? [...new Set([...current, ...visibleIds])]
      : current.filter((id) => !visibleIds.includes(id)))
  }

  function openMoveDialog() {
    setMoveTargetId(moveTargets[0]?.id ?? '')
    setMoveOpen(true)
  }

  function confirmMove() {
    if (onMoveTags(moveTargetId, selectedTags.map((tag) => tag.id))) {
      setMoveOpen(false)
      setSelectedIds([])
    }
  }

  function openEditDialog(tagId: string) {
    if (!onPrepareEdit(tagId)) return
    setEditingId(tagId)
    setEditOpen(true)
  }

  function saveEdit(values: DeviceTagUpdate) {
    if (onUpdateTag(values, editingId)) setEditOpen(false)
  }

  return (
    <>
      <section className="device-tag-manager" aria-label="所選設備的 Tag 清單">
        <div className="device-tag-manager-heading">
          <Text strong>設備 Tag</Text>
          <Text type="secondary">
            {filteredTags.length} / {tags.length} 個
          </Text>
        </div>
        <Input
          aria-label="搜尋設備 Tag"
          allowClear
          placeholder="搜尋 Tag 名稱、位址、型別或群組"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="device-tag-search"
        />
        <div className="device-tag-bulk-toolbar">
          <Checkbox
            checked={filteredTags.length > 0 && visibleSelectedCount === filteredTags.length}
            indeterminate={visibleSelectedCount > 0 && visibleSelectedCount < filteredTags.length}
            disabled={!filteredTags.length}
            onChange={(event) => toggleVisibleSelection(event.target.checked)}
          >
            全選可見 Tag
          </Checkbox>
          <Button
            size="small"
            disabled={!selectedTags.length}
            onClick={openMoveDialog}
          >
            批次移動 Tag（{selectedTags.length}）
          </Button>
        </div>
        <div className="device-tag-list">
          {filteredTags.length ? filteredTags.map((tag) => (
            <div className="device-tag-row" key={tag.id}>
              <Checkbox
                aria-label={`選取 Tag ${tag.name}`}
                checked={selectedIds.includes(tag.id)}
                onChange={(event) => toggleTagSelection(tag.id, event.target.checked)}
              />
              <div className="device-tag-info">
                <Text strong ellipsis title={tag.name}>{tag.name}</Text>
                {duplicateTagIds.has(tag.id) && (
                  <Text type="danger">名稱重複，請修改 Tag 名稱</Text>
                )}
                <Text type="secondary" ellipsis title={`${tag.type} · ${tag.memaddress}`}>
                  {tag.type || '未設定型別'} · {tag.memaddress || '未設定區段'}
                </Text>
                <Text type="secondary">
                  位址 {tag.address === undefined || tag.address === null || tag.address === ''
                    ? '—'
                    : String(tag.address)}
                  {tag.floor ? ` · ${tag.floor}` : ''}
                </Text>
              </div>
              <Space size={4}>
                <Button size="small" onClick={() => openEditDialog(tag.id)}>
                  修改
                </Button>
                <Button size="small" danger onClick={() => onDeleteTag(tag.id)}>
                  刪除
                </Button>
              </Space>
            </div>
          )) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={tags.length ? '沒有符合搜尋條件的 Tag。' : '此設備尚無 Tag。'}
            />
          )}
        </div>
      </section>
      <DeviceTagMoveDialog
        open={moveOpen}
        sourceName={sourceName}
        tagCount={selectedTags.length}
        targets={moveTargets}
        targetId={moveTargetId}
        onTargetChange={setMoveTargetId}
        onConfirm={confirmMove}
        onCancel={() => setMoveOpen(false)}
      />
      <DeviceTagEditDialog
        open={editOpen}
        form={editForm}
        existingTags={existingTags}
        editingId={editingId}
        onSave={saveEdit}
        onCancel={() => setEditOpen(false)}
      />
    </>
  )
}
