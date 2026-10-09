<script setup lang="ts">
/**
 * Fila de espera.
 *
 * Existe para responder à pergunta que a agenda cheia não responde: "e quando abrir?". Cada
 * entrada guarda a janela que o responsável aceita, e é essa janela que decide quem cabe numa
 * vaga que acabou de vagar.
 *
 * A oferta tem prazo. Passado o prazo ela expira sozinha e a vaga volta a ser da clínica —
 * senão a fila vira lista de promessas que ninguém cobra.
 *
 * A ordem da lista é a ordem do trabalho: primeiro as ofertas esperando resposta (têm prazo
 * correndo), depois a fila pela posição, e por último o que já se resolveu. Antes as três vinham
 * misturadas, e a resposta da oferta era um ✓ e um ✗ soltos no fim da linha — agora vão por extenso.
 */
import Button from 'primevue/button'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import PartnerPageFrame from '@/components/parceiro/PartnerPageFrame.vue'
import ClinicAlertChip from '@/features/clinico/components/base/ClinicAlertChip.vue'
import ClinicPacienteCelula from '@/features/clinico/components/base/ClinicPacienteCelula.vue'
import ClinicDataTable from '@/features/clinico/components/base/ClinicDataTable.vue'
import FilaAdicionarDialog from '@/features/clinico/components/agenda/FilaAdicionarDialog.vue'
import FilaOfertaDialog from '@/features/clinico/components/agenda/FilaOfertaDialog.vue'
import type { AcaoDeLinha, ColunaTabela } from '@/features/clinico/components/base/table-types'
import { useClinicFormat } from '@/features/clinico/composables/useClinicFormat'
import type { WaitlistEntry } from '@/features/clinico/data/types'
import { agruparJanelas } from '@/features/clinico/domain/waitlist'
import { useAvisosStore } from '@/features/clinico/stores/avisos'
import { useFilaStore } from '@/features/clinico/stores/fila'
import { clinicClock, useClinicoStore } from '@/features/clinico/stores/clinico'

const { t } = useI18n()
const clinico = useClinicoStore()
const fila = useFilaStore()
const avisos = useAvisosStore()
const formato = useClinicFormat()

/**
 * O que o aceite fez, dito em uma linha. Marcado leva à agenda, que é onde a recepção confere o
 * horário; oferta vencida e vaga ocupada dizem o que aconteceu com o responsável, que é a
 * pergunta seguinte de quem está no telefone.
 */
const aceite = computed(() => {
  const resultado = fila.resultadoDoAceite

  if (!resultado) {
    return null
  }

  const paciente = clinico.pet(resultado.petId)?.nome ?? ''

  if (resultado.tipo === 'marcado') {
    const { atendimento } = resultado

    return {
      tipo: resultado.tipo,
      texto: t('clinico.fila.aceite.marcado', {
        paciente,
        data: formato.dataCurta(clinicClock.dateOf(atendimento.inicio)),
        hora: formato.hora(atendimento.inicio),
        profissional: clinico.profissional(atendimento.professionalId)?.nome ?? '',
      }),
      rota: `/veterinario/agenda?data=${clinicClock.dateOf(atendimento.inicio)}&foco=${atendimento.id}`,
    }
  }

  return {
    tipo: resultado.tipo,
    texto:
      resultado.tipo === 'oferta-expirada'
        ? t('clinico.fila.aceite.ofertaExpirada', { paciente })
        : t('clinico.fila.aceite.vagaPreenchida', { paciente }),
    rota: null,
  }
})

/**
 * A coluna de ações saiu daqui.
 *
 * Antes era uma coluna `acoes` de 13 rem com os botões montados à mão no slot, e cada tela que
 * fazia isso reinventava largura, alinhamento e o `@click.stop` que impede o clique na ação de
 * também selecionar a linha. Agora as ações são contrato da tabela (`:acoes`), e a coluna
 * nasce do número delas.
 */
