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
| — | **Roteiro de apresentação** (Word e PDF) | [apresentacao/](./apresentacao/) | Para quem apresenta ao cliente — 10 páginas, 12 minutos |

> O **05** é o levantamento técnico do percurso, escrito para quem constrói. O documento em
> [apresentacao/](./apresentacao/) é a versão para quem **apresenta**: mesma demonstração, sem
> vocabulário de código, com fala sugerida, perguntas prováveis e plano B. Ao mudar uma tela do
> fluxo, os dois precisam ser revisados — o Word é gerado por script, não editado à mão.

> **Nota de ordem.** O 02 é fundação e o 01 é consumidor dela — mas a fundação já está
> construída e em uso, então não há bloqueio real. As lacunas do 02 que tocam o 01 são a
> ordenação da tabela (F1) e os estados dentro dos componentes (F4).

## Convenções destes documentos

- **Estado atual** é auditoria de código, não memória: cada afirmação aponta o arquivo.
- **Lacuna** é o que o requisito pede e o código não faz. O que já existe não vira tarefa.
- Checkbox marcado significa **implementado e visível no protótipo**, não "código escrito".
- Termo em texto visível pt: **"responsável"**, nunca "tutor". `tutorId` sobrevive como
  identificador de código e campo de API.
