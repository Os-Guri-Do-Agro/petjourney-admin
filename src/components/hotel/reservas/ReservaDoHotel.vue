<script setup lang="ts">
/**
 * O detalhe da reserva pela API (E7-02, guia e7 15, 16 e 29 a 31): a estadia (quem, onde, quando,
 * serviços, observação, a política congelada na venda), o orçamento e o livro de pagamentos (só
 * quem vê dinheiro), a documentação por animal, quem pode buscar (só `hotel.checkout`) e o
 * responsável (só `paciente.ler`, com o telefone em texto: a casa liga pelo telefone dela).
 *
 * As ações seguem o status: registrar pagamento (`hotel.valores`), editar, cancelar e não
 * comparecimento (`hotel.reserva`). A pendente diz há quanto tempo espera e não expira sozinha.
 */
import Button from 'primevue/button'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import UiPagina from '@/components/ui/UiPagina.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { lerCasa, type CasaDoHotel } from '@/service/parceiro/hotel-casa-service'
import {
  lerReserva,
  marcarNaoCompareceu,
  type ReservaDetalhe,
} from '@/service/parceiro/hotel-reservas-service'

import AdmissaoDaReserva from './AdmissaoDaReserva.vue'
import AutorizadosGaveta from './AutorizadosGaveta.vue'
import CancelarReservaGaveta from './CancelarReservaGaveta.vue'
import ConfirmarPagamentoGaveta from './ConfirmarPagamentoGaveta.vue'
import EditarReservaGaveta from './EditarReservaGaveta.vue'
import { TOM_DO_STATUS, useRotulosDasReservas } from './useRotulosDasReservas'
import '@/components/hotel/casa/casa.css'

const props = defineProps<{ reservaId: string }>()

const { t } = useI18n()
const rotulos = useRotulosDasReservas()
const { store, parceiroQuery } = useParceiroPortal()

const reserva = ref<ReservaDetalhe | null>(null)
const casa = ref<CasaDoHotel | null>(null)
const carregando = ref(false)
const erro = ref('')
const recado = ref('')
const erroDaAcao = ref('')

async function carregar() {
  carregando.value = true
  erro.value = ''
  try {
    reserva.value = await lerReserva(props.reservaId, parceiroQuery())
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('reservasDoHotel.detalhe.erro')).mensagem
  } finally {
    carregando.value = false
  }
}

onMounted(async () => {
  void carregar()
  casa.value = await lerCasa(parceiroQuery()).catch(() => null)
})
watch(
  () => props.reservaId,
  () => void carregar(),
)

const escreve = computed(() => Boolean(store.modulo('HOTEL')?.podeEscrever))
const podeReservar = computed(() => escreve.value && store.temPermissao('hotel.reserva'))
const podePagamento = computed(() => escreve.value && store.temPermissao('hotel.valores'))
const gestao = computed(() => store.temPermissao('estabelecimento.editar'))

const viva = computed(() => ['PENDENTE', 'CONFIRMADA'].includes(reserva.value?.status ?? ''))
const editavel = computed(() =>
  ['PENDENTE', 'CONFIRMADA', 'HOSPEDADO'].includes(reserva.value?.status ?? ''),
)

const titulo = computed(
  () => reserva.value?.animais.map((a) => a.nome).join(' e ') ?? t('reservasDoHotel.titulo'),
)
const resumo = computed(() =>
  reserva.value
    ? [
        rotulos.periodo(reserva.value.entradaPrevista, reserva.value.saidaPrevista),
        reserva.value.acomodacao.nome,
      ].join(' · ')
    : '',
)

function servicos(r: ReservaDetalhe) {
  return r.servicos
    .map((s) =>
      [
        `${s.quantidade}× ${rotulos.servico(s.servico)}`,
        s.porDiaria ? t('reservasDoHotel.detalhe.porDiaria') : '',
        typeof s.precoUnitarioCentavos === 'number'
          ? rotulos.dinheiro(s.precoUnitarioCentavos)
          : '',
      ]
        .filter(Boolean)
        .join(' · '),
    )
    .join('; ')
}

function politica(r: ReservaDetalhe) {
  const p = r.politica
  return [
    t('reservasDoHotel.detalhe.saidaAte', { hora: p.horarioDeSaida, limite: p.limiteMeiaDiaria }),
    typeof p.meiaDiariaPercentual === 'number'
      ? t('reservasDoHotel.detalhe.meia', { p: p.meiaDiariaPercentual })
      : '',
    typeof p.sinalPercentual === 'number'
      ? t('reservasDoHotel.detalhe.sinal', { p: p.sinalPercentual })
      : '',
    typeof p.cancelamentoSemCustoDias === 'number'
      ? t(
          'reservasDoHotel.cancelar.prazo',
          { n: p.cancelamentoSemCustoDias },
          p.cancelamentoSemCustoDias,
        )
      : '',
  ]
    .filter(Boolean)
    .join(' · ')
}

