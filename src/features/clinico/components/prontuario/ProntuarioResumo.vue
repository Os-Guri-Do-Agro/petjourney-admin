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
import { computed, ref } from 'vue'
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

const emit = defineEmits<{ emitir: [documento: DocumentoId]; liberarResumo: [] }>()

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

/**
 * O catálogo de documentos, com **grupo** e **quando sugerir**.
 *
 * Quinze cartões iguais numa grade era uma tela de busca desenhada como tela de navegação: o
 * profissional chega sabendo o que quer, e varria quinze para achar o de sempre. Pior, dava o
 * mesmo peso visual ao que sai de toda consulta e ao que sai de uma em cem — com
 * "Declaração de óbito" ao lado de "Receituário" numa consulta de rotina, o que além de
 * confuso é tonalmente errado.
 *
 * Agora o que **este atendimento implica** vem em cartão, e o resto fica numa lista agrupada,
 * recolhida. `sugerido` é a regra que decide de que lado cada um cai.
 */
const catalogo = computed(() => [
  {
    id: 'prontuario' as DocumentoId,
    icone: 'ph ph-file',
    grupo: 'atendimento' as const,
    disponivel: true,
    /* O registro em si: sempre pertinente. */
    sugerido: true,
    detalhe: '',
  },
  {
    id: 'receituario' as DocumentoId,
    icone: 'ph ph-book-open',
    grupo: 'atendimento' as const,
    disponivel: prescricoes.value.length > 0,
    sugerido: prescricoes.value.length > 0,
    detalhe: temControlado.value ? t('clinico.documentos.cartao.receituarioControle') : '',
  },
  {
    id: 'atestado-saude' as DocumentoId,
    icone: 'ph ph-seal-check',
    grupo: 'declaracoes' as const,
    disponivel: true,
    /* Atestado sai a pedido do responsável, não por implicação do atendimento. */
    sugerido: false,
    detalhe: '',
  },
  {
    id: 'atestado-comparecimento' as DocumentoId,
    icone: 'ph ph-clock',
    grupo: 'declaracoes' as const,
    disponivel: true,
    sugerido: false,
    detalhe: formato.intervalo(
      props.encounter.abertoEm,
      props.encounter.finalizadoEm ?? props.encounter.abertoEm,
    ),
  },

  // ------------------------------------------------ recortes do prontuário
  {
    id: 'pedido-exame' as DocumentoId,
    icone: 'ph ph-magnifying-glass',
    grupo: 'atendimento' as const,
    /* Sem exame pedido, a folha sairia com uma lista vazia — pior que botão ausente. */
    disponivel: props.encounter.conduta.examesSolicitados.length > 0,
    sugerido: props.encounter.conduta.examesSolicitados.length > 0,
    detalhe: '',
  },
  {
    id: 'orientacoes' as DocumentoId,
    icone: 'ph ph-house',
    grupo: 'atendimento' as const,
    disponivel:
      Boolean(props.encounter.conduta.orientacoes.trim()) || prescricoes.value.length > 0,
    sugerido:
      Boolean(props.encounter.conduta.orientacoes.trim()) || prescricoes.value.length > 0,
    detalhe: '',
  },
  {
    id: 'encaminhamento' as DocumentoId,
    icone: 'ph ph-paper-plane-tilt',
    grupo: 'terceiros' as const,
    disponivel: true,
    sugerido: false,
    detalhe: '',
  },
  {
    id: 'relatorio-plano' as DocumentoId,
    icone: 'ph ph-shield',
    grupo: 'terceiros' as const,
    disponivel: true,
    sugerido: false,
    detalhe: '',
  },

  // ------------------------------------------------ declarações
  {
    id: 'atestado-viagem' as DocumentoId,
    icone: 'ph ph-globe',
    grupo: 'declaracoes' as const,
    disponivel: true,
    sugerido: false,
    detalhe: '',
  },
  {
    id: 'comprovante-vacinacao' as DocumentoId,
    icone: 'ph ph-shield',
    grupo: 'declaracoes' as const,
    disponivel: true,
    /*
     * Não sugerido: o prontuário não sabe se hoje houve vacina — o tipo do atendimento mora
     * no agendamento, não aqui. Sugerir por engano seria pior que deixar na lista.
     */
    sugerido: false,
    detalhe: '',
  },
  {
    id: 'declaracao-obito' as DocumentoId,
    icone: 'ph ph-heart',
    grupo: 'termos' as const,
    disponivel: true,
    /* Nunca sugerido. Oferecer isto numa consulta de rotina é indelicado e assustador. */
    sugerido: false,
    detalhe: '',
  },

  // ------------------------------------------------ termos do responsável
  {
    id: 'termo-consentimento' as DocumentoId,
    icone: 'ph ph-check-square',
    grupo: 'termos' as const,
    disponivel: true,
    /*
     * O consentimento é assinado **antes** do procedimento, a partir da agenda — não no fim do
     * atendimento. Aqui ele fica disponível para reimpressão, não sugerido.
     */
    sugerido: false,
    detalhe: '',
  },
  {
    id: 'termo-recusa' as DocumentoId,
    icone: 'ph ph-x-circle',
    grupo: 'termos' as const,
    disponivel: true,
    sugerido: false,
    detalhe: '',
  },
  {
    id: 'termo-eutanasia' as DocumentoId,
    icone: 'ph ph-note-pencil',
    grupo: 'termos' as const,
    disponivel: true,
    sugerido: false,
    detalhe: '',
  },

  // ------------------------------------------------ administrativo
  {
    id: 'orcamento' as DocumentoId,
    icone: 'ph ph-currency-dollar',
    grupo: 'terceiros' as const,
    disponivel: true,
    sugerido: false,
    detalhe: '',
  },
])

