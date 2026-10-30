# Prisma Flows

Kanban no estilo Trello feito em Google Planilhas + Apps Script (Pelitero Labs). A planilha é o banco de dados:
cada aba é uma tabela. O sistema roda como App da Web.

## O que tem neste repositório

| Pasta ou arquivo | O que é |
|---|---|
| `Prisma_Flows_Codigo.xlsx` | **O código completo**, uma aba por arquivo do Apps Script (`Code.gs`, `Index.html`, `Estilos.html`, `Script.html`), com instruções de colagem na aba LEIA-ME. |
| `Prisma_Flows.xlsx` | A base de dados vazia (abas e cabeçalhos). Só é necessária numa instalação do zero. |
| `codigo/` | Os mesmos arquivos em texto puro, para ver diferenças no GitHub. |
| `testes/` | Simulador do Google e testes automáticos (ver `testes/LEIA-ME.md`). |
| `imagens/` | Imagens de divulgação. |

> `codigo/Index.html` é uma **reconstrução**. Se você já tem um `Index.html` funcionando no Apps Script, mantenha o seu.

## Como instalar ou atualizar

1. Abra a planilha no Google Planilhas e vá em **Extensões > Apps Script**.
2. Para cada aba de `Prisma_Flows_Codigo.xlsx`, copie as células da coluna A (o LEIA-ME mostra o intervalo, por exemplo `COPIAR_CODE`) e cole no arquivo de mesmo nome do Apps Script. Os HTML precisam se chamar exatamente `Index`, `Estilos` e `Script`.
3. Salve e faça **Implantar > Gerenciar implantações > lápis > Versão: Nova versão**. A URL continua a mesma.
4. Abra a URL. Na primeira abertura depois de uma atualização o sistema cria sozinho as abas e colunas novas (pode levar uns 10 segundos, só desta vez).

Ao atualizar, **não é preciso trocar a planilha de dados**: ela se completa sozinha.

## O que o sistema faz

### Quadros e cartões
Quadros com listas e cartões, responsáveis, prazo, prioridade, etiquetas, checklist, comentários e histórico. Arrastar e soltar, filtros, limite de cartões por lista, arquivar e restaurar, mover cartão para outro quadro, **duplicar cartão**, rotinas que criam cartões todo dia, semana ou mês, e atualização automática quando outra pessoa mexe no quadro.

### Escala da semana e a vez
Rodízio semanal das pessoas entre as frentes (listas marcadas como frente). O caso novo vai para quem está na vez, pulando ausentes. Na lista, o **lápis ao lado de "Na vez"** abre a escala da semana, onde **Colocar na vez** muda quem recebe o próximo caso.

### Escalas por quadro (botões Almoço, Home e Mensal no cabeçalho do quadro)
- **Almoço:** turno de almoço de cada pessoa em cada dia, com horários e máximo por horário configuráveis.
- **Home:** dias de home da semana. O dado é da pessoa e vale em todos os quadros e na tela Equipe.
- **Mensal:** grade dia a dia do mês (só segunda a sexta) com **1º horário, 2º horário ou Férias**. O dado é da pessoa: o que se marca no quadro aparece na aba **Mensal** da tela Equipe e vice-versa. No quadro, quem edita o quadro ajusta a equipe dele; na tela Equipe só ADM edita. "Férias" é só um texto da grade e **não** altera Ausências nem o rodízio.

### Tipos de lista
Ao criar uma lista, escolha o tipo:
- **Normal:** recebe cartões.
- **Rotatividade semanal:** tarefas que se repetem todo dia útil e mostram quem cuida delas nesta semana e na próxima. Os nomes giram a cada segunda na ordem escolhida, ou ficam fixos ("Manter o mesmo nome"). O nome pode ser trocado a qualquer hora, só para aquela semana.
- **Recorrente:** fila de pessoas, cada uma com nome, texto e a caixa **Atendi**. Ao marcar, a pessoa vai para o fim da fila e o primeiro é o da vez. Tem Desfazer e Colocar na vez.

Listas de rodízio **não recebem cartões** e não aparecem como destino de cartão, de rotina ou de frente da escala. Todas as listas têm barra de rolagem quando ficam grandes.

### Cartão Carrossel
Dentro de um cartão: **Transformar em carrossel** cria uma fila de pessoas com a caixa **Atendi** (rodízio de ligações). O quadro mostra "Vez: Ana · 4" no cartão.

### Equipe
Home e presencial por semana, escala mensal, banco de horas com aprovação, férias e folgas (ausências).

## Permissões
- **ADM:** tudo, incluindo Administração e a escala mensal da tela Equipe.
- **Membro:** edita os quadros que vê (cartões, listas, vez, escalas do quadro).
- **Leitor:** só visualiza.
- Configurar escalas, equipe do quadro e rotinas: dono do quadro ou ADM.

## Abas da planilha (criadas automaticamente quando faltam)
`Quadros`, `Listas`, `Cartoes`, `Checklist`, `Comentarios`, `Carrossel`, `Etiquetas`, `Escala`, `Ausencias`, `Rotinas`, `Presenca`, `Almoco`, `Mensal`, `Rotativa`, `Recorrente`, `BancoHoras`, `Usuarios`, `Config`, `Log`.
Nada é apagado: arquivar só marca `Ativo = Não`.

## Histórico de versões

### 1.5.0
- **Escala mensal** (1º horário, 2º horário ou Férias, dia a dia) no quadro (botão **Mensal**) e na tela Equipe (aba **Mensal**), com os mesmos dados. Nova aba `Mensal`.
- **Correção:** as listas de rotatividade semanal e recorrente agora **rolam** quando têm muitos itens; o título e o botão de adicionar continuam visíveis.

### 1.4.0
- Tipos de lista: **Rotatividade semanal** e **Recorrente**. Novas abas `Rotativa` e `Recorrente` e coluna `Tipo` em `Listas`.

### 1.3.0
- **Cartão Carrossel**, **editar a vez** (lápis e Colocar na vez), escalas de **Almoço** e **Home** por quadro, **duplicar cartão**.
- Mais velocidade (cada aba é lida uma vez por chamada, gravações em lote) e correções no banco de horas e nas rotinas.

## Testes
Veja `testes/LEIA-ME.md`. Resumo: `bash testes/rodar-tudo.sh` roda os testes do servidor; com `navegador` roda também os de tela.
O simulador não é o Google: os tempos são estimativas, e vale conferir no Apps Script real depois de colar o código.
