# Frente clínico — avaliação heurística de usabilidade

Avaliado em 16/11/2026, conta `portal-demo@petjourney.test` (dona da "Clínica e Hotel Demo"), API de dev,
http://localhost:5191, 1440x900 (e 1024x768 onde indicado). Nada foi gravado: toda gaveta foi aberta e
fechada por Cancelar/Voltar/Fechar. A única escrita que a tela faz sozinha é a trava de edição do
rascunho ao abrir o prontuário da Mel (`abrir-edicao`), solta ao sair.

Capturas em `capturas\clinico\NN-nome.jpg` (citadas pelo nome do arquivo).

Personas: veterinária em consulta (olha de relance, precisa de alergia, histórico e dose), enfermagem
da internação (tablet, plantão) e gestora (estoque e números).

**Escala das notas por tela:** 1 (não dá para usar sem ajuda) a 5 (usa sem pensar).

---

## Resumo em uma página

O visual está resolvido; o que cansa é a **arquitetura**. Três causas explicam quase todos os achados:

1. **O animal não leva o seu cabeçalho clínico de uma tela para a outra.** O alerta "Alergia · Risco ·
   Dipirona" existe na ficha e na lista de pacientes, mas não aparece no prontuário, na gaveta de
   prescrever, na gaveta do horário nem na internação. Na própria ficha, a caixa da direita diz
   "Alergias: Nenhuma registrada".
2. **O menu agrupa por tipo de lista, não por trabalho.** Prontuários, Bulário e Cópias são abas de
   "Pacientes"; Vacinas, Tratamentos e Estoque são abas de "Pendências"; duas telas da internação
   (Boletins pendentes e Vagas) não têm entrada nenhuma. Em Estoque > Análise são quatro níveis de
   seletor empilhados.
3. **A ação mora longe do contexto e nada fica fixo.** Atender, vacinar, emitir documento e internar
   estão cada um numa caixa ou tela diferente; páginas de 2 a 5 telas rolam levando embora o nome do
   paciente, as abas e o botão de finalizar.

---

## 1. Atendimentos (lista)

- **Rota:** `/clinica/atendimentos` (menu Clínica > Pacientes > aba Atendimentos)
- **Fonte:** `src/components/atendimento/AtendimentosDaClinica.vue`
- **O que responde:** que prontuário ficou sem fecho e o que já foi registrado.
- **Primeira dobra** (`01-atendimentos.jpg`): cabeçalho "Pacientes / 2 rascunhos para finalizar" com o
  botão "Continuar o de Mel"; faixa de 5 abas; filtro "Todos | Rascunhos | Finalizados | Anulados" e a
  chave "Só os meus"; caixa "Para finalizar" (2 linhas com o selo "Aberto há 7 dias"); caixa
  "Registros" agrupada por dia. Cerca de 260 px de cabeçalho, abas e filtro antes da primeira caixa.

**Problemas**

1. **P1 — Prontuário é aba de "Pacientes".** O h1 da tela diz "Pacientes" e o destino do menu também;
   a veterinária que procura "meus prontuários abertos" não acha a palavra em lugar nenhum do menu. O
   selo do menu ("Pacientes 5") soma coisas diferentes: 2 rascunhos + 3 pedidos de cópia.
   *Correção:* dar nome e lugar próprios ("Prontuários"), com selo só de rascunhos; ver a proposta de
   arquitetura.
2. **P2 — Sem busca e sem período.** Só há status e "Só os meus". Achar a consulta de três semanas
   atrás é tocar "Ver mais" várias vezes ou ir pela ficha. *Correção:* campo "Paciente ou responsável"
   e filtro de período no alto.
3. **P2 — A linha não diz o que foi a consulta.** "Fubá / Consulta · Portal Demo". A linha do tempo da
   ficha mostra "Otite externa bacteriana" para o mesmo registro. *Correção:* diagnóstico principal na
   segunda linha para quem tem `prontuario.ler`.
4. **P2 — Hora diferente da do prontuário.** A lista mostra a hora em que fechou ("17:53", campo
   `finalizadoEm`); o cabeçalho do mesmo atendimento mostra "9 de nov. de 2026 19:00" (`realizadoEm`).
   Na Mel: lista "16:58", prontuário "17:30". *Correção:* uma hora só (a da consulta) nas duas telas.
5. **P2 — "Hoje" não traz para cá.** Em Hoje, "2 prontuários em rascunho · Mel, Nino" leva a
   `/clinica/atividades`, não a esta lista. *Correção:* o aviso abre `?status=RASCUNHO` ou o próprio
   rascunho.
6. **P3 — Texto de sistema.** "Rascunho aberto é atendimento sem fecho. O mais antigo primeiro."
   *Correção:* "Consultas que você ainda não finalizou."

**O que funciona:** a separação "Para finalizar" x "Registros"; o botão "Continuar o de Mel" (um clique
para o mais antigo); o selo de idade do rascunho.

**Nota: 3**

---

## 2. Atendimento (prontuário)

- **Rota:** `/clinica/atendimento/:id`
- **Fonte:** `src/components/atendimento/AtendimentoDaClinica.vue` e filhos (`AnamneseDoAtendimento`,
  `ExameDoAtendimento`, `DiagnosticoDoAtendimento`, `CondutaDoAtendimento`, `ReceitaDoAtendimento`,
  `PrescricaoGaveta`, `AssinarReceitaGaveta`, `FinalizarAtendimentoGaveta`, `AdendoGaveta`),
  `src/components/documentos/DocumentosDoPaciente.vue`, `DocumentoGaveta.vue`.
- **O que responde:** o registro de uma consulta, uma seção por vez.
- **Primeira dobra, rascunho** (`08-atendimento-rascunho-mel-anamnese.jpg`): "← Atendimentos"; "Mel /
  Consulta · 8 de nov. de 2026 17:30 · Portal Demo · Cachorro · 28,7 kg"; botões "Mais" e "Revisar e
  finalizar"; 5 abas (Anamnese, Exame físico, Diagnóstico, Conduta, Receita e documentos) com "Tudo
  salvo" à direita; uma linha "Consulta anterior, 8 de nov. de 2026 · … · Otite externa bacteriana ·
  28,7 kg  Abrir"; a caixa da seção.
- **Primeira dobra, finalizado** (`02-atendimento-fuba-finalizado.jpg`): o mesmo cabeçalho com "Mais" e
  "Adendo"; faixa "Finalizado em 9 de nov. de 2026 por Portal Demo / Registro fechado: para corrigir,
  escreva um adendo. / Resumo no app desde 9 de nov. de 2026."; as mesmas 5 abas com o formulário
  desabilitado.

**Problemas**

