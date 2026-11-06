<script setup lang="ts">
/**
 * Configuração da agenda da Clínica pela API (E3-01, PJ-GL3IVL): tudo o que a agenda precisa antes
 * do primeiro horário, em abas (`?aba=`): Salas, Leitos (E5-01, pela API), Tipos de atendimento,
 * Bloqueios e Política.
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
import CatalogoAba from '@/components/catalogo/CatalogoAba.vue'
import LeitosAba from '@/components/internacao/LeitosAba.vue'
import UiPagina from '@/components/ui/UiPagina.vue'
import { useModoDemonstracao } from '@/composables/useModoDemonstracao'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import type { Aba } from '@/navegacao/espacos'

const ABAS = ['salas', 'leitos', 'tipos', 'bloqueios', 'politica', 'catalogo'] as const
type AbaDaTela = (typeof ABAS)[number]

const ICONE: Record<AbaDaTela, string> = {
  salas: 'ph ph-door',
  leitos: 'ph ph-bed',
  tipos: 'ph ph-stethoscope',
  bloqueios: 'ph ph-calendar-x',
  politica: 'ph ph-scales',
  catalogo: 'ph ph-books',
}

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { store } = useParceiroPortal()
const { ativo: demonstracao } = useModoDemonstracao()

/** O catálogo da clínica (E4-02) só para quem gere o catálogo: DONO e GESTOR. */
const geraCatalogo = computed(() => store.temPermissao('catalogo.gerir'))

/*
 * Os leitos da internação (E5-01): quem cadastra (DONO, GESTOR) e quem desativa (o veterinário e a
 * enfermagem, `internacao.executar`). Só pela API: a demonstração tem o cadastro no mapa.
 */
const veLeitos = computed(
  () =>
    !demonstracao.value &&
    (store.temPermissao('estabelecimento.editar') || store.temPermissao('internacao.executar')),
)

const abasVisiveis = computed(() =>
  ABAS.filter(
    (aba) => (aba !== 'catalogo' || geraCatalogo.value) && (aba !== 'leitos' || veLeitos.value),
  ),
)

const abaAtual = computed<AbaDaTela>(() => {
  const pedida = route.query.aba
  return typeof pedida === 'string' && (abasVisiveis.value as readonly string[]).includes(pedida)
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
  abasVisiveis.value.map((id) => ({
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
    <LeitosAba
      v-else-if="abaAtual === 'leitos'"
      :pode-editar="podeConfigurar"
      :pode-desativar="
        clinicaEscreve && (podeConfigurar || store.temPermissao('internacao.executar'))
      "
    />
    <TiposAba v-else-if="abaAtual === 'tipos'" :pode-editar="podeConfigurar" />
    <BloqueiosAba v-else-if="abaAtual === 'bloqueios'" :pode-editar="podeBloquear" />
    <PoliticaAba v-else-if="abaAtual === 'politica'" :pode-editar="podeConfigurar" />
    <CatalogoAba v-else :pode-editar="clinicaEscreve && geraCatalogo" />
  </UiPagina>
</template>
