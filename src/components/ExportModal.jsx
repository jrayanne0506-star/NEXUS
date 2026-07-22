/**
 * ExportModal.jsx
 * Modal de seleção de formato para exportar PDF no NEXUS.
 *
 * Props:
 *   open       {boolean}   — visível ou não
 *   onClose    {function}  — fechar sem exportar
 *   onExport   {function}  — (templateId: 'original'|'template1'|'template2'|'template3', prints: Array) => void
 *
 * Uso no componente pai (ex: App.jsx ou Dashboard.jsx):
 *
 *   import ExportModal from './ExportModal'
 *   import { generatePDF }          from './generatePDF'          // já existia
 *   import { generatePDFTemplate1,
 *            generatePDFTemplate2,
 *            generatePDFTemplate3 } from './generatePDFTemplates' // novo
 *
 *   const [exportOpen, setExportOpen] = useState(false)
 *
 *   function handleExport(id, prints) {
 *     const args = { data, dateKey, responsible, user, prints }
 *     if (id === 'original')   generatePDF(args)
 *     if (id === 'template1')  generatePDFTemplate1(args)
 *     if (id === 'template2')  generatePDFTemplate2(args)
 *     if (id === 'template3')  generatePDFTemplate3(args)
 *     setExportOpen(false)
 *   }
 *
 *   // Substitua o botão antigo de exportar por:
 *   <button onClick={() => setExportOpen(true)}>EXPORTAR RELATÓRIO PDF</button>
 *   <ExportModal open={exportOpen} onClose={() => setExportOpen(false)} onExport={handleExport} />
 */

import React from 'react'

const TEMPLATES = [
  {
    id: 'original',
    label: 'NEXUS Original',
    badge: 'PADRÃO',
    badgeColor: '#f97316',
    desc: 'Layout dark do sistema NEXUS com cards de resumo, tabelas por turno e cabeçalho laranja.',
    preview: [
      { color: '#f97316', label: 'Header NEXUS + cards de métricas' },
      { color: '#27272a', label: 'Tabela por turno com status colorido' },
      { color: '#18181b', label: 'Rodapé com paginação e assinatura' },
    ],
  },
  {
    id: 'template1',
    label: 'Modelo 1 — Seções por Turno',
    badge: 'CLÁSSICO',
    badgeColor: '#6366f1',
    desc: 'Seções "SAIU OU FURARAM [TURNO]" com Nome, Status e Observação. Responsável e rodapé institucional.',
    preview: [
      { color: '#6366f1', label: 'Seção por turno com barra lateral' },
      { color: '#374151', label: 'Nome · Status colorido · Observação' },
      { color: '#111827', label: 'Resumo + linha de assinatura' },
    ],
  },
  {
    id: 'template2',
    label: 'Modelo 2 — Tabela Formal',
    badge: 'FORMAL',
    badgeColor: '#10b981',
    desc: 'Tabela única com colunas Nº, Nome, Status, Turno e Observação. Turno em laranja. Resumo ao final.',
    preview: [
      { color: '#10b981', label: 'Header institucional compacto' },
      { color: '#374151', label: 'Tabela: Nº · Nome · Status · Turno · Obs.' },
      { color: '#111827', label: 'Bloco de resumo consolidado' },
    ],
  },
  {
    id: 'template3',
    label: 'Modelo 3 — Separadores · e Numeração por Turno',
    badge: 'DETALHADO',
    badgeColor: '#f59e0b',
    desc: 'Cada turno com numeração própria reiniciada. Legendas de ocorrências no rodapé.',
    preview: [
      { color: '#f59e0b', label: 'Header minimalista com · separadores' },
      { color: '#374151', label: 'Tabela por turno numerada do zero' },
      { color: '#111827', label: 'Legenda colorida de ocorrências' },
    ],
  },
]

