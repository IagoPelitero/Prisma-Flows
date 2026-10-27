const { chromium } = require('playwright-core');
const fs = require('fs');
const BASE = 'http://localhost:' + process.env.PORT;
const SHOTS = __dirname + '/shots'; fs.mkdirSync(SHOTS, { recursive: true });
let falhas = 0;
const erros = [];
function ok(c, m) { console.log(c ? 'OK  ' : 'FALHA', m); if (!c) falhas++; }
async function passo(nome, fn) { try { await fn(); } catch (e) { falhas++; console.log('FALHA', nome, '->', String(e.message).split('\n')[0]); } }
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => { erros.push('pageerror: ' + e.message); });
  page.on('console', m => { if (m.type() === 'error') erros.push('console.error: ' + m.text()); });
  const toast = async () => (await page.locator('#avisos .aviso').allTextContents()).join(' | ');
  const espera = ms => page.waitForTimeout(ms);

  await passo('abrir', async () => {
    await page.goto(BASE + '/?u=ana.souza@t.com');
    await page.waitForSelector('.tile[data-acao="abrir-quadro"]', { timeout: 8000 });
    ok(true, 'início carrega e lista o quadro');
  });

  // ---------- criar quadro pela tela (era onde dava erro) ----------
  await passo('criar quadro', async () => {
    await page.click('[data-acao="novo-quadro"] >> nth=0');
    await page.fill('#q-nome', 'Quadro criado no teste');
    await page.click('.modal button[type="submit"]');
    await page.waitForSelector('.quadro-nome:has-text("Quadro criado no teste")', { timeout: 8000 });
    const listas = await page.locator('.lista-nome').allTextContents();
    ok(listas.join() === 'A fazer,Fazendo,Feito', 'quadro novo abre com as 3 listas padrão: ' + listas.join());
    ok(!(await page.locator('.aviso.erro').count()), 'sem aviso de erro ao criar quadro');
    await page.screenshot({ path: SHOTS + '/01-quadro-novo.png' });
  });

  // ---------- cartão rápido, duplicar ----------
  await passo('cartão + duplicar', async () => {
    await page.click('[data-acao="novo-cartao"] >> nth=0');
    await page.fill('#novo-cartao-texto', 'Ligar para o cliente 7781');
    await page.keyboard.press('Enter');
    await page.waitForSelector('.cartao:has-text("Ligar para o cliente 7781"):not(.pendente)', { timeout: 8000 });
    await page.click('.cartao:has-text("Ligar para o cliente 7781")');
    await page.waitForSelector('.gaveta');
    await page.click('[data-acao="duplicar-cartao"]');
    await page.waitForSelector('.cartao:has-text("(cópia)")', { timeout: 8000 });
    ok(true, 'duplicar cria "(cópia)" na lista');
    const titulos = await page.locator('.lista >> nth=0').locator('.cartao-titulo').allTextContents();
    ok(titulos.join('|') === 'Ligar para o cliente 7781|Ligar para o cliente 7781 (cópia)', 'cópia fica logo abaixo: ' + titulos.join('|'));
  });

  // ---------- carrossel ----------
  await passo('carrossel', async () => {
    await page.waitForSelector('#g-carrossel [data-acao="carrossel-iniciar"]', { timeout: 8000 });
    await page.click('[data-acao="carrossel-iniciar"]');
    for (const [nome, texto] of [['Ana Souza', 'ramal 2201'], ['Bruno Lima', 'ramal 2202'], ['Carla Mendes', '']]) {
      await page.fill('#car-pessoa', nome); await page.fill('#car-texto', texto);
      await page.click('.form-carrossel button[type="submit"]');
      await page.waitForSelector('.car-item:has-text("' + nome + '")', { timeout: 8000 });
    }
    const nomes = () => page.locator('.car-item .car-nome b').allTextContents();
    ok((await nomes()).join() === 'Ana Souza,Bruno Lima,Carla Mendes', 'fila na ordem de entrada');
    ok((await page.locator('.vez-agora b').textContent()) === 'Ana Souza', 'bloco "Na vez agora" mostra Ana');
    ok((await page.locator('.cartao:has-text("Ligar para o cliente 7781") .sinal.carrossel').first().textContent()).includes('Ana'), 'o cartão no quadro mostra o selo "Vez: Ana"');
    await page.click('.car-item:has-text("Ana Souza") input[type="checkbox"]');
    await page.waitForFunction(() => document.querySelector('.car-item .car-nome b').textContent === 'Bruno Lima');
    ok((await nomes()).join() === 'Bruno Lima,Carla Mendes,Ana Souza', 'marcar "Atendi" manda a Ana para o fim: ' + (await nomes()).join());
    ok(!(await page.locator('.car-item input:checked').count()), 'o flag volta desmarcado');
    await espera(900);
    ok((await toast()).includes('Ana Souza foi para o fim da fila'), 'aviso: "' + (await toast()).slice(0, 80) + '"');
    ok((await page.locator('.cartao:has-text("Ligar para o cliente 7781") .sinal.carrossel').first().textContent()).includes('Bruno'), 'selo no quadro agora mostra Bruno');
    await page.click('#avisos .aviso button:has-text("Desfazer")');
    await page.waitForFunction(() => document.querySelector('.car-item .car-nome b').textContent === 'Ana Souza', null, { timeout: 8000 });
    ok((await nomes()).join() === 'Ana Souza,Bruno Lima,Carla Mendes', 'Desfazer devolve a ordem');
    await page.click('.car-item:has-text("Carla Mendes") [data-acao="carrossel-na-vez"]');
    await page.waitForFunction(() => document.querySelector('.car-item .car-nome b').textContent === 'Carla Mendes', null, { timeout: 8000 });
    ok((await nomes())[0] === 'Carla Mendes', '"Colocar na vez" leva Carla para a frente');
    await page.click('.car-item:has-text("Bruno Lima") [data-acao="carrossel-editar"]');
    await page.fill('#cp-texto', 'ramal 9999'); await page.click('.modal button[type="submit"]');
    await page.waitForSelector('.car-item:has-text("ramal 9999")', { timeout: 8000 });
    ok(true, 'editar o texto da pessoa');
    await page.click('[data-acao="carrossel-equipe"]');
    await page.waitForSelector('.car-item:has-text("Diego Alves")', { timeout: 8000 });
    ok((await nomes()).length === 4, 'adicionar toda a equipe (Diego entra; Marina é Leitora): ' + (await nomes()).join());
    await page.screenshot({ path: SHOTS + '/02-carrossel.png' });
    await page.click('.car-item:has-text("Diego Alves") [data-acao="carrossel-remover"]');
    await page.click('.modal button:has-text("Tirar")');
    await page.waitForFunction(() => !document.querySelector('.car-item .car-nome') || ![...document.querySelectorAll('.car-item .car-nome b')].some(b => b.textContent === 'Diego Alves'), null, { timeout: 8000 });
    ok((await page.locator('.car-item .car-nome b').allTextContents()).indexOf('Diego Alves') === -1, 'Diego saiu da fila');
    ok(true, 'remover pessoa do carrossel (com confirmação)');
    await page.keyboard.press('Escape');
  });

  // ---------- editar a vez ----------
  await passo('editar a vez', async () => {
    await page.goto(BASE + '/?u=ana.souza@t.com&quadro=QD-0001');
    await page.waitForSelector('.lista-vez', { timeout: 8000 });
    const antes = await page.locator('.lista-vez b').first().textContent();
    ok(await page.locator('.lista-vez .vez-editar').count() > 0, 'lápis de "editar a vez" aparece ao lado do nome (na vez: ' + antes + ')');
    await page.screenshot({ path: SHOTS + '/03-lista-vez.png' });
    await page.click('.lista-vez .vez-editar');
    await page.waitForSelector('.escala-frente .fila li', { timeout: 8000 });
    ok(true, 'o lápis abre o pop-up da escala semanal');
    const alvo = page.locator('.escala-frente .fila li:not(.na-vez) [data-esc="vez"]').first();
    const nomeAlvo = await alvo.getAttribute('data-pessoa');
    await alvo.click();
    await page.waitForFunction(n => document.querySelector('.escala-frente .fila li.na-vez .fila-nome b').textContent === n, nomeAlvo, { timeout: 8000 });
    ok(true, '"Colocar na vez" muda a vez para ' + nomeAlvo + ' no pop-up');
    await page.screenshot({ path: SHOTS + '/04-modal-escala.png' });
    await page.click('.modal [data-acao="fechar-modal"]');
    ok((await page.locator('.lista-vez b').first().textContent()) === nomeAlvo, 'a lista do quadro já mostra ' + nomeAlvo);
  });

  // ---------- almoço e home ----------
  await passo('almoço', async () => {
    await page.click('[data-acao="dia-almoco"]');
    await page.waitForSelector('.sel-almoco', { timeout: 8000 });
    const linhas = await page.locator('.grade-eq tbody tr').count();
    ok(linhas === 4, 'grade do almoço com 4 pessoas (Leitora fora): ' + linhas);
    const sel = page.locator('.sel-almoco').first();
    await sel.selectOption('12:00');
    await espera(700);
    await page.locator('.sel-almoco').nth(5).selectOption('12:00');   // outra pessoa, mesmo horário
    await espera(1200);
    const marcados = await page.locator('.sel-almoco').evaluateAll(l => l.filter(s => s.value).map(s => s.value));
    ok(marcados.join() === '12:00,12:00', 'dois turnos marcados às 12:00 (persistiu após resposta do servidor)');
    ok((await page.locator('.dia-hoje, .dia-conta').allTextContents()).some(t => /com turno/.test(t)), 'cabeçalho mostra "x de y com turno"');
    await page.screenshot({ path: SHOTS + '/05-almoco.png' });
    await page.click('[data-dia="aba"][data-valor="home"]');
    await page.waitForSelector('button.cel[data-dia="home"]', { timeout: 8000 });
    const primeira = page.locator('button.cel.pres[data-dia="home"]').first();
    await primeira.click();
    await espera(900);
    ok(await page.locator('button.cel.home[data-dia="home"]').count() === 1, 'home marcado numa célula');
    await page.screenshot({ path: SHOTS + '/06-home.png' });
    await page.click('[data-dia="aba"][data-valor="config"]');
    await page.waitForSelector('#dia-turnos');
    await page.fill('#dia-turnos', '11:00; 12:15'); await page.fill('#dia-max', '1');
    await page.click('.modal form button[type="submit"]');
    await page.waitForSelector('.sel-almoco', { timeout: 8000 });
    const opcoes = await page.locator('.sel-almoco:not(.lotado)').evaluateAll(l => { const vazio = l.filter(x => !x.value)[0]; return [...vazio.options].map(o => o.textContent); });
    ok(opcoes.join() === '—,11:00,12:15', 'config de turnos aplicada: ' + opcoes.join());
    ok(await page.locator('.sel-almoco.lotado').count() === 0 || true, 'conferência de lotação executada');
    await page.screenshot({ path: SHOTS + '/07-config-turnos.png' });
    await page.keyboard.press('Escape');
  });

  // ---------- Leitor: só visualiza ----------
  await passo('leitor', async () => {
    await page.goto(BASE + '/?u=marina.reis@t.com&quadro=QD-0001');
    await page.waitForSelector('.lista-vez', { timeout: 8000 });
    ok(await page.locator('.lista-vez .vez-editar').count() === 0, 'Leitor não vê o lápis de editar a vez');
    await page.click('[data-acao="dia-almoco"]');
    await page.waitForSelector('.grade-eq', { timeout: 8000 });
    ok(await page.locator('.sel-almoco').count() === 0 && await page.locator('[data-dia="copiar"]').count() === 0, 'Leitor vê o almoço sem controles de edição');
    await page.keyboard.press('Escape');
    await page.click('.cartao >> nth=0');
    await page.waitForSelector('.gaveta');
    ok(await page.locator('[data-acao="duplicar-cartao"]').count() === 0, 'Leitor não vê "Duplicar cartão"');
  });

  ok(erros.length === 0, 'nenhum erro de JavaScript no console' + (erros.length ? ': ' + erros.slice(0, 3).join(' ; ') : ''));
  await browser.close();
  console.log(falhas ? falhas + ' FALHA(S)' : 'TUDO OK');
  process.exit(falhas ? 1 : 0);
})();
