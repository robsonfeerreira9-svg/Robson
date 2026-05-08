"""
Exporta vendas, clientes, movimentacao_caixa, itens_venda e comissoes
para backups/YYYY-MM-DD.json e commita no repositório.
"""
import json, subprocess, os, sys
from datetime import datetime, timezone

PAT     = os.environ['SUPABASE_PAT']
GHTOKEN = os.environ['GITHUB_TOKEN']
REPO    = os.environ.get('GITHUB_REPOSITORY', '')
BRANCH  = os.environ.get('GITHUB_REF_NAME', '')
REF     = 'eaovtnotwfzuxgtqpkay'
API     = 'https://api.supabase.com/v1/projects/' + REF
TODAY   = datetime.now(timezone.utc).strftime('%Y-%m-%d')
PATH    = 'backups/' + TODAY + '.json'


def query(sql):
    r = subprocess.run(
        ['curl', '-s', '-X', 'POST', API + '/database/query',
         '-H', 'Authorization: Bearer ' + PAT,
         '-H', 'Content-Type: application/json',
         '--data', json.dumps({'query': sql}),
         '--max-time', '30'],
        capture_output=True, text=True)
    try:
        return json.loads(r.stdout)
    except Exception:
        return []


def write_file(path, content, msg):
    encoded = subprocess.run(
        ['base64', '-w0'], input=content.encode(), capture_output=True
    ).stdout.decode()
    sha_r = subprocess.run(
        ['curl', '-s',
         '-H', 'Authorization: token ' + GHTOKEN,
         'https://api.github.com/repos/' + REPO + '/contents/' + path + '?ref=' + BRANCH],
        capture_output=True, text=True)
    try:
        sha = json.loads(sha_r.stdout).get('sha', '')
    except Exception:
        sha = ''
    payload = {'message': msg, 'content': encoded, 'branch': BRANCH}
    if sha:
        payload['sha'] = sha
    r = subprocess.run(
        ['curl', '-s', '-X', 'PUT',
         '-H', 'Authorization: token ' + GHTOKEN,
         '-H', 'Content-Type: application/json',
         'https://api.github.com/repos/' + REPO + '/contents/' + path,
         '--data', json.dumps(payload)],
        capture_output=True, text=True)
    resp = r.stdout[:200]
    print('Gravado', path, '—', resp)


print('=== Backup', TODAY, '===')

tables = {
    'vendas':             'SELECT * FROM public.vendas ORDER BY criado_em',
    'clientes':           'SELECT * FROM public.clientes ORDER BY criado_em',
    'movimentacao_caixa': 'SELECT * FROM public.movimentacao_caixa ORDER BY criado_em',
    'itens_venda':        'SELECT * FROM public.itens_venda',
    'comissoes':          'SELECT * FROM public.comissoes ORDER BY criado_em',
    'produtos':           'SELECT id, nome, tamanho, numero, preco_venda FROM public.produtos ORDER BY nome',
    'usuarios':           'SELECT id, email, nome, role, ativo FROM public.usuarios',
}

backup = {'data': TODAY, 'tabelas': {}}
for table, sql in tables.items():
    rows = query(sql)
    backup['tabelas'][table] = rows
    count = len(rows) if isinstance(rows, list) else '?'
    print(f'  {table}: {count} registros')

content = json.dumps(backup, ensure_ascii=False, indent=2, default=str)
write_file(PATH, content, 'backup: ' + TODAY + ' [skip ci]')
print('Backup concluido:', PATH)
