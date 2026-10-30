// Escala mensal (1º horário, 2º horário, Férias), no quadro e na tela Equipe
JSON.parse(__fs.readFileSync(__env.CFG, 'utf8')).forEach(r => __sheets.Config.appendRow(r));
let falhas = 0;
function ok(c, m) { console.log(c ? 'OK  ' : 'FALHA', m); if (!c) falhas++; }
function erro(fn) { try { fn(); return null; } catch (e) { return e.message; } }
const nomes = ['Ana Souza', 'Bruno Lima', 'Carla Mendes', 'Diego Alves', 'Marina Reis'];
nomes.forEach((n, i) => __sheets.Usuarios.appendRow([n.toLowerCase().replace(' ', '.') + '@t.com', n, i === 0 ? 'ADM' : (i === 4 ? 'Leitor' : 'Membro'), 'Sim', new Date(), '']));
__setEmail('ana.souza@t.com'); api.iniciar();
const q = api.criarQuadro({ nome: 'Plantão' }).quadro;
const hoje = new Date(); const M = hoje.getFullYear() + '-' + String(hoje.getMonth() + 1).padStart(2, '0');
const dia = (d) => M + '-' + String(d).padStart(2, '0');
const util = (() => { for (let d = 1; d <= 28; d++) { const w = new Date(M + '-' + String(d).padStart(2, '0') + 'T12:00:00Z').getUTCDay(); if (w >= 1 && w <= 5) return d; } })();
const d1 = dia(util);

