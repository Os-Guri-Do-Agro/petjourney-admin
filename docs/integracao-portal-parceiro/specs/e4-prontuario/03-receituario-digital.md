# Spec: Receituário digital (receita congelada, controle por regime, PDF, assinatura e verificação)

**Status:** In Review
**Autor:** Nicolas (via Claude)
**Criado em:** 2026-10-20
**Versão:** 0.1
**Épico:** [E4 prontuário](../../../../../epicos/portal-parceiro-e4-prontuario.md)
**Depende de:** [E4-01 atendimento](01-atendimento-e-prontuario.md), [E4-02 catálogos](02-catalogos-clinicos.md), [E1-03 profissionais](../e1-fundacao/03-profissionais-e-papeis.md), [E1-01 perfil](../e1-fundacao/01-perfil-publico-do-estabelecimento.md) (endereço do prescritor)

---

## Visão Geral

Do atendimento sai a receita:
- prescrições com dose calculada pelo peso e a conta visível, posologia (intervalo e duração, ou uso contínuo), via, instrução ao responsável, confirmação explícita de alergia e item crítico para a adesão;
- **assinar** congela uma cópia, gera o PDF no servidor, calcula o hash, emite o código verificador e grava o nome e o CRMV do prescritor como estavam;
- a receita controlada sai na folha certa para o regime de cada item;
- uma página pública confere a autenticidade pelo código;
- o responsável recebe a receita no resumo do atendimento, e ela vira lembrete com um toque (E4-05).

## Motivação

O doc 04 do portal entregou: conta visível, uso contínuo, alergia, peso ausente, "meio comprimido" em vez de "0,5", assinatura com CRMV congelada, código verificador sem `I` e `O`, validade de 30 dias, controle especial em folha separada com 1ª e 2ª via (Portaria 344/98), envio registrado e "repetir receita". O próprio doc diz o que falta: "na API real, o código verificador vira resumo criptográfico do documento" e "PDF assinado com verificação externa".

---

## Research Findings

- **Do portal:**
  - `Prescription`, `DoseCalc` (mg/kg, peso, mg por administração, quantidade, frequência, `duracaoDias` nulo = contínuo, total), `Receita` (cópia das prescrições, `rascunho`, `assinada`, `enviada`, validade, `controlada`, assinatura, `enviadaEm`) e `AssinaturaEletronica` (`types.ts:855-901`, `:1325-1375`);
  - `domain/receita.ts` (`passosDaConta`, `fracionar`, `VALIDADE_EM_DIAS=30`, `gerarCodigoVerificador`);
  - vias de administração e frações de dose do contrato (`contrato/responsavel.ts:299-325`).
- **Regras externas** (épico pai, LGPD e regulatório):
  - Res. CFMV 1.465/2022: assinatura avançada (sem ICP, com autoria e integridade) e qualificada (ICP-Brasil).
  - Controlado de uso veterinário segue o MAPA (Portaria 837/2025); de uso humano, Anvisa (Portaria 344/98, SNCR, RDC 873/2024).
  - Itens que exigem **Notificação de Receita** (listas A e B da 344, talonário numerado oficial) não se emitem por sistema, salvo o canal eletrônico oficial: pergunta Q-JUR3.
- **API:**
  - Não há biblioteca de PDF no `package.json` (inventário 6).
  - O bucket privado `anexos-consulta` já serve anexos com URL assinada de 1 h.
  - Na publicação, a receita do app é `ConsultaPrescricaoItem` + `ConsultaAnexo` categoria RECEITA (P5 da receita com IA).
  - A D-DOC revista manda a receita **lida por IA** sempre para Documentos (bucket público).

**Breaking changes:** nenhuma.

## Decisões

- **D1 Assinar congela.** A receita é cópia da conduta no instante da assinatura (decisão do portal). Mudar a dose depois exige nova receita; a antiga continua válida até ser **cancelada** com motivo.
- **D2 PDF no servidor.** Dependência nova: `pdf-lib` (sem binário nativo, roda no Railway). O PDF assinado é o documento; o hash SHA-256 dele vai no rodapé (impresso como código curto) e na tabela.
- **D3 Assinatura avançada na v1.** Ela é composta por:
  - autoria por login com senha e confirmação de senha no ato de assinar (reautenticação);
  - registro de IP e instante;
  - hash do PDF;
  - código verificador de 10 caracteres sem `I`, `O`, `0` e `1`;
  - página pública de verificação.

  A receita diz no rodapé "Assinatura eletrônica avançada (Res. CFMV 1.465/2022)". A qualificada (ICP-Brasil, por provedor) é item do E9. Nenhuma copy diz "assinado digitalmente com certificado" na v1.
