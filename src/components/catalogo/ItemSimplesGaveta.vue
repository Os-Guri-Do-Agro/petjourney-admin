<script setup lang="ts">
/**
 * Exame ou diagnóstico da clínica: criar e editar (E4-02, guia e4 1.7). Os dois são curtos: o
 * exame tem nome e grupo; o diagnóstico, código (letras, números, ponto e hífen, até 20),
 * descrição e o sistema, se quiser.
 */
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { criarChaveadorDeIdempotencia } from '@/service/idempotencia'
import {
  criarAcrescimo,
  editarAcrescimo,
  type Diagnostico,
  type Exame,
  type NovoDiagnostico,
  type NovoExame,
} from '@/service/parceiro/catalogos-service'

const props = defineProps<{ tipo: 'exames' | 'diagnosticos'; item: Exame | Diagnostico | null }>()
const aberta = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{ salvo: [] }>()

const { t } = useI18n()
const { parceiroQuery } = useParceiroPortal()
const chaveador = criarChaveadorDeIdempotencia()

const GRUPOS = ['LABORATORIO', 'IMAGEM', 'OUTROS'] as const
const SISTEMAS = [
  'CARDIOVASCULAR',
  'RESPIRATORIO',
  'DIGESTORIO',
  'URINARIO',
  'TEGUMENTAR',
  'LOCOMOTOR',
  'NEUROLOGICO',
  'LINFONODOS',
] as const
const CODIGO = /^[A-Za-z0-9.-]{1,20}$/

const nome = ref('')
const grupo = ref<(typeof GRUPOS)[number]>('LABORATORIO')
const codigo = ref('')
const descricao = ref('')
const sistema = ref<string | null>(null)

const salvando = ref(false)
const tentou = ref(false)
const erroNoCampo = ref('')
const erroGeral = ref('')

const ehExame = computed(() => props.tipo === 'exames')

watch(aberta, (agora) => {
  if (!agora) return
  tentou.value = false
  erroNoCampo.value = ''
  erroGeral.value = ''
  const exame = ehExame.value ? (props.item as Exame | null) : null
  const diag = ehExame.value ? null : (props.item as Diagnostico | null)
  nome.value = exame?.nome ?? ''
  grupo.value = exame?.grupo ?? 'LABORATORIO'
  codigo.value = diag?.codigo ?? ''
  descricao.value = diag?.descricao ?? ''
  sistema.value = diag?.sistema ?? null
})

const opcoesDeGrupo = computed(() =>
  GRUPOS.map((valor) => ({ valor, rotulo: t(`catalogo.exame.grupo.${valor}`) })),
)
const opcoesDeSistema = computed(() => [
  { valor: null, rotulo: t('catalogo.diagnostico.semSistema') },
  ...SISTEMAS.map((valor) => ({ valor, rotulo: t(`catalogo.diagnostico.sistema.${valor}`) })),
])

const valido = computed(() =>
  ehExame.value
    ? nome.value.trim().length >= 2
    : CODIGO.test(codigo.value.trim()) && descricao.value.trim().length >= 2,
)

async function salvar() {
  tentou.value = true
  erroNoCampo.value = ''
  erroGeral.value = ''
  if (!valido.value) return
  salvando.value = true
  const dados: NovoExame | NovoDiagnostico = ehExame.value
    ? { nome: nome.value.trim(), grupo: grupo.value }
    : {
        codigo: codigo.value.trim(),
        descricao: descricao.value.trim(),
        sistema: (sistema.value as NovoDiagnostico['sistema']) ?? null,
      }
  try {
    if (props.item) {
      await editarAcrescimo(props.tipo, props.item.id, dados, parceiroQuery())
    } else {
      await criarAcrescimo(props.tipo, dados, chaveador.para(dados), parceiroQuery())
      chaveador.concluir()
    }
    aberta.value = false
    emit('salvo')
  } catch (err) {
    const lido = lerErroDoCadastro(err, t('cadastro.erros.salvar'))
    if (lido.codigo === 'CATALOGO_NOME_EM_USO') erroNoCampo.value = t('catalogo.erro.nomeEmUso')
    else if (lido.codigo === 'DIAGNOSTICO_CODIGO_EM_USO')
      erroNoCampo.value = t('catalogo.erro.codigoEmUso')
    else erroGeral.value = lido.mensagem
  } finally {
    salvando.value = false
  }
}
</script>

