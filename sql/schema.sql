-- =====================================================
-- HG GRIFES ERP — Schema Completo
-- Fases 1: Tabelas + RLS + Stored Procedures + Seed
-- Rodar no Supabase SQL Editor (em ordem)
-- =====================================================

-- ─────────────────────────────────────────────────────
-- STEP 1 — TIPOS ENUM
-- ─────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE role_usuario AS ENUM ('socio', 'funcionario');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE tamanho_produto AS ENUM ('PP', 'P', 'M', 'G', 'GG', 'UNICO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE canal_produto AS ENUM ('fisico', 'online', 'ambos');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE canal_venda_tipo AS ENUM ('fisico', 'whatsapp', 'instagram');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE metodo_pagamento_tipo AS ENUM ('pix', 'credito', 'debito', 'dinheiro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE tipo_movimentacao AS ENUM ('entrada', 'saida');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE categoria_movimentacao AS ENUM ('venda', 'compra_estoque', 'custo_operacional', 'outro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ─────────────────────────────────────────────────────
-- STEP 2 — TABELAS
-- ─────────────────────────────────────────────────────

-- USUÁRIOS (sincronizado com auth.users via trigger)
CREATE TABLE IF NOT EXISTS public.usuarios (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       TEXT         NOT NULL,
  email      TEXT         NOT NULL UNIQUE,
  role       role_usuario NOT NULL DEFAULT 'funcionario',
  ativo      BOOLEAN      NOT NULL DEFAULT true,
  criado_em  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- CLIENTES (coletado no ato da venda)
CREATE TABLE IF NOT EXISTS public.clientes (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  cpf              TEXT        UNIQUE,
  nome             TEXT        NOT NULL,
  telefone         TEXT,
  data_nascimento  DATE,
  criado_em        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- PRODUTOS
CREATE TABLE IF NOT EXISTS public.produtos (
  id                UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  nome              TEXT            NOT NULL,
  foto_url          TEXT,
  tamanho           tamanho_produto NOT NULL,
  custo             NUMERIC(10,2)   NOT NULL DEFAULT 0,
  preco_venda       NUMERIC(10,2)   NOT NULL DEFAULT 0,
  markup_percentual NUMERIC(10,2)   NOT NULL DEFAULT 100,
  canal             canal_produto   NOT NULL DEFAULT 'ambos',
  criado_em         TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- ESTOQUE
CREATE TABLE IF NOT EXISTS public.estoque (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id      UUID        NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  quantidade      INTEGER     NOT NULL DEFAULT 0,
  ultima_venda_em TIMESTAMPTZ,
  atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- VENDAS
CREATE TABLE IF NOT EXISTS public.vendas (
  id                 UUID                   PRIMARY KEY DEFAULT gen_random_uuid(),
  vendedor_id        UUID                   NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  cliente_id         UUID                   REFERENCES public.clientes(id) ON DELETE SET NULL,
  canal_venda        canal_venda_tipo       NOT NULL,
  metodo_pagamento   metodo_pagamento_tipo  NOT NULL,
  subtotal           NUMERIC(10,2)          NOT NULL DEFAULT 0,
  desconto_aplicado  NUMERIC(10,2)          NOT NULL DEFAULT 0,
  total_final        NUMERIC(10,2)          NOT NULL DEFAULT 0,
  criado_em          TIMESTAMPTZ            NOT NULL DEFAULT NOW()
);

-- ITENS DA VENDA
CREATE TABLE IF NOT EXISTS public.itens_venda (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  venda_id       UUID          NOT NULL REFERENCES public.vendas(id) ON DELETE CASCADE,
  produto_id     UUID          NOT NULL REFERENCES public.produtos(id) ON DELETE RESTRICT,
  quantidade     INTEGER       NOT NULL DEFAULT 1,
  preco_unitario NUMERIC(10,2) NOT NULL,
  subtotal_item  NUMERIC(10,2) NOT NULL
);

-- COMISSÕES
CREATE TABLE IF NOT EXISTS public.comissoes (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  venda_id       UUID          NOT NULL REFERENCES public.vendas(id) ON DELETE CASCADE,
  vendedor_id    UUID          NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  percentual     NUMERIC(5,2)  NOT NULL DEFAULT 5,
  valor_comissao NUMERIC(10,2) NOT NULL DEFAULT 0,
  pago           BOOLEAN       NOT NULL DEFAULT false,
  criado_em      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- MOVIMENTAÇÃO DE CAIXA
CREATE TABLE IF NOT EXISTS public.movimentacao_caixa (
  id                  UUID                    PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo                tipo_movimentacao       NOT NULL,
  categoria           categoria_movimentacao  NOT NULL,
  descricao           TEXT,
  valor               NUMERIC(10,2)           NOT NULL DEFAULT 0,
  referencia_venda_id UUID                    REFERENCES public.vendas(id) ON DELETE SET NULL,
  criado_em           TIMESTAMPTZ             NOT NULL DEFAULT NOW()
);


-- ─────────────────────────────────────────────────────
-- STEP 3 — HABILITAR RLS
-- ─────────────────────────────────────────────────────
ALTER TABLE public.usuarios          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produtos          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estoque           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendas            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itens_venda       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comissoes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimentacao_caixa ENABLE ROW LEVEL SECURITY;


-- ─────────────────────────────────────────────────────
-- STEP 4 — FUNÇÃO AUXILIAR: obter role do usuário atual
-- ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role::TEXT FROM public.usuarios WHERE id = auth.uid();
$$;


-- ─────────────────────────────────────────────────────
-- STEP 5 — POLÍTICAS RLS
-- ─────────────────────────────────────────────────────

-- Remover políticas antigas antes de recriar (idempotente)
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- ── USUARIOS ──
CREATE POLICY "socio_full_usuarios" ON public.usuarios
  FOR ALL TO authenticated
  USING (public.get_current_user_role() = 'socio')
  WITH CHECK (public.get_current_user_role() = 'socio');

CREATE POLICY "funcionario_read_usuarios" ON public.usuarios
  FOR SELECT TO authenticated
  USING (public.get_current_user_role() = 'funcionario');

-- ── CLIENTES ──
-- Sócio: tudo; Funcionário: insert + select (para consultar no PDV)
CREATE POLICY "socio_full_clientes" ON public.clientes
  FOR ALL TO authenticated
  USING (public.get_current_user_role() = 'socio')
  WITH CHECK (public.get_current_user_role() = 'socio');

CREATE POLICY "funcionario_insert_clientes" ON public.clientes
  FOR INSERT TO authenticated
  WITH CHECK (public.get_current_user_role() = 'funcionario');

CREATE POLICY "funcionario_read_clientes" ON public.clientes
  FOR SELECT TO authenticated
  USING (public.get_current_user_role() = 'funcionario');

-- ── PRODUTOS ──
CREATE POLICY "socio_full_produtos" ON public.produtos
  FOR ALL TO authenticated
  USING (public.get_current_user_role() = 'socio')
  WITH CHECK (public.get_current_user_role() = 'socio');

CREATE POLICY "funcionario_read_produtos" ON public.produtos
  FOR SELECT TO authenticated
  USING (public.get_current_user_role() = 'funcionario');

-- ── ESTOQUE ──
CREATE POLICY "socio_full_estoque" ON public.estoque
  FOR ALL TO authenticated
  USING (public.get_current_user_role() = 'socio')
  WITH CHECK (public.get_current_user_role() = 'socio');

CREATE POLICY "funcionario_read_estoque" ON public.estoque
  FOR SELECT TO authenticated
  USING (public.get_current_user_role() = 'funcionario');

-- ── VENDAS ──
CREATE POLICY "socio_full_vendas" ON public.vendas
  FOR ALL TO authenticated
  USING (public.get_current_user_role() = 'socio')
  WITH CHECK (public.get_current_user_role() = 'socio');

CREATE POLICY "funcionario_insert_vendas" ON public.vendas
  FOR INSERT TO authenticated
  WITH CHECK (public.get_current_user_role() = 'funcionario');

CREATE POLICY "funcionario_read_own_vendas" ON public.vendas
  FOR SELECT TO authenticated
  USING (
    public.get_current_user_role() = 'funcionario'
    AND vendedor_id = auth.uid()
  );

-- ── ITENS_VENDA ──
CREATE POLICY "socio_full_itens_venda" ON public.itens_venda
  FOR ALL TO authenticated
  USING (public.get_current_user_role() = 'socio')
  WITH CHECK (public.get_current_user_role() = 'socio');

CREATE POLICY "funcionario_insert_itens_venda" ON public.itens_venda
  FOR INSERT TO authenticated
  WITH CHECK (public.get_current_user_role() = 'funcionario');

CREATE POLICY "funcionario_read_itens_venda" ON public.itens_venda
  FOR SELECT TO authenticated
  USING (public.get_current_user_role() = 'funcionario');

-- ── COMISSÕES ──
CREATE POLICY "socio_full_comissoes" ON public.comissoes
  FOR ALL TO authenticated
  USING (public.get_current_user_role() = 'socio')
  WITH CHECK (public.get_current_user_role() = 'socio');

CREATE POLICY "funcionario_read_own_comissoes" ON public.comissoes
  FOR SELECT TO authenticated
  USING (
    public.get_current_user_role() = 'funcionario'
    AND vendedor_id = auth.uid()
  );

-- ── MOVIMENTAÇÃO DE CAIXA ──
CREATE POLICY "socio_full_movimentacao" ON public.movimentacao_caixa
  FOR ALL TO authenticated
  USING (public.get_current_user_role() = 'socio')
  WITH CHECK (public.get_current_user_role() = 'socio');


-- ─────────────────────────────────────────────────────
-- STEP 6 — STORED PROCEDURE: realizar_venda()
-- Transação atômica: venda + itens + estoque + comissão + caixa + cliente
-- ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.realizar_venda(
  p_vendedor_id          UUID,
  p_canal_venda          canal_venda_tipo,
  p_metodo_pagamento     metodo_pagamento_tipo,
  p_subtotal             NUMERIC,
  p_desconto_aplicado    NUMERIC,
  p_total_final          NUMERIC,
  p_itens                JSONB,
  -- Dados do cliente (opcionais)
  p_cliente_cpf          TEXT    DEFAULT NULL,
  p_cliente_nome         TEXT    DEFAULT NULL,
  p_cliente_telefone     TEXT    DEFAULT NULL,
  p_cliente_nascimento   DATE    DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_venda_id    UUID;
  v_cliente_id  UUID;
  v_item        JSONB;
  v_estoque_qty INTEGER;
  v_comissao    NUMERIC;
BEGIN
  -- 1. Upsert cliente se CPF informado
  IF p_cliente_cpf IS NOT NULL AND trim(p_cliente_cpf) != '' THEN
    INSERT INTO public.clientes (cpf, nome, telefone, data_nascimento)
    VALUES (
      trim(p_cliente_cpf),
      COALESCE(p_cliente_nome, 'Cliente'),
      p_cliente_telefone,
      p_cliente_nascimento
    )
    ON CONFLICT (cpf) DO UPDATE
      SET nome            = EXCLUDED.nome,
          telefone        = EXCLUDED.telefone,
          data_nascimento = EXCLUDED.data_nascimento
    RETURNING id INTO v_cliente_id;
  END IF;

  -- 2. Inserir venda
  INSERT INTO public.vendas (
    vendedor_id, cliente_id, canal_venda, metodo_pagamento,
    subtotal, desconto_aplicado, total_final
  ) VALUES (
    p_vendedor_id, v_cliente_id, p_canal_venda, p_metodo_pagamento,
    p_subtotal, p_desconto_aplicado, p_total_final
  )
  RETURNING id INTO v_venda_id;

  -- 3. Processar cada item
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens) LOOP

    -- 3a. Inserir item_venda
    INSERT INTO public.itens_venda (
      venda_id, produto_id, quantidade, preco_unitario, subtotal_item
    ) VALUES (
      v_venda_id,
      (v_item->>'produto_id')::UUID,
      (v_item->>'quantidade')::INTEGER,
      (v_item->>'preco_unitario')::NUMERIC,
      (v_item->>'subtotal_item')::NUMERIC
    );

    -- 3b. Verificar estoque disponível
    SELECT quantidade INTO v_estoque_qty
    FROM public.estoque
    WHERE produto_id = (v_item->>'produto_id')::UUID;

    IF v_estoque_qty IS NULL THEN
      RAISE EXCEPTION 'Produto % não encontrado no estoque', (v_item->>'produto_id');
    END IF;

    IF v_estoque_qty < (v_item->>'quantidade')::INTEGER THEN
      RAISE EXCEPTION 'Estoque insuficiente para o produto %. Disponível: %, Solicitado: %',
        (v_item->>'produto_id'), v_estoque_qty, (v_item->>'quantidade')::INTEGER;
    END IF;

    -- 3c. Debitar estoque e atualizar ultima_venda_em
    UPDATE public.estoque
    SET
      quantidade      = quantidade - (v_item->>'quantidade')::INTEGER,
      ultima_venda_em = NOW(),
      atualizado_em   = NOW()
    WHERE produto_id = (v_item->>'produto_id')::UUID;

  END LOOP;

  -- 4. Calcular e inserir comissão (5% do total_final)
  v_comissao := ROUND(p_total_final * 0.05, 2);
  INSERT INTO public.comissoes (venda_id, vendedor_id, percentual, valor_comissao)
  VALUES (v_venda_id, p_vendedor_id, 5, v_comissao);

  -- 5. Registrar entrada no caixa
  INSERT INTO public.movimentacao_caixa (tipo, categoria, descricao, valor, referencia_venda_id)
  VALUES (
    'entrada',
    'venda',
    'Venda #' || v_venda_id::TEXT,
    p_total_final,
    v_venda_id
  );

  RETURN v_venda_id;

EXCEPTION
  WHEN OTHERS THEN
    RAISE; -- propaga o erro e reverte a transação
END;
$$;


-- ─────────────────────────────────────────────────────
-- STEP 7 — TRIGGER: sincronizar auth.users → usuarios
-- ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.usuarios (id, nome, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(
      (NEW.raw_user_meta_data->>'role')::role_usuario,
      'funcionario'
    )
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();


-- ─────────────────────────────────────────────────────
-- STEP 8 — SEED: usuários de teste
-- ─────────────────────────────────────────────────────
DO $$
DECLARE
  v_socio_id UUID;
  v_func_id  UUID;
BEGIN

  -- ── Sócio ──
  SELECT id INTO v_socio_id FROM auth.users WHERE email = 'socio@hggrifes.com';

  IF v_socio_id IS NULL THEN
    v_socio_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, aud, role,
      email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, recovery_token,
      email_change_token_new, email_change
    ) VALUES (
      v_socio_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      'socio@hggrifes.com',
      crypt('HG@2024socio', gen_salt('bf')),
      NOW(),
      '{"provider":"email","providers":["email"]}',
      '{"nome":"Admin Sócio","role":"socio"}',
      NOW(), NOW(),
      '', '', '', ''
    );
  END IF;

  INSERT INTO public.usuarios (id, nome, email, role, ativo)
  VALUES (v_socio_id, 'Admin Sócio', 'socio@hggrifes.com', 'socio', true)
  ON CONFLICT (email) DO UPDATE SET nome = EXCLUDED.nome, role = EXCLUDED.role, ativo = EXCLUDED.ativo;

  -- ── Funcionário ──
  SELECT id INTO v_func_id FROM auth.users WHERE email = 'func1@hggrifes.com';

  IF v_func_id IS NULL THEN
    v_func_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, aud, role,
      email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, recovery_token,
      email_change_token_new, email_change
    ) VALUES (
      v_func_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      'func1@hggrifes.com',
      crypt('HG@2024func1', gen_salt('bf')),
      NOW(),
      '{"provider":"email","providers":["email"]}',
      '{"nome":"Funcionário Teste","role":"funcionario"}',
      NOW(), NOW(),
      '', '', '', ''
    );
  END IF;

  INSERT INTO public.usuarios (id, nome, email, role, ativo)
  VALUES (v_func_id, 'Funcionário Teste', 'func1@hggrifes.com', 'funcionario', true)
  ON CONFLICT (email) DO UPDATE SET nome = EXCLUDED.nome, role = EXCLUDED.role, ativo = EXCLUDED.ativo;

END $$;


-- ─────────────────────────────────────────────────────
-- VALIDAÇÃO FINAL
-- ─────────────────────────────────────────────────────
-- Execute para confirmar que tudo foi criado:
SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public'
  ORDER BY table_name;

SELECT routine_name FROM information_schema.routines
  WHERE routine_schema = 'public' AND routine_type = 'FUNCTION'
  ORDER BY routine_name;

SELECT email, role, ativo FROM public.usuarios ORDER BY role;
-- Esperado: func1@hggrifes.com (funcionario), socio@hggrifes.com (socio)
