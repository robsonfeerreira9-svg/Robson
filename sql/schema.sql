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
  v_venda_id        UUID;
  v_cliente_id      UUID;
  v_item            JSONB;
  v_estoque_qty     INTEGER;
  v_comissao        NUMERIC;
  v_base_comissao   NUMERIC;
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

  -- 4. Calcular e inserir comissão (5% do valor líquido após taxa de maquininha)
  -- Crédito/débito: desconta 5,30% de taxa antes de calcular a comissão da vendedora
  IF p_metodo_pagamento IN ('credito', 'debito') THEN
    v_base_comissao := ROUND(p_total_final * (1 - 0.053), 2);
  ELSE
    v_base_comissao := p_total_final;
  END IF;
  v_comissao := ROUND(v_base_comissao * 0.05, 2);
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
-- STEP 9 — STORAGE: políticas RLS do bucket 'produtos'
-- ─────────────────────────────────────────────────────

-- Remover políticas existentes do bucket produtos (idempotente)
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname LIKE '%produtos%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', r.policyname);
  END LOOP;
END $$;

-- Leitura pública (bucket é público)
CREATE POLICY "public_read_produtos_storage" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'produtos');

-- Sócio: upload, atualização e exclusão
CREATE POLICY "socio_insert_produtos_storage" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'produtos' AND public.get_current_user_role() = 'socio');

CREATE POLICY "socio_update_produtos_storage" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'produtos' AND public.get_current_user_role() = 'socio');

CREATE POLICY "socio_delete_produtos_storage" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'produtos' AND public.get_current_user_role() = 'socio');


-- ─────────────────────────────────────────────────────
-- STEP 10 — TABELA CAMPANHAS + RLS
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.campanhas (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  nome         TEXT         NOT NULL,
  descricao    TEXT,
  desconto_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  ativa        BOOLEAN      NOT NULL DEFAULT true,
  criado_em    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

ALTER TABLE public.campanhas ENABLE ROW LEVEL SECURITY;

-- Sócio: acesso total; funcionário: somente leitura
CREATE POLICY "socio_full_campanhas" ON public.campanhas
  FOR ALL TO authenticated
  USING (public.get_current_user_role() = 'socio')
  WITH CHECK (public.get_current_user_role() = 'socio');

CREATE POLICY "funcionario_read_campanhas" ON public.campanhas
  FOR SELECT TO authenticated
  USING (public.get_current_user_role() = 'funcionario');


-- ─────────────────────────────────────────────────────
-- STEP 11 — SEED: Camilly e Ciara
-- ─────────────────────────────────────────────────────
DO $$
DECLARE
  v_camilly_id UUID;
  v_ciara_id   UUID;
BEGIN

  -- ── Camilly ──
  SELECT id INTO v_camilly_id FROM auth.users WHERE email = 'camilly@hggrifes.com';
  IF v_camilly_id IS NULL THEN
    v_camilly_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, aud, role,
      email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, recovery_token,
      email_change_token_new, email_change
    ) VALUES (
      v_camilly_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      'camilly@hggrifes.com',
      crypt('HG@2024camilly', gen_salt('bf')),
      NOW(),
      '{"provider":"email","providers":["email"]}',
      '{"nome":"Camilly","role":"funcionario"}',
      NOW(), NOW(),
      '', '', '', ''
    );
  END IF;
  INSERT INTO public.usuarios (id, nome, email, role, ativo)
  VALUES (v_camilly_id, 'Camilly', 'camilly@hggrifes.com', 'funcionario', true)
  ON CONFLICT (email) DO UPDATE SET nome = EXCLUDED.nome, role = EXCLUDED.role, ativo = EXCLUDED.ativo;

  -- ── Ciara ──
  SELECT id INTO v_ciara_id FROM auth.users WHERE email = 'ciara@hggrifes.com';
  IF v_ciara_id IS NULL THEN
    v_ciara_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, aud, role,
      email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, recovery_token,
      email_change_token_new, email_change
    ) VALUES (
      v_ciara_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      'ciara@hggrifes.com',
      crypt('HG@2024ciara', gen_salt('bf')),
      NOW(),
      '{"provider":"email","providers":["email"]}',
      '{"nome":"Ciara","role":"funcionario"}',
      NOW(), NOW(),
      '', '', '', ''
    );
  END IF;
  INSERT INTO public.usuarios (id, nome, email, role, ativo)
  VALUES (v_ciara_id, 'Ciara', 'ciara@hggrifes.com', 'funcionario', true)
  ON CONFLICT (email) DO UPDATE SET nome = EXCLUDED.nome, role = EXCLUDED.role, ativo = EXCLUDED.ativo;

END $$;


