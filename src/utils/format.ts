/** Italian short date-time, or the raw value when unparsable. */
export function formatDate(value?: string | null): string {
  if (!value) return '-'
  const d = new Date(value)
  return isNaN(d.getTime()) ? value : d.toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })
}
