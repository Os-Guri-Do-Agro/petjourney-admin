# Spec: Catálogos clínicos (faixas de referência, diagnósticos, exames, bulário, vacinas)

**Status:** Concluído (API em dev, 2026-10-21; front em novembro com o Luís)
**Autor:** Nicolas (via Claude)
**Criado em:** 2026-10-20
**Versão:** 0.4
**Épico:** [E4 prontuário](../../../../../epicos/portal-parceiro-e4-prontuario.md)
**Depende de:** nada (pode ir antes de tudo do E4)

---

## Visão Geral

Os catálogos que o prontuário, a receita, a vacinação e o estoque consultam:
- faixas de referência de sinais vitais por espécie, porte e faixa etária;
- diagnósticos com código;
- exames (laboratório, imagem, outros);
- bulário: medicamentos com classe, controle, apresentação, concentração, dose por espécie, cuidados, indicações, contraindicações, efeitos, interações e sinônimos do princípio ativo nos 6 idiomas;
- vacinas com protocolo (série de filhote e de adulto sem histórico, idade mínima, essencial, vias, intervalo de reforço, obrigatória, mínimo de estoque).

Há um catálogo global, curado pela PetJourney, e acréscimos por parceiro.

## Motivação

- Os catálogos do portal são fixos no código (`petjourney-admin/src/features/clinico/data/fixtures/reference-ranges.ts`, `fixtures/vacinas.ts`, `fixtures/catalog-text.ts` com 1469 linhas). O doc 13 do portal diz: "O catálogo de vacinas e os intervalos são fixos no código".
- Faixa por espécie sozinha erra para porte e idade (P1 do doc 03).
- O alerta de alergia cruza por sinônimo do princípio ativo em 4 idiomas (`Medication.sinonimosDoPrincipio`, `types.ts:1471-1507`).
- O inventário confirma que a API não tem catálogo de vacina, medicamento, exame nem especialidade (seção 1.12).

---

## Research Findings

- **Tipos do portal:**
  - `ReferenceRange { vital, especie, porte?, faixaEtaria?, min, max, unidade, precisao }`, com resolução do mais específico para o mais geral (`domain/ranges.ts`, 16 testes);
  - `Medication` com `doses: MedicationDose[]` (mg/kg min e max por espécie, frequência, duração usual, `proibido`);
  - `MedicationClass` (10 classes);
  - `MedicationCaution` (gestante, lactante, filhote, idoso, renal, hepático, cardíaco, gástrico);
  - `DiagnosisCatalogItem { codigo, descricao, sistema }`;
  - `ExamCatalogItem { nome, grupo }`;
  - `Vacina` com `dosesNaSerie`, `dosesAdultoSemHistorico`, `idadeMinimaDias`, `essencial`, `vias`, `intervaloReforcoDias`, `obrigatoria`, `estoqueMinimo` (`types.ts:1082-1134`).
- **Regra discutível registrada pelo portal:** WSAVA pede a última dose do filhote com 16 semanas ou mais. O protótipo usa série fixa por faixa (decisão 3 do doc 13). Fica como pergunta clínica.
- **Padrão da API:** catálogo em tabela com `traducoes Json?` (`Plano`, `SaudeDica`) e `common/i18n/traducao.util.ts`; épico `catalogo-especies-racas` em Draft (raça segue texto livre aqui).

**Breaking changes:** nenhuma.

## Decisões

