import { useEffect } from 'react'
import { useYardStore } from '../store/yardStore'
import { yardEvents } from '../services/yardEvents'

/** Opens the realtime channel for the selected yard and closes it on change/unmount. */
export function useYardEvents() {
  const selectedYardId = useYardStore((s) => s.selectedYardId)

  useEffect(() => {
    if (!selectedYardId) return
    yardEvents.start(selectedYardId)
    return () => yardEvents.stop()
  }, [selectedYardId])
}
