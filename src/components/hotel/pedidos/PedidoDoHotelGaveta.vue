<script setup lang="ts">
/**
 * Responder um pedido de hospedagem (E7-03b, guia e7 35): o pedido (quem, quando, o tipo ou "o
 * hotel escolhe", os serviços, o contato e a observação para quem tem `paciente.ler`, a idade da
 * conta, quantos outros pedidos pendentes disputam as mesmas noites) e a resposta.
 *
 * Aceitar é escolher uma das acomodações livres que servem (o tipo pedido primeiro; com "aceita
 * mudar um dia", as de um dia antes ou depois): a estimativa mostra o que a reserva vai custar e
 * os serviços que saem. O aceite reconfere a vaga e pode dar `SEM_VAGA_NO_ACEITE`: a lista se
 * refaz. Recusar leva o motivo e a mensagem (obrigatória em "outro"), que vai à página do pedido e
 * ao e-mail, nunca ao push; as noites livres do tipo ajudam a oferecer outra data.
 */
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import Listbox from 'primevue/listbox'
import SelectButton from 'primevue/selectbutton'
import Textarea from 'primevue/textarea'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useRotulosDasReservas } from '@/components/hotel/reservas/useRotulosDasReservas'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { criarChaveadorDeIdempotencia } from '@/service/idempotencia'
import {
  aceitarPedidoDoHotel,
  estimativaDoPedido,
  lerPedidoDoHotel,
  MENSAGEM_MAX,
  MOTIVOS_DA_RECUSA,
  noitesDoPedido,
  recusarPedidoDoHotel,
  sugestoesDoPedido,
  type DetalheDoPedido,
  type Estimativa,
  type MotivoDaRecusa,
  type NoiteDoPedido,
  type SugestaoDoPedido,
} from '@/service/parceiro/hotel-pedidos-service'

const props = defineProps<{ pedidoId: string | null; podeResponder: boolean }>()
const aberta = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{ respondido: [recado: string, reservaId: string | null] }>()

const { t } = useI18n()
const rotulos = useRotulosDasReservas()
const { store, parceiroQuery } = useParceiroPortal()
const chaveador = criarChaveadorDeIdempotencia()

const veDinheiro = computed(() => store.temPermissao('hotel.valores'))
const vePessoa = computed(() => store.temPermissao('paciente.ler'))

const pedido = ref<DetalheDoPedido | null>(null)
const carregando = ref(false)
const erro = ref('')
const modo = ref<'ACEITAR' | 'RECUSAR'>('ACEITAR')
const sugestoes = ref<SugestaoDoPedido[]>([])
const escolhida = ref<string | null>(null)
const estimativa = ref<Estimativa | null>(null)
const copiarObservacao = ref(false)
const motivo = ref<MotivoDaRecusa>('SEM_VAGA')
const mensagem = ref('')
const noites = ref<NoiteDoPedido[]>([])
const tentou = ref(false)
const salvando = ref(false)

const chave = (s: SugestaoDoPedido) => `${s.acomodacaoId}|${s.entradaData}|${s.saidaData}`

async function carregarSugestoes() {
  if (!props.pedidoId) return
  sugestoes.value = (
    await sugestoesDoPedido(props.pedidoId, parceiroQuery()).catch(() => ({ itens: [] }))
  ).itens
  escolhida.value = sugestoes.value[0] ? chave(sugestoes.value[0]) : null
}

watch(aberta, async (agora) => {
  if (!agora || !props.pedidoId) return
  pedido.value = null
  erro.value = ''
  modo.value = 'ACEITAR'
  sugestoes.value = []
  escolhida.value = null
  estimativa.value = null
  copiarObservacao.value = false
  motivo.value = 'SEM_VAGA'
  mensagem.value = ''
  noites.value = []
  tentou.value = false
  chaveador.concluir()
  carregando.value = true
  try {
    pedido.value = await lerPedidoDoHotel(props.pedidoId, parceiroQuery())
    if (pedido.value.status === 'PENDENTE' && props.podeResponder) {
      void carregarSugestoes()
      if (pedido.value.tipo?.id)
        noites.value = (
          await noitesDoPedido(props.pedidoId, parceiroQuery()).catch(() => ({ noites: [] }))
        ).noites
    }
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('pedidosDoHotel.erro')).mensagem
  } finally {
    carregando.value = false
  }
})

