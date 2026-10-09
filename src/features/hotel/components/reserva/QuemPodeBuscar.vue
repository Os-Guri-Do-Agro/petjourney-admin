<script setup lang="ts">
/**
 * Quem pode buscar o animal: o responsável, e quem a família autorizar para esta estadia.
 *
 * Usado na reserva e no check-in, os dois momentos em que o responsável está disponível para
 * dizer. Antes era uma fila de nomes soltos — e um nome não serve no balcão: a recepção que ouve
 * "a Clara veio buscar" não tem como ligar para confirmar nem o que conferir. Agora cada pessoa
 * tem telefone, relação e, quando houver, o documento que o check-out vai pedir.
 *
 * Três decisões de desenho:
 *
 * - **O responsável é a primeira linha e não tem caixa.** Ele sempre pode buscar — o animal é
 *   dele —, e uma caixa que não se desmarca é um controle mentindo. No lugar dela, um cadeado.
 * - **Quem a família já cadastrou aparece desmarcado até alguém marcar.** Estar no cadastro não
 *   autoriza: a vizinha que buscou em julho não fica autorizada para sempre. Cada estadia diz quem
 *   vale para ela, e a caixa é essa pergunta.
 * - **Cadastrar é recolhido.** O caso comum é "só o responsável" ou "a mesma pessoa de sempre";
 *   quatro campos abertos em toda reserva ensinariam a recepção a passar por cima deles.
 *
 * Gente nova sai daqui com um id provisório (`nova-…`). O repositório reconhece o id que o
 * cadastro não conhece como pessoa nova e dá o definitivo — o componente não inventa id de banco.
 */
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import InputText from 'primevue/inputtext'
import { computed, nextTick, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { formatarTelefone } from '@/features/clinico/domain/cadastro'

import { pessoaPodeEntrar, problemaDaPessoa } from '../../domain/contatos'
import type { PessoaAutorizada } from '../../data/types'

const props = defineProps<{
  /** Quem responde pelo animal. Sempre autorizado, nunca removível. */
  responsavel: { nome: string; telefone: string }
  /** O cadastro da família: quem já foi autorizado alguma vez. */
  conhecidos: PessoaAutorizada[]
}>()

/** Quem pode buscar **nesta estadia**, além do responsável. */
const marcadas = defineModel<PessoaAutorizada[]>({ required: true })

/**
 * Há uma pessoa digitada e ainda não acrescentada.
 *
 * O diálogo de fora trava a confirmação enquanto isto for verdade. Sem a trava, quem digita a
 * irmã e esquece de tocar em "Adicionar" confirma a entrada sem ela — e descobre na saída, com a
 * irmã no balcão e o nome fora da lista.
 */
const pendente = defineModel<boolean>('pendente', { default: false })

const { t } = useI18n()
const idCampo = useId()

/** Quem foi cadastrado agora, antes de a reserva ou o check-in gravar. */
const cadastradasAgora = ref<PessoaAutorizada[]>([])
let sequencia = 0

/**
 * Todas as linhas, sem repetir ninguém.
 *
 * Os marcados entram junto do cadastro porque a reserva pode carregar alguém que o cadastro não
 * tem — uma reserva antiga, de antes de o cadastro existir. Sem isso, a pessoa autorizada sumiria
 * da tela e continuaria valendo na gravação.
 */
const pessoas = computed(() => {
  const vistas = new Set<string>()

  return [...props.conhecidos, ...marcadas.value, ...cadastradasAgora.value].filter((pessoa) => {
    if (vistas.has(pessoa.id)) {
      return false
    }

    vistas.add(pessoa.id)

    return true
  })
})

const idsMarcados = computed(() => marcadas.value.map((pessoa) => pessoa.id))

/** A caixa devolve ids; a lista volta na ordem das linhas, que é a ordem que a tela mostra. */
function marcar(ids: string[] | null | undefined) {
  const escolhidos = new Set(ids ?? [])

  marcadas.value = pessoas.value.filter((pessoa) => escolhidos.has(pessoa.id))
}

/** Relação, telefone e documento numa linha só, sem separador sobrando quando falta um. */
function detalhe(pessoa: PessoaAutorizada) {
  return [pessoa.relacao, pessoa.telefone, pessoa.documento].filter(Boolean).join(' · ')
}

// ------------------------------------------------------------------ cadastro de pessoa nova

const cadastrando = ref(false)
/** Os erros só aparecem depois da primeira tentativa: acusar quem ainda está digitando atrapalha. */
const tentou = ref(false)
const rascunho = ref({ nome: '', telefone: '', relacao: '', documento: '' })

/* A máscara é progressiva: formata o que foi ditado e não inventa o que falta. */
watch(
  () => rascunho.value.telefone,
  (valor) => {
    const formatado = formatarTelefone(valor)

    if (formatado !== valor) {
      rascunho.value.telefone = formatado
    }
  },
)

const problema = computed(() =>
  problemaDaPessoa(rascunho.value, [props.responsavel, ...pessoas.value]),
)

const erroDoNome = computed(() =>
  tentou.value && problema.value.nome ? t('hotel.quemBusca.erroNome') : '',
)

const erroDoTelefone = computed(() => {
  if (!tentou.value || !problema.value.telefone) {
    return ''
  }

  if (problema.value.telefone === 'repetido') {
    return t('hotel.quemBusca.erroTelefoneRepetido', { nome: problema.value.repetidoDe })
  }

  return problema.value.telefone === 'invalido'
    ? t('hotel.quemBusca.erroTelefoneInvalido')
    : t('hotel.quemBusca.erroTelefone')
})

watch(
  () => cadastrando.value && Boolean(rascunho.value.nome.trim() || rascunho.value.telefone.trim()),
  (valor) => {
    pendente.value = valor
  },
  { immediate: true },
)

function focar(id: string) {
  void nextTick(() => document.getElementById(id)?.focus())
}

function abrirCadastro() {
  rascunho.value = { nome: '', telefone: '', relacao: '', documento: '' }
  tentou.value = false
  cadastrando.value = true
  focar(`${idCampo}-nome`)
}

function fecharCadastro() {
  cadastrando.value = false
  tentou.value = false
  focar(`${idCampo}-abrir`)
}

function adicionar() {
  tentou.value = true

  if (!pessoaPodeEntrar(problema.value)) {
    return
  }

  sequencia += 1

  const nova: PessoaAutorizada = {
    id: `nova-${sequencia}`,
    nome: rascunho.value.nome.trim(),
    telefone: rascunho.value.telefone.trim(),
    relacao: rascunho.value.relacao.trim(),
    documento: rascunho.value.documento.trim(),
  }

  /* Quem foi cadastrado agora já sai marcado: cadastrar e não autorizar é o caso raro. */
  cadastradasAgora.value = [...cadastradasAgora.value, nova]
  marcadas.value = [...marcadas.value, nova]
  fecharCadastro()
}
</script>

<template>
  <div class="quem" role="group">
    <TransitionGroup tag="ul" name="quem-linha" class="quem__lista">
      <li key="responsavel" class="pessoa">
        <i
          class="ph ph-lock pessoa__marca"
          role="img"
          :aria-label="t('hotel.quemBusca.sempre')"
          :title="t('hotel.quemBusca.sempre')"
        />
        <span class="pessoa__texto">
          <span class="pessoa__nome">{{ responsavel.nome }}</span>
          <span class="pessoa__detalhe">
            {{
              [t('hotel.quemBusca.responsavel'), responsavel.telefone].filter(Boolean).join(' · ')
            }}
          </span>
        </span>
      </li>

      <li v-for="pessoa in pessoas" :key="pessoa.id" class="pessoa">
        <Checkbox
          :input-id="`${idCampo}-${pessoa.id}`"
          :model-value="idsMarcados"
          :value="pessoa.id"
          @update:model-value="marcar"
        />
        <label :for="`${idCampo}-${pessoa.id}`" class="pessoa__texto pessoa__texto--toque">
          <span class="pessoa__nome">{{ pessoa.nome }}</span>
          <span v-if="detalhe(pessoa)" class="pessoa__detalhe">{{ detalhe(pessoa) }}</span>
        </label>
      </li>
    </TransitionGroup>

    <p v-if="pessoas.length === 0 && !cadastrando" class="quem__vazio">
      {{ t('hotel.quemBusca.ninguemMais') }}
    </p>

    <Button
      v-if="!cadastrando"
      :id="`${idCampo}-abrir`"
      :label="t('hotel.quemBusca.cadastrar')"
      icon="ph ph-user-plus"
      severity="secondary"
      outlined
      class="quem__cadastrar"
      @click="abrirCadastro"
    />

    <Transition name="quem-abre">
      <div v-if="cadastrando" class="nova" role="group" :aria-labelledby="`${idCampo}-nova`">
        <p :id="`${idCampo}-nova`" class="nova__titulo">{{ t('hotel.quemBusca.novaPessoa') }}</p>

        <div class="nova__grade">
          <div class="campo">
            <label :for="`${idCampo}-nome`">
              {{ t('hotel.quemBusca.nome') }}
              <span class="campo__obrigatorio" aria-hidden="true">*</span>
            </label>
            <InputText
              :id="`${idCampo}-nome`"
              v-model="rascunho.nome"
              autocomplete="off"
              aria-required="true"
              :invalid="Boolean(erroDoNome)"
              :aria-describedby="erroDoNome ? `${idCampo}-nome-erro` : undefined"
              fluid
              @keyup.enter="adicionar"
            />
            <small v-if="erroDoNome" :id="`${idCampo}-nome-erro`" class="campo__erro" role="alert">
              {{ erroDoNome }}
            </small>
          </div>

          <div class="campo">
            <label :for="`${idCampo}-telefone`">
              {{ t('hotel.quemBusca.telefone') }}
              <span class="campo__obrigatorio" aria-hidden="true">*</span>
            </label>
            <InputText
              :id="`${idCampo}-telefone`"
              v-model="rascunho.telefone"
              inputmode="tel"
              autocomplete="off"
              aria-required="true"
              placeholder="(11) 98765-4321"
              :invalid="Boolean(erroDoTelefone)"
              :aria-describedby="erroDoTelefone ? `${idCampo}-telefone-erro` : undefined"
              fluid
              @keyup.enter="adicionar"
            />
            <small
              v-if="erroDoTelefone"
              :id="`${idCampo}-telefone-erro`"
              class="campo__erro"
              role="alert"
            >
              {{ erroDoTelefone }}
            </small>
          </div>

          <div class="campo">
            <label :for="`${idCampo}-relacao`">{{ t('hotel.quemBusca.relacao') }}</label>
            <InputText
              :id="`${idCampo}-relacao`"
              v-model="rascunho.relacao"
              autocomplete="off"
              :placeholder="t('hotel.quemBusca.relacaoDica')"
              fluid
              @keyup.enter="adicionar"
            />
          </div>

          <div class="campo">
            <label :for="`${idCampo}-documento`">{{ t('hotel.quemBusca.documento') }}</label>
            <InputText
              :id="`${idCampo}-documento`"
              v-model="rascunho.documento"
              autocomplete="off"
              :placeholder="t('hotel.quemBusca.documentoDica')"
              fluid
              @keyup.enter="adicionar"
            />
          </div>
        </div>

        <div class="nova__acoes">
          <!-- A trava de fora tem um motivo, e ele fica escrito ao lado dos dois botões que a soltam. -->
          <small v-if="pendente" class="nova__lembrete">
            <i class="ph ph-info" aria-hidden="true" />
            {{ t('hotel.quemBusca.pendente') }}
          </small>

          <Button
            :label="t('hotel.comum.cancelar')"
            severity="secondary"
            outlined
            @click="fecharCadastro"
          />
          <Button :label="t('hotel.quemBusca.adicionar')" icon="ph ph-check" @click="adicionar" />
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.quem {
  display: grid;
  gap: var(--clinic-space-2);
  justify-items: start;
}

.quem__lista {
  display: grid;
  width: 100%;
  margin: 0;
  padding: 0;
  list-style: none;
}

/*
 * Uma linha por pessoa, separadas por fio — e não um cartão por pessoa. Cartão com a mesma borda,
 * o mesmo raio e o mesmo fundo em cada linha achata a lista, e o responsável deixaria de se
 * distinguir de quem só foi autorizado.
 */
.pessoa {
  display: flex;
  align-items: center;
  gap: var(--clinic-space-3);
  border-top: 1px solid var(--clinic-line-soft);
}

.pessoa:first-child {
  border-top: none;
}

/* O cadeado ocupa a mesma coluna da caixa, para os nomes alinharem. */
.pessoa__marca {
  display: inline-grid;
  width: 1.25rem;
  place-items: center;
  color: var(--clinic-faint);
  font-size: 0.85rem;
}

.pessoa__texto {
  display: grid;
  flex: 1;
  min-width: 0;
  min-height: 2.75rem;
  align-content: center;
  gap: 0.05rem;
  padding-block: 0.35rem;
}

/* A linha inteira é o alvo do toque: no tablet, mirar a caixa de 20 px é errar a caixa. */
.pessoa__texto--toque {
  cursor: pointer;
}

.pessoa__nome {
  color: var(--clinic-text);
  font-size: var(--clinic-font-body);
  font-weight: 600;
}

.pessoa__detalhe {
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
  overflow-wrap: anywhere;
}

.quem__vazio {
  margin: 0;
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
}

.nova {
  display: grid;
  width: 100%;
  gap: var(--clinic-space-3);
  padding: var(--clinic-space-3);
  border: 1px solid var(--clinic-line-soft);
  border-radius: var(--clinic-radius-control);
}

.nova__titulo {
  margin: 0;
  color: var(--clinic-text);
  font-size: var(--clinic-font-body);
  font-weight: 650;
}

/*
 * Dois por dois: nome ao lado do telefone (o par que se dita junto), relação ao lado do documento.
 * Com colunas automáticas, a largura do diálogo deixava o documento sozinho numa linha.
 */
.nova__grade {
  display: grid;
  gap: var(--clinic-space-3);
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

@media (max-width: 560px) {
  .nova__grade {
    grid-template-columns: minmax(0, 1fr);
  }
}

.campo {
  display: grid;
  /* Linhas no topo: sem isto, o campo ao lado de um com erro desce e a fileira sai torta. */
  align-content: start;
  gap: 0.25rem;
}

/*
 * Filho direto, e não descendente: o componente mora dentro do `.campo` (e do `.nova`) da reserva,
 * e um seletor de descendente pegava também o rótulo de cada pessoa da lista e a deixava em negrito.
 */
.campo > label {
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
  font-weight: 700;
}

.campo__obrigatorio {
  color: var(--clinic-risk-text);
}

.campo__erro {
  color: var(--clinic-risk-text);
  font-size: var(--clinic-font-label);
  font-weight: 650;
  line-height: 1.4;
}

.nova__acoes {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: var(--clinic-space-2);
}

.nova__lembrete {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  margin-inline-end: auto;
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
}

/*
 * Movimento só para dizer o que mudou: o formulário que abre e a pessoa que entra na lista.
 * Curto, e nenhum na primeira pintura — a lista que já existia não "chega". Fechar não anima: o
 * botão de cadastrar volta no mesmo instante, e os dois se sobreporiam durante a saída.
 */
.quem-abre-enter-active,
.quem-linha-enter-active {
  transition:
    opacity 160ms ease-out,
    transform 160ms ease-out;
}

.quem-abre-enter-from,
.quem-linha-enter-from {
  opacity: 0;
  transform: translateY(-4px);
}

@media (prefers-reduced-motion: reduce) {
  .quem-abre-enter-active,
  .quem-linha-enter-active {
    transition: none;
  }
}
</style>
