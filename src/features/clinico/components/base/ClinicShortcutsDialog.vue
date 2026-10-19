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

/**
 * "Shift + ↑ ↓" vira duas teclas desenhadas com um "+" entre elas: lida de relance, a combinação
 * é a forma das teclas, não a frase.
 */
function partesDe(teclas: string) {
  return teclas.split(' + ').filter(Boolean)
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
    class="clinic-dialog hc-tema atalhos-dialogo"
    :style="{ width: 'min(44rem, 94vw)' }"
    :header="t('clinico.atalhos.titulo')"
    dismissable-mask
  >
    <div class="atalhos clinic-scope">
      <section v-for="grupo in grupos" :key="grupo.id" class="atalhos__grupo">
        <h3 class="atalhos__titulo">{{ grupo.titulo }}</h3>
        <dl class="atalhos__lista">
          <div v-for="item in grupo.itens" :key="item.acao" class="atalhos__item">
            <dt>{{ item.rotulo }}</dt>
            <dd>
              <template v-for="(parte, indice) in partesDe(item.tecla)" :key="indice">
                <span v-if="indice > 0" class="atalhos__mais" aria-hidden="true">+</span>
                <kbd>{{ parte }}</kbd>
              </template>
            </dd>
          </div>
        </dl>
      </section>

      <section class="atalhos__grupo">
        <h3 class="atalhos__titulo">{{ t('clinico.atalhos.grupo.prontuario') }}</h3>
        <dl class="atalhos__lista">
          <div v-for="item in CONTEXTUAIS" :key="item.chave" class="atalhos__item">
            <dt>{{ t(`clinico.atalhos.${item.chave}`) }}</dt>
            <dd>
              <template v-for="(parte, indice) in partesDe(item.teclas)" :key="indice">
                <span v-if="indice > 0" class="atalhos__mais" aria-hidden="true">+</span>
                <kbd>{{ parte }}</kbd>
              </template>
            </dd>
          </div>
        </dl>
      </section>
    </div>
  </Dialog>
</template>

<style scoped>
.atalhos {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 17rem), 1fr));
  gap: 24px 32px;
  color: var(--tinta);
  font-family: var(--font-texto);
}

.atalhos__grupo {
  display: grid;
  align-content: start;
  gap: 6px;
}

.atalhos__titulo {
  margin: 0 0 2px;
  color: var(--tinta);
  font-size: 14.5px;
  font-weight: 600;
}

.atalhos__lista {
  display: grid;
  margin: 0;
}

.atalhos__item {
  display: flex;
  min-height: 40px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-bottom: 1px solid var(--linha);
}

.atalhos__item:last-child {
  border-bottom: 0;
}

.atalhos__item dt {
  min-width: 0;
  color: var(--tinta);
  font-size: 14px;
  line-height: 1.35;
}

.atalhos__item dd {
  display: flex;
  flex: none;
  align-items: center;
  gap: 4px;
  margin: 0;
}

.atalhos__mais {
  color: var(--tinta-3);
  font-size: 12px;
}

/* A tecla desenhada: papel afundado, fio fino e a sombra de baixo que faz dela uma tecla. */
kbd {
  display: inline-grid;
  min-width: 26px;
  height: 26px;
  padding: 0 7px;
  place-items: center;
  border: 1px solid var(--linha);
  border-radius: 7px;
  background: var(--superficie-2);
  box-shadow: inset 0 -2px 0 var(--linha);
  color: var(--tinta);
  font-family: var(--font-dados);
  font-size: 12.5px;
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
}
</style>
