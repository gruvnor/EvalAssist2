import { mkdir, copyFile, readFile } from 'node:fs/promises';

await mkdir('release', { recursive: true });
await copyFile('dist/index.html', 'release/opb.html');

const html = await readFile('release/opb.html', 'utf8');
const forbiddenRefs = [
  /<script[^>]+src=/i,
  /<link[^>]+rel=["']?stylesheet/i,
  /<link[^>]+href=["']?https?:/i,
  /@import\s+url\(/i,
  /url\(\s*["']?https?:/i
];

for (const pattern of forbiddenRefs) {
  if (pattern.test(html)) {
    throw new Error(`Standalone release check failed: matched external runtime reference ${pattern}`);
  }
}

console.log(`Built self-contained release/opb.html (${Buffer.byteLength(html, 'utf8')} bytes).`);
