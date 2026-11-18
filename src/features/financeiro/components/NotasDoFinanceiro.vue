<script setup lang="ts">
/**
 * Financeiro › Notas fiscais (protótipo): a nota de serviço (NFS-e) de cada conta paga. Responde
 * duas perguntas, de cima para baixo:
 *
 * 1. **Como foi o mês?** O mês em pílulas e os três números dele: notas autorizadas, o valor e o
 *    ISS que elas informam.
 * 2. **Tem alguma coisa para resolver?** Uma caixa só, de qualquer mês: as notas que a prefeitura
 *    recusou (quase sempre o CPF do responsável), com "Corrigir e reenviar", e as contas pagas que
 *    estão sem nota (a recepção desligou o "Emitir nota" no receber, ou a nota foi cancelada por
 *    erro), com "Emitir". Sem nada, a caixa vira uma linha de "tudo em dia".
 *
 * Embaixo, as emitidas no mês, por dia, com o filtro de situação em pílulas. Clicar abre a nota na
 * gaveta (`NotaFiscalGaveta`): o resumo no desenho da NFS-e, o PDF, o envio ao responsável e o
 * cancelamento. A Configuração da emissão (prefeitura, imposto, RPS, certificado) é da gestão.
 *
 * A recepção vê e trabalha a aba inteira (é ela quem emite e corrige); configurar e cancelar ficam
 * com a gestão. O veterinário não vê as notas da clínica.
 */
import Button from 'primevue/button'
import SelectButton from 'primevue/selectbutton'
import { useToast } from 'primevue/usetoast'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import UiPagina from '@/components/ui/UiPagina.vue'
import UiVazioIlustrado from '@/components/ui/UiVazioIlustrado.vue'
import { diffDays } from '@/features/clinico/domain/clinic-time'

import {
  dataComDia,
  dataCurta,
  mesAnterior,
  mesDe,
  nomeDoMes,
  porcento,
  reais,
  reaisCurtos,
  type Conta,
} from '../dados'
import { useFinanceiro } from '../estado'
import {
  baseDaNota,
  dataCompleta,
  ehServico,
  issDaNota,
  MOTIVOS_DE_CANCELAMENTO,
  municipio,
  numeroDaNota,
  PADROES,
  REGIMES,
  SITUACAO_DA_NOTA,
  valorDosServicos,
  type NotaFiscal,
  type SituacaoDaNota,
} from '../notas'
import { useRespostaDaPrefeitura } from '../resposta-da-prefeitura'

import AvisoDoFinanceiro from './AvisoDoFinanceiro.vue'
import ConfiguracaoDaNotaGaveta from './ConfiguracaoDaNotaGaveta.vue'
import NotaFiscalGaveta from './NotaFiscalGaveta.vue'
import SoParaQuemPode from './SoParaQuemPode.vue'

const fin = useFinanceiro()
const toast = useToast()
const route = useRoute()
const router = useRouter()
const { avisar } = useRespostaDaPrefeitura()

const bloqueado = computed(() => fin.perfil.value.tipo === 'veterinario')
const gestao = computed(() => fin.perfil.value.tipo === 'gestao')
const config = computed(() => fin.configDaNota.value)

const maiuscula = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1)

// -------------------------------------------------------------------------------- o mês

const meses = computed(() => [0, 1, 2, 3].map((k) => mesAnterior(fin.mesAtual.value, k)))

const mes = computed<string>({
  get: () => {
    const pedido = route.query.mes
    return typeof pedido === 'string' && meses.value.includes(pedido) ? pedido : fin.mesAtual.value
  },
  set: (novo) => {
    const query = { ...route.query }
    if (novo === fin.mesAtual.value) delete query.mes
    else query.mes = novo
    void router.replace({ query })
  },
})

const opcoesDeMes = computed(() =>
  meses.value.map((m) => ({ valor: m, rotulo: maiuscula(nomeDoMes(m)) })),
)

