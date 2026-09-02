<script setup lang="ts">
/**
 * Vacinas — a lista de chamada da clínica.
 *
 * **É a única consulta que a clínica pode provocar.** Todo o resto do módulo reage a algo que
 * já aconteceu — o animal adoeceu, o responsável ligou, o horário vagou. Aqui a clínica age
 * primeiro: sabe quem está vencido, liga, e a agenda enche.
 *
 * Uma clínica que não chama perde essa visita para o pet shop da esquina, e junto com ela a
 * consulta anual que costuma vir no mesmo dia. Por isso esta tela não é um relatório: é uma
 * fila de trabalho, ordenada do mais atrasado para o menos, com o telefone a um clique.
 *
 * Os três recortes são as três conversas diferentes que a clínica tem:
 * **vencido** liga hoje, **a vencer** entra na semana, **série aberta** é filhote que sumiu no
 * meio — e esse último some de qualquer relatório que só olhe data de vencimento.
 */
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import PartnerPageFrame from '@/components/parceiro/PartnerPageFrame.vue'
import ClinicAlertChip from '@/features/clinico/components/base/ClinicAlertChip.vue'
import ClinicDataTable from '@/features/clinico/components/base/ClinicDataTable.vue'
import ClinicStat from '@/features/clinico/components/base/ClinicStat.vue'
import ClinicToggleGroup from '@/features/clinico/components/base/ClinicToggleGroup.vue'
import type { AcaoDeLinha, ColunaTabela } from '@/features/clinico/components/base/table-types'
import { useClinicFormat } from '@/features/clinico/composables/useClinicFormat'
import { vacinaRepository, type ChamadaDeVacina } from '@/features/clinico/data/repositories'
import { useClinicoStore } from '@/features/clinico/stores/clinico'

type Recorte = 'todos' | 'vencido' | 'proximo' | 'serie-incompleta'

const { t } = useI18n()
const router = useRouter()
const clinico = useClinicoStore()
const formato = useClinicFormat()

const linhas = ref<ChamadaDeVacina[]>([])
const carregando = ref(false)
const erro = ref('')
const recorte = ref<Recorte>('vencido')

async function carregar() {
  carregando.value = true
  erro.value = ''

  try {
    await clinico.carregar()
    linhas.value = await vacinaRepository.listaDeChamada()

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

onMounted(carregar)

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

function executarAcao({ acao, linha }: { acao: AcaoDeLinha<ChamadaDeVacina>; linha: ChamadaDeVacina }) {
  if (acao.id === 'ligar') {
    window.location.href = `tel:${linha.tutorTelefone}`

    return
  }

  /* Leva à agenda já no paciente: a recepção escolhe o horário olhando a grade. */
  void router.push({ path: '/veterinario/agenda' })
}

const vazio = computed(() => !carregando.value && !erro.value && linhas.value.length === 0)

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
            {{ clinico.pet(linha.petId) ? formato.especie(clinico.pet(linha.petId)!.especie) : '' }}
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