const sugestao = computed(() => sugestoes.value.find((s) => chave(s) === escolhida.value) ?? null)

watch(sugestao, async (s) => {
  estimativa.value = null
  if (!s || !veDinheiro.value || !props.pedidoId) return
  estimativa.value = await estimativaDoPedido(
    props.pedidoId,
    { acomodacaoId: s.acomodacaoId, entradaData: s.entradaData, saidaData: s.saidaData },
    parceiroQuery(),
  ).catch(() => null)
})

const opcoesDeSugestao = computed(() =>
  sugestoes.value.map((s) => ({
    valor: chave(s),
    rotulo: [
      `${s.nome} · ${s.tipoNome}`,
      t('reservasDoHotel.periodo', {
        de: rotulos.dia(s.entradaData),
        ate: rotulos.dia(s.saidaData),
      }),
      s.mudouAData
        ? t(s.mudouAData < 0 ? 'pedidosDoHotel.umDiaAntes' : 'pedidosDoHotel.umDiaDepois')
        : '',
      !s.tipoPedido ? t('pedidosDoHotel.outroTipo') : '',
      typeof s.totalCentavos === 'number' ? rotulos.dinheiro(s.totalCentavos) : '',
    ]
      .filter(Boolean)
      .join(' · '),
  })),
)
const opcoesDeModo = computed(() => [
  { valor: 'ACEITAR', rotulo: t('pedidosDoHotel.aceitar') },
  { valor: 'RECUSAR', rotulo: t('pedidosDoHotel.recusar') },
])
const opcoesDeMotivo = computed(() =>
  MOTIVOS_DA_RECUSA.map((valor) => ({ valor, rotulo: t(`pedidosDoHotel.motivo.${valor}`) })),
)

const nomes = computed(() => pedido.value?.animais.map((a) => a.nome).join(' e ') ?? '')

async function aceitar() {
  tentou.value = true
  erro.value = ''
  const s = sugestao.value
  if (!s || !pedido.value) return
  const corpo = {
    acomodacaoId: s.acomodacaoId,
    ...(s.mudouAData ? { entradaData: s.entradaData, saidaData: s.saidaData } : {}),
    ...(copiarObservacao.value ? { copiarObservacao: true } : {}),
  }
  salvando.value = true
  try {
    const feito = await aceitarPedidoDoHotel(
      pedido.value.id,
      corpo,
      chaveador.para(corpo),
      parceiroQuery(),
    )
    chaveador.concluir()
    aberta.value = false
    emit(
      'respondido',
      t('pedidosDoHotel.aceito', {
        nomes: nomes.value,
        acomodacao: s.nome,
        periodo: rotulos.periodo(feito.reserva.entrada, feito.reserva.saida),
      }),
      feito.reserva.id,
    )
  } catch (err) {
    const lido = lerErroDoCadastro(err, t('pedidosDoHotel.erroResponder'))
    erro.value = lido.mensagem
    if (lido.codigo === 'SEM_VAGA_NO_ACEITE') void carregarSugestoes()
  } finally {
    salvando.value = false
  }
}

async function recusar() {
  tentou.value = true
  erro.value = ''
  if (!pedido.value || (motivo.value === 'OUTRO' && !mensagem.value.trim())) return
  salvando.value = true
  try {
    await recusarPedidoDoHotel(
      pedido.value.id,
      { motivo: motivo.value, mensagem: mensagem.value.trim() || null },
      parceiroQuery(),
    )
    aberta.value = false
    emit('respondido', t('pedidosDoHotel.recusado'), null)
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('pedidosDoHotel.erroResponder')).mensagem
  } finally {
    salvando.value = false
  }
}

