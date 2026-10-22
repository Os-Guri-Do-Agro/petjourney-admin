# Spec: Fechar os parciais do texto do parceiro (doses antes do app, vínculo na aprovação, mensagens prontas em 3 casos)

**Status:** Concluído (API no `develop`, commits `ab2b964` e `79a0b81`; front no guia de novembro; produção quando o `develop` subir para o `master`)
**Autor:** Claude (pedido e decisões do Nicolas)
**Criado em:** 2026-10-21
**Última atualização:** 2026-10-21
**Versão:** 0.3

---

## Visão Geral

O Nicolas cruzou um texto de produto (receita do veterinário, acesso temporário, parceiro sem cadastro) com o que existe e achou três itens **parciais**. Esta spec fecha os três, em partes que sobem sozinhas:

| Parte | Item do texto | Hoje | Depois |
|---|---|---|---|
| **P1** | "Adicionar no histórico que o pet já tomou" | O "Quando começou?" (Parte 4) só encurta o fim da série; as doses de antes somem | A série guarda o início e quantas doses foram antes do app, e o calendário mostra uma linha de resumo e o progresso certo |
| **P2** | "Vincula automaticamente" | Só quem já tem conta aprovada vincula pelo código | Quem cria a conta a partir do acesso deixa o código reivindicado, e o vínculo acontece sozinho quando o admin aprova o cadastro |
| **P3** | "Link com as mensagens prontas, casos 1, 2 e 3" | Uma mensagem só, igual com conta ou sem | Três mensagens prontas: profissional com conta, sem conta, e convite para criar conta |

Fora de escopo: o item **"Não"** da mesma tabela (o veterinário acompanhar se a dose está sendo dada, ao vivo). Para clínica com vínculo ele está na E4-05 do portal (`portal-parceiro/e4-prontuario/05-tratamentos-e-adesao.md`, agendada para 25/10). Para o veterinário do acesso temporário não há caminho, e isso fica como pergunta em aberto.

## Motivação / Contexto de Negócio

- O texto é a promessa que o produto faz ao veterinário e ao responsável. Cada parcial é uma frase do texto que a pessoa vai testar e não vai achar.
- A dor nº 1 do app é o lembrete de remédio (memória da leitura de receita). Um tratamento que começou antes do app aparecendo como "dose 1 de 8" quando é a 7ª de 14 confunde quem acompanha.
- O canal "veterinário sem conta" é a porta de entrada de parceiro novo. Hoje o "Criar minha conta grátis" da página do acesso só cria um usuário: nem vira parceiro, nem leva o código, e o acesso que ele estava usando se perde.

### Decisões do Nicolas (2026-10-21)

1. Doses antes do app: **uma linha de resumo**, sem criar dose dada por horário (mantém a D7 da Parte 4).
2. Vínculo: **na aprovação** do cadastro (mantém a D8.3).
3. Os 3 casos: (1) profissional que já tem conta, (2) sem conta, que registra o atendimento e a receita pelo link público, (3) convite para criar conta grátis, que já vincula. A API devolve as três e o app pergunta "ele já usa a PetJourney?".

---

## Research Findings

**Stack:** NestJS 11 (Fastify), Prisma 7, Postgres (Supabase). Cada parte é aditiva.

### P1: doses antes do app

- A dose dada vive em `LembreteOcorrencia` (`status CONCLUIDO`, `administradoEm`) e, quando alguém informa, em `Medicamento` (`prisma/schema.prisma:2030-2070`, `:2107-2132`). Não existe status FEITO nem campo de origem.
- `dosesJaDadas` e o total **não são colunas**: chegam no corpo (`confirmar-leitura.dto.ts:97-109`, `prescricao-validation.util.ts:51,175`) e só encurtam o fim. No escritor, `restantes = total - dosesJaDadas` (`consulta.service.ts:266`) e `criarLembreteDerivado` recebe `repetirAte` da última dose (`:324-346`). Nada do passado é gravado, e o início real só fica no `TratamentoFixo.dataInicio` (que a Parte 4 corta até 30 dias).
- A spec 04 da leitura decidiu isso de propósito, na **D7** ("inventar 10 horários seria fato clínico falso"). Criar doses passadas também mudaria o Desfazer (`remover-derivados.ts:49-66` não apaga série com dose CONCLUIDO) e inflaria a base da adesão da E4-05.
- O calendário de medicação (`calendario-medicacao.service.ts:96-172`) devolve, por série, `inicio` (primeira ocorrência), `fim` e `progresso` (`projetar-doses.ts:56-64`, `:202-210`). O `total` conta só o que existe na série, então hoje é o número de doses **restantes** do tratamento.
- `inicio-do-tratamento.ts:93`: em uso contínuo (sem total) o `dosesJaDadas` não é calculado; só a data existe.

