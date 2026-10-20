<script setup lang="ts">
/**
 * Pacientes.
 *
 * A busca é a mesma que a recepção faz no balcão: nome do paciente, nome de quem responde por
 * ele ou telefone. Acento não é barreira — quem digita "acai" acha "Açaí".
 *
 * Os filtros respondem às perguntas que a lista sozinha não responde: "quais gatos?", "quem
 * tem alerta de risco?", "quem está sem retorno marcado?". Ficam atrás de um botão só, com as
 * escolhas visíveis em fichas — filtro escondido é como alguém conclui que a lista sumiu.
 *
 * **Cadastrar é ação desta tela, e não só do agendamento.** Até agora o único caminho para um
 * paciente novo era abrir a agenda, começar a marcar um horário e descobrir o atalho no rodapé
 * da lista de pacientes — um lugar que só encontra quem já estava marcando. Quem chega no balcão
 * com um filhote e nenhuma consulta marcada estava na tela certa e não tinha por onde começar.
 * O botão está aqui em dois lugares: encostado no título, e dentro da lista vazia — que é
 * exatamente onde alguém para quando procurou o paciente e ele não existe. Os dois levam à
 * página de cadastro: a ficha inteira tem mais de vinte campos e não cabe num diálogo sem criar
 * uma rolagem dentro da outra.
 *
 * **Trazer a base de outro sistema também começa aqui**, pelo mesmo motivo: é outro jeito de
 * cadastrar, muitos de uma vez. Enquanto uma importação estiver em andamento ou pausada, a
 * lista avisa em cima — é por esse aviso que "continuar depois" é achável depois.
 *
 * ## A forma (redesenho de 19/10/2026)
 *
 * A tela é **procurar**. O campo de busca é a primeira coisa embaixo do título, grande, com a
 * frase do que se pode digitar; os filtros moram ao lado dele. A lista diz, por linha, quem é o
 * animal (rosto, nome, espécie, raça, idade e peso), quem responde por ele (com o telefone, que é
 * o que se usa daqui), quando veio e quando volta — em data que se lê, com a distância embaixo —
 * e os alertas como selos com a palavra: "Alergia", "Condição crônica", "Pendência financeira".
 * O detalhe do alerta (a amoxicilina, a dermatite) fica na dica do selo e na ficha.
 *
 * A linha inteira abre a ficha, no clique simples: aqui não há o que selecionar, e o duplo clique
 * de antes era um gesto que ninguém tentava.
 *
 * Acabamento de 20/10/2026: acima da lista, os números dela em indicadores (quantos, com alerta,
 * com e sem horário — as mesmas regras e palavras do filtro); a busca e a tabela num cartão só,
 * com o cabeçalho das colunas num poço.
 */
import Button from 'primevue/button'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import UiPagina from '@/components/ui/UiPagina.vue'
import ClinicPacienteCelula from '@/features/clinico/components/base/ClinicPacienteCelula.vue'
import ClinicDataTable from '@/features/clinico/components/base/ClinicDataTable.vue'
import ClinicFilterBar from '@/features/clinico/components/base/ClinicFilterBar.vue'
import type { GrupoDeFiltro } from '@/features/clinico/components/base/filter-types'
import type { ColunaTabela } from '@/features/clinico/components/base/table-types'
import { useClinicFormat } from '@/features/clinico/composables/useClinicFormat'
import { patientRepository, type PacienteResumo } from '@/features/clinico/data/repositories'
import type { PetAlert, PetAlertKind, PetSpecies } from '@/features/clinico/data/types'
import { clinicClock, useClinicoStore } from '@/features/clinico/stores/clinico'
import { useMigracaoStore } from '@/features/clinico/stores/migracao'
import { INTL_LOCALE, type Locale } from '@/i18n/locales'

const { t, locale } = useI18n()
const router = useRouter()
const clinico = useClinicoStore()
const migracao = useMigracaoStore()
const formato = useClinicFormat()

