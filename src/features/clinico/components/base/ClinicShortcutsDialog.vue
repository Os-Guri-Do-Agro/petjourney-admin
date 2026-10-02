<script setup lang="ts">
/**
 * Mapa de atalhos. Aberto por `?`, fechado por `Esc`.
 *
 * A lista sai da mesma tabela que o ouvinte usa (`TECLAS`), então documentação e comportamento
 * não têm como divergir.
 */
import Dialog from 'primevue/dialog'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { TECLAS, type AcaoAtalho } from '../../composables/useClinicShortcuts'

const aberto = defineModel<boolean>('visible', { default: false })

const { t } = useI18n()

const SIMBOLO: Record<string, string> = {
  ArrowLeft: '←',
  ArrowRight: '→',
  ArrowUp: '↑',
  ArrowDown: '↓',
  Escape: 'Esc',
}

const GRUPOS: Record<string, AcaoAtalho[]> = {
  navegacao: [
    'visaoDia',
    'visaoSemana',
    'agruparProfissional',
    'agruparSala',
    'hoje',
    'diaAnterior',
    'proximoDia',
    'semanaAnterior',
    'proximaSemana',
  ],
  acoes: ['novo', 'encaixar', 'bloquear', 'buscar', 'densidade', 'desfazer', 'ajuda', 'fechar'],
}

/**
 * Ações que não vêm da tabela global porque vivem dentro de um card, de um campo — ou fora da
 * agenda inteira.
 *
 * A busca do módulo é o caso de fora: ela mora no shell, funciona em qualquer tela e por isso
 * não está em `TECLAS`, que é a tabela da agenda. Precisa aparecer aqui de qualquer forma —
 * um atalho que ninguém descobre é um atalho que não existe, e este é o que substitui metade
 * das voltas pelo menu.
 */
const CONTEXTUAIS: Array<{ chave: string; teclas: string }> = [
  { chave: 'buscaGlobal', teclas: 'Ctrl / ⌘ + K' },
  { chave: 'mover', teclas: 'Shift + ↑ ↓' },
  { chave: 'selecionar', teclas: 'Enter' },
  { chave: 'proximoCampo', teclas: 'Tab' },
  { chave: 'comandoBarra', teclas: '/' },
]

/** Cada ação aponta para a chave que já nomeia o mesmo controle na barra da agenda. */
const CHAVE_DO_ROTULO: Record<AcaoAtalho, string> = {
  visaoDia: 'clinico.agenda.visaoDia',
  visaoSemana: 'clinico.agenda.visaoSemana',
  agruparProfissional: 'clinico.agenda.agruparPorProfissional',
  agruparSala: 'clinico.agenda.agruparPorSala',
  hoje: 'clinico.atalhos.hoje',
  diaAnterior: 'clinico.atalhos.diaAnterior',
  proximoDia: 'clinico.atalhos.proximoDia',
  semanaAnterior: 'clinico.atalhos.semanaAnterior',
  proximaSemana: 'clinico.atalhos.proximaSemana',
  novo: 'clinico.atalhos.novo',
  bloquear: 'clinico.atalhos.bloquear',
  encaixar: 'clinico.atalhos.encaixar',
  buscar: 'clinico.atalhos.buscar',
  densidade: 'clinico.atalhos.densidade',
  desfazer: 'clinico.agenda.desfazer',
  ajuda: 'clinico.atalhos.abrir',
  fechar: 'clinico.atalhos.fechar_',
}

function teclaDe(acao: AcaoAtalho): string {
  const item = TECLAS.find((tecla) => tecla.acao === acao)

  if (!item) {
    return ''
  }

  const base = SIMBOLO[item.tecla] ?? item.tecla.toUpperCase()

  return item.comShift ? `Shift + ${base}` : base
}

const grupos = computed(() =>
  Object.entries(GRUPOS).map(([id, acoes]) => ({
    id,
    titulo: t(`clinico.atalhos.grupo.${id}`),
    itens: acoes.map((acao) => ({
      acao,
      tecla: teclaDe(acao),
      rotulo: t(CHAVE_DO_ROTULO[acao]),
    })),
  })),
)
</script>

<template>
  <Dialog
    v-model:visible="aberto"
    modal
    class="clinic-dialog hc-tema"
    :style="{ width: 'min(40rem, 94vw)' }"
    :header="t('clinico.atalhos.titulo')"
    dismissable-mask
  >
    <div class="atalhos clinic-scope">
      <section v-for="grupo in grupos" :key="grupo.id" class="atalhos__grupo">
        <h3 class="clinic-label">{{ grupo.titulo }}</h3>
        <dl class="atalhos__lista">
          <div v-for="item in grupo.itens" :key="item.acao">
            <dt>{{ item.rotulo }}</dt>
            <dd><kbd>{{ item.tecla }}</kbd></dd>
          </div>
        </dl>
      </section>

      <section class="atalhos__grupo">
        <h3 class="clinic-label">{{ t('clinico.atalhos.grupo.prontuario') }}</h3>
        <dl class="atalhos__lista">
          <div v-for="item in CONTEXTUAIS" :key="item.chave">
            <dt>{{ t(`clinico.atalhos.${item.chave}`) }}</dt>
            <dd><kbd>{{ item.teclas }}</kbd></dd>
          </div>
        </dl>
      </section>
    </div>
  </Dialog>
</template>

<style scoped>
.atalhos {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr));
  gap: var(--clinic-space-5);
}

.atalhos__grupo {
  display: grid;
  align-content: start;
  gap: var(--clinic-space-2);
}

.atalhos__lista {
  display: grid;
  gap: 0.3rem;
  margin: 0;
}

.atalhos__lista div {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--clinic-space-3);
  padding-block: 0.15rem;
  border-bottom: 1px dotted var(--clinic-line);
}

.atalhos__lista dt {
  color: var(--clinic-muted);
}

.atalhos__lista dd {
  margin: 0;
}

kbd {
  padding: 0.1rem 0.4rem;
  border: 1px solid var(--clinic-line-strong);
  border-radius: 0.35rem;
  background: var(--clinic-surface-soft);
  color: var(--clinic-text);
  font-family: inherit;
  font-size: var(--clinic-font-label);
  font-weight: 700;
  white-space: nowrap;
}
</style>
