<script setup lang="ts">
/**
 * Ações rápidas do Início (pedido do Luís, 16/11/2026): o trabalho mais comum começa daqui, sem
 * antes ir até a tela dele. Cada ação é um bloco na cor dela, lado a lado (o desenho que ele mandou
 * de referência, "Crie algo novo"), com o nome embaixo, fora do bloco. Dentro, o ícone da ação
 * aparece duas vezes: pequeno e nítido num selo no canto, e enorme no fundo, em duotone, recortado
 * pela borda e meio girado (pedido dele: "um ícone maior no background"), que se endireita quando
 * o mouse passa. O que a ação faz vai para o leitor de tela (a descrição mora na tela, não no
 * botão).
 *
 * Nada aqui é formulário novo: cada ação abre o formulário que já existe, na tela dona dele, por um
 * pedido na URL que a tela atende e tira (`?novo=1` na Agenda, `?adicionar=1` na Lista de espera,
 * `?aplicar=vacina` na ficha, `?vincular` nos Acessos), como o "Criar" da demonstração. As duas que
 * precisam de um paciente e não nascem na ficha dele (atender agora e aplicar vacina) pedem o
 * paciente numa gaveta antes.
 *
 * Só aparece o que a pessoa pode fazer: módulo com escrita e a permissão da ação. Com menos de duas
 * ações a seção não aparece (um botão sozinho não é atalho, é a tela).
 */
import {
  PhCalendarPlus,
  PhHourglassMedium,
  PhPawPrint,
  PhQrCode,
  PhStethoscope,
  PhSyringe,
} from '@phosphor-icons/vue'
import { computed, ref, type Component } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRouter, type RouteLocationRaw } from 'vue-router'

import EscolherPacienteGaveta from '@/components/cadastro/EscolherPacienteGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import UiSecao from '@/components/ui/UiSecao.vue'
import { useModoDemonstracao } from '@/composables/useModoDemonstracao'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { useEspacos } from '@/navegacao/espacos'
import { criarChaveadorDeIdempotencia } from '@/service/idempotencia'
import { abrirAvulso } from '@/service/parceiro/atendimentos-service'
import type { PacienteNaLista } from '@/service/parceiro/pacientes-service'

const { t } = useI18n()
const router = useRouter()
const { store, parceiroQuery } = useParceiroPortal()
const { espacos } = useEspacos()
const { ativo: demonstracao } = useModoDemonstracao()

/** A cor de cada ação, em pastel da casa: o fundo da família com a tinta dela. */
type Tom = 'pets' | 'clinica' | 'hotel' | 'rosa' | 'barro' | 'portal'
type PeloPaciente = 'atender' | 'vacina'

type Acao = {
  id: string
  rotulo: string
  dica: string
  /** O ícone do selo, na fonte (`ph ph-*`), e o mesmo desenho como componente, para o fundo. */
  icone: string
  figura: Component
  tom: Tom
  to?: RouteLocationRaw
  peloPaciente?: PeloPaciente
}

/** Uma tela está no menu da pessoa (módulo ligado, permissão de ler): a ação leva até ela. */
function temTela(to: string) {
  return espacos.value.some((espaco) =>
    espaco.destinos.some((destino) => destino.abas.some((aba) => aba.to === to)),
  )
}

const clinicaEscreve = computed(
  () => temTela('/clinica/pacientes') && Boolean(store.modulo('CLINICA')?.podeEscrever),
)

type Permissao = Parameters<typeof store.temPermissao>[0]

function pode(permissao: Permissao) {
  return demonstracao.value || (clinicaEscreve.value && store.temPermissao(permissao))
}

function acao(id: string, icone: string, figura: Component, tom: Tom, extra: Partial<Acao>): Acao {
  return {
    id,
    icone,
    figura,
    tom,
    rotulo: t(`inicio.rapidas.${id}.rotulo`),
    dica: t(`inicio.rapidas.${id}.dica`),
    ...extra,
  }
}

const acoes = computed<Acao[]>(() => {
  const lista: Acao[] = []
  const comClinica = temTela('/clinica/pacientes')

  if (comClinica && pode('paciente.escrever')) {
    lista.push(
      /* Pela API, a gaveta em passos na lista de Pacientes; na demonstração, o formulário dela. */
      acao('paciente', 'ph ph-paw-print', PhPawPrint, 'pets', {
        to: demonstracao.value
          ? '/clinica/paciente/novo'
          : { path: '/clinica/pacientes', query: { novo: '1' } },
      }),
    )
  }

  if (comClinica && temTela('/clinica/agenda') && pode('agenda.escrever')) {
    lista.push(
      acao('consulta', 'ph ph-calendar-plus', PhCalendarPlus, 'clinica', {
        to: { path: '/clinica/agenda', query: { novo: '1' } },
      }),
    )
  }

  /* As duas pelo paciente só pela API: na demonstração a ficha e o prontuário são outros. */
  if (comClinica && !demonstracao.value && pode('prontuario.escrever')) {
    lista.push(
      acao('atender', 'ph ph-stethoscope', PhStethoscope, 'hotel', { peloPaciente: 'atender' }),
    )
  }

  if (comClinica && !demonstracao.value && pode('vacina.aplicar')) {
    lista.push(acao('vacina', 'ph ph-syringe', PhSyringe, 'rosa', { peloPaciente: 'vacina' }))
  }

  if (comClinica && temTela('/clinica/fila') && pode('fila.gerir')) {
    lista.push(
      acao('espera', 'ph ph-hourglass-medium', PhHourglassMedium, 'barro', {
        to: { path: '/clinica/fila', query: { adicionar: '1' } },
      }),
    )
  }

  if (temTela('/parceiro/acessos') && !store.cadastroSuspenso) {
    lista.push(
      acao('codigo', 'ph ph-qr-code', PhQrCode, 'portal', {
        to: { path: '/parceiro/acessos', query: { vincular: '' } },
      }),
    )
  }

  return lista
})

