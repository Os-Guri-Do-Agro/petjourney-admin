# Pedidos do Luís de 17/11: o que cada front faz

**Para:** o Luís e o agente dele, nos repos `petjourney-admin` (portal do parceiro), `petjourney-app` (Expo), `petjourney-web` (site) e `petjourney-cms` (CMS).
**Origem:** os 5 pedidos do Luís de 17/11/2026. O Nicolas mandou fazer **só a API** nesse dia; os fronts ficam com este guia.
**API:** no `develop` do `petjourney-api` até `dfb443f4` (17/11, 17:55), menos o N42 (pedido 5), que sobe na noite de 17/11.
**Specs da API** (em `docs/specs/2026/q4/q4-2/` do `petjourney-api`): `pedidos-luis-17-11-orquestracao.md` (fotos), `modulos-ligados-pelo-dono.md`, `parceiro-varias-categorias.md`, `conexao-paciente-clinica.md` e `lembrete-de-vacina-pedido-pela-clinica.md`.
**Base dos fronts lida:** portal `origin/develop` `a19ae2c`, app `ae95954`, site `be63552`, CMS `c636af9`. Os números de linha são aproximados; procure pelo trecho citado.

---

## Antes de tudo: tipos do contrato

O contrato é `contrato/openapi.json` do `petjourney-api`, no `origin/develop`. Tudo o que está aqui foi conferido nele (o N42 foi conferido no commit da worktree dele, ver seção 5).

- **Portal:** `git -C ../petjourney-api fetch` e depois `npm run contrato:gerar`. O script lê o `contrato/openapi.json` do `origin/develop` do repo irmão com `git show` (não precisa de checkout) e grava `src/service/contrato/openapi.ts`. Para usar outro arquivo: `npm run contrato:gerar -- ../petjourney-api/contrato/openapi.json`. Depois, `npm run type-check`.
- **App:** o mesmo comando, `npm run contrato:gerar` (grava `services/contrato/openapi.ts`).
- **Site e CMS:** não geram tipos do contrato; os tipos são escritos à mão. Acrescente os campos novos como opcionais, para não quebrar contra uma API mais velha.
- **Pedido 5 (N42):** gere os tipos de novo depois que o N42 subir no `develop`.

**Atenção aos códigos de erro.** Desde o `3607c1d4` (17/11, noite), o enum `CodigoClinico` do contrato ("para decidir a tela") tem todos os códigos de módulo que saem no campo `codigo`: `MODULO_GERENCIAR_APENAS_DONO`, `MODULO_TAXA_EXCEDIDA`, `MODULO_JA_SOLICITADO`, `MODULO_REATIVACAO_PELO_SUPORTE`, `MODULO_JA_ATIVO`, `MODULO_TESTE_JA_USADO`, `MODULO_DECIDIDO_PELO_SUPORTE`, `MODULO_PRAZO_VENCIDO_PARA_RELIGAR`, `MODULO_NAO_ESTA_LIGADO`, `MODULO_JA_DESLIGADO` e `MODULO_FORA_DA_CATEGORIA`, além de `PARCEIRO_CATEGORIA_EXIGE_CNPJ` e `PARCEIRO_CATEGORIA_EXIGE_CRMV`. Regenere os tipos depois desse commit. A exceção é `PARCEIRO_CATEGORIA_FORA_DA_LISTA` (400 de validação do cadastro), que sai no campo `reason`, como os outros erros do formulário do cadastro, e não no `codigo`. Todas as respostas de erro trazem `message` já traduzida pelo `Accept-Language` nos 6 idiomas; o portal pode mostrar a `message` e usar o `codigo` só para decidir o que fazer.

---

## 1. Fotos dos pets nas listas de pacientes (portal)

> Pedido: "Grande maioria das fotos/avatares dos pets não aparecem nas listagens de pacientes do parceiro na clínica."

### O que a API mudou

Commits `d783186e`, `e8ba1cb8` e `d57d2a8d`. As listas passaram a trazer `fotoUrl` com a **foto efetiva** do paciente:
- a foto que a clínica subiu; ou, sem ela,
- uma **miniatura limpa** da foto do pet no app (256 px, JPEG, sem metadados), só com o **vínculo ATIVO** com o responsável dono do pet e a conta dele viva.

Regras do campo (as mesmas em todos os schemas abaixo; o campo é obrigatório e anulável):
- **URL assinada** de bucket privado, válida por **pelo menos 15 minutos** a partir da resposta. A mesma URL pode voltar em respostas seguidas, e o navegador aproveita o cache. **Não acrescente** `?t=` nem nada que quebre o cache.
- **`null`** quando não há foto, quando o storage está fora ou **na primeira leitura** de um paciente com vínculo: a miniatura do app é preparada em segundo plano e aparece num pedido seguinte (recarregar a tela, ou a próxima leitura natural). Não chame a lista em laço para esperar a foto.
- A imagem pode falhar ao carregar (URL vencida com a tela aberta muito tempo, rede). **Na falha, mostre as iniciais com a silhueta da espécie**, nunca o ícone de imagem quebrada.
- `PetAvatar` espera a espécie do portal (`'canina' | 'felina' | ...`), e a API manda `CACHORRO`, `GATO` etc. Use o mapa que já existe, `ESPECIE_DO_AVATAR` de `@/utils/parceiro/acesso-na-lista` (`OUTRO`, `COELHO` e `PEIXE` caem em `null`, só iniciais).

| Rota | Schema | `fotoUrl` vem preenchida |
|---|---|---|
| `GET /parceiro/portal/pacientes` (busca e seletores) | `PacienteResumoDto` | sim |
| `GET /parceiro/portal/pacientes/:id` (ficha) e as escritas da ficha | `PacienteDto` | sim |
| `GET /parceiro/portal/clinica/vacinas/chamada` e `.../vacinas/aplicadas` | `PacienteResumoDto` (em `paciente`) | sim |
| `GET /parceiro/portal/clinica/agenda/dia` | `PacienteNaAgendaDto` | **só aqui**. Em `agenda/semana`, `agenda/intervalo` e nas respostas das escritas do agendamento vem `null` |
| `GET /parceiro/portal/clinica/fila` | `PacienteDaFilaDto` | **só na lista**. Em `fila/elegiveis`, `fila/vagas`, `fila/:id` e nas escritas vem `null` |
| `GET /parceiro/portal/clinica/internacao/mapa` e `GET .../internacoes/:id` | `PacienteDaInternacaoDto` | sim (mapa e detalhe) |
| `GET /parceiro/portal/hotel/hospedes` | `HospedeDto` (`fotoUrl` e `especie` no próprio item) | sim |

Fica de fora: `GET /parceiro/portal/clinica/meu-dia` (o painel `ItemDoPainelDto` só tem `pacienteId` e `pacienteNome`, sem foto).

### Portal (`petjourney-admin`): o que mudar

1. **`src/features/hotel/components/base/PetAvatar.vue`** (base de tudo):
   - aceitar `fotoUrl?: string | null`;
   - pôr `@error` na `<img>`: guardar `falhou = true` e cair no ramo das iniciais com a silhueta da espécie;
   - zerar o `falhou` quando a `fotoUrl` mudar (`watch`), para a próxima URL ter a chance dela;
   - o comentário do topo diz que a foto existe "só na camada mocada": atualizar para dizer que vem da API (foto da clínica ou miniatura do app) e que a falha cai nas iniciais;
   - teste no `vitest`: com `fotoUrl` mostra a `<img>`; depois do `error` mostra as iniciais; com `fotoUrl` nova volta a mostrar a `<img>`.
