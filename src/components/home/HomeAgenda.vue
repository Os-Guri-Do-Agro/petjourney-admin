<script setup lang="ts">
/**
 * A agenda da semana: os compromissos da clínica e as chegadas do hotel, dia a dia.
 *
 * Fica embaixo no Início, calma: o que é **agora** já está nos blocos dos espaços, lá em cima, e
 * aqui se olha para frente. Uma fileira de sete dias com hoje no meio da primeira semana (setas
 * andam de semana em semana), e embaixo os compromissos do dia escolhido numa lista — hora, rosto,
 * nome, de que espaço é e, quando importa, o estado num selo. Cada linha leva ao lugar dele.
 *
 * Hoje, a ordem é a de quem precisa de alguém antes (`compromissosDoDia`): quem está em
 * atendimento, o movimento do hotel atrasado, quem espera na recepção e o que ainda vem, clínica e
 * hotel misturados pela hora; o que já terminou sai. Em outro dia, tudo pela hora.
 *
 * O dia de hoje vem do dia que a página carrega uma vez (`useDiaDaCasa`); outro dia é pedido quando
 * é escolhido, e guardado.
 */
import Button from 'primevue/button'
import Skeleton from 'primevue/skeleton'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, type RouteLocationRaw } from 'vue-router'

import UiSecao from '@/components/ui/UiSecao.vue'
import { isGuidanceVisible } from '@/composables/useLayoutPreferences'
import PetAvatar from '@/features/hotel/components/base/PetAvatar.vue'
import { INTL_LOCALE, type Locale } from '@/i18n/locales'

import {
  compromissosDoDia,
  horaDaParede,
  somarDias,
  type ContaDoDia,
  type EspecieDoDia,
  type MovimentoDoDia,
} from './linha-do-dia'
import { carregarAgendaDoDia, carregarChegadasDoDia, useDiaDaCasa } from './useLinhaDoDia'

const props = defineProps<{ clinica: boolean; hotel: boolean }>()

const { t, locale } = useI18n()
const dia = useDiaDaCasa()

const intl = computed(() => INTL_LOCALE[locale.value as Locale])

/** Quantos compromissos a lista mostra antes do "Mostrar mais". */
const LIMITE = 5

/* ------------------------------------------------------------------ semana */

const semana = ref(0)
const escolhido = ref<string | null>(null)

const hoje = computed(() => dia.hoje.value)
const selecionado = computed(() => escolhido.value ?? hoje.value)

/** Sete dias, com hoje no meio da primeira semana: três para trás, três para frente. */
const dias = computed(() => {
  if (!hoje.value) return []

  return Array.from({ length: 7 }, (_, indice) =>
    somarDias(hoje.value!, semana.value * 7 + indice - 3),
  )
})

function comoData(data: string) {
  return new Date(`${data}T12:00:00Z`)
}

/** Só a primeira letra sobe: `capitalize` erra no sérvio e no "De" do português. */
function comMaiuscula(texto: string) {
  return texto.charAt(0).toLocaleUpperCase(intl.value) + texto.slice(1)
}

function diaDaSemana(data: string) {
  return comMaiuscula(
    comoData(data)
      .toLocaleDateString(intl.value, { weekday: 'short', timeZone: 'UTC' })
      .replace('.', ''),
  )
}

function numeroDoDia(data: string) {
  return comoData(data).toLocaleDateString(intl.value, { day: 'numeric', timeZone: 'UTC' })
}

function dataPorExtenso(data: string) {
  return comMaiuscula(
    comoData(data).toLocaleDateString(intl.value, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone: 'UTC',
    }),
  )
}

const mes = computed(() => {
  if (!dias.value.length) return ''

  const primeiro = dias.value[0]!
  const ultimo = dias.value[dias.value.length - 1]!
  const formato = { month: 'long', year: 'numeric', timeZone: 'UTC' } as const
  const inicio = comMaiuscula(comoData(primeiro).toLocaleDateString(intl.value, formato))
  const fim = comMaiuscula(comoData(ultimo).toLocaleDateString(intl.value, formato))

  return inicio === fim ? inicio : `${inicio} – ${fim}`
})

