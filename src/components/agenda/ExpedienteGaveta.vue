<script setup lang="ts">
/**
 * O expediente de um profissional (E3-01, seção 1.4), na gaveta ao lado da lista de Profissionais:
 * a semana dia a dia, cada um "como a clínica", "próprio" ou "folga", e a sala que a agenda propõe
 * para ele.
 *
 * O expediente é exceção ao horário da clínica (E1-01): só os dias que mudam vão para a API. Feriado
 * e dia especial da clínica valem por cima. Almoço próprio não mora aqui: é um bloqueio semanal.
 * Ler é `agenda.ler`; salvar, `estabelecimento.editar` com a Clínica ligada para escrita.
 */
import Button from 'primevue/button'
import InputMask from 'primevue/inputmask'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import Skeleton from 'primevue/skeleton'
import { useToast } from 'primevue/usetoast'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import {
  diasParaSalvar,
  linhasDoExpediente,
  problemaNaLinha,
  type LinhaDoExpediente,
  type ModoDoDia,
} from '@/components/agenda/expediente'
import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { dataCivil } from '@/components/parceiro/estabelecimento/horario'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { INTL_LOCALE, type Locale } from '@/i18n/locales'
import { ApiError } from '@/service/api'
import {
  listarSalas,
  obterExpediente,
  salvarExpediente,
  type Expediente,
  type Sala,
} from '@/service/parceiro/agenda-config-service'
import { criarUltimaLeitura } from '@/utils/ultima-leitura'

const props = defineProps<{
  profissional: { id: string; nome: string } | null
  podeEditar: boolean
}>()

const visible = defineModel<boolean>('visible', { default: false })

/* O Select do PrimeVue lê `null` como "nada escolhido": "sem sala" precisa de um valor de verdade. */
const SEM_SALA = 'sem-sala'
/** Um domingo qualquer, para o nome do dia sair do `Intl` no idioma da sessão. */
const UM_DOMINGO = '2026-10-18'

const { t, locale } = useI18n()
const toast = useToast()
const router = useRouter()
const { parceiroQuery } = useParceiroPortal()

const expediente = ref<Expediente | null>(null)
const salas = ref<Sala[]>([])
const linhas = ref<LinhaDoExpediente[]>([])
const sala = ref<string>(SEM_SALA)
const carregando = ref(false)
const erro = ref('')
const salvando = ref(false)
const tentou = ref(false)
const erroDaSala = ref('')
/** O dia que a API recusou (`EXPEDIENTE_INVALIDO`), com o problema que ela apontou. */
const recusado = ref<{ diaSemana: number; texto: string } | null>(null)

function aplicar(atual: Expediente) {
  expediente.value = atual
  linhas.value = linhasDoExpediente(atual)
  sala.value = atual.salaPadraoId ?? SEM_SALA
}

/* Abrir a gaveta de outro profissional antes de a leitura chegar: a do anterior não vale. */
const leitura = criarUltimaLeitura()

async function carregar() {
  if (!props.profissional) return

  const vez = leitura.nova()
  carregando.value = true
  erro.value = ''

  try {
    const [atual, ativas] = await Promise.all([
      obterExpediente(props.profissional.id, parceiroQuery()),
      listarSalas({ ...parceiroQuery(), ativas: true }),
    ])
    if (!leitura.valendo(vez)) return
    salas.value = ativas
    aplicar(atual)
  } catch (err) {
    if (!leitura.valendo(vez)) return
    erro.value = lerErroDoCadastro(err, t('agenda.config.erroAoCarregar')).mensagem
  } finally {
    if (leitura.valendo(vez)) carregando.value = false
  }
}

watch(visible, (aberta) => {
  if (!aberta) return

  expediente.value = null
  tentou.value = false
  erroDaSala.value = ''
  recusado.value = null
  void carregar()
})

/* ------------------------------------------------------------------------------- os dias */

function nomeDoDia(diaSemana: number) {
  const data = dataCivil(UM_DOMINGO)
  data.setUTCDate(data.getUTCDate() + diaSemana)

  const nome = data.toLocaleDateString(INTL_LOCALE[locale.value as Locale], {
    weekday: 'long',
    timeZone: 'UTC',
  })

  return nome.charAt(0).toLocaleUpperCase() + nome.slice(1)
}

const modos = computed(() =>
  (['clinica', 'proprio', 'folga'] as const).map((valor) => ({
    valor,
    rotulo: t(`agenda.config.expediente.modo.${valor}`),
  })),
)

/** Passar a "próprio" parte do horário da clínica naquele dia, quando se sabe. */
function trocarModo(linha: LinhaDoExpediente, modo: ModoDoDia) {
  linha.modo = modo
  recusado.value = recusado.value?.diaSemana === linha.diaSemana ? null : recusado.value

  if (modo === 'proprio' && (!linha.inicio || !linha.fim)) {
    linha.inicio = linha.clinica?.trabalha && linha.clinica.inicio ? linha.clinica.inicio : '08:00'
    linha.fim = linha.clinica?.trabalha && linha.clinica.fim ? linha.clinica.fim : '18:00'
  }
}

