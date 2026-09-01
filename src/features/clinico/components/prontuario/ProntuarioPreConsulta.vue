<script setup lang="ts">
/**
 * O que o responsável respondeu no app, antes da consulta.
 *
 * É onde o diferencial do produto aterrissa no prontuário — o mesmo caminho pelo qual o
 * agendamento nasce no app e cai na agenda, aplicado ao conteúdo clínico. O vet abre a consulta
 * já sabendo o quadro, em vez de gastar os três primeiros minutos reconstruindo-o.
 *
 * Três decisões que este componente encarna:
 *
 * - **Sugestão, nunca preenchimento.** Nada entra no prontuário sozinho. Campo que já vem
 *   escrito é campo que ninguém relê, e quem assina o prontuário é o veterinário — não o
 *   responsável.
 * - **A procedência fica visível.** Peso informado em casa e peso aferido na balança da clínica
 *   não valem o mesmo, e a tela precisa dizer qual é qual. Por isso o bloco tem moldura própria
 *   e diz de quem veio.
 * - **A data importa.** Resposta de duas semanas atrás descreve outro quadro. A idade da
 *   resposta aparece ao lado do título, não escondida.
 */
import Button from 'primevue/button'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useClinicFormat } from '../../composables/useClinicFormat'
import type { Anamnese, PreConsulta } from '../../data/types'

const props = defineProps<{
  preConsulta: PreConsulta
  anamnese: Anamnese
  somenteLeitura: boolean
}>()

const emit = defineEmits<{
  aplicar: [patch: Partial<Anamnese>]
}>()

const { t } = useI18n()
const formato = useClinicFormat()

/** Rótulo de cada resposta, na ordem em que o vet as lê. */
const respostas = computed(() => {
  const pre = props.preConsulta

  return [
    {
      chave: 'queixaPrincipal',
      rotulo: t('clinico.prontuario.anamnese.queixaPrincipal'),
      valor: pre.queixaPrincipal,
    },
    {
      chave: 'duracaoSintomas',
      rotulo: t('clinico.prontuario.anamnese.duracaoSintomas'),
      valor: pre.duracaoSintomas,
    },
    {
      chave: 'evolucao',
      rotulo: t('clinico.prontuario.anamnese.evolucao'),
      valor: pre.evolucao ? t(`clinico.prontuario.anamnese.evolucaoOpcoes.${pre.evolucao}`) : '',
    },
    {
      chave: 'apetite',
      rotulo: t('clinico.prontuario.anamnese.apetite'),
      valor: pre.apetite ? t(`clinico.prontuario.anamnese.opcoes.${pre.apetite}`) : '',
    },
  ].filter((item) => Boolean(item.valor))
})

/**
 * O que ainda **difere** do que está no prontuário.
 *
 * Some assim que o vet aplica ou digita por cima: um botão que continua oferecendo o que já foi
 * aceito treina a pessoa a ignorá-lo.
 */
const podeAplicar = computed(() => {
  if (props.somenteLeitura) {
    return false
  }

  const pre = props.preConsulta
  const atual = props.anamnese

  return (
    (Boolean(pre.queixaPrincipal) && !atual.queixaPrincipal.trim()) ||
    (Boolean(pre.duracaoSintomas) && !atual.duracaoSintomas.trim()) ||
    (Boolean(pre.evolucao) && !atual.evolucao) ||
    (Boolean(pre.apetite) && !atual.apetite)
  )
})

/**
 * Aplica só o que está **vazio** no prontuário.
 *
 * Nunca sobrescreve o que o vet já escreveu — mesmo que ele tenha escrito algo diferente do
 * que o responsável respondeu, e principalmente nesse caso: a divergência é achado clínico, não
 * erro a corrigir.
 */
