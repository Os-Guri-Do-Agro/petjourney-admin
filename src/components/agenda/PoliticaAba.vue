<script setup lang="ts">
/**
 * Política da clínica (E3-01, seção 1.6): os prazos que a clínica combina com quem marca pelo app.
 * O app recebe os números prontos e nunca os fixa. As faixas vêm da própria API (`limites`): a
 * tela não fixa número nenhum. Fora da faixa, 400 `POLITICA_FORA_DO_LIMITE` com o `campo`, que a
 * tela marca. Mudar a política não reescreve o que já está marcado: vale para o que vier depois.
 *
 * O interruptor "Ofertar vagas sozinho ao primeiro da fila" (E3-04) vai no mesmo `PUT`.
 */
import Button from 'primevue/button'
import InputNumber from 'primevue/inputnumber'
import Select from 'primevue/select'
import Skeleton from 'primevue/skeleton'
import ToggleSwitch from 'primevue/toggleswitch'
import { useToast } from 'primevue/usetoast'
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import {
  obterPolitica,
  salvarPolitica,
  type Politica,
} from '@/service/parceiro/agenda-config-service'

import '@/components/parceiro/estabelecimento/gaveta.css'

const props = defineProps<{ podeEditar: boolean }>()

const { t } = useI18n()
const toast = useToast()
const { parceiroQuery } = useParceiroPortal()

type CampoNumerico =
  | 'cancelarAteHorasAntes'
  | 'reservaMinutos'
  | 'preConsultaAbreHorasAntes'
  | 'ofertaDeVagaMinutos'
  | 'confirmacaoAbreHorasAntes'

const CAMPOS: { campo: CampoNumerico; unidade: 'h' | 'min' }[] = [
  { campo: 'cancelarAteHorasAntes', unidade: 'h' },
  { campo: 'confirmacaoAbreHorasAntes', unidade: 'h' },
  { campo: 'preConsultaAbreHorasAntes', unidade: 'h' },
  { campo: 'reservaMinutos', unidade: 'min' },
  { campo: 'ofertaDeVagaMinutos', unidade: 'min' },
]

/**
 * Os números por assunto, cada um com o que ele muda: a grade da agenda, o que o app deixa fazer,
 * o pedido de horário e a fila de espera. Seis campos soltos lado a lado não diziam de que a tela
 * tratava.
 */
const GRUPOS: { chave: 'agenda' | 'app' | 'pedido' | 'fila'; campos: CampoNumerico[] }[] = [
  { chave: 'agenda', campos: [] },
  {
    chave: 'app',
    campos: ['cancelarAteHorasAntes', 'confirmacaoAbreHorasAntes', 'preConsultaAbreHorasAntes'],
  },
  { chave: 'pedido', campos: ['reservaMinutos'] },
  { chave: 'fila', campos: ['ofertaDeVagaMinutos'] },
]

function unidadeDe(campo: CampoNumerico) {
  return CAMPOS.find((item) => item.campo === campo)?.unidade ?? 'min'
}

const politica = ref<Politica | null>(null)
const carregando = ref(true)
const erro = ref('')
const salvando = ref(false)
const erroDoCampo = ref<{ campo: string; texto: string } | null>(null)

const valores = reactive({
  granularidadeMinutos: 10,
  cancelarAteHorasAntes: 2,
  reservaMinutos: 5,
  preConsultaAbreHorasAntes: 72,
  ofertaDeVagaMinutos: 30,
  confirmacaoAbreHorasAntes: 48,
  ofertaAutomaticaFila: true,
})

function aplicar(atual: Politica) {
  politica.value = atual
  valores.granularidadeMinutos = atual.granularidadeMinutos
  valores.cancelarAteHorasAntes = atual.cancelarAteHorasAntes
  valores.reservaMinutos = atual.reservaMinutos
  valores.preConsultaAbreHorasAntes = atual.preConsultaAbreHorasAntes
  valores.ofertaDeVagaMinutos = atual.ofertaDeVagaMinutos
  valores.confirmacaoAbreHorasAntes = atual.confirmacaoAbreHorasAntes
  valores.ofertaAutomaticaFila = atual.ofertaAutomaticaFila
}

async function carregar() {
  carregando.value = true
  erro.value = ''

  try {
    aplicar(await obterPolitica(parceiroQuery()))
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('agenda.config.erroAoCarregar')).mensagem
  } finally {
    carregando.value = false
  }
}

