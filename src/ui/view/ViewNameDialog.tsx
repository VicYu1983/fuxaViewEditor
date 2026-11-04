import { Form, Input, Modal, Typography, type FormInstance } from 'antd'

const { Text } = Typography

export type ViewDialogMode = 'create' | 'rename'

interface ViewNameDialogProps {
  mode: ViewDialogMode | null
  form: FormInstance<{ name: string }>
  validateName: (value: unknown) => void
  onSubmit: (values: { name: string }) => void
  onCancel: () => void
  onOk: () => void
}

export function ViewNameDialog({
  mode,
  form,
  validateName,
  onSubmit,
  onCancel,
  onOk,
}: ViewNameDialogProps) {
  return (
    <Modal
      open={mode !== null}
      title={mode === 'rename' ? '修改 View 名稱' : '新增空白 View'}
      okText={mode === 'rename' ? '儲存名稱' : '建立 View'}
      cancelText="取消"
      onCancel={onCancel}
      onOk={onOk}
      destroyOnHidden
    >
      <Text type="secondary">
        {mode === 'rename'
          ? '修改名稱不會變更 View ID 或其導覽連結。'
          : '建立空白畫布，之後可新增 Tag 元件。'}
      </Text>
      <Form form={form} layout="vertical" onFinish={onSubmit} style={{ marginTop: 16 }}>
        <Form.Item
          label="View 名稱"
          name="name"
          rules={[
            { required: true, whitespace: true, message: 'View 名稱不可空白。' },
            {
              validator: async (_, value: unknown) => validateName(value),
            },
          ]}
        >
          <Input autoFocus maxLength={120} />
        </Form.Item>
      </Form>
    </Modal>
  )
}
