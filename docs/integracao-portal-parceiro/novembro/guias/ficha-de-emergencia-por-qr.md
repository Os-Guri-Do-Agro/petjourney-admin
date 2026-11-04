<!-- doc cmvkfnhte000iaod2sxws5l1u · "Spec: ficha de emergência pelo QR (L6)" · atualizado 2026-10-23T03:51:16.466Z · card PJ-4NARE1 -->

# Spec: Ficha de emergência pelo QR da coleira (L6)

**Status:** Concluído na API (2026-10-23); app e portal pelo handoff
**Autor:** Nicolas (via Claude)
**Criado em:** 2026-10-23
**Versão:** 0.2
**Origem:** card PJ-MNB2WW do Luís (L6), achado no protótipo PJ-QDDJOQ ("clínica que precisa de acesso na emergência, sem o responsável por perto")
**Relacionadas:** [../../q3/q3-2/carteirinha-publica-duas-camadas.md](../../q3/q3-2/carteirinha-publica-duas-camadas.md) (a camada pública de hoje), [portal-parceiro/e1-fundacao/03-profissionais-e-papeis.md](portal-parceiro/e1-fundacao/03-profissionais-e-papeis.md) (CRMV conferido), [portal-parceiro/e2-pacientes-e-ponte/02-vinculo-e-consentimento.md](portal-parceiro/e2-pacientes-e-ponte/02-vinculo-e-consentimento.md) (o QR na clínica)

---

## Visão Geral

O pet chega atropelado numa clínica e o responsável não atende. Hoje o QR da coleira abre a carteirinha pública, que desde setembro mostra só o que devolve o pet ao dono (sem alergia, remédio ou diagnóstico), e a clínica só consegue propor vínculo pela inbox.

Esta parte cria um segundo degrau, só para veterinário com **CRMV conferido**:
- o veterinário lê o QR no portal e informa o motivo;
- ele recebe uma ficha curta, com alergias, tratamentos contínuos, condições e peso;
- o responsável é avisado **na hora**, com o nome e o telefone da clínica;
- tudo fica registrado, e o responsável pode desligar a ficha do pet.

A carteirinha pública (primeiro degrau) não muda.

## Decisões

- **D1 Quem pode abrir.** Um membro de parceiro operacional (cadastro aprovado, não suspenso) que tenha um `Profissional` ativo ligado ao próprio usuário, com `conselho = CRMV` e `crmvConferidoEm` preenchido (selo dado pelo admin no CMS, com protocolo). Sem isso: 403 `EMERGENCIA_SEM_CRMV_CONFERIDO`.
- **D2 Como.** `POST /parceiro/portal/emergencia/ficha` com `{ publicSlug, motivo }`. É POST, e não GET, porque grava e avisa.
  - `motivo` é obrigatório, com 10 a 300 caracteres (por exemplo, "atropelamento, chegou inconsciente").
  - O `publicSlug` é o do QR da coleira (128 bits, não se adivinha). Ele **não** prova que a pessoa está com o pet: o QR do responsável lista os slugs dos pets, e a carteirinha costuma ser compartilhada. Por isso o controle não está no slug, e sim no CRMV conferido, no aviso na hora, no registro e no bloqueio por clínica (D9).
  - Pet inexistente, inativo, com a ficha desligada pelo dono, sem responsável ou com a clínica bloqueada: o mesmo 404 genérico, sem dizer qual.
- **D3 O que a ficha mostra:**
  - nome, foto, espécie (com o tipo para `OUTRO`), sexo, castrado e idade;
  - o peso mais recente, com a data;
  - alergias ativas (gatilho, categoria, reação e severidade);
  - tratamentos contínuos vigentes (remédio, dose, frequência e via);
  - condições ativas (diagnósticos: categoria e subtipo).
  **Não** entram contato do responsável, endereço, documentos nem histórico de consultas. O contato vai no sentido contrário (D5).
