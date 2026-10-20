<script setup lang="ts">
/**
 * Com quem. "Qualquer profissional" vem primeiro porque é o que mais abre horário — e é a escolha
 * de quem só quer resolver. Quem tem veterinário de confiança acha o nome logo abaixo.
 */
import Button from 'primevue/button'
import { useI18n } from 'vue-i18n'

import { useFluxo } from './fluxo-do-pedido'

const { t, te } = useI18n()
const fluxo = useFluxo()

/** A especialidade vem como chave da lista do app, ou por extenso — o contrato diz qual. */
function especialidade(valor: string | null) {
  if (!valor) {
    return ''
  }

  const chave = `clinico.pedidos.app.especialidade.${valor}`

  return te(chave) ? t(chave) : valor
}

function iniciais(nome: string) {
  return nome
    .split(/\s+/)
    .slice(0, 2)
    .map((parte) => parte[0] ?? '')
    .join('')
    .toUpperCase()
}
</script>

<template>
  <div class="fx-etapa">
    <div class="fx-corpo">
      <ul class="fx-lista">
        <li>
          <Button class="fx-opcao" text @click="fluxo.escolherProfissional(null)">
            <span class="fx-opcao__icone" aria-hidden="true"><i class="ph ph-users" /></span>
            <span class="fx-opcao__texto">
              <strong>{{ t('clinico.pedidos.app.qualquerProfissional') }}</strong>
              <span>{{ t('clinico.pedidos.app.qualquerAjuda') }}</span>
            </span>
            <i class="ph ph-caret-right fx-opcao__fim" aria-hidden="true" />
          </Button>
        </li>
      </ul>

      <ul class="fx-lista">
        <li v-for="item in fluxo.clinica.value?.profissionais ?? []" :key="item.id">
          <Button class="fx-opcao" text @click="fluxo.escolherProfissional(item.id)">
            <span class="fx-opcao__icone profissional__iniciais" aria-hidden="true">
              {{ iniciais(item.nome) }}
            </span>
            <span class="fx-opcao__texto">
              <strong>{{ item.nome }}</strong>
              <span>{{ especialidade(item.especialidade) }}</span>
            </span>
            <i class="ph ph-caret-right fx-opcao__fim" aria-hidden="true" />
          </Button>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.profissional__iniciais {
  border-radius: 50%;
  font-family: var(--font-dados);
  font-size: 14px;
  font-weight: 650;
}
</style>
