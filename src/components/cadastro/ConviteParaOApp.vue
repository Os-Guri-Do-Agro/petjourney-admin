<script setup lang="ts">
/**
 * O convite para o app (pedido 4 do guia `pedidos-luis-17-11.md`): um convite só, com link e
 * código juntos, que a recepção manda pelo WhatsApp com a mensagem pronta da API ou mostra como QR
 * no balcão. Vale 7 dias, e vale o último: um convite novo cancela os pendentes do mesmo cliente que
 * só tinham pacientes dele (`canceladas`).
 *
 * - Entram o paciente da tela e os outros do mesmo cliente, ativos e sem vínculo.
 * - `criarAoAbrir` (a gaveta da ficha): o convite nasce ao montar. Sem ele (o fim do cadastro), nasce
 *   na primeira ação: "Agora não" não deixa convite à toa nem cancela o que o cliente já tinha.
 * - "Enviar por e-mail" é outro convite (`EMAIL`): o link aberto aqui deixa de valer.
 * - O QR é desenhado no navegador a partir do `link`. O portal não monta a mensagem.
 * - "Outras formas", recolhido: o QR da carteirinha do pet. O texto do QR (lido pela câmera,
 *   pelo leitor de mão ou colado) vai como veio para a API, que devolve o slug da carteirinha
 *   (`resolverCarteirinha`, N19), e o slug segue para a proposta pelo QR.
 *
 * Erros: a `message` da API, que já vem traduzida; o `codigo` só decide o que fazer.
 */
import Button from 'primevue/button'
import Drawer from 'primevue/drawer'
import InputText from 'primevue/inputtext'
import Skeleton from 'primevue/skeleton'
import { useToast } from 'primevue/usetoast'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { lerErroDoCadastro, type ErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useRotulosDoCadastro } from '@/components/cadastro/useRotulosDoCadastro'
import { imagemDoQr } from '@/components/parceiro/estabelecimento/qr-da-pagina'
import { useLeitorDeQr } from '@/composables/useLeitorDeQr'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { ApiError } from '@/service/api'
import { resolverCarteirinha } from '@/service/parceiro/carteirinha-service'
import type { Paciente } from '@/service/parceiro/pacientes-service'
import {
  codigoEmBlocos,
  pacientesDoConvite,
  proporPorQr,
  proporVinculo,
  type PropostaCriada,
} from '@/service/parceiro/vinculo-service'

const props = withDefaults(defineProps<{ paciente: Paciente; criarAoAbrir?: boolean }>(), {
  criarAoAbrir: false,
})

/** Algo mudou na API (convite novo, ou um paciente que já não podia entrar): a ficha lê de novo. */
const emit = defineEmits<{ mudou: [] }>()

const { t } = useI18n()
const toast = useToast()
const { store, parceiroQuery } = useParceiroPortal()
const rotulos = useRotulosDoCadastro()

/** O paciente mudou na API desde que a tela abriu: a lista de quem entra precisa ser lida de novo. */
const CODIGOS_DE_DADO_MUDADO = new Set([
  'VINCULO_JA_ATIVO',
  'PACIENTE_INATIVO',
  'VINCULO_INCOMPLETO',
])

/* -------------------------------------------------------------------- quem entra */

const pacientes = ref<{ id: string; nome: string }[]>([])
let leitura: Promise<{ id: string; nome: string }[]> | null = null

function quemEntra() {
  leitura ??= pacientesDoConvite(props.paciente, parceiroQuery()).then((lista) => {
    pacientes.value = lista
    return lista
  })

  return leitura
}

/*
 * `Intl.ListFormat` é ES2021: o tsconfig dos testes (`tsconfig.vitest.json`) fica no `lib` padrão,
 * sem ele, e este componente entra lá pelo teste. O tipo vem daqui; o navegador tem a classe.
 */
type ListaDoIntl = new (
  idioma: string,
  opcoes: { type: 'conjunction' },
) => { format(itens: string[]): string }

