# Cards do Luís no quadro de novembro (Nevo), copiados em 04/11/2026

Descrição e comentários de cada card e subtarefa, como estavam no Nevo. Os guias anexados estão em `guias/` (a versão mais nova de cada um). Fonte da verdade continua sendo o Nevo: reconfira antes de começar um card.


---

# VK5P13

## PJ-VK5P13 · Portal: convite aberto com a conta errada pede para entrar com a conta certa

- id: cmw1iydpt0000pcd2nivk5p13
- status: TODO
- pai: -
- responsáveis: Luis Gustavo
- prioridade: 3
- prazo: 2026-11-07T12:00:00.000Z
- criado: 2026-11-04T02:55:48.064Z · atualizado: 2026-11-04T02:55:48.064Z
- tags: portal-parceiro

### Descrição

<p><strong>O que é:</strong> quem abre o link do convite logado com uma conta que já é da equipe (por exemplo, o dono testando no próprio navegador) hoje vê "Você já faz parte da equipe" e perde o convite. A tela passa a dizer que o convite é para outra conta e oferece entrar com a conta certa, sem perder o link. O aviso de sucesso também muda: "Agora você faz parte da equipe da {empresa}".</p><p><strong>Por que:</strong> no teste de 04/11 o convite parecia recusado por a conta já ter uma empresa. Não é isso: uma conta pode estar em várias equipes. Faltava a tela saber quem estava logado.</p><p><strong>Depende de:</strong> nada. A API já está no develop e na API de dev desde 04/11 (97110aee).</p><p><strong>Pronto quando:</strong> </p><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>O dono convida outra conta e abre o link no próprio navegador: a tela diz "Este convite é para outra conta", sem o botão de aceitar.</p></li><li data-type="taskItem" data-checked="false"><p>"Entrar com outra conta" sai da sessão, e depois do login com a conta convidada o convite volta, sem abrir o e-mail de novo.</p></li><li data-type="taskItem" data-checked="false"><p>A conta convidada aceita e vê "Agora você faz parte da equipe da {empresa}". O portal abre nessa empresa.</p></li><li data-type="taskItem" data-checked="false"><p>Quem já está na equipe e abre o próprio link de novo vê "Você já faz parte da equipe da {empresa}", e o convite some da lista de pendentes do dono.</p></li></ul><p><strong>Para quem implementa:</strong> tudo no guia anexado:</p><ul><li><p>POST /parceiro/portal/equipe/convites/previa-por-link devolve contaConectada { jaFazParte, papelAtual, paraEstaConta };</p></li><li><p>aceitar-por-link: 200 com jaEraMembro, ou 409 CONVITE_CONTA_JA_NA_EQUIPE (o convite segue valendo; não esquecer o token);</p></li><li><p>textos novos em parceiro.convite nos 6 idiomas; atualizar o convite.spec.ts, que testa EQUIPE_JA_MEMBRO.</p></li></ul>

### Documentos

- [principal] Handoff de front: convite com a conta conectada · convite-equipe-conta-conectada.md · id cmw1iyea50001pcd26w5vejyx · atualizado 2026-11-04T02:55:48.941Z

### Documentos herdados

(nenhum)

### Subtarefas

(nenhuma)

---

# AVULSOS

## PJ-2A900A · Protótipo: ficha de emergência aberta pelo QR da coleira

- id: cmt2bkhac028u1hqfsb2a900a
- status: TODO
- pai: PJ-QDDJOQ (cmt2bkgxr028s1hqfsbqddjoq)
- responsáveis: Luis Gustavo
- prioridade: 4
- prazo: 2026-11-14T12:00:00.000Z
- criado: 2026-08-21T02:17:41.506Z · atualizado: 2026-10-27T13:05:45.184Z
- tags: 

### Descrição

O QR da coleira abre uma ficha mínima e pública: alergias, medicação contínua, condições e contato. Sem login, porque na emergência ninguém faz login. Definir exatamente o que é público e o que não é.

### Documentos

(nenhum)

### Documentos herdados

- Spec: quem abriu o acesso temporário (L5) · acesso-temporario-aberturas-para-o-responsavel.md · id cmvkfno4j000vaod26j96yake
- Spec: ficha de emergência pelo QR (L6) · ficha-de-emergencia-por-qr.md · id cmvkfnokg000waod2fbtkmm4u

### Subtarefas

(nenhuma)

## PJ-3GVTOI · App: ficha de emergência do pet (aviso, quem abriu, desligar e bloquear clínica)

- id: cmvkfni99000jaod26t3gvtoi
- status: TODO
- pai: -
- responsáveis: Luis Gustavo
- prioridade: 3
- prazo: 2026-11-13T12:00:00.000Z
- criado: 2026-10-23T03:51:16.896Z · atualizado: 2026-10-23T04:14:29.669Z
- tags: app

### Descrição

**O que é:** Quando uma clínica abre a ficha de emergência do pet, o responsável recebe o aviso na hora e vê quem abriu (clínica, telefone, profissional com CRMV e o motivo). Ele liga para a clínica, desliga a ficha do pet ou bloqueia aquela clínica. Lado do app da L6 do card PJ-MNB2WW.
**Rotas:**

- `GET /tutor/emergencia/pets/{petId}/acessos`: o interruptor e a lista;

- `PUT /tutor/emergencia/pets/{petId}/ficha` com `{ liberada }`: desligar ou religar;

- `POST` e `DELETE /tutor/clinica/clinicas/{parceiroId}/bloquear`: bloquear e desbloquear a clínica (a rota do vínculo, que já existe).
**Aviso:** notificação `EMERGENCIA_FICHA_ABERTA` (`dados: { petId, petNome, acessoId }`). Hoje abre a caixa de entrada; quando a tela nova existir, mande a rota para o Nicolas trocar na API.
**Primeiro passo, que pode ir já:** pôr `EMERGENCIA_FICHA_ABERTA` em `services/notificacao/rotas-notificacao.ts`: no tipo `TipoNotificacao` e nos três mapas (`ROTA_INBOX`, `false`, `"tutor"`). São 4 linhas, e o hook da API acusa o tipo até lá. Detalhe na seção L6 (App) do handoff.
**Onde está a API:** no `develop` e na API de dev desde 22/10 (commit `b8d5c2b`); em produção quando o Nicolas subir o `develop` para o `master`.
**Pronto quando:**

- abrir a ficha pelo portal faz o celular do responsável apitar;

- a tela do pet mostra a abertura, com "Ligar";

- com a ficha desligada, o portal recebe "Ficha indisponível";

- com a clínica bloqueada, também.
**Para quem implementa:** seção L6 (App) do handoff anexado. Textos nos 6 idiomas, aprovados pelo Nicolas antes de publicar.

### Documentos

- [principal] Handoff: lacunas L1 a L6 e a Q2 (rotas e formatos) · front-lacunas-l1-a-l6.md · id cmvkfnit2000kaod2pi2vfj7m · atualizado 2026-10-23T04:14:30.685Z
- Spec: ficha de emergência pelo QR (L6) · ficha-de-emergencia-por-qr.md · id cmvkfnix2000laod2a2fzcoxu · atualizado 2026-10-23T03:51:17.894Z

### Documentos herdados

(nenhum)

### Subtarefas

(nenhuma)

## PJ-4NARE1 · Portal: ficha de emergência pelo QR da coleira

- id: cmvkfnh5m000gaod2684nare1
- status: TODO
- pai: -
- responsáveis: Luis Gustavo
- prioridade: 3
- prazo: 2026-11-13T12:00:00.000Z
- criado: 2026-10-23T03:51:15.469Z · atualizado: 2026-10-23T04:05:09.116Z
- tags: portal-parceiro

### Descrição

**O que é:** O pet chega sem o responsável. O veterinário com CRMV conferido lê o QR da coleira no portal, escreve o motivo e vê uma ficha curta: alergias, remédios contínuos, condições e peso. O responsável é avisado na hora. Resposta da L6 do card PJ-MNB2WW, com os dois degraus do protótipo.
**Rota:** `POST /parceiro/portal/emergencia/ficha` com `{ publicSlug, motivo }`. O slug é o final da URL que o QR abre.
**Telas de erro, pelo código:**

- 403 `EMERGENCIA_SEM_CRMV_CONFERIDO`: explicar que precisa do CRMV conferido, com o caminho para "Profissionais";

- 404 `EMERGENCIA_FICHA_INDISPONIVEL`: "Ficha indisponível para este QR", sem dizer o motivo;

- 429 `EMERGENCIA_LIMITE`: limite do dia (10 por pessoa, 30 por clínica);

- 400: motivo com menos de 10 ou mais de 300 caracteres.
**Onde está a API:** no `develop` e na API de dev desde 22/10 (commit `b8d5c2b`); em produção quando o Nicolas subir o `develop` para o `master`.
**Pronto quando:** com um profissional conferido, ler o QR de um pet de teste abre a ficha com a nota "O responsável foi avisado agora"; sem o selo, aparece a explicação; um QR qualquer mostra "Ficha indisponível".
**Para quem implementa:** seção L6 (Portal) do handoff anexado. Textos nos 6 idiomas, aprovados pelo Nicolas antes de publicar.

### Documentos

- [principal] Handoff: lacunas L1 a L6 e a Q2 (rotas e formatos) · front-lacunas-l1-a-l6.md · id cmvkfnhpd000haod241fwy1tu · atualizado 2026-10-23T04:14:30.541Z
- Spec: ficha de emergência pelo QR (L6) · ficha-de-emergencia-por-qr.md · id cmvkfnhte000iaod2sxws5l1u · atualizado 2026-10-23T03:51:16.466Z

### Documentos herdados

(nenhum)

### Subtarefas

(nenhuma)

## PJ-7M2VNJ · App: quem abriu o acesso temporário (visitas e arquivos pedidos)

- id: cmvkfng1r000daod27r7m2vnj
- status: TODO
- pai: -
- responsáveis: Luis Gustavo
- prioridade: 3
- prazo: 2026-11-06T12:00:00.000Z
- criado: 2026-10-23T03:51:14.034Z · atualizado: 2026-10-23T04:05:09.261Z
- tags: app

### Descrição

**O que é:** No detalhe do acesso temporário, o responsável vê quantas vezes o acesso foi aberto e quais arquivos foram pedidos, com o nome da clínica quando foi pelo portal. Resposta da L5 do card PJ-MNB2WW e o "quem abriu e quando" do protótipo PJ-QDDJOQ.
**Rota:** `GET /tutor/compartilhamentos-prestador/{id}/aberturas` (só o dono do acesso).
**Cuidado com o texto:** o registro prova que o arquivo foi pedido, não que alguém leu. Escreva "pediu o arquivo", nunca "leu" ou "viu".
**Onde está a API:** no `develop` e na API de dev desde 22/10 (commit `b8d5c2b`); em produção quando o Nicolas subir o `develop` para o `master`.
**Pronto quando:** depois de um vet abrir o código e pedir um PDF, o responsável vê "Aberto 1 vez" e "Pelo código: pediu exame.pdf"; com o portal, aparece o nome da clínica.
**Para quem implementa:** seção L5 do handoff anexado (formato e exemplos de texto). Textos nos 6 idiomas, aprovados pelo Nicolas antes de publicar.

### Documentos

- [principal] Handoff: lacunas L1 a L6 e a Q2 (rotas e formatos) · front-lacunas-l1-a-l6.md · id cmvkfngll000eaod2ifjni9vf · atualizado 2026-10-23T04:14:30.397Z
- Spec: quem abriu o acesso temporário (L5) · acesso-temporario-aberturas-para-o-responsavel.md · id cmvkfngpn000faod2277ymfvo · atualizado 2026-10-23T04:05:47.215Z

### Documentos herdados

(nenhum)

### Subtarefas

(nenhuma)

## PJ-9NVQ1R · Protótipo: tela de quem pode ver o histórico do pet

- id: cmt2bkh48028t1hqflc9nvq1r
- status: TODO
- pai: PJ-QDDJOQ (cmt2bkgxr028s1hqfsbqddjoq)
- responsáveis: Luis Gustavo
- prioridade: 4
- prazo: 2026-11-14T12:00:00.000Z
- criado: 2026-08-21T02:17:41.285Z · atualizado: 2026-10-27T13:05:45.184Z
- tags: 

### Descrição

Quem tem acesso, desde quando e para quê, tão claro quanto a lista de dispositivos conectados de um banco. Aproveitar o que já existe de compartilhamento com parceiro e auditoria no produto.

### Documentos

(nenhum)

### Documentos herdados

- Spec: quem abriu o acesso temporário (L5) · acesso-temporario-aberturas-para-o-responsavel.md · id cmvkfno4j000vaod26j96yake
- Spec: ficha de emergência pelo QR (L6) · ficha-de-emergencia-por-qr.md · id cmvkfnokg000waod2fbtkmm4u

### Subtarefas

(nenhuma)

## PJ-HPEZ9H · Protótipo: clínica recebe paciente novo já com o histórico

- id: cmt2bkhgp028v1hqfybhpez9h
- status: TODO
- pai: PJ-QDDJOQ (cmt2bkgxr028s1hqfsbqddjoq)
- responsáveis: Luis Gustavo
- prioridade: 4
- prazo: 2026-11-14T12:00:00.000Z
- criado: 2026-08-21T02:17:41.734Z · atualizado: 2026-10-27T13:05:45.184Z
- tags: 

### Descrição

O outro lado do argumento: paciente novo que chega com vacinas, exames e consultas já preenchidos. É o que transforma a objeção da clínica em benefício.

### Documentos

(nenhum)

### Documentos herdados

- Spec: quem abriu o acesso temporário (L5) · acesso-temporario-aberturas-para-o-responsavel.md · id cmvkfno4j000vaod26j96yake
- Spec: ficha de emergência pelo QR (L6) · ficha-de-emergencia-por-qr.md · id cmvkfnokg000waod2fbtkmm4u

### Subtarefas

(nenhuma)

## PJ-NLA4JS · Protótipo: marcar consulta pelo app em poucos passos

- id: cmt2bkds3028a1hqf1rnla4js
- status: TODO
- pai: -
- responsáveis: Luis Gustavo
- prioridade: 5
- prazo: 2026-11-14T12:00:00.000Z
- criado: 2026-08-21T02:17:36.960Z · atualizado: 2026-10-27T13:05:45.767Z
- tags: 

### Descrição

**Mudou em 27/10:** era subtarefa de "VET · Protótipo: Agendamento online pelo tutor", concluído em outubro. Veio para novembro porque não estava feito.
**O que é:** No protótipo, o caminho em que o responsável marca uma consulta pelo app: poucos passos e, se ele só tem um pet, o pet já vem escolhido.
**Detalhe:** O motivo da consulta que a pessoa escolhe ajuda a clínica a saber quanto tempo reservar na agenda.

### Documentos

(nenhum)

### Documentos herdados

(nenhum)

### Subtarefas

(nenhuma)

## PJ-QDDJOQ · Protótipo: o histórico do pet vai junto quando ele muda de clínica

- id: cmt2bkgxr028s1hqfsbqddjoq
- status: IN_TESTING
- pai: -
- responsáveis: Luis Gustavo
- prioridade: 4
- prazo: 2026-11-14T12:00:00.000Z
- criado: 2026-08-21T02:17:41.053Z · atualizado: 2026-10-27T13:05:45.027Z
- tags: 

### Descrição

O histórico é do tutor e viaja com ele: compartilhar o prontuário com outra clínica, acompanhar quem tem acesso e revogar quando quiser.
**Por que existe**
Inverte o modelo do mercado. Os concorrentes prendem o dado na clínica; nós prendemos no pet. É argumento de venda para o tutor e objeção previsível da clínica, então o protótipo precisa responder a essa objeção mostrando o ganho: paciente novo chega com histórico completo.
**O que entregar**

- Tela do tutor: com quem o pet está compartilhado, desde quando e o que a clínica enxerga.
- Conceder acesso a uma clínica nova, com escopo e prazo.
- Revogar acesso, deixando claro o que acontece com o que já foi visto.
- Vista da clínica que recebe: paciente novo com histórico completo.
- Registro de auditoria legível para o tutor: quem abriu e quando.**Casos difíceis que o protótipo precisa mostrar**

- Tutor que troca de clínica por conflito: revogar precisa ser imediato e sem constrangimento.
- Clínica que precisa de acesso na emergência, sem o tutor por perto.
- Explicar consentimento sem juridiquês, para quem não vai ler termo nenhum.**Pronto quando**
Um tutor entende sozinho o que está compartilhando e desfaz em dois toques.
**API (22/10):** o "quem abriu e quando" e a "clínica na emergência" já existem na API (cards PJ-MNB2WW e "API: lacunas L1 a L6"). As telas estão nos cards de novembro "App: quem abriu o acesso temporário", "Portal: ficha de emergência pelo QR da coleira" e "App: ficha de emergência do pet".

### Documentos

- [principal] Spec: quem abriu o acesso temporário (L5) · acesso-temporario-aberturas-para-o-responsavel.md · id cmvkfno4j000vaod26j96yake · atualizado 2026-10-23T04:05:51.385Z
- Spec: ficha de emergência pelo QR (L6) · ficha-de-emergencia-por-qr.md · id cmvkfnokg000waod2fbtkmm4u · atualizado 2026-10-23T03:51:25.216Z

### Documentos herdados

(nenhum)

### Subtarefas

- PJ-HPEZ9H · id cmt2bkhgp028v1hqfybhpez9h · TODO · docs=0 · Protótipo: clínica recebe paciente novo já com o histórico
- PJ-2A900A · id cmt2bkhac028u1hqfsb2a900a · TODO · docs=0 · Protótipo: ficha de emergência aberta pelo QR da coleira
- PJ-9NVQ1R · id cmt2bkh48028t1hqflc9nvq1r · TODO · docs=0 · Protótipo: tela de quem pode ver o histórico do pet

## PJ-VZEBKP · Carteirinha: campos pedidos pelo veterinário e diagnóstico de uma palavra

- id: cmstsa7pd004c1hqfjjvzebkp
- status: TODO
- pai: -
- responsáveis: Nicolas Castela, Luis Gustavo
- prioridade: 4
- prazo: 2026-11-30T12:00:00.000Z
- criado: 2026-08-15T02:55:40.415Z · atualizado: 2026-10-22T22:29:51.636Z
- tags: 

### Descrição

`Um veterinário que usa o app mandou a lista de campos da ficha de cadastro
dele e apontou que o diagnóstico na carteirinha aparece só com uma palavra.

São duas frentes:

1) Campos da ficha do vet
Dos 11 campos pedidos, 8 já saem na carteirinha hoje. Faltam 3:
- Cor: não existe no modelo do pet, precisa de backend
- Temperamento: não existe no modelo do pet, precisa de backend
- Endereço: já existe na API (endereço do tutor, com flag principal),
  mas a tela da carteirinha não carrega. Só trabalho de app.

Bônus barato: "porte" já existe no modelo, já é preenchido no cadastro e
já tem tradução nos 4 idiomas, mas nunca foi impresso no PDF.

2) Diagnóstico com uma palavra só
O subtipo é opcional no formulário. Sem ele, o título vira só a categoria:
"Pele", "Coração", "Rim", "Fígado". E "Outra" sem subtipo imprime a palavra
"Outra", que não informa nada num documento clínico.
Não é só do PDF: são 2 funções alimentando 5 telas, então a correção
precisa valer para o app inteiro.

Antes de começar, 4 decisões de produto estão pendentes (detalhe na spec),
sendo a mais importante: endereço do tutor NÃO deveria aparecer na
carteirinha pública, que é aberta por QR para qualquer um.

Spec completa com o levantamento, escopo por camada e critérios de aceite anexada na tarefa.`

### Documentos

- [principal] 2026 08 14 carteirinha campos vet e diagnostico · 2026-08-14-carteirinha-campos-vet-e-diagnostico.md · id cmstsa7z8004d1hqf4sx2xgxd · atualizado 2026-08-15T02:55:40.772Z

### Documentos herdados

(nenhum)

### Subtarefas

(nenhuma)

---

# GERAL

## PJ-2EXWFC · Portal do parceiro · Fronts: o que vale para todas as telas (Luís)

- id: cmvhn9czs0000ood2mb2exwfc
- status: TODO
- pai: -
- responsáveis: Luis Gustavo
- prioridade: 4
- prazo: 2026-11-30T12:00:00.000Z
- criado: 2026-10-21T05:00:55.296Z · atualizado: 2026-10-22T22:29:51.667Z
- tags: admin, app, cms, portal-parceiro

### Descrição

A parte de front do Portal do parceiro. A API é feita em outubro (cards "Portal do parceiro" de outubro); cada card daqui começa quando o card da API correspondente estiver Concluído e o handoff escrito.
**Regras para todas as telas:** gerar os tipos de `contrato/openapi.json` em vez de escrever o contrato à mão; `/publico` vira `/public`; quando a rota existir, apagar a regra local (domain/) e só mostrar o que o servidor calculou; o mock fica só em dev ou na conta de demonstração; sem travessão; textos nos 6 idiomas.
**Prazos:** sugeridos por semana, seguindo as ondas da API. Ajustar com o Nicolas.

### Documentos

- [principal] Análise do portal: irracionalidades, melhorias e o que falta · analise-do-portal-irracionalidades-e-melhorias.md · id cmvhn9diy0001ood2s3009zha · atualizado 2026-10-21T05:00:56.122Z

### Documentos herdados

(nenhum)

### Subtarefas

