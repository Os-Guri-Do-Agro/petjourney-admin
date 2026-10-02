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
 *   e diz de quem veio — e cada resposta que o app puxou do diário, sem o responsável mexer,
 *   diz isso também.
 * - **A data importa.** Resposta de duas semanas atrás descreve outro quadro. A idade da
 *   resposta aparece ao lado do título, não escondida.
 *
 * As respostas chegam nos enums do Diário Pet (o contrato com o app). O que tem tradução
 * clínica direta é aplicável na anamnese (`domain/pre-consulta.ts`); o que é achado — fezes com
 * sangue, urina escura — aparece para o vet ler, e fica com ele.
 */
import Button from 'primevue/button'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useClinicFormat } from '../../composables/useClinicFormat'
import type { RespostaDaPreConsulta } from '../../contrato/responsavel'
import type { Anamnese, PreConsulta } from '../../data/types'
import {
  apetiteDaAnamnese,
  evacuacaoDaAnamnese,
  evolucaoDaAnamnese,
  miccaoDaAnamnese,
} from '../../domain/pre-consulta'

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

type CampoDoDiario = 'alimentacao' | 'hidratacao' | 'fezes' | 'urina' | 'vitalidade'

const CAMPOS_DO_DIARIO: CampoDoDiario[] = [
  'alimentacao',
  'hidratacao',
  'fezes',
  'urina',
  'vitalidade',
]

function veioDoDiario(campo: RespostaDaPreConsulta['camposDoDiario'][number]) {
  return props.preConsulta.camposDoDiario.includes(campo)
}

const duracao = computed(() =>
  props.preConsulta.desdeQuando
    ? t(`clinico.preConsulta.desdeQuando.${props.preConsulta.desdeQuando}`)
    : '',
)

/** Rótulo de cada resposta, na ordem em que o vet as lê: o porquê, o quê, desde quando. */
const respostas = computed(() => {
  const pre = props.preConsulta
  const evolucao = evolucaoDaAnamnese(pre.evolucao)

  return [
    {
      chave: 'motivo',
      rotulo: t('clinico.preConsulta.motivo'),
      valor: t(`clinico.diario.motivo.${pre.motivo}`),
      doDiario: false,
    },
    {
      chave: 'queixaPrincipal',
      rotulo: t('clinico.prontuario.anamnese.queixaPrincipal'),
      valor: pre.queixaPrincipal,
      doDiario: false,
    },
    {
      chave: 'sintomas',
      rotulo: t('clinico.diario.campo.sintomas'),
      valor: pre.sintomas.map((sintoma) => t(`clinico.diario.sintomas.${sintoma}`)).join(' · '),
      doDiario: veioDoDiario('sintomas'),
    },
    {
      chave: 'duracaoSintomas',
      rotulo: t('clinico.prontuario.anamnese.duracaoSintomas'),
      valor: duracao.value,
      doDiario: false,
    },
    {
      chave: 'evolucao',
      rotulo: t('clinico.prontuario.anamnese.evolucao'),
      valor: evolucao ? t(`clinico.prontuario.anamnese.evolucaoOpcoes.${evolucao}`) : '',
      doDiario: false,
    },
    ...CAMPOS_DO_DIARIO.map((campo) => ({
      chave: campo,
      rotulo: t(`clinico.diario.campo.${campo}`),
      valor: pre[campo] ? t(`clinico.diario.${campo}.${pre[campo]}`) : '',
      doDiario: veioDoDiario(campo),
    })),
  ].filter((item) => Boolean(item.valor))
})

/** O que a resposta mandaria para a anamnese, se o vet aceitar. Só o que tem tradução clínica. */
const sugerido = computed<Partial<Anamnese>>(() => {
  const pre = props.preConsulta

  return {
    queixaPrincipal: pre.queixaPrincipal,
    duracaoSintomas: duracao.value,
    evolucao: evolucaoDaAnamnese(pre.evolucao),
    apetite: apetiteDaAnamnese(pre.alimentacao),
    evacuacao: evacuacaoDaAnamnese(pre.fezes),
    miccao: miccaoDaAnamnese(pre.urina),
  }
})