### P2: vínculo de quem cria a conta pelo acesso

- Vincular hoje: `POST /parceiro/portal/compartilhamentos/vincular` (`compartilhamento-prestador-parceiro.controller.ts:42-53`, service `:90-148`). Exige parceiro operacional (`assertOperacional`, `:77-86`, regra D8.3 da Parte 8), grava `parceiroId`/`vinculadoEm`/`vinculadoPorUsuarioId` com guarda de corrida e avisa o responsável com `PRESTADOR_ACESSOU_PRONTUARIO` (`:145`, `:160-178`).
- Cadastro de parceiro: `POST /usuario` e depois `POST /parceiro/portal/cadastro` (`parceiro-portal.service.ts:230-360`), que cria `Parceiro PENDENTE` e o DONO. Nenhum dos dois leva o código do acesso.
- O "Criar minha conta grátis" da página do acesso, no site (`petjourney-web/src/components/prestador/ParceiroCta.tsx:320-325`), chama só `POST /usuario`: **não cria parceiro**.
- Aprovação: `ParceiroService.aprovar` (`src/cupom/parceiro.service.ts:460-518`), transação com a transição para APROVADO e e-mail depois do commit. O `CupomModule` não importa o módulo do acesso, e o módulo do acesso importa `ParceiroPortalModule`: ligar os dois por injeção arrisca ciclo.
- A sessão do portal está mexendo agora em `src/parceiro-portal/` (cadastro), `src/notificacao/`, `src/timeline/`, `consulta.service.ts` e `schema.prisma`, sem commit. Esta spec evita os quatro primeiros e mexe no mínimo nos dois últimos.

### P3: mensagens prontas

- `GET /tutor/compartilhamentos-prestador/:id/handoff` (`compartilhamento-prestador.service.ts:1019-1080`) monta a mensagem em `handoff.helper.ts:334-371` com os moldes de `src/common/i18n/handoff.templates.ts` (6 locales, en-GB explícito, regras de copy em teste). Resposta: `{ texto, mensagem, alertas, linkWhatsApp, link, codigo, expiraEm }`. O app publicado lê `mensagem ?? texto` (comentário em `:1069-1071`).
- Link público: `${PRESTADOR_BASE_URL}/prestador/<código>` (`service.ts:330-332`).
- O portal já abre o "Vincular código" preenchido (admin `2647b08`, 2026-10-21), e o site monta o link de login com o código em `portalVincularCodigoUrl` (`petjourney-web/src/lib/parcerias-cta.ts:54-59`). Hosts (Nicolas, 2026-10-21): `portal.petjourney.health` é o portal do parceiro, `petjourney.health` é a landing com as páginas públicas, e o CMS é interno. `web.petjourney.health` **não existe** (a configuração nova da sessão do portal usa esse host por engano; avisado).
- O canal público só aceita prescrição em acesso do tipo CONSULTA (`dto/anotacao-estruturada.dto.ts:253-257`).

**Breaking Changes:** nenhuma. Todo campo de resposta é novo, os campos de hoje mantêm o significado, a rota nova não muda as existentes e as migrations são aditivas.

---

## Decisões

- **D1 (P1):** a série guarda o que a pessoa **informou**, em duas colunas novas e anuláveis de `LembreteSerie`: `inicioInformadoEm DateTime?` (quando o tratamento começou) e `dosesAntesDoApp Int?` (quantas doses foram antes da primeira dose no app). Nenhuma ocorrência, `Medicamento` ou horário passado é criado (D7 da Parte 4 mantida).
- **D2 (P1):** grava quando o escritor único recebe `inicioTratamento` ou `dosesJaDadas > 0`. Vale nos três caminhos que usam o escritor: Confirmar da leitura, importação da anotação do parceiro e prescrição da consulta. Em uso contínuo só a data é gravada (`dosesAntesDoApp` nulo).
- **D3 (P1):** onde aparece. No calendário de medicação, cada série ganha `antesDoApp: { inicio, doses } | null`, e o progresso ganha `antesDoApp` (número, 0 quando não há). O `progresso.total` mantém o significado de hoje, porque o app publicado o mostra. O app passa a mostrar "dadas + antesDoApp de total + antesDoApp". A linha do tempo do pet fica de fora desta versão: o mapeador está em mudança pela sessão do portal, e um tipo novo pede copy no app (follow-up).
- **D4 (P2):** a reivindicação mora numa **tabela nova**, `ReivindicacaoAcesso` (acesso, parceiro, usuário, quando, resultado). Uma tabela, e não colunas no acesso, para que a reivindicação de um parceiro pendente não bloqueie a de outro.
- **D5 (P2):** a reivindicação nasce numa **rota nova**, `POST /parceiro/portal/compartilhamentos/reivindicar { codigo }`, chamada pelo front logo depois do cadastro. Não entra no `POST /parceiro/portal/cadastro`, que é da sessão do portal e está em mudança. Para parceiro já operacional, a rota faz o mesmo que o vincular, então o front chama sempre a mesma rota depois do cadastro.
- **D6 (P2):** a aplicação acontece **na aprovação**, por uma função auxiliar `aplicarReivindicacoes(prisma, emissor, parceiroId)` chamada em `ParceiroService.aprovar` depois do commit. Ela recebe as dependências por parâmetro, sem import de módulo, e é best-effort: falhar nunca desfaz a aprovação. Para cada reivindicação aberta:
  - se o acesso está ATIVO, dentro do prazo e sem parceiro, vincula com a mesma guarda de corrida do vincular, avisa o responsável com `PRESTADOR_ACESSOU_PRONTUARIO` e grava `VINCULADO`;
  - senão, fecha com o motivo: `VENCIDO`, `ENCERRADO` (revogado ou expirado) ou `JA_VINCULADO`.
