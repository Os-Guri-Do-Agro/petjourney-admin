<script setup lang="ts">
/**
 * O atendimento pela API (E4-01, PJ-QQT1WN; guia e4 5). A tela em que o veterinário passa a
 * consulta: uma seção por vez (anamnese, exame físico, diagnóstico, conduta), cada uma na sua
 * caixa, com o autosave e o lock da aba (`useEdicaoDoAtendimento`).
 *
 * - **Rascunho**: edita; "Revisar e finalizar" mostra o que vai ao responsável e pede a senha.
 *   Descartar vale para o rascunho em que ninguém gravou; com conteúdo, o caminho é anular.
 * - **Em outra aba**: leitura com "Assumir edição". Perdida no meio, o que esta aba digitou fica
 *   guardado e volta ao assumir.
 * - **Finalizado**: leitura, com o retrato do paciente no ato, quem assinou, os adendos (o jeito
 *   de corrigir) e o resumo para o app (liberar).
 * - **Anulado**: leitura, com o motivo.
 *
 * A recepção não chega aqui (a rota pede `prontuario.ler`); a enfermagem lê.
 */
import Button from 'primevue/button'
import Menu from 'primevue/menu'
import SelectButton from 'primevue/selectbutton'
import { useToast } from 'primevue/usetoast'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { onBeforeRouteLeave, RouterLink, useRoute, useRouter } from 'vue-router'

import DesfazerNaAgenda from '@/components/agendamentos/DesfazerNaAgenda.vue'
import { lerErroDaAgenda } from '@/components/agendamentos/useFrasesDaAgenda'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useRotulosDoCadastro } from '@/components/cadastro/useRotulosDoCadastro'
import UiPagina from '@/components/ui/UiPagina.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { invalidarPendenciasDoPortal } from '@/composables/usePendenciasDoPortal'
import { motivoDaRecusa, useSeloDeAssinatura } from '@/composables/useSeloDeAssinatura'
import { novaChaveDeIdempotencia } from '@/service/idempotencia'
import { listarTipos, type TipoDeAtendimento } from '@/service/parceiro/agenda-config-service'
import { DESFAZER_NA_TELA_MS, desfazerNaAgenda } from '@/service/parceiro/agenda-service'
import {
  descartarAtendimento,
  liberarResumo,
  marcarRetorno,
  type Atendimento,
  type Ato,
  type SecaoDoAtendimento,
} from '@/service/parceiro/atendimentos-service'

import AdendoGaveta from './AdendoGaveta.vue'
import AnamneseDoAtendimento from './AnamneseDoAtendimento.vue'
import AnularAtendimentoGaveta from './AnularAtendimentoGaveta.vue'
import AnularAtoGaveta from './AnularAtoGaveta.vue'
import AtoGaveta from './AtoGaveta.vue'
import CondutaDoAtendimento from './CondutaDoAtendimento.vue'
import DiagnosticoDoAtendimento from './DiagnosticoDoAtendimento.vue'
import ExameDoAtendimento from './ExameDoAtendimento.vue'
import FinalizarAtendimentoGaveta from './FinalizarAtendimentoGaveta.vue'
import PreConsultaNoAtendimento from './PreConsultaNoAtendimento.vue'
import { SECOES } from './rascunho-do-atendimento'
import { useEdicaoDoAtendimento } from './useEdicaoDoAtendimento'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const rotulos = useRotulosDoCadastro()
const selo = useSeloDeAssinatura()
const { store, parceiroQuery } = useParceiroPortal()

const id = computed(() => String(route.params.encounterId ?? ''))

const clinicaEscreve = computed(() => Boolean(store.modulo('CLINICA')?.podeEscrever))
const podeEscrever = computed(
  () => clinicaEscreve.value && store.temPermissao('prontuario.escrever'),
)
const podeFinalizar = computed(
  () => clinicaEscreve.value && store.temPermissao('prontuario.finalizar'),
)
const podeLiberar = computed(() => clinicaEscreve.value && store.temPermissao('resumo.liberar'))
const podeMarcarRetorno = computed(
  () => clinicaEscreve.value && store.temPermissao('agenda.escrever'),
)

