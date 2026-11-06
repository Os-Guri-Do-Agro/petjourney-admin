<script setup lang="ts">
/**
 * O que o responsável respondeu no app antes da consulta, no rascunho aberto pelo agendamento
 * (guia e4 11.1). Recolhida numa linha; aberta, o que não tem campo na anamnese: o motivo, os
 * sintomas, a água, a disposição, a observação e o peso de casa (que **nunca** vira peso aferido).
 * As fotos abrem pelo horário na agenda, onde a URL de 15 minutos é lida.
 */
import Button from 'primevue/button'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import { useRotulosDoCadastro } from '@/components/cadastro/useRotulosDoCadastro'
import type { Atendimento } from '@/service/parceiro/atendimentos-service'

const props = defineProps<{
  preConsulta: NonNullable<Atendimento['preConsulta']>
  agendamentoId: string | null
  dataDoAtendimento: string
  somenteLeitura: boolean
  /** Campos vazios da anamnese com sugestão: o "Usar o que está vazio". */
  vazios: number
}>()
const emit = defineEmits<{ usarVazios: [] }>()

const { t } = useI18n()
const rotulos = useRotulosDoCadastro()

const aberta = ref(false)

function valor(item: { valor: unknown } | null) {
  return item ? (item.valor as unknown) : null
}

const linhas = computed(() => {
  const pre = props.preConsulta
  const lista: { rotulo: string; texto: string; doDiario?: boolean }[] = []
  const motivo = valor(pre.motivo)
  if (motivo) {
    lista.push({
      rotulo: t('clinico.preConsulta.motivo'),
      texto: t(`clinico.diario.motivo.${String(motivo)}`),
    })
  }
  const sintomas = valor(pre.sintomas)
  if (Array.isArray(sintomas) && sintomas.length) {
    lista.push({
      rotulo: t('clinico.diario.campo.sintomas'),
      texto: sintomas.map((s) => t(`clinico.diario.sintomas.${String(s)}`)).join(', '),
      doDiario: pre.sintomas?.procedencia === 'DIARIO',
    })
  }
  const hidratacao = valor(pre.hidratacao)
  if (hidratacao) {
    lista.push({
      rotulo: t('clinico.diario.campo.hidratacao'),
      texto: t(`clinico.diario.hidratacao.${String(hidratacao)}`),
      doDiario: pre.hidratacao?.procedencia === 'DIARIO',
    })
  }
  const vitalidade = valor(pre.vitalidade)
  if (vitalidade) {
    lista.push({
      rotulo: t('clinico.diario.campo.vitalidade'),
      texto: t(`clinico.diario.vitalidade.${String(vitalidade)}`),
      doDiario: pre.vitalidade?.procedencia === 'DIARIO',
    })
  }
  if (pre.pesoDeCasa) {
    lista.push({
      rotulo: t('agendamentos.preConsulta.pesoDeCasa'),
      texto: pre.pesoDeCasa.pesadoEm
        ? t('agendamentos.preConsulta.pesoEm', {
            peso: rotulos.peso(pre.pesoDeCasa.pesoKg),
            dia: rotulos.dia(pre.pesoDeCasa.pesadoEm),
          })
        : t('agendamentos.preConsulta.peso', { peso: rotulos.peso(pre.pesoDeCasa.pesoKg) }),
      doDiario: pre.pesoDeCasa.procedencia === 'DIARIO',
    })
  }
  return lista
})

const quando = computed(
  () =>
    `${rotulos.dia(props.preConsulta.respondidaEm.slice(0, 10))} ${props.preConsulta.respondidaEm.slice(11, 16)}`,
)
</script>

<template>
  <section class="ui-folha ui-cartao pna" aria-labelledby="pna-titulo">
    <header class="ui-cartao__cabeca">
      <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-device-mobile" /></span>
      <span class="ui-cartao__titulos">
        <h2 id="pna-titulo" class="ui-cartao__titulo">{{ t('atendimento.preConsulta.titulo') }}</h2>
        <p class="ui-cartao__descricao">
          {{ t('atendimento.preConsulta.respondida', { quando }) }}
        </p>
      </span>
      <span class="ui-cartao__acoes">
        <Button
          v-if="vazios && !somenteLeitura"
          type="button"
          size="small"
          severity="secondary"
          outlined
          :label="t('atendimento.preConsulta.usarVazios', { n: vazios }, vazios)"
          @click="emit('usarVazios')"
        />
        <Button
          type="button"
          size="small"
          severity="secondary"
          outlined
          :icon="aberta ? 'ph ph-caret-up' : 'ph ph-caret-down'"
          :label="aberta ? t('atendimento.preConsulta.fechar') : t('atendimento.preConsulta.ver')"
          :aria-expanded="aberta"
          aria-controls="pna-corpo"
          @click="aberta = !aberta"
        />
      </span>
    </header>

    <div v-if="aberta" id="pna-corpo" class="ui-cartao__corpo pna__corpo">
      <dl v-if="linhas.length" class="pna__dados">
        <div v-for="linha in linhas" :key="linha.rotulo">
          <dt>{{ linha.rotulo }}</dt>
          <dd>
            {{ linha.texto }}
            <small v-if="linha.doDiario" class="pna__fonte">{{
              t('clinico.preConsulta.doDiario')
            }}</small>
          </dd>
        </div>
      </dl>
      <p v-if="preConsulta.pesoDeCasa" class="pna__nota">
        <i class="ph ph-info" aria-hidden="true" />
        {{ t('agendamentos.preConsulta.pesoNaoVaiAosVitais') }}
      </p>
      <div v-if="preConsulta.observacao" class="pna__observacao">
        <small>{{ t('agendamentos.preConsulta.observacao') }}</small>
        <p>{{ preConsulta.observacao }}</p>
      </div>
      <p v-if="preConsulta.fotoIds.length && agendamentoId" class="pna__nota">
        <i class="ph ph-image" aria-hidden="true" />
        {{ t('clinico.preConsulta.fotos', { total: preConsulta.fotoIds.length }) }}
        <RouterLink
          :to="{
            path: '/clinica/agenda',
            query: { data: dataDoAtendimento, horario: agendamentoId },
          }"
        >
          {{ t('atendimento.preConsulta.verFotos') }}
        </RouterLink>
      </p>
    </div>
  </section>
</template>

<style scoped>
.pna__corpo {
  display: grid;
  gap: 14px;
}

.pna__dados {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr));
  gap: 12px 24px;
  margin: 0;
}

.pna__dados dt {
  color: var(--tinta-2);
  font-size: 12.5px;
}

.pna__dados dd {
  margin: 2px 0 0;
  color: var(--tinta);
  font-size: 14px;
}

.pna__fonte {
  margin-inline-start: 6px;
  color: var(--tinta-3);
  font-size: 12px;
}

.pna__nota {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin: 0;
  color: var(--tinta-2);
  font-size: 13px;
}

.pna__nota a {
  color: var(--tinta);
}

.pna__observacao small {
  color: var(--tinta-2);
  font-size: 12.5px;
}

.pna__observacao p {
  margin: 2px 0 0;
  white-space: pre-line;
}
</style>
