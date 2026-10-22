# Guia do front: Portal do parceiro, E4 (prontuário, receita, vacinas e adesão)

**Para:** o Luís. Portal web do parceiro (`petjourney-admin`), CMS (`petjourney-cms`) e app (`petjourney-app`, seção 4).
**Backend:**
- E4-02 (catálogos clínicos) pronta e validada em dev em 2026-10-21: unit, integração contra o Postgres de dev e smoke por HTTP (`npm run script:smoke-catalogos-clinicos`). **Não está em produção**, e o conteúdo clínico de partida ainda **não foi revisado** por veterinário responsável técnico (gate de produção da spec).
- E4-04 (vacinação conectada) pronta e validada em dev em 2026-10-21: unit, integração no Postgres de dev (inclusive uma clínica de 3.000 pacientes) e smoke por HTTP (`npm run script:smoke-vacinacao`). **Não está em produção.** Seções 3 (portal) e 4 (app).
- As próximas partes do E4 (prontuário, receita) entram neste mesmo guia quando ficarem prontas.
**Specs de origem:** `docs/specs/2026/q4/q4-1/portal-parceiro/e4-prontuario/02-catalogos-clinicos.md` (v0.3: revisão de segurança de 2026-10-21, com traduções validadas por campo, `Vary` no pacote e motivo na edição do global; veja 1.2, 1.7, 1.8 e 2.1) e `.../e4-prontuario/04-vacinacao-conectada.md` (v0.2)

**Contrato:** `contrato/openapi.json`; gere os tipos dele. Convenções iguais às da onda 0 ([portal-parceiro-e0.md](portal-parceiro-e0.md), seção 1):
- envelope `{ statusCode, message, data }`;
- erro com `codigo` (para decidir a tela) e `message` localizada (para mostrar);
- `?parceiroId=` quando o usuário tem mais de um parceiro;
- idioma do conteúdo pelo `Accept-Language` (ou `?lang=` nas rotas GET): nome, apresentação, indicações, contraindicações, notas de dose, exames, diagnósticos e vacinas já vêm traduzidos nos 6 idiomas.

---

## 1. Catálogos clínicos no portal (E4-02)

Substitui no mock:
- `referenceRangesFixture` (`data/fixtures/reference-ranges.ts`) e a resolução de `domain/ranges.ts` + `domain/porte.ts`;
- `diagnosisCatalogFixture` e `examCatalogFixture` (`data/fixtures/catalogs.ts`);
- `medicationsFixture` (`data/fixtures/medications.ts`), `TEXTO_DO_CATALOGO` (`data/fixtures/catalog-text.ts`) e `domain/catalog-i18n.ts` (a API devolve traduzido);
- `vacinasFixture` (`data/fixtures/vacinas.ts`);
- a conta de `domain/dose.ts`, `domain/receita.ts` (`passosDaConta`, `fracionar`) e os avisos de `domain/bulario.ts`.

Quando cada rota estiver ligada, **apague a regra local** correspondente (P2 do épico: regra mora no servidor). Fica no front só a montagem das frases.

### 1.1 Quem entra

- **Módulo:** todas as rotas desta seção exigem o módulo **Clínica** ligado.
  - Sem o módulo: 403 `MODULO_INATIVO`.
  - Módulo só de consulta (suspenso, desligado, vencido): lê e calcula dose; acrescentar dá 403 `MODULO_SOMENTE_LEITURA`.
- **Permissão** (sem ela: 403 `SEM_PERMISSAO` com `permissao`):

| O quê | Permissão | Quem tem |
|---|---|---|
| Pacote, busca de medicamentos e diagnósticos, faixas do paciente | `prontuario.ler` | DONO, VETERINÁRIO, ENFERMAGEM |
| Acréscimos da clínica (criar, editar, listar) | `catalogo.gerir` (nova) | DONO, GESTOR |
| Calcular dose | `prontuario.escrever` | DONO e VETERINÁRIO, **com CRMV** (sem CRMV: 403 `CRMV_OBRIGATORIO`) |

  A RECEPÇÃO não lê o catálogo clínico. O GESTOR acrescenta itens mas não lê o pacote nem busca (não tem `prontuario.ler`): na tela de acréscimos, use `GET .../catalogos/acrescimos`. Esconda os botões pelo `GET /parceiro/portal/eu`.
- **Item de outra clínica, item global (para editar) ou id que não existe:** 403 de acesso negado, **sem `codigo`** e sem dizer qual (o mesmo de pacientes, guia e2 seção 1.3).

### 1.2 Pacote inicial

`GET /parceiro/portal/clinica/catalogos`
- Resposta `{ faixas, exames, vacinas, classes }`. Vem com `Cache-Control: private, max-age=3600` e `Vary: Authorization, Accept-Language`: guarde por 1 h, e **invalide** quando a própria clínica criar ou editar um exame ou vacina.
- O pacote é **da clínica e do idioma**: a chave do seu cache (React Query ou outro) tem de levar o `parceiroId` e o idioma. Quando o usuário tem mais de um parceiro, mande sempre `?parceiroId=` na URL (o mesmo vale para todas as rotas desta seção): sem ele a API recusa, e com ele a URL de uma clínica nunca serve o pacote da outra num cache do navegador ou do caminho.
- `faixas`: `FaixaDeReferenciaDto` `{ id, vital, especie, porte, faixaEtaria, min, max, unidade, precisao, fonte, revisado, revisadoPor, revisadoEm, ativo }`.
  - `vital`: `TEMPERATURA`, `FREQUENCIA_CARDIACA`, `FREQUENCIA_RESPIRATORIA`, `TEMPO_PREENCHIMENTO_CAPILAR`, `ESCORE_CORPORAL`, `PRESSAO_SISTOLICA` (o `VitalKey` do mock em maiúsculas; `PESO` não tem faixa).
  - `porte` e `faixaEtaria` nulos = vale para qualquer um.
  - `especie` é o enum da API (`CACHORRO`, `GATO`, `AVE`, `ROEDOR`, `COELHO`, `PEIXE`, `REPTIL`, `OUTRO`). **Não há equino**: as faixas equinas do mock não foram para a API.
- `exames`: `{ id, origem, nome, grupo, ativo }`, `grupo` `LABORATORIO`, `IMAGEM` ou `OUTROS`; `origem` `GLOBAL` (PetJourney) ou `PARCEIRO` (da clínica).
- `vacinas`: `VacinaDto` com o protocolo (seção 1.6).
- `classes`: as classes do bulário (`ANTIBIOTICO`, `ANTI_INFLAMATORIO`, ..., `OUTRA`), para o filtro.
- **`revisado: false`** em faixa e vacina: o conteúdo ainda não passou pela curadoria do responsável técnico. Mostre um selo discreto ("referência não revisada") enquanto for `false`. Hoje **tudo** vem `false`.

### 1.3 Faixas do paciente (não resolva no front)

