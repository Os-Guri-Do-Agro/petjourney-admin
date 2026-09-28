# 09 · Módulo clínico — visão do responsável (protótipo no app)

**Para:** o agente que trabalha no `petjourney-app` (`D:\PROJETOS\petjourney-app`).
**De:** o `petjourney-admin` (`D:\PROJETOS\petjourney-admin`), onde o lado da clínica deste módulo
já existe como protótipo mocado.

O portal da clínica tem agenda, fila de espera, pré-consulta, prontuário, receita, vacinação,
internação com boletins e o resumo "Este pet em 30 segundos". Tudo isso tem um outro lado — o do
responsável pelo pet — que ainda não existe em lugar nenhum. Este documento pede esse outro lado,
**no app, como protótipo com dados imaginários**, falando desde já o contrato que a API vai
implementar.

A regra que manda em tudo: **o mock do app e o mock do portal falam o mesmo contrato e contam a
mesma história**. O dia da integração é trocar a fonte, não a forma.

Onde está escrito **Decisão**, é um padrão escolhido aqui para você não precisar perguntar. Dá
para mudar — mas a mudança começa no contrato do admin, não só no app.

---

## 0. Antes de começar

1. **Copie o contrato como está.** Fonte:
   `D:\PROJETOS\petjourney-admin\src\features\clinico\contrato\responsavel.ts` → destino
   `src/features/clinica/contrato.ts` no app, sem editar. Não há pacote compartilhado entre os
   repositórios: se o contrato precisar mudar, a mudança começa no admin e é recopiada. Quando
   divergir, avise — não conserte só de um lado.
2. **Copie os dados de demonstração.** Fonte:
   `D:\PROJETOS\petjourney-admin\docs\clinico\contrato\demo-responsavel.json` → destino
   `src/features/clinica/demo-responsavel.json`. É o dataset do portal projetado para a
   responsável da demonstração, exatamente como a API projetaria (seção 16). Para gerar de novo:
   `npm run contrato:demo` no admin.
3. **Nada disto existe na API ainda.** Nem rota, nem modelo, nem notificação. O protótipo é mock
   atrás de uma chave, no padrão de `src/features/influencer/` (seção 16).
4. **Não use o que já tem "clínica" no nome.** `services/clinica/clinica-service.ts` e
   `app/(tabs)/veterinaryClinics.tsx` são o diretório de clínicas do modelo `Clinica` legado
   (aba escondida com `href: null`), e `app/(tabs)/veterinario/*` é a persona de veterinário do
   app. Nada disso é este módulo; não reaproveite nem apague.
5. **O diário e o peso não mudam.** O app continua gravando `DiarioPet` e `PesoRegistro` como
   hoje. O que muda é o que a clínica pode ler deles (seção 7).
6. **Seis idiomas:** `pt`, `en`, `en-GB`, `es`, `sr` e `ar` (RTL). Seção 15.

### Onde cada coisa mora no app

| O quê                      | Onde                                                          |
| -------------------------- | ------------------------------------------------------------- |
| Contrato (cópia)           | `src/features/clinica/contrato.ts`                            |
| Dados de demonstração      | `src/features/clinica/demo-responsavel.json`                  |
| Chave de mock, mock, hooks | `src/features/clinica/{flags,mock,hooks}.ts`                  |
| Serviço (mock ↔ API)       | `services/clinica-responsavel/clinica-responsavel-service.ts` |
| Telas                      | `app/screens/clinica/*.tsx` (seção 3)                         |
| Textos                     | chave de topo `clinica` nos seis `src/locales/*.json`         |

**Decisão:** o serviço não mora em `services/clinica/` porque esse nome já é do legado (item 4).

---

## 1. Regras do contrato

### 1.1 Forma

| Assunto           | Regra                                                                          | De onde veio                             |
| ----------------- | ------------------------------------------------------------------------------ | ---------------------------------------- |
| Ids               | `cuid`, opacos                                                                 | Prisma                                   |
| Data e hora       | ISO 8601 **com offset da clínica** (`2026-09-25T10:00:00-04:00`)               | portal                                   |
| Data              | `YYYY-MM-DD`                                                                   | —                                        |
| Enum              | `MAIÚSCULAS_COM_SUBLINHADO`; os do diário são os do Prisma, literais           | `schema.prisma`                          |
| Lista             | `{ data: T[], meta: { proximoCursor } }`, `cursor` + `limit` (1–50, padrão 20) | `GET /parceiro/portal/compartilhamentos` |
| Erro              | corpo do `HttpExceptionFilter` + `codigo` estável (`CodigoDeErroClinico`)      | `http-exception.filter.ts`               |
| Opcional com teto | chave **omitida**, não `null` (`duracaoDias` do uso contínuo)                  | DTO da anotação                          |
| Prefixo           | `/tutor/clinica/...` (todas em `ROTAS_DO_RESPONSAVEL`)                         | persona `tutor/` da API                  |

O `message` do erro chega traduzido pelo `Accept-Language`. O app decide a tela pelo `codigo`,
nunca pelo texto.

### 1.2 O servidor calcula as regras; o app obedece

`podeCancelar`, `podeRemarcar`, `podeConfirmar`, `cancelarAte`, `posicao` na fila, `expiraEm` da
oferta e a situação da pré-consulta vêm **prontos**. O app não recalcula prazo: um relógio só. Se
o botão aparece e a API recusa, o erro é do contrato, não da tela. No protótipo, quem calcula é o
mock, fazendo o papel do servidor (seção 16).

Os `pode*` já consideram quem está olhando: membro da família com acesso de leitura recebe tudo
com os `pode*` em `false` (seção 13).

### 1.3 Horário é o da clínica

Todo horário vem no offset da clínica (`ClinicaDoResponsavel.utcOffset`). Mostre o horário da
clínica, lido da própria string, sem converter. Se o fuso do aparelho for outro, diga "horário da
clínica" na tela em vez de converter em silêncio — a consulta acontece lá.

### 1.4 Quem escreve cada texto

| Texto                                                                                                           | Quem escreve                          | O app                                           |
| --------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ----------------------------------------------- |
| Rótulo de enum, estado, botão                                                                                   | o app (i18n)                          | traduz nos seis idiomas                         |
| Título e corpo da notificação                                                                                   | **o backend** (`NOTIFICACAO_CATALOG`) | mostra como chega (seção 12)                    |
| Orientação, boletim, instrução da receita, `mensagemDaClinica`, `motivo` da internação, `observacao` da clínica | uma pessoa da clínica                 | mostra na íntegra, com o `idioma` que vem junto |
| Nome de serviço, de medicamento, título de documento                                                            | a clínica (cadastro)                  | mostra como vem                                 |

Texto da clínica **não se traduz por máquina**: um boletim de internação traduzido
automaticamente é pior do que um em português. Quando o `idioma` do texto não for o do app, mostre
uma linha discreta ("Mensagem da clínica, em português").

`ProfissionalResumo.especialidade` segue a regra da `Consulta.veterinarioEspecialidade` da API:
vem a **chave** quando é uma da lista do app (`consultaForm.especialidades`: `CLINICO_GERAL`,
`DERMATOLOGIA`...) e o texto livre quando não é ("Anestesiologia"). Traduza a chave; texto livre
aparece como veio.

### 1.5 Vocabulário