-- ─────────────────────────────────────────────────────
-- STEP 12 — SEED: 47 Produtos (idempotente por nome+tamanho)
-- Insere apenas os que ainda não existem — nunca duplica.
-- ─────────────────────────────────────────────────────
DO $$
BEGIN
  -- Inserir produtos que ainda não existem (por nome + tamanho)
  INSERT INTO public.produtos (nome, tamanho, canal, custo, markup_percentual, preco_venda)
  SELECT t.nome, t.tam::tamanho_produto, t.canal::canal_produto,
         t.custo::NUMERIC, t.markup::NUMERIC, t.preco::NUMERIC
  FROM (VALUES
    -- Produtos removidos a pedido (12/05/2026): Basic Oversize P/G/M, Estampada HG G/M, Gola Alta Preta M
    -- Polo Preta M, Polo Branca G, Manga Longa M removidos (12/05/2026)
    ('Bermuda Tactel Preta',           'M',     'ambos',  50.00, 180.00, 140.00),
    ('Bermuda Tactel Cinza',           'G',     'ambos',  50.00, 180.00, 140.00),
    ('Bermuda Moletom Preta',          'M',     'ambos',  65.00, 161.54, 170.00),
    ('Bermuda Moletom Cinza',          'G',     'ambos',  65.00, 161.54, 170.00),
    ('Bermuda Cargo Preta',            'M',     'fisico', 75.00, 166.67, 200.00),
    ('Calça Jogger Preta',             'M',     'ambos',  80.00, 175.00, 220.00),
    ('Calça Jogger Cinza',             'G',     'ambos',  80.00, 175.00, 220.00),
    ('Calça Jeans Skinny Preta',       'G',     'fisico', 90.00, 166.67, 240.00),
    ('Calça Cargo Bege',               'M',     'fisico', 95.00, 173.68, 260.00),
    ('Calça Moletom Preta',            'M',     'ambos',  85.00, 170.59, 230.00),
    ('Moletom HG Preto',               'M',     'ambos', 120.00, 166.67, 320.00),
    ('Moletom HG Cinza',               'G',     'ambos', 120.00, 166.67, 320.00),
    ('Moletom HG Branco',              'M',     'ambos', 120.00, 166.67, 320.00),
    ('Moletom Cropped Preto',          'P',     'ambos', 110.00, 163.64, 290.00),
    ('Moletom Cropped Bege',           'M',     'ambos', 110.00, 163.64, 290.00),
    -- Hoodie HG Logo M/G/P e Corta-Vento M removidos (12/05/2026)
    ('Boné HG Preto',                  'UNICO', 'ambos',  35.00, 171.43,  95.00),
    ('Boné HG Bege',                   'UNICO', 'ambos',  35.00, 171.43,  95.00),
    ('Boné Trucker Preto',             'UNICO', 'ambos',  40.00, 175.00, 110.00),
    ('Boné Snapback Cinza',            'UNICO', 'fisico', 40.00, 175.00, 110.00),
    ('Boné 5 Panel Preto',             'UNICO', 'fisico', 38.00, 163.16, 100.00),
    -- Jaqueta Corta-vento Preta M, Azul G, Bomber Preta M removidas (12/05/2026)
    ('Jaqueta Jeans Preta',            'P',     'fisico',160.00, 168.75, 430.00),
    ('Regata Oversize Preta',          'M',     'ambos',  38.00, 163.16, 100.00),
    ('Regata Oversize Branca',         'M',     'ambos',  38.00, 163.16, 100.00),
    ('Regata Oversize Cinza',          'G',     'ambos',  38.00, 163.16, 100.00),
    ('Regata HG Estampada',            'M',     'fisico', 45.00, 166.67, 120.00),
    ('Meia HG Pack c/3',               'UNICO', 'fisico', 25.00, 160.00,  65.00),
    ('Necessaire HG Preta',            'UNICO', 'fisico', 30.00, 166.67,  80.00),
    ('Cinto Couro Preto',              'UNICO', 'fisico', 20.00, 175.00,  55.00),
    ('Conjunto Moletom Preto',         'M',     'fisico',200.00, 170.00, 540.00),
    ('Conjunto Tactel Preto',          'M',     'fisico',120.00, 175.00, 330.00)
  ) AS t(nome, tam, canal, custo, markup, preco)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.produtos p
    WHERE p.nome = t.nome AND p.tamanho::TEXT = t.tam
  );

  -- Inserir estoque para produtos que ainda não têm registro
  INSERT INTO public.estoque (produto_id, quantidade)
  SELECT p.id, dados.qty::INTEGER
  FROM public.produtos p
  JOIN (VALUES
    -- Estoque removido junto com produtos (12/05/2026)
    ('Camiseta Polo Preta',            'M',      4),
    -- Polo Branca G e Manga Longa M removidos (12/05/2026)
    ('Bermuda Tactel Preta',           'M',      6),
    ('Bermuda Tactel Cinza',           'G',      5),
    ('Bermuda Moletom Preta',          'M',      4),
    ('Bermuda Moletom Cinza',          'G',      4),
    ('Bermuda Cargo Preta',            'M',      3),
    ('Calça Jogger Preta',             'M',      5),
    ('Calça Jogger Cinza',             'G',      4),
    ('Calça Jeans Skinny Preta',       'G',      3),
    ('Calça Cargo Bege',               'M',      4),
    ('Calça Moletom Preta',            'M',      4),
    ('Moletom HG Preto',               'M',      5),
    ('Moletom HG Cinza',               'G',      5),
    ('Moletom HG Branco',              'M',      4),
    ('Moletom Cropped Preto',          'P',      3),
    ('Moletom Cropped Bege',           'M',      3),
    -- Hoodie HG Logo e Corta-Vento removidos (12/05/2026)
    ('Boné HG Preto',                  'UNICO',  8),
    ('Boné HG Bege',                   'UNICO',  7),
    ('Boné Trucker Preto',             'UNICO',  6),
    ('Boné Snapback Cinza',            'UNICO',  5),
    ('Boné 5 Panel Preto',             'UNICO',  5),
    -- Jaquetas removidas (12/05/2026)
    ('Jaqueta Jeans Preta',            'P',      2),
    ('Regata Oversize Preta',          'M',      7),
    ('Regata Oversize Branca',         'M',      6),
    ('Regata Oversize Cinza',          'G',      5),
    ('Regata HG Estampada',            'M',      4),
    ('Meia HG Pack c/3',               'UNICO', 10),
    ('Necessaire HG Preta',            'UNICO',  6),
    ('Cinto Couro Preto',              'UNICO',  5),
    ('Conjunto Moletom Preto',         'M',      3),
    ('Conjunto Tactel Preto',          'M',      4)
  ) AS dados(nome, tamanho, qty)
    ON p.nome = dados.nome AND p.tamanho::TEXT = dados.tamanho
  WHERE NOT EXISTS (SELECT 1 FROM public.estoque e WHERE e.produto_id = p.id);

END $$;


-- ─────────────────────────────────────────────────────
-- STEP 13 — SEED: Histórico de Vendas (somente se vazio)
-- Insere diretamente sem chamar realizar_venda() para não
-- alterar o estoque (o estoque já reflete o estado atual).
-- Requer que os produtos do STEP 12 existam (nome exato).
-- ─────────────────────────────────────────────────────
DO $$
DECLARE
  v_camilly UUID;
  v_ciara   UUID;
  v_vid     UUID;
  v_pid1    UUID;
  v_pid2    UUID;
