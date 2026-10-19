<script setup lang="ts">
/**
 * Pedidos de horário — o agendamento online visto da recepção.
 *
 * O responsável pede pelo app ou pelo link da clínica, por dois caminhos: escolhendo dia, horário
 * e profissional na agenda que a clínica abre, ou dizendo quando pode e deixando a clínica marcar
 * no melhor horário. Os dois chegam aqui, e alguém da casa responde. Cada resposta vira, na mesma
 * gravação, um atendimento na agenda (com a origem do pedido à vista) e um aviso para quem pediu.
 *
 * A ordem da lista é a do prazo prometido, não a de chegada: "respondemos em até 4 h" conta só o
 * expediente, e o pedido da noite vence no meio da manhã. O que já foi respondido mora recolhido
 * embaixo — histórico, não trabalho.
 *
 * Responder mora numa gaveta ao lado da caixa, não num diálogo no meio dela: a linha aberta fica
 * tingida, o calendário do pedido aparece na gaveta, e a lista continua à vista. A linha só tem o
 * que decide a triagem — o dia e a hora pedidos em destaque, quem, o quê, o prazo contando e o
 * botão. Em cima, a frase de estado diz quantos esperam e quando vence o próximo; as ações do
 * cabeçalho são só configuração (o link e o "Configurar") e a prévia do celular.
 *
 * O celular do responsável abre numa gaveta que empurra a página: dá para pedir lá e ver a linha
 * chegar aqui, ou responder aqui e ver o aviso chegar lá. É a demonstração inteira em meio minuto.
 * As duas gavetas moram do mesmo lado; abrir a de resposta guarda o celular, e fechá-la o devolve.
 */
import Button from 'primevue/button'
import Drawer from 'primevue/drawer'
import InputText from 'primevue/inputtext'
import Popover from 'primevue/popover'
import SelectButton from 'primevue/selectbutton'
import ToggleSwitch from 'primevue/toggleswitch'
import { useToast } from 'primevue/usetoast'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRouter } from 'vue-router'

import UiPagina from '@/components/ui/UiPagina.vue'
import UiSecao from '@/components/ui/UiSecao.vue'
import { useSidePanelOffset } from '@/composables/useSidePanelOffset'
import { useTelaLarga } from '@/composables/useTelaLarga'
import PetAvatar from '@/features/hotel/components/base/PetAvatar.vue'
import AgendamentoOnlineGaveta from '@/features/clinico/components/pedidos/AgendamentoOnlineGaveta.vue'
import AgendarNoApp from '@/features/clinico/components/pedidos/AgendarNoApp.vue'
import PedidoGaveta from '@/features/clinico/components/pedidos/PedidoGaveta.vue'
import PedidoLinha from '@/features/clinico/components/pedidos/PedidoLinha.vue'
import { useClinicFormat } from '@/features/clinico/composables/useClinicFormat'
import { useRotulosDoPedido } from '@/features/clinico/composables/useRotulosDoPedido'
import {
  disputarProximaReserva,
  pedidoRepository,
  reservaVaiSerDisputada,
  type PedidoNaCaixa,
} from '@/features/clinico/data/agendamento-online'
import { RESPONSAVEL_DA_DEMONSTRACAO } from '@/features/clinico/data/seed-responsavel'
import { RESPONSAVEL_SEM_VINCULO } from '@/features/clinico/data/seed-pedidos'
import type { AgendamentoOnline, MotivoDaRecusaDoPedido } from '@/features/clinico/data/types'
import { clinicClock, useClinicoStore } from '@/features/clinico/stores/clinico'
import { usePedidosStore } from '@/features/clinico/stores/pedidos'

const { t } = useI18n()
const router = useRouter()
const toast = useToast()
const clinico = useClinicoStore()
const pedidos = usePedidosStore()
const formato = useClinicFormat()
const rotulos = useRotulosDoPedido()

async function carregar() {
  await clinico.carregar()
  await pedidos.carregar()
}

onMounted(carregar)

// ------------------------------------------------------------------ a frase de cima

