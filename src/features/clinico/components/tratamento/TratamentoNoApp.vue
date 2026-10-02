<script setup lang="ts">
/**
 * Os remédios do pet no celular de quem cuida.
 *
 * É a outra metade da demonstração: alguém da casa toca "Dei" aqui, e a faixa da ficha, ao lado,
 * ganha o quadradinho na mesma hora. Como a carteirinha, esta prévia lê **só o contrato**
 * (`TratamentosDoPet`, montado pela projeção que a API vai repetir) — se lesse o registro da
 * clínica, mostraria o que a clínica sabe, e não o que o celular recebe.
 *
 * Os casos difíceis do requisito estão todos à vista:
 *
 * - **Um toque.** O aviso da dose tem "Dei" no próprio aviso, sem abrir o app. Pular pede um
 *   motivo, e o motivo são três botões — esqueci, cuspiu, acabou —, nunca um campo de texto.
 * - **Mais de uma pessoa.** Quem está com o celular muda na ficha, ao lado. A dose que o Rafael
 *   marcou aparece para a Fátima como "Dada por Rafael às 9h40", sem botão: é o que evita a dose
 *   dobrada. Quem só tem leitura vê tudo e não registra, e a tela diz por quê.
 * - **Várias vezes ao dia.** O quadro "Como os avisos funcionam" diz as regras em voz alta: um
 *   aviso por horário, os do mesmo horário juntos, sem segundo aviso quando a próxima dose já vem
 *   em horas, e a dose que passa sem registro não cobra ninguém.
 *
 * Moldura sóbria, como a do boletim e a da carteirinha: o que se julga aqui é o conteúdo.
 */
import Button from 'primevue/button'
import SelectButton from 'primevue/selectbutton'
import ToggleSwitch from 'primevue/toggleswitch'
import { computed, reactive, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  REGRAS_DA_DOSE,
  TEXTO_PT_DO_AVISO_DE_DOSE,
  type DoseDoTratamento,
  type TratamentoDoPet,
} from '../../contrato/responsavel'
import { useClinicFormat } from '../../composables/useClinicFormat'
import { useRotulosDoTratamento } from '../../composables/useRotulosDoTratamento'
import type { ReceitaSemLembrete, TratamentosNoApp } from '../../data/repositories'
import { MOTIVOS_DA_DOSE_PULADA, type MotivoDaDosePulada } from '../../domain/adesao'
import { epochToWall, wallToIso } from '../../domain/clinic-time'
import { clinicClock, useClinicoStore } from '../../stores/clinico'

const props = withDefaults(
  defineProps<{
    dados: TratamentosNoApp
    petIniciais: string
    /** A foto do perfil do pet no app, quando há. */
    petFotoUrl?: string
    salvando?: boolean
    /** A recusa da última tentativa, na dose em que aconteceu. */
    recusa?: { tratamentoId: string; numero: number; texto: string } | null
  }>(),
  { salvando: false, recusa: null, petFotoUrl: '' },
)

const emit = defineEmits<{
  registrar: [
    dose: {
      tratamentoId: string
      numero: number
      situacao: 'dada' | 'pulada'
      motivo: MotivoDaDosePulada | null
    },
  ]
  registrarVarias: [doses: Array<{ tratamentoId: string; numero: number }>]
  desfazer: [dose: { tratamentoId: string; numero: number }]
  criarLembretes: [
    pedido: {
      encounterId: string
      itens: Array<{ prescricaoId: string; primeiraDoseEm: string }>
      compartilhar: boolean
    },
  ]
  compartilhar: [pedido: { tratamentoId: string; compartilhado: boolean }]
}>()

const { t } = useI18n()
const formato = useClinicFormat()
const rotulos = useRotulosDoTratamento()
const clinico = useClinicoStore()
const idBase = useId()

const contrato = computed(() => props.dados.contrato)
const edita = computed(() => contrato.value.eu.acesso === 'LEITURA_ESCRITA')
const emCurso = computed(() =>
  contrato.value.tratamentos.filter((item) => item.situacao === 'EM_CURSO'),
)
const encerrados = computed(() =>
  contrato.value.tratamentos.filter((item) => item.situacao === 'ENCERRADO'),
)
const clinicaNome = computed(
  () => contrato.value.tratamentos[0]?.clinica.nome ?? clinico.clinic?.nome ?? '',
)

// ------------------------------------------------------------------ o aviso da dose

const avisoFechado = ref<string | null>(null)

