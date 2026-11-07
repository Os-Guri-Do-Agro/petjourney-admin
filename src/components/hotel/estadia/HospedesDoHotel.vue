<script setup lang="ts">
/**
 * Quem está na casa pela API (E7-04a, guia e7 27): o animal, a baia, a entrada e a saída prevista,
 * a adaptação e os alertas (passou da saída, estressado, medicação, tarefas atrasadas), com o tom
 * da API (o que pede atenção primeiro). A linha abre a estadia.
 */
import Button from 'primevue/button'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useRotulosDasReservas } from '@/components/hotel/reservas/useRotulosDasReservas'
import UiPagina from '@/components/ui/UiPagina.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { listarHospedes, type Hospede } from '@/service/parceiro/hotel-estadia-service'

const { t } = useI18n()
const rotulos = useRotulosDasReservas()
const { parceiroQuery } = useParceiroPortal()

const hospedes = ref<Hospede[]>([])
const cursor = ref<string | null>(null)
const carregando = ref(false)
const erro = ref('')

async function carregar(mais = false) {
  carregando.value = true
  erro.value = ''
  try {
    const pagina = await listarHospedes(mais ? cursor.value : null, parceiroQuery())
    hospedes.value = mais ? [...hospedes.value, ...pagina.hospedes] : pagina.hospedes
    cursor.value = pagina.proximoCursor
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('estadiaDoHotel.hospedes.erro')).mensagem
  } finally {
    carregando.value = false
  }
}

onMounted(() => void carregar())

const ORDEM = { RISCO: 0, ATENCAO: 1, OK: 2 } as const
const ordenados = computed(() => [...hospedes.value].sort((a, b) => ORDEM[a.tom] - ORDEM[b.tom]))

const resumo = computed(() =>
  carregando.value && !hospedes.value.length
    ? ''
    : t('estadiaDoHotel.hospedes.resumo', { n: hospedes.value.length }, hospedes.value.length),
)

function meta(h: Hospede) {
  return [
    h.acomodacaoNome,
    rotulos.especie(h.especie),
    t('estadiaDoHotel.hospedes.saida', { quando: rotulos.quando(h.saidaPrevista) }),
    t(`estadiaDoHotel.adaptacao.${h.adaptacao}`),
    h.tarefas?.atrasadas
      ? t(
          'estadiaDoHotel.hospedes.tarefasAtrasadas',
          { n: h.tarefas.atrasadas },
          h.tarefas.atrasadas,
        )
      : '',
  ]
    .filter(Boolean)
    .join(' · ')
}

const TOM = { RISCO: 'ui-selo--risco', ATENCAO: 'ui-selo--atencao', OK: '' } as const
</script>

<template>
  <UiPagina :titulo="t('estadiaDoHotel.hospedes.titulo')" :resumo="resumo" icone="ph ph-heart">
    <div class="hh">
      <p v-if="erro" class="hh__erro" role="alert">{{ erro }}</p>
      <section class="ui-folha ui-lista" :aria-busy="carregando">
        <ul v-if="ordenados.length" class="ui-lista">
          <li v-for="h in ordenados" :key="h.hospedagemId">
            <RouterLink :to="`/hotel/hospedagem/${h.hospedagemId}`" class="ui-linha hh__linha">
              <span class="ui-linha__texto">
                <span class="hh__nome">
                  <strong class="ui-linha__titulo">{{ h.pacienteNome }}</strong>
                  <span v-for="a in h.alertas" :key="a" class="ui-selo" :class="TOM[h.tom]">{{
                    t(`estadiaDoHotel.alerta.${a}`)
                  }}</span>
                </span>
                <span class="ui-linha__meta">{{ meta(h) }}</span>
              </span>
              <i class="ph ph-caret-right ui-linha__fim" aria-hidden="true" />
            </RouterLink>
          </li>
        </ul>
        <p v-else-if="!carregando" class="ui-vazio">{{ t('estadiaDoHotel.hospedes.vazio') }}</p>
      </section>
      <Button
        v-if="cursor"
        type="button"
        severity="secondary"
        outlined
        class="hh__mais"
        :label="t('reservasDoHotel.lista.verMais')"
        :loading="carregando"
        @click="carregar(true)"
      />
    </div>
  </UiPagina>
</template>

<style scoped>
.hh {
  display: grid;
  gap: 16px;
}

.hh__erro {
  margin: 0;
  color: var(--risco-tinta);
  font-size: 13.5px;
}

.hh__linha {
  color: inherit;
  text-decoration: none;
}

.hh__nome {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.hh__mais {
  justify-self: start;
}
</style>
