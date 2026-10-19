<script setup lang="ts">
/**
 * Busca global do módulo clínico — `Ctrl/⌘ + K` de qualquer tela.
 *
 * ## O problema que ela resolve
 *
 * O módulo tem doze destinos e vinte e quatro pacientes com história. Até aqui, chegar ao Bento
 * exigia saber **por onde** se chega ao Bento: Pacientes se ele veio ontem, Internação se está
 * no leito, Agenda se tem horário hoje, Prontuários se o registro ficou em rascunho. Quem opera
 * a clínica sabe o nome do animal — quase nunca sabe em qual das quatro listas ele está agora.
 * Era essa tradução, feita de cabeça a cada busca, que fazia o fluxo parecer confuso.
 *
 * Aqui se digita o que se sabe — nome do animal, nome de quem responde por ele, telefone, ou o
 * nome da tela — e a resposta é o destino.
 *
 * ## Três decisões
 *
 * **Telas e pacientes na mesma lista, telas primeiro.** Separar em abas obrigaria a escolher
 * antes de procurar, que é exatamente a escolha que quem está perdido não consegue fazer. Telas
 * vêm primeiro porque a lista delas é fixa e curta: o olho a descarta num relance quando não é
 * o que se procura, e a lista de pacientes chega logo abaixo.
 *
 * **Abre mostrando as telas, sem digitar nada.** Uma paleta vazia é uma pergunta feita a quem
 * não sabe a resposta. Com a lista à vista, ela também funciona como o mapa do módulo — que é o
 * segundo uso dela, e o que ensina o menu a quem chegou hoje.
 *
 * **O paciente carrega o que o identifica.** Dois "Mel" no dataset, e é o nome de quem responde
 * por eles que os separa — nunca o `id`. Quem escolhe errado no balcão abre o prontuário errado.
 * E o rosto (`PetAvatar`): quem conhece o animal acha o Bento pela foto antes de ler o nome.
 *
 * ## A cara
 *
 * Uma paleta de comandos: o campo grande no topo, já com o cursor (o `autofocus` é o que diz ao
 * diálogo onde pôr o foco — sem ele o foco ia para o botão de fechar e quem abria com `Ctrl+K` e
 * digitava não escrevia nada), os resultados agrupados em "Telas" e "Pacientes", o item da vez em
 * `--superficie-2` com o traço da Clínica na borda, e as teclas no rodapé. O campo é um
 * `combobox` de verdade: as setas andam pela lista sem tirar o foco dele, e o leitor de tela
 * anuncia o item da vez pelo `aria-activedescendant`.
 */
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import { computed, nextTick, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import type { AppNavigationSection } from '@/composables/useAppNavigation'
import PetAvatar from '@/features/hotel/components/base/PetAvatar.vue'

import { patientRepository, type PacienteResumo } from '../../data/repositories'

const props = defineProps<{
  aberto: boolean
  /** As seções do menu clínico, para as telas entrarem na busca sem uma segunda lista. */
  secoes: AppNavigationSection[]
}>()

const emit = defineEmits<{ fechar: [] }>()

type Destino = {
  chave: string
  tipo: 'tela' | 'paciente'
  rotulo: string
  detalhe: string
  icone: string
  para: string
  /** O rosto, quando o destino é um paciente. */
  pet?: Pick<PacienteResumo['pet'], 'nome' | 'iniciais' | 'especie' | 'fotoUrl'>
}

/**
 * Quantos pacientes a lista mostra.
 *
 * Seis. A busca é para **ir a um**, não para navegar por trinta: quem precisa da lista inteira
 * tem a tela de Pacientes, com filtros, e a busca oferece o caminho para ela quando o termo é
 * genérico demais.
 */
const LIMITE_DE_PACIENTES = 6

/**
 * Espera antes de consultar o repositório.
 *
 * Cento e oitenta milissegundos: abaixo disso a busca dispara uma consulta por tecla e a lista
 * pisca enquanto alguém digita "Açaí"; acima, a lista chega depois do dedo.
 */
const ESPERA_MS = 180

const { t } = useI18n()
const router = useRouter()

const termo = ref('')
const pacientes = ref<PacienteResumo[]>([])
const buscando = ref(false)
const indice = ref(0)
const campo = ref<{ $el: HTMLElement } | null>(null)
const lista = ref<HTMLElement | null>(null)

const idBase = useId()
const idTitulo = `busca-${idBase}-titulo`
const idLista = `busca-${idBase}-lista`
const idDica = `busca-${idBase}-dica`

function idDaOpcao(posicao: number) {
  return `busca-${idBase}-opcao-${posicao}`
}

let temporizador: ReturnType<typeof setTimeout> | undefined
/** Ignora a resposta de uma busca que já foi superada por outra digitação. */
let geracao = 0

const visivel = computed({
  get: () => props.aberto,
  set: (valor: boolean) => {
    if (!valor) {
      emit('fechar')
    }
  },
})

function normalizar(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

/** Todas as telas do módulo, achatadas — clínicas e de pacientes. */
const telas = computed<Destino[]>(() =>
  props.secoes
    .filter((secao) => secao.id === 'clinical' || secao.id === 'patients')
    .flatMap((secao) =>
      (secao.blocos ?? [{ id: secao.id, label: secao.label, items: secao.items }]).flatMap(
        (bloco) =>
          bloco.items.map((item) => ({
            chave: `tela:${item.to}`,
            tipo: 'tela' as const,
            rotulo: item.label,
            /* O nome do bloco é o que diz *quando* aquela tela é usada — "Agora", "Pendências". */
            detalhe: bloco.label,
            icone: item.icon,
            para: item.to,
          })),
      ),
    ),
)

const telasEncontradas = computed(() => {
  const alvo = normalizar(termo.value.trim())

  if (!alvo) {
    return telas.value
  }

  return telas.value.filter(
    (tela) => normalizar(tela.rotulo).includes(alvo) || normalizar(tela.detalhe).includes(alvo),
  )
})

const pacientesEncontrados = computed<Destino[]>(() =>
  pacientes.value.map((linha) => ({
    chave: `pet:${linha.pet.id}`,
    tipo: 'paciente' as const,
    rotulo: linha.pet.nome,
    detalhe: [linha.tutor?.nome, linha.tutor?.telefone].filter(Boolean).join(' · '),
    icone: linha.pet.especie === 'felina' ? 'ph ph-heart' : 'ph ph-user',
    para: `/veterinario/paciente/${linha.pet.id}/historico`,
    pet: {
      nome: linha.pet.nome,
      iniciais: linha.pet.iniciais,
      especie: linha.pet.especie,
      fotoUrl: linha.pet.fotoUrl,
    },
  })),
)

const resultados = computed(() => [...telasEncontradas.value, ...pacientesEncontrados.value])

const vazio = computed(
  () => !buscando.value && termo.value.trim().length > 0 && resultados.value.length === 0,
)

/**
 * A busca de pacientes só começa com duas letras.
 *
 * Uma letra devolve metade do cadastro e transforma a lista num sorteio — e no dataset real
 * seria uma varredura inteira a cada tecla.
 */
async function buscarPacientes(valor: string) {
  const limpo = valor.trim()

  if (limpo.length < 2) {
    pacientes.value = []
    buscando.value = false

    return
  }

  const minha = (geracao += 1)

  buscando.value = true

  try {
    const encontrados = await patientRepository.buscar(limpo, LIMITE_DE_PACIENTES)

    /* Chegou fora de ordem: a resposta de "Be" não pode sobrescrever a de "Bento". */
    if (minha === geracao) {
      pacientes.value = encontrados
    }
  } catch {
    if (minha === geracao) {
      pacientes.value = []
    }
  } finally {
    if (minha === geracao) {
      buscando.value = false
    }
  }
}

/**
 * O item da vez sempre à vista. Com seis pacientes abaixo de doze telas, descer pela seta passa da
 * altura da janela, e o destaque sumia por baixo da borda enquanto o `Enter` continuava valendo
 * para ele.
 */
watch(indice, async () => {
  await nextTick()
  lista.value
    ?.querySelector<HTMLElement>('.busca__item--ativo')
    ?.scrollIntoView?.({ block: 'nearest' })
})

watch(termo, (valor) => {
  indice.value = 0
  clearTimeout(temporizador)
  temporizador = setTimeout(() => void buscarPacientes(valor), ESPERA_MS)
})

watch(
  () => props.aberto,
  async (aberto) => {
    if (!aberto) {
      return
    }

    /*
     * Reabre limpa. Uma busca guardada da consulta anterior é a lista errada em cima da
     * pergunta nova — e quem abre com `Ctrl+K` espera digitar, não apagar.
     */
    termo.value = ''
    pacientes.value = []
    indice.value = 0

    await nextTick()
    campo.value?.$el?.focus()
  },
)

function ir(destino: Destino) {
  emit('fechar')
  void router.push(destino.para)
}

/**
 * A saída do "nada encontrado".
 *
 * Procurar um paciente e não achar é, na clínica, quase sempre a mesma coisa: ele ainda não
 * está cadastrado. Dizer só "nada encontrado" devolve a pergunta a quem perguntou — e este é o
 * ponto do módulo por onde mais gente passa, já que a busca atende o portal inteiro.
 */
function cadastrarPaciente() {
  emit('fechar')
  void router.push('/veterinario/paciente/novo')
}

/**
 * Setas percorrem, `Enter` vai, `Esc` fecha.
 *
 * A lista dá a volta nas duas pontas: com seis resultados, chegar ao último e continuar
 * descendo é mais rápido que subir cinco vezes.
 */
function aoTeclar(evento: KeyboardEvent) {
  const total = resultados.value.length

  if (evento.key === 'ArrowDown' && total > 0) {
    evento.preventDefault()
    indice.value = (indice.value + 1) % total

    return
  }

  if (evento.key === 'ArrowUp' && total > 0) {
    evento.preventDefault()
    indice.value = (indice.value - 1 + total) % total

    return
  }

  if (evento.key === 'Enter') {
    evento.preventDefault()

    const escolhido = resultados.value[indice.value]

    if (escolhido) {
      ir(escolhido)
    }
  }
}
</script>

<template>
  <Dialog
    v-model:visible="visivel"
    modal
    position="top"
    class="hc-tema busca-dialogo"
    :style="{ width: 'min(40rem, 94vw)' }"
    :show-header="false"
    :aria-labelledby="idTitulo"
    dismissable-mask
  >
    <div class="busca__corpo clinic-scope" @keydown="aoTeclar">
      <h2 :id="idTitulo" class="busca__oculto">{{ t('clinico.busca.titulo') }}</h2>
      <p :id="idDica" class="busca__oculto">{{ t('clinico.busca.dica') }}</p>

      <div class="busca__topo">
        <i class="ph ph-magnifying-glass busca__lupa" aria-hidden="true" />
        <InputText
          ref="campo"
          v-model="termo"
          class="busca__campo"
          :placeholder="t('clinico.busca.placeholder')"
          :aria-label="t('clinico.busca.placeholder')"
          role="combobox"
          aria-autocomplete="list"
          :aria-expanded="!vazio"
          :aria-controls="idLista"
          :aria-activedescendant="resultados.length > 0 ? idDaOpcao(indice) : undefined"
          :aria-describedby="idDica"
          autocomplete="off"
          spellcheck="false"
          autofocus
        />
        <span v-if="buscando" class="busca__girando" aria-hidden="true" />
        <button
          type="button"
          class="busca__esc"
          :aria-label="t('clinico.atalhos.fechar')"
          :title="t('clinico.atalhos.fechar')"
          @click="emit('fechar')"
        >
          <kbd>Esc</kbd>
        </button>
      </div>

      <div v-if="vazio" class="busca__vazio">
        <span class="busca__vazio-icone" aria-hidden="true">
          <i class="ph ph-magnifying-glass" />
        </span>
        <p class="busca__vazio-frase">
          {{ t('clinico.busca.semResultado', { termo: termo.trim() }) }}
        </p>

        <Button
          type="button"
          severity="secondary"
          outlined
          icon="ph ph-user-plus"
          :label="t('clinico.paciente.novo.atalho')"
          @click="cadastrarPaciente"
        />
      </div>

      <ul
        v-else
        :id="idLista"
        ref="lista"
        class="busca__lista"
        role="listbox"
        :aria-label="t('clinico.busca.titulo')"
      >
        <li v-if="telasEncontradas.length > 0" class="busca__grupo" role="presentation">
          {{ t('clinico.busca.telas') }}
        </li>

        <template v-for="(destino, posicao) in resultados" :key="destino.chave">
          <!--
            O rótulo do grupo de pacientes nasce no meio da lista, e não como segundo `<ul>`: duas
            listas separadas quebrariam a navegação por setas, que é o modo como esta janela foi
            feita para ser usada.
          -->
          <li
            v-if="destino.tipo === 'paciente' && resultados[posicao - 1]?.tipo !== 'paciente'"
            class="busca__grupo"
            role="presentation"
          >
            {{ t('clinico.busca.pacientes') }}
          </li>

          <!--
            O item é a própria opção, clicável — e não um botão dentro dela: o foco fica no campo, e
            as setas andam pela lista sem tirá-lo de lá. O item ativo é o do teclado **e** o do
            mouse: `mouseenter` move o índice em vez de acender um segundo destaque. Com dois
            realces na tela, `Enter` vai para um lugar e o olho está no outro.
          -->
          <li
            :id="idDaOpcao(posicao)"
            class="busca__item"
            :class="{
              'busca__item--ativo': posicao === indice,
              'busca__item--paciente': destino.tipo === 'paciente',
            }"
            role="option"
            :aria-selected="posicao === indice"
            @click="ir(destino)"
            @mouseenter="indice = posicao"
          >
            <PetAvatar
              v-if="destino.pet"
              class="busca__rosto"
              :nome="destino.pet.nome"
              :iniciais="destino.pet.iniciais"
              :especie="destino.pet.especie"
              :foto-url="destino.pet.fotoUrl"
              tamanho="md"
            />
            <span v-else class="busca__icone" aria-hidden="true"><i :class="destino.icone" /></span>

            <span class="busca__texto">
              <strong>{{ destino.rotulo }}</strong>
              <small v-if="destino.detalhe">{{ destino.detalhe }}</small>
            </span>

            <i class="ph ph-arrow-elbow-down-left busca__seta" aria-hidden="true" />
          </li>
        </template>
      </ul>

      <p v-if="buscando" class="busca__carregando" role="status">
        {{ t('clinico.busca.buscando') }}
      </p>

      <footer class="busca__rodape" aria-hidden="true">
        <span class="busca__tecla">
          <kbd>↑</kbd><kbd>↓</kbd>
          {{ t('clinico.busca.teclas.percorrer') }}
        </span>
        <span class="busca__tecla">
          <kbd>Enter</kbd>
          {{ t('clinico.busca.teclas.abrir') }}
        </span>
        <span class="busca__tecla">
          <kbd>Esc</kbd>
          {{ t('clinico.busca.teclas.fechar') }}
        </span>
      </footer>
    </div>
  </Dialog>
</template>

<style scoped>
.busca__corpo {
  display: grid;
  color: var(--tinta);
  font-family: var(--font-texto);
}

.busca__oculto {
  position: absolute;
  overflow: hidden;
  width: 1px;
  height: 1px;
  margin: 0;
  clip-path: inset(50%);
  white-space: nowrap;
}

/* ------------------------------------------------------------------------------ campo */

.busca__topo {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 14px 0 20px;
  border-bottom: 1px solid var(--linha);
}

.busca__lupa {
  flex: none;
  color: var(--tinta-2);
  font-size: 21px;
}

/*
 * O campo é o topo do diálogo, sem caixa: a folha inteira já é a caixa. 17 px, porque é o que se
 * vai ler enquanto se digita.
 */
.busca__topo .busca__campo.p-inputtext {
  min-width: 0;
  height: 60px;
  flex: 1;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  color: var(--tinta);
  font-family: var(--font-texto);
  font-size: 17px;
  outline: none;
}

.busca__topo .busca__campo.p-inputtext:enabled:focus,
.busca__topo .busca__campo.p-inputtext:enabled:hover {
  border: 0;
  box-shadow: none;
}

.busca__topo .busca__campo.p-inputtext::placeholder {
  color: var(--tinta-3);
}

/* O campo fica sem anel de foco: o diálogo inteiro é o foco. A borda de baixo acende no lugar. */
.busca__topo:focus-within {
  border-bottom-color: color-mix(in oklab, var(--clinica) 55%, var(--linha));
}

.busca__esc {
  display: grid;
  flex: none;
  min-width: 36px;
  min-height: 36px;
  padding: 0;
  place-items: center;
  border: 0;
  border-radius: 8px;
  background: none;
  cursor: pointer;
}

.busca__esc:hover {
  background: var(--superficie-2);
}

.busca__esc:focus-visible {
  outline: 2px solid var(--clinica);
  outline-offset: 0;
}

.busca__girando {
  width: 18px;
  height: 18px;
  flex: none;
  border: 2px solid var(--superficie-3);
  border-top-color: var(--clinica);
  border-radius: 50%;
  animation: busca-girar 0.9s linear infinite;
}

@keyframes busca-girar {
  to {
    transform: rotate(360deg);
  }
}

/* ----------------------------------------------------------------------------- lista */

.busca__lista {
  display: grid;
  max-height: min(26rem, 58vh);
  margin: 0;
  padding: 6px 8px 10px;
  list-style: none;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.busca__grupo {
  padding: 12px 12px 6px;
  color: var(--tinta-2);
  font-size: 12.5px;
  font-weight: 550;
}

.busca__item {
  position: relative;
  display: flex;
  min-height: 52px;
  align-items: center;
  gap: 12px;
  padding: 7px 12px;
  border-radius: 10px;
  color: var(--tinta);
  cursor: pointer;
}

/*
 * O item da vez: `--superficie-2` e o traço da Clínica na borda, o mesmo traço das linhas de
 * lista do kit (`ui-marca`). É a Clínica e não o lugar da tela porque a busca promete a clínica
 * — e o diálogo é teleportado para fora de quem define o lugar.
 */
.busca__item--ativo {
  background: var(--superficie-2);
}

.busca__item--ativo::before {
  position: absolute;
  top: 10px;
  bottom: 10px;
  inset-inline-start: 0;
  width: 4px;
  border-start-end-radius: 4px;
  border-end-end-radius: 4px;
  background: var(--clinica);
  content: '';
}

.busca__icone {
  display: grid;
  width: 38px;
  height: 38px;
  flex: none;
  place-items: center;
  border-radius: 10px;
  background: var(--superficie-2);
  color: var(--tinta-2);
  font-size: 18px;
}

.busca__item--ativo .busca__icone {
  background: var(--clinica-fundo);
  color: var(--clinica-tinta);
}

.busca__rosto {
  flex: none;
}

.busca__texto {
  display: grid;
  min-width: 0;
  flex: 1;
  gap: 1px;
}

.busca__texto strong {
  overflow: hidden;
  font-size: 14.5px;
  font-weight: 600;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.busca__texto small {
  overflow: hidden;
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* O telefone é dado: algarismos de mesma largura, como em toda a clínica. */
.busca__item--paciente .busca__texto small {
  font-variant-numeric: tabular-nums;
}

.busca__seta {
  flex: none;
  color: var(--tinta-2);
  font-size: 16px;
  opacity: 0;
}

.busca__item--ativo .busca__seta {
  opacity: 1;
}

/* ------------------------------------------------------------------- vazio e carregando */

.busca__vazio {
  display: grid;
  justify-items: center;
  gap: 8px;
  padding: 32px 24px 28px;
  text-align: center;
}

.busca__vazio-icone {
  display: grid;
  width: 48px;
  height: 48px;
  margin-bottom: 2px;
  place-items: center;
  border-radius: 14px;
  background: var(--superficie-2);
  color: var(--tinta-2);
  font-size: 22px;
}

.busca__vazio-frase {
  max-width: 40ch;
  margin: 0 0 8px;
  color: var(--tinta);
  font-size: 14.5px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.busca__carregando {
  margin: 0;
  padding: 0 20px 10px;
  color: var(--tinta-2);
  font-size: 13px;
}

/* ------------------------------------------------------------------------------ rodapé */

.busca__rodape {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 18px;
  padding: 10px 20px;
  border-top: 1px solid var(--linha);
  background: var(--superficie-2);
  color: var(--tinta-2);
  font-size: 12.5px;
}

.busca__tecla {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.busca__tecla kbd + span,
.busca__tecla kbd:last-of-type {
  margin-inline-end: 3px;
}

kbd {
  display: inline-grid;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  place-items: center;
  border: 1px solid var(--linha);
  border-radius: 6px;
  background: var(--superficie);
  box-shadow: inset 0 -1px 0 var(--linha);
  color: var(--tinta-2);
  font-family: var(--font-dados);
  font-size: 11.5px;
  font-weight: 600;
  line-height: 1;
}

@media (prefers-reduced-motion: reduce) {
  .busca__girando {
    animation-duration: 2.4s;
  }
}

@media (max-width: 640px) {
  .busca__rodape {
    display: none;
  }
}
</style>

<style>
/*
 * A moldura do diálogo, teleportado para o `body`: folha de raio 16, a sombra mais alta (é o que
 * mais flutua no sistema) e o conteúdo sem recheio — o campo, a lista e o rodapé vão de borda a
 * borda. Preso a uma classe própria para não vazar para outros diálogos.
 */
.p-dialog-mask .p-dialog.busca-dialogo {
  overflow: hidden;
  margin-top: min(12vh, 7rem);
  border: 1px solid var(--linha);
  border-radius: 16px;
  background: var(--superficie);
  box-shadow: var(--sombra-3);
  color: var(--tinta);
  animation: busca-dialogo-entra var(--pj-tempo-medio, 200ms) var(--pj-curva-chega, ease-out);
}

.p-dialog-mask .p-dialog.busca-dialogo .p-dialog-content {
  padding: 0;
  background: var(--superficie);
}

@keyframes busca-dialogo-entra {
  from {
    opacity: 0;
    transform: translateY(-6px) scale(0.985);
  }
}

@media (prefers-reduced-motion: reduce) {
  .p-dialog-mask .p-dialog.busca-dialogo {
    animation: none;
  }
}
</style>
