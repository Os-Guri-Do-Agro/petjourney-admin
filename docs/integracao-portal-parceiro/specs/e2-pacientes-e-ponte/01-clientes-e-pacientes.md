# Spec: Clientes e pacientes do parceiro

**Status:** Concluído (API em dev, 2026-10-21; front em novembro com o Luís)
**Autor:** Nicolas (via Claude)
**Criado em:** 2026-10-20
**Versão:** 0.4
**Épico:** [E2 pacientes e ponte](../../../../../epicos/portal-parceiro-e2-pacientes-e-ponte.md)
**Depende de:** [E1-02 módulos](../e1-fundacao/02-modulos-do-parceiro.md), [E1-03 permissões](../e1-fundacao/03-profissionais-e-papeis.md), [E1-04 contrato](../e1-fundacao/04-contrato-erros-e-rotas-publicas.md)

---

## Visão Geral

O cadastro que a clínica (ou o hotel) faz: o **cliente** (responsável pelo animal, com telefones, e-mail, CPF, preferência de contato e endereço) e o **paciente** (nome, espécie, raça, sexo, nascimento, castração, porte, peso, microchip, pelagem, foto, alertas). Isolado por parceiro, pesquisável por nome, telefone, CPF e microchip, compartilhado pelos módulos Clínica e Hotel.

## Motivação

O portal inteiro gira em torno desse cadastro: agenda, prontuário, vacinas, internação, hotel e migrador (`Pet`, `Tutor`, `PetAlert`, `EnderecoPostal`, `ContatoPreferido` em `petjourney-admin/src/features/clinico/data/types.ts:117-270`; `patientRepository.buscar/obter/criarPaciente` em `data/repositories/patient-repository.ts:86-533`). O hotel usa o mesmo cadastro com `PessoaAutorizada` e `VeterinarioDoPet` (`hotel/data/types.ts:490-516`).

---

## Research Findings

- **Do portal (lido, não editado):**
  - Endereço do responsável existe porque a receita controlada exige nome, documento e endereço do comprador (`types.ts:117-137`).
  - `telefoneSecundario` existe porque a internação não tolera "não consegui falar" (`types.ts:153-160`).
  - `sexo` e `nascimento` podem ser nulos porque a base importada não sabe (`types.ts:221-236`, doc 11).
  - `porte` é campo do paciente e não sai do peso: filhote de dogue alemão pesa 10 kg e é gigante (`types.ts:171-183`).
  - Alertas tipados (`alergia`, `agressivo`, `cronico`, `medicacao-continua`, `imunossuprimido`, `gestante`, `inadimplente`) com severidade.
  - O defeito D2 do doc 08 (busca por nome casava com todo telefone quando o termo não tinha dígito) é um caso de teste obrigatório aqui.
- **Na API:**
  - `Especie` = `CACHORRO`, `GATO`, `AVE`, `ROEDOR`, `COELHO`, `PEIXE`, `REPTIL`, `OUTRO` (+ `OtherInfo.tipoEspecie`), imutável depois do cadastro (`prisma/schema.prisma:1454-1464`).
  - O portal usa `canina`, `felina`, `ave`, `roedor`, `reptil`, `equina`: não tem coelho nem peixe, e a API não tem equino.
  - Porte da API só para cachorro e com 3 valores (`PorteCachorro`, `:1443-1447`); o clínico precisa de 5 (faixa de referência por porte).
  - `Sexo` = `MACHO`, `FEMEA`.

**Breaking changes:** nenhuma (tabelas novas).

## Decisões

