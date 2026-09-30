# 13 · Vacinas e carteirinha conectada

Aplicar vacina na clínica, com lote e validade, e ver o registro aparecer na carteirinha do
responsável no mesmo instante. **Mesma entidade, dois lados.**

O lado da clínica é protótipo navegável sobre a camada mocada, como o resto do módulo. O lado do
responsável é do `petjourney-app` e está especificado em
[14-carteirinha-visao-do-responsavel.md](./14-carteirinha-visao-do-responsavel.md); aqui ele
aparece como **prévia fiel**, ao lado da tela da clínica, montada só com o que o contrato entrega.

## Por que existe

É a prova mais fácil de mostrar e a mais difícil de copiar: a carteirinha do app já existe. Quando
a aplicação da clínica alimenta a carteirinha que o responsável já usa, o valor fica óbvio em cinco
segundos. Para copiar, o concorrente precisaria de um app de responsável com base instalada.

## Pronto quando

> Aplicar na clínica e ver a carteirinha do responsável mudar, nas duas telas lado a lado, na mesma
> demonstração.

Feito, em `/veterinario/paciente/:petId/vacinas`: a tela da clínica à esquerda e o celular à
direita. Ao aplicar, os dois mudam juntos — o protocolo avança, o histórico ganha a linha, e o
celular recebe o aviso, o cartão **Nova** com o selo da clínica e a próxima dose já marcada.
Verificado no navegador e coberto por teste (`carteirinha-conectada.spec.ts`).

---

## O que foi entregue

- [x] **Registro de aplicação:** vacina, **lote do estoque** (o vencido aparece travado, o que vence
      primeiro vem sugerido, dá para digitar um lote fora do estoque), validade, **aplicador**
      (qualquer profissional, não só quem atende) e **via** (as da vacina — a gripe canina é
      intranasal).
- [x] **Protocolo por espécie e idade**, com a **próxima dose já marcada**: a série de filhote ou de
      adulto sem histórico, a idade mínima de cada vacina, e o horário da próxima dose escolhido na
      agenda no mesmo gesto da aplicação.
- [x] **Carteirinha do responsável atualizando na hora, com o selo da clínica** — a prévia do app,
      lida do contrato.
- [x] **Alerta de dose atrasada nos dois lados**, com a mesma regra: na linha do protocolo, na frase
      do topo da carteira, no botão "Vacinas" do histórico do paciente, na lista de chamada, e na
      faixa de resumo do celular.
- [x] **Histórico com quem aplicou e onde**: aplicador e "nesta clínica", ou o local de fora com a
      procedência e quem transcreveu.

## Como usar

- **Carteira do paciente:** `/veterinario/paciente/:petId/vacinas`. Chega-se pelo botão **Vacinas**
  no histórico do paciente (com o selo de atraso), pela linha da tela **Vacinas** (aplicadas e em
  atraso levam para cá), e pelo botão **Carteira e app** dentro do atendimento.
- **Dentro do atendimento**, na etapa Conduta, o bloco de vacinação mostra o mesmo protocolo e abre
  o mesmo diálogo, com quem atende como aplicador e o atendimento ligado à dose.

## Roteiro de demonstração (2 minutos)

1. **Biscoito** (cão, 11 semanas, da Fátima) → Pacientes → Biscoito → **Vacinas**.
   - Mostrar o protocolo: V10 **1 de 3 no Pet Shop Amigo Fiel** (sem lote, comprovante conferido),
     **2 de 3 hoje**, 3 de 3 em 28 dias, reforço anual. Giárdia **só por relato**. Antirrábica **a
     partir de 03/10** — ainda não cabe.
   - Mostrar o celular à direita: a mesma sequência nos pontos, as duas doses de fora marcadas.
2. **Aplicar vacina.** O diálogo já vem com a V10, dose 2 de 3, o lote que vence primeiro, a via e
   o horário da terceira dose. Abrir a lista de lotes: o **V10-2409 vencido** está lá, travado.
3. **Aplicar e registrar.** Os dois lados mudam juntos: o aviso chega no celular, o cartão **Nova**
   entra com "Aplicada · PetJourney Clínica Veterinária" e o lote, os pontos viram `● ● ○`, e
   "Marcada 27/10 às 08:00" aparece dos dois lados.
4. **Pérola** (a consulta de hoje da Fátima) → Vacinas. "Antirrábica atrasada. O app de Fátima
   Gonçalves mostra o mesmo atraso." O celular: **Atrasadas 1**.
   - Aplicar pela linha da antirrábica: o **RAB-2503 vence em 45 dias** e o diálogo diz "é o
     primeiro a vencer: use este antes dos outros"; o **RAB-2410 vencido** está travado.
   - Aplicar: o atraso some dos dois lados ao mesmo tempo.
5. (Opcional) **Paçoca** (filhote na primeira consulta) → **Registrar de outro lugar**: a V10 do pet
   shop entra sem lote, e a série de filhote se abre a partir dela.

## Como a tela se organiza

