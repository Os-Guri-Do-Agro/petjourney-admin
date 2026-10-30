# Validação de uso real do portal (29/10/2026)

Segunda rodada, com a mesma conta da primeira ([27 e 28/10](../2026-10-27/README.md)). O portal foi
usado como num dia de trabalho, em quatro frentes, cada uma com uma persona; cada achado foi
anotado, corrigido e conferido na tela (1440, 1280, 1024 e 768 com toque, claro e escuro; es, ar e
sr nas telas principais). Depois, um fechamento pegou os itens pequenos que tinham ficado para trás.
Tudo no `develop`.

| Frente | Persona | Relatório |
| --- | --- | --- |
| Parceiro | Helena Prado, dona da empresa: entrada, casca, Início, Programas, Divulgação, Indicados, Acessos, Carteira, Equipe, convite, Configurações | [parceiro.md](parceiro.md) |
| Clínica | Recepção e gerência: Hoje, Agenda, pedidos online, fila, faltas, pacientes, vacinas, estoque, relatórios, página pública | [clinica.md](clinica.md) |
| Veterinário | Plantonista: Hoje, prontuário, receita, dose, documentos, internação, bulário | [veterinario.md](veterinario.md) |
| Hotel | Gerente do hotel e creche: painel, reservas, pedidos online, check-in e check-out, estadia, A casa, rotina, relatórios, página pública | [hotel.md](hotel.md) |

## Contas para conferir

As mesmas de 27/10 (senha `Aurora@2026`, e-mails `@example.com` de propósito), com a Helena
(`helena@clinica-aurora.example.com`) e `?clinico=on&hotel=on` para ligar Clínica e Hotel. Criados
hoje na API de dev, fora desta rodada, e que aparecem nela:

- **Bruno Teixeira** (`bruno@indicado-aurora.example.com`), indicado da Aurora pelo código UBB775:
  é o "1 pessoa" de Indicados.
- **Fred**, um furão (pet "Outro") do Bruno, com o acesso **463855** vinculado à Aurora (teste do
  PJ-NZX554). Vence em 30/10, 16:43, e passa para o Histórico de Acessos da Aurora.

Nada foi criado nem alterado na API durante a rodada: as únicas escritas foram uma troca de senha
com a senha atual errada (recusada) e prévias de convite com tokens falsos. Clínica e Hotel são
demonstração: o que se grava some ao recarregar.

## Números

| Frente | Achados | Bloqueia | Confunde | Incomoda | Polimento | Corrigidos |
| --- | --- | --- | --- | --- | --- | --- |
| Parceiro | 33 | 0 | 7 | 5 | 21 | 31 |
| Clínica | 25 | 0 | 10 | 4 | 11 | 20 |
| Veterinário | 29 | 3 | 11 | 3 | 12 | 26 |
| Hotel | 26 | 1 | 11 | 6 | 8 | 23 |
| Coordenação | 1 | 0 | 1 | 0 | 0 | 1 |
| **Total** | **114** | **4** | **40** | **18** | **52** | **101** |

Bem menos grave que em 27/10 (17 que impediam o trabalho), e quase tudo no que mudou depois: telas
novas, a demonstração da Clínica e do Hotel e casos que só aparecem num horário.

## Os 4 que impediam o trabalho (todos corrigidos)

- **V-01** Trocar o remédio no campo mantinha a dose e a conta do remédio anterior: saía "128 mg ÷
  2 mg/mL = 0,26 mL" de meloxicam, cem vezes a dose.
- **V-02** A "Digitação rápida" ("8,3 Enter 38,6 Enter") apagava o peso e o marcava "não aferido".
- **V-03** Com a alergia ainda não confirmada, o Receituário e as Orientações imprimiam a dipirona
  da Nina, mesmo com "Assinar e emitir" travado.
- **H-03** Não havia como cadastrar um animal novo dentro da reserva de balcão (aberto de 27/10).

## Coordenação

### X-01 · Início: "Agenda da semana" fora da ordem do relógio e com outro número · Confunde
- Tela: Início, "Agenda da semana", hoje  ·  1440, claro
- O que acontece: a lista de hoje começava às 17:45 (em atendimento), voltava para 09:30 (hotel
  atrasado) e seguia; lida de relance, parecia embaralhada. A faixa dizia "37 atendimentos"
  enquanto o bloco da Clínica, na mesma tela, dizia "de 35": a faixa contava as faltas.
- Correção: a lista vai pela hora que cada linha mostra, clínica e hotel misturados; a urgência fica
  no selo (como pede a regra da casa) e o que é agora já está nos blocos do topo. Horário que passou
  sem o animal chegar ganha o selo "Não chegou", senão parecia que ainda ia acontecer. A faixa conta
  como a Agenda e o Hoje, sem falta (`src/components/home/linha-do-dia.ts`,
  `src/components/home/HomeAgenda.vue`; chave `inicio.agenda.naoChegou` nos 6 idiomas; testes do
  `linha-do-dia.spec.ts` trocados pela regra nova).
- Conferido: 1440 claro, às 18h: "31 atendimentos" na faixa e "24 de 31" no bloco; 09:30 Sushi
  "Atrasada", 10:00 Pérola "Não chegou", 15:00 Zeus "Admissão pendente".

## Decisões tomadas na rodada, para o Luís conferir

- **Pendências conta as faltas a justificar** (C-07, era o C-21 aberto): o selo do menu passou de 21
  para 36 na demonstração, em tom de atenção, e a tela de Faltas abre em "A justificar".
