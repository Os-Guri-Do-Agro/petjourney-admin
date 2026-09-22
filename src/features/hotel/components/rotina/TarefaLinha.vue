<script setup lang="ts">
/**
 * Uma linha da prancheta.
 *
 * Três decisões, e todas vêm de a tela ser usada **em pé, com uma mão, no corredor do canil**:
 *
 * 1. **Marcar custa um toque.** O botão principal é "feita" e é grande. As outras duas saídas
 *    ficam ao lado, menores, porque são raras.
 * 2. **Recusar não é pular.** Pular é decisão da casa; recusar é o animal não ter comido, e isso é
 *    informação clínica que alimenta o boletim. Duas ações separadas, nunca um menu com as duas.
 * 3. **O atraso é calculado, não gravado.** A cor muda sozinha com o relógio, e volta ao normal no
 *    instante em que alguém marca — uma linha gravada como atrasada continuaria vermelha depois
 *    de resolvida.
 *
 * E uma quarta, que veio depois: **a urgência mora no disco, não na linha.** A versão anterior
 * pintava a linha inteira de rosa quando a tarefa atrasava. Numa prancheta em que cinco tarefas
 * atrasam ao mesmo tempo, isso são cinco faixas rosa de ponta a ponta — que não somam urgência,
 * se anulam, e levam o resto da tela junto. Agora a superfície é sempre a mesma e quem muda é o
 * disco do ícone, que fica cheio, mais o selo escrito ao lado.
 */
import Button from 'primevue/button'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import HotelSelo from '../base/HotelSelo.vue'
import IconeDeTarefa from '../base/IconeDeTarefa.vue'
import PetAvatar from '../base/PetAvatar.vue'
import { useHotelFormat } from '../../composables/useHotelFormat'
import type { PetSpecies, SituacaoDaTarefa, TarefaDeRotina, TarefaStatus } from '../../data/types'

const props = withDefaults(
  defineProps<{
    tarefa: TarefaDeRotina
    situacao: SituacaoDaTarefa
    /** Nome do hóspede e da acomodação. Vazios na aba da estadia, onde já se sabe de quem é. */
    petNome?: string
    petIniciais?: string
    petEspecie?: PetSpecies | null
    petFotoUrl?: string
    acomodacaoNome?: string
    salvando?: boolean
    /**
     * Esconde o nome do serviço, e promove o animal a texto principal.
     *
     * Dentro de uma ronda o serviço já está escrito no cabeçalho, e repeti-lo em cada linha faz
     * vinte linhas começarem pela mesma palavra — "Refeição, Refeição, Refeição" — enquanto a
     * única coisa que muda entre elas, que é de quem é, fica em segundo plano e em cinza. Aberta
     * a ronda, a pergunta não é mais "o quê": é "para quais".
     */
    omitirKind?: boolean
  }>(),
  {
    petNome: '',
    petIniciais: '',
    petEspecie: null,
    petFotoUrl: '',
    acomodacaoNome: '',
    salvando: false,
    omitirKind: false,
  },
)

const emit = defineEmits<{
  marcar: [payload: { tarefaId: string; status: TarefaStatus }]
}>()

const { t } = useI18n()
const formato = useHotelFormat()

const resolvida = computed(() => props.tarefa.status !== 'pendente')

/**
 * A hora em que foi marcada, e **só quando ela discorda da hora prevista**.
 *
 * A linha vive dentro de um bloco que já tem "07:00" escrito no eixo à esquerda. Repetir
 * "Marcada às 07:00" embaixo de cada uma das dezoito tarefas daquele bloco é dizer duas vezes a
 * mesma coisa em dezoito lugares. O que é informação é o desencontro: a ração das 07:00 servida
 * às 09:40 conta uma manhã atribulada, e é essa linha que merece existir.
 */
const horaFora = computed(() => {
  if (!resolvida.value || !props.tarefa.executadaEm) return ''

  const marcada = formato.hora(props.tarefa.executadaEm)

  return marcada === formato.hora(props.tarefa.previstaPara) ? '' : marcada
})
</script>

