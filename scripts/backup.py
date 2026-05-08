"""
Exporta vendas, clientes, movimentacao_caixa, itens_venda e comissoes
para backups/YYYY-MM-DD.json, commita no repositório, limpa backups
antigos (>30 dias), verifica saúde dos tokens e envia resumo por email.
"""
import json, subprocess, os, sys
from datetime import datetime, timezone, timedelta

PAT          = os.environ['SUPABASE_PAT']
GHTOKEN      = os.environ['GITHUB_TOKEN']
RESEND_KEY   = os.environ.get('RESEND_API_KEY', '')
VERCEL_TOKEN = os.environ.get('VERCEL_TOKEN', '')
VERCEL_ORG   = 'team_NRmTqJ7tXyq4AOLENBGyFHsa'
REPO         = os.environ.get('GITHUB_REPOSITORY', '')
BRANCH       = os.environ.get('GITHUB_REF_NAME', '')
REF          = 'eaovtnotwfzuxgtqpkay'
API          = 'https://api.supabase.com/v1/projects/' + REF
SUPABASE_URL = 'https://eaovtnotwfzuxgtqpkay.supabase.co'
ANON_KEY     = 'sb_publishable_MhNCcezzMUbC7eEXfKByEA_xrFfZnl_'
TODAY        = datetime.now(timezone.utc).strftime('%Y-%m-%d')
PATH         = 'backups/' + TODAY + '.json'
EMAIL_TO     = 'Robsonfeerreira9@gmail.com'


# ── 0. Keepalive duplo: evita que Supabase pause o projeto (free tier) ────────
def keepalive():
    # Ping 1: Management API
    r1 = subprocess.run(
        ['curl', '-s', '-X', 'POST', API + '/database/query',
         '-H', 'Authorization: Bearer ' + PAT,
         '-H', 'Content-Type: application/json',
         '--data', json.dumps({'query': 'SELECT 1'}),
         '--max-time', '15'],
        capture_output=True, text=True)
    print('Keepalive Management API:', r1.stdout[:60].strip())

    # Ping 2: REST API (usa anon key — mais eficaz contra o pause do free tier)
    r2 = subprocess.run(
        ['curl', '-s', '-o', '/dev/null', '-w', '%{http_code}',
         SUPABASE_URL + '/rest/v1/',
         '-H', 'apikey: ' + ANON_KEY,
         '-H', 'Authorization: Bearer ' + ANON_KEY,
         '--max-time', '15'],
        capture_output=True, text=True)
    print('Keepalive REST API: HTTP', r2.stdout.strip())


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
        except Exception:
            continue
        if file_date < cutoff:
            delete_file(item['path'], item['sha'], 'backup: remove antigo ' + date_str + ' [skip ci]')
            deleted += 1
    print(f'Limpeza: {deleted} backup(s) removido(s) (>30 dias)')