1. **P0 — A alergia do paciente não existe dentro do prontuário.** A Mel tem na ficha "Alergia · Risco
   · Dipirona: inchaço no focinho" e o selo "Alergia" na lista de pacientes. No prontuário dela: o
   cabeçalho não mostra alerta; a aba Diagnóstico diz "Antecedentes — Alergia e medicação contínua
   primeiro: mudam a prescrição. / Nenhum antecedente registrado." (`47-atendimento-rascunho-diagnostico-sem-alergia.jpg`);
   a gaveta "Prescrever" não cita alergia (`10-prescrever-gaveta.jpg`). Pelo código
   (`PrescricaoGaveta.vue`), o servidor só avisa **depois** do Salvar (422 `CONFIRMACAO_PENDENTE`). A
   tarefa "conferir alergias sem sair da consulta" é impossível.
   *Correção:* selo de alerta no cabeçalho do prontuário (fixo), repetido no topo da gaveta de
   prescrever; "Antecedentes" já nasce com os alertas ativos do cadastro, e o que se acrescenta ali
   volta para a ficha.
2. **P1 — Nada fica fixo ao rolar.** Medido no Exame físico do rascunho: com 578 px de rolagem a
   barra de abas está em −398 px e o nome do paciente em −508 px
   (`45-atendimento-rascunho-exame-rolado-nada-fixo.jpg`). Somem juntos: de quem é o prontuário, em que
   seção estou, "Tudo salvo" e "Revisar e finalizar". O Exame físico tem 56 controles.
   *Correção:* barra fixa de uma linha: paciente + alertas + peso · seções · estado do salvamento ·
   Finalizar.
3. **P1 — Ver o histórico tira a pessoa da consulta.** A consulta anterior é uma linha, e só na aba
   Anamnese. "Abrir" navega para outro prontuário na mesma janela; lá o voltar é "← Atendimentos" (a
   lista), não o rascunho de onde vim. O nome do paciente no cabeçalho não é link para a ficha.
   *Correção:* botão "Histórico" no cabeçalho que abre uma gaveta de leitura (alertas, últimas
   consultas com queixa, diagnóstico e conduta, peso, vacinas, receitas em uso) sem sair do rascunho.
4. **P1 — O registro finalizado é um formulário apagado em 5 abas.** Ler a consulta do Fubá pede
   quatro cliques de aba, e cada aba mostra campo vazio, caixa "Não aferido" e seletor "Não
   perguntado" (`04-atendimento-exame-fisico.jpg`, `03b-atendimento-fuba-anamnese-rolada.jpg`). Não se
   distingue "não perguntou" de "deixou em branco".
   *Correção:* finalizado vira uma folha de leitura única, só com o que foi preenchido, na ordem
   queixa → exame → diagnóstico → conduta → receita; abas só no rascunho.