`GET /parceiro/portal/clinica/catalogos/faixas/paciente/:pacienteId`
- Resposta `{ pacienteId, especie, porte, porteEstimado, faixaEtaria, faixas: [{ vital, faixa }] }`, uma linha por sinal vital.
- A API resolve da faixa mais específica para a mais geral (porte e idade, porte, idade, espécie), com a idade calculada no fuso do estabelecimento. É a regra de `domain/ranges.ts`, com os testes de `porte-faixas.spec.ts` como golden tests.
- `faixa: null` = **sem referência** (D4). Mostre o valor sem julgar; nunca invente faixa.
- `porteEstimado: true`: o cadastro não informa o porte e a API estimou pelo peso. É palpite: mostre "porte estimado" e leve ao cadastro do paciente.
- `faixaEtaria: null`: nascimento desconhecido (a idade não entra).
- O status de cada medição (`ABAIXO`, `DENTRO`, `ACIMA`, `SEM_REFERENCIA`, `NAO_AFERIDO`) vai sair pronto no prontuário (E4-01). Até lá, compare `valor` com `min`/`max` da faixa que esta rota devolveu.

### 1.4 Busca no bulário e nos diagnósticos

- **Medicamentos:** `GET /parceiro/portal/clinica/catalogos/medicamentos?q=&especie=&limite=12`
  - `q`: nome, princípio ativo, sinônimo ou **indicação** ("otite"), em qualquer idioma, com tolerância a erro de digitação ("amoxicilna"). Até 60 caracteres. Sem `q`: os primeiros por nome.
  - `especie`: só os que têm dose para a espécie, **inclusive os proibidos nela** (esconder seria pior).
  - `limite`: 1 a 50, padrão 12.
  - **Só aparece o global revisado** pelo responsável técnico, mais os acréscimos da clínica. Hoje o bulário de partida está todo pendente de revisão: a busca devolve só o que a clínica acrescentou. Isso é esperado (D2), não é erro.
  - `MedicamentoDto`: `{ id, origem, nome, principioAtivo, sinonimosDoPrincipio, apresentacao, concentracao, unidadeApresentacao, classe, controle, listaControle, viasPermitidas, doseUsualMgKg: { min, max }, doses, indicacoes, contraindicacoes, efeitosAdversos, interacoes, cuidados, observacao, fonte, revisado, revisadoPor, revisadoEm, ativo }`.
  - `unidadeApresentacao`: `ML`, `COMPRIMIDO`, `GOTA`, `APLICACAO`. `concentracao` é mg por essa unidade.
  - `controle`: `NENHUM`, `MAPA_VETERINARIO` (Portaria MAPA 837/2025) ou `ANVISA_HUMANO` (Portaria 344/98 e SNCR), com `listaControle` ("C1") quando houver. Substitui o booleano `controlado` do mock; a receita (E4-03) decide a folha por ele.
  - `doses`: `{ id, especie, mgKgMin, mgKgMax, frequenciaHoras, duracaoUsualDias, proibido, nota }`. Substitui `MedicationDose` (`mgPorKg.min/max` viraram `mgKgMin/mgKgMax`).
  - `cuidados`: `GESTANTE`, `LACTANTE`, `FILHOTE`, `IDOSO`, `RENAL`, `HEPATICO`, `CARDIACO`, `GASTRICO`.
  - `sinonimosDoPrincipio`: todas as grafias do princípio nos 6 idiomas. Não use para mostrar; o alerta de alergia é cruzado no servidor (seção 1.5).
- **Diagnósticos:** `GET /parceiro/portal/clinica/catalogos/diagnosticos?q=&limite=12`
  - Por código ("GE-01" ou "ge01") e por descrição, em qualquer idioma. Global e da clínica (diagnóstico não passa por revisão).
  - `DiagnosticoDto`: `{ id, origem, codigo, codigoExterno, descricao, sistema, ativo }`. `sistema` é o `SystemKey` do mock em maiúsculas, ou nulo. `codigoExterno` fica para a VeNom.
- **Pronto quando:** o seletor de medicamento e o de diagnóstico do atendimento buscam na API (com debounce de uns 250 ms), e `medicationsFixture`, `diagnosisCatalogFixture` e `catalog-i18n.ts` saem do caminho.

### 1.5 Cálculo de dose

`POST /parceiro/portal/clinica/dose/calcular` `{ medicamentoId, pacienteId, mgPorKg, frequenciaHoras, duracaoDias?, pesoKg? }`

- `mgPorKg`: a dose que **o veterinário** escolheu. A API não sugere dose: ela faz a conta e mostra a faixa do bulário ao lado. O campo pode vir pré-preenchido com `faixaDeReferencia.mgKgMin` (o mínimo, como o mock fazia), nunca com o máximo.
- `duracaoDias` omitido: **uso contínuo** (sem total de administrações).
- `pesoKg`: o peso aferido agora no atendimento. Omitido, vale o último do cadastro do paciente.
- Resposta `ResultadoDaDoseDto`:
  - `medicamento` `{ id, origem, nome, principioAtivo, concentracao, unidadeApresentacao }` e `paciente` `{ id, especie, pesoKg, pesoOrigem }` (`INFORMADO`, `CADASTRO` ou nulo).
  - `calculo`: `{ pesoKg, mgPorKg, mgPorAdministracao, quantidadeApresentacao, unidadeApresentacao, frequenciaHoras, administracoesPorDia, duracaoDias, totalAdministracoes }`. **Nulo sem peso** (AC5): não mostre número nenhum.
  - `passos`: a conta para o veterinário conferir de cabeça. `tipo` `PESO_POR_DOSE` (`{ pesoKg, mgPorKg, mg }`), `DOSE_POR_CONCENTRACAO` (`{ mg, concentracao, unidade, quantidade }`) e `TOTAL` (`{ porDia, dias, total }`). O front monta a frase no idioma da tela: "12,4 kg × 10 mg/kg = 124 mg". O mock tinha os mesmos três passos em minúsculas.
  - `fracionamento` (só comprimido): `{ tipo, inteiros, quantidade, aproximado }`. `tipo` `INTEIRO`, `MEIO`, `UM_E_MEIO`, `QUARTO`, `TRES_QUARTOS`, `MULTIPLO` ou `APROXIMADO`. `quantidade` é sempre a partível (2,5, não 2,48). Com **`aproximado: true`**, a tela cobra a decisão do veterinário ("a conta deu 2,48 comprimidos; arredondado para 2 e meio") em vez de imprimir a fração em silêncio. Ex.: 124 mg num comprimido de 250 mg = `MEIO`, aproximado (AC4).
  - `faixaDeReferencia`: `{ mgKgMin, mgKgMax, origem, frequenciaHoras, duracaoUsualDias }`. `origem` `ESPECIE` (vence) ou `GERAL` (o bulário não traz a espécie, ou ela é proibida). Mostre ao lado do campo de dose.
  - `avisos`: do mais grave para o menos grave, cada um `{ codigo, bloqueante, cuidado, detalhe }`:

| `codigo` | Quando | `bloqueante` | `detalhe` |
|---|---|---|---|
| `ESPECIE_PROIBIDA` | O bulário contraindica o remédio na espécie | sim | a nota da espécie, traduzida |
| `ALERGIA` | Alerta de alergia do paciente casa com o princípio, em qualquer idioma (AC3) | sim | o texto do alerta |
| `PESO_AUSENTE` | Sem peso no pedido nem no cadastro | não | |
| `ACIMA_DA_USUAL` / `ABAIXO_DA_USUAL` | `mgPorKg` fora da faixa (da espécie, ou geral) | não | |
| `SEM_DOSE_DA_ESPECIE` | O bulário não traz a espécie: a faixa é a geral | não | |
| `CUIDADO` | Cuidado do remédio que casa com o paciente (`cuidado`: `RENAL`, `FILHOTE`...) | não | o texto do alerta, quando veio dele |

  - **`bloqueante: true`** não é bloqueio do servidor: a tela não segue sem o veterinário **confirmar explicitamente** (a receita, E4-03, vai registrar a confirmação). `exigeConfirmacao` resume se há algum.
  - `responsabilidade`: frase pronta, no idioma do pedido, dizendo que a conta é para conferência e que a dose e a decisão são do veterinário. **Mostre sempre junto da conta** (é a mitigação do risco Alto da spec).
