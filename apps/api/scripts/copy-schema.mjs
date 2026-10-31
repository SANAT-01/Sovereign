// `tsc` only emits compiled .js — it never copies non-.ts assets. migrate.ts
// resolves schema.sql relative to its own (compiled) location, so without
// this step dist/modules/*/schema.sql never exists in a production build
// and every module's migration silently skips.
import { cpSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

const modulesDir = path.resolve(import.meta.dirname, '../src/modules');
const distModulesDir = path.resolve(import.meta.dirname, '../dist/modules');

for (const moduleName of readdirSync(modulesDir)) {
  const schemaPath = path.join(modulesDir, moduleName, 'schema.sql');
  if (!existsSync(schemaPath)) continue;
  cpSync(schemaPath, path.join(distModulesDir, moduleName, 'schema.sql'));
  console.log(`Copied ${moduleName}/schema.sql to dist`);
}