/** A categoria do alerta ganha ícone próprio dentro do selo; a palavra vem ao lado. */
const ICONE_DO_ALERTA: Record<PetAlertKind, string> = {
  alergia: 'ph ph-warning-diamond',
  agressivo: 'ph ph-hand-palm',
  cronico: 'ph ph-heartbeat',
  'medicacao-continua': 'ph ph-pill',
  imunossuprimido: 'ph ph-shield-warning',
  gestante: 'ph ph-baby',
  inadimplente: 'ph ph-wallet',
}

/** O par de cor do selo: informação é o neutro do kit. */
const TOM_DO_ALERTA = { risco: 'ui-selo--risco', atencao: 'ui-selo--atencao', info: '' } as const

const PESO_DA_SEVERIDADE = { risco: 0, atencao: 1, info: 2 } as const

/** Quantos selos cabem na linha antes do "+N". */
const SELOS_POR_LINHA = 2

/** O mais grave primeiro: é ele que a linha mostra antes. */
function alertasOrdenados(alertas: PetAlert[]) {
  return [...alertas].sort(
    (a, b) => PESO_DA_SEVERIDADE[a.severidade] - PESO_DA_SEVERIDADE[b.severidade],
  )
}

/** "Condição crônica: Dermatite atópica" — a frase inteira, para a dica e o leitor de tela. */
function fraseDoAlerta(alerta: PetAlert) {
  return alerta.detalhe
    ? `${formato.alerta(alerta.kind)}: ${alerta.detalhe}`
    : formato.alerta(alerta.kind)
}

function frasesDosAlertas(alertas: PetAlert[]) {
  return alertasOrdenados(alertas).map(fraseDoAlerta).join('; ')
}

const termo = ref('')
const selecionados = ref<Record<string, string[]>>({})
const linhas = ref<PacienteResumo[]>([])
/* Começa carregando: a primeira busca sai no onMounted, e até lá "nenhum paciente" seria mentira. */
const carregando = ref(true)
/**
 * A página só mostra o "carregando" dela na primeira vez. Depois, quem carrega é a tabela: a
 * busca que volta vazia não pode desmontar o campo em que a pessoa está digitando.
 */
const jaCarregou = ref(false)
const erro = ref('')

const colunas = computed<ColunaTabela<PacienteResumo>[]>(() => [
  {
    id: 'paciente',
    rotulo: t('clinico.pacientes.colunaPaciente'),
    largura: 'minmax(15rem, 2fr)',
  },
  {
    id: 'responsavel',
    rotulo: t('clinico.pacientes.colunaResponsavel'),
    largura: 'minmax(0, 1.25fr)',
    ocultarEmTelaEstreita: true,
  },
  { id: 'ultimo', rotulo: t('clinico.pacientes.colunaUltimo'), largura: '8.5rem' },
  { id: 'proximo', rotulo: t('clinico.pacientes.colunaProximo'), largura: '8.5rem' },
  {
    id: 'alertas',
    rotulo: t('clinico.pacientes.colunaAlertas'),
    largura: 'minmax(11rem, 1.25fr)',
  },
])

/** Predicados nomeados: o filtro fica legível e a contagem usa exatamente a mesma regra. */
const REGRAS: Record<string, (item: PacienteResumo) => boolean> = {
  'alerta:risco': (item) => item.pet.alertas.some((alerta) => alerta.severidade === 'risco'),
  'alerta:algum': (item) => item.pet.alertas.length > 0,
  'alerta:nenhum': (item) => item.pet.alertas.length === 0,
  'agenda:com': (item) => item.proximoAtendimentoEm !== null,
  'agenda:sem': (item) => item.proximoAtendimentoEm === null,
}

function atendeGrupo(item: PacienteResumo, grupoId: string, valores: string[]) {
  if (valores.length === 0) {
    return true
  }

  if (grupoId === 'especie') {
    return valores.includes(item.pet.especie)
  }

  /** Dentro de um grupo as opções somam (OU); entre grupos, restringem (E). */
  return valores.some((valor) => REGRAS[valor]?.(item) ?? true)
}

