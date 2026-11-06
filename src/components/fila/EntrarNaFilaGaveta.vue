<script setup lang="ts">
/**
 * Pôr um paciente na fila de espera (E3-04, seção 5.3): quem, o serviço, com quem (ou qualquer
 * um), a prioridade e as janelas em que pode vir (dia da semana, das, às). A observação é interna:
 * nunca vai ao app.
 *
 * Uma entrada viva por paciente e serviço: o 409 `FILA_JA_NA_FILA` diz isso no campo do paciente.
 */
import AutoComplete from 'primevue/autocomplete'
import Button from 'primevue/button'
import InputMask from 'primevue/inputmask'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import Textarea from 'primevue/textarea'
import { useToast } from 'primevue/usetoast'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { nomeDoDia } from '@/components/fila/leitura-da-fila'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { INTL_LOCALE, type Locale } from '@/i18n/locales'
import { ApiError } from '@/service/api'
import { criarChaveadorDeIdempotencia } from '@/service/idempotencia'
import type { TipoDeAtendimento } from '@/service/parceiro/agenda-config-service'
import {
  entrarNaFila,
  JANELAS_MAX,
  PRIORIDADES,
  problemaNasJanelas,
  TEXTO_MAX,
  type JanelaDaFila,
  type PrioridadeDaFila,
} from '@/service/parceiro/fila-service'
import { listarPacientes, type PacienteNaLista } from '@/service/parceiro/pacientes-service'
import type { Profissional } from '@/service/parceiro/profissionais-service'

const props = defineProps<{
  tipos: TipoDeAtendimento[]
  profissionais: Profissional[]
  /**
   * O paciente já escolhido (o retorno sem horário, E4-01): a gaveta não pede a busca e já vem com
   * o serviço e com quem.
   */
  paraQuem?: {
    pacienteId: string
    nome: string
    tipoId?: string | null
    profissionalId?: string | null
  } | null
}>()
const emit = defineEmits<{ entrou: [] }>()
const visible = defineModel<boolean>('visible', { default: false })

/* O Select do PrimeVue lê `null` como "nada escolhido": "qualquer um" precisa de um valor. */
const QUALQUER = 'qualquer'
/** Segunda a domingo, como a casa lê a semana. */
const DIAS = [1, 2, 3, 4, 5, 6, 0] as const

const { t, locale } = useI18n()
const toast = useToast()
const { parceiroQuery } = useParceiroPortal()
const chaveador = criarChaveadorDeIdempotencia()

const intl = computed(() => INTL_LOCALE[locale.value as Locale])

type JanelaEditavel = { id: number; diaSemana: number; inicio: string; fim: string }

const paciente = ref<PacienteNaLista | null>(null)
const sugestoes = ref<PacienteNaLista[]>([])
const tipoId = ref<string | null>(null)
const profissionalId = ref<string>(QUALQUER)
const prioridade = ref<PrioridadeDaFila>('NORMAL')
const janelas = ref<JanelaEditavel[]>([])
const observacao = ref('')
const tentou = ref(false)
const salvando = ref(false)
const erroDoPaciente = ref('')
let proximoId = 0

function novaJanela(diaSemana = 1): JanelaEditavel {
  return { id: proximoId++, diaSemana, inicio: '08:00', fim: '12:00' }
}

watch(visible, (aberta) => {
  if (!aberta) return

  paciente.value = null
  const tipoDoRetorno = props.tipos.find((tipo) => tipo.id === props.paraQuem?.tipoId)
  const quemAtendeu = props.profissionais.find((p) => p.id === props.paraQuem?.profissionalId)
  tipoId.value = tipoDoRetorno?.id ?? props.tipos[0]?.id ?? null
  profissionalId.value = quemAtendeu?.id ?? QUALQUER
  prioridade.value = 'NORMAL'
  janelas.value = [novaJanela(1)]
  observacao.value = ''
  tentou.value = false
  erroDoPaciente.value = ''
})

async function buscar(evento: { query: string }) {
  try {
    const pagina = await listarPacientes({ q: evento.query, limit: 10 }, parceiroQuery())
    sugestoes.value = pagina.itens
  } catch {
    sugestoes.value = []
  }
}

