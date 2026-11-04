import {
  Alert,
  Button,
  Checkbox,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Tag,
  Typography,
  type FormInstance,
} from 'antd'
import type { ManagedDeviceTag, ModbusDeviceEntry, ModbusDeviceFormValues } from '../../domain/devices/readModbusDevices'
import type { ModbusAddressFillPlan } from '../../domain/devices/modbusTcp'
import type { IndexedTag } from '../../domain/tags/index'
import type { DeviceTagUpdate } from '../../features/devices/manageDeviceTags'
import { DeviceTagManager } from './DeviceTagManager'

const { Text } = Typography

export interface DevicesTabProps {
  mode: 'create' | 'edit'
  managedDeviceId: string
  devices: ModbusDeviceEntry[]
  managedDevice: ModbusDeviceEntry | undefined
  managedDeviceTags: ManagedDeviceTag[]
  autoFilledTagCount: number
  duplicateTagGroups: IndexedTag[][]
  duplicateTagIds: Set<string>
  moveTargets: ModbusDeviceEntry[]
  existingTags: Array<{ id: string; name: string }>
  canBatchAddTags: boolean
  canBatchCreateTags: boolean
  addressFillPlan: ModbusAddressFillPlan | null
  addressFillError: string | null
  addressShiftStep: number | null
  deviceManagerForm: FormInstance<ModbusDeviceFormValues>
  deviceTagForm: FormInstance<DeviceTagUpdate>
  deviceTagSession: number
  onSelectDevice: (deviceId: string) => void
  onCreateDevice: () => void
  onOpenBatchAddTags: () => void
  onOpenTagCreate: () => void
  onAddressShiftStepChange: (value: number | null) => void
  onShiftAddresses: (direction: 1 | -1) => void
  onFillAddresses: () => void
  onDeleteAutoFilledTags: () => void
  onDeleteDevice: () => void
  onSaveDevice: (values: ModbusDeviceFormValues) => void
  onPrepareTagEdit: (tagId: string) => boolean
  onUpdateTag: (values: DeviceTagUpdate, tagId: string) => boolean
  onMoveTags: (targetId: string, tagIds: string[]) => boolean
  onDeleteTag: (tagId: string) => void
}

