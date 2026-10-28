# Frente Veterinário: validação de uso real (27/10/2026)

Persona e roteiro: fui a veterinária de plantão da Aurora Clínica e Hotel Veterinário, logada como
Helena (helena@clinica-aurora.example.com), com Clínica e Hotel ligados (`?clinico=on&hotel=on`).
Percorri o Hoje do veterinário, o atendimento (prontuário, receita, dose, documentos, retorno,
finalização), as telas do paciente, a internação (leitos, prescrição, dose, evolução, plantão,
boletim, alta), atendimentos e bulário, os estados de erro pelo painel de desenvolvimento e os
atalhos de teclado. Larguras 1440, 1024 e 768 (toque), temas claro e escuro, e árabe (RTL) no
prontuário. Contagem: 26 achados (5 Bloqueia, 8 Confunde, 8 Incomoda, 5 Polimento); 24
corrigidos e conferidos na tela, 1 parcial (V-24) e 1 aberto (V-20).

Observação geral: o módulo Clínica está mocado no front neste branch; tudo que gravei some num
recarregamento completo (já sabido, anotado uma vez só).

## Achados

### V-01 · Texto digitado durante o autosave some do campo e se perde · Bloqueia
- Tela: `/veterinario/atendimento/<id>` (todas as etapas)  ·  Largura/tema: todas
- O que acontece: com a rede lenta (painel de desenvolvimento, latência 2,5 s), digitei "Tosse",
  esperei o "Salvando…" e continuei com " e cansaço". Quando a gravação voltou, o campo recuou
  para o texto enviado; o que digitei em seguida ("noturno") gravou por cima e o "cansaço" sumiu
  de vez. A linha de estado dizia "Salvo às 20:37".
- Por que pesa para quem usa: a anamnese é digitada com o tutor na sala; com o wi-fi ruim da sala
  dos fundos, a veterinária perde frases sem perceber, e o prontuário vira documento legal
  incompleto.
- Correção: a resposta da gravação só volta para os campos que não mudaram desde o envio, e
  resposta de gravação mais antiga não sobrescreve a mais nova
  (`src/features/clinico/stores/prontuario.ts`, função `gravar`). Teste novo:
  `src/features/clinico/stores/__tests__/prontuario.spec.ts`.
- Conferido: 1440, claro, mesma sequência com latência de 2,5 s; o campo não recua mais. Spec
  passa.

### V-02 · Uma gravação que falha troca o prontuário inteiro por "Não foi possível carregar" · Bloqueia
- Tela: `/veterinario/atendimento/<id>`  ·  Largura/tema: todas
- O que acontece: com `encounter.salvar` falhando (painel de desenvolvimento), bastou digitar na
  queixa: a folha inteira some e no lugar aparece "Não foi possível carregar · A alteração não foi
  salva. Tente de novo." com "Tentar novamente", que recarrega o prontuário do servidor sem o que
  foi digitado. O mesmo valia para falha ao marcar retorno e ao entregar o resumo.
- Por que pesa para quem usa: uma oscilação de rede no meio da consulta tira a veterinária da
  tela; o texto só volta se ela souber aceitar o "rascunho" depois.
- Correção: falha de gravação não é mais erro de página. O texto fica no campo e no rascunho
  local, a linha de estado avisa "Sem conexão. Guardado neste computador até a rede voltar." (ícone
  de nuvem cortada, tinta de atenção) e a gravação tenta de novo sozinha a cada 5 s. O erro de tela
  ficou só para quando o prontuário não carregou; falha de ação (retorno, finalizar, entregar
  resumo) vira aviso (toast). Sair da tela sem rede também não trava mais (soltar a edição falhava
  e prendia a navegação). (`stores/prontuario.ts`: `gravar`, `descarregar`, `finalizar`, `$limpar`;
  `pages/(accounts)/veterinario/atendimento/[encounterId].vue`: `erroTraduzido`, `estadoDaGravacao`,
  `.gravacao--falha`; chave nova `clinico.prontuario.nova.semConexao` nos 6 idiomas.)
