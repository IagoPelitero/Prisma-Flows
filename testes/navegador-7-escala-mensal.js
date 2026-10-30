const { chromium } = require('playwright-core');
const fs = require('fs');
const BASE = 'http://localhost:' + process.env.PORT;
const SHOTS = __dirname + '/shots'; fs.mkdirSync(SHOTS, { recursive: true });
let falhas = 0; const erros = [];
function ok(c, m) { console.log(c ? 'OK  ' : 'FALHA', m); if (!c) falhas++; }
var PG = null;
async function passo(nome, fn) { try { await fn(); } catch (e) { falhas++; console.log('FALHA', nome, '->', String(e.message).split('\n')[0]); try { await PG.screenshot({ path: SHOTS + '/falha-' + nome.replace(/[^a-z]/gi, '_') + '.png' }); } catch (x) {} } }
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  page.setDefaultTimeout(8000); PG = page;
  page.on('pageerror', e => erros.push(e.message)); page.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
  const esp = ms => page.waitForTimeout(ms);
  const abrirQuadro = async (u) => { await page.goto(BASE + '/?u=' + u + '&quadro=QD-0001'); await page.waitForSelector('.lista'); };
  const linha = (nome) => page.locator('.grade-mensal tbody tr:has-text("' + nome + '")');

  await passo('quadro', async () => {
    await abrirQuadro('ana.souza@t.com');
    await page.click('[data-acao="dia-almoco"]'); await page.waitForSelector('.sel-almoco');
    await page.click('[data-dia="aba"][data-valor="mensal"]'); await page.waitForSelector('.grade-mensal tbody tr');
    ok(await page.locator('.grade-mensal tbody tr').count() === 4, 'abrir em Almoço e clicar em Mensal carrega a grade');
    await page.keyboard.press('Escape');
    await page.click('[data-acao="dia-mensal"]'); await page.waitForSelector('.grade-mensal');
    ok((await page.locator('.abas-modal [aria-selected="true"]').textContent()) === 'Mensal', 'o botão Mensal abre o pop-up já na aba Mensal');
    ok(await page.locator('.grade-mensal tbody tr').count() === 4 && await page.locator('.grade-mensal thead th.dia').count() >= 20, 'grade com 4 pessoas e os dias úteis do mês');
    ok(await page.locator('.grade-mensal thead th:has-text("sáb"), .grade-mensal thead th:has-text("dom")').count() === 0, 'sem sábado nem domingo');
    await linha('Ana Souza').locator('select').first().selectOption('1º horário'); await esp(700);
    await linha('Bruno Lima').locator('select').first().selectOption('2º horário'); await esp(700);
    await linha('Carla Mendes').locator('select').first().selectOption('Férias'); await esp(1500);
    const cab = await page.locator('.grade-mensal thead th.dia').first().innerText();
    ok(/1º: 1 · 2º: 1/.test(cab) && /Férias: 1/.test(cab), 'cabeçalho do dia conta 1º: 1 · 2º: 1 · Férias: 1');
    ok((await linha('Ana Souza').locator('select').first().inputValue()) === '1º horário', 'a escolha ficou depois da resposta do servidor');
    await page.screenshot({ path: SHOTS + '/30-mensal-quadro.png' });
    // meses
    const mesAtual = await page.locator('.mes-nome').textContent();
    ok(/^[A-ZÇ][a-zç]+ de \d{4}$/.test(mesAtual), 'nome do mês bem escrito: ' + mesAtual);
    await page.click('[data-dia="mes"][data-valor="prox"]'); await page.waitForFunction(m => document.querySelector('.mes-nome').textContent !== m, mesAtual);
    ok((await page.locator('.grade-mensal select').evaluateAll(l => l.filter(s => s.value).length)) === 0, 'o mês seguinte começa vazio');
    await page.click('[data-dia="mes"][data-valor="hoje"]'); await page.waitForFunction(m => document.querySelector('.mes-nome').textContent === m, mesAtual);
    ok((await linha('Bruno Lima').locator('select').first().inputValue()) === '2º horário', 'voltar para "Este mês" mostra o que foi marcado');
    await page.keyboard.press('Escape');
    // persistência
    await abrirQuadro('ana.souza@t.com'); await page.click('[data-acao="dia-mensal"]'); await page.waitForSelector('.grade-mensal');
    ok((await linha('Carla Mendes').locator('select').first().inputValue()) === 'Férias', 'depois de recarregar a página, continua marcado');
    // as abas Almoço e Home continuam funcionando no mesmo pop-up
    // abrir o pop-up numa aba e CLICAR em Mensal depois também carrega a grade
    await page.click('[data-dia="aba"][data-valor="home"]'); await page.waitForSelector('button.cel[data-dia="home"]');
    await page.click('[data-dia="aba"][data-valor="mensal"]'); await page.waitForSelector('.grade-mensal tbody tr');
    ok(await page.locator('.grade-mensal tbody tr').count() === 4, 'clicar na aba Mensal (vindo de outra aba) carrega a grade');
    await page.click('[data-dia="aba"][data-valor="almoco"]'); await page.waitForSelector('.sel-almoco');
    ok(true, 'as abas Almoço e Home seguem funcionando');
    await page.keyboard.press('Escape');
  });

  await passo('equipe', async () => {
    await page.goto(BASE + '/?u=ana.souza@t.com'); await page.waitForSelector('.tile');
    await page.click('[data-acao="ir-equipe"]'); await page.waitForSelector('#eq-abas');
    await page.click('[data-acao="eq-aba"][data-valor="mensal"]'); await page.waitForSelector('.grade-mensal');
    ok(await page.locator('.grade-mensal tbody tr').count() === 4, 'aba Mensal da Equipe lista as pessoas');
    ok((await linha('Ana Souza').locator('select').first().inputValue()) === '1º horário', 'a Equipe mostra o que foi marcado no quadro (dado da pessoa)');
    await linha('Diego Alves').locator('select').first().selectOption('2º horário'); await esp(1500);
    await page.screenshot({ path: SHOTS + '/31-mensal-equipe.png' });
    await abrirQuadro('ana.souza@t.com'); await page.click('[data-acao="dia-mensal"]'); await page.waitForSelector('.grade-mensal');
    ok((await linha('Diego Alves').locator('select').first().inputValue()) === '2º horário', 'o que foi marcado na Equipe aparece no quadro');
    await page.keyboard.press('Escape');
  });

  await passo('permissões', async () => {
    await page.goto(BASE + '/?u=bruno.lima@t.com'); await page.waitForSelector('.tile');
    await page.click('[data-acao="ir-equipe"]'); await page.click('[data-acao="eq-aba"][data-valor="mensal"]'); await page.waitForSelector('.grade-mensal');
    ok(await page.locator('.grade-mensal select').count() === 0 && await page.locator('.grade-mensal .cel').count() > 0, 'Membro vê a Equipe só para leitura (só ADM edita ali)');
    await abrirQuadro('bruno.lima@t.com'); await page.click('[data-acao="dia-mensal"]'); await page.waitForSelector('.grade-mensal');
    ok(await page.locator('.grade-mensal select').count() > 0, 'Membro edita no quadro');
    await page.keyboard.press('Escape');
    await abrirQuadro('marina.reis@t.com'); await page.click('[data-acao="dia-mensal"]'); await page.waitForSelector('.grade-mensal');
    ok(await page.locator('.grade-mensal select').count() === 0, 'Leitor só visualiza');
  });

  ok(erros.length === 0, 'sem erros de JavaScript' + (erros.length ? ': ' + erros[0] : ''));
  await browser.close();
  console.log(falhas ? falhas + ' FALHA(S)' : 'TUDO OK');
  process.exit(falhas ? 1 : 0);
})();
