# Spec: Perfil público do estabelecimento

**Status:** Concluído (API em dev, 2026-10-21; front em novembro com o Luís)
**Autor:** Nicolas (via Claude)
**Criado em:** 2026-10-20
**Versão:** 0.3
**Handoff:** [portal-parceiro-e1.md](../../../../../../frontend/novembro-2026/portal-parceiro-e1.md)
**Épico:** [E1 fundação](../../../../../epicos/portal-parceiro-e1-fundacao.md) · [guarda-chuva](../../../../../epicos/portal-do-parceiro.md)
**Depende de:** nada

---

## Visão Geral

Dar ao `Parceiro` uma identidade de estabelecimento: slug, endereço estruturado, fuso horário, horários da semana, feriados e dias especiais, contatos públicos, contato de emergência e mensagem para fora do horário. O DONO preenche e **publica**; a API expõe uma projeção pública por slug, com o "aberto agora" calculado no fuso do estabelecimento.

## Motivação

- As páginas `/agendar/[clinica].vue` e `/reservar/[hotel].vue` do portal leem `AgendamentoOnline.slug`, `Clinic.endereco`, `Clinic.telefone`, `ContatoDeEmergencia` e `Clinic.horarios` de mock (`petjourney-admin/src/features/clinico/data/types.ts:35-72` e `:664-701`; `hotel/data/types.ts:256-282`).
- O receituário controlado precisa do endereço completo do prescritor (comentário do próprio portal em `types.ts:58-63`).
- Toda regra de agenda e de hotel depende do fuso e dos horários do estabelecimento.

---

## Research Findings

- `Parceiro` (`prisma/schema.prisma:267-346`) não tem slug, endereço, geolocalização, horários, fuso, fotos, descrição nem contato público. `Endereco` (`:520-541`) aponta só para `Usuario` e para o legado `Clinica`.
- **D9.14** (`2026/q2/q2-3/acesso-compartilhamento-e-parcerias/09-solicitacao-parceiro-ciclo-completo.md:82`): categoria, cnpj, telefone e crmv do cadastro não saem em superfície pública. O diretório (`src/clinica/prestador-diretorio.service.ts:97-102`) projeta só `id`, `nome`, `logoUrl`, `categoria`.
- Slug: `slugify` e `gerarSlugUnico(base, existe)` em `src/common/utils/slug.util.ts:54,70`.
- Fuso: helpers `inicioDoDiaNoFuso`, `horaLocal` (`src/notificacao/helpers/hora-local.helper.ts:20-159`) e `diaCivilEm`, `somarDiasCivis` (`src/lembrete/fim-do-dia-no-fuso.ts:32-78`); sem lib de data no projeto (usa `Intl`).
- Rota pública: prefixo `/public` (`src/public-pet/public-pet.controller.ts:22`), comentário `// PUBLIC:` exigido pelo `audit:endpoints`, `@Throttle` por rota.
- O mock usa `utcOffset` fixo (`-04:00`); esta spec troca por fuso IANA (P6 do épico pai).

**Breaking changes:** nenhuma (tabelas novas, rotas novas).

## Decisões da implementação (2026-10-21)

- **D1 Despublicação na leitura, não por gancho.**
  - A página só aparece com `publicado` E o parceiro APROVADO, ativo e não excluído, conferido a cada carregamento (cache de 60 s).
  - Substitui o gancho no fluxo de auditoria da T4: não diverge estado, não toca o service do admin, e a reativação devolve a página sem o DONO republicar.
  - Suspensão feita pelo admin aparece em até 60 s.
- **D2 O cache guarda o dado, não o "aberto agora"**, que é calculado a cada pedido (o horário não envelhece com o cache).
- **D3 Horário de parede.**
  - `24:00` vale só como fim (expediente de 24 h: `00:00-24:00`).
  - Dia que atravessa a meia-noite se escreve como dois dias; faixas coladas se emendam no `fechaEm`.
  - O dia especial manda sobre a semana.
  - Hora que não existe na troca de horário cai depois do salto; hora repetida vale a primeira.
- **D4 Feriados nacionais por migration de dados** (`20261021092000_feriados_nacionais_br_2026_2027`, idempotente), e não pelo `seed.ts`: assim produção recebe junto no `migrate deploy`.
  - Só os feriados da lei (10 por ano); Carnaval e Corpus Christi são ponto facultativo.
  - O nome vai no `idiomaDosTextos` da clínica.
