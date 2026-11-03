import { Form, Input, InputNumber, Modal, Space, Switch, Tabs, Typography } from 'antd'
import type { FormInstance } from 'antd'
import type { FloorGroupFrameSettings } from '../../domain/config/types'

const { Text } = Typography

export interface FloorGroupFrameFormValues extends Omit<FloorGroupFrameSettings, 'fillOpacity'> {
  fillOpacityPercent: number
}

export interface ViewPropertiesFormValues {
  bkcolor: string
  viewTitleColor: string
  viewTitleFontSize: number
  siteName: string
  siteColor: string
  siteFontSize: number
  siteBold: boolean
  siteItalic: boolean
  siteUnderline: boolean
}

export type ViewSettingsTab = 'floor-frame' | 'view-properties'

export interface ViewSettingsDialogProps {
  open: boolean
  tab: ViewSettingsTab
  onTabChange: (tab: ViewSettingsTab) => void
  floorFrameForm: FormInstance<FloorGroupFrameFormValues>
  viewPropertiesForm: FormInstance<ViewPropertiesFormValues>
  onFloorFrameSubmit: (values: FloorGroupFrameFormValues) => void
  onViewPropertiesSubmit: (values: ViewPropertiesFormValues) => void
  onCancel: () => void
}

export function ViewSettingsDialog({
  open,
  tab,
  onTabChange,
  floorFrameForm,
  viewPropertiesForm,
  onFloorFrameSubmit,
  onViewPropertiesSubmit,
  onCancel,
}: ViewSettingsDialogProps) {
  return (
    <Modal
      open={open}
      title="View 設定"
      okText="套用所有 View"
      cancelText="取消"
      onCancel={onCancel}
      onOk={() => {
        if (tab === 'floor-frame') floorFrameForm.submit()
        else viewPropertiesForm.submit()
      }}
      width={640}
      destroyOnHidden
    >
      <Tabs
        activeKey={tab}
        onChange={(key) => onTabChange(key === 'view-properties' ? 'view-properties' : 'floor-frame')}
        items={[
          {
            key: 'floor-frame',
            label: '樓層框樣式',
            children: <>
        <Text type="secondary">
          設定會套用至所有 View 的樓層 Group 底框；左右固定內縮 10px，上下可調整內距，並可使用 Undo/Redo 還原。
        </Text>
        <Form
          form={floorFrameForm}
          layout="vertical"
          onFinish={onFloorFrameSubmit}
          className="floor-frame-form"
          style={{ marginTop: 16 }}
        >
          <Form.Item label="底色" name="fill" rules={[{ required: true }]}>
            <Input type="color" aria-label="樓層底框底色" />
          </Form.Item>
          <Form.Item
            label="透明度 (%)"
            name="fillOpacityPercent"
            rules={[
              { required: true, type: 'number', min: 0, max: 100, message: '請輸入 0–100。' },
            ]}
          >
            <InputNumber min={0} max={100} step={1} />
          </Form.Item>
          <Form.Item label="邊框色" name="stroke" rules={[{ required: true }]}>
            <Input type="color" aria-label="樓層底框邊框色" />
          </Form.Item>
          <Form.Item
            label="邊框粗細"
            name="strokeWidth"
            rules={[
              { required: true, type: 'number', min: 0, max: 10, message: '請輸入 0–10。' },
            ]}
          >
            <InputNumber min={0} max={10} step={0.5} />
          </Form.Item>
          <Form.Item
            label="圓角"
            name="cornerRadius"
            rules={[
              { required: true, type: 'number', min: 0, max: 100, message: '請輸入 0–100。' },
            ]}
          >
            <InputNumber min={0} max={100} step={1} />
          </Form.Item>
          <Form.Item
            label="上下內距"
            name="padding"
            rules={[
              { required: true, type: 'number', min: 0, max: 200, message: '請輸入 0–200。' },
            ]}
          >
            <InputNumber min={0} max={200} step={1} />
          </Form.Item>
        </Form>
            </>,
          },
          {
            key: 'view-properties',
            label: 'View 屬性',
            children: <>
        <Text type="secondary">
          背景色與 View 名稱標籤樣式會套用至所有 View；名稱標籤設定會保存於匯出 JSON 的 extra，並可使用 Undo/Redo 還原。
        </Text>
        <Form
          form={viewPropertiesForm}
          layout="vertical"
          onFinish={onViewPropertiesSubmit}
          style={{ marginTop: 16 }}
        >
          <Form.Item label="背景色" name="bkcolor" rules={[{ required: true }]}>
            <Input type="color" aria-label="View 背景色" />
          </Form.Item>
          <Form.Item label="View 名稱標籤顏色" name="viewTitleColor" rules={[{ required: true }]}>
            <Input type="color" aria-label="View 名稱標籤顏色" />
          </Form.Item>
          <Form.Item
            label="View 名稱標籤大小"
            name="viewTitleFontSize"
            rules={[
              { required: true, type: 'number', min: 8, max: 72, message: '請輸入 8–72。' },
            ]}
          >
            <InputNumber min={8} max={72} step={1} aria-label="View 名稱標籤大小" />
          </Form.Item>
          <Form.Item
            label="案場名稱（顯示於每個 View 右下角）"
            name="siteName"
            extra="留空則移除所有 View 的案場名稱標籤；設定會保存於 extra.fuxaSetting.siteNameLabel，避免重複建立。"
          >
            <Input aria-label="案場名稱" allowClear />
          </Form.Item>
          <Form.Item label="案場名稱顏色" name="siteColor" rules={[{ required: true }]}>
            <Input type="color" aria-label="案場名稱顏色" />
          </Form.Item>
          <Form.Item
            label="案場名稱大小"
            name="siteFontSize"
            rules={[
              { required: true, type: 'number', min: 8, max: 72, message: '請輸入 8–72。' },
            ]}
          >
            <InputNumber min={8} max={72} step={1} aria-label="案場名稱大小" />
          </Form.Item>
          <Space size="large">
            <Form.Item label="粗體" name="siteBold" valuePropName="checked">
              <Switch aria-label="案場名稱粗體" />
            </Form.Item>
            <Form.Item label="斜體" name="siteItalic" valuePropName="checked">
              <Switch aria-label="案場名稱斜體" />
            </Form.Item>
            <Form.Item label="底線" name="siteUnderline" valuePropName="checked">
              <Switch aria-label="案場名稱底線" />
            </Form.Item>
          </Space>
        </Form>
            </>,
          },
        ]}
      />
    </Modal>
  )
}