Na tela, em português, é **responsável**, nunca "tutor" (o campo continua `tutorId`). Nas outras
línguas, o que o app já usa. E nada de adjetivo com gênero sobre o pet em texto do app
("internado/internada"): use o nome do pet ou um substantivo ("Em internação").

---

## 2. Onde o módulo encosta no que o app já tem

O responsável já registra consulta, vacina, remédio, documento e peso no app. O que a clínica
fizer tem de **entrar nesses mesmos lugares**, não criar uma segunda versão deles. Esta tabela é o
que a API vai fazer; o mock só precisa respeitar as consequências na tela.

| Vem da clínica                          | Vira, no que já existe                                                                                                                                                               | Regra                                                                                                                                                                                                                                                                               |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Resumo do atendimento, ao ser liberado  | uma `Consulta` (`tipo`, `clinicaNome`, `veterinarioNome`, `veterinarioEspecialidade`, `motivo`, `diagnostico`, `pesoNaConsulta`) com um `ConsultaPrescricaoItem` por item da receita | **Uma consulta, não duas.** É a API que cria, ao liberar — o app nunca cria `Consulta` a partir do resumo. A lista de consultas e a linha do tempo mostram essa `Consulta`; `ResumoDoAtendimento.consultaId` liga as duas, e o detalhe da consulta ganha "Ver o resumo da clínica". |
| Peso aferido na consulta                | um `PesoRegistro` (`observacoes` = nome da clínica)                                                                                                                                  | O mesmo que o import do prestador faz: mesma data e mesmo valor não duplicam o ponto no gráfico.                                                                                                                                                                                    |
| "Criar lembretes" de um item da receita | `LembreteSerie` tipo `MEDICAMENTO`, recorrente, ligada ao item (`ConsultaPrescricaoItem.lembreteSerieId`)                                                                            | Frequência: `frequenciaHoras` 24 → `DIARIO`; os outros de 1 a 72 → `INTERVALO_HORAS` com `intervaloHoras`; 168 → `SEMANAL`; 336 → `QUINZENAL`; 720 → `MENSAL`; o resto a API recusa. `repetirAte` = primeira dose + `duracaoDias`. Nunca sem a pessoa pedir.                        |
| O mesmo, em item de **uso contínuo**    | além da série, um `TratamentoFixo` ativo (`ConsultaPrescricaoItem.tratamentoFixoId`), série com origem `TRATAMENTO_FIXO`                                                             | Sem `repetirAte`. É como o app já registra remédio contínuo.                                                                                                                                                                                                                        |
| "Salvar nos documentos"                 | um `Documents` do pet, com `dataEmissao` = `emitidoEm`                                                                                                                               | Só com o toque da pessoa. `tipo`: `RECEITUARIO` → `'Receita Médica'`; `COMPROVANTE_VACINACAO` → `'Carteira de Vacinação'`; o resto → `'Outro'`. Sem `dataEmissao` o documento some da linha do tempo. Salvar de novo devolve o mesmo (`jaExistia`).                                 |
| Vacina aplicada                         | uma `Vacina` na carteira (`vacinaDaCarteiraId`) e a próxima dose como `LembreteSerie` `VACINA`                                                                                       | **Não duplicar:** se havia lembrete pendente de vacina com o mesmo nome, a aplicação da clínica o fecha. A carteira mostra uma linha, enriquecida com lote e dose (seção 9).                                                                                                        |
| Agendamento                             | **nada** — não cria `LembreteSerie` `CONSULTA`                                                                                                                                       | O agendamento tem os avisos dele (véspera, pré-consulta). Um lembrete a mais seria o mesmo aviso duas vezes.                                                                                                                                                                        |
| Internação na clínica                   | **nada** — `InternacaoNaClinica` não é a `Internacao` do app                                                                                                                         | A `Internacao` do app é o registro que o próprio responsável escreve, pendurado numa `LembreteSerie` `INTERNACAO`. A da clínica tem tela própria (seção 10). **Decisão:** não entra na linha do tempo neste protótipo.                                                              |
| Diário e peso de casa                   | continuam os mesmos; a clínica lê com consentimento                                                                                                                                  | Convive com o compartilhamento temporário com prestador: são duas permissões independentes, e revogar uma não mexe na outra (seção 7).                                                                                                                                              |

A linha do tempo já é montada de `Consulta`, `Vacina`, `Medicamento`, `PesoRegistro` e `Documents`
(este, só com `dataEmissao`): o que a clínica fizer entra nela por essas portas, sem tipo novo de
evento.

---

## 3. As telas

A navegação é do app; o que importa é que cada tela exista, com a rota abaixo (as notificações
abrem estas rotas — seção 12), e alcance as outras.

| #   | Tela                                                                  | Rota                            | Lê                                          | Escreve                                   |
| --- | --------------------------------------------------------------------- | ------------------------------- | ------------------------------------------- | ----------------------------------------- |
| 1   | **Clínica do pet** — próximo horário, pendências, internação ativa    | `/screens/clinica/inicio`       | agendamentos, fila, internações             | —                                         |
| 2   | **Agendar** — clínica → serviço → profissional → dia/hora → revisar   | `/screens/clinica/agendar`      | clínicas, serviços, profissionais, horários | reserva, agendamento                      |
| 3   | **Agendamento** — detalhe, confirmar, cancelar, remarcar, falta       | `/screens/clinica/agendamento`  | agendamento                                 | confirmar, cancelar, remarcar, justificar |
| 4   | **Pré-consulta** — formulário que abre preenchido pelo diário         | `/screens/clinica/pre-consulta` | pré-consulta                                | resposta, fotos                           |
| 5   | **Lista de espera** — entrar, posição, oferta com contador            | `/screens/clinica/fila`         | fila                                        | entrar, sair, aceitar, recusar            |
| 6   | **Depois da consulta** — resumo, receita, exames, retorno, documentos | `/screens/clinica/atendimento`  | atendimento                                 | lembretes, salvar documento               |
| 7   | **Carteira de vacina** — a que já existe, com o que veio da clínica   | `/screens/vacina/lista`         | vacinas                                     | —                                         |
| 8   | **Internação** — conversa de boletins, preferências                   | `/screens/clinica/internacao`   | internação, boletins                        | preferências                              |
| 9   | **Minhas clínicas** — contato e o que cada clínica pode ver           | `/screens/clinica/clinicas`     | clínicas                                    | consentimento                             |

Todas recebem `petId` na query; as de um item recebem também `id`. A falta não é tela: é o estado
`FALTA` da tela 3.

**Decisão — onde se entra:** pela área do pet (o painel de prontuário, `medical-record-dashboard`),
num item "Clínica", e por um cartão na Home **só** quando há pendência com prazo: oferta de vaga
aberta (com o contador), pré-consulta aberta, presença a confirmar, internação em andamento.

### Estados vazios

Nenhuma tela do módulo mostra lista vazia sem dizer o que fazer. Use o `components/EmptyState.tsx`
que o app já tem.

