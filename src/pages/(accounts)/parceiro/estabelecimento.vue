<script setup lang="ts">
/**
 * O estabelecimento (E1-01): como a casa aparece para os responsáveis e em que horário atende.
 *
 * ## A forma
 *
 * Três abas, cada uma com duas seções lado a lado (empilhadas na tela estreita), e o mesmo endereço
 * com `?aba=`:
 *
 * - **Página pública** (sem `?aba`): se está no ar, o link e o QR, ou o que falta para publicar,
 *   cada falta com o atalho para preencher; ao lado, as mensagens que a página mostra ao
 *   responsável.
 * - **Perfil e endereço**: o perfil com os contatos e, ao lado, o endereço.
 * - **Horários**: a semana numa régua de 0 h a 24 h e, ao lado, os dias especiais.
 *
 * Cada seção edita na sua gaveta, uma por vez, e "Publicar" fica no alto, porque é a ação da tela
 * em qualquer aba.
 *
 * Qualquer membro lê. Só o DONO edita (`podeEditar` vem pronto da API); com o cadastro suspenso
 * ninguém edita, mas o dono ainda tira a página do ar.
 *
 * ## Horário
 *
 * Tudo é horário de parede no fuso do estabelecimento (IANA, `America/Cuiaba`). O "aberto agora"
 * vem da API com o offset do fuso e é mostrado como veio, sem converter para o fuso do navegador.
 */
import Button from 'primevue/button'
import Skeleton from 'primevue/skeleton'
import { useToast } from 'primevue/usetoast'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import ConfirmActionDialog from '@/components/common/ConfirmActionDialog.vue'
import EstabelecimentoDiaGaveta from '@/components/parceiro/estabelecimento/EstabelecimentoDiaGaveta.vue'
import EstabelecimentoDiasEspeciais from '@/components/parceiro/estabelecimento/EstabelecimentoDiasEspeciais.vue'
import EstabelecimentoHorariosGaveta from '@/components/parceiro/estabelecimento/EstabelecimentoHorariosGaveta.vue'
import EstabelecimentoLinkPublico from '@/components/parceiro/estabelecimento/EstabelecimentoLinkPublico.vue'
import EstabelecimentoPerfilGaveta, {
  type ParteDoPerfil,
} from '@/components/parceiro/estabelecimento/EstabelecimentoPerfilGaveta.vue'
import EstabelecimentoSemana from '@/components/parceiro/estabelecimento/EstabelecimentoSemana.vue'
import EstabelecimentoSlugGaveta from '@/components/parceiro/estabelecimento/EstabelecimentoSlugGaveta.vue'
import {
  dataCivil,
  dataDoInstante,
  hojeNoFuso,
  horaDoInstante,
  nomeDoFuso,
  offsetDoFuso,
  temHorario,
} from '@/components/parceiro/estabelecimento/horario'
import UiPagina from '@/components/ui/UiPagina.vue'
import UiSecao from '@/components/ui/UiSecao.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { INTL_LOCALE, type Locale } from '@/i18n/locales'
import type { Aba } from '@/navegacao/espacos'
import { ApiError } from '@/service/api'
import {
  copiarFeriadosNacionais,
  criarDiaEspecial,
  despublicarEstabelecimento,
  obterEstabelecimento,
  publicarEstabelecimento,
  removerDiaEspecial,
  removerDiasEspeciais,
  salvarHorarios,
  salvarPerfil,
  trocarSlug,
  type DadosDoEstabelecimento,
  type DiaEspecial,
  type Estabelecimento,
  type HorarioDoDia,
  type NovoDiaEspecial,
} from '@/service/parceiro/estabelecimento-service'
import { formatPhone } from '@/utils/format/phone'
import { linksDaPaginaPublica } from '@/utils/parceiro/pagina-publica'

const { t, locale } = useI18n()
const toast = useToast()
const route = useRoute()
const router = useRouter()
const { store, ensureContext, parceiroQuery } = useParceiroPortal()

const estabelecimento = ref<Estabelecimento | null>(null)
const erroAoCarregar = ref('')

const intl = computed(() => INTL_LOCALE[locale.value as Locale])

const perfil = computed(() => estabelecimento.value?.perfil ?? null)
const podeEditar = computed(() => estabelecimento.value?.podeEditar ?? false)
/** Despublicar vale mesmo com o cadastro suspenso, mas é do dono. */
const podeDespublicar = computed(() => store.isDono && Boolean(perfil.value?.publicado))
const pendencias = computed(() => estabelecimento.value?.pendenciasParaPublicar ?? [])
const fuso = computed(() => perfil.value?.fusoHorario ?? null)
const hoje = computed(() => hojeNoFuso(fuso.value ?? 'America/Sao_Paulo'))

const loadError = computed(() => {
  if (store.loadState === 'error' && !store.semAcessoParceiro) return store.errorMessage

  return erroAoCarregar.value
})

