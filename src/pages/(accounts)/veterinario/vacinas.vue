<script setup lang="ts">
/**
 * Vacinas — o que foi aplicado, e quem falta chamar.
 *
 * São duas perguntas, e elas não se respondem na mesma lista. **Aplicadas** é registro: o que
 * saiu da geladeira, em quem, por quem e de que lote — a pergunta que aparece quando alguém
 * confere estoque, emite comprovante, ou a farmacovigilância pergunta por um lote.
 * **Em atraso** é fila de trabalho: quem chamar hoje.
 *
 * A chamada continua sendo o que faz esta tela valer dinheiro. **É a única consulta que a
 * clínica pode provocar** — todo o resto do módulo reage a algo que já aconteceu, e uma clínica
 * que não chama perde a visita para o pet shop da esquina. Por isso a contagem de atrasados
 * viaja no rótulo da própria aba: ela precisa ser lida sem trocar de tela, e os três cartões do
 * topo continuam no lugar nas duas abas.
 *
 * Dentro de **Em atraso**, os três recortes são as três conversas diferentes que a clínica tem:
 * **vencido** liga hoje, **a vencer** entra na semana, **série aberta** é filhote que sumiu no
 * meio — e esse último some de qualquer relatório que só olhe data de vencimento.
 *
 * A aba vive na URL, como a da internação: é o que permite mandar "olha a lista de atrasados"
 * por mensagem sem mandar junto a instrução de qual aba abrir.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { INTL_LOCALE, type Locale } from '@/i18n/locales'
import PartnerPageFrame from '@/components/parceiro/PartnerPageFrame.vue'
import ClinicAlertChip from '@/features/clinico/components/base/ClinicAlertChip.vue'
import ClinicDataTable from '@/features/clinico/components/base/ClinicDataTable.vue'
import ClinicFilterBar from '@/features/clinico/components/base/ClinicFilterBar.vue'
import ClinicStat from '@/features/clinico/components/base/ClinicStat.vue'
import ClinicToggleGroup from '@/features/clinico/components/base/ClinicToggleGroup.vue'
import type { GrupoDeFiltro } from '@/features/clinico/components/base/filter-types'
import type { AcaoDeLinha, ColunaTabela } from '@/features/clinico/components/base/table-types'
import { useClinicFormat } from '@/features/clinico/composables/useClinicFormat'
import {
  vacinaRepository,
  type AplicacaoNaLista,
  type ChamadaDeVacina,
} from '@/features/clinico/data/repositories'
import { diffDays } from '@/features/clinico/domain/clinic-time'
import { clinicClock, useClinicoStore } from '@/features/clinico/stores/clinico'

type Recorte = 'todos' | 'vencido' | 'proximo' | 'serie-incompleta'
type Aba = 'aplicadas' | 'atraso'

const ABAS: Aba[] = ['aplicadas', 'atraso']

/**
 * As janelas de tempo do filtro de aplicadas.
 *
 * Não é uma escolha de data livre de propósito: a pergunta real é sempre "o que saiu esta
 * semana / este mês / este ano", e um par de calendários custa quatro cliques para responder o
 * que três fichas respondem em um. Quem precisar de um intervalo exato tem a ordenação por data.
 */
const JANELAS = [30, 90, 365] as const

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const clinico = useClinicoStore()
const formato = useClinicFormat()

const aba = ref<Aba>('aplicadas')
const linhas = ref<ChamadaDeVacina[]>([])
const aplicacoes = ref<AplicacaoNaLista[]>([])
const carregando = ref(false)
const erro = ref('')
const recorte = ref<Recorte>('vencido')
const busca = ref('')
const filtros = ref<Record<string, string[]>>({})

async function carregar() {
  carregando.value = true
  erro.value = ''

  try {
    await clinico.carregar()

    const [chamada, historico] = await Promise.all([
      vacinaRepository.listaDeChamada(),
      vacinaRepository.aplicadas(),
    ])

    linhas.value = chamada
    aplicacoes.value = historico

    /** Sem nenhum vencido, abrir no recorte vazio esconderia o que existe. */
    if (porSituacao.value.vencido.length === 0) {
      recorte.value = 'todos'
    }
  } catch {
    erro.value = t('clinico.erros.agenda')
  } finally {
    carregando.value = false
  }
}

onMounted(() => {
  const daUrl = String(route.query.aba ?? '')

  if ((ABAS as string[]).includes(daUrl)) {
    aba.value = daUrl as Aba
  }

  void carregar()
})