- **D7 (P2):** o profissional fica sabendo do que não deu certo por `GET /parceiro/portal/compartilhamentos/reivindicacoes`. A rota devolve as abertas e as fechadas nos últimos 30 dias, com nome do pet e motivo, e o portal mostra um aviso. Não há notificação nova: um tipo novo exigiria rota no app e mexer no catálogo de notificação, que está em mudança.
- **D8 (P2):** limites e respostas, iguais ao vincular:
  - 10 por minuto;
  - 404 genérico `PRESTADOR_ACESSO_INVALIDO` para código que não pode ser reivindicado;
  - 409 `COMPARTILHAMENTO_JA_VINCULADO` se o acesso já tem outro parceiro;
  - 403 `PARCEIRO_NAO_OPERACIONAL` para parceiro SUSPENSO ou REJEITADO;
  - até **20 reivindicações abertas e vivas** por parceiro (a 21ª dá 429 `COMPARTILHAMENTO_REIVINDICACOES_LIMITE`, chave nova no catálogo de erro, 6 locales); acesso vencido ou revogado não ocupa vaga;
  - repetir o mesmo código é idempotente.
- **D9 (P3):** a resposta do handoff ganha `variantes: { COM_CONTA, SEM_CONTA, CONVITE }`, cada uma com `{ texto, linkWhatsApp }`. `texto`, `mensagem` e `linkWhatsApp` continuam **idênticos** aos de hoje (o app publicado lê esses campos).
- **D10 (P3):** todos os links ficam no host do site (`PRESTADOR_BASE_URL`), que é quem sabe onde o portal mora:

  | Variante | Link |
  |---|---|
  | `COM_CONTA` | `/prestador/<código>?entrar=portal` |
  | `SEM_CONTA` | `/prestador/<código>` |
  | `CONVITE` | `/cadastro?perfil=parceiro#acesso=<código>` (fragmento: fora do servidor e do Google Analytics; achado da auditoria) |

  Sem a mudança do site os links continuam funcionando: o primeiro abre a página do acesso, que já tem "Entrar no portal", e o terceiro abre o cadastro sem o código.
- **D11 (P3):** as mensagens só falam em receita quando o acesso é do tipo CONSULTA, o único em que o canal público aceita prescrição. Nos outros tipos é "registrar o atendimento".
- **D12 (P3):** cada variante é a mensagem de hoje até a validade (saudação, motivo, alertas por opt-in, validade). Só o bloco final muda:
  - **COM_CONTA:** "Se você já usa a PetJourney, entre pelo portal e o acesso abre pronto para vincular: {link}" e o código.
  - **SEM_CONTA:** "Abra aqui para ver o prontuário e registrar o atendimento e a receita, sem precisar de cadastro: {link}" e o código.
  - **CONVITE:** o bloco do SEM_CONTA, mais "Quer acompanhar seus pacientes pela PetJourney? Crie sua conta grátis de parceiro: {link}. Depois da aprovação, este acesso aparece no seu portal."

  A redação final segue as regras de `handoff.templates.ts` (sem travessão, sem "tutor", árabe sem placeholder no começo da frase, sérvio sem gênero de quem escreve).

---

## Riscos e Mitigações

