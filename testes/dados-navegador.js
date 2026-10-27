JSON.parse(__fs.readFileSync(__env.CFG,'utf8')).forEach(r => __sheets.Config.appendRow(r));
['Ana Souza','Bruno Lima','Carla Mendes','Diego Alves','Marina Reis'].forEach((n, i) =>
  __sheets.Usuarios.appendRow([n.toLowerCase().replace(' ', '.') + '@t.com', n, i === 0 ? 'ADM' : (i === 4 ? 'Leitor' : 'Membro'), 'Sim', new Date(), '']));
__setEmail('ana.souza@t.com'); api.iniciar();
const q = api.criarQuadro({ nome: 'Atendimento', descricao: 'Plantão de ligações' }).quadro;
const L = api.obterQuadro(q.id).listas[0].id;
api.salvarConfigEscala(q.id, { ativa: true, frentes: [{ id: L, vagas: '' }], equipe: ['Ana Souza', 'Bruno Lima', 'Carla Mendes', 'Diego Alves'] });
const c = api.criarCartao(L, 'Cartão que já existia').cartao;
console.log('seed ok: quadro', q.id, 'lista', L, 'cartão', c.id);
