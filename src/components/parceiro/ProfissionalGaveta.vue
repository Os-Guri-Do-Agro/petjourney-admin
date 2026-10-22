<script setup lang="ts">
/**
 * A ficha de um profissional (E1-03), numa gaveta ao lado da lista: quem é, o conselho, as
 * especialidades, a cor da coluna na agenda, se atende na agenda e o login, quando tem.
 *
 * Quem não gere a equipe e abre a própria ficha muda só a cor e as especialidades: é o que a API
 * aceita dele. Os avisos de selo saem antes de salvar, porque trocar o número ou a UF, ou ligar a
 * ficha a um login, faz o CRMV voltar para a conferência da PetJourney.
 */
import AutoComplete from 'primevue/autocomplete'
import Button from 'primevue/button'
import Drawer from 'primevue/drawer'
import InputText from 'primevue/inputtext'
import RadioButton from 'primevue/radiobutton'
import Select from 'primevue/select'
import ToggleSwitch from 'primevue/toggleswitch'
import { computed, reactive, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useSidePanelOffset } from '@/composables/useSidePanelOffset'
import { useTelaLarga } from '@/composables/useTelaLarga'
import { isRTLLocale, type Locale } from '@/i18n/locales'
import type {
  ConselhoProfissional,
  DadosDoProfissional,
  Profissional,
} from '@/service/parceiro/profissionais-service'

const props = defineProps<{
  /** A ficha que se edita; nula para cadastrar. */
  profissional: Profissional | null
  /** Valores de partida de uma ficha nova (a do próprio login, por exemplo). */
  sugestao?: Partial<DadosDoProfissional>
  /** Só cor e especialidades: quem abre a própria ficha sem gerir a equipe. */
  soOProprio: boolean
  membros: Array<{ usuarioId: string; nome: string }>
  salvando: boolean
  erro: Error | null
}>()

const emit = defineEmits<{ salvar: [dados: DadosDoProfissional] }>()

const visible = defineModel<boolean>('visible', { default: false })

const LARGURA = '28rem'
const CORES = [0, 1, 2, 3, 4, 5] as const
const UFS = [
  'AC',
  'AL',
  'AM',
  'AP',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MG',
  'MS',
  'MT',
  'PA',
  'PB',
  'PE',
  'PI',
  'PR',
  'RJ',
  'RN',
  'RO',
  'RR',
  'RS',
  'SC',
  'SE',
  'SP',
  'TO',
]
const MAX_ESPECIALIDADES = 5
/* O Select do PrimeVue lê `null` como "nada escolhido": "sem login" precisa de um valor de verdade. */
const SEM_LOGIN = 'sem-login'

const { t, locale } = useI18n()
const telaLarga = useTelaLarga()

useSidePanelOffset(
  computed(() => visible.value && telaLarga.value),
  LARGURA,
)

const drawerPosition = computed(() => (isRTLLocale(locale.value as Locale) ? 'left' : 'right'))

const form = reactive({
  nome: '',
  conselho: 'NENHUM' as ConselhoProfissional,
  registro: '',
  uf: null as string | null,
  especialidades: [] as string[],
  corIndice: 0,
  atendeNaAgenda: true,
  login: SEM_LOGIN as string,
  tentouSalvar: false,
})

const conselhoOptions = computed(() =>
  (['CRMV', 'OUTRO', 'NENHUM'] as const).map((valor) => ({
    valor,
    rotulo: t(`parceiro.profissionais.conselho.${valor}`),
  })),
)

const loginOptions = computed(() => [
  { valor: SEM_LOGIN, rotulo: t('parceiro.profissionais.gaveta.semLogin') },
  ...props.membros.map((membro) => ({ valor: membro.usuarioId, rotulo: membro.nome })),
])

