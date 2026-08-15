// Trigger a download of the given JSON string as a dated backup file.
// Shared by Settings and the Sunday review nudge so both do it the same way.
export function downloadBackup(json) {
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `the-rebuild-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}