- **D1 Global + do parceiro.** Toda tabela tem `parceiroId?`: nulo é o catálogo global (somente leitura para o parceiro); preenchido é acréscimo da clínica (um medicamento manipulado, uma vacina importada). O parceiro não edita o global.
- **D2 Curadoria com fonte.** Cada item global de bulário e de faixa de referência tem `fonte`, `revisadoPor` (CRMV do responsável técnico da PetJourney) e `revisadoEm`. Item sem revisão não aparece para prescrição. O CMS ganha a tela de curadoria (handoff).
- **D3 Diagnósticos com código interno** e campo opcional para código de nomenclatura externa (`codigoExterno`, para mapear a VeNom depois). Hoje o portal já busca por código e descrição.
- **D4 Faixa ausente não é erro.** Vira `sem-referencia`; inventar faixa é pior que não ter (decisão do doc 03).
- **D5 Regime de controle no medicamento.** `controle` = `NENHUM`, `MAPA_VETERINARIO` (Portaria MAPA 837/2025) ou `ANVISA_HUMANO` (Portaria SVS/MS 344/98 e SNCR), com a lista (`listaControle`, ex. "C1") quando houver. A receita (E4-03) decide a folha a partir disso.
- **D6 Traduções explícitas.** Descrição, indicações e cuidados com `traducoes` nos 6 locales, en-GB explícito. Os sinônimos do princípio ativo são lista própria, para o alerta de alergia não sumir quando a tela muda de idioma (comentário do portal em `types.ts:1476-1486`).
- **D7 O seed inicial vem do portal**, depois de revisão clínica: os fixtures viram seed da migration de dados, marcados `revisadoPor=null` até a revisão (D2), e a revisão é gate de produção desta spec.

## Modelo de dados (aditivo, resumo)

```prisma
enum VitalClinico { PESO TEMPERATURA FREQUENCIA_CARDIACA FREQUENCIA_RESPIRATORIA TEMPO_PREENCHIMENTO_CAPILAR ESCORE_CORPORAL PRESSAO_SISTOLICA }
enum FaixaEtaria { FILHOTE ADULTO IDOSO }
enum ClasseMedicamento { ANTIBIOTICO ANTI_INFLAMATORIO ANALGESICO CORTICOIDE ANTIEMETICO GASTROPROTETOR ANTIPARASITARIO SEDATIVO CARDIOLOGICO DERMATOLOGICO OUTRA }
enum RegimeControle { NENHUM MAPA_VETERINARIO ANVISA_HUMANO }

model FaixaDeReferencia { id, parceiroId?, vital, especie Especie, porte PorteClinico?, faixaEtaria FaixaEtaria?, min Decimal, max Decimal, unidade, precisao Int, fonte, revisadoPor?, revisadoEm? }
model DiagnosticoDoCatalogo { id, parceiroId?, codigo, codigoExterno?, descricao, sistema SistemaClinico?, traducoes Json?, ativo }
model ExameDoCatalogo { id, parceiroId?, nome, grupo (LABORATORIO|IMAGEM|OUTROS), traducoes Json?, ativo }
model MedicamentoDoCatalogo { id, parceiroId?, nome, principioAtivo, sinonimosDoPrincipio String[], concentracao Decimal, unidadeApresentacao (ML|COMPRIMIDO|GOTA|APLICACAO), apresentacao, classe, controle RegimeControle, listaControle?, viasPermitidas String[], doseUsualMgKgMin, doseUsualMgKgMax, indicacoes String[], contraindicacoes String[], efeitosAdversos String[], interacoes String[], cuidados String[], observacao?, traducoes Json?, fonte, revisadoPor?, revisadoEm?, ativo }
model DoseDoMedicamentoPorEspecie { medicamentoId, especie, mgKgMin, mgKgMax, frequenciaHoras, duracaoUsualDias?, proibido Boolean, nota? }
model VacinaDoCatalogo { id, parceiroId?, nome, fabricante?, especies Especie[], dosesSerieFilhote Int, dosesSerieAdultoSemHistorico Int, idadeMinimaDias Int, essencial Boolean, vias String[], intervaloReforcoDias Int, intervaloEntreDosesDias Int, obrigatoria Boolean, estoqueMinimoPadrao Int, traducoes Json?, fonte, revisadoPor?, revisadoEm?, ativo }
```

(Notação resumida; na migration, Prisma completo com tipos e índices `@@index([parceiroId])` e busca por nome com `pg_trgm` no bulário e nos diagnósticos.)

