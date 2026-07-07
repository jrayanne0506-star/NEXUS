import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { SHIFT_LABELS, SHIFTS, formatDatePT } from './storage'
import { carregarTagsExtras, hexToRgb } from './tagsExtras'
import { registerFonts } from './registerFonts'

// ── Helpers de status ─────────────────────────────────────────────────────────

// status → label, para os status FIXOS do sistema (tags extras são
// resolvidas dinamicamente via tagsExtras — mesmo padrão do pdfTemplates.js)
const FIXED_LABELS = {
  ausencia:            'Ausência Não Comunicada',
  aviso:               'Ausência Comunicada',
  bloqueado:           'Bloqueado',
  ausencia_em_sistema: 'Aus. Comunicada — em sistema',
  nao_com_em_sistema:  'Aus. Não Comunicada — em sistema',
}

function statusLabel(status, substitutoPor, tagsExtras) {
  if (status === 'substituido') {
    return substitutoPor ? `Substituído por: ${substitutoPor}` : 'Substituído'
  }
  if (FIXED_LABELS[status]) return FIXED_LABELS[status]

  // Tag personalizada criada pelo usuário (+ NOVA TAG)
  const extra = tagsExtras?.find(t => t.value === status)
  if (extra) return extra.label

  return status ? status.toUpperCase() : '—'
}

// Retorna cor RGB para cada status (usada no didParseCell)
const FIXED_COLORS = {
  ausencia:            [180, 30,  30 ],  // vermelho
  aviso:               [130, 100, 0  ],  // amarelo escuro
  substituido:         [100, 60,  180],  // roxo
  bloqueado:           [200, 80,  10 ],  // laranja escuro
  ausencia_em_sistema: [30,  130, 80 ],  // verde
  nao_com_em_sistema:  [30,  90,  180],  // azul
}

function statusColor(status, tagsExtras) {
  if (FIXED_COLORS[status]) return FIXED_COLORS[status]
  const extra = tagsExtras?.find(t => t.value === status)
  if (extra) return hexToRgb(extra.color)
  return [100, 100, 110]
}

// Conta TODOS os status encontrados — fixos ou personalizados — não apenas
// os 6 fixos hardcoded. Retorna também os totais nomeados (para não quebrar
// nada que já dependa deles) e um mapa genérico `porStatus`.
function contarTudo(data) {
  const porStatus = {}
  let total = 0
  SHIFTS.forEach(s => {
    ;(data[s] || []).forEach(r => {
      if (!r.name?.trim()) return
      total++
      if (!r.status) return
      porStatus[r.status] = (porStatus[r.status] || 0) + 1
    })
  })
  return { total, porStatus }
}

// Monta a lista de cards de totais: primeiro os fixos na ordem histórica,
// depois — dinamicamente — qualquer tag personalizada usada nos dados.
function buildStatCards(porStatus, tagsExtras, orange) {
  const cards = [
    { label: 'TOTAL DE REGISTROS',                key: null,                   color: orange          },
    { label: 'AUS. NÃO COMUNICADAS',              key: 'ausencia',             color: [239, 68,  68 ] },
    { label: 'AUS. COMUNICADAS',                  key: 'aviso',                color: [234, 179, 8  ] },
    { label: 'SUBSTITUÍDOS',                      key: 'substituido',          color: [167, 139, 250] },
    { label: 'BLOQUEADOS',                        key: 'bloqueado',            color: orange          },
    { label: 'AUS. COMUNICADA — EM SISTEMA',      key: 'ausencia_em_sistema',  color: [34,  197, 94 ] },
    { label: 'AUS. NÃO COMUNICADA — EM SISTEMA',  key: 'nao_com_em_sistema',   color: [96,  165, 250] },
  ]

  const statusConhecidos = new Set(cards.map(c => c.key).filter(Boolean))
  Object.keys(porStatus)
    .filter(status => !statusConhecidos.has(status))
    .forEach(status => {
      const extra = tagsExtras.find(t => t.value === status)
      const label = extra ? extra.label.toUpperCase() : status.toUpperCase()
      const color = extra ? hexToRgb(extra.color) : [140, 140, 150]
      cards.push({ label, key: status, color })
    })

  return cards
}

// ── Gerador principal ─────────────────────────────────────────────────────────

