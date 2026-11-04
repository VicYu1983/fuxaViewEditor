import { Modal, Select, Space, Typography } from 'antd'

const { Text } = Typography

export interface DeviceTagMoveTarget {
  id: string
  name: string
}

export interface DeviceTagMoveDialogProps {
  open: boolean
  sourceName: string
  tagCount: number
  targets: DeviceTagMoveTarget[]
  targetId: string
  onTargetChange: (targetId: string) => void
  onConfirm: () => void
  onCancel: () => void
}

export function DeviceTagMoveDialog({
  open,
  sourceName,
  tagCount,
  targets,
  targetId,
  onTargetChange,
  onConfirm,
  onCancel,
}: DeviceTagMoveDialogProps) {
  return (
    <Modal
      open={open}
      title="批次移動 Tag"
      okText="移動"
      cancelText="取消"
      onCancel={onCancel}
      onOk={onConfirm}
      okButtonProps={{ disabled: !targetId }}
      destroyOnHidden
    >
      <Space orientation="vertical" className="device-tag-move-body">
        <Text>
          將 {tagCount} 個 Tag 從「{sourceName}」移動到：
        </Text>
        {targets.length ? (
          <Select
            aria-label="目標設備"
            className="device-tag-move-target"
            value={targetId || undefined}
            onChange={onTargetChange}
            options={targets.map((device) => ({
              value: device.id,
              label: device.name,
            }))}
          />
        ) : (
          <Text type="secondary">沒有其他可用的 ModbusTCP 設備。</Text>
        )}
        <Text type="secondary">Tag ID 會保留；若名稱與現有 Tag 重複，會自動加上 _1、_2。</Text>
      </Space>
    </Modal>
  )
}
