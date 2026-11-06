<script setup lang="ts">
/**
 * As prescrições da internação (E5-02a, guia e5 13): as ativas pela primeira dose, com a dose em
 * texto, a frequência e a próxima; as suspensas e terminadas recolhidas. O peso de entrada, base
 * de toda dose, fica à vista.
 *
 * O veterinário prescreve, troca a dose (a antiga para na hora) e suspende com motivo; a
 * enfermagem só lê. O que o animal tomava no hotel aparece no detalhe da internação.
 */
import Button from 'primevue/button'
import Textarea from 'primevue/textarea'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { motivoDaRecusa } from '@/composables/useSeloDeAssinatura'
import {
  listarPrescricoesDaInternacao,
  MOTIVO_DE_SUSPENDER_MAX,
  suspenderPrescricaoDaInternacao,
  type ListaDePrescricoes,
  type PrescricaoCriada,
  type PrescricaoDaInternacao,
} from '@/service/parceiro/plantao-da-internacao-service'

import PrescricaoNaInternacaoGaveta from './PrescricaoNaInternacaoGaveta.vue'

const props = defineProps<{
  internacaoId: string
  especie: string
  podePrescrever: boolean
}>()
const emit = defineEmits<{ mudou: [] }>()

const { t, te, locale } = useI18n()
const { parceiroQuery } = useParceiroPortal()

const lista = ref<ListaDePrescricoes | null>(null)
const carregando = ref(false)
const erro = ref('')
const recado = ref('')

async function carregar() {
  carregando.value = true
  erro.value = ''
  try {
    lista.value = await listarPrescricoesDaInternacao(props.internacaoId, parceiroQuery())
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('internacao.prescricao.erroAoCarregar')).mensagem
  } finally {
    carregando.value = false
  }
}

onMounted(() => void carregar())
watch(
  () => props.internacaoId,
  () => void carregar(),
)

defineExpose({ carregar })

