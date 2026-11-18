<script setup lang="ts">
/**
 * Como um acesso chega à empresa, em três etapas: o responsável compartilha no app, a empresa
 * vincula o código, a anotação volta para o prontuário do pet.
 *
 * Mora em dois lugares de Acessos: no guia do topo (com "Mostrar explicações") e na lista vazia.
 * Com largura de sobra, as etapas ficam numa fileira ligadas por uma trilha tracejada que passa
 * entre os ladrilhos; no estreito, descem em coluna e a trilha corre na vertical, ao lado deles.
 * Quem decide é a largura do bloco (container query), não a da janela: o mesmo bloco cabe no
 * cartão do guia e no poço da lista vazia.
 *
 * O número de cada etapa é só visual (a `ol` já conta para o leitor de tela). O desenho mora em
 * `UiPassos` desde 17/11/2026, para os vazios das outras telas usarem o mesmo.
 *
 * Na lista vazia (`vincular`), as etapas da empresa ganham o botão delas (17/11/2026, "tem sempre
 * que ter os botões call to action"): vincular o código abre o pedido dele ali mesmo; escrever a
 * anotação fica apagado até haver um acesso. Compartilhar é do responsável, no app: sem botão.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import UiPassos, { type PassoDoGuia } from '@/components/ui/UiPassos.vue'

const props = defineProps<{
  vincular?: { aoClicar: () => void; bloqueada?: boolean }
}>()

const { t } = useI18n()

const passos = computed<PassoDoGuia[]>(() => [
  {
    id: 'compartilha',
    icone: 'ph ph-device-mobile',
    titulo: t('acessos.guia.passo1.titulo'),
    texto: t('acessos.guia.passo1.texto'),
  },
  {
    id: 'vincula',
    icone: 'ph ph-key',
    titulo: t('acessos.guia.passo2.titulo'),
    texto: t('acessos.guia.passo2.texto'),
    acao: props.vincular
      ? {
          rotulo: t('acessos.vincular.cta'),
          icone: 'ph ph-link',
          aoClicar: props.vincular.aoClicar,
          bloqueada: props.vincular.bloqueada,
        }
      : undefined,
  },
  {
    id: 'anota',
    icone: 'ph ph-note-pencil',
    titulo: t('acessos.guia.passo3.titulo'),
    texto: t('acessos.guia.passo3.texto'),
    acao: props.vincular
      ? { rotulo: t('acessos.guia.anotar'), icone: 'ph ph-note-pencil', bloqueada: true }
      : undefined,
  },
])
</script>

<template>
  <UiPassos :passos="passos" />
</template>