function escolher(data: string) {
  escolhido.value = data === hoje.value ? null : data
}

function andar(passo: number) {
  semana.value += passo
}

/* ------------------------------------------------------------------ outro dia */

type OutroDia = {
  carga: 'carregando' | 'pronta' | 'falhou'
  fechada: boolean
  feriado: string | null
  contas: ContaDoDia[]
  chegadas: MovimentoDoDia[]
}

const outrosDias = ref(new Map<string, OutroDia>())

async function carregarOutroDia(data: string) {
  outrosDias.value.set(data, {
    carga: 'carregando',
    fechada: false,
    feriado: null,
    contas: [],
    chegadas: [],
  })

  try {
    const [agenda, chegadas] = await Promise.all([
      props.clinica ? carregarAgendaDoDia(data) : null,
      props.hotel ? carregarChegadasDoDia(data) : [],
    ])

    outrosDias.value.set(data, {
      carga: 'pronta',
      fechada: agenda?.fechada ?? false,
      feriado: agenda?.feriado ?? null,
      contas: agenda?.contas ?? [],
      chegadas,
    })
  } catch {
    outrosDias.value.set(data, { ...outrosDias.value.get(data)!, carga: 'falhou' })
  }
}

watch(escolhido, (data) => {
  if (data && !outrosDias.value.has(data)) {
    void carregarOutroDia(data)
  }
})

/* ------------------------------------------------------------------ o dia escolhido */

const ehHoje = computed(() => !escolhido.value)

const estado = computed(() => {
  if (ehHoje.value) {
    const clinicaCarregando = props.clinica && dia.clinica.value.carga === 'carregando'
    const hotelCarregando = props.hotel && dia.hotel.value.carga === 'carregando'

    return {
      carregando: clinicaCarregando || hotelCarregando,
      falhou:
        (props.clinica && dia.clinica.value.carga === 'falhou') ||
        (props.hotel && dia.hotel.value.carga === 'falhou'),
      fechada: props.clinica && dia.clinica.value.fechada,
      feriado: dia.clinica.value.feriado,
      contas: dia.clinica.value.contas,
      chegadas: dia.hotel.value.movimentos.filter((item) => item.tipo === 'chegada'),
    }
  }

  const outro = outrosDias.value.get(escolhido.value!)

  return {
    carregando: !outro || outro.carga === 'carregando',
    falhou: outro?.carga === 'falhou',
    fechada: outro?.fechada ?? false,
    feriado: outro?.feriado ?? null,
    contas: outro?.contas ?? [],
    chegadas: outro?.chegadas ?? [],
  }
})

const rotuloDoDia = computed(() => {
  if (ehHoje.value) return t('inicio.agenda.hoje')

  return selecionado.value ? dataPorExtenso(selecionado.value) : ''
})

const resumo = computed(() => {
  const partes: string[] = []

  if (props.clinica && !estado.value.fechada) {
    const total = estado.value.contas.length
    partes.push(t('inicio.dia.atendimentos', { total }, total))
  }

  if (props.hotel) {
    const total = estado.value.chegadas.length
    if (total > 0) partes.push(t('inicio.agenda.chegadas', { total }, total))
  }

  return partes.join(' · ')
})

type Tom = 'risco' | 'atencao' | 'lugar' | 'neutro'

type Compromisso = {
  id: string
  lugar: 'clinica' | 'hotel'
  hora: string
  titulo: string
  meta: string
  selo: { texto: string; tom: Tom } | null
  rosto: { nome: string; iniciais: string; especie: EspecieDoDia | null; fotoUrl: string }
  to: RouteLocationRaw
}

const SELO_DA_CONTA: Partial<Record<ContaDoDia['estado'], { chave: string; tom: Tom }>> = {
  agora: { chave: 'inicio.dia.estadoNome.agora', tom: 'lugar' },
  esperando: { chave: 'inicio.agenda.aguardando', tom: 'atencao' },
  falta: { chave: 'inicio.dia.estadoNome.falta', tom: 'risco' },
  feito: { chave: 'inicio.dia.estadoNome.feito', tom: 'neutro' },
}

