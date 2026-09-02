# 03 · Prontuário eletrônico estruturado

> A tela de atendimento: anamnese, exame físico, diagnóstico, conduta e evolução, com dado
> estruturado em vez de caixa de texto.

## Por que existe

É onde o vet passa o tempo dele e é a decisão mais importante do produto. Campo estruturado
hoje é o que permite score de risco, prevenção preditiva e integração com laboratório amanhã.
Texto livre é confortável de programar e inútil depois.

## Pronto quando

Um vet registra uma consulta completa no protótipo em menos tempo do que levaria escrevendo à
mão, e o resultado é dado consultável, não texto solto.

---

## Estado atual (auditoria de código)

O prontuário é a parte mais construída do módulo: 5 etapas em stepper, autosave, rascunho local
e disputa entre dispositivos, tudo funcionando.

### Já existe e atende

| O que o requisito pede | Onde está | Observação |
|---|---|---|
| Cinco etapas do atendimento | `ProntuarioStepper.vue` + 5 componentes de etapa | Anamnese, exame físico, diagnóstico, conduta, impressão |
| Queixa principal e duração | `types.ts` → `Anamnese` | `queixaPrincipal`, `duracaoSintomas` |
| Revisão de sistemas estruturada | `Anamnese` | Apetite, hidratação, evacuação, micção, ambiente, vacinação, vermifugação |
| Oito sistemas no exame físico | `ExameFisico.sistemas` | `normal` / `alterado` / `nao-avaliado`, com nota só quando alterado |
| Faixa de referência por espécie | `fixtures/reference-ranges.ts` | 5 espécies, 6 vitais |
| Fora da faixa sem depender de cor | `ClinicRefValue.vue` | Seta + palavra + faixa (ver requisito 02) |
| `não aferido` distinto de vazio | `Measurement.naoAferido` | Decisão clínica registrada, não ausência |
| Diagnóstico de catálogo | `ProntuarioDiagnostico.vue`, `DiagnosisCatalogItem` | Busca por código e descrição |
| **Mais de um diagnóstico e diferenciais** | `DiagnosisKind` | `presuntivo` / `definitivo` / `diferencial` |
| Conduta completa | `CarePlan` | Orientações, prescrições, exames solicitados, retorno |
| Prescrição com cálculo de dose | `domain/dose.ts`, `ProntuarioConduta.vue` | mg/kg × peso, apresentação, total de administrações |
| Aviso de alergia na prescrição | `domain/dose.ts` → `alergiaConflitante` | Exige confirmação explícita; casa por sinônimo do princípio ativo em 4 idiomas |
| Bulário ao lado do campo | `BularioPicker.vue` | "ao lado do campo, não escondido num menu" |
| Linha do tempo do paciente | `ProntuarioTimeline.vue`, `TimelineEvent` | Consultas, vacinas, exames, cirurgias, prescrições, faltas |
| **Texto livre ao lado do estruturado** | `Anamnese.historia`, `ExameFisico.observacao` | Nunca no lugar — resolve o caso difícil do vet que quer escrever livre |
| Trechos prontos por comando `/` | `ProntuarioAnamnese.vue` | "sem tirar as mãos do teclado" |
| **Autosave** | `stores/prontuario.ts` | 800 ms de pausa; única exceção à regra de `invalidarTudo()` do módulo |
| **Rascunho local** | `stores/prontuario.ts` | `localStorage` sob `clinic.draft.<id>`; volta como **oferta**, não sobrescrita |
| **Um dispositivo edita por vez** | `EncounterLock`, `assumirEdicao` | Segundo entra em leitura; transferência explícita |
| Simulador de segundo dispositivo | `alternarSegundoDispositivo` | Painel de dev, sem precisar de outra máquina |
| Somente leitura ao finalizar | `somenteLeitura` computed | Finalizado não se edita |
| Impressão e PDF | `ProntuarioImpressao.vue`, `documentos/` | Receituário (inclusive controle especial), atestado |

### Casos difíceis

| Caso do requisito | Situação |
|---|---|
| Retorno abre mostrando o que foi feito da última vez | OK — `consultaAnterior` carregada e exibida (`[encounterId].vue:514`) |
| Vet que quer escrever livre | OK — `historia` e `observacao` convivem com o estruturado |
| Atendimento interrompido: rascunho não se perde | OK — autosave + espelho local + retomada ofertada |