- **D1 Espécie no enum da API.** `PacienteDoParceiro.especie` usa `Especie`; `especieOutra` (texto, obrigatório quando `OUTRO`) cobre equino, furão e afins. O mapa do portal é: `canina`→`CACHORRO`, `felina`→`GATO`, `ave`→`AVE`, `roedor`→`ROEDOR`, `reptil`→`REPTIL`, `equina`→`OUTRO` + "Equino". Coelho e peixe passam a existir para a clínica também.
- **D2 Porte clínico próprio.** `PorteClinico` = `MINI`, `PEQUENO`, `MEDIO`, `GRANDE`, `GIGANTE`, nulo = não informado. Não é publicado no app (o app tem `DogInfo.porte` de 3 valores, só para cachorro); a E2-04 converte quando publicar o cadastro na criação do pet.
- **D3 Castrado em três estados.** `castrado Boolean?` (nulo = não informado). O doc 11 do portal registrou que "castrado em branco entra como não" por falta disso.
- **D4 CPF validado e único por parceiro**, opcional. Telefones normalizados (só dígitos, com DDI), até 2. E-mail opcional.
- **D5 Paciente de um cliente só.** `clienteId` obrigatório. O hotel precisa do mesmo cadastro com "quem pode buscar" (`PessoaAutorizadaDoCliente`, 1-N) e contato de emergência.
- **D6 Nada se apaga.** Paciente e cliente com histórico só se **inativam** (motivo: óbito, transferido, duplicado, pedido do responsável). Óbito marca `obitoEm` e corta qualquer lembrete, oferta ou convite da clínica para aquele paciente (regra do doc 09 do portal, seção 10). Mesclar duplicados é operação própria (D7).
- **D7 Mesclar duplicados.** `POST .../pacientes/:id/mesclar { comPacienteId }`: move todo o histórico do segundo para o primeiro numa transação, deixa o segundo inativo com motivo DUPLICADO e um ponteiro `mescladoEm`. Mesmo para cliente.
- **D8 Exclusão a pedido (LGPD).** O titular pede ao parceiro (controlador). `DELETE` real só para quem não tem nenhum registro clínico; com registro, anonimização dos dados pessoais do cliente mantendo o prontuário (obrigação do veterinário de guardar a via dele), com protocolo.

### Decidido na implementação (v0.2)

- **D9 Busca sem acento.** `nomeBusca` (minúsculas, sem acento, um espaço) em cliente e paciente, gravado pelo service: "jose" acha "José". Ordem da lista por `(nomeBusca, id)`, com cursor de keyset em base64url. Sem cifra: id e nome são do próprio parceiro e o WHERE por parceiro vale sempre.
- **D10 Termo da busca** (`regras/busca.ts`):
  - termo com letra: nome do paciente ou do cliente (e microchip, quando não tem espaço);
  - termo só numérico com 3 ou mais dígitos: telefone, telefone secundário, CPF e microchip;
  - vazio ou só pontuação: não filtra;
  - lista padrão só com ativos (`ativo=false` mostra os inativos).
- **D11 Telefone internacional** (`regras/telefone.ts`), porque o parceiro pode ser de fora do Brasil:
  - com "+" ou "00": o número internacional como veio (8 a 15 dígitos);
  - sem DDI e com 10 ou 11 dígitos: brasileiro, ganha o 55;
  - fora disso: 400 `TELEFONE_INVALIDO` com o `campo`.
  - O nono dígito da base antiga fica para o migrador (E2-05).
- **D12 Cadastro comum a Clínica e Hotel.** `@ExigeModulo(QUALQUER_MODULO)` (extensão da E1-02): passa se um dos dois módulos der o acesso pedido; a recusa prefere "só consulta" a "inativo".
  - O `PermissaoParceiroGuard` passou a recusar `parceiroId` repetido na query e parceiro diferente do conferido pelo `ModuloGuard`.
- **D13 Histórico do paciente como registro** (`regras/historico.ts`, `HISTORICOS_DO_PACIENTE`): cada spec que cria tabela ligada ao paciente registra ali `mover` (para o mesclar) e `registroClinico`/`existe` (para a D8 e para travar a espécie).
  - Hoje só os alertas (`registroClinico: false`).
  - Item obrigatório no DoD de E3-02, E4-01, E4-04, E5-01 e E7-02.
