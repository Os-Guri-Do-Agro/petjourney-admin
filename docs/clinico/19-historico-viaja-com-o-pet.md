# 19 · O histórico viaja com o pet

O histórico é do responsável e vai junto quando o pet muda de clínica. Ele libera pelo app o que a
clínica nova vê e por quanto tempo, acompanha quem abriu e encerra em dois toques. A clínica que
recebe digita o código no balcão e o paciente novo chega com o histórico completo, cada item com a
origem. Na emergência, o QR da coleira abre uma ficha para quem tem CRMV, com o responsável avisado
na hora.

Card no Nevo: **PJ-QDDJOQ**, quadro de outubro. Protótipo sem API, na camada mocada do módulo.

## Por que existe

Inverte o modelo do mercado: os concorrentes prendem o dado na clínica, nós prendemos no pet. Para o
responsável é argumento de venda. Para a clínica é objeção previsível, e o protótipo responde a ela
mostrando o ganho: paciente novo chegando com alergias, uso contínuo e diagnósticos já na ficha.

## Pronto quando

- [x] **Tela do responsável:** com quem o pet está compartilhado, desde quando, até quando e o que
      cada clínica vê ("Quem vê o histórico", com "Com acesso agora" e "Não veem mais").
- [x] **Conceder acesso a uma clínica nova, com escopo e prazo:** marca o que a clínica vê (alergias,
      medicamentos, diagnósticos, vacinas e peso já vêm marcados; documentos e diário ficam para ele),
      escolhe o prazo e recebe um código de 6 dígitos para mostrar no balcão.
- [x] **Encerrar, deixando claro o que acontece com o que já foi visto:** a confirmação mora na
      própria linha: a clínica deixa de ver na hora, o que ela já viu ou anotou na ficha de lá
      continua lá, e ela não recebe motivo.
- [x] **Vista da clínica que recebe:** "Receber pelo código" confere o código, mostra o pet, quem
      cuida, o que vem e até quando, e diz se o pet já é paciente. Recebido, o paciente nasce e a
      gaveta abre o histórico por categoria, com a clínica e o profissional (com CRMV) de cada item,
      ou "Anotado pelo responsável no app".
- [x] **Quem abriu e quando, legível:** no celular, "Abriu 2 vezes" leva à lista com nome, conselho,
      clínica, o que abriu e quando. Na clínica, a gaveta mostra quem da casa já abriu.
- [x] **Caso difícil: troca de clínica por conflito.** O Eduardo trouxe o Thor e a Clínica
      Veterinária Cuidar, a de antes, ainda vê o histórico e abriu há dois dias. No celular ele
      encerra em dois toques; a Cuidar só fica sabendo que o acesso terminou, sem nome e sem motivo.
- [x] **Caso difícil: emergência sem o responsável por perto.** QR da coleira em dois degraus (veja
      Decisões). O segundo degrau só abre com CRMV, fica registrado e a Renata recebe o aviso no app.
