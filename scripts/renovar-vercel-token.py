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

# Verifica token atual
me = vercel('GET', '/v2/user')
username = me.get('user', {}).get('username', 'desconhecido')
print(f'Usuário Vercel: {username}')

# Lista tokens existentes para verificar expiração do atual
tokens_resp = vercel('GET', '/v3/user/tokens')
tokens = tokens_resp.get('tokens', [])
current_info = None
for t in tokens:
    # Tenta identificar o token atual pelo nome
    expires = t.get('expiresAt')
    print(f'  Token: {t.get("name","?")} | Expira: {expires or "nunca"}')
    if expires:
        current_info = t

print()
print('=== Criando novo token permanente ===')

# Cria novo token sem expiração
new_token_resp = vercel('POST', '/v3/user/tokens', {
    'name': TOKEN_NAME,
    # Sem "expiresAt" = permanente
})

new_token = new_token_resp.get('token', {}).get('token') or new_token_resp.get('token')
token_id   = new_token_resp.get('token', {}).get('id', '')

if not new_token:
    print('Erro ao criar token:', json.dumps(new_token_resp, indent=2))
    send_email(
        '❌ Falha ao renovar VERCEL_TOKEN — HG Grifes',
        f'<p>Não foi possível criar um novo token Vercel automaticamente.</p>'
        f'<p>Erro: <pre>{json.dumps(new_token_resp, indent=2)}</pre></p>'
        f'<p>Acesse <a href="https://vercel.com/account/tokens">vercel.com/account/tokens</a> '
        f'e crie manualmente um token sem expiração.</p>'
    )
    sys.exit(1)

print(f'Novo token criado: {TOKEN_NAME}')

# ── Monta email com instruções claras ─────────────────────────────────────────
secrets_url = f'https://github.com/{REPO}/settings/secrets/actions/VERCEL_TOKEN'

html = f"""
<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto">
  <div style="background:#0070f3;color:#fff;padding:16px 24px;border-radius:8px 8px 0 0">
    <h2 style="margin:0;font-size:20px">HG Grifes ERP — Novo Token Vercel</h2>
    <p style="margin:6px 0 0;font-size:13px;opacity:.85">Gerado em {TODAY} · Sem data de expiração</p>
  </div>
  <div style="border:1px solid #ddd;border-top:none;padding:20px 24px;border-radius:0 0 8px 8px">

    <p>Um novo token Vercel permanente foi gerado automaticamente.</p>
    <p><b>Faça apenas 3 cliques para ativar:</b></p>

    <div style="background:#f6f8fa;border:1px solid #d0d7de;border-radius:6px;padding:14px 18px;margin:16px 0">
      <p style="margin:0 0 8px;font-size:13px;color:#57606a">Passo 1 — Abra este link:</p>
      <a href="{secrets_url}" style="color:#0070f3;font-size:13px;word-break:break-all">{secrets_url}</a>

      <p style="margin:16px 0 8px;font-size:13px;color:#57606a">Passo 2 — Clique no botão <b>Update</b> e cole o token abaixo:</p>
      <div style="background:#fff;border:2px solid #0070f3;border-radius:4px;padding:12px;font-family:monospace;font-size:13px;word-break:break-all;color:#1a1a2e">
        {new_token}
      </div>

      <p style="margin:16px 0 8px;font-size:13px;color:#57606a">Passo 3 — Clique em <b>Update secret</b></p>
    </div>

    <p style="color:#57606a;font-size:12px;margin:16px 0 0">
      Este token não tem data de expiração e funcionará indefinidamente.<br>
      Nome do token: <code>{TOKEN_NAME}</code>
    </p>

    <hr style="border:none;border-top:1px solid #eee;margin:16px 0">
    <p style="color:#888;font-size:11px;margin:0">HG Grifes ERP · Backup automático de segurança</p>
  </div>
</div>
"""

send_email(f'🔑 Novo VERCEL_TOKEN gerado — cole no GitHub', html)
print()
print('=' * 60)
print(f'NOVO TOKEN CRIADO COM SUCESSO')
print(f'Nome: {TOKEN_NAME}')
print(f'Email enviado para: {EMAIL_TO}')
print(f'Atualize o secret em: {secrets_url}')
print('=' * 60)
