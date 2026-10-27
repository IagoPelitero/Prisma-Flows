JSON.parse(__fs.readFileSync(__env.CFG,'utf8')).forEach(r => __sheets.Config.appendRow(r));
let falhas = 0;
function ok(c, m) { console.log(c ? 'OK  ' : 'FALHA', m); if (!c) falhas++; }
function erro(fn) { try { fn(); return null; } catch (e) { return e.message; } }
const nomes = ['Ana Souza','Bruno Lima','Carla Mendes','Diego Alves','Marina Reis'];
nomes.forEach((n, i) => __sheets.Usuarios.appendRow([n.toLowerCase().replace(' ', '.') + '@t.com', n, i === 0 ? 'ADM' : (i === 4 ? 'Leitor' : 'Membro'), 'Sim', new Date(), '']));
__setEmail('ana.souza@t.com'); api.iniciar();
const q = api.criarQuadro({ nome: 'Atendimento' }).quadro; const o = api.obterQuadro(q.id); const L = o.listas[0].id;
let r = api.salvarConfigEscala(q.id, { ativa: true, frentes: [{ id: L, vagas: '' }], equipe: ['Ana Souza', 'Bruno Lima', 'Carla Mendes', 'Diego Alves'] });
const vez = e => e.frentes[0].proximo;
const fila = r.escala.frentes[0].pessoas.map(p => p.pessoa);
console.log('   fila da semana:', fila.join(' > '), '| na vez:', vez(r.escala));
ok(r.escala.podeEditar === true, 'escala informa que o usuário pode editar (botão de editar a vez)');
// mudar a vez para cada pessoa e conferir
fila.forEach(function (nome) {
  const e = api.definirVezEscala(q.id, L, nome).escala;
  ok(vez(e) === nome, 'vez colocada em ' + nome + ' -> ' + vez(e));
});
// o próximo caso novo vai para quem está na vez
const alvo = fila[2];
api.definirVezEscala(q.id, L, alvo);
let c = api.criarCartao(L, 'Caso 1');
ok(c.distribuidoPara === alvo && c.cartao.responsaveis.join() === alvo, 'caso novo foi para ' + c.distribuidoPara + ' (esperado ' + alvo + ')');
c = api.criarCartao(L, 'Caso 2');
const seguinte = fila[(fila.indexOf(alvo) + 1) % fila.length];
ok(c.distribuidoPara === seguinte, 'depois dele o rodízio segue: ' + c.distribuidoPara + ' (esperado ' + seguinte + ')');
// ordem da semana não muda por causa da vez
ok(api.obterEscala(q.id, 'atual').frentes[0].pessoas.map(p => p.pessoa).join() === fila.join(), 'ordem de atendimento da semana continua a mesma');
// repetir a mesma vez não bagunça
const a1 = api.definirVezEscala(q.id, L, fila[0]).escala, a2 = api.definirVezEscala(q.id, L, fila[0]).escala;
ok(vez(a1) === fila[0] && vez(a2) === fila[0], 'repetir a mesma pessoa mantém a vez');
// ausente hoje
const hoje = new Date(); const iso = hoje.getFullYear() + '-' + String(hoje.getMonth() + 1).padStart(2, '0') + '-' + String(hoje.getDate()).padStart(2, '0');
api.salvarAusencia({ pessoa: fila[1], inicio: iso, fim: iso, motivo: 'Folga' });
ok(/ausente hoje/.test(erro(() => api.definirVezEscala(q.id, L, fila[1])) || ''), 'não deixa colocar na vez quem está ausente hoje');
// erros
ok(/não está/.test(erro(() => api.definirVezEscala(q.id, L, 'Fulano')) || ''), 'pessoa fora da escala é recusada');
ok(/inválida/.test(erro(() => api.definirVezEscala(q.id, 'LS-9999', fila[0])) || ''), 'frente inválida é recusada');
ok(/não encontrado/i.test(erro(() => api.definirVezEscala('QD-9999', L, fila[0])) || ''), 'quadro inexistente é recusado');
// permissões: Membro pode (edita o quadro), Leitor não
__setEmail('bruno.lima@t.com');
ok(!erro(() => api.definirVezEscala(q.id, L, fila[0])), 'Membro consegue mudar a vez');
__setEmail('marina.reis@t.com');
ok(/permissão/.test(erro(() => api.definirVezEscala(q.id, L, fila[0])) || ''), 'Leitor não consegue mudar a vez');
console.log(falhas ? falhas + ' FALHA(S)' : 'TUDO OK');

(function(){ var v = __ilegais(); var u = {}; v.forEach(function(x){ u[x]=1; }); var ks = Object.keys(u); console.log(ks.length ? 'RETORNO ILEGAL PARA A TELA (' + ks.length + '): ' + ks.slice(0,6).join(' | ') : 'nenhum retorno ilegal para google.script.run'); })();
