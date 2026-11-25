JSON.parse(__fs.readFileSync(__env.CFG,'utf8')).forEach(r => __sheets.Config.appendRow(r));
['Ana Souza','Bruno Lima','Carla Mendes','Diego Alves','Marina Reis'].forEach((n, i) =>
  __sheets.Usuarios.appendRow([n.toLowerCase().replace(' ', '.') + '@t.com', n, i === 0 ? 'ADM' : (i === 4 ? 'Leitor' : 'Membro'), 'Sim', new Date(), '']));
__setEmail('ana.souza@t.com'); api.iniciar();
const q = api.criarQuadro({ nome: 'Atendimento', descricao: 'Plantão de ligações' }).quadro;
const L = api.obterQuadro(q.id).listas[0].id;
api.salvarConfigEscala(q.id, { ativa: true, frentes: [{ id: L, vagas: '' }], equipe: ['Ana Souza', 'Bruno Lima', 'Carla Mendes', 'Diego Alves'] });
const c = api.criarCartao(L, 'Cartão que já existia').cartao;
// Carrossel antigo nesse cartão (desde a 1.6.0 a tela não cria carrossel novo; os que já existiam continuam funcionando)
(function () {
  const cab = __sheets.Carrossel.d[0];
  __sheets.Carrossel.appendRow(cab.map(h => ({ ID: 'CR-0001', Cartao_ID: c.id, Pessoa: 'Ana Souza', Texto: 'ramal 2201', Ordem: 1000, Atendimentos: 0, Ativo: 'Sim' })[h] ?? ''));
  const cc = __sheets.Cartoes.d[0];
  const linha = __sheets.Cartoes.d.find(r => r[cc.indexOf('ID')] === c.id);
  linha[cc.indexOf('Carrossel_Total')] = 1; linha[cc.indexOf('Carrossel_Vez')] = 'Ana Souza';
})();
console.log('seed ok: quadro', q.id, 'lista', L, 'cartão', c.id);
