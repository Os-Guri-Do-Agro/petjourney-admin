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
 * se anulam, e levam o resto da tela junto. A superfície é sempre a mesma e quem muda é o disco
 * do ícone, que fica cheio, mais o selo escrito ao lado.
 *
 * ## Por que isto deixou de ser um cartão
 *
 * Era um cartão: borda, raio e fundo próprios, por tarefa. Num dia de 49 tarefas isso são 49
 * molduras idênticas, e a ronda que as agrupa — que é a unidade de trabalho de verdade, o gesto
 * que a pessoa de fato executa no corredor — não tinha moldura nenhuma. **A moldura estava no
 * nível errado.** Ela subiu para a ronda (ver `RondaDoHorario`), e aqui restou uma fileira: sem
 * borda, sem fundo, sem raio, separada da vizinha por um filete de 1 px que o pai desenha.
 *
 * O ganho não é de gosto. Quarenta e nove molduras do mesmo peso não hierarquizam nada — elas
 * apenas repetem, e o olho que varre a tela não encontra onde parar.
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
     * O horário previsto, quando é esta fileira que precisa dizê-lo.
     *
     * Só chega preenchido na ronda de um animal — aquela que não ganha cabeçalho, em que a
     * fileira **é** o cartão e portanto carrega a hora que o cabeçalho carregaria. Numa ronda
     * com cabeçalho fica vazio: a hora já está escrita uma vez, acima, e repeti-la em cada uma
     * das vinte fileiras é gastar a primeira coluna da lista com a mesma palavra vinte vezes.
     *
     * Vazio também na aba da estadia, onde a lista não é do turno e o horário não ordena nada.
     */
    hora?: string
    /**
     * Esta fileira vive dentro de uma ronda que já tem cabeçalho.
     *
     * Muda três coisas, e as três pela mesma razão — **o cabeçalho já disse**:
     *
     * - **O nome do serviço sai**, e o animal sobe a texto principal. Repetir o serviço faria
     *   vinte fileiras começarem pela mesma palavra — "Refeição, Refeição, Refeição" — enquanto a
     *   única coisa que muda entre elas, que é de quem é, ficaria em segundo plano e em cinza.
     *   Aberta a ronda, a pergunta não é mais "o quê": é "para quais".
     * - **O disco do serviço sai**, e quem abre a fileira é o rosto do animal. Vinte discos com o
     *   mesmo glifo são uma coluna de enfeite; o avatar, não — ele é a única coisa da fileira que
     *   não se repete.
     * - **O selo de atraso sai.** Dentro de uma ronda isso não é escolha de estilo, é aritmética:
     *   as tarefas de uma ronda partilham horário, e `situacaoDaTarefa` só depende de `status` e
     *   `previstaPara` — logo **todas as pendentes de uma ronda têm forçosamente a mesma
     *   situação**. Vinte selos "Atrasada" empilhados são o mesmo fato dito vinte vezes. O
     *   cabeçalho conta quantas são, uma vez.
     *
     * O selo de **recusa nunca sai**, aqui nem em lugar nenhum: recusa é por animal, varia dentro
     * da mesma ronda, e é justamente a informação que ninguém pode perder de vista.
     */
    dentroDaRonda?: boolean
  }>(),
  {
    petNome: '',
    petIniciais: '',
    petEspecie: null,
    petFotoUrl: '',
    acomodacaoNome: '',
    salvando: false,
    hora: '',
    dentroDaRonda: false,
  },
)

const emit = defineEmits<{
  marcar: [payload: { tarefaId: string; status: TarefaStatus }]
}>()

const { t } = useI18n()
const formato = useHotelFormat()

const resolvida = computed(() => props.tarefa.status !== 'pendente')

/**
 * Qual selo esta fileira mostra, se algum.
 *
 * "Recusou" sempre que houver. "Atrasada" só quando a fileira está por conta própria — dentro de
 * uma ronda com cabeçalho o número lá em cima já diz quantas são, e ver o mesmo aviso repetido em
 * cada fileira ensina a não ler nenhum deles.
 */
