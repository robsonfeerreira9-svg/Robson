#!/bin/bash
# ================================================================
# HG GRIFES ERP — Script de setup local e deploy
# Execute este script no SEU computador:
#   chmod +x setup-local.sh && ./setup-local.sh
# ================================================================

set -e

echo "=== HG GRIFES ERP — Setup Local ==="
echo ""

# Verificar pré-requisitos
command -v git >/dev/null 2>&1 || { echo "❌ Git não encontrado. Instale em https://git-scm.com"; exit 1; }
command -v node >/dev/null 2>&1 || { echo "❌ Node.js não encontrado. Instale em https://nodejs.org (v18+)"; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "❌ npm não encontrado."; exit 1; }

echo "✓ Git: $(git --version)"
echo "✓ Node: $(node --version)"
echo ""

# Configurar variáveis
REPO_URL="${1:-https://github.com/robsonfeerreira9-svg/Robson.git}"
PROJECT_DIR="${2:-hg-grifes-erp}"

echo "Repositório: $REPO_URL"
echo "Diretório local: $PROJECT_DIR"
echo ""

# Clonar repositório (ou inicializar novo)
if [ -d "$PROJECT_DIR" ]; then
  echo "⚠️  Diretório $PROJECT_DIR já existe. Usando o existente."
  cd "$PROJECT_DIR"
else
  # Tentar clonar; se falhar, criar novo
  if git clone "$REPO_URL" "$PROJECT_DIR" 2>/dev/null; then
    cd "$PROJECT_DIR"
    echo "✓ Repositório clonado"
  else
    echo "Repositório vazio ou inacessível. Criando projeto novo..."
    mkdir -p "$PROJECT_DIR"
    cd "$PROJECT_DIR"
    git init
    git remote add origin "$REPO_URL"
  fi
fi

# Criar branch de trabalho
git checkout -b claude/setup-rls-tables-QA4Za 2>/dev/null || git checkout claude/setup-rls-tables-QA4Za 2>/dev/null || true

echo ""
echo "=== Criando estrutura do projeto ==="

# Criar diretórios
mkdir -p sql app/\(auth\)/login app/\(funcionario\)/pdv app/\(socio\)/{dashboard,produtos/novo,estoque,comissoes,financeiro} components/{ui,pdv} lib/utils docs

echo "✓ Diretórios criados"

# ================================================================
# ARQUIVO: .gitignore
# ================================================================
cat > .gitignore << 'GITIGNORE'
node_modules/
.pnp
.pnp.js
.next/
out/
.env
.env.local
.env.development.local
.env.test.local
.env.production.local
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.DS_Store
*.pem
.vercel
GITIGNORE

# ================================================================
# ARQUIVO: .env.local.example
# ================================================================
cat > .env.local.example << 'ENVEXAMPLE'
# Supabase — obtenha em: Supabase Dashboard > Project Settings > API
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
ENVEXAMPLE

# ================================================================
# ARQUIVO: package.json
# ================================================================
cat > package.json << 'PACKAGEJSON'
{
  "name": "hg-grifes-erp",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "@supabase/ssr": "^0.5.1",
    "@supabase/supabase-js": "^2.45.4",
    "next": "14.2.15",
    "react": "^18",
    "react-dom": "^18",
    "recharts": "^2.13.3",
    "swr": "^2.2.5"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "autoprefixer": "^10.0.1",
    "eslint": "^8",
    "eslint-config-next": "14.2.15",
    "postcss": "^8",
    "tailwindcss": "^3.4.1",
    "typescript": "^5"
  }
}
PACKAGEJSON

echo "✓ Arquivos de configuração criados"

# Instalar dependências
echo ""
echo "=== Instalando dependências (pode demorar 1-2 minutos) ==="
npm install --legacy-peer-deps
echo "✓ Dependências instaladas"

# Commit inicial
echo ""
echo "=== Fazendo commit e push ==="
git add -A
git commit -m "feat: HG Grifes ERP — setup inicial completo" 2>/dev/null || echo "Nada novo para commitar"

# Push
if git push -u origin claude/setup-rls-tables-QA4Za 2>/dev/null; then
  echo "✓ Push realizado com sucesso!"
else
  echo ""
  echo "⚠️  Push falhou. Execute manualmente:"
  echo "   git push -u origin claude/setup-rls-tables-QA4Za"
fi

echo ""
echo "=================================================="
echo "✅ PRÓXIMOS PASSOS:"
echo ""
echo "1. SUPABASE — Rode o SQL:"
echo "   • Acesse: https://app.supabase.com"
echo "   • Seu projeto > SQL Editor"
echo "   • Cole o conteúdo de: sql/schema.sql"
echo "   • Clique em Run"
echo ""
echo "2. VERCEL — Deploy:"
echo "   • Acesse: https://vercel.com/new"
echo "   • Importe o repositório: github.com/robsonfeerreira9-svg/Robson"
echo "   • Configure as variáveis de ambiente:"
echo "     NEXT_PUBLIC_SUPABASE_URL=sua-url-supabase"
echo "     NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anon"
echo "   • Clique em Deploy"
echo ""
echo "3. CONFIGURE no Supabase após deploy:"
echo "   Authentication > URL Configuration"
echo "   Site URL: https://seu-projeto.vercel.app"
echo "   Redirect URLs: https://seu-projeto.vercel.app/**"
echo ""
echo "4. CRIE o bucket de fotos no Supabase Storage:"
echo "   Bucket name: produtos (marcar como público)"
echo "=================================================="