/** O que este atendimento implica. Cartão grande, no topo. */
const sugeridos = computed(() =>
  catalogo.value.filter((documento) => documento.sugerido && documento.disponivel),
)

/**
 * Todo o resto, agrupado.
 *
 * Os grupos são por **quem recebe o papel**, e não por tipo de documento: atendimento (fica na
 * clínica ou vai com o responsável), declarações (afirmam um fato a terceiros), termos (o
 * responsável assina) e terceiros (colega, plano, laboratório). É a divisão que o profissional
 * usa para procurar.
 */
const GRUPOS = ['atendimento', 'declaracoes', 'termos', 'terceiros'] as const

const outros = computed(() =>
  GRUPOS.map((grupo) => ({
    grupo,
    documentos: catalogo.value.filter(
      (documento) => documento.grupo === grupo && !sugeridos.value.includes(documento),
    ),
  })).filter((item) => item.documentos.length > 0),
)

const totalDeOutros = computed(() =>
  outros.value.reduce((total, item) => total + item.documentos.length, 0),
)

/** Recolhido por padrão: o caminho comum são os sugeridos, e ele não pode custar uma rolagem. */
const outrosAbertos = ref(false)

const dataDoAtendimento = computed(() =>
  clinicClock.dateOf(props.encounter.finalizadoEm ?? props.encounter.abertoEm),
)

/**
 * O resumo no app do responsável: três estados, uma linha cada. Aberto não libera (o texto ainda
 * muda); finalizado e não liberado é a ação; liberado diz quando.
 */
