<script setup lang="ts">
/**
 * Cadastro de leitos.
 *
 * **O sistema não tem como adivinhar quantos leitos uma clínica tem.** Quem monta a internação é
 * ela: cadastra os leitos que existem, dá nome a eles, e mexe nesse número quando cresce, reforma
 * ou perde um por manutenção. Sem esta tela, o mapa seria uma constante de código — verdadeiro
 * para uma clínica e errado para todas as outras.
 *
 * É **configuração**, não trabalho de plantão, e por isso vive num diálogo em vez de ocupar
 * espaço permanente no mapa: acontece no dia da mudança e não volta a acontecer por meses.
 *
 * Duas regras aparecem como texto, e não como botão apagado:
 *
 * - **Leito ocupado não sai de operação.** Seria dizer que o animal que está nele não está.
 * - **Leito com história não se apaga.** A internação guarda onde o animal ficou, e essa é a
 *   resposta que a clínica procura seis meses depois. Some do cadastro apenas o que nunca
 *   recebeu ninguém — o leito criado por engano.
 */
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import ClinicField from '../base/ClinicField.vue'
import ClinicToggleGroup from '../base/ClinicToggleGroup.vue'
import type { Leito, LeitoInativoMotivo, LeitoKind } from '../../data/types'
import { useClinicFormat } from '../../composables/useClinicFormat'
import {
  impedimentoParaDesativar,
  impedimentoParaRemover,
  proximoNomeDeLeito,
} from '../../domain/internacao'
import type { Internacao } from '../../data/types'
import { useClinicoStore } from '../../stores/clinico'

const props = defineProps<{
  aberto: boolean
  leitos: Leito[]
  /** Necessárias para saber o que está ocupado e o que já tem história. */
  internacoes: Internacao[]
  salvando: boolean
  erro: string
}>()

const emit = defineEmits<{
  fechar: []
  criar: [entrada: { nome: string; roomId: string; kind: LeitoKind }]
  editar: [entrada: { leitoId: string; nome: string; kind: LeitoKind }]
  desativar: [entrada: { leitoId: string; motivo: LeitoInativoMotivo; detalhe: string }]
  reativar: [leitoId: string]
  remover: [leitoId: string]
}>()

const { t } = useI18n()
const formato = useClinicFormat()
const clinico = useClinicoStore()

const KINDS: LeitoKind[] = ['geral', 'felino', 'isolamento', 'uti']
const MOTIVOS: LeitoInativoMotivo[] = [
  'manutencao',
  'desinfeccao',
  'reforma',
  'equipamento',
  'outro',
]

/** Uma coisa por vez: ou se cadastra um leito, ou se mexe num que já existe. */
const painel = ref<'lista' | 'novo'>('lista')
const editando = ref<string | null>(null)
const desativando = ref<string | null>(null)

const nome = ref('')
const kind = ref<LeitoKind>('geral')
const roomId = ref('')
const motivo = ref<LeitoInativoMotivo>('manutencao')
const detalhe = ref('')

const visivel = computed({
  get: () => props.aberto,
  set: (valor: boolean) => {
    if (!valor) {
      emit('fechar')
    }
  },
})

const salasDeInternacao = computed(() =>
  clinico.salas
    .filter((sala) => sala.kind === 'internacao')
    .map((sala) => ({ valor: sala.id, rotulo: sala.nome })),
)

const opcoesDeKind = computed(() =>
  KINDS.map((valor) => ({ valor, rotulo: t(`clinico.internacao.leitoKind.${valor}`) })),
)

const opcoesDeMotivo = computed(() =>
  MOTIVOS.map((valor) => ({
    valor,
    rotulo: t(`clinico.internacao.leitos.motivo.${valor}`),
  })),
)

const ativos = computed(() => props.leitos.filter((leito) => leito.ativo).length)

