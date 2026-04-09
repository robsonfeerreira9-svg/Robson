#!/usr/bin/env node
// Script de migration para o Supabase — usado no GitHub Actions
'use strict';

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const HOSTS = [
  // Conexão direta
  {
    host: 'db.eaovtnotwfzuxgtqpkay.supabase.co',
    port: 5432,
    user: 'postgres',
    label: 'direto',
  },
  // Session pooler (sa-east-1)
  {
    host: 'aws-0-sa-east-1.pooler.supabase.com',
    port: 5432,
    user: 'postgres.eaovtnotwfzuxgtqpkay',
    label: 'pooler sa-east-1',
  },
  // Session pooler (us-east-1 fallback)
  {
    host: 'aws-0-us-east-1.pooler.supabase.com',
    port: 5432,
    user: 'postgres.eaovtnotwfzuxgtqpkay',
    label: 'pooler us-east-1',
  },
];

async function tryConnect(cfg) {
  const client = new Client({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: process.env.SUPABASE_DB_PASSWORD,
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });
  await client.connect();
  return client;
}

async function main() {
  const sqlPath = path.join(__dirname, '..', 'sql', 'schema.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  for (const cfg of HOSTS) {
    console.log(`\n→ Tentando ${cfg.label} (${cfg.host}:${cfg.port})...`);
    let client;
    try {
      client = await tryConnect(cfg);
      console.log('  ✓ Conectado!');

      console.log('  Executando schema.sql...');
      await client.query(sql);
      console.log('  ✓ Migration concluída!\n');
      await client.end();
      process.exit(0);
    } catch (err) {
      console.error(`  ✗ Erro: ${err.message}`);
      if (err.code) console.error(`    Código: ${err.code}`);
      if (client) { try { await client.end(); } catch (_) {} }
    }
  }

  console.error('\n✗ Nenhuma conexão funcionou.');
  process.exit(1);
}

main();