/**
 * Aplica só o que está **vazio** no prontuário.
 *
 * Nunca sobrescreve o que o vet já escreveu — mesmo que ele tenha escrito algo diferente do
 * que o responsável respondeu, e principalmente nesse caso: a divergência é achado clínico, não
 * erro a corrigir.
 */
const patch = computed<Partial<Anamnese>>(() => {
  const atual = props.anamnese
  const resultado: Partial<Anamnese> = {}

  for (const [chave, valor] of Object.entries(sugerido.value) as Array<[keyof Anamnese, string]>) {
    const presente = atual[chave]
    const vazio = typeof presente === 'string' ? !presente.trim() : presente === null

    if (valor && vazio) {
      Object.assign(resultado, { [chave]: valor })
    }
  }

  return resultado
})

/**
 * Some assim que o vet aplica ou digita por cima: um botão que continua oferecendo o que já foi
 * aceito treina a pessoa a ignorá-lo.
 */
const podeAplicar = computed(() => !props.somenteLeitura && Object.keys(patch.value).length > 0)
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
        @click="emit('aplicar', patch)"
      />
    </header>

    <dl class="pre__respostas">
      <div v-for="resposta in respostas" :key="resposta.chave">
        <dt class="clinic-label">
          {{ resposta.rotulo }}
          <!-- O app puxou do diário e o responsável não mexeu: é leitura de casa, não resposta. -->
          <span v-if="resposta.doDiario" class="pre__procedencia">
            {{ t('clinico.preConsulta.doDiario') }}
          </span>
        </dt>
        <dd>{{ resposta.valor }}</dd>
      </div>
    </dl>

    <!--
      Peso informado em casa vem marcado como tal e **não** entra nos vitais: ele orienta a
      dose antes de a balança confirmar, e confundi-lo com medição é o tipo de engano que só
      aparece na receita impressa.
    -->
    <p v-if="preConsulta.pesoKg !== null" class="pre__peso">
      <i class="pi pi-info-circle" aria-hidden="true" />
      {{
        t('clinico.prontuario.preConsulta.pesoInformado', {
          valor: formato.peso(preConsulta.pesoKg),
        })
      }}
      <span v-if="preConsulta.pesadoEm" class="pre__quando">
        {{ t('clinico.preConsulta.pesadoEm', { data: formato.dataCurta(preConsulta.pesadoEm) }) }}
      </span>
    </p>

    <!-- Texto do responsável na íntegra, sem edição: é depoimento, não anotação clínica. -->
    <blockquote v-if="preConsulta.observacao" class="pre__citacao">
      {{ preConsulta.observacao }}
    </blockquote>

    <p v-if="preConsulta.fotoIds.length > 0" class="pre__fotos">
      <i class="pi pi-images" aria-hidden="true" />
      {{ t('clinico.preConsulta.fotos', { total: preConsulta.fotoIds.length }) }}
    </p>
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

/* A marca "do diário" é procedência, não destaque: o mesmo tom discreto do rótulo, sem caixa alta. */
.pre__procedencia {
  margin-inline-start: var(--clinic-space-1);
  color: var(--clinic-accent-strong);
  font-weight: 600;
  letter-spacing: 0;
  text-transform: none;
}

.pre__peso,
.pre__fotos {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  margin: 0;
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
  font-weight: 650;
}

.pre__quando {
  color: var(--clinic-faint);
  font-weight: 500;
}

.pre__citacao {
  margin: 0;
  padding: var(--clinic-space-2) var(--clinic-space-3);
  border-inline-start: 3px solid var(--clinic-accent);
  background: var(--clinic-surface);
  border-radius: 0;
  border-start-end-radius: var(--clinic-radius-control);
  border-end-end-radius: var(--clinic-radius-control);
  color: var(--clinic-muted);
  font-style: italic;
  line-height: 1.5;
}
</style>
