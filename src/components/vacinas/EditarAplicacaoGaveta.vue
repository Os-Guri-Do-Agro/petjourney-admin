<script setup lang="ts">
/**
 * "Editar registro" do cartão da lista de chamada (N42, guia `pedidos-luis-17-11.md` seção 5, item
 * 6): corrige o que não muda a conta, a observação e a via, com o motivo (5 a 500). O `PATCH` leva
 * só os campos que mudaram; sem mudança, "Salvar" fica desabilitado. O responsável não é avisado.
 *
 * Vacina, dose, data e lote continuam por anular e registrar de novo: o botão do pé da gaveta leva
 * à anulação para corrigir (`corrigir`), que depois abre a ficha com a gaveta de aplicar.
 *
 * Ao abrir, lê a dose no histórico do paciente (a observação e a via de agora) e as vias da vacina
 * no catálogo da clínica.
 */
import Button from 'primevue/button'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import { useToast } from 'primevue/usetoast'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useRotulosDoCadastro } from '@/components/cadastro/useRotulosDoCadastro'
import UiLinhasCarregando from '@/components/ui/UiLinhasCarregando.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { ApiError } from '@/service/api'
import { lerPacote } from '@/service/parceiro/catalogos-service'
import {
  corpoDaEdicao,
  editarAplicacao,
  lerHistorico,
  MOTIVO_DA_EDICAO_MAX,
  MOTIVO_DA_EDICAO_MIN,
  OBSERVACAO_MAX,
  type Aplicacao,
  type Chamada,
  type ViaDaVacina,
} from '@/service/parceiro/vacinacao-service'

const props = defineProps<{ item: Chamada | null }>()
const aberta = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{ corrigir: []; mudou: [] }>()

const { t } = useI18n()
const toast = useToast()
const rotulos = useRotulosDoCadastro()
const { parceiroQuery } = useParceiroPortal()

const aplicacao = ref<Aplicacao | null>(null)
const vias = ref<ViaDaVacina[]>([])
const carregando = ref(false)
const erroAoLer = ref('')

const observacao = ref('')
const via = ref<ViaDaVacina | null>(null)
const motivo = ref('')
const tentou = ref(false)
const salvando = ref(false)
const erro = ref('')
/** A dose foi anulada ou mudou de ficha enquanto a gaveta estava aberta: só fechar. */
const encerrada = ref(false)

async function carregar() {
  const item = props.item
  if (!item) return
  carregando.value = true
  erroAoLer.value = ''
  aplicacao.value = null
  vias.value = []
  try {
    const [historico, pacote] = await Promise.all([
      lerHistorico(item.paciente.id, parceiroQuery()),
      lerPacote(parceiroQuery()),
    ])
    const lida = historico.itens.find((a) => a.id === item.aplicacaoId) ?? null
    if (!lida || lida.anulada) {
      erroAoLer.value = lida ? t('vacinas.anular.jaAnulada') : t('vacinas.erro.carregar')
      return
    }
    aplicacao.value = lida
    observacao.value = lida.observacao ?? ''
    via.value = lida.via
    vias.value = (pacote.vacinas.find((v) => v.id === item.vacina.id)?.vias ?? []) as ViaDaVacina[]
  } catch (err) {
    erroAoLer.value = lerErroDoCadastro(err, t('vacinas.erro.carregar')).mensagem
  } finally {
    carregando.value = false
  }
}

/* Com a gaveta aberta, outra dose da lista troca o conteúdo (não só o abrir). */
watch([aberta, () => props.item?.aplicacaoId] as const, ([agora]) => {
  if (!agora) return
  observacao.value = ''
  via.value = null
  motivo.value = ''
  tentou.value = false
  erro.value = ''
  encerrada.value = false
  void carregar()
})

/** As vias da vacina; a de agora entra mesmo se o catálogo mudou, para o campo não vir vazio. */
const opcoesDeVia = computed(() => {
  const lista = [...vias.value]
  const atual = aplicacao.value?.via
  if (atual && !lista.includes(atual)) lista.unshift(atual)
  return lista.map((valor) => ({ valor, rotulo: t(`clinico.bulario.api.via.${valor}`) }))
})

const corpo = computed(() =>
  aplicacao.value
    ? corpoDaEdicao(aplicacao.value, { observacao: observacao.value, via: via.value }, motivo.value)
    : null,
)
const motivoValido = computed(() => motivo.value.trim().length >= MOTIVO_DA_EDICAO_MIN)

const sobre = computed(() => {
  const item = props.item
  if (!item) return ''
  return `${item.vacina.nome} · ${t('vacinas.detalhes.doseDe', { dia: rotulos.dia(item.ultimaEm.slice(0, 10)) })}`
})

/** Os erros do guia (seção 5): anulada ou mudou de ficha relê a lista; via fora da vacina troca as opções. */
async function salvar() {
  tentou.value = true
  erro.value = ''
  if (!props.item || !corpo.value || !motivoValido.value) return
  salvando.value = true
  try {
    await editarAplicacao(props.item.aplicacaoId, corpo.value, parceiroQuery())
    toast.add({ severity: 'success', summary: t('vacinas.editar.feita'), life: 3000 })
    aberta.value = false
  } catch (err) {
    const lido = lerErroDoCadastro(err, t('cadastro.erros.salvar'))
    erro.value = lido.mensagem
    if (
      lido.codigo === 'APLICACAO_JA_ANULADA' ||
      lido.codigo === 'APLICACAO_ALTERADA' ||
      lido.codigo === 'OWNERSHIP_FORBIDDEN'
    ) {
      encerrada.value = true
      emit('mudou')
    }
    if (lido.codigo === 'VIA_INVALIDA') {
      const permitidas = err instanceof ApiError ? err.detalhes.viasPermitidas : null
      if (Array.isArray(permitidas)) {
        vias.value = permitidas as ViaDaVacina[]
        if (via.value && !vias.value.includes(via.value)) via.value = aplicacao.value?.via ?? null
      }
    }
  } finally {
    salvando.value = false
  }
}
</script>

