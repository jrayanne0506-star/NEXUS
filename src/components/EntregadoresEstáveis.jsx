import { useState, useRef, useCallback } from "react";
import Tesseract from "tesseract.js";
import * as XLSX from "xlsx";


// Corrige números e porcentagens vindos do Excel
function normalizarValor(valor) {
  if (valor === undefined || valor === null) return 0;

  // se já for número
  if (typeof valor === "number") {

    // Excel salva porcentagem como 0.94
    if (valor > 0 && valor < 1) {
      return +(valor * 100).toFixed(2);
    }

    return valor;
  }

  // se for texto
  let v = String(valor).trim();

  v = v.replace("%", "");
  v = v.replace(",", ".");

  let num = parseFloat(v);

  if (isNaN(num)) return 0;

  return num;
}

// Corrige nomes com acentos
function normalizarTexto(texto) {
  if (!texto) return '';

  return texto
    .toString()
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .trim();
}

// ─── Helpers exportados para Reservas.jsx ────────────────────────────────────

export function normalizeStr(s = "") {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

export function isEntregadorEstáveis(nomeReserva, entregadores = []) {
  const a = normalizeStr(nomeReserva);
  return entregadores.some((e) => {
    const b = normalizeStr(e["Nome Completo"] || "");
    if (a === b) return true;
    const pa = a.split(/\s+/);
    const pb = b.split(/\s+/);
    return (
      pa.length >= 2 && pb.length >= 2 &&
      pa[0] === pb[0] &&
      pa[pa.length - 1] === pb[pb.length - 1]
    );
  });
}


async function preprocessImage(file) {
  const img = await createImageBitmap(file);

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  canvas.width = img.width * 2;
  canvas.height = img.height * 2;

  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {

    const gray = data[i] * 0.3 + data[i+1] * 0.59 + data[i+2] * 0.11;

    const value = gray > 160 ? 255 : 0;

    data[i] = value;
    data[i+1] = value;
    data[i+2] = value;

  }

  ctx.putImageData(imageData, 0, 0);

  return canvas;
}

// ─── Parser de planilha CSV / XLSX ───────────────────────────────────────────

// Busca um valor em um objeto testando várias chaves possíveis (case-insensitive)
function acharCampo(row, candidatos) {
  const keys = Object.keys(row);
  for (const cand of candidatos) {
    const found = keys.find(k => k.trim().toLowerCase() === cand.toLowerCase());
    if (found !== undefined && row[found] !== undefined && row[found] !== "") {
      return row[found];
    }
  }
  return undefined;
}

async function processarPlanilha(file) {
  const buffer = await file.arrayBuffer();

  // detecta separador para CSV (ponto-vírgula ou vírgula)
  const isCsv = /\.csv$/i.test(file.name);
  const wb = XLSX.read(buffer, {
    type: "array",
    FS: isCsv ? ";" : undefined,   // força ponto-vírgula se for CSV
  });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json(ws, { defval: "" });

  return json.map(row => {
    // ── Nome: aceita coluna única ou first_name + last_name ──
    let nome = "";
    const nomeCompleto = acharCampo(row, [
      "Nome Completo", "nome completo", "NOME COMPLETO",
      "nome", "NOME", "Name", "name", "entregador", "ENTREGADOR",
    ]);

    if (nomeCompleto) {
      nome = normalizarTexto(String(nomeCompleto));
    } else {
      const primeiro = acharCampo(row, ["first_name", "FIRST_NAME", "primeiro_nome", "primeiro nome", "nome1"]);
      const ultimo   = acharCampo(row, ["last_name",  "LAST_NAME",  "ultimo_nome",   "sobrenome",     "nome2"]);
      if (primeiro) nome = normalizarTexto(`${primeiro} ${ultimo || ""}`.trim());
    }

    // ── Métricas opcionais (podem não existir nesse formato) ──
    const tempoOnline = acharCampo(row, ["% Tempo Online", "tempo online", "% tempo online", "online"]);
    const atribuidas  = acharCampo(row, ["Atribuídas", "Atribuidas", "atribuidas", "atribuídas"]);
    const aceitas     = acharCampo(row, ["Aceitas", "aceitas"]);
    const aceitacao   = acharCampo(row, ["% Aceitacao", "% Aceitação", "aceitacao", "aceitação"]);
    const recusadas   = acharCampo(row, ["Recusadas (Total)", "Recusadas", "recusadas"]);

    return {
      "Nome Completo":     nome,
      "% Tempo Online":    tempoOnline !== undefined ? normalizarValor(tempoOnline) : "—",
      "Atribuídas":        atribuidas  !== undefined ? normalizarValor(atribuidas)  : "—",
      "Aceitas":           aceitas     !== undefined ? normalizarValor(aceitas)     : "—",
      "% Aceitacao":       aceitacao   !== undefined ? normalizarValor(aceitacao)   : "—",
      "Recusadas (Total)": recusadas   !== undefined ? normalizarValor(recusadas)   : "—",
    };
  }).filter(r => r["Nome Completo"].length > 2);
}

// ─── Parser do texto OCR ─────────────────────────────────────────────────────

function parseOcrText(rawText) {

  const lines = rawText
    .split("\n")
    .map(l => l.trim())
    .filter(l => l.length > 5);

  const rows = [];

  for (let line of lines) {

    if (/nome|tempo|online|atribu|aceita|recus/i.test(line)) continue;

    line = line
      .replace(/[|]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    // pega números da linha
    const nums = line.match(/\d+[.,]?\d*%?/g);

    if (!nums || nums.length < 4) continue;

    // pega nome pegando tudo antes do primeiro número
    const firstNumber = line.search(/\d+[.,]?\d*%?/);

    let nome = line.slice(0, firstNumber).trim();

    // remove número de ranking no começo
    nome = nome.replace(/^\d+\s*/, "");

    if (nome.length < 3) continue;

    rows.push({
      "Nome Completo": normalizarTexto(nome),
      "% Tempo Online": nums[0] || "—",
      "Atribuídas": nums[1] || "—",
      "Aceitas": nums[2] || "—",
      "% Aceitacao": nums[3] || "—",
      "Recusadas (Total)": nums[4] || "—",
    });
  }

  return rows;
}

// ─── Colunas ─────────────────────────────────────────────────────────────────

const COLS = [
  { key: "Nome Completo",     label: "Nome Completo",     align: "left"   },
  { key: "% Tempo Online",    label: "% Tempo Online",    align: "center" },
  { key: "Atribuídas",        label: "Atribuídas",        align: "center" },
  { key: "Aceitas",           label: "Aceitas",           align: "center" },
  { key: "% Aceitacao",       label: "% Aceitação",       align: "center" },
  { key: "Recusadas (Total)", label: "Recusadas (Total)", align: "center" },
];

// ─── CSS ──────────────────────────────────────────────────────────────────────

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=IBM+Plex+Mono:wght@400;500&display=swap');

  .ec-root {
    background: #09090b;
    min-height: 100vh;
    padding: 28px 32px;
    font-family: 'IBM Plex Mono', monospace;
    color: #ebebeb;
  }
  .ec-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin-bottom: 28px;
    border-bottom: 1px solid #27272a;
    padding-bottom: 22px;
    flex-wrap: wrap;
    gap: 16px;
  }
  .ec-eyebrow { font-size: 10px; letter-spacing: 3px; color: #f97316; text-transform: uppercase; margin-bottom: 6px; }
  .ec-title { font-family: 'Bebas Neue', sans-serif; font-size: 38px; letter-spacing: 3px; color: #ebebeb; line-height: 1; }
  .ec-title span { color: #f97316; }
  .ec-subtitle { margin-top: 6px; font-size: 10px; color: #555560; letter-spacing: 1.5px; text-transform: uppercase; }

  .ec-date-wrap { display: flex; flex-direction: column; gap: 6px; align-items: flex-end; }
  .ec-date-label { font-size: 9px; letter-spacing: 2px; text-transform: uppercase; color: #555560; }
  .ec-date-input {
    background: #18181b; border: 1px solid #27272a; color: #ebebeb;
    font-family: 'IBM Plex Mono', monospace; font-size: 12px; padding: 8px 13px;
    outline: none; color-scheme: dark; transition: border-color 0.2s; min-width: 160px;
  }
  .ec-date-input:focus { border-color: rgba(249,115,22,0.5); }

  .ec-drop {
    border: 1px dashed #27272a; background: #111113; padding: 36px 24px;
    text-align: center; cursor: pointer; margin-bottom: 22px; transition: all 0.2s;
  }
  .ec-drop:hover, .ec-drop.over { border-color: rgba(249,115,22,0.45); background: #131310; }
  .ec-drop-icon { font-size: 30px; margin-bottom: 10px; display: block; }
  .ec-drop-title { font-family: 'Bebas Neue', sans-serif; font-size: 18px; letter-spacing: 3px; color: #ebebeb; margin-bottom: 6px; }
  .ec-drop-sub { font-size: 10px; color: #555560; letter-spacing: 1px; }
  .ec-drop-ok .ec-drop-title { color: #f97316; }

  .ec-progress-wrap { margin-bottom: 8px; }
  .ec-progress-bar-bg { background: #18181b; border: 1px solid #27272a; height: 6px; width: 100%; max-width: 320px; margin: 0 auto 8px; }
  .ec-progress-bar { height: 6px; background: #f97316; transition: width 0.3s; }
  .ec-spinner {
    width: 30px; height: 30px; border: 2px solid #27272a; border-top-color: #f97316;
    border-radius: 50%; animation: ecSpin 0.7s linear infinite; margin: 0 auto 12px;
  }
  @keyframes ecSpin { to { transform: rotate(360deg); } }
  .ec-loading-text { font-family: 'Bebas Neue', sans-serif; font-size: 16px; letter-spacing: 3px; color: #f97316; }
  .ec-loading-sub { font-size: 10px; color: #555560; letter-spacing: 1px; margin-top: 6px; }

  .ec-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 22px; }
  .ec-stat { background: #111113; border: 1px solid #27272a; border-left: 3px solid #f97316; padding: 14px 18px; }
  .ec-stat-label { font-size: 9px; letter-spacing: 2px; text-transform: uppercase; color: #555560; margin-bottom: 7px; }
  .ec-stat-val { font-family: 'Bebas Neue', sans-serif; font-size: 32px; color: #f97316; line-height: 1; }

  .ec-filters {
    background: #111113; border: 1px solid #27272a; padding: 16px 20px;
    margin-bottom: 18px; display: flex; gap: 12px; align-items: flex-end; flex-wrap: wrap;
  }
  .ec-filter-group { display: flex; flex-direction: column; gap: 6px; }
  .ec-filter-label { font-size: 9px; letter-spacing: 2px; text-transform: uppercase; color: #555560; }
  .ec-filter-input {
    background: #18181b; border: 1px solid #27272a; color: #ebebeb;
    font-family: 'IBM Plex Mono', monospace; font-size: 12px; padding: 8px 13px;
    outline: none; min-width: 210px; transition: border-color 0.2s;
  }
  .ec-filter-input:focus { border-color: rgba(249,115,22,0.5); }
  .ec-filter-input::placeholder { color: #3a3a3a; }

  .ec-btn-clear {
    background: transparent; border: 1px solid #27272a; color: #555560;
    font-family: 'IBM Plex Mono', monospace; font-size: 11px; padding: 8px 14px;
    cursor: pointer; letter-spacing: 1px; transition: all 0.2s;
  }
  .ec-btn-clear:hover { border-color: #f97316; color: #f97316; }

  .ec-table-wrap { background: #111113; border: 1px solid #27272a; overflow-x: auto; }
  .ec-table { width: 100%; border-collapse: collapse; min-width: 700px; }
  .ec-table thead { background: #18181b; border-bottom: 2px solid #27272a; }
  .ec-table th {
    padding: 11px 16px; font-size: 9px; letter-spacing: 2px; text-transform: uppercase;
    color: #555560; cursor: pointer; user-select: none; white-space: nowrap;
    transition: color 0.2s; font-family: 'IBM Plex Mono', monospace; font-weight: 500;
  }
  .ec-table th:hover { color: #f97316; }
  .ec-table th.sort-active { color: #f97316; }
  .ec-table td { padding: 10px 16px; font-size: 12px; border-bottom: 1px solid #1a1a1d; transition: background 0.15s; }
  .ec-table tbody tr:hover td { background: #18181b; }
  .ec-table tbody tr:last-child td { border-bottom: none; }
  .td-num { color: #3a3a3a; font-size: 10px; width: 32px; }
  .td-nome { font-family: 'Bebas Neue', sans-serif; font-size: 15px; letter-spacing: 1px; color: #ebebeb; }
  .td-center { text-align: center; color: #909090; }
  .td-orange { text-align: center; color: #f97316; }

  .ec-empty { text-align: center; padding: 60px 20px; color: #3a3a3a; font-size: 11px; letter-spacing: 1px; text-transform: uppercase; }
  .ec-empty-icon { font-size: 30px; margin-bottom: 10px; display: block; }
  .ec-footer { margin-top: 12px; font-size: 10px; color: #3a3a3a; letter-spacing: 1px; text-align: right; text-transform: uppercase; }
  .ec-erro { background: #1a0a0a; border: 1px solid rgba(239,68,68,0.3); color: #ef4444; padding: 10px 16px; font-size: 11px; letter-spacing: 0.5px; margin-bottom: 14px; }

  .ec-manual-wrap { margin-bottom: 18px; }
  .ec-manual-btn {
    background: transparent; border: 1px solid #27272a; color: #555560;
    font-family: 'IBM Plex Mono', monospace; font-size: 11px; padding: 8px 16px;
    cursor: pointer; letter-spacing: 1px; transition: all 0.2s; width: 100%; text-align: center;
  }
  .ec-manual-btn:hover { border-color: #f97316; color: #f97316; }
  .ec-manual-area {
    width: 100%; background: #111113; border: 1px solid #27272a; color: #ebebeb;
    font-family: 'IBM Plex Mono', monospace; font-size: 11px; padding: 12px;
    outline: none; resize: vertical; min-height: 120px; box-sizing: border-box;
    margin-top: 8px; transition: border-color 0.2s;
  }
  .ec-manual-area:focus { border-color: rgba(249,115,22,0.5); }
  .ec-manual-actions { display: flex; gap: 8px; margin-top: 8px; }
  .ec-btn-ok {
    background: #f97316; color: #000; font-family: 'Bebas Neue', sans-serif;
    font-size: 15px; letter-spacing: 2px; padding: 8px 20px; border: none;
    cursor: pointer; transition: background 0.2s;
  }
  .ec-btn-ok:hover { background: #fb923c; }
`;

// ─── helper: verifica se estável está na confirmação ─────────────────────────
function soDigitosLocal(v) { return String(v ?? "").replace(/\D/g, ""); }
function normLocal(s = "") {
  return String(s).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[.\-\/\s_()\+]/g,"").toLowerCase().trim();
}
const TURNOS_CONF = ["Almoço","Tarde","Jantar","Ceia"];
const TURNO_ICON_CONF = { "Almoço":"☀️","Tarde":"🌤️","Jantar":"🌙","Ceia":"⭐" };
function estavelNaConf(estavel, turnosData = {}) {
  const nA = normLocal(estavel["Nome Completo"] || "");
  const cpfA = soDigitosLocal(estavel.cpf || "");
  for (const turno of TURNOS_CONF) {
    const found = (turnosData[turno]||[]).some(e => {
      const cpfB = soDigitosLocal(e.cpf);
      if (cpfA && cpfB && cpfA === cpfB) return true;
      const nB = normLocal(e.nome);
      if (!nA || !nB) return false;
      if (nA === nB) return true;
      const pA = nA.split(/\s+/), pB = nB.split(/\s+/);
      return pA.length >= 2 && pB.length >= 2 && pA[0]===pB[0] && pA[pA.length-1]===pB[pB.length-1];
    });
    if (found) return turno;
  }
  return null;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function EntregadoresEstáveis({ onEntregadoresChange, turnosData = {} }) {
  const [entregadores, setEntregadores] = useState([]);
  const [filtroNome, setFiltroNome]     = useState("");
  const [filtroData, setFiltroData]     = useState("");
  const [dataLista, setDataLista]       = useState("");
  const [loading, setLoading]           = useState(false);
  const [progress, setProgress]         = useState(0);
  const [progressMsg, setProgressMsg]   = useState("");
  const [erro, setErro]                 = useState("");
  const [imagemOk, setImagemOk]         = useState(false);
  const [dragOver, setDragOver]         = useState(false);
  const [sortCol, setSortCol]           = useState(null);
  const [sortDir, setSortDir]           = useState("asc");
  const [showManual, setShowManual]     = useState(false);
  const [manualText, setManualText]     = useState("");
  const inputRef = useRef();

  const processFile = useCallback(async (file) => {
    if (!file) return;

    const isImagem   = file.type.startsWith("image/");
    const isPlanilha = /\.(csv|xlsx|xls)$/i.test(file.name);

    if (!isImagem && !isPlanilha) {
      setErro("Envie uma imagem JPEG/PNG ou planilha CSV/XLSX.");
      return;
    }

    setErro("");
    setLoading(true);
    setImagemOk(false);
    setProgress(0);

    try {
      let rows;

      if (isPlanilha) {
        setProgressMsg("Lendo planilha...");
        rows = await processarPlanilha(file);
      } else {
        setProgressMsg("Iniciando OCR...");
        const canvas = await preprocessImage(file);
        const { data: { text } } = await Tesseract.recognize(
          canvas,
          "por",
          { tessedit_pageseg_mode: 6 }
        );
        setProgressMsg("Processando tabela...");
        rows = parseOcrText(text);
      }

      if (rows.length === 0) {
        setErro("Não foi possível extrair dados do arquivo. Tente a entrada manual abaixo.");
        return;
      }

      const hoje = new Date().toISOString().slice(0, 10);
      const withDate = rows.map(r => ({ ...r, _data: dataLista || hoje }));
      setEntregadores(withDate);
      setImagemOk(true);
      onEntregadoresChange?.(withDate);
    } catch (e) {
      setErro("Erro ao processar arquivo: " + e.message + ". Use a entrada manual abaixo.");
    } finally {
      setLoading(false);
      setProgress(0);
    }
  }, [dataLista, onEntregadoresChange]);

  const onFileInput  = (e) => processFile(e.target.files[0]);
  const onDrop       = (e) => { e.preventDefault(); setDragOver(false); processFile(e.dataTransfer.files[0]); };

  // Entrada manual — usuário cola o texto copiado da imagem/tabela
  function handleManualParse() {
    if (!manualText.trim()) return;
    const rows = parseOcrText(manualText);
    if (rows.length === 0) {
      setErro("Não foi possível interpretar o texto. Verifique o formato.");
      return;
    }
    const hoje = new Date().toISOString().slice(0, 10);
    const withDate = rows.map(r => ({ ...r, _data: dataLista || hoje }));
    setEntregadores(withDate);
    setImagemOk(true);
    setShowManual(false);
    setErro("");
    onEntregadoresChange?.(withDate);
  }

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  };

  const filtered = entregadores.filter((e) => {
    const nomeOk = !filtroNome || normalizeStr(e["Nome Completo"] || "").includes(normalizeStr(filtroNome));
    const dataOk = !filtroData || e._data === filtroData;
    return nomeOk && dataOk;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (!sortCol) return 0;
    const va = (a[sortCol] || "").toString().replace(",", ".");
    const vb = (b[sortCol] || "").toString().replace(",", ".");
    const n = parseFloat(va) - parseFloat(vb);
    if (!isNaN(n)) return sortDir === "asc" ? n : -n;
    return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
  });

  const sortIcon = (col) => sortCol === col ? (sortDir === "asc" ? " ▲" : " ▼") : " ⇅";

  const updateDataLista = (val) => {
    setDataLista(val);
    const updated = entregadores.map(r => ({ ...r, _data: val }));
    setEntregadores(updated);
    onEntregadoresChange?.(updated);
  };

  return (
    <>
      <style>{css}</style>
      <div className="ec-root">

        {/* Header */}
        <div className="ec-header">
          <div>
            <div className="ec-eyebrow">Sistema de Gestão · Nexus</div>
            <div className="ec-title">Entregadores <span>Estáveis</span></div>
            <div className="ec-subtitle">
              {entregadores.length > 0
                ? `${entregadores.length} entregadores carregados · ${filtered.length} exibidos`
                : "Faça upload da lista do dia para começar"}
            </div>
          </div>
          <div className="ec-date-wrap">
            <span className="ec-date-label">Data da Lista</span>
            <input
              type="date"
              className="ec-date-input"
              value={dataLista}
              onChange={e => updateDataLista(e.target.value)}
            />
          </div>
        </div>

        {/* Drop zone */}
        <div
          className={`ec-drop${dragOver ? " over" : ""}${imagemOk ? " ec-drop-ok" : ""}`}
          onClick={() => !loading && inputRef.current.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
        >
          <input ref={inputRef} type="file" accept="image/*,.csv,.xlsx,.xls" style={{ display: "none" }} onChange={onFileInput} />
          {loading ? (
            <>
              <div className="ec-spinner" />
              <div className="ec-loading-text">Processando arquivo...</div>
              <div className="ec-progress-wrap">
                <div className="ec-progress-bar-bg">
                  <div className="ec-progress-bar" style={{ width: `${progress}%` }} />
                </div>
              </div>
              <div className="ec-loading-sub">{progressMsg}</div>
            </>
          ) : imagemOk ? (
            <>
              <span className="ec-drop-icon">✅</span>
              <div className="ec-drop-title">Tabela carregada com sucesso</div>
              <div className="ec-drop-sub">{entregadores.length} entregadores · clique para substituir</div>
            </>
          ) : (
            <>
              <span className="ec-drop-icon">📂</span>
              <div className="ec-drop-title">Arrastar ou clicar para subir o arquivo</div>
              <div className="ec-drop-sub">JPEG · PNG (OCR local) · CSV · XLSX</div>
            </>
          )}
        </div>

        {/* Entrada manual (fallback) */}
        <div className="ec-manual-wrap">
          <button className="ec-manual-btn" onClick={() => setShowManual(v => !v)}>
            {showManual ? "▲ FECHAR ENTRADA MANUAL" : "▼ ENTRADA MANUAL (COLAR TEXTO)"}
          </button>
          {showManual && (
            <>
              <textarea
                className="ec-manual-area"
                placeholder={"Cole aqui o texto copiado da tabela.\nEx:\nJoão Silva  99,94%  64  52  81,25%  11\nMaria Souza  98,56%  203  193  95,07%  7"}
                value={manualText}
                onChange={e => setManualText(e.target.value)}
              />
              <div className="ec-manual-actions">
                <button className="ec-btn-ok" onClick={handleManualParse}>PROCESSAR</button>
                <button className="ec-btn-clear" onClick={() => { setManualText(""); setShowManual(false); }}>CANCELAR</button>
              </div>
            </>
          )}
        </div>

        {erro && <div className="ec-erro">⚠ {erro}</div>}

        {/* Stats */}
        {entregadores.length > 0 && (
          <div className="ec-stats">
            {[
              { label: "Total Carregados", value: entregadores.length },
              { label: "Exibidos",         value: filtered.length },
              { label: "Data de Ref.",     value: dataLista ? dataLista.split("-").reverse().join("/") : "—" },
            ].map(st => (
              <div className="ec-stat" key={st.label}>
                <div className="ec-stat-label">{st.label}</div>
                <div className="ec-stat-val">{st.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        {entregadores.length > 0 && (
          <div className="ec-filters">
            <div className="ec-filter-group">
              <span className="ec-filter-label">Filtrar por Nome</span>
              <input
                className="ec-filter-input"
                placeholder="Ex: João Silva…"
                value={filtroNome}
                onChange={e => setFiltroNome(e.target.value)}
              />
            </div>
            <div className="ec-filter-group">
              <span className="ec-filter-label">Filtrar por Data</span>
              <input
                type="date"
                className="ec-filter-input"
                style={{ colorScheme: "dark" }}
                value={filtroData}
                onChange={e => setFiltroData(e.target.value)}
              />
            </div>
            {(filtroNome || filtroData) && (
              <button className="ec-btn-clear" onClick={() => { setFiltroNome(""); setFiltroData(""); }}>
                LIMPAR ×
              </button>
            )}
          </div>
        )}

        {/* Table */}
        {entregadores.length > 0 && (
          <>
            <div className="ec-table-wrap">
              <table className="ec-table">
                <thead>
                  <tr>
                    <th style={{ textAlign: "left" }}>#</th>
                    {COLS.map(c => (
                      <th
                        key={c.key}
                        className={sortCol === c.key ? "sort-active" : ""}
                        style={{ textAlign: c.align }}
                        onClick={() => handleSort(c.key)}
                      >
                        {c.label}{sortIcon(c.key)}
                      </th>
                    ))}
                    <th style={{ textAlign: "center", color: "#60a5fa" }}>Na Confirmação</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.length === 0 ? (
                    <tr>
                      <td colSpan={8}>
                        <div className="ec-empty">
                          <span className="ec-empty-icon">🔍</span>
                          Nenhum entregador encontrado
                        </div>
                      </td>
                    </tr>
                  ) : sorted.map((row, i) => {
                    const naConf = estavelNaConf(row, turnosData);
                    return (
                    <tr key={i}>
                      <td className="td-num">{i + 1}</td>
                      <td className="td-nome">{row["Nome Completo"] || "—"}</td>
                      <td className="td-orange">{row["% Tempo Online"] || "—"}</td>
                      <td className="td-center">{row["Atribuídas"] || "—"}</td>
                      <td className="td-center">{row["Aceitas"] || "—"}</td>
                      <td className="td-orange">{row["% Aceitacao"] || "—"}</td>
                      <td className="td-center">{row["Recusadas (Total)"] || "—"}</td>
                      <td style={{ textAlign: "center" }}>
                        {naConf
                          ? <span style={{ display:"inline-flex", alignItems:"center", gap:4, padding:"3px 8px", fontFamily:"'Bebas Neue',sans-serif", fontSize:11, letterSpacing:1, background:"rgba(96,165,250,0.08)", color:"#60a5fa", border:"1px solid rgba(96,165,250,0.25)", whiteSpace:"nowrap" }}>{TURNO_ICON_CONF[naConf]} {naConf}</span>
                          : <span style={{ display:"inline-flex", padding:"3px 8px", fontFamily:"'Bebas Neue',sans-serif", fontSize:11, background:"#18181b", color:"#3a3a3a", border:"1px solid #27272a" }}>—</span>
                        }
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="ec-footer">
              Exibindo {sorted.length} de {entregadores.length} entregadores
            </div>
          </>
        )}
      </div>
    </>
  );
}