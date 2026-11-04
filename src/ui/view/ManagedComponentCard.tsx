// Here, floor means a Tag group within one View, not a cross-View building floor.
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Empty,
  Image,
  Input,
  Select,
  Space,
  Tag,
  Typography,
} from 'antd'
import {
  DeleteOutlined,
  DownOutlined,
  SwapOutlined,
  UpOutlined,
} from '@ant-design/icons'
import type { FloorLayoutComponent } from '../../domain/layout/floorLayout'
import type { IconLibraryEntry } from '../../domain/icons/iconLibrary'
import type { IndexedTag } from '../../domain/tags/index'
import type { GeneratedComponent } from '../../domain/svg/validateGeneratedView'
import {
  getComponentGraphicChoices,
  selectedComponentGraphic,
} from '../../features/icons/componentGraphics'

const { Text } = Typography

export type ComponentUpdate = Partial<Pick<
  GeneratedComponent,
  'label' | 'tagId' | 'palette' | 'invertIconState'
>>

export type ManagedComponentGroup = {
  floor: string
  title: string
  items: GeneratedComponent[]
}

type ManagedComponentCardProps = {
  viewId: string
  managedCount: number
  groups: ManagedComponentGroup[]
  tags: IndexedTag[]
  iconLibrary: IconLibraryEntry[]
  batchAddDisabled: boolean
  batchMoveDisabled: boolean
  onOpenBatchAdd: () => void
  onOpenBatchMove: (viewId: string) => void
  onUpdateComponent: (viewId: string, key: string, update: ComponentUpdate) => void
  onUpdateGraphic: (viewId: string, component: GeneratedComponent, value: string) => void
  onUpdateMultiStateBinding: (
    viewId: string,
    component: GeneratedComponent,
    stateKey: string,
    tagId: string,
  ) => void
  onMoveComponent: (viewId: string, key: string, direction: -1 | 1) => void
  onOpenComponentMove: (viewId: string, key: string) => void
  onRemoveComponent: (viewId: string, key: string) => void
}

function tagLabel(tag: IndexedTag): string {
  return `${tag.deviceName} / ${tag.name} (${tag.type || '未設定型別'})`
}

function tagOptions(tags: IndexedTag[], component: FloorLayoutComponent) {
  const options = tags.map((tag) => ({
    value: tag.id,
    label: tagLabel(tag),
    disabled: (component.template === 'icon-pair' || component.template === 'icon-multi')
      && !['bool', 'boolean'].includes(tag.type.toLocaleLowerCase()),
  }))
  if (component.tagId && !tags.some((tag) => tag.id === component.tagId)) {
    options.unshift({
      value: component.tagId,
      label: `Tag 不存在（${component.tagId}）`,
      disabled: true,
    })
  }
  return options
}

