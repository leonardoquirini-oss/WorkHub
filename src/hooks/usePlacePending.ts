import { useCallback } from 'react'
import { useUIStore } from '../store/uiStore'
import { useYardStore } from '../store/yardStore'
import { notify } from '../store/notificationStore'
import type { SlotRef } from '../types'

/**
 * Completes an "Aggiungi container" flow: the modal stores the container data in
 * `uiStore.pendingEnter`, then the operator taps a free slot (3D ground or 2D map).
 */
export function usePlacePending() {
  const pendingEnter = useUIStore((s) => s.pendingEnter)
  const setPendingEnter = useUIStore((s) => s.setPendingEnter)
  const selectContainer = useUIStore((s) => s.selectContainer)
  const enterContainer = useYardStore((s) => s.enterContainer)

  const placeAt = useCallback(
    async (slot: SlotRef) => {
      const pending = useUIStore.getState().pendingEnter
      if (!pending) return false
      const { container_number, container_type, ...rest } = pending
      const created = await enterContainer({ container_number, container_type, ...rest }, slot)
      if (created) {
        setPendingEnter(null)
        selectContainer(created.container_number)
        notify.success(`Container ${created.container_number} posizionato in ${created.label ?? ''}`.trim())
        return true
      }
      return false
    },
    [enterContainer, setPendingEnter, selectContainer]
  )

  const cancel = useCallback(() => setPendingEnter(null), [setPendingEnter])

  return { pendingEnter, placeAt, cancel }
}
