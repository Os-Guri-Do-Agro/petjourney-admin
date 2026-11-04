<!-- doc cmvkfngpn000faod2277ymfvo · "Spec: quem abriu o acesso temporário (L5)" · atualizado 2026-10-23T04:05:47.215Z · card PJ-7M2VNJ -->

# Spec: O responsável vê quando o acesso temporário foi aberto (L5)

**Status:** Concluído na API (`develop`, `b8d5c2b`, 2026-10-23; na API de dev); tela do app no card PJ-7M2VNJ (Luís)
**Autor:** Nicolas (via Claude)
**Criado em:** 2026-10-23
**Versão:** 0.2
**Origem:** card PJ-MNB2WW do Luís (L5), achado no protótipo PJ-QDDJOQ ("o histórico do pet vai junto quando ele muda de clínica": "quem abriu e quando, legível para o responsável")
**Relacionadas:** [../../q2/q2-3/acesso-compartilhamento-e-parcerias/](../../q2/q2-3/acesso-compartilhamento-e-parcerias/) (Parte 11, `AberturaArquivoCompartilhado`), [contrato-openapi-completo.md](contrato-openapi-completo.md) (a migration vai junto com a D5 de lá)

---

## Visão Geral

Hoje só o admin vê as aberturas de um acesso temporário (`GET /admin/compartilhamentos/:id/aberturas`), e o que fica gravado é o pedido de cada **arquivo**, não a abertura da **página** do acesso. O responsável, que é o dono do dado, não vê nada.

Esta parte:
1. passa a registrar quando a página do acesso foi aberta (primeira vez, última vez e quantas vezes), sem identificar quem abriu;
2. dá ao responsável uma rota com isso e com os arquivos pedidos.

## Decisões

- **D1 Contagem de visitas sem identificador.** `CompartilhamentoPrestador` ganha `primeiraVisitaEm`, `ultimaVisitaEm` e `visitas` (inteiro, padrão 0). Uma visita conta quando a página do acesso é lida por quem não é o responsável:
  - `GET /prestador/acesso/:codigo` (o prestador pelo código);
  - `GET /parceiro/portal/compartilhamentos/:id` (o parceiro com conta).
  Nada de IP, user-agent ou usuário, pela mesma regra da `AberturaArquivoCompartilhado`: o canal público é anônimo de propósito. A gravação é um `UPDATE` atômico (`COALESCE` na primeira, `visitas + 1`) e falha sem derrubar a leitura.
- **D2 A rota do responsável:** `GET /tutor/compartilhamentos-prestador/:id/aberturas`, com a mesma checagem de dono das outras rotas `tutor/compartilhamentos-prestador`. Devolve:
  - `visitas: { total, primeiraEm, ultimaEm }`;
  - `arquivos`: até 100 pedidos de arquivo, os mais novos primeiro, com `arquivoNome`, `origem`, `canal` (`PUBLICO`, `PARCEIRO` ou `TUTOR`), `abertoEm` e `parceiro` (`{ nome }` só no canal `PARCEIRO`; `null` no público, que é anônimo).
- **D3 O texto é "pediu", não "leu".** O registro prova o pedido do arquivo ou a abertura da página, não a leitura. O guia do app diz isso.
- **D4 Visitas antigas:** acessos criados antes da migration começam com `visitas: 0`; não há como reconstruir.

## Contrato

- `GET /tutor/compartilhamentos-prestador/:id/aberturas` → `AberturasDoAcessoDto` (descrito no OpenAPI).
- Migration aditiva (a mesma da D5 do `contrato-openapi-completo`): três colunas em `CompartilhamentoPrestador`.

## Acceptance Criteria

- [x] **AC1** Abrir `GET /prestador/acesso/:codigo` duas vezes deixa `visitas: 2`, `primeiraEm` da primeira e `ultimaEm` da segunda.
- [x] **AC2** O detalhe do portal (`GET /parceiro/portal/compartilhamentos/:id`) também conta; o responsável abrindo o próprio acesso não conta.
- [x] **AC3** A rota do responsável lista os arquivos pedidos, com o nome do parceiro só no canal `PARCEIRO`.
- [x] **AC4** Outro usuário pedindo as aberturas de um acesso que não é dele recebe 403 (mesma regra das outras rotas do responsável).
- [x] **AC5** Falha ao gravar a visita não derruba a leitura do acesso.

## Testes

- Unit do service (AC1, AC3, AC5) e da rota com o "dono errado" (AC4).
- Smoke HTTP: criar acesso, abrir pelo código, ler as aberturas.

## Change Log

| Data | Versão | Mudança | Autor |
|---|---|---|---|
| 2026-10-23 | 0.1 | Criação a partir da L5 do card PJ-MNB2WW | Nicolas (via Claude) |
| 2026-10-23 | 0.2 | Implementado (`b8d5c2b`). Verificado no smoke `scripts/smoke-emergencia-e-aberturas.ts` (3 visitas: duas pelo código e uma pelo portal; a do dono não conta; outro usuário 403) e no unitário `aberturas-do-tutor.spec.ts`; o detalhe do portal de outro parceiro não conta visita (teste de regressão da revisão de segurança) | Nicolas (via Claude) |
