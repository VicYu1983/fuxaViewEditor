import { useEffect, useRef, useState } from 'react'
import type { MouseEvent, PointerEvent } from 'react'
import { Alert, Button, Card, Empty, Space, Switch, Tag, Typography } from 'antd'

const { Text } = Typography

const SELECTED_TARGET_STYLE = {
  stroke: '#1677ff',
  'stroke-width': '2',
  'stroke-dasharray': '4 2',
}

function roundToTenth(value: number) {
  return Math.round(value * 10) / 10
}

function getTagElements(container: HTMLElement, tagId: string) {
  return Array.from(container.querySelectorAll<SVGElement>('[data-preview-tag-id]'))
    .filter((element) => element.getAttribute('data-preview-tag-id') === tagId)
}

function setTagTranslate(container: HTMLElement, tagId: string, dx: number, dy: number) {
  getTagElements(container, tagId).forEach((element) => {
    element.setAttribute('transform', `translate(${dx} ${dy})`)
  })
}

export interface PreviewResult {
  width: number
  height: number
  outsideCanvas?: boolean
  svgMarkup?: string
  error?: string
}

export interface PreviewPanelProps {
  preview: PreviewResult | null | undefined
  realtime: boolean
  onRealtimeChange: (checked: boolean) => void
  onRefresh: () => void
  hasSelection: boolean
  viewName: string | undefined
  stale: boolean
  onMoveTag?: (tagId: string, dx: number, dy: number) => void
}

interface DragState {
  tagId: string
  startX: number
  startY: number
  scale: number
  baseDx: number
  baseDy: number
  dx: number
  dy: number
}

export function PreviewPanel({
  preview,
  realtime,
  onRealtimeChange,
  onRefresh,
  hasSelection,
  viewName,
  stale,
  onMoveTag,
}: PreviewPanelProps) {
  const [selectedTag, setSelectedTag] = useState<{ id: string; label: string } | null>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const pendingOffsetsRef = useRef(new Map<string, { dx: number; dy: number }>())
  const svgMarkup = preview?.svgMarkup

  useEffect(() => {
    pendingOffsetsRef.current.clear()
  }, [svgMarkup])

  useEffect(() => {
    const container = previewRef.current
    if (!container) return
    container.querySelectorAll<SVGElement>('rect[data-preview-tag-id]').forEach((element) => {
      const isSelected = element.getAttribute('data-preview-tag-id') === selectedTag?.id
      Object.entries(SELECTED_TARGET_STYLE).forEach(([name, value]) => {
        if (isSelected) element.setAttribute(name, value)
        else element.removeAttribute(name)
      })
    })
  }, [selectedTag, svgMarkup])

  function selectFromEvent(event: MouseEvent<HTMLDivElement> | PointerEvent<HTMLDivElement>) {
    const target = (event.target as Element).closest?.('[data-preview-tag-id]')
    if (!target) return null
    const selection = {
      id: target.getAttribute('data-preview-tag-id') ?? '',
      label: target.getAttribute('data-preview-tag-label') ?? '',
    }
    setSelectedTag(selection)
    return selection
  }

  function handlePreviewClick(event: MouseEvent<HTMLDivElement>) {
    selectFromEvent(event)
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!onMoveTag || event.button !== 0) return
    const container = previewRef.current
    const svg = container?.querySelector('svg')
    const selection = selectFromEvent(event)
    if (!container || !svg || !selection?.id) return
    const renderedWidth = svg.getBoundingClientRect().width
    if (!preview?.width || !renderedWidth) return
    const pending = pendingOffsetsRef.current.get(selection.id) ?? { dx: 0, dy: 0 }
    dragRef.current = {
      tagId: selection.id,
      startX: event.clientX,
      startY: event.clientY,
      scale: preview.width / renderedWidth,
      baseDx: pending.dx,
      baseDy: pending.dy,
      dx: 0,
      dy: 0,
    }
    container.setPointerCapture?.(event.pointerId)
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    const container = previewRef.current
    if (!drag || !container) return
    drag.dx = (event.clientX - drag.startX) * drag.scale
    drag.dy = (event.clientY - drag.startY) * drag.scale
    setTagTranslate(container, drag.tagId, drag.baseDx + drag.dx, drag.baseDy + drag.dy)
  }

  function finishDrag(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    dragRef.current = null
    const container = previewRef.current
    if (!drag || !container) return
    container.releasePointerCapture?.(event.pointerId)
    const dx = roundToTenth(drag.dx)
    const dy = roundToTenth(drag.dy)
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
      setTagTranslate(container, drag.tagId, drag.baseDx, drag.baseDy)
      return
    }
    const total = { dx: roundToTenth(drag.baseDx + dx), dy: roundToTenth(drag.baseDy + dy) }
    pendingOffsetsRef.current.set(drag.tagId, total)
    setTagTranslate(container, drag.tagId, total.dx, total.dy)
    onMoveTag?.(drag.tagId, dx, dy)
  }

  return (
    <Card
      title="SVG 預覽"
      extra={(
        <Space size="small" wrap>
          <Text type="secondary">{realtime ? '即時預覽' : '手動預覽'}</Text>
          <Switch
            aria-label="即時更新 SVG 預覽"
            checked={realtime}
            checkedChildren="即時"
            unCheckedChildren="手動"
            onChange={onRealtimeChange}
          />
          <Button size="small" disabled={!hasSelection} onClick={onRefresh}>
            更新預覽
          </Button>
          {preview && !preview.error && (
            <>
              <Text type="secondary">{preview.width} × {preview.height}</Text>
              {preview.outsideCanvas && <Tag color="warning">排列超出畫布</Tag>}
            </>
          )}
          {hasSelection && stale && (
            <Tag color="warning">
              {realtime ? '預覽更新中' : '預覽尚未更新'}
            </Tag>
          )}
        </Space>
      )}
      className="view-details preview-card"
    >
      {preview?.error ? (
        <Alert
          type="warning"
          showIcon
          title="無法顯示預覽"
          description={preview.error}
        />
      ) : preview?.svgMarkup ? (
        <>
          <div
            ref={previewRef}
            className="svg-preview"
            role="img"
            aria-label={`${viewName ?? 'View'} 唯讀 SVG 預覽`}
            onClick={handlePreviewClick}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={finishDrag}
            onPointerCancel={finishDrag}
            dangerouslySetInnerHTML={{ __html: preview.svgMarkup }}
          />
          {selectedTag && (
            <Text type="secondary">
              已選取 Tag：{selectedTag.label}（{selectedTag.id}）
            </Text>
          )}
        </>
      ) : (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={hasSelection
            ? realtime ? '正在產生預覽…' : '請按「更新預覽」產生預覽。'
            : '尚無可預覽的 View。'}
        />
      )}
    </Card>
  )
}
