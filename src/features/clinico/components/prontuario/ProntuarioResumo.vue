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
 *
 * ## A forma (redesenho total, 19/10/2026)
 *
 * Três folhas, na ordem em que se fecha uma consulta: o **registro** (uma ficha de leitura,
 * rótulo à esquerda e valor à direita), a **entrega no app** (uma linha de estado com a única
 * decisão ativa) e os **documentos** — os que este atendimento implica numa lista do kit, cada um
 * com "Imprimir" na ponta; o resto atrás de uma dobra, agrupado por quem recebe o papel.
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
  <section class="resumo">
    <!-- ------------------------------------------------------------- o registro -->
    <article class="registro ui-folha" aria-labelledby="resumo-registro-titulo">
      <header class="registro__topo">
        <h3 id="resumo-registro-titulo" class="titulo">
          {{ t('clinico.prontuario.resumo.titulo') }}
        </h3>
        <p class="descricao">{{ t('clinico.prontuario.resumo.descricao') }}</p>
      </header>

      <!-- Pendência que impede um documento de circular vem antes do documento. -->
      <ul v-if="pendencias.length > 0" class="pendencias">
        <li v-for="item in pendencias" :key="`pendencia-${item.id}`">
          <ClinicAlertChip
            severidade="risco"
            :rotulo="t('clinico.prontuario.resumo.alergiaPendente', { medicamento: item.nome })"
          />
        </li>
      </ul>

      <dl class="ficha">
        <div class="ficha__linha">
          <dt>{{ t('clinico.prontuario.impressao.dataAtendimento') }}</dt>
          <dd>{{ formato.dataLonga(dataDoAtendimento) }}</dd>
        </div>

        <div class="ficha__linha">
          <dt>{{ t('clinico.prontuario.anamnese.queixaPrincipal') }}</dt>
          <dd :class="{ 'ficha__vazio': !encounter.anamnese.queixaPrincipal }">
            {{ encounter.anamnese.queixaPrincipal || t('clinico.prontuario.resumo.vazio') }}
          </dd>
        </div>

        <div class="ficha__linha">
          <dt>{{ t('clinico.prontuario.diagnostico.titulo') }}</dt>
          <dd v-if="encounter.diagnosticos.length > 0" class="ficha__lista">
            <span v-for="item in encounter.diagnosticos" :key="item.codigo" class="diagnostico">
              <strong>{{ clinico.descricaoDoDiagnostico(item) }}</strong>
              <span class="ui-selo ui-selo--contorno">
                {{ t(`clinico.prontuario.diagnostico.tipo.${item.kind}`) }}
              </span>
            </span>
          </dd>
          <dd v-else class="ficha__vazio">{{ t('clinico.prontuario.resumo.vazio') }}</dd>
        </div>

        <div v-if="vitaisAlterados.length > 0 || sistemasAlterados.length > 0" class="ficha__linha">
          <dt>{{ t('clinico.prontuario.resumo.achados') }}</dt>
          <dd class="ficha__achados">
            <span
              v-for="vital in vitaisAlterados"
              :key="vital.vital"
              class="ui-selo ui-selo--risco"
            >
              <i
                :class="vital.status === 'acima' ? 'ph ph-arrow-up' : 'ph ph-arrow-down'"
                aria-hidden="true"
              />
              {{ vital.rotulo }} <span class="ui-num">{{ vital.valor }}</span>
            </span>
            <span
              v-for="sistema in sistemasAlterados"
              :key="sistema.chave"
              class="ui-selo ui-selo--atencao achado"
            >
              {{ sistema.rotulo }}<template v-if="sistema.nota">: {{ sistema.nota }}</template>
            </span>
          </dd>
        </div>

        <div class="ficha__linha">
          <dt>{{ t('clinico.prontuario.conduta.prescricoes') }}</dt>
          <dd v-if="prescricoes.length > 0" class="ficha__lista">
            <span v-for="item in prescricoes" :key="item.id" class="prescricao">
              <span class="prescricao__nome">
                <strong>{{ item.nome }}</strong>
                <span v-if="item.controlado" class="ui-selo ui-selo--atencao">
                  {{ t('clinico.bulario.controlado') }}
                </span>
              </span>
              <span class="prescricao__dose ui-num">{{ item.resumo }}</span>
            </span>
          </dd>
          <dd v-else class="ficha__vazio">{{ t('clinico.prontuario.resumo.vazio') }}</dd>
        </div>

        <div v-if="exames.length > 0" class="ficha__linha">
          <dt>{{ t('clinico.prontuario.conduta.exames') }}</dt>
          <dd>{{ exames.join(' · ') }}</dd>
        </div>

        <div v-if="encounter.conduta.retorno.emDias !== null" class="ficha__linha">
          <dt>{{ t('clinico.prontuario.conduta.retorno') }}</dt>
          <dd class="ui-num">
            {{
              t(
                'clinico.formato.dias',
                { valor: encounter.conduta.retorno.emDias },
                encounter.conduta.retorno.emDias,
              )
            }}
          </dd>
        </div>
      </dl>
    </article>

    <!--
      O que o responsável recebe no app. Fica antes dos documentos porque é a entrega que não
      depende de papel — e a única que o vet precisa decidir ativamente.
    -->
    <section class="app ui-folha" :class="`app--${noApp.estado}`" aria-labelledby="resumo-app-titulo">
      <span class="app__icone" aria-hidden="true">
        <i :class="noApp.estado === 'liberado' ? 'ph ph-check-circle' : 'ph ph-device-mobile'" />
      </span>
      <div class="app__corpo">
        <h3 id="resumo-app-titulo" class="app__titulo">
          {{ t('clinico.prontuario.resumo.app.titulo') }}
        </h3>
        <p>{{ noApp.texto }}</p>
      </div>
      <Button
        v-if="noApp.estado === 'pronto'"
        type="button"
        :label="t('clinico.prontuario.resumo.app.liberar')"
        icon="ph ph-paper-plane-tilt"
        size="small"
        severity="secondary"
        outlined
        @click="emit('liberarResumo')"
      />
    </section>

    <!-- --------------------------------------------------------------- documentos -->
    <section class="documentos" aria-labelledby="resumo-documentos-titulo">
      <header class="documentos__topo">
        <h3 id="resumo-documentos-titulo" class="titulo">
          {{ t('clinico.documentos.titulo') }}
        </h3>
        <p class="descricao">{{ t('clinico.documentos.ajuda') }}</p>
      </header>

      <!--
        Sugeridos: o que **este** atendimento implica. Três ou quatro, porque é o caminho de nove
        em cada dez vezes e não pode custar um clique a mais.
      -->
      <ul class="ui-folha ui-lista">
        <li v-for="documento in sugeridos" :key="documento.id" class="documento">
          <span class="documento__icone" aria-hidden="true"><i :class="documento.icone" /></span>

          <span class="ui-linha__texto">
            <strong class="ui-linha__titulo">
              {{ t(`clinico.documentos.cartao.${documento.id}.titulo`) }}
            </strong>
            <span class="ui-linha__meta documento__meta">
              {{ t(`clinico.documentos.cartao.${documento.id}.descricao`) }}
            </span>
            <span v-if="documento.detalhe" class="documento__detalhe">
              {{ documento.detalhe }}
            </span>
          </span>

          <Button
            type="button"
            icon="ph ph-printer"
            size="small"
            severity="secondary"
            outlined
            :label="t('clinico.prontuario.nova.documentos.imprimir')"
            :aria-label="`${t('clinico.prontuario.nova.documentos.imprimir')}: ${t(`clinico.documentos.cartao.${documento.id}.titulo`)}`"
            @click="emit('emitir', documento.id)"
          />
        </li>
      </ul>

      <!--
        O resto atrás de uma dobra, agrupado por quem recebe o papel. São onze; à vista, eles
        empurrariam o resumo do atendimento para fora da tela — sendo que o resumo é o motivo de
        a etapa existir.
      -->
      <div class="outros">
        <button
          type="button"
          class="outros__gatilho"
          :aria-expanded="outrosAbertos"
          aria-controls="resumo-outros-documentos"
          @click="outrosAbertos = !outrosAbertos"
        >
          <i :class="outrosAbertos ? 'ph ph-caret-down' : 'ph ph-caret-right'" aria-hidden="true" />
          {{ t('clinico.documentos.outros', { contagem: totalDeOutros }) }}
        </button>

        <div v-show="outrosAbertos" id="resumo-outros-documentos" class="outros__grupos">
          <section v-for="bloco in outros" :key="bloco.grupo" class="grupo">
            <h4 class="grupo__titulo">{{ t(`clinico.documentos.grupo.${bloco.grupo}`) }}</h4>

            <ul class="ui-folha ui-lista">
              <li v-for="documento in bloco.documentos" :key="documento.id">
                <!--
                  A linha inteira é o botão: o alvo é a largura da lista, não um ícone de
                  impressora no fim dela.
                -->
                <button
                  type="button"
                  class="ui-linha linha"
                  :disabled="!documento.disponivel"
                  @click="emit('emitir', documento.id)"
                >
                  <i :class="documento.icone" class="linha__icone" aria-hidden="true" />
                  <span class="ui-linha__texto">
                    <strong class="ui-linha__titulo">
                      {{ t(`clinico.documentos.cartao.${documento.id}.titulo`) }}
                    </strong>
                    <span class="ui-linha__meta linha__meta">
                      {{ t(`clinico.documentos.cartao.${documento.id}.descricao`) }}
                    </span>
                  </span>
                  <i class="ph ph-printer linha__acao" aria-hidden="true" />
                </button>
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
.resumo {
  display: grid;
  min-width: 0;
  gap: 20px;
}