const edicao = useEdicaoDoAtendimento(id, { parceiroQuery, podeEscrever })
const { atendimento, rascunho, gravacao } = edicao

const somenteLeitura = computed(() => !edicao.editando.value)

/* ------------------------------------------------------------------------- as seções */

const secao = computed<SecaoDoAtendimento>(() => {
  const valor = route.query.secao
  return SECOES.find((item) => item === valor) ?? 'ANAMNESE'
})

function irPara(valor: SecaoDoAtendimento) {
  const query = { ...route.query }
  if (valor === 'ANAMNESE') delete query.secao
  else query.secao = valor
  void router.replace({ query })
}

/** O que o finalizar apontou: a seção ganha a marca e o campo, o aviso. */
const faltam = ref<string[]>([])
const faltaNa = (codigo: string) => faltam.value.includes(codigo)

const opcoesDeSecao = computed(() =>
  SECOES.map((valor) => {
    const falta =
      (valor === 'ANAMNESE' && faltaNa('QUEIXA')) ||
      (valor === 'DIAGNOSTICO' && faltaNa('DIAGNOSTICO')) ||
      (valor === 'CONDUTA' && faltaNa('CONDUTA'))
    return { valor, rotulo: t(`atendimento.secao.${valor}`), falta }
  }),
)

const anamnese = ref<InstanceType<typeof AnamneseDoAtendimento> | null>(null)

/* --------------------------------------------------------------------------- o cabeçalho */

const paciente = computed(() => {
  const a = atendimento.value
  if (!a) return null
  /* O registro fechado mostra o paciente como estava no ato. */
  return a.retrato ? { ...a.paciente, ...a.retrato } : a.paciente
})

const titulo = computed(() => paciente.value?.nome ?? '')

const resumo = computed(() => {
  const a = atendimento.value
  const p = paciente.value
  if (!a || !p) return ''
  return [
    t(`agenda.config.tipo.kind.${a.tipo}`),
    `${rotulos.dia(a.dataDoAtendimento)} ${a.realizadoEm.slice(11, 16)}`,
    a.profissional.nome,
    rotulos.especie(p),
    p.nascimento ? rotulos.idade(p.nascimento) : '',
    p.pesoKg ? rotulos.peso(p.pesoKg) : '',
  ]
    .filter(Boolean)
    .join(' · ')
})

const fraseDaGravacao = computed(() => {
  switch (gravacao.situacao) {
    case 'salvando':
      return t('atendimento.gravacao.salvando')
    case 'pendente':
      return t('atendimento.gravacao.pendente')
    case 'falhou':
      return gravacao.secaoComErro
        ? t('atendimento.gravacao.falhou', {
            secao: t(`atendimento.secao.${gravacao.secaoComErro}`),
          })
        : t('atendimento.gravacao.falhouGeral')
    default:
      return gravacao.ultimaEm
        ? t('atendimento.gravacao.salvoAs', {
            hora: gravacao.ultimaEm.toTimeString().slice(0, 5),
          })
        : t('atendimento.gravacao.salvo')
  }
})

const erroDaGravacao = computed(() =>
  gravacao.erro
    ? lerErroDoCadastro(gravacao.erro, t('atendimento.gravacao.falhouGeral')).mensagem
    : '',
)

const erroDaLeitura = computed(() =>
  edicao.erroDeLeitura.value
    ? lerErroDoCadastro(edicao.erroDeLeitura.value, t('atendimento.erro.carregar')).mensagem
    : '',
)

/* ------------------------------------------------------------------------------ faixas */

const lock = computed(() => edicao.edicao.lock)

function quem() {
  const l = lock.value
  return {
    rotulo: l?.dispositivoRotulo ?? t('atendimento.faixa.outraAba'),
    nome: l?.profissionalNome ?? t('atendimento.faixa.alguem'),
    desde: l?.desde ? l.desde.slice(11, 16) : '',
  }
}