const colunas = computed<ColunaTabela<WaitlistEntry>[]>(() => [
  {
    /*
     * A posição é a primeira coluna porque é a primeira pergunta: "sou o quantos?". Quem já
     * recebeu oferta não tem posição — o horário dele está reservado, e contá-lo empurraria a
     * fila inteira para trás por algo já resolvido.
     */
    id: 'posicao',
    rotulo: t('clinico.fila.colunaPosicao'),
    largura: '4.5rem',
    numerico: true,
    ordenarPor: (linha) => fila.posicaoDe(linha.id),
    ordemInicial: 'asc',
  },
  {
    id: 'paciente',
    rotulo: t('clinico.pacientes.colunaPaciente'),
    largura: 'minmax(0, 2.1fr)',
    ordenarPor: (linha) => clinico.pet(linha.petId)?.nome ?? null,
  },
  {
    id: 'responsavel',
    rotulo: t('clinico.pacientes.colunaResponsavel'),
    largura: 'minmax(0, 1.1fr)',
    ocultarEmTelaEstreita: true,
    ordenarPor: (linha) => clinico.tutor(linha.tutorId)?.nome ?? null,
  },
  {
    id: 'janelas',
    rotulo: t('clinico.fila.janelas'),
    largura: 'minmax(0, 1.4fr)',
    /** Ordena pela espera, que é o que a coluna realmente comunica. */
    ordenarPor: (linha) => linha.criadoEm,
  },
  {
    id: 'situacao',
    rotulo: t('clinico.fila.colunaSituacao'),
    largura: '9rem',
    ordenarPor: (linha) => linha.status,
  },
])

/**
 * As três ações da fila.
 *
 * Aceitar e recusar só existem para quem recebeu oferta; remover, só para quem ainda aguarda.
 * Elas **somem** quando não cabem, em vez de aparecerem apagadas: ícone desabilitado numa
 * tabela de vinte linhas é ruído que não vira ação nunca.
 */
const acoes = computed<AcaoDeLinha<WaitlistEntry>[]>(() => [
  {
    id: 'aceitar',
    rotulo: t('clinico.fila.aceitar'),
    visivel: (linha) => linha.status === 'ofertado',
  },
  {
    id: 'recusar',
    rotulo: t('clinico.fila.recusar'),
    visivel: (linha) => linha.status === 'ofertado',
  },
  {
    id: 'remover',
    rotulo: t('clinico.fila.remover'),
    icone: 'ph ph-trash',
    perigo: true,
    visivel: (linha) => linha.status === 'aguardando',
  },
])

const paraOfertar = ref<WaitlistEntry | null>(null)
const adicionarAberto = ref(false)

function executarAcao({ acao, linha }: { acao: AcaoDeLinha<WaitlistEntry>; linha: WaitlistEntry }) {
  if (acao.id === 'aceitar') {
    void fila.responder(linha.id, true)

    return
  }

  if (acao.id === 'recusar') {
    void fila.responder(linha.id, false)

    return
  }

  if (acao.id === 'remover') {
    void fila.remover(linha.id)
  }
}

const severidadePorPrioridade = {
  urgente: 'risco',
  preferencial: 'atencao',
  normal: 'info',
} as const

/**
 * Dia da semana pelo `Intl` do idioma da tela: abreviação fixa em português vazava para todo
 * idioma. Dias seguidos com o mesmo horário saem numa faixa só ("seg.–sex. 14:00–18:00").
 */
function janelasLegiveis(entrada: WaitlistEntry) {
  return agruparJanelas(entrada.janelas).map((faixa) => {
    const de = formato.diaDaSemanaCurtoPorIndice(faixa.de)
    const dias =
      faixa.de === faixa.ate ? de : `${de}–${formato.diaDaSemanaCurtoPorIndice(faixa.ate)}`

    return `${dias} ${faixa.inicio}–${faixa.fim}`
  })
}

async function confirmarOferta({ mensagem }: { mensagem: string }) {
  const entrada = paraOfertar.value
  const vaga = fila.vagaAberta

  if (!entrada || !vaga) {
    return
  }

  await fila.ofertar(entrada.id, vaga.inicio, vaga.professionalId)

  /* O texto ofertado vira comprovante, como o da remarcação e o do reagendamento. */
  avisos.registrar({
    appointmentId: entrada.id,
    tutorId: entrada.tutorId,
    kind: 'oferta-de-vaga',
    texto: mensagem,
  })

  paraOfertar.value = null
}

