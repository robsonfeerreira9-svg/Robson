-- ── Migrações re-aplicadas após restauração de backup ─────────────────────────
-- Executar após restaurar backup para garantir features recentes

-- STEP 24: coluna pago
ALTER TABLE public.movimentacao_caixa
  ADD COLUMN IF NOT EXISTS pago BOOLEAN NOT NULL DEFAULT TRUE;

-- STEP 25: realizar_venda sem comissão para sócio
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

  INSERT INTO public.vendas (
    vendedor_id, cliente_id, canal_venda, metodo_pagamento,
    subtotal, desconto_aplicado, total_final, criado_em
  ) VALUES (
    p_vendedor_id, v_cliente_id, p_canal_venda, p_metodo_pagamento,
    p_subtotal, p_desconto_aplicado, p_total_final, v_ts
  )
  RETURNING id INTO v_venda_id;

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

  SELECT role::TEXT INTO v_vendedor_role
  FROM public.usuarios WHERE id = p_vendedor_id;

  IF v_vendedor_role = 'funcionario' THEN
    v_comissao := ROUND(p_total_final * 0.05, 2);
    INSERT INTO public.comissoes (venda_id, vendedor_id, percentual, valor_comissao, criado_em)
    VALUES (v_venda_id, p_vendedor_id, 5, v_comissao, v_ts);
  END IF;

  INSERT INTO public.movimentacao_caixa (tipo, categoria, descricao, valor, referencia_venda_id, criado_em)
  VALUES ('entrada', 'venda', 'Venda #' || v_venda_id::TEXT, p_total_final, v_venda_id, v_ts);

  RETURN v_venda_id;
END;
$$;

SELECT COUNT(*) AS total_vendas   FROM public.vendas;
SELECT COUNT(*) AS total_clientes FROM public.clientes;
SELECT COUNT(*) AS total_movimentacoes FROM public.movimentacao_caixa;