/** Quantos esperam, quantos passaram do prazo, e quando vence o próximo. */
const fraseDoResumo = computed(() => {
  if (!pedidos.carregado) {
    return ''
  }

  const total = pedidos.abertas.length

  if (total === 0) {
    return t('clinico.pedidos.resumo.nenhum')
  }

  const abertos = t('clinico.pedidos.resumo.abertos', { n: total }, total)

  if (pedidos.atrasadas > 0) {
    return t('clinico.pedidos.tela.resumo', {
      abertos,
      depois: t('clinico.pedidos.resumo.atrasados', { n: pedidos.atrasadas }, pedidos.atrasadas),
    })
  }

  const proximo = pedidos.abertas[0]!.pedidos[0]!.responderAte

  return t('clinico.pedidos.tela.resumo', {
    abertos,
    depois: t('clinico.pedidos.resumo.proximo', {
      quando:
        clinicClock.dateOf(proximo) === clinicClock.today()
          ? formato.hora(proximo)
          : rotulos.quando(proximo),
    }),
  })
})

const desligado = computed(() => pedidos.configuracao !== null && !pedidos.configuracao.ativo)

// ------------------------------------------------------------------ responder

/** A linha na gaveta, pela chave: a caixa relida traz a linha nova, e a respondida fecha a gaveta. */
const chaveEmResposta = ref<string | null>(null)

const emResposta = computed(
  () => pedidos.abertas.find((linha) => linha.chave === chaveEmResposta.value) ?? null,
)

/** O celular estava aberto quando a gaveta de resposta abriu: volta quando ela fechar. */
const celularGuardado = ref(false)

function abrirResposta(linha: PedidoNaCaixa) {
  if (chaveEmResposta.value === null && appAberto.value) {
    celularGuardado.value = true
    appAberto.value = false
  }

  chaveEmResposta.value = linha.chave
}

function fecharResposta() {
  chaveEmResposta.value = null

  if (celularGuardado.value) {
    celularGuardado.value = false
    appAberto.value = true
  }
}

async function aceitar(
  linha: PedidoNaCaixa,
  escolha: { professionalId: string; inicio: string } | null,
) {
  const deuCerto = await pedidos.aceitar(linha.chave, linha.pedidos[0]!.id, escolha)

  if (deuCerto && chaveEmResposta.value === linha.chave) {
    fecharResposta()
  }
}

async function recusar(payload: { motivo: MotivoDaRecusaDoPedido; mensagem: string }) {
  const linha = emResposta.value

  if (!linha) {
    return
  }

  const deuCerto = await pedidos.recusar(
    linha.chave,
    linha.pedidos[0]!.id,
    payload.motivo,
    payload.mensagem,
  )

  if (deuCerto) {
    fecharResposta()
  }
}

/** O que a última resposta fez, em uma linha — com o atalho para a agenda quando marcou. */
const resultado = computed(() => {
  const atual = pedidos.resultado

  if (!atual) {
    return null
  }

  if (atual.tipo === 'marcado') {
    const [primeiro] = atual.atendimentos

    if (!primeiro) {
      return null
    }

    return {
      tipo: 'marcado' as const,
      texto: t('clinico.pedidos.resultado.marcado', {
        pets: rotulos.nomes(atual.atendimentos.map((item) => clinico.pet(item.petId)?.nome ?? '')),
        quando: rotulos.quando(primeiro.inicio),
        profissional: clinico.profissional(primeiro.professionalId)?.nome ?? '',
      }),
      rota: `/veterinario/agenda?data=${clinicClock.dateOf(primeiro.inicio)}&foco=${primeiro.id}`,
    }
  }

  return {
    tipo: atual.tipo,
    /* O texto antigo do horário ocupado mandava a um botão "Outro horário" que não existe mais. */
    texto:
      atual.tipo === 'horario-ocupado'
        ? t('clinico.pedidos.tela.horarioOcupado')
        : t(`clinico.pedidos.resultado.${atual.tipo}`),
    rota: null,
  }
})

// ------------------------------------------------------------------ histórico

const historicoAberto = ref(false)

function fraseDoRespondido(linha: PedidoNaCaixa) {
  const pedido = linha.pedidos[0]!

  switch (pedido.status) {
    case 'aceito': {
      const parametros = {
        quando: linha.marcado ? rotulos.quando(linha.marcado.inicio) : '',
        profissional: linha.marcado
          ? (clinico.profissional(linha.marcado.professionalId)?.nome ?? '')
          : '',
      }

      return pedido.respondidoPor === 'automatico'
        ? t('clinico.pedidos.respondido.automatico', parametros)
        : t('clinico.pedidos.respondido.aceito', parametros)
    }
    case 'recusado':
      return t('clinico.pedidos.tela.recusado', {
        motivo: t(`clinico.pedidos.recusa.motivo.${pedido.recusa?.motivo ?? 'outro'}`),
      })
    default:
      return t(`clinico.pedidos.respondido.${pedido.status}`)
  }
}

