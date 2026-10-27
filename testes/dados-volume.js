// Dados em volume realista: 6 quadros, 24 listas, 600 cartões, 1200 itens de checklist, 800 comentários, 6000 linhas de log, 12 usuários
JSON.parse(__fs.readFileSync(__env.CFG,'utf8')).forEach(r => __sheets.Config.appendRow(r));
var nomes = ['Ana Souza','Carla Mendes','Diego Alves','Bruno Lima','Marina Reis','Paulo Dias','Rita Gomes','Tiago Melo','Lara Pinto','Caio Rocha','Vera Luz','Iago Felipe'];
var agora = new Date();
nomes.forEach(function (n, i) { __sheets.Usuarios.appendRow([n.toLowerCase().replace(' ', '.') + '@teste.com', n, i === 0 ? 'ADM' : 'Membro', 'Sim', agora, '']); });
var pad = function (n, p) { return p + '-' + String(n).padStart(4, '0'); };
var cabQ = __sheets.Quadros.d[0], cabL = __sheets.Listas.d[0], cabC = __sheets.Cartoes.d[0], cabK = __sheets.Checklist.d[0], cabM = __sheets.Comentarios.d[0];
function linha(cab, o) { return cab.map(function (h) { return o[h] === undefined ? '' : o[h]; }); }
var ql = 0, cart = 0, chk = 0, com = 0;
for (var q = 1; q <= 6; q++) {
  __sheets.Quadros.appendRow(linha(cabQ, { ID: pad(q, 'QD'), Nome: 'Quadro ' + q, Cor: '#3B5BDB', Dono: 'ana.souza@teste.com', Visibilidade: 'Equipe', Ordem: q * 10, Ativo: 'Sim', Criado_em: agora, Criado_por: 'Ana Souza', Atualizado_em: agora }));
  for (var l = 1; l <= 4; l++) {
    ql++;
    __sheets.Listas.appendRow(linha(cabL, { ID: pad(ql, 'LS'), Quadro_ID: pad(q, 'QD'), Nome: 'Lista ' + l, Ordem: l * 1000, Ativo: 'Sim', Criado_em: agora, Criado_por: 'Ana Souza' }));
    for (var c = 1; c <= 25; c++) {
      cart++;
      __sheets.Cartoes.appendRow(linha(cabC, { ID: pad(cart, 'CT'), Quadro_ID: pad(q, 'QD'), Lista_ID: pad(ql, 'LS'), Titulo: 'Cartão ' + cart + ' do quadro ' + q, Descricao: 'Descrição do cartão ' + cart, Responsaveis: nomes[cart % 12], Prioridade: 'Média', Ordem: c * 1000, Concluido: 'Não', Ativo: 'Sim', Criado_em: agora, Criado_por: 'Ana Souza', Atualizado_em: agora, Atualizado_por: 'Ana Souza' }));
      for (var k = 0; k < 2; k++) { chk++; __sheets.Checklist.appendRow(linha(cabK, { ID: pad(chk, 'CK'), Cartao_ID: pad(cart, 'CT'), Texto: 'Item ' + k, Feito: 'Não', Ordem: (k + 1) * 1000, Ativo: 'Sim', Criado_em: agora, Criado_por: 'Ana Souza' })); }
      if (cart % 3 === 0) { com++; __sheets.Comentarios.appendRow(linha(cabM, { ID: pad(com, 'CM'), Cartao_ID: pad(cart, 'CT'), Autor: 'Ana Souza', Autor_email: 'ana.souza@teste.com', Texto: 'Comentário', Ativo: 'Sim', Criado_em: agora })); }
    }
  }
}
for (var i = 0; i < 6000; i++) __sheets.Log.appendRow([agora, 'ana.souza@teste.com', 'Moveu cartão', 'Cartão', pad(i % 600 + 1, 'CT'), pad(i % 6 + 1, 'QD'), 'detalhe']);
__setEmail('ana.souza@teste.com');
function medir(nome, fn) {
  __zerar(); var t0 = Date.now(), r, erro = '';
  try { r = fn(); } catch (e) { erro = ' ERRO: ' + e.message; }
  var cpu = Date.now() - t0, o = Object.assign({}, __ops);
  var det = Object.keys(o).filter(function (k) { return o[k]; }).map(function (k) { return k + '=' + o[k]; }).join(' ');
  console.log((nome + '                              ').slice(0, 30) + String(Math.round(__custo())).padStart(6) + ' ms est. | ' + det + erro);
  return r;
}
