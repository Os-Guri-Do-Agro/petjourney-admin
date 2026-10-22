# Spec: Migrador da base da clínica (importação em lotes, com relatório e desfazer)

**Status:** In Review
**Autor:** Nicolas (via Claude)
**Criado em:** 2026-10-20
**Versão:** 0.1
**Épico:** [E2 pacientes e ponte](../../../../../epicos/portal-parceiro-e2-pacientes-e-ponte.md)
**Depende de:** [E2-01 clientes e pacientes](01-clientes-e-pacientes.md), [E1-04 contrato](../e1-fundacao/04-contrato-erros-e-rotas-publicas.md)

---

## Visão Geral

Trazer a base de outro sistema (SimplesVet, Vetus, planilha do balcão) para `ClienteDoParceiro` e `PacienteDoParceiro`, sem perder dado calado:
- o portal lê o arquivo e normaliza as linhas;
- a API revalida cada linha, procura duplicados **contra a base no servidor**, devolve as dúvidas que só a clínica resolve e congela o plano;
- a gravação roda em lotes num job retomável, com relatório por linha e desfazer.

## Motivação

"É a funcionalidade que decide a venda... Nenhuma clínica troca de sistema se tiver que redigitar quinze anos de pacientes" (doc 11 do portal). O protótipo já é real no que importa: leitura de `.xlsx` sem biblioteca e de `.csv`, leitura de datas, telefones, pesos e CPF estragados pelo Excel, plano, duplicados e relatório (`petjourney-admin/src/features/clinico/domain/migracao.ts`, 2875 linhas, 20 testes; `domain/planilha.ts`, 8 testes; `data/leitura-de-planilha.ts`, 5 testes).

---

## Research Findings

- **Portal (lido):**
  - O planejador recebe a base inteira da clínica (`migracaoRepository.base()`, `data/repositories/migracao-repository.ts:121-126`) e acha duplicados no navegador. Com base real, isso baixaria todos os clientes e pacientes, com CPF e telefone, para o browser.
  - A gravação é em lotes de 80 (`importarLote`) com mapa de vínculos entre linhas.
  - Regras do doc 11:
    - CPF ou telefone igual junta por padrão;
    - só o nome igual vira pergunta;
    - mesmo animal do mesmo responsável junta;
    - juntar só preenche o que está em branco;
    - animal falecido não entra;
    - dado errado vira branco com o motivo;
    - o plano congela no começo da importação.
  - O doc 11 lista o que falta: desfazer, código do sistema anterior, castrado "não informado" (resolvido pela E2-01 D3), continuar depois de recarregar e de outro aparelho.
  - O reconhecimento de SimplesVet e Vetus é **presumido** (montado sem arquivo real).
- **API:**
  - Não há biblioteca de xlsx (inventário 6).
  - Padrão de processamento em segundo plano com claim condicional e cron de retomada: `outreach-importacao.service.ts:58-109` e `leitura-receita` (T1 daquele épico, 3 réplicas).
  - Trava de prod para scripts.

**Breaking changes:** nenhuma.

## Decisões

- **D1 O arquivo fica no navegador.** O portal continua lendo e normalizando (o código é dele e funciona, e não há lib de xlsx na API). O arquivo não sobe. A API recebe linhas normalizadas e **revalida tudo** com o porte das funções de valor (CPF, telefone, data, peso, espécie), sem confiar no cliente.
- **D2 Duplicados contra a base no servidor.** O portal deixa de receber a base. A API devolve as dúvidas de duplicidade contra o que já existe, com a menor exposição possível: nome, telefone mascarado e nomes dos animais do candidato. Duplicados **dentro** do arquivo, a API também confere quando todas as linhas estão no staging.
- **D3 Plano congelado em staging.** As linhas ficam numa tabela de staging até o "Importar". Depois, o plano não muda, e o job grava em lotes de 80 com claim condicional (3 réplicas) e cron de retomada de 10 min.
- **D4 Tudo o que nasce leva `importacaoId`.** É isso que torna o desfazer possível. Juntar guarda os campos preenchidos e o valor anterior (nulo), para o desfazer devolver.
- **D5 Desfazer conservador.** Remove o que a importação criou e ainda não tem nenhum registro posterior (agendamento, atendimento, vacina, estadia); devolve a branco o que ela preencheu e ninguém mudou depois. O resto fica, listado no relatório do desfazer.
- **D6 Código do sistema anterior.** `codigoNaOrigem` no paciente e no cliente (opcional), para a clínica achar "o 3021 do Vetus".
- **D7 Retenção do staging.** As linhas cruas do staging (com PII) somem 30 dias depois do fim da importação; fica só o mapa linha para destino e motivo.
- **D8 Convite em lote depois.** Ao fim, a clínica pode propor vínculo (E2-02, canal e-mail) aos clientes com e-mail, em lote, respeitando o teto diário.

