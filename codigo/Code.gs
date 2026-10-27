/**
 * @OnlyCurrentDoc
 *
 * PRISMA FLOWS  (Pelitero Labs)
 * Kanban no estilo Trello feito em Google Sheets + Apps Script.
 *
 * Como funciona:
 * - A planilha é o banco de dados. Cada aba é uma tabela e a linha 1 é o cabeçalho.
 * - O sistema lê as colunas pelo NOME do cabeçalho (sem acento, sem espaço, sem caixa),
 *   então dá para reordenar colunas, incluir colunas novas e editar direto na planilha.
 * - Colunas novas na aba Cartoes aparecem sozinhas no cartão como "Campos adicionais".
 * - Nada é apagado: arquivar só marca Ativo = Não. Voltar para Sim faz a linha reaparecer.
 * - Toda gravação passa por LockService para duas pessoas não pisarem uma na outra.
 */

const SCHEMA_VERSION = '1.3.0';

const ABAS = {
  QUADROS: {
    nome: 'Quadros', prefixo: 'QD',
    colunas: ['ID', 'Nome', 'Descricao', 'Cor', 'Dono', 'Membros', 'Visibilidade', 'Ordem', 'Ativo', 'Criado_em', 'Criado_por', 'Atualizado_em',
      'Escala_Ativa', 'Escala_Equipe', 'Equipe_Dia', 'Almoco_Turnos', 'Almoco_Max']
  },
  LISTAS: {
    nome: 'Listas', prefixo: 'LS',
    colunas: ['ID', 'Quadro_ID', 'Nome', 'Ordem', 'Limite_WIP', 'Ativo', 'Criado_em', 'Criado_por', 'Frente', 'Frente_Vagas']
  },
  CARTOES: {
    nome: 'Cartoes', prefixo: 'CT',
    colunas: ['ID', 'Quadro_ID', 'Lista_ID', 'Titulo', 'Descricao', 'Responsaveis', 'Prazo', 'Prioridade', 'Etiquetas', 'Ordem',
      'Concluido', 'Concluido_em', 'Ativo', 'Criado_em', 'Criado_por', 'Atualizado_em', 'Atualizado_por', 'Rotina_ID', 'Rotina_Data',
      'Carrossel_Total', 'Carrossel_Vez']
  },
  ALMOCO: {
    nome: 'Almoco', prefixo: 'AL',
    colunas: ['ID', 'Quadro_ID', 'Data', 'Pessoa', 'Turno', 'Ativo', 'Criado_em', 'Criado_por']
  },
  CARROSSEL: {
    nome: 'Carrossel', prefixo: 'CR',
    colunas: ['ID', 'Cartao_ID', 'Pessoa', 'Texto', 'Ordem', 'Atendimentos', 'Ultimo_em', 'Ultimo_por', 'Ativo', 'Criado_em', 'Criado_por']
  },
  CHECKLIST: {
    nome: 'Checklist', prefixo: 'CK',
    colunas: ['ID', 'Cartao_ID', 'Texto', 'Feito', 'Ordem', 'Ativo', 'Criado_em', 'Criado_por', 'Feito_em', 'Feito_por']
  },
  COMENTARIOS: {
    nome: 'Comentarios', prefixo: 'CM',
    colunas: ['ID', 'Cartao_ID', 'Autor', 'Autor_email', 'Texto', 'Ativo', 'Criado_em']
  },
  ETIQUETAS: {
    nome: 'Etiquetas', prefixo: 'ET',
    colunas: ['ID', 'Quadro_ID', 'Nome', 'Cor', 'Ativo']
  },
  USUARIOS: {
    nome: 'Usuarios',
    colunas: ['Email', 'Nome', 'Perfil', 'Ativo', 'Criado_em', 'Home_Dias']
  },
  CONFIG: {
    nome: 'Config',
    colunas: ['Chave', 'Valor', 'Descricao']
  },
  ESCALA: {
    nome: 'Escala', prefixo: 'ES',
    colunas: ['ID', 'Quadro_ID', 'Semana', 'Lista_ID', 'Pessoa', 'Posicao', 'Recebidos', 'Sequencia_vez', 'Ultimo_em', 'Origem', 'Ativo']
  },
  AUSENCIAS: {
    nome: 'Ausencias', prefixo: 'AU',
    colunas: ['ID', 'Pessoa', 'Inicio', 'Fim', 'Motivo', 'Ativo', 'Criado_em', 'Criado_por']
  },
  ROTINAS: {
    nome: 'Rotinas', prefixo: 'RT',
    colunas: ['ID', 'Nome', 'Quadro_ID', 'Lista_ID', 'Frequencia', 'Dias_Semana', 'Dia_Mes', 'Se_nao_util', 'Inicio', 'Fim',
      'Descricao', 'Link', 'Checklist', 'Etiquetas', 'Prioridade', 'Responsavel_Modo', 'Responsavel', 'Prazo_Dias', 'Ativo',
      'Ultima_Geracao', 'Ultimo_Aviso', 'Criado_em', 'Criado_por', 'Atualizado_em']
  },
  PRESENCA: {
    nome: 'Presenca', prefixo: 'PR',
    colunas: ['ID', 'Email', 'Pessoa', 'Data', 'Tipo', 'Ativo', 'Criado_em', 'Criado_por']
  },
  BANCO_HORAS: {
    nome: 'BancoHoras', prefixo: 'BH',
    colunas: ['ID', 'Email', 'Pessoa', 'Data', 'Tipo', 'Minutos', 'Descricao', 'Status', 'Solicitado_por', 'Solicitado_em',
      'Decidido_por', 'Decidido_em', 'Resposta', 'Ativo']
  },
  LOG: {
    nome: 'Log',
    colunas: ['Data_hora', 'Usuario', 'Acao', 'Entidade', 'Entidade_ID', 'Quadro_ID', 'Detalhe']
  }
};

const CONFIG_PADRAO = [
  ['NOME_SISTEMA', 'Prisma Flows', 'Nome exibido no topo do sistema.'],
  ['SUBTITULO', 'Quadros', 'Texto menor ao lado do nome.'],
  ['ACESSO_LIVRE', 'Não', 'Sim = quem abrir o link entra sozinho com o PERFIL_PADRAO. Não = só quem estiver na aba Usuarios.'],
  ['PERFIL_PADRAO', 'Membro', 'Perfil de quem entra pelo acesso livre: Membro ou Leitor.'],
  ['LISTAS_PADRAO', 'A fazer;Fazendo;Feito', 'Listas criadas em todo quadro novo, separadas por ponto e vírgula.'],
  ['ETIQUETAS_PADRAO', 'Verde:#2F9E44;Amarelo:#E0A100;Laranja:#E8590C;Vermelho:#D63939;Roxo:#7048E8;Azul:#1C6ED4', 'Etiquetas criadas em todo quadro novo, no formato Nome:#cor separadas por ponto e vírgula.'],
  ['ATUALIZAR_SEGUNDOS', '30', 'De quantos em quantos segundos a tela confere se alguém mexeu no quadro.'],
  ['FERIADOS', '', 'Datas que não contam como dia útil (rotinas e escala de home), separadas por vírgula ou ponto e vírgula. Use dd/mm/aaaa, ou dd/mm para valer todo ano.'],
  ['HOME_DIAS_PADRAO', '2', 'Quantos dias de home por semana cada pessoa tem, quando não houver um número próprio na coluna Home_Dias da aba Usuarios.'],
  ['MIN_PRESENCIAIS_DIA', '', 'Mínimo de pessoas presenciais por dia. Se ficar abaixo, a grade da Equipe avisa. Em branco = sem aviso.']
];

const PERFIS = ['ADM', 'Membro', 'Leitor'];
const LIMITE_CARROSSEL = 60;
const TURNOS_ALMOCO_PADRAO = ['11:30', '12:00', '12:30', '13:00'];
const PRIORIDADES = ['Baixa', 'Média', 'Alta', 'Urgente'];
const COR_QUADRO_PADRAO = '#3B5BDB';
const FORMATO_DATA = { Prazo: 'dd/mm/yyyy', Semana: 'dd/mm/yyyy', Inicio: 'dd/mm/yyyy', Fim: 'dd/mm/yyyy', Ultima_Geracao: 'dd/mm/yyyy', Rotina_Data: 'dd/mm/yyyy', Data: 'dd/mm/yyyy' };
const FORMATO_DATA_HORA = 'dd/mm/yyyy hh:mm';
const LIMITE_LOG_LEITURA = 4000;
const MOTIVOS_AUSENCIA = ['Folga', 'Férias', 'Treinamento', 'Outro'];
const SEGUNDA_ZERO = '2024-01-01'; // uma segunda-feira: referência para numerar as semanas do rodízio
const FREQUENCIAS = ['Diária', 'Dias úteis', 'Semanal', 'Mensal'];
const DIAS_MES_ESPECIAIS = ['Último dia', 'Primeiro dia útil', 'Último dia útil'];
const AJUSTES_NAO_UTIL = ['Manter o dia', 'Próximo dia útil', 'Dia útil anterior'];
const MODOS_RESPONSAVEL = ['Ninguém', 'Pessoa fixa', 'Na vez'];
const TIPOS_HORAS = ['Crédito', 'Débito'];
const GATILHO_FUNCAO = 'gerarRotinasDoDia';
const GATILHO_HORA = 6;
const LIMITE_MINUTOS_BANCO = 999 * 60;
const USUARIO_SISTEMA = { email: 'rotinas@sistema', nome: 'Rotinas', perfil: 'ADM' };

let TRAVA_ATIVA_ = false;

/* Cache só da execução atual (cada chamada do navegador começa vazia). Cada aba é lida uma vez por chamada.
   É limpo ao pegar a trava, para quem grava sempre enxergar o que outras pessoas gravaram até agora. */
let CACHE_TABELAS_ = {};
let CACHE_ABAS_ = {};
let CACHE_LOG_ = null;
let PLANILHA_ = null;
let FUSO_ = '';

function limparCache_() {
  CACHE_TABELAS_ = {};
  CACHE_LOG_ = null;
}

/* =========================================================================
 * WEB APP E MENU
 * ========================================================================= */

