<script setup lang="ts">
/**
 * Início — a primeira tela de quem entra no portal: a empresa inteira, de uma vez.
 *
 * Uma empresa parceira pode ter a Clínica, o Hotel e o Portal de indicações. Cada espaço tem o
 * próprio Hoje; o Início responde à pergunta de antes deles: **como está tudo agora, e por onde eu
 * começo?**
 *
 * ## A forma (redesenho total, 19/10/2026)
 *
 * 1. **A saudação e uma frase de estado.** "Boa tarde, Carla" e, embaixo, a data e o que pede
 *    atenção em todos os espaços — "2 assuntos urgentes pedem sua atenção hoje: 1 na Clínica e 1
 *    no Hotel."
 * 2. **Um bloco por espaço que a empresa tem**, na cor dele (Clínica maré, Hotel lavanda, Portal
 *    mel), com os números do agora — cada um leva à tela onde se resolve — e o próximo passo. Quem
 *    não tem o Hotel não vê bloco de Hotel: os blocos são os espaços da barra (`useEspacos`).
 * 3. **O que pede ação**, a lista do sistema (`UiPauta`), agrupada por espaço.
 * 4. **O resto, calmo, embaixo**: a agenda da semana, o código de indicação e a marca.
 *
 * A grade de módulos que existia saiu: a barra lateral já é o mapa. As ações rápidas do alto
 * ("Agenda de hoje", "Mapa de vagas", "Compartilhar código") foram para o título de cada bloco,
 * no espaço a que pertencem.
 *
 * ## O dia
 *
 * Os blocos da Clínica e do Hotel e a agenda da semana leem o mesmo dia da casa — a agenda da
 * clínica e o hotel de hoje. Ele é carregado uma vez aqui e entregue por `provide`, para que três
 * partes não peçam três vezes a mesma coisa nem mostrem números de momentos diferentes.
 */
