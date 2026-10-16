// Kopiuje worker pdf.js (wersja "legacy" – działa też na starszym Safari/iOS) do public/,
// żeby import PDF nie zależał od zewnętrznego CDN. Uruchamiane automatycznie przed dev i build.
import fs from 'fs';
import path from 'path';

const zrodlo = path.join('node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.worker.min.mjs');
const cel = path.join('public', 'pdf.worker.min.mjs');
fs.copyFileSync(zrodlo, cel);
console.log(`pdf.js worker → ${cel}`);
