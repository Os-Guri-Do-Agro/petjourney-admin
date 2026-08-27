# Prompt de implementação — Módulo clínico no portal web do parceiro

> **Para colar numa sessão de agente aberta em `petjourney-admin`.**
> Origem: o mesmo módulo já foi implementado no app mobile (`petjourney-app`), e este documento
> carrega o que foi aprendido lá, incluindo os erros.

---

## O pedido

Implemente o módulo clínico (agenda, prontuário eletrônico estruturado, fila de espera e painel
de faltas) no portal web do parceiro, seguindo `docs/vetmoduloclinicoimplementacao.md`, com
camada de dados mocada que já tem a forma da API.

**Ponto importante de enquadramento:** aquele guia foi escrito **para web**. Os épicos A
(fundação visual), B (agenda) e C (prontuário) descrevem exatamente este portal, com mouse,
teclado e tela larga. A versão mobile precisou adaptar quase tudo. Aqui você pode seguir o
documento **ao pé da letra**, e onde ele fala em densidade, atalho de teclado, arraste e
virtualização, é para implementar de verdade, não adaptar.

---

## 1. O que já existe, nos dois repositórios

### No portal (`petjourney-admin`)

- **As rotas já existem**, em `src/pages/(accounts)/veterinario/{agenda,prontuarios,pacientes,atividades,compartilhamentos}.vue`.
  Hoje são **stubs de produção**: renderizam `ClinicalFeaturePlaceholder` dentro de
  `PartnerPageFrame`. Você substitui o conteúdo desses arquivos, não cria do zero.
- `src/_mocks/veterinario/*.vue` — as telas de demonstração originais, com arrays estáticos dentro
  do próprio componente. Foram arquivadas para o go-live não expor dado fictício, estão fora do
  `file-routes` e fora do type-check.
- `CLINICAL_MENU_ENABLED = false` em `src/composables/useAppNavigation.ts:38`.
- `src/components/parceiro/PartnerPageFrame.vue` — **use este shell.** Ele já resolve três dos
  quatro estados que o guia exige, e mais dois portões que você não deve reimplementar:

  | Prop / evento | O que dá de graça |
  |---|---|
  | `loading` | Estado de carregamento |
  | `error` + `@retry` | Faixa de erro com "tentar de novo" |
  | `empty`, `emptyTitle`, `emptyDescription`, `emptyActionLabel` + `@emptyAction` | Estado vazio com ação primária |
  | `noPartnerAccess` | Conta sem membership de parceiro (403) |
  | `blockWhenSuspended` | Cadastro suspenso troca o conteúdo pelo gate de contato. Use nas telas operacionais |
  | slot `#actions` | Ações do cabeçalho da página |

  Sobra para você o quarto estado, `readonly`, que é do prontuário e não da página.
- `docs/DESIGN_SYSTEM.md` — direção visual do sistema clínico (sálvia `#84C1B4`, DM Sans, cartões
  16–18px, quente **só** para risco). É a régua da casa e ganha do que o guia sugerir de cor.
- `docs/PORTAL_PARCEIRO.md` e `docs/GUIA_IMPLEMENTAÇÃO.md`.
- Cores em `@/theme/colors` (`LightColors`) e `@/theme/color-mode` (`currentColors`).

**O que fazer com os mocks:** o módulo novo os **aposenta**, não os reativa. Eles não têm camada
de dados, não têm estado de carga e não têm os casos difíceis. Ao final, remova
`src/_mocks/veterinario/` e atualize `src/_mocks/README.md` dizendo que o destino deles agora é o
módulo real.

### No app mobile (`petjourney-app`, repositório irmão)

O módulo equivalente está em `src/features/clinico/`. Contrato para o backend em
`docs/specs/backend-modulo-clinico.md`.

---

## 2. Reaproveitamento literal: comece por aqui

Duas pastas do app mobile são **TypeScript puro, sem uma linha de React**. Copie-as para o
portal antes de escrever qualquer componente. Isso economiza a parte mais cara e mais fácil de
errar do trabalho.

