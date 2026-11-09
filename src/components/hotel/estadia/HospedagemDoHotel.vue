<script setup lang="ts">
/**
 * A estadia de um animal pela API (E7-04, guia e7 27 e 41): a ficha da entrada (peso, inspeção,
 * alimentação, autorizações, contato de emergência só para quem faz a saída, veterinário), a
 * adaptação, os remédios e cuidados (acrescentar, suspender, encerrar), os pertences, os serviços
 * acrescentados, as fotos (URL assinada pedida ao abrir) e, depois do check-out, a saída (peso,
 * variação, quem retirou). Encerrada pelo óbito ou pela exclusão do cadastro, a saída não se mostra
 * (não houve retirada). Não há dinheiro na estadia.
 *
 * A rotina da estadia (E7-05, guia e7 43 e 44): as ocorrências com a ligação ao responsável (R3), o
 * boletim ao responsável (só para quem cuida da rotina), o diário e a rotina deste hóspede.
 */
import Button from 'primevue/button'
import SelectButton from 'primevue/selectbutton'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute } from 'vue-router'

import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useRotulosDasReservas } from '@/components/hotel/reservas/useRotulosDasReservas'
import BoletinsDaEstadia from '@/components/hotel/rotina/BoletinsDaEstadia.vue'
import DiarioDaEstadia from '@/components/hotel/rotina/DiarioDaEstadia.vue'
import OcorrenciasDaEstadia from '@/components/hotel/rotina/OcorrenciasDaEstadia.vue'
import RotinaDoHospede from '@/components/hotel/rotina/RotinaDoHospede.vue'
import UiPagina from '@/components/ui/UiPagina.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import {
  ADAPTACOES,
  apagarFoto,
  encerrarCuidado,
  lerHospedagem,
  mudarAdaptacao,
  suspenderMedicacao,
  urlDaFoto,
  type Adaptacao,
  type Hospedagem,
} from '@/service/parceiro/hotel-estadia-service'
import { abrirAbaVazia, levarAoArquivo } from '@/utils/arquivo-assinado'

import FotoDaEstadiaGaveta from './FotoDaEstadiaGaveta.vue'
import ItemDaEstadiaGaveta from './ItemDaEstadiaGaveta.vue'
import ServicoDaEstadiaGaveta from './ServicoDaEstadiaGaveta.vue'
import '@/components/hotel/casa/casa.css'

const props = defineProps<{ hospedagemId: string }>()

const { t } = useI18n()
const rotulos = useRotulosDasReservas()
const { store, parceiroQuery } = useParceiroPortal()
const route = useRoute()

const h = ref<Hospedagem | null>(null)
const carregando = ref(false)
const erro = ref('')
const recado = ref('')
const erroDaAcao = ref('')
const mexendo = ref<string | null>(null)

async function carregar() {
  carregando.value = true
  erro.value = ''
  const primeira = !h.value
  try {
    h.value = await lerHospedagem(props.hospedagemId, parceiroQuery())
    /* O atalho do turno e da passagem (#ocorrencias) leva direto à caixa das ocorrências. */
    if (primeira && route.hash === '#ocorrencias') void nextTick(irParaOcorrencias)
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('estadiaDoHotel.erro')).mensagem
  } finally {
    carregando.value = false
  }
}

onMounted(() => void carregar())
watch(
  () => props.hospedagemId,
  () => void carregar(),
)

const escreve = computed(() => Boolean(store.modulo('HOTEL')?.podeEscrever))
const rotina = computed(
  () => escreve.value && store.temPermissao('hotel.rotina') && h.value?.status === 'HOSPEDADO',
)
const checkin = computed(
  () => escreve.value && store.temPermissao('hotel.checkin') && h.value?.status === 'HOSPEDADO',
)
const vende = computed(
  () => escreve.value && store.temPermissao('hotel.reserva') && h.value?.status === 'HOSPEDADO',
)

const resumo = computed(() =>
  h.value
    ? [
        h.value.acomodacaoNome,
        rotulos.periodo(h.value.entradaEm, h.value.saidaEm ?? h.value.saidaPrevista),
        h.value.status === 'ENCERRADA' ? t('estadiaDoHotel.encerrada') : '',
        h.value.atrasado ? t('estadiaDoHotel.alerta.ATRASADO') : '',
      ]
        .filter(Boolean)
        .join(' · ')
    : '',
)