const visiveis = computed(() =>
  linhas.value.filter((item) =>
    Object.entries(selecionados.value).every(([grupoId, valores]) =>
      atendeGrupo(item, grupoId, valores),
    ),
  ),
)

/** Contagem por opção sobre a lista já buscada — antes de clicar já se sabe se vale. */
function contar(regra: (item: PacienteResumo) => boolean) {
  return linhas.value.filter(regra).length
}

const especiesPresentes = computed(() => {
  const vistas = new Set(linhas.value.map((item) => item.pet.especie))

  return [...vistas].sort() as PetSpecies[]
})

const grupos = computed<GrupoDeFiltro[]>(() => [
  {
    id: 'especie',
    rotulo: t('clinico.pacientes.filtro.especie'),
    opcoes: especiesPresentes.value.map((especie) => ({
      valor: especie,
      rotulo: formato.especie(especie),
      contagem: contar((item) => item.pet.especie === especie),
    })),
  },
  {
    id: 'alerta',
    rotulo: t('clinico.pacientes.colunaAlertas'),
    opcoes: [
      {
        valor: 'alerta:risco',
        rotulo: t('clinico.severidade.risco'),
        contagem: contar(REGRAS['alerta:risco']!),
      },
      {
        valor: 'alerta:algum',
        rotulo: t('clinico.pacientes.filtro.comAlerta'),
        contagem: contar(REGRAS['alerta:algum']!),
      },
      {
        valor: 'alerta:nenhum',
        rotulo: t('clinico.pacientes.filtro.semAlerta'),
        contagem: contar(REGRAS['alerta:nenhum']!),
      },
    ],
  },
  {
    id: 'agenda',
    rotulo: t('clinico.pacientes.filtro.agenda'),
    opcoes: [
      {
        valor: 'agenda:com',
        rotulo: t('clinico.pacientes.filtro.comProximo'),
        contagem: contar(REGRAS['agenda:com']!),
      },
      {
        valor: 'agenda:sem',
        rotulo: t('clinico.pacientes.filtro.semProximo'),
        contagem: contar(REGRAS['agenda:sem']!),
      },
    ],
  },
])

// ------------------------------------------------------------------ datas da linha

/**
 * "12 de out." — dia e mês por extenso curto, com o ano só quando não é o deste ano. "12/10" pede
 * para a pessoa lembrar qual número é o dia; "12 de out." se lê.
 */
function dataLegivel(iso: string) {
  const data = clinicClock.dateOf(iso)
  const mesmoAno = data.slice(0, 4) === clinicClock.today().slice(0, 4)

  return new Intl.DateTimeFormat(INTL_LOCALE[locale.value as Locale], {
    day: 'numeric',
    month: 'short',
    ...(mesmoAno ? {} : { year: 'numeric' as const }),
    timeZone: 'UTC',
  }).format(new Date(`${data}T12:00:00Z`))
}

const DIA_MS = 24 * 60 * 60 * 1000

/** Dias de calendário entre hoje e a data — e não horas divididas por 24, que fazem "em 37 h". */
function diasAte(iso: string) {
  const data = clinicClock.dateOf(iso)

  return Math.round(
    (Date.parse(`${data}T12:00:00Z`) - Date.parse(`${clinicClock.today()}T12:00:00Z`)) / DIA_MS,
  )
}

/**
 * A distância até a data, embaixo dela, em linguagem de balcão: "hoje, 14:30", "amanhã, 09:00",
 * "ontem", "há 5 dias". Passados dois meses conta em meses, e passado um ano em anos — "há 240
 * dias" obriga a fazer a conta de cabeça.
 */
function distanciaLegivel(iso: string) {
  const dias = diasAte(iso)

  if (dias === 0) {
    return t('clinico.pacientes.quando.hoje', { hora: formato.hora(iso) })
  }

  if (dias === 1) {
    return t('clinico.pacientes.quando.amanha', { hora: formato.hora(iso) })
  }

  if (dias === -1) {
    return t('clinico.pacientes.quando.ontem')
  }

  const total = Math.abs(dias)
  const meses = Math.round(total / 30.4)
  const anos = Math.floor(total / 365)
  const valor =
    total < 60
      ? t('clinico.formato.dias', { valor: total }, total)
      : anos < 1
        ? t('clinico.formato.meses', { valor: meses }, meses)
        : t('clinico.formato.anos', { valor: anos }, anos)

  return dias < 0
    ? t('clinico.formato.haTempo', { valor })
    : t('clinico.formato.emTempo', { valor })
}