| Tela / situação                        | Mostra                                                                                                                                         |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Nenhuma clínica acompanha o pet        | "Quando uma clínica parceira do PetJourney atender {pet}, ela aparece aqui." Sem botão de agendar.                                             |
| Clínica sem `aceitaAgendamentoPeloApp` | o telefone, com "Esta clínica agenda por telefone".                                                                                            |
| Nenhum horário marcado                 | "Nenhum horário marcado" + Agendar.                                                                                                            |
| Busca de horários sem resultado        | "Sem horário livre nesses dias" + **Entrar na lista de espera** com serviço e profissional já escolhidos.                                      |
| Fila vazia                             | o que é a lista de espera, em uma frase, + Entrar na lista de espera.                                                                          |
| Pré-consulta `AINDA_NAO_ABRIU`         | "Abre em {abreEm}". Nunca um formulário travado.                                                                                               |
| Nenhum atendimento liberado            | "O resumo de cada consulta aparece aqui quando a clínica libera."                                                                              |
| Carteira sem nada da clínica           | a carteira de hoje, sem aviso nenhum.                                                                                                          |
| Internação encerrada                   | "Internação encerrada" + telefone da clínica (seção 10).                                                                                       |
| Pet sem diário (plano sem diário)      | na pré-consulta, formulário vazio e sem "do seu diário"; em Minhas clínicas, o consentimento do diário explica que não há diário para liberar. |

---

## 4. Agendar pelo app

**Hoje:** não existe. O portal mostra `origem: 'APP'` e ninguém produz esse valor.

### Fluxo

1. `GET /tutor/clinica/clinicas` → as clínicas que já atendem algum pet da pessoa. Só as com
   `aceitaAgendamentoPeloApp` mostram Agendar; as outras, o telefone.
2. `GET .../servicos?petId=` → o serviço diz a duração e se tem pré-consulta. Mostre o `nome` que
   a clínica deu ("Exame de imagem"), não um rótulo do enum.
3. `GET .../profissionais?servicoId=` → "qualquer profissional" é a ausência de `profissionalId`
   na busca.
4. `GET .../horarios` com `de`/`ate` (até `LIMITES_CLINICOS.horizonteDeHorariosDias`, 60) → só
   horários livres. Sala, bloqueio e encaixe são da clínica e não aparecem.
5. Escolhido o horário: `POST /tutor/clinica/reservas` → `Reserva` com `expiraEm`
   (`politica.reservaMinutos`, hoje 5). O horário fica segurado enquanto a pessoa revisa.
6. `POST /tutor/clinica/agendamentos { reservaId, observacao? }` → `Agendamento` com
   `status: AGENDADO`, `origem: APP`. Sem aprovação da clínica: horário livre é horário marcado.
7. Voltar ou desistir na revisão: `DELETE /tutor/clinica/reservas/:id`. Deixar a reserva morrer
   sozinha funciona, mas prende o horário por 5 minutos à toa.

### Estados e ações

| status           | O responsável vê                 | Pode                                       |
| ---------------- | -------------------------------- | ------------------------------------------ |
| `AGENDADO`       | Marcado                          | confirmar (véspera), cancelar, remarcar    |
| `CONFIRMADO`     | Confirmado                       | cancelar, remarcar (dentro do prazo)       |
| `AGUARDANDO`     | Na recepção                      | —                                          |
| `EM_ATENDIMENTO` | Em atendimento                   | —                                          |
| `FINALIZADO`     | Atendido                         | ver o resumo quando `atendimentoId` chegar |
| `FALTA`          | Não compareceu                   | justificar, remarcar (seção 11)            |
| `CANCELADO`      | Cancelado (por quem, e o motivo) | agendar de novo                            |

- **Prazo:** `cancelarAte = inicio − politica.cancelarAteHorasAntes`. Depois dele, `podeCancelar`
  e `podeRemarcar` viram `false` e a tela troca os botões por "Ligar para a clínica". A API
  responde `409 FORA_DO_PRAZO_DE_CANCELAMENTO` se alguém tentar. Mostre o prazo antes de ele
  vencer: "Dá para cancelar ou remarcar pelo app até 08:00".
- **Remarcar** = nova reserva + `POST .../remarcar { reservaId }`. O agendamento mantém o id.
- **Confirmar presença** abre 48 h antes do horário e vale enquanto `podeConfirmar`. O convite é
  a notificação `AGENDAMENTO_LEMBRETE_VESPERA`, às 18 h da véspera. Do lado da clínica, a agenda
  mostra "Confirmado pelo app" com a hora.

### Casos difíceis

- **A reserva vence na revisão.** Contador em zero: volte para os horários com serviço,
  profissional e dia preservados, e diga que o horário foi liberado. Não recrie a reserva
  sozinho — o horário pode ter ido para outra pessoa (`409 HORARIO_INDISPONIVEL`).
- **Dois toques em "Confirmar".** A segunda chamada com a mesma reserva devolve o mesmo
  agendamento, não um segundo. No mock, reserva consumida vira agendamento uma vez só.
- **Pet que a clínica nunca viu.** Agendar é o que cria o vínculo desse pet com a clínica (um
  modelo novo; o `ClinicasPacientes` é legado). Do lado da clínica ele chega como paciente novo —
  é o caso "Paçoca" do resumo em 30 segundos.

---

## 5. Lista de espera e oferta de vaga

**Hoje:** a clínica coloca o responsável na fila pelo telefone e registra o aceite à mão.

### Fluxo

- **Entrar:** `POST /tutor/clinica/fila` com serviço, profissional opcional e **janelas** (dia da
  semana + faixa de hora em que dá para ir). Sem janela não há como oferecer vaga: exija pelo
  menos uma (máximo `LIMITES_CLINICOS.janelasNaFila`).
- **Posição:** `posicao` (1 = próximo), só em `AGUARDANDO`. A prioridade que a clínica dá a cada
  entrada **não viaja** — é triagem dela. Mostre "Você é o 3º da fila", nunca a ordem dos outros.
- **Oferta:** quando abre vaga **dentro das janelas**, a entrada vira `OFERTADO` com
  `oferta { inicio, fim, profissional, expiraEm }` e chega `FILA_VAGA_OFERECIDA`.
  - Contador até `expiraEm`. O prazo é do servidor (`politica.ofertaDeVagaMinutos`, hoje 30).
    **Nunca** fixe 15 ou 30 no app.
  - `POST .../oferta/aceitar` → devolve o `Agendamento` criado (`origem: FILA`, já
    `CONFIRMADO`), e a entrada vira `ACEITO` com `agendamentoId`.
  - `POST .../oferta/recusar` → volta para `AGUARDANDO` na mesma posição de antes.

### Casos difíceis

- **A oferta vence com a tela aberta.** Contador em zero: o botão vira "A vaga voltou para a
  clínica" e a entrada volta a mostrar a posição. Aceitar depois disso dá `410 OFERTA_EXPIRADA`.
- **A vaga foi preenchida por outro canal.** A vaga oferecida **não fica segurada**: aceitar
  dentro do prazo ainda pode dar `409 VAGA_JA_PREENCHIDA` (a recepção encaixou alguém no balcão).
  Mensagem honesta, entrada de volta à fila, sem culpa para ninguém.
- **Notificação velha.** A pessoa abre o push uma hora depois. A tela lê o estado atual da
  entrada, nunca o `dados` da notificação.

---

## 6. Pré-consulta

**Hoje:** não existe no app. O portal tem um painel que mostra a pré-consulta ao vet como
**sugestão**: ele aplica o que quiser na anamnese (só em campo vazio), e o peso de casa nunca vira
peso aferido. Cada valor que veio do diário aparece marcado "do diário" para o vet.

### Fluxo

- Abre `politica.preConsultaAbreHorasAntes` antes do horário (hoje 72 h) e **fecha no início da
  consulta**. Situação: `AINDA_NAO_ABRIU → ABERTA → RESPONDIDA → FECHADA`. Dá para editar
  enquanto não fechar (`PUT` de novo).