const respondendo = computed(() => pedido.value?.status === 'PENDENTE' && props.podeResponder)
</script>

<template>
  <CadastroGaveta
    v-model:visible="aberta"
    :titulo="pedido ? t('pedidosDoHotel.titulo', { nomes }) : t('pedidosDoHotel.carregando')"
    icone="ph ph-calendar-plus"
    largura="40rem"
  >
    <div class="eg">
      <p v-if="carregando" class="eg__dica">{{ t('pedidosDoHotel.carregando') }}</p>
      <template v-if="pedido">
        <section class="eg__grupo">
          <h3 class="eg__grupo-titulo">{{ t('pedidosDoHotel.oPedido') }}</h3>
          <dl class="pd__fatos">
            <div>
              <dt>{{ t('reservasDoHotel.detalhe.animais') }}</dt>
              <dd>
                {{
                  pedido.animais
                    .map((a) =>
                      [
                        a.nome,
                        rotulos.especie(a.especie),
                        a.porteDeclarado ? rotulos.porte(a.porteDeclarado) : '',
                      ]
                        .filter(Boolean)
                        .join(' · '),
                    )
                    .join('; ')
                }}
              </dd>
            </div>
            <div>
              <dt>{{ t('reservasDoHotel.nova.quando') }}</dt>
              <dd>
                {{ rotulos.periodo(pedido.entrada, pedido.saida) }} ·
                {{ rotulos.diarias(pedido.diarias) }}
                <template v-if="pedido.aceitaMudarUmDia">
                  · {{ t('pedidosDoHotel.aceitaMudar') }}</template
                >
              </dd>
            </div>
            <div>
              <dt>{{ t('reservasDoHotel.nova.onde') }}</dt>
              <dd>
                {{
                  pedido.modo === 'HOTEL_ESCOLHE'
                    ? t('pedidosDoHotel.hotelEscolhe')
                    : t('pedidosDoHotel.escolheu', { tipo: pedido.tipo?.nome ?? '' })
                }}
                <template v-if="pedido.vaga">
                  ·
                  {{
                    t('pedidosDoHotel.livresAgora', { n: pedido.vaga.livres }, pedido.vaga.livres)
                  }}</template
                >
              </dd>
            </div>
            <div v-if="pedido.servicos.length">
              <dt>{{ t('reservasDoHotel.nova.servicos') }}</dt>
              <dd>{{ pedido.servicos.map(rotulos.servico).join(', ') }}</dd>
            </div>
            <div>
              <dt>{{ t('pedidosDoHotel.quem') }}</dt>
              <dd>
                {{
                  [
                    pedido.quemPede ?? '',
                    pedido.telefone ?? '',
                    pedido.email ?? '',
                    t(`pedidosDoHotel.canal.${pedido.canal}`),
                    typeof pedido.contaCriadaHaDias === 'number'
                      ? pedido.contaCriadaHaDias === 0
                        ? t('pedidosDoHotel.contaHoje')
                        : t(
                            'pedidosDoHotel.contaHa',
                            { n: pedido.contaCriadaHaDias },
                            pedido.contaCriadaHaDias,
                          )
                      : '',
                  ]
                    .filter(Boolean)
                    .join(' · ')
                }}
              </dd>
            </div>
            <div v-if="pedido.observacao">
              <dt>{{ t('reservasDoHotel.nova.observacao') }}</dt>
              <dd>{{ pedido.observacao }}</dd>
            </div>
          </dl>
          <p v-if="pedido.porteDivergente" class="eg__aviso">
            <i class="ph ph-warning" aria-hidden="true" />
            <span>{{ t('pedidosDoHotel.porteDivergente') }}</span>
          </p>
          <p v-if="pedido.pedidosPendentesNasMesmasNoites" class="eg__aviso">
            <i class="ph ph-info" aria-hidden="true" />
            <span>{{
              t(
                'pedidosDoHotel.outrosPedidos',
                { n: pedido.pedidosPendentesNasMesmasNoites },
                pedido.pedidosPendentesNasMesmasNoites,
              )
            }}</span>
          </p>
          <p class="eg__dica">{{ t('pedidosDoHotel.semGarantia') }}</p>
        </section>

        <section v-if="!respondendo && pedido.status !== 'PENDENTE'" class="eg__grupo">
          <h3 class="eg__grupo-titulo">{{ t('pedidosDoHotel.resposta') }}</h3>
          <p class="eg__dica">
            {{ t(`pedidosDoHotel.status.${pedido.status}`) }}
            <template v-if="pedido.respondidoEm">
              · {{ rotulos.quando(pedido.respondidoEm) }}</template
            >
            <template v-if="pedido.recusa">
              · {{ t(`pedidosDoHotel.motivo.${pedido.recusa.motivo}`) }}</template
            >
          </p>
          <p v-if="pedido.recusa?.mensagem" class="pd__mensagem">{{ pedido.recusa.mensagem }}</p>
          <RouterLink
            v-if="pedido.reservaId"
            :to="`/hotel/reserva/${pedido.reservaId}`"
            class="pd__link"
          >
            {{ t('pedidosDoHotel.verReserva') }}
          </RouterLink>
        </section>

        <template v-if="respondendo">
          <SelectButton
            v-model="modo"
            :options="opcoesDeModo"
            option-label="rotulo"
            option-value="valor"
            :allow-empty="false"
            :aria-label="t('pedidosDoHotel.resposta')"
            :disabled="salvando"
          />

          <section v-if="modo === 'ACEITAR'" class="eg__grupo">
            <h3 class="eg__grupo-titulo">{{ t('pedidosDoHotel.onde') }}</h3>
            <Listbox
              v-if="opcoesDeSugestao.length"
              v-model="escolhida"
              :options="opcoesDeSugestao"
              option-label="rotulo"
              option-value="valor"
              :aria-label="t('pedidosDoHotel.onde')"
              :disabled="salvando"
              class="pd__sugestoes"
            />
            <p v-else class="eg__aviso">
              <i class="ph ph-warning" aria-hidden="true" />
              <span>{{ t('pedidosDoHotel.semSugestao') }}</span>
            </p>
            <p v-if="estimativa" class="pd__estimativa">
              <i class="ph ph-receipt" aria-hidden="true" />
              <span>{{
                t('reservasDoHotel.nova.total', {
                  total: rotulos.dinheiro(estimativa.orcamento.totalCentavos),
                  sinal: rotulos.dinheiro(estimativa.orcamento.sinalCentavos),
                })
              }}</span>
            </p>
            <p v-if="estimativa?.servicosRemovidos.length" class="eg__aviso">
              <i class="ph ph-info" aria-hidden="true" />
              <span>{{
                t('pedidosDoHotel.servicosRemovidos', {
                  lista: estimativa.servicosRemovidos.map(rotulos.servico).join(', '),
                })
              }}</span>
            </p>
            <label v-if="vePessoa && pedido.temObservacao" class="pd__chave">
              <Checkbox v-model="copiarObservacao" binary :disabled="salvando" />
              <span>{{ t('pedidosDoHotel.copiarObservacao') }}</span>
            </label>
            <p class="eg__dica">{{ t('pedidosDoHotel.aceiteDica') }}</p>
          </section>

          <section v-else class="eg__grupo">
            <h3 class="eg__grupo-titulo">{{ t('pedidosDoHotel.porque') }}</h3>
            <SelectButton
              v-model="motivo"
              :options="opcoesDeMotivo"
              option-label="rotulo"
              option-value="valor"
              :allow-empty="false"
              :aria-label="t('pedidosDoHotel.porque')"
              :disabled="salvando"
              class="pd__motivos"
            />
            <div class="eg__secao">
              <label class="eg__rotulo" for="pd-mensagem">
                {{ t('pedidosDoHotel.mensagem') }}
                <span v-if="motivo !== 'OUTRO'" class="eg__opcional">{{
                  t('cadastro.opcional')
                }}</span>
              </label>
              <Textarea
                id="pd-mensagem"
                v-model="mensagem"
                rows="3"
                auto-resize
                :maxlength="MENSAGEM_MAX"
                :invalid="tentou && motivo === 'OUTRO' && !mensagem.trim()"
                :disabled="salvando"
              />
              <small class="eg__dica">{{ t('pedidosDoHotel.mensagemDica') }}</small>
            </div>
            <div v-if="noites.length" class="eg__secao">
              <span class="eg__rotulo">{{
                t('pedidosDoHotel.noites', { tipo: pedido.tipo?.nome ?? '' })
              }}</span>
              <ul class="pd__noites">
                <li v-for="n in noites" :key="n.data" :class="{ 'pd__noite--cheia': !n.livres }">
                  <strong>{{ rotulos.dia(n.data) }}</strong>
                  <span>{{ t('pedidosDoHotel.livres', { n: n.livres }, n.livres) }}</span>
                </li>
              </ul>
            </div>
          </section>
        </template>
      </template>

      <p v-if="erro" class="eg__erro" role="alert">
        <i class="ph ph-warning-circle" aria-hidden="true" />
        <span>{{ erro }}</span>
      </p>
    </div>
    <template #pe>
      <Button
        type="button"
        severity="secondary"
        outlined
        :label="t('pedidosDoHotel.fechar')"
        :disabled="salvando"
        @click="aberta = false"
      />
      <Button
        v-if="respondendo && modo === 'ACEITAR'"
        type="button"
        icon="ph ph-check"
        :label="
          sugestao
            ? t('pedidosDoHotel.reservarEm', { acomodacao: sugestao.nome })
            : t('pedidosDoHotel.aceitar')
        "
        :disabled="!sugestao"
        :loading="salvando"
        @click="aceitar"
      />
      <Button
        v-else-if="respondendo"
        type="button"
        icon="ph ph-x"
        :label="t('pedidosDoHotel.enviarRecusa')"
        :loading="salvando"
        @click="recusar"
      />
    </template>
  </CadastroGaveta>
