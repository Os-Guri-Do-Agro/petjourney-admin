<script setup lang="ts">
/**
 * Vacina da clínica: criar e editar (E4-02, guia e4 1.6 e 1.7). O protocolo da série do filhote é
 * a pergunta clínica em aberto: `FIXA` (n doses, uma a cada intervalo) ou `ATE_IDADE_MINIMA` (no
 * mínimo n, repetindo até uma ser dada com a idade mínima). A conta do plano vacinal é da API.
 */
import Button from 'primevue/button'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import MultiSelect from 'primevue/multiselect'
import SelectButton from 'primevue/selectbutton'
import ToggleSwitch from 'primevue/toggleswitch'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { criarChaveadorDeIdempotencia } from '@/service/idempotencia'
import {
  criarAcrescimo,
  editarAcrescimo,
  ESPECIES_DO_CATALOGO,
  type NovaVacina,
  type Vacina,
} from '@/service/parceiro/catalogos-service'

const props = defineProps<{ vacina: Vacina | null }>()
const aberta = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{ salvo: [] }>()

const { t } = useI18n()
const { parceiroQuery } = useParceiroPortal()
const chaveador = criarChaveadorDeIdempotencia()

const VIAS = ['SUBCUTANEA', 'INTRAMUSCULAR', 'INTRANASAL', 'ORAL'] as const

const nome = ref('')
const fabricante = ref('')
const especies = ref<string[]>(['CACHORRO'])
const vias = ref<string[]>(['SUBCUTANEA'])
const dosesFilhote = ref<number | null>(3)
const dosesAdulto = ref<number | null>(1)
const idadeMinima = ref<number | null>(42)
const intervaloEntreDoses = ref<number | null>(28)
const intervaloReforco = ref<number | null>(365)
const modo = ref<'FIXA' | 'ATE_IDADE_MINIMA'>('FIXA')
const idadeUltimaDose = ref<number | null>(112)
const essencial = ref(true)
const obrigatoria = ref(false)
const estoqueMinimo = ref<number | null>(5)

const salvando = ref(false)
const tentou = ref(false)
const erroNoNome = ref('')
const erroGeral = ref('')

watch(aberta, (agora) => {
  if (!agora) return
  const v = props.vacina
  tentou.value = false
  erroNoNome.value = ''
  erroGeral.value = ''
  nome.value = v?.nome ?? ''
  fabricante.value = v?.fabricante ?? ''
  especies.value = v ? [...v.especies] : ['CACHORRO']
  vias.value = v ? [...v.vias] : ['SUBCUTANEA']
  dosesFilhote.value = v?.dosesSerieFilhote ?? 3
  dosesAdulto.value = v?.dosesSerieAdultoSemHistorico ?? 1
  idadeMinima.value = v?.idadeMinimaDias ?? 42
  intervaloEntreDoses.value = v?.intervaloEntreDosesDias ?? 28
  intervaloReforco.value = v?.intervaloReforcoDias ?? 365
  modo.value = v?.modoSerieFilhote ?? 'FIXA'
  idadeUltimaDose.value = v?.idadeMinimaUltimaDoseFilhoteDias ?? 112
  essencial.value = v?.essencial ?? true
  obrigatoria.value = v?.obrigatoria ?? false
  estoqueMinimo.value = v?.estoqueMinimoPadrao ?? 5
})

const opcoesDeEspecie = computed(() =>
  ESPECIES_DO_CATALOGO.map((valor) => ({ valor, rotulo: t(`cadastro.especie.${valor}`) })),
)
const opcoesDeVia = computed(() =>
  VIAS.map((valor) => ({ valor, rotulo: t(`clinico.bulario.api.via.${valor}`) })),
)
const opcoesDeModo = computed(() => [
  { valor: 'FIXA', rotulo: t('catalogo.vacina.modo.FIXA') },
  { valor: 'ATE_IDADE_MINIMA', rotulo: t('catalogo.vacina.modo.ATE_IDADE_MINIMA') },
])

const valido = computed(
  () =>
    nome.value.trim().length >= 2 &&
    especies.value.length > 0 &&
    vias.value.length > 0 &&
    dosesFilhote.value !== null &&
    dosesAdulto.value !== null &&
    idadeMinima.value !== null &&
    intervaloReforco.value !== null &&
    (modo.value === 'FIXA' || idadeUltimaDose.value !== null),
)