function daConta(conta: ContaDoDia): Compromisso {
  const selo = SELO_DA_CONTA[conta.estado]

  return {
    id: conta.id,
    lugar: 'clinica',
    hora: horaDaParede(conta.inicio),
    titulo: conta.petNome,
    meta: [conta.tipo, conta.profissional].filter(Boolean).join(' · '),
    selo: selo ? { texto: t(selo.chave), tom: selo.tom } : null,
    rosto: {
      nome: conta.petNome,
      iniciais: conta.petIniciais,
      especie: conta.petEspecie,
      fotoUrl: conta.petFotoUrl,
    },
    to: conta.rota,
  }
}

function doMovimento(movimento: MovimentoDoDia, atrasado: boolean): Compromisso {
  const chegada = movimento.tipo === 'chegada'
  let selo: Compromisso['selo'] = null

  if (movimento.travado) {
    selo = chegada
      ? { texto: t('inicio.dia.movimento.travadoChegada'), tom: 'risco' }
      : { texto: t('inicio.dia.movimento.travadoSaida'), tom: 'atencao' }
  } else if (atrasado) {
    selo = { texto: t('inicio.dia.movimento.atrasado'), tom: 'atencao' }
  }

  return {
    id: movimento.id,
    lugar: 'hotel',
    hora: horaDaParede(movimento.quando),
    titulo: movimento.petNome,
    meta: [t(`inicio.dia.movimento.${chegada ? 'chegada' : 'saida'}`), movimento.detalhe]
      .filter(Boolean)
      .join(' · '),
    selo,
    rosto: {
      nome: movimento.petNome,
      iniciais: movimento.petIniciais,
      especie: movimento.petEspecie,
      fotoUrl: movimento.petFotoUrl,
    },
    to: movimento.rota,
  }
}

/** Os compromissos do dia, na ordem de `compromissosDoDia`. */
const compromissos = computed<Compromisso[]>(() => {
  const { contas, chegadas } = estado.value
  const agora = ehHoje.value ? dia.agora.value : null

  return compromissosDoDia(
    props.clinica ? contas : [],
    !props.hotel ? [] : agora === null ? chegadas : dia.hotel.value.movimentos,
    agora,
  ).map((item) =>
    item.tipo === 'conta' ? daConta(item.conta) : doMovimento(item.movimento, item.atrasado),
  )
})

const aberta = ref(false)

/* Outro dia, outra lista: volta recolhida. */
watch(selecionado, () => {
  aberta.value = false
})

const visiveis = computed(() =>
  aberta.value ? compromissos.value : compromissos.value.slice(0, LIMITE),
)
const escondidos = computed(() => Math.max(0, compromissos.value.length - LIMITE))

const vazio = computed(
  () => !estado.value.carregando && !estado.value.falhou && compromissos.value.length === 0,
)

const ICONE_DO_LUGAR = { clinica: 'ph ph-stethoscope', hotel: 'ph ph-bed' } as const

const rotaDaAgenda = computed<RouteLocationRaw>(() =>
  ehHoje.value || !selecionado.value
    ? '/clinica/agenda'
    : { path: '/clinica/agenda', query: { data: selecionado.value } },
)
</script>

