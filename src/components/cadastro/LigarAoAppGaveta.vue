<script setup lang="ts">
/**
 * "Ligar ao app" (E2-02, PJ-HD8PAB, seção 2.1): três caminhos para propor que o responsável ligue
 * o paciente da clínica ao pet dele no app. Nenhum deles prova nada por CPF ou e-mail iguais: a
 * pessoa precisa mostrar que tem o pet.
 *
 * - **E-mail:** a API manda o link ao e-mail do cadastro. Sem e-mail, a tela já oferece o código.
 * - **Código:** 8 caracteres, em dois blocos e grandes, para o responsável digitar no app; vale
 *   72 h e pode ser impresso.
 * - **QR da carteirinha:** o endereço que o QR do pet abre. A resposta é sempre a mesma: a clínica
 *   não fica sabendo se o pet existe, se tem dono ou se a pessoa bloqueou a clínica.
 */
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import SelectButton from 'primevue/selectbutton'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useRotulosDoCadastro } from '@/components/cadastro/useRotulosDoCadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { lerQr } from '@/service/parceiro/emergencia-service'
import type { Paciente } from '@/service/parceiro/pacientes-service'
import {
  codigoEmBlocos,
  proporPorQr,
  proporVinculo,
  type PropostaCriada,
} from '@/service/parceiro/vinculo-service'

const props = defineProps<{ paciente: Paciente | null }>()
const emit = defineEmits<{ proposto: [] }>()
const visible = defineModel<boolean>('visible', { default: false })

const { t } = useI18n()
const { store, parceiroQuery } = useParceiroPortal()
const rotulos = useRotulosDoCadastro()

type Caminho = 'email' | 'codigo' | 'qr'

const caminho = ref<Caminho>('codigo')
const enviando = ref(false)
const erro = ref('')
const feito = ref<'email' | 'qr' | null>(null)
const proposta = ref<PropostaCriada | null>(null)
const qr = ref('')
const tentouQr = ref(false)

const email = computed(() => props.paciente?.cliente.email ?? '')

const opcoes = computed(() => [
  { valor: 'codigo', rotulo: t('cadastro.vinculo.caminho.codigo') },
  { valor: 'email', rotulo: t('cadastro.vinculo.caminho.email') },
  { valor: 'qr', rotulo: t('cadastro.vinculo.caminho.qr') },
])

watch(visible, (aberta) => {
  if (!aberta) return

  caminho.value = email.value ? 'email' : 'codigo'
  erro.value = ''
  feito.value = null
  proposta.value = null
  qr.value = ''
  tentouQr.value = false
})

watch(caminho, () => {
  erro.value = ''
  feito.value = null
})

const leitura = computed(() => lerQr(qr.value))
const problemaDoQr = computed(() => ('problema' in leitura.value ? leitura.value.problema : null))

function mensagem(err: unknown) {
  const lido = lerErroDoCadastro(err, t('cadastro.erros.salvar'))
  const proprias: Record<string, string> = {
    CLIENTE_SEM_EMAIL: t('cadastro.vinculo.erros.semEmail'),
    VINCULO_JA_ATIVO: t('cadastro.vinculo.erros.jaLigado'),
    PACIENTE_INATIVO: t('cadastro.vinculo.erros.inativo'),
    PROPOSTA_TETO_DIARIO: t('cadastro.vinculo.erros.teto'),
  }

  return proprias[lido.codigo] ?? lido.mensagem
}

async function propor() {
  const paciente = props.paciente
  if (!paciente) return

  erro.value = ''

  if (caminho.value === 'qr') {
    tentouQr.value = true
    if (!('slug' in leitura.value)) return
  }

  enviando.value = true

  try {
    if (caminho.value === 'qr' && 'slug' in leitura.value) {
      await proporPorQr(leitura.value.slug, paciente.id, parceiroQuery())
      feito.value = 'qr'
    } else if (caminho.value === 'email') {
      await proporVinculo(paciente.cliente.id, [paciente.id], 'EMAIL', parceiroQuery())
      feito.value = 'email'
    } else {
      proposta.value = await proporVinculo(
        paciente.cliente.id,
        [paciente.id],
        'CODIGO',
        parceiroQuery(),
      )
    }

    emit('proposto')
  } catch (err) {
    erro.value = mensagem(err)
  } finally {
    enviando.value = false
  }
}

const codigo = computed(() => (proposta.value?.codigo ? codigoEmBlocos(proposta.value.codigo) : ''))