const nomes = computed(() => {
  const lista = pacientes.value.length ? pacientes.value.map((p) => p.nome) : [props.paciente.nome]
  const { ListFormat } = Intl as unknown as { ListFormat: ListaDoIntl }

  return new ListFormat(rotulos.intl(), { type: 'conjunction' }).format(lista)
})

/* ------------------------------------------------------------- o convite por link */

const proposta = ref<PropostaCriada | null>(null)
const criando = ref(false)
const erro = ref<ErroDoCadastro | null>(null)
/** A ação que espera o convite nascer, para o botão dela girar. */
const esperando = ref<'whatsapp' | 'qr' | 'copiar' | null>(null)
let criacao: Promise<PropostaCriada | null> | null = null

function avisarSeMudou(lido: ErroDoCadastro) {
  if (!CODIGOS_DE_DADO_MUDADO.has(lido.codigo)) return
  leitura = null
  emit('mudou')
}

async function criar(): Promise<PropostaCriada | null> {
  criando.value = true
  erro.value = null

  try {
    const lista = await quemEntra()
    const criada = await proporVinculo(
      props.paciente.cliente.id,
      lista.map((p) => p.id),
      'LINK',
      parceiroQuery(),
    )

    proposta.value = criada
    emit('mudou')
    return criada
  } catch (err) {
    const lido = lerErroDoCadastro(err, t('cadastro.erros.salvar'))

    erro.value = lido
    avisarSeMudou(lido)
    return null
  } finally {
    criando.value = false
  }
}

/** O convite que já está aberto, ou um novo; `null` quando a API recusou (o erro fica na tela). */
function garantir() {
  if (proposta.value) return Promise.resolve(proposta.value)
  criacao ??= criar().finally(() => (criacao = null))

  return criacao
}

async function comConvite(acao: NonNullable<typeof esperando.value>) {
  esperando.value = acao

  try {
    return await garantir()
  } finally {
    esperando.value = null
  }
}

onMounted(() => {
  void quemEntra()
  if (props.criarAoAbrir) void garantir()
})

const ocupado = computed(() => criando.value || enviandoEmail.value)
/**
 * Não adianta tentar de novo: o teto do dia, e o pet que já está no app quando ele é o único do
 * convite (a releitura só tira outro pet da lista; o desta ficha sempre entra e daria o mesmo 409).
 */
const podeTentarDeNovo = computed(() => {
  const codigo = erro.value?.codigo
  if (codigo === 'PROPOSTA_TETO_DIARIO') return false
  return !(codigo === 'VINCULO_JA_ATIVO' && pacientes.value.length <= 1)
})

function validade(convite: PropostaCriada) {
  return t('cadastro.convite.validade', {
    data: new Date(convite.expiraEm).toLocaleString(rotulos.intl(), {
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    }),
  })
}

const codigo = computed(() => (proposta.value?.codigo ? codigoEmBlocos(proposta.value.codigo) : ''))

/* ---------------------------------------------------------------------- as ações */

async function whatsapp() {
  const convite = await comConvite('whatsapp')
  if (convite?.whatsappUrl) window.open(convite.whatsappUrl, '_blank', 'noopener')
}

async function copiar() {
  const convite = await comConvite('copiar')
  if (!convite?.mensagem) return

  try {
    await navigator.clipboard.writeText(convite.mensagem)
    toast.add({ severity: 'success', summary: t('cadastro.convite.copiado'), life: 2500 })
  } catch {
    toast.add({ severity: 'warn', summary: t('divulgacao.toast.copyFail'), life: 5000 })
  }
}

/* --------------------------------------------------------------- o QR em tela cheia */

const qrAberto = ref(false)
const qrImagem = ref('')

async function mostrarQr() {
  const convite = await comConvite('qr')
  if (!convite?.link) return

  qrImagem.value = await imagemDoQr(convite.link, 720)
  qrAberto.value = true
}

/*
 * O QR abre por cima da gaveta do convite, e cada Drawer do PrimeVue fecha no Escape por um
 * ouvinte no `document`: um Escape fechava os dois. Na ficha, a gaveta fechada perde o convite
 * (abrir de novo cria outro, e o que já foi pelo WhatsApp deixa de valer). Com o QR aberto, o
 * Escape é pego antes, na captura da `window`, e fecha só o QR.
 */