const noApp = computed(() => {
  const liberadoEm = props.encounter.resumoLiberadoEm ?? null

  if (props.encounter.status !== 'finalizado') {
    return { estado: 'aberto' as const, texto: t('clinico.prontuario.resumo.app.aberto') }
  }

  if (!liberadoEm) {
    return { estado: 'pronto' as const, texto: t('clinico.prontuario.resumo.app.pronto') }
  }

  return {
    estado: 'liberado' as const,
    texto: t('clinico.prontuario.resumo.app.liberado', {
      data: formato.dataCurta(clinicClock.dateOf(liberadoEm)),
      hora: formato.hora(liberadoEm),
    }),
  }
})
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

    <!--
      O que o responsável recebe no app. Fica antes dos documentos porque é a entrega que não
      depende de papel — e a única que o vet precisa decidir ativamente.
    -->
    <section class="app" :class="`app--${noApp.estado}`" aria-labelledby="resumo-app-titulo">
      <i
        class="ph app__icone"
        :class="noApp.estado === 'liberado' ? 'ph-check-circle' : 'ph-device-mobile'"
        aria-hidden="true"
      />
      <div class="app__corpo">
        <h4 id="resumo-app-titulo" class="clinic-label">
          {{ t('clinico.prontuario.resumo.app.titulo') }}
        </h4>
        <p>{{ noApp.texto }}</p>
      </div>
      <Button
        v-if="noApp.estado === 'pronto'"
        :label="t('clinico.prontuario.resumo.app.liberar')"
        icon="ph ph-paper-plane-tilt"
        size="small"
        @click="emit('liberarResumo')"
      />
    </section>

    <section class="documentos">
      <header class="documentos__topo">
        <h4 class="clinic-label">{{ t('clinico.documentos.titulo') }}</h4>
        <p>{{ t('clinico.documentos.ajuda') }}</p>
      </header>

      <!--
        Sugeridos: o que **este** atendimento implica. Três ou quatro, em cartão, porque é o
        caminho de nove em cada dez vezes e não pode custar um clique a mais.
      -->
      <div class="documentos__grade">
        <article v-for="documento in sugeridos" :key="documento.id" class="documento">
          <span class="documento__icone" aria-hidden="true"><i :class="documento.icone" /></span>

          <div class="documento__corpo">
            <strong>{{ t(`clinico.documentos.cartao.${documento.id}.titulo`) }}</strong>
            <small>{{ t(`clinico.documentos.cartao.${documento.id}.descricao`) }}</small>
            <small v-if="documento.detalhe" class="documento__detalhe">{{ documento.detalhe }}</small>
          </div>

          <Button
            fluid
            icon="ph ph-printer"
            size="small"
            severity="secondary"
            outlined
            :label="t('clinico.documentos.emitir')"
            @click="emit('emitir', documento.id)"
          />
        </article>
      </div>

      <!--
        O resto atrás de uma dobra. Lista densa em vez de cartão: são onze, e onze cartões
        empurram o resumo do atendimento para fora da tela — sendo que o resumo é o motivo de a
        etapa existir.
      -->
      <div class="outros">
        <Button
          type="button"
          class="outros__gatilho"
          severity="secondary"
          text
          size="small"
          :icon="outrosAbertos ? 'ph ph-caret-down' : 'ph ph-caret-right'"
          :label="t('clinico.documentos.outros', { contagem: totalDeOutros })"
          :aria-expanded="outrosAbertos"
          @click="outrosAbertos = !outrosAbertos"
        />

        <div v-if="outrosAbertos" class="outros__grupos">
          <section v-for="bloco in outros" :key="bloco.grupo" class="grupo">
            <h5 class="grupo__titulo clinic-label">
              {{ t(`clinico.documentos.grupo.${bloco.grupo}`) }}
            </h5>

            <ul class="grupo__lista">
              <li v-for="documento in bloco.documentos" :key="documento.id">
                <!--
                  A linha inteira é o botão: o alvo é a largura da lista, não um ícone de
                  impressora no fim dela.
                -->
                <Button
                  type="button"
                  class="linha"
                  text
                  fluid
                  :disabled="!documento.disponivel"
                  @click="emit('emitir', documento.id)"
                >
                  <i :class="documento.icone" class="linha__icone" aria-hidden="true" />
                  <span class="linha__corpo">
                    <strong>{{ t(`clinico.documentos.cartao.${documento.id}.titulo`) }}</strong>
                    <small>{{ t(`clinico.documentos.cartao.${documento.id}.descricao`) }}</small>
                  </span>
                  <i class="ph ph-printer linha__acao" aria-hidden="true" />
                </Button>
              </li>
            </ul>
          </section>
        </div>
      </div>

      <p class="documentos__nota">
        <i class="ph ph-info" aria-hidden="true" />
        {{ t('clinico.documentos.notaImpressao') }}
      </p>
    </section>
  </section>
