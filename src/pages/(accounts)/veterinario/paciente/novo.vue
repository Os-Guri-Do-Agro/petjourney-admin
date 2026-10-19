<script setup lang="ts">
/**
 * Cadastro completo de paciente.
 *
 * É uma página, e não um diálogo, porque o cadastro inteiro tem mais de vinte campos. Dentro de
 * um modal isso vira uma caixa de rolagem dentro de outra: a página fica parada atrás enquanto o
 * conteúdo rola por dentro de uma janela de altura fixa, e o botão de salvar rola junto com o
 * resto. A saída usual para isso — grudar o rodapé com `position: sticky` — é remendo em cima de
 * uma escolha errada, e ainda briga com o rodapé que o próprio diálogo já tem.
 *
 * O diálogo continua certo para o **outro** cadastro, o de balcão no meio de um agendamento: lá
 * são seis campos, cabem sem rolar, e trocar de tela custaria o horário que se estava marcando.
 * As duas telas usam o mesmo `PacienteNovoForm` — é ele que garante que as duas concordem sobre
 * o que é obrigatório, como um CPF é validado e quando avisar de cadastro repetido.
 *
 * Cadastrar leva ao histórico do paciente recém-criado, e não de volta à lista. Quem cadastra no
 * balcão precisa fazer alguma coisa com o animal em seguida — marcar, internar, atender — e a
 * ficha dele é de onde essas coisas saem. Devolver à lista obrigaria a procurar o que se acabou
 * de criar.
 *
 * A coluna da direita mostra o cadastro montado, no formato em que a clínica vai encontrá-lo.
 * Ela existe porque um formulário mostra campos e quem atende vê um cartão: é a distância entre
 * os dois que produz o cadastro que passa na validação e não serve para nada.
 *
 * ## A forma (redesenho de 19/10/2026)
 *
 * Tela de detalhe do destino Pacientes: sem as abas do destino, com "Pacientes" para voltar e o
 * título dizendo o que se faz aqui. O formulário vem em quatro partes com nome — o pet, a
 * identificação, os alertas clínicos e o responsável —, cada uma numa folha, e o rodapé com
 * "Cadastrar paciente" e "Cancelar". A prévia fica presa ao lado enquanto a página rola, e desce
 * para baixo do formulário quando a largura não comporta as duas colunas.
 */
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRouter } from 'vue-router'

import UiPagina from '@/components/ui/UiPagina.vue'
import PacienteNovoForm, {
  type RascunhoDoPaciente,
} from '@/features/clinico/components/pacientes/PacienteNovoForm.vue'
import PacientePreview from '@/features/clinico/components/pacientes/PacientePreview.vue'
import type { Pet } from '@/features/clinico/data/types'
import { useClinicoStore } from '@/features/clinico/stores/clinico'

const { t } = useI18n()
const router = useRouter()
const clinico = useClinicoStore()

const carregando = ref(true)
const rascunho = ref<RascunhoDoPaciente | null>(null)

/*
 * O catálogo precisa estar carregado antes do formulário desenhar: é dele que sai a lista de
 * responsáveis já cadastrados — a que evita o segundo cadastro da mesma pessoa.
 */
onMounted(async () => {
  await clinico.carregar()
  carregando.value = false
})

function aoCriar(pet: Pet) {
  void router.push(`/veterinario/paciente/${pet.id}/historico`)
}

function cancelar() {
  void router.push('/veterinario/pacientes')
}
</script>

<template>
  <UiPagina
    class="tela-cadastro"
    :titulo="t('clinico.paciente.novo.titulo')"
    :resumo="t('clinico.paciente.novo.resumoPagina')"
    :carregando="carregando"
    bloquear-se-suspenso
  >
    <template #voltar>
      <RouterLink to="/veterinario/pacientes">
        <i class="ph ph-arrow-left" aria-hidden="true" />
        {{ t('clinico.pacientes.titulo') }}
      </RouterLink>
    </template>

    <div class="cadastro">
      <div class="cadastro__colunas">
        <PacienteNovoForm
          modo="completo"
          @criado="aoCriar"
          @cancelar="cancelar"
          @rascunho="rascunho = $event"
        />

        <PacientePreview class="cadastro__previa" :rascunho="rascunho" />
      </div>
    </div>
  </UiPagina>
</template>

<style scoped>
/*
 * A largura é limitada de propósito.
 *
 * Campo de formulário esticado por um monitor de 27 polegadas obriga o olho a atravessar a tela
 * entre o rótulo e o fim da caixa, e a fileira de dois campos vira duas colunas distantes que
 * ninguém lê como par. O formulário tem uma medida confortável; a prévia, a largura de um perfil.
 *
 * Quem decide se as duas colunas cabem é a largura da área (container), não a da janela: com a
 * barra aberta, um notebook deixa bem menos espaço do que a janela sugere.
 */
.cadastro {
  container: cadastro / inline-size;
}

.cadastro__colunas {
  display: grid;
  align-items: start;
  gap: 28px;
  grid-template-columns: minmax(0, 46rem);
}

/*
 * A prévia acompanha a rolagem.
 *
 * O formulário é longo e a prévia é curta: sem isto, ela ficaria visível durante a primeira tela
 * e desapareceria justamente enquanto se preenche o endereço — a parte que mais compensa
 * conferir antes de salvar. `sticky` na página inteira não cria rolagem dentro de rolagem.
 *
 * Abaixo dessa largura ela desce para o fim, depois do botão: deixa de acompanhar a digitação e
 * passa a ser a última conferida — o melhor papel que lhe resta numa coluna só.
 */
@container cadastro (min-width: 980px) {
  .cadastro__colunas {
    grid-template-columns: minmax(0, 46rem) minmax(20rem, 24rem);
  }

  /* Abaixo da fita do dia, que também fica presa no alto da tela. */
  .cadastro__previa {
    position: sticky;
    top: 84px;
  }
}
</style>
