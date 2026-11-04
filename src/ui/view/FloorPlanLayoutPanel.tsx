import { useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import { Card, Typography } from 'antd'
import type { FloorGroupFrameSettings, GridSettings } from '../../domain/config/types'
import type { FloorLayoutComponent, FloorTag } from '../../domain/layout/floorLayout'
import { getCanvasWidth } from '../../domain/layout/floorLayout'
import { layoutFloorViewComponents } from '../../domain/layout/floorPlanViews'
import type { FloorPlanTagOffsets } from '../../domain/layout/floorPlanViews'
import { isRecord } from '../../domain/config/validateFuxaConfig'

const { Text } = Typography

const DEFAULT_WIDTH = 1024
const DEFAULT_HEIGHT = 768

type FloorPlanLayoutModel = {
  components: FloorLayoutComponent[]
  grid: GridSettings
  floorPlan?: boolean
  floorPlanTagOffsets?: FloorPlanTagOffsets
}

type FloorPlanLayoutPanelProps = {
  model: FloorPlanLayoutModel
  profile: unknown
  tags: Map<string, FloorTag>
  floorGroupFrame: FloorGroupFrameSettings
  onMoveTag: (tagId: string, dx: number, dy: number) => void
}

type DragState = {
  tagId: string
  startX: number
  startY: number
  dx: number
  dy: number
}

function dimension(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback
}

function roundToTenth(value: number): number {
  return Math.round(value * 10) / 10
}

export function FloorPlanLayoutPanel({
  model,
  profile,
  tags,
  floorGroupFrame,
  onMoveTag,
}: FloorPlanLayoutPanelProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [drag, setDrag] = useState<DragState | null>(null)
  const safeProfile = isRecord(profile) ? profile : {}
  const width = dimension(safeProfile.width, DEFAULT_WIDTH)
  const height = dimension(safeProfile.height, DEFAULT_HEIGHT)
  const layout = layoutFloorViewComponents(
    model,
    tags,
    floorGroupFrame,
    getCanvasWidth(profile),
  )
  const movable = layout.placements.filter(({ component }) => component.managed !== false)

  function handlePointerDown(event: PointerEvent<SVGGElement>, tagId: string) {
    event.currentTarget.setPointerCapture(event.pointerId)
    setDrag({ tagId, startX: event.clientX, startY: event.clientY, dx: 0, dy: 0 })
  }

  function handlePointerMove(event: PointerEvent<SVGGElement>) {
    if (!drag) return
    const rect = svgRef.current?.getBoundingClientRect()
    const scale = rect && rect.width > 0 ? width / rect.width : 1
    setDrag({
      ...drag,
      dx: roundToTenth((event.clientX - drag.startX) * scale),
      dy: roundToTenth((event.clientY - drag.startY) * scale),
    })
  }

  function finishDrag() {
    if (drag && (drag.dx !== 0 || drag.dy !== 0)) {
      onMoveTag(drag.tagId, drag.dx, drag.dy)
    }
    setDrag(null)
  }

  return (
    <Card title="平面圖 Tag 配置" className="view-details">
      <Text type="secondary">拖拉 Tag 群組調整位置，位置會記錄在匯出的 extra 中。</Text>
      {movable.length === 0 ? (
        <Text type="secondary">此 View 沒有可拖拉的 Tag。</Text>
      ) : (
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          style={{ width: '100%', background: '#fff', border: '1px solid #d9d9d9', touchAction: 'none' }}
          onPointerMove={handlePointerMove}
          onPointerUp={finishDrag}
          onPointerCancel={finishDrag}
        >
          {layout.sections.map((section) => (
            <text key={section.floor} x={section.x} y={section.titleY} fontSize={16} fontWeight="bold">
              {section.title}
            </text>
          ))}
          {movable.map(({ component, placement }) => {
            const isDragging = drag?.tagId === component.tagId
            const dx = isDragging ? drag.dx : 0
            const dy = isDragging ? drag.dy : 0
            const { shape, label } = placement
            const text = component.label || tags.get(component.tagId)?.name
            return (
              <g
                key={component.tagId}
                data-tag-id={component.tagId}
                style={{ cursor: 'move' }}
                onPointerDown={(event) => handlePointerDown(event, component.tagId)}
              >
                <rect
                  x={shape.x + dx}
                  y={shape.y + dy}
                  width={shape.width}
                  height={shape.height}
                  fill="rgba(22, 119, 255, 0.15)"
                  stroke="#1677ff"
                />
                <text
                  x={label.x + dx}
                  y={label.y + dy}
                  textAnchor={label.anchor}
                  fontSize={12}
                >
                  {typeof text === 'string' ? text : String(component.tagId)}
                </text>
              </g>
            )
          })}
        </svg>
      )}
    </Card>
  )
}
