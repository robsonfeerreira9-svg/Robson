"""
Exporta dados para backup, gera relatório gerencial diário e envia
por email para os sócios. Roda 2x por dia via GitHub Actions.
"""
import json, subprocess, os, smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timezone, timedelta

PAT          = os.environ['SUPABASE_PAT']
GHTOKEN      = os.environ['GITHUB_TOKEN']
GMAIL_USER   = os.environ.get('GMAIL_USER', '')
GMAIL_PASS   = os.environ.get('GMAIL_APP_PASSWORD', '')
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
TODAY_BR     = datetime.now(timezone.utc).strftime('%d/%m/%Y')
PATH         = 'backups/' + TODAY + '.json'
EMAILS_ALL   = ['Robsonfeerreira9@gmail.com', 'hugobrener1@gmail.com']
EMAIL_OWNER  = 'Robsonfeerreira9@gmail.com'


# ── Keepalive duplo ───────────────────────────────────────────────────────────
def keepalive():
    r1 = subprocess.run(
        ['curl', '-s', '-X', 'POST', API + '/database/query',
         '-H', 'Authorization: Bearer ' + PAT,
         '-H', 'Content-Type: application/json',
         '--data', json.dumps({'query': 'SELECT 1'}),
         '--max-time', '15'],
        capture_output=True, text=True)
    print('Keepalive Management API:', r1.stdout[:60].strip())

    r2 = subprocess.run(
        ['curl', '-s', '-o', '/dev/null', '-w', '%{http_code}',
         SUPABASE_URL + '/rest/v1/',
         '-H', 'apikey: ' + ANON_KEY,
         '-H', 'Authorization: Bearer ' + ANON_KEY,
         '--max-time', '15'],
        capture_output=True, text=True)
    print('Keepalive REST API: HTTP', r2.stdout.strip())


# ── Query Supabase ────────────────────────────────────────────────────────────
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


def query_one(sql):
    rows = query(sql)
    if isinstance(rows, list) and rows:
        return rows[0]
    return {}


# ── Gravar arquivo no GitHub ──────────────────────────────────────────────────
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
    print('Gravado', path, '—', r.stdout[:120])


# ── Deletar arquivo no GitHub ─────────────────────────────────────────────────
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


def cleanup_old_backups():
    cutoff = datetime.now(timezone.utc) - timedelta(days=30)
    deleted = 0
    for item in list_backups():
        name = item.get('name', '')
        if not name.endswith('.json') or name == '.gitkeep':
            continue
        try:
            file_date = datetime.strptime(name.replace('.json', ''), '%Y-%m-%d').replace(tzinfo=timezone.utc)
        except Exception:
            continue
        if file_date < cutoff:
            delete_file(item['path'], item['sha'], 'backup: remove antigo ' + name.replace('.json','') + ' [skip ci]')
            deleted += 1
    print(f'Limpeza: {deleted} backup(s) removido(s) (>30 dias)')


# ── Verificação de saúde ──────────────────────────────────────────────────────
def check_health():
    alerts = []

    r = subprocess.run(
        ['curl', '-s', '-o', '/dev/null', '-w', '%{http_code}',
         '-H', 'Authorization: Bearer ' + PAT,
         'https://api.supabase.com/v1/projects/' + REF,
         '--max-time', '15'],
        capture_output=True, text=True)
    code = r.stdout.strip()
    if code != '200':
        alerts.append(f'SUPABASE_PAT inválido (HTTP {code}) — atualize em github.com/robsonfeerreira9-svg/Robson/settings/secrets/actions')
    print(f'Supabase PAT: HTTP {code}')

    r2 = subprocess.run(
        ['curl', '-s', '-H', 'Authorization: Bearer ' + PAT,
         'https://api.supabase.com/v1/projects/' + REF, '--max-time', '15'],
        capture_output=True, text=True)
    try:
        status = json.loads(r2.stdout).get('status', 'unknown')
        if status != 'ACTIVE_HEALTHY':
            alerts.append(f'Projeto Supabase com status "{status}" — pode estar pausado! Acesse app.supabase.com.')
        print(f'Supabase status: {status}')
    except Exception:
        pass

    if VERCEL_TOKEN:
        r3 = subprocess.run(
            ['curl', '-s', '-o', '/dev/null', '-w', '%{http_code}',
             '-H', 'Authorization: Bearer ' + VERCEL_TOKEN,
             f'https://api.vercel.com/v9/projects/hg-grifes-erp?teamId={VERCEL_ORG}',
             '--max-time', '15'],
            capture_output=True, text=True)
        vcode = r3.stdout.strip()
        if vcode not in ('200', '404'):
            alerts.append(f'VERCEL_TOKEN inválido (HTTP {vcode}) — renove em vercel.com/account/tokens')
        print(f'Vercel Token: HTTP {vcode}')

    return alerts


