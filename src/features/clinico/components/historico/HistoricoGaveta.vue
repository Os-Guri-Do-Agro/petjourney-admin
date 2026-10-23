<script setup lang="ts">
/**
 * O histórico que o responsável liberou, aberto pela clínica.
 *
 * É a resposta à objeção da clínica: o paciente novo chega com o histórico completo, e cada item
 * diz de onde veio (a clínica de antes, com quem registrou, ou o que a casa anotou no app). Abrir
 * fica registrado com o nome de quem abriu — o pé da gaveta diz isso, e mostra quem da clínica já
 * abriu, porque é a mesma lista que o responsável lê no celular.
 *
 * Terminado, o histórico não volta: a gaveta diz que o acesso terminou, sem dizer por quê nem por
 * iniciativa de quem, e lembra que o que a clínica registrou na ficha continua dela.
 */
import Button from 'primevue/button'
import Drawer from 'primevue/drawer'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import { useSidePanelOffset } from '@/composables/useSidePanelOffset'
import { useTelaLarga } from '@/composables/useTelaLarga'
import PetAvatar from '@/features/hotel/components/base/PetAvatar.vue'

import { useClinicFormat } from '../../composables/useClinicFormat'
import { useRotulosDoHistorico } from '../../composables/useRotulosDoHistorico'
import {
  historicoLiberadoRepository,
  type HistoricoAberto,
} from '../../data/historico-compartilhado'
import { agruparPorCategoria } from '../../domain/historico-compartilhado'
import { useClinicoStore } from '../../stores/clinico'

const props = defineProps<{
  acessoId: string | null
}>()

const emit = defineEmits<{
  fechar: []
  /** Abrir registrou uma abertura: quem acompanha (a lista, o celular) relê. */
  abriu: []
}>()

const { t } = useI18n()
const clinico = useClinicoStore()
const formato = useClinicFormat()
const rotulos = useRotulosDoHistorico()

const LARGURA = '30rem'

const aberta = computed({
  get: () => props.acessoId !== null,
  set: (valor: boolean) => {
    if (!valor) {
      emit('fechar')
    }
  },
})

const telaLarga = useTelaLarga()

useSidePanelOffset(
  computed(() => aberta.value && telaLarga.value),
  LARGURA,
)

/** Quem está usando a tela. No protótipo, o primeiro profissional ativo — na API, a sessão. */
const quemAbre = computed(() => clinico.profissionais.find((item) => item.ativo) ?? null)

const aberto = ref<HistoricoAberto | null>(null)
const carregando = ref(false)
const erro = ref('')

watch(
  () => props.acessoId,
  async (acessoId) => {
    aberto.value = null
    erro.value = ''

    if (!acessoId || !quemAbre.value) {
      return
    }

    carregando.value = true

    try {
      aberto.value = await historicoLiberadoRepository.abrir(acessoId, quemAbre.value.id)

      if (aberto.value.registrada) {
        emit('abriu')
      }
    } catch {
      erro.value = t('clinico.historicoLiberado.gaveta.erro')
    } finally {
      carregando.value = false
    }
  },
  { immediate: true },
)

const grupos = computed(() => (aberto.value?.itens ? agruparPorCategoria(aberto.value.itens) : []))

const linha = computed(() => aberto.value?.linha ?? null)

const especieERaca = computed(() =>
  linha.value
    ? [formato.especie(linha.value.especie), linha.value.raca].filter(Boolean).join(' · ')
    : '',
)

const TOM_DO_MARCADOR = {
  grave: 'ui-selo--risco',
  continuo: 'ui-selo--atencao',
  ativo: 'ui-selo--clinica',
}
</script>