/** O desfecho em cor e ícone: marcado é ok; perder o prazo sem resposta pede atenção. */
function tomDoRespondido(linha: PedidoNaCaixa) {
  switch (linha.pedidos[0]!.status) {
    case 'aceito':
      return { tom: 'ok', icone: 'ph-check-circle' }
    case 'recusado':
      return { tom: 'neutro', icone: 'ph-x-circle' }
    case 'expirado':
      return { tom: 'atencao', icone: 'ph-clock-countdown' }
    default:
      return { tom: 'neutro', icone: 'ph-arrow-u-up-left' }
  }
}

function petsDa(linha: PedidoNaCaixa) {
  return linha.pedidos.map((pedido) => {
    const pet = pedido.petId ? clinico.pet(pedido.petId) : null
    const nome = pet?.nome ?? pedido.novoCadastro?.petNome ?? ''

    return {
      id: pedido.id,
      nome,
      iniciais: pet?.iniciais ?? nome.slice(0, 2).toUpperCase(),
      especie: pet?.especie ?? pedido.novoCadastro?.especie ?? null,
      fotoUrl: pet?.fotoUrl ?? '',
    }
  })
}

// ------------------------------------------------------------------ configuração e link

const configAberta = ref(false)
const salvandoConfig = ref(false)

async function salvarConfiguracao(nova: AgendamentoOnline) {
  salvandoConfig.value = true

  const deuCerto = await pedidos.salvarConfiguracao(nova)

  salvandoConfig.value = false

  if (deuCerto) {
    configAberta.value = false
  }
}

async function ligarDeNovo() {
  if (pedidos.configuracao) {
    await pedidos.salvarConfiguracao({ ...pedidos.configuracao, ativo: true })
  }
}

const popoverDoLink = ref<InstanceType<typeof Popover> | null>(null)

const caminhoDoLink = computed(() =>
  pedidos.configuracao ? `/agendar/${pedidos.configuracao.slug}` : '',
)

const enderecoDoLink = computed(() => `${window.location.origin}${caminhoDoLink.value}`)

async function copiarLink() {
  try {
    await navigator.clipboard.writeText(enderecoDoLink.value)
    toast.add({ severity: 'success', summary: t('clinico.pedidos.link.copiado'), life: 2000 })
  } catch {
    /* Sem área de transferência, o endereço continua no campo para copiar à mão. */
  }
}

const compartilharNoWhatsapp = computed(
  () =>
    `https://wa.me/?text=${encodeURIComponent(
      t('clinico.pedidos.link.textoParaCompartilhar', {
        clinica: pedidoRepository.clinica().nome,
        endereco: enderecoDoLink.value,
      }),
    )}`,
)

/**
 * Abre a página pública **nesta aba**. Numa aba nova a demonstração começaria do zero — os dados
 * são de mentira e moram na memória desta —, e o pedido feito lá nunca chegaria aqui.
 */
function abrirPagina() {
  popoverDoLink.value?.hide()
  void router.push(caminhoDoLink.value)
}

// ------------------------------------------------------------------ o celular

const appAberto = ref(false)

/* O celular empurra a página só com largura para isso; em 1024 px passa por cima, sem véu. */
const telaLarga = useTelaLarga()

useSidePanelOffset(
  computed(() => appAberto.value && telaLarga.value),
  '27rem',
)

/* Abrir o celular com a gaveta de resposta aberta: a resposta fica para depois, o celular na frente. */
watch(appAberto, (aberto) => {
  if (aberto && chaveEmResposta.value !== null) {
    celularGuardado.value = false
    chaveEmResposta.value = null
  }
})

const pessoa = ref<string>(RESPONSAVEL_DA_DEMONSTRACAO)

const pessoas = computed(() => [
  { valor: RESPONSAVEL_DA_DEMONSTRACAO, rotulo: t('clinico.pedidos.ensaio.fatima') },
  { valor: RESPONSAVEL_SEM_VINCULO, rotulo: t('clinico.pedidos.ensaio.renata') },
])

