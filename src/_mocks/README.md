# UI mocada (fora do bundle de rotas)

Implementações de demonstração **retiradas do app** para o go-live não expor dados fictícios.

- Não são importadas pelo `file-routes` (`src/pages/**/*.vue`).
- Excluídas do type-check (`tsconfig.app.json` → `src/_mocks/**`).
- Para reativar perfil/settings demos: restaurar de `shared/` para as pastas originais.

## Clínica: aposentada, não reativada

As telas de `veterinario/` que ficavam aqui **foram removidas**. O destino delas agora é o
módulo real, em `src/features/clinico/`, que tem o que os mocks não tinham: camada de dados com
a forma da API (`features/clinico/data`), regras de domínio testáveis
(`features/clinico/domain`), estados de carga, erro e vazio pelo `UiPagina`, e os casos
difíceis que a operação de verdade produz — sobreposição, encaixe, bloqueio, falta, fila e
prontuário em dois dispositivos.

Os arquivos antigos seguem recuperáveis pelo git (`git log -- src/_mocks/veterinario`), mas não
servem de referência: eram arrays estáticos dentro do próprio componente.

| Mock removido | Onde vive agora |
| --- | --- |
| `veterinario/agenda.vue` | `pages/(accounts)/veterinario/agenda.vue` + `features/clinico/components/agenda/` |
| `veterinario/atividades.vue` | `pages/(accounts)/veterinario/atividades.vue` |
| `veterinario/pacientes.vue` | `pages/(accounts)/veterinario/pacientes.vue` |
| `veterinario/atendimentos.vue` | `pages/(accounts)/veterinario/atendimentos.vue` + `features/clinico/components/prontuario/` |
| `veterinario/compartilhamentos.vue` | `pages/(accounts)/parceiro/acessos/` — ver nota abaixo |
| `components/home/ClinicalHomeOverview.vue` | substituído por `pages/(accounts)/veterinario/meu-dia.vue` |

**Compartilhamentos** não é do módulo clínico e nunca foi: é o acesso temporário que o
responsável concede ao prestador, com contrato próprio em
`docs/NOVAS_IMPLEMENTAÇÕES/11-13-prontuario-acesso-temporario-portal.md`. A tela existe e
funciona em **`/parceiro/acessos`**, entregue em 2026-08-14.

A entrada em `/veterinario/compartilhamentos` era uma segunda porta para o mesmo cômodo, criada
na fase de mock antes de a de portal ficar pronta, e nunca passou de um cartão de
"indisponível". Saiu do menu Pets; a rota redireciona para `/parceiro/acessos`.

O que o mock desenhava e a tela entregue **não** cobre, se algum dia virar spec: o detalhamento
do escopo consentido categoria a categoria, a trilha de auditoria de acessos, "marcar como
revisado" antes da consulta e o pedido de renovação ao responsável.

## O que continua aqui

| Mock | Destino original |
| --- | --- |
| `shared/perfil.vue` | `pages/(shared)/perfil/index.vue` |
| `shared/settings.vue` | `pages/(shared)/settings/index.vue` |