.titulo {
  margin: 0;
  color: var(--tinta);
  font-size: 17px;
  font-weight: 600;
  letter-spacing: -0.005em;
}

.descricao {
  max-width: 72ch;
  margin: 2px 0 0;
  color: var(--tinta-2);
  font-size: 13.5px;
  line-height: 1.5;
}

/* ------------------------------------------------------------------ registro */

/*
 * O registro é a folha da etapa Resumo: o cabeçalho com o ladrilho do número da etapa (o mesmo
 * `--etapa-numero` que a página dá às outras folhas), um fio suave e a ficha embaixo.
 */
.registro {
  display: grid;
  gap: 14px;
  padding: 0 24px 10px;
}

.registro__topo {
  position: relative;
  display: grid;
  min-height: 40px;
  align-content: center;
  margin-inline: -24px;
  padding: 18px 22px 16px 76px;
  border-bottom: 1px solid var(--linha-suave);
}

.registro__topo::before {
  position: absolute;
  top: 50%;
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  border-radius: 12px;
  background: var(--pj-lugar-fundo, var(--clinica-fundo));
  color: var(--pj-lugar-tinta, var(--clinica-tinta));
  content: var(--etapa-numero, '');
  font-family: var(--font-dados);
  font-size: 17px;
  font-variant-numeric: tabular-nums;
  font-weight: 650;
  inset-inline-start: 22px;
  transform: translateY(-50%);
}