function quando(valor: string | null) {
  if (!valor) return ''
  return new Date(valor).toLocaleString(locale.value, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function via(codigo: string | null) {
  if (!codigo) return ''
  return te(`clinico.bulario.api.via.${codigo}`) ? t(`clinico.bulario.api.via.${codigo}`) : codigo
}

/** A dose em texto já traz a via e a frequência ("365 mg, a cada 12 horas, via intravenosa"). */
function meta(item: PrescricaoDaInternacao) {
  const posologia = item.doseTexto
    ? [item.doseTexto]
    : [
        via(item.via),
        item.continuo
          ? t('internacao.prescricao.continuo')
          : t('internacao.prescricao.aCada', { n: item.frequenciaHoras }, item.frequenciaHoras),
      ]
  return [
    ...posologia,
    item.proximaEm ? t('internacao.prescricao.proxima', { quando: quando(item.proximaEm) }) : '',
  ]
    .filter(Boolean)
    .join(' · ')
}

/** A conta e o que o animal recebe, quando diferem (o arredondamento do comprimido). */
function doseReal(item: PrescricaoDaInternacao) {
  const dose = item.dose
  if (!dose || Math.abs(dose.mgReal - dose.mgPorAdministracao) < 0.01) return ''
  const formato = new Intl.NumberFormat(locale.value, { maximumFractionDigits: 2 })
  return t('internacao.prescricao.real', {
    real: formato.format(dose.mgReal),
    conta: formato.format(dose.mgPorAdministracao),
  })
}

function metaInativa(item: PrescricaoDaInternacao) {
  if (item.suspensao)
    return t('internacao.prescricao.suspensaEm', {
      quando: quando(item.suspensao.em),
      motivo: item.suspensao.motivo,
    })
  return t('internacao.prescricao.terminou', { quando: quando(item.encerraEm) })
}

const pesoTexto = computed(() => {
  const peso = lista.value?.peso
  if (!peso) return ''
  return t(
    'internacao.prescricao.peso',
    {
      kg: new Intl.NumberFormat(locale.value, { maximumFractionDigits: 2 }).format(peso.pesoBaseKg),
      dias: peso.aferidoHaDias,
    },
    peso.aferidoHaDias,
  )
})

const inativasAbertas = ref(false)

/* ----------------------------------------------------------------- prescrever e trocar */

const gavetaAberta = ref(false)
const trocando = ref<PrescricaoDaInternacao | null>(null)

function prescrever(antiga: PrescricaoDaInternacao | null) {
  trocando.value = antiga
  gavetaAberta.value = true
}

function prescrita(criada: PrescricaoCriada) {
  recado.value = [
    t('internacao.prescricao.feita', { n: criada.dosesCriadas }, criada.dosesCriadas),
    criada.responsabilidade,
  ]
    .filter(Boolean)
    .join(' ')
  void carregar()
  emit('mudou')
}

/* ---------------------------------------------------------------------------- suspender */

const suspenderAberta = ref(false)
const paraSuspender = ref<PrescricaoDaInternacao | null>(null)
const motivo = ref('')
const tentou = ref(false)
const suspendendo = ref(false)
const erroDoSuspender = ref('')

function abrirSuspender(item: PrescricaoDaInternacao) {
  paraSuspender.value = item
  motivo.value = ''
  tentou.value = false
  erroDoSuspender.value = ''
  suspenderAberta.value = true
}

async function suspender() {
  tentou.value = true
  erroDoSuspender.value = ''
  if (!paraSuspender.value || !motivo.value.trim()) return
  suspendendo.value = true
  try {
    const feita = await suspenderPrescricaoDaInternacao(
      props.internacaoId,
      paraSuspender.value.id,
      motivo.value.trim(),
      parceiroQuery(),
    )
    suspenderAberta.value = false
    recado.value = t(
      'internacao.prescricao.suspensa',
      { n: feita.dosesSuspensas },
      feita.dosesSuspensas,
    )
    void carregar()
    emit('mudou')
  } catch (err) {
    const recusa = motivoDaRecusa(err)
    erroDoSuspender.value = recusa
      ? t(`internacao.selo.${recusa}`)
      : lerErroDoCadastro(err, t('internacao.prescricao.erroSuspender')).mensagem
  } finally {
    suspendendo.value = false
  }
}
</script>

<template>
  <section class="ui-folha ui-cartao" aria-labelledby="pd-titulo" :aria-busy="carregando">
    <header class="ui-cartao__cabeca">
      <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-prescription" /></span>
      <span class="ui-cartao__titulos">
        <h2 id="pd-titulo" class="ui-cartao__titulo">{{ t('internacao.prescricao.lista') }}</h2>
        <p v-if="pesoTexto" class="ui-cartao__descricao">{{ pesoTexto }}</p>
      </span>
      <Button
        v-if="podePrescrever"
        type="button"
        size="small"
        icon="ph ph-plus"
        :label="t('internacao.prescricao.acao')"
        @click="prescrever(null)"
      />
    </header>

    <p v-if="recado" class="eg__aviso pd__nota" role="status">
      <i class="ph ph-check-circle" aria-hidden="true" />
      <span>{{ recado }}</span>
    </p>
    <p v-if="erro" class="eg__erro pd__nota" role="alert">
      <i class="ph ph-warning-circle" aria-hidden="true" />
      <span>{{ erro }}</span>
    </p>

    <ul v-if="lista?.ativas.length" class="ui-lista">
      <li v-for="item in lista.ativas" :key="item.id" class="ui-linha">
        <span class="ui-linha__texto">
          <strong class="ui-linha__titulo">{{ item.descricao }}</strong>
          <span class="ui-linha__meta">{{ meta(item) }}</span>
          <span v-if="doseReal(item)" class="ui-linha__meta">{{ doseReal(item) }}</span>
          <span class="ui-linha__meta">{{
            t('internacao.prescricao.por', {
              nome: item.prescritoPor.nome,
              quando: quando(item.prescritoEm),
            })
          }}</span>
        </span>
        <span v-if="podePrescrever" class="ui-linha__fim pd__acoes">
          <Button
            type="button"
            size="small"
            severity="secondary"
            outlined
            :label="t('internacao.prescricao.trocarDose')"
            @click="prescrever(item)"
          />
          <Button
            type="button"
            size="small"
            severity="secondary"
            outlined
            :label="t('internacao.prescricao.suspender')"
            @click="abrirSuspender(item)"
          />
        </span>
      </li>
    </ul>
    <p v-else-if="lista" class="pd__nota pd__vazio">{{ t('internacao.prescricao.vazio') }}</p>

    <template v-if="lista?.inativas.length">
      <Button
        type="button"
        size="small"
        severity="secondary"
        outlined
        class="pd__mais"
        :icon="inativasAbertas ? 'ph ph-caret-up' : 'ph ph-caret-down'"
        :label="t('internacao.prescricao.inativas', { n: lista.inativas.length })"
        :aria-expanded="inativasAbertas"
        @click="inativasAbertas = !inativasAbertas"
      />
      <ul v-show="inativasAbertas" class="ui-lista pd__inativas">
        <li v-for="item in lista.inativas" :key="item.id" class="ui-linha">
          <span class="ui-linha__texto">
            <strong class="ui-linha__titulo">{{ item.descricao }}</strong>
            <span class="ui-linha__meta">{{ metaInativa(item) }}</span>
          </span>
        </li>
      </ul>
    </template>

    <PrescricaoNaInternacaoGaveta
      v-model:visible="gavetaAberta"
      :internacao-id="internacaoId"
      :especie="especie"
      :peso="lista?.peso ?? null"
      :substitui="trocando"
      @prescrita="prescrita"
    />

    <CadastroGaveta
      v-model:visible="suspenderAberta"
      :titulo="t('internacao.prescricao.suspenderTitulo', { nome: paraSuspender?.descricao ?? '' })"
      icone="ph ph-pause-circle"
    >
      <form id="suspender-prescricao" class="eg" novalidate @submit.prevent="suspender">
        <p class="eg__dica">{{ t('internacao.prescricao.suspenderDica') }}</p>
        <section class="eg__secao">
          <label class="eg__rotulo" for="sp-motivo">{{ t('internacao.prescricao.motivo') }}</label>
          <Textarea
            id="sp-motivo"
            v-model="motivo"
            rows="3"
            auto-resize
            :maxlength="MOTIVO_DE_SUSPENDER_MAX"
            :invalid="tentou && !motivo.trim()"
            :disabled="suspendendo"
          />
        </section>
        <p v-if="erroDoSuspender" class="eg__erro" role="alert">
          <i class="ph ph-warning-circle" aria-hidden="true" />
          <span>{{ erroDoSuspender }}</span>
        </p>
      </form>
      <template #pe>
        <Button
          type="button"
          severity="secondary"
          outlined
          :label="t('cadastro.cancelar')"
          :disabled="suspendendo"
          @click="suspenderAberta = false"
        />
        <Button
          type="submit"
          form="suspender-prescricao"
          icon="ph ph-pause-circle"
          :label="t('internacao.prescricao.suspender')"
          :loading="suspendendo"
        />
      </template>
    </CadastroGaveta>
  </section>
</template>

<style scoped>
.pd__nota {
  margin: 0;
  padding: 0 24px 12px;
}

.pd__vazio {
  color: var(--tinta-2);
  font-size: 14px;
}

.pd__acoes {
  display: inline-flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
}

.pd__mais {
  justify-self: start;
  margin: 4px 24px 16px;
}

.pd__inativas {
  opacity: 0.8;
}
</style>
