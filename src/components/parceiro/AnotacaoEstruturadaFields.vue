<script setup lang="ts">
import Button from 'primevue/button'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { INTL_LOCALE, type Locale } from '@/i18n/locales'
import type { TipoServicoPrestador } from '@/service/parceiro/types'
import {
  criarExameSolicitadoForm,
  criarPrescricaoItemForm,
  DURACAO_MAX_DIAS,
  DURACAO_MIN_DIAS,
  LIMITES_ESCALARES,
  LIMITES_EXAME_SOLICITADO,
  LIMITES_PRESCRICAO,
  MAX_ITENS_LISTA,
  PESO_MAX_KG,
  PESO_MIN_KG,
  tipoAceitaCampo,
  type AnotacaoEstruturadaForm,
} from '@/utils/parceiro/anotacao-estruturada'

/**
 * Campos da anotação direcionados ao tipo de serviço do acesso. O prestador de
 * banho não vê campo clínico e o vet de exame não vê prescrição: quem decide é o
 * `tipoServico`, e o backend rejeita (400) campo que não pertence ao tipo.
 * Tudo aqui é opcional — salvar rápido continua possível sem tocar nesta seção.
 */
const props = defineProps<{
  tipoServico: TipoServicoPrestador
  /** Mensagens já traduzidas, por id de campo (`motivo`, `prescricaoItens.0.nome`). */
  erros: Record<string, string>
  disabled?: boolean
}>()

const form = defineModel<AnotacaoEstruturadaForm>({ required: true })

const { t, locale } = useI18n()

const numberLocale = computed(() => INTL_LOCALE[locale.value as Locale])

const aceita = (campo: Parameters<typeof tipoAceitaCampo>[1]) =>
  tipoAceitaCampo(props.tipoServico, campo)

const isConsulta = computed(() => aceita('motivo'))
const isExame = computed(() => aceita('tipoExame'))
const isEstetica = computed(() => aceita('produtos'))
const isHotel = computed(() => aceita('dataEntrada'))

const podeAdicionarPrescricao = computed(() => form.value.prescricaoItens.length < MAX_ITENS_LISTA)
const podeAdicionarExame = computed(() => form.value.examesSolicitados.length < MAX_ITENS_LISTA)

function erroDe(id: string) {
  return props.erros[id]
}

function describedBy(id: string, extra?: string) {
  const ids = [extra, erroDe(id) ? `est-erro-${id}` : ''].filter(Boolean)

  return ids.length ? ids.join(' ') : undefined
}

function addPrescricao() {
  if (podeAdicionarPrescricao.value) {
    form.value.prescricaoItens.push(criarPrescricaoItemForm())
  }
}

function removePrescricao(indice: number) {
  form.value.prescricaoItens.splice(indice, 1)
}

function addExame() {
  if (podeAdicionarExame.value) {
    form.value.examesSolicitados.push(criarExameSolicitadoForm())
  }
}

function removeExame(indice: number) {
  form.value.examesSolicitados.splice(indice, 1)
}
</script>

