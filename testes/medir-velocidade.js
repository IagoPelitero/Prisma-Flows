eval(__fs.readFileSync(__env.SEED, 'utf8'));
console.log('--- custo estimado por chamada (modelo Apps Script: leitura de tabela ~180ms, escrita ~90ms, propriedades ~45ms) ---');
var Q = 'QD-0001', ct = 'CT-0001'; api.iniciar();  // aquecimento: a 1ª abertura após trocar a versão ajusta a estrutura uma única vez
medir('iniciar', function () { return api.iniciar(); });
medir('obterVersao', function () { return api.obterVersao(Q); });
var o = medir('obterQuadro (100 cartões)', function () { return api.obterQuadro(Q); });
medir('obterDetalheCartao', function () { return api.obterDetalheCartao(ct); });
medir('criarCartao', function () { return api.criarCartao('LS-0001', 'Novo'); });
medir('atualizarCartao (prioridade)', function () { return api.atualizarCartao(ct, { prioridade: 'Alta' }); });
medir('moverCartao', function () { return api.moverCartao(ct, 'LS-0002', null); });
medir('adicionarItemChecklist', function () { return api.adicionarItemChecklist(ct, 'item novo'); });
medir('adicionarComentario', function () { return api.adicionarComentario(ct, 'oi'); });
try { medir('duplicarCartao', function () { return api.duplicarCartao(ct); }); } catch (e) {}
medir('arquivarCartao', function () { return api.arquivarCartao('CT-0005', true); });
medir('criarQuadro', function () { return api.criarQuadro({ nome: 'Novo' }); });
medir('obterEscala', function () { return api.obterEscala(Q, 'atual'); });
medir('meusCartoes', function () { return api.meusCartoes(); });
medir('obterEquipeSemana', function () { return api.obterEquipeSemana(''); });