function aplicar() {
  const pre = props.preConsulta
  const atual = props.anamnese
  const patch: Partial<Anamnese> = {}

  if (pre.queixaPrincipal && !atual.queixaPrincipal.trim()) {
    patch.queixaPrincipal = pre.queixaPrincipal
  }

  if (pre.duracaoSintomas && !atual.duracaoSintomas.trim()) {
    patch.duracaoSintomas = pre.duracaoSintomas
  }

  if (pre.evolucao && !atual.evolucao) {
    patch.evolucao = pre.evolucao
  }

  if (pre.apetite && !atual.apetite) {
    patch.apetite = pre.apetite
  }

  emit('aplicar', patch)
}
</script>

<template>
  <section class="pre" :aria-label="t('clinico.prontuario.preConsulta.titulo')">
    <header class="pre__topo">
      <div class="pre__identidade">
        <i class="pi pi-mobile pre__icone" aria-hidden="true" />
        <div>
          <strong class="pre__titulo">{{ t('clinico.prontuario.preConsulta.titulo') }}</strong>
          <p class="pre__origem">
            {{
              t('clinico.prontuario.preConsulta.origem', {
                quando: formato.relativo(preConsulta.respondidoEm),
              })
            }}
          </p>
        </div>
      </div>

      <Button
        v-if="podeAplicar"
        :label="t('clinico.prontuario.preConsulta.aplicar')"
        icon="pi pi-arrow-down"
        size="small"
        severity="secondary"
        outlined
        @click="aplicar"
      />
    </header>

    <dl class="pre__respostas">
      <div v-for="resposta in respostas" :key="resposta.chave">
        <dt class="clinic-label">{{ resposta.rotulo }}</dt>
        <dd>{{ resposta.valor }}</dd>
      </div>
    </dl>

    <!--
      Peso informado em casa vem marcado como tal e **não** entra nos vitais: ele orienta a
      dose antes de a balança confirmar, e confundi-lo com medição é o tipo de engano que só
      aparece na receita impressa.
    -->
    <p v-if="preConsulta.pesoInformadoKg !== null" class="pre__peso">
      <i class="pi pi-info-circle" aria-hidden="true" />
      {{
        t('clinico.prontuario.preConsulta.pesoInformado', {
          valor: formato.peso(preConsulta.pesoInformadoKg),
        })
      }}
    </p>

    <!-- Texto do responsável na íntegra, sem edição: é depoimento, não anotação clínica. -->
    <blockquote v-if="preConsulta.observacao" class="pre__citacao">
      {{ preConsulta.observacao }}
    </blockquote>
  </section>
</template>

<style scoped>
/*
 * Moldura própria e tracejada: o bloco precisa parecer o que é — informação **de fora**,
 * ainda não incorporada ao prontuário. Um cartão igual aos demais faria parecer preenchido.
 */
.pre {
  display: grid;
  gap: var(--clinic-space-3);
  padding: var(--clinic-space-4);
  border: 1px dashed var(--clinic-accent);
  border-radius: var(--clinic-radius-card);
  background: var(--clinic-accent-tint);
}

.pre__topo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--clinic-space-3);
}

.pre__identidade {
  display: flex;
  align-items: center;
  gap: var(--clinic-space-3);
}

.pre__icone {
  color: var(--clinic-accent-strong);
  font-size: 1.1rem;
}

.pre__titulo {
  font-size: var(--clinic-font-value);
  font-weight: 750;
  letter-spacing: -0.015em;
}

.pre__origem {
  margin: 0.05rem 0 0;
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
}

.pre__respostas {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 11rem), 1fr));
  gap: var(--clinic-space-3);
  margin: 0;
}

.pre__respostas div {
  display: grid;
  gap: 0.1rem;
  min-width: 0;
}

.pre__respostas dd {
  margin: 0;
  font-weight: 650;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.pre__peso {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin: 0;
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
  font-weight: 650;
}

.pre__citacao {
  margin: 0;
  padding: var(--clinic-space-2) var(--clinic-space-3);
  border-left: 3px solid var(--clinic-accent);
  background: var(--clinic-surface);
  border-radius: 0 var(--clinic-radius-control) var(--clinic-radius-control) 0;
  color: var(--clinic-muted);
  font-style: italic;
  line-height: 1.5;
}
</style>
