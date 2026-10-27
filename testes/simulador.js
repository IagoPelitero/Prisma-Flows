// Harness local: roda o Code.gs real com Planilhas/Apps Script simulados em memória.
const fs = require('fs'), vm = require('vm');
const path0 = require('path');
process.env.CFG = process.env.CFG || path0.join(__dirname, 'config.json');
const SRC = process.argv[2];            // caminho do Code.gs
const HEADERS = JSON.parse(fs.readFileSync(process.argv[3], 'utf8')); // {aba:[cabecalho]}
const TEST = process.argv[4];           // arquivo de teste (js) executado no contexto

const OPS = { leituraTabela:0, leituraPequena:0, escrita:0, append:0, props:0, lock:0, flush:0, formato:0, ultimaLinha:0 };
const CUSTO = { leituraTabela:180, leituraPequena:70, escrita:90, append:140, props:45, lock:60, flush:120, formato:70, ultimaLinha:40 };
function zerarOps(){ Object.keys(OPS).forEach(k=>OPS[k]=0); }
function custoOps(){ return Object.keys(OPS).reduce((t,k)=>t+OPS[k]*CUSTO[k],0); }
class Range {
  constructor(sh, r, c, nr, nc) { Object.assign(this, { sh, r, c, nr: nr || 1, nc: nc || 1 }); }
  getValues() { if (this.__tabela) OPS.leituraTabela++; else OPS.leituraPequena++; const o = []; for (let i = 0; i < this.nr; i++) { const row = []; for (let j = 0; j < this.nc; j++) { const v = (this.sh.d[this.r - 1 + i] || [])[this.c - 1 + j]; row.push(v === undefined ? '' : v); } o.push(row); } return o; }
  setValues(v) { OPS.escrita++; v.forEach((row, i) => row.forEach((x, j) => this.sh._set(this.r + i, this.c + j, x))); return this; }
  setValue(x) { OPS.escrita++; this.sh._set(this.r, this.c, x); return this; }
  setFontWeight() { return this; } setNumberFormat() { OPS.formato++; return this; } setBackground() { return this; } setFontColor() { return this; }
}
class Sheet {
  constructor(name, cab) { this.name = name; this.d = [cab.slice()]; this.frozen = 0; }
  _set(r, c, x) {
    if (typeof x === 'string' && r > 1) {
      const col = (this.d[0] || [])[c - 1] || ('col' + c);
      if (x.length > 50000) (global.__viol = global.__viol || []).push(this.name + '.' + col + ': texto de ' + x.length + ' caracteres (limite da célula: 50.000)');
      else if (x.charAt(0) !== "'" && /^[=+\-@]/.test(x)) (global.__viol = global.__viol || []).push(this.name + '.' + col + ': "' + x.slice(0, 30) + '" viraria fórmula');
      else if (x.charAt(0) !== "'" && /^[\d\s.,\/:%R$-]+$/.test(x) && col !== 'ID' ) (global.__viol = global.__viol || []).push(this.name + '.' + col + ': "' + x.slice(0, 30) + '" viraria número/data');
    }
    if (typeof x === 'string' && x.charAt(0) === "'") x = x.slice(1);  /* o Planilhas consome o apóstrofo de texto */ while (this.d.length < r) this.d.push([]); const row = this.d[r - 1]; while (row.length < c) row.push(''); row[c - 1] = x; }
  _ultima() { let n = 0; this.d.forEach((r, i) => { if (r.some(v => v !== '' && v != null)) n = i + 1; }); return n; }
  getLastRow() { OPS.ultimaLinha++; let n = 0; this.d.forEach((r, i) => { if (r.some(v => v !== '' && v != null)) n = i + 1; }); return n; }
  getLastColumn() { let n = 0; this.d.forEach(r => { r.forEach((v, j) => { if (v !== '' && v != null) n = Math.max(n, j + 1); }); }); return n; }
  getRange(r, c, nr, nc) { return new Range(this, r, c, nr, nc); }
  getDataRange() { const r = new Range(this, 1, 1, this.getLastRow(), this.getLastColumn()); r.__tabela = true; (global.__porAba = global.__porAba || {})[this.name] = ((global.__porAba||{})[this.name] || 0) + 1; return r; }
  appendRow(row) { OPS.append++; const r = this._ultima() + 1; row.forEach((x, j) => this._set(r, j + 1, x)); }
  getMaxRows() { return this.max || 2000; } insertRowsAfter(r, n) { this.max = (this.max || 2000) + n; } getFrozenRows() { return this.frozen; } setFrozenRows(n) { this.frozen = n; }
  setColumnWidth() {} hideColumns() {} protect() { return { setWarningOnly() {} }; }
}
const sheets = {};
Object.keys(HEADERS).forEach(n => sheets[n] = new Sheet(n, HEADERS[n]));
const props = {};
const ss = { getSheetByName: n => sheets[n] || null, insertSheet: n => (sheets[n] = new Sheet(n, [])), getSpreadsheetTimeZone: () => 'America/Sao_Paulo', getUrl: () => 'x' };
let EMAIL = 'iago@teste.com';
const SCRIPT = new vm.Script(fs.readFileSync(SRC, 'utf8'), { filename: 'Code.gs' });
function novoContexto() {
const ctx = {
  console, Date, Math, JSON, parseInt, parseFloat, String, Number, Array, Object, RegExp, Error, isNaN, Set, Map,
  SpreadsheetApp: { getActiveSpreadsheet: () => ss, getActive: () => ss, flush() { OPS.flush++; }, getUi: () => ({ createMenu: () => ({ addItem() { return this; }, addToUi() {} }), alert() {} }) },
  LockService: { getScriptLock: () => ({ tryLock: () => { OPS.lock++; return true; }, releaseLock() {} }) },
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => { OPS.props++; return k in props ? props[k] : null; }, setProperty: (k, v) => { OPS.props++; props[k] = String(v); }, getProperties: () => props, deleteProperty: k => { delete props[k]; } }) },
  Session: { getActiveUser: () => ({ getEmail: () => EMAIL }), getScriptTimeZone: () => 'America/Sao_Paulo' },
  Utilities: {
    formatDate: (d, tz, f) => { const p = n => String(n).padStart(2, '0'); return f.replace(/'([^']*)'/g, '\u0001$1\u0002').replace('yyyy', d.getFullYear()).replace('MM', p(d.getMonth() + 1)).replace('dd', p(d.getDate())).replace('HH', p(d.getHours())).replace('mm', p(d.getMinutes())).replace('ss', p(d.getSeconds())).replace(/\u0001|\u0002/g, ''); },
    parseDate: (s, tz, f) => { s = String(s); let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return new Date(+m[1], +m[2] - 1, +m[3]); m = s.match(/(\d+)\/(\d+)\/(\d+)/); if (!m) throw new Error('parse ' + s); return new Date(+m[3], +m[2] - 1, +m[1]); },
    getUuid: () => Math.random().toString(16).slice(2)
  },
  ScriptApp: { getProjectTriggers: () => [], deleteTrigger() {}, newTrigger: () => ({ timeBased: () => ({ everyDays: () => ({ atHour: () => ({ create() {} }) }) }) }), getService: () => ({ getUrl: () => 'u' }) },
  HtmlService: { XFrameOptionsMode: { ALLOWALL: 1 }, createTemplateFromFile() { throw new Error('Index ausente'); }, createHtmlOutputFromFile() { return { getContent: () => '' }; } },
  __porAba: () => { const r = global.__porAba || {}; global.__porAba = {}; return r; }, __novo: () => novoContexto(), __ilegais: () => { const v = global.__ilegais || []; global.__ilegais = []; return v; }, __violacoes: () => { const v = global.__viol || []; global.__viol = []; return v; }, __sheets: sheets, __ops: OPS, __zerar: zerarOps, __custo: custoOps, __fs: fs, __env: process.env, __setEmail: e => { EMAIL = e; }
};
vm.createContext(ctx);
SCRIPT.runInContext(ctx);
return ctx;
}
const ctxTeste = novoContexto();   // contexto onde roda o arquivo de teste (só usa api)
// Cada chamada da api simula uma NOVA execução do Apps Script: variáveis globais zeradas, planilha e propriedades mantidas.
function ilegal(x, caminho, vistos) {
  // O que google.script.run NÃO consegue devolver à tela: Date, funções, símbolos, NaN/Infinity viram problema silencioso.
  const t = Object.prototype.toString.call(x);
  if (t === '[object Date]') return caminho + ' é um Date';
  if (typeof x === 'function' || typeof x === 'symbol' || typeof x === 'bigint') return caminho + ' é ' + typeof x;
  if (typeof x === 'number' && !isFinite(x)) return caminho + ' é ' + x;
  if (x && typeof x === 'object') {
    if (vistos.has(x)) return caminho + ' tem referência circular';
    vistos.add(x);
    for (const k of Object.keys(x)) { const r = ilegal(x[k], caminho + '.' + k, vistos); if (r) return r; }
    vistos.delete(x);
  }
  return '';
}
global.__ilegais = [];
ctxTeste.api = new Proxy({}, { get: (_, k) => (...args) => {
  const c = novoContexto(); if (typeof c[k] !== 'function') throw new Error('função inexistente: ' + k);
  const r = c[k](...args);
  const problema = ilegal(r, k + '()', new Set());
  if (problema) global.__ilegais.push(problema);
  return r;
} });
const ctx = ctxTeste;
if (process.env.PORT) {
  // Modo servidor: serve a tela (Index+Estilos+Script) e atende as chamadas do google.script.run, para teste no navegador.
  const http = require('http'), path = require('path');
  const DIR = path.dirname(SRC);
  const LAT = parseFloat(process.env.LAT || '0');   // fração do custo estimado de cada chamada, para simular a lentidão do Apps Script
  const montarPagina = (quadro) => {
    const r = f => fs.readFileSync(path.join(DIR, f), 'utf8');
    const ponte = `<script>(function(){function c(ok,fail){return new Proxy({},{get:function(_,n){
      if(n==='withSuccessHandler')return function(f){return c(f,fail)};
      if(n==='withFailureHandler')return function(f){return c(ok,f)};
      return function(){var a=[].slice.call(arguments);
        fetch('/rpc',{method:'POST',headers:{'content-type':'application/json','x-user':window.__USUARIO__||''},body:JSON.stringify({fn:n,args:a})})
          .then(function(x){return x.json()}).then(function(j){ if(j.erro){ if(fail) fail(new Error(j.erro)); } else if(ok) ok(j.r); })
          .catch(function(e){ if(fail) fail(e); }); }}})}
      window.google={script:{run:c(null,null)}};})();</script>`;
    return fs.readFileSync(path.join(__dirname, 'Index.html'), 'utf8')
      .replace('<?= nomeSistema ?>', () => 'Prisma Flows').replace('<?!= incluir_(\'Estilos\') ?>', () => r('Estilos.html'))
      .replace('<?!= JSON.stringify(quadroInicial) ?>', () => JSON.stringify(quadro || ''))
      .replace('<?!= incluir_(\'Script\') ?>', () => ponte + r('Script.html'));
  };
  if (process.env.SEED) vm.runInContext(fs.readFileSync(process.env.SEED, 'utf8'), ctx);
  http.createServer((req, res) => {
    if (req.method === 'GET') {
      const u = new URL(req.url, 'http://x');
      const usuario = u.searchParams.get('u') || '';
      const html = montarPagina(u.searchParams.get('quadro')).replace('<div id="app">', () => '<script>window.__USUARIO__=' + JSON.stringify(usuario) + '</script><div id="app">');
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(html); return;
    }
    let corpo = ''; req.on('data', d => corpo += d); req.on('end', () => {
      const { fn, args } = JSON.parse(corpo || '{}');
      const usuario = req.headers['x-user'];
      if (usuario) ctxTeste.__setEmail(usuario);
      OPS && zerarOps();
      let saida;
      try { saida = { r: JSON.parse(JSON.stringify(ctxTeste.api[fn](...args)) || 'null') }; } catch (e) { saida = { erro: String(e && e.message || e) }; }
      const atraso = LAT * custoOps();
      (process.env.LOG ? console.log(fn, Math.round(custoOps()) + 'ms est.', saida.erro ? 'ERRO ' + saida.erro : '') : 0);
      setTimeout(() => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(saida)); }, atraso);
    });
  }).listen(parseInt(process.env.PORT, 10), () => console.log('pronto na porta ' + process.env.PORT));
} else vm.runInContext(fs.readFileSync(TEST, 'utf8'), ctx);