<template>
  <li class="tarefa" :class="[`tarefa--${situacao}`, { 'tarefa--resolvida': resolvida }]">
    <span class="tarefa__icone" aria-hidden="true"><IconeDeTarefa :kind="tarefa.kind" /></span>

    <div class="tarefa__corpo">
      <div class="tarefa__topo">
        <strong v-if="!omitirKind" class="tarefa__kind">
          {{ formato.tarefaKind(tarefa.kind) }}
        </strong>

        <span v-if="petNome" class="tarefa__pet" :class="{ 'tarefa__pet--titulo': omitirKind }">
          <PetAvatar
            :nome="petNome"
            :iniciais="petIniciais"
            :especie="petEspecie"
            :foto-url="petFotoUrl"
            tamanho="xs"
          />
          {{ petNome }}
          <template v-if="acomodacaoNome"> · {{ acomodacaoNome }}</template>
        </span>

        <HotelSelo
          v-if="situacao === 'atrasada' || situacao === 'recusada'"
          :rotulo="formato.situacaoDaTarefa(situacao)"
          :tom="situacao === 'recusada' ? 'atencao' : 'risco'"
        />
      </div>

      <p v-if="tarefa.descricao" class="tarefa__descricao">{{ tarefa.descricao }}</p>

      <p v-if="tarefa.observacao" class="tarefa__observacao">{{ tarefa.observacao }}</p>

      <p v-if="horaFora" class="tarefa__quem">
        {{ t('hotel.rotina.marcadaAs', { hora: horaFora }) }}
      </p>
    </div>

    <div class="tarefa__acoes">
      <template v-if="!resolvida">
        <Button
          :label="t('hotel.rotina.pular')"
          severity="secondary"
          text
          size="small"
          :disabled="salvando"
          @click="emit('marcar', { tarefaId: tarefa.id, status: 'pulada' })"
        />

        <!--
          Recusou é botão próprio, e não uma opção escondida: "não comeu" é o primeiro sinal de
          que algo está errado com um animal saudável longe de casa.
        -->
        <Button
          v-if="tarefa.kind === 'refeicao' || tarefa.kind === 'medicacao'"
          :label="t('hotel.rotina.recusou')"
          severity="secondary"
          outlined
          size="small"
          :disabled="salvando"
          @click="emit('marcar', { tarefaId: tarefa.id, status: 'recusada' })"
        />

        <!--
          "Feita" é o último da fileira, encostado na borda direita, e não o primeiro.
          Medido na tela, com ele à esquerda do grupo o botão principal nascia em dois `x`
          diferentes conforme a linha tivesse ou não o "Recusou" ao lado — 79 px de diferença
          entre uma refeição e um passeio. Encostado na borda, cai sempre no mesmo lugar, que é o
          que o polegar de quem marca as dezoito da manhã aprende uma vez só. É também a ordem
          que os diálogos da casa já usam: o principal por último.
        -->
        <Button
          :label="t('hotel.rotina.feita')"
          icon="pi pi-check"
          size="small"
          :loading="salvando"
          @click="emit('marcar', { tarefaId: tarefa.id, status: 'feita' })"
        />
      </template>

      <!-- Desfazer existe porque o toque errado no corredor é frequente e barato de corrigir. -->
      <Button
        v-else
        :label="t('hotel.rotina.desfazer')"
        icon="pi pi-undo"
        severity="secondary"
        text
        size="small"
        :disabled="salvando"
        @click="emit('marcar', { tarefaId: tarefa.id, status: 'pendente' })"
      />
    </div>
  </li>
</template>

<style scoped>
/*
 * Três colunas, e a do meio é a única elástica: disco | texto | ações.
 *
 * Com `flex` e o corpo em `flex: 1`, o bloco de botões era empurrado para a borda direita da
 * lista, e o polegar tinha de atravessar a tela para sair do nome do animal até o "Feita". Em
 * grade, as ações têm coluna própria, encostada no fim da coluna de texto — e o botão principal
 * fica na borda desse grupo, para cair no mesmo `x` em toda linha.
 */
.tarefa {
  display: grid;
  align-items: center;
  padding: var(--clinic-space-3);
  border: 1px solid var(--clinic-line-soft);
  border-radius: var(--clinic-radius-control);
  gap: var(--clinic-space-3);
  background: var(--clinic-surface);
  grid-template-columns: auto minmax(0, 1fr) auto;
}

.tarefa--resolvida {
  border-color: var(--clinic-line-soft);
  background: var(--clinic-surface-soft);
}

.tarefa--resolvida .tarefa__kind {
  color: var(--clinic-muted);
  text-decoration: line-through;
  text-decoration-thickness: 1px;
}

/* ------------------------------------------------------------------ o disco */

.tarefa__icone {
  display: grid;
  width: 2.1rem;
  height: 2.1rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 0.65rem;
  background: var(--clinic-accent-tint);
  color: var(--clinic-accent-strong);
  font-size: 0.82rem;
}

/* Na janela e atrasada: disco cheio. É o único lugar da linha onde a cor muda. */
.tarefa--na-janela .tarefa__icone {
  background: var(--clinic-accent-deep);
  color: var(--clinic-on-accent);
}

.tarefa--atrasada .tarefa__icone {
  background: var(--clinic-risk-text);
  color: var(--clinic-on-accent);
}

.tarefa--resolvida .tarefa__icone {
  background: var(--clinic-surface-sunken);
  color: var(--clinic-faint);
}

/* ------------------------------------------------------------------ o texto */

.tarefa__corpo {
  display: grid;
  min-width: 0;
  gap: 0.1rem;
}

.tarefa__topo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--clinic-space-2);
}

.tarefa__kind {
  font-size: var(--clinic-font-body);
  font-weight: 700;
}

.tarefa__pet {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
  font-weight: 650;
}

/* Sem o nome do serviço na frente, quem passa a abrir a linha é o animal — e com o peso disso. */
.tarefa__pet--titulo {
  color: var(--clinic-text);
  font-size: var(--clinic-font-body);
  font-weight: 700;
}

.tarefa--resolvida .tarefa__pet--titulo {
  color: var(--clinic-muted);
  text-decoration: line-through;
  text-decoration-thickness: 1px;
}

.tarefa__descricao,
.tarefa__observacao,
.tarefa__quem {
  margin: 0;
  font-size: var(--clinic-font-label);
}

.tarefa__descricao {
  color: var(--clinic-muted);
}

.tarefa__observacao {
  color: var(--clinic-attention-text);
  font-weight: 650;
}

.tarefa__quem {
  color: var(--clinic-faint);
}

/* ------------------------------------------------------------------ as ações */

.tarefa__acoes {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: var(--clinic-space-1);
}

/*
 * No telefone as três colunas não cabem: o "Feita" ficaria com largura de ícone. As ações descem
 * para uma fileira própria, alinhadas à direita, e o disco segue ao lado do texto.
 */
@media (max-width: 620px) {
  .tarefa {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .tarefa__acoes {
    grid-column: 1 / -1;
  }
}
</style>