function corpo(): NovaVacina {
  return {
    nome: nome.value.trim(),
    fabricante: fabricante.value.trim() || null,
    especies: especies.value as NovaVacina['especies'],
    vias: vias.value as NovaVacina['vias'],
    dosesSerieFilhote: dosesFilhote.value!,
    dosesSerieAdultoSemHistorico: dosesAdulto.value!,
    idadeMinimaDias: idadeMinima.value!,
    intervaloEntreDosesDias: intervaloEntreDoses.value ?? undefined,
    intervaloReforcoDias: intervaloReforco.value!,
    modoSerieFilhote: modo.value,
    idadeMinimaUltimaDoseFilhoteDias:
      modo.value === 'ATE_IDADE_MINIMA' ? idadeUltimaDose.value : null,
    essencial: essencial.value,
    obrigatoria: obrigatoria.value,
    estoqueMinimoPadrao: estoqueMinimo.value ?? undefined,
  }
}

async function salvar() {
  tentou.value = true
  erroNoNome.value = ''
  erroGeral.value = ''
  if (!valido.value) return
  salvando.value = true
  const dados = corpo()
  try {
    if (props.vacina) {
      await editarAcrescimo('vacinas', props.vacina.id, dados, parceiroQuery())
    } else {
      await criarAcrescimo('vacinas', dados, chaveador.para(dados), parceiroQuery())
      chaveador.concluir()
    }
    aberta.value = false
    emit('salvo')
  } catch (err) {
    const lido = lerErroDoCadastro(err, t('cadastro.erros.salvar'))
    if (lido.codigo === 'CATALOGO_NOME_EM_USO') erroNoNome.value = t('catalogo.erro.nomeEmUso')
    else erroGeral.value = lido.mensagem
  } finally {
    salvando.value = false
  }
}
</script>

