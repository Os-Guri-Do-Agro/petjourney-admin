<script setup lang="ts">
/**
 * Receber (protótipo): a conta chega pronta do atendimento e a recepção confere, recebe e pronto.
 *
 * Três assuntos, de cima para baixo, numa gaveta só (receber é um trabalho de um minuto, não um
 * cadastro em passos):
 *
 * 1. **O que foi feito.** Os itens que o veterinário lançou, com quantidade e preço. A recepção
 *    acrescenta o que ficou de fora (o antipulgas que o responsável pegou no balcão) e dá desconto.
 * 2. **Como vai pagar.** Uma forma, ou duas ("dividir"): metade no Pix e o resto no cartão é o
 *    caso de todo dia. Cada forma diz o que custa e quando cai (a taxa e o prazo da maquininha), o
 *    dinheiro calcula o troco, e "deixar em aberto" pede o vencimento: vira débito do cliente.
 * 3. **Depois.** O recibo vai para o app do responsável (a conta dele na PetJourney) e a nota de
 *    serviço sai junto: vai à prefeitura em processamento e o número chega alguns segundos depois
 *    (ou a recusa, quando falta o CPF). O interruptor vem como a Configuração da emissão manda;
 *    desligado, a conta paga espera em Notas fiscais › A emitir. Conta só de produto não tem nota de
 *    serviço, e conta que fica em aberto tem a nota quando for paga.
 *
 * Com `debito`, a mesma gaveta quita o que um responsável deve (Contas › A receber): sem mexer nos
 * itens, só o pagamento.
 */
import Button from 'primevue/button'
import DatePicker from 'primevue/datepicker'
import InputNumber from 'primevue/inputnumber'
import Select from 'primevue/select'
import ToggleSwitch from 'primevue/toggleswitch'
import { useToast } from 'primevue/usetoast'
import { computed, ref, watch } from 'vue'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { iniciais } from '@/components/cadastro/useRotulosDoCadastro'
import { addDays } from '@/features/clinico/domain/clinic-time'
import PetAvatar from '@/features/hotel/components/base/PetAvatar.vue'

import {
  dataCurta,
  devidoDaConta,
  pagoDaConta,
  porcento,
  profissional,
  reais,
  type Centavos,
  type FormaDePagamento,
  type ItemDaConta,
} from '../dados'
import { useFinanceiro, type Devedor, type PagamentoPedido } from '../estado'
import {
  ehServico,
  municipio,
  problemaDoTomador,
  tomadorDoCadastro,
  type NotaFiscal,
} from '../notas'
import { useRespostaDaPrefeitura } from '../resposta-da-prefeitura'

const props = defineProps<{ contaId: string | null; debito?: Devedor | null }>()
const aberta = defineModel<boolean>('visible', { default: false })

const toast = useToast()
const fin = useFinanceiro()
const { avisar } = useRespostaDaPrefeitura()

const conta = computed(() => (props.contaId ? fin.conta(props.contaId) : null))
const modoDebito = computed(() => Boolean(props.debito))

const itens = ref<ItemDaConta[]>([])
const desconto = ref(0)
const reciboNoApp = ref(true)
const nota = ref(true)
const dividir = ref(false)
const tentou = ref(false)

type Parte = {
  forma: FormaDePagamento
  valor: Centavos
  parcelas: number
  vencimento: Date
  entregue: number | null
}

const novaParte = (valor: Centavos): Parte => ({
  forma: 'pix',
  valor,
  parcelas: 1,
  vencimento: dataLocal(addDays(fin.hoje.value, 15)),
  entregue: null,
})

const partes = ref<Parte[]>([novaParte(0)])

function dataLocal(iso: string) {
  const [a, m, d] = iso.split('-').map(Number)
  return new Date(a!, m! - 1, d!)
}

