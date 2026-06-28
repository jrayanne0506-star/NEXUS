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
      if (r.status === 'aviso')   pediu++
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
// TEMPLATE 1
// Cabeçalho laranja com título branco centralizado
// Linhas de seção: fundo cinza escuro (#505050), texto branco, colunas STATUS e OBSERVAÇÕES (MOTIVOS)
// Linhas de dados: fundo preto (#1a1a1a), NOME: em branco, STATUS colorido, OBS branco
// Sem coluna de número, sem coluna de turno
// ─────────────────────────────────────────────────────────────────────────────
export function generatePDFTemplate1({ data, dateKey, responsible }) {
  const doc   = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const emitDate = formatDatePT(dateKey)
  const now = new Date()

  const orange  = [210, 105, 30]   // laranja do Excel (mais escuro/queimado)
  const darkBg  = [26,  26,  26]   // fundo das linhas de dados #1a1a1a
  const secBg   = [80,  80,  80]   // fundo cabeçalho de seção #505050
  const white   = [255, 255, 255]
  const green   = [0,   180, 0  ]  // PEDIU PRA SAIR
  const yellow  = [200, 180, 0  ]  // TIRAMOS
  const red     = [220, 50,  50 ]  // FUROU
  const gray    = [180, 180, 180]

  function getStatusColor(status) {
    if (status === 'aviso')   return green
    if (status === 'tirei' || status === 'bloqueado') return yellow
    if (status === 'ausencia') return red
    return gray
  }

  // ── Cabeçalho laranja ──
  doc.setFillColor(...orange)
  doc.rect(0, 0, pageW, 40, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(...white)
  doc.text('RELATÓRIO DE CONTROLE DE TURNOS', pageW / 2, 12, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...white)
  doc.text(`Data de Referência:`, pageW / 2, 22, { align: 'center' })
  doc.setFont('helvetica', 'bold')
  doc.text(emitDate, pageW / 2, 29, { align: 'center' })

  if (responsible) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.text(`Responsável: ${responsible}`, pageW / 2, 36, { align: 'center' })
  }

  let y = 46

  SHIFTS.forEach(shift => {
    const rows = (data[shift] || []).filter(r => r.name?.trim())
    if (!rows.length) return

    if (y > pageH - 40) { doc.addPage(); y = 14 }

    const shiftLabel = SHIFT_LABELS[shift]?.toUpperCase() || shift.toUpperCase()
    const colW1 = pageW - 28        // nome
    const colW2 = 40                // status
    const colW3 = 55                // obs
    const totalW = pageW - 28
    const nameW  = totalW - colW2 - colW3

    // Linha de seção — fundo cinza escuro
    doc.setFillColor(...secBg)
    doc.rect(14, y, totalW, 8, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(...white)
    doc.text(`SAIU OU FURARAM ${shiftLabel} ${emitDate}`, 17, y + 5.3)
    doc.text('STATUS', 14 + nameW + 4, y + 5.3)
    doc.text('OBSERVAÇÕES (MOTIVOS)', 14 + nameW + colW2 + 4, y + 5.3)
    y += 8

    rows.forEach(r => {
      if (y > pageH - 20) { doc.addPage(); y = 14 }

      // Fundo preto para linha de dados
      doc.setFillColor(...darkBg)
      doc.rect(14, y, totalW, 8, 'F')

      // NOME:
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(...white)
      const nameText = `NOME: ${r.name.toUpperCase()}`
      doc.text(nameText, 17, y + 5.3)

      // STATUS colorido
      const sc = getStatusColor(r.status)
      doc.setTextColor(...sc)
      doc.text(statusLabel(r.status, r.substitutoPor), 14 + nameW + 4, y + 5.3)

      // OBS
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...white)
      const obs = (r.obs || '').toUpperCase().substring(0, 30)
      doc.text(obs, 14 + nameW + colW2 + 4, y + 5.3)

      y += 8
    })

    y += 4 // espaço entre seções
  })

  // ── Resumo ──
  if (y > pageH - 45) { doc.addPage(); y = 14 }
  y += 4

  const g = globalCounts(data)
  const resumo = [
    ['Total — PEDIU PRA SAIR', g.pediu ],
    ['Total — FUROU',           g.furou ],
    ['Total de Registros',      g.total ],
  ]

  resumo.forEach(([label, val]) => {
    if (y > pageH - 20) { doc.addPage(); y = 14 }
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(40, 40, 40)
    doc.text(label, 14, y + 4)
    doc.setFont('helvetica', 'bold')
    doc.text(String(val), pageW - 14, y + 4, { align: 'right' })
    y += 8
  })

  // Rodapé de assinatura
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
// TEMPLATE 2
// Cabeçalho azul escuro (#1a3a6b) com título branco centralizado
// Linha "Data de Referência" e "Responsável" em branco centralizado
// Cabeçalho de colunas: azul médio (#2d5aa0), texto branco
// Linhas de seção: azul escuro (#1a3a6b), texto branco
// Linhas alternadas: bege claro (#fdf5e6) / branco
// STATUS em negrito sem cor exceto FUROU=vermelho
// Colunas: Nº | Nome do Funcionário | Status | Turno | Observação
// ─────────────────────────────────────────────────────────────────────────────
export function generatePDFTemplate2({ data, dateKey, responsible }) {
  const doc   = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const emitDate = formatDatePT(dateKey)
  const now = new Date()

  const navyDark  = [26,  58,  107]  // #1a3a6b cabeçalho e seções
  const navyMid   = [45,  90,  160]  // #2d5aa0 cabeçalho de colunas
  const white     = [255, 255, 255]
  const beige     = [253, 245, 230]  // #fdf5e6 linha alternada
  const black     = [20,  20,  20 ]
  const red       = [200, 30,  30 ]  // FUROU

  // ── Cabeçalho azul escuro ──
  doc.setFillColor(...navyDark)
  doc.rect(0, 0, pageW, 46, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.setTextColor(...white)
  doc.text('RELATÓRIO DE CONTROLE DE TURNOS', pageW / 2, 12, { align: 'center' })

  doc.setFont('helvetica', 'italic')
  doc.setFontSize(8.5)
  doc.setTextColor(200, 210, 230)
  doc.text('Relatório Confidencial — Uso Interno', pageW / 2, 20, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...white)
  doc.text(`Data de Referência: ${emitDate}`, pageW / 2, 29, { align: 'center' })
  doc.text(`Responsável: ${responsible || 'Não informado'}`, pageW / 2, 37, { align: 'center' })

  // ── Monta body com linhas de seção ──
  const tableBody   = []
  const sectionRows = new Set()
  const rowStatusArr = []
  let counter = 1

  SHIFTS.forEach(shift => {
    const rows = (data[shift] || []).filter(r => r.name?.trim())
    if (!rows.length) return
    const shiftLabel = SHIFT_LABELS[shift]?.toUpperCase() || shift.toUpperCase()

    sectionRows.add(tableBody.length)
    tableBody.push([`SAIU OU FURARAM ${shiftLabel}`, '', '', '', ''])

    rows.forEach(r => {
      tableBody.push([
        String(counter++),
        r.name,
        statusLabel(r.status, r.substitutoPor),
        shiftLabel,
        r.obs || '',
      ])
      rowStatusArr.push(r.status)
    })
  })

  let dataRowIdx = 0

  autoTable(doc, {
    startY: 50,
    head: [['Nº', 'Nome do Funcionário', 'Status', 'Turno', 'Observação']],
    body: tableBody,
    margin: { left: 14, right: 14 },
    styles: { fontSize: 8.5, cellPadding: 3.5, textColor: black, font: 'helvetica' },
    headStyles: {
      fillColor: navyMid,
      textColor: white,
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'center',
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      2: { cellWidth: 45, fontStyle: 'bold' },
      3: { cellWidth: 22, halign: 'center' },
    },
    didParseCell(hookData) {
      const i = hookData.row.index

      if (sectionRows.has(i)) {
        // Linha de seção: azul escuro, texto branco negrito
        hookData.cell.styles.fillColor  = navyDark
        hookData.cell.styles.textColor  = white
        hookData.cell.styles.fontStyle  = 'bold'
        hookData.cell.styles.fontSize   = 9
        if (hookData.column.index > 0) hookData.cell.styles.textColor = navyDark
        return
      }

      // Linha normal: alternado bege/branco
      let dataIdx = 0
      for (let k = 0; k < i; k++) { if (!sectionRows.has(k)) dataIdx++ }
      const isEven = dataIdx % 2 === 0
      hookData.cell.styles.fillColor = isEven ? beige : white

      // Status: negrito, FUROU=vermelho resto=preto
      if (hookData.column.index === 2) {
        const st = rowStatusArr[dataIdx]
        hookData.cell.styles.fontStyle = 'bold'
        hookData.cell.styles.textColor = (st === 'ausencia') ? red : black
      }
    },
  })

  // ── Resumo ──
  let ry = doc.lastAutoTable.finalY + 8
  if (ry > pageH - 45) { doc.addPage(); ry = 14 }

  const g = globalCounts(data)
  autoTable(doc, {
    startY: ry,
    head: [['RESUMO GERAL', '']],
    body: [
      ['Total — PEDIU PRA SAIR', g.pediu ],
      ['Total — FUROU',           g.furou ],
      ['Total de Registros',      g.total ],
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
// TEMPLATE 3
// Fundo geral preto/cinza muito escuro (#16213e / #0f0f23)
// Cabeçalho: fundo preto, título branco + data, subtítulo cinza italic
// Cabeçalho de colunas: fundo preto, texto branco
// Linhas de seção: fundo #1a1a2e, borda esquerda azul (#4a90d9), texto branco
// Linhas de dados: fundo #16213e alternado com #0f3460, número cinza pequeno
// TURNO em laranja, OCORRÊNCIA: PEDIU=laranja, FUROU=vermelho
// Colunas: # | ENTREGADOR | TURNO | OCORRÊNCIA | OBSERVAÇÃO
// ─────────────────────────────────────────────────────────────────────────────
export function generatePDFTemplate3({ data, dateKey, responsible }) {
  const doc   = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const emitDate = formatDatePT(dateKey)
  const now = new Date()
  const dia = diaSemana(dateKey)

  const bgMain  = [22,  33,  62 ]   // #16213e fundo principal
  const bgSec   = [26,  26,  46 ]   // #1a1a2e seção
  const bgAlt   = [15,  52,  96 ]   // #0f3460 linha alternada
  const bgHead  = [10,  10,  20 ]   // cabeçalho
  const white   = [255, 255, 255]
  const gray    = [140, 150, 170]
  const orange  = [249, 115, 22 ]
  const red     = [220, 50,  50 ]
  const blue    = [74,  144, 217]   // borda seção

  function getOcorrenciaColor(status) {
    if (status === 'aviso')   return orange
    if (status === 'ausencia') return red
    if (status === 'tirei' || status === 'bloqueado') return orange
    return gray
  }

  // ── Cabeçalho preto ──
  doc.setFillColor(...bgHead)
  doc.rect(0, 0, pageW, 28, 'F')
  // Linha laranja embaixo do header
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

  // ── Monta body ──
  const tableBody    = []
  const sectionRows  = new Set()
  const rowStatusArr = []

  SHIFTS.forEach(shift => {
    const rows = (data[shift] || []).filter(r => r.name?.trim())
    if (!rows.length) return
    const shiftLabel = SHIFT_LABELS[shift]?.toUpperCase() || shift.toUpperCase()

    sectionRows.add(tableBody.length)
    tableBody.push([
      `SAIU OU FURARAM  ·  ${shiftLabel}  ·  ${dia} ${emitDate}`,
      '', '', '', '',
    ])

    rows.forEach((r, i) => {
      tableBody.push([
        String(i + 1),           // reinicia por turno
        r.name.toUpperCase(),
        shiftLabel,
        statusLabel(r.status, r.substitutoPor),
        r.obs || '',
      ])
      rowStatusArr.push(r.status)
    })
  })

  autoTable(doc, {
    startY: 33,
    head: [['#', 'ENTREGADOR', 'TURNO', 'OCORRÊNCIA', 'OBSERVAÇÃO']],
    body: tableBody,
    margin: { left: 14, right: 14 },
    styles: {
      fontSize: 8,
      cellPadding: 3,
      textColor: white,
      font: 'helvetica',
      fillColor: bgMain,
    },
    headStyles: {
      fillColor: bgHead,
      textColor: white,
      fontStyle: 'bold',
      fontSize: 8,
    },
    columnStyles: {
      0: { cellWidth: 9,  halign: 'center', textColor: gray, fontSize: 7 },
      2: { cellWidth: 22, halign: 'center', textColor: orange, fontStyle: 'bold' },
      3: { cellWidth: 52 },
    },
    didParseCell(hookData) {
      const i = hookData.row.index

      if (sectionRows.has(i)) {
        hookData.cell.styles.fillColor = bgSec
        hookData.cell.styles.fontStyle = 'bold'
        hookData.cell.styles.fontSize  = 8.5
        if (hookData.column.index === 0) {
          hookData.cell.styles.textColor = white
        } else {
          // invisível nas outras colunas
          hookData.cell.styles.textColor = bgSec
        }
        return
      }

      // Linhas alternadas
      let dataIdx = 0
      for (let k = 0; k < i; k++) { if (!sectionRows.has(k)) dataIdx++ }
      hookData.cell.styles.fillColor = dataIdx % 2 === 0 ? bgMain : bgAlt

      // OCORRÊNCIA colorida
      if (hookData.column.index === 3) {
        const st = rowStatusArr[dataIdx]
        if (st) hookData.cell.styles.textColor = getOcorrenciaColor(st)
      }
    },
    didDrawCell(hookData) {
      // Borda esquerda azul nas linhas de seção
      if (sectionRows.has(hookData.row.index) && hookData.column.index === 0) {
        const { x, y, height } = hookData.cell
        doc.setFillColor(...blue)
        doc.rect(x, y, 2.5, height, 'F')
      }
    },
  })

  // ── Resumo ──
  let ry = doc.lastAutoTable.finalY + 8
  if (ry > pageH - 55) { doc.addPage(); ry = 14 }

  const g = globalCounts(data)
  autoTable(doc, {
    startY: ry,
    head: [['RESUMO GERAL', '']],
    body: [
      ['Total — PEDIU PRA SAIR',     g.pediu ],
      ['Total — FUROU',               g.furou ],
      ['Total — FALTOU SEM AVISO',    0       ],
      ['Total — ATESTADO',            0       ],
      ['Total de Registros',          g.total ],
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

  // ── Legenda ──
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