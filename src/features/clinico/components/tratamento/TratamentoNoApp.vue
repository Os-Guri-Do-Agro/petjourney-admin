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
 * Moldura sóbria, como a da carteirinha: o que se julga aqui é o conteúdo. Só tokens do Trilha,
 * para o celular acompanhar o tema da clínica (claro e escuro) sem cor própria.
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
          <span class="push__marca" aria-hidden="true"><i class="ph ph-bell" /></span>
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
          <i class="ph ph-eye" aria-hidden="true" />
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
            class="receita__criar"
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
            <span class="remedio__icone" aria-hidden="true"><i class="ph ph-pill" /></span>
            <span class="remedio__nome">
              <strong>{{ tratamento.medicamento }}</strong>
              <span>{{ posologia(tratamento) }}</span>
            </span>
          </header>

          <TransitionGroup tag="ul" name="linha" class="doses">
            <li
              v-for="dose in tratamento.doses"
              :key="dose.numero"
              class="dose"
              :class="`dose--${dose.situacao}`"
            >
              <span class="dose__hora ui-num">{{ horario(dose) }}</span>

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
                      icon="ph ph-x"
                      :aria-label="t('clinico.adesao.app.voltar')"
                      :title="t('clinico.adesao.app.voltar')"
                      @click="pulando = null"
                    />
                  </span>
                  <span v-else class="dose__acoes">
                    <Button
                      size="small"
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
                    class="ph ph-check-circle dose__icone"
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

/* O aparelho: borda de controle, cantos de celular e o fundo afundado da casa. */
.celular__moldura {
  position: relative;
  display: flex;
  overflow: hidden;
  width: min(22rem, 100%);
  height: min(44rem, calc(100vh - 11rem));
  min-height: 30rem;
  flex-direction: column;
  padding: 14px;
  border: 1px solid var(--linha-forte);
  border-radius: 28px;
  gap: 12px;
  background: var(--superficie-3);
}

/* ------------------------------------------------------------------ aviso */

.push {
  display: grid;
  flex: 0 0 auto;
  padding: 10px 12px;
  border: 1px solid var(--linha);
  border-radius: 16px;
  background: var(--superficie);
  box-shadow: var(--sombra-2);
  gap: 8px 10px;
  grid-template-columns: auto minmax(0, 1fr);
}

.push__marca {
  display: grid;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: var(--musgo);
  color: var(--sobre-musgo);
  font-size: 14px;
  place-items: center;
}

.push__texto {
  display: grid;
  min-width: 0;
  gap: 1px;
  color: var(--tinta);
  font-size: 13px;
  line-height: 1.35;
}

.push__texto small {
  color: var(--tinta-3);
  font-size: 11.5px;
}

.push__texto span {
  color: var(--tinta-2);
}

.push__acoes {
  display: flex;
  grid-column: 2;
  gap: 8px;
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
  transform: translateY(-8px);
}

/* ------------------------------------------------------------------ topo */

.topo {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 2px 4px;
}

.topo__avatar {
  display: grid;
  width: 38px;
  height: 38px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: var(--pets-fundo);
  color: var(--pets-tinta);
  font-size: 13px;
  font-weight: 650;
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
  color: var(--tinta);
  font-size: 16px;
  font-weight: 650;
}

.topo__identidade span {
  color: var(--tinta-2);
  font-size: 13px;
}

/* ------------------------------------------------------------------ rolagem */

.rolagem {
  display: grid;
  overflow-y: auto;
  flex: 1;
  align-content: start;
  gap: 10px;
  overscroll-behavior: contain;
}

.leitura {
  display: flex;
  align-items: flex-start;
  margin: 0;
  padding: 10px 12px;
  border-radius: 14px;
  gap: 8px;
  background: var(--superficie);
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.4;
}

.bloco {
  display: grid;
  padding: 12px 14px;
  border-radius: 16px;
  gap: 8px;
  background: var(--superficie);
}

.bloco__titulo {
  margin: 0;
  color: var(--tinta);
  font-size: 13.5px;
  font-weight: 600;
}

.vazio {
  margin: 16px 0;
  color: var(--tinta-2);
  font-size: 13px;
  text-align: center;
}

/* ------------------------------------------------------------------ receita nova */

.receita__detalhe,
.receita__posologia,
.receita__dica,
.receita__rotulo {
  margin: 0;
  color: var(--tinta-2);
  font-size: 12.5px;
  line-height: 1.4;
}

.receita__item {
  display: grid;
  padding-top: 8px;
  border-top: 1px solid var(--linha);
  gap: 4px;
  color: var(--tinta);
  font-size: 13px;
}

.receita__rotulo {
  margin-top: 4px;
  color: var(--tinta);
  font-weight: 600;
}

.receita__dica {
  font-size: 12px;
}

.receita__compartilhar,
.remedio__compartilhado {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--tinta-2);
  font-size: 12.5px;
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
  display: flex;
  align-items: center;
  gap: 10px;
}

.remedio__icone {
  display: grid;
  width: 30px;
  height: 30px;
  flex: none;
  place-items: center;
  border-radius: 9px;
  background: var(--musgo-fundo);
  color: var(--musgo);
  font-size: 16px;
}

.remedio__nome {
  display: grid;
  min-width: 0;
  gap: 1px;
  font-size: 12.5px;
}

.remedio__nome strong {
  color: var(--tinta);
  font-size: 14.5px;
  font-weight: 650;
}

.remedio__nome span,
.remedio__historico,
.encerrado span {
  color: var(--tinta-2);
}

.remedio__historico {
  margin: 0;
  font-size: 12px;
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
  align-items: start;
  padding-block: 8px;
  gap: 8px;
  grid-template-columns: 4.4rem minmax(0, 1fr);
  color: var(--tinta);
  font-size: 13px;
}

.dose + .dose {
  border-top: 1px solid var(--linha);
}

.dose__hora {
  padding-top: 6px;
  font-weight: 650;
}

.dose--PREVISTA .dose__hora,
.dose--SEM_REGISTRO .dose__hora {
  color: var(--tinta-3);
  font-weight: 550;
}

.dose__corpo {
  display: grid;
  min-width: 0;
  min-height: 32px;
  align-content: center;
  gap: 4px;
}

.dose__acoes {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.dose__pergunta {
  flex-basis: 100%;
  color: var(--tinta);
  font-weight: 600;
}

.dose__estado {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  color: var(--tinta-2);
}

.dose--DADA .dose__estado {
  color: var(--tinta);
  font-weight: 550;
}

.dose__icone {
  color: var(--musgo);
  font-size: 16px;
}

.dose__desfazer {
  margin-inline-start: auto;
}

.dose__recusa {
  color: var(--atencao-tinta);
  font-weight: 600;
  line-height: 1.35;
}

.encerrado {
  display: grid;
  margin: 0;
  gap: 1px;
  color: var(--tinta);
  font-size: 13px;
}

.avisos ul {
  display: grid;
  margin: 0;
  padding-inline-start: 18px;
  gap: 5px;
  color: var(--tinta-2);
  font-size: 12.5px;
  line-height: 1.45;
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
