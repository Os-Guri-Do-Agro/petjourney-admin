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
import { iniciais } from '@/components/cadastro/useRotulosDoCadastro'
import { useRotulosDasReservas } from '@/components/hotel/reservas/useRotulosDasReservas'
import UiPagina from '@/components/ui/UiPagina.vue'
import type { PassoDoGuia } from '@/components/ui/UiPassos.vue'
import UiVazioIlustrado from '@/components/ui/UiVazioIlustrado.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import PetAvatar from '@/features/hotel/components/base/PetAvatar.vue'
import { listarHospedes, type Hospede } from '@/service/parceiro/hotel-estadia-service'
import { ESPECIE_DO_AVATAR } from '@/utils/parceiro/acesso-na-lista'

const { t } = useI18n()
const rotulos = useRotulosDasReservas()
const { store, parceiroQuery } = useParceiroPortal()

/* Reservar e fazer o check-in: o balcão do hotel (`hotel.reserva`), com o Hotel para escrever. */
const reserva = computed(
  () => Boolean(store.modulo('HOTEL')?.podeEscrever) && store.temPermissao('hotel.reserva'),
)

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

/*
 * O vazio que ensina (o desenho de Acessos, 17/11/2026): ninguém na casa, como um hóspede chega
 * aqui, em três etapas, com o botão de cada uma para o balcão (17/11/2026): a reserva abre a
 * gaveta de Nova reserva (`?novo=1`), o check-in leva às Reservas, de onde ele sai, e a estadia
 * começa sozinha, sem botão.
 */
const passosDoHospede = computed<PassoDoGuia[]>(() => {
  const passo = (id: string, icone: string, acao?: PassoDoGuia['acao']): PassoDoGuia => ({
    id,
    icone,
    titulo: t(`estadiaDoHotel.hospedes.guia.${id}.titulo`),
    texto: t(`estadiaDoHotel.hospedes.guia.${id}.texto`),
    acao,
  })

  return [
    passo(
      'reserva',
      'ph ph-calendar-check',
      reserva.value
        ? {
            rotulo: t('reservasDoHotel.nova.titulo'),
            icone: 'ph ph-plus',
            to: { path: '/hotel/reservas', query: { novo: '1' } },
          }
        : undefined,
    ),
    passo('checkin', 'ph ph-sign-in', {
      rotulo: t('hotel.mapa.verReservas'),
      icone: 'ph ph-calendar-blank',
      to: '/hotel/reservas',
    }),
    passo('estadia', 'ph ph-heart'),
  ]
})
</script>

<template>
  <UiPagina :titulo="t('estadiaDoHotel.hospedes.titulo')" :resumo="resumo" icone="ph ph-heart">
    <div class="hh">
      <p v-if="erro" class="hh__erro" role="alert">{{ erro }}</p>
      <section
        v-if="ordenados.length || carregando"
        class="ui-folha ui-lista"
        :aria-busy="carregando"
      >
        <ul v-if="ordenados.length" class="ui-lista">
          <li v-for="h in ordenados" :key="h.hospedagemId">
            <RouterLink :to="`/hotel/hospedagem/${h.hospedagemId}`" class="ui-linha hh__linha">
              <PetAvatar
                :nome="h.pacienteNome"
                :iniciais="iniciais(h.pacienteNome)"
                :especie="ESPECIE_DO_AVATAR[h.especie] ?? null"
                :foto-url="h.fotoUrl"
                tamanho="md"
              />
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
      </section>

      <UiVazioIlustrado
        v-else-if="!erro"
        icone="ph ph-heart"
        :titulo="t('estadiaDoHotel.hospedes.vazio')"
        :texto="t('estadiaDoHotel.hospedes.vazioTexto')"
        :guia-titulo="t('estadiaDoHotel.hospedes.guia.titulo')"
        :passos="passosDoHospede"
      />
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
