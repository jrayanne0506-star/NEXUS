import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { SHIFT_LABELS, SHIFTS, formatDatePT } from './storage'
import { registerFonts } from './registerFonts'
import { carregarTagsExtras, hexToRgb } from './tagsExtras'

// status → label, para os status FIXOS do sistema (tags extras são
// resolvidas dinamicamente via tagsExtras — ver statusLabel abaixo)
const FIXED_LABELS = {
  ausencia:            'Ausência Não Comunicada',
  aviso:               'Ausência Comunicada',
  bloqueado:           'Bloqueado',
  tirei:               'Tiramos',
  ausencia_em_sistema: 'Aus. Comunicada — em sistema',
  nao_com_em_sistema:  'Aus. Não Comunicada — em sistema',
}

function statusLabel(status, substitutoPor, tagsExtras) {
  if (status === 'substituido') {
    return substitutoPor ? `Substituído por: ${substitutoPor}` : 'Substituído'
  }
  if (FIXED_LABELS[status]) return FIXED_LABELS[status]

  // Tag personalizada criada pelo usuário (+ NOVA TAG) — busca o label salvo
  const extra = tagsExtras?.find(t => t.value === status)
  if (extra) return extra.label

  return status ? status.toUpperCase() : '—'
}

// ─────────────────────────────────────────────────────────────────────────────
// PALETA DE CORES — status fixos mantêm a cor histórica do PDF; status
// personalizados (tags extras) usam a cor escolhida pelo usuário no modal
// "+ NOVA TAG", convertida de hex para RGB.
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

function statusColorFor(status, tagsExtras) {
  if (STATUS_COLORS[status]) return STATUS_COLORS[status]
  const extra = tagsExtras?.find(t => t.value === status)
  if (extra) return hexToRgb(extra.color)
  return [180, 180, 180]
}

function diaSemana(dateKey) {
  const dias = ['DOMINGO','SEGUNDA','TERÇA','QUARTA','QUINTA','SEXTA','SÁBADO']
  const [y, m, d] = dateKey.split('-').map(Number)
  return dias[new Date(y, m - 1, d).getDay()]
}

