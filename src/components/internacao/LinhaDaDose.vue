<script setup lang="ts">
/**
 * Uma linha do checklist (E5-02b): a hora, o item, a situação lida agora e, enquanto pede
 * registro, "dei" (ou "conferi" na bomba de fluido), "pulei" e "recusou". Recusa e pulo são
 * coisas diferentes no histórico.
 *
 * A alergia (ou espécie) registrada depois da prescrição desliga o "dei" e manda chamar o
 * veterinário; "pulei" e "recusou" seguem. A dose em cima da troca de plantão leva a marca.
 * Desfazer só aparece na dose de quem a registrou, no mesmo plantão, em até 12 h.
 */
import Button from 'primevue/button'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  aRegistrar,
  type DoseDoPlantao,
  type DoseNoChecklist,
  type PrescricaoNoChecklist,
} from '@/service/parceiro/plantao-da-internacao-service'

const props = defineProps<{
  dose: DoseNoChecklist | DoseDoPlantao
  prescricao: PrescricaoNoChecklist | null
  /** No checklist do plantão: o animal e o leito. */
  onde?: string
  /** O nome de quem registrou e de quem ficou com a dose na passagem. */
  executadaPor: string
  atribuidaA: string
  podeRegistrar: boolean
  podeDesfazer: boolean
  ocupada: boolean
}>()
const emit = defineEmits<{
  dei: []
  naoDei: [status: 'PULADA' | 'RECUSADA']
  desfazer: []
}>()

const { t, te, locale } = useI18n()

function hora(valor: string | null) {
  if (!valor) return ''
  return new Date(valor).toLocaleTimeString(locale.value, { hour: '2-digit', minute: '2-digit' })
}

const barrada = computed(() =>
  Boolean(props.prescricao?.alergiaNova || props.prescricao?.especieProibidaNova),
)

const TOM: Record<string, string> = {
  atrasada: 'risco',
  'na-janela': 'atencao',
  feita: 'ok',
  pulada: 'contorno',
  recusada: 'contorno',
  suspensa: '',
  'nao-registrada': '',
  futura: '',
}

const situacao = computed(() => {
  const dose = props.dose
  switch (dose.situacao) {
    case 'atrasada':
      return t('internacao.dose.situacao.atrasada', { n: dose.atrasoMinutos }, dose.atrasoMinutos)
    case 'na-janela':
      return t('internacao.dose.situacao.naJanela')
    case 'futura':
      return ''
    case 'feita':
      return t(
        dose.conferencia ? 'internacao.dose.situacao.conferida' : 'internacao.dose.situacao.feita',
        { quem: props.executadaPor, hora: hora(dose.executadaEm) },
      )
    case 'pulada':
    case 'recusada':
      return [
        t(`internacao.dose.situacao.${dose.situacao}`),
        dose.motivo ? t(`internacao.dose.motivo.${dose.motivo}`) : '',
        props.executadaPor,
      ]
        .filter(Boolean)
        .join(' · ')
    case 'suspensa':
      return t('internacao.dose.situacao.suspensa')
    default:
      return t('internacao.dose.situacao.naoRegistrada')
  }
})

function via(codigo: string | null | undefined) {
  if (!codigo) return ''
  return te(`clinico.bulario.api.via.${codigo}`) ? t(`clinico.bulario.api.via.${codigo}`) : codigo
}

const meta = computed(() =>
  [
    props.onde ?? '',
    props.prescricao?.doseTexto ?? via(props.prescricao?.via),
    props.atribuidaA ? t('internacao.dose.comQuem', { nome: props.atribuidaA }) : '',
  ]
    .filter(Boolean)
    .join(' · '),
)

const observacao = computed(() =>
  'observacao' in props.dose && props.dose.observacao ? props.dose.observacao : '',
)
</script>

<template>
  <li
    class="ui-linha ld"
    :class="{
      'ui-marca ui-marca--risco': dose.situacao === 'atrasada',
      'ld--feita': !aRegistrar(dose.situacao),
    }"
  >
    <span class="ld__hora ui-hora">{{ hora(dose.previstaPara) }}</span>
    <span class="ui-linha__texto">
      <strong class="ui-linha__titulo ld__nome">
        <i
          :class="dose.conferencia ? 'ph ph-drop' : 'ph ph-pill'"
          class="ld__icone"
          aria-hidden="true"
        />
        {{ prescricao?.descricao ?? t('internacao.dose.item') }}
        <span
          v-if="situacao"
          class="ui-selo"
          :class="TOM[dose.situacao] ? `ui-selo--${TOM[dose.situacao]}` : ''"
          >{{ situacao }}</span
        >
        <span
          v-if="dose.atravessaAPassagem && aRegistrar(dose.situacao)"
          class="ui-selo ui-selo--contorno"
        >
          <i class="ph ph-arrows-left-right" aria-hidden="true" />
          {{ t('internacao.dose.naTroca') }}
        </span>
      </strong>
      <span v-if="meta" class="ui-linha__meta">{{ meta }}</span>
      <span v-if="observacao" class="ui-linha__meta">{{ observacao }}</span>
      <span v-if="barrada && aRegistrar(dose.situacao)" class="ld__barrada">
        <i class="ph ph-warning-octagon" aria-hidden="true" />
        {{
          prescricao?.alergiaNova
            ? t('internacao.dose.alergiaNova')
            : t('internacao.dose.especieProibidaNova')
        }}
      </span>
    </span>
    <span v-if="podeRegistrar && aRegistrar(dose.situacao)" class="ui-linha__fim ld__acoes">
      <Button
        v-if="!dose.conferencia"
        type="button"
        size="small"
        severity="secondary"
        outlined
        :label="t('internacao.dose.recusou')"
        :disabled="ocupada"
        @click="emit('naoDei', 'RECUSADA')"
      />
      <Button
        type="button"
        size="small"
        severity="secondary"
        outlined
        :label="t('internacao.dose.pulei')"
        :disabled="ocupada"
        @click="emit('naoDei', 'PULADA')"
      />
      <Button
        type="button"
        size="small"
        icon="ph ph-check"
        :label="dose.conferencia ? t('internacao.dose.conferi') : t('internacao.dose.dei')"
        :disabled="barrada"
        :loading="ocupada"
        @click="emit('dei')"
      />
    </span>
    <span v-else-if="podeDesfazer" class="ui-linha__fim">
      <Button
        type="button"
        size="small"
        severity="secondary"
        outlined
        icon="ph ph-arrow-counter-clockwise"
        :label="t('internacao.dose.desfazer')"
        :loading="ocupada"
        @click="emit('desfazer')"
      />
    </span>
  </li>
</template>

<style scoped>
.ld__hora {
  min-width: 3.2rem;
}

.ld__nome {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.ld__icone {
  color: var(--tinta-2);
}

.ld--feita .ld__nome {
  color: var(--tinta-2);
}

.ld__barrada {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--risco-tinta);
  font-size: 13px;
  font-weight: 600;
}

.ld__acoes {
  display: inline-flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
}
</style>
