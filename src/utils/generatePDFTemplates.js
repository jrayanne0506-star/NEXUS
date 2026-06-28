/**
 * generatePDFTemplates.js
 * Três layouts fiéis aos templates Excel da Scorpions Delivery.
 * Dependências: jspdf, jspdf-autotable (já presentes no projeto)
 */

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { SHIFT_LABELS, SHIFTS, formatDatePT } from './storage'

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusLabel(status, substitutoPor) {
  switch (status) {
    case 'ausencia':            return 'FUROU'
    case 'aviso':               return 'PEDIU PRA SAIR'
    case 'substituido':         return substitutoPor ? `SUBSTITUÍDO: ${substitutoPor}` : 'SUBSTITUÍDO'
    case 'bloqueado':           return 'BLOQUEADO'
    case 'tirei':               return 'TIRAMOS'
    case 'ausencia_em_sistema': return 'AUS. COMUNICADA (EM SISTEMA)'
    case 'nao_com_em_sistema':  return 'AUS. NÃO COMUNICADA (EM SISTEMA)'
    default:                    return status?.toUpperCase() || '—'
  }
}

function statusColor(status) {
  switch (status) {
    case 'ausencia':            return [220, 38,  38 ]
    case 'aviso':               return [161, 128, 0  ]
    case 'substituido':         return [139, 92,  246]
    case 'bloqueado':           return [249, 115, 22 ]
    case 'tirei':               return [249, 115, 22 ]
    case 'ausencia_em_sistema': return [22,  163, 74 ]
    case 'nao_com_em_sistema':  return [59,  130, 246]
    default:                    return [110, 110, 120]
  }
}

function diaSemana(dateKey) {
  const dias = ['DOMINGO','SEGUNDA','TERÇA','QUARTA','QUINTA','SEXTA','SÁBADO']
  const [y, m, d] = dateKey.split('-').map(Number)
  return dias[new Date(y, m - 1, d).getDay()]
}

function globalCounts(data) {
  let pediu = 0, furou = 0, tirou = 0, total = 0
  SHIFTS.forEach(s => {
    ;(data[s] || []).forEach(r => {
      if (!r.name?.trim()) return
      total++
      if (r.status === 'aviso')                        pediu++
      if (r.status === 'ausencia')                     furou++
      if (r.status === 'tirei' || r.status === 'bloqueado') tirou++
    })
  })
  return { total, pediu, furou, tirou }
}

