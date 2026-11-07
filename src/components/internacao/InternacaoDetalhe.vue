<script setup lang="ts">
/**
 * Uma internação pela API (E5-01, guia e5 4, 10, 12, 20.2, 21.1 e 22): o estado (leito,
 * gravidade, previsão de alta), o caso (motivo, diagnóstico, observação interna, responsável), o
 * que mudou e, encerrada, o desfecho.
 *
 * - Mudar de leito, a gravidade e a previsão: `internacao.executar` (inclui a enfermagem).
 * - Editar o caso e encerrar: `internacao.prescrever` com CRMV.
 * - O encerramento administrativo só aparece para quem tem `estabelecimento.editar` e não
 *   prescreve (a API confere que não há veterinário apto).
 * - Sem registro há 72 h: o aviso de que as doses e o boletim automático pararam.
 * - O animal também hospedado: a medicação do hotel, só leitura.
 *
 * O cuidado (E5-02): as prescrições, o checklist e a evolução, logo depois do estado; o boletim ao
 * responsável (E5-03) em seguida.
 */
import Button from 'primevue/button'
import SelectButton from 'primevue/selectbutton'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useRotulosDoCadastro } from '@/components/cadastro/useRotulosDoCadastro'
import UiPagina from '@/components/ui/UiPagina.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { invalidarPendenciasDoPortal } from '@/composables/usePendenciasDoPortal'
import {
  emCurso,
  GRAVIDADES,
  lerInternacao,
  mudarGravidade,
  type Gravidade,
  type Internacao,
} from '@/service/parceiro/internacao-service'
import { listarProfissionais, type Profissional } from '@/service/parceiro/profissionais-service'

import BoletinsDaInternacao from './BoletinsDaInternacao.vue'
import ChecklistDaInternacao from './ChecklistDaInternacao.vue'
import EditarCasoGaveta from './EditarCasoGaveta.vue'
import EncerrarAdministrativoGaveta from './EncerrarAdministrativoGaveta.vue'
import EncerrarInternacaoGaveta from './EncerrarInternacaoGaveta.vue'
import EvolucoesDaInternacao from './EvolucoesDaInternacao.vue'
import MudarLeitoGaveta from './MudarLeitoGaveta.vue'
import PrescricoesDaInternacao from './PrescricoesDaInternacao.vue'
import PrevisaoDeAltaGaveta from './PrevisaoDeAltaGaveta.vue'
import { TOM_DA_GRAVIDADE, TOM_DO_STATUS } from './rotulos-da-internacao'

const props = defineProps<{ internacaoId: string }>()

const { t, te, locale } = useI18n()
const rotulos = useRotulosDoCadastro()
const { store, parceiroQuery } = useParceiroPortal()

const internacao = ref<Internacao | null>(null)
const carregando = ref(false)
const erro = ref('')
const profissionais = ref<Profissional[]>([])

async function carregar() {
  carregando.value = true
  erro.value = ''
  try {
    internacao.value = await lerInternacao(props.internacaoId, parceiroQuery())
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('internacao.erroAoCarregarUma')).mensagem
  } finally {
    carregando.value = false
  }
}

onMounted(async () => {
  void carregar()
  profissionais.value = await listarProfissionais({ ...parceiroQuery(), ativo: true }).catch(
    () => [],
  )
})
watch(
  () => props.internacaoId,
  () => void carregar(),
)

const clinicaEscreve = computed(() => Boolean(store.modulo('CLINICA')?.podeEscrever))
const aberta = computed(() => Boolean(internacao.value && emCurso(internacao.value.status)))
const podeExecutar = computed(
  () => aberta.value && clinicaEscreve.value && store.temPermissao('internacao.executar'),
)
const podePrescrever = computed(
  () => aberta.value && clinicaEscreve.value && store.temPermissao('internacao.prescrever'),
)
/* O checklist e a evolução: quem executa (a enfermagem também), mesmo depois de encerrada (só lê). */
const executa = computed(() => clinicaEscreve.value && store.temPermissao('internacao.executar'))

const checklist = ref<InstanceType<typeof ChecklistDaInternacao> | null>(null)
const prescricoes = ref<InstanceType<typeof PrescricoesDaInternacao> | null>(null)