## Rotas

| Método e rota | Quem | Descrição |
|---|---|---|
| `GET /parceiro/portal/clinica/catalogos` | `prontuario.ler` | Pacote inicial: faixas, exames, vacinas, classes (cache de 1 h) |
| `GET /parceiro/portal/clinica/catalogos/medicamentos?q=&especie=&limite=12` | `prontuario.ler` | Busca no bulário (global revisado + do parceiro) |
| `GET /parceiro/portal/clinica/catalogos/diagnosticos?q=&limite=12` | `prontuario.ler` | Busca por código e descrição |
| `POST/PATCH /parceiro/portal/clinica/catalogos/{medicamentos,vacinas,exames,diagnosticos}` | DONO ou GESTOR | Acréscimos do parceiro |
| `GET/POST/PATCH /admin/catalogos-clinicos/*` | SystemAdmin | Curadoria do global com `revisadoPor` (CRMV) |
| `POST /parceiro/portal/clinica/dose/calcular` | `prontuario.escrever` | Porte de `calcularDose`, `avaliarDose`, `alergiaConflitante`, `fracionar` e `passosDaConta`: `{ medicamentoId, pacienteId, mgPorKg, frequenciaHoras, duracaoDias? }` → cálculo com a conta passo a passo, fração ("meio comprimido" ou `APROXIMADO`), avisos (peso ausente, fora da faixa, proibido na espécie, cuidado aplicável, alergia conflitante) |

## Acceptance Criteria

- [x] **Given** faixa de FC para cão sem porte e outra para cão pequeno filhote **When** o paciente é cão pequeno filhote **Then** vale a específica; cão grande adulto **Then** vale a geral (golden tests do `ranges.spec` do portal). Evidência: `src/catalogos-clinicos/regras/faixas.spec.ts` (bloco "AC1" e os golden tests de `porte-faixas.spec.ts` e `clinical.spec.ts` do portal sobre o seed); smoke "AC1: Luna ... faixa de porte pequeno".
- [x] **Given** item global de bulário sem `revisadoPor` **Then** não aparece na busca para prescrição. Evidência: `src/catalogos-clinicos/catalogos-clinicos.integration.spec.ts` ("AC2: global sem revisao nao aparece na busca, nem pelo nome exato" e "nao revisado nao serve para calcular dose"); `src/auth/services/ownership.catalogo-clinico.spec.ts`; smoke "AC2".
- [x] **Given** paciente com alerta "alergia a amoxicilina" e tela em en-GB **When** calcula dose de "Amoxicillin" **Then** o aviso de alergia aparece (sinônimos). Evidência: `src/catalogos-clinicos/regras/dose.spec.ts` ("AC3"), `src/catalogos-clinicos/dose.service.spec.ts` ("AC3"), integração ("AC3") e smoke ("AC3 e AC4").
- [x] **Given** 124 mg num comprimido de 250 mg **Then** a fração volta `MEIO` com a marca de aproximação quando não fecha exato (casos do `dose.spec` e do `receita.spec` do portal). Evidência: `src/catalogos-clinicos/regras/dose.spec.ts` ("AC4" e o bloco `fracionar`), integração e smoke.
- [x] **Given** pet sem peso **Then** `calcular` volta o aviso `peso-ausente` e nenhum número. Evidência: `src/catalogos-clinicos/regras/dose.spec.ts` ("AC5"), `src/catalogos-clinicos/dose.service.spec.ts` ("AC5") e smoke ("AC5"). O código do aviso é `PESO_AUSENTE`.
- [x] Medicamento `proibido` na espécie volta o aviso como bloqueante de leitura (o veterinário precisa confirmar explicitamente na receita, E4-03). Evidência: `src/catalogos-clinicos/regras/dose.spec.ts` ("AC6") e integração ("AC6: coelho e amoxicilina"). Aviso `ESPECIE_PROIBIDA` com `bloqueante: true` e `exigeConfirmacao: true`; a conta continua visível.

