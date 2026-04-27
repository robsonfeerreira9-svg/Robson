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
    ('Camiseta Basic Oversize Preta',  'M',     'ambos',  45.00, 166.67, 120.00),
    ('Camiseta Basic Oversize Branca', 'P',     'ambos',  45.00, 166.67, 120.00),
    ('Camiseta Basic Oversize Cinza',  'G',     'ambos',  45.00, 166.67, 120.00),
    ('Camiseta Basic Oversize Preta',  'G',     'ambos',  45.00, 166.67, 120.00),
    ('Camiseta Gola Alta Preta',       'M',     'ambos',  55.00, 172.73, 150.00),
    ('Camiseta Estampada HG Logo',     'M',     'fisico', 60.00, 183.33, 170.00),
    ('Camiseta Estampada HG Logo',     'G',     'fisico', 60.00, 183.33, 170.00),
    ('Camiseta Polo Preta',            'M',     'ambos',  70.00, 171.43, 190.00),
    ('Camiseta Polo Branca',           'G',     'ambos',  70.00, 171.43, 190.00),
    ('Camiseta Manga Longa Preta',     'M',     'ambos',  65.00, 169.23, 175.00),
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
    ('Hoodie HG Logo Preto',           'M',     'ambos', 130.00, 169.23, 350.00),
    ('Hoodie HG Logo Cinza',           'G',     'ambos', 130.00, 169.23, 350.00),
    ('Hoodie HG Logo Branco',          'P',     'ambos', 130.00, 169.23, 350.00),
    ('Hoodie Corta-Vento Preta',       'M',     'fisico',100.00, 170.00, 270.00),
    ('Boné HG Preto',                  'UNICO', 'ambos',  35.00, 171.43,  95.00),
    ('Boné HG Bege',                   'UNICO', 'ambos',  35.00, 171.43,  95.00),
    ('Boné Trucker Preto',             'UNICO', 'ambos',  40.00, 175.00, 110.00),
    ('Boné Snapback Cinza',            'UNICO', 'fisico', 40.00, 175.00, 110.00),
    ('Boné 5 Panel Preto',             'UNICO', 'fisico', 38.00, 163.16, 100.00),
    ('Jaqueta Corta-vento Preta',      'M',     'fisico',140.00, 171.43, 380.00),
    ('Jaqueta Corta-vento Azul',       'G',     'fisico',140.00, 171.43, 380.00),
    ('Jaqueta Bomber Preta',           'M',     'fisico',180.00, 166.67, 480.00),
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
    ('Camiseta Basic Oversize Preta',  'M',      8),
    ('Camiseta Basic Oversize Branca', 'P',      6),
    ('Camiseta Basic Oversize Cinza',  'G',      5),
    ('Camiseta Basic Oversize Preta',  'G',      7),
    ('Camiseta Gola Alta Preta',       'M',      4),
    ('Camiseta Estampada HG Logo',     'M',      6),
    ('Camiseta Estampada HG Logo',     'G',      5),
    ('Camiseta Polo Preta',            'M',      4),
    ('Camiseta Polo Branca',           'G',      3),
    ('Camiseta Manga Longa Preta',     'M',      5),
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
    ('Hoodie HG Logo Preto',           'M',      4),
    ('Hoodie HG Logo Cinza',           'G',      3),
    ('Hoodie HG Logo Branco',          'P',      3),
    ('Hoodie Corta-Vento Preta',       'M',      4),
    ('Boné HG Preto',                  'UNICO',  8),
    ('Boné HG Bege',                   'UNICO',  7),
    ('Boné Trucker Preto',             'UNICO',  6),
    ('Boné Snapback Cinza',            'UNICO',  5),
    ('Boné 5 Panel Preto',             'UNICO',  5),
    ('Jaqueta Corta-vento Preta',      'M',      3),
    ('Jaqueta Corta-vento Azul',       'G',      3),
    ('Jaqueta Bomber Preta',           'M',      2),
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


-- ─────────────────────────────────────────────────────
-- STEP 20: Apagar todos os clientes e vendas de teste
-- Rodar no Supabase SQL Editor
-- ─────────────────────────────────────────────────────
DELETE FROM public.comissoes;
DELETE FROM public.itens_venda;
DELETE FROM public.movimentacao_caixa WHERE categoria = 'venda';
DELETE FROM public.vendas;
DELETE FROM public.clientes;
UPDATE public.estoque SET ultima_venda_em = NULL;


-- ─────────────────────────────────────────────────────
-- STEP 19: Apagar TODAS as vendas e dados relacionados
-- Rodar uma única vez no Supabase SQL Editor
-- ─────────────────────────────────────────────────────
DELETE FROM public.comissoes;
DELETE FROM public.itens_venda;
DELETE FROM public.movimentacao_caixa WHERE categoria = 'venda';
DELETE FROM public.vendas;

-- Reseta ultima_venda_em no estoque (opcional, limpa histórico)
UPDATE public.estoque SET ultima_venda_em = NULL;


-- ─────────────────────────────────────────────────────
-- STEP 18: Limpar produtos sem foto (apaga na ordem correta)
-- Rodar uma única vez no Supabase SQL Editor
-- ─────────────────────────────────────────────────────
DO $$
DECLARE
  ids UUID[];
  total INT;
BEGIN
  SELECT ARRAY_AGG(id) INTO ids
  FROM public.produtos
  WHERE foto_url IS NULL OR foto_url = '';

  IF ids IS NULL OR array_length(ids, 1) = 0 THEN
    RAISE NOTICE 'Nenhum produto sem foto encontrado.';
    RETURN;
  END IF;

  total := array_length(ids, 1);

  -- 1. Remove itens de venda que referenciam esses produtos
  DELETE FROM public.itens_venda WHERE produto_id = ANY(ids);

  -- 2. Remove estoque
  DELETE FROM public.estoque WHERE produto_id = ANY(ids);

  -- 3. Remove os produtos
  DELETE FROM public.produtos WHERE id = ANY(ids);

  RAISE NOTICE '% produto(s) sem foto removido(s).', total;
END $$;


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



-- Execute para confirmar que tudo foi criado:
SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public'
  ORDER BY table_name;

SELECT routine_name FROM information_schema.routines
  WHERE routine_schema = 'public' AND routine_type = 'FUNCTION'
  ORDER BY routine_name;

SELECT email, role, ativo FROM public.usuarios ORDER BY role;
-- Esperado: camilly, ciara, func1 (funcionario) + socio (socio)
