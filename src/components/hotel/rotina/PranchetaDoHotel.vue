<script setup lang="ts">
/**
 * A prancheta do hotel pela API (E7-05a, guia e7 42 e 45): a folha de papel do canil, em rondas.
 *
 * - **Para agora**: as rondas com alguma tarefa na janela ou atrasada (as de dias anteriores
 *   dizem o dia). **Mais tarde**: o resto do recorte. **Já resolvidas**, recolhidas.
 * - Ao lado, o **turno** (quem está com ele, as graves esperando a ligação, a passagem) e os
 *   **hóspedes**: um por animal na casa, os urgentes primeiro, com "Na internação" e o alerta da
 *   saída vencida ("A rotina deste animal parou...").
 * - O tablet se relê a cada minuto pedindo só as **próximas horas** (`de`, `ate`); o dia inteiro,
 *   quando a pessoa pede. As pendentes atrasadas de antes do recorte vêm sempre.
 * - Prancheta ocupada (503 `ROTINA_OCUPADA`): espera o tempo pedido e tenta de novo, sem mostrar
 *   erro na primeira vez.
 *
 * A situação de cada tarefa vem pronta do servidor: nenhuma regra de atraso mora aqui. O veterinário
 * lê; marcar é de quem cuida da rotina, com ficha de profissional.
 */
import { PhCat, PhDog, PhPawPrint } from '@phosphor-icons/vue'
import Button from 'primevue/button'
import SelectButton from 'primevue/selectbutton'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useRotulosDasReservas } from '@/components/hotel/reservas/useRotulosDasReservas'
import UiPagina from '@/components/ui/UiPagina.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { invalidarPendenciasDoPortal } from '@/composables/usePendenciasDoPortal'
import {
  DIAS_PARA_FRENTE,
  DIAS_PARA_TRAS,
  lerPrancheta,
  type HospedeDaPrancheta,
  type Prancheta,
  type RecorteDaPrancheta,
  type RondaDaPrancheta as Ronda,
  type TarefaDaPrancheta,
} from '@/service/parceiro/hotel-rotina-service'

import MarcarTarefaGaveta from './MarcarTarefaGaveta.vue'
import RondaDaPrancheta from './RondaDaPrancheta.vue'
import {
  diaDaParede,
  diasEntre,
  esperaAntesDeTentarDeNovo,
  horaDaParede,
  linhasDaRonda,
  recorteDasProximasHoras,
  rondasPorTempo,
  somarDias,
  tarefasPorId,
  tomDoHospede,
} from './rotina-do-hotel'
import TurnoDoHotel from './TurnoDoHotel.vue'
import { useMarcacaoDaTarefa } from './useMarcacaoDaTarefa'

/** O tablet se relê a cada minuto, com a aba visível. */
const RELER_MS = 60_000

const { t } = useI18n()
const rotulos = useRotulosDasReservas()
const { store, parceiroQuery } = useParceiroPortal()

const prancheta = ref<Prancheta | null>(null)
const carregando = ref(false)
const erro = ref('')
const erroAoReler = ref('')
/** `null`: hoje na casa (o servidor decide). */
const dia = ref<string | null>(null)
const modo = ref<'PROXIMAS' | 'DIA'>('PROXIMAS')
const passadoAberto = ref(false)
const turnoRef = ref<InstanceType<typeof TurnoDoHotel> | null>(null)

let tentativasSilenciosas = 0
let espera: ReturnType<typeof setTimeout> | null = null
let relendo: ReturnType<typeof setInterval> | null = null

const hoje = computed(() => (prancheta.value ? diaDaParede(prancheta.value.agora) : null))
const ehHoje = computed(() => !dia.value || dia.value === hoje.value)

/** O relógio da casa: o da última leitura; antes dela, o do turno; sem os dois, o do aparelho. */
function horaDaCasa() {
  const agora = prancheta.value?.agora ?? turnoRef.value?.agora ?? null
  return (agora ? horaDaParede(agora) : null) ?? new Date().getHours()
}

function recorte(): RecorteDaPrancheta {
  const doDia = dia.value ? { dia: dia.value } : {}
  if (modo.value === 'DIA' || !ehHoje.value) return doDia
  return { ...doDia, ...recorteDasProximasHoras(horaDaCasa()) }
}