2. **`src/components/cadastro/PacientesLista.vue`** (linha ~409): passar `:foto-url="paciente.fotoUrl"` no `PetAvatar` que já existe.
3. **Seletores de paciente nas gavetas.** Todas chamam `listarPacientes` e recebem `PacienteResumoDto`. Onde a opção do paciente é desenhada, pôr o `PetAvatar` (tamanho `sm`) com `fotoUrl`, `especie` pelo `ESPECIE_DO_AVATAR` e as iniciais:
   - `src/components/agendamentos/MarcarGaveta.vue`
   - `src/components/cadastro/EscolherPacienteGaveta.vue`, `MesclarGaveta.vue`, `NovoPacienteGaveta.vue` (a lista de possíveis repetidos), `PorAcessoGaveta.vue`
   - `src/components/copias/NovoPedidoDeCopiaGaveta.vue`
   - `src/components/fila/EntrarNaFilaGaveta.vue`
   - `src/components/hotel/reservas/EsperaGaveta.vue` e `NovaReservaGaveta.vue`
   - `src/components/internacao/InternarGaveta.vue`
4. **`src/components/vacinas/VacinasDaClinica.vue`** (linha ~506, o `PetAvatar` do cartão): `:foto-url="cartao.paciente.fotoUrl"`. Vale para a lista de chamada e para as aplicadas.
5. **Agenda do dia:**
   - `src/components/home/useLinhaDoDia.ts`, no caminho da `agenda/dia` (linhas ~132 a 147): `petFotoUrl: item.paciente.fotoUrl ?? ''` e `petEspecie: ESPECIE_DO_AVATAR[item.paciente.especie] ?? null`. Hoje está `petFotoUrl: ''` e `petEspecie: null`. O `HomeAgenda.vue` já passa `rosto.fotoUrl` ao `PetAvatar` e não muda.
   - **Bug das iniciais**, nas linhas ~135 e ~318 do mesmo arquivo: `split(/s+/)` corta na letra "s", e não no espaço. Trocar por `split(/\s+/)`. Hoje "Bisteca" vira "BT"; com a correção vira "B", e "Bolinha de Neve" vira "BN". Acrescente esses dois casos no `__tests__/useLinhaDoDia.spec.ts`.
   - A linha ~318 é o caminho do `meu-dia`, que não tem foto: lá só a correção do `split`, e `petFotoUrl` continua `''`.
   - `src/components/agendamentos/GradeDoDia.vue` (o nome do paciente no cartão, linha ~304): pôr o `PetAvatar` (`xs` ou `sm`) ao lado do nome com `agendamento.paciente.fotoUrl` e a espécie. Na visão da semana a API manda `null`, e o avatar mostra as iniciais.
6. **`src/components/fila/FilaDeEspera.vue`** (linha ~422, `entrada.paciente.nome`): pôr o `PetAvatar` com `entrada.paciente.fotoUrl` e a espécie.
7. **Internação:**
   - `src/components/internacao/LeitoDoMapa.vue` (linha ~121): hoje passa `:especie="null"`. Passar `:especie="ESPECIE_DO_AVATAR[internado.paciente.especie] ?? null"` e `:foto-url="internado.paciente.fotoUrl"`.
   - `src/components/internacao/InternacaoDetalhe.vue`: no cabeçalho do paciente, pôr o `PetAvatar` (`lg`) com `internacao.paciente.fotoUrl` e a espécie.
8. **`src/components/hotel/estadia/HospedesDoHotel.vue`** (linha ~107, `h.pacienteNome`): pôr o `PetAvatar` com `h.fotoUrl`, `ESPECIE_DO_AVATAR[h.especie]` e as iniciais de `h.pacienteNome`.
9. A ficha (`FichaDoPaciente.vue`) já mostra `paciente.fotoUrl` com `@error="aoFalharFoto"`. Não muda; agora ela também mostra a miniatura do app quando a clínica não tem foto.

Nenhum texto novo.

### Pronto quando (portal)

- [ ] Paciente com foto da clínica: a foto aparece na busca de pacientes, nos seletores das gavetas, na lista de chamada e nas aplicadas de vacinas, na agenda do dia (grade e início), na fila, no mapa e no detalhe da internação e nos hóspedes do hotel.
- [ ] Paciente sem foto da clínica, com vínculo ativo e foto no app: na primeira leitura aparecem as iniciais; recarregando alguns segundos depois, aparece a foto do app.
- [ ] No DevTools, bloquear o domínio do storage (o host da `fotoUrl`) e recarregar: todas as telas mostram iniciais com a silhueta da espécie. Nenhuma imagem quebrada.
- [ ] O cachorro "Bisteca" mostra "B" no início e na agenda do dia, não "BT".
- [ ] No mapa de leitos, o gato internado sem foto mostra a silhueta de gato.
- [ ] `npm run type-check`, `npm run test:unit` e `npm run check:i18n` limpos.

---

## 2. Módulos ligados e desligados pelo próprio dono (portal e CMS)

> Pedido: "Hoje os parceiros não conseguem ativar/desativar os módulos sozinhos."

### O que a API mudou

Commits `c4e74c21`, `e7b37916` e `dfb443f4`.

- **Ligar:** o DONO liga sozinho um módulo que nunca teve, ou que está `SOLICITADO`, e ganha um **teste grátis de 30 dias** (`TESTE`, origem `TESTE_GRATUITO`). É uma vez por módulo, e só para o módulo sugerido pelas categorias do cadastro: Clínica para `CLINICA_VETERINARIA` ou `VETERINARIO`, Hotel para `HOTEL_CRECHE`. Fora disso, segue o "Pedir o módulo" de hoje.
- **Desligar:** o DONO desliga `TESTE` ou `ATIVO` quando quiser. O módulo vira `DESLIGADO`: a leitura e a exportação continuam, e criar ou alterar fica travado. Nada é cancelado nem apagado, e os responsáveis não recebem aviso.
- **Religar:** é a mesma rota `ligar`. O que o próprio dono desligou volta ao status anterior, com o mesmo prazo, enquanto o prazo valer.
- **O admin vence:** módulo suspenso, recusado ou desligado pelo admin, teste já usado e vencido, ou renovação: só pelo admin.
- **Limite:** 20 trocas por hora por módulo.
- OPERADOR não liga nem desliga.

**Rotas** (portal; `?parceiroId=` como nas outras; corpo `{}`; `:modulo` em minúsculas, `clinica` ou `hotel`, como o `solicitarModulo` já faz com `modulo.toLowerCase()`):

| Rota | Resposta |
|---|---|
| `POST /parceiro/portal/modulos/:modulo/ligar` | `ModuloLigadoDto { modulo, status: 'TESTE' \| 'ATIVO', origem, ativoAte, acao: 'TESTE_GRATIS' \| 'RELIGADO' }` |
| `GET /parceiro/portal/modulos/:modulo/efeito-do-desligar` | `EfeitoDoDesligarDto { modulo, agendamentosFuturos, internacoesAbertas, reservasFuturas, hospedagensAbertas, total }` |
| `POST /parceiro/portal/modulos/:modulo/desligar` | `ModuloDesligadoDto { modulo, status: 'DESLIGADO', efeito: EfeitoDoDesligarDto }` |

O `ModuloDoPortalDto` (em `GET /parceiro/portal/eu`, `modulos[]`, e em `GET /parceiro/portal/modulos`) ganhou, por módulo:

| Campo | Tipo | Uso |
|---|---|---|
| `origem` | `'ADMIN' \| 'TESTE_GRATUITO' \| 'PLANO' \| null` | |
| `desligadoPeloDono` | `boolean` | desligado pelo próprio dono (pode religar) |
| `podeLigar` | `boolean` | mostra o botão de ligar |
| `ligarVira` | `'TESTE_GRATIS' \| 'RELIGAR' \| null` | o texto do botão |
| `bloqueioAoLigar` | código ou `null` | por que não dá para ligar agora (o mesmo código que o POST daria) |
| `podeDesligar` | `boolean` | mostra "Desligar" |
| `diasDeTesteGratis` | `number` (30) | use no texto, não fixe 30 |

### Portal (`petjourney-admin`)

**Arquivos:** `src/components/home/HomeModulos.vue` (textos em `inicio.modulos.*`) e `src/service/parceiro/acesso-service.ts`.

1. **Serviço:** `ligarModulo(modulo, params)`, `efeitoDoDesligar(modulo, params)` e `desligarModulo(modulo, params)`, no molde do `solicitarModulo` (`apiFetch<ApiEnvelope<...>>`, `buildParceiroQuery`). Tipos `ModuloLigadoDto`, `ModuloDesligadoDto` e `EfeitoDoDesligarDto` do contrato.
2. **Linha de cada módulo em `HomeModulos.vue`:**

| Situação (campos) | O que mostrar (pt-BR) |
|---|---|
| `podeLigar` e `ligarVira = 'TESTE_GRATIS'` | Botão **"Ligar teste grátis de {dias} dias"** (`diasDeTesteGratis`). Abaixo, texto menor: "Sem custo e sem cartão. Depois dos {dias} dias, a equipe PetJourney fala com você para continuar." |
| `podeLigar` e `ligarVira = 'RELIGAR'` | Botão **"Religar"**. Estado: "Desligado por você. Você pode religar até {data}." (`ativoAte`; sem data: "Desligado por você.") |
| `status = 'TESTE'` | Estado: "Teste grátis até {data}" (a chave `inicio.modulos.teste` já existe) |
| `podeDesligar` | Botão secundário **"Desligar"**, que abre a confirmação |
| `bloqueioAoLigar = 'MODULO_FORA_DA_CATEGORIA'` e `podeSolicitar` | O texto do código (tabela de erros) e o botão de pedir de hoje (**"Pedir o módulo"**) |
| `!podeLigar` e `bloqueioAoLigar` preenchido, diferente de `MODULO_JA_ATIVO` e de `MODULO_GERENCIAR_APENAS_DONO` | O texto do código, sem botão de ligar |
| `podeSolicitar` (fora da categoria, ou recusado) | O botão de pedir que existe hoje |
| `bloqueioAoLigar = 'MODULO_GERENCIAR_APENAS_DONO'` (OPERADOR) | Sem botões. Pode mostrar: "Só o dono liga ou desliga módulos." |

3. **Ligar:** `POST .../ligar`. Toast:
   - `acao = 'TESTE_GRATIS'`: "{modulo}: teste grátis ligado até {data}."
   - `acao = 'RELIGADO'`: "{modulo} religada." (Clínica) ou "{modulo} religado." (Hotel).
4. **Desligar:** ao tocar em "Desligar", chamar `GET .../efeito-do-desligar` e abrir a confirmação:
   - Título: **"Desligar a {modulo}?"** (Clínica) ou **"Desligar o {modulo}?"** (Hotel).
   - Texto: "O que já foi registrado continua disponível para consulta e exportação. Enquanto o módulo estiver desligado, ninguém da equipe consegue criar nem alterar nada nele."
   - Números (listar só os maiores que zero): "Ficam só para consulta: {n} agendamentos futuros, {n} internações em andamento." (Clínica: `agendamentosFuturos`, `internacoesAbertas`; Hotel: "{n} reservas futuras, {n} hospedagens em andamento", `reservasFuturas`, `hospedagensAbertas`). Use plural (1 agendamento futuro, 1 internação em andamento, 1 reserva futura, 1 hospedagem em andamento). Com `total = 0`: "Nada em andamento será afetado."
   - Fim: "Nada é cancelado nem apagado, e os responsáveis não recebem aviso. Você pode religar quando quiser enquanto o prazo do módulo valer."
   - Com `internacoesAbertas > 0`, destaque: "Há paciente internado: a equipe não vai conseguir registrar medicação nem evolução até você religar."
   - Se a prévia falhar, mostrar o texto sem os números e deixar desligar.
   - Botões: "Desligar" (destrutivo) e "Cancelar". Confirmado: `POST .../desligar`, toast "{modulo} desligada." (Clínica) ou "{modulo} desligado." (Hotel).
5. Depois de ligar ou desligar, **e em qualquer 409**, recarregar o `eu` (`obterEuNoParceiro`) para o menu acompanhar.

**Erros** (corpo com `codigo`; a `message` já vem traduzida; estes são os textos pt-BR da API):

| `codigo` | Status | Texto |
|---|---|---|
| `MODULO_GERENCIAR_APENAS_DONO` | 403 | Só o dono pode ligar ou desligar um módulo. |
| `PARCEIRO_NAO_OPERACIONAL` | 409 | (o texto que já existe) |
| `MODULO_JA_ATIVO` | 409 | Este módulo já está ativo. |
| `MODULO_TESTE_JA_USADO` | 409 | O teste grátis deste módulo já foi usado. Para continuar com ele, fale com a equipe PetJourney. |
| `MODULO_DECIDIDO_PELO_SUPORTE` | 409 | A equipe PetJourney suspendeu, recusou ou desligou este módulo. Para ligá-lo de novo, fale com a equipe PetJourney. |
| `MODULO_PRAZO_VENCIDO_PARA_RELIGAR` | 409 | O prazo deste módulo terminou enquanto ele estava desligado. Para religá-lo, fale com a equipe PetJourney. |
| `MODULO_NAO_ESTA_LIGADO` | 409 | Este módulo não está ligado, então não há o que desligar. |
| `MODULO_JA_DESLIGADO` | 409 | Este módulo já está desligado. |
| `MODULO_FORA_DA_CATEGORIA` | 409 | Este módulo não faz parte das categorias do seu cadastro, então o teste grátis não liga sozinho. Peça o módulo e a equipe PetJourney analisa. |
| `MODULO_TAXA_EXCEDIDA` | 429 | Muitas trocas neste módulo em pouco tempo. Tente de novo daqui a pouco. (o corpo traz `limite` e `tenteDeNovoEmSegundos`) |

Os textos do `bloqueioAoLigar` (sem chamar a rota) são os mesmos da tabela: guarde-os como chaves do portal, por exemplo `inicio.modulos.bloqueio.<CODIGO>`.

**Chaves novas sugeridas** (`inicio.modulos.*`, nos 6 locales do portal: `pt`, `en`, `en-GB`, `es`, `sr`, `ar`): `ligarTeste`, `ligarTesteDica`, `religar`, `desligadoPorVoce`, `desligadoPorVoceAte`, `desligar`, `soDonoGerencia`, `ligadoTeste`, `religado`, `desligado`, `confirmarDesligar.titulo`, `confirmarDesligar.texto`, `confirmarDesligar.ficam`, `confirmarDesligar.nada`, `confirmarDesligar.fim`, `confirmarDesligar.internado`, `confirmarDesligar.confirmar`, e `bloqueio.<CODIGO>`. Os textos de cima são a pt-BR; os outros 5 idiomas, no tom dos textos de `inicio.modulos.*` que já existem. Sem travessão.

