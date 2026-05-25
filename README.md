# NEXUS — Controle de Ausências

Sistema de controle de ausências por turno com persistência local e exportação em PDF.

## Tecnologias
- React 18 + Vite
- jsPDF + jsPDF-AutoTable (geração de PDF)
- localStorage (persistência por data)

## Rodar localmente

```bash
npm install
npm run dev
```

Abra http://localhost:5173

## Deploy no Vercel

### Opção 1 — Via GitHub (recomendado)
1. Crie um repositório no GitHub e suba o projeto:
   ```bash
   git init
   git add .
   git commit -m "feat: initial commit"
   git remote add origin https://github.com/SEU_USER/nexus-ausencias.git
   git push -u origin main
   ```
2. Acesse https://vercel.com → "Add New Project"
3. Importe o repositório do GitHub
4. Configurações de build (já detecta automaticamente):
   - **Framework**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Clique em **Deploy**

### Opção 2 — Via Vercel CLI
```bash
npm i -g vercel
vercel
```

## Credenciais de acesso (demo)
| Usuário    | Senha      |
|------------|------------|
| admin      | admin123   |
| gestor     | nexus2024  |
| supervisor | 1234       |

> Para produção, substitua o objeto `USERS` em `src/components/Login.jsx` por autenticação real.

## Funcionalidades
- Login com controle de acesso
- 4 turnos: Almoço, Tarde, Jantar, Ceia
- Dados salvos por data no localStorage (persistem entre sessões)
- Histórico de datas acessadas
- Filtros por nome e status
- Exportação PDF profissional com todas as abas, estatísticas e assinatura