/** O próximo atendimento é hoje: ganha o tom do lugar, é o que a recepção vai procurar. */
function ehHoje(iso: string) {
  return diasAte(iso) === 0
}

function metaDoPaciente(item: PacienteResumo) {
  const { pet } = item

  return [
    formato.especie(pet.especie),
    pet.raca,
    pet.nascimento ? formato.idade(pet.nascimento) : '',
    pet.pesoKg !== null ? formato.peso(pet.pesoKg) : '',
  ]
    .filter(Boolean)
    .join(' · ')
}

// ------------------------------------------------------------------ ações

let atrasoDaBusca: ReturnType<typeof setTimeout> | null = null

function cancelarBuscaAtrasada() {
  if (atrasoDaBusca) {
    clearTimeout(atrasoDaBusca)
    atrasoDaBusca = null
  }
}

function cadastrar() {
  void router.push('/veterinario/paciente/novo')
}

function importar() {
  void router.push('/veterinario/paciente/importar')
}

function abrir(linha: PacienteResumo) {
  void router.push(`/veterinario/paciente/${linha.pet.id}/historico`)
}

async function buscar() {
  carregando.value = true
  erro.value = ''

  try {
    linhas.value = await patientRepository.buscar(termo.value)
  } catch {
    erro.value = t('clinico.erros.agenda')
  } finally {
    carregando.value = false
    jaCarregou.value = true
  }
}

watch(termo, () => {
  cancelarBuscaAtrasada()
  atrasoDaBusca = setTimeout(() => void buscar(), 250)
})

onMounted(async () => {
  await clinico.carregar()
  await buscar()
})

// ------------------------------------------------------------------ importação em andamento

const progressoDaImportacao = computed(() =>
  migracao.total === 0 ? 0 : Math.round((migracao.cursor / migracao.total) * 100),
)

const TOM_DA_IMPORTACAO = {
  rodando: { marca: 'ui-marca--lugar', icone: 'ph ph-spin ph-circle-notch' },
  pausada: { marca: 'ui-marca--atencao', icone: 'ph ph-pause-circle' },
  falhou: { marca: 'ui-marca--risco', icone: 'ph ph-warning-circle' },
} as const

const tomDaImportacao = computed(
  () =>
    TOM_DA_IMPORTACAO[migracao.estado as keyof typeof TOM_DA_IMPORTACAO] ??
    TOM_DA_IMPORTACAO.rodando,
)

// ------------------------------------------------------------------ indicadores

/**
 * Os números da lista buscada, lado a lado acima dela: quantos são, quantos têm alerta (e quantos
 * de risco) e quantos têm ou não horário marcado. As mesmas regras do filtro, com as mesmas
 * palavras — o número diz o que o filtro vai trazer antes de alguém abri-lo.
 */
const indicadores = computed(() => {
  const comRisco = contar(REGRAS['alerta:risco']!)

  return [
    {
      id: 'total',
      valor: linhas.value.length,
      rotulo: t('clinico.pacientes.titulo'),
      icone: 'ph ph-paw-print',
      tom: '',
      nota: '',
    },
    {
      id: 'alerta',
      valor: contar(REGRAS['alerta:algum']!),
      rotulo: t('clinico.pacientes.filtro.comAlerta'),
      icone: 'ph ph-warning-diamond',
      tom: comRisco > 0 ? 'risco' : 'neutro',
      nota: comRisco > 0 ? t('clinico.pacientes.saudacao.comRisco', { n: comRisco }, comRisco) : '',
    },
    {
      id: 'com-horario',
      valor: contar(REGRAS['agenda:com']!),
      rotulo: t('clinico.pacientes.filtro.comProximo'),
      icone: 'ph ph-calendar-check',
      tom: '',
      nota: '',
    },
    {
      id: 'sem-horario',
      valor: contar(REGRAS['agenda:sem']!),
      rotulo: t('clinico.pacientes.filtro.semProximo'),
      icone: 'ph ph-calendar-blank',
      tom: 'neutro',
      nota: '',
    },
  ]
})

