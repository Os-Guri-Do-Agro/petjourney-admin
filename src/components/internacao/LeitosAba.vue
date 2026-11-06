<script setup lang="ts">
/**
 * Leitos da internação (E5-01, guia e5 2): na Configuração, ao lado das salas, porque o leito mora
 * numa sala de internação. O DONO e o GESTOR cadastram; a enfermagem e o veterinário também
 * desativam (o leito em manutenção sai da conta de vagas na hora).
 *
 * A API decide tudo: o nome sugerido de cada tipo, se pode apagar (só o que nunca recebeu
 * paciente; o resto se desativa) e o que recusa (ocupado, nome em uso, sala que não é de
 * internação). A tela só mostra o motivo.
 */
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Skeleton from 'primevue/skeleton'
import Textarea from 'primevue/textarea'
import { useToast } from 'primevue/usetoast'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { criarChaveadorDeIdempotencia } from '@/service/idempotencia'
import { listarSalas, type Sala } from '@/service/parceiro/agenda-config-service'
import {
  apagarLeito,
  criarLeito,
  desativarLeito,
  DETALHE_DO_LEITO_MAX,
  editarLeito,
  KINDS_DO_LEITO,
  listarLeitos,
  MOTIVOS_DO_LEITO_INATIVO,
  NOME_DO_LEITO_MAX,
  reativarLeito,
  type KindDoLeito,
  type Leito,
  type ListaDeLeitos,
  type MotivoDoLeitoInativo,
} from '@/service/parceiro/internacao-service'

import { ICONE_DO_KIND } from './rotulos-da-internacao'

const props = defineProps<{
  /** Cadastrar, editar, reativar e apagar: `estabelecimento.editar`. */
  podeEditar: boolean
  /** Desativar: também `internacao.executar`. */
  podeDesativar: boolean
}>()

const { t } = useI18n()
const toast = useToast()
const { parceiroQuery } = useParceiroPortal()
const chaveador = criarChaveadorDeIdempotencia()

const lista = ref<ListaDeLeitos | null>(null)
const salas = ref<Sala[]>([])
const carregando = ref(true)
const erro = ref('')

async function carregar() {
  carregando.value = true
  erro.value = ''
  try {
    const [leitos, todasAsSalas] = await Promise.all([
      listarLeitos(parceiroQuery()),
      listarSalas({ ...parceiroQuery(), ativas: true }),
    ])
    lista.value = leitos
    salas.value = todasAsSalas.filter((sala) => sala.tipo === 'INTERNACAO' && sala.ativa)
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('internacao.leitos.erroAoCarregar')).mensagem
  } finally {
    carregando.value = false
  }
}

onMounted(() => void carregar())

const leitos = computed(() => lista.value?.itens ?? [])
const ativos = computed(() => leitos.value.filter((leito) => leito.ativo))
const inativos = computed(() => leitos.value.filter((leito) => !leito.ativo))
const noLimite = computed(() => Boolean(lista.value && leitos.value.length >= lista.value.limite))

function meta(leito: Leito) {
  const partes = [t(`internacao.kind.${leito.kind}`), leito.salaNome]
  if (!leito.ativo && leito.motivoInativo) {
    partes.push(
      leito.motivoInativo === 'OUTRO' && leito.detalheInativo
        ? leito.detalheInativo
        : t(`internacao.leitos.motivo.${leito.motivoInativo}`),
    )
  } else if (leito.ocupado) {
    partes.push(t('internacao.leitos.ocupado'))
  }
  return partes.join(' · ')
}

function avisar(err: unknown) {
  toast.add({
    severity: 'error',
    summary: lerErroDoCadastro(err, t('cadastro.erros.salvar')).mensagem,
    life: 6000,
  })
}

/* --------------------------------------------------------------------- criar e editar */

const aberta = ref(false)
const emEdicao = ref<Leito | null>(null)
const nome = ref('')
const kind = ref<KindDoLeito>('GERAL')
const salaId = ref<string | null>(null)
const tentou = ref(false)
const erroNoNome = ref('')
const erroDoForm = ref('')
const salvando = ref(false)

const opcoesDeKind = computed(() =>
  KINDS_DO_LEITO.map((valor) => ({ valor, rotulo: t(`internacao.kind.${valor}`) })),
)
const opcoesDeSala = computed(() =>
  salas.value.map((sala) => ({ valor: sala.id, rotulo: sala.nome })),
)

