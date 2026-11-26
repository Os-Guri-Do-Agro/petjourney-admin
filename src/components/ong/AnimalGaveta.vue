<script setup lang="ts">
/**
 * Cadastrar ou editar o animal da ONG (guia 2.2), numa gaveta à direita.
 *
 * Cadastrar é em passos, um assunto por passo: o animal, a chegada à ONG e as duas observações.
 * Editar mostra tudo de uma vez e manda só o que mudou (`PATCH`), com a espécie travada.
 *
 * O erro da API vai pelo `codigo`: o que aponta um campo (microchip em uso, data no futuro, tipo do
 * animal) volta ao passo do campo; o resto aparece no pé do formulário. A ficha que já foi entregue
 * (409 `ANIMAL_JA_ENTREGUE`) fecha a gaveta e pede para a ficha ler de novo.
 */
import Button from 'primevue/button'
import { useToast } from 'primevue/usetoast'
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import AnimalCampos from '@/components/ong/AnimalCampos.vue'
import {
  campoDaTela,
  camposDoAnimal,
  camposVazios,
  paraCadastrar,
  paraEditar,
  parteDoCampo,
  validarAnimal,
  type CamposDoAnimal,
  type ErrosDoAnimal,
  type ParteDoAnimal,
} from '@/components/ong/campos-do-animal'
import { hojeNoFormatoDaApi, lerErroDaOng } from '@/components/ong/regras-da-ong'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import {
  cadastrarAnimalDaOng,
  editarAnimalDaOng,
  type AnimalDaOng,
} from '@/service/parceiro/ong-service'

const props = withDefaults(defineProps<{ animal?: AnimalDaOng | null }>(), { animal: null })
const emit = defineEmits<{ salvo: [animal: AnimalDaOng]; mudou: [] }>()
const aberta = defineModel<boolean>('visible', { default: false })

const { t } = useI18n()
const toast = useToast()
const { parceiroQuery } = useParceiroPortal()

const edicao = computed(() => Boolean(props.animal))

const PASSOS: ParteDoAnimal[] = ['animal', 'chegada', 'observacoes']

const passo = ref(0)
const ultimo = computed(() => passo.value === PASSOS.length - 1)
const parteAtual = computed(() => PASSOS[passo.value] ?? 'animal')

const campos = ref<CamposDoAnimal>(camposVazios(hojeNoFormatoDaApi()))
const erros = ref<ErrosDoAnimal>({})
const erroGeral = ref('')
const salvando = ref(false)
const corpo = ref<HTMLElement | null>(null)
/* Depois de tentar avançar, o erro do campo sai assim que ele fica certo. */
let tentou = false

watch(aberta, (agora) => {
  if (!agora) return

  tentou = false
  passo.value = 0
  erros.value = {}
  erroGeral.value = ''
  campos.value = props.animal ? camposDoAnimal(props.animal) : camposVazios(hojeNoFormatoDaApi())
})

watch(
  campos,
  (atuais) => {
    if (tentou) erros.value = validarAnimal(atuais, t, edicao.value ? undefined : parteAtual.value)
  },
  { deep: true },
)

/* Trocar de passo volta a gaveta para o alto. */
watch(passo, async () => {
  await nextTick()
  corpo.value?.closest('.p-drawer-content')?.scrollTo({ top: 0 })
})

function voltar() {
  passo.value = Math.max(0, passo.value - 1)
  erroGeral.value = ''
}