const disputa = ref(reservaVaiSerDisputada())

function alternarDisputa(valor: boolean) {
  disputa.value = valor
  disputarProximaReserva(valor)
}

async function celularMudou() {
  /* A disputa vale para um toque só: o servidor de mentira já a consumiu. */
  disputa.value = reservaVaiSerDisputada()
  await pedidos.avisarMudanca()
}
</script>

<template>
  <UiPagina
    class="tela-pedidos"
    :carregando="!pedidos.carregado && !pedidos.erro"
    :erro="pedidos.erro && !pedidos.carregado ? t(pedidos.erro) : ''"
    bloquear-se-suspenso
    @tentar-de-novo="carregar"
  >
    <template v-if="fraseDoResumo" #resumo>
      <span aria-live="polite">{{ fraseDoResumo }}</span>
    </template>

    <!--
      Nenhuma ação cheia no alto: a ação desta tela é responder, e ela mora em cada linha. Em cima
      ficam as duas portas da configuração e, mais leve, a prévia do celular.
    -->
    <template #acoes>
      <!--
        Os botões de contorno e de texto ganham o acabamento do módulo dentro de `clinic-scope`;
        fora dele, no escuro, o tema base os deixava apagados como se estivessem desabilitados.
      -->
      <div class="topo-acoes clinic-scope">
        <Button
          type="button"
          severity="secondary"
          text
          icon="ph ph-device-mobile"
          :label="t('clinico.pedidos.tela.verComoPede')"
          :aria-expanded="appAberto"
          @click="appAberto = !appAberto"
        />
        <Button
          type="button"
          severity="secondary"
          outlined
          icon="ph ph-link"
          :label="t('clinico.pedidos.acoes.link')"
          aria-haspopup="dialog"
          @click="popoverDoLink?.toggle($event)"
        />
        <Button
          type="button"
          severity="secondary"
          outlined
          icon="ph ph-sliders-horizontal"
          :label="t('clinico.pedidos.tela.configurar')"
          :title="t('clinico.pedidos.acoes.configurar')"
          aria-haspopup="dialog"
          @click="configAberta = true"
        />
      </div>
    </template>

    <div class="pedidos clinic-scope">
      <!-- Desligado: dito na primeira linha, com o jeito de religar. -->
      <p v-if="desligado" class="aviso aviso--atencao" role="status">
        <i class="ph ph-pause-circle aviso__icone" aria-hidden="true" />
        <span class="aviso__texto">{{ t('clinico.pedidos.desligado') }}</span>
        <Button
          type="button"
          size="small"
          severity="secondary"
          outlined
          icon="ph ph-play"
          :label="t('clinico.pedidos.religar')"
          @click="ligarDeNovo"
        />
      </p>

      <p
        v-if="resultado"
        class="aviso"
        :class="resultado.tipo === 'marcado' ? 'aviso--ok' : 'aviso--neutro'"
        role="status"
      >
        <i
          class="ph aviso__icone"
          :class="resultado.tipo === 'marcado' ? 'ph-check-circle' : 'ph-info'"
          aria-hidden="true"
        />
        <span class="aviso__texto">{{ resultado.texto }}</span>
        <RouterLink v-if="resultado.rota" class="ui-mais" :to="resultado.rota">
          {{ t('clinico.pedidos.resultado.verNaAgenda') }}
          <i class="ph ph-arrow-right" aria-hidden="true" />
        </RouterLink>
        <Button
          type="button"
          icon="ph ph-x"
          severity="secondary"
          text
          rounded
          size="small"
          :aria-label="t('clinico.pedidos.resultado.dispensar')"
          @click="pedidos.dispensarResultado()"
        />
      </p>

      <p v-if="pedidos.erro && pedidos.carregado" class="aviso aviso--risco" role="alert">
        <i class="ph ph-warning-circle aviso__icone" aria-hidden="true" />
        <span class="aviso__texto">{{ t(pedidos.erro) }}</span>
      </p>

      <UiSecao
        id="pedidos-abertos"
        :titulo="t('clinico.pedidos.secao.abertos')"
        :contagem="pedidos.abertas.length"
        :descricao="pedidos.abertas.length > 1 ? t('clinico.pedidos.tela.descricao') : ''"
      >
        <div class="caixa ui-folha">
          <TransitionGroup
            v-if="pedidos.abertas.length > 0"
            tag="ul"
            name="linha"
            class="ui-lista caixa__lista"
          >
            <PedidoLinha
              v-for="linha in pedidos.abertas"
              :key="linha.chave"
              :linha="linha"
              :respondendo="pedidos.respondendo === linha.chave"
              :ocupado="pedidos.respondendo !== null"
              :aberta="chaveEmResposta === linha.chave"
              @aceitar="aceitar(linha, $event)"
              @abrir="abrirResposta(linha)"
            />
          </TransitionGroup>

          <div v-else class="caixa__vazio">
            <span class="caixa__vazio-icone" aria-hidden="true">
              <i class="ph ph-calendar-check" />
            </span>
            <strong>{{ t('clinico.pedidos.vazio.titulo') }}</strong>
            <p>{{ t('clinico.pedidos.vazio.descricao') }}</p>
          </div>
        </div>
      </UiSecao>

      <!-- O respondido é histórico: recolhido no fim, uma linha por pedido. -->
      <section v-if="pedidos.respondidas.length > 0" class="historico">
        <button
          type="button"
          class="historico__alternar"
          :aria-expanded="historicoAberto"
          aria-controls="pedidos-respondidos"
          @click="historicoAberto = !historicoAberto"
        >
          <i
            class="ph"
            :class="historicoAberto ? 'ph-caret-down' : 'ph-caret-right'"
            aria-hidden="true"
          />
          {{ t('clinico.pedidos.tela.respondidos') }}
          <span class="ui-contagem">{{ pedidos.respondidas.length }}</span>
        </button>

        <ul v-if="historicoAberto" id="pedidos-respondidos" class="ui-folha ui-lista">
          <li v-for="linha in pedidos.respondidas" :key="linha.chave" class="respondido">
            <span class="respondido__rostos">
              <PetAvatar
                v-for="pet in petsDa(linha)"
                :key="pet.id"
                :nome="pet.nome"
                :iniciais="pet.iniciais"
                :especie="pet.especie"
                :foto-url="pet.fotoUrl"
                tamanho="sm"
              />
            </span>
            <span class="ui-linha__texto">
              <strong class="ui-linha__titulo">
                {{ rotulos.nomes(petsDa(linha).map((pet) => pet.nome)) }}
              </strong>
              <span class="ui-linha__meta respondido__meta">
                {{ clinico.tipo(linha.pedidos[0]!.typeId)?.nome }} ·
                <i
                  class="ph"
                  :class="
                    linha.pedidos[0]!.canal === 'app' ? 'ph-device-mobile' : 'ph-globe-simple'
                  "
                  aria-hidden="true"
                />
                {{ t(`clinico.pedidos.canal.${linha.pedidos[0]!.canal}`) }}
              </span>
            </span>
            <span
              class="respondido__como"
              :class="`respondido__como--${tomDoRespondido(linha).tom}`"
            >
              <i class="ph" :class="tomDoRespondido(linha).icone" aria-hidden="true" />
              {{ fraseDoRespondido(linha) }}
            </span>
            <span class="respondido__quando ui-num">
              {{ formato.relativo(linha.pedidos[0]!.respondidoEm ?? linha.pedidos[0]!.criadoEm) }}
            </span>
          </li>
        </ul>
      </section>
    </div>

    <template #sempre>
      <PedidoGaveta
        :linha="emResposta"
        :salvando="pedidos.respondendo !== null"
        @marcar="emResposta && aceitar(emResposta, $event)"
        @recusar="recusar"
        @fechar="fecharResposta"
      />

      <AgendamentoOnlineGaveta
        v-model:visivel="configAberta"
        :configuracao="pedidos.configuracao"
        :salvando="salvandoConfig"
        @salvar="salvarConfiguracao"
      />

      <Popover ref="popoverDoLink" class="clinic-overlay">
        <div class="link clinic-scope">
          <p class="link__titulo">{{ t('clinico.pedidos.link.titulo') }}</p>
          <p class="link__ajuda">{{ t('clinico.pedidos.link.ajuda') }}</p>
          <div class="link__campo">
            <InputText
              :model-value="enderecoDoLink"
              readonly
              fluid
              :aria-label="t('clinico.pedidos.link.titulo')"
            />
            <Button
              type="button"
              severity="secondary"
              outlined
              icon="ph ph-copy"
              :aria-label="t('clinico.pedidos.link.copiar')"
              :title="t('clinico.pedidos.link.copiar')"
              @click="copiarLink"
            />
          </div>
          <div class="link__acoes">
            <Button
              type="button"
              size="small"
              icon="ph ph-arrow-square-out"
              :label="t('clinico.pedidos.link.abrir')"
              @click="abrirPagina"
            />
            <Button
              as="a"
              :href="compartilharNoWhatsapp"
              target="_blank"
              rel="noopener"
              size="small"
              severity="secondary"
              outlined
              icon="ph ph-whatsapp-logo"
              :label="t('clinico.pedidos.link.whatsapp')"
            />
          </div>
        </div>
      </Popover>

      <!--
        O celular do responsável, numa gaveta que empurra a página: os dois lados à vista. Clicar na
        página não fecha a gaveta — responder aqui e ver o aviso chegar lá é a demonstração.
      -->
      <Drawer
        v-model:visible="appAberto"
        position="right"
        :modal="false"
        :dismissable="false"
        class="pedidos-gaveta clinic-overlay"
        :style="{ width: 'min(27rem, 94vw)' }"
      >
        <template #header>
          <h2 class="pedidos-gaveta__titulo">
            <i class="ph ph-device-mobile" aria-hidden="true" />
            {{ t('clinico.pedidos.acoes.verNoApp') }}
          </h2>
        </template>

        <div class="pedidos-gaveta__corpo clinic-scope">
          <div class="ensaio">
            <span id="ensaio-pessoa" class="ensaio__rotulo">{{ t('clinico.pedidos.ensaio.quem') }}</span>
            <SelectButton
              v-model="pessoa"
              :options="pessoas"
              option-label="rotulo"
              option-value="valor"
              :allow-empty="false"
              aria-labelledby="ensaio-pessoa"
            />
            <label class="ensaio__chave">
              <ToggleSwitch :model-value="disputa" @update:model-value="alternarDisputa" />
              <span>{{ t('clinico.pedidos.ensaio.disputa') }}</span>
            </label>
          </div>

          <AgendarNoApp :tutor-id="pessoa" @mudou="celularMudou" />
        </div>
      </Drawer>
    </template>
  </UiPagina>
