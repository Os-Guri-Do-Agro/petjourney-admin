<script setup lang="ts">
/**
 * A carteirinha de vacina no celular do responsável.
 *
 * É a outra metade da demonstração: a clínica aplica à esquerda, e esta tela muda à direita, na
 * mesma hora. Por isso ela lê **só o contrato** (`CarteirinhaNoApp`, montada pela projeção que a
 * API vai repetir) e nunca o registro da clínica — se a prévia mostrasse o que a clínica sabe, a
 * demonstração mentiria sobre o que chega ao celular.
 *
 * O desenho segue a lista de vacinas que o app já tem (`app/screens/vacina/lista.tsx`): a faixa
 * de resumo no topo — quantas, a próxima, quantas atrasadas —, e os cartões agrupados por ano.
 * O que é novo é o que a clínica traz: o **selo** de quem aplicou, o lote, e a sequência do
 * protocolo com a próxima dose já marcada. A especificação para o app está em
 * `docs/clinico/14-*.md`.
 *
 * Moldura sóbria, como a do celular dos remédios: o que se julga aqui é o conteúdo. Só tokens do
 * Trilha, para a prévia acompanhar o tema da clínica (claro e escuro) sem cor própria.
 */
import Button from 'primevue/button'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import type {
  DoseNoPlanoVacinal,
  VacinaAplicadaNaClinica,
  VacinaNoPlanoVacinal,
} from '../../contrato/responsavel'
import { useClinicFormat } from '../../composables/useClinicFormat'
import { useRotulosDaVacina } from '../../composables/useRotulosDaVacina'
import type { CarteirinhaNoApp } from '../../data/repositories'
import { diffDays } from '../../domain/clinic-time'
import { clinicClock } from '../../stores/clinico'

const props = defineProps<{
  carteirinha: CarteirinhaNoApp
}>()

const { t } = useI18n()
const formato = useClinicFormat()
const rotulos = useRotulosDaVacina()

/** Quanto tempo o aviso "agora" fica no topo do celular depois de a clínica registrar. */
const AVISO_RECENTE_EM_MINUTOS = 30

const agora = computed(() => Date.parse(clinicClock.nowIso()))

const avisoRecente = computed(() => {
  const aviso = props.carteirinha.ultimaNotificacao

  if (!aviso) {
    return null
  }

  return agora.value - Date.parse(aviso.criadoEm) <= AVISO_RECENTE_EM_MINUTOS * 60_000
    ? aviso
    : null
})

/**
 * O aviso que alguém já dispensou. Ele entra **no fluxo**, empurrando a carteira para baixo, e
 * não por cima dela: sobreposto, escondia a faixa de resumo — o número que acabou de mudar e que
 * a plateia precisava ver mudar.
 */
const avisoFechado = ref<string | null>(null)

/** A linha que acabou de entrar leva a marca "nova" — é ela que a plateia procura. */
const idDaNova = computed(() => avisoRecente.value?.dados.aplicacaoId ?? null)

// ------------------------------------------------------------------ faixa de resumo

const plano = computed(() => props.carteirinha.plano)

/**
 * A próxima dose por vir, de qualquer vacina — a mais próxima no calendário, fora as atrasadas.
 * É a conta do `agenda.proxima` da lista do app: a atrasada já está no número vermelho.
 */
const proximaDose = computed(() => {
  const pendentes = plano.value.vacinas
    .map((item) => item.doses.find((dose) => dose.estado !== 'APLICADA'))
    .filter((dose): dose is DoseNoPlanoVacinal => Boolean(dose) && dose?.estado !== 'ATRASADA')
    .sort((a, b) => a.em.localeCompare(b.em))

  return pendentes[0] ?? null
})

// ------------------------------------------------------------------ protocolo

/**
 * O que entra no bloco de protocolo: o que está em andamento ou pede alguma coisa.
 *
 * O adulto em dia não aparece aqui — o reforço dele já está na faixa de cima. Um bloco que lista
 * tudo sempre é um bloco que o responsável aprende a pular.
 */
const emAndamento = computed(() =>
  plano.value.vacinas.filter(
    (item) => item.situacao !== 'EM_DIA' || item.aplicadasNaSerie < item.total,
  ),
)

function proximaDaVacina(item: VacinaNoPlanoVacinal): DoseNoPlanoVacinal | null {
  return item.doses.find((dose) => dose.estado !== 'APLICADA') ?? null
}