## Modelo de dados (aditivo)

```prisma
enum StatusImportacao { RECEBENDO_LINHAS COM_DUVIDAS PRONTA PROCESSANDO PAUSADA CONCLUIDA FALHOU DESFEITA }
enum DestinoDaLinha   { ENTRA JUNTA_EXISTENTE JUNTA_LINHA CONTATO FORA DUVIDA }

model ImportacaoDeBase {
  id             String           @id @default(cuid())
  parceiroId     String
  arquivoNome    String
  hashArquivo    String           // sha256 calculado no portal, para avisar reimportação do mesmo arquivo
  origemDetectada String?         // SIMPLESVET | VETUS | PLANILHA
  totalLinhas    Int
  status         StatusImportacao @default(RECEBENDO_LINHAS)
  processadas    Int              @default(0)
  criados        Int              @default(0)
  juntados       Int              @default(0)
  foraCount      Int              @default(0)
  claimEm        DateTime?
  iniciadaPorId  String
  criadaEm       DateTime         @default(now())
  concluidaEm    DateTime?
  desfeitaEm     DateTime?
  @@index([parceiroId, criadaEm])
}

model LinhaDeImportacao {
  importacaoId     String
  numeroLinha      Int
  dados            Json?          // normalizado; apagado 30 dias após o fim (D7)
  destino          DestinoDaLinha
  alvoClienteId    String?
  alvoPacienteId   String?
  juntaComLinha    Int?
  motivos          String[]       // códigos: CPF_INVALIDO, TELEFONE_SEM_DDD_CORRIGIDO, ANIMAL_FALECIDO...
  duvida           Json?          // tipo e candidatos mascarados
  resposta         String?
  camposPreenchidos Json?         // D4
  gravadaEm        DateTime?
  @@id([importacaoId, numeroLinha])
}
```

`ClienteDoParceiro` e `PacienteDoParceiro` já têm `importacaoId` (E2-01); ganham `codigoNaOrigem String?`.

## Rotas (`@ExigeModulo`, `@ExigePermissao('importacao.executar')`)

| Método e rota | Descrição |
|---|---|
| `POST /parceiro/portal/importacoes` | `{ arquivoNome, hashArquivo, origemDetectada?, totalLinhas }` → `{ id, jaImportadoEm? }` (avisa se o mesmo hash já foi importado) |
| `POST /parceiro/portal/importacoes/:id/linhas` | Até 500 linhas normalizadas por chamada, com `Idempotency-Key`; responde o destino proposto de cada uma (revalidada) |
| `GET /parceiro/portal/importacoes/:id/duvidas` | Dúvidas de duplicidade contra a base e dentro do arquivo, uma por vez ou todas |
| `POST /parceiro/portal/importacoes/:id/respostas` | `[{ numeroLinha, resposta: 'MESMA_PESSOA' \| 'PESSOAS_DIFERENTES' \| 'JUNTAR_AO' (id) \| 'DEIXAR_DE_FORA' }]`; toda dúvida tem resposta segura |
| `GET /parceiro/portal/importacoes/:id/resumo` | As três caixas: entram, ajustadas, não entram; com contagens por motivo |
| `POST /parceiro/portal/importacoes/:id/confirmar` | Congela o plano e inicia o job (409 se houver dúvida sem resposta) |
| `POST /parceiro/portal/importacoes/:id/pausar` e `/continuar` | Pausa entre lotes |
| `GET /parceiro/portal/importacoes/:id` | Status e progresso (para retomar de outro aparelho) |
| `GET /parceiro/portal/importacoes/:id/linhas?destino=&cursor=` | Relatório por linha (frases montadas no portal a partir dos códigos de motivo) |
| `POST /parceiro/portal/importacoes/:id/desfazer` | D5, com relatório do que ficou |
| `POST /parceiro/portal/importacoes/:id/propor-vinculos` | D8 |
| `GET /parceiro/portal/importacoes` | Histórico |

