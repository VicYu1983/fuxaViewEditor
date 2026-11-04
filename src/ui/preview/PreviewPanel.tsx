import { useState } from 'react'
import type { MouseEvent } from 'react'
import { Alert, Button, Card, Empty, Space, Switch, Tag, Typography } from 'antd'

const { Text } = Typography

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
}

export function PreviewPanel({
  preview,
  realtime,
  onRealtimeChange,
  onRefresh,
  hasSelection,
  viewName,
  stale,
}: PreviewPanelProps) {
  const [selectedTag, setSelectedTag] = useState<{ id: string; label: string } | null>(null)

  function handlePreviewClick(event: MouseEvent<HTMLDivElement>) {
    const target = (event.target as Element).closest?.('[data-preview-tag-id]')
    if (!target) return
    setSelectedTag({
      id: target.getAttribute('data-preview-tag-id') ?? '',
      label: target.getAttribute('data-preview-tag-label') ?? '',
    })
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
            className="svg-preview"
            role="img"
            aria-label={`${viewName ?? 'View'} 唯讀 SVG 預覽`}
            onClick={handlePreviewClick}
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
