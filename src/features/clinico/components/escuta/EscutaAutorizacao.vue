<script setup lang="ts">
/**
 * Antes de gravar, o responsável concorda.
 *
 * O centro do diálogo é um texto escrito **para o responsável**, e não para o veterinário: é a
 * fala que ele lê em voz alta, ou vira a tela para a pessoa ler. Diz as três coisas que quem é
 * gravado quer saber — para que serve, o que fica guardado, e que dá para dizer não e para parar.
 * A frase é a do produto, e ela é verdade aqui: nenhum áudio é guardado; o que volta do
 * reconhecimento é texto.
 *
 * Abaixo, para o veterinário, o que a gravação faz e o que não faz — incluindo a linha que o
 * requisito pede explícita: diagnóstico e conduta não são preenchidos por voz.
 *
 * **Não existe aviso no app do responsável.** O contrato com o app não tem esse campo, e uma
 * prévia de um aviso que o celular não vai mostrar seria promessa falsa desenhada. O
 * consentimento é o da sala, dito e registrado com nome e hora.
 *
 * A fonte escolhida é lembrada entre um paciente e outro. Sem reconhecimento de voz no
 * navegador, o microfone aparece desligado e diz por quê, em vez de sumir.
 */
import { PhMicrophone, PhShieldCheck, PhStethoscope, PhWaveform } from '@phosphor-icons/vue'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import SelectButton from 'primevue/selectbutton'
import { computed, useId } from 'vue'
import { useI18n } from 'vue-i18n'

import ProntuarioDialogoTopo from '../prontuario/ProntuarioDialogoTopo.vue'
import type { PetSex } from '../../data/types'
import { useEscutaStore, type FonteDaEscutaId } from '../../stores/escuta'

const props = defineProps<{
  encounterId: string
  /** Primeiro nome, como se fala com alguém na sala. Vazio quando o prontuário não tem responsável. */
  responsavel: string
  pet: string
  sexo: PetSex
}>()

const { t } = useI18n()
const escuta = useEscutaStore()
const idTitulo = useId()

const nome = computed(
  () => props.responsavel || t('clinico.escuta.autorizacao.responsavelGenerico'),
)

const opcoesDeFonte = computed(() => [
  {
    valor: 'microfone' as FonteDaEscutaId,
    rotulo: t('clinico.escuta.fonte.microfone'),
    desligada: !escuta.microfone,
  },
  {
    valor: 'demonstracao' as FonteDaEscutaId,
    rotulo: t('clinico.escuta.fonte.demonstracao'),
    desligada: false,
  },
])

const dicaDaFonte = computed(() => {
  if (!escuta.microfone && escuta.fonte === 'microfone') {
    return t('clinico.escuta.fonte.semMicrofone')
  }

  return escuta.fonte === 'microfone'
    ? t('clinico.escuta.fonte.microfoneDica')
    : t('clinico.escuta.fonte.demonstracaoDica')
})

const podeComecar = computed(() => escuta.fonte === 'demonstracao' || escuta.microfone)

function reduzirMovimento() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

function comecar() {
  escuta.iniciar({
    encounterId: props.encounterId,
    responsavel: props.responsavel || nome.value,
    pet: props.pet,
    sexo: props.sexo,
    reduzirMovimento: reduzirMovimento(),
  })
}
</script>

