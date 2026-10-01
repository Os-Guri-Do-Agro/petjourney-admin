<script setup lang="ts">
/**
 * O checklist de enfermagem: o que dar, a que horas, e quem deu.
 *
 * Agrupado por **horário**, e não por medicamento, porque é assim que o trabalho acontece: às
 * 14h alguém pega três seringas e vai até o leito uma vez. Uma lista por medicamento mandaria a
 * mesma pessoa ao mesmo leito três vezes, e é o tipo de tela que a clínica abandona na primeira
 * semana e substitui por papel.
 *
 * O corte do "agora" é uma linha de verdade no meio da lista. Sem ela, quem chega no meio do
 * plantão precisa comparar relógio com tela linha a linha para saber onde parou o turno anterior.
 *
 * Três desfechos, e não um: **feita**, **recusada** e **pulada** são coisas diferentes. Gato que
 * cospe o comprimido não é dose que ninguém deu, e registrar as duas do mesmo jeito apaga
 * justamente a informação que faz o vet trocar a via.
 */
import Button from 'primevue/button'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { AdministracaoAgendada, PrescricaoDeInternacao, SituacaoDaAdministracao } from '../../data/types'
import { useClinicFormat } from '../../composables/useClinicFormat'
import { atrasoEmMinutos, atravessaAPassagem } from '../../domain/internacao'
import { useClinicoStore } from '../../stores/clinico'

type Linha = {
  administracao: AdministracaoAgendada
  prescricao: PrescricaoDeInternacao | null
  situacao: SituacaoDaAdministracao
}

const props = withDefaults(
  defineProps<{
    linhas: Linha[]
    agora: string
    salvando?: boolean
    /** Fim do plantão corrente: é o que revela as doses em cima da troca. */
    fimDoPlantao?: string | null
  }>(),
  { salvando: false, fimDoPlantao: null },
)

const emit = defineEmits<{
  registrar: [administracaoId: string, status: 'feita' | 'recusada' | 'pulada']
  desfazer: [administracaoId: string]
}>()

const { t } = useI18n()
const formato = useClinicFormat()
const clinico = useClinicoStore()

/** Ícone por tipo de item: medicamento, fluido e monitoramento se distinguem de relance. */
const ICONE: Record<PrescricaoDeInternacao['kind'], string> = {
  medicamento: 'pi pi-inbox',
  fluido: 'pi pi-filter',
  monitoramento: 'pi pi-heart',
  alimentacao: 'pi pi-apple',
  procedimento: 'pi pi-wrench',
}

/**
 * Só o que interessa ao turno: as horas do plantão corrente e o que vem logo em seguida.
 *
 * Mostrar as 48 horas aprazadas transformaria o checklist num calendário — e ninguém precisa ver
 * a dose de depois de amanhã enquanto segura uma seringa.
 *
 * **Seis horas para trás, e não vinte.** Com a janela larga, abrir a aba despejava dezesseis
 * horas de doses já dadas antes da primeira linha acionável: quem entrava no plantão rolava a
 * tela para achar o "agora". Seis horas cobrem o turno em curso — que é o que quem está com a
 * seringa na mão precisa conferir — sem esconder o que ainda cobra ação.
 */
const JANELA_ATRAS_MS = 6 * 3_600_000
const JANELA_FRENTE_MS = 12 * 3_600_000

const visiveis = computed(() => {
  const agoraMs = Date.parse(props.agora)

  return props.linhas.filter((linha) => {
    const previstaMs = Date.parse(linha.administracao.previstaPara)

    return previstaMs >= agoraMs - JANELA_ATRAS_MS && previstaMs <= agoraMs + JANELA_FRENTE_MS
  })
})

type Grupo = {
  horario: string
  rotulo: string
  passado: boolean
  linhas: Linha[]
}

const grupos = computed<Grupo[]>(() => {
  const agoraMs = Date.parse(props.agora)
  const porHorario = new Map<string, Linha[]>()

  for (const linha of visiveis.value) {
    const chave = linha.administracao.previstaPara

    porHorario.set(chave, [...(porHorario.get(chave) ?? []), linha])
  }

  return [...porHorario.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([horario, linhas]) => ({
      horario,
      rotulo: formato.hora(horario),
      passado: Date.parse(horario) < agoraMs,
      linhas,
    }))
})

/** Índice do primeiro grupo ainda por vir — é onde a linha do "agora" é desenhada. */
const indiceDoAgora = computed(() => grupos.value.findIndex((grupo) => !grupo.passado))