function escapeFechaSoOQr(evento: KeyboardEvent) {
  if (!qrAberto.value || (evento.key !== 'Escape' && evento.code !== 'Escape')) return
  evento.stopPropagation()
  qrAberto.value = false
}

watch(qrAberto, (aberto) => {
  if (aberto) window.addEventListener('keydown', escapeFechaSoOQr, true)
  else window.removeEventListener('keydown', escapeFechaSoOQr, true)
})

onUnmounted(() => window.removeEventListener('keydown', escapeFechaSoOQr, true))

/** Uma folha simples, em uma janela própria, para entregar no balcão. */
function imprimir() {
  const convite = proposta.value
  if (!convite || !qrImagem.value || !codigo.value) return

  const janela = window.open('', '_blank', 'width=640,height=820')
  if (!janela) return

  const escapar = (texto: string) =>
    texto.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
  const raiz = document.documentElement

  janela.document
    .write(`<!doctype html><html lang="${raiz.lang || 'pt-BR'}" dir="${raiz.dir || 'ltr'}"><head><meta charset="utf-8">
<title>${escapar(t('cadastro.convite.titulo'))}</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 40px; color: #10302a; text-align: center; }
  h1 { font-size: 24px; margin: 0 0 20px; }
  img { width: 80mm; height: 80mm; }
  .codigo { font: 700 44px/1.1 ui-monospace, monospace; letter-spacing: 0.12em; margin: 16px 0 20px; }
  p { max-width: 150mm; margin: 8px auto; font-size: 16px; line-height: 1.5; }
  .pe { margin-top: 24px; font-size: 13px; color: #4a5a55; }
</style></head><body>
<h1>${escapar(store.parceiroNome)}</h1>
<img src="${qrImagem.value}" alt="">
<div class="codigo" dir="ltr">${escapar(codigo.value)}</div>
<p>${escapar(t('cadastro.convite.folha', { codigo: codigo.value }))}</p>
<p class="pe">${escapar(validade(convite))}</p>
</body></html>`)
  janela.document.close()

  const imagem = janela.document.querySelector('img')
  void (imagem ? imagem.decode().catch(() => undefined) : Promise.resolve()).then(() => {
    janela.focus()
    janela.print()
  })
}

/* --------------------------------------------------------------------- por e-mail */

const email = computed(() => props.paciente.cliente.email ?? '')
const semEmail = ref(false)
const enviandoEmail = ref(false)
const erroDoEmail = ref('')
const porEmail = ref<PropostaCriada | null>(null)

async function enviarEmail() {
  enviandoEmail.value = true
  erroDoEmail.value = ''

  try {
    const lista = await quemEntra()

    porEmail.value = await proporVinculo(
      props.paciente.cliente.id,
      lista.map((p) => p.id),
      'EMAIL',
      parceiroQuery(),
    )
    emit('mudou')
  } catch (err) {
    const lido = lerErroDoCadastro(err, t('cadastro.erros.salvar'))

    erroDoEmail.value = lido.mensagem
    if (lido.codigo === 'CLIENTE_SEM_EMAIL') semEmail.value = true
    avisarSeMudou(lido)
  } finally {
    enviandoEmail.value = false
  }
}

/* ------------------------------------------------- outras formas: QR da carteirinha */

const outrasAbertas = ref(false)
const qr = ref('')
const tentouQr = ref(false)
const enviandoQr = ref(false)
const qrEnviado = ref(false)
const erroDoQr = ref('')

const qrVazio = computed(() => !qr.value.trim())

/** O 429 da leitura do QR diz quanto esperar; a `message` da API só diz "daqui a pouco". */
function mensagemDoQr(err: unknown, lido: ErroDoCadastro) {
  if (err instanceof ApiError && err.codigo === 'CARTEIRINHA_TAXA_EXCEDIDA') {
    const segundos = Math.ceil(Number(err.detalhes.tenteDeNovoEmSegundos))

    if (segundos > 0) return t('cadastro.vinculo.erros.taxaDoQr', { segundos }, segundos)
  }

  return lido.mensagem
}

