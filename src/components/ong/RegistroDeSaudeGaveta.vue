<script setup lang="ts">
/**
 * Registrar vacina, vermífugo ou peso do animal da ONG (guia 2.1), numa gaveta à direita.
 *
 * - Vacina: nome e dia (obrigatórios), lote, fabricante, dose da série e a próxima dose.
 * - Vermífugo: o produto e o dia em que foi dado, e a próxima dose.
 * - Peso: de 0,01 a 200 kg e o dia da pesagem.
 *
 * O dia não pode estar no futuro; a próxima dose pode, e vira o lembrete de quem adotar (enquanto o
 * animal está com a ONG, não avisa ninguém). Tudo grava com a autoria da ONG.
 */
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import DatePicker from 'primevue/datepicker'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import { useToast } from 'primevue/usetoast'
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { useRotulosDoCadastro } from '@/components/cadastro/useRotulosDoCadastro'
import {
  diaNoFormatoDaApi,
  diaParaData,
  hojeNoFormatoDaApi,
  lerErroDaOng,
} from '@/components/ong/regras-da-ong'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import {
  PESO_MAX_KG,
  PESO_MIN_KG,
  registrarPeso,
  registrarVacina,
  registrarVermifugo,
  type TipoDeRegistro,
} from '@/service/parceiro/ong-service'

const props = defineProps<{ animalId: string; tipo: TipoDeRegistro }>()
const emit = defineEmits<{ salvo: []; mudou: [] }>()
const aberta = defineModel<boolean>('visible', { default: false })

const { t } = useI18n()
const toast = useToast()
const rotulos = useRotulosDoCadastro()
const { parceiroQuery } = useParceiroPortal()

const ICONE: Record<TipoDeRegistro, string> = {
  vacinas: 'ph ph-syringe',
  vermifugos: 'ph ph-pill',
  pesos: 'ph ph-scales',
}

const campos = reactive({
  nome: '',
  dia: '',
  lote: '',
  fabricante: '',
  dose: null as number | null,
  dosesNaSerie: null as number | null,
  comProxima: false,
  proxima: '',
  pesoKg: null as number | null,
})

type CampoComErro = 'nome' | 'dia' | 'proxima' | 'pesoKg'

const erros = ref<Partial<Record<CampoComErro, string>>>({})
const erroGeral = ref('')
const salvando = ref(false)

watch(aberta, (agora) => {
  if (!agora) return

  Object.assign(campos, {
    nome: '',
    dia: hojeNoFormatoDaApi(),
    lote: '',
    fabricante: '',
    dose: null,
    dosesNaSerie: null,
    comProxima: false,
    proxima: '',
    pesoKg: null,
  })
  erros.value = {}
  erroGeral.value = ''
})

function dataDe(chave: 'dia' | 'proxima') {
  return computed<Date | null>({
    get: () => diaParaData(campos[chave]),
    set: (data) => {
      campos[chave] = data ? diaNoFormatoDaApi(data) : ''
    },
  })
}

const diaDate = dataDe('dia')
const proximaDate = dataDe('proxima')

const hoje = new Date()
/** A próxima dose é depois do dia registrado. */
const minimoDaProxima = computed(() => {
  const base = diaParaData(campos.dia) ?? hoje
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() + 1)
})

const rotuloDoDia = computed(() =>
  t(
    props.tipo === 'vacinas'
      ? 'ong.registro.aplicadaEm'
      : props.tipo === 'vermifugos'
        ? 'ong.registro.administradoEm'
        : 'ong.registro.data',
  ),
)

function validar() {
  const novos: Partial<Record<CampoComErro, string>> = {}

  if (props.tipo !== 'pesos' && !campos.nome.trim()) novos.nome = t('ong.registro.nomeObrigatorio')
  if (!campos.dia) novos.dia = t('ong.registro.dataObrigatoria')
  if (props.tipo === 'pesos') {
    const peso = campos.pesoKg
    if (peso === null || peso < PESO_MIN_KG || peso > PESO_MAX_KG) {
      novos.pesoKg = t('ong.registro.pesoObrigatorio')
    }
  }
  if (props.tipo !== 'pesos' && campos.comProxima && !campos.proxima) {
    novos.proxima = t('ong.registro.dataObrigatoria')
  }

  erros.value = novos
  return !Object.keys(novos).length
}

