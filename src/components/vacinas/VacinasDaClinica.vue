<script setup lang="ts">
/**
 * Vacinas da clínica pela API (E4-04, PJ-VQVQ0C; guia e4 3.5 e 3.6): quem chamar de volta e o que
 * a clínica aplicou. Duas vistas (`?aba=`):
 *
 * - **Lista de chamada**: do mais atrasado ao menos, com o filtro da situação (vencidas, série
 *   aberta, a vencer em até 30 dias). Um cartão por pet (pedido do Luís, 17/11/2026): o pet no alto
 *   com o menu "…" (ver detalhes, editar e apagar o registro), uma caixa por vacina com a última
 *   dose, a próxima, o quanto falta e o "Ativar lembrete", e no pé o responsável e o "Aplicar".
 *   `?ver=mes` separa os cartões pelo mês em que a dose vence, com as atrasadas primeiro.
 * - **Aplicadas**: o registro de um período (até 92 dias), com o lote e quem aplicou, as anuladas
 *   riscadas. É a lista da farmacovigilância.
 *
 * N42 (guia `pedidos-luis-17-11.md`, seção 5): o lembrete vem de cada item da chamada (`lembrete`,
 * `responsavelNoApp`); sem responsável no app, a caixa diz "Ligue para o telefone do cadastro" no
 * lugar do botão. Ligar e desligar relêem a lista. "Editar registro" corrige a observação e a via
 * pelo `PATCH`; vacina, dose, data e lote seguem por anular e registrar de novo.
 */
import Button from 'primevue/button'
import Menu from 'primevue/menu'
import type { MenuItem } from 'primevue/menuitem'
import SelectButton from 'primevue/selectbutton'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { iniciais, useRotulosDoCadastro } from '@/components/cadastro/useRotulosDoCadastro'
import UiPagina from '@/components/ui/UiPagina.vue'
import type { PassoDoGuia } from '@/components/ui/UiPassos.vue'
import UiVazioIlustrado from '@/components/ui/UiVazioIlustrado.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { invalidarPendenciasDoPortal } from '@/composables/usePendenciasDoPortal'
import PetAvatar from '@/features/hotel/components/base/PetAvatar.vue'
import { INTL_LOCALE, type Locale } from '@/i18n/locales'
import {
  lembreteDoItem,
  semCanalNoApp,
  type LembreteDaVacina,
} from '@/service/parceiro/lembrete-de-vacina-service'
import { telefoneNaTela } from '@/service/parceiro/pacientes-service'
import {
  lerAplicadas,
  lerChamada,
  type Chamada,
  type PaginaDeAplicadas,
  type SituacaoDaChamada,
} from '@/service/parceiro/vacinacao-service'
import { ESPECIE_DO_AVATAR } from '@/utils/parceiro/acesso-na-lista'

import AnularAplicacaoGaveta from './AnularAplicacaoGaveta.vue'
import DetalhesDaVacinaGaveta from './DetalhesDaVacinaGaveta.vue'
import EditarAplicacaoGaveta from './EditarAplicacaoGaveta.vue'
import LembreteDaVacinaGaveta from './LembreteDaVacinaGaveta.vue'
import { useLembretesDaChamada } from './useLembretesDaChamada'

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const rotulos = useRotulosDoCadastro()
const { store, parceiroQuery } = useParceiroPortal()
const lembretes = useLembretesDaChamada()

type Aba = 'chamada' | 'aplicadas'
type Visao = 'urgencia' | 'mes'

const aba = computed<Aba>(() => (route.query.aba === 'aplicadas' ? 'aplicadas' : 'chamada'))
const visao = computed<Visao>(() => (route.query.ver === 'mes' ? 'mes' : 'urgencia'))

function trocarAba(valor: Aba) {
  const query = { ...route.query }
  if (valor === 'chamada') delete query.aba
  else query.aba = valor
  void router.replace({ query })
}

function trocarVisao(valor: Visao) {
  const query = { ...route.query }
  if (valor === 'urgencia') delete query.ver
  else query.ver = valor
  void router.replace({ query })
}