/** As notas pedidas no mês, pela emissão. As recusadas moram em "Para resolver". */
const doMes = computed(() =>
  fin.notas.value.filter((n) => mesDe(n.emitidaEm) === mes.value && n.situacao !== 'rejeitada'),
)
const autorizadas = computed(() => doMes.value.filter((n) => n.situacao === 'autorizada'))
const valorAutorizado = computed(() =>
  autorizadas.value.reduce((soma, n) => soma + baseDaNota(n), 0),
)
const issAutorizado = computed(() => autorizadas.value.reduce((soma, n) => soma + issDaNota(n), 0))

function contar(situacao: SituacaoDaNota) {
  return doMes.value.filter((n) => n.situacao === situacao).length
}

const numeros = computed(() => {
  const processando = contar('processando')
  const canceladas = contar('cancelada')
  const outras = [
    processando ? `${processando} em processamento` : '',
    canceladas ? `${canceladas} ${canceladas === 1 ? 'cancelada' : 'canceladas'}` : '',
  ].filter(Boolean)
  return [
    {
      id: 'autorizadas',
      icone: 'ph ph-seal-check',
      valor: numeroDaNota(autorizadas.value.length),
      rotulo: 'Notas autorizadas',
      nota: outras.length ? `e ${outras.join(', ')}` : 'nenhuma cancelada',
    },
    {
      id: 'valor',
      icone: 'ph ph-receipt',
      valor: reaisCurtos(valorAutorizado.value),
      rotulo: 'Valor das notas',
      nota: 'só os serviços: produto vai na nota de venda',
    },
    {
      id: 'iss',
      icone: 'ph ph-bank',
      valor: reais(issAutorizado.value),
      rotulo: 'ISS informado',
      nota:
        config.value.regime === 'simples'
          ? 'já vai na guia do Simples Nacional'
          : `a recolher até o dia 10 de ${nomeDoMes(mesAnterior(mes.value, -1))}`,
    },
  ]
})

// ------------------------------------------------------------------------- para resolver

const recusadas = computed(() => fin.recusadas.value)
const aEmitir = computed(() => fin.aEmitir.value)
const pendencias = computed(() => recusadas.value.length + aEmitir.value.length)

function valorDaNotaDaConta(conta: Conta) {
  const { servicos, desconto } = valorDosServicos(conta)
  return Math.max(0, servicos - desconto)
}

function servicosDa(conta: Conta) {
  const nomes = conta.itens
    .filter(ehServico)
    .map((i) => (i.quantidade > 1 ? `${i.nome} (${i.quantidade})` : i.nome))
  return nomes.length > 3
    ? `${nomes.slice(0, 3).join(', ')} e mais ${nomes.length - 3}`
    : nomes.join(', ')
}

/** Por que a conta paga está sem nota: a nota cancelada por erro, ou o receber sem nota. */
function porQueSemNota(conta: Conta) {
  const ultima = fin.notasDaConta(conta.id).at(-1)
  if (ultima?.cancelamento && ultima.numero !== null) {
    const motivo = MOTIVOS_DE_CANCELAMENTO.find((m) => m.tipo === ultima.cancelamento!.tipo)
    return `a nota nº ${numeroDaNota(ultima.numero)} foi cancelada em ${dataCurta(ultima.cancelamento.data)} (${motivo?.rotulo.toLowerCase() ?? 'erro'})`
  }
  return 'recebida sem nota'
}

const somaAEmitir = computed(() =>
  aEmitir.value.reduce((soma, { conta }) => soma + valorDaNotaDaConta(conta), 0),
)
const somaRecusadas = computed(() => recusadas.value.reduce((soma, n) => soma + baseDaNota(n), 0))

function emitir(conta: Conta) {
  const nota = fin.emitirNota(conta.id)
  if (!nota) return
  toast.add({
    severity: 'info',
    summary: `Nota de ${conta.tutorNome.split(' ')[0]} enviada à prefeitura`,
    detail: 'O número chega em instantes.',
    life: 3000,
  })
  avisar([nota])
}

