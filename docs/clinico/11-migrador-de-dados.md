# 11 · Migrador de dados da clínica

> Trazer a base da clínica de outro sistema: subir o arquivo, responder o que só a clínica sabe,
> conferir o que vai entrar e confirmar. No fim, cada linha da planilha tem um destino explicado — inclusive
> a que não entrou.

## Por que existe

É a funcionalidade que decide a venda, e quase ninguém a trata como produto. Nenhuma clínica troca
de sistema se tiver que redigitar quinze anos de pacientes. E é também a que mais facilmente
destrói a confiança no primeiro dia: basta uma importação calada que perde dado.

## Pronto quando

Uma planilha real e bagunçada de clínica entra e sai do outro lado com o operador entendendo o que
aconteceu com cada linha.

---

## Como usar

1. **Pacientes → Importar planilha** (ao lado de "Cadastrar novo paciente"). Rota:
   `/veterinario/paciente/importar`.
2. **Arquivo.** Arrastar ou escolher um `.xlsx` ou `.csv` — ou usar um dos três exemplos.
3. **Dúvidas.** Uma pergunta por vez: primeiro as espécies que o sistema não reconheceu, depois o
   que só a pessoa sabe (é a mesma pessoa? de quem é este animal? já é cliente?). Responder leva
   sozinho à próxima. **Sem pergunta, o passo é pulado** e o arquivo cai direto no resumo.
4. **Importar.** O resumo em três caixas — vão entrar, arrumamos sozinhos, não vão entrar — e o
   botão "Importar 33 linhas". Depois, o progresso por lote (com pausa) e o relatório nas mesmas
   três caixas, com os arquivos para baixar.

**Nada é gravado antes do botão de importar**, e o resumo só abre com toda pergunta respondida.
Toda pergunta tem uma resposta segura ("pessoas diferentes", "deixar de fora"), então ninguém fica
preso nela.

### As colunas não são um passo

A primeira versão refeita tinha um passo "Colunas" ("reconhecemos 18 de 20, confira estas três"). O
retorno foi que quem opera o balcão não entende "ligar coluna a campo" — e não precisa:

- **O sistema liga sozinho**, pelo nome da coluna (sinônimos em português, a assinatura dos
  exports conhecidos) e, quando o nome não diz, pelo conteúdo.
- **Só o obrigatório vira pergunta.** Se ele não acha a coluna do nome do animal ou do responsável,
  a primeira dúvida é "Qual coluna tem o nome do animal?", com as colunas mostradas como a pessoa
  as vê: letra, título e o começo do conteúdo ("Rex, Mel, Thor"). Se a planilha não tem essa
  informação, a saída é trocar de arquivo — sem ela não há o que importar.
- **Nada sai calado.** O resumo diz numa linha "Usamos 18 de 20 colunas da planilha. Ficaram de
  fora: Obs, Sem título." e a pílula **Ver colunas** (também na barra do arquivo) abre o painel de
  colunas: primeiro as que ficaram de fora, depois as usadas, cada uma com o "vai para" editável.
  Tirar um obrigatório por lá devolve a pergunta; uma troca que cria dúvida nova (uma coluna de
  espécie com valor desconhecido) leva a ela ao fechar o painel.

## As três demonstrações

| Demonstração | Linhas | Para mostrar |
|---|---|---|
| **Planilha feita na clínica** | 39 | Todos os casos difíceis de uma vez. Cada linha tem um porquê anotado em `data/fixtures/planilhas-de-demonstracao.ts`. Dá para **baixar** e subir o arquivo de verdade |
| **Export do SimplesVet** | ~120 | Origem reconhecida: o mapeamento nasce certo, sem nenhuma sugestão para conferir. Um cliente (Daniel e a Sushi) já está na clínica |
| **Export do Vetus, base grande** | 2.400 | Progresso, pausa, continuar depois. Zero perguntas; 15 animais com espécie "OUTROS" no de-para |

Resultado da planilha bagunçada: **7 perguntas** (2 espécies e 5 dúvidas). Respondendo "Canina"
para a Lua, "deixar de fora" para o peixe, "pessoas diferentes" nas duas Marias, "sim" na Luciana e
"ligar os 3" nos animais sem responsável, o resumo fica em **33 linhas entram, 18 corrigidas, 4 não
entram** (e 2 linhas em branco ignoradas).