// ---------------------------------------------------------------------------
// Busca e paginação
//
// Oito leitos cabem numa lista; cem não. Uma clínica grande abre este diálogo para achar **um**
// leito — e a pergunta que ela faz quase nunca é "qual é o R37", é "onde está o Bento" ou "quais
// estão parados". Por isso a busca varre também o **paciente internado**, e o recorte por
// situação existe ao lado dela.
// ---------------------------------------------------------------------------

type Recorte = 'todos' | 'operacao' | 'parados'

const POR_PAGINA = 8

const busca = ref('')
const recorte = ref<Recorte>('todos')
const pagina = ref(0)

/** Quem ocupa cada leito agora — é o que faz a busca por nome de paciente funcionar. */
const pacientePorLeito = computed(() => {
  const mapa = new Map<string, string>()

  for (const internacao of props.internacoes) {
    if (internacao.status === 'internado') {
      mapa.set(internacao.leitoId, clinico.pet(internacao.petId)?.nome ?? '')
    }
  }

  return mapa
})

const opcoesDeRecorte = computed(() => [
  { valor: 'todos' as Recorte, rotulo: t('clinico.internacao.leitos.recorte.todos') },
  { valor: 'operacao' as Recorte, rotulo: t('clinico.internacao.leitos.recorte.operacao') },
  {
    valor: 'parados' as Recorte,
    rotulo: t('clinico.internacao.leitos.recorte.parados'),
    tom: 'atencao' as const,
  },
])

/**
 * O texto pelo qual um leito é encontrado.
 *
 * Junta nome, tipo, sala e paciente numa string só: quem digita "iso" quer o isolamento, quem
 * digita "bento" quer o leito onde ele está, e nenhum dos dois deveria precisar saber em qual
 * campo procurar.
 */
function textoDeBusca(leito: Leito): string {
  return [
    leito.nome,
    t(`clinico.internacao.leitoKind.${leito.kind}`),
    clinico.sala(leito.roomId)?.nome ?? '',
    pacientePorLeito.value.get(leito.id) ?? '',
    leito.ativo ? '' : t(`clinico.internacao.leitos.motivo.${leito.motivoInativo ?? 'outro'}`),
  ]
    .join(' ')
    .toLowerCase()
}

const filtrados = computed(() => {
  const termo = busca.value.trim().toLowerCase()

  return props.leitos.filter((leito) => {
    if (recorte.value === 'operacao' && !leito.ativo) {
      return false
    }

    if (recorte.value === 'parados' && leito.ativo) {
      return false
    }

    return termo.length === 0 || textoDeBusca(leito).includes(termo)
  })
})

const totalDePaginas = computed(() => Math.max(1, Math.ceil(filtrados.value.length / POR_PAGINA)))

/*
 * Filtrar joga de volta para a primeira página.
 *
 * Sem isto, buscar estando na página 4 devolveria uma lista vazia com o resultado logo ali na
 * página 1 — e a tela diria "nada encontrado" mentindo.
 */
watch([busca, recorte], () => {
  pagina.value = 0
})

watch(totalDePaginas, (total) => {
  if (pagina.value > total - 1) {
    pagina.value = total - 1
  }
})

const visiveis = computed(() =>
  filtrados.value.slice(pagina.value * POR_PAGINA, (pagina.value + 1) * POR_PAGINA),
)

const primeiroDaPagina = computed(() =>
  filtrados.value.length === 0 ? 0 : pagina.value * POR_PAGINA + 1,
)

const ultimoDaPagina = computed(() =>
  Math.min((pagina.value + 1) * POR_PAGINA, filtrados.value.length),
)

/** Fecha tudo o que estava aberto e volta o formulário ao padrão. */
function voltarParaLista() {
  painel.value = 'lista'
  editando.value = null
  desativando.value = null
  nome.value = ''
  detalhe.value = ''
  motivo.value = 'manutencao'
}

function limparBusca() {
  busca.value = ''
  recorte.value = 'todos'
  pagina.value = 0
}