async function carregar() {
  if (espera) {
    clearTimeout(espera)
    espera = null
  }
  carregando.value = true
  try {
    prancheta.value = await lerPrancheta(recorte(), parceiroQuery())
    erro.value = ''
    erroAoReler.value = ''
    tentativasSilenciosas = 0
  } catch (err) {
    const esperar = esperaAntesDeTentarDeNovo(err, tentativasSilenciosas)
    if (esperar !== null) {
      tentativasSilenciosas += 1
      espera = setTimeout(() => void carregar(), esperar)
      return
    }
    tentativasSilenciosas = 0
    const lido = lerErroDoCadastro(err, t('rotinaDoHotel.prancheta.erro'))
    const texto =
      lido.codigo === 'ROTINA_OCUPADA' ? t('rotinaDoHotel.prancheta.ocupada') : lido.mensagem
    if (prancheta.value) erroAoReler.value = texto
    else erro.value = texto
  } finally {
    carregando.value = false
  }
}

const marcacao = useMarcacaoDaTarefa(() => {
  void carregar()
  void turnoRef.value?.carregar()
  invalidarPendenciasDoPortal()
})

onMounted(() => {
  void carregar()
  relendo = setInterval(() => {
    if (document.visibilityState !== 'visible') return
    if (marcacao.gavetaAberta.value || marcacao.ocupada.value) return
    void carregar()
  }, RELER_MS)
})
onBeforeUnmount(() => {
  if (relendo) clearInterval(relendo)
  if (espera) clearTimeout(espera)
})

/* ------------------------------------------------------------------------------- o dia */

const primeiroDia = computed(() => (hoje.value ? somarDias(hoje.value, -DIAS_PARA_TRAS) : null))
const ultimoDia = computed(() => (hoje.value ? somarDias(hoje.value, DIAS_PARA_FRENTE) : null))
const diaMostrado = computed(() => prancheta.value?.dia ?? dia.value ?? hoje.value ?? '')

function nomeDoDia(valor: string) {
  if (!hoje.value) return rotulos.dia(valor)
  const distancia = diasEntre(hoje.value, valor)
  if (distancia === 0) return t('rotinaDoHotel.dia.hoje')
  if (distancia === -1) return t('rotinaDoHotel.dia.ontem')
  if (distancia === 1) return t('rotinaDoHotel.dia.amanha')
  return rotulos.dia(valor)
}

function irPara(passo: number) {
  if (!diaMostrado.value) return
  dia.value = somarDias(diaMostrado.value, passo)
  void carregar()
}

function voltarParaHoje() {
  dia.value = null
  void carregar()
}

const opcoesDeModo = computed(() => [
  { valor: 'PROXIMAS', rotulo: t('rotinaDoHotel.prancheta.proximasHoras') },
  { valor: 'DIA', rotulo: t('rotinaDoHotel.prancheta.diaInteiro') },
])

function trocarModo(novo: 'PROXIMAS' | 'DIA') {
  modo.value = novo
  void carregar()
}

/* ------------------------------------------------------------------------------- as rondas */

const partes = computed(() => rondasPorTempo(prancheta.value?.rondas ?? []))
const porId = computed(() => tarefasPorId(prancheta.value?.rondas ?? []))
const nomes = computed(
  () => new Map([...porId.value.values()].map((tarefa) => [tarefa.id, tarefa.pacienteNome])),
)

function outroDia(ronda: Ronda) {
  const doDia = prancheta.value?.dia
  return doDia && ronda.dia !== doDia ? nomeDoDia(ronda.dia).toLocaleLowerCase() : ''
}

const pendentesEm = (rondas: Ronda[]) => rondas.reduce((soma, ronda) => soma + ronda.pendentes, 0)
const resolvidasNoPassado = computed(() =>
  partes.value.PASSADO.reduce((soma, ronda) => soma + linhasDaRonda(ronda).length, 0),
)

const escreve = computed(() => Boolean(store.modulo('HOTEL')?.podeEscrever))
const podeMarcar = computed(() => escreve.value && store.temPermissao('hotel.rotina'))
const meuNome = computed(() => store.eu?.profissional?.nome ?? null)
const agoraMs = computed(() => (prancheta.value ? Date.parse(prancheta.value.agora) : Date.now()))

