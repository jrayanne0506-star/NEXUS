import React, { useState, useEffect, useRef, useCallback } from 'react'

const USERS = { admin: 'admin123', gestor: 'nexus2024', supervisor: '1234' }

function rnd(a, b) { return a + Math.random() * (b - a) }
const VENOM = ['#a8e63d','#78c800','#b4f000','#d4ff4d','#e8ff80','#5cb800','#c6f000']
function vc() { return VENOM[Math.floor(Math.random() * VENOM.length)] }

/* ══ TELA DE LOGIN ══ */
export default function Login({ onLogin }) {
  const [user, setUser]     = useState('')
  const [pass, setPass]     = useState('')
  const [error, setError]   = useState(false)
  const [shaking, setShake] = useState(false)
  const [flash, setFlash]   = useState(false)
  const [drops, setDrops]   = useState([])
  const canvasRef  = useRef(null)
  const wrapRef    = useRef(null)
  const clickCount = useRef(0)
  const pid        = useRef(0)

  /* redimensiona canvas para cobrir tela toda */
  useEffect(() => {
    function resize() {
      const c = canvasRef.current
      if (!c) return
      c.width  = window.innerWidth
      c.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  /* pinta manchas permanentes no canvas */
  const paintSplat = useCallback((cx, cy) => {
    const c = canvasRef.current
    if (!c) return
    const ctx = c.getContext('2d')
    for (let i = 0; i < 22; i++) {
      const angle = Math.random() * Math.PI * 2
      const dist  = rnd(10, 120)
      const rx    = rnd(5, 22)
      const ry    = rx * rnd(0.35, 1.6)
      ctx.beginPath()
      ctx.ellipse(
        cx + Math.cos(angle) * dist,
        cy + Math.sin(angle) * dist,
        rx, ry,
        Math.random() * Math.PI, 0, Math.PI * 2
      )
      ctx.fillStyle   = vc()
      ctx.globalAlpha = rnd(0.45, 0.9)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }, [])

  /* cria partículas que voam na tela toda */
  const burst = useCallback((cx, cy, big = false) => {
    const count = big ? 5 : 1
    const newDrops = []

    for (let b = 0; b < count; b++) {
      const ox = cx + rnd(-100, 100)
      const oy = cy + rnd(-30, 30)

      /* blobs */
      for (let i = 0; i < 30; i++) {
        const angle = Math.random() * Math.PI * 2
        const dist  = rnd(60, 320)
        newDrops.push({
          id:   pid.current++,
          x:    ox,
          y:    oy,
          dx:   Math.cos(angle) * dist,
          dy:   Math.sin(angle) * dist,
          size: rnd(7, 22),
          color: vc(),
          dur:  rnd(0.55, 1.0),
          type: 'blob',
        })
      }

      /* drips — escorrem pra baixo */
      for (let i = 0; i < 10; i++) {
        newDrops.push({
          id:    pid.current++,
          x:     ox + rnd(-140, 140),
          y:     oy,
          w:     rnd(5, 14),
          h:     rnd(50, 160),
          dh:    rnd(40, 130),
          color: vc(),
          dur:   rnd(0.7, 1.3),
          type:  'drip',
        })
      }

      paintSplat(ox, oy)
      if (big) paintSplat(ox + rnd(-120,120), oy + rnd(-80,80))
    }

    setDrops(d => [...d, ...newDrops])
    setTimeout(() => {
      setDrops(d => d.filter(p => !newDrops.find(n => n.id === p.id)))
    }, 1400)
  }, [paintSplat])

  function handleScorpClick(e) {
    e.stopPropagation()
    clickCount.current++

    setShake(true)
    setFlash(true)
    setTimeout(() => setShake(false), 500)
    setTimeout(() => setFlash(false), 380)

    /* posição relativa à janela toda */
    const cx = e.clientX
    const cy = e.clientY

    burst(cx, cy, clickCount.current % 5 === 0)
  }

  function handle() {
    if (USERS[user] && USERS[user] === pass) {
      onLogin(user)
    } else {
      setError(true)
      setTimeout(() => setError(false), 3000)
    }
  }

  return (
    <div ref={wrapRef} style={styles.wrap}>
      <style>{`
        @keyframes blobFly {
          0%  { transform:translate(0,0) scale(1);    opacity:1; }
          100%{ transform:translate(var(--dx),var(--dy)) scale(0.1); opacity:0; }
        }
        @keyframes dripFall {
          0%  { transform:translateY(0) scaleY(1);           opacity:1; }
          65% { transform:translateY(var(--dh)) scaleY(1.6); opacity:0.85; }
          100%{ transform:translateY(calc(var(--dh) + 50px)) scaleY(0.4); opacity:0; }
        }
        @keyframes scorpShake {
          0%,100%{ transform:scale(1)    rotate(0deg);  }
          20%    { transform:scale(1.4)  rotate(-12deg);}
          40%    { transform:scale(1.45) rotate(12deg); }
          60%    { transform:scale(1.25) rotate(-7deg); }
          80%    { transform:scale(1.1)  rotate(4deg);  }
        }
        @keyframes scorpFloat {
          0%,100%{ transform:translateY(0);   }
          50%    { transform:translateY(-5px); }
        }
        @keyframes flashFade {
          0%,35%{ opacity:1; } 100%{ opacity:0; }
        }
        @keyframes fadeUp {
          from{ opacity:0; transform:translateY(20px); }
          to  { opacity:1; transform:translateY(0);    }
        }
        input:focus { border-color:#f97316 !important; }
      `}</style>

      {/* grade */}
      <div style={styles.grid}/>
      <div style={styles.glow1}/>
      <div style={styles.glow2}/>

      {/* canvas cobre a tela inteira — manchas ficam aqui */}
      <canvas ref={canvasRef} style={{
        position:'fixed', inset:0, pointerEvents:'none', zIndex:0,
      }}/>

      {/* flash de tela */}
      {flash && <div style={{
        position:'fixed', inset:0, background:'rgba(164,230,40,0.07)',
        pointerEvents:'none', zIndex:1,
        animation:'flashFade 0.38s ease forwards',
      }}/>}

      {/* partículas — fixed para voar pela tela toda */}
      <div style={{ position:'fixed', inset:0, pointerEvents:'none', zIndex:50, overflow:'hidden' }}>
        {drops.map(p => {
          if (p.type === 'drip') return (
            <div key={p.id} style={{
              position:'absolute',
              left: p.x - p.w/2, top: p.y,
              width: p.w, height: p.h,
              borderRadius:'0 0 50% 50%',
              background: p.color,
              boxShadow:`0 0 7px ${p.color}`,
              transformOrigin:'top center',
              animation:`dripFall ${p.dur}s ease-in forwards`,
              '--dh': `${p.dh}px`,
            }}/>
          )
          return (
            <div key={p.id} style={{
              position:'absolute',
              left: p.x, top: p.y,
              width: p.size, height: p.size,
              borderRadius:'50% 40% 60% 30%',
              background: p.color,
              boxShadow:`0 0 9px ${p.color}`,
              animation:`blobFly ${p.dur}s cubic-bezier(.15,.8,.35,1) forwards`,
              '--dx': `${p.dx}px`, '--dy': `${p.dy}px`,
            }}/>
          )
        })}
      </div>

      {/* card de login */}
      <div style={styles.card}>

        <div style={styles.logoRow}>
          {/* escorpião inline — sem container quadrado */}
          <span
            onClick={handleScorpClick}
            title="clique em mim!"
            style={{
              fontSize: 52,
              lineHeight: 1,
              cursor: 'pointer',
              userSelect: 'none',
              display: 'inline-block',
              filter: 'drop-shadow(0 0 10px rgba(249,115,22,0.75))',
              animation: shaking ? 'scorpShake 0.5s ease' : 'scorpFloat 3s ease-in-out infinite',
              flexShrink: 0,
            }}
          >
            ᚼ
          </span>
          <div>
            <div style={styles.logo}>NEXUS</div>
            <div style={styles.sub}>Sistema de Controle de Turnos</div>
          </div>
        </div>

        <div style={styles.divider}/>

        <div style={styles.group}>
          <label style={styles.label}>Usuário</label>
          <input
            style={styles.input}
            value={user}
            onChange={e => setUser(e.target.value)}
            placeholder="seu.usuario"
            autoComplete="off"
            onKeyDown={e => e.key === 'Enter' && handle()}
          />
        </div>

        <div style={styles.group}>
          <label style={styles.label}>Senha</label>
          <input
            style={styles.input}
            type="password"
            value={pass}
            onChange={e => setPass(e.target.value)}
            placeholder="••••••••"
            onKeyDown={e => e.key === 'Enter' && handle()}
          />
        </div>

        <button
          style={styles.btn}
          onClick={handle}
          onMouseEnter={e => e.currentTarget.style.background = '#fb923c'}
          onMouseLeave={e => e.currentTarget.style.background = '#f97316'}
        >
          ACESSAR NEXUS
        </button>

        {error && <div style={styles.error}>⚠ Credenciais inválidas. Tente novamente.</div>}

        <div style={styles.hint}>
          <span style={{ color:'#3f3f46' }}>SCORPIONS © 2026 — </span>
          <span style={{ color:'#f97316', fontFamily:'IBM Plex Mono, monospace' }}>Dev Jeniffer</span>
        </div>
      </div>
    </div>
  )
}

const styles = {
  wrap: {
    minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
    background:'#09090b', position:'relative', overflow:'hidden',
  },
  grid: {
    position:'absolute', inset:0, pointerEvents:'none',
    backgroundImage:'linear-gradient(rgba(249,115,22,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(249,115,22,0.04) 1px,transparent 1px)',
    backgroundSize:'60px 60px',
  },
  glow1: {
    position:'absolute', top:-200, right:-200, width:600, height:600, borderRadius:'50%',
    background:'radial-gradient(circle,rgba(249,115,22,0.08) 0%,transparent 70%)', pointerEvents:'none',
  },
  glow2: {
    position:'absolute', bottom:-200, left:-200, width:600, height:600, borderRadius:'50%',
    background:'radial-gradient(circle,rgba(249,115,22,0.05) 0%,transparent 70%)', pointerEvents:'none',
  },
  card: {
    background:'#111113', border:'1px solid #27272a', borderTop:'2px solid #f97316',
    padding:'36px 40px 32px', width:420, position:'relative', zIndex:10,
    animation:'fadeUp 0.4s ease',
  },
  logoRow:  { display:'flex', alignItems:'center', gap:14, marginBottom:4 },
  logo: {
    fontFamily:'Bebas Neue, sans-serif', fontSize:34, letterSpacing:5,
    color:'#f97316', lineHeight:1, marginBottom:3,
  },
  sub: {
    fontSize:10, color:'#555560', letterSpacing:3, textTransform:'uppercase',
    fontFamily:'IBM Plex Mono, monospace',
  },
  divider:  { borderBottom:'1px solid #27272a', marginBottom:26 },
  group:    { marginBottom:18 },
  label: {
    display:'block', fontSize:10, letterSpacing:2, textTransform:'uppercase',
    color:'#555560', fontFamily:'IBM Plex Mono, monospace', marginBottom:7,
  },
  input: {
    width:'100%', background:'#18181b', border:'1px solid #27272a', color:'#ebebeb',
    fontFamily:'IBM Plex Mono, monospace', fontSize:14, padding:'11px 15px',
    outline:'none', transition:'border-color 0.2s', boxSizing:'border-box',
  },
  btn: {
    width:'100%', background:'#f97316', color:'#000',
    fontFamily:'Bebas Neue, sans-serif', fontSize:18, letterSpacing:3,
    padding:'13px', border:'none', cursor:'pointer',
    transition:'background 0.2s', marginTop:8,
  },
  error: {
    color:'#ef4444', fontSize:12, fontFamily:'IBM Plex Mono, monospace', marginTop:10,
  },
  hint: {
    marginTop:20, fontSize:11, fontFamily:'IBM Plex Mono, monospace', textAlign:'center',
    borderTop:'1px solid #27272a', paddingTop:16, color:'#555560',
  },
}