const pedeRegistro = computed(() => form.conselho !== 'NENHUM')
const nomeInvalido = computed(() => form.tentouSalvar && form.nome.trim().length < 2)
const registroInvalido = computed(
  () => form.tentouSalvar && pedeRegistro.value && !form.registro.replace(/\D/g, ''),
)
const ufInvalida = computed(() => form.tentouSalvar && pedeRegistro.value && !form.uf)

/** O selo cai se o número ou a UF mudarem numa ficha conferida. */
const perdeSeloPeloRegistro = computed(() => {
  const atual = props.profissional

  return Boolean(
    atual?.crmvConferidoEm &&
    (form.registro.replace(/\D/g, '') !== (atual.registro ?? '') || form.uf !== atual.uf),
  )
})

/** E também quando uma ficha sem login ganha um login. */
const perdeSeloPeloLogin = computed(() => {
  const atual = props.profissional

  return Boolean(atual?.crmvConferidoEm && !atual.usuarioId && form.login !== SEM_LOGIN)
})

function preencher() {
  const atual = props.profissional
  const sugestao = props.sugestao ?? {}

  form.nome = atual?.nome ?? sugestao.nome ?? ''
  form.conselho = atual?.conselho ?? sugestao.conselho ?? 'NENHUM'
  form.registro = atual?.registro ?? sugestao.registro ?? ''
  form.uf = atual?.uf ?? sugestao.uf ?? null
  form.especialidades = [...(atual?.especialidades ?? sugestao.especialidades ?? [])]
  form.corIndice = atual?.corIndice ?? sugestao.corIndice ?? 0
  form.atendeNaAgenda = atual?.atendeNaAgenda ?? sugestao.atendeNaAgenda ?? true
  form.login = atual?.usuarioId ?? sugestao.usuarioId ?? SEM_LOGIN
  form.tentouSalvar = false
}

/* Especialidade digitada vira etiqueta no Enter ou na vírgula; repetida e longa demais não entram. */
function aoMudarEspecialidades(valores: unknown) {
  const limpas = (Array.isArray(valores) ? valores : [])
    .map((valor) => String(valor).trim().slice(0, 60))
    .filter(Boolean)

  form.especialidades = [...new Set(limpas)].slice(0, MAX_ESPECIALIDADES)
}

function salvar() {
  form.tentouSalvar = true

  if (props.soOProprio) {
    emit('salvar', { corIndice: form.corIndice, especialidades: form.especialidades })
    return
  }

  if (nomeInvalido.value || registroInvalido.value || ufInvalida.value) {
    return
  }

  emit('salvar', {
    nome: form.nome.trim(),
    conselho: form.conselho,
    registro: pedeRegistro.value ? form.registro.replace(/\D/g, '') : null,
    uf: pedeRegistro.value ? form.uf : null,
    especialidades: form.especialidades,
    corIndice: form.corIndice,
    atendeNaAgenda: form.atendeNaAgenda,
    usuarioId: form.login === SEM_LOGIN ? null : form.login,
  })
}

watch(visible, (aberta) => {
  if (aberta) {
    preencher()
  }
})
</script>