- Conferido: 1440, claro: com a falha ligada a folha fica e o aviso aparece; ao desligar, em 5 s
  volta "Salvo às 20:44" e o rascunho local é apagado. Spec cobre as duas coisas.

### V-03 · Finalizar com texto não gravado fechava o atendimento sem ele · Bloqueia
- Tela: `/veterinario/atendimento/<id>`, diálogo Finalizar  ·  Largura/tema: todas
- O que acontece: `finalizar` gravava, ignorava a falha da gravação e fechava o atendimento com a
  cópia antiga do servidor. Se o fechamento falhasse, o diálogo só parava de girar, sem dizer nada
  (o comentário do código prometia "a falha aparece na faixa de erro da tela", que não existia).
- Por que pesa para quem usa: prontuário finalizado é leitura; o que faltou não volta.
- Correção: finalizar recusa enquanto houver alteração não gravada e avisa ("A alteração não foi
  salva. Tente de novo."); falha do fechamento também avisa e o diálogo fica na pergunta
  (`stores/prontuario.ts`, `finalizar`).
- Conferido: spec "não finaliza enquanto houver texto que a rede não levou".

### V-04 · Nome longo do paciente quebrado no meio da palavra na capa do atendimento · Incomoda
- Tela: `/veterinario/atendimento/<id>` (e capa da ficha, internado)  ·  Largura/tema: 1440, claro
- O que acontece: com o Maximiliano (responsável "Bartholomeu Constantino de Albuquerque Cavalcanti
  Neto"), a coluna do responsável crescia até 690 px e o nome do paciente ficava em 210 px: cinco
  linhas, "Schnauzerhaus / en III" partido no meio, e os dois alertas em duas linhas cada.
- Por que pesa para quem usa: o nome é o título da tela; partido assim parece erro de sistema, na
  frente do tutor.
- Correção: o bloco do responsável tem teto de 360 px em tela larga e o nome dele corta com
  reticências (inteiro na dica); o nome do paciente quebra entre palavras (`overflow-wrap:
  break-word` no lugar de `anywhere`) (`src/features/clinico/components/pacientes/ficha/FichaCabeca.vue`).
- Conferido: 1440, claro: nome em duas linhas inteiras, alertas numa linha cada.

### V-05 · Rótulos dos números do Hoje cortados ("Na recepç…", "Em consu…") · Incomoda
- Tela: `/veterinario/meu-dia`  ·  Largura/tema: 1440, claro e escuro
- O que acontece: no cartão do resumo, os três números mostravam "Na recepç…" e "Em consu…".
- Por que pesa para quem usa: é o número que decide o que fazer primeiro, e o rótulo dele não
  se lia.
- Correção: o rótulo quebra em vez de cortar e o ladrilho ganhou 6 px de miolo, o que basta para
  as palavras em português caberem numa linha (`MeuDiaFoco.vue`, `.numero` e `.numero__rotulo`).
- Conferido: 1440, claro: "Na recepção", "Em consulta", "Internados" inteiros.

### V-06 · Hoje dizia "Nada parado" e três zeros enquanto carregava · Confunde
- Tela: `/veterinario/meu-dia`  ·  Largura/tema: todas
- O que acontece: a faixa do alto é desenhada antes dos dados. Durante a carga aparecia "Nada
  parado. O resto do dia está na agenda.", "Ninguém na sala nem na recepção, e nada mais marcado
  para hoje." e "0 Na recepção · 0 Em consulta · 0 Internados", trocados um instante depois por
  "2 assuntos urgentes pedem sua atenção". Com rede lenta, a mentira fica na tela.
- Por que pesa para quem usa: a veterinária que bate o olho e sai acha que não há ninguém
  esperando.
- Correção: enquanto o dia de hoje não chega, os dois cartões do destaque ficam em esqueleto na
  mesma forma (`MeuDiaFoco.vue`), e o "carregando" do Hoje passou a valer até chegar o dia pedido,
  não só enquanto a agenda está no ar (`composables/useMeuDia.ts`, `carregando`).
- Conferido: 1440, claro: sequência da tela na abertura sem "Nada parado"; esqueleto visto.

### V-07 · "Assinar e emitir" assinava receita de remédio ao qual o paciente é alérgico, sem a confirmação · Bloqueia
- Tela: `/veterinario/atendimento/enc-apt-alergia?etapa=conduta` (Nina, alérgica a dipirona)
  ·  Largura/tema: todas
- O que acontece: a prescrição mostra "Alergia registrada a Dipirona … A prescrição segue possível,
  com confirmação explícita." com a caixa "Confirmo e quero prescrever assim mesmo" desmarcada.
  Mesmo assim, "Assinar e emitir" gerou "Assinada eletronicamente por Tiago Sá · CRMV-SP 50133 ·
  Código de verificação RP03-BV5U-B7G1-S8T2", pronta para "Enviar ao responsável".
- Por que pesa para quem usa: é a trava de segurança do paciente; o papel assinado vai para a
  farmácia e para o app do tutor sem que ninguém tenha aceitado o risco.
- Correção: a store de receitas recusa emitir item em conflito com alergia sem o aceite da consulta
  (`stores/receitas.ts`, `alergiaSemAceite`), e o botão fica apagado com o motivo ao lado: "Confirme
  a alergia na prescrição para assinar." (`ProntuarioReceita.vue`; chave nova
  `clinico.receita.confirmeAlergia` nos 6 idiomas). Teste novo em `receitas.spec.ts`; o auxiliar do
  spec passou a trazer o aceite, porque a Luna do dataset é alérgica à amoxicilina que ele usava.
- Conferido: 1440, claro: com a caixa desmarcada o botão apaga e a frase aparece; ao marcar, o
  botão volta. Spec passa.

### V-08 · Conta da dose com ponto decimal e sem unidade ("6.4 kg", "÷ 500 mg = 0.26") · Confunde
- Tela: `/veterinario/atendimento/<id>?etapa=conduta`, memória de cálculo da prescrição
- O que acontece: "1. 6.4 kg × 20 mg/kg = 128 mg por administração" e "2. 128 mg ÷ 500 mg = 0.26 por
  administração", logo acima de "0,26 mL (128,0 mg) a cada 8 h". Ponto no lugar de vírgula e a
  concentração sem "/mL", resultado sem unidade.
- Por que pesa para quem usa: a conta existe para a veterinária conferir de cabeça; vírgula e
  unidade erradas são exatamente o erro de dose que ela devia pegar.
- Correção: os números da conta saem no formato do idioma, com as casas que têm (até duas), e o
  passo 2 traz a unidade: "128 mg ÷ 500 mg/mL = 0,26 mL por administração" (`ProntuarioConduta.vue`,
  `numeroDaConta`/`textoDoPasso`; frase `conta.dose-por-concentracao` nos 6 idiomas).
- Conferido: 1440, claro, Nina: "6,4 kg × 20 mg/kg", "500 mg/mL = 0,26 mL".

### V-09 · "Fêmea · Castrado" na capa do paciente · Polimento
- Tela: capa do atendimento, da ficha e do internado; cabeçalho compacto (bulário, gaveta da agenda)
- O que acontece: "Canina · Shih Tzu · Pequeno · 12 anos · Fêmea · Castrado".
- Por que pesa para quem usa: erro de concordância na linha que identifica o animal.
- Correção: o rótulo concorda com o sexo ("Castrada"/"Inteira"; "Spayed" em inglês) (`FichaCabeca.vue`
  e `ClinicPatientHeader.vue`, uma linha cada; chaves `clinico.paciente.castrada`/`inteira` nos 6
  idiomas). `PacientePreview.vue` (frente Clínica) tem a mesma linha: anotado em Compartilhado.
- Conferido: 1440, claro, Nina: "Fêmea · Castrada".

### V-10 · Atestado de saúde dizia "não tendo constatado alterações clínicas" com achado no exame · Bloqueia
- Tela: `/veterinario/atendimento/<id>?etapa=resumo` > Outros documentos > Atestado de saúde
- O que acontece: Nina com "Locomotor: Dor à extensão do quadril direito" no exame e sem diagnóstico
  fechado; o atestado impresso dizia "…examinei em 27 de outubro de 2026 o animal Nina, acima
  identificado, não tendo constatado alterações clínicas no exame realizado."
- Por que pesa para quem usa: o papel assinado afirma o contrário do prontuário (o comentário do
  próprio componente diz que esse é o tipo de frase que volta como problema no CRMV).
- Correção: sem diagnóstico, o atestado declara o que o exame registrou fora do normal (sinal vital
  fora da faixa e sistema alterado, com a nota): "…tendo registrado no exame: Locomotor: Dor à
  extensão do quadril direito." (`DocumentoAtestado.vue`, `achados`; frase
  `atestado.saude.corpoComAchado` nos 6 idiomas). "Não constatado" ficou só para exame sem nada fora
  do normal.