async function enviar() {
  tentou = true
  erroGeral.value = ''

  if (!edicao.value && !ultimo.value) {
    erros.value = validarAnimal(campos.value, t, parteAtual.value)
    if (Object.keys(erros.value).length) return

    tentou = false
    passo.value += 1
    return
  }

  erros.value = validarAnimal(campos.value, t)
  if (Object.keys(erros.value).length) {
    const primeiro = Object.keys(erros.value)[0] as keyof CamposDoAnimal
    if (!edicao.value) passo.value = PASSOS.indexOf(parteDoCampo(primeiro))
    return
  }

  salvando.value = true

  try {
    if (props.animal) {
      const mudancas = paraEditar(camposDoAnimal(props.animal), campos.value)

      if (!Object.keys(mudancas).length) {
        aberta.value = false
        return
      }

      const salvo = await editarAnimalDaOng(props.animal.id, mudancas, parceiroQuery())
      toast.add({ severity: 'success', summary: t('ong.editar.salvo'), life: 3000 })
      emit('salvo', salvo)
    } else {
      const criado = await cadastrarAnimalDaOng(paraCadastrar(campos.value), parceiroQuery())
      toast.add({
        severity: 'success',
        summary: t('ong.novo.cadastrado', { nome: criado.nome }),
        life: 3000,
      })
      emit('salvo', criado)
    }

    aberta.value = false
  } catch (err) {
    const lido = lerErroDaOng(err, t, t('ong.erros.salvar'))
    const campo = campoDaTela(lido.campo)

    if (lido.recarregar) {
      toast.add({ severity: 'warn', summary: lido.mensagem, life: 6000 })
      emit('mudou')
      aberta.value = false
      return
    }

    if (campo) {
      erros.value = { [campo]: lido.mensagem }
      if (!edicao.value) passo.value = PASSOS.indexOf(parteDoCampo(campo))
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
    :titulo="edicao ? t('ong.editar.titulo') : t('ong.novo.titulo')"
    :icone="edicao ? 'ph ph-pencil-simple' : 'ph ph-paw-print'"
    largura="34rem"
  >
    <ol v-if="!edicao" class="ag__passos" :aria-label="t('ong.novo.passos.rotulo')">
      <li
        v-for="(parte, indice) in PASSOS"
        :key="parte"
        class="ag__passo"
        :class="{ 'ag__passo--feito': indice < passo, 'ag__passo--agora': indice === passo }"
        :aria-current="indice === passo ? 'step' : undefined"
      >
        <span class="ag__numero" aria-hidden="true">
          <i v-if="indice < passo" class="ph ph-check" />
          <template v-else>{{ indice + 1 }}</template>
        </span>
        <span class="ag__nome">{{ t(`ong.novo.passos.${parte}`) }}</span>
      </li>
    </ol>

    <form id="animal-da-ong" ref="corpo" class="eg" novalidate @submit.prevent="enviar">
      <p v-if="!edicao" class="ag__dica">{{ t(`ong.novo.dicas.${parteAtual}`) }}</p>

      <AnimalCampos
        id="ag"
        v-model="campos"
        :erros="erros"
        :desabilitado="salvando"
        :parte="edicao ? 'tudo' : parteAtual"
        :edicao="edicao"
      />

      <p v-if="erroGeral" class="eg__erro" role="alert">
        <i class="ph ph-warning-circle" aria-hidden="true" />
        <span>{{ erroGeral }}</span>
      </p>
    </form>

    <template #pe>
      <Button
        v-if="!edicao && passo > 0"
        type="button"
        severity="secondary"
        outlined
        icon="ph ph-arrow-left"
        :label="t('ong.novo.voltar')"
        :disabled="salvando"
        @click="voltar"
      />
      <Button
        v-else
        type="button"
        severity="secondary"
        outlined
        :label="t('cadastro.cancelar')"
        :disabled="salvando"
        @click="aberta = false"
      />
      <Button
        type="submit"
        form="animal-da-ong"
        :icon="edicao || ultimo ? 'ph ph-check' : 'ph ph-arrow-right'"
        icon-pos="right"
        :label="
          edicao ? t('cadastro.salvar') : ultimo ? t('ong.novo.cadastrar') : t('ong.novo.avancar')
        "
        :loading="salvando"
      />
    </template>
  </CadastroGaveta>
</template>

<style scoped>
.ag__passos {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin: 0 0 4px;
  padding: 0;
  list-style: none;
}

.ag__passo {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
  color: var(--tinta-3);
  font-size: 13.5px;
}

/* O fio até o passo seguinte, depois do nome, ocupando o que sobra da coluna. */
.ag__passo:not(:last-child)::after {
  flex: 1 0 10px;
  height: 2px;
  border-radius: 2px;
  background: var(--linha);
  content: '';
}

.ag__passo--feito:not(:last-child)::after {
  background: color-mix(in oklab, var(--p-primary-color) 55%, var(--linha));
}

.ag__passo--feito {
  color: var(--tinta-2);
}

.ag__passo--agora {
  color: var(--tinta);
  font-weight: 700;
}

.ag__numero {
  display: grid;
  flex: none;
  width: 28px;
  height: 28px;
  place-items: center;
  border: 1.5px solid var(--linha);
  border-radius: 50%;
  font-family: var(--font-dados);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}

.ag__passo--agora .ag__numero {
  border-color: var(--p-primary-color);
  background: var(--p-primary-color);
  color: var(--p-primary-contrast-color);
}

.ag__passo--feito .ag__numero {
  border-color: color-mix(in oklab, var(--p-primary-color) 55%, var(--linha));
  background: color-mix(in oklab, var(--p-primary-color) 18%, transparent);
  color: var(--tinta);
  font-size: 15px;
}

.ag__nome {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ag__dica {
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
}
</style>
