JSON.parse(__fs.readFileSync(__env.CFG,'utf8')).forEach(r => __sheets.Config.appendRow(r));
let falhas = 0;
function ok(c, m) { console.log(c ? 'OK  ' : 'FALHA', m); if (!c) falhas++; }
function erro(fn) { try { fn(); return null; } catch (e) { return e.message; } }
const nomes = ['Ana Souza','Bruno Lima','Carla Mendes','Diego Alves','Marina Reis'];
nomes.forEach((n, i) => __sheets.Usuarios.appendRow([n.toLowerCase().replace(' ', '.') + '@t.com', n, i === 0 ? 'ADM' : (i === 4 ? 'Leitor' : 'Membro'), 'Sim', new Date(), '']));
__setEmail('ana.souza@t.com');
api.iniciar();   // 1ª abertura: cria aba Carrossel e colunas novas
ok(!!__sheets.Carrossel && __sheets.Carrossel.d[0].includes('Atendimentos'), 'aba Carrossel criada sozinha na 1ª abertura');
ok(__sheets.Cartoes.d[0].includes('Carrossel_Total'), 'colunas Carrossel_Total/Vez adicionadas em Cartoes');
const q = api.criarQuadro({ nome: 'Atendimento' }).quadro; const L = api.obterQuadro(q.id).listas[0].id;
const c = api.criarCartao(L, 'Plantão de ligações').cartao;
const ver = () => api.obterDetalheCartao(c.id).carrossel.map(x => x.pessoa);

let r = api.adicionarParticipante(c.id, 'Ana Souza', 'ramal 2201');
api.adicionarParticipante(c.id, 'Bruno Lima', 'ramal 2202'); api.adicionarParticipante(c.id, 'Carla Mendes', '');
r = api.adicionarParticipante(c.id, 'Diego Alves', 'ramal 2204');
ok(JSON.stringify(r.itens.map(x => x.pessoa)) === JSON.stringify(nomes.slice(0, 4)), 'ordem de entrada: ' + r.itens.map(x => x.pessoa));
ok(r.resumo.total === 4 && r.resumo.vez === 'Ana Souza', 'resumo: 4 pessoas, vez = Ana');
ok(/já está/.test(erro(() => api.adicionarParticipante(c.id, ' ana souza ', ''))), 'nome repetido (sem acento/caixa) é barrado');
ok(/nome/i.test(erro(() => api.adicionarParticipante(c.id, '   ', ''))), 'nome vazio é barrado');
const cartaoQuadro = api.obterQuadro(q.id).cartoes.find(x => x.id === c.id);
ok(cartaoQuadro.carrossel && cartaoQuadro.carrossel.total === 4 && cartaoQuadro.carrossel.vez === 'Ana Souza', 'quadro mostra selo do carrossel sem ler a aba (total=4, vez=Ana)');