- Medicamento global não revisado, desativado, de outra clínica ou inexistente, ou paciente de outra clínica: 403 sem `codigo`.
- Arredondamento (para os testes de tela baterem): mg por administração com 2 casas, quantidade com 2 casas, administrações por dia com 2 casas, total inteiro (mínimo 1), tudo meio para cima e em decimal exato.
- **Pronto quando:** o formulário de prescrição chama esta rota a cada mudança de dose, intervalo, duração ou peso (com debounce), mostra a conta em passos, a fração com a marca de aproximação, a faixa e os avisos, e `domain/dose.ts`, `domain/receita.ts` (`passosDaConta`, `fracionar`) e os avisos de `domain/bulario.ts` saem do portal.

### 1.6 Vacinas e o protocolo

`VacinaDto`: `{ id, origem, nome, fabricante, especies, dosesSerieFilhote, dosesSerieAdultoSemHistorico, idadeMinimaDias, essencial, vias, intervaloReforcoDias, intervaloEntreDosesDias, obrigatoria, estoqueMinimoPadrao, modoSerieFilhote, idadeMinimaUltimaDoseFilhoteDias, fonte, revisado, revisadoPor, revisadoEm, ativo }`.
- Renomeados do mock: `dosesNaSerie` virou `dosesSerieFilhote`, `dosesAdultoSemHistorico` virou `dosesSerieAdultoSemHistorico`, `estoqueMinimo` virou `estoqueMinimoPadrao`; o `INTERVALO_ENTRE_DOSES_DA_SERIE` (28) virou `intervaloEntreDosesDias`, por vacina.
- `vias`: `SUBCUTANEA`, `INTRAMUSCULAR`, `INTRANASAL`, `ORAL`... (a de rotina primeiro).
- **`modoSerieFilhote`** (pergunta clínica em aberto, regra das 16 semanas da WSAVA):
  - `FIXA`: `dosesSerieFilhote` doses, uma a cada `intervaloEntreDosesDias` (o que o mock faz hoje). Todas as vacinas de partida vêm assim.
  - `ATE_IDADE_MINIMA`: no mínimo `dosesSerieFilhote` doses, repetindo até uma ser dada com `idadeMinimaUltimaDoseFilhoteDias` ou mais (112 = 16 semanas).
  - O cálculo da próxima dose e do plano vacinal é da E4-04 (vacinação, seção 3): a API respeita os dois modos. Mostre o modo na tela de vacina; quando a seção 3 estiver ligada, `domain/protocolo-vacinal.ts` sai do portal.
- **Pronto quando:** a tela de vacinas e o seletor da aplicação leem do pacote, e `vacinasFixture` sai do caminho.

### 1.7 Acréscimos da clínica (DONO ou GESTOR)

O catálogo global é da PetJourney e só leitura para a clínica (D1). A clínica acrescenta o que é dela: um manipulado, uma vacina importada, um exame do laboratório parceiro, um código de diagnóstico próprio.

- **Listar os da clínica:** `GET /parceiro/portal/clinica/catalogos/acrescimos` devolve `{ medicamentos, vacinas, exames, diagnosticos }`, ativos e inativos, com o conteúdo como foi escrito e o `traducoes` cru (para editar).
- **Criar:** `POST /parceiro/portal/clinica/catalogos/{medicamentos|vacinas|exames|diagnosticos}` (aceita `Idempotency-Key`; mande uma por clique em "Salvar"). Resposta 201 com o item (`origem: PARCEIRO`).
- **Editar:** `PATCH .../catalogos/{tipo}/:id` com o que muda; `ativo: false` desativa (nada se apaga), `true` reativa. `null` em campo obrigatório: 400. No medicamento, `doses` **substitui** a lista inteira.
- Medicamento: `{ nome, principioAtivo, sinonimosDoPrincipio?, concentracao, unidadeApresentacao, apresentacao, classe, controle?, listaControle?, viasPermitidas, doseUsualMgKgMin, doseUsualMgKgMax, indicacoes?, contraindicacoes?, efeitosAdversos?, interacoes?, cuidados?, observacao?, fonte?, doses?, traducoes? }`; cada dose `{ especie, mgKgMin, mgKgMax, frequenciaHoras, duracaoUsualDias?, proibido?, nota?, traducoes? }`.
- Vacina: os campos da seção 1.6 (sem `id`, `origem` e revisão) e `traducoes?` (`nome` por idioma).
- Exame: `{ nome, grupo, traducoes? }`. Diagnóstico: `{ codigo, codigoExterno?, descricao, sistema?, traducoes? }` (código com letras, números, ponto e hífen, até 20).
- `traducoes` é opcional para a clínica: `{ "en-US": { campo: texto }, ... }`, locales `en-US`, `en-GB`, `es-419`, `sr-Latn` (sem cirílico) e `ar`. Sem tradução, o item aparece no português em todos os idiomas.
- **Só os campos que a entidade traduz, no mesmo formato e com os mesmos limites do português** (revisão de segurança v0.3):
  - medicamento: `nome` e `principioAtivo` (texto, 2 a 120), `apresentacao` (2 a 200), `observacao` (até 1000); `indicacoes`, `contraindicacoes`, `efeitosAdversos` e `interacoes` (lista de até 30 itens, cada um de 1 a 300);
  - vacina e exame: `nome` (2 a 120); diagnóstico: `descricao` (2 a 200); nota da dose: `nota` (até 300).
  - Texto vazio (`""`) = sem tradução naquele idioma (o campo sai). en-GB que não vier é copiado do en-US.
  - Fora disso: 400 `CATALOGO_TRADUCAO_INVALIDA` com `campo` (ex.: `en-US.nome`, `es-419.indicacoes[3]`, `doses.GATO.ar.nota`), `motivo` e o limite (`min`, `max` ou `aceitos`). `motivo`: `LOCALE_INVALIDO`, `FORMATO`, `CAMPO_DESCONHECIDO`, `TIPO` (lista onde é texto ou o contrário), `TAMANHO`, `ITENS_DEMAIS`, `CIRILICO`. Leve o foco ao campo.
- **Sinônimos do princípio:** até 20 **no total**, contando o princípio e as grafias que vêm das traduções do `principioAtivo` (a API junta os três). Passou: 400 `CATALOGO_SINONIMOS_DEMAIS` com `max` e `total`.
- Erros: ver seção 1.8.
- **Pronto quando:** a clínica (DONO ou GESTOR) cadastra, edita e desativa os próprios itens, e eles aparecem marcados como "da clínica" na busca e no pacote.

### 1.8 Erros desta seção

