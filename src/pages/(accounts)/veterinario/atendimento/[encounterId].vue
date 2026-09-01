<script setup lang="ts">
/**
 * Prontuário eletrônico do atendimento.
 *
 * A consulta acontece em quatro momentos e a tela segue esses momentos: **uma etapa por vez**,
 * com o estado das outras à vista no topo. Empilhar anamnese, exame, diagnóstico e conduta na
 * mesma rolagem colocava mais de trinta campos competindo pela atenção de quem está com o
 * animal na mesa — a informação estava toda lá e nenhuma se destacava.
 *
 * O parâmetro da rota aceita duas formas: o id do prontuário (`enc-…`) ou `novo-<appointmentId>`
 * quando o atendimento ainda não tem registro aberto. É o que permite a agenda linkar para cá
 * sem precisar criar o prontuário antes.
 *
 * Estados que a página resolve e que o `PartnerPageFrame` não cobre: **rascunho local**
 * encontrado no navegador, **leitura** quando outro dispositivo detém a edição, e o **autosave**
 * em curso.
 *
 * Ao sair, `onBeforeRouteLeave` e `onBeforeUnmount` gravam o pendente e devolvem a edição.
 */
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'

import PartnerPageFrame from '@/components/parceiro/PartnerPageFrame.vue'
import ClinicPatientHeader from '@/features/clinico/components/base/ClinicPatientHeader.vue'
import ProntuarioAnamnese from '@/features/clinico/components/prontuario/ProntuarioAnamnese.vue'
import ProntuarioConduta from '@/features/clinico/components/prontuario/ProntuarioConduta.vue'
import ProntuarioDiagnostico from '@/features/clinico/components/prontuario/ProntuarioDiagnostico.vue'
import ProntuarioExameFisico from '@/features/clinico/components/prontuario/ProntuarioExameFisico.vue'
import DocumentoAtestado from '@/features/clinico/components/documentos/DocumentoAtestado.vue'
import DocumentoReceituario from '@/features/clinico/components/documentos/DocumentoReceituario.vue'
import type { DocumentoId } from '@/features/clinico/components/documentos/documento-types'
import ProntuarioImpressao from '@/features/clinico/components/prontuario/ProntuarioImpressao.vue'
import ProntuarioPreConsulta from '@/features/clinico/components/prontuario/ProntuarioPreConsulta.vue'
import ProntuarioResumo from '@/features/clinico/components/prontuario/ProntuarioResumo.vue'
import ProntuarioRetornoDialog from '@/features/clinico/components/prontuario/ProntuarioRetornoDialog.vue'
import ProntuarioStepper from '@/features/clinico/components/prontuario/ProntuarioStepper.vue'
import ProntuarioTimeline from '@/features/clinico/components/prontuario/ProntuarioTimeline.vue'
import type { PassoProntuario } from '@/features/clinico/components/prontuario/step-types'
import { useClinicFormat } from '@/features/clinico/composables/useClinicFormat'
import type { SlotSugestao } from '@/features/clinico/data/types'
import type { EtapaId } from '@/features/clinico/domain/encounter-progress'
import {
  alergiaNaoConfirmada,
  progressoDoAtendimento,
} from '@/features/clinico/domain/encounter-progress'
import { useClinicoStore } from '@/features/clinico/stores/clinico'
import { useProntuarioStore } from '@/features/clinico/stores/prontuario'
import { useCronometroStore } from '@/features/cronometro/stores/cronometro'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const clinico = useClinicoStore()
const prontuario = useProntuarioStore()
const cronometro = useCronometroStore()
const formato = useClinicFormat()

const assumirAberto = ref(false)
const finalizarAberto = ref(false)
const etapa = ref<EtapaId>('anamnese')
const historicoAberto = ref(false)

const idDaRota = computed(() => String(route.params.encounterId ?? ''))
const encounter = computed(() => prontuario.encounter)

/** Peso vigente: o do exame físico de hoje, com o cadastro do paciente como piso. */
const pesoVigente = computed(() => {
  const medido = encounter.value?.exameFisico.vitais.peso

  if (medido && !medido.naoAferido && medido.valor !== null) {
    return medido.valor
  }

  return prontuario.pet?.pesoKg ?? null
})