<template>
  <CadastroGaveta
    v-model:visible="aberta"
    :titulo="t('vacinas.editar.titulo')"
    icone="ph ph-pencil-simple"
  >
    <UiLinhasCarregando v-if="carregando" :linhas="4" :rotulo="t('vacinas.detalhes.carregando')" />

    <p v-else-if="erroAoLer" class="eg__erro" role="alert">
      <i class="ph ph-warning-circle" aria-hidden="true" />
      <span>{{ erroAoLer }}</span>
    </p>

    <form
      v-else-if="aplicacao"
      id="editar-aplicacao"
      class="eg"
      novalidate
      @submit.prevent="salvar"
    >
      <p class="ea__sobre">{{ sobre }}</p>
      <p class="eg__dica">{{ t('vacinas.editar.dica') }}</p>

      <section class="eg__secao">
        <label class="eg__rotulo" for="editar-observacao">{{
          t('vacinas.aplicar.observacao')
        }}</label>
        <Textarea
          id="editar-observacao"
          v-model="observacao"
          rows="3"
          auto-resize
          :maxlength="OBSERVACAO_MAX"
          :disabled="salvando || encerrada"
        />
        <small class="eg__dica">{{ t('vacinas.editar.observacaoDica') }}</small>
      </section>

      <section class="eg__secao">
        <label class="eg__rotulo" for="editar-via">{{ t('vacinas.aplicar.via') }}</label>
        <Select
          v-model="via"
          input-id="editar-via"
          :options="opcoesDeVia"
          option-label="rotulo"
          option-value="valor"
          :disabled="salvando || encerrada"
        />
      </section>

      <section class="eg__secao">
        <label class="eg__rotulo" for="editar-motivo">{{ t('vacinas.anular.motivo') }}</label>
        <Textarea
          id="editar-motivo"
          v-model="motivo"
          rows="2"
          auto-resize
          :maxlength="MOTIVO_DA_EDICAO_MAX"
          :invalid="tentou && !motivoValido"
          :disabled="salvando || encerrada"
        />
        <small class="eg__dica">{{
          t('vacinas.anular.motivoDica', { min: MOTIVO_DA_EDICAO_MIN })
        }}</small>
      </section>

      <p v-if="erro" class="eg__erro" role="alert">
        <i class="ph ph-warning-circle" aria-hidden="true" />
        <span>{{ erro }}</span>
      </p>

      <!-- O que não se edita: anular e registrar de novo, pela gaveta que já faz isso. -->
      <section v-if="!encerrada" class="eg__secao ea__outros">
        <p class="eg__dica">{{ t('vacinas.editar.outrosCampos') }}</p>
        <Button
          type="button"
          size="small"
          severity="secondary"
          outlined
          icon="ph ph-arrow-counter-clockwise"
          :label="t('vacinas.editar.apagarERegistrar')"
          :disabled="salvando"
          @click="emit('corrigir')"
        />
      </section>
    </form>

    <template #pe>
      <!--
        Sem mudança, o Salvar fica desligado (guia, item 6): a frase ao lado diz por quê. Sem ela,
        quem escrevia só o motivo não entendia o botão apagado (26/11/2026).
      -->
      <p v-if="aplicacao && !encerrada && !corpo" id="editar-sem-mudanca" class="ea__porque">
        <i class="ph ph-info" aria-hidden="true" />
        <span>{{ t('vacinas.editar.semMudanca') }}</span>
      </p>
      <Button
        type="button"
        severity="secondary"
        outlined
        :label="encerrada || erroAoLer ? t('common.close') : t('cadastro.cancelar')"
        :disabled="salvando"
        @click="aberta = false"
      />
      <Button
        v-if="aplicacao && !encerrada"
        type="submit"
        form="editar-aplicacao"
        icon="ph ph-check"
        :label="t('cadastro.salvar')"
        :loading="salvando"
        :disabled="!corpo"
        :aria-describedby="corpo ? undefined : 'editar-sem-mudanca'"
      />
    </template>
  </CadastroGaveta>
</template>

<style scoped>
/* Qual dose: a vacina e o dia, em cima de tudo, para não corrigir a errada. */
.ea__sobre {
  margin: 0;
  color: var(--tinta);
  font-size: 15px;
  font-weight: 650;
}

.ea__outros {
  justify-items: start;
  padding-top: 12px;
  border-top: 1px solid var(--linha-suave);
}

.ea__outros .eg__dica {
  margin: 0;
}

/* Por que o Salvar está apagado: no pé, colado aos botões, empurrado para o começo da linha. */
.ea__porque {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  margin-inline-end: auto;
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.35;
}

.ea__porque i {
  flex: none;
  color: var(--atencao-tinta);
  font-size: 15px;
}
</style>