/** Todos numa linha só, como a referência (até seis); a grade quebra pela largura do bloco. */
const colunas = computed(() => Math.min(acoes.value.length, 6))

/* ------------------------------------------------------------------- o passo do paciente */

const gavetaAberta = ref(false)
const peloPaciente = ref<PeloPaciente>('atender')
const ocupado = ref(false)
const erro = ref('')
const chaveador = criarChaveadorDeIdempotencia()

const gaveta = computed(() =>
  peloPaciente.value === 'atender'
    ? {
        titulo: t('inicio.rapidas.atender.rotulo'),
        icone: 'ph ph-stethoscope',
        confirmar: t('inicio.rapidas.atender.confirmar'),
        iconeDoConfirmar: 'ph ph-note-pencil',
      }
    : {
        titulo: t('inicio.rapidas.vacina.rotulo'),
        icone: 'ph ph-syringe',
        confirmar: t('inicio.rapidas.vacina.confirmar'),
        iconeDoConfirmar: 'ph ph-arrow-right',
      },
)

function pedirPaciente(qual: PeloPaciente) {
  peloPaciente.value = qual
  erro.value = ''
  gavetaAberta.value = true
}

/**
 * Atender agora abre o atendimento avulso (o mesmo da linha do tempo da ficha), com a chave de
 * idempotência: o clique duplo não abre dois. Aplicar vacina leva à ficha, que abre a gaveta.
 */
async function escolhido(paciente: PacienteNaLista) {
  if (peloPaciente.value === 'vacina') {
    gavetaAberta.value = false
    void router.push({ path: `/clinica/ficha/${paciente.id}`, query: { aplicar: 'vacina' } })
    return
  }

  ocupado.value = true
  erro.value = ''
  const corpo = { pacienteId: paciente.id }
  try {
    const atendimento = await abrirAvulso(corpo, chaveador.para(corpo), parceiroQuery())
    chaveador.concluir()
    gavetaAberta.value = false
    void router.push(`/clinica/atendimento/${atendimento.id}`)
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('atendimento.linha.erroAvulso')).mensagem
  } finally {
    ocupado.value = false
  }
}
</script>

<template>
  <UiSecao v-if="acoes.length >= 2" id="inicio-rapidas" :titulo="t('inicio.rapidas.titulo')">
    <div class="rapidas-area">
      <ul class="rapidas" :style="{ '--colunas': colunas }">
        <li v-for="item in acoes" :key="item.id">
          <component
            :is="item.to ? RouterLink : 'button'"
            class="bloco"
            :class="`bloco--${item.tom}`"
            v-bind="
              item.to
                ? { to: item.to }
                : {
                    type: 'button',
                    'aria-haspopup': 'dialog',
                    onClick: () => pedirPaciente(item.peloPaciente!),
                  }
            "
            :aria-description="item.dica"
          >
            <span class="bloco__cartao" aria-hidden="true">
              <component :is="item.figura" class="bloco__fundo" weight="duotone" />
              <span class="bloco__selo"><i :class="item.icone" /></span>
            </span>
            <span class="bloco__nome">{{ item.rotulo }}</span>
          </component>
        </li>
      </ul>
    </div>

    <EscolherPacienteGaveta
      v-model:visible="gavetaAberta"
      :titulo="gaveta.titulo"
      :icone="gaveta.icone"
      :confirmar="gaveta.confirmar"
      :icone-do-confirmar="gaveta.iconeDoConfirmar"
      :ocupado="ocupado"
      :erro="erro"
      @escolhido="escolhido"
    />
  </UiSecao>
</template>

<style scoped>
/*
 * Os blocos lado a lado, todos numa linha na folha larga; a grade segue a largura do próprio bloco
 * (não a da janela): com uma gaveta aberta ao lado, que empurra a página, vira três por linha, e
 * dois na coluna estreita.
 */
.rapidas-area {
  container: rapidas / inline-size;
}

.rapidas {
  display: grid;
  gap: 14px;
  margin: 0;
  padding: 0;
  grid-template-columns: repeat(var(--colunas, 6), minmax(0, 1fr));
  list-style: none;
}

