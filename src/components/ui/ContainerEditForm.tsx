import { useEffect, useState } from 'react'
import { Loader2, Save } from 'lucide-react'
import { useYardStore } from '../../store/yardStore'
import { notify } from '../../store/notificationStore'
import { CONTAINER_STATUS_LABELS, DEFAULT_CONTAINER_COLORS } from '../../constants/containerSizes'
import type { Container, ContainerStatus } from '../../types'

interface ContainerEditFormProps {
  container: Container
}

/** Editable attributes of a container (status, content, notes, colour) saved with PATCH + version. */
export function ContainerEditForm({ container: c }: ContainerEditFormProps) {
  const patchContainer = useYardStore((s) => s.patchContainer)
  const [status, setStatus] = useState<ContainerStatus>(c.status)
  const [content, setContent] = useState(c.content_description ?? '')
  const [notes, setNotes] = useState(c.notes ?? '')
  const [color, setColor] = useState(c.color ?? '')
  const [saving, setSaving] = useState(false)

  // Reset the form when another container is selected or the server pushes an update
  useEffect(() => {
    setStatus(c.status)
    setContent(c.content_description ?? '')
    setNotes(c.notes ?? '')
    setColor(c.color ?? '')
  }, [c.container_number, c.version, c.status, c.content_description, c.notes, c.color])

  const dirty =
    status !== c.status || content !== (c.content_description ?? '') || notes !== (c.notes ?? '') || color !== (c.color ?? '')

  const save = async () => {
    setSaving(true)
    const updated = await patchContainer(c.container_number, {
      status,
      content_description: content.trim() || null,
      notes: notes.trim() || null,
      color: color || null,
    })
    setSaving(false)
    if (updated) notify.success('Container aggiornato')
  }

  const inputClass =
    'w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'

  return (
    <div className="space-y-3 border-t border-slate-700 pt-3">
      <div>
        <label className="block text-xs text-slate-400 mb-1">Stato</label>
        <select value={status} onChange={(e) => setStatus(e.target.value as ContainerStatus)} className={inputClass}>
          {Object.entries(CONTAINER_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs text-slate-400 mb-1">Contenuto</label>
        <input value={content} onChange={(e) => setContent(e.target.value)} maxLength={200} className={inputClass} />
      </div>
      <div>
        <label className="block text-xs text-slate-400 mb-1">Note</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={1000} className={inputClass} />
      </div>
      <div>
        <label className="block text-xs text-slate-400 mb-1">Colore</label>
        <div className="flex flex-wrap gap-2">
          {DEFAULT_CONTAINER_COLORS.map((swatch) => (
            <button
              key={swatch}
              type="button"
              onClick={() => setColor(swatch)}
              aria-label={`Colore ${swatch}`}
              className={`w-7 h-7 rounded-md border-2 ${color === swatch ? 'border-white scale-110' : 'border-transparent'}`}
              style={{ backgroundColor: swatch }}
            />
          ))}
        </div>
      </div>
      <button
        onClick={save}
        disabled={!dirty || saving}
        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white text-sm"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Salva modifiche
      </button>
    </div>
  )
}
