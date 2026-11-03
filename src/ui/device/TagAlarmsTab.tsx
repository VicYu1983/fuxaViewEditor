import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react'
import { Alert, Button, Checkbox, Empty, Input, InputNumber, Select, Space, Tag, Typography } from 'antd'
import type { FuxaViewSummary, ParsedFuxaConfig } from '../../domain/config/types'
import type { ExportViewModel } from '../../domain/config/prepareFuxaConfigExport'
import { parseUpdatedConfig } from '../../app/lib/parseUpdatedConfig'
import { getErrorMessage } from '../../domain/shared/getErrorMessage'
import { buildTagViewOptions } from '../../domain/tags/tagViews'
import type { IndexedTag } from '../../domain/tags/index'
import { groupByFloor } from '../../domain/tags/floor'
import {
  readAlarmInversionByTag,
  readAlarmSettingsByTag,
} from '../../domain/alarms/readTagAlarms'
import {
  applyTagAlarms,
  updateExistingTagAlarmTexts,
  updateTagAlarmInversion,
  type TagAlarmLevel,
  type TagAlarmMessageLevel,
} from '../../domain/alarms/manageTagAlarms'
import {
  needsVoiceBridgeUpdate,
  updateVoiceBridge,
} from '../../domain/config/prepareFuxaConfigExport'
import {
  getVoiceRepeatSettings,
  normalizeVoiceRepeat,
  saveVoiceRepeatSettings,
  VOICE_REPEAT_MAX,
  VOICE_REPEAT_MIN,
} from '../../domain/config/voiceRepeat'

const { Text } = Typography

const DEFAULT_ALARM_TEXT = '設備異常告警'

const TAG_ALARM_LEVEL_OPTIONS: { value: TagAlarmLevel; label: string }[] = [
  { value: 'highhigh', label: '高高 (High-High)' },
  { value: 'high', label: '高 (High)' },
  { value: 'low', label: '低 (Low)' },
  { value: 'info', label: '資訊 (Info)' },
]

const TAG_ALARM_MESSAGE_LEVEL_OPTIONS: { value: TagAlarmMessageLevel; label: string }[] = [
  { value: 'error', label: '錯誤' },
  { value: 'warning', label: '警告' },
  { value: 'success', label: '成功' },
  { value: 'info', label: '資訊' },
]

const TAG_ALARM_LEVEL_LABELS: Record<TagAlarmLevel, string> = {
  highhigh: '高高',
  high: '高',
  low: '低',
  info: '資訊',
}

export type TagAlarmNoticeType = 'success' | 'info' | 'warning' | 'error'

export interface TagAlarmStatus {
  selectedCount: number
  canSubmit: boolean
}

export interface TagAlarmsTabHandle {
  submit: () => void
}

export interface TagAlarmsTabProps {
  config: ParsedFuxaConfig | null
  tags: IndexedTag[]
  models: Map<string, ExportViewModel>
  onDocumentEdit: (document: ParsedFuxaConfig) => void
  onNotify: (type: TagAlarmNoticeType, content: string) => void
  onStatusChange: (status: TagAlarmStatus) => void
}

