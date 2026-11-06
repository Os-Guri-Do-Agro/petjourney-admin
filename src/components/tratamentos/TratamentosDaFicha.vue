<script setup lang="ts">
/**
 * Os tratamentos em casa na ficha do paciente (E4-05b, PJ-LU09N7; guia e4 7b.2 a 7b.5): o remédio
 * que saiu da clínica, dose a dose, pelo que a casa registra no app. Ao vivo (a rota mais cara:
 * lê uma vez ao abrir a ficha, sem recarregar a cada foco).
 *
 * Um remédio por faixa, em curso primeiro; os encerrados recolhidos. Cada um com a posologia, a
 * faixa e as contagens desde a última consulta (nunca porcentagem), os motivos que a casa deu, o
 * horário que quase ninguém registra e, no crítico, o alerta da equipe com o "Registrar contato".
 * O crítico se marca aqui também (`prontuario.escrever`). O que o responsável não compartilha diz
 * só isso.
 */
import Button from 'primevue/button'
import ToggleSwitch from 'primevue/toggleswitch'
import { useToast } from 'primevue/usetoast'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useRotulosDoCadastro } from '@/components/cadastro/useRotulosDoCadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { invalidarPendenciasDoPortal } from '@/composables/usePendenciasDoPortal'
import LegendaDaFaixa from '@/features/clinico/components/tratamento/LegendaDaFaixa.vue'
import {
  lerAdesaoDoPaciente,
  lerDoses,
  marcarCritico,
  type Tratamento,
} from '@/service/parceiro/adesao-service'

import ContatoGaveta from './ContatoGaveta.vue'
import FaixaDaAdesao from './FaixaDaAdesao.vue'
import { useFrasesDaAdesao } from './useFrasesDaAdesao'

const props = defineProps<{ pacienteId: string }>()

const { t } = useI18n()
const toast = useToast()
const rotulos = useRotulosDoCadastro()
const frases = useFrasesDaAdesao()
const { store, parceiroQuery } = useParceiroPortal()

const podeMarcarCritico = computed(
  () => Boolean(store.modulo('CLINICA')?.podeEscrever) && store.temPermissao('prontuario.escrever'),
)

const itens = ref<Tratamento[]>([])
const truncado = ref(false)
const carregando = ref(false)
const lido = ref(false)
const erro = ref('')

async function carregar() {
  carregando.value = true
  erro.value = ''
  try {
    const adesao = await lerAdesaoDoPaciente(props.pacienteId, parceiroQuery())
    itens.value = adesao.itens
    truncado.value = adesao.truncado
    lido.value = true
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('adesao.erro')).mensagem
  } finally {
    carregando.value = false
  }
}

onMounted(carregar)
watch(
  () => props.pacienteId,
  () => void carregar(),
)

const emCurso = computed(() => itens.value.filter((item) => item.situacao !== 'ENCERRADO'))
const encerrados = computed(() => itens.value.filter((item) => item.situacao === 'ENCERRADO'))
const verEncerrados = ref(false)
const comAlerta = computed(() => emCurso.value.filter((item) => item.alerta).length)

/** A janela de 72 h vem como objeto de contagens no contrato (sem tipo): lê só as puladas. */
function fraseDoAlerta(item: Tratamento) {
  if (!item.alerta) return ''
  const janela = item.alerta.janela as unknown as { puladas?: number }
  return frases.alerta(item.alerta.motivo, Number(janela.puladas) || undefined)
}

function rotuloDaFaixa(item: Tratamento) {
  return item.resumo ? `${item.medicamento}: ${frases.contagens(item.resumo)}` : item.medicamento
}

/* ------------------------------------------------------------------------------ crítico */

const alternando = ref<string | null>(null)

async function alternarCritico(item: Tratamento, critico: boolean) {
  alternando.value = item.tratamentoId
  try {
    await marcarCritico(item.tratamentoId, critico, parceiroQuery())
    invalidarPendenciasDoPortal()
    await carregar()
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: lerErroDoCadastro(err, t('adesao.erroCritico')).mensagem,
      life: 6000,
    })
  } finally {
    alternando.value = null
  }
}

/* ------------------------------------------------------------------------- faixa maior */

const ampliando = ref<string | null>(null)