/* A aba escolhida vira endereço — `replace` para não encher o histórico de voltas. */
watch(aba, (valor) => {
  void router.replace({ query: valor === 'aplicadas' ? {} : { aba: valor } })
})

const porSituacao = computed(() => ({
  vencido: linhas.value.filter((linha) => linha.situacao === 'vencido'),
  proximo: linhas.value.filter((linha) => linha.situacao === 'proximo'),
  'serie-incompleta': linhas.value.filter((linha) => linha.situacao === 'serie-incompleta'),
}))

const visiveis = computed(() =>
  recorte.value === 'todos' ? linhas.value : porSituacao.value[recorte.value],
)

const opcoesRecorte = computed(() => [
  {
    valor: 'vencido' as Recorte,
    rotulo: `${t('clinico.vacinas.situacao.vencido')} · ${porSituacao.value.vencido.length}`,
    tom: 'risco' as const,
  },
  {
    valor: 'proximo' as Recorte,
    rotulo: `${t('clinico.vacinas.situacao.proximo')} · ${porSituacao.value.proximo.length}`,
    tom: 'atencao' as const,
  },
  {
    valor: 'serie-incompleta' as Recorte,
    rotulo: `${t('clinico.vacinas.situacao.serie-incompleta')} · ${porSituacao.value['serie-incompleta'].length}`,
    tom: 'neutro' as const,
  },
  {
    valor: 'todos' as Recorte,
    rotulo: `${t('clinico.faltas.filtro.todas')} · ${linhas.value.length}`,
    tom: 'neutro' as const,
  },
])

// --------------------------------------------------------------------- aplicadas

const opcoesAba = computed(() => [
  {
    valor: 'aplicadas' as Aba,
    rotulo: `${t('clinico.vacinas.aba.aplicadas')} · ${aplicacoes.value.length}`,
    tom: 'neutro' as const,
  },
  {
    /*
     * A contagem viaja no rótulo porque o número de atrasados é o que faz a clínica trocar de
     * aba — e um selo que só aparece depois do clique chega tarde demais para provocar o clique.
     */
    valor: 'atraso' as Aba,
    rotulo: `${t('clinico.vacinas.aba.atraso')} · ${porSituacao.value.vencido.length}`,
    tom: porSituacao.value.vencido.length > 0 ? ('risco' as const) : ('neutro' as const),
  },
])

function semAcento(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
}

/** Dias inteiros desde a aplicação. É por este número que a janela do filtro corta. */
function diasDesde(aplicadaEm: string): number {
  return diffDays(clinicClock.dateOf(aplicadaEm), clinicClock.today())
}

function dentroDaJanela(aplicacao: AplicacaoNaLista, dias: number): boolean {
  return diasDesde(aplicacao.aplicadaEm) <= dias
}

/**
 * Os grupos do filtro: quando e qual.
 *
 * "Qual vacina" lista **só as que a clínica aplicou**, e não o catálogo inteiro: uma ficha com
 * contagem zero é uma ficha que só serve para esvaziar a lista, e o catálogo tem vacinas que
 * esta clínica talvez nunca tenha usado.
 */
const gruposDeFiltro = computed<GrupoDeFiltro[]>(() => {
  const vacinasUsadas = [...new Set(aplicacoes.value.map((item) => item.vacinaNome))].sort((a, b) =>
    a.localeCompare(b, INTL_LOCALE[locale.value as Locale]),
  )

  return [
    {
      id: 'janela',
      rotulo: t('clinico.vacinas.filtro.quando'),
      opcoes: JANELAS.map((dias) => ({
        valor: `janela:${dias}`,
        rotulo: t('clinico.vacinas.filtro.ultimosDias', { dias }, dias),
        contagem: aplicacoes.value.filter((item) => dentroDaJanela(item, dias)).length,
      })),
    },
    {
      id: 'vacina',
      rotulo: t('clinico.vacinas.colunaVacina'),
      opcoes: vacinasUsadas.map((nome) => ({
        valor: nome,
        rotulo: nome,
        contagem: aplicacoes.value.filter((item) => item.vacinaNome === nome).length,
      })),
    },
  ]
})

/**
 * A busca é a mesma que a recepção faz no balcão: paciente, responsável, vacina ou **lote**.
 *
 * O lote entra porque é a busca que ninguém faz até precisar — e quando precisa, é urgente:
 * chegou um alerta de lote e é preciso saber em quais animais ele entrou.
 */
