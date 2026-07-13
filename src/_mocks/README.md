# UI mocada (fora do bundle de rotas)

Implementações de demonstração **retiradas do app** para o go-live não expor dados fictícios.

- Não são importadas pelo `file-routes` (`src/pages/**/*.vue`).
- Excluídas do type-check (`tsconfig.app.json` → `src/_mocks/**`).
- Para reativar clínica: restaurar os `.vue` em `src/pages/(accounts)/veterinario/` (e o overview em `src/components/home/`) e reabilitar `CLINICAL_MENU_ENABLED` em `useAppNavigation.ts`.
- Para reativar perfil/settings demos: restaurar de `shared/` para as pastas originais.

| Mock | Destino original |
| --- | --- |
| `veterinario/agenda.vue` | `pages/(accounts)/veterinario/agenda.vue` |
| `veterinario/atividades.vue` | `pages/(accounts)/veterinario/atividades.vue` |
| `veterinario/pacientes.vue` | `pages/(accounts)/veterinario/pacientes.vue` |
| `veterinario/prontuarios.vue` | `pages/(accounts)/veterinario/prontuarios.vue` |
| `veterinario/compartilhamentos.vue` | `pages/(accounts)/veterinario/compartilhamentos.vue` |
| `components/home/ClinicalHomeOverview.vue` | `components/home/ClinicalHomeOverview.vue` |
| `shared/perfil.vue` | `pages/(shared)/perfil/index.vue` |
| `shared/settings.vue` | `pages/(shared)/settings/index.vue` |