/** Quem cuida da rotina vê o boletim; o veterinário (só `hotel.ler`) não. */
const veBoletim = computed(() => store.temPermissao('hotel.rotina'))
const boletinsRef = ref<InstanceType<typeof BoletinsDaEstadia> | null>(null)
const diarioRef = ref<InstanceType<typeof DiarioDaEstadia> | null>(null)

function irParaOcorrencias() {
  const caixa = document.getElementById('ocorrencias')
  if (!caixa) return
  const calmo = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  caixa.scrollIntoView({ behavior: calmo ? 'auto' : 'smooth', block: 'start' })
}

/* Uma ligação registrada libera o boletim retido; uma ocorrência nova entra no diário. */
function ocorrenciaMudou() {
  void boletinsRef.value?.carregar()
  void diarioRef.value?.carregar()
}

const opcoesDeAdaptacao = computed(() =>
  ADAPTACOES.map((valor) => ({ valor, rotulo: t(`estadiaDoHotel.adaptacao.${valor}`) })),
)

async function fazer(id: string, acao: () => Promise<unknown>, texto = '') {
  erroDaAcao.value = ''
  mexendo.value = id
  try {
    await acao()
    if (texto) recado.value = texto
    await carregar()
  } catch (err) {
    erroDaAcao.value = lerErroDoCadastro(err, t('cadastro.erros.salvar')).mensagem
  } finally {
    mexendo.value = null
  }
}

function trocarAdaptacao(nova: Adaptacao) {
  if (!h.value || nova === h.value.adaptacao) return
  void fazer('adaptacao', () => mudarAdaptacao(h.value!.id, nova, parceiroQuery()))
}

async function verFoto(fotoId: string) {
  const janela = abrirAbaVazia()
  try {
    const { url } = await urlDaFoto(props.hospedagemId, fotoId, parceiroQuery())
    levarAoArquivo(janela, url)
  } catch (err) {
    janela?.close()
    erroDaAcao.value = lerErroDoCadastro(err, t('cadastro.erros.salvar')).mensagem
  }
}

const autorizadas = computed(() =>
  (h.value?.autorizacoes ?? []).map(
    (a) =>
      `${t(`estadiaDoHotel.autorizacao.${a.kind}`)}: ${a.concedida ? t('estadiaDoHotel.sim') : t('estadiaDoHotel.nao')}${
        a.concedida && a.limiteCentavos !== null ? ` (${rotulos.dinheiro(a.limiteCentavos)})` : ''
      }`,
  ),
)

const itemAberto = ref(false)
const tipoDoItem = ref<'MEDICACAO' | 'CUIDADO'>('MEDICACAO')
const fotoAberta = ref(false)
const servicoAberto = ref(false)

function servicoSalvo(texto: string) {
  recado.value = texto
  void carregar()
}

function novoItem(tipo: 'MEDICACAO' | 'CUIDADO') {
  tipoDoItem.value = tipo
  itemAberto.value = true
}
</script>