function emitirTodas() {
  const emitidas = aEmitir.value
    .map(({ conta }) => fin.emitirNota(conta.id))
    .filter((n): n is NotaFiscal => Boolean(n))
  if (!emitidas.length) return
  toast.add({
    severity: 'info',
    summary: `${emitidas.length} notas enviadas à prefeitura`,
    detail: 'Os números chegam em instantes.',
    life: 3000,
  })
  avisar(emitidas)
}

// ---------------------------------------------------------------------- emitidas por dia

type Filtro = 'todas' | 'autorizada' | 'processando' | 'cancelada'
const filtro = ref<Filtro>('todas')

const opcoesDeFiltro = computed(() =>
  (
    [
      { valor: 'todas', rotulo: 'Todas', quantas: doMes.value.length },
      { valor: 'autorizada', rotulo: 'Autorizadas', quantas: contar('autorizada') },
      { valor: 'processando', rotulo: 'Em processamento', quantas: contar('processando') },
      { valor: 'cancelada', rotulo: 'Canceladas', quantas: contar('cancelada') },
    ] as { valor: Filtro; rotulo: string; quantas: number }[]
  ).filter((o) => o.valor === 'todas' || o.valor === 'autorizada' || o.quantas > 0),
)

/* Filtro que esvaziou (a última em processamento foi autorizada) volta para "Todas". */
watch(opcoesDeFiltro, (opcoes) => {
  if (!opcoes.some((o) => o.valor === filtro.value)) filtro.value = 'todas'
})

const filtradas = computed(() =>
  filtro.value === 'todas' ? doMes.value : doMes.value.filter((n) => n.situacao === filtro.value),
)

const dias = computed(() => {
  const porDia = new Map<string, NotaFiscal[]>()
  for (const n of filtradas.value) porDia.set(n.emitidaEm, [...(porDia.get(n.emitidaEm) ?? []), n])
  return [...porDia.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([data, notas]) => ({
      data,
      notas: notas.sort((a, b) => b.hora.localeCompare(a.hora)),
      valor: notas
        .filter((n) => n.situacao !== 'cancelada')
        .reduce((soma, n) => soma + baseDaNota(n), 0),
    }))
})

const DIAS_POR_VEZ = 4
const diasVisiveis = ref(DIAS_POR_VEZ)
watch([mes, filtro], () => {
  diasVisiveis.value = DIAS_POR_VEZ
})
const diasMostrados = computed(() => dias.value.slice(0, diasVisiveis.value))
const notasEscondidas = computed(() =>
  dias.value.slice(diasVisiveis.value).reduce((soma, dia) => soma + dia.notas.length, 0),
)

function oQueFoiFeito(nota: NotaFiscal) {
  const nomes = nota.itens.map((i) => i.nome)
  return nomes.length > 2
    ? `${nomes.slice(0, 2).join(', ')} e mais ${nomes.length - 2}`
    : nomes.join(', ')
}

// ------------------------------------------------------------------------------ o resumo

const diasDoCertificado = computed(() =>
  diffDays(fin.hoje.value, config.value.certificado.validoAte),
)

const resumo = computed(() => {
  if (bloqueado.value) return 'As notas fiscais de serviço da clínica'
  const quando = `${maiuscula(nomeDoMes(mes.value))}${mes.value === fin.mesAtual.value ? ' até hoje' : ''}`
  const n = autorizadas.value.length
  const partes = [
    `${quando}: ${numeroDaNota(n)} ${n === 1 ? 'nota autorizada' : 'notas autorizadas'}, ${reaisCurtos(valorAutorizado.value)}`,
    pendencias.value ? `${pendencias.value} para resolver` : 'tudo em dia',
  ]
  return partes.join(' · ')
})