const erroTraduzido = computed(() => (fila.erro ? t(fila.erro) : ''))

/** Peso de cada situação na ordem da lista: o que tem prazo correndo vem primeiro. */
const ORDEM_DA_SITUACAO: Record<string, number> = {
  ofertado: 0,
  aguardando: 1,
  aceito: 2,
  expirado: 3,
}

const linhasOrdenadas = computed(() =>
  [...fila.ativas].sort((a, b) => {
    const porSituacao = (ORDEM_DA_SITUACAO[a.status] ?? 9) - (ORDEM_DA_SITUACAO[b.status] ?? 9)

    if (porSituacao !== 0) {
      return porSituacao
    }

    if (a.status === 'aguardando') {
      return (fila.posicaoDe(a.id) ?? 0) - (fila.posicaoDe(b.id) ?? 0)
    }

    /* Entre as ofertas, a que expira primeiro vem antes: é a que se perde se ninguém ligar. */
    if (a.status === 'ofertado') {
      return (a.ofertaExpiraEm ?? '').localeCompare(b.ofertaExpiraEm ?? '')
    }

    return a.criadoEm.localeCompare(b.criadoEm)
  }),
)

/** Quantos esperam vaga e quantas ofertas esperam resposta. */
const fraseDoResumo = computed(() => {
  if (fila.carregando && fila.entradas.length === 0) {
    return ''
  }

  const aguardando = fila.ativas.filter((item) => item.status === 'aguardando').length
  const ofertas = fila.ofertadas.length
  const partes = [t('clinico.fila.saudacao.aguardando', { n: aguardando }, aguardando)]

  if (ofertas > 0) {
    partes.push(t('clinico.fila.saudacao.ofertas', { n: ofertas }, ofertas))
  }

  return partes.join(' · ')
})

async function carregar() {
  await clinico.carregar()
  await fila.carregar()
}

onMounted(carregar)
</script>

