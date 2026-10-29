<script setup lang="ts">
/**
 * A folha de uma tela: título, uma frase de estado, as ações e, quando o destino tem mais de uma
 * tela, as abas. Embaixo, o conteúdo — ou o estado que toma o lugar dele (carregando, erro, vazio,
 * cadastro suspenso, sem acesso).
 *
 * O título é o nome do **destino** (Agenda, Pendências…) e a aba diz qual tela dele está aberta:
 * o mesmo nome que está aceso na barra, então quem olha para a esquerda e para cima lê a mesma
 * coisa. Tela de detalhe (ficha, prontuário, leito) troca o bloco do título pelo dela, no slot
 * `cabecalho`, e volta pelo slot `voltar`.
 *
 * O slot `sempre` é montado em qualquer estado. Diálogos moram nele: com a lista vazia, o botão
 * "Adicionar" ainda precisa abrir o formulário que vai deixar de deixá-la vazia.
 *
 * Na moldura do app (o portal inteiro desde 26/10/2026) o cabeçalho é o do Hoje da Clínica: a faixa
 * sálvia de ponta a ponta, colada no topo, com os desenhos de traço, e o título num cartão branco
 * por cima dela. Quem desenha a própria faixa (o Hoje, com dois cartões) usa o slot `destaque`.
 */
import Button from 'primevue/button'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import { molduraPedida } from '@/components/layout/moldura'
import UiAbas from '@/components/ui/UiAbas.vue'
import UiRabiscos from '@/components/ui/UiRabiscos.vue'
import { isGuidanceVisible, toggleGuidance } from '@/composables/useLayoutPreferences'
import { useLogout } from '@/composables/useLogout'
import { useEspacos } from '@/navegacao/espacos'
import { hasVeterinarioProfile } from '@/service/auth/auth-session'
import { useParceiroStore } from '@/stores/parceiro'
import { SUPPORT_CONTACTS } from '@/utils/parceiro/support-contacts'

const props = withDefaults(
  defineProps<{
    titulo?: string
    resumo?: string
    carregando?: boolean
    erro?: string
    vazio?: boolean
    vazioTitulo?: string
    vazioDescricao?: string
    vazioAcao?: string
    vazioIcone?: string
    bloquearSeSuspenso?: boolean
    semAcessoDeParceiro?: boolean
    /** Botão de explicações (modo guiado) das telas do portal. */
    guia?: boolean
    /** Botão de tour das telas do portal. */
    tour?: boolean
    semAbas?: boolean
    /** `leitura` limita a largura para texto corrido e formulários. */
    largura?: 'cheia' | 'leitura'
    /** Ícone do ladrilho ao lado do título; por padrão, o do destino aberto. */
    icone?: string
  }>(),
  {
    titulo: '',
    resumo: '',
    carregando: false,
    erro: '',
    vazio: false,
    vazioTitulo: '',
    vazioDescricao: '',
    vazioAcao: '',
    vazioIcone: 'ph ph-tray',
    bloquearSeSuspenso: false,
    semAcessoDeParceiro: false,
    guia: false,
    tour: false,
    semAbas: false,
    largura: 'cheia',
    icone: '',
  },
)

const emit = defineEmits<{ tentarDeNovo: []; acaoDoVazio: []; tour: [] }>()

const { t } = useI18n()
const { aqui } = useEspacos()
const parceiroStore = useParceiroStore()
const { logout } = useLogout()

const tituloDaTela = computed(() => props.titulo || aqui.value.destino?.rotulo || '')

/** O ladrilho do título, na cor do espaço: o mesmo ícone do destino aceso na barra. */
const iconeDaTela = computed(() => props.icone || aqui.value.destino?.icone || '')

/*
 * As abas aparecem quando se está numa delas. Tela de detalhe (a ficha, o prontuário, o leito)
 * mora no destino mas não é aba: ela tem a navegação dela, e uma fileira de abas sem nenhuma
 * acesa só confundiria.
 */
const abas = computed(() =>
  !props.semAbas && aqui.value.aba && aqui.value.destino && aqui.value.destino.abas.length > 1
    ? aqui.value.destino.abas
    : [],
)