| Nível | Risco | Mitigação |
|---|---|---|
| Médio | P2: alguém com o código de um acesso cria um parceiro e, quando o admin aprova, o acesso fica vinculado a ele | O código já é a credencial: quem o tem lê o prontuário na página pública. A reivindicação não mostra nada antes da aprovação. A aprovação passa pelo admin. O responsável recebe `PRESTADOR_ACESSOU_PRONTUARIO` no vínculo e pode revogar. Só vale com o acesso ATIVO, até 20 abertas por parceiro, e o log nunca grava o código |
| Médio | P2 e P1 mexem em arquivos com mudança grande e sem commit da sessão do portal (`schema.prisma`, `consulta.service.ts`) | Commit só da minha parte, com índice montado à mão e conferência num worktree limpo, com o Prisma gerado do schema do commit (o mesmo processo dos commits `7f1541a` e `4e675f8`). Nenhuma edição em `src/parceiro-portal/`, `src/notificacao/` nem `src/timeline/` |
| Médio | Migrations novas no meio das 13 migrations do portal, ainda não commitadas e já aplicadas no dev | `prisma migrate status` antes. Nomes com horário depois das do portal (`20261021170000_*`). Migrations aditivas, aplicadas no dev com `migrate deploy` e conferidas com `migrate status` depois |
| Baixo | P3 depende do site ler `entrar=portal` e `acesso=` | D10: sem o site o link abre a página do acesso ou o cadastro, sem quebrar. O handoff do site entra no guia do Luís |
| Baixo | P1: o app publicado ignora o campo novo e segue mostrando o progresso de hoje | Campos aditivos. O texto novo depende do app (handoff) |

---

## Requisitos Não-Funcionais

- **Segurança:**
  - A rota de reivindicar exige JWT e membership aceito no parceiro (`resolverParceiro`).
  - A lista de reivindicações só devolve as do parceiro do contexto.
  - O handoff mantém o dono estrito.
  - Toda rota nova recebe caso de "tutor errado" ou "parceiro errado" no spec, e o `security-auditor` revisa o diff.
- **Privacidade:**
  - O log não leva código, telefone nem texto da mensagem.
  - A lista de reivindicações devolve o nome do pet só das reivindicações do próprio parceiro, que já tinha o código.
- **Internacionalização:** as variantes da P3 e a chave `REIVINDICACAO_LIMITE` nos 6 locales, com en-GB explícito.
- **Performance:** o calendário só lê duas colunas a mais. A aprovação ganha uma consulta indexada por parceiro.

---

## User Stories

- Como **responsável**, quero que o tratamento que comecei antes do app apareça com o início e as doses que já dei, para ver o progresso real (7 de 14) e não um tratamento que parece novo.
- Como **veterinário sem conta**, quero criar minha conta a partir do acesso que recebi e encontrar esse acesso no portal quando a conta for aprovada, sem pedir um código novo.
- Como **responsável**, quero mandar ao veterinário a mensagem certa para o caso dele (já usa, não usa, ou quero convidar), para que ele saiba o que fazer com o link.

---

## Acceptance Criteria

### P1: doses antes do app

- [x] **AC1** **Given** uma leitura confirmada com `criarLembrete.inicio` 4 dias atrás, 12/12h por 7 dias **When** a série é criada **Then**:
  - `LembreteSerie.inicioInformadoEm` = o início informado;
  - `dosesAntesDoApp` = as doses que o `aplicarInicioDoTratamento` contou;
  - nenhuma ocorrência CONCLUIDO e nenhum `Medicamento` foram criados para essas doses.
- [x] **AC2** **Given** essa série **When** `GET /lembrete/calendario-medicacao` **Then** a série traz:
  - `antesDoApp = { inicio, doses }`;
  - `progresso.antesDoApp` igual a `doses`;
  - `progresso.total` igual ao de hoje (só as doses da série).
- [x] **AC3** **Given** uma série criada sem `inicio` e sem `dosesJaDadas` (ou com 0) **Then** `antesDoApp` é `null` e `progresso.antesDoApp` é 0.
- [x] **AC4** **Given** um item de uso contínuo com `inicio` **Then** `antesDoApp = { inicio, doses: null }`.
- [x] **AC5** **Given** a importação de uma anotação do parceiro com `criarLembrete.inicio` **Then** a série grava os dois campos como no AC1 (mesmo escritor).
- [x] **AC6** **Given** o Desfazer da leitura de uma série com `antesDoApp` e sem dose dada **Then** a série é apagada como hoje (`remover-derivados` sem mudança de comportamento).

### P2: vínculo na aprovação