- PJ-RWQBMT · id cmvhn9gv20006ood2mlrwqbmt · TODO · docs=0 · Renomear /veterinario/* para /clinica/* com redirect
- PJ-TYT5JY · id cmvhn9g4s0005ood2dstyt5jy · TODO · docs=0 · Atualizar os docs clinico/09, 12, 14 e 16: o contrato agora é o OpenAPI da API
- PJ-XOI9HR · id cmvhn9dy40002ood27hxoi9hr · TODO · docs=0 · Mesclar a redesign/portal no main (avanço direto, 0 commits atrás)
- PJ-IVVK7O · id cmvhn9hlb0007ood24oivvk7o · TODO · docs=0 · Nome único para Cuidador: família do responsável no clínico e equipe no hotel

## PJ-IVVK7O · Nome único para Cuidador: família do responsável no clínico e equipe no hotel

- id: cmvhn9hlb0007ood24oivvk7o
- status: TODO
- pai: PJ-2EXWFC (cmvhn9czs0000ood2mb2exwfc)
- responsáveis: Luis Gustavo
- prioridade: 3
- prazo: 2026-11-27T12:00:00.000Z
- criado: 2026-10-21T05:01:01.257Z · atualizado: 2026-10-21T05:01:01.257Z
- tags: admin, portal-parceiro

### Descrição

O mesmo nome quer dizer duas coisas diferentes nos dois módulos.
Origem: documento de análise do portal (anexado no card pai).

### Documentos

(nenhum)

### Documentos herdados

- Análise do portal: irracionalidades, melhorias e o que falta · analise-do-portal-irracionalidades-e-melhorias.md · id cmvhn9diy0001ood2s3009zha

### Subtarefas

(nenhuma)

## PJ-RWQBMT · Renomear /veterinario/* para /clinica/* com redirect

- id: cmvhn9gv20006ood2mlrwqbmt
- status: TODO
- pai: PJ-2EXWFC (cmvhn9czs0000ood2mb2exwfc)
- responsáveis: Luis Gustavo
- prioridade: 3
- prazo: 2026-11-11T12:00:00.000Z
- criado: 2026-10-21T05:01:00.312Z · atualizado: 2026-10-21T05:01:00.312Z
- tags: admin, portal-parceiro

### Descrição

Veterinário não é perfil, e recepção e enfermagem usam as mesmas telas.
Origem: documento de análise do portal (anexado no card pai).

### Documentos

(nenhum)

### Documentos herdados

- Análise do portal: irracionalidades, melhorias e o que falta · analise-do-portal-irracionalidades-e-melhorias.md · id cmvhn9diy0001ood2s3009zha

### Subtarefas

(nenhuma)

## PJ-TYT5JY · Atualizar os docs clinico/09, 12, 14 e 16: o contrato agora é o OpenAPI da API

- id: cmvhn9g4s0005ood2dstyt5jy
- status: TODO
- pai: PJ-2EXWFC (cmvhn9czs0000ood2mb2exwfc)
- responsáveis: Luis Gustavo
- prioridade: 3
- prazo: 2026-11-11T12:00:00.000Z
- criado: 2026-10-21T05:00:59.366Z · atualizado: 2026-10-21T05:00:59.366Z
- tags: admin, portal-parceiro

### Descrição

Os docs ainda mandam copiar o responsavel.ts à mão e citam caminhos antigos.
Origem: documento de análise do portal (anexado no card pai).

### Documentos

(nenhum)

### Documentos herdados

- Análise do portal: irracionalidades, melhorias e o que falta · analise-do-portal-irracionalidades-e-melhorias.md · id cmvhn9diy0001ood2s3009zha

### Subtarefas

(nenhuma)

## PJ-XOI9HR · Mesclar a redesign/portal no main (avanço direto, 0 commits atrás)

- id: cmvhn9dy40002ood27hxoi9hr
- status: TODO
- pai: PJ-2EXWFC (cmvhn9czs0000ood2mb2exwfc)
- responsáveis: Luis Gustavo
- prioridade: 3
- prazo: 2026-11-04T12:00:00.000Z
- criado: 2026-10-21T05:00:56.534Z · atualizado: 2026-10-21T05:00:56.534Z
- tags: admin, portal-parceiro

### Descrição

Antes que as telas novas de API entrem no main e conflitem com 325 arquivos da redesign.
Origem: documento de análise do portal (anexado no card pai).

### Documentos

(nenhum)

### Documentos herdados

- Análise do portal: irracionalidades, melhorias e o que falta · analise-do-portal-irracionalidades-e-melhorias.md · id cmvhn9diy0001ood2s3009zha

### Subtarefas

(nenhuma)

---

# E1

## PJ-1HX14U · E1-06 (portal) · Inbox filtrada por parceiro e selos do menu e do Início pela API

- id: cmvhn9v2m000sood2j31hx14u
- status: TODO
- pai: PJ-Z2P90L (cmvhn9mx0000good29pz2p90l)
- responsáveis: Luis Gustavo
- prioridade: 4
- prazo: 2026-11-11T12:00:00.000Z
- criado: 2026-10-21T05:01:18.728Z · atualizado: 2026-10-22T22:08:50.665Z
- tags: admin, portal-parceiro

### Descrição

**O que fazer:** Trocar useClinicoPendencias e os números do Início por GET /parceiro/portal/pendencias; inbox com ?parceiroId=.
**Superfície:** portal (`petjourney-admin`)
**Depende da API:** card "E1-06 · Avisos à equipe do parceiro e contadores de pendência" de outubro, prazo 22/10. Começa quando aquele card estiver Concluído e o handoff anexado aqui.
**Spec:** ver o documento da spec E1-06 no card de outubro (rotas, contrato e regras).
**Prazo:** sugerido para a semana da onda 1; ajustar com o Nicolas.

### Documentos

- [principal] Handoff E1-06: portal-parceiro-e1.md · portal-parceiro-e1.md · id cmvifldbwrzsygukfw9c · atualizado 2026-10-28T06:40:55.878Z

### Documentos herdados

- Épico E1: Fundação do estabelecimento · portal-parceiro-e1-fundacao.md · id cmvhn9nft000hood2qrwjhx55

### Subtarefas

(nenhuma)

## PJ-2OPCOW · E1-07 (app, cms) · Tirar o perfil veterinario do app e o filtro por VETERINARIO do CMS

- id: cmvhn9vtf000tood27y2opcow
- status: TODO
- pai: PJ-Z2P90L (cmvhn9mx0000good29pz2p90l)
- responsáveis: Luis Gustavo
- prioridade: 2
- prazo: 2026-11-30T12:00:00.000Z
- criado: 2026-10-21T05:01:19.687Z · atualizado: 2026-10-27T13:05:38.104Z
- tags: app, cms, portal-parceiro

### Descrição

**O que fazer:** Limpeza do legado: add-profile?target=veterinario no app e o filtro perfil=VETERINARIO no CMS. Precisa estar feito antes da F4 da API (27/11).
**Superfície:** app (`petjourney-app`), cms (`petjourney-cms`)
**Depende da API:** card "E1-07 · Aposentar o legado Veterinario, Clinica e ClinicasPacientes" de outubro, prazo 21/11 (replanejado em 27/10). Começa quando aquele card estiver Concluído e o handoff anexado aqui.
**Spec:** ver o documento da spec E1-07 no card de outubro (rotas, contrato e regras).
**Prazo:** sugerido para a semana da onda 6; ajustar com o Nicolas.

### Documentos

- [principal] Handoff E1-07: portal-parceiro-e1.md · portal-parceiro-e1.md · id cmvtxvj9x00yqulbu7bwk · atualizado 2026-10-30T17:16:44.902Z

### Documentos herdados

- Épico E1: Fundação do estabelecimento · portal-parceiro-e1-fundacao.md · id cmvhn9nft000hood2qrwjhx55

### Subtarefas

(nenhuma)

### Comentários

#### Nicolas Castela · 2026-10-29T19:31:53.188Z

**Guia atualizado (29/10, E1-07c):** a seção 8 nova do guia anexado (portal-parceiro-e1.md) vale para os fronts. Teste no dev, onde a chave já está ligada:

- App: o login decide a tela só pelo GET /auth/perfis (veterinarioId vem sempre nulo); tirar CRMV, especialidade, bio e número comercial do editProfile; apagar o ramo veterinario do add-profile (seção 8.2).

- CMS: o rótulo "Veterinário" da lista sai do filtro perfil=VETERINARIO, não do veterinarioPerfil.id; o tipo VeterinarioPerfil fica com tudo opcional (seção 8.4).

- Portal (vai junto neste card): login.vue e auth-session.ts decidem pelo /auth/perfis; o SettingsPerfilPanel não pré-preenche mais CRMV e especialidade. O CRMV do profissional fica na ficha, e o do parceiro no cadastro (seção 8.3).

- Avatar: continua em veterinarioPerfil.foto. No dev, 9 contas de teste ficam sem avatar porque a foto é de outro projeto do Supabase. É esperado, não é bug.

#### Nicolas Castela · 2026-10-30T17:16:58.587Z

**Mudou (30/10), legado apagado no dev:** @Luís, as tabelas antigas de veterinário e clínica foram apagadas no banco de dev. Para o front, só uma coisa muda: o GET /endereco não traz mais o clinicaId, que já vinha sempre nulo. O token segue com veterinarioId: null. Este card (tirar o perfil veterinario do app e o filtro do CMS) continua valendo. Guia reanexado, seção 8.8 do portal-parceiro-e1.md.

## PJ-2VAFXX · E1-03 (portal) · Profissionais, papéis na equipe e menu por /parceiro/portal/eu

- id: cmvhn9qom000mood2522vafxx
- status: TODO
- pai: PJ-Z2P90L (cmvhn9mx0000good29pz2p90l)
- responsáveis: Luis Gustavo
- prioridade: 4
- prazo: 2026-11-11T12:00:00.000Z
- criado: 2026-10-21T05:01:13.040Z · atualizado: 2026-10-22T22:08:30.098Z
- tags: admin, portal-parceiro

### Descrição

**O que fazer:** Cadastro de profissionais (CRMV, especialidades, cor), papéis operacionais na equipe e permissões vindas do /eu.
**Superfície:** portal (`petjourney-admin`)
**Depende da API:** card "E1-03 · Profissionais com CRMV, papéis operacionais e permissão por recurso" de outubro, prazo 22/10. Começa quando aquele card estiver Concluído e o handoff anexado aqui.
**Spec:** ver o documento da spec E1-03 no card de outubro (rotas, contrato e regras).
**Prazo:** sugerido para a semana da onda 1; ajustar com o Nicolas.

### Documentos

- [principal] Handoff E1-03: portal-parceiro-e1.md · portal-parceiro-e1.md · id cmvifkzpdr3yr4qk4of9 · atualizado 2026-10-30T13:32:55.447Z

### Documentos herdados

- Épico E1: Fundação do estabelecimento · portal-parceiro-e1-fundacao.md · id cmvhn9nft000hood2qrwjhx55

### Subtarefas

(nenhuma)

### Comentários

#### Nicolas Castela · 2026-10-30T13:36:52.284Z

**Mudou (30/10), E1-03 no portal:** @Luís, a verificação de identidade (E1-08) mexe na tela da equipe. Guia reanexado, seção 9.1 do portal-parceiro-e1.md.

- A lista da equipe devolve o selo efetivo: com a identidade do login revogada, crmvConferidoEm vem nulo.

- Contador novo selosVencendo (só para quem tem equipe.gerir).

- Trocar CRMV, UF ou login da ficha, ou desligar o login (usuarioId: null, novo), tira o selo: avise antes de salvar.

## PJ-49U4QS · E1-04 (portal) · Tipos gerados do OpenAPI, erros pelo código, Idempotency-Key e captcha

- id: cmvhn9s5a000oood2my49u4qs
- status: TODO
- pai: PJ-Z2P90L (cmvhn9mx0000good29pz2p90l)
- responsáveis: Luis Gustavo
- prioridade: 4
- prazo: 2026-11-11T12:00:00.000Z
- criado: 2026-10-21T05:01:14.936Z · atualizado: 2026-10-23T03:51:22.336Z
- tags: admin, portal-parceiro

### Descrição

**O que fazer:** Gerar os tipos de contrato/openapi.json (por exemplo com openapi-typescript), decidir a tela pelo campo codigo do erro, mandar Idempotency-Key nas criações e Turnstile nas páginas públicas.
**Superfície:** portal (`petjourney-admin`)
**Depende da API:** card "E1-04 · Contrato das rotas novas (erros com código, fuso, idempotência) e proteção das rotas públicas" de outubro, prazo 22/10. Começa quando aquele card estiver Concluído e o handoff anexado aqui.
**Spec:** ver o documento da spec E1-04 no card de outubro (rotas, contrato e regras).
**Prazo:** sugerido para a semana da onda 1; ajustar com o Nicolas.
**Contrato completo desde 22/10 (resposta das L1 a L3, PJ-VYZRLC):** `ErroDaApiDto` e o enum `CodigoClinico` no contrato, campos nulos com tipo e as 30 rotas do portal com resposta tipada, commit `b8d5c2b`. Seções L1 a L3 do handoff anexado.

### Documentos

- [principal] Handoff E1-04: portal-parceiro-e1.md · portal-parceiro-e1.md · id cmvifl4cwbq3tpi3dgjl · atualizado 2026-10-28T06:40:55.447Z
- Handoff: lacunas L1 a L6 e a Q2 (rotas e formatos) · front-lacunas-l1-a-l6.md · id cmvkfnms9000taod2aghcgrnz · atualizado 2026-10-23T04:14:30.972Z

### Documentos herdados

- Épico E1: Fundação do estabelecimento · portal-parceiro-e1-fundacao.md · id cmvhn9nft000hood2qrwjhx55

### Subtarefas

(nenhuma)

## PJ-80M7IL · E1-02 (app) · Avisos de módulo vencendo e suspenso no inbox do app

- id: cmvi5fy6d0000l0d27g80m7il
- status: TODO
- pai: PJ-Z2P90L (cmvhn9mx0000good29pz2p90l)
- responsáveis: Luis Gustavo
- prioridade: 4
- prazo: 2026-11-11T12:00:00.000Z
- criado: 2026-10-21T13:29:55.774Z · atualizado: 2026-10-21T13:29:55.774Z
- tags: app, portal-parceiro

### Descrição

**O que fazer:** Tipos PARCEIRO_MODULO_VENCENDO e PARCEIRO_MODULO_SUSPENSO em rotas-notificacao.ts (inbox, não afeta a home, perfil null) e ícone em notifications.tsx. O audit:notificacao-rotas da API reprova até isso entrar.
**Superfície:** app (`petjourney-app`)
**Depende da API:** card "E1-02 · Módulos do parceiro (Clínica e Hotel) ligados no servidor" de outubro, prazo 21/10. Começa quando aquele card estiver Concluído e o handoff anexado aqui.
**Spec:** ver o documento da spec E1-02 no card de outubro (rotas, contrato e regras).
**Prazo:** sugerido para a semana da onda 1; ajustar com o Nicolas.

### Documentos

- [principal] Handoff E1-02: portal-parceiro-e1.md · portal-parceiro-e1.md · id cmvifkupa9n10hemr595 · atualizado 2026-10-28T06:40:54.444Z

### Documentos herdados

- Épico E1: Fundação do estabelecimento · portal-parceiro-e1-fundacao.md · id cmvhn9nft000hood2qrwjhx55

### Subtarefas

(nenhuma)

## PJ-9OAGFK · E1-03 (cms) · Conferir CRMV do profissional

- id: cmvhn9rf3000nood2z69oagfk
- status: TODO
- pai: PJ-Z2P90L (cmvhn9mx0000good29pz2p90l)
- responsáveis: Luis Gustavo
- prioridade: 4
- prazo: 2026-11-11T12:00:00.000Z
- criado: 2026-10-21T05:01:13.993Z · atualizado: 2026-10-21T05:01:13.993Z
- tags: cms, portal-parceiro

### Descrição

**O que fazer:** Botão de conferência com protocolo.
**Superfície:** cms (`petjourney-cms`)
**Depende da API:** card "E1-03 · Profissionais com CRMV, papéis operacionais e permissão por recurso" de outubro, prazo 22/10. Começa quando aquele card estiver Concluído e o handoff anexado aqui.
**Spec:** ver o documento da spec E1-03 no card de outubro (rotas, contrato e regras).
**Prazo:** sugerido para a semana da onda 1; ajustar com o Nicolas.

### Documentos

- [principal] Handoff E1-03: portal-parceiro-e1.md · portal-parceiro-e1.md · id cmvifkzhbfuovsl8sg0r · atualizado 2026-10-30T13:32:55.161Z

### Documentos herdados

- Épico E1: Fundação do estabelecimento · portal-parceiro-e1-fundacao.md · id cmvhn9nft000hood2qrwjhx55

### Subtarefas

(nenhuma)

### Comentários

#### Nicolas Castela · 2026-10-30T13:36:52.869Z

**Mudou (30/10), E1-03 no CMS:** @Luís, o conferir CRMV agora depende da identidade aprovada. A fila de identidade está no card novo E1-08 (cms); faça os dois juntos.

- Erros novos no conferir-crmv: PROFISSIONAL_SEM_LOGIN, PROFISSIONAL_SEM_IDENTIDADE, PROFISSIONAL_CONFERENCIA_PROPRIA e CONFERENCIA_DE_SI_MESMO (guia, seção 9.2).

## PJ-A5TIS6 · E1-05 (app) · "Quem viu" em Minhas clínicas

- id: cmvhn9uc4000rood2ata5tis6
- status: TODO
- pai: PJ-Z2P90L (cmvhn9mx0000good29pz2p90l)
- responsáveis: Luis Gustavo
- prioridade: 4
- prazo: 2026-11-11T12:00:00.000Z
- criado: 2026-10-21T05:01:17.773Z · atualizado: 2026-10-21T05:01:17.773Z
- tags: app, portal-parceiro

### Descrição

**O que fazer:** Mostrar quando a clínica leu o que o responsável liberou.
**Superfície:** app (`petjourney-app`)
**Depende da API:** card "E1-05 · Trilha de auditoria clínica (quem leu, escreveu, publicou ou exportou)" de outubro, prazo 22/10. Começa quando aquele card estiver Concluído e o handoff anexado aqui.
**Spec:** ver o documento da spec E1-05 no card de outubro (rotas, contrato e regras).
**Prazo:** sugerido para a semana da onda 1; ajustar com o Nicolas.

### Documentos

- [principal] Handoff E1-05: portal-parceiro-e1.md · portal-parceiro-e1.md · id cmvifl8r599wmomzk14 · atualizado 2026-10-28T06:40:55.591Z

### Documentos herdados

- Épico E1: Fundação do estabelecimento · portal-parceiro-e1-fundacao.md · id cmvhn9nft000hood2qrwjhx55

### Subtarefas

(nenhuma)

## PJ-BY8ULR · E1-08 (site) · Cadastro do parceiro confere o dígito do CNPJ

- id: cmvv0i5fp0002ggd214by8ulr
- status: TODO
- pai: PJ-Z2P90L (cmvhn9mx0000good29pz2p90l)
- responsáveis: Luis Gustavo
- prioridade: 4
- prazo: 2026-11-18T12:00:00.000Z
- criado: 2026-10-30T13:32:40.697Z · atualizado: 2026-10-30T13:32:40.697Z
- tags: web, portal-parceiro

### Descrição

O que éO formulário de cadastro de parceiro no site passa a conferir o dígito verificador do CNPJ antes de enviar, inclusive o CNPJ novo com letras.
Por queA API agora recusa CNPJ com dígito errado (400 `CNPJ_INVALIDO`). Sem a conferência no formulário, a pessoa só descobre o erro depois de enviar.
Pronto quando
- CNPJ com dígito errado mostra o erro no campo antes de enviar, e a mensagem da API aparece no campo quando ela recusar.Para quem implementaGuia anexado, `portal-parceiro-e1.md`, seção 9.4: o mesmo cálculo da Receita; no alfanumérico, a letra vale o código ASCII menos 48.

### Documentos

- [principal] Handoff E1-08: portal-parceiro-e1.md · portal-parceiro-e1.md · id cmvv0i82bzlkny69aw3 · atualizado 2026-10-30T16:52:43.568Z

### Documentos herdados

- Épico E1: Fundação do estabelecimento · portal-parceiro-e1-fundacao.md · id cmvhn9nft000hood2qrwjhx55

### Subtarefas

(nenhuma)

### Comentários

#### Nicolas Castela · 2026-10-30T13:36:51.699Z

**Liberado (30/10), E1-08 no site:** @Luís, card novo e pequeno. A API está completa no develop e o guia está anexado (portal-parceiro-e1.md, seção 9.4).

## PJ-DXT9T5 · E1-01 (portal) · Tela "Meu estabelecimento": perfil, horários, feriados, slug e publicar

- id: cmvhn9nr3000iood21edxt9t5
- status: TODO
- pai: PJ-Z2P90L (cmvhn9mx0000good29pz2p90l)
- responsáveis: Luis Gustavo
- prioridade: 4
- prazo: 2026-11-11T12:00:00.000Z
- criado: 2026-10-21T05:01:09.241Z · atualizado: 2026-10-22T22:08:54.029Z
- tags: admin, portal-parceiro

### Descrição

**O que fazer:** Ler e gravar /parceiro/portal/estabelecimento; fuso IANA no lugar do utcOffset fixo.
**Superfície:** portal (`petjourney-admin`)
**Depende da API:** card "E1-01 · Perfil público do estabelecimento" de outubro, prazo 21/10. Começa quando aquele card estiver Concluído e o handoff anexado aqui.
**Spec:** ver o documento da spec E1-01 no card de outubro (rotas, contrato e regras).
**Prazo:** sugerido para a semana da onda 1; ajustar com o Nicolas.

### Documentos

- [principal] Handoff E1-01: portal-parceiro-e1.md · portal-parceiro-e1.md · id cmvifkqah3rn6tz4seyu · atualizado 2026-10-22T21:47:03.290Z

### Documentos herdados

- Épico E1: Fundação do estabelecimento · portal-parceiro-e1-fundacao.md · id cmvhn9nft000hood2qrwjhx55

### Subtarefas

(nenhuma)

## PJ-DYEN21 · E1-08 (cms) · Fila de conferência de identidade e selo do CRMV

- id: cmvv0i4o60001ggd2q2dyen21
- status: TODO
- pai: PJ-Z2P90L (cmvhn9mx0000good29pz2p90l)
- responsáveis: Luis Gustavo
- prioridade: 4
- prazo: 2026-11-18T12:00:00.000Z
- criado: 2026-10-30T13:32:39.706Z · atualizado: 2026-10-30T13:32:39.706Z
- tags: cms, portal-parceiro

### Descrição

O que éA fila onde a equipe PetJourney confere a identidade de quem assina: vê o documento, a selfie e o CPF, aprova, recusa (também em lote) ou revoga. Depois confere o CRMV lado a lado com o nome do documento aprovado. Também: reconsultar o CNPJ na Receita e os interruptores da aprovação de parceiro.
Por queSem a conferência no CMS ninguém ganha o selo, e sem selo não se assina receita. A fila expira sozinha em 14 dias, então precisa estar no ar antes de o portal pedir o envio.
Pronto quando
- A fila mostra a idade do envio mais antigo e um aviso a partir de 10 dias.
- O detalhe abre as três imagens, e as URLs param de abrir depois de 5 minutos.
- Aprovar, recusar, recusar em lote e revogar funcionam com o motivo, e o admin não decide a própria verificação.
- Conferir o CRMV mostra o CRMV da ficha, o nome do documento e a busca pública do conselho.Para quem implementaGuia anexado, `portal-parceiro-e1.md`, seção 9.2: rotas `/admin/verificacoes-identidade` (fila, detalhe, aprovar, recusar, recusar-em-lote, revogar, selos-vencendo), `/admin/parceiro/:id/cnpj/reconsultar`, `/admin/configuracao` (só as chaves `aprovacao.*` são editáveis), os erros novos do conferir-crmv e do aprovar parceiro, e o PATCH do CNPJ só com os campos alterados.

### Documentos

- [principal] Handoff E1-08: portal-parceiro-e1.md · portal-parceiro-e1.md · id cmvv0i7i021jgktkhqyf · atualizado 2026-10-30T16:52:43.148Z

### Documentos herdados

- Épico E1: Fundação do estabelecimento · portal-parceiro-e1-fundacao.md · id cmvhn9nft000hood2qrwjhx55

### Subtarefas

(nenhuma)

### Comentários

#### Nicolas Castela · 2026-10-30T13:36:51.114Z

**Liberado (30/10), E1-08 no CMS:** @Luís, card novo. A API está completa no develop e o guia está anexado (portal-parceiro-e1.md, seção 9.2). A fila expira sozinha em 14 dias, então este precisa estar no ar junto com a tela de envio do portal.

## PJ-IPL2CL · E1-02 (cms) · Ligar e suspender módulo por parceiro

- id: cmvhn9pyf000lood2ztipl2cl
- status: TODO
- pai: PJ-Z2P90L (cmvhn9mx0000good29pz2p90l)
- responsáveis: Luis Gustavo
- prioridade: 4
- prazo: 2026-11-11T12:00:00.000Z
- criado: 2026-10-21T05:01:12.097Z · atualizado: 2026-10-22T22:09:14.686Z
- tags: cms, portal-parceiro

### Descrição

**O que fazer:** Tela no detalhe do parceiro com as rotas /admin/parceiro/:id/modulos.
**Superfície:** cms (`petjourney-cms`)
**Depende da API:** card "E1-02 · Módulos do parceiro (Clínica e Hotel) ligados no servidor" de outubro, prazo 21/10. Começa quando aquele card estiver Concluído e o handoff anexado aqui.
**Spec:** ver o documento da spec E1-02 no card de outubro (rotas, contrato e regras).
**Prazo:** sugerido para a semana da onda 1; ajustar com o Nicolas.

### Documentos

- [principal] Handoff E1-02: portal-parceiro-e1.md · portal-parceiro-e1.md · id cmvifkuxhxuos1rjbnd · atualizado 2026-10-28T06:40:54.729Z

### Documentos herdados

- Épico E1: Fundação do estabelecimento · portal-parceiro-e1-fundacao.md · id cmvhn9nft000hood2qrwjhx55

### Subtarefas

(nenhuma)

## PJ-IWQ1F4 · E1-02 (portal) · Menu e módulos pelo servidor; mock fora do build de produção

- id: cmvhn9p88000kood272iwq1f4
- status: TODO
- pai: PJ-Z2P90L (cmvhn9mx0000good29pz2p90l)
- responsáveis: Luis Gustavo
- prioridade: 4
- prazo: 2026-11-11T12:00:00.000Z
- criado: 2026-10-21T05:01:11.153Z · atualizado: 2026-10-22T22:08:26.864Z
- tags: admin, portal-parceiro

### Descrição

**O que fazer:** Menu por GET /parceiro/portal/modulos; tirar o ?clinico=on, o ?hotel=on e o mock do build de produção (só dev ou conta de demonstração).
**Superfície:** portal (`petjourney-admin`)
**Depende da API:** card "E1-02 · Módulos do parceiro (Clínica e Hotel) ligados no servidor" de outubro, prazo 21/10. Começa quando aquele card estiver Concluído e o handoff anexado aqui.
**Spec:** ver o documento da spec E1-02 no card de outubro (rotas, contrato e regras).
**Prazo:** sugerido para a semana da onda 1; ajustar com o Nicolas.

### Documentos

- [principal] Handoff E1-02: portal-parceiro-e1.md · portal-parceiro-e1.md · id cmvifkv5s1hyommyhhco · atualizado 2026-10-28T06:40:54.872Z

### Documentos herdados

- Épico E1: Fundação do estabelecimento · portal-parceiro-e1-fundacao.md · id cmvhn9nft000hood2qrwjhx55

### Subtarefas

(nenhuma)

## PJ-K49ST6 · E1-04 (app) · Tipos gerados do OpenAPI e erros pelo código nas telas novas

- id: cmvhn9svm000pood20xk49st6
- status: TODO
- pai: PJ-Z2P90L (cmvhn9mx0000good29pz2p90l)
- responsáveis: Luis Gustavo
- prioridade: 4
- prazo: 2026-11-11T12:00:00.000Z
- criado: 2026-10-21T05:01:15.884Z · atualizado: 2026-10-23T03:51:23.191Z
- tags: app, portal-parceiro

### Descrição

**O que fazer:** Mesma regra nas telas da clínica e do hotel no app.
**Superfície:** app (`petjourney-app`)
**Depende da API:** card "E1-04 · Contrato das rotas novas (erros com código, fuso, idempotência) e proteção das rotas públicas" de outubro, prazo 22/10. Começa quando aquele card estiver Concluído e o handoff anexado aqui.
**Spec:** ver o documento da spec E1-04 no card de outubro (rotas, contrato e regras).
**Prazo:** sugerido para a semana da onda 1; ajustar com o Nicolas.
**Contrato completo desde 22/10 (resposta das L1 e L2, PJ-VYZRLC):** `ErroDaApiDto` e o enum `CodigoClinico` no contrato e campos nulos com tipo, commit `b8d5c2b`. Seções L1 e L2 do handoff anexado.

### Documentos

- [principal] Handoff E1-04: portal-parceiro-e1.md · portal-parceiro-e1.md · id cmvifl44c85stscgu8ek · atualizado 2026-10-28T06:40:55.304Z
- Handoff: lacunas L1 a L6 e a Q2 (rotas e formatos) · front-lacunas-l1-a-l6.md · id cmvkfnngn000uaod2a6yz1a0r · atualizado 2026-10-23T04:14:31.115Z

### Documentos herdados

- Épico E1: Fundação do estabelecimento · portal-parceiro-e1-fundacao.md · id cmvhn9nft000hood2qrwjhx55

### Subtarefas

(nenhuma)

## PJ-KE667M · E1-01 (site, portal) · Página pública no site, com o link e o QR no portal

- id: cmvhn9ohp000jood2b0ke667m
- status: TODO
- pai: PJ-Z2P90L (cmvhn9mx0000good29pz2p90l)
- responsáveis: Luis Gustavo
- prioridade: 4
- prazo: 2026-11-11T12:00:00.000Z
- criado: 2026-10-21T05:01:10.198Z · atualizado: 2026-10-22T21:46:58.572Z
- tags: admin, web, portal-parceiro

### Descrição

**Novo em 22/10, atenção:** ponte para o app. Quem já tem a PetJourney deve pedir pelo app, porque o pedido pelo app usa o pet do app e ativa o vínculo, e o do site cria um cadastro solto na clínica. Na página do site, o botão "Já usa a PetJourney? Peça pelo app" abre `petjourneyapp://agendar/<slug>` (ou `reservar/<slug>`) e, se o app não abrir em uns 2 s, leva a `/baixar-app`. Não use link `https://petjourney.health` no botão: o iOS não abre o app a partir do mesmo domínio. Ainda não: `/agendar/*` e `/reservar/*` nos links que abrem o app sozinho, porque quem tiver uma versão antiga do app cairia em "rota não encontrada". Detalhe na seção 1.2 do handoff.
**O que é:** A página pública da clínica e do hotel, que qualquer pessoa abre pelo Google, pelo Instagram ou pelo QR do balcão: nome, endereço, horários, se está aberto agora e os contatos.
**Decisão do Nicolas (22/10, Q2 do Portal do parceiro):** a página fica no site; o portal edita, publica e mostra o link e o QR.
**No site:** `petjourney.health/agendar/<slug>` (clínica) e `/reservar/<slug>` (hotel), lendo `GET /public/estabelecimentos/:slug` com cache de 60 s. Slug antigo redireciona para o novo; slug desconhecido ou não publicado mostra "não encontrado". 6 idiomas, com o en-GB explícito.
**No portal:** O bloco "Sua página pública", com o link e o QR apontando para o site. As páginas `/agendar` e `/reservar` do portal saem quando as do site estiverem no ar, ou viram a pré-visualização dentro do editor.
**Pode começar:** Já. A API está pronta na API de dev.
**Pronto quando:** A página de uma clínica publicada abre no site com o que o dono preencheu no portal, e o QR do portal abre essa página.
**Para quem implementa:** Seção 1.2 do handoff `portal-parceiro-e1.md`. A tela de editar é o card "E1-01 (portal) · Tela Meu estabelecimento".

### Documentos

- [principal] Handoff E1-01: portal-parceiro-e1.md · portal-parceiro-e1.md · id cmvifkq27g8skzpf6ecl · atualizado 2026-10-22T21:47:03.433Z

### Documentos herdados

- Épico E1: Fundação do estabelecimento · portal-parceiro-e1-fundacao.md · id cmvhn9nft000hood2qrwjhx55

### Subtarefas

(nenhuma)

## PJ-UFRXH6 · E1-05 (portal) · Tela de auditoria do parceiro

- id: cmvhn9tlw000qood22jufrxh6
- status: TODO
- pai: PJ-Z2P90L (cmvhn9mx0000good29pz2p90l)
- responsáveis: Luis Gustavo
- prioridade: 4
- prazo: 2026-11-11T12:00:00.000Z
- criado: 2026-10-21T05:01:16.830Z · atualizado: 2026-10-22T22:08:57.485Z
- tags: admin, portal-parceiro

### Descrição

**O que fazer:** Lista e filtros de GET /parceiro/portal/auditoria.
**Superfície:** portal (`petjourney-admin`)
**Depende da API:** card "E1-05 · Trilha de auditoria clínica (quem leu, escreveu, publicou ou exportou)" de outubro, prazo 22/10. Começa quando aquele card estiver Concluído e o handoff anexado aqui.
**Spec:** ver o documento da spec E1-05 no card de outubro (rotas, contrato e regras).
**Prazo:** sugerido para a semana da onda 1; ajustar com o Nicolas.

### Documentos

- [principal] Handoff E1-05: portal-parceiro-e1.md · portal-parceiro-e1.md · id cmvifl8zmfk4j25xtq2f · atualizado 2026-10-28T06:40:55.734Z

### Documentos herdados

- Épico E1: Fundação do estabelecimento · portal-parceiro-e1-fundacao.md · id cmvhn9nft000hood2qrwjhx55

### Subtarefas

(nenhuma)

## PJ-W8TOBS · E1-08 (portal) · Identidade da pessoa e aviso de conferência do CRMV

- id: cmvv0i3wk0000ggd2igw8tobs
- status: TODO
- pai: PJ-Z2P90L (cmvhn9mx0000good29pz2p90l)
- responsáveis: Luis Gustavo
- prioridade: 4
- prazo: 2026-11-18T12:00:00.000Z
- criado: 2026-10-30T13:32:38.710Z · atualizado: 2026-10-30T13:32:38.710Z
- tags: admin, portal-parceiro

### Descrição

O que éUma tela nova no portal onde cada pessoa da equipe envia o documento com foto, uma selfie segurando o documento e o CPF. Nas telas de assinar (receita, prontuário finalizado, resumo liberado, prescrição de internação), o botão passa a avisar quando falta a conferência da PetJourney.
Por queDesde 30/10, assinar qualquer ato legal exige o selo: o CRMV conferido pela PetJourney nos últimos 365 dias e a identidade do login aprovada. Sem esta tela, ninguém novo consegue assinar uma receita.
Pronto quando
- Uma conta nova com CRMV na ficha vê o aviso nos botões de assinar, envia documento e selfie e, depois da aprovação no CMS, assina uma receita.
- Recusa e revogação aparecem na tela com o motivo, e o reenvio funciona.
- O contador de selos vencendo aparece só para quem gerencia a equipe.
- Trocar CRMV, UF ou login da ficha avisa antes de salvar que o selo sai.Para quem implementaGuia anexado, `portal-parceiro-e1.md`, seção 9.1: o 403 `CRMV_NAO_CONFERIDO` com `reason` (SEM_SELO, VENCIDO, SEM_IDENTIDADE), os 4 campos novos do `/parceiro/portal/eu`, as rotas `/parceiro/portal/eu/identidade`, o texto do consentimento servido pela API (não copie para o front), arquivos JPG, PNG, WEBP ou PDF até 8 MB sem HEIC, os erros do envio, o `selosVencendo` e o `CNPJ_INVALIDO` no cadastro.

### Documentos

- [principal] Handoff E1-08: portal-parceiro-e1.md · portal-parceiro-e1.md · id cmvv0i7u7v5vdlkz1zu9 · atualizado 2026-10-30T16:52:43.427Z

### Documentos herdados

- Épico E1: Fundação do estabelecimento · portal-parceiro-e1-fundacao.md · id cmvhn9nft000hood2qrwjhx55

### Subtarefas

(nenhuma)

### Comentários

#### Nicolas Castela · 2026-10-30T13:36:50.524Z

**Liberado (30/10), E1-08 no portal:** @Luís, card novo. A API está completa no develop e o guia está anexado (portal-parceiro-e1.md, seção 9). Este vem antes da receita no portal (E4-03): sem ele, conta nova não assina nada.

#### Nicolas Castela · 2026-10-30T16:53:07.948Z

**Mudou (30/10), aviso da selfie:** @Luís, o texto antes do envio da identidade deixou de ser consentimento e virou aviso de privacidade (versão 2026-10-31). A rota do aviso devolve tipo, titulo e botao: use o botao da API ("Li e entendi, enviar") e não escreva o texto no front. Os campos do envio são os mesmos. Guia reanexado, seção 9.1 do portal-parceiro-e1.md.

## PJ-Z2P90L · Portal do parceiro · E1: Fundação do estabelecimento (fronts)

- id: cmvhn9mx0000good29pz2p90l
- status: TODO
- pai: -
- responsáveis: Luis Gustavo
- prioridade: 4
- prazo: 2026-11-18T12:00:00.000Z
- criado: 2026-10-21T05:01:08.158Z · atualizado: 2026-10-22T22:29:51.671Z
- tags: admin, app, web, cms, portal-parceiro

### Descrição

As telas do épico E1: Fundação do estabelecimento, ligadas à API que fica pronta em outubro. Cada subtarefa diz a superfície, o card da API de que depende e o que fazer. O handoff (`docs/implementacao-por-superficie/front-portal-parceiro-e1.md`) é anexado aqui quando a API terminar.
**Superfícies:** portal (petjourney-admin), site (petjourney-web), cms (petjourney-cms), app (petjourney-app).

### Documentos

- [principal] Épico E1: Fundação do estabelecimento · portal-parceiro-e1-fundacao.md · id cmvhn9nft000hood2qrwjhx55 · atualizado 2026-10-21T05:01:08.969Z

### Documentos herdados

(nenhum)

### Subtarefas

- PJ-KE667M · id cmvhn9ohp000jood2b0ke667m · TODO · docs=1 · E1-01 (site, portal) · Página pública no site, com o link e o QR no portal
- PJ-2VAFXX · id cmvhn9qom000mood2522vafxx · TODO · docs=1 · E1-03 (portal) · Profissionais, papéis na equipe e menu por /parceiro/portal/eu
- PJ-UFRXH6 · id cmvhn9tlw000qood22jufrxh6 · TODO · docs=1 · E1-05 (portal) · Tela de auditoria do parceiro
- PJ-1HX14U · id cmvhn9v2m000sood2j31hx14u · TODO · docs=1 · E1-06 (portal) · Inbox filtrada por parceiro e selos do menu e do Início pela API
- PJ-DXT9T5 · id cmvhn9nr3000iood21edxt9t5 · TODO · docs=1 · E1-01 (portal) · Tela "Meu estabelecimento": perfil, horários, feriados, slug e publicar
- PJ-K49ST6 · id cmvhn9svm000pood20xk49st6 · TODO · docs=2 · E1-04 (app) · Tipos gerados do OpenAPI e erros pelo código nas telas novas
- PJ-IWQ1F4 · id cmvhn9p88000kood272iwq1f4 · TODO · docs=1 · E1-02 (portal) · Menu e módulos pelo servidor; mock fora do build de produção
- PJ-IPL2CL · id cmvhn9pyf000lood2ztipl2cl · TODO · docs=1 · E1-02 (cms) · Ligar e suspender módulo por parceiro
- PJ-9OAGFK · id cmvhn9rf3000nood2z69oagfk · TODO · docs=1 · E1-03 (cms) · Conferir CRMV do profissional
- PJ-49U4QS · id cmvhn9s5a000oood2my49u4qs · TODO · docs=2 · E1-04 (portal) · Tipos gerados do OpenAPI, erros pelo código, Idempotency-Key e captcha
- PJ-BY8ULR · id cmvv0i5fp0002ggd214by8ulr · TODO · docs=1 · E1-08 (site) · Cadastro do parceiro confere o dígito do CNPJ
- PJ-A5TIS6 · id cmvhn9uc4000rood2ata5tis6 · TODO · docs=1 · E1-05 (app) · "Quem viu" em Minhas clínicas
- PJ-2OPCOW · id cmvhn9vtf000tood27y2opcow · TODO · docs=1 · E1-07 (app, cms) · Tirar o perfil veterinario do app e o filtro por VETERINARIO do CMS
- PJ-80M7IL · id cmvi5fy6d0000l0d27g80m7il · TODO · docs=1 · E1-02 (app) · Avisos de módulo vencendo e suspenso no inbox do app
- PJ-W8TOBS · id cmvv0i3wk0000ggd2igw8tobs · TODO · docs=1 · E1-08 (portal) · Identidade da pessoa e aviso de conferência do CRMV
- PJ-DYEN21 · id cmvv0i4o60001ggd2q2dyen21 · TODO · docs=1 · E1-08 (cms) · Fila de conferência de identidade e selo do CRMV

---

# E2

## PJ-54B2YO · E2-02 (app) · Minhas clínicas, vínculo proposto, resgatar código e consentimento

- id: cmvhn9yud000yood28154b2yo
- status: TODO
- pai: PJ-S1LO4U (cmvhn9wjw000uood216s1lo4u)
- responsáveis: Luis Gustavo
- prioridade: 4
- prazo: 2026-11-11T12:00:00.000Z
- criado: 2026-10-21T05:01:23.615Z · atualizado: 2026-10-21T05:01:23.615Z
- tags: app, portal-parceiro

### Descrição

**O que fazer:** Telas do doc 09 e 12 do portal falando as rotas /tutor/clinica/vinculos-propostos e /tutor/clinica/clinicas; encerrar e bloquear clínica.
**Superfície:** app (`petjourney-app`)
**Depende da API:** card "E2-02 · Vínculo entre paciente da clínica e pet do app, com consentimento" de outubro, prazo 22/10. Começa quando aquele card estiver Concluído e o handoff anexado aqui.
**Spec:** ver o documento da spec E2-02 no card de outubro (rotas, contrato e regras).
**Prazo:** sugerido para a semana da onda 1; ajustar com o Nicolas.

### Documentos

- [principal] Handoff E2-02: portal-parceiro-e2.md · portal-parceiro-e2.md · id cmviflmbsda4frmvo045 · atualizado 2026-10-30T13:32:59.053Z

### Documentos herdados

- Épico E2: Clientes, pacientes e a ponte com o app do responsável · portal-parceiro-e2-pacientes-e-ponte.md · id cmvhn9x2m000vood2qz959bsk

### Subtarefas

(nenhuma)

## PJ-8BWAPV · E2-04 (app) · Registros da clínica no app: selo, somente leitura e remover do meu app

- id: cmvhna0aw0010ood24g8bwapv
- status: TODO
- pai: PJ-S1LO4U (cmvhn9wjw000uood216s1lo4u)
- responsáveis: Luis Gustavo
- prioridade: 4
- prazo: 2026-11-11T12:00:00.000Z
- criado: 2026-10-21T05:01:25.506Z · atualizado: 2026-10-21T05:01:25.506Z
- tags: app, portal-parceiro

### Descrição

**O que fazer:** Consulta, vacina e peso com origem PARCEIRO: selo da clínica, esconder editar, "remover do meu app" e as notificações da publicação.
**Superfície:** app (`petjourney-app`)
**Depende da API:** card "E2-04 · Publicação no app (o escritor único da clínica para o pet do responsável)" de outubro, prazo 23/10. Começa quando aquele card estiver Concluído e o handoff anexado aqui.
**Spec:** ver o documento da spec E2-04 no card de outubro (rotas, contrato e regras).
**Prazo:** sugerido para a semana da onda 1; ajustar com o Nicolas.

### Documentos

- [principal] Handoff E2-04: portal-parceiro-e2.md · portal-parceiro-e2.md · id cmviflr9zyhtgn8p9t5n · atualizado 2026-10-30T13:33:03.165Z

### Documentos herdados

- Épico E2: Clientes, pacientes e a ponte com o app do responsável · portal-parceiro-e2-pacientes-e-ponte.md · id cmvhn9x2m000vood2qz959bsk

### Subtarefas

(nenhuma)

## PJ-AI84L1 · E2-03 (portal) · "Este pet em 30 segundos" e diário pela API

- id: cmvhn9zkp000zood24hai84l1
- status: TODO
- pai: PJ-S1LO4U (cmvhn9wjw000uood216s1lo4u)
- responsáveis: Luis Gustavo
- prioridade: 3
- prazo: 2026-11-25T12:00:00.000Z
- criado: 2026-10-21T05:01:24.563Z · atualizado: 2026-10-21T05:01:24.563Z
- tags: admin, portal-parceiro

### Descrição

**O que fazer:** Resumo e diário pelas rotas /parceiro/portal/pacientes/:id/app/*; apagar resumo-do-paciente.ts local.
**Superfície:** portal (`petjourney-admin`)
**Depende da API:** card "E2-03 · A clínica lê o app com consentimento (diário, peso de casa, carteirinha) e o "Este pet em 30 segundos"" de outubro, prazo 24/10. Começa quando aquele card estiver Concluído e o handoff anexado aqui.
**Spec:** ver o documento da spec E2-03 no card de outubro (rotas, contrato e regras).
**Prazo:** sugerido para a semana da onda 3; ajustar com o Nicolas.

### Documentos

- [principal] Handoff E2-03: portal-parceiro-e2.md · portal-parceiro-e2.md · id cmvrkp83nd1y1mvq2a2p · atualizado 2026-10-30T13:33:01.221Z

### Documentos herdados

- Épico E2: Clientes, pacientes e a ponte com o app do responsável · portal-parceiro-e2-pacientes-e-ponte.md · id cmvhn9x2m000vood2qz959bsk

### Subtarefas

(nenhuma)

## PJ-D5VP8X · E2-02 (site) · Link da proposta de vínculo da clínica abre o app

- id: cmvi8uino0000hgd26bd5vp8x
- status: TODO
- pai: PJ-S1LO4U (cmvhn9wjw000uood216s1lo4u)
- responsáveis: Luis Gustavo
- prioridade: 4
- prazo: 2026-11-11T12:00:00.000Z
- criado: 2026-10-21T15:05:14.348Z · atualizado: 2026-10-21T15:05:14.348Z
- tags: web, portal-parceiro

### Descrição

**O que fazer:** Rota /clinica/vinculo/<token> no petjourney.health: abre o app (universal link) e, sem app, mostra baixar e voltar ao link. Nada de dado na página: o token só é resgatado pelo app logado.
**Superfície:** site (`petjourney-web`)
**Depende da API:** card "E2-02 · Vínculo entre paciente da clínica e pet do app, com consentimento" de outubro, prazo 22/10. Começa quando aquele card estiver Concluído e o handoff anexado aqui.
**Spec:** ver o documento da spec E2-02 no card de outubro (rotas, contrato e regras).
**Prazo:** sugerido para a semana da onda 1; ajustar com o Nicolas.

### Documentos

- [principal] Handoff E2-02: portal-parceiro-e2.md · portal-parceiro-e2.md · id cmviflmsguebmwz6xhap · atualizado 2026-10-30T13:32:59.491Z

### Documentos herdados

- Épico E2: Clientes, pacientes e a ponte com o app do responsável · portal-parceiro-e2-pacientes-e-ponte.md · id cmvhn9x2m000vood2qz959bsk

### Subtarefas

(nenhuma)

## PJ-ECWI3Z · E2-01 (portal) · Pacientes e clientes pela API

- id: cmvhn9xdw000wood294ecwi3z
- status: TODO
- pai: PJ-S1LO4U (cmvhn9wjw000uood216s1lo4u)
- responsáveis: Luis Gustavo
- prioridade: 4
- prazo: 2026-11-11T12:00:00.000Z
- criado: 2026-10-21T05:01:21.726Z · atualizado: 2026-10-21T05:01:21.726Z
- tags: admin, portal-parceiro

### Descrição

**O que fazer:** Busca, ficha, alertas, autorizados, mesclar, óbito e anonimizar; espécie no enum da API.
**Superfície:** portal (`petjourney-admin`)
**Depende da API:** card "E2-01 · Clientes e pacientes do parceiro" de outubro, prazo 22/10. Começa quando aquele card estiver Concluído e o handoff anexado aqui.
**Spec:** ver o documento da spec E2-01 no card de outubro (rotas, contrato e regras).
**Prazo:** sugerido para a semana da onda 1; ajustar com o Nicolas.

### Documentos

- [principal] Handoff E2-01: portal-parceiro-e2.md · portal-parceiro-e2.md · id cmviflhqufr5ze1qp77p · atualizado 2026-10-30T16:52:38.780Z

### Documentos herdados

- Épico E2: Clientes, pacientes e a ponte com o app do responsável · portal-parceiro-e2-pacientes-e-ponte.md · id cmvhn9x2m000vood2qz959bsk

### Subtarefas

(nenhuma)

### Comentários

#### Nicolas Castela · 2026-10-30T13:36:59.912Z

**Mudou (30/10), E2-01 no portal:** @Luís, duas mudanças na ficha do paciente e do cliente. Guias reanexados.

- Teto de 50 alertas ativos por paciente: 409 ALERTAS_NO_LIMITE ao criar, reativar ou mesclar acima disso (portal-parceiro-e2.md, seção 1.7).

- Anonimizar com o hotel suspenso e reserva paga não trava mais: a resposta traz comPagamento (avise o dono para acertar a devolução no balcão) e reservasAjustadas (portal-parceiro-e7.md, seção 45).

#### Nicolas Castela · 2026-10-30T16:53:06.859Z

**Mudou (30/10), exclusão com prontuário:** @Luís, a exclusão a pedido do cliente mudou (parecer jurídico). Guia reanexado, seção 1.11 do portal-parceiro-e2.md.

- O contato e o documento saem na hora. O prontuário fica bloqueado por 5 anos depois do último registro: a resposta traz bloqueadoAte; mostre a data na confirmação, com a copy sugerida no guia.

- Na hora da exclusão, os horários futuros são cancelados com o motivo EXCLUSAO_DO_TITULAR, a cópia do prontuário em aberto é encerrada e os rascunhos são descartados.

- Cliente bloqueado: o "Iniciar" do atendimento dá 403, e o paciente some da busca.

## PJ-HD8PAB · E2-02 (portal) · Propor vínculo: e-mail, código de balcão, acesso temporário e QR

- id: cmvhn9y43000xood21thd8pab
- status: TODO
- pai: PJ-S1LO4U (cmvhn9wjw000uood216s1lo4u)
- responsáveis: Luis Gustavo
- prioridade: 4
- prazo: 2026-11-11T12:00:00.000Z
- criado: 2026-10-21T05:01:22.668Z · atualizado: 2026-10-21T05:01:22.668Z
- tags: admin, portal-parceiro

### Descrição

**O que fazer:** Botões de propor vínculo, código para mostrar ou imprimir, e caixa de pedidos de correção.
**Superfície:** portal (`petjourney-admin`)
**Depende da API:** card "E2-02 · Vínculo entre paciente da clínica e pet do app, com consentimento" de outubro, prazo 22/10. Começa quando aquele card estiver Concluído e o handoff anexado aqui.
**Spec:** ver o documento da spec E2-02 no card de outubro (rotas, contrato e regras).
**Prazo:** sugerido para a semana da onda 1; ajustar com o Nicolas.

### Documentos

- [principal] Handoff E2-02: portal-parceiro-e2.md · portal-parceiro-e2.md · id cmviflmk235f1kvrcrer · atualizado 2026-10-30T13:32:59.341Z

### Documentos herdados

- Épico E2: Clientes, pacientes e a ponte com o app do responsável · portal-parceiro-e2-pacientes-e-ponte.md · id cmvhn9x2m000vood2qz959bsk

### Subtarefas

(nenhuma)

## PJ-NSCETD · E2-05 (portal) · Migrador com as dúvidas do servidor

- id: cmvhna1150011ood2jgnscetd
- status: TODO
- pai: PJ-S1LO4U (cmvhn9wjw000uood216s1lo4u)
- responsáveis: Luis Gustavo
- prioridade: 4
- prazo: 2026-11-18T12:00:00.000Z
- criado: 2026-10-21T05:01:26.451Z · atualizado: 2026-10-27T13:05:38.253Z
- tags: admin, portal-parceiro

### Descrição

**O que fazer:** Parar de baixar a base inteira; mandar as linhas em lotes, responder as dúvidas da API, acompanhar o job e desfazer.
**Superfície:** portal (`petjourney-admin`)
**Depende da API:** card "E2-05 · Migrador da base da clínica (importação em lotes, com relatório e desfazer)" de outubro, prazo 29/10 (replanejado em 27/10). Começa quando aquele card estiver Concluído e o handoff anexado aqui.
**Spec:** ver o documento da spec E2-05 no card de outubro (rotas, contrato e regras).
**Prazo:** sugerido para a semana da onda 2; ajustar com o Nicolas.

### Documentos

- [principal] Handoff E2-05: portal-parceiro-e2.md · portal-parceiro-e2.md · id cmvququ92d3ncgsot1ua · atualizado 2026-10-30T13:33:05.104Z

### Documentos herdados

- Épico E2: Clientes, pacientes e a ponte com o app do responsável · portal-parceiro-e2-pacientes-e-ponte.md · id cmvhn9x2m000vood2qz959bsk

### Subtarefas

(nenhuma)

## PJ-S1LO4U · Portal do parceiro · E2: Clientes, pacientes e a ponte com o app do responsável (fronts)

- id: cmvhn9wjw000uood216s1lo4u
- status: TODO
- pai: -
- responsáveis: Luis Gustavo
- prioridade: 4
- prazo: 2026-11-25T12:00:00.000Z
- criado: 2026-10-21T05:01:20.646Z · atualizado: 2026-10-22T22:29:51.643Z
- tags: admin, app, portal-parceiro

### Descrição

As telas do épico E2: Clientes, pacientes e a ponte com o app do responsável, ligadas à API que fica pronta em outubro. Cada subtarefa diz a superfície, o card da API de que depende e o que fazer. O handoff (`docs/implementacao-por-superficie/front-portal-parceiro-e2.md`) é anexado aqui quando a API terminar.
**Superfícies:** portal (petjourney-admin), app (petjourney-app).

### Documentos

- [principal] Épico E2: Clientes, pacientes e a ponte com o app do responsável · portal-parceiro-e2-pacientes-e-ponte.md · id cmvhn9x2m000vood2qz959bsk · atualizado 2026-10-21T05:01:21.454Z

### Documentos herdados

(nenhum)

### Subtarefas

- PJ-8BWAPV · id cmvhna0aw0010ood24g8bwapv · TODO · docs=1 · E2-04 (app) · Registros da clínica no app: selo, somente leitura e remover do meu app
- PJ-D5VP8X · id cmvi8uino0000hgd26bd5vp8x · TODO · docs=1 · E2-02 (site) · Link da proposta de vínculo da clínica abre o app
- PJ-ECWI3Z · id cmvhn9xdw000wood294ecwi3z · TODO · docs=1 · E2-01 (portal) · Pacientes e clientes pela API
- PJ-HD8PAB · id cmvhn9y43000xood21thd8pab · TODO · docs=1 · E2-02 (portal) · Propor vínculo: e-mail, código de balcão, acesso temporário e QR
- PJ-54B2YO · id cmvhn9yud000yood28154b2yo · TODO · docs=1 · E2-02 (app) · Minhas clínicas, vínculo proposto, resgatar código e consentimento
- PJ-NSCETD · id cmvhna1150011ood2jgnscetd · TODO · docs=1 · E2-05 (portal) · Migrador com as dúvidas do servidor
- PJ-AI84L1 · id cmvhn9zkp000zood24hai84l1 · TODO · docs=1 · E2-03 (portal) · "Este pet em 30 segundos" e diário pela API

---

# E3

## PJ-07YV9I · E3-04 (portal) · Fila de espera pela API

- id: cmvhna68n0019ood23l07yv9i
- status: TODO
- pai: PJ-YVNQK5 (cmvhna1rm0012ood2pyyvnqk5)
- responsáveis: Luis Gustavo
- prioridade: 4
- prazo: 2026-11-18T12:00:00.000Z
- criado: 2026-10-21T05:01:33.201Z · atualizado: 2026-10-27T13:05:38.404Z
- tags: admin, portal-parceiro

### Descrição

**O que fazer:** Entrar, posição, elegíveis e ofertar com prévia da mensagem.
**Superfície:** portal (`petjourney-admin`)
**Depende da API:** card "E3-04 · Fila de espera com oferta de vaga" de outubro, prazo 30/10 (replanejado em 27/10). Começa quando aquele card estiver Concluído e o handoff anexado aqui.
**Spec:** ver o documento da spec E3-04 no card de outubro (rotas, contrato e regras).
**Prazo:** sugerido para a semana da onda 2; ajustar com o Nicolas.

### Documentos

- [principal] Handoff E3-04: portal-parceiro-e3.md · portal-parceiro-e3.md · id cmvrbplmemoeaz3ygqr8 · atualizado 2026-10-29T05:11:38.680Z

### Documentos herdados

- Épico E3: Agenda e atendimento na recepção · portal-parceiro-e3-agenda.md · id cmvhna2ac0013ood2t0y72nlr

### Subtarefas

(nenhuma)

## PJ-1RTR5T · E3-07 (app) · Pré-consulta preenchida pelo diário

- id: cmvhna9vt001eood2ql1rtr5t
- status: TODO
- pai: PJ-YVNQK5 (cmvhna1rm0012ood2pyyvnqk5)
- responsáveis: Luis Gustavo
- prioridade: 3
- prazo: 2026-11-25T12:00:00.000Z
- criado: 2026-10-21T05:01:37.922Z · atualizado: 2026-10-27T13:05:38.855Z
- tags: app, portal-parceiro

### Descrição

**O que fazer:** Formulário, sugestão do diário, fotos e prazo.
**Superfície:** app (`petjourney-app`)
**Depende da API:** card "E3-07 · Pré-consulta (o responsável responde antes, preenchida pelo diário)" de outubro, prazo 02/11 (replanejado em 27/10). Começa quando aquele card estiver Concluído e o handoff anexado aqui.
**Spec:** ver o documento da spec E3-07 no card de outubro (rotas, contrato e regras).
**Prazo:** sugerido para a semana da onda 3; ajustar com o Nicolas.

### Documentos

- [principal] Handoff E3-07: portal-parceiro-e3.md · portal-parceiro-e3.md · id cmvrnw1azqj6e2sjxpg8 · atualizado 2026-10-29T05:11:38.997Z

### Documentos herdados

- Épico E3: Agenda e atendimento na recepção · portal-parceiro-e3-agenda.md · id cmvhna2ac0013ood2t0y72nlr

### Subtarefas

(nenhuma)

## PJ-36ORD4 · E3-05 (app) · Pedir horário pelo app

- id: cmvhna8fc001cood24736ord4
- status: TODO
- pai: PJ-YVNQK5 (cmvhna1rm0012ood2pyyvnqk5)
- responsáveis: Luis Gustavo
- prioridade: 4
- prazo: 2026-11-18T12:00:00.000Z
- criado: 2026-10-21T05:01:36.034Z · atualizado: 2026-10-27T13:05:36.752Z
- tags: app, portal-parceiro

### Descrição

**Novo em 22/10, atenção:** esta tela também abre pelo link `petjourneyapp://agendar/<slug>`, que vem do botão "Peça pelo app" da página da clínica no site. Rota `agendar/[slug]` lendo `GET /tutor/clinica/estabelecimentos/:slug/agendamento-online`. Deslogado: entra e volta para o pedido. No perfil de parceiro: pede para trocar para o de responsável. Slug que não existe: mensagem e volta para a home, nunca "rota não encontrada". Ainda não: `/agendar/*` e `/reservar/*` nos links que abrem o app sozinho, porque quem tiver uma versão antiga do app cairia em "rota não encontrada".
**O que fazer:** Dois caminhos, emergência, reserva de 5 minutos, até 3 pets, primeira vez com histórico.
**Superfície:** app (`petjourney-app`)
**Depende da API:** card "E3-05 · Agendamento online (pedido pelo app e pela página pública, caixa da recepção)" de outubro, prazo 30/10 (replanejado em 27/10). Começa quando aquele card estiver Concluído e o handoff anexado aqui.
**Spec:** ver o documento da spec E3-05 no card de outubro (rotas, contrato e regras).
**Prazo:** sugerido para a semana da onda 2; ajustar com o Nicolas.

### Documentos

- [principal] Handoff E3-05: portal-parceiro-e3.md · portal-parceiro-e3.md · id cmvrbpq86n8tb5rpjf5f · atualizado 2026-10-30T13:33:07.030Z

### Documentos herdados

- Épico E3: Agenda e atendimento na recepção · portal-parceiro-e3-agenda.md · id cmvhna2ac0013ood2t0y72nlr

### Subtarefas

(nenhuma)

### Comentários

#### Nicolas Castela · 2026-10-30T13:36:54.050Z

**Mudou (30/10), E3-05 no app:** @Luís, o pedido de horário pelo app passou para o mesmo modelo da reserva do hotel: o pedido não segura o horário. Guia reanexado, seção 6.12 do portal-parceiro-e3.md. O que muda:

- Tire "horário reservado", "garantido" e o relógio de 5 minutos. Mostre "Sujeito à confirmação da clínica." antes de enviar e na confirmação (texto nos 6 idiomas no guia).

- Dia com pedidosNoLimite e o 409 PEDIDOS_NO_LIMITE (escopo CLINICA): mensagem com os botões de telefone e WhatsApp, sem enviar. O campo clienteDaCasa diz se a pessoa fica fora desse teto.

- O pedido de quem já é cliente pode voltar ACEITO ou PENDENTE: trate os dois.

- O 429 PEDIDO_TAXA_EXCEDIDA também conta pela origem (20 por hora); a tela do 429 não muda.

## PJ-4BS8TK · E3-02 (portal) · Agenda pela API

- id: cmvhna3bu0015ood2lm4bs8tk
- status: TODO
- pai: PJ-YVNQK5 (cmvhna1rm0012ood2pyyvnqk5)
- responsáveis: Luis Gustavo
- prioridade: 4
- prazo: 2026-11-18T12:00:00.000Z
- criado: 2026-10-21T05:01:29.428Z · atualizado: 2026-10-21T05:01:29.428Z
- tags: admin, portal-parceiro

### Descrição

**O que fazer:** Dia, semana, criar, mover, cancelar, desfazer e chegada com versão e conflitos do servidor; apagar conflicts.ts, slots.ts e load.ts locais.
**Superfície:** portal (`petjourney-admin`)
**Depende da API:** card "E3-02 · Agenda e agendamentos" de outubro, prazo 23/10. Começa quando aquele card estiver Concluído e o handoff anexado aqui.
**Spec:** ver o documento da spec E3-02 no card de outubro (rotas, contrato e regras).
**Prazo:** sugerido para a semana da onda 2; ajustar com o Nicolas.

### Documentos

- [principal] Handoff E3-02: portal-parceiro-e3.md · portal-parceiro-e3.md · id cmviskootqxkwymhaczg · atualizado 2026-10-29T05:11:38.211Z

### Documentos herdados

- Épico E3: Agenda e atendimento na recepção · portal-parceiro-e3-agenda.md · id cmvhna2ac0013ood2t0y72nlr

### Subtarefas

(nenhuma)

## PJ-6W6XHY · E3-06 (app) · Leva única dos tipos de notificação clínica

- id: cmvhna95l001dood2qi6w6xhy
- status: TODO
- pai: PJ-YVNQK5 (cmvhna1rm0012ood2pyyvnqk5)
- responsáveis: Luis Gustavo
- prioridade: 4
- prazo: 2026-11-18T12:00:00.000Z
- criado: 2026-10-21T05:01:36.979Z · atualizado: 2026-10-27T13:27:25.007Z
- tags: app, portal-parceiro

### Descrição

**O que fazer:** Todos os tipos novos de uma vez: ROTA_POR_TIPO, ícones, AFETA_HOME_POR_TIPO e as telas /screens/clinica/*.
**Superfície:** app (`petjourney-app`)
**Depende da API:** card "E3-06 · Avisos clínicos ao responsável (tipos da agenda, véspera, comprovante e quem não tem app)" de outubro, prazo 29/10 (replanejado em 27/10). Começa quando aquele card estiver Concluído e o handoff anexado aqui.
**Spec:** ver o documento da spec E3-06 no card de outubro (rotas, contrato e regras).
**Prazo:** sugerido para a semana da onda 2; ajustar com o Nicolas.
**Decidido pelo Nicolas (27/10):**

- a família lê a mensagem que a clínica escreve (o texto da recepção no remarcado e no cancelado): quem tem leitura do pet vê o mesmo texto que o titular;

- a mensagem da clínica fica guardada no comprovante sem prazo; só a anonimização e a exclusão da conta apagam.
**Detalhe:** entra na spec da E3-06 e no guia anexado aqui quando a API fechar.

### Documentos

- [principal] Handoff E3-06: portal-parceiro-e3.md · portal-parceiro-e3.md · id cmvqrhwb2ozq9n61kwle · atualizado 2026-10-29T05:11:38.053Z

### Documentos herdados

- Épico E3: Agenda e atendimento na recepção · portal-parceiro-e3-agenda.md · id cmvhna2ac0013ood2t0y72nlr

### Subtarefas

(nenhuma)

## PJ-GL3IVL · E3-01 (portal) · Configuração da agenda pela API

- id: cmvhna2ln0014ood28tgl3ivl
- status: TODO
- pai: PJ-YVNQK5 (cmvhna1rm0012ood2pyyvnqk5)
- responsáveis: Luis Gustavo
- prioridade: 4
- prazo: 2026-11-18T12:00:00.000Z
- criado: 2026-10-21T05:01:28.484Z · atualizado: 2026-10-21T05:01:28.484Z
- tags: admin, portal-parceiro

### Descrição

**O que fazer:** Salas, tipos de atendimento, expediente por profissional, bloqueios recorrentes e política.
**Superfície:** portal (`petjourney-admin`)
**Depende da API:** card "E3-01 · Configuração da agenda (tipos de atendimento, salas, expediente, bloqueios e política)" de outubro, prazo 23/10. Começa quando aquele card estiver Concluído e o handoff anexado aqui.
**Spec:** ver o documento da spec E3-01 no card de outubro (rotas, contrato e regras).
**Prazo:** sugerido para a semana da onda 2; ajustar com o Nicolas.

### Documentos

- [principal] Handoff E3-01: portal-parceiro-e3.md · portal-parceiro-e3.md · id cmvimpt8bqxmx2evtx7 · atualizado 2026-10-29T05:11:38.523Z

### Documentos herdados

- Épico E3: Agenda e atendimento na recepção · portal-parceiro-e3-agenda.md · id cmvhna2ac0013ood2t0y72nlr

### Subtarefas

(nenhuma)

## PJ-KEDUBV · E3-02 (app) · Meus agendamentos: confirmar e cancelar no prazo

- id: cmvhna4240016ood2hykedubv
- status: TODO
- pai: PJ-YVNQK5 (cmvhna1rm0012ood2pyyvnqk5)
- responsáveis: Luis Gustavo
- prioridade: 4
- prazo: 2026-11-18T12:00:00.000Z
- criado: 2026-10-21T05:01:30.374Z · atualizado: 2026-10-21T05:01:30.374Z
- tags: app, portal-parceiro

### Descrição

**O que fazer:** Lista e detalhe com podeConfirmar, podeCancelar e cancelarAte prontos da API.
**Superfície:** app (`petjourney-app`)
**Depende da API:** card "E3-02 · Agenda e agendamentos" de outubro, prazo 23/10. Começa quando aquele card estiver Concluído e o handoff anexado aqui.
**Spec:** ver o documento da spec E3-02 no card de outubro (rotas, contrato e regras).
**Prazo:** sugerido para a semana da onda 2; ajustar com o Nicolas.

### Documentos

- [principal] Handoff E3-02: portal-parceiro-e3.md · portal-parceiro-e3.md · id cmviskogzb44vyb3htlu · atualizado 2026-10-29T05:11:38.367Z

### Documentos herdados

- Épico E3: Agenda e atendimento na recepção · portal-parceiro-e3-agenda.md · id cmvhna2ac0013ood2t0y72nlr

### Subtarefas

(nenhuma)

### Comentários

#### Nicolas Castela · 2026-10-30T16:53:08.490Z

**Mudou (30/10), horário cancelado na exclusão:** @Luís, o horário cancelado pelo pedido de exclusão de dados chega no app com o motivo null. A tela precisa aceitar o cancelamento sem motivo. Detalhe na seção 1.11 do portal-parceiro-e2.md.

## PJ-KTCYO2 · E3-04 (app) · Fila e oferta de vaga com contador

- id: cmvhna6yu001aood2vqktcyo2
- status: TODO
- pai: PJ-YVNQK5 (cmvhna1rm0012ood2pyyvnqk5)
- responsáveis: Luis Gustavo
- prioridade: 4
- prazo: 2026-11-18T12:00:00.000Z
- criado: 2026-10-21T05:01:34.143Z · atualizado: 2026-10-27T13:05:38.558Z
- tags: app, portal-parceiro

### Descrição

**O que fazer:** Entrar, sair, aceitar e recusar a oferta dentro do prazo.
**Superfície:** app (`petjourney-app`)
**Depende da API:** card "E3-04 · Fila de espera com oferta de vaga" de outubro, prazo 30/10 (replanejado em 27/10). Começa quando aquele card estiver Concluído e o handoff anexado aqui.
**Spec:** ver o documento da spec E3-04 no card de outubro (rotas, contrato e regras).
**Prazo:** sugerido para a semana da onda 2; ajustar com o Nicolas.

### Documentos

- [principal] Handoff E3-04: portal-parceiro-e3.md · portal-parceiro-e3.md · id cmvrbpledsy73gc74vw · atualizado 2026-10-29T05:11:38.836Z

### Documentos herdados

- Épico E3: Agenda e atendimento na recepção · portal-parceiro-e3-agenda.md · id cmvhna2ac0013ood2t0y72nlr

### Subtarefas

(nenhuma)

## PJ-MVMNOZ · E3-03 (portal) · Faltas pela API

- id: cmvhna4sa0017ood2y0mvmnoz
- status: TODO
- pai: PJ-YVNQK5 (cmvhna1rm0012ood2pyyvnqk5)
- responsáveis: Luis Gustavo
- prioridade: 4
- prazo: 2026-11-18T12:00:00.000Z
- criado: 2026-10-21T05:01:31.316Z · atualizado: 2026-10-21T05:01:31.316Z
- tags: admin, portal-parceiro

### Descrição

**O que fazer:** Marcar (inclusive em lote), justificar, painel, histórico e reagendar.
**Superfície:** portal (`petjourney-admin`)
**Depende da API:** card "E3-03 · Faltas (marcar, justificar, painel, reincidência e reagendar)" de outubro, prazo 24/10. Começa quando aquele card estiver Concluído e o handoff anexado aqui.
**Spec:** ver o documento da spec E3-03 no card de outubro (rotas, contrato e regras).
**Prazo:** sugerido para a semana da onda 2; ajustar com o Nicolas.

### Documentos

- [principal] Handoff E3-03: portal-parceiro-e3.md · portal-parceiro-e3.md · id cmvokwxwi8mm612fs2tw · atualizado 2026-10-29T05:11:39.465Z

### Documentos herdados

- Épico E3: Agenda e atendimento na recepção · portal-parceiro-e3-agenda.md · id cmvhna2ac0013ood2t0y72nlr

### Subtarefas

(nenhuma)

## PJ-O5A3ME · E3-03 (app) · Justificar falta pelo app

- id: cmvhna5ig0018ood2tyo5a3me
- status: TODO
- pai: PJ-YVNQK5 (cmvhna1rm0012ood2pyyvnqk5)
- responsáveis: Luis Gustavo
- prioridade: 4
- prazo: 2026-11-18T12:00:00.000Z
- criado: 2026-10-21T05:01:32.259Z · atualizado: 2026-10-21T05:01:32.259Z
- tags: app, portal-parceiro

### Descrição

**O que fazer:** POST /tutor/clinica/agendamentos/:id/justificar-falta.
**Superfície:** app (`petjourney-app`)
**Depende da API:** card "E3-03 · Faltas (marcar, justificar, painel, reincidência e reagendar)" de outubro, prazo 24/10. Começa quando aquele card estiver Concluído e o handoff anexado aqui.
**Spec:** ver o documento da spec E3-03 no card de outubro (rotas, contrato e regras).
**Prazo:** sugerido para a semana da onda 2; ajustar com o Nicolas.

### Documentos

- [principal] Handoff E3-03: portal-parceiro-e3.md · portal-parceiro-e3.md · id cmvokwxo7wn4cflitm4a · atualizado 2026-10-29T05:11:39.309Z

### Documentos herdados

- Épico E3: Agenda e atendimento na recepção · portal-parceiro-e3-agenda.md · id cmvhna2ac0013ood2t0y72nlr

### Subtarefas

(nenhuma)

## PJ-OKGQZP · E3-07 (portal) · Pré-consulta na anamnese, com procedência

- id: cmvhnaalz001food2jdokgqzp
- status: TODO
- pai: PJ-YVNQK5 (cmvhna1rm0012ood2pyyvnqk5)
- responsáveis: Luis Gustavo
- prioridade: 3
- prazo: 2026-11-25T12:00:00.000Z
- criado: 2026-10-21T05:01:38.865Z · atualizado: 2026-10-27T13:05:38.999Z
- tags: admin, portal-parceiro

### Descrição

**O que fazer:** Painel de sugestão que aplica só em campo vazio, marcado "do diário".
**Superfície:** portal (`petjourney-admin`)
**Depende da API:** card "E3-07 · Pré-consulta (o responsável responde antes, preenchida pelo diário)" de outubro, prazo 02/11 (replanejado em 27/10). Começa quando aquele card estiver Concluído e o handoff anexado aqui.
**Spec:** ver o documento da spec E3-07 no card de outubro (rotas, contrato e regras).
**Prazo:** sugerido para a semana da onda 3; ajustar com o Nicolas.

### Documentos

- [principal] Handoff E3-07: portal-parceiro-e3.md · portal-parceiro-e3.md · id cmvrnw1r1buvafuvqb1t · atualizado 2026-10-29T05:11:39.153Z

### Documentos herdados

- Épico E3: Agenda e atendimento na recepção · portal-parceiro-e3-agenda.md · id cmvhna2ac0013ood2t0y72nlr

### Subtarefas

(nenhuma)

## PJ-SVL85R · E3-05 (portal, site) · Pedido de horário: página no site, caixa no portal

- id: cmvhna7p0001bood29wsvl85r
- status: TODO
- pai: PJ-YVNQK5 (cmvhna1rm0012ood2pyyvnqk5)
- responsáveis: Luis Gustavo
- prioridade: 4
- prazo: 2026-11-18T12:00:00.000Z
- criado: 2026-10-21T05:01:35.086Z · atualizado: 2026-10-22T21:46:58.981Z
- tags: admin, web, portal-parceiro

### Descrição

**Novo em 22/10, atenção:** ao lado do formulário sem conta, a página mostra o botão "Já usa a PetJourney? Peça pelo app" (`petjourneyapp://agendar/<slug>`, com `/baixar-app` se o app não abrir). Motivo: quem já tem a PetJourney deve pedir pelo app, porque o pedido pelo app usa o pet do app e ativa o vínculo, e o do site cria um cadastro solto na clínica. Seção 1.2 do handoff `portal-parceiro-e1.md`.
**O que é:** Quem não tem app pede horário pela página pública da clínica, sem criar conta, e a recepção responde pelo portal.
**Decisão do Nicolas (22/10, Q2 do Portal do parceiro):** a página do pedido e a de acompanhamento ficam no site; a caixa da recepção fica no portal.
**No site:** Em `petjourney.health/agendar/<slug>`, o formulário com nome, telefone com DDD, e-mail opcional e os dados do pet, com captcha. Depois, a página de acompanhamento em `/pedido/<token>` (o link também vai por e-mail, se a pessoa informou).
**No portal:** A caixa da recepção (aceitar, marcar outro horário, recusar com motivo), o aceite automático e a configuração do agendamento online.
**Depende de:** A API do agendamento online (card de outubro "E3-05 · Agendamento online", prevista para 24/10). Até lá dá para adiantar o visual.
**Pronto quando:** Um pedido feito pelo site aparece na caixa do portal, a recepção aceita, e a página de acompanhamento mostra o horário confirmado.
**Para quem implementa:** Spec E3-05: rotas `/public/estabelecimentos/:slug/agendamento/*` e `/public/pedidos/:token`; captcha Turnstile no header `X-Captcha-Token`; `Idempotency-Key` na criação. Emergência não vira pedido: vira o contato da clínica.

### Documentos

- [principal] Handoff E3-05: portal-parceiro-e3.md · portal-parceiro-e3.md · id cmvrbpqgobg2wddy1hpf · atualizado 2026-10-30T13:33:07.467Z

### Documentos herdados

- Épico E3: Agenda e atendimento na recepção · portal-parceiro-e3-agenda.md · id cmvhna2ac0013ood2t0y72nlr

### Subtarefas

(nenhuma)

### Comentários

#### Nicolas Castela · 2026-10-30T13:36:53.454Z

**Mudou (30/10), E3-05 no portal e no site:** @Luís, o pedido de horário passou para o mesmo modelo da reserva do hotel: o pedido não segura o horário, e a vaga só fica garantida quando a clínica aceita. Guia reanexado, seção 6.12 do portal-parceiro-e3.md. O que muda:

- Site: tire "horário reservado", "garantido" e o relógio de 5 minutos. Mostre "Sujeito à confirmação da clínica." antes de enviar e na confirmação.

- Dia com pedidosNoLimite e o 409 PEDIDOS_NO_LIMITE (escopo CLINICA): mostre a mensagem com os botões de telefone e WhatsApp da clínica e não deixe enviar.

- Portal, caixa: aceitar pode dar 409 HORARIO_JA_TOMADO; abra as sugestões ou a recusa. O encaixe de propósito pede confirmação explícita.

- Portal, configuração: aceitarSozinho vale só para quem já é cliente (até 2 horários por cliente). Texto sugerido no guia.

- Saíram o 409 RESERVAS_NO_LIMITE sem escopo e o teto de 50 pendentes do site.

## PJ-W2RB1D · E3-08 (portal) · Meu dia, Atividades, resumo e Início da redesign pela API

- id: cmvhnabc7001good22qw2rb1d
- status: TODO
- pai: PJ-YVNQK5 (cmvhna1rm0012ood2pyyvnqk5)
- responsáveis: Luis Gustavo
- prioridade: 3
- prazo: 2026-11-25T12:00:00.000Z
- criado: 2026-10-21T05:01:39.808Z · atualizado: 2026-10-21T05:01:39.808Z
- tags: admin, portal-parceiro

### Descrição

**O que fazer:** Trocar as contas locais (resumo.ts) pelas rotas de painel.
**Superfície:** portal (`petjourney-admin`)
**Depende da API:** card "E3-08 · Painel do dia ("Meu dia", "Atividades") e resumo da clínica" de outubro, prazo 25/10. Começa quando aquele card estiver Concluído e o handoff anexado aqui.
**Spec:** ver o documento da spec E3-08 no card de outubro (rotas, contrato e regras).
**Prazo:** sugerido para a semana da onda 3; ajustar com o Nicolas.

### Documentos

(nenhum)

### Documentos herdados

- Épico E3: Agenda e atendimento na recepção · portal-parceiro-e3-agenda.md · id cmvhna2ac0013ood2t0y72nlr

### Subtarefas

(nenhuma)

## PJ-YVNQK5 · Portal do parceiro · E3: Agenda e atendimento na recepção (fronts)

- id: cmvhna1rm0012ood2pyyvnqk5
- status: TODO
- pai: -
- responsáveis: Luis Gustavo
- prioridade: 4
- prazo: 2026-11-25T12:00:00.000Z
- criado: 2026-10-21T05:01:27.405Z · atualizado: 2026-10-22T22:29:51.647Z
- tags: admin, app, portal-parceiro

### Descrição

As telas do épico E3: Agenda e atendimento na recepção, ligadas à API que fica pronta em outubro. Cada subtarefa diz a superfície, o card da API de que depende e o que fazer. O handoff (`docs/implementacao-por-superficie/front-portal-parceiro-e3.md`) é anexado aqui quando a API terminar.
**Superfícies:** portal (petjourney-admin), app (petjourney-app).

### Documentos

- [principal] Épico E3: Agenda e atendimento na recepção · portal-parceiro-e3-agenda.md · id cmvhna2ac0013ood2t0y72nlr · atualizado 2026-10-21T05:01:28.212Z

### Documentos herdados

(nenhum)

### Subtarefas

- PJ-SVL85R · id cmvhna7p0001bood29wsvl85r · TODO · docs=1 · E3-05 (portal, site) · Pedido de horário: página no site, caixa no portal
- PJ-O5A3ME · id cmvhna5ig0018ood2tyo5a3me · TODO · docs=1 · E3-03 (app) · Justificar falta pelo app
- PJ-4BS8TK · id cmvhna3bu0015ood2lm4bs8tk · TODO · docs=1 · E3-02 (portal) · Agenda pela API
- PJ-07YV9I · id cmvhna68n0019ood23l07yv9i · TODO · docs=1 · E3-04 (portal) · Fila de espera pela API
- PJ-KEDUBV · id cmvhna4240016ood2hykedubv · TODO · docs=1 · E3-02 (app) · Meus agendamentos: confirmar e cancelar no prazo
- PJ-OKGQZP · id cmvhnaalz001food2jdokgqzp · TODO · docs=1 · E3-07 (portal) · Pré-consulta na anamnese, com procedência
- PJ-6W6XHY · id cmvhna95l001dood2qi6w6xhy · TODO · docs=1 · E3-06 (app) · Leva única dos tipos de notificação clínica
- PJ-1RTR5T · id cmvhna9vt001eood2ql1rtr5t · TODO · docs=1 · E3-07 (app) · Pré-consulta preenchida pelo diário
- PJ-GL3IVL · id cmvhna2ln0014ood28tgl3ivl · TODO · docs=1 · E3-01 (portal) · Configuração da agenda pela API
- PJ-MVMNOZ · id cmvhna4sa0017ood2y0mvmnoz · TODO · docs=1 · E3-03 (portal) · Faltas pela API
- PJ-36ORD4 · id cmvhna8fc001cood24736ord4 · TODO · docs=1 · E3-05 (app) · Pedir horário pelo app
- PJ-KTCYO2 · id cmvhna6yu001aood2vqktcyo2 · TODO · docs=1 · E3-04 (app) · Fila e oferta de vaga com contador
- PJ-W2RB1D · id cmvhnabc7001good22qw2rb1d · TODO · docs=0 · E3-08 (portal) · Meu dia, Atividades, resumo e Início da redesign pela API

---

# E4

## PJ-0EK0TY · E4-06 (portal) · Documentos clínicos, termos e cópia do prontuário

- id: cmvhnakwt001uood2cs0ek0ty
- status: TODO
- pai: PJ-6I8QD7 (cmvhnac2d001hood25b6i8qd7)
- responsáveis: Luis Gustavo
- prioridade: 3
- prazo: 2026-11-25T12:00:00.000Z
- criado: 2026-10-21T05:01:52.215Z · atualizado: 2026-10-27T13:05:37.346Z
- tags: admin, portal-parceiro

### Descrição

**O que fazer:** Emitir, aceite no balcão, laudos e pedidos de cópia com prazo.
**Superfície:** portal (`petjourney-admin`)
**Depende da API:** card "E4-06 · Documentos clínicos (atestados, termos, pedidos de exame, laudos e cópia do prontuário)" de outubro, prazo 06/11 (replanejado em 27/10). Começa quando aquele card estiver Concluído e o handoff anexado aqui.
**Spec:** ver o documento da spec E4-06 no card de outubro (rotas, contrato e regras).
**Prazo:** sugerido para a semana da onda 3; ajustar com o Nicolas.

### Documentos

- [principal] Handoff E4-06: portal-parceiro-e4.md · portal-parceiro-e4.md · id cmvtwa12xydzcuvw0vd · atualizado 2026-10-30T16:52:41.160Z

### Documentos herdados

- Épico E4: Prontuário, receita, vacinas e adesão · portal-parceiro-e4-prontuario.md · id cmvhnacl3001iood29qol38zq

### Subtarefas

(nenhuma)

### Comentários

#### Nicolas Castela · 2026-10-29T18:48:31.786Z

**Guia atualizado (29/10, G4):** guia anexado de novo (portal-parceiro-e4.md), com a seção 14 nova (629493c no develop):

- A cópia do prontuário agora traz a seção Internações no PDF. As rotas não mudam. Se passar dos tetos, o PDF pede um período menor: mostre o mesmo conselho na tela de gerar.

- POST /parceiro/portal/clinica/documentos aceita internacaoId (por exemplo, a declaração de óbito de quem morreu internado). O botão na tela da internação já pode mandar o id.

#### Nicolas Castela · 2026-10-30T13:36:56.977Z

**Mudou (30/10), E4-06 no portal:** @Luís, prorrogar e recusar a cópia do prontuário são atos legais e agora exigem o selo (E1-08). Use atosAguardandoConferencia do /parceiro/portal/eu no botão (portal-parceiro-e1.md, seção 9.1).

#### Nicolas Castela · 2026-10-30T16:53:07.404Z

**Mudou (30/10), cópia do prontuário:** @Luís, o pedido de cópia ganha o status ENCERRADO_NA_EXCLUSAO (o responsável pediu a exclusão dos dados), e o solicitante aparece como "Anonimizado". Mostre esse status sem ações. Guia reanexado, portal-parceiro-e4.md.

## PJ-401I65 · E4-05 (app) · Criar lembretes da receita e Dei/Pulei com motivo

- id: cmvhnajg4001sood2x6401i65
- status: TODO
- pai: PJ-6I8QD7 (cmvhnac2d001hood25b6i8qd7)
- responsáveis: Luis Gustavo
- prioridade: 3
- prazo: 2026-11-25T12:00:00.000Z
- criado: 2026-10-21T05:01:50.318Z · atualizado: 2026-10-27T13:05:36.908Z
- tags: app, portal-parceiro

### Descrição

**O que fazer:** Um toque por item, horário sugerido, compartilhar com a clínica, dose já registrada por outra pessoa.
**Superfície:** app (`petjourney-app`)
**Depende da API:** card "E4-05 · Tratamentos em casa e adesão (receita que vira lembrete, dose dada ou pulada, alerta para a clínica)" de outubro, prazo 05/11 (replanejado em 27/10). Começa quando aquele card estiver Concluído e o handoff anexado aqui.
**Spec:** ver o documento da spec E4-05 no card de outubro (rotas, contrato e regras).
**Prazo:** sugerido para a semana da onda 3; ajustar com o Nicolas.

### Documentos

- [principal] Spec E4-05: tratamentos em casa e adesão · 05-tratamentos-e-adesao.md · id cmvkfnm4f000saod2d6belwup · atualizado 2026-10-23T03:51:22.047Z
- Handoff E4-05: portal-parceiro-e4.md · portal-parceiro-e4.md · id cmvv0ixk67heiwsngxjb · atualizado 2026-10-30T13:33:19.137Z

### Documentos herdados

- Épico E4: Prontuário, receita, vacinas e adesão · portal-parceiro-e4-prontuario.md · id cmvhnacl3001iood29qol38zq

### Subtarefas

(nenhuma)

## PJ-6I8QD7 · Portal do parceiro · E4: Prontuário, receita, vacinas e adesão (fronts)

- id: cmvhnac2d001hood25b6i8qd7
- status: TODO
- pai: -
- responsáveis: Luis Gustavo
- prioridade: 4
- prazo: 2026-11-27T12:00:00.000Z
- criado: 2026-10-21T05:01:40.751Z · atualizado: 2026-10-22T22:29:51.653Z
- tags: admin, app, web, cms, portal-parceiro

### Descrição

As telas do épico E4: Prontuário, receita, vacinas e adesão, ligadas à API que fica pronta em outubro. Cada subtarefa diz a superfície, o card da API de que depende e o que fazer. O handoff (`docs/implementacao-por-superficie/front-portal-parceiro-e4.md`) é anexado aqui quando a API terminar.
**Superfícies:** portal (petjourney-admin), app (petjourney-app), cms (petjourney-cms), site (petjourney-web).

### Documentos

- [principal] Épico E4: Prontuário, receita, vacinas e adesão · portal-parceiro-e4-prontuario.md · id cmvhnacl3001iood29qol38zq · atualizado 2026-10-21T05:01:41.559Z

### Documentos herdados

(nenhum)

### Subtarefas

- PJ-R4HBGA · id cmvhnaf2y001mood2w0r4hbga · TODO · docs=1 · E4-02 (cms) · Curadoria do catálogo clínico global
- PJ-PLOD6B · id cmvhnah9l001pood23cplod6b · TODO · docs=1 · E4-03 (site) · Página de verificação da receita pelo QR
- PJ-E3OKDS · id cmvhnagje001oood2jae3okds · TODO · docs=1 · E4-03 (app) · Receita no resumo e salvar nos documentos
- PJ-FCP48H · id cmvhnamd7001wood2oqfcp48h · TODO · docs=1 · E4-06 (site) · Página de verificação dos documentos clínicos pelo QR
- PJ-401I65 · id cmvhnajg4001sood2x6401i65 · TODO · docs=2 · E4-05 (app) · Criar lembretes da receita e Dei/Pulei com motivo
- PJ-7JRYWN · id cmvhnaecr001lood2gi7jrywn · TODO · docs=1 · E4-02 (portal) · Bulário, catálogos e cálculo de dose pela API
- PJ-QQT1WN · id cmvhnacwc001jood27pqqt1wn · TODO · docs=1 · E4-01 (portal) · Prontuário pela API
- PJ-L3V7JK · id cmvhnaft7001nood2iml3v7jk · TODO · docs=1 · E4-03 (portal) · Receita: assinar com senha, PDF e verificação
- PJ-XV0VW7 · id cmvhnaipy001rood2lexv0vw7 · TODO · docs=1 · E4-04 (app) · Carteirinha conectada
- PJ-B4VSDJ · id cmvhnadmk001kood216b4vsdj · TODO · docs=1 · E4-01 (app) · Resumo do atendimento no app
- PJ-VQVQ0C · id cmvhnahzr001qood2zcvqvq0c · TODO · docs=1 · E4-04 (portal) · Vacinas pela API
- PJ-AEIQ9E · id cmvhnaln0001vood2enaeiq9e · TODO · docs=1 · E4-06 (app) · Termos para aceitar e pedir cópia do prontuário
- PJ-0EK0TY · id cmvhnakwt001uood2cs0ek0ty · TODO · docs=1 · E4-06 (portal) · Documentos clínicos, termos e cópia do prontuário
- PJ-LU09N7 · id cmvhnak6n001tood2o1lu09n7 · TODO · docs=2 · E4-05 (portal) · Tratamentos em casa e alerta de adesão

## PJ-7JRYWN · E4-02 (portal) · Bulário, catálogos e cálculo de dose pela API

- id: cmvhnaecr001lood2gi7jrywn
- status: TODO
- pai: PJ-6I8QD7 (cmvhnac2d001hood25b6i8qd7)
- responsáveis: Luis Gustavo
- prioridade: 4
- prazo: 2026-11-18T12:00:00.000Z
- criado: 2026-10-21T05:01:43.718Z · atualizado: 2026-10-21T05:01:43.718Z
- tags: admin, portal-parceiro

### Descrição

**O que fazer:** Trocar os fixtures e o dose.ts local pelas rotas de catálogo e de cálculo.
**Superfície:** portal (`petjourney-admin`)
**Depende da API:** card "E4-02 · Catálogos clínicos (faixas de referência, diagnósticos, exames, bulário, vacinas)" de outubro, prazo 23/10. Começa quando aquele card estiver Concluído e o handoff anexado aqui.
**Spec:** ver o documento da spec E4-02 no card de outubro (rotas, contrato e regras).
**Prazo:** sugerido para a semana da onda 2; ajustar com o Nicolas.

### Documentos

- [principal] Handoff E4-02: portal-parceiro-e4.md · portal-parceiro-e4.md · id cmvimpxol2j2yvft43bh · atualizado 2026-10-30T16:07:29.532Z

### Documentos herdados

- Épico E4: Prontuário, receita, vacinas e adesão · portal-parceiro-e4-prontuario.md · id cmvhnacl3001iood29qol38zq

### Subtarefas

(nenhuma)

### Comentários

#### Nicolas Castela · 2026-10-30T13:36:55.222Z

**Mudou (30/10), E4-02 no portal:** @Luís, teto novo nos acréscimos da clínica. Guia reanexado, seção 1.7 do portal-parceiro-e4.md.

- A clínica pode ter até 2.000 medicamentos próprios. O seguinte dá 409 CATALOGO_MEDICAMENTOS_NO_LIMITE: mostre o texto do guia e leve para a lista de acréscimos.

#### Nicolas Castela · 2026-10-30T16:07:33.726Z

**Mudou (30/10), catálogo:** @Luís, o medicamento ganha manipulado: boolean (a clínica marca nos acréscimos). Guia reanexado, seção 6.8 do portal-parceiro-e4.md.

## PJ-AEIQ9E · E4-06 (app) · Termos para aceitar e pedir cópia do prontuário

- id: cmvhnaln0001vood2enaeiq9e
- status: TODO
- pai: PJ-6I8QD7 (cmvhnac2d001hood25b6i8qd7)
- responsáveis: Luis Gustavo
- prioridade: 3
- prazo: 2026-11-25T12:00:00.000Z
- criado: 2026-10-21T05:01:53.158Z · atualizado: 2026-10-27T13:05:37.502Z
- tags: app, portal-parceiro

### Descrição

**O que fazer:** Aceitar ou recusar termo (menos eutanásia) e pedir a cópia.
**Superfície:** app (`petjourney-app`)
**Depende da API:** card "E4-06 · Documentos clínicos (atestados, termos, pedidos de exame, laudos e cópia do prontuário)" de outubro, prazo 06/11 (replanejado em 27/10). Começa quando aquele card estiver Concluído e o handoff anexado aqui.
**Spec:** ver o documento da spec E4-06 no card de outubro (rotas, contrato e regras).
**Prazo:** sugerido para a semana da onda 3; ajustar com o Nicolas.

### Documentos

- [principal] Handoff E4-06: portal-parceiro-e4.md · portal-parceiro-e4.md · id cmvtwa0r30gihfld7wrph · atualizado 2026-10-30T16:52:40.722Z

### Documentos herdados

- Épico E4: Prontuário, receita, vacinas e adesão · portal-parceiro-e4-prontuario.md · id cmvhnacl3001iood29qol38zq

### Subtarefas

(nenhuma)

## PJ-B4VSDJ · E4-01 (app) · Resumo do atendimento no app

- id: cmvhnadmk001kood216b4vsdj
- status: TODO
- pai: PJ-6I8QD7 (cmvhnac2d001hood25b6i8qd7)
- responsáveis: Luis Gustavo
- prioridade: 3
- prazo: 2026-11-25T12:00:00.000Z
- criado: 2026-10-21T05:01:42.774Z · atualizado: 2026-10-27T13:05:39.302Z
- tags: app, portal-parceiro

### Descrição

**O que fazer:** Tela "Depois da consulta" lendo /tutor/clinica/atendimentos.
**Superfície:** app (`petjourney-app`)
**Depende da API:** card "E4-01 · Atendimento e prontuário eletrônico estruturado" de outubro, prazo 03/11 (replanejado em 27/10). Começa quando aquele card estiver Concluído e o handoff anexado aqui.
**Spec:** ver o documento da spec E4-01 no card de outubro (rotas, contrato e regras).
**Prazo:** sugerido para a semana da onda 3; ajustar com o Nicolas.

### Documentos

- [principal] Handoff E4-01: portal-parceiro-e4.md · portal-parceiro-e4.md · id cmvrod9i0ymvexs8p4p · atualizado 2026-10-30T16:07:26.853Z

### Documentos herdados

- Épico E4: Prontuário, receita, vacinas e adesão · portal-parceiro-e4-prontuario.md · id cmvhnacl3001iood29qol38zq

### Subtarefas

(nenhuma)

## PJ-E3OKDS · E4-03 (app) · Receita no resumo e salvar nos documentos

- id: cmvhnagje001oood2jae3okds
- status: TODO
- pai: PJ-6I8QD7 (cmvhnac2d001hood25b6i8qd7)
- responsáveis: Luis Gustavo
- prioridade: 3
- prazo: 2026-11-25T12:00:00.000Z
- criado: 2026-10-21T05:01:46.548Z · atualizado: 2026-10-27T13:05:36.462Z
- tags: app, portal-parceiro

### Descrição

**O que fazer:** PDF pela URL assinada e o toque de salvar (idempotente).
**Superfície:** app (`petjourney-app`)
**Depende da API:** card "E4-03 · Receituário digital (receita congelada, controle por regime, PDF, assinatura e verificação)" de outubro, prazo 04/11 (replanejado em 27/10). Começa quando aquele card estiver Concluído e o handoff anexado aqui.
**Spec:** ver o documento da spec E4-03 no card de outubro (rotas, contrato e regras).
**Prazo:** sugerido para a semana da onda 3; ajustar com o Nicolas.

### Documentos

- [principal] Handoff E4-03: portal-parceiro-e4.md · portal-parceiro-e4.md · id cmvtz5b2zykfszkxmlv · atualizado 2026-10-30T16:07:31.301Z

### Documentos herdados

- Épico E4: Prontuário, receita, vacinas e adesão · portal-parceiro-e4-prontuario.md · id cmvhnacl3001iood29qol38zq

### Subtarefas

(nenhuma)

## PJ-FCP48H · E4-06 (site) · Página de verificação dos documentos clínicos pelo QR

- id: cmvhnamd7001wood2oqfcp48h
- status: TODO
- pai: PJ-6I8QD7 (cmvhnac2d001hood25b6i8qd7)
- responsáveis: Luis Gustavo
- prioridade: 3
- prazo: 2026-11-25T12:00:00.000Z
- criado: 2026-10-21T05:01:54.101Z · atualizado: 2026-10-27T13:05:37.658Z
- tags: web, portal-parceiro

### Descrição

**O que fazer:** Mesmo padrão da verificação da receita, por GET /public/documentos/:codigo: só tipo, data e emitente, sem conteúdo clínico. Reaproveitar a página da E4-03.
**Superfície:** site (`petjourney-web`)
**Depende da API:** card "E4-06 · Documentos clínicos (atestados, termos, pedidos de exame, laudos e cópia do prontuário)" de outubro, prazo 06/11 (replanejado em 27/10). Começa quando aquele card estiver Concluído e o handoff anexado aqui.
**Spec:** ver o documento da spec E4-06 no card de outubro (rotas, contrato e regras).
**Prazo:** sugerido para a semana da onda 3; ajustar com o Nicolas.

### Documentos

- [principal] Handoff E4-06: portal-parceiro-e4.md · portal-parceiro-e4.md · id cmvtwa1avu7h1m76e66c · atualizado 2026-10-30T16:52:41.452Z

### Documentos herdados

- Épico E4: Prontuário, receita, vacinas e adesão · portal-parceiro-e4-prontuario.md · id cmvhnacl3001iood29qol38zq

### Subtarefas

(nenhuma)

## PJ-L3V7JK · E4-03 (portal) · Receita: assinar com senha, PDF e verificação

- id: cmvhnaft7001nood2iml3v7jk
- status: TODO
- pai: PJ-6I8QD7 (cmvhnac2d001hood25b6i8qd7)
- responsáveis: Luis Gustavo
- prioridade: 3
- prazo: 2026-11-25T12:00:00.000Z
- criado: 2026-10-21T05:01:45.604Z · atualizado: 2026-10-27T13:05:36.309Z
- tags: admin, portal-parceiro

### Descrição

**O que fazer:** Assinar com reautenticação, baixar o PDF, cancelar e repetir; tirar "assinada" da demonstração antiga.
**Superfície:** portal (`petjourney-admin`)
**Depende da API:** card "E4-03 · Receituário digital (receita congelada, controle por regime, PDF, assinatura e verificação)" de outubro, prazo 04/11 (replanejado em 27/10). Começa quando aquele card estiver Concluído e o handoff anexado aqui.
**Spec:** ver o documento da spec E4-03 no card de outubro (rotas, contrato e regras).
**Prazo:** sugerido para a semana da onda 3; ajustar com o Nicolas.

### Documentos

- [principal] Handoff E4-03: portal-parceiro-e4.md · portal-parceiro-e4.md · id cmvtz5bferat07n2p5u · atualizado 2026-10-30T16:07:31.740Z

### Documentos herdados

- Épico E4: Prontuário, receita, vacinas e adesão · portal-parceiro-e4-prontuario.md · id cmvhnacl3001iood29qol38zq

### Subtarefas

(nenhuma)

### Comentários

#### Nicolas Castela · 2026-10-29T20:07:20.199Z

**Guia atualizado (29/10, G4):** seção 6.2 do guia anexado (portal-parceiro-e4.md): a receita por quantidade (comprimido, mL) agora confere a faixa da dose.

- Acima da faixa: 422 CONFIRMACAO_PENDENTE com porQuantidade. Mostre o mg/kg ao lado da faixa e confirme com foraDaFaixaConfirmada.

- Acima de 3x o teto: 422 DOSE_MUITO_ACIMA_DA_FAIXA, sem confirmação. É o "5" digitado no lugar de "0,5". Mostre a conta (por exemplo "5 comprimidos = 10 mg = 3,33 mg/kg, o limite é 0,3 mg/kg") e peça para conferir a quantidade e a unidade.

- Sem peso nenhum: o mesmo 422 pede a confirmação, com PESO_AUSENTE. Sugira pesar o animal.

- Trocar a quantidade no PATCH pede confirmar de novo.

#### Nicolas Castela · 2026-10-29T20:47:00.400Z

**Correção do comentário anterior (29/10):** uma regra do comentário "Guia atualizado (29/10, G4)" mudou. O guia novo será anexado aqui quando a API subir.

- Sem peso nenhum, a receita por quantidade agora é recusada com 422 PESO_AUSENTE, sem confirmação. Mostre a mensagem e o campo de peso da linha para o veterinário informar. Não ofereça "confirmar sem peso".

- Peso fora do normal para a espécie: 422 pedindo a confirmação PESO_IMPLAUSIVEL. Mostre o peso digitado e peça para conferir antes de confirmar.

- O resto do comentário anterior (acima da faixa, acima de 3x, trocar a quantidade) continua valendo.

#### Nicolas Castela · 2026-10-30T13:36:55.807Z

**Liberado (30/10), E4-03 no portal:** @Luís, a API da receita está completa no develop. Guias reanexados. Faça depois do E1-08 (portal), porque assinar exige o selo. O que mudou:

- Assinar dá 403 CRMV_NAO_CONFERIDO com reason SEM_SELO, VENCIDO ou SEM_IDENTIDADE (portal-parceiro-e1.md, seção 9.1).

- Sem peso nenhum, a linha de medicamento do catálogo com faixa por kg dá 422 PESO_AUSENTE, sem confirmação: peça o pesoKg na linha (portal-parceiro-e4.md, seção 6.2).

- Peso acima do esperado para a espécie dá 422 CONFIRMACAO_PENDENTE com avisos PESO_IMPLAUSIVEL: dois botões, corrigir o peso ou confirmar com pesoImplausivelConfirmado (seção 6.2).

#### Nicolas Castela · 2026-10-30T16:07:33.169Z

**Mudou (30/10), controlados e PDF:** @Luís, o parecer jurídico mudou a receita. Guia reanexado, seções 6.3 e 6.8 do portal-parceiro-e4.md.

- Nenhum controlado sai como receita eletrônica. foraDoPdf[] agora traz motivo e instrucao (o texto pronto no idioma): mostre a instrucao no item. Motivos novos: EMITIR_NO_SIPEAGRO, MAGISTRAL_CONTROLADA_MAPA e RECEITA_DE_RETENCAO_EM_PAPEL.

- Item fora do PDF não precisa de receita: não ofereça "pôr na receita" para ele. Rascunho só com esses itens dá RECEITA_SEM_ITEM_EMITIVEL ao assinar: descarte e finalize.

- Nome livre que cita uma das 21 substâncias controladas do MAPA dá 422 NOME_LIVRE_CONTROLADO com reason SUBSTANCIA_CONTROLADA: o veterinário escolhe do catálogo.

- A receita simples pode mostrar "Assinatura eletrônica avançada (Lei 14.063/2020, art. 14)". A de controle especial, nunca.

## PJ-LU09N7 · E4-05 (portal) · Tratamentos em casa e alerta de adesão

- id: cmvhnak6n001tood2o1lu09n7
- status: TODO
- pai: PJ-6I8QD7 (cmvhnac2d001hood25b6i8qd7)
- responsáveis: Luis Gustavo
- prioridade: 3
- prazo: 2026-11-25T12:00:00.000Z
- criado: 2026-10-21T05:01:51.273Z · atualizado: 2026-10-27T13:05:37.053Z
- tags: admin, portal-parceiro

### Descrição

**O que fazer:** Faixa de doses, lista "pedem atenção", crítico e registrar contato pela API.
**Superfície:** portal (`petjourney-admin`)
**Depende da API:** card "E4-05 · Tratamentos em casa e adesão (receita que vira lembrete, dose dada ou pulada, alerta para a clínica)" de outubro, prazo 05/11 (replanejado em 27/10). Começa quando aquele card estiver Concluído e o handoff anexado aqui.
**Spec:** ver o documento da spec E4-05 no card de outubro (rotas, contrato e regras).
**Prazo:** sugerido para a semana da onda 3; ajustar com o Nicolas.

### Documentos

- [principal] Spec E4-05: tratamentos em casa e adesão · 05-tratamentos-e-adesao.md · id cmvkfnlkl000raod2q2rgujbi · atualizado 2026-10-23T03:51:21.333Z
- Handoff E4-05: portal-parceiro-e4.md · portal-parceiro-e4.md · id cmvv0ixsfra7q7zhgawm · atualizado 2026-10-30T13:33:19.435Z

### Documentos herdados

- Épico E4: Prontuário, receita, vacinas e adesão · portal-parceiro-e4-prontuario.md · id cmvhnacl3001iood29qol38zq

### Subtarefas

(nenhuma)

## PJ-PLOD6B · E4-03 (site) · Página de verificação da receita pelo QR

- id: cmvhnah9l001pood23cplod6b
- status: TODO
- pai: PJ-6I8QD7 (cmvhnac2d001hood25b6i8qd7)
- responsáveis: Luis Gustavo
- prioridade: 3
- prazo: 2026-11-25T12:00:00.000Z
- criado: 2026-10-21T05:01:47.490Z · atualizado: 2026-10-27T13:05:36.607Z
- tags: web, portal-parceiro

### Descrição

**O que fazer:** A farmácia lê o QR do PDF e vê válida ou cancelada, validade, estabelecimento, prescritor com CRMV e os medicamentos, por GET /public/receitas/:codigo. Sem CPF, endereço nem diagnóstico. O QR usa a raiz petjourney.health, nunca o subdomínio app.
**Superfície:** site (`petjourney-web`)
**Depende da API:** card "E4-03 · Receituário digital (receita congelada, controle por regime, PDF, assinatura e verificação)" de outubro, prazo 04/11 (replanejado em 27/10). Começa quando aquele card estiver Concluído e o handoff anexado aqui.
**Spec:** ver o documento da spec E4-03 no card de outubro (rotas, contrato e regras).
**Prazo:** sugerido para a semana da onda 3; ajustar com o Nicolas.

### Documentos

- [principal] Handoff E4-03: portal-parceiro-e4.md · portal-parceiro-e4.md · id cmvtz5bnlwtk9p4soa4 · atualizado 2026-10-30T16:07:32.033Z

### Documentos herdados

- Épico E4: Prontuário, receita, vacinas e adesão · portal-parceiro-e4-prontuario.md · id cmvhnacl3001iood29qol38zq

### Subtarefas

(nenhuma)

## PJ-QQT1WN · E4-01 (portal) · Prontuário pela API

- id: cmvhnacwc001jood27pqqt1wn
- status: TODO
- pai: PJ-6I8QD7 (cmvhnac2d001hood25b6i8qd7)
- responsáveis: Luis Gustavo
- prioridade: 3
- prazo: 2026-11-25T12:00:00.000Z
- criado: 2026-10-21T05:01:41.830Z · atualizado: 2026-10-27T13:05:39.144Z
- tags: admin, portal-parceiro

### Descrição

**O que fazer:** Autosave por seção, edição exclusiva, finalizar, adendo, anular, liberar resumo, retorno e linha do tempo.
**Superfície:** portal (`petjourney-admin`)
**Depende da API:** card "E4-01 · Atendimento e prontuário eletrônico estruturado" de outubro, prazo 03/11 (replanejado em 27/10). Começa quando aquele card estiver Concluído e o handoff anexado aqui.
**Spec:** ver o documento da spec E4-01 no card de outubro (rotas, contrato e regras).
**Prazo:** sugerido para a semana da onda 3; ajustar com o Nicolas.

### Documentos

- [principal] Handoff E4-01: portal-parceiro-e4.md · portal-parceiro-e4.md · id cmvrod9q428cjq610eob · atualizado 2026-10-30T16:07:27.267Z

### Documentos herdados

- Épico E4: Prontuário, receita, vacinas e adesão · portal-parceiro-e4-prontuario.md · id cmvhnacl3001iood29qol38zq

### Subtarefas

(nenhuma)

### Comentários

#### Nicolas Castela · 2026-10-30T13:36:54.636Z

**Mudou (30/10), E4-01 no portal:** @Luís, duas mudanças no prontuário. Guias reanexados.

- Finalizar o prontuário e liberar o resumo agora exigem o selo (E1-08): 403 CRMV_NAO_CONFERIDO com reason SEM_SELO, VENCIDO ou SEM_IDENTIDADE. Use aguardandoConferencia do /parceiro/portal/eu para avisar no botão (portal-parceiro-e1.md, seção 9.1).

- Descartar um rascunho que teve gravação de voz dá 409 ATENDIMENTO_COM_CONTEUDO: abra o diálogo de anular com motivo (portal-parceiro-e4.md, seção 15.1).

#### Nicolas Castela · 2026-10-30T16:07:32.611Z

**Mudou (30/10), senha no prontuário:** @Luís, finalizar e anular o prontuário passam a pedir a senha. Guia reanexado, seções 5.5 e 6.8 do portal-parceiro-e4.md.

- Sem senha e sem janela aberta: 401 ASSINATURA_SENHA_EXIGIDA. Abra o diálogo de senha e reenvie com senha. Não trate como sessão expirada: olhe o codigo.

- A senha certa abre uma janela de 15 minutos naquele login e aparelho, em que finalizar e anular passam sem pedir de novo.

- Senha errada: 401 ASSINATURA_SENHA_INCORRETA. Muitas tentativas: 429 ASSINATURA_SENHA_BLOQUEADA. Conta sem senha própria: 403 ASSINATURA_SENHA_NECESSARIA.

## PJ-R4HBGA · E4-02 (cms) · Curadoria do catálogo clínico global

- id: cmvhnaf2y001mood2w0r4hbga
- status: TODO
- pai: PJ-6I8QD7 (cmvhnac2d001hood25b6i8qd7)
- responsáveis: Luis Gustavo
- prioridade: 4
- prazo: 2026-11-18T12:00:00.000Z
- criado: 2026-10-21T05:01:44.660Z · atualizado: 2026-10-21T05:01:44.660Z
- tags: cms, portal-parceiro

### Descrição

**O que fazer:** Telas de bulário, faixas e vacinas com revisadoPor (CRMV).
**Superfície:** cms (`petjourney-cms`)
**Depende da API:** card "E4-02 · Catálogos clínicos (faixas de referência, diagnósticos, exames, bulário, vacinas)" de outubro, prazo 23/10. Começa quando aquele card estiver Concluído e o handoff anexado aqui.
**Spec:** ver o documento da spec E4-02 no card de outubro (rotas, contrato e regras).
**Prazo:** sugerido para a semana da onda 2; ajustar com o Nicolas.

### Documentos

- [principal] Handoff E4-02: portal-parceiro-e4.md · portal-parceiro-e4.md · id cmvimpxgoiv3l0n5yj4 · atualizado 2026-10-30T16:07:29.104Z

### Documentos herdados

- Épico E4: Prontuário, receita, vacinas e adesão · portal-parceiro-e4-prontuario.md · id cmvhnacl3001iood29qol38zq

### Subtarefas

(nenhuma)

### Comentários

#### Nicolas Castela · 2026-10-30T16:07:34.283Z

**Mudou (30/10), curadoria:** @Luís, na curadoria o medicamento ganha manipulado: boolean, e o regime de controle ganha ANVISA_RETENCAO, para o antimicrobiano de uso humano. Guia reanexado, seção 6.8 do portal-parceiro-e4.md.

## PJ-VQVQ0C · E4-04 (portal) · Vacinas pela API

- id: cmvhnahzr001qood2zcvqvq0c
- status: TODO
- pai: PJ-6I8QD7 (cmvhnac2d001hood25b6i8qd7)
- responsáveis: Luis Gustavo
- prioridade: 4
- prazo: 2026-11-18T12:00:00.000Z
- criado: 2026-10-21T05:01:48.433Z · atualizado: 2026-10-21T05:01:48.433Z
- tags: admin, portal-parceiro

### Descrição

**O que fazer:** Aplicar com lote, dose de outro lugar, plano, lista de chamada e anular.
**Superfície:** portal (`petjourney-admin`)
**Depende da API:** card "E4-04 · Vacinação conectada (aplicação com lote, protocolo, lista de chamada e carteirinha do app)" de outubro, prazo 23/10. Começa quando aquele card estiver Concluído e o handoff anexado aqui.
**Spec:** ver o documento da spec E4-04 no card de outubro (rotas, contrato e regras).
**Prazo:** sugerido para a semana da onda 2; ajustar com o Nicolas.

### Documentos

- [principal] Handoff E4-04: portal-parceiro-e4.md · portal-parceiro-e4.md · id cmvjftr1fodf1gwemo3i · atualizado 2026-10-30T13:33:16.779Z

### Documentos herdados

- Épico E4: Prontuário, receita, vacinas e adesão · portal-parceiro-e4-prontuario.md · id cmvhnacl3001iood29qol38zq

### Subtarefas

(nenhuma)

## PJ-XV0VW7 · E4-04 (app) · Carteirinha conectada

- id: cmvhnaipy001rood2lexv0vw7
- status: TODO
- pai: PJ-6I8QD7 (cmvhnac2d001hood25b6i8qd7)
- responsáveis: Luis Gustavo
- prioridade: 4
- prazo: 2026-11-18T12:00:00.000Z
- criado: 2026-10-21T05:01:49.376Z · atualizado: 2026-10-21T05:01:49.376Z
- tags: app, portal-parceiro

### Descrição

**O que fazer:** Selo da clínica, lote, dose da série e o plano vacinal da clínica.
**Superfície:** app (`petjourney-app`)
**Depende da API:** card "E4-04 · Vacinação conectada (aplicação com lote, protocolo, lista de chamada e carteirinha do app)" de outubro, prazo 23/10. Começa quando aquele card estiver Concluído e o handoff anexado aqui.
**Spec:** ver o documento da spec E4-04 no card de outubro (rotas, contrato e regras).
**Prazo:** sugerido para a semana da onda 2; ajustar com o Nicolas.

### Documentos

- [principal] Handoff E4-04: portal-parceiro-e4.md · portal-parceiro-e4.md · id cmvjftqtc5azpvsssztx · atualizado 2026-10-30T13:33:16.333Z

### Documentos herdados

- Épico E4: Prontuário, receita, vacinas e adesão · portal-parceiro-e4-prontuario.md · id cmvhnacl3001iood29qol38zq

### Subtarefas

(nenhuma)

### Comentários

#### Nicolas Castela · 2026-10-30T13:36:56.392Z

**Mudou (30/10), E4-04 no app:** @Luís, na carteirinha o CRMV do profissional só aparece quando ele tinha o selo no dia da aplicação; caso contrário vem crmv: null e o nome continua. A tela já trata o null; confira só que não sobra rótulo vazio.

---

# E5

## PJ-2HGJUX · E5-02 (portal) · Prescrição, checklist e passagem de plantão pela API

- id: cmvhnapdy0021ood2932hgjux
- status: TODO
- pai: PJ-NJXGAU (cmvhnantk001yood2y3njxgau)
- responsáveis: Luis Gustavo
- prioridade: 2
- prazo: 2026-11-27T12:00:00.000Z
- criado: 2026-10-21T05:01:58.016Z · atualizado: 2026-10-27T13:05:39.606Z
- tags: admin, portal-parceiro

### Descrição

**O que fazer:** Prescrever, registrar, evolução e entregar o turno.
**Superfície:** portal (`petjourney-admin`)
**Depende da API:** card "E5-02 · Prescrição de internação, checklist de enfermagem, evolução e passagem de plantão" de outubro, prazo 10/11 (replanejado em 27/10). Começa quando aquele card estiver Concluído e o handoff anexado aqui.
**Spec:** ver o documento da spec E5-02 no card de outubro (rotas, contrato e regras).
**Prazo:** sugerido para a semana da onda 4; ajustar com o Nicolas.

### Documentos

- [principal] Handoff E5-02: portal-parceiro-e5.md · portal-parceiro-e5.md · id cmvt6lpv024wi5v68if9 · atualizado 2026-10-30T13:33:27.722Z

### Documentos herdados

- Épico E5: Internação · portal-parceiro-e5-internacao.md · id cmvhnaocd001zood2hfknkmbf

### Subtarefas

(nenhuma)

### Comentários

#### Nicolas Castela · 2026-10-29T20:07:19.625Z

**Guia atualizado (29/10, G4):** seção 20 nova do guia anexado (portal-parceiro-e5.md), na enfermagem e no mapa:

- Registrar uma dose como dada pode dar 409 ALERGIA_NOVA_NA_PRESCRICAO ou ESPECIE_PROIBIDA_NA_PRESCRICAO, quando a alergia ou a espécie chegou depois da prescrição. Abra um diálogo mandando chamar o veterinário. Pulei e Recusou seguem livres.

- Antes do toque: as prescrições trazem alergiaNova e especieProibidaNova. Com qualquer um true, mostre o aviso na linha e deixe o botão Dei desligado. No mapa, o motivo de urgência ALERGIA_NOVA vem primeiro.

- Internação sem registro há 72 h: o campo novo abertaSemRegistro aparece no detalhe e no mapa. Mostre que as doses pararam de ser criadas (seção 20.2).

- Dose da internação encerrada: situação nova nao-registrada, em cinza. Na passagem de plantão, use o campo novo situacaoAgora para o rótulo e para contar o pendente (seção 20.4).

- O app não muda nada.

#### Nicolas Castela · 2026-10-30T13:36:58.742Z

**Mudou (30/10), E5-02 no portal:** @Luís, mudanças na prescrição da internação. Guia reanexado, seções 20.8 e 22 do portal-parceiro-e5.md.

- Prescrever exige o selo (E1-08): 403 CRMV_NAO_CONFERIDO com reason.

- Peso de entrada acima do esperado para a espécie: 422 CONFIRMACAO_PENDENTE com PESO_IMPLAUSIVEL; confirmar com pesoImplausivelConfirmado.

- Prescrição antiga pode vir com alergiaNova: true no checklist e no plantão: mostre o mesmo aviso de chamar o veterinário.

- A lista do prescrever ganha medicacaoDaEstadia (o que o animal tomava no hotel), só leitura.

## PJ-7G0NQI · E5-01 (portal) · Leitos e mapa de internação pela API

- id: cmvhnaonn0020ood2g27g0nqi
- status: TODO
- pai: PJ-NJXGAU (cmvhnantk001yood2y3njxgau)
- responsáveis: Luis Gustavo
- prioridade: 2
- prazo: 2026-11-27T12:00:00.000Z
- criado: 2026-10-21T05:01:57.069Z · atualizado: 2026-10-27T13:05:39.455Z
- tags: admin, portal-parceiro

### Descrição

**O que fazer:** Cadastro de leitos, internar, mapa por urgência e encerrar nos três desfechos.
**Superfície:** portal (`petjourney-admin`)
**Depende da API:** card "E5-01 · Leitos e internação (mapa, internar, gravidade, alta, óbito e transferência)" de outubro, prazo 08/11 (replanejado em 27/10). Começa quando aquele card estiver Concluído e o handoff anexado aqui.
**Spec:** ver o documento da spec E5-01 no card de outubro (rotas, contrato e regras).
**Prazo:** sugerido para a semana da onda 4; ajustar com o Nicolas.

### Documentos

- [principal] Handoff E5-01: portal-parceiro-e5.md · portal-parceiro-e5.md · id cmvu1cg6ltrktacemiip · atualizado 2026-10-30T13:33:25.818Z

### Documentos herdados

- Épico E5: Internação · portal-parceiro-e5-internacao.md · id cmvhnaocd001zood2hfknkmbf

### Subtarefas

(nenhuma)

### Comentários

#### Nicolas Castela · 2026-10-29T18:48:31.353Z

**Guia atualizado (29/10, G4):** a API da E5 fechou inteira no develop (629493c). O guia anexado (portal-parceiro-e5.md) tem a seção 19.4 nova, na tela do cliente:

- Exclusão a pedido do titular com o módulo Clínica só para consulta e um animal internado: a API encerra a internação sozinha e conclui (antes dava 409).

- A resposta traz internacoesEncerradas e hospedagensEncerradas. Se vierem preenchidos, o comprovante diz: "A internação em curso foi encerrada administrativamente para atender ao pedido."

#### Nicolas Castela · 2026-10-29T21:08:50.421Z

**Guia atualizado (29/10, G4 re-auditoria):** a seção 19.4 do guia anexado mudou (73163f4 no develop). O que muda na tela do cliente:

- Hotel: hospedagensEncerradas traz os ids das reservas em que a estadia do animal do titular foi encerrada. Numa reserva com um animal de outro cliente, só a estadia do titular fecha, e o outro animal continua na casa.

- Comprovante com hotel: "A estadia em curso no hotel foi encerrada para atender ao pedido." A estadia fechada assim aparece sem "entregue por".

- Ligação na internação: hora no futuro ou antes da entrada continua dando 400 LIGACAO_INVALIDA, com o mesmo código (agora o banco também recusa).

#### Nicolas Castela · 2026-10-30T13:36:58.148Z

**Mudou (30/10), E5-01 no portal:** @Luís, três mudanças na internação. Guia reanexado, seções 21 e 22 do portal-parceiro-e5.md.

- Encerrar com óbito um animal que também está no hotel da mesma casa não dá mais 409: a estadia é encerrada pelo sistema, e a resposta traz encerramento.obito.hospedagensEncerradas.

- O detalhe ganha medicacaoDaEstadia: mostre o bloco só leitura "O que ele tomava no hotel" perto das prescrições.

- Junto do aviso abertaSemRegistro (72 h sem registro), diga também "o boletim automático está parado".

## PJ-IZ4UNN · E5-03 (app) · Internação no app: boletins e preferências

- id: cmvhnaquc0023ood2wgiz4unn
- status: TODO
- pai: PJ-NJXGAU (cmvhnantk001yood2y3njxgau)
- responsáveis: Luis Gustavo
- prioridade: 2
- prazo: 2026-11-27T12:00:00.000Z
- criado: 2026-10-21T05:01:59.902Z · atualizado: 2026-10-27T13:05:39.905Z
- tags: app, portal-parceiro

### Descrição

**O que fazer:** Conversa de boletins sem retidos, aposLigacao, preferências e o fim da internação.
**Superfície:** app (`petjourney-app`)
**Depende da API:** card "E5-03 · Boletim da internação ao responsável" de outubro, prazo 12/11 (replanejado em 27/10). Começa quando aquele card estiver Concluído e o handoff anexado aqui.
**Spec:** ver o documento da spec E5-03 no card de outubro (rotas, contrato e regras).
**Prazo:** sugerido para a semana da onda 4; ajustar com o Nicolas.

### Documentos

- [principal] Handoff E5-03: portal-parceiro-e5.md · portal-parceiro-e5.md · id cmvtwa79yahldlyzo9b · atualizado 2026-10-30T13:33:29.553Z

### Documentos herdados

- Épico E5: Internação · portal-parceiro-e5-internacao.md · id cmvhnaocd001zood2hfknkmbf

### Subtarefas

(nenhuma)

### Comentários

#### Nicolas Castela · 2026-10-29T18:48:30.923Z

**Guia atualizado (29/10, G4):** a API da E5 fechou inteira no develop (629493c). O guia anexado (portal-parceiro-e5.md) tem a seção 19.5 nova:

- Notificação de boletim ou alta suprimida (óbito, transferência, encerramento): chega já lida, com encerrada=1 na url e dados.encerrada = true.

- O toque nela abre "Internação encerrada", nunca o boletim nem a internação viva. Se a rota da internação der 403, mostre só a frase, sem erro genérico.

## PJ-NJXGAU · Portal do parceiro · E5: Internação (fronts)

- id: cmvhnantk001yood2y3njxgau
- status: TODO
- pai: -
- responsáveis: Luis Gustavo
- prioridade: 2
- prazo: 2026-11-27T12:00:00.000Z
- criado: 2026-10-21T05:01:55.986Z · atualizado: 2026-10-22T22:29:51.657Z
- tags: admin, app, portal-parceiro

### Descrição

As telas do épico E5: Internação, ligadas à API que fica pronta em outubro. Cada subtarefa diz a superfície, o card da API de que depende e o que fazer. O handoff (`docs/implementacao-por-superficie/front-portal-parceiro-e5.md`) é anexado aqui quando a API terminar.
**Superfícies:** portal (petjourney-admin), app (petjourney-app).

### Documentos

- [principal] Épico E5: Internação · portal-parceiro-e5-internacao.md · id cmvhnaocd001zood2hfknkmbf · atualizado 2026-10-21T05:01:56.797Z

### Documentos herdados

(nenhum)

### Subtarefas

- PJ-7G0NQI · id cmvhnaonn0020ood2g27g0nqi · TODO · docs=1 · E5-01 (portal) · Leitos e mapa de internação pela API
- PJ-IZ4UNN · id cmvhnaquc0023ood2wgiz4unn · TODO · docs=1 · E5-03 (app) · Internação no app: boletins e preferências
- PJ-XW4PBB · id cmvhnaq450022ood2g4xw4pbb · TODO · docs=1 · E5-03 (portal) · Boletim: compor, registrar ligação e enviar
- PJ-2HGJUX · id cmvhnapdy0021ood2932hgjux · TODO · docs=1 · E5-02 (portal) · Prescrição, checklist e passagem de plantão pela API

## PJ-XW4PBB · E5-03 (portal) · Boletim: compor, registrar ligação e enviar

- id: cmvhnaq450022ood2g4xw4pbb
- status: TODO
- pai: PJ-NJXGAU (cmvhnantk001yood2y3njxgau)
- responsáveis: Luis Gustavo
- prioridade: 2
- prazo: 2026-11-27T12:00:00.000Z
- criado: 2026-10-21T05:01:58.959Z · atualizado: 2026-10-27T13:05:39.753Z
- tags: admin, portal-parceiro

### Descrição

**O que fazer:** Retido até a ligação, preferências e boletim automático.
**Superfície:** portal (`petjourney-admin`)
**Depende da API:** card "E5-03 · Boletim da internação ao responsável" de outubro, prazo 12/11 (replanejado em 27/10). Começa quando aquele card estiver Concluído e o handoff anexado aqui.
**Spec:** ver o documento da spec E5-03 no card de outubro (rotas, contrato e regras).
**Prazo:** sugerido para a semana da onda 4; ajustar com o Nicolas.

### Documentos

- [principal] Handoff E5-03: portal-parceiro-e5.md · portal-parceiro-e5.md · id cmvtwa7ikzb3y903ezwi · atualizado 2026-10-30T13:33:29.827Z

### Documentos herdados

- Épico E5: Internação · portal-parceiro-e5-internacao.md · id cmvhnaocd001zood2hfknkmbf

### Subtarefas

(nenhuma)

### Comentários

#### Nicolas Castela · 2026-10-29T18:48:30.490Z

**Guia atualizado (29/10, G4):** a API da E5 fechou inteira no develop (629493c, CI verde). O guia anexado (portal-parceiro-e5.md) tem a seção 19 nova, com duas telas a mais neste card:

- Fila de boletins pendentes da recepção: GET /parceiro/portal/clinica/internacao/boletins-pendentes. O contador de boletins retidos passa a abrir esta tela (antes abria o mapa, e a recepção levava 403). Cada item diz se falta ligar ou enviar, e para quem ligar (seção 19.1).

- Registrar ligação na internação: POST /parceiro/portal/clinica/internacoes/:id/ligacao, para o paciente sem app, que não ganha boletim (seção 19.2).

- Paciente sem app: a ligação registrada fecha a pendência e tira a urgência do mapa (seção 19.3).

#### Nicolas Castela · 2026-10-30T13:36:59.326Z

**Mudou (30/10), E5-03 no portal:** @Luís, regras novas do boletim da internação. Guia reanexado, seção 21 do portal-parceiro-e5.md.

- Rascunho parado há mais que a frequência do boletim deixa de calar o automático, conta em boletinsRetidos e aparece na fila com pendencia ENVIAR. Na conversa: "Rascunho parado: envie ou descarte".

- Responsável que desativou o perfil no app conta como sem canal (semCanalNoApp: true): mostre "Sem app: avise por telefone".

---

# E6

## PJ-RFFOKT · E6-01 (portal) · Estoque de vacinas pela API

- id: cmvhnasej0026ood2l7rffokt
- status: TODO
- pai: PJ-RTTTK8 (cmvhnarkk0024ood2hcrtttk8)
- responsáveis: Luis Gustavo
- prioridade: 2
- prazo: 2026-11-27T12:00:00.000Z
- criado: 2026-10-21T05:02:01.926Z · atualizado: 2026-10-27T13:05:40.051Z
- tags: admin, portal-parceiro

### Descrição

**O que fazer:** Geladeira, receber lote, baixa, mínimo, movimentos e análise.
**Superfície:** portal (`petjourney-admin`)
**Depende da API:** card "E6-01 · Lotes de vacina e movimentos de estoque" de outubro, prazo 08/11 (replanejado em 27/10). Começa quando aquele card estiver Concluído e o handoff anexado aqui.
**Spec:** ver o documento da spec E6-01 no card de outubro (rotas, contrato e regras).
**Prazo:** sugerido para a semana da onda 4; ajustar com o Nicolas.

### Documentos

(nenhum)

### Documentos herdados

- Épico E6: Estoque · portal-parceiro-e6-estoque.md · id cmvhnas3a0025ood2o6bqd8a1

### Subtarefas

(nenhuma)

## PJ-RTTTK8 · Portal do parceiro · E6: Estoque (fronts)

- id: cmvhnarkk0024ood2hcrtttk8
- status: TODO
- pai: -
- responsáveis: Luis Gustavo
- prioridade: 2
- prazo: 2026-11-27T12:00:00.000Z
- criado: 2026-10-21T05:02:00.846Z · atualizado: 2026-10-22T22:29:51.660Z
- tags: admin, portal-parceiro

### Descrição

As telas do épico E6: Estoque, ligadas à API que fica pronta em outubro. Cada subtarefa diz a superfície, o card da API de que depende e o que fazer. O handoff (`docs/implementacao-por-superficie/front-portal-parceiro-e6.md`) é anexado aqui quando a API terminar.
**Superfícies:** portal (petjourney-admin).

### Documentos

- [principal] Épico E6: Estoque · portal-parceiro-e6-estoque.md · id cmvhnas3a0025ood2o6bqd8a1 · atualizado 2026-10-21T05:02:01.654Z

### Documentos herdados

(nenhum)

### Subtarefas

- PJ-ZXGZ7P · id cmvhnat4z0027ood2r2zxgz7p · TODO · docs=1 · E6-02 (portal) · Metas do mês e pedido de compra pela API
- PJ-RFFOKT · id cmvhnasej0026ood2l7rffokt · TODO · docs=0 · E6-01 (portal) · Estoque de vacinas pela API

## PJ-ZXGZ7P · E6-02 (portal) · Metas do mês e pedido de compra pela API

- id: cmvhnat4z0027ood2r2zxgz7p
- status: TODO
- pai: PJ-RTTTK8 (cmvhnarkk0024ood2hcrtttk8)
- responsáveis: Luis Gustavo
- prioridade: 2
- prazo: 2026-11-27T12:00:00.000Z
- criado: 2026-10-21T05:02:02.877Z · atualizado: 2026-10-27T13:05:40.195Z
- tags: admin, portal-parceiro

### Descrição

**O que fazer:** Plano, sugestão e pedido.
**Superfície:** portal (`petjourney-admin`)
**Depende da API:** card "E6-02 · Metas do mês e pedido de compra" de outubro, prazo 09/11 (replanejado em 27/10). Começa quando aquele card estiver Concluído e o handoff anexado aqui.
**Spec:** ver o documento da spec E6-02 no card de outubro (rotas, contrato e regras).
**Prazo:** sugerido para a semana da onda 4; ajustar com o Nicolas.

### Documentos

- [principal] Handoff E6-02: portal-parceiro-e6.md · portal-parceiro-e6.md · id cmvtpgb541fz3rcazodz · atualizado 2026-10-29T15:35:33.908Z

### Documentos herdados

- Épico E6: Estoque · portal-parceiro-e6-estoque.md · id cmvhnas3a0025ood2o6bqd8a1

### Subtarefas

(nenhuma)

---

# E7

## PJ-09UJ1A · Portal do parceiro · E7: Hotel (fronts)

- id: cmvhnatv60028ood2ve09uj1a
- status: TODO
- pai: -
- responsáveis: Luis Gustavo
- prioridade: 2
- prazo: 2026-11-30T12:00:00.000Z
- criado: 2026-10-21T05:02:03.820Z · atualizado: 2026-10-22T22:29:51.664Z
- tags: admin, app, portal-parceiro

### Descrição

As telas do épico E7: Hotel, ligadas à API que fica pronta em outubro. Cada subtarefa diz a superfície, o card da API de que depende e o que fazer. O handoff (`docs/implementacao-por-superficie/front-portal-parceiro-e7.md`) é anexado aqui quando a API terminar.
**Superfícies:** portal (petjourney-admin), app (petjourney-app).

### Documentos

- [principal] Épico E7: Hotel · portal-parceiro-e7-hotel.md · id cmvhnaudw0029ood2bbhm4auf · atualizado 2026-10-21T05:02:04.628Z

### Documentos herdados

(nenhum)

### Subtarefas

- PJ-BFYEFS · id cmvhnaw5l002cood201bfyefs · TODO · docs=1 · E7-02 (app) · Minhas reservas de hotel
- PJ-OG9YPX · id cmvhnaup6002aood25nog9ypx · TODO · docs=1 · E7-01 (portal) · A casa do hotel pela API
- PJ-57E3MH · id cmvhnazsz002hood29357e3mh · TODO · docs=1 · E7-05 (app) · Boletim do hotel no app
- PJ-62YZHU · id cmvhnb0j8002iood2j162yzhu · TODO · docs=1 · E7-06 (portal) · Resumo do hotel pela API
- PJ-GLOYC4 · id cmvhnayci002food2gtgloyc4 · TODO · docs=1 · E7-04 (portal) · Check-in com a carteirinha do app, estadia e check-out
- PJ-28JU4U · id cmvhnavfe002bood2wy28ju4u · TODO · docs=1 · E7-02 (portal) · Reservas e grade de ocupação pela API
- PJ-N8E9AS · id cmvhnaxma002eood29hn8e9as · TODO · docs=1 · E7-03 (app) · Pedir hospedagem pelo app
- PJ-6B946W · id cmvhnawvr002dood2jo6b946w · TODO · docs=1 · E7-03 (portal, site) · Pedido de reserva: página no site, caixa no portal
- PJ-21T3ER · id cmvhnaz2r002good2ya21t3er · TODO · docs=1 · E7-05 (portal) · Rotina, prancheta, ocorrências e boletim do hotel

## PJ-21T3ER · E7-05 (portal) · Rotina, prancheta, ocorrências e boletim do hotel

- id: cmvhnaz2r002good2ya21t3er
- status: TODO
- pai: PJ-09UJ1A (cmvhnatv60028ood2ve09uj1a)
- responsáveis: Luis Gustavo
- prioridade: 2
- prazo: 2026-11-30T12:00:00.000Z
- criado: 2026-10-21T05:02:10.571Z · atualizado: 2026-10-27T13:05:40.775Z
- tags: admin, portal-parceiro

### Descrição

**O que fazer:** Rotina padrão, rondas, ocorrência grave com contato, turno e boletim.
**Superfície:** portal (`petjourney-admin`)
**Depende da API:** card "E7-05 · Rotina do hotel, prancheta, ocorrências, passagem de turno e boletim" de outubro, prazo 19/11 (replanejado em 27/10). Começa quando aquele card estiver Concluído e o handoff anexado aqui.
**Spec:** ver o documento da spec E7-05 no card de outubro (rotas, contrato e regras).
**Prazo:** sugerido para a semana da onda 5; ajustar com o Nicolas.

### Documentos

- [principal] Handoff E7-05: portal-parceiro-e7.md · portal-parceiro-e7.md · id cmvu3e1c6rhjk43pl9pb · atualizado 2026-10-30T13:33:38.786Z

### Documentos herdados

- Épico E7: Hotel · portal-parceiro-e7-hotel.md · id cmvhnaudw0029ood2bbhm4auf

### Subtarefas

(nenhuma)

### Comentários

#### Nicolas Castela · 2026-10-29T22:05:55.991Z

**Guia atualizado (29/10, E7-05a):** a seção 42 do guia anexado (portal-parceiro-e7.md) traz a rotina do hotel. Este card ainda espera a 05b e a 05c para começar, mas a prancheta já tem contrato fechado:

- A prancheta mostra só quem está na casa: um cartão por animal, com os urgentes primeiro. Da estadia encerrada fica só o trabalho registrado, no dia em que aconteceu.

- Alertas novos no cartão: SAIDA_VENCIDA (passou da saída prevista, atenção) e ROTINA_PARADA_SAIDA_VENCIDA (passou 72 h, urgente). No urgente, mostre: "A rotina deste animal parou. Prorrogue a reserva ou faça o check-out."

- Contador novo rotinasParadas, no topo da prancheta e no menu (para o balcão, sempre em vermelho). Também no menu: tarefasAtrasadas, para quem cuida da rotina.

- 503 ROTINA_OCUPADA com tenteDeNovoEmSegundos: no tablet que atualiza sozinho, espere esse tempo e tente de novo, sem mostrar erro na primeira vez.

- Marcar tarefa exige ficha de profissional ativa na casa (403 PROFISSIONAL_OBRIGATORIO): mostre "Peça ao gestor para cadastrar a sua ficha na equipe".

#### Nicolas Castela · 2026-10-30T13:37:02.251Z

**Liberado (30/10), E7-05 no portal:** @Luís, a API da rotina do hotel está completa no develop. Guia reanexado (portal-parceiro-e7.md): seção 42 (tarefas e prancheta), 43 (rotina da casa, diário, ocorrências e turno), 44 (boletim ao responsável) e 45 (correções). Pontos que mais mudam a tela:

- Ocorrência grave exige contato por voz antes do boletim. O telefone só aparece depois de um toque, e cada leitura fica gravada.

- Publicar a rotina da casa mostra a prévia e pode levar até 1 minuto numa casa grande: mantenha "Publicando...".

- Animal internado na clínica da casa: selo "Na internação" (naInternacao), a medicação e o cuidado somem da prancheta, e marcar uma dessas tarefas dá 409 TAREFA_ANIMAL_INTERNADO. O hotel não manda boletim dele.

- Boletim: um aberto por estadia (409 BOLETIM_HOTEL_JA_ABERTO), retido até o contato quando há grave (409 BOLETIM_EXIGE_CONTATO), e "Substituído pelo boletim automático" para o rascunho superado.

## PJ-28JU4U · E7-02 (portal) · Reservas e grade de ocupação pela API

- id: cmvhnavfe002bood2wy28ju4u
- status: TODO
- pai: PJ-09UJ1A (cmvhnatv60028ood2ve09uj1a)
- responsáveis: Luis Gustavo
- prioridade: 2
- prazo: 2026-11-30T12:00:00.000Z
- criado: 2026-10-21T05:02:05.844Z · atualizado: 2026-10-27T13:05:40.484Z
- tags: admin, portal-parceiro

### Descrição

**O que fazer:** Grade, mapa, simular, criar, confirmar, cancelar, comprovantes e espera; apagar tarifas.ts e disponibilidade.ts locais.
**Superfície:** portal (`petjourney-admin`)
**Depende da API:** card "E7-02 · Reservas e disponibilidade do hotel" de outubro, prazo 16/11 (replanejado em 27/10). Começa quando aquele card estiver Concluído e o handoff anexado aqui.
**Spec:** ver o documento da spec E7-02 no card de outubro (rotas, contrato e regras).
**Prazo:** sugerido para a semana da onda 5; ajustar com o Nicolas.

### Documentos

- [principal] Handoff E7-02: portal-parceiro-e7.md · portal-parceiro-e7.md · id cmvu0dblvgryy6a3sp7r · atualizado 2026-10-30T13:33:32.060Z

### Documentos herdados

- Épico E7: Hotel · portal-parceiro-e7-hotel.md · id cmvhnaudw0029ood2bbhm4auf

### Subtarefas

(nenhuma)

### Comentários

#### Nicolas Castela · 2026-10-29T20:41:42.071Z

**API pronta (29/10, E7-02):** a E7-02 fechou inteira no develop (a 02b em 243c1bf, CI verde). O guia anexado (portal-parceiro-e7.md) tem as seções 27 a 34. Este card pode começar quando chegar a vez dele em novembro. Mudanças de contrato da auditoria (seção 34):

- Comprovante: o texto documento virou referencia. O arquivo vai pela rota nova POST /reservas/:id/comprovantes/com-documento (multipart). Arquivo que não serve dá 422 COMPROVANTE_DOCUMENTO_INVALIDO; o "visto no balcão" sem arquivo, numa exigência que bloqueia, dá 422 COMPROVANTE_EXIGE_DOCUMENTO.

- Cadastro: trocar o responsável de um só dos dois animais de uma reserva viva dá 409 PACIENTE_COM_RESERVAS com reason ACOMPANHANTE (seção 31).

- Grade: os animais vêm uma vez em animais, e a barra traz só pacienteId e papel (seção 28).

- Autorizados: o documento volta só com os 4 últimos caracteres (seção 31).

#### Nicolas Castela · 2026-10-30T13:37:00.497Z

**Mudou (30/10), E7-02 no portal:** @Luís, mudanças no dinheiro das reservas. Guia reanexado, seção 45 do portal-parceiro-e7.md.

- Registrar pagamento passa a aceitar a reserva hospedada e a encerrada. Na encerrada, o motivo é obrigatório (422 PAGAMENTO_INVALIDO com MOTIVO_OBRIGATORIO).

- Prorrogar a reserva em curso muda só pelas quantidades, com os preços da venda.

- Motivo novo de cancelamento EXCLUSAO_DO_TITULAR (só o sistema grava, fora do seletor). Rótulo nos 6 idiomas no guia.

## PJ-57E3MH · E7-05 (app) · Boletim do hotel no app

- id: cmvhnazsz002hood29357e3mh
- status: TODO
- pai: PJ-09UJ1A (cmvhnatv60028ood2ve09uj1a)
- responsáveis: Luis Gustavo
- prioridade: 2
- prazo: 2026-11-30T12:00:00.000Z
- criado: 2026-10-21T05:02:11.517Z · atualizado: 2026-10-27T13:05:40.919Z
- tags: app, portal-parceiro

### Descrição

**O que fazer:** Estadia e boletins do hotel.
**Superfície:** app (`petjourney-app`)
**Depende da API:** card "E7-05 · Rotina do hotel, prancheta, ocorrências, passagem de turno e boletim" de outubro, prazo 19/11 (replanejado em 27/10). Começa quando aquele card estiver Concluído e o handoff anexado aqui.
**Spec:** ver o documento da spec E7-05 no card de outubro (rotas, contrato e regras).
**Prazo:** sugerido para a semana da onda 5; ajustar com o Nicolas.

### Documentos

- [principal] Handoff E7-05: portal-parceiro-e7.md · portal-parceiro-e7.md · id cmvu3e13xonza7anlnmq · atualizado 2026-10-30T13:33:38.335Z

### Documentos herdados

- Épico E7: Hotel · portal-parceiro-e7-hotel.md · id cmvhnaudw0029ood2bbhm4auf

### Subtarefas

(nenhuma)

### Comentários

#### Nicolas Castela · 2026-10-30T13:37:02.837Z

**Liberado (30/10), E7-05 no app:** @Luís, a API do boletim do hotel está completa no develop. Guia reanexado, seção 44 do portal-parceiro-e7.md.

- Notificação nova HOTEL_BOLETIM: acrescente em rotas-notificacao.ts (ROTA_POR_TIPO, AFETA_HOME_POR_TIPO, PERFIL_POR_TIPO e CATEGORIA_POR_TIPO) e os textos nos 6 idiomas. Sem isso o toque cai em Unmatched Route.

- Telas: "Hospedagem" no perfil do pet (lista de estadias), a conversa só leitura com os boletins e as fotos, e a preferência de frequência (só o dono).

## PJ-62YZHU · E7-06 (portal) · Resumo do hotel pela API

- id: cmvhnb0j8002iood2j162yzhu
- status: TODO
- pai: PJ-09UJ1A (cmvhnatv60028ood2ve09uj1a)
- responsáveis: Luis Gustavo
- prioridade: 2
- prazo: 2026-11-30T12:00:00.000Z
- criado: 2026-10-21T05:02:12.462Z · atualizado: 2026-10-27T13:05:41.065Z
- tags: admin, portal-parceiro

### Descrição

**O que fazer:** Indicadores do período.
**Superfície:** portal (`petjourney-admin`)
**Depende da API:** card "E7-06 · Resumo do hotel" de outubro, prazo 18/11 (replanejado em 27/10). Começa quando aquele card estiver Concluído e o handoff anexado aqui.
**Spec:** ver o documento da spec E7-06 no card de outubro (rotas, contrato e regras).
**Prazo:** sugerido para a semana da onda 5; ajustar com o Nicolas.

### Documentos

- [principal] Handoff E7-06: portal-parceiro-e7.md · portal-parceiro-e7.md · id cmvtyizl0nxwoboyt6co · atualizado 2026-10-30T13:33:40.713Z

### Documentos herdados

- Épico E7: Hotel · portal-parceiro-e7-hotel.md · id cmvhnaudw0029ood2bbhm4auf

### Subtarefas

(nenhuma)

### Comentários

#### Nicolas Castela · 2026-10-29T19:49:57.930Z

**Guia atualizado (29/10, E7-06b):** o faturamento do hotel está na seção 20.1 do guia anexado (portal-parceiro-e7.md). Pontos da tela:

- Permissão nova hotel.faturamento (dono, gestor e financeiro). Sem ela, o GET /resumo vem sem a chave receita: não mostre card de dinheiro. O financeiro usa GET /resumo/receita, porque o GET /resumo dá 403 para ele.

- A diária média (diariaMediaCentavos) agora conta só a hospedagem. A conta antiga, com serviços e saída tardia, virou receitaPorDiariaCentavos, que sempre vem.

- Campo novo porServicoFalhou: quando vem true (casa grande ou período longo), não vêm porServico nem diariaMediaCentavos, e o resto do dinheiro vale. Mostre "serviços indisponíveis agora, tente um período menor" e, no lugar da diária média, a receitaPorDiariaCentavos com o rótulo dela. Não repita o pedido sozinho.

- O valor retido (retidoCentavos) nunca passa do sinal da reserva.

#### Nicolas Castela · 2026-10-30T13:37:03.421Z

**Liberado (30/10), E7-06 no portal:** @Luís, a API do resumo do hotel está completa no develop e o guia anexado é a versão final (seção 20.1 do portal-parceiro-e7.md, sem mudança de contrato desde o comentário de 29/10). O porServicoFalhou agora deve aparecer só em casa muito grande.

## PJ-6B946W · E7-03 (portal, site) · Pedido de reserva: página no site, caixa no portal

- id: cmvhnawvr002dood2jo6b946w
- status: TODO
- pai: PJ-09UJ1A (cmvhnatv60028ood2ve09uj1a)
- responsáveis: Luis Gustavo
- prioridade: 2
- prazo: 2026-11-30T12:00:00.000Z
- criado: 2026-10-21T05:02:07.729Z · atualizado: 2026-10-22T21:46:59.390Z
- tags: admin, web, portal-parceiro

### Descrição

**Novo em 22/10, atenção:** ao lado do formulário sem conta, a página mostra o botão "Já usa a PetJourney? Peça pelo app" (`petjourneyapp://reservar/<slug>`, com `/baixar-app` se o app não abrir). Motivo: quem já tem a PetJourney deve pedir pelo app, porque o pedido pelo app usa o pet do app e ativa o vínculo, e o do site cria um cadastro solto na clínica. Seção 1.2 do handoff `portal-parceiro-e1.md`.
**O que é:** Quem não tem app pede hospedagem pela página pública do hotel, sem criar conta, e o balcão responde pelo portal.
**Decisão do Nicolas (22/10, Q2 do Portal do parceiro):** a página do pedido e a de acompanhamento ficam no site; a caixa do balcão fica no portal.
**No site:** Em `petjourney.health/reservar/<slug>`: datas, espécie e porte, a disponibilidade e o pedido, com captcha. Depois, a página de acompanhamento em `/reserva/<token>`.
**No portal:** A caixa do balcão (aceitar escolhendo a acomodação, recusar com motivo) e a configuração da reserva online.
**Depende de:** A API da reserva online (card de outubro "E7-03 · Reserva online do hotel", prevista para 27/10).
**Pronto quando:** Um pedido feito pelo site aparece na caixa do portal, o balcão aceita, e a página de acompanhamento mostra a reserva.
**Para quem implementa:** Spec E7-03: rotas `/public/estabelecimentos/:slug/hotel/*` e `/public/reservas/:token`. Entrada urgente (antes da antecedência mínima) vira contato, não pedido.

### Documentos

- [principal] Handoff E7-03: portal-parceiro-e7.md · portal-parceiro-e7.md · id cmvu773e21v10jr61hc9 · atualizado 2026-10-30T13:33:34.323Z

### Documentos herdados

- Épico E7: Hotel · portal-parceiro-e7-hotel.md · id cmvhnaudw0029ood2bbhm4auf

### Subtarefas

(nenhuma)

### Comentários

#### Nicolas Castela · 2026-10-29T20:41:43.253Z

**Espere antes de começar (29/10):** a reserva online do hotel está mudando de estrutura na API: o pedido sem sinal não vai mais segurar vaga. As seções 21 e 35 a 40 do guia do hotel vão mudar.

- Não comece as telas deste card (caixa de pedidos no portal, página do pedido no site) até eu avisar aqui que o guia novo foi anexado.

#### Nicolas Castela · 2026-10-29T23:52:41.081Z

**Liberado (29/10), E7-03 no portal e no site:** @Luís, a API da reserva online está completa no develop, e o guia anexado (portal-parceiro-e7.md, seções 21 e 35 a 40) já é a versão final. Pode começar. O que mudou desde a versão que estava em espera:

- Site: a disponibilidade mostra só o que está livre. Mostre "sujeito à confirmação do hotel" antes de enviar e na confirmação. O 409 HOTEL_PEDIDOS_NO_LIMITE traz o contato do hotel (telefone e WhatsApp) e pede "fale com o hotel".

- Portal, aceite: pode dar 409 SEM_VAGA_NO_ACEITE quando a unidade foi vendida por telefone ou por outra reserva. Mostre as sugestões, a opção de oferecer outra data ou de recusar com mensagem.

- Portal, detalhe do pedido: campo novo pedidosPendentesNasMesmasNoites (quantos outros pedidos querem as mesmas noites) e, só para quem tem paciente.ler, contaCriadaHaDias (há quantos dias a conta de quem pediu existe). Saíram garantiaAte, vagaGarantida e garantiaVencida.

- O e-mail do link agora diz "sujeito à confirmação do hotel".

## PJ-BFYEFS · E7-02 (app) · Minhas reservas de hotel

- id: cmvhnaw5l002cood201bfyefs
- status: TODO
- pai: PJ-09UJ1A (cmvhnatv60028ood2ve09uj1a)
- responsáveis: Luis Gustavo
- prioridade: 2
- prazo: 2026-11-30T12:00:00.000Z
- criado: 2026-10-21T05:02:06.787Z · atualizado: 2026-10-27T13:05:37.954Z
- tags: app, portal-parceiro

### Descrição

**O que fazer:** Lista com orçamento, sinal, política e exigências pendentes.
**Superfície:** app (`petjourney-app`)
**Depende da API:** card "E7-02 · Reservas e disponibilidade do hotel" de outubro, prazo 16/11 (replanejado em 27/10). Começa quando aquele card estiver Concluído e o handoff anexado aqui.
**Spec:** ver o documento da spec E7-02 no card de outubro (rotas, contrato e regras).
**Prazo:** sugerido para a semana da onda 5; ajustar com o Nicolas.

### Documentos

- [principal] Handoff E7-02: portal-parceiro-e7.md · portal-parceiro-e7.md · id cmvu0dbdemyr2lyzdp1i · atualizado 2026-10-30T13:33:31.613Z

### Documentos herdados

- Épico E7: Hotel · portal-parceiro-e7-hotel.md · id cmvhnaudw0029ood2bbhm4auf

### Subtarefas

(nenhuma)

### Comentários

#### Nicolas Castela · 2026-10-29T20:41:42.656Z

**API pronta (29/10, E7-02):** a E7-02 fechou inteira no develop (243c1bf). A parte do app está na seção 33 do guia anexado (portal-parceiro-e7.md):

- O orçamento da reserva tem tipo próprio, sem ids internos.

- Pendências: o item ganhou truncado, e as chegadas sem documentação passam a contar o que vence durante a estadia.

#### Nicolas Castela · 2026-10-30T13:37:01.082Z

**Mudou (30/10), E7-02 no app:** @Luís, o saldo das reservas no app mudou. Guia reanexado, seção 45 do portal-parceiro-e7.md.

- dinheiro.saldoCentavos agora pode ser null e segue o status: na encerrada é o total final menos o pago; na cancelada, negativo é o que volta; em não compareceu vem null e a tela mostra "Fale com a hospedagem".

## PJ-GLOYC4 · E7-04 (portal) · Check-in com a carteirinha do app, estadia e check-out

- id: cmvhnayci002food2gtgloyc4
- status: TODO
- pai: PJ-09UJ1A (cmvhnatv60028ood2ve09uj1a)
- responsáveis: Luis Gustavo
- prioridade: 2
- prazo: 2026-11-30T12:00:00.000Z
- criado: 2026-10-21T05:02:09.628Z · atualizado: 2026-10-27T13:05:40.629Z
- tags: admin, portal-parceiro

### Descrição

**O que fazer:** Admissão com a fonte de cada exigência, pertences, medicação, autorizados e saída com a R4.
**Superfície:** portal (`petjourney-admin`)
**Depende da API:** card "E7-04 · Check-in, estadia e check-out" de outubro, prazo 17/11 (replanejado em 27/10). Começa quando aquele card estiver Concluído e o handoff anexado aqui.
**Spec:** ver o documento da spec E7-04 no card de outubro (rotas, contrato e regras).
**Prazo:** sugerido para a semana da onda 5; ajustar com o Nicolas.

### Documentos

- [principal] Handoff E7-04: portal-parceiro-e7.md · portal-parceiro-e7.md · id cmvtrdviygiaqpnh3d74 · atualizado 2026-10-30T13:33:36.068Z

### Documentos herdados

- Épico E7: Hotel · portal-parceiro-e7-hotel.md · id cmvhnaudw0029ood2bbhm4auf

### Subtarefas

(nenhuma)

### Comentários

#### Nicolas Castela · 2026-10-29T21:39:33.106Z

**API pronta (29/10, E7-04):** a E7-04 fechou inteira no develop (o check-out, E7-04b, em d3c2c9f e 1ae6c52, CI verde). O guia anexado (portal-parceiro-e7.md) tem as seções 27 e 41. Este card pode começar quando chegar a vez dele em novembro. Pontos do check-out:

- Retirada: exatamente um de três jeitos (pelo responsável, por um autorizado da reserva, ou por outra pessoa com nome). "Pelo responsável" agora exige o tipo do documento (RG, CPF, CNH ou outro) e os 4 últimos dígitos; sem isso, a API dá 400.

- Check-out repetido igual devolve a mesma resposta. Repetido com outro pagamento dá 409 RESERVA_NAO_EDITAVEL: mostre que a estadia já foi encerrada e recarregue.

- Saída bloqueada: 409 SAIDA_BLOQUEADA com a lista do que falta (pertence não conferido, peso de saída sem motivo, ocorrência grave sem contato). Mostre cada item na tela do check-out.

- O app recebe o resumo da estadia e o peso de saída, sem a marca da ração e sem nome de pessoa da equipe. No app não há tela nova.

#### Nicolas Castela · 2026-10-30T13:37:01.667Z

**Mudou (30/10), E7-04 no portal:** @Luís, mudanças na estadia. Guia reanexado, seção 45 do portal-parceiro-e7.md.

- Estadia encerrada pelo óbito: encerradaPeloObito: true. Mostre "Encerrada pelo óbito", esconda retirada, documento e peso de saída e não ofereça check-out.

- Acrescentar serviço na estadia em curso não reprecifica mais as diárias (a cortesia de baia melhor fica).

- Registrar pagamento também durante a estadia e depois do check-out (só com hotel.valores).

## PJ-N8E9AS · E7-03 (app) · Pedir hospedagem pelo app

- id: cmvhnaxma002eood29hn8e9as
- status: TODO
- pai: PJ-09UJ1A (cmvhnatv60028ood2ve09uj1a)
- responsáveis: Luis Gustavo
- prioridade: 2
- prazo: 2026-11-30T12:00:00.000Z
- criado: 2026-10-21T05:02:08.672Z · atualizado: 2026-10-27T13:05:37.197Z
- tags: app, portal-parceiro

### Descrição

**Novo em 22/10, atenção:** esta tela também abre pelo link `petjourneyapp://reservar/<slug>`, que vem do botão "Peça pelo app" da página do hotel no site. Rota `reservar/[slug]` lendo `GET /tutor/hotel/estabelecimentos/:slug/reserva-online`. Deslogado: entra e volta para o pedido. No perfil de parceiro: pede para trocar para o de responsável. Slug que não existe: mensagem e volta para a home. Ainda não: `/agendar/*` e `/reservar/*` nos links que abrem o app sozinho, porque quem tiver uma versão antiga do app cairia em "rota não encontrada".
**O que fazer:** Dois caminhos, urgência, dois pets da mesma casa e completar o porte.
**Superfície:** app (`petjourney-app`)
**Depende da API:** card "E7-03 · Reserva online do hotel (pedido pelo app e pela página pública)" de outubro, prazo 17/11 (replanejado em 27/10). Começa quando aquele card estiver Concluído e o handoff anexado aqui.
**Spec:** ver o documento da spec E7-03 no card de outubro (rotas, contrato e regras).
**Prazo:** sugerido para a semana da onda 5; ajustar com o Nicolas.

### Documentos

- [principal] Handoff E7-03: portal-parceiro-e7.md · portal-parceiro-e7.md · id cmvu7735pmthnnanifqs · atualizado 2026-10-30T13:33:33.903Z

### Documentos herdados

- Épico E7: Hotel · portal-parceiro-e7-hotel.md · id cmvhnaudw0029ood2bbhm4auf

### Subtarefas

(nenhuma)

### Comentários

#### Nicolas Castela · 2026-10-29T20:41:43.830Z

**Espere antes de começar (29/10):** a reserva online do hotel está mudando de estrutura na API: o pedido sem sinal não vai mais segurar vaga. As seções 21 e 35 a 40 do guia do hotel vão mudar.

- Não comece o pedido de hospedagem pelo app até eu avisar aqui que o guia novo foi anexado.

#### Nicolas Castela · 2026-10-29T23:52:40.526Z

**Liberado (29/10), E7-03 no app:** @Luís, a API da reserva online está completa no develop, e o guia anexado (portal-parceiro-e7.md, seções 21 e 35 a 40) já é a versão final. Pode começar. O que mudou desde a versão que estava em espera:

- A disponibilidade mostra só o que está livre. Mostre "sujeito à confirmação do hotel" antes de enviar e na tela de confirmação. Nunca escreva "vaga reservada" ou "garantida" para pedido.

- Avisos novos na disponibilidade: pedidosNoLimite, hotelEscolheNoLimite e clienteDaCasa (este só vem no app).

- 409 HOTEL_PEDIDOS_NO_LIMITE: traz o contato do hotel (telefone e WhatsApp). Mostre a mensagem com os dois botões para falar com o hotel, nos dois escopos (HOTEL e PESSOA).

- Cancelar o pedido não libera um pedido novo no mesmo hotel até a data de saída do pedido cancelado. A tela de cancelar precisa avisar isso antes de confirmar.

## PJ-OG9YPX · E7-01 (portal) · A casa do hotel pela API

- id: cmvhnaup6002aood25nog9ypx
- status: TODO
- pai: PJ-09UJ1A (cmvhnatv60028ood2ve09uj1a)
- responsáveis: Luis Gustavo
- prioridade: 2
- prazo: 2026-11-30T12:00:00.000Z
- criado: 2026-10-21T05:02:04.900Z · atualizado: 2026-10-27T13:05:40.340Z
- tags: admin, portal-parceiro

### Descrição

**O que fazer:** Blocos, tipos, acomodações, tarifas, temporadas, serviços, política e exigências.
**Superfície:** portal (`petjourney-admin`)
**Depende da API:** card "E7-01 · A casa do hotel (acomodações, tarifas, temporadas, serviços, política e exigências)" de outubro, prazo 15/11 (replanejado em 27/10). Começa quando aquele card estiver Concluído e o handoff anexado aqui.
**Spec:** ver o documento da spec E7-01 no card de outubro (rotas, contrato e regras).
**Prazo:** sugerido para a semana da onda 5; ajustar com o Nicolas.

### Documentos

- [principal] Handoff E7-01: portal-parceiro-e7.md · portal-parceiro-e7.md · id cmvt4wbk3ejlftr64is9 · atualizado 2026-10-29T06:00:09.050Z

### Documentos herdados

- Épico E7: Hotel · portal-parceiro-e7-hotel.md · id cmvhnaudw0029ood2bbhm4auf

### Subtarefas

(nenhuma)
