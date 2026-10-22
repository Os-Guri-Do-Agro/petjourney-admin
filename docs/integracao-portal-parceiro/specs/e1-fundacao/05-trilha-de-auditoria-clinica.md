# Spec: Trilha de auditoria clínica (quem leu, escreveu, publicou ou exportou)

**Status:** Concluído (API em dev, 2026-10-21; front em novembro com o Luís)
**Autor:** Nicolas (via Claude)
**Criado em:** 2026-10-20
**Versão:** 0.4
**Épico:** [E1 fundação](../../../../../epicos/portal-parceiro-e1-fundacao.md)
**Depende de:** [E1-03 profissionais e papéis](03-profissionais-e-papeis.md)

---

## Visão Geral

Uma trilha append-only, por parceiro, de toda ação sobre dado clínico ou de hospedagem: leitura de prontuário e de dado do app (diário, peso, carteirinha), criação, alteração, finalização, anulação, publicação no app, impressão e exportação. O parceiro consulta a dele; o responsável vê no app quando a clínica leu o que ele liberou; o suporte da PetJourney só acessa dado de clínica por protocolo.

## Motivação

- Prontuário multiusuário sem trilha não responde "quem mexeu na consulta" nem "quem viu o diário do meu pet". O inventário confirma que não existe log genérico de acesso a prontuário (seção 1.11).
- CFMV: autoria por procedimento (art. 9, VIII da Res. 1.321/2020). LGPD: o operador (PetJourney) precisa demonstrar o tratamento feito em nome do controlador (o parceiro), e o titular (o responsável) tem direito a saber quem acessou o dado que ele compartilhou.
- Padrão já aceito no repo: `AberturaArquivoCompartilhado` e `MudancaConsentimentoCompartilhamento` (append-only, sem IP/UA) e o fim da chave-mestra do admin (D14.2).

---

## Research Findings

- Trilhas existentes: `ProtocoloAdmin` (`prisma/schema.prisma:2971-3010`), `AberturaArquivoCompartilhado` (`:2186`), `MudancaConsentimentoCompartilhamento` (`:2157`), com expurgo por cron (`src/compartilhamento-prestador/trilha-abertura.cron.ts:50`, `TRILHA_ABERTURA_RETENCAO_MESES`).
- D14.2: admin não lê prontuário compartilhado pelas rotas do tutor.
- Logs estruturados sem PII (`vazamentos-pii.spec.ts`, padrão `[Modulo] ACAO chave=valor`).

**Breaking changes:** nenhuma.

## Decisões

- **D1 Trilha separada do log.** Tabela própria, não Pino: é dado de produto (o parceiro e o responsável consultam), não telemetria.
- **D2 Escrita na mesma transação das mutações; leitura em lote assíncrono.** Mutação clínica sem trilha não pode existir (rollback junto). Leitura grava por um buffer em memória com flush a cada 5 s ou 200 eventos, aceitando perder leituras num crash (documentado), para não pôr uma escrita em cada GET.
- **D3 Sem conteúdo clínico na trilha.** Só ids, tipo de recurso, ação e o campo alterado (nome do campo, nunca o valor). Sem IP nem user agent, como as trilhas atuais.
- **D4 Retenção.** Enquanto o contrato do parceiro existir e por mais 5 anos depois (prazo provisório, alinhar com a Q-JUR1 do épico pai); expurgo por cron com advisory lock.
- **D5 Suporte por protocolo.** Leitura de dado do parceiro pela equipe da PetJourney só pelas rotas de admin, que exigem um `ProtocoloAdmin` (`TipoAcaoAdmin.SUPORTE_PARCEIRO`, novo) e gravam na trilha com `ator=SUPORTE`.

### Decisões da auditoria de segurança da onda 1 (2026-10-21)

- **D6 `@Auditar` só para leitura** (achado B9). O decorator grava depois do handler e fora da transação, então mutação por ele contrariava a D2. O tipo aceita só `LER`, `LER_DADO_DO_APP`, `IMPRIMIR` e `EXPORTAR` (`AcaoDeLeitura`), e a conferência roda no carregamento da classe: mutação passada por cast derruba o boot, não a primeira requisição. `TrilhaClinicaService.registrar` e `registrarLeitura` também recusam mutação; mutação grava só por `registrarNaTransacao`.
- **D7 O parceiro não vê o nome de quem é da PetJourney** (achado B10). Na trilha do parceiro, evento `ator=SUPORTE` sai com `usuario.nome = null` (o nome nem é lido); o front mostra "Suporte PetJourney" com o `protocolo`. A rota do admin (`GET /admin/parceiro/:id/trilha`) continua vendo o nome.
- **D8 O `motivo` do protocolo SUP não vai para o log** (achado M11). Ele chega na query (`?motivo=`) e o `[HTTP]` registra a URL inteira: `motivo` entrou nos parâmetros redigidos do `logger.middleware.ts` (fica `motivo=***`). Levar o motivo para o corpo seria a correção completa, mas muda o contrato do CMS (follow-up).
- **D9 A trilha do paciente exige um módulo** (achado B11). `GET /parceiro/portal/pacientes/:pacienteId/auditoria` ganhou `ModuloGuard` + `@ExigeModulo(QUALQUER_MODULO)` (leitura: vale com o módulo suspenso ou desligado).

## Modelo de dados (aditivo)

