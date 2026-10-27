const { chromium } = require('playwright-core');
const BASE = 'http://localhost:' + process.env.PORT;
let falhas = 0; const erros = [];
function ok(c, m) { console.log(c ? 'OK  ' : 'FALHA', m); if (!c) falhas++; }
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  page.setDefaultTimeout(8000);
  page.on('pageerror', e => erros.push(e.message)); page.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
  await page.goto(BASE + '/?u=ana.souza@t.com&quadro=QD-0001');
  await page.waitForSelector('.cartao');
  await page.click('.cartao >> nth=0'); await page.waitForSelector('[data-acao="carrossel-iniciar"]');
  await page.click('[data-acao="carrossel-iniciar"]');
  // rajada: três nomes sem esperar o servidor
  for (const n of ['Ana Souza', 'Bruno Lima', 'Carla Mendes']) { await page.fill('#car-pessoa', n); await page.keyboard.press('Enter'); }
  const nomes = () => page.locator('.car-item .car-nome b').allTextContents();
  ok((await nomes()).join() === 'Ana Souza,Bruno Lima,Carla Mendes', 'rajada de 3 nomes aparece na hora, na ordem digitada: ' + (await nomes()).join());
  ok(await page.locator('.car-item input[type="checkbox"]:disabled').count() === 3, 'enquanto grava, os itens ainda não aceitam "Atendi"');
  await page.waitForFunction(() => document.querySelectorAll('.car-item input[type="checkbox"]:disabled').length === 0, null, { timeout: 15000 });
  ok((await nomes()).join() === 'Ana Souza,Bruno Lima,Carla Mendes', 'depois da resposta do servidor a fila continua igual');
  // digitar o próximo nome enquanto a resposta do anterior chega
  await page.fill('#car-pessoa', 'Diego Alves'); await page.keyboard.press('Enter');
  await page.keyboard.type('Mar', { delay: 80 });
  await page.waitForTimeout(2500);
  ok((await page.inputValue('#car-pessoa')) === 'Mar', 'o texto digitado durante a gravação não se perde: "' + (await page.inputValue('#car-pessoa')) + '"');
  ok(await page.evaluate(() => document.activeElement && document.activeElement.id) === 'car-pessoa', 'o foco continua no campo de nome');
  ok((await nomes()).join() === 'Ana Souza,Bruno Lima,Carla Mendes,Diego Alves', 'Diego entrou: ' + (await nomes()).join());
  // nome repetido: aviso imediato e nada é enviado
  await page.fill('#car-pessoa', 'ana souza'); await page.keyboard.press('Enter');
  ok(/já está/.test((await page.locator('#avisos .aviso.erro').allTextContents()).join()), 'nome repetido avisa na hora');
  ok(erros.length === 0, 'sem erros de JavaScript' + (erros.length ? ': ' + erros[0] : ''));
  await browser.close();
  console.log(falhas ? falhas + ' FALHA(S)' : 'TUDO OK');
  process.exit(falhas ? 1 : 0);
})();
