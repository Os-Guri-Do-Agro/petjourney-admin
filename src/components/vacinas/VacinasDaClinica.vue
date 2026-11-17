<script setup lang="ts">
/**
 * Vacinas da clínica pela API (E4-04, PJ-VQVQ0C; guia e4 3.5 e 3.6): quem chamar de volta e o que
 * a clínica aplicou. Duas vistas (`?aba=`):
 *
 * - **Lista de chamada**: do mais atrasado ao menos, com o filtro da situação (vencidas, série
 *   aberta, a vencer em até 30 dias), o responsável com o telefone e o horário já marcado. Desde
 *   17/11/2026 (pedido do Luís: "cada pet deveria parecer um cartão de vacina") cada pet é um
 *   cartão, como a carteira de vacinação: a capa com o pet, o picote, uma linha por vacina com a
 *   última dose, a próxima e o carimbo da situação, e no pé o responsável e o "Aplicar".
 * - **Aplicadas**: o registro de um período (até 92 dias), com o lote e quem aplicou, as anuladas
 *   riscadas. É a lista da farmacovigilância.
 */
import Button from 'primevue/button'
import SelectButton from 'primevue/selectbutton'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { iniciais, useRotulosDoCadastro } from '@/components/cadastro/useRotulosDoCadastro'
import UiPagina from '@/components/ui/UiPagina.vue'
import UiRabiscos from '@/components/ui/UiRabiscos.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import PetAvatar from '@/features/hotel/components/base/PetAvatar.vue'
import { INTL_LOCALE, type Locale } from '@/i18n/locales'
import { telefoneNaTela } from '@/service/parceiro/pacientes-service'
import {
  lerAplicadas,
  lerChamada,
  type Chamada,
  type PaginaDeAplicadas,
  type SituacaoDaChamada,
} from '@/service/parceiro/vacinacao-service'
import { ESPECIE_DO_AVATAR } from '@/utils/parceiro/acesso-na-lista'

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const rotulos = useRotulosDoCadastro()
const { store, parceiroQuery } = useParceiroPortal()

type Aba = 'chamada' | 'aplicadas'

const aba = computed<Aba>(() => (route.query.aba === 'aplicadas' ? 'aplicadas' : 'chamada'))

function trocarAba(valor: Aba) {
  const query = { ...route.query }
  if (valor === 'chamada') delete query.aba
  else query.aba = valor
  void router.replace({ query })
}

const opcoesDeAba = computed(() => [
  { valor: 'chamada', rotulo: t('vacinas.chamada.titulo') },
  { valor: 'aplicadas', rotulo: t('vacinas.aplicadas.titulo') },
])

/* ------------------------------------------------------------------- lista de chamada */

/* O SelectButton não marca a opção de valor `null`: "Todas" tem um valor próprio. */
const TODAS = 'TODAS'
const situacao = ref<SituacaoDaChamada | typeof TODAS>(TODAS)
const chamada = ref<Chamada[]>([])
const cursorDaChamada = ref<string | null>(null)
const carregando = ref(false)
const erro = ref('')
const lido = ref(false)

const opcoesDeSituacao = computed(() => [
  { valor: TODAS, rotulo: t('vacinas.chamada.todas') },
  { valor: 'VENCIDO', rotulo: t('vacinas.chamada.situacao.VENCIDO') },
  { valor: 'SERIE_INCOMPLETA', rotulo: t('vacinas.chamada.situacao.SERIE_INCOMPLETA') },
  { valor: 'PROXIMO', rotulo: t('vacinas.chamada.situacao.PROXIMO') },
])

async function carregarChamada(mais = false) {
  carregando.value = true
  erro.value = ''
  try {
    const pagina = await lerChamada(
      {
        situacao: situacao.value === TODAS ? null : situacao.value,
        cursor: mais ? cursorDaChamada.value : null,
      },
      parceiroQuery(),
    )
    chamada.value = mais ? [...chamada.value, ...pagina.itens] : pagina.itens
    cursorDaChamada.value = pagina.proximoCursor
    lido.value = true
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('vacinas.erro.carregar')).mensagem
  } finally {
    carregando.value = false
  }
}

