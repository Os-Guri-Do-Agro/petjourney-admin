<script setup lang="ts">
/**
 * A linha de todas as telas do financeiro (protótipo): o selo, a frase de que os valores são
 * ilustrativos e o "Ver como", que mostra o mesmo financeiro com os olhos de quem entra (a gestão,
 * a recepção ou um veterinário). Discreta, como o aviso da Saúde pública: é aviso, não assunto.
 */
import Select from 'primevue/select'
import { computed } from 'vue'

import { IDS_DOS_VETERINARIOS, profissional } from '../dados'
import { useFinanceiro, type Perfil } from '../estado'

const { perfil } = useFinanceiro()

const opcoes = [
  { valor: 'gestao', rotulo: 'Dona da clínica (tudo)' },
  { valor: 'recepcao', rotulo: 'Recepção (caixa e notas)' },
  ...IDS_DOS_VETERINARIOS.map((id) => ({
    valor: `vet:${id}`,
    rotulo: `${profissional(id).nome} (veterinário)`,
  })),
]

const escolhido = computed({
  get: () => (perfil.value.tipo === 'veterinario' ? `vet:${perfil.value.id}` : perfil.value.tipo),
  set: (valor: string) => {
    perfil.value = (
      valor.startsWith('vet:')
        ? { tipo: 'veterinario', id: valor.slice(4) }
        : { tipo: valor as 'gestao' | 'recepcao' }
    ) as Perfil
  },
})
</script>

<template>
  <div class="aviso-fin" role="note">
    <span class="ui-selo ui-selo--atencao aviso-fin__selo">
      <i class="ph ph-flask" aria-hidden="true" />
      Protótipo
    </span>
    <span class="aviso-fin__texto">
      Valores ilustrativos, montados sobre a agenda de demonstração. Nada é cobrado, emitido ou
      enviado.
    </span>
    <label class="aviso-fin__ver">
      <span>Ver como</span>
      <Select
        v-model="escolhido"
        :options="opcoes"
        option-label="rotulo"
        option-value="valor"
        size="small"
        aria-label="Ver o financeiro como"
        class="aviso-fin__select"
      />
    </label>
  </div>
</template>

<style scoped>
.aviso-fin {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  color: var(--tinta-2);
  font-size: 13px;
}

.aviso-fin__selo {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 5px;
}

.aviso-fin__texto {
  flex: 1 1 20rem;
  min-width: 0;
}

.aviso-fin__ver {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 8px;
  color: var(--tinta);
  font-weight: 600;
}

.aviso-fin__select {
  min-width: 15rem;
}
</style>
