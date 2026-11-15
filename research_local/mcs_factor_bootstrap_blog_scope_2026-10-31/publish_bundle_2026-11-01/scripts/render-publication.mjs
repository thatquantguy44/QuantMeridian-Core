import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import katex from 'katex';

const require = createRequire(import.meta.url);
const bundle = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const escape = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const equations = [];
const inline = text => {
  const math = [];
  text = text.replace(/\$([^$\n]+)\$/g, (_, tex) => {
    math.push(katex.renderToString(tex, { throwOnError: true, strict: 'error', output: 'htmlAndMathml' }));
    return `MATHINLINE${math.length - 1}TOKEN`;
  });
  let html = escape(text)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
  math.forEach((value, i) => { html = html.replace(`MATHINLINE${i}TOKEN`, value); });
  return html;
};
let markdown = fs.readFileSync(path.join(bundle, 'article.md'), 'utf8');
markdown = markdown.replace(/\$\$([\s\S]*?)\$\$/g, (_, tex) => {
  equations.push(tex.trim());
  return `\n\nDISPLAYMATH${equations.length - 1}TOKEN\n\n`;
});
const body = markdown.split(/\n\s*\n/).map(block => {
  block = block.trim();
  if (!block) return '';
  const eq = block.match(/^DISPLAYMATH(\d+)TOKEN$/);
  if (eq) return '<div class="math-block">' + katex.renderToString(equations[Number(eq[1])], { displayMode: true, throwOnError: true, strict: 'error', output: 'htmlAndMathml' }) + '</div>';
  const image = block.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
  if (image) return `<figure><a href="${escape(image[2])}"><img src="${escape(image[2])}" alt="${escape(image[1])}" loading="eager"></a></figure>`;
  if (block === '---') return '<hr>';
  const heading = block.match(/^(#{1,3}) (.+)$/);
  if (heading) return `<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`;
  if (block.startsWith('> ')) return `<blockquote><p>${inline(block.replace(/^> /gm, ''))}</p></blockquote>`;
  if (/^\d+\. /.test(block)) return '<ol>' + block.split('\n').map(line => `<li>${inline(line.replace(/^\d+\. /, ''))}</li>`).join('') + '</ol>';
  return '<p>' + inline(block.replaceAll('\n', ' ')) + '</p>';
}).join('\n');
const katexDir = path.dirname(require.resolve('katex/dist/katex.min.css'));
let mathCss = fs.readFileSync(path.join(katexDir, 'katex.min.css'), 'utf8');
mathCss = mathCss.replace(/url\(fonts\/([^)]*)\)/g, (_, name) => {
  const ext = path.extname(name).slice(1);
  return `url(data:font/${ext};base64,${fs.readFileSync(path.join(katexDir, 'fonts', name)).toString('base64')})`;
});
const css = `body{margin:0;background:#f6f3ec;color:#18212b;font:19px/1.65 Georgia,serif}main{max-width:1000px;margin:45px auto;padding:32px 44px;background:white}h1{font:700 45px/1.12 system-ui,sans-serif;letter-spacing:-1.5px;margin:0 0 18px}h2{font:700 26px/1.3 system-ui,sans-serif;margin-top:38px}p{max-width:790px}a{color:#075d94}figure{margin:32px 0 10px}img{width:100%;height:auto;display:block}blockquote{margin:30px 0;border-left:4px solid #d99b34;padding:5px 24px;font-size:23px}hr{border:0;border-top:1px solid #ddd;margin:35px 0}li{margin:12px 0;max-width:780px}.math-block{overflow-x:auto;padding:10px 0;font-size:16px}@media(max-width:700px){main{margin:0;padding:24px 18px}h1{font-size:35px}body{font-size:18px}}@media print{body{background:white}main{margin:0;padding:0;max-width:none}img{break-inside:avoid}a{color:inherit}}`;
fs.writeFileSync(path.join(bundle, 'article.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>10,000 Scenarios. Same Old History.</title><style>${mathCss}\n${css}</style></head><body><main>${body}</main></body></html>`);
const sidebar = fs.readFileSync(path.join(bundle, 'latex_sidebar.md'), 'utf8');
const tex = [...sidebar.matchAll(/\$\$([\s\S]*?)\$\$/g)].map((m, i) => `% Equation ${i + 1}\n\\[\n${m[1].trim()}\n\\]`).join('\n\n');
fs.writeFileSync(path.join(bundle, 'sidebar.tex'), '% LaTeX equation snippet. Requires amsmath; use definitions from latex_sidebar.md.\n' + tex + '\n');
fs.writeFileSync(path.join(bundle, 'evidence/latex-render-check.json'), JSON.stringify({ renderer: 'KaTeX', version: katex.version, displayEquations: equations.length, strict: 'error', throwOnError: true, result: 'all display and inline math rendered successfully', preview: 'article.html', equations: 'sidebar.tex' }, null, 2) + '\n');
console.log(`Rendered article.html; ${equations.length} display equations; exported sidebar.tex.`);