# ── 6. Verificação de saúde dos tokens e serviços ────────────────────────────
def check_health():
    alerts = []

    # Supabase PAT — testa acesso ao projeto
    r = subprocess.run(
        ['curl', '-s', '-o', '/dev/null', '-w', '%{http_code}',
         '-H', 'Authorization: Bearer ' + PAT,
         'https://api.supabase.com/v1/projects/' + REF,
         '--max-time', '15'],
        capture_output=True, text=True)
    code = r.stdout.strip()
    if code != '200':
        alerts.append(f'SUPABASE_PAT invalido ou expirado (HTTP {code}) — atualize em github.com/robsonfeerreira9-svg/Robson/settings/secrets/actions')
    print(f'Supabase PAT: HTTP {code}')

    # Supabase — projeto ativo (não pausado)
    r2 = subprocess.run(
        ['curl', '-s',
         '-H', 'Authorization: Bearer ' + PAT,
         'https://api.supabase.com/v1/projects/' + REF,
         '--max-time', '15'],
        capture_output=True, text=True)
    try:
        proj = json.loads(r2.stdout)
        status = proj.get('status', 'unknown')
        if status != 'ACTIVE_HEALTHY':
            alerts.append(f'Projeto Supabase está com status "{status}" — pode estar pausado! Acesse app.supabase.com e ative o projeto.')
        print(f'Supabase projeto status: {status}')
    except Exception:
        pass

    # Vercel Token — só verifica se foi configurado
    if VERCEL_TOKEN:
        r3 = subprocess.run(
            ['curl', '-s', '-o', '/dev/null', '-w', '%{http_code}',
             '-H', 'Authorization: Bearer ' + VERCEL_TOKEN,
             f'https://api.vercel.com/v9/projects/hg-grifes-erp?teamId={VERCEL_ORG}',
             '--max-time', '15'],
            capture_output=True, text=True)
        vcode = r3.stdout.strip()
        if vcode not in ('200', '404'):
            alerts.append(f'VERCEL_TOKEN invalido ou expirado (HTTP {vcode}) — gere novo em vercel.com/account/tokens e atualize o secret no GitHub.')
        print(f'Vercel Token: HTTP {vcode}')
    else:
        print('Vercel Token: não configurado no backup (ok)')

    return alerts


# ── 7. Enviar email via Resend API ────────────────────────────────────────────
def send_email(counts, alerts):
    if not RESEND_KEY:
        print('RESEND_API_KEY não configurado — email pulado')
        return

    rows = ''.join(
        f'<tr><td style="padding:4px 12px;border-bottom:1px solid #eee">{t}</td>'
        f'<td style="padding:4px 12px;border-bottom:1px solid #eee;text-align:right"><b>{c}</b></td></tr>'
        for t, c in counts.items()
    )

    alert_block = ''
    if alerts:
        items_html = ''.join(f'<li style="margin:4px 0;color:#c0392b">{a}</li>' for a in alerts)
        alert_block = f"""
<div style="background:#fff3cd;border:1px solid #ffc107;border-radius:6px;padding:12px 16px;margin:16px 0">
  <b style="color:#856404">⚠ Atenção — Ação necessária:</b>
  <ul style="margin:8px 0 0 0;padding-left:20px">{items_html}</ul>
</div>"""

    status_color = '#27ae60' if not alerts else '#e67e22'
    status_text  = 'Tudo funcionando normalmente' if not alerts else f'{len(alerts)} alerta(s) detectado(s)'

    html = f"""
<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto">
  <div style="background:{status_color};color:#fff;padding:12px 20px;border-radius:6px 6px 0 0">
    <h2 style="margin:0;font-size:18px">HG Grifes ERP — Backup Diário</h2>
    <p style="margin:4px 0 0;font-size:13px">{status_text}</p>
  </div>
  <div style="border:1px solid #ddd;border-top:none;padding:16px 20px;border-radius:0 0 6px 6px">
    <p>Backup de <b>{TODAY}</b> realizado com sucesso.</p>
    {alert_block}
    <table style="width:100%;border-collapse:collapse;margin:12px 0">
      <thead>
        <tr style="background:#f5f5f5">
          <th style="padding:8px 12px;text-align:left;font-size:13px">Tabela</th>
          <th style="padding:8px 12px;text-align:right;font-size:13px">Registros</th>
        </tr>
      </thead>
      <tbody>{rows}</tbody>
    </table>
    <p style="color:#888;font-size:11px;margin:12px 0 0">
      Arquivo: <code>backups/{TODAY}.json</code> · Mantido por 30 dias · HG Grifes ERP
    </p>
  </div>
</div>
"""

    subject = f'{"⚠ ALERTA — " if alerts else ""}Backup HG Grifes — {TODAY}'
    payload = {
        'from': 'HG Grifes ERP <onboarding@resend.dev>',
        'to': [EMAIL_TO],
        'subject': subject,
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

print('=== Verificacao de saude ===')
alerts = check_health()

if alerts:
    print('ALERTAS:')
    for a in alerts:
        print(' -', a)

send_email(counts, alerts)
