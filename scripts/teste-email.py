"""Testa envio de email via Resend e imprime resposta completa."""
import json, subprocess, os

RESEND_KEY = os.environ.get('RESEND_API_KEY', '')

if not RESEND_KEY:
    print('ERRO: RESEND_API_KEY não configurado!')
    exit(1)

print(f'Chave encontrada: {RESEND_KEY[:8]}...')

r = subprocess.run(
    ['curl', '-s', '-X', 'POST', 'https://api.resend.com/emails',
     '-H', 'Authorization: Bearer ' + RESEND_KEY,
     '-H', 'Content-Type: application/json',
     '--data', json.dumps({
         'from': 'HG Grifes ERP <onboarding@resend.dev>',
         'to': ['Robsonfeerreira9@gmail.com', 'hugobrener1@gmail.com'],
         'subject': 'HG Grifes — Teste de Email',
         'html': '<h2>Teste HG Grifes ERP</h2><p>Email funcionando!</p>',
     }),
     '--max-time', '20'],
    capture_output=True, text=True)

print('Resposta Resend:', r.stdout)
print('Stderr:', r.stderr[:200] if r.stderr else 'nenhum')