### CMS (`petjourney-cms`)

**Arquivos:** `src/components/Partners/PartnerModulosPanel.tsx` e os tipos em `src/services/modulo-parceiro-admin.service.ts` (escritos à mão; campos novos opcionais).

O `ModuloDoAdminDto` de `GET /admin/parceiro/:parceiroId/modulos` ganhou: `testeDoDonoEm`, `testeDoDonoPorId`, `desligadoPeloDonoEm`, `desligadoPeloDonoPorId`, `statusAntesDeDesligar`, `recusadoPeloAdminEm` e `historicoDoDono[]` (`EventoDoDonoDto { acao: 'LIGOU_TESTE' | 'DESLIGOU' | 'RELIGOU', de, para, porUsuarioId, em }`, do mais novo ao mais velho, até 20).

| Situação | O que mostrar |
|---|---|
| `testeDoDonoEm` com status `TESTE` ou `ATIVO` | Selo **"Ligado pelo parceiro (teste grátis) em DD/MM"** |
| status `DESLIGADO` com `desligadoPeloDonoEm` | Selo **"Desligado pelo parceiro em DD/MM"** e "Pode religar para {statusAntesDeDesligar}". No modal de decisão do admin: "Sua decisão substitui a do parceiro: ele não consegue mais religar sozinho." |
| `testeDoDonoEm` nos outros estados | "Teste grátis do parceiro já usado em DD/MM" |
| `recusadoPeloAdminEm` num `SOLICITADO` | Selo **"Pedido refeito depois de recusa em DD/MM"** (o parceiro não liga o teste sozinho enquanto o admin não ligar) |
| `historicoDoDono[]` | Lista "Histórico do parceiro": "Ligou o teste grátis", "Desligou", "Religou", com a data |

O ligar e o religar do dono **não** preenchem `decididoPorId`, `decididoEm` nem `motivo` (esses são do admin).

### Pronto quando

- [ ] Portal: com um DONO de clínica (categoria `CLINICA_VETERINARIA`) sem o módulo Clínica, aparece "Ligar teste grátis de 30 dias"; ligar mostra o toast com a data, e o menu da Clínica aparece sem recarregar a página.
- [ ] Portal: "Desligar" mostra a confirmação com os números da prévia (com agendamentos futuros, a frase com o número certo); confirmado, o menu passa a só leitura; "Religar" volta ao teste com a mesma data.
- [ ] Portal: o mesmo DONO tenta o Hotel (fora da categoria): aparece o texto de `MODULO_FORA_DA_CATEGORIA` e o "Pedir o módulo".
- [ ] Portal: entrando como OPERADOR, nenhum botão de ligar ou desligar.
- [ ] Portal: 409 de qualquer tipo mostra a mensagem e recarrega o `eu`.
- [ ] CMS: o parceiro que ligou o teste mostra o selo "Ligado pelo parceiro" e o histórico com "Ligou o teste grátis".
- [ ] Portal: `type-check`, `test:unit` e `check:i18n` limpos. CMS: `npm test` limpo.

---

## 3. Cadastro com várias categorias (site, portal, CMS e app)

> Pedido: "Cadastro da empresa, o usuário poder selecionar mais de uma categoria."

### O que a API mudou

Commits `84d7d9d2` e `ed6d391e`. Mudança **aditiva**: os fronts de hoje continuam funcionando (mandam e leem `categoria`, e editar por eles não apaga as categorias secundárias).

```ts
// Entrada: POST e PATCH /parceiro/portal/cadastro, POST /parceiro e PATCH /parceiro/:id
categorias?: CategoriaParceiro[];      // 1 a 8, sem repetir; a PRIMEIRA é a principal
categoria?: CategoriaParceiro | null;  // compatibilidade; se vier junto, tem de estar em `categorias`

// Saída: onde havia `categoria`
categoria: CategoriaParceiro | null;   // a principal (= categorias[0])
categorias: CategoriaParceiro[];       // todas, a principal primeiro; [] = sem categoria
```

`CategoriaParceiro`: `CLINICA_VETERINARIA`, `VETERINARIO`, `PET_SHOP`, `BANHO_TOSA`, `ADESTRAMENTO`, `HOTEL_CRECHE`, `FARMACIA`, `OUTRO`.

Regras para o front:
1. Mande **só `categorias`**, com a principal na posição 0. Se mandar `categoria`, que seja `categorias[0]`.
2. O form não deve deixar zero categorias quando o campo é preenchido. `categoria: null` limpa tudo.
3. Mandar só `categoria` (front antigo) numa edição **troca a principal** e mantém as outras.
4. Os módulos sugeridos (`elegiveis`) passam a ser a união: clínica + hotel sugere Clínica e Hotel.
5. Clínica veterinária em qualquer posição exige CNPJ; veterinário em qualquer posição exige CRMV.

**Erros:**

| `codigo` | Status | Quando | O que a tela faz |
|---|---|---|---|
| (sem código) | 400 | lista vazia, repetida, fora do enum, mais de 8 | validar no form antes de mandar |
| `PARCEIRO_CATEGORIA_FORA_DA_LISTA` | 400 | `categoria` veio e não está em `categorias` | não acontece se o form mandar só `categorias`; mostrar a `message` |
| `PARCEIRO_CATEGORIA_EXIGE_CNPJ` | 409 | só no `PATCH /parceiro/portal/cadastro`, parceiro APROVADO, escolheu clínica sem CNPJ | mostrar a `message` e levar o foco ao campo do CNPJ |
| `PARCEIRO_CATEGORIA_EXIGE_CRMV` | 409 | idem, veterinário sem CRMV | mostrar a `message` e levar o foco ao campo do CRMV |

Os dois 409 trazem `faltando`: `['CNPJ']`, `['CRMV']` ou os dois. Nada é gravado.

**Onde a saída traz `categorias`:** `DadosDoCadastroParceiroDto` (`GET`/`PATCH /parceiro/portal/cadastro`), `GET /parceiro` e `GET /parceiro/:id` (admin), `ModulosDoAdminDto`, `ExigenciaDoParceiroDto` (`GET /parceiro/portal/eu/identidade`), `ParceiroDaPessoaDto`, `GET /admin/parceiro/feedbacks` (`item.parceiro.categorias`) e o diretório do app (`GET /clinica*`, `GET /veterinario*`). As duas últimas não têm schema no contrato (resposta sem tipo): acrescente `categorias?: CategoriaParceiro[]` à mão.

**Filtros** continuam com um valor (`?categoria=PET_SHOP`) e agora acham o parceiro que tem a categoria em qualquer posição.

### Site (`petjourney-web`)

**Arquivo:** `src/components/cadastro/ParceiroSignupForm.tsx` (etapa 2: o `<select id="parceiro-categoria">`, `form.categoria` na linha ~177, payload na linha ~323).

- Trocar o select por multi-seleção (chips ou caixas), de 1 a 8. A primeira escolhida é a principal; mostre "Principal" nela e deixe trocar.
- Payload: `categorias: [...]` no lugar de `categoria`. A categoria continua opcional no auto-cadastro: sem nenhuma escolhida, não mande o campo.
- Os nomes das categorias já existem em `categories.*` nos idiomas do site. Textos novos (pt-BR): "Escolha uma ou mais categorias", "Principal", "Tornar principal", "A principal aparece primeiro na sua página e nas buscas."

### Portal (`petjourney-admin`)