export default function ExportModal({ open, onClose, onExport }) {
  const [selected, setSelected] = React.useState('original')
  const [hoverId, setHoverId]   = React.useState(null)
  const [prints, setPrints]     = React.useState([]) // anexos (sem limite de quantidade)

  if (!open) return null

  const selectedTemplate = TEMPLATES.find(t => t.id === selected)

  function handleAnexarPrints(e) {
    const files = Array.from(e.target.files || []) // sem limite de quantidade
    if (!files.length) return
    const novos = files.map(file => ({
      id: crypto.randomUUID(),
      nome: file.name,
      url: URL.createObjectURL(file),
      file,
    }))
    setPrints(prev => [...prev, ...novos])
    e.target.value = '' // permite reanexar o mesmo arquivo depois
  }

  function removerPrint(id) {
    setPrints(prev => {
      const alvo = prev.find(p => p.id === id)
      if (alvo) URL.revokeObjectURL(alvo.url)
      return prev.filter(p => p.id !== id)
    })
  }

  function handleFecharModal() {
    // libera memória dos previews ao fechar sem exportar
    prints.forEach(p => URL.revokeObjectURL(p.url))
    setPrints([])
    onClose()
  }

  function handleGerarPDF() {
    onExport(selected, prints)
    // reset local após exportar (o componente pai já recebeu os arquivos)
    setPrints([])
  }

  return (
    <div style={s.overlay} onClick={handleFecharModal}>
      <div style={s.box} onClick={e => e.stopPropagation()}>

        {/* Título */}
        <div style={s.header}>
          <div>
            <div style={s.title}>EXPORTAR RELATÓRIO PDF</div>
            <div style={s.subtitle}>Escolha o layout do documento</div>
          </div>
          <button style={s.closeBtn} onClick={handleFecharModal}>✕</button>
        </div>

        {/* Corpo com rolagem (grid de templates + anexos) */}
        <div style={s.scrollArea}>
          {/* Grid de opções */}
          <div style={s.grid}>
            {TEMPLATES.map(t => {
              const isActive = selected === t.id
              const isHover  = hoverId === t.id
              return (
                <div
                  key={t.id}
                  style={{
                    ...s.card,
                    borderColor: isActive ? t.badgeColor : isHover ? '#3f3f46' : '#27272a',
                    background: isActive ? `${t.badgeColor}0d` : '#111113',
                  }}
                  onClick={() => setSelected(t.id)}
                  onMouseEnter={() => setHoverId(t.id)}
                  onMouseLeave={() => setHoverId(null)}
                >
                  {/* Badge */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{
                      ...s.badge,
                      background: `${t.badgeColor}22`,
                      color: t.badgeColor,
                      borderColor: `${t.badgeColor}44`,
                    }}>
                      {t.badge}
                    </div>
                    {/* Rádio visual */}
                    <div style={{
                      width: 14, height: 14, borderRadius: '50%',
                      border: `2px solid ${isActive ? t.badgeColor : '#3f3f46'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, marginTop: 1,
                    }}>
                      {isActive && (
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: t.badgeColor }} />
                      )}
                    </div>
                  </div>

                  {/* Nome */}
                  <div style={{
                    ...s.cardLabel,
                    color: isActive ? '#ebebeb' : '#a1a1aa',
                  }}>
                    {t.label}
                  </div>

                  {/* Descrição */}
                  <div style={s.cardDesc}>{t.desc}</div>

                  {/* Preview de seções */}
                  <div style={s.previewList}>
                    {t.preview.map((p, i) => (
                      <div key={i} style={s.previewItem}>
                        <div style={{ ...s.previewDot, background: p.color }} />
                        <span style={s.previewText}>{p.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Anexar Prints — sem limite de quantidade */}
          <div style={s.attachBox}>
            <div style={s.attachHeader}>
              <span style={s.attachTitle}>ANEXAR PRINTS</span>
              <span style={s.attachCount}>{prints.length} arquivo(s)</span>
            </div>

            <label style={s.attachBtn}>
              + Selecionar imagens
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleAnexarPrints}
                style={{ display: 'none' }}
              />
            </label>

            {prints.length > 0 && (
              <div style={s.attachGrid}>
                {prints.map(p => (
                  <div key={p.id} style={s.attachThumb}>
                    <img src={p.url} alt={p.nome} style={s.attachImg} />
                    <button
                      style={s.attachRemove}
                      onClick={() => removerPrint(p.id)}
                      title="Remover"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Rodapé do modal */}
        <div style={s.footer}>
          <div style={s.footerInfo}>
            <span style={{ color: '#555560', fontFamily: 'IBM Plex Mono, monospace', fontSize: 10 }}>
              Selecionado:
            </span>
            <span style={{
              color: selectedTemplate.badgeColor,
              fontFamily: 'IBM Plex Mono, monospace',
              fontSize: 10,
              fontWeight: 700,
              marginLeft: 6,
            }}>
              {selectedTemplate.label}
            </span>
            {prints.length > 0 && (
              <span style={{ color: '#555560', fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, marginLeft: 10 }}>
                · {prints.length} print(s) anexado(s)
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              style={s.cancelBtn}
              onClick={handleFecharModal}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#3f3f46'}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#27272a'}
            >
              Cancelar
            </button>
            <button
              style={{ ...s.exportBtn, background: selectedTemplate.badgeColor }}
              onClick={handleGerarPDF}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              ↓ GERAR PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const s = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.82)',
    zIndex: 2000,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 16,
  },
  box: {
    background: '#18181b',
    border: '1px solid #27272a',
    width: '100%',
    maxWidth: 740,
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
    maxHeight: '90vh',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: '22px 24px 18px',
    borderBottom: '1px solid #27272a',
  },
  title: {
    fontFamily: 'IBM Plex Mono, monospace',
    fontSize: 13,
    letterSpacing: 2,
    color: '#f97316',
    textTransform: 'uppercase',
    fontWeight: 700,
  },
  subtitle: {
    fontFamily: 'IBM Plex Mono, monospace',
    fontSize: 9,
    letterSpacing: 1.5,
    color: '#555560',
    marginTop: 4,
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    color: '#555560',
    cursor: 'pointer',
    fontSize: 16,
    padding: '2px 4px',
    lineHeight: 1,
  },
  scrollArea: {
    overflowY: 'auto',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 12,
    padding: '20px 24px',
  },
  card: {
    border: '1px solid',
    padding: '14px 14px 12px',
    cursor: 'pointer',
    transition: 'border-color 0.15s, background 0.15s',
  },
  badge: {
    fontFamily: 'IBM Plex Mono, monospace',
    fontSize: 8,
    letterSpacing: 1.5,
    padding: '2px 7px',
    border: '1px solid',
    textTransform: 'uppercase',
    fontWeight: 700,
  },
  cardLabel: {
    fontFamily: 'IBM Plex Sans, sans-serif',
    fontSize: 12,
    fontWeight: 600,
    marginBottom: 5,
    lineHeight: 1.3,
  },
  cardDesc: {
    fontFamily: 'IBM Plex Sans, sans-serif',
    fontSize: 11,
    color: '#555560',
    lineHeight: 1.5,
    marginBottom: 10,
  },
  previewList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    borderTop: '1px solid #27272a',
    paddingTop: 8,
    marginTop: 4,
  },
  previewItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
  },
  previewDot: {
    width: 6, height: 6,
    borderRadius: '50%',
    flexShrink: 0,
  },
  previewText: {
    fontFamily: 'IBM Plex Mono, monospace',
    fontSize: 8.5,
    color: '#71717a',
    letterSpacing: 0.3,
  },
  attachBox: {
    padding: '4px 24px 20px',
  },
  attachHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    borderTop: '1px solid #27272a',
    paddingTop: 16,
  },
  attachTitle: {
    fontFamily: 'IBM Plex Mono, monospace',
    fontSize: 10,
    letterSpacing: 1.5,
    color: '#71717a',
    fontWeight: 700,
  },
  attachCount: {
    fontFamily: 'IBM Plex Mono, monospace',
    fontSize: 9,
    color: '#555560',
  },
  attachBtn: {
    display: 'inline-block',
    fontFamily: 'IBM Plex Mono, monospace',
    fontSize: 10,
    letterSpacing: 0.5,
    border: '1px dashed #3f3f46',
    color: '#a1a1aa',
    padding: '8px 14px',
    cursor: 'pointer',
    transition: 'border-color 0.2s, color 0.2s',
  },
  attachGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
  },
  attachThumb: {
    position: 'relative',
    width: 64,
    height: 64,
  },
  attachImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    border: '1px solid #27272a',
    display: 'block',
  },
  attachRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 16,
    height: 16,
    borderRadius: '50%',
    background: '#ef4444',
    color: '#fff',
    border: 'none',
    fontSize: 9,
    cursor: 'pointer',
    lineHeight: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 24px',
    borderTop: '1px solid #27272a',
    background: '#111113',
  },
  footerInfo: {
    display: 'flex',
    alignItems: 'center',
  },
  cancelBtn: {
    background: 'transparent',
    border: '1px solid #27272a',
    color: '#555560',
    fontFamily: 'IBM Plex Mono, monospace',
    fontSize: 11,
    padding: '8px 16px',
    cursor: 'pointer',
    transition: 'border-color 0.2s',
    letterSpacing: 1,
  },
  exportBtn: {
    border: 'none',
    color: '#000',
    fontFamily: 'Bebas Neue, sans-serif',
    fontSize: 15,
    letterSpacing: 2,
    padding: '8px 24px',
    cursor: 'pointer',
    transition: 'opacity 0.2s',
  },
}