const ouNulo = (texto: string) => texto.trim() || null

async function salvar() {
  erroGeral.value = ''
  if (!validar()) return

  salvando.value = true
  const proximaEm = campos.comProxima && campos.proxima ? campos.proxima : undefined

  try {
    if (props.tipo === 'vacinas') {
      await registrarVacina(
        props.animalId,
        {
          nome: campos.nome.trim(),
          aplicadaEm: campos.dia,
          ...(ouNulo(campos.lote) ? { lote: ouNulo(campos.lote) } : {}),
          ...(ouNulo(campos.fabricante) ? { fabricante: ouNulo(campos.fabricante) } : {}),
          ...(campos.dose ? { dose: campos.dose } : {}),
          ...(campos.dosesNaSerie ? { dosesNaSerie: campos.dosesNaSerie } : {}),
          ...(proximaEm ? { proximaEm } : {}),
        },
        parceiroQuery(),
      )
    } else if (props.tipo === 'vermifugos') {
      await registrarVermifugo(
        props.animalId,
        {
          nome: campos.nome.trim(),
          administradoEm: campos.dia,
          ...(proximaEm ? { proximaEm } : {}),
        },
        parceiroQuery(),
      )
    } else {
      await registrarPeso(
        props.animalId,
        { pesoKg: campos.pesoKg as number, data: campos.dia },
        parceiroQuery(),
      )
    }

    toast.add({ severity: 'success', summary: t('ong.registro.registrado'), life: 3000 })
    emit('salvo')
    aberta.value = false
  } catch (err) {
    const lido = lerErroDaOng(err, t, t('ong.erros.salvar'))

    if (lido.recarregar) {
      toast.add({ severity: 'warn', summary: lido.mensagem, life: 6000 })
      emit('mudou')
      aberta.value = false
      return
    }

    /* `ONG_DATA_INVALIDA` diz o campo: `proximaEm` é a próxima, o resto é o dia do registro. */
    if (lido.codigo === 'ONG_DATA_INVALIDA') {
      erros.value = { [lido.campo === 'proximaEm' ? 'proxima' : 'dia']: lido.mensagem }
    } else {
      erroGeral.value = lido.mensagem
    }
  } finally {
    salvando.value = false
  }
}
</script>