</template>

<style scoped>
.pedidos {
  display: grid;
  gap: 28px;
}

/* As ações do alto continuam itens da linha de ações da moldura. */
.topo-acoes {
  display: contents;
}

/* ------------------------------------------------------------------ avisos de estado */

.aviso {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  margin: 0;
  padding: 12px 14px 12px 16px;
  border: 1px solid var(--linha);
  border-radius: 14px;
  background: var(--superficie);
  color: var(--tinta);
  font-size: 14px;
  line-height: 1.45;
}

.aviso__icone {
  flex: none;
  font-size: 20px;
}

.aviso__texto {
  flex: 1 1 18rem;
  min-width: 0;
}

.aviso--ok {
  border-color: color-mix(in oklab, var(--ok) 35%, transparent);
  background: var(--ok-fundo);
}

.aviso--ok .aviso__icone {
  color: var(--ok-tinta);
}

.aviso--atencao {
  border-color: color-mix(in oklab, var(--atencao) 35%, transparent);
  background: var(--atencao-fundo);
}

.aviso--atencao .aviso__icone {
  color: var(--atencao-tinta);
}

.aviso--risco {
  border-color: color-mix(in oklab, var(--risco) 35%, transparent);
  background: var(--risco-fundo);
  color: var(--risco-tinta);
}