const motivoLeitura = computed(() => {
  const lock = prontuario.donoDaEdicao

  if (!prontuario.somenteLeitura) {
    return ''
  }

  if (encounter.value?.status === 'finalizado') {
    return t('clinico.prontuario.finalizado')
  }

  return lock
    ? t('clinico.prontuario.somenteLeitura', {
        dispositivo: lock.deviceLabel,
        desde: formato.hora(lock.desde),
      })
    : ''
})

const progresso = computed(() => {
  const atual = encounter.value

  if (!atual) {
    return []
  }

  return progressoDoAtendimento(atual, prontuario.pet, (id) => clinico.medicamento(id))
})

/**
 * O resumo de cada passo é o que dispensa abrir a etapa só para lembrar o que tem lá. Fica
 * curto de propósito: uma linha, sem reticências no meio de uma palavra.
 */
const passos = computed<PassoProntuario[]>(() => {
  const atual = encounter.value

  if (!atual) {
    return []
  }

  const [anamnese, exame, diagnostico, conduta, resumo] = progresso.value

  return [
    {
      id: 'anamnese',
      rotulo: t('clinico.prontuario.anamnese.titulo'),
      estado: anamnese?.estado ?? 'vazio',
      resumo: atual.anamnese.queixaPrincipal,
    },
    {
      id: 'exame',
      rotulo: t('clinico.prontuario.exameFisico.titulo'),
      estado: exame?.estado ?? 'vazio',
      resumo:
        (exame?.preenchidos ?? 0) > 0
          ? t('clinico.prontuario.passos.vitaisAferidos', {
              preenchidos: exame?.preenchidos ?? 0,
              total: exame?.total ?? 0,
            })
          : '',
    },
    {
      id: 'diagnostico',
      rotulo: t('clinico.prontuario.diagnostico.titulo'),
      estado: diagnostico?.estado ?? 'vazio',
      resumo: atual.diagnosticos.map((item) => clinico.descricaoDoDiagnostico(item)).join(' · '),
    },
    {
      id: 'conduta',
      rotulo: t('clinico.prontuario.conduta.titulo'),
      estado: conduta?.estado ?? 'vazio',
      resumo:
        conduta?.estado === 'alerta'
          ? t('clinico.prontuario.conduta.alergiaConfirmar')
          : atual.conduta.prescricoes.length > 0
            ? t('clinico.prontuario.passos.prescricoes', {
                contagem: atual.conduta.prescricoes.length,
              })
            : atual.conduta.orientacoes,
    },
    {
      id: 'resumo',
      rotulo: t('clinico.prontuario.resumo.titulo'),
      estado: resumo?.estado ?? 'vazio',
      resumo:
        atual.conduta.prescricoes.length > 0
          ? t('clinico.documentos.passoComReceita')
          : t('clinico.documentos.passoSemReceita'),
    },
  ]
})

const indiceDaEtapa = computed(() => passos.value.findIndex((passo) => passo.id === etapa.value))
const etapaAnterior = computed(() => passos.value[indiceDaEtapa.value - 1] ?? null)
const proximaEtapa = computed(() => passos.value[indiceDaEtapa.value + 1] ?? null)

/** O que ainda falta para finalizar. Não bloqueia: nomeia. */
const pendencias = computed(() => {
  const atual = encounter.value

  if (!atual) {
    return []
  }

  const faltando: string[] = []

  if (!atual.anamnese.queixaPrincipal.trim()) {
    faltando.push(t('clinico.prontuario.anamnese.queixaPrincipal'))
  }

  if (atual.diagnosticos.length === 0) {
    faltando.push(t('clinico.prontuario.diagnostico.titulo'))
  }

  if (alergiaNaoConfirmada(atual, prontuario.pet, (id) => clinico.medicamento(id))) {
    faltando.push(t('clinico.prontuario.conduta.alergiaConfirmar'))
  }

  return faltando
})

const erroTraduzido = computed(() => (prontuario.erro ? t(prontuario.erro) : ''))

const ehRetorno = computed(() => {
  const appointmentId = encounter.value?.appointmentId

  if (!appointmentId) {
    return false
  }

  return prontuario.consultaAnterior !== null
})

const ETAPAS: EtapaId[] = ['anamnese', 'exame', 'diagnostico', 'conduta', 'resumo']