const acessoEncerrado = computed(() => props.semAcessoDeParceiro && parceiroStore.acessoEncerrado)

const suspenso = computed(
  () =>
    props.bloquearSeSuspenso &&
    !props.semAcessoDeParceiro &&
    !props.carregando &&
    !props.erro &&
    parceiroStore.loadState === 'ready' &&
    parceiroStore.cadastroSuspenso,
)

const motivoDaSuspensao = computed(() => parceiroStore.status?.motivoAuditoria?.trim() || '')

const canais = [
  {
    id: 'whatsapp',
    href: SUPPORT_CONTACTS.whatsappHref,
    icone: 'ph ph-whatsapp-logo',
    chave: 'frame.suspended.channels.whatsapp',
    valor: SUPPORT_CONTACTS.whatsappDisplay,
    externo: true,
  },
  {
    id: 'instagram',
    href: SUPPORT_CONTACTS.instagramHref,
    icone: 'ph ph-instagram-logo',
    chave: 'frame.suspended.channels.instagram',
    valor: SUPPORT_CONTACTS.instagramHandle,
    externo: true,
  },
  {
    id: 'facebook',
    href: SUPPORT_CONTACTS.facebookHref,
    icone: 'ph ph-facebook-logo',
    chave: 'frame.suspended.channels.facebook',
    valor: SUPPORT_CONTACTS.facebookHandle,
    externo: true,
  },
  {
    id: 'email',
    href: `mailto:${SUPPORT_CONTACTS.email}`,
    icone: 'ph ph-envelope-simple',
    chave: 'frame.suspended.channels.email',
    valor: SUPPORT_CONTACTS.email,
    externo: false,
  },
] as const

const mostrarAcoes = computed(() => !props.semAcessoDeParceiro && !suspenso.value)

/** O cabeçalho do app: a faixa sálvia com o cartão do título. Na moldura do portal, o de antes. */
const comFaixa = computed(() => molduraPedida.value === 'app')
</script>

