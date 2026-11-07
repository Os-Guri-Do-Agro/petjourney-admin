<script setup lang="ts">
/**
 * O mapa do hotel pela API (E7-02a, guia e7 15): cada acomodação no período, por corredor, com a
 * situação (livre, ocupada, reservada, em higienização, fora de operação) e quem está nela (até 3
 * conflitos; o hóspede que passou da saída prevista vem marcado). Abre em hoje e amanhã.
 *
 * "Tem vaga para um labrador?" é o filtro de porte e espécie (os dois juntos), sem animal
 * cadastrado: as impedidas dizem por quê. O período e o filtro se escolhem numa gaveta, com o
 * calendário aberto.
 */
import Button from 'primevue/button'
import DatePicker from 'primevue/datepicker'
import Select from 'primevue/select'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import UiPagina from '@/components/ui/UiPagina.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import {
  ESPECIES,
  lerCasa,
  PORTES,
  type CasaDoHotel,
  type EspecieDaCasa,
  type PorteDaCasa,
} from '@/service/parceiro/hotel-casa-service'
import {
  lerMapa,
  type MapaDoHotel,
  type SituacaoDaVaga,
  type VagaDoMapa,
} from '@/service/parceiro/hotel-reservas-service'

import { useRotulosDasReservas } from './useRotulosDasReservas'
import '@/components/hotel/casa/casa.css'

const { t } = useI18n()
const rotulos = useRotulosDasReservas()
const { parceiroQuery } = useParceiroPortal()

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const hoje = new Date()
const amanha = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 1)

const periodo = ref<Date[]>([hoje, amanha])
const porte = ref<PorteDaCasa | null>(null)
const especie = ref<EspecieDaCasa | null>(null)
const mapa = ref<MapaDoHotel | null>(null)
const casa = ref<CasaDoHotel | null>(null)
const carregando = ref(false)
const erro = ref('')

async function carregar() {
  carregando.value = true
  erro.value = ''
  try {
    mapa.value = await lerMapa(
      {
        entradaData: iso(periodo.value[0]!),
        saidaData: iso(periodo.value[1] ?? periodo.value[0]!),
        ...(porte.value && especie.value ? { porte: porte.value, especie: especie.value } : {}),
      },
      parceiroQuery(),
    )
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('reservasDoHotel.mapa.erro')).mensagem
  } finally {
    carregando.value = false
  }
}

onMounted(async () => {
  void carregar()
  casa.value = await lerCasa(parceiroQuery()).catch(() => null)
})

const TOM: Record<SituacaoDaVaga, '' | 'ok' | 'atencao' | 'contorno'> = {
  LIVRE: 'ok',
  OCUPADA: '',
  RESERVADA: '',
  HIGIENIZACAO: 'atencao',
  FORA_DE_OPERACAO: 'contorno',
}

const porBloco = computed(() => {
  const nomes = new Map((casa.value?.blocos ?? []).map((b) => [b.id, b.nome]))
  const grupos = new Map<string, { nome: string; vagas: VagaDoMapa[] }>()
  for (const v of mapa.value?.vagas ?? []) {
    const grupo = grupos.get(v.blocoId) ?? { nome: nomes.get(v.blocoId) ?? '', vagas: [] }
    grupo.vagas.push(v)
    grupos.set(v.blocoId, grupo)
  }
  return [...grupos.entries()].map(([id, g]) => ({ id, ...g }))
})

const filtrando = computed(() => Boolean(porte.value && especie.value))
const livres = computed(
  () =>
    (mapa.value?.vagas ?? []).filter((v) =>
      filtrando.value ? !v.impedimentos.length : v.situacao === 'LIVRE',
    ).length,
)

const resumo = computed(() => {
  if (!mapa.value) return ''
  return [
    rotulos.periodo(mapa.value.entrada, mapa.value.saida),
    rotulos.diarias(mapa.value.diarias),
    t('reservasDoHotel.mapa.livres', { n: livres.value, total: mapa.value.vagas.length }),
    filtrando.value
      ? t('reservasDoHotel.mapa.para', {
          porte: rotulos.porte(porte.value!),
          especie: rotulos.especie(especie.value!),
        })
      : '',
  ]
    .filter(Boolean)
    .join(' · ')
})

function meta(v: VagaDoMapa) {
  return [
    v.impedimentos.length && filtrando.value
      ? t('reservasDoHotel.mapa.naoServe', {
          motivos: v.impedimentos.map(rotulos.impedimento).join(', '),
        })
      : '',
  ]
    .filter(Boolean)
    .join(' · ')
}

/* ---------------------------------------------------------------------------- a gaveta */

const gavetaAberta = ref(false)
const periodoNaGaveta = ref<Date[] | null>(null)
const porteNaGaveta = ref<PorteDaCasa | null>(null)
const especieNaGaveta = ref<EspecieDaCasa | null>(null)

function abrirFiltro() {
  periodoNaGaveta.value = [...periodo.value]
  porteNaGaveta.value = porte.value
  especieNaGaveta.value = especie.value
  gavetaAberta.value = true
}

const opcoesDePorte = computed(() =>
  PORTES.map((valor) => ({ valor, rotulo: rotulos.porte(valor) })),
)
const opcoesDeEspecie = computed(() =>
  ESPECIES.map((valor) => ({ valor, rotulo: rotulos.especie(valor) })),
)
const meioFiltro = computed(() => Boolean(porteNaGaveta.value) !== Boolean(especieNaGaveta.value))

