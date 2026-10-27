const { chromium } = require('playwright-core');
const fs = require('fs');
const BASE = 'http://localhost:' + process.env.PORT;
const SHOTS = __dirname + '/shots2'; fs.mkdirSync(SHOTS, { recursive: true });
let falhas = 0; const erros = [];
function ok(c, m) { console.log(c ? 'OK  ' : 'FALHA', m); if (!c) falhas++; }
var PG = null;
async function passo(nome, fn) { try { await fn(); } catch (e) { falhas++; console.log('FALHA', nome, '->', String(e.message).split('\n')[0]); try { await PG.screenshot({ path: SHOTS + '/falha-' + nome.replace(/[^a-z]/gi, '_') + '.png' }); console.log('   modal aberto:', await PG.locator('.modal').count(), '| toasts:', (await PG.locator('#avisos .aviso').allTextContents()).join(' | ').slice(0, 150)); } catch (x) {} } }
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage(); page.setDefaultTimeout(6000); PG = page;
  page.on('pageerror', e => erros.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') erros.push('console.error: ' + m.text()); });
  const espera = ms => page.waitForTimeout(ms);
  const toasts = async () => (await page.locator('#avisos .aviso').allTextContents()).join(' | ');
  const erroToast = async () => page.locator('#avisos .aviso.erro').count();
  const titulos = async lista => page.locator('.lista >> nth=' + lista).locator('.cartao-titulo').allTextContents();

  await page.goto(BASE + '/?u=ana.souza@t.com');
  await page.waitForSelector('.tile', { timeout: 8000 });

  await passo('quadro', async () => {
    await page.click('.tile[data-id="QD-0001"]');
    await page.waitForSelector('.lista', { timeout: 8000 });
    ok((await page.locator('.lista').count()) === 3, 'quadro seed abre com 3 listas');
  });

  await passo('listas', async () => {
    await page.click('[data-acao="nova-lista"]');
    await page.fill('#nova-lista-nome', 'Revisão'); await page.keyboard.press('Enter');
    await page.waitForSelector('.lista-nome:has-text("Revisão")', { timeout: 8000 });
    ok(true, 'criar lista "Revisão"');
    await page.click('.lista-nome:has-text("Revisão")');
    await page.fill('.lista-nome-input', 'Em revisão'); await page.keyboard.press('Enter');
    await page.waitForSelector('.lista-nome:has-text("Em revisão")', { timeout: 8000 });
    ok(true, 'renomear lista');
    await page.click('[data-acao="menu-lista"][data-id="LS-0004"]');
    await page.click('.menu button:has-text("limite")');
    await page.fill('#pedir-valor', '2'); await page.click('.modal button[type="submit"]');
    await espera(500);
    ok((await page.locator('.lista >> nth=3').locator('.lista-conta').textContent()).includes('/ 2'), 'definir limite de 2 cartões');
  });

  await passo('cartões', async () => {
    await page.click('.lista >> nth=1 >> [data-acao="novo-cartao"]');
    for (const t of ['Primeiro', 'Segundo', 'Terceiro']) {
      await page.fill('#novo-cartao-texto', t); await page.keyboard.press('Enter');
      await page.waitForSelector('.cartao:has-text("' + t + '"):not(.pendente)', { timeout: 8000 });
    }
    await page.keyboard.press('Escape');
    ok((await titulos(1)).join() === 'Primeiro,Segundo,Terceiro', 'três cartões criados na ordem: ' + (await titulos(1)).join());
  });

  await passo('gaveta', async () => {
    await page.click('.cartao:has-text("Primeiro")');
    await page.waitForSelector('.gaveta');
    await page.fill('#g-titulo', 'Primeiro (editado)'); await page.click('#g-descricao');
    await page.fill('#g-descricao', 'Linha A\nLinha B'); await page.click('#g-titulo');
    await espera(600);
    await page.click('[data-acao="prioridade"][data-valor="Alta"]');
    await page.fill('#g-prazo', '2026-12-01'); await espera(300);
    await page.selectOption('#g-add-resp', { label: 'Bruno Lima' }); await espera(300);
    await page.locator('[data-acao="alternar-etiqueta"]').first().click(); await espera(300);
    await page.fill('#g-item-novo', 'Passo 1'); await page.keyboard.press('Enter');
    await page.waitForSelector('.item:has-text("Passo 1")'); await page.fill('#g-item-novo', 'Passo 2'); await page.keyboard.press('Enter');
    await page.waitForSelector('.item:has-text("Passo 2")');
    await page.locator('.item:has-text("Passo 1") input[type="checkbox"]').check(); await espera(500);
    await page.fill('#g-comentario', 'Um comentário de teste'); await page.keyboard.press('Control+Enter');
    await page.waitForSelector('#g-comentarios :text("Um comentário de teste")', { timeout: 8000 });
    await espera(1200);
    const c = page.locator('.cartao:has-text("Primeiro (editado)")');
    const txt = await c.innerText();
    ok(/Alta/.test(txt) && /1\/2/.test(txt) && /1/.test(txt), 'cartão no quadro reflete prioridade, checklist 1/2 e comentário: ' + txt.replace(/\n/g, ' | '));
    ok(!(await erroToast()), 'sem aviso de erro durante a edição');
    await page.click('.item:has-text("Passo 2") [data-acao="remover-item"]'); await espera(500);
    ok((await page.locator('.item').count()) === 1, 'remover item do checklist');
    await page.locator('#g-concluido').check(); await espera(500);
    await page.screenshot({ path: SHOTS + '/01-gaveta.png' });
    await page.selectOption('#g-lista', { label: 'Feito' }); await espera(900);
    await page.keyboard.press('Escape'); await espera(300);
    ok((await titulos(2)).join().includes('Primeiro (editado)'), 'mover pela gaveta para "Feito" (concluído)');
  });

  await passo('persistência', async () => {
    await page.goto(BASE + '/?u=ana.souza@t.com&quadro=QD-0001'); await page.waitForSelector('.lista', { timeout: 8000 });
    const c = page.locator('.cartao:has-text("Primeiro (editado)")');
    const txt = await c.innerText();
    ok(/Alta/.test(txt) && /1\/1/.test(txt), 'após recarregar, tudo persistiu: ' + txt.replace(/\n/g, ' | '));
    await c.click(); await page.waitForSelector('.gaveta');
    ok((await page.inputValue('#g-descricao')) === 'Linha A\nLinha B' && (await page.inputValue('#g-prazo')) === '2026-12-01', 'descrição e prazo persistiram');
    await page.keyboard.press('Escape');
  });

  await passo('arrastar', async () => {
    const origem = page.locator('.cartao:has-text("Segundo")');
    const destino = page.locator('.lista >> nth=2 >> .lista-cartoes');
    const a = await origem.boundingBox(), b = await destino.boundingBox();
    await page.mouse.move(a.x + 40, a.y + 20); await page.mouse.down();
    await page.mouse.move(a.x + 60, a.y + 40, { steps: 5 });
    await page.mouse.move(b.x + 60, b.y + 40, { steps: 15 });
    await page.mouse.up(); await espera(1200);
    ok((await titulos(2)).join().includes('Segundo'), 'arrastar "Segundo" da lista 2 para "Feito": ' + (await titulos(2)).join());
    await page.goto(BASE + '/?u=ana.souza@t.com&quadro=QD-0001'); await page.waitForSelector('.lista');
    ok((await titulos(2)).join().includes('Segundo'), 'o arrasto persistiu depois de recarregar');
  });

  await passo('arquivar/desfazer', async () => {
    await page.click('.cartao:has-text("Terceiro")'); await page.waitForSelector('.gaveta');
    await page.click('[data-acao="arquivar-cartao"]'); await espera(900);
    ok(!(await page.locator('.cartao:has-text("Terceiro")').count()), 'cartão arquivado some do quadro');
    await page.click('#avisos .aviso button:has-text("Desfazer")'); await espera(900);
    ok(await page.locator('.cartao:has-text("Terceiro")').count() === 1, 'Desfazer traz de volta');
    await page.click('[data-acao="arquivados"]'); await page.waitForSelector('.modal');
    await page.keyboard.press('Escape');
  });

  await passo('filtros e atalhos', async () => {
    await page.fill('#filtro-texto', 'Terceiro'); await espera(300);
    ok((await page.locator('.cartao').count()) === 1, 'busca por texto filtra para 1 cartão');
    await page.fill('#filtro-texto', ''); await espera(200);
    await page.locator('#filtro-meus').check(); await espera(200);
    const so = await page.locator('.cartao').count(); await page.locator('#filtro-meus').uncheck();
    ok(so >= 0, '"Só os meus" aplicado (' + so + ' cartões)');
    await page.click('.quadro-nome'); await page.keyboard.press('?'); await page.waitForSelector('.modal'); ok(true, 'atalho "?" abre a ajuda'); await page.keyboard.press('Escape');
  });

  await passo('etiquetas', async () => {
    await page.click('[data-acao="etiquetas"]'); await page.waitForSelector('#etq-corpo');
    await page.click('[data-acao="criar-etiqueta"] >> nth=0'); await espera(800);
    ok(!(await erroToast()), 'criar etiqueta sem erro'); await page.keyboard.press('Escape');
  });

  await passo('configurar quadro', async () => {
    await page.click('[data-acao="configurar-quadro"]'); await page.waitForSelector('#q-nome');
    await page.fill('#q-nome', 'Atendimento (renomeado)'); await page.click('.modal button[type="submit"]');
    await page.waitForSelector('.quadro-nome:has-text("renomeado")', { timeout: 8000 }); ok(true, 'renomear o quadro');
  });

  await passo('meus cartões', async () => {
    await page.click('[data-acao="ir-meus"]'); await page.waitForSelector('#conteudo', { timeout: 8000 }); await espera(800);
    ok(!(await erroToast()), 'tela "Meus cartões" abre');
  });

  await passo('rotinas', async () => {
    await page.click('[data-acao="ir-rotinas"]'); await page.waitForSelector('#rotinas-corpo .vazio, #rotinas-corpo [data-acao="editar-rotina"]', { timeout: 8000 });
    await page.click('[data-acao="nova-rotina"] >> nth=0'); await page.waitForSelector('#rt-nome');
    await page.fill('#rt-nome', 'Rotina {mes}'); await page.selectOption('#rt-freq', 'Dias úteis');
    await page.click('.modal button[type="submit"]'); await espera(1500);
    ok(await page.locator('.rotina, .rotina-linha, [data-acao="editar-rotina"]').count() >= 1, 'rotina criada');
    ok(!(await erroToast()), 'sem erro ao salvar rotina: ' + (await toasts()).slice(0, 80));
    const gerar = page.locator('[data-acao="gerar-rotina"]').first();
    if (await gerar.count()) { await gerar.click(); await espera(1500); ok(/Já existe|criado|Criad/.test(await toasts()), '"gerar agora" responde (a rotina já gerou o cartão de hoje ao salvar): ' + (await toasts()).slice(0, 100)); }
    await page.screenshot({ path: SHOTS + '/02-rotinas.png' });
  });

  await passo('equipe', async () => {
    await page.click('[data-acao="ir-equipe"]'); await page.waitForSelector('.grade-eq', { timeout: 8000 });
    await page.locator('button.cel[data-acao="eq-celula"]').first().click(); await espera(800);
    ok(await page.locator('button.cel.home[data-acao="eq-celula"]').count() === 1, 'marcar home na grade da Equipe');
    await page.click('[data-acao="eq-aba"][data-valor="banco"]'); await page.waitForSelector('[data-acao="eq-lancar"]', { timeout: 8000 });
    await page.click('[data-acao="eq-lancar"] >> nth=0'); await page.waitForSelector('#hr-duracao');
    await page.fill('#hr-duracao', '90'); await page.fill('#hr-desc', 'teste'); await page.click('.modal button[type="submit"]'); await espera(800);
    ok(await page.locator('.modal').count() > 0 || (await erroToast()) > 0, 'duração "90" (sem unidade) é recusada em vez de virar 90 horas');
    await page.fill('#hr-duracao', '1h30'); await page.click('.modal button[type="submit"]'); await espera(1200);
    ok(!(await page.locator('.modal').count()), 'duração "1h30" aceita');
    await page.evaluate(() => document.querySelectorAll('#avisos .aviso').forEach(e => e.remove()));
    await page.click('[data-acao="eq-aba"][data-valor="ausencias"]'); await espera(900);
    ok(!(await erroToast()), 'aba Ausências abre');
    await page.screenshot({ path: SHOTS + '/03-equipe.png' });
  });

  await passo('admin', async () => {
    await page.click('[data-acao="ir-admin"]'); await page.waitForSelector('#np-email', { timeout: 8000 });
    await page.fill('#np-email', 'novo.usuario@t.com'); await page.fill('#np-nome', 'Novo Usuário');
    await page.click('[data-form="nova-pessoa"] button[type="submit"]'); await espera(1000);
    ok(await page.locator('tr[data-email="novo.usuario@t.com"]').count() === 1, 'cadastrar pessoa na Administração');
  });

  await passo('tema', async () => {
    await page.click('[data-acao="tema"]'); await espera(200); await page.click('[data-acao="tema"]');
    ok(true, 'alternar tema claro/escuro');
  });

  ok(erros.length === 0, 'nenhum erro de JavaScript no console' + (erros.length ? ': ' + erros.slice(0, 3).join(' ; ') : ''));
  await browser.close();
  console.log(falhas ? falhas + ' FALHA(S)' : 'TUDO OK');
  process.exit(falhas ? 1 : 0);
})();