const faixa = computed(() => {
  const a = atendimento.value
  if (!a) return null
  if (a.status === 'ANULADO') {
    return {
      tom: 'risco',
      icone: 'ph ph-prohibit',
      titulo: t('atendimento.faixa.anulado', {
        dia: a.anuladoEm ? rotulos.dia(a.anuladoEm.slice(0, 10)) : '',
      }),
      texto: a.motivoAnulacao ?? '',
    }
  }
  if (a.status === 'FINALIZADO') {
    const quemFinalizou = a.autores.find((autor) => autor.papel === 'FINALIZOU')
    return {
      tom: 'ok',
      icone: 'ph ph-seal-check',
      titulo: t('atendimento.faixa.finalizado', {
        dia: a.finalizadoEm ? rotulos.dia(a.finalizadoEm.slice(0, 10)) : '',
        nome: quemFinalizou?.nome ?? a.profissional.nome,
      }),
      texto: t('atendimento.faixa.finalizadoTexto'),
    }
  }
  if (edicao.perda.value) {
    return {
      tom: 'atencao',
      icone: 'ph ph-lock-simple',
      titulo: t('atendimento.faixa.perdeu', quem()),
      texto: t('atendimento.faixa.guardado'),
      assumir: podeEscrever.value,
    }
  }
  if (edicao.edicao.motivoSomenteLeitura === 'OUTRO_DISPOSITIVO') {
    return {
      tom: 'atencao',
      icone: 'ph ph-lock-simple',
      titulo: t('atendimento.faixa.emOutra', quem()),
      texto: t('atendimento.faixa.emOutraTexto'),
      assumir: podeEscrever.value,
    }
  }
  if (!podeEscrever.value || edicao.edicao.motivoSomenteLeitura === 'SEM_PERMISSAO_DE_ESCRITA') {
    return {
      tom: '',
      icone: 'ph ph-eye',
      titulo: t('atendimento.faixa.leitura'),
      texto: t('atendimento.faixa.leituraTexto'),
    }
  }
  return null
})

async function assumir() {
  try {
    await edicao.assumir()
    toast.add({ severity: 'success', summary: t('atendimento.faixa.assumida'), life: 3000 })
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: lerErroDoCadastro(err, t('atendimento.faixa.erroAssumir')).mensagem,
      life: 6000,
    })
  }
}

/* --------------------------------------------------------------------------- as ações */

const finalizarAberto = ref(false)
const anularAberto = ref(false)
const avisoDoAnular = ref('')
const adendoAberto = ref(false)
const atoAberto = ref(false)
const atoParaAnular = ref<{ id: string; descricao: string } | null>(null)
const anularAtoAberto = ref(false)
const menu = ref<InstanceType<typeof Menu> | null>(null)

const descartando = ref(false)

async function descartar() {
  const a = atendimento.value
  if (!a) return
  descartando.value = true
  try {
    await descartarAtendimento(a.id, parceiroQuery())
    invalidarPendenciasDoPortal()
    toast.add({ severity: 'success', summary: t('atendimento.descartar.feito'), life: 3000 })
    void router.push(a.agendamentoId ? '/clinica/agenda' : '/clinica/atendimentos')
  } catch (err) {
    const lido = lerErroDoCadastro(err, t('atendimento.descartar.erro'))
    if (lido.codigo === 'ATENDIMENTO_COM_CONTEUDO') {
      /* Com conteúdo (ou uma gravação da escuta), o caminho é anular com motivo (guia 15.1). */
      avisoDoAnular.value = t('atendimento.descartar.comConteudo')
      anularAberto.value = true
      return
    }
    toast.add({ severity: 'error', summary: lido.mensagem, life: 6000 })
  } finally {
    descartando.value = false
  }
}

const itensDoMenu = computed(() => {
  const a = atendimento.value
  if (!a) return []
  const itens: { label: string; icon: string; command: () => void }[] = []
  if (a.status === 'RASCUNHO' && edicao.editando.value) {
    itens.push({
      label: t('atendimento.descartar.acao'),
      icon: 'ph ph-trash',
      command: () => void descartar(),
    })
  }
  if (a.status !== 'ANULADO' && podeFinalizar.value) {
    itens.push({
      label: t('atendimento.anular.acao'),
      icon: 'ph ph-prohibit',
      command: () => {
        avisoDoAnular.value = ''
        anularAberto.value = true
      },
    })
  }
  return itens
})