- `GET .../pre-consulta` traz `sugestao`, montada do **diário dos últimos 3 dias** (o valor mais
  recente de cada campo, os sintomas do período) e do último `PesoRegistro`. O formulário abre
  preenchido, e cada campo que veio do diário diz isso ("do seu diário, ontem"). Ao enviar,
  `camposDoDiario` lista os que a pessoa não mexeu — do lado da clínica, a procedência aparece.
- **Fotos:** `POST /tutor/clinica/agendamentos/:id/pre-consulta/fotos`, multipart com o campo
  `file`, uma foto por chamada → `{ fotoId }`; os ids vão em `fotoIds`. As mesmas regras da foto
  do diário: `image/jpeg`, `image/png`, `image/webp` ou `image/heic`, até 8 MB, no máximo 3 por
  pré-consulta (`LIMITES_CLINICOS`). Fora disso, `400 FOTO_INVALIDA`. Valide antes de enviar;
  reaproveite o fluxo de câmera/galeria do diário.
- Notificação `PRE_CONSULTA_PENDENTE` 24 h antes do horário, só se ainda não foi respondida.

### Campos (`RespostaDaPreConsulta`)

| Campo                       | Tipo               | Observação                            |
| --------------------------- | ------------------ | ------------------------------------- |
| `motivo`                    | `MotivoVisita`     | o mesmo enum do compartilhamento      |
| `queixaPrincipal`           | texto ≤ 1000       | "O que está acontecendo?"             |
| `sintomas`                  | `SintomaPet[]` ≤ 5 | o mesmo limite do `sintomasQueixa`    |
| `desdeQuando`               | `DuracaoDaQueixa`  | **novo** — não existe no app          |
| `evolucao`                  | `EvolucaoDaQueixa` | **novo** — trajetória, não vitalidade |
| `alimentacao`, `hidratacao` | `ConsumoDiario`    | do diário                             |
| `fezes`                     | `AspectoFezes`     | do diário                             |
| `urina`                     | `EstadoUrina`      | do diário                             |
| `vitalidade`                | `VitalidadePet`    | do diário                             |
| `pesoKg` + `pesadoEm`       | 0,01–500           | balança de casa                       |
| `observacao`                | texto ≤ 2000       | na íntegra para o vet                 |
| `fotoIds`                   | ≤ 3                | endpoint acima                        |
| `camposDoDiario`            | lista              | os que vieram da sugestão sem mudança |

Formulário curto: só `motivo` e `queixaPrincipal` são obrigatórios. O resto é "se souber".

---

## 7. O diário que a clínica lê ("Este pet em 30 segundos")

**Do lado da clínica** existe uma tela que o vet lê antes de entrar na sala: sinais que chamam
atenção (perda de peso contínua, sintoma de alarme), o que o responsável registrou desde a última
consulta, a tendência de peso, e um botão que abre o atendimento com isso na anamnese.

O compartilhamento temporário de hoje **não alimenta essa tela**: manda só 15 registros, dos
últimos 30 dias, só os que têm sintoma ou doença, e com o rótulo no lugar do enum. O caso "um
desmaio no meio de noventa registros normais" nem chegaria à clínica.

**O que o app faz (tela 9, Minhas clínicas):**

- Um consentimento por clínica, com três chaves independentes:
  `PUT .../clinicas/:clinicaId/consentimento { diarioCompleto?, peso?, notas? }`.
  - `diarioCompleto`: "A clínica vê o diário do {pet} desde a última consulta, para chegar à
    próxima sabendo o que aconteceu em casa."
  - `peso`: as pesagens de casa.
  - `notas`: a nota pessoal do diário — separada de propósito, desligada por padrão, como o
    `incluirNotasDiario` do compartilhamento temporário.
  - Desligar corta o acesso na hora. Mostre `atualizadoEm` ("Liberado em 11/08").
- **Só o dono do pet muda o consentimento** (`podeAlterarConsentimento`). Membro da família vê o
  que está liberado, com as chaves desabilitadas e o motivo dito.
- Convive com o compartilhamento temporário com prestador, sem se misturar: são permissões
  diferentes, para destinatários diferentes.
- **Nada muda na escrita do diário.** Continua `DiarioPet` e `PesoRegistro`, com os enums de hoje.

Do lado da clínica, o pet cujo responsável não liberou aparece com "O responsável não liberou o
diário para a clínica" — sem parecer quebrado. O endpoint de leitura é do portal
(`GET /parceiro/portal/pacientes/:petId/diario`) e está no contrato só para os dois lados
concordarem sobre os campos (`EntradaDoDiarioParaClinica`).

---

## 8. Depois da consulta

A clínica finaliza o atendimento e, num passo separado, **libera o resumo** para o responsável
(o vet pode querer revisar a orientação antes de ela chegar num celular). Liberado,
`Agendamento.atendimentoId` aparece e chega `ATENDIMENTO_RESUMO_DISPONIVEL`.
`GET /tutor/clinica/atendimentos/:id` → `ResumoDoAtendimento`.

**Escrito para quem não é da área.** Sem mg/kg, sem código de diagnóstico, sem exame físico,
sem diagnóstico diferencial (o presuntivo chega como "… (em investigação)"). A ordem da tela: o
que o vet encontrou (`diagnostico`), o que fazer em casa (`orientacoes` + receita), quando voltar
(`retorno`), e quando voltar **antes** (`sinaisDeAlerta`).

`diagnostico` pode vir **vazio**: quando o vet só registrou hipóteses a descartar, nenhuma delas
chega ao responsável. A tela diz "Sem diagnóstico fechado nesta consulta" e segue para as
orientações — não some com a seção nem mostra um título sem nada embaixo.

### Receita

- Cada item: medicamento, **quanto** (`quantidade` + `unidade` + `fracao`), a cada quantas horas,
  por quantos dias, via, instruções da clínica.
  - Monte a frase no app, traduzida: "meio comprimido, uma vez por dia, por 14 dias". A fração
    `MEIO` se lê "meio comprimido", nunca "0,5". Líquido vem em mL, sem fração ("0,12 mL").
  - **Sem `duracaoDias` = uso contínuo.** "Uso contínuo, sem data para parar." Nunca trate como
    365 dias: num anti-hipertensivo, o lembrete parar sozinho é o efeito adverso.
- **Código verificador** `XXXX-XXXX-XXXX-XXXX` em destaque, copiável — é o que a farmácia confere.
  Validade (`validaAte`); receita vencida aparece como vencida, não some. Controle especial
  avisa que a farmácia retém uma via.
- **"Criar lembretes"**: a pessoa escolhe os itens e a hora da primeira dose de cada um;
  `POST .../receita/lembretes { itens: [{ itemId, primeiraDoseEm }] }` →
  `LembreteCriadoDaReceita[]`. Vira `LembreteSerie` + `TratamentoFixo` no uso contínuo (seção 2).
  As doses seguintes saem da frequência. Não crie lembrete sem ela pedir. Item com lembrete já
  criado mostra "Lembrete ativo" e leva a ele.

### Exames, retorno, documentos

- **Exames:** nome e se pede jejum — é a pergunta que todo mundo faz ao balcão.
- **Retorno:** "Retorno em 15 dias (até 10/10)". Botão que abre o fluxo de agendar com serviço e
  profissional já escolhidos. Marcado, `agendamentoId` aparece e o botão vira o horário. Vencido
  sem marcar: `RETORNO_PENDENTE`.
