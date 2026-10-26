<script setup lang="ts">
/**
 * O seletor das versões de layout do Hoje, para a equipe comparar na mesma tela.
 *
 * Um campo pequeno preso no canto de baixo, à direita, fora do fluxo da página: nenhuma versão
 * abre espaço para ele. Ao lado, o horário da demonstração: a manhã de movimento (o padrão) ou a
 * hora real. As escolhas vão para a URL (`?versao=`, `?relogio=real`), então um link copiado abre
 * o mesmo para o colega.
 *
 * É andaime de avaliação: escolhida a versão, sai junto com as outras.
 */
import Select from 'primevue/select'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { RelogioDaAvaliacao } from './relogio-da-avaliacao'

export type VersaoDoMeuDia = 'foco' | 'cartoes' | 'lista' | 'atual'

const versao = defineModel<VersaoDoMeuDia>({ required: true })
const relogio = defineModel<RelogioDaAvaliacao>('relogio', { required: true })

const { t } = useI18n()

const opcoes = computed(() => [
  { valor: 'foco', rotulo: t('clinico.meuDia.versoes.opcao.foco'), icone: 'ph ph-device-mobile' },
  { valor: 'cartoes', rotulo: t('clinico.meuDia.versoes.opcao.cartoes'), icone: 'ph ph-cards' },
  { valor: 'lista', rotulo: t('clinico.meuDia.versoes.opcao.lista'), icone: 'ph ph-list-numbers' },
  {
    valor: 'atual',
    rotulo: t('clinico.meuDia.versoes.opcao.atual'),
    icone: 'ph ph-clock-counter-clockwise',
  },
])

const escolhida = computed(() => opcoes.value.find((opcao) => opcao.valor === versao.value))

const horarios = computed(() => [
  { valor: 'movimento', rotulo: t('clinico.meuDia.versoes.relogio.movimento') },
  { valor: 'real', rotulo: t('clinico.meuDia.versoes.relogio.real') },
])

const horarioEscolhido = computed(() =>
  horarios.value.find((opcao) => opcao.valor === relogio.value),
)
</script>

<template>
  <div class="versoes">
    <i class="ph ph-layout versoes__icone" aria-hidden="true" />
    <Select
      v-model="versao"
      :options="opcoes"
      option-label="rotulo"
      option-value="valor"
      :aria-label="t('clinico.meuDia.versoes.aria')"
      class="versoes__campo"
      append-to="body"
    >
      <template #value>
        <span class="versoes__valor">
          {{ t('clinico.meuDia.versoes.rotulo') }}:
          <strong>{{ escolhida?.rotulo }}</strong>
        </span>
      </template>
      <template #option="{ option }">
        <span class="versoes__opcao">
          <i :class="option.icone" aria-hidden="true" />
          {{ option.rotulo }}
        </span>
      </template>
    </Select>

    <span class="versoes__divisa" aria-hidden="true" />
    <i class="ph ph-clock versoes__icone" aria-hidden="true" />
    <Select
      v-model="relogio"
      :options="horarios"
      option-label="rotulo"
      option-value="valor"
      :aria-label="t('clinico.meuDia.versoes.relogio.aria')"
      class="versoes__campo versoes__campo--horario"
      append-to="body"
    >
      <template #value>
        <span class="versoes__valor">
          {{ t('clinico.meuDia.versoes.relogio.rotulo') }}:
          <strong>{{ horarioEscolhido?.rotulo }}</strong>
        </span>
      </template>
    </Select>
  </div>
</template>

<style scoped>
.versoes {
  position: fixed;
  z-index: 60;
  right: 92px;
  bottom: 18px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 4px 4px 12px;
  border: 1px solid var(--linha);
  border-radius: 14px;
  background: var(--superficie);
  box-shadow: var(--sombra-2);
}

.versoes__divisa {
  width: 1px;
  height: 22px;
  margin-inline: 4px;
  background: var(--linha);
}

.versoes__icone {
  color: var(--tinta-2);
  font-size: 16px;
}

.versoes__campo {
  min-width: 200px;
  border: 0;
  background: transparent;
  box-shadow: none;
}

.versoes__valor {
  color: var(--tinta-2);
  font-size: 13.5px;
  white-space: nowrap;
}

.versoes__valor strong {
  color: var(--tinta);
  font-weight: 650;
}

.versoes__opcao {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
</style>
