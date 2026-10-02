<script setup lang="ts">
/**
 * Criar reserva.
 *
 * A tela responde, na ordem, às três perguntas do telefone: **quem**, **quando** e **quanto**. O
 * orçamento aparece antes de gravar qualquer coisa e se refaz a cada mudança — é ele que a
 * recepção lê em voz alta, e um preço que só existe depois de salvar chega tarde demais para a
 * conversa que o produziu.
 *
 * O aviso de admissão entra aqui e não só no check-in de propósito: descobrir que falta a tosse
 * dos canis no dia da entrada é descobrir tarde. Ele **não impede** a reserva — o responsável tem
 * dias para providenciar o papel, e recusar a venda por isso seria perder o hóspede por um
 * documento que ele vai trazer.
 */
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputMask from 'primevue/inputmask'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import MultiSelect from 'primevue/multiselect'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import { computed, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import HotelSelo from '../base/HotelSelo.vue'
import OrcamentoTabela from './OrcamentoTabela.vue'
import { tomDaAdmissao, useHotelFormat } from '../../composables/useHotelFormat'
import { avaliarAdmissao, situacaoParaSelo } from '../../domain/admissao'
import { addDays, contarDiarias, dataDe, horaDe, instante } from '../../domain/hotel-time'
import { reservaRepository } from '../../data/repositories'
import { HOTEL_UTC_OFFSET } from '../../data/fixtures'
import type {
  Acomodacao,
  ClockTime,
  ISODateTime,
  Orcamento,
  ReservaOrigem,
  ServicoContratado,
} from '../../data/types'
import { useHotelStore } from '../../stores/hotel'
import { useReservasStore } from '../../stores/reservas'

const props = defineProps<{
  /** A acomodação escolhida no mapa. `null` fecha o diálogo. */
  acomodacao: Acomodacao | null
  inicio: ISODateTime
  fim: ISODateTime
  salvando: boolean
  erro: string
  /** Comprovantes da casa, para o aviso de admissão nascer com a reserva. */
  comprovantes: Parameters<typeof avaliarAdmissao>[0]['comprovantes']
  hoje: string
}>()

const emit = defineEmits<{
  fechar: []
  confirmar: [
    payload: {
      petId: string
      acompanhantePetId: string | null
      acomodacaoId: string
      inicio: ISODateTime
      fim: ISODateTime
      origem: ReservaOrigem
      servicos: ServicoContratado[]
      observacao: string
      autorizadosARetirar: string[]
    },
  ]
}>()

const { t } = useI18n()
const formato = useHotelFormat()
const hotelStore = useHotelStore()
const reservas = useReservasStore()
const idCampo = useId()

const petId = ref('')
const acompanhanteId = ref<string | null>(null)
const origem = ref<ReservaOrigem>('telefone')
const servicosEscolhidos = ref<string[]>([])
const observacao = ref('')

/**
 * As horas de entrada e de saída, editáveis.
 *
 * Vinham fixas da política da casa — 08:00 e 12:00 — e não havia como dizer "ele chega às 15h". O
 * problema não é de conveniência: **a meia diária da saída tardia é calculada pela hora**, e sem
 * este campo ela era inalcançável pela interface. Vender uma saída às 16h30 só era possível
 * plantando o caso na semente.
 */
const horaEntrada = ref('08:00')
const horaSaida = ref('12:00')

/**
 * Quantas noites.
 *
 * Faltava, e era estranho de um jeito difícil de explicar: o dia de entrada vinha do clique no
 * mapa e a **duração vinha da busca**, lá em cima. Mudar de três para cinco noites exigia fechar o
 * diálogo, mexer no seletor de datas do mapa e clicar de novo na mesma célula.
 *
 * A conversa do balcão é "do dia 28, por quantas noites?" — a pergunta está aqui agora, junto da
 * resposta que ela muda: o período, a conta e a vaga.
 */
const noites = ref(1)

/** Os períodos que o balcão mais vende. Um toque em vez de cinco no contador. */
const ATALHOS = [1, 2, 3, 5, 7, 15]

/** O dia de entrada vem do clique no mapa; a saída é a entrada mais as noites. */
const inicioEscolhido = computed(() => trocarHora(props.inicio, horaEntrada.value))

const fimEscolhido = computed(() =>
  trocarHora(
    instante(addDays(dataDe(props.inicio), noites.value), '12:00', HOTEL_UTC_OFFSET),
    horaSaida.value,
  ),
)

function trocarHora(iso: ISODateTime, hora: string): ISODateTime {
  return /^\d{2}:\d{2}$/.test(hora)
    ? instante(dataDe(iso), hora as ClockTime, HOTEL_UTC_OFFSET)
    : iso
}

/**
 * Quem mais pode retirar o animal.
 *
 * Combinado aqui porque é quando o responsável está disponível para dizer. Descobrir no balcão que
 * quem veio buscar não é o responsável, com o animal já pronto na coleira, é a conversa que ninguém
 * quer ter — e a alternativa que a recepção inventa é entregar assim mesmo.
 */
const autorizados = ref<string[]>([])
const novoAutorizado = ref('')

function acrescentarAutorizado() {
  const nome = novoAutorizado.value.trim()

  if (nome && !autorizados.value.includes(nome)) {
    autorizados.value = [...autorizados.value, nome]
  }

  novoAutorizado.value = ''
}

function removerAutorizado(nome: string) {
  autorizados.value = autorizados.value.filter((item) => item !== nome)
}

const aberto = computed(() => props.acomodacao !== null)

const ORIGENS: ReservaOrigem[] = ['balcao', 'telefone', 'whatsapp', 'app', 'retorno', 'indicacao']

/**
 * Só os hóspedes que cabem na acomodação escolhida.
 *
 * Filtrar aqui em vez de recusar na confirmação evita a sequência mais irritante do balcão:
 * escolher o animal, preencher o resto e descobrir no fim que ele não cabe.
 */
const candidatos = computed(() => {
  const acomodacao = props.acomodacao

  if (!acomodacao) {
    return []
  }

  return hotelStore.pets
    .filter(
      (pet) =>
        acomodacao.especiesAceitas.length === 0 || acomodacao.especiesAceitas.includes(pet.especie),
    )
    .map((pet) => ({
      valor: pet.id,
      rotulo: `${pet.nome} · ${hotelStore.tutor(pet.tutorId)?.nome ?? ''}`,
      tutorId: pet.tutorId,
    }))
    .sort((um, outro) => um.rotulo.localeCompare(outro.rotulo, 'pt-BR'))
})

/**
 * O acompanhante só pode ser da **mesma casa**.
 *
 * Capacidade 2 não é lotação de desconhecidos: dois cães que moram juntos dormem juntos, e
 * separá-los é pior para os dois. Oferecer qualquer animal aqui produziria a reserva que junta
 * dois estranhos numa baia.
 */
const acompanhantes = computed(() => {
  const escolhido = hotelStore.pet(petId.value)

  if (!escolhido || (props.acomodacao?.capacidade ?? 1) < 2) {
    return []
  }

  return candidatos.value.filter(
    (item) => item.tutorId === escolhido.tutorId && item.valor !== escolhido.id,
  )
})

const servicosDisponiveis = computed(() =>
  hotelStore.servicos.map((servico) => ({
    valor: servico.id,
    rotulo: `${formato.servico(servico.kind)} · ${formato.moeda(servico.precoCentavos)}${
      servico.porDiaria ? t('hotel.reserva.porDiaria') : ''
    }`,
  })),
)

const contratados = computed<ServicoContratado[]>(() =>
  servicosEscolhidos.value.flatMap((id) => {
    const servico = hotelStore.servico(id)

    return servico
      ? [
          {
            servicoId: servico.id,
            quantidade: 1,
            precoUnitarioCentavos: servico.precoCentavos,
            observacao: '',
          },
        ]
      : []
  }),
)

/** O aviso de admissão, calculado contra a **saída** — a regra R1, desde a criação. */
const admissao = computed(() => {
  const pet = hotelStore.pet(petId.value)

  if (!pet) {
    return null
  }

  return avaliarAdmissao({
    exigencias: hotelStore.exigencias,
    comprovantes: props.comprovantes,
    petId: pet.id,
    especie: pet.especie,
    saidaPrevista: dataDe(fimEscolhido.value),
    hoje: props.hoje,
  })
})

function limpar() {
  petId.value = ''
  acompanhanteId.value = null
  origem.value = 'telefone'
  servicosEscolhidos.value = []
  observacao.value = ''
  autorizados.value = []
  novoAutorizado.value = ''
  /* As horas nascem na política da casa, que é o caso comum — e mudam com um toque. */
  horaEntrada.value = horaDe(props.inicio)
  horaSaida.value = horaDe(props.fim)

  /*
   * E as noites nascem com a duração que estava sendo procurada no mapa: quem clicou numa célula
   * depois de procurar "três noites" já disse quantas quer. Aqui ele muda de ideia, não recomeça.
   */
  noites.value = Math.max(1, contarDiarias(dataDe(props.inicio), dataDe(props.fim)))
}

/**
 * O orçamento é **calculado pelo repositório**, não aqui.
 *
 * A conta do preço vive num lugar só: a que o balcão lê antes de vender precisa ser byte a byte a
 * que a reserva guarda depois. Uma segunda implementação na tela divergiria no primeiro feriado, e
 * a divergência apareceria como o cliente sendo cobrado a mais do que ouviu.
 */
const orcamento = computed<Orcamento | null>(() => {
  if (!props.acomodacao || !petId.value) {
    return null
  }

  return reservas.simular({
    acomodacaoId: props.acomodacao.id,
    petId: petId.value,
    acompanhantePetId: acompanhanteId.value,
    inicio: inicioEscolhido.value,
    fim: fimEscolhido.value,
    servicos: contratados.value,
  })
})

/**
 * A vaga para o período escolhido **agora**.
 *
 * Esticar a estadia pode esbarrar na próxima reserva da mesma acomodação, e o repositório recusa
 * na hora de gravar. Recusar no fim é recusar depois de escolher hóspede, serviços e autorizados —
 * por isso a resposta aparece aqui, enquanto o número muda.
 */
const vaga = computed(() => {
  if (!props.acomodacao) {
    return null
  }

  return reservaRepository.vaga({
    acomodacaoId: props.acomodacao.id,
    inicio: inicioEscolhido.value,
    fim: fimEscolhido.value,
    petId: petId.value || undefined,
    ocupantes: acompanhanteId.value ? 2 : 1,
  })
})

const semVaga = computed(() => (vaga.value?.impedimentos.length ?? 0) > 0)

watch(
  () => props.acomodacao?.id,
  (novo) => {
    if (novo) {
      limpar()
    }
  },
)

/** O acompanhante escolhido some quando o hóspede principal muda — ele era de outra casa. */
watch(petId, () => {
  acompanhanteId.value = null
})

function confirmar() {
  if (!props.acomodacao || !petId.value || semVaga.value) {
    return
  }

  emit('confirmar', {
    petId: petId.value,
    acompanhantePetId: acompanhanteId.value,
    acomodacaoId: props.acomodacao.id,
    inicio: inicioEscolhido.value,
    fim: fimEscolhido.value,
    origem: origem.value,
    servicos: contratados.value,
    observacao: observacao.value,
    autorizadosARetirar: autorizados.value,
  })
}
</script>

<template>
  <Dialog
    :visible="aberto"
    modal
    :header="t('hotel.reserva.novaTitulo', { acomodacao: acomodacao?.nome ?? '' })"
    :style="{ width: 'min(46rem, 94vw)' }"
    class="clinic-scope hc-tema"
    @update:visible="emit('fechar')"
  >
    <div class="nova">
      <section class="quando">
        <p class="quando__frase">
          <i class="pi pi-calendar" aria-hidden="true" />
          <strong>{{ formato.periodo(inicioEscolhido, fimEscolhido) }}</strong>
          <span class="quando__diarias">
            {{ t('hotel.reserva.diarias', { total: noites }, noites) }}
          </span>
        </p>

        <!--
          Quantas noites, com os atalhos do que mais se vende.
          A duração vinha da busca do mapa e não podia ser mudada aqui: "do dia 28, por quantas
          noites?" é a pergunta seguinte à do dia, e ela não tinha onde ser respondida.
        -->
        <div class="quando__linha">
          <label :for="`${idCampo}-noites`">{{ t('hotel.reserva.quantasNoites') }}</label>
          <InputNumber
            :input-id="`${idCampo}-noites`"
            v-model="noites"
            :min="1"
            :max="120"
            show-buttons
            button-layout="horizontal"
            increment-button-icon="pi pi-plus"
            decrement-button-icon="pi pi-minus"
            size="small"
            class="quando__contador"
          />

          <span class="quando__atalhos">
            <Button
              v-for="atalho in ATALHOS"
              :key="atalho"
              :label="String(atalho)"
              :severity="noites === atalho ? 'primary' : 'secondary'"
              :outlined="noites !== atalho"
              size="small"
              :aria-label="t('hotel.reserva.noitesAtalho', { total: atalho }, atalho)"
              @click="noites = atalho"
            />
          </span>
        </div>

        <div class="quando__linha">
          <label :for="`${idCampo}-hora-entrada`">{{ t('hotel.reserva.chegaAs') }}</label>
          <InputMask
            :id="`${idCampo}-hora-entrada`"
            v-model="horaEntrada"
            mask="99:99"
            placeholder="08:00"
            size="small"
          />

          <label :for="`${idCampo}-hora-saida`">{{ t('hotel.reserva.saiAs') }}</label>
          <InputMask
            :id="`${idCampo}-hora-saida`"
            v-model="horaSaida"
            mask="99:99"
            placeholder="12:00"
            size="small"
          />
        </div>

        <!--
          A vaga responde enquanto o número muda. Sem isto, esticar a estadia para dentro da
          próxima reserva só era recusado no clique de confirmar — depois de preencher todo o resto.
        -->
        <Message v-if="semVaga" severity="error" :closable="false">
          {{
            t('hotel.reserva.semVaga', {
              motivo: (vaga?.impedimentos ?? [])
                .map((item: string) => t(`hotel.erros.vaga.${item}`))
                .join(', '),
            })
          }}
        </Message>
      </section>

      <div class="nova__grade">
        <div class="campo">
          <label :for="`${idCampo}-pet`">{{ t('hotel.reserva.hospede') }}</label>
          <Select
            :input-id="`${idCampo}-pet`"
            v-model="petId"
            :options="candidatos"
            option-label="rotulo"
            option-value="valor"
            filter
            :placeholder="t('hotel.reserva.escolhaHospede')"
            fluid
          />
        </div>

        <div v-if="acompanhantes.length > 0" class="campo">
          <label :for="`${idCampo}-acomp`">{{ t('hotel.reserva.acompanhante') }}</label>
          <Select
            :input-id="`${idCampo}-acomp`"
            v-model="acompanhanteId"
            :options="acompanhantes"
            option-label="rotulo"
            option-value="valor"
            show-clear
            :placeholder="t('hotel.reserva.semAcompanhante')"
            fluid
          />
        </div>

        <div class="campo">
          <label :for="`${idCampo}-origem`">{{ t('hotel.reserva.origem') }}</label>
          <Select
            :input-id="`${idCampo}-origem`"
            v-model="origem"
            :options="ORIGENS.map((item) => ({ valor: item, rotulo: formato.origem(item) }))"
            option-label="rotulo"
            option-value="valor"
            fluid
          />
        </div>

        <div class="campo campo--largo">
          <label :for="`${idCampo}-servicos`">{{ t('hotel.reserva.servicos') }}</label>
          <MultiSelect
            :input-id="`${idCampo}-servicos`"
            v-model="servicosEscolhidos"
            :options="servicosDisponiveis"
            option-label="rotulo"
            option-value="valor"
            display="chip"
            :placeholder="t('hotel.reserva.semServico')"
            fluid
          />
        </div>

        <div class="campo campo--largo">
          <label :for="`${idCampo}-obs`">{{ t('hotel.reserva.observacao') }}</label>
          <Textarea
            :id="`${idCampo}-obs`"
            v-model="observacao"
            rows="2"
            auto-resize
            fluid
            :placeholder="t('hotel.reserva.observacaoDica')"
          />
        </div>

        <!--
          Quem mais pode buscar o animal. Vazio significa "só o responsável", que é o caso comum —
          por isso a lista não é obrigatória e não trava a venda.
        -->
        <div class="campo campo--largo">
          <label :for="`${idCampo}-autorizado`">{{ t('hotel.reserva.autorizados') }}</label>

          <ul v-if="autorizados.length > 0" class="autorizados">
            <li v-for="nome in autorizados" :key="nome">
              <span>{{ nome }}</span>
              <Button
                icon="pi pi-times"
                severity="secondary"
                text
                rounded
                size="small"
                :aria-label="t('hotel.reserva.removerAutorizado', { nome })"
                @click="removerAutorizado(nome)"
              />
            </li>
          </ul>

          <div class="autorizados__novo">
            <InputText
              :id="`${idCampo}-autorizado`"
              v-model="novoAutorizado"
              :placeholder="t('hotel.reserva.autorizadosDica')"
              fluid
              @keyup.enter="acrescentarAutorizado"
            />
            <Button
              icon="pi pi-plus"
              severity="secondary"
              outlined
              :aria-label="t('hotel.reserva.acrescentarAutorizado')"
              @click="acrescentarAutorizado"
            />
          </div>
        </div>
      </div>

      <!--
        O aviso de admissão nasce com a reserva, e não bloqueia: o responsável tem dias para
        trazer o papel. Recusar a venda aqui perderia o hóspede por um documento que ele vai levar.
      -->
      <div v-if="admissao && situacaoParaSelo(admissao) !== 'ok'" class="nova__admissao">
        <HotelSelo
          :rotulo="formato.situacaoDaExigencia(situacaoParaSelo(admissao))"
          :tom="tomDaAdmissao(situacaoParaSelo(admissao))"
          icone="pi pi-id-card"
        />
        <span>
          {{
            t('hotel.reserva.avisoAdmissao', {
              itens: [...admissao.impedimentos, ...admissao.avisos]
                .map((item) => formato.exigencia(item.kind))
                .join(', '),
            })
          }}
        </span>
      </div>

      <OrcamentoTabela v-if="orcamento" :orcamento="orcamento" />

      <Message v-if="erro" severity="error" :closable="false">{{ t(erro) }}</Message>
    </div>

    <template #footer>
      <Button
        :label="t('hotel.comum.cancelar')"
        severity="secondary"
        text
        @click="emit('fechar')"
      />
      <Button
        :label="t('hotel.reserva.criar')"
        icon="pi pi-check"
        :loading="salvando"
        :disabled="!petId"
        @click="confirmar"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.nova {
  display: grid;
  gap: var(--clinic-space-4);
}

.nova__grade {
  display: grid;
  gap: var(--clinic-space-3);
  grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
}

.campo {
  display: grid;
  /* Linhas no topo: sem isto, o campo ao lado de um mais alto desce e a fileira sai torta. */
  align-content: start;
  gap: 0.25rem;
}

.campo--largo {
  grid-column: 1 / -1;
}

.campo label {
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
  font-weight: 700;
}

/* O selo diz o estado; a frase explica, no cinza do texto. */
.nova__admissao {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--clinic-space-2);
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
}
.autorizados {
  display: flex;
  flex-wrap: wrap;
  margin: 0;
  padding: 0;
  gap: 0.35rem;
  list-style: none;
}

