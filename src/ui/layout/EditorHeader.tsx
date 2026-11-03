import { RedoOutlined, UndoOutlined } from '@ant-design/icons'
import { Button, Input, Layout, Space, Tooltip, Typography } from 'antd'

const { Header } = Layout
const { Text } = Typography

export interface EditorHeaderProps {
  projectName: string
  onProjectNameChange: (value: string) => void
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  fuxaSyncStatus: 'disconnected' | 'ready' | 'pending'
  hasConfig: boolean
  onSyncToFuxa: () => void
  onOpenProjectManager: () => void
  onOpenIconLibrary: () => void
  onOpenViewSettings: () => void
}

export function EditorHeader({
  projectName,
  onProjectNameChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  fuxaSyncStatus,
  hasConfig,
  onSyncToFuxa,
  onOpenProjectManager,
  onOpenIconLibrary,
  onOpenViewSettings,
}: EditorHeaderProps) {
  return (
    <Header className="editor-header">
      <div className="brand">
        <div className="brand-mark">F</div>
        <div>
          <Text className="brand-name">FUXA View Editor</Text>
          <Text className="brand-caption">View 元件批次管理工具</Text>
        </div>
      </div>
      <Space size="middle">
        <Input
          className="project-name-input"
          aria-label="專案名稱"
          placeholder="輸入專案名稱"
          maxLength={120}
          value={projectName}
          onChange={(event) => onProjectNameChange(event.target.value)}
          title="載入時使用 JSON 最外層的 name；匯出時也會同步更新該欄位。"
        />
        <Tooltip title="復原">
          <Button
            aria-label="復原"
            icon={<UndoOutlined />}
            disabled={!canUndo}
            onClick={onUndo}
          />
        </Tooltip>
        <Tooltip title="重做">
          <Button
            aria-label="重做"
            icon={<RedoOutlined />}
            disabled={!canRedo}
            onClick={onRedo}
          />
        </Tooltip>
        {fuxaSyncStatus !== 'disconnected' && (
          <Button
            type="primary"
            loading={fuxaSyncStatus === 'pending'}
            disabled={!hasConfig || fuxaSyncStatus !== 'ready'}
            onClick={onSyncToFuxa}
          >
            同步至 FUXA
          </Button>
        )}
        <Button disabled={!hasConfig} onClick={onOpenProjectManager}>
          專案管理
        </Button>
        <Button disabled={!hasConfig} onClick={onOpenIconLibrary}>
          圖示庫
        </Button>
        <Button disabled={!hasConfig} onClick={onOpenViewSettings}>
          View 設定
        </Button>
      </Space>
    </Header>
  )
}