function doGet(e) {
  garantirEstrutura_();
  const cfg = lerConfig_();
  const t = HtmlService.createTemplateFromFile('Index');
  t.nomeSistema = cfg.NOME_SISTEMA || 'Prisma Flows';
  t.quadroInicial = String((e && e.parameter && e.parameter.quadro) || '').replace(/[^A-Za-z0-9-]/g, '');
  return t.evaluate()
    .setTitle(t.nomeSistema)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function incluir_(nome) {
  return HtmlService.createHtmlOutputFromFile(nome).getContent();
}

function onOpen() {
  try {
    SpreadsheetApp.getUi().createMenu('Prisma Flows')
      .addItem('Preparar / conferir estrutura', 'prepararEstrutura')
      .addItem('Ativar rotinas diárias', 'ativarRotinasDiarias')
      .addItem('Ver link do sistema', 'mostrarLink')
      .addToUi();
  } catch (err) { /* aberto fora da planilha */ }
}

/** Edição manual na planilha: avisa as telas abertas para recarregarem. */
function onEdit(e) {
  try {
    PropertiesService.getScriptProperties().setProperty('v_planilha', String(Date.now()));
  } catch (err) { /* gatilho simples sem permissão: ignora */ }
}

function prepararEstrutura() {
  garantirEstrutura_(true);
  try { SpreadsheetApp.getActive().toast('Abas e colunas conferidas.', 'Prisma Flows'); } catch (err) { /* sem interface */ }
}

function mostrarLink() {
  let url = '';
  try { url = ScriptApp.getService().getUrl(); } catch (err) { url = ''; }
  const ui = SpreadsheetApp.getUi();
  ui.alert('Link do sistema', url ? url : 'Ainda não publicado. Vá em Implantar > Nova implantação > App da Web.', ui.ButtonSet.OK);
}

/* =========================================================================
 * API — INÍCIO
 * ========================================================================= */

function iniciar() {
  let u;
  try {
    garantirEstrutura_();
    u = usuarioAtual_();
  } catch (err) {
    if (err && err.codigo) return { erro: err.codigo, mensagem: err.message, email: emailBruto_() };
    throw err;
  }
  gerarRotinasSeNecessario_();
  const cfg = lerConfig_();
  return {
    usuario: u,
    config: configParaCliente_(cfg, u),
    usuarios: usuariosAtivos_(),
    quadros: resumoQuadros_(u),
    minhasEscalas: minhasEscalas_(u),
    equipe: resumoEquipe_(u),
    perfis: PERFIS,
    prioridades: PRIORIDADES
  };
}

function obterVersao(quadroId) {
  return versaoAtual_(String(quadroId || ''));
}

/* =========================================================================
 * API — QUADROS
 * ========================================================================= */

function obterQuadro(quadroId) {
  const u = usuarioAtual_();
  const tz = fuso_();
  const q = acharPorId_(lerTabela_('QUADROS'), quadroId);
  if (!q || !ativo_(q.Ativo)) throw new Error('Quadro não encontrado ou arquivado.');
  if (!podeVer_(u, q)) throw new Error('Você não tem acesso a este quadro.');

  const todasListas = lerTabela_('LISTAS').linhas.filter(function (l) { return l.Quadro_ID === q.ID; });
  const listas = todasListas.filter(function (l) { return ativo_(l.Ativo); }).sort(porOrdem_);
  const tc = lerTabela_('CARTOES');
  const cartoesQuadro = cartoesDoQuadro_(tc, q.ID, todasListas);
  const idsCartoes = {};
  cartoesQuadro.forEach(function (x) { idsCartoes[x.c.ID] = true; });

  const checklists = {};
  lerTabela_('CHECKLIST').linhas
    .filter(function (i) { return idsCartoes[i.Cartao_ID] && ativo_(i.Ativo); })
    .sort(porOrdem_)
    .forEach(function (i) {
      (checklists[i.Cartao_ID] = checklists[i.Cartao_ID] || []).push(itemParaCliente_(i));
    });

  const contagemComentarios = {};
  lerTabela_('COMENTARIOS').linhas.forEach(function (m) {
    if (idsCartoes[m.Cartao_ID] && ativo_(m.Ativo)) contagemComentarios[m.Cartao_ID] = (contagemComentarios[m.Cartao_ID] || 0) + 1;
  });

  const ativos = cartoesQuadro.filter(function (x) { return ativo_(x.c.Ativo) && x.lista && ativo_(x.lista.Ativo); });
  const cartoes = ativos.map(function (x) {
    return cartaoParaCliente_(x.c, x.lista.ID, tz, tc.extras, contagemComentarios[x.c.ID] || 0, checklists[x.c.ID] || []);
  }).sort(porOrdemCliente_);

  const etiquetas = lerTabela_('ETIQUETAS').linhas
    .filter(function (e) { return e.Quadro_ID === q.ID && ativo_(e.Ativo); })
    .map(etiquetaParaCliente_);

  return {
    quadro: quadroParaCliente_(q),
    listas: listas.map(listaParaCliente_),
    cartoes: cartoes,
    etiquetas: etiquetas,
    checklists: checklists,
    camposExtras: tc.extras.slice(),
    podeEditar: podeEditar_(u, q),
    podeAdministrar: podeAdministrar_(u, q),
    escala: escalaParaCliente_(u, q, 0, todasListas),
    versao: versaoAtual_(q.ID)
  };
}

function criarQuadro(dados) {
  const u = usuarioAtual_();
  if (u.perfil === 'Leitor') throw new Error('Seu perfil é de leitura e não pode criar quadros.');
  dados = dados || {};
  const nome = textoLimpo_(dados.nome, 120);
  if (!nome) throw new Error('Dê um nome para o quadro.');
  const cfg = lerConfig_();
  return comTrava_(function () {
    const tq = lerTabela_('QUADROS');
    const agora = new Date();
    const q = inserir_(tq, {
      ID: proximoId_(tq),
      Nome: textoSeguro_(nome),
      Descricao: textoSeguro_(textoLimpo_(dados.descricao, 1000)),
      Cor: corValida_(dados.cor) || COR_QUADRO_PADRAO,
      Dono: u.email,
      Membros: listaEmails_(dados.membros).join(', '),
      Visibilidade: visibilidadeValida_(dados.visibilidade),
      Ordem: tq.linhas.length * 10,
      Ativo: 'Sim',
      Criado_em: agora,
      Criado_por: u.nome,
      Atualizado_em: agora
    });
    const tl = lerTabela_('LISTAS');
    inserirVarios_(tl, separarConfig_(cfg.LISTAS_PADRAO).map(function (nomeLista, i) {
      return {
        ID: proximoId_(tl), Quadro_ID: q.ID, Nome: textoSeguro_(textoLimpo_(nomeLista, 80)), Ordem: (i + 1) * 1000,
        Limite_WIP: '', Ativo: 'Sim', Criado_em: agora, Criado_por: u.nome
      };
    }));
    const te = lerTabela_('ETIQUETAS');
    inserirVarios_(te, separarConfig_(cfg.ETIQUETAS_PADRAO).map(function (par) {
      const partes = par.split(':');
      const cor = corValida_(partes[1]);
      if (!cor) return null;
      return { ID: proximoId_(te), Quadro_ID: q.ID, Nome: textoSeguro_(textoLimpo_(partes[0], 40)), Cor: cor, Ativo: 'Sim' };
    }).filter(Boolean));
    registrar_(u, 'Criou quadro', 'Quadro', q.ID, q.ID, nome);
    return resposta_(q.ID, { quadro: quadroParaCliente_(q) });
  });
}

function atualizarQuadro(quadroId, dados) {
  const u = usuarioAtual_();
  dados = dados || {};
  return comTrava_(function () {
    const tq = lerTabela_('QUADROS');
    const q = acharPorId_(tq, quadroId);
    if (!q) throw new Error('Quadro não encontrado.');
    if (!podeAdministrar_(u, q)) throw new Error('Só o dono do quadro ou um ADM pode mudar essas configurações.');
    const campos = {};
    if (dados.nome !== undefined) {
      const nome = textoLimpo_(dados.nome, 120);
      if (!nome) throw new Error('O quadro precisa de um nome.');
      campos.Nome = textoSeguro_(nome);
    }
    if (dados.descricao !== undefined) campos.Descricao = textoSeguro_(textoLimpo_(dados.descricao, 1000));
    if (dados.cor !== undefined) campos.Cor = corValida_(dados.cor) || COR_QUADRO_PADRAO;
    if (dados.visibilidade !== undefined) campos.Visibilidade = visibilidadeValida_(dados.visibilidade);
    if (dados.membros !== undefined) campos.Membros = listaEmails_(dados.membros).join(', ');
    campos.Atualizado_em = new Date();
    gravarCampos_(tq, q, campos);
    registrar_(u, 'Editou quadro', 'Quadro', q.ID, q.ID, Object.keys(campos).filter(function (k) { return k !== 'Atualizado_em'; }).join(', '));
    return resposta_(q.ID, { quadro: quadroParaCliente_(q) });
  });
}

function arquivarQuadro(quadroId, arquivar) {
  const u = usuarioAtual_();
  return comTrava_(function () {
    const tq = lerTabela_('QUADROS');
    const q = acharPorId_(tq, quadroId);
    if (!q) throw new Error('Quadro não encontrado.');
    if (!podeAdministrar_(u, q)) throw new Error('Só o dono do quadro ou um ADM pode arquivar o quadro.');
    gravarCampos_(tq, q, { Ativo: arquivar === false ? 'Sim' : 'Não', Atualizado_em: new Date() });
    registrar_(u, arquivar === false ? 'Restaurou quadro' : 'Arquivou quadro', 'Quadro', q.ID, q.ID, textoDe_(q.Nome));
    return resposta_(q.ID, { quadro: quadroParaCliente_(q) });
  });
}

function listarQuadrosArquivados() {
  const u = usuarioAtual_();
  return lerTabela_('QUADROS').linhas
    .filter(function (q) { return !ativo_(q.Ativo) && podeAdministrar_(u, q); })
    .map(quadroParaCliente_);
}

/* =========================================================================
 * API — LISTAS
 * ========================================================================= */

function criarLista(quadroId, nome) {
  const u = usuarioAtual_();
  const limpo = textoLimpo_(nome, 80);
  if (!limpo) throw new Error('Dê um nome para a lista.');
  return comTrava_(function () {
    const q = exigirQuadroEditavel_(u, quadroId);
    const tl = lerTabela_('LISTAS');
    const irmas = tl.linhas.filter(function (l) { return l.Quadro_ID === q.ID && ativo_(l.Ativo); });
    const maior = irmas.reduce(function (m, l) { return Math.max(m, numOrdem_(l)); }, 0);
    const l = inserir_(tl, {
      ID: proximoId_(tl), Quadro_ID: q.ID, Nome: textoSeguro_(limpo), Ordem: Math.min(maior, 1e8) + 1000,
      Limite_WIP: '', Ativo: 'Sim', Criado_em: new Date(), Criado_por: u.nome
    });
    registrar_(u, 'Criou lista', 'Lista', l.ID, q.ID, limpo);
    return resposta_(q.ID, { lista: listaParaCliente_(l) });
  });
}

function atualizarLista(listaId, dados) {
  const u = usuarioAtual_();
  dados = dados || {};
  return comTrava_(function () {
    const tl = lerTabela_('LISTAS');
    const l = acharPorId_(tl, listaId);
    if (!l) throw new Error('Lista não encontrada.');
    const q = exigirQuadroEditavel_(u, l.Quadro_ID);
    const campos = {};
    if (dados.nome !== undefined) {
      const nome = textoLimpo_(dados.nome, 80);
      if (!nome) throw new Error('A lista precisa de um nome.');
      campos.Nome = textoSeguro_(nome);
    }
    if (dados.limite !== undefined) {
      const n = parseInt(dados.limite, 10);
      campos.Limite_WIP = n > 0 ? n : '';
    }
    gravarCampos_(tl, l, campos);
    registrar_(u, 'Editou lista', 'Lista', l.ID, q.ID, textoDe_(l.Nome));
    return resposta_(q.ID, { lista: listaParaCliente_(l) });
  });
}

function moverLista(listaId, proximoId) {
  const u = usuarioAtual_();
  return comTrava_(function () {
    const tl = lerTabela_('LISTAS');
    const l = acharPorId_(tl, listaId);
    if (!l) throw new Error('Lista não encontrada.');
    const q = exigirQuadroEditavel_(u, l.Quadro_ID);
    const irmas = tl.linhas
      .filter(function (x) { return x.Quadro_ID === q.ID && ativo_(x.Ativo) && x.ID !== l.ID; })
      .sort(porOrdem_);
    const r = reposicionar_(tl, irmas, l, proximoId);
    return resposta_(q.ID, r);
  });
}

function arquivarLista(listaId, arquivar) {
  const u = usuarioAtual_();
  return comTrava_(function () {
    const tl = lerTabela_('LISTAS');
    const l = acharPorId_(tl, listaId);
    if (!l) throw new Error('Lista não encontrada.');
    const q = exigirQuadroEditavel_(u, l.Quadro_ID);
    const campos = { Ativo: arquivar === false ? 'Sim' : 'Não' };
    if (arquivar === false) {
      const maior = tl.linhas
        .filter(function (x) { return x.Quadro_ID === q.ID && ativo_(x.Ativo); })
        .reduce(function (m, x) { return Math.max(m, numOrdem_(x)); }, 0);
      campos.Ordem = Math.min(maior, 1e8) + 1000;
    }
    gravarCampos_(tl, l, campos);
    registrar_(u, arquivar === false ? 'Restaurou lista' : 'Arquivou lista', 'Lista', l.ID, q.ID, textoDe_(l.Nome));
    return resposta_(q.ID, { lista: listaParaCliente_(l) });
  });
}

/* =========================================================================
 * API — CARTÕES
 * ========================================================================= */

function criarCartao(listaId, titulo) {
  const u = usuarioAtual_();
  const limpo = textoLimpo_(titulo, 500);
  if (!limpo) throw new Error('Escreva um título para o cartão.');
  return comTrava_(function () {
    const l = acharPorId_(lerTabela_('LISTAS'), listaId);
    if (!l || !ativo_(l.Ativo)) throw new Error('Lista não encontrada.');
    const q = exigirQuadroEditavel_(u, l.Quadro_ID);
    const tc = lerTabela_('CARTOES');
    const maior = tc.linhas
      .filter(function (c) { return c.Lista_ID === l.ID && ativo_(c.Ativo); })
      .reduce(function (m, c) { return Math.max(m, numOrdem_(c)); }, 0);
    const agora = new Date();
    const c = inserir_(tc, {
      ID: proximoId_(tc), Quadro_ID: q.ID, Lista_ID: l.ID, Titulo: textoSeguro_(limpo), Descricao: '',
      Responsaveis: '', Prazo: '', Prioridade: '', Etiquetas: '', Ordem: Math.min(maior, 1e8) + 1000,
      Concluido: 'Não', Concluido_em: '', Ativo: 'Sim', Criado_em: agora, Criado_por: u.nome,
      Atualizado_em: agora, Atualizado_por: u.nome
    });
    registrar_(u, 'Criou cartão', 'Cartão', c.ID, q.ID, 'Em ' + textoDe_(l.Nome) + ': ' + limpo);
    const resp = {};
    const pessoa = distribuirNaVez_(u, q, l, c, tc);
    resp.cartao = cartaoParaCliente_(c, l.ID, fuso_(), tc.extras, 0, []);
    if (pessoa) {
      resp.distribuidoPara = pessoa;
      resp.escala = escalaParaCliente_(u, q, 0);
    }
    return resposta_(q.ID, resp);
  });
}

function atualizarCartao(cartaoId, dados) {
  const u = usuarioAtual_();
  dados = dados || {};
  return comTrava_(function () {
    const tc = lerTabela_('CARTOES');
    const c = acharPorId_(tc, cartaoId);
    if (!c) throw new Error('Cartão não encontrado.');
    const ctx = contextoCartao_(u, c);
    const tz = fuso_();
    const campos = {};
    const mudou = [];

    if (dados.titulo !== undefined) {
      const t = textoLimpo_(dados.titulo, 500);
      if (!t) throw new Error('O cartão precisa de um título.');
      campos.Titulo = textoSeguro_(t); mudou.push('título');
    }
    if (dados.descricao !== undefined) {
      campos.Descricao = textoSeguro_(textoLimpo_(dados.descricao, 20000, true)); mudou.push('descrição');
    }
    if (dados.responsaveis !== undefined) {
      const nomes = (Array.isArray(dados.responsaveis) ? dados.responsaveis : separar_(dados.responsaveis))
        .map(function (n) { return textoLimpo_(n, 80); }).filter(String);
      campos.Responsaveis = textoSeguro_(unicos_(nomes).join(', '));
      mudou.push('responsáveis: ' + (nomes.join(', ') || 'ninguém'));
    }
    if (dados.prazo !== undefined) {
      const iso = String(dados.prazo || '').trim();
      if (iso && !/^\d{4}-\d{2}-\d{2}$/.test(iso)) throw new Error('Prazo inválido.');
      campos.Prazo = iso ? Utilities.parseDate(iso, tz, 'yyyy-MM-dd') : '';
      mudou.push('prazo: ' + (iso ? iso.split('-').reverse().join('/') : 'sem prazo'));
    }
    if (dados.prioridade !== undefined) {
      campos.Prioridade = prioridadeValida_(dados.prioridade);
      mudou.push('prioridade: ' + (campos.Prioridade || 'nenhuma'));
    }
    if (dados.etiquetas !== undefined) {
      const ids = (Array.isArray(dados.etiquetas) ? dados.etiquetas : separar_(dados.etiquetas))
        .map(function (s) { return String(s).trim(); }).filter(function (s) { return /^[A-Za-z0-9-]+$/.test(s); });
      campos.Etiquetas = unicos_(ids).join(', ');
      mudou.push('etiquetas');
    }
    if (dados.concluido !== undefined) {
      const concluir = dados.concluido === true;
      campos.Concluido = concluir ? 'Sim' : 'Não';
      campos.Concluido_em = concluir ? new Date() : '';
      mudou.push(concluir ? 'marcou como concluído' : 'reabriu');
    }
    if (dados.extras && typeof dados.extras === 'object') {
      Object.keys(dados.extras).forEach(function (cab) {
        if (tc.extras.indexOf(cab) === -1) return;
        campos[cab] = textoSeguro_(textoLimpo_(dados.extras[cab], 5000, true));
        mudou.push(cab);
      });
    }
    if (!mudou.length) throw new Error('Nada para salvar.');
    campos.Atualizado_em = new Date();
    campos.Atualizado_por = u.nome;
    gravarCampos_(tc, c, campos);
    registrar_(u, 'Editou cartão', 'Cartão', c.ID, ctx.quadro.ID, mudou.join('; '));
    return resposta_(ctx.quadro.ID, { cartao: cartaoParaCliente_(c, ctx.lista.ID, tz, tc.extras) });
  });
}

function moverCartao(cartaoId, listaDestinoId, proximoId) {
  const u = usuarioAtual_();
  return comTrava_(function () {
    const tc = lerTabela_('CARTOES');
    const c = acharPorId_(tc, cartaoId);
    if (!c) throw new Error('Cartão não encontrado.');
    const ctx = contextoCartao_(u, c);
    const destino = ctx.listas.filter(function (l) { return l.ID === listaDestinoId && ativo_(l.Ativo); })[0];
    if (!destino) throw new Error('A lista de destino não existe mais neste quadro.');

    const irmaos = cartoesDoQuadro_(tc, ctx.quadro.ID, ctx.listas)
      .filter(function (x) { return x.lista && x.lista.ID === destino.ID && ativo_(x.c.Ativo) && x.c.ID !== c.ID; })
      .map(function (x) { return x.c; })
      .sort(porOrdem_);
    const mudouLista = ctx.lista.ID !== destino.ID;
    const r = reposicionar_(tc, irmaos, c, proximoId, {
      Lista_ID: destino.ID, Quadro_ID: ctx.quadro.ID, Atualizado_em: new Date(), Atualizado_por: u.nome
    });
    if (mudouLista) {
      registrar_(u, 'Moveu cartão', 'Cartão', c.ID, ctx.quadro.ID, 'De ' + textoDe_(ctx.lista.Nome) + ' para ' + textoDe_(destino.Nome));
      const pessoa = distribuirNaVez_(u, ctx.quadro, destino, c, tc);
      if (pessoa) {
        r.distribuidoPara = pessoa;
        r.responsaveis = separar_(c.Responsaveis);
        r.escala = escalaParaCliente_(u, ctx.quadro, 0);
      }
    }
    r.listaId = destino.ID;
    return resposta_(ctx.quadro.ID, r);
  });
}

function arquivarCartao(cartaoId, arquivar) {
  const u = usuarioAtual_();
  return comTrava_(function () {
    const tc = lerTabela_('CARTOES');
    const c = acharPorId_(tc, cartaoId);
    if (!c) throw new Error('Cartão não encontrado.');
    const ctx = contextoCartao_(u, c);
    const campos = { Ativo: arquivar === false ? 'Sim' : 'Não', Atualizado_em: new Date(), Atualizado_por: u.nome };
    let lista = ctx.lista;
    if (arquivar === false && (!lista || !ativo_(lista.Ativo))) {
      lista = ctx.listas.filter(function (l) { return ativo_(l.Ativo); }).sort(porOrdem_)[0];
      if (!lista) throw new Error('Crie ou restaure uma lista antes de restaurar este cartão.');
      campos.Lista_ID = lista.ID;
    }
    gravarCampos_(tc, c, campos);
    registrar_(u, arquivar === false ? 'Restaurou cartão' : 'Arquivou cartão', 'Cartão', c.ID, ctx.quadro.ID, textoDe_(c.Titulo));
    return resposta_(ctx.quadro.ID, { cartao: cartaoParaCliente_(c, lista.ID, fuso_(), tc.extras) });
  });
}

/**
 * Duplica um cartão no mesmo quadro e na mesma lista, logo abaixo do original.
 * Copia título, descrição, responsáveis, prazo, prioridade, etiquetas, campos adicionais e checklist.
 * Não copia: comentários, histórico e vínculo com rotina. A cópia nasce como não concluída e o checklist, desmarcado.
 */
function duplicarCartao(cartaoId) {
  const u = usuarioAtual_();
  return comTrava_(function () {
    const tc = lerTabela_('CARTOES');
    const c = acharPorId_(tc, cartaoId);
    if (!c) throw new Error('Cartão não encontrado.');
    if (!ativo_(c.Ativo)) throw new Error('Restaure o cartão antes de duplicar.');
    const ctx = contextoCartao_(u, c);
    if (!ativo_(ctx.lista.Ativo)) throw new Error('A lista deste cartão está arquivada. Restaure a lista antes de duplicar.');

    const sufixo = ' (cópia)';
    const titulo = textoLimpo_(textoDe_(c.Titulo), 500 - sufixo.length) + sufixo;
    const agora = new Date();
    const dados = {
      ID: proximoId_(tc), Quadro_ID: ctx.quadro.ID, Lista_ID: ctx.lista.ID, Titulo: textoSeguro_(titulo),
      Descricao: textoSeguro_(textoLimpo_(textoDe_(c.Descricao), 20000, true)),
      Responsaveis: textoSeguro_(textoDe_(c.Responsaveis)), Prazo: ehData_(c.Prazo) ? c.Prazo : '',
      Prioridade: prioridadeValida_(c.Prioridade), Etiquetas: separar_(c.Etiquetas).join(', '), Ordem: numOrdem_(c),
      Concluido: 'Não', Concluido_em: '', Ativo: 'Sim', Criado_em: agora, Criado_por: u.nome,
      Atualizado_em: agora, Atualizado_por: u.nome, Carrossel_Total: c.Carrossel_Total, Carrossel_Vez: textoSeguro_(textoDe_(c.Carrossel_Vez))
    };
    tc.extras.forEach(function (cab) {
      const v = c._extras ? c._extras[cab] : '';
      dados[cab] = typeof v === 'string' ? textoSeguro_(v) : v;
    });
    const copia = inserir_(tc, dados);
    if (tc.extras.length) copia._extras = Object.assign({}, c._extras);

    // Fica logo abaixo do original (ou no fim da lista, se o original não estiver mais visível).
    const irmaos = cartoesDoQuadro_(tc, ctx.quadro.ID, ctx.listas)
      .filter(function (x) { return x.lista && x.lista.ID === ctx.lista.ID && ativo_(x.c.Ativo) && x.c.ID !== copia.ID; })
      .map(function (x) { return x.c; })
      .sort(porOrdem_);
    const pos = irmaos.map(function (x) { return x.ID; }).indexOf(c.ID);
    const seguinte = pos !== -1 && pos + 1 < irmaos.length ? irmaos[pos + 1].ID : null;
    const r = reposicionar_(tc, irmaos, copia, seguinte, {});

    const tk = lerTabela_('CHECKLIST');
    const itens = inserirVarios_(tk, tk.linhas
      .filter(function (i) { return i.Cartao_ID === c.ID && ativo_(i.Ativo); })
      .sort(porOrdem_)
      .map(function (i, n) {
        return {
          ID: proximoId_(tk), Cartao_ID: copia.ID, Texto: textoSeguro_(textoDe_(i.Texto)), Feito: 'Não', Ordem: (n + 1) * 1000,
          Ativo: 'Sim', Criado_em: agora, Criado_por: u.nome, Feito_em: '', Feito_por: ''
        };
      })).map(itemParaCliente_);

    const tcr = lerTabela_('CARROSSEL');
    inserirVarios_(tcr, participantesDoCartao_(tcr, c.ID).map(function (p, n) {
      return {
        ID: proximoId_(tcr), Cartao_ID: copia.ID, Pessoa: textoSeguro_(textoDe_(p.Pessoa)), Texto: textoSeguro_(textoDe_(p.Texto)), Ordem: (n + 1) * 1000,
        Atendimentos: 0, Ativo: 'Sim', Criado_em: agora, Criado_por: u.nome
      };
    }));

    registrar_(u, 'Duplicou cartão', 'Cartão', copia.ID, ctx.quadro.ID, 'Cópia de ' + c.ID + ': ' + textoDe_(c.Titulo));
    return resposta_(ctx.quadro.ID, {
      cartao: cartaoParaCliente_(copia, ctx.lista.ID, fuso_(), tc.extras, 0, itens),
      checklist: itens,
      renumerados: r.renumerados
    });
  });
}

function obterDetalheCartao(cartaoId) {
  const u = usuarioAtual_();
  const c = acharPorId_(lerTabela_('CARTOES'), cartaoId);
  if (!c) throw new Error('Cartão não encontrado.');
  contextoCartao_(u, c, true);
  const tz = fuso_();
  const comentarios = lerTabela_('COMENTARIOS').linhas
    .filter(function (m) { return m.Cartao_ID === c.ID && ativo_(m.Ativo); })
    .map(function (m) {
      return {
        id: m.ID, autor: textoDe_(m.Autor), texto: textoDe_(m.Texto), criadoEm: dataHoraIso_(m.Criado_em, tz),
        meu: igualEmail_(m.Autor_email, u.email), podeRemover: igualEmail_(m.Autor_email, u.email) || u.perfil === 'ADM'
      };
    })
    .reverse();
  const atividade = lerLogRecente_()
    .filter(function (r) { return r.Entidade_ID === c.ID; })
    .slice(-60)
    .reverse()
    .map(function (r) {
      return { quando: dataHoraIso_(r.Data_hora, tz), quem: nomeDoUsuario_(r.Usuario), acao: textoDe_(r.Acao), detalhe: textoDe_(r.Detalhe) };
    });
  // O resumo gravado no cartão evita ler a aba Carrossel inteira à toa na maioria dos cartões.
  const itensCarrossel = numero_(c.Carrossel_Total) > 0
    ? participantesDoCartao_(lerTabela_('CARROSSEL'), c.ID).map(function (r) { return participanteParaCliente_(r, tz); })
    : [];
  return { comentarios: comentarios, atividade: atividade, carrossel: itensCarrossel };
}

/* =========================================================================
 * API — MEUS CARTÕES E MOVER ENTRE QUADROS
 * ========================================================================= */

/** Cartões em aberto em que a pessoa é responsável, em todos os quadros que ela consegue ver. */
function meusCartoes() {
  const u = usuarioAtual_();
  const tz = fuso_();
  const eu = normalizar_(u.nome);
  const pesoPrioridade = { Urgente: 0, Alta: 1, 'Média': 2, Baixa: 3, '': 4 };
  const quadros = lerTabela_('QUADROS').linhas.filter(function (q) { return ativo_(q.Ativo) && podeVer_(u, q); });
  const tl = lerTabela_('LISTAS');
  const tc = lerTabela_('CARTOES');
  const etiquetas = {};
  lerTabela_('ETIQUETAS').linhas.forEach(function (e) { if (ativo_(e.Ativo)) etiquetas[e.ID] = etiquetaParaCliente_(e); });

  const saida = [];
  quadros.forEach(function (q) {
    const listas = tl.linhas.filter(function (l) { return l.Quadro_ID === q.ID; });
    const ordemListas = listas.filter(function (l) { return ativo_(l.Ativo); }).sort(porOrdem_).map(function (l) { return l.ID; });
    cartoesDoQuadro_(tc, q.ID, listas).forEach(function (x) {
      if (!ativo_(x.c.Ativo) || !x.lista || !ativo_(x.lista.Ativo) || sim_(x.c.Concluido)) return;
      if (separar_(x.c.Responsaveis).map(normalizar_).indexOf(eu) === -1) return;
      const c = cartaoParaCliente_(x.c, x.lista.ID, tz, []);
      c.quadroId = q.ID;
      c.quadroNome = textoDe_(q.Nome);
      c.quadroCor = corValida_(q.Cor) || COR_QUADRO_PADRAO;
      c.listaNome = textoDe_(x.lista.Nome);
      c.listaPosicao = ordemListas.indexOf(x.lista.ID);
      c.etiquetasInfo = c.etiquetas.map(function (id) { return etiquetas[id]; }).filter(Boolean);
      saida.push(c);
    });
  });
  saida.sort(function (a, b) {
    const pa = a.prazo || '9999-99-99';
    const pb = b.prazo || '9999-99-99';
    if (pa !== pb) return pa < pb ? -1 : 1;
    const d = pesoPrioridade[a.prioridade] - pesoPrioridade[b.prioridade];
    if (d) return d;
    return a.quadroNome.localeCompare(b.quadroNome, 'pt-BR') || a.ordem - b.ordem;
  });
  return { cartoes: saida, minhasEscalas: minhasEscalas_(u) };
}

/** Quadros em que a pessoa pode editar, com as listas ativas, para escolher o destino de um cartão. */
function listarDestinos() {
  const u = usuarioAtual_();
  const tl = lerTabela_('LISTAS');
  return lerTabela_('QUADROS').linhas
    .filter(function (q) { return ativo_(q.Ativo) && podeEditar_(u, q); })
    .sort(function (a, b) { return textoDe_(a.Nome).localeCompare(textoDe_(b.Nome), 'pt-BR'); })
    .map(function (q) {
      return {
        id: q.ID, nome: textoDe_(q.Nome), cor: corValida_(q.Cor) || COR_QUADRO_PADRAO,
        listas: tl.linhas
          .filter(function (l) { return l.Quadro_ID === q.ID && ativo_(l.Ativo); })
          .sort(porOrdem_)
          .map(function (l) { return { id: l.ID, nome: textoDe_(l.Nome) }; })
      };
    })
    .filter(function (q) { return q.listas.length; });
}

/**
 * Leva o cartão para outro quadro. Comentários, checklist e histórico vão junto (estão ligados pelo ID do cartão).
 * Etiquetas: usa a do destino com o mesmo nome; se não existir, cria no destino com a mesma cor.
 */
function moverCartaoParaQuadro(cartaoId, quadroDestinoId, listaDestinoId) {
  const u = usuarioAtual_();
  return comTrava_(function () {
    const tc = lerTabela_('CARTOES');
    const c = acharPorId_(tc, cartaoId);
    if (!c) throw new Error('Cartão não encontrado.');
    const origem = contextoCartao_(u, c);
    const destino = exigirQuadroEditavel_(u, quadroDestinoId);
    if (destino.ID === origem.quadro.ID) throw new Error('O cartão já está neste quadro. Para trocar de lista, use o campo "na lista".');
    const listasDestino = lerTabela_('LISTAS').linhas.filter(function (l) { return l.Quadro_ID === destino.ID; });
    const lista = listasDestino.filter(function (l) { return l.ID === listaDestinoId && ativo_(l.Ativo); })[0];
    if (!lista) throw new Error('A lista de destino não existe mais.');

    const te = lerTabela_('ETIQUETAS');
    const criadas = [];
    const idsDestino = separar_(c.Etiquetas).map(function (id) {
      const e = acharPorId_(te, id);
      if (!e || !ativo_(e.Ativo)) return null;
      const nome = textoDe_(e.Nome);
      const igual = te.linhas.filter(function (x) {
        if (x.Quadro_ID !== destino.ID || !ativo_(x.Ativo)) return false;
        return nome ? normalizar_(x.Nome) === normalizar_(nome) : (!textoDe_(x.Nome) && corValida_(x.Cor) === corValida_(e.Cor));
      })[0];
      if (igual) return igual.ID;
      const nova = inserir_(te, { ID: proximoId_(te), Quadro_ID: destino.ID, Nome: textoSeguro_(nome), Cor: corValida_(e.Cor) || '#5C677D', Ativo: 'Sim' });
      criadas.push(etiquetaParaCliente_(nova));
      return nova.ID;
    }).filter(Boolean);

    const maior = cartoesDoQuadro_(tc, destino.ID, listasDestino)
      .filter(function (x) { return x.lista && x.lista.ID === lista.ID && ativo_(x.c.Ativo) && x.c.ID !== c.ID; })
      .reduce(function (m, x) { return Math.max(m, numOrdem_(x.c)); }, 0);
    gravarCampos_(tc, c, {
      Quadro_ID: destino.ID, Lista_ID: lista.ID, Etiquetas: unicos_(idsDestino).join(', '),
      Ordem: Math.min(maior, 1e8) + 1000, Atualizado_em: new Date(), Atualizado_por: u.nome
    });
    registrar_(u, 'Moveu para outro quadro', 'Cartão', c.ID, destino.ID,
      'De ' + textoDe_(origem.quadro.Nome) + ' (' + textoDe_(origem.lista.Nome) + ') para ' + textoDe_(destino.Nome) + ' (' + textoDe_(lista.Nome) + ')');
    const pessoa = distribuirNaVez_(u, destino, lista, c, tc);
    marcarVersaoQuadro_(destino.ID);
    return resposta_(origem.quadro.ID, {
      cartaoId: c.ID, quadroDestino: quadroParaCliente_(destino), listaDestino: listaParaCliente_(lista), etiquetasCriadas: criadas,
      distribuidoPara: pessoa || ''
    });
  });
}

/* =========================================================================
 * API — CARROSSEL (rodízio de pessoas dentro de um cartão)
 * A primeira pessoa da fila é a da vez. Ao marcar "Atendi", ela vai para o fim da fila.
 * ========================================================================= */

function participantesDoCartao_(tcr, cartaoId) {
  return tcr.linhas.filter(function (r) { return r.Cartao_ID === cartaoId && ativo_(r.Ativo); }).sort(porOrdem_);
}

function participanteParaCliente_(r, tz) {
  return {
    id: r.ID, pessoa: textoDe_(r.Pessoa), texto: textoDe_(r.Texto), ordem: numOrdem_(r),
    atendimentos: numero_(r.Atendimentos), ultimoEm: dataHoraIso_(r.Ultimo_em, tz), ultimoPor: textoDe_(r.Ultimo_por)
  };
}

/** Carrega cartão, quadro (com permissão de editar) e a fila. */
function contextoCarrossel_(u, cartaoId) {
  const tc = lerTabela_('CARTOES');
  const c = acharPorId_(tc, cartaoId);
  if (!c) throw new Error('Cartão não encontrado.');
  const ctx = contextoCartao_(u, c);
  const tcr = lerTabela_('CARROSSEL');
  return { tc: tc, c: c, ctx: ctx, tcr: tcr, fila: participantesDoCartao_(tcr, c.ID) };
}

function participanteDoContexto_(u, participanteId) {
  const p = acharPorId_(lerTabela_('CARROSSEL'), participanteId);
  if (!p || !ativo_(p.Ativo)) throw new Error('Participante não encontrado.');
  const cx = contextoCarrossel_(u, p.Cartao_ID);
  cx.p = p;
  return cx;
}

/** Guarda no cartão quantos participantes há e quem está na vez (o quadro mostra isso sem ler a aba Carrossel). */
function atualizarResumoCarrossel_(cx) {
  const fila = participantesDoCartao_(cx.tcr, cx.c.ID);
  cx.fila = fila;
  gravarCampos_(cx.tc, cx.c, { Carrossel_Total: fila.length, Carrossel_Vez: textoSeguro_(fila.length ? textoDe_(fila[0].Pessoa) : '') });
  return fila;
}

/** Evita números de ordem enormes depois de muitas voltas do rodízio. */
function renumerarCarrosselSeNecessario_(cx) {
  const fila = participantesDoCartao_(cx.tcr, cx.c.ID);
  const fora = fila.some(function (r) { return Math.abs(numOrdem_(r)) > 1e6; });
  if (!fora) return;
  fila.forEach(function (r, i) { gravarCampos_(cx.tcr, r, { Ordem: (i + 1) * 1000 }); });
}

function respostaCarrossel_(u, cx, extra) {
  renumerarCarrosselSeNecessario_(cx);
  const fila = atualizarResumoCarrossel_(cx);
  const tz = fuso_();
  const r = extra || {};
  r.itens = fila.map(function (x) { return participanteParaCliente_(x, tz); });
  r.resumo = fila.length ? { total: fila.length, vez: textoDe_(fila[0].Pessoa) } : null;
  return resposta_(cx.ctx.quadro.ID, r);
}

function adicionarParticipante(cartaoId, pessoa, texto) {
  const u = usuarioAtual_();
  const nome = textoLimpo_(pessoa, 80);
  if (!nome) throw new Error('Escreva o nome de quem entra no carrossel.');
  return comTrava_(function () {
    const cx = contextoCarrossel_(u, cartaoId);
    if (cx.fila.length >= LIMITE_CARROSSEL) throw new Error('O carrossel aceita até ' + LIMITE_CARROSSEL + ' pessoas.');
    if (cx.fila.some(function (x) { return normalizar_(x.Pessoa) === normalizar_(nome); })) throw new Error(nome + ' já está neste carrossel.');
    const maior = cx.fila.reduce(function (m, x) { return Math.max(m, numOrdem_(x)); }, 0);
    inserir_(cx.tcr, {
      ID: proximoId_(cx.tcr), Cartao_ID: cx.c.ID, Pessoa: textoSeguro_(nome), Texto: textoSeguro_(textoLimpo_(texto, 300)),
      Ordem: maior + 1000, Atendimentos: 0, Ativo: 'Sim', Criado_em: new Date(), Criado_por: u.nome
    });
    registrar_(u, 'Carrossel', 'Cartão', cx.c.ID, cx.ctx.quadro.ID, 'Incluiu ' + nome);
    return respostaCarrossel_(u, cx);
  });
}

/** Põe no carrossel todo mundo que participa do quadro e ainda não está nele. */
function adicionarEquipeCarrossel(cartaoId) {
  const u = usuarioAtual_();
  return comTrava_(function () {
    const cx = contextoCarrossel_(u, cartaoId);
    const ja = {};
    cx.fila.forEach(function (x) { ja[normalizar_(x.Pessoa)] = true; });
    const novos = ordenarNomes_(candidatosEscala_(cx.ctx.quadro)).filter(function (n) { return !ja[normalizar_(n)]; });
    const vagas = Math.max(0, LIMITE_CARROSSEL - cx.fila.length);
    const lote = novos.slice(0, vagas);
    if (!lote.length) throw new Error(novos.length ? 'O carrossel já está cheio.' : 'Todos do quadro já estão no carrossel.');
    const maior = cx.fila.reduce(function (m, x) { return Math.max(m, numOrdem_(x)); }, 0);
    const agora = new Date();
    inserirVarios_(cx.tcr, lote.map(function (n, i) {
      return {
        ID: proximoId_(cx.tcr), Cartao_ID: cx.c.ID, Pessoa: textoSeguro_(n), Texto: '', Ordem: maior + (i + 1) * 1000,
        Atendimentos: 0, Ativo: 'Sim', Criado_em: agora, Criado_por: u.nome
      };
    }));
    registrar_(u, 'Carrossel', 'Cartão', cx.c.ID, cx.ctx.quadro.ID, 'Incluiu a equipe (' + lote.length + ')');
    return respostaCarrossel_(u, cx, { adicionados: lote.length });
  });
}

function atualizarParticipante(participanteId, dados) {
  const u = usuarioAtual_();
  dados = dados || {};
  return comTrava_(function () {
    const cx = participanteDoContexto_(u, participanteId);
    const campos = {};
    if (dados.pessoa !== undefined) {
      const nome = textoLimpo_(dados.pessoa, 80);
      if (!nome) throw new Error('O nome não pode ficar vazio.');
      if (cx.fila.some(function (x) { return x.ID !== cx.p.ID && normalizar_(x.Pessoa) === normalizar_(nome); })) throw new Error(nome + ' já está neste carrossel.');
      campos.Pessoa = textoSeguro_(nome);
    }
    if (dados.texto !== undefined) campos.Texto = textoSeguro_(textoLimpo_(dados.texto, 300));
    if (!Object.keys(campos).length) throw new Error('Nada para salvar.');
    gravarCampos_(cx.tcr, cx.p, campos);
    registrar_(u, 'Carrossel', 'Cartão', cx.c.ID, cx.ctx.quadro.ID, 'Editou ' + textoDe_(cx.p.Pessoa));
    return respostaCarrossel_(u, cx);
  });
}

function removerParticipante(participanteId) {
  const u = usuarioAtual_();
  return comTrava_(function () {
    const cx = participanteDoContexto_(u, participanteId);
    gravarCampos_(cx.tcr, cx.p, { Ativo: 'Não' });
    registrar_(u, 'Carrossel', 'Cartão', cx.c.ID, cx.ctx.quadro.ID, 'Tirou ' + textoDe_(cx.p.Pessoa));
    return respostaCarrossel_(u, cx);
  });
}

/** "Atendi": a pessoa vai para o fim da fila e o próximo passa a ser o da vez. */
function passarVezCarrossel(participanteId) {
  const u = usuarioAtual_();
  return comTrava_(function () {
    const cx = participanteDoContexto_(u, participanteId);
    const antes = cx.fila.map(function (x) { return x.ID; });
    const maior = cx.fila.reduce(function (m, x) { return Math.max(m, numOrdem_(x)); }, 0);
    const campos = { Atendimentos: numero_(cx.p.Atendimentos) + 1, Ultimo_em: new Date(), Ultimo_por: textoSeguro_(u.nome) };
    if (cx.fila.length > 1 && cx.fila[cx.fila.length - 1].ID !== cx.p.ID) campos.Ordem = maior + 1000;
    gravarCampos_(cx.tcr, cx.p, campos);
    const r = respostaCarrossel_(u, cx, { antes: antes });
    registrar_(u, 'Carrossel', 'Cartão', cx.c.ID, cx.ctx.quadro.ID, textoDe_(cx.p.Pessoa) + ' atendeu e foi para o fim; na vez: ' + (r.resumo ? r.resumo.vez : '-'));
    return r;
  });
}

/** Põe uma pessoa na frente da fila (corrige a vez quando alguém atendeu fora de ordem). */
function colocarNaVezCarrossel(participanteId) {
  const u = usuarioAtual_();
  return comTrava_(function () {
    const cx = participanteDoContexto_(u, participanteId);
    if (cx.fila[0] && cx.fila[0].ID !== cx.p.ID) {
      const menor = cx.fila.reduce(function (m, x) { return Math.min(m, numOrdem_(x)); }, Infinity);
      gravarCampos_(cx.tcr, cx.p, { Ordem: menor - 1000 });
    }
    const r = respostaCarrossel_(u, cx);
    registrar_(u, 'Carrossel', 'Cartão', cx.c.ID, cx.ctx.quadro.ID, 'Colocou ' + textoDe_(cx.p.Pessoa) + ' na vez');
    return r;
  });
}

/** Volta a fila para uma ordem anterior (desfazer). Se vier o ID de quem tinha atendido, tira esse atendimento da conta. */
function reordenarCarrossel(cartaoId, ids, desfazerId) {
  const u = usuarioAtual_();
  return comTrava_(function () {
    const cx = contextoCarrossel_(u, cartaoId);
    const desejada = (Array.isArray(ids) ? ids : []).map(String);
    const porId = {};
    cx.fila.forEach(function (x) { porId[x.ID] = x; });
    const resto = cx.fila.map(function (x) { return x.ID; }).filter(function (id) { return desejada.indexOf(id) === -1; });
    const ordem = desejada.filter(function (id) { return porId[id]; }).concat(resto);
    ordem.forEach(function (id, i) {
      if (numOrdem_(porId[id]) !== (i + 1) * 1000) gravarCampos_(cx.tcr, porId[id], { Ordem: (i + 1) * 1000 });
    });
    const volta = desfazerId ? porId[String(desfazerId)] : null;
    if (volta) gravarCampos_(cx.tcr, volta, { Atendimentos: Math.max(0, numero_(volta.Atendimentos) - 1) });
    registrar_(u, 'Carrossel', 'Cartão', cx.c.ID, cx.ctx.quadro.ID, 'Desfez a passagem de vez');
    return respostaCarrossel_(u, cx);
  });
}

/* =========================================================================
 * API — CHECKLIST, COMENTÁRIOS E ETIQUETAS
 * ========================================================================= */

function adicionarItemChecklist(cartaoId, texto) {
  const u = usuarioAtual_();
  const limpo = textoLimpo_(texto, 500);
  if (!limpo) throw new Error('Escreva o item do checklist.');
  return comTrava_(function () {
    const c = acharPorId_(lerTabela_('CARTOES'), cartaoId);
    if (!c) throw new Error('Cartão não encontrado.');
    const ctx = contextoCartao_(u, c);
    const tk = lerTabela_('CHECKLIST');
    const maior = tk.linhas
      .filter(function (i) { return i.Cartao_ID === c.ID; })
      .reduce(function (m, i) { return Math.max(m, numOrdem_(i)); }, 0);
    const item = inserir_(tk, {
      ID: proximoId_(tk), Cartao_ID: c.ID, Texto: textoSeguro_(limpo), Feito: 'Não', Ordem: Math.min(maior, 1e8) + 1000,
      Ativo: 'Sim', Criado_em: new Date(), Criado_por: u.nome, Feito_em: '', Feito_por: ''
    });
    registrar_(u, 'Checklist', 'Cartão', c.ID, ctx.quadro.ID, 'Adicionou: ' + limpo);
    return resposta_(ctx.quadro.ID, { item: itemParaCliente_(item) });
  });
}

function atualizarItemChecklist(itemId, dados) {
  const u = usuarioAtual_();
  dados = dados || {};
  return comTrava_(function () {
    const tk = lerTabela_('CHECKLIST');
    const item = acharPorId_(tk, itemId);
    if (!item) throw new Error('Item não encontrado.');
    const c = acharPorId_(lerTabela_('CARTOES'), item.Cartao_ID);
    if (!c) throw new Error('Cartão não encontrado.');
    const ctx = contextoCartao_(u, c);
    const campos = {};
    let detalhe = '';
    if (dados.texto !== undefined) {
      const t = textoLimpo_(dados.texto, 500);
      if (!t) throw new Error('O item precisa de um texto.');
      campos.Texto = textoSeguro_(t);
      detalhe = 'Editou: ' + t;
    }
    if (dados.feito !== undefined) {
      const feito = dados.feito === true;
      campos.Feito = feito ? 'Sim' : 'Não';
      campos.Feito_em = feito ? new Date() : '';
      campos.Feito_por = feito ? u.nome : '';
      detalhe = (feito ? 'Concluiu: ' : 'Desmarcou: ') + textoDe_(campos.Texto || item.Texto);
    }
    if (dados.ativo === false) {
      campos.Ativo = 'Não';
      detalhe = 'Removeu: ' + textoDe_(item.Texto);
    }
    gravarCampos_(tk, item, campos);
    registrar_(u, 'Checklist', 'Cartão', c.ID, ctx.quadro.ID, detalhe);
    return resposta_(ctx.quadro.ID, { item: itemParaCliente_(item) });
  });
}

function removerItemChecklist(itemId) {
  return atualizarItemChecklist(itemId, { ativo: false });
}

function adicionarComentario(cartaoId, texto) {
  const u = usuarioAtual_();
  const limpo = textoLimpo_(texto, 5000, true);
  if (!limpo) throw new Error('O comentário está vazio.');
  return comTrava_(function () {
    const c = acharPorId_(lerTabela_('CARTOES'), cartaoId);
    if (!c) throw new Error('Cartão não encontrado.');
    const ctx = contextoCartao_(u, c, true);
    if (u.perfil === 'Leitor') throw new Error('Seu perfil é de leitura e não pode comentar.');
    const tm = lerTabela_('COMENTARIOS');
    const m = inserir_(tm, {
      ID: proximoId_(tm), Cartao_ID: c.ID, Autor: u.nome, Autor_email: u.email, Texto: textoSeguro_(limpo), Ativo: 'Sim', Criado_em: new Date()
    });
    registrar_(u, 'Comentou', 'Cartão', c.ID, ctx.quadro.ID, limpo.slice(0, 140));
    return resposta_(ctx.quadro.ID, {
      comentario: { id: m.ID, autor: u.nome, texto: limpo, criadoEm: dataHoraIso_(m.Criado_em, fuso_()), meu: true, podeRemover: true }
    });
  });
}

function removerComentario(comentarioId) {
  const u = usuarioAtual_();
  return comTrava_(function () {
    const tm = lerTabela_('COMENTARIOS');
    const m = acharPorId_(tm, comentarioId);
    if (!m) throw new Error('Comentário não encontrado.');
    if (!igualEmail_(m.Autor_email, u.email) && u.perfil !== 'ADM') throw new Error('Só quem escreveu ou um ADM pode remover o comentário.');
    const c = acharPorId_(lerTabela_('CARTOES'), m.Cartao_ID);
    if (!c) throw new Error('Cartão não encontrado.');
    const ctx = contextoCartao_(u, c, true);
    gravarCampos_(tm, m, { Ativo: 'Não' });
    registrar_(u, 'Removeu comentário', 'Cartão', c.ID, ctx.quadro.ID, textoDe_(m.Texto).slice(0, 140));
    return resposta_(ctx.quadro.ID, { id: m.ID });
  });
}

function salvarEtiqueta(quadroId, dados) {
  const u = usuarioAtual_();
  dados = dados || {};
  return comTrava_(function () {
    const q = exigirQuadroEditavel_(u, quadroId);
    const te = lerTabela_('ETIQUETAS');
    const nome = textoSeguro_(textoLimpo_(dados.nome, 40));
    const cor = corValida_(dados.cor) || '#5C677D';
    let e;
    if (dados.id) {
      e = acharPorId_(te, dados.id);
      if (!e || e.Quadro_ID !== q.ID) throw new Error('Etiqueta não encontrada.');
      gravarCampos_(te, e, { Nome: nome, Cor: cor, Ativo: 'Sim' });
    } else {
      e = inserir_(te, { ID: proximoId_(te), Quadro_ID: q.ID, Nome: nome, Cor: cor, Ativo: 'Sim' });
    }
    registrar_(u, 'Salvou etiqueta', 'Etiqueta', e.ID, q.ID, textoDe_(e.Nome) + ' ' + cor);
    return resposta_(q.ID, { etiqueta: etiquetaParaCliente_(e) });
  });
}

function arquivarEtiqueta(etiquetaId) {
  const u = usuarioAtual_();
  return comTrava_(function () {
    const te = lerTabela_('ETIQUETAS');
    const e = acharPorId_(te, etiquetaId);
    if (!e) throw new Error('Etiqueta não encontrada.');
    const q = exigirQuadroEditavel_(u, e.Quadro_ID);
    gravarCampos_(te, e, { Ativo: 'Não' });
    registrar_(u, 'Arquivou etiqueta', 'Etiqueta', e.ID, q.ID, textoDe_(e.Nome));
    return resposta_(q.ID, { id: e.ID });
  });
}

function listarArquivados(quadroId) {
  const u = usuarioAtual_();
  const q = acharPorId_(lerTabela_('QUADROS'), quadroId);
  if (!q || !podeVer_(u, q)) throw new Error('Quadro não encontrado.');
  const tz = fuso_();
  const todasListas = lerTabela_('LISTAS').linhas.filter(function (l) { return l.Quadro_ID === q.ID; });
  const listasArq = todasListas.filter(function (l) { return !ativo_(l.Ativo); });
  const tc = lerTabela_('CARTOES');
  const cartoes = cartoesDoQuadro_(tc, q.ID, todasListas)
    .filter(function (x) { return !ativo_(x.c.Ativo); })
    .map(function (x) {
      return { id: x.c.ID, titulo: textoDe_(x.c.Titulo), lista: x.lista ? textoDe_(x.lista.Nome) : '', atualizadoEm: dataHoraIso_(x.c.Atualizado_em, tz) };
    })
    .reverse();
  return {
    listas: listasArq.map(function (l) {
      const total = tc.linhas.filter(function (c) { return c.Lista_ID === l.ID && ativo_(c.Ativo); }).length;
      return { id: l.ID, nome: textoDe_(l.Nome), cartoes: total };
    }),
    cartoes: cartoes
  };
}

/* =========================================================================
 * API — ADMINISTRAÇÃO (só ADM)
 * ========================================================================= */

function listarUsuarios() {
  const u = usuarioAtual_();
  exigirAdm_(u);
  return listarUsuariosInterno_(u);
}

function salvarUsuario(dados) {
  const u = usuarioAtual_();
  exigirAdm_(u);
  dados = dados || {};
  const email = String(dados.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('E-mail inválido.');
  return comTrava_(function () {
    const tu = lerTabela_('USUARIOS');
    const existente = tu.linhas.filter(function (o) { return igualEmail_(o.Email, email); })[0];
    const perfil = perfilValido_(dados.perfil);
    const ativo = dados.ativo !== false;
    const nome = textoSeguro_(textoLimpo_(dados.nome, 80) || (existente ? textoDe_(existente.Nome) : '') || nomeDoEmail_(email));

    const admsDepois = tu.linhas.filter(function (o) {
      if (igualEmail_(o.Email, email)) return perfil === 'ADM' && ativo;
      return perfilValido_(o.Perfil) === 'ADM' && ativo_(o.Ativo);
    }).length + (existente ? 0 : (perfil === 'ADM' && ativo ? 1 : 0));
    if (admsDepois === 0) throw new Error('O sistema precisa de pelo menos um ADM ativo.');

    if (existente) {
      gravarCampos_(tu, existente, { Nome: nome, Perfil: perfil, Ativo: ativo ? 'Sim' : 'Não' });
    } else {
      inserir_(tu, { Email: email, Nome: nome, Perfil: perfil, Ativo: ativo ? 'Sim' : 'Não', Criado_em: new Date() });
    }
    registrar_(u, existente ? 'Editou pessoa' : 'Cadastrou pessoa', 'Usuário', email, '', perfil + (ativo ? '' : ' (inativo)'));
    return { ok: true, usuarios: listarUsuariosInterno_(u), ativos: usuariosAtivos_() };
  });
}

function salvarConfig(pares) {
  const u = usuarioAtual_();
  exigirAdm_(u);
  pares = pares || {};
  const permitidas = CONFIG_PADRAO.map(function (c) { return c[0]; });
  return comTrava_(function () {
    const tcfg = lerTabela_('CONFIG');
    Object.keys(pares).forEach(function (chave) {
      if (permitidas.indexOf(chave) === -1) return;
      const valor = textoSeguro_(textoLimpo_(pares[chave], 1000));
      const linha = tcfg.linhas.filter(function (o) { return textoDe_(o.Chave) === chave; })[0];
      if (linha) gravarCampos_(tcfg, linha, { Valor: valor });
      else inserir_(tcfg, { Chave: chave, Valor: valor, Descricao: '' });
    });
    registrar_(u, 'Editou configurações', 'Config', '', '', Object.keys(pares).join(', '));
    return { ok: true, config: configParaCliente_(lerConfig_(), u) };
  });
}

/* =========================================================================
 * ESCALA DA SEMANA
 * Rodízio semanal das pessoas entre as frentes (listas marcadas como Frente),
 * ordem de atendimento dentro de cada frente e distribuição automática na vez,
 * pulando quem está ausente no dia.
 * ========================================================================= */

/** Abre a escala do quadro (semana atual ou próxima). */
function obterEscala(quadroId, qual) {
  const u = usuarioAtual_();
  const q = acharPorId_(lerTabela_('QUADROS'), quadroId);
  if (!q || !ativo_(q.Ativo) || !podeVer_(u, q)) throw new Error('Quadro não encontrado.');
  return escalaParaCliente_(u, q, qual === 'proxima' ? 1 : 0);
}

/** Liga/desliga a escala, define frentes (com vagas) e equipe. Refaz a semana atual e a próxima. */
function salvarConfigEscala(quadroId, dados) {
  const u = usuarioAtual_();
  dados = dados || {};
  return comTrava_(function () {
    const tq = lerTabela_('QUADROS');
    const q = acharPorId_(tq, quadroId);
    if (!q || !ativo_(q.Ativo)) throw new Error('Quadro não encontrado.');
    if (!podeAdministrar_(u, q)) throw new Error('Só o dono do quadro ou um ADM pode configurar a escala.');

    const permitidos = candidatosEscala_(q).map(normalizar_);
    const equipe = unicos_((Array.isArray(dados.equipe) ? dados.equipe : separar_(dados.equipe))
      .map(function (n) { return textoLimpo_(n, 80); })
      .filter(function (n) { return n && permitidos.indexOf(normalizar_(n)) !== -1; }));
    gravarCampos_(tq, q, {
      Escala_Ativa: dados.ativa === false ? 'Não' : 'Sim',
      Escala_Equipe: textoSeguro_(ordenarNomes_(equipe).join(', '))
    });

    const frentes = {};
    (dados.frentes || []).forEach(function (f) {
      if (f && f.id) frentes[f.id] = parseInt(f.vagas, 10) > 0 ? parseInt(f.vagas, 10) : '';
    });
    const tl = lerTabela_('LISTAS');
    tl.linhas.filter(function (l) { return l.Quadro_ID === q.ID; }).forEach(function (l) {
      const eFrente = Object.prototype.hasOwnProperty.call(frentes, l.ID) && ativo_(l.Ativo);
      gravarCampos_(tl, l, { Frente: eFrente ? 'Sim' : 'Não', Frente_Vagas: eFrente ? frentes[l.ID] : '' });
    });

    const listasQ = tl.linhas.filter(function (l) { return l.Quadro_ID === q.ID; });
    const cfg = configEscala_(q, listasQ);
    const te = lerTabela_('ESCALA');
    const semanaAtual = segundaDe_(hojeIso_());
    [semanaAtual, somarDiasIso_(semanaAtual, 7)].forEach(function (semana) { refazerSemana_(u, q, semana, cfg, te); });
    registrar_(u, 'Configurou escala', 'Escala', '', q.ID,
      (cfg.ligada ? 'Ligada' : 'Desligada') + '; frentes: ' + cfg.frentes.map(function (f) { return f.nome; }).join(', ') + '; equipe: ' + cfg.equipe.length);
    return resposta_(q.ID, { escala: escalaParaCliente_(u, q, 0, listasQ) });
  });
}

/** Ajuste manual da coordenação: troca a frente de alguém ou muda a posição na ordem de atendimento. */
function ajustarEscala(quadroId, qual, pessoa, mudanca) {
  const u = usuarioAtual_();
  mudanca = mudanca || {};
  return comTrava_(function () {
    const q = acharPorId_(lerTabela_('QUADROS'), quadroId);
    if (!q || !ativo_(q.Ativo)) throw new Error('Quadro não encontrado.');
    if (!podeAdministrar_(u, q)) throw new Error('Só o dono do quadro ou um ADM pode ajustar a escala.');
    const listasQ = lerTabela_('LISTAS').linhas.filter(function (l) { return l.Quadro_ID === q.ID; });
    const cfg = configEscala_(q, listasQ);
    if (!cfg.ativa) throw new Error('A escala deste quadro está desligada.');
    const semana = somarDiasIso_(segundaDe_(hojeIso_()), qual === 'proxima' ? 7 : 0);
    const r = linhasEscala_(u, q, semana, cfg);
    const alvo = r.linhas.filter(function (x) { return normalizar_(x.Pessoa) === normalizar_(pessoa); })[0];
    if (!alvo) throw new Error('Essa pessoa não está na escala desta semana.');
    const porPosicao = function (a, b) { return numero_(a.Posicao) - numero_(b.Posicao); };

    if (mudanca.frenteId && mudanca.frenteId !== alvo.Lista_ID) {
      if (!cfg.frentes.some(function (f) { return f.id === mudanca.frenteId; })) throw new Error('Frente inválida.');
      const origem = alvo.Lista_ID;
      const ultimaPos = r.linhas.filter(function (x) { return x.Lista_ID === mudanca.frenteId; })
        .reduce(function (m, x) { return Math.max(m, numero_(x.Posicao)); }, 0);
      gravarCampos_(r.t, alvo, { Lista_ID: mudanca.frenteId, Posicao: ultimaPos + 1, Origem: 'Manual' });
      r.linhas.filter(function (x) { return x.Lista_ID === origem; }).sort(porPosicao).forEach(function (x, i) {
        if (numero_(x.Posicao) !== i + 1) gravarCampos_(r.t, x, { Posicao: i + 1 });
      });
      registrar_(u, 'Ajustou escala', 'Escala', '', q.ID, textoDe_(alvo.Pessoa) + ' foi para ' + nomeFrente_(cfg, mudanca.frenteId));
    } else if (mudanca.direcao === -1 || mudanca.direcao === 1) {
      const fila = r.linhas.filter(function (x) { return x.Lista_ID === alvo.Lista_ID; }).sort(porPosicao);
      const i = fila.indexOf(alvo);
      const j = i + mudanca.direcao;
      if (j >= 0 && j < fila.length) {
        const vizinho = fila[j];
        gravarCampos_(r.t, alvo, { Posicao: j + 1, Origem: 'Manual' });
        gravarCampos_(r.t, vizinho, { Posicao: i + 1, Origem: 'Manual' });
        registrar_(u, 'Ajustou escala', 'Escala', '', q.ID, textoDe_(alvo.Pessoa) + ' agora é ' + (j + 1) + 'º em ' + nomeFrente_(cfg, alvo.Lista_ID));
      }
    }
    return resposta_(q.ID, { escala: escalaParaCliente_(u, q, qual === 'proxima' ? 1 : 0, listasQ) });
  });
}

function listarAusencias() {
  const u = usuarioAtual_();
  if (!podeGerirAusencias_(u)) throw new Error('Só ADM ou dono de quadro pode ver e cadastrar ausências.');
  return ausenciasParaCliente_();
}

function salvarAusencia(dados) {
  const u = usuarioAtual_();
  dados = dados || {};
  if (!podeGerirAusencias_(u)) throw new Error('Só ADM ou dono de quadro pode cadastrar ausências.');
  const pessoa = usuariosAtivos_().filter(function (x) { return normalizar_(x.nome) === normalizar_(dados.pessoa); })[0];
  if (!pessoa) throw new Error('Escolha uma pessoa cadastrada.');
  const inicio = String(dados.inicio || '').trim();
  const fim = String(dados.fim || '').trim() || inicio;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(inicio) || !/^\d{4}-\d{2}-\d{2}$/.test(fim)) throw new Error('Informe as datas de início e fim.');
  if (fim < inicio) throw new Error('A data final vem antes da inicial.');
  const motivo = MOTIVOS_AUSENCIA.filter(function (m) { return normalizar_(m) === normalizar_(dados.motivo); })[0] || 'Outro';
  return comTrava_(function () {
    const tz = fuso_();
    const ta = lerTabela_('AUSENCIAS');
    const a = inserir_(ta, {
      ID: proximoId_(ta), Pessoa: textoSeguro_(pessoa.nome), Inicio: Utilities.parseDate(inicio, tz, 'yyyy-MM-dd'),
      Fim: Utilities.parseDate(fim, tz, 'yyyy-MM-dd'), Motivo: motivo, Ativo: 'Sim', Criado_em: new Date(), Criado_por: u.nome
    });
    registrar_(u, 'Registrou ausência', 'Ausência', a.ID, '', pessoa.nome + ': ' + motivo + ' de ' + inicio.split('-').reverse().join('/') + ' a ' + fim.split('-').reverse().join('/'));
    avisarQuadrosComEscala_();
    return { ok: true, ausencias: ausenciasParaCliente_() };
  });
}

function removerAusencia(ausenciaId) {
  const u = usuarioAtual_();
  if (!podeGerirAusencias_(u)) throw new Error('Só ADM ou dono de quadro pode remover ausências.');
  return comTrava_(function () {
    const ta = lerTabela_('AUSENCIAS');
    const a = acharPorId_(ta, ausenciaId);
    if (!a) throw new Error('Ausência não encontrada.');
    gravarCampos_(ta, a, { Ativo: 'Não' });
    registrar_(u, 'Removeu ausência', 'Ausência', a.ID, '', textoDe_(a.Pessoa));
    avisarQuadrosComEscala_();
    return { ok: true, ausencias: ausenciasParaCliente_() };
  });
}

/* ---------- Regras da escala ---------- */

function configEscala_(q, listasQuadro) {
  const frentes = listasQuadro
    .filter(function (l) { return ativo_(l.Ativo) && sim_(l.Frente); })
    .sort(porOrdem_)
    .map(function (l) {
      const v = parseInt(l.Frente_Vagas, 10);
      return { id: l.ID, nome: textoDe_(l.Nome), vagas: v > 0 ? v : 0 };
    });
  const equipe = ordenarNomes_(unicos_(separar_(q.Escala_Equipe)));
  const ligada = sim_(q.Escala_Ativa);
  return { ligada: ligada, ativa: ligada && frentes.length > 0 && equipe.length > 0, frentes: frentes, equipe: equipe };
}

/**
 * Monta a escala de uma semana. Cada pessoa ocupa uma "vaga"; as vagas de cada frente ficam
 * espalhadas na roda e, a cada semana, todo mundo anda uma casa. Assim as pessoas trocam de
 * frente de uma semana para a outra e o primeiro da ordem de atendimento também muda.
 */
function gerarEscala_(equipe, frentes, numeroSemana) {
  const N = equipe.length;
  const F = frentes.length;
  if (!N || !F) return [];
  const tamanhos = tamanhosFrentes_(N, frentes.map(function (f) { return f.vagas; }));
  const usados = frentes.map(function () { return 0; });
  const vagas = [];
  for (let k = 0; k < N; k++) {
    let melhor = -1;
    let folga = -Infinity;
    for (let f = 0; f < F; f++) {
      if (usados[f] >= tamanhos[f]) continue;
      const v = tamanhos[f] * (k + 1) / N - usados[f];
      if (v > folga + 1e-9) { folga = v; melhor = f; }
    }
    vagas.push(melhor);
    usados[melhor]++;
  }
  const passo = ((numeroSemana % N) + N) % N;
  const porFrente = frentes.map(function () { return []; });
  equipe.forEach(function (pessoa, i) {
    const k = (i + passo) % N;
    porFrente[vagas[k]].push({ pessoa: pessoa, k: k });
  });
  const saida = [];
  porFrente.forEach(function (lista, f) {
    lista.sort(function (a, b) { return a.k - b.k; }).forEach(function (x, pos) {
      saida.push({ pessoa: x.pessoa, frenteId: frentes[f].id, posicao: pos + 1 });
    });
  });
  return saida;
}

/** Quantas pessoas vão para cada frente. Vagas em branco dividem igualmente quem sobrar. */
function tamanhosFrentes_(N, vagas) {
  const fixos = vagas.map(function (v) { return parseInt(v, 10) > 0 ? parseInt(v, 10) : 0; });
  const somaFixos = fixos.reduce(function (a, b) { return a + b; }, 0);
  const livres = [];
  fixos.forEach(function (v, i) { if (!v) livres.push(i); });
  if (somaFixos >= N || !livres.length) return maiorResto_(N, somaFixos ? fixos : fixos.map(function () { return 1; }));
  const t = fixos.slice();
  const resto = N - somaFixos;
  livres.forEach(function (i, j) { t[i] = Math.floor(resto / livres.length) + (j < resto % livres.length ? 1 : 0); });
  return t;
}

function maiorResto_(N, pesos) {
  const soma = pesos.reduce(function (a, b) { return a + b; }, 0);
  const exatos = pesos.map(function (p) { return N * p / soma; });
  const t = exatos.map(Math.floor);
  let falta = N - t.reduce(function (a, b) { return a + b; }, 0);
  const ordem = exatos.map(function (e, i) { return { i: i, r: e - Math.floor(e) }; })
    .sort(function (a, b) { return (b.r - a.r) || (a.i - b.i); });
  for (let j = 0; falta > 0; j++, falta--) t[ordem[j % ordem.length].i]++;
  return t;
}

/** Linhas da escala do quadro na semana. Gera na primeira vez que alguém precisar. */
function linhasEscala_(u, q, semana, cfg, te) {
  const tz = fuso_();
  const filtrar = function (t) {
    return t.linhas.filter(function (r) { return r.Quadro_ID === q.ID && ativo_(r.Ativo) && dataIso_(r.Semana, tz) === semana; });
  };
  const t0 = te || lerTabela_('ESCALA');
  const existentes = filtrar(t0);
  if (existentes.length || !cfg.ativa) return { t: t0, linhas: existentes };
  const gerar = function () {
    const t = lerTabela_('ESCALA');
    const ja = filtrar(t);
    if (ja.length) return { t: t, linhas: ja };
    const data = Utilities.parseDate(semana, tz, 'yyyy-MM-dd');
    const novas = gerarEscala_(cfg.equipe, cfg.frentes, numeroSemana_(semana)).map(function (p) {
      return inserir_(t, {
        ID: proximoId_(t), Quadro_ID: q.ID, Semana: data, Lista_ID: p.frenteId, Pessoa: textoSeguro_(p.pessoa), Posicao: p.posicao,
        Recebidos: 0, Sequencia_vez: 0, Ultimo_em: '', Origem: 'Automática', Ativo: 'Sim'
      });
    });
    registrar_(u, 'Gerou escala', 'Escala', '', q.ID, 'Semana de ' + semana.split('-').reverse().join('/'));
    return { t: t, linhas: novas };
  };
  return TRAVA_ATIVA_ ? gerar() : comTrava_(gerar);
}

/** Refaz uma semana depois de mudar a configuração, mantendo quantos casos cada um já recebeu. */
function refazerSemana_(u, q, semana, cfg, te) {
  const tz = fuso_();
  const antigas = te.linhas.filter(function (r) { return r.Quadro_ID === q.ID && ativo_(r.Ativo) && dataIso_(r.Semana, tz) === semana; });
  const guardado = {};
  antigas.forEach(function (r) {
    guardado[normalizar_(r.Pessoa) + '|' + r.Lista_ID] = { Recebidos: r.Recebidos, Sequencia_vez: r.Sequencia_vez, Ultimo_em: r.Ultimo_em };
    gravarCampos_(te, r, { Ativo: 'Não' });
  });
  if (!cfg.ativa) return;
  const data = Utilities.parseDate(semana, tz, 'yyyy-MM-dd');
  gerarEscala_(cfg.equipe, cfg.frentes, numeroSemana_(semana)).forEach(function (p) {
    const g = guardado[normalizar_(p.pessoa) + '|' + p.frenteId] || {};
    inserir_(te, {
      ID: proximoId_(te), Quadro_ID: q.ID, Semana: data, Lista_ID: p.frenteId, Pessoa: textoSeguro_(p.pessoa), Posicao: p.posicao,
      Recebidos: numero_(g.Recebidos), Sequencia_vez: numero_(g.Sequencia_vez), Ultimo_em: g.Ultimo_em || '', Origem: 'Automática', Ativo: 'Sim'
    });
  });
}

/** Quem pega o próximo caso da frente: o seguinte a quem recebeu por último, pulando ausentes. */
/**
 * Coloca uma pessoa na vez da frente, sem mexer na ordem de atendimento da semana.
 * A vez é de quem vem depois de quem recebeu o último caso; então quem está logo antes dela na fila passa a ser "o último".
 * Qualquer pessoa que edita o quadro pode usar (é o dia a dia do rodízio).
 */
function definirVezEscala(quadroId, frenteId, pessoa) {
  const u = usuarioAtual_();
  return comTrava_(function () {
    const q = acharPorId_(lerTabela_('QUADROS'), quadroId);
    if (!q || !ativo_(q.Ativo)) throw new Error('Quadro não encontrado.');
    if (!podeEditar_(u, q)) throw new Error('Você não tem permissão para mudar a vez neste quadro.');
    const listasQ = lerTabela_('LISTAS').linhas.filter(function (l) { return l.Quadro_ID === q.ID; });
    const cfg = configEscala_(q, listasQ);
    if (!cfg.ativa) throw new Error('A escala deste quadro está desligada.');
    if (!cfg.frentes.some(function (f) { return f.id === frenteId; })) throw new Error('Frente inválida.');
    const hoje = hojeIso_();
    const r = linhasEscala_(u, q, segundaDe_(hoje), cfg);
    const fila = r.linhas.filter(function (x) { return x.Lista_ID === frenteId; })
      .sort(function (a, b) { return numero_(a.Posicao) - numero_(b.Posicao); });
    const i = fila.map(function (x) { return normalizar_(x.Pessoa); }).indexOf(normalizar_(pessoa));
    if (i === -1) throw new Error('Essa pessoa não está nesta frente esta semana.');
    const motivo = ausentesEm_(hoje)[normalizar_(pessoa)];
    if (motivo) throw new Error(textoDe_(fila[i].Pessoa) + ' está ausente hoje (' + motivo + '). Escolha alguém que esteja disponível.');
    if (fila.length > 1) {
      const anterior = fila[(i - 1 + fila.length) % fila.length];
      const maior = fila.reduce(function (m, x) { return Math.max(m, numero_(x.Sequencia_vez)); }, 0);
      if (numero_(anterior.Sequencia_vez) !== maior || fila.filter(function (x) { return numero_(x.Sequencia_vez) === maior; }).length !== 1) {
        gravarCampos_(r.t, anterior, { Sequencia_vez: maior + 1 });
      }
    }
    registrar_(u, 'Mudou a vez', 'Escala', '', q.ID, textoDe_(fila[i].Pessoa) + ' na vez em ' + nomeFrente_(cfg, frenteId));
    return resposta_(q.ID, { escala: escalaParaCliente_(u, q, 0, listasQ) });
  });
}

function proximoDaVez_(linhasFrente, ausentes) {
  const fila = linhasFrente.slice().sort(function (a, b) { return numero_(a.Posicao) - numero_(b.Posicao); });
  if (!fila.length) return null;
  let ultimo = -1;
  let maiorSeq = 0;
  fila.forEach(function (r, i) {
    const s = numero_(r.Sequencia_vez);
    if (s > maiorSeq) { maiorSeq = s; ultimo = i; }
  });
  for (let j = 1; j <= fila.length; j++) {
    const r = fila[(ultimo + j) % fila.length];
    if (!ausentes[normalizar_(r.Pessoa)]) return r;
  }
  return null;
}

/** Se o cartão entrou numa frente sem responsável, entrega para quem está na vez. Devolve o nome ou ''. */
function distribuirNaVez_(u, q, lista, c, tc) {
  if (!lista || !sim_(lista.Frente) || separar_(c.Responsaveis).length) return '';
  const listasQ = lerTabela_('LISTAS').linhas.filter(function (l) { return l.Quadro_ID === q.ID; });
  const cfg = configEscala_(q, listasQ);
  if (!cfg.ativa || !cfg.frentes.some(function (f) { return f.id === lista.ID; })) return '';
  const hoje = hojeIso_();
  const r = linhasEscala_(u, q, segundaDe_(hoje), cfg);
  const daFrente = r.linhas.filter(function (x) { return x.Lista_ID === lista.ID; });
  const vez = proximoDaVez_(daFrente, ausentesEm_(hoje));
  if (!vez) {
    registrar_(u, 'Ninguém disponível na vez', 'Cartão', c.ID, q.ID, textoDe_(lista.Nome));
    return '';
  }
  const pessoa = textoDe_(vez.Pessoa);
  const seq = daFrente.reduce(function (m, x) { return Math.max(m, numero_(x.Sequencia_vez)); }, 0) + 1;
  gravarCampos_(tc, c, { Responsaveis: textoSeguro_(pessoa) });
  gravarCampos_(r.t, vez, { Recebidos: numero_(vez.Recebidos) + 1, Sequencia_vez: seq, Ultimo_em: new Date() });
  registrar_(u, 'Distribuiu na vez', 'Cartão', c.ID, q.ID, pessoa + ' (' + textoDe_(lista.Nome) + ')');
  return pessoa;
}

/** Nomes (normalizados) de quem está ausente no dia, com o motivo. */
function ausentesEm_(dia, ta) {
  const tz = fuso_();
  const fora = {};
  (ta || lerTabela_('AUSENCIAS')).linhas.forEach(function (a) {
    if (!ativo_(a.Ativo)) return;
    const ini = dataIso_(a.Inicio, tz);
    const fim = dataIso_(a.Fim, tz) || ini;
    if (ini && ini <= dia && dia <= fim) fora[normalizar_(a.Pessoa)] = textoDe_(a.Motivo) || 'Ausente';
  });
  return fora;
}

/** Monta o que a tela precisa: frentes, pessoas na ordem, quem está na vez, ausências da semana. */
function escalaParaCliente_(u, q, deslocamento, listasQ) {
  const tz = fuso_();
  listasQ = listasQ || lerTabela_('LISTAS').linhas.filter(function (l) { return l.Quadro_ID === q.ID; });
  const cfg = configEscala_(q, listasQ);
  const hoje = hojeIso_();
  const semana = somarDiasIso_(segundaDe_(hoje), 7 * (deslocamento || 0));
  const gerirAusencias = podeGerirAusencias_(u);
  const saida = {
    ligada: cfg.ligada, ativa: cfg.ativa, semana: semana, semanaFim: somarDiasIso_(semana, 4), proxima: !!deslocamento,
    podeAdministrar: podeAdministrar_(u, q), podeEditar: podeEditar_(u, q), podeGerirAusencias: gerirAusencias,
    equipe: cfg.equipe, frentes: [], minha: null,
    listas: listasQ.filter(function (l) { return ativo_(l.Ativo); }).sort(porOrdem_).map(listaParaCliente_)
  };
  if (saida.podeAdministrar) saida.candidatos = candidatosEscala_(q);
  if (!cfg.ligada) return saida;

  const r = cfg.ativa ? linhasEscala_(u, q, semana, cfg) : { linhas: [] };
  const ta = lerTabela_('AUSENCIAS');
  const foraHoje = deslocamento ? {} : ausentesEm_(hoje, ta);
  const naSemana = {};
  ta.linhas.forEach(function (a) {
    if (!ativo_(a.Ativo)) return;
    const ini = dataIso_(a.Inicio, tz);
    const fim = dataIso_(a.Fim, tz) || ini;
    if (!ini || fim < semana || ini > somarDiasIso_(semana, 6)) return;
    (naSemana[normalizar_(a.Pessoa)] = naSemana[normalizar_(a.Pessoa)] || []).push({
      inicio: ini, fim: fim, motivo: gerirAusencias ? textoDe_(a.Motivo) : 'Ausente'
    });
  });
  const eu = normalizar_(u.nome);
  saida.frentes = cfg.frentes.map(function (f) {
    const daFrente = r.linhas.filter(function (x) { return x.Lista_ID === f.id; });
    const vez = deslocamento ? null : proximoDaVez_(daFrente, foraHoje);
    const pessoas = daFrente.slice().sort(function (a, b) { return numero_(a.Posicao) - numero_(b.Posicao); }).map(function (x) {
      const n = normalizar_(x.Pessoa);
      if (n === eu) saida.minha = { frenteId: f.id, frente: f.nome, posicao: numero_(x.Posicao) };
      return {
        pessoa: textoDe_(x.Pessoa), posicao: numero_(x.Posicao), recebidos: numero_(x.Recebidos),
        ultimoEm: dataHoraIso_(x.Ultimo_em, tz), manual: normalizar_(x.Origem) === 'manual',
        ausenteHoje: foraHoje[n] ? (gerirAusencias ? foraHoje[n] : 'Ausente') : '', ausencias: naSemana[n] || []
      };
    });
    return { id: f.id, nome: f.nome, vagas: f.vagas, pessoas: pessoas, proximo: vez ? textoDe_(vez.Pessoa) : '' };
  });
  return saida;
}

/** Em quais frentes a pessoa está nesta semana, em todos os quadros com escala que ela vê. */
function minhasEscalas_(u) {
  const quadros = lerTabela_('QUADROS').linhas.filter(function (q) { return ativo_(q.Ativo) && sim_(q.Escala_Ativa) && podeVer_(u, q); });
  if (!quadros.length) return [];
  const tl = lerTabela_('LISTAS');
  const semana = segundaDe_(hojeIso_());
  const eu = normalizar_(u.nome);
  const saida = [];
  quadros.forEach(function (q) {
    const cfg = configEscala_(q, tl.linhas.filter(function (l) { return l.Quadro_ID === q.ID; }));
    if (!cfg.ativa) return;
    const r = linhasEscala_(u, q, semana, cfg);
    const minha = r.linhas.filter(function (x) { return normalizar_(x.Pessoa) === eu; })[0];
    if (!minha) return;
    saida.push({ quadroId: q.ID, quadro: textoDe_(q.Nome), frente: nomeFrente_(cfg, minha.Lista_ID), posicao: numero_(minha.Posicao), semana: semana });
  });
  return saida;
}

/** Quem pode entrar na escala do quadro: pessoas ativas que veem o quadro e não são Leitor. */
function candidatosEscala_(q) {
  return usuariosAtivos_()
    .filter(function (p) { return p.perfil !== 'Leitor' && podeVer_({ email: p.email, perfil: p.perfil }, q); })
    .map(function (p) { return p.nome; });
}

function ausenciasParaCliente_() {
  const tz = fuso_();
  const limite = somarDiasIso_(hojeIso_(), -7);
  return lerTabela_('AUSENCIAS').linhas
    .filter(function (a) { return ativo_(a.Ativo) && (dataIso_(a.Fim, tz) || dataIso_(a.Inicio, tz)) >= limite; })
    .map(function (a) {
      return { id: a.ID, pessoa: textoDe_(a.Pessoa), inicio: dataIso_(a.Inicio, tz), fim: dataIso_(a.Fim, tz) || dataIso_(a.Inicio, tz), motivo: textoDe_(a.Motivo) };
    })
    .sort(function (a, b) { return a.inicio < b.inicio ? -1 : (a.inicio > b.inicio ? 1 : 0); });
}

function podeGerirAusencias_(u) {
  if (u.perfil === 'ADM') return true;
  if (u.perfil === 'Leitor') return false;
  return lerTabela_('QUADROS').linhas.some(function (q) { return ativo_(q.Ativo) && igualEmail_(q.Dono, u.email); });
}

function avisarQuadrosComEscala_() {
  lerTabela_('QUADROS').linhas
    .filter(function (q) { return ativo_(q.Ativo) && sim_(q.Escala_Ativa); })
    .forEach(function (q) { marcarVersaoQuadro_(q.ID); });
}

function nomeFrente_(cfg, listaId) {
  const f = cfg.frentes.filter(function (x) { return x.id === listaId; })[0];
  return f ? f.nome : '';
}

function ordenarNomes_(nomes) {
  return nomes.slice().sort(function (a, b) {
    const x = normalizar_(a);
    const y = normalizar_(b);
    return x < y ? -1 : (x > y ? 1 : 0);
  });
}

function numero_(v) {
  const n = parseFloat(String(v === null || v === undefined ? '' : v).replace(',', '.'));
  return isFinite(n) ? n : 0;
}

/* ---------- Datas da semana (aritmética em UTC: só datas, sem fuso) ---------- */

function hojeIso_() {
  return Utilities.formatDate(new Date(), fuso_(), 'yyyy-MM-dd');
}

function somarDiasIso_(iso, n) {
  const p = iso.split('-').map(Number);
  return new Date(Date.UTC(p[0], p[1] - 1, p[2] + n)).toISOString().slice(0, 10);
}

function segundaDe_(iso) {
  const p = iso.split('-').map(Number);
  const dia = new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay();
  return somarDiasIso_(iso, dia === 0 ? -6 : 1 - dia);
}

/** Quantos dias de `de` até `ate` (negativo se `ate` for antes). */
function diasEntre_(de, ate) {
  const a = de.split('-').map(Number);
  const b = ate.split('-').map(Number);
  return Math.round((Date.UTC(b[0], b[1] - 1, b[2]) - Date.UTC(a[0], a[1] - 1, a[2])) / 86400000);
}

function numeroSemana_(segunda) {
  const a = segunda.split('-').map(Number);
  const b = SEGUNDA_ZERO.split('-').map(Number);
  return Math.round((Date.UTC(a[0], a[1] - 1, a[2]) - Date.UTC(b[0], b[1] - 1, b[2])) / (7 * 86400000));
}

/* =========================================================================
 * ROTINAS
 * Modelos de cartão que nascem sozinhos: todo dia, só em dia útil, toda semana
 * em certos dias, ou todo mês. Um gatilho diário (ou a primeira pessoa que abre
 * o sistema no dia) cria o cartão do dia, com checklist, prazo e responsável.
 * ========================================================================= */

function listarRotinas() {
  const u = usuarioAtual_();
  return listarRotinasPara_(u);
}

/** Cria ou edita uma rotina. Se ela vence hoje, o cartão já nasce. */
function salvarRotina(dados) {
  const u = usuarioAtual_();
  dados = dados || {};
  return comTrava_(function () {
    const tz = fuso_();
    const hoje = hojeIso_();
    const tq = lerTabela_('QUADROS');
    const tl = lerTabela_('LISTAS');
    const tr = lerTabela_('ROTINAS');
    const existente = dados.id ? acharPorId_(tr, dados.id) : null;
    if (dados.id && !existente) throw new Error('Rotina não encontrada.');
    if (existente) {
      const qAntigo = acharPorId_(tq, existente.Quadro_ID);
      if (qAntigo && !podeAdministrar_(u, qAntigo)) throw new Error('Só o dono do quadro ou um ADM pode editar esta rotina.');
    }

    const nome = textoLimpo_(dados.nome, 200);
    if (!nome) throw new Error('Dê um título para a rotina. É o título que os cartões vão ter.');
    const q = acharPorId_(tq, dados.quadroId);
    if (!q || !ativo_(q.Ativo)) throw new Error('Escolha o quadro da rotina.');
    if (!podeAdministrar_(u, q)) throw new Error('Só o dono do quadro ou um ADM pode criar rotinas nele.');
    const lista = tl.linhas.filter(function (l) { return l.ID === dados.listaId && l.Quadro_ID === q.ID && ativo_(l.Ativo); })[0];
    if (!lista) throw new Error('Escolha a lista onde o cartão vai nascer.');

    const freq = FREQUENCIAS.filter(function (f) { return normalizar_(f) === normalizar_(dados.frequencia); })[0];
    if (!freq) throw new Error('Escolha com que frequência a rotina acontece.');
    let dias = [];
    let diaMes = '';
    let ajuste = AJUSTES_NAO_UTIL[0];
    if (freq === 'Semanal') {
      dias = unicos_((Array.isArray(dados.diasSemana) ? dados.diasSemana : separar_(dados.diasSemana))
        .map(function (d) { return String(parseInt(d, 10)); }))
        .map(Number).filter(function (d) { return d >= 1 && d <= 7; }).sort(function (a, b) { return a - b; });
      if (!dias.length) throw new Error('Marque pelo menos um dia da semana.');
    }
    if (freq === 'Mensal') {
      const bruto = textoDe_(dados.diaMes);
      const n = parseInt(bruto, 10);
      const especial = DIAS_MES_ESPECIAIS.filter(function (d) { return normalizar_(d) === normalizar_(bruto); })[0];
      if (/^\d+$/.test(bruto) && n >= 1 && n <= 31) diaMes = n;
      else if (especial) diaMes = especial;
      else throw new Error('Escolha o dia do mês.');
      ajuste = AJUSTES_NAO_UTIL.filter(function (a) { return normalizar_(a) === normalizar_(dados.seNaoUtil); })[0] || AJUSTES_NAO_UTIL[0];
    }

    const inicio = String(dados.inicio || '').trim();
    const fim = String(dados.fim || '').trim();
    [inicio, fim].forEach(function (d) { if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new Error('Data inválida no período da rotina.'); });
    if (inicio && fim && fim < inicio) throw new Error('A data final vem antes da inicial.');

    const link = textoLimpo_(dados.link, 500);
    if (link && !/^https?:\/\/\S+$/i.test(link)) throw new Error('O link precisa começar com http:// ou https://.');

    const itens = (Array.isArray(dados.checklist) ? dados.checklist : String(dados.checklist || '').split('\n'))
      .map(function (t) { return textoLimpo_(t, 500); }).filter(String).slice(0, 50);

    const idsEtiquetas = lerTabela_('ETIQUETAS').linhas
      .filter(function (e) { return e.Quadro_ID === q.ID && ativo_(e.Ativo); }).map(function (e) { return e.ID; });
    const etiquetas = unicos_((Array.isArray(dados.etiquetas) ? dados.etiquetas : separar_(dados.etiquetas))
      .map(function (x) { return String(x).trim(); })).filter(function (x) { return idsEtiquetas.indexOf(x) !== -1; });

    const modo = MODOS_RESPONSAVEL.filter(function (m) { return normalizar_(m) === normalizar_(dados.responsavelModo); })[0] || MODOS_RESPONSAVEL[0];
    let responsavel = '';
    if (modo === 'Pessoa fixa') {
      const p = usuariosAtivos_().filter(function (x) { return x.perfil !== 'Leitor' && normalizar_(x.nome) === normalizar_(dados.responsavel); })[0];
      if (!p) throw new Error('Escolha quem recebe o cartão.');
      responsavel = p.nome;
    }
    let prazoDias = '';
    if (String(dados.prazoDias === null || dados.prazoDias === undefined ? '' : dados.prazoDias).trim() !== '') {
      prazoDias = parseInt(dados.prazoDias, 10);
      if (!isFinite(prazoDias) || prazoDias < 0 || prazoDias > 365) throw new Error('O prazo precisa ser entre 0 e 365 dias.');
    }
    const ativa = dados.ativa !== false;
    const aparar = function (iso) { return iso ? Utilities.parseDate(iso, tz, 'yyyy-MM-dd') : ''; };

    const campos = {
      Nome: textoSeguro_(nome), Quadro_ID: q.ID, Lista_ID: lista.ID, Frequencia: freq,
      Dias_Semana: textoSeguro_(dias.join(',')), Dia_Mes: diaMes, Se_nao_util: ajuste,
      Inicio: aparar(inicio), Fim: aparar(fim),
      Descricao: textoSeguro_(textoLimpo_(dados.descricao, 5000, true)), Link: textoSeguro_(link),
      Checklist: textoSeguro_(itens.join('\n')), Etiquetas: etiquetas.join(', '), Prioridade: prioridadeValida_(dados.prioridade),
      Responsavel_Modo: modo, Responsavel: textoSeguro_(responsavel), Prazo_Dias: prazoDias, Ativo: ativa ? 'Sim' : 'Não',
      Atualizado_em: new Date()
    };
    const ontem = aparar(somarDiasIso_(hoje, -1));
    let r;
    if (existente) {
      const eraAtiva = ativo_(existente.Ativo);
      const ultima = dataIso_(existente.Ultima_Geracao, tz);
      if (ativa && (!eraAtiva || !ultima || ultima < somarDiasIso_(hoje, -1))) campos.Ultima_Geracao = ontem;
      gravarCampos_(tr, existente, campos);
      r = existente;
      registrar_(u, 'Editou rotina', 'Rotina', r.ID, q.ID, nome);
    } else {
      campos.ID = proximoId_(tr);
      campos.Ultima_Geracao = ontem;
      campos.Criado_em = new Date();
      campos.Criado_por = u.nome;
      r = inserir_(tr, campos);
      registrar_(u, 'Criou rotina', 'Rotina', r.ID, q.ID, nome + ' (' + freq + ')');
    }

    let aviso = '';
    if (modo === 'Na vez') {
      const cfgEscala = configEscala_(q, tl.linhas.filter(function (l) { return l.Quadro_ID === q.ID; }));
      if (!cfgEscala.ativa || !cfgEscala.frentes.some(function (f) { return f.id === lista.ID; })) {
        aviso = 'A lista "' + textoDe_(lista.Nome) + '" não é uma frente da escala deste quadro, então o cartão vai nascer sem responsável.';
      }
    }
    let gerou = 0;
    if (ativa) gerou = gerarRotinas_(u, { soRotina: r.ID, origem: 'Ao salvar a rotina' }).criados;
    return { ok: true, id: r.ID, aviso: aviso, gerou: gerou, dados: listarRotinasPara_(u) };
  });
}

/** Pausa ou retoma uma rotina. Ao retomar, não cria cartões do período em que ficou pausada. */
function alternarRotina(rotinaId, ativa) {
  const u = usuarioAtual_();
  return comTrava_(function () {
    const tz = fuso_();
    const tr = lerTabela_('ROTINAS');
    const r = acharPorId_(tr, rotinaId);
    if (!r) throw new Error('Rotina não encontrada.');
    const q = acharPorId_(lerTabela_('QUADROS'), r.Quadro_ID);
    if (!q || !podeAdministrar_(u, q)) throw new Error('Só o dono do quadro ou um ADM pode mexer nesta rotina.');
    const campos = { Ativo: ativa ? 'Sim' : 'Não', Atualizado_em: new Date() };
    if (ativa) campos.Ultima_Geracao = Utilities.parseDate(somarDiasIso_(hojeIso_(), -1), tz, 'yyyy-MM-dd');
    gravarCampos_(tr, r, campos);
    registrar_(u, ativa ? 'Retomou rotina' : 'Pausou rotina', 'Rotina', r.ID, q.ID, textoDe_(r.Nome));
    let gerou = 0;
    if (ativa) gerou = gerarRotinas_(u, { soRotina: r.ID, origem: 'Ao retomar a rotina' }).criados;
    return { ok: true, gerou: gerou, dados: listarRotinasPara_(u) };
  });
}

/** Cria o cartão de hoje agora, fora do horário. Não cria duas vezes no mesmo dia. */
function gerarRotinaAgora(rotinaId) {
  const u = usuarioAtual_();
  return comTrava_(function () {
    const r = acharPorId_(lerTabela_('ROTINAS'), rotinaId);
    if (!r) throw new Error('Rotina não encontrada.');
    const q = acharPorId_(lerTabela_('QUADROS'), r.Quadro_ID);
    if (!q || !podeAdministrar_(u, q)) throw new Error('Só o dono do quadro ou um ADM pode mexer nesta rotina.');
    const res = gerarRotinas_(u, { soRotina: r.ID, forcarHoje: true, origem: 'Manual' });
    if (!res.criados) throw new Error(res.avisos[0] || 'Não foi possível criar o cartão.');
    return { ok: true, quadroId: q.ID, cartaoId: res.cartoes[0], dados: listarRotinasPara_(u) };
  });
}

/** Chamada pelo gatilho diário. Também roda sozinha na primeira abertura do sistema em cada dia. */
function gerarRotinasDoDia() {
  garantirEstrutura_();
  const res = gerarRotinas_(USUARIO_SISTEMA, { origem: 'Gatilho diário', marcarDia: true });
  return { ok: true, criados: res.criados };
}

/** Liga a criação automática todo dia de manhã (só ADM). */
function ativarGatilhoRotinas() {
  const u = usuarioAtual_();
  exigirAdm_(u);
  try {
    ScriptApp.getProjectTriggers().forEach(function (t) {
      if (t.getHandlerFunction() === GATILHO_FUNCAO) ScriptApp.deleteTrigger(t);
    });
    ScriptApp.newTrigger(GATILHO_FUNCAO).timeBased().everyDays(1).atHour(GATILHO_HORA).inTimezone(fuso_()).create();
  } catch (err) {
    throw new Error('O Google não deixou criar o gatilho por aqui. No editor do Apps Script, rode a função ativarRotinasDiarias uma vez e autorize. Detalhe: ' + (err && err.message ? err.message : err));
  }
  PropertiesService.getScriptProperties().setProperty('rotinas_gatilho', JSON.stringify({ por: u.nome, em: agoraIso_() }));
  registrar_(u, 'Ativou gatilho das rotinas', 'Rotina', '', '', 'Todo dia por volta das ' + GATILHO_HORA + 'h');
  return { ok: true, dados: listarRotinasPara_(u) };
}

function desativarGatilhoRotinas() {
  const u = usuarioAtual_();
  exigirAdm_(u);
  try {
    ScriptApp.getProjectTriggers().forEach(function (t) {
      if (t.getHandlerFunction() === GATILHO_FUNCAO) ScriptApp.deleteTrigger(t);
    });
  } catch (err) { /* sem permissão: só tira a marca */ }
  PropertiesService.getScriptProperties().deleteProperty('rotinas_gatilho');
  registrar_(u, 'Desativou gatilho das rotinas', 'Rotina', '', '', '');
  return { ok: true, dados: listarRotinasPara_(u) };
}

/** Atalho do menu da planilha (e para rodar uma vez pelo editor, que pede a autorização). */
function ativarRotinasDiarias() {
  ativarGatilhoRotinas();
  try { SpreadsheetApp.getActive().toast('Rotinas diárias ativadas (todo dia por volta das ' + GATILHO_HORA + 'h).', 'Prisma Flows'); } catch (err) { /* sem interface */ }
}

/* ---------- Regras das rotinas ---------- */

function listarRotinasPara_(u) {
  const tz = fuso_();
  const hoje = hojeIso_();
  const fer = lerFeriados_(lerConfig_());
  const tq = lerTabela_('QUADROS');
  const tl = lerTabela_('LISTAS');
  const te = lerTabela_('ETIQUETAS');
  const visiveis = {};
  tq.linhas.filter(function (q) { return ativo_(q.Ativo) && podeVer_(u, q); }).forEach(function (q) { visiveis[q.ID] = q; });

  // Último cartão criado por cada rotina (inclui arquivados): mostra "Último cartão" na tela.
  const ultimos = {};
  lerTabela_('CARTOES').linhas.forEach(function (c) {
    const rid = textoDe_(c.Rotina_ID);
    if (!rid) return;
    const d = dataIso_(c.Rotina_Data, tz);
    if (!ultimos[rid] || d > ultimos[rid].data) ultimos[rid] = { data: d, id: c.ID };
  });

  const rotinas = lerTabela_('ROTINAS').linhas
    .filter(function (r) { return textoDe_(r.Nome) && visiveis[r.Quadro_ID]; })
    .map(function (r) {
      const q = visiveis[r.Quadro_ID];
      const lista = tl.linhas.filter(function (l) { return l.ID === r.Lista_ID && l.Quadro_ID === q.ID && ativo_(l.Ativo); })[0];
      const cfg = configRotina_(r, tz);
      const ativa = ativo_(r.Ativo);
      const valida = !!cfg.tipo && !(cfg.tipo === 'semanal' && !cfg.dias.length) && !(cfg.tipo === 'mensal' && !cfg.diaMes);
      let aviso = textoDe_(r.Ultimo_Aviso);
      if (!lista) aviso = 'A lista desta rotina não existe mais. Edite a rotina e escolha outra.';
      else if (!valida) aviso = 'A frequência desta rotina está incompleta. Edite a rotina.';
      const prazo = parseInt(r.Prazo_Dias, 10);
      return {
        id: r.ID, nome: textoDe_(r.Nome), quadroId: q.ID, quadroNome: textoDe_(q.Nome), quadroCor: corValida_(q.Cor) || COR_QUADRO_PADRAO,
        listaId: lista ? lista.ID : '', listaNome: lista ? textoDe_(lista.Nome) : '',
        frequencia: cfg.rotulo, diasSemana: cfg.dias, diaMes: cfg.diaMesRotulo, seNaoUtil: cfg.ajusteRotulo,
        inicio: cfg.inicio, fim: cfg.fim,
        descricao: textoDe_(r.Descricao), link: textoDe_(r.Link),
        checklist: String(r.Checklist === null || r.Checklist === undefined ? '' : r.Checklist).split('\n').map(function (t) { return t.trim(); }).filter(String),
        etiquetas: separar_(r.Etiquetas), prioridade: prioridadeValida_(r.Prioridade),
        responsavelModo: modoResponsavel_(r.Responsavel_Modo), responsavel: textoDe_(r.Responsavel),
        prazoDias: prazo >= 0 ? prazo : null,
        ativa: ativa, ultimaGeracao: dataIso_(r.Ultima_Geracao, tz), aviso: aviso,
        ultimoCartaoData: ultimos[r.ID] ? ultimos[r.ID].data : '', ultimoCartaoId: ultimos[r.ID] ? ultimos[r.ID].id : '',
        proxima: ativa && valida && lista ? (proximaOcorrencia_(cfg, hoje, fer) || '') : '',
        podeAdministrar: podeAdministrar_(u, q)
      };
    })
    .sort(function (a, b) {
      if (a.ativa !== b.ativa) return a.ativa ? -1 : 1;
      return a.nome.localeCompare(b.nome, 'pt-BR');
    });

  const quadros = tq.linhas
    .filter(function (q) { return ativo_(q.Ativo) && podeAdministrar_(u, q); })
    .sort(function (a, b) { return textoDe_(a.Nome).localeCompare(textoDe_(b.Nome), 'pt-BR'); })
    .map(function (q) {
      return {
        id: q.ID, nome: textoDe_(q.Nome), cor: corValida_(q.Cor) || COR_QUADRO_PADRAO,
        listas: tl.linhas.filter(function (l) { return l.Quadro_ID === q.ID && ativo_(l.Ativo); }).sort(porOrdem_)
          .map(function (l) { return { id: l.ID, nome: textoDe_(l.Nome), frente: sim_(l.Frente) }; }),
        etiquetas: te.linhas.filter(function (e) { return e.Quadro_ID === q.ID && ativo_(e.Ativo); }).map(etiquetaParaCliente_)
      };
    })
    .filter(function (q) { return q.listas.length; });

  return { hoje: hoje, rotinas: rotinas, quadros: quadros, gatilho: infoGatilhoRotinas_(), podeGerirGatilho: u.perfil === 'ADM' };
}

function infoGatilhoRotinas_() {
  const props = PropertiesService.getScriptProperties();
  const ler = function (k) { try { return JSON.parse(props.getProperty(k) || '{}') || {}; } catch (err) { return {}; } };
  const g = ler('rotinas_gatilho');
  const ult = ler('rotinas_ultima');
  return {
    instalado: !!g.em, por: g.por || '', em: g.em || '', hora: GATILHO_HORA,
    ultimaExecucao: ult.em || '', ultimaOrigem: ult.origem || '', ultimoTotal: ult.criados || 0
  };
}

/** Roda a primeira vez do dia quando o sistema é aberto, caso o gatilho diário não esteja ligado. */
function gerarRotinasSeNecessario_() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('rotinas_dia') === hojeIso_()) return;
  try {
    gerarRotinas_(USUARIO_SISTEMA, { origem: 'Ao abrir o sistema', marcarDia: true });
  } catch (err) { /* nunca impede a abertura do sistema */ }
}