@container rapidas (max-width: 820px) {
  .rapidas {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@container rapidas (max-width: 420px) {
  .rapidas {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

/* O bloco inteiro é o botão: o cartão colorido e o nome embaixo dele. */
.bloco {
  display: grid;
  width: 100%;
  gap: 9px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--app-tinta, var(--tinta));
  cursor: pointer;
  font: inherit;
  text-align: start;
  text-decoration: none;
}

/*
 * O cartão: o fundo pastel da cor da ação (no escuro, a mesma cor funda), na tinta da cor. O selo
 * fica no canto de cima; o ícone de fundo, no canto oposto, maior que o próprio cartão.
 */
.bloco__cartao {
  position: relative;
  display: block;
  overflow: hidden;
  aspect-ratio: 4 / 3;
  min-height: 92px;
  isolation: isolate;
  border-radius: 18px;
  background: var(--tom-fundo);
  color: var(--tom-tinta);
  transition: background-color var(--pj-tempo-curto) var(--pj-curva-chega);
}

/*
 * O ícone de fundo: o desenho da ação em duotone, do tamanho do cartão, saindo pela borda de baixo
 * e pela do fim, girado. O traço vai a 30% da tinta e o miolo do duotone, a 20% disso: aparece como
 * marca-d'água, sem brigar com o selo nem com o nome.
 */
.bloco__fundo {
  position: absolute;
  z-index: -1;
  inset-block-end: -30%;
  inset-inline-end: -16%;
  width: 92%;
  height: auto;
  aspect-ratio: 1;
  opacity: 0.3;
  rotate: -16deg;
  transition:
    rotate var(--pj-tempo-medio) var(--pj-curva-chega),
    scale var(--pj-tempo-medio) var(--pj-curva-chega),
    opacity var(--pj-tempo-medio) var(--pj-curva-chega);
}

.app-dark .bloco__fundo {
  opacity: 0.36;
}

/* No árabe o canto se inverte (o `inset-inline-end` já cuida), e o giro também. */
:dir(rtl) .bloco__fundo {
  rotate: 16deg;
}

/* O selo: o ícone nítido, num quadrado de papel meio transparente, no canto de cima. */
.bloco__selo {
  position: absolute;
  inset-block-start: 12px;
  inset-inline-start: 12px;
  display: grid;
  width: 42px;
  height: 42px;
  place-items: center;
  border-radius: 13px;
  background: color-mix(in oklab, var(--app-cartao, #fff) 72%, transparent);
  font-size: 23px;
}

.app-dark .bloco__selo {
  background: color-mix(in oklab, var(--tom-tinta) 13%, transparent);
}

/* O nome cabe em até duas linhas ("Novo acesso temporário" no bloco estreito do tablet). */
.bloco__nome {
  display: -webkit-box;
  overflow: hidden;
  padding-inline: 2px;
  font-size: 14.5px;
  font-weight: 650;
  line-height: 1.3;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
}

/*
 * Passar o mouse: a cor fica um tom mais funda e o ícone de fundo se endireita e cresce um pouco,
 * dentro do cartão (o cartão não pula nem cresce).
 */
.bloco:hover .bloco__cartao {
  background: color-mix(in oklab, var(--tom-fundo) 88%, var(--tom-tinta));
}

.bloco:hover .bloco__fundo {
  opacity: 0.4;
  rotate: -4deg;
  scale: 1.08;
}

:dir(rtl) .bloco:hover .bloco__fundo {
  rotate: 4deg;
}

.bloco:focus-visible {
  outline: none;
}

.bloco:focus-visible .bloco__cartao {
  outline: 2px solid var(--app-salvia-texto, var(--musgo));
  outline-offset: 3px;
}

.bloco--pets {
  --tom-fundo: var(--pets-fundo);
  --tom-tinta: var(--pets-tinta);
}

.bloco--clinica {
  --tom-fundo: var(--clinica-fundo);
  --tom-tinta: var(--clinica-tinta);
}

.bloco--hotel {
  --tom-fundo: var(--hotel-fundo);
  --tom-tinta: var(--hotel-tinta);
}

/* Rosa e barro: o pastel cheio deles (o "-fundo" do claro é quase branco) e, no escuro, o fundo. */
.bloco--rosa {
  --tom-fundo: var(--dado-rosa, var(--risco-fundo));
  --tom-tinta: var(--dado-rosa-tinta, var(--risco-tinta));
}

.bloco--barro {
  --tom-fundo: var(--dado-barro, var(--atencao-fundo));
  --tom-tinta: var(--dado-barro-tinta, var(--atencao-tinta));
}

.app-dark .bloco--rosa {
  --tom-fundo: var(--dado-rosa-fundo, var(--risco-fundo));
}

.app-dark .bloco--barro {
  --tom-fundo: var(--dado-barro-fundo, var(--atencao-fundo));
}

.bloco--portal {
  --tom-fundo: var(--portal-fundo);
  --tom-tinta: var(--portal-tinta);
}

@media (prefers-reduced-motion: reduce) {
  .bloco__cartao,
  .bloco__fundo {
    transition: none;
  }

  .bloco:hover .bloco__fundo {
    rotate: -16deg;
    scale: 1;
  }

  :dir(rtl) .bloco:hover .bloco__fundo {
    rotate: 16deg;
  }
}
</style>
