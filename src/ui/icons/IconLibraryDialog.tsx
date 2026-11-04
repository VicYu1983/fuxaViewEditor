import { useRef, useState, type ChangeEvent } from 'react'
import { Button, Card, Empty, Image, Input, Modal, Radio, Space, Typography } from 'antd'
import {
  getIconAssets,
  MAX_MULTI_STATE_COUNT,
  type IconLibraryEntry,
} from '../../domain/icons/iconLibrary'

const { Text } = Typography

export interface MultiStateIconDraft {
  name: string
  file: File | null
}

export type IconLibraryType = 'single' | 'pair' | 'multi-state'

export interface IconAddDraft {
  name: string
  type: IconLibraryType
  singleFile: File | null
  normalFile: File | null
  alarmFile: File | null
  multiStateDrafts: MultiStateIconDraft[]
}

export interface IconLibraryDialogProps {
  open: boolean
  onClose: () => void
  canEdit: boolean
  iconLibrary: IconLibraryEntry[]
  onExport: () => void
  onImport: (event: ChangeEvent<HTMLInputElement>) => void | Promise<void>
  /** Resolves true when the icon was added; the form is cleared only on success. */
  onAddIcon: (draft: IconAddDraft) => Promise<boolean>
  onRemoveIcon: (iconId: string) => void
  onEditMultiStateIcon: (iconId: string) => void
}

const EMPTY_MULTI_STATE_DRAFTS: MultiStateIconDraft[] = [{ name: '', file: null }]

