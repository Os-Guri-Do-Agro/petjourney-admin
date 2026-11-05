<script setup lang="ts">
/**
 * As vagas para a fila (E3-04, seções 5.4 e 5.5), numa gaveta: os horários liberados (cancelamento,
 * remarcação, falta com tempo útil) ainda livres e no futuro, com os três primeiros da fila que
 * cabem, já na ordem do servidor. "Ofertar" troca a gaveta para a oferta: a mensagem da clínica,
 * revista, com o prazo da política dentro (o app cita, o push nunca leva).
 *
 * Depois de ofertar, a gaveta diz o que acontece: o aviso sai no próximo minuto, ou "sem canal no
 * app: ligue para o responsável", e os avisos do horário. A oferta não segura o horário (D2).
 */
import Button from 'primevue/button'
import Skeleton from 'primevue/skeleton'
import Textarea from 'primevue/textarea'
import { useToast } from 'primevue/usetoast'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { quandoCurto, textoDaFaixa } from '@/components/fila/leitura-da-fila'
import { chaveDoConflito, conflitosQueAvisam } from '@/components/pedidos/leitura-do-pedido'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { INTL_LOCALE, type Locale } from '@/i18n/locales'
import type { TipoDeAtendimento } from '@/service/parceiro/agenda-config-service'
import {
  horaDoInstante,
  listarVagas,
  ofertar,
  TEXTO_MAX,
  type CandidatoDaVaga,
  type OfertaFeita,
  type VagaDaFila,
} from '@/service/parceiro/fila-service'
import type { Profissional } from '@/service/parceiro/profissionais-service'

const props = defineProps<{
  tipos: TipoDeAtendimento[]
  profissionais: Profissional[]
  /** `ofertaDeVagaMinutos` da política (seção 1.6): o prazo que a mensagem diz. */
  prazoMinutos: number | null
  podeOfertar: boolean
}>()
const emit = defineEmits<{ ofertou: [] }>()
const visible = defineModel<boolean>('visible', { default: false })

const { t, locale } = useI18n()
const toast = useToast()
const { parceiroQuery } = useParceiroPortal()

const intl = computed(() => INTL_LOCALE[locale.value as Locale])

const vagas = ref<VagaDaFila[]>([])
const carregando = ref(false)
const erro = ref('')

async function carregar() {
  carregando.value = true
  erro.value = ''

  try {
    vagas.value = (await listarVagas({}, parceiroQuery())).itens
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('fila.erroAoCarregar')).mensagem
  } finally {
    carregando.value = false
  }
}

watch(visible, (aberta) => {
  if (!aberta) return

  emOferta.value = null
  feita.value = null
  void carregar()
})

const nomeDoProfissional = (id: string | null) =>
  id ? (props.profissionais.find((item) => item.id === id)?.nome ?? '') : ''
const nomeDoTipo = (id: string) => props.tipos.find((tipo) => tipo.id === id)?.nome ?? ''

function janelasDe(candidato: CandidatoDaVaga) {
  return candidato.janelasAgrupadas
    .map((faixa) => textoDaFaixa(faixa, intl.value, (chave, valores) => t(chave, valores)))
    .join(' · ')
}

/* ------------------------------------------------------------------------------ ofertar */

const emOferta = ref<{ vaga: VagaDaFila; candidato: CandidatoDaVaga } | null>(null)
const mensagem = ref('')
const enviando = ref(false)
const feita = ref<OfertaFeita | null>(null)

function abrirOferta(vaga: VagaDaFila, candidato: CandidatoDaVaga) {
  emOferta.value = { vaga, candidato }
  feita.value = null

  /* A oferta não segura o horário (D2): o texto pede resposta no prazo, sem prometer a vaga. */
  const [data = '', hora = ''] = quandoCurto(vaga.inicio, intl.value).split(' · ')
  mensagem.value = t(
    props.prazoMinutos ? 'fila.mensagemPadrao.comPrazo' : 'fila.mensagemPadrao.semPrazo',
    {
      paciente: candidato.paciente.nome,
      data: data.toLocaleLowerCase(),
      hora,
      minutos: props.prazoMinutos ?? 0,
    },
  ).slice(0, TEXTO_MAX)
}