- **D4 Registro.** Toda abertura grava `AcessoEmergencia`: pet, parceiro, usuário, profissional, motivo, data e o nome e o telefone da clínica **como estavam na abertura**. O parceiro edita o perfil quando quiser, e a trilha que o responsável lê não pode mudar depois (senão a clínica troca o nome ou o telefone por outro e o registro antigo passa a mostrar o novo). O registro nunca é apagado pelo parceiro.
- **D5 Aviso na hora ao responsável:** notificação nova `EMERGENCIA_FICHA_ABERTA` (push e inbox; e-mail fica só para o funil do parceiro, pela política do `canal-email`).
  - O texto do push diz só que a ficha do pet foi aberta por uma clínica, sem o nome dela. Motivo: o dono do parceiro pode trocar o nome depois de aprovado, e um nome falso no push ("PetJourney Suporte") viraria golpe. É a mesma regra do `VINCULO_PROPOSTO`.
  - Na lista de acessos do app (D6) aparecem o nome da clínica e o telefone público (ou de plantão) gravados na abertura, o profissional com o CRMV e o motivo.
  - O push **fura o opt-out** de avisos clínicos e a **janela noturna**: é o controle da abertura, e a clínica abre a ficha de madrugada justamente quando o responsável não atende. Quem desligou lembrete de remédio continua sabendo, na hora, que a ficha foi aberta.
  - O responsável liga para a clínica; a clínica não recebe o telefone dele.
- **D6 O responsável no controle.**
  - `GET /tutor/emergencia/pets/:petId/acessos`: quem abriu a ficha, quando e o motivo (só o dono do pet).
  - `PUT /tutor/emergencia/pets/:petId/ficha` com `{ liberada: boolean }`: desliga ou religa a ficha do pet (`Pet.fichaEmergenciaDesligadaEm`).
  - A ficha nasce **ligada**, porque o valor dela está em existir quando ninguém lembrou de ligar.
- **D7 Tetos** (janela de 24 h, no banco): 10 aberturas por usuário e 30 por parceiro. Acima disso: 429 `EMERGENCIA_LIMITE`. A contagem roda sob duas travas, a do parceiro e depois a do usuário, sempre nesta ordem: dois veterinários da mesma clínica no limite não passam juntos, e a ordem fixa evita deadlock.
- **D9 Bloqueio por clínica.** O responsável bloqueia uma clínica pela rota que já existe para o vínculo (`POST /tutor/clinica/clinicas/:parceiroId/bloquear`, `DELETE` para desfazer). É o mesmo bloqueio (`BloqueioDePropostas`): a clínica bloqueada não abre a ficha de nenhum pet dele e também não manda proposta de vínculo. Ela não fica sabendo (recebe o 404 genérico). A lista de acessos traz `clinica.parceiroId` e `clinica.bloqueada` para o app oferecer o botão. É a defesa contra a clínica que guardou o slug: sem ela, a única saída seria desligar a ficha para todo mundo.
- **D10 Pet sem responsável** (órfão, sem `tutorId`): 404. Ninguém seria avisado nem veria o registro, e a D8 depende dos dois.
- **D8 Privacidade.** Dado clínico do pet não é dado pessoal de pessoa natural, mas a abertura é sensível para o responsável. Por isso há registro, aviso na hora, motivo obrigatório, opção de desligar e nenhum dado do responsável na ficha. O log do servidor não leva motivo nem dado clínico.

## Contrato

| Rota | Quem | O quê |
|---|---|---|
| `POST /parceiro/portal/emergencia/ficha` | membro com CRMV conferido | `{ publicSlug, motivo }` → `FichaDeEmergenciaDto` |
| `GET /tutor/emergencia/pets/:petId/acessos` | dono do pet | lista de `AcessoEmergenciaDto` (mais novos primeiro, até 50) |
| `PUT /tutor/emergencia/pets/:petId/ficha` | dono do pet | `{ liberada }` → `{ liberada }` |
| `POST` / `DELETE /tutor/clinica/clinicas/:parceiroId/bloquear` | responsável | bloqueia ou desbloqueia a clínica (já existia, E2-02); vale para a ficha (D9) |