function finalizado(novo: Atendimento) {
  edicao.substituir(novo)
  faltam.value = []
  invalidarPendenciasDoPortal()
  toast.add({ severity: 'success', summary: t('atendimento.finalizar.feito'), life: 4000 })
}

function anulado(novo: Atendimento) {
  edicao.substituir(novo)
  invalidarPendenciasDoPortal()
  toast.add({ severity: 'success', summary: t('atendimento.anular.feito'), life: 4000 })
}

function mostrarFaltas(lista: string[]) {
  faltam.value = lista
}

/* -------------------------------------------------------------------- resumo e adendo */

const liberando = ref(false)

async function liberar() {
  const a = atendimento.value
  if (!a) return
  liberando.value = true
  try {
    const resposta = await liberarResumo(a.id, parceiroQuery())
    toast.add({
      severity: resposta.publicado ? 'success' : 'warn',
      summary: resposta.publicado
        ? t('atendimento.resumo.publicado')
        : t(`atendimento.resumo.motivo.${resposta.motivo ?? 'SEM_VINCULO'}`),
      life: 5000,
    })
    invalidarPendenciasDoPortal()
    await edicao.reler()
  } catch (err) {
    const motivo = motivoDaRecusa(err)
    toast.add({
      severity: 'error',
      summary: motivo
        ? t(`atendimento.selo.${motivo}`)
        : lerErroDoCadastro(err, t('atendimento.resumo.erro')).mensagem,
      life: 6000,
    })
  } finally {
    liberando.value = false
  }
}

const fraseDoResumo = computed(() => {
  const r = atendimento.value?.resumo
  if (!r) return ''
  if (r.publicado && r.liberadoEm) {
    return t('atendimento.resumo.liberadoEm', { dia: rotulos.dia(r.liberadoEm.slice(0, 10)) })
  }
  if (r.motivoNaoPublicado) return t(`atendimento.resumo.motivo.${r.motivoNaoPublicado}`)
  return t('atendimento.resumo.naoLiberado')
})

function adendoCriado() {
  toast.add({ severity: 'success', summary: t('atendimento.adendo.feito'), life: 3000 })
  void edicao.reler()
}

/* ------------------------------------------------------------------------------- atos */

function atoRegistrado(ato: Ato) {
  edicao.versaoDoAto(ato.versaoDoAtendimento)
  toast.add({ severity: 'success', summary: t('atendimento.atos.feito'), life: 3000 })
  void edicao.reler()
}

function anularUmAto(ato: { id: string; descricao: string }) {
  atoParaAnular.value = ato
  anularAtoAberto.value = true
}

function atoAnulado(ato: Ato) {
  edicao.versaoDoAto(ato.versaoDoAtendimento)
  void edicao.reler()
}

const podeAnularAto = computed(() => {
  const a = atendimento.value
  if (!a || a.status === 'ANULADO') return false
  return a.status === 'RASCUNHO' ? edicao.editando.value : podeFinalizar.value
})

/* ---------------------------------------------------------------------------- retorno */

const tipos = ref<TipoDeAtendimento[]>([])
const marcando = ref(false)
const feito = ref<{ texto: string; token: string; ate: number } | null>(null)
const desfazendo = ref(false)

async function marcar() {
  const a = atendimento.value
  if (!a) return
  marcando.value = true
  try {
    const mutacao = await marcarRetorno(a.id, {}, novaChaveDeIdempotencia(), parceiroQuery())
    const horario = mutacao.agendamentos.find((item) => item.id === mutacao.id)
    feito.value = mutacao.desfazerToken
      ? {
          texto: t('atendimento.retornos.marcado', {
            pet: a.paciente.nome,
            quando: horario
              ? `${rotulos.dia(horario.inicio.slice(0, 10))} ${horario.inicio.slice(11, 16)}`
              : '',
          }),
          token: mutacao.desfazerToken,
          ate: Date.now() + DESFAZER_NA_TELA_MS,
        }
      : null
    invalidarPendenciasDoPortal()
    await edicao.reler()
  } catch (err) {
    const lido = lerErroDaAgenda(err, t('cadastro.erros.salvar'))
    const frase =
      lido.codigo === 'RETORNO_SEM_HORARIO'
        ? t('atendimento.retornos.semHorarioNoAtendimento')
        : lido.codigo === 'RETORNO_NAO_DEFINIDO'
          ? t('atendimento.retornos.naoDefinidoNoAtendimento')
          : lido.mensagem
    toast.add({ severity: 'warn', summary: frase, life: 7000 })
  } finally {
    marcando.value = false
  }
}

