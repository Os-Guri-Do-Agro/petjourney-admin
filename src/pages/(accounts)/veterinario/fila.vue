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
 */
import Button from 'primevue/button'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import PartnerPageFrame from '@/components/parceiro/PartnerPageFrame.vue'
import ClinicAlertChip from '@/features/clinico/components/base/ClinicAlertChip.vue'
import ClinicDataTable from '@/features/clinico/components/base/ClinicDataTable.vue'
import FilaAdicionarDialog from '@/features/clinico/components/agenda/FilaAdicionarDialog.vue'
import FilaOfertaDialog from '@/features/clinico/components/agenda/FilaOfertaDialog.vue'
import type {
  AcaoDeLinha,
  ColunaTabela,
} from '@/features/clinico/components/base/table-types'
import { useClinicFormat } from '@/features/clinico/composables/useClinicFormat'
import type { WaitlistEntry } from '@/features/clinico/data/types'
import { useAvisosStore } from '@/features/clinico/stores/avisos'
import { useFilaStore } from '@/features/clinico/stores/fila'
import { useClinicoStore } from '@/features/clinico/stores/clinico'

const { t } = useI18n()
const clinico = useClinicoStore()
const fila = useFilaStore()
const avisos = useAvisosStore()
const formato = useClinicFormat()

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
    largura: 'minmax(0, 1.6fr)',
    ordenarPor: (linha) => clinico.pet(linha.petId)?.nome ?? null,
  },
  {
    id: 'responsavel',
    rotulo: t('clinico.pacientes.colunaResponsavel'),
    largura: 'minmax(0, 1.3fr)',
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
    icone: 'pi pi-check',
    visivel: (linha) => linha.status === 'ofertado',
  },
  {
    id: 'recusar',
    rotulo: t('clinico.fila.recusar'),
    icone: 'pi pi-times',
    visivel: (linha) => linha.status === 'ofertado',
  },
  {
    id: 'remover',
    rotulo: t('clinico.fila.remover'),
    icone: 'pi pi-trash',
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

const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'] as const

function janelaLegivel(entrada: WaitlistEntry) {
  return entrada.janelas
    .map((janela) => `${DIAS[janela.weekday]} ${janela.inicio}–${janela.fim}`)
    .join(' · ')
}

async function confirmarOferta({ mensagem }: { mensagem: string }) {
  const entrada = paraOfertar.value
  const inicio = fila.vagaAberta?.inicio

  if (!entrada || !inicio) {
    return
  }

  await fila.ofertar(entrada.id, inicio)

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

async function carregar() {
  await clinico.carregar()
  await fila.carregar()
}

onMounted(carregar)
</script>

<template>
  <PartnerPageFrame
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
    <div class="fila clinic-scope">
      <!--
        A entrada na fila fica no topo, ao lado da lista: é a ação que a recepção dispara
        quando acaba de dizer "não tenho horário essa semana".
      -->
      <div class="fila__barra">
        <Button
          :label="t('clinico.fila.adicionar')"
          icon="pi pi-plus"
          size="small"
          @click="adicionarAberto = true"
        />
      </div>

      <ClinicDataTable
        :colunas="colunas"
        :linhas="fila.ativas"
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
          <span class="fila__titulo">
            <strong class="fila__nome">{{ clinico.pet(linha.petId)?.nome }}</strong>
            <!--
              "Normal" é o padrão e não precisa ser dito: uma ficha em toda linha treina o olho
              a ignorar as fichas, inclusive as que importam.
            -->
            <ClinicAlertChip
              v-if="linha.prioridade !== 'normal'"
              :severidade="severidadePorPrioridade[linha.prioridade]"
              :rotulo="formato.prioridadeDaFila(linha.prioridade)"
            />
          </span>
          <span class="fila__meta">
            {{ clinico.tipo(linha.typeId)?.nome }}
            <template v-if="linha.professionalId">
              · {{ clinico.profissional(linha.professionalId)?.nome }}
            </template>
          </span>
        </template>

        <template #celula-responsavel="{ linha }">
          <span class="fila__nome">{{ clinico.tutor(linha.tutorId)?.nome }}</span>
          <span class="fila__meta">{{ clinico.tutor(linha.tutorId)?.telefone }}</span>
        </template>

        <template #celula-janelas="{ linha }">
          <span class="fila__janela">{{ janelaLegivel(linha) }}</span>
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

.fila__prazo {
  display: block;
  color: var(--clinic-attention-text);
  font-size: var(--clinic-font-label);
  font-weight: 700;
}

.fila__prazo--curto {
  color: var(--clinic-risk-text);
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