const selo = computed<SituacaoDaTarefa | null>(() => {
  if (props.situacao === 'recusada') return 'recusada'

  return props.situacao === 'atrasada' && !props.dentroDaRonda ? 'atrasada' : null
})

/**
 * A hora em que foi marcada, e **só quando ela discorda da hora prevista**.
 *
 * A fileira vive dentro de uma ronda que já tem o horário escrito. Repetir "Marcada às 07:00"
 * embaixo de cada uma das dezoito tarefas daquele bloco é dizer duas vezes a mesma coisa em
 * dezoito lugares. O que é informação é o desencontro: a ração das 07:00 servida às 09:40 conta
 * uma manhã atribulada, e é essa linha que merece existir.
 */
const horaFora = computed(() => {
  if (!resolvida.value || !props.tarefa.executadaEm) return ''

  const marcada = formato.hora(props.tarefa.executadaEm)

  return marcada === formato.hora(props.tarefa.previstaPara) ? '' : marcada
})
</script>

<template>
  <li
    class="tarefa"
    :class="[
      `tarefa--${situacao}`,
      { 'tarefa--resolvida': resolvida, 'tarefa--na-ronda': dentroDaRonda, 'tarefa--com-hora': !!hora },
    ]"
  >
    <!--
      A hora como primeira célula, e não numa calha à esquerda da página.
      Todas as fileiras têm a mesma largura, então a coluna de horas continua existindo —
      desenhada pelas próprias fileiras, sem cobrar 3,6 rem de largura de cada uma delas.
    -->
    <span v-if="hora" class="tarefa__hora clinic-value">{{ hora }}</span>

    <span v-if="!dentroDaRonda" class="tarefa__icone" aria-hidden="true">
      <IconeDeTarefa :kind="tarefa.kind" />
    </span>

    <div class="tarefa__corpo">
      <div class="tarefa__topo">
        <strong v-if="!dentroDaRonda" class="tarefa__kind">
          {{ formato.tarefaKind(tarefa.kind) }}
        </strong>

        <span
          v-if="petNome"
          class="tarefa__pet"
          :class="{ 'tarefa__pet--titulo': dentroDaRonda }"
        >
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
          v-if="selo"
          :rotulo="formato.situacaoDaTarefa(selo)"
          :tom="selo === 'recusada' ? 'atencao' : 'risco'"
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
          :class="['tarefa__feita', { 'tarefa__feita--adiante': situacao === 'futura' }]"
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
 * Uma fileira, não um cartão: sem borda, sem fundo, sem raio.
 *
 * A separação entre uma fileira e a seguinte é um filete de 1 px que o pai desenha de borda a
 * borda (`RondaDoHorario`, `.ronda__lista > li + li`). Quem tem moldura é a ronda.
 *
 * A coluna do meio é a única elástica. Com `flex` e o corpo em `flex: 1`, o bloco de botões era
 * empurrado para a borda direita da lista, e o polegar tinha de atravessar a tela para sair do
 * nome do animal até o "Feita". Em grade, as ações têm coluna própria, encostada no fim da coluna
 * de texto — e o botão principal fica na borda desse grupo, para cair no mesmo `x` em toda linha.
 */
.tarefa {
  display: grid;
  align-items: center;
  padding: var(--clinic-space-3) var(--clinic-space-4);
  gap: var(--clinic-space-3);
  grid-template-columns: auto minmax(0, 1fr) auto;
}

/* Com a hora na frente: hora | disco | texto | ações. */
.tarefa--com-hora {
  grid-template-columns: auto auto minmax(0, 1fr) auto;
}

/*
 * Dentro de uma ronda o disco sai, e com ele a primeira coluna. O recuo diz "isto está dentro
 * daquilo" sem precisar de uma segunda moldura para dizer o mesmo.
 */