const opcoesDeTipo = computed(() =>
  props.tipos.map((tipo) => ({ valor: tipo.id, rotulo: tipo.nome })),
)
const opcoesDeProfissional = computed(() => [
  { valor: QUALQUER, rotulo: t('clinico.fila.qualquerProfissional') },
  ...props.profissionais.map((item) => ({ valor: item.id, rotulo: item.nome })),
])
const opcoesDePrioridade = computed(() =>
  PRIORIDADES.map((valor) => ({
    valor,
    rotulo: t(`clinico.fila.prioridade.${valor.toLowerCase()}`),
  })),
)
const opcoesDeDia = computed(() =>
  DIAS.map((valor) => ({ valor, rotulo: nomeDoDia(valor, intl.value, 'long') })),
)

const problema = computed(() =>
  problemaNasJanelas(
    janelas.value.map(({ diaSemana, inicio, fim }) => ({ diaSemana, inicio, fim })),
  ),
)

function adicionarJanela() {
  const ultima = janelas.value[janelas.value.length - 1]
  const proximoDia = ultima
    ? DIAS[(DIAS.indexOf(ultima.diaSemana as (typeof DIAS)[number]) + 1) % 7]
    : 1
  const janela = novaJanela(proximoDia)
  if (ultima) {
    janela.inicio = ultima.inicio
    janela.fim = ultima.fim
  }
  janelas.value = [...janelas.value, janela]
}

function removerJanela(id: number) {
  janelas.value = janelas.value.filter((janela) => janela.id !== id)
}

async function salvar() {
  tentou.value = true
  erroDoPaciente.value = ''
  const pacienteId = props.paraQuem?.pacienteId ?? paciente.value?.id
  if (!pacienteId || !tipoId.value || problema.value) return

  salvando.value = true
  const corpo = {
    pacienteId,
    tipoId: tipoId.value,
    profissionalId: profissionalId.value === QUALQUER ? undefined : profissionalId.value,
    prioridade: prioridade.value,
    janelas: janelas.value.map(
      ({ diaSemana, inicio, fim }): JanelaDaFila => ({ diaSemana, inicio, fim }),
    ),
    observacao: observacao.value.trim() || undefined,
  }

  try {
    await entrarNaFila(corpo, chaveador.para(corpo), parceiroQuery())
    chaveador.concluir()
    toast.add({ severity: 'success', summary: t('fila.entrou'), life: 3000 })
    emit('entrou')
    visible.value = false
  } catch (err) {
    const lido = lerErroDoCadastro(err, t('cadastro.erros.salvar'))
    const detalhes = err instanceof ApiError ? (err.detalhes ?? {}) : {}

    if (lido.codigo === 'FILA_JA_NA_FILA') {
      erroDoPaciente.value = t('fila.jaNaFila')
    } else if (lido.codigo === 'FILA_NO_LIMITE') {
      erroDoPaciente.value =
        detalhes.escopo === 'CLINICA' ? t('fila.limiteClinica') : t('fila.limitePaciente')
    } else {
      toast.add({ severity: 'error', summary: lido.mensagem, life: 6000 })
    }
  } finally {
    salvando.value = false
  }
}

function rotuloDoPaciente(item: PacienteNaLista) {
  return `${item.nome} · ${item.cliente.nome}`
}
</script>