<template>
  <PartnerPageFrame
    class="hc-tema"
    :subtitle="t('clinico.fila.subtitulo')"
    :title="t('clinico.fila.titulo')"
    :loading="fila.carregando && fila.entradas.length === 0"
    :error="erroTraduzido"
    :empty="fila.vazio"
    :empty-title="t('clinico.fila.vazioTitulo')"
    :empty-description="t('clinico.fila.vazioDescricao')"
    block-when-suspended
    @retry="carregar"
  >
    <!--
      A entrada na fila é a pílula cheia da saudação: é a ação que a recepção dispara quando acaba
      de dizer "não tenho horário essa semana".
    -->
    <template #cabecalho>
      <div class="hc-saudacao">
        <p class="hc-saudacao__data">{{ t('clinico.fila.subtitulo') }}</p>
        <h1 class="hc-saudacao__titulo">{{ t('clinico.fila.titulo') }}</h1>

        <div class="hc-saudacao__linha">
          <p v-if="fraseDoResumo" class="hc-saudacao__resumo" aria-live="polite">
            {{ fraseDoResumo }}
          </p>

          <nav class="hc-acoes" :aria-label="t('clinico.fila.saudacao.acoes')">
            <Button
              type="button"
              class="hc-pilula hc-pilula--cheia"
              icon="ph ph-plus"
              :label="t('clinico.fila.adicionar')"
              @click="adicionarAberto = true"
            />
          </nav>
        </div>
      </div>
    </template>

    <div class="fila clinic-scope">
      <p v-if="aceite" class="aceite" :class="`aceite--${aceite.tipo}`" role="status">
        <i
          class="ph"
          :class="aceite.tipo === 'marcado' ? 'ph-check-circle' : 'ph-info'"
          aria-hidden="true"
        />
        <span class="aceite__texto">{{ aceite.texto }}</span>
        <RouterLink v-if="aceite.rota" class="aceite__link clinic-focusable" :to="aceite.rota">
          {{ t('clinico.fila.aceite.verNaAgenda') }}
          <i class="ph ph-arrow-right" aria-hidden="true" />
        </RouterLink>
        <Button
          icon="ph ph-x"
          severity="secondary"
          text
          rounded
          size="small"
          :aria-label="t('clinico.fila.aceite.dispensar')"
          @click="fila.dispensarResultadoDoAceite()"
        />
      </p>

      <ClinicDataTable
        :colunas="colunas"
        :linhas="linhasOrdenadas"
        :chave="(entrada) => entrada.id"
        :acoes="acoes"
        :rotulo="t('clinico.fila.titulo')"
        @acao="executarAcao"
      >
        <template #celula-posicao="{ linha }">
          <strong v-if="fila.posicaoDe(linha.id)" class="fila__posicao">
            {{ fila.posicaoDe(linha.id) }}
          </strong>
          <span v-else class="fila__meta">—</span>
        </template>

        <template #celula-paciente="{ linha }">
          <ClinicPacienteCelula :pet="clinico.pet(linha.petId)">
            <!--
              "Normal" é o padrão e não precisa ser dito: uma ficha em toda linha treina o olho
              a ignorar as fichas, inclusive as que importam.
            -->
            <template #selo>
              <ClinicAlertChip
                v-if="linha.prioridade !== 'normal'"
                :severidade="severidadePorPrioridade[linha.prioridade]"
                :rotulo="formato.prioridadeDaFila(linha.prioridade)"
              />
            </template>
            {{ clinico.tipo(linha.typeId)?.nome }}
            <template v-if="linha.professionalId">
              · {{ clinico.profissional(linha.professionalId)?.nome }}
            </template>
          </ClinicPacienteCelula>
        </template>

        <template #celula-responsavel="{ linha }">
          <span class="fila__nome">{{ clinico.tutor(linha.tutorId)?.nome }}</span>
          <span class="fila__meta"
            ><bdi dir="ltr">{{ clinico.tutor(linha.tutorId)?.telefone }}</bdi></span
          >
        </template>

        <template #celula-janelas="{ linha }">
          <!-- Quebra só entre janelas: "qua." numa linha e "14:00–18:00" na outra não se lê. -->
          <span class="fila__janela">
            <template v-for="(faixa, indice) in janelasLegiveis(linha)" :key="indice">
              <template v-if="indice > 0"> · </template>
              <span class="fila__faixa">{{ faixa }}</span>
            </template>
          </span>
          <span class="fila__meta">
            {{ t('clinico.fila.esperaDesde', { valor: formato.relativo(linha.criadoEm) }) }}
          </span>
        </template>

        <template #celula-situacao="{ linha }">
          <span class="fila__situacao" :class="`fila__situacao--${linha.status}`">
            {{ t(`clinico.fila.situacao.${linha.status}`) }}
          </span>
          <span
            v-if="linha.status === 'ofertado' && linha.ofertaExpiraEm"
            class="fila__prazo clinic-value"
            :class="{ 'fila__prazo--curto': (fila.minutosParaExpirar(linha) ?? 0) <= 5 }"
          >
            {{
              t('clinico.fila.ofertaExpiraEm', {
                valor: formato.relativo(linha.ofertaExpiraEm),
              })
            }}
          </span>
          <!-- Aceito é horário marcado: a linha diz qual, para ninguém precisar abrir a agenda. -->
          <span
            v-else-if="linha.status === 'aceito' && linha.ofertaSlotInicio"
            class="fila__prazo fila__prazo--marcado clinic-value"
          >
            {{
              t('clinico.fila.marcadoPara', {
                data: formato.dataCurta(clinicClock.dateOf(linha.ofertaSlotInicio)),
                hora: formato.hora(linha.ofertaSlotInicio),
              })
            }}
          </span>
        </template>
      </ClinicDataTable>

      <!--
        Oferta de vaga aparece quando a agenda avisa que um horário vagou. Fica na própria
        página da fila e também sobre a agenda, porque é lá que a vaga costuma nascer.
      -->
      <section v-if="fila.vagaAberta" class="vaga" role="status">
        <div>
          <strong>{{ t('clinico.fila.vagaAberta.titulo') }}</strong>
          <p>
            {{
              t('clinico.fila.vagaAberta.descricao', {
                hora: formato.hora(fila.vagaAberta.inicio),
                profissional: clinico.profissional(fila.vagaAberta.professionalId)?.nome ?? '',
              })
            }}
          </p>
        </div>

        <ul class="vaga__candidatos">
          <li v-for="candidato in fila.vagaAberta.candidatos" :key="candidato.id">
            <Button
              :label="
                t('clinico.fila.vagaAberta.oferecer', {
                  paciente: clinico.pet(candidato.petId)?.nome ?? '',
                })
              "
              size="small"
              :loading="fila.salvando"
              @click="paraOfertar = candidato"
            />
          </li>
        </ul>

        <Button
          :label="t('clinico.fila.vagaAberta.depois')"
          severity="secondary"
          text
          size="small"
          @click="fila.dispensarVaga()"
        />
      </section>
    </div>

    <FilaAdicionarDialog v-model:visivel="adicionarAberto" @adicionado="fila.carregar()" />

    <!--
      A oferta passa por uma prévia, no mesmo padrão da remarcação: o requisito pede "a
      mensagem que sai", e disparar sem mostrar o texto é o que faz ninguém saber o que foi dito.
    -->
    <FilaOfertaDialog
      :entrada="paraOfertar"
      :slot-inicio="fila.vagaAberta?.inicio ?? null"
      @confirmar="confirmarOferta"
      @fechar="paraOfertar = null"
    />
  </PartnerPageFrame>