// Ana atende -> vai para o fim
r = api.passarVezCarrossel(r.itens[0].id);
ok(JSON.stringify(r.itens.map(x => x.pessoa)) === JSON.stringify(['Bruno Lima', 'Carla Mendes', 'Diego Alves', 'Ana Souza']), 'Ana atendeu e foi para o fim: ' + r.itens.map(x => x.pessoa));
ok(r.resumo.vez === 'Bruno Lima' && r.itens[3].atendimentos === 1 && r.itens[3].ultimoPor === 'Ana Souza', 'vez agora é Bruno; Ana com 1 atendimento');
// Carla atende fora de ordem
const carla = r.itens.find(x => x.pessoa === 'Carla Mendes');
r = api.passarVezCarrossel(carla.id);
ok(JSON.stringify(r.itens.map(x => x.pessoa)) === JSON.stringify(['Bruno Lima', 'Diego Alves', 'Ana Souza', 'Carla Mendes']), 'Carla (fora de ordem) vai para o fim: ' + r.itens.map(x => x.pessoa));
// desfazer
const antes = r.antes;
r = api.reordenarCarrossel(c.id, antes, carla.id);
ok(JSON.stringify(r.itens.map(x => x.pessoa)) === JSON.stringify(['Bruno Lima', 'Carla Mendes', 'Diego Alves', 'Ana Souza']), 'desfazer volta a fila: ' + r.itens.map(x => x.pessoa));
ok(r.itens.find(x => x.pessoa === 'Carla Mendes').atendimentos === 0, 'desfazer tira o atendimento da conta');
// colocar na vez
r = api.colocarNaVezCarrossel(r.itens.find(x => x.pessoa === 'Ana Souza').id);
ok(r.itens[0].pessoa === 'Ana Souza' && r.resumo.vez === 'Ana Souza', 'Ana colocada na vez (frente da fila)');
// último da fila passa: nada muda de ordem, mas conta
const ult = r.itens[r.itens.length - 1]; const ordAntes = r.itens.map(x => x.pessoa).join();
r = api.passarVezCarrossel(ult.id);
ok(r.itens.map(x => x.pessoa).join() === ordAntes && r.itens[r.itens.length - 1].atendimentos === ult.atendimentos + 1, 'quem já é o último: ordem igual, atendimento contado');
// fila de 1 pessoa
const c2 = api.criarCartao(L, 'Sozinho').cartao; const s1 = api.adicionarParticipante(c2.id, 'Ana Souza', 'x').itens[0];
r = api.passarVezCarrossel(s1.id); ok(r.itens.length === 1 && r.resumo.vez === 'Ana Souza' && r.itens[0].atendimentos === 1, 'fila de 1 pessoa não quebra');
// 200 voltas: ordem estável e números pequenos
for (let i = 0; i < 200; i++) { const f = api.obterDetalheCartao(c.id).carrossel; api.passarVezCarrossel(f[0].id); }
const f = api.obterDetalheCartao(c.id).carrossel;
ok(f.length === 4 && f.every(x => Math.abs(x.ordem) < 1e7) && new Set(f.map(x => x.ordem)).size === 4, '200 voltas: ordens únicas e pequenas (' + f.map(x => x.ordem) + ')');
ok(f.reduce((t, x) => t + x.atendimentos, 0) === 202, 'soma de atendimentos confere: ' + f.reduce((t, x) => t + x.atendimentos, 0));
// editar / remover
r = api.atualizarParticipante(f[1].id, { texto: 'novo ramal 9999', pessoa: 'Bruno L.' });
ok(r.itens.find(x => x.id === f[1].id).texto === 'novo ramal 9999' && r.itens.find(x => x.id === f[1].id).pessoa === 'Bruno L.', 'editar nome e texto');
ok(/já está/.test(erro(() => api.atualizarParticipante(f[0].id, { pessoa: 'Bruno L.' }))), 'renomear para nome existente é barrado');
r = api.removerParticipante(f[2].id);
ok(r.itens.length === 3 && r.resumo.total === 3, 'remover tira da fila e atualiza o resumo');
ok(__sheets.Carrossel.d.some(row => row[0] === f[2].id && row.includes('Não')), 'remover só marca Ativo=Não (nada é apagado)');
// equipe inteira
const c3 = api.criarCartao(L, 'Equipe').cartao;
r = api.adicionarEquipeCarrossel(c3.id);
ok(r.adicionados === 4 && !r.itens.some(x => x.pessoa === 'Marina Reis'), 'equipe do quadro entra (4 pessoas, Leitor fica de fora)');
ok(/já estão/.test(erro(() => api.adicionarEquipeCarrossel(c3.id))), 'repetir "adicionar equipe" avisa que todos já estão');
// duplicar leva o carrossel com contagem zerada
const d = api.duplicarCartao(c.id);
const fd = api.obterDetalheCartao(d.cartao.id).carrossel;
ok(fd.length === 3 && fd.every(x => x.atendimentos === 0) && d.cartao.carrossel.total === 3, 'duplicar copia o carrossel com atendimentos zerados');
ok(fd.map(x => x.pessoa).join() === api.obterDetalheCartao(c.id).carrossel.map(x => x.pessoa).join(), 'duplicar mantém a mesma ordem da fila');
// limite
const c4 = api.criarCartao(L, 'Lotado').cartao;
for (let i = 0; i < 60; i++) api.adicionarParticipante(c4.id, 'Pessoa ' + i, '');
ok(/até 60/.test(erro(() => api.adicionarParticipante(c4.id, 'Extra', ''))), 'limite de 60 participantes');
// permissões
__setEmail('marina.reis@t.com');
ok(/permiss/i.test(erro(() => api.passarVezCarrossel(f[0].id)) || ''), 'Leitor não consegue passar a vez');
ok(/permiss/i.test(erro(() => api.adicionarParticipante(c.id, 'Fulano', '')) || ''), 'Leitor não consegue adicionar');
ok(api.obterDetalheCartao(c.id).carrossel.length === 3, 'Leitor consegue ver a fila');
__setEmail('bruno.lima@t.com');
ok(!erro(() => api.passarVezCarrossel(f[0].id)), 'Membro consegue passar a vez');
ok(/não encontrado/i.test(erro(() => api.passarVezCarrossel('CR-9999'))), 'ID inexistente dá erro claro');
console.log(falhas ? falhas + ' FALHA(S)' : 'TUDO OK');

(function(){ var v = __ilegais(); var u = {}; v.forEach(function(x){ u[x]=1; }); var ks = Object.keys(u); console.log(ks.length ? 'RETORNO ILEGAL PARA A TELA (' + ks.length + '): ' + ks.slice(0,6).join(' | ') : 'nenhum retorno ilegal para google.script.run'); })();