watch(
  () => props.aberto,
  (aberto) => {
    if (aberto) {
      voltarParaLista()
      limparBusca()
    }
  },
)

function abrirNovo() {
  editando.value = null
  desativando.value = null
  kind.value = 'geral'
  roomId.value = salasDeInternacao.value[0]?.valor ?? ''
  nome.value = proximoNomeDeLeito(props.leitos, 'geral')
  painel.value = 'novo'
}

/* Trocar o tipo re-sugere o nome — enquanto ninguém tiver digitado o seu. */
watch(kind, (valor) => {
  if (painel.value === 'novo') {
    nome.value = proximoNomeDeLeito(props.leitos, valor)
  }
})

function abrirEdicao(leito: Leito) {
  painel.value = 'lista'
  desativando.value = null
  editando.value = leito.id
  nome.value = leito.nome
  kind.value = leito.kind
}

function abrirDesativacao(leito: Leito) {
  painel.value = 'lista'
  editando.value = null
  desativando.value = leito.id
  motivo.value = 'manutencao'
  detalhe.value = ''
}

function podeDesativar(leito: Leito): boolean {
  return impedimentoParaDesativar(leito, props.internacoes) === null
}

function podeRemover(leito: Leito): boolean {
  return impedimentoParaRemover(leito, props.internacoes) === null
}

const nomeValido = computed(() => nome.value.trim().length > 0)

function confirmarNovo() {
  if (!nomeValido.value) {
    return
  }

  emit('criar', { nome: nome.value, roomId: roomId.value, kind: kind.value })
}

function confirmarEdicao() {
  if (!editando.value || !nomeValido.value) {
    return
  }

  emit('editar', { leitoId: editando.value, nome: nome.value, kind: kind.value })
}

function confirmarDesativacao() {
  if (!desativando.value) {
    return
  }

  emit('desativar', {
    leitoId: desativando.value,
    motivo: motivo.value,
    detalhe: detalhe.value,
  })
}

/**
 * Fecha os formulários quando a operação passa.
 *
 * A store devolve `true` só quando a mudança foi aceita, e é a página que decide chamar isto —
 * assim uma recusa por regra mantém o formulário aberto, com o texto do impedimento à vista,
 * em vez de sumir e deixar o usuário sem saber o que aconteceu.
 */
defineExpose({ voltarParaLista })
</script>

<template>
  <Dialog
    v-model:visible="visivel"
    modal
    class="clinic-dialog hc-tema"
    :style="{ width: 'min(46rem, 96vw)' }"
    :content-style="{ maxHeight: '68vh', overflowY: 'auto' }"
    :header="t('clinico.internacao.leitos.titulo')"
    dismissable-mask
  >
    <div class="leitos clinic-scope">
      <header class="leitos__topo">
        <p class="leitos__conta">
          {{ t('clinico.internacao.leitos.conta', { total: leitos.length, ativos }) }}
        </p>

        <Button
          v-if="painel === 'lista'"
          :label="t('clinico.internacao.leitos.adicionar')"
          icon="ph ph-plus"
          size="small"
          severity="secondary"
          outlined
          @click="abrirNovo"
        />
      </header>

      <p class="leitos__ajuda">{{ t('clinico.internacao.leitos.ajuda') }}</p>

      <p v-if="erro" class="leitos__erro" role="alert">{{ t(erro) }}</p>

      <!-- Cadastro de um leito novo. -->
      <section v-if="painel === 'novo'" class="formulario">
        <h4 class="formulario__titulo">{{ t('clinico.internacao.leitos.novoTitulo') }}</h4>

        <div class="formulario__campos">
          <ClinicField :rotulo="t('clinico.internacao.leitos.tipo')">
            <template #default="{ id }">
              <Select
                :id="id"
                v-model="kind"
                :options="opcoesDeKind"
                option-label="rotulo"
                option-value="valor"
                fluid
                :pt="{ overlay: { class: 'clinic-overlay' } }"
              />
            </template>
          </ClinicField>

          <ClinicField :rotulo="t('clinico.internacao.leitos.sala')">
            <template #default="{ id }">
              <Select
                :id="id"
                v-model="roomId"
                :options="salasDeInternacao"
                option-label="rotulo"
                option-value="valor"
                fluid
                :pt="{ overlay: { class: 'clinic-overlay' } }"
              />
            </template>
          </ClinicField>

          <ClinicField
            :rotulo="t('clinico.internacao.leitos.nome')"
            :dica="t('clinico.internacao.leitos.nomeDica')"
            obrigatorio
          >
            <template #default="{ id }">
              <InputText :id="id" v-model="nome" fluid />
            </template>
          </ClinicField>
        </div>

        <div class="formulario__acoes">
          <Button
            :label="t('clinico.internacao.leitos.cancelar')"
            severity="secondary"
            text
            size="small"
            @click="voltarParaLista"
          />
          <Button
            :label="t('clinico.internacao.leitos.criar')"
            icon="ph ph-check"
            size="small"
            :disabled="!nomeValido || salvando"
            :loading="salvando"
            @click="confirmarNovo"
          />
        </div>
      </section>