<template>
  <section class="est" aria-labelledby="est-title">
    <header class="est__head">
      <span class="est__badge" aria-hidden="true">
        <i class="pi pi-list-check" />
      </span>
      <div>
        <h4 id="est-title">{{ t(`acessos.estruturada.title.${tipoServico}`) }}</h4>
        <p>{{ t(`acessos.estruturada.lede.${tipoServico}`) }}</p>
      </div>
    </header>

    <!-- CONSULTA -->
    <template v-if="isConsulta">
      <div class="est__field">
        <label for="est-motivo">{{ t('acessos.estruturada.campos.motivo') }}</label>
        <InputText
          id="est-motivo"
          v-model="form.motivo"
          :disabled="disabled"
          :maxlength="LIMITES_ESCALARES.motivo"
          :invalid="Boolean(erroDe('motivo'))"
          :aria-describedby="describedBy('motivo')"
          :placeholder="t('acessos.estruturada.placeholders.motivo')"
        />
        <small v-if="erroDe('motivo')" id="est-erro-motivo" class="est__error" role="alert">
          {{ erroDe('motivo') }}
        </small>
      </div>

      <div class="est__field">
        <label for="est-diagnostico">{{ t('acessos.estruturada.campos.diagnostico') }}</label>
        <Textarea
          id="est-diagnostico"
          v-model="form.diagnostico"
          rows="3"
          auto-resize
          :disabled="disabled"
          :maxlength="LIMITES_ESCALARES.diagnostico"
          :invalid="Boolean(erroDe('diagnostico'))"
          :aria-describedby="describedBy('diagnostico')"
          :placeholder="t('acessos.estruturada.placeholders.diagnostico')"
        />
        <small
          v-if="erroDe('diagnostico')"
          id="est-erro-diagnostico"
          class="est__error"
          role="alert"
        >
          {{ erroDe('diagnostico') }}
        </small>
      </div>

      <div class="est__field est__field--narrow">
        <label for="est-pesoKg">{{ t('acessos.estruturada.campos.pesoKg') }}</label>
        <InputNumber
          v-model="form.pesoKg"
          input-id="est-pesoKg"
          :disabled="disabled"
          :locale="numberLocale"
          :min="PESO_MIN_KG"
          :max="PESO_MAX_KG"
          :min-fraction-digits="0"
          :max-fraction-digits="2"
          suffix=" kg"
          :invalid="Boolean(erroDe('pesoKg'))"
          :aria-describedby="describedBy('pesoKg')"
          :placeholder="t('acessos.estruturada.placeholders.pesoKg')"
        />
        <small v-if="erroDe('pesoKg')" id="est-erro-pesoKg" class="est__error" role="alert">
          {{ erroDe('pesoKg') }}
        </small>
      </div>

      <!-- Prescrição -->
      <div class="est__list">
        <div class="est__list-head">
          <span class="est__list-title">
            {{ t('acessos.estruturada.prescricao.title') }}
            <small v-if="form.prescricaoItens.length">
              {{ form.prescricaoItens.length }}/{{ MAX_ITENS_LISTA }}
            </small>
          </span>
          <Button
            :label="t('acessos.estruturada.prescricao.add')"
            icon="pi pi-plus"
            size="small"
            severity="secondary"
            text
            :disabled="disabled || !podeAdicionarPrescricao"
            @click="addPrescricao"
          />
        </div>

        <p v-if="!form.prescricaoItens.length" class="est__list-empty">
          {{ t('acessos.estruturada.prescricao.empty') }}
        </p>

        <ul v-else class="est__items">
          <li v-for="(item, index) in form.prescricaoItens" :key="`presc-${index}`">
            <div class="est__item-head">
              <span class="est__item-index">
                {{ t('acessos.estruturada.prescricao.item', { n: index + 1 }) }}
              </span>
              <Button
                icon="pi pi-times"
                severity="secondary"
                text
                rounded
                size="small"
                :disabled="disabled"
                :aria-label="t('acessos.estruturada.prescricao.remove', { n: index + 1 })"
                @click="removePrescricao(index)"
              />
            </div>

            <div class="est__field">
              <label :for="`est-presc-nome-${index}`">
                {{ t('acessos.estruturada.prescricao.nome') }}
              </label>
              <InputText
                :id="`est-presc-nome-${index}`"
                v-model="item.nome"
                size="small"
                :disabled="disabled"
                :maxlength="LIMITES_PRESCRICAO.nome"
                :invalid="Boolean(erroDe(`prescricaoItens.${index}.nome`))"
                :aria-describedby="describedBy(`prescricaoItens.${index}.nome`)"
                :placeholder="t('acessos.estruturada.prescricao.nomePlaceholder')"
              />
              <small
                v-if="erroDe(`prescricaoItens.${index}.nome`)"
                :id="`est-erro-prescricaoItens.${index}.nome`"
                class="est__error"
                role="alert"
              >
                {{ erroDe(`prescricaoItens.${index}.nome`) }}
              </small>
            </div>

            <div class="est__row">
              <div class="est__field">
                <label :for="`est-presc-dose-${index}`">
                  {{ t('acessos.estruturada.prescricao.dose') }}
                </label>
                <InputText
                  :id="`est-presc-dose-${index}`"
                  v-model="item.dose"
                  size="small"
                  :disabled="disabled"
                  :maxlength="LIMITES_PRESCRICAO.dose"
                  placeholder="10"
                />
              </div>

              <div class="est__field">
                <label :for="`est-presc-unidade-${index}`">
                  {{ t('acessos.estruturada.prescricao.unidade') }}
                </label>
                <InputText
                  :id="`est-presc-unidade-${index}`"
                  v-model="item.unidade"
                  size="small"
                  :disabled="disabled"
                  :maxlength="LIMITES_PRESCRICAO.unidade"
                  placeholder="mg"
                />
              </div>
            </div>

            <div class="est__row">
              <div class="est__field">
                <label :for="`est-presc-freq-${index}`">
                  {{ t('acessos.estruturada.prescricao.frequencia') }}
                </label>
                <InputText
                  :id="`est-presc-freq-${index}`"
                  v-model="item.frequencia"
                  size="small"
                  :disabled="disabled"
                  :maxlength="LIMITES_PRESCRICAO.frequencia"
                  :aria-describedby="
                    describedBy(`prescricaoItens.${index}.frequencia`, `est-freq-hint-${index}`)
                  "
                  :placeholder="t('acessos.estruturada.prescricao.frequenciaPlaceholder')"
                />
                <small :id="`est-freq-hint-${index}`" class="est__hint">
                  {{ t('acessos.estruturada.prescricao.frequenciaHint') }}
                </small>
              </div>

              <div class="est__field">
                <label :for="`est-presc-duracao-${index}`">
                  {{ t('acessos.estruturada.prescricao.duracaoDias') }}
                </label>
                <InputNumber
                  v-model="item.duracaoDias"
                  :input-id="`est-presc-duracao-${index}`"
                  size="small"
                  :disabled="disabled"
                  :locale="numberLocale"
                  :min="DURACAO_MIN_DIAS"
                  :max="DURACAO_MAX_DIAS"
                  :invalid="Boolean(erroDe(`prescricaoItens.${index}.duracaoDias`))"
                  :aria-describedby="describedBy(`prescricaoItens.${index}.duracaoDias`)"
                  placeholder="7"
                />
                <small
                  v-if="erroDe(`prescricaoItens.${index}.duracaoDias`)"
                  :id="`est-erro-prescricaoItens.${index}.duracaoDias`"
                  class="est__error"
                  role="alert"
                >
                  {{ erroDe(`prescricaoItens.${index}.duracaoDias`) }}
                </small>
              </div>
            </div>

            <div class="est__field">
              <label :for="`est-presc-instr-${index}`">
                {{ t('acessos.estruturada.prescricao.instrucoes') }}
              </label>
              <Textarea
                :id="`est-presc-instr-${index}`"
                v-model="item.instrucoes"
                rows="2"
                auto-resize
                :disabled="disabled"
                :maxlength="LIMITES_PRESCRICAO.instrucoes"
                :placeholder="t('acessos.estruturada.prescricao.instrucoesPlaceholder')"
              />
            </div>
          </li>
        </ul>

        <small v-if="erroDe('prescricaoItens')" class="est__error" role="alert">
          {{ erroDe('prescricaoItens') }}
        </small>
      </div>

      <!-- Exames solicitados -->
      <div class="est__list">
        <div class="est__list-head">
          <span class="est__list-title">
            {{ t('acessos.estruturada.exames.title') }}
            <small v-if="form.examesSolicitados.length">
              {{ form.examesSolicitados.length }}/{{ MAX_ITENS_LISTA }}
            </small>
          </span>
          <Button
            :label="t('acessos.estruturada.exames.add')"
            icon="pi pi-plus"
            size="small"
            severity="secondary"
            text
            :disabled="disabled || !podeAdicionarExame"
            @click="addExame"
          />
        </div>

        <p v-if="!form.examesSolicitados.length" class="est__list-empty">
          {{ t('acessos.estruturada.exames.empty') }}
        </p>

        <ul v-else class="est__items">
          <li v-for="(item, index) in form.examesSolicitados" :key="`exame-${index}`">
            <div class="est__item-head">
              <span class="est__item-index">
                {{ t('acessos.estruturada.exames.item', { n: index + 1 }) }}
              </span>
              <Button
                icon="pi pi-times"
                severity="secondary"
                text
                rounded
                size="small"
                :disabled="disabled"
                :aria-label="t('acessos.estruturada.exames.remove', { n: index + 1 })"
                @click="removeExame(index)"
              />
            </div>

            <div class="est__field">
              <label :for="`est-exame-nome-${index}`">
                {{ t('acessos.estruturada.exames.nome') }}
              </label>
              <InputText
                :id="`est-exame-nome-${index}`"
                v-model="item.nome"
                size="small"
                :disabled="disabled"
                :maxlength="LIMITES_EXAME_SOLICITADO.nome"
                :invalid="Boolean(erroDe(`examesSolicitados.${index}.nome`))"
                :aria-describedby="describedBy(`examesSolicitados.${index}.nome`)"
                :placeholder="t('acessos.estruturada.exames.nomePlaceholder')"
              />
              <small
                v-if="erroDe(`examesSolicitados.${index}.nome`)"
                :id="`est-erro-examesSolicitados.${index}.nome`"
                class="est__error"
                role="alert"
              >
                {{ erroDe(`examesSolicitados.${index}.nome`) }}
              </small>
            </div>

            <div class="est__field">
              <label :for="`est-exame-obs-${index}`">
                {{ t('acessos.estruturada.exames.observacao') }}
              </label>
              <InputText
                :id="`est-exame-obs-${index}`"
                v-model="item.observacao"
                size="small"
                :disabled="disabled"
                :maxlength="LIMITES_EXAME_SOLICITADO.observacao"
                :placeholder="t('acessos.estruturada.exames.observacaoPlaceholder')"
              />
            </div>
          </li>
        </ul>

        <small v-if="erroDe('examesSolicitados')" class="est__error" role="alert">
          {{ erroDe('examesSolicitados') }}
        </small>
      </div>
    </template>

    <!-- EXAME -->
    <template v-else-if="isExame">
      <div class="est__field">
        <label for="est-tipoExame">{{ t('acessos.estruturada.campos.tipoExame') }}</label>
        <InputText
          id="est-tipoExame"
          v-model="form.tipoExame"
          :disabled="disabled"
          :maxlength="LIMITES_ESCALARES.tipoExame"
          :invalid="Boolean(erroDe('tipoExame'))"
          :aria-describedby="describedBy('tipoExame')"
          :placeholder="t('acessos.estruturada.placeholders.tipoExame')"
        />
        <small v-if="erroDe('tipoExame')" id="est-erro-tipoExame" class="est__error" role="alert">
          {{ erroDe('tipoExame') }}
        </small>
      </div>

      <div class="est__field">
        <label for="est-laudoTexto">{{ t('acessos.estruturada.campos.laudoTexto') }}</label>
        <Textarea
          id="est-laudoTexto"
          v-model="form.laudoTexto"
          rows="4"
          auto-resize
          :disabled="disabled"
          :maxlength="LIMITES_ESCALARES.laudoTexto"
          :invalid="Boolean(erroDe('laudoTexto'))"
          :aria-describedby="describedBy('laudoTexto')"
          :placeholder="t('acessos.estruturada.placeholders.laudoTexto')"
        />
        <small v-if="erroDe('laudoTexto')" id="est-erro-laudoTexto" class="est__error" role="alert">
          {{ erroDe('laudoTexto') }}
        </small>
      </div>

      <div class="est__field est__field--narrow">
        <label for="est-dataResultado">
          {{ t('acessos.estruturada.campos.dataResultado') }}
        </label>
        <InputText
          id="est-dataResultado"
          v-model="form.dataResultado"
          class="est__date"
          type="date"
          fluid
          :disabled="disabled"
          :invalid="Boolean(erroDe('dataResultado'))"
          :aria-describedby="describedBy('dataResultado')"
        />
        <small
          v-if="erroDe('dataResultado')"
          id="est-erro-dataResultado"
          class="est__error"
          role="alert"
        >
          {{ erroDe('dataResultado') }}
        </small>
      </div>
    </template>

    <!-- BANHO / TOSA -->
    <template v-else-if="isEstetica">
      <div class="est__field">
        <label for="est-produtos">{{ t('acessos.estruturada.campos.produtos') }}</label>
        <Textarea
          id="est-produtos"
          v-model="form.produtos"
          rows="2"
          auto-resize
          :disabled="disabled"
          :maxlength="LIMITES_ESCALARES.produtos"
          :invalid="Boolean(erroDe('produtos'))"
          :aria-describedby="describedBy('produtos')"
          :placeholder="t('acessos.estruturada.placeholders.produtos')"
        />
        <small v-if="erroDe('produtos')" id="est-erro-produtos" class="est__error" role="alert">
          {{ erroDe('produtos') }}
        </small>
      </div>

      <div class="est__field">
        <label for="est-condicaoPele">
          {{ t('acessos.estruturada.campos.condicaoPele') }}
        </label>
        <Textarea
          id="est-condicaoPele"
          v-model="form.condicaoPele"
          rows="2"
          auto-resize
          :disabled="disabled"
          :maxlength="LIMITES_ESCALARES.condicaoPele"
          :invalid="Boolean(erroDe('condicaoPele'))"
          :aria-describedby="describedBy('condicaoPele')"
          :placeholder="t('acessos.estruturada.placeholders.condicaoPele')"
        />
        <small
          v-if="erroDe('condicaoPele')"
          id="est-erro-condicaoPele"
          class="est__error"
          role="alert"
        >
          {{ erroDe('condicaoPele') }}
        </small>
      </div>

      <div class="est__field">
        <label for="est-comportamento">
          {{ t('acessos.estruturada.campos.comportamento') }}
        </label>
        <Textarea
          id="est-comportamento"
          v-model="form.comportamento"
          rows="2"
          auto-resize
          :disabled="disabled"
          :maxlength="LIMITES_ESCALARES.comportamento"
          :invalid="Boolean(erroDe('comportamento'))"
          :aria-describedby="describedBy('comportamento')"
          :placeholder="t('acessos.estruturada.placeholders.comportamento')"
        />
        <small
          v-if="erroDe('comportamento')"
          id="est-erro-comportamento"
          class="est__error"
          role="alert"
        >
          {{ erroDe('comportamento') }}
        </small>
      </div>
    </template>

    <!-- HOTEL -->
    <template v-else-if="isHotel">
      <div class="est__row">
        <div class="est__field">
          <label for="est-dataEntrada">{{
            t('acessos.estruturada.campos.dataEntrada')
          }}</label>
          <InputText
            id="est-dataEntrada"
            v-model="form.dataEntrada"
            class="est__date"
            type="datetime-local"
            fluid
            :disabled="disabled"
            :invalid="Boolean(erroDe('dataEntrada'))"
            :aria-describedby="describedBy('dataEntrada')"
          />
          <small
            v-if="erroDe('dataEntrada')"
            id="est-erro-dataEntrada"
            class="est__error"
            role="alert"
          >
            {{ erroDe('dataEntrada') }}
          </small>
        </div>

        <div class="est__field">
          <label for="est-dataSaida">{{ t('acessos.estruturada.campos.dataSaida') }}</label>
          <InputText
            id="est-dataSaida"
            v-model="form.dataSaida"
            class="est__date"
            type="datetime-local"
            fluid
            :disabled="disabled"
            :min="form.dataEntrada || undefined"
            :invalid="Boolean(erroDe('dataSaida'))"
            :aria-describedby="describedBy('dataSaida')"
          />
          <small v-if="erroDe('dataSaida')" id="est-erro-dataSaida" class="est__error" role="alert">
            {{ erroDe('dataSaida') }}
          </small>
        </div>
      </div>

      <div class="est__field">
        <label for="est-alimentacao">{{ t('acessos.estruturada.campos.alimentacao') }}</label>
        <Textarea
          id="est-alimentacao"
          v-model="form.alimentacao"
          rows="2"
          auto-resize
          :disabled="disabled"
          :maxlength="LIMITES_ESCALARES.alimentacao"
          :invalid="Boolean(erroDe('alimentacao'))"
          :aria-describedby="describedBy('alimentacao')"
          :placeholder="t('acessos.estruturada.placeholders.alimentacao')"
        />
        <small
          v-if="erroDe('alimentacao')"
          id="est-erro-alimentacao"
          class="est__error"
          role="alert"
        >
          {{ erroDe('alimentacao') }}
        </small>
      </div>

      <div class="est__field">
        <label for="est-comportamento-hotel">
          {{ t('acessos.estruturada.campos.comportamento') }}
        </label>
        <Textarea
          id="est-comportamento-hotel"
          v-model="form.comportamento"
          rows="2"
          auto-resize
          :disabled="disabled"
          :maxlength="LIMITES_ESCALARES.comportamento"
          :invalid="Boolean(erroDe('comportamento'))"
          :aria-describedby="describedBy('comportamento')"
          :placeholder="t('acessos.estruturada.placeholders.comportamentoHotel')"
        />
        <small
          v-if="erroDe('comportamento')"
          id="est-erro-comportamento"
          class="est__error"
          role="alert"
        >
          {{ erroDe('comportamento') }}
        </small>
      </div>

      <div class="est__field">
        <label for="est-intercorrencias">
          {{ t('acessos.estruturada.campos.intercorrencias') }}
        </label>
        <Textarea
          id="est-intercorrencias"
          v-model="form.intercorrencias"
          rows="2"
          auto-resize
          :disabled="disabled"
          :maxlength="LIMITES_ESCALARES.intercorrencias"
          :invalid="Boolean(erroDe('intercorrencias'))"
          :aria-describedby="describedBy('intercorrencias')"
          :placeholder="t('acessos.estruturada.placeholders.intercorrencias')"
        />
        <small
          v-if="erroDe('intercorrencias')"
          id="est-erro-intercorrencias"
          class="est__error"
          role="alert"
        >
          {{ erroDe('intercorrencias') }}
        </small>
      </div>
    </template>
  </section>
