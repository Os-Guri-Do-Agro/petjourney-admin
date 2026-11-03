<script setup lang="ts">
/**
 * As áreas do Portal, no Início de quem só tem o Portal (sem a Clínica nem o Hotel).
 *
 * Para essa empresa o Portal é o portal inteiro. Cada área do menu tem o seu cartão, e cada
 * cartão mostra o que a área tem — não só quantos:
 *
 * - **Acessos** — os acessos de agora, numa lista curta (o pet, o serviço, quanto falta para
 *   fechar), e o atalho para vincular um código. É o trabalho do dia, e vem primeiro e mais largo.
 * - **Divulgação** — o QR de verdade, pronto para ser mostrado no balcão, o código e as leituras.
 * - **Equipe** — as pessoas, com o papel de cada uma, e os convites pendentes.
 * - **Indicados** — os últimos cadastros com o código e se assinaram. Só o dono vê (a lista tem
 *   nome de cliente), como no menu.
 * - **Carteira** — o liberado e, embaixo, o retido, o sacado e a chave PIX; o passo do saque
 *   quando há.
 * - **Programas** — em que pé está cada programa, numa linha no fim.
 *
 * Carteira, Indicados e Divulgação dependem do Programa de Afiliados ativo. Sem ele a área fica
 * turva, com o aviso e "Liberar", que leva aos Programas (`HomeAreaDoPortal`); por baixo do turvo
 * vai uma forma neutra da área, nunca dado inventado. Com o programa ou o cadastro em análise, não
 * há o que liberar: o aviso diz isso e o botão é "Acompanhar".
 *
 * O QR, o código e as leituras vêm de `HomeIndique`, que aqui só desenha a gaveta do QR grande.
 */
import Button from 'primevue/button'
import Skeleton from 'primevue/skeleton'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import HomeIndique from '@/components/home/HomeIndique.vue'
import { useAgora } from '@/composables/useAgora'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import PetAvatar from '@/features/hotel/components/base/PetAvatar.vue'
import { INTL_LOCALE, type Locale } from '@/i18n/locales'
import { getAuthUser } from '@/service/auth/auth-session'
import { getCompartilhamentos } from '@/service/parceiro/compartilhamentos-service'
import { listarEquipe } from '@/service/parceiro/equipe-service'
import { getPortalIndicados } from '@/service/parceiro/parceiro-portal-service'
import type { CompartilhamentoResumo, PapelParceiro } from '@/service/parceiro/types'
import { calcularTempoRestante } from '@/utils/format/expiracao'
import { ESPECIE_DO_AVATAR, ICONE_DO_SERVICO } from '@/utils/parceiro/acesso-na-lista'
import { rotuloDaEspecie } from '@/utils/parceiro/especie-do-acesso'

import HomeAreaDoPortal, { type BloqueioDaArea } from './HomeAreaDoPortal.vue'
import { useCarteiraDoInicio, useProgramasDoParceiro } from './portal-no-inicio'

type Equipe = Awaited<ReturnType<typeof listarEquipe>>
type Membro = Equipe['membros'][number]
type Indicado = Awaited<ReturnType<typeof getPortalIndicados>>['data'][number]

/** A página da lista de acessos: o número para em "20+", e o resto a tela de Acessos conta. */
const ACESSOS_NA_CONTA = 20
/** Quantas linhas cada lista mostra: curta, para ler de relance. */
const NA_LISTA = 3

const SELO_DO_PAPEL: Record<PapelParceiro, { classe: string; icone: string }> = {
  DONO: { classe: 'ui-selo--lugar', icone: 'ph ph-crown-simple' },
  OPERADOR: { classe: '', icone: 'ph ph-user' },
}

const SELO_DO_INDICADO: Record<Indicado['status'], { classe: string; icone: string }> = {
  COM_ASSINATURA: { classe: 'ui-selo--ok', icone: 'ph ph-check-circle' },
  SEM_ASSINATURA: { classe: '', icone: 'ph ph-circle-dashed' },
  CANCELADO: { classe: 'ui-selo--contorno', icone: 'ph ph-x-circle' },
}