- **`src/components/parceiro/PortalParceiroCadastroForm.vue`** (select `cad-categoria`, `form.categoria`, payload na linha ~191): multi-seleção com principal; ler `categorias` do `GET`; mandar `categorias` no `PATCH`.
  - Tratar os 409 `PARCEIRO_CATEGORIA_EXIGE_CNPJ` e `PARCEIRO_CATEGORIA_EXIGE_CRMV`: mostrar a `message` e focar o campo pelo `faltando`.
  - Chaves novas (6 locales): `cadastro.categorias.rotulo` ("Categorias"), `cadastro.categorias.dica` ("Escolha uma ou mais. A primeira é a principal."), `cadastro.categorias.principal` ("Principal"), `cadastro.categorias.tornarPrincipal` ("Tornar principal"), `cadastro.categorias.minimo` ("Escolha pelo menos uma categoria.").
- **`PortalParceiroFunilSection.vue`** (linha ~67, `!cadastro.categoria`) e **`HomeModulos.vue` / `useAppNavigation.ts`** (leem `elegiveis`): não mudam.

### CMS (`petjourney-cms`)

Em `src/app/(private)/(app-shell)/(section-partners)/`:
- `partners/create/page.tsx` (criar e editar, linhas ~64 a 302): multi-seleção com principal; `categorias` no POST e no PATCH.
- `partners/page.tsx` (filtro `categoriaFilter`, linha ~163, e a coluna): filtro igual; a coluna mostra um selo por categoria, com a principal destacada.
- `partner-audits/page.tsx` (linha ~428, `displayCategoriaParceiro(partner.categoria)`): mostrar `categorias`.
- `partner-feedbacks/page.tsx` (filtro e linha ~525): filtro igual; mostrar `item.parceiro.categorias`.

### App (`petjourney-app`, opcional)

O diretório (`GET /clinica*`, `GET /veterinario*`) passa a trazer `categorias`. Nada quebra se o app ignorar. Se quiser, mostrar as categorias secundárias no detalhe da clínica.

### Pronto quando

- [ ] Site: auto-cadastro com 2 categorias; o `GET /parceiro/portal/cadastro` devolve as duas, a principal primeiro.
- [ ] Portal: editar só o telefone de um parceiro com 3 categorias mantém as 3.
- [ ] Portal: parceiro APROVADO sem CNPJ acrescenta "Clínica veterinária": a tela mostra a mensagem do 409 e o foco vai ao CNPJ; nada é salvo.
- [ ] Portal: clínica + hotel, aba Módulos: os dois módulos aparecem como sugeridos.
- [ ] CMS: o filtro "Pet shop" acha a clínica que marcou pet shop como segunda categoria; a grid mostra os selos.
- [ ] Site: `typecheck` e `test` limpos. Portal: `type-check`, `test:unit` e `check:i18n` limpos. CMS: `npm test` limpo.

---

## 4. Conexão do paciente com a clínica: convite por link, WhatsApp e QR (portal, app e site)

> Pedido: "Atualmente a forma do paciente se conectar à clínica não é boa, melhorar."

### O que a API mudou

Commits `1c09b537` e `8c2b577b`.

Hoje a clínica só manda proposta por e-mail (que a base dela quase não tem) ou por um código de 8 caracteres dito no balcão, que só serve a quem já tem o app e vale 72 h. Agora há **um convite só**, com **link e código juntos**:
- a recepção manda pelo **WhatsApp**, com mensagem pronta da API, ou mostra como **QR** no balcão;
- o responsável toca no link, o app abre direto na proposta e ele aceita em 1 toque.

Regras:
- O convite vale **7 dias** (antes, 72 h).
- **Vale o último:** gerar um convite novo cancela os pendentes do mesmo cliente cujos pacientes estão todos no convite novo.
- `EMAIL` e `CODIGO` continuam funcionando (o portal e o app publicados não quebram); as respostas só ganharam campos.

**`POST /parceiro/portal/clientes/:clienteId/propostas-de-vinculo`** (mesma permissão de hoje, `paciente.escrever`)

Entrada (`ProporVinculoDto`): `{ pacienteIds: string[] /* 1 a 20 */, canal: 'EMAIL' | 'CODIGO' | 'LINK' }`. O `LINK` é novo.

Saída (`PropostaCriadaDto`):

| Campo | Tipo | Observação |
|---|---|---|
| `id` | `string` | |
| `canal` | `OrigemVinculo` | `PROPOSTA_LINK` é novo |
| `status` | `StatusProposta` | |
| `expiraEm` | `string` (date-time) | agora + 7 dias |
| `codigo` | `string \| null` | preenchido em `LINK` e `CODIGO`; `null` em `EMAIL` |
| `link` | `string \| null` | **novo**; `LINK` e `CODIGO`. Ex.: `https://petjourney.health/clinica/vinculo/<token>` |
| `mensagem` | `string \| null` | **novo**; o texto pronto no idioma do portal (`Accept-Language`) |
| `whatsappUrl` | `string \| null` | **novo**; `https://wa.me/55...?text=...` com o telefone do cadastro (sem telefone: `https://wa.me/?text=...`, e a recepção escolhe o contato) |
| `canceladas` | `number` | **novo**; quantos convites anteriores deixaram de valer |

Erros (todos já existiam): 400 `CLIENTE_SEM_EMAIL` (só `EMAIL`), 409 `PACIENTE_INATIVO`, 409 `VINCULO_JA_ATIVO`, 422 `VINCULO_INCOMPLETO` e 429 `PROPOSTA_TETO_DIARIO` (o `LINK` conta no mesmo teto de 50 por dia).

**`POST /public/vinculo-clinico/previa`** (nova, sem login). Corpo `{ token }`. Resposta **sempre 200** (`PreviaDoConviteDto`):

```ts
situacao: 'VALIDA' | 'VENCIDA' | 'INDISPONIVEL'
clinica: { nome: string; cidade: string | null; uf: string | null; logoUrl: string | null; whatsappPublico: string | null } | null  // null em INDISPONIVEL
expiraEm: string | null
quantidadeDePets: number | null  // null em INDISPONIVEL
```

- Nunca traz nome de pet ou de pessoa, nem o código, nem se o link já foi aberto.
- Limite de 30 por 10 min por origem: 429 `TAXA_PUBLICA_EXCEDIDA`.

**`POST /tutor/clinica/vinculos-propostos/resgatar`** (`{ token }` ou `{ codigo }`), o mesmo de hoje, com duas mudanças:
- **Link vencido:** 410 `VINCULO_EXPIRADO` com `clinica: { nome, whatsappPublico, telefonePublico }` no corpo, para o app oferecer "Pedir outro convite". Pelo código, vencido continua 404.
- **Já resgatado por outra conta:** 409 `PROPOSTA_JA_RESGATADA` **só no convite por e-mail**. No `LINK` e no `CODIGO` dá o mesmo 404 de "não encontrado".

O código aceita hífen e minúsculas (`k7mq-x3pa` vale).

**Push `VINCULO_PROPOSTO`:** `dados.url` passa a ser `/screens/clinica/proposta?id=<propostaId>`.

### Portal (`petjourney-admin`)

**Arquivos:** `src/components/cadastro/LigarAoAppGaveta.vue`, `NovoPacienteGaveta.vue`, a lista de propostas da ficha e o serviço de vínculo.

