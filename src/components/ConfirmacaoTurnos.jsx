import { useState, useEffect, useMemo } from "react";

// ─── Constantes ───────────────────────────────────────────────────────────────

const TURNOS = ["Almoço", "Tarde", "Jantar", "Ceia"];
const TURNO_ICON  = { "Almoço":"☀️", "Tarde":"🌤️", "Jantar":"🌙", "Ceia":"⭐" };
const TURNO_COLOR = { "Almoço":"#f59e0b", "Tarde":"#10b981", "Jantar":"#6366f1", "Ceia":"#ec4899" };

// ─── Google Sheets ────────────────────────────────────────────────────────────

const SHEETS_URL = "https://docs.google.com/spreadsheets/d/1SSisxQMq-Mex3ry653w2MuN0ndphHVWFrjrzONsJEhc/edit?usp=sharing";

function extrairSheetId(url) {
  const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return m ? m[1] : null;
}
function extrairGid(url) {
  const m = url.match(/[#&?]gid=(\d+)/);
  return m ? m[1] : "0";
}
function parseCsvLine(line) {
  const result = []; let cur = ""; let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { if (inQ && line[i+1] === '"') { cur += '"'; i++; } else inQ = !inQ; }
    else if (ch === ',' && !inQ) { result.push(cur.trim()); cur = ""; }
    else cur += ch;
  }
  result.push(cur.trim());
  return result;
}
function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return [];
  const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase().trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = parseCsvLine(lines[i]);
    if (vals.every(v => !v)) continue;
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = vals[idx] || ""; });
    rows.push(obj);
  }
  return rows;
}
function mapearColunas(headers) {
  const find = (kws) => headers.find(h => kws.some(k => h.includes(k)));
  return {
    nome: find(["nome"]),
    id:   find(["id", "código", "codigo", "courier"]),
  };
}
async function carregarSheets() {
  const sheetId = extrairSheetId(SHEETS_URL);
  if (!sheetId) throw new Error("ID da planilha inválido.");
  const gid = extrairGid(SHEETS_URL);
  const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
  const res = await fetch(csvUrl);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  if (text.includes("<html") || text.includes("signin")) throw new Error("Planilha privada.");
  const rows = parseCsv(text);
  if (!rows.length) return [];
  const headers = Object.keys(rows[0]);
  const mapa = mapearColunas(headers);
  return rows
    .filter(r => (r[mapa.nome] || "").trim().length > 1)
    .map(r => ({
      nome:   (r[mapa.nome] || "").trim(),
      id:     (r[mapa.id]   || "").trim(),
      origem: "sheets",
    }));
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function getDataKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function formatDataDisplay(key) {
  if (!key) return "";
  const [y, m, d] = key.split("-");
  return `${d}/${m}/${y}`;
}
function todayKey() { return getDataKey(new Date()); }

// ─── Storage ──────────────────────────────────────────────────────────────────

const SK_BASE      = "nexus_ct_base";
const SK_DIAS      = "nexus_ct_dias";
const SK_DATES_IDX = "nexus_ct_dates_idx";

function lsGet(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function lsSet(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

const EMPTY_TURNOS = () => ({ "Almoço": [], "Tarde": [], "Jantar": [], "Ceia": [] });

// ─── Helpers ──────────────────────────────────────────────────────────────────

function norm(s = "") {
  return String(s).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[.\-\/\s_()\+]/g,"").toLowerCase().trim();
}

function extrairIdentificadores(texto) {
  const tokens = texto.replace(/[.\-\(\)\s]/g," ").split(/[\n,;|\t]+/).map(t=>t.trim()).filter(Boolean);
  const resultado = [];
  for (const tok of tokens) {
    if (tok.length >= 2) resultado.push({ valor: tok.trim() });
  }
  return [...new Map(resultado.map(r=>[r.valor,r])).values()];
}

function buscarNaBase(identificador, base) {
  const { valor } = identificador;
  const porId   = base.find(e => norm(e.id)   === norm(valor));
  if (porId) return porId;
  const porNome = base.find(e => norm(e.nome) === norm(valor));
  if (porNome) return porNome;
  return null;
}

function statusLabel(s) {
  if (s === "confirmado")    return "Confirmado";
  if (s === "reserva")       return "Reserva";
  return "Não Confirmado";
}

// ─── Export helpers ───────────────────────────────────────────────────────────

function buildExportRows(turnos, turnosSelecionados, incluirStatus) {
  const rows = [];
  for (const turno of turnosSelecionados) {
    const lista = (turnos[turno] || []).filter(e => incluirStatus === "todos" || e.status === incluirStatus);
    for (const e of lista) {
      rows.push({
        Turno:  turno,
        Nome:   e.nome,
        ID:     e.id || "—",
        Status: statusLabel(e.status),
        "Não Encontrado": e.naoEncontrado ? "Sim" : "Não",
      });
    }
  }
  return rows;
}

async function exportarExcel(turnos, turnosSelecionados, incluirStatus, dataKey) {
  const XLSX = window.XLSX;
  if (!XLSX) { alert("Biblioteca XLSX não carregada."); return; }
  const wb = XLSX.utils.book_new();

  const resumoData = [["NEXUS — Relatório de Escala por Turno"], [`Data: ${formatDataDisplay(dataKey)}`], [""]];
  for (const turno of turnosSelecionados) {
    const lista = (turnos[turno] || []).filter(e => incluirStatus === "todos" || e.status === incluirStatus);
    const conf  = lista.filter(e=>e.status==="confirmado").length;
    const nc    = lista.filter(e=>e.status==="nao_confirmado").length;
    const res   = lista.filter(e=>e.status==="reserva").length;
    resumoData.push([`${TURNO_ICON[turno]} ${turno}`, `Total: ${lista.length}`, `Confirmados: ${conf}`, `Não Confirmados: ${nc}`, `Reservas: ${res}`]);
  }
  const wsResumo = XLSX.utils.aoa_to_sheet(resumoData);
  wsResumo["!cols"] = [{ wch:18 },{ wch:14 },{ wch:20 },{ wch:22 },{ wch:14 }];
  XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo");

  const allRows = buildExportRows(turnos, turnosSelecionados, incluirStatus);
  const wsAll = XLSX.utils.json_to_sheet(allRows);
  wsAll["!cols"] = [{ wch:12 },{ wch:36 },{ wch:16 },{ wch:18 },{ wch:16 }];
  XLSX.utils.book_append_sheet(wb, wsAll, "Todos os Turnos");

  for (const turno of turnosSelecionados) {
    const rows = buildExportRows({ [turno]: turnos[turno] }, [turno], incluirStatus);
    if (!rows.length) continue;
    const ws = XLSX.utils.json_to_sheet(rows.map(r=>({ Nome:r.Nome, ID:r.ID, Status:r.Status })));
    ws["!cols"] = [{ wch:36 },{ wch:16 },{ wch:18 }];
    XLSX.utils.book_append_sheet(wb, ws, turno.substring(0,31));
  }

  XLSX.writeFile(wb, `Nexus_Escala_${dataKey}.xlsx`);
}

async function exportarPDF(turnos, turnosSelecionados, incluirStatus, dataKey) {
  const { jsPDF } = window.jspdf;
  if (!jsPDF) { alert("Biblioteca jsPDF não carregada."); return; }

  const doc = new jsPDF({ orientation:"portrait", unit:"mm", format:"a4" });
  const W = 210, margin = 14;
  let y = 0;

  const hexToRgb = (hex) => [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)];

  function addPage() {
    doc.addPage(); y = 18;
    doc.setFillColor(20,20,22); doc.rect(0,0,W,10,"F");
    doc.setFontSize(7); doc.setTextColor(100,100,100);
    doc.text("NEXUS · Confirmação de Turnos", margin, 7);
    doc.text(`Data: ${formatDataDisplay(dataKey)}`, W-margin, 7, { align:"right" });
  }
  function checkPageBreak(needed=10) { if (y+needed>275) addPage(); }

  // Capa
  doc.setFillColor(9,9,11); doc.rect(0,0,W,297,"F");
  doc.setFillColor(249,115,22); doc.rect(0,0,6,297,"F");
  doc.setFontSize(32); doc.setTextColor(235,235,235); doc.setFont("helvetica","bold");
  doc.text("NEXUS", 18, 52);
  doc.setFontSize(14); doc.setTextColor(249,115,22); doc.setFont("helvetica","normal");
  doc.text("CONFIRMAÇÃO POR TURNO", 18, 63);
  doc.setFontSize(10); doc.setTextColor(80,80,90);
  doc.text(`Data de referência: ${formatDataDisplay(dataKey)}`, 18, 74);
  doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, 18, 81);

  const todasListas = turnosSelecionados.flatMap(t=>(turnos[t]||[]).filter(e=>incluirStatus==="todos"||e.status===incluirStatus));
  const stats = [
    { label:"Total Escalados", val:todasListas.length,                                          color:[235,235,235] },
    { label:"Confirmados",     val:todasListas.filter(e=>e.status==="confirmado").length,        color:[72,199,142]  },
    { label:"Não Confirmados", val:todasListas.filter(e=>e.status==="nao_confirmado").length,    color:[249,115,22]  },
    { label:"Reservas",        val:todasListas.filter(e=>e.status==="reserva").length,           color:[96,165,250]  },
  ];
  let sx = 18;
  for (const s of stats) {
    doc.setFillColor(24,24,27); doc.roundedRect(sx,100,42,28,2,2,"F");
    doc.setFontSize(20); doc.setFont("helvetica","bold"); doc.setTextColor(...s.color);
    doc.text(String(s.val), sx+21, 116, { align:"center" });
    doc.setFontSize(7); doc.setFont("helvetica","normal"); doc.setTextColor(80,80,90);
    doc.text(s.label.toUpperCase(), sx+21, 124, { align:"center" });
    sx += 46;
  }

  let ty = 148;
  for (const turno of turnosSelecionados) {
    const lista = (turnos[turno]||[]).filter(e=>incluirStatus==="todos"||e.status===incluirStatus);
    const conf  = lista.filter(e=>e.status==="confirmado").length;
    const res   = lista.filter(e=>e.status==="reserva").length;
    const [r,g,b] = hexToRgb(TURNO_COLOR[turno]||"#f97316");
    doc.setFillColor(r,g,b); doc.rect(18,ty,3,10,"F");
    doc.setFillColor(24,24,27); doc.rect(23,ty,W-37,10,"F");
    doc.setFontSize(10); doc.setFont("helvetica","bold"); doc.setTextColor(235,235,235);
    doc.text(turno, 27, ty+7);
    doc.setFont("helvetica","normal"); doc.setTextColor(80,80,90); doc.setFontSize(8);
    doc.text(`Total: ${lista.length}   ✓ ${conf}   ◈ ${res}`, W-20, ty+7, { align:"right" });
    ty += 13;
  }

  // Páginas por turno
  for (const turno of turnosSelecionados) {
    doc.addPage(); y = 0;
    const [r,g,b] = hexToRgb(TURNO_COLOR[turno]||"#f97316");
    doc.setFillColor(r,g,b); doc.rect(0,0,W,16,"F");
    doc.setFontSize(14); doc.setFont("helvetica","bold"); doc.setTextColor(255,255,255);
    doc.text(turno.toUpperCase(), margin, 11);
    doc.setFontSize(8); doc.setFont("helvetica","normal");
    doc.text(`Data: ${formatDataDisplay(dataKey)}`, W-margin, 11, { align:"right" });
    y = 24;

    const lista     = (turnos[turno]||[]).filter(e=>incluirStatus==="todos"||e.status===incluirStatus);
    const escalados = lista.filter(e=>e.status!=="reserva");
    const reservas  = lista.filter(e=>e.status==="reserva");

    const subStats = [
      { l:"Escalados",   v:escalados.length,                                  c:[235,235,235] },
      { l:"Confirmados", v:escalados.filter(e=>e.status==="confirmado").length, c:[72,199,142]  },
      { l:"Não Conf.",   v:escalados.filter(e=>e.status==="nao_confirmado").length, c:[249,115,22] },
      { l:"Reservas",    v:reservas.length,                                    c:[96,165,250]  },
    ];
    let bx = margin;
    for (const s of subStats) {
      doc.setFillColor(20,20,22); doc.roundedRect(bx,y,40,18,1,1,"F");
      doc.setFontSize(14); doc.setFont("helvetica","bold"); doc.setTextColor(...s.c);
      doc.text(String(s.v), bx+20, y+11, { align:"center" });
      doc.setFontSize(6); doc.setFont("helvetica","normal"); doc.setTextColor(80,80,90);
      doc.text(s.l.toUpperCase(), bx+20, y+17, { align:"center" });
      bx += 44;
    }
    y += 26;

    const drawTable = (rows, title, accentColor) => {
      if (!rows.length) return;
      checkPageBreak(20);
      doc.setFillColor(...accentColor, 30);
      doc.rect(margin, y, W-margin*2, 8, "F");
      doc.setFontSize(8); doc.setFont("helvetica","bold"); doc.setTextColor(...accentColor);
      doc.text(title, margin+3, y+5.5);
      doc.setTextColor(80,80,90);
      doc.text(`${rows.length} entregadores`, W-margin-3, y+5.5, { align:"right" });
      y += 10;

      // cols: #, Nome, ID, Status
      const cols = [
        { h:"#",      w:8,  x:margin       },
        { h:"NOME",   w:110, x:margin+8    },
        { h:"ID",     w:28, x:margin+118   },
        { h:"STATUS", w:32, x:margin+146   },
      ];
      checkPageBreak(8);
      doc.setFillColor(20,20,22); doc.rect(margin,y,W-margin*2,7,"F");
      doc.setFontSize(6.5); doc.setFont("helvetica","bold"); doc.setTextColor(80,80,90);
      for (const c of cols) doc.text(c.h, c.x+1, y+4.8);
      y += 7;

      rows.forEach((e,i) => {
        checkPageBreak(8);
        if (i%2===0) { doc.setFillColor(15,15,17); doc.rect(margin,y,W-margin*2,7,"F"); }
        doc.setFontSize(7.5); doc.setFont("helvetica","normal");
        let sc = [80,80,90];
        if (e.status==="confirmado") sc=[72,199,142];
        else if (e.status==="reserva") sc=[96,165,250];
        else sc=[249,115,22];
        doc.setTextColor(e.naoEncontrado?239:220, e.naoEncontrado?68:220, e.naoEncontrado?68:220);
        doc.text(String(i+1), cols[0].x+1, y+5);
        doc.setTextColor(235,235,235);
        doc.text((e.nome||"—").substring(0,40), cols[1].x+1, y+5);
        doc.setTextColor(140,140,150);
        doc.text((e.id||"—").substring(0,14), cols[2].x+1, y+5);
        doc.setTextColor(...sc);
        doc.text(statusLabel(e.status), cols[3].x+1, y+5);
        y += 7;
      });
      y += 4;
    };

    if (incluirStatus !== "reserva") drawTable(escalados, "ESCALADOS", hexToRgb(TURNO_COLOR[turno]||"#f97316"));
    if (incluirStatus !== "confirmado" && incluirStatus !== "nao_confirmado") drawTable(reservas, "RESERVAS", [96,165,250]);
  }

  const pageCount = doc.getNumberOfPages();
  for (let p=1; p<=pageCount; p++) {
    doc.setPage(p);
    doc.setFillColor(14,14,16); doc.rect(0,290,W,7,"F");
    doc.setFontSize(6); doc.setFont("helvetica","normal"); doc.setTextColor(60,60,70);
    doc.text("NEXUS · Sistema de Gestão de Entregas", margin, 295);
    doc.text(`Pág. ${p} / ${pageCount}`, W-margin, 295, { align:"right" });
  }

  doc.save(`Nexus_Escala_${dataKey}.pdf`);
}

