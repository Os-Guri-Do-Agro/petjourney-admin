<script setup lang="ts">
/**
 * Hoje, versão **Cartões e salas**.
 *
 * - Em cima, o título com a frase do momento ("Jack está no Consultório 1. Chico espera há 23 min
 *   na recepção."), a busca, o novo atendimento e as telas da Clínica em abas.
 * - Três cartões: quem está na sala (o tempo, quem é, com quem, o responsável, quem mais está em
 *   consulta, se volta hoje, e o continuar); quem espera na recepção (o anel do tempo de espera, o
 *   alerta, o iniciar); e o que pede ação agora, com a ação de cada um.
 * - Embaixo, as salas ao longo do dia: uma faixa por sala (ou por profissional), as próximas quatro
 *   horas, com a linha do agora.
 *
 * Moldura (trilho flutuante), tokens e os dois temas em `components/layout/moldura-cartoes.css`.
 */
import Button from 'primevue/button'
import SelectButton from 'primevue/selectbutton'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import '@/components/layout/moldura-cartoes.css'
import { pedirBusca } from '@/components/layout/moldura'
import UiPagina from '@/components/ui/UiPagina.vue'
import { useClinicFormat } from '@/features/clinico/composables/useClinicFormat'
import type { MeuDia } from '@/features/clinico/composables/useMeuDia'
import type { Appointment, RoomKind } from '@/features/clinico/data/types'
import { clinicClock, useClinicoStore } from '@/features/clinico/stores/clinico'
import PetAvatar from '@/features/hotel/components/base/PetAvatar.vue'
import { useEspacos } from '@/navegacao/espacos'

const props = defineProps<{ dia: MeuDia }>()

const { t } = useI18n()
const formato = useClinicFormat()
const clinico = useClinicoStore()
const { aqui } = useEspacos()

const LIMITE_DA_RECEPCAO = 2
const LIMITE_DE_URGENTES = 2
/** A espera que fecha o anel: meia hora na recepção já é muito. */
const ESPERA_CHEIA = 30
/** Daqui para cima a espera ganha a cor de alerta. */
const ESPERA_LONGA = 15
const JANELA = 240

/* O agora da tela anda sozinho: os minutos não param quando a página fica aberta. */
const agora = ref(clinicClock.nowIso())
const relogio = setInterval(() => (agora.value = clinicClock.nowIso()), 20_000)

watch(
  () => props.dia.doDia,
  () => (agora.value = clinicClock.nowIso()),
)
onBeforeUnmount(() => clearInterval(relogio))

const agoraMin = computed(() => clinicClock.minutesOf(agora.value))

function minutosDesde(iso: string | null) {
  void agora.value

  return props.dia.minutosDesde(iso) ?? 0
}

function nomeDo(item: Appointment) {
  return props.dia.pet(item.petId)?.nome ?? ''
}

function primeiroNome(nome: string) {
  return nome.split(' ')[0]
}

/* ------------------------------------------------------------------------- cabeçalho */

const destinos = computed(() =>
  (aqui.value.espaco?.destinos ?? []).filter((destino) => !destino.bloqueado),
)

const rotaDasPendencias = computed(
  () =>
    destinos.value.find((destino) => destino.id === 'pendencias')?.to ?? '/veterinario/atividades',
)

/** A frase do momento: quem está na sala e quem espera há mais tempo. */
const frase = computed(() => {
  const partes: string[] = []
  const naSala = props.dia.emConsulta[0]
  const esperando = props.dia.naRecepcao[0]

  if (naSala) {
    partes.push(
      t('clinico.meuDia.versoes.cartoes.frase.sala', {
        pet: nomeDo(naSala),
        sala: props.dia.salasDe(naSala),
      }),
    )
  }

  if (esperando) {
    partes.push(
      t('clinico.meuDia.versoes.cartoes.frase.espera', {
        pet: nomeDo(esperando),
        tempo: formato.duracao(minutosDesde(esperando.chegadaEm)),
      }),
    )
  }

  return partes.length ? partes.join(' ') : t('clinico.meuDia.versoes.cartoes.frase.calma')
})

/* --------------------------------------------------------------------- quem está na sala */

const naSala = computed(() => props.dia.emConsulta[0] ?? null)
const petNaSala = computed(() => (naSala.value ? props.dia.pet(naSala.value.petId) : null))

const fatosDaSala = computed(() => {
  const item = naSala.value

  if (!item) {
    return []
  }

  const outro = props.dia.emConsulta[1]
  const volta = props.dia.doDia.find(
    (proximo) =>
      proximo.petId === item.petId && proximo.id !== item.id && proximo.inicio > agora.value,
  )

  return [
    {
      rotulo: t('clinico.meuDia.versoes.cartoes.sala.com', { tipo: props.dia.tipoDe(item) }),
      valor: props.dia.profissionaisDe(item),
    },
    {
      rotulo: t('clinico.meuDia.versoes.cartoes.sala.responsavel'),
      valor: props.dia.tutor(item.tutorId)?.nome ?? '',
    },
    outro && {
      rotulo: t('clinico.meuDia.versoes.cartoes.sala.tambem'),
      valor: t('clinico.meuDia.versoes.cartoes.sala.tambemValor', {
        pet: nomeDo(outro),
        tempo: formato.duracao(minutosDesde(outro.iniciadoEm ?? outro.inicio)),
      }),
    },
    volta && {
      rotulo: t('clinico.meuDia.versoes.cartoes.sala.volta'),
      valor: t('clinico.meuDia.versoes.cartoes.sala.voltaValor', {
        hora: formato.hora(volta.inicio),
        tipo: props.dia.tipoDe(volta).toLocaleLowerCase(),
      }),
    },
  ].filter((fato): fato is { rotulo: string; valor: string } => Boolean(fato && fato.valor))
})

/* -------------------------------------------------------------------------- recepção */

