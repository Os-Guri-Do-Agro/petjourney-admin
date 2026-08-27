<script setup lang="ts">
/**
 * Última etapa do prontuário: conferir e emitir.
 *
 * A etapa existe porque **a consulta não termina quando o registro termina**. O responsável sai
 * da clínica com papel na mão — receita para comprar o remédio, atestado para justificar a
 * ausência no trabalho, o prontuário para levar a um especialista — e até aqui esses documentos
 * não existiam: havia um botão "Salvar em PDF" que emitia o prontuário inteiro e mais nada.
 *
 * Duas decisões:
 *
 * - **O resumo é de leitura, não de edição.** Quem chega aqui está conferindo antes de assinar;
 *   campo editável no meio da conferência convida a mexer no que já foi decidido.
 * - **Documento que não faz sentido não aparece habilitado.** Sem prescrição não há receituário,
 *   e um botão que gera folha em branco é pior que um botão ausente — o responsável descobre na
 *   farmácia.
 */
import Button from 'primevue/button'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import ClinicAlertChip from '../base/ClinicAlertChip.vue'
import type { DocumentoId } from '../documentos/documento-types'
import { useClinicFormat } from '../../composables/useClinicFormat'
import type { Encounter, Pet, Tutor, VitalKey } from '../../data/types'
import { prescricaoPendenteDeConfirmacao } from '../../domain/dose'
import { medicaoPreenchida, statusDaMedicao } from '../../domain/ranges'
import { clinicClock, useClinicoStore } from '../../stores/clinico'

const props = defineProps<{
  encounter: Encounter
  pet: Pet | null
  tutor: Tutor | null
}>()

const emit = defineEmits<{ emitir: [documento: DocumentoId] }>()

const { t } = useI18n()
const clinico = useClinicoStore()
const formato = useClinicFormat()

const VITAIS: VitalKey[] = [
  'peso',
  'temperatura',
  'frequenciaCardiaca',
  'frequenciaRespiratoria',
  'tempoPreenchimentoCapilar',
  'escoreCorporal',
  'pressaoSistolica',
]

const especie = computed(() => props.pet?.especie ?? 'canina')

/** No resumo entram os vitais **fora da faixa** — o resto já foi conferido na etapa do exame. */
const vitaisAlterados = computed(() =>
  VITAIS.map((vital) => ({
    vital,
    medicao: props.encounter.exameFisico.vitais[vital],
    faixa: clinico.faixaDe(vital, especie.value),
  }))
    .filter(
      ({ medicao, faixa }) =>
        medicaoPreenchida(medicao) && ['abaixo', 'acima'].includes(statusDaMedicao(medicao, faixa)),
    )
    .map(({ vital, medicao, faixa }) => ({
      vital,
      rotulo: t(`clinico.prontuario.exameFisico.${vital}`),
      valor: formato.medicao(medicao, faixa, vital === 'peso' ? 'kg' : ''),
      status: statusDaMedicao(medicao, faixa),
    })),
)

const sistemasAlterados = computed(() =>
  Object.entries(props.encounter.exameFisico.sistemas)
    .filter(([, sistema]) => sistema.status === 'alterado')
    .map(([chave, sistema]) => ({
      chave,
      rotulo: t(`clinico.prontuario.exameFisico.sistema.${chave}`),
      nota: sistema.nota,
    })),
)

const prescricoes = computed(() =>
  props.encounter.conduta.prescricoes.map((prescricao) => {
    const medicamento = clinico.medicamento(prescricao.medicamentoId)
    const { calculo } = prescricao

    return {
      id: prescricao.id,
      nome: medicamento?.nome ?? '',
      controlado: medicamento?.controlado ?? false,
      pendente: Boolean(
        props.pet && medicamento && prescricaoPendenteDeConfirmacao(prescricao, props.pet, medicamento),
      ),
      resumo:
        calculo.quantidadeApresentacao > 0 && medicamento
          ? t('clinico.prontuario.conduta.resumoDose', {
              quantidade: formato.numero(calculo.quantidadeApresentacao, 2),
              unidade: t(
                `clinico.prontuario.conduta.unidade.${medicamento.unidadeApresentacao}`,
                calculo.quantidadeApresentacao,
              ),
              mg: formato.numero(calculo.mgPorAdministracao, 1),
              frequencia: calculo.frequenciaHoras,
              duracao: calculo.duracaoDias,
              total: calculo.totalAdministracoes,
            })
          : t('clinico.prontuario.conduta.semPeso'),
    }
  }),
)

const temControlado = computed(() => prescricoes.value.some((item) => item.controlado))

const pendencias = computed(() => prescricoes.value.filter((item) => item.pendente))

const exames = computed(() =>
  props.encounter.conduta.examesSolicitados.map(
    (id) => clinico.exames.find((exame) => exame.id === id)?.nome ?? id,
  ),
)