function quandoVence(item: Chamada) {
  const dias = item.diasParaVencer
  if (dias < 0) return t('vacinas.chamada.venceuHa', { n: -dias }, -dias)
  if (dias === 0) return t('vacinas.chamada.venceHoje')
  return t('vacinas.chamada.venceEm', { n: dias }, dias)
}

const TOM: Record<SituacaoDaChamada, 'risco' | 'atencao' | 'calmo'> = {
  VENCIDO: 'risco',
  SERIE_INCOMPLETA: 'atencao',
  PROXIMO: 'calmo',
}

/**
 * Um cartão por pet. A lista vem por vacina, do mais atrasado ao menos: o cartão entra na ordem
 * da vacina mais atrasada dele, e as outras vacinas do mesmo pet vão para dentro do cartão.
 */
const cartoes = computed(() => {
  const porPet = new Map<
    string,
    { paciente: Chamada['paciente']; cliente: Chamada['cliente']; itens: Chamada[] }
  >()

  for (const item of chamada.value) {
    const cartao = porPet.get(item.paciente.id)
    if (cartao) cartao.itens.push(item)
    else
      porPet.set(item.paciente.id, {
        paciente: item.paciente,
        cliente: item.cliente,
        itens: [item],
      })
  }

  return [...porPet.values()]
})

function sobreOPet(paciente: Chamada['paciente']) {
  return [
    rotulos.especie(paciente),
    paciente.raca,
    rotulos.idade(paciente.nascimento, paciente.nascimentoEstimado),
  ]
    .filter(Boolean)
    .join(' · ')
}

/**
 * A data como na carteira de papel, em números (18/10/2025). `AAAA-MM-DD` é o dia como está;
 * instante (`date-time`) é o dia no fuso de quem olha.
 */
function dataDaCarteira(valor: string | null) {
  if (!valor) return ''
  const formato = new Intl.DateTimeFormat(INTL_LOCALE[locale.value as Locale], {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...(valor.length === 10 ? { timeZone: 'UTC' } : {}),
  })
  const instante = valor.length === 10 ? `${valor}T00:00:00Z` : valor
  const data = new Date(instante)
  return Number.isNaN(data.getTime()) ? valor : formato.format(data)
}

/** Aplicar leva à ficha, que abre a gaveta de aplicar (o mesmo atalho das Ações rápidas). */
const podeAplicar = computed(
  () => Boolean(store.modulo('CLINICA')?.podeEscrever) && store.temPermissao('vacina.aplicar'),
)

/* -------------------------------------------------------------------------- aplicadas */

const periodo = ref<7 | 30 | 92>(30)
const aplicadas = ref<PaginaDeAplicadas['itens']>([])
const cursorDasAplicadas = ref<string | null>(null)

const opcoesDePeriodo = computed(() =>
  ([7, 30, 92] as const).map((valor) => ({
    valor,
    rotulo: t('vacinas.aplicadas.dias', { n: valor }),
  })),
)