</template>

<style scoped>
.est {
  display: grid;
  gap: 0.8rem;
  padding: 0.9rem 0.95rem 1rem;
  border: 1px solid color-mix(in srgb, var(--partner-primary) 20%, var(--partner-line));
  border-radius: 1rem;
  background: color-mix(in srgb, var(--partner-surface) 60%, var(--partner-card));
}

.est__head {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
}

.est__badge {
  display: grid;
  width: 1.9rem;
  height: 1.9rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 0.65rem;
  background: color-mix(in srgb, var(--partner-primary) 16%, transparent);
  color: var(--partner-primary-strong);
  font-size: 0.8rem;
}

.est__head h4 {
  margin: 0;
  color: var(--partner-text);
  font-size: 0.88rem;
  font-weight: 750;
  letter-spacing: -0.01em;
}

.est__head p {
  margin: 0.2rem 0 0;
  color: var(--partner-muted);
  font-size: 0.76rem;
  line-height: 1.4;
}

.est__field {
  display: grid;
  gap: 0.3rem;
  min-width: 0;
}

.est__field--narrow {
  max-width: 12rem;
}

.est__field label {
  color: var(--partner-text);
  font-size: 0.76rem;
  font-weight: 700;
}

.est__field :deep(.p-inputnumber) {
  width: 100%;
}

