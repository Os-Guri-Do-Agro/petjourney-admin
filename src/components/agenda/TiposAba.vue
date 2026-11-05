<script setup lang="ts">
/**
 * Tipos de atendimento (E3-01, seção 1.3): o `kind` decide a regra (consulta, retorno, vacina,
 * exame, cirurgia, banho, emergência); o nome é da clínica ("Check-up felino"). Duração de 5 a 480
 * minutos, de 5 em 5; salas compatíveis (nenhuma = qualquer sala); encaixe; e "aparece no pedido
 * online", que nunca vale para cirurgia nem emergência: o interruptor desliga sozinho. A ordem da
 * lista é a da legenda da agenda. Tipo não se apaga: desativa.
 */
import Button from 'primevue/button'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Skeleton from 'primevue/skeleton'
import ToggleButton from 'primevue/togglebutton'
import ToggleSwitch from 'primevue/toggleswitch'
import { useToast } from 'primevue/usetoast'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { criarChaveadorDeIdempotencia } from '@/service/idempotencia'
import {
  criarTipo,
  DURACAO_MAX,
  DURACAO_MIN,
  DURACAO_PASSO,
  duracaoValida,
  editarTipo,
  KINDS,
  KINDS_FORA_DO_ONLINE,
  listarTipos,
  TIPOS_DE_SALA,
  type KindDoAtendimento,
  type TipoDeAtendimento,
  type TipoDeSala,
} from '@/service/parceiro/agenda-config-service'

const props = defineProps<{ podeEditar: boolean }>()

const { t } = useI18n()
const toast = useToast()
const { parceiroQuery } = useParceiroPortal()
const chaveador = criarChaveadorDeIdempotencia()

const tipos = ref<TipoDeAtendimento[]>([])
const carregando = ref(true)
const erro = ref('')

async function carregar() {
  carregando.value = true
  erro.value = ''

  try {
    tipos.value = await listarTipos(parceiroQuery())
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('agenda.config.erroAoCarregar')).mensagem
  } finally {
    carregando.value = false
  }
}

onMounted(() => void carregar())

const ativos = computed(() => tipos.value.filter((tipo) => tipo.ativo))
const inativos = computed(() => tipos.value.filter((tipo) => !tipo.ativo))

function resumo(tipo: TipoDeAtendimento) {
  const salas = tipo.salasCompativeis.length
    ? tipo.salasCompativeis.map((sala) => t(`agenda.config.sala.tipo.${sala}`)).join(', ')
    : t('agenda.config.tipo.qualquerSala')

  return [
    t(`agenda.config.tipo.kind.${tipo.kind}`),
    t('agenda.config.tipo.minutos', { n: tipo.duracaoMinutos }),
    salas,
  ].join(' · ')
}

/* ----------------------------------------------------------------------------- a gaveta */

const aberta = ref(false)
const emEdicao = ref<TipoDeAtendimento | null>(null)
const nome = ref('')
const kind = ref<KindDoAtendimento>('CONSULTA')
const duracao = ref<number | null>(30)
const salasCompativeis = ref<TipoDeSala[]>([])
const permiteEncaixe = ref(true)
const ofertadoOnline = ref(false)
const tentou = ref(false)
const erroNoNome = ref('')
const erroGeral = ref('')
const salvando = ref(false)

const opcoesDeKind = computed(() =>
  KINDS.map((valor) => ({ valor, rotulo: t(`agenda.config.tipo.kind.${valor}`) })),
)

const foraDoOnline = computed(() => KINDS_FORA_DO_ONLINE.includes(kind.value))

/* Cirurgia e emergência nunca vão para o pedido online: o interruptor desliga junto. */
watch(foraDoOnline, (fora) => {
  if (fora) ofertadoOnline.value = false
})