## Como a tela se organiza

A primeira versão foi recusada ("telas feias e confusas, botões que quase não se veem, conteúdo mal
dividido") e refeita do zero. A de agora segue duas escolhas do usuário: **uma coisa por vez**, e o
**acabamento da Visão geral** (`components/home/home-card.css`).

- **Assistente numa coluna.** Cabeçalho da Visão geral (título grande, frase em degradê, fundo com
  brilho sálvia e grade fina), um trilho de três passos com nome, e um cartão por passo. Quando
  não houve pergunta, o trilho do meio diz "Nenhuma dúvida" em vez de parecer pulado.
- **Toda ação é pílula visível**: cheia (degradê sálvia, texto branco) para o próximo passo,
  contornada (borda sálvia) para o resto. Não há botão transparente. A resposta dada fica marcada
  com borda, fundo e visto. As regras estão em `components/migracao/migracao.css`.
- **Colunas num painel lateral**, como as linhas: o que ficou de fora primeiro, com a contagem de
  células que não vêm; cada coluna é a letra do Excel, o título, três exemplos do conteúdo e o "vai
  para" em português. Depois do botão de importar, o painel só mostra — o plano já está congelado.
- **Dúvidas**: a pergunta em letra grande, uma frase de por quê, os dois lados lado a lado quando é
  comparação (nome, telefone, CPF, o animal de cada um) e as respostas como pílulas grandes. A
  troca de pergunta anima 160 ms, e desliga com `prefers-reduced-motion`.
- **Resumo e relatório em três caixas** — verde, azul (depois pêssego, "falta completar") e coral —,
  com número grande e a lista do que cada uma contém. Cada caixa tem "Ver quais".
- **Linha por linha num painel lateral**, aberto sob demanda: filtros com o nome das caixas, busca
  pelo número da linha, e cada linha abre em **frases** ("Telefone “(11) 8411-2299” não tinha o 9 do
  celular: ficou (11) 98411-2299."), com a linha original do arquivo recolhida no fim.

## O que é real e o que é encenado

| Parte | Situação |
|---|---|
| Leitura de `.csv` | **Real.** Separador descoberto (`;`, `,`, tabulação), aspas, quebra dentro de campo, BOM. Codificação descoberta: UTF-8 estrito, senão Windows-1252 — a tela avisa |
| Leitura de `.xlsx` | **Real, sem biblioteca.** Zip aberto com `DecompressionStream` do navegador, XML pelo `DOMParser`. Data formatada vira data, número longo sai sem notação científica, célula mesclada é preenchida e lembrada. Só a primeira aba com dados |
| `.xls` antigo (binário) | Recusado, com a instrução de salvar como `.xlsx` |
| Mapeamento, leitura dos valores, plano, duplicados | **Real** — domínio puro, o mesmo que a API vai rodar |
| Reconhecimento do SimplesVet e do Vetus | **Presumido.** Os cabeçalhos em `ORIGENS_CONHECIDAS` foram montados sem um arquivo real de cada sistema. Antes de vender "importa do SimplesVet", conferir com um export de verdade |
| Gravação | Na camada mocada, em lotes de 80, com a mesma forma que a API terá |
| Continuar depois | Pausa e continua **na mesma aba**: a importação segue se a pessoa sair da tela, e a lista de pacientes avisa. Recarregar a página recomeça o mock inteiro. Na API é um job no servidor |

## Casos difíceis

Os do requisito, e o que a tela faz com cada um. Todos acontecem na planilha de demonstração.

| Caso | O que acontece |
|---|---|
| Data em vários formatos | `12/03/2017`, `2020-05-02`, `05/11/17` (ano curto, interpretado), `43891` (serial do Excel), `mar/2021` e `2022` (sem dia: vira o dia 1 e diz), `3 anos` (idade: nascimento estimado), `04/23/2019` numa coluna brasileira (lido como americano porque só assim existe). `31/02/2020` e datas no futuro são descartadas |
| Telefone com máscara | Máscara, `+55`, `0xx11` e código de operadora são só forma. Sem DDD ganha o da clínica; celular antigo ganha o nono dígito; dois números na mesma célula viram telefone e telefone 2. `123` é descartado |
| Peso com vírgula | `12,8`, `32,4kg`, `4,500`. `95g` vira `0,095 kg` e diz. `350` num cão é descartado (acima de 150 kg só em equino: a Faísca de 430 kg entra) |
| Pet sem responsável | Linha logo abaixo de quem tem responsável parece célula mesclada que o csv desfez: pergunta "ligar a quem está acima?". Sem linha acima, fica de fora com o motivo. No `.xlsx`, a mescla é lida do arquivo e o responsável é preenchido sem pergunta |
| Responsável sem pet | Entra só como contato. Sem telefone nem e-mail, entra com o aviso "ninguém consegue avisar" |
| Registro pela metade | Animal sem nome, responsável sem nome e espécie desconhecida ficam de fora, cada um com o motivo e o que fazer. Sexo em branco entra como "não informado" |
| Duplicado contra a base | Mesmo CPF ou mesmo telefone de quem já está cadastrado: junta (padrão, revisável). Só o nome igual: **pergunta**. Animal do mesmo responsável com mesmo nome e espécie: junta ao paciente que já existe |
| Duplicado dentro da planilha | O mesmo responsável em várias linhas (mesmo CPF, ou mesmo nome e telefone) é um só. O mesmo animal duas vezes: junta, e a linha repetida diz onde discorda da primeira. Mesmo nome com telefones diferentes: pergunta "é a mesma pessoa?". Casal com o fixo da casa: duas pessoas, sem pergunta |
| Base grande | Lotes de 80, progresso em linhas, pausa entre lotes, lote que falha não grava e é repetido do mesmo ponto |
| Excel que estragou o dado | CPF que perdeu o zero da frente volta (e é conferido); CEP idem. Chip em notação científica (`9,82E+14`) é descartado com o motivo: os dígitos já se perderam no arquivo |
| Animal falecido | Não entra como paciente — ninguém recebe lembrete de vacina de um animal que já morreu |

## Decisões

- **Dado errado é pior que dado em branco.** CPF que não fecha os verificadores, e-mail sem
  domínio, data que não existe: o valor fica em branco, o resto da linha entra, e o relatório diz.
- **Nada se inventa para vencer um obrigatório.** Espécie desconhecida não vira "canina": ou alguém
  escolhe no de-para, ou a linha fica de fora. Sexo em branco fica em branco — por isso
  `Pet.sexo` passou a aceitar `null` (ver abaixo).
- **Juntar nunca apaga o que a clínica tinha.** Só preenche o que está em branco. Onde os dois
  discordam, fica o valor do cadastro, e o detalhe da linha mostra o que a planilha dizia.
  Telefone novo de quem já é cliente vira telefone 2, se houver lugar.
- **Semelhança forte decide sozinha, fraca pergunta.** CPF, telefone e "mesmo animal do mesmo
  responsável" juntam por padrão, sem virar pergunta (aparecem no resumo e na linha). Só o nome
  nunca decide.
- **Ajuste é listado, padronização é somada.** O que mudou de sentido ao ser lido aparece na linha;
  o que só mudou de forma (máscara, vírgula, maiúsculas) aparece como uma frase de contagem.
- **O que ficou de fora volta como planilha.** "Baixar essas linhas para corrigir" devolve as
  linhas originais, nas colunas do arquivo, com uma coluna "O que houve". Corrigidas no Excel,
  entram de novo pelo mesmo mapeamento.
- **O plano congela no começo da importação.** Sem isso, cada lote gravado faria o plano
  recalculado achar "já cadastrado" em tudo o que acabou de entrar.

## Onde está

| O quê | Arquivo |
|---|---|
| Planilha crua: csv, cabeçalho, número da linha | `domain/planilha.ts` — 8 testes |
| Mapeamento, leitura dos valores, plano, relatório | `domain/migracao.ts` — 20 testes em `domain/__tests__/migracao.spec.ts` |
| Leitura do arquivo (xlsx e csv) | `data/leitura-de-planilha.ts` — 5 testes (o xlsx é montado byte a byte no teste) |
| Gravação em lotes | `data/repositories/migracao-repository.ts` (operação `migracao.importar`, com taxa de falha no painel de desenvolvimento) |
| Etapas, fila de perguntas (coluna, espécie, decisão), pausa, continuar | `stores/migracao.ts` — 7 testes de ponta a ponta sobre a camada mocada |
| Demonstrações | `data/fixtures/planilhas-de-demonstracao.ts` |
| Telas | `components/migracao/` (um componente por passo, os painéis `MigracaoLinhas` e `MigracaoColunas` e o `migracao.css` das pílulas e caixas) e `pages/(accounts)/veterinario/paciente/importar.vue` |
| Colunas como a pessoa as vê | `composables/useColunasDaPlanilha.ts` (painel, pergunta de coluna e a linha do resumo) |
| Frases de cada linha | `composables/useRotulosDaMigracao.ts` |
| Aviso na lista de pacientes | `pages/(accounts)/veterinario/pacientes.vue` |
| Textos | `clinico.migracao.*` nos seis idiomas |

## Mudança no modelo

`Pet.sexo` passou de `PetSex` para `PetSex | null`. Quem mostra usa `formato.sexo()`, que escreve
"Sexo não informado" (cabeçalho do paciente, prévia do cadastro, prontuário impresso, folha de
documento e atestado de óbito). Na anamnese por voz, o sexo só conjuga as falas da consulta de
demonstração; em branco, usa o masculino genérico.

## Roteiro de demonstração (3 minutos)

1. Pacientes → **Importar planilha**. "Nada é gravado até você confirmar, no último passo."
2. No exemplo "Planilha feita na clínica", **Baixar**, abrir no Excel para mostrar a bagunça, e
   subir o arquivo. A tela acha o cabeçalho na linha 3, debaixo do título.
3. Sem passo de colunas: o arquivo abre direto na primeira **dúvida**. (Se alguém perguntar, a
   pílula **Ver colunas** mostra a ligação que o sistema fez sozinho, com o palpite Cel/WhatsApp →
   Telefone 2 marcado.)
4. **Dúvidas**, uma por vez: a espécie da Lua, o peixe (deixar de fora), as duas Marias lado a lado
   (pessoas diferentes), a Luciana que já é cliente (sim), e "ligar os 3" animais sem responsável.
5. **Resumo**: as três caixas. "Ver quais" na caixa azul, buscar a linha 14 (Thor do Eduardo) e
   abrir: celular sem o 9, e-mail incompleto, chip em notação científica, e onde a planilha
   discorda do cadastro que já existe.
6. **Importar 33 linhas**, e o relatório: "Baixar para corrigir" e mostrar a coluna "O que houve".
7. Para o progresso: **Trocar arquivo** → base grande do Vetus → importar e pausar no meio. Ir para
   a lista de pacientes — o aviso de importação pausada está lá — e continuar.

## Do lado do responsável

O responsável importado ainda não sabe que foi importado. O convite para o app — confirmar os
dados, ligar os pets da clínica aos pets do app ou criá-los, e recusar o que não é dele — está
descrito para o `petjourney-app` em [12-migracao-visao-do-responsavel.md](./12-migracao-visao-do-responsavel.md),
com os tipos já no contrato (`contrato/responsavel.ts`, seção "Vínculo proposto pela clínica").

## O que ainda não existe

- **Desfazer uma importação.** O relatório diz tudo o que entrou, mas não há "desfazer este
  lote". Na API, cada registro criado precisa guardar o id da importação para isso ser possível.
- **Histórico clínico.** Só cadastro (responsável e paciente, com alergia como alerta). Vacinas,
  consultas e peso ao longo do tempo pedem arquivos próprios e outro mapeamento.
- **Código do sistema anterior.** Não é guardado no paciente; a referência é o número da linha.
- **Castrado em branco** entra como "não": o modelo não tem "não informado" para esse campo.
- **Outras abas do xlsx**, `.xls` antigo e exports de outros sistemas além dos dois presumidos.
- **Continuar depois de recarregar** e continuar de outro aparelho: coisa do job no servidor.
- **Convite ao responsável pelo portal.** O botão não existe ainda; o lado do app está no doc 12.