<template>
  <CadastroGaveta
    v-model:visible="visible"
    :titulo="t('clinico.fila.adicionar')"
    icone="ph ph-hourglass-medium"
    largura="34rem"
  >
    <form id="fila-form" class="eg" novalidate @submit.prevent="salvar">
      <section class="eg__secao">
        <span v-if="paraQuem" class="eg__rotulo">{{ t('fila.paciente') }}</span>
        <label v-else class="eg__rotulo" for="fila-paciente">{{ t('fila.paciente') }}</label>
        <strong v-if="paraQuem" class="fe__fixo">{{ paraQuem.nome }}</strong>
        <AutoComplete
          v-else
          v-model="paciente"
          input-id="fila-paciente"
          :suggestions="sugestoes"
          :option-label="rotuloDoPaciente"
          :placeholder="t('fila.buscarPaciente')"
          :invalid="(tentou && !paciente) || Boolean(erroDoPaciente)"
          :disabled="salvando"
          force-selection
          @complete="buscar"
        />
        <small v-if="erroDoPaciente" class="eg__invalido">{{ erroDoPaciente }}</small>
        <small v-else-if="tentou && !paciente && !paraQuem" class="eg__invalido">{{
          t('fila.pacienteObrigatorio')
        }}</small>
      </section>

      <div class="eg__linha">
        <section class="eg__secao">
          <label class="eg__rotulo" for="fila-tipo">{{ t('fila.servico') }}</label>
          <Select
            v-model="tipoId"
            input-id="fila-tipo"
            :options="opcoesDeTipo"
            option-label="rotulo"
            option-value="valor"
            :invalid="tentou && !tipoId"
            :disabled="salvando"
          />
        </section>
        <section class="eg__secao">
          <label class="eg__rotulo" for="fila-profissional">{{ t('fila.comQuem') }}</label>
          <Select
            v-model="profissionalId"
            input-id="fila-profissional"
            :options="opcoesDeProfissional"
            option-label="rotulo"
            option-value="valor"
            :disabled="salvando"
          />
        </section>
      </div>

      <section class="eg__secao">
        <span id="fila-prioridade" class="eg__rotulo">{{
          t('clinico.fila.prioridadeRotulo')
        }}</span>
        <SelectButton
          v-model="prioridade"
          :options="opcoesDePrioridade"
          option-label="rotulo"
          option-value="valor"
          :allow-empty="false"
          aria-labelledby="fila-prioridade"
          :disabled="salvando"
        />
      </section>

      <section class="eg__secao">
        <span class="eg__rotulo">{{ t('clinico.fila.janelas') }}</span>
        <small class="eg__dica">{{ t('fila.janelasDica') }}</small>
        <ul class="fe__janelas">
          <li v-for="janela in janelas" :key="janela.id" class="fe__janela">
            <Select
              v-model="janela.diaSemana"
              :options="opcoesDeDia"
              option-label="rotulo"
              option-value="valor"
              :aria-label="t('fila.dia')"
              :disabled="salvando"
            />
            <InputMask
              v-model="janela.inicio"
              mask="99:99"
              :auto-clear="false"
              :aria-label="t('fila.das')"
              :invalid="tentou && Boolean(problema)"
              :disabled="salvando"
            />
            <span aria-hidden="true">{{ t('fila.a') }}</span>
            <InputMask
              v-model="janela.fim"
              mask="99:99"
              :auto-clear="false"
              :aria-label="t('fila.ate')"
              :invalid="tentou && Boolean(problema)"
              :disabled="salvando"
            />
            <Button
              type="button"
              icon="ph ph-x"
              severity="secondary"
              outlined
              size="small"
              :aria-label="t('fila.tirarJanela')"
              :disabled="salvando || janelas.length === 1"
              @click="removerJanela(janela.id)"
            />
          </li>
        </ul>
        <small v-if="tentou && problema" class="eg__invalido">{{
          t(`fila.problema.${problema}`)
        }}</small>
        <Button
          v-if="janelas.length < JANELAS_MAX"
          type="button"
          icon="ph ph-plus"
          size="small"
          severity="secondary"
          outlined
          class="fe__mais"
          :label="t('fila.outraJanela')"
          :disabled="salvando"
          @click="adicionarJanela"
        />
      </section>

      <section class="eg__secao">
        <label class="eg__rotulo" for="fila-observacao">
          {{ t('fila.observacao') }}
          <span class="eg__opcional">{{ t('cadastro.opcional') }}</span>
        </label>
        <Textarea
          id="fila-observacao"
          v-model="observacao"
          rows="2"
          auto-resize
          :maxlength="TEXTO_MAX"
          :disabled="salvando"
        />
        <small class="eg__dica">{{ t('fila.observacaoDica') }}</small>
      </section>
    </form>

    <template #pe>
      <Button
        type="button"
        :label="t('cadastro.cancelar')"
        severity="secondary"
        outlined
        :disabled="salvando"
        @click="visible = false"
      />
      <Button
        type="submit"
        form="fila-form"
        icon="ph ph-check"
        :label="t('clinico.fila.adicionar')"
        :loading="salvando"
      />
    </template>
  </CadastroGaveta>
</template>

<style scoped>
.fe__fixo {
  font-size: 15px;
}

.fe__janelas {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.fe__janela {
  display: grid;
  grid-template-columns: minmax(8rem, 1fr) 5rem auto 5rem auto;
  align-items: center;
  gap: 8px;
  color: var(--tinta-2);
  font-size: 13px;
}

.fe__janela :deep(.p-inputtext) {
  width: 100%;
  font-variant-numeric: tabular-nums;
}

.fe__mais {
  justify-self: start;
}
</style>
