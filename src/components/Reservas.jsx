import { useState, useMemo } from "react";
import { isEntregadorEstáveis } from "./EntregadoresEstáveis.jsx";

const TURNOS = ["Almoço", "Tarde", "Jantar", "Ceia"];

const TURNO_ICON = {
  "Almoço": "☀️",
  "Tarde":  "🌤️",
  "Jantar": "🌙",
  "Ceia":   "⭐",
};

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=IBM+Plex+Mono:wght@400;500&display=swap');

  :root {
    --orange: #f97316;
    --orange-dim: #c2601a;
    --orange-glow: rgba(249,115,22,0.12);
    --orange-border: rgba(249,115,22,0.35);
    --bg: #09090b;
    --surface: #111113;
    --surface2: #18181b;
    --surface3: #1f1f22;
    --line: #27272a;
    --text: #ebebeb;
    --muted: #555560;
    --subtle: #1e1a16;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }

  .res-root {
    background: var(--bg);
    min-height: 100vh;
    padding: 28px 32px;
    font-family: 'IBM Plex Mono', monospace;
    color: var(--text);
  }

  /* ── Header ── */
  .res-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin-bottom: 28px;
    border-bottom: 1px solid var(--line);
    padding-bottom: 22px;
    flex-wrap: wrap;
    gap: 14px;
  }
  .res-eyebrow {
    font-size: 10px;
    letter-spacing: 3px;
    color: var(--orange);
    text-transform: uppercase;
    margin-bottom: 6px;
  }
  .res-title {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 38px;
    letter-spacing: 3px;
    color: var(--text);
    line-height: 1;
  }
  .res-title span { color: var(--orange); }
  .res-subtitle { margin-top: 6px; font-size: 10px; color: var(--muted); letter-spacing: 1.5px; text-transform: uppercase; }

  .btn-add {
    background: var(--orange);
    color: #000;
    border: none;
    padding: 11px 24px;
    font-family: 'Bebas Neue', sans-serif;
    font-size: 16px;
    letter-spacing: 2px;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .btn-add:hover { background: #fb923c; transform: translateY(-1px); }

  /* ── Banner Estáveis ── */
  .res-Estáveis-banner {
    background: var(--subtle);
    border: 1px solid var(--orange-border);
    border-left: 3px solid var(--orange);
    padding: 12px 18px;
    margin-bottom: 22px;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .res-Estáveis-banner-text {
    font-size: 10px;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: var(--orange);
  }
  .res-Estáveis-banner-count {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 18px;
    color: var(--orange);
    letter-spacing: 2px;
  }
  .res-Estáveis-banner-empty {
    font-size: 10px;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: var(--muted);
  }

  /* ── Date bar ── */
  .res-datebar {
    display: flex;
    align-items: flex-end;
    gap: 16px;
    margin-bottom: 22px;
    padding: 16px 20px;
    background: var(--surface);
    border: 1px solid var(--line);
    flex-wrap: wrap;
  }
  .res-dategroup { display: flex; flex-direction: column; gap: 6px; }
  .res-datelabel { font-size: 9px; letter-spacing: 2px; text-transform: uppercase; color: var(--muted); }
  .res-dateinput {
    background: var(--surface2);
    border: 1px solid var(--line);
    color: var(--text);
    padding: 8px 13px;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 12px;
    outline: none;
    color-scheme: dark;
    transition: border-color 0.2s;
    min-width: 160px;
  }
  .res-dateinput:focus { border-color: var(--orange-border); }
  .res-savedbadge { font-size: 10px; color: var(--muted); letter-spacing: 1px; }

  /* ── Stats ── */
  .res-stats {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 14px;
    margin-bottom: 22px;
  }
  .stat-card {
    background: var(--surface);
    border: 1px solid var(--line);
    border-left: 3px solid var(--orange);
    padding: 14px 18px;
    transition: border-color 0.2s;
  }
  .stat-card:hover { border-color: var(--orange-border); }
  .stat-label { font-size: 9px; letter-spacing: 2px; text-transform: uppercase; color: var(--muted); margin-bottom: 7px; }
  .stat-value { font-family: 'Bebas Neue', sans-serif; font-size: 32px; color: var(--text); line-height: 1; }
  .stat-value.orange { color: var(--orange); }

  /* ── Filters ── */
  .res-filters {
    background: var(--surface);
    border: 1px solid var(--line);
    padding: 16px 20px;
    margin-bottom: 18px;
    display: grid;
    grid-template-columns: 1fr 1fr auto;
    gap: 14px;
    align-items: end;
  }
  .filter-group label { display: block; font-size: 9px; letter-spacing: 2px; text-transform: uppercase; color: var(--muted); margin-bottom: 8px; }
  .filter-input {
    width: 100%;
    background: var(--surface2);
    border: 1px solid var(--line);
    color: var(--text);
    padding: 9px 13px;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 12px;
    outline: none;
    transition: border-color 0.2s;
  }
  .filter-input:focus { border-color: var(--orange-border); }
  .filter-input::placeholder { color: #3a3a3a; }

  .btn-clear {
    background: transparent;
    border: 1px solid var(--line);
    color: var(--muted);
    font-family: 'IBM Plex Mono', monospace;
    font-size: 11px;
    padding: 9px 14px;
    cursor: pointer;
    letter-spacing: 1px;
    transition: all 0.2s;
    white-space: nowrap;
  }
  .btn-clear:hover { border-color: var(--orange); color: var(--orange); }

  /* ── Pills ── */
  .pills-row { display: flex; gap: 8px; margin-bottom: 14px; flex-wrap: wrap; }
  .pill {
    padding: 6px 14px;
    font-family: 'Bebas Neue', sans-serif;
    font-size: 13px;
    letter-spacing: 1.5px;
    cursor: pointer;
    border: 1px solid var(--line);
    background: var(--surface);
    color: var(--muted);
    transition: all 0.18s;
  }
  .pill:hover { border-color: var(--orange-border); color: var(--text); }
  .pill.active { background: var(--orange); border-color: var(--orange); color: #000; }

  .turno-pills { display: flex; gap: 8px; margin-bottom: 22px; flex-wrap: wrap; align-items: center; }
  .turno-pills-label { font-size: 9px; letter-spacing: 2px; text-transform: uppercase; color: var(--muted); margin-right: 4px; }
  .turno-pill {
    padding: 6px 14px;
    font-family: 'Bebas Neue', sans-serif;
    font-size: 13px;
    letter-spacing: 1px;
    cursor: pointer;
    border: 1px solid var(--line);
    background: var(--surface);
    color: var(--muted);
    transition: all 0.18s;
    display: flex;
    align-items: center;
    gap: 5px;
    user-select: none;
  }
  .turno-pill:hover { border-color: var(--orange-border); color: var(--text); }
  .turno-pill.active { background: var(--subtle); border-color: var(--orange); color: var(--orange); }
  .turno-pill.todos.active { background: var(--orange); border-color: var(--orange); color: #000; }

  /* ── Table ── */
  .res-table-wrap {
    background: var(--surface);
    border: 1px solid var(--line);
    overflow-x: auto;
  }
  .res-table { width: 100%; border-collapse: collapse; min-width: 900px; }
  .res-table thead { background: var(--surface2); border-bottom: 2px solid var(--line); }
  .res-table th {
    padding: 11px 16px;
    text-align: left;
    font-size: 9px;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: var(--muted);
    font-family: 'IBM Plex Mono', monospace;
    font-weight: 500;
    white-space: nowrap;
  }
  .res-table th.col-Estáveis { color: var(--orange); }
  .res-table td { padding: 11px 16px; font-size: 12px; color: var(--text); border-bottom: 1px solid #1a1a1d; }
  .res-table tr:last-child td { border-bottom: none; }
  .res-table tbody tr { transition: background 0.15s; }
  .res-table tbody tr:hover td { background: var(--surface2); }

  .td-nome { font-family: 'Bebas Neue', sans-serif; font-size: 15px; letter-spacing: 1px; color: #fff; }
  .td-cpf  { font-size: 11px; color: var(--muted); letter-spacing: 0.5px; }

  /* Status badge */
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    font-family: 'Bebas Neue', sans-serif;
    font-size: 12px;
    letter-spacing: 1px;
  }
  .badge.confirmado { background: rgba(72,199,142,0.08); color: #48c78e; border: 1px solid rgba(72,199,142,0.2); }
  .badge.nao        { background: var(--orange-glow);    color: var(--orange); border: 1px solid var(--orange-border); }
  .badge-dot { width: 5px; height: 5px; border-radius: 50%; display: inline-block; }
  .badge.confirmado .badge-dot { background: #48c78e; }
  .badge.nao        .badge-dot { background: var(--orange); }

  /* Estável badge */
  .badge-conf {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 10px;
    font-family: 'Bebas Neue', sans-serif;
    font-size: 12px;
    letter-spacing: 1px;
    white-space: nowrap;
  }
  .badge-conf.sim  { background: rgba(249,115,22,0.1); color: var(--orange); border: 1px solid var(--orange-border); }
  .badge-conf.nao  { background: var(--surface2);      color: var(--muted);  border: 1px solid var(--line); }
  .badge-conf.nd   { background: var(--surface2);      color: #3a3a3a;       border: 1px solid var(--line); }

  /* Turno tags */
  .turno-tags { display: flex; gap: 4px; flex-wrap: wrap; }
  .turno-tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: var(--surface3);
    border: 1px solid var(--line);
    padding: 3px 8px;
    font-size: 11px;
    color: var(--text);
    font-weight: 500;
    white-space: nowrap;
  }

  .status-select {
    background: var(--surface3);
    border: 1px solid var(--line);
    color: var(--text);
    padding: 6px 10px;
    font-size: 11px;
    font-family: 'IBM Plex Mono', monospace;
    cursor: pointer;
    outline: none;
    transition: border-color 0.2s;
  }
  .status-select:focus { border-color: var(--orange-border); }

  .btn-edit {
    background: transparent;
    border: 1px solid var(--line);
    color: var(--muted);
    padding: 5px 12px;
    font-size: 11px;
    font-family: 'IBM Plex Mono', monospace;
    cursor: pointer;
    transition: all 0.18s;
    margin-right: 6px;
    letter-spacing: 0.5px;
  }
  .btn-edit:hover { border-color: var(--orange); color: var(--orange); }
  .btn-del {
    background: transparent;
    border: 1px solid rgba(239,68,68,0.2);
    color: #ef4444;
    padding: 5px 12px;
    font-size: 11px;
    font-family: 'IBM Plex Mono', monospace;
    cursor: pointer;
    transition: all 0.18s;
    letter-spacing: 0.5px;
  }
  .btn-del:hover { background: rgba(239,68,68,0.06); }

  .empty-row { text-align: center; padding: 60px 20px; color: var(--muted); font-size: 11px; letter-spacing: 1px; text-transform: uppercase; }
  .empty-icon { font-size: 28px; margin-bottom: 10px; display: block; }

  /* Modal */
  .modal-overlay {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.8);
    display: flex; align-items: center; justify-content: center;
    z-index: 1000;
    backdrop-filter: blur(4px);
  }
  .modal-box {
    background: var(--surface);
    border: 1px solid var(--orange-border);
    padding: 34px;
    width: 460px;
    animation: slideUp 0.2s ease;
    max-height: 90vh;
    overflow-y: auto;
  }
  @keyframes slideUp {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 26px; }
  .modal-title { font-family: 'Bebas Neue', sans-serif; font-size: 22px; letter-spacing: 2px; color: #fff; }
  .modal-title span { color: var(--orange); }
  .modal-close {
    background: var(--surface2); border: 1px solid var(--line);
    color: var(--muted); width: 30px; height: 30px;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; font-size: 15px; transition: all 0.18s;
  }
  .modal-close:hover { border-color: var(--orange); color: var(--orange); }

  .form-label { display: block; font-size: 9px; letter-spacing: 2px; text-transform: uppercase; color: var(--muted); margin-bottom: 7px; }
  .form-input {
    width: 100%;
    background: var(--surface2); border: 1px solid var(--line);
    color: var(--text); padding: 10px 13px;
    font-family: 'IBM Plex Mono', monospace; font-size: 13px;
    outline: none; margin-bottom: 16px;
    transition: border-color 0.2s;
    color-scheme: dark;
  }
  .form-input:focus { border-color: var(--orange-border); }

  .turno-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 16px; }
  .turno-opt {
    background: var(--surface2); border: 1px solid var(--line);
    padding: 10px 14px; cursor: pointer;
    font-size: 12px; font-family: 'IBM Plex Mono', monospace;
    color: var(--muted);
    display: flex; align-items: center; gap: 7px;
    transition: all 0.18s; user-select: none;
  }
  .turno-opt:hover { border-color: var(--orange-border); color: var(--text); }
  .turno-opt.selected { background: var(--subtle); border-color: var(--orange); color: var(--orange); }
  .turno-opt .check-icon { margin-left: auto; font-size: 12px; opacity: 0; transition: opacity 0.15s; }
  .turno-opt.selected .check-icon { opacity: 1; }

  .modal-footer { display: flex; justify-content: flex-end; gap: 10px; margin-top: 6px; }
  .btn-cancel {
    background: transparent; border: 1px solid var(--line); color: var(--muted);
    padding: 9px 20px; font-family: 'IBM Plex Mono', monospace; font-size: 12px;
    cursor: pointer; letter-spacing: 1px; transition: all 0.18s;
  }
  .btn-cancel:hover { border-color: var(--orange); color: var(--orange); }
  .btn-save {
    background: var(--orange); color: #000; border: none;
    padding: 9px 24px; font-family: 'Bebas Neue', sans-serif;
    font-size: 16px; letter-spacing: 2px; cursor: pointer; transition: all 0.2s;
  }
  .btn-save:hover { background: #fb923c; transform: translateY(-1px); }

  .res-footer-count { margin-top: 12px; font-size: 10px; color: #3a3a3a; letter-spacing: 1px; text-align: right; text-transform: uppercase; }
`;

const emptyForm = { nome: "", cpf: "", data: "", turnos: [], status: "nao_confirmado" };

const STORAGE_PREFIX = "nexus_reservas_";
function todayKey() { return new Date().toISOString().split("T")[0]; }
function loadReservas(dk) { try { const r = localStorage.getItem(STORAGE_PREFIX + dk); return r ? JSON.parse(r) : []; } catch { return []; } }
function saveReservas(dk, data) { try { localStorage.setItem(STORAGE_PREFIX + dk, JSON.stringify(data)); } catch {} }
function listSavedDates() {
  const dates = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(STORAGE_PREFIX)) dates.push(k.replace(STORAGE_PREFIX, ""));
  }
  return dates.sort((a, b) => b.localeCompare(a));
}
function formatDatePT(d) { if (!d) return "—"; const [y, m, day] = d.split("-"); return `${day}/${m}/${y}`; }
function toggleArr(arr, val) { return arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val]; }

export default function Reservas({ entregadoresEstáveis = [] }) {
  const [dateKey, setDateKey]           = useState(todayKey());
  const [reservas, setReservas]         = useState(() => loadReservas(todayKey()));
  const [savedDates, setSavedDates]     = useState(() => listSavedDates());
  const [showModal, setShowModal]       = useState(false);
  const [form, setForm]                 = useState(emptyForm);
  const [editId, setEditId]             = useState(null);
  const [busca, setBusca]               = useState("");
  const [buscaCpf, setBuscaCpf]         = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroTurnos, setFiltroTurnos] = useState([]);

  const hoje = todayKey();
  const temEstáveis = entregadoresEstáveis.length > 0;

  function persist(dk, data) {
    setReservas(data);
    saveReservas(dk, data);
    setSavedDates(listSavedDates());
  }

  function handleDateChange(newKey) {
    setDateKey(newKey);
    setReservas(loadReservas(newKey));
    setBusca(""); setBuscaCpf(""); setFiltroStatus("todos"); setFiltroTurnos([]);
  }

  const filtered = useMemo(() => reservas.filter(r => {
    const matchNome   = r.nome.toLowerCase().includes(busca.toLowerCase());
    const matchCpf    = !buscaCpf || (r.cpf || "").replace(/\D/g,"").includes(buscaCpf.replace(/\D/g,"")) || (r.cpf||"").includes(buscaCpf);
    const matchStatus = filtroStatus === "todos" || r.status === filtroStatus;
    const matchTurno  = filtroTurnos.length === 0 || filtroTurnos.some(t => r.turnos.includes(t));
    return matchNome && matchCpf && matchStatus && matchTurno;
  }), [reservas, busca, buscaCpf, filtroStatus, filtroTurnos]);

  const confirmados    = reservas.filter(r => r.status === "confirmado").length;
  const naoConfirmados = reservas.filter(r => r.status === "nao_confirmado").length;
  const totalEstáveis = reservas.filter(r => isEntregadorEstáveis(r.nome, entregadoresEstáveis)).length;

  const handleSave = () => {
    if (!form.nome.trim() || !form.data || form.turnos.length === 0) return;
    const next = editId !== null
      ? reservas.map(r => r.id === editId ? { ...r, ...form } : r)
      : [...reservas, { ...form, id: Date.now() }];
    persist(dateKey, next);
    setShowModal(false); setForm(emptyForm); setEditId(null);
  };

  const handleEdit = (r) => {
    setForm({ nome: r.nome, cpf: r.cpf || "", data: r.data, turnos: r.turnos, status: r.status });
    setEditId(r.id); setShowModal(true);
  };
  const handleDelete = (id) => persist(dateKey, reservas.filter(r => r.id !== id));
  const handleStatusChange = (id, val) => persist(dateKey, reservas.map(r => r.id === id ? { ...r, status: val } : r));
  const clearFilters = () => { setBusca(""); setBuscaCpf(""); setFiltroStatus("todos"); setFiltroTurnos([]); };
  const hasFilters = busca || buscaCpf || filtroStatus !== "todos" || filtroTurnos.length > 0;

  return (
    <>
      <style>{css}</style>
      <div className="res-root">

        {/* Header */}
        <div className="res-header">
          <div>
            <div className="res-eyebrow">Sistema de Gestão · Nexus</div>
            <div className="res-title">Entregadores <span>Reservas</span></div>
            <div className="res-subtitle">{reservas.length} entregador{reservas.length !== 1 ? "es" : ""} cadastrado{reservas.length !== 1 ? "s" : ""}</div>
          </div>
          <button className="btn-add" onClick={() => { setForm(emptyForm); setEditId(null); setShowModal(true); }}>
            <span style={{ fontSize: 20, lineHeight: 1 }}>+</span> Nova Reserva
          </button>
        </div>

        {/* Banner de Estáveis */}
        <div className="res-Estáveis-banner">
          {temEstáveis ? (
            <>
              <span style={{ fontSize: 16 }}>🛵</span>
              <span className="res-Estáveis-banner-text">Lista de Estáveis ativa —</span>
              <span className="res-Estáveis-banner-count">{entregadoresEstáveis.length}</span>
              <span className="res-Estáveis-banner-text">entregadores carregados ·</span>
              <span className="res-Estáveis-banner-count">{totalEstáveis}</span>
              <span className="res-Estáveis-banner-text">reservas coincidem</span>
            </>
          ) : (
            <>
              <span style={{ fontSize: 16 }}>⚠</span>
              <span className="res-estaveis-banner-empty">
                Nenhuma lista de estáveis carregada — acesse a aba ESTÁVEIS DO DIA para subir a lista
              </span>
            </>
          )}
        </div>

        {/* Date bar */}
        <div className="res-datebar">
          <div className="res-dategroup">
            <label className="res-datelabel">Data de Referência</label>
            <input type="date" className="res-dateinput" value={dateKey} onChange={e => handleDateChange(e.target.value)} />
          </div>
          {savedDates.length > 1 && (
            <div className="res-dategroup">
              <label className="res-datelabel">Histórico Salvo</label>
              <select className="res-dateinput" value={dateKey} onChange={e => handleDateChange(e.target.value)}>
                {savedDates.map(d => (
                  <option key={d} value={d}>{formatDatePT(d)}{d === hoje ? " (hoje)" : ""}</option>
                ))}
              </select>
            </div>
          )}
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "flex-end" }}>
            <span className="res-savedbadge">💾 {savedDates.length} {savedDates.length === 1 ? "data salva" : "datas salvas"}</span>
          </div>
        </div>

        {/* Stats */}
        <div className="res-stats">
          {[
            { label: "Total",           value: reservas.length,                              cls: "" },
            { label: "Confirmados",     value: confirmados,                                  cls: "orange" },
            { label: "Não Confirmados", value: naoConfirmados,                               cls: "" },
            { label: "Hoje",            value: reservas.filter(r => r.data === hoje).length, cls: "" },
            { label: "Estáveis",      value: temEstáveis ? totalEstáveis : "—",         cls: "orange" },
          ].map(st => (
            <div className="stat-card" key={st.label}>
              <div className="stat-label">{st.label}</div>
              <div className={`stat-value ${st.cls}`}>{st.value}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="res-filters">
          <div className="filter-group">
            <label>Buscar por nome</label>
            <input className="filter-input" placeholder="Ex: João Silva…" value={busca} onChange={e => setBusca(e.target.value)} />
          </div>
          <div className="filter-group">
            <label>Buscar por CPF</label>
            <input className="filter-input" placeholder="000.000.000-00" value={buscaCpf} onChange={e => setBuscaCpf(e.target.value)} />
          </div>
          <button className="btn-clear" onClick={clearFilters} disabled={!hasFilters} style={{ opacity: hasFilters ? 1 : 0.4 }}>
            LIMPAR ×
          </button>
        </div>

        {/* Status pills */}
        <div className="pills-row">
          {[
            ["todos",          "Todos"],
            ["confirmado",     "✓ Confirmado"],
            ["nao_confirmado", "✗ Não Confirmado"],
          ].map(([val, label]) => (
            <button key={val} className={`pill ${filtroStatus === val ? "active" : ""}`} onClick={() => setFiltroStatus(val)}>
              {label} ({val === "todos" ? reservas.length : reservas.filter(r => r.status === val).length})
            </button>
          ))}
        </div>

        {/* Turno pills */}
        <div className="turno-pills">
          <span className="turno-pills-label">Turnos:</span>
          <button className={`turno-pill todos ${filtroTurnos.length === 0 ? "active" : ""}`} onClick={() => setFiltroTurnos([])}>
            Todos
          </button>
          {TURNOS.map(t => (
            <button key={t} className={`turno-pill ${filtroTurnos.includes(t) ? "active" : ""}`} onClick={() => setFiltroTurnos(prev => toggleArr(prev, t))}>
              {TURNO_ICON[t]} {t}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="res-table-wrap">
          <table className="res-table">
            <thead>
              <tr>
                <th>Nome do Entregador</th>
                <th>CPF</th>
                <th>Data</th>
                <th>Turno(s)</th>
                <th>Status</th>
                <th>Alterar Status</th>
                <th className="col-Estáveis">🛵 Estável do Dia</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div className="empty-row">
                      <span className="empty-icon">🔍</span>
                      Nenhuma reserva encontrada com os filtros aplicados
                    </div>
                  </td>
                </tr>
              ) : filtered.map(r => {
                const conf = isEntregadorEstáveis(r.nome, entregadoresEstáveis);
                return (
                  <tr key={r.id}>
                    <td className="td-nome">{r.nome}</td>
                    <td className="td-cpf">{r.cpf || "—"}</td>
                    <td style={{ color: "var(--muted)", fontSize: 11 }}>{formatDatePT(r.data)}</td>
                    <td>
                      <div className="turno-tags">
                        {(r.turnos || []).map(t => (
                          <span key={t} className="turno-tag">{TURNO_ICON[t]} {t}</span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${r.status === "confirmado" ? "confirmado" : "nao"}`}>
                        <span className="badge-dot" />
                        {r.status === "confirmado" ? "Confirmado" : "Não Confirmado"}
                      </span>
                    </td>
                    <td>
                      <select className="status-select" value={r.status} onChange={e => handleStatusChange(r.id, e.target.value)}>
                        <option value="confirmado">✓ Confirmado</option>
                        <option value="nao_confirmado">✗ Não Confirmado</option>
                      </select>
                    </td>
                    <td>
                      {!temEstáveis ? (
                        <span className="badge-conf nd">— Sem lista</span>
                      ) : conf ? (
                        <span className="badge-conf sim">✓ Estável</span>
                      ) : (
                        <span className="badge-conf nao">✗ Não consta</span>
                      )}
                    </td>
                    <td>
                      <button className="btn-edit" onClick={() => handleEdit(r)}>Editar</button>
                      <button className="btn-del"  onClick={() => handleDelete(r.id)}>Excluir</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="res-footer-count">Exibindo {filtered.length} de {reservas.length} entregadores</div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal-box">
            <div className="modal-header">
              <div className="modal-title">{editId ? "Editar" : "Nova"} <span>Reserva</span></div>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>

            <label className="form-label">Nome do Entregador</label>
            <input className="form-input" placeholder="Ex: João Silva" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} />

            <label className="form-label">CPF</label>
            <input className="form-input" placeholder="000.000.000-00" value={form.cpf} onChange={e => setForm({ ...form, cpf: e.target.value })} />

            <label className="form-label">Data</label>
            <input className="form-input" type="date" value={form.data} onChange={e => setForm({ ...form, data: e.target.value })} />

            <label className="form-label">
              Turno(s) <span style={{ color: "var(--orange)", fontSize: 9 }}>— SELECIONE UM OU MAIS</span>
            </label>
            <div className="turno-grid">
              {TURNOS.map(t => (
                <div key={t} className={`turno-opt ${form.turnos.includes(t) ? "selected" : ""}`}
                  onClick={() => setForm({ ...form, turnos: toggleArr(form.turnos, t) })}>
                  {TURNO_ICON[t]} {t}
                  <span className="check-icon">✓</span>
                </div>
              ))}
            </div>

            <label className="form-label">Status</label>
            <select className="form-input" style={{ cursor: "pointer" }} value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
              <option value="confirmado">✓ Confirmado</option>
              <option value="nao_confirmado">✗ Não Confirmado</option>
            </select>

            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn-save" onClick={handleSave}
                style={{ opacity: (!form.nome.trim() || !form.data || form.turnos.length === 0) ? 0.5 : 1 }}>
                {editId ? "Salvar" : "Adicionar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}