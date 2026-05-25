import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { SHIFT_LABELS, SHIFTS, formatDatePT } from './storage'

// ── Helpers de status ─────────────────────────────────────────────────────────

function statusLabel(status, substitutoPor) {
  switch (status) {
    case 'ausencia':            return 'Ausência Não Comunicada'
    case 'aviso':               return 'Ausência Comunicada'
    case 'substituido':         return substitutoPor
                                  ? `Substituído por: ${substitutoPor}`
                                  : 'Substituído'
    case 'bloqueado':           return 'Bloqueado'
    case 'ausencia_em_sistema': return 'Aus. Comunicada — em sistema'
    case 'nao_com_em_sistema':  return 'Aus. Não Comunicada — em sistema'
    default:                    return '—'
  }
}

// Retorna cor RGB para cada status (usada no didParseCell)
function statusColor(status) {
  switch (status) {
    case 'ausencia':            return [180, 30,  30 ]  // vermelho
    case 'aviso':               return [130, 100, 0  ]  // amarelo escuro
    case 'substituido':         return [100, 60,  180]  // roxo
    case 'bloqueado':           return [200, 80,  10 ]  // laranja escuro
    case 'ausencia_em_sistema': return [30,  130, 80 ]  // verde
    case 'nao_com_em_sistema':  return [30,  90,  180]  // azul
    default:                    return [100, 100, 110]
  }
}

// ── Gerador principal ─────────────────────────────────────────────────────────

export function generatePDF({ data, dateKey, responsible, user }) {
  const doc   = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const now   = new Date()
  const emitDate = formatDatePT(dateKey)
  const emitTime = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

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

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(26)
  doc.setTextColor(...orange)
  doc.text('NEXUS', 14, 18)

  doc.setFont('helvetica', 'normal')
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
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(...black)
  doc.text('RELATÓRIO DE CONTROLE DE AUSÊNCIAS', 14, y)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...gray)
  y += 6
  doc.text('Documento gerado automaticamente pelo sistema NEXUS — uso interno e confidencial', 14, y)

  // ── Totais globais ────────────────────────────────────────────────────────
  y += 10
  let totalAll = 0, ausAll = 0, aviAll = 0, subAll = 0, bloqAll = 0, ausSisAll = 0, naoSisAll = 0
  SHIFTS.forEach(s => {
    ;(data[s] || []).forEach(r => {
      if (!r.name?.trim()) return
      totalAll++
      if (r.status === 'ausencia')            ausAll++
      if (r.status === 'aviso')               aviAll++
      if (r.status === 'substituido')         subAll++
      if (r.status === 'bloqueado')           bloqAll++
      if (r.status === 'ausencia_em_sistema') ausSisAll++
      if (r.status === 'nao_com_em_sistema')  naoSisAll++
    })
  })

  // 7 cards em 2 linhas: 3 na primeira, 4 na segunda
  const allStats = [
    { label: 'TOTAL DE REGISTROS',                value: totalAll,  color: orange          },
    { label: 'AUS. NÃO COMUNICADAS',              value: ausAll,    color: [239, 68,  68 ] },
    { label: 'AUS. COMUNICADAS',                  value: aviAll,    color: [234, 179, 8  ] },
    { label: 'SUBSTITUÍDOS',                      value: subAll,    color: [167, 139, 250] },
    { label: 'BLOQUEADOS',                        value: bloqAll,   color: orange          },
    { label: 'AUS. COMUNICADA — EM SISTEMA',      value: ausSisAll, color: [34,  197, 94 ] },
    { label: 'AUS. NÃO COMUNICADA — EM SISTEMA',  value: naoSisAll, color: [96,  165, 250] },
  ]

  // Uma única linha com 7 cards compactos
  const cardH  = 13
  const gap    = 2
  const cardW  = (pageW - 28 - gap * 6) / 7

  allStats.forEach((st, i) => {
    const x = 14 + i * (cardW + gap)

    // fundo cinza claro
    doc.setFillColor(...lightG)
    doc.rect(x, y, cardW, cardH, 'F')

    // barra colorida na esquerda
    doc.setFillColor(...st.color)
    doc.rect(x, y, 2.5, cardH, 'F')

    // número
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(...black)
    doc.text(String(st.value), x + cardW / 2 + 1, y + 6.5, { align: 'center' })

    // label — quebra em 2 linhas se necessário
    doc.setFont('helvetica', 'normal')
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
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...white)
    doc.text(`TURNO — ${SHIFT_LABELS[shift].toUpperCase()}`, 18, y + 5.5)

    // Mini-stats do turno
    const tTotal   = rows.filter(r => r.name?.trim()).length
    const tAus     = rows.filter(r => r.status === 'ausencia').length
    const tAvi     = rows.filter(r => r.status === 'aviso').length
    const tSub     = rows.filter(r => r.status === 'substituido').length
    const tBloq    = rows.filter(r => r.status === 'bloqueado').length
    const tAusSis  = rows.filter(r => r.status === 'ausencia_em_sistema').length
    const tNaoSis  = rows.filter(r => r.status === 'nao_com_em_sistema').length

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    doc.setTextColor(180, 180, 190)
    doc.text(
      `${tTotal} reg  |  ${tAus} não com.  |  ${tAvi} com.  |  ${tSub} subst.  |  ${tBloq} bloq.  |  ${tAusSis} com/sis  |  ${tNaoSis} ncom/sis`,
      pageW - 18, y + 5.5, { align: 'right' }
    )
    y += 8

    // Linhas da tabela
    const tableRows = rows.map((r, i) => [
      String(i + 1).padStart(2, '0'),
      r.name || '—',
      statusLabel(r.status, r.substitutoPor),
      r.obs || '—',
      r.date || '—',
    ])

    autoTable(doc, {
      startY: y,
      head: [['#', 'Colaborador', 'Status de Presença', 'Motivo / Observações', 'Data']],
      body: tableRows,
      margin: { left: 14, right: 14 },
      styles: { fontSize: 8, cellPadding: 3, textColor: [30, 30, 35] },
      headStyles: {
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
          if (status) hookData.cell.styles.textColor = statusColor(status)
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
    doc.setFont('helvetica', 'normal')
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
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...gray)
    doc.text(responsible || 'Responsável', pageW - 47, sigY + 5,  { align: 'center' })
    doc.text('Assinatura do Responsável',   pageW - 47, sigY + 9,  { align: 'center' })
  }

  doc.save(`NEXUS_Ausencias_${dateKey}.pdf`)
}