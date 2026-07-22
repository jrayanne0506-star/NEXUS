/**
 * AnexarPrintOCR.jsx
 * Versão SEM IA / SEM backend: lê o print inteiramente no navegador usando
 * OCR (tesseract.js) e tenta separar nome / status / motivo por palavras-chave.
 * Mostra uma prévia editável antes de importar pra tabela, já que OCR puro
 * erra mais que uma IA de visão — a conferência evita importar lixo.
 *
 * INSTALAÇÃO (uma vez só, no terminal do projeto):
 *   npm install tesseract.js
 *
 * Uso (mesmo lugar do ShiftTable.jsx onde estava o AnexarPrintIA):
 *   import AnexarPrintOCR from './AnexarPrintOCR'
 *   <AnexarPrintOCR onImport={handleImportPrint} />
 *
 * onImport recebe: [{ nome, status, motivo }, ...]  — mesmo formato de antes.
 */

import React from 'react'
import Tesseract from 'tesseract.js'

// Palavras-chave → status. Ajuste/adicione termos conforme os prints reais
// que você costuma receber — quanto mais específico, melhor a taxa de acerto.
const KEYWORD_MAP = [
  { status: 'ausencia',            palavras: ['nao avisou', 'não avisou', 'faltou', 'sumiu', 'furou', 'nao comunicad'] },
  { status: 'aviso',                palavras: ['avisou', 'aviso', 'comunicou', 'comunicad'] },
  { status: 'substituido',          palavras: ['substituiu', 'substituido', 'substituído', 'trocou'] },
  { status: 'bloqueado',            palavras: ['bloqueado', 'bloqueio', 'suspenso', 'afastado'] },
  { status: 'tirei',                palavras: ['tirei', 'tirado', 'removido', 'tiramos'] },
  { status: 'ausencia_em_sistema',  palavras: ['comunicada em sistema', 'comunicado em sistema'] },
  { status: 'nao_com_em_sistema',   palavras: ['nao comunicada em sistema', 'não comunicada em sistema'] },
]

function normalizar(txt) {
  return txt
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos pra comparar
    .trim()
}

function detectarStatus(linhaNormalizada) {
  for (const { status, palavras } of KEYWORD_MAP) {
    for (const p of palavras) {
      if (linhaNormalizada.includes(normalizar(p))) return status
    }
  }
  return ''
}

// Heurística simples: cada linha não vazia vira um candidato a registro.
// O "nome" é o trecho antes do separador (-, —, :, |) ou a linha inteira
// se não achar separador; o resto vira o texto onde procuramos o status.
function parseLinhas(textoOCR) {
  const linhas = textoOCR
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 2) // ignora linhas muito curtas / ruído

  return linhas.map(linha => {
    const partes = linha.split(/[-—:|]/)
    const nome = (partes[0] || linha).trim()
    const resto = partes.slice(1).join(' ').trim() || linha
    const status = detectarStatus(normalizar(resto))
    return {
      nome: nome.toUpperCase(),
      status,
      motivo: resto,
    }
  })
}

