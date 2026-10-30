# Frente Veterinário: validação de uso real (29/10/2026)

Persona e roteiro: fui a veterinária plantonista da Aurora Clínica e Hotel Veterinário, logada como
Helena (`helena@clinica-aurora.example.com`), com Clínica e Hotel ligados. Para ter o dia cheio,
abri as telas com o relógio da página às 10:40 (o truque da sessão de captura); parte foi vista no
horário real, à noite. Fiz atendimentos inteiros do começo ao fim: Jack (claudicação, pelo teclado,
com "Digitação rápida"), Nina (alergia a dipirona e quimioterapia: troca de remédio, receita,
assinatura, todos os 15 documentos impressos e lidos) e Maximiliano (o que já estava na sala).
Usei também o Hoje do veterinário, a finalização e o próximo paciente, o seletor do bulário, a
internação (painel, checklist, prescrição) e a janela "Gravar consulta" (sem microfone: só abri e
fechei, a tela não quebra). Tamanhos: 1440x900 e 768x1024 com toque. Temas: claro e escuro.
Idiomas: pt em tudo, ar no exame físico. Contraste medido por script (cor do texto contra as
camadas de fundo compostas).

Resumo: 29 achados. Bloqueia 3, Confunde 11, Incomoda 3, Polimento 12. Corrigidos e conferidos:
26 (25 na frente e V-28 no fechamento). Não corrigidos: 3 (V-26, V-27 e V-29).

Correções antigas conferidas e valendo: V-01, V-02 e V-03 de 27/10 (os três casos do
`prontuario.spec.ts` passam: texto digitado durante a gravação, rede caída, finalizar sem
gravar), V-07 (com a caixa desmarcada, "Assinar e emitir" apagado e "Confirme a alergia na
prescrição para assinar."), V-10 (o atestado de saúde da Nina declara "tendo registrado no exame:
Locomotor: Dor à extensão do quadril direito."), V-08 (conta com vírgula e unidade), V-09
("Fêmea · Castrada"), V-14 (botão "Iniciar consulta"), V-16 ("Ver histórico" sem número) e V-23
("Ex.: 3 dias"). O nome da Aurora e o endereço sem travessão (C-09 e C-10 da frente Clínica)
saem em todos os documentos.

## Achados

### V-01 · Trocar o remédio no campo mantinha a dose e a conta do remédio anterior · Bloqueia
- Tela: atendimento, etapa Conduta (Nina)  ·  Largura/tema: todas
- O que acontece: a Nina é alérgica a dipirona; troquei a Dipirona (20 mg/kg a cada 8 h) por
  Meloxicam no campo "Medicamento". O mg/kg, a frequência e a quantidade ficaram: "128 mg ÷ 2 mg/mL
  = 0,26 mL por administração" (a conta certa daria 64 mL) e "0,26 mL (128,0 mg) a cada 8 h". Cem
  vezes a dose de meloxicam, com o volume errado, e só um selo pequeno "Acima da dose usual".
- Por que pesa para quem usa: trocar o remédio que bateu na alergia é exatamente o que a tela
  pede; a receita sairia com um número que não corresponde a nenhuma conta.
- Correção: o campo passa pelo mesmo caminho da troca pelo bulário: dose sugerida da espécie,
  intervalo e duração do remédio novo e a conta refeita
  (`components/prontuario/ProntuarioConduta.vue`, `trocarMedicamento` e `aplicarMedicamento`).
- Conferido: 1440, claro: "6,4 kg × 0,1 mg/kg = 0,64 mg", "0,64 mg ÷ 2 mg/mL = 0,32 mL",
  "0,32 mL (0,64 mg) a cada 24 h por 5 dias".

### V-02 · Digitação rápida apagava o peso e o marcava como não aferido · Bloqueia
- Tela: atendimento, Exame físico  ·  todas
- O que acontece: com "Digitação rápida" (Enter avança campo), "8,3 Enter 38,6 Enter": o primeiro
  Enter levava ao botão "não medir" do peso, o 38,6 se perdia e o segundo Enter apertava o botão.
  O peso sumia e o campo virava "não aferido". O peso é o que alimenta toda dose da conduta.
- Por que pesa para quem usa: é o modo feito para não tirar a mão do teclado, e ele apaga dado
  clínico em silêncio.
- Correção: "não medir" sai do avanço por Enter (continua no Tab) (`ProntuarioExameFisico.vue`,
  `data-fora-do-teclado`).
- Conferido: 1440, claro: os sete vitais preenchidos com número e Enter, um atrás do outro
  ("8,3 kg | 38,6 °C | 112 bpm | 24 mpm | 1,5 s | 5/9").

### V-03 · Receituário e orientações imprimiam o remédio da alergia sem o aceite · Bloqueia
- Tela: atendimento, etapa Resumo > Documentos (Nina)  ·  todas
- O que acontece: com a caixa "Confirmo e quero prescrever assim mesmo" desmarcada, "Assinar e
  emitir" fica apagado (V-07 de 27/10), mas "Imprimir" do Receituário soltava a folha com a
  Dipirona e a linha de assinatura em branco, e as Orientações mandavam o responsável dar "0,26 mL a
  cada 8 h". O próprio resumo diz "Prescrição de Dipirona ... sem aceite".
- Por que pesa para quem usa: receita impressa e assinada à mão vale na farmácia; dipirona se
  compra sem receita. A trava existia num botão e não no outro.
- Correção: com alergia sem aceite, Receituário e Orientações ficam à vista com "Imprimir" apagado e
  a frase "Confirme a alergia na prescrição para imprimir." (`ProntuarioResumo.vue`, `travado`;
  chave `clinico.documentos.cartao.receituarioAlergia` nos 6 idiomas).
- Conferido: 1440 claro e escuro (frase a 11,5:1 no escuro); ao marcar a caixa, os dois voltam.

### V-04 · Receita assinada continuava "pronta para enviar" depois de a prescrição mudar · Confunde
- Tela: atendimento, Conduta > Receita  ·  todas
- O que acontece: assinei o meloxicam a cada 24 h e depois mudei para 12 h. A prévia "Como o
  responsável vê" passou a dizer 12 h, e a linha "Assinada eletronicamente ... Enviar ao
  responsável" continuou igual. O envio mandaria a versão de 24 h (a receita congela ao assinar,
  de propósito), sem nenhum aviso na tela.