.registro__topo .titulo {
  font-weight: 650;
}

.pendencias {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

/* A pendência não se corta em reticências: é a frase que impede o papel de circular. */
.pendencias li {
  min-width: 0;
  max-width: 100%;
}

.pendencias :deep(.chip) {
  height: auto;
  min-height: 26px;
  align-items: flex-start;
  padding-block: 4px;
  white-space: normal;
}

.pendencias :deep(.chip__texto) {
  overflow: visible;
}

.ficha {
  display: grid;
  margin: 0;
}

.ficha__linha {
  display: grid;
  align-items: baseline;
  gap: 4px 20px;
  padding: 12px 0;
  grid-template-columns: 11rem minmax(0, 1fr);
}

.ficha__linha + .ficha__linha {
  border-top: 1px solid var(--linha);
}

.ficha__linha dt {
  color: var(--tinta-2);
  font-size: 13px;
  font-weight: 550;
}

.ficha__linha dd {
  min-width: 0;
  margin: 0;
  color: var(--tinta);
  font-size: 14.5px;
  line-height: 1.5;
}

.ficha__vazio {
  color: var(--tinta-3) !important;
}

.ficha__lista {
  display: grid;
  gap: 8px;
}

.diagnostico,
.prescricao__nome {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
}

.diagnostico strong,
.prescricao__nome strong {
  font-weight: 600;
}

.prescricao {
  display: grid;
  gap: 2px;
}

.prescricao__dose {
  color: var(--tinta-2);
  font-size: 13.5px;
}

.ficha__achados {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.achado {
  height: auto;
  min-height: 24px;
  padding-block: 3px;
  white-space: normal;
}

/* ------------------------------------------------------------------ app */

/*
 * A entrega no app é estado, não alerta: neutra enquanto não sai, na cor do "pronto" quando
 * liberada. O botão é a única coisa com peso de ação na linha.
 */
.app {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 14px;
  padding: 14px 16px;
}

.app--liberado {
  border-color: color-mix(in oklab, var(--ok) 35%, var(--linha));
  background: color-mix(in oklab, var(--ok-fundo) 55%, var(--superficie));
}

.app__icone {
  display: grid;
  width: 40px;
  height: 40px;
  flex: none;
  place-items: center;
  border-radius: 12px;
  background: var(--superficie-2);
  color: var(--tinta-2);
  font-size: 20px;
}

.app--liberado .app__icone {
  background: var(--superficie);
  color: var(--ok-tinta);
}

.app__corpo {
  display: grid;
  min-width: 0;
  flex: 1 1 18rem;
  gap: 2px;
}

.app__titulo {
  margin: 0;
  color: var(--tinta);
  font-size: 15px;
  font-weight: 600;
}

.app__corpo p {
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
  line-height: 1.45;
}

/* ------------------------------------------------------------------ documentos */

.documentos {
  display: grid;
  gap: 12px;
}

.documento {
  display: flex;
  min-height: 64px;
  align-items: center;
  gap: 14px;
  padding: 10px 14px 10px 16px;
}

.documento__icone {
  display: grid;
  width: 38px;
  height: 38px;
  flex: none;
  place-items: center;
  border-radius: 11px;
  background: var(--pj-lugar-fundo);
  color: var(--pj-lugar-tinta);
  font-size: 19px;
}

.documento__meta,
.linha__meta {
  white-space: normal;
}

.documento__detalhe {
  color: var(--atencao-tinta);
  font-size: 12.5px;
  font-weight: 600;
}

.outros {
  display: grid;
  gap: 14px;
}

.outros__gatilho {
  display: inline-flex;
  min-height: 36px;
  align-items: center;
  justify-self: start;
  gap: 6px;
  padding: 0 10px 0 6px;
  border: 0;
  border-radius: 10px;
  background: none;
  color: var(--tinta-2);
  cursor: pointer;
  font: inherit;
  font-size: 14px;
  font-weight: 550;
}

.outros__gatilho:hover {
  background: var(--superficie-2);
  color: var(--tinta);
}

.outros__gatilho:focus-visible {
  outline: 2px solid var(--pj-lugar, var(--musgo));
  outline-offset: 2px;
}

.outros__grupos {
  display: grid;
  align-items: start;
  gap: 18px 20px;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr));
}