## Estratégia de Testes

- Unit: resolução de faixa, busca, cálculo e fracionamento (golden tests do portal), traduções em 6 locales.

## Riscos e Mitigações

| Nível | Risco | Mitigação |
|---|---|---|
| Alto | Dose ou cuidado errado no bulário levar a erro de prescrição | D2 (curadoria com CRMV e fonte; não revisado não aparece), aviso de que a conta é do veterinário, P7 da receita com IA (sem conselho clínico automático) |
| Médio | Conteúdo de bulário com direito autoral de terceiro | Fonte registrada por item; usar bulas públicas e referências com licença; jurídico revisa a fonte antes do seed (gate) |

## Gates de produção

- [ ] Revisão clínica do seed global (D7) por veterinário responsável técnico, com fonte por item.

## Tasks

- [x] **T1** Migration + seed a partir dos fixtures do portal (marcado não revisado). Migrations `20261021130000_tipo_acao_admin_curadoria_catalogo` e `20261021130500_catalogos_clinicos` (aplicadas no dev); seed gerado em `src/catalogos-clinicos/seed/catalogo-global.dados.ts`, semeado no dev por `scripts/semear-catalogos-clinicos.ts` (34 faixas, 12 diagnósticos, 9 exames, 16 medicamentos, 34 doses, 6 vacinas, tudo não revisado) e chamado pelo `prisma/seed.ts`.
- [x] **T2** Rotas de leitura e busca (trigram): `src/catalogos-clinicos/catalogos-leitura.service.ts` e `catalogos-clinicos.controller.ts`.
- [x] **T3** Cálculo de dose com golden tests: `src/catalogos-clinicos/regras/dose.ts` (com `dose.spec.ts`) e `dose.service.ts`.
- [x] **T4** Acréscimos do parceiro e curadoria do admin: `catalogo-escrita.service.ts`, `curadoria.service.ts`, `catalogos-clinicos-admin.controller.ts`, `assertAcrescimoDoParceiro` e `assertMedicamentoPrescritivel` no `OwnershipService`, permissão `catalogo.gerir`.
- [x] **T5** Handoff do CMS (curadoria) e do portal (catálogo e dose pela API): `docs/frontend/novembro-2026/portal-parceiro-e4.md`.

## Perguntas em Aberto

- [ ] **Exigir CRMV para mudar doses dos acréscimos?** Hoje DONO ou GESTOR (`catalogo.gerir`) edita as doses e o `proibido` do medicamento da própria clínica, e a autoria fica só no log (v0.3, item 18). Pedir CRMV (como o cálculo de dose, que é `prontuario.escrever`) daria responsável clínico à mudança, mas tira do gestor sem CRMV a manutenção do catálogo. Decisão de produto. Responsável: Nicolas.

- [ ] Regra das 16 semanas do filhote (WSAVA) no protocolo: série de tamanho variável ou fixa por faixa? Responsável: veterinário responsável técnico + Nicolas. **Não decidida na implementação:** o modelo aceita as duas (`modoSerieFilhote` `FIXA`, ou `ATE_IDADE_MINIMA` com `idadeMinimaUltimaDoseFilhoteDias`; item 9 de "Decidido na implementação"). O seed repete o comportamento atual do protótipo (`FIXA`) e a escolha por vacina fica para a curadoria depois da resposta. O cálculo do plano vacinal é da E4-04.
- [ ] Equino: o enum `Especie` da API não tem equino, e as 3 faixas equinas e a dose equina da acepromazina do protótipo ficaram fora do seed. Entra com o épico de catálogo de espécies, se clínica de grandes animais for público. Responsável: Nicolas.
- [ ] Coelho na amoxicilina: a contraindicação do protótipo fala em "coelhos, hamsters e cobaias", mas a dose proibida só existe para `ROEDOR` (o protótipo não tinha coelho). Item da revisão clínica (gate). Responsável: veterinário responsável técnico.
- [ ] Regime de controle do tramadol e da acepromazina: o protótipo só marcava `controlado` (Portaria 344/98), e o seed pôs `ANVISA_HUMANO` sem lista. A curadoria confere o regime (a acepromazina de uso veterinário pode ser `MAPA_VETERINARIO`) e a lista. Responsável: veterinário responsável técnico (com a Q-JUR3 do épico).
- [ ] Unidade das faixas: `mpm` (movimentos por minuto) e as demais seguem como no protótipo, sem tradução. Decidir se a unidade vira enum com rótulo por idioma. Responsável: Nicolas, na E4-01.

