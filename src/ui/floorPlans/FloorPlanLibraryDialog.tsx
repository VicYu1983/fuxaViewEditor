import { useRef, useState, type ChangeEvent } from 'react'
import { Button, Empty, Image, Modal, Space, Typography } from 'antd'
import type { BuildingFloor } from '../../domain/buildingFloors/buildingFloors'
import type { FloorPlanLibrary } from '../../domain/floorPlans/floorPlanLibrary'

const { Text } = Typography

const LARGE_PLAN_BYTES = 1024 * 1024

export interface FloorPlanLibraryDialogProps {
  open: boolean
  onClose: () => void
  canEdit: boolean
  floorGroups: Map<string, BuildingFloor[]>
  library: FloorPlanLibrary
  /** Resolves true when the plan was saved; the file input is reset either way. */
  onSetPlan: (floorKey: string, file: File) => Promise<boolean>
  onRemovePlan: (floorKey: string) => void
}

function approximateBytes(dataUrl: string): number {
  const base64Length = dataUrl.length - dataUrl.indexOf(',') - 1
  return Math.floor(base64Length * 3 / 4)
}

export function FloorPlanLibraryDialog({
  open,
  onClose,
  canEdit,
  floorGroups,
  library,
  onSetPlan,
  onRemovePlan,
}: FloorPlanLibraryDialogProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [targetFloorKey, setTargetFloorKey] = useState('')

  function startUpload(floorKey: string) {
    setTargetFloorKey(floorKey)
    fileRef.current?.click()
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file || !targetFloorKey) return
    await onSetPlan(targetFloorKey, file)
  }

  return (
    <Modal
      open={open}
      title="平面圖庫管理"
      footer={null}
      onCancel={onClose}
      width={760}
      destroyOnHidden
    >
      <Space orientation="vertical" size="middle" className="floor-plan-library-manager">
        <Text type="secondary">
          樓層來自建築樓層 View（名稱格式「系統/1F」、「系統/B1F」）。平面圖為 PNG，會作為所有同樓層 View 的底圖。
        </Text>
        <input
          ref={fileRef}
          type="file"
          accept="image/png"
          aria-label="上傳平面圖 PNG"
          hidden
          onChange={(event) => void handleFileChange(event)}
        />
        {floorGroups.size === 0 && (
          <Empty description="尚無建築樓層 View" />
        )}
        {[...floorGroups.entries()].map(([system, floors]) => (
          <Space key={system} orientation="vertical" size="small" style={{ width: '100%' }}>
            <Text strong>{system}</Text>
            {floors.map((floor) => {
              const plan = library[floor.name]
              return (
                <Space key={floor.id} align="start" size="middle" wrap>
                  <div style={{ width: 120 }}>
                    <Text>{floor.floorLabel}</Text>
                  </div>
                  {plan ? (
                    <Image
                      width={120}
                      src={plan.dataUrl}
                      alt={`${floor.name} 平面圖`}
                    />
                  ) : (
                    <Text type="secondary">尚未設定平面圖</Text>
                  )}
                  {plan && (
                    <Text type="secondary">{plan.width} × {plan.height}</Text>
                  )}
                  {plan && approximateBytes(plan.dataUrl) > LARGE_PLAN_BYTES && (
                    <Text type="warning">
                      平面圖超過 1 MB，會使 View 檔案明顯變大；建議先在外部減少色彩數。
                    </Text>
                  )}
                  <Button
                    disabled={!canEdit}
                    onClick={() => startUpload(floor.name)}
                  >
                    {plan ? '替換圖片' : '上傳圖片'}
                  </Button>
                  {plan && (
                    <Button
                      danger
                      disabled={!canEdit}
                      onClick={() => onRemovePlan(floor.name)}
                    >
                      移除
                    </Button>
                  )}
                </Space>
              )
            })}
          </Space>
        ))}
      </Space>
    </Modal>
  )
}