- **D14 Espécie** muda enquanto nenhum módulo tiver registro clínico do paciente (409 `ESPECIE_IMUTAVEL`). OUTRO exige `especieOutra`; as outras espécies não guardam o texto.
- **D15 Inativar e reativar.** `inativar` não aceita DUPLICADO (só pelo mesclar), e OBITO exige `obitoEm`. `reativar` desfaz inativação e óbito por engano; mesclado não volta (409 `CADASTRO_MESCLADO`).
  - `PacientesParceiroService.assertPacienteAtivo` (409 `PACIENTE_INATIVO`) fica exportado para agenda, vacina e avisos.
- **D16 Mesclar.** Os campos vazios do que fica herdam os do duplicado; as duas linhas são travadas (`FOR UPDATE`, em ordem de id); entra na trilha (E1-05). No cliente, o CPF sai do duplicado antes de ir para o que fica (unique por parceiro).
- **D17 Anonimizar.** Protocolo `LGP` (`TipoAcaoAdmin.ANONIMIZACAO_CLIENTE_PARCEIRO`) emitido pelo DONO ou GESTOR, não por SystemAdmin, com payload sem dado pessoal. A resposta é `{ resultado: EXCLUIDO | ANONIMIZADO, protocolo }`.
  - Anonimizado: nome vira "Anonimizado", os dados pessoais saem, os autorizados são apagados e os pacientes ficam inativos.
- **D18 Foto.** O tipo vem dos primeiros bytes (o MIME declarado não vale): JPG, PNG, WEBP ou HEIC, até 8 MB, senão 400 `FOTO_INVALIDA` com `reason`.
  - Vai para o bucket privado de anexos do parceiro (`anexos-prestador`), na pasta `parceiros/<id>/pacientes/<id>`.
  - A ficha devolve URL assinada de 15 min; a lista devolve só `temFoto`. Falha do storage não derruba a ficha.
- **D19 Alerta e autorizado** não se apagam: o DELETE encerra (`ativo=false`).
- **D20 PATCH com `null` em campo obrigatório:** 400, e não 500 do Prisma (`recusarNulos`). O `PartialType` deixa `null` passar sem validação.

## Modelo de dados (aditivo)

```prisma
enum PorteClinico { MINI PEQUENO MEDIO GRANDE GIGANTE }
enum ContatoPreferido { WHATSAPP LIGACAO EMAIL }
enum AlertaPacienteTipo { ALERGIA AGRESSIVO CRONICO MEDICACAO_CONTINUA IMUNOSSUPRIMIDO GESTANTE INADIMPLENTE }
enum SeveridadeAlerta { INFO ATENCAO RISCO }
enum MotivoInativacaoCadastro { OBITO TRANSFERIDO DUPLICADO PEDIDO_DO_RESPONSAVEL OUTRO }

model ClienteDoParceiro {
  id                 String   @id @default(cuid())
  parceiroId         String
  nome               String
  cpf                String?  // só dígitos, validado
  telefone           String?  // E.164 sem +, ex. 5511987654321
  telefoneSecundario String?
  email              String?
  contatoPreferido   ContatoPreferido @default(WHATSAPP)
  cep                String?
  logradouro         String?
  numero             String?
  complemento        String?
  bairro             String?
  cidade             String?
  uf                 String?
  observacao         String?
  ativo              Boolean  @default(true)
  inativoMotivo      MotivoInativacaoCadastro?
  mescladoEmId       String?
  importacaoId       String?  // E2-05 (desfazer)
  criadoEm           DateTime @default(now())
  atualizadoEm       DateTime @updatedAt
  @@unique([parceiroId, cpf])
  @@index([parceiroId, nome])
  @@index([parceiroId, telefone])
}

model PacienteDoParceiro {
  id            String        @id @default(cuid())
  parceiroId    String
  clienteId     String
  nome          String
  especie       Especie
  especieOutra  String?
  raca          String?
  sexo          Sexo?
  nascimento    DateTime?     @db.Date
  nascimentoEstimado Boolean  @default(false) // "3 anos" vira data estimada (doc 11)
  castrado      Boolean?
  porte         PorteClinico?
  pesoKg        Decimal?      @db.Decimal(6, 2) // último aferido; histórico vem dos atendimentos
  microchip     String?
  pelagem       String?
  fotoCaminho   String?       // bucket privado do parceiro
  ativo         Boolean       @default(true)
  inativoMotivo MotivoInativacaoCadastro?
  obitoEm       DateTime?
  mescladoEmId  String?
  importacaoId  String?
  criadoEm      DateTime      @default(now())
  atualizadoEm  DateTime      @updatedAt
  @@index([parceiroId, nome])
  @@index([parceiroId, microchip])
  @@index([clienteId])
}

model AlertaDoPaciente {
  id         String             @id @default(cuid())
  pacienteId String
  tipo       AlertaPacienteTipo
  severidade SeveridadeAlerta
  detalhe    String             // ex.: princípio ativo da alergia
  ativo      Boolean            @default(true)
}

model PessoaAutorizadaDoCliente { // hotel: quem pode buscar
  id String @id @default(cuid())
  clienteId String
  nome String
  telefone String?
  documento String?
  relacao String?
  ativo Boolean @default(true)
}
```