</template>

<style scoped>
.pd__fatos {
  display: grid;
  gap: 10px;
  margin: 0;
}

.pd__fatos div {
  display: grid;
  grid-template-columns: minmax(7rem, 9rem) 1fr;
  gap: 12px;
  font-size: 14px;
  line-height: 1.45;
}

.pd__fatos dt {
  color: var(--tinta-2);
}

.pd__fatos dd {
  margin: 0;
  color: var(--tinta);
}

.pd__sugestoes {
  width: 100%;
}

/* A opção escolhida segue legível: a tinta da casa sobre o realce, nunca o cinza do tema. */
.pd__sugestoes :deep(.p-listbox-option-selected) {
  color: var(--tinta);
  font-weight: 600;
}

.pd__estimativa {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  color: var(--tinta);
  font-size: 14px;
  font-weight: 600;
}

.pd__estimativa i {
  margin-top: 3px;
  color: var(--tinta-2);
}

.pd__chave {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--tinta);
  font-size: 14px;
  cursor: pointer;
}

.pd__motivos {
  flex-wrap: wrap;
}

.pd__noites {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.pd__noites li {
  display: grid;
  min-width: 4.5rem;
  padding: 6px 8px;
  border-radius: 8px;
  background: var(--ok-fundo);
  color: var(--tinta);
  font-size: 12px;
}

.pd__noites li.pd__noite--cheia {
  background: var(--superficie-3);
  color: var(--tinta-2);
}

.pd__mensagem {
  margin: 0;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--superficie-3);
  color: var(--tinta);
  font-size: 14px;
}

.pd__link {
  color: var(--tinta);
  font-size: 14px;
  font-weight: 600;
}
</style>
