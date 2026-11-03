import { Checkbox, Modal, Select, Typography } from 'antd'
import type { ViewTargetOption } from '../../domain/views/viewTargetOptions'

const { Text } = Typography

export interface BatchMoveItem {
  key: string
  label: string
}

interface BatchMoveDialogProps {
  open: boolean
  items: BatchMoveItem[]
  selectedKeys: ReadonlySet<string>
  onToggleItem: (key: string, checked: boolean) => void
  targetOptions: ViewTargetOption[]
  targetId: string
  onTargetChange: (value: string) => void
  onCancel: () => void
  onOk: () => void
}

export function BatchMoveDialog({
  open,
  items,
  selectedKeys,
  onToggleItem,
  targetOptions,
  targetId,
  onTargetChange,
  onCancel,
  onOk,
}: BatchMoveDialogProps) {
  return (
    <Modal
      open={open}
      title="批次移動元件"
      okText={`移動 ${selectedKeys.size} 個`}
      cancelText="取消"
      okButtonProps={{ disabled: selectedKeys.size === 0 || !targetId }}
      onCancel={onCancel}
      onOk={onOk}
      width={640}
      destroyOnHidden
    >
      <Text type="secondary">
        選擇要移動的已管理元件及目標 View。元件會從目前 View 移除。
      </Text>
      <Select
        aria-label="批次移動至 View"
        style={{ margin: '16px 0', width: '100%' }}
        value={targetId || undefined}
        placeholder="選擇目標 View"
        options={targetOptions}
        onChange={onTargetChange}
      />
      <div className="batch-tag-list" role="group" aria-label="選擇要移動的元件">
        {items.map((item) => (
          <Checkbox
            key={item.key}
            checked={selectedKeys.has(item.key)}
            onChange={(event) => onToggleItem(item.key, event.target.checked)}
          >
            {item.label}
          </Checkbox>
        ))}
      </div>
    </Modal>
  )
}