import { computed, onMounted, onUnmounted, provide, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import HomeAgenda from '@/components/home/HomeAgenda.vue'
import HomeEspacoClinica from '@/components/home/HomeEspacoClinica.vue'
import HomeEspacoHotel from '@/components/home/HomeEspacoHotel.vue'
import HomeEspacoPortal from '@/components/home/HomeEspacoPortal.vue'
import HomeIndique from '@/components/home/HomeIndique.vue'
import HomeMarca from '@/components/home/HomeMarca.vue'
import HomePauta from '@/components/home/HomePauta.vue'
import type { IndicacaoNoBloco } from '@/components/home/espaco-da-home'
import { CHAVE_DO_DIA, useLinhaDoDia } from '@/components/home/useLinhaDoDia'
import { usePautaDaHome } from '@/components/home/usePautaDaHome'
import PartnerOperabilityBanner from '@/components/parceiro/PartnerOperabilityBanner.vue'
import UiPagina from '@/components/ui/UiPagina.vue'
import { isGuidanceVisible } from '@/composables/useLayoutPreferences'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { INTL_LOCALE, type Locale } from '@/i18n/locales'
import { useEspacos } from '@/navegacao/espacos'
import { getAuthUser } from '@/service/auth/auth-session'
import { useUsuarioPerfilStore } from '@/stores/usuario-perfil'

const { t, locale } = useI18n()
const { store, ensureContext } = useParceiroPortal()
const { espacos, hasClinicalProfile, hasHotelProfile } = useEspacos()
const perfil = useUsuarioPerfilStore()
const { resumo, modulos } = usePautaDaHome()

provide(
  CHAVE_DO_DIA,
  useLinhaDoDia({
    clinica: () => hasClinicalProfile.value,
    hotel: () => hasHotelProfile.value,
  }),
)

const indique = ref<InstanceType<typeof HomeIndique> | null>(null)

const now = ref(new Date())
let clockId: ReturnType<typeof setInterval> | undefined

const intl = computed(() => INTL_LOCALE[locale.value as Locale])

/** Com clínica ou hotel ligados, a página ganha a pauta e a agenda da semana. */
const temModulos = computed(() => hasClinicalProfile.value || hasHotelProfile.value)

/** Os blocos são os espaços da barra, na mesma ordem: Clínica, Hotel, Portal. */
const blocos = computed(() =>
  espacos.value.filter(
    (espaco) => espaco.id === 'clinica' || espaco.id === 'hotel' || espaco.id === 'portal',
  ),
)

// ------------------------------------------------------------------------------ a saudação

/**
 * A pessoa, pelo primeiro nome: a empresa já está no alto da barra. O nome vem do perfil (ou do
 * token, antes de o perfil carregar) — nunca do "Parceiro" provisório da store, que trocava diante
 * de quem olhava.
 */
const primeiroNome = computed(() => {
  const nome = (perfil.nome || getAuthUser()?.nome || '').trim()

  return nome.split(/\s+/)[0] ?? ''
})

const periodo = computed(() => {
  const hora = now.value.getHours()

  if (hora >= 5 && hora < 12) return 'manha'
  if (hora >= 12 && hora < 18) return 'tarde'

  return 'noite'
})

const saudacao = computed(() =>
  primeiroNome.value
    ? t(`inicio.saudacao.${periodo.value}Com`, { nome: primeiroNome.value })
    : t(`inicio.saudacao.${periodo.value}`),
)

const dataDeHoje = computed(() => {
  const rotulo = now.value.toLocaleDateString(intl.value, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return rotulo.charAt(0).toLocaleUpperCase(intl.value) + rotulo.slice(1)
})

/**
 * A frase de estado: o que a pauta diz, em uma frase, e — com Clínica e Hotel ligados — em qual
 * espaço está. "2 assuntos urgentes pedem sua atenção hoje: 1 na Clínica e 1 no Hotel."
 */
const fraseDoResumo = computed(() => {
  const atual = resumo.value

  switch (atual.estado) {
    case 'semModulos':
      return t('inicio.resumo.portal')
    case 'conferindo':
      return t('inicio.resumo.conferindo')
    case 'falhou':
      return t('inicio.resumo.falhou')
    case 'emDia':
      return t('inicio.resumo.emDia')
    default:
      break
  }

  const frase = t(`inicio.resumo.${atual.estado}`, { total: atual.total }, atual.total)

  if (modulos.value.length < 2) {
    return frase
  }

  const partes = modulos.value.flatMap((modulo) => {
    const total = modulo.linhas.filter(
      (linha) => atual.estado === 'esperando' || linha.tom === 'risco',
    ).length

    return total > 0 ? [t(`inicio.resumo.em.${modulo.id}`, { total }, total)] : []
  })

  const onde = new Intl.ListFormat(intl.value, { type: 'conjunction' }).format(partes)

  return t('inicio.resumo.comOnde', { frase, onde })
})

const loadError = computed(() =>
  store.loadState === 'error' && !store.semAcessoParceiro ? store.errorMessage : '',
)

// ------------------------------------------------------------------------------ o Portal

/** O que a seção do código sabe e o bloco do Portal mostra (leituras do QR, se há QR). */
const indicacao = computed<IndicacaoNoBloco | null>(() =>
  indique.value
    ? {
        carregando: indique.value.carregando,
        podeIndicar: indique.value.podeIndicar,
        temQr: indique.value.temQr,
        resumo: indique.value.resumo,
      }
    : null,
)

function compartilhar() {
  indique.value?.abrirQr()
}

/** O código aparece embaixo só para quem tem o programa ativo; sem ele, a marca fica sozinha. */
const comIndicacao = computed(() => indique.value?.visivel ?? true)

onMounted(() => {
  void ensureContext()
  clockId = setInterval(() => {
    now.value = new Date()
  }, 60_000)
})

onUnmounted(() => {
  if (clockId) {
    clearInterval(clockId)
  }
})
</script>

<template>
  <UiPagina
    :titulo="saudacao"
    :erro="loadError"
    :sem-acesso-de-parceiro="store.semAcessoParceiro"
    bloquear-se-suspenso
    guia
    @tentar-de-novo="ensureContext(true)"
  >
    <template #resumo>
      <time :datetime="now.toISOString().slice(0, 10)">{{ dataDeHoje }}</time
      >{{ '. ' }}
      <span aria-live="polite">{{ fraseDoResumo }}</span>
    </template>

    <div class="inicio">
      <PartnerOperabilityBanner />

      <section class="espacos" :aria-label="t('inicio.espacos.rotulo')">
        <p v-if="isGuidanceVisible" class="inicio__guia">
          {{ temModulos ? t('inicio.guia.espacos') : t('inicio.guia.portal') }}
        </p>

        <div class="espacos__grade" :class="`espacos__grade--${blocos.length}`">
          <template v-for="espaco in blocos" :key="espaco.id">
            <HomeEspacoClinica v-if="espaco.id === 'clinica'" :espaco="espaco" />
            <HomeEspacoHotel v-else-if="espaco.id === 'hotel'" :espaco="espaco" />
            <HomeEspacoPortal
              v-else
              :espaco="espaco"
              :indicacao="indicacao"
              @compartilhar="compartilhar"
            />
          </template>
        </div>
      </section>

      <HomePauta v-if="temModulos" />

      <div
        class="calma"
        :class="{
          'calma--sem-agenda': !temModulos,
          'calma--sem-indicacao': !comIndicacao,
        }"
      >
        <HomeAgenda
          v-if="temModulos"
          class="calma__agenda"
          :clinica="hasClinicalProfile"
          :hotel="hasHotelProfile"
        />
        <div class="calma__lado">
          <HomeIndique ref="indique" />
          <!-- A ação do cartão da marca ainda não foi decidida: sem ouvinte, ele é uma figura. -->
          <HomeMarca class="calma__marca" />
        </div>
      </div>
    </div>
  </UiPagina>
</template>

<style scoped>
.inicio {
  display: grid;
  gap: 36px;
  grid-template-columns: minmax(0, 1fr);
}

.inicio__guia {
  max-width: 72ch;
  margin: 0;
  color: var(--tinta-2);
  font-size: 14px;
  line-height: 1.5;
}

/* ------------------------------------------------------------------ os espaços */

.espacos {
  display: grid;
  gap: 14px;
  container-type: inline-size;
  container-name: espacos;
}

/*
 * Um bloco por espaço, lado a lado enquanto cabem (cada um com pelo menos 320 px). Um espaço só
 * ocupa a linha inteira, e o bloco se arruma em fileira por dentro.
 */
.espacos__grade {
  display: grid;
  align-items: stretch;
  gap: 20px;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr));
}

