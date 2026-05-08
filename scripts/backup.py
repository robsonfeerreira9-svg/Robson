"""
Exporta vendas, clientes, movimentacao_caixa, itens_venda e comissoes
para backups/YYYY-MM-DD.json, commita no repositório, limpa backups
antigos (>30 dias) e envia resumo por email via Resend API.
"""
import json, subprocess, os, sys
from datetime import datetime, timezone, timedelta

PAT        = os.environ['SUPABASE_PAT']
GHTOKEN    = os.environ['GITHUB_TOKEN']
RESEND_KEY = os.environ.get('RESEND_API_KEY', '')
REPO       = os.environ.get('GITHUB_REPOSITORY', '')
BRANCH     = os.environ.get('GITHUB_REF_NAME', '')
REF        = 'eaovtnotwfzuxgtqpkay'
API        = 'https://api.supabase.com/v1/projects/' + REF
TODAY      = datetime.now(timezone.utc).strftime('%Y-%m-%d')
PATH       = 'backups/' + TODAY + '.json'
EMAIL_TO   = 'Robsonfeerreira9@gmail.com'


# ── 0. Keepalive: evita que Supabase pause o projeto (free tier) ──────────────
def keepalive():
    r = subprocess.run(
        ['curl', '-s', '-X', 'POST', API + '/database/query',
         '-H', 'Authorization: Bearer ' + PAT,
         '-H', 'Content-Type: application/json',
         '--data', json.dumps({'query': 'SELECT 1'}),
         '--max-time', '15'],
        capture_output=True, text=True)
    print('Keepalive:', r.stdout[:80].strip())


# ── 1. Query Supabase ─────────────────────────────────────────────────────────
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


# ── 2. Gravar arquivo no GitHub ───────────────────────────────────────────────
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


# ── 3. Deletar arquivo no GitHub ──────────────────────────────────────────────
def delete_file(path, sha, msg):
    payload = {'message': msg, 'sha': sha, 'branch': BRANCH}
    r = subprocess.run(
        ['curl', '-s', '-X', 'DELETE',
         '-H', 'Authorization: token ' + GHTOKEN,
         '-H', 'Content-Type: application/json',
         'https://api.github.com/repos/' + REPO + '/contents/' + path,
         '--data', json.dumps(payload)],
        capture_output=True, text=True)
    print('Deletado', path, '—', r.stdout[:100])


# ── 4. Listar backups no GitHub ───────────────────────────────────────────────
def list_backups():
    r = subprocess.run(
        ['curl', '-s',
         '-H', 'Authorization: token ' + GHTOKEN,
         'https://api.github.com/repos/' + REPO + '/contents/backups?ref=' + BRANCH],
        capture_output=True, text=True)
    try:
        items = json.loads(r.stdout)
        if isinstance(items, list):
            return items
    except Exception:
        pass
    return []


# ── 5. Limpeza de backups antigos (>30 dias) ──────────────────────────────────
def cleanup_old_backups():
    cutoff = datetime.now(timezone.utc) - timedelta(days=30)
    items = list_backups()
    deleted = 0
    for item in items:
        name = item.get('name', '')
        if not name.endswith('.json') or name == '.gitkeep':
            continue
        date_str = name.replace('.json', '')
        try:
            file_date = datetime.strptime(date_str, '%Y-%m-%d').replace(tzinfo=timezone.utc)
        except ValueError:
            continue
        if file_date < cutoff:
            delete_file(item['path'], item['sha'], 'backup: remove antigo ' + date_str + ' [skip ci]')
            deleted += 1
    print(f'Limpeza: {deleted} backup(s) removido(s) (>30 dias)')


# ── 6. Enviar email via Resend API ────────────────────────────────────────────
def send_email(counts):
    if not RESEND_KEY:
        print('RESEND_API_KEY não configurado — email pulado')
        return

    rows = ''.join(
        f'<tr><td style="padding:4px 12px;border-bottom:1px solid #eee">{t}</td>'
        f'<td style="padding:4px 12px;border-bottom:1px solid #eee;text-align:right"><b>{c}</b></td></tr>'
        for t, c in counts.items()
    )

    html = f"""
<div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto">
  <h2 style="color:#1a1a2e">HG Grifes ERP — Backup Diário</h2>
  <p>Backup de <b>{TODAY}</b> realizado com sucesso.</p>
  <table style="width:100%;border-collapse:collapse;margin:16px 0">
    <thead>
      <tr style="background:#f0f0f0">
        <th style="padding:8px 12px;text-align:left">Tabela</th>
        <th style="padding:8px 12px;text-align:right">Registros</th>
      </tr>
    </thead>
    <tbody>{rows}</tbody>
  </table>
  <p style="color:#666;font-size:12px">
    Arquivo salvo em <code>backups/{TODAY}.json</code> no repositório GitHub.<br>
    Backups são mantidos por 30 dias.
  </p>
</div>
"""

    payload = {
        'from': 'HG Grifes ERP <onboarding@resend.dev>',
        'to': [EMAIL_TO],
        'subject': f'Backup HG Grifes — {TODAY}',
        'html': html,
    }
    r = subprocess.run(
        ['curl', '-s', '-X', 'POST', 'https://api.resend.com/emails',
         '-H', 'Authorization: Bearer ' + RESEND_KEY,
         '-H', 'Content-Type: application/json',
         '--data', json.dumps(payload),
         '--max-time', '15'],
        capture_output=True, text=True)
    resp = json.loads(r.stdout) if r.stdout else {}
    if resp.get('id'):
        print('Email enviado para', EMAIL_TO, '— id:', resp['id'])
    else:
        print('Erro ao enviar email:', r.stdout[:200])


# ── MAIN ──────────────────────────────────────────────────────────────────────
print('=== Backup', TODAY, '===')

keepalive()

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
counts = {}
for table, sql in tables.items():
    rows = query(sql)
    backup['tabelas'][table] = rows
    count = len(rows) if isinstance(rows, list) else '?'
    counts[table] = count
    print(f'  {table}: {count} registros')

content = json.dumps(backup, ensure_ascii=False, indent=2, default=str)
write_file(PATH, content, 'backup: ' + TODAY + ' [skip ci]')
print('Backup concluido:', PATH)

cleanup_old_backups()

send_email(counts)