- **Documentos:** lista com título e data. Abrir usa `url`; quando `urlExpiraEm` passar, peça
  outra em `GET /tutor/clinica/documentos/:id/url`. "Salvar nos documentos"
  (`POST .../salvar-nos-documentos`) copia para os documentos do pet (seção 2) e o botão vira
  "Salvo nos documentos". Termo com `exigeAssinaturaDoResponsavel` e sem assinatura aparece como
  pendente — **assinar no app está fora deste protótipo**; mostre só o estado.

---

## 9. Vacinas aplicadas na clínica

**Hoje:** a `Vacina` do app guarda nome e data. Lote, fabricante, validade e dose da série são
da clínica.

- `GET /tutor/clinica/vacinas?petId=` → `VacinaAplicadaNaClinica[]`, com lote, validade do lote,
  "dose 2 de 3", próxima dose e `situacao`.
- **Uma linha por aplicação na carteira.** A carteira (`/screens/vacina/lista`) continua a do
  app; a linha cujo id é o `vacinaDaCarteiraId` de uma aplicação da clínica ganha os detalhes
  dela e a marca "Aplicada na {clínica}". Se havia lembrete pendente daquela vacina, a aplicação
  o fechou — não mostre os dois.
- **Reforço:** `EM_DIA`, `PROXIMO` (≤ 30 dias), `VENCIDO`, `SERIE_INCOMPLETA`. Vencido pede ação
  hoje; próximo entra na lista da semana — não são o mesmo aviso. `VACINA_REFORCO_PROXIMO` é
  novo; vencido continua com o `VACINA_ATRASADA` que já existe. "Agendar" abre o fluxo com o
  serviço de vacina.

---

## 10. Internação

A tela mais delicada do módulo. O responsável acompanha o pet internado **sem precisar ligar**, e
a clínica tem uma regra que o app precisa respeitar sem nem saber que ela existe.

### A regra

**Boletim de piora não sai por aplicativo antes de alguém da clínica ligar para o responsável.**
Do lado da clínica ele fica retido até a ligação. Por isso:

- O app **nunca** mostra "boletim aguardando" ou contagem de retidos. O contrato nem tem esse
  campo. Mostrar isso contaria a notícia antes da ligação.
- O boletim que sai depois da ligação vem com `aposLigacao: true`: o app mostra como registro da
  conversa que a pessoa já teve ("Enviado depois de a clínica falar com você"), não como a forma
  pela qual ela ficou sabendo.
- O push do boletim **nunca adianta o conteúdo** ("Notícias de Pipoca · Novo boletim"): ele
  aparece na tela bloqueada, para quem estiver perto do celular.

### Fluxo

- Internação em andamento aparece no topo da tela 1, no perfil do pet e num cartão da Home.
- `GET .../boletins` → conversa, mais recente embaixo, agrupada por dia. Texto na íntegra, foto
  quando houver, horário. Não é chat: o responsável não responde por aqui — há o telefone.
- **Preferências:** `PUT .../preferencias` — frequência (1, 2, 4, 6, 8, 12 ou 24 h), foto sempre
  que possível, silêncio das 22 h às 7 h. Mostre o custo da escolha em mensagens por dia. Diga
  que piora nunca espera o silêncio, e que a madrugada **junta** num boletim só às 7 h (não some).
- **Previsão de alta:** sempre como estimativa ("previsão, pode mudar"), ou "sem previsão ainda".

### Como termina

| status        | Chega pelo app                           | O app mostra                              |
| ------------- | ---------------------------------------- | ----------------------------------------- |
| `ALTA`        | boletim `tipo: ALTA` + `INTERNACAO_ALTA` | a mensagem de alta, com as orientações    |
| `TRANSFERIDO` | **nada**                                 | internação encerrada, telefone da clínica |
| `OBITO`       | **nada**                                 | internação encerrada, telefone da clínica |

**Óbito nunca chega por notificação.** A clínica liga antes; o registro só existe depois. O app
não dispara push, não mostra banner, e não troca a internação para "óbito" com ícone ou cor —
mostra "Internação encerrada" e o contato. E depois de um óbito, nenhum lembrete, oferta ou
pré-consulta desta clínica para esse pet.

---

## 11. Falta

- A clínica marca a falta; chega `AGENDAMENTO_FALTA`. O agendamento vem com
  `falta: { motivo: null, canal: null }` enquanto ninguém justificou — é esse `null` que faz a
  tela pedir a justificativa.
- O responsável **justifica pelo app**: `POST .../justificar-falta { motivo, observacao? }`, e a
  clínica passa a ver `canal: APP` no painel de faltas, sem precisar ligar. Motivos na voz de
  quem responde (seção 15).
- **Óbito entre os motivos** ("{pet} faleceu"): opção discreta, no fim da lista. Escolhida, a
  tela muda de tom — sem botão de remarcar, uma frase de condolência, e o app para qualquer
  lembrete desta clínica para o pet.
- Depois de justificar (menos óbito), o botão é "Remarcar", que abre o fluxo de agendar com tudo
  preenchido.

---

## 12. Notificações

Doze tipos novos em `TipoNotificacao`, categoria `CLINICO`, com o `dados` tipado em
`DadosDaNotificacaoClinica`.

| Tipo                                 | Quando                                    | Abre                            |
| ------------------------------------ | ----------------------------------------- | ------------------------------- |
| `AGENDAMENTO_CRIADO_PELA_CLINICA`    | a recepção marcou pelo telefone           | `/screens/clinica/agendamento`  |
| `AGENDAMENTO_LEMBRETE_VESPERA`       | 18 h da véspera, pede confirmação         | `/screens/clinica/agendamento`  |
| `AGENDAMENTO_REMARCADO`              | a clínica mudou dia, hora ou profissional | `/screens/clinica/agendamento`  |
| `AGENDAMENTO_CANCELADO_PELA_CLINICA` | a clínica cancelou                        | `/screens/clinica/agendamento`  |
| `AGENDAMENTO_FALTA`                  | a clínica marcou falta                    | `/screens/clinica/agendamento`  |
| `PRE_CONSULTA_PENDENTE`              | 24 h antes, sem resposta                  | `/screens/clinica/pre-consulta` |
| `FILA_VAGA_OFERECIDA`                | abriu vaga nas janelas                    | `/screens/clinica/fila`         |
| `ATENDIMENTO_RESUMO_DISPONIVEL`      | a clínica liberou o resumo                | `/screens/clinica/atendimento`  |
| `RETORNO_PENDENTE`                   | o retorno venceu sem horário              | `/screens/clinica/atendimento`  |
| `VACINA_REFORCO_PROXIMO`             | o reforço entrou nos 30 dias              | `/screens/vacina/lista`         |
| `INTERNACAO_BOLETIM`                 | boletim enviado                           | `/screens/clinica/internacao`   |
| `INTERNACAO_ALTA`                    | alta                                      | `/screens/clinica/internacao`   |

- **A rota está no contrato** (`ROTAS_DAS_NOTIFICACOES_CLINICAS`), e a `url` de `dados` sai de
  `urlDaNotificacaoClinica(tipo, petId, id)`: `/screens/clinica/fila?petId=…&id=…`. É o mesmo
  padrão do `rotaComPet` da API — sem o `petId`, a tela por pet cairia no último pet ativo do
  aparelho. As telas de `/screens/clinica/` precisam existir com esses nomes: rota inexistente
  cai em "Unmatched Route".
