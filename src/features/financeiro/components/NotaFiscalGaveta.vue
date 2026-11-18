<script setup lang="ts">
/**
 * Uma nota fiscal de serviço (protótipo), na gaveta à direita: o resumo no desenho de uma NFS-e e o
 * que se faz com ela. Três modos, um assunto de cada vez:
 *
 * - **Ver:** a situação no alto (em processamento, recusada com o motivo da prefeitura, cancelada) e,
 *   embaixo, a nota como ela é: número, código de verificação, prestador e tomador, o serviço com a
 *   discriminação, os valores com o ISS, e por onde chegou ao responsável. Ações: baixar o PDF (a
 *   folha `FolhaDaNota` impressa pelo navegador), enviar de novo ao responsável e, para a gestão,
 *   cancelar dentro do prazo.
 * - **Corrigir e reenviar:** a recusa é quase sempre do tomador (CPF que falta ou não confere). A
 *   recepção acerta o nome, o CPF e o e-mail e manda o mesmo RPS de volta.
 * - **Cancelar:** o motivo (que decide se a conta volta para "A emitir") e uma frase para a
 *   prefeitura. O prazo vai escrito antes do botão: até o dia 10 do mês seguinte ao da emissão.
 */
import Button from 'primevue/button'
import InputMask from 'primevue/inputmask'
import InputText from 'primevue/inputtext'
import RadioButton from 'primevue/radiobutton'
import Textarea from 'primevue/textarea'
import { useToast } from 'primevue/usetoast'
import { computed, nextTick, ref, watch } from 'vue'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { formatCpf, isValidCpf, stripCpf } from '@/utils/validation/cpf'

import { dataCurta, porcento, reais } from '../dados'
import { useFinanceiro } from '../estado'
import {
  baseDaNota,
  canaisDoTomador,
  cpfEscrito,
  dataCompleta,
  issDaNota,
  MOTIVOS_DE_CANCELAMENTO,
  municipio,
  numeroDaNota,
  podeCancelar,
  porOndeChega,
  prazoParaCancelar,
  REGIMES,
  servicoDoCodigo,
  SITUACAO_DA_NOTA,
  tomadorDoCadastro,
  type TipoDeCancelamento,
} from '../notas'
import { useRespostaDaPrefeitura } from '../resposta-da-prefeitura'

import FolhaDaNota from './FolhaDaNota.vue'
import { usePrestador } from '@/features/financeiro/prestador'

const prestador = usePrestador()
const props = defineProps<{ notaId: string | null; modoInicial?: 'ver' | 'corrigir' }>()
const aberta = defineModel<boolean>('visible', { default: false })

const fin = useFinanceiro()
const toast = useToast()
const { avisar } = useRespostaDaPrefeitura()

type Modo = 'ver' | 'corrigir' | 'cancelar'
const modo = ref<Modo>('ver')

const nota = computed(() => (props.notaId ? fin.nota(props.notaId) : null))
const conta = computed(() => (nota.value ? fin.conta(nota.value.contaId) : null))
const gestao = computed(() => fin.perfil.value.tipo === 'gestao')
const config = computed(() => fin.configDaNota.value)
const primeiro = computed(() => nota.value?.tomador.nome.split(' ')[0] ?? '')

const nome = ref('')
const cpf = ref('')
const email = ref('')
const tipoDeCancelamento = ref<TipoDeCancelamento>('erro')
const motivo = ref('')
const tentou = ref(false)

function preparar() {
  modo.value = props.modoInicial ?? 'ver'
  tentou.value = false
  tipoDeCancelamento.value = 'erro'
  motivo.value = ''
  const tomador = nota.value?.tomador
  nome.value = tomador && tomador.tutorId ? tomador.nome : ''
  cpf.value = tomador && stripCpf(tomador.cpf) ? formatCpf(tomador.cpf) : ''
  email.value = tomador?.email ?? ''
}

watch([aberta, () => props.notaId, () => props.modoInicial], ([agora]) => {
  if (agora) preparar()
})

const titulo = computed(() => {
  const n = nota.value
  if (!n) return 'Nota fiscal'
  if (modo.value === 'corrigir') return 'Corrigir e reenviar'
  if (modo.value === 'cancelar') return `Cancelar a nota nº ${numeroDaNota(n.numero ?? 0)}`
  return n.numero !== null ? `Nota fiscal nº ${numeroDaNota(n.numero)}` : 'Nota fiscal'
})