/**
 * Cria os cartões das rotinas que venceram. Para cada rotina cria no máximo um cartão: o da ocorrência
 * mais recente ainda não atendida (se o sistema ficou dias fechado, não cria uma pilha de cartões velhos).
 * Não duplica: cada cartão guarda a rotina e a data a que se refere.
 */
function gerarRotinas_(u, opc) {
  opc = opc || {};
  const tz = fuso_();
  const hoje = opc.hoje || hojeIso_();
  const fer = lerFeriados_(lerConfig_());
  const res = { criados: 0, avisos: [], cartoes: [] };
  const executar = function () {
    const tr = lerTabela_('ROTINAS');
    const rotinas = tr.linhas.filter(function (r) {
      return ativo_(r.Ativo) && textoDe_(r.Nome) && (!opc.soRotina || r.ID === opc.soRotina);
    });
    if (!rotinas.length) return;
    const t = { tq: lerTabela_('QUADROS'), tl: lerTabela_('LISTAS'), tc: lerTabela_('CARTOES'), tk: lerTabela_('CHECKLIST'), te: lerTabela_('ETIQUETAS') };
    const jaExiste = {};
    t.tc.linhas.forEach(function (c) {
      if (textoDe_(c.Rotina_ID)) jaExiste[c.Rotina_ID + '|' + dataIso_(c.Rotina_Data, tz)] = true;
    });
    rotinas.forEach(function (r) {
      try {
        const cfg = configRotina_(r, tz);
        let data = hoje;
        if (!opc.forcarHoje) {
          const depoisDe = dataIso_(r.Ultima_Geracao, tz) || somarDiasIso_(hoje, -1);
          data = ultimaOcorrencia_(cfg, hoje, depoisDe, fer);
          if (!data) return;
        }
        const paraData = function (iso) { return Utilities.parseDate(iso, tz, 'yyyy-MM-dd'); };
        if (jaExiste[r.ID + '|' + data]) {
          if (opc.forcarHoje) res.avisos.push('Já existe o cartão de hoje desta rotina.');
          else gravarCampos_(tr, r, { Ultima_Geracao: paraData(data) });
          return;
        }
        const feito = criarCartaoDeRotina_(u, r, data, t, tz);
        if (!feito.cartaoId) {
          gravarCampos_(tr, r, { Ultimo_Aviso: textoSeguro_(feito.aviso) });
          res.avisos.push(textoDe_(r.Nome) + ': ' + feito.aviso);
          return;
        }
        jaExiste[r.ID + '|' + data] = true;
        res.criados++;
        res.cartoes.push(feito.cartaoId);
        const campos = { Ultimo_Aviso: textoSeguro_(feito.aviso || '') };
        if (!opc.forcarHoje) campos.Ultima_Geracao = paraData(data);
        gravarCampos_(tr, r, campos);
      } catch (err) {
        res.avisos.push(textoDe_(r.Nome) + ': ' + (err && err.message ? err.message : err));
      }
    });
  };
  if (TRAVA_ATIVA_) executar(); else comTrava_(executar);
  if (!opc.soRotina) {
    const props = PropertiesService.getScriptProperties();
    props.setProperty('rotinas_ultima', JSON.stringify({ em: agoraIso_(), origem: opc.origem || '', criados: res.criados }));
    if (opc.marcarDia) props.setProperty('rotinas_dia', hoje);
  }
  return res;
}

