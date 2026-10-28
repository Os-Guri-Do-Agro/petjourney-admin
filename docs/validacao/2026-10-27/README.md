# Validação de uso real do portal (27 e 28/10/2026)

O portal foi usado do jeito que um parceiro usaria num dia de trabalho, em quatro frentes, cada
uma com uma persona. Cada achado foi anotado, corrigido e conferido na tela (1440, 1280, 1024 e
768 com toque, claro e escuro; árabe nas telas principais). Branch `validacao/uso-real`, sem commit.

| Frente | Persona | Relatório |
| --- | --- | --- |
| Parceiro | Helena Prado, dona da empresa: cadastro, aprovação, portal, configurações, idiomas | [parceiro.md](parceiro.md) |
| Clínica | Recepção e gerência: agenda, pedidos online, fila, faltas, pacientes, vacinas, estoque, relatórios | [clinica.md](clinica.md) |
| Veterinário | Plantonista: Hoje, prontuário, receita, dose, documentos, internação, bulário | [veterinario.md](veterinario.md) |
| Hotel | Gerente do hotel e creche: painel, reservas, pedidos online, check-in/out, rotina, mapa, resumo | [hotel.md](hotel.md) |

## Contas para conferir

Todas na API de dev, senha `Aurora@2026`. Os e-mails são `@example.com` de propósito: o domínio é
reservado para teste e nenhum e-mail chega a um desconhecido (por isso "esqueci a senha" não chega).

| Quem | E-mail | O que tem |
| --- | --- | --- |
| Helena Prado (dona) | `helena@clinica-aurora.example.com` | Empresa **Aurora Clínica e Hotel Veterinário**, aprovada no CMS com os programas Afiliado e Participativo; chave PIX (CNPJ da empresa); código de indicação UBB775; acesso ao prontuário da Paçoca vinculado em Acessos |
| Rafael Moura (veterinário) | `rafael@clinica-aurora.example.com` | Conta criada; convite da Aurora pendente (ver P-26) |
| Camila Rocha (tutora) | `camila.tutora@clinica-aurora.example.com` | Cachorra Paçoca, compartilhada com a Aurora (código 760039) |

**Paçoca, para a apresentação (28/10), tudo em inglês.** Foto (o recorte do Wikimedia Commons já
usado no módulo clínico, CC BY-SA 3.0, crédito em `public/demo/pacientes/CREDITOS.md`), nascimento
14/03/2021, microchip, 3 alergias, 3 diagnósticos, 3 tratamentos contínuos, 5 vacinas, 4 doses de
remédio, 4 pesagens, 4 consultas, 4 registros de diário (um com foto), 4 documentos com arquivo
(carteira de vacinação, hemograma, laudo do raio-X de quadril, receita; clínica e laboratório
fictícios) e a ficha de emergência do QR liberada. Acesso completo para a Aurora, **código 233252**,
as 10 categorias, válido até **27/11/2026** (30 dias é o teto do produto: depois disso a Camila cria
outro). No portal, duas anotações em inglês: retorno da dermatologia (Dr. Helena Prado) e
reavaliação do quadril com o medo de barulho (Dr. Rafael Moura). Uma terceira, a primeira versão
incompleta da dermatologia (13:01), foi enviada por engano pela automação e não tem como ser apagada.
O acesso antigo, de 7 dias (código 760039), vence em 03/11.

Clínica e Hotel são módulos de demonstração neste branch (ligar com `?clinico=on&hotel=on`): os
dados vêm da semente e o que se grava some ao recarregar a página. Os relatórios de cada frente
listam o que foi criado, para refazer numa apresentação.

## Números

| Frente | Achados | Bloqueia | Confunde | Incomoda | Polimento | Corrigidos |
| --- | --- | --- | --- | --- | --- | --- |
| Parceiro | 32 | 2 | 13 | 8 | 9 | 29 |
| Clínica | 33 | 3 | 17 | 4 | 9 | 28 |
| Veterinário | 26 | 5 | 8 | 8 | 5 | 24 |
| Hotel | 31 | 7 | 14 | 4 | 6 | 31 |
| **Total** | **122** | **17** | **52** | **24** | **29** | **112** |

