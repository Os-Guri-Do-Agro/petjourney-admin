<script setup lang="ts">
/**
 * Clínica e Hotel no Início, pelo que o servidor diz (E1-02 e os pedidos de 17/11): o que dá para
 * pedir, ligar, religar ou desligar, o que está em análise, em teste e o que ficou só para
 * consulta. Módulo ativo só aparece para quem pode desligá-lo (o DONO): para os outros, ele já
 * está no menu e nos espaços.
 *
 * Quem decide cada botão é a API, e o portal não recalcula: `podeLigar` com `ligarVira` (teste
 * grátis ou religar), `podeDesligar` e `podeSolicitar` (o "Pedir o módulo" de antes, quando não dá
 * para ligar sozinho). `bloqueioAoLigar` diz por que não dá para ligar agora, com o texto do
 * código. `elegiveis` só destaca o módulo que combina com as categorias do cadastro.
 *
 * Depois de ligar, desligar ou pedir, e em qualquer 409, o contexto é relido: o menu acompanha
 * sem recarregar a página.
 */
import { PhBed, PhStethoscope } from '@phosphor-icons/vue'
import Button from 'primevue/button'
import { useToast } from 'primevue/usetoast'
import { computed, ref, type Component } from 'vue'
import { useI18n } from 'vue-i18n'

import ConfirmActionDialog from '@/components/common/ConfirmActionDialog.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { INTL_LOCALE, type Locale } from '@/i18n/locales'
import { ApiError } from '@/service/api'
import {
  desligarModulo,
  efeitoDoDesligar,
  ligarModulo,
  solicitarModulo,
  type EfeitoDoDesligar,
  type ModuloDoPortal,
  type NomeDoModulo,
} from '@/service/parceiro/acesso-service'

type Selo = 'solicitado' | 'teste' | 'somenteLeitura'
type Acao = 'ligar' | 'desligar' | 'pedir'

type Linha = {
  modulo: NomeDoModulo
  icone: Component
  frase: string
  /** Texto menor embaixo da frase: a dica do teste grátis, o porquê de não ligar ou o "só o dono". */
  dica: string
  selo: Selo | null
  sugerido: boolean
  ligar: ModuloDoPortal['ligarVira']
  diasDeTesteGratis: number
  desligar: boolean
  pedir: boolean
}

const ICONE: Record<NomeDoModulo, Component> = { CLINICA: PhStethoscope, HOTEL: PhBed }

type ItemDoEfeito =
  | 'agendamentosFuturos'
  | 'internacoesAbertas'
  | 'reservasFuturas'
  | 'hospedagensAbertas'

/** O que a prévia do desligar conta em cada módulo, na ordem da frase. */
const ITENS_DO_EFEITO: Record<NomeDoModulo, ItemDoEfeito[]> = {
  CLINICA: ['agendamentosFuturos', 'internacoesAbertas'],
  HOTEL: ['reservasFuturas', 'hospedagensAbertas'],
}

/** Códigos de `bloqueioAoLigar` que não viram texto: já ligado, ou o "só o dono" (que tem o dele). */
const BLOQUEIOS_SEM_TEXTO = new Set(['MODULO_JA_ATIVO', 'MODULO_GERENCIAR_APENAS_DONO'])

/** Pedir de novo o que já foi pedido ou ligado: o estado na tela ficou velho. */
const CODIGOS_DE_ESTADO_VELHO = new Set(['MODULO_JA_SOLICITADO', 'MODULO_JA_ATIVO'])

const { t, locale } = useI18n()
const toast = useToast()
const { store, ensureContext, parceiroQuery } = useParceiroPortal()

const ocupado = ref<{ modulo: NomeDoModulo; acao: Acao } | null>(null)
const confirmacaoAberta = ref(false)
const confirmando = ref<{ modulo: NomeDoModulo; efeito: EfeitoDoDesligar | null } | null>(null)

const intl = computed(() => INTL_LOCALE[locale.value as Locale])

function formatarData(iso: string) {
  return new Date(iso).toLocaleDateString(intl.value, { day: 'numeric', month: 'long' })
}

function nomeDo(modulo: NomeDoModulo) {
  return t(`inicio.modulos.${modulo}.nome`)
}