onMounted(() => void carregar())

const opcoesDaGrade = computed(() =>
  (politica.value?.limites.granularidadeMinutos ?? [5, 10, 15, 20, 30, 60]).map((valor) => ({
    valor,
    rotulo: t('agenda.config.tipo.minutos', { n: valor }),
  })),
)

function faixa(campo: CampoNumerico) {
  return politica.value?.limites[campo] ?? { min: 0, max: 999 }
}

const foraDaFaixa = computed(() =>
  CAMPOS.filter(({ campo }) => {
    const { min, max } = faixa(campo)
    const valor = valores[campo]
    return typeof valor !== 'number' || valor < min || valor > max
  }).map(({ campo }) => campo),
)

async function salvar() {
  erroDoCampo.value = null
  if (foraDaFaixa.value.length) return

  salvando.value = true

  try {
    aplicar(
      await salvarPolitica(
        {
          granularidadeMinutos: valores.granularidadeMinutos as 5 | 10 | 15 | 20 | 30 | 60,
          cancelarAteHorasAntes: valores.cancelarAteHorasAntes,
          reservaMinutos: valores.reservaMinutos,
          preConsultaAbreHorasAntes: valores.preConsultaAbreHorasAntes,
          ofertaDeVagaMinutos: valores.ofertaDeVagaMinutos,
          confirmacaoAbreHorasAntes: valores.confirmacaoAbreHorasAntes,
          ofertaAutomaticaFila: valores.ofertaAutomaticaFila,
        },
        parceiroQuery(),
      ),
    )
    toast.add({ severity: 'success', summary: t('agenda.config.politica.salva'), life: 3000 })
  } catch (err) {
    const lido = lerErroDoCadastro(err, t('cadastro.erros.salvar'))

    if (lido.codigo === 'POLITICA_FORA_DO_LIMITE' && lido.campo) {
      erroDoCampo.value = { campo: lido.campo, texto: lido.mensagem }
    } else {
      toast.add({ severity: 'error', summary: lido.mensagem, life: 6000 })
    }
  } finally {
    salvando.value = false
  }
}
</script>

<template>
  <section class="ui-folha ui-cartao pol" aria-labelledby="politica-titulo">
    <header class="ui-cartao__cabeca">
      <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-scales" /></span>
      <span class="ui-cartao__titulos">
        <h2 id="politica-titulo" class="ui-cartao__titulo">
          {{ t('agenda.config.politica.titulo') }}
          <span v-if="politica && !politica.personalizada" class="ui-selo">
            {{ t('agenda.config.politica.padraoSelo') }}
          </span>
        </h2>
        <p class="ui-cartao__descricao">{{ t('agenda.config.politica.descricao') }}</p>
      </span>
    </header>

    <p v-if="erro" class="eg__erro" role="alert">
      <i class="ph ph-warning-circle" aria-hidden="true" />
      <span>{{ erro }}</span>
      <Button
        type="button"
        size="small"
        severity="secondary"
        outlined
        :label="t('cadastro.tentarDeNovo')"
        @click="carregar"
      />
    </p>

    <div v-if="carregando && !politica" class="pol__esqueleto" aria-busy="true">
      <Skeleton v-for="n in 4" :key="n" height="4rem" />
    </div>

    <form v-else-if="politica" class="pol__form" novalidate @submit.prevent="salvar">
      <section
        v-for="grupo in GRUPOS"
        :key="grupo.chave"
        class="pol__grupo"
        :aria-labelledby="`politica-${grupo.chave}`"
      >
        <div class="pol__sobre">
          <h3 :id="`politica-${grupo.chave}`" class="pol__titulo">
            {{ t(`agenda.config.politica.grupos.${grupo.chave}.titulo`) }}
          </h3>
          <p class="pol__descricao">
            {{ t(`agenda.config.politica.grupos.${grupo.chave}.descricao`) }}
          </p>
        </div>

        <div class="pol__campos">
          <div v-if="grupo.chave === 'agenda'" class="eg__secao">
            <label class="eg__rotulo" for="politica-grade">{{
              t('agenda.config.politica.campos.granularidadeMinutos')
            }}</label>
            <Select
              v-model="valores.granularidadeMinutos"
              input-id="politica-grade"
              :options="opcoesDaGrade"
              option-label="rotulo"
              option-value="valor"
              :disabled="!props.podeEditar || salvando"
            />
            <small class="eg__dica">{{
              t('agenda.config.politica.dicas.granularidadeMinutos')
            }}</small>
          </div>

          <label v-if="grupo.chave === 'fila'" class="pol__chave">
            <ToggleSwitch
              v-model="valores.ofertaAutomaticaFila"
              :disabled="!props.podeEditar || salvando"
            />
            <span>
              <strong>{{ t('agenda.config.politica.ofertaAutomatica') }}</strong>
              <small>{{
                t('agenda.config.politica.ofertaAutomaticaDica', {
                  min: valores.ofertaDeVagaMinutos,
                })
              }}</small>
            </span>
          </label>

          <div v-for="campo in grupo.campos" :key="campo" class="eg__secao">
            <label class="eg__rotulo" :for="`politica-${campo}`">
              {{ t(`agenda.config.politica.campos.${campo}`) }}
            </label>
            <InputNumber
              v-model="valores[campo]"
              :input-id="`politica-${campo}`"
              :min="faixa(campo).min"
              :max="faixa(campo).max"
              show-buttons
              :suffix="unidadeDe(campo) === 'h' ? ' h' : ` ${t('agenda.config.tipo.min')}`"
              :invalid="foraDaFaixa.includes(campo) || erroDoCampo?.campo === campo"
              :disabled="!props.podeEditar || salvando"
            />
            <small v-if="erroDoCampo?.campo === campo" class="eg__invalido">{{
              erroDoCampo.texto
            }}</small>
            <small v-else class="eg__dica">
              {{ t(`agenda.config.politica.dicas.${campo}`) }}
              {{
                t('agenda.config.politica.faixa', {
                  min: faixa(campo).min,
                  max: faixa(campo).max,
                })
              }}
            </small>
          </div>
        </div>
      </section>

      <footer v-if="props.podeEditar" class="pol__pe">
        <p class="pol__nota">
          <i class="ph ph-info" aria-hidden="true" />
          {{ t('agenda.config.politica.naoReescreve') }}
        </p>
        <Button
          type="submit"
          icon="ph ph-check"
          :label="t('cadastro.salvar')"
          :loading="salvando"
          :disabled="foraDaFaixa.length > 0"
        />
      </footer>
    </form>
  </section>
