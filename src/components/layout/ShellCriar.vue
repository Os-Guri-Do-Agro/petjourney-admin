<script setup lang="ts">
/**
 * "Criar": o atalho para começar o trabalho mais comum sem antes ir até a tela dele.
 *
 * Cada item leva à tela dona do formulário, com um pedido na URL (`?novo=1`, `?adicionar=1`) que
 * ela atende abrindo o formulário. Assim o formulário continua tendo um dono só, e o atalho é só
 * uma porta a mais.
 */
import Popover from 'primevue/popover'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter, type RouteLocationRaw } from 'vue-router'

const props = defineProps<{ recolhida: boolean; clinica: boolean }>()

const { t } = useI18n()
const router = useRouter()

const menu = ref<InstanceType<typeof Popover> | null>(null)
const aberto = ref(false)

type Opcao = { id: string; icone: string; rotulo: string; dica: string; destino: RouteLocationRaw }

const opcoes = computed<Opcao[]>(() =>
  props.clinica
    ? [
        {
          id: 'agendamento',
          icone: 'ph ph-calendar-plus',
          rotulo: t('shell.barra.criarItens.agendamento'),
          dica: t('shell.barra.criarItens.agendamentoDica'),
          destino: { path: '/veterinario/agenda', query: { novo: '1' } },
        },
        {
          id: 'paciente',
          icone: 'ph ph-paw-print',
          rotulo: t('shell.barra.criarItens.paciente'),
          dica: t('shell.barra.criarItens.pacienteDica'),
          destino: '/veterinario/paciente/novo',
        },
        {
          id: 'fila',
          icone: 'ph ph-hourglass-medium',
          rotulo: t('shell.barra.criarItens.fila'),
          dica: t('shell.barra.criarItens.filaDica'),
          destino: { path: '/veterinario/fila', query: { adicionar: '1' } },
        },
      ]
    : [],
)

function alternar(evento: Event) {
  menu.value?.toggle(evento)
}

function escolher(opcao: Opcao) {
  menu.value?.hide()
  void router.push(opcao.destino)
}
</script>

<template>
  <template v-if="opcoes.length">
    <button
      type="button"
      class="criar"
      :class="{ 'criar--recolhida': recolhida }"
      aria-haspopup="menu"
      :aria-expanded="aberto"
      :aria-label="t('shell.barra.criarTitulo')"
      :title="t('shell.barra.criarTitulo')"
      @click="alternar"
    >
      <i class="ph ph-plus" aria-hidden="true" />
    </button>

    <Popover ref="menu" @show="aberto = true" @hide="aberto = false">
      <div class="criar__menu" role="menu">
        <p class="criar__titulo">{{ t('shell.barra.criarTitulo') }}</p>
        <button
          v-for="opcao in opcoes"
          :key="opcao.id"
          type="button"
          role="menuitem"
          class="criar__opcao"
          @click="escolher(opcao)"
        >
          <span class="criar__icone" aria-hidden="true"><i :class="opcao.icone" /></span>
          <span class="criar__texto">
            <strong>{{ opcao.rotulo }}</strong>
            <small>{{ opcao.dica }}</small>
          </span>
        </button>
      </div>
    </Popover>
  </template>
</template>

<style scoped>
.criar {
  display: grid;
  flex: none;
  width: 40px;
  height: 40px;
  place-items: center;
  border: 0;
  border-radius: 10px;
  background: var(--salvia);
  color: var(--sobre-salvia);
  cursor: pointer;
  font-size: 18px;
}

.criar:hover {
  background: color-mix(in oklab, var(--salvia) 86%, white);
}

.criar:focus-visible {
  outline: 2px solid var(--sobre-rail);
  outline-offset: 2px;
}

.criar__menu {
  display: grid;
  min-width: 300px;
  gap: 2px;
}

.criar__titulo {
  margin: 4px 10px 6px;
  color: var(--tinta-2);
  font-size: 13px;
  font-weight: 550;
}

.criar__opcao {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 10px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--tinta);
  cursor: pointer;
  text-align: left;
}

.criar__opcao:hover {
  background: var(--superficie-2);
}

.criar__opcao:focus-visible {
  outline: 2px solid var(--musgo);
  outline-offset: -2px;
}

.criar__icone {
  display: grid;
  flex: none;
  width: 36px;
  height: 36px;
  place-items: center;
  border-radius: 10px;
  background: var(--clinica-fundo);
  color: var(--clinica-tinta);
  font-size: 18px;
}

.criar__texto {
  display: grid;
  line-height: 1.3;
}

.criar__texto strong {
  font-size: 14px;
  font-weight: 600;
}

.criar__texto small {
  color: var(--tinta-2);
  font-size: 12.5px;
}
</style>
