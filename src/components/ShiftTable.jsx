import React, { useRef } from 'react'

const STATUS_OPTS = [
  { value: '',           label: '— Selecionar —' },
  { value: 'ausencia',   label: 'Ausência Não Comunicada' },
  { value: 'aviso',      label: 'Ausência Comunicada' },
  { value: 'substituido',          label: 'Substituído' },
  { value: 'bloqueado',            label: 'Bloqueado' },
  { value: 'ausencia_em_sistema',  label: 'Ausência comunicada — continua em sistema' },
  { value: 'nao_com_em_sistema',   label: 'Ausência não comunicada — continua em sistema' },
]

// Cor de cada status no select
function statusColor(status) {
  switch (status) {
    case 'ausencia':             return '#ef4444'   // vermelho
    case 'aviso':                return '#eab308'   // amarelo
    case 'substituido':          return '#a78bfa'   // roxo
    case 'bloqueado':            return '#f97316'   // laranja
    case 'ausencia_em_sistema':  return '#22c55e'   // verde
    case 'nao_com_em_sistema':   return '#60a5fa'   // azul
    default:                     return '#909090'
  }
}

export default function ShiftTable({ rows, onAdd, onDelete, onUpdate }) {
  const tbodyRef = useRef()

  function handleAdd() {
    onAdd()
    setTimeout(() => {
      const inputs = tbodyRef.current?.querySelectorAll('.name-inp')
      if (inputs?.length) inputs[inputs.length - 1].focus()
    }, 40)
  }

  return (
    <div>
      <div style={s.topBar}>
        <button style={s.addBtn} onClick={handleAdd}
          onMouseEnter={e => e.currentTarget.style.background = '#fb923c'}
          onMouseLeave={e => e.currentTarget.style.background = '#f97316'}
        >
          + ADICIONAR REGISTRO
        </button>
      </div>

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
              <Row key={row.id} row={row} idx={idx} onDelete={onDelete} onUpdate={onUpdate} />
            ))}
          </tbody>
        </table>

        {rows.length === 0 && (
          <div style={s.empty}>
            <div style={s.emptyIcon}>📋</div>
            Nenhum registro neste turno.<br />
            Clique em "+ ADICIONAR REGISTRO" para começar.
          </div>
        )}
      </div>
    </div>
  )
}

function Row({ row, idx, onDelete, onUpdate }) {
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
          onChange={e => onUpdate(row.id, 'name', e.target.value)}
        />
      </td>

      <td style={s.td}>
        {/* Select de status */}
        <select
          style={{ ...s.cellSelect, color: statusColor(row.status) }}
          value={row.status}
          onChange={e => {
            onUpdate(row.id, 'status', e.target.value)
            // Limpa o substituto se mudar para outro status
            if (e.target.value !== 'substituido') {
              onUpdate(row.id, 'substitutoPor', '')
            }
          }}
        >
          {STATUS_OPTS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {/* Campo de substituto — aparece somente quando status = substituido */}
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
  topBar: { display: 'flex', justifyContent: 'flex-end', marginBottom: 12 },
  addBtn: {
    background: '#f97316', color: '#000', fontFamily: 'Bebas Neue, sans-serif',
    fontSize: 14, letterSpacing: 2, padding: '9px 22px', border: 'none', cursor: 'pointer',
    transition: 'background 0.2s',
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

  // ── Substituto ──
  substitutoWrap: {
    marginTop: 8,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: 'rgba(167,139,250,0.08)',
    border: '1px solid rgba(167,139,250,0.25)',
    padding: '6px 10px',
  },
  substitutoLabel: {
    fontFamily: 'IBM Plex Mono, monospace',
    fontSize: 10,
    letterSpacing: 1,
    color: '#a78bfa',
    whiteSpace: 'nowrap',
    textTransform: 'uppercase',
  },
  substitutoInput: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    borderBottom: '1px solid rgba(167,139,250,0.4)',
    color: '#ebebeb',
    fontFamily: 'IBM Plex Sans, sans-serif',
    fontSize: 12,
    outline: 'none',
    padding: '2px 0',
    minWidth: 0,
  },
}