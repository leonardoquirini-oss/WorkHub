import { API_CONFIG } from '../api/config'
import { workHubAPI } from '../api/WorkHubAPI'
import { useYardStore } from '../store/yardStore'
import { useUIStore } from '../store/uiStore'
import { logger } from '../utils/logger'
import type { YardEvent } from '../types'

const CONNECT_TIMEOUT_MS = 5000
const POLL_INTERVAL_MS = 15000
const MAX_BACKOFF_MS = 30000

/**
 * Keeps the yard in sync with the server.
 *
 * Primary channel: SSE `GET /api/workhub/yards/{id}/stream?access_token=...` (EventSource
 * cannot set headers, so the token travels in the query string). Events: `connected`, then
 * `yard` with a `YardEvent` payload applied through `yardStore.applyYardEvent`.
 *
 * Fallback: when EventSource is unavailable or no `connected` arrives within 5 s, the
 * snapshot is polled every 15 s until the stream comes back. Reconnects with exponential
 * backoff, reopens after a token refresh and pauses while the tab is hidden.
 */
class YardEventsClient {
  private yardId: number | null = null
  private source: EventSource | null = null
  private attempts = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private connectTimer: ReturnType<typeof setTimeout> | null = null
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private connected = false
  private active = false
  private unsubscribeToken: (() => void) | null = null
  private visibilityBound = false

  start(yardId: number) {
    this.stop()
    this.yardId = yardId
    this.active = true
    this.attempts = 0
    this.bindGlobalListeners()
    void this.connect()
  }

  stop() {
    this.active = false
    this.yardId = null
    this.closeSource()
    this.clearTimers()
    this.stopPolling()
    this.unsubscribeToken?.()
    this.unsubscribeToken = null
    useUIStore.getState().setRealtime('offline')
  }

  private bindGlobalListeners() {
    this.unsubscribeToken = workHubAPI.addTokenRefreshListener(() => {
      // The stream URL embeds the old token: reopen with the new one.
      if (this.active) this.restart()
    })
    if (!this.visibilityBound && typeof document !== 'undefined') {
      this.visibilityBound = true
      document.addEventListener('visibilitychange', () => this.onVisibilityChange())
    }
  }

  private onVisibilityChange() {
    if (!this.active) return
    if (document.hidden) {
      this.closeSource()
      this.clearTimers()
      this.stopPolling()
      useUIStore.getState().setRealtime('offline')
    } else {
      this.attempts = 0
      void useYardStore.getState().loadSnapshot(this.yardId ?? undefined)
      void this.connect()
    }
  }

  private restart() {
    this.closeSource()
    this.clearTimers()
    void this.connect()
  }

  private async connect() {
    if (!this.active || this.yardId === null) return
    if (typeof EventSource === 'undefined') {
      logger.warn('EventSource non disponibile: uso il polling')
      this.startPolling()
      return
    }

    let token: string
    try {
      token = await workHubAPI.ensureValidToken()
    } catch (err) {
      logger.debug('Stream: token non disponibile', err)
      this.scheduleReconnect()
      return
    }
    if (!this.active) return

    const yardId = this.yardId
    const url = `${API_CONFIG.apiUrl}/workhub/yards/${yardId}/stream?access_token=${encodeURIComponent(token)}`
    const source = new EventSource(url)
    this.source = source
    this.connected = false
    useUIStore.getState().setRealtime('connecting')

    this.connectTimer = setTimeout(() => {
      if (!this.connected) {
        logger.warn('Stream: nessuna conferma entro 5 s, attivo il polling')
        this.startPolling()
      }
    }, CONNECT_TIMEOUT_MS)

    source.addEventListener('connected', () => {
      this.connected = true
      this.attempts = 0
      this.clearTimers()
      this.stopPolling()
      useUIStore.getState().setRealtime('sse')
      logger.debug(`Stream piazzale ${yardId} connesso`)
    })
    source.addEventListener('yard', (e) => this.onYardEvent(e as MessageEvent<string>))
    source.onerror = () => {
      if (this.source !== source) return
      logger.debug('Stream interrotto, riconnessione programmata')
      this.closeSource()
      this.startPolling()
      this.scheduleReconnect()
    }
  }

  private onYardEvent(e: MessageEvent<string>) {
    try {
      const event = JSON.parse(e.data) as YardEvent
      useYardStore.getState().applyYardEvent(event)
    } catch (err) {
      logger.error('Evento piazzale non leggibile', err, e.data)
    }
  }

  private scheduleReconnect() {
    if (!this.active || this.reconnectTimer) return
    this.attempts += 1
    const delay = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** (this.attempts - 1))
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      void this.connect()
    }, delay)
  }

  private startPolling() {
    if (this.pollTimer || !this.active) return
    useUIStore.getState().setRealtime('polling')
    this.pollTimer = setInterval(() => {
      if (!this.active || this.connected) return
      void useYardStore.getState().loadSnapshot(this.yardId ?? undefined)
    }, POLL_INTERVAL_MS)
  }

  private stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
  }

  private closeSource() {
    this.connected = false
    if (this.source) {
      this.source.close()
      this.source = null
    }
  }

  private clearTimers() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.connectTimer) {
      clearTimeout(this.connectTimer)
      this.connectTimer = null
    }
  }
}

export const yardEvents = new YardEventsClient()