export const TagAlarmsTab = forwardRef<TagAlarmsTabHandle, TagAlarmsTabProps>(
  function TagAlarmsTab({
    config,
    tags,
    models,
    onDocumentEdit,
    onNotify,
    onStatusChange,
  }, ref) {
    const [tagAlarmTagIds, setTagAlarmTagIds] = useState<string[]>([])
    const [tagAlarmInversionDrafts, setTagAlarmInversionDrafts] = useState<Record<string, boolean>>({})
    const [tagAlarmSearch, setTagAlarmSearch] = useState('')
    const [tagAlarmText, setTagAlarmText] = useState(DEFAULT_ALARM_TEXT)
    const [tagAlarmLevel, setTagAlarmLevel] = useState<TagAlarmLevel>('highhigh')
    const [tagAlarmMessageLevel, setTagAlarmMessageLevel] = useState<TagAlarmMessageLevel>('error')
    const [tagAlarmTargetViewIds, setTagAlarmTargetViewIds] = useState<Record<string, string>>({})

    const tagViewOptions = useMemo(
      () => config ? buildTagViewOptions(config, models) : new Map<string, FuxaViewSummary[]>(),
      [config, models],
    )
    const selectedAlarmTags = tagAlarmTagIds.flatMap((tagId) => {
      const tag = tags.find((candidate) => candidate.id === tagId)
      return tag ? [tag] : []
    })
    const selectableAlarmTags = useMemo(
      () => tags.filter((tag) => tagViewOptions.has(tag.id)),
      [tagViewOptions, tags],
    )
    const alarmSettingsByTag = useMemo(
      () => readAlarmSettingsByTag(config?.rawConfig.alarms),
      [config],
    )
    const tagAlarmVoiceRepeats = useMemo(
      () => (config ? getVoiceRepeatSettings(config.rawConfig) : {
        highhigh: 1,
        high: 1,
        low: 1,
        info: 1,
      }),
      [config],
    )
    const alarmInversionByTag = useMemo(
      () => readAlarmInversionByTag(config?.rawConfig.alarms),
      [config],
    )
    const filteredAlarmTags = useMemo(() => {
      const query = tagAlarmSearch.trim().toLocaleLowerCase()
      return selectableAlarmTags.filter((tag) => (
        `${tag.deviceName} ${tag.name} ${tag.type} ${tag.memaddress} ${tag.id} ${tag.floor}`
          .toLocaleLowerCase()
          .includes(query)
      ))
    }, [selectableAlarmTags, tagAlarmSearch])
    const alarmTagGroups = useMemo(
      () => groupByFloor(filteredAlarmTags, (tag) => tag.floor),
      [filteredAlarmTags],
    )
    const tagAlarmTargetsMissing = selectedAlarmTags.some((tag) => (
      !tagViewOptions.get(tag.id)?.some((view) => view.id === tagAlarmTargetViewIds[tag.id])
    )) || selectedAlarmTags.length !== tagAlarmTagIds.length
    const tagsWithoutViewCount = tags.filter((tag) => !tagViewOptions.has(tag.id)).length
    const canSubmit = tagAlarmTagIds.length > 0
      && Boolean(tagAlarmText.trim())
      && !tagAlarmTargetsMissing

    useEffect(() => {
      onStatusChange({ selectedCount: tagAlarmTagIds.length, canSubmit })
    }, [canSubmit, onStatusChange, tagAlarmTagIds.length])

    function toggleVisibleAlarmTags(checked: boolean) {
      setTagAlarmTagIds((current) => {
        const next = new Set(current)
        for (const tag of filteredAlarmTags) {
          if (checked) next.add(tag.id)
          else next.delete(tag.id)
        }
        return [...next]
      })
      if (checked) {
        setTagAlarmTargetViewIds((current) => {
          const next = { ...current }
          for (const tag of filteredAlarmTags) {
            const options = tagViewOptions.get(tag.id) ?? []
            if (options.length === 1) next[tag.id] = options[0]?.id ?? ''
          }
          return next
        })
      }
    }

    function handleToggleAlarmTagInversion(tagId: string, inverted: boolean) {
      if (!config) return
      if (!alarmSettingsByTag.has(tagId)) {
        setTagAlarmInversionDrafts((current) => ({ ...current, [tagId]: inverted }))
        return
      }

      try {
        const result = updateTagAlarmInversion(config.rawConfig, tagId, inverted)
        if (!result.updated) return
        onDocumentEdit(parseUpdatedConfig(result.config, config))
        setTagAlarmInversionDrafts((current) => {
          const next = { ...current }
          delete next[tagId]
          return next
        })
        onNotify('success', `已更新 Tag「${tags.find((tag) => tag.id === tagId)?.name ?? tagId}」的告警狀態。`)
      } catch (error) {
        const detail = getErrorMessage(error)
        onNotify('error', `更新告警狀態失敗：${detail}`)
      }
    }

    function handleVoiceRepeatChange(level: TagAlarmLevel, value: unknown) {
      if (!config) return
      const next = normalizeVoiceRepeat(value)
      try {
        const updated = saveVoiceRepeatSettings(config.rawConfig, {
          ...tagAlarmVoiceRepeats,
          [level]: next,
        })
        onDocumentEdit(parseUpdatedConfig(updated, config))
      } catch (error) {
        const detail = getErrorMessage(error)
        onNotify('error', `更新語音播放次數失敗：${detail}`)
      }
    }

    function submit() {
      if (!config) return
      if (!tagAlarmTagIds.length) {
        onNotify('warning', '請至少選擇一個 Tag。')
        return
      }
      if (!tagAlarmText.trim()) {
        onNotify('warning', '請輸入告警文字。')
        return
      }
      if (tagAlarmTargetsMissing) {
        onNotify('warning', '請為每個 Tag 選擇告警動作要前往的 View。')
        return
      }

      try {
        const result = applyTagAlarms(
          config.rawConfig,
          selectedAlarmTags.map((tag) => ({
            tagId: tag.id,
            tagName: tag.name,
            text: tagAlarmText,
            level: tagAlarmLevel,
            messageLevel: tagAlarmMessageLevel,
            invertState: alarmInversionByTag.get(tag.id)
              ?? tagAlarmInversionDrafts[tag.id]
              ?? false,
            viewId: tagAlarmTargetViewIds[tag.id] ?? '',
          })),
        )
        onDocumentEdit(parseUpdatedConfig(result.config, config))
        onNotify(
          'success',
          `已設定 ${result.created + result.updated} 個告警（新增 ${result.created} 個、更新 ${result.updated} 個）。`,
        )
      } catch (error) {
        const detail = getErrorMessage(error)
        onNotify('error', `批次設定告警失敗：${detail}`)
      }
    }

    function handleQuickSetAlarmTexts() {
      if (!config) return
      try {
        const result = updateExistingTagAlarmTexts(
          config.rawConfig,
          new Map(tags.map((tag) => [tag.id, tag.name])),
          tagAlarmMessageLevel,
        )
        const voiceBridgeNeedsUpdate = needsVoiceBridgeUpdate(result.config)
        if (!result.updated && !result.toastMessagesAdded && !voiceBridgeNeedsUpdate) {
          onNotify('info', '告警文字、toastMessage 與語音觸發設定都已是最新狀態。')
          return
        }
        updateVoiceBridge(result.config)
        onDocumentEdit(parseUpdatedConfig(result.config, config))
        onNotify(
          'success',
          `已更新 ${result.updated} 筆告警，新增 ${result.toastMessagesAdded} 個 toastMessage，並同步語音觸發設定。`,
        )
      } catch (error) {
        const detail = getErrorMessage(error)
        onNotify('error', `快速更新告警文字失敗：${detail}`)
      }
    }

    useImperativeHandle(ref, () => ({ submit }))

    return (
      <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
        <Space align="center" wrap style={{ width: '100%', justifyContent: 'space-between' }}>
          <Text type="secondary">
            多選要設定的 Tag，告警文字與等級會套用至全部選取項目。布林 Tag 可反轉告警狀態（由 1 改為 0），告警觸發時會跳轉至指定 View。
          </Text>
          <Button
            disabled={alarmSettingsByTag.size === 0}
            onClick={handleQuickSetAlarmTexts}
            title="將所有已啟用告警的文字更新為 Tag 名稱加上「異常」"
          >
            快速設定
          </Button>
        </Space>
        {tagsWithoutViewCount > 0 && (
          <Alert
            type="info"
            showIcon
            message={`${tagsWithoutViewCount} 個尚未在任何 View 使用的 Tag 不列入選項，因為沒有可跳轉的 Tag 頁面。`}
          />
        )}
        <Input
          aria-label="搜尋告警 Tag"
          allowClear
          placeholder="搜尋設備、Tag、型別、ID 或樓層"
          value={tagAlarmSearch}
          onChange={(event) => setTagAlarmSearch(event.target.value)}
          style={{ margin: '12px 0' }}
        />
        <div className="floor-manager-toolbar">
          <Text type="secondary">
            {selectableAlarmTags.length} 個可設定 Tag · 已選 {tagAlarmTagIds.length} 個
          </Text>
        </div>
        <div className="floor-bulk-toolbar">
          <Checkbox
            checked={filteredAlarmTags.length > 0
              && filteredAlarmTags.every((tag) => tagAlarmTagIds.includes(tag.id))}
            indeterminate={filteredAlarmTags.some((tag) => tagAlarmTagIds.includes(tag.id))
              && !filteredAlarmTags.every((tag) => tagAlarmTagIds.includes(tag.id))}
            disabled={filteredAlarmTags.length === 0}
            onChange={(event) => toggleVisibleAlarmTags(event.target.checked)}
          >
            全選可見 Tag
          </Checkbox>
        </div>
        <div className="floor-tag-list alarm-tag-list" role="group" aria-label="告警 Tag 清單">
          {filteredAlarmTags.length ? alarmTagGroups.map((group) => (
            <section className="floor-tag-group" key={group.floor || 'all'}>
              {group.title && (
                <div className="floor-tag-group-title">
                  {group.title} · {group.items.length} 個 Tag
                </div>
              )}
              {group.items.map((tag) => (
                <div className="alarm-tag-row" key={tag.id}>
                  <Checkbox
                    aria-label={`選取 ${tag.deviceName}／${tag.name}`}
                    checked={tagAlarmTagIds.includes(tag.id)}
                    onChange={(event) => {
                      setTagAlarmTagIds((current) => event.target.checked
                        ? [...current, tag.id]
                        : current.filter((tagId) => tagId !== tag.id))
                      if (event.target.checked) {
                        const options = tagViewOptions.get(tag.id) ?? []
                        setTagAlarmTargetViewIds((current) => ({
                          ...current,
                          [tag.id]: options.length === 1 ? options[0]?.id ?? '' : '',
                        }))
                      }
                    }}
                  />
                  <span className="floor-tag-name" title={tag.name}>{tag.name}</span>
                  <Text className="floor-tag-device" type="secondary" title={tag.deviceName}>
                    {tag.deviceName}
                  </Text>
                  <Text
                    className="floor-tag-address"
                    type="secondary"
                    title={`Address: ${String(tag.record.address ?? '未設定')}`}
                  >
                    Address: {String(tag.record.address ?? '未設定')}
                  </Text>
                  {['bool', 'boolean'].includes(tag.type.toLocaleLowerCase()) && (
                    <Checkbox
                      aria-label={`${tag.name} 反轉狀態`}
                      title="啟用中的告警條件由 Tag 值 1 改為 0"
                      checked={alarmInversionByTag.get(tag.id)
                        ?? tagAlarmInversionDrafts[tag.id]
                        ?? false}
                      onChange={(event) => handleToggleAlarmTagInversion(
                        tag.id,
                        event.target.checked,
                      )}
                    >
                      反轉狀態
                    </Checkbox>
                  )}
                  <div className="alarm-tag-settings" aria-label={`${tag.name} 已設定告警`}>
                    {alarmSettingsByTag.get(tag.id)?.length ? (
                      alarmSettingsByTag.get(tag.id)?.map(({ level, text }, index) => (
                        <div className="alarm-tag-setting" key={`${level}-${index}`}>
                          <Tag>{TAG_ALARM_LEVEL_LABELS[level]}</Tag>
                          <Text
                            type="secondary"
                            ellipsis={{ tooltip: text || '未設定告警文字' }}
                          >
                            {text || '未設定告警文字'}
                          </Text>
                          <Text type="secondary">語音 {tagAlarmVoiceRepeats[level]} 次</Text>
                        </div>
                      ))
                    ) : (
                      <Text type="secondary">未設定告警</Text>
                    )}
                  </div>
                </div>
              ))}
            </section>
          )) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="沒有符合條件且已加入 View 的 Tag。"
            />
          )}
        </div>
        <label>
          告警文字（套用至所有選取 Tag）
          <Input
            aria-label="批次告警文字"
            maxLength={120}
            value={tagAlarmText}
            onChange={(event) => setTagAlarmText(event.target.value)}
          />
        </label>
        <label>
          告警等級（套用至所有選取 Tag）
          <Select
            aria-label="批次告警等級"
            value={tagAlarmLevel}
            options={TAG_ALARM_LEVEL_OPTIONS}
            onChange={setTagAlarmLevel}
          />
        </label>
        <label>
          Message 層級（套用至所有選取 Tag）
          <Select
            aria-label="Message 層級"
            value={tagAlarmMessageLevel}
            options={TAG_ALARM_MESSAGE_LEVEL_OPTIONS}
            onChange={setTagAlarmMessageLevel}
          />
        </label>
        <section className="device-tag-manager" aria-label="語音播放次數設定">
          <div className="device-tag-manager-heading">
            <Text strong>語音播放次數</Text>
            <Text type="secondary">
              每個告警等級可設定 {VOICE_REPEAT_MIN}–{VOICE_REPEAT_MAX} 次，執行時由 voiceRepeat Tag 控制
            </Text>
          </div>
          <Space orientation="vertical" style={{ width: '100%' }}>
            {TAG_ALARM_LEVEL_OPTIONS.map(({ value, label }) => (
              <div className="device-tag-row" key={value}>
                <Text strong>{label}</Text>
                <InputNumber
                  aria-label={`${label} 語音播放次數`}
                  min={VOICE_REPEAT_MIN}
                  max={VOICE_REPEAT_MAX}
                  precision={0}
                  value={tagAlarmVoiceRepeats[value]}
                  onChange={(next) => handleVoiceRepeatChange(value, next)}
                  style={{ width: 120 }}
                />
              </div>
            ))}
          </Space>
        </section>
        {selectedAlarmTags.length > 0 && (
          <section className="device-tag-manager" aria-label="告警跳轉頁面設定">
            <div className="device-tag-manager-heading">
              <Text strong>告警動作目標頁面</Text>
              <Text type="secondary">每個 Tag 可指定不同頁面</Text>
            </div>
            <Space orientation="vertical" style={{ width: '100%' }}>
              {selectedAlarmTags.map((tag) => {
                const options = tagViewOptions.get(tag.id) ?? []
                return (
                  <div className="device-tag-row" key={tag.id}>
                    <Text strong ellipsis title={`${tag.deviceName} / ${tag.name}`}>
                      {tag.deviceName} / {tag.name}
                    </Text>
                    <Select
                      aria-label={`${tag.name} 告警目標 View`}
                      placeholder={options.length
                        ? '選擇告警時要前往的 View'
                        : '此 Tag 尚未加入任何 View'}
                      disabled={options.length === 0}
                      value={tagAlarmTargetViewIds[tag.id] || undefined}
                      options={options.map((view) => ({
                        value: view.id,
                        label: view.name,
                      }))}
                      onChange={(viewId: string) => setTagAlarmTargetViewIds((current) => ({
                        ...current,
                        [tag.id]: viewId,
                      }))}
                      style={{ minWidth: 240 }}
                    />
                  </div>
                )
              })}
            </Space>
          </section>
        )}
        {selectedAlarmTags.some((tag) => (tagViewOptions.get(tag.id) ?? []).length > 1) && (
          <Alert
            type="info"
            showIcon
            message="部分 Tag 出現在多個 View，請指定告警觸發時要前往的頁面。"
          />
        )}
      </Space>
    )
  },
)