function fraseDaProxima(item: VacinaNoPlanoVacinal): string {
  const dose = proximaDaVacina(item)

  if (!dose) {
    return ''
  }

  const dias = diffDays(clinicClock.today(), dose.em)

  switch (dose.estado) {
    case 'ATRASADA':
      return t('clinico.vacinas.app.atrasadaHa', { dias: Math.abs(dias) }, Math.abs(dias))
    case 'DEVIDA':
      return t('clinico.vacinas.app.hoje')
    case 'AGUARDA_IDADE':
      return t('clinico.vacinas.app.aPartirDe', { data: rotulos.data(dose.em) })
    case 'PENDENTE':
      return t('clinico.vacinas.app.pendente')
    default:
      return t('clinico.vacinas.app.proximaEm', { data: rotulos.data(dose.em) })
  }
}

// ------------------------------------------------------------------ cartões por ano

const porAno = computed(() => {
  const grupos = new Map<string, VacinaAplicadaNaClinica[]>()

  for (const vacina of props.carteirinha.vacinas) {
    const ano = vacina.aplicadaEm.slice(0, 4)

    grupos.set(ano, [...(grupos.get(ano) ?? []), vacina])
  }

  return [...grupos.entries()].sort((a, b) => b[0].localeCompare(a[0]))
})

function numeroDaDose(vacina: VacinaAplicadaNaClinica): string {
  return vacina.dosesNaSerie > 1
    ? t('clinico.vacinas.doseDeTotal', { dose: vacina.dose, total: vacina.dosesNaSerie })
    : t('clinico.vacinas.plano.doseUnica')
}

/** A linha de lembrete do cartão — o `LembreteStatusInline` do app, com o que a clínica sabe. */
function lembrete(vacina: VacinaAplicadaNaClinica): { texto: string; tom: string } | null {
  if (vacina.situacao === 'EM_DIA' && !vacina.proximaDoseAgendada) {
    return null
  }

  if (vacina.situacao === 'VENCIDO') {
    const dias = Math.abs(diffDays(clinicClock.today(), vacina.proximaDoseEm))

    return { texto: t('clinico.vacinas.app.atrasadaHa', { dias }, dias), tom: 'risco' }
  }

  if (vacina.proximaDoseAgendada) {
    return {
      texto: t('clinico.vacinas.app.marcada', {
        data: rotulos.data(vacina.proximaDoseAgendada.inicio.slice(0, 10)),
        hora: formato.hora(vacina.proximaDoseAgendada.inicio),
      }),
      tom: 'marcada',
    }
  }

  /* A data chegou (e a carência ainda não passou): a mesma frase do bloco de protocolo. */
  if (diffDays(clinicClock.today(), vacina.proximaDoseEm) <= 0) {
    return { texto: t('clinico.vacinas.app.hoje'), tom: 'atencao' }
  }

  return {
    texto: t('clinico.vacinas.app.proximaEm', { data: rotulos.data(vacina.proximaDoseEm) }),
    tom: vacina.situacao === 'PROXIMO' ? 'atencao' : 'neutro',
  }
}

function via(valor: VacinaAplicadaNaClinica['via']): string {
  return valor ? t(`clinico.vacinas.via.${valor.toLowerCase()}`) : ''
}
</script>

