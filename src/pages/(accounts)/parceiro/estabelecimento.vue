<script setup lang="ts">
/**
 * O estabelecimento (E1-01): como a casa aparece para os responsáveis e em que horário atende.
 *
 * ## A forma
 *
 * No alto, a página pública: se está no ar, o que falta para publicar e o endereço dela. Embaixo, o
 * que a página mostra, em seções de leitura: o perfil e os contatos, o endereço, os horários da
 * semana, os dias especiais e as mensagens ao responsável. Cada seção edita na sua gaveta, uma por
 * vez, e "Publicar" fica no alto da tela, porque é a ação desta tela.
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
import Menu from 'primevue/menu'
import Skeleton from 'primevue/skeleton'
import { useToast } from 'primevue/usetoast'
import type { MenuItem } from 'primevue/menuitem'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import ConfirmActionDialog from '@/components/common/ConfirmActionDialog.vue'
import EstabelecimentoDiaGaveta from '@/components/parceiro/estabelecimento/EstabelecimentoDiaGaveta.vue'
import EstabelecimentoHorariosGaveta from '@/components/parceiro/estabelecimento/EstabelecimentoHorariosGaveta.vue'
import EstabelecimentoPerfilGaveta, {
  type ParteDoPerfil,
} from '@/components/parceiro/estabelecimento/EstabelecimentoPerfilGaveta.vue'
import EstabelecimentoSlugGaveta from '@/components/parceiro/estabelecimento/EstabelecimentoSlugGaveta.vue'
import {
  dataCivil,
  dataDoInstante,
  faixasDoDia,
  hojeNoFuso,
  horaDoInstante,
  nomeDoFuso,
  offsetDoFuso,
  semanaCompleta,
  temHorario,
} from '@/components/parceiro/estabelecimento/horario'
import UiPagina from '@/components/ui/UiPagina.vue'
import UiSecao from '@/components/ui/UiSecao.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { INTL_LOCALE, type Locale } from '@/i18n/locales'
import { ApiError } from '@/service/api'
import {
  copiarFeriadosNacionais,
  criarDiaEspecial,
  despublicarEstabelecimento,
  obterEstabelecimento,
  publicarEstabelecimento,
  removerDiaEspecial,
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

const { t, locale } = useI18n()
const toast = useToast()
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

/* ---------------------------------------------------------------------- a página pública */

type Situacao = 'noAr' | 'foraDoAr' | 'naoPublicada'

