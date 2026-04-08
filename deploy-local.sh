#!/usr/bin/env bash
# =====================================================
# HG GRIFES ERP — Script de Deploy Automático
# Execute no SEU computador (não no Claude Code)
# =====================================================

set -e

SUPABASE_URL="https://eaovtnotwfzuxgtqpkay.supabase.co"
SUPABASE_ANON="sb_publishable_MhNCcezzMUbC7eEXfKByEA_xrFfZnl_"
GITHUB_REPO="robsonfeerreira9-svg/Robson"
BRANCH="claude/setup-rls-tables-QA4Za"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; exit 1; }

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   HG GRIFES ERP — Deploy Automático"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── CREDENCIAIS ──────────────────────────────────────
echo "Você precisa de 2 credenciais do Supabase e 1 do Vercel:"
echo ""
echo "  Supabase service_role key:"
echo "  → supabase.com → projeto eaovtnotwfzuxgtqpkay"
echo "  → Project Settings → API → service_role"
echo ""
read -rsp "  Cole a service_role key: " SUPABASE_KEY
echo ""

echo ""
echo "  Vercel Personal Token:"
echo "  → vercel.com/account/tokens → Create Token"
echo ""
read -rsp "  Cole o Vercel token: " VERCEL_TOKEN
echo ""
echo ""

[ -z "$SUPABASE_KEY" ] && error "service_role key não pode estar vazio"
[ -z "$VERCEL_TOKEN" ] && error "Vercel token não pode estar vazio"

# ── NODE.JS ───────────────────────────────────────────
info "Verificando Node.js..."
command -v node &>/dev/null || error "Node.js não encontrado. Instale em nodejs.org"
NODE_VER=$(node -e "process.exit(process.version.slice(1).split('.')[0] < 18 ? 1 : 0)" 2>/dev/null && echo "ok" || echo "old")
[ "$NODE_VER" = "old" ] && warn "Node.js < 18. Recomendado 20+."

# ── CLONAR REPO ───────────────────────────────────────
info "Clonando repositório..."
if [ ! -d "Robson-deploy" ]; then
  git clone -b "$BRANCH" "https://github.com/$GITHUB_REPO.git" Robson-deploy
fi
cd Robson-deploy

# ── ENV LOCAL ─────────────────────────────────────────
info "Configurando .env.local..."
cat > .env.local <<EOF
NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=$SUPABASE_ANON
EOF

# ── SUPABASE MIGRATION ────────────────────────────────
info "Rodando migration no Supabase via API..."

SQL=$(cat sql/schema.sql)

RESPONSE=$(curl -s -w "\n%{http_code}" \
  "$SUPABASE_URL/rest/v1/rpc/" \
  -H "apikey: $SUPABASE_KEY" \
  -H "Authorization: Bearer $SUPABASE_KEY" \
  -H "Content-Type: application/json" || true)

# Usa a Management API do Supabase
info "Executando schema.sql via Supabase Management API..."
MG_RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X POST "https://api.supabase.com/v1/projects/eaovtnotwfzuxgtqpkay/database/query" \
  -H "Authorization: Bearer $SUPABASE_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"query\": $(echo "$SQL" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')}")

HTTP_CODE=$(echo "$MG_RESPONSE" | tail -1)
if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
  info "Schema criado com sucesso!"
else
  warn "API retornou $HTTP_CODE. Tentando via psql..."
  DB_URL="postgresql://postgres:$(python3 -c "import urllib.parse; print(urllib.parse.quote('$SUPABASE_KEY'))")@db.eaovtnotwfzuxgtqpkay.supabase.co:5432/postgres"
  if command -v psql &>/dev/null; then
    psql "$DB_URL" -f sql/schema.sql && info "Schema aplicado via psql!"
  else
    warn "psql não disponível."
    echo ""
    echo "  ► Acesse: https://app.supabase.com/project/eaovtnotwfzuxgtqpkay/sql/new"
    echo "  ► Copie o conteúdo de: sql/schema.sql"
    echo "  ► Cole no SQL Editor e clique RUN"
    echo ""
    read -rp "  Pressione ENTER após rodar o SQL no dashboard..."
  fi
fi

# ── SUPABASE STORAGE BUCKET ───────────────────────────
info "Criando bucket 'produtos' no Supabase Storage..."
curl -s -X POST \
  "$SUPABASE_URL/storage/v1/bucket" \
  -H "apikey: $SUPABASE_KEY" \
  -H "Authorization: Bearer $SUPABASE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"id":"produtos","name":"produtos","public":true}' | grep -q '"id"' \
  && info "Bucket 'produtos' criado!" \
  || warn "Bucket pode já existir ou erro ao criar."

# ── VERCEL DEPLOY ─────────────────────────────────────
info "Instalando Vercel CLI..."
npm install -g vercel@latest --silent

info "Linkando projeto no Vercel..."
vercel link \
  --token="$VERCEL_TOKEN" \
  --scope="team_NRmTqJ7tXyq4AOLENBGyFHsa" \
  --yes 2>/dev/null || true

info "Adicionando variáveis de ambiente no Vercel..."
echo "$SUPABASE_URL" | vercel env add NEXT_PUBLIC_SUPABASE_URL production \
  --token="$VERCEL_TOKEN" --force 2>/dev/null || true
echo "$SUPABASE_ANON" | vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production \
  --token="$VERCEL_TOKEN" --force 2>/dev/null || true

info "Fazendo deploy para produção..."
DEPLOY_URL=$(vercel deploy --prod \
  --token="$VERCEL_TOKEN" \
  --yes 2>&1 | grep -E "https://" | tail -1)

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅ DEPLOY CONCLUÍDO!"
echo ""
echo "  URL: $DEPLOY_URL"
echo ""
echo "  Próximos passos:"
echo "  1. Acesse o Supabase → Authentication → URL Config"
echo "     Site URL: $DEPLOY_URL"
echo "     Redirect URL: $DEPLOY_URL/**"
echo ""
echo "  2. Logins de teste:"
echo "     Sócio:       socio@hggrifes.com / HG@2024socio"
echo "     Funcionário: func1@hggrifes.com / HG@2024func1"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