const comoFunciona = computed(() => {
  const c = config.value
  const imposto =
    c.regime === 'simples'
      ? `como ${REGIMES[c.regime]}: o ISS de ${porcento(c.aliquota, 2)} já vai na guia do mês, e a nota só informa`
      : `como ${REGIMES[c.regime]}: o ISS de ${porcento(c.aliquota, 2)} é recolhido à parte, até o dia 10 do mês seguinte`
  return `As notas saem pela prefeitura de ${municipio(c.municipio).cidade} (${PADROES[c.padrao]}), ${imposto}. Produto vendido no balcão fica fora: é mercadoria e vai na nota de venda. A clínica cancela uma nota até o dia 10 do mês seguinte ao da emissão; depois disso, só pedindo à prefeitura.`
})

// ---------------------------------------------------------------------------- as gavetas

const notaAberta = ref(false)
const notaEmFoco = ref<string | null>(null)
const modoDaNota = ref<'ver' | 'corrigir'>('ver')
const configAberta = ref(false)

function abrirNota(id: string, modo: 'ver' | 'corrigir' = 'ver') {
  notaEmFoco.value = id
  modoDaNota.value = modo
  notaAberta.value = true
}
</script>

<template>
  <UiPagina :resumo="resumo">
    <template v-if="gestao" #acoes>
      <Button
        type="button"
        icon="ph ph-gear-six"
        label="Configuração da emissão"
        severity="secondary"
        outlined
        @click="configAberta = true"
      />
    </template>

    <div class="fin">
      <AvisoDoFinanceiro />

      <SoParaQuemPode v-if="bloqueado" />

      <template v-else>
        <p v-if="diasDoCertificado <= 30" class="nt__alerta" role="status">
          <i class="ph ph-certificate" aria-hidden="true" />
          <span>
            {{
              diasDoCertificado < 0
                ? `O certificado digital venceu em ${dataCompleta(config.certificado.validoAte)}: a prefeitura não aceita nota nova até trocar.`
                : `O certificado digital vence em ${diasDoCertificado} ${diasDoCertificado === 1 ? 'dia' : 'dias'} (${dataCompleta(config.certificado.validoAte)}). Vencido, a prefeitura não aceita nota nova.`
            }}
          </span>
          <Button
            v-if="gestao"
            type="button"
            size="small"
            icon="ph ph-certificate"
            label="Trocar certificado"
            @click="configAberta = true"
          />
        </p>

        <SelectButton
          v-model="mes"
          :options="opcoesDeMes"
          option-label="rotulo"
          option-value="valor"
          :allow-empty="false"
          aria-label="Mês"
          class="nt__pilulas"
        />

        <ul v-if="doMes.length" class="ui-indicadores nt__numeros" aria-label="As notas do mês">
          <li v-for="n in numeros" :key="n.id" class="ui-indicador">
            <span class="ui-ladrilho" aria-hidden="true"><i :class="n.icone" /></span>
            <strong class="ui-indicador__valor ui-num">{{ n.valor }}</strong>
            <span class="ui-indicador__rotulo">{{ n.rotulo }}</span>
            <span class="ui-indicador__nota">{{ n.nota }}</span>
          </li>
        </ul>

        <!-- Para resolver: de qualquer mês -->
        <section class="ui-folha ui-cartao" aria-labelledby="nt-resolver">
          <header class="ui-cartao__cabeca">
            <span
              class="ui-ladrilho"
              :class="pendencias ? 'ui-ladrilho--atencao' : 'ui-ladrilho--ok'"
              aria-hidden="true"
            >
              <i :class="pendencias ? 'ph ph-list-checks' : 'ph ph-check-circle'" />
            </span>
            <span class="ui-cartao__titulos">
              <h2 id="nt-resolver" class="ui-cartao__titulo">
                {{ pendencias ? 'Para resolver' : 'Tudo em dia' }}
                <span v-if="pendencias" class="ui-contagem">{{ pendencias }}</span>
              </h2>
              <p class="ui-cartao__descricao">
                {{
                  pendencias
                    ? 'De qualquer mês: as notas que a prefeitura recusou e as contas pagas que ainda estão sem nota.'
                    : 'Toda conta paga com serviço tem a nota autorizada ou a caminho da prefeitura.'
                }}
              </p>
            </span>
            <span v-if="aEmitir.length > 1" class="ui-cartao__acoes">
              <Button
                type="button"
                size="small"
                icon="ph ph-paper-plane-tilt"
                :label="`Emitir as ${aEmitir.length}`"
                @click="emitirTodas"
              />
            </span>
          </header>

          <div v-if="recusadas.length" class="nt__grupo">
            <h3 class="nt__grupo-titulo nt__grupo-titulo--risco">
              <i class="ph ph-warning-circle" aria-hidden="true" />
              Recusadas pela prefeitura
              <span class="nt__grupo-soma ui-num">{{ reais(somaRecusadas) }}</span>
            </h3>
            <ul class="ui-lista">
              <li v-for="n in recusadas" :key="n.id">
                <div class="ui-linha nt__linha">
                  <span class="ui-ladrilho ui-ladrilho--risco" aria-hidden="true">
                    <i class="ph ph-warning-circle" />
                  </span>
                  <span class="ui-linha__texto">
                    <span class="ui-linha__titulo">
                      {{ n.tomador.nome }} <span class="nt__pet">· {{ n.petNome }}</span>
                    </span>
                    <span class="ui-linha__meta nt__recusa">{{ n.recusa }}</span>
                    <span class="ui-linha__meta nt__miudo">
                      Recusada em {{ dataCurta(n.emitidaEm) }} · RPS {{ n.serieRps }}
                      {{ numeroDaNota(n.numeroRps) }}
                    </span>
                  </span>
                  <span class="ui-linha__fim">
                    <strong class="nt__valor ui-num">{{ reais(baseDaNota(n)) }}</strong>
                    <Button
                      type="button"
                      size="small"
                      icon="ph ph-pencil-simple-line"
                      label="Corrigir e reenviar"
                      @click="abrirNota(n.id, 'corrigir')"
                    />
                  </span>
                </div>
              </li>
            </ul>
          </div>

          <div v-if="aEmitir.length" class="nt__grupo">
            <h3 class="nt__grupo-titulo">
              A emitir
              <span class="nt__grupo-soma ui-num">{{ reais(somaAEmitir) }}</span>
            </h3>
            <ul class="ui-lista">
              <li v-for="{ conta, pagaEm } in aEmitir" :key="conta.id">
                <div class="ui-linha nt__linha">
                  <span class="ui-ladrilho" aria-hidden="true"
                    ><i class="ph ph-file-dashed"
                  /></span>
                  <span class="ui-linha__texto">
                    <span class="ui-linha__titulo">
                      {{ conta.tutorNome }} <span class="nt__pet">· {{ conta.petNome }}</span>
                    </span>
                    <span class="ui-linha__meta">{{ servicosDa(conta) }}</span>
                    <span class="ui-linha__meta nt__miudo">
                      Paga em {{ dataCurta(pagaEm.data) }} · {{ porQueSemNota(conta) }}
                    </span>
                  </span>
                  <span class="ui-linha__fim">
                    <strong class="nt__valor ui-num">{{ reais(valorDaNotaDaConta(conta)) }}</strong>
                    <Button
                      type="button"
                      size="small"
                      :severity="aEmitir.length > 1 ? 'secondary' : undefined"
                      :outlined="aEmitir.length > 1"
                      icon="ph ph-paper-plane-tilt"
                      label="Emitir"
                      :aria-label="`Emitir a nota de ${conta.tutorNome}`"
                      @click="emitir(conta)"
                    />
                  </span>
                </div>
              </li>
            </ul>
          </div>
        </section>

        <!-- As emitidas no mês, por dia -->
        <SelectButton
          v-if="doMes.length"
          v-model="filtro"
          :options="opcoesDeFiltro"
          option-label="rotulo"
          option-value="valor"
          :allow-empty="false"
          aria-label="Situação da nota"
          class="nt__pilulas"
        >
          <template #option="{ option }">
            <span>{{ option.rotulo }}</span>
            <span class="nt__qtd ui-num">{{ numeroDaNota(option.quantas) }}</span>
          </template>
        </SelectButton>

        <section class="ui-folha ui-cartao" aria-labelledby="nt-emitidas">
          <header class="ui-cartao__cabeca">
            <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-invoice" /></span>
            <span class="ui-cartao__titulos">
              <h2 id="nt-emitidas" class="ui-cartao__titulo">
                Emitidas em {{ nomeDoMes(mes) }}
                <span v-if="filtradas.length" class="ui-contagem">{{
                  numeroDaNota(filtradas.length)
                }}</span>
              </h2>
              <p class="ui-cartao__descricao">
                Pelo dia da emissão. Abra uma nota para ver, baixar o PDF ou enviar de novo.
              </p>
            </span>
          </header>

          <template v-if="dias.length">
            <div v-for="dia in diasMostrados" :key="dia.data" class="nt__grupo">
              <h3 class="nt__grupo-titulo">
                {{ dataComDia(dia.data) }}
                <span class="nt__grupo-soma ui-num">
                  {{ dia.notas.length }} {{ dia.notas.length === 1 ? 'nota' : 'notas' }} ·
                  {{ reais(dia.valor) }}
                </span>
              </h3>
              <ul class="ui-lista">
                <li v-for="n in dia.notas" :key="n.id">
                  <button type="button" class="ui-linha nt__linha" @click="abrirNota(n.id)">
                    <span
                      class="ui-ladrilho"
                      :class="{
                        'ui-ladrilho--atencao': n.situacao === 'processando',
                        'ui-ladrilho--neutro': n.situacao === 'cancelada',
                      }"
                      aria-hidden="true"
                    >
                      <i
                        :class="
                          n.situacao === 'autorizada'
                            ? 'ph ph-file-text'
                            : SITUACAO_DA_NOTA[n.situacao].icone
                        "
                      />
                    </span>
                    <span class="ui-linha__texto">
                      <span class="ui-linha__titulo">
                        {{
                          n.numero !== null ? `Nº ${numeroDaNota(n.numero)}` : 'Sem número ainda'
                        }}
                        <span class="nt__pet">· {{ n.tomador.nome }}</span>
                      </span>
                      <span class="ui-linha__meta">{{ n.petNome }} · {{ oQueFoiFeito(n) }}</span>
                    </span>
                    <span class="ui-linha__fim">
                      <!-- Autorizada é o normal: o selo só aparece quando a nota difere. -->
                      <span
                        v-if="n.situacao !== 'autorizada'"
                        class="ui-selo"
                        :class="{ 'ui-selo--atencao': n.situacao === 'processando' }"
                      >
                        <i :class="SITUACAO_DA_NOTA[n.situacao].icone" aria-hidden="true" />
                        {{ SITUACAO_DA_NOTA[n.situacao].rotulo }}
                      </span>
                      <span class="nt__hora ui-num">{{ n.hora }}</span>
                      <strong
                        class="nt__valor ui-num"
                        :class="{ 'nt__valor--cancelada': n.situacao === 'cancelada' }"
                        >{{ reais(baseDaNota(n)) }}</strong
                      >
                      <i class="ph ph-caret-right ui-linha__seta" aria-hidden="true" />
                    </span>
                  </button>
                </li>
              </ul>
            </div>
          </template>

          <UiVazioIlustrado
            v-else-if="!doMes.length"
            aninhado
            icone="ph ph-invoice"
            :titulo="`Nenhuma nota emitida em ${nomeDoMes(mes)}`"
            texto="A nota sai quando a recepção recebe com 'Emitir nota fiscal' ligado, ou daqui, em A emitir."
          >
            <template #acao>
              <Button
                type="button"
                icon="ph ph-cash-register"
                label="Ir para o caixa"
                severity="secondary"
                outlined
                @click="router.push('/clinica/financeiro')"
              />
            </template>
          </UiVazioIlustrado>

          <p v-else class="nt__nada">Nenhuma nota nesta situação em {{ nomeDoMes(mes) }}.</p>

          <footer v-if="notasEscondidas" class="ui-cartao__pe">
            <Button
              type="button"
              size="small"
              severity="secondary"
              outlined
              icon="ph ph-caret-down"
              :label="`Ver mais dias (${numeroDaNota(notasEscondidas)} notas)`"
              @click="diasVisiveis += 5"
            />
          </footer>
        </section>

        <p class="nt__como ui-poco">
          <i class="ph ph-info" aria-hidden="true" />
          <span>{{ comoFunciona }}</span>
        </p>
      </template>
    </div>

    <template #sempre>
      <NotaFiscalGaveta
        v-model:visible="notaAberta"
        :nota-id="notaEmFoco"
        :modo-inicial="modoDaNota"
      />
      <ConfiguracaoDaNotaGaveta v-model:visible="configAberta" />
    </template>
  </UiPagina>