async function enviarOferta() {
  const atual = emOferta.value
  if (!atual) return

  enviando.value = true

  try {
    feita.value = await ofertar(
      atual.candidato.entradaId,
      {
        inicio: atual.vaga.inicio,
        profissionalId: atual.vaga.profissionalId,
        mensagem: mensagem.value.trim() || undefined,
      },
      parceiroQuery(),
    )
    toast.add({ severity: 'success', summary: t('fila.ofertada'), life: 3000 })
    emit('ofertou')
  } catch (err) {
    const lido = lerErroDoCadastro(err, t('cadastro.erros.salvar'))
    const conhecidos = [
      'OFERTA_JA_ABERTA',
      'VAGA_JA_PREENCHIDA',
      'FILA_HORARIO_NAO_E_MAIS_CEDO',
      'FILA_ENCERRADA',
      'CONFLITO_BLOQUEANTE',
    ]
    toast.add({
      severity: 'error',
      summary: conhecidos.includes(lido.codigo) ? t(`fila.erro.${lido.codigo}`) : lido.mensagem,
      life: 7000,
    })
    if (lido.codigo === 'VAGA_JA_PREENCHIDA') {
      emOferta.value = null
      void carregar()
    }
  } finally {
    enviando.value = false
  }
}

function voltarAsVagas() {
  emOferta.value = null
  feita.value = null
  void carregar()
}

const avisosDoHorario = computed(() => conflitosQueAvisam(feita.value?.conflitos ?? []))
</script>

<template>
  <CadastroGaveta
    v-model:visible="visible"
    :titulo="emOferta ? t('clinico.fila.ofertarVaga') : t('fila.vagas')"
    icone="ph ph-calendar-check"
    largura="34rem"
  >
    <!-- A oferta. -->
    <template v-if="emOferta">
      <section class="eg__secao">
        <span class="eg__rotulo">{{ t('fila.horario') }}</span>
        <p class="vg__destaque">
          <strong
            >{{ quandoCurto(emOferta.vaga.inicio, intl) }}–{{
              horaDoInstante(emOferta.vaga.fim)
            }}</strong
          >
          <span>{{ nomeDoProfissional(emOferta.vaga.profissionalId) }}</span>
        </p>
      </section>
      <section class="eg__secao">
        <span class="eg__rotulo">{{ t('fila.paciente') }}</span>
        <p class="vg__destaque">
          <strong>{{ emOferta.candidato.paciente.nome }}</strong>
          <span>
            {{ emOferta.candidato.paciente.clienteNome }} ·
            {{ nomeDoTipo(emOferta.candidato.tipoId) }}
          </span>
        </p>
        <p v-if="!emOferta.candidato.temCanalNoApp" class="vg__nota">
          <i class="ph ph-phone" aria-hidden="true" />
          {{ t('fila.semCanal') }}
        </p>
      </section>

      <template v-if="!feita">
        <section class="eg__secao">
          <label class="eg__rotulo" for="vg-mensagem">{{ t('fila.mensagem') }}</label>
          <Textarea
            id="vg-mensagem"
            v-model="mensagem"
            rows="4"
            auto-resize
            :maxlength="TEXTO_MAX"
            :disabled="enviando"
          />
          <small class="eg__dica">{{ t('fila.mensagemDica') }}</small>
        </section>
      </template>

      <section v-else class="eg__secao vg__feita" role="status">
        <p class="vg__nota vg__nota--ok">
          <i class="ph ph-check-circle" aria-hidden="true" />
          {{
            feita.aviso.semCanalNoApp
              ? t('fila.semCanalLigue')
              : t('fila.saiEmUmMinuto', {
                  hora: feita.entrada.oferta ? horaDoInstante(feita.entrada.oferta.expiraEm) : '',
                })
          }}
        </p>
        <ul v-if="avisosDoHorario.length" class="vg__avisos">
          <li v-for="(conflito, indice) in avisosDoHorario" :key="indice">
            <i class="ph ph-warning" aria-hidden="true" />
            {{ t(chaveDoConflito(conflito)) }}
          </li>
        </ul>
      </section>
    </template>

    <!-- As vagas. -->
    <template v-else>
      <p v-if="erro" class="eg__erro" role="alert">
        <i class="ph ph-warning-circle" aria-hidden="true" />
        <span>{{ erro }}</span>
      </p>
      <div v-else-if="carregando && !vagas.length" class="vg__esqueleto" aria-busy="true">
        <Skeleton v-for="n in 3" :key="n" height="4rem" />
      </div>
      <p v-else-if="!vagas.length" class="vg__vazio">{{ t('fila.semVagas') }}</p>
      <ol v-else class="vg__vagas">
        <li v-for="vaga in vagas" :key="vaga.id" class="vg__vaga">
          <header class="vg__cabeca">
            <strong class="ui-num">
              {{ quandoCurto(vaga.inicio, intl) }}–{{ horaDoInstante(vaga.fim) }}
            </strong>
            <span>
              {{ nomeDoProfissional(vaga.profissionalId) }} · {{ t(`fila.origem.${vaga.origem}`) }}
            </span>
            <small v-if="!vaga.ofertaManual && vaga.tentativasAutomaticas > 0">
              {{ t('fila.automaticas', { n: vaga.tentativasAutomaticas }) }}
            </small>
            <small v-if="vaga.ofertasAbertas">
              {{ t('fila.ofertasAbertas', { n: vaga.ofertasAbertas }, vaga.ofertasAbertas) }}
            </small>
          </header>
          <ul class="vg__candidatos">
            <li v-for="candidato in vaga.candidatos" :key="candidato.entradaId">
              <span class="vg__candidato">
                <strong>
                  {{ candidato.paciente.nome }}
                  <span
                    v-if="candidato.prioridade !== 'NORMAL'"
                    class="ui-selo"
                    :class="
                      candidato.prioridade === 'URGENTE' ? 'ui-selo--risco' : 'ui-selo--atencao'
                    "
                  >
                    {{ t(`clinico.fila.prioridade.${candidato.prioridade.toLowerCase()}`) }}
                  </span>
                </strong>
                <small>
                  {{ candidato.paciente.clienteNome }} · {{ janelasDe(candidato) }}
                  <template v-if="candidato.jaOfertadoNesteHorario">
                    · {{ t('fila.jaOfertado') }}
                  </template>
                  <template v-if="!candidato.temCanalNoApp"> · {{ t('fila.soTelefone') }}</template>
                </small>
              </span>
              <Button
                v-if="props.podeOfertar"
                type="button"
                size="small"
                :label="t('fila.ofertar')"
                @click="abrirOferta(vaga, candidato)"
              />
            </li>
          </ul>
          <small v-if="vaga.totalCandidatos > vaga.candidatos.length" class="vg__mais">
            {{ t('fila.maisCandidatos', { n: vaga.totalCandidatos - vaga.candidatos.length }) }}
          </small>
        </li>
      </ol>
    </template>

    <template #pe>
      <template v-if="emOferta">
        <Button
          type="button"
          :label="feita ? t('fila.voltarAsVagas') : t('cadastro.cancelar')"
          severity="secondary"
          outlined
          :disabled="enviando"
          @click="voltarAsVagas"
        />
        <Button
          v-if="!feita"
          type="button"
          icon="ph ph-paper-plane-tilt"
          :label="t('fila.ofertar')"
          :loading="enviando"
          @click="enviarOferta"
        />
      </template>
      <Button
        v-else
        type="button"
        :label="t('agenda.config.expediente.fechar')"
        severity="secondary"
        outlined
        @click="visible = false"
      />
    </template>
  </CadastroGaveta>