# ── Relatório gerencial ───────────────────────────────────────────────────────
def get_report():
    report = {}

    # Vendas hoje
    r = query_one("""
        SELECT
          COUNT(*)                            AS qtd,
          COALESCE(SUM(total_final), 0)       AS total,
          COALESCE(SUM(desconto_aplicado), 0) AS descontos
        FROM public.vendas
        WHERE criado_em::date = CURRENT_DATE
    """)
    report['vendas_hoje'] = {
        'qtd':       int(r.get('qtd', 0) or 0),
        'total':     float(r.get('total', 0) or 0),
        'descontos': float(r.get('descontos', 0) or 0),
    }

    # Vendas no mês
    r = query_one("""
        SELECT
          COUNT(*)                        AS qtd,
          COALESCE(SUM(total_final), 0)   AS total
        FROM public.vendas
        WHERE DATE_TRUNC('month', criado_em) = DATE_TRUNC('month', CURRENT_DATE)
    """)
    report['vendas_mes'] = {
        'qtd':   int(r.get('qtd', 0) or 0),
        'total': float(r.get('total', 0) or 0),
    }

    # Quem vendeu mais no mês
    report['ranking_vendedores'] = query("""
        SELECT
          u.nome,
          COUNT(v.id)               AS qtd_vendas,
          COALESCE(SUM(v.total_final), 0) AS total_valor
        FROM public.vendas v
        JOIN public.usuarios u ON u.id = v.vendedor_id
        WHERE DATE_TRUNC('month', v.criado_em) = DATE_TRUNC('month', CURRENT_DATE)
        GROUP BY u.nome
        ORDER BY total_valor DESC
        LIMIT 5
    """) or []

    # Produtos mais vendidos no mês
    report['produtos_top'] = query("""
        SELECT
          p.nome,
          SUM(iv.quantidade)              AS qtd_vendida,
          COALESCE(SUM(iv.subtotal_item), 0) AS total_valor
        FROM public.itens_venda iv
        JOIN public.produtos p   ON p.id = iv.produto_id
        JOIN public.vendas   v   ON v.id = iv.venda_id
        WHERE DATE_TRUNC('month', v.criado_em) = DATE_TRUNC('month', CURRENT_DATE)
        GROUP BY p.nome
        ORDER BY qtd_vendida DESC
        LIMIT 5
    """) or []

    # Clientes de hoje: novos vs recorrentes
    r = query_one("""
        SELECT
          COUNT(*) FILTER (WHERE total_antes = 0) AS novos,
          COUNT(*) FILTER (WHERE total_antes > 0)  AS recorrentes
        FROM (
          SELECT
            v.cliente_id,
            (SELECT COUNT(*) FROM public.vendas v2
             WHERE v2.cliente_id = v.cliente_id
               AND v2.criado_em < DATE_TRUNC('day', CURRENT_TIMESTAMP)) AS total_antes
          FROM public.vendas v
          WHERE v.criado_em::date = CURRENT_DATE
            AND v.cliente_id IS NOT NULL
          GROUP BY v.cliente_id
        ) sub
    """)
    report['clientes_hoje'] = {
        'novos':       int(r.get('novos', 0) or 0),
        'recorrentes': int(r.get('recorrentes', 0) or 0),
    }

    # Contas a pagar (não pagas e com vencimento futuro ou hoje)
    report['contas_pagar'] = query("""
        SELECT
          descricao,
          valor,
          vence_em,
          CASE
            WHEN vence_em < CURRENT_DATE THEN 'VENCIDA'
            WHEN vence_em = CURRENT_DATE THEN 'VENCE HOJE'
            ELSE 'A VENCER'
          END AS status_venc
        FROM public.movimentacao_caixa
        WHERE tipo = 'saida'
          AND (pago = false OR pago IS NULL)
          AND vence_em IS NOT NULL
        ORDER BY vence_em
        LIMIT 10
    """) or []

    return report


