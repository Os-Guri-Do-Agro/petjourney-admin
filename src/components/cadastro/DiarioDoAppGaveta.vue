<script setup lang="ts">
/**
 * O Diário Pet do responsável, como a clínica lê (E2-03, guia e2 seções 5.2 e 5.5), numa gaveta da
 * ficha: as entradas do mais recente ao mais antigo, com os campos rotulados pelo portal (a API
 * manda o enum cru) e o texto livre como o responsável escreveu, sempre como texto.
 *
 * Sem `desde`, a API lê desde o último atendimento nesta clínica (ou 30 dias); o seletor vai até 90
 * dias para trás. A foto abre por um link de 15 minutos pedido na hora do clique, nunca guardado.
 */
import Button from 'primevue/button'
import DatePicker from 'primevue/datepicker'
import Skeleton from 'primevue/skeleton'
import { useToast } from 'primevue/usetoast'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { INTL_LOCALE, type Locale } from '@/i18n/locales'
import {
  DIARIO_DIAS_MAX,
  lerDiario,
  lerRecusa,
  urlDaFoto,
  type DiarioParaClinica,
  type EntradaDoDiario,
  type RecusaDaLeitura,
} from '@/service/parceiro/leitura-do-app-service'

const props = defineProps<{ pacienteId: string; nome: string }>()
const visible = defineModel<boolean>('visible', { default: false })

const { t, locale } = useI18n()
const toast = useToast()
const { parceiroQuery } = useParceiroPortal()

const intl = computed(() => INTL_LOCALE[locale.value as Locale])

const diario = ref<DiarioParaClinica | null>(null)
const recusa = ref<RecusaDaLeitura | null>(null)
const carregando = ref(false)
const desde = ref<Date | null>(null)

const hoje = new Date()
const minimo = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - DIARIO_DIAS_MAX)