5. **P1 — Prescrever trava na busca e não mostra a conta.** Busquei "amox", "otom" e "gent": a lista
   diz só "Nenhum resultado" (`11-prescrever-busca-sem-resultado.jpg`). O catálogo de dev tem 2 itens
   e o Bulário explica que está em revisão; a gaveta não explica nem aponta "Nome livre". A gaveta
   também não mostra o peso que vai usar (campo "Peso para a conta (opcional)" com a dica "O do exame
   ou do cadastro"), nem a dose total antes de salvar ("A dose sai da conta do servidor, no idioma do
   atendimento").
   *Correção:* topo da gaveta com "Mel · 28,7 kg · Alergia: Dipirona"; ao digitar mg/kg, mostrar a
   dose resultante; vazio com "Não achou? Prescreva pelo nome" que troca para "Nome livre" levando o
   texto digitado.
6. **P1 — O que sai da consulta está espalhado.** Receita, documentos e laudos ficam na 5ª aba;
   retorno e atos, na 4ª; vacina não se aplica daqui ("Vacina tem o registro dela", em Conduta > Atos:
   é preciso ir à ficha); internar só pelo mapa de leitos.
   *Correção:* uma seção "Saída da consulta" com as ações lado a lado: Prescrever, Vacinar, Documento,
   Pedir exame, Retorno, Internar.
7. **P2 — A gaveta empurra a página e corta as abas.** Com "Prescrever" ou "Revisar e finalizar"
   aberta em 1440, as abas viram "Anamnes", "Diagnóstic", "Conduta" cortadas
   (`10-prescrever-gaveta.jpg`, `12-revisar-e-finalizar-gaveta.jpg`). *Correção:* gaveta por cima do
   conteúdo, ou abas que rolam/abreviam.
8. **P2 — Voltar não devolve à agenda.** O código prevê "voltar para a agenda" com `?de=agenda`
   (`AtendimentoDaClinica.vue`, `voltar`), mas nenhum lugar navega com esse parâmetro
   (`AgendamentoGaveta.vue` linha 265 faz `router.push('/clinica/atendimento/…')`). Quem inicia pela
   agenda volta para "Atendimentos".
9. **P2 — Cabeçalho pobre.** "Consulta · 8 de nov. de 2026 17:30 · Portal Demo · Cachorro · 28,7 kg":
   sem raça, sexo, idade, responsável e telefone, que a gaveta do horário e a ficha têm.
10. **P2 — Adendo no rodapé de toda aba.** A caixa "Registro" repete-se embaixo das 5 abas do
    finalizado, com "Portal Demo" três vezes (Responsável, Finalizou, Escreveu uma seção) antes do
    adendo. O adendo é a correção clínica e fica depois de tudo. *Correção:* adendos no alto da folha
    de leitura; autoria numa linha.
11. **P3 — "Fazer a receita" grava no toque** (`ReceitaDoAtendimento.vue`, `fazerReceita` chama
    `criarReceita` direto) e o rótulo não avisa que o próximo passo é assinar. *Correção:* "Fazer a
    receita e assinar".
12. **P3 — "Finalizar" fica habilitado** com três itens em "Falta para finalizar".

**O que funciona:** o salvamento automático com estado à vista ("Tudo salvo"); a gaveta "Revisar e
finalizar", que lista o que falta com "Ir para" e mostra o que vai ao responsável; a faixa de
referência ao lado de cada sinal vital ("Dentro · ref. 37,5 a 39,2 °C"); o desenho "assunto à
esquerda, campos à direita".

**Tablet 1024** (`13-atendimento-rascunho-1024.jpg`): cabe sem quebra; o menu aberto ocupa 272 px e o
cabeçalho 212 px, sobram 556 px de altura para o trabalho.

**Nota: 2**

---

## 3. Ficha do paciente (lado clínico)

- **Rota:** `/clinica/ficha/:id` (Fubá e Mel; **Bento não existe nesta conta**: 6 ativos, 0 inativos)
- **Fonte:** `src/components/cadastro/FichaDoPaciente.vue`; `src/components/vacinas/VacinasDaFicha.vue`,
  `AplicarVacinaGaveta.vue`; `src/components/atendimento/LinhaDoTempoDaFicha.vue`;
  `src/components/tratamentos/TratamentosDaFicha.vue`; `src/components/documentos/DocumentosDoPaciente.vue`;
  `src/components/cadastro/ResumoDoApp.vue`, `VinculoCartao.vue`.
- **O que deveria responder:** o que eu preciso saber deste animal agora. Hoje responde primeiro "o que
  a recepção confere no balcão".
- **Anatomia:** 10 caixas em duas colunas, 2.396 px (2,7 telas) em 1440. Esquerda: Dados do paciente,
  Alertas, Vacinas, Histórico clínico, Tratamentos em casa, Documentos. Direita: responsável, "Este pet
  em 30 segundos", "No app do responsável", "Quem pode buscar". Tudo aberto; recolhidos só "Opcionais
  não iniciadas (2)" e "Histórico (1)" das vacinas.
- **Primeira dobra** (`14-ficha-fuba-dobra1.jpg`): cabeçalho "Fubá / Cachorro · SRD · Macho" com
  "Editar" e "Mais"; "Dados do paciente — O que a recepção confere no balcão." (3 de 6 campos "Não
  informado"); "Alertas"; começo de "Vacinas"; à direita, contato do responsável e o começo de "Este
  pet em 30 segundos".

**Problemas**

1. **P1 — Duas respostas para "tem alergia?" na mesma tela.** Esquerda: "Alertas / Alergia · Risco /
   Dipirona: inchaço no focinho". Direita, em "Este pet em 30 segundos > Medicação e carteirinha do
   app": "Alergias / Nenhuma registrada" (`14-ficha-fuba-dobra1.jpg`, `15-ficha-fuba-dobra2.jpg`;
   igual na Mel). Quem lê só a coluna da direita sai com a resposta errada.
   *Correção:* uma faixa única de alertas e alergias no alto, somando clínica e app, cada item com a
   origem; a caixa do app deixa de ter a linha "Alergias".
2. **P1 — A primeira dobra é cadastro.** O melhor lugar da tela vai para "Nascimento: Não informado ·
   Microchip: Não informado · Pelagem: Não informado" e para o endereço do responsável. O resumo
   clínico ("Este pet em 30 segundos") é a segunda caixa da direita.
   *Correção:* cabeçalho do paciente com espécie, raça, sexo, idade, peso, alertas em selo e o
   responsável com telefone; logo abaixo "Este pet em 30 segundos" e o histórico; cadastro recolhido.
3. **P1 — No tablet o resumo clínico fica 3,5 telas abaixo.** Em 1024 a ficha vira coluna única de
   3.907 px (5,1 telas); "Este pet em 30 segundos" começa em y=2.672 e o contato do responsável em
   y=2.391 (`20-ficha-fuba-1024.jpg`).
4. **P1 — As ações estão no fim de cada caixa, não no paciente.** "Atendimento avulso" está no
   cabeçalho de "Histórico clínico" (y=1.142, segunda dobra); "Novo documento" em y=2.145 (2,4 telas);
   "Aplicar vacina" em y=673; não existe "Internar" nem "Marcar horário". O cabeçalho só tem "Editar" e
   "Mais". *Correção:* barra de ações do paciente no cabeçalho: Atender agora, Vacinar, Documento,
   Internar, Marcar horário.
5. **P1 — "Atendimento avulso" cria o atendimento no toque.** `LinhaDoTempoDaFicha.vue`, `abrir()`
   chama `abrirAvulso` sem confirmação e é botão primário. O nome não diz "começar consulta".
   *Correção:* "Atender agora", com confirmação curta ou desfazer.
6. **P2 — Sem volta para a lista.** A ficha não tem "← Pacientes" (o prontuário e a internação têm).
7. **P2 — Vacinas contradiz a si mesma.** Subtítulo "Nada atrasado nem devido." e, logo abaixo,
   "Antirrábica · Não iniciada · Próxima: dose 1 de 1 em 16 de nov. de 2026" (hoje). Também aparece
   "Fiv/Felv" (vacina de gato) no plano do Fubá e da Mel, que são cachorros
   (`18-ficha-vacinas-historico-aberto.jpg`).
8. **P2 — Histórico clínico.** Seis filtros em duas linhas ("Tudo, Atendimentos 1, Atos 1, Vacinas 1,
   Faltas 1, Internações 1"); a falta aparece com o título "Consulta" e só um ícone de pessoa, sem a
   palavra "Falta"; vacina e ato não abrem nada, atendimento e internação abrem
   (`15-ficha-fuba-dobra2.jpg`).
9. **P2 — Mesmo dado, dois números.** "Tratamentos em casa": "0 dadas · 12 sem registro" na caixa da
   esquerda e "1 dada · 12 sem registro" em "Este pet em 30 segundos".
10. **P2 — Carrega em pedaços e mente no meio.** Três esqueletos e salto de layout; "No app do
    responsável" mostra "Este paciente ainda não está ligado ao app" e segundos depois "Ligado desde 9
    de novembro de 2026".
11. **P2 — Gavetas.** "Novo documento" não tem "Cancelar" (só "Salvar rascunho" e "Emitir"); a "Data do
    exame" é um calendário aberto de 340 px sem dia escolhido; 9 tipos numa lista plana; não há prévia
    do PDF antes da senha (`19-ficha-novo-documento-atestado.jpg`). Com a gaveta aberta, a coluna da
    direita some (`17-ficha-aplicar-vacina-gaveta.jpg`).
12. **P3 — "Tratamentos em casa"** corta a grade de doses e põe uma barra de rolagem horizontal dentro
    da caixa (`16-ficha-fuba-dobra3.jpg`); a coluna direita acaba em ~1.700 px e sobram 700 px vazios.

**O que funciona:** "Alertas" com severidade e detalhe; o plano de vacinas com "Aplicar" na linha (a
gaveta já abre com a vacina escolhida) e "Próxima: dose 2 de 2 em 7 de dez. de 2026"; a ideia de "Este
pet em 30 segundos".

**Nota: 2**

---

## 4. Bulário

- **Rota:** `/clinica/bulario` (Pacientes > aba Bulário)
- **Fonte:** `src/components/bulario/BularioDaClinica.vue`, `DoseDoPaciente.vue`
- **O que responde:** dose, via e cuidado de um medicamento.
- **Primeira dobra** (`22-bulario.jpg`): h1 "Pacientes" com o subtítulo "Busque pelo nome, pelo
  princípio ativo ou pela indicação."; 5 abas; à esquerda a caixa "Bulário" (busca, dois seletores,
  lista com 2 itens); à direita a ficha do primeiro item já aberta.

**Problemas**

1. **P1 — Desligado da consulta.** O código tem o modo paciente (`?paciente=`: filtra a espécie,
   destaca a dose dele e calcula), mas nenhuma tela leva a ele: não há link para
   `/clinica/bulario?paciente=` em `src`. Do prontuário não existe atalho para o bulário; consultar a
   dose é sair da consulta por menu > aba.
   *Correção:* "Consultar bulário" dentro da gaveta de prescrever, abrindo o bulário já com o
   paciente; atalho global na busca do portal.
2. **P2 — Lugar e título errados.** O bulário é ferramenta de consulta, não parte de "Pacientes". O
   h1 "Pacientes" sobre "Busque pelo nome, pelo princípio ativo ou pela indicação" lê-se como busca de
   pacientes.
3. **P2 — Não diz que está incompleto.** Há 2 itens ("Dipirona 400ml · Da clínica", "Tramadol 50
   mg/mL · Controlado"). O aviso de bulário em revisão só aparece com a lista vazia e sem busca
   (`BularioDaClinica.vue`, bloco `bul__vazio`); com 2 itens o usuário conclui que o bulário é isso.
   *Correção:* aviso fixo enquanto o catálogo da casa estiver em revisão.
4. **P3 — Seletores cortados em 1440** ("Todas as esp…", "Todas as class…") e "Bulário" escrito duas
   vezes (aba e caixa). Em 1024 lista e ficha empilham (`21-bulario-1024.jpg`).

**O que funciona:** lista e ficha lado a lado; primeiro item aberto sem clique; selo "Controlado".

**Nota: 3**

---

## 5. Internação

- **Rotas e fontes:** mapa `/clinica/internacao` (`src/components/internacao/InternacaoDaClinica.vue`,
  `PlantaoDaInternacao.vue`, `LeitoDoMapa.vue`, `InternarGaveta.vue`); detalhe `/clinica/internacao/:id`
  (`InternacaoDetalhe.vue`, `ChecklistDaInternacao.vue`, `LinhaDaDose.vue`, `PrescricoesDaInternacao.vue`,
  `EvolucoesDaInternacao.vue`, `BoletinsDaInternacao.vue`); plantão `/clinica/internacao/plantao`
  (`ChecklistDoPlantao.vue`); boletins `/clinica/internacao/boletins-pendentes` (`BoletinsPendentes.vue`);
  vagas `/clinica/internacao/vagas` (`VagasDaInternacao.vue`). Menu: `src/navegacao/espacos.ts`.
- **Estado dos dados:** nenhum internado ativo. Vi o mapa vazio, a internação encerrada do Fubá e as
  três telas auxiliares vazias; o estado ativo foi lido no código.

### Como as cinco telas se ligam

| De | Para | Como |
|---|---|---|
| Menu | Mapa | "Internação" |
| Mapa | Plantão | link pequeno "Checklist do plantão" na caixa "Plantão" |
| Mapa | Detalhe | leito ocupado ou linha de "O que pede ação" |
| Detalhe, Plantão | Mapa | "← Internação" |
| Qualquer lugar | **Boletins pendentes** | **nenhum caminho** |
| Qualquer lugar | **Vagas** | **nenhum caminho** |

**Problemas**

1. **P1 — "Boletins pendentes" e "Vagas" só abrem pela URL.** O mapa do menu novo
   (`espacos.ts`, `RECEITA_DA_CLINICA`) lista só `/clinica/internacao` no destino Internação; as duas
   rotas continuam no menu antigo (`useAppNavigation.ts`, linhas 203 a 217), que a receita não lê.
   Não há link para elas em nenhum `.vue`. São as telas da recepção (a fila de quem ligar e a resposta
   de "tem vaga?"), que não lê o mapa: para ela a internação some inteira.
   *Correção:* Internação com abas "Agora | Mapa | Boletins | Vagas".
2. **P1 — "O que precisa ser feito agora" tem dois endereços e o melhor é o mais escondido.** O mapa
   tem "O que pede ação" (uma linha por animal). A lista de trabalho da enfermagem é o "Checklist do
   plantão" (todas as doses por hora, com a linha do agora), que é um link secundário de 34 px dentro
   da caixa "Plantão" (`23-internacao-mapa.jpg`).
   *Correção:* a enfermagem abre em "Agora" (o checklist do plantão); o mapa vira a segunda aba.
3. **P1 — No detalhe, a primeira dobra é ficha, não trabalho.** A caixa "Estado" (Gravidade, Leito,
   Previsão de alta, Entrada) repete o cabeçalho ("R1 · Geral · Alta · responsável: Portal Demo") e
   ocupa de y=207 a y=470. O Checklist começa em y=507, Evolução em y=903, Boletim em y=1.158
   (`25-internacao-detalhe-fuba-dobra1.jpg`). Em 1024x768 as doses ficam fora da dobra
   (`49-internacao-detalhe-1024.jpg`). Com 5 prescrições ativas a página passa de 3 telas.
   *Correção:* estado no cabeçalho (gravidade, leito, previsão como selos com editar); barra fixa
   "Agora | Prescrições | Evolução | Boletim | Caso"; checklist primeiro.
4. **P2 — Internar só começa pelo leito.** `InternarGaveta` é usada só no mapa. A decisão de internar
   nasce na consulta; a veterinária sai do prontuário, vai a Internação, escolhe o leito e busca o
   paciente de novo. *Correção:* "Internar" no prontuário e na ficha, com o paciente preenchido e o
   leito escolhido dentro da gaveta.
5. **P2 — Escritas de um toque em tablet.** Gravidade é um seletor que grava ao tocar
   (`InternacaoDetalhe.vue`, `trocarGravidade`); "Dei" registra a dose direto
   (`useRegistroDeDose.ts`, `dei`); "Enviar" manda o boletim direto (`BoletinsPendentes.vue`,
   `enviar`). Os botões da linha da dose são `size="small"` ("Recusou", "Pulei", "Dei" lado a lado);
   medi 34 px de altura nos botões desse tamanho. *Correção:* alvos de 44 px, "Dei" separado dos
   outros dois, e faixa "Desfazer" depois do toque.
6. **P2 — A internação encerrada mostra estado de internado.** No Fubá, com alta em 9/11: "Checklist —
   Tudo em dia. / O plantão passou do fim (06:00) e não foi entregue. O cuidado segue; passe o plantão.
   / Nenhuma dose nesta janela." e "Boletim ao responsável — A cada 6 horas · próximo: 9 de nov.,
   18:00 · silêncio à noite" (depois da alta às 17:16) (`26-internacao-detalhe-fuba-dobra2.jpg`).
   *Correção:* encerrada vira leitura: desfecho no alto, depois evolução, boletins e prescrições; sem
   checklist nem próximo boletim.
7. **P2 — Do checklist do plantão não se chega ao animal.** A linha traz "Fubá (R1)" como texto
   (`ChecklistDoPlantao.vue`, `onde`); para escrever a evolução é voltar ao mapa e tocar o leito.
8. **P2 — Alerta do paciente não aparece no detalhe.** O cabeçalho é leito, horas e responsável; o
   template não tem bloco de alertas (só a urgência "alergia nova" na prescrição).
9. **P3 — O aviso do plantão vencido aparece em três telas** (mapa, checklist do plantão, checklist
   de cada internação).
10. **P3 — "Boletins pendentes" e "Vagas" não têm volta** para Internação; "Vagas" repete o que o mapa
    já diz por setor (`29-internacao-vagas.jpg`).

**O que funciona:** o mapa por setor com "0 de 2 ocupados · 2 vagas" e o leito livre que interna; a
gaveta "Internar" curta (Paciente, Motivo, Gravidade, Peso de entrada) com o resto recolhido em
"Diagnóstico, responsável, entrada e previsão" (`24-internar-gaveta.jpg`); a evolução em "O que se
observou / Avaliação / Plano".

**Tablet 1024** (`30-internacao-mapa-1024.jpg`): Plantão e "O que pede ação" cabem na dobra; os leitos
começam no fim dela.

**Nota: 3** (mapa 4, detalhe 2, plantão 3, boletins pendentes e vagas 2 por não terem entrada)

---

## 6. Vacinas

- **Rota:** `/clinica/vacinas` (Pendências > aba Vacinas)
- **Fonte:** `src/components/vacinas/VacinasDaClinica.vue`
- **O que responde:** quem chamar de volta e o que a clínica aplicou.
- **Primeira dobra** (`31-vacinas-lista-de-chamada.jpg`): h1 "Pendências / Quem ligar: do mais atrasado
  ao menos."; 6 abas; dois seletores iguais lado a lado ("Lista de chamada | Aplicadas" e "Todas |
  Vencidas | Série aberta | A vencer"); 4 linhas com paciente, selo, vacina e, à direita, responsável e
  telefone.

**Problemas**

1. **P1 — A lista diz quem ligar e não deixa fazer nada.** A linha não tem ação; só o nome é link
   (para o topo da ficha). Depois de ligar não há onde anotar nem como marcar o horário dali.
   *Correção:* "Marcar horário" na linha (gaveta da agenda com paciente e tipo Vacinação preenchidos)
   e "Liguei" com o resultado.
2. **P2 — Dois seletores iguais com papéis diferentes.** Um troca a tela, o outro filtra. Somando menu
   e abas, são quatro níveis. *Correção:* "Aplicadas" vira aba do destino; o filtro vira seletor
   discreto ou chips.
3. **P2 — Telefone cru:** "5511988887701". Na ficha, "(11) 98888-7711".
4. **P2 — "Aplicadas" não é pendência** (é o registro de lote e aplicador,
   `32-vacinas-aplicadas.jpg`) e mora em "Pendências", longe de onde se aplica (a ficha) e do estoque.
5. **P3 — "Série aberta" com "Vence em 20 dias"**: o selo não diz à recepção o que fazer. Sugestão:
   "Falta a 2ª dose · até 6 de dez.".

**O que funciona:** ordem do mais atrasado; responsável e telefone na linha; "Ver a lista de chamada da
clínica" na ficha.

**Nota: 3**

---

## 7. Tratamentos em casa

- **Rota:** `/clinica/tratamentos` (Pendências > aba Tratamentos em casa)
- **Fonte:** `src/components/tratamentos/TratamentosDaClinica.vue` (lista), `TratamentosDaFicha.vue`,
  `ContatoGaveta.vue`
- **O que a tela mostrou** (`33-tratamentos-erro.jpg`): "Algo deu errado / parceiroPeloToken is not
  defined / Tentar novamente". É o erro conhecido; a anatomia abaixo vem do código.
- **Anatomia pelo código:** seletor "Pedem atenção | Todos"; lista em que cada linha traz paciente,
  selo de crítico, medicamento, início, último contato e o alerta; a linha inteira abre a ficha.

**Problemas**

1. **P1 — O erro fala a língua do código.** "parceiroPeloToken is not defined" não diz o que houve nem
   o que fazer. *Correção:* "Não foi possível carregar os tratamentos. Tente de novo."; o detalhe
   técnico fica no console.
2. **P2 — A linha larga a pessoa no topo da ficha.** O link é `/clinica/ficha/:id` sem âncora; a caixa
   "Tratamentos em casa", com a faixa de doses e "Registrar contato", está em y=1.707 (duas telas
   abaixo). *Correção:* gaveta do tratamento na própria lista, com a faixa de doses e "Registrar
   contato"; ou âncora.
3. **P2 — Lista e ficha podem discordar.** O comentário do arquivo diz que a lista tem até 30 minutos
   de atraso e a ficha é ao vivo; na ficha do Fubá já vi "0 dadas" e "1 dada" para o mesmo tratamento.
4. **P2 — Lugar.** É a fila "para quem a clínica precisa ligar" e está certa em Pendências; falta o
   mesmo padrão de ação das irmãs (ver achado 1 de Vacinas).

**Nota: 2** (não deu para usar)

---

## 8. Estoque de vacinas

- **Rota:** `/clinica/estoque` (Pendências > aba Estoque de vacinas)
- **Fonte:** `src/components/estoque/EstoqueDaClinica.vue`, `GeladeiraDoEstoque.vue`,
  `MetasDoEstoque.vue`, `MovimentosDoEstoque.vue`, `AnaliseDoEstoque.vue`, `ReceberLoteGaveta.vue`
- **O que responde:** o que há na geladeira, o que falta e o que vence.
- **Primeira dobra** (`34-estoque-geladeira.jpg`): h1 "Estoque de vacinas / 61 doses na geladeira · R$
  2.475,00 parados"; 6 abas; seletor "Geladeira | Metas | Movimentos | Análise"; caixa "Vacinas" (3
  linhas com "Em dia", "Mínimo", "+ Lote") e o botão "Receber lote"; caixa "Lotes".

**Problemas**

1. **P2 — A gestora não acha "Estoque" no menu.** Está como sexta aba de "Pendências". O h1 muda para
   "Estoque de vacinas" só nesta aba; nas irmãs é "Pendências".
2. **P2 — Quatro níveis empilhados em Análise:** menu > 6 abas > "Geladeira | Metas | Movimentos |
   Análise" > "Últimos 3 | 6 | 12 meses" (`38-estoque-analise.jpg`). Cerca de 300 px antes do primeiro
   dado.
3. **P2 — "O que vence" está no fim da última aba.** Na Geladeira os lotes vêm por validade, sem
   destaque de prazo; o quadro "Validade" (Vencido, Até 30 dias, De 31 a 60 dias, Mais de 60 dias)
   está em Análise, por volta de y=1.300. *Correção:* a faixa de validade no topo da Geladeira.
4. **P2 — Validade em calendário mês a mês.** "Receber lote" pede a validade num calendário aberto
   (`35-estoque-receber-lote.jpg`); vacina vence em um ou dois anos, são 12 ou mais toques em ">". A
   gaveta tem 962 px e rola. *Correção:* campo mês/ano digitável.
5. **P2 — "31 de 10 no mínimo"** lê-se "31 de 10". Sugestão: "31 doses · mínimo 10".
6. **P3 — Movimentos.** Em "Tudo" só há entradas ("Entraram 20 doses de V10…"), embora 4 doses tenham
   saído por aplicação (lotes em "17 de 20" e "9 de 10") (`37-estoque-movimentos.jpg`). Não confirmei
   se a aplicação conta como movimento; para quem confere a geladeira, deveria.

**O que funciona:** o resumo no cabeçalho; o selo "Em dia" por vacina; "+ Lote" na linha; "Dar baixa"
no lote; Metas com "Em curso · faltam 14 dias" (`36-estoque-metas.jpg`).

**Tablet 1024** (`48-estoque-1024.jpg`): a faixa de 6 abas rola e esconde "Atividades" e "Faltas" à
esquerda, sem seta que avise.

**Nota: 3**

---

## 9. Cópias do prontuário

- **Rota:** `/clinica/copias-do-prontuario` (Pacientes > aba Cópias)
- **Fonte:** `src/components/copias/CopiasDoProntuario.vue`, `CopiaGaveta.vue`, `NovoPedidoDeCopiaGaveta.vue`
- **O que responde:** que pedido de cópia está aberto e qual é o próximo passo.
- **Primeira dobra** (`39-copias-do-prontuario.jpg`): h1 "Pacientes / 1 pedido passou do prazo";
  "Registrar pedido"; "Abertos | Encerrados"; 3 linhas com prazo e um botão cada.

**Problemas**

1. **P2 — O vencido vem por último.** "Mel · Prazo 13 de nov. de 2026" (vermelho) é a terceira linha,
   depois de dois com prazo 16/11, e o subtítulo diz "1 pedido passou do prazo". O prazo de hoje
   (16/11) não tem destaque.
2. **P2 — Lugar.** Tarefa do dono ou gestor com prazo legal, guardada como quinta aba de "Pacientes".
   Combina com Pendências.
3. **P3 — Três botões primários de mesmo peso** numa lista de três linhas.

**O que funciona:** uma ação por linha que nomeia o próximo passo ("Gerar cópia", "Baixar e entregar");
a gaveta na ordem do trabalho (fatos, "Baixar PDF", "Como foi entregue", "Registrar entrega")
(`40-copias-gaveta-entregar.jpg`).

**Nota: 4**

---

## 10. Relatórios

- **Rota:** `/clinica/resumo`
- **Fonte:** `src/components/resumo/ResumoDaClinica.vue`
- **O que responde:** como foi o movimento do período.
- **Primeira dobra, "30 dias"** (`42-relatorios-30-dias-dobra1.jpg`): h1 "Relatórios / 4 atendimentos
  concluídos nos últimos 30 dias"; "Hoje | Esta semana | Semana passada | 30 dias"; o chip "18/10 a
  16/11"; dois seletores; 4 indicadores (57% Comparecimento, 2,0 h Horas agendadas, 1% Ocupação média,
  5 Pacientes novos); o aviso "9 horários ficaram sem desfecho…"; o gráfico "Movimento por dia".

