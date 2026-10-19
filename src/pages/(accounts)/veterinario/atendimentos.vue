<script setup lang="ts">
/**
 * Atendimentos.
 *
 * Lista os registros finalizados, do mais recente para o mais antigo, e destaca os que ainda
 * estão em rascunho — porque rascunho aberto é atendimento sem fecho, e é o que precisa de
 * atenção antes de qualquer histórico.
 *
 * Em blocos: os rascunhos primeiro, num grupo próprio, e depois um bloco por dia ("Hoje",
 * "Ontem", "qua., 30/09"). Eram 63 linhas corridas com a data repetida em cada uma, numa coluna
 * chamada "Último atendimento" — que não era o último de ninguém, era a data daquele.
 *
 * ## A forma (redesenho de 19/10/2026)
 *
 * A tela tem duas perguntas, nesta ordem: **o que falta assinar** e **o que já foi feito**.
 *
 * 1. "Para assinar" abre a tela: uma seção com a contagem e o porquê, um paciente por linha, do
 *    rascunho mais antigo para o mais novo. Rascunho de outro dia é atendimento esquecido: ganha a
 *    marca âmbar na borda e o selo com a idade ("Aberto há 21 dias"). A ação principal da tela é
 *    continuar exatamente esse, o mais antigo — o mesmo que a frase de estado nomeia.
 * 2. "Assinados" vem depois, agrupado por dia, cada dia na sua folha: a hora em algarismos de
 *    mesma largura, o rosto e o nome do paciente com o responsável embaixo, o diagnóstico
 *    principal (com "+N" quando há outros) e quem atendeu.
 *
 * A linha inteira abre o prontuário. Busca e filtros (situação, profissional) ficam no alto, antes
 * das duas seções, e valem para as duas.
 */
import Button from 'primevue/button'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRouter } from 'vue-router'

import UiPagina from '@/components/ui/UiPagina.vue'
import UiSecao from '@/components/ui/UiSecao.vue'
import ClinicFilterBar from '@/features/clinico/components/base/ClinicFilterBar.vue'
import type { GrupoDeFiltro } from '@/features/clinico/components/base/filter-types'
import { useClinicFormat } from '@/features/clinico/composables/useClinicFormat'
import { encounterRepository } from '@/features/clinico/data/repositories'
import type { Encounter } from '@/features/clinico/data/types'
import { diffDays } from '@/features/clinico/domain/clinic-time'
import { clinicClock, useClinicoStore } from '@/features/clinico/stores/clinico'
import PetAvatar from '@/features/hotel/components/base/PetAvatar.vue'

const { t } = useI18n()
const router = useRouter()
const clinico = useClinicoStore()
const formato = useClinicFormat()

const rascunhos = ref<Encounter[]>([])
const finalizados = ref<Encounter[]>([])
const carregando = ref(false)
const erro = ref('')
const termo = ref('')
const selecionados = ref<Record<string, string[]>>({})

const linhas = computed(() => [...rascunhos.value, ...finalizados.value])

