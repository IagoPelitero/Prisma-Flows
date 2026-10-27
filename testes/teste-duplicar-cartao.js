JSON.parse(__fs.readFileSync(__env.CFG,'utf8')).forEach(r => __sheets.Config.appendRow(r));
let falhas = 0;
function ok(cond, msg) { console.log(cond ? 'OK  ' : 'FALHA', msg); if (!cond) falhas++; }
function erro(fn) { try { fn(); return null; } catch (e) { return e.message; } }

// coluna extra personalizada em Cartoes
__sheets.Cartoes.d[0].push('Numero_Proposta');
const q = api.criarQuadro({ nome: 'Retenção' }).quadro;
let o = api.obterQuadro(q.id);
const L = o.listas[0].id, L2 = o.listas[1].id;
const a = api.criarCartao(L, 'A').cartao, b = api.criarCartao(L, 'B').cartao, c = api.criarCartao(L, 'C').cartao;
api.atualizarCartao(a.id, { descricao: 'Linha 1\nLinha 2', responsaveis: ['Ana', 'Iago'], prazo: '2026-11-05', prioridade: 'Alta', etiquetas: [o.etiquetas[0].id, o.etiquetas[2].id], concluido: true, extras: { Numero_Proposta: '7781' } });
const i1 = api.adicionarItemChecklist(a.id, 'Conferir SUSEP').item, i2 = api.adicionarItemChecklist(a.id, 'Enviar simulação').item;
api.atualizarItemChecklist(i1.id, { feito: true });

const r = api.duplicarCartao(a.id);
const n = r.cartao;
ok(n.id !== a.id && n.listaId === L, 'cópia tem novo ID e fica na mesma lista');
ok(n.titulo === 'A (cópia)', 'título = "' + n.titulo + '"');
ok(n.descricao === 'Linha 1\nLinha 2' && n.prioridade === 'Alta' && n.prazo.startsWith('2026-11-05'), 'descrição, prioridade e prazo copiados (prazo=' + n.prazo + ')');
ok(JSON.stringify(n.responsaveis) === '["Ana","Iago"]', 'responsáveis copiados');
ok(n.etiquetas.length === 2, 'etiquetas copiadas');
ok(n.concluido === false, 'cópia nasce NÃO concluída (original concluído)');
ok(String(n.extras.Numero_Proposta).replace(/^'/, '') === '7781', 'campo adicional copiado: ' + n.extras.Numero_Proposta);
ok(r.checklist.length === 2 && r.checklist.every(i => !i.feito && i.cartaoId === n.id), 'checklist copiado e desmarcado (original tinha 1 feito)');
ok(n.checklist.total === 2 && n.checklist.feitos === 0, 'contagem do checklist na resposta');
o = api.obterQuadro(q.id);
const ordem = o.cartoes.filter(x => x.listaId === L).sort((x, y) => x.ordem - y.ordem).map(x => x.titulo);
ok(JSON.stringify(ordem) === JSON.stringify(['A', 'A (cópia)', 'B', 'C']), 'posição: logo abaixo do original -> ' + JSON.stringify(ordem));
ok(o.checklists[a.id].length === 2 && o.checklists[a.id].some(i => i.feito), 'original intacto (checklist e item feito)');
ok(o.cartoes.find(x => x.id === a.id).concluido === true, 'original continua concluído');
// duplicar a cópia e o último cartão
api.duplicarCartao(n.id); api.duplicarCartao(c.id);
const o2 = api.obterQuadro(q.id);
ok(JSON.stringify(o2.cartoes.filter(x => x.listaId === L).sort((x, y) => x.ordem - y.ordem).map(x => x.titulo)) === JSON.stringify(['A', 'A (cópia)', 'A (cópia) (cópia)', 'B', 'C', 'C (cópia)']), 'duplicar cópia e último cartão mantém a ordem');
// muitas duplicações seguidas no mesmo ponto (força renumeração da ordem)
for (let k = 0; k < 40; k++) api.duplicarCartao(a.id);
const o3 = api.obterQuadro(q.id); const ords = o3.cartoes.filter(x => x.listaId === L).map(x => x.ordem);
ok(new Set(ords).size === ords.length, 'ordens únicas após 40 duplicações no mesmo ponto (' + ords.length + ' cartões)');
ok(o3.cartoes.filter(x => x.listaId === L).sort((x, y) => x.ordem - y.ordem)[1].titulo === 'A (cópia)', 'a cópia mais recente continua logo abaixo do original');
// título longo
const longo = api.criarCartao(L, 'x'.repeat(500)).cartao;
ok(api.duplicarCartao(longo.id).cartao.titulo.length <= 500, 'título longo não passa de 500 caracteres');
// regras
api.arquivarCartao(b.id, true);
ok(/Restaure/.test(erro(() => api.duplicarCartao(b.id))), 'cartão arquivado não duplica: ' + erro(() => api.duplicarCartao(b.id)));
ok(/não encontrado/i.test(erro(() => api.duplicarCartao('CT-9999'))), 'ID inexistente dá erro claro');
ok(!!erro(() => api.duplicarCartao('')), 'ID vazio dá erro');
// perfil Leitor não pode
__sheets.Usuarios.appendRow(['leitor@teste.com', 'Leitora', 'Leitor', 'Sim', new Date(), '']);
__setEmail('leitor@teste.com');
ok(/permiss/i.test(erro(() => api.duplicarCartao(a.id)) || ''), 'Leitor é bloqueado: ' + erro(() => api.duplicarCartao(a.id)));
// log
const acoes = __sheets.Log.d.map(r => r[2]);
ok(acoes.includes('Duplicou cartão'), 'ação registrada no Log');
console.log(falhas ? falhas + ' FALHA(S)' : 'TUDO OK');

(function(){ var v = __ilegais(); var u = {}; v.forEach(function(x){ u[x]=1; }); var ks = Object.keys(u); console.log(ks.length ? 'RETORNO ILEGAL PARA A TELA (' + ks.length + '): ' + ks.slice(0,6).join(' | ') : 'nenhum retorno ilegal para google.script.run'); })();