<template>
  <div class="pagina" :class="[`pagina--${largura}`, { 'pagina--faixa': comFaixa }]">
    <section v-if="comFaixa" class="faixa">
      <UiRabiscos />
      <div class="faixa__miolo">
        <slot name="destaque">
          <!-- O cabeçalho do app: texto branco direto na cor, ações em vidro, abas em pílula. -->
          <header class="faixa__cabeca">
            <div v-if="$slots.voltar" class="pagina__voltar faixa__voltar">
              <slot name="voltar" />
            </div>

            <div class="pagina__linha">
              <slot name="cabecalho">
                <div class="pagina__titulos">
                  <h1 class="faixa__titulo">{{ tituloDaTela }}</h1>
                  <p v-if="resumo || $slots.resumo" class="faixa__resumo">
                    <slot name="resumo">{{ resumo }}</slot>
                  </p>
                </div>
              </slot>

              <div v-if="mostrarAcoes && ($slots.acoes || guia || tour)" class="pagina__acoes">
                <Button
                  v-if="tour"
                  type="button"
                  icon="ph ph-question"
                  :label="t('shell.guidance.tour')"
                  severity="secondary"
                  text
                  :title="t('shell.guidance.tourTitulo')"
                  @click="emit('tour')"
                />
                <Button
                  v-else-if="guia"
                  type="button"
                  :icon="isGuidanceVisible ? 'ph ph-eye-slash' : 'ph ph-info'"
                  :label="isGuidanceVisible ? t('shell.guidance.hide') : t('shell.guidance.show')"
                  severity="secondary"
                  text
                  :aria-pressed="isGuidanceVisible"
                  @click="toggleGuidance"
                />
                <slot name="acoes" />
              </div>
            </div>

            <UiAbas
              v-if="abas.length"
              vidro
              class="faixa__abas"
              :abas="abas"
              :atual="aqui.aba?.to ?? null"
              :rotulo="tituloDaTela"
            />
          </header>
        </slot>
      </div>
    </section>

    <header v-else class="pagina__cabeca">
      <div v-if="$slots.voltar" class="pagina__voltar">
        <slot name="voltar" />
      </div>

      <div class="pagina__linha">
        <slot name="cabecalho">
          <div class="pagina__identidade">
            <span
              v-if="iconeDaTela"
              class="ui-ladrilho ui-ladrilho--g ui-ladrilho--lugar pagina__ladrilho"
              aria-hidden="true"
            >
              <i :class="iconeDaTela" />
            </span>
            <div class="pagina__titulos">
              <h1 class="pagina__titulo">{{ tituloDaTela }}</h1>
              <p v-if="resumo || $slots.resumo" class="pagina__resumo">
                <slot name="resumo">{{ resumo }}</slot>
              </p>
            </div>
          </div>
        </slot>

        <div v-if="mostrarAcoes && ($slots.acoes || guia || tour)" class="pagina__acoes">
          <Button
            v-if="tour"
            type="button"
            icon="ph ph-question"
            :label="t('shell.guidance.tour')"
            severity="secondary"
            text
            :title="t('shell.guidance.tourTitulo')"
            @click="emit('tour')"
          />
          <Button
            v-else-if="guia"
            type="button"
            :icon="isGuidanceVisible ? 'ph ph-eye-slash' : 'ph ph-info'"
            :label="isGuidanceVisible ? t('shell.guidance.hide') : t('shell.guidance.show')"
            severity="secondary"
            text
            :aria-pressed="isGuidanceVisible"
            @click="toggleGuidance"
          />
          <slot name="acoes" />
        </div>
      </div>

      <UiAbas
        v-if="abas.length"
        class="pagina__abas"
        :abas="abas"
        :atual="aqui.aba?.to ?? null"
        :rotulo="tituloDaTela"
      />
    </header>

    <div v-if="carregando" class="pagina__estado" role="status" aria-live="polite">
      <span class="pagina__girando" aria-hidden="true" />
      <p>{{ t('frame.loading') }}</p>
    </div>

    <div v-else-if="acessoEncerrado" class="pagina__estado" role="status">
      <span class="pagina__estado-icone" aria-hidden="true"><i class="ph ph-lock" /></span>
      <h2>{{ t('frame.accessRevoked.title') }}</h2>
      <p>{{ t('frame.accessRevoked.body') }}</p>
      <p class="pagina__dica">{{ t('frame.accessRevoked.hint') }}</p>
      <div class="pagina__estado-acoes">
        <a
          class="p-button p-component"
          :href="SUPPORT_CONTACTS.whatsappHref"
          target="_blank"
          rel="noopener noreferrer"
        >
          {{ t('frame.accessRevoked.ctaSupport') }}
        </a>
        <RouterLink class="p-button p-component p-button-secondary" to="/settings?aba=empresa">
          {{ t('frame.accessRevoked.ctaNewCompany') }}
        </RouterLink>
        <Button :label="t('shell.logout')" severity="secondary" text @click="logout" />
      </div>
    </div>

    <div v-else-if="semAcessoDeParceiro" class="pagina__estado" role="status">
      <span class="pagina__estado-icone" aria-hidden="true"><i class="ph ph-buildings" /></span>
      <h2>{{ t('frame.noAccess.title') }}</h2>
      <p>{{ t('frame.noAccess.body') }}</p>
      <p class="pagina__dica">{{ t('frame.noAccess.hint') }}</p>
      <div class="pagina__estado-acoes">
        <RouterLink class="p-button p-component" to="/settings?aba=empresa">
          {{ t('frame.noAccess.ctaPrograms') }}
        </RouterLink>
        <RouterLink class="p-button p-component p-button-secondary p-button-outlined" to="/parceiro/convite">
          {{ t('frame.noAccess.ctaConvites') }}
        </RouterLink>
        <RouterLink
          v-if="hasVeterinarioProfile()"
          class="p-button p-component p-button-secondary"
          to="/settings?aba=perfil"
        >
          {{ t('frame.noAccess.ctaSettings') }}
        </RouterLink>
        <Button
          :label="t('frame.noAccess.retry')"
          severity="secondary"
          text
          @click="emit('tentarDeNovo')"
        />
      </div>
    </div>

    <div v-else-if="erro" class="pagina__estado pagina__estado--erro" role="alert">
      <span class="pagina__estado-icone" aria-hidden="true"><i class="ph ph-warning-circle" /></span>
      <h2>{{ t('frame.error.title') }}</h2>
      <p>{{ erro }}</p>
      <div class="pagina__estado-acoes">
        <Button
          icon="ph ph-arrow-clockwise"
          :label="t('frame.error.retry')"
          severity="secondary"
          @click="emit('tentarDeNovo')"
        />
      </div>
    </div>

    <div v-else-if="suspenso" class="pagina__estado pagina__estado--erro" role="alert">
      <span class="pagina__estado-icone" aria-hidden="true"><i class="ph ph-prohibit" /></span>
      <h2>{{ t('frame.suspended.title') }}</h2>
      <p>{{ t('frame.suspended.body') }}</p>
      <p v-if="motivoDaSuspensao" class="pagina__dica">
        {{ t('frame.operability.reasonPrefix') }} {{ motivoDaSuspensao }}
      </p>
      <p class="pagina__dica">{{ t('frame.suspended.channelsLede') }}</p>
      <ul class="pagina__canais">
        <li v-for="canal in canais" :key="canal.id">
          <a
            class="pagina__canal"
            :href="canal.href"
            :target="canal.externo ? '_blank' : undefined"
            :rel="canal.externo ? 'noopener noreferrer' : undefined"
          >
            <i :class="canal.icone" aria-hidden="true" />
            <span>
              <strong>{{ t(canal.chave) }}</strong>
              <small>{{ canal.valor }}</small>
            </span>
          </a>
        </li>
      </ul>
    </div>

    <div v-else-if="vazio" class="pagina__estado">
      <span class="pagina__estado-icone" aria-hidden="true"><i :class="vazioIcone" /></span>
      <h2>{{ vazioTitulo || t('frame.emptyDefault') }}</h2>
      <p v-if="vazioDescricao">{{ vazioDescricao }}</p>
      <div v-if="vazioAcao" class="pagina__estado-acoes">
        <Button icon="ph ph-plus" :label="vazioAcao" @click="emit('acaoDoVazio')" />
      </div>
    </div>

    <div v-else class="pagina__corpo">
      <slot />
    </div>

    <slot name="sempre" />
  </div>
