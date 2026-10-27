const { chromium } = require('playwright-core');
const BASE = 'http://localhost:' + process.env.PORT;
let falhas = 0; const erros = [];
function ok(c, m) { console.log(c ? 'OK  ' : 'FALHA', m); if (!c) falhas++; }
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const mk = async (u) => { const p = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage(); p.setDefaultTimeout(9000); p.on('pageerror', e => erros.push(u + ': ' + e.message)); p.on('console', m => { if (m.type() === 'error') erros.push(u + ': ' + m.text()); }); await p.goto(BASE + '/?u=' + u + '&quadro=QD-0001'); await p.waitForSelector('.lista'); return p; };
  // intervalo de verificação curto (mínimo permitido: 10 s)
  const a = await mk('ana.souza@t.com');
  await a.evaluate(() => fetch('/rpc', { method: 'POST', headers: { 'x-user': 'ana.souza@t.com' }, body: JSON.stringify({ fn: 'salvarConfig', args: [{ ATUALIZAR_SEGUNDOS: '10' }] }) }));
  const A = await mk('ana.souza@t.com'), B = await mk('bruno.lima@t.com');
  const titulosB = () => B.locator('.cartao-titulo').allTextContents();
  // gravações ao mesmo tempo, em duas máquinas
  await Promise.all([
    (async () => { await A.click('.lista >> nth=1 >> [data-acao="novo-cartao"]'); await A.fill('#novo-cartao-texto', 'Da Ana'); await A.keyboard.press('Enter'); })(),
    (async () => { await B.click('.lista >> nth=1 >> [data-acao="novo-cartao"]'); await B.fill('#novo-cartao-texto', 'Do Bruno'); await B.keyboard.press('Enter'); })()
  ]);
  await A.waitForSelector('.cartao:has-text("Da Ana"):not(.pendente)'); await B.waitForSelector('.cartao:has-text("Do Bruno"):not(.pendente)');
  await A.keyboard.press('Escape'); await B.keyboard.press('Escape');
  // cada um ainda não viu o cartão do outro: o aviso aparece e "Atualizar" traz tudo
  await B.click('.quadro-nome'); 
  await B.waitForFunction(() => /Alguém mexeu|Atualizar/.test(document.body.innerText) || document.querySelectorAll('.cartao').length >= 3, null, { timeout: 25000 });
  const rec = await B.locator('[data-acao="atualizar"]').first();
  if (await B.locator('#novidades [data-acao="atualizar"]').count()) await B.click('#novidades [data-acao="atualizar"]');
  await B.waitForFunction(() => document.body.innerText.includes('Da Ana'), null, { timeout: 25000 });
  ok(true, 'o Bruno passou a ver o cartão da Ana (aviso/atualização automática)');
  // IDs sem repetição na planilha
  const ids = await A.evaluate(async () => { const r = await (await fetch('/rpc', { method: 'POST', headers: { 'x-user': 'ana.souza@t.com' }, body: JSON.stringify({ fn: 'obterQuadro', args: ['QD-0001'] }) })).json(); return r.r.cartoes.map(c => c.id); });
  ok(new Set(ids).size === ids.length && ids.length === 3, 'IDs únicos depois de duas gravações simultâneas: ' + ids.join(','));
  // A edita o título enquanto B edita outro cartão: nenhuma sobrescreve a outra
  await Promise.all([
    A.evaluate(() => fetch('/rpc', { method: 'POST', headers: { 'x-user': 'ana.souza@t.com' }, body: JSON.stringify({ fn: 'atualizarCartao', args: ['CT-0002', { prioridade: 'Alta' }] }) })),
    B.evaluate(() => fetch('/rpc', { method: 'POST', headers: { 'x-user': 'bruno.lima@t.com' }, body: JSON.stringify({ fn: 'atualizarCartao', args: ['CT-0003', { prioridade: 'Urgente' }] }) }))
  ]);
  const prio = await A.evaluate(async () => { const r = await (await fetch('/rpc', { method: 'POST', headers: { 'x-user': 'ana.souza@t.com' }, body: JSON.stringify({ fn: 'obterQuadro', args: ['QD-0001'] }) })).json(); const m = {}; r.r.cartoes.forEach(c => m[c.id] = c.prioridade); return m; });
  ok(prio['CT-0002'] === 'Alta' && prio['CT-0003'] === 'Urgente', 'edições simultâneas em cartões diferentes não se perdem: ' + JSON.stringify(prio));
  ok(erros.length === 0, 'sem erros de JavaScript' + (erros.length ? ': ' + erros[0] : ''));
  await browser.close();
  console.log(falhas ? falhas + ' FALHA(S)' : 'TUDO OK');
  process.exit(falhas ? 1 : 0);
})();
