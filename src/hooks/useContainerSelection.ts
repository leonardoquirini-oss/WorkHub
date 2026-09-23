import { useCallback } from 'react'
import { useUIStore } from '../store/uiStore'
import { useYardStore } from '../store/yardStore'
import type { Container } from '../types'

export function useContainerSelection() {
  const { selectedContainerNumber, selectContainer } = useUIStore()
  const { containers, productByNumber, getContainer } = useYardStore()

  const selectedContainer: Container | undefined = selectedContainerNumber
    ? getContainer(selectedContainerNumber)
    : undefined

  const selectedContainerMaterial = selectedContainerNumber ? (productByNumber[selectedContainerNumber] ?? null) : null

  const handleSelect = useCallback(
    (containerNumber: string | null) => {
      selectContainer(containerNumber)
    },
    [selectContainer]
  )

  const handleToggleSelect = useCallback(
    (containerNumber: string) => {
      if (selectedContainerNumber === containerNumber) {
        selectContainer(null)
      } else {
        selectContainer(containerNumber)
      }
    },
    [selectedContainerNumber, selectContainer]
  )

  const clearSelection = useCallback(() => {
    selectContainer(null)
  }, [selectContainer])

  return {
    selectedContainer,
    selectedContainerNumber,
    selectedContainerMaterial,
    containers,
    handleSelect,
    handleToggleSelect,
    clearSelection,
  }
}