/**
 * O texto do QR vai como veio: a API sabe ler o link curto, só o código e o link antigo, e
 * devolve o slug da carteirinha. QR que não é de carteirinha (ou de pet inativo, de ONG) volta
 * 404 com a `message` traduzida, o mesmo para todos.
 */
async function enviarPeloQr() {
  tentouQr.value = true
  erroDoQr.value = ''
  if (qrVazio.value || enviandoQr.value) return

  enviandoQr.value = true

  try {
    const { publicSlug } = await resolverCarteirinha(qr.value, parceiroQuery())

    await proporPorQr(publicSlug, props.paciente.id, parceiroQuery())
    qrEnviado.value = true
    emit('mudou')
  } catch (err) {
    const lido = lerErroDoCadastro(err, t('cadastro.erros.salvar'))

    erroDoQr.value = mensagemDoQr(err, lido)
    avisarSeMudou(lido)
  } finally {
    enviandoQr.value = false
  }
}

/* A câmera, onde o navegador lê QR: o que ela leu entra no campo e segue para o pedido. */
const {
  disponivel: cameraDisponivel,
  ligada: cameraLigada,
  abrindo: cameraAbrindo,
  problema: problemaDaCamera,
  video: videoDaCamera,
  ligar: ligarCamera,
  desligar: desligarCamera,
} = useLeitorDeQr((texto) => {
  qr.value = texto
  void enviarPeloQr()
})

watch(outrasAbertas, (abertas) => {
  if (!abertas) desligarCamera()
})
</script>

