<script setup lang="ts">
/**
 * O cadastro mínimo de quem ainda não tem o app.
 *
 * Vem **depois** do horário, não antes: quem abre o link quer ver se tem vaga, e quatro campos na
 * porta de entrada fazem desistir antes de descobrir. Só o que a clínica precisa para marcar e
 * confirmar — nome, celular, o nome e a espécie do pet. Idade e sexo ajudam e são opcionais.
 */
import {
  PhBird,
  PhCat,
  PhDog,
  PhGenderFemale,
  PhGenderMale,
  PhHorse,
  PhPawPrint,
  PhRabbit,
} from '@phosphor-icons/vue'
import Button from 'primevue/button'
import DatePicker from 'primevue/datepicker'
import InputText from 'primevue/inputtext'
import SelectButton from 'primevue/selectbutton'
import { computed, ref, type Component } from 'vue'
import { useI18n } from 'vue-i18n'

import { ESPECIES_NA_CLINICA, type EspecieNaClinica } from '../../../contrato/responsavel'
import { formatarTelefone, somenteDigitos, telefoneValido } from '../../../domain/cadastro'

import { useFluxo } from './fluxo-do-pedido'

const { t } = useI18n()
const fluxo = useFluxo()
const hoje = new Date()

/**
 * O bicho de cada espécie. O Phosphor não tem roedor nem réptil: o coelho é o pequeno mamífero mais
 * perto, e o réptil fica com a pegada — o nome embaixo diz qual é.
 */
const ICONE_DA_ESPECIE: Record<EspecieNaClinica, Component> = {
  CANINA: PhDog,
  FELINA: PhCat,
  AVE: PhBird,
  ROEDOR: PhRabbit,
  REPTIL: PhPawPrint,
  EQUINA: PhHorse,
}

const especies = computed(() =>
  ESPECIES_NA_CLINICA.map((valor) => ({
    valor,
    rotulo: t(`clinico.especie.${valor.toLowerCase()}`),
    icone: ICONE_DA_ESPECIE[valor],
  })),
)

/*
 * O celular se formata enquanto se digita — "(11) 98765-4321", o mesmo desenho do cadastro da
 * clínica — e diz o que falta depois de sair do campo. Antes ficava "11987650042" cru, inclusive
 * na confirmação, e com o DDD faltando o "Continuar" só ficava apagado, sem dizer por quê.
 */
const telefoneTocado = ref(false)

const telefoneComErro = computed(
  () =>
    telefoneTocado.value &&
    somenteDigitos(fluxo.pedido.visitante.telefone).length > 0 &&
    !telefoneValido(fluxo.pedido.visitante.telefone),
)

function aoDigitarTelefone(valor: string | undefined) {
  fluxo.pedido.visitante.telefone = formatarTelefone(valor ?? '')
}

const sexos = computed(() => [
  { valor: 'MACHO', rotulo: t('clinico.pedidos.app.sexo.macho'), icone: PhGenderMale },
  { valor: 'FEMEA', rotulo: t('clinico.pedidos.app.sexo.femea'), icone: PhGenderFemale },
])
</script>

<template>
  <div class="fx-etapa">
    <div class="fx-corpo">
      <p class="fx-ajuda">{{ t('clinico.pedidos.link.dadosAjuda') }}</p>

      <label class="fx-campo">
        <span>{{ t('clinico.pedidos.link.nome') }}</span>
        <InputText v-model="fluxo.pedido.visitante.nome" autocomplete="name" fluid />
      </label>

      <label class="fx-campo">
        <span>{{ t('clinico.pedidos.link.telefone') }}</span>
        <InputText
          :model-value="fluxo.pedido.visitante.telefone"
          inputmode="tel"
          autocomplete="tel"
          :placeholder="t('clinico.pedidos.link.telefoneExemplo')"
          :invalid="telefoneComErro"
          :aria-describedby="telefoneComErro ? 'link-telefone-erro' : undefined"
          fluid
          @update:model-value="aoDigitarTelefone"
          @blur="telefoneTocado = true"
        />
        <small v-if="telefoneComErro" id="link-telefone-erro" class="fx-erro">
          {{ t('clinico.paciente.novo.erros.telefone') }}
        </small>
      </label>

      <label class="fx-campo">
        <span>{{ t('clinico.pedidos.link.petNome') }}</span>
        <InputText v-model="fluxo.pedido.visitante.petNome" fluid />
      </label>

      <!-- A espécie é obrigatória: um cartão fica sempre aceso. -->
      <div class="fx-campo">
        <span id="link-especie">{{ t('clinico.pedidos.link.especie') }}</span>
        <SelectButton
          v-model="fluxo.pedido.visitante.especie"
          :options="especies"
          option-label="rotulo"
          option-value="valor"
          :allow-empty="false"
          aria-labelledby="link-especie"
          class="grupo fx-escolhas"
          style="--fx-colunas: 3"
        >
          <template #option="{ option }">
            <span class="fx-escolha">
              <component :is="option.icone" weight="duotone" aria-hidden="true" />
              <strong>{{ option.rotulo }}</strong>
            </span>
          </template>
        </SelectButton>
      </div>

      <label class="fx-campo">
        <span>{{ t('clinico.pedidos.link.nascimento') }}</span>
        <DatePicker
          v-model="fluxo.pedido.visitante.nascimento"
          :max-date="hoje"
          date-format="dd/mm/yy"
          show-icon
          icon-display="input"
          :manual-input="false"
          fluid
        />
      </label>

      <div class="fx-campo">
        <span id="link-sexo">{{ t('clinico.pedidos.link.sexo') }}</span>
        <SelectButton
          v-model="fluxo.pedido.visitante.sexo"
          :options="sexos"
          option-label="rotulo"
          option-value="valor"
          aria-labelledby="link-sexo"
          class="grupo fx-escolhas"
        >
          <template #option="{ option }">
            <span class="fx-escolha">
              <component :is="option.icone" weight="duotone" aria-hidden="true" />
              <strong>{{ option.rotulo }}</strong>
            </span>
          </template>
        </SelectButton>
      </div>
    </div>

    <div class="fx-rodape">
      <Button
        :label="t('clinico.pedidos.app.continuar')"
        icon="ph ph-arrow-right"
        icon-pos="right"
        :disabled="!fluxo.visitanteValido.value"
        @click="fluxo.confirmarDados()"
      />
    </div>
  </div>
</template>
