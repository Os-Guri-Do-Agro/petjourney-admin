# Spec: Anamnese por voz (transcrição no servidor e estruturação com citação)

**Status:** In Review
**Autor:** Nicolas (via Claude)
**Criado em:** 2026-10-20
**Versão:** 0.1
**Épico:** [E4 prontuário](../../../../../epicos/portal-parceiro-e4-prontuario.md)
**Depende de:** [E4-01 atendimento](01-atendimento-e-prontuario.md)
**Onda:** 4 (depois do bench e do LIA)

---

## Visão Geral

O veterinário conversa com o responsável. A conversa vai do microfone do portal para a API e é transcrita por um provedor de fala com contrato de operador. Um modelo de linguagem propõe a anamnese estruturada, em que cada campo traz o trecho exato de onde veio e alertas (interferência, confiança baixa, duas versões, deduzido e não dito, sem origem). O veterinário aprova item a item. O áudio não é guardado.

## Motivação

- "É o efeito imediato mais forte da demonstração e ataca a dor número um do vet: tempo de digitação" (doc 10 do portal).
- O protótipo usa o `SpeechRecognition` do navegador. No Chrome, o áudio da consulta, com a voz do responsável, vai ao serviço do Google sem contrato de operador da PetJourney. A estruturação usa um motor local de regras (`domain/escuta.ts`, 31 testes).
- O próprio doc diz: "Trocar o motor de regras por um modelo é trocar `extrairDaConversa`; a verificação fica."

---

## Research Findings

- **Tipos do portal:**
  - `TrechoDaConversa { id, falante, texto, emMs, confianca, interferencia }` (`types.ts:1938-1974`);
  - `PropostaDaEscuta` com citação `{ trechoId, inicio, fim }` e modo `dito` ou `deduzido`;
  - `ALERTAS_DA_PROPOSTA`;
  - `LIMIAR_DE_CONFIANCA = 0,7`;
  - campos simples substituem, história soma, antecedente soma sem repetir;
  - "nada nasce marcado" (`domain/escuta.ts:46-1220`).
- **Casos difíceis do doc 10, que viram golden set:**
  - latido que troca "dois" por "dez";
  - mãe e filha discordando;
  - "vacina da raiva em março" virando "vacinação em dia", marcado deduzido;
  - hipótese diagnóstica ouvida e **não** preenchida;
  - peso de casa que não vira vital.
- **Padrão da API para IA:** a leitura de receita usa a Anthropic atrás de uma porta (`ExtratorReceita`), saída por JSON Schema revalidada com class-validator, tetos e orçamento diário, bench antes de prod e LIA (épico `leitura-receita-ia`, T1, T5, T7, P2, P7). O modelo padrão é `claude-opus-5-5`.
- A Anthropic **não transcreve áudio**: a transcrição precisa de outro provedor.

**Breaking changes:** nenhuma.

## Decisões

- **D1 Duas portas.**
  - `TranscritorDeFala`: streaming de áudio e trechos com tempo e confiança. O provedor é escolhido por bench em pt-BR com ruído de clínica, com preferência por processamento no Brasil (região `sa-east-1` quando o provedor tiver).
  - `EstruturadorDeAnamnese`: Anthropic, com o schema da `Anamnese` (E4-01) e citação obrigatória por campo.
- **D2 Áudio nunca é guardado.** Ele passa em streaming pelo servidor até o provedor. A transcrição (trechos) fica numa sessão com TTL de 24 h ligada ao atendimento. Ao aplicar, ficam só os campos aprovados com a citação textual (o trecho), para a auditoria saber de onde veio. Descartar apaga a sessão.
- **D3 A verificação é do servidor.** `alertasDaProposta` portado: marca interferência, confiança abaixo de 0,7, divergência entre falantes, deduzido, e **sem origem** (citação que não existe na transcrição, o que pega o modelo inventando).
- **D4 Nada aplicado sem aprovação.** A revisão devolve `escolhas[]` por campo; o servidor aplica no atendimento com `origemDosCampos=ESCUTA` (procedência, P8 do épico pai).
- **D5 O modelo não diagnostica.** Hipótese ouvida vai para "ouvido e não preenchido", apontando para a etapa de diagnóstico (P7 da receita com IA).
- **D6 Consentimento.** Iniciar a escuta exige o registro do consentimento dito na sala (nome de quem autorizou e hora). Com vínculo ativo, o app do responsável mostra "sua consulta está sendo gravada" enquanto a sessão estiver aberta (campo novo no contrato, lacuna do doc 10).
- **D7 Tetos e orçamento.** Por parceiro: 60 minutos de áudio por profissional por dia e um orçamento diário global, com 503 e log de erro quando estoura (padrão T5 da receita com IA). As constantes ficam em `anamnese-voz.config.ts`.
- **D8 Flag e gates.** `ANAMNESE_VOZ_ENABLED`, ligada no `.env` de dev e desligada em prod e no `.env.example`. Ligar em prod exige bench aprovado e LIA registrado.