const documentos = computed(() => [
  {
    id: 'prontuario' as DocumentoId,
    icone: 'pi pi-file',
    disponivel: true,
    detalhe: '',
  },
  {
    id: 'receituario' as DocumentoId,
    icone: 'pi pi-book',
    disponivel: prescricoes.value.length > 0,
    detalhe: temControlado.value ? t('clinico.documentos.cartao.receituarioControle') : '',
  },
  {
    id: 'atestado-saude' as DocumentoId,
    icone: 'pi pi-verified',
    disponivel: true,
    detalhe: '',
  },
  {
    id: 'atestado-comparecimento' as DocumentoId,
    icone: 'pi pi-clock',
    disponivel: true,
    detalhe: formato.intervalo(
      props.encounter.abertoEm,
      props.encounter.finalizadoEm ?? props.encounter.abertoEm,
    ),
  },
])

const dataDoAtendimento = computed(() =>
  clinicClock.dateOf(props.encounter.finalizadoEm ?? props.encounter.abertoEm),
)
</script>

<template>
  <section class="resumo clinic-scope">
    <header class="resumo__topo">
      <h3>{{ t('clinico.prontuario.resumo.titulo') }}</h3>
      <p>{{ t('clinico.prontuario.resumo.descricao') }}</p>
    </header>

    <!-- Pendência que impede um documento de circular vem antes do documento. -->
    <ClinicAlertChip
      v-for="item in pendencias"
      :key="`pendencia-${item.id}`"
      severidade="risco"
      :rotulo="t('clinico.prontuario.resumo.alergiaPendente', { medicamento: item.nome })"
    />

    <div class="ficha">
      <div class="ficha__linha">
        <span class="clinic-label">{{ t('clinico.prontuario.impressao.dataAtendimento') }}</span>
        <span>{{ formato.dataLonga(dataDoAtendimento) }}</span>
      </div>

      <div class="ficha__linha">
        <span class="clinic-label">{{ t('clinico.prontuario.anamnese.queixaPrincipal') }}</span>
        <span>{{ encounter.anamnese.queixaPrincipal || t('clinico.prontuario.resumo.vazio') }}</span>
      </div>

      <div class="ficha__linha">
        <span class="clinic-label">{{ t('clinico.prontuario.diagnostico.titulo') }}</span>
        <span v-if="encounter.diagnosticos.length > 0">
          <span v-for="(item, indice) in encounter.diagnosticos" :key="item.codigo">
            <template v-if="indice > 0"> · </template>
            {{ clinico.descricaoDoDiagnostico(item) }}
            <small>({{ t(`clinico.prontuario.diagnostico.tipo.${item.kind}`) }})</small>
          </span>
        </span>
        <span v-else class="ficha__vazio">{{ t('clinico.prontuario.resumo.vazio') }}</span>
      </div>

      <div v-if="vitaisAlterados.length > 0 || sistemasAlterados.length > 0" class="ficha__linha">
        <span class="clinic-label">{{ t('clinico.prontuario.resumo.achados') }}</span>
        <span class="ficha__achados">
          <span
            v-for="vital in vitaisAlterados"
            :key="vital.vital"
            class="achado"
            :class="`achado--${vital.status}`"
          >
            {{ vital.rotulo }} {{ vital.valor }}
          </span>
          <span v-for="sistema in sistemasAlterados" :key="sistema.chave" class="achado achado--sistema">
            {{ sistema.rotulo }}<template v-if="sistema.nota">: {{ sistema.nota }}</template>
          </span>
        </span>
      </div>

      <div class="ficha__linha">
        <span class="clinic-label">{{ t('clinico.prontuario.conduta.prescricoes') }}</span>
        <span v-if="prescricoes.length > 0" class="ficha__prescricoes">
          <span v-for="item in prescricoes" :key="item.id" class="prescricao">
            <strong>{{ item.nome }}</strong>
            <small v-if="item.controlado" class="prescricao__controle">
              {{ t('clinico.bulario.controlado') }}
            </small>
            <span class="clinic-value">{{ item.resumo }}</span>
          </span>
        </span>
        <span v-else class="ficha__vazio">{{ t('clinico.prontuario.resumo.vazio') }}</span>
      </div>

      <div v-if="exames.length > 0" class="ficha__linha">
        <span class="clinic-label">{{ t('clinico.prontuario.conduta.exames') }}</span>
        <span>{{ exames.join(' · ') }}</span>
      </div>

      <div v-if="encounter.conduta.retorno.emDias !== null" class="ficha__linha">
        <span class="clinic-label">{{ t('clinico.prontuario.conduta.retorno') }}</span>
        <span>
          {{
            t(
              'clinico.formato.dias',
              { valor: encounter.conduta.retorno.emDias },
              encounter.conduta.retorno.emDias,
            )
          }}
        </span>
      </div>
    </div>

    <section class="documentos">
      <header class="documentos__topo">
        <h4 class="clinic-label">{{ t('clinico.documentos.titulo') }}</h4>
        <p>{{ t('clinico.documentos.ajuda') }}</p>
      </header>

      <div class="documentos__grade">
        <article
          v-for="documento in documentos"
          :key="documento.id"
          class="documento"
          :class="{ 'documento--indisponivel': !documento.disponivel }"
        >
          <span class="documento__icone" aria-hidden="true"><i :class="documento.icone" /></span>

          <div class="documento__corpo">
            <strong>{{ t(`clinico.documentos.cartao.${documento.id}.titulo`) }}</strong>
            <small>{{ t(`clinico.documentos.cartao.${documento.id}.descricao`) }}</small>
            <small v-if="documento.detalhe" class="documento__detalhe">{{ documento.detalhe }}</small>
            <small v-if="!documento.disponivel" class="documento__bloqueio">
              {{ t('clinico.documentos.cartao.semPrescricao') }}
            </small>
          </div>

          <Button
            fluid
            icon="pi pi-print"
            size="small"
            severity="secondary"
            outlined
            :disabled="!documento.disponivel"
            :label="t('clinico.documentos.emitir')"
            @click="emit('emitir', documento.id)"
          />
        </article>
      </div>

      <p class="documentos__nota">
        <i class="pi pi-info-circle" aria-hidden="true" />
        {{ t('clinico.documentos.notaImpressao') }}
      </p>
    </section>
  </section>