const recepcao = computed(() => props.dia.naRecepcao.slice(0, LIMITE_DA_RECEPCAO))

function esperaDe(item: Appointment) {
  return minutosDesde(item.chegadaEm)
}

/* -------------------------------------------------------------------------- pede ação */

const urgentes = computed(() => props.dia.urgentes.slice(0, LIMITE_DE_URGENTES))
const semUrgencia = computed(() => props.dia.linhasDaPauta.length - props.dia.urgentes.length)

/** A ação de cada pendência, pelo tipo dela; o caminho é sempre o da tela onde ela se resolve. */
function acaoDe(id: string) {
  if (id.startsWith('boletim-')) {
    return {
      rotulo: t('clinico.meuDia.versoes.cartoes.acao.contato'),
      icone: 'ph ph-chat-circle-text',
    }
  }

  if (id.startsWith('doses-')) {
    return { rotulo: t('clinico.meuDia.versoes.cartoes.acao.dose'), icone: 'ph ph-check' }
  }

  return { rotulo: t('clinico.meuDia.versoes.cartoes.acao.resolver'), icone: 'ph ph-arrow-right' }
}

/* ------------------------------------------------------------------- salas ao longo do dia */

type Agrupamento = 'sala' | 'profissional'

const agrupamento = ref<Agrupamento>('sala')
const agrupamentos = computed(() => [
  { valor: 'sala', rotulo: t('clinico.meuDia.versoes.cartoes.dia.porSala') },
  { valor: 'profissional', rotulo: t('clinico.meuDia.versoes.cartoes.dia.porProfissional') },
])

/** As próximas quatro horas, a partir da hora cheia de agora. */
const janela = computed(() => {
  const inicio = Math.floor(agoraMin.value / 60) * 60

  return { inicio, fim: inicio + JANELA }
})

const horas = computed(() =>
  [0, 1, 2, 3].map((deslocamento) => {
    const minuto = janela.value.inicio + deslocamento * 60

    return { minuto, rotulo: t('clinico.meuDia.versoes.cartoes.dia.hora', { h: minuto / 60 }) }
  }),
)

function posicao(minuto: number) {
  return Math.min(1, Math.max(0, (minuto - janela.value.inicio) / JANELA))
}

function porcento(fracao: number) {
  return `${fracao * 100}%`
}

const ICONE_DA_SALA: Record<RoomKind, string> = {
  consultorio: 'ph ph-door',
  cirurgia: 'ph ph-first-aid-kit',
  banho: 'ph ph-drop',
  internacao: 'ph ph-bed',
  exame: 'ph ph-heartbeat',
}

type Tipo = 'andamento' | 'espera' | 'confirmado' | 'agendado' | 'feito' | 'falta'

function tipoDe(item: Appointment): Tipo {
  switch (item.status) {
    case 'em-atendimento':
      return 'andamento'
    case 'aguardando':
      return 'espera'
    case 'confirmado':
      return 'confirmado'
    case 'finalizado':
      return 'feito'
    case 'falta':
      return 'falta'
    default:
      return 'agendado'
  }
}

/** O começo e o fim de cada atendimento: a consulta em curso ocupa o tempo real. */
function trechoDe(item: Appointment) {
  const marcado = clinicClock.minutesOf(item.fim) - clinicClock.minutesOf(item.inicio)
  const de = clinicClock.minutesOf(
    item.status === 'em-atendimento' ? (item.iniciadoEm ?? item.inicio) : item.inicio,
  )

  return {
    de,
    ate: item.status === 'em-atendimento' ? Math.max(de + marcado, agoraMin.value) : de + marcado,
  }
}

const faixas = computed(() => {
  const naJanela = props.dia.doDia.filter((item) => {
    const { de, ate } = trechoDe(item)

    return ate > janela.value.inicio && de < janela.value.fim
  })

  const grupos =
    agrupamento.value === 'sala'
      ? clinico.salas.map((sala) => ({
          id: sala.id,
          nome: sala.nome,
          icone: ICONE_DA_SALA[sala.kind] ?? 'ph ph-door',
          cor: '',
          iniciais: '',
          itens: naJanela.filter((item) => item.roomIds[0] === sala.id),
        }))
      : clinico.profissionais
          .filter((pessoa) => pessoa.ativo)
          .map((pessoa) => ({
            id: pessoa.id,
            nome: pessoa.nome,
            icone: '',
            cor: clinico.corDaColuna(pessoa.id),
            iniciais: pessoa.iniciais,
            itens: naJanela.filter((item) => item.professionalId === pessoa.id),
          }))

  return grupos
    .filter((grupo) => grupo.itens.length)
    .map((grupo) => {
      const blocos = grupo.itens
        .map((item) => ({ item, ...trechoDe(item), tipo: tipoDe(item), linha: 0 }))
        .sort((a, b) => a.de - b.de)
      const fimDaLinha: number[] = []

      /* Dois horários no mesmo tempo descem para uma linha de baixo, em vez de um cobrir o outro. */
      for (const bloco of blocos) {
        const livre = fimDaLinha.findIndex((ate) => ate <= bloco.de)
        bloco.linha = livre === -1 ? fimDaLinha.length : livre
        fimDaLinha[bloco.linha] = bloco.ate
      }

      return { ...grupo, blocos, linhas: Math.max(1, fimDaLinha.length) }
    })
})

function apoioDoBloco(item: Appointment, tipo: Tipo) {
  const alerta = props.dia.alertasRelevantes(props.dia.pet(item.petId))[0]

  if (tipo === 'andamento') {
    return t('clinico.meuDia.versoes.cartoes.dia.naSala', {
      tempo: formato.duracao(minutosDesde(item.iniciadoEm ?? item.inicio)),
      vet: primeiroNome(props.dia.profissionaisDe(item)),
    })
  }

  if (tipo === 'espera') {
    return t('clinico.meuDia.versoes.cartoes.dia.esperando', {
      tempo: formato.duracao(minutosDesde(item.chegadaEm)),
    })
  }

  return alerta ? (alerta.detalhe ?? formato.alerta(alerta.kind)) : props.dia.tipoDe(item)
}

