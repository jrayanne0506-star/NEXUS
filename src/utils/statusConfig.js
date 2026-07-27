// ─────────────────────────────────────────────────────────────────────────────
// FONTE ÚNICA DE VERDADE para os status de presença.
//
// Dropdown (ShiftTable.jsx), cards do topo (App.jsx) e os PDFs (pdfExport.js
// e generatePDFTemplate.js) devem importar tudo daqui — NUNCA redefinir a
// lista de status de novo em outro arquivo. Se um dia precisar adicionar,
// renomear ou remover um status, mexe só aqui.
// ─────────────────────────────────────────────────────────────────────────────

function hexToRgbLocal(hex) {
  const h = String(hex).replace('#', '')
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h
  const num = parseInt(full, 16)
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255]
}

// value            -> valor salvo no registro (não mude, já tem dados salvos com isso)
// label            -> texto mostrado no <select> da tabela
// cardLabel        -> texto mostrado nos cards de totais (topo da página e PDFs)
// color            -> cor em hex, usada em tudo (select, cards, PDF)
export const STATUS_CONFIG = [
  {
    value: 'substituido',
    label: 'Substituído',
    cardLabel: 'SUBSTITUÍDOS',
    color: '#a78bfa',
  },
  {
    value: 'bloqueado',
    label: 'Bloqueado',
    cardLabel: 'BLOQUEADOS',
    color: '#f97316',
  },
  {
    value: 'ausencia_em_sistema',
    label: 'Ausência comunicada — continua em sistema',
    cardLabel: 'AUS. COMUNICADA — EM SISTEMA',
    color: '#22c55e',
  },
  {
    value: 'nao_com_em_sistema',
    label: 'Ausência não comunicada — continua em sistema',
    cardLabel: 'AUS. NÃO COMUNICADA — EM SISTEMA',
    color: '#60a5fa',
  },
  {
    value: 'tirei',
    label: 'Tirei',
    cardLabel: 'TIREI',
    color: '#facc15',
  },
  {
    value: 'inconfiavel',
    label: 'Inconfiável',
    cardLabel: 'INCONFIÁVEL',
    color: '#ec4899',
  },
]

// Opção vazia do <select> — não entra nos cards nem no PDF, só no dropdown
export const STATUS_EMPTY = { value: '', label: '— Selecionar —', color: '#909090' }

// Lista pronta pro <select> do ShiftTable (vazio + todos os status fixos)
export const STATUS_FIXOS = [STATUS_EMPTY, ...STATUS_CONFIG]

export function statusLabelFor(value) {
  return STATUS_CONFIG.find(s => s.value === value)?.label || null
}

export function statusCardLabelFor(value) {
  return STATUS_CONFIG.find(s => s.value === value)?.cardLabel || (value || '').toUpperCase()
}

export function statusColorHex(value) {
  return STATUS_CONFIG.find(s => s.value === value)?.color || '#909090'
}

export function statusColorRgb(value) {
  return hexToRgbLocal(statusColorHex(value))
}