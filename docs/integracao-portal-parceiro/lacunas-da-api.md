# Lacunas e erros da API vistos pelo portal

**Para:** Nicolas, para a fila da API. O portal implementa o que os guias pedem; o que está aqui
é o que faltou ou divergiu do lado da API, achado durante a integração.
**Base:** `petjourney-api` `origin/develop`, conferido a cada item. Cada item diz como o portal
contornou, quando contornou.

| # | Data | Onde | O que acontece | Efeito no portal | Contorno no portal |
|---|---|---|---|---|---|
| L1 | 22/10 | `contrato/openapi.json` (`6dd3f7e`) | O `ErroDaApiDto` e o enum `CODIGOS_CLINICOS` (`src/common/errors/codigos-clinicos.ts`) não saem no contrato: nenhuma rota os referencia em `@ApiResponse`, e o documento não os registra como `extraModels`. Os códigos de outros módulos (`EQUIPE_*`, `CONVITE_*`, `ESTABELECIMENTO_*`, `MODULO_*`) também não estão em lista nenhuma do contrato. | O guia da E1-04 manda decidir a tela pelo enum `CodigoClinico` do contrato, que não existe no `openapi.json`. | `ApiError.codigo` é `string`; cada tela compara com os códigos que o guia dela lista. |