BEGIN
  IF (SELECT COUNT(*) FROM public.vendas) > 0 THEN RETURN; END IF;

  -- Verificar se os produtos do seed existem; se não, pular silenciosamente
  IF (SELECT COUNT(*) FROM public.produtos WHERE nome = 'Camiseta Basic Oversize Preta' AND tamanho = 'M') = 0 THEN
    RAISE NOTICE 'Produtos do seed não encontrados (tabela já tinha dados). Pulando histórico de vendas.';
    RETURN;
  END IF;

  SELECT id INTO v_camilly FROM public.usuarios WHERE email = 'camilly@hggrifes.com';
  SELECT id INTO v_ciara   FROM public.usuarios WHERE email = 'ciara@hggrifes.com';

  IF v_camilly IS NULL OR v_ciara IS NULL THEN
    RAISE NOTICE 'Vendedoras não encontradas, pulando seed de vendas.';
    RETURN;
  END IF;

  -- ── Venda 1: 01/04 — Camilly — PIX — Física ──
  -- Camiseta Basic Oversize Preta M + Bermuda Tactel Preta M
  -- subtotal 260 | desconto 7% = 18.20 | total 241.80
  INSERT INTO public.vendas (vendedor_id, canal_venda, metodo_pagamento, subtotal, desconto_aplicado, total_final, criado_em)
  VALUES (v_camilly, 'fisico', 'pix', 260.00, 18.20, 241.80, '2026-04-01 10:30:00+00')
  RETURNING id INTO v_vid;
  SELECT id INTO v_pid1 FROM public.produtos WHERE nome = 'Camiseta Basic Oversize Preta' AND tamanho = 'M';
  SELECT id INTO v_pid2 FROM public.produtos WHERE nome = 'Bermuda Tactel Preta'          AND tamanho = 'M';
  INSERT INTO public.itens_venda (venda_id, produto_id, quantidade, preco_unitario, subtotal_item) VALUES
    (v_vid, v_pid1, 1, 120.00, 120.00),
    (v_vid, v_pid2, 1, 140.00, 140.00);
  INSERT INTO public.comissoes (venda_id, vendedor_id, percentual, valor_comissao) VALUES (v_vid, v_camilly, 5, 12.09);
  INSERT INTO public.movimentacao_caixa (tipo, categoria, descricao, valor, referencia_venda_id) VALUES ('entrada', 'venda', 'Venda #' || v_vid::TEXT, 241.80, v_vid);

  -- ── Venda 2: 02/04 — Ciara — PIX — WhatsApp ──
  -- Moletom HG Preto M | subtotal 320 | desconto 7% = 22.40 | total 297.60
  INSERT INTO public.vendas (vendedor_id, canal_venda, metodo_pagamento, subtotal, desconto_aplicado, total_final, criado_em)
  VALUES (v_ciara, 'whatsapp', 'pix', 320.00, 22.40, 297.60, '2026-04-02 14:15:00+00')
  RETURNING id INTO v_vid;
  SELECT id INTO v_pid1 FROM public.produtos WHERE nome = 'Moletom HG Preto' AND tamanho = 'M';
  INSERT INTO public.itens_venda (venda_id, produto_id, quantidade, preco_unitario, subtotal_item) VALUES (v_vid, v_pid1, 1, 320.00, 320.00);
  INSERT INTO public.comissoes (venda_id, vendedor_id, percentual, valor_comissao) VALUES (v_vid, v_ciara, 5, 14.88);
  INSERT INTO public.movimentacao_caixa (tipo, categoria, descricao, valor, referencia_venda_id) VALUES ('entrada', 'venda', 'Venda #' || v_vid::TEXT, 297.60, v_vid);

  -- ── Venda 3: 03/04 — Camilly — Crédito — Física ──
  -- Calça Jogger Preta M | subtotal 220 | desconto 0 | total 220.00
  INSERT INTO public.vendas (vendedor_id, canal_venda, metodo_pagamento, subtotal, desconto_aplicado, total_final, criado_em)
  VALUES (v_camilly, 'fisico', 'credito', 220.00, 0.00, 220.00, '2026-04-03 11:00:00+00')
  RETURNING id INTO v_vid;
  SELECT id INTO v_pid1 FROM public.produtos WHERE nome = 'Calça Jogger Preta' AND tamanho = 'M';
  INSERT INTO public.itens_venda (venda_id, produto_id, quantidade, preco_unitario, subtotal_item) VALUES (v_vid, v_pid1, 1, 220.00, 220.00);
  INSERT INTO public.comissoes (venda_id, vendedor_id, percentual, valor_comissao) VALUES (v_vid, v_camilly, 5, 11.00);
  INSERT INTO public.movimentacao_caixa (tipo, categoria, descricao, valor, referencia_venda_id) VALUES ('entrada', 'venda', 'Venda #' || v_vid::TEXT, 220.00, v_vid);

  -- ── Venda 4: 04/04 — Ciara — PIX — Física ──
  -- Boné HG Preto UNICO + Regata Oversize Preta M
  -- subtotal 195 | desconto 7% = 13.65 | total 181.35
  INSERT INTO public.vendas (vendedor_id, canal_venda, metodo_pagamento, subtotal, desconto_aplicado, total_final, criado_em)
  VALUES (v_ciara, 'fisico', 'pix', 195.00, 13.65, 181.35, '2026-04-04 15:45:00+00')
  RETURNING id INTO v_vid;
  SELECT id INTO v_pid1 FROM public.produtos WHERE nome = 'Boné HG Preto'       AND tamanho = 'UNICO';
  SELECT id INTO v_pid2 FROM public.produtos WHERE nome = 'Regata Oversize Preta' AND tamanho = 'M';
  INSERT INTO public.itens_venda (venda_id, produto_id, quantidade, preco_unitario, subtotal_item) VALUES
    (v_vid, v_pid1, 1,  95.00,  95.00),
    (v_vid, v_pid2, 1, 100.00, 100.00);
  INSERT INTO public.comissoes (venda_id, vendedor_id, percentual, valor_comissao) VALUES (v_vid, v_ciara, 5, 9.07);
  INSERT INTO public.movimentacao_caixa (tipo, categoria, descricao, valor, referencia_venda_id) VALUES ('entrada', 'venda', 'Venda #' || v_vid::TEXT, 181.35, v_vid);

  -- ── Venda 5: 05/04 — Camilly — Crédito — Física ──
  -- Jaqueta Corta-vento Preta M | subtotal 380 | desconto 0 | total 380.00
  INSERT INTO public.vendas (vendedor_id, canal_venda, metodo_pagamento, subtotal, desconto_aplicado, total_final, criado_em)
  VALUES (v_camilly, 'fisico', 'credito', 380.00, 0.00, 380.00, '2026-04-05 16:20:00+00')
  RETURNING id INTO v_vid;
  SELECT id INTO v_pid1 FROM public.produtos WHERE nome = 'Jaqueta Corta-vento Preta' AND tamanho = 'M';
  INSERT INTO public.itens_venda (venda_id, produto_id, quantidade, preco_unitario, subtotal_item) VALUES (v_vid, v_pid1, 1, 380.00, 380.00);
  INSERT INTO public.comissoes (venda_id, vendedor_id, percentual, valor_comissao) VALUES (v_vid, v_camilly, 5, 19.00);
  INSERT INTO public.movimentacao_caixa (tipo, categoria, descricao, valor, referencia_venda_id) VALUES ('entrada', 'venda', 'Venda #' || v_vid::TEXT, 380.00, v_vid);

  -- ── Venda 6: 06/04 — Ciara — Débito — Física ──
  -- Camiseta Polo Preta M + Bermuda Cargo Preta M
  -- subtotal 390 | desconto 0 | total 390.00
  INSERT INTO public.vendas (vendedor_id, canal_venda, metodo_pagamento, subtotal, desconto_aplicado, total_final, criado_em)
  VALUES (v_ciara, 'fisico', 'debito', 390.00, 0.00, 390.00, '2026-04-06 13:00:00+00')
  RETURNING id INTO v_vid;
  SELECT id INTO v_pid1 FROM public.produtos WHERE nome = 'Camiseta Polo Preta' AND tamanho = 'M';
  SELECT id INTO v_pid2 FROM public.produtos WHERE nome = 'Bermuda Cargo Preta' AND tamanho = 'M';
  INSERT INTO public.itens_venda (venda_id, produto_id, quantidade, preco_unitario, subtotal_item) VALUES
    (v_vid, v_pid1, 1, 190.00, 190.00),
    (v_vid, v_pid2, 1, 200.00, 200.00);
  INSERT INTO public.comissoes (venda_id, vendedor_id, percentual, valor_comissao) VALUES (v_vid, v_ciara, 5, 19.50);
  INSERT INTO public.movimentacao_caixa (tipo, categoria, descricao, valor, referencia_venda_id) VALUES ('entrada', 'venda', 'Venda #' || v_vid::TEXT, 390.00, v_vid);

  -- ── Venda 7: 07/04 — Camilly — PIX — Física ──
  -- Hoodie HG Logo Preto M | subtotal 350 | desconto 7% = 24.50 | total 325.50
  INSERT INTO public.vendas (vendedor_id, canal_venda, metodo_pagamento, subtotal, desconto_aplicado, total_final, criado_em)
  VALUES (v_camilly, 'fisico', 'pix', 350.00, 24.50, 325.50, '2026-04-07 10:00:00+00')
  RETURNING id INTO v_vid;
  SELECT id INTO v_pid1 FROM public.produtos WHERE nome = 'Hoodie HG Logo Preto' AND tamanho = 'M';
  INSERT INTO public.itens_venda (venda_id, produto_id, quantidade, preco_unitario, subtotal_item) VALUES (v_vid, v_pid1, 1, 350.00, 350.00);
  INSERT INTO public.comissoes (venda_id, vendedor_id, percentual, valor_comissao) VALUES (v_vid, v_camilly, 5, 16.28);
  INSERT INTO public.movimentacao_caixa (tipo, categoria, descricao, valor, referencia_venda_id) VALUES ('entrada', 'venda', 'Venda #' || v_vid::TEXT, 325.50, v_vid);

  -- ── Venda 8: 08/04 — Ciara — Crédito — Física ──
  -- Conjunto Moletom Preto M | subtotal 540 | desconto 0 | total 540.00
  INSERT INTO public.vendas (vendedor_id, canal_venda, metodo_pagamento, subtotal, desconto_aplicado, total_final, criado_em)
  VALUES (v_ciara, 'fisico', 'credito', 540.00, 0.00, 540.00, '2026-04-08 17:30:00+00')
  RETURNING id INTO v_vid;
  SELECT id INTO v_pid1 FROM public.produtos WHERE nome = 'Conjunto Moletom Preto' AND tamanho = 'M';
  INSERT INTO public.itens_venda (venda_id, produto_id, quantidade, preco_unitario, subtotal_item) VALUES (v_vid, v_pid1, 1, 540.00, 540.00);
  INSERT INTO public.comissoes (venda_id, vendedor_id, percentual, valor_comissao) VALUES (v_vid, v_ciara, 5, 27.00);
  INSERT INTO public.movimentacao_caixa (tipo, categoria, descricao, valor, referencia_venda_id) VALUES ('entrada', 'venda', 'Venda #' || v_vid::TEXT, 540.00, v_vid);

  -- ── Venda 9: 09/04 — Camilly — PIX — WhatsApp ──
  -- Moletom HG Cinza G + Boné HG Bege UNICO
  -- subtotal 415 | desconto 7% = 29.05 | total 385.95
  INSERT INTO public.vendas (vendedor_id, canal_venda, metodo_pagamento, subtotal, desconto_aplicado, total_final, criado_em)
  VALUES (v_camilly, 'whatsapp', 'pix', 415.00, 29.05, 385.95, '2026-04-09 09:15:00+00')
  RETURNING id INTO v_vid;
  SELECT id INTO v_pid1 FROM public.produtos WHERE nome = 'Moletom HG Cinza' AND tamanho = 'G';
  SELECT id INTO v_pid2 FROM public.produtos WHERE nome = 'Boné HG Bege'     AND tamanho = 'UNICO';
  INSERT INTO public.itens_venda (venda_id, produto_id, quantidade, preco_unitario, subtotal_item) VALUES
    (v_vid, v_pid1, 1, 320.00, 320.00),
    (v_vid, v_pid2, 1,  95.00,  95.00);
  INSERT INTO public.comissoes (venda_id, vendedor_id, percentual, valor_comissao) VALUES (v_vid, v_camilly, 5, 19.30);
  INSERT INTO public.movimentacao_caixa (tipo, categoria, descricao, valor, referencia_venda_id) VALUES ('entrada', 'venda', 'Venda #' || v_vid::TEXT, 385.95, v_vid);

  -- ── Venda 10: 09/04 — Ciara — PIX — WhatsApp ──
  -- Calça Cargo Bege M | subtotal 260 | desconto 7% = 18.20 | total 241.80
  INSERT INTO public.vendas (vendedor_id, canal_venda, metodo_pagamento, subtotal, desconto_aplicado, total_final, criado_em)
  VALUES (v_ciara, 'whatsapp', 'pix', 260.00, 18.20, 241.80, '2026-04-09 11:40:00+00')
  RETURNING id INTO v_vid;
  SELECT id INTO v_pid1 FROM public.produtos WHERE nome = 'Calça Cargo Bege' AND tamanho = 'M';
  INSERT INTO public.itens_venda (venda_id, produto_id, quantidade, preco_unitario, subtotal_item) VALUES (v_vid, v_pid1, 1, 260.00, 260.00);
  INSERT INTO public.comissoes (venda_id, vendedor_id, percentual, valor_comissao) VALUES (v_vid, v_ciara, 5, 12.09);
  INSERT INTO public.movimentacao_caixa (tipo, categoria, descricao, valor, referencia_venda_id) VALUES ('entrada', 'venda', 'Venda #' || v_vid::TEXT, 241.80, v_vid);

