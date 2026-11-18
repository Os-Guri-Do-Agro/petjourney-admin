<script setup lang="ts">
/**
 * Uma meta do piloto com a Subea, aberta pelo painel: onde ela está contra o alvo do Ofício
 * 002/2026, quanto falta para chegar, quem falta, e o lembrete que a Subea reenvia só para quem
 * falta, com a prévia no celular. É o painel virando ação: o número atrasado tem um botão do lado.
 * Reenviado, fica a hora e para quantos; não se reenvia duas vezes na mesma sessão.
 */
import Button from 'primevue/button'
import { useToast } from 'primevue/usetoast'
import { computed } from 'vue'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import PreviaDoAviso from '@/features/saude-publica/components/PreviaDoAviso.vue'
import { numero, type MetaDoPiloto } from '@/features/saude-publica/dados'
import { useEstadoDoPrototipo, useMetasDoPiloto } from '@/features/saude-publica/estado'

const props = defineProps<{ metaId: MetaDoPiloto['id'] | null }>()
const aberta = defineModel<boolean>('visible', { default: false })

const toast = useToast()
const { lembretes, reenviarLembrete } = useEstadoDoPrototipo()
const metas = useMetasDoPiloto()

const meta = computed(() => metas.value.find((item) => item.id === props.metaId) ?? null)

/** Quantos precisam ter feito para a meta: o percentual dela sobre a base de hoje. */
const alvo = computed(() => (meta.value ? Math.ceil((meta.value.meta * meta.value.base) / 100) : 0))

const distancia = computed(() => {
  if (!meta.value) return ''
  const diferenca = alvo.value - meta.value.feitos
  return diferenca > 0
    ? `Faltam ${numero(diferenca)} para chegar a ${meta.value.meta}%.`
    : `${numero(-diferenca)} acima do mínimo para ${meta.value.meta}%.`
})

const faltam = computed(() => (meta.value ? meta.value.base - meta.value.feitos : 0))
const enviado = computed(() => (props.metaId ? lembretes.value[props.metaId] : undefined))

function reenviar() {
  if (!meta.value) return
  reenviarLembrete(meta.value.id, faltam.value)
  toast.add({
    severity: 'success',
    summary: `Lembrete enviado a ${numero(faltam.value)} tutores`,
    detail: 'Só quem falta recebe, no celular. No protótipo, nada é enviado.',
    life: 4500,
  })
}
</script>

<template>
  <CadastroGaveta
    v-model:visible="aberta"
    :titulo="meta?.rotulo ?? 'Meta'"
    :icone="meta?.icone ?? 'ph ph-target'"
    largura="34rem"
  >
    <template v-if="meta">
      <section class="mg__placar" aria-label="Onde a meta está">
        <span class="mg__numeros">
          <strong class="mg__valor ui-num">{{ meta.valor }}%</strong>
          <span class="ui-selo" :class="meta.atingida ? 'ui-selo--ok' : 'ui-selo--atencao'">
            <i :class="meta.atingida ? 'ph ph-check' : 'ph ph-trend-up'" aria-hidden="true" />
            {{ meta.atingida ? 'Meta atingida' : 'Abaixo da meta' }}
          </span>
        </span>
        <span class="mg__regua" aria-hidden="true">
          <span
            class="mg__barra"
            :class="{ 'mg__barra--abaixo': !meta.atingida }"
            :style="{ width: `${meta.valor}%` }"
          />
          <span class="mg__alvo" :style="{ insetInlineStart: `${meta.meta}%` }">
            <small>meta {{ meta.meta }}%</small>
          </span>
        </span>
        <p class="mg__frase">
          {{ numero(meta.feitos) }} de {{ numero(meta.base) }} {{ meta.regra }}.
          <strong>{{ distancia }}</strong>
        </p>
      </section>

      <section class="eg__secao">
        <h3 class="eg__rotulo">Quem falta</h3>
        <p class="mg__faltam">
          <strong class="ui-num">{{ numero(faltam) }}</strong>
          {{ meta.faltam }}
        </p>
        <PreviaDoAviso :titulo="meta.lembrete.titulo" :texto="meta.lembrete.texto" />
      </section>

      <p v-if="enviado" class="mg__enviado" role="status">
        <i class="ph ph-check-circle" aria-hidden="true" />
        Reenviado hoje às {{ enviado.hora }} a {{ numero(enviado.para) }} tutores.
      </p>
    </template>

    <template #pe>
      <Button type="button" severity="secondary" outlined label="Fechar" @click="aberta = false" />
      <Button
        v-if="meta"
        type="button"
        icon="ph ph-paper-plane-tilt"
        :label="enviado ? 'Lembrete enviado' : `${meta.lembrete.acao} (${numero(faltam)})`"
        :disabled="Boolean(enviado) || faltam === 0"
        @click="reenviar"
      />
    </template>
  </CadastroGaveta>
</template>

<style scoped>
.mg__placar {
  display: grid;
  gap: 10px;
  padding: 16px 18px 14px;
  border-radius: 16px;
  background: var(--superficie-2);
}

.mg__numeros {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.mg__valor {
  color: var(--tinta);
  font-size: 34px;
  font-weight: 750;
  letter-spacing: -0.02em;
  line-height: 1;
}

.mg__regua {
  position: relative;
  height: 12px;
  margin-bottom: 18px;
  border-radius: 999px;
  background: var(--superficie-3);
}

.mg__barra {
  position: absolute;
  inset-block: 0;
  inset-inline-start: 0;
  border-radius: 999px;
  background: var(--ok);
  transition: width 0.6s cubic-bezier(0.32, 0.72, 0, 1);
}

.mg__barra--abaixo {
  background: var(--atencao);
}

/* A meta: o traço na régua e o rótulo embaixo dele. */
.mg__alvo {
  position: absolute;
  top: -5px;
  bottom: -5px;
  width: 2px;
  margin-inline-start: -1px;
  border-radius: 2px;
  background: var(--tinta);
}

.mg__alvo small {
  position: absolute;
  top: calc(100% + 2px);
  left: 50%;
  color: var(--tinta-2);
  font-size: 11.5px;
  font-weight: 650;
  white-space: nowrap;
  transform: translateX(-50%);
}

.mg__frase {
  margin: 0;
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.45;
}

.mg__frase strong {
  color: var(--tinta);
  font-weight: 650;
}

.mg__faltam {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin: 0 0 6px;
  color: var(--tinta-2);
  font-size: 13.5px;
}

.mg__faltam strong {
  color: var(--tinta);
  font-size: 22px;
  font-weight: 750;
}

.mg__enviado {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--ok-tinta);
  font-size: 13.5px;
  font-weight: 600;
}

.mg__enviado i {
  font-size: 17px;
}

@media (prefers-reduced-motion: reduce) {
  .mg__barra {
    transition: none;
  }
}
</style>
