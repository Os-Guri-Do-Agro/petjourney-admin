<script setup lang="ts">
/**
 * Os campos do animal da ONG (guia 2.2), os mesmos no cadastro em passos e na gaveta de editar.
 *
 * `parte` divide nos passos do cadastro: o animal (nome, espécie, sexo, castrado, raça, cor, porte),
 * a chegada (dia e origem, nascimento, microchip, avisos de manejo) e as observações, com os dois
 * textos de destinos diferentes e rótulos que dizem o destino. A gaveta de editar mostra tudo, com a
 * espécie travada (ela não muda depois do cadastro).
 */
import DatePicker from 'primevue/datepicker'
import InputText from 'primevue/inputtext'
import MultiSelect from 'primevue/multiselect'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import Textarea from 'primevue/textarea'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type {
  CamposDoAnimal,
  ErrosDoAnimal,
  ParteDoAnimal,
} from '@/components/ong/campos-do-animal'
import { diaNoFormatoDaApi, diaParaData } from '@/components/ong/regras-da-ong'
import { ESPECIES, PORTES } from '@/service/parceiro/pacientes-service'
import { AVISOS_DE_MANEJO, ORIGENS_DA_ENTRADA } from '@/service/parceiro/ong-service'

const campos = defineModel<CamposDoAnimal>({ required: true })

const props = withDefaults(
  defineProps<{
    id: string
    erros?: ErrosDoAnimal
    desabilitado?: boolean
    parte?: ParteDoAnimal | 'tudo'
    /** Editando: a espécie fica travada. */
    edicao?: boolean
  }>(),
  { erros: undefined, desabilitado: false, parte: 'tudo', edicao: false },
)

const { t } = useI18n()

const mostra = (parte: ParteDoAnimal) => props.parte === 'tudo' || props.parte === parte

/* O PrimeVue lê `null` como "nada escolhido": "Não informado" ganha um valor próprio nos botões. */
const NAO_INFORMADO = 'NI'

const opcoesDeEspecie = computed(() =>
  ESPECIES.map((valor) => ({ valor, rotulo: t(`cadastro.especie.${valor}`) })),
)

const opcoesDePorte = computed(() =>
  PORTES.map((valor) => ({ valor, rotulo: t(`cadastro.porte.${valor}`) })),
)

const opcoesDeOrigem = computed(() =>
  ORIGENS_DA_ENTRADA.map((valor) => ({ valor, rotulo: t(`ong.origem.${valor}`) })),
)

const opcoesDeManejo = computed(() =>
  AVISOS_DE_MANEJO.map((valor) => ({ valor, rotulo: t(`ong.manejo.${valor}`) })),
)

const opcoesDeSexo = computed(() => [
  { valor: 'MACHO', rotulo: t('cadastro.sexo.MACHO') },
  { valor: 'FEMEA', rotulo: t('cadastro.sexo.FEMEA') },
  { valor: NAO_INFORMADO, rotulo: t('cadastro.naoInformado') },
])

const opcoesDeCastrado = computed(() => [
  { valor: 'SIM', rotulo: t('cadastro.sim') },
  { valor: 'NAO', rotulo: t('cadastro.nao') },
  { valor: NAO_INFORMADO, rotulo: t('cadastro.naoInformado') },
])

const sexo = computed({
  get: () => campos.value.sexo ?? NAO_INFORMADO,
  set: (valor: string) => {
    campos.value.sexo = valor === 'MACHO' || valor === 'FEMEA' ? valor : null
  },
})

const castrado = computed({
  get: () =>
    campos.value.castrado === null ? NAO_INFORMADO : campos.value.castrado ? 'SIM' : 'NAO',
  set: (valor: string) => {
    campos.value.castrado = valor === 'SIM' ? true : valor === 'NAO' ? false : null
  },
})

/* O DatePicker trabalha com Date; a API, com `AAAA-MM-DD`. A conversão é pelo dia local. */
function dataDe(chave: 'nascimento' | 'entradaEm') {
  return computed<Date | null>({
    get: () => diaParaData(campos.value[chave]),
    set: (data) => {
      campos.value[chave] = data ? diaNoFormatoDaApi(data) : ''
    },
  })
}

const nascimentoDate = dataDe('nascimento')
const entradaDate = dataDe('entradaEm')

const hoje = new Date()
</script>