function naTroca(administracao: AdministracaoAgendada): boolean {
  return props.fimDoPlantao ? atravessaAPassagem(administracao, props.fimDoPlantao) : false
}

function atraso(administracao: AdministracaoAgendada): number {
  return atrasoEmMinutos(administracao, props.agora)
}

function executor(administracao: AdministracaoAgendada): string {
  return administracao.executadaPor
    ? (clinico.profissional(administracao.executadaPor)?.nome ?? '')
    : ''
}

function resolvida(situacao: SituacaoDaAdministracao): boolean {
  return situacao === 'feita' || situacao === 'recusada' || situacao === 'pulada'
}
</script>

<template>
  <div class="checklist">
    <p v-if="grupos.length === 0" class="checklist__vazio">
      {{ t('clinico.internacao.checklist.vazio') }}
    </p>

    <template v-for="(grupo, indice) in grupos" :key="grupo.horario">
      <p v-if="indice === indiceDoAgora" class="checklist__agora">
        <span>{{ t('clinico.internacao.checklist.agora', { hora: formato.hora(agora) }) }}</span>
      </p>

      <section class="grupo" :class="{ 'grupo--passado': grupo.passado }">
        <h4 class="grupo__hora clinic-value">{{ grupo.rotulo }}</h4>

        <ul class="grupo__itens">
          <li
            v-for="linha in grupo.linhas"
            :key="linha.administracao.id"
            class="item"
            :class="[`item--${linha.situacao}`, { 'item--troca': naTroca(linha.administracao) }]"
          >
            <i class="item__icone" :class="ICONE[linha.prescricao?.kind ?? 'procedimento']" aria-hidden="true" />

            <div class="item__corpo">
              <p class="item__descricao">
                <strong>{{ linha.prescricao?.descricao }}</strong>
                <span v-if="linha.prescricao?.doseTexto" class="item__dose clinic-value">
                  {{ linha.prescricao.doseTexto }}
                </span>
                <span v-if="linha.prescricao?.via" class="item__via">
                  {{ t(`clinico.prontuario.conduta.via_.${linha.prescricao.via}`) }}
                </span>
              </p>

              <p class="item__meta">
                <span class="item__situacao">
                  {{ t(`clinico.internacao.situacao.${linha.situacao}`) }}
                </span>

                <span v-if="linha.situacao === 'atrasada'" class="item__atraso">
                  {{
                    t('clinico.internacao.checklist.atrasoMinutos', {
                      minutos: atraso(linha.administracao),
                    })
                  }}
                </span>

                <span v-if="executor(linha.administracao)" class="item__executor">
                  {{
                    t('clinico.internacao.checklist.por', {
                      nome: executor(linha.administracao),
                      hora: formato.hora(linha.administracao.executadaEm ?? ''),
                    })
                  }}
                </span>

                <span v-if="linha.prescricao?.continuo" class="item__continuo">
                  {{ t('clinico.internacao.checklist.conferencia') }}
                </span>
              </p>

              <!--
                A dose em cima da troca de plantão diz o que é, na linha, e não numa legenda de
                rodapé: quem está com a seringa na mão não vai procurar legenda.
              -->
              <p v-if="naTroca(linha.administracao)" class="item__troca">
                <i class="pi pi-arrow-right-arrow-left" aria-hidden="true" />
                {{ t('clinico.internacao.checklist.naTroca') }}
              </p>

              <p v-if="linha.administracao.observacao" class="item__observacao">
                {{ linha.administracao.observacao }}
              </p>
            </div>

            <div class="item__acoes">
              <template v-if="resolvida(linha.situacao)">
                <Button
                  :label="t('clinico.internacao.checklist.desfazer')"
                  severity="secondary"
                  text
                  size="small"
                  :disabled="salvando"
                  @click="emit('desfazer', linha.administracao.id)"
                />
              </template>

              <template v-else-if="linha.situacao !== 'suspensa'">
                <Button
                  :label="t('clinico.internacao.checklist.checar')"
                  icon="pi pi-check"
                  size="small"
                  :disabled="salvando"
                  @click="emit('registrar', linha.administracao.id, 'feita')"
                />
                <Button
                  v-if="linha.situacao !== 'futura'"
                  :label="t('clinico.internacao.checklist.recusou')"
                  severity="secondary"
                  outlined
                  size="small"
                  :disabled="salvando"
                  @click="emit('registrar', linha.administracao.id, 'recusada')"
                />
              </template>
            </div>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>

<style scoped>
.checklist {
  display: grid;
  gap: var(--clinic-space-3);
}