Aviso à equipe ao concluir (`IMPORTACAO_CONCLUIDA`, para quem iniciou) pela E1-06, e contador de importação pausada.

## Acceptance Criteria

- [ ] **Given** uma linha com CPF que não fecha os dígitos **When** enviada **Then** o CPF fica em branco, a linha entra, e o motivo `CPF_INVALIDO` aparece no relatório.
- [ ] **Given** um cliente da base com o mesmo CPF da linha **Then** destino `JUNTA_EXISTENTE` sem pergunta, preenchendo só campos em branco.
- [ ] **Given** só o nome igual a um cliente da base **Then** a linha vira `DUVIDA`, e o candidato aparece com telefone mascarado e nomes dos animais, sem CPF.
- [ ] **Given** uma linha "animal falecido" **Then** destino `FORA` com motivo `ANIMAL_FALECIDO`.
- [ ] **Given** `confirmar` com dúvida pendente **Then** 409 `IMPORTACAO_COM_DUVIDAS`.
- [ ] **Given** a importação em andamento e uma réplica caindo **Then** o cron retoma do último lote gravado sem duplicar (claim condicional).
- [ ] **Given** desfazer **Then** somem os pacientes e clientes criados sem registro posterior, e os campos preenchidos por junção voltam a branco quando ninguém os mudou; o resto vem listado.
- [ ] As planilhas de demonstração do portal (`data/fixtures/planilhas-de-demonstracao.ts`: 39 linhas, ~120 do SimplesVet presumido, 2.400 do Vetus presumido) passam ponta a ponta contra a API com o mesmo resumo do protótipo (33 entram, 18 corrigidas, 4 não entram, na de 39 com as respostas do roteiro).
- [ ] Linhas cruas do staging não existem mais 30 dias depois do fim (cron).

## Estratégia de Testes

- Unit: funções de valor portadas (golden tests do `migracao.spec.ts` do portal), dedup contra a base e dentro do arquivo, desfazer.
- Integration: job com 2.400 linhas, pausa e retomada, réplica concorrente.
- Smoke: `scripts/smoke-importacao.ts` com a planilha de 39 linhas contra dev (trava de prod).

## Arquivos Impactados

| Arquivo | Ação |
|---|---|
| `prisma/schema.prisma` + migration | Modificar |
| `src/importacao-de-base/` (controller, service, job/cron, `regras/valores.ts`, `regras/duplicados.ts`) | Criar |
| `scripts/smoke-importacao.ts` | Criar |

## Tasks

- [ ] **T1** Migration
- [ ] **T2** Porte das funções de valor + golden tests *(T1)*
- [ ] **T3** Recebimento de linhas, revalidação, dedup, dúvidas, respostas, resumo *(T2)*
- [ ] **T4** Confirmar, job em lotes, pausa, retomada, aviso *(T3)*
- [ ] **T5** Desfazer e retenção do staging *(T4)*
- [ ] **T6** Propor vínculos em lote *(T4, E2-02)*
- [ ] **T7** Smoke, handoff (o portal para de pedir a base inteira e passa a perguntar as dúvidas do servidor)

## Riscos e Mitigações

| Nível | Risco | Mitigação |
|---|---|---|
| Alto | Importação calada que perde dado | Relatório por linha obrigatório, códigos de motivo, "baixar as linhas que não entraram" continua no portal, desfazer |
| Médio | Reconhecimento de SimplesVet e Vetus errado (presumido) | Antes de vender "importa do SimplesVet", conferir com export real (pergunta em aberto); o mapeamento de colunas é do portal, a API não depende dele |
| Médio | PII em staging | Retenção de 30 dias (D7) e acesso só por `importacao.executar` |

## Perguntas em Aberto

- [ ] Conseguir um export real de SimplesVet e de Vetus (anonimizado) para conferir o reconhecimento. Responsável: Nicolas.
- [ ] Importar histórico clínico (vacinas, consultas, pesos) na v2: arquivos e mapeamento próprios (fora desta spec).

## Rollout / Rollback

Aditivo e atrás do módulo. Importação real em prod só depois do smoke com a planilha de 39 linhas em dev. Rollback do código não desfaz importações já feitas: para isso existe o desfazer (D5).

## Change Log

| Data | Versão | Mudança | Autor |
|---|---|---|---|
| 2026-10-20 | 0.1 | Criação | Nicolas (via Claude) |
