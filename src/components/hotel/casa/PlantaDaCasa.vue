<script setup lang="ts">
/**
 * A planta da casa pela API (E7-01, guia e7 2, 3 e 5): um corredor por caixa, na ordem da casa,
 * com as acomodações dentro (a lista já vem por corredor e por nome). Inativa fica à vista, com o
 * motivo e desde quando; ocupada diz só "Ocupada" (o cadastro da casa não lê hóspede).
 *
 * O corredor sobe, desce, muda de nome e sai (sem acomodação dentro; o último também pode sair).
 * A acomodação abre a gaveta, sai de operação (quem cuida da rotina também), volta e é apagada só
 * se nunca recebeu hóspede nem teve reserva (`podeApagar`).
 */
import Button from 'primevue/button'
import { useToast } from 'primevue/usetoast'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import {
  apagarAcomodacao,
  apagarAgrupamento,
  moverAgrupamento,
  reativarAcomodacao,
  type AcomodacaoDaCasa,
  type BlocoDaCasa,
  type CasaDoHotel,
} from '@/service/parceiro/hotel-casa-service'

import AcomodacaoGaveta from './AcomodacaoGaveta.vue'
import AgrupamentoGaveta from './AgrupamentoGaveta.vue'
import DesativarAcomodacaoGaveta from './DesativarAcomodacaoGaveta.vue'
import { ICONE_DA_CASA, useRotulosDaCasa } from './useRotulosDaCasa'

const props = defineProps<{
  casa: CasaDoHotel
  /** Cadastrar, editar, reativar e apagar: `estabelecimento.editar` (com `hotel.valores`). */
  podeEditar: boolean
  /** Tirar de operação: quem edita ou quem cuida da rotina (`hotel.rotina`). */
  podeDesativar: boolean
}>()
const emit = defineEmits<{ mudou: [] }>()

const { t } = useI18n()
const rotulos = useRotulosDaCasa()
const toast = useToast()
const { parceiroQuery } = useParceiroPortal()

const erro = ref('')
const mexendo = ref<string | null>(null)

const porBloco = computed(() =>
  props.casa.blocos.map((bloco) => {
    const dentro = props.casa.acomodacoes.filter((a) => a.blocoId === bloco.id)
    const ativas = dentro.filter((a) => a.ativa)
    return {
      bloco,
      acomodacoes: dentro,
      ativas: ativas.length,
      ocupadas: ativas.filter((a) => a.ocupadaAgora).length,
    }
  }),
)

/** A acomodação precisa de corredor, tipo e tarifa: sem um deles, o botão some e a nota explica. */
const podeCriarAcomodacao = computed(
  () =>
    props.casa.blocos.length > 0 &&
    props.casa.tipos.length > 0 &&
    (props.casa.tarifas?.length ?? 0) > 0 &&
    props.casa.acomodacoes.length < props.casa.limites.acomodacoes,
)
const blocosNoLimite = computed(() => props.casa.blocos.length >= props.casa.limites.blocos)

function meta(a: AcomodacaoDaCasa) {
  return [
    a.tipoNome,
    t('casaDoHotel.planta.cabem', { total: a.capacidade }, a.capacidade),
    t('casaDoHotel.planta.ate', { porte: rotulos.porte(a.porteMaximo).toLocaleLowerCase() }),
    a.especiesAceitas.map(rotulos.especie).join(', '),
    a.recursos.map(rotulos.recurso).join(', '),
    a.tarifaNome ?? '',
    t('casaDoHotel.planta.higienizacao', { n: a.higienizacaoMinutos }),
  ]
    .filter(Boolean)
    .join(' · ')
}

function inativa(a: AcomodacaoDaCasa) {
  if (a.ativa || !a.motivoInativa) return ''
  return [
    t('casaDoHotel.planta.desde', {
      motivo: rotulos.motivo(a.motivoInativa),
      data: rotulos.data(a.inativaDesde),
    }),
    a.detalheInativa ?? '',
  ]
    .filter(Boolean)
    .join(' · ')
}

function falhou(err: unknown) {
  erro.value = lerErroDoCadastro(err, t('cadastro.erros.salvar')).mensagem
}

async function fazer(id: string, acao: () => Promise<unknown>, apagado?: string) {
  erro.value = ''
  mexendo.value = id
  try {
    await acao()
    if (apagado)
      toast.add({
        severity: 'success',
        summary: t('casaDoHotel.apagado', { nome: apagado }),
        life: 3000,
      })
    emit('mudou')
  } catch (err) {
    falhou(err)
    emit('mudou')
  } finally {
    mexendo.value = null
  }
}

