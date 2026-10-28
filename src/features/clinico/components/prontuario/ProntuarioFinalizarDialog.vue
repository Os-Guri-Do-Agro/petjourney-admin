<script setup lang="ts">
/**
 * Finalizar o atendimento, em dois tempos no mesmo diálogo.
 *
 * 1. **Antes**: o que ainda falta registrar, cada item com o atalho para a etapa onde se resolve.
 *    Não bloqueia — nomeia. Quem decide finalizar mesmo assim é quem atende.
 * 2. **Depois**: o diálogo não fecha sozinho nem leva para a agenda. Ele confirma que o prontuário
 *    fechou, mostra o que ainda se faz com este atendimento (entregar o resumo no app, os
 *    documentos, o retorno) e diz quem é o próximo paciente, com o botão de atendê-lo.
 *
 * Antes daqui, finalizar levava direto à agenda: quem acabava de atender não via que tinha dado
 * certo, perdia o resumo por entregar e precisava procurar na grade quem vinha depois.
 */
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Skeleton from 'primevue/skeleton'
import { computed, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import ProntuarioDialogoTopo from '@/features/clinico/components/prontuario/ProntuarioDialogoTopo.vue'
import { useClinicFormat } from '@/features/clinico/composables/useClinicFormat'
import { agendaRepository } from '@/features/clinico/data/repositories'
import type { Appointment } from '@/features/clinico/data/types'
import type { EtapaId } from '@/features/clinico/domain/encounter-progress'
import { clinicClock, useClinicoStore } from '@/features/clinico/stores/clinico'
import { useProntuarioStore } from '@/features/clinico/stores/prontuario'
import PetAvatar from '@/features/hotel/components/base/PetAvatar.vue'

const props = defineProps<{
  visivel: boolean
  pendencias: Array<{ texto: string; etapa: EtapaId }>
  rotuloDaEtapa: (id: EtapaId) => string
  /** "Nina · Tiago Sá": o paciente e quem atendeu. */
  subtitulo: string
}>()

const emit = defineEmits<{
  'update:visivel': [visivel: boolean]
  /** "Ir à etapa Diagnóstico": fecha e leva até lá. */
  resolver: [etapa: EtapaId]
  /** "Ver documentos": fecha e abre a etapa Resumo, onde ficam. */
  verResumo: []
}>()

const { t } = useI18n()
const router = useRouter()
const formato = useClinicFormat()
const clinico = useClinicoStore()
const prontuario = useProntuarioStore()
const idDoTitulo = useId()

const encounter = computed(() => prontuario.encounter)

/** Em que tempo o diálogo está: decidindo, ou já finalizado. */
const fase = ref<'confirmar' | 'feito'>('confirmar')
const finalizando = ref(false)
const entregando = ref(false)

/* Abrir de novo um atendimento ainda aberto começa pela pergunta. */
watch(
  () => props.visivel,
  (aberto) => {
    if (aberto && encounter.value?.status !== 'finalizado') {
      fase.value = 'confirmar'
    }
  },
)

function fechar() {
  emit('update:visivel', false)
}

async function finalizar() {
  finalizando.value = true

  try {
    await prontuario.finalizar()
    fase.value = 'feito'
    void buscarProximo()
  } catch {
    /* A falha aparece na faixa de erro da tela; o diálogo fica na pergunta para tentar de novo. */
  } finally {
    finalizando.value = false
  }
}

// ------------------------------------------------------------------ com este atendimento

const horaDoFim = computed(() =>
  encounter.value?.finalizadoEm ? formato.hora(encounter.value.finalizadoEm) : '',
)

const responsavel = computed(() => prontuario.tutor?.nome ?? '')

const resumoEntregueEm = computed(() => encounter.value?.resumoLiberadoEm ?? null)

async function entregarResumo() {
  entregando.value = true

  try {
    await prontuario.liberarResumo()
  } finally {
    entregando.value = false
  }
}

/** O retorno, só quando a conduta indicou um: marcado, ou indicado e sem horário. */
const retorno = computed(() => {
  const indicado = encounter.value?.conduta.retorno

  if (!indicado) {
    return null
  }

  if (indicado.appointmentId) {
    return { marcado: true, texto: t('clinico.prontuario.nova.finalizar.feito.retornoMarcado') }
  }

  if (indicado.emDias) {
    return {
      marcado: false,
      texto: t(
        'clinico.prontuario.nova.finalizar.feito.retornoSemHorario',
        { dias: indicado.emDias },
        indicado.emDias,
      ),
    }
  }

  return null
})

// ------------------------------------------------------------------ o próximo paciente

const doDia = ref<Appointment[] | null>(null)

/**
 * O dia da clínica pedido direto ao repositório, sem passar pela agenda: trocar a data da store
 * mudaria o dia que a grade mostra a quem voltar para ela.
 */
async function buscarProximo() {
  doDia.value = null

  try {
    const dia = await agendaRepository.obterDia(clinicClock.today())

    doDia.value = dia.atendimentos
  } catch {
    doDia.value = []
  }
}

const ENCERRADOS: Appointment['status'][] = ['cancelado', 'falta', 'finalizado']

/**
 * Quem vem agora: primeiro quem já espera na recepção, pela ordem de chegada; senão, o próximo
 * horário que ainda não começou. Em cada caso, o paciente de quem atendeu vem antes do dos colegas.
 */
const proximo = computed(() => {
  const atual = encounter.value

  if (!atual || !doDia.value) {
    return null
  }

  const lista = doDia.value.filter((item) => item.id !== atual.appointmentId)
  const meu = (item: Appointment) => item.professionalId === atual.professionalId
  const instante = clinicClock.nowIso()

  const naRecepcao = lista
    .filter((item) => item.status === 'aguardando')
    .sort((a, b) => (a.chegadaEm ?? a.inicio).localeCompare(b.chegadaEm ?? b.inicio))

  const aSeguir = lista
    .filter(
      (item) =>
        item.inicio > instante &&
        !ENCERRADOS.includes(item.status) &&
        item.status !== 'em-atendimento' &&
        item.status !== 'aguardando',
    )
    .sort((a, b) => a.inicio.localeCompare(b.inicio))

  const item = naRecepcao.find(meu) ?? naRecepcao[0] ?? aSeguir.find(meu) ?? aSeguir[0] ?? null

  if (!item) {
    return null
  }

  const pet = clinico.pet(item.petId)
  const esperando = item.status === 'aguardando'
  const minutos = item.chegadaEm
    ? Math.max(0, Math.round((Date.parse(instante) - Date.parse(item.chegadaEm)) / 60_000))
    : 0

  const quando = esperando
    ? minutos < 1
      ? t('clinico.prontuario.nova.finalizar.feito.acabouDeChegar')
      : t('clinico.prontuario.nova.finalizar.feito.esperaHa', { tempo: formato.duracao(minutos) })
    : t('clinico.prontuario.nova.finalizar.feito.horario', { hora: formato.hora(item.inicio) })

  const colega = meu(item) ? '' : (clinico.profissional(item.professionalId)?.nome ?? '')

  return {
    item,
    esperando,
    nome: pet?.nome ?? '',
    iniciais: pet?.iniciais ?? '',
    especie: pet?.especie ?? null,
    fotoUrl: pet?.fotoUrl ?? '',
    linha: [clinico.tipo(item.typeId)?.nome, quando, colega].filter(Boolean).join(' · '),
  }
})

function atenderProximo() {
  const item = proximo.value?.item

  if (!item) {
    return
  }

  fechar()
  void router.push(
    item.encounterId
      ? `/veterinario/atendimento/${item.encounterId}`
      : `/veterinario/atendimento/novo-${item.id}`,
  )
}

function voltarParaAgenda() {
  fechar()
  void router.push('/veterinario/agenda')
}

function verResumo() {
  fechar()
  emit('verResumo')
}

const topo = computed(() =>
  fase.value === 'feito'
    ? {
        titulo: t('clinico.prontuario.nova.finalizar.feito.titulo'),
        subtitulo: [props.subtitulo, horaDoFim.value].filter(Boolean).join(' · '),
        icone: 'ph ph-check-circle',
        tom: 'ok' as const,
      }
    : {
        titulo: t('clinico.prontuario.finalizarDialogo.titulo'),
        subtitulo: props.subtitulo,
        icone: props.pendencias.length > 0 ? 'ph ph-warning-circle' : 'ph ph-check-circle',
        tom: props.pendencias.length > 0 ? ('atencao' as const) : ('ok' as const),
      },
)
</script>

<template>
  <Dialog
    :visible="visivel"
    modal
    class="clinic-dialog hc-tema finalizar"
    :style="{ width: 'min(36rem, 94vw)' }"
    :aria-labelledby="idDoTitulo"
    :dismissable-mask="fase === 'confirmar'"
    @update:visible="emit('update:visivel', $event)"
  >
    <template #header>
      <ProntuarioDialogoTopo
        :id="idDoTitulo"
        :titulo="topo.titulo"
        :subtitulo="topo.subtitulo"
        :icone="topo.icone"
        :tom="topo.tom"
      />
    </template>

    <!-- ------------------------------------------------------------- antes -->
    <div v-if="fase === 'confirmar'" class="finalizar__corpo">
      <section
        v-if="pendencias.length > 0"
        class="faltam"
        :aria-labelledby="`${idDoTitulo}-faltam`"
      >
        <h3 :id="`${idDoTitulo}-faltam`" class="finalizar__rotulo">
          {{ t('clinico.prontuario.nova.finalizar.faltam') }}
        </h3>
        <ul class="faltam__lista">
          <li v-for="item in pendencias" :key="item.etapa + item.texto" class="faltam__item">
            <i class="ph ph-warning-circle faltam__icone" aria-hidden="true" />
            <span class="faltam__texto">{{ item.texto }}</span>
            <Button
              type="button"
              size="small"
              severity="secondary"
              icon="ph ph-arrow-right"
              icon-pos="right"
              :label="
                t('clinico.prontuario.nova.finalizar.ir', { etapa: rotuloDaEtapa(item.etapa) })
              "
              @click="emit('resolver', item.etapa)"
            />
          </li>
        </ul>
      </section>

      <p v-else class="finalizar__ok">
        <i class="ph ph-check-circle" aria-hidden="true" />
        {{ t('clinico.prontuario.nova.finalizar.tudoCerto') }}
      </p>

      <p class="finalizar__nota">{{ t('clinico.prontuario.nova.finalizar.depois') }}</p>
    </div>

    <!-- ------------------------------------------------------------- depois -->
    <div v-else class="finalizar__corpo" role="status">
      <section :aria-labelledby="`${idDoTitulo}-este`">
        <h3 :id="`${idDoTitulo}-este`" class="finalizar__rotulo">
          {{ t('clinico.prontuario.nova.finalizar.feito.comEste') }}
        </h3>
        <ul class="feito__lista">
          <li class="feito__item">
            <i class="ph ph-lock-simple feito__icone" aria-hidden="true" />
            <span class="feito__texto">
              {{ t('clinico.prontuario.nova.finalizar.feito.fechado', { hora: horaDoFim }) }}
            </span>
          </li>

          <li class="feito__item">
            <i
              class="feito__icone"
              :class="
                resumoEntregueEm ? 'ph ph-check-circle feito__icone--ok' : 'ph ph-device-mobile'
              "
              aria-hidden="true"
            />
            <span class="feito__texto">
              {{
                resumoEntregueEm
                  ? t('clinico.prontuario.nova.finalizar.feito.resumoEntregue', {
                      hora: formato.hora(resumoEntregueEm),
                    })
                  : responsavel
                    ? t('clinico.prontuario.nova.finalizar.feito.resumoPronto', { responsavel })
                    : t('clinico.prontuario.nova.finalizar.feito.resumoProntoSemNome')
              }}
            </span>
            <Button
              v-if="!resumoEntregueEm"
              type="button"
              size="small"
              severity="secondary"
              icon="ph ph-paper-plane-tilt"
              :label="t('clinico.prontuario.nova.finalizar.feito.entregar')"
              :loading="entregando"
              @click="entregarResumo"
            />
          </li>

          <li class="feito__item">
            <i class="ph ph-file-text feito__icone" aria-hidden="true" />
            <span class="feito__texto">
              {{ t('clinico.prontuario.nova.finalizar.feito.documentos') }}
            </span>
            <Button
              type="button"
              size="small"
              severity="secondary"
              icon="ph ph-arrow-right"
              icon-pos="right"
              :label="t('clinico.prontuario.nova.finalizar.feito.verDocumentos')"
              @click="verResumo"
            />
          </li>

          <li v-if="retorno" class="feito__item">
            <i
              class="feito__icone"
              :class="
                retorno.marcado ? 'ph ph-calendar-check feito__icone--ok' : 'ph ph-calendar-dots'
              "
              aria-hidden="true"
            />
            <span class="feito__texto">{{ retorno.texto }}</span>
          </li>
        </ul>
      </section>

      <section class="proximo" :aria-labelledby="`${idDoTitulo}-proximo`">
        <h3 :id="`${idDoTitulo}-proximo`" class="finalizar__rotulo">
          {{ t('clinico.prontuario.nova.finalizar.feito.proximo') }}
        </h3>

        <div v-if="doDia === null" class="proximo__cartao" aria-busy="true">
          <Skeleton shape="circle" size="2.75rem" />
          <span class="proximo__texto">
            <Skeleton width="7rem" height="0.9rem" border-radius="6px" />
            <Skeleton width="12rem" height="0.8rem" border-radius="6px" />
          </span>
        </div>

        <div v-else-if="proximo" class="proximo__cartao">
          <PetAvatar
            :nome="proximo.nome"
            :iniciais="proximo.iniciais"
            :especie="proximo.especie"
            :foto-url="proximo.fotoUrl"
            tamanho="md"
          />
          <span class="proximo__texto">
            <strong class="proximo__nome">{{ proximo.nome }}</strong>
            <span class="proximo__linha">{{ proximo.linha }}</span>
          </span>
          <!--
            O rótulo sem o nome (o nome já está ao lado, em destaque): com "Maximiliano Bartholomeu
            von Schnauzerhausen III" o botão passava da borda do diálogo e levava a lista junto.
            O leitor de tela continua ouvindo o nome.
          -->
          <Button
            v-if="proximo.esperando"
            type="button"
            icon="ph ph-arrow-right"
            icon-pos="right"
            :label="t('clinico.hoje.chamar')"
            :aria-label="t('clinico.meuDia.atenderCom', { pet: proximo.nome })"
            @click="atenderProximo"
          />
        </div>

        <p v-else class="proximo__vazio">
          <i class="ph ph-coffee" aria-hidden="true" />
          {{ t('clinico.prontuario.nova.finalizar.feito.ninguem') }}
        </p>
      </section>
    </div>

    <template #footer>
      <template v-if="fase === 'confirmar'">
        <Button
          type="button"
          severity="secondary"
          :label="t('clinico.prontuario.nova.finalizar.voltar')"
          @click="fechar"
        />
        <Button
          type="button"
          icon="ph ph-check-circle"
          :label="
            pendencias.length > 0
              ? t('clinico.prontuario.finalizarDialogo.confirmar')
              : t('clinico.prontuario.finalizar')
          "
          :loading="finalizando"
          @click="finalizar"
        />
      </template>

      <template v-else>
        <Button
          type="button"
          severity="secondary"
          :label="t('clinico.prontuario.nova.finalizar.feito.ficar')"
          @click="fechar"
        />
        <!-- Com alguém esperando, a ação principal é atendê-lo; sem ninguém, é voltar à grade. -->
        <Button
          type="button"
          icon="ph ph-calendar-blank"
          :severity="proximo?.esperando ? 'secondary' : undefined"
          :label="t('clinico.prontuario.nova.finalizar.feito.agenda')"
          @click="voltarParaAgenda"
        />
      </template>
    </template>
  </Dialog>
</template>

<style scoped>
.finalizar__corpo {
  display: grid;
  gap: 20px;
}

.finalizar__rotulo {
  margin: 0 0 8px;
  color: var(--tinta-2);
  font-size: 13px;
  font-weight: 650;
}

.finalizar__nota {
  margin: 0;
  color: var(--tinta-2);
  font-size: 14px;
  line-height: 1.5;
}

.finalizar__ok {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin: 0;
  color: var(--tinta);
  font-size: 14.5px;
  line-height: 1.45;
}

.finalizar__ok i {
  margin-top: 1px;
  color: var(--ok-tinta);
  font-size: 19px;
}

/* ------------------------------------------------------------------ o que falta */

/* Lista em véu, sem fundo de cor: o alerta mora no ícone (regra da casa). */
.faltam__lista,
.feito__lista {
  display: grid;
  margin: 0;
  padding: 4px 14px;
  border-radius: 16px;
  background: var(--app-veu, var(--superficie-2));
  list-style: none;
}

.faltam__item,
.feito__item {
  display: flex;
  min-height: 52px;
  align-items: center;
  gap: 12px;
  padding-block: 8px;
}

.faltam__item + .faltam__item,
.feito__item + .feito__item {
  border-top: 1px solid var(--linha-suave, var(--linha));
}

.faltam__icone,
.feito__icone {
  flex: none;
  color: var(--tinta-2);
  font-size: 19px;
}

.faltam__icone {
  color: var(--atencao-tinta);
}

.feito__icone--ok {
  color: var(--ok-tinta);
}

.faltam__texto,
.feito__texto {
  flex: 1;
  min-width: 0;
  color: var(--tinta);
  font-size: 14.5px;
  line-height: 1.4;
}

.faltam__item :deep(.p-button),
.feito__item :deep(.p-button) {
  flex: none;
  white-space: nowrap;
}

/* ------------------------------------------------------------------ o próximo */

.proximo__cartao {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  border: 1px solid var(--linha);
  border-radius: 18px;
}

.proximo__texto {
  display: grid;
  flex: 1;
  min-width: 0;
  gap: 4px;
}

.proximo__nome {
  color: var(--tinta);
  font-size: 16px;
  font-weight: 700;
}

.proximo__linha {
  overflow: hidden;
  color: var(--tinta-2);
  font-size: 13.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.proximo__cartao :deep(.p-button) {
  flex: none;
  white-space: nowrap;
}

.proximo__vazio {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  color: var(--tinta-2);
  font-size: 14.5px;
}

.proximo__vazio i {
  font-size: 19px;
}
</style>

<style>
/*
 * O rodapé do diálogo, que o PrimeVue teleporta para fora do escopo: os botões no tamanho do
 * rótulo, numa linha, encostados à direita. Esticados e com letra grande eles quebravam em duas
 * linhas ("Finalizar mesmo / assim").
 */
.finalizar.p-dialog .p-dialog-footer {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
}

.finalizar.p-dialog .p-dialog-footer .p-button {
  flex: none;
  font-size: 15px;
  white-space: nowrap;
}
</style>
