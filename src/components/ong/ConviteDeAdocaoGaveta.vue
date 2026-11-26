<script setup lang="ts">
/**
 * Entregar para adoção (guia 2.4): o convite que quem adota abre no app.
 *
 * Primeiro, o nome e o WhatsApp de quem vai adotar, os dois opcionais (só a saudação e o botão do
 * WhatsApp), e "Gerar convite". Com um convite valendo, a gaveta avisa antes: o anterior deixa de
 * valer (vale o último). Depois, o convite pronto: o link, o QR do link para o balcão, o código de 8
 * caracteres para digitar no app, a mensagem pronta (no idioma da tela, com a validade no fuso da
 * ONG), "Enviar pelo WhatsApp" e "Copiar mensagem".
 *
 * O link só vem nesta resposta: a lista de convites não o traz. A gaveta diz isso, e fechar volta ao
 * formulário na próxima vez. O QR é desenhado no navegador a partir do `link`; o portal não monta
 * a mensagem.
 */
import Button from 'primevue/button'
import Drawer from 'primevue/drawer'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import { useToast } from 'primevue/usetoast'
import { onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { useRotulosDoCadastro } from '@/components/cadastro/useRotulosDoCadastro'
import { imagemDoQr } from '@/components/parceiro/estabelecimento/qr-da-pagina'
import { lerErroDaOng } from '@/components/ong/regras-da-ong'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { gerarConvite, type AnimalDaOng, type ConviteGerado } from '@/service/parceiro/ong-service'

const props = defineProps<{ animal: AnimalDaOng; temConviteValendo: boolean }>()
/** Um convite nasceu (ou a ficha mudou na API): a ficha lê os convites de novo. */
const emit = defineEmits<{ mudou: [] }>()
const aberta = defineModel<boolean>('visible', { default: false })

const { t } = useI18n()
const toast = useToast()
const rotulos = useRotulosDoCadastro()
const { store, parceiroQuery } = useParceiroPortal()

const nome = ref('')
const telefone = ref('')
const erroDoTelefone = ref('')
const erro = ref('')
const gerando = ref(false)
const convite = ref<ConviteGerado | null>(null)
const qr = ref('')

watch(aberta, (agora) => {
  if (!agora) return

  nome.value = ''
  telefone.value = ''
  erroDoTelefone.value = ''
  erro.value = ''
  convite.value = null
  qr.value = ''
})

async function gerar() {
  erro.value = ''
  erroDoTelefone.value = ''
  gerando.value = true

  try {
    const criado = await gerarConvite(
      props.animal.id,
      {
        ...(nome.value.trim() ? { adotanteNome: nome.value.trim() } : {}),
        ...(telefone.value.trim() ? { adotanteTelefone: telefone.value.trim() } : {}),
      },
      parceiroQuery(),
    )

    convite.value = criado
    qr.value = await imagemDoQr(criado.link, 480).catch(() => '')
    emit('mudou')
  } catch (err) {
    const lido = lerErroDaOng(err, t, t('ong.erros.salvar'))

    if (lido.recarregar) {
      toast.add({ severity: 'warn', summary: lido.mensagem, life: 6000 })
      emit('mudou')
      aberta.value = false
      return
    }

    if (lido.campo === 'adotanteTelefone') erroDoTelefone.value = lido.mensagem
    else erro.value = lido.mensagem
  } finally {
    gerando.value = false
  }
}

function validade(expiraEm: string) {
  return t('ong.convite.validade', {
    data: new Date(expiraEm).toLocaleString(rotulos.intl(), {
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    }),
  })
}

async function copiar(texto: string) {
  try {
    await navigator.clipboard.writeText(texto)
    toast.add({ severity: 'success', summary: t('ong.convite.copiado'), life: 2500 })
  } catch {
    toast.add({ severity: 'warn', summary: t('divulgacao.toast.copyFail'), life: 5000 })
  }
}

function whatsapp() {
  if (convite.value?.whatsappUrl) window.open(convite.value.whatsappUrl, '_blank', 'noopener')
}

/* ---------------------------------------------------------- o QR em tela cheia, para o balcão */

const qrAberto = ref(false)
const qrGrande = ref('')

async function mostrarQr() {
  if (!convite.value) return
  qrGrande.value = await imagemDoQr(convite.value.link, 720)
  qrAberto.value = true
}

/*
 * O QR abre por cima da gaveta do convite, e cada Drawer do PrimeVue fecha no Escape por um ouvinte
 * no `document`: um Escape fechava os dois, e o link (que só aparece agora) se perdia. Com o QR
 * aberto, o Escape é pego antes, na captura da `window`, e fecha só o QR.
 */
function escapeFechaSoOQr(evento: KeyboardEvent) {
  if (!qrAberto.value || (evento.key !== 'Escape' && evento.code !== 'Escape')) return
  evento.stopPropagation()
  qrAberto.value = false
}

watch(qrAberto, (agora) => {
  if (agora) window.addEventListener('keydown', escapeFechaSoOQr, true)
  else window.removeEventListener('keydown', escapeFechaSoOQr, true)
})

onUnmounted(() => window.removeEventListener('keydown', escapeFechaSoOQr, true))
</script>

<template>
  <CadastroGaveta
    v-model:visible="aberta"
    :titulo="t('ong.convite.titulo')"
    icone="ph ph-hand-heart"
    largura="32rem"
  >
    <!-- 1. Quem vai adotar (opcional) e gerar. -->
    <form v-if="!convite" id="convite-de-adocao" class="eg" novalidate @submit.prevent="gerar">
      <p class="eg__dica">{{ t('ong.convite.lede', { nome: animal.nome }) }}</p>

      <section class="eg__secao">
        <label class="eg__rotulo" for="cd-nome">
          {{ t('ong.convite.adotanteNome') }}
          <span class="eg__opcional">{{ t('cadastro.opcional') }}</span>
        </label>
        <InputText
          id="cd-nome"
          v-model="nome"
          maxlength="120"
          autocomplete="off"
          :disabled="gerando"
        />
      </section>

      <section class="eg__secao">
        <label class="eg__rotulo" for="cd-telefone">
          {{ t('ong.convite.adotanteTelefone') }}
          <span class="eg__opcional">{{ t('cadastro.opcional') }}</span>
        </label>
        <InputText
          id="cd-telefone"
          v-model="telefone"
          type="tel"
          inputmode="tel"
          maxlength="25"
          autocomplete="off"
          :placeholder="t('ong.convite.telefoneExemplo')"
          :invalid="Boolean(erroDoTelefone)"
          :disabled="gerando"
        />
        <small v-if="erroDoTelefone" class="eg__invalido">{{ erroDoTelefone }}</small>
        <small v-else class="eg__dica">{{ t('ong.convite.opcionalDica') }}</small>
      </section>

      <p v-if="temConviteValendo" class="eg__aviso" role="status">
        <i class="ph ph-info" aria-hidden="true" />
        <span>{{ t('ong.convite.anteriorDeixaDeValer') }}</span>
      </p>

      <p class="eg__dica">{{ t('ong.convite.quemGeraNaoAceita') }}</p>

      <p v-if="erro" class="eg__erro" role="alert">
        <i class="ph ph-warning-circle" aria-hidden="true" />
        <span>{{ erro }}</span>
      </p>
    </form>

    <!-- 2. O convite pronto. -->
    <div v-else class="eg cd">
      <p class="cd__feito" role="status">
        <i class="ph ph-check-circle" aria-hidden="true" />
        <span>{{ t('ong.convite.pronto', { nome: animal.nome }) }}</span>
      </p>

      <p v-if="convite.canceladas > 0" class="eg__aviso">
        <i class="ph ph-info" aria-hidden="true" />
        <span>{{ t('ong.convite.anteriorCancelado') }}</span>
      </p>

      <Button
        type="button"
        icon="ph ph-whatsapp-logo"
        class="cd__principal"
        :label="t('ong.convite.whatsapp')"
        @click="whatsapp"
      />
      <div class="cd__secundarias">
        <Button
          type="button"
          severity="secondary"
          outlined
          icon="ph ph-copy"
          :label="t('ong.convite.copiarMensagem')"
          @click="copiar(convite.mensagem)"
        />
        <Button
          type="button"
          severity="secondary"
          outlined
          icon="ph ph-qr-code"
          :label="t('ong.convite.telaCheia')"
          @click="mostrarQr"
        />
      </div>

      <section class="cd__qr" :aria-label="t('ong.convite.qrAlt', { nome: animal.nome })">
        <div class="cd__cartao">
          <img
            v-if="qr"
            :src="qr"
            :alt="t('ong.convite.qrAlt', { nome: animal.nome })"
            class="cd__imagem"
          />
        </div>
        <div class="cd__codigo">
          <span class="eg__rotulo">{{ t('ong.convite.codigo') }}</span>
          <strong class="cd__codigo-valor ui-num"
            ><bdi dir="ltr">{{ convite.codigo }}</bdi></strong
          >
          <span class="cd__validade">
            <i class="ph ph-clock" aria-hidden="true" />
            {{ validade(convite.expiraEm) }}
          </span>
        </div>
      </section>

      <section class="eg__secao">
        <label class="eg__rotulo" for="cd-link">{{ t('ong.convite.link') }}</label>
        <div class="cd__campo">
          <InputText id="cd-link" :model-value="convite.link" readonly dir="ltr" />
          <Button
            type="button"
            severity="secondary"
            outlined
            icon="ph ph-copy"
            :label="t('ong.convite.copiarLink')"
            @click="copiar(convite.link)"
          />
        </div>
      </section>

      <section class="eg__secao">
        <label class="eg__rotulo" for="cd-mensagem">{{ t('ong.convite.mensagem') }}</label>
        <Textarea id="cd-mensagem" :model-value="convite.mensagem" readonly rows="5" auto-resize />
      </section>

      <p class="eg__aviso">
        <i class="ph ph-warning-circle" aria-hidden="true" />
        <span>{{ t('ong.convite.soAgora') }}</span>
      </p>
    </div>

    <template #pe>
      <template v-if="!convite">
        <Button
          type="button"
          :label="t('cadastro.cancelar')"
          severity="secondary"
          outlined
          :disabled="gerando"
          @click="aberta = false"
        />
        <Button
          type="submit"
          form="convite-de-adocao"
          icon="ph ph-link"
          :label="t('ong.convite.gerar')"
          :loading="gerando"
        />
      </template>
      <Button
        v-else
        type="button"
        icon="ph ph-check"
        :label="t('ong.convite.fechar')"
        @click="aberta = false"
      />
    </template>
  </CadastroGaveta>

  <!-- O QR em tela cheia, para virar a tela para quem adota no balcão. -->
  <Drawer v-model:visible="qrAberto" position="full" class="cd-qr" :header="store.parceiroNome">
    <div v-if="convite" class="cd-qr__corpo">
      <div class="cd-qr__cartao">
        <img :src="qrGrande" alt="" class="cd-qr__imagem" />
      </div>
      <strong class="cd-qr__codigo ui-num"
        ><bdi dir="ltr">{{ convite.codigo }}</bdi></strong
      >
      <p class="cd-qr__como">{{ t('ong.convite.qrComo', { codigo: convite.codigo }) }}</p>
      <p class="cd-qr__validade">{{ validade(convite.expiraEm) }}</p>
    </div>
  </Drawer>
</template>

<style scoped>
.cd {
  display: grid;
  gap: 14px;
}

.cd__feito {
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

.cd__feito i {
  margin-top: 2px;
  color: var(--ok-tinta);
  font-size: 18px;
}

.cd__principal {
  min-height: 46px;
  font-size: 15px;
}

.cd__secundarias {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.cd__secundarias .p-button {
  flex: 1 1 12rem;
}

.cd__qr {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
}

/* O cartão branco segura o contraste do QR nos dois temas. */
.cd__cartao {
  display: grid;
  flex: none;
  padding: 10px;
  place-items: center;
  border: 1px solid var(--linha);
  border-radius: 16px;
  background: #fff;
}

.cd__imagem {
  display: block;
  width: 168px;
  height: 168px;
}

.cd__codigo {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.cd__codigo-valor {
  color: var(--tinta);
  font-size: 28px;
  font-weight: 700;
  letter-spacing: 0.1em;
}

.cd__validade {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--tinta-2);
  font-size: 13.5px;
}

.cd__campo {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.cd__campo .p-inputtext {
  min-width: 0;
  flex: 1 1 14rem;
}

.cd-qr__corpo {
  display: grid;
  min-height: 100%;
  align-content: center;
  justify-items: center;
  gap: 14px;
  padding: 8px 16px 24px;
  text-align: center;
}

.cd-qr__cartao {
  display: grid;
  padding: 18px;
  place-items: center;
  border: 1px solid var(--linha);
  border-radius: 24px;
  background: #fff;
}

.cd-qr__imagem {
  display: block;
  width: min(50vh, 72vw, 28rem);
  height: auto;
  aspect-ratio: 1;
}

.cd-qr__codigo {
  color: var(--tinta);
  font-size: clamp(32px, 5vw, 48px);
  font-weight: 700;
  letter-spacing: 0.12em;
}

.cd-qr__como {
  max-width: 36rem;
  margin: 0;
  color: var(--tinta);
  font-size: 15px;
  line-height: 1.5;
}

.cd-qr__validade {
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
}
</style>
