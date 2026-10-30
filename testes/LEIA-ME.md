# Testes do Prisma Flows

Antes de ir para o Grand Line, a tripulação treina na ilha. Esta pasta é a ilha de treino do Flows:
ela roda o **mesmo código** que vai para o Apps Script (`../codigo/`), mas sobre uma planilha de mentira
em memória. Assim dá para testar tudo sem mexer na sua planilha de verdade.

## O que tem aqui

| Arquivo | Para que serve |
|---|---|
| `simulador.js` | Finge ser o Google (Planilhas, trava, propriedades) e roda o `Code.gs`. Também serve a tela para o navegador. |
| `Index.html` | **Reconstrução** do `Index.html` só para os testes de navegador. Não substitui o seu, se você já tem um. |
| `cabecalhos.json`, `config.json` | Cabeçalhos das abas e valores padrão da Config, tirados do `Prisma_Flows.xlsx`. |
| `teste-*.js` | Testes do servidor: duplicar cartão, carrossel, editar a vez, almoço e home, listas de rodízio (rotatividade semanal e recorrente), escala mensal, datas e rotinas, robustez. |
| `medir-velocidade.js` | Conta as leituras e gravações de cada chamada e estima o tempo no Apps Script. |
| `navegador-*.js` | Testes de ponta a ponta: abrem a tela de verdade num navegador e clicam. |
| `rodar-tudo.sh` | Roda tudo e mostra o resultado. |

## Como rodar

Precisa do Node 18 ou mais novo.

```bash
cd testes
bash rodar-tudo.sh            # testes do servidor (rápidos)
```

Para incluir os testes de navegador:

```bash
npm install playwright-core
CHROMIUM=/caminho/do/chrome bash rodar-tudo.sh navegador
```

Um teste isolado:

```bash
node simulador.js ../codigo/Code.gs cabecalhos.json teste-carrossel.js
```

## O que os testes garantem

- **Servidor:** cada função com dados válidos e inválidos, permissões (ADM, Membro, Leitor), ordem e IDs.
- **Datas e rotinas:** todas as datas de 2026 a 2028 contra uma implementação de referência (diária, dias úteis, semanal, mensal com feriados e ajustes), e o rodízio da escala semanal.
- **Robustez:** mais de 25 mil chamadas com argumentos absurdos; nenhuma pode quebrar com erro interno do JavaScript.
- **Regras do Apps Script:** nada é gravado como fórmula, número ou data sem querer; nenhuma resposta à tela traz `Date`.
- **Navegador:** criar quadro, cartões, gaveta, checklist, comentários, arrastar e soltar, carrossel, editar a vez, almoço, home, listas de rodízio, rolagem de todas as listas quando ficam grandes, escala mensal no quadro e na Equipe, rotinas, equipe, banco de horas, administração e duas pessoas ao mesmo tempo.

## Limites

O simulador é fiel ao que o código usa, mas **não é o Google**: os tempos são estimativas
(leitura de tabela ~180 ms, gravação ~90 ms) e não existe a primeira abertura lenta do Apps Script.
Vale sempre conferir no Apps Script real depois de colar o código.