/** Monta e grava o cartão de uma rotina para uma data. Devolve {cartaoId} ou {aviso} se não deu. */
function criarCartaoDeRotina_(u, r, data, t, tz) {
  const lista = t.tl.linhas.filter(function (l) { return l.ID === r.Lista_ID && ativo_(l.Ativo); })[0];
  const q = lista ? acharPorId_(t.tq, lista.Quadro_ID) : null;
  if (!lista || !q || !ativo_(q.Ativo)) return { aviso: 'A lista ou o quadro desta rotina não existe mais.' };

  const titulo = textoLimpo_(tituloDaRotina_(textoDe_(r.Nome), data), 500) || 'Rotina';
  const link = textoDe_(r.Link);
  const descricao = (link ? 'Onde fazer: ' + link : '') + (link && textoDe_(r.Descricao) ? '\n\n' : '') + textoDe_(r.Descricao);
  const idsEtiquetas = t.te.linhas.filter(function (e) { return e.Quadro_ID === q.ID && ativo_(e.Ativo); }).map(function (e) { return e.ID; });
  const etiquetas = separar_(r.Etiquetas).filter(function (id) { return idsEtiquetas.indexOf(id) !== -1; });

  let aviso = '';
  let responsavel = '';
  const modo = modoResponsavel_(r.Responsavel_Modo);
  if (modo === 'Pessoa fixa') {
    const p = usuariosAtivos_().filter(function (x) { return normalizar_(x.nome) === normalizar_(r.Responsavel); })[0];
    if (p) responsavel = p.nome;
    else aviso = 'A pessoa fixa desta rotina não está mais ativa; o cartão nasceu sem responsável.';
  }
  const dias = parseInt(r.Prazo_Dias, 10);
  const prazo = dias >= 0 ? Utilities.parseDate(somarDiasIso_(data, dias), tz, 'yyyy-MM-dd') : '';

  const maior = t.tc.linhas
    .filter(function (c) { return c.Lista_ID === lista.ID && ativo_(c.Ativo); })
    .reduce(function (m, c) { return Math.max(m, numOrdem_(c)); }, 0);
  const agora = new Date();
  const c = inserir_(t.tc, {
    ID: proximoId_(t.tc), Quadro_ID: q.ID, Lista_ID: lista.ID, Titulo: textoSeguro_(titulo), Descricao: textoSeguro_(descricao),
    Responsaveis: textoSeguro_(responsavel), Prazo: prazo, Prioridade: prioridadeValida_(r.Prioridade), Etiquetas: etiquetas.join(', '),
    Ordem: Math.min(maior, 1e8) + 1000, Concluido: 'Não', Concluido_em: '', Ativo: 'Sim', Criado_em: agora, Criado_por: 'Rotinas',
    Atualizado_em: agora, Atualizado_por: 'Rotinas', Rotina_ID: r.ID, Rotina_Data: Utilities.parseDate(data, tz, 'yyyy-MM-dd')
  });
  inserirVarios_(t.tk, String(r.Checklist === null || r.Checklist === undefined ? '' : r.Checklist).split('\n')
    .map(function (x) { return textoLimpo_(x, 500); }).filter(String).slice(0, 50)
    .map(function (texto, i) {
      return {
        ID: proximoId_(t.tk), Cartao_ID: c.ID, Texto: textoSeguro_(texto), Feito: 'Não', Ordem: (i + 1) * 1000,
        Ativo: 'Sim', Criado_em: agora, Criado_por: 'Rotinas', Feito_em: '', Feito_por: ''
      };
    }));
  registrar_(u, 'Rotina criou cartão', 'Cartão', c.ID, q.ID, textoDe_(r.Nome) + ' (' + data.split('-').reverse().join('/') + ')');
  if (modo === 'Na vez') {
    const pessoa = distribuirNaVez_(u, q, lista, c, t.tc);
    if (!pessoa) aviso = 'Ninguém estava na vez (a lista não é uma frente da escala, ou todos estavam ausentes); o cartão nasceu sem responsável.';
  }
  marcarVersaoQuadro_(q.ID);
  return { cartaoId: c.ID, aviso: aviso };
}

