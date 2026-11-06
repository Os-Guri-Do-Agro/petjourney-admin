<script setup lang="ts">
/**
 * A conduta do atendimento (E4-01): o que vai ao responsável (orientações e sinais de alerta), o
 * retorno, o que fica só na clínica e os atos feitos na consulta (medicação aplicada, curativo).
 *
 * O retorno é decisão do veterinário (D5): os dias e, se quiser, o tipo. A recepção só marca o
 * horário (Retornos pendentes); daqui, quem tem `agenda.escrever` marca com um toque, no primeiro
 * horário livre de quem atendeu a partir do vencimento.
 */
import Button from 'primevue/button'
import InputNumber from 'primevue/inputnumber'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import { useRotulosDoCadastro } from '@/components/cadastro/useRotulosDoCadastro'
import { INTL_LOCALE, type Locale } from '@/i18n/locales'
import type { TipoDeAtendimento } from '@/service/parceiro/agenda-config-service'
import { RETORNO_DIAS_MAX, type Atendimento } from '@/service/parceiro/atendimentos-service'

import './secao.css'
import type { CondutaNaTela } from './rascunho-do-atendimento'

type AtoNaLista = Atendimento['atos']['itens'][number]

const props = defineProps<{
  somenteLeitura: boolean
  tipos: TipoDeAtendimento[]
  atos: Atendimento['atos']
  dataDoAtendimento: string
  retornoAgendamentoId: string | null
  /** Os dias do retorno que o servidor já tem (marcar só vale com eles gravados). */
  retornoGravado: number | null
  podeMarcarRetorno: boolean
  marcandoRetorno: boolean
  podeRegistrarAto: boolean
  podeAnularAto: boolean
  faltaConduta?: boolean
}>()
const model = defineModel<CondutaNaTela>({ required: true })
const emit = defineEmits<{ registrarAto: []; anularAto: [ato: AtoNaLista]; marcarRetorno: [] }>()

const { t, locale } = useI18n()
const rotulos = useRotulosDoCadastro()

/* O texto ao responsável sai no idioma em que foi escrito: a primeira palavra marca o idioma. */
watch(
  () => [model.value.orientacoes, model.value.sinaisDeAlerta],
  ([orientacoes, sinais]) => {
    if (props.somenteLeitura || model.value.idiomaDasOrientacoes) return
    if ((orientacoes ?? '').trim() || (sinais ?? '').trim()) {
      model.value.idiomaDasOrientacoes = INTL_LOCALE[locale.value as Locale]
    }
  },
)

const opcoesDeTipo = computed(() =>
  props.tipos
    .filter((tipo) => tipo.ativo || tipo.id === model.value.retornoTipoId)
    .map((tipo) => ({ valor: tipo.id, rotulo: tipo.nome })),
)

/** Data do atendimento + dias, no calendário (o mesmo vencimento da lista de pendentes). */
const venceEm = computed(() => {
  const dias = model.value.retornoEmDias
  if (!dias) return null
  const [a, m, d] = props.dataDoAtendimento.split('-').map(Number)
  const data = new Date(Date.UTC(a!, (m ?? 1) - 1, (d ?? 1) + dias))
  return data.toISOString().slice(0, 10)
})

function rotuloDoAto(ato: AtoNaLista) {
  return [
    ato.via ? t(`clinico.bulario.api.via.${ato.via}`) : '',
    ato.doseTexto,
    ato.realizadoEm.slice(11, 16),
    ato.profissionalNome,
  ]
    .filter(Boolean)
    .join(' · ')
}
</script>