## Rollout / Rollback

Aditivo. O seed global entra marcado como não revisado e não aparece para prescrição até a curadoria (D2 e D7). Rollback reverte o código; o seed fica.

## Decidido na implementação (2026-10-21)

1. **Espécies:** `canina` vira `CACHORRO`, `felina` vira `GATO`, `ave` vira `AVE`, `roedor` vira `ROEDOR`, `reptil` vira `REPTIL`. Equino fica de fora (pergunta em aberto); `COELHO`, `PEIXE` e `OUTRO` não têm linha no seed. Faixa de `OUTRO` não existe de propósito: valeria para furão e ouriço ao mesmo tempo (D4).
2. **Enum onde a spec dizia `String[]`** (P7): `viasPermitidas` e `vias` em `ViaAdministracao`, `cuidados` em `CuidadoMedicamento`, `grupo` em `GrupoExame`, `sistema` em `SistemaClinico`.
3. **`fonte` é opcional no banco**, e a revisão a exige (CHECK: revisado tem CRMV, data e fonte juntos, e só no global). O protótipo não tem fonte por item; inventar uma no seed seria pior.
4. **Quem precisa de revisão para aparecer:** só o bulário, na busca e na dose (D2 fala em "prescrição"). Faixa e vacina globais aparecem com `revisado`, para a tela marcar "não revisado". Acréscimo da clínica não passa pela curadoria (é responsabilidade dela).
5. **Curadoria:** `POST /admin/catalogos-clinicos/{faixas,medicamentos,vacinas}/:id/revisao` (`revisadoPor` no formato `CRMV-UF número`, `fonte`, `motivo?`) e `.../revisao/revogar` (`motivo`), os dois com protocolo `CUR` (`TipoAcaoAdmin.CURADORIA_CATALOGO_CLINICO`) e o conteúdo revisado no payload; a linha fica travada (`FOR UPDATE` na própria linha) da leitura à gravação. **Editar o conteúdo de item global revisado derruba a revisão** (sai da prescrição até revisar de novo). **Revisar exige traduções completas** nos 5 locales além do pt-BR, com listas do mesmo tamanho (D6, a regra do `catalog-i18n.ts` do portal): 400 `REVISAO_TRADUCAO_INCOMPLETA` com o que falta.
6. **Permissão nova `catalogo.gerir`** (GESTOR; o DONO tem todas) para os acréscimos, em vez de reaproveitar `estabelecimento.editar`. Como o GESTOR não tem `prontuario.ler`, existe `GET .../catalogos/acrescimos` (com `catalogo.gerir`), que também lista os inativos para reativar.
7. **Rotas além da tabela:** `GET /parceiro/portal/clinica/catalogos/faixas/paciente/:pacienteId` (P2: a resolução da faixa mora no servidor, com porte estimado marcado e idade no fuso do estabelecimento); `pesoKg` opcional no cálculo de dose (o peso aferido no atendimento vence o do cadastro); a dose é leitura para o módulo (`@ExigeModulo` com `acesso: 'leitura'`, porque não grava nada).
8. **Conta da dose:** decimal exato, meio para cima; mg e quantidade com 2 casas; o fracionamento sai do quociente com 4 casas (o protótipo fracionaria o 0,50 já arredondado e perderia a marca de aproximação do AC4); total nulo no uso contínuo (o protótipo usava 0); todos os avisos aplicáveis em lista, do mais grave ao menos grave (o `avaliarDose` do protótipo devolvia um só); fora da faixa usual é avisado mesmo sem peso; sobra perto do comprimido seguinte (0,97) vira o inteiro de cima, e o "aproximado" escolhe a fração mais próxima (o protótipo dava 0,75); a idade dos cuidados usa a mesma `idadeEmMeses` das faixas (que respeita o dia do aniversário); a alergia é comparada sem acento. A resposta leva `responsabilidade`, a frase de que a conta é do veterinário, nos 6 idiomas.
9. **Protocolo vacinal sem decidir a pergunta das 16 semanas:** `modoSerieFilhote` `FIXA` (n doses, o protótipo) ou `ATE_IDADE_MINIMA` (no mínimo n doses, até uma dada com `idadeMinimaUltimaDoseFilhoteDias` ou mais), com CHECK de coerência; `intervaloEntreDosesDias` por vacina (o protótipo tinha 28 fixo). Seed em `FIXA`.
10. **Busca:** `textoBusca` sem acento com o conteúdo de todos os idiomas (nome, princípio, sinônimos e indicações; no diagnóstico, código com e sem hífen e descrição), GIN `gin_trgm_ops`, `LIKE` com escape mais `word_similarity` (`<%`); ordem: começa com o termo, contém, parecido. `pg_trgm` criado pela migration (`IF NOT EXISTS`; no dev entrou em `public`) e o índice declarado no schema para o diff do Prisma ficar limpo. Antes do deploy em produção, conferir onde a extensão está (`SELECT extnamespace FROM pg_extension WHERE extname = 'pg_trgm'`).
11. **Unicidade entre os ativos de cada escopo** (o global ou a clínica), por índice parcial `NULLS NOT DISTINCT` (Postgres 15 ou mais; o CLAUDE.md diz Postgres 16): nome sem caixa (medicamento, exame, vacina), código (diagnóstico), combinação de espécie, sinal, porte e idade (faixa). Diagnóstico da clínica também não repete código de global ativo (409).
12. **Seed:** ids fixos `cat-...` (idempotência e referência estável para o CMS), `skipDuplicates`, nunca sobrescreve nem reativa o que a curadoria mexeu, e dose só entra junto do medicamento criado na mesma execução. Travessão do protótipo virou dois-pontos; `controlado: true` virou `ANVISA_HUMANO` sem lista; os nomes das vacinas foram traduzidos aqui (o portal não os traduzia); en-GB veio da tabela de grafia britânica do próprio portal. Semeado no dev pelo script, não pelo `prisma db seed` inteiro.
13. **Faixa da clínica:** a coluna `parceiroId` existe (D1), mas não há rota para a clínica criar faixa (a tabela de rotas não pede); o pacote e a resolução usam só o global.
14. **Cache do pacote:** `Cache-Control: private, max-age=3600`, sem cache no servidor (a curadoria aparece na hora). Com `Vary: Authorization, Accept-Language` desde a v0.3 (item 21).