// ─── CSS ──────────────────────────────────────────────────────────────────────

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Bebas+Neue&family=IBM+Plex+Mono:wght@400;500&display=swap');
  :root {
    --orange:#f97316; --orange-glow:rgba(249,115,22,0.12); --orange-border:rgba(249,115,22,0.35);
    --bg:#09090b; --surface:#111113; --surface2:#18181b; --surface3:#1f1f22;
    --line:#27272a; --text:#ebebeb; --muted:#555560;
    --green:#48c78e; --green-bg:rgba(72,199,142,0.08); --green-border:rgba(72,199,142,0.2);
    --red:#ef4444; --red-bg:rgba(239,68,68,0.08); --red-border:rgba(239,68,68,0.2);
    --blue:#60a5fa; --blue-bg:rgba(96,165,250,0.08); --blue-border:rgba(96,165,250,0.25);
    --purple:#a78bfa; --purple-bg:rgba(167,139,250,0.08); --purple-border:rgba(167,139,250,0.25);
  }
  *{box-sizing:border-box;margin:0;padding:0;}
  .ct-root{background:var(--bg);min-height:100vh;padding:28px 32px;font-family:'IBM Plex Mono',monospace;color:var(--text);}

  .ct-header{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:24px;border-bottom:1px solid var(--line);padding-bottom:20px;flex-wrap:wrap;gap:14px;}
  .ct-eyebrow{font-size:10px;letter-spacing:3px;color:var(--orange);text-transform:uppercase;margin-bottom:6px;}
  .ct-title{font-family:'Bebas Neue',sans-serif;font-size:36px;letter-spacing:3px;color:var(--text);line-height:1;}
  .ct-title span{color:var(--orange);}
  .ct-subtitle{margin-top:6px;font-size:10px;color:var(--muted);letter-spacing:1.5px;text-transform:uppercase;}

  .ct-sync-status{display:flex;align-items:center;gap:8px;font-size:10px;letter-spacing:1px;}
  .ct-sync-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0;}
  .ct-sync-dot.ok{background:var(--green);}
  .ct-sync-dot.loading{background:var(--orange);animation:pulse 1s infinite;}
  .ct-sync-dot.err{background:var(--red);}
  @keyframes pulse{0%,100%{opacity:1;}50%{opacity:0.3;}}
  .ct-sync-label{color:var(--muted);}
  .ct-sync-label.ok{color:var(--green);}
  .ct-sync-label.err{color:var(--red);}
  .ct-sync-label.loading{color:var(--orange);}
  .ct-sync-btn{background:transparent;border:1px solid var(--line);color:var(--muted);padding:6px 12px;font-family:'Bebas Neue',sans-serif;font-size:12px;letter-spacing:1.5px;cursor:pointer;transition:all 0.2s;}
  .ct-sync-btn:hover:not(:disabled){border-color:var(--green-border);color:var(--green);}
  .ct-sync-btn:disabled{opacity:0.4;cursor:not-allowed;}

  .ct-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:22px;}
  .ct-stat{background:var(--surface);border:1px solid var(--line);border-left:3px solid var(--orange);padding:12px 16px;}
  .ct-stat-label{font-size:9px;letter-spacing:2px;text-transform:uppercase;color:var(--muted);margin-bottom:6px;}
  .ct-stat-val{font-family:'Bebas Neue',sans-serif;font-size:26px;color:var(--text);line-height:1;}
  .ct-stat-val.green{color:var(--green);} .ct-stat-val.orange{color:var(--orange);} .ct-stat-val.blue{color:var(--blue);}

  .ct-tabs{display:flex;border-bottom:2px solid var(--line);margin-bottom:24px;}
  .ct-tab-btn{position:relative;padding:10px 24px;font-family:'Bebas Neue',sans-serif;font-size:14px;letter-spacing:2px;color:var(--muted);background:transparent;border:none;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-2px;transition:all 0.2s;display:flex;align-items:center;gap:7px;}
  .ct-tab-btn:hover{color:var(--text);} .ct-tab-btn.active{color:var(--orange);border-bottom-color:var(--orange);}
  .ct-tab-badge{font-family:'IBM Plex Mono',monospace;font-size:10px;background:var(--orange-glow);color:var(--orange);border-radius:10px;padding:1px 7px;}

  .ct-date-bar{display:flex;align-items:flex-end;gap:20px;margin-bottom:20px;flex-wrap:wrap;}
  .ct-date-lbl{font-size:9px;letter-spacing:3px;text-transform:uppercase;color:var(--muted);margin-bottom:8px;}
  .ct-date-field{display:flex;flex-direction:column;}
  .ct-date-native{background:var(--surface2);border:1px solid var(--line);color:var(--text);padding:10px 13px;font-family:'IBM Plex Mono',monospace;font-size:13px;outline:none;cursor:pointer;transition:border-color 0.2s;min-width:170px;color-scheme:dark;}
  .ct-date-native:focus{border-color:var(--orange-border);}
  .ct-hist-field{display:flex;flex-direction:column;flex:1;min-width:220px;}
  .ct-hist-select{background:var(--surface2);border:1px solid var(--line);color:var(--text);padding:10px 13px;font-family:'IBM Plex Mono',monospace;font-size:13px;outline:none;cursor:pointer;transition:border-color 0.2s;width:100%;}
  .ct-hist-select:focus{border-color:var(--orange-border);}
  .ct-date-saved-count{margin-left:auto;display:flex;align-items:flex-end;padding-bottom:1px;}
  .ct-saved-badge{display:flex;align-items:center;gap:7px;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);white-space:nowrap;}
  .ct-saved-badge span{color:var(--orange);}
  .ct-date-chip{background:var(--orange-glow);border:1px solid var(--orange-border);color:var(--orange);padding:4px 10px;font-size:10px;letter-spacing:1px;font-family:'Bebas Neue',sans-serif;}

  .ct-export-btn{background:var(--purple-bg);border:1px solid var(--purple-border);color:var(--purple);padding:7px 16px;font-family:'Bebas Neue',sans-serif;font-size:13px;letter-spacing:1.5px;cursor:pointer;transition:all 0.2s;display:flex;align-items:center;gap:7px;white-space:nowrap;}
  .ct-export-btn:hover{background:var(--purple);color:#000;}
  .ct-export-modal{background:var(--surface);border:1px solid var(--purple-border);padding:32px;width:520px;max-width:96vw;animation:slideUp 0.2s ease;}
  .ct-export-section{margin-bottom:20px;}
  .ct-export-section-title{font-size:9px;letter-spacing:2px;text-transform:uppercase;color:var(--muted);margin-bottom:10px;}
  .ct-export-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
  .ct-export-card{background:var(--surface2);border:1px solid var(--line);padding:16px;cursor:pointer;transition:all 0.2s;display:flex;flex-direction:column;gap:8px;}
  .ct-export-card:hover{border-color:var(--purple-border);}
  .ct-export-card.selected{border-color:var(--purple);background:var(--purple-bg);}
  .ct-export-card-icon{font-size:22px;}
  .ct-export-card-label{font-family:'Bebas Neue',sans-serif;font-size:15px;letter-spacing:1.5px;color:var(--text);}
  .ct-export-card-desc{font-size:10px;color:var(--muted);line-height:1.5;}
  .ct-checkrow{display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--line);cursor:pointer;}
  .ct-checkrow:last-child{border-bottom:none;}
  .ct-checkrow input[type=checkbox]{accent-color:var(--purple);width:14px;height:14px;cursor:pointer;}
  .ct-checkrow-label{font-size:12px;color:var(--text);flex:1;}
  .ct-checkrow-count{font-size:10px;color:var(--muted);}
  .ct-export-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:6px;}
  .ct-export-run-btn{background:var(--purple);color:#000;border:none;padding:10px 24px;font-family:'Bebas Neue',sans-serif;font-size:15px;letter-spacing:2px;cursor:pointer;transition:all 0.2s;display:flex;align-items:center;gap:8px;}
  .ct-export-run-btn:hover{background:#c4b5fd;}
  .ct-export-run-btn:disabled{opacity:0.4;cursor:not-allowed;}
  .ct-fsel-export{background:var(--surface2);border:1px solid var(--line);color:var(--text);padding:8px 12px;font-family:'IBM Plex Mono',monospace;font-size:12px;outline:none;cursor:pointer;width:100%;}

  .ct-cadastro-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px;}
  .ct-cadastro-title{font-family:'Bebas Neue',sans-serif;font-size:16px;letter-spacing:2px;color:var(--orange);}
  .ct-novo-btn{background:var(--orange);color:#000;border:none;padding:9px 20px;font-family:'Bebas Neue',sans-serif;font-size:14px;letter-spacing:2px;cursor:pointer;transition:all 0.2s;display:flex;align-items:center;gap:8px;}
  .ct-novo-btn:hover{background:#fb923c;}

  .ct-modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;z-index:1000;backdrop-filter:blur(4px);}
  .ct-modal{background:var(--surface);border:1px solid var(--orange-border);padding:32px;width:420px;max-width:95vw;animation:slideUp 0.2s ease;}
  @keyframes slideUp{from{opacity:0;transform:translateY(14px);}to{opacity:1;transform:translateY(0);}}
  .ct-modal-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;}
  .ct-modal-title{font-family:'Bebas Neue',sans-serif;font-size:20px;letter-spacing:2px;color:var(--text);}
  .ct-modal-title span{color:var(--orange);}
  .ct-modal-close{background:var(--surface2);border:1px solid var(--line);color:var(--muted);width:28px;height:28px;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:14px;transition:all 0.18s;}
  .ct-modal-close:hover{border-color:var(--orange);color:var(--orange);}
  .ct-form-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;}
  .ct-form-row.full{grid-template-columns:1fr;}
  .ct-label{display:block;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:var(--muted);margin-bottom:7px;}
  .ct-input{width:100%;background:var(--surface2);border:1px solid var(--line);color:var(--text);padding:10px 13px;font-family:'IBM Plex Mono',monospace;font-size:12px;outline:none;transition:border-color 0.2s;}
  .ct-input:focus{border-color:var(--orange-border);} .ct-input::placeholder{color:#3a3a3a;}
  .ct-modal-footer{display:flex;justify-content:flex-end;gap:10px;margin-top:6px;}
  .ct-btn-cancel{background:transparent;border:1px solid var(--line);color:var(--muted);padding:9px 18px;font-family:'IBM Plex Mono',monospace;font-size:11px;cursor:pointer;letter-spacing:1px;transition:all 0.18s;}
  .ct-btn-cancel:hover{border-color:var(--orange);color:var(--orange);}
  .ct-btn-save{background:var(--orange);color:#000;border:none;padding:9px 22px;font-family:'Bebas Neue',sans-serif;font-size:15px;letter-spacing:2px;cursor:pointer;transition:all 0.2s;}
  .ct-btn-save:hover{background:#fb923c;}

  .ct-search-bar{display:flex;gap:8px;margin-bottom:12px;align-items:center;}
  .ct-search-input{flex:1;background:var(--surface2);border:1px solid var(--line);color:var(--text);padding:9px 13px;font-family:'IBM Plex Mono',monospace;font-size:12px;outline:none;transition:border-color 0.2s;}
  .ct-search-input:focus{border-color:var(--orange-border);} .ct-search-input::placeholder{color:#3a3a3a;}
  .ct-count-badge{font-size:10px;color:var(--muted);letter-spacing:1px;white-space:nowrap;}
  .ct-ghost-btn{background:transparent;border:1px solid var(--line);color:var(--muted);padding:8px 13px;font-family:'IBM Plex Mono',monospace;font-size:11px;cursor:pointer;letter-spacing:1px;transition:all 0.2s;white-space:nowrap;}
  .ct-ghost-btn:hover{border-color:var(--orange);color:var(--orange);}

  .ct-table-wrap{background:var(--surface);border:1px solid var(--line);overflow-x:auto;margin-bottom:4px;}
  .ct-table{width:100%;border-collapse:collapse;}
  .ct-table thead{background:var(--surface2);border-bottom:2px solid var(--line);}
  .ct-table th{padding:10px 14px;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:var(--muted);text-align:left;font-family:'IBM Plex Mono',monospace;font-weight:500;white-space:nowrap;}
  .ct-table td{padding:10px 14px;font-size:12px;border-bottom:1px solid #1a1a1d;color:var(--text);vertical-align:middle;}
  .ct-table tbody tr:hover td{background:var(--surface2);}
  .ct-table tbody tr:last-child td{border-bottom:none;}
  .ct-empty-row{text-align:center;padding:48px 20px;color:var(--muted);font-size:11px;letter-spacing:1px;text-transform:uppercase;}

  .td-nome{font-family:'Inter',sans-serif;font-size:13px;font-weight:600;color:#fff;letter-spacing:0.2px;}
  .td-mono{font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--muted);}

  .act-btn{background:transparent;border:1px solid var(--line);color:var(--muted);padding:4px 10px;font-size:10px;font-family:'IBM Plex Mono',monospace;cursor:pointer;transition:all 0.18s;margin-right:5px;letter-spacing:0.5px;}
  .act-btn:hover{border-color:var(--orange);color:var(--orange);}
  .act-btn.del:hover{border-color:var(--red);color:var(--red);}

  .ct-filters{background:var(--surface);border:1px solid var(--line);padding:14px 18px;margin-bottom:20px;display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap;}
  .ct-fg{display:flex;flex-direction:column;gap:6px;}
  .ct-fl{font-size:9px;letter-spacing:2px;text-transform:uppercase;color:var(--muted);}
  .ct-fi{background:var(--surface2);border:1px solid var(--line);color:var(--text);padding:8px 12px;font-family:'IBM Plex Mono',monospace;font-size:12px;outline:none;transition:border-color 0.2s;min-width:190px;}
  .ct-fi:focus{border-color:var(--orange-border);} .ct-fi::placeholder{color:#3a3a3a;}
  .ct-fsel{background:var(--surface2);border:1px solid var(--line);color:var(--text);padding:8px 12px;font-family:'IBM Plex Mono',monospace;font-size:12px;outline:none;cursor:pointer;min-width:160px;}
  .ct-pills{display:flex;gap:6px;flex-wrap:wrap;}
  .ct-pill{padding:5px 12px;font-family:'Bebas Neue',sans-serif;font-size:12px;letter-spacing:1.5px;cursor:pointer;border:1px solid var(--line);background:var(--surface2);color:var(--muted);transition:all 0.18s;display:flex;align-items:center;gap:4px;user-select:none;}
  .ct-pill:hover{border-color:var(--orange-border);color:var(--text);}
  .ct-pill.active{background:var(--orange);border-color:var(--orange);color:#000;}
  .ct-clear-btn{background:transparent;border:1px solid var(--line);color:var(--muted);padding:8px 13px;font-family:'IBM Plex Mono',monospace;font-size:11px;cursor:pointer;letter-spacing:1px;transition:all 0.2s;align-self:flex-end;}
  .ct-clear-btn:hover{border-color:var(--orange);color:var(--orange);}

  .ct-section-title{font-family:'Bebas Neue',sans-serif;font-size:17px;letter-spacing:2px;color:var(--text);margin-bottom:12px;}
  .ct-section-title span{color:var(--orange);}
  .ct-divider{border:none;border-top:1px solid var(--line);margin:24px 0;}

  .ct-turnos{display:grid;grid-template-columns:repeat(2,1fr);gap:18px;}
  @media(max-width:900px){.ct-turnos{grid-template-columns:1fr;}}

  .ct-turno-card{background:var(--surface);border:1px solid var(--line);overflow:hidden;}
  .ct-turno-header{background:var(--surface2);border-bottom:1px solid var(--line);padding:12px 18px;display:flex;justify-content:space-between;align-items:center;}
  .ct-turno-name{font-family:'Bebas Neue',sans-serif;font-size:20px;letter-spacing:2px;color:var(--text);display:flex;align-items:center;gap:8px;}
  .ct-turno-counts{display:flex;align-items:center;gap:10px;font-size:10px;letter-spacing:1px;}

  .ct-paste-area{padding:12px 16px;border-bottom:1px solid var(--line);display:flex;gap:8px;align-items:flex-start;}
  .ct-paste-input{flex:1;background:var(--surface2);border:1px solid var(--line);color:var(--text);padding:8px 12px;font-family:'IBM Plex Mono',monospace;font-size:11px;outline:none;resize:none;min-height:56px;transition:border-color 0.2s;}
  .ct-paste-input:focus{border-color:var(--orange-border);} .ct-paste-input::placeholder{color:#3a3a3a;}
  .ct-paste-btn{background:var(--orange);color:#000;border:none;padding:8px 14px;font-family:'Bebas Neue',sans-serif;font-size:13px;letter-spacing:1px;cursor:pointer;transition:background 0.2s;white-space:nowrap;align-self:flex-end;}
  .ct-paste-btn:hover{background:#fb923c;}

  .ct-section-lbl{font-size:9px;letter-spacing:2px;text-transform:uppercase;color:var(--muted);padding:7px 14px;background:var(--surface2);border-bottom:1px solid var(--line);}

  .ct-turno-table{width:100%;border-collapse:collapse;}
  .ct-turno-table th{padding:7px 12px;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:var(--muted);text-align:left;background:var(--surface2);border-bottom:1px solid var(--line);font-family:'IBM Plex Mono',monospace;font-weight:500;white-space:nowrap;}
  .ct-turno-table td{padding:8px 12px;font-size:11px;border-bottom:1px solid #1a1a1d;color:var(--text);vertical-align:middle;}
  .ct-turno-table tbody tr:hover td{background:var(--surface2);}
  .ct-turno-table tbody tr:last-child td{border-bottom:none;}

  .nome-cell{font-family:'Inter',sans-serif;font-size:13px;font-weight:600;color:#fff;}
  .nome-sub{font-size:9px;color:var(--red);letter-spacing:1px;margin-top:1px;}

  .status-sel{background:var(--surface3);border:1px solid var(--line);color:var(--text);padding:4px 8px;font-size:10px;font-family:'IBM Plex Mono',monospace;cursor:pointer;outline:none;}
  .status-sel.confirmado{background:var(--green-bg);color:var(--green);border-color:var(--green-border);}
  .status-sel.nao_confirmado{background:var(--orange-glow);color:var(--orange);border-color:var(--orange-border);}
  .status-sel.reserva{background:var(--blue-bg);color:var(--blue);border-color:var(--blue-border);}

  .ct-rem-btn{background:transparent;border:none;color:#3a3a3a;cursor:pointer;font-size:14px;transition:color 0.18s;padding:0 3px;}
  .ct-rem-btn:hover{color:var(--red);}
  .ct-empty-turno{padding:22px;text-align:center;color:var(--muted);font-size:10px;letter-spacing:1px;text-transform:uppercase;}
  .ct-erro{background:#1a0a0a;border:1px solid rgba(239,68,68,0.3);color:#ef4444;padding:10px 16px;font-size:11px;letter-spacing:0.5px;margin-bottom:14px;}

  .ct-reserva-wrap{border-top:2px dashed var(--blue-border);}
  .ct-reserva-lbl{font-size:9px;letter-spacing:2px;text-transform:uppercase;color:var(--blue);padding:7px 14px;background:var(--blue-bg);border-bottom:1px solid var(--blue-border);display:flex;align-items:center;gap:6px;}
  .ct-add-reserva{display:flex;gap:8px;padding:10px 14px;background:var(--surface);border-top:1px solid var(--line);align-items:center;flex-wrap:wrap;}
  .ct-add-reserva input{background:var(--surface2);border:1px solid var(--line);color:var(--text);padding:6px 10px;font-family:'IBM Plex Mono',monospace;font-size:11px;outline:none;transition:border-color 0.2s;flex:1;min-width:120px;}
  .ct-add-reserva input:focus{border-color:var(--blue-border);}
  .ct-add-reserva input::placeholder{color:#3a3a3a;}
  .ct-add-reserva-btn{background:var(--blue-bg);border:1px solid var(--blue-border);color:var(--blue);padding:6px 14px;font-family:'Bebas Neue',sans-serif;font-size:12px;letter-spacing:1px;cursor:pointer;transition:all 0.2s;white-space:nowrap;}
  .ct-add-reserva-btn:hover{background:var(--blue);color:#000;}

  .ct-readonly-banner{background:var(--blue-bg);border:1px solid var(--blue-border);color:var(--blue);padding:10px 16px;font-size:11px;letter-spacing:0.5px;margin-bottom:14px;display:flex;align-items:center;gap:8px;}
`;

const emptyForm = { nome:"", id:"" };

// ─── Inject CDN libs ───────────────────────────────────────────────────────────
function useCDNLibs() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let loaded = 0;
    const check = () => { if (++loaded >= 2) setReady(true); };
    if (!window.XLSX) {
      const s1 = document.createElement("script");
      s1.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
      s1.onload = check; document.head.appendChild(s1);
    } else check();
    if (!window.jspdf) {
      const s2 = document.createElement("script");
      s2.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
      s2.onload = check; document.head.appendChild(s2);
    } else check();
  }, []);
  return ready;
}

// ─── Export Modal ─────────────────────────────────────────────────────────────

function ExportModal({ onClose, turnos, dataKey }) {
  const [formato,      setFormato]      = useState("excel");
  const [turnosSel,    setTurnosSel]    = useState(TURNOS);
  const [filterStatus, setFilterStatus] = useState("todos");
  const [exporting,    setExporting]    = useState(false);

  const toggleTurno = (t) => setTurnosSel(prev => prev.includes(t) ? prev.filter(x=>x!==t) : [...prev,t]);

  async function doExport() {
    if (!turnosSel.length) return;
    setExporting(true);
    try {
      if (formato === "excel") await exportarExcel(turnos, turnosSel, filterStatus, dataKey);
      else                     await exportarPDF(turnos, turnosSel, filterStatus, dataKey);
    } catch(e) {
      alert("Erro ao exportar: " + e.message);
    } finally { setExporting(false); }
  }

  const totalLinhas = turnosSel.reduce((acc,t) => {
    return acc + (turnos[t]||[]).filter(e=>filterStatus==="todos"||e.status===filterStatus).length;
  }, 0);

  return (
    <div className="ct-modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="ct-export-modal">
        <div className="ct-modal-header">
          <div className="ct-modal-title" style={{color:"var(--purple)"}}>↓ Exportar <span style={{color:"var(--text)"}}>Escala</span></div>
          <button className="ct-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="ct-export-section">
          <div className="ct-export-section-title">Formato</div>
          <div className="ct-export-grid">
            <div className={`ct-export-card ${formato==="excel"?"selected":""}`} onClick={()=>setFormato("excel")}>
              <div className="ct-export-card-icon">📊</div>
              <div className="ct-export-card-label">Excel (.xlsx)</div>
              <div className="ct-export-card-desc">Planilha com abas por turno + resumo.</div>
            </div>
            <div className={`ct-export-card ${formato==="pdf"?"selected":""}`} onClick={()=>setFormato("pdf")}>
              <div className="ct-export-card-icon">📄</div>
              <div className="ct-export-card-label">PDF Profissional</div>
              <div className="ct-export-card-desc">Relatório formatado com capa e tabelas por turno.</div>
            </div>
          </div>
        </div>

        <div className="ct-export-section">
          <div className="ct-export-section-title">Turnos a incluir</div>
          <div style={{background:"var(--surface2)",border:"1px solid var(--line)",padding:"4px 12px"}}>
            <div className="ct-checkrow" onClick={()=>setTurnosSel(turnosSel.length===TURNOS.length?[]:[...TURNOS])}>
              <input type="checkbox" readOnly checked={turnosSel.length===TURNOS.length} />
              <span className="ct-checkrow-label" style={{fontFamily:"'Bebas Neue',sans-serif",letterSpacing:"1px"}}>Todos os Turnos</span>
            </div>
            {TURNOS.map(t => {
              const n = (turnos[t]||[]).filter(e=>filterStatus==="todos"||e.status===filterStatus).length;
              return (
                <div key={t} className="ct-checkrow" onClick={()=>toggleTurno(t)}>
                  <input type="checkbox" readOnly checked={turnosSel.includes(t)} />
                  <span className="ct-checkrow-label">{TURNO_ICON[t]} {t}</span>
                  <span className="ct-checkrow-count">{n} entregadores</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="ct-export-section">
          <div className="ct-export-section-title">Filtrar por status</div>
          <select className="ct-fsel-export" value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
            <option value="todos">Todos os Status</option>
            <option value="confirmado">✓ Apenas Confirmados</option>
            <option value="nao_confirmado">✗ Apenas Não Confirmados</option>
            <option value="reserva">◈ Apenas Reservas</option>
          </select>
        </div>

        <div style={{background:"var(--surface2)",border:"1px solid var(--line)",padding:"10px 14px",marginBottom:20,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontSize:10,color:"var(--muted)",letterSpacing:"1px",textTransform:"uppercase"}}>Total de linhas no arquivo</span>
          <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,color:"var(--purple)"}}>{totalLinhas}</span>
        </div>

        <div className="ct-export-actions">
          <button className="ct-btn-cancel" onClick={onClose}>Cancelar</button>
          <button className="ct-export-run-btn" onClick={doExport} disabled={exporting||!turnosSel.length}>
            {exporting ? "⏳ Gerando…" : `↓ Baixar ${formato==="excel"?"Excel":"PDF"}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Componente Principal ─────────────────────────────────────────────────────

export default function ConfirmacaoTurnos() {
  const libsReady = useCDNLibs();

  const [base,      setBase]      = useState(() => lsGet(SK_BASE, []));
  const [dias,      setDias]      = useState(() => lsGet(SK_DIAS, {}));
  const [datesIdx,  setDatesIdx]  = useState(() => lsGet(SK_DATES_IDX, []));
  const [dataAtiva, setDataAtiva] = useState(() => todayKey());

  useEffect(() => {
    const hoje = todayKey();
    setDatesIdx(prev => {
      if (prev.includes(hoje)) return prev;
      const novo = [...prev, hoje].sort((a,b)=>b.localeCompare(a));
      lsSet(SK_DATES_IDX, novo); return novo;
    });
    setDias(prev => {
      if (prev[hoje]) return prev;
      const novo = { ...prev, [hoje]: EMPTY_TURNOS() };
      lsSet(SK_DIAS, novo); return novo;
    });
  }, []);

  const turnos = useMemo(() => dias[dataAtiva] || EMPTY_TURNOS(), [dias, dataAtiva]);

  function setTurnos(updater) {
    setDias(prev => {
      const atual = prev[dataAtiva] || EMPTY_TURNOS();
      const novo  = typeof updater === "function" ? updater(atual) : updater;
      const novoDias = { ...prev, [dataAtiva]: novo };
      lsSet(SK_DIAS, novoDias); return novoDias;
    });
  }

  useEffect(() => { lsSet(SK_BASE, base); }, [base]);

  // UI state
  const [abaAtiva,    setAbaAtiva]    = useState("escala");
  const [showModal,   setShowModal]   = useState(false);
  const [showExport,  setShowExport]  = useState(false);
  const [editId,      setEditId]      = useState(null);
  const [form,        setForm]        = useState(emptyForm);
  const [formErro,    setFormErro]    = useState("");
  const [baseSearch,  setBaseSearch]  = useState("");
  const [pasteText,   setPasteText]   = useState({ "Almoço":"","Tarde":"","Jantar":"","Ceia":"" });
  const [reservaForm, setReservaForm] = useState({ "Almoço":"","Tarde":"","Jantar":"","Ceia":"" });
  const [erro,        setErro]        = useState("");
  const [fTexto,      setFTexto]      = useState("");
  const [fTurno,      setFTurno]      = useState("todos");
  const [fStatus,     setFStatus]     = useState("todos");
  const [syncStatus,  setSyncStatus]  = useState("idle");
  const [syncMsg,     setSyncMsg]     = useState("");
  const [syncing,     setSyncing]     = useState(false);

  useEffect(() => { sincronizarSheets(); }, []);

  async function sincronizarSheets() {
    setSyncing(true); setSyncStatus("loading"); setSyncMsg("Sincronizando…");
    try {
      const rows = await carregarSheets();
      if (!rows.length) { setSyncStatus("err"); setSyncMsg("Planilha vazia."); setSyncing(false); return; }
      setBase(prev => {
        const resultado = [...prev];
        for (const r of rows) {
          const idx = resultado.findIndex(e => r.id && norm(e.id) === norm(r.id) && r.id.length > 1);
          if (idx >= 0) resultado[idx] = { ...resultado[idx], ...r };
          else resultado.push({ _id: Date.now() + Math.random(), ...r });
        }
        return resultado;
      });
      setSyncStatus("ok"); setSyncMsg(`${rows.length} na base`);
    } catch(e) {
      setSyncStatus("err"); setSyncMsg(e.message || "Erro ao sincronizar.");
    } finally { setSyncing(false); }
  }

  function criarNovoDia(key) {
    if (!key) return;
    setDatesIdx(prev => {
      if (prev.includes(key)) return prev;
      const novo = [...prev, key].sort((a,b)=>b.localeCompare(a));
      lsSet(SK_DATES_IDX, novo); return novo;
    });
    setDias(prev => {
      if (prev[key]) return prev;
      const novo = { ...prev, [key]: EMPTY_TURNOS() };
      lsSet(SK_DIAS, novo); return novo;
    });
    setDataAtiva(key);
  }

  const baseFiltrada = useMemo(() => {
    if (!baseSearch) return base;
    const q = norm(baseSearch);
    return base.filter(e => norm(e.nome).includes(q) || norm(e.id).includes(q));
  }, [base, baseSearch]);

  function abrirNovo()    { setForm(emptyForm); setEditId(null); setFormErro(""); setShowModal(true); }
  function abrirEditar(e) { setForm({ nome:e.nome, id:e.id||"" }); setEditId(e._id); setFormErro(""); setShowModal(true); }

  function salvarForm() {
    if (!form.nome.trim()) { setFormErro("Nome é obrigatório."); return; }
    if (editId === null) {
      setBase(prev => [...prev, { _id:Date.now(), nome:form.nome.trim(), id:form.id.trim(), origem:"manual" }]);
    } else {
      setBase(prev => prev.map(e => e._id === editId ? { ...e, nome:form.nome.trim(), id:form.id.trim() } : e));
    }
    setShowModal(false); setForm(emptyForm); setEditId(null); setFormErro("");
  }

  function excluirBase(_id) {
    if (!window.confirm("Excluir este entregador da base?")) return;
    setBase(prev => prev.filter(e => e._id !== _id));
  }

  const isReadOnly = dataAtiva !== todayKey();

  function processarCpfs(turno) {
    if (isReadOnly) return;
    const ids = extrairIdentificadores(pasteText[turno] || "");
    if (!ids.length) { setErro("Nenhum identificador reconhecido."); return; }
    setErro("");
    const jaNoTurno = new Set((turnos[turno]||[]).map(e => e._key));
    const novos = [];
    for (const id of ids) {
      const found = buscarNaBase(id, base);
      const key   = found ? (norm(found.id) || norm(found.nome) || id.valor) : id.valor;
      if (jaNoTurno.has(key)) continue;
      jaNoTurno.add(key);
      novos.push({ _key:key, nome:found?found.nome:"—", id:found?found.id:"", status:"nao_confirmado", naoEncontrado:!found });
    }
    if (!novos.length) { setErro("Todos já estão neste turno."); return; }
    setTurnos(prev => ({ ...prev, [turno]: [...(prev[turno]||[]), ...novos] }));
    setPasteText(prev => ({ ...prev, [turno]:"" }));
  }

  function adicionarReserva(turno) {
    if (isReadOnly) return;
    const ids = extrairIdentificadores(reservaForm[turno] || "");
    if (!ids.length) { setErro("Nenhum identificador para reserva."); return; }
    setErro("");
    const jaNoTurno = new Set((turnos[turno]||[]).map(e => e._key));
    const novos = [];
    for (const id of ids) {
      const found = buscarNaBase(id, base);
      const key   = found ? (norm(found.id) || norm(found.nome) || id.valor) : id.valor;
      if (jaNoTurno.has(key)) continue;
      jaNoTurno.add(key);
      novos.push({ _key:key, nome:found?found.nome:"—", id:found?found.id:"", status:"reserva", naoEncontrado:!found });
    }
    if (!novos.length) { setErro("Identificadores já estão neste turno."); return; }
    setTurnos(prev => ({ ...prev, [turno]: [...(prev[turno]||[]), ...novos] }));
    setReservaForm(prev => ({ ...prev, [turno]:"" }));
  }

  function removerDoTurno(turno, key) {
    if (isReadOnly) return;
    setTurnos(prev => ({ ...prev, [turno]: prev[turno].filter(e => e._key !== key) }));
  }
  function alterarStatus(turno, key, status) {
    if (isReadOnly) return;
    setTurnos(prev => ({ ...prev, [turno]: prev[turno].map(e => e._key === key ? { ...e, status } : e) }));
  }

  const resultadoFiltrado = useMemo(() => {
    const linhas = [];
    const tt = fTurno === "todos" ? TURNOS : [fTurno];
    for (const turno of tt) {
      for (const e of (turnos[turno]||[])) {
        if (fStatus !== "todos" && e.status !== fStatus) continue;
        if (fTexto) { const q = norm(fTexto); if (!norm(e.nome).includes(q) && !norm(e.id).includes(q) && !norm(turno).includes(q)) continue; }
        linhas.push({ ...e, turno });
      }
    }
    return linhas;
  }, [turnos, fTexto, fTurno, fStatus]);

  const temFiltro = fTexto || fTurno !== "todos" || fStatus !== "todos";
  const todas     = TURNOS.flatMap(t => (turnos[t]||[]).map(e => ({ ...e, turno:t })));
  const totalConf = todas.filter(e => e.status === "confirmado").length;
  const totalNao  = todas.filter(e => e.status === "nao_confirmado").length;
  const totalRes  = todas.filter(e => e.status === "reserva").length;
  const hoje      = todayKey();

  const TurnoRow = ({ e, turno, showTurno=false }) => (
    <tr>
      <td>
        <div className="nome-cell" style={{color:e.naoEncontrado?"var(--red)":"#fff"}}>{e.nome}</div>
        {e.naoEncontrado && <div className="nome-sub">NÃO NA BASE</div>}
      </td>
      <td className="td-mono">{e.id||"—"}</td>
      {showTurno && <td style={{fontSize:12}}>{TURNO_ICON[e.turno]} {e.turno}</td>}
      <td>
        <select className={`status-sel ${e.status}`} value={e.status}
          onChange={ev=>alterarStatus(turno||e.turno, e._key, ev.target.value)}
          disabled={isReadOnly}>
          <option value="confirmado">✓ Confirmado</option>
          <option value="nao_confirmado">✗ Não Confirmado</option>
          <option value="reserva">◈ Reserva</option>
        </select>
      </td>
      <td>
        {!isReadOnly && <button className="ct-rem-btn" onClick={()=>removerDoTurno(turno||e.turno, e._key)}>×</button>}
      </td>
    </tr>
  );

  return (
    <>
      <style>{css}</style>
      <div className="ct-root">

        {/* HEADER */}
        <div className="ct-header">
          <div>
            <div className="ct-eyebrow">Sistema de Gestão · Nexus</div>
            <div className="ct-title">Confirmação <span>por Turno</span></div>
            <div className="ct-subtitle">{base.length} na base · {todas.length} escalados · {formatDataDisplay(dataAtiva)}</div>
          </div>
          <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
            <button className="ct-export-btn" onClick={()=>setShowExport(true)}>
              {libsReady ? "↓ Exportar" : "⏳ Carregando…"}
            </button>
            <div className="ct-sync-status">
              <span className={`ct-sync-dot ${syncStatus==="idle"?"ok":syncStatus}`} />
              <span className={`ct-sync-label ${syncStatus}`}>{syncMsg||"Base local"}</span>
              <button className="ct-sync-btn" onClick={sincronizarSheets} disabled={syncing}>↻ Sync</button>
            </div>
          </div>
        </div>

        {/* STATS */}
        <div className="ct-stats">
          {[
            { label:"Total Escalados", value:todas.length,  cls:""       },
            { label:"Confirmados",     value:totalConf,     cls:"green"  },
            { label:"Não Confirmados", value:totalNao,      cls:"orange" },
            { label:"Reservas",        value:totalRes,      cls:"blue"   },
          ].map(s => (
            <div className="ct-stat" key={s.label}>
              <div className="ct-stat-label">{s.label}</div>
              <div className={`ct-stat-val ${s.cls}`}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* TABS */}
        <div className="ct-tabs">
          {[
            { key:"escala", label:"Escala por Turno",     badge:todas.length },
            { key:"base",   label:"Base de Entregadores", badge:base.length  },
          ].map(t => (
            <button key={t.key} className={`ct-tab-btn ${abaAtiva===t.key?"active":""}`} onClick={()=>setAbaAtiva(t.key)}>
              {t.label}{t.badge>0&&<span className="ct-tab-badge">{t.badge}</span>}
            </button>
          ))}
        </div>

        {/* ─── ABA ESCALA ─── */}
        {abaAtiva === "escala" && (
          <div>
            <div className="ct-date-bar">
              <div className="ct-date-field">
                <div className="ct-date-lbl">Data de Referência</div>
                <input type="date" className="ct-date-native" value={dataAtiva}
                  onChange={e=>{ if (!e.target.value) return; criarNovoDia(e.target.value); }} />
              </div>
              <div className="ct-hist-field">
                <div className="ct-date-lbl">Histórico Salvo</div>
                <select className="ct-hist-select" value={dataAtiva} onChange={e=>setDataAtiva(e.target.value)}>
                  {datesIdx.map(d => (
                    <option key={d} value={d}>{formatDataDisplay(d)}{d===hoje?"  (hoje)":""}</option>
                  ))}
                </select>
              </div>
              <div className="ct-date-saved-count">
                <div className="ct-saved-badge">💾 <span>{datesIdx.length}</span> datas salvas</div>
              </div>
              {dataAtiva !== hoje && (
                <div style={{display:"flex",alignItems:"flex-end"}}>
                  <span className="ct-date-chip">🔒 Somente leitura</span>
                </div>
              )}
            </div>

            {isReadOnly && (
              <div className="ct-readonly-banner">
                🔒 Visualizando escala de <strong style={{marginLeft:4}}>{formatDataDisplay(dataAtiva)}</strong>. Edições desativadas para datas passadas.
              </div>
            )}

            {erro && <div className="ct-erro">⚠ {erro}</div>}

            {/* FILTROS */}
            <div className="ct-filters">
              <div className="ct-fg">
                <span className="ct-fl">Buscar</span>
                <input className="ct-fi" placeholder="Nome ou ID…" value={fTexto} onChange={e=>setFTexto(e.target.value)} />
              </div>
              <div className="ct-fg">
                <span className="ct-fl">Status</span>
                <select className="ct-fsel" value={fStatus} onChange={e=>setFStatus(e.target.value)}>
                  <option value="todos">Todos</option>
                  <option value="confirmado">✓ Confirmado</option>
                  <option value="nao_confirmado">✗ Não Confirmado</option>
                  <option value="reserva">◈ Reserva</option>
                </select>
              </div>
              <div className="ct-fg">
                <span className="ct-fl">Turno</span>
                <div className="ct-pills">
                  <button className={`ct-pill ${fTurno==="todos"?"active":""}`} onClick={()=>setFTurno("todos")}>Todos</button>
                  {TURNOS.map(t=>(
                    <button key={t} className={`ct-pill ${fTurno===t?"active":""}`} onClick={()=>setFTurno(t)}>{TURNO_ICON[t]} {t}</button>
                  ))}
                </div>
              </div>
              {temFiltro && <button className="ct-clear-btn" onClick={()=>{setFTexto("");setFTurno("todos");setFStatus("todos");}}>LIMPAR ×</button>}
            </div>

            {temFiltro && (
              <div style={{marginBottom:24}}>
                <div className="ct-section-title">Resultado — <span>{resultadoFiltrado.length}</span></div>
                <div className="ct-table-wrap">
                  <table className="ct-table">
                    <thead><tr><th>Nome</th><th>ID</th><th>Turno</th><th>Status</th><th></th></tr></thead>
                    <tbody>
                      {resultadoFiltrado.length === 0
                        ? <tr><td colSpan={5}><div className="ct-empty-row">🔍 Nenhum resultado</div></td></tr>
                        : resultadoFiltrado.map((e,i) => <TurnoRow key={i} e={e} turno={e.turno} showTurno />)
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <hr className="ct-divider" />
            <div className="ct-section-title" style={{marginBottom:16}}>
              Escala — <span>{formatDataDisplay(dataAtiva)}</span>
            </div>

            <div className="ct-turnos">
              {TURNOS.map(turno => {
                const lista     = turnos[turno] || [];
                const escalados = lista.filter(e => e.status !== "reserva");
                const reservas  = lista.filter(e => e.status === "reserva");
                const confs     = escalados.filter(e => e.status === "confirmado").length;
                return (
                  <div className="ct-turno-card" key={turno}>
                    <div className="ct-turno-header" style={{borderLeft:`3px solid ${TURNO_COLOR[turno]}`}}>
                      <div className="ct-turno-name">{TURNO_ICON[turno]} {turno}</div>
                      <div className="ct-turno-counts">
                        <span style={{color:"var(--green)"}}>{confs} ✓</span>
                        <span style={{color:"var(--blue)"}}>{reservas.length} ◈</span>
                        <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,color:"var(--orange)"}}>{lista.length}</span>
                      </div>
                    </div>
                    {!isReadOnly && (
                      <div className="ct-paste-area">
                        <textarea className="ct-paste-input"
                          placeholder={`Cole nome ou ID do ${turno}…`}
                          value={pasteText[turno]}
                          onChange={e=>setPasteText(prev=>({...prev,[turno]:e.target.value}))} />
                        <button className="ct-paste-btn" onClick={()=>processarCpfs(turno)}>BUSCAR</button>
                      </div>
                    )}
                    {escalados.length > 0 && (
                      <>
                        <div className="ct-section-lbl">Escalados — {escalados.length}</div>
                        <table className="ct-turno-table">
                          <thead><tr><th>Nome</th><th>ID</th><th>Status</th><th></th></tr></thead>
                          <tbody>{escalados.map((e,i)=><TurnoRow key={i} e={e} turno={turno} />)}</tbody>
                        </table>
                      </>
                    )}
                    {escalados.length === 0 && reservas.length === 0 && (
                      <div className="ct-empty-turno">Nenhum entregador escalado</div>
                    )}
                    <div className="ct-reserva-wrap">
                      <div className="ct-reserva-lbl">◈ Reservas — {reservas.length}</div>
                      {reservas.length > 0 && (
                        <table className="ct-turno-table">
                          <thead><tr><th>Nome</th><th>ID</th><th>Status</th><th></th></tr></thead>
                          <tbody>{reservas.map((e,i)=><TurnoRow key={i} e={e} turno={turno} />)}</tbody>
                        </table>
                      )}
                      {!isReadOnly && (
                        <div className="ct-add-reserva">
                          <input placeholder="Cole nome ou ID da reserva…"
                            value={reservaForm[turno]}
                            onChange={e=>setReservaForm(prev=>({...prev,[turno]:e.target.value}))}
                            onKeyDown={e=>e.key==="Enter"&&adicionarReserva(turno)} />
                          <button className="ct-add-reserva-btn" onClick={()=>adicionarReserva(turno)}>+ Reserva</button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── ABA BASE ─── */}
        {abaAtiva === "base" && (
          <div>
            <div className="ct-cadastro-header">
              <div className="ct-cadastro-title">✏ Entregadores Cadastrados</div>
              <button className="ct-novo-btn" onClick={abrirNovo}><span style={{fontSize:18,lineHeight:1}}>+</span> Cadastrar</button>
            </div>
            <div className="ct-search-bar">
              <input className="ct-search-input" placeholder="Buscar por nome ou ID…" value={baseSearch} onChange={e=>setBaseSearch(e.target.value)} />
              <span className="ct-count-badge">{baseFiltrada.length} / {base.length}</span>
              {baseSearch && <button className="ct-ghost-btn" onClick={()=>setBaseSearch("")}>× Limpar</button>}
            </div>
            <div className="ct-table-wrap">
              <table className="ct-table">
                <thead>
                  <tr><th>#</th><th>Nome</th><th>ID</th><th>Ações</th></tr>
                </thead>
                <tbody>
                  {baseFiltrada.length === 0
                    ? <tr><td colSpan={4}><div className="ct-empty-row">Nenhum entregador cadastrado ainda</div></td></tr>
                    : baseFiltrada.map((e,i) => (
                        <tr key={e._id}>
                          <td className="td-mono">{i+1}</td>
                          <td><div className="td-nome">{e.nome}</div></td>
                          <td className="td-mono">{e.id||"—"}</td>
                          <td>
                            <button className="act-btn" onClick={()=>abrirEditar(e)}>Editar</button>
                            <button className="act-btn del" onClick={()=>excluirBase(e._id)}>Excluir</button>
                          </td>
                        </tr>
                      ))
                  }
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* MODAL CADASTRO */}
      {showModal && (
        <div className="ct-modal-overlay" onClick={e=>e.target===e.currentTarget&&setShowModal(false)}>
          <div className="ct-modal">
            <div className="ct-modal-header">
              <div className="ct-modal-title">{editId!==null?"Editar":"Novo"} <span>Entregador</span></div>
              <button className="ct-modal-close" onClick={()=>setShowModal(false)}>✕</button>
            </div>
            <div className="ct-form-row full">
              <div>
                <label className="ct-label">Nome Completo *</label>
                <input className="ct-input" placeholder="João Silva" value={form.nome}
                  onChange={e=>setForm(f=>({...f,nome:e.target.value}))}
                  onKeyDown={e=>e.key==="Enter"&&salvarForm()} />
              </div>
            </div>
            <div className="ct-form-row full" style={{marginBottom:20}}>
              <div>
                <label className="ct-label">ID / Código</label>
                <input className="ct-input" placeholder="Ex: 1234567" value={form.id}
                  onChange={e=>setForm(f=>({...f,id:e.target.value}))}
                  onKeyDown={e=>e.key==="Enter"&&salvarForm()} />
              </div>
            </div>
            {formErro && <div className="ct-erro" style={{marginBottom:14}}>⚠ {formErro}</div>}
            <div className="ct-modal-footer">
              <button className="ct-btn-cancel" onClick={()=>setShowModal(false)}>Cancelar</button>
              <button className="ct-btn-save" onClick={salvarForm}>{editId!==null?"Salvar":"Cadastrar"}</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EXPORT */}
      {showExport && (
        <div className="ct-modal-overlay" onClick={e=>e.target===e.currentTarget&&setShowExport(false)}>
          <ExportModal onClose={()=>setShowExport(false)} turnos={turnos} dataKey={dataAtiva} />
        </div>
      )}
    </>
  );
}