- Conferido: texto da folha de impressão lido na página (impressão interceptada), 1440.

### V-11 · Declaração de óbito listada em "Termos assinados pelo responsável" · Confunde
- Tela: `/veterinario/atendimento/<id>?etapa=resumo` > Outros documentos
- O que acontece: a "Declaração de óbito animal" (assinada pelo veterinário) aparecia no grupo dos
  termos do responsável, ao lado de consentimento e eutanásia.
- Correção: passou para "Declarações" (`ProntuarioResumo.vue`, catálogo de documentos).
- Conferido: 1440: Declarações com 5 itens, Termos com 3.

### V-12 · "Comprovante de vacinação · Lote e fabricante ainda não são registrados." · Polimento
- Tela: mesma lista de documentos
- O que acontece: a descrição dizia que lote e fabricante não são registrados; o comprovante já lê
  lote, fabricante e data do reforço da aplicação gravada.
- Correção: "Vacinas aplicadas, com lote, fabricante e data do reforço." nos 6 idiomas.
- Conferido: 1440, claro.

### V-13 · Adicionar diagnóstico pelo teclado jogava o foco para o início da página · Incomoda
- Tela: `/veterinario/atendimento/<id>?etapa=diagnostico`
- O que acontece: com "Digitação rápida", digitar "displasia" e Enter leva à sugestão; o segundo
  Enter adiciona, mas a sugestão some da lista e o foco cai no `body`. O próximo Tab começa em
  "Pular para o conteúdo", no alto da página.