.aviso--neutro .aviso__icone {
  color: var(--tinta-2);
}

/* ------------------------------------------------------------------ a caixa */

.caixa {
  overflow: hidden;
}

.caixa__lista {
  container-type: inline-size;
}

.caixa__vazio {
  display: grid;
  justify-items: center;
  gap: 6px;
  padding: 44px 24px;
  text-align: center;
}

.caixa__vazio-icone {
  display: grid;
  width: 48px;
  height: 48px;
  place-items: center;
  margin-bottom: 6px;
  border-radius: 14px;
  background: var(--clinica-fundo);
  color: var(--clinica-tinta);
  font-size: 24px;
}

.caixa__vazio strong {
  color: var(--tinta);
  font-size: 16px;
  font-weight: 600;
}

.caixa__vazio p {
  max-width: 46ch;
  margin: 0;
  color: var(--tinta-2);
  font-size: 14px;
  line-height: 1.5;
}

/* ------------------------------------------------------------------ respondidos */

.historico {
  display: grid;
  gap: 12px;
}

.historico__alternar {
  display: inline-flex;
  min-height: 36px;
  justify-self: start;
  align-items: center;
  gap: 8px;
  padding: 0 10px 0 6px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--tinta);
  cursor: pointer;
  font: inherit;
  font-size: 15px;
  font-weight: 600;
}