<template>
  <Drawer
    v-model:visible="aberta"
    position="right"
    :modal="false"
    :dismissable="false"
    class="historico-gaveta clinic-overlay"
    :style="{ width: `min(${LARGURA}, 96vw)` }"
  >
    <template #header>
      <div v-if="linha" class="hg-cabeca">
        <PetAvatar
          :nome="linha.petNome"
          :iniciais="linha.petIniciais"
          :especie="linha.especie"
          :foto-url="linha.petFotoUrl"
        />
        <span class="hg-cabeca__texto">
          <strong>{{ linha.petNome }}</strong>
          <span>
            {{
              [especieERaca, t('clinico.historicoLiberado.linha.deQuem', { nome: linha.tutorNome })]
                .filter(Boolean)
                .join(' · ')
            }}
          </span>
        </span>
      </div>
      <h2 v-else class="hg-cabeca__vazio">{{ t('clinico.historicoLiberado.titulo') }}</h2>
    </template>

    <div class="hg clinic-scope">
      <p v-if="carregando" class="hg__nota" role="status">{{ t('common.loading') }}</p>
      <p v-else-if="erro" class="hg__nota hg__nota--erro" role="alert">{{ erro }}</p>

      <template v-else-if="aberto && linha">
        <!-- Terminado: a mesma frase para prazo e para quem encerrou. Sem motivo, sem culpa. -->
        <div v-if="linha.estado === 'terminou'" class="hg__terminou" role="status">
          <i class="ph ph-hourglass-low" aria-hidden="true" />
          <span>
            <strong>
              {{
                t('clinico.historicoLiberado.gaveta.terminou', {
                  data: rotulos.data(linha.terminouEm ?? linha.expiraEm),
                })
              }}
            </strong>
            <span>{{ t('clinico.historicoLiberado.gaveta.terminouCorpo') }}</span>
          </span>
        </div>

        <template v-else>
          <p class="hg__estado">
            <span class="ui-selo ui-selo--ok">
              <i class="ph ph-share-network" aria-hidden="true" />
              {{
                t('clinico.historicoLiberado.linha.valeAte', { data: rotulos.data(linha.expiraEm) })
              }}
            </span>
            <span v-if="linha.clinicasDeOrigem.length" class="hg__origem">
              {{
                t('clinico.historicoLiberado.linha.veioDe', {
                  lista: rotulos.lista(linha.clinicasDeOrigem),
                })
              }}
            </span>
          </p>

          <section v-for="grupo in grupos" :key="grupo.categoria" class="hg__grupo">
            <h3 class="hg__grupo-titulo">{{ rotulos.categoria(grupo.categoria) }}</h3>
            <ul class="hg__itens">
              <li v-for="item in grupo.itens" :key="item.id" class="hg__item">
                <span class="hg__item-cabeca">
                  <strong>{{ item.titulo }}</strong>
                  <span
                    v-if="item.marcador"
                    class="ui-selo"
                    :class="TOM_DO_MARCADOR[item.marcador]"
                  >
                    {{ rotulos.marcador(item) }}
                  </span>
                </span>
                <span v-if="item.detalhe" class="hg__item-detalhe">{{ item.detalhe }}</span>
                <span class="hg__item-origem">
                  <i
                    :class="
                      item.origem.tipo === 'CLINICA' ? 'ph ph-first-aid-kit' : 'ph ph-device-mobile'
                    "
                    aria-hidden="true"
                  />
                  <span>
                    {{ rotulos.quandoDoItem(item) }} · {{ rotulos.origem(item) }}
                    <span v-if="item.origem.profissional" class="hg__quem-registrou">
                      {{ item.origem.profissional }}
                    </span>
                  </span>
                </span>
              </li>
            </ul>
          </section>

          <p v-if="grupos.length === 0" class="hg__nota">
            {{ t('clinico.historicoLiberado.gaveta.nadaRegistrado') }}
          </p>
        </template>

        <!-- Quem da clínica abriu: a mesma lista que o responsável lê no celular. -->
        <section class="hg__registro">
          <h3 class="hg__grupo-titulo">{{ t('clinico.historicoLiberado.gaveta.quemAbriu') }}</h3>
          <p v-if="aberto.registrada" class="hg__nota">
            {{
              t('clinico.historicoLiberado.gaveta.registro', {
                nome: `${aberto.registrada.profissionalNome} · ${aberto.registrada.conselho}`,
              })
            }}
          </p>
          <ul class="hg__aberturas">
            <li v-for="abertura in aberto.aberturas.slice(0, 5)" :key="abertura.id">
              <span>{{ abertura.profissionalNome }} · {{ abertura.conselho }}</span>
              <span class="hg__quando">{{ formato.relativo(abertura.em) }}</span>
            </li>
          </ul>
          <p v-if="aberto.aberturas.length === 0" class="hg__nota">
            {{ t('clinico.historicoLiberado.linha.nuncaAberto') }}
          </p>
        </section>

        <RouterLink
          v-slot="{ navigate }"
          :to="`/veterinario/paciente/${linha.petId}/resumo`"
          custom
        >
          <Button
            type="button"
            severity="secondary"
            outlined
            icon="ph ph-paw-print"
            :label="t('clinico.historicoLiberado.gaveta.abrirFicha')"
            class="hg__ficha"
            @click="navigate"
          />
        </RouterLink>
      </template>
    </div>
  </Drawer>
