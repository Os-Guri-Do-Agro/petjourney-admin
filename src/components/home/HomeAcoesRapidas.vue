<script setup lang="ts">
/**
 * Ações rápidas do Início (pedido do Luís, 16/11/2026): o trabalho mais comum começa daqui, sem
 * antes ir até a tela dele. Cada ação é um bloco na cor dela, lado a lado (o desenho que ele mandou
 * de referência, "Crie algo novo"). Desde 17/11/2026 ("estão grandes demais"), o bloco é baixo: o
 * selo com o ícone e o nome lado a lado, dentro da cor, e o mesmo ícone em duotone no fundo, no
 * canto do fim, recortado pela borda e meio girado (o "ícone maior no background" que ele pediu
 * antes), que se endireita quando o mouse passa. O que a ação faz vai para o leitor de tela (a
 * descrição mora na tela, não no botão).
 *
 * Nada aqui é formulário novo: cada ação abre o formulário que já existe, na tela dona dele, por um
 * pedido na URL que a tela atende e tira (`?novo=1` na Agenda, `?adicionar=1` na Lista de espera,
 * `?aplicar=vacina` na ficha, `?vincular` nos Acessos). As duas que
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
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { useEspacos } from '@/navegacao/espacos'
import { criarChaveadorDeIdempotencia } from '@/service/idempotencia'
import { abrirAvulso } from '@/service/parceiro/atendimentos-service'
import type { PacienteNaLista } from '@/service/parceiro/pacientes-service'

const { t } = useI18n()
const router = useRouter()
const { store, parceiroQuery } = useParceiroPortal()
const { espacos } = useEspacos()

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
  return clinicaEscreve.value && store.temPermissao(permissao)
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
      /* A gaveta em passos na lista de Pacientes. */
      acao('paciente', 'ph ph-paw-print', PhPawPrint, 'pets', {
        to: { path: '/clinica/pacientes', query: { novo: '1' } },
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

  if (comClinica && pode('prontuario.escrever')) {
    lista.push(
      acao('atender', 'ph ph-stethoscope', PhStethoscope, 'hotel', { peloPaciente: 'atender' }),
    )
  }

  if (comClinica && pode('vacina.aplicar')) {
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

/**
 * Até quatro, todos numa linha; mais que isso, três por linha. Com o nome dentro do bloco, seis numa
 * linha cortavam "Lista de espera" e "Novo acesso temporário".
 */
const colunas = computed(() => (acoes.value.length <= 4 ? acoes.value.length : 3))

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
            <component :is="item.figura" class="bloco__fundo" weight="duotone" aria-hidden="true" />
            <span class="bloco__selo" aria-hidden="true"><i :class="item.icone" /></span>
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

@container rapidas (max-width: 980px) {
  .rapidas {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@container rapidas (max-width: 420px) {
  .rapidas {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

/*
 * O bloco inteiro é o botão: baixo, na cor da ação (no escuro, a mesma cor funda), com o selo e o
 * nome lado a lado na tinta da cor. O ícone de fundo fica no canto do fim, maior que o selo.
 */
.bloco {
  position: relative;
  display: flex;
  width: 100%;
  min-height: 68px;
  align-items: center;
  gap: 12px;
  overflow: hidden;
  padding: 12px 16px;
  isolation: isolate;
  border: 0;
  border-radius: 18px;
  background: var(--tom-fundo);
  color: var(--tom-tinta);
  cursor: pointer;
  font: inherit;
  text-align: start;
  text-decoration: none;
  transition:
    background-color var(--pj-tempo-curto) var(--pj-curva-chega),
    translate var(--pj-tempo-curto) var(--pj-curva-chega);
}

/*
 * O ícone de fundo: o desenho da ação em duotone, saindo pela borda do fim, girado. A 30% da tinta,
 * aparece como marca-d'água, sem brigar com o selo nem com o nome.
 */
.bloco__fundo {
  position: absolute;
  z-index: -1;
  inset-block-start: 50%;
  inset-inline-end: -18px;
  width: 84px;
  height: 84px;
  opacity: 0.3;
  rotate: -16deg;
  translate: 0 -50%;
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

/* O selo: o ícone nítido, num quadrado de papel meio transparente. */
.bloco__selo {
  display: grid;
  width: 40px;
  height: 40px;
  flex: none;
  place-items: center;
  border-radius: 13px;
  background: color-mix(in oklab, var(--app-cartao, #fff) 72%, transparent);
  font-size: 21px;
}

.app-dark .bloco__selo {
  background: color-mix(in oklab, var(--tom-tinta) 13%, transparent);
}

/* O nome cabe em até duas linhas ("Novo acesso temporário" no bloco estreito do tablet). */
.bloco__nome {
  display: -webkit-box;
  overflow: hidden;
  padding-inline-end: 44px;
  font-size: 14.5px;
  font-weight: 650;
  line-height: 1.25;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
}

/*
 * Passar o mouse: a cor fica um tom mais funda, o bloco sobe um pouco e o ícone de fundo se
 * endireita e cresce.
 */
.bloco:hover {
  background: color-mix(in oklab, var(--tom-fundo) 88%, var(--tom-tinta));
  translate: 0 -2px;
}

.bloco:hover .bloco__fundo {
  opacity: 0.42;
  rotate: -4deg;
  scale: 1.1;
}

:dir(rtl) .bloco:hover .bloco__fundo {
  rotate: 4deg;
}

.bloco:focus-visible {
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
  .bloco,
  .bloco__fundo {
    transition: none;
  }

  .bloco:hover {
    translate: none;
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