function comoAClinica(linha: LinhaDoExpediente) {
  const clinica = linha.clinica

  if (!clinica || expediente.value?.estabelecimentoSemHorario) {
    return t('agenda.config.expediente.segueAClinica')
  }
  if (!clinica.trabalha || !clinica.inicio || !clinica.fim) {
    return t('agenda.config.expediente.clinicaFecha')
  }
  if (clinica.intervaloInicio && clinica.intervaloFim) {
    return t('agenda.config.expediente.horarioComIntervalo', {
      inicio: clinica.inicio,
      fim: clinica.fim,
      intervaloInicio: clinica.intervaloInicio,
      intervaloFim: clinica.intervaloFim,
    })
  }

  return t('agenda.config.expediente.horario', { inicio: clinica.inicio, fim: clinica.fim })
}

function problemaDe(linha: LinhaDoExpediente) {
  if (recusado.value?.diaSemana === linha.diaSemana) return recusado.value.texto
  if (!tentou.value) return ''

  const problema = problemaNaLinha(linha)
  return problema ? t(`parceiro.estabelecimento.horario.problema.${problema}`) : ''
}

const temProblema = computed(() => linhas.value.some((linha) => problemaNaLinha(linha) !== null))

/* ------------------------------------------------------------------------------- a sala */

const opcoesDeSala = computed(() => [
  { valor: SEM_SALA, rotulo: t('agenda.config.expediente.semSala') },
  ...salas.value.map((item) => ({ valor: item.id, rotulo: item.nome })),
])

/* ------------------------------------------------------------------------------ salvar */

async function salvar() {
  tentou.value = true
  erroDaSala.value = ''
  recusado.value = null
  /* Salva no profissional cujo expediente está na tela (o lido), nunca no que a gaveta pediu depois. */
  const profissionalId = expediente.value?.profissionalId
  if (!profissionalId || temProblema.value) return

  salvando.value = true

  try {
    aplicar(
      await salvarExpediente(
        profissionalId,
        {
          dias: diasParaSalvar(linhas.value),
          salaPadraoId: sala.value === SEM_SALA ? null : sala.value,
        },
        parceiroQuery(),
      ),
    )
    toast.add({ severity: 'success', summary: t('agenda.config.expediente.salvo'), life: 3000 })
    visible.value = false
  } catch (err) {
    const lido = lerErroDoCadastro(err, t('cadastro.erros.salvar'))
    const detalhes = err instanceof ApiError ? (err.detalhes ?? {}) : {}

    if (lido.codigo === 'EXPEDIENTE_INVALIDO' && typeof detalhes.diaSemana === 'number') {
      const problema = typeof detalhes.problema === 'string' ? detalhes.problema : ''
      const conhecido = ['ABRE_E_FECHA_OBRIGATORIOS', 'HORA_INVALIDA', 'ABRE_DEPOIS_DE_FECHA']
      recusado.value = {
        diaSemana: detalhes.diaSemana,
        texto: conhecido.includes(problema)
          ? t(`parceiro.estabelecimento.horario.problema.${problema}`)
          : lido.mensagem,
      }
    } else if (lido.codigo === 'SALA_INATIVA') {
      erroDaSala.value = t('agenda.config.expediente.salaInativa')
    } else {
      toast.add({ severity: 'error', summary: lido.mensagem, life: 6000 })
    }
  } finally {
    salvando.value = false
  }
}

function irAoEstabelecimento() {
  visible.value = false
  void router.push('/parceiro/estabelecimento')
}

const bloqueado = computed(() => !props.podeEditar || salvando.value)
</script>