function dicaDe(modulo: ModuloDoPortal, ligar: Linha['ligar']) {
  if (modulo.bloqueioAoLigar === 'MODULO_GERENCIAR_APENAS_DONO') {
    return t('inicio.modulos.soDonoGerencia')
  }

  if (ligar === 'TESTE_GRATIS') {
    return t('inicio.modulos.ligarTesteDica', { dias: modulo.diasDeTesteGratis })
  }

  const codigo = modulo.bloqueioAoLigar

  if (!codigo || BLOQUEIOS_SEM_TEXTO.has(codigo)) {
    return ''
  }

  /* Fora da categoria vem com o "Pedir o módulo" ao lado. Já pedido, o texto mandaria pedir de
     novo o que está com a equipe: a frase "O pedido está com a equipe PetJourney." basta. */
  if (codigo === 'MODULO_FORA_DA_CATEGORIA' && !modulo.podeSolicitar) {
    return ''
  }

  /* Pedido em análise (o pedido refeito depois de uma recusa, por exemplo): "suspendeu, recusou ou
     desligou" e "fale com a equipe" contradizem a frase do pedido. Só o cadastro não aprovado
     continua, porque é ele que segura o pedido. */
  if (modulo.status === 'SOLICITADO' && codigo !== 'PARCEIRO_NAO_OPERACIONAL') {
    return ''
  }

  return t(`inicio.modulos.bloqueio.${codigo}`)
}

function linhaDe(modulo: ModuloDoPortal): Linha | null {
  const ligar = modulo.podeLigar ? modulo.ligarVira : null
  const pedir = modulo.podeSolicitar && !ligar
  const base = {
    modulo: modulo.modulo,
    icone: ICONE[modulo.modulo],
    dica: dicaDe(modulo, ligar),
    sugerido:
      (pedir || ligar === 'TESTE_GRATIS') && (store.eu?.elegiveis.includes(modulo.modulo) ?? false),
    ligar,
    diasDeTesteGratis: modulo.diasDeTesteGratis,
    desligar: modulo.podeDesligar,
    pedir,
  }

  if (ligar === 'RELIGAR') {
    return {
      ...base,
      selo: 'somenteLeitura',
      frase: modulo.ativoAte
        ? t('inicio.modulos.desligadoPorVoceAte', { data: formatarData(modulo.ativoAte) })
        : t('inicio.modulos.desligadoPorVoce'),
    }
  }

  if (modulo.podeLer && !modulo.podeEscrever && modulo.motivoSomenteLeitura) {
    return {
      ...base,
      selo: 'somenteLeitura',
      frase: t(`inicio.modulos.somenteLeitura.${modulo.motivoSomenteLeitura}`),
    }
  }

  if (modulo.status === 'TESTE' && modulo.ativoAte) {
    return {
      ...base,
      selo: 'teste',
      frase: t('inicio.modulos.teste', { data: formatarData(modulo.ativoAte) }),
    }
  }

  if (modulo.status === 'SOLICITADO') {
    return { ...base, selo: 'solicitado', frase: t('inicio.modulos.solicitado') }
  }

  if (ligar || pedir || base.desligar) {
    return { ...base, selo: null, frase: t(`inicio.modulos.${modulo.modulo}.descricao`) }
  }

  return null
}

const linhas = computed(() =>
  (store.eu?.modulos ?? []).map(linhaDe).filter((linha): linha is Linha => linha !== null),
)

const SELO: Record<Selo, { classe: string; icone: string }> = {
  solicitado: { classe: 'ui-selo--lugar', icone: 'ph ph-hourglass' },
  teste: { classe: 'ui-selo--lugar', icone: 'ph ph-flask' },
  somenteLeitura: { classe: 'ui-selo--atencao', icone: 'ph ph-eye' },
}

function rotuloDoLigar(linha: Linha) {
  return linha.ligar === 'TESTE_GRATIS'
    ? t('inicio.modulos.ligarTeste', { dias: linha.diasDeTesteGratis })
    : t('inicio.modulos.religar')
}

function carregando(linha: Linha, acao: Acao) {
  return ocupado.value?.modulo === linha.modulo && ocupado.value.acao === acao
}

/** A `message` da API já vem no idioma da sessão; `codigo` e status só decidem se o contexto é relido. */
async function avisarFalha(err: unknown, releContexto: boolean) {
  toast.add({
    severity: 'error',
    summary: t('inicio.modulos.erro'),
    detail: err instanceof Error ? err.message : undefined,
    life: 6000,
  })

  if (releContexto) {
    await ensureContext(true)
  }
}