/** Troca {data} e {mes} no título pelo dia e mês do cartão. */
function tituloDaRotina_(nome, data) {
  const p = data.split('-');
  return nome.replace(/\{data\}/gi, p[2] + '/' + p[1] + '/' + p[0]).replace(/\{mes\}/gi, p[1] + '/' + p[0]);
}

function modoResponsavel_(v) {
  return MODOS_RESPONSAVEL.filter(function (m) { return normalizar_(m) === normalizar_(v); })[0] || MODOS_RESPONSAVEL[0];
}

/** Lê a frequência de uma linha da aba Rotinas. tipo vazio = frequência que o sistema não entende. */
function configRotina_(r, tz) {
  const f = normalizar_(r.Frequencia);
  const tipo = { diaria: 'diaria', tododia: 'diaria', diasuteis: 'uteis', semanal: 'semanal', mensal: 'mensal' }[f] || '';
  const rotulos = { diaria: FREQUENCIAS[0], uteis: FREQUENCIAS[1], semanal: FREQUENCIAS[2], mensal: FREQUENCIAS[3] };
  const nomesDia = { seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sab: 6, dom: 7 };
  const dias = unicos_(separar_(r.Dias_Semana).map(function (d) {
    const n = parseInt(d, 10);
    return String(/^\d+$/.test(d.trim()) ? n : (nomesDia[normalizar_(d).slice(0, 3)] || 0));
  })).map(Number).filter(function (d) { return d >= 1 && d <= 7; }).sort(function (a, b) { return a - b; });

  const bruto = textoDe_(r.Dia_Mes);
  const nm = normalizar_(bruto);
  let diaMes = null;
  let diaMesRotulo = '';
  if (/^\d+$/.test(bruto) && parseInt(bruto, 10) >= 1 && parseInt(bruto, 10) <= 31) {
    diaMes = { tipo: 'n', n: parseInt(bruto, 10) };
    diaMesRotulo = String(parseInt(bruto, 10));
  } else if (nm === 'ultimodia') { diaMes = { tipo: 'ultimo' }; diaMesRotulo = DIAS_MES_ESPECIAIS[0]; }
  else if (nm === 'primeirodiautil') { diaMes = { tipo: 'primeiro_util' }; diaMesRotulo = DIAS_MES_ESPECIAIS[1]; }
  else if (nm === 'ultimodiautil') { diaMes = { tipo: 'ultimo_util' }; diaMesRotulo = DIAS_MES_ESPECIAIS[2]; }

  const na = normalizar_(r.Se_nao_util);
  const ajuste = na.indexOf('proximo') === 0 ? 'proximo' : (na.indexOf('anterior') !== -1 ? 'anterior' : 'manter');
  const ajusteRotulo = { manter: AJUSTES_NAO_UTIL[0], proximo: AJUSTES_NAO_UTIL[1], anterior: AJUSTES_NAO_UTIL[2] }[ajuste];
  return {
    tipo: tipo, rotulo: rotulos[tipo] || textoDe_(r.Frequencia), dias: dias, diaMes: diaMes, diaMesRotulo: diaMesRotulo,
    ajuste: ajuste, ajusteRotulo: ajusteRotulo, inicio: dataIso_(r.Inicio, tz), fim: dataIso_(r.Fim, tz)
  };
}

/** A rotina vence nesta data? (`fer` são os feriados da Config.) */
function ocorreEm_(cfg, iso, fer) {
  if (!cfg.tipo) return false;
  if (cfg.inicio && iso < cfg.inicio) return false;
  if (cfg.fim && iso > cfg.fim) return false;
  if (cfg.tipo === 'diaria') return true;
  if (cfg.tipo === 'uteis') return ehDiaUtil_(iso, fer);
  if (cfg.tipo === 'semanal') return cfg.dias.indexOf(diaDaSemanaIso_(iso)) !== -1;
  if (cfg.tipo === 'mensal' && cfg.diaMes) {
    const p = iso.split('-').map(Number);
    // O ajuste de dia útil pode empurrar a data para o mês vizinho, então olha também os meses ao lado.
    for (let d = -1; d <= 1; d++) {
      const ref = new Date(Date.UTC(p[0], p[1] - 1 + d, 1));
      if (dataMensal_(cfg, ref.getUTCFullYear(), ref.getUTCMonth() + 1, fer) === iso) return true;
    }
  }
  return false;
}

/** Dia em que a rotina mensal cai num mês (1 a 12). */
function dataMensal_(cfg, ano, mes, fer) {
  const ultimo = ultimoDiaDoMes_(ano, mes);
  const m = cfg.diaMes;
  if (m.tipo === 'primeiro_util') return diaUtilProximo_(isoUtc_(ano, mes, 1), fer, 1);
  if (m.tipo === 'ultimo_util') return diaUtilProximo_(isoUtc_(ano, mes, ultimo), fer, -1);
  const iso = isoUtc_(ano, mes, m.tipo === 'ultimo' ? ultimo : Math.min(m.n, ultimo));
  if (cfg.ajuste === 'proximo') return diaUtilProximo_(iso, fer, 1);
  if (cfg.ajuste === 'anterior') return diaUtilProximo_(iso, fer, -1);
  return iso;
}

