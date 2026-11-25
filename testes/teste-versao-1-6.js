// Versão 1.6.0 (servidor): zerar atendimentos da lista recorrente, avatar, escala da semana (configurar) e rotatividade semanal
JSON.parse(__fs.readFileSync(__env.CFG, 'utf8')).forEach(r => __sheets.Config.appendRow(r));
let falhas = 0;
function ok(c, m) { console.log(c ? 'OK  ' : 'FALHA', m); if (!c) falhas++; }
function erro(fn) { try { fn(); return null; } catch (e) { return e.message; } }
const nomes = ['Ana Souza', 'Bruno Lima', 'Carla Mendes', 'Diego Alves', 'Marina Reis'];
nomes.forEach((n, i) => __sheets.Usuarios.appendRow([n.toLowerCase().replace(' ', '.') + '@t.com', n, i === 0 ? 'ADM' : (i === 4 ? 'Leitor' : 'Membro'), 'Sim', new Date(), '']));
__setEmail('ana.souza@t.com'); api.iniciar();
const q = api.criarQuadro({ nome: 'Operação' }).quadro;

// ---------- Lista recorrente: zerar atendimentos ----------
const rec = api.criarLista(q.id, 'Fila de ligações', 'Recorrente').lista;
let r = api.adicionarEquipeLista(rec.id);
const id = n => r.itens.find(x => x.pessoa === n).id;
r = api.passarVezLista(id('Ana Souza')); r = api.passarVezLista(id('Ana Souza')); r = api.passarVezLista(id('Bruno Lima'));
const ordemAntes = r.itens.map(x => x.pessoa).join();
const conta = n => r.itens.find(x => x.pessoa === n).atendimentos;
ok(conta('Ana Souza') === 2 && conta('Bruno Lima') === 1, 'antes: Ana com 2, Bruno com 1');
r = api.zerarAtendimentosLista(rec.id, id('Ana Souza'));
ok(conta('Ana Souza') === 0 && conta('Bruno Lima') === 1, 'zerar uma pessoa: só a Ana volta a 0');
ok(r.itens.map(x => x.pessoa).join() === ordemAntes, 'zerar não muda a ordem da fila');
ok(r.antes && r.antes[id('Ana Souza')] === 2 && r.zerados === 1, 'devolve o valor de antes para desfazer');
r = api.restaurarAtendimentosLista(rec.id, r.antes);
ok(conta('Ana Souza') === 2, 'desfazer devolve os 2 atendimentos da Ana');
r = api.zerarAtendimentosLista(rec.id, '');
ok(r.itens.every(x => x.atendimentos === 0) && r.zerados === 2, 'zerar todos: todo mundo em 0 (2 pessoas tinham atendimentos)');
ok(r.itens.map(x => x.pessoa).join() === ordemAntes, 'zerar todos também não muda a ordem');
const antesTodos = r.antes;
r = api.restaurarAtendimentosLista(rec.id, antesTodos);
ok(conta('Ana Souza') === 2 && conta('Bruno Lima') === 1, 'desfazer o zerar todos devolve as contagens');
r = api.restaurarAtendimentosLista(rec.id, { [id('Ana Souza')]: -5, [id('Bruno Lima')]: 'abc', 'RC-9999': 7 });
ok(conta('Ana Souza') === 0 && conta('Bruno Lima') === 0, 'restaurar com valores estranhos não grava negativo nem texto');
ok(/não encontrada/.test(erro(() => api.zerarAtendimentosLista(rec.id, 'RC-9999')) || ''), 'zerar pessoa inexistente dá erro claro');
const rot = api.criarLista(q.id, 'Rodízio', 'Rotativa').lista;
ok(/não é recorrente/.test(erro(() => api.zerarAtendimentosLista(rot.id, '')) || ''), 'zerar só funciona em lista recorrente');
ok(__sheets.Log.d.some(l => String(l.join('|')).includes('Zerou os atendimentos')), 'zerar fica registrado no Log');
__setEmail('marina.reis@t.com');
ok(/permiss/i.test(erro(() => api.zerarAtendimentosLista(rec.id, '')) || ''), 'Leitor não consegue zerar');
__setEmail('bruno.lima@t.com');
ok(!erro(() => api.zerarAtendimentosLista(rec.id, '')), 'Membro consegue zerar');

// ---------- Avatar ----------
__setEmail('bruno.lima@t.com');
let a = api.salvarAvatar('', { cor: '#0B7A75', icone: '👒' });
let bruno = a.ativos.find(u => u.nome === 'Bruno Lima');
ok(bruno.cor === '#0B7A75' && bruno.icone === '👒', 'Bruno escolhe o próprio avatar (cor e ícone)');
ok(__sheets.Usuarios.d[0].includes('Avatar_Cor') && __sheets.Usuarios.d[0].includes('Avatar_Icone'), 'aba Usuarios ganhou as colunas Avatar_Cor e Avatar_Icone');
ok(api.iniciar().usuarios.find(u => u.nome === 'Bruno Lima').icone === '👒', 'iniciar devolve o avatar para a tela');
ok(/próprio avatar/.test(erro(() => api.salvarAvatar('carla.mendes@t.com', { cor: '#0B7A75' })) || ''), 'Membro não muda o avatar dos outros');
ok(/paleta/.test(erro(() => api.salvarAvatar('', { cor: '#123456' })) || ''), 'cor fora da paleta é recusada');
ok(/ícones/.test(erro(() => api.salvarAvatar('', { icone: '=HYPERLINK("x")' })) || ''), 'ícone fora da lista é recusado (nada de fórmula)');
a = api.salvarAvatar('', { cor: '', icone: '' });
bruno = a.ativos.find(u => u.nome === 'Bruno Lima');
ok(bruno.cor === '' && bruno.icone === '', 'voltar para cor automática e iniciais');
__setEmail('ana.souza@t.com');
a = api.salvarAvatar('carla.mendes@t.com', { cor: '#A3236E', icone: '🍊' });
ok(a.ativos.find(u => u.nome === 'Carla Mendes').icone === '🍊', 'ADM muda o avatar de outra pessoa');
ok(/não encontrada/.test(erro(() => api.salvarAvatar('ninguem@t.com', { icone: '⚓' })) || ''), 'avatar de e-mail que não existe dá erro claro');
__sheets.Usuarios.d[3][__sheets.Usuarios.d[0].indexOf('Avatar_Icone')] = 'texto qualquer';
ok(api.iniciar().usuarios.find(u => u.nome === 'Carla Mendes').icone === '', 'valor estranho digitado na planilha vira iniciais');