**Problemas**

1. **P1 — Os dois números que a gestora procura não são indicadores, e a tela mostra 4 e 16 para "a
   mesma coisa".** "4 atendimentos concluídos" só existe no subtítulo; "3 faltas" é a nota pequena sob
   "57% Comparecimento". Mais abaixo, "Por tipo de atendimento" soma 16 (Consulta 10, Retorno 3,
   Vacinação 3) e "Por profissional" também 16, sem dizer que ali se contam horários marcados
   (`43-relatorios-30-dias-dobra2.jpg`).
   *Correção:* primeira linha de indicadores com Marcados 16 · Concluídos 4 · Faltas 3 · Cancelados ·
   Sem desfecho 9; comparecimento como derivado; cada quadro diz o que conta.
2. **P2 — Abre vazio.** O padrão é "Esta semana"; numa segunda cedo: "Nenhum atendimento neste
   período." e mais nada (`41-relatorios-esta-semana-vazio.jpg`). *Correção:* abrir no último período
   com movimento, ou oferecer "Ver a semana passada".
3. **P2 — Não existe "este mês".** As opções são Hoje, Esta semana, Semana passada e 30 dias (janela
   móvel). O chip "18/10 a 16/11" tem ícone de calendário e cara de botão, mas é texto.
   *Correção:* "Este mês" e "Mês passado", e o chip abre um calendário de intervalo.