// ------------------------------------------------------------------ resumo

/** Quantos pacientes, e quantos pedem cuidado antes de entrar na sala. */
const fraseDoResumo = computed(() => {
  if (carregando.value && linhas.value.length === 0) {
    return ''
  }

  const n = visiveis.value.length

  if (termo.value.trim()) {
    return t('clinico.pacientes.saudacao.encontrados', { n }, n)
  }

  const comRisco = visiveis.value.filter((item) =>
    item.pet.alertas.some((alerta) => alerta.severidade === 'risco'),
  ).length
  const base = t('clinico.pacientes.saudacao.total', { n }, n)

  return comRisco > 0
    ? t('clinico.pacientes.resumo.comRisco', {
        total: base,
        risco: t('clinico.pacientes.saudacao.comRisco', { n: comRisco }, comRisco),
      })
    : `${base}.`
})
</script>

<template>
  <UiPagina
    class="tela-pacientes"
    :carregando="carregando && !jaCarregou"
    :erro="erro && !jaCarregou ? erro : ''"
    bloquear-se-suspenso
    @tentar-de-novo="buscar"
  >
    <template v-if="fraseDoResumo" #resumo>
      <span aria-live="polite">{{ fraseDoResumo }}</span>
    </template>

    <template #acoes>
      <Button
        type="button"
        severity="secondary"
        outlined
        icon="ph ph-file-arrow-up"
        :label="t('clinico.migracao.atalho')"
        @click="importar"
      />
      <Button
        type="button"
        icon="ph ph-plus"
        :label="t('clinico.paciente.novo.salvarCompleto')"
        @click="cadastrar"
      />
    </template>

    <div class="pacientes">
      <!--
        A importação que ainda não acabou. É por este aviso que "continuar depois" se acha depois:
        o assistente pode ter ficado para trás há duas telas.
      -->
      <div
        v-if="migracao.emAndamento"
        class="importacao ui-folha ui-marca"
        :class="tomDaImportacao.marca"
        role="status"
      >
        <span class="importacao__icone" :class="`importacao__icone--${migracao.estado}`">
          <i :class="tomDaImportacao.icone" aria-hidden="true" />
        </span>
        <span class="importacao__texto">
          <strong>
            {{
              t(`clinico.migracao.aviso.lista.${migracao.estado}`, {
                feitas: formato.numero(migracao.cursor, 0),
                total: formato.numero(migracao.total, 0),
              })
            }}
          </strong>
          <span
            class="importacao__barra"
            :class="`importacao__barra--${migracao.estado}`"
            role="progressbar"
            :aria-valuenow="progressoDaImportacao"
            aria-valuemin="0"
            aria-valuemax="100"
            :aria-label="t('clinico.migracao.importacao.progressoAria')"
          >
            <span :style="{ inlineSize: `${progressoDaImportacao}%` }" />
          </span>
        </span>
        <Button
          type="button"
          size="small"
          severity="secondary"
          outlined
          :icon="migracao.estado === 'rodando' ? 'ph ph-eye' : 'ph ph-play'"
          :label="
            t(
              migracao.estado === 'rodando'
                ? 'clinico.migracao.aviso.lista.ver'
                : 'clinico.migracao.aviso.lista.continuar',
            )
          "
          @click="importar"
        />
      </div>

      <!-- Os números da lista: quantos, quantos com alerta, quantos com e sem horário. -->
      <ul class="ui-indicadores indicadores" :aria-label="t('clinico.pacientes.titulo')">
        <li v-for="item in indicadores" :key="item.id" class="ui-indicador">
          <span
            class="ui-ladrilho"
            :class="item.tom ? `ui-ladrilho--${item.tom}` : ''"
            aria-hidden="true"
          >
            <i :class="item.icone" />
          </span>
          <span class="ui-indicador__valor">{{ formato.numero(item.valor, 0) }}</span>
          <span class="ui-indicador__rotulo">{{ item.rotulo }}</span>
          <span v-if="item.nota" class="ui-indicador__nota indicadores__nota">{{ item.nota }}</span>
        </li>
      </ul>

      <!--
        A lista é um cartão só: a barra de procurar no alto (o campo grande, os filtros ao lado e
        quantos sobraram), o cabeçalho das colunas num poço e as linhas.
      -->
      <section class="lista ui-folha" :aria-label="t('clinico.pacientes.titulo')">
        <div class="procura" role="search">
          <ClinicFilterBar
            v-model:busca="termo"
            v-model:selecionados="selecionados"
            :grupos="grupos"
            :placeholder-busca="t('clinico.pacientes.procurar')"
            :resultado="visiveis.length"
          />
        </div>

        <ClinicDataTable
          :colunas="colunas"
          :linhas="visiveis"
          :chave="(linha) => linha.pet.id"
          :carregando="carregando"
          :erro="jaCarregou ? erro : ''"
          :vazio-titulo="t('clinico.pacientes.vazioTitulo')"
          :vazio-descricao="t('clinico.pacientes.vazioDescricao')"
          :rotulo="t('clinico.pacientes.titulo')"
          @selecionar="abrir"
          @ativar="abrir"
          @tentar-de-novo="buscar"
        >
          <template #vazio-acao>
            <Button
              type="button"
              icon="ph ph-plus"
              severity="secondary"
              outlined
              :label="t('clinico.paciente.novo.salvarCompleto')"
              @click="cadastrar"
            />
          </template>

          <template #celula-paciente="{ linha }">
            <ClinicPacienteCelula :pet="linha.pet">
              <!--
              No celular a coluna de alertas fica fora da vista (a tabela rola de lado): o alerta
              mais grave sobe para o lado do nome, para ninguém precisar rolar para saber dele.
            -->
              <template v-if="linha.pet.alertas.length > 0" #selo>
                <span
                  class="ui-selo alertas__estreito"
                  :class="TOM_DO_ALERTA[alertasOrdenados(linha.pet.alertas)[0]!.severidade]"
                  aria-hidden="true"
                >
                  <i :class="ICONE_DO_ALERTA[alertasOrdenados(linha.pet.alertas)[0]!.kind]" />
                  {{ formato.alerta(alertasOrdenados(linha.pet.alertas)[0]!.kind) }}
                </span>
              </template>
              {{ metaDoPaciente(linha) }}
            </ClinicPacienteCelula>
          </template>

          <template #celula-responsavel="{ linha }">
            <span v-if="linha.tutor" class="responsavel">
              <span class="responsavel__nome">{{ linha.tutor.nome }}</span>
              <span v-if="linha.tutor.telefone" class="responsavel__telefone ui-num">
                <i class="ph ph-phone" aria-hidden="true" />
                <bdi dir="ltr">{{ linha.tutor.telefone }}</bdi>
              </span>
            </span>
          </template>

          <template #celula-ultimo="{ linha }">
            <span v-if="linha.ultimoAtendimentoEm" class="quando">
              <strong class="ui-num">{{ dataLegivel(linha.ultimoAtendimentoEm) }}</strong>
              <small>{{ distanciaLegivel(linha.ultimoAtendimentoEm) }}</small>
            </span>
            <span v-else class="quando quando--nada">{{ t('clinico.pacientes.semRegistro') }}</span>
          </template>

          <template #celula-proximo="{ linha }">
            <span
              v-if="linha.proximoAtendimentoEm"
              class="quando quando--proximo"
              :class="{ 'quando--hoje': ehHoje(linha.proximoAtendimentoEm) }"
            >
              <strong class="ui-num">
                <i class="ph ph-calendar-check" aria-hidden="true" />
                {{ dataLegivel(linha.proximoAtendimentoEm) }}
              </strong>
              <small>{{ distanciaLegivel(linha.proximoAtendimentoEm) }}</small>
            </span>
            <span v-else class="quando quando--nada">{{ t('clinico.pacientes.nadaMarcado') }}</span>
          </template>

          <template #celula-alertas="{ linha }">
            <span
              v-if="linha.pet.alertas.length > 0"
              class="alertas"
              :title="frasesDosAlertas(linha.pet.alertas)"
            >
              <span
                v-for="alerta in alertasOrdenados(linha.pet.alertas).slice(0, SELOS_POR_LINHA)"
                :key="alerta.id"
                class="ui-selo alertas__selo"
                :class="TOM_DO_ALERTA[alerta.severidade]"
                aria-hidden="true"
              >
                <i :class="ICONE_DO_ALERTA[alerta.kind]" />
                {{ formato.alerta(alerta.kind) }}
              </span>
              <span
                v-if="linha.pet.alertas.length > SELOS_POR_LINHA"
                class="ui-selo ui-selo--contorno alertas__mais ui-num"
                aria-hidden="true"
              >
                +{{ linha.pet.alertas.length - SELOS_POR_LINHA }}
              </span>
              <span class="sr-only">{{ frasesDosAlertas(linha.pet.alertas) }}</span>
            </span>
          </template>
        </ClinicDataTable>
      </section>
    </div>
  </UiPagina>