</template>

<style scoped>
.resumo {
  display: grid;
  gap: var(--clinic-space-4);
}

.resumo__topo h3 {
  margin: 0;
  color: var(--clinic-text);
  font-size: var(--clinic-font-value);
  font-weight: 750;
  letter-spacing: -0.015em;
}

.resumo__topo p {
  margin: 0.15rem 0 0;
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
}

.ficha {
  display: grid;
  gap: var(--clinic-space-3);
  padding: var(--clinic-space-4);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-card);
  background: var(--clinic-surface-soft);
}

.ficha__linha {
  display: grid;
  align-items: baseline;
  gap: var(--clinic-space-3);
  grid-template-columns: 9.5rem minmax(0, 1fr);
}

.ficha__linha + .ficha__linha {
  padding-top: var(--clinic-space-3);
  border-top: 1px solid var(--clinic-line-soft);
}

.ficha__vazio {
  color: var(--clinic-faint);
}

.ficha__achados,
.ficha__prescricoes {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.ficha__prescricoes {
  flex-direction: column;
  gap: 0.35rem;
}

.achado {
  padding: 0.1rem 0.45rem;
  border-radius: var(--clinic-radius-chip);
  background: var(--clinic-attention-bg);
  color: var(--clinic-attention-text);
  font-size: var(--clinic-font-label);
  font-weight: 700;
}

.achado--acima,
.achado--abaixo {
  background: var(--clinic-risk-bg);
  color: var(--clinic-risk-text);
}

.prescricao {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.4rem;
}

.prescricao__controle {
  padding: 0 0.35rem;
  border-radius: var(--clinic-radius-chip);
  background: var(--clinic-attention-bg);
  color: var(--clinic-attention-text);
  font-size: 0.62rem;
  font-weight: 800;
  text-transform: uppercase;
}

.documentos {
  display: grid;
  gap: var(--clinic-space-3);
}

.documentos__topo p {
  margin: 0.2rem 0 0;
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
}

.documentos__grade {
  display: grid;
  gap: var(--clinic-space-3);
  grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
}

/*
 * Cartão em coluna: ícone e título no topo, botão ocupando a base.
 *
 * Em linha, com o botão ao lado, "Atestado de comparecimento" quebrava em duas linhas e a
 * descrição em quatro — quatro cartões de alturas diferentes e nenhum confortável.
 */
.documento {
  display: grid;
  align-content: start;
  gap: var(--clinic-space-3);
  padding: var(--clinic-space-4);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-card);
  background: var(--clinic-surface);
  box-shadow: var(--clinic-shadow-card);
  grid-template-rows: auto 1fr auto;
}

.documento--indisponivel {
  opacity: 0.62;
}

.documento__icone {
  display: grid;
  width: 2.2rem;
  height: 2.2rem;
  place-items: center;
  border-radius: var(--clinic-radius-control);
  background: var(--clinic-accent-tint);
  color: var(--clinic-accent-strong);
}

.documento__corpo {
  display: grid;
  min-width: 0;
  gap: 0.1rem;
}

.documento__corpo strong {
  font-size: var(--clinic-font-base);
  font-weight: 700;
}

.documento__corpo small {
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
  line-height: 1.4;
}

.documento__detalhe {
  color: var(--clinic-muted) !important;
  font-weight: 650;
}

.documento__bloqueio {
  color: var(--clinic-attention-text) !important;
  font-weight: 650;
}

.documentos__nota {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin: 0;
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
}

@media (max-width: 640px) {
  .ficha__linha {
    grid-template-columns: minmax(0, 1fr);
    gap: 0.2rem;
  }
}
</style>