function normalizar(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

/**
 * A busca aqui é por paciente ou diagnóstico — as duas formas de alguém procurar um
 * prontuário que já viu. Código de diagnóstico entra junto, para quem trabalha pelo catálogo.
 */
function atendeBusca(encounter: Encounter) {
  const alvo = normalizar(termo.value.trim())

  if (!alvo) {
    return true
  }

  const paciente = clinico.pet(encounter.petId)?.nome ?? ''
  const diagnosticos = encounter.diagnosticos
    .map((item) => `${item.codigo} ${clinico.descricaoDoDiagnostico(item)}`)
    .join(' ')

  return (
    normalizar(paciente).includes(alvo) ||
    normalizar(diagnosticos).includes(alvo) ||
    normalizar(encounter.anamnese.queixaPrincipal).includes(alvo)
  )
}

function atendeFiltros(encounter: Encounter) {
  const situacoes = selecionados.value.situacao ?? []
  const profissionais = selecionados.value.profissional ?? []

  return (
    (situacoes.length === 0 || situacoes.includes(encounter.status)) &&
    (profissionais.length === 0 || profissionais.includes(encounter.professionalId))
  )
}

const visiveis = computed(() =>
  linhas.value.filter((item) => atendeBusca(item) && atendeFiltros(item)),
)

function contar(regra: (item: Encounter) => boolean) {
  return linhas.value.filter(regra).length
}

const grupos = computed<GrupoDeFiltro[]>(() => [
  {
    id: 'situacao',
    rotulo: t('clinico.prontuario.filtro.situacao'),
    opcoes: [
      {
        valor: 'rascunho',
        rotulo: t('clinico.prontuario.rascunho'),
        contagem: contar((item) => item.status === 'rascunho'),
      },
      {
        valor: 'finalizado',
        rotulo: t('clinico.prontuario.finalizado'),
        contagem: contar((item) => item.status === 'finalizado'),
      },
    ],
  },
  {
    id: 'profissional',
    rotulo: t('clinico.prontuario.filtro.profissional'),
    opcoes: clinico.profissionais
      .map((profissional) => ({
        valor: profissional.id,
        rotulo: profissional.nome,
        contagem: contar((item) => item.professionalId === profissional.id),
      }))
      .filter((opcao) => opcao.contagem > 0),
  },
])

/** "Hoje", "Ontem", ou o dia da semana com a data: é como a recepção fala do dia. */
function rotuloDoDia(dia: string) {
  const distancia = diffDays(dia, clinicClock.today())

  if (distancia === 0) {
    return t('clinico.atendimentos.dia.hoje')
  }

  if (distancia === 1) {
    return t('clinico.atendimentos.dia.ontem')
  }

  const rotulo = `${formato.diaDaSemanaCurto(dia)}, ${formato.dataCurta(dia)}`

  /* O `Intl` entrega "sáb."; o título do bloco começa em maiúscula, como "Hoje" e "Ontem". */
  return rotulo.charAt(0).toLocaleUpperCase() + rotulo.slice(1)
}

/** A data de um rascunho: com o ano quando ele é de outro ano — aí ele é mais que esquecido. */
function dataDoRascunho(encounter: Encounter) {
  const dia = clinicClock.dateOf(encounter.abertoEm)

  if (diffDays(dia, clinicClock.today()) === 0) {
    return t('clinico.atendimentos.dia.hoje')
  }

  return dia.slice(0, 4) === clinicClock.today().slice(0, 4)
    ? formato.dataCurta(dia)
    : formato.dataCurtaComAno(dia)
}

/** Dias desde que o rascunho foi aberto. Zero é hoje: ainda é trabalho do dia, não esquecimento. */
function diasAberto(encounter: Encounter) {
  return Math.max(0, diffDays(clinicClock.dateOf(encounter.abertoEm), clinicClock.today()))
}

/** Os rascunhos, do mais antigo para o mais novo: o esquecido vem primeiro. */
const rascunhosVisiveis = computed(() =>
  visiveis.value
    .filter((item) => item.status === 'rascunho')
    .sort((a, b) => a.abertoEm.localeCompare(b.abertoEm)),
)

type Dia = { chave: string; titulo: string; itens: Encounter[] }

/** Os assinados, um bloco por dia, do mais recente para trás. */
const dias = computed<Dia[]>(() => {
  const lista: Dia[] = []
  const assinados = visiveis.value
    .filter((item) => item.status !== 'rascunho')
    .sort((a, b) => (b.finalizadoEm ?? b.abertoEm).localeCompare(a.finalizadoEm ?? a.abertoEm))

  for (const item of assinados) {
    const dia = encounterRepository.dataDe(item)
    let bloco = lista.at(-1)

    if (!bloco || bloco.chave !== dia) {
      bloco = { chave: dia, titulo: rotuloDoDia(dia), itens: [] }
      lista.push(bloco)
    }

    bloco.itens.push(item)
  }

  return lista
})

const totalAssinadosVisiveis = computed(() =>
  dias.value.reduce((total, dia) => total + dia.itens.length, 0),
)

/** O rascunho mais antigo de todos (sem filtro): é por ele que a assinatura começa. */
const maisAntigo = computed(
  () => [...rascunhos.value].sort((a, b) => a.abertoEm.localeCompare(b.abertoEm))[0] ?? null,
)

/**
 * A frase de estado: quantos faltam assinar (e desde quando, se algum é de outro dia), e quantos
 * foram assinados no período que a lista cobre.
 */
const fraseDoResumo = computed(() => {
  if (carregando.value && linhas.value.length === 0) {
    return ''
  }

  const partes: string[] = []
  const n = rascunhos.value.length
  const antigo = maisAntigo.value

  if (n === 0) {
    partes.push(t('clinico.atendimentos.resumo.emDia'))
  } else if (antigo && diasAberto(antigo) > 0) {
    partes.push(
      t(
        'clinico.atendimentos.resumo.rascunhosAntigo',
        { total: n, data: dataDoRascunho(antigo) },
        n,
      ),
    )
  } else {
    partes.push(t('clinico.atendimentos.resumo.rascunhos', { total: n }, n))
  }

  const assinados = finalizados.value.length
  const primeiro = finalizados.value.at(-1)

  if (assinados > 0 && primeiro) {
    partes.push(
      t(
        'clinico.atendimentos.resumo.assinados',
        { total: assinados, data: formato.dataCurta(encounterRepository.dataDe(primeiro)) },
        assinados,
      ),
    )
  }

  return partes.join(' ')
})

const vazio = computed(() => !carregando.value && !erro.value && linhas.value.length === 0)

/** A busca ou o filtro não deixaram nada: a lista diz isso no lugar das seções. */
const nadaEncontrado = computed(
  () => !vazio.value && !carregando.value && visiveis.value.length === 0,
)

function rotaDe(encounter: Encounter) {
  return `/veterinario/atendimento/${encounter.id}`
}

/** O que a linha diz que foi o atendimento: o diagnóstico principal, ou a queixa no rascunho. */
function oQueFoi(encounter: Encounter) {
  return clinico.diagnosticoPrincipal(encounter) || encounter.anamnese.queixaPrincipal
}

/** Todos os diagnósticos, para a dica do "+N". */
function todosOsDiagnosticos(encounter: Encounter) {
  return encounter.diagnosticos.map((item) => clinico.descricaoDoDiagnostico(item)).join('; ')
}

async function carregar() {
  carregando.value = true
  erro.value = ''

  try {
    await clinico.carregar()
    const [emRascunho, concluidos] = await Promise.all([
      encounterRepository.listarRascunhos(null),
      encounterRepository.listarFinalizados(60),
    ])

    rascunhos.value = emRascunho
    finalizados.value = concluidos
  } catch {
    erro.value = t('clinico.erros.prontuario')
  } finally {
    carregando.value = false
  }
}

function abrir(encounter: Encounter) {
  void router.push(rotaDe(encounter))
}

onMounted(carregar)
</script>

<template>
  <UiPagina
    class="tela-atendimentos"
    :carregando="carregando && linhas.length === 0"
    :erro="erro"
    :vazio="vazio"
    :vazio-titulo="t('clinico.prontuario.vazioTitulo')"
    :vazio-descricao="t('clinico.prontuario.vazioDescricao')"
    vazio-icone="ph ph-clipboard-text"
    bloquear-se-suspenso
    @tentar-de-novo="carregar"
  >
    <template v-if="fraseDoResumo" #resumo>
      <span aria-live="polite">{{ fraseDoResumo }}</span>
    </template>

    <template #acoes>
      <Button
        v-if="maisAntigo"
        type="button"
        icon="ph ph-note-pencil"
        :label="
          t('clinico.atendimentos.continuarRascunho', {
            pet: clinico.pet(maisAntigo.petId)?.nome ?? '',
          })
        "
        @click="abrir(maisAntigo)"
      />
    </template>

    <div class="atendimentos">
      <!-- Procurar: paciente, diagnóstico ou queixa; os filtros ao lado e quantos sobraram. -->
      <div class="procura" role="search">
        <ClinicFilterBar
          v-model:busca="termo"
          v-model:selecionados="selecionados"
          :grupos="grupos"
          :placeholder-busca="t('clinico.prontuario.buscar')"
          :resultado="visiveis.length"
        />
      </div>

      <p v-if="nadaEncontrado" class="ui-folha ui-vazio">
        <strong>{{ t('clinico.comum.semResultado') }}</strong>
      </p>

      <!-- O que falta assinar: a única coisa desta tela que pede ação. -->
      <UiSecao
        v-if="rascunhosVisiveis.length"
        id="atendimentos-rascunhos"
        :titulo="t('clinico.atendimentos.paraAssinar')"
        :contagem="rascunhosVisiveis.length"
        :descricao="t('clinico.atividades.porque.rascunhos')"
        icone="ph ph-note-pencil"
      >
        <ul class="ui-folha ui-lista">
          <li v-for="item in rascunhosVisiveis" :key="item.id">
            <RouterLink
              class="ui-linha registro registro--rascunho"
              :class="{ 'ui-marca ui-marca--atencao': diasAberto(item) > 0 }"
              :to="rotaDe(item)"
            >
              <span class="registro__quando">
                <span class="ui-hora">{{ formato.hora(item.abertoEm) }}</span>
                <small class="ui-num">{{ dataDoRascunho(item) }}</small>
              </span>

              <PetAvatar
                class="registro__rosto"
                :nome="clinico.pet(item.petId)?.nome ?? ''"
                :iniciais="clinico.pet(item.petId)?.iniciais ?? ''"
                :especie="clinico.pet(item.petId)?.especie ?? null"
                :foto-url="clinico.pet(item.petId)?.fotoUrl ?? ''"
                tamanho="md"
              />

              <span class="registro__quem">
                <strong class="registro__nome">{{ clinico.pet(item.petId)?.nome }}</strong>
                <span class="registro__tutor">{{ clinico.tutor(item.tutorId)?.nome }}</span>
              </span>

              <span class="registro__oque" :title="todosOsDiagnosticos(item) || undefined">
                <span v-if="oQueFoi(item)" class="registro__texto">{{ oQueFoi(item) }}</span>
                <span v-else class="registro__texto registro__texto--vazio">
                  {{ t('clinico.atividades.semQueixa') }}
                </span>
                <span v-if="item.diagnosticos.length > 1" class="ui-contagem registro__mais">
                  +{{ item.diagnosticos.length - 1 }}
                </span>
              </span>

              <span class="registro__profissional">
                <i class="ph ph-stethoscope" aria-hidden="true" />
                <span>{{ clinico.profissional(item.professionalId)?.nome }}</span>
              </span>

              <span class="registro__estado">
                <span v-if="diasAberto(item) > 0" class="ui-selo ui-selo--atencao">
                  <i class="ph ph-clock" aria-hidden="true" />
                  {{
                    t('clinico.atividades.abertoHa', { total: diasAberto(item) }, diasAberto(item))
                  }}
                </span>
              </span>

              <i class="ph ph-caret-right ui-linha__seta registro__seta" aria-hidden="true" />
            </RouterLink>
          </li>
        </ul>
      </UiSecao>

      <!-- O que já foi feito: um bloco por dia, do mais recente para trás. -->
      <UiSecao
        v-if="dias.length"
        id="atendimentos-assinados"
        :titulo="t('clinico.atendimentos.assinados')"
        :contagem="totalAssinadosVisiveis"
        :descricao="t('clinico.atendimentos.assinadosDescricao')"
        icone="ph ph-seal-check"
      >
        <div class="dias">
          <section
            v-for="dia in dias"
            :key="dia.chave"
            class="dia"
            :aria-labelledby="`atendimentos-dia-${dia.chave}`"
          >
            <h3 :id="`atendimentos-dia-${dia.chave}`" class="dia__titulo">
              <time :datetime="dia.chave">{{ dia.titulo }}</time>
              <span class="ui-contagem">{{ dia.itens.length }}</span>
            </h3>

            <ul class="ui-folha ui-lista">
              <li v-for="item in dia.itens" :key="item.id">
                <RouterLink class="ui-linha registro" :to="rotaDe(item)">
                  <span class="registro__quando">
                    <span class="ui-hora">{{ formato.hora(item.finalizadoEm ?? item.abertoEm) }}</span>
                  </span>

                  <PetAvatar
                    class="registro__rosto"
                    :nome="clinico.pet(item.petId)?.nome ?? ''"
                    :iniciais="clinico.pet(item.petId)?.iniciais ?? ''"
                    :especie="clinico.pet(item.petId)?.especie ?? null"
                    :foto-url="clinico.pet(item.petId)?.fotoUrl ?? ''"
                    tamanho="md"
                  />

                  <span class="registro__quem">
                    <strong class="registro__nome">{{ clinico.pet(item.petId)?.nome }}</strong>
                    <span class="registro__tutor">{{ clinico.tutor(item.tutorId)?.nome }}</span>
                  </span>

                  <span class="registro__oque" :title="todosOsDiagnosticos(item) || undefined">
                    <span v-if="oQueFoi(item)" class="registro__texto">{{ oQueFoi(item) }}</span>
                    <span v-else class="registro__texto registro__texto--vazio">
                      {{ t('clinico.atividades.semDiagnostico') }}
                    </span>
                    <span v-if="item.diagnosticos.length > 1" class="ui-contagem registro__mais">
                      +{{ item.diagnosticos.length - 1 }}
                    </span>
                  </span>

                  <span class="registro__profissional">
                    <i class="ph ph-stethoscope" aria-hidden="true" />
                    <span>{{ clinico.profissional(item.professionalId)?.nome }}</span>
                  </span>

                  <i class="ph ph-caret-right ui-linha__seta registro__seta" aria-hidden="true" />
                </RouterLink>
              </li>
            </ul>
          </section>
        </div>
      </UiSecao>
    </div>
  </UiPagina>
</template>

<style scoped>
.atendimentos {
  display: grid;
  gap: 32px;
}

/* ---------------------------------------------------------------------------------- procurar */

/* A barra de filtros é a da casa; aqui só se aumenta a escala do campo, como na lista de Pacientes. */
.procura :deep(.filtro__linha) {
  gap: 10px 12px;
}

.procura :deep(.filtro__busca) {
  flex: 1 1 26rem;
  max-width: 40rem;
}

.procura :deep(.filtro__busca .p-inputtext) {
  min-height: 46px;
  padding-inline-start: 44px;
  border-radius: 12px;
  font-size: 15px;
}

.procura :deep(.filtro__busca .p-inputicon) {
  inset-inline-start: 15px;
  color: var(--tinta-2);
  font-size: 18px;
}

.procura :deep(.filtro__botao.p-button) {
  min-height: 46px;
  padding-inline: 16px;
  border-radius: 12px;
}

/* ------------------------------------------------------------------------------------ os dias */

.dias {
  display: grid;
  gap: 22px;
}

.dia {
  display: grid;
  gap: 10px;
}

.dia__titulo {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding-inline-start: 2px;
  color: var(--tinta);
  font-size: 14.5px;
  font-weight: 600;
}

/* ---------------------------------------------------------------------------------- a linha */

/*
 * Uma grade em vez do flex da linha do kit: as colunas (hora, paciente, diagnóstico, profissional)
 * alinham de cima a baixo dentro do dia, e o olho corre a coluna do diagnóstico sem tropeçar.
 */
.registro {
  display: grid;
  align-items: center;
  column-gap: 14px;
  grid-template-areas: 'quando rosto quem oque prof seta';
  grid-template-columns:
    52px 40px minmax(0, 1fr) minmax(0, 1.55fr) minmax(0, 0.95fr)
    16px;
  padding-block: 9px;
}

.registro--rascunho {
  /* Largura fixa para o selo de idade: as colunas dos rascunhos alinham com ou sem ele. */
  --registro-estado: 152px;

  grid-template-areas: 'quando rosto quem oque prof estado seta';
  grid-template-columns:
    52px 40px minmax(0, 1fr) minmax(0, 1.55fr) minmax(0, 0.95fr)
    var(--registro-estado) 16px;
}

.registro__quando {
  display: grid;
  grid-area: quando;
  gap: 1px;
  line-height: 1.2;
}

.registro__quando small {
  color: var(--tinta-2);
  font-size: 12.5px;
  font-weight: 550;
  white-space: nowrap;
}

.registro--rascunho.ui-marca--atencao .registro__quando small {
  color: var(--atencao-tinta);
  font-weight: 650;
}

.registro__rosto {
  grid-area: rosto;
}

.registro__quem {
  display: grid;
  min-width: 0;
  grid-area: quem;
  gap: 1px;
}

.registro__nome {
  overflow: hidden;
  color: var(--tinta);
  font-size: 14.5px;
  font-weight: 600;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.registro__tutor {
  overflow: hidden;
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.registro__oque {
  display: flex;
  min-width: 0;
  align-items: center;
  grid-area: oque;
  gap: 8px;
}

.registro__texto {
  overflow: hidden;
  color: var(--tinta);
  font-size: 14px;
  font-weight: 500;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.registro__texto--vazio {
  color: var(--tinta-3);
  font-weight: 400;
}

.registro__mais.ui-contagem {
  flex: none;
  height: 20px;
  min-width: 0;
  padding: 0 6px;
  font-size: 11.5px;
}

.registro__profissional {
  display: flex;
  min-width: 0;
  align-items: center;
  grid-area: prof;
  gap: 6px;
  color: var(--tinta-2);
  font-size: 13px;
}

.registro__profissional i {
  flex: none;
  color: var(--tinta-3);
  font-size: 15px;
}

.registro__profissional span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.registro__estado {
  display: flex;
  min-width: 0;
  justify-content: flex-end;
  grid-area: estado;
}

.registro__seta {
  grid-area: seta;
}

/* Tela média: o profissional desce para baixo do diagnóstico, na mesma coluna. */
@media (max-width: 1180px) {
  .registro {
    grid-template-areas:
      'quando rosto quem oque seta'
      'quando rosto quem prof seta';
    grid-template-columns: 52px 40px minmax(0, 1fr) minmax(0, 1.4fr) 16px;
    row-gap: 2px;
  }

  .registro--rascunho {
    grid-template-areas:
      'quando rosto quem oque estado seta'
      'quando rosto quem prof estado seta';
    grid-template-columns: 52px 40px minmax(0, 1fr) minmax(0, 1.4fr) var(--registro-estado) 16px;
  }

  .registro__profissional {
    font-size: 12.5px;
  }
}

/*
 * Celular: a hora à esquerda, o rosto, e o texto empilhado — nome, responsável, o que foi, quem
 * atendeu e, no rascunho, a idade dele. A seta fica centrada na linha inteira.
 */
@media (max-width: 760px) {
  .registro,
  .registro--rascunho {
    align-items: start;
    column-gap: 12px;
    grid-template-areas:
      'quando rosto quem seta'
      'quando rosto oque seta'
      'quando rosto prof seta';
    grid-template-columns: 44px 40px minmax(0, 1fr) 16px;
    row-gap: 3px;
    padding-block: 12px;
    padding-inline: 14px 12px;
  }

  .registro--rascunho {
    grid-template-areas:
      'quando rosto quem seta'
      'quando rosto oque seta'
      'quando rosto prof seta'
      'quando rosto estado seta';
  }

  .registro__quando {
    padding-top: 2px;
  }

  .registro__estado {
    justify-content: flex-start;
  }

  .registro__estado:empty {
    display: none;
  }

  .registro__estado .ui-selo {
    margin-top: 4px;
  }

  .registro__texto {
    white-space: normal;
  }

  .registro__seta {
    align-self: center;
  }

  .procura :deep(.filtro__busca) {
    flex-basis: 100%;
    max-width: none;
  }
}
</style>
