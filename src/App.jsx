import React, { useState, useEffect, useCallback } from 'react'
import Login from './components/Login.jsx'
import ShiftTable from './components/ShiftTable.jsx'
import EntregadoresEstáveis from './components/EntregadoresEstáveis.jsx'
import ConfirmacaoTurnos, { estavelNaConfirmacao } from './components/ConfirmacaoTurnos.jsx'
import {
  loadData, saveData, todayKey, formatDatePT, listSavedDates,
  defaultData, newRow, SHIFT_LABELS, SHIFTS,
} from './utils/storage.js'
import { generatePDF } from './utils/pdfExport.js'

const PAGES = ['ausencias', 'entregadores', 'confirmacao']
const PAGE_LABELS = {
  ausencias:   'CONTROLE DE AUSÊNCIAS',
  entregadores:'ESTÁVEIS DO DIA',
  confirmacao: 'CONFIRMAÇÃO POR TURNO',
}

export default function App() {
  const [user, setUser]             = useState(null)
  const [page, setPage]             = useState('ausencias')
  const [dateKey, setDateKey]       = useState(todayKey())
  const [data, setData]             = useState(defaultData())
  const [shift, setShift]           = useState('almoco')
  const [filterName, setFilterName] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [savedDates, setSavedDates] = useState([])
  const [pdfLoading, setPdfLoading] = useState(false)

  // Estado compartilhado entre Estáveis e Confirmação
  const [entregadoresEstaveis, setEntregadoresEstaveis] = useState([])
  const [turnosData, setTurnosData] = useState({})

  useEffect(() => {
    try {
      const v = localStorage.getItem("nexus_ct_turnos")
      if (v) setTurnosData(JSON.parse(v))
    } catch {}
  }, [page])

  useEffect(() => {
    if (!user) return
    const d = loadData(dateKey)
    setData(d)
    setSavedDates(listSavedDates())
  }, [dateKey, user])

  const persist = useCallback((next) => {
    setData(next)
    saveData(dateKey, next)
    setSavedDates(listSavedDates())
  }, [dateKey])

  function addRow() {
  setData(prev => {
    const next = { ...prev, [shift]: [...prev[shift], newRow(dateKey)] }
    saveData(dateKey, next)
    setSavedDates(listSavedDates())
    return next
  })
}

function deleteRow(id) {
  setData(prev => {
    const next = { ...prev, [shift]: prev[shift].filter(r => r.id !== id) }
    saveData(dateKey, next)
    setSavedDates(listSavedDates())
    return next
  })
}

function updateRow(id, f, v) {
  setData(prev => {
    const next = { ...prev, [shift]: prev[shift].map(r => r.id === id ? { ...r, [f]: v } : r) }
    saveData(dateKey, next)
    setSavedDates(listSavedDates())
    return next
  })
}

  function updateResponsible(val) { persist({ ...data, responsible: val }) }

  const allRows = SHIFTS.flatMap(s => data[s] || [])

  // ── Stats ──────────────────────────────────────────────────────────────────
  const statTotal   = allRows.filter(r => r.name?.trim()).length
  const statAus     = allRows.filter(r => r.status === 'ausencia').length
  const statAvi     = allRows.filter(r => r.status === 'aviso').length
  const statSub     = allRows.filter(r => r.status === 'substituido').length
  const statBloq    = allRows.filter(r => r.status === 'bloqueado').length
  const statAusSis  = allRows.filter(r => r.status === 'ausencia_em_sistema').length
  const statNaoSis  = allRows.filter(r => r.status === 'nao_com_em_sistema').length

  const visibleRows = (data[shift] || []).filter(r => {
    const nm = filterName.toLowerCase()
    return (!nm || r.name?.toLowerCase().includes(nm)) && (!filterStatus || r.status === filterStatus)
  })

  function shiftCount(s) { return (data[s] || []).filter(r => r.name?.trim()).length }

  async function handlePDF() {
    setPdfLoading(true)
    try { generatePDF({ data, dateKey, responsible: data.responsible, user }) }
    finally { setPdfLoading(false) }
  }

  if (!user) return <Login onLogin={u => { setUser(u); setDateKey(todayKey()) }} />

  return (
    <div style={s.app}>
      <header style={s.header}>
        <div style={s.hLeft}>
          <span style={s.logo}>NEXUS</span>
          <div style={s.sep} />
          <nav style={s.nav}>
            {PAGES.map(pg => (
              <button key={pg}
                style={{ ...s.navBtn, ...(page === pg ? s.navBtnActive : {}) }}
                onClick={() => setPage(pg)}
                onMouseEnter={e => { if (page !== pg) e.currentTarget.style.color = '#ebebeb' }}
                onMouseLeave={e => { if (page !== pg) e.currentTarget.style.color = '#555560' }}
              >
                {PAGE_LABELS[pg]}
                {page === pg && <span style={s.navUnderline} />}
              </button>
            ))}
          </nav>
        </div>
        <div style={s.hRight}>
          <span style={s.userBadge}>
            Operador: <span style={{ color: '#f97316' }}>{user.charAt(0).toUpperCase() + user.slice(1)}</span>
          </span>
          <button style={s.logoutBtn} onClick={() => setUser(null)}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#f97316'; e.currentTarget.style.color = '#f97316' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#27272a'; e.currentTarget.style.color = '#909090' }}
          >SAIR</button>
        </div>
      </header>

      {page === 'entregadores' && (
        <div style={{ flex: 1 }}>
          <EntregadoresEstáveis
            onEntregadoresChange={setEntregadoresEstaveis}
            turnosData={turnosData}
          />
        </div>
      )}

      {page === 'confirmacao' && (
        <div style={{ flex: 1 }}>
          <ConfirmacaoTurnos entregadoresEstaveis={entregadoresEstaveis} />
        </div>
      )}

      {page === 'ausencias' && (
        <>
          <div style={s.main}>
            {/* ── Date bar ── */}
            <div style={s.dateBar}>
              <div style={s.dateGroup}>
                <label style={s.filterLabel}>Data de Referência</label>
                <input type="date" style={s.dateInput} value={dateKey}
                  onChange={e => { setDateKey(e.target.value); setFilterName(''); setFilterStatus('') }} />
              </div>
              {savedDates.length > 1 && (
                <div style={s.dateGroup}>
                  <label style={s.filterLabel}>Histórico Salvo</label>
                  <select style={s.selInput} value={dateKey} onChange={e => setDateKey(e.target.value)}>
                    {savedDates.map(d => (
                      <option key={d} value={d}>{formatDatePT(d)}{d === todayKey() ? ' (hoje)' : ''}</option>
                    ))}
                  </select>
                </div>
              )}
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'flex-end' }}>
                <span style={s.savedBadge}>💾 {savedDates.length} {savedDates.length === 1 ? 'data salva' : 'datas salvas'}</span>
              </div>
            </div>

            {/* ── Stats ── */}
            <div style={s.statsRow}>
              {[
                { label: 'Total de Registros',                        value: statTotal,  accent: '#f97316' },
                { label: 'Ausências Não Comunicadas',                 value: statAus,    accent: '#ef4444' },
                { label: 'Ausências Comunicadas',                     value: statAvi,    accent: '#eab308' },
                { label: 'Substituídos',                              value: statSub,    accent: '#a78bfa' },
                { label: 'Bloqueados',                                value: statBloq,   accent: '#f97316' },
                { label: 'Aus. Comunicada — em sistema',              value: statAusSis, accent: '#22c55e' },
                { label: 'Aus. Não Comunicada — em sistema',          value: statNaoSis, accent: '#60a5fa' },
              ].map(st => (
                <div key={st.label} style={{ ...s.statCard, borderLeftColor: st.accent }}>
                  <div style={s.statLabel}>{st.label}</div>
                  <div style={{ ...s.statVal, color: st.accent }}>{st.value}</div>
                </div>
              ))}
            </div>

            {/* ── Tabs de turno ── */}
            <div style={s.tabs}>
              {SHIFTS.map(sh => {
                const active = sh === shift
                const cnt = shiftCount(sh)
                return (
                  <button key={sh} style={{ ...s.tab, ...(active ? s.tabActive : {}) }} onClick={() => setShift(sh)}>
                    {SHIFT_LABELS[sh].toUpperCase()}
                    {cnt > 0 && <span style={s.tabBadge}>{cnt}</span>}
                  </button>
                )
              })}
            </div>

            {/* ── Filtros ── */}
            <div style={s.filtersRow}>
              <span style={s.filterLabel}>Filtros:</span>
              <input style={s.filterInp} placeholder="Filtrar por colaborador…"
                value={filterName} onChange={e => setFilterName(e.target.value)} />
              <select style={s.selInput} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                <option value="">Todos os status</option>
                <option value="ausencia">Ausência Não Comunicada</option>
                <option value="aviso">Ausência Comunicada</option>
                <option value="substituido">Substituído</option>
                <option value="bloqueado">Bloqueado</option>
                <option value="ausencia_em_sistema">Aus. Comunicada — continua em sistema</option>
                <option value="nao_com_em_sistema">Aus. Não Comunicada — continua em sistema</option>
              </select>
              {(filterName || filterStatus) && (
                <button style={s.clearBtn} onClick={() => { setFilterName(''); setFilterStatus('') }}
                  onMouseEnter={e => e.currentTarget.style.color = '#ebebeb'}
                  onMouseLeave={e => e.currentTarget.style.color = '#555560'}
                >LIMPAR</button>
              )}
            </div>

            <ShiftTable rows={visibleRows} onAdd={addRow} onDelete={deleteRow} onUpdate={updateRow} />
          </div>

          <footer style={s.footer}>
            <div style={s.respGroup}>
              <span style={s.filterLabel}>Responsável pelo Relatório:</span>
              <input style={s.respInput} placeholder="Nome do responsável…"
                value={data.responsible || ''} onChange={e => updateResponsible(e.target.value)} />
            </div>
            <div style={s.devCredit}>dev by <span style={s.devName}>Jeniffer</span></div>
            <button style={{ ...s.pdfBtn, opacity: pdfLoading ? 0.7 : 1 }}
              onClick={handlePDF} disabled={pdfLoading}
              onMouseEnter={e => { if (!pdfLoading) { e.currentTarget.style.background = '#fb923c'; e.currentTarget.style.transform = 'translateY(-1px)' } }}
              onMouseLeave={e => { e.currentTarget.style.background = '#f97316'; e.currentTarget.style.transform = 'translateY(0)' }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
              {pdfLoading ? 'GERANDO PDF…' : 'EXTRAIR RELATÓRIO PDF'}
            </button>
          </footer>
        </>
      )}
    </div>
  )
}

