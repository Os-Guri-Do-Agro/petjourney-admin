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
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

import PartnerPageFrame from '@/components/parceiro/PartnerPageFrame.vue'
import ClinicAlertChip from '@/features/clinico/components/base/ClinicAlertChip.vue'
import ClinicDataTable from '@/features/clinico/components/base/ClinicDataTable.vue'
import type { ColunaTabela } from '@/features/clinico/components/base/table-types'
import { useClinicFormat } from '@/features/clinico/composables/useClinicFormat'
import type { WaitlistEntry } from '@/features/clinico/data/types'
import { useFilaStore } from '@/features/clinico/stores/fila'
import { useClinicoStore } from '@/features/clinico/stores/clinico'

const { t } = useI18n()
const clinico = useClinicoStore()
const fila = useFilaStore()
const formato = useClinicFormat()

const colunas = computed<ColunaTabela[]>(() => [
  { id: 'paciente', rotulo: t('clinico.pacientes.colunaPaciente'), largura: 'minmax(0, 1.6fr)' },
  {
    id: 'responsavel',
    rotulo: t('clinico.pacientes.colunaResponsavel'),
    largura: 'minmax(0, 1.3fr)',
    ocultarEmTelaEstreita: true,
  },
  { id: 'janelas', rotulo: t('clinico.fila.janelas'), largura: 'minmax(0, 1.4fr)' },
  { id: 'situacao', rotulo: t('clinico.fila.colunaSituacao'), largura: '9rem' },
  { id: 'acoes', rotulo: '', largura: '13rem', alinharAoFim: true },
])

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
      <ClinicDataTable
        :colunas="colunas"
        :linhas="fila.ativas"
        :chave="(entrada) => entrada.id"
        :rotulo="t('clinico.fila.titulo')"
      >
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

        <template #celula-acoes="{ linha }">
          <div class="fila__acoes">
            <template v-if="linha.status === 'ofertado'">
              <Button
                :label="t('clinico.fila.aceitar')"
                size="small"
                :loading="fila.salvando"
                @click.stop="fila.responder(linha.id, true)"
              />
              <Button
                :label="t('clinico.fila.recusar')"
                size="small"
                severity="secondary"
                text
                @click.stop="fila.responder(linha.id, false)"
              />
            </template>

            <Button
              v-else-if="linha.status === 'aguardando'"
              :label="t('clinico.fila.remover')"
              size="small"
              severity="secondary"
              text
              @click.stop="fila.remover(linha.id)"
            />
          </div>
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
              @click="fila.ofertar(candidato.id, fila.vagaAberta!.inicio)"
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
  </PartnerPageFrame>
</template>

<style scoped>
.fila {
  display: grid;
  gap: var(--clinic-space-4);
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

.fila__acoes {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--clinic-space-1);
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