## Rotas (todas com `@ExigeModulo` de qualquer módulo ligado e `@ExigePermissao`)

| Método e rota | Permissão | Descrição |
|---|---|---|
| `GET /parceiro/portal/pacientes?q=&especie=&ativo=&cursor=` | `paciente.ler` | Busca por nome do paciente ou do cliente, telefone (só quando o termo tem dígitos), CPF, microchip. Resposta: `PacienteResumo` (paciente, cliente, alertas, vínculo resumido, última visita) |
| `GET /parceiro/portal/pacientes/:id` | `paciente.ler` | Ficha completa (cliente, autorizados, alertas, vínculo) |
| `POST /parceiro/portal/pacientes` | `paciente.escrever` | Cria paciente, com `clienteId` existente ou `cliente` novo no mesmo corpo |
| `PATCH /parceiro/portal/pacientes/:id` | `paciente.escrever` | Atualiza (espécie só enquanto não houver atendimento) |
| `POST /parceiro/portal/pacientes/:id/inativar` | `paciente.escrever` | Com motivo; `OBITO` grava `obitoEm` e dispara o efeito da D6 |
| `POST /parceiro/portal/pacientes/:id/mesclar` | `paciente.escrever` + DONO ou GESTOR | D7 |
| `GET/PATCH /parceiro/portal/clientes/:id`, `POST .../clientes/:id/mesclar`, `POST .../clientes/:id/anonimizar` | idem | Cliente; anonimizar é D8, com protocolo |
| `POST/PATCH/DELETE /parceiro/portal/clientes/:id/autorizados` | `paciente.escrever` | Pessoas autorizadas a buscar |
| `POST/PATCH/DELETE /parceiro/portal/pacientes/:id/alertas` | `paciente.escrever` | Alertas |
| `POST /parceiro/portal/pacientes/:id/reativar` | `paciente.escrever` | v0.2: desfaz inativação ou óbito por engano |
| `POST /parceiro/portal/pacientes/:id/foto` / `DELETE .../foto` | `paciente.escrever` | Multipart sem DTO, mesmas regras da foto do diário (D18) |

Ownership novo: `assertPacienteDoParceiro(pacienteId, parceiroId)` e `assertClienteDoParceiro(clienteId, parceiroId)` no `OwnershipService`, com teste "outro parceiro" e "parceiro excluído".

## Acceptance Criteria