- [x] **Caso difícil: consentimento sem juridiquês.** Nenhum termo para aceitar. Uma frase antes de
      gerar o código ("A clínica vê só o que estiver marcado, até 21/11/2026. Cada vez que alguém de
      lá abrir, aparece aqui com o nome. Você encerra quando quiser, em dois toques.") e a lista de
      quem abriu.
- [x] Um responsável entende sozinho o que está compartilhando e desfaz em dois toques.
- [x] Coberto por teste (`domain/__tests__/historico-compartilhado.spec.ts` e
      `data/__tests__/historico-compartilhado.spec.ts`). Visto no navegador em 1440, 1024, 768 e no
      escuro.

## Como demonstrar em um minuto

1. `?clinico=on` e abra **Clínica › Pacientes › Histórico liberado** (`/veterinario/historico-liberado`).
2. **Receber pelo código** › `729154` (o Fubá, da Renata) › Conferir › Receber histórico. O Fubá
   vira paciente e a gaveta abre o histórico, com a alergia grave e o fenobarbital no topo.
3. **Ver como o responsável vê** › Eduardo: a Clínica Veterinária Cuidar ainda vê o histórico do
   Thor e abriu há dois dias. Encerrar › Encerrar acesso.
4. **Ler QR da coleira** › Fubá: a ficha pública. Em "Quem abre", a Recepção (sem CRMV) trava o
   botão; com a Ana, a ficha de emergência abre com o registro no pé.
5. No celular, troque para **Renata**: o aviso "Ficha de emergência aberta" chegou. Fechado o aviso,
   "A ficha de emergência foi aberta 1 vez" leva a quem abriu.

A Camila (Nina) mostra o acesso que venceu sozinho: na clínica, a linha desce para "Terminados" com
a mesma frase de quem encerrou.

## Onde mora

| Camada              | Arquivo                                                                                                                                                              |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Regras              | `src/features/clinico/domain/historico-compartilhado.ts`: estado do acesso, o que a clínica vê, código, prazos, CRMV, ficha pública e de emergência                  |
| Servidor de mentira | `src/features/clinico/data/historico-compartilhado.ts`: os dois lados do mesmo acesso, `historicoLiberadoRepository` (recepção) e `historicoDoResponsavel` (celular) |
| Semente             | `src/features/clinico/data/seed-historico.ts`: Thor (conflito), Fubá (primeira vez), Nina (acesso vencido) e as três coleiras                                        |
| Store               | `src/features/clinico/stores/historico.ts`: a lista da clínica e o `versao` que avisa o celular                                                                      |
| Palavras            | `src/features/clinico/composables/useRotulosDoHistorico.ts`: "valendo", "terminou" e "quem abriu" iguais em todas as telas                                           |
| Página              | `src/pages/(accounts)/veterinario/historico-liberado.vue`, aba de Pacientes (`src/navegacao/espacos.ts`)                                                             |
| Gavetas             | `components/historico/HistoricoGaveta.vue` (o histórico), `ReceberCodigoGaveta.vue` e `EmergenciaGaveta.vue`                                                         |
| Celular da prévia   | `components/historico/HistoricoNoApp.vue`                                                                                                                            |
| Textos              | `clinico.historicoLiberado.*` nos 6 idiomas                                                                                                                          |

## Decisões

- **A clínica lê "o acesso terminou em", nunca "revogado" nem quem encerrou.** É a mesma frase para
  o prazo que venceu e para o responsável que encerrou: sem constrangimento para quem troca de
  clínica por conflito. O histórico some da gaveta na hora; o que a clínica já registrou na ficha
  dela fica.
- **Encerrar em dois toques, sem diálogo.** O primeiro toque abre a confirmação na própria linha,
  com a frase do que acontece; o segundo encerra.
- **Cada item diz de onde veio.** A clínica que recebe só confia no que sabe de onde veio: o nome
  da clínica e o profissional com o CRMV, ou "Anotado pelo responsável no app".
- **Abrir fica registrado.** A gaveta registra a abertura (no protótipo, como o primeiro
  profissional ativo) e o celular mostra com nome, conselho, clínica e o que abriu.
- **Código de 6 dígitos, que vale uma vez.** É o formato do acesso temporário da API. Usado por
  outra clínica e encerrado dão a mesma resposta ("não vale mais"); a recepção não fica sabendo
  qual dos dois.
- **Prazos da API.** Os atalhos do app (24 h, 48 h, 72 h, 7 dias) e o teto de 30 dias
  (`DURACAO_MAX_HORAS`, decisão de produto). Não existe "para sempre": todo acesso termina sozinho.
  A semente respeita o teto, e um teste cobra.
- **Emergência em dois degraus.** O QR da coleira continua abrindo a ficha pública de hoje
  (identificação, microchip, quem cuida e o alerta de alergia grave), que serve a quem achou o pet na
  rua. O segundo degrau (uso contínuo, alergias, o que está em tratamento, último peso e o telefone
  de quem cuida) só abre para CRMV no formato `CRMV-UF número`, fica registrado e o responsável
  recebe o aviso na hora. A Recepção aparece na lista de propósito: é ela que não pode. Nenhum dado
  de saúde fica numa URL aberta.
- **A emergência não depende de acesso liberado.** A Nina, com o acesso vencido, ainda abre pela
  coleira. Por isso o celular tem "A ficha de emergência foi aberta N vezes" fora dos acessos: sem
  ele, quem fechou o aviso não acharia mais quem abriu.
- **Sem toast ao receber.** A gaveta do histórico aberta já é a confirmação, e o toast caía em cima
  do botão de fechar.
- **Gavetas à direita, como no resto do portal.** Em tela larga empurram a página; abaixo de 1280 px
  passam por cima, sem véu.

## Para o `petjourney-app` e a API

Conferido em `petjourney-api` `origin/develop` (`6dd3f7e`). Quase tudo já existe, em dois pedaços:
o **acesso temporário** (`compartilhamento-prestador`) e o **vínculo com a clínica** (E2-02, guia
`docs/integracao-portal-parceiro/guias/portal-parceiro-e2.md`, seção 2, do quadro de novembro).

| No protótipo        | Na API                                                                                                                                                                                                            |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Liberar com código  | `POST /tutor/compartilhamentos-prestador` com `tipoServico: CONSULTA`, `categorias` (`CategoriaInfoCompartilhada`, os mesmos nomes) e `duracaoHoras` = dias × 24, de 24 a 720                                     |
| Receber pelo código | `POST /parceiro/portal/compartilhamentos/vincular` `{ codigo }`. No portal real já existe em Portal › Acessos (`VincularCodigoDialog.vue`)                                                                        |
| Encerrar            | `DELETE /tutor/compartilhamentos-prestador/:id`. Também existem encurtar o prazo (`PATCH .../:id/validade`) e tirar uma categoria (`DELETE .../:id/categorias/:categoria`)                                        |
| Quem abriu e quando | Do acesso temporário, só no admin (`GET /admin/compartilhamentos/:id/aberturas`, e prova pedido de arquivo, não leitura): lacuna L5. Da clínica vinculada, `GET /tutor/clinica/clinicas/:parceiroId/acessos` (E2) |
| Ficha de emergência | Não existe. O QR público é o `/tutor/qr`, e a clínica que lê (`POST /parceiro/portal/vinculos/por-qr`) só propõe vínculo pela inbox: lacuna L6                                                                    |

Onde o modelo da API é diferente do protótipo:

- **O acesso temporário é um retrato congelado** do pet no momento em que nasce (há
  `atualizar-resumo` para refazer). O protótipo mostra o histórico de agora. Quem lê continuamente é
  o vínculo.
- **O vínculo (E2-02) tem outro consentimento.** A clínica propõe a partir do acesso
  (`POST /parceiro/portal/compartilhamentos/:id/propor-vinculo`), o responsável aceita no app e
  escolhe três interruptores (`diarioCompleto`, `peso`, `notas`), todos desligados, e não as sete
  categorias.
- **O conflito tem dois botões no app real**, em "Minhas clínicas": Encerrar (a clínica para de ler
  na hora; o que ela publicou fica no app) e Bloquear (recusa as propostas pendentes e corta as
  novas por QR e acesso, sem aviso à clínica). O protótipo só tem Encerrar.

## O que ainda não existe

- Integração: o protótipo é mocado; as rotas do E2 são do quadro de novembro.
- Bloquear a clínica, do E2.
- Na API: as aberturas do acesso temporário para o responsável (L5) e a ficha de emergência (L6),
  em [lacunas-da-api.md](../integracao-portal-parceiro/lacunas-da-api.md).
- A tela do app em si (o protótipo é a prévia do celular no portal) e a câmera lendo o QR (na
  demonstração, escolhe-se a coleira).
