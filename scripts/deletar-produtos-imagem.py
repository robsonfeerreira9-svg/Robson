"""
Apaga exatamente os 7 produtos listados pelo usuário (imagem 12/05/2026).
Segurança: só apaga se quantidade = 0 e sem histórico de vendas.
"""
import os, json, urllib.request, urllib.error

SUPABASE_REF = os.environ.get('SUPABASE_REF', 'eaovtnotwfzuxgtqpkay')
SUPABASE_PAT = os.environ['SUPABASE_PAT']

ALVOS = [
    ('Camiseta Basic Oversize Branca', 'P'),
    ('Camiseta Basic Oversize Cinza',  'G'),
    ('Camiseta Basic Oversize Preta',  'M'),
    ('Camiseta Basic Oversize Preta',  'G'),
    ('Camiseta Estampada HG Logo',     'G'),
    ('Camiseta Estampada HG Logo',     'M'),
    ('Camiseta Gola Alta Preta',       'M'),
]

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

# Montar condição WHERE para os alvos
conditions = " OR ".join(
    f"(p.nome = '{n}' AND p.tamanho::TEXT = '{t}')"
    for n, t in ALVOS
)

print('=== Verificando produtos alvo ===')
rows, _ = sql(f"""
SELECT p.id, p.nome, p.tamanho,
       COALESCE(e.quantidade, 0) AS quantidade,
       EXISTS(SELECT 1 FROM public.itens_venda iv WHERE iv.produto_id = p.id) AS tem_venda
FROM public.produtos p
LEFT JOIN public.estoque e ON e.produto_id = p.id
WHERE {conditions}
ORDER BY p.nome, p.tamanho
""")

if not rows:
    print('Nenhum produto encontrado. Talvez já tenham sido apagados.')
    exit(0)

ids_apagar = []
for r in rows:
    if r['tem_venda']:
        print(f"  PRESERVADO (tem vendas): {r['nome']} {r['tamanho']} | qty={r['quantidade']}")
    elif r['quantidade'] > 0:
        print(f"  PRESERVADO (tem estoque): {r['nome']} {r['tamanho']} | qty={r['quantidade']}")
    else:
        print(f"  APAGAR: {r['nome']} {r['tamanho']} | qty={r['quantidade']}")
        ids_apagar.append(r['id'])

if not ids_apagar:
    print('\nNenhum produto para apagar (todos têm estoque ou histórico de vendas).')
    exit(0)

print(f'\nApagando {len(ids_apagar)} produto(s)...')
ids_sql = "ARRAY['" + "','".join(ids_apagar) + "']::UUID[]"

sql(f"""
DO $$
DECLARE ids UUID[] := {ids_sql};
BEGIN
  DELETE FROM public.estoque       WHERE produto_id = ANY(ids);
  DELETE FROM public.produtos      WHERE id         = ANY(ids);
  RAISE NOTICE '% produto(s) apagado(s).', array_length(ids, 1);
END $$;
""")

print(f'✅ {len(ids_apagar)} produto(s) apagado(s) com sucesso.')
