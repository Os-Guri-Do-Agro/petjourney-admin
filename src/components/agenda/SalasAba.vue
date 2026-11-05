<script setup lang="ts">
/**
 * Salas da clínica (E3-01, seção 1.2): criar, renomear, trocar o tipo, reordenar e desativar ou
 * reativar. Sala não se apaga, porque a agenda guarda o id dela; desativar também a tira de "sala
 * padrão" de quem a tinha. Reordenar é um `PATCH` com a `ordem` de cada uma das duas que trocam.
 */
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Skeleton from 'primevue/skeleton'
import { useToast } from 'primevue/usetoast'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { criarChaveadorDeIdempotencia } from '@/service/idempotencia'
import {
  criarSala,
  editarSala,
  listarSalas,
  NOME_DA_SALA_MAX,
  NOME_DA_SALA_MIN,
  TIPOS_DE_SALA,
  type Sala,
  type TipoDeSala,
} from '@/service/parceiro/agenda-config-service'

const props = defineProps<{ podeEditar: boolean }>()

const { t } = useI18n()
const toast = useToast()
const { parceiroQuery } = useParceiroPortal()
const chaveador = criarChaveadorDeIdempotencia()

const salas = ref<Sala[]>([])
const carregando = ref(true)
const erro = ref('')

async function carregar() {
  carregando.value = true
  erro.value = ''

  try {
    salas.value = await listarSalas(parceiroQuery())
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('agenda.config.erroAoCarregar')).mensagem
  } finally {
    carregando.value = false
  }
}

onMounted(() => void carregar())

const ativas = computed(() => salas.value.filter((sala) => sala.ativa))
const inativas = computed(() => salas.value.filter((sala) => !sala.ativa))

function avisarErro(err: unknown) {
  toast.add({
    severity: 'error',
    summary: lerErroDoCadastro(err, t('cadastro.erros.salvar')).mensagem,
    life: 6000,
  })
}

/* ----------------------------------------------------------------------------- a gaveta */

const aberta = ref(false)
const emEdicao = ref<Sala | null>(null)
const nome = ref('')
const tipo = ref<TipoDeSala>('CONSULTORIO')
const tentou = ref(false)
const erroNoNome = ref('')
const salvando = ref(false)

const opcoesDeTipo = computed(() =>
  TIPOS_DE_SALA.map((valor) => ({ valor, rotulo: t(`agenda.config.sala.tipo.${valor}`) })),
)

function abrir(sala: Sala | null) {
  emEdicao.value = sala
  nome.value = sala?.nome ?? ''
  tipo.value = sala?.tipo ?? 'CONSULTORIO'
  tentou.value = false
  erroNoNome.value = ''
  aberta.value = true
}

const nomeValido = computed(() => {
  const tamanho = nome.value.trim().length
  return tamanho >= NOME_DA_SALA_MIN && tamanho <= NOME_DA_SALA_MAX
})

async function salvar() {
  tentou.value = true
  erroNoNome.value = ''
  if (!nomeValido.value) return

  salvando.value = true
  const corpo = { nome: nome.value.trim(), tipo: tipo.value }

  try {
    if (emEdicao.value) {
      await editarSala(emEdicao.value.id, corpo, parceiroQuery())
    } else {
      await criarSala(corpo, chaveador.para(corpo), parceiroQuery())
      chaveador.concluir()
    }

    aberta.value = false
    await carregar()
  } catch (err) {
    const lido = lerErroDoCadastro(err, t('cadastro.erros.salvar'))
    if (lido.codigo === 'SALA_NOME_EM_USO') erroNoNome.value = t('agenda.config.sala.nomeEmUso')
    else avisarErro(err)
  } finally {
    salvando.value = false
  }
}

/* ---------------------------------------------------------------- ativar e reordenar */

const mexendo = ref<string | null>(null)