- **D5 Slug:**
  - 3 a 60 caracteres `[a-z0-9-]`, sem `--`, com lista de reservados (rotas do portal e do site, marca);
  - o primeiro nasce do nome público no primeiro salvamento do parceiro APROVADO, ou na publicação (D8);
  - a troca trava a linha do `Parceiro` e a unicidade entre parceiros é a PK (`P2002` dá 409).
- **D6 Escrita:**
  - só o DONO;
  - cadastro PENDENTE edita (prepara antes da aprovação), mas só publica APROVADO;
  - suspenso ou inativo não escreve (D-E1.6, 409 `PARCEIRO_CADASTRO_SUSPENSO`), mas despublica.
- **D7 Foto de capa sem rota nesta spec:** o campo `fotoCapaCaminho` existe; o upload fica para spec própria (ver Follow-up).

### Decisões da auditoria de segurança da onda 1 (2026-10-21)

- **D8 Slug só para parceiro APROVADO, com teto de antigos** (achado M7).
  - Conta nova do autocadastro (PENDENTE) trocava o slug em laço com nomes de clínicas reais, e cada troca guardava o anterior para sempre.
  - `PUT .../estabelecimento/slug` exige APROVADO: PENDENTE e REJEITADO recebem 409 `ESTABELECIMENTO_NAO_APROVADO`. O `PUT .../estabelecimento` de quem não foi aprovado salva o perfil sem criar slug (`slug: null` na resposta).
  - Cada parceiro guarda até 5 slugs antigos (`LIMITE_SLUGS_ANTIGOS`); o sexto libera o mais antigo, que passa a dar 404. `criadoEm` do slug vira "desde quando é o atual": reaproveitar um antigo o põe no topo da fila.
  - Slug de parceiro rejeitado ou excluído (`deletedAt`) fica livre: quem o pedir fica com ele, e a linha antiga é apagada na mesma transação. Liberação na escrita, sem gancho no service do admin (mesma ideia da D1).
  - Dois salvamentos ao mesmo tempo não criam dois slugs atuais: o primeiro slug nasce com a linha do `Parceiro` travada.
- **D9 `mostrarEndereco`** (achado M8; coluna na migration `20261021102000_estabelecimento_mostrar_endereco`).
  - `false`: a página pública mostra só bairro, cidade, UF e país; logradouro, número, complemento, CEP e o mapa saem `null`, seja qual for o `mostrarMapa` (as coordenadas apontam a mesma porta). O endereço continua gravado (receita controlada precisa dele).
  - Padrão no primeiro salvamento: `false` para categoria VETERINARIO (autônomo, que costuma atender em casa) e `true` para o resto.
  - Exceção ao "salva o perfil inteiro": omitido no `PUT`, fica o valor gravado, para um front que ainda não conhece o campo não reexpor o endereço de quem o escondeu.
- **D10 Cache local com teto, só de página que existe** (achado M10). O `CacheService` global guardava `null` para cada slug inventado e não tem teto. Agora o cache é do service (`CacheLru`, 1.000 páginas, 60 s), e slug desconhecido, não publicado ou fora do ar não entra. O `CacheService` global não mudou.
- **D11 Data real no dia especial** (achado B8). `@IsDataCivil()` (`src/common/utils/data-civil.ts`) no lugar do regex: `2026-13-01` (que dava 500 no Prisma) e `2026-02-31` (que virava 3 de março) dão 400.

## Riscos e Mitigações

| Nível | Risco | Mitigação |
|---|---|---|
| Médio | Parceiro não aprovado publicar página e se passar por outra clínica | Publicar exige `statusAuditoria=APROVADO` e `ativo`; despublica sozinho na suspensão ou exclusão (`deletedAt`) |
| Médio | Fuso errado deslocar a agenda inteira | Fuso obrigatório na publicação, validado contra `Intl.supportedValuesOf('timeZone')`; default `America/Sao_Paulo`; teste com `Europe/London` (horário de verão) |
| Baixo | Slug trocado quebrar link impresso | Histórico de slug: o antigo responde com o novo (`SlugDoEstabelecimento` com `atual=false`) |

## Requisitos Não-Funcionais

- **Segurança:** escrita só DONO (e GESTOR depois da E1-03); leitura interna para qualquer membro; pública só do publicado.
- **Privacidade:** nenhum campo do cadastro (cnpj, crmv, telefoneComercial) entra na projeção pública. O e-mail público é opcional e separado do e-mail da conta.
- **Performance:** `GET /public/estabelecimentos/:slug` < 150 ms p95, com cache em memória de 60 s por slug (`CacheService`), invalidado na edição.
- **i18n:** `descricao`, `mensagemForaDoHorario` e `orientacaoEmergencia` são texto da clínica, com `idioma` declarado; não se traduz por máquina (regra do doc 09 do portal, seção 1.4).

