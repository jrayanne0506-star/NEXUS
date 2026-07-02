import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { SHIFT_LABELS, SHIFTS, formatDatePT } from './storage'

function statusLabel(status, substitutoPor) {
  switch (status) {
    case 'ausencia':            return 'Ausência Não Comunicada'
    case 'aviso':               return 'Ausência Comunicada'
    case 'substituido':         return substitutoPor ? `Substituído por: ${substitutoPor}` : 'Substituído'
    case 'bloqueado':           return 'Bloqueado'
    case 'tirei':               return 'Tiramos'
    case 'ausencia_em_sistema': return 'Aus. Comunicada — em sistema'
    case 'nao_com_em_sistema':  return 'Aus. Não Comunicada — em sistema'
    default:                    return status?.toUpperCase() || '—'
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PALETA DE CORES ÚNICA — mesma lógica de cores do painel NEXUS, usada em
// TODOS os templates de PDF para manter consistência visual.
// ─────────────────────────────────────────────────────────────────────────────
const STATUS_COLORS = {
  aviso:               [234, 179, 8  ], // amarelo  — Ausência comunicada
  ausencia:            [239, 68,  68 ], // vermelho — Ausência não comunicada
  substituido:         [167, 139, 250], // roxo     — Substituído
  bloqueado:           [249, 115, 22 ], // laranja  — Bloqueado
  ausencia_em_sistema: [234, 179, 8  ], // amarelo  — Ausência comunicada (em sistema)
  nao_com_em_sistema:  [239, 68,  68 ], // vermelho — Ausência não comunicada (em sistema)
  tirei:               [180, 180, 180], // cinza    — Tiramos (residual)
}

function statusColorFor(status) {
  return STATUS_COLORS[status] || [180, 180, 180]
}

function diaSemana(dateKey) {
  const dias = ['DOMINGO','SEGUNDA','TERÇA','QUARTA','QUINTA','SEXTA','SÁBADO']
  const [y, m, d] = dateKey.split('-').map(Number)
  return dias[new Date(y, m - 1, d).getDay()]
}

function globalCounts(data) {
  let pediu = 0, furou = 0, substituido = 0, bloqueado = 0
  let ausSistema = 0, naoComSistema = 0, tirou = 0, total = 0
  SHIFTS.forEach(s => {
    ;(data[s] || []).forEach(r => {
      if (!r.name?.trim()) return
      total++
      if (r.status === 'aviso')               pediu++
      if (r.status === 'ausencia')             furou++
      if (r.status === 'substituido')          substituido++
      if (r.status === 'bloqueado')            bloqueado++
      if (r.status === 'ausencia_em_sistema')  ausSistema++
      if (r.status === 'nao_com_em_sistema')   naoComSistema++
      if (r.status === 'tirei')                tirou++
    })
  })
  return { total, pediu, furou, substituido, bloqueado, ausSistema, naoComSistema, tirou }
}

function addFooter(doc, pageH, pageW, now) {
  const total = doc.internal.getNumberOfPages()
  for (let p = 1; p <= total; p++) {
    doc.setPage(p)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(150, 150, 160)
    doc.text(
      `NEXUS © ${now.getFullYear()} — Scorpions Delivery — Documento Confidencial — Uso Interno`,
      14, pageH - 4
    )
    doc.text(`Página ${p} de ${total}`, pageW - 14, pageH - 4, { align: 'right' })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE 1 — Cabeçalho laranja, linhas pretas, STATUS colorido
// ─────────────────────────────────────────────────────────────────────────────
export function generatePDFTemplate1({ data, dateKey, responsible }) {
  const doc   = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const emitDate = formatDatePT(dateKey)
  const now = new Date()

  const orange = [210, 105, 30]
  const darkBg = [26,  26,  26]
  const secBg  = [80,  80,  80]
  const white  = [255, 255, 255]

  // Cabeçalho laranja
  doc.setFillColor(...orange)
  doc.rect(0, 0, pageW, 42, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(...white)
  doc.text('RELATÓRIO DE CONTROLE DE TURNOS', pageW / 2, 13, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text('Data de Referência:', pageW / 2, 23, { align: 'center' })
  doc.setFont('helvetica', 'bold')
  doc.text(emitDate, pageW / 2, 30, { align: 'center' })
  if (responsible) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.text(`Responsável: ${responsible}`, pageW / 2, 38, { align: 'center' })
  }

  let y = 48
  const totalW = pageW - 28
  const nameW  = totalW - 42 - 58   // status=42, obs=58

  SHIFTS.forEach(shift => {
    const rows = (data[shift] || []).filter(r => r.name?.trim())
    if (!rows.length) return
    if (y > pageH - 40) { doc.addPage(); y = 14 }

    const shiftLabel = SHIFT_LABELS[shift]?.toUpperCase() || shift.toUpperCase()

    // Linha de seção cinza escuro
    doc.setFillColor(...secBg)
    doc.rect(14, y, totalW, 8, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...white)
    doc.text(`SAIU OU FURARAM ${shiftLabel} ${emitDate}`, 17, y + 5.3)
    doc.text('STATUS', 14 + nameW + 4, y + 5.3)
    doc.text('OBSERVAÇÕES (MOTIVOS)', 14 + nameW + 46, y + 5.3)
    y += 8

    rows.forEach(r => {
      const statusText  = statusLabel(r.status, r.substitutoPor)
      const statusMaxW  = 40 // largura útil da coluna STATUS
      const statusLines = doc.splitTextToSize(statusText, statusMaxW)

      const obsMaxW  = totalW - nameW - 46 - 3 // largura útil da coluna OBSERVAÇÕES
      const obsLines = doc.splitTextToSize((r.obs || '').toUpperCase(), obsMaxW)

      const neededLines = Math.max(statusLines.length, obsLines.length)
      const rowH = Math.max(8, neededLines * 3.6 + 4.5)

      if (y > pageH - 20) { doc.addPage(); y = 14 }

      doc.setFillColor(...darkBg)
      doc.rect(14, y, totalW, rowH, 'F')

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(...white)
      doc.text(`NOME: ${r.name.toUpperCase()}`, 17, y + 5.3)

      doc.setFontSize(6.5)
      doc.setTextColor(...statusColorFor(r.status))
      doc.text(statusLines, 14 + nameW + 4, y + 4.8)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      doc.setTextColor(...white)
      doc.text(obsLines, 14 + nameW + 46, y + 4.8)

      y += rowH
    })
    y += 4
  })

  // Resumo
  if (y > pageH - 45) { doc.addPage(); y = 14 }
  y += 4
  const g = globalCounts(data)
  ;[
    ['Total — Ausência Comunicada',                     g.pediu,         STATUS_COLORS.aviso],
    ['Total — Ausência Não Comunicada',                  g.furou,         STATUS_COLORS.ausencia],
    ['Total — SUBSTITUÍDOS',                             g.substituido,   STATUS_COLORS.substituido],
    ['Total — BLOQUEADOS',                                g.bloqueado,     STATUS_COLORS.bloqueado],
    ['Total — AUS. COMUNICADA (EM SISTEMA)',             g.ausSistema,    STATUS_COLORS.ausencia_em_sistema],
    ['Total — AUS. NÃO COMUNICADA (EM SISTEMA)',         g.naoComSistema, STATUS_COLORS.nao_com_em_sistema],
    ['Total de Registros',                                g.total,         [40, 40, 40]],
  ].forEach(([label, val, color]) => {
    if (y > pageH - 20) { doc.addPage(); y = 14 }
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(40, 40, 40)
    doc.text(label, 14, y + 4)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...color)
    doc.text(String(val), pageW - 14, y + 4, { align: 'right' })
    y += 8
  })

  y += 10
  if (y < pageH - 20) {
    doc.setDrawColor(150, 150, 150)
    doc.line(14, y, 100, y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(100, 100, 100)
    doc.text(`RESPONSÁVEL: ${responsible || '__________________________'}`, 14, y + 6)
    doc.text('Relatório Confidencial — Uso Interno', pageW / 2, y + 6, { align: 'center' })
    doc.text('Pág. 1', pageW - 14, y + 6, { align: 'right' })
  }

  addFooter(doc, pageH, pageW, now)
  doc.save(`NEXUS_Relatorio_Turnos_${dateKey}.pdf`)
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE 2 — Cabeçalho azul escuro, tabelas por turno separadas manualmente
// ─────────────────────────────────────────────────────────────────────────────
export function generatePDFTemplate2({ data, dateKey, responsible }) {
  const doc   = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const emitDate = formatDatePT(dateKey)
  const now = new Date()

  const navyDark = [26,  58,  107]
  const navyMid  = [45,  90,  160]
  const white    = [255, 255, 255]
  const beige    = [253, 245, 230]
  const black    = [20,  20,  20 ]

  // Cabeçalho azul escuro
  doc.setFillColor(...navyDark)
  doc.rect(0, 0, pageW, 48, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.setTextColor(...white)
  doc.text('RELATÓRIO DE CONTROLE DE TURNOS', pageW / 2, 13, { align: 'center' })
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(8.5)
  doc.setTextColor(200, 210, 230)
  doc.text('Relatório Confidencial — Uso Interno', pageW / 2, 21, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...white)
  doc.text(`Data de Referência: ${emitDate}`, pageW / 2, 31, { align: 'center' })
  doc.text(`Responsável: ${responsible || 'Não informado'}`, pageW / 2, 40, { align: 'center' })

  let y = 54
  let globalCounter = 1

  SHIFTS.forEach(shift => {
    const rows = (data[shift] || []).filter(r => r.name?.trim())
    if (!rows.length) return
    if (y > pageH - 50) { doc.addPage(); y = 14 }

    const shiftLabel = SHIFT_LABELS[shift]?.toUpperCase() || shift.toUpperCase()

    // Linha de seção desenhada manualmente
    doc.setFillColor(...navyDark)
    doc.rect(14, y, pageW - 28, 8, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...white)
    doc.text(`SAIU OU FURARAM ${shiftLabel}`, 18, y + 5.5)
    y += 8

    const tableRows = rows.map(r => [
      String(globalCounter++),
      r.name,
      statusLabel(r.status, r.substitutoPor),
      shiftLabel,
      r.obs || '',
    ])
    const statusArr = rows.map(r => r.status)

    autoTable(doc, {
      startY: y,
      head: [['Nº', 'Nome do Funcionário', 'Status', 'Turno', 'Observação']],
      body: tableRows,
      margin: { left: 14, right: 14 },
      styles: { fontSize: 8.5, cellPadding: 3.5, textColor: black },
      headStyles: { fillColor: navyMid, textColor: white, fontStyle: 'bold', fontSize: 8.5, halign: 'center' },
      alternateRowStyles: { fillColor: beige },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        2: { cellWidth: 45, fontStyle: 'bold' },
        3: { cellWidth: 22, halign: 'center' },
      },
      didParseCell(hookData) {
        if (hookData.section === 'body' && hookData.column.index === 2) {
          const st = statusArr[hookData.row.index]
          hookData.cell.styles.fontStyle = 'bold'
          hookData.cell.styles.textColor = statusColorFor(st)
        }
      },
    })

    y = doc.lastAutoTable.finalY + 6
  })

  // Resumo
  if (y > pageH - 45) { doc.addPage(); y = 14 }
  const g = globalCounts(data)
  autoTable(doc, {
    startY: y,
    head: [['RESUMO GERAL', '']],
    body: [
      ['Total — Ausência Comunicada', g.pediu],
      ['Total — Ausência Não Comunicada',       g.furou],
      ['Total — Substituídos',                      g.substituido],
      ['Total — Bloqueados',                        g.bloqueado],
      ['Total — Aus. Comunicada (em sistema)',      g.ausSistema],
      ['Total — Aus. Não Comunicada (em sistema)',  g.naoComSistema],
      ['Total de Registros',                        g.total],
    ],
    margin: { left: 14, right: 14 },
    styles: { fontSize: 9, cellPadding: 3.5, textColor: black },
    headStyles: { fillColor: navyDark, textColor: white, fontStyle: 'bold', fontSize: 9 },
    alternateRowStyles: { fillColor: beige },
    columnStyles: {
      0: { fontStyle: 'normal' },
      1: { halign: 'right', fontStyle: 'bold', cellWidth: 20 },
    },
    didParseCell(hookData) {
      if (hookData.section === 'body' && hookData.column.index === 1 && hookData.row.index < 6) {
        const keys = ['aviso', 'ausencia', 'substituido', 'bloqueado', 'ausencia_em_sistema', 'nao_com_em_sistema']
        hookData.cell.styles.textColor = statusColorFor(keys[hookData.row.index])
      }
    },
  })

  addFooter(doc, pageH, pageW, now)
  doc.save(`NEXUS_Modelo2_Turnos_${dateKey}.pdf`)
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE 3 — Fundo escuro, seções com borda azul, tabelas por turno separadas
// ─────────────────────────────────────────────────────────────────────────────
export function generatePDFTemplate3({ data, dateKey, responsible }) {
  const doc   = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const emitDate = formatDatePT(dateKey)
  const now = new Date()
  const dia = diaSemana(dateKey)

  const bgMain = [22,  33,  62 ]
  const bgSec  = [26,  26,  46 ]
  const bgAlt  = [15,  52,  96 ]
  const bgHead = [10,  10,  20 ]
  const white  = [255, 255, 255]
  const gray   = [140, 150, 170]
  const orange = [249, 115, 22 ]
  const blue   = [74,  144, 217]

  // Cabeçalho preto
  doc.setFillColor(...bgHead)
  doc.rect(0, 0, pageW, 28, 'F')
  doc.setFillColor(...orange)
  doc.rect(0, 28, pageW, 0.8, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(...white)
  doc.text(`RELATÓRIO DE CONTROLE DE TURNOS  ·  ${emitDate}`, pageW / 2, 12, { align: 'center' })
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(8)
  doc.setTextColor(...gray)
  doc.text(
    `Responsável: ${responsible || 'SEU NOME'}  ·  Relatório Confidencial — Uso Interno`,
    pageW / 2, 21, { align: 'center' }
  )

  let y = 34
  let shiftCounter = 1 // reinicia por turno

  SHIFTS.forEach(shift => {
    const rows = (data[shift] || []).filter(r => r.name?.trim())
    if (!rows.length) return
    if (y > pageH - 50) { doc.addPage(); y = 14 }

    const shiftLabel = SHIFT_LABELS[shift]?.toUpperCase() || shift.toUpperCase()

    // Linha de seção: fundo bgSec + borda esquerda azul
    doc.setFillColor(...bgSec)
    doc.rect(14, y, pageW - 28, 8, 'F')
    doc.setFillColor(...blue)
    doc.rect(14, y, 2.5, 8, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(...white)
    doc.text(`SAIU OU FURARAM  ·  ${shiftLabel}  ·  ${dia} ${emitDate}`, 20, y + 5.5)
    y += 8

    const tableRows = rows.map((r, i) => [
      String(i + 1),  // reinicia por turno
      r.name.toUpperCase(),
      shiftLabel,
      statusLabel(r.status, r.substitutoPor),
      r.obs || '',
    ])
    const statusArr = rows.map(r => r.status)

    autoTable(doc, {
      startY: y,
      head: [['#', 'ENTREGADOR', 'TURNO', 'OCORRÊNCIA', 'OBSERVAÇÃO']],
      body: tableRows,
      margin: { left: 14, right: 14 },
      styles: { fontSize: 8, cellPadding: 3, textColor: white, fillColor: bgMain },
      headStyles: { fillColor: bgHead, textColor: white, fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: bgAlt },
      columnStyles: {
        0: { cellWidth: 9,  halign: 'center', textColor: gray, fontSize: 7 },
        2: { cellWidth: 22, halign: 'center', textColor: orange, fontStyle: 'bold' },
        3: { cellWidth: 52 },
      },
      didParseCell(hookData) {
        if (hookData.section === 'body' && hookData.column.index === 3) {
          const st = statusArr[hookData.row.index]
          if (st) hookData.cell.styles.textColor = statusColorFor(st)
        }
      },
    })

    y = doc.lastAutoTable.finalY + 6
  })

  // Resumo
  if (y > pageH - 55) { doc.addPage(); y = 14 }
  const g3 = globalCounts(data)
  autoTable(doc, {
    startY: y,
    head: [['RESUMO GERAL', '']],
    body: [
      ['Total — Ausência Comunicada', g3.pediu],
      ['Total — Ausência Não Comunicada',       g3.furou],
      ['Total — Substituídos',                      g3.substituido],
      ['Total — Bloqueados',                        g3.bloqueado],
      ['Total — Aus. Comunicada (em sistema)',      g3.ausSistema],
      ['Total — Aus. Não Comunicada (em sistema)',  g3.naoComSistema],
      ['Total de Registros',                        g3.total],
    ],
    margin: { left: 14, right: 14 },
    styles: { fontSize: 8.5, cellPadding: 3.5, textColor: white, fillColor: bgMain },
    headStyles: { fillColor: bgHead, textColor: white, fontStyle: 'bold', fontSize: 9 },
    alternateRowStyles: { fillColor: bgAlt },
    columnStyles: {
      0: { fontStyle: 'normal' },
      1: { halign: 'right', fontStyle: 'bold', cellWidth: 20 },
    },
    didParseCell(hookData) {
      if (hookData.section === 'body' && hookData.column.index === 1 && hookData.row.index < 6) {
        const keys = ['aviso', 'ausencia', 'substituido', 'bloqueado', 'ausencia_em_sistema', 'nao_com_em_sistema']
        hookData.cell.styles.textColor = statusColorFor(keys[hookData.row.index])
      }
    },
  })

  // Legenda
  const legY = doc.lastAutoTable.finalY + 8
  if (legY < pageH - 14) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...gray)
    doc.text(
      'OCORRÊNCIAS \u2192   \uD83D\uDFE1 Comunicada   \uD83D\uDD34 Não comunicada   \uD83D\uDFE3 Substituído   \uD83D\uDFE0 Bloqueado   |   Coluna OBSERVA\u00C7\u00C3O livre para edi\u00E7\u00E3o',
      14, legY
    )
  }

  addFooter(doc, pageH, pageW, now)
  doc.save(`NEXUS_Modelo3_Turnos_${dateKey}.pdf`)
}