- Por que pesa para quem usa: quem registra dois ou três diagnósticos pelo teclado tem de voltar
  com o mouse a cada um.
- Correção: depois de adicionar, o foco volta para a busca (`ProntuarioDiagnostico.vue`, `adicionar`).
- Conferido: 1440: "LF" Enter Enter adiciona "Linfadenomegalia reativa" e o foco fica na busca.

### V-14 · "Atendimento finalizado": botão do próximo paciente estourava o diálogo e espera em "268 min" · Incomoda
- Tela: diálogo "Atendimento finalizado" (depois de finalizar)  ·  Largura/tema: 1440, claro
- O que acontece: com o Maximiliano como próximo, o botão "Atender Maximiliano Bartholomeu von
  Schnauzerhausen III" passava da borda direita do diálogo, cortado, e levava junto a lista "Com este
  atendimento" (sem respiro à direita); a linha dizia "espera há 268 min na recepção", enquanto o
  Hoje diz "Esperando há 4 h 28 min".
- Por que pesa para quem usa: é a tela de transição entre um paciente e outro, vista dezenas de
  vezes por dia; o botão principal cortado parece quebrado.
- Correção: o botão diz "Iniciar consulta" (o nome continua ao lado e no rótulo para leitor de
  tela, como já é no Hoje) e a espera usa o mesmo formato de horas e minutos
  (`ProntuarioFinalizarDialog.vue`; frase `finalizar.feito.esperaHa` com `{tempo}` nos 6 idiomas).
- Conferido: 1440, claro: diálogo sem rolagem lateral (574 = 574 px), "espera há 4 h 29 min na
  recepção", botão inteiro.

### V-15 · Prontuário em leitura dizia "Salva sozinho enquanto você escreve" · Polimento
- Tela: atendimento com outro dispositivo editando (painel de desenvolvimento simula)
- O que acontece: com a faixa "Somente leitura · Em edição por Recepção · Chrome", a linha de estado
  seguia prometendo "Salva sozinho enquanto você escreve" com os campos travados.
