// Toda lista do quadro precisa rolar quando o conteúdo é maior que a tela (normal, rotatividade semanal e recorrente)
const { chromium } = require('playwright-core');
const fs = require('fs');
const BASE = 'http://localhost:' + process.env.PORT;
const SHOTS = __dirname + '/shots'; fs.mkdirSync(SHOTS, { recursive: true });
let falhas = 0; const erros = [];
function ok(c, m) { console.log(c ? 'OK  ' : 'FALHA', m); if (!c) falhas++; }
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const page = await (await browser.newContext({ viewport: { width: 1500, height: 720 } })).newPage();
  page.setDefaultTimeout(9000);
  page.on('pageerror', e => erros.push(e.message)); page.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
  await page.goto(BASE + '/?u=ana.souza@t.com&quadro=QD-0001'); await page.waitForSelector('.lista');
  // enche o quadro pelo servidor: 40 cartões, 25 tarefas rotativas, 45 pessoas na fila
  const ids = await page.evaluate(async () => {
    const rpc = async (fn, ...args) => { const r = await (await fetch('/rpc', { method: 'POST', headers: { 'x-user': 'ana.souza@t.com' }, body: JSON.stringify({ fn, args }) })).json(); if (r.erro) throw new Error(fn + ': ' + r.erro); return r.r; };
    const q = await rpc('obterQuadro', 'QD-0001');
    const normal = q.listas[1].id;
    for (let i = 1; i <= 40; i++) await rpc('criarCartao', normal, 'Cartão número ' + i + ' com um título um pouco comprido para ocupar espaço');
    const rot = (await rpc('criarLista', 'QD-0001', 'Rodízio cheio', 'Rotativa')).lista.id;
    for (let i = 1; i <= 25; i++) await rpc('salvarTarefaRotativa', rot, { tarefa: 'Tarefa ' + i, texto: 'Observação da tarefa ' + i, pessoas: ['Ana Souza', 'Bruno Lima', 'Carla Mendes'], modo: 'Girar', inicio: 'Ana Souza' });
    const rec = (await rpc('criarLista', 'QD-0001', 'Fila cheia', 'Recorrente')).lista.id;
    for (let i = 1; i <= 45; i++) await rpc('adicionarPessoaLista', rec, 'Pessoa ' + i, 'ramal ' + (2000 + i));
    return { normal, rot, rec };
  });
  await page.goto(BASE + '/?u=ana.souza@t.com&quadro=QD-0001'); await page.waitForSelector('.lista-rotativa .rot-item'); await page.waitForSelector('.lista-recorrente .car-item');
  const alvos = [['lista normal', `.lista[data-id="${ids.normal}"] .lista-cartoes`, '.cartao', `.lista[data-id="${ids.normal}"] .lista-pe`],
                 ['rotatividade semanal', `.lista[data-id="${ids.rot}"] .rot-corpo`, '.rot-item', `.lista[data-id="${ids.rot}"] .lista-pe`],
                 ['recorrente', `.lista[data-id="${ids.rec}"] .rec-corpo`, '.car-item', `.lista[data-id="${ids.rec}"] .rec-pe`]];
  for (const [nome, corpo, item, pe] of alvos) {
    const m = await page.evaluate(([c]) => { const el = document.querySelector(c); const cs = getComputedStyle(el); return { sh: el.scrollHeight, ch: el.clientHeight, oy: cs.overflowY }; }, [corpo]);
    ok(m.oy === 'auto' && m.sh > m.ch + 50, nome + ': rola (conteúdo ' + m.sh + 'px dentro de ' + m.ch + 'px)');
    const lista = corpo.split(' ')[0];
    const cab = await page.locator(lista + ' .lista-cabeca').boundingBox();
    const pePos = await page.locator(pe).boundingBox();
    ok(!!cab && cab.y >= 0 && !!pePos && pePos.y + pePos.height <= 720 + 1, nome + ': título e rodapé (adicionar) continuam visíveis na tela');
    // rola até o fim com a roda do mouse e confere que o último item aparece
    await page.hover(corpo); await page.mouse.wheel(0, 100000); await page.waitForTimeout(250);
    const fim = await page.evaluate(([c, i]) => { const el = document.querySelector(c); const itens = el.querySelectorAll(i); const u = itens[itens.length - 1].getBoundingClientRect(); const r = el.getBoundingClientRect(); return { top: el.scrollTop, max: el.scrollHeight - el.clientHeight, visivel: u.bottom <= r.bottom + 2 && u.top >= r.top - 2 }; }, [corpo, item]);
    ok(fim.top >= fim.max - 2 && fim.visivel, nome + ': rolando até o fim o último item fica visível');
  }
  // a página em si não ganha barra de rolagem vertical por causa das listas
  const pag = await page.evaluate(() => ({ sh: document.documentElement.scrollHeight, ch: document.documentElement.clientHeight }));
  ok(pag.sh <= pag.ch + 2, 'a página não estoura a altura da tela (' + pag.sh + ' / ' + pag.ch + ')');
  await page.screenshot({ path: SHOTS + '/20-scroll-listas.png' });
  // pop-ups com muita gente também rolam
  await page.click('[data-acao="dia-almoco"]'); await page.waitForSelector('.grade-eq');
  const modal = await page.evaluate(() => { const m = document.querySelector('.modal-fundo') || document.querySelector('.modal'); const mm = document.querySelector('.modal'); const r = mm.getBoundingClientRect(); return { dentro: r.bottom <= window.innerHeight + 1, rolavel: getComputedStyle(mm).overflowY, fundo: m ? getComputedStyle(m).overflowY : '' }; });
  ok(modal.dentro || modal.rolavel === 'auto' || modal.fundo === 'auto', 'pop-up de almoço/home cabe na tela ou rola');
  ok(erros.length === 0, 'sem erros de JavaScript' + (erros.length ? ': ' + erros[0] : ''));
  await browser.close();
  console.log(falhas ? falhas + ' FALHA(S)' : 'TUDO OK');
  process.exit(falhas ? 1 : 0);
})();