| `codigo` | Status | Quando | Extra |
|---|---|---|---|
| `CATALOGO_NOME_EM_USO` | 409 | Outro item ativo da clínica com o mesmo nome (sem diferenciar maiúscula) | `tipo` |
| `DIAGNOSTICO_CODIGO_EM_USO` | 409 | Código já usado por um diagnóstico ativo da clínica ou do catálogo global | `codigoClinico` |
| `DOSE_FAIXA_INVALIDA` | 400 | Dose mínima maior que a máxima | `especie` ou `campo` |
| `DOSE_ESPECIE_REPETIDA` | 400 | A mesma espécie duas vezes nas doses | `especie` |
| `VACINA_SERIE_INVALIDA` | 400 | `ATE_IDADE_MINIMA` sem a idade, ou `FIXA` com ela | `modoSerieFilhote` |
| `CATALOGO_TRADUCAO_INVALIDA` | 400 | Tradução com campo que a entidade não traduz, tipo errado, tamanho fora do limite, lista com mais de 30 itens, locale inválido ou cirílico no sr-Latn | `campo`, `motivo`, `min`/`max`/`aceitos` |
| `CATALOGO_SINONIMOS_DEMAIS` | 400 | Mais de 20 grafias do princípio, contando as traduções | `max`, `total` |
| (sem `codigo`) | 403 | Item de outra clínica, global (para editar) ou inexistente; paciente de outra clínica | |
| `SEM_PERMISSAO` / `CRMV_OBRIGATORIO` | 403 | Papel sem a permissão; dose sem CRMV | `permissao` |
| `MODULO_INATIVO` / `MODULO_SOMENTE_LEITURA` | 403 | Módulo Clínica desligado ou só de consulta | `modulo`, `reason` |

---

## 2. Curadoria do catálogo global no CMS (E4-02)

**Superfície:** `petjourney-cms`, área de admin (SystemAdmin). Tela nova "Catálogos clínicos".

O catálogo global entrou no dev a partir do protótipo do portal (34 faixas, 12 diagnósticos, 9 exames, 16 medicamentos com 34 doses, 6 vacinas), **todo marcado como não revisado**. Bulário não revisado não aparece para prescrição. A tela de curadoria é por onde o responsável técnico da PetJourney confere cada item, registra a fonte e libera.

### 2.1 Rotas (todas `JwtAuthGuard` + SystemAdmin)

| Rota | O quê |
|---|---|
| `GET /admin/catalogos-clinicos/{faixas,medicamentos,vacinas,exames,diagnosticos}?q=&especie=&revisado=&ativo=&pagina=&limite=` | Lista o global, paginado (`{ itens, total, pagina, limite }`, limite até 200). `revisado=false` = a fila de pendentes |
| `POST /admin/catalogos-clinicos/{tipo}` | Cria item global (nasce **não revisado**). Mesmo corpo dos acréscimos da clínica (guia seção 1.7); faixa: `{ vital, especie, porte?, faixaEtaria?, min, max, unidade, precisao?, fonte? }` |
| `PATCH /admin/catalogos-clinicos/{tipo}/:id` | Edita. **`motivo` obrigatório** (5 a 500 caracteres; sem ele: 400 `CURADORIA_MOTIVO_OBRIGATORIO` com `min` e `max`, e nada muda). Toda edição gera protocolo `CUR` com os campos que mudaram e o antes e o depois dos números clínicos (doses, proibido, cuidados, faixa). **Mudar qualquer campo além de `ativo` derruba a revisão** de faixa, medicamento e vacina (o item sai da prescrição até revisar de novo). Avise isso no botão salvar de item revisado |
| `POST /admin/catalogos-clinicos/{faixas,medicamentos,vacinas}/:id/revisao` `{ revisadoPor, fonte, motivo? }` | Revisão clínica: `revisadoPor` no formato `CRMV-SP 12345` (o CRMV do responsável técnico), `fonte` (bula, referência), `motivo` opcional. Devolve `{ protocolo, tipo, id, revisado, revisadoPor, revisadoEm, fonte }` |
| `POST /admin/catalogos-clinicos/{faixas,medicamentos,vacinas}/:id/revisao/revogar` `{ motivo }` | Tira a revisão (o item sai da prescrição), com motivo |

- Os itens do admin vêm no conteúdo canônico (pt-BR) com o `traducoes` cru, para editar os 6 idiomas lado a lado.
- **Editar pede o motivo**: o formulário de edição do item global tem um campo "Motivo da alteração" obrigatório, enviado como `motivo` no mesmo corpo do `PATCH`. O motivo vai para o protocolo `CUR` (nunca para o log). O código do protocolo não volta na resposta do `PATCH`; ele fica no `ProtocoloAdmin` do item (`entidadeId` = id do item).
- As traduções passam pelo mesmo validador da clínica (seção 1.7): só os campos da entidade, com os limites do português; erro 400 `CATALOGO_TRADUCAO_INVALIDA` com `campo` e `motivo`. O conteúdo de partida inteiro passa nele, então reenviar o `traducoes` que a lista devolveu funciona.
- **Revisar exige traduções completas** (D6): `nome`, princípio, apresentação, observação e cada lista com o **mesmo número de itens** do português, nos 5 idiomas além do pt-BR, mais a nota de cada dose. Faltando: 400 `REVISAO_TRADUCAO_INCOMPLETA` com `faltando` (até 20, ex.: `en-GB.contraindicacoes`, `doses.GATO.ar.nota`) e `totalFaltando`. Mostre a lista e leve aos campos.
- Revogar item que não está revisado: 409 `ITEM_NAO_REVISADO`. Faixa repetida (mesma espécie, sinal, porte e idade entre as ativas): 409 `FAIXA_DE_REFERENCIA_DUPLICADA`; mínimo acima do máximo: 400 `FAIXA_DE_REFERENCIA_INVALIDA`.
- Cada revisão e cada revogação geram protocolo `CUR-AAAA-NNNNNN`. O payload da revisão guarda o conteúdo exato que foi revisado; consulte pelo código em `GET /admin/protocolo/:codigo`, a rota que o CMS já usa (a lista por parceiro não traz estes, que são do catálogo, não de um parceiro).
- Acréscimos de clínica não aparecem aqui e não passam pela curadoria.

### 2.2 A tela

- Abas por tipo; filtro "pendentes de revisão" ligado por padrão em medicamentos, faixas e vacinas.
- No medicamento: os campos clínicos, as doses por espécie (com "proibido na espécie" e a nota), o regime de controle e a lista, os 6 idiomas lado a lado, e o bloco "Revisão" com CRMV, fonte e motivo.
- Na vacina: o protocolo inteiro, inclusive o modo da série de filhote (`FIXA` ou `ATE_IDADE_MINIMA` com a idade). A escolha entre os dois é **pergunta clínica em aberto** (regra das 16 semanas da WSAVA): não mude o padrão sem a resposta do responsável técnico.
- **Pronto quando:** o responsável técnico consegue achar os pendentes, corrigir o conteúdo e as traduções, revisar com CRMV e fonte e ver o protocolo, e o item revisado passa a aparecer na busca do portal.

---

## 3. Vacinação conectada no portal (E4-04)

