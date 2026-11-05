<script setup lang="ts">
/**
 * "Este pet em 30 segundos" pela API (E2-03, PJ-AI84L1, guia e2 seção 5.6), na ficha do cadastro:
 * o que chama atenção (risco primeiro), como o pet passou em casa pelo Diário Pet, o peso, a
 * medicação em uso e a carteirinha do app. A API devolve códigos; as frases são do portal (as
 * mesmas da demonstração).
 *
 * Só para quem tem `prontuario.ler` (veterinário, enfermagem e o dono). Sem vínculo ativo com o app,
 * a API recusa (`PET_SEM_ACESSO`) e o cartão diz isso numa linha: propor de novo mora no cartão do
 * app, logo abaixo. Chave desligada pelo responsável vira "não liberado", sem botão. Nada se guarda:
 * cada abertura da ficha lê de novo.
 */
import Button from 'primevue/button'
import Skeleton from 'primevue/skeleton'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import DiarioDoAppGaveta from '@/components/cadastro/DiarioDoAppGaveta.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { INTL_LOCALE, type Locale } from '@/i18n/locales'
import {
  lerRecusa,
  obterResumo,
  sinaisEmOrdem,
  type RecusaDaLeitura,
  type ResumoDoPaciente,
  type SinalDoResumo,
} from '@/service/parceiro/leitura-do-app-service'
import { criarUltimaLeitura } from '@/utils/ultima-leitura'

const props = defineProps<{ pacienteId: string; nome: string }>()

const { t, locale } = useI18n()
const { parceiroQuery } = useParceiroPortal()

const intl = computed(() => INTL_LOCALE[locale.value as Locale])

const resumo = ref<ResumoDoPaciente | null>(null)
const recusa = ref<RecusaDaLeitura | null>(null)
const carregando = ref(true)
const leitura = criarUltimaLeitura()

async function carregar() {
  const vez = leitura.nova()
  carregando.value = true
  recusa.value = null

  try {
    const lido = await obterResumo(props.pacienteId, parceiroQuery())
    if (!leitura.valendo(vez)) return
    resumo.value = lido
  } catch (err) {
    if (!leitura.valendo(vez)) return
    resumo.value = null
    recusa.value = lerRecusa(err, t('leituraApp.erro'))
  } finally {
    if (leitura.valendo(vez)) carregando.value = false
  }
}

/* A ficha troca de paciente sem remontar (o "abrir o que ficou" de um mesclado): lê de novo. */
watch(
  () => props.pacienteId,
  () => {
    resumo.value = null
    void carregar()
  },
  { immediate: true },
)

/* --------------------------------------------------------------------------- formatação */

function data(iso: string) {
  return new Intl.DateTimeFormat(intl.value, { day: '2-digit', month: '2-digit' }).format(
    new Date(iso),
  )
}

function kg(valor: number) {
  return new Intl.NumberFormat(intl.value, { maximumFractionDigits: 1 }).format(valor)
}

function percentual(valor: number) {
  return new Intl.NumberFormat(intl.value, {
    style: 'percent',
    maximumFractionDigits: 1,
    signDisplay: 'always',
  }).format(valor / 100)
}

function lista(nomes: string[]) {
  return new Intl.ListFormat(intl.value, { type: 'conjunction' }).format(nomes)
}

/** Sintomas e achados em frase, só o primeiro em maiúscula: "Vômito e fezes: com sangue". */
function frase(nomes: string[]) {
  return lista(nomes.map((nome, indice) => (indice === 0 ? nome : nome.toLocaleLowerCase())))
}

const rotuloDoCampo = (campo: string) => t(`clinico.diario.campo.${campo}`)
const rotuloDoValor = (campo: string, valor: string) => t(`clinico.diario.${campo}.${valor}`)
const rotuloDoSintoma = (sintoma: string) => t(`clinico.diario.sintomas.${sintoma}`)

/* -------------------------------------------------------------------------------- o topo */

const cabeca = computed(() => {
  const atual = resumo.value
  if (!atual) return ''
  if (atual.primeiraVez || !atual.ultimaConsulta)
    return t('clinico.resumoDoPaciente.essencial.primeiraVez')

  return t('leituraApp.ultimaConsulta', { data: data(atual.ultimaConsulta.em) })
})