async function alternar(sala: Sala) {
  mexendo.value = sala.id

  try {
    await editarSala(sala.id, { ativa: !sala.ativa }, parceiroQuery())
    await carregar()
  } catch (err) {
    const lido = lerErroDoCadastro(err, t('cadastro.erros.salvar'))
    toast.add({
      severity: 'error',
      summary:
        lido.codigo === 'SALA_NOME_EM_USO' ? t('agenda.config.sala.nomeEmUso') : lido.mensagem,
      life: 6000,
    })
  } finally {
    mexendo.value = null
  }
}

/** Troca a ordem com a vizinha: dois `PATCH`, um por sala. */
async function mover(indice: number, passo: -1 | 1) {
  const lista = ativas.value
  const atual = lista[indice]
  const vizinha = lista[indice + passo]
  if (!atual || !vizinha) return

  mexendo.value = atual.id

  try {
    await editarSala(atual.id, { ordem: vizinha.ordem }, parceiroQuery())
    await editarSala(vizinha.id, { ordem: atual.ordem }, parceiroQuery())
    await carregar()
  } catch (err) {
    avisarErro(err)
    await carregar()
  } finally {
    mexendo.value = null
  }
}

const ICONE_DA_SALA: Record<TipoDeSala, string> = {
  CONSULTORIO: 'ph ph-stethoscope',
  CIRURGIA: 'ph ph-first-aid',
  BANHO: 'ph ph-shower',
  INTERNACAO: 'ph ph-bed',
  EXAME: 'ph ph-microscope',
}
</script>