</template>

<style scoped>
.pacientes {
  display: grid;
  gap: 22px;
}

/* ---------------------------------------------------------------------------- indicadores */

.indicadores {
  margin: 0;
  padding: 0;
  list-style: none;
}

.indicadores__nota {
  color: var(--risco-tinta);
  font-weight: 550;
}

/* No celular, dois por linha e mais baixos: os números não podem empurrar a lista para longe. */
@media (max-width: 640px) {
  .indicadores {
    gap: 10px;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .indicadores .ui-indicador {
    padding: 14px 14px 12px;
  }

  .indicadores :deep(.ui-indicador__valor) {
    font-size: 24px;
  }

  .indicadores .ui-ladrilho {
    top: 12px;
    right: 12px;
    width: 30px;
    height: 30px;
    border-radius: 9px;
    font-size: 16px;
  }
}

/* ------------------------------------------------------------------------------- a lista */

.lista {
  min-width: 0;
  overflow: hidden;
}

/* A tabela da casa perde a moldura própria: ela já está dentro do cartão. */
.lista :deep(.tabela) {
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

.lista :deep(.tabela__cabecalho) {
  min-height: 42px;
  border-top: 1px solid var(--linha);
  background: var(--superficie-2);
}

.lista :deep(.tabela .tabela__th) {
  color: var(--tinta-3);
  font-weight: 600;
}

.lista :deep(.tabela__linha) {
  min-height: 64px;
  border-bottom-color: var(--linha-suave);
}

.lista :deep(.tabela__cabecalho),
.lista :deep(.tabela__linha) {
  padding-inline: 20px;
}

@media (max-width: 900px) {
  .lista :deep(.tabela__cabecalho),
  .lista :deep(.tabela__linha) {
    padding-inline: 14px;
  }
}

/* ------------------------------------------------------------------------------- a importação */

.importacao {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 16px;
  padding: 14px 16px 14px 20px;
}

.importacao__icone {
  display: grid;
  width: 36px;
  height: 36px;
  flex: none;
  place-items: center;
  border-radius: 10px;
  background: var(--pj-lugar-fundo, var(--clinica-fundo));
  color: var(--pj-lugar-tinta, var(--clinica-tinta));
  font-size: 19px;
}

.importacao__icone--pausada {
  background: var(--atencao-fundo);
  color: var(--atencao-tinta);
}

.importacao__icone--falhou {
  background: var(--risco-fundo);
  color: var(--risco-tinta);
}

.importacao__texto {
  display: grid;
  flex: 1 1 18rem;
  min-width: 0;
  gap: 8px;
}

.importacao__texto strong {
  color: var(--tinta);
  font-size: 14.5px;
  font-weight: 600;
}

.importacao__barra {
  display: block;
  overflow: hidden;
  max-width: 28rem;
  height: 6px;
  border-radius: 999px;
  background: var(--superficie-3);
}

.importacao__barra > span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--pj-lugar, var(--musgo));
  transition: inline-size var(--pj-tempo-medio, 200ms) ease-out;
}