1. **A gaveta "Ligar ao app" vira "Convidar para o app", sem abas.**
   - Ao abrir: `POST .../propostas-de-vinculo` com `canal: 'LINK'` e todos os pacientes **ativos e sem vínculo** do cliente.
   - Ação principal **"Enviar pelo WhatsApp"**: `window.open(whatsappUrl, '_blank', 'noopener')`.
   - **"Mostrar QR"**: QR local do `link`, em tela cheia, com o código embaixo e "Imprimir". O impresso diz: "Baixe o app PetJourney na App Store ou no Google Play, toque em Minhas clínicas e aponte a câmera para o QR. Ou digite o código {codigo}."
   - Secundárias: **"Copiar mensagem"** (copia a `mensagem`) e, se o cliente tem e-mail, **"Enviar por e-mail"** (`canal: 'EMAIL'`).
   - O "QR da carteirinha" vai para um bloco recolhido "Outras formas".
   - Com `canceladas > 0`: "O convite anterior deixou de valer."
   - Mostrar a validade: "Vale até {data}." (`expiraEm`).
2. **Fim do `NovoPacienteGaveta`:** um passo "Convidar para o app agora?" com as mesmas ações, e "Agora não".
3. **Lista de propostas:** botão **"Reenviar"** em "Expirada" e "Não respondida". Chama o mesmo POST; a API cancela o anterior.
4. **Rótulo da origem** `cadastro.vinculo.canal.PROPOSTA_LINK` nos 6 locales: `pt` "convite por link", `en` e `en-GB` "link invite", `es` "invitación por enlace", `sr` "pozivnica linkom", `ar` "دعوة برابط".
5. **Chaves novas** (pt-BR; 6 locales): `cadastro.convite.titulo` "Convidar para o app", `cadastro.convite.whatsapp` "Enviar pelo WhatsApp", `cadastro.convite.mostrarQr` "Mostrar QR", `cadastro.convite.copiar` "Copiar mensagem", `cadastro.convite.copiado` "Mensagem copiada", `cadastro.convite.email` "Enviar por e-mail", `cadastro.convite.validade` "Vale até {data}.", `cadastro.convite.anteriorCancelado` "O convite anterior deixou de valer.", `cadastro.convite.outrasFormas` "Outras formas", `cadastro.convite.imprimir` "Imprimir", `cadastro.convite.folha` (o texto do impresso acima), `cadastro.convite.agora` "Convidar para o app agora?", `cadastro.convite.agoraNao` "Agora não", `cadastro.convite.reenviar` "Reenviar".

O portal **não monta** a mensagem: ela vem pronta da API, no idioma do portal.

### App (`petjourney-app`)

1. **`services/notificacao/rotas-notificacao.ts`:** `VINCULO_PROPOSTO` abre `dados.url` (`/screens/clinica/proposta?id=...`), ou monta a rota com `dados.propostaId`. Sem id, continua a lista (`/screens/clinica/minhas-clinicas`, como hoje).
2. **`app/clinica/vinculo/[token].tsx`, sem login:** chamar `POST /public/vinculo-clinico/previa` e mostrar "{clinica} te convidou", com o logo. O botão principal leva ao **cadastro**, com "Já tenho conta" para o login. O token continua guardado como hoje.
   - `VENCIDA`: o texto de vencido e, se houver `whatsappPublico`, "Pedir outro convite".
   - `INDISPONIVEL`: o `clinica.link.naoEncontrado` de hoje.
3. **410 do resgate pelo link:** com `clinica.whatsappPublico`, o botão "Pedir outro convite" abre `https://wa.me/<whatsappPublico>?text=<clinica.link.pedirOutroTexto>`.
4. **`app/screens/clinica/proposta.tsx`** (linha ~215): a proposta vencida ou com erro hoje fica sem botão. Pôr "Ver minhas clínicas" e, se houver contato da clínica, "Falar com a clínica".
5. **`src/features/clinica/link-do-vinculo.ts`:** resetar `navegando.current = false` depois de navegar. Hoje o segundo link na mesma sessão não navega.
6. **CRIAR com pet de mesmo nome e espécie no app:** antes de mandar, avisar "Você já tem {pet} no app", com "Ligar ao que já tenho" e "Criar mesmo assim".
7. **Tela de boas-vindas (deslogado):** "Recebi um convite de uma clínica" leva ao cadastro e, depois, ao código.
8. **Rótulo** `parceiroClinica.vinculo.canal.PROPOSTA_LINK` (os mesmos 6 textos do portal, item 4 acima).
9. **Copy que ficou errada:** `clinica.codigo.explica` diz "vale por 3 dias"; agora são 7.

**Textos do app nos 6 idiomas** (ICU com chave simples, como o resto do app):

`clinica.codigo.explica` (troca o que existe):
- `pt`: "Digite o código que a recepção da clínica te passou. Ele tem 8 letras e números e vale por 7 dias."
- `en`: "Enter the code the clinic's front desk gave you. It has 8 letters and numbers and is valid for 7 days."
- `en-GB`: "Enter the code the clinic's front desk gave you. It has 8 letters and numbers and is valid for 7 days."
- `es`: "Escribe el código que te dio la recepción de la clínica. Tiene 8 letras y números y vale por 7 días."
- `sr`: "Unesite kod koji ste dobili na recepciji klinike. Ima 8 slova i brojeva i važi 7 dana."
- `ar`: "أدخل الرمز الذي أعطاك إياه استقبال العيادة. يتكون من 8 أحرف وأرقام وصالح لمدة 7 أيام."

Chaves novas em `clinica.link` (ao lado de `vencido` e `naoEncontrado`, que já existem):

| Chave | pt | en | en-GB | es | sr | ar |
|---|---|---|---|---|---|---|
| `convidou` | {clinica} te convidou | {clinica} invited you | {clinica} has invited you | {clinica} te invitó | {clinica} vas je pozvala | {clinica} أرسلت لك دعوة |
| `convidouCorpo` | A clínica quer acompanhar seus pets pelo app. Crie sua conta para ver o convite. | The clinic wants to follow your pets in the app. Create your account to see the invite. | The clinic would like to follow your pets in the app. Create your account to see the invitation. | La clínica quiere acompañar a tus mascotas en la app. Crea tu cuenta para ver la invitación. | Klinika želi da prati vaše ljubimce u aplikaciji. Napravite nalog da biste videli pozivnicu. | تريد العيادة متابعة حيواناتك الأليفة عبر التطبيق. أنشئ حسابك لرؤية الدعوة. |
| `criarConta` | Criar conta | Create account | Create account | Crear cuenta | Napravi nalog | إنشاء حساب |
| `jaTenhoConta` | Já tenho conta | I already have an account | I already have an account | Ya tengo cuenta | Već imam nalog | لدي حساب بالفعل |
| `pedirOutro` | Pedir outro convite | Ask for a new invite | Ask for a new invitation | Pedir otra invitación | Zatraži novu pozivnicu | اطلب دعوة جديدة |
| `pedirOutroTexto` | Olá! Meu convite do app PetJourney venceu. Pode me mandar outro? | Hi! My PetJourney app invite has expired. Could you send me a new one? | Hello! My PetJourney app invitation has expired. Could you send me a new one? | ¡Hola! Mi invitación de la app PetJourney venció. ¿Me pueden enviar otra? | Zdravo! Moja pozivnica za aplikaciju PetJourney je istekla. Možete li mi poslati novu? | مرحبًا! انتهت صلاحية دعوتي إلى تطبيق PetJourney. هل يمكنكم إرسال دعوة جديدة؟ |
| `recebiConvite` | Recebi um convite de uma clínica | I got an invite from a clinic | I've received an invitation from a clinic | Recibí una invitación de una clínica | Dobio sam pozivnicu od klinike | وصلتني دعوة من عيادة |