// ---------- Escala da semana: configurar ----------
const qe = api.criarQuadro({ nome: 'Só rodízios' }).quadro;
api.obterQuadro(qe.id).listas.forEach(l => api.arquivarLista(l.id, true));
api.criarLista(qe.id, 'Fila', 'Recorrente');
const equipe = ['Ana Souza', 'Bruno Lima'];
ok(/nenhuma lista normal/.test(erro(() => api.salvarConfigEscala(qe.id, { ativa: true, frentes: [], equipe })) || ''), 'quadro sem lista normal: a mensagem explica que falta uma lista normal');
const nova = api.criarLista(qe.id, 'Plantão').lista;
ok(api.obterEscala(qe.id, 'atual').listas.some(l => l.id === nova.id), 'lista criada depois aparece para a Configuração da escala');
ok(/Marque pelo menos uma lista/.test(erro(() => api.salvarConfigEscala(qe.id, { ativa: true, frentes: [{ id: 'LS-9999' }], equipe })) || ''), 'frente que não existe (arquivada ou inventada) é recusada com mensagem clara');
ok(/pelo menos uma pessoa/.test(erro(() => api.salvarConfigEscala(qe.id, { ativa: true, frentes: [{ id: nova.id }], equipe: [] })) || ''), 'equipe vazia é recusada com mensagem clara');
r = api.salvarConfigEscala(qe.id, { ativa: true, frentes: [{ id: nova.id, vagas: '' }], equipe });
ok(r.escala.ativa && r.escala.frentes.length === 1 && r.escala.frentes[0].pessoas.length === 2, 'com lista normal e equipe, a escala é montada');
ok(!erro(() => api.salvarConfigEscala(qe.id, { ativa: false })), 'desligar a escala não pede frente nem equipe');
const estranho = erro(() => api.salvarConfigEscala(qe.id, { ativa: true, frentes: 'texto', equipe })) || '';
ok(/Marque pelo menos uma lista/.test(estranho) && !/is not|Cannot read|undefined/.test(estranho), 'frentes em formato estranho dá mensagem clara, não erro interno');

// ---------- Rotatividade semanal: editar a tarefa não muda o rodízio ----------
const t0 = api.salvarTarefaRotativa(rot.id, { tarefa: 'Abrir a fila', pessoas: ['Ana Souza', 'Bruno Lima', 'Carla Mendes'], modo: 'Girar', inicio: 'Bruno Lima' }).tarefas[0];
ok(t0.atual.pessoa === 'Bruno Lima' && t0.proxima.pessoa === 'Carla Mendes', 'rodízio: Bruno nesta semana, Carla na próxima');
let t1 = api.trocarResponsavelRotativa(t0.id, 'atual', 'Diego Alves').tarefas[0];
ok(t1.atual.pessoa === 'Diego Alves' && t1.atual.trocado && t1.atual.doRodizio === 'Bruno Lima', 'troca só nesta semana: Diego (o rodízio indica Bruno)');
// a tela manda como "quem cuida desta semana" o nome do rodízio (Bruno), e não o da troca
t1 = api.salvarTarefaRotativa(rot.id, { id: t0.id, tarefa: 'Abrir a fila às 8h', texto: 'nova obs', pessoas: t0.pessoas, modo: 'Girar', inicio: t1.atual.doRodizio }).tarefas[0];
ok(t1.tarefa === 'Abrir a fila às 8h' && t1.atual.pessoa === 'Diego Alves' && t1.atual.trocado, 'editar só o texto mantém a troca desta semana (Diego)');
ok(t1.proxima.pessoa === 'Carla Mendes', 'e o rodízio continua: Carla na próxima semana');
t1 = api.salvarTarefaRotativa(rot.id, { id: t0.id, tarefa: 'Abrir a fila às 8h', pessoas: t0.pessoas, modo: 'Girar', inicio: 'Ana Souza' }).tarefas[0];
ok(t1.atual.pessoa === 'Ana Souza' && !t1.atual.trocado && t1.proxima.pessoa === 'Bruno Lima', 'escolher outra pessoa para esta semana refaz o rodízio a partir dela');

console.log(falhas ? falhas + ' FALHA(S)' : 'TUDO OK');
(function(){ var v = __ilegais(); var u = {}; v.forEach(function(x){ u[x]=1; }); var ks = Object.keys(u); console.log(ks.length ? 'RETORNO ILEGAL PARA A TELA (' + ks.length + '): ' + ks.slice(0,6).join(' | ') : 'nenhum retorno ilegal para google.script.run'); })();
(function(){ var v = __violacoes().filter(function (x) { return x.indexOf('Config.') !== 0; }); /* Config vem da semente do teste */ console.log(v.length ? 'GRAVAÇÕES PERIGOSAS: ' + v.slice(0, 5).join(' | ') : 'nenhuma gravação perigosa na planilha'); })();