- [x] **AC7** **Given** um parceiro PENDENTE e o código de um acesso ATIVO sem parceiro **When** `POST /parceiro/portal/compartilhamentos/reivindicar { codigo }` **Then**:
  - responde 200 `{ reivindicado: true, vinculaNaAprovacao: true }` (200 e não 202: a mesma rota vincula na hora para parceiro aprovado);
  - existe `ReivindicacaoAcesso` aberta;
  - o acesso continua sem `parceiroId`;
  - o responsável não recebe aviso.
- [x] **AC8** **Given** a mesma chamada repetida **Then** responde igual, sem criar uma segunda linha (idempotente).
- [x] **AC9** **Given** um parceiro já operacional **When** reivindica **Then** o acesso é vinculado na hora (mesmo efeito, resposta e aviso do `vincular`) e a resposta traz `vinculado: true`.
- [x] **AC10** **Given** um código inexistente, vencido ou revogado **Then** 404 `PRESTADOR_ACESSO_INVALIDO`. Já vinculado a outro parceiro dá 409 `COMPARTILHAMENTO_JA_VINCULADO`. Parceiro SUSPENSO ou REJEITADO dá 403 `PARCEIRO_NAO_OPERACIONAL`. Usuário sem membership no parceiro dá 403.
- [x] **AC11** **Given** 20 reivindicações abertas e vivas do mesmo parceiro **When** a 21ª **Then** 429 `COMPARTILHAMENTO_REIVINDICACOES_LIMITE`.
- [x] **AC12** **Given** uma reivindicação aberta e o acesso ainda ATIVO e no prazo **When** o admin aprova o parceiro **Then**:
  - o acesso fica com `parceiroId` desse parceiro e `vinculadoPorUsuarioId` = quem reivindicou;
  - a reivindicação fecha como `VINCULADO`;
  - o responsável recebe `PRESTADOR_ACESSOU_PRONTUARIO` uma vez.
- [x] **AC13** **Given** uma reivindicação aberta cujo acesso venceu, foi revogado ou ganhou outro parceiro antes da aprovação **When** o admin aprova **Then** a reivindicação fecha com `VENCIDO`, `ENCERRADO` ou `JA_VINCULADO`, e o acesso não muda.
- [x] **AC14** **Given** uma falha ao aplicar as reivindicações **When** o admin aprova **Then** a aprovação continua valendo (resposta e status iguais aos de hoje), e o erro sai no log.
- [x] **AC15** **Given** reivindicações abertas e fechadas há menos de 30 dias **When** `GET /parceiro/portal/compartilhamentos/reivindicacoes` **Then** volta `{ itens: [{ id, petNome, situacao: 'AGUARDANDO_APROVACAO' | 'VINCULADO' | 'VENCIDO' | 'ENCERRADO' | 'JA_VINCULADO', criadaEm, resolvidaEm }] }`, só do parceiro do contexto.

### P3: mensagens prontas

- [x] **AC16** **Given** um acesso ATIVO **When** `GET .../:id/handoff` **Then** `texto`, `mensagem` e `linkWhatsApp` são iguais, byte a byte, aos de antes desta spec, e a resposta traz `variantes.COM_CONTA`, `variantes.SEM_CONTA` e `variantes.CONVITE`, cada uma com `texto` e `linkWhatsApp`.
- [x] **AC17** Os links de cada variante seguem a D10 com o host de `PRESTADOR_BASE_URL` e o código do acesso.
- [x] **AC18** **Given** um acesso do tipo CONSULTA **Then** o SEM_CONTA e o CONVITE falam de receita. **Given** um acesso de outro tipo **Then** falam só de registrar o atendimento.
- [x] **AC19** As variantes respeitam o opt-in de alertas (`incluirAlertas`), o motivo e a validade exatamente como o `texto` de hoje.
- [x] **AC20** As três variantes existem nos 6 locales: sem travessão, sem "tutor" em pt e com en-GB explícito (teste de moldes).

---

## Estratégia de Testes

### Unitários
- [ ] `consulta.service.spec.ts` (escritor): `inicioTratamento` e `dosesJaDadas` chegam ao `criarLembreteDerivado` (AC1, AC4); sem eles, nulos (AC3).
- [ ] `lembrete-derivado.helper.spec.ts`: grava `inicioInformadoEm` e `dosesAntesDoApp`.
- [ ] `projetar-doses.spec.ts` e `calendario-medicacao.service.spec.ts`: `antesDoApp` e `progresso.antesDoApp` (AC2, AC3, AC4).
- [ ] `reivindicacao-acesso.service.spec.ts` (novo): AC7 a AC11 e "parceiro errado".
- [ ] `aplicar-reivindicacoes.spec.ts` (novo): AC12, AC13 e o caso de corrida (outro parceiro vincula no meio).
- [ ] `parceiro.service.spec.ts` (aprovar): chama a aplicação depois do commit; falha não derruba (AC14).
- [ ] `handoff.helper.spec.ts` e `handoff.templates.spec.ts`: variantes, links, CONSULTA versus outros tipos, opt-in, 6 locales e regras de copy (AC16 a AC20).

