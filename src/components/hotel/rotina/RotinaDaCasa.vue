<script setup lang="ts">
/**
 * A rotina da casa pela API (E7-05b, guia e7 43): água, higiene, passeio e pesagem de todos os
 * hóspedes, com os horários de cada um. Refeição e medicação não moram aqui (vêm de cada hóspede).
 *
 * - Um assunto por faixa (o modelo da Política): o que ele muda à esquerda, os campos à direita.
 * - **Antes de publicar, a prévia**: "Nascem {criadas}, saem {retiradas}, ficam {preservadas}.
 *   {hoje} mudanças caem hoje." O passado não se reescreve.
 * - Publicar numa casa cheia pode levar cerca de 1 minuto: o botão fica em "Publicando..." até a
 *   resposta e não deixa publicar de novo. Com `aoCron`, a prancheta de alguns hóspedes se ajusta
 *   em até uma hora.
 * - Outra pessoa publicou antes (409 `ROTINA_ALTERADA`): relê e pede revisão.
 * - Desfazer: só a última publicação, uma vez.
 *
 * Ler é de quem lê a casa; prever, publicar e desfazer, do dono e do gestor (`estabelecimento.editar`).
 */
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import ToggleSwitch from 'primevue/toggleswitch'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useRotulosDasReservas } from '@/components/hotel/reservas/useRotulosDasReservas'
import UiPagina from '@/components/ui/UiPagina.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { invalidarPendenciasDoPortal } from '@/composables/usePendenciasDoPortal'
import { ApiError } from '@/service/api'
import { criarChaveadorDeIdempotencia } from '@/service/idempotencia'
import {
  desfazerRotinaDaCasa,
  HORARIOS_DA_ROTINA_MAX,
  KINDS_DA_CASA,
  lerRotinaDaCasa,
  preverRotinaDaCasa,
  publicarRotinaDaCasa,
  type ItemDigitado,
  type KindDaCasa,
  type PrevisaoDaRotina,
  type RotinaDaCasa,
} from '@/service/parceiro/hotel-rotina-service'

import { escreverHorarios, lerHorarios } from './rotina-do-hotel'
import '@/components/parceiro/estabelecimento/gaveta.css'

const { t } = useI18n()
const rotulos = useRotulosDasReservas()
const { store, parceiroQuery } = useParceiroPortal()
const chaveDePublicar = criarChaveadorDeIdempotencia()
const chaveDeDesfazer = criarChaveadorDeIdempotencia()

type Linha = { kind: KindDaCasa; ativo: boolean; texto: string }

const rotina = ref<RotinaDaCasa | null>(null)
const linhas = ref<Linha[]>([])
const carregando = ref(false)
const erro = ref('')
const erroDaAcao = ref('')
const recado = ref('')
const tentou = ref(false)
const invalidaNaApi = ref<Partial<Record<KindDaCasa, string>>>({})
const previsao = ref<PrevisaoDaRotina | null>(null)
const prevendo = ref(false)
const publicando = ref(false)
const confirmandoDesfazer = ref(false)
const desfazendo = ref(false)

function doServidor(lida: RotinaDaCasa): Linha[] {
  return KINDS_DA_CASA.map((kind) => {
    const item = lida.itens.find((atual) => atual.kind === kind)
    return { kind, ativo: item?.ativo ?? false, texto: escreverHorarios(item?.horarios ?? []) }
  })
}

async function carregar() {
  carregando.value = true
  try {
    const lida = await lerRotinaDaCasa(parceiroQuery())
    rotina.value = lida
    linhas.value = doServidor(lida)
    erro.value = ''
    previsao.value = null
    invalidaNaApi.value = {}
    tentou.value = false
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('rotinaDoHotel.casa.erro')).mensagem
  } finally {
    carregando.value = false
  }
}

onMounted(() => void carregar())

const podeEditar = computed(
  () =>
    Boolean(store.modulo('HOTEL')?.podeEscrever) && store.temPermissao('estabelecimento.editar'),
)
const ocupado = computed(() => prevendo.value || publicando.value || desfazendo.value)

/* ------------------------------------------------------------------------------ as linhas */

const lidas = computed(() =>
  linhas.value.map((linha) => lerHorarios(linha.texto, HORARIOS_DA_ROTINA_MAX)),
)