/* ----------------------------------------------------------------------------- ações */

const pagamentoAberto = ref(false)
const editarAberto = ref(false)
const cancelarAberto = ref(false)
const autorizadosAberto = ref(false)
const marcando = ref(false)

function feito(texto: string) {
  recado.value = texto
  erroDaAcao.value = ''
  void carregar()
}

async function naoCompareceu() {
  if (!reserva.value) return
  marcando.value = true
  erroDaAcao.value = ''
  try {
    await marcarNaoCompareceu(reserva.value.id, parceiroQuery())
    feito(t('reservasDoHotel.detalhe.naoCompareceuFeito'))
  } catch (err) {
    erroDaAcao.value = lerErroDoCadastro(err, t('cadastro.erros.salvar')).mensagem
  } finally {
    marcando.value = false
  }
}
</script>

<template>
  <UiPagina
    :titulo="titulo"
    :resumo="resumo"
    icone="ph ph-calendar-check"
    :carregando="carregando && !reserva"
    :erro="reserva ? '' : erro"
    @tentar-de-novo="carregar"
  >
    <template #voltar>
      <RouterLink to="/hotel/reservas" class="rd__voltar">
        <i class="ph ph-arrow-left" aria-hidden="true" />
        {{ t('reservasDoHotel.titulo') }}
      </RouterLink>
    </template>

    <template v-if="reserva" #acoes>
      <Button
        v-if="podeReservar && viva"
        type="button"
        severity="secondary"
        outlined
        icon="ph ph-calendar-x"
        :label="t('reservasDoHotel.cancelar.acao')"
        @click="cancelarAberto = true"
      />
      <Button
        v-if="podeReservar && editavel && casa"
        type="button"
        severity="secondary"
        outlined
        icon="ph ph-pencil-simple"
        :label="t('reservasDoHotel.editar.acao')"
        @click="editarAberto = true"
      />
      <Button
        v-if="podePagamento && editavel && reserva.orcamento"
        type="button"
        icon="ph ph-money"
        :label="t('reservasDoHotel.pagamento.titulo')"
        @click="pagamentoAberto = true"
      />
    </template>

    <div v-if="reserva" class="rd">
      <p v-if="recado" class="ui-folha rd__recado" role="status">
        <i class="ph ph-check-circle" aria-hidden="true" />
        <span>{{ recado }}</span>
      </p>
      <p v-if="erroDaAcao" class="ui-folha rd__recado rd__recado--erro" role="alert">
        <i class="ph ph-warning-circle" aria-hidden="true" />
        <span>{{ erroDaAcao }}</span>
      </p>
      <p v-if="reserva.pendenteHaHoras !== null" class="ui-folha rd__recado rd__recado--atencao">
        <i class="ph ph-hourglass" aria-hidden="true" />
        <span>{{
          t(
            'reservasDoHotel.detalhe.pendente',
            { n: reserva.pendenteHaHoras },
            reserva.pendenteHaHoras,
          )
        }}</span>
      </p>

      <!-- A estadia: quem, onde, quando. -->
      <section class="ui-folha ui-cartao" aria-labelledby="rd-estadia">
        <header class="ui-cartao__cabeca">
          <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-door" /></span>
          <span class="ui-cartao__titulos">
            <h2 id="rd-estadia" class="ui-cartao__titulo">
              {{ t('reservasDoHotel.detalhe.estadia') }}
            </h2>
          </span>
          <span
            class="ui-selo"
            :class="
              TOM_DO_STATUS[reserva.status] ? `ui-selo--${TOM_DO_STATUS[reserva.status]}` : ''
            "
            >{{ rotulos.status(reserva.status) }}</span
          >
        </header>
        <dl class="rd__fatos">
          <div class="rd__fato">
            <dt>{{ t('reservasDoHotel.detalhe.animais') }}</dt>
            <dd>
              {{
                reserva.animais
                  .map((a) =>
                    [
                      a.nome,
                      rotulos.especie(a.especie),
                      a.porte ? rotulos.porte(a.porte) : '',
                      a.papel === 'ACOMPANHANTE' ? t('reservasDoHotel.detalhe.acompanhante') : '',
                    ]
                      .filter(Boolean)
                      .join(' · '),
                  )
                  .join('; ')
              }}
            </dd>
          </div>
          <div class="rd__fato">
            <dt>{{ t('reservasDoHotel.nova.onde') }}</dt>
            <dd>
              {{
                [
                  reserva.acomodacao.nome,
                  reserva.acomodacao.tipoNome,
                  reserva.acomodacao.blocoNome,
                ].join(' · ')
              }}
            </dd>
          </div>
          <div class="rd__fato">
            <dt>{{ t('reservasDoHotel.nova.quando') }}</dt>
            <dd>
              {{ rotulos.periodo(reserva.entradaPrevista, reserva.saidaPrevista) }} ·
              {{ rotulos.diarias(reserva.diarias) }}
            </dd>
          </div>
          <div class="rd__fato">
            <dt>{{ t('reservasDoHotel.nova.origem') }}</dt>
            <dd>{{ rotulos.origem(reserva.origem) }}</dd>
          </div>
          <div class="rd__fato">
            <dt>{{ t('reservasDoHotel.nova.servicos') }}</dt>
            <dd>
              {{
                reserva.servicos.length
                  ? servicos(reserva)
                  : t('reservasDoHotel.detalhe.semServicos')
              }}
            </dd>
          </div>
          <div v-if="reserva.observacao" class="rd__fato">
            <dt>{{ t('reservasDoHotel.nova.observacao') }}</dt>
            <dd>{{ reserva.observacao }}</dd>
          </div>
          <div class="rd__fato">
            <dt>{{ t('reservasDoHotel.detalhe.politica') }}</dt>
            <dd>{{ politica(reserva) }}</dd>
          </div>
          <div v-if="reserva.canceladaEm" class="rd__fato">
            <dt>{{ t('reservasDoHotel.detalhe.cancelada') }}</dt>
            <dd>
              {{ rotulos.quando(reserva.canceladaEm) }}
              <template v-if="reserva.motivoCancelamento">
                · {{ rotulos.motivo(reserva.motivoCancelamento) }}</template
              >
            </dd>
          </div>
          <div v-if="reserva.naoCompareceuEm" class="rd__fato">
            <dt>{{ rotulos.status('NAO_COMPARECEU') }}</dt>
            <dd>{{ rotulos.quando(reserva.naoCompareceuEm) }}</dd>
          </div>
          <div v-if="reserva.responsavel" class="rd__fato">
            <dt>{{ t('reservasDoHotel.detalhe.responsavel') }}</dt>
            <dd>
              {{
                [reserva.responsavel.nome, reserva.responsavel.telefone].filter(Boolean).join(' · ')
              }}
            </dd>
          </div>
        </dl>
        <footer v-if="podeReservar && viva" class="ui-cartao__pe rd__pe">
          <span>{{ t('reservasDoHotel.detalhe.naoCompareceuDica') }}</span>
          <Button
            type="button"
            size="small"
            severity="secondary"
            outlined
            :label="t('reservasDoHotel.detalhe.naoCompareceu')"
            :loading="marcando"
            @click="naoCompareceu"
          />
        </footer>
      </section>

      <!-- O dinheiro: só para quem vê. -->
      <section v-if="reserva.orcamento" class="ui-folha ui-cartao" aria-labelledby="rd-orcamento">
        <header class="ui-cartao__cabeca">
          <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-receipt" /></span>
          <span class="ui-cartao__titulos">
            <h2 id="rd-orcamento" class="ui-cartao__titulo">
              {{ t('reservasDoHotel.orcamento.titulo') }}
            </h2>
            <p class="ui-cartao__descricao">
              {{
                t('reservasDoHotel.orcamento.resumo', {
                  total: rotulos.dinheiro(reserva.orcamento.totalCentavos),
                  sinal: rotulos.dinheiro(reserva.orcamento.sinalCentavos),
                  pago: rotulos.dinheiro(reserva.pagoCentavos ?? 0),
                  saldo: rotulos.dinheiro(reserva.saldoCentavos ?? 0),
                })
              }}
            </p>
          </span>
          <span v-if="reserva.abaixoDoSinal" class="ui-selo ui-selo--atencao">{{
            t('reservasDoHotel.orcamento.abaixoDoSinal')
          }}</span>
        </header>
        <ul class="ui-lista">
          <li v-for="(l, i) in reserva.orcamento.linhas" :key="i" class="ui-linha">
            <span class="ui-linha__texto">
              <strong class="ui-linha__titulo">{{ rotulos.linha(l) }}</strong>
              <span class="ui-linha__meta">{{
                `${l.quantidade} × ${rotulos.dinheiro(l.unitarioCentavos)}`
              }}</span>
            </span>
            <span class="ui-linha__fim rd__valor ui-num">{{
              rotulos.dinheiro(l.totalCentavos)
            }}</span>
          </li>
        </ul>
        <template v-if="reserva.pagamentos?.length">
          <h3 class="rd__subtitulo">{{ t('reservasDoHotel.orcamento.pagamentos') }}</h3>
          <ul class="ui-lista">
            <li v-for="(p, i) in reserva.pagamentos" :key="i" class="ui-linha">
              <span class="ui-linha__texto">
                <strong class="ui-linha__titulo">{{
                  t(
                    p.deltaCentavos >= 0
                      ? 'reservasDoHotel.orcamento.entrou'
                      : 'reservasDoHotel.orcamento.baixou',
                    {
                      valor: rotulos.dinheiro(Math.abs(p.deltaCentavos)),
                    },
                  )
                }}</strong>
                <span class="ui-linha__meta">{{
                  [
                    rotulos.quando(p.registradoEm),
                    t('reservasDoHotel.orcamento.totalDepois', {
                      valor: rotulos.dinheiro(p.totalDepoisCentavos),
                    }),
                    p.motivo ?? '',
                  ]
                    .filter(Boolean)
                    .join(' · ')
                }}</span>
              </span>
            </li>
          </ul>
        </template>
      </section>

      <AdmissaoDaReserva
        :reserva="reserva"
        :pode-mexer="podeReservar && editavel"
        :gestao="gestao"
        @mudou="carregar"
      />

      <!-- Quem pode buscar: só quem faz a saída vê. -->
      <section
        v-if="reserva.autorizados"
        class="ui-folha ui-cartao"
        aria-labelledby="rd-autorizados"
      >
        <header class="ui-cartao__cabeca">
          <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-users" /></span>
          <span class="ui-cartao__titulos">
            <h2 id="rd-autorizados" class="ui-cartao__titulo">
              {{ t('reservasDoHotel.autorizados.titulo') }}
            </h2>
          </span>
          <Button
            v-if="podeReservar && editavel"
            type="button"
            size="small"
            severity="secondary"
            outlined
            icon="ph ph-pencil-simple"
            :label="t('reservasDoHotel.autorizados.editar')"
            @click="autorizadosAberto = true"
          />
        </header>
        <p v-if="!reserva.autorizados.length" class="ca__nota">
          {{ t('reservasDoHotel.autorizados.vazio') }}
        </p>
        <ul v-else class="ui-lista">
          <li v-for="a in reserva.autorizados" :key="a.id" class="ui-linha">
            <span class="ui-linha__texto">
              <strong class="ui-linha__titulo">{{ a.nome }}</strong>
              <span class="ui-linha__meta">{{
                [
                  a.relacao ?? '',
                  a.telefone ?? '',
                  a.documento ? t('reservasDoHotel.autorizados.final', { final: a.documento }) : '',
                ]
                  .filter(Boolean)
                  .join(' · ')
              }}</span>
            </span>
          </li>
        </ul>
      </section>
    </div>

    <template v-if="reserva">
      <ConfirmarPagamentoGaveta
        v-model:visible="pagamentoAberto"
        :reserva="reserva"
        @registrado="feito(t('reservasDoHotel.pagamento.feito'))"
      />
      <CancelarReservaGaveta
        v-model:visible="cancelarAberto"
        :reserva="reserva"
        @cancelada="feito"
      />
      <EditarReservaGaveta
        v-if="casa"
        v-model:visible="editarAberto"
        :reserva="reserva"
        :casa="casa"
        @salvo="feito"
        @alterado="carregar"
      />
      <AutorizadosGaveta
        v-model:visible="autorizadosAberto"
        :reserva="reserva"
        @salvo="feito(t('reservasDoHotel.autorizados.salvos'))"
      />
    </template>
  </UiPagina>