/*
 * Três espaços onde só cabem dois lado a lado (o tablet): o terceiro não fica sozinho em meia
 * linha — ocupa a linha inteira e se arruma em fileira por dentro.
 */
@container espacos (min-width: 660px) and (max-width: 999px) {
  .espacos__grade--3 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .espacos__grade--3 > :last-child {
    grid-column: 1 / -1;
  }
}

/* ------------------------------------------------------------------ o resto, calmo */

/*
 * A agenda à esquerda, larga; o código e a marca à direita. Sem clínica nem hotel não há agenda:
 * código e marca dividem a linha.
 */
.calma {
  display: grid;
  align-items: start;
  gap: 28px 20px;
  grid-template-columns: minmax(0, 1.65fr) minmax(300px, 1fr);
}

.calma__lado {
  display: flex;
  height: 100%;
  flex-direction: column;
  gap: 20px;
}

.calma__marca {
  flex: 1 0 auto;
}

.calma--sem-agenda {
  grid-template-columns: minmax(0, 1fr);
}

.calma--sem-agenda .calma__lado {
  display: grid;
  align-items: end;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr));
}

.calma--sem-agenda .calma__marca {
  height: 100%;
}

.calma--sem-agenda.calma--sem-indicacao .calma__lado {
  grid-template-columns: minmax(0, 1fr);
}

@media (max-width: 1100px) {
  .calma {
    grid-template-columns: minmax(0, 1fr);
  }

  .calma__lado {
    display: grid;
    align-items: end;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr));
  }
}

@media (max-width: 900px) {
  .inicio {
    gap: 28px;
  }

  .espacos__grade {
    gap: 14px;
  }
}
</style>