/** O período padrão da rota de doses: 42 dias até hoje, no lugar da faixa desde a consulta. */
async function verMaisDias(item: Tratamento) {
  ampliando.value = item.tratamentoId
  try {
    const doses = await lerDoses(item.tratamentoId, {}, parceiroQuery())
    itens.value = itens.value.map((atual) =>
      atual.tratamentoId === item.tratamentoId
        ? { ...atual, faixa: doses.faixa, resumo: doses.resumo }
        : atual,
    )
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: lerErroDoCadastro(err, t('adesao.erro')).mensagem,
      life: 6000,
    })
  } finally {
    ampliando.value = null
  }
}

/* ----------------------------------------------------------------------------- contato */

const contatoAberto = ref(false)
const paraContato = ref<Tratamento | null>(null)

function abrirContato(item: Tratamento) {
  paraContato.value = item
  contatoAberto.value = true
}

function contatoRegistrado() {
  toast.add({ severity: 'success', summary: t('adesao.contato.feito'), life: 3000 })
  invalidarPendenciasDoPortal()
  void carregar()
}
</script>

<template>
  <section class="ui-folha ui-cartao td" aria-labelledby="td-titulo" :aria-busy="carregando">
    <header class="ui-cartao__cabeca">
      <span
        class="ui-ladrilho"
        :class="{ 'ui-ladrilho--atencao': comAlerta > 0 }"
        aria-hidden="true"
      >
        <i class="ph ph-calendar-check" />
      </span>
      <span class="ui-cartao__titulos">
        <h2 id="td-titulo" class="ui-cartao__titulo">{{ t('clinico.adesao.titulo') }}</h2>
        <p class="ui-cartao__descricao">
          {{
            comAlerta
              ? t('adesao.ficha.comAlerta', { n: comAlerta }, comAlerta)
              : t('clinico.adesao.subtitulo')
          }}
        </p>
      </span>
    </header>

    <p v-if="erro" class="td__nota td__erro" role="alert">{{ erro }}</p>
    <p v-else-if="lido && !itens.length" class="td__nota">
      {{ t('clinico.adesao.ficha.vazioDescricao') }}
    </p>

    <ul v-if="emCurso.length" class="ui-lista">
      <li v-for="item in emCurso" :key="item.tratamentoId" class="td__item">
        <div class="td__cabeca">
          <span class="td__nome">
            <strong>{{ item.medicamento }}</strong>
            <span v-if="item.critico" class="ui-selo ui-selo--atencao">{{
              t('clinico.adesao.critico.selo')
            }}</span>
            <span v-if="item.alerta" class="ui-selo ui-selo--atencao">
              <i class="ph ph-warning" aria-hidden="true" />
              {{ t('adesao.pedeAtencao') }}
            </span>
          </span>
          <label
            v-if="podeMarcarCritico && item.situacao === 'ACOMPANHANDO'"
            class="td__critico"
            :for="`td-critico-${item.tratamentoId}`"
          >
            <ToggleSwitch
              :model-value="item.critico"
              :input-id="`td-critico-${item.tratamentoId}`"
              :disabled="alternando === item.tratamentoId"
              @update:model-value="alternarCritico(item, Boolean($event))"
            />
            <span>{{ t('clinico.adesao.critico.alternar') }}</span>
          </label>
        </div>
        <span class="td__meta">{{ frases.posologia(item) }}</span>

        <p v-if="item.situacao === 'NAO_COMPARTILHADO'" class="td__meta">
          <i class="ph ph-eye-slash" aria-hidden="true" />
          {{ t('adesao.naoCompartilhado') }}
        </p>

        <template v-else>
          <!-- O alerta da equipe: o que aconteceu, nunca "não deu o remédio". -->
          <div v-if="item.alerta" class="td__alerta" role="status">
            <i class="ph ph-warning" aria-hidden="true" />
            <span>
              <strong>{{ fraseDoAlerta(item) }}</strong>
              <small v-if="item.alerta.motivos.length">{{
                frases.motivos(item.alerta.motivos)
              }}</small>
            </span>
            <Button
              type="button"
              size="small"
              severity="secondary"
              outlined
              icon="ph ph-phone-call"
              :label="t('clinico.adesao.alerta.registrarContato')"
              @click="abrirContato(item)"
            />
          </div>

          <FaixaDaAdesao v-if="item.faixa" :faixa="item.faixa" :rotulo="rotuloDaFaixa(item)" />

          <p v-if="item.resumo" class="td__meta">
            {{ frases.contagens(item.resumo) }}
            <template v-if="item.resumo.motivos.length && !item.alerta">
              · {{ frases.motivos(item.resumo.motivos) }}
            </template>
          </p>
          <p v-if="item.horarioQueDestoa" class="td__meta">
            {{
              t('adesao.horarioQueDestoa', {
                horario: item.horarioQueDestoa.horario,
                dadas: item.horarioQueDestoa.dadas,
                fechadas: item.horarioQueDestoa.fechadas,
              })
            }}
          </p>
          <p v-if="item.contato" class="td__meta td__contato">
            <i class="ph ph-phone" aria-hidden="true" />
            <span>{{
              t('adesao.contato.ultimo', {
                data: rotulos.data(item.contato.em),
                nota: item.contato.nota,
              })
            }}</span>
          </p>

          <div class="td__acoes">
            <Button
              v-if="item.faixa"
              type="button"
              size="small"
              severity="secondary"
              outlined
              :label="t('adesao.verMaisDias')"
              :loading="ampliando === item.tratamentoId"
              @click="verMaisDias(item)"
            />
            <Button
              v-if="!item.alerta && item.situacao === 'ACOMPANHANDO'"
              type="button"
              size="small"
              severity="secondary"
              outlined
              icon="ph ph-phone-call"
              :label="t('clinico.adesao.alerta.registrarContato')"
              @click="abrirContato(item)"
            />
          </div>
        </template>
      </li>
    </ul>

    <LegendaDaFaixa v-if="emCurso.some((item) => item.faixa)" class="td__legenda" />

    <div v-if="encerrados.length" class="td__encerrados">
      <Button
        type="button"
        size="small"
        severity="secondary"
        outlined
        :icon="verEncerrados ? 'ph ph-caret-up' : 'ph ph-caret-down'"
        :label="t('adesao.encerrados', { n: encerrados.length })"
        :aria-expanded="verEncerrados"
        @click="verEncerrados = !verEncerrados"
      />
      <ul v-if="verEncerrados" class="ui-lista">
        <li v-for="item in encerrados" :key="item.tratamentoId" class="ui-linha">
          <span class="ui-linha__texto">
            <strong class="ui-linha__titulo">{{ item.medicamento }}</strong>
            <span class="ui-linha__meta">
              {{
                [
                  frases.posologia(item),
                  item.encerradoEm
                    ? t('adesao.encerradoEm', { data: rotulos.data(item.encerradoEm) })
                    : '',
                  item.resumo ? frases.contagens(item.resumo) : '',
                ]
                  .filter(Boolean)
                  .join(' · ')
              }}
            </span>
          </span>
        </li>
      </ul>
    </div>

    <p v-if="truncado" class="td__nota">{{ t('adesao.truncado') }}</p>

    <ContatoGaveta
      v-model:visible="contatoAberto"
      :tratamento="paraContato"
      @registrado="contatoRegistrado"
    />
  </section>