### Integração (Postgres de dev, `--forceExit`)
- [ ] Leitura: Confirmar com `inicio` grava as colunas e o calendário devolve `antesDoApp` (AC1, AC2).
- [ ] Reivindicação: parceiro PENDENTE reivindica, o admin aprova e o acesso fica vinculado, com aviso único (AC7, AC12). Acesso vencido antes da aprovação (AC13). Duas reivindicações de parceiros diferentes e a primeira aprovação vence (D4).

### Smoke
- [ ] `smoke-leitura-receita`: bloco [10b] confere `antesDoApp` no calendário.
- [ ] Smoke novo `smoke-reivindicar-acesso.ts` contra a API local: cadastro, reivindicar, aprovar pela rota admin e conferir o vínculo e a lista.

### Regressão
- [ ] Suíte inteira, os dois smokes da leitura e o `qa:cenarios` (regressão de segurança).
- [ ] Cenário novo em `qa/cenarios/regressao-seguranca.json`: reivindicar com parceiro de outro usuário (403) e listar reivindicações de outro parceiro (403).

---

## Arquivos Impactados

| Arquivo | Ação | Parte |
|---|---|---|
| `prisma/schema.prisma` | Modificar: 2 colunas em `LembreteSerie`; model `ReivindicacaoAcesso` e enum `ResultadoReivindicacao` | P1, P2 |
| `prisma/migrations/20261021200000_lembrete_serie_antes_do_app/` | Criar | P1 |
| `prisma/migrations/20261021200100_reivindicacao_acesso/` | Criar | P2 |
| `src/lembrete/lembrete-derivado.helper.ts` | Modificar: `antesDoApp?` no input | P1 |
| `src/consulta/consulta.service.ts` | Modificar: repassa `inicioTratamento` e `dosesJaDadas` (só este trecho; o resto do arquivo é da sessão do portal) | P1 |
| `src/lembrete/calendario/calendario-medicacao.service.ts`, `projetar-doses.ts` | Modificar: `antesDoApp` na série e no progresso | P1 |
| `src/compartilhamento-prestador/reivindicacao-acesso.service.ts` | Criar | P2 |
| `src/compartilhamento-prestador/helpers/aplicar-reivindicacoes.ts` | Criar | P2 |
| `src/compartilhamento-prestador/compartilhamento-prestador-parceiro.controller.ts` | Modificar: rotas `reivindicar` e `reivindicacoes` | P2 |
| `src/compartilhamento-prestador/dto/reivindicar-acesso.dto.ts` | Criar | P2 |
| `src/cupom/parceiro.service.ts` | Modificar: chama `aplicarReivindicacoes` no `aprovar` | P2 |
| `src/common/errors/error-catalog.ts` | Modificar: `REIVINDICACAO_LIMITE` | P2 |
| `src/common/i18n/handoff.templates.ts`, `helpers/handoff.helper.ts`, `compartilhamento-prestador.service.ts` (handoff) | Modificar | P3 |
| `contrato/openapi.json` | Regerar | P1, P2, P3 |
| `docs/frontend/novembro-2026/parciais-acesso-e-receita.md` | Criar: handoff do app, do site e do portal (fronts em novembro, como o resto do Luís) | todas |

---

## Tasks Técnicas

- [x] **T0**: rodar `prisma migrate status`; criar o card no board (outubro, API) e o card do Luís (novembro, front), conforme o acompanhamento no workflow.
- [x] **T1** (P1): colunas em `LembreteSerie` e migration aditiva, aplicada no dev.
- [x] **T2** (P1): `criarLembreteDerivado` grava `antesDoApp`, e o escritor em `consulta.service.ts` repassa os dois valores *(depende de T1)*.
- [x] **T3** (P1): o calendário devolve `antesDoApp` e `progresso.antesDoApp` *(depende de T1)*.
- [x] **T4** (P1): testes unitários e de integração da P1 e o bloco [10b] do smoke *(depende de T2 e T3)*.
- [x] **T5** (P2): model `ReivindicacaoAcesso` e migration *(independe da P1)*.
- [x] **T6** (P2): `reivindicacao-acesso.service.ts`, DTO e as duas rotas *(depende de T5)*.
- [x] **T7** (P2): `aplicar-reivindicacoes.ts` e a chamada no `aprovar` *(depende de T5)*.
- [x] **T8** (P2): chave `REIVINDICACAO_LIMITE` nos 6 locales *(junto com T6)*.
- [x] **T9** (P2): testes unitários e de integração, smoke novo e cenários de segurança *(depende de T6 e T7)*.
- [x] **T10** (P3): moldes das 3 variantes nos 6 locales, `montarHandoff` com as variantes e a resposta do handoff.
- [x] **T11** (P3): testes da P3.
- [x] **T12**: `openapi:exportar`, `security-auditor` no diff, `/code-review` e correções.
- [x] **T13**: handoff do front em `docs/frontend/novembro-2026/`:
  - **app:** linha "começou em" e o progresso no calendário; escolha "ele já usa a PetJourney?" no compartilhar;
  - **site:** `?entrar=portal` redireciona para o portal com o código; `/cadastro?acesso=` chama `reivindicar` depois do cadastro; o "Criar minha conta grátis" da página do acesso passa a criar o parceiro e reivindicar;
  - **portal:** aviso das reivindicações.