Erros (com `codigo`): `EMERGENCIA_SEM_CRMV_CONFERIDO` (403), `EMERGENCIA_FICHA_INDISPONIVEL` (404), `EMERGENCIA_LIMITE` (429).
Notificação: `EMERGENCIA_FICHA_ABERTA` → o app abre a lista de acessos de emergência do pet.
Migrations aditivas: `20261023100100_ficha_de_emergencia` (tabela `AcessoEmergencia`, coluna `Pet.fichaEmergenciaDesligadaEm`, valor novo em `TipoNotificacao`) e `20261023100200_acesso_emergencia_clinica_gravada` (`clinicaNome`, `clinicaTelefone`).

## Acceptance Criteria

- [x] **AC1** Veterinário com CRMV conferido, com motivo válido e slug de pet ativo: 200 com a ficha da D3, sem contato do responsável.
- [x] **AC2** Membro sem profissional, profissional sem CRMV ou com CRMV não conferido: 403 `EMERGENCIA_SEM_CRMV_CONFERIDO`, nada gravado.
- [x] **AC3** Slug inexistente, pet inativo ou ficha desligada: o mesmo 404 `EMERGENCIA_FICHA_INDISPONIVEL`, nada gravado e nenhum aviso.
- [x] **AC4** Cada abertura grava `AcessoEmergencia` e emite `EMERGENCIA_FICHA_ABERTA` ao dono, com o nome e o telefone da clínica.
- [x] **AC5** O dono vê a lista; outro usuário recebe 403.
- [x] **AC6** Desligada pelo dono, a ficha some (AC3); religada, volta.
- [x] **AC7** A 11ª abertura do mesmo usuário em 24 h dá 429.
- [x] **AC8** `motivo` com menos de 10 caracteres: 400.
- [x] **AC9** Clínica bloqueada pelo responsável: o mesmo 404, nada gravado; desbloqueada, volta.
- [x] **AC10** A clínica que troca nome e telefone depois da abertura não muda a linha da lista.
- [x] **AC11** O push sai com a categoria clínica desligada e às 23h.
- [x] **AC12** Outro usuário não desliga a ficha (403).

## Testes

- Unit do service (AC1 a AC8), com mock do Prisma e do emissor.
- Smoke HTTP contra o banco de dev: parceiro e profissional com CRMV conferido, pet com alergia e tratamento, abrir a ficha, conferir o registro e o aviso, desligar e tentar de novo.
- Revisão de segurança (agente `security-auditor`) antes do commit.

## Revisão de segurança (2026-10-23)

O agente `security-auditor` revisou antes do commit. Nada crítico ou alto. Corrigido no mesmo commit:
- **Médio:** o slug não prova posse do pet, e a clínica que o guardou abria a ficha para sempre. Resolvido com a D9 e com a premissa da D2 corrigida.
- **Baixo:** nome e telefone da clínica lidos na hora (trilha reescrevível). Resolvido na D4.
- **Baixo:** o teto por parceiro não estava serializado. Resolvido na D7.
- **Baixo:** o opt-out de avisos clínicos calava o push. Resolvido na D5 (fura opt-out e noite).
- **Baixo:** faltavam testes de autorização do PUT e cenários no `qa/cenarios`. Criados (`qa/cenarios/emergencia-e-aberturas.json`).
- **Recomendação:** pet sem responsável. Decidido na D10.

Smoke HTTP: `scripts/smoke-emergencia-e-aberturas.ts`, contra a API local e o banco de dev.

## Fora do escopo

- Abrir a ficha sem conta no portal.
- Mudar a carteirinha pública.
- Mandar a ficha por e-mail ou PDF.

## Change Log

| Data | Versão | Mudança | Autor |
|---|---|---|---|
| 2026-10-23 | 0.1 | Criação a partir da L6 do card PJ-MNB2WW, com o desenho de dois degraus do protótipo | Nicolas (via Claude) |
| 2026-10-23 | 0.2 | Revisão de segurança: D9 (bloqueio por clínica), D10 (pet sem responsável), clínica gravada na abertura, duas travas, push que fura opt-out e noite | Nicolas (via Claude) |
