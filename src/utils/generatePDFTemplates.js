/**
 * generatePDFTemplates.js
 * Três layouts alternativos de exportação PDF para o NEXUS,
 * baseados nos templates Excel da Scorpions Delivery.
 *
 * Dependências já presentes no projeto: jspdf, jspdf-autotable
 * Importar junto com o generatePDF original:
 *   import { generatePDFTemplate1, generatePDFTemplate2, generatePDFTemplate3 } from './generatePDFTemplates'
 */

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { SHIFT_LABELS, SHIFTS, formatDatePT } from './storage'

// ── Mapa de rótulos de status (idêntico ao original) ─────────────────────────
function statusLabel(status, substitutoPor) {
  switch (status) {
    case 'ausencia':            return 'FUROU'
    case 'aviso':               return 'PEDIU PRA SAIR'
    case 'substituido':         return substitutoPor ? `SUBSTITUÍDO: ${substitutoPor}` : 'SUBSTITUÍDO'
    case 'bloqueado':           return 'BLOQUEADO'
    case 'ausencia_em_sistema': return 'AUS. COMUNICADA (EM SISTEMA)'
    case 'nao_com_em_sistema':  return 'AUS. NÃO COMUNICADA (EM SISTEMA)'
    case 'tirei':               return 'TIRAMOS'
    default:                    return status?.toUpperCase() || '—'
  }
}

// ── Contagens por turno ───────────────────────────────────────────────────────
function countStatus(rows) {
  return {
    total:    rows.filter(r => r.name?.trim()).length,
    pediu:    rows.filter(r => r.status === 'aviso').length,
    furou:    rows.filter(r => r.status === 'ausencia').length,
    tirou:    rows.filter(r => r.status === 'tirei' || r.status === 'bloqueado').length,
    outros:   rows.filter(r => !['aviso','ausencia','tirei','bloqueado'].includes(r.status)).length,
  }
}