const opcoesDeAba = computed(() => [
  { valor: 'chamada', rotulo: t('vacinas.chamada.titulo') },
  { valor: 'aplicadas', rotulo: t('vacinas.aplicadas.titulo') },
])

const opcoesDeVisao = computed(() => [
  { valor: 'urgencia', rotulo: t('vacinas.chamada.visao.urgencia'), icone: 'ph ph-list-numbers' },
  { valor: 'mes', rotulo: t('vacinas.chamada.visao.mes'), icone: 'ph ph-calendar-dots' },
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
    /* A gaveta do lembrete aberta passa a mostrar o item relido (a dose que saiu fica como estava). */
    const aberto = lembreteDe.value?.aplicacaoId
    if (aberto) {
      lembreteDe.value = chamada.value.find((i) => i.aplicacaoId === aberto) ?? lembreteDe.value
    }
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

/** A data vencida pesa mais que a situação: a série aberta que passou da data também é risco. */
function tomDa(item: Chamada) {
  return item.diasParaVencer < 0 ? 'risco' : TOM[item.situacao]
}

/**
 * Quanto do intervalo entre a última dose e a próxima já passou: a barra da caixa da vacina. Na
 * vencida, cheia. Um mínimo visível, para a barra nunca parecer vazia por engano.
 */
function andamento(item: Chamada) {
  if (item.diasParaVencer <= 0) return 1
  const ultima = Date.parse(item.ultimaEm.slice(0, 10))
  const proxima = Date.parse(item.proximaDoseEm)
  const total = proxima - ultima
  if (!(total > 0)) return 1
  return Math.min(1, Math.max(0.04, 1 - (item.diasParaVencer * 86_400_000) / total))
}

type Cartao = { paciente: Chamada['paciente']; cliente: Chamada['cliente']; itens: Chamada[] }

/**
 * Um cartão por pet. A lista vem por vacina, do mais atrasado ao menos: o cartão entra na ordem
 * da vacina mais atrasada dele, e as outras vacinas do mesmo pet vão para dentro do cartão.
 */
function porPet(itens: Chamada[]): Cartao[] {
  const cartoes = new Map<string, Cartao>()
  for (const item of itens) {
    const cartao = cartoes.get(item.paciente.id)
    if (cartao) cartao.itens.push(item)
    else
      cartoes.set(item.paciente.id, {
        paciente: item.paciente,
        cliente: item.cliente,
        itens: [item],
      })
  }
  return [...cartoes.values()]
}

function nomeDoMes(chave: string) {
  const [ano, mes] = chave.split('-').map(Number)
  const nome = new Intl.DateTimeFormat(INTL_LOCALE[locale.value as Locale], {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(Date.UTC(ano!, mes! - 1, 1))
  return nome.charAt(0).toLocaleUpperCase(locale.value) + nome.slice(1)
}

type Grupo = {
  chave: string
  titulo: string
  contagem: string
  atrasadas: boolean
  cartoes: Cartao[]
}

/**
 * As seções da lista. Por urgência, uma só, sem título (a ordem da API). Por mês (`?ver=mes`,
 * pedido do Luís, 17/11/2026), uma para cada mês em que alguma dose vence, na ordem do calendário;
 * as que já passaram da data vêm antes, numa seção só (o mês delas ficou para trás, o que importa
 * é chamar). Um pet com doses em meses diferentes aparece em cada mês, só com as doses daquele mês.
 */
const grupos = computed<Grupo[]>(() => {
  if (visao.value === 'urgencia') {
    return [
      { chave: 'tudo', titulo: '', contagem: '', atrasadas: false, cartoes: porPet(chamada.value) },
    ]
  }

  const porMes = new Map<string, Chamada[]>()
  for (const item of chamada.value) {
    const chave = item.diasParaVencer < 0 ? 'atrasadas' : item.proximaDoseEm.slice(0, 7)
    porMes.set(chave, [...(porMes.get(chave) ?? []), item])
  }
  return [...porMes.entries()]
    .sort(([a], [b]) => (a === 'atrasadas' ? -1 : b === 'atrasadas' ? 1 : a.localeCompare(b)))
    .map(([chave, itens]) => {
      const pets = new Set(itens.map((item) => item.paciente.id)).size
      return {
        chave,
        atrasadas: chave === 'atrasadas',
        titulo: chave === 'atrasadas' ? t('vacinas.chamada.mes.atrasadas') : nomeDoMes(chave),
        contagem: [
          t('vacinas.chamada.mes.pets', { n: pets }, pets),
          t('vacinas.chamada.mes.vacinas', { n: itens.length }, itens.length),
        ].join(' · '),
        cartoes: porPet(itens),
      }
    })
})

/** A chamada traz só nome, espécie e foto do paciente (N52: a foto basta); a espécie "Outro" sai genérica. */
function sobreOPet(paciente: Chamada['paciente']) {
  return rotulos.especie({ especie: paciente.especie, especieOutra: null })
}

/**
 * A data como na carteira de papel, em números (18/10/2025). O instante vem com o fuso da clínica
 * (`2026-11-08T00:32:08-03:00`): vale o dia da clínica, como no resto do portal, e não o de quem
 * olha (em Cuiabá, aquele 00:32 viraria 07/11).
 */
function dataDaCarteira(valor: string | null) {
  if (!valor) return ''
  const dia = valor.slice(0, 10)
  const data = new Date(`${dia}T00:00:00Z`)
  if (Number.isNaN(data.getTime())) return valor
  return new Intl.DateTimeFormat(INTL_LOCALE[locale.value as Locale], {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(data)
}

/** Aplicar, editar e apagar pedem `vacina.aplicar`; o lembrete, quem cuida da agenda. */
const podeEscrever = computed(() => Boolean(store.modulo('CLINICA')?.podeEscrever))
const podeAplicar = computed(() => podeEscrever.value && store.temPermissao('vacina.aplicar'))
const podeLembrar = computed(() => podeEscrever.value && store.temPermissao('agenda.escrever'))
const podeVerDetalhes = computed(() => store.temPermissao('paciente.ler'))

/** Aplicar leva à ficha, que abre a gaveta de aplicar; com uma vacina só, já nela. */
function paraAplicar(cartao: Cartao) {
  const query: Record<string, string> = { aplicar: 'vacina' }
  if (cartao.itens.length === 1) query.vacina = cartao.itens[0]!.vacina.id
  return { path: `/clinica/ficha/${cartao.paciente.id}`, query }
}

/*
 * O vazio que ensina (17/11/2026, "o sistema deve ensinar e chamar o usuário"): sem ninguém para
 * chamar e sem filtro, de onde a lista vem. Só registrar a dose se faz (na ficha do paciente, por
 * isso o botão leva aos pacientes); a próxima dose e a entrada na lista são automáticas. Com
 * filtro, é resultado de filtro: fica a frase curta.
 */
const passosDaChamada = computed<PassoDoGuia[]>(() => {
  const passo = (id: string, icone: string, acao?: PassoDoGuia['acao']): PassoDoGuia => ({
    id,
    icone,
    titulo: t(`vacinas.chamada.guia.${id}.titulo`),
    texto: t(`vacinas.chamada.guia.${id}.texto`),
    acao,
  })

  return [
    passo(
      'registrar',
      'ph ph-syringe',
      podeAplicar.value
        ? {
            rotulo: t('vacinas.chamada.guia.escolherPaciente'),
            icone: 'ph ph-paw-print',
            to: '/clinica/pacientes',
          }
        : undefined,
    ),
    passo('serie', 'ph ph-calendar-dots'),
    passo('chamar', 'ph ph-phone'),
  ]
})

/* ------------------------------------------------------------- menu "…" e as gavetas */

const menu = ref<InstanceType<typeof Menu> | null>(null)
const doMenu = ref<Cartao | null>(null)

const detalhesAberta = ref(false)
const detalhesDe = ref<Cartao | null>(null)
const anularAberta = ref(false)
const aAnular = ref<{ item: Chamada; corrigir: boolean } | null>(null)
const lembreteAberta = ref(false)
const lembreteDe = ref<Chamada | null>(null)
const editarAberta = ref(false)
const aEditar = ref<Chamada | null>(null)

/* Uma gaveta por vez: abrir uma fecha a outra. */
function fecharGavetas() {
  detalhesAberta.value = false
  anularAberta.value = false
  lembreteAberta.value = false
  editarAberta.value = false
}

function verDetalhes(cartao: Cartao) {
  fecharGavetas()
  detalhesDe.value = cartao
  detalhesAberta.value = true
}

function anular(item: Chamada, corrigir: boolean) {
  fecharGavetas()
  aAnular.value = { item, corrigir }
  anularAberta.value = true
}

/**
 * Ligou ou desligou: o cartão e a gaveta mudam na hora com o que a API devolveu; a releitura da
 * lista (o `mudou`) chega depois e confirma. Esperar por ela deixava tudo parado uns 2 s.
 */
function lembreteTrocou(aplicacaoId: string, lembrete: LembreteDaVacina | null) {
  chamada.value = chamada.value.map((item) =>
    item.aplicacaoId === aplicacaoId ? { ...item, lembrete } : item,
  )
  if (lembreteDe.value?.aplicacaoId === aplicacaoId) {
    lembreteDe.value = { ...lembreteDe.value, lembrete }
  }
}

function abrirLembrete(item: Chamada) {
  fecharGavetas()
  lembreteDe.value = item
  lembreteAberta.value = true
}

function editar(item: Chamada) {
  fecharGavetas()
  aEditar.value = item
  editarAberta.value = true
}

/** A linha de baixo do "Lembrete ativo": a entrega, o motivo e se ainda sai outro. */
function envioDo(item: Chamada) {
  const lembrete = lembreteDoItem(item)
  return lembrete ? lembretes.resumo(lembrete) : null
}

function sobreADose(item: Chamada) {
  const dia = rotulos.dia(item.ultimaEm.slice(0, 10))
  return `${item.vacina.nome} · ${t('vacinas.detalhes.doseDe', { dia })}`
}

/** Editar e apagar são da dose: com mais de uma vacina no cartão, um grupo por vacina. */
const itensDoMenu = computed<MenuItem[]>(() => {
  const cartao = doMenu.value
  if (!cartao) return []

  const daDose = (item: Chamada): MenuItem[] => [
    {
      label: t('vacinas.chamada.menu.editar'),
      icon: 'ph ph-pencil-simple',
      command: () => editar(item),
    },
    {
      label: t('vacinas.chamada.menu.apagar'),
      icon: 'ph ph-trash',
      command: () => anular(item, false),
    },
  ]

  const itens: MenuItem[] = []
  if (podeVerDetalhes.value) {
    itens.push({
      label: t('vacinas.chamada.menu.detalhes'),
      icon: 'ph ph-info',
      command: () => verDetalhes(cartao),
    })
  }
  if (podeAplicar.value) {
    if (itens.length) itens.push({ separator: true })
    if (cartao.itens.length === 1) itens.push(...daDose(cartao.itens[0]!))
    else
      for (const item of cartao.itens) itens.push({ label: item.vacina.nome, items: daDose(item) })
  }
  return itens
})

/* Um menu só para todos os cartões: o "…" de outro cartão troca o conteúdo e reabre ali. */
async function abrirMenu(evento: Event, cartao: Cartao) {
  if (doMenu.value === cartao) {
    menu.value?.toggle(evento)
    return
  }
  const alvo = evento.currentTarget as HTMLElement | null
  menu.value?.hide()
  doMenu.value = cartao
  await nextTick()
  menu.value?.show(evento, alvo ?? undefined)
}

function anulada() {
  invalidarPendenciasDoPortal()
  void carregarChamada()
}

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
  fecharGavetas()
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
        <SelectButton
          v-if="aba === 'chamada'"
          class="vc__visao"
          :model-value="visao"
          :options="opcoesDeVisao"
          option-label="rotulo"
          option-value="valor"
          :allow-empty="false"
          :aria-label="t('vacinas.chamada.visao.rotulo')"
          @update:model-value="trocarVisao"
        >
          <template #option="{ option }">
            <i :class="option.icone" aria-hidden="true" />
            <span>{{ option.rotulo }}</span>
          </template>
        </SelectButton>
      </div>

      <p v-if="erro && lido" class="vc__erro" role="alert">{{ erro }}</p>

      <!-- Lista de chamada: quem ligar hoje, um cartão por pet (por mês, uma seção por mês). -->
      <section v-if="aba === 'chamada'" class="vc__chamada" :aria-busy="carregando">
        <template v-if="chamada.length">
          <component
            :is="visao === 'mes' ? 'section' : 'div'"
            v-for="grupo in grupos"
            :key="grupo.chave"
            :class="visao === 'mes' ? 'ui-folha ui-cartao vc__mes' : 'vc__grupo'"
            :aria-labelledby="visao === 'mes' ? `vc-mes-${grupo.chave}` : undefined"
          >
            <header v-if="visao === 'mes'" class="ui-cartao__cabeca vc__mes-cabeca">
              <span
                class="ui-ladrilho"
                :class="{ 'vc__mes-ladrilho--atrasadas': grupo.atrasadas }"
                aria-hidden="true"
              >
                <i :class="grupo.atrasadas ? 'ph ph-warning-circle' : 'ph ph-calendar-blank'" />
              </span>
              <span class="ui-cartao__titulos">
                <h2 :id="`vc-mes-${grupo.chave}`" class="ui-cartao__titulo">{{ grupo.titulo }}</h2>
                <p class="ui-cartao__descricao">{{ grupo.contagem }}</p>
              </span>
            </header>

            <ul class="vc__cartoes">
              <li v-for="cartao in grupo.cartoes" :key="cartao.paciente.id" class="cartao">
                <!-- O pet, e o "…" com o que se faz com o registro. -->
                <header class="cartao__cabeca">
                  <PetAvatar
                    class="cartao__avatar"
                    :nome="cartao.paciente.nome"
                    :iniciais="iniciais(cartao.paciente.nome)"
                    :especie="ESPECIE_DO_AVATAR[cartao.paciente.especie] ?? null"
                    :foto-url="cartao.paciente.fotoUrl"
                    tamanho="md"
                  />
                  <span class="cartao__quem">
                    <RouterLink class="cartao__nome" :to="`/clinica/ficha/${cartao.paciente.id}`">{{
                      cartao.paciente.nome
                    }}</RouterLink>
                    <span class="cartao__sobre">{{ sobreOPet(cartao.paciente) }}</span>
                  </span>
                  <Button
                    v-if="podeVerDetalhes || podeAplicar"
                    type="button"
                    class="cartao__mais"
                    size="small"
                    severity="secondary"
                    outlined
                    rounded
                    icon="ph ph-dots-three"
                    :aria-label="t('vacinas.chamada.menu.rotulo', { pet: cartao.paciente.nome })"
                    aria-haspopup="menu"
                    @click="abrirMenu($event, cartao)"
                  />
                </header>

                <!-- Uma caixa por vacina: as datas, o quanto falta e o lembrete. -->
                <ul class="cartao__vacinas">
                  <li
                    v-for="item in cartao.itens"
                    :key="item.aplicacaoId"
                    class="dose"
                    :class="`dose--${tomDa(item)}`"
                  >
                    <span class="dose__topo">
                      <strong class="dose__nome">{{ item.vacina.nome }}</strong>
                      <span class="dose__estado">{{
                        t(`vacinas.chamada.estado.${item.situacao}`)
                      }}</span>
                    </span>
                    <span class="dose__quando">
                      <i
                        :class="
                          item.diasParaVencer < 0
                            ? 'ph ph-warning-circle'
                            : 'ph ph-hourglass-medium'
                        "
                        aria-hidden="true"
                      />
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

                    <span class="dose__trilho" aria-hidden="true">
                      <span
                        class="dose__feito"
                        :style="{ inlineSize: `${andamento(item) * 100}%` }"
                      />
                    </span>
                    <dl class="dose__datas">
                      <div>
                        <dt>{{ t('vacinas.chamada.cartao.ultima') }}</dt>
                        <dd class="ui-num">{{ dataDaCarteira(item.ultimaEm) }}</dd>
                      </div>
                      <div class="dose__data-fim">
                        <dt>{{ t('vacinas.chamada.cartao.proxima') }}</dt>
                        <dd class="ui-num">{{ dataDaCarteira(item.proximaDoseEm) }}</dd>
                      </div>
                    </dl>

                    <span v-if="item.agendamentoProxima" class="dose__marcado">
                      <i class="ph ph-calendar-check" aria-hidden="true" />
                      {{
                        t('vacinas.chamada.cartao.marcado', {
                          dia: rotulos.dia(item.agendamentoProxima.inicio.slice(0, 10)),
                        })
                      }}
                    </span>

                    <!--
                      O lembrete fecha a caixa: a largura toda, fácil de achar e de tocar. Ligado,
                      a linha de baixo diz como saiu o último envio. Sem responsável no app, no
                      lugar do botão, o telefone do cadastro (a rota nem é chamada).
                    -->
                    <template v-if="podeLembrar">
                      <p v-if="semCanalNoApp(item)" class="dose__semapp">
                        <i class="ph ph-device-mobile-slash" aria-hidden="true" />
                        {{ t('vacinas.lembrete.ligueNoCadastro') }}
                      </p>
                      <template v-else>
                        <Button
                          type="button"
                          size="small"
                          severity="secondary"
                          outlined
                          class="dose__lembrete"
                          :class="{ 'dose__lembrete--ativo': lembreteDoItem(item) }"
                          :icon="lembreteDoItem(item) ? 'ph ph-bell-ringing' : 'ph ph-bell-simple'"
                          :label="
                            lembreteDoItem(item)
                              ? t('vacinas.lembrete.ativo')
                              : t('vacinas.lembrete.ativar')
                          "
                          @click="abrirLembrete(item)"
                        />
                        <p
                          v-if="envioDo(item)"
                          class="dose__envio"
                          :class="envioDo(item)?.tom ? `dose__envio--${envioDo(item)?.tom}` : ''"
                        >
                          <i :class="envioDo(item)?.icone" aria-hidden="true" />
                          <span>{{ envioDo(item)?.texto }}</span>
                        </p>
                      </template>
                    </template>
                  </li>
                </ul>

                <!-- O pé: quem atende o telefone, e o atalho para aplicar. -->
                <footer class="cartao__pe">
                  <span class="cartao__tutor">
                    <i class="ph ph-user" aria-hidden="true" />
                    <span class="cartao__tutor-texto">
                      <strong>{{ cartao.cliente.nome }}</strong>
                      <bdi v-if="cartao.cliente.telefone" dir="ltr" class="ui-num">{{
                        telefoneNaTela(cartao.cliente.telefone)
                      }}</bdi>
                    </span>
                  </span>
                  <Button
                    v-if="podeAplicar"
                    :as="RouterLink"
                    :to="paraAplicar(cartao)"
                    size="small"
                    severity="secondary"
                    outlined
                    icon="ph ph-syringe"
                    :label="t('vacinas.plano.aplicar')"
                  />
                </footer>
              </li>
            </ul>
          </component>
        </template>

        <UiVazioIlustrado
          v-else-if="lido && !carregando"
          icone="ph ph-syringe"
          :titulo="t('vacinas.chamada.vazio')"
          :texto="t('vacinas.chamada.vazioTexto')"
          :guia-titulo="situacao === TODAS ? t('vacinas.chamada.guia.titulo') : ''"
          :passos="situacao === TODAS ? passosDaChamada : []"
        />
      </section>

      <!-- Aplicadas: o registro do período. -->
      <section v-else-if="aplicadas.length" class="ui-folha ui-lista" :aria-busy="carregando">
        <ul class="ui-lista">
          <li
            v-for="item in aplicadas"
            :key="item.id"
            class="ui-linha"
            :class="{ vc__anulada: item.anulada }"
          >
            <PetAvatar
              :nome="item.paciente.nome"
              :iniciais="iniciais(item.paciente.nome)"
              :especie="ESPECIE_DO_AVATAR[item.paciente.especie] ?? null"
              :foto-url="item.paciente.fotoUrl"
              tamanho="md"
            />
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
      </section>
      <UiVazioIlustrado
        v-else-if="lido && !carregando"
        icone="ph ph-syringe"
        :titulo="t('vacinas.aplicadas.vazio')"
        :texto="t('vacinas.aplicadas.vazioTexto')"
      />

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

    <template #sempre>
      <Menu ref="menu" :model="itensDoMenu" popup />
      <DetalhesDaVacinaGaveta
        v-model:visible="detalhesAberta"
        :paciente="detalhesDe?.paciente ?? null"
        :itens="detalhesDe?.itens ?? []"
      />
      <AnularAplicacaoGaveta
        v-model:visible="anularAberta"
        :aplicacao="aAnular ? { id: aAnular.item.aplicacaoId } : null"
        :corrigir="aAnular?.corrigir ?? false"
        :sobre="aAnular ? sobreADose(aAnular.item) : ''"
        :paciente-id="aAnular?.item.paciente.id"
        :vacina-id="aAnular?.item.vacina.id"
        @anulada="anulada"
      />
      <LembreteDaVacinaGaveta
        v-model:visible="lembreteAberta"
        :item="lembreteDe"
        @trocou="lembreteTrocou"
        @mudou="carregarChamada()"
      />
      <EditarAplicacaoGaveta
        v-model:visible="editarAberta"
        :item="aEditar"
        @corrigir="aEditar && anular(aEditar, true)"
        @mudou="anulada"
      />
    </template>
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

/* A visão (por urgência, por mês) é outra pergunta: fica na ponta, longe dos filtros. */
.vc__visao {
  margin-inline-start: auto;
}

.vc__visao :deep(.p-togglebutton-content) {
  gap: 7px;
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

.vc__chamada {
  display: grid;
  gap: 16px;
}

/* ------------------------------------------------------------------------ por mês */

.vc__mes {
  display: grid;
  gap: 16px;
}

.vc__mes-cabeca {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.vc__mes-ladrilho--atrasadas {
  background: var(--risco-fundo);
  color: var(--risco-tinta);
}

/* ------------------------------------------------------------------------ os cartões */

/* Lado a lado, quantos couberem: três na folha de 1440, dois no tablet. */
.vc__cartoes {
  display: grid;
  gap: 16px;
  margin: 0;
  padding: 0;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 330px), 1fr));
  list-style: none;
}

/* O cartão: o pet no alto, as vacinas em caixas, o responsável no pé. Sem enfeite de papel. */
.cartao {
  display: grid;
  grid-template-rows: auto 1fr auto;
  border: 1px solid var(--linha);
  border-radius: 16px;
  background: var(--superficie);
  box-shadow: var(--sombra-xs);
}

.cartao__cabeca {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 16px 12px;
}

.cartao__avatar {
  flex: none;
}

.cartao__quem {
  display: grid;
  min-width: 0;
  flex: 1;
  gap: 1px;
}

.cartao__nome {
  overflow: hidden;
  color: var(--tinta);
  font-size: 16px;
  font-weight: 650;
  letter-spacing: -0.01em;
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

.cartao__mais {
  flex: none;
  align-self: flex-start;
}

.cartao__vacinas {
  display: grid;
  align-content: start;
  gap: 8px;
  margin: 0;
  padding: 0 12px;
  list-style: none;
}

/*
 * A caixa da vacina. A urgência está na bolinha da situação e na barra (a cor do tom), não no
 * fundo da caixa: o fundo é o mesmo para todas.
 */
.dose {
  --tom-tinta: var(--pets-tinta);
  --tom-fundo: var(--pets-fundo);

  display: grid;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 12px;
  /* Um passo da tinta sobre o cartão: no escuro, `--superficie-2` é igual à superfície. */
  background: color-mix(in oklab, var(--tinta) 4.5%, var(--superficie));
}

.dose--atencao {
  --tom-tinta: var(--atencao-tinta);
  --tom-fundo: var(--atencao-fundo);
}

.dose--risco {
  --tom-tinta: var(--risco-tinta);
  --tom-fundo: var(--risco-fundo);
}

.dose__topo {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.dose__nome {
  min-width: 0;
  color: var(--tinta);
  font-size: 14.5px;
  font-weight: 650;
  line-height: 1.35;
}

.dose__estado {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 6px;
  color: var(--tinta-2);
  font-size: 12.5px;
  font-weight: 600;
  white-space: nowrap;
}

.dose__estado::before {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: color-mix(in oklab, var(--tom-tinta) 70%, var(--tom-fundo));
  content: '';
}

/* O caminho da última dose até a próxima: quanto já passou. */
.dose__trilho {
  display: block;
  overflow: hidden;
  height: 6px;
  border-radius: 999px;
  background: var(--linha);
}

.dose__feito {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: color-mix(in oklab, var(--tom-tinta) 55%, var(--tom-fundo));
}

.dose__datas {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin: -4px 0 0;
}

.dose__datas div {
  display: grid;
  gap: 1px;
}

.dose__datas .dose__data-fim {
  text-align: end;
}

.dose__datas dt {
  color: var(--tinta-2);
  font-size: 12px;
}

.dose__datas dd {
  margin: 0;
  color: var(--tinta);
  font-size: 13.5px;
  font-weight: 600;
}

/* O prazo, logo abaixo do nome: é o que a recepção lê primeiro. */
.dose__quando {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: -6px;
  color: var(--tinta);
  font-size: 13px;
  font-weight: 600;
}

.dose__quando i {
  color: var(--tom-tinta);
  font-size: 16px;
}

.dose__lembrete.p-button {
  width: 100%;
  margin-top: 2px;
  background: var(--superficie);
}

/* Ativo: a borda e a letra no verde do "feito", o fundo igual (urgência e estado não pintam a caixa). */
.dose__lembrete--ativo.p-button {
  border-color: color-mix(in oklab, var(--ok-tinta) 35%, var(--linha));
  color: var(--ok-tinta);
}

/* Como saiu o último envio, logo abaixo do "Lembrete ativo"; a cor só no ícone. */
.dose__envio,
.dose__semapp {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin: -4px 0 0;
  color: var(--tinta-2);
  font-size: 12.5px;
  line-height: 1.45;
}

.dose__envio i,
.dose__semapp i {
  flex: none;
  margin-top: 1px;
  font-size: 15px;
}

.dose__envio--ok i {
  color: var(--ok-tinta);
}

.dose__envio--atencao i {
  color: var(--atencao-tinta);
}

/* Sem app: no lugar do botão, uma linha de texto (a clínica liga; a tela não disca). */
.dose__semapp {
  margin: 0;
  color: var(--tinta);
  font-size: 13px;
  font-weight: 600;
}

.dose__semapp i {
  color: var(--tinta-2);
}

.dose__marcado {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--tinta-2);
  font-size: 13px;
}

.dose__marcado i {
  color: var(--ok-tinta);
  font-size: 16px;
}

/* O pé: o responsável (quem atende a ligação) e o atalho de aplicar. */
.cartao__pe {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 12px;
  padding: 12px 16px 14px;
  border-top: 1px solid var(--linha-suave);
}

.cartao__tutor {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
  color: var(--tinta-2);
  font-size: 13px;
}

.cartao__tutor > i {
  flex: none;
  font-size: 18px;
}

.cartao__tutor-texto {
  display: grid;
  min-width: 0;
  gap: 1px;
}

.cartao__tutor strong {
  overflow: hidden;
  color: var(--tinta);
  font-size: 13.5px;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vc__anulada .ui-linha__titulo,
.vc__anulada .ui-linha__meta {
  text-decoration: line-through;
}

.vc__mais {
  justify-self: start;
}
</style>