---

## Modelo de dados (aditivo)

```prisma
model EstabelecimentoPerfil {
  parceiroId            String    @id
  nomePublico           String
  descricao             String?
  idiomaDosTextos       String    @default("pt-BR")
  fusoHorario           String    @default("America/Sao_Paulo") // IANA
  telefonePublico       String?
  whatsappPublico       String?
  telefonePlantao       String?   // fora do expediente; null = sem plantão
  emailPublico          String?
  site                  String?
  cep                   String?
  logradouro            String?
  numero                String?
  complemento           String?
  bairro                String?
  cidade                String?
  uf                    String?   // 2 letras, maiúsculas
  pais                  String    @default("BR") // ISO 3166-1 alfa-2
  latitude              Decimal?  @db.Decimal(9, 6)
  longitude             Decimal?  @db.Decimal(9, 6)
  mostrarMapa           Boolean   @default(true) // só tem efeito com latitude e longitude preenchidas
  fotoCapaCaminho       String?   // bucket público (é vitrine)
  mensagemForaDoHorario String?
  orientacaoEmergencia  String?
  publicado             Boolean   @default(false)
  publicadoEm           DateTime?
  atualizadoEm          DateTime  @updatedAt
  parceiro              Parceiro  @relation(fields: [parceiroId], references: [id], onDelete: Cascade)
}

model SlugDoEstabelecimento {
  slug       String   @id
  parceiroId String
  atual      Boolean  @default(true)
  criadoEm   DateTime @default(now())
  @@index([parceiroId, atual])
}

model HorarioDoEstabelecimento {
  id              String  @id @default(cuid())
  parceiroId      String
  diaSemana       Int     // 0 domingo .. 6 sábado
  fechado         Boolean @default(false)
  abre            String? // "HH:mm" na parede do estabelecimento
  fecha           String?
  intervaloInicio String?
  intervaloFim    String?
  @@unique([parceiroId, diaSemana])
}

model DiaEspecialDoEstabelecimento {
  id         String   @id @default(cuid())
  parceiroId String
  data       DateTime @db.Date
  nome       String   // "Natal", "Inventário"
  fechado    Boolean  @default(true)
  abre       String?
  fecha      String?
  @@unique([parceiroId, data])
}
```

## Rotas

| Método e rota | Quem | Descrição |
|---|---|---|
| `GET /parceiro/portal/estabelecimento` | membro | Perfil completo, horários, dias especiais, slug atual |
| `PUT /parceiro/portal/estabelecimento` | DONO | Atualiza o perfil (validação de UF, CEP de 8 dígitos, fuso IANA, telefones E.164 ou nacional) |
| `PUT /parceiro/portal/estabelecimento/horarios` | DONO | Substitui os 7 dias; valida `abre < fecha`, intervalo dentro do expediente |
| `POST /parceiro/portal/estabelecimento/dias-especiais` | DONO | Cria dia especial |
| `DELETE /parceiro/portal/estabelecimento/dias-especiais/:id` | DONO | Remove |
| `POST /parceiro/portal/estabelecimento/dias-especiais/feriados-nacionais` | DONO | Copia os feriados nacionais do ano pedido de um catálogo em tabela (`FeriadoNacional`, seed anual) |
| `PUT /parceiro/portal/estabelecimento/slug` | DONO | Troca o slug; o antigo vira `atual=false` e continua resolvendo |
| `POST /parceiro/portal/estabelecimento/publicar` e `/despublicar` | DONO | Publicar exige auditoria APROVADO, nome público, fuso e pelo menos um telefone |
| `GET /public/estabelecimentos/:slug` | público, `// PUBLIC:`, 30/min | Projeção publicada: nome, descrição, endereço, contatos públicos, horários, dias especiais dos próximos 60 dias, `abertoAgora`, `proximaAbertura` (ISO com offset), módulos com página pública (E3-05, E7-03). 404 genérico se não publicado |

## Acceptance Criteria