const aviso = computed(() => {
  const atual = props.dados.aviso

  if (!atual || !edita.value || avisoFechado.value === atual.previstaEm) {
    return null
  }

  return { ...TEXTO_PT_DO_AVISO_DE_DOSE(atual), chave: atual.previstaEm, doses: atual.doses }
})

function deiPeloAviso() {
  if (!aviso.value) {
    return
  }

  emit(
    'registrarVarias',
    aviso.value.doses.map((dose) => ({ tratamentoId: dose.tratamentoId, numero: dose.numero })),
  )
}

// ------------------------------------------------------------------ doses

function doseDoContrato(tratamento: TratamentoDoPet): string {
  return rotulos.dose(tratamento.quantidade, tratamento.unidade === 'ML' ? 'ml' : 'comprimido')
}

function posologia(tratamento: TratamentoDoPet): string {
  return [
    doseDoContrato(tratamento),
    t('clinico.adesao.posologia.aCada', { horas: tratamento.frequenciaHoras }),
    tratamento.duracaoDias === undefined
      ? t('clinico.adesao.posologia.continuo')
      : t(
          'clinico.adesao.posologia.porDias',
          { dias: tratamento.duracaoDias },
          tratamento.duracaoDias,
        ),
  ].join(' · ')
}

function horario(dose: DoseDoTratamento): string {
  const hora = formato.hora(dose.previstaEm)

  return clinicClock.dateOf(dose.previstaEm) === clinicClock.today()
    ? hora
    : t('clinico.adesao.app.ontemAs', { hora })
}

function nomeDeQuem(dose: DoseDoTratamento): string {
  return rotulos.primeiroNome(dose.registradaPor?.nome ?? '')
}

function estado(dose: DoseDoTratamento): string {
  const hora = dose.registradaEm ? formato.hora(dose.registradaEm) : ''
  const eu = dose.registradaPor?.eu ?? false

  switch (dose.situacao) {
    case 'DADA':
      return eu
        ? t('clinico.adesao.app.dadaPorVoce', { hora })
        : t('clinico.adesao.app.dadaPor', { nome: nomeDeQuem(dose), hora })
    case 'PULADA': {
      const motivo = t(`clinico.adesao.motivo.${(dose.motivo ?? 'ESQUECI').toLowerCase()}`)

      return eu
        ? t('clinico.adesao.app.puladaPorVoce', { motivo })
        : t('clinico.adesao.app.puladaPor', { nome: nomeDeQuem(dose), motivo })
    }
    case 'SEM_REGISTRO':
      return t('clinico.adesao.situacao.sem-registro')
    case 'PREVISTA':
      return t('clinico.adesao.situacao.prevista')
    default:
      return edita.value ? '' : t('clinico.adesao.situacao.aberta')
  }
}

/** A dose que está no passo "por quê?" — o segundo toque do "Pulei". */
const pulando = ref<string | null>(null)

function chave(tratamentoId: string, numero: number) {
  return `${tratamentoId}#${numero}`
}

function pular(tratamento: TratamentoDoPet, dose: DoseDoTratamento, motivo: MotivoDaDosePulada) {
  pulando.value = null
  emit('registrar', {
    tratamentoId: tratamento.id,
    numero: dose.numero,
    situacao: 'pulada',
    motivo,
  })
}

function historico(tratamento: TratamentoDoPet): string {
  const { dadas, puladas, semRegistro, desde } = tratamento.historico
  const partes = [t('clinico.adesao.contagem.dadas', { total: dadas }, dadas)]

  if (puladas > 0) {
    partes.push(t('clinico.adesao.contagem.puladas', { total: puladas }, puladas))
  }

  if (semRegistro > 0) {
    partes.push(t('clinico.adesao.contagem.semRegistro', { total: semRegistro }, semRegistro))
  }

  return `${t('clinico.adesao.app.desde', { data: formato.dataCurta(desde) })} ${partes.join(' · ')}`
}

// ------------------------------------------------------------------ criar lembretes

function somarHoras(iso: string, horas: number): string {
  return wallToIso(
    epochToWall(Date.parse(iso) + horas * 3_600_000, clinicClock.utcOffset),
    clinicClock.utcOffset,
  )
}

/** Por item de receita: o horário escolhido para a primeira dose. Nasce com a sugestão. */
const escolhas = reactive<Record<string, string>>({})
/** Por receita: deixar a clínica ver. Nasce ligado, e a tela diz o que isso quer dizer. */
const compartilhar = reactive<Record<string, boolean>>({})