const { t, locale } = useI18n()
const { store, ensureContext, parceiroQuery } = useParceiroPortal()
const carteira = useCarteiraDoInicio()
const { todos: programas, afiliadoEmAnalise } = useProgramasDoParceiro()
const agora = useAgora()

const indique = ref<InstanceType<typeof HomeIndique> | null>(null)

const contextoPronto = computed(() => store.loadState === 'ready')
const afiliadoAtivo = computed(() => store.statusAfiliadoAtivo)
const intl = computed(() => INTL_LOCALE[locale.value as Locale])

function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean)

  return ((partes[0]?.[0] ?? '?') + (partes[1]?.[0] ?? '')).toLocaleUpperCase()
}

function dataCurta(iso: string) {
  const data = new Date(iso)

  return Number.isNaN(data.getTime())
    ? ''
    : new Intl.DateTimeFormat(intl.value, { day: 'numeric', month: 'short' }).format(data)
}

/* ------------------------------------------------------------------ o bloqueio */

const bloqueio = computed<BloqueioDaArea | null>(() => {
  if (!contextoPronto.value || afiliadoAtivo.value) return null

  const destino = { path: '/parceiro/programas', hash: '#programas' }

  return afiliadoEmAnalise.value
    ? {
        titulo: t('inicio.programa.selo.SOLICITADO'),
        texto: t('inicio.areas.bloqueio.emAnalise'),
        botao: t('inicio.areas.bloqueio.acompanhar'),
        to: destino,
      }
    : {
        titulo: t('inicio.areas.bloqueio.titulo'),
        texto: t('inicio.areas.bloqueio.texto'),
        botao: t('inicio.areas.bloqueio.liberar'),
        to: destino,
      }
})

/* ------------------------------------------------------------------ acessos */

const acessos = ref<{ itens: CompartilhamentoResumo[]; mais: boolean } | null>(null)
const acessosFalhou = ref(false)

async function carregarAcessos() {
  acessosFalhou.value = false

  try {
    const pagina = await getCompartilhamentos({
      ...parceiroQuery(),
      status: 'ATIVO',
      ordenarPor: 'recentes',
      limit: ACESSOS_NA_CONTA,
    })

    acessos.value = { itens: pagina.data, mais: Boolean(pagina.meta.proximoCursor) }
  } catch {
    acessos.value = null
    acessosFalhou.value = true
  }
}

function mesmoDia(iso: string, dia: Date) {
  const data = new Date(iso)

  return (
    data.getFullYear() === dia.getFullYear() &&
    data.getMonth() === dia.getMonth() &&
    data.getDate() === dia.getDate()
  )
}

const novosHoje = computed(() => {
  const hoje = new Date(agora.value)

  return (acessos.value?.itens ?? []).filter(
    (item) => item.vinculadoEm && mesmoDia(item.vinculadoEm, hoje),
  ).length
})

const valorDosAcessos = computed(() => {
  if (acessosFalhou.value) return '–'
  if (!acessos.value) return null

  const total = acessos.value.itens.length

  return acessos.value.mais ? `${total}+` : total
})

const acessosNaLista = computed(() => acessos.value?.itens.slice(0, NA_LISTA) ?? [])

function servicoDoAcesso(item: CompartilhamentoResumo) {
  return item.tipoServico === 'OUTRO' && item.servicoOutroLabel
    ? item.servicoOutroLabel
    : t(`acessos.servico.${item.tipoServico}`)
}

/** Quanto falta para o acesso fechar, curto: "3d 4h", "5h 12min". */
function prazoDoAcesso(item: CompartilhamentoResumo) {
  const restante = calcularTempoRestante(item.expiraEm, agora.value)

  switch (restante.estado) {
    case 'dias':
      return t('acessos.lista.prazo.dias', { d: restante.dias, h: restante.horas })
    case 'horas':
      return t('acessos.lista.prazo.horas', { h: restante.horas, m: restante.minutos })
    case 'minutos':
      return t('acessos.lista.prazo.minutos', { m: restante.minutos })
    default:
      return t('acessos.expira.expirado')
  }
}