# ── Helpers de formatação ─────────────────────────────────────────────────────
def brl(v):
    return f"R$ {float(v):,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.')


def td(text, align='left', bold=False):
    b = '<b>' if bold else ''
    e = '</b>' if bold else ''
    return f'<td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:{align}">{b}{text}{e}</td>'


# ── Montar e enviar email ─────────────────────────────────────────────────────
def send_email(counts, alerts, report):
    if not RESEND_KEY:
        print('RESEND_API_KEY não configurado — email pulado')
        return

    # ── Bloco de alertas ─────────────────────────────────
    alert_block = ''
    if alerts:
        items_html = ''.join(f'<li style="color:#c0392b;margin:4px 0">{a}</li>' for a in alerts)
        alert_block = f"""
<div style="background:#fff3cd;border:1px solid #ffc107;border-radius:6px;padding:12px 16px;margin:0 0 20px">
  <b style="color:#856404">Atenção — ação necessária:</b>
  <ul style="margin:6px 0 0;padding-left:20px">{items_html}</ul>
</div>"""

    status_color = '#c0392b' if alerts else '#1a1a2e'

    # ── Vendas hoje ───────────────────────────────────────
    vh = report['vendas_hoje']
    vm = report['vendas_mes']
    cl = report['clientes_hoje']

    mes_atual = datetime.now(timezone.utc).strftime('%B/%Y').capitalize()

    vendas_hoje_html = f"""
<div style="background:#f8f9fa;border-radius:8px;padding:16px;margin-bottom:16px">
  <div style="display:flex;gap:12px;flex-wrap:wrap">
    <div style="flex:1;min-width:120px;background:#fff;border-radius:6px;padding:14px;text-align:center;border:1px solid #e0e0e0">
      <div style="font-size:28px;font-weight:700;color:#1a1a2e">{vh['qtd']}</div>
      <div style="font-size:12px;color:#666;margin-top:4px">Vendas hoje</div>
    </div>
    <div style="flex:1;min-width:120px;background:#fff;border-radius:6px;padding:14px;text-align:center;border:1px solid #e0e0e0">
      <div style="font-size:22px;font-weight:700;color:#27ae60">{brl(vh['total'])}</div>
      <div style="font-size:12px;color:#666;margin-top:4px">Total hoje</div>
    </div>
    <div style="flex:1;min-width:120px;background:#fff;border-radius:6px;padding:14px;text-align:center;border:1px solid #e0e0e0">
      <div style="font-size:22px;font-weight:700;color:#2980b9">{brl(vm['total'])}</div>
      <div style="font-size:12px;color:#666;margin-top:4px">Total {mes_atual}</div>
    </div>
    <div style="flex:1;min-width:120px;background:#fff;border-radius:6px;padding:14px;text-align:center;border:1px solid #e0e0e0">
      <div style="font-size:22px;font-weight:700;color:#8e44ad">{vm['qtd']}</div>
      <div style="font-size:12px;color:#666;margin-top:4px">Vendas no mês</div>
    </div>
  </div>
</div>"""

    # ── Clientes hoje ─────────────────────────────────────
    clientes_html = f"""
<div style="background:#eafaf1;border-radius:6px;padding:12px 16px;margin-bottom:16px;display:flex;gap:20px">
  <div style="flex:1;text-align:center">
    <div style="font-size:24px;font-weight:700;color:#27ae60">{cl['novos']}</div>
    <div style="font-size:12px;color:#555">Clientes novos hoje</div>
  </div>
  <div style="border-left:1px solid #aed6c0"></div>
  <div style="flex:1;text-align:center">
    <div style="font-size:24px;font-weight:700;color:#2980b9">{cl['recorrentes']}</div>
    <div style="font-size:12px;color:#555">Clientes que voltaram</div>
  </div>
</div>"""

    # ── Ranking de vendedores ─────────────────────────────
    vend_rows = ''
    for i, v in enumerate(report['ranking_vendedores'], 1):
        medal = ['🥇', '🥈', '🥉', '4º', '5º'][i-1]
        vend_rows += f"""<tr>
          {td(f'{medal} {v.get("nome","?")}', bold=(i==1))}
          {td(str(v.get("qtd_vendas","?")), 'center')}
          {td(brl(v.get("total_valor", 0)), 'right', bold=(i==1))}
        </tr>"""

    ranking_html = f"""
<h3 style="margin:20px 0 8px;font-size:15px;color:#1a1a2e">Ranking de Vendedores — {mes_atual}</h3>
<table style="width:100%;border-collapse:collapse;font-size:13px">
  <thead><tr style="background:#f0f0f0">
    <th style="padding:8px 12px;text-align:left">Vendedor</th>
    <th style="padding:8px 12px;text-align:center">Vendas</th>
    <th style="padding:8px 12px;text-align:right">Total</th>
  </tr></thead>
  <tbody>{vend_rows if vend_rows else '<tr><td colspan="3" style="padding:10px 12px;color:#888;text-align:center">Nenhuma venda este mês</td></tr>'}</tbody>
</table>"""

    # ── Produtos mais vendidos ────────────────────────────
    prod_rows = ''
    for i, p in enumerate(report['produtos_top'], 1):
        prod_rows += f"""<tr>
          {td(f'{i}. {p.get("nome","?")}', bold=(i==1))}
          {td(str(p.get("qtd_vendida","?")), 'center')}
          {td(brl(p.get("total_valor", 0)), 'right')}
        </tr>"""

    produtos_html = f"""
<h3 style="margin:20px 0 8px;font-size:15px;color:#1a1a2e">Produtos Mais Vendidos — {mes_atual}</h3>
<table style="width:100%;border-collapse:collapse;font-size:13px">
  <thead><tr style="background:#f0f0f0">
    <th style="padding:8px 12px;text-align:left">Produto</th>
    <th style="padding:8px 12px;text-align:center">Qtd</th>
    <th style="padding:8px 12px;text-align:right">Total</th>
  </tr></thead>
  <tbody>{prod_rows if prod_rows else '<tr><td colspan="3" style="padding:10px 12px;color:#888;text-align:center">Nenhum produto vendido este mês</td></tr>'}</tbody>
</table>"""

    # ── Contas a pagar ────────────────────────────────────
    conta_rows = ''
    for c in report['contas_pagar']:
        status = c.get('status_venc', '')
        cor = '#c0392b' if status == 'VENCIDA' else ('#e67e22' if status == 'VENCE HOJE' else '#27ae60')
        venc = c.get('vence_em', '')
        if venc:
            try:
                venc = datetime.strptime(str(venc)[:10], '%Y-%m-%d').strftime('%d/%m/%Y')
            except Exception:
                pass
        conta_rows += f"""<tr>
          {td(c.get('descricao','?'))}
          {td(brl(c.get('valor', 0)), 'right')}
          {td(venc, 'center')}
          <td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:center">
            <span style="background:{cor};color:#fff;border-radius:4px;padding:2px 8px;font-size:11px">{status}</span>
          </td>
        </tr>"""

    contas_html = f"""
<h3 style="margin:20px 0 8px;font-size:15px;color:#1a1a2e">Contas a Pagar</h3>
<table style="width:100%;border-collapse:collapse;font-size:13px">
  <thead><tr style="background:#f0f0f0">
    <th style="padding:8px 12px;text-align:left">Descrição</th>
    <th style="padding:8px 12px;text-align:right">Valor</th>
    <th style="padding:8px 12px;text-align:center">Vencimento</th>
    <th style="padding:8px 12px;text-align:center">Status</th>
  </tr></thead>
  <tbody>{conta_rows if conta_rows else '<tr><td colspan="4" style="padding:10px 12px;color:#888;text-align:center">Nenhuma conta a pagar cadastrada</td></tr>'}</tbody>
</table>"""

    # ── Monta HTML final ──────────────────────────────────
    html = f"""
<div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;color:#1a1a2e">

  <div style="background:{status_color};color:#fff;padding:16px 24px;border-radius:8px 8px 0 0">
    <h2 style="margin:0;font-size:20px">HG Grifes ERP — Relatório Diário</h2>
    <p style="margin:6px 0 0;font-size:13px;opacity:.85">{TODAY_BR} &nbsp;·&nbsp; Backup automático</p>
  </div>

  <div style="border:1px solid #ddd;border-top:none;padding:20px 24px;border-radius:0 0 8px 8px">
    {alert_block}
    {vendas_hoje_html}
    {clientes_html}
    {ranking_html}
    {produtos_html}
    {contas_html}

    <hr style="border:none;border-top:1px solid #eee;margin:20px 0">
    <p style="color:#aaa;font-size:11px;margin:0">
      HG Grifes ERP · Backup salvo em <code>backups/{TODAY}.json</code>
    </p>
  </div>
</div>
"""

    subject = f'{"ALERTA — " if alerts else ""}HG Grifes {TODAY_BR} — {vh["qtd"]} venda(s) · {brl(vh["total"])}'

    # ── Opção 1: Gmail SMTP (envia para todos, incluindo hugobrener1) ─────────
    if GMAIL_USER and GMAIL_PASS:
        try:
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From']    = f'HG Grifes ERP <{GMAIL_USER}>'
            msg['To']      = ', '.join(EMAILS_ALL)
            msg.attach(MIMEText(html, 'html'))
            with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
                server.login(GMAIL_USER, GMAIL_PASS)
                server.sendmail(GMAIL_USER, EMAILS_ALL, msg.as_string())
            print('Email (Gmail) enviado para', EMAILS_ALL)
            return
        except Exception as e:
            print('Erro Gmail SMTP:', str(e), '— tentando Resend...')

    # ── Opção 2: Resend (fallback — só envia para o dono da conta) ────────────
    if RESEND_KEY:
        payload = {
            'from': 'HG Grifes ERP <onboarding@resend.dev>',
            'to': [EMAIL_OWNER],
            'subject': subject + ' (apenas Robson — configure Gmail para Hugo também)',
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
            print('Email (Resend) enviado para', EMAIL_OWNER, '— id:', resp['id'])
            print('AVISO: hugobrener1@gmail.com NAO recebeu — configure GMAIL_USER e GMAIL_APP_PASSWORD')
        else:
            print('Erro Resend:', r.stdout[:200])
        return

    print('Nenhum metodo de email configurado (GMAIL_USER ou RESEND_API_KEY necessario)')


# ── MAIN ──────────────────────────────────────────────────────────────────────
print('=== Backup', TODAY, '===')

keepalive()

tables = {
    'vendas':             'SELECT * FROM public.vendas ORDER BY criado_em',
    'clientes':           'SELECT * FROM public.clientes ORDER BY criado_em',
    'movimentacao_caixa': 'SELECT * FROM public.movimentacao_caixa ORDER BY criado_em',
    'itens_venda':        'SELECT * FROM public.itens_venda',
    'comissoes':          'SELECT * FROM public.comissoes ORDER BY criado_em',
    'produtos':           'SELECT * FROM public.produtos ORDER BY nome',
    'estoque':            'SELECT * FROM public.estoque',
    'usuarios':           'SELECT id, email, nome, role, ativo FROM public.usuarios',
    'audit_log':          'SELECT * FROM public.audit_delete_log ORDER BY deletado_em DESC LIMIT 5000',
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

print('=== Relatorio gerencial ===')
report = get_report()
vh = report['vendas_hoje']
vm = report['vendas_mes']
print(f'  Vendas hoje: {vh["qtd"]} | {brl(vh["total"])}')
print(f'  Vendas mes:  {vm["qtd"]} | {brl(vm["total"])}')
print(f'  Clientes novos: {report["clientes_hoje"]["novos"]} | Recorrentes: {report["clientes_hoje"]["recorrentes"]}')
print(f'  Contas a pagar: {len(report["contas_pagar"])}')

print('=== Verificacao de saude ===')
alerts = check_health()
if alerts:
    for a in alerts:
        print(' -', a)

send_email(counts, alerts, report)