.tarefa--na-ronda {
  padding-inline-start: calc(var(--clinic-space-4) + var(--clinic-space-3));
  grid-template-columns: minmax(0, 1fr) auto;
}

.tarefa--resolvida .tarefa__kind {
  color: var(--clinic-muted);
  text-decoration: line-through;
  text-decoration-thickness: 1px;
}

/* ------------------------------------------------------------------ a hora */

/*
 * Tabular, para que os dígitos caiam uns sobre os outros de fileira em fileira: é isso que faz
 * uma coluna de horas existir sem que ninguém desenhe uma coluna.
 */
.tarefa__hora {
  min-width: 3.1rem;
  color: var(--clinic-muted);
  font-size: var(--clinic-font-value);
  font-variant-numeric: tabular-nums;
  font-weight: 700;
}

/* O segundo canal do atraso, junto do disco: a hora que já passou é a própria acusação. */
.tarefa--atrasada .tarefa__hora {
  color: var(--clinic-risk-text);
}

.tarefa--resolvida .tarefa__hora {
  color: var(--clinic-faint);
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

/* Na janela e atrasada: disco cheio. É o único lugar da fileira onde a cor muda. */
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
  font-size: var(--clinic-font-base);
  font-weight: 700;
}

.tarefa__pet {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
  font-weight: 400;
}

/* Sem o nome do serviço na frente, quem passa a abrir a fileira é o animal — e com o peso disso. */
.tarefa__pet--titulo {
  color: var(--clinic-text);
  font-size: var(--clinic-font-base);
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
 * O rótulo do botão principal, legível pela primeira vez.
 *
 * O "Feita" herdava a cor primária do preset com tinta branca por cima: `#ffffff` sobre o sálvia
 * `#84c1b4` dá **2,04:1** — reprovado em qualquer nível, e não por pouco. O rótulo do botão que
 * se toca mais vezes em toda a tela era o texto menos legível dela, repetido dezenas de vezes.
 *
 * O fundo não muda; muda a tinta. Escura sobre o mesmo sálvia passa de 5,5:1, e o botão continua
 * sendo verde cheio, que é o que o faz ser achado sem leitura.
 */
.tarefa__feita.p-button {
  border-color: var(--clinic-accent);
  background: var(--clinic-accent);
  color: var(--clinic-heat-ink);
}

.tarefa__feita.p-button:not(:disabled):hover {
  border-color: var(--clinic-accent-deep);
  background: var(--clinic-accent-deep);
  color: var(--clinic-on-accent);
}

/*
 * O que é para depois não pede o polegar agora.
 *
 * Preenchido, o "Feita" se repetia em toda tarefa do dia — inclusive nas doze que só acontecem
 * às 20h — e em tela larga virava uma faixa vertical de verde. Verde cheio passa a significar
 * uma coisa só: **isto é para agora**. As de mais tarde ficam contornadas, com a mesma posição,
 * o mesmo tamanho e o mesmo toque; muda só quanto elas pedem o olho.
 */
.tarefa__feita--adiante.p-button {
  border-color: var(--clinic-accent-deep);
  background: transparent;
  color: var(--clinic-accent-strong);
}

.tarefa__feita--adiante.p-button:not(:disabled):hover {
  border-color: var(--clinic-accent-deep);
  background: var(--clinic-accent-tint);
  color: var(--clinic-accent-strong);
}

/*
 * No telefone as colunas não cabem: o "Feita" ficaria com largura de ícone. As ações descem
 * para uma fileira própria, alinhadas à direita, e o disco segue ao lado do texto.
 */
@media (max-width: 620px) {
  .tarefa {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .tarefa--com-hora {
    grid-template-columns: auto auto minmax(0, 1fr);
  }

  .tarefa--na-ronda {
    grid-template-columns: minmax(0, 1fr);
  }

  .tarefa__acoes {
    grid-column: 1 / -1;
  }
}
</style>