/** Só o que fecha em menos de um dia ganha âmbar, como na tela de Acessos. */
function prazoUrgente(item: CompartilhamentoResumo) {
  return calcularTempoRestante(item.expiraEm, agora.value).estado !== 'dias'
}

/* ------------------------------------------------------------------ indicados */

const mostraIndicados = computed(() => store.isDono)
const indicados = ref<{ total: number; itens: Indicado[] } | null>(null)
const indicadosFalhou = ref(false)

async function carregarIndicados() {
  indicadosFalhou.value = false

  if (!store.isDono || !store.statusAfiliadoAtivo) {
    indicados.value = null
    return
  }

  try {
    const pagina = await getPortalIndicados({ ...parceiroQuery(), limit: NA_LISTA })

    indicados.value = { total: pagina.meta.total, itens: pagina.data }
  } catch {
    indicados.value = null
    indicadosFalhou.value = true
  }
}

const valorDosIndicados = computed(() => {
  if (bloqueio.value) return 0
  if (indicadosFalhou.value) return '–'

  return indicados.value?.total ?? null
})

/* ------------------------------------------------------------------ equipe */

const equipe = ref<Equipe | null>(null)
const equipeFalhou = ref(false)
const meuId = computed(() => getAuthUser()?.userId ?? null)

async function carregarEquipe() {
  equipeFalhou.value = false

  try {
    equipe.value = await listarEquipe(parceiroQuery())
  } catch {
    equipe.value = null
    equipeFalhou.value = true
  }
}

/** O dono primeiro, depois quem está olhando, depois o resto na ordem da API. */
const pessoasNaLista = computed<Membro[]>(() => {
  const membros = [...(equipe.value?.membros ?? [])]
  const peso = (membro: Membro) =>
    membro.papel === 'DONO' ? 0 : membro.usuarioId === meuId.value ? 1 : 2

  return membros.sort((a, b) => peso(a) - peso(b)).slice(0, NA_LISTA)
})

const pessoasDeFora = computed(() => Math.max(0, (equipe.value?.membros.length ?? 0) - NA_LISTA))

/* ------------------------------------------------------------------ carregar */

async function carregar() {
  try {
    await ensureContext()
  } catch {
    return
  }

  await Promise.all([carregarAcessos(), carregarIndicados(), carregarEquipe()])
}

onMounted(() => {
  void carregar()
})

/* Afiliação aprovada com o Início aberto: os indicados passam a existir. */
watch(afiliadoAtivo, (ativo, antes) => {
  if (ativo && !antes) {
    void carregarIndicados()
  }
})

/* ------------------------------------------------------------------ carteira e divulgação */

const valorDaCarteira = computed(() => {
  if (bloqueio.value) return carteira.brl(0)
  if (carteira.falhou.value) return '–'
  if (!carteira.pronto.value || !carteira.carteira.value) return null

  return carteira.brl(carteira.carteira.value.saldoSacavelCentavos)
})

/** As linhas de baixo da carteira. Turva, a mesma forma com zeros: nada de valor inventado. */
const valoresDaCarteira = computed(() => {
  const dados = bloqueio.value ? null : carteira.carteira.value

  return [
    {
      id: 'retido',
      rotulo: t('inicio.saldo.retido'),
      valor: carteira.brl(dados ? carteira.retidoCentavos.value : 0),
    },
    {
      id: 'sacado',
      rotulo: t('inicio.saldo.sacado'),
      valor: carteira.brl(dados?.totalSacadoCentavos ?? 0),
    },
    {
      id: 'minimo',
      rotulo: t('carteira.resumo.minimo'),
      valor: carteira.brl(dados?.saqueMinimoCentavos ?? 0),
    },
    {
      id: 'pix',
      rotulo: t('carteira.visao.pix.label'),
      valor: dados?.chavePix || t('carteira.tela.semPix'),
      apagado: !dados?.chavePix,
    },
  ]
})