/** A própria data se for dia útil; senão anda de um em um dia (passo 1 ou -1) até achar um. */
function diaUtilProximo_(iso, fer, passo) {
  let d = iso;
  for (let i = 0; i < 15; i++) {
    if (ehDiaUtil_(d, fer)) return d;
    d = somarDiasIso_(d, passo);
  }
  return iso;
}

function proximaOcorrencia_(cfg, desde, fer) {
  for (let i = 0; i <= 400; i++) {
    const d = somarDiasIso_(desde, i);
    if (ocorreEm_(cfg, d, fer)) return d;
  }
  return '';
}

/** Ocorrência mais recente até hoje que seja posterior a `depoisDe` (olha no máximo 45 dias para trás). */
function ultimaOcorrencia_(cfg, hoje, depoisDe, fer) {
  for (let i = 0; i <= 45; i++) {
    const d = somarDiasIso_(hoje, -i);
    if (d <= depoisDe) return '';
    if (ocorreEm_(cfg, d, fer)) return d;
  }
  return '';
}

/* ---------- Feriados e dias úteis ---------- */

function lerFeriados_(cfg) {
  const f = { datas: {}, anuais: {} };
  separar_(cfg && cfg.FERIADOS).forEach(function (s) {
    let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) {
      const iso = isoUtc_(+m[3], +m[2], +m[1]);
      if (+iso.slice(8, 10) === +m[1]) f.datas[iso] = true;
      return;
    }
    m = s.match(/^(\d{1,2})\/(\d{1,2})$/);
    if (m && +m[2] >= 1 && +m[2] <= 12 && +m[1] >= 1 && +m[1] <= 31) f.anuais[('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2)] = true;
  });
  return f;
}

function ehFeriado_(iso, fer) {
  return !!(fer && (fer.datas[iso] || fer.anuais[iso.slice(5)]));
}

function ehDiaUtil_(iso, fer) {
  return diaDaSemanaIso_(iso) <= 5 && !ehFeriado_(iso, fer);
}

function isoUtc_(ano, mes, dia) {
  return new Date(Date.UTC(ano, mes - 1, dia)).toISOString().slice(0, 10);
}

/** 1 = segunda ... 7 = domingo. */
function diaDaSemanaIso_(iso) {
  const p = iso.split('-').map(Number);
  const d = new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay();
  return d === 0 ? 7 : d;
}

function ultimoDiaDoMes_(ano, mes) {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

function agoraIso_() {
  return Utilities.formatDate(new Date(), fuso_(), "yyyy-MM-dd'T'HH:mm:ss");
}

/* =========================================================================
 * EQUIPE
 * Grade semanal de home e presencial (cada pessoa tem uma cota de dias de home),
 * férias e folgas (aba Ausencias) e banco de horas com pedido e aprovação.
 * Quem é Leitor não entra. Home e presencial todo mundo vê; o banco de horas
 * só a própria pessoa e os ADMs; o motivo da ausência só quem gerencia.
 * ========================================================================= */

/** Grade da semana (qualquer data da semana serve). */
function obterEquipeSemana(semana) {
  const u = usuarioAtual_();
  return equipeSemanaPara_(u, semana);
}

/** Marca (ou desmarca) um dia de home de uma pessoa. Só ADM. */
function definirPresenca(email, dia, tipo) {
  const u = usuarioAtual_();
  exigirAdm_(u);
  const iso = String(dia || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) throw new Error('Data inválida.');
  if (diaDaSemanaIso_(iso) > 5) throw new Error('A grade vale de segunda a sexta.');
  const home = normalizar_(tipo) === 'home';
  if (!home && normalizar_(tipo) !== 'presencial') throw new Error('Escolha Home ou Presencial.');
  return comTrava_(function () {
    if (ehFeriado_(iso, lerFeriados_(lerConfig_()))) throw new Error('Esse dia é feriado.');
    const pessoa = pessoasDaEquipe_().filter(function (p) { return p.email === String(email || '').trim().toLowerCase(); })[0];
    if (!pessoa) throw new Error('Pessoa não encontrada na equipe.');
    if (home) {
      const motivo = ausentesEm_(iso)[normalizar_(pessoa.nome)];
      if (motivo) throw new Error(pessoa.nome + ' está ausente nesse dia (' + motivo + ').');
    }
    marcarHome_(lerTabela_('PRESENCA'), pessoa, iso, home, u, fuso_());
    registrar_(u, home ? 'Marcou home' : 'Marcou presencial', 'Presença', '', '', pessoa.nome + ' em ' + iso.split('-').reverse().join('/'));
    return { ok: true, equipe: equipeSemanaPara_(u, iso) };
  });
}

/** Repete na semana de destino os dias de home de outra semana. Substitui o que já estava marcado no destino. Só ADM. */
function copiarSemanaHome(origem, destino) {
  const u = usuarioAtual_();
  exigirAdm_(u);
  [origem, destino].forEach(function (d) { if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d || ''))) throw new Error('Data inválida.'); });
  const o = segundaDe_(origem);
  const d = segundaDe_(destino);
  if (o === d) throw new Error('Escolha uma semana diferente da de origem.');
  return comTrava_(function () {
    const tz = fuso_();
    const fer = lerFeriados_(lerConfig_());
    const tp = lerTabela_('PRESENCA');
    const equipe = pessoasDaEquipe_();
    const deslocamento = diasEntre_(o, d);
    const homesOrigem = tp.linhas.filter(function (r) {
      const dia = dataIso_(r.Data, tz);
      return ativo_(r.Ativo) && dia >= o && dia <= somarDiasIso_(o, 4);
    });
    tp.linhas.forEach(function (r) {
      const dia = dataIso_(r.Data, tz);
      if (ativo_(r.Ativo) && dia >= d && dia <= somarDiasIso_(d, 4)) gravarCampos_(tp, r, { Ativo: 'Não' });
    });
    const ta = lerTabela_('AUSENCIAS');
    let copiados = 0;
    let ignorados = 0;
    homesOrigem.forEach(function (r) {
      const alvo = somarDiasIso_(dataIso_(r.Data, tz), deslocamento);
      const pessoa = equipe.filter(function (p) { return p.email === String(r.Email || '').trim().toLowerCase(); })[0];
      if (!pessoa || ehFeriado_(alvo, fer) || ausentesEm_(alvo, ta)[normalizar_(pessoa.nome)]) { ignorados++; return; }
      marcarHome_(tp, pessoa, alvo, true, u, tz);
      copiados++;
    });
    registrar_(u, 'Copiou semana de home', 'Presença', '', '', 'De ' + o.split('-').reverse().join('/') + ' para ' + d.split('-').reverse().join('/') + ': ' + copiados + ' dias');
    return { ok: true, copiados: copiados, ignorados: ignorados, equipe: equipeSemanaPara_(u, d) };
  });
}

/** Número de dias de home por semana de uma pessoa (em branco = o padrão da Config). Só ADM. */
function salvarCotaHome(email, dias, semana) {
  const u = usuarioAtual_();
  exigirAdm_(u);
  const bruto = String(dias === null || dias === undefined ? '' : dias).trim();
  let valor = '';
  if (bruto !== '') {
    valor = parseInt(bruto, 10);
    if (!/^\d+$/.test(bruto) || valor < 0 || valor > 5) throw new Error('A cota de home vai de 0 a 5 dias por semana.');
  }
  return comTrava_(function () {
    const tu = lerTabela_('USUARIOS');
    const linha = tu.linhas.filter(function (o) { return igualEmail_(o.Email, email); })[0];
    if (!linha) throw new Error('Pessoa não encontrada.');
    gravarCampos_(tu, linha, { Home_Dias: valor });
    registrar_(u, 'Mudou cota de home', 'Usuário', textoDe_(linha.Email), '', valor === '' ? 'padrão' : valor + ' dias por semana');
    return { ok: true, equipe: equipeSemanaPara_(u, semana) };
  });
}

/** Saldo e extrato do banco de horas. Cada um vê o seu; ADM vê o de qualquer pessoa, os pedidos e o saldo da equipe. */
function obterBancoHoras(email) {
  const u = usuarioAtual_();
  return bancoHorasPara_(u, email);
}

/**
 * Pede para lançar horas (crédito: trabalhou a mais; débito: compensou ou saiu antes).
 * O pedido fica Pendente até um ADM aprovar. Quando um ADM lança para outra pessoa, já entra aprovado.
 */
function solicitarHoras(dados) {
  const u = usuarioAtual_();
  dados = dados || {};
  if (u.perfil === 'Leitor') throw new Error('Seu perfil é de leitura e não lança horas.');
  const adm = u.perfil === 'ADM';
  const emailAlvo = adm && dados.email ? String(dados.email).trim().toLowerCase() : u.email;
  const pessoa = pessoasDaEquipe_().filter(function (p) { return p.email === emailAlvo; })[0];
  if (!pessoa) throw new Error('Escolha uma pessoa da equipe.');
  const tipo = TIPOS_HORAS.filter(function (t) { return normalizar_(t) === normalizar_(dados.tipo); })[0];
  if (!tipo) throw new Error('Escolha se é crédito ou débito.');
  const minutos = parseMinutos_(dados.duracao);
  if (!minutos) throw new Error('Informe a duração, por exemplo 2:30, 1h15 ou 45min.');
  if (minutos > LIMITE_MINUTOS_BANCO) throw new Error('A duração é grande demais para um lançamento só.');
  const data = String(dados.data || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) throw new Error('Informe a data.');
  if (Math.abs(diasEntre_(hojeIso_(), data)) > 800) throw new Error('A data está muito longe de hoje.');
  const descricao = textoLimpo_(dados.descricao, 300);
  if (!descricao) throw new Error('Explique em poucas palavras o motivo.');
  return comTrava_(function () {
    const th = lerTabela_('BANCO_HORAS');
    const proprio = igualEmail_(pessoa.email, u.email);
    const admsAtivos = usuariosAtivos_().filter(function (p) { return p.perfil === 'ADM'; }).length;
    const direto = adm && (!proprio || admsAtivos <= 1);
    const agora = new Date();
    const r = inserir_(th, {
      ID: proximoId_(th), Email: pessoa.email, Pessoa: textoSeguro_(pessoa.nome), Data: Utilities.parseDate(data, fuso_(), 'yyyy-MM-dd'),
      Tipo: tipo, Minutos: minutos, Descricao: textoSeguro_(descricao), Status: direto ? 'Aprovado' : 'Pendente',
      Solicitado_por: textoSeguro_(u.nome), Solicitado_em: agora,
      Decidido_por: direto ? textoSeguro_(u.nome) : '', Decidido_em: direto ? agora : '',
      Resposta: direto && !proprio ? 'Lançado pela coordenação' : '', Ativo: 'Sim'
    });
    registrar_(u, direto ? 'Lançou horas' : 'Pediu horas', 'Banco de horas', r.ID, '', pessoa.nome + ': ' + tipo + ' de ' + horasTexto_(minutos) + ' em ' + data.split('-').reverse().join('/'));
    return { ok: true, direto: direto, banco: bancoHorasPara_(u, '') };
  });
}

/** ADM aprova ou recusa um pedido. Ninguém decide o próprio pedido, a não ser que só exista um ADM. */
function decidirHoras(lancamentoId, aprovar, resposta) {
  const u = usuarioAtual_();
  exigirAdm_(u);
  const texto = textoLimpo_(resposta, 300);
  if (!aprovar && !texto) throw new Error('Explique em uma frase o motivo da recusa.');
  return comTrava_(function () {
    const th = lerTabela_('BANCO_HORAS');
    const r = acharPorId_(th, lancamentoId);
    if (!r || !ativo_(r.Ativo)) throw new Error('Pedido não encontrado.');
    if (statusHoras_(r) !== 'Pendente') throw new Error('Esse pedido já foi respondido.');
    const admsAtivos = usuariosAtivos_().filter(function (p) { return p.perfil === 'ADM'; }).length;
    if (igualEmail_(r.Email, u.email) && admsAtivos > 1) throw new Error('Você não pode decidir o próprio pedido. Peça a outro ADM.');
    gravarCampos_(th, r, {
      Status: aprovar ? 'Aprovado' : 'Recusado', Decidido_por: textoSeguro_(u.nome), Decidido_em: new Date(), Resposta: textoSeguro_(texto)
    });
    registrar_(u, aprovar ? 'Aprovou horas' : 'Recusou horas', 'Banco de horas', r.ID, '', textoDe_(r.Pessoa) + ': ' + textoDe_(r.Tipo) + ' de ' + horasTexto_(numero_(r.Minutos)));
    return { ok: true, banco: bancoHorasPara_(u, '') };
  });
}

/** A pessoa desiste de um pedido pendente; o ADM pode remover qualquer lançamento (fica no histórico). */
function cancelarHoras(lancamentoId) {
  const u = usuarioAtual_();
  return comTrava_(function () {
    const th = lerTabela_('BANCO_HORAS');
    const r = acharPorId_(th, lancamentoId);
    if (!r || !ativo_(r.Ativo)) throw new Error('Lançamento não encontrado.');
    const meu = igualEmail_(r.Email, u.email) && statusHoras_(r) === 'Pendente';
    if (u.perfil !== 'ADM' && !meu) throw new Error('Você só pode cancelar um pedido seu que ainda esteja pendente.');
    gravarCampos_(th, r, { Ativo: 'Não' });
    registrar_(u, 'Cancelou lançamento de horas', 'Banco de horas', r.ID, '', textoDe_(r.Pessoa) + ': ' + textoDe_(r.Tipo) + ' de ' + horasTexto_(numero_(r.Minutos)) + ' (' + textoDe_(r.Status) + ')');
    return { ok: true, banco: bancoHorasPara_(u, '') };
  });
}

/* ---------- Regras da equipe ---------- */

/** Quem entra na grade e no banco de horas: pessoas ativas que não são Leitor. */
/* =========================================================================
 * ESCALA DE ALMOÇO E HOME POR QUADRO
 * A equipe do quadro ajusta, na própria tela do quadro, o turno de almoço e os dias de home de cada semana.
 * Home usa a aba Presenca (o dia de home é da pessoa, vale em qualquer quadro). Almoço fica na aba Almoco, por quadro.
 * ========================================================================= */

/** Pessoas que entram nas escalas do quadro: as marcadas em Equipe_Dia ou, se ninguém foi marcado, todas que veem o quadro. */
function equipeDoDia_(q) {
  const candidatos = usuariosAtivos_().filter(function (p) {
    return p.perfil !== 'Leitor' && podeVer_({ email: p.email, perfil: p.perfil }, q);
  });
  const marcados = separar_(q.Equipe_Dia).map(normalizar_);
  return marcados.length ? candidatos.filter(function (p) { return marcados.indexOf(normalizar_(p.nome)) !== -1; }) : candidatos;
}

function horaValida_(v) {
  const m = String(v === null || v === undefined ? '' : v).trim().match(/^([01]?\d|2[0-3])[:h]([0-5]\d)$/);
  return m ? (m[1].length === 1 ? '0' : '') + m[1] + ':' + m[2] : '';
}

function turnosAlmoco_(q) {
  const lista = unicos_(separarConfig_(q.Almoco_Turnos).map(horaValida_).filter(String)).sort();
  return lista.length ? lista : TURNOS_ALMOCO_PADRAO.slice();
}

function almocoMax_(q) {
  const n = parseInt(q.Almoco_Max, 10);
  return n > 0 ? n : 0;
}

function dataValida_(dia) {
  const iso = String(dia || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) throw new Error('Data inválida.');
  if (diaDaSemanaIso_(iso) > 5) throw new Error('A escala vale de segunda a sexta.');
  return iso;
}

function quadroEditavelDia_(u, quadroId) {
  const q = acharPorId_(lerTabela_('QUADROS'), quadroId);
  if (!q || !ativo_(q.Ativo)) throw new Error('Quadro não encontrado.');
  if (!podeEditar_(u, q)) throw new Error('Você não tem permissão para ajustar a escala deste quadro.');
  return q;
}

function obterEscalaDiaria(quadroId, semana) {
  const u = usuarioAtual_();
  const q = acharPorId_(lerTabela_('QUADROS'), quadroId);
  if (!q || !ativo_(q.Ativo) || !podeVer_(u, q)) throw new Error('Quadro não encontrado.');
  return escalaDiariaPara_(u, q, semana);
}

function escalaDiariaPara_(u, q, semana) {
  const tz = fuso_();
  const hoje = hojeIso_();
  const alvo = /^\d{4}-\d{2}-\d{2}$/.test(String(semana || '')) ? semana : hoje;
  const seg = segundaDe_(alvo);
  const dias = [0, 1, 2, 3, 4].map(function (i) { return somarDiasIso_(seg, i); });
  const cfg = lerConfig_();
  const fer = lerFeriados_(cfg);
  const cotas = cotasHome_(cfg);
  const gerir = podeGerirAusencias_(u);
  const ta = lerTabela_('AUSENCIAS');
  const foraPorDia = {};
  dias.forEach(function (d) { foraPorDia[d] = ausentesEm_(d, ta); });

  const homePorEmail = {};
  lerTabela_('PRESENCA').linhas.forEach(function (r) {
    if (!ativo_(r.Ativo)) return;
    const d = dataIso_(r.Data, tz);
    if (dias.indexOf(d) === -1) return;
    const e = textoDe_(r.Email).toLowerCase();
    (homePorEmail[e] = homePorEmail[e] || []).push(d);
  });
  const almocoPorPessoa = {};
  lerTabela_('ALMOCO').linhas.forEach(function (r) {
    if (!ativo_(r.Ativo) || r.Quadro_ID !== q.ID) return;
    const d = dataIso_(r.Data, tz);
    if (dias.indexOf(d) === -1) return;
    const n = normalizar_(r.Pessoa);
    (almocoPorPessoa[n] = almocoPorPessoa[n] || {})[d] = horaValida_(r.Turno) || textoDe_(r.Turno);
  });

  const feriados = {};
  dias.forEach(function (d) { if (ehFeriado_(d, fer)) feriados[d] = true; });
  const contagem = {};
  dias.forEach(function (d) { contagem[d] = { home: 0, fora: 0, presenciais: 0, total: 0, porTurno: {} }; });

  const pessoas = equipeDoDia_(q).sort(function (a, b) { return normalizar_(a.nome) < normalizar_(b.nome) ? -1 : 1; }).map(function (p) {
    const n = normalizar_(p.nome);
    const fora = {};
    const home = [];
    const almoco = {};
    dias.forEach(function (d) {
      if (feriados[d]) return;
      const c = contagem[d];
      c.total++;
      if (foraPorDia[d][n]) {
        fora[d] = gerir ? foraPorDia[d][n] : 'Ausente';
        c.fora++;
        return;
      }
      if ((homePorEmail[p.email] || []).indexOf(d) !== -1) { home.push(d); c.home++; } else { c.presenciais++; }
      const turno = (almocoPorPessoa[n] || {})[d];
      if (turno) { almoco[d] = turno; c.porTurno[turno] = (c.porTurno[turno] || 0) + 1; }
    });
    const propria = Object.prototype.hasOwnProperty.call(cotas.porEmail, p.email);
    return { email: p.email, nome: p.nome, home: home, fora: fora, almoco: almoco, cota: propria ? cotas.porEmail[p.email] : cotas.padrao, eu: igualEmail_(p.email, u.email) };
  });
  const minimo = parseInt(cfg.MIN_PRESENCIAIS_DIA, 10);
  const saida = {
    quadroId: q.ID, semana: seg, semanaFim: dias[4], dias: dias, hoje: hoje, feriados: feriados, pessoas: pessoas, contagem: contagem,
    turnos: turnosAlmoco_(q), almocoMax: almocoMax_(q), minPresenciais: minimo > 0 ? minimo : 0,
    podeEditar: podeEditar_(u, q), podeAdministrar: podeAdministrar_(u, q), equipeMarcada: separar_(q.Equipe_Dia).length > 0
  };
  if (saida.podeAdministrar) {
    saida.candidatos = candidatosEscala_(q);
    saida.equipeNomes = separar_(q.Equipe_Dia);
    saida.turnosTexto = separarConfig_(q.Almoco_Turnos).join('; ');
  }
  return saida;
}

/** Marca ou desmarca um dia de home de alguém da equipe do quadro. */
function definirHomeQuadro(quadroId, email, dia, tipo) {
  const u = usuarioAtual_();
  const iso = dataValida_(dia);
  const home = normalizar_(tipo) === 'home';
  if (!home && normalizar_(tipo) !== 'presencial') throw new Error('Escolha Home ou Presencial.');
  return comTrava_(function () {
    const q = quadroEditavelDia_(u, quadroId);
    if (ehFeriado_(iso, lerFeriados_(lerConfig_()))) throw new Error('Esse dia é feriado.');
    const pessoa = equipeDoDia_(q).filter(function (p) { return igualEmail_(p.email, email); })[0];
    if (!pessoa) throw new Error('Essa pessoa não está na equipe deste quadro.');
    if (home) {
      const motivo = ausentesEm_(iso)[normalizar_(pessoa.nome)];
      if (motivo) throw new Error(pessoa.nome + ' está ausente nesse dia (' + motivo + ').');
    }
    marcarHome_(lerTabela_('PRESENCA'), pessoa, iso, home, u, fuso_());
    registrar_(u, home ? 'Marcou home' : 'Marcou presencial', 'Presença', '', q.ID, pessoa.nome + ' em ' + iso.split('-').reverse().join('/'));
    return resposta_(q.ID, { dados: escalaDiariaPara_(u, q, iso) });
  });
}

/** Define o turno de almoço de alguém num dia. Turno vazio tira a marcação. */
function definirAlmoco(quadroId, nome, dia, turno) {
  const u = usuarioAtual_();
  const iso = dataValida_(dia);
  const bruto = String(turno === null || turno === undefined ? '' : turno).trim();
  return comTrava_(function () {
    const q = quadroEditavelDia_(u, quadroId);
    const pessoa = equipeDoDia_(q).filter(function (p) { return normalizar_(p.nome) === normalizar_(nome); })[0];
    if (!pessoa) throw new Error('Essa pessoa não está na equipe deste quadro.');
    const valor = bruto ? horaValida_(bruto) : '';
    if (bruto && !valor) throw new Error('Horário inválido.');
    if (valor && turnosAlmoco_(q).indexOf(valor) === -1) throw new Error('Esse horário não é um turno de almoço deste quadro.');
    if (valor) {
      if (ehFeriado_(iso, lerFeriados_(lerConfig_()))) throw new Error('Esse dia é feriado.');
      const motivo = ausentesEm_(iso)[normalizar_(pessoa.nome)];
      if (motivo) throw new Error(pessoa.nome + ' está ausente nesse dia (' + motivo + ').');
    }
    const tz = fuso_();
    const ta = lerTabela_('ALMOCO');
    const linhas = ta.linhas.filter(function (r) {
      return r.Quadro_ID === q.ID && dataIso_(r.Data, tz) === iso && normalizar_(r.Pessoa) === normalizar_(pessoa.nome);
    });
    if (!valor) {
      linhas.forEach(function (r) { if (ativo_(r.Ativo)) gravarCampos_(ta, r, { Ativo: 'Não' }); });
    } else if (linhas.length) {
      gravarCampos_(ta, linhas[0], { Turno: textoSeguro_(valor), Ativo: 'Sim' });
      linhas.slice(1).forEach(function (r) { if (ativo_(r.Ativo)) gravarCampos_(ta, r, { Ativo: 'Não' }); });
    } else {
      inserir_(ta, {
        ID: proximoId_(ta), Quadro_ID: q.ID, Data: Utilities.parseDate(iso, tz, 'yyyy-MM-dd'), Pessoa: textoSeguro_(pessoa.nome),
        Turno: textoSeguro_(valor), Ativo: 'Sim', Criado_em: new Date(), Criado_por: textoSeguro_(u.nome)
      });
    }
    registrar_(u, valor ? 'Marcou almoço' : 'Tirou almoço', 'Almoço', '', q.ID, pessoa.nome + ' em ' + iso.split('-').reverse().join('/') + (valor ? ' às ' + valor : ''));
    return resposta_(q.ID, { dados: escalaDiariaPara_(u, q, iso) });
  });
}