</template>

<style scoped>
.pagina {
  --pagina-margem: 36px;

  width: 100%;
  max-width: 1560px;
  min-width: 0;
  margin: 0 auto;
  padding: 30px var(--pagina-margem) 64px;
  color: var(--tinta);
}

.pagina--leitura {
  max-width: 1120px;
}

/* ------------------------------------------------------------------- a faixa do app */

/*
 * Na moldura do app a folha vai de ponta a ponta (sem coluna centralizada) e a faixa cola no topo,
 * só com os cantos de baixo arredondados, como o topo da home do app. Tela de leitura limita o
 * conteúdo, não a faixa.
 */
.pagina.pagina--faixa {
  max-width: none;
  padding-top: 0;
}

.pagina--faixa.pagina--leitura .pagina__corpo {
  max-width: 1120px;
}

.faixa {
  --rabiscos-forca: 0.2;

  position: relative;
  margin: 0 calc(var(--pagina-margem) * -1) 28px;
  overflow: hidden;
  border-radius: 0 0 28px 28px;
  background: var(--app-destaque);
  color: #fff;
  isolation: isolate;
  container: faixa / inline-size;
}

.faixa__miolo {
  position: relative;
  padding: 28px var(--pagina-margem) 26px;
}

/*
 * O cabeçalho do app (`ScreenHeader`): texto branco cheio direto na cor, nunca translúcido. O que a
 * tela põe aqui (a capa da ficha, do leito, da estadia) lê os tokens do Trilha, então eles passam a
 * valer o branco e o vidro dentro da faixa: tinta branca, régua e poço em vidro, botão principal em
 * papel branco, o resto em vidro.
 */