<template>
  <CadastroGaveta
    v-model:visible="visible"
    :titulo="t('agenda.config.expediente.titulo', { nome: props.profissional?.nome ?? '' })"
    icone="ph ph-clock"
    largura="34rem"
  >
    <p v-if="erro" class="eg__erro" role="alert">
      <i class="ph ph-warning-circle" aria-hidden="true" />
      <span>{{ erro }}</span>
      <Button
        type="button"
        size="small"
        severity="secondary"
        outlined
        :label="t('cadastro.tentarDeNovo')"
        @click="carregar"
      />
    </p>

    <div v-if="carregando && !expediente" class="ex__esqueleto" aria-busy="true">
      <Skeleton v-for="n in 7" :key="n" height="2.5rem" />
    </div>

    <form
      v-else-if="expediente"
      id="expediente-form"
      class="eg"
      novalidate
      @submit.prevent="salvar"
    >
      <p v-if="expediente.estabelecimentoSemHorario" class="ex__aviso" role="status">
        <i class="ph ph-calendar-blank" aria-hidden="true" />
        <span>{{ t('agenda.config.expediente.semHorario') }}</span>
        <Button
          type="button"
          size="small"
          severity="secondary"
          outlined
          :label="t('agenda.config.expediente.irAoEstabelecimento')"
          @click="irAoEstabelecimento"
        />
      </p>

      <section class="eg__secao">
        <label class="eg__rotulo" for="expediente-sala">{{
          t('agenda.config.expediente.sala')
        }}</label>
        <Select
          v-model="sala"
          input-id="expediente-sala"
          :options="opcoesDeSala"
          option-label="rotulo"
          option-value="valor"
          :invalid="Boolean(erroDaSala)"
          :disabled="bloqueado"
        />
        <small v-if="erroDaSala" class="eg__invalido">{{ erroDaSala }}</small>
        <small v-else-if="!salas.length" class="eg__dica">{{
          t('agenda.config.expediente.semSalas')
        }}</small>
        <small v-else class="eg__dica">{{ t('agenda.config.expediente.salaDica') }}</small>
      </section>

      <section class="eg__secao">
        <span class="eg__rotulo">{{ t('agenda.config.expediente.semana') }}</span>
        <small class="eg__dica">{{ t('agenda.config.expediente.descricao') }}</small>

        <ul class="ex__dias">
          <li
            v-for="linha in linhas"
            :key="linha.diaSemana"
            class="ex__dia"
            :class="{ 'ex__dia--erro': Boolean(problemaDe(linha)) }"
          >
            <span :id="`expediente-dia-${linha.diaSemana}`" class="ex__nome">
              {{ nomeDoDia(linha.diaSemana) }}
            </span>
            <SelectButton
              :model-value="linha.modo"
              :options="modos"
              option-label="rotulo"
              option-value="valor"
              :allow-empty="false"
              size="small"
              :aria-labelledby="`expediente-dia-${linha.diaSemana}`"
              :disabled="bloqueado"
              @update:model-value="(modo: ModoDoDia) => trocarModo(linha, modo)"
            />

            <span v-if="linha.modo === 'clinica'" class="ex__detalhe">
              {{ comoAClinica(linha) }}
            </span>
            <span v-else-if="linha.modo === 'folga'" class="ex__detalhe">
              {{ t('agenda.config.expediente.naoAtende') }}
            </span>
            <span v-else class="ex__horas">
              <label class="ex__hora">
                <span>{{ t('agenda.config.expediente.das') }}</span>
                <InputMask
                  v-model="linha.inicio"
                  mask="99:99"
                  :auto-clear="false"
                  :aria-label="
                    t('agenda.config.expediente.comecaEm', { dia: nomeDoDia(linha.diaSemana) })
                  "
                  :invalid="Boolean(problemaDe(linha))"
                  :disabled="bloqueado"
                />
              </label>
              <label class="ex__hora">
                <span>{{ t('agenda.config.expediente.as') }}</span>
                <InputMask
                  v-model="linha.fim"
                  mask="99:99"
                  :auto-clear="false"
                  :aria-label="
                    t('agenda.config.expediente.terminaEm', { dia: nomeDoDia(linha.diaSemana) })
                  "
                  :invalid="Boolean(problemaDe(linha))"
                  :disabled="bloqueado"
                />
              </label>
            </span>

            <small v-if="problemaDe(linha)" class="eg__invalido ex__problema">{{
              problemaDe(linha)
            }}</small>
          </li>
        </ul>
      </section>

      <p class="ex__nota">
        <i class="ph ph-info" aria-hidden="true" />
        <span>{{ t('agenda.config.expediente.notas') }}</span>
      </p>
    </form>

    <template #pe>
      <Button
        type="button"
        :label="props.podeEditar ? t('cadastro.cancelar') : t('agenda.config.expediente.fechar')"
        severity="secondary"
        outlined
        :disabled="salvando"
        @click="visible = false"
      />
      <Button
        v-if="props.podeEditar && expediente"
        type="submit"
        form="expediente-form"
        icon="ph ph-check"
        :label="t('cadastro.salvar')"
        :loading="salvando"
      />
    </template>
  </CadastroGaveta>
</template>

<style scoped>
.ex__esqueleto {
  display: grid;
  gap: 10px;
}

.ex__aviso {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 10px;
  margin: 0;
  color: var(--tinta-2);
  font-size: 13px;
}

.ex__aviso > span {
  flex: 1 1 14rem;
}

.ex__dias {
  display: grid;
  margin: 4px 0 0;
  padding: 0;
  list-style: none;
}

.ex__dia {
  display: grid;
  grid-template-columns: minmax(6.5rem, auto) 1fr;
  gap: 6px 12px;
  align-items: center;
  padding: 10px 0;
  border-top: 1px solid var(--linha-suave);
}

.ex__dia:first-child {
  border-top: 0;
}

.ex__nome {
  color: var(--tinta);
  font-size: 14px;
  font-weight: 600;
}

.ex__dia :deep(.p-selectbutton) {
  justify-self: end;
}

.ex__detalhe,
.ex__horas,
.ex__problema {
  grid-column: 1 / -1;
}

.ex__detalhe {
  color: var(--tinta-2);
  font-size: 13px;
}

.ex__horas {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
}

.ex__hora {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--tinta-2);
  font-size: 13px;
}

.ex__hora :deep(.p-inputmask),
.ex__hora :deep(.p-inputtext) {
  width: 5.5rem;
  font-variant-numeric: tabular-nums;
}

.ex__nota {
  display: flex;
  gap: 8px;
  margin: 0;
  color: var(--tinta-2);
  font-size: 13px;
}

.ex__nota i {
  margin-top: 2px;
}
</style>
