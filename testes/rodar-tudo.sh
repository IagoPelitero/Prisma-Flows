#!/usr/bin/env bash
# Roda os testes do servidor e, se pedido, os de navegador.  Uso: bash rodar-tudo.sh [navegador]
cd "$(dirname "$0")" || exit 1
CODIGO=../codigo/Code.gs
falhou=0

roda() {  # roda <nome> <arquivo-de-teste> [VAR=valor ...]
  local nome="$1" arq="$2"; shift 2
  local saida
  saida=$(env "$@" node simulador.js "$CODIGO" cabecalhos.json "$arq" 2>&1)
  if echo "$saida" | grep -q "FALHA\|Error\|RETORNO ILEGAL\|falha interna(s)\|PERIGOSAS"; then
    if echo "$saida" | grep -q "TUDO OK\|nenhuma falha interna"; then
      # a robustez imprime avisos inofensivos da Config; só falha se houver erro interno
      echo "$saida" | grep -q "tipo(s) de falha interna" && { echo "FALHOU  $nome"; echo "$saida" | tail -15; falhou=1; return; }
      echo "OK      $nome"; return
    fi
    echo "FALHOU  $nome"; echo "$saida" | grep -v "^OK" | head -15; falhou=1
  else
    echo "OK      $nome"
  fi
}

echo "== Servidor =="
roda "duplicar cartão"        teste-duplicar-cartao.js
roda "carrossel"              teste-carrossel.js
roda "editar a vez"           teste-editar-vez.js
roda "almoço e home"          teste-almoco-home.js
roda "datas, rotinas, escala" teste-agenda-datas.js
roda "robustez (fuzz)"        teste-robustez.js SEED=dados-volume.js

echo; echo "== Velocidade (estimativa) =="
SEED=dados-volume.js node simulador.js "$CODIGO" cabecalhos.json medir-velocidade.js 2>&1 | sed 's/leituraTabela/lerTab/;s/leituraPequena/lerPeq/'

if [ "$1" = "navegador" ]; then
  echo; echo "== Navegador =="
  porta=$((8800 + RANDOM % 150))
  for t in navegador-1-carrossel-vez-almoco navegador-2-funcoes-existentes navegador-3-digitacao-rapida navegador-4-duas-pessoas; do
    porta=$((porta + 1))
    PORT=$porta LAT=0.2 SEED=dados-navegador.js node simulador.js "$CODIGO" cabecalhos.json x > /tmp/simulador.log 2>&1 &
    pid=$!; sleep 2
    if PORT=$porta node "$t.js" > "/tmp/$t.log" 2>&1; then echo "OK      $t"; else echo "FALHOU  $t"; grep -v "^OK" "/tmp/$t.log" | head -12; falhou=1; fi
    kill $pid 2>/dev/null; wait $pid 2>/dev/null
  done
fi
exit $falhou