</template>

<style scoped>
.vg__esqueleto {
  display: grid;
  gap: 10px;
}

.vg__vazio {
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
}

.vg__vagas {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.vg__vaga {
  display: grid;
  gap: 8px;
  padding: 12px 0;
  border-top: 1px solid var(--linha-suave);
}

.vg__vaga:first-child {
  border-top: 0;
}

.vg__cabeca {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 10px;
  color: var(--tinta-2);
  font-size: 13px;
}

.vg__cabeca strong {
  color: var(--tinta);
  font-size: 14.5px;
}

.vg__candidatos {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.vg__candidatos li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.vg__candidato {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.vg__candidato strong {
  color: var(--tinta);
  font-size: 14px;
  font-weight: 600;
}

.vg__candidato small,
.vg__mais {
  color: var(--tinta-2);
  font-size: 12.5px;
}

.vg__destaque {
  display: grid;
  gap: 2px;
  margin: 0;
}

.vg__destaque strong {
  color: var(--tinta);
  font-size: 15px;
}

.vg__destaque span {
  color: var(--tinta-2);
  font-size: 13.5px;
}

.vg__nota {
  display: flex;
  gap: 8px;
  margin: 0;
  color: var(--tinta-2);
  font-size: 13px;
}

.vg__nota i {
  margin-top: 2px;
}

.vg__nota--ok {
  color: var(--tinta);
  font-size: 14px;
}

.vg__avisos {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
  color: var(--tinta-2);
  font-size: 13px;
}

.vg__avisos li {
  display: flex;
  gap: 8px;
}
</style>
