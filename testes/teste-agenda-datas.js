// Testes de propriedades das funções internas de agenda (chamadas diretamente, sem a camada api)
var X = __novo();
var falhas = 0;
function ok(c, m) { console.log(c ? 'OK  ' : 'FALHA', m); if (!c) falhas++; }
function iso(d) { return d.toISOString().slice(0, 10); }
function add(d, n) { var x = new Date(d.getTime()); x.setUTCDate(x.getUTCDate() + n); return x; }
function dow(d) { var w = d.getUTCDay(); return w === 0 ? 7 : w; }          // 1=seg..7=dom
var feriadosTxt = '01/01, 21/04, 01/05, 07/09, 12/10, 02/11, 15/11, 25/12, 05/03/2027, 17/06/2026';
var fer = X.lerFeriados_({ FERIADOS: feriadosTxt });
function ehFer(d) { return fer.datas[iso(d)] || fer.anuais[iso(d).slice(5)]; }
function util(d) { return dow(d) <= 5 && !ehFer(d); }
function ultimoDia(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }
function proxUtil(d, p) { var x = d; for (var i = 0; i < 15; i++) { if (util(x)) return x; x = add(x, p); } return d; }

// ---- ocorreEm_: todas as datas de 2026 a 2028 contra implementação de referência
var inicio = new Date(Date.UTC(2026, 0, 1)), fim = new Date(Date.UTC(2028, 11, 31));
function cfgBase(o) { return Object.assign({ tipo: 'mensal', dias: [], diaMes: null, ajuste: 'manter', inicio: '', fim: '' }, o); }
var casos = [
  ['diária', cfgBase({ tipo: 'diaria' }), function () { return true; }],
  ['dias úteis', cfgBase({ tipo: 'uteis' }), function (d) { return util(d); }],
  ['semanal 2,4', cfgBase({ tipo: 'semanal', dias: [2, 4] }), function (d) { return [2, 4].indexOf(dow(d)) !== -1; }],
  ['semanal só dom (7)', cfgBase({ tipo: 'semanal', dias: [7] }), function (d) { return dow(d) === 7; }]
];
[1, 5, 15, 28, 29, 30, 31].forEach(function (n) {
  ['manter', 'proximo', 'anterior'].forEach(function (aj) {
    casos.push(['mensal dia ' + n + ' / ' + aj, cfgBase({ diaMes: { tipo: 'n', n: n }, ajuste: aj }), function (d) {
      var y = d.getUTCFullYear(), m = d.getUTCMonth() + 1;
      for (var k = -1; k <= 1; k++) {
        var ref = new Date(Date.UTC(y, m - 1 + k, 1)); var yy = ref.getUTCFullYear(), mm = ref.getUTCMonth() + 1;
        var alvo = new Date(Date.UTC(yy, mm - 1, Math.min(n, ultimoDia(yy, mm))));
        if (aj === 'proximo') alvo = proxUtil(alvo, 1); else if (aj === 'anterior') alvo = proxUtil(alvo, -1);
        if (iso(alvo) === iso(d)) return true;
      }
      return false;
    }]);
  });
});
casos.push(['mensal último dia', cfgBase({ diaMes: { tipo: 'ultimo' } }), function (d) { return d.getUTCDate() === ultimoDia(d.getUTCFullYear(), d.getUTCMonth() + 1); }]);
casos.push(['mensal 1º dia útil', cfgBase({ diaMes: { tipo: 'primeiro_util' } }), function (d) {
  var f = proxUtil(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)), 1); return iso(f) === iso(d) && f.getUTCMonth() === d.getUTCMonth(); }]);
casos.push(['mensal último dia útil', cfgBase({ diaMes: { tipo: 'ultimo_util' } }), function (d) {
  var f = proxUtil(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), ultimoDia(d.getUTCFullYear(), d.getUTCMonth() + 1))), -1); return iso(f) === iso(d); }]);
casos.push(['com início e fim', cfgBase({ tipo: 'diaria', inicio: '2026-06-10', fim: '2026-06-20' }), function (d) { return iso(d) >= '2026-06-10' && iso(d) <= '2026-06-20'; }]);
casos.forEach(function (c) {
  var erros = [];
  for (var d = inicio; d <= fim; d = add(d, 1)) {
    var got = X.ocorreEm_(c[1], iso(d), fer), esp = !!c[2](d);
    if (got !== esp) { erros.push(iso(d) + ' (obtido ' + got + ', esperado ' + esp + ')'); if (erros.length > 3) break; }
  }
  ok(!erros.length, 'ocorreEm_ ' + c[0] + (erros.length ? ' -> ' + erros.join('; ') : ''));
});