<!--
        Busca e recorte só aparecem quando há lista o bastante para perder alguém dentro dela.
        Numa clínica de oito leitos eles seriam dois controles a mais para achar o que já está à
        vista; numa de cem, são a única forma de chegar ao leito certo.
      -->
      <div v-if="leitos.length > POR_PAGINA" class="busca">
        <InputText
          v-model="busca"
          class="busca__campo"
          :placeholder="t('clinico.internacao.leitos.buscar')"
          :aria-label="t('clinico.internacao.leitos.buscar')"
        />

        <ClinicToggleGroup
          v-model="recorte"
          :opcoes="opcoesDeRecorte"
          :rotulo="t('clinico.internacao.leitos.recorteRotulo')"
        />
      </div>

      <p v-if="filtrados.length === 0" class="lista__vazia">
        {{ t('clinico.internacao.leitos.semResultado', { termo: busca }) }}
      </p>

      <ul class="lista">
        <li v-for="leito in visiveis" :key="leito.id" class="linha">
          <template v-if="editando === leito.id">
            <div class="linha__edicao">
              <ClinicField :rotulo="t('clinico.internacao.leitos.nome')" obrigatorio>
                <template #default="{ id }">
                  <InputText :id="id" v-model="nome" fluid />
                </template>
              </ClinicField>

              <ClinicField :rotulo="t('clinico.internacao.leitos.tipo')">
                <template #default="{ id }">
                  <Select
                    :id="id"
                    v-model="kind"
                    :options="opcoesDeKind"
                    option-label="rotulo"
                    option-value="valor"
                    fluid
                    :pt="{ overlay: { class: 'clinic-overlay' } }"
                  />
                </template>
              </ClinicField>

              <div class="formulario__acoes">
                <Button
                  :label="t('clinico.internacao.leitos.cancelar')"
                  severity="secondary"
                  text
                  size="small"
                  @click="voltarParaLista"
                />
                <Button
                  :label="t('clinico.internacao.leitos.salvar')"
                  icon="ph ph-check"
                  size="small"
                  :disabled="!nomeValido || salvando"
                  :loading="salvando"
                  @click="confirmarEdicao"
                />
              </div>
            </div>
          </template>

          <template v-else-if="desativando === leito.id">
            <div class="linha__edicao">
              <p class="linha__alvo">
                {{ t('clinico.internacao.leitos.desativarAlvo', { leito: leito.nome }) }}
              </p>

              <ClinicField :rotulo="t('clinico.internacao.leitos.motivoRotulo')">
                <template #default="{ id }">
                  <Select
                    :id="id"
                    v-model="motivo"
                    :options="opcoesDeMotivo"
                    option-label="rotulo"
                    option-value="valor"
                    fluid
                    :pt="{ overlay: { class: 'clinic-overlay' } }"
                  />
                </template>
              </ClinicField>

              <ClinicField
                :rotulo="t('clinico.internacao.leitos.detalhe')"
                :dica="t('clinico.internacao.leitos.detalheDica')"
              >
                <template #default="{ id }">
                  <InputText
                    :id="id"
                    v-model="detalhe"
                    :placeholder="t('clinico.internacao.leitos.detalheExemplo')"
                    fluid
                  />
                </template>
              </ClinicField>

              <div class="formulario__acoes">
                <Button
                  :label="t('clinico.internacao.leitos.cancelar')"
                  severity="secondary"
                  text
                  size="small"
                  @click="voltarParaLista"
                />
                <Button
                  :label="t('clinico.internacao.leitos.confirmarDesativacao')"
                  icon="ph ph-power"
                  severity="danger"
                  size="small"
                  :loading="salvando"
                  @click="confirmarDesativacao"
                />
              </div>
            </div>
          </template>

          <template v-else>
            <div class="linha__identidade">
              <strong class="linha__nome clinic-value">{{ leito.nome }}</strong>
              <span class="linha__meta">
                {{ t(`clinico.internacao.leitoKind.${leito.kind}`) }}
                ·
                {{ clinico.sala(leito.roomId)?.nome }}
              </span>

              <p v-if="!leito.ativo" class="linha__parado">
                <i class="ph ph-power" aria-hidden="true" />
                {{ t(`clinico.internacao.leitos.motivo.${leito.motivoInativo ?? 'outro'}`) }}
                <span v-if="leito.detalheInativo">· {{ leito.detalheInativo }}</span>
                <span v-if="leito.inativoDesde" class="linha__desde">
                  ·
                  {{
                    t('clinico.internacao.leitos.paradoDesde', {
                      quando: formato.relativo(leito.inativoDesde),
                    })
                  }}
                </span>
              </p>
            </div>

            <div class="linha__acoes">
              <Button
                :label="t('clinico.internacao.leitos.editar')"
                severity="secondary"
                text
                size="small"
                :disabled="salvando"
                @click="abrirEdicao(leito)"
              />