const tom = computed(() => (nota.value ? SITUACAO_DA_NOTA[nota.value.situacao].tom : ''))

const sobreOAtendimento = computed(() => {
  const n = nota.value
  if (!n) return ''
  return n.petNome === 'Venda no balcão'
    ? `Balcão, ${dataCurta(n.competencia)}`
    : `${n.petNome}, atendimento de ${dataCurta(n.competencia)}`
})

const substituta = computed(() =>
  nota.value ? (fin.notas.value.find((n) => n.substitui === nota.value!.id) ?? null) : null,
)
const substituida = computed(() => (nota.value?.substitui ? fin.nota(nota.value.substitui) : null))

const motivoDoCancelamento = computed(
  () =>
    MOTIVOS_DE_CANCELAMENTO.find((m) => m.tipo === nota.value?.cancelamento?.tipo)?.rotulo ?? '',
)

// --------------------------------------------------------------------------------- envio

const canais = computed(() =>
  nota.value ? canaisDoTomador(nota.value.tomador, true) : { app: false, email: false },
)
const podeEnviar = computed(() => canais.value.app || canais.value.email)

function enviar() {
  const n = nota.value
  if (!n) return
  const envio = fin.enviarNota(n.id)
  if (!envio) return
  toast.add({
    severity: 'success',
    summary: `Nota enviada a ${primeiro.value}`,
    detail: `Chega ${porOndeChega(envio, n.tomador.nome)}. No protótipo, nada é enviado.`,
    life: 4500,
  })
}

// ------------------------------------------------------------------------------ consultar

const consultando = ref(false)

function consultar() {
  const n = nota.value
  if (!n) return
  const resposta = fin.consultarNota(n.id)
  if (!resposta) return
  consultando.value = true
  void resposta.finally(() => {
    consultando.value = false
  })
  avisar([n])
}

// -------------------------------------------------------------------------------- corrigir

const doCadastro = computed(() => (conta.value ? tomadorDoCadastro(conta.value) : null))
const cpfDoCadastro = computed(() => {
  const c = doCadastro.value?.cpf ?? ''
  return isValidCpf(c) && stripCpf(c) !== stripCpf(cpf.value) ? formatCpf(c) : ''
})

const erroDoNome = computed(() =>
  nome.value.trim().length < 3 ? 'Digite o nome de quem recebe a nota.' : '',
)
const erroDoCpf = computed(() => {
  if (!stripCpf(cpf.value)) return 'Digite o CPF do responsável: sem ele a prefeitura recusa.'
  if (!isValidCpf(cpf.value)) return 'Este CPF não confere. Confira os dois últimos números.'
  return ''
})

function reenviar() {
  tentou.value = true
  const n = nota.value
  if (!n || erroDoNome.value || erroDoCpf.value) return
  const enviada = fin.reenviarNota(n.id, {
    nome: nome.value.trim(),
    cpf: formatCpf(cpf.value),
    email: email.value.trim(),
    tutorId: n.tomador.tutorId,
  })
  if (!enviada) return
  toast.add({
    severity: 'info',
    summary: 'Nota reenviada à prefeitura',
    detail: 'Com os dados corrigidos. O número chega em instantes.',
    life: 3500,
  })
  avisar([enviada])
  modo.value = 'ver'
  tentou.value = false
}

// -------------------------------------------------------------------------------- cancelar

const prazo = computed(() => (nota.value ? prazoParaCancelar(nota.value) : ''))
const dentroDoPrazo = computed(() =>
  nota.value ? podeCancelar(nota.value, fin.hoje.value) : false,
)
const ajudaDoMotivo = computed(
  () => MOTIVOS_DE_CANCELAMENTO.find((m) => m.tipo === tipoDeCancelamento.value)?.ajuda ?? '',
)
const erroDoMotivo = computed(() =>
  motivo.value.trim().length < 15
    ? 'Explique em uma frase, com pelo menos 15 letras: o texto vai para a prefeitura.'
    : '',
)

