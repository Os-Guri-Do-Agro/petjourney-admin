<script setup lang="ts">
/**
 * "Ver detalhes" do cartão da lista de chamada (pedido do Luís, 17/11/2026): por vacina do cartão,
 * tudo o que a lista não mostra da última dose (quem aplicou, lote e validade, via, se foi para o
 * app, a observação) e as doses de antes, sem sair da lista. A ficha fica a um clique, no pé.
 *
 * Lê o histórico do paciente ao abrir (`paciente.ler`). A dose da lista é a `aplicacaoId`; se o
 * histórico não a trouxer (cortado em 300), a vacina mostra só o que a lista já sabe.
 */
import Button from 'primevue/button'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useRotulosDoCadastro } from '@/components/cadastro/useRotulosDoCadastro'
import UiLinhasCarregando from '@/components/ui/UiLinhasCarregando.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { lerHistorico, type Aplicacao, type Chamada } from '@/service/parceiro/vacinacao-service'

const props = defineProps<{ paciente: Chamada['paciente'] | null; itens: Chamada[] }>()
const aberta = defineModel<boolean>('visible', { default: false })

const { t, locale } = useI18n()
const rotulos = useRotulosDoCadastro()
const { parceiroQuery } = useParceiroPortal()

const historico = ref<Aplicacao[]>([])
const carregando = ref(false)
const erro = ref('')

async function carregar() {
  if (!props.paciente) return
  carregando.value = true
  erro.value = ''
  historico.value = []
  try {
    historico.value = (await lerHistorico(props.paciente.id, parceiroQuery())).itens
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('vacinas.erro.carregar')).mensagem
  } finally {
    carregando.value = false
  }
}

/* Com a gaveta aberta, outro cartão da lista troca o conteúdo (não só o abrir). */
watch([aberta, () => props.paciente?.id] as const, ([agora]) => {
  if (agora) void carregar()
})

function hora(valor: string) {
  return new Date(valor).toLocaleTimeString(locale.value, { hour: '2-digit', minute: '2-digit' })
}

function quandoVence(item: Chamada) {
  const dias = item.diasParaVencer
  if (dias < 0) return t('vacinas.chamada.venceuHa', { n: -dias }, -dias)
  if (dias === 0) return t('vacinas.chamada.venceHoje')
  return t('vacinas.chamada.venceEm', { n: dias }, dias)
}

type Dado = { rotulo: string; valor: string; num?: boolean }

/** Os campos da última dose, na ordem em que a clínica confere uma carteirinha. */
function dadosDa(item: Chamada, aplicacao: Aplicacao | null): Dado[] {
  const dados: Dado[] = [
    {
      rotulo: t('vacinas.detalhes.ultima'),
      valor: [
        rotulos.dia(item.ultimaEm.slice(0, 10)),
        aplicacao
          ? t('vacinas.plano.dose', { n: aplicacao.dose, total: aplicacao.dosesNaSerie })
          : '',
      ]
        .filter(Boolean)
        .join(' · '),
    },
  ]
  if (aplicacao?.origem === 'EXTERNA' && aplicacao.externa) {
    dados.push({
      rotulo: t('vacinas.detalhes.deOutroLugar'),
      valor: [aplicacao.externa.local, aplicacao.externa.aplicador].filter(Boolean).join(' · '),
    })
  } else if (aplicacao) {
    dados.push({
      rotulo: t('vacinas.detalhes.aplicadaPor'),
      valor: [aplicacao.profissional.nome, aplicacao.profissional.crmv].filter(Boolean).join(' · '),
    })
  }
  if (aplicacao?.lote) {
    dados.push({
      rotulo: t('vacinas.detalhes.lote'),
      valor: t('vacinas.detalhes.loteValidade', {
        codigo: aplicacao.lote.codigo,
        validade: rotulos.dia(aplicacao.lote.validade),
      }),
      num: true,
    })
  }
  if (aplicacao?.via) {
    dados.push({
      rotulo: t('vacinas.aplicar.via'),
      valor: t(`clinico.bulario.api.via.${aplicacao.via}`),
    })
  }
  dados.push({
    rotulo: t('vacinas.detalhes.proxima'),
    valor: `${rotulos.dia(item.proximaDoseEm)} · ${quandoVence(item)}`,
  })
  const marcado = item.agendamentoProxima
  if (marcado && marcado.status !== 'CANCELADO') {
    dados.push({
      rotulo: t('vacinas.detalhes.marcado'),
      valor: `${rotulos.dia(marcado.inicio.slice(0, 10))}, ${hora(marcado.inicio)}`,
    })
  }
  if (aplicacao) {
    dados.push({
      rotulo: t('vacinas.detalhes.noApp'),
      valor: aplicacao.vacinaDaCarteiraId
        ? t('vacinas.detalhes.naCarteirinha')
        : t('vacinas.detalhes.foraDoApp'),
    })
  }
  if (aplicacao?.observacao) {
    dados.push({ rotulo: t('vacinas.aplicar.observacao'), valor: aplicacao.observacao })
  }
  return dados
}

