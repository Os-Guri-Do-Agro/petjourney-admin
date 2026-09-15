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
 */
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import type { AppNavigationSection } from '@/composables/useAppNavigation'

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
    icone: linha.pet.especie === 'felina' ? 'pi pi-heart' : 'pi pi-user',
    para: `/veterinario/paciente/${linha.pet.id}/historico`,
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
    class="clinic-dialog busca"
    :style="{ width: 'min(34rem, 96vw)' }"
    :header="t('clinico.busca.titulo')"
    dismissable-mask
  >
    <div class="busca__corpo clinic-scope" @keydown="aoTeclar">
      <InputText
        ref="campo"
        v-model="termo"
        class="busca__campo"
        :placeholder="t('clinico.busca.placeholder')"
        :aria-label="t('clinico.busca.placeholder')"
        autocomplete="off"
        fluid
      />

      <p class="busca__dica">{{ t('clinico.busca.dica') }}</p>

      <div v-if="vazio" class="busca__vazio">
        <p class="busca__vazio-frase">
          {{ t('clinico.busca.semResultado', { termo: termo.trim() }) }}
        </p>

        <button type="button" class="busca__cadastrar" @click="cadastrarPaciente">
          <i class="pi pi-user-plus" aria-hidden="true" />
          {{ t('clinico.paciente.novo.atalho') }}
        </button>
      </div>

      <ul v-else class="busca__lista" role="listbox" :aria-label="t('clinico.busca.titulo')">
        <li v-if="telasEncontradas.length > 0" class="busca__grupo" role="presentation">
          {{ t('clinico.busca.telas') }}
        </li>

        <li
          v-for="(destino, posicao) in resultados"
          :key="destino.chave"
          role="option"
          :aria-selected="posicao === indice"
        >
          <!--
            O rótulo do grupo de pacientes nasce no meio da lista, e não como segundo `<ul>`:
            duas listas separadas quebrariam a navegação por setas, que é o modo como esta
            janela foi feita para ser usada.
          -->
          <p
            v-if="destino.tipo === 'paciente' && resultados[posicao - 1]?.tipo !== 'paciente'"
            class="busca__grupo"
          >
            {{ t('clinico.busca.pacientes') }}
          </p>

          <button
            type="button"
            class="busca__item clinic-focusable"
            :class="{ 'busca__item--ativo': posicao === indice }"
            @click="ir(destino)"
            @mouseenter="indice = posicao"
          >
            <span class="busca__icone" aria-hidden="true"><i :class="destino.icone" /></span>
            <span class="busca__texto">
              <strong>{{ destino.rotulo }}</strong>
              <small v-if="destino.detalhe">{{ destino.detalhe }}</small>
            </span>
            <i class="pi pi-arrow-right busca__seta" aria-hidden="true" />
          </button>
        </li>

        <li v-if="buscando" class="busca__carregando">
          <i class="pi pi-spin pi-spinner" aria-hidden="true" />
          {{ t('clinico.busca.buscando') }}
        </li>
      </ul>
    </div>
  </Dialog>
</template>

<style scoped>
.busca__corpo {
  display: grid;
  gap: var(--clinic-space-3);
}

.busca__dica {
  margin: 0;
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
}

.busca__lista {
  display: grid;
  max-height: min(24rem, 55vh);
  gap: 0.1rem;
  margin: 0;
  padding: 0;
  list-style: none;
  overflow-y: auto;
}

.busca__grupo {
  margin: var(--clinic-space-2) 0 0.2rem;
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
  font-weight: 750;
  letter-spacing: 0.09em;
  text-transform: uppercase;
}

.busca__item {
  display: flex;
  width: 100%;
  align-items: center;
  gap: var(--clinic-space-3);
  min-height: var(--clinic-row-height);
  padding: var(--clinic-cell-padding-y) var(--clinic-space-2);
  border: 1px solid transparent;
  border-radius: var(--clinic-radius-control);
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
  text-align: left;
}

/*
 * O item ativo é o do teclado **e** o do mouse: `mouseenter` move o índice em vez de acender um
 * segundo destaque. Com dois realces na tela, `Enter` vai para um lugar e o olho está no outro.
 */
.busca__item--ativo {
  border-color: var(--clinic-accent);
  background: var(--clinic-accent-tint);
}

.busca__icone {
  display: grid;
  width: 1.7rem;
  height: 1.7rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: var(--clinic-radius-control);
  background: var(--clinic-surface-soft);
  color: var(--clinic-muted);
  font-size: 0.8rem;
}

.busca__item--ativo .busca__icone {
  background: var(--clinic-accent-strong);
  color: var(--clinic-surface);
}

.busca__texto {
  display: grid;
  min-width: 0;
  flex: 1;
  gap: 0.05rem;
}

.busca__texto strong {
  overflow: hidden;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.busca__texto small {
  overflow: hidden;
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.busca__seta {
  flex: 0 0 auto;
  color: var(--clinic-faint);
  font-size: 0.68rem;
  opacity: 0;
}

.busca__item--ativo .busca__seta {
  opacity: 1;
}

.busca__vazio,
.busca__carregando {
  display: flex;
  align-items: center;
  margin: 0;
  gap: var(--clinic-space-2);
  padding: var(--clinic-space-3) var(--clinic-space-2);
  color: var(--clinic-faint);
  list-style: none;
}

.busca__vazio {
  flex-wrap: wrap;
  justify-content: space-between;
}

.busca__vazio-frase {
  margin: 0;
}

.busca__cadastrar {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.7rem;
  border: 1px solid var(--clinic-accent-strong);
  border-radius: var(--clinic-radius-control);
  background: var(--clinic-accent-tint);
  color: var(--clinic-accent-strong);
  cursor: pointer;
  font: inherit;
  font-size: var(--clinic-font-label);
  font-weight: 750;
}

.busca__cadastrar:hover,
.busca__cadastrar:focus-visible {
  background: var(--clinic-accent-strong);
  color: var(--clinic-surface);
}

.busca__cadastrar i {
  font-size: 0.72rem;
}
</style>