export function ManagedComponentCard({
  viewId,
  managedCount,
  groups,
  tags,
  iconLibrary,
  batchAddDisabled,
  batchMoveDisabled,
  onOpenBatchAdd,
  onOpenBatchMove,
  onUpdateComponent,
  onUpdateGraphic,
  onUpdateMultiStateBinding,
  onMoveComponent,
  onOpenComponentMove,
  onRemoveComponent,
}: ManagedComponentCardProps) {
  return (
    <Card
      title="已管理元件"
      extra={(
        <Space>
          <Tag>{managedCount}</Tag>
          <Button
            size="small"
            disabled={batchAddDisabled}
            onClick={onOpenBatchAdd}
          >
            批次加入 Tag
          </Button>
          <Button
            size="small"
            disabled={batchMoveDisabled}
            onClick={() => onOpenBatchMove(viewId)}
          >
            批次移動
          </Button>
        </Space>
      )}
      className="view-details"
    >
      {managedCount > 0 ? (
        <div className="component-list">
          <Text type="secondary">
            使用箭頭調整同一群組內的元件順序；排序會同步套用至預覽與匯出。
          </Text>
          {groups.map((group) => (
            <section className="managed-component-floor" key={group.floor}>
              <Text className="managed-component-floor-title" type="secondary">
                {group.title}
              </Text>
              {group.items.map((component, index) => (
                <div
                  className={`component-row${
                    component.template === 'icon-multi' ? ' component-row-multi' : ''
                  }`}
                  key={component.key}
                >
                  <div className="component-meta">
                    <Input
                      aria-label="元件標籤"
                      value={component.label ?? ''}
                      placeholder="元件標籤"
                      maxLength={120}
                      onChange={(event) => onUpdateComponent(
                        viewId,
                        component.key,
                        { label: event.target.value },
                      )}
                    />
                    <Select
                      aria-label="綁定 Tag"
                      showSearch
                      optionFilterProp="label"
                      value={component.tagId || undefined}
                      placeholder="選擇 Tag"
                      options={tagOptions(tags, component)}
                      onChange={(tagId: string) => {
                        if (component.template === 'icon-multi') {
                          const primaryBinding = component.multiStateBindings?.[0]
                          if (primaryBinding) {
                            onUpdateMultiStateBinding(
                              viewId,
                              component,
                              primaryBinding.stateKey,
                              tagId,
                            )
                            return
                          }
                        }
                        onUpdateComponent(viewId, component.key, { tagId })
                      }}
                    />
                    <Select
                      aria-label="圖形"
                      value={selectedComponentGraphic(component, iconLibrary)}
                      options={getComponentGraphicChoices(
                        iconLibrary,
                        component,
                        ['bool', 'boolean'].includes(
                          tags.find((tag) => tag.id === component.tagId)
                            ?.type.toLocaleLowerCase() ?? '',
                        ),
                      )}
                      onChange={(value: string) => onUpdateGraphic(viewId, component, value)}
                    />
                    {component.template === 'icon-pair' && (
                      <Checkbox
                        checked={Boolean(component.invertIconState)}
                        onChange={(event) => onUpdateComponent(
                          viewId,
                          component.key,
                          { invertIconState: event.target.checked },
                        )}
                      >
                        反轉狀態
                      </Checkbox>
                    )}
                    {component.template !== 'icon-pair'
                      && component.template !== 'icon-multi' && (
                      <Select
                        aria-label="顏色狀態"
                        value={component.palette === 'alarm' ? 'alarm' : 'normal'}
                        options={[
                          { value: 'normal', label: '一般狀態配色' },
                          { value: 'alarm', label: '告警狀態配色' },
                        ]}
                        onChange={(palette: 'normal' | 'alarm') => onUpdateComponent(
                          viewId,
                          component.key,
                          { palette },
                        )}
                      />
                    )}
                  </div>
                  {component.template === 'icon-multi' && (
                    <div className="multi-state-bindings">
                      <Text strong>多狀態 Tag 綁定</Text>
                      {!iconLibrary.some((icon) =>
                        icon.type === 'multi-state' && icon.id === component.multiIconSetId)
                        && (
                          <Alert
                            type="error"
                            showIcon
                            title={`找不到多狀態圖示組「${component.multiIconSetId || ''}」。`}
                          />
                        )}
                      {(component.multiStateBindings ?? []).map((binding, bindingIndex) => {
                        const iconSet = iconLibrary.find((icon) =>
                          icon.type === 'multi-state'
                          && icon.id === component.multiIconSetId)
                        const stateDefinition = iconSet?.type === 'multi-state'
                          ? iconSet.states.find((state) => state.key === binding.stateKey)
                          : undefined
                        const stateTagOptions = tags
                          .filter((tag) => ['bool', 'boolean'].includes(
                            tag.type.toLocaleLowerCase(),
                          ))
                          .map((tag) => ({
                            value: tag.id,
                            label: tagLabel(tag),
                            disabled: component.multiStateBindings?.some(
                              (candidate) => candidate.stateKey !== binding.stateKey
                                && candidate.tagId === tag.id,
                            ) ?? false,
                          }))
                        if (binding.tagId && !stateTagOptions.some(
                          (option) => option.value === binding.tagId,
                        )) {
                          const existingTag = tags.find((tag) => tag.id === binding.tagId)
                          stateTagOptions.unshift({
                            value: binding.tagId,
                            label: existingTag
                              ? `Tag 型別不符（${tagLabel(existingTag)}）`
                              : `Tag 不存在（${binding.tagId}）`,
                            disabled: true,
                          })
                        }
                        return (
                          <div className="multi-state-binding-row" key={binding.stateKey}>
                            {stateDefinition && (
                              <Image
                                src={stateDefinition.asset.dataUrl}
                                alt={`${stateDefinition.name} 圖示`}
                                width={32}
                                height={32}
                              />
                            )}
                            <Text>
                              優先 {bindingIndex + 1} · {stateDefinition?.name ?? binding.stateKey}
                            </Text>
                            <Select
                              aria-label={`${stateDefinition?.name ?? binding.stateKey} 狀態 Tag`}
                              allowClear
                              showSearch
                              optionFilterProp="label"
                              value={binding.tagId || undefined}
                              placeholder="選擇 Boolean Tag"
                              options={stateTagOptions}
                              onChange={(tagId: string | undefined) => (
                                onUpdateMultiStateBinding(
                                  viewId,
                                  component,
                                  binding.stateKey,
                                  tagId ?? '',
                                )
                              )}
                            />
                          </div>
                        )
                      })}
                      <Text type="secondary">
                        優先順序依圖示庫狀態列表設定；同一元件不可重複綁定 Tag。
                      </Text>
                    </div>
                  )}
                  <Space
                    className="component-actions"
                    direction="vertical"
                    size={0}
                  >
                    <Button
                      size="small"
                      type="text"
                      aria-label={`移動 ${component.label || '元件'} 至其他 View`}
                      title="移動至其他 View"
                      onClick={() => onOpenComponentMove(viewId, component.key)}
                      icon={<SwapOutlined />}
                    />
                    <Button
                      size="small"
                      type="text"
                      aria-label={`上移 ${component.label || '元件'}`}
                      title="在此群組上移"
                      disabled={index === 0}
                      onClick={() => onMoveComponent(viewId, component.key, -1)}
                      icon={<UpOutlined />}
                    />
                    <Button
                      size="small"
                      type="text"
                      aria-label={`下移 ${component.label || '元件'}`}
                      title="在此群組下移"
                      disabled={index === group.items.length - 1}
                      onClick={() => onMoveComponent(viewId, component.key, 1)}
                      icon={<DownOutlined />}
                    />
                    <Button
                      danger
                      size="small"
                      type="text"
                      aria-label={`刪除 ${component.label || '元件'}`}
                      title="刪除此元件"
                      onClick={() => {
                        if (window.confirm('刪除此元件？匯出時會從 View 的 SVG 和 items 一併移除。')) {
                          onRemoveComponent(viewId, component.key)
                        }
                      }}
                      icon={<DeleteOutlined />}
                    />
                  </Space>
                </div>
              ))}
            </section>
          ))}
        </div>
      ) : (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="此 View 沒有可管理的元件。"
        />
      )}
    </Card>
  )
}
