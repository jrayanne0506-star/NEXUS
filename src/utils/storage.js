// Key format: nexus_YYYY-MM-DD
const PREFIX = 'nexus_'

export function todayKey() {
  const localDate = new Date()
  const y = localDate.getFullYear()
  const m = String(localDate.getMonth() + 1).padStart(2, '0')
  const d = String(localDate.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function formatDatePT(isoDate) {
  if (!isoDate) return ''
  const [y, m, d] = isoDate.split('-')
  return `${d}/${m}/${y}`
}

export function loadData(dateKey) {
  try {
    const raw = localStorage.getItem(PREFIX + dateKey)
    if (!raw) return defaultData()
    return JSON.parse(raw)
  } catch {
    return defaultData()
  }
}

export function saveData(dateKey, data) {
  try {
    localStorage.setItem(PREFIX + dateKey, JSON.stringify(data))
  } catch (e) {
    console.error('Storage error:', e)
  }
}

export function listSavedDates() {
  const dates = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && key.startsWith(PREFIX)) {
      dates.push(key.replace(PREFIX, ''))
    }
  }
  return dates.sort((a, b) => b.localeCompare(a)) // mais recente primeiro
}

export function deleteDate(dateKey) {
  localStorage.removeItem(PREFIX + dateKey)
}

export function defaultData() {
  return {
    almoco: [],
    tarde: [],
    jantar: [],
    ceia: [],
    responsible: '',
  }
}

export function newRow(date) {
  return {
    id: crypto.randomUUID(),
    name: '',
    status: '',
    obs: '',
    date: formatDatePT(date),
    substitutoPor: '', // Novo campo para o status "Substituído"
  }
}

export const SHIFT_LABELS = {
  almoco: 'Almoço',
  tarde: 'Tarde',
  jantar: 'Jantar',
  ceia: 'Ceia',
}

export const SHIFTS = ['almoco', 'tarde', 'jantar', 'ceia']