/** Repete numa semana o que foi marcado em outra (só para a equipe do quadro). tipo: 'home' ou 'almoco'. Substitui o destino. */
function copiarSemanaQuadro(quadroId, tipo, origem, destino) {
  const u = usuarioAtual_();
  if (tipo !== 'home' && tipo !== 'almoco') throw new Error('Escolha home ou almoço.');
  [origem, destino].forEach(function (d) { if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d || ''))) throw new Error('Data inválida.'); });
  const o = segundaDe_(origem);
  const d = segundaDe_(destino);
  if (o === d) throw new Error('Escolha uma semana diferente da de origem.');
  return comTrava_(function () {
    const q = quadroEditavelDia_(u, quadroId);
    const tz = fuso_();
    const fer = lerFeriados_(lerConfig_());
    const ta = lerTabela_('AUSENCIAS');
    const equipe = equipeDoDia_(q);
    const deslocamento = diasEntre_(o, d);
    const naSemana = function (dia, ini) { return dia >= ini && dia <= somarDiasIso_(ini, 4); };
    let copiados = 0;
    let ignorados = 0;
    if (tipo === 'home') {
      const tp = lerTabela_('PRESENCA');
      const emails = equipe.map(function (p) { return p.email; });
      const doTime = function (r) { return emails.indexOf(textoDe_(r.Email).toLowerCase()) !== -1; };
      const origemHome = tp.linhas.filter(function (r) { return ativo_(r.Ativo) && doTime(r) && naSemana(dataIso_(r.Data, tz), o); });
      tp.linhas.forEach(function (r) { if (ativo_(r.Ativo) && doTime(r) && naSemana(dataIso_(r.Data, tz), d)) gravarCampos_(tp, r, { Ativo: 'Não' }); });
      origemHome.forEach(function (r) {
        const alvo = somarDiasIso_(dataIso_(r.Data, tz), deslocamento);
        const pessoa = equipe.filter(function (p) { return igualEmail_(p.email, r.Email); })[0];
        if (!pessoa || ehFeriado_(alvo, fer) || ausentesEm_(alvo, ta)[normalizar_(pessoa.nome)]) { ignorados++; return; }
        marcarHome_(tp, pessoa, alvo, true, u, tz);
        copiados++;
      });
    } else {
      const tl = lerTabela_('ALMOCO');
      const nomes = equipe.map(function (p) { return normalizar_(p.nome); });
      const turnos = turnosAlmoco_(q);
      const meu = function (r) { return r.Quadro_ID === q.ID && nomes.indexOf(normalizar_(r.Pessoa)) !== -1; };
      const origemAl = tl.linhas.filter(function (r) { return ativo_(r.Ativo) && meu(r) && naSemana(dataIso_(r.Data, tz), o); });
      tl.linhas.forEach(function (r) { if (ativo_(r.Ativo) && meu(r) && naSemana(dataIso_(r.Data, tz), d)) gravarCampos_(tl, r, { Ativo: 'Não' }); });
      const novas = [];
      origemAl.forEach(function (r) {
        const alvo = somarDiasIso_(dataIso_(r.Data, tz), deslocamento);
        const turno = horaValida_(r.Turno);
        if (!turno || turnos.indexOf(turno) === -1 || ehFeriado_(alvo, fer) || ausentesEm_(alvo, ta)[normalizar_(r.Pessoa)]) { ignorados++; return; }
        novas.push({
          ID: proximoId_(tl), Quadro_ID: q.ID, Data: Utilities.parseDate(alvo, tz, 'yyyy-MM-dd'), Pessoa: textoSeguro_(textoDe_(r.Pessoa)),
          Turno: textoSeguro_(turno), Ativo: 'Sim', Criado_em: new Date(), Criado_por: textoSeguro_(u.nome)
        });
        copiados++;
      });
      inserirVarios_(tl, novas);
    }
    registrar_(u, 'Copiou semana de ' + (tipo === 'home' ? 'home' : 'almoço'), tipo === 'home' ? 'Presença' : 'Almoço', '', q.ID,
      'De ' + o.split('-').reverse().join('/') + ' para ' + d.split('-').reverse().join('/') + ': ' + copiados);
    return resposta_(q.ID, { copiados: copiados, ignorados: ignorados, dados: escalaDiariaPara_(u, q, d) });
  });
}

/** Quem entra nas escalas do quadro, os turnos de almoço e o máximo de pessoas por turno. Só o dono ou ADM. */
function salvarConfigDiaria(quadroId, dados) {
  const u = usuarioAtual_();
  dados = dados || {};
  return comTrava_(function () {
    const tq = lerTabela_('QUADROS');
    const q = acharPorId_(tq, quadroId);
    if (!q || !ativo_(q.Ativo)) throw new Error('Quadro não encontrado.');
    if (!podeAdministrar_(u, q)) throw new Error('Só o dono do quadro ou um ADM pode configurar as escalas.');
    const permitidos = candidatosEscala_(q);
    const equipe = unicos_((Array.isArray(dados.equipe) ? dados.equipe : separar_(dados.equipe))
      .map(function (n) { return textoLimpo_(n, 80); })
      .filter(function (n) { return n && permitidos.map(normalizar_).indexOf(normalizar_(n)) !== -1; }));
    const brutos = separarConfig_(Array.isArray(dados.turnos) ? dados.turnos.join(';') : String(dados.turnos || '').replace(/,/g, ';'));
    const convertidos = brutos.map(horaValida_);
    if (convertidos.some(function (h) { return !h; })) throw new Error('Use horários no formato 12:00, separados por ponto e vírgula.');
    const validos = unicos_(convertidos).sort();
    if (validos.length > 12) throw new Error('No máximo 12 turnos de almoço.');
    const bruto = String(dados.max === null || dados.max === undefined ? '' : dados.max).trim();
    let max = '';
    if (bruto !== '') {
      max = parseInt(bruto, 10);
      if (!/^\d+$/.test(bruto) || max < 1 || max > 99) throw new Error('O máximo por turno vai de 1 a 99 pessoas.');
    }
    gravarCampos_(tq, q, { Equipe_Dia: textoSeguro_(ordenarNomes_(equipe).join(', ')), Almoco_Turnos: textoSeguro_(validos.join('; ')), Almoco_Max: max });
    registrar_(u, 'Configurou escalas do dia', 'Escala', '', q.ID, 'Equipe: ' + (equipe.length || 'todos') + '; turnos: ' + (validos.join(', ') || 'padrão') + '; máx.: ' + (max || 'sem limite'));
    return resposta_(q.ID, { dados: escalaDiariaPara_(u, q, '') });
  });
}

function pessoasDaEquipe_() {
  return usuariosAtivos_().filter(function (p) { return p.perfil !== 'Leitor'; });
}

function cotasHome_(cfg) {
  const lim = function (v) { return Math.max(0, Math.min(5, parseInt(v, 10))); };
  const padrao = isFinite(lim(cfg.HOME_DIAS_PADRAO)) ? lim(cfg.HOME_DIAS_PADRAO) : 2;
  const mapa = { padrao: padrao, porEmail: {} };
  lerTabela_('USUARIOS').linhas.forEach(function (o) {
    const bruto = textoDe_(o.Home_Dias);
    if (bruto !== '' && isFinite(lim(bruto))) mapa.porEmail[textoDe_(o.Email).toLowerCase()] = lim(bruto);
  });
  return mapa;
}

function marcarHome_(tp, pessoa, iso, home, u, tz) {
  const linhas = tp.linhas.filter(function (r) { return igualEmail_(r.Email, pessoa.email) && dataIso_(r.Data, tz) === iso; });
  if (home) {
    if (linhas.some(function (r) { return ativo_(r.Ativo); })) return;
    if (linhas.length) {
      gravarCampos_(tp, linhas[0], { Ativo: 'Sim', Tipo: 'Home', Criado_em: new Date(), Criado_por: textoSeguro_(u.nome) });
    } else {
      inserir_(tp, {
        ID: proximoId_(tp), Email: pessoa.email, Pessoa: textoSeguro_(pessoa.nome), Data: Utilities.parseDate(iso, tz, 'yyyy-MM-dd'),
        Tipo: 'Home', Ativo: 'Sim', Criado_em: new Date(), Criado_por: textoSeguro_(u.nome)
      });
    }
  } else {
    linhas.forEach(function (r) { if (ativo_(r.Ativo)) gravarCampos_(tp, r, { Ativo: 'Não' }); });
  }
}

function equipeSemanaPara_(u, semana) {
  const tz = fuso_();
  const hoje = hojeIso_();
  const alvo = /^\d{4}-\d{2}-\d{2}$/.test(String(semana || '')) ? semana : hoje;
  const seg = segundaDe_(alvo);
  const dias = [0, 1, 2, 3, 4].map(function (i) { return somarDiasIso_(seg, i); });
  const cfg = lerConfig_();
  const fer = lerFeriados_(cfg);
  const cotas = cotasHome_(cfg);
  const gerir = podeGerirAusencias_(u);
  const ta = lerTabela_('AUSENCIAS');
  const foraPorDia = {};
  dias.forEach(function (d) { foraPorDia[d] = ausentesEm_(d, ta); });
  const homePorEmail = {};
  lerTabela_('PRESENCA').linhas.forEach(function (r) {
    if (!ativo_(r.Ativo)) return;
    const d = dataIso_(r.Data, tz);
    if (dias.indexOf(d) === -1) return;
    const e = textoDe_(r.Email).toLowerCase();
    (homePorEmail[e] = homePorEmail[e] || []).push(d);
  });

  const feriados = {};
  dias.forEach(function (d) { if (ehFeriado_(d, fer)) feriados[d] = true; });
  const contagem = {};
  dias.forEach(function (d) { contagem[d] = { home: 0, fora: 0, presenciais: 0, total: 0 }; });

  const pessoas = pessoasDaEquipe_().map(function (p) {
    const n = normalizar_(p.nome);
    const fora = {};
    const home = [];
    dias.forEach(function (d) {
      if (feriados[d]) return;
      const c = contagem[d];
      c.total++;
      if (foraPorDia[d][n]) {
        fora[d] = gerir ? foraPorDia[d][n] : 'Ausente';
        c.fora++;
      } else if ((homePorEmail[p.email] || []).indexOf(d) !== -1) {
        home.push(d);
        c.home++;
      } else {
        c.presenciais++;
      }
    });
    const propria = Object.prototype.hasOwnProperty.call(cotas.porEmail, p.email);
    return {
      email: p.email, nome: p.nome, home: home, fora: fora,
      cota: propria ? cotas.porEmail[p.email] : cotas.padrao, cotaPropria: propria, eu: igualEmail_(p.email, u.email)
    };
  });
  const minimo = parseInt(cfg.MIN_PRESENCIAIS_DIA, 10);
  return {
    semana: seg, semanaFim: dias[4], dias: dias, hoje: hoje, feriados: feriados, pessoas: pessoas, contagem: contagem,
    minPresenciais: minimo > 0 ? minimo : 0, cotaPadrao: cotas.padrao,
    podeEditar: u.perfil === 'ADM', podeGerirAusencias: gerir, podeBanco: u.perfil !== 'Leitor'
  };
}

function bancoHorasPara_(u, emailAlvo) {
  if (u.perfil === 'Leitor') throw new Error('Seu perfil é de leitura e não tem banco de horas.');
  const tz = fuso_();
  const adm = u.perfil === 'ADM';
  const equipe = pessoasDaEquipe_();
  const alvoEmail = adm && emailAlvo ? String(emailAlvo).trim().toLowerCase() : u.email;
  const alvo = equipe.filter(function (p) { return p.email === alvoEmail; })[0] || { email: u.email, nome: u.nome };
  const linhas = lerTabela_('BANCO_HORAS').linhas.filter(function (r) { return ativo_(r.Ativo); });
  const saldos = {};
  const pendentes = {};
  linhas.forEach(function (r) {
    const e = textoDe_(r.Email).toLowerCase();
    const status = statusHoras_(r);
    if (status === 'Aprovado') saldos[e] = (saldos[e] || 0) + minutosComSinal_(r);
    if (status === 'Pendente') pendentes[e] = (pendentes[e] || 0) + 1;
  });
  const admsAtivos = equipe.filter(function (p) { return p.perfil === 'ADM'; }).length;
  const paraCliente = function (r) {
    const status = statusHoras_(r);
    return {
      id: r.ID, email: textoDe_(r.Email).toLowerCase(), pessoa: textoDe_(r.Pessoa), data: dataIso_(r.Data, tz), tipo: textoDe_(r.Tipo),
      minutos: numero_(r.Minutos), descricao: textoDe_(r.Descricao), status: status,
      solicitadoPor: textoDe_(r.Solicitado_por), solicitadoEm: dataHoraIso_(r.Solicitado_em, tz),
      decididoPor: textoDe_(r.Decidido_por), decididoEm: dataHoraIso_(r.Decidido_em, tz), resposta: textoDe_(r.Resposta),
      podeCancelar: adm || (igualEmail_(r.Email, u.email) && status === 'Pendente'),
      proprio: igualEmail_(r.Email, u.email)
    };
  };
  const extrato = linhas
    .filter(function (r) { return igualEmail_(r.Email, alvo.email); })
    .sort(function (a, b) {
      const da = dataIso_(a.Data, tz);
      const db = dataIso_(b.Data, tz);
      if (da !== db) return da < db ? 1 : -1;
      return textoDe_(b.ID) < textoDe_(a.ID) ? -1 : 1;
    })
    .slice(0, 150).map(paraCliente);
  const saida = {
    ehAdm: adm, meuEmail: u.email, alvo: { email: alvo.email, nome: alvo.nome, saldo: saldos[alvo.email] || 0 },
    extrato: extrato, meuSaldo: saldos[u.email] || 0
  };
  if (adm) {
    saida.equipe = equipe.map(function (p) {
      return { email: p.email, nome: p.nome, saldo: saldos[p.email] || 0, pendentes: pendentes[p.email] || 0 };
    });
    saida.pedidos = linhas
      .filter(function (r) { return statusHoras_(r) === 'Pendente'; })
      .sort(function (a, b) { return textoDe_(a.ID) < textoDe_(b.ID) ? -1 : 1; })
      .map(function (r) {
        const o = paraCliente(r);
        o.podeDecidir = !o.proprio || admsAtivos <= 1;
        return o;
      });
  }
  return saida;
}

/** Resumo para a tela inicial: dias de home da semana, saldo do banco e pedidos esperando o ADM. */
function resumoEquipe_(u) {
  const tz = fuso_();
  const seg = segundaDe_(hojeIso_());
  const fim = somarDiasIso_(seg, 4);
  const saida = { homeSemana: [], saldo: 0, pendentes: 0, meusPedidos: 0, naEquipe: false };
  if (u.perfil === 'Leitor') return saida;
  saida.naEquipe = true;
  lerTabela_('PRESENCA').linhas.forEach(function (r) {
    if (!ativo_(r.Ativo) || !igualEmail_(r.Email, u.email)) return;
    const d = dataIso_(r.Data, tz);
    if (d >= seg && d <= fim) saida.homeSemana.push(d);
  });
  saida.homeSemana.sort();
  const admsAtivos = usuariosAtivos_().filter(function (p) { return p.perfil === 'ADM'; }).length;
  lerTabela_('BANCO_HORAS').linhas.forEach(function (r) {
    if (!ativo_(r.Ativo)) return;
    const status = statusHoras_(r);
    if (igualEmail_(r.Email, u.email)) {
      if (status === 'Aprovado') saida.saldo += minutosComSinal_(r);
      if (status === 'Pendente') saida.meusPedidos++;
    }
    if (u.perfil === 'ADM' && status === 'Pendente' && (!igualEmail_(r.Email, u.email) || admsAtivos <= 1)) saida.pendentes++;
  });
  return saida;
}

function minutosComSinal_(r) {
  const m = numero_(r.Minutos);
  return normalizar_(r.Tipo) === 'debito' ? -m : m;
}

/** 'Aprovado', 'Pendente' ou 'Recusado' (aceita variações de acento e caixa digitadas à mão). */
function statusHoras_(r) {
  const n = normalizar_(r.Status);
  return n === 'aprovado' ? 'Aprovado' : (n === 'pendente' ? 'Pendente' : (n === 'recusado' ? 'Recusado' : textoDe_(r.Status)));
}

/** "2:30", "02:30", "2h30", "2h", "45min", "2,5" (horas) ou "2" (horas). Devolve minutos, ou 0 se não entender. */
function parseMinutos_(v) {
  const s = String(v === null || v === undefined ? '' : v).trim().toLowerCase().replace(/\s+/g, '');
  if (!s) return 0;
  let m = s.match(/^(\d{1,3}):([0-5]\d)$/);
  if (m) return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  m = s.match(/^(\d{1,3})h(?:([0-5]?\d)(?:min|m)?)?$/);
  if (m) return parseInt(m[1], 10) * 60 + (m[2] ? parseInt(m[2], 10) : 0);
  m = s.match(/^(\d{1,2})[.,](\d{1,2})h$/);
  if (m) return Math.round(parseFloat(m[1] + '.' + m[2]) * 60);
  m = s.match(/^(\d{1,4})(?:min|m)$/);
  if (m) return parseInt(m[1], 10);
  m = s.match(/^(\d{1,3})(?:[.,](\d{1,2}))?$/);
  if (m) {
    // Número sem unidade vale como horas, mas só até 24: "90" quase certamente é um erro, não 90 horas.
    const horas = parseFloat(m[1] + '.' + (m[2] || '0'));
    return horas <= 24 ? Math.round(horas * 60) : 0;
  }
  return 0;
}

function horasTexto_(min) {
  const m = Math.abs(Math.round(min));
  return Math.floor(m / 60) + 'h' + ('0' + (m % 60)).slice(-2);
}

/* =========================================================================
 * REGRAS DE ACESSO
 * ========================================================================= */

function usuarioAtual_() {
  const email = emailBruto_();
  if (!email) {
    throw erro_('SEM_EMAIL', 'Não foi possível identificar seu e-mail Google. Entre com sua conta e abra o link de novo.');
  }
  const tu = lerTabela_('USUARIOS');
  let u = tu.linhas.filter(function (o) { return igualEmail_(o.Email, email); })[0];
  if (u && !ativo_(u.Ativo)) throw erro_('SEM_ACESSO', 'Seu acesso está desativado. Fale com um ADM do sistema.');
  if (!u) {
    const ninguem = tu.linhas.filter(function (o) { return textoDe_(o.Email); }).length === 0;
    const cfg = lerConfig_();
    if (!ninguem && !sim_(cfg.ACESSO_LIVRE)) {
      throw erro_('SEM_ACESSO', 'Seu e-mail ainda não está cadastrado. Peça para um ADM incluir você na aba Usuarios.');
    }
    u = comTrava_(function () {
      const t2 = lerTabela_('USUARIOS');
      const ja = t2.linhas.filter(function (o) { return igualEmail_(o.Email, email); })[0];
      if (ja) return ja;
      const vazio = t2.linhas.filter(function (o) { return textoDe_(o.Email); }).length === 0;
      const perfil = vazio ? 'ADM' : (perfilValido_(cfg.PERFIL_PADRAO) === 'Leitor' ? 'Leitor' : 'Membro');
      const novo = inserir_(t2, { Email: email, Nome: nomeDoEmail_(email), Perfil: perfil, Ativo: 'Sim', Criado_em: new Date() });
      registrar_({ email: email }, vazio ? 'Primeiro acesso (virou ADM)' : 'Entrou pelo acesso livre', 'Usuário', email, '', perfil);
      return novo;
    });
  }
  return { email: email, nome: textoDe_(u.Nome) || nomeDoEmail_(email), perfil: perfilValido_(u.Perfil) };
}

function emailBruto_() {
  try { return String(Session.getActiveUser().getEmail() || '').trim().toLowerCase(); } catch (err) { return ''; }
}

function podeVer_(u, q) {
  if (u.perfil === 'ADM') return true;
  if (igualEmail_(q.Dono, u.email)) return true;
  if (visibilidadeValida_(q.Visibilidade) !== 'Privado') return true;
  return listaEmails_(q.Membros).indexOf(u.email) !== -1;
}

function podeEditar_(u, q) {
  return u.perfil !== 'Leitor' && podeVer_(u, q);
}

function podeAdministrar_(u, q) {
  return u.perfil === 'ADM' || (u.perfil !== 'Leitor' && igualEmail_(q.Dono, u.email));
}

function exigirAdm_(u) {
  if (u.perfil !== 'ADM') throw new Error('Área restrita a ADM.');
}

function exigirQuadroEditavel_(u, quadroId) {
  const q = acharPorId_(lerTabela_('QUADROS'), quadroId);
  if (!q || !ativo_(q.Ativo)) throw new Error('Quadro não encontrado ou arquivado.');
  if (!podeEditar_(u, q)) throw new Error('Você não tem permissão para editar este quadro.');
  return q;
}

/** Acha quadro e lista de um cartão e confere a permissão. */
function contextoCartao_(u, c, soLeitura) {
  const todasListas = lerTabela_('LISTAS').linhas;
  let quadroId = textoDe_(c.Quadro_ID);
  if (!quadroId) {
    const l0 = todasListas.filter(function (l) { return l.ID === c.Lista_ID; })[0];
    quadroId = l0 ? l0.Quadro_ID : '';
  }
  const q = acharPorId_(lerTabela_('QUADROS'), quadroId);
  if (!q || !ativo_(q.Ativo)) throw new Error('O quadro deste cartão não existe ou está arquivado.');
  if (soLeitura ? !podeVer_(u, q) : !podeEditar_(u, q)) throw new Error('Você não tem permissão para mexer neste cartão.');
  const listas = todasListas.filter(function (l) { return l.Quadro_ID === q.ID; });
  const lista = resolverLista_(c, listas);
  if (!lista) throw new Error('Este quadro não tem listas.');
  return { quadro: q, listas: listas, lista: lista };
}

/* =========================================================================
 * CARTÕES — RESOLUÇÃO E ORDEM
 * ========================================================================= */

/** Cartões que pertencem ao quadro, com a lista já resolvida (aceita Lista_ID com ID ou nome). */
function cartoesDoQuadro_(tc, quadroId, listasDoQuadro) {
  const idsListas = {};
  listasDoQuadro.forEach(function (l) { idsListas[l.ID] = true; });
  return tc.linhas
    .filter(function (c) { return c.Quadro_ID === quadroId || (!textoDe_(c.Quadro_ID) && idsListas[c.Lista_ID]); })
    .map(function (c) { return { c: c, lista: resolverLista_(c, listasDoQuadro) }; });
}

function resolverLista_(c, listas) {
  const porId = listas.filter(function (l) { return l.ID === c.Lista_ID; })[0];
  if (porId) return porId;
  const alvo = normalizar_(c.Lista_ID);
  const ativas = listas.filter(function (l) { return ativo_(l.Ativo); }).sort(porOrdem_);
  if (alvo) {
    const porNome = ativas.filter(function (l) { return normalizar_(l.Nome) === alvo; })[0];
    if (porNome) return porNome;
  }
  return ativas[0] || null;
}

/**
 * Coloca "alvo" antes de "proximoId" (ou no fim) dentro de "irmaos" já ordenados.
 * Usa o ponto médio entre vizinhos; se o espaço acabar, renumera a lista inteira.
 */
function reposicionar_(t, irmaos, alvo, proximoId, camposExtras) {
  let idx = proximoId ? irmaos.map(function (x) { return x.ID; }).indexOf(proximoId) : -1;
  if (idx === -1) idx = irmaos.length;
  const ant = idx > 0 ? numOrdem_(irmaos[idx - 1]) : null;
  const prox = idx < irmaos.length ? numOrdem_(irmaos[idx]) : null;
  let nova;
  if (ant === null && prox === null) nova = 1000;
  else if (ant === null) nova = prox - 1000;
  else if (prox === null) nova = Math.min(ant, 1e8) + 1000;
  else nova = (ant + prox) / 2;

  const renumerados = {};
  const precisaRenumerar = (ant !== null && prox !== null && (prox - ant) < 1e-4) || ant >= 1e8 || prox >= 1e8;
  if (precisaRenumerar) {
    const seq = irmaos.slice(0, idx).concat([alvo]).concat(irmaos.slice(idx));
    seq.forEach(function (x, i) {
      const valor = (i + 1) * 1000;
      if (x === alvo) { nova = valor; return; }
      if (numOrdem_(x) !== valor) {
        gravarCampos_(t, x, { Ordem: valor });
        renumerados[x.ID] = valor;
      }
    });
  }
  const campos = Object.assign({ Ordem: nova }, camposExtras || {});
  gravarCampos_(t, alvo, campos);
  return { id: alvo.ID, ordem: nova, renumerados: renumerados };
}

function porOrdem_(a, b) {
  const d = numOrdem_(a) - numOrdem_(b);
  return d !== 0 ? d : a._linha - b._linha;
}

function porOrdemCliente_(a, b) {
  return a.ordem - b.ordem;
}

/** Ordem vazia (linha digitada na mão) vai para o fim, respeitando a ordem das linhas. */
function numOrdem_(o) {
  const v = o.Ordem;
  if (typeof v === 'number' && isFinite(v)) return v;
  const n = parseFloat(String(v).replace(',', '.'));
  if (isFinite(n)) return n;
  return 1e9 + (o._linha || 0);
}

/* =========================================================================
 * CONVERSÃO PARA O NAVEGADOR (google.script.run não aceita Date)
 * ========================================================================= */

function quadroParaCliente_(q) {
  return {
    id: q.ID, nome: textoDe_(q.Nome), descricao: textoDe_(q.Descricao), cor: corValida_(q.Cor) || COR_QUADRO_PADRAO,
    dono: textoDe_(q.Dono).toLowerCase(), membros: listaEmails_(q.Membros), visibilidade: visibilidadeValida_(q.Visibilidade),
    ativo: ativo_(q.Ativo)
  };
}

function listaParaCliente_(l) {
  const lim = parseInt(l.Limite_WIP, 10);
  const vagas = parseInt(l.Frente_Vagas, 10);
  return { id: l.ID, nome: textoDe_(l.Nome), ordem: numOrdem_(l), limite: lim > 0 ? lim : 0, frente: sim_(l.Frente), vagas: vagas > 0 ? vagas : 0 };
}

function etiquetaParaCliente_(e) {
  return { id: e.ID, nome: textoDe_(e.Nome), cor: corValida_(e.Cor) || '#5C677D' };
}