- **Título e corpo vêm prontos do backend** (`NOTIFICACAO_CATALOG`, no idioma do aparelho, hoje
  em pt-BR, en-US, en-GB e es-419; `sr` e `ar` recebem português). O app mostra `titulo` e
  `corpo` como chegam — na caixa de entrada e no push. O texto em português de cada tipo está no
  contrato (`TEXTOS_PT_DAS_NOTIFICACOES`): é o que o backend vai pôr no catálogo e o que o mock
  usa. Regras dele: sem preposição antes do nome da clínica; boletim nunca adianta conteúdo;
  horário é o da clínica.
- A `mensagemDaClinica`, quando houver, vai **dentro** da tela, citada — não no push.
- A tela aberta pelo push lê o estado atual, nunca o `dados` (a oferta pode ter expirado, o
  horário pode ter mudado de novo).
- Membro da família recebe também, com `paraMembro: true` (seção 13).

### O que mudar no app para os doze tipos

Os registros por tipo são `Record` fechados: tipo novo sem entrada quebra o `tsc`, então **os doze
entram na mesma leva**.

- `services/notificacao/rotas-notificacao.ts`: `TipoNotificacao`, `ROTA_POR_TIPO` (copie de
  `ROTAS_DAS_NOTIFICACOES_CLINICAS`), `AFETA_HOME_POR_TIPO` (**Decisão:** `true` para os que
  criam ou tiram cartão da Home — oferta, pré-consulta, véspera, remarcado, cancelado, boletim,
  alta; `false` para os demais) e `PERFIL_POR_TIPO` (perfil de responsável).
- `app/screens/notifications.tsx`: `ICONES_POR_TIPO`.
- `hooks/usePushNotifications.ts`: no push recebido, quando o tipo é clínico, invalidar também
  `['clinica']` (seção 14).

---

## 13. Família e plano

**Família.** O módulo segue o que o app já faz com lembretes:

- Notificação clínica vai ao dono do pet e aos membros com acesso ao pet de `LEITURA` ou mais,
  marcada `paraMembro: true` para estes — como o `LEMBRETE_VENCIDO`.
- Membro com `LEITURA` vê tudo do módulo, com os `pode*` em `false`; se tentar agir, a API
  responde `403 SOMENTE_LEITURA`. A tela explica ("Só quem tem acesso de edição pode…") em vez
  de esconder o botão sem dizer por quê.
- Membro com `LEITURA_ESCRITA` age como o dono, **exceto** no consentimento do diário, que é só
  do dono (`podeAlterarConsentimento`).

**Plano. Decisão:** o módulo clínico **não depende de plano** — o responsável não fica sem ver a
receita ou o boletim do próprio pet por causa do plano. O único gate do app continua o do
diário (`REQUIRED_NIVEL_DIARIO_PET = 3`, em `src/features/diario-pet/gating.ts`): sem diário, a
sugestão da pré-consulta vem `null` e o consentimento do diário não tem o que liberar. Pet
desativado por queda de plano responde `PET_INATIVO` ou `SELECAO_PETS_PENDENTE` nas escritas,
como no resto do app.

---

## 14. Cache e atualização

O `QueryClient` do app (`app/_layout.tsx`) tem `staleTime` de 30 s e `refetchOnWindowFocus:
false`, sem `focusManager`. E o push recebido hoje só invalida as notificações e marca a Home.
Para o módulo clínico, onde um prazo muda a tela, isso não basta:

- **Chaves** sob `['clinica', …]` (`['clinica', 'agendamentos', petId]`,
  `['clinica', 'fila']`, `['clinica', 'internacao', id, 'boletins']`…).
- **Push clínico recebido** → invalida `['clinica']` inteiro, além do que já acontece.
- **Foco de tela** → `useFocusEffect` refaz a consulta da tela ao voltar para ela.
- **Contador que zera** (reserva, oferta) → refaz a consulta daquele item na hora.
- **Dia da consulta**, com a tela do agendamento aberta → a cada 60 s (o status anda: na
  recepção, em atendimento, atendido).
- **Internação**, com a conversa aberta → a cada 2 min, além do push.
- **Depois de uma escrita** → atualize a resposta no cache (a API devolve o objeto novo) e
  invalide as listas que o contêm.

---

## 15. Textos: i18n e rótulos em português

- Chave de topo **`clinica`** nos seis arquivos de `src/locales/`, com folhas de enum em
  MAIÚSCULAS (`clinica.agendamento.status.AGENDADO`), como o resto do app.
- **Reaproveite** o que já existe: `diarioPet.enum.<campo>.<VALOR>` para alimentação,
  hidratação, fezes, urina, vitalidade, sintomas e doenças; `compartilhamentoPrestador.motivos`
  para `MotivoVisita`; `consultaForm.especialidades` para a especialidade.
- Erros que mudam a tela têm texto próprio em `clinica.erro.<CODIGO>`; os outros mostram o
  `message` da API.
- Dia da semana e data com `Intl` no idioma do app; horário lido da string (seção 1.3).

### Rótulos em português

O tom é de quem cuida do pet, não de quem opera a agenda. Os outros cinco idiomas seguem o
sentido, não a letra.

| Enum                            | Valor → rótulo                                                                                                                                                                                                                                                                                                                            |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `StatusDeAgendamento`           | `AGENDADO` Marcado · `CONFIRMADO` Confirmado · `AGUARDANDO` Na recepção · `EM_ATENDIMENTO` Em atendimento · `FINALIZADO` Atendido · `FALTA` Não compareceu · `CANCELADO` Cancelado                                                                                                                                                        |
| `MotivoDeCancelamento`          | `RESPONSAVEL_DESMARCOU` Você desmarcou · `CLINICA_REMARCOU` A clínica remarcou · `PACIENTE_INDISPONIVEL` O pet não pôde ir · `DUPLICADO` Horário marcado duas vezes · `OUTRO` Outro motivo                                                                                                                                                |
| `MotivoDeFalta`                 | `ESQUECEU` Esqueci · `IMPREVISTO` Tive um imprevisto · `TRANSPORTE` Problema com transporte · `PACIENTE_MELHOROU` {pet} melhorou · `EMERGENCIA` Precisei ir a um pronto-atendimento · `CUSTO` Por causa do custo · `INSATISFACAO` Não quero continuar com a clínica · `OUTRO` Outro motivo · `OBITO` {pet} faleceu (por último, separado) |
| `StatusNaFila`                  | `AGUARDANDO` Na fila · `OFERTADO` Vaga oferecida · `ACEITO` Horário marcado · `EXPIRADO` Oferta encerrada · `REMOVIDO` Fora da fila                                                                                                                                                                                                       |
| Situação da pré-consulta        | `AINDA_NAO_ABRIU` Abre em {data} · `ABERTA` Responder até {hora} · `RESPONDIDA` Respondida — dá para mudar até {hora} · `FECHADA` Encerrada                                                                                                                                                                                               |
| `DuracaoDaQueixa`               | `HOJE` Hoje · `UM_A_DOIS_DIAS` 1 a 2 dias · `TRES_A_SETE_DIAS` 3 a 7 dias · `UMA_A_DUAS_SEMANAS` 1 a 2 semanas · `MAIS_DE_DUAS_SEMANAS` Mais de 2 semanas                                                                                                                                                                                 |
| `EvolucaoDaQueixa`              | `PIORANDO` Piorando · `ESTAVEL` Igual · `MELHORANDO` Melhorando · `VAI_E_VOLTA` Vai e volta                                                                                                                                                                                                                                               |
| `ViaDeAdministracao`            | `ORAL` pela boca · `SUBCUTANEA` injeção sob a pele · `INTRAMUSCULAR` injeção no músculo · `INTRAVENOSA` na veia · `TOPICA` sobre a pele · `OTOLOGICA` no ouvido                                                                                                                                                                           |
| `FracaoDeDose` (+ `COMPRIMIDO`) | `INTEIRO` {n} comprimido(s) · `MEIO` meio comprimido · `UM_E_MEIO` um comprimido e meio · `QUARTO` um quarto de comprimido · `TRES_QUARTOS` três quartos de comprimido · `MULTIPLO` {quantidade} comprimidos · `APROXIMADO` cerca de {quantidade} comprimido — confirme com a clínica                                                     |
| `UnidadeDeDose`                 | `ML` {quantidade} mL · `GOTA` {n} gota(s) · `APLICACAO` {n} aplicação(ões)                                                                                                                                                                                                                                                                |
| Frequência                      | 24 h: uma vez por dia · 12 h: de 12 em 12 horas · 8 h: de 8 em 8 horas · 168 h: uma vez por semana                                                                                                                                                                                                                                        |
| `SituacaoDoReforco`             | `EM_DIA` Em dia · `PROXIMO` Reforço em breve · `VENCIDO` Reforço vencido · `SERIE_INCOMPLETA` Série incompleta                                                                                                                                                                                                                            |
| `StatusDeInternacao`            | `INTERNADO` Em internação · `ALTA` Alta · `OBITO` e `TRANSFERIDO` Internação encerrada (nunca "óbito" na tela)                                                                                                                                                                                                                            |

