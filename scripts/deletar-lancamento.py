"""Deleta registros de movimentacao_caixa de uma data específica."""
import json, subprocess, os

PAT = os.environ['SUPABASE_PAT']
DATA = os.environ.get('DATA_LANCAMENTO', '2026-05-05')
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
    print('SQL:', query[:100].replace('\n',' '), '->', r.stdout[:300])
    return r.stdout

print(f'=== Deletando lancamentos do dia {DATA} ===')

# Mostra o que sera deletado (considera fuso Brasil UTC-3)
sql(f"""
SELECT id, descricao, tipo, valor,
       criado_em,
       (criado_em AT TIME ZONE 'America/Sao_Paulo')::date AS data_brasil
FROM public.movimentacao_caixa
WHERE (criado_em AT TIME ZONE 'America/Sao_Paulo')::date = '{DATA}'
   OR criado_em::date = '{DATA}'
   OR vence_em::text = '{DATA}'
ORDER BY criado_em
""")

sql('ALTER TABLE public.movimentacao_caixa DISABLE TRIGGER ALL')

# Deleta usando fuso horario Brasil + UTC como fallback
sql(f"""
DELETE FROM public.movimentacao_caixa
WHERE (criado_em AT TIME ZONE 'America/Sao_Paulo')::date = '{DATA}'
   OR criado_em::date = '{DATA}'
   OR vence_em::text = '{DATA}'
""")

sql('ALTER TABLE public.movimentacao_caixa ENABLE TRIGGER ALL')

sql('SELECT COUNT(*) AS total_restante FROM public.movimentacao_caixa')

print(f'Lancamentos do dia {DATA} removidos.')