- Por que pesa para quem usa: duas versões da mesma receita na mesma tela, e o botão manda a que
  não está à vista.
- Correção: assinatura que não bate mais com a prescrição diz "A prescrição mudou depois desta
  assinatura. Assine de novo para enviar a versão atual." e perde o "Enviar ao responsável"
  (`stores/receitas.ts`, `divergeDaConduta`, com teste em `receitas.spec.ts`;
  `ProntuarioReceita.vue`, `desatualizada`; chave `clinico.receita.desatualizada` nos 6 idiomas).
- Conferido: 1440 claro (5,1:1) e escuro (9,7:1); ao assinar de novo, só a nova oferece o envio.

### V-05 · Demonstração clinicamente incoerente (inclui os pontos da frente Clínica) · Confunde
- Tela: histórico do atendimento, ficha, Relatórios, documentos  ·  todas
- O que acontece: o diagnóstico era sorteado do catálogo inteiro e o resto não conversava com ele.
  Vi: "Cistite idiopática felina" em cadela (Açaí); Jack com displasia tratada com prednisolona e
  furosemida a cada 8 h; Maximiliano com displasia e maropitant "a cada 12 h"; a Nina, alérgica a
  dipirona, com "Dipirona 139,1 mg a cada 24 h" no histórico; todo exame com "Dor à palpação em
  abdome cranial" e o cardiovascular normal na doença da mitral; a queixa principal era o nome da
  doença. O intervalo era sorteado entre 8, 12 e 24 h, e o remédio podia ser um que o próprio
  bulário proíbe na espécie (carprofeno em gato, amoxicilina oral em roedor).
- Por que pesa para quem usa: uma veterinária lê a ficha e conclui que o sistema é de brinquedo.
- Correção: cada diagnóstico tem um perfil (espécies, raças quando importa, queixa do jeito que o
  responsável conta, achado do exame no sistema dele, febre ou não, remédios que tratam o caso);
  dose, intervalo e duração saem da linha da espécie no bulário; fica de fora remédio sem dose,
  proibido ou que bate em alergia; ave, roedor e equino recebem vitais da faixa deles; o
  "check-up sem alterações" sai sem remédio e sem diferencial (`data/seed.ts`, `PERFIS`,
  `encounterPreenchido`, `montarPrescricoes`, `vitalTipico`). Quatro testes novos em
  `dataset-completo.spec.ts` (espécie, dose da espécie sem alergia, queixa, id único), rodados às
  8 h, 15 h e 22 h.