function problema(indice: number) {
  const linha = linhas.value[indice]
  const lida = lidas.value[indice]
  if (!linha || !lida) return ''
  if (invalidaNaApi.value[linha.kind]) return invalidaNaApi.value[linha.kind] ?? ''
  if (lida.erro === 'FORMATO') return t('rotinaDoHotel.casa.horarioInvalido')
  if (lida.erro === 'DEMAIS')
    return t('rotinaDoHotel.casa.horariosDemais', { n: HORARIOS_DA_ROTINA_MAX })
  if (linha.ativo && !lida.horarios.length) return t('rotinaDoHotel.casa.semHorario')
  return ''
}

const valido = computed(() => linhas.value.every((_, indice) => !problema(indice)))

const itens = computed<ItemDigitado[]>(() =>
  linhas.value.map((linha, indice) => ({
    kind: linha.kind,
    ativo: linha.ativo,
    horarios: lidas.value[indice]?.horarios ?? [],
  })),
)

const mudou = computed(() => {
  if (!rotina.value) return false
  const vigentes = doServidor(rotina.value)
  return itens.value.some((item, indice) => {
    const antes = vigentes[indice]
    const horariosAntes = lerHorarios(antes?.texto ?? '').horarios
    return item.ativo !== antes?.ativo || item.horarios.join() !== horariosAntes.join()
  })
})

function editou(kind: KindDaCasa) {
  previsao.value = null
  recado.value = ''
  if (invalidaNaApi.value[kind]) invalidaNaApi.value = { ...invalidaNaApi.value, [kind]: '' }
}

/* --------------------------------------------------------------------------- erros da API */

function lerErroDaRotina(err: unknown) {
  const lido = lerErroDoCadastro(err, t('rotinaDoHotel.casa.erroPublicar'))
  const detalhes = err instanceof ApiError ? err.detalhes : {}
  if (lido.codigo === 'ROTINA_ITEM_INVALIDO' && typeof detalhes.kind === 'string') {
    invalidaNaApi.value = {
      ...invalidaNaApi.value,
      [detalhes.kind]: t(`rotinaDoHotel.casa.invalido.${String(detalhes.reason ?? 'OUTRO')}`),
    }
    return ''
  }
  if (lido.codigo === 'ROTINA_ALTERADA') {
    void carregar()
    return t('rotinaDoHotel.casa.alterada')
  }
  if (lido.codigo === 'ROTINA_OCUPADA') return t('rotinaDoHotel.prancheta.ocupada')
  return lido.mensagem
}

/* ------------------------------------------------------------------- prévia, publicar, desfazer */

async function prever() {
  tentou.value = true
  erroDaAcao.value = ''
  recado.value = ''
  if (!valido.value) return
  prevendo.value = true
  try {
    previsao.value = await preverRotinaDaCasa(itens.value, parceiroQuery())
  } catch (err) {
    erroDaAcao.value = lerErroDaRotina(err)
  } finally {
    prevendo.value = false
  }
}

const fraseDaPrevia = computed(() => {
  const p = previsao.value
  if (!p) return ''
  return t(
    'rotinaDoHotel.casa.previa',
    { criadas: p.criadas, retiradas: p.retiradas, preservadas: p.preservadas, hoje: p.hoje },
    p.hoje,
  )
})

async function publicar() {
  const base = rotina.value
  if (!base || !previsao.value || publicando.value) return
  erroDaAcao.value = ''
  const corpo = { itens: itens.value, versaoBase: base.versao }
  publicando.value = true
  try {
    const feita = await publicarRotinaDaCasa(corpo, chaveDePublicar.para(corpo), parceiroQuery())
    chaveDePublicar.concluir()
    await carregar()
    recado.value = feita.nadaMudou
      ? t('rotinaDoHotel.casa.nadaMudou')
      : feita.aoCron > 0
        ? t('rotinaDoHotel.casa.aoCron', { n: feita.aoCron }, feita.aoCron)
        : t('rotinaDoHotel.casa.publicada')
    invalidarPendenciasDoPortal()
  } catch (err) {
    erroDaAcao.value = lerErroDaRotina(err)
  } finally {
    publicando.value = false
  }
}

async function desfazer() {
  const base = rotina.value
  if (!base) return
  erroDaAcao.value = ''
  desfazendo.value = true
  try {
    await desfazerRotinaDaCasa(
      base.versao,
      chaveDeDesfazer.para({ versaoBase: base.versao }),
      parceiroQuery(),
    )
    chaveDeDesfazer.concluir()
    confirmandoDesfazer.value = false
    await carregar()
    recado.value = t('rotinaDoHotel.casa.desfeita')
    invalidarPendenciasDoPortal()
  } catch (err) {
    const lido = lerErroDoCadastro(err, t('rotinaDoHotel.casa.erroDesfazer'))
    confirmandoDesfazer.value = false
    if (lido.codigo === 'ROTINA_SEM_PUBLICACAO_PARA_DESFAZER' || lido.codigo === 'ROTINA_ALTERADA')
      void carregar()
    erroDaAcao.value = lerErroDaRotina(err)
  } finally {
    desfazendo.value = false
  }
}