- [x] **T14**: CHANGELOG, spec `Concluído`, memória e `/spec-sync`.

Ordem de subida: P1, P2 e P3 sobem sozinhas. A frase final do CONVITE ("depois da aprovação, este acesso aparece no seu portal") só é verdade com a P2 no ar, então a P3 sobe depois da P2.

---

## Considerações de Arquitetura

- **Decisão:** resumo informado na série (D1).
  **Alternativa rejeitada:** uma dose por horário, decidida pelo Nicolas. Ela inventaria horário, mudaria o Desfazer e inflaria a adesão.
- **Decisão:** a reivindicação tem rota própria e é aplicada na aprovação por uma função auxiliar (D5, D6).
  **Alternativas rejeitadas:**
  - campo no `POST /parceiro/portal/cadastro`: o arquivo está em mudança pela sessão do portal;
  - evento ou cron: o repo não usa event emitter, e um cron atrasaria o vínculo sem ganho;
  - injeção entre módulos: risco de ciclo.
- **Decisão:** os links das mensagens ficam no host do site (D10).
  **Alternativa rejeitada:** a API montar o link do portal. O host é `portal.petjourney.health`, mas o site já tem `portalVincularCodigoUrl`, e manter o host do portal num lugar só evita a divergência que já aconteceu (`web.`).

## Entrega (2026-10-21)

**Verificado no commit isolado** (worktree limpo, Prisma do schema do commit):
- typecheck;
- suíte inteira: 304 suites, 5.380 testes;
- catraca de lint, lint de copy, `openapi:conferir` e `audit:endpoints`;
- integração no Postgres de dev: leitura 18/18 e reivindicação 4/4 (dois parceiros disputando, parceiro errado, parceiro desligado, concorrência);
- smokes contra a API do commit:
  - `smoke-reivindicar-acesso` 19/19 (P2 e P3, com a aprovação pela rota real do admin);
  - `smoke-receita-parceiro` 55/55;
  - `smoke-leitura-receita` 69/71, com a checagem nova da P1 no calendário passando.

**As duas falhas do smoke da leitura não são desta spec:**
- **Latência do POST, p95 de 1,8 a 2,1 s:** a linha de base, o commit anterior, também falha agora (1.760 ms). O caminho da leitura é o mesmo código nos dois commits.
- **Passo "transitória":** espera 1,5 s fixos, e o upload sozinho levou de 1,6 a 1,9 s hoje.

**Revisões antes do push:**
- **Auditoria de segurança:** 2 médios e 4 baixos, todos corrigidos ou registrados.
  - O vínculo na aprovação confere a D8.3 na própria aplicação, e cada vínculo trava a linha do parceiro (`FOR SHARE`).
  - Quem saiu da equipe não vincula.
  - Limite por origem (/64) em reivindicar e vincular.
  - O código do convite vai no fragmento.
  - Achados `SEG-2026-10-21-REIVINDICACAO-PARCEIRO-INATIVO` (corrigido) e `SEG-2026-10-21-CODIGO-ACESSO-NO-ANALYTICS` (aberto, correção no site, prazo 20/11).
- **Revisão de código:**
  - corrida reivindicar x aprovar resolvida com a releitura do parceiro dentro da trava;
  - autocorreção das reivindicações abertas de parceiro aprovado;
  - teto só com reivindicações vivas;
  - situação provisória na lista;
  - início no futuro não gera "começou em";
  - logs com a causa do erro;
  - testes de parceiro errado de verdade (integração e smoke) e da ligação do escritor (unitário).

**Desvios da v0.2:** o reivindicar responde 200 (não 202), a chave do 429 é `COMPARTILHAMENTO_REIVINDICACOES_LIMITE`, as migrations são `20261021200000` e `20261021200100`, e o convite usa `#acesso=` no lugar de `&acesso=`.