const leituras = computed(() => indique.value?.resumo ?? null)
const codigo = computed(() => indique.value?.codigo ?? '')
const qrUrl = computed(() => indique.value?.qrUrl ?? '')
const qrFalhou = ref(false)

watch(qrUrl, () => {
  qrFalhou.value = false
})

const temQr = computed(() => Boolean(qrUrl.value) && !qrFalhou.value)

const valorDasLeituras = computed(() => {
  if (bloqueio.value) return 0
  if (!leituras.value) return null
  if (leituras.value.indisponivel) return '–'

  return leituras.value.semana
})
</script>

<template>
  <section class="areas" :aria-label="t('inicio.areas.rotulo')">
    <div class="areas__grade" :class="{ 'areas__grade--sem-indicados': !mostraIndicados }">
      <!-- ------------------------------------------------------------ acessos -->
      <HomeAreaDoPortal
        id="acessos"
        class="areas__acessos"
        :titulo="t('nav.items.acessos')"
        icone="ph ph-clipboard-text"
        to="/parceiro/acessos"
        :valor="valorDosAcessos"
        :rotulo="
          t(
            'inicio.areas.acessos.ativos',
            { total: acessos?.itens.length ?? 0 },
            acessos?.itens.length ?? 0,
          )
        "
        :meta="
          novosHoje
            ? t('inicio.areas.acessos.novosHoje', { total: novosHoje }, novosHoje)
            : acessosFalhou
              ? t('inicio.areas.falhou')
              : ''
        "
        :tom="acessos && !acessos.itens.length ? 'apagado' : 'neutro'"
        :acao="{
          rotulo: t('acessos.vincular.cta'),
          icone: 'ph ph-plus',
          to: { path: '/parceiro/acessos', query: { vincular: '' } },
        }"
      >
        <ul v-if="!acessos && !acessosFalhou" class="lista" aria-hidden="true">
          <li v-for="n in NA_LISTA" :key="n" class="linha">
            <Skeleton shape="circle" size="2.25rem" />
            <span class="linha__texto">
              <Skeleton width="7rem" height="0.8rem" />
              <Skeleton width="10rem" height="0.7rem" />
            </span>
          </li>
        </ul>

        <ul v-else-if="acessosNaLista.length" class="lista">
          <li v-for="item in acessosNaLista" :key="item.id">
            <RouterLink :to="`/parceiro/acessos/${item.id}`" class="linha linha--link">
              <PetAvatar
                :nome="item.petNome"
                :iniciais="item.petNome.trim().slice(0, 2).toLocaleUpperCase()"
                :especie="ESPECIE_DO_AVATAR[item.especie] ?? null"
                :foto-url="item.petFoto ?? ''"
                tamanho="sm"
              />
              <span class="linha__texto">
                <span class="linha__titulo">{{ item.petNome }}</span>
                <span class="linha__meta">
                  <i :class="ICONE_DO_SERVICO[item.tipoServico]" aria-hidden="true" />
                  {{ servicoDoAcesso(item) }} · {{ rotuloDaEspecie(item) }}
                </span>
              </span>
              <span class="linha__fim" :class="{ 'linha__fim--atencao': prazoUrgente(item) }">
                <i class="ph ph-timer" aria-hidden="true" />
                {{ prazoDoAcesso(item) }}
              </span>
            </RouterLink>
          </li>
        </ul>

        <p v-else-if="acessos" class="vazio">
          <strong>{{ t('acessos.list.emptyAtivosTitle') }}</strong>
          {{ t('acessos.list.emptyAtivosBody') }}
        </p>
      </HomeAreaDoPortal>

      <!-- ------------------------------------------------------------ divulgação -->
      <HomeAreaDoPortal
        id="divulgacao"
        class="areas__divulgacao"
        :titulo="t('nav.items.divulgacao')"
        icone="ph ph-share-network"
        to="/parceiro/divulgacao"
        :valor="valorDasLeituras"
        :rotulo="
          t(
            'inicio.espacos.portal.leituras',
            { total: leituras?.semana ?? 0 },
            leituras?.semana ?? 0,
          )
        "
        :meta="
          leituras?.total != null
            ? t('inicio.espacos.portal.leiturasTotal', { total: leituras.total }, leituras.total)
            : ''
        "
        :tom="leituras?.semana ? 'neutro' : 'apagado'"
        :bloqueio="bloqueio"
      >
        <div class="qr">
          <Button
            v-if="temQr && !bloqueio"
            unstyled
            type="button"
            class="qr__quadro"
            :aria-label="t('inicio.indique.ampliarQr')"
            :title="t('inicio.indique.ampliarQr')"
            @click="indique?.abrirQr()"
          >
            <img
              :src="qrUrl"
              alt=""
              class="qr__imagem"
              referrerpolicy="no-referrer"
              @error="qrFalhou = true"
            />
            <span class="qr__ampliar" aria-hidden="true"
              ><i class="ph ph-arrows-out-simple"
            /></span>
          </Button>
          <span v-else class="qr__quadro qr__quadro--vazio" aria-hidden="true">
            <i class="ph ph-qr-code" />
          </span>

          <span class="qr__texto">
            <span class="qr__rotulo">{{ t('inicio.indique.seuCodigo') }}</span>
            <bdi class="qr__codigo ui-num" dir="ltr">{{ bloqueio ? '······' : codigo || '–' }}</bdi>
            <Button
              type="button"
              size="small"
              severity="secondary"
              icon="ph ph-copy"
              :label="t('inicio.indique.copiar')"
              :disabled="!codigo || Boolean(bloqueio)"
              @click="indique?.copiar()"
            />
          </span>
        </div>
      </HomeAreaDoPortal>

      <!-- ------------------------------------------------------------ equipe -->
      <HomeAreaDoPortal
        id="equipe"
        class="areas__equipe"
        :titulo="t('parceiro.equipe.titulo')"
        icone="ph ph-users"
        to="/parceiro/equipe"
        :valor="equipeFalhou ? '–' : (equipe?.membros.length ?? null)"
        :rotulo="
          t(
            'inicio.areas.equipe.pessoas',
            { total: equipe?.membros.length ?? 0 },
            equipe?.membros.length ?? 0,
          )
        "
        :meta="
          equipe?.convites.length
            ? t(
                'inicio.areas.equipe.convites',
                { total: equipe.convites.length },
                equipe.convites.length,
              )
            : equipeFalhou
              ? t('inicio.areas.falhou')
              : ''
        "
      >
        <ul v-if="!equipe && !equipeFalhou" class="lista" aria-hidden="true">
          <li v-for="n in NA_LISTA" :key="n" class="linha">
            <Skeleton shape="circle" size="2.25rem" />
            <Skeleton width="8rem" height="0.8rem" />
          </li>
        </ul>

        <ul v-else-if="equipe" class="lista">
          <li v-for="membro in pessoasNaLista" :key="membro.usuarioId" class="linha">
            <span class="rosto" aria-hidden="true">{{ iniciais(membro.nome) }}</span>
            <span class="linha__texto">
              <span class="linha__titulo">
                {{ membro.nome }}
                <span v-if="membro.usuarioId === meuId" class="ui-selo ui-selo--contorno">
                  {{ t('parceiro.equipe.voce') }}
                </span>
              </span>
            </span>
            <span class="ui-selo" :class="SELO_DO_PAPEL[membro.papel].classe">
              <i :class="SELO_DO_PAPEL[membro.papel].icone" aria-hidden="true" />
              {{ t(`parceiro.equipe.papel.${membro.papel}`) }}
            </span>
          </li>
          <li v-if="pessoasDeFora" class="lista__mais">
            {{ t('inicio.areas.mais', { total: pessoasDeFora }) }}
          </li>
        </ul>
      </HomeAreaDoPortal>

      <!-- ------------------------------------------------------------ indicados -->
      <HomeAreaDoPortal
        v-if="mostraIndicados"
        id="indicados"
        class="areas__indicados"
        :titulo="t('nav.items.indicados')"
        icone="ph ph-user-list"
        to="/parceiro/indicados"
        :valor="valorDosIndicados"
        :rotulo="
          t('inicio.areas.indicados.total', { total: indicados?.total ?? 0 }, indicados?.total ?? 0)
        "
        :meta="indicadosFalhou ? t('inicio.areas.falhou') : ''"
        :tom="indicados && !indicados.total ? 'apagado' : 'neutro'"
        :bloqueio="bloqueio"
      >
        <!-- Turva: a forma de uma lista, sem nome nenhum. -->
        <ul v-if="bloqueio" class="lista" aria-hidden="true">
          <li v-for="n in NA_LISTA" :key="n" class="linha">
            <span class="rosto" />
            <span class="fantasma" />
          </li>
        </ul>

        <ul v-else-if="!indicados && !indicadosFalhou" class="lista" aria-hidden="true">
          <li v-for="n in NA_LISTA" :key="n" class="linha">
            <Skeleton shape="circle" size="2.25rem" />
            <Skeleton width="8rem" height="0.8rem" />
          </li>
        </ul>

        <ul v-else-if="indicados?.itens.length" class="lista">
          <li
            v-for="(indicado, indice) in indicados.itens"
            :key="`${indicado.cadastradoEm}-${indice}`"
            class="linha"
          >
            <span class="rosto" aria-hidden="true">
              {{ indicado.nome ? iniciais(indicado.nome) : '?' }}
            </span>
            <span class="linha__texto">
              <span class="linha__titulo">
                {{ indicado.nome || t('parceiro.indicados.semNome') }}
              </span>
              <span class="linha__meta">{{ dataCurta(indicado.cadastradoEm) }}</span>
            </span>
            <span class="ui-selo" :class="SELO_DO_INDICADO[indicado.status].classe">
              <i :class="SELO_DO_INDICADO[indicado.status].icone" aria-hidden="true" />
              {{ t(`parceiro.indicados.status.${indicado.status}`) }}
            </span>
          </li>
        </ul>

        <p v-else-if="indicados" class="vazio">
          {{ t('parceiro.indicados.vazio.titulo') }}
        </p>
      </HomeAreaDoPortal>

      <!-- ------------------------------------------------------------ carteira -->
      <HomeAreaDoPortal
        id="carteira"
        class="areas__carteira"
        :titulo="t('nav.items.financeiro')"
        icone="ph ph-wallet"
        to="/parceiro/carteira"
        :valor="valorDaCarteira"
        :rotulo="t('inicio.saldo.liberado')"
        :meta="carteira.falhou.value ? t('inicio.saldo.falhou') : carteira.frase.value"
        :tom="bloqueio ? 'neutro' : carteira.tom.value"
        :acao="carteira.acao.value"
        :bloqueio="bloqueio"
      >
        <dl v-if="bloqueio || carteira.carteira.value" class="valores">
          <div v-for="linha in valoresDaCarteira" :key="linha.id" class="valores__linha">
            <dt>{{ linha.rotulo }}</dt>
            <dd :class="{ valores__apagado: linha.apagado }">
              <bdi dir="ltr">{{ linha.valor }}</bdi>
            </dd>
          </div>
        </dl>
      </HomeAreaDoPortal>
    </div>

    <!-- ------------------------------------------------------------ programas -->
    <section class="programas" aria-labelledby="inicio-area-programas">
      <span class="ui-ladrilho ui-ladrilho--p" aria-hidden="true">
        <i class="ph ph-squares-four" />
      </span>
      <h2 id="inicio-area-programas" class="programas__titulo">
        <RouterLink class="programas__nome" to="/parceiro/programas">
          {{ t('nav.items.programas') }}
          <i class="ph ph-caret-right programas__caret" aria-hidden="true" />
        </RouterLink>
      </h2>
      <ul class="programas__lista">
        <li v-for="programa in programas" :key="programa.id" class="programas__item">
          {{ programa.titulo }}
          <span class="ui-selo" :class="`ui-selo--${programa.tom}`">
            {{ t(`inicio.programa.selo.${programa.status}`) }}
          </span>
        </li>
      </ul>
    </section>

    <!-- Só a gaveta do QR grande, o código e as leituras, para a área de Divulgação. -->
    <HomeIndique ref="indique" forma="painel" />
  </section>