async function carregar() {
  erroAoCarregar.value = ''

  try {
    await ensureContext()
    estabelecimento.value = await obterEstabelecimento(parceiroQuery())
  } catch (err) {
    erroAoCarregar.value =
      err instanceof Error ? err.message : t('parceiro.estabelecimento.erroCarregar')
  }
}

onMounted(() => {
  void carregar()
})

/** Erros em que a tela na frente ficou velha: o papel ou o cadastro mudou. */
const CODIGOS_DE_TELA_VELHA = new Set(['ESTABELECIMENTO_APENAS_DONO', 'PARCEIRO_CADASTRO_SUSPENSO'])

function seATelaFicouVelha(err: unknown) {
  if (err instanceof ApiError && err.codigo && CODIGOS_DE_TELA_VELHA.has(err.codigo)) {
    void ensureContext(true)
    void carregar()
  }
}

function comoErro(err: unknown) {
  return err instanceof Error ? err : new Error(String(err))
}

function avisarErro(err: unknown) {
  toast.add({
    severity: 'error',
    summary: t('parceiro.estabelecimento.toast.erro'),
    detail: err instanceof Error ? err.message : undefined,
    life: 6000,
  })
  seATelaFicouVelha(err)
}

function avisarSucesso(chave: string, detalhe?: string) {
  toast.add({
    severity: 'success',
    summary: t(`parceiro.estabelecimento.toast.${chave}`),
    detail: detalhe,
    life: 3500,
  })
}

/* --------------------------------------------------------------------------------- abas */

const ABAS = ['pagina', 'perfil', 'horarios'] as const
type AbaDaTela = (typeof ABAS)[number]

const ICONE_DA_ABA: Record<AbaDaTela, string> = {
  pagina: 'ph ph-browser',
  perfil: 'ph ph-storefront',
  horarios: 'ph ph-clock',
}

const aba = computed<AbaDaTela>(() => {
  const pedida = route.query.aba

  return ABAS.includes(pedida as AbaDaTela) ? (pedida as AbaDaTela) : 'pagina'
})

/** A aba é a mesma URL com outro `?aba=`; a página pública é a tela sem o parâmetro. */
function destinoDa(alvo: AbaDaTela) {
  const query = { ...route.query }

  if (alvo === 'pagina') {
    delete query.aba
  } else {
    query.aba = alvo
  }

  return { path: route.path, query }
}

const abas = computed<Aba[]>(() =>
  ABAS.map((id) => ({
    rotulo: t(`parceiro.estabelecimento.abas.${id}`),
    icone: ICONE_DA_ABA[id],
    to: router.resolve(destinoDa(id)).fullPath,
  })),
)

const abaAtual = computed(() => router.resolve(destinoDa(aba.value)).fullPath)

/* ---------------------------------------------------------------------- a página pública */

type Situacao = 'noAr' | 'foraDoAr' | 'naoPublicada'

const situacao = computed<Situacao>(() => {
  if (estabelecimento.value?.visivelPublicamente) return 'noAr'
  if (perfil.value?.publicado) return 'foraDoAr'

  return 'naoPublicada'
})

/**
 * O link e o QR da página no site (PJ-KE667M): só com a página no ar. Clínica em `/agendar`, hotel
 * em `/reservar`, pelos módulos da casa e pela sugestão da categoria (`elegiveis` do `/eu`).
 */
const linksPublicos = computed(() => {
  const slug = estabelecimento.value?.slug

  if (situacao.value !== 'noAr' || !slug) {
    return []
  }

  return linksDaPaginaPublica(slug, store.eu?.modulos ?? [], store.eu?.elegiveis ?? [])
})

const ICONE_DA_SITUACAO: Record<Situacao, string> = {
  noAr: 'ph ph-globe-simple',
  foraDoAr: 'ph ph-cloud-slash',
  naoPublicada: 'ph ph-eye-slash',
}

const resumo = computed(() =>
  estabelecimento.value ? t(`parceiro.estabelecimento.situacao.${situacao.value}`) : '',
)

