import { useEffect, useRef, useState } from 'react'
import type { MessageInstance } from 'antd/es/message/interface'
import { parseFuxaConfig } from '../../domain/config/parseFuxaConfig'
import type { ParsedFuxaConfig } from '../../domain/config/types'
import { getErrorMessage } from '../../domain/shared/getErrorMessage'
import { isRecord } from '../../domain/shared/isRecord'

export type FuxaSyncStatus = 'disconnected' | 'ready' | 'pending'

export interface UseFuxaHostOptions {
  messageApi: MessageInstance
  loadProject: (parsed: ParsedFuxaConfig) => void
  buildSyncProject: () => unknown | null
}

export interface UseFuxaHostResult {
  status: FuxaSyncStatus
  sync: () => void
}

function getHostWindow(): Window | null {
  return window.parent !== window ? window.parent : window.opener
}

export function useFuxaHost({
  messageApi,
  loadProject,
  buildSyncProject,
}: UseFuxaHostOptions): UseFuxaHostResult {
  const [status, setStatus] = useState<FuxaSyncStatus>('disconnected')
  const revisionRef = useRef<string | null>(null)
  const handlersRef = useRef({ loadProject, buildSyncProject })

  useEffect(() => {
    handlersRef.current = { loadProject, buildSyncProject }
  })

  useEffect(() => {
    const hostWindow = getHostWindow()
    if (!hostWindow) return

    function handleFuxaMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin || event.source !== hostWindow) return
      const data: unknown = event.data
      if (!isRecord(data) || data.source !== 'fuxa-host' || data.protocol !== 1) return

      if (data.type === 'project' || (data.type === 'sync-result' && data.ok === true)) {
        if (typeof data.revision !== 'string') {
          setStatus('disconnected')
          messageApi.error('FUXA 傳回的同步版本無效。')
          return
        }
        try {
          const projectText = JSON.stringify(data.project)
          if (typeof projectText !== 'string') throw new Error('專案資料不是有效的 JSON。')
          const parsed = parseFuxaConfig(projectText)
          handlersRef.current.loadProject(parsed)
          revisionRef.current = data.revision
          setStatus('ready')
          if (data.type === 'sync-result') {
            messageApi.success('專案已同步並儲存至 FUXA。')
            if (window.parent === window && window.opener && !window.opener.closed) {
              window.opener.focus()
              window.close()
            }
          }
        } catch (error) {
          revisionRef.current = null
          setStatus('disconnected')
          messageApi.error(`載入 FUXA 專案失敗：${getErrorMessage(error)}`)
        }
        return
      }

      if (data.type === 'sync-result') {
        setStatus('ready')
        messageApi.error(typeof data.error === 'string' ? data.error : 'FUXA 拒絕了這次同步。')
      }
    }

    window.addEventListener('message', handleFuxaMessage)
    hostWindow.postMessage({
      source: 'fuxa-view-editor',
      protocol: 1,
      type: 'ready',
    }, window.location.origin)
    return () => window.removeEventListener('message', handleFuxaMessage)
  }, [messageApi])

  function sync() {
    const hostWindow = getHostWindow()
    if (status !== 'ready' || !revisionRef.current || !hostWindow) return
    try {
      const project = handlersRef.current.buildSyncProject()
      if (project === null) return
      hostWindow.postMessage({
        source: 'fuxa-view-editor',
        protocol: 1,
        type: 'sync-project',
        revision: revisionRef.current,
        project,
      }, window.location.origin)
      setStatus('pending')
    } catch (error) {
      messageApi.error(`準備同步資料失敗：${getErrorMessage(error)}`)
    }
  }

  return { status, sync }
}