<template>
  <UiSecao
    id="inicio-agenda"
    class="agenda"
    :titulo="t('inicio.agenda.tituloSemana')"
    :descricao="isGuidanceVisible ? t('inicio.guia.agenda') : undefined"
  >
    <template #acoes>
      <span class="agenda__mes">{{ mes }}</span>
      <span class="agenda__setas" role="group" :aria-label="t('inicio.agenda.semana')">
        <Button
          type="button"
          class="agenda__seta"
          severity="secondary"
          text
          rounded
          icon="ph ph-caret-left"
          :aria-label="t('inicio.agenda.anterior')"
          :title="t('inicio.agenda.anterior')"
          @click="andar(-1)"
        />
        <Button
          type="button"
          class="agenda__seta"
          severity="secondary"
          text
          rounded
          icon="ph ph-caret-right"
          :aria-label="t('inicio.agenda.proxima')"
          :title="t('inicio.agenda.proxima')"
          @click="andar(1)"
        />
      </span>
    </template>

    <div class="agenda__folha ui-folha">
      <ol class="semana" :aria-label="t('inicio.agenda.semana')">
        <li v-for="data in dias" :key="data">
          <button
            type="button"
            class="dia"
            :class="{ 'dia--escolhido': data === selecionado, 'dia--hoje': data === hoje }"
            :aria-pressed="data === selecionado"
            :aria-label="dataPorExtenso(data)"
            @click="escolher(data)"
          >
            <span class="dia__nome">{{ diaDaSemana(data) }}</span>
            <span class="dia__numero ui-num">{{ numeroDoDia(data) }}</span>
          </button>
        </li>
      </ol>

      <p class="agenda__dia" aria-live="polite">
        <strong>{{ rotuloDoDia }}</strong>
        <span v-if="!estado.carregando && resumo" class="agenda__resumo">{{ resumo }}</span>
      </p>

      <div
        v-if="estado.carregando"
        class="agenda__esqueleto"
        role="status"
        aria-busy="true"
        :aria-label="t('inicio.agenda.carregando')"
      >
        <div v-for="n in 3" :key="n" class="agenda__esqueleto-linha">
          <Skeleton width="2.75rem" height="14px" border-radius="6px" />
          <Skeleton shape="circle" size="32px" />
          <Skeleton width="45%" height="14px" border-radius="6px" />
        </div>
      </div>

      <p v-else-if="estado.falhou && compromissos.length === 0" class="ui-vazio">
        {{ t('inicio.agenda.falhou') }}
      </p>

      <p v-else-if="estado.fechada && compromissos.length === 0" class="ui-vazio">
        {{
          estado.feriado
            ? t('inicio.dia.feriado', { nome: estado.feriado })
            : t('inicio.agenda.fechada')
        }}
      </p>

      <p v-else-if="vazio" class="ui-vazio">{{ t('inicio.agenda.vazio') }}</p>

      <ul v-else class="ui-lista agenda__lista" :aria-label="t('inicio.agenda.compromissos')">
        <li v-for="item in visiveis" :key="item.id" :class="`pj-lugar--${item.lugar}`">
          <RouterLink class="ui-linha compromisso" :to="item.to">
            <span class="ui-hora compromisso__hora">{{ item.hora }}</span>
            <PetAvatar
              :nome="item.rosto.nome"
              :iniciais="item.rosto.iniciais"
              :especie="item.rosto.especie"
              :foto-url="item.rosto.fotoUrl"
              tamanho="sm"
            />
            <span class="ui-linha__texto">
              <strong class="ui-linha__titulo">{{ item.titulo }}</strong>
              <span class="ui-linha__meta compromisso__meta">
                <i
                  :class="ICONE_DO_LUGAR[item.lugar]"
                  class="compromisso__lugar"
                  aria-hidden="true"
                />
                {{ item.meta }}
              </span>
            </span>
            <span
              v-if="item.selo"
              class="ui-selo compromisso__selo"
              :class="`ui-selo--${item.selo.tom}`"
            >
              {{ item.selo.texto }}
            </span>
          </RouterLink>
        </li>
      </ul>

      <footer v-if="escondidos > 0 || clinica" class="agenda__pe">
        <Button
          v-if="escondidos > 0"
          type="button"
          size="small"
          severity="secondary"
          text
          :icon="aberta ? 'ph ph-caret-up' : 'ph ph-caret-down'"
          :label="
            aberta
              ? t('clinico.meuDia.pauta.mostrarMenos')
              : t('clinico.meuDia.pauta.mostrarMais', { total: escondidos })
          "
          :aria-expanded="aberta"
          @click="aberta = !aberta"
        />
        <RouterLink v-if="clinica" class="ui-mais agenda__completa" :to="rotaDaAgenda">
          {{ t('inicio.dia.abrirAgenda') }}
          <i class="ph ph-arrow-right agenda__seta-texto" aria-hidden="true" />
        </RouterLink>
      </footer>
    </div>
  </UiSecao>
</template>