async function desfazer() {
  const atual = feito.value
  if (!atual) return
  desfazendo.value = true
  try {
    await desfazerNaAgenda(atual.token, parceiroQuery())
    feito.value = null
    invalidarPendenciasDoPortal()
    await edicao.reler()
  } catch (err) {
    feito.value = null
    const lido = lerErroDaAgenda(err, t('agendamentos.erros.salvar'))
    toast.add({
      severity: 'warn',
      summary:
        lido.codigo === 'DESFAZER_EXPIRADO' ? t('agendamentos.desfazer.expirado') : lido.mensagem,
      life: 6000,
    })
  } finally {
    desfazendo.value = false
  }
}

/* --------------------------------------------------------------------------- ciclo */

onMounted(async () => {
  await edicao.carregar()
  if (podeEscrever.value) {
    tipos.value = await listarTipos({ ...parceiroQuery(), ativos: true }).catch(() => [])
  }
})

/* Sair com algo por gravar: grava antes (até 4 s), sem prender a pessoa na tela. */
onBeforeRouteLeave(async () => {
  if (!edicao.editando.value) return true
  await Promise.race([edicao.esperarGravar(), new Promise((r) => setTimeout(r, 4000))])
  return true
})

const voltar = computed(() =>
  atendimento.value?.agendamentoId && route.query.de === 'agenda'
    ? { to: '/clinica/agenda', rotulo: t('atendimento.voltarAgenda') }
    : { to: '/clinica/atendimentos', rotulo: t('atendimento.voltar') },
)

const aguardaSelo = computed(
  () =>
    atendimento.value?.status === 'RASCUNHO' &&
    podeFinalizar.value &&
    selo.permissaoAguarda('prontuario.finalizar'),
)
</script>