function isoLocal(data: Date) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`
}

watch(aberta, (agora) => {
  if (!agora) return
  tentou.value = false
  dividir.value = false
  itens.value = conta.value ? conta.value.itens.map((item) => ({ ...item })) : []
  desconto.value = conta.value?.desconto ?? 0
  reciboNoApp.value = Boolean(conta.value?.tutorId ?? props.debito?.tutorId)
  nota.value = fin.configDaNota.value.emitirAoReceber
  partes.value = [novaParte(aReceber.value)]
})

const bruto = computed(() => itens.value.reduce((soma, i) => soma + i.preco * i.quantidade, 0))
const total = computed(() =>
  modoDebito.value ? (props.debito?.total ?? 0) : Math.max(0, bruto.value - desconto.value),
)
const jaPago = computed(() => (conta.value && !modoDebito.value ? pagoDaConta(conta.value) : 0))
const aReceber = computed(() => Math.max(0, total.value - jaPago.value))
const correndo = computed(() => conta.value?.situacao === 'correndo')

/* Uma parte só segue o total; dividindo, a segunda é sempre o que falta. */
watch(aReceber, (valor) => {
  if (!dividir.value) {
    if (partes.value[0]) partes.value[0].valor = valor
  } else if (partes.value[1] && partes.value[0]) {
    partes.value[1].valor = Math.max(0, valor - partes.value[0].valor)
  }
})

function alternarDivisao() {
  if (dividir.value) {
    dividir.value = false
    partes.value = [{ ...partes.value[0]!, valor: aReceber.value }]
    return
  }
  dividir.value = true
  const metade = Math.round(aReceber.value / 2 / 100) * 100
  partes.value = [
    { ...partes.value[0]!, valor: metade },
    {
      ...novaParte(aReceber.value - metade),
      forma: partes.value[0]!.forma === 'pix' ? 'credito' : 'pix',
    },
  ]
}

function valorDaPrimeira(reaisDigitados: number | null) {
  const centavos = Math.round((reaisDigitados ?? 0) * 100)
  const limitado = Math.min(Math.max(0, centavos), aReceber.value)
  partes.value[0]!.valor = limitado
  if (partes.value[1]) partes.value[1].valor = aReceber.value - limitado
}

const semCadastro = computed(() => !(conta.value?.tutorId ?? props.debito?.tutorId))

const formas = computed(() =>
  fin.condicoes.value.filter((c) => !(modoDebito.value && c.forma === 'em-aberto')),
)

function escolherForma(parte: Parte, forma: FormaDePagamento) {
  if (forma === 'em-aberto' && semCadastro.value) return
  parte.forma = forma
  parte.parcelas = 1
  parte.entregue = null
}

function opcoesDeParcelas(valor: Centavos) {
  const credito = fin.condicao('credito')
  return Array.from({ length: credito.maxParcelas ?? 1 }, (_, i) => {
    const n = i + 1
    const taxa = fin.taxaDe('credito', n)
    return {
      valor: n,
      rotulo: `${n}x de ${reais(Math.round(valor / n))} · taxa ${porcento(taxa, 2)}`,
    }
  })
}

function quandoCai(parte: Parte) {
  const c = fin.condicao(parte.forma)
  const taxa = fin.taxaDe(parte.forma, parte.parcelas)
  const liquido = parte.valor - Math.round(parte.valor * taxa)
  if (parte.forma === 'pix') return 'Cai na hora, sem taxa.'
  if (parte.forma === 'dinheiro') return 'Entra na gaveta do caixa.'
  if (parte.forma === 'debito')
    return `Cai amanhã: ${reais(liquido)}, já sem a taxa de ${porcento(taxa, 2)}.`
  if (parte.forma === 'credito')
    return parte.parcelas > 1
      ? `Cai em ${parte.parcelas} parcelas, a primeira em ${c.prazoDias} dias: ${reais(liquido)} no total, sem a taxa de ${porcento(taxa, 2)}.`
      : `Cai em ${c.prazoDias} dias: ${reais(liquido)}, já sem a taxa de ${porcento(taxa, 2)}.`
  return ''
}

function troco(parte: Parte) {
  if (parte.forma !== 'dinheiro' || parte.entregue === null) return null
  return Math.round(parte.entregue * 100) - parte.valor
}

// ----------------------------------------------------------------------------------- itens

const opcoesDeItem = computed(() => [
  {
    grupo: 'Serviços',
    itens: fin.tabela.value.filter((i) => i.grupo === 'servico'),
  },
  {
    grupo: 'Produtos',
    itens: fin.tabela.value.filter((i) => i.grupo === 'produto'),
  },
])
const novoItem = ref<string | null>(null)

watch(novoItem, (id) => {
  if (!id) return
  const existente = itens.value.find((i) => i.precoId === id && !i.profissionalId)
  if (existente) existente.quantidade += 1
  else itens.value.push(fin.itemDaTabela(id, null))
  novoItem.value = null
})

function mudarQuantidade(item: ItemDaConta, delta: number) {
  item.quantidade = Math.max(1, item.quantidade + delta)
}

function tirar(item: ItemDaConta) {
  itens.value = itens.value.filter((i) => i.id !== item.id)
}

function descontoEmPorcento(fracao: number) {
  desconto.value = Math.round((bruto.value * fracao) / 100) * 100
}

// ---------------------------------------------------------------------------------- receber

const faltas = computed(() => {
  const lista: string[] = []
  if (!modoDebito.value && !itens.value.length) lista.push('A conta precisa de pelo menos um item.')
  const soma = partes.value.reduce((s, p) => s + p.valor, 0)
  if (soma !== aReceber.value) lista.push('As duas formas precisam somar o valor da conta.')
  for (const parte of partes.value) {
    const t = troco(parte)
    if (t !== null && t < 0) lista.push('O dinheiro entregue não cobre o valor.')
    if (parte.valor <= 0 && aReceber.value > 0) lista.push('Diga quanto vai em cada forma.')
  }
  return [...new Set(lista)]
})

const soEmAberto = computed(() => partes.value.every((p) => p.forma === 'em-aberto'))

// ------------------------------------------------------------------------------ nota fiscal

const temServicoNaConta = computed(() => itens.value.some(ehServico))
const ficaDevendo = computed(() => partes.value.some((p) => p.forma === 'em-aberto'))
const emitirAgora = computed(() => nota.value && temServicoNaConta.value)

/** O que o interruptor da nota vai fazer, dito antes de receber (e o aviso, se vai ser recusada). */
const textoDaNota = computed<{ texto: string; tom: '' | 'atencao' }>(() => {
  if (!temServicoNaConta.value)
    return { texto: 'Só produto nesta conta: produto não entra na nota de serviço.', tom: '' }
  if (!nota.value)
    return {
      texto: 'Paga sem nota, a conta espera em Notas fiscais › A emitir, para emitir depois.',
      tom: '',
    }
  if (ficaDevendo.value)
    return { texto: 'A nota sai quando o responsável pagar o que ficou em aberto.', tom: '' }
  const c = conta.value
  const tomador = c ? tomadorDoCadastro(c) : null
  const primeiro = (c?.tutorNome ?? '').split(' ')[0]
  if (c && !c.tutorId)
    return {
      texto:
        'Venda sem cadastro: sem CPF, a prefeitura recusa. Dá para pôr o CPF depois, em Notas fiscais.',
      tom: 'atencao',
    }
  if (tomador && problemaDoTomador(tomador))
    return {
      texto: `${tomador.cpf ? 'O CPF' : 'Falta o CPF'} no cadastro de ${primeiro}${tomador.cpf ? ' não confere' : ''}: a prefeitura vai recusar. Dá para corrigir e reenviar em Notas fiscais.`,
      tom: 'atencao',
    }
  return {
    texto: `Sai pela prefeitura de ${municipio(fin.configDaNota.value.municipio).cidade} com o CPF de ${primeiro}; o número chega em instantes.`,
    tom: '',
  }
})

const rotuloDoBotao = computed(() => {
  if (soEmAberto.value) return 'Deixar em aberto'
  const agora = partes.value.filter((p) => p.forma !== 'em-aberto').reduce((s, p) => s + p.valor, 0)
  return `Receber ${reais(agora)}`
})

function confirmar() {
  tentou.value = true
  if (faltas.value.length) return
  const pedidos: PagamentoPedido[] = partes.value.map((p) => ({
    forma: p.forma,
    valor: p.valor,
    parcelas: p.forma === 'credito' ? p.parcelas : 1,
    vencimento: p.forma === 'em-aberto' ? isoLocal(p.vencimento) : undefined,
  }))
  const quem = conta.value?.tutorNome ?? props.debito?.tutorNome ?? ''
  const primeiroNome = quem.split(' ')[0]
  let notas: NotaFiscal[] = []
  if (modoDebito.value && props.debito) {
    notas = fin.quitarDebito(props.debito.tutorId, pedidos)
  } else if (conta.value) {
    const emitida = fin.receber(conta.value.id, {
      itens: itens.value,
      desconto: desconto.value,
      pagamentos: pedidos,
      reciboNoApp: reciboNoApp.value,
      nota: emitirAgora.value,
    })
    if (emitida) notas = [emitida]
  }
  const recebido = pedidos.filter((p) => p.forma !== 'em-aberto').reduce((s, p) => s + p.valor, 0)
  const emAberto = pedidos.find((p) => p.forma === 'em-aberto')
  const sobreANota = notas.length
    ? notas.length === 1
      ? 'nota fiscal enviada à prefeitura, o número chega em instantes'
      : `${notas.length} notas fiscais enviadas à prefeitura`
    : !modoDebito.value && temServicoNaConta.value && !nota.value
      ? 'sem nota por enquanto: a conta fica em Notas fiscais › A emitir'
      : !modoDebito.value && emitirAgora.value && emAberto
        ? 'a nota sai quando a conta for paga'
        : ''
  const partesDaFrase = [
    reciboNoApp.value && !semCadastro.value ? `recibo no app de ${primeiroNome}` : '',
    sobreANota,
    emAberto ? `${reais(emAberto.valor)} em aberto até ${dataCurta(emAberto.vencimento!)}` : '',
  ].filter(Boolean)
  toast.add({
    severity: 'success',
    summary: recebido
      ? `${reais(recebido)} recebidos de ${primeiroNome}`
      : `Conta de ${primeiroNome} em aberto`,
    detail: partesDaFrase.length
      ? `${partesDaFrase.join(' · ')}. No protótipo, nada é enviado.`
      : 'No protótipo, nada é enviado.',
    life: 5000,
  })
  avisar(notas)
  aberta.value = false
}

const titulo = computed(() => {
  if (modoDebito.value) return 'Receber o que está em aberto'
  if (correndo.value) return 'Receber da internação'
  return 'Receber'
})

const subtitulo = computed(() => {
  const c = conta.value
  if (!c) return ''
  const vet = c.profissionalId ? ` com ${profissional(c.profissionalId).curto}` : ''
  if (c.origem === 'balcao') return `Venda no balcão às ${c.hora}`
  if (c.origem === 'internacao') return `Internado desde ${dataCurta(c.data)}${vet}`
  return `Atendimento${vet}, terminou às ${c.hora}`
})
</script>

<template>
  <CadastroGaveta
    v-model:visible="aberta"
    :titulo="titulo"
    icone="ph ph-cash-register"
    largura="38rem"
  >
    <form id="receber-conta" class="rc" novalidate @submit.prevent="confirmar">
      <!-- Quem -->
      <header v-if="conta" class="rc__quem">
        <PetAvatar
          :nome="conta.petNome"
          :iniciais="iniciais(conta.petNome)"
          :especie="conta.especie"
          :foto-url="conta.fotoUrl"
          tamanho="md"
        />
        <span class="rc__quem-texto">
          <strong>{{ conta.petNome }}</strong>
          <span>{{ conta.tutorNome }} · {{ subtitulo }}</span>
        </span>
      </header>
      <header v-else-if="debito" class="rc__quem">
        <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-user" /></span>
        <span class="rc__quem-texto">
          <strong>{{ debito.tutorNome }}</strong>
          <span>{{ debito.pets.join(', ') }} · {{ debito.contas.length }} contas em aberto</span>
        </span>
      </header>

      <!-- 1. O que foi feito -->
      <section v-if="!modoDebito" class="rc__secao" aria-labelledby="rc-itens">
        <h3 id="rc-itens" class="rc__titulo">
          <i class="ph ph-list-checks" aria-hidden="true" />
          O que foi feito
        </h3>
        <ul class="rc__itens">
          <li v-for="item in itens" :key="item.id" class="rc__item">
            <span class="rc__item-texto">
              <span class="rc__item-nome">{{ item.nome }}</span>
              <small v-if="item.profissionalId">{{ profissional(item.profissionalId).nome }}</small>
              <small v-else>Balcão</small>
            </span>
            <span class="rc__qtd" role="group" :aria-label="`Quantidade de ${item.nome}`">
              <Button
                type="button"
                icon="ph ph-minus"
                severity="secondary"
                outlined
                size="small"
                :disabled="item.quantidade <= 1"
                :aria-label="`Tirar um de ${item.nome}`"
                @click="mudarQuantidade(item, -1)"
              />
              <span class="ui-num">{{ item.quantidade }}</span>
              <Button
                type="button"
                icon="ph ph-plus"
                severity="secondary"
                outlined
                size="small"
                :aria-label="`Mais um de ${item.nome}`"
                @click="mudarQuantidade(item, 1)"
              />
            </span>
            <span class="rc__valor ui-num">{{ reais(item.preco * item.quantidade) }}</span>
            <Button
              type="button"
              icon="ph ph-trash"
              severity="secondary"
              outlined
              size="small"
              :aria-label="`Tirar ${item.nome} da conta`"
              @click="tirar(item)"
            />
          </li>
        </ul>
        <div class="rc__mais">
          <Select
            v-model="novoItem"
            :options="opcoesDeItem"
            option-group-label="grupo"
            option-group-children="itens"
            option-label="nome"
            option-value="id"
            filter
            filter-placeholder="Procurar na tabela"
            placeholder="Acrescentar um item da tabela"
            aria-label="Acrescentar um item da tabela"
            class="rc__mais-select"
          >
            <template #option="{ option }">
              <span class="rc__opcao">
                <span>{{ option.nome }}</span>
                <span class="ui-num">{{ reais(option.preco) }}</span>
              </span>
            </template>
          </Select>
        </div>
        <div class="rc__desconto">
          <label class="eg__rotulo" for="rc-desconto">Desconto</label>
          <span class="rc__desconto-linha">
            <InputNumber
              input-id="rc-desconto"
              :model-value="desconto / 100"
              mode="currency"
              currency="BRL"
              locale="pt-BR"
              :min="0"
              :max="bruto / 100"
              class="rc__desconto-campo"
              @update:model-value="desconto = Math.round(($event ?? 0) * 100)"
            />
            <Button
              type="button"
              label="5%"
              severity="secondary"
              outlined
              size="small"
              @click="descontoEmPorcento(0.05)"
            />
            <Button
              type="button"
              label="10%"
              severity="secondary"
              outlined
              size="small"
              @click="descontoEmPorcento(0.1)"
            />
            <Button
              v-if="desconto"
              type="button"
              label="Sem desconto"
              severity="secondary"
              outlined
              size="small"
              @click="desconto = 0"
            />
          </span>
        </div>
      </section>

      <section v-else-if="debito" class="rc__secao" aria-labelledby="rc-debitos">
        <h3 id="rc-debitos" class="rc__titulo">
          <i class="ph ph-receipt" aria-hidden="true" />
          O que está em aberto
        </h3>
        <ul class="rc__itens">
          <li v-for="c in debito.contas" :key="c.id" class="rc__item">
            <span class="rc__item-texto">
              <span class="rc__item-nome">{{ c.petNome }} · {{ dataCurta(c.data) }}</span>
              <small>{{ c.itens.map((i) => i.nome).join(', ') }}</small>
            </span>
            <span class="rc__vence">venceu {{ dataCurta(c.vencimento ?? c.data) }}</span>
            <span class="rc__valor ui-num">{{ reais(devidoDaConta(c)) }}</span>
          </li>
        </ul>
      </section>

      <div class="rc__total">
        <span>
          <span class="rc__total-rotulo">{{ jaPago ? 'Falta receber' : 'Total' }}</span>
          <small v-if="desconto && !modoDebito"
            >{{ reais(bruto) }} com {{ reais(desconto) }} de desconto</small
          >
          <small v-if="jaPago"
            >{{ reais(total) }} até agora, {{ reais(jaPago) }} já adiantados</small
          >
        </span>
        <strong class="ui-num">{{ reais(aReceber) }}</strong>
      </div>

      <!-- 2. Como vai pagar -->
      <section class="rc__secao" aria-labelledby="rc-forma">
        <div class="rc__titulo-linha">
          <h3 id="rc-forma" class="rc__titulo">
            <i class="ph ph-wallet" aria-hidden="true" />
            Como vai pagar
          </h3>
          <Button
            type="button"
            :icon="dividir ? 'ph ph-x' : 'ph ph-arrows-split'"
            :label="dividir ? 'Uma forma só' : 'Dividir em duas formas'"
            severity="secondary"
            outlined
            size="small"
            :disabled="aReceber < 200"
            @click="alternarDivisao"
          />
        </div>

        <div
          v-for="(parte, indice) in partes"
          :key="indice"
          class="rc__parte"
          :class="{ 'rc__parte--dividida': dividir }"
        >
          <div v-if="dividir" class="rc__parte-cabeca">
            <strong>{{ indice === 0 ? 'Primeira forma' : 'Segunda forma' }}</strong>
            <InputNumber
              v-if="indice === 0"
              :model-value="parte.valor / 100"
              mode="currency"
              currency="BRL"
              locale="pt-BR"
              :min="0"
              :max="aReceber / 100"
              aria-label="Valor da primeira forma"
              class="rc__parte-valor"
              @update:model-value="valorDaPrimeira"
            />
            <span v-else class="ui-num rc__parte-resto"
              >{{ reais(parte.valor) }} (o que falta)</span
            >
          </div>

          <div
            class="rc__formas"
            role="radiogroup"
            :aria-label="dividir ? `Forma ${indice + 1}` : 'Forma de pagamento'"
          >
            <button
              v-for="c in formas"
              :key="c.forma"
              type="button"
              role="radio"
              class="rc__forma"
              :class="{ 'rc__forma--escolhida': parte.forma === c.forma }"
              :aria-checked="parte.forma === c.forma"
              :disabled="c.forma === 'em-aberto' && semCadastro"
              :title="
                c.forma === 'em-aberto' && semCadastro ? 'Só para quem tem cadastro' : undefined
              "
              @click="escolherForma(parte, c.forma)"
            >
              <i :class="c.icone" aria-hidden="true" />
              <span>{{ c.forma === 'em-aberto' ? 'Em aberto' : c.nome }}</span>
            </button>
          </div>

          <div v-if="parte.forma === 'credito'" class="eg__secao">
            <label class="eg__rotulo" :for="`rc-parcelas-${indice}`">Parcelas</label>
            <Select
              v-model="parte.parcelas"
              :input-id="`rc-parcelas-${indice}`"
              :options="opcoesDeParcelas(parte.valor)"
              option-label="rotulo"
              option-value="valor"
            />
          </div>

          <div v-if="parte.forma === 'dinheiro'" class="eg__secao">
            <label class="eg__rotulo" :for="`rc-entregue-${indice}`"
              >Quanto o responsável entregou</label
            >
            <InputNumber
              v-model="parte.entregue"
              :input-id="`rc-entregue-${indice}`"
              mode="currency"
              currency="BRL"
              locale="pt-BR"
              :min="0"
              placeholder="R$ 0,00"
            />
            <p
              v-if="troco(parte) !== null"
              class="rc__troco"
              :class="{ 'rc__troco--falta': (troco(parte) ?? 0) < 0 }"
            >
              <i
                :class="(troco(parte) ?? 0) < 0 ? 'ph ph-warning' : 'ph ph-coins'"
                aria-hidden="true"
              />
              {{
                (troco(parte) ?? 0) < 0
                  ? `Faltam ${reais(-(troco(parte) ?? 0))}`
                  : `Troco: ${reais(troco(parte) ?? 0)}`
              }}
            </p>
          </div>

          <div v-if="parte.forma === 'em-aberto'" class="eg__secao">
            <span class="eg__rotulo">Vence em</span>
            <DatePicker
              v-model="parte.vencimento"
              inline
              :min-date="dataLocal(fin.hoje.value)"
              class="rc__calendario"
            />
            <p class="eg__dica">
              Vira débito de {{ (conta?.tutorNome ?? '').split(' ')[0] }} em Contas › A receber. O
              app lembra no vencimento, com o Pix da clínica para pagar dali mesmo.
            </p>
          </div>

          <p v-else class="eg__dica rc__cai">
            <i class="ph ph-info" aria-hidden="true" />
            {{ quandoCai(parte) }}
          </p>
        </div>
      </section>

      <!-- 3. Depois -->
      <section class="rc__secao" aria-labelledby="rc-depois">
        <h3 id="rc-depois" class="rc__titulo">
          <i class="ph ph-paper-plane-tilt" aria-hidden="true" />
          Depois de receber
        </h3>
        <label class="rc__chave">
          <span>
            <strong>Recibo no app do responsável</strong>
            <small v-if="semCadastro">Só para quem tem cadastro com o app.</small>
            <small v-else>Fica no histórico do pet, junto da consulta.</small>
          </span>
          <ToggleSwitch v-model="reciboNoApp" :disabled="semCadastro" />
        </label>
        <label v-if="!modoDebito" class="rc__chave">
          <span>
            <strong>Emitir nota fiscal de serviço</strong>
            <small :class="{ 'rc__chave-aviso': textoDaNota.tom === 'atencao' }">
              <i v-if="textoDaNota.tom === 'atencao'" class="ph ph-warning" aria-hidden="true" />
              {{ textoDaNota.texto }}
            </small>
          </span>
          <ToggleSwitch
            :model-value="emitirAgora"
            :disabled="!temServicoNaConta"
            @update:model-value="nota = $event"
          />
        </label>
      </section>

      <ul v-if="tentou && faltas.length" class="eg__erro rc__faltas" role="alert">
        <li v-for="falta in faltas" :key="falta">{{ falta }}</li>
      </ul>
    </form>

    <template #pe>
      <Button
        type="button"
        severity="secondary"
        outlined
        label="Cancelar"
        @click="aberta = false"
      />
      <Button
        type="submit"
        form="receber-conta"
        :icon="soEmAberto ? 'ph ph-hourglass-medium' : 'ph ph-check'"
        :label="rotuloDoBotao"
      />
    </template>
  </CadastroGaveta>
</template>

<style scoped>
.rc {
  display: grid;
  gap: 22px;
}

.rc__quem {
  display: flex;
  align-items: center;
  gap: 12px;
}

.rc__quem-texto {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.rc__quem-texto strong {
  color: var(--tinta);
  font-size: 16px;
}

.rc__quem-texto span {
  color: var(--tinta-2);
  font-size: 13px;
}

.rc__secao {
  display: grid;
  gap: 12px;
  padding-top: 18px;
  border-top: 1px solid var(--linha-suave);
}

.rc__titulo-linha {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.rc__titulo {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--tinta);
  font-size: 14.5px;
  font-weight: 650;
}

.rc__titulo i {
  color: var(--app-salvia-texto, var(--musgo));
  font-size: 17px;
}

.rc__itens {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.rc__item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
}

.rc__item + .rc__item {
  border-top: 1px dashed var(--linha-suave);
}

.rc__item-texto {
  display: grid;
  flex: 1;
  min-width: 0;
}

.rc__item-nome {
  color: var(--tinta);
  font-size: 14px;
  font-weight: 600;
}

.rc__item-texto small {
  color: var(--tinta-2);
  font-size: 12.5px;
}

.rc__qtd {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.rc__qtd .ui-num {
  min-width: 1.4rem;
  color: var(--tinta);
  font-weight: 650;
  text-align: center;
}

.rc__valor {
  min-width: 6.5rem;
  color: var(--tinta);
  font-weight: 650;
  text-align: end;
}

.rc__vence {
  color: var(--risco-tinta);
  font-size: 12.5px;
  font-weight: 600;
}

.rc__mais-select {
  width: 100%;
}

.rc__opcao {
  display: flex;
  width: 100%;
  justify-content: space-between;
  gap: 12px;
}

.rc__desconto {
  display: grid;
  gap: 8px;
}

.rc__desconto-linha {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.rc__desconto-campo {
  width: 10rem;
}

.rc__desconto-campo :deep(input) {
  width: 100%;
}

.rc__total {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 16px;
  background: color-mix(in oklab, var(--pets-fundo) 45%, var(--superficie));
}

.rc__total > span {
  display: grid;
  gap: 2px;
}

.rc__total-rotulo {
  color: var(--tinta);
  font-size: 14px;
  font-weight: 650;
}

.rc__total small {
  color: var(--tinta-2);
  font-size: 12.5px;
}

.rc__total strong {
  color: var(--tinta);
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.rc__parte {
  display: grid;
  gap: 12px;
}

.rc__parte--dividida {
  padding: 14px;
  border: 1px solid var(--linha);
  border-radius: 16px;
}

.rc__parte-cabeca {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: var(--tinta);
  font-size: 13.5px;
}

.rc__parte-valor {
  width: 10rem;
}

.rc__parte-valor :deep(input) {
  width: 100%;
}

.rc__parte-resto {
  color: var(--tinta);
  font-weight: 650;
}

.rc__formas {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(6.4rem, 1fr));
  gap: 8px;
}

.rc__forma {
  display: grid;
  justify-items: center;
  gap: 4px;
  padding: 10px 6px;
  border: 1.5px solid var(--linha);
  border-radius: 14px;
  background: var(--superficie);
  color: var(--tinta);
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
}

.rc__forma i {
  color: var(--tinta-2);
  font-size: 20px;
}

.rc__forma:hover:not(:disabled) {
  border-color: var(--linha-media, var(--linha));
}

.rc__forma:focus-visible {
  outline: 2px solid var(--p-primary-color);
  outline-offset: 2px;
}

.rc__forma:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.rc__forma--escolhida,
.rc__forma--escolhida:hover:not(:disabled) {
  border-color: var(--segmento-escolhido-fundo, var(--musgo));
  background: var(--segmento-escolhido-fundo, var(--musgo));
  color: var(--segmento-escolhido-tinta, var(--sobre-musgo));
}

.rc__forma--escolhida i {
  color: inherit;
}

.rc__cai {
  display: flex;
  align-items: flex-start;
  gap: 6px;
}

.rc__cai i {
  margin-top: 2px;
}

.rc__troco {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  color: var(--ok-tinta);
  font-size: 14px;
  font-weight: 650;
}

.rc__troco--falta {
  color: var(--risco-tinta);
}

.rc__calendario {
  width: 100%;
}

.rc__chave {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  cursor: pointer;
}

.rc__chave > span {
  display: grid;
  gap: 2px;
}

.rc__chave strong {
  color: var(--tinta);
  font-size: 14px;
  font-weight: 600;
}

.rc__chave small {
  color: var(--tinta-2);
  font-size: 12.5px;
}

.rc__chave small.rc__chave-aviso {
  color: var(--atencao-tinta);
  font-weight: 600;
}

.rc__chave-aviso i {
  margin-inline-end: 2px;
  vertical-align: -2px;
}

.rc__faltas {
  display: grid;
  gap: 2px;
  margin: 0;
  padding-inline-start: 18px;
}
</style>