const aplicadasVisiveis = computed(() => {
  const termo = semAcento(busca.value)
  const janelas = (filtros.value.janela ?? []).map((valor) => Number(valor.split(':')[1]))
  const vacinas = filtros.value.vacina ?? []

  return aplicacoes.value.filter((item) => {
    if (janelas.length > 0 && !janelas.some((dias) => dentroDaJanela(item, dias))) {
      return false
    }

    if (vacinas.length > 0 && !vacinas.includes(item.vacinaNome)) {
      return false
    }

    if (!termo) {
      return true
    }

    return [item.petNome, item.tutorNome, item.vacinaNome, item.lote].some((campo) =>
      semAcento(campo).includes(termo),
    )
  })
})

const colunasAplicadas = computed<ColunaTabela<AplicacaoNaLista>[]>(() => [
  {
    id: 'quando',
    rotulo: t('clinico.paciente.atos.colunaQuando'),
    largura: '9rem',
    ordenarPor: (linha) => linha.aplicadaEm,
    ordemInicial: 'desc',
  },
  {
    id: 'paciente',
    rotulo: t('clinico.pacientes.colunaPaciente'),
    largura: 'minmax(0, 1.3fr)',
    ordenarPor: (linha) => linha.petNome,
  },
  {
    id: 'vacina',
    rotulo: t('clinico.vacinas.colunaVacina'),
    largura: 'minmax(0, 1.3fr)',
    ordenarPor: (linha) => linha.vacinaNome,
  },
  {
    id: 'lote',
    rotulo: t('clinico.vacinas.lote'),
    largura: '9rem',
    ocultarEmTelaEstreita: true,
    ordenarPor: (linha) => linha.lote,
  },
  {
    id: 'quem',
    rotulo: t('clinico.paciente.atos.colunaQuem'),
    largura: 'minmax(0, 1fr)',
    ocultarEmTelaEstreita: true,
  },
])

function abrirPaciente(linha: AplicacaoNaLista) {
  void router.push(`/veterinario/paciente/${linha.petId}/historico`)
}

// --------------------------------------------------------------------- em atraso

const colunas = computed<ColunaTabela<ChamadaDeVacina>[]>(() => [
  {
    id: 'paciente',
    rotulo: t('clinico.pacientes.colunaPaciente'),
    largura: 'minmax(0, 1.4fr)',
    ordenarPor: (linha) => linha.petNome,
  },
  {
    id: 'vacina',
    rotulo: t('clinico.vacinas.colunaVacina'),
    largura: 'minmax(0, 1.4fr)',
    ordenarPor: (linha) => linha.vacinaNome,
  },
  {
    id: 'responsavel',
    rotulo: t('clinico.faltas.colunaResponsavel'),
    largura: 'minmax(0, 1.2fr)',
    ocultarEmTelaEstreita: true,
    ordenarPor: (linha) => linha.tutorNome,
  },
  {
    id: 'quando',
    rotulo: t('clinico.vacinas.colunaQuando'),
    largura: '10rem',
    numerico: true,
    /** Ordena pelo atraso real, não pelo texto "há 40 dias" que a célula escreve. */
    ordenarPor: (linha) => linha.diasParaVencer,
    ordemInicial: 'asc',
  },
])

/**
 * As duas ações que a lista de chamada precisa ter, e nenhuma a mais.
 *
 * Ligar é o que a pessoa vai fazer em nove de dez linhas; agendar é o desfecho. Qualquer coisa
 * além disso transforma uma fila de trabalho num painel de administração.
 */
const acoes = computed<AcaoDeLinha<ChamadaDeVacina>[]>(() => [
  {
    id: 'ligar',
    rotulo: t('clinico.vacinas.ligar'),
    icone: 'pi pi-phone',
    visivel: (linha) => Boolean(linha.tutorTelefone),
  },
  {
    id: 'agendar',
    rotulo: t('clinico.vacinas.agendar'),
    icone: 'pi pi-calendar-plus',
  },
])

function executarAcao({
  acao,
  linha,
}: {
  acao: AcaoDeLinha<ChamadaDeVacina>
  linha: ChamadaDeVacina
}) {
  if (acao.id === 'ligar') {
    window.location.href = `tel:${linha.tutorTelefone}`

    return
  }

  /* Leva à agenda já no paciente: a recepção escolhe o horário olhando a grade. */
  void router.push({ path: '/veterinario/agenda' })
}