.faixa__cabeca {
  --tinta: #fff;
  --tinta-2: #fff;
  --tinta-3: #fff;
  --linha: rgb(255 255 255 / 26%);
  --linha-suave: rgb(255 255 255 / 18%);
  --linha-media: rgb(255 255 255 / 40%);
  --superficie: transparent;
  --superficie-2: var(--app-vidro);
  --superficie-3: var(--app-vidro-forte);
  --musgo: #fff;
  --pj-lugar: #fff;
  --p-button-primary-background: #fff;
  --p-button-primary-hover-background: rgb(255 255 255 / 88%);
  --p-button-primary-active-background: rgb(255 255 255 / 80%);
  --p-button-primary-border-color: #fff;
  --p-button-primary-hover-border-color: #fff;
  --p-button-primary-active-border-color: #fff;
  --p-button-primary-color: #2c4741;
  --p-button-primary-hover-color: #2c4741;
  --p-button-primary-active-color: #2c4741;
  --p-button-secondary-background: var(--app-vidro);
  --p-button-secondary-hover-background: var(--app-vidro-forte);
  --p-button-secondary-active-background: var(--app-vidro-forte);
  --p-button-secondary-color: #fff;
  --p-button-secondary-hover-color: #fff;
  --p-button-secondary-active-color: #fff;
  --p-button-text-secondary-color: #fff;
  --p-button-text-primary-color: #fff;
  --p-button-text-primary-hover-background: var(--app-vidro);
  --p-button-text-secondary-hover-background: var(--app-vidro);
  --p-button-outlined-secondary-border-color: rgb(255 255 255 / 45%);
  --p-button-outlined-primary-border-color: rgb(255 255 255 / 45%);
  --p-button-outlined-secondary-color: #fff;
  --p-button-outlined-primary-color: #fff;

  display: grid;
  gap: 18px;
  color: #fff;
}

/* No escuro a faixa é sálvia funda: o botão principal é o papel do cartão, não branco cheio. */
.app-dark .faixa__cabeca {
  --p-button-primary-background: var(--app-cartao);
  --p-button-primary-hover-background: var(--app-fundo);
  --p-button-primary-active-background: var(--app-fundo);
  --p-button-primary-border-color: var(--app-cartao);
  --p-button-primary-hover-border-color: var(--app-fundo);
  --p-button-primary-active-border-color: var(--app-fundo);
  --p-button-primary-color: var(--app-tinta);
  --p-button-primary-hover-color: var(--app-tinta);
  --p-button-primary-active-color: var(--app-tinta);
}

.faixa__voltar :deep(a),
.faixa__voltar :deep(a:hover) {
  color: #fff;
  font-weight: 600;
}

.faixa__titulo {
  margin: 0;
  color: #fff;
  font-size: 26px;
  font-weight: 700;
  letter-spacing: -0.5px;
  line-height: 1.2;
}

.faixa__resumo {
  max-width: 80ch;
  margin: 0;
  color: #fff;
  font-size: 14.5px;
  font-weight: 500;
  line-height: 1.45;
}

/*
 * O ícone da aba aberta da capa (ficha, leito) usa a tinta da área, escura: direto na sálvia ele
 * some. Na faixa ele é branco como o rótulo. Os ícones em quadradinho pastel continuam na tinta.
 */
.faixa__cabeca :deep(.capa__aba--atual i) {
  color: #fff;
}

/* Link na faixa (o telefone do responsável, "ver mais") é branco e sublinhado, nunca azul. */
.faixa__cabeca :deep(a:not(.p-button)) {
  color: #fff;
  text-decoration-color: rgb(255 255 255 / 60%);
}

/*
 * Segmentado na faixa (a adaptação na estadia): trilho em vidro, opções em branco, a marcada em
 * papel com a tinta escura, como a aba aberta. A tinta da família (atenção, risco) que a tela põe
 * no rótulo marcado continua lida, porque agora está sobre o papel.
 */
.faixa__cabeca :deep(.p-selectbutton) {
  background: var(--app-vidro);
}

.faixa__cabeca :deep(.p-togglebutton) {
  color: #fff;
}

/* `!important`: a regra do kit para segmentado (`html.trilha .p-selectbutton…`) pesa mais. */
.faixa__cabeca :deep(.p-togglebutton.p-togglebutton-checked .p-togglebutton-content) {
  background: #fff !important;
  box-shadow: none !important;
  color: #2c4741;
}

