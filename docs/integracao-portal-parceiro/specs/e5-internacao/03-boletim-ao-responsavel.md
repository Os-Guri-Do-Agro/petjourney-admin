# Spec: Boletim da internação ao responsável

**Status:** In Review
**Autor:** Nicolas (via Claude)
**Criado em:** 2026-10-20
**Versão:** 0.1
**Épico:** [E5 internação](../../../../../epicos/portal-parceiro-e5-internacao.md)
**Depende de:** [E5-01](01-leitos-e-internacao.md), [E5-02](02-prescricao-enfermagem-e-plantoes.md), [E2-02 vínculo](../e2-pacientes-e-ponte/02-vinculo-e-consentimento.md)

---

## Visão Geral

O responsável acompanha o pet internado pelo app, sem ligar.

**A clínica:**
- compõe boletins (automático pela frequência, ou manual a partir de modelos), com texto e foto opcional;
- registra a ligação quando a regra exige;
- envia.

**A regra do servidor:**
- **boletim de piora fica retido** até alguém da clínica ligar;
- **seguir crítico não cobra ligação a cada boletim**, só a piora e o primeiro de quem entrou crítico;
- o **silêncio noturno junta** os da madrugada num boletim às 7h, e a piora nunca espera;
- **alta** escreve a última mensagem;
- **óbito e transferência** não mandam nada.

## Motivação

- Doc 07 e doc 09 (seção 10) do portal.
- Tipos `BoletimAoTutor` (`rascunho`, `retido`, `liberado`, `enviado`; `exigeLigacao`, `ligacaoEm`, `ligacaoPor`; tipo `atualizacao` ou `alta`), `PreferenciaDeBoletim` (frequência 1, 2, 4, 6, 8, 12 ou 24 h; `fotoSempre`; `silencioNoturno`), `BoletimBloqueadoError` (`types.ts:1866-1932`).
- O texto do boletim é montado no repositório e congelado no envio (`data/boletim-texto.ts`).
- O app nunca mostra "boletim aguardando" nem contagem de retidos; o boletim após ligação chega com `aposLigacao: true`; o push nunca adianta conteúdo.

---

## Decisões

- **D1 Retenção é do servidor.** `enviar` recusa `BOLETIM_EXIGE_LIGACAO` enquanto `exigeLigacao && !ligacaoEm`. `exigeLigacao` nasce quando a gravidade piorou desde o último boletim enviado, ou no primeiro boletim de quem entrou crítico (D-E5.3; decisão "seguir crítico não cobra ligação nova").
- **D2 Automático por cron.** A cada 15 min (advisory lock), compõe o boletim das internações cuja próxima janela venceu, a partir da última evolução e das administrações do período. Boletim automático que exige ligação nasce `RETIDO` e entra no contador `boletinsRetidos` (selo no leito e faixa em "Meu dia").
- **D3 Silêncio noturno (22h a 7h no fuso da clínica)** acumula e sai às 7h num boletim só, a não ser que haja piora (que vira retido e espera a ligação, não o horário).
- **D4 Texto congelado no envio, no idioma do responsável.** O texto automático é montado no servidor por molde nos 6 locales (o boletim é mensagem ao responsável, não interface; decisão do doc 07), com o idioma do responsável (locale do aparelho mais recente); o editado pela clínica vai com o idioma em que foi escrito.
- **D5 Foto** no bucket privado do parceiro, com URL assinada para o app; `fotoSempre` é preferência do responsável que a clínica atende "quando pode".
- **D6 Push sem conteúdo.** `INTERNACAO_BOLETIM` diz "Notícias de {pet}"; `INTERNACAO_ALTA` na alta; nada em óbito ou transferência.
- **D7 Só com vínculo ativo.** Sem vínculo, o boletim fica na clínica (e a recepção liga); a tela diz "sem app: avise por telefone".

## Modelo de dados (aditivo)

```prisma
enum StatusBoletim { RASCUNHO RETIDO LIBERADO ENVIADO }
enum TipoBoletim { ATUALIZACAO ALTA }

model BoletimDeInternacao {
  id            String        @id @default(cuid())
  internacaoId  String
  tipo          TipoBoletim   @default(ATUALIZACAO)
  origem        String        // AUTOMATICO | MANUAL
  status        StatusBoletim
  gravidade     Gravidade     // no instante da composição
  texto         String
  idioma        String
  fotoCaminho   String?
  fotoLegenda   String?
  geradoEm      DateTime      @default(now())
  autorId       String?
  exigeLigacao  Boolean       @default(false)
  ligacaoEm     DateTime?
  ligacaoPorId  String?
  enviadoEm     DateTime?
  @@index([internacaoId, geradoEm])
}

model PreferenciaDeBoletim {
  internacaoId    String  @id
  frequenciaHoras Int     @default(6) // 1, 2, 4, 6, 8, 12, 24
  fotoSempre      Boolean @default(true)
  silencioNoturno Boolean @default(true)
  definidaPor     String  // RESPONSAVEL | CLINICA
}
```

