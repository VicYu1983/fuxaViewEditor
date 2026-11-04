import { Button, Layout, Space, Tag, Typography } from 'antd'
import type { FuxaViewSummary } from '../../domain/config/types'

const { Sider } = Layout
const { Text } = Typography

export interface ViewSidebarProps {
  views: FuxaViewSummary[] | null
  selectedView: FuxaViewSummary | undefined
  onSelectView: (viewId: string) => void
  onCreateView: () => void
  onRenameView: () => void
  onDeleteView: () => void
}

export function ViewSidebar({
  views,
  selectedView,
  onSelectView,
  onCreateView,
  onRenameView,
  onDeleteView,
}: ViewSidebarProps) {
  const viewCount = views?.length ?? 0
  const selectedKey = selectedView?.id || selectedView?.key

  return (
    <Sider width={260} theme="light" className="view-sidebar">
      <div className="sidebar-heading">
        <div className="sidebar-title">
          <Text strong>Views</Text>
          <Tag>{viewCount}</Tag>
        </div>
        <Space size={4} wrap>
          <Button
            size="small"
            onClick={onCreateView}
            disabled={!views}
            aria-label="新增 View"
          >
            新增
          </Button>
          <Button
            size="small"
            onClick={onRenameView}
            disabled={!selectedView?.id}
            aria-label="修改 View 名稱"
          >
            改名
          </Button>
          <Button
            size="small"
            danger
            onClick={onDeleteView}
            disabled={!selectedView?.id || viewCount <= 1}
            aria-label="刪除 View"
          >
            刪除
          </Button>
        </Space>
      </div>
      {views ? (
        views.length > 0 ? (
          <nav className="view-list" aria-label="View 清單">
            {views.map((view) => (
              <Button
                key={view.key}
                type="text"
                block
                className={(view.id || view.key) === selectedKey ? 'view-item selected' : 'view-item'}
                aria-current={(view.id || view.key) === selectedKey ? 'page' : undefined}
                onClick={() => onSelectView(view.id || view.key)}
              >
                <Text ellipsis title={view.name}>{view.name}</Text>
                <Text className="view-id" ellipsis title={view.id}>{view.id || '無 ID'}</Text>
              </Button>
            ))}
          </nav>
        ) : (
          <div className="sidebar-empty">
            <Text type="secondary">配置中沒有 View。</Text>
          </div>
        )
      ) : (
        <div className="sidebar-empty">
          <Text type="secondary">等待 FUXA 傳送專案資料後，View 清單會顯示於此。</Text>
        </div>
      )}
    </Sider>
  )
}
