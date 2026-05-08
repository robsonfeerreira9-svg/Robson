"""Testa envio de email via Resend e salva resposta em debug-email.txt."""
import json, subprocess, os, base64

RESEND_KEY = os.environ.get('RESEND_API_KEY', '')
GHTOKEN    = os.environ.get('GITHUB_TOKEN', '')
REPO       = os.environ.get('GITHUB_REPOSITORY', '')
BRANCH     = os.environ.get('GITHUB_REF_NAME', '')

lines = []

if not RESEND_KEY:
    lines.append('ERRO: RESEND_API_KEY nao configurado!')
else:
    lines.append(f'Chave: {RESEND_KEY[:12]}...')

    r = subprocess.run(
        ['curl', '-s', '-X', 'POST', 'https://api.resend.com/emails',
         '-H', 'Authorization: Bearer ' + RESEND_KEY,
         '-H', 'Content-Type: application/json',
         '--data', json.dumps({
             'from': 'HG Grifes ERP <onboarding@resend.dev>',
             'to': ['Robsonfeerreira9@gmail.com', 'hugobrener1@gmail.com'],
             'subject': 'HG Grifes — Teste de Email',
             'html': '<h2>Teste HG Grifes ERP</h2><p>Email chegando certinho!</p>',
         }),
         '--max-time', '20'],
        capture_output=True, text=True)

    lines.append(f'HTTP stdout: {r.stdout}')
    lines.append(f'Stderr: {r.stderr[:300] if r.stderr else "nenhum"}')

    # Testa também a conta do Resend
    r2 = subprocess.run(
        ['curl', '-s', 'https://api.resend.com/domains',
         '-H', 'Authorization: Bearer ' + RESEND_KEY,
         '--max-time', '15'],
        capture_output=True, text=True)
    lines.append(f'Dominios Resend: {r2.stdout[:300]}')

result = '\n'.join(lines)
print(result)

# Salva no repositório para leitura
encoded = base64.b64encode(result.encode()).decode()
sha_r = subprocess.run(
    ['curl', '-s', '-H', f'Authorization: token {GHTOKEN}',
     f'https://api.github.com/repos/{REPO}/contents/debug-email.txt?ref={BRANCH}'],
    capture_output=True, text=True)
try:
    sha = json.loads(sha_r.stdout).get('sha', '')
except Exception:
    sha = ''
payload = {'message': 'debug: resultado teste email [skip ci]',
           'content': encoded, 'branch': BRANCH}
if sha:
    payload['sha'] = sha
subprocess.run(
    ['curl', '-s', '-X', 'PUT', '-H', f'Authorization: token {GHTOKEN}',
     '-H', 'Content-Type: application/json',
     f'https://api.github.com/repos/{REPO}/contents/debug-email.txt',
     '--data', json.dumps(payload)],
    capture_output=True, text=True)