const s = {
  app:        { display:'flex', flexDirection:'column', minHeight:'100vh', background:'#09090b' },
  header:     { background:'#111113', borderBottom:'1px solid #27272a', padding:'0 32px', display:'flex', alignItems:'center', justifyContent:'space-between', height:58, position:'sticky', top:0, zIndex:100 },
  hLeft:      { display:'flex', alignItems:'center', gap:20 },
  logo:       { fontFamily:'Bebas Neue, sans-serif', fontSize:22, letterSpacing:4, color:'#f97316' },
  sep:        { width:1, height:26, background:'#27272a' },
  nav:        { display:'flex', alignItems:'stretch', gap:2, height:58 },
  navBtn:     { position:'relative', background:'transparent', border:'none', fontFamily:'Bebas Neue, sans-serif', fontSize:14, letterSpacing:2, color:'#555560', cursor:'pointer', padding:'0 18px', display:'flex', alignItems:'center', transition:'color 0.2s' },
  navBtnActive:{ color:'#f97316' },
  navUnderline:{ position:'absolute', bottom:0, left:0, right:0, height:2, background:'#f97316' },
  hRight:     { display:'flex', alignItems:'center', gap:14 },
  userBadge:  { fontFamily:'IBM Plex Mono, monospace', fontSize:12, color:'#909090' },
  logoutBtn:  { background:'transparent', border:'1px solid #27272a', color:'#909090', fontFamily:'IBM Plex Mono, monospace', fontSize:11, padding:'5px 13px', cursor:'pointer', letterSpacing:1, transition:'all 0.2s' },
  main:       { padding:'28px 32px', flex:1 },
  dateBar:    { display:'flex', alignItems:'flex-end', gap:16, marginBottom:22, flexWrap:'wrap' },
  dateGroup:  { display:'flex', flexDirection:'column', gap:6 },
  dateInput:  { background:'#18181b', border:'1px solid #27272a', color:'#ebebeb', fontFamily:'IBM Plex Mono, monospace', fontSize:12, padding:'8px 13px', outline:'none', colorScheme:'dark' },
  savedBadge: { fontFamily:'IBM Plex Mono, monospace', fontSize:11, color:'#555560' },
  statsRow:   { display:'flex', gap:14, marginBottom:22, flexWrap:'wrap' },
  statCard:   { background:'#111113', border:'1px solid #27272a', borderLeft:'3px solid transparent', padding:'14px 18px', flex:'1 1 130px', minWidth:130 },
  statLabel:  { fontFamily:'IBM Plex Mono, monospace', fontSize:9, letterSpacing:2, textTransform:'uppercase', color:'#555560', marginBottom:7 },
  statVal:    { fontFamily:'Bebas Neue, sans-serif', fontSize:32, lineHeight:1 },
  tabs:       { display:'flex', borderBottom:'2px solid #27272a', marginBottom:22 },
  tab:        { padding:'9px 26px', fontFamily:'Bebas Neue, sans-serif', fontSize:14, letterSpacing:2, color:'#555560', cursor:'pointer', background:'transparent', border:'none', borderBottom:'2px solid transparent', marginBottom:-2, transition:'all 0.2s', display:'flex', alignItems:'center', gap:8 },
  tabActive:  { color:'#f97316', borderBottomColor:'#f97316' },
  tabBadge:   { fontFamily:'IBM Plex Mono, monospace', fontSize:10, background:'rgba(249,115,22,0.12)', color:'#f97316', borderRadius:10, padding:'1px 7px' },
  filtersRow: { display:'flex', gap:10, marginBottom:14, alignItems:'center', flexWrap:'wrap' },
  filterLabel:{ fontSize:10, letterSpacing:2, textTransform:'uppercase', color:'#555560', fontFamily:'IBM Plex Mono, monospace' },
  filterInp:  { background:'#18181b', border:'1px solid #27272a', color:'#ebebeb', fontFamily:'IBM Plex Mono, monospace', fontSize:12, padding:'8px 13px', outline:'none', minWidth:200 },
  selInput:   { background:'#18181b', border:'1px solid #27272a', color:'#ebebeb', fontFamily:'IBM Plex Mono, monospace', fontSize:12, padding:'8px 13px', outline:'none', minWidth:200 },
  clearBtn:   { background:'transparent', border:'1px solid #27272a', color:'#555560', fontFamily:'IBM Plex Mono, monospace', fontSize:11, padding:'8px 13px', cursor:'pointer', letterSpacing:1, transition:'color 0.2s' },
  footer:     { borderTop:'2px solid #27272a', padding:'22px 32px', display:'flex', justifyContent:'space-between', alignItems:'center', gap:16, flexWrap:'wrap' },
  respGroup:  { display:'flex', alignItems:'center', gap:12 },
  respInput:  { background:'#18181b', border:'1px solid #27272a', color:'#ebebeb', fontFamily:'IBM Plex Mono, monospace', fontSize:13, padding:'8px 14px', outline:'none', minWidth:240 },
  devCredit:  { fontFamily:'IBM Plex Mono, monospace', fontSize:10, color:'#3a3a3a', letterSpacing:1 },
  devName:    { color:'#555560' },
  pdfBtn:     { background:'#f97316', color:'#000', fontFamily:'Bebas Neue, sans-serif', fontSize:16, letterSpacing:3, padding:'13px 32px', border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:10, transition:'all 0.2s' },
}