function cancelar() {
  tentou.value = true
  const n = nota.value
  if (!n || erroDoMotivo.value) return
  fin.cancelarNota(n.id, tipoDeCancelamento.value, motivo.value.trim())
  toast.add({
    severity: 'success',
    summary: `Nota nº ${numeroDaNota(n.numero ?? 0)} cancelada`,
    detail:
      tipoDeCancelamento.value === 'erro'
        ? 'A conta voltou para A emitir: emita a nota certa de lá. No protótipo, nada é enviado.'
        : 'A conta fica sem nota nova. No protótipo, nada é enviado.',
    life: 5000,
  })
  modo.value = 'ver'
  tentou.value = false
}

// ------------------------------------------------------------------------------ o papel

const imprimindo = ref(false)

/**
 * "Baixar PDF": a folha entra no `body` só agora e sai depois do `afterprint`; o navegador imprime
 * ou salva em PDF. O título da aba vira o nome do arquivo salvo.
 */
async function baixarPdf() {
  const n = nota.value
  if (!n || imprimindo.value) return
  imprimindo.value = true
  await nextTick()
  const tituloAntes = document.title
  document.title =
    n.numero !== null ? `NFS-e ${n.numero} - ${n.tomador.nome}` : `Nota de ${n.tomador.nome}`
  window.addEventListener(
    'afterprint',
    () => {
      document.title = tituloAntes
      imprimindo.value = false
    },
    { once: true },
  )
  window.print()
}
</script>

