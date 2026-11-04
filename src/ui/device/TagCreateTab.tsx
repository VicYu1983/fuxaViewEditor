import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react'
import { Checkbox, Empty, Input, InputNumber, Select, Space, Typography } from 'antd'
import type { ParsedFuxaConfig } from '../../domain/config/types'
import { isRecord } from '../../domain/shared/isRecord'
import {
  getNextAvailableAddress,
  parseTagBatchInput,
  type TagBatchSpec,
} from '../../domain/tags/batch'

const { Text } = Typography

const DEFAULT_MEMADDRESS = '000000'

export interface TagCreateRequest {
  deviceId: string
  memaddress: string
  specs: TagBatchSpec[]
  alsoAddView: boolean
}

export interface TagCreateStatus {
  specCount: number
  canCreate: boolean
}

export interface TagCreateTabHandle {
  submit: () => void
}

export interface TagCreateTabProps {
  config: ParsedFuxaConfig | null
  initialDeviceId: string
  canAddToView: boolean
  /** Returns the next available start address on success, or null on failure. */
  onCreate: (request: TagCreateRequest) => number | null
  onWarning: (message: string) => void
  onStatusChange: (status: TagCreateStatus) => void
}

function getStartAddress(config: ParsedFuxaConfig | null, deviceId: string, memaddress: string) {
  return deviceId
    ? getNextAvailableAddress(config?.rawConfig.devices[deviceId], memaddress)
    : 1
}