## Revisão de segurança (v0.3, 2026-10-21)

Auditoria de 2026-10-21 (achados `SEG-2026-10-21-CATALOGO-TRADUCOES-SEM-LIMITE` e `SEG-2026-10-21-CATALOGO-EDICAO-SEM-AUTORIA`, MÉDIOS, e parte de `SEG-2026-10-21-ONDA2-BAIXOS`, em `qa/seguranca/achados.json`).

15. **Validador próprio das traduções** (`regras/traducoes.ts`, M1). O `parseTraducoes` do `traducao.util.ts` é do CMS de conteúdo e aceita qualquer campo de qualquer tamanho: uma lista em `nome` sobrescrevia o campo e o `nome` voltava array; indicações sem fim iam para o texto de busca. O catálogo ganhou regra própria, sem mudar o comportamento do `traducao.util.ts` (só o `CIRILICO` passou a ser exportado):
    - campos por entidade: medicamento `nome`, `principioAtivo`, `apresentacao`, `observacao` e as 4 listas (`indicacoes`, `contraindicacoes`, `efeitosAdversos`, `interacoes`); vacina e exame `nome`; diagnóstico `descricao`; dose `nota`;
    - o tipo da coluna (texto ou lista de textos), os limites do pt-BR contados em code points (como o `@Length`), no máximo 30 itens por lista; nos campos que o pt-BR normaliza (`transformTextoCurto`), a tradução passa pela mesma limpeza; sr-Latn sem cirílico; texto vazio = sem tradução;
    - inválido: 400 `CATALOGO_TRADUCAO_INVALIDA` com `campo` (`en-US.nome`, `es-419.indicacoes[3]`, `doses.GATO.ar.nota`), `motivo` (`LOCALE_INVALIDO`, `FORMATO`, `CAMPO_DESCONHECIDO`, `TIPO`, `TAMANHO`, `ITENS_DEMAIS`, `CIRILICO`) e o limite. Vale para o acréscimo da clínica e para a curadoria do admin (o mesmo caminho de escrita). O catálogo de partida inteiro passa no validador (teste).
