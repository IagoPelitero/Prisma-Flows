// Lista de rotatividade semanal e lista recorrente (servidor)
JSON.parse(__fs.readFileSync(__env.CFG, 'utf8')).forEach(r => __sheets.Config.appendRow(r));
let falhas = 0;
function ok(c, m) { console.log(c ? 'OK  ' : 'FALHA', m); if (!c) falhas++; }
function erro(fn) { try { fn(); return null; } catch (e) { return e.message; } }
const nomes = ['Ana Souza', 'Bruno Lima', 'Carla Mendes', 'Diego Alves', 'Marina Reis'];
nomes.forEach((n, i) => __sheets.Usuarios.appendRow([n.toLowerCase().replace(' ', '.') + '@t.com', n, i === 0 ? 'ADM' : (i === 4 ? 'Leitor' : 'Membro'), 'Sim', new Date(), '']));
__setEmail('ana.souza@t.com'); api.iniciar();
const q = api.criarQuadro({ nome: 'Operação' }).quadro;
const ver = () => api.obterQuadro(q.id);
const normal = ver().listas[0].id;

// ---------- tipos de lista ----------
const rot = api.criarLista(q.id, 'Rodízio semanal', 'Rotativa').lista;
const rec = api.criarLista(q.id, 'Fila de ligações', 'Recorrente').lista;
const comum = api.criarLista(q.id, 'Lista comum').lista;
const estranha = api.criarLista(q.id, 'Tipo inválido', 'Qualquer').lista;
ok(rot.tipo === 'Rotativa' && rec.tipo === 'Recorrente' && comum.tipo === 'Normal' && estranha.tipo === 'Normal', 'tipos de lista: Rotativa, Recorrente, Normal (tipo desconhecido vira Normal)');
ok(__sheets.Listas.d[0].includes('Tipo') && ver().listas.find(l => l.id === rot.id).tipo === 'Rotativa', 'aba Listas ganhou a coluna Tipo e o quadro devolve o tipo');
ok(!!__sheets.Rotativa && !!__sheets.Recorrente, 'abas Rotativa e Recorrente criadas sozinhas');
ok(/não recebe cartões/.test(erro(() => api.criarCartao(rot.id, 'x')) || '') && /não recebe cartões/.test(erro(() => api.criarCartao(rec.id, 'x')) || ''), 'listas de rodízio não recebem cartões novos');
const c1 = api.criarCartao(normal, 'Cartão comum').cartao;
ok(/não recebe cartões/.test(erro(() => api.moverCartao(c1.id, rot.id, null)) || ''), 'não dá para mover cartão para lista de rodízio');
ok(api.listarDestinos().find(d => d.id === q.id).listas.every(l => l.id !== rot.id && l.id !== rec.id), 'destinos de "mover para outro quadro" só mostram listas normais');
const q2 = api.criarQuadro({ nome: 'Outro' }).quadro; const rec2 = api.criarLista(q2.id, 'Fila', 'Recorrente').lista;
ok(/não recebe cartões/.test(erro(() => api.moverCartaoParaQuadro(c1.id, q2.id, rec2.id)) || ''), 'mover para outro quadro também recusa lista de rodízio');
ok(/Escolha a lista/.test(erro(() => api.salvarRotina({ nome: 'R', quadroId: q.id, listaId: rot.id, frequencia: 'Dias úteis' })) || ''), 'Rotinas não criam cartão em lista de rodízio');
const X = __novo();
ok(X.resolverLista_({ Lista_ID: 'inexistente' }, [{ ID: 'a', Ativo: 'Sim', Tipo: 'Rotativa', Ordem: 1000 }, { ID: 'b', Ativo: 'Sim', Tipo: '', Ordem: 2000 }]).ID === 'b', 'cartão sem lista conhecida cai numa lista normal');

