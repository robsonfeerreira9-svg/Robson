"""
Apaga exatamente os 7 produtos da imagem (12/05/2026).
Usa service role key via REST API — não precisa de SUPABASE_PAT.
Só apaga se quantidade = 0 e sem histórico de vendas.
"""
import os, json, urllib.request, urllib.error

SUPABASE_URL = os.environ.get('SUPABASE_URL', 'https://eaovtnotwfzuxgtqpkay.supabase.co')
SERVICE_KEY  = os.environ['SUPABASE_SERVICE_ROLE_KEY']

ALVOS = [
    ('Camiseta Basic Oversize Branca', 'P'),
    ('Camiseta Basic Oversize Cinza',  'G'),
    ('Camiseta Basic Oversize Preta',  'M'),
    ('Camiseta Basic Oversize Preta',  'G'),
    ('Camiseta Estampada HG Logo',     'G'),
    ('Camiseta Estampada HG Logo',     'M'),
    ('Camiseta Gola Alta Preta',       'M'),
]

HEADERS = {
    'apikey': SERVICE_KEY,
    'Authorization': f'Bearer {SERVICE_KEY}',
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
}

def req(method, path, data=None, params=None):
    url = f'{SUPABASE_URL}/rest/v1/{path}'
    if params:
        url += '?' + '&'.join(f'{k}={v}' for k, v in params.items())
    body = json.dumps(data).encode() if data else None
    r = urllib.request.Request(url, data=body, method=method, headers=HEADERS)
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            return json.loads(resp.read() or b'[]'), resp.status
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f'  HTTP {e.code}: {body}')
        raise

apagados = 0
preservados = 0

for nome, tamanho in ALVOS:
    nome_enc   = urllib.parse.quote(nome) if hasattr(urllib, 'parse') else nome.replace(' ', '%20')
    try:
        import urllib.parse
        nome_enc = urllib.parse.quote(nome, safe='')
    except Exception:
        pass

    # 1. Buscar o produto
    rows, _ = req('GET', 'produtos', params={
        'select': 'id,nome,tamanho',
        'nome':   f'eq.{nome}',
        'tamanho': f'eq.{tamanho}',
    })
    if not rows:
        print(f'  NÃO ENCONTRADO: {nome} {tamanho}')
        continue
    prod_id = rows[0]['id']

    # 2. Verificar estoque
    est, _ = req('GET', 'estoque', params={
        'produto_id': f'eq.{prod_id}',
        'select': 'quantidade',
    })
    qty = est[0]['quantidade'] if est else 0

    # 3. Verificar histórico de vendas
    vendas, _ = req('GET', 'itens_venda', params={
        'produto_id': f'eq.{prod_id}',
        'select': 'id',
        'limit': '1',
    })

    if qty > 0:
        print(f'  PRESERVADO (estoque={qty}): {nome} {tamanho}')
        preservados += 1
        continue
    if vendas:
        print(f'  PRESERVADO (tem vendas): {nome} {tamanho}')
        preservados += 1
        continue

    # 4. Apagar estoque e produto
    req('DELETE', 'estoque',  params={'produto_id': f'eq.{prod_id}'})
    req('DELETE', 'produtos', params={'id': f'eq.{prod_id}'})
    print(f'  ✅ APAGADO: {nome} {tamanho}')
    apagados += 1

print(f'\nResumo: {apagados} apagado(s), {preservados} preservado(s).')
