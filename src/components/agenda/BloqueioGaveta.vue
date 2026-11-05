<script setup lang="ts">
/**
 * Criar ou editar um bloqueio (E3-01, seção 1.5): o horário em que não se marca. É de um
 * profissional, de uma sala ou da clínica toda; único (inclusive férias de vários dias) ou toda
 * semana nos dias escolhidos, com ou sem fim.
 *
 * O horário vai em ISO com o offset do fuso da clínica (o `fuso` que a leitura devolve). Três modos:
 * - `novo`: o bloqueio todo;
 * - `serie`: a regra inteira (inclusive a repetição), vinda de `GET /bloqueios/:id`;
 * - `dia`: só aquele dia da série (`?somenteEm=`), sem campos de repetição: ele sai da série e
 *   volta como bloqueio único novo.
 */
import Button from 'primevue/button'
import DatePicker from 'primevue/datepicker'
import InputMask from 'primevue/inputmask'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import ToggleButton from 'primevue/togglebutton'
import ToggleSwitch from 'primevue/toggleswitch'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { criarChaveadorDeIdempotencia } from '@/service/idempotencia'
import {
  criarBloqueio,
  DETALHE_DO_BLOQUEIO_MAX,
  diaLocal,
  editarBloqueio,
  instanteNoFuso,
  MOTIVOS_DO_BLOQUEIO,
  type Bloqueio,
  type MotivoDoBloqueio,
  type OcorrenciaDeBloqueio,
  type Sala,
} from '@/service/parceiro/agenda-config-service'

export type ModoDaGaveta =
  | { tipo: 'novo' }
  | { tipo: 'serie'; bloqueio: Bloqueio }
  | { tipo: 'dia'; ocorrencia: OcorrenciaDeBloqueio }

const props = defineProps<{
  modo: ModoDaGaveta
  fuso: string
  salas: Sala[]
  profissionais: { id: string; nome: string }[]
}>()
const emit = defineEmits<{ salvo: [] }>()
const visible = defineModel<boolean>('visible', { default: false })

const { t } = useI18n()
const { parceiroQuery } = useParceiroPortal()
const chaveador = criarChaveadorDeIdempotencia()

type Alcance = 'clinica' | 'profissional' | 'sala'

const alcance = ref<Alcance>('clinica')
const profissionalId = ref<string | null>(null)
const salaId = ref<string | null>(null)
const motivo = ref<MotivoDoBloqueio>('ALMOCO')
const detalhe = ref('')
const dia = ref<Date>(new Date())
const diaFinal = ref<Date | null>(null)
const inicio = ref('12:00')
const fim = ref('13:00')
const semanal = ref(false)
const diasDaSemana = ref<number[]>([])
const repeteAte = ref<Date | null>(null)
const tentou = ref(false)
const erro = ref('')
const salvando = ref(false)

const opcoesDeAlcance = computed(() => [
  { valor: 'clinica', rotulo: t('agenda.config.bloqueio.alcance.clinica') },
  { valor: 'profissional', rotulo: t('agenda.config.bloqueio.alcance.profissional') },
  { valor: 'sala', rotulo: t('agenda.config.bloqueio.alcance.sala') },
])

const opcoesDeMotivo = computed(() =>
  MOTIVOS_DO_BLOQUEIO.map((valor) => ({
    valor,
    rotulo: t(`agenda.config.bloqueio.motivo.${valor}`),
  })),
)

const salasAtivas = computed(() => props.salas.filter((sala) => sala.ativa))

/** Domingo a sábado, na ordem da API (0 a 6). */
const DIAS = [0, 1, 2, 3, 4, 5, 6]