END $$;


-- STEP 19 e 20 removidos — eram scripts de limpeza one-shot que não devem rodar no deploy automático


-- STEP 18: Campo ativo em produtos + ocultar produtos sem foto/zerados
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT true;

DO $$
BEGIN
  -- Inativar todos os produtos sem foto E sem estoque (qty=0 ou sem registro)
  UPDATE public.produtos p SET ativo = false
  WHERE (p.foto_url IS NULL OR p.foto_url = '')
    AND COALESCE(
      (SELECT e.quantidade FROM public.estoque e WHERE e.produto_id = p.id LIMIT 1),
      0
    ) = 0;
  RAISE NOTICE '% produto(s) ocultado(s) (ativo=false).', (SELECT COUNT(*) FROM public.produtos WHERE ativo = false);
END $$;

-- STEP 18b: Novas categorias financeiras para segregação contábil
ALTER TYPE categoria_movimentacao ADD VALUE IF NOT EXISTS 'aporte';
ALTER TYPE categoria_movimentacao ADD VALUE IF NOT EXISTS 'capital_giro';


-- ─────────────────────────────────────────────────────
-- STEP 17: Atualiza realizar_venda com suporte a data retroativa
-- IMPORTANTE: remove a versão antiga antes de criar a nova
-- ─────────────────────────────────────────────────────

-- Remove a versão sem p_data_venda para evitar ambiguidade de overload
DROP FUNCTION IF EXISTS public.realizar_venda(
  uuid,
  public.canal_venda_tipo,
  public.metodo_pagamento_tipo,
  numeric, numeric, numeric, jsonb,
  text, text, text, date
);

CREATE OR REPLACE FUNCTION public.realizar_venda(
  p_vendedor_id          UUID,
  p_canal_venda          canal_venda_tipo,
  p_metodo_pagamento     metodo_pagamento_tipo,
  p_subtotal             NUMERIC,
  p_desconto_aplicado    NUMERIC,
  p_total_final          NUMERIC,
  p_itens                JSONB,
  p_cliente_cpf          TEXT        DEFAULT NULL,
  p_cliente_nome         TEXT        DEFAULT NULL,
  p_cliente_telefone     TEXT        DEFAULT NULL,
  p_cliente_nascimento   DATE        DEFAULT NULL,
  p_data_venda           TIMESTAMPTZ DEFAULT NULL
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
  v_ts          TIMESTAMPTZ;
BEGIN
  v_ts := COALESCE(p_data_venda, NOW());

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

  -- 2. Inserir venda com data customizada (retroativa ou agora)
  INSERT INTO public.vendas (
    vendedor_id, cliente_id, canal_venda, metodo_pagamento,
    subtotal, desconto_aplicado, total_final, criado_em
  ) VALUES (
    p_vendedor_id, v_cliente_id, p_canal_venda, p_metodo_pagamento,
    p_subtotal, p_desconto_aplicado, p_total_final, v_ts
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

    -- 3c. Debitar estoque
    UPDATE public.estoque
    SET
      quantidade      = quantidade - (v_item->>'quantidade')::INTEGER,
      ultima_venda_em = v_ts,
      atualizado_em   = NOW()
    WHERE produto_id = (v_item->>'produto_id')::UUID;

  END LOOP;

  -- 4. Calcular e inserir comissão (5% do total_final)
  v_comissao := ROUND(p_total_final * 0.05, 2);
  INSERT INTO public.comissoes (venda_id, vendedor_id, percentual, valor_comissao, criado_em)
  VALUES (v_venda_id, p_vendedor_id, 5, v_comissao, v_ts);

  -- 5. Registrar entrada no caixa
  INSERT INTO public.movimentacao_caixa (tipo, categoria, descricao, valor, referencia_venda_id, criado_em)
  VALUES (
    'entrada',
    'venda',
    'Venda #' || v_venda_id::TEXT,
    p_total_final,
    v_venda_id,
    v_ts
  );

  RETURN v_venda_id;

EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$;


-- ─────────────────────────────────────────────────────
-- STEP 16: Adiciona meta_mensal em usuarios
-- ─────────────────────────────────────────────────────
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS meta_mensal NUMERIC(10,2) NULL;


-- ─────────────────────────────────────────────────────
-- STEP 15: Adiciona coluna numero em produtos
-- ─────────────────────────────────────────────────────
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS numero TEXT NULL;


-- ─────────────────────────────────────────────────────
-- STEP 14: Limpeza e custos operacionais
-- ─────────────────────────────────────────────────────
DO $$
BEGIN

  -- Remove produto "cruzeiro" do estoque primeiro (FK constraint)
  DELETE FROM public.estoque
  WHERE produto_id IN (
    SELECT id FROM public.produtos WHERE nome ILIKE '%cruzeiro%'
  );

  -- Remove o produto cruzeiro apenas se não há itens de venda referenciando-o
  DELETE FROM public.produtos
  WHERE nome ILIKE '%cruzeiro%'
    AND NOT EXISTS (
      SELECT 1 FROM public.itens_venda iv
      WHERE iv.produto_id = public.produtos.id
    );

  -- Custo: Contabilidade R$350 em 15/04/2026 (idempotente)
  INSERT INTO public.movimentacao_caixa (tipo, categoria, descricao, valor, criado_em)
  SELECT 'saida', 'custo_operacional', 'Contabilidade', 350.00, '2026-04-15 09:00:00+00'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.movimentacao_caixa
    WHERE descricao = 'Contabilidade'
      AND criado_em::date = '2026-04-15'
      AND tipo = 'saida'
  );

  -- Custo: Pagamento Sistema R$110 em 08/04/2026 (idempotente)
  INSERT INTO public.movimentacao_caixa (tipo, categoria, descricao, valor, criado_em)
  SELECT 'saida', 'custo_operacional', 'Pagamento Sistema', 110.00, '2026-04-08 09:00:00+00'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.movimentacao_caixa
    WHERE descricao = 'Pagamento Sistema'
      AND criado_em::date = '2026-04-08'
      AND tipo = 'saida'
  );