A tela está no **acabamento da Visão geral**, como toda a ficha do paciente (resumo, histórico e
vacinas — ver `DESIGN.md`): o nome do pet no lugar da saudação, a frase do estado das vacinas em
degradê ("Antirrábica atrasada há 16 dias", "V10 para hoje"), as ações em pílula e cartões brancos
com título e ícone.

- **Uma ação principal: Aplicar vacina** (pílula cheia). **Registrar de outro lugar** é a
  segunda, contornada — é o que se faz uma vez por paciente, na primeira visita. As outras vistas
  da ficha vêm em seguida, com o número que as faz ser abertas.
- **Protocolo** — uma linha por vacina, na ordem do que pede ação. A urgência mora no **disco do
  ícone** e na frase ao lado ("Atrasada há 16 dias"), nunca na linha pintada. A sequência de doses
  só abre onde ela é a informação (série em andamento); o adulto em dia é uma linha só. Opcionais
  não iniciadas ficam recolhidas numa frase.
- **Histórico de aplicações** — tabela: quando, vacina (dose e via), lote e validade (ou "Sem
  lote · não aplicada aqui"), e quem e onde.
- **No app do responsável** — o celular, preso ao topo ao rolar, para os dois lados estarem sempre
  à vista. Em tela estreita ele desce para baixo da coluna da clínica.

Movimento só onde explica mudança: a linha nova entra no celular com 180 ms de opacidade e
deslocamento, e o aviso desce do topo. Nada disso acontece com movimento reduzido.

## O que é real e o que é encenado

| Real (roda, com teste) | Encenado |
|---|---|
| O protocolo: série pela idade na primeira dose, idade mínima, opcionais, próxima dose congelada | O catálogo de vacinas e os intervalos são fixos no código (`fixtures/vacinas.ts`) |
| A trava de lote vencido, no diálogo **e** no repositório | O estoque é o dataset plantado |
| O horário da próxima dose sai da mesma busca de horários livres do retorno | A notificação é a projeção do contrato, não um push de verdade |
| A prévia do celular lê o contrato (`projecao-do-responsavel.ts`), a mesma projeção que gera o JSON do app | O app real ainda não existe para esta tela (doc 14) |

## Casos difíceis

| Caso | Como o protótipo mostra |
|---|---|
| **Pet que tomou vacina em outra clínica** | "Registrar de outro lugar": sem campo de lote, com o local, quem aplicou lá, a procedência (**vi o comprovante** / **só o relato**) e quem transcreveu. No histórico: "Sem lote · não aplicada aqui" e "Comprovante conferido por Ana Ribeiro" ou "Só relato, sem comprovante". No celular: **Outro local**, sem selo; "sem comprovante" no tom de atenção. No comprovante impresso: "{local} (sem lote)". Não entra no estoque nem no giro. |
| **Lote vencido ou perto do vencimento** | O vencido com dose na geladeira aparece na lista **travado**, com o motivo, e uma frase diz que ele continua lá. O digitado à mão vencido trava o botão, com "Lote vencido em {data}. Não pode ser aplicado". O perto de vencer (≤ 60 dias, a mesma janela do estoque) é o **sugerido**, com "Vence em 45 dias. É o primeiro a vencer: use este antes dos outros". O repositório recusa lote vencido mesmo se a tela deixar passar. |
| **Filhote em protocolo múltiplo** | A sequência inteira — doses dadas (com o lugar, quando foi fora), a **da vez marcada como "agora"**, as previstas com data, e o reforço anual. A antirrábica antes das 12 semanas aparece como "A partir de {data}", nunca como atrasada. |

## Decisões

Marcadas as que valem discutir antes de virar regra de produto.

1. **Atraso é o mesmo relógio da API e do app** — `VENCIDO` só depois da carência de 3 dias
   (`CARENCIA_DE_ATRASO_EM_DIAS`, espelho do `AJUSTES.vacinaAtrasoDias` da API e do
   `VACINA_ATRASO_DIAS` do app). **Muda a lista de chamada:** quem venceu há 1 ou 2 dias passou de
   "vencido" para "a vencer". Com a tela da clínica ao lado do celular, a alternativa era a clínica
   dizer "atrasada" por três dias enquanto o app ainda dizia "próxima dose". *Discutível:* se a
   recepção quiser ligar no primeiro dia, o caminho é um recorte próprio ("venceu, na carência"), não
   uma segunda regra de atraso.
2. **A série é decidida pela idade na primeira dose e congelada na aplicação** (`dosesNaSerie`).
   Filhote (antes de 16 semanas): a série do catálogo (V10 com 3). Adulto sem histórico: a série
   curta (V10 com 2). Sem data de nascimento: adulto. Registros antigos mantêm o que tinham.
3. ***Discutível:* a regra das 16 semanas não está implementada.** O protocolo WSAVA pede a última
   dose do filhote com 16 semanas ou mais — quem começa com 6 semanas faria 4 doses. O protótipo usa
   série fixa por faixa, para a demonstração não mostrar "2 de 4" sem explicar por quê. Com a regra,
   a V10 do filhote passa a ter tamanho variável.
4. ***Discutível:* dose externa só por relato conta para o protocolo.** O sistema não decide
   revacinar; ele deixa a diferença visível nos dois lados. A alternativa (relato não conta) faria o
   sistema sugerir revacinação — decisão clínica que não é do formulário.
5. **Dose externa não tem lote.** Nem campo opcional: pedir o código convida a copiar de memória uma
   rastreabilidade que ninguém garante. *Discutível:* a carteirinha de papel costuma ter a etiqueta
   do lote — ela pode entrar na observação.
6. **A próxima dose é marcada só dentro de 60 dias** (dose da série). O reforço anual fica para a
   lista de chamada: a agenda não busca horário a um ano, e marcar tão longe é compromisso que
   ninguém lembra de ter feito.
7. **Um push por ato.** Quando a próxima dose é marcada na mesma gravação, sai só
   `VACINA_REGISTRADA_PELA_CLINICA` (que já diz o horário), não também `AGENDAMENTO_CRIADO_PELA_CLINICA`.
8. **A janela de "perto de vencer" é a do estoque (60 dias).** A primeira versão tinha 30 no diálogo
   e 60 no estoque — o mesmo frasco era "a vencer" numa aba e não tinha aviso na hora de usar.

## Defeitos encontrados no caminho (e corrigidos)

1. **A dose anterior de uma série cobrava para sempre no app.** A projeção calculava a situação de
   cada aplicação isolada: a dose 1 do filhote virava `VENCIDO` três dias depois da data, mesmo com a
   dose 2 já dada. Agora só a aplicação mais recente de cada vacina cobra; as anteriores vão
   `EM_DIA`, sem horário.
2. **O registro dentro do atendimento gravava a via fixa em subcutânea** e aceitava qualquer lote
   digitado, inclusive vencido. Passou a usar o mesmo diálogo, com a trava.
3. **O comprovante impresso não se atualizava** depois de vacinar dentro do atendimento — a lista
   que ele imprime era carregada uma vez só.
4. **O cabeçalho do paciente estourava a borda** em cartão estreito com três ações: o trilho media a
   fileira inteira numa linha. Corrigido no `ClinicPatientHeader` (vale para todas as telas que o
   usam).

## Onde está

| O quê | Arquivo |
|---|---|
| Protocolo (plano, série, idade mínima) | `src/features/clinico/domain/protocolo-vacinal.ts` |
| Lote na hora da aplicação | `src/features/clinico/domain/lote-na-aplicacao.ts` |
| Carência de atraso | `src/features/clinico/domain/vacinacao.ts` (`CARENCIA_DE_ATRASO_EM_DIAS`) |
| Aplicar, registrar externa, plano, carteirinha | `src/features/clinico/data/repositories/vacina-repository.ts` |
| Projeção para o app | `src/features/clinico/data/projecao-do-responsavel.ts` |
| Contrato | `src/features/clinico/contrato/responsavel.ts` — "Vacinas aplicadas na clínica" e "Carteirinha conectada" |
| Cenário (Biscoito, Pérola) | `src/features/clinico/data/seed-vacinacao.ts` |
| Tela | `src/pages/(accounts)/veterinario/paciente/[petId]/vacinas.vue` |
| Componentes | `src/features/clinico/components/vacinas/` — `PlanoVacinalLista`, `AplicarVacinaDialog`, `VacinaExternaDialog`, `CarteirinhaNoApp` |
| No atendimento | `src/features/clinico/components/prontuario/ProntuarioVacinacao.vue` |
| Testes | `domain/__tests__/protocolo-vacinal.spec.ts`, `lote-na-aplicacao.spec.ts`; `data/__tests__/carteirinha-conectada.spec.ts` |
| Dados do app | `docs/clinico/contrato/demo-responsavel.json` e `demo-carteirinha-aplicacao.json` (`npm run contrato:demo`) |

## Mudança no modelo

- `Vacina` ganhou `dosesAdultoSemHistorico`, `idadeMinimaDias`, `essencial` e `vias`.
- `AplicacaoVacina` ganhou `origem`, `dosesNaSerie` (congelado), `agendamentoDaProximaId`,
  `encounterId` e `externa`; `lote`, `validadeLote` e `via` ficaram anuláveis (dose externa).
- `ViaDeVacina` é tipo próprio, separado da via da receita — por causa da intranasal.
- A dose externa não conta no estoque nem no gráfico de consumo.

## Do lado do responsável

Em [14-carteirinha-visao-do-responsavel.md](./14-carteirinha-visao-do-responsavel.md): o que chega
(dose, plano, notificação), a carteira com o bloco de protocolo e o selo, as regras que o app não
pode quebrar e o gesto de "simular aplicação da clínica" no mock. O cenário da Fátima ganhou o
Biscoito e a antirrábica atrasada da Pérola (doc 09, seção 17).

## O que ainda não existe

- Regra das 16 semanas (decisão 3).
- Foto do comprovante na dose externa.
- Editar ou anular uma aplicação registrada por engano.
- Reação adversa ligada à aplicação (a farmacovigilância pergunta pelo lote; o registro existe, o
  evento não).
- O vínculo com a dose que o próprio responsável lançou no app antes de a clínica conhecer o pet.
