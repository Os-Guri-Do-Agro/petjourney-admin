<script setup lang="ts">
/**
 * Os campos do responsável (o cliente do parceiro, E2-01 seções 1.4 e 1.5), os mesmos no cadastro
 * novo e na gaveta de editar.
 *
 * Telefone brasileiro com DDD (a API põe o 55) ou internacional com "+"; a API devolve só dígitos
 * com DDI, e a tela mostra formatado. O CPF é opcional e conferido pela API (`CPF_INVALIDO`). O
 * CEP preenche rua, bairro, cidade e UF pelo ViaCEP, como no Estabelecimento. O contato de
 * emergência é do hotel.
 */
import InputMask from 'primevue/inputmask'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import Textarea from 'primevue/textarea'
import { computed, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { buscarCep, digitosDoCep } from '@/service/brasil/cep-service'
import type { CamposDoCliente, ErrosDoCliente } from '@/components/cadastro/campos'
import { CONTATOS_PREFERIDOS } from '@/service/parceiro/pacientes-service'
import { UFS } from '@/utils/brasil/ufs'

const campos = defineModel<CamposDoCliente>({ required: true })

defineProps<{ erros?: ErrosDoCliente; desabilitado?: boolean; id: string }>()

const { t } = useI18n()

const opcoesDeContato = computed(() =>
  CONTATOS_PREFERIDOS.map((valor) => ({ valor, rotulo: t(`cadastro.contato.${valor}`) })),
)

/* ------------------------------------------------------------------------------ o CEP */

const buscaDoCep = ref<'' | 'buscando' | 'preenchido' | 'naoEncontrado'>('')
let controle: AbortController | null = null

watch(
  () => campos.value.cep,
  async (cep, anterior) => {
    const digitos = digitosDoCep(cep)

    if (digitos.length !== 8 || digitos === digitosDoCep(anterior ?? '')) return

    controle?.abort()
    controle = new AbortController()
    buscaDoCep.value = 'buscando'

    try {
      const endereco = await buscarCep(digitos, controle.signal)

      if (controle.signal.aborted) return
      if (!endereco) {
        buscaDoCep.value = 'naoEncontrado'
        return
      }

      campos.value.logradouro = endereco.logradouro || campos.value.logradouro
      campos.value.bairro = endereco.bairro || campos.value.bairro
      campos.value.cidade = endereco.cidade
      campos.value.uf = endereco.uf
      buscaDoCep.value = 'preenchido'
    } catch {
      buscaDoCep.value = ''
    }
  },
)

onUnmounted(() => controle?.abort())
</script>

<template>
  <section class="eg__secao">
    <label class="eg__rotulo" :for="`${id}-nome`">{{
      t('cadastro.campos.nomeDoResponsavel')
    }}</label>
    <InputText
      :id="`${id}-nome`"
      v-model="campos.nome"
      autocomplete="off"
      maxlength="120"
      :invalid="Boolean(erros?.nome)"
      :disabled="desabilitado"
    />
    <small v-if="erros?.nome" class="eg__invalido">{{ erros.nome }}</small>
  </section>

  <div class="eg__linha">
    <section class="eg__secao">
      <label class="eg__rotulo" :for="`${id}-telefone`">{{ t('cadastro.campos.telefone') }}</label>
      <InputText
        :id="`${id}-telefone`"
        v-model="campos.telefone"
        inputmode="tel"
        autocomplete="off"
        :placeholder="t('cadastro.campos.telefoneExemplo')"
        :invalid="Boolean(erros?.telefone)"
        :disabled="desabilitado"
      />
      <small v-if="erros?.telefone" class="eg__invalido">{{ erros.telefone }}</small>
    </section>

    <section class="eg__secao">
      <label class="eg__rotulo" :for="`${id}-telefone2`">
        {{ t('cadastro.campos.telefoneSecundario') }}
        <span class="eg__opcional">{{ t('cadastro.opcional') }}</span>
      </label>
      <InputText
        :id="`${id}-telefone2`"
        v-model="campos.telefoneSecundario"
        inputmode="tel"
        autocomplete="off"
        :invalid="Boolean(erros?.telefoneSecundario)"
        :disabled="desabilitado"
      />
      <small v-if="erros?.telefoneSecundario" class="eg__invalido">
        {{ erros.telefoneSecundario }}
      </small>
    </section>
  </div>

  <section class="eg__secao">
    <span :id="`${id}-contato`" class="eg__rotulo">{{
      t('cadastro.campos.contatoPreferido')
    }}</span>
    <SelectButton
      v-model="campos.contatoPreferido"
      :options="opcoesDeContato"
      option-label="rotulo"
      option-value="valor"
      :allow-empty="false"
      :aria-labelledby="`${id}-contato`"
      :disabled="desabilitado"
    />
  </section>

  <div class="eg__linha">
    <section class="eg__secao">
      <label class="eg__rotulo" :for="`${id}-email`">
        {{ t('cadastro.campos.email') }}
        <span class="eg__opcional">{{ t('cadastro.opcional') }}</span>
      </label>
      <InputText
        :id="`${id}-email`"
        v-model="campos.email"
        type="email"
        autocomplete="off"
        :invalid="Boolean(erros?.email)"
        :disabled="desabilitado"
      />
      <small v-if="erros?.email" class="eg__invalido">{{ erros.email }}</small>
    </section>

    <section class="eg__secao">
      <label class="eg__rotulo" :for="`${id}-cpf`">
        {{ t('cadastro.campos.cpf') }}
        <span class="eg__opcional">{{ t('cadastro.opcional') }}</span>
      </label>
      <InputMask
        :id="`${id}-cpf`"
        v-model="campos.cpf"
        mask="999.999.999-99"
        inputmode="numeric"
        :auto-clear="false"
        :invalid="Boolean(erros?.cpf)"
        :disabled="desabilitado"
      />
      <small v-if="erros?.cpf" class="eg__invalido">{{ erros.cpf }}</small>
    </section>
  </div>

  <h3 class="eg__grupo-titulo">{{ t('cadastro.campos.endereco') }}</h3>

  <div class="eg__linha">
    <section class="eg__secao">
      <label class="eg__rotulo" :for="`${id}-cep`">{{ t('cadastro.campos.cep') }}</label>
      <InputMask
        :id="`${id}-cep`"
        v-model="campos.cep"
        mask="99999-999"
        inputmode="numeric"
        :auto-clear="false"
        :disabled="desabilitado"
      />
      <small class="eg__dica" aria-live="polite">
        <template v-if="buscaDoCep === 'buscando'">{{ t('cadastro.cep.buscando') }}</template>
        <template v-else-if="buscaDoCep === 'preenchido'">{{
          t('cadastro.cep.preenchido')
        }}</template>
        <template v-else-if="buscaDoCep === 'naoEncontrado'">
          {{ t('cadastro.cep.naoEncontrado') }}
        </template>
      </small>
    </section>

    <section class="eg__secao">
      <label class="eg__rotulo" :for="`${id}-numero`">{{ t('cadastro.campos.numero') }}</label>
      <InputText
        :id="`${id}-numero`"
        v-model="campos.numero"
        maxlength="20"
        :disabled="desabilitado"
      />
    </section>
  </div>

  <section class="eg__secao">
    <label class="eg__rotulo" :for="`${id}-logradouro`">{{
      t('cadastro.campos.logradouro')
    }}</label>
    <InputText
      :id="`${id}-logradouro`"
      v-model="campos.logradouro"
      maxlength="160"
      :disabled="desabilitado"
    />
  </section>

  <div class="eg__linha">
    <section class="eg__secao">
      <label class="eg__rotulo" :for="`${id}-complemento`">
        {{ t('cadastro.campos.complemento') }}
      </label>
      <InputText
        :id="`${id}-complemento`"
        v-model="campos.complemento"
        maxlength="80"
        :disabled="desabilitado"
      />
    </section>

    <section class="eg__secao">
      <label class="eg__rotulo" :for="`${id}-bairro`">{{ t('cadastro.campos.bairro') }}</label>
      <InputText
        :id="`${id}-bairro`"
        v-model="campos.bairro"
        maxlength="80"
        :disabled="desabilitado"
      />
    </section>
  </div>

  <div class="eg__linha">
    <section class="eg__secao">
      <label class="eg__rotulo" :for="`${id}-cidade`">{{ t('cadastro.campos.cidade') }}</label>
      <InputText
        :id="`${id}-cidade`"
        v-model="campos.cidade"
        maxlength="80"
        :disabled="desabilitado"
      />
    </section>

    <section class="eg__secao">
      <label class="eg__rotulo" :for="`${id}-uf`">{{ t('cadastro.campos.uf') }}</label>
      <Select
        v-model="campos.uf"
        :input-id="`${id}-uf`"
        :options="UFS"
        editable
        :disabled="desabilitado"
      />
    </section>
  </div>

  <section class="eg__secao">
    <label class="eg__rotulo" :for="`${id}-observacao`">
      {{ t('cadastro.campos.observacao') }}
      <span class="eg__opcional">{{ t('cadastro.opcional') }}</span>
    </label>
    <Textarea
      :id="`${id}-observacao`"
      v-model="campos.observacao"
      rows="2"
      auto-resize
      maxlength="500"
      :disabled="desabilitado"
    />
  </section>

  <h3 class="eg__grupo-titulo">{{ t('cadastro.campos.emergencia') }}</h3>

  <div class="eg__linha">
    <section class="eg__secao">
      <label class="eg__rotulo" :for="`${id}-emergencia-nome`">
        {{ t('cadastro.campos.emergenciaNome') }}
      </label>
      <InputText
        :id="`${id}-emergencia-nome`"
        v-model="campos.emergenciaNome"
        maxlength="120"
        :disabled="desabilitado"
      />
    </section>

    <section class="eg__secao">
      <label class="eg__rotulo" :for="`${id}-emergencia-telefone`">
        {{ t('cadastro.campos.emergenciaTelefone') }}
      </label>
      <InputText
        :id="`${id}-emergencia-telefone`"
        v-model="campos.emergenciaTelefone"
        inputmode="tel"
        :invalid="Boolean(erros?.emergenciaTelefone)"
        :disabled="desabilitado"
      />
      <small v-if="erros?.emergenciaTelefone" class="eg__invalido">
        {{ erros.emergenciaTelefone }}
      </small>
    </section>
  </div>
</template>