const publicadaEm = computed(() =>
  perfil.value?.publicadoEm
    ? new Date(perfil.value.publicadoEm).toLocaleDateString(intl.value, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '',
)

const aguardandoAprovacao = computed(() => pendencias.value.includes('APROVACAO'))

/**
 * O que a página precisa para ir ao ar, inteiro: o que já está feito ganha o visto, o que falta
 * (a lista da API) ganha o atalho para a gaveta onde se preenche. A aprovação é da equipe
 * PetJourney: ela não tem atalho.
 */
const REQUISITOS = ['APROVACAO', 'nomePublico', 'fusoHorario', 'telefone'] as const

const requisitos = computed(() =>
  REQUISITOS.map((id) => ({ id, feito: !pendencias.value.includes(id) })),
)

function resolver() {
  void router.push(destinoDa('perfil'))
  abrirPerfil('perfil')
}

const acao = ref<'publicar' | 'despublicar' | 'feriados' | null>(null)

async function publicar() {
  acao.value = 'publicar'

  try {
    estabelecimento.value = await publicarEstabelecimento(parceiroQuery())
    avisarSucesso('publicada')
  } catch (err) {
    avisarErro(err)

    /* Faltou alguma coisa (a API diz o quê): a lista do que falta volta atualizada. */
    if (err instanceof ApiError && err.codigo === 'ESTABELECIMENTO_INCOMPLETO') void carregar()
  } finally {
    acao.value = null
  }
}

const confirmarDespublicar = ref(false)

async function despublicar() {
  acao.value = 'despublicar'

  try {
    estabelecimento.value = await despublicarEstabelecimento(parceiroQuery())
    avisarSucesso('despublicada')
  } catch (err) {
    avisarErro(err)
  } finally {
    acao.value = null
  }
}

/* ------------------------------------------------------------------------ perfil, endereço */

const perfilAberto = ref(false)
const parteAberta = ref<ParteDoPerfil>('perfil')
const salvandoPerfil = ref(false)
const erroDoPerfil = ref<Error | null>(null)

function abrirPerfil(parte: ParteDoPerfil) {
  parteAberta.value = parte
  erroDoPerfil.value = null
  perfilAberto.value = true
}

async function salvarParteDoPerfil(dados: DadosDoEstabelecimento) {
  salvandoPerfil.value = true
  erroDoPerfil.value = null

  try {
    estabelecimento.value = await salvarPerfil(dados, parceiroQuery())
    perfilAberto.value = false
    avisarSucesso(`salvo.${parteAberta.value}`)
  } catch (err) {
    erroDoPerfil.value = comoErro(err)
    seATelaFicouVelha(err)
  } finally {
    salvandoPerfil.value = false
  }
}

function contato(valor: string | null | undefined) {
  if (!valor) return ''

  /* Número brasileiro com DDD sai formatado; internacional (com +) sai como foi escrito. */
  return valor.startsWith('+') ? valor : formatPhone(valor)
}

const linhasDoPerfil = computed(() => {
  const atual = perfil.value

  if (!atual) return []

  return [
    { id: 'nomePublico', valor: atual.nomePublico },
    {
      id: 'fusoHorario',
      valor: `${nomeDoFuso(atual.fusoHorario)} (${offsetDoFuso(atual.fusoHorario)})`,
    },
    {
      id: 'idiomaDosTextos',
      valor: t(`parceiro.estabelecimento.idioma.${atual.idiomaDosTextos.replace('-', '')}`),
    },
    { id: 'telefonePublico', valor: contato(atual.telefonePublico) },
    { id: 'whatsappPublico', valor: contato(atual.whatsappPublico) },
    { id: 'telefonePlantao', valor: contato(atual.telefonePlantao) },
    { id: 'emailPublico', valor: atual.emailPublico ?? '' },
    { id: 'site', valor: atual.site ?? '' },
  ]
})

const enderecoEmLinhas = computed(() => {
  const atual = perfil.value

  if (!atual) return []

  const rua = [atual.logradouro, atual.numero].filter(Boolean).join(', ')
  const lugar = [atual.bairro, [atual.cidade, atual.uf].filter(Boolean).join('/')]
    .filter(Boolean)
    .join(' · ')
  /* A API guarda só os dígitos; o CEP volta com o hífen para ler. */
  const cepLegivel = atual.cep?.replace(/^(\d{5})(\d{3})$/, '$1-$2')
  const cep = cepLegivel ? `${t('parceiro.estabelecimento.campo.cep')} ${cepLegivel}` : ''

  return [[rua, atual.complemento].filter(Boolean).join(' · '), lugar, cep].filter(Boolean)
})

const mapa = computed(() => {
  const atual = perfil.value

  if (!atual) return ''
  if (atual.latitude == null || atual.longitude == null) {
    return t('parceiro.estabelecimento.endereco.semCoordenadas')
  }
  if (!atual.mostrarEndereco || !atual.mostrarMapa) {
    return t('parceiro.estabelecimento.endereco.mapaDesligado')
  }

  return t('parceiro.estabelecimento.endereco.mapaLigado')
})

/**
 * As coordenadas abertas no mapa, para conferir se o ponto é a casa: copiadas à mão, um sinal
 * trocado põe o pino em outro continente.
 */
const linkDoMapa = computed(() => {
  const atual = perfil.value

  if (atual?.latitude == null || atual.longitude == null) return ''

  return `https://www.google.com/maps/search/?api=1&query=${atual.latitude},${atual.longitude}`
})

/* ------------------------------------------------------------------------------ horários */

const horariosAbertos = ref(false)
const salvandoHorarios = ref(false)
const erroDosHorarios = ref<Error | null>(null)

function abrirHorarios() {
  erroDosHorarios.value = null
  horariosAbertos.value = true
}

async function salvarSemana(dias: HorarioDoDia[]) {
  salvandoHorarios.value = true
  erroDosHorarios.value = null

  try {
    estabelecimento.value = await salvarHorarios(dias, parceiroQuery())
    horariosAbertos.value = false
    avisarSucesso('salvo.horarios')
  } catch (err) {
    erroDosHorarios.value = comoErro(err)
    seATelaFicouVelha(err)
  } finally {
    salvandoHorarios.value = false
  }
}

const comHorario = computed(() => temHorario(estabelecimento.value?.horarios ?? []))

/** "Aberto agora, fecha às 18:00" ou "Fechado agora, abre seg., 08:00", como a API calculou. */
const agora = computed(() => {
  const funcionamento = estabelecimento.value?.funcionamento

  if (!funcionamento || funcionamento.abertoAgora === null) return null

  if (funcionamento.abertoAgora) {
    return {
      aberto: true,
      texto: funcionamento.fechaEm
        ? t('parceiro.estabelecimento.horario.abertoFechaAs', {
            hora: horaDoInstante(funcionamento.fechaEm),
          })
        : t('parceiro.estabelecimento.horario.abertoAgora'),
    }
  }

  const proxima = funcionamento.proximaAbertura

  if (!proxima) return { aberto: false, texto: t('parceiro.estabelecimento.horario.fechadoAgora') }

  const dia = dataDoInstante(proxima)
  const hora = horaDoInstante(proxima)

  return {
    aberto: false,
    texto:
      dia === hoje.value
        ? t('parceiro.estabelecimento.horario.fechadoAbreAs', { hora })
        : t('parceiro.estabelecimento.horario.fechadoAbreEm', {
            dia: dataCivil(dia).toLocaleDateString(intl.value, {
              weekday: 'short',
              timeZone: 'UTC',
            }),
            hora,
          }),
  }
})

/* ------------------------------------------------------------------------- dias especiais */

const diaAberto = ref(false)
const salvandoDia = ref(false)
const erroDoDia = ref<Error | null>(null)

function abrirDia() {
  erroDoDia.value = null
  diaAberto.value = true
}

async function adicionarDia(dia: NovoDiaEspecial) {
  salvandoDia.value = true
  erroDoDia.value = null

  try {
    await criarDiaEspecial(dia, parceiroQuery())
    diaAberto.value = false
    avisarSucesso('diaAdicionado')
    await carregar()
  } catch (err) {
    erroDoDia.value = comoErro(err)
    seATelaFicouVelha(err)
  } finally {
    salvandoDia.value = false
  }
}

const diasEspeciais = computed(() => estabelecimento.value?.diasEspeciais ?? [])

const removendo = ref<string | null>(null)

async function remover(dia: DiaEspecial) {
  removendo.value = dia.id

  try {
    await removerDiaEspecial(dia.id, parceiroQuery())
    avisarSucesso('diaRemovido')
  } catch (err) {
    avisarErro(err)
  } finally {
    removendo.value = null
    /* Removido aqui ou por outra pessoa antes: a lista volta como está na API. */
    await carregar()
  }
}

const removendoVarios = ref(false)

/**
 * Vários de uma vez. O que já tinha saído (404) conta como removido; o que falhou fica na lista, e o
 * aviso diz quantos. Papel trocado ou cadastro suspenso no meio: a tela se recarrega como sempre.
 */
async function removerVarios(ids: string[]) {
  removendoVarios.value = true

  try {
    const { removidos, falharam, erro } = await removerDiasEspeciais(ids, parceiroQuery())

    if (falharam.length === 0) {
      avisarSucesso(
        'diasRemovidos',
        t(
          'parceiro.estabelecimento.toast.diasRemovidosDetalhe',
          { total: removidos.length },
          removidos.length,
        ),
      )
    } else {
      toast.add({
        severity: 'warn',
        summary: t(
          'parceiro.estabelecimento.toast.diasRemovidosEmParte',
          { total: removidos.length },
          removidos.length,
        ),
        detail: t(
          'parceiro.estabelecimento.toast.diasNaoRemovidos',
          { total: falharam.length },
          falharam.length,
        ),
        life: 6000,
      })
      seATelaFicouVelha(erro)
    }
  } finally {
    await carregar()
    removendoVarios.value = false
  }
}

async function copiarFeriados(ano: number) {
  acao.value = 'feriados'

  try {
    const { copiados, jaExistiam } = await copiarFeriadosNacionais(ano, parceiroQuery())
    /* "0 já estavam na lista" não diz nada: a segunda frase só entra quando há algum. */
    const detalhe = [
      t('parceiro.estabelecimento.toast.feriadosNovos', { total: copiados }, copiados),
      jaExistiam > 0
        ? t('parceiro.estabelecimento.toast.feriadosJaExistiam', { total: jaExistiam }, jaExistiam)
        : '',
    ]
      .filter(Boolean)
      .join(' ')

    avisarSucesso('feriadosCopiados', detalhe)
    await carregar()
  } catch (err) {
    avisarErro(err)
  } finally {
    acao.value = null
  }
}

/* -------------------------------------------------------------------------- endereço da página */

const slugAberto = ref(false)
const salvandoSlug = ref(false)
const erroDoSlug = ref<Error | null>(null)

function abrirSlug() {
  erroDoSlug.value = null
  slugAberto.value = true
}

async function salvarSlug(slug: string) {
  salvandoSlug.value = true
  erroDoSlug.value = null

  try {
    estabelecimento.value = await trocarSlug(slug, parceiroQuery())
    slugAberto.value = false
    avisarSucesso('slugTrocado')
  } catch (err) {
    erroDoSlug.value = comoErro(err)
    seATelaFicouVelha(err)
  } finally {
    salvandoSlug.value = false
  }
}
</script>

<template>
  <UiPagina
    :titulo="t('parceiro.estabelecimento.titulo')"
    :resumo="resumo"
    :erro="loadError"
    :carregando="!estabelecimento && !loadError"
    :sem-acesso-de-parceiro="store.semAcessoParceiro"
    :abas-da-tela="abas"
    :aba-atual="abaAtual"
    @tentar-de-novo="carregar"
  >
    <template #acoes>
      <Button
        v-if="podeEditar && perfil?.publicado !== true"
        icon="ph ph-globe-simple"
        :label="t('parceiro.estabelecimento.publicar')"
        :loading="acao === 'publicar'"
        :disabled="pendencias.length > 0"
        :title="pendencias.length > 0 ? t('parceiro.estabelecimento.publicarFalta') : undefined"
        @click="publicar"
      />
    </template>

    <div v-if="estabelecimento" class="estabelecimento">
      <p v-if="!podeEditar" class="consulta" role="note">
        <i class="ph ph-eye" aria-hidden="true" />
        {{
          store.cadastroSuspenso
            ? t('parceiro.estabelecimento.consulta.suspenso')
            : t('parceiro.estabelecimento.consulta.soDono')
        }}
      </p>

      <!-- ================================================================ página pública -->
      <div v-if="aba === 'pagina'" class="aba" :class="{ 'aba--uma': !perfil }">
        <UiSecao :titulo="t('parceiro.estabelecimento.pagina.titulo')" icone="ph ph-browser" folha>
          <template v-if="podeDespublicar" #acoes>
            <Button
              icon="ph ph-cloud-slash"
              :label="t('parceiro.estabelecimento.despublicar')"
              severity="secondary"
              outlined
              size="small"
              :loading="acao === 'despublicar'"
              @click="confirmarDespublicar = true"
            />
          </template>

          <div class="pagina">
            <p class="pagina__situacao" :class="`pagina__situacao--${situacao}`">
              <span class="pagina__icone" aria-hidden="true"
                ><i :class="ICONE_DA_SITUACAO[situacao]"
              /></span>
              <span>
                <strong>{{ t(`parceiro.estabelecimento.situacao.${situacao}`) }}</strong>
                <small v-if="situacao === 'noAr' && publicadaEm">
                  {{ t('parceiro.estabelecimento.pagina.desde', { data: publicadaEm }) }}
                </small>
                <small v-else-if="situacao === 'foraDoAr'">
                  {{ t('parceiro.estabelecimento.pagina.foraDoArDica') }}
                </small>
                <small v-else>{{ t('parceiro.estabelecimento.pagina.precisa') }}</small>
              </span>
            </p>

            <!-- O que a página precisa para ir ao ar: o feito com visto, o que falta com atalho. -->
            <ul v-if="situacao === 'naoPublicada'" class="requisitos">
              <li
                v-for="requisito in requisitos"
                :key="requisito.id"
                class="requisito"
                :class="{ 'requisito--feito': requisito.feito }"
              >
                <i
                  :class="requisito.feito ? 'ph ph-check-circle' : 'ph ph-circle-dashed'"
                  aria-hidden="true"
                />
                <span class="requisito__nome">
                  {{ t(`parceiro.estabelecimento.requisito.${requisito.id}`) }}
                  <span class="sr-only">
                    {{
                      requisito.feito
                        ? t('parceiro.estabelecimento.requisito.feito')
                        : t('parceiro.estabelecimento.requisito.falta')
                    }}
                  </span>
                </span>
                <span
                  v-if="!requisito.feito && requisito.id === 'APROVACAO'"
                  class="requisito__estado"
                >
                  {{ t('parceiro.estabelecimento.requisito.emAnalise') }}
                </span>
                <Button
                  v-else-if="!requisito.feito && podeEditar"
                  :label="t('parceiro.estabelecimento.requisito.preencher')"
                  icon="ph ph-arrow-right"
                  icon-pos="right"
                  severity="secondary"
                  outlined
                  size="small"
                  @click="resolver"
                />
              </li>
            </ul>

            <EstabelecimentoLinkPublico
              v-if="linksPublicos.length && estabelecimento.slug"
              :links="linksPublicos"
              :slug="estabelecimento.slug"
              :nome="perfil?.nomePublico ?? store.parceiroNome"
            />

            <div class="endereco-da-pagina">
              <span class="dado__rotulo">{{ t('parceiro.estabelecimento.slug.rotulo') }}</span>
              <template v-if="estabelecimento.slug">
                <code class="endereco-da-pagina__slug" dir="ltr">{{ estabelecimento.slug }}</code>
                <Button
                  v-if="podeEditar"
                  :label="t('parceiro.estabelecimento.slug.trocar')"
                  severity="secondary"
                  outlined
                  size="small"
                  @click="abrirSlug"
                />
              </template>
              <span v-else class="dado__vazio">
                {{
                  aguardandoAprovacao
                    ? t('parceiro.estabelecimento.slug.depoisDaAprovacao')
                    : t('parceiro.estabelecimento.slug.nasceDoNome')
                }}
              </span>
            </div>
          </div>
        </UiSecao>

        <!--
          Endereço e mensagens só existem depois do perfil: o salvamento deles leva o nome e o fuso
          junto, e duas caixas dizendo "preencha o perfil primeiro" só repetiam o que o perfil já diz.
        -->
        <UiSecao
          v-if="perfil"
          :titulo="t('parceiro.estabelecimento.mensagens.titulo')"
          icone="ph ph-chat-text"
          folha
        >
          <template v-if="podeEditar" #acoes>
            <Button
              icon="ph ph-pencil-simple"
              :label="t('parceiro.estabelecimento.editar')"
              severity="secondary"
              outlined
              size="small"
              @click="abrirPerfil('mensagens')"
            />
          </template>

          <dl class="dados dados--texto">
            <div
              v-for="campo in ['mensagemForaDoHorario', 'orientacaoEmergencia'] as const"
              :key="campo"
              class="dado"
            >
              <dt class="dado__rotulo">{{ t(`parceiro.estabelecimento.campo.${campo}`) }}</dt>
              <dd v-if="perfil[campo]">{{ perfil[campo] }}</dd>
              <dd v-else class="dado__vazio">
                {{ t('parceiro.estabelecimento.naoInformado') }}.
                {{
                  campo === 'mensagemForaDoHorario'
                    ? t('parceiro.estabelecimento.gaveta.foraDoHorarioDica')
                    : t('parceiro.estabelecimento.gaveta.emergenciaDica')
                }}
              </dd>
            </div>
          </dl>
        </UiSecao>
      </div>

      <!-- ============================================================= perfil e endereço -->
      <div v-else-if="aba === 'perfil'" class="aba" :class="{ 'aba--uma': !perfil }">
        <UiSecao
          :titulo="t('parceiro.estabelecimento.perfil.titulo')"
          icone="ph ph-identification-card"
          folha
        >
          <template v-if="podeEditar && perfil" #acoes>
            <Button
              icon="ph ph-pencil-simple"
              :label="t('parceiro.estabelecimento.editar')"
              severity="secondary"
              outlined
              size="small"
              @click="abrirPerfil('perfil')"
            />
          </template>

          <div v-if="!perfil" class="comeco">
            <p class="comeco__texto">
              <strong>{{ t('parceiro.estabelecimento.perfil.comecoTitulo') }}</strong>
              {{ t('parceiro.estabelecimento.perfil.comeco') }}
            </p>
            <Button
              v-if="podeEditar"
              icon="ph ph-pencil-simple"
              :label="t('parceiro.estabelecimento.perfil.preencher')"
              @click="abrirPerfil('perfil')"
            />
          </div>

          <template v-else>
            <p v-if="perfil.descricao" class="descricao">{{ perfil.descricao }}</p>
            <dl class="dados">
              <div v-for="linha in linhasDoPerfil" :key="linha.id" class="dado">
                <dt class="dado__rotulo">{{ t(`parceiro.estabelecimento.campo.${linha.id}`) }}</dt>
                <dd :class="{ dado__vazio: !linha.valor }">
                  {{ linha.valor || t('parceiro.estabelecimento.naoInformado') }}
                </dd>
              </div>
            </dl>
          </template>
        </UiSecao>

        <UiSecao
          v-if="perfil"
          :titulo="t('parceiro.estabelecimento.endereco.titulo')"
          icone="ph ph-map-pin"
          folha
        >
          <template v-if="podeEditar" #acoes>
            <Button
              icon="ph ph-pencil-simple"
              :label="t('parceiro.estabelecimento.editar')"
              severity="secondary"
              outlined
              size="small"
              @click="abrirPerfil('endereco')"
            />
          </template>

          <div class="endereco">
            <address v-if="enderecoEmLinhas.length" class="endereco__linhas">
              <span v-for="linha in enderecoEmLinhas" :key="linha">{{ linha }}</span>
            </address>
            <p v-else class="dado__vazio">{{ t('parceiro.estabelecimento.endereco.vazio') }}</p>
            <ul class="endereco__na-pagina">
              <li>
                <i
                  :class="perfil.mostrarEndereco ? 'ph ph-eye' : 'ph ph-eye-slash'"
                  aria-hidden="true"
                />
                {{
                  perfil.mostrarEndereco
                    ? t('parceiro.estabelecimento.endereco.mostraRua')
                    : t('parceiro.estabelecimento.endereco.soBairro')
                }}
              </li>
              <li>
                <i class="ph ph-map-trifold" aria-hidden="true" />
                {{ mapa }}
              </li>
            </ul>
            <Button
              v-if="linkDoMapa"
              as="a"
              :href="linkDoMapa"
              target="_blank"
              rel="noopener noreferrer"
              class="endereco__mapa"
              icon="ph ph-arrow-square-out"
              icon-pos="right"
              :label="t('parceiro.estabelecimento.endereco.conferirNoMapa')"
              severity="secondary"
              outlined
              size="small"
            />
          </div>
        </UiSecao>
      </div>

      <!-- ====================================================================== horários -->
      <div v-else class="aba">
        <UiSecao
          :titulo="t('parceiro.estabelecimento.gaveta.titulo.horarios')"
          icone="ph ph-clock"
          folha
        >
          <template v-if="podeEditar && comHorario" #acoes>
            <Button
              icon="ph ph-pencil-simple"
              :label="t('parceiro.estabelecimento.editar')"
              severity="secondary"
              outlined
              size="small"
              @click="abrirHorarios"
            />
          </template>

          <div class="horarios">
            <div v-if="comHorario" class="horarios__agora">
              <p v-if="agora" class="agora" :class="{ 'agora--aberto': agora.aberto }">
                <span class="agora__ponto" aria-hidden="true" />
                {{ agora.texto }}
              </p>
              <p v-if="fuso" class="dado__vazio">
                {{ t('parceiro.estabelecimento.horario.noFuso', { fuso: nomeDoFuso(fuso) }) }}
              </p>
            </div>

            <EstabelecimentoSemana
              v-if="comHorario"
              :horarios="estabelecimento.horarios"
              :hoje="hoje"
            />

            <div v-else class="comeco">
              <p class="comeco__texto">
                <strong>{{ t('parceiro.estabelecimento.horario.vazioTitulo') }}</strong>
                {{ t('parceiro.estabelecimento.horario.vazio') }}
              </p>
              <Button
                v-if="podeEditar"
                icon="ph ph-clock"
                :label="t('parceiro.estabelecimento.horario.cadastrar')"
                severity="secondary"
                outlined
                @click="abrirHorarios"
              />
            </div>
          </div>
        </UiSecao>

        <EstabelecimentoDiasEspeciais
          :dias="diasEspeciais"
          :hoje="hoje"
          :pode-editar="podeEditar"
          :copiando-feriados="acao === 'feriados'"
          :removendo="removendo"
          :removendo-varios="removendoVarios"
          @adicionar="abrirDia"
          @feriados="copiarFeriados"
          @remover="remover"
          @remover-varios="removerVarios"
        />
      </div>
    </div>

    <div v-else-if="!loadError" class="estabelecimento" aria-hidden="true">
      <div class="aba">
        <Skeleton height="14rem" border-radius="16px" />
        <Skeleton height="10rem" border-radius="16px" />
      </div>
    </div>

    <template #sempre>
      <EstabelecimentoPerfilGaveta
        v-model:visible="perfilAberto"
        :parte="parteAberta"
        :perfil="perfil"
        :nome-sugerido="store.parceiroNome"
        :salvando="salvandoPerfil"
        :erro="erroDoPerfil"
        @salvar="salvarParteDoPerfil"
      />
      <EstabelecimentoHorariosGaveta
        v-model:visible="horariosAbertos"
        :horarios="estabelecimento?.horarios ?? []"
        :fuso="fuso"
        :salvando="salvandoHorarios"
        :erro="erroDosHorarios"
        @salvar="salvarSemana"
      />
      <EstabelecimentoDiaGaveta
        v-model:visible="diaAberto"
        :hoje="hoje"
        :ocupadas="diasEspeciais.map((dia) => dia.data)"
        :salvando="salvandoDia"
        :erro="erroDoDia"
        @salvar="adicionarDia"
      />
      <EstabelecimentoSlugGaveta
        v-model:visible="slugAberto"
        :atual="estabelecimento?.slug ?? null"
        :salvando="salvandoSlug"
        :erro="erroDoSlug"
        @salvar="salvarSlug"
      />
      <ConfirmActionDialog
        v-model:visible="confirmarDespublicar"
        :title="t('parceiro.estabelecimento.confirmar.despublicar.titulo')"
        :message="t('parceiro.estabelecimento.confirmar.despublicar.mensagem')"
        :confirm-label="t('parceiro.estabelecimento.confirmar.despublicar.botao')"
        :cancel-label="t('parceiro.estabelecimento.confirmar.voltar')"
        severity="warn"
        @confirm="despublicar"
      />
    </template>
  </UiPagina>
</template>

<style scoped>
.estabelecimento {
  container-type: inline-size;
  display: grid;
  gap: 20px;
}

/*
 * Duas seções por aba: a principal à esquerda, mais larga, e a outra ao lado. A altura de cada uma
 * vem do conteúdo (`start`): esticar a menor só abriria um vão no pé dela.
 */
.aba {
  display: grid;
  align-items: start;
  gap: 28px;
}

@container (min-width: 960px) {
  .aba {
    grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
  }

  .aba--uma {
    grid-template-columns: minmax(0, 1fr);
  }
}

.consulta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
}

