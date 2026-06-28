import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { SHIFT_LABELS, SHIFTS, formatDatePT } from './storage'

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
      if (r.status === 'aviso')    pediu++
      if (r.status === 'ausencia') furou++
      if (r.status === 'tirei' || r.status === 'bloqueado') tirou++
    })
  })
  return { total, pediu, furou, tirou }
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
  const green  = [0,   180, 0  ]
  const yellow = [200, 180, 0  ]
  const red    = [220, 50,  50 ]
  const gray   = [180, 180, 180]

  function getStatusColor(status) {
    if (status === 'aviso')                              return green
    if (status === 'tirei' || status === 'bloqueado')   return yellow
    if (status === 'ausencia')                           return red
    return gray
  }

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
      if (y > pageH - 20) { doc.addPage(); y = 14 }
      doc.setFillColor(...darkBg)
      doc.rect(14, y, totalW, 8, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(...white)
      doc.text(`NOME: ${r.name.toUpperCase()}`, 17, y + 5.3)
      doc.setTextColor(...getStatusColor(r.status))
      doc.text(statusLabel(r.status, r.substitutoPor), 14 + nameW + 4, y + 5.3)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...white)
      doc.text((r.obs || '').toUpperCase().substring(0, 28), 14 + nameW + 46, y + 5.3)
      y += 8
    })
    y += 4
  })

  // Resumo
  if (y > pageH - 45) { doc.addPage(); y = 14 }
  y += 4
  const g = globalCounts(data)
  ;[
    ['Total — PEDIU PRA SAIR', g.pediu],
    ['Total — FUROU',           g.furou],
    ['Total de Registros',      g.total],
  ].forEach(([label, val]) => {
    if (y > pageH - 20) { doc.addPage(); y = 14 }
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(40, 40, 40)
    doc.text(label, 14, y + 4)
    doc.setFont('helvetica', 'bold')
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
  const red      = [200, 30,  30 ]

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
          hookData.cell.styles.textColor = st === 'ausencia' ? red : black
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
      ['Total — PEDIU PRA SAIR', g.pediu],
      ['Total — FUROU',           g.furou],
      ['Total de Registros',      g.total],
    ],
    margin: { left: 14, right: 14 },
    styles: { fontSize: 9, cellPadding: 3.5, textColor: black },
    headStyles: { fillColor: navyDark, textColor: white, fontStyle: 'bold', fontSize: 9 },
    alternateRowStyles: { fillColor: beige },
    columnStyles: {
      0: { fontStyle: 'normal' },
      1: { halign: 'right', fontStyle: 'bold', cellWidth: 20 },
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
  const red    = [220, 50,  50 ]
  const blue   = [74,  144, 217]

  function getOcorrenciaColor(status) {
    if (status === 'aviso')                            return orange
    if (status === 'ausencia')                         return red
    if (status === 'tirei' || status === 'bloqueado')  return orange
    return gray
  }

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
          if (st) hookData.cell.styles.textColor = getOcorrenciaColor(st)
        }
      },
    })

    y = doc.lastAutoTable.finalY + 6
  })

  // Resumo
  if (y > pageH - 55) { doc.addPage(); y = 14 }
  autoTable(doc, {
    startY: y,
    head: [['RESUMO GERAL', '']],
    body: [
      ['Total — PEDIU PRA SAIR',   globalCounts(data).pediu],
      ['Total — FUROU',             globalCounts(data).furou],
      ['Total — FALTOU SEM AVISO',  0],
      ['Total — ATESTADO',          0],
      ['Total de Registros',        globalCounts(data).total],
    ],
    margin: { left: 14, right: 14 },
    styles: { fontSize: 8.5, cellPadding: 3.5, textColor: white, fillColor: bgMain },
    headStyles: { fillColor: bgHead, textColor: white, fontStyle: 'bold', fontSize: 9 },
    alternateRowStyles: { fillColor: bgAlt },
    columnStyles: {
      0: { fontStyle: 'normal' },
      1: { halign: 'right', fontStyle: 'bold', cellWidth: 20, textColor: orange },
    },
  })

  // Legenda
  const legY = doc.lastAutoTable.finalY + 8
  if (legY < pageH - 14) {
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