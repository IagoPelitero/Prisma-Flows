// Versão 1.6.0 no navegador: zerar atendimentos, altura das listas, rolagem que não volta ao topo, avatar,
// escala (Configurar mostra lista criada agora) e cartão sem carrossel novo
const { chromium } = require('playwright-core');
const fs = require('fs');
const BASE = 'http://localhost:' + process.env.PORT;
const SHOTS = __dirname + '/shots'; fs.mkdirSync(SHOTS, { recursive: true });
let falhas = 0; const erros = [];
function ok(c, m) { console.log(c ? 'OK  ' : 'FALHA', m); if (!c) falhas++; }
async function passo(nome, fn) { try { await fn(); } catch (e) { falhas++; console.log('FALHA', nome, '->', String(e.message).split('\n')[0]); } }
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 760 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(9000);
  page.on('pageerror', e => erros.push(e.message)); page.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
  const rpc = (fn, ...args) => page.evaluate(async ([fn, args]) => {
    const r = await (await fetch('/rpc', { method: 'POST', headers: { 'x-user': 'ana.souza@t.com' }, body: JSON.stringify({ fn, args }) })).json();
    if (r.erro) throw new Error(fn + ': ' + r.erro); return r.r;
  }, [fn, args]);
  const abrirQuadro = async () => { await page.goto(BASE + '/?u=ana.souza@t.com&quadro=QD-0001'); await page.waitForSelector('.lista'); };
  await abrirQuadro();

  // monta listas cheias pelo servidor
  const ids = await (async () => {
    const rot = (await rpc('criarLista', 'QD-0001', 'Rodízio cheio', 'Rotativa')).lista.id;
    for (let i = 1; i <= 18; i++) await rpc('salvarTarefaRotativa', rot, { tarefa: 'Tarefa ' + i, texto: 'Observação ' + i, pessoas: ['Ana Souza', 'Bruno Lima', 'Carla Mendes'], modo: 'Girar', inicio: 'Ana Souza' });
    const rec = (await rpc('criarLista', 'QD-0001', 'Fila de ligações', 'Recorrente')).lista.id;
    for (let i = 1; i <= 25; i++) await rpc('adicionarPessoaLista', rec, 'Pessoa ' + i, 'ramal ' + (2000 + i));
    return { rot, rec };
  })();
  await abrirQuadro();
  const rec = `.lista[data-id="${ids.rec}"]`, rot = `.lista[data-id="${ids.rot}"]`;
  await page.waitForSelector(rec + ' .car-item');

  // ---------- 1. Zerar atendimentos ----------
  await passo('zerar atendimentos', async () => {
    ok(await page.locator(rec + ' .rec-pe [data-acao="rec-zerar"]').isVisible() && await page.locator(rec + ' .rec-pe [data-acao="rec-zerar"]').isDisabled(), 'mesmo antes de alguém atender, o botão "Zerar atendimentos" já aparece (desabilitado)');
    for (let i = 0; i < 3; i++) {
      await page.click(rec + ' .car-item.na-vez input[type="checkbox"]');
      await page.waitForTimeout(700);
    }
    await page.waitForFunction(() => !document.querySelector('#avisos .aviso') || true);
    await page.waitForTimeout(1200);
    ok(await page.locator(rec + ' .rec-pe [data-acao="rec-zerar"]').isEnabled(), 'depois dos atendimentos o botão "Zerar atendimentos" fica habilitado');
    const comAtend = () => page.locator(rec + ' .car-item small:has-text("1 atendimento")').count();
    ok(await comAtend() === 3, '3 pessoas com 1 atendimento depois de marcar Atendi');
    ok(await page.locator(rec + ' [data-acao="rec-zerar"][data-id]').count() === 3, 'cada pessoa com atendimento ganha o link "zerar"');
    const ordemAntes = await page.locator(rec + ' .car-item .car-nome b').allTextContents();
    await page.locator(rec + ' [data-acao="rec-zerar"][data-id]').first().click();
    await page.waitForTimeout(1200);
    ok(await comAtend() === 2, 'zerar uma pessoa: só ela volta para "Ainda não atendeu"');
    ok((await page.locator(rec + ' .car-item .car-nome b').allTextContents()).join() === ordemAntes.join(), 'a ordem da fila não muda ao zerar');
    await page.click('#avisos .aviso:has-text("zerados") button:has-text("Desfazer")');
    await page.waitForFunction(s => document.querySelectorAll(s + ' [data-acao="rec-zerar"][data-id]').length === 3, rec, { timeout: 8000 });
    ok(true, 'Desfazer devolve o atendimento');
    await page.click(rec + ' .rec-pe [data-acao="rec-zerar"]');
    await page.waitForSelector('.modal button:has-text("Zerar")');
    ok((await page.locator('.modal').innerText()).includes('A ordem da fila continua a mesma'), 'zerar todos pede confirmação explicando que a ordem fica');
    await page.click('.modal button:has-text("Zerar")');
    await page.waitForFunction(s => document.querySelectorAll(s + ' [data-acao="rec-zerar"][data-id]').length === 0, rec, { timeout: 8000 });
    ok(await comAtend() === 0, 'zerar todos: ninguém com atendimento');
    ok(await page.locator(rec + ' .rec-pe [data-acao="rec-zerar"]').isDisabled(), 'o botão "Zerar atendimentos" continua à vista, só desabilitado');
    const conf = await rpc('obterQuadro', 'QD-0001');
    ok(conf.recorrentes[ids.rec].every(x => x.atendimentos === 0), 'gravado na planilha: todos com 0');
  });

  // ---------- 2. Rolagem não volta ao topo depois de gravar ----------
  await passo('rolagem mantida', async () => {
    const corpo = rot + ' .rot-corpo';
    await page.hover(corpo); await page.mouse.wheel(0, 900); await page.waitForTimeout(300);
    const antes = await page.$eval(corpo, el => el.scrollTop);
    ok(antes > 300, 'rolou a lista de rotatividade (' + antes + 'px)');
    // troca o responsável de uma tarefa visível no meio da lista (grava na planilha)
    const sel = await page.evaluateHandle(c => { const el = document.querySelector(c); const r = el.getBoundingClientRect(); return [...el.querySelectorAll('.rot-select')].find(s => { const b = s.getBoundingClientRect(); return b.top > r.top && b.bottom < r.bottom; }); }, corpo);
    const idSel = await sel.evaluate(s => s.id);
    await page.selectOption('#' + idSel, 'Carla Mendes');
    await page.waitForTimeout(2500);
    const depois = await page.$eval(corpo, el => el.scrollTop);
    ok(Math.abs(depois - antes) < 5, 'depois de gravar a troca, a lista continua no mesmo lugar (' + antes + ' → ' + depois + ')');
    ok(await page.$eval('#' + idSel, s => s.value) === 'Carla Mendes', 'a troca aparece no seletor');
    const corpoRec = rec + ' .rec-corpo';
    await page.hover(corpoRec); await page.mouse.wheel(0, 600); await page.waitForTimeout(300);
    const a2 = await page.$eval(corpoRec, el => el.scrollTop);
    const visivel = await page.evaluateHandle(c => { const el = document.querySelector(c); const r = el.getBoundingClientRect(); return [...el.querySelectorAll('.car-item input[type="checkbox"]')].find(s => { const b = s.getBoundingClientRect(); return b.top > r.top + 10 && b.bottom < r.bottom - 10; }); }, corpoRec);
    await visivel.click();
    await page.waitForTimeout(2500);
    const d2 = await page.$eval(corpoRec, el => el.scrollTop);
    ok(a2 > 100 && Math.abs(d2 - a2) < 5, 'lista recorrente: marcar Atendi no meio da lista não volta ao topo (' + a2 + ' → ' + d2 + ')');
  });

  // ---------- 3. Altura da lista ----------
  await passo('altura da lista', async () => {
    const alca = rec + ' .lista-alca';
    const h0 = (await page.locator(rec).boundingBox()).height;
    const b = await page.locator(alca).boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++) await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2 + i * 40);
    await page.mouse.up();
    await page.waitForTimeout(300);
    const h1 = (await page.locator(rec).boundingBox()).height;
    const cont = await page.$eval('#listas', el => ({ sh: el.scrollHeight, ch: el.clientHeight }));
    ok(h1 > h0 + 150 && h1 > cont.ch, 'arrastar a alça deixa a lista maior que a tela (' + Math.round(h0) + ' → ' + Math.round(h1) + 'px)');
    ok(cont.sh > cont.ch, 'o quadro ganha rolagem vertical para a lista descer');
    const m = await page.$eval(rec + ' .rec-corpo', el => ({ sh: el.scrollHeight, ch: el.clientHeight, oy: getComputedStyle(el).overflowY }));
    ok(m.oy === 'auto' && m.sh > m.ch, 'a lista continua rolando por dentro (' + m.sh + ' dentro de ' + m.ch + ')');
    const pag = await page.evaluate(() => ({ sh: document.documentElement.scrollHeight, ch: document.documentElement.clientHeight }));
    ok(pag.sh <= pag.ch + 2, 'a página em si não estoura (a rolagem é do quadro)');
    await page.$eval('#listas', el => { el.scrollTop = el.scrollHeight; });
    await page.waitForTimeout(200);
    const pe = await page.locator(rec + ' .rec-pe').boundingBox();
    ok(pe && pe.y + pe.height <= 760, 'rolando o quadro, o rodapé da lista (adicionar) aparece');
    await page.screenshot({ path: SHOTS + '/21-lista-alta.png' });
    await abrirQuadro();
    const h2 = (await page.locator(rec).boundingBox()).height;
    ok(Math.abs(h2 - h1) < 3, 'a altura fica guardada depois de recarregar (' + Math.round(h2) + 'px)');
    await page.locator(alca).focus();
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(150);
    ok(Math.round((await page.locator(rec).boundingBox()).height) === Math.round(h2) + 40, 'seta para baixo aumenta 40px pelo teclado');
    await page.locator(alca).dblclick();
    await page.waitForTimeout(300);
    const h3 = (await page.locator(rec).boundingBox()).height;
    ok(h3 < h1 - 100 && await page.$eval('#listas', el => el.scrollHeight <= el.clientHeight + 2), 'duplo clique volta a lista ao tamanho da tela');
  });

  // ---------- 4. Avatar ----------
  await passo('avatar', async () => {
    await page.click('button.eu');
    await page.waitForSelector('#av-icones');
    await page.click('[data-av-icone="👒"]');
    await page.click('[data-av-cor="#B04E16"]');
    ok((await page.locator('#av-previa .avatar').textContent()) === '👒', 'a prévia mostra o ícone escolhido');
    await page.screenshot({ path: SHOTS + '/22-avatar.png' });
    await page.click('.modal button[type="submit"]');
    await page.waitForSelector('button.eu .avatar.com-icone');
    ok((await page.locator('button.eu .avatar').textContent()) === '👒', 'o topo mostra o novo avatar');
    const estilo = await page.$eval('button.eu .avatar', el => el.getAttribute('style'));
    ok(estilo.includes('#B04E16'), 'com a cor escolhida');
    const u = (await rpc('iniciar')).usuarios.find(x => x.nome === 'Ana Souza');
    ok(u.icone === '👒' && u.cor === '#B04E16', 'gravado na aba Usuarios');
    await abrirQuadro();
    ok(await page.locator('.avatar.com-icone[title="Ana Souza"]').count() > 0, 'o avatar aparece também no quadro (cartões e listas)');
    // Divertidamente: escolher a emoção aplica o emoji e a cor dela
    await page.click('button.eu'); await page.waitForSelector('#av-emocoes');
    ok(await page.locator('.av-emocao').count() === 10, 'as 10 emoções do Divertidamente aparecem');
    ok(await page.locator('.av-grupo').count() >= 4 && await page.locator('[data-av-icone="😂"]').count() === 1, 'grupos de emojis (One Piece, Carinhas, Bichos, Coisas)');
    await page.click('.av-emocao[aria-label="Raiva"]');
    ok((await page.locator('#av-previa .avatar').textContent()) === '😡' && (await page.$eval('#av-previa .avatar', el => el.getAttribute('style'))).includes('#C53030'), 'Raiva: 😡 em vermelho na prévia');
    await page.click('.modal button[type="submit"]');
    await page.waitForFunction(() => document.querySelector('button.eu .avatar').textContent === '😡');
    ok((await rpc('iniciar')).usuarios.find(x => x.nome === 'Ana Souza').cor === '#C53030', 'emoção gravada (ícone e cor)');
    await page.click('button.eu'); await page.waitForSelector('#av-icones');
    await page.click('[data-av-icone=""]'); await page.click('[data-av-cor=""]');
    await page.click('.modal button[type="submit"]');
    await page.waitForFunction(() => document.querySelector('button.eu .avatar').textContent === 'AS');
    ok(true, 'dá para voltar às iniciais e à cor automática');
  });

  // ---------- 5. Escala: Configurar mostra a lista criada agora ----------
  await passo('escala configurar', async () => {
    const q = (await rpc('criarQuadro', { nome: 'Quadro sem escala' })).quadro;
    await page.goto(BASE + '/?u=ana.souza@t.com&quadro=' + q.id); await page.waitForSelector('.lista');
    await page.click('[data-acao="nova-lista"]'); await page.fill('#nova-lista-nome', 'Plantão'); await page.click('form[data-form="nova-lista"] button[type="submit"]');
    await page.waitForSelector('.lista h2:text("Plantão")');
    await page.click('[data-acao="escala"]'); await page.waitForSelector('#escala-abas');
    await page.click('[data-esc="aba"][data-valor="config"]');
    await page.waitForSelector('.cfg-frente');
    const nomes = await page.$$eval('.cfg-frente label.alternar', els => els.map(e => e.textContent.trim()));
    ok(nomes.includes('Plantão'), 'a lista criada depois de abrir o quadro aparece como frente: ' + nomes.join(', '));
    ok(!(await page.isChecked('#cfg-esc-ativa')), 'quadro sem escala: "Usar a escala" começa desmarcado');
    await page.check('#cfg-esc-ativa');
    await page.click('form[data-esc-form="config"] button[type="submit"]');
    ok(/Marque pelo menos uma lista como frente/.test((await page.locator('#avisos .aviso.erro').allTextContents()).join()), 'sem frente marcada, a mensagem diz exatamente o que falta');
    await page.uncheck('#cfg-esc-ativa');
    await page.check('[data-cfg-frente] >> nth=-1');
    ok(await page.isChecked('#cfg-esc-ativa'), 'marcar uma frente liga "Usar a escala" sozinho (antes salvava desligada sem avisar)');
    await page.check('[data-cfg-pessoa="Ana Souza"]'); await page.check('[data-cfg-pessoa="Bruno Lima"]');
    await page.click('form[data-esc-form="config"] button[type="submit"]');
    await page.waitForSelector('.escala-frente h3:text("Plantão")', { timeout: 9000 });
    ok(true, 'salvar monta a escala com a frente Plantão');
    // arquiva a frente: o pop-up explica o que falta e leva para Configurar
    await page.click('[data-acao="fechar-modal"]');
    const pl = (await rpc('obterQuadro', q.id)).listas.find(l => l.nome === 'Plantão');
    await rpc('arquivarLista', pl.id, true);
    await page.reload(); await page.waitForSelector('.lista');
    await page.click('[data-acao="escala"]');
    await page.waitForSelector('#escala-corpo .vazio h2');
    const txt = await page.locator('#escala-corpo').innerText();
    ok(/Nenhuma lista está marcada como frente/.test(txt), 'frente arquivada: o pop-up explica o que falta');
    await page.click('#escala-corpo [data-esc="aba"][data-valor="config"]');
    await page.waitForSelector('.cfg-frente');
    ok(true, 'o botão "Ir para Configurar" abre a aba certa');
    await page.click('[data-acao="fechar-modal"]');
  });

  // ---------- 6. Cartão novo sem carrossel; cópia sem selo ----------
  await passo('sem carrossel novo', async () => {
    await abrirQuadro();
    const orig = page.locator('.cartao:has-text("Cartão que já existia")').first();
    await orig.hover(); await orig.locator('.cartao-dup').click();
    await page.waitForSelector('.cartao:has-text("(cópia)")');
    ok(await page.locator('.cartao:has-text("Cartão que já existia (cópia)") .sinal.carrossel').count() === 0, 'a cópia de um cartão com carrossel não mostra o selo "Vez" por fora');
    await page.click('.cartao:has-text("(cópia)") .cartao-titulo');
    await page.waitForSelector('.gaveta');
    await page.waitForTimeout(1200);
    ok((await page.locator('#g-carrossel').innerHTML()) === '' && await page.locator('[data-acao="carrossel-iniciar"]').count() === 0, 'dentro da cópia não há carrossel nem botão para criar um');
  });

  ok(erros.length === 0, 'sem erros de JavaScript' + (erros.length ? ': ' + erros[0] : ''));
  await browser.close();
  console.log(falhas ? falhas + ' FALHA(S)' : 'TUDO OK');
  process.exit(falhas ? 1 : 0);
})();