- Conferido: 1440, claro: Jack "Dermatite alérgica a pulgas: Prednisolona 6,32 mg a cada 24 h por
  5 dias"; Nina "Doença mixomatosa da valva mitral: Furosemida 16,77 mg a cada 12 h por 30 dias".
- Ficou: o volume por paciente (C-20 da frente Clínica) continua, por exemplo a Nina com quatro
  consultas em quatro dias.

### V-06 · Depois das 16:00 o caso da alergia abria um prontuário sorteado · Confunde
- Tela: `/veterinario/atendimento/enc-apt-alergia`  ·  todas, depois das 16:00
- O que acontece: depois da hora da consulta, o atendimento plantado da Nina está "finalizado" na
  agenda e podia ganhar também um prontuário sorteado com o mesmo id. A rota abria o sorteado,
  finalizado e sem a dipirona: o caso difícil da demonstração sumia, conforme a hora. Apareceu ao
  rodar os testes à noite.
- Correção: a consulta da alergia não entra no sorteio (`data/seed.ts`, laço de `rngEncounter`).
  Teste novo "cada prontuário tem um id só, a qualquer hora".
- Conferido: testes às 8 h, 15 h e 22 h; a rota abre o rascunho com a dipirona.

### V-07 · Comprovante de vacinação sem ano: "Próxima dose" igual à data aplicada · Confunde
- Tela: Resumo > Outros documentos > Comprovante de vacinação  ·  impressão
- O que acontece: "24/07 Giárdia ... 24/07", "16/06 V10 ... 16/06": a próxima dose era a do ano que
  vem e a data saía sem ano, idêntica à da aplicação. A V10 e a antirrábica de 2025 pareciam deste
  ano.
- Por que pesa para quem usa: é documento que vai para o responsável, para viagem e para o hotel.
- Correção: data com ano nas duas colunas (`DocumentoVacinacao.vue`, `dataCurtaComAno`).
- Conferido: folha lida na página: "24/07/2026 Giárdia ... 24/07/2027", "16/06/2025 V10 ...
  16/06/2026".

### V-08 · Digitação rápida: Enter no grupo apagava a resposta e não avançava · Confunde
- Tela: Anamnese (Evolução) e Exame físico (mucosas, desidratação, sistemas)  ·  todas
- O que acontece: "1" marcava "Piorando" e o Enter seguinte clicava de novo na opção, que se
  desmarcava; o foco ficava parado. Nos grupos que não se desmarcam, o Enter não fazia nada.
- Correção: no grupo, o Enter avança para o próximo campo (`useProntuarioTeclado.ts`).
- Conferido: 1440: anamnese inteira pelo teclado; exame com "1 Enter" nos oito sistemas, "2 Enter"
  no locomotor, a nota e de volta aos grupos.

### V-09 · Antecedente: Enter adicionava sem o "Quando" e a data ficava órfã · Incomoda
- Tela: Anamnese > Antecedentes  ·  todas
- O que acontece: Enter na descrição já adicionava, sem data; o foco caía no "Quando" da linha
  nova e a data digitada ficava lá, sem antecedente.
- Correção: Enter na descrição vai para o "Quando"; Enter no "Quando" adiciona e volta à
  descrição (`ProntuarioAnamnese.vue`, `enterNaDescricao`, `enterNoQuando`).
- Conferido: 1440: "Hemilaminectomia T13-L1 ... 19/10/2026" numa linha só.

### V-10 · Nota do sistema alterado com 130 px · Incomoda
- Tela: Exame físico > Sistemas  ·  1440 com o histórico aberto
- O que acontece: a nota ficava na sobra da linha; "Dor à extensão do quadril esquerdo, sem
  crepitação; teste de gaveta negativo" se lia como "aveta negativo".
- Correção: a nota desce para baixo da escolha e vai até a borda (`ProntuarioExameFisico.vue`,
  `.sistema__nota`).
- Conferido: 1440 claro (475 px) e 768 escuro (662 px).

### V-11 · Atestado de comparecimento "das 16:00 às 16:00" · Confunde
- Tela: Resumo > Atestado de comparecimento, e a linha dele na lista  ·  impressão
- O que acontece: com o atendimento aberto, a saída era a hora de abertura: visita de zero minuto.
- Correção: aberto, a saída é a hora em que a folha sai (`DocumentoAtestado.vue`, `saida`;
  `ProntuarioResumo.vue`, detalhe da linha).
- Conferido: folha lida: "das 16:00 às 20:16".

