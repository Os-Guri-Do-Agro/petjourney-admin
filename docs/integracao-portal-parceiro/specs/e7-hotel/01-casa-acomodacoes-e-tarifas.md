# Spec: A casa do hotel (acomodações, tarifas, temporadas, serviços, política e exigências)

**Status:** In Review
**Autor:** Nicolas (via Claude)
**Criado em:** 2026-10-20
**Versão:** 0.1
**Épico:** [E7 hotel](../../../../../epicos/portal-parceiro-e7-hotel.md)
**Depende de:** [E1-02 módulos](../e1-fundacao/02-modulos-do-parceiro.md) (HOTEL), [E1-01 perfil](../e1-fundacao/01-perfil-publico-do-estabelecimento.md)

---

## Visão Geral

O que a operação configura antes da primeira reserva:
- **blocos** ("Ala A"), **tipos** (suíte, baia, gatil, coletiva) e **acomodações** (capacidade, porte máximo, espécies aceitas, recursos, minutos de higienização, tarifa, ativa ou desativada com motivo);
- **tarifas** com diária por porte e percentual de acompanhante;
- **temporadas** recorrentes, com percentual de acréscimo;
- **serviços** (banho, tosa, passeio extra, recreação individual, transporte, adestramento, medicação assistida), com preço e se é por diária;
- **política**: horários de entrada e saída, limite da meia diária, percentual da meia diária, percentual de sinal, dias de cancelamento sem custo;
- **exigências de admissão** por espécie, com validade em meses e se bloqueiam.

## Motivação

Tipos do portal: `Bloco`, `TipoDeAcomodacao`, `Acomodacao`, `Tarifa`, `Temporada`, `Servico`, `PoliticaDoHotel`, `Exigencia`, `ExigenciaKind` (`petjourney-admin/src/features/hotel/data/types.ts:46-283`, `:340-383`). Repositórios `catalogo-repository.ts` e `acomodacao-repository.ts`.

Decisões do portal que entram como regra:
- "o sistema não adivinha quantos leitos" vale também para acomodações;
- a temporada que vira o ano é **uma** faixa "como a operação digitou" (defeito D9 do hotel);
- a acomodação com história só se desativa;
- a exigência é dado, e não constante, "porque varia entre hotéis e muda com a legislação local".

---

## Decisões

- **D1 Porte usa o `PorteClinico`** da E2-01 (`MINI` a `GIGANTE`); porte máximo da acomodação filtra a vaga.
- **D2 Temporada recorrente sem ano** (`inicioMesDia`, `fimMesDia`, "20/12" a "05/01"); o cálculo trata a virada do ano.
- **D3 Exigência por espécie** com `validadeMeses` (nulo = não vence) e `bloqueia`; o `kind` mapeia para o nome da vacina no catálogo (E4-02) quando é vacina, para a R1 ler a carteirinha (E7-04).
- **D4 Dinheiro em centavos.**
- **D5 Política com limites** e defaults do protótipo.

## Modelo de dados (aditivo, resumo)

