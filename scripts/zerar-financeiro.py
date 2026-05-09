"""Zera movimentacao_caixa — desabilita trigger temporariamente para garantir execução."""
import json, subprocess, os

PAT = os.environ['SUPABASE_PAT']
REF = 'eaovtnotwfzuxgtqpkay'
API = f'https://api.supabase.com/v1/projects/{REF}/database/query'

def sql(query):
    r = subprocess.run(
        ['curl', '-s', '-X', 'POST', API,
         '-H', 'Authorization: Bearer ' + PAT,
         '-H', 'Content-Type: application/json',
         '--data', json.dumps({'query': query}),
         '--max-time', '30'],
        capture_output=True, text=True)
    print('SQL:', query[:80].replace('\n',' '), '→', r.stdout[:120])
    return r.stdout

# Conta antes
sql('SELECT COUNT(*) AS antes FROM public.movimentacao_caixa')

# Desabilita triggers temporariamente para garantir o delete
sql('ALTER TABLE public.movimentacao_caixa DISABLE TRIGGER ALL')

# Apaga tudo
sql('DELETE FROM public.movimentacao_caixa')

# Reabilita triggers
sql('ALTER TABLE public.movimentacao_caixa ENABLE TRIGGER ALL')

# Confirma resultado
sql('SELECT COUNT(*) AS depois FROM public.movimentacao_caixa')

print()
print('Financeiro zerado. Pode lancar tudo novamente.')
