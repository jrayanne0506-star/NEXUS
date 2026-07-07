// ─────────────────────────────────────────────────────────────────────────────
// Fonte única de leitura/gravação das tags personalizadas ("+ NOVA TAG").
// Usado tanto pelo painel (ShiftTable.jsx) quanto pela geração de PDF
// (generatePDFTemplates.js), garantindo que qualquer tag criada pelo usuário
// seja reconhecida em TODO lugar — painel, cards de totais e PDF.
// ─────────────────────────────────────────────────────────────────────────────

const TAGS_EXTRAS_KEY = 'nexus_tags_extras'

export function carregarTagsExtras() {
  try {
    return JSON.parse(localStorage.getItem(TAGS_EXTRAS_KEY) || '[]')
  } catch {
    return []
  }
}

export function salvarTagsExtras(tags) {
  localStorage.setItem(TAGS_EXTRAS_KEY, JSON.stringify(tags))
}

// Converte cor hex (#rrggbb ou #rgb) em array RGB [r,g,b] — formato que o
// jsPDF exige em setTextColor(...)/setFillColor(...).
export function hexToRgb(hex) {
  if (!hex) return [144, 144, 144] // cinza neutro de fallback
  const clean = hex.replace('#', '')
  const full = clean.length === 3
    ? clean.split('').map(c => c + c).join('')
    : clean
  const num = parseInt(full, 16)
  if (Number.isNaN(num)) return [144, 144, 144]
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255]
}