export const TagCreateTab = forwardRef<TagCreateTabHandle, TagCreateTabProps>(
  function TagCreateTab({
    config,
    initialDeviceId,
    canAddToView,
    onCreate,
    onWarning,
    onStatusChange,
  }, ref) {
    const [deviceId, setDeviceId] = useState(initialDeviceId)
    const [input, setInput] = useState('')
    const [nameOverrides, setNameOverrides] = useState<Record<number, string>>({})
    const [startAddress, setStartAddress] = useState(
      () => getStartAddress(config, initialDeviceId, DEFAULT_MEMADDRESS),
    )
    const [step, setStep] = useState(1)
    const [memaddress, setMemaddress] = useState(DEFAULT_MEMADDRESS)
    const [defaultType, setDefaultType] = useState('Bool')
    const [floor, setFloor] = useState('')
    const [alsoAddView, setAlsoAddView] = useState(true)

    const parsedSpecs = useMemo(() => parseTagBatchInput(input, {
      startAddress,
      step,
      defaultMemAddress: memaddress,
      defaultType,
      defaultFloor: floor,
    }), [floor, input, memaddress, startAddress, step, defaultType])
    const specs = useMemo(() => parsedSpecs.map((spec, index) => ({
      ...spec,
      name: nameOverrides[index] ?? spec.name,
    })), [parsedSpecs, nameOverrides])
    const device = config && isRecord(config.rawConfig.devices[deviceId])
      ? config.rawConfig.devices[deviceId]
      : undefined
    const duplicateNameRows = useMemo(() => {
      const duplicateRows = new Set<number>()
      const names = new Set<string>()
      if (config) {
        for (const candidate of Object.values(config.rawConfig.devices)) {
          if (!isRecord(candidate) || !isRecord(candidate.tags)) continue
          for (const tag of Object.values(candidate.tags)) {
            if (!isRecord(tag)) continue
            const name = typeof tag.name === 'string' ? tag.name.trim().toLocaleLowerCase() : ''
            if (name) names.add(name)
          }
        }
      }
      specs.forEach((spec, index) => {
        const name = spec.name.trim().toLocaleLowerCase()
        if (!name) return
        if (names.has(name)) duplicateRows.add(index)
        names.add(name)
      })
      return duplicateRows
    }, [config, specs])
    const invalidNameRows = useMemo(() => new Set(
      specs.flatMap((spec, index) => (
        !spec.name.trim() || spec.name.trim().length > 120 ? [index] : []
      )),
    ), [specs])
    const duplicateAddressRows = useMemo(() => {
      const duplicateRows = new Set<number>()
      const existingTags = device && isRecord(device.tags)
        ? Object.values(device.tags).filter(isRecord)
        : []
      const addresses = new Set(existingTags.map(
        (tag) => `${String(tag.memaddress || '')}_${String(tag.address ?? '')}`,
      ))
      specs.forEach((spec, index) => {
        const address = `${spec.memaddress}_${spec.address}`
        if (addresses.has(address)) duplicateRows.add(index)
        addresses.add(address)
      })
      return duplicateRows
    }, [device, specs])
    const hasDuplicateNames = duplicateNameRows.size > 0
    const hasInvalidNames = invalidNameRows.size > 0
    const canCreate = Boolean(deviceId) && specs.length > 0 && !hasDuplicateNames && !hasInvalidNames

    useEffect(() => {
      onStatusChange({ specCount: specs.length, canCreate })
    }, [canCreate, onStatusChange, specs.length])

    function submit() {
      if (!config || !deviceId) {
        onWarning('請先選取目標設備。')
        return
      }
      if (!specs.length) {
        onWarning('未解析出任何有效的 Tag 項目。')
        return
      }
      if (hasInvalidNames) {
        onWarning('Tag 名稱不可空白或超過 120 個字元。')
        return
      }
      if (hasDuplicateNames) {
        onWarning('Tag 名稱不可重複，請先修改預覽中標示的名稱。')
        return
      }
      const nextStartAddress = onCreate({ deviceId, memaddress, specs, alsoAddView })
      if (nextStartAddress === null) return
      setInput('')
      setNameOverrides({})
      setStartAddress(nextStartAddress)
    }

    useImperativeHandle(ref, () => ({ submit }))

    return (
      <Space orientation="vertical" size="middle" className="tag-create-manager">
        <Text type="secondary">
          每行輸入一個 Tag 名稱；也可貼上逗號或 Tab 分隔資料。名稱須全專案唯一，可直接在下方預覽修改；重複位址僅提示。
        </Text>
        <div className="tag-create-settings">
          <label>
            目標設備
            <Select
              aria-label="批次建立 Tag 目標設備"
              value={deviceId || undefined}
              placeholder="選擇設備"
              options={config
                ? Object.entries(config.rawConfig.devices)
                  .filter(([id]) => id !== '0')
                  .map(([id, value]) => ({
                    value: id,
                    label: `${String(isRecord(value) ? value.name || id : id)} (${id})`,
                  }))
                : []}
              onChange={(nextDeviceId: string) => {
                setDeviceId(nextDeviceId)
                setStartAddress(getStartAddress(config, nextDeviceId, memaddress))
              }}
            />
          </label>
          <label>
            記憶體區段
            <Select
              aria-label="Tag 記憶體區段"
              value={memaddress}
              options={[
                { value: '000000', label: '000000 · Coils' },
                { value: '100000', label: '100000 · Discrete Inputs' },
                { value: '300000', label: '300000 · Input Registers' },
                { value: '400000', label: '400000 · Holding Registers' },
              ]}
              onChange={setMemaddress}
            />
          </label>
          <label>
            預設型別
            <Select
              aria-label="Tag 預設型別"
              value={defaultType}
              options={[
                { value: 'Bool', label: 'Bool' },
                { value: 'number', label: 'number' },
                { value: 'string', label: 'string' },
              ]}
              onChange={setDefaultType}
            />
          </label>
          <label>
            起始位址
            <InputNumber
              aria-label="Tag 起始位址"
              min={0}
              precision={0}
              value={startAddress}
              onChange={(value) => setStartAddress(value ?? 0)}
            />
          </label>
          <label>
            遞增步長
            <InputNumber
              aria-label="Tag 遞增步長"
              min={1}
              precision={0}
              value={step}
              onChange={(value) => setStep(value ?? 1)}
            />
          </label>
          <label>
            預設樓層
            <Input
              aria-label="Tag 批次預設樓層"
              value={floor}
              placeholder="例如：4F"
              onChange={(event) => setFloor(event.target.value)}
            />
          </label>
        </div>
        <Input.TextArea
          aria-label="批次 Tag 資料"
          rows={6}
          value={input}
          onChange={(event) => {
            setInput(event.target.value)
            setNameOverrides({})
          }}
          placeholder={'泵浦運轉\n風機告警\n也可用欄位：名稱, 位址, 型別, 區段, 備註, 樓層'}
        />
        <div className="tag-create-preview-heading">
          <Text strong>建立預覽</Text>
          <Text type="secondary">{specs.length} 筆 Tag</Text>
        </div>
        {specs.length ? (
          <div className="tag-create-preview">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Tag 名稱</th>
                  <th>位址</th>
                  <th>區段</th>
                  <th>型別</th>
                  <th>樓層</th>
                  <th>名稱檢查</th>
                  <th>位址檢查</th>
                </tr>
              </thead>
              <tbody>
                {specs.map((spec: TagBatchSpec, index) => (
                  <tr key={`${spec.name}-${index}`}>
                    <td>{index + 1}</td>
                    <td>
                      <Input
                        aria-label={`第 ${index + 1} 筆 Tag 名稱`}
                        status={duplicateNameRows.has(index)
                          || invalidNameRows.has(index) ? 'error' : undefined}
                        maxLength={120}
                        value={spec.name}
                        onChange={(event) => setNameOverrides((current) => ({
                          ...current,
                          [index]: event.target.value,
                        }))}
                      />
                    </td>
                    <td>{spec.address}</td>
                    <td>{spec.memaddress}</td>
                    <td>{spec.type}</td>
                    <td>{spec.floor || '未設定'}</td>
                    <td>
                      {invalidNameRows.has(index)
                        ? <Text type="danger">名稱不可空白或過長</Text>
                        : duplicateNameRows.has(index)
                        ? <Text type="danger">名稱重複</Text>
                        : <Text type="success">正常</Text>}
                    </td>
                    <td>
                      {duplicateAddressRows.has(index)
                        ? <Text type="warning">位址重複</Text>
                        : <Text type="success">正常</Text>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="輸入或貼上 Tag 名稱以預覽。" />
        )}
        <Checkbox
          checked={alsoAddView}
          disabled={!canAddToView}
          onChange={(event) => setAlsoAddView(event.target.checked)}
        >
          同時將建立的 Tag 作為元件加入目前 View
        </Checkbox>
        {alsoAddView && specs.some((spec) =>
          spec.memaddress.trim() === '000000'
          && ['bool', 'boolean'].includes(spec.type.toLocaleLowerCase())) && (
          <Text type="secondary">
            Boolean Coil Tag 會建立為 Switch，並顯示 Tag 名稱標籤。
          </Text>
        )}
      </Space>
    )
  },
)