END $$;


-- ─────────────────────────────────────────────────────
-- STEP 21: Coluna vence_em em movimentacao_caixa
-- ─────────────────────────────────────────────────────
ALTER TABLE public.movimentacao_caixa
  ADD COLUMN IF NOT EXISTS vence_em DATE NULL;


-- ─────────────────────────────────────────────────────
-- STEP 22: Função cancelar_venda + limpeza vendas Robson
-- ─────────────────────────────────────────────────────

-- Função para cancelar venda: restaura estoque e remove registros
CREATE OR REPLACE FUNCTION public.cancelar_venda(p_venda_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 1. Restaurar estoque para cada item da venda
  UPDATE public.estoque e
  SET quantidade    = e.quantidade + iv.quantidade,
      atualizado_em = NOW()
  FROM public.itens_venda iv
  WHERE iv.venda_id = p_venda_id
    AND e.produto_id = iv.produto_id;

  -- 2. Remover entrada no caixa gerada por esta venda
  DELETE FROM public.movimentacao_caixa
  WHERE referencia_venda_id = p_venda_id;

  -- 3. Deletar a venda — CASCADE remove itens_venda e comissoes
  DELETE FROM public.vendas WHERE id = p_venda_id;
END;
$$;

-- Para excluir uma venda específica, use a função cancelar_venda pela página /vendas do sistema.
-- NÃO execute deletes manuais de vendas sem usar a função cancelar_venda,
-- pois ela garante restauração do estoque e remoção das comissões.


-- ─────────────────────────────────────────────────────
-- STEP 23: realizar_venda com p_cliente_id + salva sem CPF
-- ─────────────────────────────────────────────────────

-- Remove versão anterior para evitar ambiguidade de overload
DROP FUNCTION IF EXISTS public.realizar_venda(
  uuid, public.canal_venda_tipo, public.metodo_pagamento_tipo,
  numeric, numeric, numeric, jsonb,
  text, text, text, date, timestamptz
);

CREATE OR REPLACE FUNCTION public.realizar_venda(
  p_vendedor_id          UUID,
  p_canal_venda          canal_venda_tipo,
  p_metodo_pagamento     metodo_pagamento_tipo,
  p_subtotal             NUMERIC,
  p_desconto_aplicado    NUMERIC,
  p_total_final          NUMERIC,
  p_itens                JSONB,
  p_cliente_cpf          TEXT        DEFAULT NULL,
  p_cliente_nome         TEXT        DEFAULT NULL,
  p_cliente_telefone     TEXT        DEFAULT NULL,
  p_cliente_nascimento   DATE        DEFAULT NULL,
  p_data_venda           TIMESTAMPTZ DEFAULT NULL,
  p_cliente_id           UUID        DEFAULT NULL
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
  v_ts          TIMESTAMPTZ;
BEGIN
  v_ts := COALESCE(p_data_venda, NOW());

  -- 1. Resolver cliente
  IF p_cliente_id IS NOT NULL THEN
    -- Usa cliente existente diretamente (selecionado por busca)
    v_cliente_id := p_cliente_id;

  ELSIF p_cliente_cpf IS NOT NULL AND trim(p_cliente_cpf) != '' THEN
    -- Upsert por CPF
    INSERT INTO public.clientes (cpf, nome, telefone, data_nascimento)
    VALUES (
      trim(p_cliente_cpf),
      COALESCE(NULLIF(trim(COALESCE(p_cliente_nome, '')), ''), 'Cliente'),
      p_cliente_telefone,
      p_cliente_nascimento
    )
    ON CONFLICT (cpf) DO UPDATE
      SET nome            = EXCLUDED.nome,
          telefone        = EXCLUDED.telefone,
          data_nascimento = EXCLUDED.data_nascimento
    RETURNING id INTO v_cliente_id;

  ELSIF p_cliente_nome IS NOT NULL AND trim(p_cliente_nome) != '' THEN
    -- Insere sem CPF (só com nome/telefone)
    INSERT INTO public.clientes (nome, telefone, data_nascimento)
    VALUES (trim(p_cliente_nome), p_cliente_telefone, p_cliente_nascimento)
    RETURNING id INTO v_cliente_id;

  END IF;

  -- 2. Inserir venda
  INSERT INTO public.vendas (
    vendedor_id, cliente_id, canal_venda, metodo_pagamento,
    subtotal, desconto_aplicado, total_final, criado_em
  ) VALUES (
    p_vendedor_id, v_cliente_id, p_canal_venda, p_metodo_pagamento,
    p_subtotal, p_desconto_aplicado, p_total_final, v_ts
  )
  RETURNING id INTO v_venda_id;

  -- 3. Processar cada item
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens) LOOP

    INSERT INTO public.itens_venda (
      venda_id, produto_id, quantidade, preco_unitario, subtotal_item
    ) VALUES (
      v_venda_id,
      (v_item->>'produto_id')::UUID,
      (v_item->>'quantidade')::INTEGER,
      (v_item->>'preco_unitario')::NUMERIC,
      (v_item->>'subtotal_item')::NUMERIC
    );

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

    UPDATE public.estoque
    SET quantidade      = quantidade - (v_item->>'quantidade')::INTEGER,
        ultima_venda_em = v_ts,
        atualizado_em   = NOW()
    WHERE produto_id = (v_item->>'produto_id')::UUID;

  END LOOP;

  -- 4. Comissão (5%)
  v_comissao := ROUND(p_total_final * 0.05, 2);
  INSERT INTO public.comissoes (venda_id, vendedor_id, percentual, valor_comissao, criado_em)
  VALUES (v_venda_id, p_vendedor_id, 5, v_comissao, v_ts);

  -- 5. Entrada no caixa
  INSERT INTO public.movimentacao_caixa (tipo, categoria, descricao, valor, referencia_venda_id, criado_em)
  VALUES ('entrada', 'venda', 'Venda #' || v_venda_id::TEXT, p_total_final, v_venda_id, v_ts);

  RETURN v_venda_id;

EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$;

-- Desativar usuários de teste (nomes genéricos do setup inicial)
UPDATE public.usuarios
SET ativo = false
WHERE LOWER(nome) IN ('func1', 'funcionario', 'funcionário', 'teste', 'test', 'funcionario teste', 'funcionária teste')
   OR LOWER(email) LIKE '%teste%'
   OR LOWER(email) LIKE '%test%'
   OR LOWER(email) LIKE '%func1%';

-- Para renomear o sócio para "HG Sócio", execute manualmente:
-- UPDATE public.usuarios SET nome = 'HG Sócio' WHERE role = 'socio';


-- ─────────────────────────────────────────────────────
-- STEP 24: Campo pago em movimentacao_caixa
-- Saídas com vence_em futuro entram como pago=false (pendente).
-- Só afetam o saldo quando pago=true (conta quitada).
-- ─────────────────────────────────────────────────────
ALTER TABLE public.movimentacao_caixa
  ADD COLUMN IF NOT EXISTS pago BOOLEAN NOT NULL DEFAULT TRUE;

-- Entradas e saídas já existentes ficam como pagas (default TRUE).
-- Saídas novas com vence_em serão criadas com pago=FALSE pelo frontend.



-- STEP 25: realizar_venda — só gera comissão para funcionários (não para sócios)
-- ─────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.realizar_venda(
  uuid, public.canal_venda_tipo, public.metodo_pagamento_tipo,
  numeric, numeric, numeric, jsonb,
  text, text, text, date, timestamptz, uuid
);

CREATE OR REPLACE FUNCTION public.realizar_venda(
  p_vendedor_id          UUID,
  p_canal_venda          canal_venda_tipo,
  p_metodo_pagamento     metodo_pagamento_tipo,
  p_subtotal             NUMERIC,
  p_desconto_aplicado    NUMERIC,
  p_total_final          NUMERIC,
  p_itens                JSONB,
  p_cliente_cpf          TEXT        DEFAULT NULL,
  p_cliente_nome         TEXT        DEFAULT NULL,
  p_cliente_telefone     TEXT        DEFAULT NULL,
  p_cliente_nascimento   DATE        DEFAULT NULL,
  p_data_venda           TIMESTAMPTZ DEFAULT NULL,
  p_cliente_id           UUID        DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_venda_id      UUID;
  v_cliente_id    UUID;
  v_item          JSONB;
  v_estoque_qty   INTEGER;
  v_comissao      NUMERIC;
  v_ts            TIMESTAMPTZ;
  v_vendedor_role TEXT;
BEGIN
  v_ts := COALESCE(p_data_venda, NOW());

  -- 1. Resolver cliente
  IF p_cliente_id IS NOT NULL THEN
    v_cliente_id := p_cliente_id;

  ELSIF p_cliente_cpf IS NOT NULL AND trim(p_cliente_cpf) != '' THEN
    INSERT INTO public.clientes (cpf, nome, telefone, data_nascimento)
    VALUES (
      trim(p_cliente_cpf),
      COALESCE(NULLIF(trim(COALESCE(p_cliente_nome, '')), ''), 'Cliente'),
      p_cliente_telefone,
      p_cliente_nascimento
    )
    ON CONFLICT (cpf) DO UPDATE
      SET nome            = EXCLUDED.nome,
          telefone        = EXCLUDED.telefone,
          data_nascimento = EXCLUDED.data_nascimento
    RETURNING id INTO v_cliente_id;

  ELSIF p_cliente_nome IS NOT NULL AND trim(p_cliente_nome) != '' THEN
    INSERT INTO public.clientes (nome, telefone, data_nascimento)
    VALUES (trim(p_cliente_nome), p_cliente_telefone, p_cliente_nascimento)
    RETURNING id INTO v_cliente_id;

  END IF;

  -- 2. Inserir venda
  INSERT INTO public.vendas (
    vendedor_id, cliente_id, canal_venda, metodo_pagamento,
    subtotal, desconto_aplicado, total_final, criado_em
  ) VALUES (
    p_vendedor_id, v_cliente_id, p_canal_venda, p_metodo_pagamento,
    p_subtotal, p_desconto_aplicado, p_total_final, v_ts
  )
  RETURNING id INTO v_venda_id;

  -- 3. Processar cada item
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens) LOOP

    INSERT INTO public.itens_venda (
      venda_id, produto_id, quantidade, preco_unitario, subtotal_item
    ) VALUES (
      v_venda_id,
      (v_item->>'produto_id')::UUID,
      (v_item->>'quantidade')::INTEGER,
      (v_item->>'preco_unitario')::NUMERIC,
      (v_item->>'subtotal_item')::NUMERIC
    );

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

    UPDATE public.estoque
    SET quantidade      = quantidade - (v_item->>'quantidade')::INTEGER,
        ultima_venda_em = v_ts,
        atualizado_em   = NOW()
    WHERE produto_id = (v_item->>'produto_id')::UUID;

  END LOOP;

  -- 4. Comissão (5%) — apenas para funcionários, sócios não recebem comissão
  SELECT role::TEXT INTO v_vendedor_role
  FROM public.usuarios
  WHERE id = p_vendedor_id;

  IF v_vendedor_role = 'funcionario' THEN
    v_comissao := ROUND(p_total_final * 0.05, 2);
    INSERT INTO public.comissoes (venda_id, vendedor_id, percentual, valor_comissao, criado_em)
    VALUES (v_venda_id, p_vendedor_id, 5, v_comissao, v_ts);
  END IF;

  -- 5. Entrada no caixa
  INSERT INTO public.movimentacao_caixa (tipo, categoria, descricao, valor, referencia_venda_id, criado_em)
  VALUES ('entrada', 'venda', 'Venda #' || v_venda_id::TEXT, p_total_final, v_venda_id, v_ts);

  RETURN v_venda_id;
END;
$$;

-- Execute para confirmar que tudo foi criado:
SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public'
  ORDER BY table_name;

SELECT routine_name FROM information_schema.routines
  WHERE routine_schema = 'public' AND routine_type = 'FUNCTION'
  ORDER BY routine_name;

SELECT email, role, ativo FROM public.usuarios ORDER BY role;
-- Esperado: camilly, ciara, func1 (funcionario) + socio (socio)


-- ─────────────────────────────────────────────────────
-- STEP 26: Auditoria de exclusões — guarda cópia de TUDO que for deletado
-- Tabela de log + triggers nas tabelas críticas
-- ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.audit_delete_log (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  tabela      TEXT        NOT NULL,
  registro_id UUID,
  dados       JSONB       NOT NULL,
  deletado_em TIMESTAMPTZ DEFAULT NOW(),
  usuario_id  UUID
);

ALTER TABLE public.audit_delete_log ENABLE ROW LEVEL SECURITY;

-- Só o sócio pode ler o log de auditoria
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'socio_select_audit' AND tablename = 'audit_delete_log') THEN
    CREATE POLICY "socio_select_audit" ON public.audit_delete_log
      FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM public.usuarios WHERE id = auth.uid() AND role = 'socio'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'bloquear_delete_audit' AND tablename = 'audit_delete_log') THEN
    CREATE POLICY "bloquear_delete_audit" ON public.audit_delete_log
      FOR DELETE TO authenticated
      USING (false);
  END IF;