Chaves novas em `clinica.proposta`:

| Chave | pt | en | en-GB | es | sr | ar |
|---|---|---|---|---|---|---|
| `jaTemPetTitulo` | Você já tem {pet} no app | You already have {pet} in the app | You already have {pet} in the app | Ya tienes a {pet} en la app | Već imate {pet} u aplikaciji | لديك {pet} في التطبيق بالفعل |
| `jaTemPetCorpo` | Para não ficar com dois cadastros, ligue o convite ao pet que você já tem. | To avoid two profiles, link the invite to the pet you already have. | To avoid two profiles, link the invitation to the pet you already have. | Para no tener dos registros, vincula la invitación a la mascota que ya tienes. | Da ne biste imali dva profila, povežite pozivnicu sa ljubimcem kog već imate. | لتجنب وجود ملفين، اربط الدعوة بالحيوان الأليف الموجود لديك. |
| `ligarAoQueTenho` | Ligar ao que já tenho | Link to the one I have | Link to the one I have | Vincular a la que ya tengo | Poveži sa postojećim | اربطها بالموجود لدي |
| `criarMesmoAssim` | Criar mesmo assim | Create anyway | Create anyway | Crear de todos modos | Ipak napravi | إنشاء على أي حال |
| `erroAbrir` | Não foi possível abrir este convite. | We couldn't open this invite. | We couldn't open this invitation. | No pudimos abrir esta invitación. | Nismo mogli da otvorimo ovu pozivnicu. | تعذّر فتح هذه الدعوة. |
| `falarComClinica` | Falar com a clínica | Contact the clinic | Contact the clinic | Hablar con la clínica | Kontaktiraj kliniku | تواصل مع العيادة |

"Ver minhas clínicas" já existe (`clinica.link.irParaClinicas`). Os textos acima são proposta: passam pelo seu "ok" de copy.

### Site (`petjourney-web`)

**Arquivos:** `src/app/(public)/clinica/vinculo/[token]/page.tsx` e `src/components/vinculo/AbrirPropostaNoApp.tsx`.

- Chamar `POST /public/vinculo-clinico/previa` com `{ token }` **do navegador**, num componente cliente. Nunca no servidor do Next: o token não pode passar por log nem por proxy. Manter `Referrer-Policy: no-referrer` e a página sem analytics.
- `VALIDA`: "{clinica} quer conectar seus pets ao app PetJourney", com o logo, cidade e UF quando vierem, e "Vale até {data}".
- `VENCIDA`: "Este convite venceu." e, com `whatsappPublico`, o botão "Pedir outro convite pelo WhatsApp".
- `INDISPONIVEL`, 429 ou falha: o texto genérico de hoje.
- Texto depois dos botões das lojas: "Depois de instalar, toque no link de novo ou digite o código que veio na mensagem."
- Textos novos nos idiomas do site, sem travessão.

### Pronto quando

- [ ] Portal: na ficha de um cliente só com telefone, "Convidar para o app" abre direto com "Enviar pelo WhatsApp". O WhatsApp abre a conversa com o número do cadastro e a mensagem pronta (nome da clínica, pets, link, código e validade).
- [ ] Portal: "Mostrar QR" em tela cheia; a câmera do celular, com o app instalado, abre a proposta.
- [ ] Portal: gerar outro convite para o mesmo cliente mostra "O convite anterior deixou de valer", e o código antigo dá "não encontrado" no app.
- [ ] App: o push `VINCULO_PROPOSTO` abre a proposta, não a lista.
- [ ] App deslogado: o link mostra "{clinica} te convidou" e leva ao cadastro; depois do cadastro, cai na proposta.
- [ ] App: dois links seguidos na mesma sessão navegam os dois.
- [ ] App: o texto do código diz 7 dias nos 6 idiomas.
- [ ] Site, sem o app: a página mostra o nome da clínica; com um token inventado, o texto genérico.
- [ ] Portal `type-check`, `test:unit` e `check:i18n`; app `npx tsc --noEmit` e `lint`; site `typecheck` e `test`, todos limpos.

---

## 5. N42: lembrete de vacina pedido pela clínica (portal e app)

> **Contrato final: conferir no `develop` depois do push do N42.** Na hora deste guia (17/11, noite), o N42 ainda não está no `develop`. O que segue é a spec, conferido contra o contrato da worktree do N42 (`f13ee95c`, já com as correções da auditoria). Gere os tipos de novo quando ele subir e confira os nomes.

### O que a API mudou

Na **lista de chamada** de vacinas, a recepção liga um lembrete por dose que falta. O responsável recebe no app:
- um aviso na hora;
- **uma** repetição: no dia da próxima dose, se ainda vai vencer, ou 7 dias depois, se já venceu.

O lembrete para sozinho quando a dose é aplicada ou registrada, quando a aplicação é anulada e quando o paciente ou o vínculo deixam de valer. Também entrou a **edição** de observação e via de uma aplicação.

**Rotas** (`?parceiroId=`; módulo Clínica com escrita):

| Rota | Permissão | Resposta |
|---|---|---|
| `POST /parceiro/portal/clinica/aplicacoes/:id/lembrete` (corpo `{}`) | `agenda.escrever` | 201 ligou; 200 já estava ligado (o mesmo DTO, sem envio novo) |
| `DELETE /parceiro/portal/clinica/aplicacoes/:id/lembrete` | `agenda.escrever` | 204 sempre |
| `PATCH /parceiro/portal/clinica/aplicacoes/:id` | `vacina.aplicar` | 200 `AplicacaoDeVacinaDto` |

`:id` é o `aplicacaoId` do item da chamada.

`LembreteDaVacinaDto`:

```ts
aplicacaoId: string
ligadoEm: string
ligadoPorId: string
ultimoEnvioEm: string | null      // null até o primeiro sair (e enquanto está na fila)
proximoEnvioEm: string | null     // null = sem envio previsto
envios: number                    // 0 a 2
entrega: 'PENDENTE' | 'SO_NA_CAIXA' | 'ENVIADO' | 'ENTREGUE' | 'FALHOU' | null
motivoSemEnvio: 'SEM_CANAL_NO_APP' | 'NAO_AVISAR' | 'TETO_DO_DIA' | 'SUPERADO' | 'FORA_DO_PRAZO' | 'FALHOU' | null
```

`ChamadaDto` (em `GET /parceiro/portal/clinica/vacinas/chamada`) ganha `lembrete: LembreteDaVacinaDto | null` e `responsavelNoApp: boolean`.

`EditarAplicacaoDto` (`PATCH`): `{ observacao?: string | null, via?: Via, motivo: string }`. O motivo tem de 5 a 500 caracteres. Mande só os campos que mudaram. `observacao` vazia ou `null` apaga; `via: null` dá 400.

### Portal (`petjourney-admin`)

**Arquivos:** `src/service/parceiro/lembrete-de-vacina-service.ts`, `src/components/vacinas/VacinasDaClinica.vue` e a gaveta do lembrete. A spec do portal está em `docs/integracao-portal-parceiro/novembro/spec-lembrete-de-vacina.md` do próprio portal.