/** Prescrever muda as doses; a evolução pode mudar a gravidade: relê o que depende. */
function cuidadoMudou() {
  void checklist.value?.carregar()
  void carregar()
}

const podeAdministrativo = computed(
  () =>
    aberta.value &&
    clinicaEscreve.value &&
    !store.temPermissao('internacao.prescrever') &&
    store.temPermissao('estabelecimento.editar'),
)

/* --------------------------------------------------------------------------- datas */

function instante(valor: string | null) {
  if (!valor) return ''
  return new Date(valor).toLocaleString(locale.value, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const pesoFormatado = computed(() =>
  internacao.value
    ? new Intl.NumberFormat(locale.value, { maximumFractionDigits: 2 }).format(
        internacao.value.pesoEntradaKg,
      )
    : '',
)

/** O leito com o tipo, sem repetir quando o nome já é o tipo ("UTI"). */
function rotuloDoLeito(leito: { nome: string; kind: Internacao['leito']['kind'] }) {
  const tipo = t(`internacao.kind.${leito.kind}`)
  return leito.nome.trim().toLocaleLowerCase() === tipo.toLocaleLowerCase()
    ? leito.nome
    : `${leito.nome} · ${tipo}`
}

/** A via do hotel vem em código (ORAL, TOPICA...): o rótulo do bulário, quando existe. */
function via(codigo: string) {
  return te(`clinico.bulario.api.via.${codigo}`) ? t(`clinico.bulario.api.via.${codigo}`) : codigo
}

const resumo = computed(() => {
  const item = internacao.value
  if (!item) return ''
  return [
    rotuloDoLeito(item.leito),
    item.encerrada
      ? t(`internacao.status.${item.status}`)
      : t('internacao.horas', { n: item.horasInternado }, item.horasInternado),
    t('internacao.respondePor', { nome: item.responsavel.nome }),
  ].join(' · ')
})

/* ------------------------------------------------------------------------- gravidade */

const opcoesDeGravidade = computed(() =>
  GRAVIDADES.map((valor) => ({ valor, rotulo: t(`internacao.gravidade.${valor}`) })),
)
const mudandoGravidade = ref(false)
const erroDaGravidade = ref('')

async function trocarGravidade(nova: Gravidade) {
  const atual = internacao.value
  if (!atual || nova === atual.gravidade) return
  mudandoGravidade.value = true
  erroDaGravidade.value = ''
  try {
    const resposta = await mudarGravidade(atual.id, nova, parceiroQuery())
    internacao.value = resposta
    invalidarPendenciasDoPortal()
  } catch (err) {
    erroDaGravidade.value = lerErroDoCadastro(err, t('cadastro.erros.salvar')).mensagem
  } finally {
    mudandoGravidade.value = false
  }
}

/* --------------------------------------------------------------------- o histórico */

const mudancas = computed(() => {
  const item = internacao.value
  if (!item) return []
  const lista = [
    ...item.mudancasDeLeito.map((mudanca) => ({
      em: mudanca.em,
      texto: t('internacao.historico.leito', { de: mudanca.de.nome, para: mudanca.para.nome }),
      detalhe: mudanca.motivo ?? '',
      icone: 'ph ph-arrows-left-right',
    })),
    ...item.mudancasDeGravidade.map((mudanca) => ({
      em: mudanca.em,
      texto: t('internacao.historico.gravidade', {
        de: t(`internacao.gravidade.${mudanca.de}`),
        para: t(`internacao.gravidade.${mudanca.para}`),
      }),
      detalhe: '',
      icone: 'ph ph-pulse',
    })),
  ]
  return lista.sort((a, b) => b.em.localeCompare(a.em))
})
const historicoAberto = ref(false)
const historicoVisivel = computed(() =>
  historicoAberto.value ? mudancas.value : mudancas.value.slice(0, 3),
)

/* ---------------------------------------------------------------------- as gavetas */

const casoAberto = ref(false)
const leitoAberto = ref(false)
const previsaoAberta = ref(false)
const encerrarAberta = ref(false)
const administrativoAberta = ref(false)
/** O que o encerramento deixou (óbito no cadastro, agenda cancelada, avisos). */
const recado = ref<string[]>([])

function atualizou(nova: Internacao) {
  internacao.value = nova
  invalidarPendenciasDoPortal()
}

function encerrou(encerrada: Internacao) {
  const bloco = encerrada.encerramento
  const linhas: string[] = [t(`internacao.encerrar.feito.${encerrada.status}`)]
  if (bloco?.obito) {
    linhas.push(
      t('internacao.encerrar.obitoFeito', {
        dia: rotulos.dia(bloco.obito.obitoEm),
        agenda: bloco.obito.agendamentosCancelados,
        vinculos: bloco.obito.vinculosEncerrados,
      }),
    )
    if (bloco.obito.hospedagensEncerradas) linhas.push(t('internacao.encerrar.hotelEncerrado'))
  }
  for (const aviso of bloco?.avisos ?? []) linhas.push(t(`internacao.encerrar.aviso.${aviso}`))
  recado.value = linhas
  internacao.value = encerrada
  invalidarPendenciasDoPortal()
}
</script>

<template>
  <UiPagina
    :titulo="internacao?.paciente.nome ?? t('internacao.titulo')"
    :resumo="resumo"
    icone="ph ph-bed"
    :carregando="carregando && !internacao"
    :erro="internacao ? '' : erro"
    @tentar-de-novo="carregar"
  >
    <template #voltar>
      <RouterLink to="/clinica/internacao" class="id__voltar">
        <i class="ph ph-arrow-left" aria-hidden="true" />
        {{ t('internacao.titulo') }}
      </RouterLink>
    </template>

    <template v-if="internacao" #acoes>
      <Button
        v-if="podeAdministrativo"
        type="button"
        severity="secondary"
        outlined
        icon="ph ph-clipboard-text"
        :label="t('internacao.administrativo.acao')"
        @click="administrativoAberta = true"
      />
      <Button
        v-if="podePrescrever"
        type="button"
        icon="ph ph-sign-out"
        :label="t('internacao.encerrar.acao')"
        @click="encerrarAberta = true"
      />
    </template>

    <div v-if="internacao" class="id">
      <p v-if="recado.length" class="ui-folha id__recado" role="status">
        <i class="ph ph-check-circle" aria-hidden="true" />
        <span>
          <span v-for="linha in recado" :key="linha" class="id__recado-linha">{{ linha }}</span>
        </span>
      </p>

      <p v-if="internacao.abertaSemRegistro" class="ui-folha id__parado" role="status">
        <i class="ph ph-pause-circle" aria-hidden="true" />
        <span>{{ t('internacao.semRegistro', { n: internacao.abertaSemRegistro.horas }) }}</span>
      </p>

      <!-- O estado: onde está, quão grave, quando sai. -->
      <section class="ui-folha ui-cartao" aria-labelledby="id-estado">
        <header class="ui-cartao__cabeca">
          <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-heartbeat" /></span>
          <span class="ui-cartao__titulos">
            <h2 id="id-estado" class="ui-cartao__titulo">{{ t('internacao.estado.titulo') }}</h2>
          </span>
          <span
            class="ui-selo"
            :class="
              TOM_DO_STATUS[internacao.status] ? `ui-selo--${TOM_DO_STATUS[internacao.status]}` : ''
            "
            >{{ t(`internacao.status.${internacao.status}`) }}</span
          >
        </header>
        <dl class="id__fatos">
          <div class="id__fato">
            <dt>{{ t('internacao.gravidadeRotulo') }}</dt>
            <dd>
              <SelectButton
                v-if="podeExecutar"
                :model-value="internacao.gravidade"
                :options="opcoesDeGravidade"
                option-label="rotulo"
                option-value="valor"
                :allow-empty="false"
                :aria-label="t('internacao.gravidadeRotulo')"
                :disabled="mudandoGravidade"
                @update:model-value="trocarGravidade"
              />
              <span
                v-else
                class="ui-selo"
                :class="`ui-selo--${TOM_DA_GRAVIDADE[internacao.gravidade]}`"
                >{{ t(`internacao.gravidade.${internacao.gravidade}`) }}</span
              >
              <small v-if="erroDaGravidade" class="eg__invalido">{{ erroDaGravidade }}</small>
            </dd>
          </div>
          <div class="id__fato">
            <dt>{{ t('internacao.leito') }}</dt>
            <dd class="id__com-acao">
              <span>{{ rotuloDoLeito(internacao.leito) }}</span>
              <Button
                v-if="podeExecutar"
                type="button"
                size="small"
                severity="secondary"
                outlined
                icon="ph ph-arrows-left-right"
                :label="t('internacao.mudarLeito.acao')"
                @click="leitoAberto = true"
              />
            </dd>
          </div>
          <div class="id__fato">
            <dt>{{ t('internacao.previsao') }}</dt>
            <dd class="id__com-acao">
              <span>{{
                internacao.altaPrevistaEm
                  ? instante(internacao.altaPrevistaEm)
                  : t('internacao.semPrevisao')
              }}</span>
              <Button
                v-if="podeExecutar"
                type="button"
                size="small"
                severity="secondary"
                outlined
                icon="ph ph-calendar-check"
                :label="internacao.altaPrevistaEm ? t('internacao.mudar') : t('internacao.definir')"
                @click="previsaoAberta = true"
              />
            </dd>
          </div>
          <div class="id__fato">
            <dt>{{ t('internacao.entrada') }}</dt>
            <dd>
              {{ instante(internacao.entradaEm) }} ·
              {{ t('internacao.pesoDeEntrada', { peso: pesoFormatado }) }}
            </dd>
          </div>
        </dl>
      </section>

      <!-- O cuidado (E5-02): o checklist da hora, as prescrições e a evolução do plantão. -->
      <template v-if="store.temPermissao('internacao.executar')">
        <ChecklistDaInternacao
          ref="checklist"
          :internacao-id="internacao.id"
          :pode-registrar="executa"
          @mudou="carregar"
        />
        <PrescricoesDaInternacao
          ref="prescricoes"
          :internacao-id="internacao.id"
          :especie="internacao.paciente.especie"
          :pode-prescrever="podePrescrever"
          @mudou="cuidadoMudou"
        />
        <EvolucoesDaInternacao
          :internacao-id="internacao.id"
          :gravidade-atual="internacao.gravidade"
          :pode-evoluir="aberta && executa"
          @mudou="carregar"
          @desatualizada="carregar"
        />
      </template>

      <!-- O boletim ao responsável (E5-03): a conversa, a ligação e o envio. -->
      <BoletinsDaInternacao
        v-if="store.temPermissao('boletim.compor') || store.temPermissao('boletim.enviar')"
        :internacao-id="internacao.id"
        :paciente="internacao.paciente.nome"
        :encerrada="internacao.encerrada"
        :profissionais="profissionais"
      />

      <!-- O caso: o que a equipe precisa saber, nunca no mapa. -->
      <section class="ui-folha ui-cartao" aria-labelledby="id-caso">
        <header class="ui-cartao__cabeca">
          <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-clipboard-text" /></span>
          <span class="ui-cartao__titulos">
            <h2 id="id-caso" class="ui-cartao__titulo">{{ t('internacao.caso.titulo') }}</h2>
          </span>
          <Button
            v-if="podePrescrever"
            type="button"
            size="small"
            severity="secondary"
            outlined
            icon="ph ph-pencil-simple"
            :label="t('internacao.caso.editar')"
            @click="casoAberto = true"
          />
        </header>
        <dl class="id__fatos">
          <div class="id__fato">
            <dt>{{ t('internacao.motivo') }}</dt>
            <dd>{{ internacao.motivo }}</dd>
          </div>
          <div class="id__fato">
            <dt>{{ t('internacao.diagnostico') }}</dt>
            <dd :class="{ id__vazio: !internacao.diagnosticoDeTrabalho }">
              {{ internacao.diagnosticoDeTrabalho || t('internacao.naoInformado') }}
            </dd>
          </div>
          <div v-if="internacao.observacao" class="id__fato">
            <dt>{{ t('internacao.observacao') }}</dt>
            <dd>{{ internacao.observacao }}</dd>
          </div>
          <div class="id__fato">
            <dt>{{ t('internacao.responsavel') }}</dt>
            <dd>
              {{ internacao.responsavel.nome }}
              <small
                v-if="internacao.internadoPor.id !== internacao.responsavel.id"
                class="id__nota"
              >
                {{ t('internacao.internadoPor', { nome: internacao.internadoPor.nome }) }}
              </small>
            </dd>
          </div>
          <div class="id__fato">
            <dt>{{ t('internacao.paciente') }}</dt>
            <dd class="id__links">
              <RouterLink :to="`/clinica/ficha/${internacao.paciente.id}`">{{
                t('internacao.abrirFicha')
              }}</RouterLink>
              <RouterLink
                v-if="internacao.atendimentoId"
                :to="`/clinica/atendimento/${internacao.atendimentoId}`"
                >{{ t('internacao.abrirAtendimento') }}</RouterLink
              >
            </dd>
          </div>
        </dl>
      </section>

      <!-- O animal também hospedado: o que ele tomava no hotel, só leitura. -->
      <section
        v-if="internacao.medicacaoDaEstadia?.medicacoes.length"
        class="ui-folha ui-cartao"
        aria-labelledby="id-hotel"
      >
        <header class="ui-cartao__cabeca">
          <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-house-line" /></span>
          <span class="ui-cartao__titulos">
            <h2 id="id-hotel" class="ui-cartao__titulo">{{ t('internacao.hotel.titulo') }}</h2>
            <p class="ui-cartao__descricao">{{ t('internacao.hotel.descricao') }}</p>
          </span>
        </header>
        <ul class="ui-lista">
          <li
            v-for="(item, indice) in internacao.medicacaoDaEstadia.medicacoes"
            :key="`${item.descricao}-${indice}`"
            class="ui-linha"
          >
            <span class="ui-linha__texto">
              <strong class="ui-linha__titulo">{{ item.descricao }}</strong>
              <span class="ui-linha__meta">
                {{
                  [item.doseTexto, via(item.via), item.horarios.join(', ')]
                    .filter(Boolean)
                    .join(' · ')
                }}
              </span>
              <span v-if="item.ultimaDose" class="ui-linha__meta">{{
                t('internacao.hotel.ultima', {
                  quando: instante(item.ultimaDose.em),
                  quem: item.ultimaDose.porNome ?? '',
                })
              }}</span>
            </span>
          </li>
        </ul>
      </section>

      <!-- O desfecho, quando acabou. -->
      <section v-if="internacao.encerrada" class="ui-folha ui-cartao" aria-labelledby="id-desfecho">
        <header class="ui-cartao__cabeca">
          <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-sign-out" /></span>
          <span class="ui-cartao__titulos">
            <h2 id="id-desfecho" class="ui-cartao__titulo">{{ t('internacao.desfechoTitulo') }}</h2>
          </span>
        </header>
        <dl class="id__fatos">
          <div class="id__fato">
            <dt>{{ t(`internacao.status.${internacao.status}`) }}</dt>
            <dd>{{ instante(internacao.encerradaEm) }}</dd>
          </div>
          <div v-if="internacao.orientacaoDeSaida" class="id__fato">
            <dt>{{ t('internacao.encerrar.orientacao') }}</dt>
            <dd class="id__texto">{{ internacao.orientacaoDeSaida }}</dd>
          </div>
          <div v-if="internacao.avisadoPorTelefone" class="id__fato">
            <dt>{{ t('internacao.avisado') }}</dt>
            <dd>
              {{ instante(internacao.avisadoPorTelefone.em) }} ·
              {{ internacao.avisadoPorTelefone.por.nome }}
            </dd>
          </div>
          <div v-if="internacao.motivoEncerramentoAdministrativo" class="id__fato">
            <dt>{{ t('internacao.administrativo.motivo') }}</dt>
            <dd class="id__texto">{{ internacao.motivoEncerramentoAdministrativo }}</dd>
          </div>
        </dl>
      </section>

      <!-- O que mudou: leito e gravidade, da mais nova. -->
      <section v-if="mudancas.length" class="ui-folha ui-cartao" aria-labelledby="id-historico">
        <header class="ui-cartao__cabeca">
          <span class="ui-ladrilho" aria-hidden="true"
            ><i class="ph ph-clock-counter-clockwise"
          /></span>
          <span class="ui-cartao__titulos">
            <h2 id="id-historico" class="ui-cartao__titulo">
              {{ t('internacao.historico.titulo') }}
            </h2>
          </span>
        </header>
        <ul class="ui-lista">
          <li
            v-for="(item, indice) in historicoVisivel"
            :key="`${item.em}-${indice}`"
            class="ui-linha"
          >
            <span class="ui-ladrilho ui-ladrilho--p" aria-hidden="true"
              ><i :class="item.icone"
            /></span>
            <span class="ui-linha__texto">
              <strong class="ui-linha__titulo">{{ item.texto }}</strong>
              <span class="ui-linha__meta">{{
                [instante(item.em), item.detalhe].filter(Boolean).join(' · ')
              }}</span>
            </span>
          </li>
        </ul>
        <Button
          v-if="mudancas.length > 3"
          type="button"
          size="small"
          severity="secondary"
          outlined
          class="id__mais"
          :label="
            historicoAberto
              ? t('internacao.historico.menos')
              : t('internacao.historico.todas', { n: mudancas.length })
          "
          @click="historicoAberto = !historicoAberto"
        />
      </section>
    </div>

    <template #sempre>
      <EditarCasoGaveta
        v-model:visible="casoAberto"
        :internacao="internacao"
        :profissionais="profissionais"
        @salvo="atualizou"
      />
      <MudarLeitoGaveta v-model:visible="leitoAberto" :internacao="internacao" @mudou="atualizou" />
      <PrevisaoDeAltaGaveta
        v-model:visible="previsaoAberta"
        :internacao="internacao"
        @mudou="atualizou"
      />
      <EncerrarInternacaoGaveta
        v-model:visible="encerrarAberta"
        :internacao="internacao"
        :profissionais="profissionais"
        @encerrada="encerrou"
      />
      <EncerrarAdministrativoGaveta
        v-model:visible="administrativoAberta"
        :internacao="internacao"
        @encerrada="encerrou"
      />
    </template>
  </UiPagina>
</template>

<style scoped>
.id {
  display: grid;
  gap: 20px;
}

.id__voltar {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--tinta-2);
  font-size: 13.5px;
  text-decoration: none;
}

.id__voltar:hover {
  color: var(--tinta);
}

.id__recado,
.id__parado {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin: 0;
  padding: 14px 20px;
  color: var(--tinta);
  font-size: 14px;
  line-height: 1.5;
}

.id__recado > i {
  margin-top: 2px;
  color: var(--ok-tinta);
  font-size: 17px;
}

.id__parado > i {
  margin-top: 2px;
  color: var(--atencao-tinta);
  font-size: 17px;
}

.id__recado-linha {
  display: block;
}

.id__fatos {
  display: grid;
  margin: 0;
  padding: 0 24px 8px;
}

.id__fato {
  display: grid;
  grid-template-columns: minmax(9rem, 13rem) 1fr;
  align-items: center;
  gap: 16px;
  padding: 12px 0;
  border-bottom: 1px solid var(--linha-suave);
  font-size: 14px;
  line-height: 1.45;
}

.id__fato:last-child {
  border-bottom: 0;
}

.id__fato dt {
  color: var(--tinta-2);
}

.id__fato dd {
  display: grid;
  min-width: 0;
  gap: 4px;
  margin: 0;
  color: var(--tinta);
  justify-items: start;
}

.id__com-acao {
  display: flex !important;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 12px;
}

.id__vazio {
  color: var(--tinta-3) !important;
}

.id__nota {
  color: var(--tinta-2);
  font-size: 12.5px;
}

.id__texto {
  white-space: pre-line;
  overflow-wrap: anywhere;
}

.id__links {
  display: flex !important;
  flex-wrap: wrap;
  gap: 16px;
}

.id__links a {
  color: var(--tinta);
}

.id__mais {
  justify-self: start;
  margin: 0 24px 16px;
}

@media (max-width: 720px) {
  .id__fato {
    grid-template-columns: 1fr;
    gap: 6px;
  }
}
</style>