/* ------------------------------------------------------------------------------ os sinais */

const sinais = computed(() => sinaisEmOrdem(resumo.value?.sinais ?? []))

function tituloDoSinal(sinal: SinalDoResumo) {
  switch (sinal.tipo) {
    case 'perda-de-peso':
      return sinal.variacao?.continua
        ? t('clinico.resumoDoPaciente.sinais.perdaContinua')
        : t('clinico.resumoDoPaciente.sinais.perda')
    case 'alarme':
      return frase(
        (sinal.achados ?? []).map((achado) =>
          achado.campo === 'sintomas'
            ? rotuloDoSintoma(achado.valor)
            : `${rotuloDoCampo(achado.campo)}: ${rotuloDoValor(achado.campo, achado.valor).toLocaleLowerCase()}`,
        ),
      )
    case 'sintoma-recorrente':
      return sinal.sintoma ? rotuloDoSintoma(sinal.sintoma) : ''
    case 'campo-alterado':
      return sinal.campo && sinal.predominante
        ? `${rotuloDoCampo(sinal.campo)}: ${rotuloDoValor(sinal.campo, sinal.predominante).toLocaleLowerCase()}`
        : ''
    case 'polifarmacia':
      return t('clinico.resumoDoPaciente.sinais.polifarmacia', { total: sinal.total ?? 0 })
    default:
      return ''
  }
}

function detalheDoSinal(sinal: SinalDoResumo) {
  switch (sinal.tipo) {
    case 'perda-de-peso':
      return sinal.variacao
        ? t('clinico.resumoDoPaciente.sinais.perdaDetalhe', {
            de: kg(sinal.variacao.deKg),
            para: kg(sinal.variacao.paraKg),
            percentual: percentual(sinal.variacao.percentual),
            semanas: sinal.variacao.semanas,
          })
        : ''
    case 'alarme':
      return sinal.em ? t('leituraApp.registradoEm', { data: data(sinal.em) }) : ''
    case 'sintoma-recorrente':
      return t('clinico.resumoDoPaciente.sinais.recorrenteDetalhe', { vezes: sinal.vezes ?? 0 })
    case 'campo-alterado':
      return t('clinico.resumoDoPaciente.sinais.campoDetalhe', {
        alterados: sinal.alterados ?? 0,
        total: sinal.total ?? 0,
      })
    case 'polifarmacia':
      return t('clinico.resumoDoPaciente.sinais.polifarmaciaDetalhe')
    default:
      return ''
  }
}

/* ------------------------------------------------------------------------------- em casa */

const diario = computed(() => resumo.value?.diario ?? null)
const diarioNaoLiberado = computed(
  () =>
    resumo.value?.naoLiberado.includes('diario') || diario.value?.motivo === 'SEM_CONSENTIMENTO',
)
const semDiarioNoPlano = computed(() => diario.value?.motivo === 'SEM_DIARIO')

const camposAlterados = computed(() =>
  (diario.value?.campos ?? []).filter((campo) => campo.alterados > 0 && campo.predominante),
)

const sintomasDeCasa = computed(() =>
  (diario.value?.sintomas ?? []).map((item) =>
    item.vezes > 1
      ? t('leituraApp.vezes', { nome: rotuloDoSintoma(item.sintoma), vezes: item.vezes })
      : rotuloDoSintoma(item.sintoma),
  ),
)

/* ---------------------------------------------------------------------------------- peso */

const pesoNaoLiberado = computed(() => resumo.value?.naoLiberado.includes('peso') ?? false)
const pesagens = computed(() => [...(resumo.value?.peso.serie ?? [])].reverse().slice(0, 4))
const variacao = computed(() => resumo.value?.peso.variacao ?? null)

/* --------------------------------------------------------------------------- carteirinha */

const carteirinha = computed(() => resumo.value?.carteirinha ?? null)
const vacinas = computed(() => (carteirinha.value?.vacinas ?? []).slice(0, 3))

const diarioAberto = ref(false)
</script>