function abrir(tipo: TipoDeAtendimento | null) {
  emEdicao.value = tipo
  nome.value = tipo?.nome ?? ''
  kind.value = tipo?.kind ?? 'CONSULTA'
  duracao.value = tipo?.duracaoMinutos ?? 30
  salasCompativeis.value = [...(tipo?.salasCompativeis ?? [])]
  permiteEncaixe.value = tipo?.permiteEncaixe ?? true
  ofertadoOnline.value = tipo?.ofertadoOnline ?? false
  tentou.value = false
  erroNoNome.value = ''
  erroGeral.value = ''
  aberta.value = true
}

function alternarSala(sala: TipoDeSala, marcada: boolean) {
  salasCompativeis.value = marcada
    ? [...salasCompativeis.value, sala]
    : salasCompativeis.value.filter((item) => item !== sala)
}

const nomeValido = computed(() => nome.value.trim().length >= 2)

async function salvar() {
  tentou.value = true
  erroNoNome.value = ''
  erroGeral.value = ''
  if (!nomeValido.value || !duracaoValida(duracao.value)) return

  salvando.value = true
  const corpo = {
    nome: nome.value.trim(),
    kind: kind.value,
    duracaoMinutos: duracao.value!,
    salasCompativeis: salasCompativeis.value,
    permiteEncaixe: permiteEncaixe.value,
    ofertadoOnline: foraDoOnline.value ? false : ofertadoOnline.value,
  }

  try {
    if (emEdicao.value) {
      await editarTipo(emEdicao.value.id, corpo, parceiroQuery())
    } else {
      await criarTipo(corpo, chaveador.para(corpo), parceiroQuery())
      chaveador.concluir()
    }

    aberta.value = false
    await carregar()
  } catch (err) {
    const lido = lerErroDoCadastro(err, t('cadastro.erros.salvar'))
    if (lido.codigo === 'TIPO_NOME_EM_USO') erroNoNome.value = t('agenda.config.tipo.nomeEmUso')
    else if (lido.codigo === 'TIPO_NAO_OFERTAVEL_ONLINE')
      erroGeral.value = t('agenda.config.tipo.naoOnline')
    else erroGeral.value = lido.mensagem
  } finally {
    salvando.value = false
  }
}

/* ------------------------------------------------------------------- ativar e ordem */

const mexendo = ref<string | null>(null)

async function alternar(tipo: TipoDeAtendimento) {
  mexendo.value = tipo.id

  try {
    await editarTipo(tipo.id, { ativo: !tipo.ativo }, parceiroQuery())
    await carregar()
  } catch (err) {
    const lido = lerErroDoCadastro(err, t('cadastro.erros.salvar'))
    toast.add({
      severity: 'error',
      summary:
        lido.codigo === 'TIPO_NOME_EM_USO' ? t('agenda.config.tipo.nomeEmUso') : lido.mensagem,
      life: 6000,
    })
  } finally {
    mexendo.value = null
  }
}

async function mover(indice: number, passo: -1 | 1) {
  const lista = ativos.value
  const atual = lista[indice]
  const vizinho = lista[indice + passo]
  if (!atual || !vizinho) return

  mexendo.value = atual.id

  try {
    await editarTipo(atual.id, { ordem: vizinho.ordem }, parceiroQuery())
    await editarTipo(vizinho.id, { ordem: atual.ordem }, parceiroQuery())
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: lerErroDoCadastro(err, t('cadastro.erros.salvar')).mensagem,
      life: 6000,
    })
  } finally {
    mexendo.value = null
    await carregar()
  }
}
</script>