## Follow-ups

- Site: tirar o código do Google Analytics (`SEG-2026-10-21-CODIGO-ACESSO-NO-ANALYTICS`, guia de novembro, seção 2.4).
- Fila de auditoria do admin (CMS) mostrar quantas reivindicações abertas o cadastro tem: o risco aceito depende só do admin.
- Linha do tempo do pet com o "começou em" (depois que a sessão do portal fechar o `timeline.mapper.ts`).
- Smoke da leitura: trocar a espera fixa de 1,5 s do passo "transitória" por uma consulta repetida.
- Item "Não" (adesão) para o veterinário do acesso temporário: segue em aberto (pergunta abaixo).

## Plano de Rollout

- [ ] API primeiro, no `develop` (aditiva). O app e o site publicados seguem funcionando sem mudança.
- [ ] Migrations aplicadas no dev com `migrate deploy`, conferidas com `migrate status`. Em produção, junto do fast-forward para o master, quando o Nicolas pedir.
- [ ] Fronts pelo guia de novembro (Luís).

## Plano de Rollback

- Reverter os commits e fazer o redeploy. As migrations são aditivas: as colunas e a tabela podem ficar sem uso.
- Se for preciso remover:
  - `ALTER TABLE "LembreteSerie" DROP COLUMN "inicioInformadoEm", DROP COLUMN "dosesAntesDoApp";`
  - `DROP TABLE "ReivindicacaoAcesso"; DROP TYPE "ResultadoReivindicacao";`
  - e apagar as linhas das duas migrations em `_prisma_migrations`.

## Observabilidade

- **Log:**
  - `[Reivindicar] registrada parceiro=<id> comp=<id>`;
  - `[Reivindicar] aplicada parceiro=<id> comp=<id> resultado=<VINCULADO|VENCIDO|ENCERRADO|JA_VINCULADO>`;
  - `[Reivindicar] aplicar falhou parceiro=<id>` (erro, sem derrubar a aprovação);
  - `HANDOFF comp=<id> alertas=<bool>` sem mudança (as variantes não mudam o log).
- **Sem métrica nova.** A contagem sai da própria tabela.

## Definition of Done

- [ ] Todos os AC atendidos e verificados.
- [ ] Testes da estratégia passando: suíte inteira, integração no Postgres de dev, os 3 smokes e `qa:cenarios`.
- [ ] Typecheck, catraca de lint, lint de copy, `openapi:conferir` e `audit:endpoints` limpos no commit isolado.
- [ ] `security-auditor` e `/code-review` rodados, com os findings de correção resolvidos.
- [ ] Fluxo exercitado ponta a ponta na API local:
  - leitura com início, conferindo o calendário;
  - cadastro, reivindicar, aprovar e vínculo;
  - handoff com as 3 variantes.
- [ ] Handoff do front escrito em `docs/frontend/novembro-2026/`.
- [ ] Spec `Concluído`, CHANGELOG, memória e `/spec-sync`.

## Perguntas em Aberto

- [x] Host do portal: `portal.petjourney.health` (Nicolas, 2026-10-21). `web.petjourney.health` não existe; a sessão do portal foi avisada.
- [ ] O item "Não" para o veterinário do **acesso temporário**: a E4-05 cobre clínica com vínculo. Estender ao acesso temporário bate na D8.5 da Parte 8 ("o snapshot morre com o acesso"). Fica para outra spec? Responsável: Nicolas.
- [x] A linha do tempo do pet mostrar o "começou em": fica para depois que a sessão do portal fechar o `timeline.mapper.ts` (Nicolas concordou, 2026-10-21). Follow-up.

## Change Log

| Data | Versão | Mudança | Autor |
|---|---|---|---|
| 2026-10-21 | 0.1 | Criação. Pesquisa em três frentes (acesso e vínculo, histórico de doses, sobreposição com o portal) e três decisões do Nicolas: resumo das doses antes do app, vínculo na aprovação e 3 variantes de mensagem. | Claude |
| 2026-10-21 | 0.2 | Respostas do Nicolas: host do portal é `portal.petjourney.health` (`web.` não existe), linha do tempo fica para depois, aprovado para implementar e subir no develop. Status Em Implementação. | Claude |
| 2026-10-21 | 0.3 | Implementada e no `develop` (`ab2b964`, `79a0b81`). Correções da auditoria de segurança e da revisão de código antes do push; desvios e verificação na seção Entrega. Front em `docs/frontend/novembro-2026/parciais-acesso-e-receita.md`. | Claude |