### V-12 · "Na sala há 55 min" no Hoje e "Atendimento aberto às 10:40" no prontuário · Confunde
- Tela: Hoje > Continuar atendimento (Maximiliano)  ·  todas
- O que acontece: o prontuário criado no clique ficava com a hora do clique, não com a de entrada
  na sala; a mesma hora ia para o atestado de comparecimento.
- Correção: o registro nasce com a hora em que o atendimento começou
  (`data/repositories/encounter-repository.ts`, `abrir`).
- Conferido: 1440, 10:40: "Atendimento aberto às 09:45".

### V-13 · "Hidratação: Leve / Moderada / Grave" · Confunde
- Tela: Exame físico > Perfusão; prontuário impresso  ·  todas
- O que acontece: o campo mede desidratação, mas o rótulo dizia "Hidratação" com "Leve": no papel,
  "Hidratação: Leve" lê como o contrário.
- Correção: "Desidratação: Ausente / Leve / Moderada / Grave" (e en, es, sr, ar) nos 6 idiomas.
- Conferido: 1440 claro, 768 escuro, ar ("الجفاف: لا يوجد / خفيف / متوسط / شديد").

### V-14 · "7 de 7 aferidos" com a pressão não aferida · Polimento
- Tela: Exame físico e passo do exame  ·  todas
- Correção: conta só o que foi medido (`ProntuarioExameFisico.vue`, `aferidos`;
  `[encounterId].vue`, passo do exame).
- Conferido: 1440: "6 de 7 aferidos" com a pressão em branco.

### V-15 · Internação: "1 administradas", "5 administradas" para medir diurese, "por {quem prescreveu}" · Confunde
- Tela: internado > Prescrição (Tofu)  ·  todas
- O que acontece: "Medir diurese e anotar volume · 5 administradas · por Helena Vasconcelos Prado"
  lê como se a Helena tivesse administrado cinco diureses; "Maropitant · 1 administradas".
- Correção: remédio e fluido contam "administradas" com plural; monitoramento e alimentação contam
  "registros"; "prescrito por {nome}" (`InternacaoPrescricoes.vue`, `textoDasFeitas`; chaves
  `clinico.internacao.prescricao.feitas`, `registradas`, `por` nos 6 idiomas).
- Conferido: 1440: "1 administrada", "5 registros · prescrito por Helena Vasconcelos Prado".

### V-16 · Encaminhamento e relatório para plano: "Peso: 6,4" sem unidade · Polimento
- Correção: o peso leva "kg" (`DocumentoEncaminhamento.vue`, `DocumentoRelatorioPlano.vue`).
- Conferido: folhas lidas: "Peso: 6,4 kg".