</template>

<style scoped>
.td__nota {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  padding: 14px 24px;
  color: var(--tinta-2);
  font-size: 13.5px;
}

.td__erro {
  color: var(--risco-tinta);
}

.td__item {
  display: grid;
  gap: 8px;
  padding: 16px 24px;
}

.td__cabeca {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 16px;
}

.td__nome {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  color: var(--tinta);
  font-size: 14.5px;
}

.td__critico {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--tinta-2);
  font-size: 13px;
  cursor: pointer;
}

.td__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 6px;
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
}

.td__contato {
  flex-wrap: nowrap;
  align-items: flex-start;
}

.td__contato i {
  margin-top: 3px;
}

.td__alerta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  color: var(--tinta);
  font-size: 13.5px;
}

.td__alerta > i {
  color: var(--atencao-tinta);
  font-size: 18px;
}

.td__alerta > span {
  display: grid;
  flex: 1 1 14rem;
  gap: 2px;
}

.td__alerta small {
  color: var(--tinta-2);
  font-size: 13px;
}

.td__acoes {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.td__legenda {
  padding: 0 24px 16px;
}

.td__encerrados {
  display: grid;
  gap: 8px;
  padding: 0 24px 16px;
  justify-items: start;
}

.td__encerrados .ui-lista {
  justify-self: stretch;
}
</style>