function addFooter(doc, pageH, pageW, now) {
  const total = doc.internal.getNumberOfPages()
  for (let p = 1; p <= total; p++) {
    doc.setPage(p)
    doc.setFillColor(18, 18, 20)
    doc.rect(0, pageH - 10, pageW, 10, 'F')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    doc.setTextColor(120, 120, 130)
    doc.text(
      `NEXUS © ${now.getFullYear()} — Scorpions Delivery — Documento Confidencial — Uso Interno`,
      14, pageH - 3.5
    )
    doc.text(`Página ${p} de ${total}`, pageW - 14, pageH - 3.5, { align: 'right' })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE 1
// Fiel ao template_1 (aba "Controle de Turnos"):
//   RELATÓRIO DE CONTROLE DE TURNOS
//   Data de Referência: DD/MM
//   SAIU OU FURARAM [TURNO] [DATA]   |  STATUS  |  OBSERVAÇÕES (MOTIVOS)
//   NOME: [NOME EM MAIÚSCULO]           [STATUS]    [OBS]
//   ...
//   Total — PEDIU PRA SAIR   N
//   Total — FUROU             N
//   Total de Registros        N
//   RESPONSÁVEL: ___________   Relatório Confidencial — Uso Interno   Pág. 1
// ─────────────────────────────────────────────────────────────────────────────
export function generatePDFTemplate1({ data, dateKey, responsible }) {
  const doc   = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const emitDate = formatDatePT(dateKey)
  const now = new Date()

  const black  = [18,  18,  20 ]
  const white  = [255, 255, 255]
  const gray   = [110, 110, 120]
  const lgray  = [235, 235, 238]
  const orange = [249, 115, 22 ]

  // ── Cabeçalho ──
  doc.setFillColor(...black)
  doc.rect(0, 0, pageW, 26, 'F')
  doc.setFillColor(...orange)
  doc.rect(0, 26, pageW, 1.5, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(...white)
  doc.text('RELATÓRIO DE CONTROLE DE TURNOS', 14, 11)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(160, 160, 170)
  doc.text(`Data de Referência: ${emitDate}`, 14, 19)
  doc.text(`Responsável: ${responsible || ''}`, pageW - 14, 19, { align: 'right' })

  let y = 34

  SHIFTS.forEach(shift => {
    const rows = (data[shift] || []).filter(r => r.name?.trim())
    if (!rows.length) return

    if (y > pageH - 40) { doc.addPage(); y = 18 }

    const shiftLabel = SHIFT_LABELS[shift]?.toUpperCase() || shift.toUpperCase()

    // Cabeçalho da seção — fundo cinza claro, igual ao Excel
    doc.setFillColor(...lgray)
    doc.rect(14, y, pageW - 28, 8, 'F')
    doc.setFillColor(...orange)
    doc.rect(14, y, 3, 8, 'F')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(...black)
    doc.text(`SAIU OU FURARAM ${shiftLabel} ${emitDate}`, 20, y + 5.3)

    // Colunas de cabeçalho
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(...gray)
    doc.text('STATUS', pageW - 72, y + 5.3)
    doc.text('OBSERVAÇÕES (MOTIVOS)', pageW - 55, y + 5.3)

    y += 10

    rows.forEach((r, i) => {
      if (y > pageH - 22) { doc.addPage(); y = 18 }

      // Fundo alternado
      if (i % 2 === 0) {
        doc.setFillColor(250, 250, 252)
        doc.rect(14, y - 1.5, pageW - 28, 8, 'F')
      }

      // NOME:
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(...black)
      doc.text(`NOME: ${r.name.toUpperCase()}`, 18, y + 3.5)

      // Status colorido
      const sc = statusColor(r.status)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(...sc)
      doc.text(statusLabel(r.status, r.substitutoPor), pageW - 72, y + 3.5)

      // Observação
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.setTextColor(...gray)
      const obs = (r.obs || '').substring(0, 35)
      doc.text(obs, pageW - 55, y + 3.5)

      y += 8
    })

    y += 5
  })

  // ── Resumo ──
  if (y > pageH - 45) { doc.addPage(); y = 18 }

  const g = globalCounts(data)
  y += 2

  const resumo = [
    ['Total — PEDIU PRA SAIR', g.pediu ],
    ['Total — FUROU',           g.furou ],
    ['Total de Registros',      g.total ],
  ]

  resumo.forEach(([label, val], i) => {
    const isTotal = i === resumo.length - 1
    doc.setFillColor(isTotal ? 240 : 248, isTotal ? 240 : 248, isTotal ? 244 : 252)
    doc.rect(14, y - 1, pageW - 28, 7, 'F')
    doc.setFont('helvetica', isTotal ? 'bold' : 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(...black)
    doc.text(label, 18, y + 4)
    doc.setFont('helvetica', 'bold')
    if (isTotal) { doc.setTextColor(...orange) } else { doc.setTextColor(...black) }
    doc.text(String(val), pageW - 18, y + 4, { align: 'right' })
    y += 8
  })

  // ── Rodapé de assinatura (igual ao Excel: linha + responsável + "Relatório Confidencial") ──
  y += 12
  if (y < pageH - 20) {
    doc.setDrawColor(...gray)
    doc.line(14, y, 90, y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...gray)
    doc.text(`RESPONSÁVEL: ${responsible || '__________________________'}`, 14, y + 6)
    doc.text('Relatório Confidencial — Uso Interno', pageW / 2, y + 6, { align: 'center' })
    doc.text(`Pág. 1`, pageW - 14, y + 6, { align: 'right' })
  }

  addFooter(doc, pageH, pageW, now)
  doc.save(`NEXUS_Relatorio_Turnos_${dateKey}.pdf`)
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE 2
// Fiel ao Modelo 2 (Jeniffer_ADS):
//   RELATÓRIO DE CONTROLE DE TURNOS
//   Data de Referência:   Responsável: Jeniffer
//   Nº | Nome do Funcionário | Status | Turno | Observação
//   --- linha de seção: SAIU OU FURARAM [TURNO] ---
//   1  | nome                | PEDIU  | ALMOÇO |
//   ...
//   RESUMO GERAL
//   Total — PEDIU PRA SAIR   22
//   Total — FUROU             5
//   Total de Registros        27
// ─────────────────────────────────────────────────────────────────────────────
export function generatePDFTemplate2({ data, dateKey, responsible }) {
  const doc   = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const emitDate = formatDatePT(dateKey)
  const now = new Date()

  const black  = [18,  18,  20 ]
  const white  = [255, 255, 255]
  const gray   = [110, 110, 120]
  const orange = [249, 115, 22 ]

  // ── Cabeçalho ──
  doc.setFillColor(...black)
  doc.rect(0, 0, pageW, 30, 'F')
  doc.setFillColor(...orange)
  doc.rect(0, 30, pageW, 1.5, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(...white)
  doc.text('RELATÓRIO DE CONTROLE DE TURNOS', 14, 11)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(160, 160, 170)
  doc.text('Relatório Confidencial — Uso Interno', 14, 18)
  doc.text(`Data de Referência: ${emitDate}`, 14, 25)
  doc.text(`Responsável: ${responsible || 'Não informado'}`, pageW - 14, 25, { align: 'right' })

  // ── Monta body com linhas de seção intercaladas ──
  // Cada linha de seção = linha especial com colSpan via didParseCell
  const tableBody = []
  const sectionRows = new Set() // índices das linhas de seção
  let counter = 1

  SHIFTS.forEach(shift => {
    const rows = (data[shift] || []).filter(r => r.name?.trim())
    if (!rows.length) return

    const shiftLabel = SHIFT_LABELS[shift]?.toUpperCase() || shift.toUpperCase()

    // Linha de seção
    sectionRows.add(tableBody.length)
    tableBody.push([`SAIU OU FURARAM ${shiftLabel}`, '', '', '', ''])

    rows.forEach(r => {
      tableBody.push([
        String(counter++).padStart(2, '0'),
        r.name.toUpperCase(),
        statusLabel(r.status, r.substitutoPor),
        shiftLabel,
        r.obs || '',
      ])
    })
  })

  // Guarda status original para colorir
  let dataCounter = 0
  const statusMap = []
  SHIFTS.forEach(shift => {
    ;(data[shift] || []).filter(r => r.name?.trim()).forEach(r => {
      statusMap.push(r.status)
    })
  })

  autoTable(doc, {
    startY: 38,
    head: [['Nº', 'Nome do Funcionário', 'Status', 'Turno', 'Observação']],
    body: tableBody,
    margin: { left: 14, right: 14 },
    styles: { fontSize: 8, cellPadding: 3, textColor: black },
    headStyles: {
      fillColor: black,
      textColor: white,
      fontStyle: 'bold',
      fontSize: 8,
    },
    alternateRowStyles: { fillColor: [248, 248, 252] },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      2: { cellWidth: 48 },
      3: { cellWidth: 20, halign: 'center', fontStyle: 'bold', textColor: orange },
    },
    didParseCell(hookData) {
      const rowIdx = hookData.row.index

      // Linha de seção — fundo escuro, texto branco, span visual
      if (sectionRows.has(rowIdx)) {
        hookData.cell.styles.fillColor = [30, 30, 36]
        hookData.cell.styles.textColor = orange
        hookData.cell.styles.fontStyle = 'bold'
        hookData.cell.styles.fontSize  = 8.5
        if (hookData.column.index > 0) {
          hookData.cell.styles.textColor = [30, 30, 36] // invisível nas outras colunas
        }
      }

      // Status colorido
      if (!sectionRows.has(rowIdx) && hookData.section === 'body' && hookData.column.index === 2) {
        // conta linhas de dados antes desse row
        let dataIdx = 0
        for (let i = 0; i < rowIdx; i++) {
          if (!sectionRows.has(i)) dataIdx++
        }
        const st = statusMap[dataIdx]
        if (st) hookData.cell.styles.textColor = statusColor(st)
      }
    },
  })

  // ── Resumo ──
  let ry = doc.lastAutoTable.finalY + 8
  if (ry > pageH - 45) { doc.addPage(); ry = 18 }

  const g = globalCounts(data)
  const resumo = [
    ['Total — PEDIU PRA SAIR', g.pediu ],
    ['Total — FUROU',           g.furou ],
    ['Total de Registros',      g.total ],
  ]

  autoTable(doc, {
    startY: ry,
    head: [['RESUMO GERAL', '']],
    body: resumo,
    margin: { left: 14, right: 14 },
    styles: { fontSize: 8.5, cellPadding: 3.5 },
    headStyles: { fillColor: black, textColor: white, fontStyle: 'bold', fontSize: 9 },
    alternateRowStyles: { fillColor: [248, 248, 252] },
    columnStyles: {
      0: { fontStyle: 'normal' },
      1: { halign: 'right', fontStyle: 'bold', cellWidth: 20 },
    },
    didParseCell(hookData) {
      if (hookData.section === 'body' && hookData.row.index === resumo.length - 1) {
        hookData.cell.styles.fontStyle = 'bold'
        if (hookData.column.index === 1) hookData.cell.styles.textColor = orange
      }
    },
  })

  addFooter(doc, pageH, pageW, now)
  doc.save(`NEXUS_Modelo2_Turnos_${dateKey}.pdf`)
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE 3
// Fiel à aba "Turnos 14·03" do template_2:
//   RELATÓRIO DE CONTROLE DE TURNOS  ·  DD/MM/AAAA
//   Responsável: SEU NOME  ·  Relatório Confidencial — Uso Interno
//
//   # | ENTREGADOR | TURNO | OCORRÊNCIA | OBSERVAÇÃO
//   SAIU OU FURARAM  ·  ALMOÇO  ·  SÁBADO 14/03
//   1 | NOME | ALMOÇO | PEDIU PRA SAIR |
//   ...  (numeração reinicia a cada turno)
//
//   RESUMO GERAL
//   Total — PEDIU PRA SAIR   22
//   Total — FUROU              5
//   Total — FALTOU SEM AVISO   0
//   Total — ATESTADO           0
//   Total de Registros        27
//
//   OCORRÊNCIAS → 🔴 Pediu pra sair  🟠 Furou  🔴 Faltou sem aviso  🟢 Atestado  ⚪ Outro
// ─────────────────────────────────────────────────────────────────────────────
export function generatePDFTemplate3({ data, dateKey, responsible }) {
  const doc   = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const emitDate = formatDatePT(dateKey)
  const now = new Date()
  const dia = diaSemana(dateKey)

  const black  = [18,  18,  20 ]
  const white  = [255, 255, 255]
  const gray   = [110, 110, 120]
  const orange = [249, 115, 22 ]

  // ── Cabeçalho minimalista com · ──
  doc.setFillColor(...black)
  doc.rect(0, 0, pageW, 22, 'F')
  doc.setFillColor(...orange)
  doc.rect(0, 22, pageW, 1, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...white)
  doc.text(`RELATÓRIO DE CONTROLE DE TURNOS  ·  ${emitDate}`, 14, 10)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(160, 160, 170)
  doc.text(
    `Responsável: ${responsible || 'SEU NOME'}  ·  Relatório Confidencial — Uso Interno`,
    14, 18
  )

  // ── Monta body com linhas de seção ──
  const tableBody  = []
  const sectionRows = new Set()
  const rowStatusMap = [] // só linhas de dados

  SHIFTS.forEach(shift => {
    const rows = (data[shift] || []).filter(r => r.name?.trim())
    if (!rows.length) return

    const shiftLabel = SHIFT_LABELS[shift]?.toUpperCase() || shift.toUpperCase()

    sectionRows.add(tableBody.length)
    tableBody.push([`SAIU OU FURARAM  ·  ${shiftLabel}  ·  ${dia} ${emitDate}`, '', '', '', ''])

    rows.forEach((r, i) => {
      tableBody.push([
        String(i + 1), // numeração reinicia por turno
        r.name.toUpperCase(),
        shiftLabel,
        statusLabel(r.status, r.substitutoPor),
        r.obs || '',
      ])
      rowStatusMap.push(r.status)
    })
  })

  autoTable(doc, {
    startY: 30,
    head: [['#', 'ENTREGADOR', 'TURNO', 'OCORRÊNCIA', 'OBSERVAÇÃO']],
    body: tableBody,
    margin: { left: 14, right: 14 },
    styles: { fontSize: 8, cellPadding: 3, textColor: black },
    headStyles: {
      fillColor: [30, 30, 36],
      textColor: white,
      fontStyle: 'bold',
      fontSize: 7.5,
    },
    alternateRowStyles: { fillColor: [250, 250, 253] },
    columnStyles: {
      0: { cellWidth: 9,  halign: 'center', textColor: gray },
      2: { cellWidth: 20, halign: 'center', fontStyle: 'bold', textColor: orange },
      3: { cellWidth: 50 },
    },
    didParseCell(hookData) {
      const rowIdx = hookData.row.index

      // Linha de seção
      if (sectionRows.has(rowIdx)) {
        hookData.cell.styles.fillColor  = [30, 30, 36]
        hookData.cell.styles.fontStyle  = 'bold'
        hookData.cell.styles.fontSize   = 8.5
        if (hookData.column.index === 0) {
          hookData.cell.styles.textColor = orange
        } else {
          hookData.cell.styles.textColor = [30, 30, 36]
        }
      }

      // Ocorrência colorida
      if (!sectionRows.has(rowIdx) && hookData.section === 'body' && hookData.column.index === 3) {
        let dataIdx = 0
        for (let i = 0; i < rowIdx; i++) {
          if (!sectionRows.has(i)) dataIdx++
        }
        const st = rowStatusMap[dataIdx]
        if (st) hookData.cell.styles.textColor = statusColor(st)
      }
    },
  })

  // ── Resumo ──
  let ry = doc.lastAutoTable.finalY + 8
  if (ry > pageH - 55) { doc.addPage(); ry = 18 }

  const g = globalCounts(data)
  const resumo = [
    ['Total — PEDIU PRA SAIR',     g.pediu ],
    ['Total — FUROU',               g.furou ],
    ['Total — FALTOU SEM AVISO',    0       ],
    ['Total — ATESTADO',            0       ],
    ['Total de Registros',          g.total ],
  ]

  autoTable(doc, {
    startY: ry,
    head: [['RESUMO GERAL', '']],
    body: resumo,
    margin: { left: 14, right: 14 },
    styles: { fontSize: 8.5, cellPadding: 3.5 },
    headStyles: { fillColor: black, textColor: white, fontStyle: 'bold', fontSize: 9 },
    alternateRowStyles: { fillColor: [248, 248, 252] },
    columnStyles: {
      0: { fontStyle: 'normal' },
      1: { halign: 'right', fontStyle: 'bold', cellWidth: 20 },
    },
    didParseCell(hookData) {
      if (hookData.section === 'body' && hookData.row.index === resumo.length - 1) {
        hookData.cell.styles.fontStyle = 'bold'
        if (hookData.column.index === 1) hookData.cell.styles.textColor = orange
      }
    },
  })

  // ── Legenda de ocorrências (fiel ao template) ──
  const legY = doc.lastAutoTable.finalY + 8
  if (legY < pageH - 16) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...gray)
    doc.text(
      'OCORRÊNCIAS \u2192   \uD83D\uDD34 Pediu pra sair   \uD83D\uDFE0 Furou   \uD83D\uDD34 Faltou sem aviso   \uD83D\uDFE2 Atestado   \u26AA Outro   |   Coluna OBSERVA\u00C7\u00C3O livre para edi\u00E7\u00E3o',
      14, legY
    )
  }

  addFooter(doc, pageH, pageW, now)
  doc.save(`NEXUS_Modelo3_Turnos_${dateKey}.pdf`)
}