</template>

<style scoped>
/* As linhas seguem a largura do conteúdo (a gaveta aberta estreita a página), não a da janela. */
.fin {
  display: grid;
  gap: 20px;
  container-type: inline-size;
}

.nt__pilulas {
  justify-self: start;
  flex-wrap: wrap;
}

.nt__qtd {
  margin-inline-start: 6px;
  opacity: 0.75;
  font-size: 12.5px;
}

.nt__numeros {
  margin: 0;
  padding: 0;
  list-style: none;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.nt__alerta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  margin: 0;
  padding: 12px 18px;
  border-radius: 16px;
  background: var(--atencao-fundo);
  color: var(--atencao-tinta);
  font-size: 13.5px;
  font-weight: 600;
}

.nt__alerta span {
  flex: 1 1 18rem;
}

.nt__alerta i {
  font-size: 18px;
}

.nt__grupo + .nt__grupo {
  border-top: 1px solid var(--linha-suave);
}

.nt__grupo-titulo {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  padding: 14px 24px 4px;
  color: var(--tinta-2);
  font-family: var(--font-dados);
  font-size: 11.5px;
  font-weight: 650;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.nt__grupo-titulo--risco {
  color: var(--risco-tinta);
}

.nt__grupo-soma {
  margin-inline-start: auto;
  letter-spacing: 0;
  text-transform: none;
}

.nt__linha {
  min-height: 0;
  padding-block: 12px;
}

.nt__pet {
  color: var(--tinta-2);
  font-weight: 500;
}

.nt__recusa {
  color: var(--risco-tinta);
  font-weight: 600;
}

.nt__miudo {
  font-size: 12.5px;
}

.nt__hora {
  color: var(--tinta-2);
  font-size: 13px;
}

.nt__valor {
  min-width: 6.5rem;
  color: var(--tinta);
  font-size: 14.5px;
  font-weight: 650;
  text-align: end;
}

.nt__valor--cancelada {
  color: var(--tinta-2);
  text-decoration: line-through;
}

.nt__nada {
  margin: 0;
  padding: 18px 24px 22px;
  color: var(--tinta-2);
  font-size: 13.5px;
}

.nt__como {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin: 0;
  padding: 14px 18px;
  color: var(--tinta-2);
  font-size: 13.5px;
  line-height: 1.5;
}

.nt__como i {
  margin-top: 2px;
  color: var(--app-salvia-texto, var(--musgo));
  font-size: 17px;
}

@container (max-width: 760px) {
  .nt__numeros {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@container (max-width: 900px) {
  .nt__hora {
    display: none;
  }

  .nt__linha {
    flex-wrap: wrap;
  }

  .nt__linha .ui-linha__fim {
    width: 100%;
    justify-content: flex-end;
  }
}
</style>
