<script setup lang="ts">
/**
 * Ajustar a rotina de um hóspede (E7-05b, guia e7 43): água, higiene, passeio ou pesagem. O ajuste
 * **substitui a lista inteira** do tipo (nunca soma) ou **suspende**; um vigente por tipo, o novo
 * revoga o anterior. O motivo é obrigatório (10 a 300). Substituir liga o tipo para este hóspede
 * mesmo que a casa não o faça; o passeio continua exigindo a autorização do check-in. Refeição,
 * medicação e serviço não se ajustam aqui.
 */
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import Textarea from 'primevue/textarea'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import {
  ajustarRotina,
  HORARIOS_DA_ROTINA_MAX,
  KINDS_DA_CASA,
  MOTIVO_DO_AJUSTE_MAX,
  MOTIVO_DO_AJUSTE_MIN,
  type AjustesDoHospede,
  type KindDaCasa,
} from '@/service/parceiro/hotel-rotina-service'

import { escreverHorarios, lerHorarios } from './rotina-do-hotel'

const props = defineProps<{
  hospedagemId: string
  /** O tipo escolhido na linha, e os horários de agora como ponto de partida. */
  kind: KindDaCasa | null
  horarios: string[]
}>()
const aberta = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{ salvo: [rotina: AjustesDoHospede] }>()

const { t } = useI18n()
const { parceiroQuery } = useParceiroPortal()

const item = ref<KindDaCasa>('AGUA')
const acao = ref<'SUBSTITUI' | 'SUSPENDE'>('SUBSTITUI')
const texto = ref('')
const motivo = ref('')
const tentou = ref(false)
const salvando = ref(false)
const erro = ref('')

watch(aberta, (agora) => {
  if (!agora) return
  item.value = props.kind ?? 'AGUA'
  acao.value = 'SUBSTITUI'
  texto.value = escreverHorarios(props.horarios)
  motivo.value = ''
  tentou.value = false
  erro.value = ''
})

const opcoesDeKind = computed(() =>
  KINDS_DA_CASA.map((valor) => ({ valor, rotulo: t(`rotinaDoHotel.kind.${valor}`) })),
)
const opcoesDeAcao = computed(() => [
  { valor: 'SUBSTITUI', rotulo: t('rotinaDoHotel.ajuste.SUBSTITUI') },
  { valor: 'SUSPENDE', rotulo: t('rotinaDoHotel.ajuste.SUSPENDE') },
])

const lidos = computed(() => lerHorarios(texto.value, HORARIOS_DA_ROTINA_MAX))
const problemaDosHorarios = computed(() => {
  if (acao.value === 'SUSPENDE') return ''
  if (lidos.value.erro === 'FORMATO') return t('rotinaDoHotel.casa.horarioInvalido')
  if (lidos.value.erro === 'DEMAIS')
    return t('rotinaDoHotel.casa.horariosDemais', { n: HORARIOS_DA_ROTINA_MAX })
  if (!lidos.value.horarios.length) return t('rotinaDoHotel.casa.semHorario')
  return ''
})
const motivoValido = computed(() => motivo.value.trim().length >= MOTIVO_DO_AJUSTE_MIN)
const valido = computed(() => !problemaDosHorarios.value && motivoValido.value)

async function salvar() {
  tentou.value = true
  erro.value = ''
  if (!valido.value) return
  salvando.value = true
  try {
    const rotina = await ajustarRotina(
      props.hospedagemId,
      {
        kind: item.value,
        acao: acao.value,
        ...(acao.value === 'SUBSTITUI' ? { horarios: lidos.value.horarios } : {}),
        motivo: motivo.value.trim(),
      },
      parceiroQuery(),
    )
    aberta.value = false
    emit('salvo', rotina)
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('rotinaDoHotel.ajuste.erro')).mensagem
  } finally {
    salvando.value = false
  }
}
</script>

<template>
  <CadastroGaveta
    v-model:visible="aberta"
    :titulo="t('rotinaDoHotel.ajuste.titulo')"
    icone="ph ph-sliders-horizontal"
  >
    <form id="ajuste-hotel" class="eg" novalidate @submit.prevent="salvar">
      <p class="eg__dica">{{ t('rotinaDoHotel.ajuste.dica') }}</p>
      <section class="eg__secao">
        <label class="eg__rotulo" for="aj-kind">{{ t('rotinaDoHotel.ajuste.oQue') }}</label>
        <Select
          v-model="item"
          input-id="aj-kind"
          :options="opcoesDeKind"
          option-label="rotulo"
          option-value="valor"
          :disabled="salvando"
        />
      </section>
      <section class="eg__secao">
        <span id="aj-acao" class="eg__rotulo">{{ t('rotinaDoHotel.ajuste.como') }}</span>
        <SelectButton
          v-model="acao"
          :options="opcoesDeAcao"
          option-label="rotulo"
          option-value="valor"
          :allow-empty="false"
          aria-labelledby="aj-acao"
          :disabled="salvando"
        />
        <small v-if="item === 'PASSEIO'" class="eg__dica">{{
          t('rotinaDoHotel.casa.sobre.PASSEIO')
        }}</small>
      </section>
      <section v-if="acao === 'SUBSTITUI'" class="eg__secao">
        <label class="eg__rotulo" for="aj-horarios">{{ t('rotinaDoHotel.casa.horarios') }}</label>
        <InputText
          id="aj-horarios"
          v-model="texto"
          :placeholder="t('rotinaDoHotel.casa.horariosExemplo')"
          :invalid="tentou && Boolean(problemaDosHorarios)"
          :disabled="salvando"
        />
        <small v-if="tentou && problemaDosHorarios" class="eg__invalido">{{
          problemaDosHorarios
        }}</small>
      </section>
      <section class="eg__secao">
        <label class="eg__rotulo" for="aj-motivo">{{ t('rotinaDoHotel.ajuste.motivo') }}</label>
        <Textarea
          id="aj-motivo"
          v-model="motivo"
          rows="2"
          auto-resize
          :maxlength="MOTIVO_DO_AJUSTE_MAX"
          :invalid="tentou && !motivoValido"
          :disabled="salvando"
        />
        <small :class="tentou && !motivoValido ? 'eg__invalido' : 'eg__dica'">{{
          t('rotinaDoHotel.ajuste.motivoDica', { min: MOTIVO_DO_AJUSTE_MIN })
        }}</small>
      </section>
      <p v-if="erro" class="eg__erro" role="alert">
        <i class="ph ph-warning-circle" aria-hidden="true" />
        <span>{{ erro }}</span>
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
        form="ajuste-hotel"
        icon="ph ph-check"
        :label="t('cadastro.salvar')"
        :loading="salvando"
      />
    </template>
  </CadastroGaveta>
</template>