<template>
  <CadastroGaveta v-model:visible="aberta" :titulo="titulo" icone="ph ph-invoice" largura="40rem">
    <div v-if="nota" class="nf">
      <header class="nf__quem">
        <span
          class="ui-ladrilho"
          :class="{
            'ui-ladrilho--ok': tom === 'ok',
            'ui-ladrilho--atencao': tom === 'atencao',
            'ui-ladrilho--risco': tom === 'risco',
            'ui-ladrilho--neutro': tom === '',
          }"
          aria-hidden="true"
        >
          <i :class="SITUACAO_DA_NOTA[nota.situacao].icone" />
        </span>
        <span class="nf__quem-texto">
          <strong>{{ nota.tomador.nome }}</strong>
          <span>{{ sobreOAtendimento }} · {{ reais(baseDaNota(nota)) }}</span>
        </span>
        <span
          class="ui-selo"
          :class="{
            'ui-selo--ok': tom === 'ok',
            'ui-selo--atencao': tom === 'atencao',
            'ui-selo--risco': tom === 'risco',
          }"
        >
          {{ SITUACAO_DA_NOTA[nota.situacao].rotulo }}
        </span>
      </header>

      <!-- Ver -->
      <template v-if="modo === 'ver'">
        <p v-if="nota.situacao === 'processando'" class="nf__estado nf__estado--atencao">
          <i class="ph ph-hourglass-medium" aria-hidden="true" />
          <span>
            Enviada à prefeitura às {{ nota.hora }} de {{ dataCurta(nota.emitidaEm) }} e ainda sem
            resposta. O número e o código de verificação chegam quando ela responder; dá para
            consultar de novo agora.
          </span>
        </p>
        <p v-else-if="nota.situacao === 'rejeitada'" class="nf__estado nf__estado--risco">
          <i class="ph ph-warning-circle" aria-hidden="true" />
          <span>
            <strong>A prefeitura recusou.</strong> {{ nota.recusa }} Corrija e reenvie: o pedido
            (RPS) continua o mesmo.
          </span>
        </p>
        <p v-else-if="nota.cancelamento" class="nf__estado">
          <i class="ph ph-prohibit" aria-hidden="true" />
          <span>
            <strong
              >Cancelada em {{ dataCurta(nota.cancelamento.data) }} às
              {{ nota.cancelamento.hora }}</strong
            >
            por {{ nota.cancelamento.por }} ({{ motivoDoCancelamento.toLowerCase() }}):
            {{ nota.cancelamento.motivo }}
            <template v-if="substituta && substituta.numero !== null">
              A nota certa é a nº {{ numeroDaNota(substituta.numero) }}.</template
            >
          </span>
        </p>
        <p v-else-if="substituida && substituida.numero !== null" class="nf__estado">
          <i class="ph ph-arrows-clockwise" aria-hidden="true" />
          <span>
            Substitui a nota nº {{ numeroDaNota(substituida.numero) }}, cancelada por erro na
            emissão.
          </span>
        </p>

        <section class="nf__secao" aria-labelledby="nf-nota">
          <h3 id="nf-nota" class="nf__titulo">
            <span class="ui-ladrilho ui-ladrilho--p" aria-hidden="true"
              ><i class="ph ph-file-text"
            /></span>
            A nota
          </h3>
          <dl class="nf__dados">
            <div>
              <dt>Número</dt>
              <dd class="ui-num">
                {{ nota.numero !== null ? numeroDaNota(nota.numero) : 'Ainda sem número' }}
              </dd>
            </div>
            <div>
              <dt>Código de verificação</dt>
              <dd class="ui-num">{{ nota.codigoDeVerificacao ?? 'Vem com a autorização' }}</dd>
            </div>
            <div>
              <dt>Emissão</dt>
              <dd>{{ dataCompleta(nota.emitidaEm) }} às {{ nota.hora }}</dd>
            </div>
            <div>
              <dt>Competência</dt>
              <dd>{{ dataCompleta(nota.competencia) }} (dia do atendimento)</dd>
            </div>
            <div>
              <dt>Pedido (RPS)</dt>
              <dd class="ui-num">
                Série {{ nota.serieRps }}, nº {{ numeroDaNota(nota.numeroRps) }}
              </dd>
            </div>
            <div>
              <dt>Prefeitura</dt>
              <dd>{{ municipio(config.municipio).nome }}</dd>
            </div>
          </dl>
        </section>

        <section class="nf__secao nf__par" aria-label="Prestador e tomador">
          <div class="nf__parte">
            <h3 class="nf__titulo">
              <span class="ui-ladrilho ui-ladrilho--p" aria-hidden="true"
                ><i class="ph ph-buildings"
              /></span>
              Prestador
            </h3>
            <p class="nf__texto">
              <strong>{{ prestador.razaoSocial }}</strong>
              <span>CNPJ {{ prestador.cnpj }}</span>
              <span>Inscrição municipal {{ config.inscricaoMunicipal }}</span>
              <span>{{ REGIMES[config.regime] }}</span>
            </p>
          </div>
          <div class="nf__parte">
            <h3 class="nf__titulo">
              <span class="ui-ladrilho ui-ladrilho--p" aria-hidden="true"
                ><i class="ph ph-user"
              /></span>
              Tomador
            </h3>
            <p class="nf__texto">
              <strong>{{ nota.tomador.nome }}</strong>
              <span :class="{ nf__falta: nota.situacao === 'rejeitada' }"
                >CPF {{ cpfEscrito(nota.tomador.cpf) }}</span
              >
              <span>{{ nota.tomador.email || 'Sem e-mail no cadastro' }}</span>
            </p>
          </div>
        </section>

        <section class="nf__secao" aria-labelledby="nf-servico">
          <h3 id="nf-servico" class="nf__titulo">
            <span class="ui-ladrilho ui-ladrilho--p" aria-hidden="true"
              ><i class="ph ph-stethoscope"
            /></span>
            Serviço
          </h3>
          <p class="nf__codigo">
            <span class="ui-selo">{{ servicoDoCodigo(nota.codigoDoServico).codigo }}</span>
            {{ servicoDoCodigo(nota.codigoDoServico).descricao }}
          </p>
          <ul class="nf__itens">
            <li v-for="(item, indice) in nota.itens" :key="indice">
              <span>
                {{ item.nome }}
                <small v-if="item.quantidade > 1">× {{ item.quantidade }}</small>
              </span>
              <span class="ui-num">{{ reais(item.valor) }}</span>
            </li>
          </ul>
          <p v-if="nota.foraDaNota.length" class="eg__dica nf__fora">
            <i class="ph ph-info" aria-hidden="true" />
            <span>
              Fora desta nota:
              {{ nota.foraDaNota.map((i) => `${i.nome} (${reais(i.valor)})`).join(', ') }}. Produto
              é mercadoria e vai na nota de venda, não na de serviço.
            </span>
          </p>
        </section>

        <section class="nf__secao" aria-labelledby="nf-valores">
          <h3 id="nf-valores" class="nf__titulo">
            <span class="ui-ladrilho ui-ladrilho--p" aria-hidden="true"
              ><i class="ph ph-calculator"
            /></span>
            Valores e ISS
          </h3>
          <dl class="nf__valores">
            <div>
              <dt>Valor dos serviços</dt>
              <dd class="ui-num">{{ reais(nota.valorDosServicos) }}</dd>
            </div>
            <div v-if="nota.desconto">
              <dt>Desconto</dt>
              <dd class="ui-num">− {{ reais(nota.desconto) }}</dd>
            </div>
            <div>
              <dt>ISS ({{ porcento(nota.aliquota, 2) }} sobre {{ reais(baseDaNota(nota)) }})</dt>
              <dd class="ui-num">{{ reais(issDaNota(nota)) }}</dd>
            </div>
            <div class="nf__valor-total">
              <dt>Valor da nota</dt>
              <dd class="ui-num">{{ reais(baseDaNota(nota)) }}</dd>
            </div>
          </dl>
          <p v-if="config.regime === 'simples'" class="eg__dica">
            No Simples Nacional, o ISS já vai na guia do mês: a nota só informa, não cobra à parte.
          </p>
        </section>

        <section
          v-if="nota.situacao === 'autorizada' || nota.situacao === 'cancelada'"
          class="nf__secao"
          aria-labelledby="nf-envio"
        >
          <h3 id="nf-envio" class="nf__titulo">
            <span class="ui-ladrilho ui-ladrilho--p" aria-hidden="true"
              ><i class="ph ph-paper-plane-tilt"
            /></span>
            Para o responsável
          </h3>
          <p class="eg__dica">
            <template v-if="nota.envio">
              Enviada em {{ dataCurta(nota.envio.data) }}: chegou
              {{ porOndeChega(nota.envio, nota.tomador.nome) }}.
            </template>
            <template v-else-if="podeEnviar">Ainda não foi enviada a {{ primeiro }}.</template>
            <template v-else>
              {{ primeiro }} não tem app nem e-mail no cadastro: entregue a nota impressa.
            </template>
          </p>
        </section>

        <section
          v-if="gestao && nota.situacao === 'autorizada'"
          class="nf__secao"
          aria-labelledby="nf-cancelar"
        >
          <h3 id="nf-cancelar" class="nf__titulo">
            <span class="ui-ladrilho ui-ladrilho--p" aria-hidden="true"
              ><i class="ph ph-prohibit"
            /></span>
            Cancelar a nota
          </h3>
          <template v-if="dentroDoPrazo">
            <p class="eg__dica">
              A clínica cancela sozinha até {{ dataCompleta(prazo) }}, o dia 10 do mês seguinte ao
              da emissão. Depois disso, só pedindo à prefeitura.
            </p>
            <Button
              type="button"
              severity="danger"
              outlined
              size="small"
              icon="ph ph-prohibit"
              label="Cancelar esta nota"
              class="nf__cancelar"
              @click="modo = 'cancelar'"
            />
          </template>
          <p v-else class="eg__dica">
            O prazo para a clínica cancelar acabou em {{ dataCompleta(prazo) }} (o dia 10 do mês
            seguinte ao da emissão). Para desfazer, peça o cancelamento à prefeitura e emita uma
            nota nova.
          </p>
        </section>
      </template>

      <!-- Corrigir e reenviar -->
      <form
        v-else-if="modo === 'corrigir'"
        id="nf-corrigir"
        class="nf__form"
        novalidate
        @submit.prevent="reenviar"
      >
        <p class="nf__estado nf__estado--risco">
          <i class="ph ph-warning-circle" aria-hidden="true" />
          <span><strong>A prefeitura recusou.</strong> {{ nota.recusa }}</span>
        </p>
        <p class="eg__dica">
          Acerte quem recebe a nota e mande de novo. O pedido (RPS série {{ nota.serieRps }}, nº
          {{ numeroDaNota(nota.numeroRps) }}) continua o mesmo.
        </p>

        <section class="eg__secao">
          <label class="eg__rotulo" for="nf-nome">Nome do responsável</label>
          <InputText
            id="nf-nome"
            v-model="nome"
            maxlength="120"
            :invalid="tentou && Boolean(erroDoNome)"
          />
          <small v-if="tentou && erroDoNome" class="eg__invalido">{{ erroDoNome }}</small>
        </section>

        <section class="eg__secao">
          <label class="eg__rotulo" for="nf-cpf">CPF</label>
          <InputMask
            id="nf-cpf"
            v-model="cpf"
            mask="999.999.999-99"
            inputmode="numeric"
            :auto-clear="false"
            :invalid="tentou && Boolean(erroDoCpf)"
          />
          <small v-if="tentou && erroDoCpf" class="eg__invalido">{{ erroDoCpf }}</small>
          <span v-if="cpfDoCadastro" class="nf__sugestao">
            <span class="eg__dica"
              >No cadastro de {{ primeiro || 'quem trouxe o pet' }}: {{ cpfDoCadastro }}</span
            >
            <Button
              type="button"
              size="small"
              severity="secondary"
              outlined
              icon="ph ph-arrow-down"
              label="Usar este"
              @click="cpf = cpfDoCadastro"
            />
          </span>
        </section>

        <section class="eg__secao">
          <label class="eg__rotulo" for="nf-email"
            >E-mail <span class="eg__opcional">(opcional)</span></label
          >
          <InputText id="nf-email" v-model="email" type="email" inputmode="email" maxlength="120" />
          <small class="eg__dica">A nota autorizada também vai para este e-mail.</small>
        </section>
      </form>

      <!-- Cancelar -->
      <form v-else id="nf-cancelar-form" class="nf__form" novalidate @submit.prevent="cancelar">
        <p class="eg__dica">
          A nota nº {{ numeroDaNota(nota.numero ?? 0) }}, de {{ reais(baseDaNota(nota)) }}, deixa de
          valer na prefeitura. O pagamento da conta não muda. A clínica pode cancelar até
          {{ dataCompleta(prazo) }}.
        </p>

        <fieldset class="nf__motivos">
          <legend class="eg__rotulo">Por que cancelar</legend>
          <label v-for="m in MOTIVOS_DE_CANCELAMENTO" :key="m.tipo" class="nf__motivo">
            <RadioButton
              v-model="tipoDeCancelamento"
              :value="m.tipo"
              :input-id="`nf-motivo-${m.tipo}`"
              name="motivo-do-cancelamento"
            />
            <span>{{ m.rotulo }}</span>
          </label>
        </fieldset>
        <p class="eg__dica">{{ ajudaDoMotivo }}</p>

        <section class="eg__secao">
          <label class="eg__rotulo" for="nf-motivo">Explique para a prefeitura</label>
          <Textarea
            id="nf-motivo"
            v-model="motivo"
            rows="3"
            auto-resize
            maxlength="255"
            placeholder="Ex.: a consulta foi lançada duas vezes na mesma conta."
            :invalid="tentou && Boolean(erroDoMotivo)"
          />
          <small v-if="tentou && erroDoMotivo" class="eg__invalido">{{ erroDoMotivo }}</small>
        </section>
      </form>
    </div>

    <template #pe>
      <template v-if="modo === 'ver' && nota">
        <Button
          type="button"
          severity="secondary"
          outlined
          label="Fechar"
          @click="aberta = false"
        />
        <template v-if="nota.situacao === 'processando'">
          <Button
            type="button"
            icon="ph ph-arrows-clockwise"
            label="Consultar agora"
            :loading="consultando"
            @click="consultar"
          />
        </template>
        <template v-else-if="nota.situacao === 'rejeitada'">
          <Button
            type="button"
            icon="ph ph-pencil-simple-line"
            label="Corrigir e reenviar"
            @click="modo = 'corrigir'"
          />
        </template>
        <template v-else>
          <Button
            v-if="nota.situacao === 'autorizada'"
            type="button"
            severity="secondary"
            outlined
            icon="ph ph-paper-plane-tilt"
            label="Enviar ao responsável"
            :disabled="!podeEnviar"
            :title="podeEnviar ? undefined : 'Sem app nem e-mail no cadastro'"
            @click="enviar"
          />
          <Button
            type="button"
            icon="ph ph-file-arrow-down"
            label="Baixar PDF"
            title="Abre a impressão: escolha Salvar como PDF"
            @click="baixarPdf"
          />
        </template>
      </template>
      <template v-else-if="nota">
        <Button
          type="button"
          severity="secondary"
          outlined
          icon="ph ph-arrow-left"
          label="Voltar"
          @click="modo = 'ver'"
        />
        <Button
          v-if="modo === 'corrigir'"
          type="submit"
          form="nf-corrigir"
          icon="ph ph-paper-plane-tilt"
          label="Reenviar à prefeitura"
        />
        <Button
          v-else
          type="submit"
          form="nf-cancelar-form"
          severity="danger"
          icon="ph ph-prohibit"
          label="Cancelar a nota"
        />
      </template>
    </template>
  </CadastroGaveta>

  <!-- Só existe durante a impressão: no papel, só ela (`clinic-print-root`). -->
  <FolhaDaNota
    v-if="imprimindo && nota"
    :nota="nota"
    :config="config"
    :gerada-em="dataCompleta(fin.hoje.value)"
  />