<template>
  <div class="celular">
    <div class="celular__moldura">
      <!--
        O aviso que o responsável recebe. Aparece quando a clínica acabou de registrar: é o "na
        hora" da carteirinha, dito do jeito que o celular diz.
      -->
      <Transition name="aviso">
        <div
          v-if="avisoRecente && avisoRecente.id !== avisoFechado"
          :key="avisoRecente.id"
          class="push"
          role="status"
        >
          <span class="push__marca" aria-hidden="true"><i class="ph ph-bell" /></span>
          <span class="push__texto">
            <small>{{ t('clinico.vacinas.app.pushOrigem') }}</small>
            <strong>{{ avisoRecente.titulo }}</strong>
            <span>{{ avisoRecente.corpo }}</span>
          </span>
          <Button
            icon="ph ph-x"
            severity="secondary"
            text
            rounded
            size="small"
            class="push__fechar"
            :aria-label="t('clinico.vacinas.app.fecharAviso')"
            @click="avisoFechado = avisoRecente.id"
          />
        </div>
      </Transition>

      <header class="topo">
        <span class="topo__avatar" aria-hidden="true">
          <img v-if="carteirinha.petFotoUrl" :src="carteirinha.petFotoUrl" alt="" />
          <template v-else>{{ carteirinha.petIniciais }}</template>
        </span>
        <span class="topo__identidade">
          <strong>{{ t('clinico.vacinas.app.titulo') }}</strong>
          <span>
            {{ carteirinha.petNome }}
            <template v-if="carteirinha.nascimento">
              · {{ formato.idade(carteirinha.nascimento) }}</template
            >
          </span>
        </span>
      </header>

      <!--
        A faixa de resumo do app, com as regras dele: "atrasadas" só aparece quando há atraso, e a
        próxima é a primeira que **não** está atrasada — a atrasada já tem o próprio número.
      -->
      <dl class="resumo">
        <div>
          <dt>{{ t('clinico.vacinas.app.resumo.vacinas') }}</dt>
          <dd class="ui-num">{{ carteirinha.vacinas.length }}</dd>
        </div>
        <div>
          <dt>{{ t('clinico.vacinas.app.resumo.proxima') }}</dt>
          <dd class="ui-num">{{ proximaDose ? rotulos.data(proximaDose.em) : '–' }}</dd>
        </div>
        <div v-if="plano.atrasadas > 0" class="resumo--risco">
          <dt>{{ t('clinico.vacinas.app.resumo.atrasadas') }}</dt>
          <dd class="ui-num">
            <i class="ph ph-warning-circle" aria-hidden="true" />
            {{ plano.atrasadas }}
          </dd>
        </div>
      </dl>

      <div class="rolagem">
        <!--
          O protocolo: a sequência de cada vacina em andamento, com onde o pet está nela. É o que
          o responsável de um filhote monta de cabeça hoje — e erra.
        -->
        <section v-if="emAndamento.length > 0" class="protocolo">
          <h4>{{ t('clinico.vacinas.app.protocolo', { clinica: plano.clinica.nome }) }}</h4>

          <ul>
            <li v-for="item in emAndamento" :key="item.vacina.nome" class="protocolo__linha">
              <span class="protocolo__nome">
                <strong>{{ item.vacina.nome }}</strong>
                <span
                  v-if="item.total > 1"
                  class="pontos"
                  :aria-label="
                    t('clinico.vacinas.doseDeTotal', {
                      dose: item.aplicadasNaSerie,
                      total: item.total,
                    })
                  "
                >
                  <span
                    v-for="numero in item.total"
                    :key="numero"
                    class="pontos__ponto"
                    :class="{
                      'pontos__ponto--cheio': numero <= item.aplicadasNaSerie,
                      'pontos__ponto--agora': numero === item.aplicadasNaSerie + 1,
                    }"
                  />
                </span>
              </span>
              <span class="protocolo__quando" :class="`protocolo__quando--${item.situacao}`">
                {{ fraseDaProxima(item) }}
              </span>
              <span v-if="proximaDaVacina(item)?.agendamento" class="protocolo__marcada">
                <i class="ph ph-calendar-blank" aria-hidden="true" />
                {{
                  t('clinico.vacinas.app.marcada', {
                    data: rotulos.data(proximaDaVacina(item)!.agendamento!.inicio.slice(0, 10)),
                    hora: formato.hora(proximaDaVacina(item)!.agendamento!.inicio),
                  })
                }}
              </span>
            </li>
          </ul>

          <p v-if="plano.opcionaisNaoIniciadas.length > 0" class="protocolo__opcionais">
            {{
              t('clinico.vacinas.app.opcionais', {
                lista: plano.opcionaisNaoIniciadas.map((item) => item.nome).join(', '),
              })
            }}
          </p>
        </section>

        <p v-if="carteirinha.vacinas.length === 0" class="vazio">
          {{ t('clinico.vacinas.app.vazio') }}
        </p>

        <section v-for="[ano, vacinas] in porAno" :key="ano" class="ano">
          <h5>{{ ano }}</h5>

          <TransitionGroup tag="ul" name="linha" class="ano__lista">
            <li
              v-for="vacina in vacinas"
              :key="vacina.id"
              class="cartao"
              :class="{ 'cartao--nova': vacina.id === idDaNova }"
            >
              <span class="cartao__icone" aria-hidden="true"><i class="ph ph-shield" /></span>

              <span class="cartao__corpo">
                <span class="cartao__titulo">
                  <strong>{{ vacina.vacina.nome }}</strong>
                  <span v-if="vacina.id === idDaNova" class="cartao__nova">
                    {{ t('clinico.vacinas.app.nova') }}
                  </span>
                </span>
                <span class="cartao__meta ui-num">
                  {{ numeroDaDose(vacina) }} · {{ rotulos.data(vacina.aplicadaEm.slice(0, 10)) }}
                </span>

                <!--
                  O selo. Só a dose aplicada aqui leva o nome da clínica como quem aplicou; a de
                  fora diz onde foi e quem registrou — a clínica não assina o que não aplicou.
                -->
                <span v-if="vacina.origem === 'CLINICA'" class="selo">
                  <i class="ph ph-seal-check" aria-hidden="true" />
                  {{ t('clinico.vacinas.app.aplicadaNa', { clinica: vacina.clinica.nome }) }}
                </span>
                <span v-else-if="vacina.externa" class="selo selo--externa">
                  <i class="ph ph-map-pin" aria-hidden="true" />
                  {{ t('clinico.vacinas.app.outroLocal', { local: vacina.externa.local }) }}
                </span>

                <span v-if="vacina.origem === 'CLINICA' && vacina.lote" class="cartao__lote">
                  {{ t('clinico.vacinas.app.lote', { lote: vacina.lote }) }}
                  <template v-if="vacina.validadeLote">
                    ·
                    {{ t('clinico.vacinas.validade', { data: rotulos.data(vacina.validadeLote) }) }}
                  </template>
                  <template v-if="vacina.via"> · {{ via(vacina.via) }}</template>
                </span>
                <span v-else-if="vacina.externa" class="cartao__lote">
                  {{
                    t('clinico.vacinas.app.registradaPor', {
                      clinica: vacina.clinica.nome,
                    })
                  }}
                  ·
                  <span :class="{ cartao__relato: vacina.externa.procedencia === 'RELATO' }">
                    {{ t(`clinico.vacinas.app.procedencia.${vacina.externa.procedencia}`) }}
                  </span>
                </span>

                <span
                  v-if="lembrete(vacina)"
                  class="cartao__lembrete"
                  :class="`cartao__lembrete--${lembrete(vacina)!.tom}`"
                >
                  <i
                    :class="
                      lembrete(vacina)!.tom === 'risco'
                        ? 'ph ph-warning-circle'
                        : lembrete(vacina)!.tom === 'marcada'
                          ? 'ph ph-calendar-blank'
                          : 'ph ph-clock'
                    "
                    aria-hidden="true"
                  />
                  {{ lembrete(vacina)!.texto }}
                </span>
              </span>
            </li>
          </TransitionGroup>
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
  display: flex;
  flex: 0 0 auto;
  align-items: flex-start;
  padding: 10px 8px 10px 12px;
  border: 1px solid var(--linha);
  border-radius: 16px;
  background: var(--superficie);
  box-shadow: var(--sombra-2);
  gap: 10px;
}

