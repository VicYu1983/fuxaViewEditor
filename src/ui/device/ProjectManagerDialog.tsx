import type { ModalProps, TabsProps } from 'antd'
import { Modal, Tabs } from 'antd'

export type ProjectManagerTab = 'devices' | 'floors' | 'alarms' | 'tag-create' | 'tag-add'

export interface ProjectManagerDialogProps {
  open: boolean
  tab: ProjectManagerTab
  onTabChange: (tab: ProjectManagerTab) => void
  okText: string
  footer: ModalProps['footer']
  onOk: ModalProps['onOk']
  onCancel: () => void
  width: number
  items: NonNullable<TabsProps['items']>
}

function toProjectManagerTab(key: string): ProjectManagerTab {
  return key === 'floors' || key === 'alarms' || key === 'tag-create' || key === 'tag-add'
    ? key
    : 'devices'
}

export function ProjectManagerDialog({
  open,
  tab,
  onTabChange,
  okText,
  footer,
  onOk,
  onCancel,
  width,
  items,
}: ProjectManagerDialogProps) {
  return (
    <Modal
      open={open}
      title="專案管理"
      okText={okText}
      cancelText="關閉"
      footer={footer}
      onCancel={onCancel}
      onOk={onOk}
      width={width}
      destroyOnHidden
    >
      <Tabs
        activeKey={tab}
        onChange={(key) => onTabChange(toProjectManagerTab(key))}
        items={items}
      />
    </Modal>
  )
}