function ronda(chave: string, ids: string[]) {
  void marcacao.ronda(chave, ids, nomes.value)
}

/* ------------------------------------------------------------------------------ o resumo */

/** "Segunda-feira, 9 de novembro": o dia da prancheta por extenso, no calendário da casa. */
function diaPorExtenso(valor: string) {
  const [ano, mes, d] = valor.split('-').map(Number)
  const texto = new Intl.DateTimeFormat(rotulos.intl(), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(ano ?? 1970, (mes ?? 1) - 1, d ?? 1)))
  return texto.charAt(0).toLocaleUpperCase(rotulos.intl()) + texto.slice(1)
}

const resumo = computed(() => {
  const lida = prancheta.value
  if (!lida) return ''
  const partesDoResumo = [
    t(
      'rotinaDoHotel.prancheta.progresso',
      { feitas: lida.progresso.resolvidas, total: lida.progresso.total },
      lida.progresso.total,
    ),
  ]
  if (lida.atrasadas)
    partesDoResumo.push(
      t('rotinaDoHotel.prancheta.atrasadas', { n: lida.atrasadas }, lida.atrasadas),
    )
  if (lida.medicacoesAtrasadas)
    partesDoResumo.push(
      t(
        'rotinaDoHotel.prancheta.medicacoesAtrasadas',
        { n: lida.medicacoesAtrasadas },
        lida.medicacoesAtrasadas,
      ),
    )
  return `${diaPorExtenso(lida.dia)}. ${partesDoResumo.join(' · ')}`
})

const proxima = computed(() => {
  const tarefa = prancheta.value?.proxima
  if (!tarefa) return ''
  return t('rotinaDoHotel.prancheta.proxima', {
    tarefa: t(`rotinaDoHotel.kind.${tarefa.kind}`),
    hora: tarefa.hora,
    nome: tarefa.pacienteNome,
  })
})

/* ---------------------------------------------------------------------------- os hóspedes */

const hospedes = computed(() => prancheta.value?.hospedes ?? [])

function iconeDaEspecie(hospede: HospedeDaPrancheta) {
  if (hospede.especie === 'CACHORRO') return PhDog
  if (hospede.especie === 'GATO') return PhCat
  return PhPawPrint
}

function foco(hospede: HospedeDaPrancheta) {
  const tarefa: TarefaDaPrancheta | undefined = hospede.focoId
    ? porId.value.get(hospede.focoId)
    : undefined
  if (!tarefa) return ''
  const chave =
    tarefa.situacao === 'ATRASADA'
      ? 'rotinaDoHotel.hospedes.atrasada'
      : 'rotinaDoHotel.hospedes.proxima'
  return t(chave, { tarefa: t(`rotinaDoHotel.kind.${tarefa.kind}`), hora: tarefa.hora })
}

function metaDoHospede(hospede: HospedeDaPrancheta) {
  return [
    hospede.acomodacaoNome,
    hospede.progresso.total
      ? t('rotinaDoHotel.hospedes.progresso', {
          feitas: hospede.progresso.resolvidas,
          total: hospede.progresso.total,
        })
      : '',
    foco(hospede),
  ]
    .filter(Boolean)
    .join(' · ')
}
</script>