<template>
  <section class="ui-folha ui-cartao cfa" aria-labelledby="salas-titulo">
    <header class="ui-cartao__cabeca">
      <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-door" /></span>
      <span class="ui-cartao__titulos">
        <h2 id="salas-titulo" class="ui-cartao__titulo">{{ t('agenda.config.sala.titulo') }}</h2>
        <p class="ui-cartao__descricao">{{ t('agenda.config.sala.descricao') }}</p>
      </span>
      <Button
        v-if="props.podeEditar"
        type="button"
        size="small"
        icon="ph ph-plus"
        :label="t('agenda.config.sala.nova')"
        @click="abrir(null)"
      />
    </header>

    <p v-if="erro" class="eg__erro" role="alert">
      <i class="ph ph-warning-circle" aria-hidden="true" />
      <span>{{ erro }}</span>
      <Button
        type="button"
        size="small"
        severity="secondary"
        outlined
        :label="t('cadastro.tentarDeNovo')"
        @click="carregar"
      />
    </p>

    <ul v-if="carregando && !salas.length" class="ui-lista" aria-busy="true">
      <li v-for="n in 3" :key="n" class="ui-linha">
        <Skeleton width="12rem" height="1rem" />
      </li>
    </ul>

    <p v-else-if="!salas.length" class="cfa__vazio">{{ t('agenda.config.sala.vazio') }}</p>

    <template v-else>
      <ul class="ui-lista">
        <li v-for="(sala, indice) in ativas" :key="sala.id" class="ui-linha">
          <span class="ui-ladrilho ui-ladrilho--p" aria-hidden="true">
            <i :class="ICONE_DA_SALA[sala.tipo]" />
          </span>
          <span class="ui-linha__texto">
            <strong class="ui-linha__titulo">{{ sala.nome }}</strong>
            <span class="ui-linha__meta">{{ t(`agenda.config.sala.tipo.${sala.tipo}`) }}</span>
          </span>
          <span v-if="props.podeEditar" class="ui-linha__fim cfa__acoes">
            <Button
              type="button"
              size="small"
              severity="secondary"
              outlined
              icon="ph ph-arrow-up"
              :aria-label="t('agenda.config.subir', { nome: sala.nome })"
              :disabled="indice === 0 || mexendo !== null"
              @click="mover(indice, -1)"
            />
            <Button
              type="button"
              size="small"
              severity="secondary"
              outlined
              icon="ph ph-arrow-down"
              :aria-label="t('agenda.config.descer', { nome: sala.nome })"
              :disabled="indice === ativas.length - 1 || mexendo !== null"
              @click="mover(indice, 1)"
            />
            <Button
              type="button"
              size="small"
              severity="secondary"
              outlined
              icon="ph ph-pencil-simple"
              :aria-label="t('agenda.config.editarDe', { nome: sala.nome })"
              @click="abrir(sala)"
            />
            <Button
              type="button"
              size="small"
              severity="secondary"
              outlined
              :label="t('agenda.config.desativar')"
              :loading="mexendo === sala.id"
              @click="alternar(sala)"
            />
          </span>
        </li>
      </ul>

      <template v-if="inativas.length">
        <h3 class="eg__grupo-titulo cfa__subtitulo">{{ t('agenda.config.inativas') }}</h3>
        <ul class="ui-lista cfa__inativas">
          <li v-for="sala in inativas" :key="sala.id" class="ui-linha">
            <span class="ui-linha__texto">
              <strong class="ui-linha__titulo">{{ sala.nome }}</strong>
              <span class="ui-linha__meta">{{ t(`agenda.config.sala.tipo.${sala.tipo}`) }}</span>
            </span>
            <span v-if="props.podeEditar" class="ui-linha__fim">
              <Button
                type="button"
                size="small"
                severity="secondary"
                outlined
                icon="ph ph-arrow-counter-clockwise"
                :label="t('agenda.config.reativar')"
                :loading="mexendo === sala.id"
                @click="alternar(sala)"
              />
            </span>
          </li>
        </ul>
      </template>
    </template>

    <CadastroGaveta
      v-model:visible="aberta"
      :titulo="emEdicao ? t('agenda.config.sala.editar') : t('agenda.config.sala.nova')"
      icone="ph ph-door"
    >
      <form id="sala-form" class="eg" novalidate @submit.prevent="salvar">
        <section class="eg__secao">
          <label class="eg__rotulo" for="sala-nome">{{ t('agenda.config.sala.nome') }}</label>
          <InputText
            id="sala-nome"
            v-model="nome"
            :maxlength="NOME_DA_SALA_MAX"
            :placeholder="t('agenda.config.sala.nomeExemplo')"
            :invalid="(tentou && !nomeValido) || Boolean(erroNoNome)"
            :disabled="salvando"
          />
          <small v-if="erroNoNome" class="eg__invalido">{{ erroNoNome }}</small>
          <small v-else-if="tentou && !nomeValido" class="eg__invalido">
            {{
              t('agenda.config.sala.nomeTamanho', { min: NOME_DA_SALA_MIN, max: NOME_DA_SALA_MAX })
            }}
          </small>
        </section>
        <section class="eg__secao">
          <label class="eg__rotulo" for="sala-tipo">{{ t('agenda.config.sala.tipoRotulo') }}</label>
          <Select
            v-model="tipo"
            input-id="sala-tipo"
            :options="opcoesDeTipo"
            option-label="rotulo"
            option-value="valor"
            :disabled="salvando"
          />
        </section>
      </form>
      <template #pe>
        <Button
          type="button"
          :label="t('cadastro.cancelar')"
          severity="secondary"
          outlined
          :disabled="salvando"
          @click="aberta = false"
        />
        <Button
          type="submit"
          form="sala-form"
          icon="ph ph-check"
          :label="t('cadastro.salvar')"
          :loading="salvando"
        />
      </template>
    </CadastroGaveta>
  </section>
</template>

<style scoped>
.cfa {
  display: grid;
  gap: 14px;
}

.cfa__acoes {
  display: inline-flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
}

.cfa__vazio {
  margin: 0;
  color: var(--tinta-2);
  font-size: 14px;
}

.cfa__subtitulo {
  margin: 6px 0 0;
}

.cfa__inativas {
  opacity: 0.8;
}
</style>