16. **Sinônimos contados depois de derivados:** até 20 grafias do princípio no total, contando o princípio e as que vêm das traduções do `principioAtivo` (o `@ArrayMaxSize(20)` do DTO só via as informadas). Passou: 400 `CATALOGO_SINONIMOS_DEMAIS` com `max` e `total`.
17. **Texto de busca até 8 KB** (bytes UTF-8, `LIMITE_DO_TEXTO_BUSCA`): os pedaços entram por ordem de importância (nome, princípio e sinônimos, depois os nomes e princípios traduzidos, depois as indicações); o que passaria do teto fica fora da busca, nunca do item.
18. **Autoria (M2).** Os controllers passam o usuário até o service (`Autoria { userId, motivo? }`). Toda escrita registra `[Catalogo] <ENTIDADE>_CRIADO|_ALTERADO escopo=GLOBAL|PARCEIRO [parceiroId=...] id=... por=<userId> campos=[...]`, só com os nomes dos campos (nunca valores nem texto livre). O evento é sempre `_CRIADO`/`_ALTERADO`, um padrão só para a busca no log.
19. **Edição do GLOBAL pelo admin pede motivo e emite protocolo CUR.** Os `PATCH` de `/admin/catalogos-clinicos/{faixas,medicamentos,vacinas,exames,diagnosticos}/:id` usam DTOs de admin com `motivo` (5 a 500 caracteres; conferido no service para o 400 sair com `CURADORIA_MOTIVO_OBRIGATORIO`). O controller tira o `motivo` do corpo antes do service (ele não conta como conteúdo e não derruba a revisão). Na mesma transação da escrita, o protocolo `CUR` (`acao: EDICAO`) guarda os campos que vieram e o **antes e o depois dos números clínicos**: medicamento (concentração, unidade, classe, regime e lista de controle, vias, faixa geral, cuidados, doses com espécie, mg/kg, frequência, duração e `proibido`), vacina (espécies, série, idades, intervalos, vias, essencial, obrigatória, estoque), faixa (sinal, espécie, porte, idade, mínimo, máximo, unidade, precisão), exame (grupo) e diagnóstico (código e sistema), mais `ativo`, `revisado` e `revisaoCaiu`. Sem nome, observação, nota, tradução nem fonte (texto livre); o catálogo não tem PII. O código do protocolo vai no log, não na resposta do `PATCH` (o contrato da resposta não mudou). Criar não emite protocolo (o item nasce não revisado).
20. **Atualização perdida (B1).** O `PATCH` de todo tipo trava a própria linha (`SELECT id FROM "<tabela>" WHERE id = ... FOR UPDATE`, sem agregação), relê o `atual` dentro da transação e só regrava um campo derivado quando a entrada dele veio no corpo: sinônimos (princípio, sinônimos ou traduções), texto de busca (isso, nome, indicações; no diagnóstico, código, código externo, descrição ou traduções), controle e lista (um dos dois), faixa geral de dose (um dos extremos), série da vacina (modo ou idade). Integração: duas edições simultâneas do mesmo remédio (nome e indicações) ficam as duas, inclusive no texto de busca.
21. **`Vary: Authorization, Accept-Language`** no pacote (B3): sem ele, um cache no caminho serviria o pacote de uma conta ou de um idioma a outro. O front manda `parceiroId` na URL quando o usuário tem mais de um parceiro (handoff).
22. **`pg_trgm` fora de `public`** (B5). A migration `20261021130500` não foi editada (o checksum quebraria o `migrate status`); a `20261021140000_pg_trgm_no_schema_extensions` move a extensão para `extensions` dentro de um `DO $$ ... $$` guardado: só quando o schema `extensions` existe, a extensão está em `public` e `extensions` está no `search_path` da conexão (sem privilégio: avisa e segue). No dev, o usuário da API (`postgres`, pela `DATABASE_URL_IPV6_FAST_CONNECTION`) tem `search_path = "$user", public, extensions`; o dono da extensão é `supabase_admin` e o `postgres` conseguiu mover (testado numa transação desfeita antes). Movida no dev; os índices GIN seguiram valendo (guardam a classe de operador pelo OID) e o `prisma migrate diff` ficou vazio. `<%` e `word_similarity` continuam **sem schema** de propósito: resolvem pelo `search_path` onde quer que a extensão tenha ficado (qualificar quebraria o ambiente em que ela não se moveu). A integração confere que o schema da extensão está no `search_path` e que a busca com erro de digitação segue achando. **Antes do deploy em produção:** rodar `SHOW search_path` com a role da API (a do pooler) e conferir que tem `extensions`; depois do deploy, conferir onde a extensão ficou (`SELECT extnamespace::regnamespace FROM pg_extension WHERE extname = 'pg_trgm'`).
23. **Seed com trava de produção** (B2, comum a todos os seeds): `prisma/seed.ts` importa `scripts/lib/trava-prod` antes de tudo. Com o `.env` em produção, sai com 1 antes de abrir conexão, salvo `--prod` e `CONFIRMO_PRODUCAO`; em dev libera (teste `src/prisma/seed-trava-prod.spec.ts` e chamada da função contra o `.env` de dev). Observação: o `prisma.config.ts` do Prisma 7 não declara `migrations.seed`, então o seed roda por `npx tsx prisma/seed.ts`, não por `prisma db seed`.

## Change Log

| Data | Versão | Mudança | Autor |
|---|---|---|---|
| 2026-10-20 | 0.1 | Criação | Nicolas (via Claude) |
| 2026-10-21 | 0.3 | Revisão de segurança (achados MÉDIOS das traduções e da autoria, e baixos): itens 15 a 23 (validador próprio das traduções, sinônimos depois de derivados, texto de busca até 8 KB, autoria no log, motivo e protocolo CUR na edição do global, trava e releitura no PATCH, `Vary`, `pg_trgm` em `extensions`, trava de produção no seed); pergunta do CRMV nas doses dos acréscimos. Integração e smoke atualizados; handoff com os códigos novos | Nicolas (via Claude) |
| 2026-10-21 | 0.2 | T1 a T5 implementadas (API e handoff); "Decidido na implementação"; perguntas novas (equino, coelho, regime de controle, unidade). Gate de produção segue aberto | Nicolas (via Claude) |
| 2026-10-21 | 0.4 | Fechada do lado da API depois da revisão de segurança (achados corrigidos e conferidos: `npm test` 6378, integração 27/27 no dev, smoke 53/53). Segue aberto o gate de produção (revisão clínica do seed) e as perguntas do bulário | Claude |