4. **P2 — Mapa de horas com 24 linhas.** "Horários de maior movimento" vai de 00h a 23h (~880 px),
   quase todo vazio. *Correção:* só o expediente, com "ver o dia inteiro".
5. **P3 — 2.032 px (2,3 telas) em 1440 e 3,5 telas em 1024** (`50-relatorios-1024.jpg`).

**O que funciona:** as frases que explicam o número ("9 horários ficaram sem desfecho (nem chegada, nem
falta) e ficam fora do comparecimento."; "Agenda ocupada em 1%, em média; o dia mais cheio foi dom.
08/11, com 16%.").

**Nota: 3**

---

## Percursos de tarefa

Cliques contados a partir do menu da Clínica. "Parei" marca onde o próximo toque gravaria.

| # | Tarefa | Caminho | Cliques | Onde travou ou hesitou |
|---|---|---|---|---|
| 1 | Começar o atendimento do próximo paciente | Agenda → horário (gaveta) → "Marcar chegada" → "Iniciar atendimento" → prontuário na Anamnese. De Hoje: +1 ("Ver na agenda"). | 4 (5 de Hoje) | O botão principal da gaveta é "Marcar chegada", passo da recepção; "Iniciar" fica em "Mais ações" até a chegada. A gaveta não mostra alerta (o Nino tem "Alergia" na lista). O prontuário abre com "← Atendimentos". Parei na gaveta (`44-agenda-gaveta-do-horario-caminho-do-atendimento.jpg`); o resto é do código. |
| 2 | Conferir alergias e a consulta anterior sem perder o que escreve | Alergia: não há na tela. Saída: Pacientes → paciente → ler "Alertas" → Pacientes → aba Atendimentos → rascunho → aba em que estava. Consulta anterior: linha na Anamnese; "Abrir" → 4 abas para ler → "← Atendimentos" → rascunho → aba. | 6 (alergia); 8 (consulta anterior completa) | Falha. O texto não se perde (salva sozinho), mas perde-se o lugar. |
| 3 | Prescrever e chegar ao passo de assinar | Aba "Receita e documentos" → "Prescrever" → medicamento, dose, via → "Salvar" → "Fazer a receita" → gaveta "Assinar" → senha → "Assinar". | 5 + campos | Travou na busca: "Nenhum resultado" para amox, otom e gent, sem saída indicada. Não vi peso, alergia nem dose calculada. Parei em "Prescrever"; Salvar em diante é do código. |
| 4 | Aplicar vacina e ver a carteirinha (Bento não existe; usei o Fubá) | Pacientes → Fubá → "Aplicar" na linha da V10 → lote, validade, via → "Aplicar e registrar". Próximo reforço: na mesma caixa; aplicadas em "Histórico (1)" (+1). | 4 | "Nada atrasado nem devido." com Antirrábica marcada para hoje; "Fiv/Felv" num cachorro; não se vacina de dentro do prontuário. Parei na gaveta. |
| 5 | Emitir atestado para o Fubá | Pacientes → Fubá → rolar 2,4 telas → "Novo documento" → abrir o tipo → escolher 1 de 9 → data no calendário → texto → senha → "Emitir". | 7 + rolagem | O botão está no fim da ficha; a gaveta não tem "Cancelar" nem prévia. Parei com o tipo escolhido. |
| 6 | Internar e registrar dose ou evolução; "o que fazer agora?" | Internação → "Internar" num leito livre → paciente, motivo, gravidade, peso → "Internar" → detalhe. Dose: "Dei" na linha (1 toque). Evolução: rolar até a 4ª caixa → "Nova evolução". | 3 para internar | Só se interna pelo leito. "Agora" tem dois lugares: "O que pede ação" e o link pequeno "Checklist do plantão". Sem internado ativo: parei na gaveta "Internar"; o resto é do código. |
| 7 | Enviar o boletim ao responsável | Internação → leito → rolar até "Boletim ao responsável" (5ª caixa) → "Escrever" → texto → salvar → "Enviar". | 5 + rolagem | A fila "Boletins pendentes" existe e não tem entrada. Lido no código. |
| 8 | Gestora: o que vence ou acaba e receber um lote | Pendências → aba "Estoque de vacinas" → ler "Em dia" e os lotes → "Receber lote" → 6 campos → "Receber". | 4 | Achar Estoque dentro de Pendências; validade mês a mês. Parei na gaveta. |
| 9 | Gestora: atendimentos e faltas no mês | Relatórios → abre vazio em "Esta semana" → "30 dias" → ler subtítulo e nota. | 2 | Não há "este mês"; 4 no subtítulo e 16 nos quadros. |
| 10 | Atender um pedido de cópia | Pacientes → aba "Cópias" → "Gerar cópia" → período → "Gerar" → "Baixar PDF" → "Como foi entregue" → "Registrar entrega". | 7 | Fluxo claro; só o lugar (aba de Pacientes) e o vencido no fim da lista. Parei na gaveta do pedido pronto. |