Substitui no mock (`petjourney-admin`):
- `vacina-repository.ts` inteiro (`aplicar`, `registrarExterna`, `plano`, `lotesParaAplicar`, `listaDeChamada`, `aplicadas`, `doPaciente`, `naCarteirinha`);
- as regras de `domain/protocolo-vacinal.ts`, `domain/vacinacao.ts` (`proximaDose`, `situacaoDoReforco`, `reforcosDoPaciente`, `listaDeChamada`) e `domain/lote-na-aplicacao.ts`, que viraram golden tests na API (`src/vacinacao-clinica/regras/`);
- a prévia do celular (`CarteirinhaNoApp.vue`) passa a ler as rotas do app (seção 4), com o token de quem é dono do pet só na demonstração; na clínica real a prévia sai ou lê o plano da clínica (seção 3.3).

Apague a regra local quando a rota estiver ligada: a tela não calcula dose, série, próxima dose, situação nem validade.

### 3.1 Quem entra

- **Módulo:** Clínica ligado em todas as rotas (sem ele: 403 `MODULO_INATIVO`; só de consulta: as leituras funcionam, as escritas dão 403 `MODULO_SOMENTE_LEITURA`).
- **Permissão** (sem ela: 403 `SEM_PERMISSAO` com `permissao`):

| O quê | Permissão | Quem tem |
|---|---|---|
| Plano e histórico do paciente | `paciente.ler` | DONO, GESTOR, RECEPÇÃO, VETERINÁRIO, ENFERMAGEM |
| Aplicar, registrar de outro lugar, anular, lotes para aplicar | `vacina.aplicar` | DONO, VETERINÁRIO, ENFERMAGEM (sem exigir CRMV) |
| Aplicar **com** `marcarProxima` (cria agendamento) | `vacina.aplicar` e `agenda.escrever` | DONO, VETERINÁRIO (a ENFERMAGEM não marca: 403) |
| Aplicadas no período e lista de chamada | `agenda.ler` | DONO, GESTOR, RECEPÇÃO, VETERINÁRIO, ENFERMAGEM |

- Esconda "Aplicar vacina", "Registrar de outro lugar" e "Anular" pelo `GET /parceiro/portal/eu`; esconda "Marcar a próxima dose" no diálogo de aplicar para quem não tem `agenda.escrever` (revisão v0.3).
- **Paciente, vacina, profissional, tipo de atendimento ou aplicação de outra clínica (ou que não existe):** 403 sem `codigo`, sem dizer qual. A vacina pode ser do catálogo global ou acréscimo da própria clínica (E4-02).

### 3.2 Aplicar (`POST /parceiro/portal/pacientes/:id/vacinas/aplicar`)

Corpo: `{ vacinaId, loteCodigo, validadeLote, via, profissionalId, aplicadaEm?, observacao?, confirmarIdadeMinima?, marcarProxima? }`. Aceita `Idempotency-Key` (mande uma por clique em "Aplicar e registrar": a repetição devolve a mesma aplicação).

- **A dose não vem da tela.** A API calcula `dose`, `dosesNaSerie`, `tipoDeSerie` (`FILHOTE` ou `ADULTO`) e `proximaDoseEm` e congela na aplicação. O diálogo mostra o que o plano (3.3) diz que é a dose da vez; o "2 de 3" que a tela previu é o que a API grava.
- `loteCodigo` (até 40: letras, números, espaço, `.`, `/`, `-`, `_`) e `validadeLote` (`AAAA-MM-DD`) são **obrigatórios** na aplicação da clínica. Sem estoque (E6-01 ainda não existe), o lote é digitado; o seletor vem de 3.4.
- `via`: uma das `vias` da vacina no catálogo (fora delas: 409 `VIA_INVALIDA` com `viasPermitidas`). Defeito 2 do doc 13: nada de via fixa em subcutânea no atendimento.
- `profissionalId`: quem aplicou (qualquer profissional ativo da clínica, não só quem atende). Inativo: 409 `PROFISSIONAL_INDISPONIVEL`.
  - **O CRMV dele só vai ao app se a clínica o confirmou** (revisão v0.3): quem grava é o próprio profissional, ou é DONO ou GESTOR. Senão a dose vai ao app sem CRMV ("CRMV não confirmado") e com o nome de quem gravou. A resposta traz `crmvConfirmado`; mostre no diálogo, antes de gravar, "no app: CRMV não confirmado" quando o usuário escolhe outro profissional e não é DONO/GESTOR.
- `aplicadaEm` (ISO com offset): padrão agora; até 30 dias para trás; no futuro: 400 `APLICACAO_DATA_INVALIDA` (`reason`: `FUTURO`, `PASSADO_DEMAIS`, `ANTES_DO_NASCIMENTO`).
- **Lote vencido trava no servidor:** validade antes do dia da aplicação (na parede da clínica): 409 `LOTE_VENCIDO` com `validadeLote` e `aplicadaEm`. A validade vale até o fim do dia impresso.
- **Idade mínima:** antes dela, 409 `IDADE_MINIMA_NAO_ATINGIDA` com `aPartirDe`, `idadeMinimaDias` e `exigeConfirmacao: true`. Mostre "o paciente só tem idade para esta vacina a partir de {data}" e, se o veterinário confirmar, reenvie com `confirmarIdadeMinima: true` (a resposta traz o aviso `IDADE_MINIMA_CONFIRMADA`).
- **Uma dose por vacina por dia:** a mesma vacina de novo no mesmo dia: 409 `APLICACAO_REPETIDA` com `aplicacaoId` (abra a que já existe). Data anterior à última dose daquela vacina: 409 `APLICACAO_FORA_DE_ORDEM` com `ultimaEm` (registre em ordem ou anule a errada).
- Vacina desativada: 409 `VACINA_INATIVA`; de outra espécie: 409 `VACINA_FORA_DA_ESPECIE`. Paciente inativo, com óbito ou mesclado: 409 `PACIENTE_INATIVO`.
- **`marcarProxima`** `{ inicio, profissionalId, tipoId?, confirmarConflitos? }`: marca a próxima dose na agenda no mesmo gesto (decisão 6 do doc 13).
  - **Exige também `agenda.escrever`** (revisão v0.3): sem ela (a ENFERMAGEM), 403 `SEM_PERMISSAO` com `permissao: "agenda.escrever"` e **nada é gravado** (nem a dose). Não reenvie a mesma chamada: tire o `marcarProxima` ou peça a quem tem agenda.
  - Só quando a próxima dose cai em até **60 dias** e o horário escolhido também (o reforço anual vai para a lista de chamada): fora disso, 409 `PROXIMA_DOSE_FORA_DA_JANELA` com `limiteDias` e nada é gravado.
  - `tipoId` omitido: o primeiro tipo de atendimento ativo de `kind` `VACINA` da clínica; sem nenhum, 409 `MARCAR_PROXIMA_SEM_TIPO`.
  - O horário sai da mesma busca de horários livres do retorno (`GET .../agenda/sugestoes`). Feriado com a clínica fechada pede `confirmarConflitos: ["holiday-closed"]`, como no POST da agenda.
  - A agenda é chamada **depois** de a dose estar gravada. Se ela recusar (conflito bloqueante, profissional fora da agenda), a dose fica e a resposta diz: `marcacao: { status: "RECUSADA", codigo }`. Mostre "dose registrada; o horário não foi marcado: {motivo}" e ofereça marcar pela agenda. `MARCADA` traz `agendamentoId`; sem pedido, `NAO_PEDIDA`.
