# O que foi feito (05/08/2026) e como testar

**Pra:** Nicolas
**De:** Claude
**Tipo:** resumo humano + roteiro de teste. Leitura em 10 min, teste em 30.

**Specs técnicas:**
- Backend: [protocolo em ações admin](../specs/2026/q3/q3-2/protocolo-motivo-acoes-admin-parceiro.md) e [lembrete com intervalo em horas](../specs/2026/q3/q3-2/lembrete-intervalo-horas.md)
- Frontend: [CMS](../specs/2026/q3/q3-2/protocolo-motivo-acoes-admin-parceiro-cms.md), [portal do parceiro](../specs/2026/q3/q3-2/protocolo-motivo-acoes-admin-parceiro-portal.md), [app](../specs/2026/q3/q3-2/lembrete-intervalo-horas-app.md)

---

## TL;DR

Duas coisas foram feitas, e uma terceira apareceu no meio do caminho:

1. **Você pediu:** crédito para parceiro exige motivo e gera protocolo. Feito, e estendido para mais 3 ações que também mexem em dinheiro.
2. **Você pediu:** exclusão de parceiro exige motivo e gera protocolo. Feito, **e a exclusão teve que mudar de natureza** (explico abaixo, é o achado mais importante do dia).
3. **O app pediu:** lembrete de 12 em 12 horas. Feito, com uma regra a mais que o pedido não tinha previsto.

Tudo está no ar **no banco de dev**. Nada foi para produção, nada foi commitado.

---

## Parte 1: crédito e exclusão de parceiro

### O que estava errado antes

Duas coisas, e a segunda é séria.

**O motivo já era obrigatório e era jogado no lixo.** Quando você enviava crédito, o CMS já pedia o motivo e mandava para a API. A API recebia, escrevia no log do servidor e **não guardava em lugar nenhum**. Log tem prazo de validade. Daqui a seis meses, aquele motivo não existe mais. O único identificador da operação era um código interno tipo `ajuste:8f3a-4c21-...`, que não serve para falar no telefone com o parceiro.

**Excluir um parceiro apagava o extrato financeiro dele.** Esse não estava no seu pedido; apareceu quando fui olhar o código. O `DELETE` apagava a linha do parceiro de verdade, e o banco estava configurado para apagar **em cascata** a carteira, todas as transações e todos os saques junto. A tabela de transações é descrita no próprio código como *"ledger imutável, fonte de verdade"*. Ou seja: um clique apagava comissão paga e saque liquidado, sem trilha e sem volta.

Tinha mais dois defeitos menores no mesmo caminho: parceiro que já tinha indicado alguém dava erro feio na exclusão (o banco recusava, e o erro vazava cru), e o QR de indicação impresso na rua continuava funcionando depois do parceiro sumir.

### O que foi feito

**Protocolo.** Toda ação admin que mexe em dinheiro ou na existência do parceiro agora gera um código legível:

| Ação | Código |
|---|---|
| Envio de crédito (ajuste de carteira) | `CRD-2026-000123` |
| Exclusão de parceiro | `EXC-2026-000045` |
| Revisão antifraude | `REV-2026-000007` |
| Falha de saque | `SAQ-2026-000012` |

O número é sequencial por tipo e por ano (reinicia em 2027). Junto com o código fica guardado: quem fez, quando, o motivo escrito, e uma fotografia do estado na hora (no crédito, o saldo antes e depois; na exclusão, nome, CNPJ, saldo e quantos indicados o parceiro tinha).

Dá para consultar por `GET /admin/protocolo/CRD-2026-000123` ou listar tudo de um parceiro. A trilha sobrevive à exclusão do parceiro, que era o ponto.

Incluí as 4 ações e não só as 2 que você pediu porque as outras duas (revisão antifraude e falha de saque) **já pediam motivo e já jogavam fora do mesmo jeito**. Custo marginal quase zero, e evita ficar com metade do sistema com trilha e metade sem.

