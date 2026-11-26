<script setup lang="ts">
/**
 * Encerrar o cadastro do animal (óbito, fuga, transferência ou outro motivo): `POST .../encerrar`.
 * A API cancela o convite pendente e libera a vaga no limite da ONG. Não se desfaz: a gaveta diz
 * isso antes do botão.
 */
import Button from 'primevue/button'
import SelectButton from 'primevue/selectbutton'
import { useToast } from 'primevue/usetoast'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDaOng } from '@/components/ong/regras-da-ong'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import {
  encerrarAnimal,
  MOTIVOS_DO_ENCERRAMENTO,
  type AnimalDaOng,
  type MotivoDoEncerramento,
} from '@/service/parceiro/ong-service'

const props = defineProps<{ animal: AnimalDaOng }>()
const emit = defineEmits<{ salvo: [animal: AnimalDaOng]; mudou: [] }>()
const aberta = defineModel<boolean>('visible', { default: false })

const { t } = useI18n()
const toast = useToast()
const { parceiroQuery } = useParceiroPortal()

const motivo = ref<MotivoDoEncerramento | null>(null)
const tentou = ref(false)
const erro = ref('')
const salvando = ref(false)

watch(aberta, (agora) => {
  if (!agora) return
  motivo.value = null
  tentou.value = false
  erro.value = ''
})

const opcoes = computed(() =>
  MOTIVOS_DO_ENCERRAMENTO.map((valor) => ({ valor, rotulo: t(`ong.encerramento.${valor}`) })),
)

async function encerrar() {
  tentou.value = true
  erro.value = ''
  if (!motivo.value) return

  salvando.value = true

  try {
    const salvo = await encerrarAnimal(props.animal.id, motivo.value, parceiroQuery())
    toast.add({ severity: 'success', summary: t('ong.encerrar.feito'), life: 3500 })
    emit('salvo', salvo)
    aberta.value = false
  } catch (err) {
    const lido = lerErroDaOng(err, t, t('ong.erros.salvar'))

    if (lido.recarregar) {
      toast.add({ severity: 'warn', summary: lido.mensagem, life: 6000 })
      emit('mudou')
      aberta.value = false
      return
    }

    erro.value = lido.mensagem
  } finally {
    salvando.value = false
  }
}
</script>

<template>
  <CadastroGaveta v-model:visible="aberta" :titulo="t('ong.encerrar.titulo')" icone="ph ph-archive">
    <form id="encerrar-animal" class="eg" novalidate @submit.prevent="encerrar">
      <p class="eg__dica">{{ t('ong.encerrar.texto', { nome: animal.nome }) }}</p>

      <section class="eg__secao">
        <span id="ea-motivo" class="eg__rotulo">{{ t('ong.encerrar.motivo') }}</span>
        <SelectButton
          v-model="motivo"
          :options="opcoes"
          option-label="rotulo"
          option-value="valor"
          aria-labelledby="ea-motivo"
          :invalid="tentou && !motivo"
          :disabled="salvando"
          class="ea__motivos"
        />
        <small v-if="tentou && !motivo" class="eg__invalido">{{ t('ong.encerrar.escolha') }}</small>
      </section>

      <p class="eg__aviso">
        <i class="ph ph-info" aria-hidden="true" />
        <span>{{ t('ong.encerrar.irreversivel') }}</span>
      </p>

      <p v-if="erro" class="eg__erro" role="alert">
        <i class="ph ph-warning-circle" aria-hidden="true" />
        <span>{{ erro }}</span>
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
        form="encerrar-animal"
        severity="danger"
        icon="ph ph-archive"
        :label="t('ong.encerrar.confirmar')"
        :loading="salvando"
      />
    </template>
  </CadastroGaveta>
</template>

<style scoped>
.ea__motivos {
  flex-wrap: wrap;
}
</style>