/*
 * Vazio é vazio nas **duas** listas.
 *
 * Antes, sem ninguém para chamar, a tela inteira virava o estado vazio — e escondia junto o
 * registro do que a clínica aplicou, que continua existindo. Uma clínica em dia com os reforços
 * é a melhor notícia possível, e não pode apagar a própria carteira.
 */
const vazio = computed(
  () =>
    !carregando.value && !erro.value && linhas.value.length === 0 && aplicacoes.value.length === 0,
)

/** Minutos de agenda que a chamada pode recuperar, a 20 min por aplicação. */
const potencial = computed(() => linhas.value.length * 20)
</script>

<template>
  <PartnerPageFrame
    :subtitle="t('clinico.vacinas.subtitulo')"
    :title="t('clinico.vacinas.titulo')"
    :loading="carregando && linhas.length === 0"
    :error="erro"
    :empty="vazio"
    :empty-title="t('clinico.vacinas.vazioTitulo')"
    :empty-description="t('clinico.vacinas.vazioDescricao')"
    block-when-suspended
    @retry="carregar"
  >
    <div class="vacinas clinic-scope">
      <!--
        Os três números que dizem o tamanho da oportunidade antes de a tabela ser lida. O
        terceiro é o argumento comercial: chamada não é tarefa, é agenda que volta a encher.
      -->
      <div class="resumo">
        <ClinicStat
          icone="pi pi-exclamation-circle"
          tom="risco"
          :rotulo="t('clinico.vacinas.situacao.vencido')"
          :valor="String(porSituacao.vencido.length)"
          :detalhe="t('clinico.vacinas.ligarHoje')"
        />
        <ClinicStat
          icone="pi pi-clock"
          tom="atencao"
          :rotulo="t('clinico.vacinas.situacao.proximo')"
          :valor="String(porSituacao.proximo.length)"
          :detalhe="t('clinico.vacinas.proximosDias')"
        />
        <ClinicStat
          icone="pi pi-calendar-plus"
          :rotulo="t('clinico.vacinas.potencial')"
          :valor="formato.duracao(potencial)"
          :detalhe="t('clinico.vacinas.potencialDetalhe')"
        />
      </div>

      <!--
        As duas perguntas da tela, lado a lado.

        "Aplicadas" abre primeiro porque é a que se faz o dia inteiro — conferir, comprovar,
        rastrear lote. "Em atraso" carrega a contagem no rótulo: é o número que faz alguém
        trocar de aba, e ele precisa ser lido antes do clique, não depois.
      -->
      <div class="vacinas__abas">
        <ClinicToggleGroup
          v-model="aba"
          :opcoes="opcoesAba"
          :rotulo="t('clinico.vacinas.titulo')"
        />
      </div>

      <template v-if="aba === 'aplicadas'">
        <ClinicFilterBar
          v-model:busca="busca"
          v-model:selecionados="filtros"
          :grupos="gruposDeFiltro"
          :placeholder-busca="t('clinico.vacinas.buscar')"
          :resultado="aplicadasVisiveis.length"
        />

        <ClinicDataTable
          :colunas="colunasAplicadas"
          :linhas="aplicadasVisiveis"
          :chave="(linha) => linha.id"
          :carregando="carregando"
          :vazio-titulo="t('clinico.vacinas.aplicadasVazioTitulo')"
          :vazio-descricao="t('clinico.vacinas.aplicadasVazioDescricao')"
          :rotulo="t('clinico.vacinas.aba.aplicadas')"
          @ativar="abrirPaciente"
        >
          <template #celula-quando="{ linha }">
            <strong class="clinic-value">
              {{ formato.dataCurta(clinicClock.dateOf(linha.aplicadaEm)) }}
            </strong>
            <span class="vacinas__meta">
              {{ clinicClock.dateOf(linha.aplicadaEm).slice(0, 4) }}
            </span>
          </template>

          <template #celula-paciente="{ linha }">
            <strong class="vacinas__nome">{{ linha.petNome }}</strong>
            <span class="vacinas__meta">
              {{ formato.especie(linha.especie) }} · {{ linha.tutorNome }}
            </span>
          </template>

          <template #celula-vacina="{ linha }">
            <span class="vacinas__titulo">
              <span class="vacinas__nome">{{ linha.vacinaNome }}</span>
              <ClinicAlertChip
                v-if="linha.obrigatoria"
                severidade="atencao"
                :rotulo="t('clinico.vacinas.obrigatoria')"
              />
            </span>
            <span class="vacinas__meta">
              {{
                t('clinico.vacinas.doseDeTotal', { dose: linha.dose, total: linha.dosesNaSerie })
              }}
            </span>
          </template>

          <!--
            Lote e validade juntos, e nunca só o lote.

            É o par que a farmacovigilância pede e o que a companhia aérea confere no balcão —
            um sem o outro não responde a pergunta de nenhum dos dois.
          -->
          <template #celula-lote="{ linha }">
            <span class="vacinas__nome clinic-value">{{ linha.lote }}</span>
            <span class="vacinas__meta">
              {{ t('clinico.vacinas.validade', { data: formato.dataCurta(linha.validadeLote) }) }}
            </span>
          </template>

          <template #celula-quem="{ linha }">
            <span class="vacinas__nome">
              {{ clinico.profissional(linha.professionalId)?.nome }}
            </span>
            <span v-if="linha.observacao" class="vacinas__meta">{{ linha.observacao }}</span>
          </template>
        </ClinicDataTable>
      </template>

      <template v-else>
        <div class="vacinas__recorte">
          <ClinicToggleGroup
            v-model="recorte"
            :opcoes="opcoesRecorte"
            :rotulo="t('clinico.agenda.filtros')"
          />
        </div>

        <ClinicDataTable
          :colunas="colunas"
          :linhas="visiveis"
          :chave="(linha) => `${linha.petId}-${linha.vacinaId}`"
          :acoes="acoes"
          :vazio-titulo="t('clinico.vacinas.vazioTitulo')"
          :rotulo="t('clinico.vacinas.titulo')"
          @acao="executarAcao"
        >
          <template #celula-paciente="{ linha }">
            <strong class="vacinas__nome">{{ linha.petNome }}</strong>
            <span class="vacinas__meta">
              {{
                clinico.pet(linha.petId) ? formato.especie(clinico.pet(linha.petId)!.especie) : ''
              }}
            </span>
          </template>

          <template #celula-vacina="{ linha }">
            <span class="vacinas__titulo">
              <span class="vacinas__nome">{{ linha.vacinaNome }}</span>
              <!-- Obrigatória muda o tom da conversa: é exigência legal, não sugestão. -->
              <ClinicAlertChip
                v-if="linha.obrigatoria"
                severidade="atencao"
                :rotulo="t('clinico.vacinas.obrigatoria')"
              />
            </span>
            <span v-if="linha.doseSeguinte" class="vacinas__meta">
              {{ t('clinico.vacinas.doseSeguinte', { dose: linha.doseSeguinte }) }}
            </span>
          </template>

          <template #celula-responsavel="{ linha }">
            <span class="vacinas__nome">{{ linha.tutorNome }}</span>
            <span class="vacinas__meta">{{ linha.tutorTelefone }}</span>
          </template>

          <template #celula-quando="{ linha }">
            <strong
              class="vacinas__prazo clinic-value"
              :class="`vacinas__prazo--${linha.situacao}`"
            >
              {{
                linha.diasParaVencer < 0
                  ? t('clinico.vacinas.atrasadoDias', { dias: Math.abs(linha.diasParaVencer) })
                  : t('clinico.vacinas.emDias', { dias: linha.diasParaVencer })
              }}
            </strong>
            <span class="vacinas__meta">{{ formato.dataCurta(linha.proximaDoseEm) }}</span>
          </template>
        </ClinicDataTable>
      </template>
    </div>
  </PartnerPageFrame>
</template>

<style scoped>
.vacinas {
  display: grid;
  gap: var(--clinic-space-3);
}

.resumo {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 14rem), 1fr));
  gap: var(--clinic-space-3);
}

.vacinas__abas,
.vacinas__recorte {
  display: flex;
  justify-content: flex-start;
}

.vacinas__nome {
  display: block;
  overflow: hidden;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vacinas__titulo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--clinic-space-2);
}

.vacinas__meta {
  display: block;
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
}

.vacinas__prazo {
  display: block;
  font-size: 1rem;
  font-weight: 800;
}

/* O prazo carrega a urgência: vencido em risco, a vencer em atenção. Cor com a palavra ao lado. */
.vacinas__prazo--vencido {
  color: var(--clinic-risk-text);
}

.vacinas__prazo--proximo {
  color: var(--clinic-attention-text);
}
</style>