Mais 10 correções na casca e na base, juntando o que as frentes deixaram em "Compartilhado"
(seção abaixo).

## Os 17 que impediam o trabalho (todos corrigidos, menos P-26)

- **P-01** Errar a senha atual em Segurança desconectava a pessoa.
- **P-26** Convite de equipe não tem como ser aceito pelo portal neste branch. *Já resolvido na
  branch de integração (`029f29c`, E0-01); falta chegar ao develop.*
- **C-01** Atendimento que começa no almoço ou na reunião sumia da Agenda.
- **C-04** Digitar no diálogo disparava os atalhos da Agenda ("Rita" virava "ita" e trocava a vista).
- **C-31** Falha ao salvar apagava a Agenda e a Fila, e o diálogo ficava mudo.
- **V-01** Texto digitado durante o salvamento automático sumia do campo.
- **V-02** Uma gravação que falha trocava o prontuário inteiro por "Não foi possível carregar".
- **V-03** Finalizar com texto não gravado fechava o atendimento sem ele.
- **V-07** "Assinar e emitir" assinava receita de remédio ao qual o paciente é alérgico.
- **V-10** O atestado de saúde dizia "sem alterações clínicas" com achado no exame.
- **H-10** Depois de "Registrar ligação" o boletim seguia retido e o Enviar, apagado.
- **H-11** O check-out não via a pesagem nem o último pertence conferido.
- **H-18** Não havia como mudar datas, prorrogar ou trocar a acomodação de uma reserva.
- **H-19** Dava para tirar de operação uma acomodação com reserva marcada.
- **H-22** As telas do hotel não viam a mudança depois de uma ação (o mock devolvia o próprio objeto).
- **H-23** O check-out cobrava um valor e gravava outro.
- **H-25** Publicar a rotina "Agora" depois das 20h valia só para amanhã (relógio em UTC).

## Casca e base (consolidação)

- Botão de perigo cheio com texto branco sobre o vermelho pastel: 2,09:1. Agora tinta escura,
  5,91:1, também dentro dos diálogos da clínica (`moldura-app.css`).
- Toast de erro e de atenção saía igual ao de sucesso. Voltaram a ter ícone, na cor do estado;
  sucesso e informação seguem só no texto (`assets/main.css`).
- Esc não fechava diálogo nem gaveta com o foco num Select fechado (o Select do PrimeVue 4.5 engole
  a tecla). Ajuste único na entrada do app, com teste (`theme/primevue-esc-do-select.ts`).
- "Criar → Agendamento" de dentro da ficha de um paciente já traz o paciente escolhido.
- A barra "X de Y atendimentos feitos hoje" do Início contava as faltas e nunca chegava a 100%.
- Aviso "Sua sessão terminou" aparece uma vez só quando várias chamadas voltam 401 juntas.
- Estado de erro de página repetia a frase no título e na descrição: título agora "Algo deu errado".
- 12 campos da internação ligavam o rótulo à caixa externa do Select (aviso de acessibilidade).
- Período do hotel com "→" apontava para o lado errado em árabe.
- Bloquear horário na Agenda agora confirma com "Horário bloqueado: 12:00 às 13:00." (fecha C-09).
- Comprovante do hotel vinha com a data de hoje enquanto a dica dizia "não a de hoje": começa vazio,
  e só registra com a data da carteira (complemento do H-04, conferido na reserva do Zeus).
- Sem travessão nos textos da Clínica, do Veterinário e do Hotel (pt, en, en-GB, es); dois textos
  do espanhol estavam em português; "Novo por aqui?" virou "Ainda não tem conta?".

## O que ficou aberto

Decisão de produto:
- **Selo "Dados de exemplo"** na Clínica e no Hotel: um parceiro recém-aprovado vê pacientes e
  hóspedes de demonstração sem nada que diga que são exemplo. O selo também apareceria nas
  capturas da apresentação, por isso não foi posto.