watch(
  () => props.dados.receitasSemLembrete,
  (receitas) => {
    for (const receita of receitas) {
      compartilhar[receita.encounterId] ??= true

      for (const item of receita.itens) {
        escolhas[item.prescricaoId] ??= item.sugestao
      }
    }
  },
  { immediate: true },
)

function opcoesDeHorario(sugestao: string) {
  return [0, 1, 2].map((horas) => {
    const valor = somarHoras(sugestao, horas)

    return { valor, rotulo: formato.hora(valor) }
  })
}

function criar(receita: ReceitaSemLembrete) {
  emit('criarLembretes', {
    encounterId: receita.encounterId,
    itens: receita.itens.map((item) => ({
      prescricaoId: item.prescricaoId,
      primeiraDoseEm: escolhas[item.prescricaoId] ?? item.sugestao,
    })),
    compartilhar: compartilhar[receita.encounterId] ?? true,
  })
}
</script>

<template>
  <div class="celular">
    <div class="celular__moldura">
      <!--
        O aviso da dose, como chega na tela bloqueada: com "Dei" no próprio aviso. Some quando
        alguém da casa marca — a dose não avisa quem não precisa mais dela.
      -->
      <Transition name="aviso">
        <div v-if="aviso" :key="aviso.chave" class="push" role="status">
          <span class="push__marca" aria-hidden="true"><i class="pi pi-bell" /></span>
          <span class="push__texto">
            <small>{{
              t('clinico.adesao.app.pushOrigem', { hora: formato.hora(aviso.chave) })
            }}</small>
            <strong>{{ aviso.titulo }}</strong>
            <span>{{ aviso.corpo }}</span>
          </span>
          <span class="push__acoes">
            <Button
              size="small"
              class="clinic-acao-principal"
              :label="t('clinico.adesao.app.dei')"
              :loading="salvando"
              @click="deiPeloAviso"
            />
            <Button
              size="small"
              severity="secondary"
              outlined
              :label="t('clinico.adesao.app.abrir')"
              @click="avisoFechado = aviso.chave"
            />
          </span>
        </div>
      </Transition>

      <header class="topo">
        <span class="topo__avatar" aria-hidden="true">
          <img v-if="petFotoUrl" :src="petFotoUrl" alt="" />
          <template v-else>{{ petIniciais }}</template>
        </span>
        <span class="topo__identidade">
          <strong>{{ t('clinico.adesao.app.titulo') }}</strong>
          <span>{{ contrato.pet.nome }}</span>
        </span>
      </header>

      <div class="rolagem">
        <p v-if="!edita" class="leitura">
          <i class="pi pi-eye" aria-hidden="true" />
          {{ t('clinico.adesao.app.somenteLeitura', { pet: contrato.pet.nome }) }}
        </p>

        <!-- A receita que chegou e ainda não virou lembrete: é por aqui que o tratamento nasce. -->
        <section
          v-for="receita in dados.receitasSemLembrete"
          :key="receita.encounterId"
          class="bloco receita"
        >
          <h4 class="bloco__titulo">
            {{
              t('clinico.adesao.app.receitaNova', {
                data: formato.dataCurta(clinicClock.dateOf(receita.liberadaEm)),
              })
            }}
          </h4>
          <p class="receita__detalhe">
            {{
              t(
                'clinico.adesao.app.receitaNovaDetalhe',
                { total: receita.itens.length },
                receita.itens.length,
              )
            }}
          </p>

          <div v-for="item in receita.itens" :key="item.prescricaoId" class="receita__item">
            <strong>{{
              clinico.medicamento(item.medicamentoId)?.nome ?? item.medicamentoId
            }}</strong>
            <span class="receita__posologia">
              {{
                rotulos.posologia({
                  medicamentoId: item.medicamentoId,
                  medicamento: '',
                  quantidade: item.quantidade,
                  unidade: item.unidade,
                  frequenciaHoras: item.frequenciaHoras,
                  duracaoDias: item.duracaoDias,
                })
              }}
            </span>
            <span class="receita__rotulo">{{ t('clinico.adesao.app.primeiraDose') }}</span>
            <SelectButton
              v-model="escolhas[item.prescricaoId]"
              :options="opcoesDeHorario(item.sugestao)"
              option-label="rotulo"
              option-value="valor"
              :allow-empty="false"
              :aria-label="t('clinico.adesao.app.primeiraDose')"
            />
            <span class="receita__dica">{{ t('clinico.adesao.app.sugestaoDica') }}</span>
          </div>

          <div class="receita__compartilhar">
            <ToggleSwitch
              v-model="compartilhar[receita.encounterId]"
              :input-id="`${idBase}-compartilhar-${receita.encounterId}`"
            />
            <label :for="`${idBase}-compartilhar-${receita.encounterId}`">
              {{ t('clinico.adesao.app.compartilhar', { clinica: clinicaNome }) }}
            </label>
          </div>

          <Button
            class="receita__criar clinic-acao-principal"
            size="small"
            :label="t('clinico.adesao.app.criar')"
            :loading="salvando"
            @click="criar(receita)"
          />
        </section>

        <p v-if="emCurso.length === 0 && dados.receitasSemLembrete.length === 0" class="vazio">
          {{ t('clinico.adesao.app.vazio', { pet: contrato.pet.nome }) }}
        </p>

        <section v-for="tratamento in emCurso" :key="tratamento.id" class="bloco remedio">
          <header class="remedio__cabeca">
            <strong>{{ tratamento.medicamento }}</strong>
            <span>{{ posologia(tratamento) }}</span>
          </header>

          <TransitionGroup tag="ul" name="linha" class="doses">
            <li
              v-for="dose in tratamento.doses"
              :key="dose.numero"
              class="dose"
              :class="`dose--${dose.situacao}`"
            >
              <span class="dose__hora">{{ horario(dose) }}</span>

              <span class="dose__corpo">
                <template v-if="dose.podeRegistrar">
                  <span v-if="pulando === chave(tratamento.id, dose.numero)" class="dose__acoes">
                    <span class="dose__pergunta">{{ t('clinico.adesao.app.porQue') }}</span>
                    <Button
                      v-for="motivo in MOTIVOS_DA_DOSE_PULADA"
                      :key="motivo"
                      size="small"
                      severity="secondary"
                      outlined
                      :label="t(`clinico.adesao.motivo.${motivo}`)"
                      :disabled="salvando"
                      @click="pular(tratamento, dose, motivo)"
                    />
                    <Button
                      size="small"
                      severity="secondary"
                      outlined
                      icon="pi pi-times"
                      :aria-label="t('clinico.adesao.app.voltar')"
                      :title="t('clinico.adesao.app.voltar')"
                      @click="pulando = null"
                    />
                  </span>
                  <span v-else class="dose__acoes">
                    <Button
                      size="small"
                      class="clinic-acao-principal"
                      :label="t('clinico.adesao.app.dei')"
                      :loading="salvando"
                      @click="
                        emit('registrar', {
                          tratamentoId: tratamento.id,
                          numero: dose.numero,
                          situacao: 'dada',
                          motivo: null,
                        })
                      "
                    />
                    <Button
                      size="small"
                      severity="secondary"
                      outlined
                      :label="t('clinico.adesao.app.pulei')"
                      :disabled="salvando"
                      @click="pulando = chave(tratamento.id, dose.numero)"
                    />
                  </span>
                </template>

                <span v-else class="dose__estado">
                  <i
                    v-if="dose.situacao === 'DADA'"
                    class="pi pi-check-circle dose__icone"
                    aria-hidden="true"
                  />
                  {{ estado(dose) }}
                  <Button
                    v-if="dose.podeDesfazer"
                    size="small"
                    severity="secondary"
                    outlined
                    class="dose__desfazer"
                    :label="t('clinico.adesao.app.desfazer')"
                    :disabled="salvando"
                    @click="emit('desfazer', { tratamentoId: tratamento.id, numero: dose.numero })"
                  />
                </span>

                <span
                  v-if="
                    recusa && recusa.tratamentoId === tratamento.id && recusa.numero === dose.numero
                  "
                  class="dose__recusa"
                  role="alert"
                >
                  {{ recusa.texto }}
                </span>
              </span>
            </li>
          </TransitionGroup>

          <p class="remedio__historico">{{ historico(tratamento) }}</p>

          <div class="remedio__compartilhado">
            <template v-if="tratamento.podeAlterarCompartilhamento">
              <ToggleSwitch
                :model-value="tratamento.compartilhadoComAClinica"
                :input-id="`${idBase}-${tratamento.id}`"
                :disabled="salvando"
                @update:model-value="
                  emit('compartilhar', {
                    tratamentoId: tratamento.id,
                    compartilhado: Boolean($event),
                  })
                "
              />
              <label :for="`${idBase}-${tratamento.id}`">
                {{ t('clinico.adesao.app.compartilhado', { clinica: tratamento.clinica.nome }) }}
              </label>
            </template>
            <span v-else>
              {{
                tratamento.compartilhadoComAClinica
                  ? t('clinico.adesao.app.compartilhado', { clinica: tratamento.clinica.nome })
                  : t('clinico.adesao.app.naoCompartilhado')
              }}
            </span>
          </div>
        </section>

        <section v-if="encerrados.length > 0" class="bloco">
          <h4 class="bloco__titulo">{{ t('clinico.adesao.app.encerrados') }}</h4>
          <p v-for="tratamento in encerrados" :key="tratamento.id" class="encerrado">
            <strong>{{ tratamento.medicamento }}</strong>
            <span>{{ historico(tratamento) }}</span>
          </p>
        </section>

        <!--
          As regras dos avisos, ditas para quem recebe. É o caso "várias vezes ao dia, sem virar
          spam": a pessoa precisa saber que o app não vai insistir, senão desliga antes.
        -->
        <section v-if="emCurso.length > 0" class="bloco avisos">
          <h4 class="bloco__titulo">{{ t('clinico.adesao.app.avisosTitulo') }}</h4>
          <ul>
            <li>
              {{
                t('clinico.adesao.app.avisoUmPorHorario', {
                  minutos: REGRAS_DA_DOSE.agruparDentroDeMin,
                })
              }}
            </li>
            <li>
              {{
                emCurso.every((item) => !item.avisos.comReaviso)
                  ? t('clinico.adesao.app.avisoSemReaviso')
                  : t('clinico.adesao.app.avisoComReaviso', {
                      horas: REGRAS_DA_DOSE.reavisoSoComIntervaloDeHoras,
                    })
              }}
            </li>
            <li>{{ t('clinico.adesao.app.avisoSemCobranca') }}</li>
          </ul>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.celular {
  display: flex;
  justify-content: center;
}