// Conta TODOS os status encontrados nos dados — fixos ou personalizados —
// não apenas os 6-7 fixos hardcoded. Isso garante que qualquer tag criada
// pelo usuário via "+ NOVA TAG" seja contabilizada no resumo do PDF.
function globalCounts(data) {
  const porStatus = {} // status → quantidade
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

// Monta as linhas do bloco "Resumo Geral": primeiro os status fixos na ordem
// histórica do PDF, depois — dinamicamente — qualquer tag personalizada que
// tenha aparecido nos dados, na cor definida pelo usuário para essa tag.
function buildSummaryRows(porStatus, tagsExtras) {
  const ORDEM_FIXA = [
    ['aviso',               'Total — Ausência Comunicada'],
    ['ausencia',             'Total — Ausência Não Comunicada'],
    ['substituido',          'Total — SUBSTITUÍDOS'],
    ['bloqueado',            'Total — BLOQUEADOS'],
    ['ausencia_em_sistema',  'Total — AUS. COMUNICADA (EM SISTEMA)'],
    ['nao_com_em_sistema',   'Total — AUS. NÃO COMUNICADA (EM SISTEMA)'],
  ]

  const rows = ORDEM_FIXA.map(([status, label]) => [
    label,
    porStatus[status] || 0,
    STATUS_COLORS[status],
  ])

  // Status extras/personalizados presentes nos dados (inclui 'tirei' e
  // qualquer tag criada via "+ NOVA TAG")
  const statusConhecidos = new Set(ORDEM_FIXA.map(([status]) => status))
  Object.keys(porStatus)
    .filter(status => !statusConhecidos.has(status))
    .forEach(status => {
      const extra = tagsExtras.find(t => t.value === status)
      const label = extra ? extra.label : (status === 'tirei' ? 'Tiramos' : status.toUpperCase())
      const color = extra ? hexToRgb(extra.color) : (STATUS_COLORS[status] || [140, 140, 150])
      rows.push([`Total — ${label.toUpperCase()}`, porStatus[status], color])
    })

  return rows
}

function addFooter(doc, pageH, pageW, now) {
  const total = doc.internal.getNumberOfPages()
  for (let p = 1; p <= total; p++) {
    doc.setPage(p)
    doc.setFont('Roboto', 'normal')
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
// ANEXOS / PRINTS — converte cada arquivo em base64 e desenha em páginas
// extras no final do PDF, em grade de 2 colunas. Sem limite de quantidade;
// só entra em ação se `prints` vier preenchido do ExportModal.
// ─────────────────────────────────────────────────────────────────────────────
function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

async function addAttachmentsPages(doc, prints, pageW, pageH) {
  if (!prints || !prints.length) return

  doc.addPage()
  doc.setFillColor(20, 20, 20)
  doc.rect(0, 0, pageW, 20, 'F')
  doc.setFont('Roboto', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(255, 255, 255)
  doc.text('ANEXOS / PRINTS', pageW / 2, 13, { align: 'center' })

  const margin = 14
  const gap    = 6
  const cols   = 2
  const imgW   = (pageW - margin * 2 - gap * (cols - 1)) / cols
  const imgH   = imgW * 0.65 // proporção aproximada de print de tela

  let x = margin
  let y = 28
  let col = 0

  for (const p of prints) {
    if (y + imgH > pageH - 14) {
      doc.addPage()
      x = margin
      y = 14
      col = 0
    }

    try {
      const dataUrl = await fileToDataURL(p.file)
      const format = p.file.type.includes('png') ? 'PNG' : 'JPEG'
      doc.addImage(dataUrl, format, x, y, imgW, imgH, undefined, 'FAST')
    } catch (err) {
      // se um arquivo falhar ao carregar, pula e segue com os demais
      doc.setDrawColor(120, 120, 120)
      doc.rect(x, y, imgW, imgH)
    }

    doc.setFont('Roboto', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(120, 120, 120)
    doc.text(p.nome || '', x, y + imgH + 4, { maxWidth: imgW })

    col++
    if (col >= cols) {
      col = 0
      x = margin
      y += imgH + 12
    } else {
      x += imgW + gap
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE 1 — Cabeçalho laranja, linhas pretas, STATUS colorido
// ─────────────────────────────────────────────────────────────────────────────
export async function generatePDFTemplate1({ data, dateKey, responsible, prints }) {
  const doc   = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  registerFonts(doc)
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const emitDate = formatDatePT(dateKey)
  const now = new Date()
  const tagsExtras = carregarTagsExtras() // tags personalizadas ("+ NOVA TAG")

  const orange = [210, 105, 30]
  const darkBg = [26,  26,  26]
  const secBg  = [80,  80,  80]
  const white  = [255, 255, 255]

  // Cabeçalho laranja
  doc.setFillColor(...orange)
  doc.rect(0, 0, pageW, 42, 'F')
  doc.setFont('Roboto', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(...white)
  doc.text('RELATÓRIO DE CONTROLE DE TURNOS', pageW / 2, 13, { align: 'center' })
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(9)
  doc.text('Data de Referência:', pageW / 2, 23, { align: 'center' })
  doc.setFont('Roboto', 'bold')
  doc.text(emitDate, pageW / 2, 30, { align: 'center' })
  if (responsible) {
    doc.setFont('Roboto', 'normal')
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
    doc.setFont('Roboto', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...white)
    doc.text(`SAIU OU FURARAM ${shiftLabel} ${emitDate}`, 17, y + 5.3)
    doc.text('STATUS', 14 + nameW + 4, y + 5.3)
    doc.text('OBSERVAÇÕES (MOTIVOS)', 14 + nameW + 46, y + 5.3)
    y += 8

    rows.forEach(r => {
      const statusText  = statusLabel(r.status, r.substitutoPor, tagsExtras)
      const statusMaxW  = 36 // largura útil da coluna STATUS (reduzida de 40 → força quebra mais cedo)
      const statusLines = doc.splitTextToSize(statusText, statusMaxW)

      const obsMaxW  = totalW - nameW - 46 - 3 // largura útil da coluna OBSERVAÇÕES
      const obsLines = doc.splitTextToSize((r.obs || '').toUpperCase(), obsMaxW)

      const neededLines = Math.max(statusLines.length, obsLines.length)
      const rowH = Math.max(9, neededLines * 4.4 + 6) // margem de segurança maior (era 8, neededLines*3.6+4.5)

      if (y > pageH - 20) { doc.addPage(); y = 14 }

      doc.setFillColor(...darkBg)
      doc.rect(14, y, totalW, rowH, 'F')

      doc.setFont('Roboto', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(...white)
      doc.text(`NOME: ${r.name.toUpperCase()}`, 17, y + 5.3)

      doc.setFontSize(6.5)
      doc.setTextColor(...statusColorFor(r.status, tagsExtras))
      doc.text(statusLines, 14 + nameW + 4, y + 4.8)

      doc.setFont('Roboto', 'normal')
      doc.setFontSize(7)
      doc.setTextColor(...white)
      doc.text(obsLines, 14 + nameW + 46, y + 4.8)

      y += rowH
    })
    y += 4
  })

  // Resumo — inclui dinamicamente qualquer tag personalizada usada nos dados
  if (y > pageH - 45) { doc.addPage(); y = 14 }
  y += 4
  const g = globalCounts(data)
  const summaryRows = [...buildSummaryRows(g.porStatus, tagsExtras), ['Total de Registros', g.total, [40, 40, 40]]]
  summaryRows.forEach(([label, val, color]) => {
    if (y > pageH - 20) { doc.addPage(); y = 14 }
    doc.setFont('Roboto', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(40, 40, 40)
    doc.text(label, 14, y + 4)
    doc.setFont('Roboto', 'bold')
    doc.setTextColor(...color)
    doc.text(String(val), pageW - 14, y + 4, { align: 'right' })
    y += 8
  })

  y += 10
  if (y < pageH - 20) {
    doc.setDrawColor(150, 150, 150)
    doc.line(14, y, 100, y)
    doc.setFont('Roboto', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(100, 100, 100)
    doc.text(`RESPONSÁVEL: ${responsible || '__________________________'}`, 14, y + 6)
    doc.text('Relatório Confidencial — Uso Interno', pageW / 2, y + 6, { align: 'center' })
    doc.text('Pág. 1', pageW - 14, y + 6, { align: 'right' })
  }

  await addAttachmentsPages(doc, prints, pageW, pageH)
  addFooter(doc, pageH, pageW, now)
  doc.save(`NEXUS_Relatorio_Turnos_${dateKey}.pdf`)
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE 2 — Cabeçalho azul escuro, tabelas por turno separadas manualmente
// ─────────────────────────────────────────────────────────────────────────────
export async function generatePDFTemplate2({ data, dateKey, responsible, prints }) {
  const doc   = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  registerFonts(doc)
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const emitDate = formatDatePT(dateKey)
  const now = new Date()
  const tagsExtras = carregarTagsExtras() // tags personalizadas ("+ NOVA TAG")

  const navyDark = [26,  58,  107]
  const navyMid  = [45,  90,  160]
  const white    = [255, 255, 255]
  const beige    = [253, 245, 230]
  const black    = [20,  20,  20 ]

  // Cabeçalho azul escuro
  doc.setFillColor(...navyDark)
  doc.rect(0, 0, pageW, 48, 'F')
  doc.setFont('Roboto', 'bold')
  doc.setFontSize(15)
  doc.setTextColor(...white)
  doc.text('RELATÓRIO DE CONTROLE DE TURNOS', pageW / 2, 13, { align: 'center' })
  doc.setFont('Roboto', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(200, 210, 230)
  doc.text('Relatório Confidencial — Uso Interno', pageW / 2, 21, { align: 'center' })
  doc.setFont('Roboto', 'normal')
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
    doc.setFont('Roboto', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...white)
    doc.text(`SAIU OU FURARAM ${shiftLabel}`, 18, y + 5.5)
    y += 8

    const tableRows = rows.map(r => [
      String(globalCounter++),
      r.name,
      statusLabel(r.status, r.substitutoPor, tagsExtras),
      shiftLabel,
      r.obs || '',
    ])
    const statusArr = rows.map(r => r.status)

    autoTable(doc, {
      startY: y,
      head: [['Nº', 'ENTREGADOR', 'Status', 'Turno', 'Observação']],
      body: tableRows,
      margin: { left: 14, right: 14 },
      styles: { font: 'Roboto', fontSize: 8.5, cellPadding: 3.5, textColor: black },
      headStyles: { font: 'Roboto', fillColor: navyMid, textColor: white, fontStyle: 'bold', fontSize: 8.5, halign: 'center' },
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
          hookData.cell.styles.textColor = statusColorFor(st, tagsExtras)
        }
      },
    })

    y = doc.lastAutoTable.finalY + 6
  })

  // Resumo — inclui dinamicamente qualquer tag personalizada usada nos dados
  if (y > pageH - 45) { doc.addPage(); y = 14 }
  const g = globalCounts(data)
  const summaryRows2 = [...buildSummaryRows(g.porStatus, tagsExtras), ['Total de Registros', g.total, [40, 40, 40]]]
  autoTable(doc, {
    startY: y,
    head: [['RESUMO GERAL', '']],
    body: summaryRows2.map(([label, val]) => [label, val]),
    margin: { left: 14, right: 14 },
    styles: { font: 'Roboto', fontSize: 9, cellPadding: 3.5, textColor: black },
    headStyles: { font: 'Roboto', fillColor: navyDark, textColor: white, fontStyle: 'bold', fontSize: 9 },
    alternateRowStyles: { fillColor: beige },
    columnStyles: {
      0: { fontStyle: 'normal' },
      1: { halign: 'right', fontStyle: 'bold', cellWidth: 20 },
    },
    didParseCell(hookData) {
      if (hookData.section === 'body' && hookData.column.index === 1) {
        const color = summaryRows2[hookData.row.index]?.[2]
        if (color) hookData.cell.styles.textColor = color
      }
    },
  })

  await addAttachmentsPages(doc, prints, pageW, pageH)
  addFooter(doc, pageH, pageW, now)
  doc.save(`NEXUS_Modelo2_Turnos_${dateKey}.pdf`)
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE 3 — Fundo escuro, seções com borda azul, tabelas por turno separadas
// ─────────────────────────────────────────────────────────────────────────────
export async function generatePDFTemplate3({ data, dateKey, responsible, prints }) {
  const doc   = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  registerFonts(doc)
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const emitDate = formatDatePT(dateKey)
  const now = new Date()
  const dia = diaSemana(dateKey)
  const tagsExtras = carregarTagsExtras() // tags personalizadas ("+ NOVA TAG")

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
  doc.setFont('Roboto', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(...white)
  doc.text(`RELATÓRIO DE CONTROLE DE TURNOS  ·  ${emitDate}`, pageW / 2, 12, { align: 'center' })
  doc.setFont('Roboto', 'normal')
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
    doc.setFont('Roboto', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(...white)
    doc.text(`SAIU OU FURARAM  ·  ${shiftLabel}  ·  ${dia} ${emitDate}`, 20, y + 5.5)
    y += 8

    const tableRows = rows.map((r, i) => [
      String(i + 1),  // reinicia por turno
      r.name.toUpperCase(),
      shiftLabel,
      statusLabel(r.status, r.substitutoPor, tagsExtras),
      r.obs || '',
    ])
    const statusArr = rows.map(r => r.status)

    autoTable(doc, {
      startY: y,
      head: [['#', 'ENTREGADOR', 'TURNO', 'OCORRÊNCIA', 'OBSERVAÇÃO']],
      body: tableRows,
      margin: { left: 14, right: 14 },
      styles: { font: 'Roboto', fontSize: 8, cellPadding: 3, textColor: white, fillColor: bgMain },
      headStyles: { font: 'Roboto', fillColor: bgHead, textColor: white, fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: bgAlt },
      columnStyles: {
        0: { cellWidth: 9,  halign: 'center', textColor: gray, fontSize: 7 },
        2: { cellWidth: 22, halign: 'center', textColor: orange, fontStyle: 'bold' },
        3: { cellWidth: 52 },
      },
      didParseCell(hookData) {
        if (hookData.section === 'body' && hookData.column.index === 3) {
          const st = statusArr[hookData.row.index]
          if (st) hookData.cell.styles.textColor = statusColorFor(st, tagsExtras)
        }
      },
    })

    y = doc.lastAutoTable.finalY + 6
  })

  // Resumo — inclui dinamicamente qualquer tag personalizada usada nos dados
  if (y > pageH - 55) { doc.addPage(); y = 14 }
  const g3 = globalCounts(data)
  const summaryRows3 = [...buildSummaryRows(g3.porStatus, tagsExtras), ['Total de Registros', g3.total, white]]
  autoTable(doc, {
    startY: y,
    head: [['RESUMO GERAL', '']],
    body: summaryRows3.map(([label, val]) => [label, val]),
    margin: { left: 14, right: 14 },
    styles: { font: 'Roboto', fontSize: 8.5, cellPadding: 3.5, textColor: white, fillColor: bgMain },
    headStyles: { font: 'Roboto', fillColor: bgHead, textColor: white, fontStyle: 'bold', fontSize: 9 },
    alternateRowStyles: { fillColor: bgAlt },
    columnStyles: {
      0: { fontStyle: 'normal' },
      1: { halign: 'right', fontStyle: 'bold', cellWidth: 20 },
    },
    didParseCell(hookData) {
      if (hookData.section === 'body' && hookData.column.index === 1) {
        const color = summaryRows3[hookData.row.index]?.[2]
        if (color) hookData.cell.styles.textColor = color
      }
    },
  })

  // Legenda
  const legY = doc.lastAutoTable.finalY + 8
  if (legY < pageH - 14) {
    doc.setFont('Roboto', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...gray)
    doc.text(
      'OCORRÊNCIAS \u2192   \uD83D\uDFE1 Comunicada   \uD83D\uDD34 Não comunicada   \uD83D\uDFE3 Substituído   \uD83D\uDFE0 Bloqueado   |   Coluna OBSERVA\u00C7\u00C3O livre para edi\u00E7\u00E3o',
      14, legY
    )
  }

  await addAttachmentsPages(doc, prints, pageW, pageH)
  addFooter(doc, pageH, pageW, now)
  doc.save(`NEXUS_Modelo3_Turnos_${dateKey}.pdf`)
}