<template>
  <Dialog
    v-model:visible="escuta.autorizacaoAberta"
    modal
    class="clinic-dialog hc-tema"
    :style="{ width: 'min(36rem, 94vw)' }"
    :aria-labelledby="idTitulo"
    dismissable-mask
  >
    <template #header>
      <ProntuarioDialogoTopo
        :id="idTitulo"
        :titulo="t('clinico.escuta.autorizacao.titulo')"
        :subtitulo="t('clinico.escuta.autorizacao.pedido', { responsavel: nome })"
        icone="ph ph-microphone"
        tom="risco"
      />
    </template>

    <div class="autorizacao">
      <p v-if="escuta.erro" class="autorizacao__erro" role="alert">
        <i class="ph ph-warning-circle" aria-hidden="true" />
        {{ t(`clinico.escuta.erro.${escuta.erro}`) }}
      </p>

      <!-- A fala para o responsável: o único texto grande, para ser lido em voz alta. -->
      <section class="fala">
        <h3 class="autorizacao__titulo">
          {{ t('clinico.escuta.autorizacao.paraLer', { responsavel: nome }) }}
        </h3>
        <blockquote class="fala__texto">
          {{ t('clinico.escuta.autorizacao.texto', { responsavel: nome, pet }) }}
        </blockquote>
      </section>

      <section class="passos">
        <h3 class="autorizacao__titulo">{{ t('clinico.escuta.autorizacao.oQueAcontece') }}</h3>
        <ul>
          <li>
            <PhWaveform weight="duotone" aria-hidden="true" />
            {{ t('clinico.escuta.autorizacao.passoEscuta') }}
          </li>
          <li>
            <PhShieldCheck weight="duotone" aria-hidden="true" />
            {{ t('clinico.escuta.autorizacao.passoRevisao') }}
          </li>
          <li>
            <PhStethoscope weight="duotone" aria-hidden="true" />
            {{ t('clinico.escuta.autorizacao.passoDecisao') }}
          </li>
        </ul>
      </section>

      <section class="fonte">
        <h3 class="autorizacao__titulo">{{ t('clinico.escuta.fonte.rotulo') }}</h3>
        <SelectButton
          :model-value="escuta.fonte"
          :options="opcoesDeFonte"
          option-label="rotulo"
          option-value="valor"
          option-disabled="desligada"
          :allow-empty="false"
          :aria-label="t('clinico.escuta.fonte.rotulo')"
          @update:model-value="escuta.escolherFonte($event)"
        />
        <p class="fonte__dica">{{ dicaDaFonte }}</p>
      </section>
    </div>

    <template #footer>
      <Button
        type="button"
        :label="t('clinico.escuta.autorizacao.naoAutorizou')"
        severity="secondary"
        text
        @click="escuta.autorizacaoAberta = false"
      />
      <Button
        type="button"
        :label="t('clinico.escuta.autorizacao.autorizou', { responsavel: nome })"
        :disabled="!podeComecar"
        @click="comecar"
      >
        <template #icon>
          <PhMicrophone weight="bold" class="p-button-icon p-button-icon-left" aria-hidden="true" />
        </template>
      </Button>
    </template>
  </Dialog>
</template>

<style scoped>
.autorizacao {
  display: grid;
  gap: 20px;
  color: var(--tinta);
  font-size: 14px;
  line-height: 1.5;
}

.autorizacao__titulo {
  margin: 0 0 8px;
  color: var(--tinta);
  font-size: 14px;
  font-weight: 600;
}

.autorizacao__erro {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--atencao-fundo);
  color: var(--atencao-tinta);
  font-weight: 550;
}

.autorizacao__erro .ph {
  margin-top: 3px;
}

/*
 * A fala para o responsável é o único texto grande do diálogo: é para ser lida em voz alta, ou
 * lida por alguém do outro lado da mesa.
 */
.fala__texto {
  margin: 0;
  padding: 14px 16px;
  border-inline-start: 3px solid var(--clinica);
  border-radius: 0 12px 12px 0;
  background: var(--superficie-2);
  color: var(--tinta);
  font-size: 16px;
  line-height: 1.6;
}

.passos ul {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.passos li {
  display: grid;
  align-items: start;
  gap: 10px;
  color: var(--tinta-2);
  grid-template-columns: 20px minmax(0, 1fr);
}

.passos li svg {
  margin-top: 2px;
  color: var(--clinica-tinta);
  font-size: 18px;
}

.fonte__dica {
  margin: 8px 0 0;
  color: var(--tinta-3);
  font-size: 13px;
}
</style>
