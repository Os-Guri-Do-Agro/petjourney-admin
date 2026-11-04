<script setup lang="ts">
/**
 * As empresas da conta, abertas pelo bloco da empresa no topo da barra.
 *
 * Uma conta pode estar em várias equipes ao mesmo tempo, e aceitar um convite troca a empresa em
 * uso para a nova. A troca morava só no menu da conta, no pé da barra, e quem procurava não achava:
 * o lugar onde se procura é o nome da empresa, em cima. Aqui ela fica à mão, com a empresa em uso
 * marcada e o caminho para cadastrar outra.
 *
 * Abre num Popover no `body`, como o menu da conta; a lista é lida de novo a cada abertura.
 */
import Popover from 'primevue/popover'
import Skeleton from 'primevue/skeleton'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import PartnerStatusBadge from '@/components/parceiro/PartnerStatusBadge.vue'
import { useTrocaDeEmpresa } from '@/composables/useTrocaDeEmpresa'
import type { OpcaoParceiro } from '@/utils/parceiro/perfis-parceiro'

const emit = defineEmits<{ aberto: [valor: boolean] }>()

const { t } = useI18n()
const { opcoes, carregando, erro, trocandoId, podeCadastrar, carregar, trocar } =
  useTrocaDeEmpresa()

const menu = ref<InstanceType<typeof Popover> | null>(null)

/** As iniciais do nome da empresa, para o rosto da linha ("Clínica Vida Animal" vira "CV"). */
function iniciais(nome: string) {
  return nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte.charAt(0).toLocaleUpperCase())
    .join('')
}

function alternar(evento: Event) {
  menu.value?.toggle(evento)
}

function fechar() {
  menu.value?.hide()
}

function aoAbrir() {
  emit('aberto', true)
  void carregar()
}

async function escolher(opcao: OpcaoParceiro) {
  if (opcao.ativo) {
    fechar()
    return
  }

  if (await trocar(opcao.parceiroId, false)) {
    fechar()
  }
}

defineExpose({ alternar, fechar })
</script>

<template>
  <Popover ref="menu" class="empresas__menu" @show="aoAbrir" @hide="emit('aberto', false)">
    <div class="empresas" role="menu" :aria-label="t('shell.empresa.titulo')">
      <p class="empresas__titulo" role="none">{{ t('shell.empresa.titulo') }}</p>

      <!-- Primeira abertura: o lugar das linhas, enquanto a lista chega. -->
      <div v-if="carregando && !opcoes.length" class="empresas__esqueleto" aria-hidden="true">
        <Skeleton v-for="n in 2" :key="n" height="2.75rem" border-radius="10px" />
      </div>

      <div v-else-if="erro" class="empresas__erro" role="alert">
        <span>{{ t('parceiro.selecionar.errorLoad') }}</span>
        <button type="button" class="empresas__tentar" @click="carregar">
          {{ t('common.retry') }}
        </button>
      </div>

      <template v-else>
        <button
          v-for="opcao in opcoes"
          :key="opcao.parceiroId"
          type="button"
          role="menuitemradio"
          class="empresas__item"
          :class="{ 'empresas__item--ativa': opcao.ativo }"
          :aria-checked="opcao.ativo"
          :disabled="trocandoId != null && trocandoId !== opcao.parceiroId"
          :aria-busy="trocandoId === opcao.parceiroId || undefined"
          @click="escolher(opcao)"
        >
          <span
            class="empresas__rosto"
            :class="{ 'empresas__rosto--equipe': opcao.equipe }"
            aria-hidden="true"
          >
            {{ iniciais(opcao.nome) }}
          </span>
          <span class="empresas__texto">
            <strong dir="auto">{{ opcao.nome }}</strong>
            <small>
              {{
                opcao.equipe
                  ? t('parceiro.selecionar.roleOperador')
                  : t('parceiro.selecionar.roleDono')
              }}
            </small>
          </span>
          <PartnerStatusBadge v-if="opcao.badgeStatus" :status="opcao.badgeStatus" />
          <i
            v-if="trocandoId === opcao.parceiroId"
            class="ph ph-spin ph-circle-notch empresas__marca"
            aria-hidden="true"
          />
          <i v-else-if="opcao.ativo" class="ph ph-check empresas__marca" aria-hidden="true" />
        </button>

        <!-- Uma empresa só: dizer de onde viriam as outras, em vez de uma lista de um item mudo. -->
        <p v-if="opcoes.length === 1" class="empresas__dica" role="none">
          {{ t('parceiro.selecionar.bodyUma') }}
        </p>
      </template>

      <template v-if="podeCadastrar">
        <hr class="empresas__divisa" />
        <RouterLink
          role="menuitem"
          class="empresas__acao"
          to="/settings?aba=empresa"
          @click="fechar"
        >
          <i class="ph ph-plus" aria-hidden="true" />
          {{ t('parceiro.selecionar.newTitle') }}
        </RouterLink>
      </template>
    </div>
  </Popover>