<template>
  <section class="ui-folha ui-cartao ra" aria-labelledby="ra-titulo">
    <header class="ui-cartao__cabeca">
      <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-timer" /></span>
      <span class="ui-cartao__titulos">
        <h2 id="ra-titulo" class="ui-cartao__titulo">{{ t('clinico.resumoDoPaciente.titulo') }}</h2>
        <p v-if="cabeca" class="ui-cartao__descricao">{{ cabeca }}</p>
      </span>
      <Button
        v-if="resumo && !diarioNaoLiberado && !semDiarioNoPlano"
        type="button"
        size="small"
        severity="secondary"
        outlined
        icon="ph ph-notebook"
        :label="t('leituraApp.verDiario')"
        @click="diarioAberto = true"
      />
    </header>

    <div v-if="carregando && !resumo" class="ra__esqueleto" aria-busy="true">
      <Skeleton v-for="n in 3" :key="n" height="1.25rem" />
    </div>

    <p v-else-if="recusa?.tipo === 'semVinculo'" class="ra__linha">
      <i class="ph ph-link-break" aria-hidden="true" />
      <span>{{ t('leituraApp.semVinculo') }}</span>
    </p>
    <p v-else-if="recusa?.tipo === 'taxa'" class="ra__linha" role="alert">
      <i class="ph ph-hourglass" aria-hidden="true" />
      <span>{{ t('leituraApp.taxa', { segundos: recusa.segundos ?? 60 }) }}</span>
      <Button
        type="button"
        size="small"
        severity="secondary"
        outlined
        :label="t('cadastro.tentarDeNovo')"
        @click="carregar"
      />
    </p>
    <p v-else-if="recusa" class="eg__erro" role="alert">
      <i class="ph ph-warning-circle" aria-hidden="true" />
      <span>{{
        recusa.tipo === 'outro'
          ? recusa.mensagem
          : recusa.tipo === 'semAcesso'
            ? t('cadastro.ficha.semAcesso')
            : t('leituraApp.erro')
      }}</span>
      <Button
        type="button"
        size="small"
        severity="secondary"
        outlined
        :label="t('cadastro.tentarDeNovo')"
        @click="carregar"
      />
    </p>

    <template v-else-if="resumo">
      <!-- O que chama atenção. -->
      <section class="ra__bloco" aria-labelledby="ra-sinais">
        <h3 id="ra-sinais" class="ra__subtitulo">
          {{ t('clinico.resumoDoPaciente.sinais.titulo') }}
        </h3>
        <ul v-if="sinais.length" class="ra__sinais">
          <li
            v-for="(sinal, indice) in sinais"
            :key="`${sinal.tipo}-${indice}`"
            :class="`ra__sinal ra__sinal--${sinal.severidade}`"
          >
            <i
              :class="sinal.severidade === 'risco' ? 'ph ph-warning-octagon' : 'ph ph-warning'"
              aria-hidden="true"
            />
            <span>
              <strong>{{ tituloDoSinal(sinal) }}</strong>
              <small>{{ detalheDoSinal(sinal) }}</small>
              <small v-if="sinal.tipo === 'alarme' && sinal.relato" class="ra__relato">
                {{ t('clinico.resumoDoPaciente.sinais.relato', { relato: sinal.relato }) }}
              </small>
              <q v-if="sinal.tipo === 'alarme' && sinal.texto" class="ra__fala">{{
                sinal.texto
              }}</q>
            </span>
          </li>
        </ul>
        <p v-else class="ra__nada">{{ t('clinico.resumoDoPaciente.sinais.nadaFora') }}</p>
      </section>

      <!-- Em casa. -->
      <section class="ra__bloco" aria-labelledby="ra-casa">
        <h3 id="ra-casa" class="ra__subtitulo">
          {{
            resumo.primeiraVez
              ? t('clinico.resumoDoPaciente.casa.tituloSemConsulta')
              : t('clinico.resumoDoPaciente.casa.titulo')
          }}
        </h3>
        <p v-if="diarioNaoLiberado" class="ra__nada">
          {{
            t('leituraApp.naoLiberado', {
              chave: t('cadastro.vinculo.consentimento.diarioCompleto'),
            })
          }}
        </p>
        <p v-else-if="semDiarioNoPlano" class="ra__nada">{{ t('leituraApp.semDiario') }}</p>
        <p v-else-if="diario && !diario.total" class="ra__nada">
          {{ t('clinico.resumoDoPaciente.casa.vazioTitulo') }}
        </p>
        <template v-else-if="diario">
          <p class="ra__linha ra__linha--neutra">
            {{ t('clinico.resumoDoPaciente.casa.registros', { total: diario.total }) }} ·
            {{ t('clinico.resumoDoPaciente.casa.semAlteracao', { total: diario.semAlteracao }) }}
          </p>
          <ul v-if="camposAlterados.length || sintomasDeCasa.length" class="ra__fatos">
            <li v-for="campo in camposAlterados" :key="campo.campo">
              <strong>{{ rotuloDoCampo(campo.campo) }}:</strong>
              {{
                t(
                  'clinico.resumoDoPaciente.casa.valorEm',
                  {
                    valor: rotuloDoValor(campo.campo, campo.predominante!),
                    alterados: campo.alterados,
                    total: campo.total,
                  },
                  campo.total,
                )
              }}
            </li>
            <li v-if="sintomasDeCasa.length">
              <strong>{{ rotuloDoCampo('sintomas') }}:</strong> {{ frase(sintomasDeCasa) }}
            </li>
          </ul>
          <template v-if="diario.falas.length">
            <span class="ra__rotulo">{{ t('clinico.resumoDoPaciente.casa.notas') }}</span>
            <q v-for="fala in diario.falas" :key="fala.em" class="ra__fala">{{ fala.texto }}</q>
          </template>
        </template>
      </section>

      <!-- Peso. -->
      <section class="ra__bloco" aria-labelledby="ra-peso">
        <h3 id="ra-peso" class="ra__subtitulo">{{ t('clinico.resumoDoPaciente.peso.titulo') }}</h3>
        <p v-if="variacao" class="ra__linha ra__linha--neutra">
          {{
            t('clinico.resumoDoPaciente.sinais.perdaDetalhe', {
              de: kg(variacao.deKg),
              para: kg(variacao.paraKg),
              percentual: percentual(variacao.percentual),
              semanas: variacao.semanas,
            })
          }}
        </p>
        <ul v-if="pesagens.length" class="ra__pesos">
          <li v-for="pesagem in pesagens" :key="`${pesagem.em}-${pesagem.origem}`">
            <span class="ui-num">{{ data(pesagem.em) }}</span>
            <strong class="ui-num">{{ kg(pesagem.pesoKg) }} kg</strong>
            <small>{{ t(`clinico.resumoDoPaciente.peso.origem.${pesagem.origem}`) }}</small>
          </li>
        </ul>
        <p v-else class="ra__nada">{{ t('clinico.resumoDoPaciente.peso.semPeso') }}</p>
        <p v-if="pesoNaoLiberado" class="ra__nada">
          {{ t('leituraApp.naoLiberado', { chave: t('cadastro.vinculo.consentimento.peso') }) }}
        </p>
      </section>

      <!-- Medicação e carteirinha do app. -->
      <section v-if="carteirinha" class="ra__bloco" aria-labelledby="ra-carteirinha">
        <h3 id="ra-carteirinha" class="ra__subtitulo">{{ t('leituraApp.carteirinha') }}</h3>
        <dl class="ra__dados">
          <div>
            <dt>{{ t('clinico.resumoDoPaciente.essencial.medicacao') }}</dt>
            <dd>
              {{
                resumo.medicacoes.length
                  ? lista(resumo.medicacoes)
                  : t('clinico.resumoDoPaciente.essencial.nenhuma')
              }}
            </dd>
          </div>
          <div>
            <dt>{{ t('leituraApp.alergias') }}</dt>
            <dd>
              <template v-if="carteirinha.alergias.length">
                <span
                  v-for="alergia in carteirinha.alergias"
                  :key="alergia.gatilho"
                  class="ra__item"
                >
                  {{ alergia.gatilho }}
                  <small>
                    {{ t(`acessos.emergencia.categoriaAlergia.${alergia.categoria}`) }}
                    <template v-if="alergia.severidade">
                      · {{ t(`acessos.emergencia.severidade.${alergia.severidade}`) }}
                    </template>
                  </small>
                </span>
              </template>
              <template v-else>{{ t('clinico.resumoDoPaciente.essencial.nenhuma') }}</template>
            </dd>
          </div>
          <div>
            <dt>{{ t('clinico.resumoDoPaciente.essencial.condicoes') }}</dt>
            <dd>
              {{
                carteirinha.diagnosticos.length
                  ? lista(
                      carteirinha.diagnosticos.map((item) =>
                        item.subtipo
                          ? `${t(`acessos.emergencia.categoriaCondicao.${item.categoria}`)} (${item.subtipo})`
                          : t(`acessos.emergencia.categoriaCondicao.${item.categoria}`),
                      ),
                    )
                  : t('clinico.resumoDoPaciente.essencial.nenhuma')
              }}
            </dd>
          </div>
          <div>
            <dt>{{ t('leituraApp.vacinas') }}</dt>
            <dd>
              <template v-if="vacinas.length">
                <span
                  v-for="vacina in vacinas"
                  :key="`${vacina.nome}-${vacina.aplicadaEm}`"
                  class="ra__item"
                >
                  {{ vacina.nome }}
                  <small>
                    <template v-if="vacina.aplicadaEm">{{ data(vacina.aplicadaEm) }}</template>
                    <template v-if="vacina.daClinica">
                      · {{ t('leituraApp.nestaClinica') }}</template
                    >
                    <template v-else-if="vacina.clinicaNome"> · {{ vacina.clinicaNome }}</template>
                  </small>
                </span>
              </template>
              <template v-else>{{ t('clinico.resumoDoPaciente.essencial.nenhuma') }}</template>
            </dd>
          </div>
        </dl>
        <small v-if="carteirinha.truncado" class="eg__dica">{{ t('leituraApp.resumida') }}</small>
      </section>
    </template>

    <DiarioDoAppGaveta v-model:visible="diarioAberto" :paciente-id="pacienteId" :nome="nome" />
  </section>
