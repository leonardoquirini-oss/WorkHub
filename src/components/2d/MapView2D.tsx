import { useMemo, type MouseEvent as ReactMouseEvent } from 'react'
import { useYardStore } from '../../store/yardStore'
import { useUIStore } from '../../store/uiStore'
import { usePlacePending } from '../../hooks/usePlacePending'
import { CONTAINER_STATUS_COLORS } from '../../constants/containerSizes'
import { BRAND_LOGO_ASPECT, BRAND_LOGO_URL, hasBrandLogo } from '../../constants/branding'
import { CONTAINER_NUMBER_COLOR, DEFAULT_CONTAINER_COLOR, SELECTED_CONTAINER_COLOR } from '../../constants/yardConfig'
import { baySpanOf, blockBounds, canPlace, columnOf, isRotated, slotOrigin } from '../../utils/slotLayout'
import { CHECKER_SQUARE } from '../../utils/checkerTexture'
import { isMarkedForExit } from '../../utils/exitMark'
import type { Block, Container, PlacedContainer } from '../../types'

interface Cell {
  key: string
  block: Block
  bay: number
  row: number
  x: number
  y: number
  w: number
  h: number
  top: PlacedContainer | null
  count: number
  covered: boolean
}

function cellsOf(block: Block, containers: Container[]): Cell[] {
  const cells: Cell[] = []
  const coveredByPair = new Set<string>()
  for (let row = 1; row <= block.n_rows; row++) {
    for (let bay = 1; bay <= block.n_bays; bay++) {
      const column = columnOf(containers, block.id_block, row, bay)
      const top = column.length ? column[column.length - 1] : null
      if (top && top.bay_span === 2) coveredByPair.add(`${row}:${bay + 1}`)
      const span = top?.bay_span ?? 1
      const o = slotOrigin(block, bay, row, span as 1 | 2)
      const along = span * block.bay_length + (span - 1) * block.gap
      const w = isRotated(block.orientation) ? block.row_width : along
      const h = isRotated(block.orientation) ? along : block.row_width
      cells.push({ key: `${block.id_block}:${row}:${bay}`, block, bay, row, x: o.x, y: o.z, w, h, top, count: column.length, covered: coveredByPair.has(`${row}:${bay}`) })
    }
  }
  return cells
}

/** Id del pattern a scacchi: una sola definizione per tutta la mappa. */
const EXIT_PATTERN_ID = 'exit-checker'

function fillOf(top: PlacedContainer | null, selected: string | null): string {
  if (!top) return 'transparent'
  if (top.container_number === selected) return SELECTED_CONTAINER_COLOR
  // Chi e' in uscita vince sul colore di stato, come in 3D: lo stato resta nel pannello e in lista.
  if (isMarkedForExit(top)) return `url(#${EXIT_PATTERN_ID})`
  if (top.status !== 'active') return CONTAINER_STATUS_COLORS[top.status]
  return top.color || DEFAULT_CONTAINER_COLOR
}

/** Logo a sinistra del numero, dimensionato sulla cella; assente se non resta spazio per il numero. */
function logoBoxOf(cell: Cell): { x: number; y: number; width: number; height: number } | null {
  if (!cell.top || !hasBrandLogo(cell.top.container_number)) return null
  const height = Math.min(cell.h * 0.62, (cell.w * 0.26) / BRAND_LOGO_ASPECT)
  const width = height * BRAND_LOGO_ASPECT
  if (cell.w - width < 2.6) return null
  return { x: cell.x + 0.3, y: cell.y + (cell.h - height) / 2, width, height }
}

/**
 * Targhetta bianca dietro logo e numero delle celle a scacchi: sul pattern il numero nero sparisce.
 * Copre la fascia verticale occupata da logo e scritta, non tutta la cella.
 */
function numberPlateOf(
  cell: Cell,
  logo: { x: number; y: number; width: number; height: number } | null
): { x: number; y: number; width: number; height: number } {
  const top = Math.min(logo ? logo.y : Number.POSITIVE_INFINITY, cell.y + 0.35) - 0.1
  const bottom = Math.max(logo ? logo.y + logo.height : 0, cell.y + 1.75) + 0.1
  return { x: cell.x + 0.15, y: top, width: cell.w - 0.3, height: bottom - top }
}

