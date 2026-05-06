"""
Verifica se o banco está vazio e restaura o backup mais recente
anterior a 06/05/2026 00:32 UTC se necessário.
"""
import json, subprocess, os, sys, time
from datetime import datetime, timezone

PAT     = os.environ['SUPABASE_PAT']
GHTOKEN = os.environ['GITHUB_TOKEN']
REPO    = os.environ.get('GITHUB_REPOSITORY', '')
BRANCH  = os.environ.get('GITHUB_REF_NAME', '')
REF     = 'eaovtnotwfzuxgtqpkay'
API     = 'https://api.supabase.com/v1/projects/' + REF


def supabase_query(sql):
    payload = json.dumps({'query': sql})
    r = subprocess.run(
        ['curl', '-s', '-X', 'POST', API + '/database/query',
         '-H', 'Authorization: Bearer ' + PAT,
         '-H', 'Content-Type: application/json',
         '--data', payload, '--max-time', '30'],
        capture_output=True, text=True)
    try:
        return json.loads(r.stdout)
    except Exception:
        return {'error': r.stdout}


def write_debug(content, msg='debug: restore result [skip ci]'):
    encoded = subprocess.run(
        ['base64', '-w0'], input=content.encode(), capture_output=True
    ).stdout.decode()
    sha_r = subprocess.run(
        ['curl', '-s',
         '-H', 'Authorization: token ' + GHTOKEN,
         'https://api.github.com/repos/' + REPO + '/contents/debug-restore.txt?ref=' + BRANCH],
        capture_output=True, text=True)
    try:
        sha = json.loads(sha_r.stdout).get('sha', '')
    except Exception:
        sha = ''
    payload = {'message': msg, 'content': encoded, 'branch': BRANCH}
    if sha:
        payload['sha'] = sha
    subprocess.run(
        ['curl', '-s', '-X', 'PUT',
         '-H', 'Authorization: token ' + GHTOKEN,
         '-H', 'Content-Type: application/json',
         'https://api.github.com/repos/' + REPO + '/contents/debug-restore.txt',
         '--data', json.dumps(payload)],
        capture_output=True)
    print('debug-restore.txt gravado:', content[:120])


# ── 1. Verificar dados atuais ─────────────────────────────────────────────────
print('=== Verificando dados atuais ===')
counts = supabase_query(
    "SELECT (SELECT COUNT(*) FROM public.vendas) AS vendas,"
    "(SELECT COUNT(*) FROM public.clientes) AS clientes,"
    "(SELECT COUNT(*) FROM public.movimentacao_caixa) AS mov"
)
print('Counts:', counts)

n_vendas = 0
if isinstance(counts, list) and counts:
    n_vendas = int(counts[0].get('vendas', 0))
elif isinstance(counts, dict):
    rows = counts.get('data', [])
    if rows:
        n_vendas = int(rows[0].get('vendas', 0))

print('Vendas encontradas:', n_vendas)

# Sempre lista backups para diagnóstico, mesmo com dados
print('Banco atual — vendas:', n_vendas, '| clientes atual pode ter sumido, listando backups...')

# ── 2. Banco vazio — buscar backups ───────────────────────────────────────────
print('=== Banco vazio. Buscando backups ===')
r = subprocess.run(
    ['curl', '-s', '-w', '\nHTTP_STATUS:%{http_code}',
     API + '/database/backups',
     '-H', 'Authorization: Bearer ' + PAT],
    capture_output=True, text=True)
lines = r.stdout.strip().split('\n')
http  = next((l.split(':')[1] for l in lines if l.startswith('HTTP_STATUS:')), '?')
body  = '\n'.join(l for l in lines if not l.startswith('HTTP_STATUS:'))
print('Backups HTTP', http, ':', body[:300])

try:
    data    = json.loads(body)
    backups = data if isinstance(data, list) else data.get('backups', data.get('physical_backups', []))
except Exception:
    backups = []

cutoff = datetime(2026, 5, 6, 0, 32, 0, tzinfo=timezone.utc)
valid  = []
for b in backups:
    for key in ('inserted_at', 'created_at', 'snapshot_at', 'started_at'):
        ts_str = b.get(key, '')
        if not ts_str:
            continue
        try:
            ts = datetime.fromisoformat(ts_str.replace('Z', '+00:00'))
            if ts < cutoff:
                bid = b.get('id') or b.get('backup_id') or b.get('name', '')
                valid.append((ts, str(bid)))
        except Exception:
            pass
        break

print('Backups válidos antes de 06/05:', valid)

if not valid:
    msg = ('RESULTADO: ' + str(n_vendas) + ' vendas no banco agora.\n'
           'Nenhum backup encontrado antes de 06/05/2026 — dados irrecuperáveis via API.\n'
           'HTTP ' + http + '\nResposta completa da API de backups:\n' + body)
    write_debug(msg)
    print(msg)
    sys.exit(0)

# Com dados no banco E backup disponível — mostrar o que existe antes de restaurar
if n_vendas > 0:
    write_debug(
        'BANCO NAO VAZIO: ' + str(n_vendas) + ' vendas, 0 clientes.\n'
        'Backup disponível: ' + str(valid[0]) + '\n'
        'Total backups antes de 06/05: ' + str(len(valid)) + '\n'
        'Counts: ' + json.dumps(counts) + '\n\n'
        'Para forçar restore mesmo com dados existentes, ajuste o script.'
    )
    print('Banco tem', n_vendas, 'vendas mas 0 clientes. Backup disponível:', valid[0])
    print('Não restaurando automaticamente para não sobrescrever dados atuais.')
    sys.exit(0)

# ── 3. Restaurar backup mais recente ─────────────────────────────────────────
valid.sort(reverse=True)
backup_ts, backup_id = valid[0]
print('Restaurando backup', backup_id, 'de', backup_ts)

restore_r = subprocess.run(
    ['curl', '-s', '-w', '\nHTTP_STATUS:%{http_code}',
     '-X', 'POST',
     API + '/database/backups/' + backup_id + '/restore',
     '-H', 'Authorization: Bearer ' + PAT,
     '-H', 'Content-Type: application/json',
     '--data', '{}'],
    capture_output=True, text=True)
rlines = restore_r.stdout.strip().split('\n')
rhttp  = next((l.split(':')[1] for l in rlines if l.startswith('HTTP_STATUS:')), '?')
rbody  = '\n'.join(l for l in rlines if not l.startswith('HTTP_STATUS:'))
print('Restore HTTP', rhttp, ':', rbody)

write_debug(
    'RESTORE INICIADO\nBackup: ' + backup_id + ' (' + str(backup_ts) + ')\n'
    'HTTP: ' + rhttp + '\nResposta: ' + rbody + '\n\nAguardando 3 minutos...',
    'debug: restore iniciado [skip ci]'
)

if rhttp.startswith('2'):
    print('Restore aceito. Aguardando 180s...')
    time.sleep(180)
    write_debug(
        'RESTORE CONCLUIDO\nBackup: ' + backup_id + '\nHTTP: ' + rhttp + '\n' + rbody,
        'debug: restore result [skip ci]'
    )
else:
    print('Restore falhou: HTTP', rhttp, rbody)
    write_debug(
        'RESTORE FALHOU\nHTTP: ' + rhttp + '\n' + rbody +
        '\n\nBackups disponiveis HTTP ' + http + ':\n' + body,
        'debug: restore result [skip ci]'
    )
