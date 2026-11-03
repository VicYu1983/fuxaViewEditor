import { Card, InputNumber, Select, Typography } from 'antd'
import type { GridSettings } from '../../domain/config/types'
import { ICON_SCALE_MAX, ICON_SCALE_MIN } from '../../domain/layout/gridSettings'

const { Text } = Typography

type GridSettingsCardProps = {
  viewId: string
  grid: GridSettings
  onUpdateGrid: (viewId: string, update: Partial<GridSettings>) => void
}

export function GridSettingsCard({ viewId, grid, onUpdateGrid }: GridSettingsCardProps) {
  return (
    <Card title="Grid 排版設定" className="view-details">
      <div className="grid-settings">
        <label>
          <Text>每列元件數</Text>
          <InputNumber
            aria-label="每列元件數"
            min={1}
            max={24}
            step={1}
            value={grid.columns}
            onChange={(columns) => {
              if (columns !== null) {
                onUpdateGrid(viewId, { columns })
              }
            }}
          />
        </label>
        <label>
          <Text>起點 X</Text>
          <InputNumber
            aria-label="起點 X"
            min={0}
            value={grid.originX}
            onChange={(originX) => {
              if (originX !== null) {
                onUpdateGrid(viewId, { originX })
              }
            }}
          />
        </label>
        <label>
          <Text>起點 Y</Text>
          <InputNumber
            aria-label="起點 Y"
            min={0}
            value={grid.originY}
            onChange={(originY) => {
              if (originY !== null) {
                onUpdateGrid(viewId, { originY })
              }
            }}
          />
        </label>
        <label>
          <Text>水平間距</Text>
          <InputNumber
            aria-label="水平間距"
            min={0}
            value={grid.gapX}
            onChange={(gapX) => {
              if (gapX !== null) {
                onUpdateGrid(viewId, { gapX })
              }
            }}
          />
        </label>
        <label>
          <Text>垂直間距</Text>
          <InputNumber
            aria-label="垂直間距"
            min={0}
            value={grid.gapY}
            onChange={(gapY) => {
              if (gapY !== null) {
                onUpdateGrid(viewId, { gapY })
              }
            }}
          />
        </label>
        <label>
          <Text>圖示大小（%）</Text>
          <InputNumber
            aria-label="圖示大小"
            min={ICON_SCALE_MIN}
            max={ICON_SCALE_MAX}
            step={5}
            addonAfter="%"
            value={grid.iconScale}
            onChange={(iconScale) => {
              if (iconScale !== null) {
                onUpdateGrid(viewId, { iconScale })
              }
            }}
          />
        </label>
        <label>
          <Text>標籤位置</Text>
          <Select
            aria-label="標籤位置"
            value={grid.labelPosition}
            options={[
              { value: 'above', label: '上方' },
              { value: 'below', label: '下方' },
              { value: 'left', label: '左側' },
              { value: 'right', label: '右側' },
            ]}
            onChange={(labelPosition: GridSettings['labelPosition']) => (
              onUpdateGrid(viewId, { labelPosition })
            )}
          />
        </label>
        <label>
          <Text>標籤與圖示距離</Text>
          <InputNumber
            aria-label="標籤與圖示距離"
            min={0}
            value={grid.labelOffset}
            onChange={(labelOffset) => {
              if (labelOffset !== null) {
                onUpdateGrid(viewId, { labelOffset })
              }
            }}
          />
        </label>
        <label>
          <Text>標籤字級</Text>
          <InputNumber
            aria-label="標籤字級"
            min={8}
            max={72}
            value={grid.labelFontSize}
            onChange={(labelFontSize) => {
              if (labelFontSize !== null) {
                onUpdateGrid(viewId, { labelFontSize })
              }
            }}
          />
        </label>
      </div>
    </Card>
  )
}