</template>

<style scoped>
.pol {
  display: grid;
  gap: 16px;
  container: politica / inline-size;
}

.pol__esqueleto {
  display: grid;
  gap: 16px;
}

.pol__form {
  display: grid;
}

/*
 * Um assunto por faixa: à esquerda o que ele muda, à direita os números. O fio entre as faixas é
 * o mesmo do título do cartão.
 */
.pol__grupo {
  display: grid;
  gap: 14px 40px;
  padding: 20px 0;
}

.pol__grupo + .pol__grupo {
  border-top: 1px solid var(--app-regua, var(--linha-suave));
}

.pol__grupo:first-child {
  padding-top: 4px;
}

@container politica (min-width: 760px) {
  .pol__grupo {
    grid-template-columns: minmax(14rem, 20rem) minmax(0, 1fr);
  }
}

.pol__sobre {
  display: grid;
  align-content: start;
  gap: 4px;
}

.pol__titulo {
  margin: 0;
  color: var(--tinta);
  font-size: 14.5px;
  font-weight: 650;
  line-height: 1.35;
}

.pol__descricao {
  margin: 0;
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.45;
}

.pol__campos {
  display: grid;
  gap: 18px 20px;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 14rem), 1fr));
  align-items: start;
}

.pol__campos :deep(.p-inputnumber),
.pol__campos :deep(.p-select) {
  width: 100%;
}

/* O interruptor da fila ocupa a faixa toda: liga ou desliga o que o prazo ao lado mede. */
.pol__chave {
  display: flex;
  grid-column: 1 / -1;
  align-items: center;
  gap: 12px;
  cursor: pointer;
}

.pol__chave :deep(.p-toggleswitch) {
  flex: 0 0 auto;
}

.pol__chave span {
  display: grid;
  gap: 2px;
}

.pol__chave strong {
  color: var(--tinta);
  font-size: 14px;
  font-weight: 600;
}

.pol__chave small {
  color: var(--tinta-2);
  font-size: 13px;
}

.pol__pe {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-top: 18px;
  border-top: 1px solid var(--app-regua, var(--linha-suave));
}

.pol__nota {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--tinta-2);
  font-size: 13px;
}
</style>