```prisma
enum AcaoTrilha { LER CRIAR ALTERAR FINALIZAR ANULAR PUBLICAR IMPRIMIR EXPORTAR LER_DADO_DO_APP }
enum AtorTrilha { EQUIPE SUPORTE SISTEMA }

model TrilhaClinica {
  id             String     @id @default(cuid())
  parceiroId     String
  ator           AtorTrilha @default(EQUIPE)
  usuarioId      String?    // quem clicou
  profissionalId String?    // em nome de quem (E1-03)
  acao           AcaoTrilha
  recursoTipo    String     // "atendimento", "receita", "aplicacao-vacina", "diario-do-app"...
  recursoId      String
  pacienteId     String?    // E2-01
  petId          String?    // quando o recurso é do app (leitura com consentimento)
  campos         String[]   // nomes dos campos alterados
  protocolo      String?    // ação de suporte
  em             DateTime   @default(now())
  @@index([parceiroId, em])
  @@index([pacienteId, em])
  @@index([petId, em])
}
```

## Rotas

| Método e rota | Quem | Descrição |
|---|---|---|
| `GET /parceiro/portal/auditoria` | `auditoria.ler` | Filtros `pacienteId`, `usuarioId`, `profissionalId`, `acao`, `de`, `ate`; cursor |
| `GET /parceiro/portal/pacientes/:pacienteId/auditoria` | `auditoria.ler` | Atalho por paciente |
| `GET /tutor/clinica/clinicas/:parceiroId/acessos?petId=` | dono do pet | Só `LER_DADO_DO_APP` e `PUBLICAR` daquele pet por aquela clínica: data, tipo (diário, peso, carteirinha) e nome do profissional quando houver |

Decorator `@Auditar('atendimento', AcaoTrilha.LER)` para handlers que só leem (D6); serviço `TrilhaClinicaService.registrarNaTransacao(tx, evento)` para toda mutação, dentro do service.

## Acceptance Criteria

- [x] **Given** uma alteração de atendimento **When** a transação falha **Then** nem o atendimento nem a trilha mudam. *Integração com Postgres real (`registrarNaTransacao`).*
- [x] **Given** a clínica lê o diário do app de um pet (E2-03) **Then** o dono do pet vê o evento em `GET /tutor/clinica/clinicas/:id/acessos` com a data e o tipo, sem o conteúdo. *Rota e recorte prontos e testados (unit); a leitura do E2-03 entra com `@Auditar` quando a rota dele existir.*
- [x] **Given** um evento de trilha **Then** ele não tem valor de campo clínico, IP ou user agent (teste de forma que varre o JSON).
- [x] **Given** suporte lendo um atendimento pela rota de admin sem protocolo **Then** 400; com protocolo **Then** 200 e evento `ator=SUPORTE` com o código do protocolo. *Hoje o suporte lê a trilha (`GET /admin/parceiro/:parceiroId/trilha?motivo=`); o atendimento do E4 usa o mesmo `registrarAcessoDeSuporte`. Protocolo SUP e `ator=SUPORTE` provados na integração; o 400 sem `motivo` (e com motivo curto) conferido pela rota em `trilha-suporte.controller.spec.ts`.*
- [x] Membro sem `auditoria.ler` recebe 403 na rota do parceiro. *`@ExigePermissao('auditoria.ler')` nas duas rotas; guard e matriz testados no E1-03.*

## Estratégia de Testes

- Unit: buffer de leitura (flush por tempo e por volume), forma do evento (sem PII), filtros.
- Integration: rollback conjunto da mutação e da trilha.
- Cenário: responsável de outro pet pedindo a trilha (403).

## Arquivos Impactados

| Arquivo | Ação |
|---|---|
| `prisma/schema.prisma` + migration | Modificar (`TrilhaClinica`, enums, `TipoAcaoAdmin.SUPORTE_PARCEIRO`) |
| `src/trilha-clinica/` (module, service, decorator, interceptor, controller, cron de expurgo) | Criar |
| `src/common/protocolo/protocolo.constants.ts` | Modificar (prefixo novo) |

## Tasks

- [x] **T1** Migration + service com escrita transacional
- [x] **T2** Buffer de leitura + decorator *(T1)*
- [x] **T3** Rotas do parceiro e do responsável *(T1)*
- [x] **T4** Suporte com protocolo *(T1)*
- [x] **T5** Expurgo + testes

## Rollout / Rollback

Aditivo. Rollback reverte o código; a tabela fica.

## Riscos e Mitigações

| Nível | Risco | Mitigação |
|---|---|---|
| Médio | Volume da trilha crescer rápido (toda leitura de prontuário grava) | Leitura em lote assíncrono (D2), índices por parceiro e data, expurgo por cron; medir o tamanho por mês no primeiro trimestre |
| Médio | Trilha virar vazamento (conteúdo clínico em `campos` ou no detalhe) | D3: só nomes de campo e ids; teste de forma que varre os eventos |

## Change Log

| Data | Versão | Mudança | Autor |
|---|---|---|---|
| 2026-10-20 | 0.1 | Criação | Nicolas (via Claude) |
| 2026-10-21 | 0.2 | Implementação (T1 a T5); suporte lê a trilha com `motivo` na query (protocolo SUP); o 400 por HTTP fica para o gate G1 | Claude |
| 2026-10-21 | 0.3 | Auditoria de segurança da onda 1: D6 (`@Auditar` só leitura; B9), D7 (nome do suporte oculto ao parceiro; B10), D8 (`motivo` redigido no log; M11), D9 (trilha do paciente exige módulo; B11) | Claude |
| 2026-10-21 | 0.4 | Gate G1: o 400 do suporte sem `motivo` provado pela rota (`trilha-suporte.controller.spec.ts`, Fastify real com o ValidationPipe do main.ts); concluída do lado da API | Claude |