1. `LEMBRETE_NA_API = true`. O estado deixa de vir do navegador (`lembretesGuardados`) e vem da chamada: `cartao.lembrete` e `cartao.responsavelNoApp`. Apague o que está guardado no navegador.
2. Com `responsavelNoApp = false`: no lugar do botão, "Ligue para o telefone do cadastro" (o texto que a gaveta já tem), sem chamar o POST.
3. Ligar: `POST`; desligar: `DELETE`. Depois dos dois, **reler a chamada**.
4. Na gaveta e no cartão:
   - "Lembrete ativo";
   - a `entrega` do último envio: Na fila, Só na caixa de entrada, Enviado, Entregue, Não saiu;
   - com `FALHOU`, o motivo: `TETO_DO_DIA` "O responsável já recebeu 6 avisos de vacina desta clínica hoje.", `SEM_CANAL_NO_APP` "O responsável não está mais no app.", `SUPERADO` "A dose já foi registrada.";
   - `proximoEnvioEm` nulo: "Sem novo envio previsto".
5. **Rastro de avisos** (`GET /parceiro/portal/clinica/avisos`): filtro `tipo=VACINA_LEMBRETE_DA_CLINICA`. O item traz `aplicacaoId` e `paciente`, e a repetição vem com `automatico: true` e o `enviadoPorId` de quem ligou. Rótulo do tipo nos 6 locales: "Lembrete de vacina".
6. **"Editar registro"** (menu "..." do cartão):
   - gaveta com `observacao` (até 500; vazio apaga), `via` (as vias da vacina) e `motivo` (obrigatório, de 5 a 500);
   - `PATCH` só com os campos mudados e o motivo;
   - o responsável não é avisado da edição;
   - vacina, dose, data e lote continuam pelo "Apagar registro" (anular) e registrar de novo.

**Erros:**

| `codigo` | Status | O que a tela faz |
|---|---|---|
| `LEMBRETE_FORA_DA_CHAMADA` | 409 | traz `situacao` (`EM_DIA`, `ANULADA`, `NAO_VIGENTE`, `FORA_DA_LISTA`); mostrar a `message` e reler a lista |
| `SEM_CANAL_NO_APP` | 409 | mostrar "Ligue para o telefone do cadastro" |
| `SEM_PERMISSAO` | 403 | traz `permissao: "agenda.escrever"` (a ENFERMAGEM não tem); esconda o botão para quem não tem a permissão |
| `OWNERSHIP_FORBIDDEN` | 403 | aplicação de outra clínica ou inexistente; reler a lista |
| `VACINACAO_TAXA_EXCEDIDA` | 429 | mostrar a `message` |
| `APLICACAO_EDICAO_VAZIA` | 400 | (PATCH) nada mudou; desabilitar "Salvar" sem mudança evita |
| `APLICACAO_JA_ANULADA` | 409 | (PATCH) reler a ficha |
| `VIA_INVALIDA` | 409 | (PATCH) traz `viasPermitidas` |
| `APLICACAO_ALTERADA` | 409 | (PATCH) reler a ficha |

### App (`petjourney-app`)

- `services/notificacao/rotas-notificacao.ts`: o tipo `VACINA_LEMBRETE_DA_CLINICA` nos três mapas, igual ao `VACINA_REFORCO_PROXIMO`: rota `/screens/vacina/lista` (a `url` dos dados já vem com `?petId=`), `AFETA_HOME_POR_TIPO: false` e `PERFIL_POR_TIPO: "tutor"`.
- `app/screens/notifications.tsx`: ícone no `ICONES_POR_TIPO`, o mesmo `SyringeIcon` do `VACINA_REFORCO_PROXIMO`.
- A copy vem pronta da API nos 6 idiomas. `dados`: `{ parceiroId, avisoId, petId, petNome, aplicacaoId, proximaDoseEm, vencida, url }`, com `paraMembro: true` para a família. O app não monta texto.
- O app publicado já cai na `url` da API; o que falta é o `Record` completo (o `tsc` acusa) e o perfil certo.

### Pronto quando

- [ ] Portal: na lista de chamada, "Ativar lembrete" num pet com responsável no app mostra "Lembrete ativo" e a entrega; o push chega no app.
- [ ] Portal: pet sem responsável no app mostra "Ligue para o telefone do cadastro" sem chamar a rota.
- [ ] Portal: desligar some o "Lembrete ativo" depois de reler; ligar de novo não manda um segundo push no mesmo dia.
- [ ] Portal: com a ENFERMAGEM, o botão não aparece.
- [ ] Portal: "Editar registro" muda a observação; na ficha aparece a nova; sem mudança, "Salvar" fica desabilitado.
- [ ] App: o toque no push abre a carteirinha do pet certo, no perfil de responsável; `npx tsc --noEmit` limpo com o tipo nos três `Record`.
- [ ] Portal `type-check`, `test:unit` e `check:i18n` limpos.

---

## Por repo

- **Portal (`petjourney-admin`):**
  - [ ] `npm run contrato:gerar` depois do `fetch` da API (e de novo depois do N42).
  - [ ] Pedido 1: `PetAvatar.vue` com `@error`; `fotoUrl` em `PacientesLista.vue`, nos 10 seletores das gavetas, em `VacinasDaClinica.vue`, `GradeDoDia.vue`, `useLinhaDoDia.ts` (com o `split(/\s+/)` nas linhas ~135 e ~318), `FilaDeEspera.vue`, `LeitoDoMapa.vue` (com a espécie), `InternacaoDetalhe.vue` e `HospedesDoHotel.vue`.
  - [ ] Pedido 2: ligar, desligar com prévia e religar em `HomeModulos.vue` e `acesso-service.ts`; textos nos 6 locales.
  - [ ] Pedido 3: multi-seleção de categorias em `PortalParceiroCadastroForm.vue` e os 409 de CNPJ e CRMV.
  - [ ] Pedido 4: "Convidar para o app" (WhatsApp, QR, copiar, e-mail) na `LigarAoAppGaveta.vue`, o passo no fim do `NovoPacienteGaveta.vue`, "Reenviar" e o rótulo `PROPOSTA_LINK`.
  - [ ] Pedido 5: `LEMBRETE_NA_API = true`, o estado pela chamada, a entrega na gaveta, o rastro e "Editar registro" pelo `PATCH`.
- **App (`petjourney-app`):**
  - [ ] `npm run contrato:gerar` (e de novo depois do N42).
  - [ ] Pedido 4: `VINCULO_PROPOSTO` abre a proposta; prévia e cadastro no `clinica/vinculo/[token].tsx`; "Pedir outro convite" no 410; botões no erro do `proposta.tsx`; reset do `navegando` no `link-do-vinculo.ts`; aviso do pet repetido no CRIAR; "Recebi um convite" na boas-vindas; rótulo `PROPOSTA_LINK`; `clinica.codigo.explica` com 7 dias. Textos nos 6 idiomas.
  - [ ] Pedido 5: `VACINA_LEMBRETE_DA_CLINICA` nos três mapas de `rotas-notificacao.ts` e o ícone no inbox.
  - [ ] Pedido 3 (opcional): mostrar `categorias` no diretório.
- **Site (`petjourney-web`):**
  - [ ] Pedido 3: multi-seleção no `ParceiroSignupForm.tsx`, payload `categorias`.
  - [ ] Pedido 4: prévia do convite em `/clinica/vinculo/[token]` (do navegador, sem analytics) e o texto depois das lojas.
- **CMS (`petjourney-cms`):**
  - [ ] Pedido 2: selos, aviso no modal e "Histórico do parceiro" no `PartnerModulosPanel.tsx`; tipos à mão em `modulo-parceiro-admin.service.ts`.
  - [ ] Pedido 3: multi-seleção em `partners/create/page.tsx`; selos de `categorias` em `partners/page.tsx`, `partner-audits/page.tsx` e `partner-feedbacks/page.tsx`.