## Rotas

| Método e rota | Quem | Descrição |
|---|---|---|
| `GET /parceiro/portal/clinica/internacoes/:id/boletins` | `boletim.compor` | Conversa da clínica (com retidos) |
| `GET .../internacoes/:id/boletins/modelos` | `boletim.compor` | Modelos do texto a partir da evolução |
| `POST .../internacoes/:id/boletins` | `boletim.compor` | Manual (texto, foto) |
| `POST /parceiro/portal/clinica/boletins/:id/ligacao` | `boletim.enviar` | `{ em }` registra a ligação |
| `POST /parceiro/portal/clinica/boletins/:id/enviar` | `boletim.enviar` | 409 `BOLETIM_EXIGE_LIGACAO` |
| `PUT .../internacoes/:id/preferencias` | `boletim.compor` | Pela clínica (o responsável pediu por telefone) |
| `GET /tutor/clinica/internacoes?petId=` e `GET /tutor/clinica/internacoes/:id` | dono ou família | `InternacaoNaClinica` (status, previsão de alta como estimativa, contato) |
| `GET /tutor/clinica/internacoes/:id/boletins` | dono ou família | Só os ENVIADOS, mais recente primeiro, com `aposLigacao` |
| `PUT /tutor/clinica/internacoes/:id/preferencias` | dono | Frequência, foto, silêncio; resposta traz o custo em mensagens por dia |

Contador (E1-06): `boletinsRetidos` (tom risco).

## Acceptance Criteria

- [ ] **Given** gravidade foi de ATENCAO para CRITICO **Then** o próximo boletim nasce `RETIDO` com `exigeLigacao`; `enviar` dá 409 até `ligacao`.
- [ ] **Given** paciente que segue CRITICO **Then** os boletins seguintes não exigem ligação.
- [ ] **Given** frequência de 1 h com silêncio noturno **Then** entre 22h e 7h nada sai, e às 7h sai um boletim com a madrugada; uma piora às 3h vira retido e não espera as 7h para ser cobrada da clínica.
- [ ] **Given** óbito **Then** nenhum push, nenhum boletim novo, e o app mostra "Internação encerrada" com o contato.
- [ ] **Given** o app pede os boletins **Then** nenhum `RETIDO` aparece, nem contagem.
- [ ] O push de boletim nunca tem texto clínico.
- [ ] Sem vínculo, nada sai para app, e o comprovante registra `canal=NENHUM`.

## Estratégia de Testes

- Unit: regra de retenção, silêncio noturno com junção, molde de texto nos 6 locales, push sem conteúdo.
- Integration: cron em 3 réplicas sem boletim duplicado.

## Arquivos Impactados

| Arquivo | Ação |
|---|---|
| `prisma/schema.prisma` + migration | Modificar |
| `src/internacao-clinica/boletim/` (service, cron, moldes, rotas parceiro e tutor) | Criar |
| `src/notificacao/catalogo/*` | `INTERNACAO_BOLETIM`, `INTERNACAO_ALTA` |

## Tasks

- [ ] **T1** Migration
- [ ] **T2** Compor (automático e manual) com molde por idioma
- [ ] **T3** Retenção, ligação, envio
- [ ] **T4** Cron com silêncio e junção
- [ ] **T5** Rotas do app, push, contador, testes, handoff

## Riscos e Mitigações

| Nível | Risco | Mitigação |
|---|---|---|
| Alto | Piora chegar ao responsável por push antes da ligação | Retenção no servidor (D1), push sem conteúdo (D6), teste que tenta enviar retido |
| Médio | Silêncio noturno esconder notícia | Piora nunca espera o horário: vira retido e cobra a clínica; o resto junta às 7h |

## Rollout / Rollback

Aditivo e atrás do módulo (E1-02): nada aparece para parceiro sem o módulo ligado. Migration só cria tabelas e colunas; rollback é reverter o código, e as tabelas ficam sem leitor.

## Change Log

| Data | Versão | Mudança | Autor |
|---|---|---|---|
| 2026-10-20 | 0.1 | Criação | Nicolas (via Claude) |