function diaIso(data: Date) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`
}

async function carregarAplicadas(mais = false) {
  carregando.value = true
  erro.value = ''
  const ate = new Date()
  const de = new Date(ate.getTime() - (periodo.value - 1) * 86_400_000)
  try {
    const pagina = await lerAplicadas(
      { de: diaIso(de), ate: diaIso(ate), cursor: mais ? cursorDasAplicadas.value : null },
      parceiroQuery(),
    )
    aplicadas.value = mais ? [...aplicadas.value, ...pagina.itens] : pagina.itens
    cursorDasAplicadas.value = pagina.proximoCursor
    lido.value = true
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('vacinas.erro.carregar')).mensagem
  } finally {
    carregando.value = false
  }
}

function carregar() {
  return aba.value === 'chamada' ? carregarChamada() : carregarAplicadas()
}

watch(aba, () => {
  lido.value = false
  void carregar()
})
watch(situacao, () => void carregarChamada())
watch(periodo, () => void carregarAplicadas())
onMounted(carregar)

const resumo = computed(() =>
  aba.value === 'chamada' ? t('vacinas.chamada.resumo') : t('vacinas.aplicadas.resumo'),
)
</script>

<template>
  <UiPagina
    :resumo="resumo"
    :carregando="carregando && !lido"
    :erro="lido ? '' : erro"
    @tentar-de-novo="carregar"
  >
    <div class="vc">
      <div class="vc__filtros">
        <SelectButton
          :model-value="aba"
          :options="opcoesDeAba"
          option-label="rotulo"
          option-value="valor"
          :allow-empty="false"
          :aria-label="t('vacinas.titulo')"
          @update:model-value="trocarAba"
        />
        <SelectButton
          v-if="aba === 'chamada'"
          v-model="situacao"
          :options="opcoesDeSituacao"
          option-label="rotulo"
          option-value="valor"
          :allow-empty="false"
          :aria-label="t('vacinas.chamada.filtro')"
        />
        <SelectButton
          v-else
          v-model="periodo"
          :options="opcoesDePeriodo"
          option-label="rotulo"
          option-value="valor"
          :allow-empty="false"
          :aria-label="t('vacinas.aplicadas.periodo')"
        />
      </div>

      <p v-if="erro && lido" class="vc__erro" role="alert">{{ erro }}</p>

      <!-- Lista de chamada: quem ligar hoje, um cartão de vacina por pet. -->
      <section v-if="aba === 'chamada'" :aria-busy="carregando">
        <ul v-if="cartoes.length" class="vc__cartoes">
          <li v-for="cartao in cartoes" :key="cartao.paciente.id" class="cartao">
            <!-- A capa: o pet, como na frente da carteira. -->
            <header class="cartao__capa">
              <UiRabiscos estreito />
              <PetAvatar
                class="cartao__avatar"
                :nome="cartao.paciente.nome"
                :iniciais="iniciais(cartao.paciente.nome)"
                :especie="ESPECIE_DO_AVATAR[cartao.paciente.especie] ?? null"
                tamanho="md"
              />
              <span class="cartao__quem">
                <span class="cartao__titulo">
                  <i class="ph ph-syringe" aria-hidden="true" />
                  {{ t('vacinas.chamada.cartao.titulo') }}
                </span>
                <RouterLink class="cartao__nome" :to="`/clinica/ficha/${cartao.paciente.id}`">{{
                  cartao.paciente.nome
                }}</RouterLink>
                <span class="cartao__sobre">{{ sobreOPet(cartao.paciente) }}</span>
              </span>
            </header>

            <!-- As vacinas a chamar, cada uma com o carimbo da situação. -->
            <ul class="cartao__vacinas">
              <li v-for="item in cartao.itens" :key="item.aplicacaoId" class="dose">
                <span class="dose__topo">
                  <strong class="dose__nome">{{ item.vacina.nome }}</strong>
                  <span class="carimbo" :class="`carimbo--${TOM[item.situacao]}`">{{
                    t(`vacinas.chamada.carimbo.${item.situacao}`)
                  }}</span>
                </span>
                <dl class="dose__datas">
                  <div>
                    <dt>{{ t('vacinas.chamada.cartao.ultima') }}</dt>
                    <dd class="ui-num">{{ dataDaCarteira(item.ultimaEm) }}</dd>
                  </div>
                  <div>
                    <dt>{{ t('vacinas.chamada.cartao.proxima') }}</dt>
                    <dd class="ui-num">{{ dataDaCarteira(item.proximaDoseEm) }}</dd>
                  </div>
                </dl>
                <span class="dose__quando" :class="`dose__quando--${TOM[item.situacao]}`">
                  {{
                    [
                      quandoVence(item),
                      item.doseSeguinte
                        ? t('vacinas.chamada.cartao.dose', { n: item.doseSeguinte })
                        : '',
                    ]
                      .filter(Boolean)
                      .join(' · ')
                  }}
                </span>
                <span v-if="item.agendamentoProxima" class="dose__marcado">
                  <i class="ph ph-calendar-check" aria-hidden="true" />
                  {{
                    t('vacinas.chamada.cartao.marcado', {
                      dia: rotulos.dia(item.agendamentoProxima.inicio.slice(0, 10)),
                    })
                  }}
                </span>
              </li>
            </ul>

            <!-- O pé: quem atende o telefone, e o atalho para aplicar. -->
            <footer class="cartao__pe">
              <span class="cartao__tutor">
                <strong>{{ cartao.cliente.nome }}</strong>
                <bdi v-if="cartao.cliente.telefone" dir="ltr" class="ui-num">{{
                  telefoneNaTela(cartao.cliente.telefone)
                }}</bdi>
              </span>
              <Button
                v-if="podeAplicar"
                :as="RouterLink"
                :to="{ path: `/clinica/ficha/${cartao.paciente.id}`, query: { aplicar: 'vacina' } }"
                size="small"
                severity="secondary"
                outlined
                icon="ph ph-syringe"
                :label="t('vacinas.plano.aplicar')"
              />
            </footer>
          </li>
        </ul>
        <p v-else-if="lido && !carregando" class="ui-folha ui-vazio vc__vazio">
          {{ t('vacinas.chamada.vazio') }}
        </p>
      </section>

      <!-- Aplicadas: o registro do período. -->
      <section v-else class="ui-folha ui-lista" :aria-busy="carregando">
        <ul v-if="aplicadas.length" class="ui-lista">
          <li
            v-for="item in aplicadas"
            :key="item.id"
            class="ui-linha"
            :class="{ vc__anulada: item.anulada }"
          >
            <span class="ui-linha__texto">
              <strong class="ui-linha__titulo">
                <RouterLink :to="`/clinica/ficha/${item.paciente.id}`">{{
                  item.paciente.nome
                }}</RouterLink>
                · {{ item.vacina.nome }}
              </strong>
              <span class="ui-linha__meta">
                {{
                  [
                    rotulos.dia(item.aplicadaEm.slice(0, 10)),
                    t('vacinas.plano.dose', { n: item.dose, total: item.dosesNaSerie }),
                    item.lote ? t('vacinas.historico.lote', { codigo: item.lote.codigo }) : '',
                    item.origem === 'EXTERNA'
                      ? t('vacinas.aplicadas.externa')
                      : item.profissional.nome,
                    item.anulada ? t('vacinas.aplicadas.anulada') : '',
                  ]
                    .filter(Boolean)
                    .join(' · ')
                }}
              </span>
            </span>
          </li>
        </ul>
        <p v-else-if="lido && !carregando" class="ui-vazio vc__vazio">
          {{ t('vacinas.aplicadas.vazio') }}
        </p>
      </section>

      <Button
        v-if="aba === 'chamada' ? cursorDaChamada : cursorDasAplicadas"
        type="button"
        severity="secondary"
        outlined
        class="vc__mais"
        :label="t('vacinas.verMais')"
        :loading="carregando"
        @click="aba === 'chamada' ? carregarChamada(true) : carregarAplicadas(true)"
      />
    </div>
  </UiPagina>
</template>

<style scoped>
.vc {
  display: grid;
  gap: 16px;
}

.vc__filtros {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.vc__erro {
  margin: 0;
  color: var(--risco-tinta);
  font-size: 13.5px;
}

.ui-linha__titulo a {
  color: var(--tinta);
  text-decoration: none;
}

.ui-linha__titulo a:hover {
  text-decoration: underline;
  text-underline-offset: 3px;
}

/* ------------------------------------------------------------------ os cartões de vacina */

/* Lado a lado, quantos couberem: três na folha de 1440, dois no tablet. */
.vc__cartoes {
  display: grid;
  gap: 16px;
  margin: 0;
  padding: 0;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 330px), 1fr));
  list-style: none;
}

/*
 * O cartão: capa, picote e corpo, como a carteira de vacinação de papel. Os dois semicírculos do
 * picote são cortados no próprio cartão (máscara), sem depender da cor da página atrás.
 */
.cartao {
  --corte: 86px;

  display: grid;
  grid-template-rows: var(--corte) 1fr auto;
  overflow: hidden;
  border: 1px solid var(--linha);
  border-radius: 18px;
  background: var(--superficie);
  mask:
    radial-gradient(circle 9px at 0 var(--corte), #0000 96%, #000 100%),
    radial-gradient(circle 9px at 100% var(--corte), #0000 96%, #000 100%);
  mask-composite: intersect;
}

/* A capa: o verde dos pets com os rabiscos do app, o retrato e o nome. */
.cartao__capa {
  position: relative;
  display: flex;
  overflow: hidden;
  align-items: center;
  gap: 12px;
  padding: 0 18px;
  isolation: isolate;
  background: var(--pets-fundo);
  color: var(--pets-tinta);
  --rabiscos-forca: 0.55;
}

.app-dark .cartao__capa {
  --rabiscos-forca: 0.1;
}

.cartao__avatar {
  flex: none;
  box-shadow: 0 0 0 3px color-mix(in oklab, var(--superficie) 70%, transparent);
}

.cartao__quem {
  display: grid;
  min-width: 0;
  gap: 1px;
}

.cartao__titulo {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-bottom: 1px;
  font-size: 10.5px;
  font-weight: 750;
  letter-spacing: 0.09em;
  text-transform: uppercase;
}

.cartao__nome {
  overflow: hidden;
  color: var(--tinta);
  font-size: 17px;
  font-weight: 750;
  text-decoration: none;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cartao__nome:hover {
  text-decoration: underline;
  text-underline-offset: 3px;
}

.cartao__sobre {
  overflow: hidden;
  color: var(--tinta-2);
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* O corpo, com o picote no alto: a linha tracejada entre os dois cortes. */
.cartao__vacinas {
  position: relative;
  display: grid;
  align-content: start;
  margin: 0;
  padding: 4px 18px 6px;
  list-style: none;
}

.cartao__vacinas::before {
  position: absolute;
  top: 0;
  inset-inline: 16px;
  border-top: 2px dashed color-mix(in oklab, var(--pets-tinta) 45%, var(--linha));
  content: '';
}

.dose {
  display: grid;
  gap: 10px;
  padding: 14px 0;
}

.dose + .dose {
  border-top: 1px solid var(--linha-suave);
}

.dose__topo {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.dose__nome {
  color: var(--tinta);
  font-size: 15px;
  font-weight: 700;
  line-height: 1.3;
}

/*
 * O carimbo da situação: borda dupla, letra de caixa alta e meio torto, como o da clínica na
 * carteira. A cor diz a urgência; o texto, a situação.
 */
.carimbo {
  flex: none;
  margin: 3px 4px 0 0;
  padding: 3px 8px;
  border: 1.5px solid currentColor;
  border-radius: 7px;
  outline: 1px solid currentColor;
  outline-offset: 2px;
  font-size: 10.5px;
  font-weight: 800;
  letter-spacing: 0.09em;
  line-height: 1.3;
  rotate: -6deg;
  text-transform: uppercase;
  white-space: nowrap;
}

.carimbo--risco {
  color: var(--risco-tinta);
}

.carimbo--atencao {
  color: var(--atencao-tinta);
}

.carimbo--calmo {
  color: var(--pets-tinta);
}

:dir(rtl) .carimbo {
  rotate: 6deg;
}

/* As duas datas, como os campos da carteira: o nome miúdo e a data na linha tracejada. */
.dose__datas {
  display: grid;
  gap: 14px;
  margin: 0;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.dose__datas div {
  display: grid;
  gap: 2px;
}

.dose__datas dt {
  color: var(--tinta-3);
  font-size: 11px;
  font-weight: 650;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.dose__datas dd {
  margin: 0;
  padding-bottom: 3px;
  border-bottom: 1px dashed var(--linha-media);
  color: var(--tinta);
  font-size: 15px;
  font-weight: 650;
}

.dose__quando {
  color: var(--tinta-2);
  font-size: 13px;
  font-weight: 600;
}

.dose__quando--risco {
  color: var(--risco-tinta);
}

.dose__quando--atencao {
  color: var(--atencao-tinta);
}

.dose__marcado {
  display: inline-flex;
  align-items: center;
  justify-self: start;
  gap: 6px;
  padding: 3px 10px;
  border-radius: 999px;
  background: var(--ok-fundo);
  color: var(--ok-tinta);
  font-size: 12.5px;
  font-weight: 650;
}

/* O pé: o responsável (quem atende a ligação) e o atalho de aplicar. */
.cartao__pe {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 18px;
  border-top: 1px solid var(--linha-suave);
  background: var(--superficie-2);
}

.cartao__tutor {
  display: grid;
  min-width: 0;
  gap: 1px;
  color: var(--tinta-2);
  font-size: 13px;
}

.cartao__tutor strong {
  overflow: hidden;
  color: var(--tinta);
  font-size: 13.5px;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vc__vazio {
  margin: 0;
  padding: 24px 16px;
  color: var(--tinta-2);
}

.vc__anulada .ui-linha__titulo,
.vc__anulada .ui-linha__meta {
  text-decoration: line-through;
}

.vc__mais {
  justify-self: start;
}
</style>