let g = api.obterEscalaMensal(q.id, M);
ok(g.mes === M && g.dias.length >= 20 && g.dias.length <= 23 && g.dias.every(d => { const w = new Date(d + 'T12:00:00Z').getUTCDay(); return w >= 1 && w <= 5; }), 'a grade tem só segunda a sexta do mês: ' + g.dias.length + ' dias');
ok(g.pessoas.map(p => p.nome).join() === 'Ana Souza,Bruno Lima,Carla Mendes,Diego Alves' && g.podeEditar && g.turnos.join() === '1º horário,2º horário,Férias', 'equipe do quadro (Leitora fora) e os três textos');
// marcar
g = api.definirMensal(q.id, 'ana.souza@t.com', d1, '1º horário').dados;
ok(g.pessoas[0].turnos[d1] === '1º horário' && g.contagem[d1].primeiro === 1, 'Ana no 1º horário: contagem 1');
api.definirMensal(q.id, 'bruno.lima@t.com', d1, '2º horário'); g = api.definirMensal(q.id, 'carla.mendes@t.com', d1, 'Férias').dados;
ok(g.contagem[d1].primeiro === 1 && g.contagem[d1].segundo === 1 && g.contagem[d1].ferias === 1, 'contagem do dia: 1 no 1º, 1 no 2º, 1 de férias');
g = api.definirMensal(q.id, 'ana.souza@t.com', d1, '2º horário').dados;
ok(g.pessoas[0].turnos[d1] === '2º horário' && g.contagem[d1].primeiro === 0 && g.contagem[d1].segundo === 2, 'trocar de 1º para 2º horário move a contagem');
ok(__sheets.Mensal.d.filter(r => r[1] === 'ana.souza@t.com').length === 1, 'só uma linha por pessoa e dia na aba Mensal');
g = api.definirMensal(q.id, 'ana.souza@t.com', d1, '').dados;
ok(!g.pessoas[0].turnos[d1], 'tirar a marcação');
g = api.definirMensal(q.id, 'ana.souza@t.com', d1, '1o horario').dados; ok(g.pessoas[0].turnos[d1] === '1º horário', 'aceita "1o horario" digitado de outro jeito');
g = api.definirMensal(q.id, 'ana.souza@t.com', d1, '2').dados; ok(g.pessoas[0].turnos[d1] === '2º horário', 'aceita "2"');
g = api.definirMensal(q.id, 'ana.souza@t.com', d1, 'ferias').dados; ok(g.pessoas[0].turnos[d1] === 'Férias', 'aceita "ferias" sem acento');
ok(__sheets.Mensal.d.filter(r => r[1] === 'ana.souza@t.com').length === 1, 'continua uma linha só depois de várias trocas');
// validações
ok(/Escolha 1º horário/.test(erro(() => api.definirMensal(q.id, 'ana.souza@t.com', d1, 'Noite')) || ''), 'texto inválido é recusado');
const sab = (() => { for (let d = 1; d <= 28; d++) { const w = new Date(dia(d) + 'T12:00:00Z').getUTCDay(); if (w === 6) return dia(d); } })();
ok(/segunda a sexta|inválida/.test(erro(() => api.definirMensal(q.id, 'ana.souza@t.com', sab, '1º horário')) || ''), 'sábado é recusado');
ok(/inválida/.test(erro(() => api.definirMensal(q.id, 'ana.souza@t.com', 'lixo', '1º horário')) || ''), 'data inválida é recusada');
ok(/não está na equipe/.test(erro(() => api.definirMensal(q.id, 'marina.reis@t.com', d1, '1º horário')) || ''), 'Leitora não entra na equipe do quadro');
api.salvarConfig({ FERIADOS: d1.split('-').reverse().join('/') });
ok(/feriado/.test(erro(() => api.definirMensal(q.id, 'ana.souza@t.com', d1, '1º horário')) || '') && api.obterEscalaMensal(q.id, M).feriados[d1] === true, 'feriado: marcado na grade e não aceita marcação');
api.salvarConfig({ FERIADOS: '' });
// meses
const nav = (m) => api.obterEscalaMensal(q.id, m);
ok(nav('2026-12').proximoMes === '2027-01' && nav('2027-01').mesAnterior === '2026-12' && nav('2026-03').mesAnterior === '2026-02', 'navegação de mês passa pela virada de ano');
ok(nav('2028-02').dias.filter(d => d.startsWith('2028-02')).length === 21 && nav('2028-02').dias.includes('2028-02-29'), 'fevereiro bissexto de 2028 inclui o dia 29');
ok(nav('lixo').mes === M && nav('').mes === M && nav('2026-13').mes === M, 'mês inválido volta para o mês atual');
// a marcação é da pessoa: o quadro e a tela Equipe mostram a mesma coisa
let eq = api.obterEscalaMensal('', M);
ok(eq.pessoas.length === 4 && eq.pessoas.find(p => p.nome === 'Ana Souza').turnos[d1] === 'Férias', 'a tela Equipe enxerga o que foi marcado no quadro');
g = api.definirMensal('', 'diego.alves@t.com', d1, '1º horário').dados;
ok(g.pessoas.find(p => p.nome === 'Diego Alves').turnos[d1] === '1º horário' && api.obterEscalaMensal(q.id, M).pessoas.find(p => p.nome === 'Diego Alves').turnos[d1] === '1º horário', 'marcar na tela Equipe aparece no quadro');
ok(eq.podeEditar === true, 'ADM edita na tela Equipe');
// permissões
__setEmail('bruno.lima@t.com');
ok(erro(() => api.definirMensal(q.id, 'carla.mendes@t.com', d1, '1º horário')) === null || /feriado/.test(erro(() => 1) || ''), 'Membro edita no quadro');
ok(/ADM|permissão|Somente|apenas/i.test(erro(() => api.definirMensal('', 'carla.mendes@t.com', d1, '2º horário')) || 'sem erro'), 'Membro NÃO edita na tela Equipe (só ADM): ' + erro(() => api.definirMensal('', 'carla.mendes@t.com', d1, '2º horário')));
ok(api.obterEscalaMensal('', M).podeEditar === false && api.obterEscalaMensal(q.id, M).podeEditar === true, 'Membro vê a Equipe só para leitura e edita o quadro');
__setEmail('marina.reis@t.com');
ok(/permissão/.test(erro(() => api.definirMensal(q.id, 'ana.souza@t.com', d1, '1º horário')) || ''), 'Leitor não edita o quadro');
ok(api.obterEscalaMensal(q.id, M).podeEditar === false, 'Leitor só vê');
// quadro privado: só a equipe dele
__setEmail('ana.souza@t.com');
const priv = api.criarQuadro({ nome: 'Privado', visibilidade: 'Privado', membros: ['bruno.lima@t.com'] }).quadro;
ok(api.obterEscalaMensal(priv.id, M).pessoas.map(p => p.nome).join() === 'Ana Souza,Bruno Lima', 'quadro privado: só dono e convidados');
__setEmail('diego.alves@t.com');
ok(/não encontrado/i.test(erro(() => api.obterEscalaMensal(priv.id, M)) || ''), 'quem não vê o quadro privado não abre a escala dele');
console.log(falhas ? falhas + ' FALHA(S)' : 'TUDO OK');
(function(){ var v = __ilegais(); var u = {}; v.forEach(function(x){ u[x]=1; }); var ks = Object.keys(u); console.log(ks.length ? 'RETORNO ILEGAL PARA A TELA (' + ks.length + '): ' + ks.slice(0,6).join(' | ') : 'nenhum retorno ilegal para google.script.run'); })();