## Rotas (`@ExigeModulo(CLINICA)`, `prontuario.escrever`)

| Método e rota | Descrição |
|---|---|
| `POST /parceiro/portal/clinica/atendimentos/:id/escuta` | `{ autorizadoPor, autorizadoEm }` → `{ sessaoId, urlDeStreaming, expiraEm }` (WebSocket ou chunked upload, conforme o provedor) |
| `POST /parceiro/portal/clinica/escutas/:sessaoId/encerrar` | Fecha o microfone e dispara a estruturação em segundo plano (claim condicional, padrão da leitura de receita) |
| `GET /parceiro/portal/clinica/escutas/:sessaoId` | Estado, trechos, propostas com citação e alertas |
| `POST /parceiro/portal/clinica/escutas/:sessaoId/aplicar` | `{ escolhas[] }` → aplica no atendimento (D4) |
| `DELETE /parceiro/portal/clinica/escutas/:sessaoId` | Descarta e apaga |
| `GET /tutor/clinica/escutas-ativas?petId=` | D6, só o indicador |

## Acceptance Criteria

- [ ] **Given** a conversa de demonstração do portal (`data/fixtures/consulta-gravada.ts`) como áudio sintetizado **Then** as propostas acertam os campos do roteiro, com o "10 dias" do latido marcado "Latido no trecho" e "vacinação em dia" marcado deduzido.
- [ ] **Given** uma proposta cuja citação não existe na transcrição **Then** ela vem com o alerta `sem-origem` e não pode ser aplicada sem edição.
- [ ] **Given** "pode ser uma gastroenterite" **Then** nenhum diagnóstico é preenchido e aparece "ouvido e não preenchido".
- [ ] **Given** aplicar **Then** só os campos escolhidos mudam, com `origemDosCampos=ESCUTA`; história soma e antecedente não repete.
- [ ] Nenhum arquivo de áudio existe no storage nem no banco depois da sessão (teste de varredura).
- [ ] Sessão não aplicada some em 24 h (cron).
- [ ] Estourado o teto do profissional, `escuta` dá 429 `TETO_DE_ESCUTA`; estourado o orçamento global, 503.

## Estratégia de Testes

- Unit: verificação de citação e alertas (golden tests de `escuta.spec`), aplicação por forma do campo.
- Bench: gold set de 20 consultas reais anonimizadas (com o barulho de clínica) e 5 sem anamnese (conversa de balcão), com meta de acerto por campo e calibração do "deduzido" antes de ligar.

## Gates de produção

- [ ] Bench aprovado (meta definida no relatório do bench, no padrão `leitura-receita-ia/bench-resultados.md`)
- [ ] LIA do processamento de voz (transferência internacional, se houver) registrado
- [ ] Contrato de operador com o provedor de transcrição

## Arquivos Impactados

| Arquivo | Ação |
|---|---|
| `src/anamnese-voz/` (portas, provedores, service, cron, `regras/verificacao.ts`, config) | Criar |
| `prisma/schema.prisma` + migration | `SessaoDeEscuta` (trechos, propostas, estado, `expiraEm`, custo) |

## Tasks

- [ ] **T1** Escolher o provedor de transcrição por bench (2 candidatos, pt-BR, ruído)
- [ ] **T2** Portas e sessão
- [ ] **T3** Estruturador com schema e citação (Anthropic)
- [ ] **T4** Verificação e aplicação
- [ ] **T5** Tetos, orçamento, flag, cron
- [ ] **T6** Bench, LIA, handoff (o portal troca o `SpeechRecognition` pela sessão do servidor fora do modo demonstração)

## Perguntas em Aberto

- [ ] Gold set de consultas reais gravadas com autorização (responsável: Nicolas, com uma clínica parceira).
- [ ] Separar vozes (diarização) na v1 ou só "não identificado" como hoje? Recomendo pedir diarização ao provedor se o bench mostrar ganho.

## Riscos e Mitigações

| Nível | Risco | Mitigação |
|---|---|---|
| Alto | Áudio de consulta (dado pessoal e de saúde) processado sem base contratual | Provedor com contrato de operador, LIA antes de prod, áudio nunca guardado (D2), flag desligada em prod |
| Alto | IA inventar o que não foi dito e o veterinário aplicar | Citação obrigatória com verificação `sem-origem` (D3), nada aplicado sem escolha item a item (D4), bench com calibração do "deduzido" |
| Médio | Custo descontrolado | Tetos por profissional e orçamento global com 503 (D7) |

## Rollout / Rollback

Atrás da flag `ANAMNESE_VOZ_ENABLED` (desligada em prod) e dos gates de produção. Rollback: desligar a flag; sessões abertas expiram em 24 h.

## Change Log

| Data | Versão | Mudança | Autor |
|---|---|---|---|
| 2026-10-20 | 0.1 | Criação | Nicolas (via Claude) |