### V-17 · Travessão longo em texto visível do veterinário · Polimento
- Onde (o travessão marcado como [t]): catálogo ("Doença renal crônica [t] estágio 2", também
  en/es), interações do bulário (8 em pt, 16 em en/es), doses da internação ("1 mg/kg [t] 0,51
  mL"), diagnóstico e notas da internação, ato "Furosemida [t] primeira dose", folhas ("Uso: Oral
  [t] ...", "Locomotor [t] Dor...", "UR-03 [t] ...", "Meloxicam [t] 0,32 mL") e o travessão
  sozinho de sem valor (queixa, faixa de referência, uso contínuo).
- Correção: vírgula, dois-pontos, parênteses e o "sem valor" da casa (`fixtures/catalogs.ts`,
  `catalog-text.ts`, `medications.ts`, `seed-internacao.ts`, `seed.ts`, documentos,
  `ProntuarioImpressao.vue`, `ProntuarioTimeline.vue`, `ProntuarioConduta.vue`).
- Conferido: telas e folhas lidas; `lint-copy` ok.

### V-18 · Termos: "em razão de Claudicação ... há 3 dias., tendo sido" · Polimento
- Correção: o objeto do termo entra sem o ponto final e com inicial minúscula (menos sigla)
  (`DocumentoTermo.vue`, `noMeioDaFrase`).
- Conferido: "em razão de claudicação em membro pélvico direito há 3 dias, tendo sido".

### V-19 · Orientações: "a cada 12 h , por 3 dias" · Polimento
- Correção: a instrução é montada no script (`DocumentoOrientacoes.vue`, `instrucao`).
- Conferido: "Dipirona sódica 500 mg/mL: 0,26 mL, a cada 8 h, por 5 dias".

### V-20 · Dose por extenso "(0,6 mg)" sob a conta "= 0,64 mg"; "128,0 mg"; aviso "0.1–0.2" · Polimento
- Correção: miligramas com as casas da conta, até duas (`useClinicFormat.ts`, `miligramas`, usado
  na conduta, no resumo, no histórico, no prontuário impresso e no receituário); faixa do aviso de
  dose com vírgula (`ProntuarioConduta.vue`).
- Conferido: "0,32 mL (0,64 mg)", "0,26 mL (128 mg)".

### V-21 · "não medir" quebrando linha em uns vitais e não em outros; escore "5 /9" · Polimento
- Correção: o rodapé do vital tem duas colunas, "não medir" sempre à direita na primeira linha;
  unidade de fração colada ao número (`ProntuarioExameFisico.vue`, `.vital__rodape`;
  `useClinicFormat.ts`, `comUnidade`).
- Conferido: 1440 claro com histórico aberto e 768 escuro: "5/9", "4–5/9", rótulos inteiros.

### V-22 · A busca de diagnóstico oferecia "Cistite idiopática felina" para cão · Polimento
- Correção: o catálogo marca o que só existe numa espécie (cistite idiopática felina, doença
  mixomatosa da mitral) e a busca filtra pela do paciente (`data/types.ts`, `especies`;
  `ProntuarioDiagnostico.vue`; `[encounterId].vue`).
- Conferido: Jack: a lista vai de GE-01 a LO-05, sem UR-07.

### V-23 · Pipoca (0,9 kg): "15 mg/kg [travessão] 0,05 comprimido" com "Manipulado em suspensão" · Confunde
- Tela: internado > Prescrição e Checklist  ·  todas
- Correção: "15 mg/kg (0,27 mL da suspensão de 50 mg/mL)" (`seed-internacao.ts`).

### V-24 · "Atendimento finalizado": "Exame de imagem · espera há 11 mi…" · Polimento
- Correção: a linha do próximo paciente quebra em vez de cortar (`ProntuarioFinalizarDialog.vue`).
- Conferido: 1440: "Vacinação · acabou de chegar à recepção · Ana Ribeiro" inteira.

### V-25 · Prontuário impresso: coluna "referência" em minúscula · Polimento
- Correção: "Referência" no cabeçalho (`ProntuarioImpressao.vue`, `cabecalhoReferencia`).

### V-26 · Banho e tosa abre o prontuário clínico completo · Confunde
- Tela: Hoje > "Pacientes em sala agora" > Continuar atendimento (Maximiliano, banho)  ·  todas
- O que acontece: o primeiro cartão do Hoje é um banho e tosa; "Continuar atendimento" abre
  anamnese com "Queixa principal" obrigatória, exame físico e diagnóstico.
- Não corrigido: o Hoje é compartilhado com a recepção (validado hoje pela frente Clínica) e a
  decisão é de produto. Proposta: no destaque do veterinário, só tipos clínicos; banho e tosa com
  um registro simples (chegada, observações, saída), sem anamnese.

### V-27 · Seletor do bulário em Dialog no meio da tela · Incomoda
- Tela: Conduta > Adicionar medicamento / Escolher no bulário  ·  todas
- Não corrigido: a regra da casa pede gaveta à direita para lista com detalhe; é troca de
  estrutura do `BularioPicker.vue`, maior que esta rodada. Proposta: `Drawer` à direita com a
  lista e a dose por espécie, deixando a prescrição à vista.

### V-28 · "0,66 comprimidos", "0,75 comprimidos" · Polimento
- Correção (fechamento): (1) plural pela parte inteira em português: regra de plural própria do
  `pt` no vue-i18n, que só muda quantidade com decimais ("0,70 comprimido", "1,5 comprimido",
  "2,5 comprimidos"; inteiros seguem como antes) (`src/i18n/plural.ts:60`, `:71`); en e es seguem
  o plural nos decimais, sr e ar já tinham regra própria. (2) `fracionar` devolve também `nome`, o
  nome da quantidade partível, e o `kind` continua `aproximado` para quem decide pela marca (a
  projeção do app) (`src/features/clinico/domain/receita.ts:100`); Conduta, Receita, Orientações e
  o tratamento em casa dizem a fração pelo `nome` (`ProntuarioConduta.vue:662`,
  `ProntuarioReceita.vue:104`, `DocumentoOrientacoes.vue:54`, `useRotulosDoTratamento.ts:61`):
  0,70 vira "Três quartos de comprimido por administração (a conta deu 0,70; confirme o
  arredondamento)". (3) A conta de arredondar ignorava o inteiro: 0,99 virava "três quartos" e
  3,95, "3,75"; agora o inteiro de baixo e o de cima também são candidatos (0,99 é um comprimido;
  zero comprimido nunca é alvo) (`receita.ts:118`). "{inteiros} comprimido inteiro" ganhou plural
  ("2 comprimidos inteiros") nos 6 idiomas; a chave `fracao.aproximado`, sem uso, saiu.
  Testes novos em `domain/__tests__/receita.spec.ts` (nome no aproximado, inteiro como alvo) e
  `src/i18n/__tests__/i18n.spec.ts` (regra do português).