function aplicar() {
  if (!periodoNaGaveta.value?.[0] || meioFiltro.value) return
  periodo.value = [periodoNaGaveta.value[0], periodoNaGaveta.value[1] ?? periodoNaGaveta.value[0]]
  porte.value = porteNaGaveta.value
  especie.value = especieNaGaveta.value
  gavetaAberta.value = false
  void carregar()
}
</script>

<template>
  <UiPagina :titulo="t('reservasDoHotel.mapa.titulo')" :resumo="resumo" icone="ph ph-squares-four">
    <template #acoes>
      <Button
        type="button"
        severity="secondary"
        outlined
        icon="ph ph-funnel"
        :label="t('reservasDoHotel.mapa.procurar')"
        @click="abrirFiltro"
      />
    </template>

    <div class="mh">
      <p v-if="erro" class="mh__erro" role="alert">{{ erro }}</p>
      <p v-if="mapa?.truncado" class="mh__nota">{{ t('reservasDoHotel.mapa.truncado') }}</p>
      <p v-if="mapa && !mapa.vagas.length" class="ui-folha ui-vazio">
        {{ t('reservasDoHotel.mapa.vazio') }}
      </p>

      <section
        v-for="grupo in porBloco"
        :key="grupo.id"
        class="ui-folha ui-cartao"
        :aria-labelledby="`mh-${grupo.id}`"
        :aria-busy="carregando"
      >
        <header class="ui-cartao__cabeca">
          <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-door" /></span>
          <span class="ui-cartao__titulos">
            <h2 :id="`mh-${grupo.id}`" class="ui-cartao__titulo">{{ grupo.nome }}</h2>
          </span>
        </header>
        <ul class="ui-lista">
          <li v-for="v in grupo.vagas" :key="v.acomodacaoId" class="ui-linha">
            <span class="ui-linha__texto">
              <span class="ca__nome">
                <strong class="ui-linha__titulo">{{ v.nome }}</strong>
                <span
                  class="ui-selo"
                  :class="TOM[v.situacao] ? `ui-selo--${TOM[v.situacao]}` : ''"
                  >{{ rotulos.vaga(v.situacao) }}</span
                >
              </span>
              <span v-if="meta(v)" class="ui-linha__meta">{{ meta(v) }}</span>
              <RouterLink
                v-for="c in v.conflitos"
                :key="c.reservaId"
                :to="`/hotel/reserva/${c.reservaId}`"
                class="ui-linha__meta mh__conflito"
              >
                {{
                  [
                    rotulos.status(c.status),
                    rotulos.periodo(c.entrada, c.saida),
                    c.atrasada ? t('reservasDoHotel.grade.atrasada') : '',
                    c.soHigienizacao ? t('reservasDoHotel.mapa.soHigienizacao') : '',
                  ]
                    .filter(Boolean)
                    .join(' · ')
                }}
              </RouterLink>
            </span>
          </li>
        </ul>
      </section>
    </div>

    <CadastroGaveta
      v-model:visible="gavetaAberta"
      :titulo="t('reservasDoHotel.mapa.procurar')"
      icone="ph ph-funnel"
      largura="34rem"
    >
      <form id="filtro-do-mapa" class="eg" novalidate @submit.prevent="aplicar">
        <section class="eg__secao">
          <span id="mh-periodo" class="eg__rotulo">{{ t('reservasDoHotel.nova.quando') }}</span>
          <DatePicker
            v-model="periodoNaGaveta"
            selection-mode="range"
            inline
            aria-labelledby="mh-periodo"
          />
        </section>
        <div class="eg__linha">
          <div class="eg__secao">
            <label class="eg__rotulo" for="mh-porte">{{ t('reservasDoHotel.mapa.porte') }}</label>
            <Select
              v-model="porteNaGaveta"
              input-id="mh-porte"
              :options="opcoesDePorte"
              option-label="rotulo"
              option-value="valor"
              show-clear
              :invalid="meioFiltro && !porteNaGaveta"
            />
          </div>
          <div class="eg__secao">
            <label class="eg__rotulo" for="mh-especie">{{
              t('reservasDoHotel.mapa.especie')
            }}</label>
            <Select
              v-model="especieNaGaveta"
              input-id="mh-especie"
              :options="opcoesDeEspecie"
              option-label="rotulo"
              option-value="valor"
              show-clear
              :invalid="meioFiltro && !especieNaGaveta"
            />
          </div>
        </div>
        <small class="eg__dica">{{ t('reservasDoHotel.mapa.filtroDica') }}</small>
      </form>
      <template #pe>
        <Button
          type="button"
          severity="secondary"
          outlined
          :label="t('cadastro.cancelar')"
          @click="gavetaAberta = false"
        />
        <Button
          type="submit"
          form="filtro-do-mapa"
          icon="ph ph-check"
          :label="t('reservasDoHotel.mapa.ver')"
        />
      </template>
    </CadastroGaveta>
  </UiPagina>
</template>

<style scoped>
.mh {
  display: grid;
  gap: 20px;
}

.mh__erro {
  margin: 0;
  color: var(--risco-tinta);
  font-size: 13.5px;
}

.mh__nota {
  margin: 0;
  color: var(--tinta-2);
  font-size: 14px;
}

.mh__conflito {
  color: var(--tinta-2);
  text-decoration: underline;
  text-underline-offset: 2px;
}
</style>