- **P-31** O Programa Participativo é descrito de dois jeitos (cadastro e tela de Programas).
- **C-21** Faltas a justificar não entram no número de Pendências do menu: entram, e com que tom?
- **C-14** A página pública `/agendar` (e `/reservar`) mostra a clínica da demonstração, não a Aurora.

Funcionalidade nova (nas Propostas de cada relatório):
- **C-11** Remarcar para outro dia (hoje só se arrasta dentro do dia).
- **V-20** "Salvar contato" na aba Tratamento não confirma nada.
- Hotel: cadastrar animal novo dentro da reserva de balcão; registrar a devolução do crédito de
  saída antecipada; cabeçalho da reserva com seis ações quebra em três linhas no tablet.

Achados desta consolidação, não corrigidos:
- **Novo atendimento começa num horário bloqueado.** Aberto pelo "Criar" ou pelo botão, o formulário
  propõe o próximo quarto de hora mesmo quando ele cai num bloqueio ("Manutenção" no Consultório 1)
  e o botão vira "Agendar mesmo assim". Proposta: avançar até o primeiro horário livre do
  profissional e da sala quando nenhum horário veio do clique na grade
  (`AgendaCriarDialog.vue`, `primeiroHorario`).
- **Fundo de "continua" parece cartão vazio.** O atendimento longo que atravessa o almoço desenha
  um bloco branco sem texto na faixa do almoço (coluna da Helena Vasconcelos, 12:30).
- **Gaveta em árabe** abre à direita, como no português; deveria abrir do lado de início da leitura.
  Vale para todas as gavetas do portal.
- `C-33` (domingo fechado mostra a grade vazia com a dica de marcar) e `C-34` (pequenos).

Não testado: o ditado do prontuário ("Gravar consulta"), porque o navegador automatizado não tem
microfone; o aceite do convite de equipe (P-26); saque com saldo de verdade.

## Fora do portal

API (detalhes, com rota e corpo, em [parceiro.md](parceiro.md#fora-do-portal-api-cms-app)):
- Aceita qualquer chave PIX (`"abc"` → 200). O portal agora valida, mas a API deveria recusar.
- Senha atual errada responde 401, o código de sessão inválida; 400/422 seria o certo.
- Aviso da indicação sem acento e só em português, mesmo com `Accept-Language`.
- `POST /pet` devolve 500 com `dataNascimento` e alergias; erro de validação deveria ser 400.
- Limite de 60 pedidos por minuto por conta fica apertado com várias abas ou pessoas.

CMS:
- "Aprovar" na Auditoria aprova na hora, sem confirmação, e não decide os programas junto: foi
  preciso aprovar Afiliado e Participativo de novo em "Solicitações de modos", enquanto o portal
  promete "Credenciamento e programas são decididos na mesma revisão".
- O contador "Aprovados" ficou em 0 depois da aprovação.
- "Solicitações de modos" mostra 0 / 0 / 0 e lista vazia durante a carga, sem indicador.
- Texto de desenvolvedor na tela: "Lista montada via GET /parceiro filtrando status SOLICITADO no
  cliente."
- "Bem-vindo de volta!" no login e o X do toast em inglês ("Close").

## Verificação final (28/10, 10h40)

- `npm run type-check`: sem erros.
- `npm run check:i18n`: paridade OK nos 6 idiomas.
- `npx vitest run`: 1768 de 1772 passam. Os 4 que falham (`seed.spec`, `cenario-do-responsavel`
  ×2, `projecao-do-responsavel`) dependem da hora e falham igual no develop sem nenhuma mudança
  (conferido numa cópia do HEAD).
- eslint e oxlint limpos nos arquivos tocados (um erro antigo do HEAD em
  `hospedagem-repository.ts:847`, variável sem uso, ficou como estava).
- Prettier só nos arquivos que já estavam formatados no HEAD, para não inflar o diff.
