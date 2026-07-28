import React, { useRef } from 'react'
import { STATUS_FIXOS, statusColorHex } from '../utils/statusConfig.js'
import AnexarPrintOCR from './AnexarPrintOCR.jsx'

function statusColor(status, tagsExtras = []) {
  const extra = tagsExtras.find(t => t.value === status)
  if (extra) return extra.color
  return statusColorHex(status)
}

// tagsExtras agora vem pronto do App.jsx (que já carrega do Supabase de
// forma assíncrona) — o ShiftTable não carrega mais por conta própria.
export default function ShiftTable({ rows, onAdd, onDelete, onUpdate, tagsExtras = [] }) {
  const tbodyRef = useRef()
  const [qtdAdd, setQtdAdd] = React.useState(1)
  const [importInfo, setImportInfo] = React.useState(null)

  const STATUS_OPTS = [...STATUS_FIXOS, ...tagsExtras]

  function handleAdd() {
    const n = Math.max(1, Number(qtdAdd) || 1)
    for (let i = 0; i < n; i++) onAdd()
    setTimeout(() => {
      const inputs = tbodyRef.current?.querySelectorAll('.name-inp')
      if (inputs?.length) inputs[inputs.length - 1].focus()
    }, 100 * n)
  }

  // Recebe os registros lidos do print pelo OCR ([{ nome, status, motivo }],
  // já conferidos na tela de preview) e cria uma linha nova pra cada um,
  // já preenchida. Status vazio ('') cai como "— Selecionar —" na tabela.
  function handleImportPrint(registros) {
    registros.forEach(r => {
      onAdd({
        name: (r.nome || '').toUpperCase(),
        status: r.status || '',
        obs: r.motivo || '',
      })
    })
    setImportInfo({ total: registros.length })
    setTimeout(() => setImportInfo(null), 5000)
  }

  return (
    <div>
      {/* TOP BAR */}
      <div style={s.topBar}>
        <AnexarPrintOCR onImport={handleImportPrint} />

        

        <div style={s.addGroup}>
          <input
            type="number"
            min={1}
            max={50}
            value={qtdAdd}
            onChange={e => setQtdAdd(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
            style={s.qtdInput}
            title="Quantidade de registros"
          />
          <button
            style={s.addBtn}
            onClick={handleAdd}
            onMouseEnter={e => e.currentTarget.style.background = '#fb923c'}
            onMouseLeave={e => e.currentTarget.style.background = '#f97316'}
          >
            + ADICIONAR {qtdAdd > 1 ? `(${qtdAdd})` : 'REGISTRO'}
          </button>
        </div>
      </div>

      {/* Aviso pós-importação do print */}
      {importInfo && (
        <div style={s.importBanner}>
          ✅ {importInfo.total} registro(s) importado(s) do print.
        </div>
      )}

      {/* TABELA */}
      <div style={s.tableWrap}>
        <table style={s.table}>
          <thead>
            <tr style={s.thead}>
              <th style={{ ...s.th, width: 46 }}>#</th>
              <th style={{ ...s.th, minWidth: 180 }}>Colaborador</th>
              <th style={{ ...s.th, minWidth: 210 }}>Status de Presença</th>
              <th style={{ ...s.th, minWidth: 240 }}>Motivo / Observações</th>
              <th style={{ ...s.th, minWidth: 100 }}>Data</th>
              <th style={{ ...s.th, width: 44 }} />
            </tr>
          </thead>
          <tbody ref={tbodyRef}>
            {rows.map((row, idx) => (
              <Row
                key={row.id}
                row={row}
                idx={idx}
                onDelete={onDelete}
                onUpdate={onUpdate}
                tagsExtras={tagsExtras}
                statusOpts={STATUS_OPTS}
              />
            ))}
          </tbody>
        </table>

        {rows.length === 0 && (
          <div style={s.empty}>
            <div style={s.emptyIcon}>📋</div>
            Nenhum registro neste turno.<br />
            Clique em "+ ADICIONAR REGISTRO" ou anexe um print para começar.
          </div>
        )}
      </div>
    </div>
  )
}

function Row({ row, idx, onDelete, onUpdate, tagsExtras, statusOpts }) {
  const [hover, setHover] = React.useState(false)
  const isSubstituido = row.status === 'substituido'

  return (
    <tr
      style={{ ...s.tr, background: hover ? 'rgba(255,255,255,0.015)' : 'transparent' }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <td style={{ ...s.td, ...s.num }}>{String(idx + 1).padStart(2, '0')}</td>

      <td style={s.td}>
        <input
          className="name-inp"
          style={s.cellInput}
          value={row.name}
          placeholder="Nome do colaborador"
          onChange={e => onUpdate(row.id, 'name', e.target.value.toUpperCase())}
        />
      </td>

      <td style={s.td}>
        <select
          style={{ ...s.cellSelect, color: statusColor(row.status, tagsExtras) }}
          value={row.status}
          onChange={e => {
            onUpdate(row.id, 'status', e.target.value)
            if (e.target.value !== 'substituido') {
              onUpdate(row.id, 'substitutoPor', '')
            }
          }}
        >
          {statusOpts.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {isSubstituido && (
          <div style={s.substitutoWrap}>
            <span style={s.substitutoLabel}>Substituído por:</span>
            <input
              style={s.substitutoInput}
              value={row.substitutoPor || ''}
              placeholder="Nome do substituto…"
              onChange={e => onUpdate(row.id, 'substitutoPor', e.target.value)}
            />
          </div>
        )}
      </td>

      <td style={s.td}>
        <textarea
          style={s.cellArea}
          value={row.obs}
          placeholder="Motivo, observações…"
          rows={1}
          onChange={e => {
            onUpdate(row.id, 'obs', e.target.value)
            e.target.style.height = 'auto'
            e.target.style.height = e.target.scrollHeight + 'px'
          }}
        />
      </td>

      <td style={{ ...s.td, ...s.dateCell }}>{row.date}</td>

      <td style={{ ...s.td, textAlign: 'center' }}>
        <button
          style={s.delBtn}
          onClick={() => onDelete(row.id)}
          onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
          onMouseLeave={e => e.currentTarget.style.color = '#555560'}
          title="Remover"
        >✕</button>
      </td>
    </tr>
  )
}

const s = {
  topBar: { display: 'flex', justifyContent: 'flex-end', marginBottom: 12, gap: 8, flexWrap: 'wrap' },
  addBtn: {
    background: '#f97316', color: '#000', fontFamily: 'Bebas Neue, sans-serif',
    fontSize: 14, letterSpacing: 2, padding: '9px 22px', border: 'none', cursor: 'pointer',
    transition: 'background 0.2s',
  },
  tagBtn: {
    background: 'transparent', border: '1px solid #27272a', color: '#f97316',
    fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, letterSpacing: 1.5,
    padding: '9px 16px', cursor: 'pointer', transition: 'border-color 0.2s',
  },
  importBanner: {
    background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)',
    color: '#4ade80', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11,
    padding: '9px 14px', marginBottom: 12,
  },
  tableWrap: { background: '#111113', border: '1px solid #27272a', overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  thead: { background: '#18181b', borderBottom: '2px solid rgba(249,115,22,0.28)' },
  th: {
    textAlign: 'left', padding: '13px 16px', fontFamily: 'IBM Plex Mono, monospace',
    fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: '#555560', fontWeight: 500,
  },
  tr: { borderBottom: '1px solid #27272a', transition: 'background 0.12s' },
  td: { padding: '12px 16px', verticalAlign: 'middle' },
  num: { fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: '#555560' },
  dateCell: { fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: '#555560', whiteSpace: 'nowrap' },
  cellInput: {
    background: 'transparent', border: 'none', borderBottom: '1px solid transparent',
    color: '#ebebeb', fontFamily: 'IBM Plex Sans, sans-serif', fontSize: 13, fontWeight: 500,
    width: '100%', outline: 'none', padding: '2px 0', transition: 'border-color 0.2s',
  },
  cellSelect: {
    background: '#222227', border: '1px solid #27272a', fontFamily: 'IBM Plex Mono, monospace',
    fontSize: 11, padding: '6px 10px', outline: 'none', cursor: 'pointer',
    transition: 'border-color 0.2s', minWidth: 200, width: '100%',
  },
  cellArea: {
    background: 'transparent', border: 'none', borderBottom: '1px solid transparent',
    color: '#909090', fontFamily: 'IBM Plex Sans, sans-serif', fontSize: 12,
    width: '100%', outline: 'none', resize: 'none', padding: '2px 0', minHeight: 24,
    transition: 'border-color 0.2s',
  },
  delBtn: {
    background: 'transparent', border: 'none', color: '#555560',
    cursor: 'pointer', fontSize: 15, padding: '3px 6px', transition: 'color 0.2s', lineHeight: 1,
  },
  empty: {
    textAlign: 'center', padding: '56px 32px', color: '#555560',
    fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, letterSpacing: 1,
  },
  emptyIcon: { fontSize: 30, marginBottom: 10, opacity: 0.3 },
  substitutoWrap: {
    marginTop: 8, display: 'flex', alignItems: 'center', gap: 8,
    background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.25)',
    padding: '6px 10px',
  },
  substitutoLabel: {
    fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, letterSpacing: 1,
    color: '#a78bfa', whiteSpace: 'nowrap', textTransform: 'uppercase',
  },
  substitutoInput: {
    flex: 1, background: 'transparent', border: 'none',
    borderBottom: '1px solid rgba(167,139,250,0.4)', color: '#ebebeb',
    fontFamily: 'IBM Plex Sans, sans-serif', fontSize: 12, outline: 'none',
    padding: '2px 0', minWidth: 0,
  },
  // ── Modal ──
  modalOverlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
    zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  modalBox: {
    background: '#18181b', border: '1px solid #27272a', padding: 28,
    width: 380, display: 'flex', flexDirection: 'column', gap: 16,
  },
  modalTitle: {
    fontFamily: 'IBM Plex Mono, monospace', fontSize: 13, letterSpacing: 2,
    color: '#f97316', textTransform: 'uppercase', fontWeight: 700,
  },
  modalField: { display: 'flex', flexDirection: 'column', gap: 6 },
  modalLabel: {
    fontFamily: 'IBM Plex Mono, monospace', fontSize: 9,
    letterSpacing: 1.5, color: '#555560', textTransform: 'uppercase',
  },
  modalInput: {
    background: '#111113', border: '1px solid #27272a', color: '#ebebeb',
    fontFamily: 'IBM Plex Sans, sans-serif', fontSize: 13,
    padding: '8px 10px', outline: 'none',
  },
  colorPicker: { width: 36, height: 36, border: 'none', background: 'none', cursor: 'pointer', padding: 0 },
  tagPill: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '3px 8px', border: '1px solid', fontSize: 11,
    fontFamily: 'IBM Plex Mono, monospace',
  },
  tagRemove: {
    background: 'none', border: 'none', color: 'inherit',
    cursor: 'pointer', fontSize: 11, padding: 0, lineHeight: 1,
  },
  modalCancel: {
    background: 'transparent', border: '1px solid #27272a', color: '#555560',
    fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, padding: '7px 14px', cursor: 'pointer',
  },
  modalConfirm: {
    background: '#f97316', border: 'none', color: '#000',
    fontFamily: 'Bebas Neue, sans-serif', fontSize: 14, letterSpacing: 2,
    padding: '7px 18px', cursor: 'pointer', transition: 'opacity 0.2s',
  },

  addGroup: { display: 'flex', alignItems: 'stretch', gap: 0 },
  qtdInput: {
    width: 48, background: '#222227', border: '1px solid #27272a',
    borderRight: 'none', color: '#f97316', fontFamily: 'IBM Plex Mono, monospace',
    fontSize: 13, textAlign: 'center', outline: 'none', padding: '0 6px',
    appearance: 'textfield', MozAppearance: 'textfield',
  },
}