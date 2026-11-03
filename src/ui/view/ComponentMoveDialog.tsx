import { Modal, Select, Typography } from 'antd'
import type { ViewTargetOption } from '../../domain/views/viewTargetOptions'

const { Text } = Typography

interface ComponentMoveDialogProps {
  open: boolean
  targetOptions: ViewTargetOption[]
  targetId: string
  onTargetChange: (value: string) => void
  onCancel: () => void
  onOk: () => void
}

export function ComponentMoveDialog({
  open,
  targetOptions,
  targetId,
  onTargetChange,
  onCancel,
  onOk,
}: ComponentMoveDialogProps) {
  return (
    <Modal
      open={open}
      title="移動元件至 View"
      okText="移動"
      cancelText="取消"
      okButtonProps={{ disabled: !targetId }}
      onCancel={onCancel}
      onOk={onOk}
      destroyOnHidden
    >
      <Text type="secondary">
        選擇要移入此元件的目標 View；元件會從目前 View 移除。
      </Text>
      <Select
        aria-label="移動至 View"
        style={{ marginTop: 16, width: '100%' }}
        value={targetId || undefined}
        placeholder="選擇目標 View"
        options={targetOptions}
        onChange={onTargetChange}
      />
    </Modal>
  )
}