- Resposta 201 `ResultadoDaAplicacaoDto`: a aplicação (`AplicacaoDeVacinaDto`, 3.5) mais:
  - `publicacao: { publicada, motivo }`: `true` quando o paciente tem vínculo ATIVO com o app (a carteirinha do responsável mudou agora); `false` com `SEM_VINCULO_ATIVO` (fica só na clínica) ou `DOSE_EXTERNA`. Mostre "na carteirinha do app de {responsável}" só quando `publicada`.
  - `marcacao` (acima) e `avisos`: `LOTE_VENCE_HOJE`, `LOTE_VENCENDO` (até 60 dias: "é o primeiro a vencer: use este antes dos outros"), `IDADE_MINIMA_CONFIRMADA`.
- **Um push só por ato:** com a próxima dose marcada na mesma gravação, o responsável recebe só `VACINA_REGISTRADA_PELA_CLINICA` (nunca também um aviso de agendamento).

### 3.3 Plano vacinal, histórico e dose de outro lugar

- **Plano:** `GET /parceiro/portal/pacientes/:id/vacinas/plano` devolve `PlanoVacinalDto` `{ pacienteId, idadeEmDias, faixa, hoje, vacinas, opcionaisNaoIniciadas, atrasadas, devidas }`.
  - `vacinas[]`: `{ vacina, tipoDeSerie, situacao, aplicadasNaSerie, total, serieCompleta, doses, proxima }`, ordenadas por ação (`ATRASADA`, `DEVIDA`, `A_VENCER`, `NAO_INICIADA`, `AGUARDA_IDADE`, `EM_DIA`) e, dentro disso, pela ordem do catálogo. `vacina` tem `id, nome` (traduzido), `fabricante, obrigatoria, essencial, origem, revisado`.
  - `doses[]`: `{ numero, total, tipo (SERIE|REFORCO), estado, em, dias, aplicacaoId, agendamento }`. `estado`: `APLICADA`, `DEVIDA` (a data chegou, dentro da carência de 3 dias), `ATRASADA` (passou da carência: o mesmo relógio do `VACINA_ATRASADA` do app), `PREVISTA`, `AGUARDA_IDADE` (o `em` é o dia em que passa a caber: "a partir de {data}", nunca "atrasada"), `PENDENTE` (essencial nunca começada, com idade).
  - O tamanho da série segue o **modo do catálogo** (seção 1.6): `FIXA` ou `ATE_IDADE_MINIMA` (regra das 16 semanas). No segundo, a série pode crescer ou encurtar dose a dose ("2 de 4" vira "3 de 3" quando a dose atrasa); mostre o `total` que vier, sem explicar a regra na tela até a pergunta clínica ser respondida.
  - Opcional não iniciada fica em `opcionaisNaoIniciadas` (recolhida, nunca pendência). Vacina desativada no catálogo sai do que falta, mas a que o paciente já tomou continua no plano.
  - **Plano cortado** (revisão v0.3): `doses` traz as dadas, **a da vez e a seguinte** (ou o próximo reforço), nunca a série inteira prevista; desenhe os pontos pelo `total`. O plano tem teto de 64 KB: com `truncado: true`, faltam `vacinasOmitidas` vacinas do fim da lista (as que menos pedem ação) e `opcionaisOmitidas` opcionais; mostre "e mais N vacinas em dia". `atrasadas` e `devidas` são do plano inteiro.
- **Histórico:** `GET /parceiro/portal/pacientes/:id/vacinas` → `{ itens: AplicacaoDeVacinaDto[], truncado }`, da mais recente para a mais antiga, **anuladas inclusive** (com `anulada`), até 300 e 256 KB (`truncado`).
  - **`observacao` vem `null` para quem não tem `prontuario.ler`** (RECEPÇÃO e GESTOR, revisão v0.3): esconda o campo para esses papéis em vez de mostrar "sem observação".
- **Dose de outro lugar:** `POST /parceiro/portal/pacientes/:id/vacinas/externa` `{ vacinaId, aplicadaEm (AAAA-MM-DD, o dia do papel), local, aplicador?, procedencia (COMPROVANTE|RELATO), via?, profissionalId, observacao? }` (aceita `Idempotency-Key`).
  - **Sem lote** (nem campo): a clínica não aplicou. `profissionalId` é quem **transcreveu** e responde pelo registro.
  - Conta para o protocolo (a dose e a série saem do mesmo cálculo, pela data do papel) e entra na lista de chamada.
  - **Não vai para o app como vacina da clínica** (sem selo e sem push): o responsável a vê em `GET /tutor/clinica/vacinas` como `EXTERNA`, com o local e a procedência (seção 4).
  - Mesmas recusas de ordem, espécie, vacina inativa e paciente inativo de 3.2; data no futuro ou antes do nascimento: 400.

### 3.4 Lotes para aplicar

`GET /parceiro/portal/clinica/vacinas/:vacinaId/lotes-para-aplicar` → `{ estoque, hoje, lotes }`.
- **Sem estoque (E6-01), `estoque: false`:** os lotes são os já digitados nesta clínica para a vacina nos últimos 180 dias (até 20), com `saldo: null`. Quando o estoque existir, a mesma rota devolve a geladeira com saldo.
- Cada lote `{ codigo, validade, saldo, avaliacao: { pode, motivo, aviso, dias }, sugerido }`: os que podem primeiro, do que vence antes (`sugerido` em um só); os travados no fim (`motivo` `VENCIDO` ou `SEM_VALIDADE`), para não sumirem e alguém digitar à mão. `aviso` `VENCE_HOJE` ou `VENCENDO` (até 60 dias, a janela do estoque).
- O campo continua aceitando lote digitado; a trava do vencido é do servidor (3.2).

### 3.5 Anular, aplicadas e o formato da aplicação

- **Anular:** `POST /parceiro/portal/clinica/aplicacoes/:id/anular` `{ motivo (5 a 500) }` → 200 `AplicacaoDeVacinaDto` com `anulada: { em, motivo }`.
  - Nada se apaga: a aplicação fica no histórico, riscada. A dose anterior daquela vacina volta a ser a que cobra.
  - No app: a `Vacina` publicada sai, o lembrete da próxima dose sai, o lembrete que a aplicação tinha fechado volta a pendente, e o responsável recebe `CLINICA_ANULOU_REGISTRO` (sem nome de vacina).
  - O horário marcado para a próxima dose **fica na agenda** (a recepção decide; ele vem em `agendamentoProxima`). Ofereça "cancelar o horário da próxima dose" depois de anular.
  - Já anulada: 409 `APLICACAO_JA_ANULADA`. Com estoque (E6-01), a dose volta ao saldo do lote.
  - A aplicação mudou de ficha (o paciente foi mesclado enquanto a tela estava aberta): 409 `APLICACAO_ALTERADA`. Releia a ficha do paciente que ficou e ofereça anular de novo.