.celular__moldura {
  position: relative;
  display: flex;
  overflow: hidden;
  width: min(21rem, 100%);
  height: min(44rem, calc(100vh - 9rem));
  min-height: 30rem;
  flex-direction: column;
  padding: var(--clinic-space-3);
  border: 1px solid var(--clinic-line-strong);
  border-radius: 1.6rem;
  gap: var(--clinic-space-3);
  background: var(--clinic-surface-sunken);
  box-shadow: var(--clinic-shadow-card);
}

/* ------------------------------------------------------------------ aviso */

.push {
  display: grid;
  flex: 0 0 auto;
  padding: var(--clinic-space-2) var(--clinic-space-3);
  border: 1px solid var(--clinic-line);
  border-radius: 1rem;
  background: var(--clinic-surface);
  box-shadow: var(--clinic-shadow-float);
  gap: var(--clinic-space-2);
  grid-template-columns: auto minmax(0, 1fr);
}

.push__marca {
  display: grid;
  width: 1.6rem;
  height: 1.6rem;
  border-radius: 0.45rem;
  background: var(--clinic-accent-strong);
  color: var(--clinic-surface);
  font-size: 0.7rem;
  place-items: center;
}

.push__texto {
  display: grid;
  min-width: 0;
  gap: 0.05rem;
  font-size: var(--clinic-font-label);
  line-height: 1.35;
}