- [x] **Given** o termo "Rita" **When** busca **Then** só pacientes ou clientes com "Rita" no nome; nenhum casa por telefone (defeito D2 do doc 08 do portal como teste). *Golden test e integração.*
- [x] **Given** o termo "98411" **Then** casa por telefone e microchip. *Integração com dado gravado.*
- [x] **Given** paciente da clínica A **When** um membro da clínica B pede a ficha **Then** 403. *Integração (ficha, escrita, cliente); por HTTP no smoke do gate G1.*
- [x] **Given** dois clientes com o mesmo CPF no mesmo parceiro **Then** 409 `CPF_JA_CADASTRADO` com o id do existente (é do mesmo parceiro, não vaza nada). *Integração; o mesmo CPF em outro parceiro passa.*
- [ ] **Given** paciente com óbito registrado **Then** a agenda não aceita agendamento novo para ele (409 `PACIENTE_INATIVO`) e nenhuma notificação de lembrete, oferta ou convite da clínica sai para ele. *Parcial: `assertPacienteAtivo` pronto e testado; a agenda (E3-02) e os avisos (E3-06) ainda não existem e têm de chamá-lo.*
- [ ] **Given** mesclar A em B **Then** todo atendimento, vacina, internação e estadia de B passa para A na mesma transação, e B fica inativo `DUPLICADO`. *Parcial: o mecanismo (D13) e o que existe hoje (alertas, campos herdados, inativo com ponteiro) estão provados na integração; cada módulo entra no registro na spec dele.*
- [x] Espécie `OUTRO` sem `especieOutra` dá 400.

## Estratégia de Testes

- Unit: busca (com e sem dígitos, CPF com e sem máscara), validação de CPF, normalização de telefone, mesclar, anonimizar, óbito.
- Integration: mesclar em transação com registros nas tabelas dos módulos (quando existirem, o teste cresce com eles).
- Cenários: outro parceiro em cada rota com `:id`.

## Arquivos Impactados

| Arquivo | Ação |
|---|---|
| `prisma/schema.prisma` + migration | Modificar |
| `src/pacientes-parceiro/` (module, controllers, services, dto, `regras/busca.ts`, `regras/cpf.ts`, `regras/telefone.ts`) | Criar |
| `src/auth/services/ownership.service.ts` (+ spec) | Modificar (2 asserts) |

## Tasks

- [x] **T1** Migration (`20261021100000`)
- [x] **T2** Regras puras (busca, CPF, telefone) com os casos do portal como golden tests *(T1)*
- [x] **T3** CRUD de cliente e paciente, alertas, autorizados, foto *(T2)*
- [x] **T4** Inativar, óbito, mesclar, anonimizar *(T3)*
- [x] **T5** Ownership + cenários + `openapi:exportar` + handoff. Contrato exportado (373 caminhos) e smoke HTTP verde no gate G1

## Rollout / Rollback

Aditivo, atrás do módulo. Rollback reverte o código.

## Riscos e Mitigações

| Nível | Risco | Mitigação |
|---|---|---|
| Alto | Cadastro de um parceiro visível para outro (BOLA de tenant) | `assertPacienteDoParceiro` e `assertClienteDoParceiro` em toda rota com id; cenários "outro parceiro" e "ex-membro" |
| Médio | Mesclar duplicados mover histórico errado | Transação única, prévia do que vai mudar, e o paciente mesclado fica inativo com ponteiro (auditável e reversível à mão) |
| Médio | Anonimizar apagar dado que o veterinário precisa guardar | D8: só dados pessoais do cliente; o prontuário fica; exige protocolo |

## Change Log

| Data | Versão | Mudança | Autor |
|---|---|---|---|
| 2026-10-20 | 0.1 | Criação | Nicolas (via Claude) |
| 2026-10-21 | 0.2 | Implementação (T1 a T4) e decisões D9 a D20 | Claude |
| 2026-10-21 | 0.3 | Revisão de segurança da onda 1: mesclar apaga do duplicado os dados pessoais e o anonimizar segue a corrente de mesclados (M5); trilha em troca de responsável, alertas, autorizados e edição de cliente (M12); anonimizar passa com módulo só de consulta (B1); escrita trava a linha do cliente (B2); exclusão remove fotos e anonimização limpa microchip (B3); datas reais (B8); criação idempotente por releitura, sem guardar a ficha (M1); cuidador, banhista e adestrador sem `paciente.ler` até o E7 (M6) | Claude |
| 2026-10-21 | 0.4 | Gate G1: T5 fechada (`openapi:exportar`, smoke HTTP de pacientes e vínculo 35/35). Os dois AC parciais dependem da agenda e dos avisos (E3-02, E3-06) e dos módulos que entram no registro de mescla; concluída do lado da API | Claude |