</template>

<style scoped>
.areas {
  display: grid;
  gap: 18px;
  container-type: inline-size;
  container-name: areas;
}

/*
 * Seis trilhos. Em cima, os Acessos largos (quatro) e a Divulgação com o QR (dois); embaixo,
 * Equipe, Indicados e Carteira, dois cada. Sem Indicados (o operador não vê), Equipe e Carteira
 * dividem a linha de baixo.
 */
.areas__grade {
  display: grid;
  align-items: stretch;
  gap: 16px;
  grid-template-columns: repeat(6, minmax(0, 1fr));
}

.areas__grade > * {
  grid-column: span 2;
}

.areas__grade > .areas__acessos {
  grid-column: span 4;
}

.areas__grade--sem-indicados > .areas__equipe,
.areas__grade--sem-indicados > .areas__carteira {
  grid-column: span 3;
}

/* Notebook estreito e tablet: os Acessos na largura toda, o resto dois por linha. */
@container areas (max-width: 1000px) {
  .areas__grade > *,
  .areas__grade--sem-indicados > .areas__equipe,
  .areas__grade--sem-indicados > .areas__carteira {
    grid-column: span 3;
  }

  .areas__grade > .areas__acessos {
    grid-column: 1 / -1;
  }
}

@container areas (max-width: 560px) {
  .areas__grade > *,
  .areas__grade--sem-indicados > .areas__equipe,
  .areas__grade--sem-indicados > .areas__carteira {
    grid-column: 1 / -1;
  }
}