export default function AnexarPrintOCR({ onImport }) {
  const [loading, setLoading]     = React.useState(false)
  const [progresso, setProgresso] = React.useState(0)
  const [erro, setErro]           = React.useState(null)
  const [preview, setPreview]     = React.useState(null) // array em conferência

  async function handleFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setErro(null)
    setLoading(true)
    setProgresso(0)

    try {
      const { data } = await Tesseract.recognize(file, 'por', {
        logger: m => {
          if (m.status === 'recognizing text') {
            setProgresso(Math.round(m.progress * 100))
          }
        },
      })

      const candidatos = parseLinhas(data.text)

      if (!candidatos.length) {
        setErro('Não consegui identificar nenhuma linha de texto legível nesse print.')
        return
      }

      setPreview(candidatos)
    } catch (err) {
      console.error(err)
      setErro('Erro ao processar a imagem.')
    } finally {
      setLoading(false)
    }
  }

  function atualizarPreview(idx, campo, valor) {
    setPreview(prev => prev.map((r, i) => (i === idx ? { ...r, [campo]: valor } : r)))
  }

  function removerPreview(idx) {
    setPreview(prev => prev.filter((_, i) => i !== idx))
  }

  function confirmarImportacao() {
    const validos = preview.filter(r => r.nome.trim())
    onImport(validos)
    setPreview(null)
  }

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ ...s.btn, opacity: loading ? 0.6 : 1, pointerEvents: loading ? 'none' : 'auto' }}>
        {loading ? `LENDO PRINT... ${progresso}%` : '📎 ANEXAR PRINT (OCR)'}
        <input
          type="file"
          accept="image/*"
          onChange={handleFile}
          disabled={loading}
          style={{ display: 'none' }}
        />
      </label>
      {erro && <span style={s.erro}>{erro}</span>}

      {/* TELA DE CONFERÊNCIA — obrigatória com OCR puro, pra corrigir erros */}
      {preview && (
        <div style={s.overlay} onClick={() => setPreview(null)}>
          <div style={s.box} onClick={e => e.stopPropagation()}>
            <div style={s.boxTitle}>
              CONFIRA OS {preview.length} REGISTRO(S) LIDOS
            </div>
            <div style={s.boxSubtitle}>
              OCR não é 100% preciso — confira nome e status antes de importar.
            </div>

            <div style={s.list}>
              {preview.map((r, idx) => (
                <div key={idx} style={s.row}>
                  <input
                    style={s.rowNome}
                    value={r.nome}
                    onChange={e => atualizarPreview(idx, 'nome', e.target.value)}
                    placeholder="Nome"
                  />
                  <select
                    style={s.rowStatus}
                    value={r.status}
                    onChange={e => atualizarPreview(idx, 'status', e.target.value)}
                  >
                    <option value="">— status —</option>
                    <option value="aviso">Ausência Comunicada</option>
                    <option value="ausencia">Ausência Não Comunicada</option>
                    <option value="substituido">Substituído</option>
                    <option value="bloqueado">Bloqueado</option>
                    <option value="ausencia_em_sistema">Aus. Comunicada — em sistema</option>
                    <option value="nao_com_em_sistema">Aus. Não Comunicada — em sistema</option>
                    <option value="tirei">Tirei</option>
                  </select>
                  <input
                    style={s.rowMotivo}
                    value={r.motivo}
                    onChange={e => atualizarPreview(idx, 'motivo', e.target.value)}
                    placeholder="Motivo"
                  />
                  <button style={s.rowDel} onClick={() => removerPreview(idx)}>✕</button>
                </div>
              ))}
              {preview.length === 0 && (
                <div style={{ color: '#555560', fontSize: 12, padding: 16 }}>
                  Nenhum registro restante.
                </div>
              )}
            </div>

            <div style={s.boxFooter}>
              <button style={s.cancelBtn} onClick={() => setPreview(null)}>Cancelar</button>
              <button
                style={{ ...s.confirmBtn, opacity: preview.length ? 1 : 0.4 }}
                onClick={confirmarImportacao}
                disabled={!preview.length}
              >
                Importar {preview.length} registro(s)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const s = {
  btn: {
    display: 'inline-block',
    fontFamily: 'IBM Plex Mono, monospace',
    fontSize: 11,
    letterSpacing: 1,
    color: '#000',
    background: '#f97316',
    border: 'none',
    padding: '9px 16px',
    cursor: 'pointer',
    textTransform: 'uppercase',
  },
  erro: {
    fontFamily: 'IBM Plex Mono, monospace',
    fontSize: 9.5,
    color: '#ef4444',
  },
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
    zIndex: 2100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
  },
  box: {
    background: '#18181b', border: '1px solid #27272a', width: '100%', maxWidth: 620,
    maxHeight: '85vh', display: 'flex', flexDirection: 'column', padding: 22, gap: 12,
  },
  boxTitle: {
    fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, letterSpacing: 1.5,
    color: '#f97316', fontWeight: 700, textTransform: 'uppercase',
  },
  boxSubtitle: {
    fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, color: '#71717a', marginTop: -6,
  },
  list: { display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', paddingRight: 4 },
  row: { display: 'flex', gap: 6, alignItems: 'center' },
  rowNome: {
    flex: '1 1 130px', background: '#111113', border: '1px solid #27272a', color: '#ebebeb',
    fontFamily: 'IBM Plex Sans, sans-serif', fontSize: 12, padding: '6px 8px', outline: 'none',
  },
  rowStatus: {
    flex: '1 1 150px', background: '#111113', border: '1px solid #27272a', color: '#ebebeb',
    fontFamily: 'IBM Plex Mono, monospace', fontSize: 10.5, padding: '6px 8px', outline: 'none',
  },
  rowMotivo: {
    flex: '2 1 160px', background: '#111113', border: '1px solid #27272a', color: '#909090',
    fontFamily: 'IBM Plex Sans, sans-serif', fontSize: 12, padding: '6px 8px', outline: 'none',
  },
  rowDel: {
    background: 'transparent', border: 'none', color: '#555560', cursor: 'pointer', fontSize: 13,
  },
  boxFooter: { display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 6, borderTop: '1px solid #27272a' },
  cancelBtn: {
    background: 'transparent', border: '1px solid #27272a', color: '#555560',
    fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, padding: '8px 16px', cursor: 'pointer',
  },
  confirmBtn: {
    background: '#f97316', border: 'none', color: '#000',
    fontFamily: 'Bebas Neue, sans-serif', fontSize: 14, letterSpacing: 2,
    padding: '8px 20px', cursor: 'pointer',
  },
}