<template>
  <UiPagina
    :titulo="h?.pacienteNome ?? t('estadiaDoHotel.titulo')"
    :resumo="resumo"
    icone="ph ph-heart"
    :carregando="carregando && !h"
    :erro="h ? '' : erro"
    @tentar-de-novo="carregar"
  >
    <template #voltar>
      <RouterLink to="/hotel/hospedes" class="hd__voltar">
        <i class="ph ph-arrow-left" aria-hidden="true" />
        {{ t('estadiaDoHotel.hospedes.titulo') }}
      </RouterLink>
    </template>
    <template v-if="h" #acoes>
      <Button
        v-if="vende"
        type="button"
        severity="secondary"
        outlined
        icon="ph ph-sparkle"
        :label="t('estadiaDoHotel.servico.titulo')"
        @click="servicoAberto = true"
      />
      <RouterLink :to="`/hotel/reserva/${h.reservaId}`" class="hd__reserva">{{
        t('estadiaDoHotel.verReserva')
      }}</RouterLink>
    </template>

    <div v-if="h" class="hd">
      <p v-if="recado" class="ui-folha hd__recado" role="status">
        <i class="ph ph-check-circle" aria-hidden="true" /><span>{{ recado }}</span>
      </p>
      <p v-if="erroDaAcao" class="ui-folha hd__recado hd__recado--erro" role="alert">
        <i class="ph ph-warning-circle" aria-hidden="true" /><span>{{ erroDaAcao }}</span>
      </p>
      <p
        v-if="h.encerradaPeloObito || h.encerradaPelaExclusao"
        class="ui-folha hd__recado hd__recado--atencao"
      >
        <i class="ph ph-info" aria-hidden="true" />
        <span>{{
          h.encerradaPeloObito ? t('estadiaDoHotel.peloObito') : t('estadiaDoHotel.pelaExclusao')
        }}</span>
      </p>

      <section class="ui-folha ui-cartao" aria-labelledby="hd-ficha">
        <header class="ui-cartao__cabeca">
          <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-clipboard-text" /></span>
          <span class="ui-cartao__titulos">
            <h2 id="hd-ficha" class="ui-cartao__titulo">{{ t('estadiaDoHotel.ficha') }}</h2>
            <p class="ui-cartao__descricao">
              {{
                t('estadiaDoHotel.recebidoPor', {
                  nome: h.recebidoPorNome,
                  quando: rotulos.quando(h.entradaEm),
                })
              }}
            </p>
          </span>
        </header>
        <dl class="hd__fatos">
          <div>
            <dt>{{ t('estadiaDoHotel.checkin.adaptacao') }}</dt>
            <dd>
              <SelectButton
                v-if="rotina"
                :model-value="h.adaptacao"
                :options="opcoesDeAdaptacao"
                option-label="rotulo"
                option-value="valor"
                :allow-empty="false"
                :aria-label="t('estadiaDoHotel.checkin.adaptacao')"
                :disabled="mexendo !== null"
                @update:model-value="trocarAdaptacao"
              />
              <span v-else>{{ t(`estadiaDoHotel.adaptacao.${h.adaptacao}`) }}</span>
            </dd>
          </div>
          <div>
            <dt>{{ t('estadiaDoHotel.checkin.peso') }}</dt>
            <dd>
              {{ rotulos.numero(h.pesoEntradaKg, 2) }} kg<template v-if="h.inspecaoDeEntrada">
                · {{ h.inspecaoDeEntrada }}</template
              >
            </dd>
          </div>
          <div v-if="h.planoAlimentar">
            <dt>{{ t('estadiaDoHotel.checkin.alimentacao') }}</dt>
            <dd>
              {{
                [
                  h.planoAlimentar.racaoPropria
                    ? t('estadiaDoHotel.racaoPropria')
                    : t('estadiaDoHotel.racaoDaCasa'),
                  h.planoAlimentar.marca ?? '',
                  `${h.planoAlimentar.porcaoGramas} g`,
                  h.planoAlimentar.horarios.join(', '),
                  h.planoAlimentar.restricoes ?? '',
                  h.planoAlimentar.petiscos ?? '',
                ]
                  .filter(Boolean)
                  .join(' · ')
              }}
            </dd>
          </div>
          <div>
            <dt>{{ t('estadiaDoHotel.checkin.autorizacoes') }}</dt>
            <dd>{{ autorizadas.join('; ') }}</dd>
          </div>
          <div v-if="h.contatoEmergencia">
            <dt>{{ t('estadiaDoHotel.checkin.emergencia') }}</dt>
            <dd>
              {{
                [
                  h.contatoEmergencia.nome,
                  h.contatoEmergencia.telefone,
                  h.contatoEmergencia.relacao ?? '',
                ]
                  .filter(Boolean)
                  .join(' · ')
              }}
            </dd>
          </div>
          <div v-if="h.veterinario">
            <dt>{{ t('estadiaDoHotel.checkin.veterinario') }}</dt>
            <dd>
              {{
                [
                  h.veterinario.nome,
                  h.veterinario.clinica ?? '',
                  h.veterinario.telefone ?? '',
                  h.veterinario.telefonePlantao ?? '',
                ]
                  .filter(Boolean)
                  .join(' · ')
              }}
            </dd>
          </div>
          <div v-if="h.observacao">
            <dt>{{ t('estadiaDoHotel.checkin.observacao') }}</dt>
            <dd>{{ h.observacao }}</dd>
          </div>
        </dl>
      </section>

      <OcorrenciasDaEstadia
        :hospedagem-id="h.id"
        :pode-escrever="rotina"
        @mudou="ocorrenciaMudou"
      />
      <BoletinsDaEstadia
        v-if="veBoletim"
        ref="boletinsRef"
        :hospedagem-id="h.id"
        :paciente="h.pacienteNome"
        :pode-escrever="rotina"
        @ir-para-ocorrencias="irParaOcorrencias"
      />
      <DiarioDaEstadia ref="diarioRef" :hospedagem-id="h.id" :pode-escrever="rotina" />
      <RotinaDoHospede :hospedagem-id="h.id" :pode-escrever="rotina" />

      <section class="ui-folha ui-cartao" aria-labelledby="hd-remedios">
        <header class="ui-cartao__cabeca">
          <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-pill" /></span>
          <span class="ui-cartao__titulos"
            ><h2 id="hd-remedios" class="ui-cartao__titulo">
              {{ t('estadiaDoHotel.checkin.remedios') }}
            </h2></span
          >
          <Button
            v-if="rotina"
            type="button"
            size="small"
            icon="ph ph-plus"
            :label="t('estadiaDoHotel.checkin.acrescentarRemedio')"
            @click="novoItem('MEDICACAO')"
          />
        </header>
        <p v-if="!h.medicacoes.length" class="ca__nota">{{ t('estadiaDoHotel.semRemedios') }}</p>
        <ul v-else class="ui-lista">
          <li v-for="m in h.medicacoes" :key="m.id" class="ui-linha">
            <span class="ui-linha__texto">
              <span class="ca__nome">
                <strong class="ui-linha__titulo">{{ m.descricao }}</strong>
                <span v-if="m.suspensaEm" class="ui-selo ui-selo--contorno">{{
                  t('estadiaDoHotel.suspensa')
                }}</span>
              </span>
              <span class="ui-linha__meta">{{
                [
                  t(`estadiaDoHotel.via.${m.via}`),
                  m.doseTexto,
                  m.horarios.join(', '),
                  m.semReceita
                    ? t('estadiaDoHotel.semReceitaMeta', { motivo: m.motivoSemReceita })
                    : (m.receita ?? ''),
                ]
                  .filter(Boolean)
                  .join(' · ')
              }}</span>
            </span>
            <span v-if="rotina && !m.suspensaEm" class="ui-linha__fim">
              <Button
                type="button"
                size="small"
                severity="secondary"
                outlined
                :label="t('estadiaDoHotel.suspender')"
                :loading="mexendo === m.id"
                @click="fazer(m.id, () => suspenderMedicacao(h!.id, m.id, parceiroQuery()))"
              />
            </span>
          </li>
        </ul>
      </section>

      <section class="ui-folha ui-cartao" aria-labelledby="hd-cuidados">
        <header class="ui-cartao__cabeca">
          <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-first-aid-kit" /></span>
          <span class="ui-cartao__titulos"
            ><h2 id="hd-cuidados" class="ui-cartao__titulo">
              {{ t('estadiaDoHotel.checkin.cuidados') }}
            </h2></span
          >
          <Button
            v-if="rotina"
            type="button"
            size="small"
            icon="ph ph-plus"
            :label="t('estadiaDoHotel.checkin.acrescentarCuidado')"
            @click="novoItem('CUIDADO')"
          />
        </header>
        <p v-if="!h.cuidados.length" class="ca__nota">{{ t('estadiaDoHotel.semCuidados') }}</p>
        <ul v-else class="ui-lista">
          <li v-for="c in h.cuidados" :key="c.id" class="ui-linha">
            <span class="ui-linha__texto">
              <span class="ca__nome">
                <strong class="ui-linha__titulo">{{ c.descricao }}</strong>
                <span v-if="c.encerradoEm" class="ui-selo ui-selo--contorno">{{
                  t('estadiaDoHotel.encerrado')
                }}</span>
              </span>
              <span class="ui-linha__meta">{{
                [c.horarios.join(', '), c.observacao ?? ''].filter(Boolean).join(' · ')
              }}</span>
            </span>
            <span v-if="rotina && !c.encerradoEm" class="ui-linha__fim">
              <Button
                type="button"
                size="small"
                severity="secondary"
                outlined
                :label="t('estadiaDoHotel.encerrar')"
                :loading="mexendo === c.id"
                @click="fazer(c.id, () => encerrarCuidado(h!.id, c.id, parceiroQuery()))"
              />
            </span>
          </li>
        </ul>
      </section>

      <section v-if="h.pertences.length" class="ui-folha ui-cartao" aria-labelledby="hd-pertences">
        <header class="ui-cartao__cabeca">
          <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-backpack" /></span>
          <span class="ui-cartao__titulos"
            ><h2 id="hd-pertences" class="ui-cartao__titulo">
              {{ t('estadiaDoHotel.checkin.pertences') }}
            </h2></span
          >
        </header>
        <ul class="ui-lista">
          <li v-for="p in h.pertences" :key="p.id" class="ui-linha">
            <span class="ui-linha__texto">
              <strong class="ui-linha__titulo">{{ p.quantidade }}× {{ p.descricao }}</strong>
              <span v-if="p.conferidoEm" class="ui-linha__meta">{{
                p.devolvido
                  ? t('estadiaDoHotel.checkout.devolvido')
                  : t('estadiaDoHotel.checkout.naoDevolvido', { obs: p.observacao ?? '' })
              }}</span>
            </span>
          </li>
        </ul>
      </section>

      <section class="ui-folha ui-cartao" aria-labelledby="hd-fotos">
        <header class="ui-cartao__cabeca">
          <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-camera" /></span>
          <span class="ui-cartao__titulos"
            ><h2 id="hd-fotos" class="ui-cartao__titulo">
              {{ t('estadiaDoHotel.fotos.titulo') }}
            </h2></span
          >
          <Button
            v-if="checkin"
            type="button"
            size="small"
            icon="ph ph-upload-simple"
            :label="t('estadiaDoHotel.fotos.enviar')"
            @click="fotoAberta = true"
          />
        </header>
        <p v-if="!h.fotos.length" class="ca__nota">{{ t('estadiaDoHotel.fotos.vazio') }}</p>
        <ul v-else class="ui-lista">
          <li v-for="f in h.fotos" :key="f.id" class="ui-linha">
            <span class="ui-linha__texto">
              <strong class="ui-linha__titulo">{{
                t(`estadiaDoHotel.momento.${f.momento}`)
              }}</strong>
              <span class="ui-linha__meta">{{
                [rotulos.quando(f.registradaEm), f.legenda ?? ''].filter(Boolean).join(' · ')
              }}</span>
            </span>
            <span class="ui-linha__fim ca__acoes">
              <Button
                type="button"
                size="small"
                severity="secondary"
                outlined
                icon="ph ph-image"
                :aria-label="t('estadiaDoHotel.fotos.ver')"
                @click="verFoto(f.id)"
              />
              <Button
                v-if="checkin"
                type="button"
                size="small"
                severity="secondary"
                outlined
                icon="ph ph-trash"
                :aria-label="t('estadiaDoHotel.fotos.apagar')"
                :loading="mexendo === f.id"
                @click="fazer(f.id, () => apagarFoto(h!.id, f.id, parceiroQuery()))"
              />
            </span>
          </li>
        </ul>
      </section>

      <section
        v-if="h.status === 'ENCERRADA' && !h.encerradaPeloObito && !h.encerradaPelaExclusao"
        class="ui-folha ui-cartao"
        aria-labelledby="hd-saida"
      >
        <header class="ui-cartao__cabeca">
          <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-sign-out" /></span>
          <span class="ui-cartao__titulos"
            ><h2 id="hd-saida" class="ui-cartao__titulo">{{ t('estadiaDoHotel.saida') }}</h2></span
          >
          <span v-if="h.perdaRelevante" class="ui-selo ui-selo--atencao">{{
            t('estadiaDoHotel.perdaRelevante')
          }}</span>
        </header>
        <dl class="hd__fatos">
          <div>
            <dt>{{ t('estadiaDoHotel.saidaEm') }}</dt>
            <dd>
              {{ rotulos.quando(h.saidaEm)
              }}<template v-if="h.saidaInformada">
                ·
                {{
                  t('estadiaDoHotel.saidaInformada', { motivo: h.saidaInformada.motivo })
                }}</template
              >
            </dd>
          </div>
          <div>
            <dt>{{ t('estadiaDoHotel.checkout.pesoSaidaRotulo') }}</dt>
            <dd>
              {{
                h.pesoSaidaKg !== null
                  ? `${rotulos.numero(h.pesoSaidaKg, 2)} kg`
                  : t('estadiaDoHotel.checkout.semPesoRegistrado', {
                      motivo: h.semPesoMotivo ?? '',
                    })
              }}
              <template v-if="h.variacaoDePesoDecimos !== null">
                · {{ rotulos.numero(h.variacaoDePesoDecimos / 10, 1) }}%</template
              >
            </dd>
          </div>
          <div v-if="h.retirada">
            <dt>{{ t('estadiaDoHotel.checkout.quemRetira') }}</dt>
            <dd>
              {{
                [
                  h.retirada.nome ?? t(`estadiaDoHotel.forma.${h.retirada.forma}`),
                  h.retirada.foraDaLista ? t('estadiaDoHotel.foraDaLista') : '',
                  h.retirada.documentoTipo && h.retirada.documentoFinal
                    ? `${t(`estadiaDoHotel.documento.${h.retirada.documentoTipo}`)} ${t('reservasDoHotel.autorizados.final', { final: h.retirada.documentoFinal })}`
                    : '',
                ]
                  .filter(Boolean)
                  .join(' · ')
              }}
            </dd>
          </div>
          <div v-if="h.entreguePorNome">
            <dt>{{ t('estadiaDoHotel.entreguePor') }}</dt>
            <dd>{{ h.entreguePorNome }}</dd>
          </div>
        </dl>
      </section>
    </div>

    <template v-if="h">
      <ItemDaEstadiaGaveta
        v-model:visible="itemAberto"
        :hospedagem-id="h.id"
        :tipo="tipoDoItem"
        @salvo="carregar"
      />
      <FotoDaEstadiaGaveta v-model:visible="fotoAberta" :hospedagem-id="h.id" @enviada="carregar" />
      <ServicoDaEstadiaGaveta
        v-model:visible="servicoAberto"
        :hospedagem-id="h.id"
        :reserva-id="h.reservaId"
        @salvo="servicoSalvo"
      />
    </template>
  </UiPagina>