function temAlerta(item: Appointment, tipo: Tipo) {
  return (
    tipo !== 'andamento' &&
    tipo !== 'espera' &&
    props.dia.alertasRelevantes(props.dia.pet(item.petId)).length > 0
  )
}

function rotaDoBloco(item: Appointment, tipo: Tipo) {
  return tipo === 'andamento' || tipo === 'espera' || tipo === 'feito'
    ? props.dia.rotaDoProntuario(item)
    : props.dia.focoNaAgenda(item.id)
}

function descricaoDo(item: Appointment, tipo: Tipo) {
  return [
    nomeDo(item),
    `${formato.hora(item.inicio)}–${formato.hora(item.fim)}`,
    props.dia.tipoDe(item),
    apoioDoBloco(item, tipo),
  ]
    .filter(Boolean)
    .join(' · ')
}

const agoraNaJanela = computed(
  () => agoraMin.value >= janela.value.inicio && agoraMin.value <= janela.value.fim,
)
</script>

<template>
  <UiPagina
    class="ct"
    :carregando="dia.carregando"
    :erro="dia.erro"
    bloquear-se-suspenso
    @tentar-de-novo="dia.carregar"
  >
    <template #cabecalho>
      <header class="ct-cabeca">
        <div class="ct-cabeca__linha">
          <div class="ct-cabeca__titulos">
            <p class="ct-migalha">{{ aqui.espaco?.rotulo }}</p>
            <h1>{{ t('clinico.meuDia.versoes.cartoes.titulo') }}</h1>
            <p class="ct-frase">{{ frase }}</p>
          </div>
          <div class="ct-cabeca__fim">
            <Button type="button" class="ct-busca" @click="pedirBusca()">
              <i class="ph ph-magnifying-glass" aria-hidden="true" />
              <span>{{ t('clinico.meuDia.versoes.cartoes.busca') }}</span>
            </Button>
            <RouterLink
              class="ct-pilula"
              :to="{ path: '/veterinario/agenda', query: { novo: '1' } }"
            >
              <i class="ph ph-plus" aria-hidden="true" />
              {{ t('clinico.meuDia.versoes.cartoes.novo') }}
            </RouterLink>
          </div>
        </div>

        <nav class="ct-abas" :aria-label="t('clinico.meuDia.versoes.cartoes.abas')">
          <RouterLink
            v-for="destino in destinos"
            :key="destino.id"
            class="ct-aba"
            :class="{ 'ct-aba--aberta': aqui.destino?.id === destino.id }"
            :to="destino.to"
            active-class=""
            exact-active-class=""
            :aria-current="aqui.destino?.id === destino.id ? 'page' : undefined"
            :title="destino.tituloDoSelo ?? undefined"
          >
            {{ destino.rotulo }}
            <span
              v-if="destino.selo"
              class="ct-aba__selo"
              :class="`ct-aba__selo--${destino.tom ?? 'neutro'}`"
            >
              {{ destino.selo }}
            </span>
          </RouterLink>
        </nav>
      </header>
    </template>

    <div class="ct-cartoes">
      <!-- Quem está na sala. -->
      <section v-if="naSala && petNaSala" class="ct-cartao ct-sala" aria-labelledby="ct-sala-nome">
        <header class="ct-sala__topo">
          <span class="ct-vidro">
            <span class="ct-vidro__ponto" aria-hidden="true" />
            {{ t('clinico.meuDia.versoes.cartoes.sala.agoraNo', { sala: dia.salasDe(naSala) }) }}
          </span>
          <strong class="ct-sala__tempo">
            {{ formato.duracao(minutosDesde(naSala.iniciadoEm ?? naSala.inicio)) }}
          </strong>
        </header>

        <div class="ct-sala__quem">
          <span class="ct-sala__rosto">
            <PetAvatar
              :nome="petNaSala.nome"
              :iniciais="petNaSala.iniciais"
              :especie="petNaSala.especie"
              :foto-url="petNaSala.fotoUrl ?? ''"
              tamanho="lg"
            />
          </span>
          <div>
            <h2 id="ct-sala-nome">{{ petNaSala.nome }}</h2>
            <p>{{ dia.linhaDoPaciente(petNaSala) }}</p>
          </div>
        </div>

        <dl class="ct-sala__fatos">
          <div v-for="fato in fatosDaSala" :key="fato.rotulo">
            <dt>{{ fato.rotulo }}</dt>
            <dd>{{ fato.valor }}</dd>
          </div>
        </dl>

        <div class="ct-sala__acoes">
          <Button
            type="button"
            class="ct-botao-grande"
            icon="ph ph-stethoscope"
            :label="t('clinico.meuDia.versoes.cartoes.sala.continuar')"
            @click="dia.abrirProntuario(naSala)"
          />
          <RouterLink class="ct-vidro ct-vidro--botao" :to="dia.rotaDoResumo(naSala)">
            <i class="ph ph-notepad" aria-hidden="true" />
            {{ t('clinico.resumoDoPaciente.verResumo') }}
          </RouterLink>
        </div>
      </section>

      <section v-else class="ct-cartao ct-sala ct-sala--vazia">
        <h2>{{ t('clinico.meuDia.versoes.cartoes.sala.ninguem') }}</h2>
        <p v-if="dia.aSeguir[0]">
          {{
            t('clinico.meuDia.versoes.cartoes.sala.proximo', {
              pet: nomeDo(dia.aSeguir[0]),
              hora: formato.hora(dia.aSeguir[0].inicio),
            })
          }}
        </p>
      </section>

      <!-- Quem espera na recepção. -->
      <section class="ct-cartao ct-recepcao" aria-labelledby="ct-recepcao">
        <header class="ct-cartao__cabeca">
          <h2 id="ct-recepcao">{{ t('clinico.meuDia.versoes.cartoes.recepcao.titulo') }}</h2>
          <span v-if="dia.naRecepcao.length" class="ct-selo ct-selo--ambar">
            {{
              t('clinico.meuDia.versoes.cartoes.recepcao.esperando', { n: dia.naRecepcao.length })
            }}
          </span>
        </header>

        <ul v-if="recepcao.length" class="ct-espera">
          <li v-for="(item, indice) in recepcao" :key="item.id" class="ct-espera__pet">
            <span
              class="ct-espera__anel"
              :class="{ 'ct-espera__anel--longo': esperaDe(item) > ESPERA_LONGA }"
              :style="{ '--fracao': Math.min(1, esperaDe(item) / ESPERA_CHEIA) }"
            >
              <PetAvatar
                :nome="nomeDo(item)"
                :iniciais="dia.pet(item.petId)?.iniciais ?? ''"
                :especie="dia.pet(item.petId)?.especie ?? null"
                :foto-url="dia.pet(item.petId)?.fotoUrl ?? ''"
                tamanho="lg"
              />
            </span>
            <strong class="ct-espera__nome">{{ nomeDo(item) }}</strong>
            <small class="ct-espera__apoio">
              {{ [dia.tipoDe(item), dia.profissionaisDe(item)].filter(Boolean).join(' · ') }}
            </small>
            <span
              class="ct-espera__tempo"
              :class="{ 'ct-espera__tempo--longo': esperaDe(item) > ESPERA_LONGA }"
            >
              {{ formato.duracao(esperaDe(item)) }}
            </span>
            <span
              v-for="alerta in dia.alertasRelevantes(dia.pet(item.petId)).slice(0, 1)"
              :key="alerta.id"
              class="ct-chip"
            >
              <i class="ph ph-heartbeat" aria-hidden="true" />
              {{ alerta.detalhe ?? formato.alerta(alerta.kind) }}
            </span>
            <Button
              type="button"
              size="small"
              class="ct-espera__chamar"
              :class="{ 'ct-espera__chamar--contorno': indice > 0 }"
              icon="ph ph-door-open"
              :label="t('clinico.hoje.chamar')"
              @click="dia.abrirProntuario(item)"
            />
          </li>
        </ul>
        <p v-else class="ct-vazio">{{ t('clinico.meuDia.versoes.cartoes.recepcao.vazio') }}</p>

        <RouterLink
          v-if="dia.naRecepcao.length > LIMITE_DA_RECEPCAO"
          class="ct-mais"
          to="/veterinario/agenda"
        >
          {{ t('clinico.meuDia.versoes.cartoes.recepcao.todos') }}
          <i class="ph ph-caret-right" aria-hidden="true" />
        </RouterLink>
      </section>

      <!-- O que pede ação agora. -->
      <section class="ct-cartao ct-acao" aria-labelledby="ct-acao">
        <header class="ct-cartao__cabeca">
          <h2 id="ct-acao">{{ t('clinico.meuDia.versoes.cartoes.acao.titulo') }}</h2>
          <span v-if="dia.urgentes.length" class="ct-selo ct-selo--coral">
            {{
              t(
                'clinico.meuDia.versoes.cartoes.acao.urgentes',
                { n: dia.urgentes.length },
                dia.urgentes.length,
              )
            }}
          </span>
        </header>

        <ul v-if="urgentes.length" class="ct-pedidos">
          <li v-for="linha in urgentes" :key="linha.id" class="ct-pedido">
            <div class="ct-pedido__topo">
              <PetAvatar
                v-if="linha.pet"
                :nome="linha.pet.nome"
                :iniciais="linha.pet.iniciais"
                :especie="linha.pet.especie"
                :foto-url="linha.pet.fotoUrl ?? ''"
                tamanho="md"
              />
              <span v-else class="ct-pedido__icone" aria-hidden="true">
                <i class="ph ph-first-aid" />
              </span>
              <div class="ct-pedido__texto">
                <strong>{{ linha.frase }}</strong>
                <small>{{ [linha.detalhe, linha.onde].filter(Boolean).join(' · ') }}</small>
              </div>
            </div>
            <RouterLink class="ct-pedido__acao" :to="linha.to">
              <i :class="acaoDe(linha.id).icone" aria-hidden="true" />
              {{ acaoDe(linha.id).rotulo }}
            </RouterLink>
          </li>
        </ul>
        <p v-else class="ct-vazio">{{ t('inicio.pauta.calma') }}</p>

        <RouterLink v-if="semUrgencia > 0" class="ct-mais" :to="rotaDasPendencias">
          {{ t('clinico.meuDia.versoes.cartoes.acao.mais', { n: semUrgencia }, semUrgencia) }}
          <i class="ph ph-caret-right" aria-hidden="true" />
        </RouterLink>
      </section>
    </div>

    <!-- As salas ao longo do dia. -->
    <section class="ct-cartao ct-dia" aria-labelledby="ct-dia">
      <header class="ct-dia__cabeca">
        <h2 id="ct-dia">{{ t('clinico.meuDia.versoes.cartoes.dia.titulo') }}</h2>
        <ul class="ct-legenda">
          <li class="ct-legenda--andamento">
            <span aria-hidden="true" />
            {{ t('clinico.meuDia.versoes.cartoes.dia.legenda.andamento') }}
          </li>
          <li class="ct-legenda--espera">
            <span aria-hidden="true" />
            {{ t('clinico.meuDia.versoes.cartoes.dia.legenda.espera') }}
          </li>
          <li class="ct-legenda--agendado">
            <span aria-hidden="true" />
            {{ t('clinico.meuDia.versoes.cartoes.dia.legenda.agendado') }}
          </li>
          <li class="ct-legenda--confirmado">
            <i class="ph ph-check-circle" aria-hidden="true" />
            {{ t('clinico.meuDia.versoes.cartoes.dia.legenda.confirmado') }}
          </li>
        </ul>
        <SelectButton
          v-model="agrupamento"
          :options="agrupamentos"
          option-label="rotulo"
          option-value="valor"
          :allow-empty="false"
          :aria-label="t('clinico.meuDia.versoes.cartoes.dia.aria')"
          class="ct-agrupar"
        />
      </header>

      <div class="ct-grade">
        <div class="ct-eixo" aria-hidden="true">
          <span />
          <div class="ct-eixo__trilho">
            <span
              v-for="hora in horas"
              :key="hora.minuto"
              class="ct-eixo__hora"
              :style="{ left: porcento(posicao(hora.minuto)) }"
            >
              {{ hora.rotulo }}
            </span>
            <span
              v-if="agoraNaJanela"
              class="ct-eixo__agora"
              :style="{ left: porcento(posicao(agoraMin)) }"
            >
              {{ t('clinico.meuDia.versoes.cartoes.dia.agora') }}
            </span>
          </div>
        </div>

        <div class="ct-faixas">
          <div class="ct-camada" aria-hidden="true">
            <span
              v-for="hora in horas"
              :key="hora.minuto"
              class="ct-camada__hora"
              :style="{ left: porcento(posicao(hora.minuto)) }"
            />
            <span
              v-if="agoraNaJanela"
              class="ct-camada__agora"
              :style="{ left: porcento(posicao(agoraMin)) }"
            />
          </div>

          <div
            v-for="faixa in faixas"
            :key="faixa.id"
            class="ct-faixa"
            :style="{ '--linhas': faixa.linhas }"
          >
            <span class="ct-faixa__quem">
              <span v-if="faixa.icone" class="ct-faixa__icone" aria-hidden="true">
                <i :class="faixa.icone" />
              </span>
              <span
                v-else
                class="ct-faixa__icone ct-faixa__icone--pessoa"
                :style="{ '--cor': faixa.cor }"
                aria-hidden="true"
              >
                {{ faixa.iniciais }}
              </span>
              <span class="ct-faixa__nome" :title="faixa.nome">{{ faixa.nome }}</span>
            </span>
            <div class="ct-faixa__trilho">
              <RouterLink
                v-for="bloco in faixa.blocos"
                :key="bloco.item.id"
                class="ct-bloco"
                :class="`ct-bloco--${bloco.tipo}`"
                :style="{
                  left: porcento(posicao(bloco.de)),
                  width: porcento(posicao(bloco.ate) - posicao(bloco.de)),
                  '--linha': bloco.linha,
                }"
                :to="rotaDoBloco(bloco.item, bloco.tipo)"
                :title="descricaoDo(bloco.item, bloco.tipo)"
                :aria-label="descricaoDo(bloco.item, bloco.tipo)"
              >
                <span class="ct-bloco__rosto">
                  <PetAvatar
                    :nome="nomeDo(bloco.item)"
                    :iniciais="dia.pet(bloco.item.petId)?.iniciais ?? ''"
                    :especie="dia.pet(bloco.item.petId)?.especie ?? null"
                    :foto-url="dia.pet(bloco.item.petId)?.fotoUrl ?? ''"
                    tamanho="sm"
                  />
                </span>
                <span class="ct-bloco__texto">
                  <strong>
                    {{
                      bloco.tipo === 'andamento'
                        ? `${nomeDo(bloco.item)} · ${dia.tipoDe(bloco.item)}`
                        : nomeDo(bloco.item)
                    }}
                  </strong>
                  <small :class="{ 'ct-bloco__alerta': temAlerta(bloco.item, bloco.tipo) }">
                    <i
                      v-if="temAlerta(bloco.item, bloco.tipo)"
                      class="ph ph-warning"
                      aria-hidden="true"
                    />
                    {{ apoioDoBloco(bloco.item, bloco.tipo) }}
                  </small>
                </span>
                <i
                  v-if="bloco.tipo === 'confirmado'"
                  class="ph ph-check-circle ct-bloco__marca"
                  aria-hidden="true"
                />
              </RouterLink>
            </div>
          </div>

          <p v-if="!faixas.length" class="ct-vazio">
            {{ t('clinico.meuDia.versoes.cartoes.dia.vazio') }}
          </p>
        </div>
      </div>
    </section>

    <template #sempre>
      <slot name="sempre" />
    </template>
  </UiPagina>
