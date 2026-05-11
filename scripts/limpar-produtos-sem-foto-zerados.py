"""
Apaga produtos que TEM AS DUAS condições:
  1. Sem foto (foto_url IS NULL ou '')
  2. Quantidade em estoque = 0 (ou sem registro em estoque)

Produtos com histórico de vendas (itens_venda) NÃO são apagados
para preservar o histórico financeiro.
"""
import os, json, urllib.request, urllib.error

SUPABASE_REF = os.environ.get('SUPABASE_REF', 'eaovtnotwfzuxgtqpkay')
SUPABASE_PAT = os.environ['SUPABASE_PAT']

def sql(query):
    url = f'https://api.supabase.com/v1/projects/{SUPABASE_REF}/database/query'
    payload = json.dumps({'query': query}).encode()
    req = urllib.request.Request(url, data=payload, method='POST', headers={
        'Authorization': f'Bearer {SUPABASE_PAT}',
        'Content-Type': 'application/json',
    })
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read()), resp.status
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f'HTTP {e.code}: {body}')
        raise

# ── 1. Listar produtos candidatos (sem foto + quantidade 0) ──────────────
print('=== Buscando produtos sem foto e com quantidade zerada... ===')
rows, _ = sql("""
SELECT p.id, p.nome, p.foto_url, COALESCE(e.quantidade, 0) AS quantidade,
       EXISTS(SELECT 1 FROM public.itens_venda iv WHERE iv.produto_id = p.id) AS tem_venda
FROM public.produtos p
LEFT JOIN public.estoque e ON e.produto_id = p.id
WHERE (p.foto_url IS NULL OR p.foto_url = '')
  AND COALESCE(e.quantidade, 0) = 0
ORDER BY p.nome
""")

if not rows:
    print('Nenhum produto encontrado com essas condições.')
    exit(0)

print(f'Encontrados {len(rows)} produto(s):')
ids_sem_venda = []
ids_com_venda = []
for r in rows:
    status = '⚠ TEM VENDAS (será preservado)' if r['tem_venda'] else '✓ Sem vendas (será apagado)'
    print(f"  [{status}] {r['nome']} | qty={r['quantidade']} | foto={r['foto_url']}")
    if not r['tem_venda']:
        ids_sem_venda.append(r['id'])
    else:
        ids_com_venda.append(r['id'])

if ids_com_venda:
    print(f'\n⚠ {len(ids_com_venda)} produto(s) preservado(s) por ter histórico de vendas.')

if not ids_sem_venda:
    print('\nNenhum produto para apagar (todos têm histórico de vendas).')
    exit(0)

print(f'\nApagando {len(ids_sem_venda)} produto(s) sem histórico de vendas...')

ids_sql = "ARRAY['" + "','".join(ids_sem_venda) + "']::UUID[]"

# ── 2. Apagar na ordem correta (FK) ─────────────────────────────────────
_, s = sql(f"ALTER TABLE public.itens_venda DISABLE TRIGGER ALL;")
_, s = sql(f"ALTER TABLE public.estoque DISABLE TRIGGER ALL;")
_, s = sql(f"ALTER TABLE public.produtos DISABLE TRIGGER ALL;")

rows2, _ = sql(f"""
DO $$
DECLARE
  ids UUID[] := {ids_sql};
BEGIN
  DELETE FROM public.estoque WHERE produto_id = ANY(ids);
  DELETE FROM public.produtos WHERE id = ANY(ids);
  RAISE NOTICE '% produto(s) apagado(s).', array_length(ids, 1);
END $$;
""")

_, s = sql(f"ALTER TABLE public.itens_venda ENABLE TRIGGER ALL;")
_, s = sql(f"ALTER TABLE public.estoque ENABLE TRIGGER ALL;")
_, s = sql(f"ALTER TABLE public.produtos ENABLE TRIGGER ALL;")

print(f'\n✅ Concluído! {len(ids_sem_venda)} produto(s) apagado(s).')
if ids_com_venda:
    print(f'ℹ {len(ids_com_venda)} produto(s) com histórico de vendas foram mantidos.')