---

## 16. Como fazer o mock

Siga o padrão do `influencer` (`src/features/influencer/flags.ts`):

- `EXPO_PUBLIC_CLINICA_API=1` liga a API; sem isso, mock. Trocar exige `npx expo start -c`.
- `src/features/clinica/mock.ts` carrega `demo-responsavel.json` e responde como o servidor.
  Mutações da pessoa ficam no `AsyncStorage`, com um "Recomeçar a demonstração" escondido nas
  configurações que volta tudo ao JSON.
- `services/clinica-responsavel/clinica-responsavel-service.ts` troca entre o mock e a API.

### O JSON de demonstração

`DemoDoResponsavel`, gerado do dataset do portal pela mesma projeção que a API vai fazer
(`src/features/clinico/data/projecao-do-responsavel.ts` no admin): `responsavel`, `pets`,
`clinicas`, `servicos`, `horariosLivres` (14 dias, 3 por profissional por dia), `agendamentos`,
`preConsultas`, `fila`, `atendimentos`, `vacinas`, `internacoes`, `boletins` e `notificacoes`
(com `titulo`, `corpo`, `lidaEm` e `dados`). Tudo já na forma do contrato.

Ele é uma fotografia de **07:30 do dia da consulta da Pérola** (`geradoEm`; `hojeDaClinica` é o
dia). Para ela não envelhecer:

- **Datas por dias inteiros.** `dias = hoje − hojeDaClinica`; some `dias` à parte de data de
  toda `DataHoraIso` e `DataIso`, mantendo hora e offset. A consulta das 10:00 continua às 10:00,
  o boletim das 7:01 continua às 7:01.
- **Um relógio da demonstração.** `agora() = geradoEm + dias + (Date.now() − inicioDaSessao)`,
  com `inicioDaSessao` no `AsyncStorage` e zerado pelo "Recomeçar". Toda regra de prazo do mock e
  todo contador das telas do módulo leem esse relógio; com a API ligada, `agora()` é
  `Date.now()`. Assim a oferta da Brunilda tem 25 minutos de verdade em qualquer hora do dia em
  que a demonstração começar, e a história não quebra porque alguém abriu o app à tarde.
- **Os campos calculados** (`pode*`, `cancelarAte`, situação da pré-consulta, `posicao`) vêm
  certos para `geradoEm`. Com o tempo andando, o mock os recalcula pela `politica` da clínica —
  a regra de referência está em `src/features/clinico/domain/politica.ts` no admin.

### Os pets

O app não tem pet de mentira: os pets vêm da conta logada. O mock **empresta a história aos pets
da conta**:

1. Casa pelo nome (sem acento e sem caixa): o pet "Pérola" da conta recebe a história da Pérola.
2. O que sobrar casa pela ordem (1º pet livre ← Pérola, 2º ← Pipoca, 3º ← Brunilda), trocando
   `pet.id`, `petId`, `petNome` e o nome dentro dos textos da clínica; as `url` das notificações
   se refazem com `urlDaNotificacaoClinica`.
3. Conta com menos pets: as histórias que sobram ficam de fora.

**Decisão:** para a demonstração que passa pelo portal, use uma conta com três pets chamados
Pérola (gata), Pipoca (porquinho-da-índia) e Brunilda (jabuti). Aí nada precisa ser trocado.

### O mock simula o servidor, não a tela

- calcula os campos da seção 1.2 pelo relógio da demonstração;
- devolve os erros no formato `ErroDaApi`, com `codigo`, pelos mesmos motivos da API — inclusive
  `OFERTA_EXPIRADA` quando o contador zera e `SOMENTE_LEITURA` para membro de leitura;
- aplica latência (300–800 ms) e tem uma chave de falha, para a tela de erro existir;
- **opcional:** avança o que a clínica faria — depois das 10:30, a consulta da Pérola vira
  `FINALIZADO`, 25 minutos depois o resumo é liberado e chega `ATENDIMENTO_RESUMO_DISPONIVEL`; um
  boletim novo da Pipoca a cada período da preferência;
- **opcional:** as notificações do JSON entram na caixa de entrada enquanto o mock estiver
  ligado, e a oferta pode sair como notificação local (`scheduleNotificationAsync`) com o mesmo
  `dados`, para a demonstração ter o push na tela bloqueada.

---

## 17. O cenário de demonstração

O mesmo roteiro dos dois lados, para uma demonstração passar do portal para o app sem trocar de
história. Nomes e ids são os do JSON; as datas são relativas ao dia da consulta ("hoje").

**Responsável:** Fátima Gonçalves (`tutor-fatima`), (11) 96622-7745. Liberou diário e peso para a
clínica há 45 dias; notas, não.
**Clínica:** PetJourney Clínica Veterinária (`clinic-petjourney`), Rua das Acácias, 421 — Vila
Madalena, São Paulo/SP, (11) 3555-0142, offset `-04:00`. Seg a sáb, 8 h–19 h, almoço 12 h–13 h.
Profissionais: Ana Ribeiro, Helena Vasconcelos Prado, Tiago Sá, Caio Nogueira, Márcia Do Espírito
Santo Albuquerque.
**Política:** cancelar até 2 h antes, reserva de 5 min, pré-consulta abre 72 h antes, oferta de
vaga de 30 min.

