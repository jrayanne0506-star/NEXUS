import { supabase } from './supabaseClient.js'

// ─────────────────────────────────────────────────────────────────────────
// Datas — funções puras, não mudam (não dependem de localStorage nem banco)
// ─────────────────────────────────────────────────────────────────────────

export function todayKey() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function formatDatePT(isoDate) {
  if (!isoDate) return ''
  const [y, m, d] = isoDate.split('-')
  return `${d}/${m}/${y}`
}

export const SHIFT_LABELS = {
  almoco: 'Almoço',
  tarde: 'Tarde',
  jantar: 'Jantar',
  ceia: 'Ceia',
}

export const SHIFTS = ['almoco', 'tarde', 'jantar', 'ceia']

export function defaultData() {
  return { almoco: [], tarde: [], jantar: [], ceia: [], responsible: '' }
}

// ─────────────────────────────────────────────────────────────────────────
// Conversão banco <-> UI
// O banco usa nomes em português/snake_case (colaborador_nome, motivo,
// substituto_por). O resto do app (ShiftTable, App.jsx) usa os nomes
// antigos (name, obs, substitutoPor) — mantemos esses nomes na UI pra não
// precisar reescrever componentes que já funcionam.
// ─────────────────────────────────────────────────────────────────────────

function dbToUi(row) {
  return {
    id: row.id,
    name: row.colaborador_nome || '',
    status: row.status || '',
    obs: row.motivo || '',
    date: formatDatePT(row.data),
    substitutoPor: row.substituto_por || '',
    turno: row.turno,
  }
}

const FIELD_MAP = {
  name: 'colaborador_nome',
  status: 'status',
  obs: 'motivo',
  substitutoPor: 'substituto_por',
}

// ─────────────────────────────────────────────────────────────────────────
// Leitura
// ─────────────────────────────────────────────────────────────────────────

// Busca todos os registros de uma data, já agrupados por turno, mais o
// responsável pelo relatório daquele dia.
export async function loadData(dateKey) {
  const { data: rows, error } = await supabase
    .from('registros_presenca')
    .select('*')
    .eq('data', dateKey)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Erro ao carregar registros:', error)
    return defaultData()
  }

  const grouped = defaultData()
  ;(rows || []).forEach(r => {
    if (grouped[r.turno]) grouped[r.turno].push(dbToUi(r))
  })

  const { data: relatorio, error: relErr } = await supabase
    .from('relatorios')
    .select('responsavel')
    .eq('data', dateKey)
    .maybeSingle()

  if (relErr) console.error('Erro ao carregar responsável:', relErr)
  grouped.responsible = relatorio?.responsavel || ''

  return grouped
}

// Lista todas as datas que têm ao menos um registro salvo (equivalente ao
// antigo "13 datas salvas")
export async function listSavedDates() {
  const { data: rows, error } = await supabase
    .from('registros_presenca')
    .select('data')

  if (error) {
    console.error('Erro ao listar datas:', error)
    return []
  }
  const unicas = [...new Set((rows || []).map(r => r.data))]
  return unicas.sort((a, b) => b.localeCompare(a)) // mais recente primeiro
}

// ─────────────────────────────────────────────────────────────────────────
// Escrita — cada ação agora bate direto no Supabase (sem "salvar tudo de
// uma vez" como era no localStorage)
// ─────────────────────────────────────────────────────────────────────────

// Cria um novo registro/linha. dadosParciais pode vir vazio (linha em
// branco) ou preenchido (ex: import por OCR).
export async function addRow(dateKey, turno, dadosParciais = {}) {
  const payload = {
    data: dateKey,
    turno,
    colaborador_nome: dadosParciais.name || '',
    status: dadosParciais.status || '',
    motivo: dadosParciais.obs || '',
    substituto_por: dadosParciais.substitutoPor || '',
  }

  const { data: inserted, error } = await supabase
    .from('registros_presenca')
    .insert(payload)
    .select()
    .single()

  if (error) {
    console.error('Erro ao adicionar registro:', error)
    return null
  }
  return dbToUi(inserted)
}

export async function updateRow(id, field, value) {
  const column = FIELD_MAP[field]
  if (!column) return

  const { error } = await supabase
    .from('registros_presenca')
    .update({ [column]: value })
    .eq('id', id)

  if (error) console.error('Erro ao atualizar registro:', error)
}

export async function deleteRow(id) {
  const { error } = await supabase
    .from('registros_presenca')
    .delete()
    .eq('id', id)

  if (error) console.error('Erro ao apagar registro:', error)
}

export async function saveResponsible(dateKey, responsavel) {
  const { error } = await supabase
    .from('relatorios')
    .upsert({ data: dateKey, responsavel })

  if (error) console.error('Erro ao salvar responsável:', error)
}

export async function deleteDate(dateKey) {
  const { error: e1 } = await supabase.from('registros_presenca').delete().eq('data', dateKey)
  const { error: e2 } = await supabase.from('relatorios').delete().eq('data', dateKey)
  if (e1) console.error('Erro ao apagar registros da data:', e1)
  if (e2) console.error('Erro ao apagar responsável da data:', e2)
}