export function DevicesTab({
  mode,
  managedDeviceId,
  devices,
  managedDevice,
  managedDeviceTags,
  autoFilledTagCount,
  duplicateTagGroups,
  duplicateTagIds,
  moveTargets,
  existingTags,
  canBatchAddTags,
  canBatchCreateTags,
  addressFillPlan,
  addressFillError,
  addressShiftStep,
  deviceManagerForm,
  deviceTagForm,
  deviceTagSession,
  onSelectDevice,
  onCreateDevice,
  onOpenBatchAddTags,
  onOpenTagCreate,
  onAddressShiftStepChange,
  onShiftAddresses,
  onFillAddresses,
  onDeleteAutoFilledTags,
  onDeleteDevice,
  onSaveDevice,
  onPrepareTagEdit,
  onUpdateTag,
  onMoveTags,
  onDeleteTag,
}: DevicesTabProps) {
  return (
    <>
      <div className="device-manager-toolbar">
        <Select
          aria-label="選擇 ModbusTCP 設備"
          value={mode === 'create' ? undefined : managedDeviceId}
          placeholder="選擇 ModbusTCP 設備"
          options={devices.map(({ id, record }) => ({
            value: id,
            label: `${String(record.name || id)} (${id})`,
          }))}
          onChange={onSelectDevice}
        />
        <Button onClick={onCreateDevice}>
          新增 ModbusTCP 設備
        </Button>
        <Button disabled={!canBatchAddTags} onClick={onOpenBatchAddTags}>
          批次加入 Tag
        </Button>
        <Button disabled={!canBatchCreateTags} onClick={onOpenTagCreate}>
          批次建立 Tag
        </Button>
      </div>
      {mode === 'edit' && (
        <Alert
          showIcon
          type={duplicateTagGroups.length ? 'warning' : 'success'}
          message={duplicateTagGroups.length
            ? `全專案名稱檢查：發現 ${duplicateTagGroups.length} 組重複名稱，共 ${duplicateTagGroups.reduce((count, group) => count + group.length, 0)} 個 Tag`
            : '全專案名稱檢查：目前沒有重複的 Tag 名稱'}
          description={duplicateTagGroups.length ? (
            <Space wrap>
              {duplicateTagGroups.slice(0, 8).map((group) => {
                const firstTag = group[0]
                if (!firstTag) return null
                return (
                  <Tag key={firstTag.name.trim().toLocaleLowerCase()}>
                    {firstTag.name}：{group.map((tag) => tag.deviceName).join('、')}
                  </Tag>
                )
              })}
              {duplicateTagGroups.length > 8
                ? <Text type="secondary">另有 {duplicateTagGroups.length - 8} 組未顯示</Text>
                : null}
            </Space>
          ) : undefined}
          style={{ marginTop: 12 }}
        />
      )}
      {mode === 'edit' && managedDevice && (
        <div className="device-manager-summary">
          <Text type="secondary">
            {managedDeviceTags.length} 個 Tag
            {addressFillPlan?.hasAnchor
              ? ` · 位址 ${addressFillPlan.startAddress}–${addressFillPlan.endAddress}，缺漏 ${addressFillPlan.missing.length} 個`
              : addressFillError
                ? ` · ${addressFillError}`
                : ' · 尚無可補位的起始 Tag'}
          </Text>
          <Space wrap>
            <Button onClick={() => onShiftAddresses(1)}>
              Tag address 全部 +{addressShiftStep ?? ''}
            </Button>
            <Button onClick={() => onShiftAddresses(-1)}>
              Tag address 全部 -{addressShiftStep ?? ''}
            </Button>
            <InputNumber
              aria-label="Tag address 調整數值"
              min={1}
              max={65535}
              precision={0}
              value={addressShiftStep}
              onChange={onAddressShiftStepChange}
              style={{ width: 90 }}
            />
            <Button
              onClick={onFillAddresses}
              disabled={!addressFillPlan?.hasAnchor || addressFillPlan.missing.length === 0}
            >
              補齊缺漏位址
            </Button>
            <Button
              danger
              disabled={autoFilledTagCount === 0}
              onClick={onDeleteAutoFilledTags}
            >
              移除補位 Tag ({autoFilledTagCount})
            </Button>
            {managedDeviceId !== '0' && (
              <Button danger onClick={onDeleteDevice}>刪除此設備</Button>
            )}
          </Space>
        </div>
      )}
      {mode === 'edit' && managedDevice && (
        <DeviceTagManager
          key={deviceTagSession}
          sourceName={typeof managedDevice.record.name === 'string'
            ? managedDevice.record.name
            : managedDeviceId}
          tags={managedDeviceTags}
          duplicateTagIds={duplicateTagIds}
          moveTargets={moveTargets.map((device) => ({
            id: device.id,
            name: typeof device.record.name === 'string' ? device.record.name : device.id,
          }))}
          existingTags={existingTags}
          editForm={deviceTagForm}
          onPrepareEdit={onPrepareTagEdit}
          onUpdateTag={onUpdateTag}
          onMoveTags={onMoveTags}
          onDeleteTag={onDeleteTag}
        />
      )}
      <Form
        form={deviceManagerForm}
        layout="vertical"
        onFinish={onSaveDevice}
        className="device-manager-form"
      >
        <Form.Item
          name="name"
          label="設備名稱"
          rules={[
            { required: true, whitespace: true, message: '設備名稱不可空白。' },
            { max: 120, message: '設備名稱不可超過 120 個字元。' },
          ]}
        >
          <Input maxLength={120} />
        </Form.Item>
        <Form.Item name="address" label="連線位址 (IP:Port)">
          <Input placeholder="127.0.0.1:502" />
        </Form.Item>
        <Form.Item
          name="addressCount"
          label="地址數量（0 表示不自動補位）"
          rules={[
            { required: true, message: '請輸入地址數量。' },
            {
              validator: async (_, value: unknown) => {
                if (!Number.isSafeInteger(Number(value)) || Number(value) < 0 || Number(value) > 65536) {
                  throw new Error('地址數量必須是 0 到 65536 之間的整數。')
                }
              },
            },
          ]}
        >
          <InputNumber min={0} max={65536} precision={0} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item
          name="slaveid"
          label="站號 (Unit ID)"
          rules={[
            { required: true, message: '請輸入站號。' },
            {
              validator: async (_, value: unknown) => {
                if (!Number.isSafeInteger(Number(value)) || Number(value) < 1 || Number(value) > 247) {
                  throw new Error('站號必須是 1 到 247 之間的整數。')
                }
              },
            },
          ]}
        >
          <InputNumber min={1} max={247} precision={0} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="polling" label="輪詢週期 (ms)">
          <InputNumber min={10} step={10} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="enabled" valuePropName="checked">
          <Checkbox>啟用設備</Checkbox>
        </Form.Item>
      </Form>
      <Text type="secondary">
        儲存 addressCount 時會以目前最小有效位址為起點，複製其 Tag 範本補齊相同 memaddress 區段的缺漏；位址 +/- 調整會先檢查整台設備的所有 Tag，超出 0–65535 時整批取消。
      </Text>
    </>
  )
}
