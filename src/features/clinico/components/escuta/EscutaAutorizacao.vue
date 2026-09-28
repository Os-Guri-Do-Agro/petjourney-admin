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
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

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
    class="clinic-dialog"
    :style="{ width: 'min(34rem, 94vw)' }"
    dismissable-mask
  >
    <template #header>
      <h2 class="clinic-dialog__titulo">
        <span class="clinic-dialog__marca"><PhMicrophone weight="bold" aria-hidden="true" /></span>
        {{ t('clinico.escuta.autorizacao.titulo') }}
      </h2>
    </template>

    <div class="autorizacao clinic-scope">
      <p v-if="escuta.erro" class="autorizacao__erro" role="alert">
        <i class="pi pi-exclamation-circle" aria-hidden="true" />
        {{ t(`clinico.escuta.erro.${escuta.erro}`) }}
      </p>

      <p class="autorizacao__pedido">
        {{ t('clinico.escuta.autorizacao.pedido', { responsavel: nome }) }}
      </p>

      <section class="fala">
        <h3 class="clinic-label">
          {{ t('clinico.escuta.autorizacao.paraLer', { responsavel: nome }) }}
        </h3>
        <blockquote class="fala__texto">
          {{ t('clinico.escuta.autorizacao.texto', { responsavel: nome, pet }) }}
        </blockquote>
      </section>

      <section class="passos">
        <h3 class="clinic-label">{{ t('clinico.escuta.autorizacao.oQueAcontece') }}</h3>
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
        <h3 class="clinic-label">{{ t('clinico.escuta.fonte.rotulo') }}</h3>
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
        :label="t('clinico.escuta.autorizacao.naoAutorizou')"
        severity="secondary"
        text
        @click="escuta.autorizacaoAberta = false"
      />
      <Button
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
  gap: var(--clinic-space-5);
  line-height: 1.5;
}

.autorizacao h3 {
  margin: 0 0 var(--clinic-space-2);
}

.autorizacao__pedido {
  margin: 0;
  color: var(--clinic-muted);
}

.autorizacao__erro {
  display: flex;
  align-items: flex-start;
  gap: 0.4rem;
  margin: 0;
  padding: var(--clinic-space-3);
  border: 1px solid var(--clinic-attention-line);
  border-radius: var(--clinic-radius-control);
  background: var(--clinic-attention-bg);
  color: var(--clinic-attention-text);
  font-weight: 650;
}

.autorizacao__erro .pi {
  margin-top: 0.2rem;
}

/*
 * A fala para o responsável é o único texto grande do diálogo: é para ser lida em voz alta, ou
 * lida por alguém do outro lado da mesa.
 */
.fala__texto {
  margin: 0;
  padding: var(--clinic-space-3) var(--clinic-space-4);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-control);
  background: var(--clinic-surface-soft);
  font-size: var(--clinic-font-value);
  line-height: 1.6;
}

.passos ul {
  display: grid;
  gap: var(--clinic-space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.passos li {
  display: grid;
  grid-template-columns: 1.2rem minmax(0, 1fr);
  align-items: start;
  gap: var(--clinic-space-2);
}

.passos li svg {
  margin-top: 0.15rem;
  color: var(--clinic-accent-strong);
  font-size: 1.05rem;
}

.fonte__dica {
  margin: var(--clinic-space-2) 0 0;
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
}
</style>
