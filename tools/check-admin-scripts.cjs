const fs = require('node:fs');
const { Script } = require('node:vm');
const parity = fs.readFileSync('src/components/admin/admin-parity.tsx', 'utf8');
const scripts = [...parity.matchAll(/await load\("\/([^"?]+\.js)/g)].map(match => match[1]);
if (!scripts.length) throw new Error('No admin scripts found');
for (const file of scripts) new Script(fs.readFileSync(`public/${file}`, 'utf8'), { filename: file });
console.log(`Syntax OK: ${scripts.length} admin scripts`);