| Origem (`petjourney-app`) | O que é | Ajuste necessário |
|---|---|---|
| `src/features/clinico/data/types.ts` | Contratos de domínio inteiros | Nenhum |
| `src/features/clinico/data/mock-runtime.ts` | Latência, taxa de erro, PRNG determinístico | Nenhum |
| `src/features/clinico/data/fixtures/*` | Clínica, profissionais, salas, tipos, pessoas, catálogos, faixas de referência | Nenhum |
| `src/features/clinico/data/seed.ts` | Gerador determinístico com os 12 casos difíceis | Nenhum |
| `src/features/clinico/data/store.ts` | Estado mutável em memória | Nenhum |
| `src/features/clinico/data/repositories/*` | Cinco repositórios com assinatura de API | Nenhum |
| `src/features/clinico/domain/*` | Tempo da clínica, conflitos, slots, faixas, dose, carga, sobreposição | Nenhum |

Sugestão de destino: `src/features/clinico/{data,domain}/`, espelhando a estrutura.

**A única dependência de plataforma** em toda essa árvore é `AsyncStorage` em
`hooks/use-autosave.ts` e `hooks/use-clinic-prefs.ts` — e esses dois são hooks React, ficam de
fora. No web troque por `localStorage`, que é o que o guia já pedia (`clinic.draft.<encounterId>`
e `clinic.density`).

**Confira depois de copiar** rodando o mesmo teste de fumaça que validou o dataset no mobile:
compile a pasta para CommonJS e verifique que o dia âncora nasce com 40 atendimentos e que
nenhum dos 12 casos está faltando. Se der 38 em vez de 40, leia a armadilha nº 4 abaixo.

---

## 3. Stack e convenções inegociáveis do portal

| Camada | O que usar |
|---|---|
| Framework | Vue 3.5 `<script setup lang="ts">` |
| Componentes | PrimeVue 4.5 com o `PetJourneyPreset` de `src/theme/primevue.ts` |
| Estilo | Tailwind 4 + tokens CSS `--partner-*` |
| Estado | Pinia 3 |
| Rotas | `vue-router` 5 com roteamento por arquivo em `src/pages/**/*.vue` |
| i18n | `vue-i18n` 11, quatro catálogos em `src/locales/` |
| Testes | Vitest 4 |

Portões antes de encerrar qualquer tarefa:

```bash
npm run type-check     # vue-tsc
npm run lint           # oxlint + eslint
npm run check:i18n     # paridade dos quatro catálogos
npm run test:unit
```

### Regras do projeto que valem aqui

1. **"Responsável", nunca "tutor" em texto visível pt.** Exigência legal. `en`/`en-GB` usam
   "pet parent"; `es` segue com "tutor". O termo sobrevive **só** como identificador de código e
   campo de API: `tutorId`, `mensagemTutor`, claim `TUTOR`, rota `/tutor`, `colors.tutor.*`.
   Como os tipos copiados usam `tutorId` e `Tutor`, isso está correto e **não deve ser
   renomeado**. O que muda é o que aparece na tela.
2. **Dark mode existe neste portal.** Ao contrário do app. Todo token de cor do módulo precisa de
   par claro/escuro. Veja a armadilha nº 6.
3. **Backend é leitura livre, escrita só com permissão explícita.** `petjourney-api` está em
   `c:\Users\darkb\OneDrive\Documentos\projetos\petjourney-api`. Leia controller e DTO de lá em
   vez de confiar em Swagger ou doc de handoff. Neste módulo você **não precisa** do backend: a
   camada mocada é o escopo.
4. **Estado de visualização na URL.** Data, visão, agrupamento e filtros como query params do
   vue-router. É o que permite a recepção mandar link para o veterinário e voltar ao mesmo lugar
   depois de recarregar. No web isso é natural, então não tem desculpa.

---

## 4. O que muda do mobile para o web

O mobile teve que abrir mão de coisas. Aqui elas voltam, e são requisito.

| Assunto | Mobile fez | Web deve fazer |
|---|---|---|
| Densidade | Fonte base 14, alvo 44px | Fonte base 13, valor clínico 14 **tabular**, altura de linha alternável em 32/36/44, alvo 28px de mouse. Três densidades persistidas em `localStorage` sob `clinic.density` |
| Grade | Colunas com rolagem horizontal, 2 visíveis por vez | Todas as colunas visíveis, grade completa, zoom de 10/14/20px por slot de 15 min |
| Remarcar | Botões de passo de 15 min | **Arraste** com confirmação, alça de redimensionar nas bordas do card, snap de 15 min. E o equivalente por teclado é obrigatório, não opcional |
| Teclado | Não existia | Atalhos globais (`D`/`S`, `P`/`R`, `T`, setas, `N`, `B`, `E`, `/`, `Esc`, `?`) e prontuário preenchível inteiro sem mouse, incluindo comandos com `/` no campo de observação |
| Virtualização | `FlatList` | Virtualização vertical do eixo de tempo acima de 100 linhas, e a meta de 60fps com 40 atendimentos vale |
| Painéis | Um `Modal` por vez, porque o nativo não empilha | Sem essa restrição. Drawer lateral de 320px, como o guia desenha |
| Página de referência | Não fiz | **Faça.** Rota `/design/clinico` com os cinco componentes base nos quatro estados, alternador de densidade ao vivo, seção de 200 linhas para julgar cansaço e o teste dos nomes extremos. É entregável do épico A e o guia trata como bloqueante |
| Modo escuro | Fora de escopo | Em escopo, porque o portal já tem |