.checklist__vazio {
  margin: 0;
  padding: var(--clinic-space-5);
  color: var(--clinic-faint);
  text-align: center;
}

/* A linha do agora: fina, contínua e com a hora encostada nela. */
.checklist__agora {
  display: flex;
  align-items: center;
  margin: var(--clinic-space-2) 0;
  gap: var(--clinic-space-3);
  color: var(--clinic-accent-strong);
  font-size: var(--clinic-font-label);
  font-weight: 700;
}

.checklist__agora::after {
  height: 1px;
  flex: 1;
  background: var(--clinic-accent-strong);
  content: '';
  opacity: 0.5;
}

.grupo {
  display: grid;
  align-items: start;
  gap: var(--clinic-space-2) var(--clinic-space-4);
  grid-template-columns: 3.6rem minmax(0, 1fr);
}

.grupo--passado {
  opacity: 0.9;
}

.grupo__hora {
  margin: 0;
  padding-top: 0.6rem;
  color: var(--clinic-muted);
  font-size: var(--clinic-font-body);
  font-weight: 750;
}

.grupo__itens {
  display: grid;
  margin: 0;
  padding: 0;
  gap: var(--clinic-space-2);
  list-style: none;
}

.item {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  padding: var(--clinic-space-3);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-control);
  gap: var(--clinic-space-3);
  background: var(--clinic-surface);
}

/*
 * A linha atrasada não se pinta: a situação dela vira selo coral, e o ícone vai junto. Uma coluna
 * de linhas rosadas lia como alarme da tela inteira, e o texto clínico perdia contraste no fundo.
 * A que está na janela, do mesmo jeito, em pêssego.
 */
.item--atrasada .item__icone {
  color: var(--clinic-risk-text);
}

.item--na-janela .item__icone {
  color: var(--clinic-attention-text);
}

.item--feita {
  background: var(--clinic-surface-soft);
}

.item--recusada,
.item--pulada {
  border-style: dashed;
}

.item--suspensa {
  opacity: 0.6;
}

/*
 * A dose em cima da troca é contornada, não marcada de lado.
 *
 * A tarja à esquerda disputava espaço com a coluna de horário e sumia na largura estreita, onde
 * a linha vira bloco. O anel cerca a linha inteira e continua legível em qualquer largura — e a
 * frase que explica o que ele significa já vem logo abaixo, dentro da própria linha.
 */
.item--troca {
  border-color: var(--clinic-accent);
}

.item__icone {
  padding-top: 0.2rem;
  color: var(--clinic-faint);
  font-size: 0.85rem;
}

.item__corpo {
  display: grid;
  min-width: 0;
  flex: 1;
  gap: 0.15rem;
}

.item__descricao {
  display: flex;
  margin: 0;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--clinic-space-2);
}

.item__descricao strong {
  overflow-wrap: anywhere;
  font-weight: 700;
}

.item__dose {
  color: var(--clinic-muted);
  font-weight: 650;
}

.item__via,
.item__continuo {
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
  text-transform: lowercase;
}

.item__meta {
  display: flex;
  margin: 0;
  flex-wrap: wrap;
  gap: var(--clinic-space-3);
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
}

.item__situacao {
  font-weight: 700;
}

/* O selo de 6 px da Visão geral, no par da gravidade. */
.item--atrasada .item__situacao,
.item--na-janela .item__situacao {
  padding: 0.05rem 0.45rem;
  border-radius: 6px;
}

.item--atrasada .item__situacao {
  background: var(--clinic-risk-bg);
  color: var(--clinic-risk-text);
}

.item--na-janela .item__situacao {
  background: var(--clinic-attention-bg);
  color: var(--clinic-attention-text);
}

.item__atraso {
  color: var(--clinic-risk-text);
}

.item__executor {
  font-style: italic;
}

.item__troca {
  display: flex;
  align-items: center;
  margin: 0.15rem 0 0;
  gap: var(--clinic-space-2);
  color: var(--clinic-accent-strong);
  font-size: var(--clinic-font-label);
  font-weight: 700;
}

.item__observacao {
  margin: 0.15rem 0 0;
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
}

.item__acoes {
  display: flex;
  flex: 0 0 auto;
  gap: var(--clinic-space-2);
}

@media (width <= 640px) {
  .grupo {
    grid-template-columns: minmax(0, 1fr);
  }

  .grupo__hora {
    padding-top: 0;
  }

  .item {
    flex-wrap: wrap;
  }

  .item__acoes {
    width: 100%;
    justify-content: flex-end;
  }
}
</style>