/**
 * A etapa mora na URL pelo mesmo motivo que a data mora na URL da agenda: recarregar no meio
 * do exame físico não pode devolver a pessoa à anamnese. `replace` para que "voltar" saia do
 * prontuário em vez de desfazer quatro trocas de etapa.
 */
function irParaEtapa(id: string) {
  etapa.value = ETAPAS.includes(id as EtapaId) ? (id as EtapaId) : 'anamnese'

  void router.replace({ query: { ...route.query, etapa: etapa.value } })

  /** Trocar de etapa recomeça a leitura pelo topo; manter a rolagem esconde o cabeçalho. */
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

async function carregar() {
  await clinico.carregar()

  if (idDaRota.value.startsWith('novo-')) {
    await prontuario.abrirPorAppointment(idDaRota.value.replace('novo-', ''))

    /** Normaliza a URL para o id real, senão recarregar criaria outro caminho de entrada. */
    if (prontuario.encounter) {
      void router.replace(`/veterinario/atendimento/${prontuario.encounter.id}`)
    }
  } else {
    await prontuario.abrirPorId(idDaRota.value)
  }

  /**
   * O retorno abre mostrando a consulta anterior. Nos demais casos o histórico começa
   * recolhido: é contexto, não a tarefa da vez.
   */
  historicoAberto.value = ehRetorno.value

  /**
   * A etapa da URL manda. Sem ela, entra na primeira ainda incompleta — continuar é mais
   * comum que recomeçar.
   */
  const daUrl = String(route.query.etapa ?? '')

  if (ETAPAS.includes(daUrl as EtapaId)) {
    etapa.value = daUrl as EtapaId

    return
  }

  const pendente = progresso.value.find((item) => item.estado !== 'completo')

  etapa.value = pendente?.id ?? 'anamnese'
}

async function finalizar() {
  await prontuario.finalizar()
  finalizarAberto.value = false
}

async function assumir() {
  await prontuario.assumirEdicao()
  assumirAberto.value = false
}

/**
 * O PDF sai pela impressão do navegador, com as folhas A4 de `components/documentos`. Não há
 * biblioteca de PDF no bundle: seriam centenas de kB para reproduzir o que o navegador já faz,
 * e um segundo motor de layout para manter alinhado com o primeiro.
 *
 * **Só o documento escolhido é montado.** A regra de impressão esconde todo filho direto do
 * `body` que não seja a raiz de impressão; deixar as quatro folhas montadas e escondê-las por
 * CSS faria as quatro saírem no papel no dia em que alguém mexesse naquele seletor.
 */
const documentoParaImprimir = ref<DocumentoId>('prontuario')

async function emitirDocumento(documento: DocumentoId) {
  documentoParaImprimir.value = documento

  /** Sem esperar a montagem, a impressão dispara com a folha anterior ainda no DOM. */
  await nextTick()

  window.print()
}

function salvarEmPdf() {
  void emitirDocumento('prontuario')
}

/**
 * Abre a escolha de horário do retorno e dispara a busca.
 *
 * Antes daqui a função só navegava para a agenda focando o atendimento **que acabava de
 * terminar** — não criava nada, perdia os dias e o tipo escolhidos na conduta, e deixava o
 * aviso de retorno pendente na tela para sempre, mesmo depois de marcarem o retorno à mão.
 */
const retornoAberto = ref(false)

function agendarRetorno() {
  retornoAberto.value = true
  void prontuario.buscarSugestoesDeRetorno()
}

async function confirmarRetorno(slot: SlotSugestao) {
  const criado = await prontuario.agendarRetorno(slot)

  if (criado) {
    retornoAberto.value = false
  }
}

onMounted(carregar)
watch(idDaRota, carregar)

/**
 * Oferece este atendimento ao cronômetro do cabeçalho.
 *
 * Quem publica o contexto é a página, e não o cabeçalho: assim o cabeçalho — que vive no pacote
 * inicial da aplicação — não precisa importar o módulo clínico só para saber o nome do paciente.
 * A dependência aponta para a store genérica, que não conhece nenhum dos dois.
 *
 * O contexto é oferta, não comando: quem decide começar a contar é a pessoa. Um relógio que
 * dispara sozinho ao abrir o prontuário mede a tela aberta, não o atendimento — e num modelo em
 * que o tempo vira dinheiro, medir a coisa errada é o defeito grave.
 */
watch(
  [() => encounter.value?.id, () => prontuario.pet?.nome],
  ([id, nome]) => {
    cronometro.definirContexto(id ? { encounterId: id, rotulo: nome ?? '' } : null)
  },
  { immediate: true },
)

onBeforeRouteLeave(async () => {
  cronometro.definirContexto(null)
  await prontuario.descarregar()
  prontuario.$limpar()
})

onBeforeUnmount(() => {
  cronometro.definirContexto(null)
  void prontuario.descarregar()
})
</script>

<template>
  <PartnerPageFrame
    :subtitle="t('clinico.prontuario.subtitulo')"
    :title="t('clinico.prontuario.titulo')"
    :loading="prontuario.carregando && !encounter"
    :error="erroTraduzido"
    block-when-suspended
    @retry="carregar"
  >
    <template #actions>
      <span class="clinic-scope clinic-acoes">
        <span v-if="prontuario.salvando" class="salvando clinic-value">
          <i class="pi pi-spin pi-spinner" aria-hidden="true" />
          {{ t('clinico.prontuario.salvandoAgora') }}
        </span>
        <span v-else-if="prontuario.salvoEm" class="salvando clinic-value">
          <i class="pi pi-check" aria-hidden="true" />
          {{ t('clinico.prontuario.salvoEm', { valor: formato.hora(prontuario.salvoEm) }) }}
        </span>
  
        <Button
          v-if="encounter"
          :label="t('clinico.prontuario.imprimir')"
          icon="pi pi-file-pdf"
          severity="secondary"
          outlined
          :title="t('clinico.prontuario.impressao.dica')"
          @click="salvarEmPdf"
        />
  
        <Button
          v-if="encounter && encounter.status === 'rascunho' && !prontuario.somenteLeitura"
          :label="t('clinico.prontuario.finalizar')"
          icon="pi pi-check-circle"
          @click="finalizarAberto = true"
        />
      </span>
    </template>

    <div v-if="encounter" class="prontuario clinic-scope">
      <!-- Rascunho encontrado no navegador. Oferta, nunca sobrescrita silenciosa. -->
      <p v-if="prontuario.rascunhoPendente" class="faixa faixa--rascunho" role="status">
        <i class="pi pi-history" aria-hidden="true" />
        <span>
          {{ t('clinico.prontuario.rascunhoLocal') }} ·
          {{ formato.relativo(prontuario.rascunhoPendente.salvoEm) }}
        </span>
        <Button
          :label="t('clinico.prontuario.restaurarRascunho')"
          size="small"
          @click="prontuario.restaurarRascunho()"
        />
        <Button
          :label="t('clinico.prontuario.descartarRascunho')"
          size="small"
          severity="secondary"
          text
          @click="prontuario.descartarRascunho()"
        />
      </p>

      <!-- Leitura por outro dispositivo: com saída explícita, não um beco. -->
      <p
        v-if="prontuario.somenteLeitura && encounter.status !== 'finalizado'"
        class="faixa faixa--leitura"
        role="status"
      >
        <i class="pi pi-lock" aria-hidden="true" />
        <span>{{ motivoLeitura }}</span>
        <Button
          :label="t('clinico.prontuario.assumirEdicao')"
          size="small"
          severity="warn"
          @click="assumirAberto = true"
        />
      </p>

      <ClinicPatientHeader :pet="prontuario.pet" :tutor="prontuario.tutor">
        <template #acoes>
          <Button
            :label="
              historicoAberto
                ? t('clinico.prontuario.timeline.ocultar')
                : t('clinico.prontuario.timeline.mostrar')
            "
            :icon="historicoAberto ? 'pi pi-chevron-right' : 'pi pi-history'"
            severity="secondary"
            :outlined="!historicoAberto"
            :text="historicoAberto"
            size="small"
            @click="historicoAberto = !historicoAberto"
          />
        </template>
      </ClinicPatientHeader>

      <ProntuarioStepper :passos="passos" :ativo="etapa" @ir="irParaEtapa" />

      <div class="prontuario__corpo" :class="{ 'prontuario__corpo--com-aside': historicoAberto }">
        <div class="etapa">
          <!--
            A pré-consulta abre **acima** da anamnese: é o que o vet lê antes de digitar, e
            embaixo do formulário ela chegaria depois de o campo já ter sido preenchido à mão.
          -->
          <template v-if="etapa === 'anamnese'">
            <ProntuarioPreConsulta
              v-if="encounter.preConsulta"
              :pre-consulta="encounter.preConsulta"
              :anamnese="encounter.anamnese"
              :somente-leitura="prontuario.somenteLeitura"
              @aplicar="prontuario.atualizar({ anamnese: { ...encounter.anamnese, ...$event } })"
            />
          </template>

          <ProntuarioAnamnese
            v-if="etapa === 'anamnese'"
            :valor="encounter.anamnese"
            :somente-leitura="prontuario.somenteLeitura"
            :motivo-leitura="motivoLeitura"
            @atualizar="prontuario.atualizar({ anamnese: { ...encounter.anamnese, ...$event } })"
          />

          <ProntuarioExameFisico
            v-else-if="etapa === 'exame'"
            :valor="encounter.exameFisico"
            :pet="prontuario.pet"
            :somente-leitura="prontuario.somenteLeitura"
            :motivo-leitura="motivoLeitura"
            @atualizar="prontuario.atualizar($event)"
          />

          <ProntuarioDiagnostico
            v-else-if="etapa === 'diagnostico'"
            :valor="encounter.diagnosticos"
            :somente-leitura="prontuario.somenteLeitura"
            :motivo-leitura="motivoLeitura"
            @atualizar="prontuario.atualizar($event)"
          />

          <ProntuarioConduta
            v-else-if="etapa === 'conduta'"
            :valor="encounter.conduta"
            :pet="prontuario.pet"
            :peso-kg="pesoVigente"
            :somente-leitura="prontuario.somenteLeitura"
            :motivo-leitura="motivoLeitura"
            @atualizar="prontuario.atualizar($event)"
            @agendar-retorno="agendarRetorno"
          />

          <ProntuarioResumo
            v-else
            :encounter="encounter"
            :pet="prontuario.pet"
            :tutor="prontuario.tutor"
            @emitir="emitirDocumento"
          />

          <!--
            O rodapé é o caminho de teclado entre as etapas: sair do último campo cai no botão
            que leva à etapa seguinte, sem atalho para decorar.
          -->
          <footer class="etapa__rodape">
            <Button
              v-if="etapaAnterior"
              :label="etapaAnterior.rotulo"
              icon="pi pi-arrow-left"
              severity="secondary"
              text
              @click="irParaEtapa(etapaAnterior.id)"
            />
            <span v-else />

            <Button
              v-if="proximaEtapa"
              :label="proximaEtapa.rotulo"
              icon="pi pi-arrow-right"
              icon-pos="right"
              severity="secondary"
              outlined
              @click="irParaEtapa(proximaEtapa.id)"
            />
            <Button
              v-else-if="encounter.status === 'rascunho' && !prontuario.somenteLeitura"
              :label="t('clinico.prontuario.finalizar')"
              icon="pi pi-check-circle"
              @click="finalizarAberto = true"
            />
          </footer>
        </div>

        <ProntuarioTimeline
          v-if="historicoAberto"
          :eventos="prontuario.timeline"
          :anterior="prontuario.consultaAnterior"
          :rota-completa="`/veterinario/paciente/${encounter.petId}/historico`"
        />
      </div>
    </div>

    <!-- transferência explícita da edição -->
    <Dialog
      v-model:visible="assumirAberto"
      modal
      class="clinic-dialog"
      :style="{ width: 'min(30rem, 94vw)' }"
      :header="t('clinico.prontuario.assumirDialogo.titulo')"
      dismissable-mask
    >
      <p class="dialogo clinic-scope">{{ t('clinico.prontuario.assumirDialogo.descricao') }}</p>
      <template #footer>
        <Button
          :label="t('clinico.agenda.mover.cancelar')"
          severity="secondary"
          text
          @click="assumirAberto = false"
        />
        <Button
          :label="t('clinico.prontuario.assumirDialogo.confirmar')"
          severity="warn"
          @click="assumir"
        />
      </template>
    </Dialog>

    <!-- finalizar: nomeia o que falta, e ainda assim deixa finalizar -->
    <Dialog
      v-model:visible="finalizarAberto"
      modal
      class="clinic-dialog"
      :style="{ width: 'min(30rem, 94vw)' }"
      :header="t('clinico.prontuario.finalizarDialogo.titulo')"
      dismissable-mask
    >
      <div class="dialogo clinic-scope">
        <p>{{ t('clinico.prontuario.finalizarDialogo.descricao') }}</p>
        <p v-if="pendencias.length > 0" class="dialogo__pendencias">
          <i class="pi pi-exclamation-circle" aria-hidden="true" />
          {{ t('clinico.prontuario.finalizarDialogo.pendencias', { itens: pendencias.join(', ') }) }}
        </p>
      </div>

      <template #footer>
        <Button
          :label="t('clinico.agenda.mover.cancelar')"
          severity="secondary"
          text
          @click="finalizarAberto = false"
        />
        <Button
          :label="
            pendencias.length > 0
              ? t('clinico.prontuario.finalizarDialogo.confirmar')
              : t('clinico.prontuario.finalizar')
          "
          :severity="pendencias.length > 0 ? 'warn' : 'primary'"
          @click="finalizar"
        />
      </template>
    </Dialog>
    <!--
      A folha de impressão vive fora da página, direto no `body`: é o que permite a regra de
      impressão esconder todo o resto com um seletor de filho direto.
    -->
    <Teleport to="body">
      <div v-if="encounter" class="clinic-print-root">
        <ProntuarioImpressao
          v-if="documentoParaImprimir === 'prontuario'"
          :encounter="encounter"
          :pet="prontuario.pet"
          :tutor="prontuario.tutor"
        />
        <DocumentoReceituario
          v-else-if="documentoParaImprimir === 'receituario'"
          :encounter="encounter"
          :pet="prontuario.pet"
          :tutor="prontuario.tutor"
        />
        <DocumentoAtestado
          v-else
          :encounter="encounter"
          :pet="prontuario.pet"
          :tutor="prontuario.tutor"
          :tipo="documentoParaImprimir === 'atestado-saude' ? 'saude' : 'comparecimento'"
        />
      </div>
    </Teleport>

    <ProntuarioRetornoDialog
      v-if="encounter"
      v-model:visivel="retornoAberto"
      :sugestoes="prontuario.sugestoesDeRetorno"
      :buscando="prontuario.buscandoRetorno"
      :salvando="prontuario.salvando"
      :a-partir-de="prontuario.dataDoAtendimento"
      :em-dias="encounter.conduta.retorno.emDias"
      @escolher="confirmarRetorno"
    />
  </PartnerPageFrame>
</template>

<style scoped>
.prontuario {
  display: grid;
  gap: var(--clinic-space-3);
}

.prontuario__corpo {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: start;
  gap: var(--clinic-space-3);
}

.prontuario__corpo--com-aside {
  grid-template-columns: minmax(0, 1fr) auto;
}

.etapa {
  display: grid;
  gap: var(--clinic-space-3);
  min-width: 0;
}

.etapa__rodape {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--clinic-space-3);
}

.faixa {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--clinic-space-2);
  margin: 0;
  padding: var(--clinic-space-3) var(--clinic-space-4);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-control);
  line-height: 1.45;
}

.faixa span {
  flex: 1;
  min-width: 12rem;
}

.faixa--rascunho {
  border-color: var(--clinic-accent);
  background: var(--clinic-accent-tint);
  color: var(--clinic-accent-strong);
}

.faixa--leitura {
  border-color: var(--clinic-attention-line);
  background: var(--clinic-attention-bg);
  color: var(--clinic-attention-text);
}

.salvando {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
  font-weight: 700;
}

.dialogo {
  display: grid;
  gap: var(--clinic-space-3);
  line-height: 1.55;
}

.dialogo p {
  margin: 0;
}

.dialogo__pendencias {
  display: flex;
  align-items: flex-start;
  gap: 0.4rem;
  padding: var(--clinic-space-3);
  border: 1px solid var(--clinic-attention-line);
  border-radius: var(--clinic-radius-control);
  background: var(--clinic-attention-bg);
  color: var(--clinic-attention-text);
  font-weight: 650;
}

@media (max-width: 1200px) {
  .prontuario__corpo--com-aside {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