- **Aplicadas:** `GET /parceiro/portal/clinica/vacinas/aplicadas?de=&ate=&cursor=&limit=` (até 92 dias; senão 400 `VACINACAO_PERIODO_INVALIDO`; `limit` até 100, padrão 50; `proximoCursor`) → itens `{ id, aplicadaEm, paciente: { id, nome, especie }, vacina, origem, dose, dosesNaSerie, lote, profissional, anulada }`. É "o que a clínica fez" (farmacovigilância, conferência de lote).
- **`AplicacaoDeVacinaDto`:** `{ id, pacienteId, vacina, origem (CLINICA|EXTERNA), profissional: { id, nome, crmv }, aplicadaEm, lote: { codigo, validade } | null, via, dose, dosesNaSerie, tipoDeSerie, proximaDoseEm, agendamentoProxima: { id, inicio, status } | null, externa: { local, aplicador, procedencia } | null, observacao, crmvConfirmado, situacao, vigente, vacinaDaCarteiraId, anulada, criadaEm }`.
  - `profissional.crmv` é o do cadastro (dado interno); `crmvConfirmado` diz se ele foi ao app (revisão v0.3).
  - `situacao` (`EM_DIA`, `PROXIMO`, `VENCIDO`, `SERIE_INCOMPLETA`) só cobra na dose `vigente` (a última não anulada daquela vacina); as anteriores vêm `EM_DIA` (defeito 1 do doc 13).
  - Datas com o offset da clínica; `proximaDoseEm` e `validade` em `AAAA-MM-DD`.

### 3.6 Lista de chamada e o contador

- `GET /parceiro/portal/clinica/vacinas/chamada?situacao=&cursor=&limit=` → `{ hoje, itens, proximoCursor }`, do mais atrasado para o menos (`diasParaVencer` negativo = venceu).
  - Entram: `VENCIDO` (passou da carência de 3 dias, até 2 anos atrás), `SERIE_INCOMPLETA` (série aberta) e `PROXIMO` (reforço em até 30 dias). Quem está em dia não entra. `situacao` filtra uma delas.
  - Fica de fora: paciente inativo, com óbito ou mesclado, e vacina desativada.
  - Cada item: `{ aplicacaoId, paciente, cliente: { id, nome, telefone }, vacina, ultimaEm, proximaDoseEm, diasParaVencer, situacao, doseSeguinte, agendamentoProxima }`. O telefone é para ligar; a recepção tem `agenda.ler`.
  - Paginação por cursor (até 100 por página). Medido numa clínica de 3.000 pacientes e 24.000 aplicações: ~180 ms por página no dev, 29 KB por página de 50.
- **Contador `vacinasAtrasadas`** (E1-06) em `GET /parceiro/portal/pendencias?modulo=CLINICA`: os vencidos da lista de chamada (paciente ativo), tom `RISCO`, `rota` `/veterinario/vacinas`, para quem tem `agenda.ler`. Cache de 30 s, como os outros.

### 3.7 Erros desta seção

| `codigo` | Status | Quando | Extra |
|---|---|---|---|
| `LOTE_VENCIDO` | 409 | Validade antes do dia da aplicação | `validadeLote`, `aplicadaEm` |
| `VIA_INVALIDA` | 409 | Via fora das vias da vacina | `viasPermitidas` |
| `IDADE_MINIMA_NAO_ATINGIDA` | 409 | Antes da idade mínima, sem `confirmarIdadeMinima` | `aPartirDe`, `idadeMinimaDias`, `exigeConfirmacao` |
| `VACINA_FORA_DA_ESPECIE` / `VACINA_INATIVA` | 409 | Vacina de outra espécie; desativada no catálogo | `especies`; `vacinaId` |
| `APLICACAO_REPETIDA` | 409 | A mesma vacina no mesmo dia | `aplicacaoId` |
| `APLICACAO_FORA_DE_ORDEM` | 409 | Data anterior à última dose daquela vacina | `ultimaEm` |
| `APLICACAO_DATA_INVALIDA` | 400 | Futuro, mais de 30 dias para trás (clínica), antes do nascimento | `reason` |
| `PROXIMA_DOSE_FORA_DA_JANELA` | 409 | `marcarProxima` com a próxima dose ou o horário a mais de 60 dias | `limiteDias`, `proximaDoseEm?` |
| `MARCAR_PROXIMA_SEM_TIPO` | 409 | Sem `tipoId` e sem tipo `VACINA` ativo | |
| `APLICACAO_JA_ANULADA` | 409 | Anular de novo | |
| `APLICACAO_ALTERADA` | 409 | Anular uma aplicação que a mescla levou para outro paciente: releia a ficha | `reason: PACIENTE_MUDOU` |
| `SEM_PERMISSAO` | 403 | Aplicar com `marcarProxima` sem `agenda.escrever` (ENFERMAGEM); nada gravado | `permissao: agenda.escrever` |
| `VACINACAO_PERIODO_INVALIDO` | 400 | Aplicadas com mais de 92 dias ou fim antes do início | `maxDias` |
| `VACINACAO_TAXA_EXCEDIDA` | 429 | Mais de 300 escritas de vacinação por usuário por hora | `limite`, `tenteDeNovoEmSegundos` |
| `AGENDA_DATA_FORA_DO_LIMITE` | 400 | Data com ano fora de 2000 a 2100 | `campo` |
| `PACIENTE_INATIVO` / `PROFISSIONAL_INDISPONIVEL` | 409 | Paciente inativo, com óbito ou mesclado; aplicador inativo | `obito`; `reason` |
| (sem `codigo`) | 403 | Recurso de outra clínica ou inexistente | |

- **Pronto quando:** a ficha do paciente mostra o plano e o histórico da API; o diálogo de aplicar usa os lotes de 3.4, trata a idade mínima com confirmação e marca a próxima dose (só para quem tem `agenda.escrever`); "Registrar de outro lugar" grava sem lote; a lista de chamada e a tela "Vacinas" leem a API; anular funciona com motivo; o plano cortado mostra "e mais N"; e `vacina-repository.ts`, `protocolo-vacinal.ts`, `vacinacao.ts` e `lote-na-aplicacao.ts` saem do portal.

---

## 4. Carteirinha conectada no app (E4-04)

**Superfície:** `petjourney-app`. É o doc 14 do portal (`petjourney-admin/docs/clinico/14-carteirinha-visao-do-responsavel.md`) com o contrato real da API. Nenhuma tela nova: a carteira que já existe (`app/screens/vacina/lista.tsx`) passa a mostrar o que a clínica registrou e ganha o bloco de protocolo.

### 4.1 O que chega