.importacao__barra--pausada > span {
  background: var(--atencao);
}

.importacao__barra--falhou > span {
  background: var(--risco);
}

/* ---------------------------------------------------------------------------------- procurar */

/*
 * O campo de busca é o maior controle da tela: 48 px de altura e a largura que a frase pede. A
 * barra de filtros é a da casa; aqui só se aumenta a escala dela, sem mudar o que ela faz.
 */
.procura {
  display: block;
  padding: 16px 20px;
}

.procura :deep(.filtro__linha) {
  gap: 10px 12px;
}

.procura :deep(.filtro__busca) {
  flex: 1 1 26rem;
  max-width: 46rem;
}

.procura :deep(.filtro__busca .p-inputtext) {
  min-height: 48px;
  padding-inline-start: 46px;
  border-radius: var(--raio-controle);
  font-size: 15.5px;
}

.procura :deep(.filtro__busca .p-inputicon) {
  inset-inline-start: 16px;
  color: var(--tinta-2);
  font-size: 20px;
}

.procura :deep(.filtro__botao.p-button) {
  min-height: 48px;
  padding-inline: 18px;
  border-radius: var(--raio-controle);
  font-size: 14.5px;
}

.procura :deep(.filtro__resultado) {
  margin-inline-start: auto;
  color: var(--tinta-2);
  font-size: 13.5px;
}