// ---- gerarEscala_: invariantes
var viol = [];
[[1, [0]], [2, [0]], [3, [0, 0]], [4, [2, 2]], [5, [0, 0]], [7, [2, 0, 0]], [6, [3, 3]], [3, [5]], [8, [0, 0, 0]], [10, [1, 1, 1]], [2, [0, 0, 0]]].forEach(function (cfg) {
  var N = cfg[0], vagas = cfg[1], equipe = [], frentes = [];
  for (var i = 0; i < N; i++) equipe.push('P' + i);
  vagas.forEach(function (v, i) { frentes.push({ id: 'F' + i, vagas: v }); });
  var tam = X.tamanhosFrentes_(N, vagas);
  var soma = tam.reduce(function (a, b) { return a + b; }, 0);
  if (soma !== N) viol.push('N=' + N + ' vagas=' + vagas + ' tamanhos somam ' + soma);
  var visitas = {}; equipe.forEach(function (p) { visitas[p] = {}; });
  for (var w = 0; w < 2 * N + 3; w++) {
    var s = X.gerarEscala_(equipe, frentes, w);
    if (s.length !== N) viol.push('semana ' + w + ' N=' + N + ': ' + s.length + ' linhas');
    var vistos = {}; s.forEach(function (x) { vistos[x.pessoa] = (vistos[x.pessoa] || 0) + 1; visitas[x.pessoa][x.frenteId] = 1; });
    if (Object.keys(vistos).length !== N || Object.keys(vistos).some(function (k) { return vistos[k] !== 1; })) viol.push('pessoa repetida/ausente N=' + N + ' sem ' + w);
    frentes.forEach(function (f, fi) {
      var daf = s.filter(function (x) { return x.frenteId === f.id; }).map(function (x) { return x.posicao; }).sort();
      if (daf.length !== tam[fi] || daf.some(function (p, k) { return p !== k + 1; })) viol.push('posições inválidas frente ' + f.id + ' N=' + N + ' vagas=' + vagas + ' sem ' + w + ': ' + daf);
    });
  }
  // justiça: em 2N semanas toda pessoa passa por toda frente com vaga
  if (F = frentes.length, tam.filter(function (t) { return t > 0; }).length > 1) {
    equipe.forEach(function (p) { if (Object.keys(visitas[p]).length < tam.filter(function (t) { return t > 0; }).length) viol.push('N=' + N + ' vagas=' + vagas + ': ' + p + ' nunca passou por todas as frentes'); });
  }
});
ok(!viol.length, 'gerarEscala_: todas as pessoas, tamanhos, posições e rodízio justo' + (viol.length ? ' -> ' + viol.slice(0, 4).join(' | ') : ''));

// ---- datas e semanas
ok(X.segundaDe_('2026-10-25') === '2026-10-19' && X.segundaDe_('2026-10-26') === '2026-10-26' && X.segundaDe_('2026-10-31') === '2026-10-26', 'segundaDe_: domingo volta para a segunda anterior');
ok(X.somarDiasIso_('2026-12-31', 1) === '2027-01-01' && X.somarDiasIso_('2028-02-28', 1) === '2028-02-29' && X.somarDiasIso_('2026-03-01', -1) === '2026-02-28', 'somarDiasIso_: virada de ano e bissexto');
ok(X.diasEntre_('2026-10-26', '2026-11-02') === 7, 'diasEntre_ = 7');
ok(X.numeroSemana_('2024-01-01') === 0 && X.numeroSemana_('2024-01-08') === 1 && X.numeroSemana_('2023-12-25') === -1, 'numeroSemana_ (inclusive antes da referência)');
ok(X.parseMinutos_('2:30') === 150 && X.parseMinutos_('1h15') === 75 && X.parseMinutos_('45min') === 45 && X.parseMinutos_('90') === 0 && X.parseMinutos_('1,5h') === 90 && !X.parseMinutos_('abc') && !X.parseMinutos_('') && !X.parseMinutos_('0'), 'parseMinutos_: formatos aceitos e inválidos');
ok(X.horasTexto_(150) === '2h30' || /2.?h.?30/.test(X.horasTexto_(150)), 'horasTexto_(150) = ' + X.horasTexto_(150));
ok(X.normalizar_('Ação  Médica-Ñ') === 'acaomedican', 'normalizar_ tira acento, espaço e símbolo');
ok(X.textoSeguro_('=1+1') === "'=1+1" && X.textoSeguro_('2026') === "'2026" && X.textoSeguro_('12:00') === "'12:00" && X.textoSeguro_('João') === 'João', 'textoSeguro_ protege fórmula, número e hora');
ok(X.dataIso_('05/10/2026', 'America/Sao_Paulo') === '2026-10-05' && X.dataIso_('2026-10-05T10:00:00', 'x') === '2026-10-05' && X.dataIso_('lixo', 'x') === '', 'dataIso_ lê dd/mm/aaaa, ISO e rejeita lixo');
console.log(falhas ? falhas + ' FALHA(S)' : 'TUDO OK');