---

## Heurísticas de Nielsen (frente inteira)

Escala: 0 (falha grave) a 4 (atende bem).

| # | Heurística | Nota | Achado-chave |
|---|---|---|---|
| 1 | Visibilidade do estado do sistema | 3 | "Tudo salvo" e os selos são bons; mas a internação encerrada mostra aviso de plantão e "próximo boletim", e a ficha pisca "não está ligado ao app" antes de carregar. |
| 2 | Correspondência com o mundo real | 2 | "Atendimento avulso", "Série aberta", "31 de 10 no mínimo", "Rascunho aberto é atendimento sem fecho"; Estoque em Pendências, Bulário em Pacientes. |
| 3 | Controle e liberdade | 2 | "Abrir" a consulta anterior tira do rascunho e a volta é a lista; a ficha não tem volta; "Novo documento" sem Cancelar. |
| 4 | Consistência e padrões | 2 | h1 "Pendências" numa aba e "Estoque de vacinas" na vizinha; o mesmo seletor serve de aba, filtro e campo; telefone formatado numa tela e cru na outra; a mesma consulta com horas diferentes. |
| 5 | Prevenção de erros | 1 | Alergia fora do prontuário e da prescrição; "Alergias: Nenhuma registrada" ao lado do alerta; dose sem prévia; escritas de um toque (avulso, "Dei", gravidade, "Enviar"). |
| 6 | Reconhecer em vez de lembrar | 1 | A veterinária guarda de cabeça alergia, peso e consulta anterior; o nome do paciente some ao rolar; o registro fechado está em 5 abas. |
| 7 | Flexibilidade e eficiência | 2 | Sem atalhos entre consulta, vacina, documento e internação; sem busca em Atendimentos; a lista de chamada não tem ação. |
| 8 | Estética e minimalismo | 2 | Cadastro na primeira dobra da ficha; formulário apagado como leitura; mapa de 24 horas; 250 a 300 px de cabeçalho, abas e filtros. |
| 9 | Reconhecer e recuperar erros | 2 | "parceiroPeloToken is not defined"; "Nenhum resultado" sem saída. O contraponto é "Falta para finalizar" com "Ir para". |
| 10 | Ajuda e documentação | 2 | As descrições sob os títulos ajudam, mas várias falam do sistema ("A dose sai da conta do servidor, no idioma do atendimento"). |