.app-dark .faixa__cabeca :deep(.p-togglebutton.p-togglebutton-checked .p-togglebutton-content) {
  background: var(--app-cartao) !important;
  color: var(--app-tinta);
}

/* A capa que a tela traz numa folha se dissolve na faixa: a cor é o fundo dela. */
.faixa__cabeca :deep(.ui-folha) {
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

.pagina__cabeca {
  display: grid;
  gap: 18px;
  margin-bottom: 28px;
}

.pagina__voltar :deep(a) {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--tinta-2);
  font-size: 13.5px;
  font-weight: 500;
  text-decoration: none;
}

.pagina__voltar :deep(a:hover) {
  color: var(--tinta);
}

.pagina__linha {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 16px 24px;
}

.pagina__identidade {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 16px;
}

.pagina__ladrilho {
  width: 52px;
  height: 52px;
  border-radius: 16px;
  font-size: 26px;
}

.pagina__titulos {
  display: grid;
  min-width: 0;
  gap: 4px;
}

.pagina__titulo {
  margin: 0;
  color: var(--tinta);
  font-size: 28px;
  font-weight: 650;
  letter-spacing: -0.025em;
  line-height: 1.15;
}

.pagina__resumo {
  max-width: 76ch;
  margin: 0;
  color: var(--tinta-2);
  font-size: 14.5px;
  line-height: 1.5;
}

.pagina__acoes {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.pagina__abas {
  margin-top: 4px;
}

/* Estados: uma folha só, centrada, com o ícone num disco e no máximo duas ações. */
.pagina__estado {
  display: grid;
  max-width: 560px;
  justify-items: center;
  gap: 8px;
  margin: 24px auto;
  padding: 44px 36px;
  border: 1px solid var(--linha);
  border-radius: var(--raio-painel);
  background: var(--superficie);
  box-shadow: var(--sombra-cartao);
  text-align: center;
}

.pagina__estado h2 {
  margin: 8px 0 0;
  font-size: 18px;
  font-weight: 600;
}

.pagina__estado p {
  max-width: 48ch;
  margin: 0;
  color: var(--tinta-2);
  line-height: 1.5;
}

.pagina__dica {
  font-size: 13.5px;
}

.pagina__estado-icone {
  display: grid;
  width: 60px;
  height: 60px;
  place-items: center;
  border-radius: 18px;
  background: var(--pj-lugar-fundo);
  color: var(--pj-lugar-tinta);
  font-size: 28px;
}

.pagina__estado--erro .pagina__estado-icone {
  background: var(--risco-fundo);
  color: var(--risco-tinta);
}

.pagina__estado-acoes {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  margin-top: 12px;
}

.pagina__estado-acoes a {
  text-decoration: none;
}

.pagina__girando {
  width: 28px;
  height: 28px;
  border: 3px solid var(--superficie-3);
  border-top-color: var(--pj-lugar, var(--musgo));
  border-radius: 50%;
  animation: girar 0.9s linear infinite;
}

@keyframes girar {
  to {
    transform: rotate(360deg);
  }
}

.pagina__canais {
  display: grid;
  width: 100%;
  gap: 6px;
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
  text-align: left;
}

.pagina__canal {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--linha);
  border-radius: 12px;
  color: var(--tinta);
  text-decoration: none;
}

.pagina__canal:hover {
  background: var(--superficie-2);
}

.pagina__canal i {
  font-size: 20px;
}

.pagina__canal span {
  display: grid;
}

.pagina__canal small {
  color: var(--tinta-2);
}

@media (max-width: 900px) {
  .pagina {
    --pagina-margem: 16px;

    padding-top: 20px;
  }

  .pagina__titulo,
  .faixa__titulo {
    font-size: 24px;
  }

  .faixa__miolo {
    padding-block: 20px 22px;
  }

  .pagina__ladrilho {
    width: 44px;
    height: 44px;
    border-radius: 13px;
    font-size: 22px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .pagina__girando {
    animation-duration: 2.4s;
  }
}
</style>