</template>

<style scoped>
/*
 * A entrega no app é estado, não alerta: acento quando liberado, superfície neutra enquanto não.
 * O botão é a única coisa com peso de ação na faixa.
 */
.app {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--clinic-space-3);
  padding: var(--clinic-space-3);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-control);
  background: var(--clinic-surface);
}

.app--liberado {
  border-color: var(--clinic-accent);
  background: var(--clinic-accent-tint);
}

.app__icone {
  color: var(--clinic-faint);
  font-size: 1.1rem;
}

.app--liberado .app__icone {
  color: var(--clinic-accent-strong);
}

.app__corpo {
  display: grid;
  flex: 1 1 18rem;
  gap: 2px;
  min-width: 0;
}

.app__corpo h4,
.app__corpo p {
  margin: 0;
}

.app__corpo p {
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
}

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

/* ------------------------------------------------------------- outros documentos */

.outros {
  display: grid;
  gap: var(--clinic-space-3);
}

/*
 * A dobra se lê como rótulo de seção (caixa alta, apagado), não como botão de ação. A
 * especificidade passa a regra global da clínica para botão secundário de texto.
 */
.outros__gatilho.p-button {
  justify-self: start;
  gap: 0.35rem;
  padding: 0.2rem 0.35rem;
  font-size: var(--clinic-font-label);
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.outros__gatilho.p-button.p-button-secondary.p-button-text {
  color: var(--clinic-muted);
}

.outros__gatilho.p-button :deep(.p-button-label) {
  font-weight: 750;
}

.outros__gatilho.p-button :deep(.p-button-icon) {
  font-size: 0.6rem;
}

.outros__grupos {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 17rem), 1fr));
  gap: var(--clinic-space-4);
}

.grupo__titulo {
  margin: 0 0 var(--clinic-space-2);
}

.grupo__lista {
  display: grid;
  gap: 0.15rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

/*
 * Linha densa: um documento ocupa a altura de duas linhas de texto, não a de um cartão. É o que
 * permite onze caberem sem rolagem e sem esconder o resumo.
 */
.linha.p-button {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--clinic-space-3);
  padding: var(--clinic-space-2) var(--clinic-space-3);
  border: 1px solid transparent;
  border-radius: var(--clinic-radius-control);
  color: inherit;
  font: inherit;
  text-align: start;
}

.linha.p-button:not(:disabled):hover,
.linha.p-button:not(:disabled):active {
  border-color: var(--clinic-line);
  background: var(--clinic-surface-soft);
  color: inherit;
}

/* Indisponível fica apagado no lugar, sem o fundo rebaixado que a camada global dá ao botão. */
.linha.p-button:disabled {
  border-color: transparent;
  background: transparent;
  color: inherit;
  cursor: not-allowed;
  opacity: 0.45;
}

.linha__icone {
  color: var(--clinic-accent-strong);
  font-size: 0.8rem;
}

.linha__corpo {
  display: grid;
  min-width: 0;
  gap: 0.05rem;
}

.linha__corpo strong {
  font-size: var(--clinic-font-base);
  font-weight: 700;
}

.linha__corpo small {
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
  line-height: 1.35;
}

/* O ícone de impressora só aparece no alvo focado: em onze linhas viraria textura. */
.linha__acao {
  color: var(--clinic-faint);
  font-size: 0.75rem;
  opacity: 0;
  transition: opacity 120ms ease;
}

.linha:hover .linha__acao,
.linha:focus-visible .linha__acao {
  opacity: 1;
}

@media (hover: none) {
  .linha__acao {
    opacity: 1;
  }
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