---

## Carga cognitiva

| Item | Resultado | Onde |
|---|---|---|
| Foco único | Falha | Ficha (10 caixas de mesmo peso); detalhe da internação (7 caixas). |
| Blocos de até 4 | Falha | Ficha 10; Exame físico 56 controles; Pendências 6 abas. |
| Agrupamento | Parcial | Bom dentro das seções (assunto à esquerda, campos à direita); ruim na ficha (clínico e cadastro misturados) e no menu. |
| Hierarquia visual | Falha | Três botões primários na mesma ficha ("Aplicar vacina", "Atendimento avulso", "Novo documento"); caixas todas iguais. |
| Uma coisa por vez | Parcial | Passa no prontuário em rascunho e nas gavetas; falha no detalhe da internação. |
| Poucas escolhas | Falha | Ver a lista abaixo. |
| Memória de trabalho | Falha | Alergia, peso, consulta anterior e o próprio nome do paciente ao rolar. |
| Revelação progressiva | Parcial | Boa em "Internar" e nas vacinas da ficha; ausente no registro finalizado e na ficha. |

Cinco falhas e três parciais em oito.

**Pontos de decisão com mais de 4 opções visíveis:** abas de Pendências (6); abas de Pacientes (5);
menu da Clínica (7); seções do prontuário (5); filtros do histórico da ficha (6); tipo de documento
(9); frequência na prescrição (8); sistemas do exame físico (8 linhas de 3 opções); ações de uma
receita assinada mais o resto da aba (6 botões na dobra).

---

## Arquitetura: o que existe e o que eu faria

**Hoje**

- Pacientes: Pacientes · Correções · Atendimentos · Bulário · Cópias
- Internação: (sem abas; Plantão por link; Boletins pendentes e Vagas sem entrada)
- Pendências: Atividades · Faltas · Retornos · Vacinas · Tratamentos em casa · Estoque de vacinas

Não bate com o modelo de quem trabalha: prontuário não é "paciente", é a consulta; bulário é
ferramenta; cópia é pedido com prazo; estoque e "aplicadas" não são pendência; a internação tem quatro
perguntas (o que fazer agora, quem está onde, a quem avisar, tem vaga) e só uma tem porta.