</template>

<style scoped>
.empresas {
  display: grid;
  width: 300px;
  gap: 2px;
}

.empresas__titulo {
  margin: 0;
  padding: 4px 10px 6px;
  color: var(--tinta-2);
  font-size: 12.5px;
  font-weight: 650;
}

.empresas__esqueleto {
  display: grid;
  gap: 6px;
  padding: 2px 4px 6px;
}

.empresas__item,
.empresas__acao {
  display: flex;
  width: 100%;
  min-height: 52px;
  align-items: center;
  gap: 12px;
  padding: 6px 10px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--tinta);
  cursor: pointer;
  font: inherit;
  text-align: start;
  text-decoration: none;
}

.empresas__item:hover:not(:disabled),
.empresas__acao:hover {
  background: var(--superficie-2);
}

.empresas__item:disabled {
  cursor: default;
  opacity: 0.55;
}

.empresas__item--ativa {
  background: var(--superficie-2);
}

.empresas__item:focus-visible,
.empresas__acao:focus-visible,
.empresas__tentar:focus-visible {
  outline: 2px solid var(--musgo);
  outline-offset: -2px;
}

/* O rosto: o degradê do Portal para o seu negócio, papel claro para a equipe de outra pessoa. */
.empresas__rosto {
  display: grid;
  width: 36px;
  height: 36px;
  flex: none;
  place-items: center;
  border-radius: 11px;
  background: var(--pj-lugar-degrade);
  /* A tinta do lugar sobre o tom dele: branco no pêssego pastel dava 1,4:1. */
  color: var(--pj-lugar-tinta);
  font-family: var(--font-dados);
  font-size: 13px;
  font-weight: 650;
}

.empresas__rosto--equipe,
.app-dark .empresas__rosto--equipe {
  background: var(--superficie-3);
  color: var(--tinta);
}

.empresas__texto {
  display: grid;
  flex: 1;
  min-width: 0;
  line-height: 1.3;
}

/* O nome inteiro, em duas linhas se preciso: cortado não se reconhece. */
.empresas__texto strong {
  font-size: 14px;
  font-weight: 600;
}

.empresas__texto small {
  color: var(--tinta-2);
  font-size: 12.5px;
}

.empresas__marca {
  flex: none;
  color: var(--musgo);
  font-size: 16px;
}

.empresas__dica {
  margin: 4px 10px 6px;
  color: var(--tinta-2);
  font-size: 12.5px;
  line-height: 1.45;
}

.empresas__erro {
  display: grid;
  gap: 6px;
  padding: 6px 10px 8px;
  color: var(--tinta);
  font-size: 13.5px;
}

.empresas__tentar {
  justify-self: start;
  padding: 0;
  border: 0;
  background: none;
  color: var(--musgo);
  cursor: pointer;
  font: inherit;
  font-weight: 600;
  text-decoration: underline;
}

.empresas__divisa {
  height: 1px;
  margin: 4px 6px;
  border: 0;
  background: var(--linha);
}

.empresas__acao {
  min-height: 42px;
  font-size: 14px;
}

.empresas__acao > i {
  color: var(--tinta-2);
  font-size: 18px;
}
</style>
