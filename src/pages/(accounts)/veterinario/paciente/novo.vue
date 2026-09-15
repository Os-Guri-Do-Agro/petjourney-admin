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
 */
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import PartnerPageFrame from '@/components/parceiro/PartnerPageFrame.vue'
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
  <PartnerPageFrame
    :subtitle="t('clinico.pacientes.titulo')"
    :title="t('clinico.paciente.novo.titulo')"
    :loading="carregando"
    block-when-suspended
  >
    <div class="cadastro clinic-scope">
      <p class="cadastro__ajuda">{{ t('clinico.paciente.novo.ajudaCompleta') }}</p>

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
  </PartnerPageFrame>
</template>

<style scoped>
/*
 * A largura é limitada de propósito.
 *
 * Campo de formulário esticado por um monitor de 27 polegadas obriga o olho a atravessar a tela
 * entre o rótulo e o fim da caixa, e a fileira de dois campos vira duas colunas distantes que
 * ninguém lê como par. O limite deixa o formulário com a mesma medida confortável em qualquer
 * monitor — e é mais largo que qualquer diálogo, que era o problema.
 */
.cadastro {
  display: grid;
  max-width: 92rem;
  gap: var(--clinic-space-4);
}

/*
 * A prévia tem largura própria, e ela é generosa.
 *
 * A primeira medida (22 rem) foi calculada para o texto caber, e coube: o nome do paciente
 * truncava em "Nome do pacie…", o endereço quebrava em três linhas e a coluna lia como uma
 * tira encostada na borda. Um perfil espremido não parece o perfil que a clínica vai ver —
 * parece um resumo de rodapé, que é o oposto do que esta coluna existe para fazer.
 */
.cadastro__colunas {
  display: grid;
  align-items: start;
  gap: var(--clinic-space-5);
  grid-template-columns: minmax(0, 1fr) 30rem;
}

/*
 * A prévia acompanha a rolagem.
 *
 * O formulário é longo e a prévia é curta: sem isto, ela ficaria visível durante a primeira tela
 * e desapareceria justamente enquanto se preenche o endereço — a parte que mais compensa
 * conferir antes de salvar. `sticky` na página inteira não cria rolagem dentro de rolagem, que é
 * o que estragava a versão em diálogo.
 */
.cadastro__previa {
  position: sticky;
  top: var(--clinic-space-5);
}

/*
 * Abaixo de 1100 px a prévia vira um resumo no fim da página.
 *
 * Lado a lado em coluna estreita, os dois ficariam ilegíveis. Empilhada, ela deixa de acompanhar
 * a digitação e passa a ser a última conferida antes do botão — que é o melhor papel que lhe
 * resta nessa largura.
 */
/* A prévia mais larga empurra o ponto em que as duas colunas deixam de caber lado a lado. */
@media (max-width: 1240px) {
  .cadastro__colunas {
    grid-template-columns: minmax(0, 1fr);
  }

  .cadastro__previa {
    position: static;
  }
}

.cadastro__ajuda {
  margin: 0;
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
  line-height: 1.45;
}
</style>