function dataDe(iso: string) {
  const [ano, mes, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(ano!, mes! - 1, d!)
}

watch(visible, (aberta) => {
  if (!aberta) return

  tentou.value = false
  erro.value = ''
  const modo = props.modo
  const base = modo.tipo === 'serie' ? modo.bloqueio : modo.tipo === 'dia' ? modo.ocorrencia : null

  profissionalId.value = base?.profissionalId ?? null
  salaId.value = base?.salaId ?? null
  alcance.value = base?.profissionalId ? 'profissional' : base?.salaId ? 'sala' : 'clinica'
  motivo.value = base?.motivo ?? 'ALMOCO'
  detalhe.value = base?.detalhe ?? ''
  dia.value = base ? dataDe(base.inicio) : new Date()
  const ultimoDia = base ? base.fim.slice(0, 10) : null
  diaFinal.value = base && ultimoDia !== base.inicio.slice(0, 10) ? dataDe(base.fim) : null
  inicio.value = base ? base.inicio.slice(11, 16) : '12:00'
  fim.value = base ? base.fim.slice(11, 16) : '13:00'
  semanal.value = modo.tipo === 'serie' ? modo.bloqueio.recorrente : false
  diasDaSemana.value = modo.tipo === 'serie' ? [...modo.bloqueio.diasDaSemana] : []
  repeteAte.value =
    modo.tipo === 'serie' && modo.bloqueio.repeteAte ? dataDe(modo.bloqueio.repeteAte) : null
})

/* Quem escolhe "semanal" a partir do dia: o dia da semana dele já vem marcado. */
watch(semanal, (ligado) => {
  if (ligado && !diasDaSemana.value.length) diasDaSemana.value = [dia.value.getDay()]
  if (ligado) diaFinal.value = null
})

function alternarDia(diaDaSemana: number, marcado: boolean) {
  diasDaSemana.value = marcado
    ? [...diasDaSemana.value, diaDaSemana].sort()
    : diasDaSemana.value.filter((item) => item !== diaDaSemana)
}

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/

const problema = computed(() => {
  if (!HORA.test(inicio.value) || !HORA.test(fim.value))
    return t('agenda.config.bloqueio.horaInvalida')
  if (alcance.value === 'profissional' && !profissionalId.value)
    return t('agenda.config.bloqueio.faltaProfissional')
  if (alcance.value === 'sala' && !salaId.value) return t('agenda.config.bloqueio.faltaSala')
  if (semanal.value && !diasDaSemana.value.length) return t('agenda.config.bloqueio.faltaDias')

  const primeiro = diaLocal(dia.value)
  if (`${diaDoFim()}T${fim.value}` <= `${primeiro}T${inicio.value}`)
    return t('agenda.config.bloqueio.fimAntes')

  return ''
})

/**
 * O dia em que a primeira ocorrência termina. Na série semanal, o fim antes do início vira o dia
 * seguinte (a ocorrência atravessa a meia-noite, até 24 h); no bloqueio único, o dia final escolhido.
 */
function diaDoFim() {
  const primeiro = diaLocal(dia.value)
  if (semanal.value) {
    if (fim.value > inicio.value) return primeiro
    const seguinte = new Date(dia.value)
    seguinte.setDate(seguinte.getDate() + 1)
    return diaLocal(seguinte)
  }

  return diaFinal.value ? diaLocal(diaFinal.value) : primeiro
}

const modoDia = computed(() => props.modo.tipo === 'dia')

async function salvar() {
  tentou.value = true
  erro.value = ''
  if (problema.value) return

  const primeiro = diaLocal(dia.value)
  const ultimo = diaDoFim()
  const comum = {
    profissionalId: alcance.value === 'profissional' ? profissionalId.value : null,
    salaId: alcance.value === 'sala' ? salaId.value : null,
    inicio: instanteNoFuso(props.fuso, primeiro, inicio.value),
    fim: instanteNoFuso(props.fuso, ultimo, fim.value),
    motivo: motivo.value,
    detalhe: detalhe.value.trim() || null,
  }
  const repeticao = {
    diasDaSemana: semanal.value ? diasDaSemana.value : [],
    repeteAte: semanal.value && repeteAte.value ? diaLocal(repeteAte.value) : null,
  }

  salvando.value = true

  try {
    const modo = props.modo

    if (modo.tipo === 'novo') {
      const corpo = semanal.value ? { ...comum, ...repeticao } : comum
      await criarBloqueio(corpo, chaveador.para(corpo), parceiroQuery())
      chaveador.concluir()
    } else if (modo.tipo === 'serie') {
      await editarBloqueio(modo.bloqueio.id, { ...comum, ...repeticao }, null, parceiroQuery())
    } else {
      await editarBloqueio(modo.ocorrencia.bloqueioId, comum, modo.ocorrencia.data, parceiroQuery())
    }

    emit('salvo')
    visible.value = false
  } catch (err) {
    const lido = lerErroDoCadastro(err, t('cadastro.erros.salvar'))
    const proprias: Record<string, string> = {
      SALA_INATIVA: t('agenda.config.bloqueio.erros.salaInativa'),
      BLOQUEIO_SERIES_NO_LIMITE: t('agenda.config.bloqueio.erros.series'),
    }
    erro.value = proprias[lido.codigo] ?? lido.mensagem
  } finally {
    salvando.value = false
  }
}

const titulo = computed(() =>
  props.modo.tipo === 'novo'
    ? t('agenda.config.bloqueio.novo')
    : props.modo.tipo === 'serie'
      ? t('agenda.config.bloqueio.editarSerie')
      : t('agenda.config.bloqueio.editarDia'),
)
</script>

<template>
  <CadastroGaveta v-model:visible="visible" :titulo="titulo" icone="ph ph-calendar-x">
    <form id="bloqueio-form" class="eg" novalidate @submit.prevent="salvar">
      <p v-if="modoDia" class="eg__dica">{{ t('agenda.config.bloqueio.soNesteDiaDica') }}</p>

      <section class="eg__secao">
        <span id="bloqueio-alcance" class="eg__rotulo">{{ t('agenda.config.bloqueio.quem') }}</span>
        <SelectButton
          v-model="alcance"
          :options="opcoesDeAlcance"
          option-label="rotulo"
          option-value="valor"
          :allow-empty="false"
          aria-labelledby="bloqueio-alcance"
          :disabled="salvando"
        />
        <Select
          v-if="alcance === 'profissional'"
          v-model="profissionalId"
          :options="profissionais"
          option-label="nome"
          option-value="id"
          :placeholder="t('agenda.config.bloqueio.escolhaProfissional')"
          :aria-label="t('agenda.config.bloqueio.alcance.profissional')"
          :disabled="salvando"
        />
        <Select
          v-else-if="alcance === 'sala'"
          v-model="salaId"
          :options="salasAtivas"
          option-label="nome"
          option-value="id"
          :placeholder="t('agenda.config.bloqueio.escolhaSala')"
          :aria-label="t('agenda.config.bloqueio.alcance.sala')"
          :disabled="salvando"
        />
      </section>

      <div class="eg__linha">
        <section class="eg__secao">
          <label class="eg__rotulo" for="bloqueio-motivo">{{
            t('agenda.config.bloqueio.motivoRotulo')
          }}</label>
          <Select
            v-model="motivo"
            input-id="bloqueio-motivo"
            :options="opcoesDeMotivo"
            option-label="rotulo"
            option-value="valor"
            :disabled="salvando"
          />
        </section>
        <section class="eg__secao">
          <label class="eg__rotulo" for="bloqueio-detalhe">
            {{ t('agenda.config.bloqueio.detalhe') }}
            <span class="eg__opcional">{{ t('cadastro.opcional') }}</span>
          </label>
          <InputText
            id="bloqueio-detalhe"
            v-model="detalhe"
            :maxlength="DETALHE_DO_BLOQUEIO_MAX"
            :disabled="salvando"
          />
        </section>
      </div>

      <section class="eg__secao">
        <span id="bloqueio-dia" class="eg__rotulo">
          {{ semanal ? t('agenda.config.bloqueio.aPartirDe') : t('agenda.config.bloqueio.dia') }}
        </span>
        <DatePicker
          v-model="dia"
          inline
          aria-labelledby="bloqueio-dia"
          :disabled="salvando"
          class="bg__calendario"
        />
      </section>

      <div class="eg__linha">
        <section class="eg__secao">
          <label class="eg__rotulo" for="bloqueio-inicio">{{
            t('agenda.config.bloqueio.inicio')
          }}</label>
          <InputMask
            id="bloqueio-inicio"
            v-model="inicio"
            mask="99:99"
            :auto-clear="false"
            :disabled="salvando"
          />
        </section>
        <section class="eg__secao">
          <label class="eg__rotulo" for="bloqueio-fim">{{ t('agenda.config.bloqueio.fim') }}</label>
          <InputMask
            id="bloqueio-fim"
            v-model="fim"
            mask="99:99"
            :auto-clear="false"
            :disabled="salvando"
          />
        </section>
      </div>

      <section v-if="!semanal && !modoDia" class="eg__secao">
        <label class="eg__rotulo" for="bloqueio-dia-final">
          {{ t('agenda.config.bloqueio.diaFinal') }}
          <span class="eg__opcional">{{ t('cadastro.opcional') }}</span>
        </label>
        <DatePicker
          v-model="diaFinal"
          input-id="bloqueio-dia-final"
          show-button-bar
          :min-date="dia"
          :disabled="salvando"
        />
        <small class="eg__dica">{{ t('agenda.config.bloqueio.diaFinalDica') }}</small>
      </section>

      <template v-if="!modoDia">
        <label class="bg__chave">
          <span>
            <strong>{{ t('agenda.config.bloqueio.semanal') }}</strong>
            <small>{{ t('agenda.config.bloqueio.semanalDica') }}</small>
          </span>
          <ToggleSwitch v-model="semanal" :disabled="salvando" />
        </label>

        <template v-if="semanal">
          <section class="eg__secao">
            <span id="bloqueio-dias" class="eg__rotulo">{{
              t('agenda.config.bloqueio.dias')
            }}</span>
            <div class="bg__dias" role="group" aria-labelledby="bloqueio-dias">
              <ToggleButton
                v-for="item in DIAS"
                :key="item"
                :model-value="diasDaSemana.includes(item)"
                :on-label="t(`agenda.config.bloqueio.diaCurto.${item}`)"
                :off-label="t(`agenda.config.bloqueio.diaCurto.${item}`)"
                :disabled="salvando"
                @update:model-value="(marcado: boolean) => alternarDia(item, marcado)"
              />
            </div>
          </section>
          <section class="eg__secao">
            <label class="eg__rotulo" for="bloqueio-ate">
              {{ t('agenda.config.bloqueio.ate') }}
              <span class="eg__opcional">{{ t('cadastro.opcional') }}</span>
            </label>
            <DatePicker
              v-model="repeteAte"
              input-id="bloqueio-ate"
              show-button-bar
              :min-date="dia"
              :disabled="salvando"
            />
            <small class="eg__dica">{{ t('agenda.config.bloqueio.ateDica') }}</small>
          </section>
        </template>
      </template>

      <p v-if="(tentou && problema) || erro" class="eg__erro" role="alert">
        <i class="ph ph-warning-circle" aria-hidden="true" />
        <span>{{ erro || problema }}</span>
      </p>
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
        form="bloqueio-form"
        icon="ph ph-check"
        :label="t('cadastro.salvar')"
        :loading="salvando"
      />
    </template>
  </CadastroGaveta>
</template>

<style scoped>
.bg__calendario {
  justify-self: start;
}

.bg__chave {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  cursor: pointer;
}

.bg__chave span {
  display: grid;
  gap: 2px;
}

.bg__chave strong {
  color: var(--tinta);
  font-size: 14px;
  font-weight: 600;
}

.bg__chave small {
  color: var(--tinta-2);
  font-size: 13px;
}

.bg__dias {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
</style>
