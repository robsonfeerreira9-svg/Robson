"""
Usa o VERCEL_TOKEN atual para criar um novo token permanente (sem expiração),
depois envia o novo token por email com instruções de como atualizar o secret.
"""
import json, subprocess, os, sys
from datetime import datetime, timezone

VERCEL_TOKEN = os.environ.get('VERCEL_TOKEN', '')
RESEND_KEY   = os.environ.get('RESEND_API_KEY', '')
REPO         = os.environ.get('GITHUB_REPOSITORY', 'robsonfeerreira9-svg/Robson')
EMAIL_TO     = 'Robsonfeerreira9@gmail.com'
TODAY        = datetime.now(timezone.utc).strftime('%Y-%m-%d')
TOKEN_NAME   = f'HG-Grifes-ERP-renovado-{TODAY}'


def vercel(method, path, data=None):
    cmd = ['curl', '-s', '-X', method,
           '-H', 'Authorization: Bearer ' + VERCEL_TOKEN,
           '-H', 'Content-Type: application/json',
           f'https://api.vercel.com{path}',
           '--max-time', '20']
    if data:
        cmd += ['--data', json.dumps(data)]
    r = subprocess.run(cmd, capture_output=True, text=True)
    try:
        return json.loads(r.stdout)
    except Exception:
        print('Resposta Vercel:', r.stdout[:300])
        return {}


def send_email(subject, html):
    if not RESEND_KEY:
        print('RESEND_API_KEY não configurado — email não enviado')
        return
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
        print(f'Email enviado para {EMAIL_TO} — id: {resp["id"]}')
    else:
        print('Erro ao enviar email:', r.stdout[:200])


if not VERCEL_TOKEN:
    print('VERCEL_TOKEN não configurado. Adicione o secret no GitHub.')
    sys.exit(1)

print('=== Verificando token Vercel atual ===')

secrets_url = f'https://github.com/{REPO}/settings/secrets/actions/VERCEL_TOKEN'

if not VERCEL_TOKEN:
    print('VERCEL_TOKEN não configurado.')
    sys.exit(1)

# Verifica conta e tokens existentes
me = vercel('GET', '/v2/user')
username = me.get('user', {}).get('username', 'desconhecido')
print(f'Usuário Vercel: {username}')

tokens_resp = vercel('GET', '/v3/user/tokens')
tokens = tokens_resp.get('tokens', [])

expiring_soon = []
for t in tokens:
    expires_ms = t.get('expiresAt')
    name = t.get('name', '?')
    if expires_ms:
        expires_dt = datetime.fromtimestamp(int(expires_ms) / 1000, tz=timezone.utc)
        days_left = (expires_dt - datetime.now(timezone.utc)).days
        print(f'  Token: {name} | Expira: {expires_dt.strftime("%Y-%m-%d")} ({days_left} dias)')
        if days_left < 60:
            expiring_soon.append({'name': name, 'days': days_left, 'date': expires_dt.strftime('%d/%m/%Y')})
    else:
        print(f'  Token: {name} | Expira: nunca (permanente)')

print()

if not expiring_soon:
    print('Todos os tokens estão OK — nenhum expira em menos de 60 dias.')
    send_email(
        'Vercel Token OK — HG Grifes ERP',
        f"""
<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto">
  <div style="background:#27ae60;color:#fff;padding:14px 20px;border-radius:6px 6px 0 0">
    <h2 style="margin:0;font-size:18px">HG Grifes ERP — Token Vercel OK</h2>
  </div>
  <div style="border:1px solid #ddd;border-top:none;padding:16px 20px;border-radius:0 0 6px 6px">
    <p>Verificação realizada em <b>{TODAY}</b>.</p>
    <p>Nenhum token Vercel expira nos próximos 60 dias. Sistema funcionando normalmente.</p>
  </div>
</div>"""
    )
    sys.exit(0)

# Há tokens expirando em breve — monta alerta
items_html = ''.join(
    f'<li><b>{t["name"]}</b> — expira em {t["date"]} ({t["days"]} dias)</li>'
    for t in expiring_soon
)

html = f"""
<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto">
  <div style="background:#e67e22;color:#fff;padding:16px 24px;border-radius:8px 8px 0 0">
    <h2 style="margin:0;font-size:20px">HG Grifes ERP — Token Vercel expirando!</h2>
    <p style="margin:6px 0 0;font-size:13px;opacity:.85">Ação necessária nos próximos dias</p>
  </div>
  <div style="border:1px solid #ddd;border-top:none;padding:20px 24px;border-radius:0 0 8px 8px">
    <p>Os seguintes tokens Vercel vão expirar em breve:</p>
    <ul style="color:#c0392b">{items_html}</ul>

    <p><b>Para criar um novo token permanente (2 minutos):</b></p>
    <ol>
      <li>Acesse <a href="https://vercel.com/account/tokens">vercel.com/account/tokens</a></li>
      <li>Clique em <b>Create Token</b></li>
      <li>Nome: <code>HG-Grifes-ERP</code> · Scope: <code>{username}</code> · Expiration: <b>No expiration</b></li>
      <li>Copie o token gerado</li>
      <li>Acesse <a href="{secrets_url}">{secrets_url}</a></li>
      <li>Clique em <b>Update</b> → cole o token → <b>Update secret</b></li>
    </ol>

    <p style="color:#888;font-size:11px;margin:16px 0 0">HG Grifes ERP · Monitoramento automático</p>
  </div>
</div>
"""

send_email('⚠ VERCEL_TOKEN expirando — renovar em breve — HG Grifes', html)
print('ALERTA: tokens expirando em breve enviado para', EMAIL_TO)
print('Acesse vercel.com/account/tokens para renovar.')
# Não faz exit(1) — o alerta foi enviado com sucesso
sys.exit(0)