<template>
  <div class="cv">
    <p class="eg__dica">{{ t('cadastro.convite.lede', { pets: nomes }) }}</p>

    <!-- Foi por e-mail: o link desta tela deixou de valer, então as ações dele saem. -->
    <template v-if="porEmail">
      <p class="cv__feito" role="status">
        <i class="ph ph-check-circle" aria-hidden="true" />
        <span>{{ t('cadastro.vinculo.emailEnviado', { email }) }}</span>
      </p>
      <p class="cv__info">
        <i class="ph ph-clock" aria-hidden="true" />
        <span>{{ validade(porEmail) }}</span>
      </p>
      <p v-if="porEmail.canceladas > 0" class="eg__aviso">
        <i class="ph ph-info" aria-hidden="true" />
        <span>{{ t('cadastro.convite.anteriorCancelado') }}</span>
      </p>
    </template>

    <template v-else>
      <div v-if="erro" class="cv__erro" role="alert">
        <p class="eg__erro">
          <i class="ph ph-warning-circle" aria-hidden="true" />
          <span>{{ erro.mensagem }}</span>
        </p>
        <Button
          v-if="podeTentarDeNovo"
          type="button"
          size="small"
          severity="secondary"
          outlined
          icon="ph ph-arrow-clockwise"
          :label="t('cadastro.tentarDeNovo')"
          :loading="criando"
          @click="garantir"
        />
      </div>

      <div v-else class="cv__acoes" :aria-busy="criando">
        <Button
          type="button"
          icon="ph ph-whatsapp-logo"
          :label="t('cadastro.convite.whatsapp')"
          class="cv__principal"
          :disabled="ocupado && esperando !== 'whatsapp'"
          :loading="esperando === 'whatsapp'"
          @click="whatsapp"
        />
        <Button
          type="button"
          severity="secondary"
          outlined
          icon="ph ph-qr-code"
          :label="t('cadastro.convite.mostrarQr')"
          :disabled="ocupado && esperando !== 'qr'"
          :loading="esperando === 'qr'"
          @click="mostrarQr"
        />
        <div class="cv__secundarias">
          <Button
            type="button"
            size="small"
            severity="secondary"
            outlined
            icon="ph ph-copy"
            :label="t('cadastro.convite.copiar')"
            :disabled="ocupado && esperando !== 'copiar'"
            :loading="esperando === 'copiar'"
            @click="copiar"
          />
          <Button
            v-if="email && !semEmail"
            type="button"
            size="small"
            severity="secondary"
            outlined
            icon="ph ph-envelope-simple"
            :label="t('cadastro.convite.email')"
            :disabled="ocupado"
            :loading="enviandoEmail"
            @click="enviarEmail"
          />
        </div>
      </div>

      <p v-if="proposta" class="cv__info">
        <i class="ph ph-clock" aria-hidden="true" />
        <span>{{ validade(proposta) }}</span>
      </p>
      <Skeleton v-else-if="criarAoAbrir && criando" width="14rem" height="1.1rem" />

      <p v-if="proposta && proposta.canceladas > 0" class="eg__aviso">
        <i class="ph ph-info" aria-hidden="true" />
        <span>{{ t('cadastro.convite.anteriorCancelado') }}</span>
      </p>

      <p v-if="erroDoEmail" class="eg__erro" role="alert">
        <i class="ph ph-warning-circle" aria-hidden="true" />
        <span>{{ erroDoEmail }}</span>
      </p>
    </template>

    <!-- Outras formas, recolhidas: o QR da carteirinha do pet. -->
    <section class="cv__outras">
      <Button
        type="button"
        size="small"
        severity="secondary"
        outlined
        class="cv__recolher"
        :icon="outrasAbertas ? 'ph ph-caret-up' : 'ph ph-caret-down'"
        :label="t('cadastro.convite.outrasFormas')"
        :aria-expanded="outrasAbertas"
        aria-controls="cv-outras"
        @click="outrasAbertas = !outrasAbertas"
      />

      <div v-if="outrasAbertas" id="cv-outras" class="eg__secao">
        <label class="eg__rotulo" for="cv-qr">{{ t('cadastro.vinculo.qrRotulo') }}</label>
        <div class="cv__qr-campo">
          <!-- O leitor de QR de mão digita o texto e um Enter: o Enter manda o pedido. -->
          <InputText
            id="cv-qr"
            v-model="qr"
            autocomplete="off"
            spellcheck="false"
            :invalid="tentouQr && qrVazio"
            :disabled="enviandoQr || qrEnviado"
            @keydown.enter.prevent="enviarPeloQr"
          />
          <Button
            v-if="cameraDisponivel && !qrEnviado"
            type="button"
            severity="secondary"
            outlined
            icon="ph ph-camera"
            :label="t('cadastro.vinculo.camera.ler')"
            :loading="cameraAbrindo"
            :disabled="enviandoQr || cameraLigada"
            @click="ligarCamera"
          />
        </div>
        <small v-if="tentouQr && qrVazio" class="eg__invalido">
          {{ t('acessos.emergencia.qrProblema.vazio') }}
        </small>
        <small v-else class="eg__dica">{{
          cameraDisponivel ? t('cadastro.vinculo.qrDicaCamera') : t('cadastro.vinculo.qrDica')
        }}</small>

        <div v-if="cameraLigada" class="cv__camera">
          <video
            ref="videoDaCamera"
            class="cv__video"
            muted
            playsinline
            :aria-label="t('cadastro.vinculo.camera.mire')"
          />
          <p class="cv__mire">
            <i class="ph ph-scan" aria-hidden="true" />
            <span>{{ t('cadastro.vinculo.camera.mire') }}</span>
          </p>
          <Button
            type="button"
            size="small"
            severity="secondary"
            outlined
            icon="ph ph-x"
            :label="t('cadastro.vinculo.camera.fechar')"
            @click="desligarCamera"
          />
        </div>
        <p v-if="problemaDaCamera" class="eg__aviso" role="status">
          <i class="ph ph-video-camera-slash" aria-hidden="true" />
          <span>{{ t(`cadastro.vinculo.camera.${problemaDaCamera}`) }}</span>
        </p>

        <p v-if="qrEnviado" class="cv__feito" role="status">
          <i class="ph ph-check-circle" aria-hidden="true" />
          <span>{{ t('cadastro.vinculo.qrEnviado') }}</span>
        </p>
        <Button
          v-else
          type="button"
          size="small"
          severity="secondary"
          outlined
          icon="ph ph-paper-plane-tilt"
          class="cv__enviar-qr"
          :label="t('cadastro.vinculo.enviarPedido')"
          :loading="enviandoQr"
          @click="enviarPeloQr"
        />
        <p v-if="erroDoQr" class="eg__erro" role="alert">
          <i class="ph ph-warning-circle" aria-hidden="true" />
          <span>{{ erroDoQr }}</span>
        </p>
      </div>
    </section>

    <!-- O QR em tela cheia, para virar a tela para o responsável no balcão. -->
    <Drawer v-model:visible="qrAberto" position="full" class="cv-qr" :header="store.parceiroNome">
      <div v-if="proposta" class="cv-qr__corpo">
        <div class="cv-qr__cartao">
          <img :src="qrImagem" alt="" class="cv-qr__imagem" />
        </div>
        <strong class="cv-qr__codigo ui-num"
          ><bdi dir="ltr">{{ codigo }}</bdi></strong
        >
        <p class="cv-qr__como">{{ t('cadastro.convite.folha', { codigo }) }}</p>
        <p class="cv-qr__validade">{{ validade(proposta) }}</p>
        <Button
          type="button"
          severity="secondary"
          outlined
          icon="ph ph-printer"
          :label="t('cadastro.convite.imprimir')"
          @click="imprimir"
        />
      </div>
    </Drawer>
  </div>
