<script setup lang="ts">
/**
 * Um leito no mapa da internação pela API (E5-01b, guia e5 9). O mesmo desenho do ladrilho da
 * demonstração, com duas regras da API:
 *
 * - o cartão se pinta pela **urgência** (`URGENTE`, `ATENCAO`), nunca pela gravidade; a gravidade
 *   é o selo com palavra;
 * - **nenhum texto clínico** (motivo, diagnóstico, observação): a tela pode ir para a TV do
 *   plantão. O ladrilho diz o animal, o leito, a gravidade, há quanto tempo e o que cobra ação.
 *
 * O vazio ocupa o mesmo espaço (a planta responde "onde há vaga"); o fora de operação fica no
 * lugar, hachurado. O ladrilho ocupado inteiro abre a internação.
 */
import Button from 'primevue/button'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import PetAvatar from '@/features/hotel/components/base/PetAvatar.vue'
import type { CelulaDoMapa } from '@/service/parceiro/internacao-service'

import { ICONE_DO_KIND, TOM_DA_GRAVIDADE, TOM_DA_URGENCIA } from './rotulos-da-internacao'

const props = defineProps<{ celula: CelulaDoMapa; podeInternar: boolean }>()
const emit = defineEmits<{ abrir: [internacaoId: string]; internar: [leitoId: string] }>()

const { t } = useI18n()

const internado = computed(() => props.celula.internacao)

const estado = computed(() => {
  if (internado.value) return 'ocupado'
  return props.celula.leito.ativo ? 'livre' : 'inativo'
})

const tom = computed(() =>
  internado.value ? TOM_DA_URGENCIA[internado.value.urgencia.nivel] : 'neutro',
)

function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  return partes
    .slice(0, 2)
    .map((parte) => parte[0])
    .join('')
    .toLocaleUpperCase()
}

/** O que cobra ação, em palavras: alergia nova, boletim, doses, alta vencida. */
const cobrancas = computed(() => {
  const item = internado.value
  if (!item) return []
  const lista: { chave: string; icone: string; texto: string; forte?: boolean }[] = []
  for (const motivo of item.urgencia.motivos) {
    if (motivo === 'ALERGIA_NOVA')
      lista.push({
        chave: motivo,
        icone: 'ph ph-warning-octagon',
        texto: t('internacao.urgencia.ALERGIA_NOVA'),
        forte: true,
      })
    else if (motivo === 'BOLETIM_RETIDO')
      lista.push({
        chave: motivo,
        icone: 'ph ph-phone',
        texto: t('internacao.urgencia.BOLETIM_RETIDO'),
        forte: true,
      })
    else if (motivo === 'DOSES_ATRASADAS')
      lista.push({
        chave: motivo,
        icone: 'ph ph-clock-countdown',
        texto: t(
          'internacao.urgencia.DOSES_ATRASADAS',
          { n: item.sinais.dosesAtrasadas },
          item.sinais.dosesAtrasadas,
        ),
      })
    else if (motivo === 'DOSE_PROXIMA')
      lista.push({
        chave: motivo,
        icone: 'ph ph-clock',
        texto: t('internacao.urgencia.DOSE_PROXIMA', { n: item.sinais.proximaEmMinutos ?? 0 }),
      })
    else if (motivo === 'ALTA_PREVISTA_VENCIDA')
      lista.push({
        chave: motivo,
        icone: 'ph ph-calendar-x',
        texto: t('internacao.urgencia.ALTA_PREVISTA_VENCIDA'),
      })
  }
  if (!lista.length && item.altaPrevistaHoje)
    lista.push({ chave: 'hoje', icone: 'ph ph-calendar-check', texto: t('internacao.altaHoje') })
  return lista
})
</script>

<template>
  <article
    class="lm"
    :class="[
      `lm--${estado}`,
      internado && tom !== 'neutro' ? ['ui-marca', `ui-marca--${tom}`, `lm--${tom}`] : [],
      { 'lm--clicavel': internado },
    ]"
  >
    <header class="lm__topo">
      <span class="ui-ladrilho ui-ladrilho--p lm__desenho" aria-hidden="true">
        <i :class="ICONE_DO_KIND[celula.leito.kind]" />
      </span>
      <span class="lm__nome ui-num">{{ celula.leito.nome }}</span>
      <span
        v-if="internado"
        class="ui-selo"
        :class="`ui-selo--${TOM_DA_GRAVIDADE[internado.gravidade]}`"
        >{{ t(`internacao.gravidade.${internado.gravidade}`) }}</span
      >
    </header>

    <template v-if="internado">
      <button type="button" class="lm__paciente" @click="emit('abrir', internado.id)">
        <PetAvatar
          :nome="internado.paciente.nome"
          :iniciais="iniciais(internado.paciente.nome)"
          :especie="null"
          tamanho="md"
        />
        <span class="lm__identidade">
          <strong class="lm__pet">{{ internado.paciente.nome }}</strong>
          <span class="lm__meta">
            {{ t('internacao.horas', { n: internado.horasInternado }, internado.horasInternado) }}
            · {{ internado.responsavel.nome }}
          </span>
        </span>
      </button>

      <p v-if="cobrancas.length" class="lm__cobrancas">
        <span
          v-for="item in cobrancas"
          :key="item.chave"
          class="ui-selo"
          :class="
            item.forte
              ? 'ui-selo--risco lm__selo-forte'
              : `ui-selo--${tom === 'neutro' ? 'contorno' : tom}`
          "
        >
          <i :class="item.icone" aria-hidden="true" />
          {{ item.texto }}
        </span>
      </p>
      <p v-if="internado.abertaSemRegistro" class="lm__parado">
        <i class="ph ph-pause-circle" aria-hidden="true" />
        {{ t('internacao.semRegistroCurto', { n: internado.abertaSemRegistro.horas }) }}
      </p>
    </template>

    <p v-else-if="!celula.leito.ativo" class="lm__fora">
      <i class="ph ph-wrench" aria-hidden="true" />
      <span>
        <strong>{{ t('internacao.foraDeOperacao') }}</strong>
        <small v-if="celula.leito.motivoInativo">{{
          t(`internacao.leitos.motivo.${celula.leito.motivoInativo}`)
        }}</small>
      </span>
    </p>

    <template v-else>
      <p class="lm__vago">
        <i class="ph ph-bed" aria-hidden="true" />
        <strong>{{ t('internacao.livre') }}</strong>
      </p>
      <Button
        v-if="podeInternar"
        type="button"
        class="lm__internar"
        :label="t('internacao.internar.acao')"
        icon="ph ph-plus"
        severity="secondary"
        outlined
        size="small"
        @click="emit('internar', celula.leito.id)"
      />
    </template>
  </article>