<template>
  <UiPagina
    :titulo="titulo"
    :resumo="resumo"
    icone="ph ph-stethoscope"
    :carregando="edicao.carregando.value && !atendimento"
    :erro="atendimento ? '' : erroDaLeitura"
    bloquear-se-suspenso
    @tentar-de-novo="edicao.carregar"
  >
    <template #voltar>
      <RouterLink :to="voltar.to" class="ad__voltar">
        <i class="ph ph-arrow-left" aria-hidden="true" />
        {{ voltar.rotulo }}
      </RouterLink>
    </template>

    <template v-if="atendimento" #acoes>
      <Button
        v-if="itensDoMenu.length"
        type="button"
        icon="ph ph-dots-three"
        :label="t('atendimento.mais')"
        severity="secondary"
        outlined
        aria-haspopup="menu"
        :loading="descartando"
        @click="menu?.toggle($event)"
      />
      <Menu ref="menu" :model="itensDoMenu" popup />
      <template v-if="atendimento.status === 'FINALIZADO'">
        <Button
          v-if="podeFinalizar"
          type="button"
          icon="ph ph-note"
          severity="secondary"
          outlined
          :label="t('atendimento.adendo.acao')"
          @click="adendoAberto = true"
        />
        <Button
          v-if="podeLiberar && !atendimento.resumo.publicado"
          type="button"
          icon="ph ph-paper-plane-tilt"
          :label="t('atendimento.resumo.liberar')"
          :loading="liberando"
          @click="liberar"
        />
      </template>
      <Button
        v-else-if="atendimento.status === 'RASCUNHO' && podeFinalizar && edicao.editando.value"
        type="button"
        icon="ph ph-check-circle"
        :label="t('atendimento.finalizar.acao')"
        :title="aguardaSelo ? t(`atendimento.selo.${selo.motivo.value ?? 'SEM_SELO'}`) : undefined"
        @click="finalizarAberto = true"
      />
    </template>

    <div v-if="atendimento && rascunho" class="ad">
      <!-- O estado do registro: fechado, anulado, em outra aba ou só leitura. -->
      <section
        v-if="faixa"
        class="ui-folha ad__faixa"
        :class="faixa.tom ? `ad__faixa--${faixa.tom}` : ''"
        role="status"
      >
        <i :class="faixa.icone" class="ad__faixa-icone" aria-hidden="true" />
        <span class="ad__faixa-texto">
          <strong>{{ faixa.titulo }}</strong>
          <span v-if="faixa.texto">{{ faixa.texto }}</span>
          <span v-if="atendimento.status === 'FINALIZADO'" class="ad__resumo">
            <i class="ph ph-device-mobile" aria-hidden="true" />
            {{ fraseDoResumo }}
          </span>
        </span>
        <Button
          v-if="'assumir' in faixa && faixa.assumir"
          type="button"
          size="small"
          severity="secondary"
          outlined
          icon="ph ph-hand-grabbing"
          :label="t('atendimento.faixa.assumir')"
          :loading="edicao.assumindo.value"
          @click="assumir"
        />
      </section>

      <!-- As seções, uma por vez; o estado do autosave ao lado. -->
      <div class="ad__barra">
        <SelectButton
          :model-value="secao"
          :options="opcoesDeSecao"
          option-label="rotulo"
          option-value="valor"
          :allow-empty="false"
          :aria-label="t('atendimento.secoes')"
          @update:model-value="irPara"
        >
          <template #option="{ option }">
            <span class="ad__aba">
              <i
                v-if="option.falta"
                class="ph ph-warning-circle ad__aba-falta"
                aria-hidden="true"
              />
              {{ option.rotulo }}
            </span>
          </template>
        </SelectButton>

        <span
          v-if="edicao.editando.value || gravacao.situacao === 'falhou'"
          class="ad__gravacao"
          :class="{ 'ad__gravacao--falhou': gravacao.situacao === 'falhou' }"
          aria-live="polite"
        >
          <i
            :class="
              gravacao.situacao === 'salvando'
                ? 'ph ph-circle-notch ph-spin'
                : gravacao.situacao === 'falhou'
                  ? 'ph ph-cloud-slash'
                  : 'ph ph-cloud-check'
            "
            aria-hidden="true"
          />
          <span :title="erroDaGravacao || undefined">{{ fraseDaGravacao }}</span>
          <Button
            v-if="gravacao.situacao === 'falhou' && edicao.editando.value"
            type="button"
            size="small"
            severity="secondary"
            outlined
            :label="t('atendimento.gravacao.tentarDeNovo')"
            @click="edicao.tentarDeNovo"
          />
        </span>
      </div>
      <p v-if="erroDaGravacao" class="ad__erro" role="alert">{{ erroDaGravacao }}</p>

      <!-- A consulta anterior: o que o veterinário relê antes de começar. -->
      <p v-if="atendimento.consultaAnterior && secao === 'ANAMNESE'" class="ad__anterior">
        <i class="ph ph-clock-counter-clockwise" aria-hidden="true" />
        <span>
          {{
            [
              t('atendimento.anterior', { dia: rotulos.dia(atendimento.consultaAnterior.data) }),
              atendimento.consultaAnterior.queixa,
              atendimento.consultaAnterior.diagnosticoPrincipal,
              atendimento.consultaAnterior.pesoKg
                ? rotulos.peso(atendimento.consultaAnterior.pesoKg)
                : '',
            ]
              .filter(Boolean)
              .join(' · ')
          }}
        </span>
        <RouterLink :to="`/clinica/atendimento/${atendimento.consultaAnterior.id}`">
          {{ t('atendimento.abrirAnterior') }}
        </RouterLink>
      </p>

      <template v-if="secao === 'ANAMNESE'">
        <PreConsultaNoAtendimento
          v-if="atendimento.preConsulta"
          :pre-consulta="atendimento.preConsulta"
          :agendamento-id="atendimento.agendamentoId"
          :data-do-atendimento="atendimento.dataDoAtendimento"
          :somente-leitura="somenteLeitura"
          :vazios="anamnese?.vaziosComSugestao.length ?? 0"
          @usar-vazios="anamnese?.usarVazios()"
        />
        <AnamneseDoAtendimento
          ref="anamnese"
          v-model="rascunho.anamnese"
          :somente-leitura="somenteLeitura"
          :pre-consulta="atendimento.preConsulta"
          :falta-queixa="faltaNa('QUEIXA')"
        />
      </template>
      <ExameDoAtendimento
        v-else-if="secao === 'EXAME_FISICO'"
        v-model="rascunho.exame"
        :somente-leitura="somenteLeitura"
        :servidor="atendimento.exameFisico"
        :peso-de-casa="atendimento.pesoDeCasa"
      />
      <DiagnosticoDoAtendimento
        v-else-if="secao === 'DIAGNOSTICO'"
        v-model="rascunho.diagnostico"
        :somente-leitura="somenteLeitura"
        :falta-diagnostico="faltaNa('DIAGNOSTICO')"
      />
      <CondutaDoAtendimento
        v-else
        v-model="rascunho.conduta"
        :somente-leitura="somenteLeitura"
        :tipos="tipos"
        :atos="atendimento.atos"
        :data-do-atendimento="atendimento.dataDoAtendimento"
        :retorno-agendamento-id="atendimento.conduta.retornoAgendamentoId"
        :retorno-gravado="
          atendimento.conduta.retornoTipoId ? atendimento.conduta.retornoEmDias : null
        "
        :pode-marcar-retorno="podeMarcarRetorno && atendimento.status !== 'ANULADO'"
        :marcando-retorno="marcando"
        :pode-registrar-ato="atendimento.status === 'RASCUNHO' && edicao.editando.value"
        :pode-anular-ato="podeAnularAto"
        :falta-conduta="faltaNa('CONDUTA')"
        @registrar-ato="atoAberto = true"
        @anular-ato="anularUmAto"
        @marcar-retorno="marcar"
      />

      <!-- O registro fechado: quem assinou e os adendos. -->
      <section
        v-if="atendimento.status !== 'RASCUNHO'"
        class="ui-folha ui-cartao"
        aria-labelledby="ad-registro"
      >
        <header class="ui-cartao__cabeca">
          <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-signature" /></span>
          <span class="ui-cartao__titulos">
            <h2 id="ad-registro" class="ui-cartao__titulo">
              {{ t('atendimento.registro.titulo') }}
            </h2>
            <p class="ui-cartao__descricao">{{ t('atendimento.registro.descricao') }}</p>
          </span>
        </header>
        <ul class="ui-lista">
          <li v-for="autor in atendimento.autores" :key="`${autor.papel}-${autor.profissionalId}`">
            <div class="ui-linha">
              <span class="ui-linha__texto">
                <strong class="ui-linha__titulo">{{ autor.nome }}</strong>
                <span class="ui-linha__meta">
                  {{
                    [
                      t(`atendimento.registro.papel.${autor.papel}`),
                      autor.conselho === 'CRMV' && autor.registro
                        ? `CRMV ${autor.registro}${autor.uf ? `-${autor.uf}` : ''}`
                        : '',
                      `${rotulos.dia(autor.em.slice(0, 10))} ${autor.em.slice(11, 16)}`,
                    ]
                      .filter(Boolean)
                      .join(' · ')
                  }}
                </span>
              </span>
            </div>
          </li>
          <li v-for="adendo in atendimento.adendos.itens" :key="adendo.id">
            <div class="ui-linha ad__adendo">
              <i class="ph ph-note" aria-hidden="true" />
              <span class="ui-linha__texto">
                <strong class="ui-linha__titulo">
                  {{
                    adendo.paraOResponsavel
                      ? t('atendimento.registro.adendoParaOResponsavel')
                      : t('atendimento.registro.adendoInterno')
                  }}
                </strong>
                <span class="ad__adendo-texto">{{ adendo.texto }}</span>
                <span class="ui-linha__meta">
                  {{ adendo.autor.nome }} · {{ rotulos.dia(adendo.em.slice(0, 10)) }}
                  {{ adendo.em.slice(11, 16) }}
                </span>
              </span>
            </div>
          </li>
        </ul>
        <p v-if="atendimento.adendos.total > atendimento.adendos.itens.length" class="ad__mais">
          {{
            t('atendimento.registro.maisAdendos', {
              n: atendimento.adendos.total - atendimento.adendos.itens.length,
            })
          }}
        </p>
      </section>
    </div>

    <template #sempre>
      <template v-if="atendimento && rascunho">
        <FinalizarAtendimentoGaveta
          v-model:visible="finalizarAberto"
          :atendimento="atendimento"
          :rascunho="rascunho"
          :versao="edicao.versao.value"
          :dispositivo-id="edicao.dispositivoId"
          :esperar-gravar="edicao.esperarGravar"
          @finalizado="finalizado"
          @faltam="mostrarFaltas"
          @ir-para="irPara"
          @alterado="edicao.reler"
        />
        <AnularAtendimentoGaveta
          v-model:visible="anularAberto"
          :atendimento="atendimento"
          :aviso="avisoDoAnular"
          @anulado="anulado"
        />
        <AdendoGaveta
          v-model:visible="adendoAberto"
          :atendimento-id="atendimento.id"
          :pode-para-o-responsavel="podeLiberar"
          @criado="adendoCriado"
        />
        <AtoGaveta
          v-model:visible="atoAberto"
          :atendimento-id="atendimento.id"
          :especie="atendimento.paciente.especie"
          @registrado="atoRegistrado"
          @mesclado="edicao.carregar"
        />
        <AnularAtoGaveta
          v-model:visible="anularAtoAberto"
          :ato="atoParaAnular"
          @anulado="atoAnulado"
        />
      </template>
      <DesfazerNaAgenda
        :feito="feito"
        :desfazendo="desfazendo"
        @desfazer="desfazer"
        @sumiu="feito = null"
      />
    </template>
  </UiPagina>
