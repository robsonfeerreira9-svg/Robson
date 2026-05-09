"""Apaga todos os registros de movimentacao_caixa conforme solicitado pelo usuário."""
import json, subprocess, os, sys

PAT    = os.environ['SUPABASE_PAT']
GHTOKEN = os.environ.get('GITHUB_TOKEN', '')
REPO   = os.environ.get('GITHUB_REPOSITORY', '')
BRANCH = os.environ.get('GITHUB_REF_NAME', '')
REF    = 'eaovtnotwfzuxgtqpkay'
API    = f'https://api.supabase.com/v1/projects/{REF}/database/query'

def sql(query):
    r = subprocess.run(
        ['curl', '-s', '-X', 'POST', API,
         '-H', 'Authorization: Bearer ' + PAT,
         '-H', 'Content-Type: application/json',
         '--data', json.dumps({'query': query}),
         '--max-time', '30'],
        capture_output=True, text=True)
    try:
        return json.loads(r.stdout)
    except Exception:
        return r.stdout

# 1. Conta registros antes
total = sql('SELECT COUNT(*) AS total FROM public.movimentacao_caixa')
print('Registros em movimentacao_caixa:', total)

# 2. Apaga tudo (trigger salva cópia em audit_delete_log automaticamente)
result = sql('DELETE FROM public.movimentacao_caixa')
print('Delete executado:', result)

# 3. Confirma que zerou
pos = sql('SELECT COUNT(*) AS total FROM public.movimentacao_caixa')
print('Registros após limpeza:', pos)

audit = sql('SELECT COUNT(*) AS total FROM public.audit_delete_log WHERE tabela = \'movimentacao_caixa\'')
print('Cópias salvas no audit_log:', audit)

print()
print('Financeiro zerado com sucesso. Pode lançar tudo novamente.')