- Conferido: 1440, atendimento da Açaí de 29/10 (`enc-apt-ancora-22`), Conduta da cefalexina:
  "0,7 comprimido por administração", "0,70 comprimido (209,35 mg) a cada 12 h…" e "Três quartos
  de comprimido por administração (a conta deu 0,70; confirme o arredondamento)"; Resumo e
  lembrete do app com "Três quartos de comprimido". Frases conferidas também em en, es, sr e ar
  ("2 cele tablete po dozi", "قرصان كاملان لكل جرعة").

### V-29 · Em ar, en e es, a lista do histórico mostra o diagnóstico em português · Polimento
- Não corrigido: o título do evento da linha do tempo é gravado em português no dado; o cartão
  "Consulta anterior" já traduz pelo código. Proposta: a lista resolver o título pelo
  `codigo` do diagnóstico do atendimento, como o cartão.

### Conferido sem achado
- Bulário: dose por espécie com "deste paciente" e espécie proibida em vermelho; carprofeno para
  o Jack: "8,3 kg × 2 mg/kg = 16,6 mg", fracionamento com aviso de arredondamento.
- Finalizar: "Ainda falta registrar: Pelo menos um diagnóstico", "Finalizar mesmo assim" e o
  diálogo seguinte com o próximo paciente.
- Internação: painel, checklist do Tofu (doses, NaCl 20 mL/h para 5,1 kg, maropitant 0,51 mL)
  coerentes.
- "Gravar consulta": a janela de autorização abre e fecha, sem erro de console.

## Não corrigido

- **V-26 Banho e tosa no destaque do veterinário.** Ver o achado.
- **V-27 Bulário em gaveta.** Ver o achado.
- **V-28 Plural e fração aproximada.** Corrigido no fechamento; ver o achado.
- **V-29 Diagnóstico traduzido no histórico.** Ver o achado.
- Vistos de passagem, sem mexer: o subtítulo "A fazer" do passo a 4,48:1 (fronteira); o passo
  "Resumo" fica "Em andamento" já com a queixa (decisão do domínio, tem teste); o texto branco da
  capa sobre a sálvia a 3,2:1 é o desenho do portal inteiro (`UiAbertura`), não desta frente.

## Fora do portal

- Nada. As telas do veterinário rodam com a semente no front.

## Dados criados (somem ao recarregar)

- Receitas assinadas da Nina (meloxicam). Ficam no armazenamento do navegador de automação, não
  no do Luís.

## Verificação final

- `npx vitest run src/features/clinico src/pages`: 69 arquivos, 975 testes, todos passam (inclui
  4 testes novos em `dataset-completo.spec.ts` e 1 em `receitas.spec.ts`).
- `npm run type-check`: sem erros.
- `npm run check:i18n`: paridade OK. Chaves novas: `clinico.receita.desatualizada`,
  `clinico.documentos.cartao.receituarioAlergia`, `clinico.internacao.prescricao.registradas`;
  mudadas: `clinico.prontuario.exameFisico.hidratacaoRotulo` e `hidratacao.normal` (ar: as quatro
  opções), `clinico.internacao.prescricao.feitas` (pt, es) e `por`.
- `node scripts/lint-copy.mjs src/locales`: ok.
- `npx oxlint` e `npx eslint` nos 30 arquivos tocados: sem erro.
- Prettier: `--write` só em `ProntuarioDiagnostico.vue`, `DocumentoRelatorioPlano.vue` e
  `seed.ts` (formatados no HEAD); os outros formatados no HEAD continuam formatados.
- Arquivos compartilhados editados: os 6 `src/locales/*.json` (trechos pequenos, com Edit).
  Também do módulo e usados pela frente Clínica: `composables/useClinicFormat.ts` (duas funções
  novas e a unidade de fração), `data/seed.ts`, `data/types.ts` (campo opcional) e
  `data/repositories/encounter-repository.ts`.