</template>

<style scoped>
.nf {
  display: grid;
  gap: 20px;
}

.nf__quem {
  display: flex;
  align-items: center;
  gap: 12px;
}

.nf__quem-texto {
  display: grid;
  flex: 1;
  min-width: 0;
  gap: 2px;
}

.nf__quem-texto strong {
  color: var(--tinta);
  font-size: 16px;
}

.nf__quem-texto span {
  color: var(--tinta-2);
  font-size: 13px;
}

/* A situação da nota, quando ela pede atenção: no pastel do estado, com a tinta dele. */
.nf__estado {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin: 0;
  padding: 12px 14px;
  border-radius: 14px;
  background: var(--superficie-2);
  color: var(--tinta);
  font-size: 13.5px;
  line-height: 1.5;
}

.nf__estado i {
  margin-top: 2px;
  font-size: 17px;
}

.nf__estado--atencao {
  background: var(--atencao-fundo);
  color: var(--atencao-tinta);
}

.nf__estado--risco {
  background: var(--risco-fundo);
  color: var(--risco-tinta);
}

/* Um fio entre as seções, e não uma caixa para cada. */
.nf__secao {
  display: grid;
  gap: 12px;
  padding-top: 18px;
  border-top: 1px solid var(--linha-suave);
}

.nf__titulo {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  color: var(--tinta);
  font-size: 14.5px;
  font-weight: 650;
}