</template>

<style scoped>
.hg-cabeca {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.hg-cabeca__texto {
  display: grid;
  min-width: 0;
}

.hg-cabeca__texto strong {
  color: var(--tinta);
  font-size: 17px;
  font-weight: 650;
}

.hg-cabeca__texto span {
  color: var(--tinta-2);
  font-size: 13px;
}

.hg-cabeca__vazio {
  margin: 0;
  color: var(--tinta);
  font-size: 17px;
  font-weight: 600;
}

.hg {
  display: grid;
  gap: 18px;
}

.hg__estado {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  margin: 0;
  gap: 8px 10px;
}

.hg__origem {
  color: var(--tinta-2);
  font-size: 13px;
}

.hg__terminou {
  display: flex;
  align-items: flex-start;
  padding: 12px 14px;
  border-radius: 14px;
  background: var(--superficie-2);
  gap: 10px;
}

.hg__terminou i {
  margin-top: 2px;
  color: var(--tinta-2);
  font-size: 18px;
}

.hg__terminou > span {
  display: grid;
  gap: 2px;
  color: var(--tinta-2);
  font-size: 13.5px;
  line-height: 1.45;
}

.hg__terminou strong {
  color: var(--tinta);
  font-weight: 600;
}

.hg__grupo {
  display: grid;
  gap: 6px;
}

.hg__grupo-titulo {
  margin: 0;
  color: var(--tinta-2);
  font-size: 12.5px;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.hg__itens,
.hg__aberturas {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.hg__item {
  display: grid;
  padding: 10px 0;
  border-top: 1px solid var(--linha);
  gap: 2px;
}

.hg__item:first-child {
  border-top: 0;
  padding-top: 2px;
}

.hg__item-cabeca {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
}

.hg__item-cabeca strong {
  color: var(--tinta);
  font-size: 14.5px;
  font-weight: 600;
}

.hg__item-detalhe {
  color: var(--tinta-2);
  font-size: 13.5px;
  line-height: 1.45;
}

.hg__item-origem {
  display: flex;
  align-items: flex-start;
  color: var(--tinta-3);
  font-size: 12.5px;
  line-height: 1.45;
  gap: 6px;
}

.hg__item-origem i {
  margin-top: 2px;
}

/* Quem registrou, na linha de baixo: nome e conselho não se partem no meio. */
.hg__quem-registrou {
  display: block;
  white-space: nowrap;
}

.hg__registro {
  display: grid;
  padding-top: 14px;
  border-top: 1px solid var(--linha);
  gap: 6px;
}

.hg__aberturas li {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  color: var(--tinta);
  font-size: 13.5px;
  gap: 12px;
}

.hg__quando {
  flex: 0 0 auto;
  color: var(--tinta-3);
}

.hg__nota {
  margin: 0;
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.45;
}

.hg__nota--erro {
  color: var(--risco-tinta);
}

.hg__ficha {
  justify-self: start;
}
</style>
