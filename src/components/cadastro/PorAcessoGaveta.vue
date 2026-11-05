<script setup lang="ts">
/**
 * Propor o vínculo pelo acesso temporário (E2-02, PJ-HD8PAB, seção 2.1), num acesso que este
 * parceiro reivindicou, enquanto ele vale: o responsável já mostrou que tem o pet quando criou o
 * acesso.
 *
 * Duas saídas: ligar a um paciente já cadastrado (achado pela busca) ou deixar a API criar cliente
 * e paciente pelo cabeçalho do acesso ("Responsável de {pet}"). Chamar de novo com a proposta
 * pendente devolve a mesma, sem criar outro cadastro.
 */
import Button from 'primevue/button'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputText from 'primevue/inputtext'
import SelectButton from 'primevue/selectbutton'
import { computed, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useRotulosDoCadastro } from '@/components/cadastro/useRotulosDoCadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import {
  listarPacientes,
  termoDaBusca,
  type PacienteNaLista,
} from '@/service/parceiro/pacientes-service'
import { proporPorAcesso } from '@/service/parceiro/vinculo-service'

const props = defineProps<{ acessoId: string; petNome: string }>()
const visible = defineModel<boolean>('visible', { default: false })

const { t } = useI18n()
const { parceiroQuery } = useParceiroPortal()
const rotulos = useRotulosDoCadastro()

const modo = ref<'existente' | 'novo'>('existente')
const termo = ref('')
const resultados = ref<PacienteNaLista[]>([])
const buscando = ref(false)
const escolhido = ref<PacienteNaLista | null>(null)
const enviando = ref(false)
const erro = ref('')
const feito = ref(false)

const opcoes = computed(() => [
  { valor: 'existente', rotulo: t('cadastro.porAcesso.existente') },
  { valor: 'novo', rotulo: t('cadastro.porAcesso.novo') },
])

watch(visible, (aberta) => {
  if (!aberta) return

  modo.value = 'existente'
  termo.value = props.petNome
  escolhido.value = null
  erro.value = ''
  feito.value = false
})

let espera: ReturnType<typeof setTimeout> | undefined
let pedido = 0

watch(termo, (valor) => {
  clearTimeout(espera)

  if (!termoDaBusca(valor)) {
    resultados.value = []
    return
  }

  espera = setTimeout(async () => {
    const atual = ++pedido
    buscando.value = true

    try {
      const pagina = await listarPacientes({ q: valor, limit: 20 }, parceiroQuery())
      if (atual === pedido) resultados.value = pagina.itens
    } catch {
      if (atual === pedido) resultados.value = []
    } finally {
      if (atual === pedido) buscando.value = false
    }
  }, 300)
})

onUnmounted(() => clearTimeout(espera))

async function propor() {
  if (modo.value === 'existente' && !escolhido.value) {
    erro.value = t('cadastro.porAcesso.escolha')
    return
  }

  enviando.value = true
  erro.value = ''

  try {
    await proporPorAcesso(
      props.acessoId,
      modo.value === 'existente' ? escolhido.value!.id : null,
      parceiroQuery(),
    )
    feito.value = true
  } catch (err) {
    const lido = lerErroDoCadastro(err, t('cadastro.erros.salvar'))
    erro.value =
      lido.codigo === 'VINCULO_JA_ATIVO'
        ? t('cadastro.vinculo.erros.jaLigado')
        : lido.codigo === 'PROPOSTA_TETO_DIARIO'
          ? t('cadastro.vinculo.erros.teto')
          : lido.mensagem
  } finally {
    enviando.value = false
  }
}
</script>

<template>
  <CadastroGaveta
    v-model:visible="visible"
    :titulo="t('cadastro.porAcesso.titulo')"
    icone="ph ph-device-mobile"
  >
    <p class="eg__dica">{{ t('cadastro.porAcesso.lede', { pet: petNome }) }}</p>

    <template v-if="!feito">
      <SelectButton
        v-model="modo"
        :options="opcoes"
        option-label="rotulo"
        option-value="valor"
        :allow-empty="false"
        :aria-label="t('cadastro.porAcesso.titulo')"
        :disabled="enviando"
      />

      <template v-if="modo === 'existente'">
        <section class="eg__secao">
          <label class="eg__rotulo" for="por-acesso-busca">{{
            t('cadastro.porAcesso.procurar')
          }}</label>
          <IconField>
            <InputIcon :class="buscando ? 'ph ph-spinner-gap' : 'ph ph-magnifying-glass'" />
            <InputText
              id="por-acesso-busca"
              v-model="termo"
              type="search"
              autocomplete="off"
              :placeholder="t('cadastro.lista.buscar')"
            />
          </IconField>
        </section>

        <ul v-if="resultados.length" class="ui-lista pa__lista">
          <li v-for="item in resultados" :key="item.id">
            <Button
              unstyled
              type="button"
              class="ui-linha ui-linha--clicavel pa__linha"
              :class="{ 'pa__linha--escolhida': escolhido?.id === item.id }"
              :aria-pressed="escolhido?.id === item.id"
              @click="escolhido = item"
            >
              <span class="ui-linha__texto">
                <strong class="ui-linha__titulo">{{ item.nome }}</strong>
                <span class="ui-linha__meta"
                  >{{ rotulos.especie(item) }} · {{ item.cliente.nome }}</span
                >
              </span>
              <i
                :class="escolhido?.id === item.id ? 'ph ph-check-circle' : 'ph ph-circle'"
                class="pa__marca"
                aria-hidden="true"
              />
            </Button>
          </li>
        </ul>
        <p v-else-if="termoDaBusca(termo) && !buscando" class="eg__dica">
          {{ t('cadastro.porAcesso.nenhum') }}
        </p>
      </template>

      <p v-else class="eg__dica">{{ t('cadastro.porAcesso.novoDica', { pet: petNome }) }}</p>
    </template>

    <p v-else class="pa__feito" role="status">
      <i class="ph ph-check-circle" aria-hidden="true" />
      <span>{{ t('cadastro.porAcesso.feito') }}</span>
    </p>

    <p v-if="erro" class="eg__erro" role="alert">
      <i class="ph ph-warning-circle" aria-hidden="true" />
      <span>{{ erro }}</span>
    </p>

    <template #pe>
      <Button v-if="feito" type="button" :label="t('cadastro.fechar')" @click="visible = false" />
      <template v-else>
        <Button
          type="button"
          :label="t('cadastro.cancelar')"
          severity="secondary"
          outlined
          :disabled="enviando"
          @click="visible = false"
        />
        <Button
          type="button"
          icon="ph ph-paper-plane-tilt"
          :label="t('cadastro.vinculo.enviarPedido')"
          :loading="enviando"
          @click="propor"
        />
      </template>
    </template>
  </CadastroGaveta>
</template>

<style scoped>
.pa__lista {
  max-height: 20rem;
  overflow-y: auto;
}

.pa__linha {
  width: 100%;
  border: 0;
  background: transparent;
  font: inherit;
  text-align: start;
  cursor: pointer;
}

.pa__linha--escolhida {
  background: var(--superficie-2);
}

.pa__marca {
  color: var(--tinta-2);
  font-size: 18px;
}

.pa__linha--escolhida .pa__marca {
  color: var(--ok-tinta);
}

.pa__feito {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin: 0;
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--superficie-2);
  color: var(--tinta);
  font-size: 14px;
  line-height: 1.5;
}

.pa__feito i {
  margin-top: 2px;
  color: var(--ok-tinta);
  font-size: 18px;
}
</style>