const validade = computed(() =>
  proposta.value
    ? new Date(proposta.value.expiraEm).toLocaleString(rotulos.intl(), {
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '',
)

/** Uma folha simples, numa janela própria, para entregar no balcão. */
function imprimir() {
  const paciente = props.paciente
  if (!paciente || !codigo.value) return

  const janela = window.open('', '_blank', 'width=640,height=720')
  if (!janela) return

  const escapar = (texto: string) =>
    texto.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

  janela.document
    .write(`<!doctype html><html lang="${document.documentElement.lang || 'pt-BR'}"><head><meta charset="utf-8">
<title>${escapar(t('cadastro.vinculo.folha.titulo'))}</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 48px; color: #1d3557; text-align: center; }
  h1 { font-size: 22px; margin: 0 0 8px; }
  p { font-size: 15px; line-height: 1.5; margin: 6px 0; }
  .codigo { font: 700 52px/1.1 ui-monospace, monospace; letter-spacing: 0.12em; margin: 32px 0; }
  .pe { margin-top: 32px; font-size: 13px; color: #5f6670; }
</style></head><body>
<h1>${escapar(store.parceiroNome)}</h1>
<p>${escapar(t('cadastro.vinculo.folha.para', { nome: paciente.nome }))}</p>
<div class="codigo">${escapar(codigo.value)}</div>
<p>${escapar(t('cadastro.vinculo.folha.como'))}</p>
<p class="pe">${escapar(t('cadastro.vinculo.validoAte', { data: validade.value }))}</p>
</body></html>`)
  janela.document.close()
  janela.focus()
  janela.print()
}
</script>

<template>
  <CadastroGaveta
    v-model:visible="visible"
    :titulo="t('cadastro.vinculo.ligar')"
    icone="ph ph-device-mobile"
  >
    <p class="eg__dica">{{ t('cadastro.vinculo.lede', { nome: paciente?.nome ?? '' }) }}</p>

    <SelectButton
      v-model="caminho"
      :options="opcoes"
      option-label="rotulo"
      option-value="valor"
      :allow-empty="false"
      :aria-label="t('cadastro.vinculo.ligar')"
      :disabled="enviando || Boolean(proposta)"
    />

    <!-- O código pronto: grande, em dois blocos. -->
    <section v-if="proposta && codigo" class="la__codigo" aria-live="polite">
      <span class="eg__rotulo">{{ t('cadastro.vinculo.codigoPronto') }}</span>
      <strong class="la__digitos ui-num"
        ><bdi dir="ltr">{{ codigo }}</bdi></strong
      >
      <p class="eg__dica">{{ t('cadastro.vinculo.codigoComo') }}</p>
      <p class="eg__dica">{{ t('cadastro.vinculo.validoAte', { data: validade }) }}</p>
      <Button
        type="button"
        severity="secondary"
        outlined
        icon="ph ph-printer"
        :label="t('cadastro.vinculo.imprimir')"
        class="la__imprimir"
        @click="imprimir"
      />
    </section>

    <template v-else-if="caminho === 'codigo'">
      <p class="eg__dica">{{ t('cadastro.vinculo.codigoDica') }}</p>
    </template>

    <template v-else-if="caminho === 'email'">
      <p v-if="email" class="eg__dica">
        {{ t('cadastro.vinculo.emailDica') }}
        <strong class="la__email">{{ email }}</strong>
      </p>
      <p v-else class="eg__aviso">
        <i class="ph ph-info" aria-hidden="true" />
        <span>{{ t('cadastro.vinculo.erros.semEmail') }}</span>
      </p>
    </template>

    <template v-else>
      <section class="eg__secao">
        <label class="eg__rotulo" for="ligar-qr">{{ t('cadastro.vinculo.qrRotulo') }}</label>
        <InputText
          id="ligar-qr"
          v-model="qr"
          autocomplete="off"
          spellcheck="false"
          :placeholder="t('acessos.emergencia.qrExemplo')"
          :invalid="tentouQr && problemaDoQr !== null"
          :disabled="enviando"
        />
        <small v-if="tentouQr && problemaDoQr" class="eg__invalido">
          {{ t(`acessos.emergencia.qrProblema.${problemaDoQr}`) }}
        </small>
        <small v-else class="eg__dica">{{ t('cadastro.vinculo.qrDica') }}</small>
      </section>
    </template>

    <p v-if="feito" class="la__feito" role="status">
      <i class="ph ph-check-circle" aria-hidden="true" />
      <span>{{
        feito === 'email'
          ? t('cadastro.vinculo.emailEnviado', { email })
          : t('cadastro.vinculo.qrEnviado')
      }}</span>
    </p>

    <p v-if="erro" class="eg__erro" role="alert">
      <i class="ph ph-warning-circle" aria-hidden="true" />
      <span>{{ erro }}</span>
    </p>

    <template #pe>
      <Button
        v-if="proposta || feito"
        type="button"
        :label="t('cadastro.fechar')"
        @click="visible = false"
      />
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
          :label="
            caminho === 'codigo'
              ? t('cadastro.vinculo.gerarCodigo')
              : caminho === 'email'
                ? t('cadastro.vinculo.enviarEmail')
                : t('cadastro.vinculo.enviarPedido')
          "
          :disabled="caminho === 'email' && !email"
          :loading="enviando"
          @click="propor"
        />
      </template>
    </template>
  </CadastroGaveta>
</template>

<style scoped>
.la__codigo {
  display: grid;
  justify-items: center;
  gap: 8px;
  padding: 20px 16px;
  border: 1px solid var(--linha);
  border-radius: 16px;
  text-align: center;
}

.la__digitos {
  color: var(--tinta);
  font-size: 40px;
  font-weight: 700;
  letter-spacing: 0.12em;
}

.la__imprimir {
  margin-top: 6px;
}

.la__email {
  color: var(--tinta);
}

.la__feito {
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

.la__feito i {
  margin-top: 2px;
  color: var(--ok-tinta);
  font-size: 18px;
}
</style>