<template>
  <section class="ui-folha ui-cartao sa" aria-labelledby="sa-conduta">
    <header class="ui-cartao__cabeca">
      <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-list-checks" /></span>
      <span class="ui-cartao__titulos">
        <h2 id="sa-conduta" class="ui-cartao__titulo">{{ t('atendimento.secao.CONDUTA') }}</h2>
        <p class="ui-cartao__descricao">{{ t('atendimento.conduta.descricao') }}</p>
      </span>
    </header>

    <div class="sa__form">
      <p v-if="faltaConduta" class="sa__erro ct__falta" role="alert">
        <i class="ph ph-warning-circle" aria-hidden="true" />
        {{ t('atendimento.conduta.falta') }}
      </p>

      <!-- O que vai ao responsável. -->
      <section class="sa__grupo" aria-labelledby="sa-conduta-responsavel">
        <div class="sa__sobre">
          <h3 id="sa-conduta-responsavel" class="sa__titulo">
            {{ t('atendimento.conduta.paraOResponsavel') }}
          </h3>
          <p class="sa__descricao">{{ t('atendimento.conduta.paraOResponsavelDica') }}</p>
        </div>
        <div class="sa__campos">
          <div class="eg__secao">
            <label class="eg__rotulo" for="ct-orientacoes">{{
              t('atendimento.conduta.orientacoes')
            }}</label>
            <Textarea
              id="ct-orientacoes"
              v-model="model.orientacoes"
              rows="4"
              auto-resize
              :readonly="somenteLeitura"
            />
          </div>
          <div class="eg__secao">
            <label class="eg__rotulo" for="ct-alerta">
              {{ t('atendimento.conduta.sinaisDeAlerta') }}
              <span class="eg__opcional">{{ t('cadastro.opcional') }}</span>
            </label>
            <Textarea
              id="ct-alerta"
              v-model="model.sinaisDeAlerta"
              rows="2"
              auto-resize
              :placeholder="t('atendimento.conduta.sinaisDica')"
              :readonly="somenteLeitura"
            />
          </div>
        </div>
      </section>

      <!-- O retorno. -->
      <section class="sa__grupo" aria-labelledby="sa-conduta-retorno">
        <div class="sa__sobre">
          <h3 id="sa-conduta-retorno" class="sa__titulo">{{ t('atendimento.conduta.retorno') }}</h3>
          <p class="sa__descricao">{{ t('atendimento.conduta.retornoDica') }}</p>
        </div>
        <div class="sa__campos">
          <div class="sa__linha">
            <div class="eg__secao">
              <label class="eg__rotulo" for="ct-dias">{{ t('atendimento.conduta.emDias') }}</label>
              <InputNumber
                v-model="model.retornoEmDias"
                input-id="ct-dias"
                :min="1"
                :max="RETORNO_DIAS_MAX"
                :suffix="` ${t('atendimento.conduta.dias')}`"
                :placeholder="t('atendimento.conduta.semRetorno')"
                :readonly="somenteLeitura"
              />
              <small v-if="venceEm" class="eg__dica">{{
                t('atendimento.conduta.vence', { dia: rotulos.dia(venceEm) })
              }}</small>
            </div>
            <div class="eg__secao">
              <label class="eg__rotulo" for="ct-tipo">
                {{ t('atendimento.conduta.tipoDoRetorno') }}
                <span class="eg__opcional">{{ t('cadastro.opcional') }}</span>
              </label>
              <Select
                v-model="model.retornoTipoId"
                input-id="ct-tipo"
                :options="opcoesDeTipo"
                option-label="rotulo"
                option-value="valor"
                show-clear
                :placeholder="t('atendimento.conduta.recepcaoEscolhe')"
                :disabled="somenteLeitura || !model.retornoEmDias"
              />
            </div>
          </div>

          <p v-if="retornoAgendamentoId" class="sa__sugestao">
            <i class="ph ph-calendar-check" aria-hidden="true" />
            <span>{{ t('atendimento.conduta.retornoMarcado') }}</span>
            <RouterLink :to="{ path: '/clinica/agenda', query: { horario: retornoAgendamentoId } }">
              {{ t('atendimento.conduta.abrirHorario') }}
            </RouterLink>
          </p>
          <div v-else-if="retornoGravado && podeMarcarRetorno" class="ct__marcar">
            <Button
              type="button"
              size="small"
              severity="secondary"
              outlined
              icon="ph ph-calendar-plus"
              :label="t('atendimento.conduta.marcarAgora')"
              :loading="marcandoRetorno"
              @click="emit('marcarRetorno')"
            />
            <small class="eg__dica">{{ t('atendimento.conduta.marcarDica') }}</small>
          </div>
        </div>
      </section>

      <!-- Só na clínica. -->
      <section class="sa__grupo" aria-labelledby="sa-conduta-interna">
        <div class="sa__sobre">
          <h3 id="sa-conduta-interna" class="sa__titulo">
            {{ t('atendimento.conduta.soNaClinica') }}
          </h3>
          <p class="sa__descricao">{{ t('atendimento.conduta.soNaClinicaDica') }}</p>
        </div>
        <div class="sa__campos">
          <Textarea
            v-model="model.observacaoInterna"
            rows="2"
            auto-resize
            :aria-label="t('atendimento.conduta.observacaoInterna')"
            :readonly="somenteLeitura"
          />
        </div>
      </section>

      <!-- Os atos da consulta. -->
      <section class="sa__grupo" aria-labelledby="sa-conduta-atos">
        <div class="sa__sobre">
          <h3 id="sa-conduta-atos" class="sa__titulo">{{ t('atendimento.atos.titulo') }}</h3>
          <p class="sa__descricao">{{ t('atendimento.atos.dica') }}</p>
        </div>
        <div class="sa__campos">
          <ul v-if="atos.itens.length" class="sa__lista ct__atos">
            <li
              v-for="ato in atos.itens"
              :key="ato.id"
              class="ct__ato"
              :class="{ 'ct__ato--anulado': ato.anuladoEm }"
            >
              <i
                :class="ato.kind === 'MEDICAMENTO' ? 'ph ph-pill' : 'ph ph-bandaids'"
                class="ct__ato-icone"
                aria-hidden="true"
              />
              <span class="ct__ato-texto">
                <strong>{{ ato.descricao }}</strong>
                <small>{{ rotuloDoAto(ato) }}</small>
              </span>
              <span v-if="ato.anuladoEm" class="ui-selo">{{ t('atendimento.atos.anulado') }}</span>
              <Button
                v-else-if="podeAnularAto"
                type="button"
                size="small"
                severity="secondary"
                outlined
                :label="t('atendimento.atos.anular')"
                @click="emit('anularAto', ato)"
              />
            </li>
          </ul>
          <p v-else class="sa__vazio">{{ t('atendimento.atos.nenhum') }}</p>
          <small v-if="atos.total > atos.itens.length" class="eg__dica">{{
            t('atendimento.atos.mais', { n: atos.total - atos.itens.length })
          }}</small>
          <Button
            v-if="podeRegistrarAto"
            type="button"
            size="small"
            severity="secondary"
            outlined
            icon="ph ph-plus"
            class="ct__registrar"
            :label="t('atendimento.atos.registrar')"
            @click="emit('registrarAto')"
          />
        </div>
      </section>
    </div>
  </section>
</template>

<style scoped>
.ct__falta {
  padding-top: 16px;
}

.ct__marcar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
}

.ct__ato {
  display: flex;
  align-items: center;
  gap: 10px;
}

.ct__ato-icone {
  flex: none;
  color: var(--tinta-2);
  font-size: 18px;
}

.ct__ato-texto {
  display: grid;
  min-width: 0;
  flex: 1 1 auto;
  gap: 2px;
}

.ct__ato-texto small {
  color: var(--tinta-2);
  font-size: 12.5px;
}

.ct__ato--anulado .ct__ato-texto {
  text-decoration: line-through;
}

.ct__registrar {
  justify-self: start;
}

.sa__sugestao a {
  color: var(--tinta);
}
</style>