.push__fechar {
  flex: 0 0 auto;
  margin-inline-start: auto;
}

.push__marca {
  display: grid;
  width: 28px;
  height: 28px;
  flex: 0 0 auto;
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

/* ------------------------------------------------------------------ topo e resumo */

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

.resumo {
  display: grid;
  margin: 0;
  padding: 10px 0;
  border-radius: 16px;
  background: var(--superficie);
  grid-auto-columns: minmax(0, 1fr);
  grid-auto-flow: column;
}

.resumo > div {
  display: grid;
  justify-items: center;
  gap: 1px;
}

.resumo > div + div {
  border-inline-start: 1px solid var(--linha);
}

.resumo dt {
  color: var(--tinta-2);
  font-size: 12px;
  font-weight: 550;
}

.resumo dd {
  display: inline-flex;
  align-items: center;
  margin: 0;
  gap: 4px;
  color: var(--tinta);
  font-size: 17px;
  font-weight: 650;
}

.resumo--risco dd {
  color: var(--risco-tinta);
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

.protocolo {
  display: grid;
  padding: 12px 14px;
  border-radius: 16px;
  gap: 8px;
  background: var(--superficie);
}

.protocolo h4 {
  margin: 0;
  color: var(--tinta);
  font-size: 13.5px;
  font-weight: 600;
}

.protocolo ul {
  display: grid;
  margin: 0;
  padding: 0;
  gap: 8px;
  list-style: none;
}

.protocolo__linha {
  display: grid;
  gap: 2px;
}

.protocolo__linha + .protocolo__linha {
  padding-top: 8px;
  border-top: 1px solid var(--linha);
}

.protocolo__nome {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: var(--tinta);
  font-size: 13px;
}

.protocolo__nome strong {
  font-weight: 600;
}

.protocolo__quando,
.protocolo__marcada {
  color: var(--tinta-2);
  font-size: 12.5px;
}

.protocolo__quando--ATRASADA {
  color: var(--risco-tinta);
  font-weight: 600;
}

.protocolo__quando--DEVIDA,
.protocolo__quando--A_VENCER {
  color: var(--atencao-tinta);
  font-weight: 600;
}

.protocolo__marcada {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--musgo);
  font-weight: 600;
}

.protocolo__opcionais {
  margin: 0;
  color: var(--tinta-2);
  font-size: 12px;
  line-height: 1.4;
}

.pontos {
  display: inline-flex;
  gap: 3px;
}

.pontos__ponto {
  width: 9px;
  height: 9px;
  border: 1.5px solid var(--linha-forte);
  border-radius: 50%;
}

.pontos__ponto--cheio {
  border-color: var(--musgo);
  background: var(--musgo);
}

.pontos__ponto--agora {
  border-color: var(--clinica);
}

.vazio {
  margin: 16px 0;
  color: var(--tinta-2);
  font-size: 13px;
  text-align: center;
}

.ano {
  display: grid;
  gap: 8px;
}

.ano h5 {
  margin: 4px 4px 0;
  color: var(--tinta-2);
  font-family: var(--font-dados);
  font-size: 13px;
  font-weight: 650;
}

.ano__lista {
  display: grid;
  margin: 0;
  padding: 0;
  gap: 8px;
  list-style: none;
}

.cartao {
  display: grid;
  padding: 12px;
  border: 1px solid transparent;
  border-radius: 16px;
  gap: 10px;
  background: var(--superficie);
  grid-template-columns: auto minmax(0, 1fr);
}

/* A linha nova ganha a borda da clínica: é o que a plateia procura, sem pintar o cartão. */
.cartao--nova {
  border-color: var(--clinica);
}

.cartao__icone {
  display: grid;
  width: 30px;
  height: 30px;
  border-radius: 9px;
  background: var(--musgo-fundo);
  color: var(--musgo);
  font-size: 15px;
  place-items: center;
}

.cartao__corpo {
  display: grid;
  min-width: 0;
  gap: 2px;
  color: var(--tinta);
  font-size: 12.5px;
}

.cartao__titulo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.cartao__titulo strong {
  font-size: 14px;
  font-weight: 650;
}

.cartao__nova {
  padding: 1px 7px;
  border-radius: 6px;
  background: var(--clinica-fundo);
  color: var(--clinica-tinta);
  font-size: 11.5px;
  font-weight: 600;
}

.cartao__meta,
.cartao__lote {
  color: var(--tinta-2);
}

.selo {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--musgo);
  font-weight: 600;
}

.selo--externa {
  color: var(--tinta-2);
}

.cartao__relato {
  color: var(--atencao-tinta);
  font-weight: 600;
}

.cartao__lembrete {
  display: inline-flex;
  align-items: center;
  margin-top: 3px;
  gap: 5px;
  color: var(--tinta-2);
  font-weight: 550;
}

.cartao__lembrete--risco {
  color: var(--risco-tinta);
  font-weight: 650;
}

.cartao__lembrete--atencao {
  color: var(--atencao-tinta);
}

.cartao__lembrete--marcada {
  color: var(--musgo);
}

/* A linha que entra na lista: o movimento diz o que mudou, e só isso. */
.linha-enter-active {
  transition:
    opacity 180ms ease-out,
    transform 180ms ease-out;
}

.linha-enter-from {
  opacity: 0;
  transform: translateY(-6px);
}

.linha-move {
  transition: transform 180ms ease-out;
}

@media (prefers-reduced-motion: reduce) {
  .aviso-enter-active,
  .aviso-leave-active,
  .linha-enter-active,
  .linha-move {
    transition: none;
  }
}
</style>