</template>

<style scoped>
.ad {
  display: grid;
  gap: 16px;
}

.ad__voltar {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--tinta-2);
  font-size: 13.5px;
  text-decoration: none;
}

.ad__voltar:hover {
  color: var(--tinta);
}

.ad__faixa {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 14px;
  padding: 14px 20px;
}

.ad__faixa-icone {
  flex: none;
  color: var(--tinta-2);
  font-size: 20px;
}

.ad__faixa--ok .ad__faixa-icone {
  color: var(--ok-tinta);
}

.ad__faixa--atencao .ad__faixa-icone {
  color: var(--atencao-tinta);
}

.ad__faixa--risco .ad__faixa-icone {
  color: var(--risco-tinta);
}

.ad__faixa-texto {
  display: grid;
  min-width: 0;
  flex: 1 1 18rem;
  gap: 2px;
  color: var(--tinta-2);
  font-size: 13.5px;
}

.ad__faixa-texto strong {
  color: var(--tinta);
  font-size: 14px;
}

.ad__resumo {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.ad__barra {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px 16px;
}

.ad__aba {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.ad__aba-falta {
  color: var(--atencao-tinta);
}

.ad__gravacao {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--tinta-2);
  font-size: 13px;
}

.ad__gravacao--falhou {
  color: var(--risco-tinta);
}

.ad__erro {
  margin: -8px 0 0;
  color: var(--risco-tinta);
  font-size: 13px;
}

.ad__anterior {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
}

.ad__anterior a {
  color: var(--tinta);
}

.ad__adendo {
  align-items: flex-start;
}

.ad__adendo > i {
  margin-top: 2px;
  color: var(--tinta-2);
  font-size: 17px;
}

.ad__adendo-texto {
  color: var(--tinta);
  font-size: 14px;
  white-space: pre-line;
}

.ad__mais {
  margin: 0;
  padding: 0 24px 16px;
  color: var(--tinta-2);
  font-size: 13px;
}

@media (prefers-reduced-motion: reduce) {
  .ad__gravacao .ph-spin {
    animation: none;
  }
}
</style>