<style scoped>
.agenda__mes {
  color: var(--tinta-2);
  font-size: 13.5px;
  font-weight: 500;
}

.agenda__setas {
  display: inline-flex;
  gap: 2px;
}

.agenda__seta.p-button {
  width: 36px;
  height: 36px;
  color: var(--tinta-2);
}

[dir='rtl'] .agenda__seta :deep(.p-button-icon) {
  scale: -1 1;
}

.agenda__folha {
  display: grid;
  overflow: hidden;
}

/* ------------------------------------------------------------------ a semana */

.semana {
  display: grid;
  gap: 4px;
  margin: 0;
  padding: 12px 12px 8px;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  list-style: none;
}

.dia {
  position: relative;
  display: grid;
  width: 100%;
  min-height: 56px;
  justify-items: center;
  align-content: center;
  gap: 2px;
  padding: 6px 0;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: var(--tinta);
  cursor: pointer;
  font: inherit;
  transition: background-color var(--pj-tempo-curto) ease;
}

.dia:hover {
  background: var(--superficie-2);
}

.dia:focus-visible {
  outline: 2px solid var(--musgo);
  outline-offset: 1px;
}

.dia__nome {
  color: var(--tinta-3);
  font-size: 12px;
  font-weight: 500;
}

.dia__numero {
  font-size: 17px;
  font-weight: 650;
}

/* Hoje: o número na cor da ação e um ponto embaixo, mesmo quando outro dia está escolhido. */
.dia--hoje .dia__numero {
  color: var(--musgo);
}

.dia--hoje::after {
  position: absolute;
  bottom: 5px;
  left: 50%;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: currentColor;
  content: '';
  translate: -50% 0;
}

.dia--escolhido,
.dia--escolhido:hover {
  background: var(--musgo);
  color: var(--sobre-musgo);
}

.dia--escolhido .dia__nome,
.dia--escolhido .dia__numero {
  color: var(--sobre-musgo);
}

/* ------------------------------------------------------------------ o dia */

.agenda__dia {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 10px;
  margin: 0;
  padding: 8px 18px 12px;
  border-bottom: 1px solid var(--linha);
  font-size: 14px;
}

.agenda__dia strong {
  font-weight: 600;
}

.agenda__resumo {
  color: var(--tinta-2);
  font-size: 13px;
}

.agenda__esqueleto-linha {
  display: flex;
  min-height: 56px;
  align-items: center;
  gap: 14px;
  padding: 10px 18px;
}

.agenda__esqueleto-linha + .agenda__esqueleto-linha {
  border-top: 1px solid var(--linha);
}

/* A lista fica dentro da folha: as pontas arredondadas dela são da folha, não da linha. */
.agenda__lista > li > .ui-linha {
  border-radius: 0;
}

.compromisso {
  min-height: 56px;
}

.compromisso__hora {
  width: 44px;
  flex: none;
}

.compromisso__meta {
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}

.compromisso__lugar {
  flex: none;
  color: var(--pj-lugar-tinta);
  font-size: 14px;
}

.compromisso__selo {
  flex: none;
}

.agenda__pe {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 16px;
  padding: 8px 12px 10px 18px;
  border-top: 1px solid var(--linha);
}

.agenda__completa {
  margin-inline-start: auto;
}

.agenda__seta-texto {
  font-size: 14px;
}

[dir='rtl'] .agenda__seta-texto {
  scale: -1 1;
}

@media (max-width: 520px) {
  .semana {
    gap: 2px;
    padding-inline: 6px;
  }

  /*
   * No celular o selo desce para baixo do nome: lado a lado, "Pesagem de saída pendente" espremia
   * o nome do animal até virar "B…".
   */
  .agenda__lista .compromisso {
    display: grid;
    align-items: center;
    gap: 4px 10px;
    padding-inline: 14px;
    grid-template-columns: 44px auto minmax(0, 1fr);
  }

  .agenda__lista .compromisso__selo {
    grid-column: 3;
    justify-self: start;
  }
}

@media (prefers-reduced-motion: reduce) {
  .dia {
    transition: none;
  }
}
</style>
