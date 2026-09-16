import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useYardStore } from '../yardStore'
import { workHubAPI } from '../../api/WorkHubAPI'
import type { Container, YardEvent } from '../../types'

function ctr(number: string, tier: number, version = 1): Container {
  return {
    container_number: number,
    id_yard: 1,
    id_block: 10,
    bay: 1,
    bay_span: 1,
    row_no: 1,
    tier,
    container_type: '20',
    position_x: 0,
    position_y: 0,
    position_z: 0,
    rotation: 0,
    status: 'active',
    version,
  }
}

function event(revision: number, extra: Partial<YardEvent> = {}): YardEvent {
  return { type: 'MOVE', id_yard: 1, revision, containers: [], removed: [], ...extra }
}

describe('yardStore.applyYardEvent', () => {
  beforeEach(() => {
    useYardStore.setState({ selectedYardId: 1, revision: 10, containers: [ctr('A', 1), ctr('B', 2)], blocks: [] })
  })

  it('ignores events of other yards and already-applied revisions', () => {
    useYardStore.getState().applyYardEvent(event(11, { id_yard: 2, removed: ['A'] }))
    useYardStore.getState().applyYardEvent(event(10, { removed: ['A'] }))
    expect(useYardStore.getState().containers).toHaveLength(2)
    expect(useYardStore.getState().revision).toBe(10)
  })

  it('applies the next revision as a delta (upsert + removed) and recomputes pos_from_top', () => {
    useYardStore.getState().applyYardEvent(event(11, { containers: [ctr('B', 1, 2)], removed: ['A'] }))
    const s = useYardStore.getState()
    expect(s.revision).toBe(11)
    expect(s.containers.map((c) => c.container_number)).toEqual(['B'])
    expect(s.containers[0].tier).toBe(1)
    expect(s.containers[0].pos_from_top).toBe(1)
  })

  it('reloads the snapshot on a gap or on LAYOUT events', async () => {
    const spy = vi.spyOn(workHubAPI, 'getSnapshot').mockResolvedValue({
      success: true,
      data: {
        revision: 13,
        yard: { id_yard: 1, id_site: 1, code: 'PZ1', name: 'Y', width: 10, length: 10, max_stack_height: 5, is_active: true, areas: [], blocks: [] },
        containers: [ctr('Z', 1)],
      },
    })
    useYardStore.getState().applyYardEvent(event(13))
    await vi.waitFor(() => expect(useYardStore.getState().revision).toBe(13))
    expect(useYardStore.getState().containers.map((c) => c.container_number)).toEqual(['Z'])

    useYardStore.getState().applyYardEvent({ type: 'LAYOUT', id_yard: 1, revision: 13 })
    await vi.waitFor(() => expect(spy).toHaveBeenCalledTimes(2))
    spy.mockRestore()
  })
})