---

## 5. Arquitetura alvo

```
src/features/clinico/
├── data/          # copiado do mobile, sem alteração
├── domain/        # copiado do mobile, sem alteração
├── theme/
│   └── clinic-tokens.css     # tokens do épico A, claro + escuro
├── stores/        # Pinia: agenda, prontuário, fila, preferências
├── composables/   # useAgendaDia, useProntuario, useConflitos, useClinicFormat...
└── components/
    ├── base/      # PatientHeader, DataTable, ClinicalForm, AlertChip, RefValue
    ├── agenda/    # day-grid (time-axis, column, appointment-card, block-band, now-line),
    │              # week-view, drawers, dialogs, waitlist, no-show
    └── prontuario/# encounter-page, anamnesis, physical-exam, diagnosis, care-plan, timeline

src/pages/(accounts)/veterinario/
├── agenda.vue                  # já existe como stub, substituir o conteúdo
├── pacientes.vue               # idem
├── prontuarios.vue             # idem
├── atividades.vue              # idem
├── meu-dia.vue                 # novo
├── atendimento/[encounterId].vue   # novo
├── paciente/[petId]/historico.vue  # novo
├── fila.vue                    # novo
└── faltas.vue                  # novo

src/pages/design/clinico.vue        # página de referência do épico A
```

Toda página do módulo abre com `PartnerPageFrame`, passando `loading`, `error` e `empty` a partir
do store. Não escreva estado de carga próprio: o que a página precisa fazer é traduzir o estado
do store nas props do frame.

### Estado: sem TanStack Query aqui

O mobile usa React Query e uma invalidação central. No portal, use **Pinia** com a mesma
disciplina, que é o que realmente importa:

> Neste domínio quase toda escrita mexe em mais de uma leitura. Marcar uma falta muda a grade do
> dia, a carga da semana, os horários livres, a fila de espera e o painel de faltas. **Toda mutação
> invalida tudo**, por um helper único. Invalidar só o pedaço óbvio deixa metade da tela
> desatualizada, e é o tipo de bug que ninguém percebe até a recepção marcar duas pessoas no
> mesmo horário.

Na prática: um `useClinicoStore` com `invalidarTudo()` que zera os caches derivados, ou
`$reset()` seletivo. A exceção é o autosave do prontuário, que grava direto no registro em edição
sem invalidar nada, senão a tela pisca a cada pausa de digitação.

---

## 6. Armadilhas conhecidas, com o motivo

Estas custaram tempo no mobile. Todas se aplicam aqui.

**1. Hora de parede da clínica, nunca a do navegador.**
`domain/clinic-time.ts` converte tudo pelo offset da clínica (`-04:00`). Quem opera com o
computador em outro fuso leria 09:00 como 10:00, e isso é erro clínico, não cosmético. `Date` só
aparece dentro daquele arquivo. Não introduza `new Date()` em componente.

**2. Conflito e aviso viajam como `kind`/`templateId` + `params`, nunca texto pronto.**
O guia previa mensagem em pt-BR vindo do servidor. O portal tem quatro idiomas: texto pronto no
payload significa agenda em português dentro de uma interface em espanhol. Quem traduz é a
camada de apresentação, com `clinico.conflitos.<kind>`.

**3. O status do sinal vital é sempre recalculado, nunca digitado nem persistido pela tela.**
Se fosse digitado, editar o peso do paciente deixaria a leitura antiga marcada como "dentro" para
sempre.

**4. O sorteio de status precisa de um gerador separado do sorteio de posicionamento.**
No `seed.ts` isso já está resolvido (`rngStatus`), mas entenda o porquê antes de mexer: o status
depende do relógio (o que já passou está finalizado). Consumindo do mesmo fluxo, a hora em que o
app abriu desloca o sorteio dos horários, e o dia âncora deixa de ter sempre os mesmos 40
atendimentos. Deu 40 de manhã e 38 à tarde até isolar os dois.