</template>

<style scoped>
.rd {
  display: grid;
  gap: 20px;
}

.rd__voltar {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--tinta-2);
  font-size: 13.5px;
  text-decoration: none;
}

.rd__voltar:hover {
  color: var(--tinta);
}

.rd__recado {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin: 0;
  padding: 14px 20px;
  color: var(--tinta);
  font-size: 14px;
  line-height: 1.5;
}

.rd__recado > i {
  margin-top: 2px;
  color: var(--ok-tinta);
  font-size: 17px;
}

.rd__recado--erro > i {
  color: var(--risco-tinta);
}

.rd__recado--atencao > i {
  color: var(--atencao-tinta);
}

.rd__fatos {
  display: grid;
  margin: 0;
  padding: 0 10px 8px;
}

.rd__fato {
  display: grid;
  grid-template-columns: minmax(8rem, 12rem) 1fr;
  gap: 16px;
  padding: 12px 0;
  border-bottom: 1px solid var(--linha-suave, var(--linha));
  font-size: 14px;
  line-height: 1.45;
}

.rd__fato:last-child {
  border-bottom: 0;
}

.rd__fato dt {
  color: var(--tinta-2);
}

.rd__fato dd {
  margin: 0;
  color: var(--tinta);
}

.rd__pe {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  color: var(--tinta-2);
  font-size: 13px;
}

.rd__valor {
  color: var(--tinta);
  font-size: 14px;
  font-weight: 650;
}

.rd__subtitulo {
  margin: 14px 0 0;
  padding-inline: 10px;
  color: var(--tinta-2);
  font-size: 12px;
  font-weight: 650;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
</style>