```prisma
enum RecursoAcomodacao { CAMERA CLIMATIZACAO AREA_EXTERNA PISO_AQUECIDO JANELA } // = RecursoDaAcomodacao do portal (types.ts:105-118)
enum MotivoAcomodacaoInativa { MANUTENCAO DESINFECCAO REFORMA EQUIPAMENTO OUTRO }
enum ServicoHotelKind { BANHO TOSA PASSEIO_EXTRA RECREACAO_INDIVIDUAL TRANSPORTE ADESTRAMENTO MEDICACAO_ASSISTIDA }
enum ExigenciaKind { VACINA_POLIVALENTE VACINA_ANTIRRABICA VACINA_TOSSE_CANIS VACINA_GIARDIA VERMIFUGO ANTIPULGAS EXAME_PARASITOLOGICO TERMO_RESPONSABILIDADE }

model BlocoDoHotel { id, parceiroId, nome, icone, ordem }
model TipoDeAcomodacao { id, parceiroId, nome, icone, ordem }
model Acomodacao { id, parceiroId, nome, blocoId, tipoId, capacidade Int, porteMaximo PorteClinico, especiesAceitas Especie[], recursos RecursoAcomodacao[], higienizacaoMinutos Int, tarifaId, ativa Boolean, motivoInativa?, detalheInativa?, inativaDesde?, jaRecebeuHospede Boolean }
model TarifaDoHotel { id, parceiroId, nome, diariaMiniCentavos, diariaPequenoCentavos, diariaMedioCentavos, diariaGrandeCentavos, diariaGiganteCentavos, acompanhantePercentual Int }
model TemporadaDoHotel { id, parceiroId, nome, inicioMesDia String, fimMesDia String, acrescimoPercentual Int }
model ServicoDoHotel { id, parceiroId, kind ServicoHotelKind, precoCentavos Int, porDiaria Boolean, ativo Boolean }
model PoliticaDoHotel { parceiroId @id, horarioDeEntrada String, horarioDeSaida String, limiteMeiaDiaria String, meiaDiariaPercentual Int, sinalPercentual Int, cancelamentoSemCustoDias Int, antecedenciaMinimaHoras Int }
model ExigenciaDoHotel { id, parceiroId, kind ExigenciaKind, especies Especie[], validadeMeses Int?, bloqueia Boolean, vacinaDoCatalogoId String? }
```

(Notação resumida; na migration, Prisma completo.)

## Rotas (`@ExigeModulo(HOTEL)`, `estabelecimento.editar` para escrita, `hotel.ler` para leitura)

| Método e rota | Descrição |
|---|---|
| `GET /parceiro/portal/hotel/catalogos` | Blocos, tipos, acomodações, tarifas, temporadas, serviços, política, exigências |
| `POST/PATCH/DELETE /parceiro/portal/hotel/blocos[/:id]`, `.../tipos[/:id]` (+ `mover` para ordem) | Sem apagar com acomodação ligada |
| `POST/PATCH /parceiro/portal/hotel/acomodacoes[/:id]` + `/desativar`, `/reativar`, `DELETE` (só sem história) | Acomodação ocupada não desativa (`ACOMODACAO_OCUPADA`) |
| `POST/PATCH/DELETE .../tarifas`, `.../temporadas`, `.../servicos`, `.../exigencias` | CRUD |
| `GET/PUT /parceiro/portal/hotel/politica` | Política |

## Acceptance Criteria

- [ ] **Given** temporada "Fim de ano" de 20/12 a 05/01 **Then** a leitura devolve uma faixa só, e o orçamento de 28/12 a 03/01 aplica o acréscimo em todas as noites.
- [ ] **Given** acomodação que já recebeu hóspede **When** apaga **Then** 409; desativa com motivo e data.
- [ ] **Given** acomodação ocupada agora **When** desativa **Then** 409 `ACOMODACAO_OCUPADA`.
- [ ] Preços aceitam só inteiro em centavos, maior ou igual a zero.

## Estratégia de Testes

- Unit: temporada com virada de ano, regras de cadastro (golden tests de `catalogo-repository.spec` e `acomodacao-repository.spec`).

## Arquivos Impactados

| Arquivo | Ação |
|---|---|
| `prisma/schema.prisma` + migration | Modificar |
| `src/hotel/casa/` (controllers, services) | Criar |

## Tasks

- [ ] **T1** Migration e seed da conta de demonstração
- [ ] **T2** CRUDs com ownership (`assertAcomodacaoDoParceiro` e afins)
- [ ] **T3** Política e exigências
- [ ] **T4** Testes e handoff

## Riscos e Mitigações

| Nível | Risco | Mitigação |
|---|---|---|
| Médio | Mudar a tarifa alterar reservas já orçadas | Orçamento congelado na reserva (E7-02, D2); a tarifa nova vale para orçamentos novos |
| Baixo | Temporada que vira o ano calculada errado | D2 com teste de virada |

## Rollout / Rollback

Aditivo e atrás do módulo (E1-02): nada aparece para parceiro sem o módulo ligado. Migration só cria tabelas e colunas; rollback é reverter o código, e as tabelas ficam sem leitor.

## Change Log

| Data | Versão | Mudança | Autor |
|---|---|---|---|
| 2026-10-20 | 0.1 | Criação | Nicolas (via Claude) |