</template>

<style scoped>
.fila {
  display: grid;
  gap: var(--clinic-space-4);
}

.fila__barra {
  display: flex;
  justify-content: flex-end;
}

/* A posição é número de leitura rápida: peso e tabular, para comparar linhas de relance. */
.fila__posicao {
  display: block;
  font-size: 1.05rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.fila__nome {
  display: block;
  overflow: hidden;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fila__titulo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--clinic-space-2);
}

.fila__meta {
  display: block;
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
}

.fila__situacao {
  display: block;
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
  font-weight: 750;
}

.fila__situacao--ofertado {
  color: var(--clinic-accent-strong);
}

.fila__situacao--expirado,
.fila__situacao--removido {
  color: var(--clinic-faint);
}

.fila__janela {
  display: block;
  font-weight: 650;
}

.fila__faixa {
  white-space: nowrap;
}

.fila__prazo {
  display: block;
  color: var(--clinic-attention-text);
  font-size: var(--clinic-font-label);
  font-weight: 700;
}

.fila__prazo--curto {
  color: var(--clinic-risk-text);
}

.fila__prazo--marcado {
  color: var(--clinic-ok-text);
}

/*
 * O resultado do aceite é estado, não alerta: uma linha com borda de acento quando deu certo,
 * neutra quando a vaga escapou. Nenhum dos dois pede cor de risco — ninguém errou.
 */
.aceite {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  margin: 0;
  padding: var(--clinic-space-2) var(--clinic-space-3);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-control);
  gap: var(--clinic-space-2);
  background: var(--clinic-surface);
  font-size: var(--clinic-font-label);
  font-weight: 600;
}

.aceite--marcado {
  border-color: var(--clinic-accent);
  background: var(--clinic-accent-tint);
  color: var(--clinic-accent-strong);
}

.aceite__texto {
  flex: 1 1 16rem;
  min-width: 0;
}

.aceite__link {
  display: inline-flex;
  align-items: center;
  gap: var(--clinic-space-1);
  border-radius: var(--clinic-radius-control);
  color: var(--clinic-accent-strong);
  font-weight: 700;
  text-decoration: none;
}

.aceite__link:hover {
  text-decoration: underline;
}

.vaga {
  display: grid;
  gap: var(--clinic-space-3);
  padding: var(--clinic-space-4);
  border: 1px solid var(--clinic-accent);
  border-radius: var(--clinic-radius-card);
  background: var(--clinic-accent-tint);
}

.vaga strong {
  font-size: var(--clinic-font-title);
  font-weight: 750;
}

.vaga p {
  margin: 0.2rem 0 0;
  color: var(--clinic-muted);
  line-height: 1.5;
}

.vaga__candidatos {
  display: flex;
  flex-wrap: wrap;
  gap: var(--clinic-space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}
</style>