export function IconLibraryDialog({
  open,
  onClose,
  canEdit,
  iconLibrary,
  onExport,
  onImport,
  onAddIcon,
  onRemoveIcon,
  onEditMultiStateIcon,
}: IconLibraryDialogProps) {
  const importRef = useRef<HTMLInputElement>(null)
  const [iconName, setIconName] = useState('')
  const [iconType, setIconType] = useState<IconLibraryType>('single')
  const [singleIconFile, setSingleIconFile] = useState<File | null>(null)
  const [normalIconFile, setNormalIconFile] = useState<File | null>(null)
  const [alarmIconFile, setAlarmIconFile] = useState<File | null>(null)
  const [multiStateDrafts, setMultiStateDrafts] = useState<MultiStateIconDraft[]>(
    EMPTY_MULTI_STATE_DRAFTS,
  )

  async function handleAdd() {
    const added = await onAddIcon({
      name: iconName,
      type: iconType,
      singleFile: singleIconFile,
      normalFile: normalIconFile,
      alarmFile: alarmIconFile,
      multiStateDrafts,
    })
    if (!added) return
    setIconName('')
    setSingleIconFile(null)
    setNormalIconFile(null)
    setAlarmIconFile(null)
    setMultiStateDrafts(EMPTY_MULTI_STATE_DRAFTS)
  }

  return (
    <Modal
      open={open}
      title="圖示庫管理"
      footer={null}
      onCancel={onClose}
      width={760}
      destroyOnHidden
    >
      <Space orientation="vertical" size="middle" className="icon-library-manager">
        <Space wrap>
          <Button
            disabled={!canEdit || !iconLibrary.length}
            onClick={onExport}
          >
            匯出圖示庫
          </Button>
          <Button
            disabled={!canEdit}
            onClick={() => importRef.current?.click()}
          >
            匯入圖示庫
          </Button>
          <input
            ref={importRef}
            type="file"
            accept="application/json,.json"
            aria-label="匯入圖示庫 JSON"
            hidden
            onChange={(event) => void onImport(event)}
          />
          <Text type="secondary">匯入會合併圖示；若名稱或 ID 衝突，整批匯入將被拒絕。</Text>
        </Space>
        <Space wrap>
          <Input
            aria-label="圖示名稱（必填）"
            placeholder="圖示名稱（必填）"
            maxLength={120}
            value={iconName}
            onChange={(event) => setIconName(event.target.value)}
          />
          <Radio.Group
            aria-label="圖示類型"
            value={iconType}
            onChange={(event) => setIconType(event.target.value)}
            options={[
              { label: '一般圖示', value: 'single' },
              { label: '正常／告警圖示組', value: 'pair' },
              { label: '多狀態圖示組', value: 'multi-state' },
            ]}
          />
        </Space>
        {!iconName.trim() && (
          <Text type="secondary">請先輸入圖示名稱，才能新增至圖示庫。</Text>
        )}
        {iconType === 'single' ? (
          <label className="icon-file-field">
            一般圖示圖片
            <input
              type="file"
              accept="image/png,image/jpeg,image/gif"
              onChange={(event) => setSingleIconFile(event.target.files?.[0] ?? null)}
            />
          </label>
        ) : iconType === 'pair' ? (
          <Space wrap>
            <label className="icon-file-field">
              正常狀態圖片
              <input
                type="file"
                accept="image/png,image/jpeg,image/gif"
                onChange={(event) => setNormalIconFile(event.target.files?.[0] ?? null)}
              />
            </label>
            <label className="icon-file-field">
              告警狀態圖片
              <input
                type="file"
                accept="image/png,image/jpeg,image/gif"
                onChange={(event) => setAlarmIconFile(event.target.files?.[0] ?? null)}
              />
            </label>
          </Space>
        ) : (
          <Space orientation="vertical" className="icon-state-draft-list">
            <label className="icon-file-field">
              預設／正常狀態圖片
              <input
                type="file"
                accept="image/png,image/jpeg,image/gif"
                onChange={(event) => setNormalIconFile(event.target.files?.[0] ?? null)}
              />
            </label>
            <Text type="secondary">狀態依列表順序設定優先權，第一項優先權最高；最多 {MAX_MULTI_STATE_COUNT} 項。</Text>
            {multiStateDrafts.map((state, index) => (
              <Space key={`state-draft-${index}`} wrap>
                <Text>優先 {index + 1}</Text>
                <Input
                  aria-label={`狀態 ${index + 1} 名稱`}
                  placeholder="狀態名稱"
                  maxLength={80}
                  value={state.name}
                  onChange={(event) => setMultiStateDrafts((current) => current.map(
                    (candidate, candidateIndex) => candidateIndex === index
                      ? { ...candidate, name: event.target.value }
                      : candidate,
                  ))}
                />
                <label className="icon-file-field">
                  狀態圖片
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/gif"
                    onChange={(event) => setMultiStateDrafts((current) => current.map(
                      (candidate, candidateIndex) => candidateIndex === index
                        ? { ...candidate, file: event.target.files?.[0] ?? null }
                        : candidate,
                    ))}
                  />
                </label>
                <Button
                  aria-label={`狀態 ${index + 1} 上移`}
                  disabled={index === 0}
                  onClick={() => setMultiStateDrafts((current) => {
                    const next = [...current]
                    ;[next[index - 1], next[index]] = [next[index]!, next[index - 1]!]
                    return next
                  })}
                >
                  上移
                </Button>
                <Button
                  aria-label={`狀態 ${index + 1} 下移`}
                  disabled={index === multiStateDrafts.length - 1}
                  onClick={() => setMultiStateDrafts((current) => {
                    const next = [...current]
                    ;[next[index], next[index + 1]] = [next[index + 1]!, next[index]!]
                    return next
                  })}
                >
                  下移
                </Button>
                <Button
                  danger
                  disabled={multiStateDrafts.length <= 1}
                  onClick={() => setMultiStateDrafts((current) =>
                    current.filter((_candidate, candidateIndex) => candidateIndex !== index))}
                >
                  移除
                </Button>
              </Space>
            ))}
            <Button
              disabled={multiStateDrafts.length >= MAX_MULTI_STATE_COUNT}
              onClick={() => setMultiStateDrafts((current) => [...current, { name: '', file: null }])}
            >
              新增狀態
            </Button>
          </Space>
        )}
        <Button
          type="primary"
          disabled={!canEdit || !iconName.trim()
            || (iconType === 'single'
              ? !singleIconFile
              : iconType === 'pair'
                ? !normalIconFile || !alarmIconFile
                : !normalIconFile
                  || multiStateDrafts.some((state) => !state.file || !state.name.trim())
                  || new Set(multiStateDrafts.map((state) =>
                    state.name.trim().toLocaleLowerCase())).size !== multiStateDrafts.length)}
          onClick={() => void handleAdd()}
        >
          新增至圖示庫
        </Button>
        {iconLibrary.length ? (
          <div className="icon-library-list">
            {iconLibrary.map((icon) => {
              const assets = getIconAssets(icon)
              return (
                <Card
                  key={icon.id}
                  size="small"
                  title={icon.name}
                  extra={(
                    <Space size="small">
                      {icon.type === 'multi-state' && (
                        <Button
                          size="small"
                          onClick={() => onEditMultiStateIcon(icon.id)}
                        >
                          修改
                        </Button>
                      )}
                      <Button danger size="small" onClick={() => onRemoveIcon(icon.id)}>刪除</Button>
                    </Space>
                  )}
                >
                  <Space wrap>
                    {assets.map((asset, index) => (
                      <Space key={asset.id} orientation="vertical" align="center" size="small">
                        <Image src={asset.dataUrl} alt={`${icon.name} ${index + 1}`} width={64} height={64} />
                        <Text type="secondary">
                          {icon.type === 'pair'
                            ? (index === 0 ? '正常' : '告警')
                            : icon.type === 'multi-state'
                              ? index === 0 ? '預設／正常' : icon.states[index - 1]?.name
                              : '預覽'}
                        </Text>
                      </Space>
                    ))}
                  </Space>
                </Card>
              )
            })}
          </div>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="圖示庫目前沒有項目。" />
        )}
      </Space>
    </Modal>
  )
}
