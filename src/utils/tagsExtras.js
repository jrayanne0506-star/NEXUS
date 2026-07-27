import { supabase } from './supabaseClient.js'

// ─────────────────────────────────────────────────────────────────────────
// Fonte única de leitura/gravação das tags personalizadas.
// Antes vivia no localStorage (nexus_tags_extras); agora vive na tabela
// status_tags do Supabase, compartilhada entre todos os usuários.
// ─────────────────────────────────────────────────────────────────────────

export async function carregarTagsExtras() {
  const { data, error } = await supabase
    .from('status_tags')
    .select('value, label, color')
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Erro ao carregar tags extras:', error)
    return []
  }
  return data || []
}

// Mantido caso você queira reativar a criação de tags no futuro — hoje o
// botão "+ NOVA TAG" foi removido da interface, mas a função continua
// disponível pra uso administrativo direto (ex: via SQL Editor ou uma tela
// de admin futura).
export async function criarTagExtra({ label, color }) {
  const value = `custom_${Date.now()}`
  const { data, error } = await supabase
    .from('status_tags')
    .insert({ value, label, color })
    .select()
    .single()

  if (error) {
    console.error('Erro ao criar tag:', error)
    return null
  }
  return data
}

export async function removerTagExtra(value) {
  const { error } = await supabase
    .from('status_tags')
    .delete()
    .eq('value', value)

  if (error) console.error('Erro ao remover tag:', error)
}

// Converte cor hex (#rrggbb ou #rgb) em array RGB [r,g,b] — formato que o
// jsPDF exige em setTextColor(...)/setFillColor(...). Função pura, não
// depende do banco — mantida aqui pra não quebrar o import em
// generatePDFTemplates.js.
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