- **A demonstração usa o nome da conta** (C-09 e H-06, eram o C-14 aberto): `/agendar` e `/reservar`
  mostram "Aurora Clínica e Hotel Veterinário" e o link virou
  `/agendar/aurora-clinica-e-hotel-veterinario`; o link antigo continua abrindo, o que protege as
  capturas da apresentação. Os documentos da Clínica também saem com o nome da Aurora.
- **"Furão" com inicial maiúscula no portal** (P-15), como "Cachorro" na mesma linha. O site e o
  app do vet mostram como foi digitado ("furão"); dá para alinhar os dois se quiser.
- **O login espera a empresa** (P-01), por no máximo 4 s, para o menu do Portal nascer inteiro; o
  menu também lembra a forma da última sessão (apagada no logout).
- **Erro de servidor sem código vira frase da casa** (P-04): "Internal server error" e a lista crua
  do validador não aparecem mais na tela; quem decide pela tela continua lendo `codigo`.
- **Plural do português com decimais** (V-28): "0,66 comprimido", "1,5 comprimido",
  "2,5 comprimidos" (`src/i18n/plural.ts`); com número inteiro, nada muda.
- **"Desidratação: Ausente / Leve / Moderada / Grave"** no exame físico (V-13), no lugar de
  "Hidratação: Leve", que no papel lia como o contrário.
- **Gavetas em árabe** abrem do lado em que a linha termina (P-02, aberto de 27/10), numa regra só
  em `src/assets/main.css`.
- **Finados e Consciência Negra** são feriado na demonstração (C-23); os números do histórico da
  Clínica mudaram um pouco por causa disso (Faltas: de 31 para 26).

## O que ficou aberto

Decisão de produto ou de desenho:
- **P-24** A faixa de cima de toda tela tem texto branco sobre a sálvia a 3,32:1 (abaixo de 4,5). É
  a faixa do app escolhida em 26/10; proposta no relatório (escurecer a sálvia só atrás do texto).
- **P-29** "Dono" e "Operador" na Equipe, no masculino para a Helena; proposta: "Titular" e "Equipe".
- **V-26** Banho e tosa aparece no destaque do veterinário e abre o prontuário clínico completo.
- **H-24** "Registrar ligação" grava num clique, sem o que foi conversado (hoje é um clique de
  propósito).

Redesenho ou funcionalidade nova (proposta em cada relatório):
- **C-19** Remarcar para outro dia. **C-21** Exportar os relatórios. **C-22** Agenda estreita com a
  gaveta aberta em 1440.
- **V-27** Seletor do bulário em diálogo no meio da tela (a regra é gaveta).
- **H-22** Prévia "Amanhã" da rotina padrão contando o dia inteiro. **H-23** Nova reserva,
  check-in, check-out, editar acomodação e cancelar em diálogo, não em gaveta.

Dado da demonstração: **C-20** volume impossível por paciente (a Açaí tem 27 agendados); **V-29**
em ar, en e es, o histórico mostra o diagnóstico em português (o título é gravado no dado).

Pequenos vistos de passagem: **C-25** (o "Carregando..." da Clínica é um cartão estreito sem a
faixa, no `UiPagina`; "1 resultados" no leitor de tela, texto do PrimeVue) e, no fechamento, a fita
da semana da Agenda mostra "-" no domingo fechado e "0" no feriado fechado (`capacidadeDoDia`).

Não testado: saque (saldo zero), aceite e recusa do convite do Rafael (convite real), o aviso da
indicação vindo da API (a Aurora está com tudo ativo), "Baixar QR" e "Imprimir" (janelas do
sistema) e o ditado do prontuário (sem microfone). Salvar a chave PIX "abc" para ver a recusa foi
barrado pela permissão do ambiente; a recusa está coberta por teste e a chave segue a da empresa.

## Fora do portal

API (detalhes em [parceiro.md](parceiro.md)):
- 500 intermitente na API de dev em `GET /parceiro/portal/dashboard`, `/status` e `/carteira`.
- `POST /parceiro/portal/equipe/convites/previa-por-link` com token curto responde 400 com a frase
  do validador em inglês e sem `codigo`.
- `GET /parceiro/portal/status` devolve `decididoEm: null` nos dois programas ativos.
- Resolvidos desde 27/10: senha atual errada agora responde `400 SENHA_ATUAL_INCORRETA`, e o limite
  subiu para 300 pedidos por minuto.

Para quando o Hotel tiver API (detalhes em [hotel.md](hotel.md)): recusar reserva do mesmo animal
em datas que se cruzam, criar reserva de balcão com animal e responsável novos, e registrar a
devolução quando o pago passa das noites usadas.

## Verificação final (29/10)

- `npx vitest run`: 1835 testes, todos passando, no fuso local e com `TZ=UTC` (o do GitHub).
- Clínica, Hotel, Início e telas com relógio falso em 8 combinações (04/11 às 06:00, 12:30,
  16:30, 20:00 e 23:55; domingo 08/11; 30/11; 01/01/2027): 1399 testes passando em cada uma.
- `npm run type-check`: sem erros. `npm run check:i18n`: paridade OK nos 6 idiomas.
- `node scripts/lint-copy.mjs src/locales`: ok. `node scripts/conferir-rotas-no-contrato.mjs
  contrato/openapi.json src`: 35 chamadas, todas no contrato.
- oxlint e eslint nos 120 arquivos de código tocados: só o erro antigo do HEAD em
  `hospedagem-repository.ts` (variável sem uso), que ficou como estava.
- Prettier só nos arquivos que já estavam formatados no HEAD.