.autorizados li {
  display: flex;
  align-items: center;
  gap: 0.15rem;
  padding: 0.1rem 0.15rem 0.1rem 0.6rem;
  border: 1px solid var(--clinic-line-soft);
  border-radius: 99rem;
  background: var(--clinic-surface-sunken, transparent);
  font-size: var(--clinic-font-label);
}

.autorizados__novo {
  display: flex;
  gap: var(--clinic-space-2);
}
.quando {
  display: grid;
  gap: var(--clinic-space-2);
  padding: var(--clinic-space-3);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-control);
  background: var(--clinic-surface-soft);
}

.quando__frase {
  display: flex;
  align-items: center;
  margin: 0;
  gap: var(--clinic-space-2);
  color: var(--clinic-text);
  font-size: var(--clinic-font-body);
}

.quando__diarias {
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
}

.quando__linha {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--clinic-space-2);
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
}

/* O contador é estreito: o número tem dois dígitos, e um campo largo sugere que caberia mais. */
.quando__contador :deep(input) {
  width: 3rem;
  text-align: center;
}

.quando__atalhos {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  margin-inline-start: auto;
}

.quando__atalhos :deep(.p-button) {
  min-width: 2.1rem;
  padding-inline: 0.45rem;
}

.quando__linha :deep(.p-inputmask) {
  width: 4.5rem;
  text-align: center;
}
</style>