<template>
  <UiPagina
    :resumo="resumo"
    :carregando="carregando && !prancheta"
    :erro="prancheta ? '' : erro"
    @tentar-de-novo="carregar"
  >
    <div v-if="prancheta" class="pr">
      <!-- O que pede alguém agora, em frase: a rotina parada é do balcão, sempre em vermelho. -->
      <p v-if="prancheta.rotinasParadas" class="ui-folha pr__recado" role="status">
        <i class="ph ph-warning-octagon pr__icone--risco" aria-hidden="true" />
        <span>{{
          t(
            'rotinaDoHotel.prancheta.rotinasParadas',
            { n: prancheta.rotinasParadas },
            prancheta.rotinasParadas,
          )
        }}</span>
      </p>
      <p
        v-if="marcacao.recado.value"
        class="ui-folha pr__recado"
        :role="marcacao.recado.value.tom === 'erro' ? 'alert' : 'status'"
      >
        <i
          :class="
            marcacao.recado.value.tom === 'ok'
              ? 'ph ph-check-circle pr__icone--ok'
              : marcacao.recado.value.tom === 'erro'
                ? 'ph ph-warning-circle pr__icone--risco'
                : 'ph ph-info pr__icone--atencao'
          "
          aria-hidden="true"
        />
        <span>{{ marcacao.recado.value.texto }}</span>
      </p>
      <p v-if="erroAoReler" class="ui-folha pr__recado" role="alert">
        <i class="ph ph-cloud-slash pr__icone--atencao" aria-hidden="true" />
        <span>{{ t('rotinaDoHotel.prancheta.naoReleu', { motivo: erroAoReler }) }}</span>
        <Button
          type="button"
          size="small"
          severity="secondary"
          outlined
          :label="t('rotinaDoHotel.prancheta.tentarDeNovo')"
          :loading="carregando"
          @click="carregar"
        />
      </p>

      <!-- O dia e o recorte: fora das caixas, em cima. -->
      <div class="pr__barra">
        <span class="pr__dia" role="group" :aria-label="t('rotinaDoHotel.dia.rotulo')">
          <Button
            type="button"
            size="small"
            severity="secondary"
            outlined
            icon="ph ph-caret-left"
            :aria-label="t('rotinaDoHotel.dia.anterior')"
            :disabled="!primeiroDia || diaMostrado <= primeiroDia || carregando"
            @click="irPara(-1)"
          />
          <strong class="pr__nome-do-dia">{{ nomeDoDia(diaMostrado) }}</strong>
          <Button
            type="button"
            size="small"
            severity="secondary"
            outlined
            icon="ph ph-caret-right"
            :aria-label="t('rotinaDoHotel.dia.seguinte')"
            :disabled="!ultimoDia || diaMostrado >= ultimoDia || carregando"
            @click="irPara(1)"
          />
          <Button
            v-if="!ehHoje"
            type="button"
            size="small"
            severity="secondary"
            outlined
            :label="t('rotinaDoHotel.dia.voltarParaHoje')"
            @click="voltarParaHoje"
          />
        </span>
        <SelectButton
          v-if="ehHoje"
          :model-value="modo"
          :options="opcoesDeModo"
          option-label="rotulo"
          option-value="valor"
          :allow-empty="false"
          :aria-label="t('rotinaDoHotel.prancheta.recorte')"
          :disabled="carregando"
          @update:model-value="trocarModo"
        />
      </div>

      <div class="pr__grade">
        <div class="pr__principal">
          <section class="ui-folha ui-cartao" aria-labelledby="pr-agora">
            <header class="ui-cartao__cabeca">
              <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-clock" /></span>
              <span class="ui-cartao__titulos">
                <h2 id="pr-agora" class="ui-cartao__titulo">
                  {{ t('rotinaDoHotel.prancheta.paraAgora') }}
                </h2>
                <p class="ui-cartao__descricao">
                  {{
                    pendentesEm(partes.AGORA)
                      ? t(
                          'rotinaDoHotel.prancheta.pendentes',
                          { n: pendentesEm(partes.AGORA) },
                          pendentesEm(partes.AGORA),
                        )
                      : t('rotinaDoHotel.prancheta.emDia')
                  }}
                </p>
              </span>
            </header>
            <template v-if="partes.AGORA.length">
              <RondaDaPrancheta
                v-for="item in partes.AGORA"
                :key="item.chave"
                :ronda="item"
                :outro-dia="outroDia(item)"
                :pode-marcar="podeMarcar"
                :meu-nome="meuNome"
                :agora-ms="agoraMs"
                :ocupada="marcacao.ocupada.value"
                @feito="marcacao.feito"
                @nao-feito="marcacao.naoFeito"
                @desfazer="marcacao.desfazer"
                @ronda="(ids) => ronda(item.chave, ids)"
              />
            </template>
            <p v-else class="pr__nota">
              {{ t('rotinaDoHotel.prancheta.nadaAgora')
              }}<template v-if="proxima"> {{ proxima }}</template>
            </p>
          </section>

          <section
            v-if="partes.ADIANTE.length"
            class="ui-folha ui-cartao"
            aria-labelledby="pr-adiante"
          >
            <header class="ui-cartao__cabeca">
              <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-fast-forward" /></span>
              <span class="ui-cartao__titulos">
                <h2 id="pr-adiante" class="ui-cartao__titulo">
                  {{ t('rotinaDoHotel.prancheta.maisTarde') }}
                </h2>
                <p class="ui-cartao__descricao">
                  {{
                    t(
                      'rotinaDoHotel.prancheta.pendentes',
                      { n: pendentesEm(partes.ADIANTE) },
                      pendentesEm(partes.ADIANTE),
                    )
                  }}
                </p>
              </span>
            </header>
            <RondaDaPrancheta
              v-for="item in partes.ADIANTE"
              :key="item.chave"
              :ronda="item"
              :outro-dia="outroDia(item)"
              :pode-marcar="podeMarcar"
              :meu-nome="meuNome"
              :agora-ms="agoraMs"
              :ocupada="marcacao.ocupada.value"
              @feito="marcacao.feito"
              @nao-feito="marcacao.naoFeito"
              @desfazer="marcacao.desfazer"
              @ronda="(ids) => ronda(item.chave, ids)"
            />
          </section>

          <section
            v-if="partes.PASSADO.length"
            class="ui-folha ui-cartao"
            aria-labelledby="pr-passado"
          >
            <header class="ui-cartao__cabeca">
              <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-check-circle" /></span>
              <span class="ui-cartao__titulos">
                <h2 id="pr-passado" class="ui-cartao__titulo">
                  {{ t('rotinaDoHotel.prancheta.resolvidas') }}
                </h2>
                <p class="ui-cartao__descricao">
                  {{
                    t(
                      'rotinaDoHotel.prancheta.resolvidasConta',
                      { n: resolvidasNoPassado },
                      resolvidasNoPassado,
                    )
                  }}
                </p>
              </span>
              <Button
                type="button"
                size="small"
                severity="secondary"
                outlined
                :icon="passadoAberto ? 'ph ph-caret-up' : 'ph ph-caret-down'"
                :label="passadoAberto ? t('rotinaDoHotel.ocultar') : t('rotinaDoHotel.ver')"
                :aria-expanded="passadoAberto"
                aria-controls="pr-passado-lista"
                @click="passadoAberto = !passadoAberto"
              />
            </header>
            <div v-if="passadoAberto" id="pr-passado-lista">
              <RondaDaPrancheta
                v-for="item in partes.PASSADO"
                :key="item.chave"
                :ronda="item"
                :outro-dia="outroDia(item)"
                :pode-marcar="podeMarcar"
                :meu-nome="meuNome"
                :agora-ms="agoraMs"
                :ocupada="marcacao.ocupada.value"
                @feito="marcacao.feito"
                @nao-feito="marcacao.naoFeito"
                @desfazer="marcacao.desfazer"
                @ronda="(ids) => ronda(item.chave, ids)"
              />
            </div>
          </section>

          <p v-if="prancheta.truncado" class="pr__dica">
            <i class="ph ph-scissors" aria-hidden="true" />
            {{ t('rotinaDoHotel.prancheta.truncado') }}
          </p>
          <p v-if="prancheta.atrasoTruncado" class="pr__dica">
            <i class="ph ph-scissors" aria-hidden="true" />
            {{ t('rotinaDoHotel.prancheta.atrasoTruncado') }}
          </p>
        </div>

        <div class="pr__lateral">
          <TurnoDoHotel
            v-if="store.temPermissao('hotel.rotina')"
            ref="turnoRef"
            :pode-executar="podeMarcar"
            @mudou="carregar"
          />

          <section class="ui-folha ui-cartao" aria-labelledby="pr-hospedes">
            <header class="ui-cartao__cabeca">
              <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-heart" /></span>
              <span class="ui-cartao__titulos">
                <h2 id="pr-hospedes" class="ui-cartao__titulo">
                  {{ t('rotinaDoHotel.hospedes.titulo') }}
                </h2>
                <p class="ui-cartao__descricao">
                  {{ t('rotinaDoHotel.hospedes.naCasa', { n: hospedes.length }, hospedes.length) }}
                </p>
              </span>
            </header>
            <ul v-if="hospedes.length" class="ui-lista">
              <li
                v-for="hospede in hospedes"
                :key="hospede.hospedagemId"
                class="ui-linha ui-linha--clicavel"
                :class="{
                  'ui-marca ui-marca--risco': tomDoHospede(hospede) === 'risco',
                  'ui-marca ui-marca--atencao': tomDoHospede(hospede) === 'atencao',
                }"
              >
                <RouterLink :to="`/hotel/hospedagem/${hospede.hospedagemId}`" class="pr__hospede">
                  <component
                    :is="iconeDaEspecie(hospede)"
                    class="pr__especie"
                    weight="duotone"
                    aria-hidden="true"
                  />
                  <span class="ui-linha__texto">
                    <strong class="ui-linha__titulo pr__nome">
                      {{ hospede.pacienteNome }}
                      <span v-if="hospede.naInternacao" class="ui-selo ui-selo--contorno">{{
                        t('rotinaDoHotel.hospedes.naInternacao')
                      }}</span>
                      <span
                        v-if="hospede.alertas.includes('SAIDA_VENCIDA')"
                        class="ui-selo ui-selo--atencao"
                        >{{ t('rotinaDoHotel.hospedes.saidaVencida') }}</span
                      >
                    </strong>
                    <span class="ui-linha__meta">{{ metaDoHospede(hospede) }}</span>
                    <span
                      v-if="hospede.alertas.includes('ROTINA_PARADA_SAIDA_VENCIDA')"
                      class="pr__parada"
                    >
                      <i class="ph ph-warning-octagon" aria-hidden="true" />
                      {{ t('rotinaDoHotel.hospedes.rotinaParada') }}
                    </span>
                  </span>
                  <i class="ph ph-caret-right ui-linha__seta" aria-hidden="true" />
                </RouterLink>
              </li>
            </ul>
            <p v-else class="pr__nota">{{ t('rotinaDoHotel.hospedes.vazio') }}</p>
          </section>
        </div>
      </div>
    </div>

    <MarcarTarefaGaveta
      v-model:visible="marcacao.gavetaAberta.value"
      :pedido="marcacao.pedido.value"
      @marcada="(carregar(), turnoRef?.carregar(), invalidarPendenciasDoPortal())"
      @recado="
        (texto, reler) => {
          marcacao.recado.value = { texto, tom: 'erro' }
          if (reler) carregar()
        }
      "
    />
  </UiPagina>