<template>
  <!-- O animal. -->
  <template v-if="mostra('animal')">
    <section class="eg__secao">
      <label class="eg__rotulo" :for="`${id}-nome`">{{ t('ong.campos.nome') }}</label>
      <InputText
        :id="`${id}-nome`"
        v-model="campos.nome"
        autocomplete="off"
        maxlength="60"
        :invalid="Boolean(erros?.nome)"
        :disabled="desabilitado"
      />
      <small v-if="erros?.nome" class="eg__invalido">{{ erros.nome }}</small>
    </section>

    <div class="eg__linha">
      <section class="eg__secao">
        <label class="eg__rotulo" :for="`${id}-especie`">{{ t('cadastro.campos.especie') }}</label>
        <Select
          v-model="campos.especie"
          :input-id="`${id}-especie`"
          :options="opcoesDeEspecie"
          option-label="rotulo"
          option-value="valor"
          :placeholder="t('cadastro.campos.escolha')"
          :invalid="Boolean(erros?.especie)"
          :disabled="desabilitado || edicao"
        />
        <small v-if="erros?.especie" class="eg__invalido">{{ erros.especie }}</small>
        <small v-else-if="edicao" class="eg__dica">{{ t('ong.campos.especieNaoMuda') }}</small>
      </section>

      <section v-if="campos.especie === 'OUTRO'" class="eg__secao">
        <label class="eg__rotulo" :for="`${id}-especie-outra`">
          {{ t('cadastro.campos.especieOutra') }}
        </label>
        <InputText
          :id="`${id}-especie-outra`"
          v-model="campos.especieOutra"
          maxlength="40"
          :placeholder="t('cadastro.campos.especieOutraExemplo')"
          :invalid="Boolean(erros?.especieOutra)"
          :disabled="desabilitado"
        />
        <small v-if="erros?.especieOutra" class="eg__invalido">{{ erros.especieOutra }}</small>
      </section>
    </div>

    <section class="eg__secao">
      <span :id="`${id}-sexo`" class="eg__rotulo">{{ t('cadastro.campos.sexo') }}</span>
      <SelectButton
        v-model="sexo"
        :options="opcoesDeSexo"
        option-label="rotulo"
        option-value="valor"
        :allow-empty="false"
        :aria-labelledby="`${id}-sexo`"
        :disabled="desabilitado"
      />
    </section>

    <section class="eg__secao">
      <span :id="`${id}-castrado`" class="eg__rotulo">{{ t('cadastro.campos.castrado') }}</span>
      <SelectButton
        v-model="castrado"
        :options="opcoesDeCastrado"
        option-label="rotulo"
        option-value="valor"
        :allow-empty="false"
        :aria-labelledby="`${id}-castrado`"
        :disabled="desabilitado"
      />
    </section>

    <div class="eg__linha">
      <section class="eg__secao">
        <label class="eg__rotulo" :for="`${id}-raca`">
          {{ t('cadastro.campos.raca') }}
          <span class="eg__opcional">{{ t('cadastro.opcional') }}</span>
        </label>
        <InputText
          :id="`${id}-raca`"
          v-model="campos.raca"
          maxlength="60"
          :disabled="desabilitado"
        />
      </section>

      <section class="eg__secao">
        <label class="eg__rotulo" :for="`${id}-cor`">
          {{ t('ong.campos.cor') }}
          <span class="eg__opcional">{{ t('cadastro.opcional') }}</span>
        </label>
        <InputText :id="`${id}-cor`" v-model="campos.cor" maxlength="40" :disabled="desabilitado" />
      </section>
    </div>

    <section class="eg__secao">
      <label class="eg__rotulo" :for="`${id}-porte`">{{ t('cadastro.campos.porte') }}</label>
      <Select
        v-model="campos.porte"
        :input-id="`${id}-porte`"
        :options="opcoesDePorte"
        option-label="rotulo"
        option-value="valor"
        :placeholder="t('cadastro.naoInformado')"
        show-clear
        :disabled="desabilitado"
      />
    </section>
  </template>

  <!-- A chegada à ONG. -->
  <template v-if="mostra('chegada')">
    <section class="eg__secao">
      <span :id="`${id}-entrada`" class="eg__rotulo">{{ t('ong.campos.entradaEm') }}</span>
      <DatePicker
        v-model="entradaDate"
        inline
        :max-date="hoje"
        :aria-labelledby="`${id}-entrada`"
        :disabled="desabilitado"
        class="ac__calendario"
        :class="{ 'ac__calendario--invalido': Boolean(erros?.entradaEm) }"
      />
      <small v-if="erros?.entradaEm" class="eg__invalido">{{ erros.entradaEm }}</small>
    </section>

    <section class="eg__secao">
      <label class="eg__rotulo" :for="`${id}-origem`">{{ t('ong.campos.origem') }}</label>
      <Select
        v-model="campos.origemDaEntrada"
        :input-id="`${id}-origem`"
        :options="opcoesDeOrigem"
        option-label="rotulo"
        option-value="valor"
        :placeholder="t('cadastro.campos.escolha')"
        :invalid="Boolean(erros?.origemDaEntrada)"
        :disabled="desabilitado"
      />
      <small v-if="erros?.origemDaEntrada" class="eg__invalido">{{ erros.origemDaEntrada }}</small>
    </section>

    <section class="eg__secao">
      <span :id="`${id}-nascimento`" class="eg__rotulo">
        {{ t('cadastro.campos.nascimento') }}
        <span class="eg__opcional">{{ t('cadastro.opcional') }}</span>
      </span>
      <DatePicker
        v-model="nascimentoDate"
        inline
        :max-date="hoje"
        :aria-labelledby="`${id}-nascimento`"
        :disabled="desabilitado"
        class="ac__calendario"
      />
      <small v-if="erros?.nascimento" class="eg__invalido">{{ erros.nascimento }}</small>
      <small v-else class="eg__dica">{{ t('ong.campos.nascimentoDica') }}</small>
    </section>

    <section class="eg__secao">
      <label class="eg__rotulo" :for="`${id}-microchip`">
        {{ t('cadastro.campos.microchip') }}
        <span class="eg__opcional">{{ t('cadastro.opcional') }}</span>
      </label>
      <InputText
        :id="`${id}-microchip`"
        v-model="campos.microchip"
        maxlength="40"
        spellcheck="false"
        :invalid="Boolean(erros?.microchip)"
        :disabled="desabilitado"
      />
      <small v-if="erros?.microchip" class="eg__invalido">{{ erros.microchip }}</small>
    </section>

    <section class="eg__secao">
      <label class="eg__rotulo" :for="`${id}-manejo`">
        {{ t('ong.campos.manejo') }}
        <span class="eg__opcional">{{ t('cadastro.opcional') }}</span>
      </label>
      <MultiSelect
        v-model="campos.avisosDeManejo"
        :input-id="`${id}-manejo`"
        :options="opcoesDeManejo"
        option-label="rotulo"
        option-value="valor"
        display="chip"
        :placeholder="t('ong.campos.manejoNenhum')"
        :show-toggle-all="false"
        :disabled="desabilitado"
      />
    </section>
  </template>

  <!-- Os dois textos, com o destino de cada um no rótulo. -->
  <template v-if="mostra('observacoes')">
    <section class="eg__secao">
      <label class="eg__rotulo" :for="`${id}-interna`">
        <i class="ph ph-lock-simple" aria-hidden="true" />
        {{ t('ong.campos.observacaoInterna') }}
      </label>
      <Textarea
        :id="`${id}-interna`"
        v-model="campos.observacaoInterna"
        rows="4"
        auto-resize
        maxlength="2000"
        :invalid="Boolean(erros?.observacaoInterna)"
        :disabled="desabilitado"
      />
      <small class="eg__dica">{{ t('ong.campos.observacaoInternaDica') }}</small>
    </section>

    <section class="eg__secao">
      <label class="eg__rotulo" :for="`${id}-recado`">
        <i class="ph ph-device-mobile" aria-hidden="true" />
        {{ t('ong.campos.recado') }}
      </label>
      <Textarea
        :id="`${id}-recado`"
        v-model="campos.observacaoParaAdotante"
        rows="4"
        auto-resize
        maxlength="1000"
        :invalid="Boolean(erros?.observacaoParaAdotante)"
        :disabled="desabilitado"
      />
      <small class="eg__dica">{{ t('ong.campos.recadoDica') }}</small>
    </section>
  </template>
</template>

<style scoped>
/* Lado a lado, cada campo fica do tamanho dele: o erro de um não estica o vizinho. */
.eg__linha > .eg__secao {
  align-content: start;
}

.eg__rotulo > i {
  margin-inline-end: 4px;
  font-size: 15px;
  vertical-align: -2px;
}

.ac__calendario {
  justify-self: start;
}

.ac__calendario--invalido :deep(.p-datepicker-panel) {
  border-color: var(--risco-tinta);
}
</style>