/* --------------------------------------------------------------------------- gavetas */

const blocoAberto = ref(false)
const blocoEmEdicao = ref<BlocoDaCasa | null>(null)

function abrirBloco(bloco: BlocoDaCasa | null) {
  blocoEmEdicao.value = bloco
  blocoAberto.value = true
}

const acomodacaoAberta = ref(false)
const acomodacaoEmEdicao = ref<AcomodacaoDaCasa | null>(null)
const blocoInicial = ref<string | null>(null)

function abrirAcomodacao(a: AcomodacaoDaCasa | null, bloco: string | null = null) {
  acomodacaoEmEdicao.value = a
  blocoInicial.value = bloco
  acomodacaoAberta.value = true
}

const desativarAberta = ref(false)
const paraDesativar = ref<AcomodacaoDaCasa | null>(null)

function abrirDesativar(a: AcomodacaoDaCasa) {
  paraDesativar.value = a
  desativarAberta.value = true
}
</script>

<template>
  <div class="pl">
    <div v-if="podeEditar" class="pl__acoes">
      <Button
        type="button"
        severity="secondary"
        outlined
        icon="ph ph-plus"
        :label="t('casaDoHotel.planta.novoBloco')"
        :disabled="blocosNoLimite"
        @click="abrirBloco(null)"
      />
      <Button
        type="button"
        icon="ph ph-plus"
        :label="t('casaDoHotel.planta.novaAcomodacao')"
        :disabled="!podeCriarAcomodacao"
        @click="abrirAcomodacao(null)"
      />
    </div>

    <p v-if="erro" class="pl__erro" role="alert">{{ erro }}</p>
    <p
      v-if="
        podeEditar && casa.blocos.length && (!casa.tipos.length || !(casa.tarifas?.length ?? 0))
      "
      class="pl__nota"
    >
      <i class="ph ph-info" aria-hidden="true" />
      {{ t('casaDoHotel.planta.antes') }}
    </p>
    <p v-if="casa.acomodacoes.length >= casa.limites.acomodacoes" class="pl__nota">
      {{ t('casaDoHotel.planta.noLimite', { limite: casa.limites.acomodacoes }) }}
    </p>
    <p v-if="podeEditar && blocosNoLimite" class="pl__nota">
      {{ t('casaDoHotel.planta.blocosNoLimite', { limite: casa.limites.blocos }) }}
    </p>

    <p v-if="!casa.blocos.length" class="ui-folha ui-vazio">{{ t('casaDoHotel.planta.vazio') }}</p>

    <section
      v-for="(grupo, indice) in porBloco"
      :key="grupo.bloco.id"
      class="ui-folha ui-cartao"
      :aria-labelledby="`bloco-${grupo.bloco.id}`"
    >
      <header class="ui-cartao__cabeca">
        <span class="ui-ladrilho" aria-hidden="true"
          ><i :class="ICONE_DA_CASA[grupo.bloco.icone]"
        /></span>
        <span class="ui-cartao__titulos">
          <h2 :id="`bloco-${grupo.bloco.id}`" class="ui-cartao__titulo">{{ grupo.bloco.nome }}</h2>
          <p class="ui-cartao__descricao">
            {{
              grupo.ativas
                ? t('casaDoHotel.planta.ocupadas', {
                    ocupadas: grupo.ocupadas,
                    ativas: grupo.ativas,
                  })
                : t('casaDoHotel.planta.semAcomodacao')
            }}
          </p>
        </span>
        <span v-if="podeEditar" class="ui-cartao__acoes pl__acoes-do-bloco">
          <Button
            type="button"
            size="small"
            severity="secondary"
            outlined
            icon="ph ph-arrow-up"
            :aria-label="t('casaDoHotel.planta.subir', { nome: grupo.bloco.nome })"
            :disabled="indice === 0 || mexendo !== null"
            @click="
              fazer(grupo.bloco.id, () =>
                moverAgrupamento('blocos', grupo.bloco.id, 'SOBE', parceiroQuery()),
              )
            "
          />
          <Button
            type="button"
            size="small"
            severity="secondary"
            outlined
            icon="ph ph-arrow-down"
            :aria-label="t('casaDoHotel.planta.descer', { nome: grupo.bloco.nome })"
            :disabled="indice === porBloco.length - 1 || mexendo !== null"
            @click="
              fazer(grupo.bloco.id, () =>
                moverAgrupamento('blocos', grupo.bloco.id, 'DESCE', parceiroQuery()),
              )
            "
          />
          <Button
            type="button"
            size="small"
            severity="secondary"
            outlined
            icon="ph ph-pencil-simple"
            :aria-label="t('casaDoHotel.planta.editarDe', { nome: grupo.bloco.nome })"
            @click="abrirBloco(grupo.bloco)"
          />
          <Button
            type="button"
            size="small"
            severity="secondary"
            outlined
            icon="ph ph-trash"
            :aria-label="t('casaDoHotel.planta.apagarDe', { nome: grupo.bloco.nome })"
            :title="
              grupo.bloco.quantidadeDeAcomodacoes
                ? t(
                    'casaDoHotel.planta.blocoEmUso',
                    { total: grupo.bloco.quantidadeDeAcomodacoes },
                    grupo.bloco.quantidadeDeAcomodacoes,
                  )
                : undefined
            "
            :disabled="grupo.bloco.quantidadeDeAcomodacoes > 0 || mexendo !== null"
            :loading="mexendo === grupo.bloco.id"
            @click="
              fazer(
                grupo.bloco.id,
                () => apagarAgrupamento('blocos', grupo.bloco.id, parceiroQuery()),
                grupo.bloco.nome,
              )
            "
          />
        </span>
      </header>

      <ul v-if="grupo.acomodacoes.length" class="ui-lista">
        <li
          v-for="a in grupo.acomodacoes"
          :key="a.id"
          class="ui-linha"
          :class="{ pl__inativa: !a.ativa }"
        >
          <span class="ui-linha__texto">
            <span class="pl__nome">
              <strong class="ui-linha__titulo">{{ a.nome }}</strong>
              <span v-if="!a.ativa" class="ui-selo ui-selo--atencao">{{
                t('casaDoHotel.planta.foraDeOperacao')
              }}</span>
              <span v-else-if="a.ocupadaAgora" class="ui-selo">{{
                t('casaDoHotel.planta.ocupada')
              }}</span>
            </span>
            <span class="ui-linha__meta">{{ meta(a) }}</span>
            <span v-if="!a.ativa" class="ui-linha__meta">{{ inativa(a) }}</span>
          </span>
          <span v-if="podeEditar || podeDesativar" class="ui-linha__fim pl__acoes-da-linha">
            <Button
              v-if="podeEditar"
              type="button"
              size="small"
              severity="secondary"
              outlined
              icon="ph ph-pencil-simple"
              :aria-label="t('casaDoHotel.planta.editarDe', { nome: a.nome })"
              @click="abrirAcomodacao(a)"
            />
            <Button
              v-if="podeEditar && a.podeApagar"
              type="button"
              size="small"
              severity="secondary"
              outlined
              icon="ph ph-trash"
              :aria-label="t('casaDoHotel.planta.apagarDe', { nome: a.nome })"
              :loading="mexendo === a.id"
              :disabled="mexendo !== null"
              @click="fazer(a.id, () => apagarAcomodacao(a.id, parceiroQuery()), a.nome)"
            />
            <Button
              v-if="a.ativa && podeDesativar"
              type="button"
              size="small"
              severity="secondary"
              outlined
              :label="t('casaDoHotel.planta.desativar')"
              @click="abrirDesativar(a)"
            />
            <Button
              v-else-if="!a.ativa && podeEditar"
              type="button"
              size="small"
              severity="secondary"
              outlined
              icon="ph ph-arrow-counter-clockwise"
              :label="t('casaDoHotel.planta.reativar')"
              :loading="mexendo === a.id"
              :disabled="mexendo !== null"
              @click="fazer(a.id, () => reativarAcomodacao(a.id, parceiroQuery()))"
            />
          </span>
        </li>
      </ul>
    </section>

    <AgrupamentoGaveta
      v-model:visible="blocoAberto"
      qual="blocos"
      :item="blocoEmEdicao"
      @salvo="emit('mudou')"
    />
    <AcomodacaoGaveta
      v-model:visible="acomodacaoAberta"
      :casa="casa"
      :acomodacao="acomodacaoEmEdicao"
      :bloco-inicial="blocoInicial"
      @salvo="emit('mudou')"
    />
    <DesativarAcomodacaoGaveta
      v-model:visible="desativarAberta"
      :acomodacao="paraDesativar"
      @desativada="emit('mudou')"
    />
  </div>
</template>

<style scoped>
.pl {
  display: grid;
  gap: 20px;
}

.pl__acoes {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
}

.pl__erro {
  margin: 0;
  color: var(--risco-tinta);
  font-size: 13.5px;
}

.pl__nota {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
}

.pl__acoes-do-bloco,
.pl__acoes-da-linha {
  display: inline-flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
}

.pl__nome {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.pl__inativa .ui-linha__titulo {
  color: var(--tinta-2);
}
</style>