</template>

<style scoped>
.cv {
  display: grid;
  gap: 14px;
}

.cv__acoes {
  display: grid;
  gap: 10px;
}

.cv__principal {
  min-height: 46px;
  font-size: 15px;
}

.cv__secundarias {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.cv__secundarias .p-button {
  flex: 1 1 12rem;
}

.cv__erro {
  display: grid;
  justify-items: start;
  gap: 10px;
}

.cv__info {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
}

.cv__info i {
  font-size: 16px;
}

.cv__feito {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin: 0;
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--superficie-2);
  color: var(--tinta);
  font-size: 14px;
  line-height: 1.5;
}

.cv__feito i {
  margin-top: 2px;
  color: var(--ok-tinta);
  font-size: 18px;
}

.cv__outras {
  display: grid;
  gap: 12px;
  padding-top: 14px;
  border-top: 1px solid var(--linha);
}

.cv__recolher,
.cv__enviar-qr {
  justify-self: start;
}

.cv__qr-campo {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.cv__qr-campo .p-inputtext {
  min-width: 0;
  flex: 1 1 12rem;
}

/* O vídeo da câmera: fundo escuro nos dois temas, que é a cor de câmera ligada sem imagem. */
.cv__camera {
  display: grid;
  justify-items: start;
  gap: 10px;
}

.cv__video {
  display: block;
  width: 100%;
  max-width: 22rem;
  aspect-ratio: 4 / 3;
  border-radius: 12px;
  background: #10302a;
  object-fit: cover;
}

.cv__mire {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
}

.cv__mire i {
  font-size: 16px;
}

/* O QR em tela cheia: o cartão branco segura o contraste do QR nos dois temas. */
.cv-qr__corpo {
  display: grid;
  min-height: 100%;
  align-content: center;
  justify-items: center;
  gap: 14px;
  padding: 8px 16px 24px;
  text-align: center;
}

.cv-qr__cartao {
  display: grid;
  padding: 18px;
  place-items: center;
  border: 1px solid var(--linha);
  border-radius: 24px;
  background: #fff;
}

.cv-qr__imagem {
  display: block;
  width: min(50vh, 72vw, 28rem);
  height: auto;
  aspect-ratio: 1;
}

.cv-qr__codigo {
  color: var(--tinta);
  font-size: clamp(32px, 5vw, 48px);
  font-weight: 700;
  letter-spacing: 0.12em;
}

.cv-qr__como {
  max-width: 36rem;
  margin: 0;
  color: var(--tinta);
  font-size: 15px;
  line-height: 1.5;
}

.cv-qr__validade {
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
}
</style>