/** Top-down SVG map of the yard: blocks, bays × rows, top container and stack height per column. */
export function MapView2D() {
  const { yards, selectedYardId, containers, blocks } = useYardStore()
  const { selectedContainerNumber, selectContainer, toggleSelect, showAreas, pulseNumber, openContextMenu } = useUIStore()
  const { pendingEnter, placeAt } = usePlacePending()
  const yard = yards.find((y) => y.id_yard === selectedYardId)

  const cells = useMemo(
    () => blocks.filter((b) => b.is_active).flatMap((b) => cellsOf(b, containers)),
    [blocks, containers]
  )

  if (!yard) {
    return <div className="w-full h-full flex items-center justify-center text-slate-400">Seleziona un piazzale</div>
  }

  const onCellClick = (cell: Cell, e: ReactMouseEvent) => {
    e.stopPropagation()
    if (pendingEnter) {
      const slot = { id_block: cell.block.id_block, bay: cell.bay, row_no: cell.row }
      const check = canPlace(pendingEnter, slot, blocks, containers)
      if (!check.ok) return
      void placeAt(slot)
      return
    }
    if (cell.top) toggleSelect(cell.top.container_number)
  }

  /** Click destro sulla colonna: menu di riordino sul container in cima (il solo visibile in 2D). */
  const onCellContextMenu = (cell: Cell, e: ReactMouseEvent) => {
    e.preventDefault()
    if (pendingEnter || !cell.top) return
    openContextMenu({ containerNumber: cell.top.container_number, x: e.clientX, y: e.clientY })
  }

  const pendingSpan = pendingEnter ? baySpanOf(pendingEnter.container_type) : 1

  return (
    <div className="w-full h-full bg-slate-900 p-2 sm:p-4 overflow-hidden">
      <svg
        viewBox={`-2 -2 ${yard.width + 4} ${yard.length + 4}`}
        className="w-full h-full"
        preserveAspectRatio="xMidYMid meet"
        onClick={() => selectContainer(null)}
      >
        <defs>
          {/* Scacchi in metri di piazzale (userSpaceOnUse): stessa taglia dei quadri in 3D. */}
          <pattern
            id={EXIT_PATTERN_ID}
            patternUnits="userSpaceOnUse"
            width={CHECKER_SQUARE * 2}
            height={CHECKER_SQUARE * 2}
          >
            <rect width={CHECKER_SQUARE * 2} height={CHECKER_SQUARE * 2} fill="#fafafa" />
            <rect width={CHECKER_SQUARE} height={CHECKER_SQUARE} fill="#cc181e" />
            <rect x={CHECKER_SQUARE} y={CHECKER_SQUARE} width={CHECKER_SQUARE} height={CHECKER_SQUARE} fill="#cc181e" />
          </pattern>
        </defs>

        <rect x={0} y={0} width={yard.width} height={yard.length} fill="#1e293b" stroke="#334155" strokeWidth={0.3} />

        {showAreas &&
          (yard.areas ?? []).map((a) => (
            <g key={a.id_yard_area}>
              <rect x={a.start_x} y={a.start_y} width={a.end_x - a.start_x} height={a.end_y - a.start_y} fill={a.color} fillOpacity={0.12} stroke={a.color} strokeWidth={0.2} />
              <text x={a.start_x + 0.8} y={a.start_y + 2} fontSize={1.6} fill={a.color} opacity={0.8}>
                {a.name}
              </text>
            </g>
          ))}

        {blocks.filter((b) => b.is_active).map((b) => {
          const bb = blockBounds(b)
          return (
            <g key={b.id_block}>
              <rect x={bb.x0} y={bb.z0} width={bb.x1 - bb.x0} height={bb.z1 - bb.z0} fill="none" stroke={b.color || '#64748b'} strokeWidth={0.35} />
              <text x={bb.x0} y={bb.z0 - 0.6} fontSize={2} fill={b.color || '#94a3b8'} fontWeight="bold">
                {b.code}
              </text>
            </g>
          )
        })}

        {cells.map((cell) => {
          if (cell.covered) return null
          const placeable =
            pendingEnter && !cell.top && (pendingSpan === 1 || cell.bay % 2 === 1) &&
            canPlace(pendingEnter, { id_block: cell.block.id_block, bay: cell.bay, row_no: cell.row }, blocks, containers).ok
          const isPulse = cell.top?.container_number === pulseNumber
          const logo = logoBoxOf(cell)
          return (
            <g
              key={cell.key}
              onClick={(e) => onCellClick(cell, e)}
              onContextMenu={(e) => onCellContextMenu(cell, e)}
              className={cell.top || placeable ? 'cursor-pointer' : ''}
            >
              <rect
                x={cell.x}
                y={cell.y}
                width={cell.w}
                height={cell.h}
                fill={placeable ? '#22c55e' : fillOf(cell.top, selectedContainerNumber)}
                fillOpacity={placeable ? 0.35 : cell.top ? (isMarkedForExit(cell.top) ? 1 : 0.9) : 0}
                stroke={isPulse ? '#f472b6' : cell.top ? '#0f172a' : '#334155'}
                strokeWidth={isPulse ? 0.5 : 0.12}
              />
              {cell.top && (
                <>
                  {isMarkedForExit(cell.top) && cell.top.container_number !== selectedContainerNumber && (
                    <rect {...numberPlateOf(cell, logo)} fill="#ffffff" />
                  )}
                  {logo && (
                    <image
                      href={BRAND_LOGO_URL}
                      x={logo.x}
                      y={logo.y}
                      width={logo.width}
                      height={logo.height}
                      preserveAspectRatio="xMidYMid meet"
                    />
                  )}
                  <text
                    x={cell.x + 0.3 + (logo ? logo.width + 0.25 : 0)}
                    y={cell.y + 1.55}
                    fontSize={1.05}
                    fill={CONTAINER_NUMBER_COLOR}
                    fontFamily="monospace"
                  >
                    {shortNumber(cell.top.container_number, cell.w - (logo ? logo.width + 0.25 : 0))}
                  </text>
                  {cell.count > 1 && (
                    <>
                      <circle cx={cell.x + cell.w - 1} cy={cell.y + cell.h - 1} r={0.85} fill="#0f172a" stroke="#ffffff" strokeWidth={0.1} />
                      <text x={cell.x + cell.w - 1} y={cell.y + cell.h - 0.65} fontSize={1} fill="#ffffff" textAnchor="middle">
                        {cell.count}
                      </text>
                    </>
                  )}
                </>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

/** Fits the container number in the cell width (roughly 0.65 units per character). */
function shortNumber(number: string, width: number): string {
  const maxChars = Math.max(4, Math.floor(width / 0.68))
  return number.length <= maxChars ? number : number.slice(-maxChars)
}