<!--
                Ocupado não ganha botão apagado: ganha a frase que diz o que fazer antes.
                Botão desabilitado só se explica pelo `title`, que não existe no toque nem no
                leitor de tela — e um controle inerte sem motivo à vista é lido como defeito.
              -->
              <span v-if="leito.ativo && !podeDesativar(leito)" class="linha__travado">
                <i class="ph ph-user" aria-hidden="true" />
                {{ t('clinico.internacao.leitos.ocupadoCurto') }}
              </span>
              <Button
                v-else-if="leito.ativo"
                :label="t('clinico.internacao.leitos.desativar')"
                severity="secondary"
                text
                size="small"
                :disabled="salvando"
                @click="abrirDesativacao(leito)"
              />
              <Button
                v-else
                :label="t('clinico.internacao.leitos.reativar')"
                icon="ph ph-check"
                text
                size="small"
                :disabled="salvando"
                @click="emit('reativar', leito.id)"
              />

              <!--
                Remover só aparece onde é possível. Um botão que existe e nunca funciona ensina a
                ignorar botões; o leito com história se desativa, e a linha acima já diz como.
              -->
              <Button
                v-if="podeRemover(leito)"
                :label="t('clinico.internacao.leitos.remover')"
                severity="danger"
                text
                size="small"
                :disabled="salvando"
                @click="emit('remover', leito.id)"
              />
            </div>
          </template>
        </li>
      </ul>

      <!-- Paginador só onde há mais de uma página; senão é enfeite que ocupa linha. -->
      <nav v-if="totalDePaginas > 1" class="paginas" :aria-label="t('clinico.internacao.leitos.paginas')">
        <Button
          icon="ph ph-caret-left"
          severity="secondary"
          text
          size="small"
          :aria-label="t('clinico.internacao.leitos.anterior')"
          :disabled="pagina === 0"
          @click="pagina -= 1"
        />

        <span class="paginas__conta clinic-value">
          {{
            t('clinico.internacao.leitos.intervalo', {
              de: primeiroDaPagina,
              ate: ultimoDaPagina,
              total: filtrados.length,
            })
          }}
        </span>

        <Button
          icon="ph ph-caret-right"
          severity="secondary"
          text
          size="small"
          :aria-label="t('clinico.internacao.leitos.proxima')"
          :disabled="pagina >= totalDePaginas - 1"
          @click="pagina += 1"
        />
      </nav>
    </div>

    <template #footer>
      <Button
        :label="t('clinico.internacao.leitos.fechar')"
        severity="secondary"
        @click="emit('fechar')"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.leitos {
  display: grid;
  gap: var(--clinic-space-3);
}