/* ------------------------------------------------------------------------------ as células */

.responsavel {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.responsavel__nome {
  overflow: hidden;
  color: var(--tinta);
  font-size: 14px;
  font-weight: 550;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.responsavel__telefone {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--tinta-2);
  font-size: 13px;
  white-space: nowrap;
}

.responsavel__telefone i {
  color: var(--tinta-3);
  font-size: 13px;
}

/* A data que se lê em cima, a distância embaixo: "12 de out." / "há 3 dias". */
.quando {
  display: grid;
  gap: 1px;
  line-height: 1.3;
}

.quando strong {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--tinta);
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
}

.quando strong i {
  color: var(--tinta-3);
  font-size: 14px;
}

.quando small {
  color: var(--tinta-2);
  font-size: 12.5px;
  white-space: nowrap;
}

.quando--proximo strong i {
  color: var(--pj-lugar-tinta, var(--clinica-tinta));
}

.quando--hoje strong {
  color: var(--pj-lugar-tinta, var(--clinica-tinta));
}

.quando--nada {
  color: var(--tinta-3);
  font-size: 13px;
}

/* Os alertas: até dois selos com a palavra, o resto em "+N". */
.alertas {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 5px;
}

.alertas__selo {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}

.alertas__mais {
  padding-inline: 7px;
}

.alertas__estreito {
  display: none;
}

.sr-only {
  position: absolute;
  overflow: hidden;
  width: 1px;
  height: 1px;
  clip-path: inset(50%);
  white-space: nowrap;
}

@media (prefers-reduced-motion: reduce) {
  .importacao__barra > span {
    transition: none;
  }
}

@media (max-width: 640px) {
  /* Nome comprido empurra o selo para a linha de baixo, em vez de espremê-lo até sumir. */
  .tela-pacientes :deep(.paciente__linha) {
    flex-wrap: wrap;
    row-gap: 3px;
  }

  .alertas__estreito {
    display: inline-flex;
    max-width: 100%;
    overflow: hidden;
    height: 20px;
    padding-inline: 6px;
    font-size: 11.5px;
  }

  .procura {
    padding: 14px 14px 12px;
  }

  .procura :deep(.filtro__busca .p-inputtext) {
    min-height: 46px;
    font-size: 15px;
  }

  .procura :deep(.filtro__botao.p-button) {
    min-height: 46px;
  }
}
</style>
