<script setup lang="ts">
/**
 * Configuração da agenda da Clínica pela API (E3-01, PJ-GL3IVL): tudo o que a agenda precisa antes
 * do primeiro horário, em quatro abas (`?aba=`): Salas, Tipos de atendimento, Bloqueios e Política.
 *
 * O horário da semana e os feriados continuam no Estabelecimento (E1-01): a agenda não duplica.
 * O expediente próprio de cada profissional mora na ficha dele, em Equipe › Profissionais.
 *
 * Quem pode: ler é `agenda.ler`; mexer em salas, tipos e política é `estabelecimento.editar` (DONO
 * ou GESTOR); em bloqueios, `agenda.escrever`. Com a Clínica só para consulta, tudo se lê e nada
 * se escreve.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import BloqueiosAba from '@/components/agenda/BloqueiosAba.vue'
import PoliticaAba from '@/components/agenda/PoliticaAba.vue'
import SalasAba from '@/components/agenda/SalasAba.vue'
import TiposAba from '@/components/agenda/TiposAba.vue'
import UiPagina from '@/components/ui/UiPagina.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import type { Aba } from '@/navegacao/espacos'

const ABAS = ['salas', 'tipos', 'bloqueios', 'politica'] as const
type AbaDaTela = (typeof ABAS)[number]

const ICONE: Record<AbaDaTela, string> = {
  salas: 'ph ph-door',
  tipos: 'ph ph-stethoscope',
  bloqueios: 'ph ph-calendar-x',
  politica: 'ph ph-scales',
}

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { store } = useParceiroPortal()

const abaAtual = computed<AbaDaTela>(() => {
  const pedida = route.query.aba
  return typeof pedida === 'string' && (ABAS as readonly string[]).includes(pedida)
    ? (pedida as AbaDaTela)
    : 'salas'
})

function destino(aba: AbaDaTela) {
  const query = { ...route.query }
  if (aba === 'salas') delete query.aba
  else query.aba = aba
  return router.resolve({ path: '/clinica/configuracao', query }).fullPath
}

const abas = computed<Aba[]>(() =>
  ABAS.map((id) => ({
    rotulo: t(`agenda.config.abas.${id}`),
    icone: ICONE[id],
    to: destino(id),
  })),
)

const clinicaEscreve = computed(() => Boolean(store.modulo('CLINICA')?.podeEscrever))

/** Salas, tipos e política: DONO ou GESTOR. */
const podeConfigurar = computed(
  () => clinicaEscreve.value && store.temPermissao('estabelecimento.editar'),
)

/** Bloqueios: também a recepção e o veterinário. */
const podeBloquear = computed(() => clinicaEscreve.value && store.temPermissao('agenda.escrever'))
</script>

<template>
  <UiPagina
    class="tela-config-agenda"
    :titulo="t('agenda.config.titulo')"
    :resumo="t('agenda.config.resumo')"
    icone="ph ph-sliders-horizontal"
    :abas-da-tela="abas"
    :aba-atual="destino(abaAtual)"
  >
    <SalasAba v-if="abaAtual === 'salas'" :pode-editar="podeConfigurar" />
    <TiposAba v-else-if="abaAtual === 'tipos'" :pode-editar="podeConfigurar" />
    <BloqueiosAba v-else-if="abaAtual === 'bloqueios'" :pode-editar="podeBloquear" />
    <PoliticaAba v-else :pode-editar="podeConfigurar" />
  </UiPagina>
</template>