<template>
  <Drawer
    v-model:visible="visible"
    :position="drawerPosition"
    :modal="false"
    :dismissable="false"
    :block-scroll="false"
    class="profissional-gaveta"
    :style="{ width: `min(${LARGURA}, 100vw)` }"
  >
    <template #header>
      <h2 class="pg-titulo">
        <span class="ui-ladrilho ui-ladrilho--lugar" aria-hidden="true">
          <i class="ph ph-stethoscope" />
        </span>
        {{
          profissional
            ? t('parceiro.profissionais.gaveta.tituloEditar')
            : t('parceiro.profissionais.gaveta.tituloNovo')
        }}
      </h2>
    </template>

    <form id="profissional-ficha" class="pg" novalidate @submit.prevent="salvar">
      <section class="pg__secao">
        <label class="pg__rotulo" for="prof-nome">{{
          t('parceiro.profissionais.gaveta.nome')
        }}</label>
        <InputText
          id="prof-nome"
          v-model="form.nome"
          :disabled="salvando || soOProprio"
          :invalid="nomeInvalido"
          maxlength="120"
          autocomplete="off"
        />
        <small v-if="nomeInvalido" class="pg__invalido">
          {{ t('parceiro.profissionais.gaveta.nomeInvalido') }}
        </small>
      </section>

      <section class="pg__secao">
        <span id="prof-conselho-rotulo" class="pg__rotulo">
          {{ t('parceiro.profissionais.gaveta.conselho') }}
        </span>
        <Select
          v-model="form.conselho"
          :options="conselhoOptions"
          option-label="rotulo"
          option-value="valor"
          aria-labelledby="prof-conselho-rotulo"
          :disabled="salvando || soOProprio"
        />

        <div v-if="pedeRegistro" class="pg__registro">
          <div class="pg__campo">
            <label class="pg__rotulo" for="prof-registro">
              {{ t('parceiro.profissionais.gaveta.registro') }}
            </label>
            <InputText
              id="prof-registro"
              v-model="form.registro"
              inputmode="numeric"
              maxlength="12"
              autocomplete="off"
              :invalid="registroInvalido"
              :disabled="salvando || soOProprio"
            />
          </div>
          <div class="pg__campo pg__campo--uf">
            <span id="prof-uf-rotulo" class="pg__rotulo">{{
              t('parceiro.profissionais.gaveta.uf')
            }}</span>
            <Select
              v-model="form.uf"
              :options="UFS"
              aria-labelledby="prof-uf-rotulo"
              :invalid="ufInvalida"
              :disabled="salvando || soOProprio"
              filter
            />
          </div>
        </div>
        <small v-if="registroInvalido || ufInvalida" class="pg__invalido">
          {{ t('parceiro.profissionais.gaveta.registroInvalido') }}
        </small>
        <p v-if="perdeSeloPeloRegistro" class="pg__aviso">
          <i class="ph ph-seal-warning" aria-hidden="true" />
          {{ t('parceiro.profissionais.gaveta.perdeSeloRegistro') }}
        </p>
      </section>

      <section class="pg__secao">
        <label class="pg__rotulo" for="prof-especialidades">
          {{ t('parceiro.profissionais.gaveta.especialidades') }}
        </label>
        <AutoComplete
          input-id="prof-especialidades"
          :model-value="form.especialidades"
          multiple
          :typeahead="false"
          :disabled="salvando"
          @update:model-value="aoMudarEspecialidades"
        />
        <small class="pg__dica">{{ t('parceiro.profissionais.gaveta.especialidadesDica') }}</small>
      </section>

      <section class="pg__secao" role="radiogroup" aria-labelledby="prof-cor-rotulo">
        <span id="prof-cor-rotulo" class="pg__rotulo">{{
          t('parceiro.profissionais.gaveta.cor')
        }}</span>
        <div class="pg__cores">
          <label
            v-for="cor in CORES"
            :key="cor"
            class="pg__cor"
            :class="{ 'pg__cor--ativa': form.corIndice === cor }"
            :style="{ '--cor': `var(--clinic-col-${cor})` }"
          >
            <RadioButton
              v-model="form.corIndice"
              class="pg__cor-radio"
              :input-id="`prof-cor-${cor}`"
              name="prof-cor"
              :value="cor"
              :disabled="salvando"
              :aria-label="t('parceiro.profissionais.gaveta.corN', { n: cor + 1 })"
            />
            <i v-if="form.corIndice === cor" class="ph ph-check" aria-hidden="true" />
          </label>
        </div>
      </section>

      <section v-if="!soOProprio" class="pg__secao">
        <div class="pg__chave">
          <label class="pg__rotulo" for="prof-agenda">
            {{ t('parceiro.profissionais.gaveta.atendeNaAgenda') }}
          </label>
          <ToggleSwitch v-model="form.atendeNaAgenda" input-id="prof-agenda" :disabled="salvando" />
        </div>
        <small class="pg__dica">{{ t('parceiro.profissionais.gaveta.atendeNaAgendaDica') }}</small>
      </section>

      <section v-if="!soOProprio" class="pg__secao">
        <span id="prof-login-rotulo" class="pg__rotulo">
          {{ t('parceiro.profissionais.gaveta.login') }}
        </span>
        <Select
          v-model="form.login"
          :options="loginOptions"
          option-label="rotulo"
          option-value="valor"
          aria-labelledby="prof-login-rotulo"
          :disabled="salvando"
        />
        <small class="pg__dica">{{ t('parceiro.profissionais.gaveta.loginDica') }}</small>
        <p v-if="perdeSeloPeloLogin" class="pg__aviso">
          <i class="ph ph-seal-warning" aria-hidden="true" />
          {{ t('parceiro.profissionais.gaveta.perdeSeloLogin') }}
        </p>
      </section>

      <p v-if="erro" class="pg__erro" role="alert">
        <i class="ph ph-warning-circle" aria-hidden="true" />
        {{ erro.message }}
      </p>
    </form>

    <template #footer>
      <div class="pg__pe">
        <Button
          type="button"
          :label="t('parceiro.equipe.gaveta.cancelar')"
          severity="secondary"
          outlined
          :disabled="salvando"
          @click="visible = false"
        />
        <Button
          type="submit"
          form="profissional-ficha"
          icon="ph ph-check"
          :label="t('parceiro.profissionais.gaveta.salvar')"
          :loading="salvando"
        />
      </div>
    </template>
  </Drawer>