.nf__dados {
  display: grid;
  gap: 12px 18px;
  margin: 0;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.nf__dados dt,
.nf__valores dt {
  color: var(--tinta-2);
  font-size: 12.5px;
}

.nf__dados dd {
  margin: 2px 0 0;
  color: var(--tinta);
  font-size: 14px;
  font-weight: 600;
}

.nf__par {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px 20px;
}

.nf__parte {
  display: grid;
  align-content: start;
  gap: 10px;
  min-width: 0;
}

.nf__texto {
  display: grid;
  gap: 2px;
  margin: 0;
  color: var(--tinta-2);
  font-size: 13px;
  overflow-wrap: anywhere;
}

.nf__texto strong {
  color: var(--tinta);
  font-size: 14px;
}

.nf__falta {
  color: var(--risco-tinta);
  font-weight: 650;
}

.nf__codigo {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--tinta);
  font-size: 13.5px;
}

.nf__itens {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.nf__itens li {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 7px 0;
  color: var(--tinta);
  font-size: 14px;
}

.nf__itens li + li {
  border-top: 1px dashed var(--linha-suave);
}

.nf__itens small {
  color: var(--tinta-2);
  font-size: 12.5px;
}

.nf__fora {
  display: flex;
  align-items: flex-start;
  gap: 6px;
}

.nf__fora i {
  margin-top: 2px;
}

.nf__valores {
  display: grid;
  margin: 0;
}

.nf__valores > div {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 0;
}

.nf__valores dd {
  margin: 0;
  color: var(--tinta);
  font-size: 14px;
  font-weight: 600;
}

.nf__valor-total {
  margin-top: 4px;
  padding: 10px 14px !important;
  border-radius: 14px;
  background: color-mix(in oklab, var(--pets-fundo) 45%, var(--superficie));
}

.nf__valor-total dt {
  color: var(--tinta);
  font-size: 14px;
  font-weight: 650;
}

.nf__valor-total dd {
  font-size: 18px;
  font-weight: 700;
}

.nf__cancelar {
  justify-self: start;
}

.nf__form {
  display: grid;
  gap: 18px;
}

.nf__sugestao {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.nf__motivos {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  border: 0;
}

.nf__motivo {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: var(--tinta);
  font-size: 14px;
  cursor: pointer;
}

@media (max-width: 560px) {
  .nf__par,
  .nf__dados {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