</template>

<style scoped>
.pr {
  display: grid;
  gap: 20px;
  container: prancheta / inline-size;
}

.pr__recado {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin: 0;
  padding: 14px 20px;
  color: var(--tinta);
  font-size: 14px;
}

.pr__recado > span {
  flex: 1;
  min-width: 12rem;
}

.pr__recado > i {
  font-size: 18px;
}

.pr__icone--risco {
  color: var(--risco-tinta);
}

.pr__icone--atencao {
  color: var(--atencao-tinta);
}

.pr__icone--ok {
  color: var(--ok-tinta);
}

.pr__barra {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.pr__dia {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.pr__nome-do-dia {
  min-width: 6.5rem;
  color: var(--tinta);
  font-size: 15px;
  font-weight: 650;
  text-align: center;
}

.pr__grade {
  display: grid;
  align-items: start;
  gap: 20px;
}

@container prancheta (min-width: 1000px) {
  .pr__grade {
    grid-template-columns: minmax(0, 1fr) 360px;
  }
}

.pr__principal,
.pr__lateral {
  display: grid;
  align-content: start;
  gap: 20px;
  min-width: 0;
}

.pr__nota {
  margin: 0;
  padding: 4px 10px 14px;
  color: var(--tinta-2);
  font-size: 14px;
}

.pr__dica {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--tinta-2);
  font-size: 13px;
}

.pr__hospede {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 12px;
  min-width: 0;
  color: inherit;
  text-decoration: none;
}

.pr__especie {
  width: 22px;
  height: 22px;
  flex: none;
  color: var(--tinta-2);
}

.pr__nome {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 8px;
}

.pr__parada {
  display: inline-flex;
  align-items: flex-start;
  gap: 6px;
  color: var(--risco-tinta);
  font-size: 13px;
  font-weight: 600;
  line-height: 1.4;
}

.pr__parada i {
  margin-top: 2px;
}
</style>