const vacinas = computed(() =>
  props.itens.map((item) => {
    const aplicacao = historico.value.find((a) => a.id === item.aplicacaoId) ?? null
    const antes = historico.value.filter(
      (a) => a.vacina.id === item.vacina.id && a.id !== item.aplicacaoId,
    )
    return { item, dados: dadosDa(item, aplicacao), antes }
  }),
)

function linhaDeAntes(aplicacao: Aplicacao) {
  return [
    rotulos.dia(aplicacao.aplicadaEm.slice(0, 10)),
    t('vacinas.plano.dose', { n: aplicacao.dose, total: aplicacao.dosesNaSerie }),
    aplicacao.lote ? t('vacinas.historico.lote', { codigo: aplicacao.lote.codigo }) : '',
  ]
    .filter(Boolean)
    .join(' · ')
}
</script>

<template>
  <CadastroGaveta
    v-model:visible="aberta"
    :titulo="t('vacinas.detalhes.titulo', { pet: paciente?.nome ?? '' })"
    icone="ph ph-syringe"
    largura="32rem"
  >
    <UiLinhasCarregando v-if="carregando" :linhas="4" :rotulo="t('vacinas.detalhes.carregando')" />

    <p v-else-if="erro" class="eg__erro" role="alert">
      <i class="ph ph-warning-circle" aria-hidden="true" />
      <span>{{ erro }}</span>
    </p>

    <template v-else>
      <section v-for="vacina in vacinas" :key="vacina.item.aplicacaoId" class="dv">
        <h3 class="dv__nome">{{ vacina.item.vacina.nome }}</h3>
        <dl class="dv__dados">
          <div v-for="dado in vacina.dados" :key="dado.rotulo" class="dv__dado">
            <dt>{{ dado.rotulo }}</dt>
            <dd :class="{ 'ui-num': dado.num }">{{ dado.valor }}</dd>
          </div>
        </dl>

        <div v-if="vacina.antes.length" class="dv__antes">
          <h4>{{ t('vacinas.detalhes.antes', { n: vacina.antes.length }) }}</h4>
          <ul>
            <li
              v-for="aplicacao in vacina.antes"
              :key="aplicacao.id"
              :class="{ dv__anulada: aplicacao.anulada }"
            >
              <span>{{ linhaDeAntes(aplicacao) }}</span>
              <small v-if="aplicacao.anulada">{{
                t('vacinas.historico.anulada', { motivo: aplicacao.anulada.motivo })
              }}</small>
            </li>
          </ul>
        </div>
      </section>
    </template>

    <template #pe>
      <Button
        type="button"
        severity="secondary"
        outlined
        :label="t('vacinas.anular.fechar')"
        @click="aberta = false"
      />
      <Button
        v-if="paciente"
        :as="RouterLink"
        :to="`/clinica/ficha/${paciente.id}`"
        icon="ph ph-identification-card"
        :label="t('vacinas.detalhes.abrirFicha')"
      />
    </template>
  </CadastroGaveta>
</template>

<style scoped>
.dv {
  display: grid;
  gap: 12px;
}

.dv + .dv {
  padding-top: 22px;
  border-top: 1px solid var(--linha-suave);
}

.dv__nome {
  margin: 0;
  color: var(--tinta);
  font-size: 16px;
  font-weight: 650;
}

/* Rótulo à esquerda, valor à direita: lê-se como a carteirinha, campo por campo. */
.dv__dados {
  display: grid;
  margin: 0;
  border: 1px solid var(--linha);
  border-radius: 12px;
}

.dv__dado {
  display: grid;
  align-items: baseline;
  gap: 12px;
  grid-template-columns: 9.5rem minmax(0, 1fr);
  padding: 9px 14px;
}

.dv__dado + .dv__dado {
  border-top: 1px solid var(--linha-suave);
}

.dv__dado dt {
  color: var(--tinta-2);
  font-size: 13px;
}

.dv__dado dd {
  margin: 0;
  color: var(--tinta);
  font-size: 13.5px;
  font-weight: 550;
  overflow-wrap: anywhere;
}

.dv__antes {
  display: grid;
  gap: 6px;
}

.dv__antes h4 {
  margin: 0;
  color: var(--tinta-2);
  font-size: 13px;
  font-weight: 600;
}

.dv__antes ul {
  display: grid;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.dv__antes li {
  display: grid;
  color: var(--tinta);
  font-size: 13.5px;
}

.dv__antes small {
  color: var(--tinta-2);
  font-size: 12.5px;
}

.dv__anulada span {
  color: var(--tinta-2);
  text-decoration: line-through;
}
</style>