- Correção: em leitura a linha de estado some (`[encounterId].vue`, `estadoDaGravacao`).
- Conferido: 1440: em leitura, sem a frase; "Assumir a edição" pede confirmação e devolve a edição.

### V-16 · Histórico do atendimento prometia "Ver todos (16)" e a vista abria com 30 · Confunde
- Tela: `/veterinario/atendimento/<id>`, coluna "Histórico do paciente"  ·  1440
- O que acontece: Maximiliano: a capa diz "Histórico 30", a coluna ao lado diz "Ver todos (16)", e
  o link abre a Linha do tempo com "Tudo 30" (a coluna conta só eventos; a vista soma faltas e
  consultas sem diagnóstico). Nina: "Histórico 25" e "Ver todos (17)".
- Por que pesa para quem usa: dois números diferentes para a mesma coisa na mesma tela ensinam a
  não confiar em número.
- Correção: o link diz "Ver histórico", sem número; a contagem fica com a aba da capa
  (`ProntuarioTimeline.vue`, chave já existente `clinico.paciente.verHistorico`).
- Conferido: 1440, claro.

### V-17 · Aplicar vacina em paciente imunossuprimido sem nenhum aviso · Confunde
- Tela: `/veterinario/paciente/pet-nina/vacinas` > Aplicar agora (e "Aplicar vacina" do prontuário)
- O que acontece: a Nina tem "Imunossuprimido: Quimioterapia em curso" (risco) na capa; o diálogo
  "Aplicar vacina · Nina" oferece V10 com lote, via e "Aplicar e registrar" sem mencionar isso.
- Por que pesa para quem usa: vacina de agente vivo em paciente em quimioterapia é a contraindicação
  clássica; a prescrição já avisa alergia, a vacina não avisava nada.
- Correção: o diálogo abre com a frase em tinta de risco "Imunossuprimido: Quimioterapia em curso.
  Vacina de agente vivo costuma ser contraindicada: confirme antes de aplicar." Não trava (o
  catálogo não diz qual vacina é viva; ver Propostas) (`vacinas/AplicarVacinaDialog.vue`,
  `imunossupressao`; chave `clinico.vacinas.aplicar.imunossuprimido` nos 6 idiomas). O diálogo mora
  na pasta da frente Clínica, mas só as telas do veterinário o usam; edição pequena.
- Conferido: 1440, claro, Nina > Antirrábica.

### V-18 · Depois de aplicar a vacina, a aba "Vacinas 3" não mudava (a frase já dizia 2) · Confunde
- Tela: `/veterinario/paciente/pet-nina/vacinas`
- O que acontece: aplicada a antirrábica, a frase passou a "2 vacinas atrasadas", mas a pílula da
  aba seguia "3" e o contador "Pendências 20" do menu também.
- Correção: aplicar e registrar vacina de fora passam pela invalidação do módulo, como as outras
  mutações (`AplicarVacinaDialog.vue` e `VacinaExternaDialog.vue`, `clinico.invalidarTudo()`).
- Conferido: 1440: aba "Vacinas 2", frase "2 vacinas atrasadas", menu "Pendências 19".

### V-19 · Botão "Ligar" (tel:) em Tratamentos em casa · Incomoda
- Tela: `/veterinario/tratamentos` (Pendências > Tratamentos em casa)  ·  1440
- O que acontece: o cartão da Duna trazia "Ligar" (link `tel:`) ao lado de "Abrir a ficha".
- Por que pesa para quem usa: regra da casa: a clínica liga pelo telefone do cadastro (que já está
  na linha "Canina · Eduardo Bittencourt · (11) 98411-2299") e a tela só registra o contato, na
  ficha ("Registrar contato").
- Correção: saiu o botão; fica "Abrir a ficha" (`pages/(accounts)/veterinario/tratamentos.vue`).
- Conferido: 1440, claro.