<template>
  <CadastroGaveta
    v-model:visible="aberta"
    :titulo="t(`ong.registro.titulo.${tipo}`)"
    :icone="ICONE[tipo]"
    largura="30rem"
  >
    <form id="registro-da-ong" class="eg" novalidate @submit.prevent="salvar">
      <section v-if="tipo !== 'pesos'" class="eg__secao">
        <label class="eg__rotulo" for="rs-nome">
          {{ tipo === 'vacinas' ? t('ong.registro.nomeVacina') : t('ong.registro.nomeVermifugo') }}
        </label>
        <InputText
          id="rs-nome"
          v-model="campos.nome"
          maxlength="120"
          autocomplete="off"
          :invalid="Boolean(erros.nome)"
          :disabled="salvando"
        />
        <small v-if="erros.nome" class="eg__invalido">{{ erros.nome }}</small>
      </section>

      <section v-if="tipo === 'pesos'" class="eg__secao">
        <label class="eg__rotulo" for="rs-peso">{{ t('ong.registro.peso') }}</label>
        <InputNumber
          v-model="campos.pesoKg"
          input-id="rs-peso"
          :min="0"
          :max="PESO_MAX_KG"
          :min-fraction-digits="0"
          :max-fraction-digits="2"
          :locale="rotulos.intl()"
          suffix=" kg"
          :invalid="Boolean(erros.pesoKg)"
          :disabled="salvando"
        />
        <small v-if="erros.pesoKg" class="eg__invalido">{{ erros.pesoKg }}</small>
      </section>

      <section class="eg__secao">
        <span id="rs-dia" class="eg__rotulo">{{ rotuloDoDia }}</span>
        <DatePicker
          v-model="diaDate"
          inline
          :max-date="hoje"
          aria-labelledby="rs-dia"
          :disabled="salvando"
          class="rs__calendario"
        />
        <small v-if="erros.dia" class="eg__invalido">{{ erros.dia }}</small>
      </section>

      <template v-if="tipo === 'vacinas'">
        <div class="eg__linha">
          <section class="eg__secao">
            <label class="eg__rotulo" for="rs-lote">
              {{ t('ong.registro.lote') }}
              <span class="eg__opcional">{{ t('cadastro.opcional') }}</span>
            </label>
            <InputText id="rs-lote" v-model="campos.lote" maxlength="60" :disabled="salvando" />
          </section>
          <section class="eg__secao">
            <label class="eg__rotulo" for="rs-fabricante">
              {{ t('ong.registro.fabricante') }}
              <span class="eg__opcional">{{ t('cadastro.opcional') }}</span>
            </label>
            <InputText
              id="rs-fabricante"
              v-model="campos.fabricante"
              maxlength="80"
              :disabled="salvando"
            />
          </section>
        </div>

        <div class="eg__linha">
          <section class="eg__secao">
            <label class="eg__rotulo" for="rs-dose">
              {{ t('ong.registro.dose') }}
              <span class="eg__opcional">{{ t('cadastro.opcional') }}</span>
            </label>
            <InputNumber
              v-model="campos.dose"
              input-id="rs-dose"
              :min="1"
              :max="10"
              show-buttons
              :disabled="salvando"
            />
          </section>
          <section class="eg__secao">
            <label class="eg__rotulo" for="rs-serie">
              {{ t('ong.registro.dosesNaSerie') }}
              <span class="eg__opcional">{{ t('cadastro.opcional') }}</span>
            </label>
            <InputNumber
              v-model="campos.dosesNaSerie"
              input-id="rs-serie"
              :min="1"
              :max="10"
              show-buttons
              :disabled="salvando"
            />
          </section>
        </div>
      </template>

      <section v-if="tipo !== 'pesos'" class="eg__secao">
        <label class="rs__marcar">
          <Checkbox
            v-model="campos.comProxima"
            binary
            input-id="rs-com-proxima"
            :disabled="salvando"
          />
          <span>{{ t('ong.registro.proxima') }}</span>
        </label>
        <small class="eg__dica">{{ t('ong.registro.proximaDica') }}</small>
      </section>

      <section v-if="tipo !== 'pesos' && campos.comProxima" class="eg__secao">
        <span id="rs-proxima" class="eg__rotulo">{{ t('ong.registro.proximaEm') }}</span>
        <DatePicker
          v-model="proximaDate"
          inline
          :min-date="minimoDaProxima"
          aria-labelledby="rs-proxima"
          :disabled="salvando"
          class="rs__calendario"
        />
        <small v-if="erros.proxima" class="eg__invalido">{{ erros.proxima }}</small>
      </section>

      <p v-if="erroGeral" class="eg__erro" role="alert">
        <i class="ph ph-warning-circle" aria-hidden="true" />
        <span>{{ erroGeral }}</span>
      </p>
    </form>

    <template #pe>
      <Button
        type="button"
        :label="t('cadastro.cancelar')"
        severity="secondary"
        outlined
        :disabled="salvando"
        @click="aberta = false"
      />
      <Button
        type="submit"
        form="registro-da-ong"
        icon="ph ph-check"
        :label="t('ong.registro.salvar')"
        :loading="salvando"
      />
    </template>
  </CadastroGaveta>
</template>

<style scoped>
.eg__linha > .eg__secao {
  align-content: start;
}

.rs__calendario {
  justify-self: start;
}

.rs__marcar {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--tinta);
  font-size: 14px;
}
</style>