</template>

<style scoped>
.ra {
  display: grid;
  gap: 14px;
}

.ra__esqueleto {
  display: grid;
  gap: 8px;
}

.ra__bloco {
  display: grid;
  gap: 6px;
  padding-top: 12px;
  border-top: 1px solid var(--linha-suave);
}

.ra__subtitulo {
  margin: 0;
  color: var(--tinta);
  font-size: 13.5px;
  font-weight: 650;
}

.ra__linha,
.ra__nada {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 8px;
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
}

.ra__linha > span {
  flex: 1 1 14rem;
}

.ra__linha > i {
  align-self: flex-start;
  margin-top: 3px;
}

.ra__linha--neutra {
  color: var(--tinta);
}

.ra__sinais,
.ra__fatos,
.ra__pesos {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ra__sinal {
  display: flex;
  gap: 8px;
  font-size: 13.5px;
}

.ra__sinal > span {
  display: grid;
  gap: 1px;
}

.ra__sinal strong {
  color: var(--tinta);
  font-weight: 600;
}

.ra__sinal small {
  color: var(--tinta-2);
  font-size: 12.5px;
}

.ra__sinal i {
  margin-top: 2px;
}

.ra__sinal--risco i {
  color: var(--risco-tinta);
}

.ra__sinal--atencao i {
  color: var(--atencao-tinta, var(--tinta-2));
}

.ra__fatos {
  color: var(--tinta);
  font-size: 13.5px;
}

.ra__fatos strong {
  font-weight: 600;
}

.ra__rotulo {
  color: var(--tinta-2);
  font-size: 12.5px;
}

.ra__fala {
  color: var(--tinta);
  font-size: 13.5px;
  font-style: italic;
  white-space: pre-line;
}

.ra__pesos li {
  display: flex;
  align-items: baseline;
  gap: 10px;
  font-size: 13.5px;
}

.ra__pesos span,
.ra__pesos small {
  color: var(--tinta-2);
}

.ra__pesos strong {
  color: var(--tinta);
}

.ra__dados {
  display: grid;
  gap: 8px;
  margin: 0;
}

.ra__dados div {
  display: grid;
  gap: 2px;
}

.ra__dados dt {
  color: var(--tinta-2);
  font-size: 12.5px;
}

.ra__dados dd {
  display: grid;
  gap: 2px;
  margin: 0;
  color: var(--tinta);
  font-size: 13.5px;
}

.ra__item small {
  margin-inline-start: 6px;
  color: var(--tinta-2);
  font-size: 12.5px;
}
</style>