A subtarefa **"Rascunho e retomada do atendimento" está essencialmente pronta**, inclusive a
parte que o requisito destaca ("o que acontece quando dois dispositivos abrem o mesmo
atendimento"). Nada a fazer ali.

---

## Lacunas

### P1 · Faixas de referência só por espécie — faltam porte e idade

O requisito é explícito: *"valores de referência por espécie, **porte e idade**"*. O tipo
`ReferenceRange` tem só `especie`, e `encontrarFaixa(faixas, vital, especie)` não recebe mais
nada.

Isso não é refinamento: filhote e idoso têm frequência cardíaca e respiratória diferentes, e
um cão de 3 kg tem FC muito acima de um de 60 kg. Com faixa única por espécie, o protótipo
marca como "fora" o que é normal para o porte — e ensina o vet a ignorar o destaque, que é o
pior desfecho possível para a fundação do requisito 02.

Entregar: `porte` e faixa etária em `ReferenceRange`, com resolução do mais específico para o
mais geral, e o dataset cobrindo pelo menos cão pequeno/médio/grande e filhote/adulto/idoso.
Faixa ausente continua virando `sem-referencia` — inventar faixa é pior que não ter.

### P2 · Anamnese sem evolução e sem antecedentes

O requisito nomeia quatro campos: queixa principal, duração, **evolução** e **antecedentes**.
Existem os dois primeiros. Os outros dois hoje caem em `historia`, que é texto livre — ou seja,
exatamente o que o requisito existe para evitar.

- **Evolução** é o eixo que decide urgência: piorando, estável ou melhorando. Sem ele não há
  como comparar dois atendimentos do mesmo quadro.
- **Antecedentes** (cirurgias, doenças prévias, alergias já conhecidas, medicação em uso) são
  o que o vet lê antes de prescrever, e precisam ser consultáveis entre consultas.

Entregar: `evolucao` como escolha estruturada e `antecedentes` como lista, com o texto livre
continuando ao lado.

### P3 · Mucosas não existem no exame físico

A subtarefa lista o que o exame físico precisa medir: *"Peso, temperatura, frequência cardíaca
e respiratória, **mucosas e hidratação**"*. Busca por `mucosa` no módulo: **zero ocorrências**.

E hidratação existe, mas na **anamnese** — no lugar errado. Grau de desidratação é achado de
exame (prega cutânea, mucosas), não relato do responsável. Como está, o vet informa hidratação
antes de encostar no paciente.

Entregar: mucosas como achado do exame físico (normocoradas, pálidas, ictéricas, cianóticas,
congestas) e hidratação movida para o exame, ao lado do TPC que já está lá.

### P4 · Linha do tempo sem filtro, e sem internação

O requisito pede filtro **duas vezes**: *"Evolução: atendimentos anteriores em linha do tempo,
**com filtro por tipo**"* e *"Consultas, vacinas, exames e internações em ordem, **com
filtro**"*. Nem `ProntuarioTimeline.vue` nem `paciente/[petId]/historico.vue` têm filtro algum.

Além disso, `TimelineEventKind` é `consulta | vacina | exame | cirurgia | prescricao | falta |
observacao` — **internação não existe**, e o requisito a nomeia.

É a tela que o vet abre antes de entrar na sala: sem filtro, responder "quando foi a última
vacina?" obriga a rolar a lista inteira.

Entregar: filtro por tipo na linha do tempo (nas duas telas) e `internacao` no domínio, no
dataset e nos quatro idiomas.

### P5 · Não existe modo de digitação rápida só com teclado

O requisito lista como entregável próprio: *"Modo de digitação rápida, só com teclado, sem
depender do mouse."*

Existem peças — o comando `/` de trechos prontos na anamnese, e o rodapé pensado como caminho
de tabulação entre etapas — mas **não existe o modo**. Percorrer as cinco etapas preenchendo
vitais, sistemas, diagnósticos e prescrição sem mouse hoje depende de tabular por dentro de
componentes PrimeVue que não foram verificados para isso.

Entregar: um modo declarado, com foco automático no primeiro campo, avanço por `Enter`, saltos
entre etapas, e um mapa de teclas visível — como já existe na agenda (`ClinicShortcutsDialog`).
E a verificação de que dá para registrar a consulta inteira sem tocar no mouse, que é o
"pronto quando" do requisito.

### P6 · Nada vem do que o responsável respondeu no app antes da consulta

Subtarefa da anamnese: *"Prever preenchimento a partir do que o tutor já respondeu no app antes
da consulta."* Busca por `preConsulta`, `questionario`, `respondeu`: **zero ocorrências**.

É o ponto onde o diferencial do produto aterrissa no prontuário — a mesma lógica do requisito
01, em que o agendamento vindo do responsável cai na agenda. Sem isso, o app e o prontuário são
dois produtos que não se falam.

Entregar: contrato de pré-consulta (respostas do responsável com data e origem), sugestão
visível nos campos que ela preenche, e a marca de que aquele valor **veio do responsável e não
do vet** — a procedência importa no prontuário.

### P7 · "Agendar retorno" não agenda retorno — **defeito**

O botão existe, o aviso de "retorno pendente" existe, e o campo `retorno.appointmentId` existe
no tipo. Mas o manipulador é:

```ts
function agendarRetorno() {
  void router.push({ path: '/veterinario/agenda', query: { foco: encounter.value?.appointmentId } })
}
```

Ele navega para a agenda **focando o atendimento atual** — o que acabou de terminar —, não cria
nada, não leva o `emDias` nem o tipo de retorno escolhidos, e nunca preenche
`retorno.appointmentId`. Consequência: o aviso "retorno pendente" **nunca some**, mesmo depois
de o vet clicar no botão e marcar o retorno à mão.

A subtarefa diz *"sugestão de retorno que já cai na agenda... é o fim do atendimento e o começo
do próximo"*. Hoje o ciclo não fecha.

Entregar: criar o atendimento de retorno na data sugerida com o tipo escolhido, gravar o id em
`retorno.appointmentId`, e só então limpar o aviso. Sem horário livre na data, cair na fila de
espera (liga com a L7 do requisito 01).

---

## Plano de execução

### Bloco A — O exame físico julga certo ✅

- [x] **P1** Faixas de referência por espécie, porte e idade — `PetPorte` e `FaixaEtaria`
      novos, resolução do mais específico para o mais geral em `domain/ranges.ts`, porte
      informado pela clínica com estimativa por peso de reserva, faixa etária sempre derivada.
      Cão grande envelhece antes do pequeno. 16 testes.
- [x] **P3** Mucosas no exame físico e hidratação movida da anamnese — cinco colorações com
      tom por gravidade, e o grau de desidratação onde ele é aferido.

### Bloco B — A anamnese vira dado ✅

- [x] **P2** Evolução e antecedentes estruturados — evolução como escolha (piorando, estável,
      melhorando, intermitente) colada em queixa e duração, e antecedentes como lista tipada,
      com alergia e medicação contínua na frente por serem as que mudam a prescrição.
- [x] **P6** Pré-consulta vinda do app — painel com moldura própria acima da anamnese,
      **sugestão e nunca preenchimento**, aplicando só o que está vazio. Peso informado em casa
      vem marcado como tal e não entra nos vitais.

### Bloco C — O ciclo fecha

- [x] **P7** Agendar retorno cria o retorno de verdade — **defeito corrigido**.
      `agendaRepository.sugerirRetorno` busca horários livres com quem atendeu, avançando dia
      a dia quando a data pedida cai em dia fechado; a escolha cria o atendimento e grava
      `retorno.appointmentId`, que é o que faz o aviso de pendência sumir. 4 testes.
- [x] **P4** Filtro na linha do tempo e internação no domínio — fichas por tipo com a contagem,
      só dos tipos que existem no paciente, e o tipo `internacao` plantado no dataset.

### Bloco D — Velocidade ✅

- [x] **P5** Modo de digitação rápida só com teclado, com mapa de teclas. `Enter` avança campo —
      e no último, muda de etapa; número escolhe a opção do grupo; `Alt` mais setas troca de
      etapa; e o foco vai sozinho ao primeiro campo da etapa nova.
- [x] **Extra** O `ClinicToggleGroup` virou um `radiogroup` de verdade: uma parada de Tab por
      grupo, setas navegando e número escolhendo direto. O comentário afirmava isso desde o
      início; o código não fazia nada. 10 testes.

---

## Decisões

- **Estruturado primeiro, livre ao lado.** Todo campo novo nasce estruturado; o texto livre
  convive, nunca substitui. É a razão de ser do requisito.
- **Status clínico é recalculado, nunca persistido.** Vale para faixa de referência e para
  qualquer julgamento derivado de valor mais regra.
- **Faixa ausente não é erro.** Vira `sem-referencia` e a tela mostra o valor sem julgar.
  Inventar faixa é pior que não ter — e passa a valer também para porte e idade (P1).
- **`não aferido` é informação.** Distingue "o profissional decidiu não medir" de "ninguém
  preencheu ainda".
- **Autosave não invalida o resto.** Única exceção à regra do módulo: invalidar a cada pausa de
  digitação faria a tela piscar enquanto o profissional escreve.
- **Procedência do dado importa.** Valor vindo do responsável (P6) precisa ser distinguível do
  aferido pelo vet.