const situacao = computed<Situacao>(() => {
  if (estabelecimento.value?.visivelPublicamente) return 'noAr'
  if (perfil.value?.publicado) return 'foraDoAr'

  return 'naoPublicada'
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

/** Segunda primeiro, domingo por último, como a semana de quem atende. */
const ORDEM_DA_SEMANA = [1, 2, 3, 4, 5, 6, 0] as const
const UM_DOMINGO = '2026-10-18'

function nomeDoDia(diaSemana: number, formato: 'long' | 'short' = 'long') {
  const data = dataCivil(UM_DOMINGO)
  data.setUTCDate(data.getUTCDate() + diaSemana)

  const nome = data.toLocaleDateString(intl.value, { weekday: formato, timeZone: 'UTC' })

  return nome.charAt(0).toLocaleUpperCase() + nome.slice(1)
}

const semana = computed(() => {
  const dias = semanaCompleta(estabelecimento.value?.horarios ?? [])

  return ORDEM_DA_SEMANA.map((diaSemana) => {
    const dia = dias.find((item) => item.diaSemana === diaSemana)!

    return { diaSemana, nome: nomeDoDia(diaSemana), faixas: faixasDoDia(dia) }
  })
})

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

const diasEspeciais = computed(() =>
  [...(estabelecimento.value?.diasEspeciais ?? [])].sort((um, outro) =>
    um.data.localeCompare(outro.data),
  ),
)

function dataDoDia(dia: DiaEspecial) {
  return dataCivil(dia.data).toLocaleDateString(intl.value, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: dia.data.slice(0, 4) === hoje.value.slice(0, 4) ? undefined : 'numeric',
    timeZone: 'UTC',
  })
}

const diaParaRemover = ref<DiaEspecial | null>(null)
const confirmarRemocao = ref(false)
const removendo = ref<string | null>(null)

function pedirRemocao(dia: DiaEspecial) {
  diaParaRemover.value = dia
  confirmarRemocao.value = true
}

async function remover() {
  const dia = diaParaRemover.value

  if (!dia) return

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

const menuDeFeriados = ref<InstanceType<typeof Menu> | null>(null)

/** O catálogo da API tem o ano corrente e o próximo; outro ano ela recusa. */
const anosDeFeriado = computed(() => {
  const ano = Number(hoje.value.slice(0, 4))

  return [ano, ano + 1]
})

const itensDeFeriado = computed<MenuItem[]>(() =>
  anosDeFeriado.value.map((ano) => ({
    label: t('parceiro.estabelecimento.dia.feriadosDe', { ano }),
    icon: 'ph ph-calendar-check',
    command: () => void copiarFeriados(ano),
  })),
)

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
    largura="leitura"
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

      <!-- ------------------------------------------------------------- a página pública -->
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
            </span>
          </p>

          <div v-if="situacao === 'naoPublicada' && pendencias.length > 0" class="falta">
            <p class="falta__titulo">{{ t('parceiro.estabelecimento.pagina.falta') }}</p>
            <ul class="falta__lista">
              <li v-for="pendencia in pendencias" :key="pendencia">
                <i class="ph ph-circle-dashed" aria-hidden="true" />
                <span>{{ t(`parceiro.estabelecimento.pendencia.${pendencia}`) }}</span>
              </li>
            </ul>
          </div>

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

      <!-- ------------------------------------------------------------ perfil e contatos -->
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

      <!--
        Endereço e mensagens só existem depois do perfil: o salvamento deles leva o nome e o fuso
        junto, e duas caixas dizendo "preencha o perfil primeiro" só repetiam o que o perfil já diz.
      -->
      <!-- --------------------------------------------------------------------- endereço -->
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
        </div>
      </UiSecao>

      <!-- --------------------------------------------------------------------- horários -->
      <UiSecao :titulo="t('parceiro.estabelecimento.horario.titulo')" icone="ph ph-clock" folha>
        <template v-if="podeEditar" #acoes>
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
          <p v-if="agora" class="agora" :class="{ 'agora--aberto': agora.aberto }">
            <span class="agora__ponto" aria-hidden="true" />
            {{ agora.texto }}
          </p>
          <p v-if="fuso" class="dado__vazio">
            {{ t('parceiro.estabelecimento.horario.noFuso', { fuso: nomeDoFuso(fuso) }) }}
          </p>

          <p v-if="!comHorario" class="dado__vazio">
            {{ t('parceiro.estabelecimento.horario.vazio') }}
          </p>
          <dl v-else class="semana">
            <div v-for="dia in semana" :key="dia.diaSemana" class="semana__dia">
              <dt>{{ dia.nome }}</dt>
              <dd v-if="dia.faixas.length" class="ui-num">{{ dia.faixas.join(' · ') }}</dd>
              <dd v-else class="dado__vazio">
                {{ t('parceiro.estabelecimento.horario.fechado') }}
              </dd>
            </div>
          </dl>
        </div>
      </UiSecao>

      <!-- --------------------------------------------------------------- dias especiais -->
      <UiSecao
        :titulo="t('parceiro.estabelecimento.dia.titulo')"
        :contagem="diasEspeciais.length || null"
        icone="ph ph-calendar-star"
        folha
      >
        <template v-if="podeEditar" #acoes>
          <Button
            icon="ph ph-flag"
            :label="t('parceiro.estabelecimento.dia.feriados')"
            severity="secondary"
            outlined
            size="small"
            aria-haspopup="true"
            aria-controls="menu-feriados"
            :loading="acao === 'feriados'"
            @click="menuDeFeriados?.toggle($event)"
          />
          <Menu id="menu-feriados" ref="menuDeFeriados" :model="itensDeFeriado" popup />
          <Button
            icon="ph ph-plus"
            :label="t('parceiro.estabelecimento.dia.adicionar')"
            severity="secondary"
            outlined
            size="small"
            @click="abrirDia"
          />
        </template>

        <p v-if="diasEspeciais.length === 0" class="dado__vazio">
          {{ t('parceiro.estabelecimento.dia.vazio') }}
        </p>
        <ul v-else class="especiais">
          <li
            v-for="dia in diasEspeciais"
            :key="dia.id"
            class="especial"
            :class="{ 'especial--passou': dia.data < hoje }"
          >
            <span class="especial__data ui-num">{{ dataDoDia(dia) }}</span>
            <span class="especial__nome">{{ dia.nome }}</span>
            <span class="especial__horario ui-num">
              {{
                dia.fechado
                  ? t('parceiro.estabelecimento.horario.fechado')
                  : faixasDoDia(dia).join(' · ')
              }}
            </span>
            <Button
              v-if="podeEditar"
              icon="ph ph-trash"
              severity="secondary"
              outlined
              size="small"
              :aria-label="t('parceiro.estabelecimento.dia.remover', { nome: dia.nome })"
              :title="t('parceiro.estabelecimento.dia.remover', { nome: dia.nome })"
              :loading="removendo === dia.id"
              @click="pedirRemocao(dia)"
            />
          </li>
        </ul>
      </UiSecao>

      <!-- -------------------------------------------------------------------- mensagens -->
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
            <dd :class="{ dado__vazio: !perfil[campo] }">
              {{ perfil[campo] || t('parceiro.estabelecimento.naoInformado') }}
            </dd>
          </div>
        </dl>
      </UiSecao>
    </div>

    <div v-else-if="!loadError" class="estabelecimento" aria-hidden="true">
      <Skeleton v-for="n in 3" :key="n" height="9rem" border-radius="16px" />
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
      <ConfirmActionDialog
        v-model:visible="confirmarRemocao"
        :title="t('parceiro.estabelecimento.confirmar.remover.titulo')"
        :message="
          t('parceiro.estabelecimento.confirmar.remover.mensagem', {
            nome: diaParaRemover?.nome ?? '',
          })
        "
        :confirm-label="t('parceiro.estabelecimento.confirmar.remover.botao')"
        :cancel-label="t('parceiro.estabelecimento.confirmar.voltar')"
        severity="danger"
        @confirm="remover"
      />
    </template>
  </UiPagina>
</template>

<style scoped>
.estabelecimento {
  display: grid;
  gap: 28px;
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
  grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
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

.secao__corpo > .dado__vazio,
:deep(.secao__corpo) > .dado__vazio {
  padding: 18px 20px;
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

.falta {
  display: grid;
  gap: 8px;
}

.falta__titulo {
  margin: 0;
  color: var(--tinta);
  font-size: 13.5px;
  font-weight: 600;
}

.falta__lista {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.falta__lista li {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--tinta-2);
  font-size: 13.5px;
}

.falta__lista i {
  color: var(--atencao-tinta);
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
  gap: 12px;
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

/* ----------------------------------------------------------------------------- horários */

.horarios {
  display: grid;
  gap: 12px;
  padding: 18px 20px;
}

.agora {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--tinta);
  font-size: 14px;
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

.semana {
  display: grid;
  gap: 0;
  margin: 0;
}

.semana__dia {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 8px 0;
  border-top: 1px solid var(--linha);
  font-size: 14px;
}

.semana__dia:first-child {
  border-top: 0;
}

.semana__dia dt {
  color: var(--tinta);
}

.semana__dia dd {
  margin: 0;
  color: var(--tinta);
  text-align: end;
}

/* ------------------------------------------------------------------------ dias especiais */

.especiais {
  display: grid;
  margin: 0;
  padding: 6px 20px;
  list-style: none;
}

.especial {
  display: grid;
  grid-template-columns: 9rem minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-top: 1px solid var(--linha);
  font-size: 14px;
}

.especial:first-child {
  border-top: 0;
}

.especial__data {
  color: var(--tinta-2);
  font-size: 13px;
}

.especial__nome {
  overflow: hidden;
  color: var(--tinta);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.especial__horario {
  color: var(--tinta-2);
  font-size: 13px;
}

.especial--passou {
  opacity: 0.6;
}
</style>
