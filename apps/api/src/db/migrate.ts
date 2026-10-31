import 'dotenv/config';
import { readFileSync, existsSync } from 'node:fs';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './client.js';

// Standalone migration runner — invoke with `npm run migrate -w apps/api`.
// Applies each module's schema.sql. Order matters only for FK dependencies:
// `users` (the shared identity root, APPROACH.md §7) must run first since
// every other module's tables reference it via user_id.
const FIRST = ['users'];

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const modulesDir = path.resolve(__dirname, '../modules');

function moduleOrder(): string[] {
  const all = readdirSync(modulesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  const rest = all.filter((name) => !FIRST.includes(name)).sort();
  return [...FIRST.filter((name) => all.includes(name)), ...rest];
}

async function run() {
  const order = moduleOrder();
  console.log(`Running migrations for modules: ${order.join(', ')}`);

  for (const moduleName of order) {
    const schemaPath = path.join(modulesDir, moduleName, 'schema.sql');
    if (!existsSync(schemaPath)) {
      console.log(`  - ${moduleName}: no schema.sql, skipping`);
      continue;
    }
    const sql = readFileSync(schemaPath, 'utf-8');
    console.log(`  - ${moduleName}: applying schema.sql`);
    await pool.query(sql);
  }

  console.log('Migrations complete.');
  await pool.end();
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exitCode = 1;
  return pool.end();
});