- **D4 Folha por regime.**
  - Itens `NENHUM` vão na receita simples.
  - Itens `MAPA_VETERINARIO` ou `ANVISA_HUMANO` com lista que admite receita de controle especial (C1 e afins) vão na **receita de controle especial** em 2 vias, com identificação do prescritor (nome, CRMV, endereço completo do estabelecimento) e do comprador (nome, documento, endereço do cliente da E2-01).
  - Itens que exigem Notificação de Receita (listas A e B) **não** saem por sistema: a tela recebe `exigeNotificacaoOficial: true` e o item fica fora do PDF, com a instrução de usar o talonário oficial. Fica assim até o parecer Q-JUR3.
- **D5 Endereço obrigatório onde a norma pede.** Assinar receita de controle especial sem endereço do estabelecimento publicado ou sem endereço do comprador dá 422 `ENDERECO_OBRIGATORIO_NA_RECEITA`, com o que falta.
- **D6 Entrega ao responsável pela publicação.**
  - O PDF fica no bucket privado do parceiro e aparece no resumo do atendimento (`GET /tutor/clinica/atendimentos/:id`) com URL assinada.
  - "Salvar nos documentos" é **um toque do responsável** (A2).
  - Diferente da D-DOC da leitura de receita, aqui a receita não vai sozinha para o bucket público: o arquivo já está no app, privado, e copiá-lo para Documentos é escolha dele.
- **D7 Verificação pública mínima.** `GET /public/receitas/:codigo` mostra: válida ou cancelada, data, validade, nome do estabelecimento, nome e CRMV do prescritor, nomes dos medicamentos e quantidades, nome do paciente e as iniciais do responsável. Não mostra endereço, CPF nem diagnóstico. Throttle de 20 por minuto, 404 genérico.
- **D8 Alergia e espécie proibida exigem confirmação** (`alergiaConfirmada`, `proibidoConfirmado`) na prescrição; repetir receita copia com ids novos e **sem** herdar confirmações (decisão do portal).

## Modelo de dados (aditivo)

```prisma
enum StatusReceita { RASCUNHO ASSINADA CANCELADA }
enum FolhaReceita { SIMPLES CONTROLE_ESPECIAL }

model PrescricaoDoAtendimento {
  id                  String   @id @default(cuid())
  atendimentoId       String
  medicamentoId       String?  // catálogo (global ou do parceiro)
  nomeLivre           String?  // quando não é do catálogo
  via                 String   // ORAL | SUBCUTANEA | INTRAMUSCULAR | INTRAVENOSA | TOPICA | OTOLOGICA
  mgPorKg             Decimal? @db.Decimal(8, 3)
  pesoKg              Decimal? @db.Decimal(6, 2)
  mgPorAdministracao  Decimal? @db.Decimal(10, 3)
  quantidade          Decimal? @db.Decimal(8, 3)
  unidade             String?  // COMPRIMIDO | ML | GOTA | APLICACAO
  fracao              String?  // INTEIRO | MEIO | ... | APROXIMADO
  frequenciaHoras     Int
  duracaoDias         Int?     // null = uso contínuo
  instrucoes          String?  // o que o responsável lê
  alergiaConfirmada   Boolean  @default(false)
  proibidoConfirmado  Boolean  @default(false)
  critico             Boolean  @default(false) // E4-05
  ordem               Int
}

model Receita {
  id                 String        @id @default(cuid())
  parceiroId         String
  atendimentoId      String
  pacienteId         String
  status             StatusReceita @default(RASCUNHO)
  folhas             FolhaReceita[]
  itens              Json          // cópia congelada das prescrições na assinatura
  emitidaEm          DateTime?
  validaAte          DateTime?     @db.Date
  prescritorNome     String?
  prescritorCrmv     String?       // "CRMV-SP 12345" congelado
  prescritorProfissionalId String?
  estabelecimentoEndereco String?  // congelado
  compradorNome      String?
  compradorDocumento String?
  compradorEndereco  String?
  pdfCaminho         String?       // bucket privado do parceiro
  hashSha256         String?
  codigoVerificador  String?       @unique
  assinadaDeIp       String?       // retenção de 5 anos, nunca em log
  canceladaEm        DateTime?
  motivoCancelamento String?
  @@index([parceiroId, emitidaEm])
}
```

## Rotas