function abrir(leito: Leito | null) {
  emEdicao.value = leito
  kind.value = leito?.kind ?? 'GERAL'
  nome.value = leito?.nome ?? lista.value?.nomeSugerido.GERAL ?? ''
  salaId.value = leito?.salaId ?? salas.value[0]?.id ?? null
  tentou.value = false
  erroNoNome.value = ''
  erroDoForm.value = ''
  aberta.value = true
}

/* No leito novo, trocar o tipo troca o nome sugerido, enquanto a pessoa não escreveu outro. */
watch(kind, (agora, antes) => {
  if (emEdicao.value || !lista.value) return
  if (nome.value.trim() === '' || nome.value === lista.value.nomeSugerido[antes]) {
    nome.value = lista.value.nomeSugerido[agora]
  }
})

const nomeValido = computed(() => nome.value.trim().length > 0)

async function salvar() {
  tentou.value = true
  erroNoNome.value = ''
  erroDoForm.value = ''
  if (!nomeValido.value || !salaId.value) return

  salvando.value = true
  const corpo = { nome: nome.value.trim(), kind: kind.value, salaId: salaId.value }
  try {
    if (emEdicao.value) {
      await editarLeito(emEdicao.value.id, corpo, parceiroQuery())
    } else {
      await criarLeito(corpo, chaveador.para(corpo), parceiroQuery())
      chaveador.concluir()
    }
    aberta.value = false
    await carregar()
  } catch (err) {
    const lido = lerErroDoCadastro(err, t('cadastro.erros.salvar'))
    if (lido.codigo === 'LEITO_NOME_EM_USO') erroNoNome.value = lido.mensagem
    else erroDoForm.value = lido.mensagem
  } finally {
    salvando.value = false
  }
}

/* --------------------------------------------------------------------------- desativar */

const desativarAberta = ref(false)
const paraDesativar = ref<Leito | null>(null)
const motivo = ref<MotivoDoLeitoInativo>('MANUTENCAO')
const detalhe = ref('')
const erroDoDesativar = ref('')

const opcoesDeMotivo = computed(() =>
  MOTIVOS_DO_LEITO_INATIVO.map((valor) => ({
    valor,
    rotulo: t(`internacao.leitos.motivo.${valor}`),
  })),
)

function abrirDesativar(leito: Leito) {
  paraDesativar.value = leito
  motivo.value = 'MANUTENCAO'
  detalhe.value = ''
  tentou.value = false
  erroDoDesativar.value = ''
  desativarAberta.value = true
}

const detalheValido = computed(() => motivo.value !== 'OUTRO' || detalhe.value.trim().length > 0)

async function desativar() {
  tentou.value = true
  erroDoDesativar.value = ''
  if (!paraDesativar.value || !detalheValido.value) return
  salvando.value = true
  try {
    await desativarLeito(
      paraDesativar.value.id,
      {
        motivo: motivo.value,
        ...(detalhe.value.trim() ? { detalhe: detalhe.value.trim() } : {}),
      },
      parceiroQuery(),
    )
    desativarAberta.value = false
    await carregar()
  } catch (err) {
    erroDoDesativar.value = lerErroDoCadastro(err, t('cadastro.erros.salvar')).mensagem
  } finally {
    salvando.value = false
  }
}

/* --------------------------------------------------------------------- reativar, apagar */

const mexendo = ref<string | null>(null)

async function reativar(leito: Leito) {
  mexendo.value = leito.id
  try {
    await reativarLeito(leito.id, parceiroQuery())
    await carregar()
  } catch (err) {
    avisar(err)
  } finally {
    mexendo.value = null
  }
}

async function apagar(leito: Leito) {
  mexendo.value = leito.id
  try {
    await apagarLeito(leito.id, parceiroQuery())
    toast.add({ severity: 'success', summary: t('internacao.leitos.apagado'), life: 3000 })
    await carregar()
  } catch (err) {
    avisar(err)
    await carregar()
  } finally {
    mexendo.value = null
  }
}
</script>

