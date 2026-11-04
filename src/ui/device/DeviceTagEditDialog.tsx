import { Form, Input, InputNumber, Modal } from 'antd'
import type { FormInstance } from 'antd'
import type { DeviceTagUpdate } from '../../features/devices/manageDeviceTags'

export interface DeviceTagEditDialogProps {
  open: boolean
  form: FormInstance<DeviceTagUpdate>
  existingTags: Array<{ id: string; name: string }>
  editingId: string
  onSave: (values: DeviceTagUpdate) => void
  onCancel: () => void
}

export function DeviceTagEditDialog({
  open,
  form,
  existingTags,
  editingId,
  onSave,
  onCancel,
}: DeviceTagEditDialogProps) {
  return (
    <Modal
      open={open}
      title="修改 Tag"
      okText="儲存 Tag"
      cancelText="取消"
      onCancel={onCancel}
      onOk={() => form.submit()}
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={onSave}
      >
        <Form.Item
          name="name"
          label="Tag 名稱"
          rules={[
            { required: true, whitespace: true, message: 'Tag 名稱不可空白。' },
            { max: 120, message: 'Tag 名稱不可超過 120 個字元。' },
            {
              validator: async (_, value: unknown) => {
                const name = typeof value === 'string' ? value.trim().toLocaleLowerCase() : ''
                if (!name) return
                const duplicate = existingTags.some((tag) => (
                  tag.id !== editingId
                  && tag.name.trim().toLocaleLowerCase() === name
                ))
                if (duplicate) throw new Error('此名稱已被其他 Tag 使用。')
              },
            },
          ]}
        >
          <Input maxLength={120} />
        </Form.Item>
        <Form.Item
          name="address"
          label="位址 (address)"
          rules={[
            {
              validator: async (_, value: unknown) => {
                if (value === undefined || value === null || value === '') return
                if (!Number.isSafeInteger(Number(value)) || Number(value) < 0 || Number(value) > 65535) {
                  throw new Error('位址必須是 0 到 65535 之間的整數。')
                }
              },
            },
          ]}
        >
          <InputNumber min={0} max={65535} precision={0} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item
          name="type"
          label="資料型別"
          rules={[{ required: true, whitespace: true, message: 'Tag 型別不可空白。' }]}
        >
          <Input placeholder="例如 Bool、number、string" />
        </Form.Item>
        <Form.Item
          name="memaddress"
          label="記憶體區段 (memaddress)"
          rules={[{ required: true, whitespace: true, message: '記憶體區段不可空白。' }]}
        >
          <Input placeholder="例如 000000" />
        </Form.Item>
        <Form.Item name="description" label="備註">
          <Input />
        </Form.Item>
        <Form.Item name="floor" label="群組">
          <Input placeholder="例如 4F" />
        </Form.Item>
      </Form>
    </Modal>
  )
}