function globalCounts(data) {
  let pediu = 0, furou = 0, tirou = 0, total = 0
  SHIFTS.forEach(s => {
    const rows = data[s] || []
    rows.forEach(r => {
      if (!r.name?.trim()) return
      total++
      if (r.status === 'aviso')   pediu++
      if (r.status === 'ausencia') furou++
      if (r.status === 'tirei' || r.status === 'bloqueado') tirou++
    })
  })
  return { total, pediu, furou, tirou }
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE 1 — Layout simples por seção (inspirado no template_1 aba principal)
// Seções "SAIU OU FURARAM [TURNO]" com STATUS e OBSERVAÇÕES
// Responsável e rodapé institucional
// ─────────────────────────────────────────────────────────────────────────────
export function generatePDFTemplate1({ data, dateKey, responsible }) {
  const doc   = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const emitDate = formatDatePT(dateKey)
  const now = new Date()

  const C = {
    black:  [18,  18,  20 ],
    white:  [255, 255, 255],
    gray:   [110, 110, 120],
    lgray:  [230, 230, 235],
    orange: [249, 115, 22 ],
    red:    [220, 38,  38 ],
    yellow: [161, 128, 0  ],
    purple: [139, 92,  246],
  }

  // Cabeçalho
  doc.setFillColor(...C.black)
  doc.rect(0, 0, pageW, 28, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(...C.orange)
  doc.text('RELATÓRIO DE CONTROLE DE TURNOS', 14, 13)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(160, 160, 170)
  doc.text('Relatório Confidencial — Uso Interno', 14, 20)
  doc.text(`Data de Referência: ${emitDate}`, pageW - 14, 13, { align: 'right' })
  doc.text(`Responsável: ${responsible || 'Não informado'}`, pageW - 14, 20, { align: 'right' })

  // Linha laranja
  doc.setFillColor(...C.orange)
  doc.rect(0, 28, pageW, 1.5, 'F')

  let y = 38

  SHIFTS.forEach(shift => {
    const rows = (data[shift] || []).filter(r => r.name?.trim())
    if (!rows.length) return

    // Verificar quebra de página
    if (y > pageH - 40) {
      doc.addPage()
      y = 20
    }

    const shiftLabel = SHIFT_LABELS[shift]?.toUpperCase() || shift.toUpperCase()

    // Cabeçalho da seção
    doc.setFillColor(...C.lgray)
    doc.rect(14, y, pageW - 28, 7, 'F')
    doc.setFillColor(...C.orange)
    doc.rect(14, y, 3, 7, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...C.black)
    doc.text(`SAIU OU FURARAM  —  ${shiftLabel}  —  ${emitDate}`, 20, y + 4.8)

    // Colunas de cabeçalho da seção
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(...C.gray)
    doc.text('STATUS', pageW - 80, y + 4.8)
    doc.text('OBSERVAÇÕES (MOTIVOS)', pageW - 55, y + 4.8)
    y += 10

    rows.forEach((r, i) => {
      if (y > pageH - 25) {
        doc.addPage()
        y = 20
      }

      const bg = i % 2 === 0 ? [252, 252, 254] : [244, 244, 248]
      doc.setFillColor(...bg)
      doc.rect(14, y - 1, pageW - 28, 7.5, 'F')

      // Nome
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(...C.black)
      doc.text(`NOME: ${r.name}`, 18, y + 4)

      // Status com cor
      const label = statusLabel(r.status, r.substitutoPor)
      let sColor = C.gray
      if (r.status === 'aviso')   sColor = C.yellow
      if (r.status === 'ausencia') sColor = C.red
      if (r.status === 'substituido') sColor = C.purple
      if (r.status === 'tirei' || r.status === 'bloqueado') sColor = C.orange

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7.5)
      doc.setTextColor(...sColor)
      doc.text(label, pageW - 80, y + 4)

      // Observação
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.setTextColor(...C.gray)
      const obs = r.obs || '—'
      doc.text(obs.substring(0, 38), pageW - 55, y + 4)

      y += 8
    })

    y += 4 // espaço entre seções
  })

  // Resumo global
  if (y > pageH - 55) { doc.addPage(); y = 20 }
  y += 4

  const g = globalCounts(data)

  doc.setFillColor(...C.black)
  doc.rect(14, y, pageW - 28, 7, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...C.white)
  doc.text('RESUMO GERAL', 18, y + 4.8)
  y += 10

  const resumo = [
    [`Total — PEDIU PRA SAIR`, g.pediu],
    [`Total — FUROU`,           g.furou],
    [`Total — TIRAMOS / BLOQUEADO`, g.tirou],
    [`Total de Registros`,      g.total],
  ]

  resumo.forEach(([label, val], i) => {
    const isBold = i === resumo.length - 1
    doc.setFillColor(i % 2 === 0 ? 242 : 248, i % 2 === 0 ? 242 : 248, i % 2 === 0 ? 246 : 252)
    doc.rect(14, y - 1, pageW - 28, 7, 'F')
    doc.setFont('helvetica', isBold ? 'bold' : 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(...C.black)
    doc.text(label, 18, y + 4)
    doc.setFont('helvetica', 'bold')
    if (isBold) doc.setTextColor(...C.orange); else doc.setTextColor(...C.black)
    doc.text(String(val), pageW - 18, y + 4, { align: 'right' })
    y += 8
  })

  // Assinatura
  y += 10
  if (y < pageH - 30) {
    doc.setDrawColor(...C.gray)
    doc.line(pageW - 85, y, pageW - 14, y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...C.gray)
    doc.text(`Responsável: ${responsible || '__________________________'}`, pageW - 50, y + 5, { align: 'center' })
    doc.text('Relatório Confidencial — Uso Interno', 14, y + 5)
  }

  // Rodapé em todas as páginas
  _addFooter(doc, pageH, pageW, now, responsible)

  doc.save(`NEXUS_Relatorio_Turnos_${dateKey}.pdf`)
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE 2 — Tabela formal (inspirado no Modelo 2 com colunas Nº/Nome/Status/Turno/Observação)
// Uma tabela única com todos os registros, coluna TURNO explícita, resumo no final
// ─────────────────────────────────────────────────────────────────────────────
export function generatePDFTemplate2({ data, dateKey, responsible }) {
  const doc   = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const emitDate = formatDatePT(dateKey)
  const now = new Date()

  const C = {
    black:  [18,  18,  20 ],
    white:  [255, 255, 255],
    gray:   [110, 110, 120],
    lgray:  [240, 240, 244],
    orange: [249, 115, 22 ],
  }

  // Header institucional
  doc.setFillColor(...C.black)
  doc.rect(0, 0, pageW, 32, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(...C.orange)
  doc.text('RELATÓRIO DE CONTROLE DE TURNOS', 14, 12)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(160, 160, 170)
  doc.text('Relatório Confidencial — Uso Interno', 14, 19)
  doc.text(`Data de Referência: ${emitDate}`, 14, 26)
  doc.text(`Responsável: ${responsible || 'Não informado'}`, pageW - 14, 19, { align: 'right' })
  doc.setFillColor(...C.orange)
  doc.rect(0, 32, pageW, 1.5, 'F')

  // Monta todas as linhas numa tabela única com coluna TURNO
  const allRows = []
  let counter = 1
  SHIFTS.forEach(shift => {
    const shiftLabel = SHIFT_LABELS[shift]?.toUpperCase() || shift.toUpperCase()
    ;(data[shift] || []).filter(r => r.name?.trim()).forEach(r => {
      allRows.push({
        num: String(counter++).padStart(2, '0'),
        name: r.name,
        status: statusLabel(r.status, r.substitutoPor),
        rawStatus: r.status,
        shift: shiftLabel,
        obs: r.obs || '—',
      })
    })
  })

  autoTable(doc, {
    startY: 40,
    head: [['Nº', 'Nome do Funcionário', 'Status', 'Turno', 'Observação']],
    body: allRows.map(r => [r.num, r.name, r.status, r.shift, r.obs]),
    margin: { left: 14, right: 14 },
    styles: {
      fontSize: 8,
      cellPadding: 3.5,
      textColor: C.black,
      font: 'helvetica',
    },
    headStyles: {
      fillColor: C.black,
      textColor: C.white,
      fontStyle: 'bold',
      fontSize: 8,
    },
    alternateRowStyles: { fillColor: [248, 248, 252] },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      2: { cellWidth: 50 },
      3: { cellWidth: 22, halign: 'center', fontStyle: 'bold' },
    },
    didParseCell(hookData) {
      if (hookData.section === 'body' && hookData.column.index === 2) {
        const row = allRows[hookData.row.index]
        if (!row) return
        switch (row.rawStatus) {
          case 'aviso':    hookData.cell.styles.textColor = [130, 100, 0];   break
          case 'ausencia': hookData.cell.styles.textColor = [200, 30,  30];  break
          case 'substituido': hookData.cell.styles.textColor = [120, 60, 200]; break
          case 'bloqueado':   hookData.cell.styles.textColor = [200, 80, 10];  break
          case 'tirei':       hookData.cell.styles.textColor = [200, 80, 10];  break
          default:            hookData.cell.styles.textColor = [100, 100, 110]
        }
      }
      // Linha de agrupamento por turno — fundo diferenciado
      if (hookData.section === 'body' && hookData.column.index === 3) {
        hookData.cell.styles.fontStyle = 'bold'
        hookData.cell.styles.textColor = C.orange
      }
    },
  })

  // Resumo
  const finalY = doc.lastAutoTable.finalY + 8
  let ry = finalY
  if (ry > pageH - 50) { doc.addPage(); ry = 20 }

  const g = globalCounts(data)

  doc.setFillColor(...C.black)
  doc.rect(14, ry, pageW - 28, 7, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...C.white)
  doc.text('RESUMO GERAL', 18, ry + 4.8)
  ry += 9

  const resumo = [
    ['Total — PEDIU PRA SAIR', g.pediu],
    ['Total — FUROU',           g.furou],
    ['Total — TIRAMOS / BLOQUEADO', g.tirou],
    ['Total de Registros',      g.total],
  ]

  resumo.forEach(([label, val], i) => {
    doc.setFillColor(i % 2 === 0 ? 242 : 248, i % 2 === 0 ? 242 : 248, i % 2 === 0 ? 246 : 252)
    doc.rect(14, ry - 1, pageW - 28, 7, 'F')
    doc.setFont('helvetica', i === resumo.length - 1 ? 'bold' : 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(...C.black)
    doc.text(label, 18, ry + 4)
    doc.setFont('helvetica', 'bold')
    if (i === resumo.length - 1) doc.setTextColor(...C.orange); else doc.setTextColor(...C.black)
    doc.text(String(val), pageW - 18, ry + 4, { align: 'right' })
    ry += 8
  })

  _addFooter(doc, pageH, pageW, now, responsible)
  doc.save(`NEXUS_Modelo2_Turnos_${dateKey}.pdf`)
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE 3 — Layout com separadores "·" e numeração por turno
// (inspirado na aba "Turnos 14·03" do template_1)
// Cada turno tem numeração própria, legenda de ocorrências no rodapé
// ─────────────────────────────────────────────────────────────────────────────
export function generatePDFTemplate3({ data, dateKey, responsible }) {
  const doc   = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const emitDate = formatDatePT(dateKey)
  const now = new Date()

  const C = {
    black:  [18,  18,  20 ],
    white:  [255, 255, 255],
    gray:   [110, 110, 120],
    lgray:  [236, 236, 240],
    orange: [249, 115, 22 ],
    red:    [220, 38,  38 ],
    yellow: [161, 128, 0  ],
    green:  [22,  163, 74 ],
    purple: [139, 92,  246],
    blue:   [59,  130, 246],
  }

  // Header minimalista com separadores ·
  doc.setFillColor(...C.black)
  doc.rect(0, 0, pageW, 24, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(...C.white)
  doc.text(`RELATÓRIO DE CONTROLE DE TURNOS  ·  ${emitDate}`, 14, 11)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(160, 160, 170)
  doc.text(`Responsável: ${responsible || 'SEU NOME'}  ·  Relatório Confidencial — Uso Interno`, 14, 19)
  doc.setFillColor(...C.orange)
  doc.rect(0, 24, pageW, 1, 'F')

  let y = 32

  SHIFTS.forEach(shift => {
    const rows = (data[shift] || []).filter(r => r.name?.trim())
    if (!rows.length) return

    if (y > pageH - 45) { doc.addPage(); y = 20 }

    const shiftLabel = SHIFT_LABELS[shift]?.toUpperCase() || shift.toUpperCase()
    const counts = countStatus(rows)

    // Cabeçalho do turno com ·
    doc.setFillColor(...C.lgray)
    doc.rect(14, y, pageW - 28, 8, 'F')
    doc.setFillColor(...C.orange)
    doc.rect(14, y, 2.5, 8, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...C.black)
    doc.text(`SAIU OU FURARAM  ·  ${shiftLabel}`, 20, y + 5.3)

    // Mini-stats à direita
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...C.gray)
    doc.text(`${counts.total} reg  ·  ${counts.pediu} pediu  ·  ${counts.furou} furou`, pageW - 18, y + 5.3, { align: 'right' })
    y += 10

    // Linhas com numeração por turno (reinicia a cada seção)
    const tableRows = rows.map((r, i) => {
      const label = statusLabel(r.status, r.substitutoPor)
      return [String(i + 1), r.name, label, r.obs || '—']
    })

    autoTable(doc, {
      startY: y,
      head: [['#', 'Entregador', 'Ocorrência', 'Observação']],
      body: tableRows,
      margin: { left: 14, right: 14 },
      styles: {
        fontSize: 8,
        cellPadding: 3,
        textColor: C.black,
      },
      headStyles: {
        fillColor: [30, 30, 36],
        textColor: C.white,
        fontStyle: 'bold',
        fontSize: 7.5,
      },
      alternateRowStyles: { fillColor: [250, 250, 253] },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center', textColor: C.gray },
        2: { cellWidth: 55 },
      },
      didParseCell(hookData) {
        if (hookData.section === 'body' && hookData.column.index === 2) {
          const row = rows[hookData.row.index]
          if (!row) return
          switch (row.status) {
            case 'aviso':               hookData.cell.styles.textColor = C.yellow;  break
            case 'ausencia':            hookData.cell.styles.textColor = C.red;     break
            case 'substituido':         hookData.cell.styles.textColor = C.purple;  break
            case 'bloqueado':           hookData.cell.styles.textColor = C.orange;  break
            case 'tirei':               hookData.cell.styles.textColor = C.orange;  break
            case 'ausencia_em_sistema': hookData.cell.styles.textColor = C.green;   break
            case 'nao_com_em_sistema':  hookData.cell.styles.textColor = C.blue;    break
            default:                    hookData.cell.styles.textColor = C.gray
          }
        }
      },
    })

    y = doc.lastAutoTable.finalY + 8
  })

  // Resumo geral
  if (y > pageH - 50) { doc.addPage(); y = 20 }

  const g = globalCounts(data)
  const resumo = [
    ['Total — PEDIU PRA SAIR',        g.pediu ],
    ['Total — FUROU',                  g.furou ],
    ['Total — TIRAMOS / BLOQUEADO',    g.tirou ],
    ['Total de Registros',             g.total ],
  ]

  autoTable(doc, {
    startY: y,
    head: [['RESUMO GERAL', '']],
    body: resumo,
    margin: { left: 14, right: 14 },
    styles: { fontSize: 8.5, cellPadding: 3.5 },
    headStyles: { fillColor: C.black, textColor: C.white, fontStyle: 'bold', fontSize: 9 },
    alternateRowStyles: { fillColor: [248, 248, 252] },
    columnStyles: {
      0: { fontStyle: 'normal' },
      1: { halign: 'right', fontStyle: 'bold', cellWidth: 20 },
    },
  })

  // Legenda de ocorrências (estilo da aba Turnos 14·03)
  const legY = doc.lastAutoTable.finalY + 10
  if (legY < pageH - 20) {
    doc.setPage(doc.internal.getNumberOfPages())
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...C.gray)
    doc.text(
      'OCORRÊNCIAS →  Pediu pra sair  |  Furou  |  Tiramos  |  Bloqueado  |  Aus. em sistema  |  Coluna OBSERVAÇÃO livre para edição',
      14, legY
    )
    // Bolinhas coloridas de legenda
    const legendItems = [
      { color: C.yellow, x: 36 },
      { color: C.red,    x: 73 },
      { color: C.orange, x: 88 },
      { color: C.orange, x: 100 },
      { color: C.green,  x: 115 },
    ]
    legendItems.forEach(({ color, x }) => {
      doc.setFillColor(...color)
      doc.circle(x, legY - 1.5, 1, 'F')
    })
  }

  _addFooter(doc, pageH, pageW, now, responsible)
  doc.save(`NEXUS_Modelo3_Turnos_${dateKey}.pdf`)
}

// ── Rodapé comum ──────────────────────────────────────────────────────────────
function _addFooter(doc, pageH, pageW, now, responsible) {
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