.historico__alternar:hover {
  background: var(--superficie-2);
}

.historico__alternar:focus-visible {
  outline: 2px solid var(--pj-lugar, var(--musgo));
  outline-offset: 2px;
}

.historico__alternar > i {
  color: var(--tinta-2);
  font-size: 16px;
}

.respondido {
  display: grid;
  min-height: 60px;
  align-items: center;
  gap: 6px 16px;
  grid-template-columns: 3rem minmax(10rem, 1fr) minmax(0, 1.5fr) 7rem;
  padding: 10px 18px;
}

.respondido__rostos {
  display: inline-flex;
}

.respondido__rostos > * + * {
  margin-inline-start: -10px;
  border-radius: 50%;
  box-shadow: 0 0 0 2px var(--superficie);
}

.respondido__meta {
  display: flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}

.respondido__como {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  color: var(--tinta-2);
  font-size: 13.5px;
  font-weight: 550;
  line-height: 1.4;
}

.respondido__como i {
  flex: none;
  font-size: 15px;
  transform: translateY(2px);
}

.respondido__como--ok {
  color: var(--ok-tinta);
}

.respondido__como--atencao {
  color: var(--atencao-tinta);
}

.respondido__quando {
  color: var(--tinta-3);
  font-size: 13px;
  text-align: end;
  white-space: nowrap;
}

/* O pedido que sai da lista ao ser respondido: o movimento diz para onde ele foi. */
.linha-enter-active,
.linha-leave-active {
  transition:
    opacity 180ms ease-out,
    transform 180ms ease-out;
}

.linha-enter-from {
  opacity: 0;
  transform: translateY(-6px);
}

.linha-leave-to {
  opacity: 0;
  transform: translateY(6px);
}

.linha-move {
  transition: transform 180ms ease-out;
}

@media (prefers-reduced-motion: reduce) {
  .tela-pedidos.tela-pedidos,
  .linha-enter-active,
  .linha-leave-active,
  .linha-move {
    transition: none;
  }
}

@media (max-width: 900px) {
  .respondido {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .respondido__como,
  .respondido__quando {
    grid-column: 2;
    text-align: start;
  }
}

/* ------------------------------------------------------------------ popover do link */

.link {
  display: grid;
  width: min(24rem, 86vw);
  gap: 10px;
}

.link__titulo {
  margin: 0;
  color: var(--tinta);
  font-size: 15px;
  font-weight: 600;
}

.link__ajuda {
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
  line-height: 1.45;
}

.link__campo,
.link__acoes {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.link__campo > :first-child {
  flex: 1;
}

/* ------------------------------------------------------------------ gaveta do celular */

.pedidos-gaveta__titulo {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--tinta);
  font-size: 17px;
  font-weight: 600;
}

.pedidos-gaveta__titulo i {
  color: var(--clinica-tinta);
  font-size: 20px;
}

.pedidos-gaveta__corpo {
  display: grid;
  gap: 14px;
}

/* O ensaio da demonstração: quem está com o celular, e a disputa pelo próximo horário. */
.ensaio {
  display: grid;
  gap: 8px;
  padding: 12px 14px;
  border-radius: 14px;
  background: var(--superficie-2);
}

.ensaio__rotulo {
  color: var(--tinta-2);
  font-size: 12.5px;
  font-weight: 550;
}

/* O segmento escolhido: superfície e tinta, legível nos dois temas. */
.ensaio :deep(.p-togglebutton-checked .p-togglebutton-content) {
  background: var(--superficie);
  color: var(--tinta);
}

.ensaio__chave {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.4;
  cursor: pointer;
}
</style>
