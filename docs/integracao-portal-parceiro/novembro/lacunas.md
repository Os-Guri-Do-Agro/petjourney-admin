# Lacunas e perguntas de novembro

O que os guias não cobrem ou o que o front decidiu sozinho, para o Nicolas confirmar. Erro da API não
se conserta no front: vem para cá e vira tarefa "🔴 NICOLAS RESPONDE" no Nevo.

| # | Card | O quê | Decisão provisória | Tarefa no Nevo |
|---|---|---|---|---|
| N1 | PJ-VK5P13 | Os textos em espanhol do guia usam "tú" ("Entraste", "formas parte"); o `es.json` do portal é todo em "usted" (72 textos contra 3). | Mesmo sentido, no "usted": "Entró con una cuenta...", "Ahora forma parte del equipo de {empresa}." | a criar se ele quiser mudar o registro |
| N2 | PJ-VK5P13 | Na conta errada, a linha do convite dizia "{nome} convidou você", contradizendo o título "Este convite é para outra conta". | A linha usa o texto que já existe sem o "você": "Convite como {papel}". | não precisa |
| N3 | E4 | O guia da E4 tem a anamnese por voz (E4-07, seções 12, 13 e 15), mas não há card dela para o Luís em novembro. | Nada feito até ele dizer se falta o card. | a criar antes da onda 4 |
| N4 | PJ-RWQBMT | Os contadores de `GET /parceiro/portal/pendencias` mandam `rota: '/veterinario/...'` (guias E3 e E4). | O redirect de `/veterinario/*` para `/clinica/*` cobre. Pedir a troca na API só se o Nicolas quiser limpar. | não precisa |
| N5 | PJ-49U4QS | O card pede "Turnstile nas páginas públicas", escrito antes da Q2 (22/10): as páginas de pedido de horário e de reserva vão para o site, e as do portal saem ou viram pré-visualização (PJ-KE667M). | Captcha fica fora do portal; entra no site com a E3-05 e a E7-03. No portal, só a `Idempotency-Key` (`service/idempotencia.ts`), ligada em cada criação a partir da E2-01. | não precisa |
| N6 | PJ-KE667M | O guia não diz qual página (clínica ou hotel) o link e o QR mostram, nem o que fazer com uma casa sem módulo. A API também não entrega o QR. | Clínica em `/agendar/<slug>`, hotel em `/reservar/<slug>`, pelo módulo pedido ou ligado e pelo `elegiveis` do `/eu`; sem nenhum dos dois, `/agendar`. Os dois quando a casa tem os dois. QR gerado no navegador (`qrcode` 1.5.4), só com a página no ar. | não precisa |
| N7 | PJ-UFRXH6 | A API grava a criação de paciente, cliente e alerta como `ALTERAR` com `campos: ['criado']`, e a exclusão do cliente com `campos: ['excluido']` (`pacientes-parceiro.service.ts:503`, `clientes-parceiro.service.ts:295` e `:807`). Na tela isso lia "alterou um alerta · campos: criado", e o filtro "Criou" não acha esses eventos. | A linha lê o marcador como verbo ("criou", "excluiu") e tira o marcador da lista de campos. O filtro continua pelo que a API grava. Se o Nicolas gravar `CRIAR` de verdade, nada muda na tela. | a criar se ele quiser o filtro certo |