END $$;

-- Função que copia o registro deletado para o log
CREATE OR REPLACE FUNCTION public.fn_log_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.audit_delete_log (tabela, registro_id, dados, usuario_id)
  VALUES (TG_TABLE_NAME, OLD.id, to_jsonb(OLD), auth.uid());
  RETURN OLD;
END;
$$;

-- Trigger em vendas
DROP TRIGGER IF EXISTS trg_log_delete_vendas ON public.vendas;
CREATE TRIGGER trg_log_delete_vendas
  BEFORE DELETE ON public.vendas
  FOR EACH ROW EXECUTE FUNCTION public.fn_log_delete();

-- Trigger em clientes
DROP TRIGGER IF EXISTS trg_log_delete_clientes ON public.clientes;
CREATE TRIGGER trg_log_delete_clientes
  BEFORE DELETE ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.fn_log_delete();

-- Trigger em movimentacao_caixa
DROP TRIGGER IF EXISTS trg_log_delete_movimentacao ON public.movimentacao_caixa;
CREATE TRIGGER trg_log_delete_movimentacao
  BEFORE DELETE ON public.movimentacao_caixa
  FOR EACH ROW EXECUTE FUNCTION public.fn_log_delete();

-- Trigger em comissoes
DROP TRIGGER IF EXISTS trg_log_delete_comissoes ON public.comissoes;
CREATE TRIGGER trg_log_delete_comissoes
  BEFORE DELETE ON public.comissoes
  FOR EACH ROW EXECUTE FUNCTION public.fn_log_delete();