.push__texto small {
  color: var(--clinic-faint);
  font-size: 0.625rem;
}

.push__texto span {
  color: var(--clinic-muted);
}

.push__acoes {
  display: flex;
  grid-column: 2;
  gap: var(--clinic-space-2);
}

.aviso-enter-active,
.aviso-leave-active {
  transition:
    opacity 180ms ease-out,
    transform 180ms ease-out;
}

.aviso-enter-from,
.aviso-leave-to {
  opacity: 0;
  transform: translateY(-0.5rem);
}

/* ------------------------------------------------------------------ topo */

.topo {
  display: flex;
  align-items: center;
  gap: var(--clinic-space-3);
}

.topo__avatar {
  display: grid;
  width: 2.2rem;
  height: 2.2rem;
  flex: 0 0 auto;
  border-radius: 50%;
  background: var(--clinic-accent-tint);
  color: var(--clinic-accent-strong);
  font-size: var(--clinic-font-label);
  font-weight: 750;
  place-items: center;
}

/* A foto do perfil do pet, quando o app tem uma; sem ela, as iniciais. */
.topo__avatar:has(img) {
  overflow: hidden;
}

.topo__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.topo__identidade {
  display: grid;
  min-width: 0;
}

.topo__identidade strong {
  font-size: var(--clinic-font-value);
  font-weight: 750;
}