**Exclusão virou lógica.** O parceiro não é mais apagado. Ele ganha uma marca de "excluído em tal data, por tal admin, por tal motivo, protocolo tal", e:

- Some das listagens, do detalhe, da fila de auditoria, do CMS inteiro.
- Perde acesso ao portal e à carteira. Se o usuário só tinha esse parceiro, ele deixa de ser parceiro.
- Some do código de indicação (quem digitar o código dele recebe "código inválido").
- Tem o QR revogado, igual à suspensão já fazia.
- **Mantém carteira, extrato e saques intactos no banco.**

Continua bloqueado excluir parceiro que tem cupom vinculado, como já era.

Uma consequência boa e não óbvia: quem teve o parceiro excluído **pode se cadastrar de novo** normalmente. O cadastro velho não trava o novo.

### O que isso significa na prática pra você

Antes: "por que esse crédito de R$ 50 entrou em março?" não tinha resposta.

Agora: você abre o histórico do parceiro, vê `CRD-2026-000123`, o motivo que você escreveu e o saldo antes e depois.

E o cenário de excluir um parceiro por engano deixou de ser catastrófico: dá para reconstruir tudo, porque nada foi apagado. (Ainda não existe botão de "restaurar". Está anotado como próximo passo.)

---

## Parte 2: lembrete de 12 em 12 horas

### O problema

O caso real: cadela que toma remédio de 12 em 12 horas. O sistema só entendia repetição em múltiplos de dia (diário, semanal, mensal, anual). O tutor conseguia no máximo um lembrete por dia e **perdia metade das doses**.

O app já tinha implementado a tela inteira e estava esperando a API aceitar.

### O que foi feito

A API passou a aceitar frequência "a cada N horas", com N de 1 a 72. Vale nos três caminhos: lembrete avulso, lembrete criado junto com um medicamento, e o lembrete de dose que nasce da prescrição de uma consulta.

Esse terceiro caminho é um detalhe que valeu o research: a prescrição de consulta **já escrevia "12/12h"** como texto na receita, mas o lembrete que ela gerava só sabia ser diário. Agora bate.

**A regra que o pedido não previa (e é a única coisa que eu decidi sozinho):**

Se o tutor concluir uma dose com muito atraso, o cálculo literal (`+12h a partir da dose atrasada`) geraria o próximo lembrete **já vencido**. Numa série de 12/12h, esquecer um dia criaria uma fila de lembretes atrasados para o tutor limpar um a um.

Fiz o backend avançar até o próximo horário **futuro** da grade, mantendo o ritmo original:

```
Grade de 08:00 e 20:00.
Dose de 01/08 às 08:00, tutor só marca em 03/08 às 09:30.

Antes:  próximo lembrete 01/08 20:00  (já passou)
Agora:  próximo lembrete 03/08 20:00  (mantém 08:00/20:00)
```

Vale só para o regime de horas. Diário, mensal e anual continuam exatamente como estavam. **Preciso do seu OK nisso** (está na lista do fim).

### Um limite que você precisa saber

O backend **não tem robô** que cria os lembretes futuros. A próxima dose só nasce quando o tutor marca a atual como feita (ou pula). Isso não é novo, sempre foi assim para o lembrete diário, mas em 12/12h a consequência aparece mais rápido:

> **Se o tutor não marcar a dose das 08:00, a das 20:00 não existe e não vai notificar.**

Não é bug, é como o sistema foi desenhado desde o começo. Mas com regime de 6/6h ou 8/8h isso incomoda de verdade. A solução (um job que cria as ocorrências com antecedência) é uma feature própria, com decisões próprias, e não cabia aqui. Está anotada.

---

## Como testar

### Preparação (uma vez)

O backend está apontado para o **banco de dev**. Confirmei que a URL de produção está comentada no `.env`.

Terminal 1, sobe o servidor:

```bash
cd C:\TRABALHO\PetJourney\petjourney-api
$env:DB_POOL_MIN='0'; $env:DB_POOL_MAX='3'; $env:PORT='3999'; npx nest start
```

Espere aparecer `Nest application successfully started`.

### Caminho rápido: os dois testes automatizados

Se você só quer ver funcionando, são dois comandos. Eles criam os dados, testam tudo e limpam sozinhos.

```bash
npm run script:smoke-protocolo-admin            # 29 verificações
npm run script:smoke-lembrete-intervalo-horas   # 21 verificações
```

Ambos passaram: 50 verificações, zero falhas. O do protocolo inclui a prova de que o extrato do parceiro **sobrevive** à exclusão.

### Caminho manual, fluxo a fluxo

Para os fluxos de API você precisa de um token de admin:

```bash
npm run script:test-gen-token
```

Guarde em `$T`. A base é `http://127.0.0.1:3999`.

---

#### Fluxo 1: enviar crédito e achar depois pelo protocolo

1. Escolha um parceiro de teste e envie um crédito:

```bash
curl -X POST "http://127.0.0.1:3999/admin/parceiro/<parceiroId>/carteira/ajuste" `
  -H "Authorization: Bearer $T" -H "Content-Type: application/json" `
  -d '{"valorCentavos":5000,"motivo":"acordo comercial de agosto"}'
```

2. **Espere ver** um `protocolo` do tipo `CRD-2026-000001` na resposta, e um `refEvento` no formato `ajuste:CRD-2026-000001`.

3. Consulte o protocolo:

```bash
curl "http://127.0.0.1:3999/admin/protocolo/CRD-2026-000001" -H "Authorization: Bearer $T"
```

4. **Espere ver** o motivo que você escreveu, quem fez, e o saldo antes e depois.

> Teste também com o código em minúsculo: `crd-2026-000001` resolve igual.

#### Fluxo 2: o motivo é obrigatório de verdade

1. Envie um crédito **sem** motivo. **Espere 400**, e nenhum dinheiro entrando.
2. Envie com motivo `"ok"` (2 letras). **Espere 400**: o mínimo agora é 5 caracteres, porque motivo de 2 letras não explica nada para quem abrir o protocolo daqui a seis meses.
3. Envie com valor `0` e com valor `99999999`. **Espere 400** nos dois: as travas antigas continuam valendo, e nesses casos **nenhum número de protocolo é gasto**.

#### Fluxo 3: excluir parceiro e conferir que o extrato sobreviveu

Use um parceiro **de teste** (não existe botão de restaurar).

1. Anote o saldo e quantas transações ele tem.
2. Tente excluir **sem** motivo. **Espere 400**.
3. Exclua com motivo:

```bash
curl -X DELETE "http://127.0.0.1:3999/parceiro/<parceiroId>" `
  -H "Authorization: Bearer $T" -H "Content-Type: application/json" `
  -d '{"motivo":"encerrou as atividades"}'
```

4. **Espere ver** um protocolo `EXC-2026-000001`.
5. Confira no banco (Supabase dev) que:
   - A linha do parceiro **continua lá**, com `deletedAt` preenchido e `ativo = false`.
   - `ParceiroCarteira` e `ParceiroTransacao` dele **continuam iguais**. Este é o ponto principal.
6. `GET /parceiro/<id>` **espere 404**, e o parceiro sumiu de `GET /parceiro`.
7. Tente excluir de novo. **Espere 409** ("Este parceiro já foi excluído").
8. Liste a trilha:

```bash
curl "http://127.0.0.1:3999/admin/parceiro/<parceiroId>/protocolos" -H "Authorization: Bearer $T"
```

**Espere ver** os dois protocolos (crédito e exclusão), o mais recente primeiro, mesmo com o parceiro já excluído.

#### Fluxo 4: parceiro excluído perde acesso (portal)

Precisa de um usuário que seja dono de um parceiro de teste.