.est__row {
  display: grid;
  gap: 0.6rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.est__hint {
  color: var(--partner-faint);
  font-size: 0.7rem;
  line-height: 1.35;
}

.est__error {
  color: var(--partner-warm-text);
  font-size: 0.72rem;
  font-weight: 650;
  line-height: 1.35;
}

/*
 * Data/hora: InputText do PrimeVue com type date/datetime-local (mesmo padrão do módulo
 * clínico) — seletor localizado pelo navegador e o model continua string local.
 * O ícone nativo do seletor some no escuro sem isto.
 */
.est__date::-webkit-calendar-picker-indicator {
  cursor: pointer;
  filter: invert(var(--est-picker-invert, 0));
  opacity: 0.65;
}

:global(.app-dark) .est__date::-webkit-calendar-picker-indicator {
  --est-picker-invert: 1;
}

.est__list {
  display: grid;
  gap: 0.5rem;
  padding-top: 0.65rem;
  border-top: 1px solid color-mix(in srgb, var(--partner-line) 85%, transparent);
}

.est__list-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.4rem;
}

.est__list-title {
  display: inline-flex;
  align-items: baseline;
  gap: 0.35rem;
  color: var(--partner-text);
  font-size: 0.8rem;
  font-weight: 750;
}

.est__list-title small {
  color: var(--partner-faint);
  font-size: 0.7rem;
  font-weight: 650;
}

.est__list-empty {
  margin: 0;
  color: var(--partner-faint);
  font-size: 0.74rem;
  line-height: 1.4;
}

.est__items {
  display: grid;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.est__items li {
  display: grid;
  gap: 0.5rem;
  padding: 0.65rem 0.7rem 0.75rem;
  border: 1px solid var(--partner-line);
  border-radius: 0.8rem;
  background: var(--partner-card);
}

.est__item-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.4rem;
}

.est__item-index {
  color: var(--partner-faint);
  font-size: 0.7rem;
  font-weight: 750;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

@media (max-width: 640px) {
  .est__row {
    grid-template-columns: minmax(0, 1fr);
  }

  .est__field--narrow {
    max-width: none;
  }
}
</style>