**5. A reserva provisória de 5 minutos precisa ser devolvida.**
Se ela nascer ao escolher o horário e ninguém chamar `liberarReserva`, voltar da confirmação
deixa o horário preso, invisível para a clínica e para os outros. Libere ao sair da confirmação,
ao editar qualquer escolha e ao desmontar a tela. No Vue, `onBeforeUnmount` mais o guard
`onBeforeRouteLeave`.

**6. Todo campo e overlay do PrimeVue nasce com fundo claro no modo escuro.**
O `PetJourneyPreset` inverte `surface` 900/950 no topo, e o Aura usa esses tokens para
`formField.background`, `content.background` e `overlay.*.background`. Cada `InputText`, `Select`,
painel de `Select` e `Dialog` precisa pintar o próprio fundo com os tokens. Dois detalhes que já
custaram tempo:
- `class="x"` num componente PrimeVue cai na **raiz** dele, então `.x :deep(.p-select)` nunca
  casa. As regras de fundo têm que ficar em `.x` direto.
- Overlay de `Select` e painel de `Dialog` são teleportados para fora da página e não herdam
  `--partner-*`. Mande os tokens via `:pt="{ overlay: { style: ... } }"` ou desenhe o painel no
  slot `#container`, como fazem `ValidarCupomDialog` e `VincularCodigoDialog`.

**7. Acento de perfil não é constante global.**
No mobile eu fixei o acento do módulo na cor do parceiro e reusei aqueles componentes numa tela
de responsável. Resultado: cabeçalho na cor de um perfil e todo o resto na do outro. Se algum
componente do módulo for ser reaproveitado na área `(accounts)/tutor`, o acento tem que vir do
perfil ativo, não do token do módulo.

**8. Falta e cancelamento liberam o horário, mas continuam visíveis no dia.**
Sumir da grade é como a recepção perde a informação de que o horário vagou. Card cancelado fica
com opacidade reduzida e riscado, com filtro "ocultar cancelados" no menu.

**9. Bloqueio recorrente precisa ser materializado na data pedida.**
Devolver a ocorrência original faz a faixa aparecer no horário certo do dia errado.

**10. Nada bloqueia.**
Encaixe, invasão de bloqueio e agendamento em dia fechado são sempre possíveis, com aviso. Só
`holiday-closed` é `blocking`, e mesmo assim a interface oferece confirmar em dois passos. O
botão primário nomeia a consequência: "Encaixar mesmo assim", não "Salvar". Sistema que proíbe
vira sistema contornado no papel, com atendimento fantasma numa agenda paralela.

---

## 7. Fases, cada uma com algo demonstrável

Não avance sem o critério de aceite da anterior.

| Fase | Entrega | Aceite |
|---|---|---|
| **1** | `clinic-tokens.css` (claro + escuro) e `/design/clinico` com `PatientHeader`, `DataTable`, `ClinicalForm`, `AlertChip` e `RefValue` nos quatro estados | Nenhum componente do módulo tem valor literal de cor, espaçamento ou fonte. Densidade alterna ao vivo e persiste. Os três nomes extremos não quebram o cabeçalho em 1280, 1024 e 768. Em escala de cinza nenhuma informação se perde |
| **2** | `data/` e `domain/` copiados, stores Pinia, painel de desenvolvimento | Os 12 casos difíceis existem e são alcançáveis em até 3 cliques a partir do painel. Nenhum componente importa `fixtures` direto |
| **3** | Grade do dia por profissional, eixo de tempo, linha do agora, cards | 40 atendimentos, primeiro paint abaixo de 400 ms, rolagem a 60fps |
| **4** | Sobreposição, encaixe, modo sala, atendimento de duas salas, atravessa o almoço | A cirurgia aparece nas duas colunas ligadas visualmente e arrasta junto. O banho que invade o almoço é legível e marcado |
| **5** | Bloqueios, feriado, arraste com confirmação, cancelar, desfazer de 8 s | Arrastar sempre abre confirmação com de → para e o texto que sairia. Toda ação de mouse tem equivalente de teclado |
| **6** | Visão de semana, carga por dia, melhores alternativas | Ocupação com número em texto além da barra |
| **7** | Falta, histórico de faltas, política de reincidência | O painel mostra quantas **e quanto**. A política é sugestão, com o toggle explicando |
| **8** | Fila de espera, oferta de vaga, expiração | Cancelar, remover bloqueio ou marcar falta oferece a vaga para a fila |
| **9** | Prontuário: layout, anamnese, exame físico com faixas | `não aferido` é distinguível de vazio, na interface e no dado |
| **10** | Diagnóstico, conduta, prescrição com dose, retorno que cai na agenda | A dose aparece por extenso. Alergia registrada exige confirmação explícita |
| **11** | Timeline, retorno mostrando a consulta anterior, rascunho, dois dispositivos, modo teclado | Rascunho sobrevive a recarregar e fechar o navegador. Segundo dispositivo entra em leitura com transferência explícita. A consulta inteira se preenche sem tocar no mouse |
| **12** | "Meu dia" e aposentadoria dos mocks | `CLINICAL_MENU_ENABLED` ligado, `ClinicalFeaturePlaceholder` fora das rotas de clínica, `_mocks/veterinario/` removido, `_mocks/README.md` atualizado |

