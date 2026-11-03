import type { Dispatch, SetStateAction } from 'react'
import { Button, Input, Modal, Space, Typography } from 'antd'
import { MAX_MULTI_STATE_COUNT, type MultiStateIconSet } from '../../domain/icons/iconLibrary'
import type { MultiStateIconDraft } from './IconLibraryDialog'

const { Text } = Typography

export interface MultiStateIconDialogProps {
  icon: MultiStateIconSet | undefined
  addDrafts: Record<string, MultiStateIconDraft>
  setAddDrafts: Dispatch<SetStateAction<Record<string, MultiStateIconDraft>>>
  onClose: () => void
  onMoveState: (iconSetId: string, stateKey: string, direction: -1 | 1) => void
  onRemoveState: (iconSetId: string, stateKey: string) => void
  onAddState: (iconSetId: string) => void | Promise<void>
}

export function MultiStateIconDialog({
  icon,
  addDrafts,
  setAddDrafts,
  onClose,
  onMoveState,
  onRemoveState,
  onAddState,
}: MultiStateIconDialogProps) {
  return (
    <Modal
      open={Boolean(icon)}
      title={icon ? `修改多狀態圖示組：${icon.name}` : '修改多狀態圖示組'}
      footer={null}
      onCancel={onClose}
      width={640}
      destroyOnHidden
    >
      {icon && (
        <Space orientation="vertical" size="middle" className="multi-state-library-order">
          <Text strong>狀態優先順序（第一項最高）</Text>
          {icon.states.map((state, index) => (
            <Space key={state.key} wrap>
              <Text>{index + 1}. {state.name}</Text>
              <Button
                aria-label={`${state.name} 狀態上移`}
                disabled={index === 0}
                onClick={() => onMoveState(icon.id, state.key, -1)}
              >
                上移
              </Button>
              <Button
                aria-label={`${state.name} 狀態下移`}
                disabled={index === icon.states.length - 1}
                onClick={() => onMoveState(icon.id, state.key, 1)}
              >
                下移
              </Button>
              <Button
                danger
                disabled={icon.states.length <= 1}
                onClick={() => onRemoveState(icon.id, state.key)}
              >
                刪除狀態
              </Button>
            </Space>
          ))}
          {icon.states.length < MAX_MULTI_STATE_COUNT && (
            <Space wrap>
              <Input
                aria-label={`${icon.name} 新增狀態名稱`}
                placeholder="新增狀態名稱"
                maxLength={80}
                value={addDrafts[icon.id]?.name ?? ''}
                onChange={(event) => setAddDrafts((current) => ({
                  ...current,
                  [icon.id]: {
                    name: event.target.value,
                    file: current[icon.id]?.file ?? null,
                  },
                }))}
              />
              <label className="icon-file-field">
                狀態圖片
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/gif"
                  onChange={(event) => setAddDrafts((current) => ({
                    ...current,
                    [icon.id]: {
                      name: current[icon.id]?.name ?? '',
                      file: event.target.files?.[0] ?? null,
                    },
                  }))}
                />
              </label>
              <Button
                disabled={!addDrafts[icon.id]?.name.trim() || !addDrafts[icon.id]?.file}
                onClick={() => void onAddState(icon.id)}
              >
                新增狀態
              </Button>
            </Space>
          )}
        </Space>
      )}
    </Modal>
  )
}