function descartar() {
  if (rotina.value) linhas.value = doServidor(rotina.value)
  previsao.value = null
  tentou.value = false
  invalidaNaApi.value = {}
  erroDaAcao.value = ''
}

/* ------------------------------------------------------------------------------ o resumo */

const resumo = computed(() => {
  const lida = rotina.value
  if (!lida) return ''
  const versao = lida.padrao
    ? t('rotinaDoHotel.casa.inicial')
    : t('rotinaDoHotel.casa.versao', {
        versao: lida.versao,
        nome: lida.publicadaPorNome ?? '',
        quando: rotulos.quando(lida.publicadaEm),
      })
  return `${versao} ${t('rotinaDoHotel.casa.porDia', { n: lida.tarefasPorDia }, lida.tarefasPorDia)}`
})
</script>

<template>
  <UiPagina
    :resumo="resumo"
    :carregando="carregando && !rotina"
    :erro="rotina ? '' : erro"
    @tentar-de-novo="carregar"
  >
    <template v-if="rotina && podeEditar && rotina.podeDesfazer" #acoes>
      <Button
        type="button"
        severity="secondary"
        outlined
        icon="ph ph-arrow-counter-clockwise"
        :label="t('rotinaDoHotel.casa.desfazer')"
        :disabled="ocupado"
        @click="confirmandoDesfazer = true"
      />
    </template>

    <div v-if="rotina" class="rc">
      <p v-if="recado" class="ui-folha rc__recado" role="status">
        <i class="ph ph-check-circle rc__ok" aria-hidden="true" /><span>{{ recado }}</span>
      </p>
      <p v-if="confirmandoDesfazer" class="ui-folha rc__recado" role="alert">
        <i class="ph ph-arrow-counter-clockwise rc__atencao" aria-hidden="true" />
        <span>{{ t('rotinaDoHotel.casa.desfazerAviso') }}</span>
        <Button
          type="button"
          size="small"
          severity="secondary"
          outlined
          :label="t('cadastro.cancelar')"
          :disabled="desfazendo"
          @click="confirmandoDesfazer = false"
        />
        <Button
          type="button"
          size="small"
          :label="t('rotinaDoHotel.casa.desfazerConfirmar')"
          :loading="desfazendo"
          @click="desfazer"
        />
      </p>

      <section class="ui-folha ui-cartao" aria-labelledby="rc-titulo">
        <header class="ui-cartao__cabeca">
          <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-timer" /></span>
          <span class="ui-cartao__titulos">
            <h2 id="rc-titulo" class="ui-cartao__titulo">{{ t('rotinaDoHotel.casa.titulo') }}</h2>
            <p class="ui-cartao__descricao">{{ t('rotinaDoHotel.casa.descricao') }}</p>
          </span>
        </header>

        <form class="rc__form" novalidate @submit.prevent="prever">
          <section
            v-for="(linha, indice) in linhas"
            :key="linha.kind"
            class="rc__grupo"
            :aria-labelledby="`rc-${linha.kind}`"
          >
            <div class="rc__sobre">
              <h3 :id="`rc-${linha.kind}`" class="rc__titulo">
                {{ t(`rotinaDoHotel.kind.${linha.kind}`) }}
              </h3>
              <p class="rc__descricao">{{ t(`rotinaDoHotel.casa.sobre.${linha.kind}`) }}</p>
            </div>
            <div class="rc__campos">
              <label class="rc__chave" :for="`rc-ativo-${linha.kind}`">
                <ToggleSwitch
                  v-model="linha.ativo"
                  :input-id="`rc-ativo-${linha.kind}`"
                  :disabled="!podeEditar || ocupado"
                  @update:model-value="editou(linha.kind)"
                />
                <span>{{
                  linha.ativo ? t('rotinaDoHotel.casa.ligado') : t('rotinaDoHotel.casa.desligado')
                }}</span>
              </label>
              <div class="eg__secao">
                <label class="eg__rotulo" :for="`rc-horarios-${linha.kind}`">{{
                  t('rotinaDoHotel.casa.horarios')
                }}</label>
                <InputText
                  :id="`rc-horarios-${linha.kind}`"
                  v-model="linha.texto"
                  :placeholder="t('rotinaDoHotel.casa.horariosExemplo')"
                  :invalid="
                    (tentou || Boolean(invalidaNaApi[linha.kind])) && Boolean(problema(indice))
                  "
                  :disabled="!podeEditar || ocupado"
                  @update:model-value="editou(linha.kind)"
                />
                <small
                  v-if="(tentou || invalidaNaApi[linha.kind]) && problema(indice)"
                  class="eg__invalido"
                  >{{ problema(indice) }}</small
                >
              </div>
            </div>
          </section>

          <p v-if="erroDaAcao" class="eg__erro" role="alert">
            <i class="ph ph-warning-circle" aria-hidden="true" />
            <span>{{ erroDaAcao }}</span>
          </p>

          <footer v-if="podeEditar" class="rc__pe">
            <p class="rc__nota" :aria-live="previsao ? 'polite' : undefined">
              <i :class="previsao ? 'ph ph-eye rc__atencao' : 'ph ph-info'" aria-hidden="true" />
              {{ previsao ? fraseDaPrevia : t('rotinaDoHotel.casa.passadoNaoMuda') }}
            </p>
            <span class="rc__botoes">
              <Button
                v-if="mudou"
                type="button"
                severity="secondary"
                outlined
                :label="t('rotinaDoHotel.casa.descartar')"
                :disabled="ocupado"
                @click="descartar"
              />
              <Button
                v-if="!previsao"
                type="submit"
                icon="ph ph-eye"
                :label="t('rotinaDoHotel.casa.verPrevia')"
                :loading="prevendo"
                :disabled="!mudou || ocupado"
              />
              <Button
                v-else
                type="button"
                icon="ph ph-check"
                :label="
                  publicando ? t('rotinaDoHotel.casa.publicando') : t('rotinaDoHotel.casa.publicar')
                "
                :loading="publicando"
                :disabled="publicando || desfazendo"
                @click="publicar"
              />
            </span>
          </footer>
          <p v-else class="rc__nota rc__nota--so-leitura">
            <i class="ph ph-lock-simple" aria-hidden="true" />
            {{ t('rotinaDoHotel.casa.soLeitura') }}
          </p>
        </form>
      </section>
    </div>
  </UiPagina>