<template>
  <CadastroGaveta
    v-model:visible="aberta"
    :titulo="
      ehExame
        ? item
          ? t('catalogo.exame.editar')
          : t('catalogo.exame.novo')
        : item
          ? t('catalogo.diagnostico.editar')
          : t('catalogo.diagnostico.novo')
    "
    :icone="ehExame ? 'ph ph-flask' : 'ph ph-clipboard-text'"
  >
    <form id="item-simples-form" class="eg" novalidate @submit.prevent="salvar">
      <template v-if="ehExame">
        <section class="eg__secao">
          <label class="eg__rotulo" for="exame-nome">{{ t('catalogo.exame.nome') }}</label>
          <InputText
            id="exame-nome"
            v-model="nome"
            maxlength="120"
            :invalid="(tentou && nome.trim().length < 2) || Boolean(erroNoCampo)"
            :disabled="salvando"
          />
          <small v-if="erroNoCampo" class="eg__invalido">{{ erroNoCampo }}</small>
        </section>
        <section class="eg__secao">
          <label class="eg__rotulo" for="exame-grupo">{{ t('catalogo.exame.grupoRotulo') }}</label>
          <Select
            v-model="grupo"
            input-id="exame-grupo"
            :options="opcoesDeGrupo"
            option-label="rotulo"
            option-value="valor"
            :disabled="salvando"
          />
        </section>
      </template>

      <template v-else>
        <section class="eg__secao">
          <label class="eg__rotulo" for="diag-codigo">{{ t('catalogo.diagnostico.codigo') }}</label>
          <InputText
            id="diag-codigo"
            v-model="codigo"
            maxlength="20"
            :placeholder="t('catalogo.diagnostico.codigoExemplo')"
            :invalid="(tentou && !CODIGO.test(codigo.trim())) || Boolean(erroNoCampo)"
            :disabled="salvando"
          />
          <small v-if="erroNoCampo" class="eg__invalido">{{ erroNoCampo }}</small>
          <small v-else class="eg__dica">{{ t('catalogo.diagnostico.codigoDica') }}</small>
        </section>
        <section class="eg__secao">
          <label class="eg__rotulo" for="diag-descricao">{{
            t('catalogo.diagnostico.descricao')
          }}</label>
          <InputText
            id="diag-descricao"
            v-model="descricao"
            maxlength="200"
            :invalid="tentou && descricao.trim().length < 2"
            :disabled="salvando"
          />
        </section>
        <section class="eg__secao">
          <label class="eg__rotulo" for="diag-sistema">
            {{ t('catalogo.diagnostico.sistemaRotulo') }}
            <span class="eg__opcional">{{ t('cadastro.opcional') }}</span>
          </label>
          <Select
            v-model="sistema"
            input-id="diag-sistema"
            :options="opcoesDeSistema"
            option-label="rotulo"
            option-value="valor"
            :disabled="salvando"
          />
        </section>
      </template>

      <p v-if="erroGeral" class="eg__erro" role="alert">
        <i class="ph ph-warning-circle" aria-hidden="true" />
        <span>{{ erroGeral }}</span>
      </p>
    </form>

    <template #pe>
      <Button
        type="button"
        severity="secondary"
        outlined
        :label="t('cadastro.cancelar')"
        :disabled="salvando"
        @click="aberta = false"
      />
      <Button
        type="submit"
        form="item-simples-form"
        icon="ph ph-check"
        :label="t('cadastro.salvar')"
        :loading="salvando"
      />
    </template>
  </CadastroGaveta>
</template>