</template>

<style scoped>
.pg-titulo {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  margin: 0;
  color: var(--tinta);
  font-size: 18px;
  font-weight: 650;
  letter-spacing: -0.01em;
}

.pg {
  display: grid;
  gap: 22px;
  padding-bottom: 8px;
}

.pg__secao {
  display: grid;
  gap: 8px;
}

.pg__secao :deep(.p-inputtext),
.pg__secao :deep(.p-select),
.pg__secao :deep(.p-autocomplete) {
  width: 100%;
}

.pg__rotulo {
  color: var(--tinta);
  font-size: 13.5px;
  font-weight: 600;
}

.pg__registro {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 7rem;
  gap: 10px;
  margin-top: 4px;
}

.pg__campo {
  display: grid;
  gap: 6px;
}

.pg__dica,
.pg__invalido {
  font-size: 13px;
  line-height: 1.45;
}

.pg__dica {
  color: var(--tinta-2);
}

.pg__invalido {
  color: var(--risco-tinta);
}

.pg__aviso,
.pg__erro {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  color: var(--tinta);
  font-size: 13.5px;
  line-height: 1.5;
}

.pg__aviso i {
  margin-top: 2px;
  color: var(--atencao-tinta);
  font-size: 16px;
}

.pg__erro i {
  margin-top: 2px;
  color: var(--risco-tinta);
  font-size: 16px;
}

/* A cor da coluna: seis discos, o escolhido com o visto. A cor nunca vai sozinha: o número também. */
.pg__cores {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.pg__cor {
  position: relative;
  display: grid;
  width: 36px;
  height: 36px;
  place-items: center;
  border: 2px solid transparent;
  border-radius: 999px;
  background: var(--cor);
  color: var(--tinta);
  cursor: pointer;
}

.pg__cor--ativa {
  border-color: var(--tinta);
}

.pg__cor:has(.p-radiobutton-input:focus-visible) {
  outline: 2px solid var(--musgo);
  outline-offset: 3px;
}

/* O rádio do PrimeVue cobre o disco, invisível: o clique e o teclado são dele, a cor é do disco. */
.pg__cor :deep(.pg__cor-radio) {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
}

.pg__cor i {
  position: relative;
  pointer-events: none;
}

.pg__chave {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.pg__pe {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>
