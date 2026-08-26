# UI mocada (fora do bundle de rotas)

Implementações de demonstração **retiradas do app** para o go-live não expor dados fictícios.

- Não são importadas pelo `file-routes` (`src/pages/**/*.vue`).
- Excluídas do type-check (`tsconfig.app.json` → `src/_mocks/**`).
- Para reativar perfil/settings demos: restaurar de `shared/` para as pastas originais.

## Clínica: aposentada, não reativada

As telas de `veterinario/` que ficavam aqui **foram removidas**. O destino delas agora é o
módulo real, em `src/features/clinico/`, que tem o que os mocks não tinham: camada de dados com
a forma da API (`features/clinico/data`), regras de domínio testáveis
(`features/clinico/domain`), estados de carga, erro e vazio pelo `PartnerPageFrame`, e os casos
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
| `veterinario/compartilhamentos.vue` | ainda stub — ver nota abaixo |
| `components/home/ClinicalHomeOverview.vue` | substituído por `pages/(accounts)/veterinario/meu-dia.vue` |

**Compartilhamentos** continua como stub de produção (`ClinicalFeaturePlaceholder`): é outra
feature, com contrato próprio em `docs/NOVAS_IMPLEMENTAÇÕES/11-13-prontuario-acesso-temporario-portal.md`,
e não faz parte do módulo clínico.

## O que continua aqui

| Mock | Destino original |
| --- | --- |
| `shared/perfil.vue` | `pages/(shared)/perfil/index.vue` |
| `shared/settings.vue` | `pages/(shared)/settings/index.vue` |