### Comportamentais
- [x] **Given** um parceiro PENDENTE **When** o DONO chama `publicar` **Then** 409 com `codigo: ESTABELECIMENTO_NAO_APROVADO`. **Atendido** (unit, smoke).
- [x] **Given** um perfil publicado com fuso `America/Sao_Paulo` e horário de segunda 08:00-18:00 **When** `GET /public/...` numa segunda às 17:59 local **Then** `abertoAgora=true`; às 18:00 **Then** `false` e `proximaAbertura` aponta para terça 08:00 com offset `-03:00`. **Atendido** (unit `regras/horario.spec.ts`, também Londres e Dubai).
- [x] **Given** um dia especial fechado hoje **Then** `abertoAgora=false` qualquer que seja o horário da semana. **Atendido** (unit).
- [x] **Given** um slug trocado **When** alguém abre o slug antigo **Then** recebe a mesma projeção com `slugAtual` preenchido. **Atendido** (unit, integração, smoke).
- [x] **Given** parceiro suspenso ou excluído **Then** a rota pública responde 404 genérico. **Atendido** (unit, integração, smoke), pela D1.

### Observáveis
- [x] A projeção pública não contém `cnpj`, `crmv`, `telefoneComercial`, `parceiroId` interno de equipe nem e-mail de conta. **Atendido**: o próprio `select` não pede esses campos (unit confere o select e a resposta; smoke confere o JSON).
- [x] `GET /public/estabelecimentos/:slug` não expõe `latitude/longitude` quando `mostrarMapa=false`. **Atendido** (unit, smoke).

## Estratégia de Testes

- **Unit:** cálculo de `abertoAgora`/`proximaAbertura` com 3 fusos, intervalo de almoço, dia especial, virada de semana; validação de horários; projeção pública (lista do que nunca sai, no padrão do `SELECT_PUBLICO` do diretório).
- **Integration:** troca de slug com unicidade sob concorrência.
- **Cenários:** perfil de outro parceiro (403 no PUT), público não publicado (404).

## Arquivos Impactados

| Arquivo | Ação |
|---|---|
| `prisma/schema.prisma` + migration | Modificar (4 tabelas + `FeriadoNacional`) |
| `src/estabelecimento/` (module, controller interno, controller público, service, `regras/horario.ts`, dto) | Criar |
| `src/common/utils/fuso.util.ts` | Criar: `offsetEm(instante, fuso)`, `isoNoFuso(instante, fuso)`, `instanteDe(dataLocal, horaLocal, fuso)` (reusar `Intl`, como `hora-local.helper.ts`) |
| `prisma/seed.ts` | Modificar: feriados nacionais 2026 e 2027 |
| `contrato/openapi.json` | Regenerar |

## Tasks Técnicas

- [x] **T1** Migration aditiva (`20261021090000_portal_parceiro_estabelecimento_e_modulos`) + feriados por migration de dados (D4)
- [x] **T2** `fuso.util.ts` com testes de horário de verão *(T1)*
- [x] **T3** CRUD interno + validações *(T1)*
- [x] **T4** Publicar, despublicar; despublicação automática na suspensão e na exclusão **pela leitura** (D1), sem gancho *(T3)*
- [x] **T5** Rota pública com cache e `abertoAgora` *(T2, T3)*
- [x] **T6** Testes (unit 92, integração 5 no Postgres de dev), cenários (`qa/cenarios/portal-parceiro.json`), smoke `scripts/smoke-estabelecimento.ts`, `openapi:exportar`, handoff do portal

## Rollout / Rollback

Aditivo. Rollback reverte o código; tabelas ficam sem leitura. Nada publica sem ação do DONO.

## Follow-up

- Upload da foto de capa (`fotoCapaCaminho`, bucket público com a denylist de MIME do repo).
- Página pública renderizada no servidor do site (Q2): precisa de cache próprio (ISR), porque o limite de 30/min é por IP e o servidor do site é um IP só.

## Perguntas em Aberto

- [ ] **Q2 do épico pai:** a página pública mora no portal ou no site? A rota da API é a mesma; muda só a URL que o QR e o link levam.

## Change Log

| Data | Versão | Mudança | Autor |
|---|---|---|---|
| 2026-10-20 | 0.1 | Criação | Nicolas (via Claude) |
| 2026-10-21 | 0.2 | Implementada. Decisões D1 a D7 (despublicação na leitura, cache do dado, horário de parede com 24:00, feriados por migration, regras de slug, quem escreve, foto de capa adiada) | Claude |
| 2026-10-21 | 0.3 | Auditoria de segurança da onda 1: D8 (slug só APROVADO, 5 antigos, slug de rejeitado ou excluído livre; M7), D9 (`mostrarEndereco`; M8), D10 (cache local com teto e sem `null`; M10), D11 (data real no dia especial; B8) | Claude |