<template>
  <section class="ui-folha ui-cartao la" aria-labelledby="leitos-titulo">
    <header class="ui-cartao__cabeca">
      <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-bed" /></span>
      <span class="ui-cartao__titulos">
        <h2 id="leitos-titulo" class="ui-cartao__titulo">{{ t('internacao.leitos.titulo') }}</h2>
        <p class="ui-cartao__descricao">{{ t('internacao.leitos.descricao') }}</p>
      </span>
      <Button
        v-if="props.podeEditar && salas.length && !noLimite"
        type="button"
        size="small"
        icon="ph ph-plus"
        :label="t('internacao.leitos.novo')"
        @click="abrir(null)"
      />
    </header>

    <p v-if="erro" class="eg__erro la__nota" role="alert">
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

    <ul v-if="carregando && !lista" class="ui-lista" aria-busy="true">
      <li v-for="n in 3" :key="n" class="ui-linha">
        <Skeleton width="12rem" height="1rem" />
      </li>
    </ul>

    <template v-else-if="lista">
      <p v-if="!salas.length && props.podeEditar" class="eg__aviso la__nota">
        <i class="ph ph-info" aria-hidden="true" />
        <span>
          {{ t('internacao.leitos.semSala') }}
          <RouterLink :to="{ path: '/clinica/configuracao', query: {} }">{{
            t('internacao.leitos.irParaSalas')
          }}</RouterLink>
        </span>
      </p>
      <p v-if="noLimite" class="eg__dica la__nota">
        {{ t('internacao.leitos.noLimite', { limite: lista.limite }) }}
      </p>

      <p v-if="!leitos.length" class="la__vazio">{{ t('internacao.leitos.vazio') }}</p>

      <ul v-if="ativos.length" class="ui-lista">
        <li v-for="leito in ativos" :key="leito.id" class="ui-linha">
          <span class="ui-ladrilho ui-ladrilho--p" aria-hidden="true">
            <i :class="ICONE_DO_KIND[leito.kind]" />
          </span>
          <span class="ui-linha__texto">
            <strong class="ui-linha__titulo">{{ leito.nome }}</strong>
            <span class="ui-linha__meta">{{ meta(leito) }}</span>
          </span>
          <span v-if="props.podeEditar || props.podeDesativar" class="ui-linha__fim la__acoes">
            <Button
              v-if="props.podeEditar"
              type="button"
              size="small"
              severity="secondary"
              outlined
              icon="ph ph-pencil-simple"
              :aria-label="t('internacao.leitos.editarDe', { nome: leito.nome })"
              @click="abrir(leito)"
            />
            <Button
              v-if="props.podeEditar && leito.podeApagar"
              type="button"
              size="small"
              severity="secondary"
              outlined
              icon="ph ph-trash"
              :aria-label="t('internacao.leitos.apagarDe', { nome: leito.nome })"
              :loading="mexendo === leito.id"
              @click="apagar(leito)"
            />
            <Button
              v-if="props.podeDesativar"
              type="button"
              size="small"
              severity="secondary"
              outlined
              :label="t('internacao.leitos.desativar')"
              :disabled="leito.ocupado"
              :title="leito.ocupado ? t('internacao.leitos.ocupadoNaoDesativa') : undefined"
              @click="abrirDesativar(leito)"
            />
          </span>
        </li>
      </ul>

      <template v-if="inativos.length">
        <h3 class="eg__grupo-titulo la__subtitulo">{{ t('internacao.leitos.inativos') }}</h3>
        <ul class="ui-lista la__inativos">
          <li v-for="leito in inativos" :key="leito.id" class="ui-linha">
            <span class="ui-ladrilho ui-ladrilho--p" aria-hidden="true">
              <i :class="ICONE_DO_KIND[leito.kind]" />
            </span>
            <span class="ui-linha__texto">
              <strong class="ui-linha__titulo">{{ leito.nome }}</strong>
              <span class="ui-linha__meta">{{ meta(leito) }}</span>
            </span>
            <span v-if="props.podeEditar" class="ui-linha__fim la__acoes">
              <Button
                v-if="leito.podeApagar"
                type="button"
                size="small"
                severity="secondary"
                outlined
                icon="ph ph-trash"
                :aria-label="t('internacao.leitos.apagarDe', { nome: leito.nome })"
                :disabled="mexendo !== null"
                @click="apagar(leito)"
              />
              <Button
                type="button"
                size="small"
                severity="secondary"
                outlined
                icon="ph ph-arrow-counter-clockwise"
                :label="t('agenda.config.reativar')"
                :loading="mexendo === leito.id"
                @click="reativar(leito)"
              />
            </span>
          </li>
        </ul>
      </template>
    </template>

    <!-- Criar e editar -->
    <CadastroGaveta
      v-model:visible="aberta"
      :titulo="emEdicao ? t('internacao.leitos.editar') : t('internacao.leitos.novo')"
      icone="ph ph-bed"
    >
      <form id="leito-form" class="eg" novalidate @submit.prevent="salvar">
        <p v-if="emEdicao?.ocupado" class="eg__aviso">
          <i class="ph ph-info" aria-hidden="true" />
          <span>{{ t('internacao.leitos.ocupadoSoNome') }}</span>
        </p>
        <section class="eg__secao">
          <label class="eg__rotulo" for="leito-kind">{{ t('internacao.leitos.tipo') }}</label>
          <Select
            v-model="kind"
            input-id="leito-kind"
            :options="opcoesDeKind"
            option-label="rotulo"
            option-value="valor"
            :disabled="salvando || Boolean(emEdicao?.ocupado)"
          />
        </section>
        <section class="eg__secao">
          <label class="eg__rotulo" for="leito-nome">{{ t('internacao.leitos.nome') }}</label>
          <InputText
            id="leito-nome"
            v-model="nome"
            :maxlength="NOME_DO_LEITO_MAX"
            :invalid="(tentou && !nomeValido) || Boolean(erroNoNome)"
            :disabled="salvando"
          />
          <small v-if="erroNoNome" class="eg__invalido">{{ erroNoNome }}</small>
          <small v-else class="eg__dica">{{ t('internacao.leitos.nomeDica') }}</small>
        </section>
        <section class="eg__secao">
          <label class="eg__rotulo" for="leito-sala">{{ t('internacao.leitos.sala') }}</label>
          <Select
            v-model="salaId"
            input-id="leito-sala"
            :options="opcoesDeSala"
            option-label="rotulo"
            option-value="valor"
            :invalid="tentou && !salaId"
            :disabled="salvando || Boolean(emEdicao?.ocupado)"
          />
        </section>
        <p v-if="erroDoForm" class="eg__erro" role="alert">
          <i class="ph ph-warning-circle" aria-hidden="true" />
          <span>{{ erroDoForm }}</span>
        </p>
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
          form="leito-form"
          icon="ph ph-check"
          :label="t('cadastro.salvar')"
          :loading="salvando"
        />
      </template>
    </CadastroGaveta>

    <!-- Desativar -->
    <CadastroGaveta
      v-model:visible="desativarAberta"
      :titulo="t('internacao.leitos.desativarTitulo', { nome: paraDesativar?.nome ?? '' })"
      icone="ph ph-prohibit"
    >
      <form id="leito-desativar" class="eg" novalidate @submit.prevent="desativar">
        <p class="eg__dica">{{ t('internacao.leitos.desativarDica') }}</p>
        <section class="eg__secao">
          <label class="eg__rotulo" for="leito-motivo">{{ t('internacao.leitos.porque') }}</label>
          <Select
            v-model="motivo"
            input-id="leito-motivo"
            :options="opcoesDeMotivo"
            option-label="rotulo"
            option-value="valor"
            :disabled="salvando"
          />
        </section>
        <section class="eg__secao">
          <label class="eg__rotulo" for="leito-detalhe">
            {{ t('internacao.leitos.detalhe') }}
            <span v-if="motivo !== 'OUTRO'" class="eg__opcional">{{ t('cadastro.opcional') }}</span>
          </label>
          <Textarea
            id="leito-detalhe"
            v-model="detalhe"
            rows="2"
            auto-resize
            :maxlength="DETALHE_DO_LEITO_MAX"
            :invalid="tentou && !detalheValido"
            :disabled="salvando"
          />
        </section>
        <p v-if="erroDoDesativar" class="eg__erro" role="alert">
          <i class="ph ph-warning-circle" aria-hidden="true" />
          <span>{{ erroDoDesativar }}</span>
        </p>
      </form>
      <template #pe>
        <Button
          type="button"
          :label="t('cadastro.cancelar')"
          severity="secondary"
          outlined
          :disabled="salvando"
          @click="desativarAberta = false"
        />
        <Button
          type="submit"
          form="leito-desativar"
          icon="ph ph-prohibit"
          :label="t('internacao.leitos.desativar')"
          :loading="salvando"
        />
      </template>
    </CadastroGaveta>
  </section>
</template>

<style scoped>
.la {
  display: grid;
  gap: 14px;
}

.la__nota {
  padding: 0 24px;
}

.la__acoes {
  display: inline-flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
}

.la__vazio {
  margin: 0;
  padding: 0 24px 8px;
  color: var(--tinta-2);
  font-size: 14px;
}

.la__subtitulo {
  margin: 6px 0 0;
  padding: 0 24px;
}

.la__inativos {
  opacity: 0.8;
}
</style>