/* ------------------------------------------------------------------ listas */

.lista {
  display: grid;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}

/* A linha do app: sem caixa; a que é link acende em véu, com o véu saindo um pouco para fora. */
.linha {
  display: flex;
  min-height: 46px;
  align-items: center;
  gap: 10px;
  margin-inline: -8px;
  padding: 5px 8px;
  border-radius: 14px;
  color: var(--tinta);
  text-decoration: none;
}

.linha--link {
  transition: background-color var(--pj-tempo-curto) ease;
}

.linha--link:hover {
  background: var(--app-toque, var(--superficie-2));
}

.linha--link:focus-visible {
  outline: 2px solid var(--musgo);
  outline-offset: -2px;
}

.linha__texto {
  display: grid;
  min-width: 0;
  flex: 1;
  gap: 2px;
}

.linha__titulo {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 6px;
  overflow: hidden;
  color: var(--tinta);
  font-size: 14px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.linha__meta {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 5px;
  overflow: hidden;
  color: var(--tinta-2);
  font-size: 12.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.linha__meta i {
  flex: none;
  font-size: 14px;
}

.linha__fim {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 5px;
  color: var(--tinta-2);
  font-size: 12.5px;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

.linha__fim--atencao {
  color: var(--atencao-tinta);
}

.linha .ui-selo {
  flex: none;
}

/* O rosto de quem não tem foto: as iniciais num círculo neutro, como na tela da Equipe. */
.rosto {
  display: grid;
  width: 2.25rem;
  height: 2.25rem;
  flex: none;
  place-items: center;
  border-radius: 999px;
  background: var(--neutro-fundo, var(--superficie-3));
  color: var(--neutro-tinta, var(--tinta-2));
  font-size: 13px;
  font-weight: 650;
  letter-spacing: 0.02em;
}

/* A forma de uma linha, para debaixo do turvo: sem texto nenhum. */
.fantasma {
  width: min(10rem, 60%);
  height: 0.8rem;
  border-radius: 6px;
  background: var(--superficie-3);
}

.lista__mais {
  padding: 4px 0 0;
  color: var(--tinta-2);
  font-size: 12.5px;
}

.vazio {
  display: grid;
  gap: 4px;
  max-width: 52ch;
  margin: 0;
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.5;
}

.vazio strong {
  color: var(--tinta);
  font-weight: 600;
}

/* ------------------------------------------------------------------ o QR */

.qr {
  display: flex;
  align-items: center;
  gap: 16px;
}

/* Sempre sobre papel branco, nos dois temas: leitor de QR precisa de zona quieta clara. */
.qr__quadro {
  position: relative;
  display: grid;
  width: 8.5rem;
  height: 8.5rem;
  flex: none;
  place-items: center;
  padding: 8px;
  border: 1px solid var(--app-regua, var(--linha));
  border-radius: 16px;
  background: #fff;
  cursor: zoom-in;
  transition: border-color var(--pj-tempo-curto) ease;
}

.qr__quadro:hover {
  border-color: var(--app-salvia, var(--musgo));
}

.qr__quadro:focus-visible {
  outline: 2px solid var(--musgo);
  outline-offset: 2px;
}

.qr__quadro--vazio {
  border-style: dashed;
  background: var(--superficie);
  color: var(--tinta-3);
  cursor: default;
  font-size: 44px;
}

.qr__imagem {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.qr__ampliar {
  position: absolute;
  inset-block-end: -7px;
  inset-inline-end: -7px;
  display: grid;
  width: 24px;
  height: 24px;
  place-items: center;
  border-radius: 999px;
  /* Sólido: o selinho fica por cima do papel branco do QR, e véu translúcido ali sumia no escuro. */
  background: var(--superficie-3);
  box-shadow: 0 0 0 3px var(--superficie);
  color: var(--tinta-2);
  font-size: 13px;
}

.qr__texto {
  display: grid;
  min-width: 0;
  justify-items: start;
  gap: 4px;
}

.qr__rotulo {
  color: var(--tinta-2);
  font-size: 12.5px;
}

/* O código é dado, não enfeite: algarismos de mesma largura, para ser ditado ao telefone. */
.qr__codigo {
  max-width: 100%;
  margin-bottom: 6px;
  overflow: hidden;
  color: var(--tinta);
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 0.03em;
  line-height: 1.15;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ------------------------------------------------------------------ carteira */

.valores {
  display: grid;
  margin: 0;
}

.valores__linha {
  display: flex;
  min-height: 40px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-top: 1px solid var(--app-regua, var(--linha-suave));
}

.valores__linha dt {
  color: var(--tinta-2);
  font-size: 13px;
}

.valores__linha dd {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  color: var(--tinta);
  font-size: 13.5px;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.valores__apagado {
  color: var(--tinta-3) !important;
  font-weight: 500 !important;
}

/* ------------------------------------------------------------------ programas */

.programas {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 14px;
  padding-inline: 2px;
}

.programas__titulo {
  margin: 0;
  font-size: 14.5px;
  font-weight: 650;
}

.programas__nome {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border-radius: 6px;
  color: var(--tinta);
  text-decoration: none;
}

.programas__nome:focus-visible {
  outline: 2px solid var(--musgo);
  outline-offset: 2px;
}

.programas__caret {
  color: var(--tinta-3);
  font-size: 13px;
}

[dir='rtl'] .programas__caret {
  scale: -1 1;
}

.programas__lista {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 18px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.programas__item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--tinta-2);
  font-size: 13px;
}

@media (prefers-reduced-motion: reduce) {
  .linha--link,
  .qr__quadro {
    transition: none;
  }
}
</style>
