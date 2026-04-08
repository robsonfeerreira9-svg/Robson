# HG GRIFES — Guia de Deploy (Fase 7)

## 1. Pré-requisitos

- Conta no [Vercel](https://vercel.com)
- Projeto no [Supabase](https://supabase.com) com o SQL da Fase 1 rodado
- Repositório no GitHub com o código deste projeto

---

## 2. Checklist de Deploy no Vercel

### Passo a passo:

**a. Push para o GitHub**
```bash
git add -A
git commit -m "chore: setup inicial HG Grifes ERP"
git push origin main
```

**b. Criar projeto no Vercel**
1. Acesse [vercel.com/new](https://vercel.com/new)
2. Importe o repositório do GitHub
3. Framework Preset: **Next.js** (detectado automaticamente)
4. Clique em **Deploy**

**c. Configurar variáveis de ambiente no Vercel**

No painel do projeto Vercel:  
`Settings > Environment Variables`

| Nome | Valor |
|------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do seu projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave anon do Supabase |

**d. Configurar Supabase Auth — URL Configuration**

No Supabase Dashboard:  
`Authentication > URL Configuration`

- **Site URL:** `https://seu-projeto.vercel.app`
- **Redirect URLs:** `https://seu-projeto.vercel.app/**`

**e. Configurar Storage bucket como público**

No Supabase Dashboard:  
`Storage > Buckets > produtos > Make public`

Ou via SQL:
```sql
UPDATE storage.buckets SET public = true WHERE name = 'produtos';
```

**f. Criar usuário sócio definitivo em produção**

1. No Supabase Dashboard: `Authentication > Users > Add user`
2. Email: `seu-email@dominio.com`, senha forte
3. Rodar SQL para definir como sócio:

```sql
-- Substitua o email pelo email real do sócio
INSERT INTO public.usuarios (id, nome, email, role, ativo)
SELECT id, 'Nome do Sócio', email, 'socio', true
FROM auth.users
WHERE email = 'seu-email@dominio.com'
ON CONFLICT (email) DO UPDATE SET role = 'socio';
```

---

## 3. Smoke Test em Produção

Checklist para validar que tudo está funcionando:

- [ ] **Login sócio**: socio@hggrifes.com → vai para /dashboard
- [ ] **Login funcionário**: func@hggrifes.com → vai para /pdv
- [ ] **PDV**: produtos aparecem no grid
- [ ] **PDV**: adicionar produto ao carrinho funciona
- [ ] **PDV**: selecionar PIX mostra desconto automático
- [ ] **PDV**: preencher dados do cliente (CPF, nome, telefone, nascimento)
- [ ] **PDV**: finalizar venda → estoque baixa no Supabase
- [ ] **Estoque**: produto aparece na tabela de estoque
- [ ] **Dashboard**: KPIs atualizam após venda
- [ ] **Comissões**: comissão de 5% aparece após venda
- [ ] **Financeiro**: entrada de caixa registrada após venda
- [ ] **Upload de foto**: cadastro de produto com foto funciona

---

## 4. Erros Comuns de Deploy Next.js + Supabase

### Erro 1: `Error: supabaseUrl is required`
**Causa:** Variáveis de ambiente não configuradas no Vercel.  
**Solução:** Configure `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` no painel do Vercel e faça um novo deploy.

### Erro 2: `AuthSessionMissingError` / Loop de redirect no login
**Causa:** `Site URL` no Supabase não bate com o domínio do Vercel.  
**Solução:** Configure em `Authentication > URL Configuration > Site URL` com a URL exata do Vercel.

### Erro 3: `new Row violates row-level security policy`
**Causa:** Política RLS bloqueando a operação.  
**Solução:** Verifique se o SQL da Fase 1 foi rodado corretamente. Confirme que a função `get_current_user_role()` retorna o role correto para o usuário logado.

### Erro 4: `StorageApiError: Bucket not found` ao fazer upload de foto
**Causa:** Bucket `produtos` não existe ou não é público.  
**Solução:** Crie o bucket no Supabase Dashboard > Storage com nome exato `produtos` e marque como público.

### Erro 5: Build falha com `Module not found`
**Causa:** Dependência faltando ou path alias incorreto.  
**Solução:** Verifique se `@/*` está configurado no `tsconfig.json` e rode `npm install` localmente antes do push.

---

## 5. Comandos úteis

```bash
# Desenvolvimento local
npm install
cp .env.local.example .env.local
# (preencha .env.local com suas credenciais)
npm run dev

# Build local para testar
npm run build
npm run start

# Verificar erros de TypeScript
npx tsc --noEmit
```