</template>

<style scoped>
.rc {
  display: grid;
  gap: 20px;
}

.rc__recado {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin: 0;
  padding: 14px 20px;
  color: var(--tinta);
  font-size: 14px;
}

.rc__recado > span {
  flex: 1;
  min-width: 12rem;
}

.rc__recado > i {
  font-size: 18px;
}

.rc__ok {
  color: var(--ok-tinta);
}

.rc__atencao {
  color: var(--atencao-tinta);
}

.rc__form {
  display: grid;
  container: rotina-da-casa / inline-size;
}

/* Um assunto por faixa: à esquerda o que ele muda, à direita os campos (o modelo da Política). */
.rc__grupo {
  display: grid;
  gap: 14px 40px;
  padding: 20px 0;
}

.rc__grupo + .rc__grupo {
  border-top: 1px solid var(--app-regua, var(--linha-suave));
}

.rc__grupo:first-child {
  padding-top: 4px;
}

@container rotina-da-casa (min-width: 760px) {
  .rc__grupo {
    grid-template-columns: minmax(14rem, 20rem) minmax(0, 1fr);
  }
}

.rc__sobre {
  display: grid;
  align-content: start;
  gap: 4px;
}

.rc__titulo {
  margin: 0;
  color: var(--tinta);
  font-size: 14.5px;
  font-weight: 650;
  line-height: 1.35;
}

.rc__descricao {
  margin: 0;
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.45;
}

.rc__campos {
  display: grid;
  gap: 14px;
  align-content: start;
}

.rc__campos :deep(.p-inputtext) {
  width: 100%;
  max-width: 28rem;
}

.rc__chave {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: var(--tinta);
  font-size: 14px;
  cursor: pointer;
}

.rc__pe {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-top: 18px;
  border-top: 1px solid var(--app-regua, var(--linha-suave));
}

.rc__nota {
  display: inline-flex;
  flex: 1;
  align-items: flex-start;
  gap: 8px;
  min-width: 14rem;
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
  line-height: 1.45;
}

.rc__nota i {
  margin-top: 2px;
}

.rc__nota--so-leitura {
  padding-top: 18px;
  border-top: 1px solid var(--app-regua, var(--linha-suave));
}

.rc__botoes {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