// ---------- rotatividade semanal ----------
let r = api.salvarTarefaRotativa(rot.id, { tarefa: 'Abrir fila 08h', texto: 'Conferir fila', pessoas: ['Ana Souza', 'Bruno Lima', 'Carla Mendes'], modo: 'Girar', inicio: 'Bruno Lima' });
let t = r.tarefas[0];
ok(t.atual.pessoa === 'Bruno Lima' && t.proxima.pessoa === 'Carla Mendes' && !t.atual.trocado, 'começa em Bruno; na semana seguinte Carla');
ok(ver().rotativas[rot.id][0].tarefa === 'Abrir fila 08h' && Array.isArray(ver().recorrentes[rec.id]), 'obterQuadro devolve as tarefas e as filas');
// o rodízio ao longo das semanas (função interna com linhas de exemplo)
const linha = { Pessoas: 'A; B; C', Modo: 'Girar', Semana_Base: '2026-10-26', Indice_Base: 1, Trocas: '' };
const seq = [-4, -1, 0, 1, 2, 3, 4, 52].map(w => X.responsavelDaSemana_(linha, X.somarDiasIso_('2026-10-26', 7 * w)).pessoa).join('');
const esperado = (w) => ['A', 'B', 'C'][(((1 + w) % 3) + 3) % 3];
ok([-4, -1, 0, 1, 2, 3, 4, 52].every((w, i) => seq[i] === esperado(w)), 'cada semana segue (índice inicial + semanas) módulo 3, inclusive para trás');
const fixo = Object.assign({}, linha, { Modo: 'Fixo' });
ok([0, 1, 5, -3].every(w => X.responsavelDaSemana_(fixo, X.somarDiasIso_('2026-10-26', 7 * w)).pessoa === 'B'), 'modo Fixo mantém o mesmo nome toda semana');
// fixo na tela
r = api.salvarTarefaRotativa(rot.id, { tarefa: 'Relatório diário', pessoas: ['Carla Mendes'], modo: 'Fixo', inicio: 'Carla Mendes' });
const rel = r.tarefas.find(x => x.tarefa === 'Relatório diário');
ok(rel.atual.pessoa === 'Carla Mendes' && rel.proxima.pessoa === 'Carla Mendes' && rel.modo === 'Fixo', 'tarefa fixa: mesma pessoa esta semana e na próxima');
// trocar o nome
const tid = t.id;
r = api.trocarResponsavelRotativa(tid, 'atual', 'Diego Alves'); t = r.tarefas.find(x => x.id === tid);
ok(t.atual.pessoa === 'Diego Alves' && t.atual.trocado && t.atual.doRodizio === 'Bruno Lima' && t.proxima.pessoa === 'Carla Mendes' && !t.proxima.trocado, 'trocar o nome vale só para esta semana; o rodízio da próxima segue');
r = api.trocarResponsavelRotativa(tid, 'proxima', 'Ana Souza'); t = r.tarefas.find(x => x.id === tid);
ok(t.atual.pessoa === 'Diego Alves' && t.proxima.pessoa === 'Ana Souza' && t.proxima.trocado, 'dá para trocar também a próxima semana');
r = api.trocarResponsavelRotativa(tid, 'atual', ''); t = r.tarefas.find(x => x.id === tid);
ok(t.atual.pessoa === 'Bruno Lima' && !t.atual.trocado && t.proxima.pessoa === 'Ana Souza', 'nome vazio volta ao rodízio (a troca da próxima fica)');
r = api.trocarResponsavelRotativa(tid, 'atual', 'Bruno Lima'); t = r.tarefas.find(x => x.id === tid);
ok(t.atual.pessoa === 'Bruno Lima' && !t.atual.trocado, 'trocar para o mesmo nome do rodízio não conta como troca');
ok(/Tarefa não encontrada/.test(erro(() => api.trocarResponsavelRotativa('RV-9999', 'atual', 'x')) || ''), 'tarefa inexistente dá erro claro');
// editar muda a base e mantém trocas futuras
r = api.salvarTarefaRotativa(rot.id, { id: tid, tarefa: 'Abrir fila 08h (novo)', pessoas: ['Ana Souza', 'Bruno Lima', 'Carla Mendes', 'Diego Alves'], modo: 'Girar', inicio: 'Diego Alves' });
t = r.tarefas.find(x => x.id === tid);
ok(t.tarefa.includes('(novo)') && t.atual.pessoa === 'Diego Alves' && t.proxima.pessoa === 'Ana Souza' && t.proxima.trocado === false, 'editar: começa em Diego e depois volta para Ana (4 pessoas); a troca da próxima semana (Ana) coincide com o rodízio, então não conta como troca');
// nomes com separadores não quebram a célula
r = api.salvarTarefaRotativa(rot.id, { tarefa: 'Nomes estranhos', pessoas: ['Fulano; Beltrano', 'Ciclano, X=Y'], modo: 'Girar' });
const est = r.tarefas.find(x => x.tarefa === 'Nomes estranhos');
ok(est.pessoas.length === 2 && est.pessoas.every(n => !/[;,=]/.test(n)), 'nomes com ; , = são limpos: ' + est.pessoas.join(' | '));
// validações
ok(/nome para a tarefa/.test(erro(() => api.salvarTarefaRotativa(rot.id, { tarefa: ' ', pessoas: ['Ana Souza'] })) || ''), 'tarefa sem nome é recusada');
ok(/pelo menos uma pessoa/.test(erro(() => api.salvarTarefaRotativa(rot.id, { tarefa: 'x', pessoas: [] })) || ''), 'tarefa sem pessoas é recusada');
ok(/não é de rotatividade/.test(erro(() => api.salvarTarefaRotativa(rec.id, { tarefa: 'x', pessoas: ['A'] })) || ''), 'não grava tarefa em lista de outro tipo');
ok(/não encontrada/i.test(erro(() => api.salvarTarefaRotativa('LS-9999', { tarefa: 'x', pessoas: ['A'] })) || ''), 'lista inexistente dá erro claro');
r = api.removerTarefaRotativa(est.id);
ok(!r.tarefas.some(x => x.id === est.id) && __sheets.Rotativa.d.some(row => row[0] === est.id && row.includes('Não')), 'remover só marca Ativo=Não');
// ---------- lista recorrente ----------
let f = api.adicionarPessoaLista(rec.id, 'Ana Souza', 'ramal 2201');
api.adicionarPessoaLista(rec.id, 'Bruno Lima', 'ramal 2202'); f = api.adicionarPessoaLista(rec.id, 'Carla Mendes', '');
ok(f.itens.map(x => x.pessoa).join() === 'Ana Souza,Bruno Lima,Carla Mendes', 'fila na ordem de entrada');
ok(/já está/.test(erro(() => api.adicionarPessoaLista(rec.id, ' ana souza ', '')) || ''), 'nome repetido é barrado');
ok(/nome/i.test(erro(() => api.adicionarPessoaLista(rec.id, '  ', '')) || ''), 'nome vazio é barrado');
f = api.passarVezLista(f.itens[0].id);
ok(f.itens.map(x => x.pessoa).join() === 'Bruno Lima,Carla Mendes,Ana Souza' && f.itens[2].atendimentos === 1 && f.itens[2].ultimoPor === 'Ana Souza', 'Atendi: Ana vai para o fim e conta 1 atendimento');
const carla = f.itens.find(x => x.pessoa === 'Carla Mendes');
f = api.passarVezLista(carla.id);
ok(f.itens.map(x => x.pessoa).join() === 'Bruno Lima,Ana Souza,Carla Mendes', 'quem atendeu fora de ordem também vai para o fim');
f = api.reordenarLista(rec.id, f.antes, carla.id);
ok(f.itens.map(x => x.pessoa).join() === 'Bruno Lima,Carla Mendes,Ana Souza' && f.itens.find(x => x.pessoa === 'Carla Mendes').atendimentos === 0, 'Desfazer devolve a ordem e tira o atendimento');
f = api.colocarNaVezLista(f.itens.find(x => x.pessoa === 'Ana Souza').id);
ok(f.itens[0].pessoa === 'Ana Souza', 'Colocar na vez leva a pessoa para a frente');
f = api.atualizarPessoaLista(f.itens[1].id, { texto: 'novo ramal', pessoa: 'Bruno L.' });
ok(f.itens[1].pessoa === 'Bruno L.' && f.itens[1].texto === 'novo ramal', 'editar nome e texto');
f = api.adicionarEquipeLista(rec.id);
ok(f.adicionados === 2 && f.itens.some(x => x.pessoa === 'Diego Alves') && f.itens.some(x => x.pessoa === 'Bruno Lima') && !f.itens.some(x => x.pessoa === 'Marina Reis'), 'equipe do quadro entra: Diego e Bruno Lima (renomeado antes para Bruno L.); a Leitora fica de fora: ' + f.adicionados);
f = api.removerPessoaLista(f.itens[f.itens.length - 1].id);
ok(__sheets.Recorrente.d.filter(row => row.includes('Não')).length === 1, 'remover só marca Ativo=Não');
for (let i = 0; i < 300; i++) { const cur = ver().recorrentes[rec.id]; api.passarVezLista(cur[0].id); }
const fim = ver().recorrentes[rec.id];
ok(fim.every(x => Math.abs(x.ordem) < 1e7) && new Set(fim.map(x => x.ordem)).size === fim.length, '300 voltas: ordens únicas e pequenas');
const c4 = api.criarLista(q.id, 'Lotada', 'Recorrente').lista;
for (let i = 0; i < 60; i++) api.adicionarPessoaLista(c4.id, 'P' + i, '');
ok(/até 60/.test(erro(() => api.adicionarPessoaLista(c4.id, 'Extra', '')) || ''), 'limite de 60 pessoas');
ok(/não é recorrente|não encontrada/i.test(erro(() => api.adicionarPessoaLista(rot.id, 'X', '')) || ''), 'não grava pessoa em lista de outro tipo');
// ---------- permissões ----------
__setEmail('marina.reis@t.com');
ok(/permissão/.test(erro(() => api.passarVezLista(fim[0].id)) || '') && /permissão/.test(erro(() => api.salvarTarefaRotativa(rot.id, { tarefa: 'x', pessoas: ['A'] })) || '') && /permissão/.test(erro(() => api.trocarResponsavelRotativa(tid, 'atual', 'X')) || ''), 'Leitor não altera nenhuma das duas listas');
ok(ver().rotativas[rot.id].length >= 2 && ver().recorrentes[rec.id].length >= 3, 'Leitor consegue ver o conteúdo');
__setEmail('bruno.lima@t.com');
ok(!erro(() => api.passarVezLista(fim[0].id)) && !erro(() => api.trocarResponsavelRotativa(tid, 'atual', 'Carla Mendes')), 'Membro usa as duas listas');
// arquivar lista especial não quebra o quadro
__setEmail('ana.souza@t.com');
api.arquivarLista(rot.id, true);
ok(!ver().listas.some(l => l.id === rot.id) && !('' + Object.keys(ver().rotativas)).includes(rot.id), 'arquivar a lista rotativa tira ela do quadro');
console.log(falhas ? falhas + ' FALHA(S)' : 'TUDO OK');
(function(){ var v = __ilegais(); var u = {}; v.forEach(function(x){ u[x]=1; }); var ks = Object.keys(u); console.log(ks.length ? 'RETORNO ILEGAL PARA A TELA (' + ks.length + '): ' + ks.slice(0,6).join(' | ') : 'nenhum retorno ilegal para google.script.run'); })();