### V-20 · "Salvar contato" não confirma nada · Polimento
- Tela: `/veterinario/paciente/pet-duna/tratamento` > Registrar contato
- O que acontece: salvei "Eduardo comprou nova caixa hoje; volta a dar a dose das 20h". O
  formulário fecha e o alerta "2 doses puladas…" some, sem nenhuma frase de que o contato foi
  registrado (só em "Ver registros").
- Não corrigido: o sumiço do alerta é a resposta pretendida; uma linha "Contato registrado às
  21:10" pede texto novo e cabe numa passada de acabamento da aba.

### V-21 · Internar: rótulos não ligados aos campos e lista de pacientes vazando do diálogo · Incomoda
- Tela: `/veterinario/internacao` > Internar (leito livre)  ·  1440, claro
- O que acontece: o campo "Peso na entrada" não tinha nome para leitor de tela (o `id` caía no
  invólucro; o console acusava "Incorrect use of <label for=FORM_ELEMENT>"); o seletor de paciente
  abria uma lista mais larga que o diálogo (o nome "Maximiliano … · Bartholomeu Constantino de
  Albuquerque Cavalcanti Neto" empurrava a caixa para fora) e usava travessão ("Luna — Marina
  Alves").
- Correção: `input-id` nos três controles, lista com largura máxima e opção que quebra linha,
  separador "·" (`internacao/InternarDialog.vue`).
- Conferido: 1440: "Peso na entrada" nomeado, lista dentro do diálogo, nome longo em duas linhas;
  internei o Maximiliano em R3 ("Insuficiência cardíaca descompensada, edema pulmonar").

### V-22 · Ligar e enviar o boletim retido não atualizava o menu nem o Hoje · Confunde
- Tela: `/veterinario/internacao/int-tofu?aba=boletim`
- O que acontece: depois de "Registrar ligação" e "Enviar ao responsável", o menu seguia
  "Internação 2" e o Hoje seguia com "Boletim de Tofu aguarda contato com o responsável" até
  recarregar.
- Correção: as duas ações passam pela invalidação do módulo (`stores/internacao.ts`,
  `registrarLigacao` e `enviarBoletim`), como já faziam dose, evolução, alta e internar.
- Conferido: 1440: "Internação 2" virou "Internação 1" ao registrar a ligação.

### V-23 · Exemplo de campo que parece texto já preenchido · Confunde
- Tela: atendimento > Anamnese ("Há quanto tempo": "3 dias"); internado > Evolução ("Comeu toda a
  ração e urinou duas vezes.", "Dor controlada. Sem sinais novos.", "Manter analgesia e reavaliar
  às 22h."); Encerrar internação ("Repouso por 3 dias, ração úmida…")
- O que acontece: o texto de exemplo é uma frase clínica plausível em cinza médio (#6B7280 contra
  a tinta #1D3557). No plantão, com pressa, lê-se como evolução já registrada.
- Correção: todos ganharam o prefixo de exemplo que o próprio prontuário já usa ("Ex.: alergia a
  amoxicilina"): "Ex.: 3 dias", "Ex.: comeu toda a ração…", "Ex.: repouso por 3 dias…" (e "e.g.",
  "Ej.:", "Npr.:", "مثال:" nos outros idiomas).
- Conferido: 1440, claro.

### V-24 · Travessão em texto de interface do veterinário · Polimento
- Tela: prescrição ("…por 5 dias — 15 administrações."), checklist ("Cai na troca de plantão —
  combine quem dá…"), passagem de plantão ("…combinar quem dá — quem sai ou quem entra.")
- Correção: trocados por vírgula e dois-pontos nessas três frases, nos idiomas que tinham o
  travessão.
- Não corrigido: outras 16 frases das telas do veterinário ainda têm travessão (lista em
  Propostas); muitas são de documento impresso, onde a decisão é de diagramação.

### V-25 · No tablet o histórico abria em cima da anamnese em quase toda consulta · Incomoda
- Tela: `/veterinario/atendimento/<id>`  ·  768x1024 com toque (e 1024)
- O que acontece: o histórico abre sozinho no "retorno", mas "retorno" era qualquer paciente com
  consulta anterior. No tablet a coluna empilha em cima da folha: no Maximiliano a "Queixa
  principal" ficava a 1.354 px do topo, atrás da capa (690 px), do trilho e do histórico.
- Correção: retorno passou a ser o horário marcado do tipo Retorno com consulta anterior; nas
  outras consultas o histórico começa recolhido em tela estreita ("Mostrar histórico")
  (`[encounterId].vue`, `ehRetorno`). Em 1280+ nada muda (abre ao lado).
- Conferido: 768x1024 toque, escuro: "Queixa principal" a 1.080 px, histórico recolhido.

### V-26 · Árabe: ícone de peso e de responsável por cima do texto na capa do paciente · Incomoda
- Tela: capa do atendimento, da ficha e do internado  ·  1440, claro, `ar`
- O que acontece: o ícone usa `inset-inline-start` (vai para a direita no árabe), mas o respiro
  era físico à esquerda: "Camila Fer[ícone]" e "6.[ícone]" sobrepostos.
- Correção: respiro lógico (`padding-inline`) nos dois tamanhos da capa (`FichaCabeca.vue`).
- Conferido: 1440, `ar`: ícone e texto lado a lado, medidos sem sobreposição.

### Conferido sem achado
- Rascunho local: com a rede caída, uma recarga do Vite derrubou a página no meio da conduta; ao
  voltar apareceu "Há texto não salvo neste navegador" e "Restaurar rascunho" devolveu "Gelo local
  10 min, 3x ao dia." e gravou ("Salvo às 21:24").
- Segundo dispositivo (simulado pelo painel): faixa "Somente leitura · Em edição por Recepção ·
  Chrome", campos travados, "Assumir a edição" pede confirmação e devolve a edição. Não abri uma
  segunda aba de verdade: pedido de poupar o navegador do usuário.
- Teclado: "Digitação rápida" visível ao lado do trilho, "Ver teclas" abre o mapa; Enter avança
  campo, 1 a 9 escolhem no grupo, Alt+→ troca de etapa, "/" abre os trechos prontos e não briga
  com a digitação (Esc fecha e o "/" fica no texto).
- Dose atrasada com falha (`internacao.administrar` a 100%): "O registro não foi salvo. Tente de
  novo." e a dose continua atrasada; com a rede de volta, checa e o menu cai de 2 para 1.
- Busca de atendimentos ("displasia", 11 resultados) e bulário ("vômito": Ondansetrona e
  Maropitant; dose por espécie com "Contraindicado nesta espécie" em roedor).
- Tema escuro (Hoje, prontuário): contraste medido do aviso "Sem conexão…" 13,6:1 e da trava da
  receita 11,4:1.
- Ditado/escuta ("Gravar consulta"): não testado, o navegador de automação não tem microfone.

## Compartilhado (para a casca/base)

- `src/components/ui/UiPagina.vue`: o slot `#destaque` desenha antes dos dados (o "Carregando" só
  troca o corpo). Corrigi no Hoje com esqueleto próprio (V-06); outras telas que usam `#destaque`
  com números podem ter o mesmo "zero" piscando.
- `src/features/clinico/components/pacientes/PacientePreview.vue` (frente Clínica): mesma linha de
  "Castrado" para fêmea de V-09. Troca de uma linha: ``t(`clinico.paciente.${valor.castrado ?
  'castrad' : 'inteir'}${valor.sexo === 'femea' ? 'a' : 'o'}`)`` (chaves já criadas nos 6 idiomas).
- Edições pequenas em pasta da frente Clínica, só usadas pelas minhas telas ou pela capa delas:
  `pacientes/ficha/FichaCabeca.vue` (V-04, V-09, V-26), `base/ClinicPatientHeader.vue` (V-09, uma
  linha), `vacinas/AplicarVacinaDialog.vue` e `vacinas/VacinaExternaDialog.vue` (V-17, V-18),
  `stores/receitas.ts` e `stores/internacao.ts` (V-07, V-22).
- Tela de entrada: "Bem-vindo de volta" (forma masculina para todos). Da frente Parceiro.
- Console do prontuário: "Incorrect use of <label for=FORM_ELEMENT> (count: 7)". Corrigi os do
  diálogo de internar; os do prontuário vêm de `ClinicField` com `Select`/`InputNumber` recebendo
  `:id` em vez de `:input-id` em outros formulários.

## Fora do portal (API, CMS, app)

Nada. Todas as telas desta frente são mocadas no front neste branch; as chamadas reais vistas
(`/usuario/allInformations`, `/parceiro/portal/dashboard`, `/parceiro/portal/status`) voltaram 200.

## Propostas (mudanças maiores, não implementadas)

1. **Vacina de agente vivo no catálogo.** Marcar no catálogo quais vacinas são de agente vivo e,
   com paciente imunossuprimido ou gestante, trocar o aviso de V-17 por trava com confirmação
   explícita, como a alergia na prescrição.
2. **Capa compacta no prontuário em tablet.** Em 768 a capa do paciente ocupa 690 px antes do
   trilho. No prontuário, que já tem a barra fixa com nome, alertas e passos, a capa poderia nascer
   recolhida (nome, alertas, peso numa linha) em tela até 1024.
3. **Travessões restantes** (telas do veterinário): `internacao.evolucao.observadoDica`,
   `internacao.boletim.ligacaoPendente`, `internacao.prescricao.continuo`, `.suspensaEm`,
   `.doseExemplo`, `internacao.leitos.recusa.tem-historico`, `prontuario.impressao.dica`,
   `prontuario.preConsulta.pesoInformado`, `bulario.cuidado.{gestante,lactante,filhote,idoso}` e os
   carimbos dos documentos impressos (`documentos.receita.via.*`, `atestado.viagem.*`,
   `termo.eutanasia.carimbo`, `orcamento.carimbo`).
4. **Contato registrado na aba Tratamento** (V-20): uma linha "Contato registrado às 21:10 por …"
   no lugar do alerta que some.
5. **Escuta com tutor na sala**: validar "Gravar consulta" num navegador com microfone; não coube
   nesta rodada.

## Dados criados (para a apresentação)

Tudo mocado: some no recarregamento completo (e o Vite recarregou várias vezes durante a rodada).
Para refazer na hora da apresentação:

- **Nina** (atendimento `enc-apt-alergia`): diagnósticos Displasia coxofemoral e Linfadenomegalia
  reativa, alergia à dipirona confirmada na prescrição, conduta com "Gelo local 10 min, 3x ao
  dia.", atendimento finalizado e resumo entregue no app; antirrábica aplicada (lote RAB-2503) na
  carteira.
- **Maximiliano** (`enc-apt-ancora-21`): anamnese "Tosse seca à noite e cansaço em passeios
  curtos", 10 dias, piorando, história com pimobendan; internado em R3 (Atenção), motivo
  "Insuficiência cardíaca descompensada, edema pulmonar", diagnóstico "Doença mixomatosa da valva
  mitral, estágio C".
- **Duna** (tratamento): contato registrado "Eduardo comprou nova caixa hoje; volta a dar a dose
  das 20h".
- **Internação**: Tramadol das 18:13 da Cacau checado; ligação do boletim do Tofu registrada e
  boletim enviado; alta do Bento com "Repouso em espaço restrito por 30 dias, sem escadas.
  Meloxicam por mais 5 dias. Retorno em 10 dias para retirar pontos."

## Verificação final (vitest, i18n, eslint/oxlint, type-check: comando e resultado)

- `npm run check:i18n`: "paridade OK".
- `npx vitest run src/features/clinico`: 66 arquivos, 939 testes, todos passam (inclui o spec novo
  `stores/__tests__/prontuario.spec.ts`, 3 testes, e o caso novo de `receitas.spec.ts`).
- `npx oxlint` e `npx eslint` nos 21 arquivos tocados: sem erro nem aviso.
- `npx prettier --write` só no spec novo (os outros arquivos tocados já estavam fora do prettier
  no HEAD).
- `npm run type-check`: 1 erro, fora desta frente: `src/pages/(accounts)/hotel/mapa.vue(124,41)`
  ("Property '$el' does not exist", frente Hotel). Nenhum nos arquivos do veterinário.
