<script setup lang="ts">
/**
 * As exigências de admissão (E7-01, guia e7 10): o que o hóspede apresenta na entrada. A que
 * impede a entrada leva o selo; a que só avisa fica neutra. Todo papel que lê a casa lê as
 * exigências (não há dinheiro nelas); escrever é de quem edita a casa.
 */
import Button from 'primevue/button'
import { useToast } from 'primevue/usetoast'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import {
  apagarExigencia,
  KINDS_DE_EXIGENCIA,
  listarVacinasParaExigencia,
  type CasaDoHotel,
  type ExigenciaDaCasa,
  type VacinaParaExigencia,
} from '@/service/parceiro/hotel-casa-service'

import ExigenciaGaveta from './ExigenciaGaveta.vue'
import { useRotulosDaCasa } from './useRotulosDaCasa'
import './casa.css'

const props = defineProps<{ casa: CasaDoHotel; podeEditar: boolean }>()
const emit = defineEmits<{ mudou: [] }>()

const { t } = useI18n()
const rotulos = useRotulosDaCasa()
const toast = useToast()
const { parceiroQuery } = useParceiroPortal()

const erro = ref('')
const mexendo = ref<string | null>(null)
const vacinas = ref<VacinaParaExigencia[]>([])

onMounted(async () => {
  vacinas.value = await listarVacinasParaExigencia(null, parceiroQuery()).catch(() => [])
})

const existentes = computed(() => props.casa.exigencias.map((e) => e.kind))
const faltam = computed(() => KINDS_DE_EXIGENCIA.some((k) => !existentes.value.includes(k)))

function meta(e: ExigenciaDaCasa) {
  return [
    e.especies.length
      ? e.especies.map(rotulos.especie).join(', ')
      : t('casaDoHotel.exigencia.todas'),
    e.validadeMeses === null
      ? t('casaDoHotel.exigencia.naoVence').toLocaleLowerCase()
      : t('casaDoHotel.exigencia.meses', { n: e.validadeMeses }, e.validadeMeses),
    vacinas.value.find((v) => v.id === e.vacinaDoCatalogoId)?.nome ?? '',
    e.aceitaDeclarada ? t('casaDoHotel.exigencia.aceitaDeclaradaCurta') : '',
  ]
    .filter(Boolean)
    .join(' · ')
    .replace(/^./, (letra) => letra.toLocaleUpperCase())
}

async function apagar(e: ExigenciaDaCasa) {
  erro.value = ''
  mexendo.value = e.id
  try {
    await apagarExigencia(e.id, parceiroQuery())
    toast.add({
      severity: 'success',
      summary: t('casaDoHotel.apagado', { nome: rotulos.exigencia(e.kind) }),
      life: 3000,
    })
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('cadastro.erros.salvar')).mensagem
  } finally {
    mexendo.value = null
    emit('mudou')
  }
}

const aberta = ref(false)
const emEdicao = ref<ExigenciaDaCasa | null>(null)

function abrir(e: ExigenciaDaCasa | null) {
  emEdicao.value = e
  aberta.value = true
}
</script>

<template>
  <section class="ui-folha ui-cartao" aria-labelledby="exigencias-titulo">
    <header class="ui-cartao__cabeca">
      <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-identification-card" /></span>
      <span class="ui-cartao__titulos">
        <h2 id="exigencias-titulo" class="ui-cartao__titulo">
          {{ t('casaDoHotel.exigencia.titulo') }}
        </h2>
        <p class="ui-cartao__descricao">{{ t('casaDoHotel.exigencia.descricao') }}</p>
      </span>
      <Button
        v-if="podeEditar && faltam"
        type="button"
        size="small"
        icon="ph ph-plus"
        :label="t('casaDoHotel.exigencia.nova')"
        @click="abrir(null)"
      />
    </header>

    <p v-if="erro" class="ca__erro" role="alert">{{ erro }}</p>
    <p v-if="!props.casa.exigencias.length" class="ca__nota">
      {{ t('casaDoHotel.exigencia.vazio') }}
    </p>

    <ul v-else class="ui-lista">
      <li v-for="e in props.casa.exigencias" :key="e.id" class="ui-linha">
        <span class="ui-linha__texto">
          <span class="ca__nome">
            <strong class="ui-linha__titulo">{{ rotulos.exigencia(e.kind) }}</strong>
            <span class="ui-selo" :class="e.bloqueia ? 'ui-selo--atencao' : 'ui-selo--contorno'">{{
              e.bloqueia ? t('casaDoHotel.exigencia.impede') : t('casaDoHotel.exigencia.soAvisa')
            }}</span>
          </span>
          <span class="ui-linha__meta">{{ meta(e) }}</span>
        </span>
        <span v-if="podeEditar" class="ui-linha__fim ca__acoes">
          <Button
            type="button"
            size="small"
            severity="secondary"
            outlined
            icon="ph ph-pencil-simple"
            :aria-label="t('casaDoHotel.planta.editarDe', { nome: rotulos.exigencia(e.kind) })"
            @click="abrir(e)"
          />
          <Button
            type="button"
            size="small"
            severity="secondary"
            outlined
            icon="ph ph-trash"
            :aria-label="t('casaDoHotel.planta.apagarDe', { nome: rotulos.exigencia(e.kind) })"
            :disabled="mexendo !== null"
            :loading="mexendo === e.id"
            @click="apagar(e)"
          />
        </span>
      </li>
    </ul>

    <ExigenciaGaveta
      v-model:visible="aberta"
      :exigencia="emEdicao"
      :existentes="existentes"
      :vacinas="vacinas"
      @salvo="emit('mudou')"
    />
  </section>
</template>
