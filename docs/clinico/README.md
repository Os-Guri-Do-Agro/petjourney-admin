# Módulo clínico — requisitos e progresso

Índice dos requisitos de produto do fluxo das clínicas. Cada requisito tem um documento
próprio com auditoria do que já existe, lacunas e checklist de execução.

O módulo clínico é **protótipo navegável sem API**: toda novidade entra na camada mocada
(`src/features/clinico/data/`) com o formato que o backend terá, e os repositórios devolvem
a mesma assinatura. Nenhum componente conhece `fixtures`.

## Requisitos

| # | Requisito | Documento | Situação |
|---|-----------|-----------|----------|
| 01 | Agenda da clínica | [01-agenda-clinica.md](./01-agenda-clinica.md) | Completo — 11 lacunas e 2 defeitos |
| 02 | Fundação visual do módulo clínico | [02-fundacao-visual.md](./02-fundacao-visual.md) | Bloco A entregue; B–D pendentes |
| 03 | Prontuário eletrônico estruturado | [03-prontuario-estruturado.md](./03-prontuario-estruturado.md) | Completo |
| 04 | Receituário digital | [04-receituario-digital.md](./04-receituario-digital.md) | Entregue no que cabe ao portal |
| 05 | Roteiro de demonstração | [05-roteiro-de-demonstracao.md](./05-roteiro-de-demonstracao.md) | Roteiro escrito; buracos de percurso listados |
| 06 | Perguntas ao time do app | [06-perguntas-ao-app.md](./06-perguntas-ao-app.md) | Respondido e conferido contra `origin/develop` — divergências listadas |
| 07 | Internação com boletim ao responsável | [07-internacao.md](./07-internacao.md) | Completo — 3 casos difíceis plantados e cobertos por teste; **alta hospitalar entregue** |
| 08 | Orientação do fluxo clínico | [08-orientacao-do-fluxo.md](./08-orientacao-do-fluxo.md) | Completo — 3 defeitos encontrados e corrigidos |
| 09 | Módulo clínico na visão do responsável (para o `petjourney-app`) | [09-modulo-clinico-visao-do-responsavel.md](./09-modulo-clinico-visao-do-responsavel.md) | Passagem para o app; contrato em `src/features/clinico/contrato/`, dados em [contrato/demo-responsavel.json](./contrato/demo-responsavel.json) (`npm run contrato:demo`) |
| 10 | Anamnese por voz | [10-anamnese-por-voz.md](./10-anamnese-por-voz.md) | Protótipo funcionando — microfone do navegador ou consulta de demonstração, motor local de regras com citação por campo |
| 11 | Migrador de dados da clínica | [11-migrador-de-dados.md](./11-migrador-de-dados.md) | Protótipo funcionando — xlsx e csv reais, colunas ligadas sozinhas (só o obrigatório que falta vira pergunta), duplicados, relatório por linha; três planilhas de demonstração |
| 12 | Base importada na visão do responsável (para o `petjourney-app`) | [12-migracao-visao-do-responsavel.md](./12-migracao-visao-do-responsavel.md) | Passagem para o app; tipos na seção "Vínculo proposto pela clínica" de `src/features/clinico/contrato/responsavel.ts` |
| 13 | Vacinas e carteirinha conectada | [13-vacinas-e-carteirinha.md](./13-vacinas-e-carteirinha.md) | Protótipo funcionando — aplicar na clínica muda a prévia da carteirinha do app ao lado; protocolo por espécie e idade, lote vencido travado, dose de outro lugar marcada, atraso com a mesma carência do app |
| 14 | Carteirinha conectada na visão do responsável (para o `petjourney-app`) | [14-carteirinha-visao-do-responsavel.md](./14-carteirinha-visao-do-responsavel.md) | Passagem para o app; tipos na seção "Carteirinha conectada" do contrato, dados em [contrato/demo-carteirinha-aplicacao.json](./contrato/demo-carteirinha-aplicacao.json) |
| — | **Apresentação do fluxo clínico** (PowerPoint) | [apresentacao/](./apresentacao/) | Os slides — 22 telas, o fluxo inteiro em quatro blocos |
| — | **Roteiro de apresentação** (Word e PDF) | [apresentacao/](./apresentacao/) | Para quem apresenta ao cliente — 10 páginas, 12 minutos |
| — | **Novidades do fluxo clínico** (PDF) | [relatorio/](./relatorio/) | Para quem vai testar — 7 páginas, com roteiro de teste e o que ainda não existe |
| — | **Relatório de novidades** (PDF) | [relatorio/](./relatorio/) | Registro técnico da rodada — 8 páginas, com o que recomendo a seguir |

> O **05** é o levantamento técnico do percurso, escrito para quem constrói. Os documentos em
> [apresentacao/](./apresentacao/) são a versão para quem **apresenta**: os slides que vão na
> parede e o roteiro falado, sem vocabulário de código, com fala sugerida, perguntas prováveis e
> plano B. Ao mudar uma tela do fluxo, os três precisam ser revisados — tanto o PowerPoint quanto
> o Word são gerados por script, não editados à mão.

> **Nota de ordem.** O 02 é fundação e o 01 é consumidor dela — mas a fundação já está
> construída e em uso, então não há bloqueio real. As lacunas do 02 que tocam o 01 são a
> ordenação da tabela (F1) e os estados dentro dos componentes (F4).

## Convenções destes documentos

- **Estado atual** é auditoria de código, não memória: cada afirmação aponta o arquivo.
- **Lacuna** é o que o requisito pede e o código não faz. O que já existe não vira tarefa.
- Checkbox marcado significa **implementado e visível no protótipo**, não "código escrito".
- Termo em texto visível pt: **"responsável"**, nunca "tutor". `tutorId` sobrevive como
  identificador de código e campo de API.