export function generatePDF({ data, dateKey, responsible, user }) {
  const doc   = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  registerFonts(doc)
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const now   = new Date()
  const emitDate = formatDatePT(dateKey)
  const emitTime = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const tagsExtras = carregarTagsExtras() // tags personalizadas ("+ NOVA TAG")

  const orange = [249, 115, 22]
  const black  = [10,  10,  12 ]
  const gray   = [100, 100, 110]
  const lightG = [245, 245, 247]
  const white  = [255, 255, 255]

  // ── Header ────────────────────────────────────────────────────────────────
  doc.setFillColor(...black)
  doc.rect(0, 0, pageW, 38, 'F')
  doc.setFillColor(...orange)
  doc.rect(0, 38, pageW, 2, 'F')

  doc.setFont('Roboto', 'bold')
  doc.setFontSize(26)
  doc.setTextColor(...orange)
  doc.text('NEXUS', 14, 18)

  doc.setFont('Roboto', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(160, 160, 170)
  doc.text('SISTEMA DE CONTROLE DE AUSÊNCIAS', 14, 25)

  doc.setFontSize(8)
  doc.setTextColor(160, 160, 170)
  doc.text(`Data de referência: ${emitDate}`,           pageW - 14, 14, { align: 'right' })
  doc.text(`Emitido em: ${emitDate} às ${emitTime}`,    pageW - 14, 20, { align: 'right' })
  doc.text(`Responsável: ${responsible || 'Não informado'}`, pageW - 14, 26, { align: 'right' })
  doc.text(`Operador: ${user || ''}`,                   pageW - 14, 32, { align: 'right' })

  // ── Título ────────────────────────────────────────────────────────────────
  let y = 50
  doc.setFont('Roboto', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(...black)
  doc.text('RELATÓRIO DE CONTROLE DE AUSÊNCIAS', 14, y)

  doc.setFont('Roboto', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...gray)
  y += 6
  doc.text('Documento gerado automaticamente pelo sistema NEXUS — uso interno e confidencial', 14, y)

  // ── Totais globais (dinâmico — inclui tags personalizadas) ─────────────────
  y += 10
  const { total: totalAll, porStatus } = contarTudo(data)
  const allStats = buildStatCards(porStatus, tagsExtras, orange).map(c => ({
    label: c.label,
    value: c.key === null ? totalAll : (porStatus[c.key] || 0),
    color: c.color,
  }))

  // Cards em uma única linha (largura dividida pelo número de cards —
  // se houver muitas tags personalizadas, os cards ficam mais estreitos
  // e o label quebra em mais linhas automaticamente)
  const gap    = 2
  const cardW  = (pageW - 28 - gap * (allStats.length - 1)) / allStats.length

  // Altura do card calculada dinamicamente a partir do maior número de
  // linhas que qualquer label vai precisar — evita vazamento/sobreposição
  // quando entram labels de tags personalizadas mais longas.
  const maxLines = Math.max(
    ...allStats.map(st => doc.splitTextToSize(st.label, cardW - 5).length)
  )
  const cardH = 6.5 + maxLines * 3.2

  allStats.forEach((st, i) => {
    const x = 14 + i * (cardW + gap)

    // fundo cinza claro
    doc.setFillColor(...lightG)
    doc.rect(x, y, cardW, cardH, 'F')

    // barra colorida na esquerda
    doc.setFillColor(...st.color)
    doc.rect(x, y, 2.5, cardH, 'F')

    // número
    doc.setFont('Roboto', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(...black)
    doc.text(String(st.value), x + cardW / 2 + 1, y + 6.5, { align: 'center' })

    // label — quebra em N linhas se necessário
    doc.setFont('Roboto', 'normal')
    doc.setFontSize(4.8)
    doc.setTextColor(...gray)
    const lines = doc.splitTextToSize(st.label, cardW - 5)
    doc.text(lines, x + cardW / 2 + 1, y + 9.5, { align: 'center' })
  })
  y += cardH + 6

  // ── Tabelas por turno ─────────────────────────────────────────────────────
  SHIFTS.forEach(shift => {
    const rows = data[shift] || []
    if (!rows.length) return

    if (y > pageH - 50) { doc.addPage(); y = 20 }

    // Cabeçalho do turno
    doc.setFillColor(...black)
    doc.rect(14, y, pageW - 28, 8, 'F')
    doc.setFont('Roboto', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...white)
    doc.text(`TURNO — ${SHIFT_LABELS[shift].toUpperCase()}`, 18, y + 5.5)

    // Mini-stats do turno (dinâmico — soma qualquer status, incluindo tags extras)
    const validRows = rows.filter(r => r.name?.trim())
    const tTotal = validRows.length
    const tPorStatus = {}
    validRows.forEach(r => {
      if (r.status) tPorStatus[r.status] = (tPorStatus[r.status] || 0) + 1
    })
    const miniStatsPartes = [`${tTotal} reg`]
    ;[
      ['ausencia', 'não com.'],
      ['aviso', 'com.'],
      ['substituido', 'subst.'],
      ['bloqueado', 'bloq.'],
      ['ausencia_em_sistema', 'com/sis'],
      ['nao_com_em_sistema', 'ncom/sis'],
    ].forEach(([key, sufixo]) => {
      if (tPorStatus[key]) miniStatsPartes.push(`${tPorStatus[key]} ${sufixo}`)
    })
    // Tags personalizadas presentes neste turno
    Object.keys(tPorStatus)
      .filter(k => !['ausencia','aviso','substituido','bloqueado','ausencia_em_sistema','nao_com_em_sistema'].includes(k))
      .forEach(k => {
        const extra = tagsExtras.find(t => t.value === k)
        const nome = extra ? extra.label : k.toUpperCase()
        miniStatsPartes.push(`${tPorStatus[k]} ${nome}`)
      })

    doc.setFont('Roboto', 'normal')
    doc.setFontSize(6.5)
    doc.setTextColor(180, 180, 190)
    doc.text(miniStatsPartes.join('  |  '), pageW - 18, y + 5.5, { align: 'right' })
    y += 8

    // Linhas da tabela
    const tableRows = rows.map((r, i) => [
      String(i + 1).padStart(2, '0'),
      r.name || '—',
      statusLabel(r.status, r.substitutoPor, tagsExtras),
      r.obs || '—',
      r.date || '—',
    ])

    autoTable(doc, {
      startY: y,
      head: [['#', 'Colaborador', 'Status de Presença', 'Motivo / Observações', 'Data']],
      body: tableRows,
      margin: { left: 14, right: 14 },
      styles: { font: 'Roboto', fontSize: 8, cellPadding: 3, textColor: [30, 30, 35] },
      headStyles: {
        font: 'Roboto',
        fillColor: [30, 30, 35],
        textColor: white,
        fontStyle: 'bold',
        fontSize: 7.5,
        cellPadding: 3,
      },
      alternateRowStyles: { fillColor: [250, 250, 252] },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        2: { cellWidth: 58 },
        4: { cellWidth: 24, halign: 'center' },
      },
      didParseCell(hookData) {
        if (hookData.section === 'body' && hookData.column.index === 2) {
          // Encontra o status original pela linha
          const rowIdx = hookData.row.index
          const status = rows[rowIdx]?.status
          if (status) hookData.cell.styles.textColor = statusColor(status, tagsExtras)
        }
      },
      didDrawPage(hookData) { y = hookData.cursor.y },
    })

    y = doc.lastAutoTable.finalY + 6
  })

  // ── Footer em todas as páginas ────────────────────────────────────────────
  const totalPages = doc.internal.getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)
    doc.setFillColor(...black)
    doc.rect(0, pageH - 12, pageW, 12, 'F')
    doc.setFont('Roboto', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(120, 120, 130)
    doc.text('NEXUS © ' + now.getFullYear() + ' — Documento confidencial — uso interno', 14, pageH - 4.5)
    doc.text(`Página ${p} de ${totalPages}`, pageW - 14, pageH - 4.5, { align: 'right' })
  }

  // ── Assinatura na última página ───────────────────────────────────────────
  const sigY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 20 : pageH - 50
  if (sigY < pageH - 35) {
    doc.setPage(totalPages)
    doc.setDrawColor(80, 80, 90)
    doc.line(pageW - 80, sigY, pageW - 14, sigY)
    doc.setFont('Roboto', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...gray)
    doc.text(responsible || 'Responsável', pageW - 47, sigY + 5,  { align: 'center' })
    doc.text('Assinatura do Responsável',   pageW - 47, sigY + 9,  { align: 'center' })
  }

  doc.save(`NEXUS_Ausencias_${dateKey}.pdf`)
}