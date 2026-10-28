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
  const page = await (await browser.newContext({ viewport: { width: 1500, height: 900 } })).newPage();
  page.setDefaultTimeout(8000); PG = page;
  page.on('pageerror', e => erros.push(e.message)); page.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
  const esp = ms => page.waitForTimeout(ms);
  const abrir = async (u) => { await page.goto(BASE + '/?u=' + u + '&quadro=QD-0001'); await page.waitForSelector('.lista'); };
  await abrir('ana.souza@t.com');

  await passo('criar listas', async () => {
    await page.click('[data-acao="nova-lista"]');
    await page.fill('#nova-lista-nome', 'Rodízio semanal'); await page.selectOption('#nova-lista-tipo', 'Rotativa'); await page.keyboard.press('Enter');
    await page.waitForSelector('.lista-rotativa');
    ok(await page.locator('.lista-rotativa [data-acao="novo-cartao"]').count() === 0 && /Rotatividade semanal/.test(await page.locator('.lista-rotativa .lista-tipo').innerText()), 'lista de rotatividade criada, sem botão de cartão');
    await page.fill('#nova-lista-nome', 'Fila de ligações'); await page.selectOption('#nova-lista-tipo', 'Recorrente'); await page.keyboard.press('Enter');
    await page.waitForSelector('.lista-recorrente');
    ok(true, 'lista recorrente criada');
  });

  await passo('tarefa rotativa', async () => {
    await page.click('.lista-rotativa [data-acao="rot-nova"]'); await page.waitForSelector('#tr-nome');
    await page.fill('#tr-nome', 'Abrir fila às 8h');
    await page.selectOption('#tr-add', 'Ana Souza'); await page.click('[data-tr="add"]');
    await page.selectOption('#tr-add', 'Bruno Lima'); await page.click('[data-tr="add"]');
    await page.fill('#tr-livre', 'Visitante X'); await page.keyboard.press('Enter');
    ok((await page.locator('#tr-pessoas .car-corpo b').allTextContents()).join() === 'Ana Souza,Bruno Lima,Visitante X', 'pessoas escolhidas na ordem do rodízio');
    await page.click('[data-tr="subir"][data-i="2"]');   // Ana, Visitante, Bruno
    ok((await page.locator('#tr-pessoas .car-corpo b').allTextContents()).join() === 'Ana Souza,Visitante X,Bruno Lima', 'subir e descer reordenam');
    await page.selectOption('#tr-inicio', 'Visitante X');
    await page.click('.modal button[type="submit"]');
    await page.waitForSelector('.rot-item');
    ok((await page.locator('.rot-item .rot-select').inputValue()) === 'Visitante X', 'esta semana: Visitante X (quem foi escolhido para começar)');
    ok(/Próxima semana: Bruno Lima/.test(await page.locator('.rot-item .rot-meta').innerText()), 'mostra a próxima semana: Bruno Lima');
    await page.screenshot({ path: SHOTS + '/10-rotativa.png' });
    // trocar o nome
    await page.selectOption('.rot-select', 'Diego Alves'); await esp(1200);
    ok(/Trocado nesta semana/.test(await page.locator('.rot-meta').innerText()) && await page.locator('.rot-select.trocado').count() === 1, 'trocar o nome marca "Trocado nesta semana"');
    await page.click('[data-acao="rot-voltar"]'); await esp(1200);
    ok((await page.locator('.rot-select').inputValue()) === 'Visitante X' && await page.locator('.rot-select.trocado').count() === 0, '"Voltar ao rodízio" desfaz a troca');
    // próxima semana
    await page.click('[data-acao="rot-semana"][data-valor="proxima"]');
    ok((await page.locator('.rot-select').inputValue()) === 'Bruno Lima', 'aba Próxima mostra Bruno Lima');
    await page.selectOption('.rot-select', 'Carla Mendes'); await esp(1200);
    await page.click('[data-acao="rot-semana"][data-valor="atual"]');
    ok(/Próxima semana: Carla Mendes/.test(await page.locator('.rot-meta').innerText()), 'a troca da próxima semana aparece em "Próxima semana"');
    // persistência
    await abrir('ana.souza@t.com');
    ok((await page.locator('.rot-select').inputValue()) === 'Visitante X' && /Carla Mendes/.test(await page.locator('.rot-meta').innerText()), 'tudo persiste depois de recarregar');
    // modo fixo
    await page.click('[data-acao="rot-editar"]'); await page.waitForSelector('#tr-nome');
    await page.check('input[name="tr-modo"][value="Fixo"]'); await page.click('.modal button[type="submit"]'); await esp(1200);
    ok(/Nome fixo/.test(await page.locator('.rot-meta').innerText()), 'modo "Manter o mesmo nome" mostra "Nome fixo."');
  });

  await passo('lista recorrente', async () => {
    const nomes = () => page.locator('.lista-recorrente .car-item .car-nome b').allTextContents();
    for (const n of ['Ana Souza', 'Bruno Lima', 'Carla Mendes']) { await page.fill('.lista-recorrente [id^="rec-pessoa-"]', n); await page.keyboard.press('Enter'); }
    ok((await nomes()).join() === 'Ana Souza,Bruno Lima,Carla Mendes', 'rajada de nomes aparece na hora e na ordem');
    await page.waitForFunction(() => document.querySelectorAll('.lista-recorrente .car-item input:disabled').length === 0, null, { timeout: 15000 });
    await page.click('.lista-recorrente .car-item:has-text("Ana Souza") input[type="checkbox"]');
    await page.waitForFunction(() => document.querySelector('.lista-recorrente .car-nome b').textContent === 'Bruno Lima');
    ok((await nomes()).join() === 'Bruno Lima,Carla Mendes,Ana Souza' && await page.locator('.lista-recorrente input:checked').count() === 0, 'Atendi: Ana vai para o fim e a caixa volta desmarcada');
    await page.screenshot({ path: SHOTS + '/11-recorrente.png' });
    await esp(900);
    await page.click('#avisos .aviso button:has-text("Desfazer")');
    await page.waitForFunction(() => document.querySelector('.lista-recorrente .car-nome b').textContent === 'Ana Souza', null, { timeout: 9000 });
    ok((await nomes()).join() === 'Ana Souza,Bruno Lima,Carla Mendes', 'Desfazer devolve a ordem');
    await page.click('.lista-recorrente .car-item:has-text("Carla Mendes") [data-acao="rec-na-vez"]');
    await page.waitForFunction(() => document.querySelector('.lista-recorrente .car-nome b').textContent === 'Carla Mendes', null, { timeout: 9000 });
    ok(true, 'Colocar na vez');
    await page.click('.lista-recorrente [data-acao="rec-equipe"]'); await page.waitForSelector('.lista-recorrente .car-item:has-text("Diego Alves")');
    ok((await nomes()).length === 4, 'adicionar toda a equipe');
    await page.click('.lista-recorrente .car-item:has-text("Diego Alves") [data-acao="rec-editar"]'); await page.fill('#rp-texto', 'ramal 9999'); await page.click('.modal button[type="submit"]');
    await page.waitForSelector('.lista-recorrente .car-item:has-text("ramal 9999")'); ok(true, 'editar o texto');
    await page.click('.lista-recorrente .car-item:has-text("Diego Alves") [data-acao="rec-remover"]'); await page.click('.modal button:has-text("Tirar")');
    await page.waitForFunction(() => ![...document.querySelectorAll('.lista-recorrente .car-nome b')].some(b => b.textContent === 'Diego Alves'), null, { timeout: 9000 });
    ok(true, 'remover da lista');
    // digitar enquanto a resposta chega
    await page.fill('.lista-recorrente [id^="rec-pessoa-"]', 'Marina Reis'); await page.keyboard.press('Enter');
    await page.keyboard.type('Dieg', { delay: 70 }); await esp(2500);
    ok((await page.inputValue('.lista-recorrente [id^="rec-pessoa-"]')) === 'Dieg', 'o que se digita enquanto grava não se perde');
    await abrir('ana.souza@t.com');
    ok((await nomes()).includes('Marina Reis') && (await nomes())[0] === 'Carla Mendes', 'a fila persiste depois de recarregar');
  });

  await passo('regras', async () => {
    await page.click('.cartao >> nth=0'); await page.waitForSelector('.gaveta');
    const opcoes = await page.locator('#g-lista option').allTextContents();
    ok(!opcoes.includes('Rodízio semanal') && !opcoes.includes('Fila de ligações'), 'a lista de cartões da gaveta não oferece as listas de rodízio: ' + opcoes.join(', '));
    await page.keyboard.press('Escape');
  });

  await passo('leitor', async () => {
    await abrir('marina.reis@t.com');
    ok(await page.locator('[data-acao="rot-nova"], [data-acao="rec-equipe"], .rot-select, .lista-rodizio .form-carrossel').count() === 0 && await page.locator('.car-item input:disabled').count() > 0, 'Leitor vê as duas listas sem controles de edição');
    ok(await page.locator('.rot-item').count() === 1 && await page.locator('.lista-recorrente .car-item').count() >= 3, 'Leitor vê o conteúdo');
  });

  ok(erros.length === 0, 'sem erros de JavaScript' + (erros.length ? ': ' + erros[0] : ''));
  await browser.close();
  console.log(falhas ? falhas + ' FALHA(S)' : 'TUDO OK');
  process.exit(falhas ? 1 : 0);
})();