### Sobre a fase 12

"Meu dia" não está no guia original, e vale a pena. Foi a peça que mais mudou o uso no mobile:

> A agenda respondia a pergunta errada. Grade é ferramenta de quem procura horário; quem chega de
> manhã pergunta **o que é agora**. A tela responde nesta ordem: o que estou atendendo ou o que
> vem em seguida, quem já chegou e está esperando, quem tem alerta que muda conduta hoje, e que
> retorno ficou sem horário marcado, que é receita parada na mesa.

No portal ela é a landing natural do perfil veterinário, com a agenda a um clique.

---

## 8. Checklist de entrega

**Fundação**
- [ ] `/design/clinico` completo e revisado por alguém que opera clínica de verdade, com o feedback registrado no fim da página
- [ ] Nenhum valor literal de cor, espaçamento ou fonte fora do arquivo de tokens
- [ ] Escala de cinza não perde nenhuma informação
- [ ] Claro e escuro conferidos em campo, overlay e diálogo do PrimeVue

**Dados**
- [ ] Os 12 casos difíceis existem e são alcançáveis pelo painel de desenvolvimento
- [ ] O painel controla latência, erro por operação, reset, data e densidade
- [ ] Nenhum componente importa `fixtures` diretamente

**Agenda**
- [ ] O roteiro completo roda sem sair da tela: marcar, encaixar, bloquear, arrastar, marcar falta, cancelar e oferecer vaga
- [ ] 40 atendimentos a 60fps; 120 ainda navegável
- [ ] Toda ação de mouse tem equivalente de teclado
- [ ] Recarregar a página com a URL atual devolve exatamente a mesma visão

**Prontuário**
- [ ] Consulta completa preenchida só com teclado
- [ ] Retorno abre mostrando a consulta anterior
- [ ] Rascunho sobrevive a recarregar e a fechar o navegador
- [ ] Segundo dispositivo entra em leitura, com comparação campo a campo

**Transversal**
- [ ] Nenhum texto de interface fixo no template; tudo nos quatro catálogos, com `npm run check:i18n` passando
- [ ] Texto visível em pt usa "responsável", nunca "tutor"
- [ ] `npm run type-check`, `npm run lint` e `npm run test:unit` limpos

---

## 9. Como validar sem backend

O módulo roda inteiro sem API. O painel de desenvolvimento (só fora de produção) sobe latência,
força erro por operação, recria os dados, desloca o relógio, simula o segundo dispositivo e pula
direto para cada caso difícil.

O dataset é determinístico: mesma semente, mesmo dia âncora, mesmos 40 atendimentos. Ele nasce
sempre em **hoje**, empurrado para a próxima segunda quando cai em fim de semana, porque dataset
preso a data fixa morre na semana seguinte.

Para conferir o modo escuro sem login, o portal já tem o caminho: `dark-check.html` com um entry
temporário na raiz, `npx vite --port 5199` e screenshot com `chrome --headless=new --screenshot`.

---

## 10. Honestidade na entrega

Duas coisas que valem ser ditas de saída, porque foram cobradas no mobile:

- **Typecheck passando não é "pronto".** Para interface, pronto exige o navegador aberto e olho
  humano. O que não foi visto em tela, diga que não foi.
- **Atalho declarado, não disfarçado.** Se entregar um pedaço como esqueleto porque fazer certo
  exigia algo que não estava disponível, diga isso explicitamente em vez de deixar parecer
  feature pronta.