**Proposta**

| Destino | Abas | Quem abre |
|---|---|---|
| Hoje | | todos |
| Agenda | Agenda · Pedidos · Fila de espera | recepção, veterinária |
| Pacientes | Pacientes · Prontuários (ex-Atendimentos, com busca) | todos; Prontuários só para quem lê prontuário |
| Internação | Agora (checklist do plantão) · Mapa · Boletins · Vagas | enfermagem abre em Agora; recepção vê Boletins e Vagas |
| Vacinas | Chamada · Aplicadas · Estoque | recepção, gestora |
| Pendências | Atividades · Faltas · Retornos · Tratamentos em casa · Correções · Cópias | recepção, gestora |
| Relatórios | | gestora |
| Configuração | | dona |

- **Bulário** sai das abas: vira atalho na busca do portal e botão dentro de "Prescrever", sempre com o
  paciente da consulta.
- **Ficha e prontuário** ganham o mesmo cabeçalho de paciente (nome, espécie, raça, sexo, idade, peso,
  alertas, responsável) e a mesma barra de ações (Atender, Vacinar, Documento, Internar, Marcar
  horário).
- O h1 passa a ser o nome da aba aberta; o destino fica no menu e na faixa de abas.

---

## Achados transversais

1. **Cabeçalho clínico do paciente ausente.** Alerta, peso, idade e responsável não acompanham o animal
   no prontuário, na internação, na gaveta do horário, em Prescrever e em Aplicar vacina.
2. **Menu por tipo de lista.** Até quatro níveis de seletor; h1 genérico; duas telas órfãs.
3. **Ação longe do contexto.** Cada ação clínica mora no fim de uma caixa diferente; nenhuma no
   cabeçalho do paciente.
4. **Nada fixo em páginas de 2 a 5 telas.** O cabeçalho rola com o conteúdo em todas as telas da
   frente.
5. **Leitura feita com formulário desabilitado** (prontuário finalizado) e com estado de "em curso"
   (internação encerrada).
6. **Gaveta que empurra o conteúdo** e corta faixas de abas; calendário aberto para toda data;
   botões de linha com 34 px num produto que tem tablet como cenário.
7. **Escritas de um toque sem desfazer à vista:** "Atendimento avulso", "Fazer a receita", "Dei",
   "Enviar" boletim, gravidade, "Assumir" plantão.
8. **Dados que se contradizem entre telas:** horas (lista 17:53 x prontuário 19:00; internação 17:13 x
   ficha 18:13; "Última consulta em 07/11" x "8 de nov."), "0 dadas" x "1 dada", telefone formatado x
   cru, "Nada atrasado nem devido" x próxima dose hoje, 4 x 16 atendimentos.
9. **Tablet.** Menu aberto leva 272 px de 1.024; a ficha vira 5 telas com o resumo clínico no fim; as
   abas de Pendências rolam e escondem as primeiras.

---

## As 5 prioridades da frente

1. **Cabeçalho clínico fixo do paciente, com alertas, em todo lugar onde se decide algo** (prontuário,
   Prescrever, Aplicar vacina, internação, gaveta do horário) e uma só lista de alergias na ficha.
2. **Prontuário:** barra fixa (paciente, seções, salvamento, Finalizar); gaveta "Histórico" sem sair;
   registro finalizado como folha de leitura; "Saída da consulta" reunindo prescrever, vacinar,
   documento, retorno e internar; Prescrever com peso, alergia e dose à vista.
3. **Menu clínico por trabalho:** Prontuários com nome próprio, Internação com quatro abas (devolvendo
   Boletins e Vagas), Vacinas com o Estoque, Bulário como ferramenta.
4. **Ficha:** ordem "o que preciso saber agora", barra de ações no cabeçalho, cadastro recolhido,
   coluna única pensada para o tablet.
5. **Internação no tablet e Relatórios:** checklist primeiro, estado no cabeçalho, alvos de 44 px e
   desfazer; em Relatórios, Marcados, Concluídos e Faltas como indicadores e "Este mês".

## Ordem de ataque (da que mais dói para a que menos)

1. Atendimento (prontuário)
2. Ficha do paciente
3. Internação (abas do destino e detalhe)
4. Vacinas e Estoque (juntar e dar ação à lista de chamada)
5. Relatórios
6. Tratamentos em casa
7. Atendimentos (lista)
8. Bulário
9. Cópias do prontuário

---

## O que não consegui ver, e por quê

- **Bento:** não existe na conta (ativos: Bidu, Fubá, Mel, Nino, Pipoca, "Rafael lima"; nenhum
  inativo). O percurso da vacina foi feito no Fubá.
- **Internado ativo:** não havia. Checklist com doses, prescrição, nova evolução, escrever e enviar
  boletim e alta foram avaliados pelo código e pela internação encerrada do Fubá.
- **Assinar a receita:** chegar à gaveta "Assinar" exige gravar uma prescrição e tocar "Fazer a
  receita", que grava. Avaliado pelo código.
- **Sugestões de medicamento, conta da dose e avisos (alergia, faixa, peso):** o catálogo de dev tem 2
  itens e as três buscas voltaram vazias.
- **Iniciar o atendimento pela agenda** e **"Atendimento avulso":** gravam. Vi a gaveta do horário e o
  código.
- **Tratamentos em casa:** a tela abriu com o erro conhecido.
- **Perfis sem permissão** (recepção, enfermagem): a conta é dona. O que digo sobre a recepção não
  alcançar Boletins e Vagas vem de `espacos.ts`, não de tela vista.
- **Tema escuro, outros idiomas e RTL:** não avaliados (proibido trocar).
- **1024x768:** conferido em prontuário, ficha, bulário, mapa e detalhe da internação, estoque e
  relatórios. A janela é compartilhada entre as abas dos agentes; a troca de tamanho só valeu com a
  minha aba em primeiro plano, e uma captura do bulário saiu em 1024 sem querer (`21-bulario-1024.jpg`).
- **Aviso de ambiente:** ao abrir o detalhe de uma requisição para entender a busca vazia, a ferramenta
  imprimiu o cabeçalho Authorization da sessão de QA. Não usei nem registrei o valor; depois disso li
  os resultados só pela tela.

## Defeitos vistos de passagem (não são o foco)

- "parceiroPeloToken is not defined" em Tratamentos em casa.
- "Fiv/Felv" no plano vacinal de cachorros (Fubá, Mel).
- Horas com uma hora de diferença entre telas (provável fuso).
- Cópias: o pedido vencido no fim da lista.
- Ficha: "No app do responsável" mostra "não está ligado" antes de carregar.
- Internação encerrada com aviso de plantão e "próximo boletim".
- Abas de seção do prontuário cortadas com a gaveta aberta.