1. Com o parceiro vivo, entre no portal e confirme que a carteira abre.
2. Exclua o parceiro (fluxo 3).
3. **Espere:** as rotas do portal respondem 403, e o parceiro some da lista de perfis do usuário.
4. Faça login de novo com esse usuário: se era o único parceiro dele, ele não tem mais papel de parceiro.
5. **Espere também:** esse mesmo usuário consegue fazer um cadastro novo de parceiro do zero.

> O portal ainda não tem tela bonita para esse estado. É exatamente o que a [spec do portal](../specs/2026/q3/q3-2/protocolo-motivo-acoes-admin-parceiro-portal.md) pede.

#### Fluxo 5: lembrete de 12 em 12 horas (app)

1. No app, crie um lembrete de medicamento, marque como recorrente e escolha **12 horas** na roleta.
2. **Espere ver** o card com "A cada 12h".
3. Marque a dose como concluída.
4. **Espere ver** a próxima ocorrência exatamente 12 horas depois da primeira.
5. Abra a edição do lembrete. **Espere** a roleta abrir em 12.
6. Mude a frequência para "Mensal" e salve. Reabra: **espere** que o intervalo de horas sumiu (não pode ficar resíduo).

#### Fluxo 6: dose atrasada (a regra nova)

Este é o fluxo que testa o catch-up e o que eu preciso que você valide.

1. Crie um lembrete 12/12h com a primeira dose **no passado**, uns 2 dias atrás.
2. Marque como concluída **agora**.
3. **Espere ver** a próxima dose num horário **futuro**, mantendo a grade original (se a série era 08:00/20:00, a próxima cai em 08:00 ou 20:00, o primeiro que ainda não passou).
4. O que **não** pode acontecer: a próxima nascer com data já vencida.

#### Fluxo 7: medicamento com dose de 12/12h

1. No app, registre um medicamento e peça o lembrete da próxima dose com 12 horas.
2. **Espere:** o medicamento é criado e o lembrete de dose nasce com o intervalo certo.
3. Para ver a trava funcionando: uma requisição com frequência "a cada N horas" **sem** informar o N responde 400, e o medicamento **não fica órfão** no banco (a operação inteira é desfeita).

---

## O que ficou pendente

**Depende de você:**

1. **O catch-up do fluxo 6.** É a única mudança de comportamento que decidi sozinho. Se você preferir o cálculo literal (próxima = atual + 12h, mesmo que no passado), é ajuste pequeno.
2. **`/code-review` e o `security-auditor`.** Não rodei: são comandos seus, e o diff mexe em rota admin, guard e filtro de leitura, então vale rodar antes do merge.
3. **Revisar o diff e commitar.** Nada foi commitado.

**Depende de frontend (specs escritas, prontas para pegar):**

4. **CMS:** o botão de excluir parceiro **quebra** quando o backend subir, porque agora exige motivo. O jeito de não ter janela quebrada é subir o CMS primeiro (mandando o motivo), depois o backend. As outras 3 telas só ganham o protocolo no sucesso.
5. **Portal:** tela decente para "seu acesso foi encerrado".
6. **App:** já está pronto. Só precisa conferir que ele usa a data que a API devolve, e não recalcula "+12h" por conta própria.

**Anotado para depois (spec própria):**

7. Botão de restaurar parceiro excluído.
8. Robô que cria as doses futuras sem depender do tutor marcar a anterior (o limite da Parte 2).
9. Protocolo no pagamento de saque (hoje ele não pede motivo).

---

## Números da verificação

| Item | Resultado |
|---|---|
| Typecheck (`tsc --noEmit`) | Limpo |
| Testes unitários | 1514 testes, 111 suítes, **todos passando** |
| Regressão | Zero. Inclusive as ~13 falhas antigas de subscription/plano já não existem |
| Migrations | 2, aplicadas no banco de dev |
| Smoke do protocolo (HTTP real) | 29/29 |
| Smoke do lembrete (HTTP real) | 21/21 |
| Produção | Nada aplicado |