function diaLocal(data: Date) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(
    data.getDate(),
  ).padStart(2, '0')}`
}

async function carregar() {
  carregando.value = true
  recusa.value = null

  try {
    diario.value = await lerDiario(
      props.pacienteId,
      desde.value ? diaLocal(desde.value) : null,
      parceiroQuery(),
    )
  } catch (err) {
    diario.value = null
    recusa.value = lerRecusa(err, t('leituraApp.erro'))
  } finally {
    carregando.value = false
  }
}

watch(visible, (aberta) => {
  if (!aberta) return

  desde.value = null
  void carregar()
})

function aoTrocarDesde(valor: Date | Date[] | (Date | null)[] | null | undefined) {
  desde.value = valor instanceof Date ? valor : null
  void carregar()
}

/* ----------------------------------------------------------------------------- a entrada */

/** "Ter., 03/11" no título da entrada; "ter., 03/11" no meio da frase. */
function dataLonga(dia: string, maiuscula = true) {
  const texto = new Intl.DateTimeFormat(intl.value, {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    timeZone: 'UTC',
  }).format(new Date(`${dia.slice(0, 10)}T12:00:00Z`))

  return maiuscula ? texto.charAt(0).toLocaleUpperCase() + texto.slice(1) : texto
}

/** Em frase, só o primeiro em maiúscula: "Vômito e coceira". */
function lista(nomes: string[]) {
  return new Intl.ListFormat(intl.value, { type: 'conjunction' }).format(
    nomes.map((nome, indice) => (indice === 0 ? nome : nome.toLocaleLowerCase())),
  )
}

type Linha = { rotulo: string; valor: string }

const CAMPOS_SIMPLES = [
  ['vitalidade', 'vitalidadeOutra'],
  ['alimentacao', 'alimentacaoOutra'],
  ['hidratacao', 'hidratacaoOutra'],
  ['fezes', 'fezesOutro'],
  ['urina', 'urinaOutro'],
] as const

/** Só o que a entrada tem; o "Outro" aparece com o texto do responsável. */
function linhasDa(entrada: EntradaDoDiario): Linha[] {
  const linhas: Linha[] = []

  for (const [campo, outro] of CAMPOS_SIMPLES) {
    const valor = entrada[campo]
    const texto = entrada[outro]
    if (!valor && !texto) continue
    linhas.push({
      rotulo: t(`clinico.diario.campo.${campo}`),
      valor: [valor ? t(`clinico.diario.${campo}.${valor}`) : null, texto]
        .filter(Boolean)
        .join(' · '),
    })
  }

  const sintomas = entrada.sintomas.map((sintoma) => t(`clinico.diario.sintomas.${sintoma}`))
  if (sintomas.length || entrada.sintomasOutros) {
    linhas.push({
      rotulo: t('clinico.diario.campo.sintomas'),
      valor: [sintomas.length ? lista(sintomas) : null, entrada.sintomasOutros]
        .filter(Boolean)
        .join(' · '),
    })
  }

  const doencas = entrada.doencas.map((doenca) => t(`clinico.diario.doencas.${doenca}`))
  if (doencas.length || entrada.doencasOutras) {
    linhas.push({
      rotulo: t('clinico.diario.campo.doencas'),
      valor: [doencas.length ? lista(doencas) : null, entrada.doencasOutras]
        .filter(Boolean)
        .join(' · '),
    })
  }

  if (entrada.cicloCio) {
    linhas.push({
      rotulo: t('leituraApp.campo.cicloCio'),
      valor: t(`leituraApp.cicloCio.${entrada.cicloCio}`),
    })
  }

  const temperamento = entrada.temperamento.map((item) => t(`leituraApp.temperamento.${item}`))
  if (temperamento.length || entrada.temperamentoOutro) {
    linhas.push({
      rotulo: t('leituraApp.campo.temperamento'),
      valor: [temperamento.length ? lista(temperamento) : null, entrada.temperamentoOutro]
        .filter(Boolean)
        .join(' · '),
    })
  }

  if (entrada.remedios)
    linhas.push({ rotulo: t('leituraApp.campo.remedios'), valor: entrada.remedios })
  if (entrada.observacoes) {
    linhas.push({ rotulo: t('leituraApp.campo.observacoes'), valor: entrada.observacoes })
  }
  if (entrada.nota) linhas.push({ rotulo: t('leituraApp.campo.nota'), valor: entrada.nota })

  return linhas
}

/* --------------------------------------------------------------------------------- foto */

const abrindoFoto = ref<string | null>(null)

async function abrirFoto(fotoId: string) {
  abrindoFoto.value = fotoId

  try {
    const resposta = await urlDaFoto(props.pacienteId, fotoId, parceiroQuery())

    if (resposta.url) {
      window.open(resposta.url, '_blank', 'noopener,noreferrer')
      return
    }

    toast.add({
      severity: 'warn',
      summary:
        resposta.motivo === 'FORMATO_NAO_SUPORTADO'
          ? t('leituraApp.foto.formato')
          : t('leituraApp.foto.indisponivel'),
      life: 6000,
    })
  } catch (err) {
    const lida = lerRecusa(err, t('leituraApp.foto.erro'))
    toast.add({
      severity: 'error',
      summary:
        lida.tipo === 'outro'
          ? lida.mensagem
          : lida.tipo === 'semConsentimento'
            ? t('leituraApp.naoLiberado', {
                chave: t('cadastro.vinculo.consentimento.diarioCompleto'),
              })
            : t('leituraApp.foto.erro'),
      life: 6000,
    })
  } finally {
    abrindoFoto.value = null
  }
}

function textoDaRecusa(atual: RecusaDaLeitura) {
  switch (atual.tipo) {
    case 'semVinculo':
      return t('leituraApp.semVinculo')
    case 'semConsentimento':
      return t('leituraApp.naoLiberado', {
        chave: t(`cadastro.vinculo.consentimento.${atual.chave}`),
      })
    case 'taxa':
      return t('leituraApp.taxa', { segundos: atual.segundos ?? 60 })
    case 'outro':
      return atual.mensagem
    default:
      return t('leituraApp.erro')
  }
}
</script>

<template>
  <CadastroGaveta
    v-model:visible="visible"
    :titulo="t('leituraApp.diarioDe', { nome: props.nome })"
    icone="ph ph-notebook"
    largura="34rem"
  >
    <section class="eg__secao">
      <label class="eg__rotulo" for="diario-desde">{{ t('leituraApp.desde') }}</label>
      <DatePicker
        :model-value="desde"
        input-id="diario-desde"
        :min-date="minimo"
        :max-date="hoje"
        show-button-bar
        :placeholder="t('leituraApp.desdeUltimaConsulta')"
        :disabled="carregando"
        @update:model-value="aoTrocarDesde"
      />
      <small v-if="diario" class="eg__dica">
        {{
          t('leituraApp.periodo', {
            de: dataLonga(diario.desde, false),
            ate: dataLonga(diario.ate, false),
          })
        }}
      </small>
    </section>

    <div v-if="carregando && !diario" class="dg__esqueleto" aria-busy="true">
      <Skeleton v-for="n in 4" :key="n" height="3rem" />
    </div>

    <p v-else-if="recusa" class="eg__erro" role="alert">
      <i class="ph ph-warning-circle" aria-hidden="true" />
      <span>{{ textoDaRecusa(recusa) }}</span>
    </p>

    <template v-else-if="diario">
      <p v-if="diario.motivo === 'SEM_DIARIO'" class="dg__nada">{{ t('leituraApp.semDiario') }}</p>
      <p v-else-if="!diario.entradas.length" class="dg__nada">
        {{ t('clinico.resumoDoPaciente.casa.vazioTitulo') }}
      </p>
      <ol v-else class="dg__entradas">
        <li v-for="entrada in diario.entradas" :key="entrada.id" class="dg__entrada">
          <strong class="dg__dia">{{ dataLonga(entrada.data) }}</strong>
          <dl class="dg__campos">
            <div v-for="linha in linhasDa(entrada)" :key="linha.rotulo">
              <dt>{{ linha.rotulo }}</dt>
              <dd>{{ linha.valor }}</dd>
            </div>
          </dl>
          <span v-if="entrada.fotoIds.length" class="dg__fotos">
            <Button
              v-for="(fotoId, indice) in entrada.fotoIds"
              :key="fotoId"
              type="button"
              size="small"
              severity="secondary"
              outlined
              icon="ph ph-image"
              :label="t('leituraApp.foto.abrir', { n: indice + 1 })"
              :loading="abrindoFoto === fotoId"
              @click="abrirFoto(fotoId)"
            />
          </span>
        </li>
      </ol>
      <small v-if="diario.truncado" class="eg__dica">{{ t('leituraApp.truncado') }}</small>
    </template>

    <template #pe>
      <Button
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
.dg__esqueleto {
  display: grid;
  gap: 10px;
}

.dg__nada {
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
}

.dg__entradas {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.dg__entrada {
  display: grid;
  gap: 6px;
  padding: 12px 0;
  border-top: 1px solid var(--linha-suave);
}

.dg__entrada:first-child {
  border-top: 0;
}

.dg__dia {
  color: var(--tinta);
  font-size: 14px;
  font-weight: 650;
}

.dg__campos {
  display: grid;
  gap: 4px;
  margin: 0;
}

.dg__campos div {
  display: grid;
  grid-template-columns: minmax(7rem, auto) 1fr;
  gap: 10px;
  font-size: 13.5px;
}

.dg__campos dt {
  color: var(--tinta-2);
}

.dg__campos dd {
  margin: 0;
  color: var(--tinta);
  white-space: pre-line;
  overflow-wrap: anywhere;
}

.dg__fotos {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
</style>