.topo__identidade span {
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
}

/* ------------------------------------------------------------------ rolagem */

.rolagem {
  display: grid;
  overflow-y: auto;
  flex: 1;
  align-content: start;
  gap: var(--clinic-space-3);
  overscroll-behavior: contain;
}

.leitura {
  display: flex;
  align-items: flex-start;
  margin: 0;
  gap: var(--clinic-space-2);
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
  line-height: 1.4;
}

.bloco {
  display: grid;
  padding: var(--clinic-space-3);
  border-radius: 0.9rem;
  gap: var(--clinic-space-2);
  background: var(--clinic-surface);
}

.bloco__titulo {
  margin: 0;
  color: var(--clinic-faint);
  font-size: 0.625rem;
  font-weight: 750;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.vazio {
  margin: var(--clinic-space-4) 0;
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
  text-align: center;
}

/* ------------------------------------------------------------------ receita nova */

.receita__detalhe,
.receita__posologia,
.receita__dica,
.receita__rotulo {
  margin: 0;
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
}

.receita__item {
  display: grid;
  padding-top: var(--clinic-space-2);
  border-top: 1px solid var(--clinic-line-soft);
  gap: 0.25rem;
  font-size: var(--clinic-font-label);
}

.receita__rotulo {
  margin-top: 0.2rem;
  font-weight: 700;
}

.receita__dica {
  font-size: 0.625rem;
}

.receita__compartilhar,
.remedio__compartilhado {
  display: flex;
  align-items: center;
  gap: var(--clinic-space-2);
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
  line-height: 1.35;
}

.receita__compartilhar label,
.remedio__compartilhado label {
  cursor: pointer;
}

.receita__criar {
  justify-self: start;
}

/* ------------------------------------------------------------------ remédio */

.remedio__cabeca {
  display: grid;
  gap: 0.05rem;
  font-size: var(--clinic-font-label);
}

.remedio__cabeca strong {
  font-size: var(--clinic-font-body);
  font-weight: 750;
}

.remedio__cabeca span,
.remedio__historico,
.encerrado span {
  color: var(--clinic-muted);
}

.remedio__historico {
  margin: 0;
  font-size: 0.6875rem;
}

.doses {
  display: grid;
  margin: 0;
  padding: 0;
  gap: 0;
  list-style: none;
}

.dose {
  display: grid;
  align-items: center;
  padding-block: var(--clinic-space-2);
  gap: var(--clinic-space-2);
  grid-template-columns: 4.2rem minmax(0, 1fr);
  font-size: var(--clinic-font-label);
}

.dose + .dose {
  border-top: 1px solid var(--clinic-line-soft);
}

.dose__hora {
  font-variant-numeric: tabular-nums;
  font-weight: 700;
}

.dose--PREVISTA .dose__hora,
.dose--SEM_REGISTRO .dose__hora {
  color: var(--clinic-faint);
  font-weight: 600;
}

.dose__corpo {
  display: grid;
  min-width: 0;
  gap: 0.25rem;
}

.dose__acoes {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
}

.dose__pergunta {
  flex-basis: 100%;
  color: var(--clinic-muted);
  font-weight: 700;
}

.dose__estado {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
  color: var(--clinic-muted);
}

.dose--DADA .dose__estado {
  color: var(--clinic-text);
  font-weight: 600;
}

.dose__icone {
  color: var(--clinic-accent-strong);
}

.dose__desfazer {
  margin-inline-start: auto;
}

.dose__recusa {
  color: var(--clinic-attention-text);
  font-weight: 700;
  line-height: 1.35;
}

.encerrado {
  display: grid;
  margin: 0;
  gap: 0.05rem;
  font-size: var(--clinic-font-label);
}

.avisos ul {
  display: grid;
  margin: 0;
  padding-inline-start: 1rem;
  gap: 0.3rem;
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
  line-height: 1.4;
}

/* A dose que muda de estado: o movimento diz o que mudou, e só isso. */
.linha-move {
  transition: transform 180ms ease-out;
}

@media (prefers-reduced-motion: reduce) {
  .aviso-enter-active,
  .aviso-leave-active,
  .linha-move {
    transition: none;
  }
}
</style>
