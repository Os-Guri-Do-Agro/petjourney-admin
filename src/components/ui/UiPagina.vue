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
 */
import Button from 'primevue/button'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import UiAbas from '@/components/ui/UiAbas.vue'
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
  },
)

const emit = defineEmits<{ tentarDeNovo: []; acaoDoVazio: []; tour: [] }>()

const { t } = useI18n()
const { aqui } = useEspacos()
const parceiroStore = useParceiroStore()
const { logout } = useLogout()

const tituloDaTela = computed(() => props.titulo || aqui.value.destino?.rotulo || '')

const abas = computed(() =>
  !props.semAbas && aqui.value.destino && aqui.value.destino.abas.length > 1
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
</script>

<template>
  <div class="pagina" :class="[`pagina--${largura}`]">
    <header class="pagina__cabeca">
      <div v-if="$slots.voltar" class="pagina__voltar">
        <slot name="voltar" />
      </div>

      <div class="pagina__linha">
        <slot name="cabecalho">
          <div class="pagina__titulos">
            <h1 class="pagina__titulo">{{ tituloDaTela }}</h1>
            <p v-if="resumo || $slots.resumo" class="pagina__resumo">
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
            :icon="isGuidanceVisible ? 'ph ph-info-fill' : 'ph ph-info'"
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
  --pagina-margem: 32px;

  width: 100%;
  min-width: 0;
  margin: 0 auto;
  padding: 28px var(--pagina-margem) 56px;
  color: var(--tinta);
}

.pagina--leitura {
  max-width: 1080px;
}

.pagina__cabeca {
  display: grid;
  gap: 14px;
  margin-bottom: 24px;
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
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px 24px;
}

.pagina__titulos {
  display: grid;
  min-width: 0;
  gap: 6px;
}

.pagina__titulo {
  margin: 0;
  color: var(--tinta);
  font-size: 30px;
  font-weight: 600;
  letter-spacing: -0.02em;
  line-height: 1.15;
}

.pagina__resumo {
  max-width: 72ch;
  margin: 0;
  color: var(--tinta-2);
  font-size: 15px;
  line-height: 1.45;
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
  padding: 40px 32px;
  border: 1px solid var(--linha);
  border-radius: 20px;
  background: var(--superficie);
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
  width: 52px;
  height: 52px;
  place-items: center;
  border-radius: 16px;
  background: var(--superficie-2);
  color: var(--tinta-2);
  font-size: 24px;
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

  .pagina__titulo {
    font-size: 24px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .pagina__girando {
    animation-duration: 2.4s;
  }
}
</style>