-- ─────────────────────────────────────────────────────
-- STEP 27: Histórico de edições (UPDATE) nas tabelas críticas
-- Quando qualquer campo de um cliente/venda/produto for editado,
-- a versão ANTERIOR fica salva em audit_delete_log com operacao='UPDATE'
-- ─────────────────────────────────────────────────────

-- Adiciona coluna operacao (DELETE ou UPDATE) se ainda não existe
ALTER TABLE public.audit_delete_log
  ADD COLUMN IF NOT EXISTS operacao TEXT NOT NULL DEFAULT 'DELETE';

-- Função que salva o estado ANTES da edição
CREATE OR REPLACE FUNCTION public.fn_log_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF OLD IS DISTINCT FROM NEW THEN
    INSERT INTO public.audit_delete_log (tabela, registro_id, dados, operacao, usuario_id)
    VALUES (TG_TABLE_NAME, OLD.id, to_jsonb(OLD), 'UPDATE', auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

-- Histórico de edições em clientes
DROP TRIGGER IF EXISTS trg_log_update_clientes ON public.clientes;
CREATE TRIGGER trg_log_update_clientes
  BEFORE UPDATE ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.fn_log_update();

-- Histórico de edições em vendas
DROP TRIGGER IF EXISTS trg_log_update_vendas ON public.vendas;
CREATE TRIGGER trg_log_update_vendas
  BEFORE UPDATE ON public.vendas
  FOR EACH ROW EXECUTE FUNCTION public.fn_log_update();

-- Histórico de edições em movimentacao_caixa
DROP TRIGGER IF EXISTS trg_log_update_movimentacao ON public.movimentacao_caixa;
CREATE TRIGGER trg_log_update_movimentacao
  BEFORE UPDATE ON public.movimentacao_caixa
  FOR EACH ROW EXECUTE FUNCTION public.fn_log_update();

-- Histórico de edições em produtos
DROP TRIGGER IF EXISTS trg_log_update_produtos ON public.produtos;
CREATE TRIGGER trg_log_update_produtos
  BEFORE UPDATE ON public.produtos
  FOR EACH ROW EXECUTE FUNCTION public.fn_log_update();

-- ─────────────────────────────────────────────────────
-- STEP 27a: Coluna fotos_urls para visualização 360° (array de URLs)
-- ─────────────────────────────────────────────────────
ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS fotos_urls TEXT[] DEFAULT '{}';

-- ─────────────────────────────────────────────────────
-- STEP 27b: Centros de custo adicionais no enum categoria_movimentacao
-- ─────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'administrativo'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'categoria_movimentacao')) THEN
    ALTER TYPE public.categoria_movimentacao ADD VALUE 'administrativo';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'midia_marketing'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'categoria_movimentacao')) THEN
    ALTER TYPE public.categoria_movimentacao ADD VALUE 'midia_marketing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'funcionarios'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'categoria_movimentacao')) THEN
    ALTER TYPE public.categoria_movimentacao ADD VALUE 'funcionarios';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────
-- STEP 28: Aporte de R$4.000 com parcelas quinzenais nos dias 01 e 15
-- Idempotente: só insere se nenhum aporte deste valor e período existir
-- ─────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.movimentacao_caixa
    WHERE categoria = 'aporte'
      AND valor = 4000
      AND criado_em >= '2026-06-01'
  ) THEN
    -- Entrada: registra o recebimento do aporte
    INSERT INTO public.movimentacao_caixa (tipo, categoria, descricao, valor, pago)
    VALUES ('entrada', 'aporte', 'Aporte de Capital — R$4.000,00 em 10x quinzenais', 4000, true);

    -- Saídas: 10 parcelas nos dias 01 e 15, base R$400 + R$2 de acréscimo por quinzena
    INSERT INTO public.movimentacao_caixa (tipo, categoria, descricao, valor, vence_em, pago)
    VALUES
      ('saida', 'capital_giro', 'Aporte de Capital — Parcela 1/10', 400.00, '2026-07-01', false),
      ('saida', 'capital_giro', 'Aporte de Capital — Parcela 2/10', 402.00, '2026-07-15', false),
      ('saida', 'capital_giro', 'Aporte de Capital — Parcela 3/10', 404.00, '2026-08-01', false),
      ('saida', 'capital_giro', 'Aporte de Capital — Parcela 4/10', 406.00, '2026-08-15', false),
      ('saida', 'capital_giro', 'Aporte de Capital — Parcela 5/10', 408.00, '2026-09-01', false),
      ('saida', 'capital_giro', 'Aporte de Capital — Parcela 6/10', 410.00, '2026-09-15', false),
      ('saida', 'capital_giro', 'Aporte de Capital — Parcela 7/10', 412.00, '2026-10-01', false),
      ('saida', 'capital_giro', 'Aporte de Capital — Parcela 8/10', 414.00, '2026-10-15', false),
      ('saida', 'capital_giro', 'Aporte de Capital — Parcela 9/10', 416.00, '2026-11-01', false),
      ('saida', 'capital_giro', 'Aporte de Capital — Parcela 10/10', 418.00, '2026-11-15', false);
  END IF;
END $$;

-- ─────────────────────────────────────────────────────
-- STEP 29: Remover lançamento duplicado "Consórcio" de 15/06/2026
-- O valor correto já está lançado como "Capital de Giro"
-- Este DO block é idempotente — se não existir, nada acontece
-- ─────────────────────────────────────────────────────
DO $$
BEGIN
  DELETE FROM public.movimentacao_caixa
  WHERE (
    LOWER(descricao) LIKE '%cons%rcio%'
    OR LOWER(descricao) LIKE '%consorcio%'
    OR LOWER(descricao) LIKE '%consórcio%'
  )
  AND criado_em::date BETWEEN '2026-06-14' AND '2026-06-16';
END $$;

