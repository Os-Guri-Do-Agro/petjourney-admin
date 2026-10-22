# Integração do portal do parceiro com a API

Cópia dos documentos anexados aos cards do Nevo (projeto PetJourney), tirada em **2026-10-22**.
A fonte é o Nevo: o Nicolas marca as tasks nas specs conforme a API avança, e os guias de front
ganham seções novas a cada parte entregue. Antes de começar uma tela, confira se o guia mudou.

- Board de outubro (API): https://nevo.fluviotec.com/tasks/cmmpbhi66001m19l6uzv01ref
- Board de novembro (fronts, no nome do Luís): https://nevo.fluviotec.com/tasks/cmmpbhi66001n19l63swhgt1g
- Contrato: `contrato/openapi.json` do `petjourney-api`, branch `develop`

## Por onde começar

1. [epicos/portal-do-parceiro.md](epicos/portal-do-parceiro.md): decisões A1 a A3, princípios P1 a P12, ondas.
2. [analise-do-portal-irracionalidades-e-melhorias.md](analise-do-portal-irracionalidades-e-melhorias.md): o que o portal precisa apagar ou trocar, com arquivo e linha.
3. `guias/`: um guia de front por épico, com rotas, payloads, códigos de erro e o que apagar no portal. **É o que se implementa.**
4. `specs/`: a spec de cada parte da API, para quando o guia não bastar.

## Regras do card "Fronts: o que vale para todas as telas"

- Gerar os tipos de `contrato/openapi.json` em vez de escrever o contrato à mão.
- `/publico` vira `/public`.
- Quando a rota existir, apagar a regra local (`domain/`) e só mostrar o que o servidor calculou.
- O mock fica só em dev ou na conta de demonstração.
- Sem travessão; textos nos 6 idiomas.

## Situação da API em 2026-10-22

Ondas 0, 1 e 2 commitadas no `develop` da API (`32da074`, `6a234fc`, `6dd3f7e`). Nada em produção.

| Parte | API | Guia de front | Card do front (novembro) |
|---|---|---|---|
| E0-01 equipe, E0-02 saque | pronta | [guias/portal-parceiro-e0.md](guias/portal-parceiro-e0.md) | E0-01, E0-02 (portal), em outubro |
| E0-03 pendências com API pronta | não precisa | [specs/e0-consertos/03-pendencias-de-front-com-api-pronta.md](specs/e0-consertos/03-pendencias-de-front-com-api-pronta.md) | E0-03 (portal), em outubro |
| E1-01 a E1-06 fundação | pronta | [guias/portal-parceiro-e1.md](guias/portal-parceiro-e1.md) | [E1 fronts](https://nevo.fluviotec.com/tasks/cmmpbhi66001n19l63swhgt1g?task=cmvhn9mx0000good29pz2p90l) |
| E1-07 aposentar legado | a fazer (28/10) | | E1 fronts |
| E2-01, E2-02, E2-04 pacientes, vínculo, publicação | pronta | [guias/portal-parceiro-e2.md](guias/portal-parceiro-e2.md) | [E2 fronts](https://nevo.fluviotec.com/tasks/cmmpbhi66001n19l63swhgt1g?task=cmvhn9wjw000uood216s1lo4u) |
| E2-03 leitura do app, E2-05 migrador | a fazer (24/10) | | E2 fronts |
| E3-01 configuração, E3-02 agenda | pronta | [guias/portal-parceiro-e3.md](guias/portal-parceiro-e3.md) | [E3 fronts](https://nevo.fluviotec.com/tasks/cmmpbhi66001n19l63swhgt1g?task=cmvhna1rm0012ood2pyyvnqk5) |
| E3-03 faltas | em teste | | E3 fronts |
| E3-04 a E3-08 | a fazer (24 e 25/10) | | E3 fronts |
| E4-02 catálogos, E4-04 vacinação | pronta | [guias/portal-parceiro-e4.md](guias/portal-parceiro-e4.md) | [E4 fronts](https://nevo.fluviotec.com/tasks/cmmpbhi66001n19l63swhgt1g?task=cmvhnac2d001hood25b6i8qd7) |
| E4-01, 03, 05, 06, 07 | a fazer (25 e 26/10) | | E4 fronts |
| E5 internação, E6 estoque | a fazer (26/10) | | E5 e E6 fronts |
| E7 hotel | a fazer (26 e 27/10) | | E7 fronts |
| Parciais (reivindicações) | pronta | [guias/parciais-acesso-e-receita.md](guias/parciais-acesso-e-receita.md), seção 3 | Parciais (portal), em outubro |

## Pastas

- `guias/`: guias de front (handoffs). Um por épico; o E3 e o E4 crescem conforme a API entrega.
- `epicos/`: o guarda-chuva e um épico por área, com as decisões de cada uma.
- `specs/`: uma spec por parte da API, na mesma árvore de `docs/specs/2026/q4/q4-1/portal-parceiro/` da API.
- [cronograma-de-execucao.md](cronograma-de-execucao.md): janelas previstas de cada spec e dos gates.