.leitos__topo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--clinic-space-3);
}

.leitos__conta {
  margin: 0;
  font-size: var(--clinic-font-body);
  font-weight: 750;
}

.leitos__ajuda {
  margin: 0;
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
  line-height: 1.5;
}

.leitos__erro {
  margin: 0;
  padding: var(--clinic-space-3);
  border: 1px solid var(--clinic-risk-line);
  border-radius: var(--clinic-radius-control);
  background: var(--clinic-risk-bg);
  color: var(--clinic-risk-text);
  font-size: var(--clinic-font-label);
  font-weight: 700;
}

.formulario {
  display: grid;
  gap: var(--clinic-space-3);
  padding: var(--clinic-space-4);
  border: 1px solid var(--clinic-accent-soft);
  border-radius: var(--clinic-radius-control);
  background: var(--clinic-surface-soft);
}

.formulario__titulo {
  margin: 0;
  font-size: var(--clinic-font-body);
  font-weight: 750;
}

.formulario__campos {
  display: grid;
  gap: var(--clinic-space-3);
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.formulario__acoes {
  display: flex;
  justify-content: flex-end;
  gap: var(--clinic-space-2);
}

.busca {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--clinic-space-3);
}

.busca__campo {
  min-width: 0;
  flex: 1 1 14rem;
}

.lista__vazia {
  margin: 0;
  padding: var(--clinic-space-5);
  border: 1px dashed var(--clinic-line-strong);
  border-radius: var(--clinic-radius-control);
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
  text-align: center;
}

.paginas {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--clinic-space-2);
}

.paginas__conta {
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
  font-weight: 650;
}

.lista {
  display: grid;
  margin: 0;
  padding: 0;
  gap: var(--clinic-space-2);
  list-style: none;
}

.linha {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  padding: var(--clinic-space-3);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-control);
  gap: var(--clinic-space-3);
  background: var(--clinic-surface);
}

.linha__identidade {
  display: grid;
  min-width: 0;
  gap: 0.1rem;
}

.linha__nome {
  font-size: var(--clinic-font-body);
  font-weight: 750;
}

.linha__meta {
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
}

.linha__parado {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  margin: 0.15rem 0 0;
  gap: 0.3rem;
  color: var(--clinic-attention-text);
  font-size: var(--clinic-font-label);
  font-weight: 650;
}

.linha__desde {
  font-weight: 550;
  opacity: 0.85;
}

.linha__acoes {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--clinic-space-1);
}

.linha__travado {
  display: inline-flex;
  align-items: center;
  padding: 0 var(--clinic-space-2);
  gap: 0.3rem;
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
  font-weight: 650;
}

/* Em edição a linha vira formulário e ocupa a largura toda. */
.linha__edicao {
  display: grid;
  width: 100%;
  gap: var(--clinic-space-3);
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.linha__edicao .formulario__acoes,
.linha__alvo {
  grid-column: 1 / -1;
}

.linha__alvo {
  margin: 0;
  font-size: var(--clinic-font-label);
  font-weight: 700;
}

@media (width <= 640px) {
  .formulario__campos,
  .linha__edicao {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
