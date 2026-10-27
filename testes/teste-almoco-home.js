JSON.parse(__fs.readFileSync(__env.CFG,'utf8')).forEach(r => __sheets.Config.appendRow(r));
let falhas = 0;
function ok(c, m) { console.log(c ? 'OK  ' : 'FALHA', m); if (!c) falhas++; }
function erro(fn) { try { fn(); return null; } catch (e) { return e.message; } }
const nomes = ['Ana Souza','Bruno Lima','Carla Mendes','Diego Alves','Marina Reis'];
nomes.forEach((n, i) => __sheets.Usuarios.appendRow([n.toLowerCase().replace(' ', '.') + '@t.com', n, i === 0 ? 'ADM' : (i === 4 ? 'Leitor' : 'Membro'), 'Sim', new Date(), '']));
__setEmail('ana.souza@t.com'); api.iniciar();
const q = api.criarQuadro({ nome: 'Atendimento' }).quadro;
// segunda-feira desta semana (formato ISO)
const d0 = new Date(); d0.setHours(12); d0.setDate(d0.getDate() - ((d0.getDay() + 6) % 7));
const iso = n => { const d = new Date(d0); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const seg = iso(0), ter = iso(1), qua = iso(2), sab = iso(5);

let d = api.obterEscalaDiaria(q.id, seg);
ok(d.semana === seg && d.dias.length === 5 && d.pessoas.length === 4, 'carrega a semana: 5 dias e 4 pessoas (Leitor fica de fora)');
ok(d.turnos.join() === '11:30,12:00,12:30,13:00' && d.podeEditar && d.podeAdministrar, 'turnos padrão e permissões do dono');
// almoço
d = api.definirAlmoco(q.id, 'Ana Souza', seg, '12:00').dados;
ok(d.pessoas.find(p => p.nome === 'Ana Souza').almoco[seg] === '12:00', 'almoço marcado às 12:00');
d = api.definirAlmoco(q.id, 'Bruno Lima', seg, '12:00').dados;
ok(d.contagem[seg].porTurno['12:00'] === 2, 'contagem por turno = 2 às 12:00');
d = api.definirAlmoco(q.id, 'Ana Souza', seg, '12h30').dados;
ok(d.pessoas.find(p => p.nome === 'Ana Souza').almoco[seg] === '12:30' && d.contagem[seg].porTurno['12:00'] === 1, 'trocar turno (aceita 12h30): move a contagem');
d = api.definirAlmoco(q.id, 'Ana Souza', seg, '').dados;
ok(!d.pessoas.find(p => p.nome === 'Ana Souza').almoco[seg], 'limpar o almoço');
d = api.definirAlmoco(q.id, 'Ana Souza', seg, '13:00').dados;
ok(d.pessoas.find(p => p.nome === 'Ana Souza').almoco[seg] === '13:00', 'marcar de novo reaproveita a linha');
ok(__sheets.Almoco.d.filter(r => r[3] === 'Ana Souza').length === 1, 'sem linhas duplicadas na aba Almoco (1 linha da Ana)');
ok(/turno de almoço/.test(erro(() => api.definirAlmoco(q.id, 'Ana Souza', seg, '15:00')) || ''), 'horário fora dos turnos é recusado');
ok(/inválido/.test(erro(() => api.definirAlmoco(q.id, 'Ana Souza', seg, 'abc')) || ''), 'horário inválido é recusado');
ok(/não está na equipe/.test(erro(() => api.definirAlmoco(q.id, 'Marina Reis', seg, '12:00')) || ''), 'Leitor/pessoa fora da equipe é recusada');
ok(/Data inválida|segunda a sexta/.test(erro(() => api.definirAlmoco(q.id, 'Ana Souza', sab, '12:00')) || ''), 'fim de semana é recusado');
// home
d = api.definirHomeQuadro(q.id, 'carla.mendes@t.com', ter, 'Home').dados;
ok(d.pessoas.find(p => p.nome === 'Carla Mendes').home.includes(ter) && d.contagem[ter].home === 1 && d.contagem[ter].presenciais === 3, 'home marcado: 1 home e 3 presenciais');
d = api.definirHomeQuadro(q.id, 'carla.mendes@t.com', ter, 'Home').dados;
ok(d.contagem[ter].home === 1, 'marcar home duas vezes não duplica');
ok(__sheets.Presenca.d.filter(r => r[1] === 'carla.mendes@t.com').length === 1, 'uma só linha em Presenca');
ok(api.obterEquipeSemana(seg).pessoas.find(p => p.nome === 'Carla Mendes').home.includes(ter), 'a tela global Equipe enxerga o mesmo home (dado é da pessoa)');
d = api.definirHomeQuadro(q.id, 'carla.mendes@t.com', ter, 'Presencial').dados;
ok(d.contagem[ter].home === 0, 'voltar para presencial');
ok(/Home ou Presencial/.test(erro(() => api.definirHomeQuadro(q.id, 'carla.mendes@t.com', ter, 'xx')) || ''), 'tipo inválido é recusado');
ok(/não está na equipe/.test(erro(() => api.definirHomeQuadro(q.id, 'zé@x.com', ter, 'Home')) || ''), 'pessoa fora do quadro é recusada');
// ausência e feriado
api.salvarAusencia({ pessoa: 'Diego Alves', inicio: qua, fim: qua, motivo: 'Férias' });
d = api.obterEscalaDiaria(q.id, seg);
ok(d.pessoas.find(p => p.nome === 'Diego Alves').fora[qua] && d.contagem[qua].fora === 1, 'ausência aparece como "fora"');
ok(/ausente/.test(erro(() => api.definirAlmoco(q.id, 'Diego Alves', qua, '12:00')) || ''), 'não marca almoço em quem está ausente');
ok(/ausente/.test(erro(() => api.definirHomeQuadro(q.id, 'diego.alves@t.com', qua, 'Home')) || ''), 'não marca home em quem está ausente');
api.salvarConfig({ FERIADOS: iso(3).split('-').reverse().join('/') });
ok(/feriado/.test(erro(() => api.definirAlmoco(q.id, 'Ana Souza', iso(3), '12:00')) || ''), 'não marca almoço em feriado');
ok(api.obterEscalaDiaria(q.id, seg).feriados[iso(3)] === true, 'feriado vem marcado na semana');
// configuração
let r = api.salvarConfigDiaria(q.id, { equipe: ['Ana Souza', 'Bruno Lima', 'Fulano Fora'], turnos: '11:00; 12:15; 12:15', max: 2 }).dados;
ok(r.pessoas.length === 2 && r.turnos.join() === '11:00,12:15' && r.almocoMax === 2 && r.equipeMarcada, 'config: equipe de 2, turnos 11:00/12:15 (sem repetidos), máx. 2');
ok(/formato 12:00/.test(erro(() => api.salvarConfigDiaria(q.id, { equipe: [], turnos: '25:99', max: '' })) || ''), 'turno inválido na config é recusado');
ok(/1 a 99/.test(erro(() => api.salvarConfigDiaria(q.id, { equipe: [], turnos: '', max: 0 })) || ''), 'máximo inválido é recusado');
r = api.salvarConfigDiaria(q.id, { equipe: [], turnos: '', max: '' }).dados;
ok(r.pessoas.length === 4 && r.turnos.join() === '11:30,12:00,12:30,13:00' && !r.equipeMarcada, 'limpar a config volta ao padrão (todos, turnos padrão)');
// copiar semana
const prox = iso(7);
api.definirAlmoco(q.id, 'Ana Souza', seg, '12:00'); api.definirAlmoco(q.id, 'Bruno Lima', ter, '12:30');
api.definirHomeQuadro(q.id, 'ana.souza@t.com', ter, 'Home');
let c = api.copiarSemanaQuadro(q.id, 'almoco', seg, prox);
ok(c.copiados >= 2 && c.dados.pessoas.find(p => p.nome === 'Ana Souza').almoco[iso(7)] === '12:00', 'copiar almoço da semana anterior: ' + c.copiados + ' copiados');
c = api.copiarSemanaQuadro(q.id, 'home', seg, prox);
ok(c.dados.pessoas.find(p => p.nome === 'Ana Souza').home.includes(iso(8)), 'copiar home para a próxima semana');
ok(/diferente/.test(erro(() => api.copiarSemanaQuadro(q.id, 'home', seg, seg)) || ''), 'copiar para a mesma semana é recusado');
ok(/home ou almoço/.test(erro(() => api.copiarSemanaQuadro(q.id, 'x', seg, prox)) || ''), 'tipo de cópia inválido é recusado');
// permissões
__setEmail('bruno.lima@t.com');
ok(!erro(() => api.definirAlmoco(q.id, 'Ana Souza', seg, '12:00')), 'Membro ajusta almoço do quadro');
ok(/Só o dono/.test(erro(() => api.salvarConfigDiaria(q.id, { equipe: [] })) || ''), 'Membro não configura as escalas');
__setEmail('marina.reis@t.com');
ok(/permissão/.test(erro(() => api.definirAlmoco(q.id, 'Ana Souza', seg, '12:00')) || ''), 'Leitor não ajusta');
ok(api.obterEscalaDiaria(q.id, seg).podeEditar === false, 'Leitor só visualiza');
// quadro privado: fora de quem não vê
__setEmail('ana.souza@t.com');
const priv = api.criarQuadro({ nome: 'Privado', visibilidade: 'Privado', membros: ['bruno.lima@t.com'] }).quadro;
ok(api.obterEscalaDiaria(priv.id, seg).pessoas.map(p => p.nome).sort().join() === 'Ana Souza,Bruno Lima' || api.obterEscalaDiaria(priv.id, seg).pessoas.length <= 3, 'quadro privado: equipe só de quem vê');
console.log('   equipe do privado:', api.obterEscalaDiaria(priv.id, seg).pessoas.map(p => p.nome).join(', '));
__setEmail('diego.alves@t.com');
ok(/não encontrado/i.test(erro(() => api.obterEscalaDiaria(priv.id, seg)) || ''), 'quem não vê o quadro privado não acessa a escala');
console.log(falhas ? falhas + ' FALHA(S)' : 'TUDO OK');

(function(){ var v = __ilegais(); var u = {}; v.forEach(function(x){ u[x]=1; }); var ks = Object.keys(u); console.log(ks.length ? 'RETORNO ILEGAL PARA A TELA (' + ks.length + '): ' + ks.slice(0,6).join(' | ') : 'nenhum retorno ilegal para google.script.run'); })();