-- ─────────────────────────────────────────────────────
-- STEP 30: Ajuste de saldo inicial para R$6.145,84
-- Insere uma entrada de ajuste em 31/05/2026 apenas se ainda não existir.
-- O valor inserido é a diferença entre R$6.145,84 e o saldo calculado
-- (entradas pagas − saídas pagas, excluindo aportes) até 31/05/2026.
-- ─────────────────────────────────────────────────────
DO $$
DECLARE
  v_entradas   NUMERIC;
  v_saidas     NUMERIC;
  v_saldo_atual NUMERIC;
  v_alvo        NUMERIC := 6145.84;
  v_ajuste      NUMERIC;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.movimentacao_caixa
    WHERE descricao = 'Saldo Inicial de Caixa — Ajuste'
      AND criado_em::date = '2026-05-31'
  ) THEN
    SELECT
      COALESCE(SUM(CASE WHEN tipo = 'entrada' AND pago = true THEN valor ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN tipo = 'saida'   AND pago = true THEN valor ELSE 0 END), 0)
    INTO v_entradas, v_saidas
    FROM public.movimentacao_caixa
    WHERE categoria <> 'aporte'
      AND criado_em < '2026-06-01';

    v_saldo_atual := v_entradas - v_saidas;
    v_ajuste := v_alvo - v_saldo_atual;

    IF v_ajuste > 0 THEN
      INSERT INTO public.movimentacao_caixa (tipo, categoria, descricao, valor, pago, criado_em)
      VALUES ('entrada', 'outro', 'Saldo Inicial de Caixa — Ajuste', v_ajuste, true, '2026-05-31T23:59:00');
    ELSIF v_ajuste < 0 THEN
      INSERT INTO public.movimentacao_caixa (tipo, categoria, descricao, valor, pago, criado_em)
      VALUES ('saida', 'outro', 'Saldo Inicial de Caixa — Ajuste', ABS(v_ajuste), true, '2026-05-31T23:59:00');
    END IF;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────
-- STEP 31: Corrigir datas das parcelas do aporte de R$4.000
-- Parcela 1 = 15/06/2026 e já foi paga.
-- Parcelas 2–10 seguem quinzenalmente a partir de 01/07/2026.
-- Remove os registros antigos (datas erradas a partir de 01/07) e reinsertem.
-- ─────────────────────────────────────────────────────
DO $$
BEGIN
  -- Remove as 10 parcelas com datas erradas criadas pelo STEP 28
  DELETE FROM public.movimentacao_caixa
  WHERE tipo = 'saida'
    AND categoria = 'capital_giro'
    AND descricao LIKE 'Aporte de Capital — Parcela %/10'
    AND vence_em BETWEEN '2026-07-01' AND '2026-11-15';

  -- Insere somente se a versão corrigida ainda não existe
  IF NOT EXISTS (
    SELECT 1 FROM public.movimentacao_caixa
    WHERE tipo = 'saida'
      AND categoria = 'capital_giro'
      AND descricao = 'Aporte de Capital — Parcela 1/10'
      AND vence_em = '2026-06-15'
  ) THEN
    INSERT INTO public.movimentacao_caixa (tipo, categoria, descricao, valor, vence_em, pago)
    VALUES
      ('saida', 'capital_giro', 'Aporte de Capital — Parcela 1/10',  400.00, '2026-06-15', true),
      ('saida', 'capital_giro', 'Aporte de Capital — Parcela 2/10',  402.00, '2026-07-01', false),
      ('saida', 'capital_giro', 'Aporte de Capital — Parcela 3/10',  404.00, '2026-07-15', false),
      ('saida', 'capital_giro', 'Aporte de Capital — Parcela 4/10',  406.00, '2026-08-01', false),
      ('saida', 'capital_giro', 'Aporte de Capital — Parcela 5/10',  408.00, '2026-08-15', false),
      ('saida', 'capital_giro', 'Aporte de Capital — Parcela 6/10',  410.00, '2026-09-01', false),
      ('saida', 'capital_giro', 'Aporte de Capital — Parcela 7/10',  412.00, '2026-09-15', false),
      ('saida', 'capital_giro', 'Aporte de Capital — Parcela 8/10',  414.00, '2026-10-01', false),
      ('saida', 'capital_giro', 'Aporte de Capital — Parcela 9/10',  416.00, '2026-10-15', false),
      ('saida', 'capital_giro', 'Aporte de Capital — Parcela 10/10', 418.00, '2026-11-01', false);
  END IF;
END $$;

-- ─────────────────────────────────────────────────────
-- STEP 32: Remover parcelas pendentes do aporte (capital de giro)
-- Qualquer parcela pago=false do aporte não representa dívida real no caixa —
-- o saldo correto já está calibrado via STEP 30.
-- Garante que nenhuma entrada falsa apareça em "Contas a Pagar".
-- ─────────────────────────────────────────────────────
DELETE FROM public.movimentacao_caixa
WHERE tipo = 'saida'
  AND categoria = 'capital_giro'
  AND descricao LIKE 'Aporte de Capital — Parcela %'
  AND pago = false;

-- STEP 33: Remover parcela pago=true do capital de giro (não representa dívida real)
DELETE FROM public.movimentacao_caixa
WHERE tipo = 'saida'
  AND categoria = 'capital_giro'
  AND descricao LIKE 'Aporte de Capital — Parcela %'
  AND pago = true;

-- ─────────────────────────────────────────────────────
-- STEP 34: Recalibrar saldo anterior para R$3.359,62
-- Apaga o ajuste antigo (STEP 30) e insere novo com o valor correto.
-- Roda sempre (sem IF NOT EXISTS) para garantir calibragem idempotente.
-- ─────────────────────────────────────────────────────
DO $$
DECLARE
  v_entradas    NUMERIC;
  v_saidas      NUMERIC;
  v_saldo_atual NUMERIC;
  v_alvo        NUMERIC := 3359.62;
  v_ajuste      NUMERIC;
BEGIN
  -- Remove qualquer ajuste anterior
  DELETE FROM public.movimentacao_caixa
  WHERE descricao = 'Saldo Inicial de Caixa — Ajuste';

  -- Calcula saldo de todas as entradas/saídas pagas (excl. aporte) antes de julho/2026
  SELECT
    COALESCE(SUM(CASE WHEN tipo = 'entrada' AND pago = true THEN valor ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tipo = 'saida'   AND pago = true THEN valor ELSE 0 END), 0)
  INTO v_entradas, v_saidas
  FROM public.movimentacao_caixa
  WHERE categoria <> 'aporte'
    AND criado_em < '2026-07-01';

  v_saldo_atual := v_entradas - v_saidas;
  v_ajuste      := v_alvo - v_saldo_atual;

  IF v_ajuste > 0 THEN
    INSERT INTO public.movimentacao_caixa (tipo, categoria, descricao, valor, pago, criado_em)
    VALUES ('entrada', 'outro', 'Saldo Inicial de Caixa — Ajuste', v_ajuste, true, '2026-05-31T23:59:00');
  ELSIF v_ajuste < 0 THEN
    INSERT INTO public.movimentacao_caixa (tipo, categoria, descricao, valor, pago, criado_em)
    VALUES ('saida', 'outro', 'Saldo Inicial de Caixa — Ajuste', ABS(v_ajuste), true, '2026-05-31T23:59:00');
  END IF;
END $$;

-- ─────────────────────────────────────────────────────
-- STEP 35: RLS para bucket campanhas (mídias de campanha WPP)
-- ─────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE POLICY "campanhas_insert_auth" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'campanhas');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "campanhas_select_public" ON storage.objects
    FOR SELECT TO public
    USING (bucket_id = 'campanhas');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "campanhas_delete_auth" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'campanhas');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
