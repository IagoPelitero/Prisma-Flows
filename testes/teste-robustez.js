eval(__fs.readFileSync(__env.SEED, 'utf8'));
__sheets.Usuarios.appendRow(['leitor@teste.com', 'Leitor Teste', 'Leitor', 'Sim', new Date(), '']);
// semeia um pouco de tudo para chegar fundo no código
__setEmail('ana.souza@teste.com');
api.iniciar();
var q = 'QD-0001', L = 'LS-0001', ct = 'CT-0001';
api.salvarConfigEscala(q, { ativa: true, frentes: [{ id: L, vagas: 2 }], equipe: ['Ana Souza', 'Bruno Lima', 'Carla Mendes'] });
api.adicionarComentario(ct, 'comentário'); api.salvarEtiqueta(q, { nome: 'Teste', cor: '#112233' });
api.salvarRotina({ nome: 'Rotina {mes}', quadroId: q, listaId: L, frequencia: 'Dias úteis', ativo: true });
api.solicitarHoras({ tipo: 'Crédito', data: '2026-10-05', duracao: '1h', descricao: 'x' });
api.adicionarParticipante(ct, 'Ana Souza', 'x');
var nomes = Object.keys(__novo()).filter(function (k) { return /^[a-z][A-Za-z0-9]*$/.test(k) && typeof __novo()[k] === 'function'; });
var pular = { doGet: 1, onOpen: 1, onEdit: 1, mostrarLink: 1, prepararEstrutura: 1, ativarRotinasDiarias: 1, ativarGatilhoRotinas: 1, desativarGatilhoRotinas: 1, gerarRotinasDoDia: 1 };
var pool = [undefined, null, '', ' ', 'x', 'QD-0001', 'CT-0001', 'LS-0001', 'ET-0001', 'CK-0001', 'CM-0001', 'RT-0001', 'CR-0001', 0, -1, 1e9, NaN, true, false, {}, [], { nome: {} }, { a: 1 }, 'a'.repeat(60000), '=1+1', "'", '<script>alert(1)</script>', { titulo: null, nome: null }, [null], [{}], '2026-02-30', '31/12/2026', { dia: 'x' }];
var achados = {}, total = 0, lentos = [];
function nomeTipo(e) { return e && e.name || typeof e; }
function classificar(fn, args, e) {
  var msg = String(e && e.message || e);
  var interno = /TypeError|ReferenceError|RangeError|SyntaxError/.test(nomeTipo(e)) || /Cannot read|is not a function|is not defined|undefined|is not iterable|null/.test(msg) && !/Dê um|não|Não|inválid|permiss|Escolha|Escreva/.test(msg);
  if (!interno) return;
  var chave = fn + ' :: ' + msg.slice(0, 90);
  if (!achados[chave]) achados[chave] = { n: 0, ex: args.map(function (a) { return typeof a === 'string' && a.length > 30 ? '[str ' + a.length + ']' : JSON.stringify(a); }).join(', ') };
  achados[chave].n++;
}
var emails = ['ana.souza@teste.com', 'leitor@teste.com'];
nomes.forEach(function (fn) {
  if (pular[fn]) return;
  var n = __novo()[fn].length || 1;
  emails.forEach(function (em) {
    __setEmail(em);
    pool.forEach(function (v) {
      [[v, v, v, v], ['QD-0001', v, v, v], ['CT-0001', v, v, v], ['LS-0001', v, v, v], [v, 'QD-0001', v, v], [v, v, 'LS-0001', v]].forEach(function (args) {
        args = args.slice(0, Math.max(n, 1));
        total++;
        var t0 = Date.now();
        try { api[fn].apply(null, args); } catch (e) { classificar(fn, args, e); }
        var dt = Date.now() - t0; if (dt > 1500) lentos.push(fn + ' ' + dt + 'ms');
      });
    });
  });
});
console.log('funções testadas:', nomes.length - Object.keys(pular).length, '| chamadas:', total);
var ks = Object.keys(achados);
console.log(ks.length ? ks.length + ' tipo(s) de falha interna:' : 'nenhuma falha interna (todos os erros foram mensagens claras)');
ks.forEach(function (k) { console.log(' -', k, '| x' + achados[k].n, '| ex.:', achados[k].ex.slice(0, 110)); });
var v = __violacoes(); var cont = {}; v.forEach(function (x) { cont[x] = (cont[x] || 0) + 1; });
console.log(Object.keys(cont).length ? 'GRAVAÇÕES PERIGOSAS (' + v.length + '):' : 'nenhuma gravação perigosa (fórmula, número/data ou texto grande demais)');
Object.keys(cont).slice(0, 25).forEach(function (k) { console.log(' -', k, 'x' + cont[k]); });
if (lentos.length) console.log('chamadas lentas:', lentos.slice(0, 5).join('; '));

(function(){ var v = __ilegais(); var u = {}; v.forEach(function(x){ u[x]=1; }); var ks = Object.keys(u); console.log(ks.length ? 'RETORNO ILEGAL PARA A TELA (' + ks.length + '): ' + ks.slice(0,6).join(' | ') : 'nenhum retorno ilegal para google.script.run'); })();