</template>

<!-- Em tela estreita a moldura é a do portal: a área de conteúdo vira o papel dos cartões. -->
<style>
.palco__conteudo:has(.ct) {
  background: var(--ct-fundo, #f4f5f2);
}
</style>

<style scoped>
.ct.ct {
  max-width: none;
  padding: 20px 28px 40px 16px;
}

/* --------------------------------------------------------------------------- cabeçalho */

.ct-cabeca {
  display: grid;
  min-width: 0;
  flex: 1;
  gap: 18px;
}

.ct-cabeca__linha {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px 24px;
}

.ct-cabeca__titulos {
  display: grid;
  min-width: 0;
  gap: 4px;
}

.ct-migalha {
  margin: 0;
  color: var(--ct-tinta-2);
  font-size: 13px;
  font-weight: 600;
}

.ct-cabeca h1 {
  margin: 0;
  color: var(--ct-tinta);
  font-family: var(--ct-display);
  font-size: 36px;
  font-weight: 620;
  letter-spacing: -0.03em;
  line-height: 1.1;
}

.ct-frase {
  margin: 2px 0 0;
  color: var(--ct-tinta-2);
  font-size: 15px;
}

.ct-cabeca__fim {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

/* A busca tem cara de campo e abre a busca da Clínica (a mesma do Ctrl K). */
.ct-busca.p-button {
  min-width: 260px;
  min-height: 44px;
  justify-content: flex-start;
  gap: 10px;
  padding: 0 18px;
  border: 1px solid var(--ct-linha);
  border-radius: 999px;
  background: var(--ct-cartao);
  color: var(--ct-tinta-3);
  font-size: 14px;
  font-weight: 400;
}

.ct-busca.p-button:hover {
  border-color: var(--ct-linha-forte);
  background: var(--ct-cartao);
}

.ct-pilula {
  display: inline-flex;
  min-height: 44px;
  align-items: center;
  gap: 8px;
  padding: 0 20px;
  border: 1px solid var(--ct-linha);
  border-radius: 999px;
  background: var(--ct-cartao);
  color: var(--ct-tinta);
  font-size: 14.5px;
  font-weight: 650;
  text-decoration: none;
}

.ct-pilula:hover {
  border-color: var(--ct-linha-forte);
}

.ct-abas {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.ct-aba {
  display: inline-flex;
  min-height: 38px;
  align-items: center;
  gap: 8px;
  padding: 0 16px;
  border: 1px solid var(--ct-linha);
  border-radius: 999px;
  background: var(--ct-cartao);
  color: var(--ct-tinta);
  font-size: 14px;
  font-weight: 500;
  text-decoration: none;
  transition: border-color 150ms ease-out;
}

.ct-aba:hover {
  border-color: var(--ct-linha-forte);
}

.ct-aba--aberta,
.ct-aba--aberta:hover {
  border-color: transparent;
  background: var(--ct-noite);
  color: var(--ct-sobre-noite);
  font-weight: 650;
}

.ct-aba__selo {
  display: inline-grid;
  min-width: 22px;
  height: 20px;
  padding: 0 6px;
  place-items: center;
  border-radius: 999px;
  background: var(--ct-cartao-2);
  color: var(--ct-tinta-2);
  font-size: 11.5px;
  font-weight: 700;
}

.ct-aba__selo--risco,
.ct-aba__selo--atencao {
  background: var(--ct-coral-veu);
  color: var(--ct-coral-texto);
}

.ct-busca.p-button:focus-visible,
.ct-pilula:focus-visible,
.ct-aba:focus-visible,
.ct-vidro--botao:focus-visible,
.ct-pedido__acao:focus-visible,
.ct-mais:focus-visible,
.ct-bloco:focus-visible {
  outline: 2px solid var(--ct-marca-forte);
  outline-offset: 2px;
}

/* ---------------------------------------------------------------------------- cartões */

.ct-cartoes {
  display: grid;
  gap: 16px;
  margin-top: 8px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.ct-cartao {
  min-width: 0;
  padding: 22px;
  border-radius: 28px;
  background: var(--ct-cartao);
  box-shadow: var(--ct-sombra);
}

.ct-cartao__cabeca {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.ct-cartao__cabeca h2 {
  margin: 0;
  color: var(--ct-tinta);
  font-family: var(--ct-display);
  font-size: 19px;
  font-weight: 650;
}

.ct-selo {
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 12.5px;
  font-weight: 650;
  white-space: nowrap;
}

.ct-selo--ambar {
  background: var(--ct-ambar-veu);
  color: var(--ct-ambar-texto);
}

.ct-selo--coral {
  background: var(--ct-coral-veu);
  color: var(--ct-coral-texto);
}

/* Quem está na sala: a sálvia do parceiro, com a tinta por cima. */
.ct-sala {
  display: flex;
  flex-direction: column;
  gap: 18px;
  background: var(--ct-salvia);
  color: var(--ct-sobre-salvia);
}

.ct-sala__topo {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.ct-vidro {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 999px;
  background: var(--ct-salvia-vidro);
  color: var(--ct-sobre-salvia);
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
}

.ct-vidro__ponto {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--ct-sobre-salvia);
}

.ct-sala__tempo {
  font-family: var(--ct-display);
  font-size: 30px;
  font-variant-numeric: tabular-nums;
  font-weight: 650;
  letter-spacing: -0.02em;
}

.ct-sala__quem {
  display: flex;
  align-items: center;
  gap: 16px;
}

.ct-sala__rosto {
  display: grid;
  flex: none;
  padding: 4px;
  border-radius: 50%;
  background: var(--ct-cartao);
}

.ct-sala__quem h2 {
  margin: 0;
  font-family: var(--ct-display);
  font-size: 32px;
  font-weight: 650;
  letter-spacing: -0.02em;
  line-height: 1.05;
}

.ct-sala__quem p {
  margin: 4px 0 0;
  font-size: 14px;
  opacity: 0.85;
}

.ct-sala__fatos {
  display: grid;
  gap: 14px 16px;
  margin: 0;
  padding: 16px;
  border-radius: 18px;
  background: var(--ct-salvia-veu);
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.ct-sala__fatos dt {
  font-size: 12.5px;
  opacity: 0.8;
}

.ct-sala__fatos dd {
  margin: 2px 0 0;
  font-size: 14.5px;
  font-weight: 650;
}

/* Empilhados no cartão estreito; lado a lado quando ele ocupa a largura toda. */
.ct-sala__acoes {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-top: auto;
}

.ct-botao-grande.p-button {
  min-height: 48px;
  gap: 10px;
  padding-inline: 22px;
  font-size: 15px;
}

.ct-vidro--botao {
  min-height: 44px;
  padding: 0 18px;
  font-size: 14px;
}

.ct-vidro--botao:hover {
  background: color-mix(in srgb, var(--ct-salvia-vidro) 60%, var(--ct-cartao));
}

.ct-sala--vazia {
  justify-content: center;
}

.ct-sala--vazia h2 {
  margin: 0;
  font-family: var(--ct-display);
  font-size: 24px;
}

.ct-sala--vazia p {
  margin: 0;
}

/* Quem espera: o anel do tempo de espera em volta do rosto. */
.ct-espera {
  display: grid;
  gap: 12px;
  margin: 0;
  padding: 0;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  list-style: none;
}

.ct-espera__pet {
  display: grid;
  justify-items: center;
  align-content: start;
  gap: 4px;
  padding: 18px 12px 16px;
  border-radius: 20px;
  background: var(--ct-cartao-2);
  text-align: center;
}

.ct-espera__anel {
  --fracao: 0;

  display: grid;
  margin-bottom: 8px;
  padding: 5px;
  border-radius: 50%;
  background: conic-gradient(var(--ct-marca-forte) calc(var(--fracao) * 1turn), var(--ct-linha) 0);
}

.ct-espera__anel--longo {
  background: conic-gradient(var(--ct-ambar) calc(var(--fracao) * 1turn), var(--ct-linha) 0);
}

.ct-espera__anel :deep(.avatar) {
  box-shadow: 0 0 0 3px var(--ct-cartao-2);
}

.ct-espera__nome {
  color: var(--ct-tinta);
  font-size: 15.5px;
  font-weight: 650;
}

.ct-espera__apoio {
  color: var(--ct-tinta-2);
  font-size: 12.5px;
  line-height: 1.35;
}

.ct-espera__tempo {
  margin: 6px 0 4px;
  color: var(--ct-tinta);
  font-family: var(--ct-display);
  font-size: 22px;
  font-variant-numeric: tabular-nums;
  font-weight: 650;
}

.ct-espera__tempo--longo {
  color: var(--ct-ambar-texto);
}

.ct-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--ct-cartao);
  color: var(--ct-tinta);
  font-size: 12px;
  font-weight: 600;
  line-height: 1.3;
}

.ct-espera__chamar.p-button {
  min-height: 38px;
  gap: 8px;
  margin-top: 8px;
  padding-inline: 16px;
  font-size: 13.5px;
}

.ct-espera__chamar--contorno.p-button {
  border: 1px solid var(--ct-linha-forte);
  background: var(--ct-cartao);
  color: var(--ct-tinta);
}

.ct-espera__chamar--contorno.p-button:hover {
  background: var(--ct-cartao-2);
}

/* O que pede ação: o cartão rosado, cada pedido em papel com a ação dele. */
.ct-acao {
  display: flex;
  flex-direction: column;
  background: var(--ct-rosa);
  box-shadow: inset 0 0 0 1px var(--ct-rosa-linha);
}

.ct-pedidos {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ct-pedido {
  display: grid;
  gap: 12px;
  padding: 16px;
  border-radius: 20px;
  background: var(--ct-cartao);
}

.ct-pedido__topo {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.ct-pedido__icone {
  display: grid;
  width: 40px;
  height: 40px;
  flex: none;
  place-items: center;
  border-radius: 50%;
  background: var(--ct-coral-veu);
  color: var(--ct-coral-texto);
  font-size: 20px;
}

.ct-pedido__texto {
  display: grid;
  min-width: 0;
  gap: 3px;
}

.ct-pedido__texto strong {
  color: var(--ct-tinta);
  font-size: 14.5px;
  font-weight: 650;
  line-height: 1.35;
}

.ct-pedido__texto small {
  color: var(--ct-tinta-2);
  font-size: 12.5px;
}

.ct-pedido__acao {
  display: inline-flex;
  min-height: 38px;
  justify-self: start;
  align-items: center;
  gap: 8px;
  padding: 0 16px;
  border: 1px solid color-mix(in srgb, var(--ct-coral) 45%, transparent);
  border-radius: 999px;
  color: var(--ct-coral-texto);
  font-size: 13.5px;
  font-weight: 650;
  text-decoration: none;
}

.ct-pedido__acao:hover {
  background: var(--ct-coral-veu);
}

.ct-mais {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-top: 14px;
  color: var(--ct-tinta);
  font-size: 13.5px;
  font-weight: 600;
  text-decoration: none;
}

.ct-mais:hover {
  text-decoration: underline;
}

.ct-vazio {
  margin: 0;
  padding: 8px 0;
  color: var(--ct-tinta-2);
  font-size: 14.5px;
}

/* ------------------------------------------------------------------ salas ao longo do dia */

.ct-dia {
  margin-top: 16px;
  padding: 22px 24px 24px;
}

.ct-dia__cabeca {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 24px;
  margin-bottom: 18px;
}

.ct-dia__cabeca h2 {
  margin: 0;
  color: var(--ct-tinta);
  font-family: var(--ct-display);
  font-size: 19px;
  font-weight: 650;
}

.ct-legenda {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 18px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ct-legenda li {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--ct-tinta-2);
  font-size: 12.5px;
}

.ct-legenda li span {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.ct-legenda--andamento span {
  background: var(--ct-salvia);
}

.ct-legenda--espera span {
  background: var(--ct-ambar);
}

.ct-legenda--agendado span {
  border: 1.5px solid var(--ct-linha-forte);
}

.ct-legenda--confirmado i {
  font-size: 14px;
}

/* O agrupamento: por sala ou por profissional. */
.ct-agrupar.ct-agrupar.ct-agrupar.ct-agrupar.ct-agrupar {
  margin-inline-start: auto;
  padding: 4px;
  border: 0;
  border-radius: 999px;
  background: var(--ct-cartao-2);
}

.ct-agrupar.ct-agrupar.ct-agrupar.ct-agrupar.ct-agrupar :deep(.p-togglebutton) {
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: transparent;
  box-shadow: none;
  color: var(--ct-tinta-2);
  font-size: 13px;
  font-weight: 600;
}

.ct-agrupar.ct-agrupar.ct-agrupar.ct-agrupar.ct-agrupar
  :deep(.p-togglebutton.p-togglebutton-checked) {
  background: var(--ct-cartao);
  box-shadow: 0 1px 2px rgb(16 48 42 / 10%);
  color: var(--ct-tinta);
}

.ct-agrupar.ct-agrupar.ct-agrupar.ct-agrupar.ct-agrupar :deep(.p-togglebutton-content),
.ct-agrupar.ct-agrupar.ct-agrupar.ct-agrupar.ct-agrupar
  :deep(.p-togglebutton.p-togglebutton-checked .p-togglebutton-content) {
  padding: 7px 14px;
  border-radius: 999px;
  background: transparent;
  box-shadow: none;
}

.ct-grade {
  --ct-rotulo: 170px;
  --ct-linha-altura: 48px;
}

.ct-eixo {
  display: grid;
  height: 32px;
  grid-template-columns: var(--ct-rotulo) minmax(0, 1fr);
}

.ct-eixo__trilho {
  position: relative;
}

.ct-eixo__hora {
  position: absolute;
  top: 6px;
  padding-inline-start: 6px;
  color: var(--ct-tinta-2);
  font-size: 12.5px;
  font-variant-numeric: tabular-nums;
  font-weight: 650;
}

.ct-eixo__agora {
  position: absolute;
  z-index: 2;
  top: 2px;
  padding: 3px 10px;
  border-radius: 999px;
  background: var(--ct-noite);
  color: var(--ct-sobre-noite);
  font-size: 12px;
  font-weight: 700;
  transform: translateX(-50%);
  transition: left 600ms linear;
}

.ct-faixas {
  position: relative;
  display: grid;
  gap: 10px;
}

.ct-camada {
  position: absolute;
  z-index: 0;
  inset: 0 0 0 var(--ct-rotulo);
  pointer-events: none;
}

.ct-camada__hora {
  position: absolute;
  top: 0;
  bottom: 0;
  border-inline-start: 1px dashed var(--ct-linha-forte);
}

.ct-camada__agora {
  position: absolute;
  z-index: 3;
  top: -10px;
  bottom: 0;
  width: 2px;
  margin-left: -1px;
  background: var(--ct-noite);
  transition: left 600ms linear;
}

.ct-faixa {
  display: grid;
  align-items: center;
  grid-template-columns: var(--ct-rotulo) minmax(0, 1fr);
}

.ct-faixa__quem {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
  padding-inline-end: 12px;
  color: var(--ct-tinta);
  font-size: 14px;
  font-weight: 600;
}

.ct-faixa__nome {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ct-faixa__icone {
  display: grid;
  width: 34px;
  height: 34px;
  flex: none;
  place-items: center;
  border-radius: 50%;
  background: var(--ct-cartao-2);
  color: var(--ct-tinta-2);
  font-size: 16px;
}

.ct-faixa__icone--pessoa {
  background: color-mix(in srgb, var(--cor) 24%, var(--ct-cartao));
  color: var(--ct-tinta);
  font-size: 12px;
  font-weight: 700;
}

.ct-faixa__trilho {
  position: relative;
  z-index: 1;
  height: calc(var(--linhas) * var(--ct-linha-altura) + (var(--linhas) - 1) * 4px);
  border-radius: 999px;
  background: color-mix(in srgb, var(--ct-cartao-2) 70%, transparent);
}

/* O bloco: uma pílula com o rosto, o nome e o que importa dele. */
.ct-bloco {
  position: absolute;
  top: calc(var(--linha) * (var(--ct-linha-altura) + 4px));
  display: flex;
  height: var(--ct-linha-altura);
  min-width: 34px;
  align-items: center;
  gap: 8px;
  overflow: hidden;
  padding: 0 12px 0 6px;
  border: 1px solid var(--ct-linha);
  border-radius: 999px;
  background: var(--ct-cartao);
  color: var(--ct-tinta);
  text-decoration: none;
  container-type: inline-size;
  transition: border-color 150ms ease-out;
}

.ct-bloco:hover {
  border-color: var(--ct-linha-forte);
}

.ct-bloco__rosto {
  display: grid;
  flex: none;
  padding: 2px;
  border-radius: 50%;
  background: var(--ct-cartao);
}

.ct-bloco__texto {
  display: grid;
  min-width: 0;
  flex: 1;
}

.ct-bloco__texto strong {
  overflow: hidden;
  font-size: 13px;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ct-bloco__texto small {
  overflow: hidden;
  font-size: 11.5px;
  opacity: 0.8;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ct-bloco__alerta {
  color: var(--ct-ambar-texto);
  font-weight: 600;
  opacity: 1 !important;
}

.ct-bloco__marca {
  flex: none;
  color: var(--ct-tinta-2);
  font-size: 15px;
}

.ct-bloco--andamento {
  z-index: 2;
  border-color: transparent;
  background: var(--ct-salvia);
  color: var(--ct-sobre-salvia);
}

.ct-bloco--espera {
  border-color: var(--ct-ambar);
  background: var(--ct-ambar-veu);
}

.ct-bloco--confirmado,
.ct-bloco--agendado {
  background: var(--ct-cartao-2);
}

.ct-bloco--feito {
  opacity: 0.55;
}

.ct-bloco--falta strong {
  text-decoration: line-through;
}

@container (max-width: 120px) {
  .ct-bloco__texto small,
  .ct-bloco__marca {
    display: none;
  }
}

@container (max-width: 64px) {
  .ct-bloco__texto {
    display: none;
  }
}

/* --------------------------------------------------------------------------- estreito */

@media (max-width: 1280px) {
  .ct-cartoes {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .ct-sala {
    grid-column: 1 / -1;
  }

  .ct-grade {
    --ct-rotulo: 140px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .ct-eixo__agora,
  .ct-camada__agora {
    transition: none;
  }
}
</style>
