<script setup lang="ts">
/**
 * Os códigos guardados com o cadastro em análise, um aviso por código, em cima da lista de
 * Acessos: o que ainda espera a aprovação e o que não virou acesso (venceu, foi encerrado ou foi
 * aberto por outro estabelecimento). O que virou acesso não aparece: já está na lista.
 *
 * Uma linha por aviso numa folha só, com o ícone no tom do estado: são recados, não pendências da
 * tela, e não podem empurrar a lista para baixo com cartões pintados.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { ReivindicacaoAcesso } from '@/service/parceiro/types'
import { avisoDaReivindicacao, type TomDoAviso } from '@/utils/parceiro/reivindicacoes'

const props = defineProps<{
  itens: ReivindicacaoAcesso[]
  /**
   * O código acabou de ser guardado e a releitura da lista falhou: um aviso sem o nome do pet
   * segura o lugar, para a pessoa não sair do modal sem resposta nenhuma.
   */
  codigoGuardado?: boolean
}>()

const { t } = useI18n()

type Aviso = { id: string; texto: string; tom: TomDoAviso; icone: string }

const avisos = computed<Aviso[]>(() => {
  const lista: Aviso[] = []

  for (const item of props.itens) {
    const aviso = avisoDaReivindicacao(item.situacao)

    if (aviso) {
      lista.push({
        id: item.id,
        texto: t(aviso.chave, { pet: item.petNome }),
        tom: aviso.tom,
        icone: aviso.icone,
      })
    }
  }

  const jaAvisaAEspera = props.itens.some((item) => item.situacao === 'AGUARDANDO_APROVACAO')

  if (props.codigoGuardado && !jaAvisaAEspera) {
    lista.unshift({
      id: 'codigo-guardado',
      texto: t('acessos.reivindicacoes.guardado'),
      tom: 'lugar',
      icone: 'ph ph-clock',
    })
  }

  return lista
})
</script>

<template>
  <section
    v-if="avisos.length"
    class="reivindicacoes"
    role="status"
    :aria-label="t('acessos.reivindicacoes.aria')"
  >
    <ul class="ui-lista ui-folha">
      <li v-for="aviso in avisos" :key="aviso.id" class="reivindicacoes__linha">
        <span
          class="ui-ladrilho ui-ladrilho--p reivindicacoes__icone"
          :class="aviso.tom === 'lugar' ? null : `ui-ladrilho--${aviso.tom}`"
          aria-hidden="true"
        >
          <i :class="aviso.icone" />
        </span>
        <p class="reivindicacoes__texto">{{ aviso.texto }}</p>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.reivindicacoes__linha {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px 10px 12px;
}

.reivindicacoes__icone {
  flex: none;
}

.reivindicacoes__texto {
  min-width: 0;
  flex: 1 1 auto;
  margin: 0;
  color: var(--tinta);
  font-size: 13.5px;
  line-height: 1.45;
  overflow-wrap: anywhere;
}
</style>