</template>

<style scoped>
.hd {
  display: grid;
  gap: 20px;
}

.hd__voltar {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--tinta-2);
  font-size: 13.5px;
  text-decoration: none;
}

.hd__reserva {
  align-self: center;
  color: inherit;
  font-size: 14px;
  font-weight: 600;
}

.hd__recado {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin: 0;
  padding: 14px 20px;
  color: var(--tinta);
  font-size: 14px;
}

.hd__recado > i {
  margin-top: 2px;
  color: var(--ok-tinta);
  font-size: 17px;
}

.hd__recado--erro > i {
  color: var(--risco-tinta);
}

.hd__recado--atencao > i {
  color: var(--atencao-tinta);
}

.hd__fatos {
  display: grid;
  margin: 0;
  padding: 0 10px 8px;
}

.hd__fatos > div {
  display: grid;
  grid-template-columns: minmax(8rem, 12rem) 1fr;
  gap: 16px;
  padding: 12px 0;
  border-bottom: 1px solid var(--linha-suave, var(--linha));
  font-size: 14px;
  line-height: 1.45;
}

.hd__fatos > div:last-child {
  border-bottom: 0;
}

.hd__fatos dt {
  color: var(--tinta-2);
}

.hd__fatos dd {
  margin: 0;
  color: var(--tinta);
}
</style>