- **A dose da clínica já está em `GET /vacina?petId=`** (E2-04): `origem: PARCEIRO`, `aplicadaNaClinica: true`, `lote`, `validadeLote`, `fabricante`, `dose`, `dosesNaSerie`, `via`, `parceiroId`, `profissionalNome`, `profissionalCrmv`, `gravadaPorNome` (revisão v0.3). `profissionalCrmv: null` numa dose da clínica = "CRMV não confirmado" (a clínica não confirmou o CRMV de quem aplicou); `gravadaPorNome` preenchido = quem gravou não é quem aplicou: mostre os dois. É **uma linha só** por aplicação (a publicação fecha o lembrete VACINA pendente de mesmo nome e cria a próxima dose como lembrete com a data da clínica). Somente leitura: esconda "editar" quando `origem = PARCEIRO` (PATCH dá 403 `REGISTRO_DA_CLINICA`); "remover do meu app" continua valendo.
- **`GET /tutor/clinica/vacinas?petId=`** → `VacinaAplicadaNaClinicaDto[]`: as doses que as clínicas com vínculo ATIVO registraram, inclusive as **de outro lugar** que elas transcreveram:
  - `{ id, petId, clinica: { id, nome }, origem, profissional: { nome, crmv } | null, gravadaPor: { nome } | null, vacina: { nome, fabricante, obrigatoria, essencial }, aplicadaEm, lote, validadeLote, via, dose, dosesNaSerie, proximaDoseEm, proximaDoseAgendada: { agendamentoId, inicio } | null, situacao, externa, vacinaDaCarteiraId }`.
  - **Autoria (revisão v0.3):** `profissional.crmv` (e `externa.registradaPor.crmv`) vem `null` quando a clínica não confirmou o CRMV: mostre "CRMV não confirmado". `gravadaPor` vem quando quem gravou não é o profissional do registro: "Aplicada por {profissional.nome} · registrada por {gravadaPor.nome}".
  - **Só as doses do vínculo** (revisão v0.3): entram as aplicadas ou registradas desde que este pet foi ligado à clínica, ou publicadas para ele. As de antes (o paciente da clínica pode ter sido ligado a outro pet) não vêm; o plano as conta (abaixo).
  - Teto de 256 KB (as mais antigas saem primeiro).
  - `vacinaDaCarteiraId` é a `Vacina` de `GET /vacina` que esta aplicação publicou: use para juntar o selo e a linha (nunca mostre as duas).
  - `situacao` já vem com a carência e **só a dose mais recente de cada vacina cobra** (a dose 1 de uma série já seguida pela 2 vem `EM_DIA`, sem horário). Não aplique `vacinaEstaAtrasada` de novo.
  - `externa`: `{ local, aplicador, procedencia (COMPROVANTE|RELATO), registradaPor: { nome, crmv }, registradaEm }`; na `EXTERNA`, `profissional`, `lote` e `validadeLote` vêm nulos. **Selo só na `CLINICA`** ("Aplicada · {clinica.nome}"); a externa mostra "Outro local · {local}" e "Registrada por {clínica} · comprovante conferido" ou "sem comprovante" (tom de atenção).
  - Sem clínica com vínculo: `[]`. Pet de outra pessoa: 403.
- **`GET /tutor/clinica/vacinas/plano?petId=`** → `PlanoVacinalDoPetDto[]`, **um por clínica** com vínculo ATIVO (o catálogo e as doses são de cada clínica; o contrato do portal previa um só): `{ petId, clinica, geradoEm, vacinas, opcionaisNaoIniciadas, atrasadas }`.
  - `vacinas[]`: `{ vacina, tipoDeSerie, situacao, aplicadasNaSerie, total, doses: [{ numero, total, tipo, estado, em, aplicacaoId, agendamento }], aplicadasAntesDoVinculo }`, com os estados e a ordem da seção 3.3.
  - **Revisão v0.3:** `doses` traz as dadas desde o vínculo, a da vez e a seguinte (não a série inteira: desenhe os pontos pelo `total` e `aplicadasNaSerie`); `aplicadasAntesDoVinculo` são doses que contam no plano mas não têm detalhe para este pet (mostre só "N doses anteriores registradas pela clínica").
  - Cada plano tem `truncado`, `vacinasOmitidas` e `opcionaisOmitidas` (teto de 64 KB por clínica e 256 KB na soma). Uma clínica que passou do teto total vem só com o cabeçalho (`vacinas: []`, `truncado: true`): peça `GET /tutor/clinica/vacinas/plano?petId=&clinicaId={clinica.id}` quando o responsável abrir aquele bloco.
  - O plano da clínica **vale mais** que o `intervaloProximaDose` do app (`constants/vacina-protocols.ts`) para o que ela registrou: o app não recalcula a próxima dose.
  - Calculado na hora (muda com o calendário); não guarde cópia. Pet sem clínica: `[]` (a carteira segue como é, sem o bloco).
- **Família com leitura** lê as duas rotas e não altera nada (403 em editar e apagar). Pet inativo some para a família, como no resto da E2-02.

### 4.2 A tela

- Bloco "Protocolo · {clínica}" acima dos cartões, uma linha por vacina em andamento ou que pede ação, com os pontos (`total` pontos, cheios até `aplicadasNaSerie`), a frase da dose da vez pelo `estado` ("Atrasada há N dias", "Dose para hoje", "A partir de {data}", "Ainda não começou", "Próxima dose {data}") e "Marcada {data}, {hora}" quando há `agendamento`. Opcionais não iniciadas numa linha pequena.
- Com mais de uma clínica, um bloco por clínica (a ordem é a do vínculo mais recente).
- Textos nos 6 idiomas (pt sem "tutor", sem travessão); os do portal (`clinico.vacinas.app.*`) servem de base.

### 4.3 Notificações

| Tipo | Quando | Copy (pt) | Rota na API (`ROTA_POR_TIPO`) |
|---|---|---|---|
| `VACINA_REGISTRADA_PELA_CLINICA` (E2-04) | A clínica aplicou (uma por ato; a dose de fora não avisa) | "Vacina de {pet} registrada" | `/screens/notifications` (o inbox, até o app mapear) |
| `CLINICA_ANULOU_REGISTRO` (E2-04) | A clínica anulou | "Registro de {pet} corrigido pela clínica" | `/screens/notifications` |
| **`VACINA_REFORCO_PROXIMO`** (novo, E4-04) | Cron diário: o reforço de uma vacina que a clínica **aplicou** entra nos 30 dias (uma vez por aplicação; nunca para dose de outro lugar, paciente com óbito, pet inativo ou sem vínculo ativo) | "Reforço de vacina de {pet} chegando" / "Uma vacina registrada pela clínica tem reforço nos próximos 30 dias. Abra a carteirinha para ver." | **`/screens/vacina/lista`**, com `?petId=` na `url` dos dados |

- No app, `services/notificacao/rotas-notificacao.ts` ganha `VACINA_REFORCO_PROXIMO` nos três mapas, na mesma release da API: o tipo em `TipoNotificacao`; a rota `/screens/vacina/lista` (com `petId` dos `dados`); `AFETA_HOME_POR_TIPO: false` (não muda o feed de lembretes); `PERFIL_POR_TIPO: "tutor"`.
- `dados` do novo: `{ parceiroId, petId, petNome, aplicacaoId, proximaDoseEm, url }`. Sem nome de vacina nem de clínica no push (P8 da receita).
- Teto (revisão v0.3): no máximo 6 avisos de vacina (registrada ou anulada) por pet por dia; passou, a carteira muda e o push não sai. O app sempre relê a carteira ao abrir, sem depender do push.
- Sugestão para quando a carteira mostrar a dose da clínica: `VACINA_REGISTRADA_PELA_CLINICA` pode passar a abrir `/screens/vacina/lista` também (a API troca a rota na mesma release do app; avise).
- **Pronto quando:** a carteira do Biscoito mostra "2 de 3" com o selo da clínica e o lote, a dose de fora sem selo, o bloco de protocolo com a 3ª dose marcada e a antirrábica em "A partir de", nenhuma vacina aparece duas vezes, o app não calcula próxima dose para o que veio da clínica, e o toque em `VACINA_REFORCO_PROXIMO` abre a carteira do pet certo.
