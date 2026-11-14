// Build the single-file HTML: node build.js [extra output path...]
const fs = require('fs'), path = require('path');
const R = __dirname, src = p => fs.readFileSync(path.join(R, p), 'utf8');
const safe = s => s.replace(/<\/script/gi, '<\\/script');
const logo = 'data:image/png;base64,' + fs.readFileSync(path.join(R, 'src/logo.png')).toString('base64');
const app = ['core.js', 'sync.js', 'ui.js', 'views.js', 'io.js'].map(f => src('src/' + f)).join('\n').replace("'__LOGO_DATA_URL__'", JSON.stringify(logo));
let html = src('src/template.html');
html = html.replace('/*__CSS__*/', () => src('src/styles.css'))
  .replace('/*__XLSX__*/', () => safe(src('vendor/xlsx-js-style-1.2.0.bundle.js')))
  .replace('/*__APP__*/', () => safe('(function(){\n' + app + '\n})();'));
const name = 'Al Tasnim ODC Nimr - MTO - STO Status Tracker.html';
const outs = [path.join(R, 'dist', name), path.join(R, 'docs', 'index.html'), ...process.argv.slice(2).map(p => path.join(p, name))];
for (const o of outs) { fs.mkdirSync(path.dirname(o), { recursive: true }); fs.writeFileSync(o, html); console.log('wrote', o, (html.length / 1024).toFixed(0) + ' KB'); }