| Método e rota | Permissão | Descrição |
|---|---|---|
| `POST/PATCH/DELETE /parceiro/portal/clinica/atendimentos/:id/prescricoes[/:pid]` | `prontuario.escrever` | Itens com validação de dose (E4-02 `calcular`) |
| `POST /parceiro/portal/clinica/atendimentos/:id/receitas` | `prontuario.escrever` | Rascunho a partir das prescrições |
| `POST /parceiro/portal/clinica/receitas/:id/assinar` | `receita.assinar` | `{ senha }` (reautenticação); gera PDF, hash, código; 422 `ENDERECO_OBRIGATORIO_NA_RECEITA`; itens com notificação oficial saem fora e voltam listados |
| `GET /parceiro/portal/clinica/receitas/:id/pdf` | `prontuario.ler` | URL assinada de 15 min |
| `POST /parceiro/portal/clinica/receitas/:id/cancelar` | `receita.assinar` | `{ motivo }` |
| `POST /parceiro/portal/clinica/receitas/:id/repetir` | `prontuario.escrever` | Nova receita (rascunho) num atendimento novo ou no atual |
| `GET /public/receitas/:codigo` | público, `// PUBLIC:` | D7 |
| `GET /tutor/clinica/documentos/:id/url` e `POST /tutor/clinica/documentos/:id/salvar-nos-documentos` | dono | Receita no resumo (contrato do portal); salvar é idempotente (`jaExistia`) |

## Acceptance Criteria

- [ ] **Given** uma receita assinada **When** a dose da prescrição muda no atendimento **Then** a receita não muda (cópia congelada) e a tela oferece nova receita.
- [ ] **Given** assinar sem a senha correta **Then** 401 e nada é gerado.
- [ ] **Given** item com controle especial e cliente sem endereço **Then** 422 com `faltando: ['compradorEndereco']`.
- [ ] **Given** item de lista que exige Notificação de Receita **Then** ele fica fora do PDF e a resposta traz `exigeNotificacaoOficial`.
- [ ] **Given** o código verificador **When** a farmácia abre `/public/receitas/:codigo` **Then** vê validade e prescritor, sem CPF, endereço nem diagnóstico; receita cancelada aparece como cancelada.
- [ ] **Given** o hash gravado **Then** o SHA-256 do PDF baixado é igual (teste).
- [ ] **Given** uso contínuo **Then** a receita imprime "uso contínuo" e `duracaoDias` sai ausente no item publicado no app (regra do doc 06 do portal: omitir, não `null`).
- [ ] O código verificador nunca tem `I`, `O`, `0` nem `1`.
- [ ] Repetir não herda `alergiaConfirmada` nem `proibidoConfirmado`.

## Estratégia de Testes

- Unit: congelamento, folhas por regime, endereço obrigatório, código verificador, hash, verificação pública (forma), repetir.
- Integration: PDF gerado e baixado com hash igual.
- Cenários: outro parceiro baixando PDF (403), código inexistente (404 genérico).

## Arquivos Impactados

| Arquivo | Ação |
|---|---|
| `package.json` | `pdf-lib` |
| `prisma/schema.prisma` + migration | Modificar |
| `src/receituario/` (controllers, service, `pdf/` com moldes da receita simples e da controlada, `regras/folhas.ts`, verificação pública) | Criar |
| Bucket privado do parceiro (`SUPABASE_PARCEIRO_DOCUMENTOS_BUCKET`) | Criar no Supabase |

## Gates de produção

- [ ] Parecer jurídico Q-JUR2 e Q-JUR3 (épico pai) antes de ligar a receita para cliente real.

## Tasks

- [ ] **T1** Migration + bucket
- [ ] **T2** Prescrições com validação de dose
- [ ] **T3** Assinatura com reautenticação, PDF, hash e código
- [ ] **T4** Folhas por regime e endereço obrigatório
- [ ] **T5** Verificação pública, cancelar, repetir
- [ ] **T6** Entrega no resumo, salvar nos documentos, testes, handoff

## Riscos e Mitigações

| Nível | Risco | Mitigação |
|---|---|---|
| Alto | Receita sem validade jurídica circulando como válida | Gate jurídico (Q-JUR2, Q-JUR3), rodapé dizendo o nível de assinatura, itens de Notificação de Receita fora do PDF |
| Alto | PDF e hash divergirem (documento adulterado sem detecção) | Hash do PDF final gravado na mesma transação; teste que baixa e recalcula; PDF só no bucket privado |
| Médio | Biblioteca de PDF falhar com acentos | `pdf-lib` com fonte embutida de latim estendido; teste com nomes acentuados; receita em pt-BR na v1 |

## Rollout / Rollback

Aditivo e atrás do módulo, com o gate jurídico do épico pai antes de ligar para cliente real. Rollback reverte o código; receitas já emitidas continuam verificáveis pela rota pública (não remover a rota no rollback).

## Change Log

| Data | Versão | Mudança | Autor |
|---|---|---|---|
| 2026-10-20 | 0.1 | Criação | Nicolas (via Claude) |