<template>
  <section class="ui-folha ui-cartao cfa" aria-labelledby="tipos-titulo">
    <header class="ui-cartao__cabeca">
      <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-stethoscope" /></span>
      <span class="ui-cartao__titulos">
        <h2 id="tipos-titulo" class="ui-cartao__titulo">{{ t('agenda.config.tipo.titulo') }}</h2>
        <p class="ui-cartao__descricao">{{ t('agenda.config.tipo.descricao') }}</p>
      </span>
      <Button
        v-if="props.podeEditar"
        type="button"
        size="small"
        icon="ph ph-plus"
        :label="t('agenda.config.tipo.novo')"
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

    <ul v-if="carregando && !tipos.length" class="ui-lista" aria-busy="true">
      <li v-for="n in 3" :key="n" class="ui-linha"><Skeleton width="14rem" height="1rem" /></li>
    </ul>

    <p v-else-if="!tipos.length" class="cfa__vazio">{{ t('agenda.config.tipo.vazio') }}</p>

    <template v-else>
      <ul class="ui-lista">
        <li v-for="(tipo, indice) in ativos" :key="tipo.id" class="ui-linha">
          <span class="ui-linha__texto">
            <strong class="ui-linha__titulo cfa__titulo">
              {{ tipo.nome }}
              <span v-if="tipo.ofertadoOnline" class="ui-selo ui-selo--ok">
                <i class="ph ph-globe" aria-hidden="true" />
                {{ t('agenda.config.tipo.online') }}
              </span>
              <span v-if="!tipo.permiteEncaixe" class="ui-selo">{{
                t('agenda.config.tipo.semEncaixe')
              }}</span>
            </strong>
            <span class="ui-linha__meta">{{ resumo(tipo) }}</span>
          </span>
          <span v-if="props.podeEditar" class="ui-linha__fim cfa__acoes">
            <Button
              type="button"
              size="small"
              severity="secondary"
              outlined
              icon="ph ph-arrow-up"
              :aria-label="t('agenda.config.subir', { nome: tipo.nome })"
              :disabled="indice === 0 || mexendo !== null"
              @click="mover(indice, -1)"
            />
            <Button
              type="button"
              size="small"
              severity="secondary"
              outlined
              icon="ph ph-arrow-down"
              :aria-label="t('agenda.config.descer', { nome: tipo.nome })"
              :disabled="indice === ativos.length - 1 || mexendo !== null"
              @click="mover(indice, 1)"
            />
            <Button
              type="button"
              size="small"
              severity="secondary"
              outlined
              icon="ph ph-pencil-simple"
              :aria-label="t('agenda.config.editarDe', { nome: tipo.nome })"
              @click="abrir(tipo)"
            />
            <Button
              type="button"
              size="small"
              severity="secondary"
              outlined
              :label="t('agenda.config.desativar')"
              :loading="mexendo === tipo.id"
              @click="alternar(tipo)"
            />
          </span>
        </li>
      </ul>

      <template v-if="inativos.length">
        <h3 class="eg__grupo-titulo cfa__subtitulo">{{ t('agenda.config.inativos') }}</h3>
        <ul class="ui-lista cfa__inativas">
          <li v-for="tipo in inativos" :key="tipo.id" class="ui-linha">
            <span class="ui-linha__texto">
              <strong class="ui-linha__titulo">{{ tipo.nome }}</strong>
              <span class="ui-linha__meta">{{ resumo(tipo) }}</span>
            </span>
            <span v-if="props.podeEditar" class="ui-linha__fim">
              <Button
                type="button"
                size="small"
                severity="secondary"
                outlined
                icon="ph ph-arrow-counter-clockwise"
                :label="t('agenda.config.reativar')"
                :loading="mexendo === tipo.id"
                @click="alternar(tipo)"
              />
            </span>
          </li>
        </ul>
      </template>
    </template>

    <CadastroGaveta
      v-model:visible="aberta"
      :titulo="emEdicao ? t('agenda.config.tipo.editar') : t('agenda.config.tipo.novo')"
      icone="ph ph-stethoscope"
    >
      <form id="tipo-form" class="eg" novalidate @submit.prevent="salvar">
        <section class="eg__secao">
          <label class="eg__rotulo" for="tipo-nome">{{ t('agenda.config.tipo.nome') }}</label>
          <InputText
            id="tipo-nome"
            v-model="nome"
            maxlength="60"
            :placeholder="t('agenda.config.tipo.nomeExemplo')"
            :invalid="(tentou && !nomeValido) || Boolean(erroNoNome)"
            :disabled="salvando"
          />
          <small v-if="erroNoNome" class="eg__invalido">{{ erroNoNome }}</small>
          <small v-else-if="tentou && !nomeValido" class="eg__invalido">{{
            t('agenda.config.tipo.faltaNome')
          }}</small>
        </section>

        <div class="eg__linha">
          <section class="eg__secao">
            <label class="eg__rotulo" for="tipo-kind">{{
              t('agenda.config.tipo.kindRotulo')
            }}</label>
            <Select
              v-model="kind"
              input-id="tipo-kind"
              :options="opcoesDeKind"
              option-label="rotulo"
              option-value="valor"
              :disabled="salvando"
            />
          </section>
          <section class="eg__secao">
            <label class="eg__rotulo" for="tipo-duracao">{{
              t('agenda.config.tipo.duracao')
            }}</label>
            <InputNumber
              v-model="duracao"
              input-id="tipo-duracao"
              :min="DURACAO_MIN"
              :max="DURACAO_MAX"
              :step="DURACAO_PASSO"
              show-buttons
              :suffix="` ${t('agenda.config.tipo.min')}`"
              :invalid="tentou && !duracaoValida(duracao)"
              :disabled="salvando"
            />
            <small v-if="tentou && !duracaoValida(duracao)" class="eg__invalido">
              {{
                t('agenda.config.tipo.duracaoInvalida', {
                  min: DURACAO_MIN,
                  max: DURACAO_MAX,
                  passo: DURACAO_PASSO,
                })
              }}
            </small>
          </section>
        </div>

        <section class="eg__secao">
          <span id="tipo-salas" class="eg__rotulo">{{ t('agenda.config.tipo.salas') }}</span>
          <div class="cfa__chips" role="group" aria-labelledby="tipo-salas">
            <ToggleButton
              v-for="sala in TIPOS_DE_SALA"
              :key="sala"
              :model-value="salasCompativeis.includes(sala)"
              :on-label="t(`agenda.config.sala.tipo.${sala}`)"
              :off-label="t(`agenda.config.sala.tipo.${sala}`)"
              :disabled="salvando"
              @update:model-value="(marcada: boolean) => alternarSala(sala, marcada)"
            />
          </div>
          <small class="eg__dica">{{ t('agenda.config.tipo.salasDica') }}</small>
        </section>

        <label class="cfa__chave">
          <span>
            <strong>{{ t('agenda.config.tipo.encaixe') }}</strong>
            <small>{{ t('agenda.config.tipo.encaixeDica') }}</small>
          </span>
          <ToggleSwitch v-model="permiteEncaixe" :disabled="salvando" />
        </label>

        <label class="cfa__chave">
          <span>
            <strong>{{ t('agenda.config.tipo.ofertadoOnline') }}</strong>
            <small>{{
              foraDoOnline
                ? t('agenda.config.tipo.naoOnline')
                : t('agenda.config.tipo.ofertadoOnlineDica')
            }}</small>
          </span>
          <ToggleSwitch v-model="ofertadoOnline" :disabled="salvando || foraDoOnline" />
        </label>

        <p v-if="erroGeral" class="eg__erro" role="alert">
          <i class="ph ph-warning-circle" aria-hidden="true" />
          <span>{{ erroGeral }}</span>
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
          form="tipo-form"
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

.cfa__titulo {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
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

.cfa__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.cfa__chave {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  cursor: pointer;
}

.cfa__chave span {
  display: grid;
  gap: 2px;
}

.cfa__chave strong {
  color: var(--tinta);
  font-size: 14px;
  font-weight: 600;
}

.cfa__chave small {
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.4;
}
</style>
