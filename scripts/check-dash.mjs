// Fallisce se nel repo compare il trattino lungo (U+2014).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const SKIP = new Set(['node_modules', '.git', 'package-lock.json']);
const EXT = new Set(['.html', '.css', '.js', '.mjs', '.gs', '.md', '.json', '.yml', '.txt', '']);
const DASH = String.fromCharCode(0x2014);
const errori = [];

function scan(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) scan(p);
    else if (EXT.has(extname(name))) {
      readFileSync(p, 'utf8')
        .split('\n')
        .forEach((riga, i) => {
          if (riga.includes(DASH)) errori.push(`${p}:${i + 1}`);
        });
    }
  }
}

scan('.');
if (errori.length) {
  console.error('Trattino lungo trovato (usa i due punti o il trattino normale):');
  errori.forEach((e) => console.error('  ' + e));
  process.exit(1);
}
console.log('Nessun trattino lungo. Boia dei matti, che pulizia!');