.grupo {
  display: grid;
  gap: 8px;
}

.grupo__titulo {
  margin: 0;
  color: var(--tinta);
  font-size: 14px;
  font-weight: 600;
}

.linha {
  min-height: 56px;
  gap: 12px;
  padding-inline: 14px;
}

.linha:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.linha:disabled:hover {
  background: transparent;
}

.linha__icone {
  color: var(--tinta-2);
  font-size: 18px;
}

/* A impressora só aparece no alvo da vez: em onze linhas viraria textura. */
.linha__acao {
  color: var(--tinta-3);
  font-size: 16px;
  opacity: 0;
  transition: opacity var(--pj-tempo-curto) ease;
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
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  color: var(--tinta-3);
  font-size: 13px;
  line-height: 1.45;
}

.documentos__nota .ph {
  margin-top: 2px;
}

@media (max-width: 640px) {
  .registro {
    padding: 0 16px 6px;
  }

  .registro__topo {
    margin-inline: -16px;
    padding: 16px 16px 14px 70px;
  }

  .registro__topo::before {
    inset-inline-start: 16px;
  }

  .ficha__linha {
    grid-template-columns: minmax(0, 1fr);
  }

  /* O botão desce para baixo do texto, alinhado com ele: espremido ao lado, o título quebrava letra a letra. */
  .documento {
    flex-wrap: wrap;
  }

  .documento .ui-linha__texto {
    flex-basis: calc(100% - 52px);
  }

  .documento :deep(.p-button) {
    margin-inline-start: 52px;
  }
}
</style>
