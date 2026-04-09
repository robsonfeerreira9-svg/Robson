#!/usr/bin/env node
// Migration Supabase — testa todas as regiões até achar a certa
'use strict';

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Todas as regiões do Supabase + conexão direta (IPv4 forçado)
const HOSTS = [
  // Conexão direta (força IPv4)
  { host: 'db.eaovtnotwfzuxgtqpkay.supabase.co', port: 5432, user: 'postgres', label: 'direto-ipv4', family: 4 },
  // Session pooler — todas as regiões disponíveis
  ...[
    'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
    'eu-west-1', 'eu-west-2', 'eu-west-3', 'eu-central-1', 'eu-north-1',
    'sa-east-1',
    'ap-southeast-1', 'ap-southeast-2',
    'ap-northeast-1', 'ap-northeast-2',
    'ap-south-1',
    'ca-central-1',
  ].map(r => ({
    host: `aws-0-${r}.pooler.supabase.com`,
    port: 5432,
    user: 'postgres.eaovtnotwfzuxgtqpkay',
    label: `pooler-${r}`,
    family: 4,
  })),
];

async function tryConnect(cfg) {
  const client = new Client({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: process.env.SUPABASE_DB_PASSWORD,
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 8000,
    family: cfg.family || 0,
  });
  await client.connect();
  return client;
}

async function main() {
  const sqlPath = path.join(__dirname, '..', 'sql', 'schema.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  for (const cfg of HOSTS) {
    process.stdout.write(`→ ${cfg.label}... `);
    let client;
    try {
      client = await tryConnect(cfg);
      console.log('CONECTADO!');
      console.log('  Executando schema.sql...');
      await client.query(sql);
      console.log('  ✓ Migration concluída!\n');
      await client.end();
      process.exit(0);
    } catch (err) {
      const msg = err.message.replace(/\n/g, ' ').substring(0, 80);
      console.log(`✗ ${msg}`);
      if (client) { try { await client.end(); } catch (_) {} }
      // Parar cedo se não é problema de região
      if (err.code === 'ECONNREFUSED') break;
    }
  }

  console.error('\n✗ Nenhuma conexão funcionou.');
  process.exit(1);
}

main();
