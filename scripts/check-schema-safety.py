"""
Verifica se sql/schema.sql contém DELETE/TRUNCATE perigosos fora de stored procedures.
Bloqueia o deploy (exit 1) se encontrar.
"""
import re, sys

sql = open('sql/schema.sql').read()

# Remove apenas CREATE FUNCTION/PROCEDURE $$ blocks (não executam imediatamente)
# DO $$ blocks são mantidos pois executam IMEDIATAMENTE no deploy
sql_stripped = re.sub(
    r'CREATE\s+(?:OR\s+REPLACE\s+)?(?:FUNCTION|PROCEDURE)\s+[^$]*\$\$.*?\$\$',
    '$$REMOVED$$', sql, flags=re.DOTALL | re.IGNORECASE
)

# Remove comentários de linha
sql_stripped = re.sub(r'--[^\n]*', '', sql_stripped)

dangerous = []

# DELETE sem WHERE na mesma linha (padrão do bug que causou a perda de dados)
for match in re.finditer(
    r'DELETE\s+FROM\s+(?:public\.)?(\w+)\s*;',
    sql_stripped, re.IGNORECASE
):
    dangerous.append(f'DELETE sem WHERE: {match.group(0).strip()}')

# TRUNCATE em qualquer tabela
for match in re.finditer(
    r'TRUNCATE\s+(?:TABLE\s+)?(?:public\.)?(\w+)',
    sql_stripped, re.IGNORECASE
):
    dangerous.append(f'TRUNCATE detectado: {match.group(0).strip()}')

if dangerous:
    print('=' * 60)
    print('BLOQUEADO: schema.sql contém operacoes perigosas de exclusao!')
    print('Estas instrucoes podem apagar TODOS os dados do banco:')
    for d in dangerous:
        print('  >', d)
    print()
    print('Remova ou mova para dentro de uma stored procedure antes de fazer deploy.')
    print('=' * 60)
    sys.exit(1)

print('schema.sql OK — nenhum DELETE/TRUNCATE perigoso encontrado.')