<template>
  <CadastroGaveta
    v-model:visible="aberta"
    :titulo="vacina ? t('catalogo.vacina.editar') : t('catalogo.vacina.nova')"
    icone="ph ph-syringe"
    largura="36rem"
  >
    <form id="vacina-form" class="eg" novalidate @submit.prevent="salvar">
      <div class="eg__grupo">
        <h3 class="eg__grupo-titulo">{{ t('catalogo.vacina.oQueE') }}</h3>
        <section class="eg__secao">
          <label class="eg__rotulo" for="vac-nome">{{ t('catalogo.vacina.nome') }}</label>
          <InputText
            id="vac-nome"
            v-model="nome"
            maxlength="120"
            :invalid="(tentou && nome.trim().length < 2) || Boolean(erroNoNome)"
            :disabled="salvando"
          />
          <small v-if="erroNoNome" class="eg__invalido">{{ erroNoNome }}</small>
        </section>
        <section class="eg__secao">
          <label class="eg__rotulo" for="vac-fabricante">
            {{ t('catalogo.vacina.fabricante') }}
            <span class="eg__opcional">{{ t('cadastro.opcional') }}</span>
          </label>
          <InputText
            id="vac-fabricante"
            v-model="fabricante"
            maxlength="120"
            :disabled="salvando"
          />
        </section>
        <div class="eg__linha">
          <section class="eg__secao">
            <label class="eg__rotulo" for="vac-especies">{{ t('catalogo.vacina.especies') }}</label>
            <MultiSelect
              v-model="especies"
              input-id="vac-especies"
              :options="opcoesDeEspecie"
              option-label="rotulo"
              option-value="valor"
              display="chip"
              :invalid="tentou && !especies.length"
              :disabled="salvando"
            />
          </section>
          <section class="eg__secao">
            <label class="eg__rotulo" for="vac-vias">{{ t('clinico.bulario.vias') }}</label>
            <MultiSelect
              v-model="vias"
              input-id="vac-vias"
              :options="opcoesDeVia"
              option-label="rotulo"
              option-value="valor"
              display="chip"
              :invalid="tentou && !vias.length"
              :disabled="salvando"
            />
          </section>
        </div>
      </div>

      <div class="eg__grupo">
        <h3 class="eg__grupo-titulo">{{ t('catalogo.vacina.serie') }}</h3>
        <div class="eg__linha">
          <section class="eg__secao">
            <label class="eg__rotulo" for="vac-filhote">{{
              t('catalogo.vacina.dosesFilhote')
            }}</label>
            <InputNumber
              v-model="dosesFilhote"
              input-id="vac-filhote"
              :min="1"
              :max="10"
              show-buttons
              :disabled="salvando"
            />
          </section>
          <section class="eg__secao">
            <label class="eg__rotulo" for="vac-adulto">{{
              t('catalogo.vacina.dosesAdulto')
            }}</label>
            <InputNumber
              v-model="dosesAdulto"
              input-id="vac-adulto"
              :min="1"
              :max="10"
              show-buttons
              :disabled="salvando"
            />
          </section>
        </div>
        <div class="eg__linha">
          <section class="eg__secao">
            <label class="eg__rotulo" for="vac-idade">{{ t('catalogo.vacina.idadeMinima') }}</label>
            <InputNumber
              v-model="idadeMinima"
              input-id="vac-idade"
              :min="0"
              :max="3650"
              :suffix="` ${t('catalogo.vacina.dias')}`"
              :disabled="salvando"
            />
          </section>
          <section class="eg__secao">
            <label class="eg__rotulo" for="vac-entre">{{ t('catalogo.vacina.entreDoses') }}</label>
            <InputNumber
              v-model="intervaloEntreDoses"
              input-id="vac-entre"
              :min="1"
              :max="365"
              :suffix="` ${t('catalogo.vacina.dias')}`"
              :disabled="salvando"
            />
          </section>
        </div>
        <section class="eg__secao">
          <span id="vac-modo" class="eg__rotulo">{{ t('catalogo.vacina.modoRotulo') }}</span>
          <SelectButton
            v-model="modo"
            :options="opcoesDeModo"
            option-label="rotulo"
            option-value="valor"
            :allow-empty="false"
            aria-labelledby="vac-modo"
            :disabled="salvando"
          />
          <small class="eg__dica">{{ t(`catalogo.vacina.modoDica.${modo}`) }}</small>
        </section>
        <section v-if="modo === 'ATE_IDADE_MINIMA'" class="eg__secao">
          <label class="eg__rotulo" for="vac-ultima">{{
            t('catalogo.vacina.idadeUltimaDose')
          }}</label>
          <InputNumber
            v-model="idadeUltimaDose"
            input-id="vac-ultima"
            :min="1"
            :max="3650"
            :suffix="` ${t('catalogo.vacina.dias')}`"
            :invalid="tentou && idadeUltimaDose === null"
            :disabled="salvando"
          />
        </section>
        <section class="eg__secao">
          <label class="eg__rotulo" for="vac-reforco">{{ t('catalogo.vacina.reforco') }}</label>
          <InputNumber
            v-model="intervaloReforco"
            input-id="vac-reforco"
            :min="1"
            :max="3650"
            :suffix="` ${t('catalogo.vacina.dias')}`"
            :disabled="salvando"
          />
        </section>
      </div>

      <div class="eg__grupo">
        <h3 class="eg__grupo-titulo">{{ t('catalogo.vacina.naClinica') }}</h3>
        <label class="vac__chave">
          <ToggleSwitch v-model="essencial" :disabled="salvando" />
          <span>{{ t('catalogo.vacina.essencial') }}</span>
        </label>
        <label class="vac__chave">
          <ToggleSwitch v-model="obrigatoria" :disabled="salvando" />
          <span>{{ t('catalogo.vacina.obrigatoria') }}</span>
        </label>
        <section class="eg__secao">
          <label class="eg__rotulo" for="vac-estoque">{{
            t('catalogo.vacina.estoqueMinimo')
          }}</label>
          <InputNumber
            v-model="estoqueMinimo"
            input-id="vac-estoque"
            :min="0"
            :max="9999"
            :disabled="salvando"
          />
        </section>
      </div>

      <p v-if="erroGeral" class="eg__erro" role="alert">
        <i class="ph ph-warning-circle" aria-hidden="true" />
        <span>{{ erroGeral }}</span>
      </p>
      <p v-else-if="tentou && !valido" class="eg__erro" role="alert">
        <i class="ph ph-warning-circle" aria-hidden="true" />
        <span>{{ t('catalogo.erro.faltaCampo') }}</span>
      </p>
    </form>

    <template #pe>
      <Button
        type="button"
        severity="secondary"
        outlined
        :label="t('cadastro.cancelar')"
        :disabled="salvando"
        @click="aberta = false"
      />
      <Button
        type="submit"
        form="vacina-form"
        icon="ph ph-check"
        :label="t('cadastro.salvar')"
        :loading="salvando"
      />
    </template>
  </CadastroGaveta>
</template>

<style scoped>
.vac__chave {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--tinta);
  font-size: 13.5px;
  cursor: pointer;
}
</style>