/** Ligar e desligar: qualquer 409 quer dizer que o estado na tela ficou velho. */
function eh409(err: unknown) {
  return err instanceof ApiError && err.statusCode === 409
}

async function pedir(modulo: NomeDoModulo) {
  ocupado.value = { modulo, acao: 'pedir' }

  try {
    await solicitarModulo(modulo, parceiroQuery())
    toast.add({
      severity: 'success',
      summary: t('inicio.modulos.pedidoEnviado'),
      detail: t('inicio.modulos.pedidoEnviadoDetalhe'),
      life: 4000,
    })
    await ensureContext(true)
  } catch (err) {
    await avisarFalha(
      err,
      err instanceof ApiError && Boolean(err.codigo && CODIGOS_DE_ESTADO_VELHO.has(err.codigo)),
    )
  } finally {
    ocupado.value = null
  }
}

async function ligar(modulo: NomeDoModulo) {
  ocupado.value = { modulo, acao: 'ligar' }

  try {
    const ligado = await ligarModulo(modulo, parceiroQuery())

    toast.add({
      severity: 'success',
      summary:
        ligado.acao === 'TESTE_GRATIS'
          ? t('inicio.modulos.ligadoTeste', {
              modulo: nomeDo(modulo),
              data: ligado.ativoAte ? formatarData(ligado.ativoAte) : '',
            })
          : t(`inicio.modulos.religado.${modulo}`, { modulo: nomeDo(modulo) }),
      life: 4000,
    })
    await ensureContext(true)
  } catch (err) {
    await avisarFalha(err, eh409(err))
  } finally {
    ocupado.value = null
  }
}

/** "Desligar" pede a prévia e abre a confirmação. Sem a prévia, a confirmação vai sem os números. */
async function confirmarDesligar(modulo: NomeDoModulo) {
  ocupado.value = { modulo, acao: 'desligar' }
  let efeito: EfeitoDoDesligar | null = null

  try {
    efeito = await efeitoDoDesligar(modulo, parceiroQuery())
  } catch {
    efeito = null
  } finally {
    ocupado.value = null
  }

  confirmando.value = { modulo, efeito }
  confirmacaoAberta.value = true
}

async function desligar() {
  const alvo = confirmando.value

  if (!alvo) {
    return
  }

  ocupado.value = { modulo: alvo.modulo, acao: 'desligar' }

  try {
    await desligarModulo(alvo.modulo, parceiroQuery())
    toast.add({
      severity: 'success',
      summary: t(`inicio.modulos.desligado.${alvo.modulo}`, { modulo: nomeDo(alvo.modulo) }),
      life: 4000,
    })
    await ensureContext(true)
  } catch (err) {
    await avisarFalha(err, eh409(err))
  } finally {
    ocupado.value = null
  }
}

const tituloDaConfirmacao = computed(() =>
  confirmando.value
    ? t(`inicio.modulos.confirmarDesligar.titulo.${confirmando.value.modulo}`, {
        modulo: nomeDo(confirmando.value.modulo),
      })
    : '',
)

/*
 * `Intl.ListFormat` é ES2021: o tsconfig dos testes fica no `lib` padrão, sem ele, e este componente
 * entra lá pelo teste. O tipo vem daqui; o navegador tem a classe.
 */
type ListaDoIntl = new (
  idioma: string,
  opcoes: { type: 'conjunction' },
) => { format(itens: string[]): string }

/** "Ficam só para consulta: 3 agendamentos futuros e 1 internação em andamento." Só os maiores que zero. */
const fraseDoEfeito = computed(() => {
  const efeito = confirmando.value?.efeito

  if (!efeito) {
    return ''
  }

  const partes = ITENS_DO_EFEITO[efeito.modulo]
    .filter((campo) => efeito[campo] > 0)
    .map((campo) =>
      t(`inicio.modulos.confirmarDesligar.itens.${campo}`, { n: efeito[campo] }, efeito[campo]),
    )

  if (!partes.length) {
    return t('inicio.modulos.confirmarDesligar.nada')
  }

  const { ListFormat } = Intl as unknown as { ListFormat: ListaDoIntl }
  const itens = new ListFormat(intl.value, { type: 'conjunction' }).format(partes)

  return t('inicio.modulos.confirmarDesligar.ficam', { itens })
})