| Pet                                                  | O que está acontecendo                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | O que demonstra                                                                                                                                                     |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Pérola** (`pet-perola`), gata SRD, nascida em 2014 | Consulta **hoje, 10:00**, com Helena, marcada pelo app ("Acho que ela está mais magra e bebendo muita água") e confirmada pelo app na véspera. Às 07:30 ainda dá para cancelar (até 08:00). Pré-consulta **aberta e sem resposta**, com sugestão do diário: come pouco, bebe e urina muito, 4,1 kg na balança de casa. Três consultas liberadas: check-up (−150 dias, 4,9 kg); displasia coxofemoral (−95 dias, **meloxicam 0,12 mL uma vez por dia, uso contínuo**); gastroenterite em investigação (−42 dias, omeprazol meio comprimido por 14 dias, já terminou). V4 felina com reforço em 25 dias. | agendamento pelo app, prazo de cancelamento, pré-consulta preenchida pelo diário, resumo pós-consulta, receita contínua virando lembrete sem fim, reforço `PROXIMO` |
| **Pipoca** (`pet-pipoca`), porquinho-da-índia        | **Internada** há 40 h por diarreia com sangue e prostração, com Tiago Sá. Boletins de 12 em 12 h, silêncio noturno, foto sempre: três boletins (7:01 de ontem, 19:01 de ontem, 7:01 de hoje), dois com foto, contando a melhora noite a noite. Alta prevista para hoje às 15:30.                                                                                                                                                                                                                                                                                                                       | conversa de boletins, a madrugada juntada às 7 h, preferências, push que não adianta conteúdo                                                                       |
| **Brunilda** (`pet-bruna`), jabuti                   | **Faltou** a um retorno há 10 dias (14:00, com Helena), sem justificativa. Está na **lista de espera** para consulta, qualquer profissional, seg–sex das 14 h às 18 h, **com uma oferta aberta** no próximo dia útil que cabe nas janelas, às 15:00, vencendo 25 minutos depois do instante da demonstração.                                                                                                                                                                                                                                                                                           | falta e justificativa, fila, oferta com contador, aceite que vira agendamento                                                                                       |

**As nove notificações** (mais recente primeiro): vaga oferecida à Brunilda (nova); boletim da
Pipoca de hoje (novo); boletim de ontem à noite (novo); véspera da consulta da Pérola (lida — foi
por ela que a Fátima confirmou); pré-consulta da Pérola (nova); boletim de ontem de manhã (lida);
reforço da V4 (lida); falta da Brunilda (lida); resumo da última consulta da Pérola (lida).

O JSON **é** o cenário: se algo aqui divergir dele, vale o JSON — e avise.

---

## 18. O que o portal já faz do lado dele

Para a demonstração funcionar dos dois lados, o portal (mock) já implementa o contrato:

- **Aceite de oferta cria o horário** (`origem: FILA`, `CONFIRMADO`), conferindo antes se a oferta
  venceu (`OFERTA_EXPIRADA`) e se a vaga continua livre (`VAGA_JA_PREENCHIDA`).
- **Presença confirmada**, pelo app ou pela recepção, com a hora, no detalhe do horário da
  agenda; "ainda sem confirmação" quando faltam menos de 48 h.
- **Prazo do app** no detalhe do horário: "Cancela ou remarca pelo app até …" ou "Prazo
  encerrado: só por telefone".
- **Liberar o resumo** para o responsável, num passo separado de finalizar o atendimento.
- **Falta justificada pelo app** (`canal: APP`, sem profissional) no painel de faltas.
- **Consentimento do diário** respeitado no "Este pet em 30 segundos", com o estado "o
  responsável não liberou".
- **Prévia do boletim no celular** sem contagem de retidos.
- **Pré-consulta e diário na forma do contrato**, com a marca "do diário" e a aplicação só em
  campo vazio.
- **A projeção** (`projecao-do-responsavel.ts`) e o gerador do JSON (`npm run contrato:demo`),
  com teste do que não pode vazar (retido, diferencial, mg/kg, prioridade da fila).

Do lado do portal, a integração real é trocar os repositórios mocados pelas chamadas da API
quando elas existirem — a forma já é a do contrato.

---

## 19. Fora deste protótipo

- Pagamento, orçamento aprovado pelo app e sinal para reservar.
- Assinatura de termo pelo app (o estado aparece; assinar, não).
- Chat com a clínica. O canal de volta é o telefone.
- Vídeo-consulta.
- Procurar e escolher clínica nova pelo app (o diretório do `Clinica` legado continua
  dormente).
- Mais de uma clínica com dados diferentes: o cenário tem uma; a tela de clínicas precisa
  funcionar com várias, mas o mock pode ter só uma.

---

## 20. O que a API precisa ter quando sair do mock

Registro para o time da API — nada aqui é tarefa do app.

1. As rotas de `ROTAS_DO_RESPONSAVEL` sob `tutor/clinica`, com os DTOs do contrato.
2. **A clínica é o `Parceiro`** com `categoria = CLINICA_VETERINARIA`. Um modelo novo liga
   parceiro e pet (nasce no primeiro agendamento ou atendimento) e guarda o consentimento por
   responsável e clínica. `Clinica`, `Veterinario` e `ClinicasPacientes` são legado dormente.
3. `codigo` no corpo do erro (o `HttpExceptionFilter` já espalha campos extras; é carregá-lo na
   exceção).
4. Os doze tipos de notificação: enum `TipoNotificacao`, `NOTIFICACAO_CATALOG` nos quatro
   idiomas (o pt-BR é `TEXTOS_PT_DAS_NOTIFICACOES`), `ROTA_POR_TIPO` (=
   `ROTAS_DAS_NOTIFICACOES_CLINICAS`), `CANAL_POR_TIPO`, `CATEGORIA_POR_TIPO` (`CLINICO`), `url`
   por `urlDaNotificacaoClinica`, e o envio a membros da família com `paraMembro`, como o
   `LEMBRETE_VENCIDO`. Óbito e transferência não notificam.
5. **Liberar o resumo cria a `Consulta`** do pet, com `ConsultaPrescricaoItem` por item, o
   `PesoRegistro` do peso aferido (sem duplicar, como o import do prestador) e um vínculo novo de
   volta (`consultaId` no contrato). O `PesoRegistro` criado assim precisa ser reconhecível, para
   o `GET .../diario` da clínica não o devolver como peso de casa.
6. **Lembretes da receita:** `LembreteSerie` `MEDICAMENTO` com a frequência da seção 2 e
   `repetirAte`; no uso contínuo, `TratamentoFixo` e série com origem `TRATAMENTO_FIXO`; ligados
   ao `ConsultaPrescricaoItem`.
7. **Salvar nos documentos:** cria `Documents` do pet com `dataEmissao` e o `tipo` da seção 2;
   idempotente.
8. **Vacina:** lote, fabricante, validade do lote, dose e doses da série na aplicação da
   clínica; cria a `Vacina` da carteira, fecha o lembrete pendente de mesmo nome e agenda a
   próxima dose como `LembreteSerie` `VACINA`.
9. `GET /parceiro/portal/pacientes/:petId/diario` com enum cru, janela desde a última consulta,
   atrás do consentimento (`diarioCompleto`, `peso` e `notas` separados).
10. Pré-consulta como modelo próprio, ligada ao agendamento, com `DuracaoDaQueixa` e
    `EvolucaoDaQueixa` como enums novos, e o upload de foto com as regras da foto do diário.
11. **Oferta de vaga não segura o horário:** o aceite confere a vaga de forma atômica e responde
    `VAGA_JA_PREENCHIDA` quando perdeu a corrida.
12. **Especialidade** do profissional como chave da lista do app ou texto livre (seção 1.4).