function itemParaCliente_(i) {
  return { id: i.ID, cartaoId: i.Cartao_ID, texto: textoDe_(i.Texto), feito: sim_(i.Feito), ordem: numOrdem_(i), ativo: ativo_(i.Ativo) };
}

function cartaoParaCliente_(c, listaId, tz, extras, nComentarios, itens) {
  const o = {
    id: c.ID,
    listaId: listaId,
    titulo: textoDe_(c.Titulo) || '(sem título)',
    descricao: textoDe_(c.Descricao),
    responsaveis: separar_(c.Responsaveis),
    prazo: dataIso_(c.Prazo, tz),
    prioridade: prioridadeValida_(c.Prioridade),
    etiquetas: separar_(c.Etiquetas),
    ordem: numOrdem_(c),
    concluido: sim_(c.Concluido),
    concluidoEm: dataHoraIso_(c.Concluido_em, tz),
    ativo: ativo_(c.Ativo),
    criadoEm: dataHoraIso_(c.Criado_em, tz),
    criadoPor: textoDe_(c.Criado_por),
    atualizadoEm: dataHoraIso_(c.Atualizado_em, tz),
    atualizadoPor: textoDe_(c.Atualizado_por),
    rotina: !!textoDe_(c.Rotina_ID),
    carrossel: numero_(c.Carrossel_Total) > 0 ? { total: numero_(c.Carrossel_Total), vez: textoDe_(c.Carrossel_Vez) } : null,
    extras: {}
  };
  (extras || []).forEach(function (cab) {
    const v = c._extras ? c._extras[cab] : '';
    o.extras[cab] = ehData_(v) ? Utilities.formatDate(v, tz, 'dd/MM/yyyy') : textoDe_(v);
  });
  if (nComentarios !== undefined) o.comentarios = nComentarios;
  if (itens !== undefined) o.checklist = { feitos: itens.filter(function (i) { return i.feito; }).length, total: itens.length };
  return o;
}

function resumoQuadros_(u) {
  const hoje = Utilities.formatDate(new Date(), fuso_(), 'yyyy-MM-dd');
  const tz = fuso_();
  const quadros = lerTabela_('QUADROS').linhas.filter(function (q) { return ativo_(q.Ativo) && podeVer_(u, q); });
  const tl = lerTabela_('LISTAS');
  const tc = lerTabela_('CARTOES');
  return quadros.sort(function (a, b) { return textoDe_(a.Nome).localeCompare(textoDe_(b.Nome), 'pt-BR'); }).map(function (q) {
    const todas = tl.linhas.filter(function (l) { return l.Quadro_ID === q.ID; });
    const ativas = todas.filter(function (l) { return ativo_(l.Ativo); }).sort(porOrdem_);
    const contagem = {};
    let vencidos = 0;
    let meus = 0;
    cartoesDoQuadro_(tc, q.ID, todas).forEach(function (x) {
      if (!ativo_(x.c.Ativo) || !x.lista || !ativo_(x.lista.Ativo)) return;
      contagem[x.lista.ID] = (contagem[x.lista.ID] || 0) + 1;
      const prazo = dataIso_(x.c.Prazo, tz);
      if (prazo && prazo < hoje && !sim_(x.c.Concluido)) vencidos++;
      if (separar_(x.c.Responsaveis).map(normalizar_).indexOf(normalizar_(u.nome)) !== -1 && !sim_(x.c.Concluido)) meus++;
    });
    const r = quadroParaCliente_(q);
    r.listas = ativas.map(function (l) { return { nome: textoDe_(l.Nome), total: contagem[l.ID] || 0 }; });
    r.total = r.listas.reduce(function (s, l) { return s + l.total; }, 0);
    r.vencidos = vencidos;
    r.meus = meus;
    r.podeAdministrar = podeAdministrar_(u, q);
    return r;
  });
}

function usuariosAtivos_() {
  return lerTabela_('USUARIOS').linhas
    .filter(function (o) { return textoDe_(o.Email) && ativo_(o.Ativo); })
    .map(function (o) { return { email: textoDe_(o.Email).toLowerCase(), nome: textoDe_(o.Nome) || nomeDoEmail_(o.Email), perfil: perfilValido_(o.Perfil) }; })
    .sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); });
}

function listarUsuariosInterno_(u) {
  const tz = fuso_();
  return lerTabela_('USUARIOS').linhas
    .filter(function (o) { return textoDe_(o.Email); })
    .map(function (o) {
      return {
        email: textoDe_(o.Email).toLowerCase(), nome: textoDe_(o.Nome) || nomeDoEmail_(o.Email), perfil: perfilValido_(o.Perfil),
        ativo: ativo_(o.Ativo), criadoEm: dataHoraIso_(o.Criado_em, tz), voce: igualEmail_(o.Email, u.email)
      };
    });
}

function nomeDoUsuario_(email) {
  const e = textoDe_(email).toLowerCase();
  const u = usuariosAtivos_().filter(function (x) { return x.email === e; })[0];
  return u ? u.nome : (e ? nomeDoEmail_(e) : 'Sistema');
}

function configParaCliente_(cfg, u) {
  const o = {
    nomeSistema: cfg.NOME_SISTEMA || 'Prisma Flows',
    subtitulo: cfg.SUBTITULO || '',
    atualizarSegundos: Math.max(10, parseInt(cfg.ATUALIZAR_SEGUNDOS, 10) || 30)
  };
  if (u && u.perfil === 'ADM') {
    o.itens = CONFIG_PADRAO.map(function (c) { return { chave: c[0], valor: cfg[c[0]] !== undefined ? cfg[c[0]] : c[1], descricao: c[2] }; });
  }
  return o;
}

/* =========================================================================
 * PLANILHA — LEITURA E ESCRITA PELO CABEÇALHO
 * ========================================================================= */

function planilha_() {
  if (!PLANILHA_) PLANILHA_ = SpreadsheetApp.getActiveSpreadsheet();
  return PLANILHA_;
}

function fuso_() {
  if (!FUSO_) {
    try { FUSO_ = planilha_().getSpreadsheetTimeZone() || Session.getScriptTimeZone() || 'America/Sao_Paulo'; } catch (err) { FUSO_ = 'America/Sao_Paulo'; }
  }
  return FUSO_;
}

function aba_(chave) {
  const def = ABAS[chave];
  if (CACHE_ABAS_[chave]) return CACHE_ABAS_[chave];
  let sh = planilha_().getSheetByName(def.nome);
  if (!sh) {
    garantirEstrutura_(true);
    sh = planilha_().getSheetByName(def.nome);
  }
  if (sh) CACHE_ABAS_[chave] = sh;
  return sh;
}

/** Formato das colunas de data/hora: aplicado uma vez na coluna inteira, em vez de a cada gravação. */
function formatoDaColuna_(nome) {
  if (FORMATO_DATA[nome]) return FORMATO_DATA[nome];
  return /_em$|^Data_hora$/.test(nome) ? FORMATO_DATA_HORA : '';
}

function formatarColunasDeData_(sh) {
  const cab = cabecalho_(sh);
  const linhas = Math.max(sh.getMaxRows() - 1, 1);
  cab.forEach(function (h, i) {
    const f = formatoDaColuna_(h);
    if (f) sh.getRange(2, i + 1, linhas, 1).setNumberFormat(f);
  });
}

/** Cria abas e colunas que faltam. Nunca apaga nem reordena nada que já existe. */
function garantirEstrutura_(forcar) {
  const props = PropertiesService.getScriptProperties();
  if (!forcar && props.getProperty('SCHEMA_VERSION') === SCHEMA_VERSION) return;
  const executar = function () {
    const ss = planilha_();
    Object.keys(ABAS).forEach(function (chave) {
      const def = ABAS[chave];
      let sh = ss.getSheetByName(def.nome);
      if (!sh) sh = ss.insertSheet(def.nome);
      const cab = cabecalho_(sh);
      const existentes = cab.map(normalizar_);
      const faltando = def.colunas.filter(function (c) { return existentes.indexOf(normalizar_(c)) === -1; });
      if (faltando.length) {
        sh.getRange(1, cab.length + 1, 1, faltando.length).setValues([faltando]).setFontWeight('bold');
      }
      if (sh.getFrozenRows() < 1) sh.setFrozenRows(1);
      formatarColunasDeData_(sh);
    });
    CACHE_ABAS_ = {};
    limparCache_();
    const tcfg = lerTabela_('CONFIG');
    const chaves = tcfg.linhas.map(function (o) { return textoDe_(o.Chave); });
    inserirVarios_(tcfg, CONFIG_PADRAO.filter(function (c) { return chaves.indexOf(c[0]) === -1; })
      .map(function (c) { return { Chave: c[0], Valor: c[1], Descricao: c[2] }; }));
    props.setProperty('SCHEMA_VERSION', SCHEMA_VERSION);
  };
  if (TRAVA_ATIVA_) executar(); else comTrava_(executar);
}

function cabecalho_(sh) {
  const ultima = sh.getLastColumn();
  if (!ultima) return [];
  const cab = sh.getRange(1, 1, 1, ultima).getValues()[0].map(function (v) { return String(v).trim(); });
  while (cab.length && !cab[cab.length - 1]) cab.pop();
  return cab;
}

/**
 * Lê uma aba inteira e devolve objetos com os campos do esquema + _linha + _extras.
 * Linhas digitadas direto na planilha sem ID ganham um ID automaticamente.
 */
function lerTabela_(chave) {
  if (CACHE_TABELAS_[chave]) return CACHE_TABELAS_[chave];
  const def = ABAS[chave];
  const sh = aba_(chave);
  const valores = sh.getDataRange().getValues();
  const cab = (valores[0] || []).map(function (v) { return String(v).trim(); });
  while (cab.length && !cab[cab.length - 1]) cab.pop();
  const mapa = {};
  cab.forEach(function (h, i) { const n = normalizar_(h); if (n && !(n in mapa)) mapa[n] = i; });
  const conhecidas = {};
  def.colunas.forEach(function (c) { conhecidas[normalizar_(c)] = true; });
  const vistos = {};
  const extras = cab.filter(function (h) {
    const n = normalizar_(h);
    if (!n || conhecidas[n] || vistos[n]) return false;
    vistos[n] = true;
    return true;
  });

  const linhas = [];
  for (let r = 1; r < valores.length; r++) {
    const row = valores[r];
    if (!row.some(function (v) { return v !== '' && v !== null; })) continue;
    const o = { _linha: r + 1 };
    def.colunas.forEach(function (c) {
      const i = mapa[normalizar_(c)];
      const v = i === undefined ? '' : row[i];
      o[c] = (typeof v === 'string') ? v.trim() : v;
    });
    if (extras.length) {
      o._extras = {};
      extras.forEach(function (h) { o._extras[h] = row[mapa[normalizar_(h)]]; });
    }
    if (o.ID !== undefined && typeof o.ID !== 'string') o.ID = textoDe_(o.ID);
    ['Quadro_ID', 'Lista_ID', 'Cartao_ID'].forEach(function (k) { if (o[k] !== undefined) o[k] = textoDe_(o[k]); });
    linhas.push(o);
  }
  const t = { chave: chave, def: def, sh: sh, cab: cab, mapa: mapa, extras: extras, linhas: linhas };
  if (def.prefixo) completarIds_(t);
  CACHE_TABELAS_[chave] = t;
  return t;
}

function completarIds_(t) {
  const sem = t.linhas.filter(function (o) { return !o.ID; });
  if (!sem.length) return;
  const executar = function () {
    // Relê a coluna de ID dentro da trava: outra execução pode ter preenchido antes.
    const col = colunaDe_(t, 'ID');
    const ultima = t.sh.getLastRow();
    const ids = ultima > 1 ? t.sh.getRange(2, col, ultima - 1, 1).getValues() : [];
    let maior = 0;
    ids.forEach(function (r) { const m = textoDe_(r[0]).match(/(\d+)$/); if (m) maior = Math.max(maior, parseInt(m[1], 10)); });
    t._seq = Math.max(t._seq || 0, maior);
    sem.forEach(function (o) {
      const atual = ids[o._linha - 2] ? textoDe_(ids[o._linha - 2][0]) : '';
      if (atual) { o.ID = atual; return; }
      gravarCampos_(t, o, { ID: proximoId_(t) });
    });
  };
  if (TRAVA_ATIVA_) executar(); else comTrava_(executar);
}

function colunaDe_(t, campo) {
  const n = normalizar_(campo);
  if (t.mapa[n] === undefined) {
    const col = t.cab.length + 1;
    t.sh.getRange(1, col).setValue(campo).setFontWeight('bold');
    t.cab.push(campo);
    t.mapa[n] = col - 1;
  }
  return t.mapa[n] + 1;
}

function gravarCampos_(t, obj, campos) {
  const pares = Object.keys(campos).map(function (campo) {
    let v = campos[campo];
    if (v === undefined || v === null) v = '';
    return { campo: campo, col: colunaDe_(t, campo), v: v };
  }).sort(function (a, b) { return a.col - b.col; });
  // Colunas vizinhas vão numa gravação só (a planilha cobra por chamada, não por célula).
  for (let i = 0; i < pares.length;) {
    let j = i;
    while (j + 1 < pares.length && pares[j + 1].col === pares[j].col + 1) j++;
    const grupo = pares.slice(i, j + 1);
    const rg = t.sh.getRange(obj._linha, grupo[0].col, 1, grupo.length);
    if (grupo.length === 1) rg.setValue(grupo[0].v); else rg.setValues([grupo.map(function (g) { return g.v; })]);
    grupo.forEach(function (g) {
      if (ehData_(g.v) && !formatoDaColuna_(g.campo)) t.sh.getRange(obj._linha, g.col).setNumberFormat(FORMATO_DATA_HORA);
    });
    i = j + 1;
  }
  pares.forEach(function (par) {
    const campo = par.campo;
    const v = par.v;
    if (t.extras.indexOf(campo) !== -1) {
      obj._extras = obj._extras || {};
      obj._extras[campo] = comoLido_(v);
    } else {
      obj[campo] = comoLido_(v);
    }
  });
}

/** O que a planilha devolve depois de gravar: o apóstrofo de proteção não faz parte do valor. */
function comoLido_(v) {
  return (typeof v === 'string' && v.charAt(0) === "'") ? v.slice(1) : v;
}

function inserir_(t, obj) {
  Object.keys(obj).forEach(function (c) { colunaDe_(t, c); });
  let ultimoIdx = 0;
  Object.keys(obj).forEach(function (c) { ultimoIdx = Math.max(ultimoIdx, t.mapa[normalizar_(c)]); });
  const row = [];
  for (let i = 0; i <= ultimoIdx; i++) row.push('');
  Object.keys(obj).forEach(function (c) { row[t.mapa[normalizar_(c)]] = obj[c] === undefined || obj[c] === null ? '' : obj[c]; });
  t.sh.appendRow(row);
  const linha = t.sh.getLastRow();
  Object.keys(obj).forEach(function (c) {
    if (ehData_(obj[c]) && !formatoDaColuna_(c)) t.sh.getRange(linha, t.mapa[normalizar_(c)] + 1).setNumberFormat(FORMATO_DATA_HORA);
  });
  const o = { _linha: linha };
  Object.keys(obj).forEach(function (c) { o[c] = comoLido_(obj[c]); });
  t.linhas.push(o);
  return o;
}

/** Grava várias linhas de uma vez (uma chamada à planilha em vez de uma por linha). */
function inserirVarios_(t, objs) {
  if (!objs.length) return [];
  objs.forEach(function (obj) { Object.keys(obj).forEach(function (c) { colunaDe_(t, c); }); });
  let maior = 0;
  objs.forEach(function (obj) { Object.keys(obj).forEach(function (c) { maior = Math.max(maior, t.mapa[normalizar_(c)]); }); });
  const largura = maior + 1;
  const matriz = objs.map(function (obj) {
    const row = [];
    for (let i = 0; i < largura; i++) row.push('');
    Object.keys(obj).forEach(function (c) { row[t.mapa[normalizar_(c)]] = obj[c] === undefined || obj[c] === null ? '' : obj[c]; });
    return row;
  });
  const primeira = t.sh.getLastRow() + 1;
  const faltam = primeira + matriz.length - 1 - t.sh.getMaxRows();
  if (faltam > 0) t.sh.insertRowsAfter(t.sh.getMaxRows(), faltam);
  t.sh.getRange(primeira, 1, matriz.length, largura).setValues(matriz);
  return objs.map(function (obj, i) {
    Object.keys(obj).forEach(function (c) {
      if (ehData_(obj[c]) && !formatoDaColuna_(c)) t.sh.getRange(primeira + i, t.mapa[normalizar_(c)] + 1).setNumberFormat(FORMATO_DATA_HORA);
    });
    const o = { _linha: primeira + i };
    Object.keys(obj).forEach(function (c) { o[c] = comoLido_(obj[c]); });
    t.linhas.push(o);
    return o;
  });
}

function acharPorId_(t, id) {
  const alvo = textoDe_(id);
  if (!alvo) return null;
  return t.linhas.filter(function (o) { return o.ID === alvo; })[0] || null;
}

function proximoId_(t) {
  if (t._seq === undefined) {
    let maior = 0;
    t.linhas.forEach(function (o) {
      const m = textoDe_(o.ID).match(/(\d+)$/);
      if (m) maior = Math.max(maior, parseInt(m[1], 10));
    });
    t._seq = maior;
  }
  t._seq += 1;
  return t.def.prefixo + '-' + String(t._seq).padStart(4, '0');
}

function lerConfig_() {
  const cfg = {};
  CONFIG_PADRAO.forEach(function (c) { cfg[c[0]] = c[1]; });
  const sh = planilha_().getSheetByName(ABAS.CONFIG.nome);
  if (!sh) return cfg;
  lerTabela_('CONFIG').linhas.forEach(function (o) {
    const k = textoDe_(o.Chave);
    if (k) cfg[k] = ehData_(o.Valor) ? Utilities.formatDate(o.Valor, fuso_(), 'dd/MM/yyyy') : textoDe_(o.Valor);
  });
  return cfg;
}

function lerLogRecente_() {
  const sh = aba_('LOG');
  const cab = cabecalho_(sh);
  const ultima = sh.getLastRow();
  if (ultima < 2 || !cab.length) return [];
  const inicio = Math.max(2, ultima - LIMITE_LOG_LEITURA + 1);
  const valores = sh.getRange(inicio, 1, ultima - inicio + 1, cab.length).getValues();
  const idx = {};
  cab.forEach(function (h, i) { idx[normalizar_(h)] = i; });
  return valores.map(function (row) {
    const o = {};
    ABAS.LOG.colunas.forEach(function (c) { const i = idx[normalizar_(c)]; o[c] = i === undefined ? '' : row[i]; });
    o.Entidade_ID = textoDe_(o.Entidade_ID);
    return o;
  });
}

function registrar_(u, acao, entidade, entidadeId, quadroId, detalhe) {
  try {
    if (!CACHE_LOG_) {
      const sh = aba_('LOG');
      const cab = cabecalho_(sh);
      CACHE_LOG_ = { chave: 'LOG', def: ABAS.LOG, sh: sh, cab: cab, mapa: {}, extras: [], linhas: [] };
      cab.forEach(function (h, i) { const n = normalizar_(h); if (n && !(n in CACHE_LOG_.mapa)) CACHE_LOG_.mapa[n] = i; });
    }
    const t = CACHE_LOG_;
    t.linhas.length = 0;
    inserir_(t, {
      Data_hora: new Date(), Usuario: (u && u.email) || '', Acao: acao, Entidade: entidade,
      Entidade_ID: entidadeId || '', Quadro_ID: quadroId || '', Detalhe: textoSeguro_(String(detalhe || '').slice(0, 500))
    });
  } catch (err) { /* log nunca derruba a operação */ }
}

/* =========================================================================
 * TRAVA E VERSÃO (para as telas abertas saberem quando recarregar)
 * ========================================================================= */

function comTrava_(fn) {
  if (TRAVA_ATIVA_) return fn();
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw new Error('O sistema está salvando outra alteração. Tente de novo em alguns segundos.');
  TRAVA_ATIVA_ = true;
  limparCache_();
  try {
    return fn();
  } finally {
    try { SpreadsheetApp.flush(); } catch (err) { /* segue para soltar a trava */ }
    TRAVA_ATIVA_ = false;
    lock.releaseLock();
  }
}

function resposta_(quadroId, dados) {
  const props = PropertiesService.getScriptProperties();
  const chave = 'v_' + quadroId;
  const atual = parseInt(props.getProperty(chave), 10) || 0;
  const planilha = props.getProperty('v_planilha') || '0';
  props.setProperty(chave, String(atual + 1));
  const r = dados || {};
  r.ok = true;
  r.versaoAnterior = atual + '|' + planilha;
  r.versao = (atual + 1) + '|' + planilha;
  return r;
}

/** Avisa as telas abertas em outro quadro (ex.: destino de um cartão movido) que algo mudou lá. */
function marcarVersaoQuadro_(quadroId) {
  const props = PropertiesService.getScriptProperties();
  const chave = 'v_' + quadroId;
  props.setProperty(chave, String((parseInt(props.getProperty(chave), 10) || 0) + 1));
}

function versaoAtual_(quadroId) {
  const props = PropertiesService.getScriptProperties();
  return (parseInt(props.getProperty('v_' + quadroId), 10) || 0) + '|' + (props.getProperty('v_planilha') || '0');
}

/* =========================================================================
 * UTILITÁRIOS
 * ========================================================================= */

function erro_(codigo, mensagem) {
  const e = new Error(mensagem);
  e.codigo = codigo;
  return e;
}

function normalizar_(v) {
  return String(v === null || v === undefined ? '' : v)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]/g, '');
}

function textoDe_(v) {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

/** Limpa texto vindo do navegador. multilinha mantém quebras de linha. */
function textoLimpo_(v, max, multilinha) {
  let s = String(v === null || v === undefined ? '' : v);
  s = multilinha ? s.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000B-\u001F]/g, '') : s.replace(/[\u0000-\u001F]+/g, ' ');
  s = s.trim();
  return max ? s.slice(0, max) : s;
}

/** Impede que texto vire fórmula ou número na planilha (ex.: "=SOMA", "007", "1/2"). */
function textoSeguro_(s) {
  s = String(s === null || s === undefined ? '' : s);
  if (!s) return s;
  if (/^[=+\-@]/.test(s) || /^[\d\s.,/:%R$-]+$/.test(s)) return "'" + s;
  return s;
}

function ativo_(v) {
  const n = normalizar_(v);
  return !(n === 'nao' || n === 'n' || n === 'false' || n === '0' || n === 'inativo' || n === 'arquivado');
}

function sim_(v) {
  if (v === true) return true;
  const n = normalizar_(v);
  return n === 'sim' || n === 's' || n === 'true' || n === '1' || n === 'x' || n === 'ok' || n === 'concluido' || n === 'feito';
}

function separar_(v) {
  return String(v === null || v === undefined ? '' : v)
    .split(/[,;\n]/).map(function (s) { return s.trim(); }).filter(String);
}

function separarConfig_(v) {
  return String(v || '').split(';').map(function (s) { return s.trim(); }).filter(String);
}

function unicos_(arr) {
  const vistos = {};
  return arr.filter(function (x) { const k = normalizar_(x); if (vistos[k]) return false; vistos[k] = true; return true; });
}

function listaEmails_(v) {
  const arr = Array.isArray(v) ? v : separar_(v);
  return unicos_(arr.map(function (e) { return String(e).trim().toLowerCase(); })
    .filter(function (e) { return /^[^\s@]+@[^\s@]+$/.test(e); }));
}

function igualEmail_(a, b) {
  const x = textoDe_(a).toLowerCase();
  return !!x && x === textoDe_(b).toLowerCase();
}

function nomeDoEmail_(email) {
  const base = textoDe_(email).split('@')[0] || 'Usuário';
  return base.split(/[._\-]+/).filter(String).map(function (p) { return p.charAt(0).toUpperCase() + p.slice(1); }).join(' ');
}

function perfilValido_(v) {
  const n = normalizar_(v);
  if (n === 'adm' || n === 'admin' || n === 'administrador') return 'ADM';
  if (n === 'leitor' || n === 'leitura' || n === 'visualizador') return 'Leitor';
  return 'Membro';
}

function prioridadeValida_(v) {
  const n = normalizar_(v);
  return PRIORIDADES.filter(function (p) { return normalizar_(p) === n; })[0] || '';
}

function visibilidadeValida_(v) {
  return normalizar_(v) === 'privado' ? 'Privado' : 'Equipe';
}

function corValida_(v) {
  const s = textoDe_(v);
  return /^#[0-9A-Fa-f]{6}$/.test(s) ? s.toUpperCase() : '';
}

function ehData_(v) {
  return Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime());
}

/** Data para 'yyyy-MM-dd'. Aceita Date, 'dd/mm/aaaa' e 'aaaa-mm-dd' digitados na planilha. */
function dataIso_(v, tz) {
  if (ehData_(v)) return Utilities.formatDate(v, tz, 'yyyy-MM-dd');
  const s = textoDe_(v);
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return m[1] + '-' + m[2] + '-' + m[3];
  return '';
}

function dataHoraIso_(v, tz) {
  if (ehData_(v)) return Utilities.formatDate(v, tz, "yyyy-MM-dd'T'HH:mm:ss");
  return '';
}