const temInternado = computed(() => (confirmando.value?.efeito?.internacoesAbertas ?? 0) > 0)
</script>

<template>
  <section v-if="linhas.length" class="modulos" :aria-label="t('inicio.modulos.rotulo')">
    <ul class="ui-lista ui-folha">
      <li v-for="linha in linhas" :key="linha.modulo" class="ui-linha modulo">
        <span class="ui-ladrilho ui-ladrilho--lugar" aria-hidden="true">
          <component :is="linha.icone" :size="20" weight="duotone" />
        </span>

        <span class="ui-linha__texto">
          <span class="ui-linha__titulo modulo__nome">
            {{ nomeDo(linha.modulo) }}
            <span v-if="linha.sugerido" class="ui-selo ui-selo--contorno">
              {{ t('inicio.modulos.sugerido') }}
            </span>
          </span>
          <span class="ui-linha__meta">{{ linha.frase }}</span>
          <span v-if="linha.dica" class="ui-linha__meta modulo__dica">{{ linha.dica }}</span>
        </span>

        <span class="ui-linha__fim modulo__fim">
          <span v-if="linha.selo" class="ui-selo" :class="SELO[linha.selo].classe">
            <i :class="SELO[linha.selo].icone" aria-hidden="true" />
            {{ t(`inicio.modulos.selo.${linha.selo}`) }}
          </span>
          <Button
            v-if="linha.ligar"
            type="button"
            icon="ph ph-power"
            :label="rotuloDoLigar(linha)"
            size="small"
            :loading="carregando(linha, 'ligar')"
            :disabled="ocupado !== null"
            @click="ligar(linha.modulo)"
          />
          <Button
            v-if="linha.desligar"
            type="button"
            icon="ph ph-power"
            :label="t('inicio.modulos.desligar')"
            severity="secondary"
            outlined
            size="small"
            :loading="carregando(linha, 'desligar')"
            :disabled="ocupado !== null"
            @click="confirmarDesligar(linha.modulo)"
          />
          <Button
            v-if="linha.pedir"
            type="button"
            icon="ph ph-paper-plane-tilt"
            :label="t('inicio.modulos.pedir')"
            severity="secondary"
            outlined
            size="small"
            :loading="carregando(linha, 'pedir')"
            :disabled="ocupado !== null"
            @click="pedir(linha.modulo)"
          />
        </span>
      </li>
    </ul>

    <ConfirmActionDialog
      v-model:visible="confirmacaoAberta"
      :title="tituloDaConfirmacao"
      :confirm-label="t('inicio.modulos.confirmarDesligar.confirmar')"
      :cancel-label="t('common.cancel')"
      severity="danger"
      @confirm="desligar"
    >
      <div class="desligar">
        <p>{{ t('inicio.modulos.confirmarDesligar.texto') }}</p>
        <p v-if="fraseDoEfeito" class="desligar__efeito">{{ fraseDoEfeito }}</p>
        <p v-if="temInternado" class="desligar__internado" role="note">
          <i class="ph ph-warning" aria-hidden="true" />
          <span>{{ t('inicio.modulos.confirmarDesligar.internado') }}</span>
        </p>
        <p>{{ t('inicio.modulos.confirmarDesligar.fim') }}</p>
      </div>
    </ConfirmActionDialog>
  </section>
</template>

<style scoped>
.modulos {
  display: grid;
}

.modulo__nome {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.modulo__dica {
  font-size: 12.5px;
}

.modulo__fim {
  flex-wrap: wrap;
  justify-content: flex-end;
}

/* O corpo da confirmação usa as cores do próprio diálogo (`--confirm-*`), legíveis nos dois temas. */
.desligar {
  display: grid;
  gap: 10px;
  color: var(--confirm-muted);
  font-size: 0.92rem;
  line-height: 1.55;
}

.desligar p {
  margin: 0;
}

.desligar__efeito {
  color: var(--confirm-text);
  font-weight: 600;
}

.desligar__internado {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 12px;
  background: var(--atencao-fundo);
  color: var(--atencao-tinta);
  font-weight: 600;
}

.desligar__internado i {
  flex: none;
  margin-top: 2px;
  font-size: 18px;
}

@media (max-width: 40rem) {
  .modulo {
    flex-wrap: wrap;
  }
}
</style>