</template>

<style scoped>
.lm {
  position: relative;
  display: flex;
  min-width: 0;
  min-height: 168px;
  flex-direction: column;
  gap: 12px;
  padding: 14px 16px 14px 18px;
  border: 1px solid var(--linha);
  border-radius: var(--raio-cartao-pequeno);
  background: var(--superficie);
  box-shadow: var(--sombra-cartao);
  color: var(--tinta);
  transition:
    border-color 150ms ease-out,
    box-shadow 150ms ease-out;
}

.lm--clicavel {
  cursor: pointer;
}

.lm--clicavel:hover {
  border-color: var(--linha-media);
  box-shadow: var(--sombra-2);
}

/* O urgente se acha de longe: a borda tingida. */
.lm--risco {
  border-color: color-mix(in oklab, var(--risco) 50%, var(--linha));
}

.lm--livre {
  border-style: dashed;
  border-color: color-mix(in oklab, var(--ok) 45%, var(--linha-media));
  background: color-mix(in oklab, var(--superficie) 70%, transparent);
  box-shadow: none;
}

.lm--inativo {
  border-style: dashed;
  border-color: var(--linha-media);
  background:
    repeating-linear-gradient(
      -45deg,
      transparent 0 9px,
      color-mix(in oklab, var(--linha) 75%, transparent) 9px 10px
    ),
    color-mix(in oklab, var(--superficie) 55%, transparent);
  box-shadow: none;
}

.lm__topo {
  display: flex;
  min-height: 30px;
  align-items: center;
  gap: 10px;
}

.lm__desenho {
  font-size: 15px;
}

.lm--livre .lm__desenho,
.lm--inativo .lm__desenho {
  background: var(--superficie-2);
  color: var(--tinta-3);
}

.lm__nome {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  font-size: 15px;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lm--livre .lm__nome,
.lm--inativo .lm__nome {
  color: var(--tinta-2);
}

.lm__paciente {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 12px;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  cursor: pointer;
  font: inherit;
  text-align: start;
}

/* O botão do paciente se estende pelo ladrilho inteiro. */
.lm__paciente::after {
  position: absolute;
  border-radius: var(--raio-cartao-pequeno);
  content: '';
  inset: 0;
}

.lm__paciente:focus-visible {
  outline: none;
}

.lm__paciente:focus-visible::after {
  outline: 2px solid var(--pj-lugar, var(--musgo));
  outline-offset: 2px;
}

.lm__identidade {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.lm__pet {
  overflow-wrap: anywhere;
  font-size: 15px;
  font-weight: 650;
  line-height: 1.3;
}

.lm__meta {
  color: var(--tinta-2);
  font-size: 13px;
}

.lm__cobrancas {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
}

.lm__cobrancas .ui-selo {
  max-width: 100%;
  white-space: normal;
}

/* Boletim e alergia nova: o selo cheio, alguém precisa agir agora. */
.lm__selo-forte.ui-selo {
  background: var(--risco-tinta);
  color: var(--superficie);
}

.lm__parado {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  color: var(--atencao-tinta);
  font-size: 12.5px;
}

.lm__vago {
  display: grid;
  flex: 1;
  align-content: center;
  justify-items: center;
  gap: 8px;
  margin: 0;
  color: var(--ok-tinta);
  font-size: 14px;
}

.lm__vago > i {
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  border: 1.5px dashed color-mix(in oklab, var(--ok) 60%, var(--linha));
  border-radius: 50%;
  background: color-mix(in oklab, var(--ok-fundo) 60%, transparent);
  font-size: 19px;
}

.lm__internar {
  align-self: stretch;
}

.lm__fora {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin: 0;
  color: var(--tinta-2);
}

.lm__fora > i {
  display: grid;
  width: 34px;
  height: 34px;
  flex: none;
  place-items: center;
  border-radius: 50%;
  background: var(--atencao-fundo);
  color: var(--atencao-tinta);
  font-size: 16px;
}

.lm__fora span {
  display: grid;
  gap: 2px;
}

.lm__fora strong {
  color: var(--tinta);
  font-size: 14px;
  font-weight: 600;
}

.lm__fora small {
  font-size: 12.5px;
}

@media (prefers-reduced-motion: reduce) {
  .lm {
    transition: none;
  }
}
</style>