/* ------------------------------------------------------------------ dados em leitura */

.dados {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr));
  gap: 16px 24px;
  margin: 0;
  padding: 18px 20px;
}

.dados--texto {
  grid-template-columns: minmax(0, 1fr);
}

.dado {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.dado dd {
  margin: 0;
  overflow-wrap: anywhere;
  color: var(--tinta);
  font-size: 14px;
  line-height: 1.45;
  white-space: pre-line;
}

.dado__rotulo {
  color: var(--tinta-2);
  font-size: 12.5px;
  font-weight: 600;
}

.dado__vazio,
.dado dd.dado__vazio {
  margin: 0;
  color: var(--tinta-3);
  font-size: 13.5px;
  line-height: 1.45;
}

.descricao {
  max-width: 64ch;
  margin: 0;
  padding: 18px 20px 0;
  color: var(--tinta);
  font-size: 14px;
  line-height: 1.55;
  white-space: pre-line;
}

.comeco {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px 20px;
  padding: 18px 20px;
}

.horarios .comeco {
  padding: 0;
}

.comeco__texto {
  display: grid;
  gap: 4px;
  max-width: 52ch;
  margin: 0;
  color: var(--tinta-2);
  font-size: 14px;
  line-height: 1.5;
}

.comeco__texto strong {
  color: var(--tinta);
}

/* ---------------------------------------------------------------------- a página pública */

.pagina {
  display: grid;
  gap: 16px;
  padding: 18px 20px;
}

.pagina__situacao {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0;
}

.pagina__situacao > span:last-child {
  display: grid;
  gap: 2px;
}

.pagina__situacao strong {
  color: var(--tinta);
  font-size: 14.5px;
  font-weight: 650;
}

.pagina__situacao small {
  color: var(--tinta-2);
  font-size: 13px;
}

.pagina__icone {
  display: grid;
  width: 36px;
  height: 36px;
  flex: none;
  place-items: center;
  border-radius: 10px;
  background: var(--superficie-2);
  color: var(--tinta-2);
  font-size: 18px;
}

.pagina__situacao--noAr .pagina__icone {
  background: color-mix(in oklab, var(--ok-fundo, var(--superficie-2)) 80%, var(--superficie));
  color: var(--ok-tinta, var(--musgo));
}

.pagina__situacao--foraDoAr .pagina__icone {
  background: color-mix(in oklab, var(--atencao-fundo, var(--superficie-2)) 80%, var(--superficie));
  color: var(--atencao-tinta);
}

/* A lista do que a página precisa: uma linha por item, o atalho na ponta. */
.requisitos {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.requisito {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 44px;
  padding: 6px 0;
  border-top: 1px solid var(--linha);
  color: var(--tinta);
  font-size: 14px;
}

.requisito:first-child {
  border-top: 0;
}

.requisito > i {
  color: var(--atencao-tinta);
  font-size: 18px;
}

.requisito--feito {
  color: var(--tinta-2);
}

.requisito--feito > i {
  color: var(--ok-tinta, var(--musgo));
}

.requisito__nome {
  flex: 1;
  min-width: 0;
}

.requisito__estado {
  color: var(--tinta-2);
  font-size: 13px;
}

.endereco-da-pagina {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  padding-top: 14px;
  border-top: 1px solid var(--linha);
}

.endereco-da-pagina__slug {
  padding: 3px 8px;
  border-radius: 8px;
  background: var(--superficie-2);
  color: var(--tinta);
  font-family: var(--font-dados);
  font-size: 13px;
}

/* ----------------------------------------------------------------------------- endereço */

.endereco {
  display: grid;
  gap: 14px;
  padding: 18px 20px;
}

.endereco__linhas {
  display: grid;
  gap: 2px;
  color: var(--tinta);
  font-size: 14px;
  font-style: normal;
  line-height: 1.5;
}

.endereco__na-pagina {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
  color: var(--tinta-2);
  font-size: 13px;
}

.endereco__na-pagina li {
  display: flex;
  align-items: center;
  gap: 8px;
}

.endereco__mapa {
  justify-self: start;
}

/* ----------------------------------------------------------------------------- horários */

.horarios {
  display: grid;
  gap: 14px;
  padding: 18px 20px 14px;
}

.horarios__agora {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 4px 16px;
}

.agora {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--tinta);
  font-size: 14.5px;
  font-weight: 600;
}

.agora__ponto {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--tinta-3);
}

.agora--aberto .agora__ponto {
  background: var(--ok-tinta, var(--musgo));
}
</style>
