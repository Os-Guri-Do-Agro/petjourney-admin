<script setup lang="ts">
/**
 * O que o responsável vê no celular.
 *
 * Existe porque **é o produto**. Todo o resto do módulo é ferramenta de clínica; isto é a coisa
 * que a Rita abre às 11 da noite em vez de ligar. Quem está construindo a tela da clínica precisa
 * ver, ao lado, o que sai do outro lado — senão o boletim vira mais um campo de formulário e
 * ninguém percebe que ele saiu seco, ou grande demais, ou tarde.
 *
 * É uma **prévia fiel, não um enfeite**: mesma ordem, mesmo agrupamento por dia, e só o que já
 * chegou ao celular. O boletim retido aparece aqui como **ausência pura**.
 *
 * Até aqui a prévia dizia "1 boletim ainda na clínica, aguardando ligação" — e o app de verdade
 * não vai dizer isso, porque o contrato não tem esse campo (`contrato/responsavel.ts`, tipo
 * `Internacao`). Um aviso de boletim retido contaria ao responsável que há notícia ruim antes da
 * ligação, que é exatamente o que a retenção existe para impedir. Quem precisa saber do retido é
 * a clínica, e ela sabe pela aba de boletins.
 */
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import type { BoletimAoTutor } from '../../data/types'
import { useClinicFormat } from '../../composables/useClinicFormat'

const props = defineProps<{
  boletins: BoletimAoTutor[]
  petNome: string
  petIniciais: string
  clinicaNome: string
}>()

const { t } = useI18n()
const formato = useClinicFormat()

const conversa = ref<HTMLElement | null>(null)

/** Só o que de fato chegou ao celular. Retido e liberado ainda estão na clínica. */
const enviados = computed(() =>
  [...props.boletins]
    .filter((item) => item.status === 'enviado')
    .sort((a, b) => (a.enviadoEm ?? a.geradoEm).localeCompare(b.enviadoEm ?? b.geradoEm)),
)

type Dia = { data: string; rotulo: string; itens: BoletimAoTutor[] }

const porDia = computed<Dia[]>(() => {
  const mapa = new Map<string, BoletimAoTutor[]>()

  for (const boletim of enviados.value) {
    const data = (boletim.enviadoEm ?? boletim.geradoEm).slice(0, 10)

    mapa.set(data, [...(mapa.get(data) ?? []), boletim])
  }

  return [...mapa.entries()].map(([data, itens]) => ({
    data,
    rotulo: formato.dataCurta(data),
    itens,
  }))
})

/**
 * A conversa abre na mensagem **mais recente**, como qualquer aplicativo de mensagem.
 *
 * Aberta no topo, a prévia mostrava o boletim mais antigo da internação e escondia justamente o
 * que acabou de sair — que é o que a clínica quer conferir depois de enviar.
 */
watch(
  () => enviados.value.length,
  async () => {
    await nextTick()

    if (conversa.value) {
      conversa.value.scrollTop = conversa.value.scrollHeight
    }
  },
  { immediate: true },
)
</script>

<template>
  <div class="celular">
    <div class="celular__moldura">
      <header class="celular__topo">
        <span class="celular__avatar" aria-hidden="true">{{ petIniciais }}</span>
        <span class="celular__identidade">
          <strong>{{ petNome }}</strong>
          <span>{{ clinicaNome }}</span>
        </span>
      </header>

      <div ref="conversa" class="celular__conversa">
        <p v-if="enviados.length === 0" class="celular__vazio">
          {{ t('clinico.internacao.app.vazio') }}
        </p>

        <template v-for="dia in porDia" :key="dia.data">
          <p class="celular__dia">{{ dia.rotulo }}</p>

          <article v-for="boletim in dia.itens" :key="boletim.id" class="balao">
            <p class="balao__texto">{{ boletim.texto }}</p>

            <figure v-if="boletim.foto" class="balao__foto">
              <span class="balao__fotoMarca" aria-hidden="true">{{ boletim.foto }}</span>
              <figcaption v-if="boletim.fotoLegenda">{{ boletim.fotoLegenda }}</figcaption>
              <figcaption v-else>{{ t('clinico.internacao.app.foto') }}</figcaption>
            </figure>

            <footer class="balao__rodape">
              <span>{{ formato.hora(boletim.enviadoEm ?? boletim.geradoEm) }}</span>
              <!--
                A ligação aparece no celular, e não só na clínica: quando a notícia é grave, o
                responsável precisa reconhecer a mensagem como o registro da conversa que já
                teve — não como a forma pela qual ele ficou sabendo.
              -->
              <span v-if="boletim.ligacaoEm" class="balao__ligacao">
                <i class="ph ph-phone" aria-hidden="true" />
                {{ t('clinico.internacao.app.aposLigacao') }}
              </span>
            </footer>
          </article>
        </template>
      </div>

    </div>
  </div>
</template>

<style scoped>
.celular {
  display: flex;
  justify-content: center;
}

/*
 * A moldura é sóbria de propósito: uma casquinha de telefone desenhada com brilho e reflexo
 * roubaria a atenção do conteúdo, que é o que precisa ser julgado aqui.
 */
.celular__moldura {
  display: flex;
  width: min(330px, 100%);
  max-height: 560px;
  flex-direction: column;
  gap: 12px;
  padding: 14px 12px 12px;
  border: 1px solid var(--linha-forte);
  border-radius: 30px;
  background: var(--superficie-3);
  box-shadow: var(--sombra-1);
}

.celular__topo {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 6px 12px;
  border-bottom: 1px solid var(--linha);
}

.celular__avatar {
  display: grid;
  width: 34px;
  height: 34px;
  flex: none;
  place-items: center;
  border-radius: 50%;
  background: var(--pj-lugar-fundo, var(--musgo-fundo));
  color: var(--pj-lugar-tinta, var(--musgo));
  font-family: var(--font-dados);
  font-size: 13px;
  font-weight: 650;
}

.celular__identidade {
  display: grid;
  min-width: 0;
  gap: 1px;
}

.celular__identidade strong {
  overflow-wrap: anywhere;
  color: var(--tinta);
  font-size: 14.5px;
  font-weight: 600;
}

.celular__identidade span {
  color: var(--tinta-2);
  font-size: 12.5px;
}

.celular__conversa {
  display: grid;
  overflow-y: auto;
  flex: 1;
  align-content: start;
  gap: 8px;
  padding: 0 2px 2px;
}

.celular__vazio {
  margin: auto 0;
  padding: 24px 8px;
  color: var(--tinta-2);
  font-size: 13px;
  text-align: center;
}

.celular__dia {
  justify-self: center;
  margin: 8px 0 2px;
  padding: 2px 10px;
  border-radius: 999px;
  background: var(--superficie-2);
  color: var(--tinta-2);
  font-size: 12px;
}

.balao {
  max-width: 92%;
  padding: 10px 12px;
  border-radius: 16px;
  border-end-start-radius: 4px;
  background: var(--superficie);
  box-shadow: var(--sombra-1);
}

.balao__texto {
  margin: 0;
  color: var(--tinta);
  font-size: 13.5px;
  line-height: 1.5;
  white-space: pre-line;
}

.balao__foto {
  display: grid;
  gap: 4px;
  justify-items: center;
  margin: 8px 0 0;
}

/* Sem foto de verdade no protótipo: um retângulo honesto com as iniciais do paciente. */
.balao__fotoMarca {
  display: grid;
  width: 100%;
  height: 84px;
  place-items: center;
  border-radius: 10px;
  background: var(--pj-lugar-fundo, var(--musgo-fundo));
  color: var(--pj-lugar-tinta, var(--musgo));
  font-family: var(--font-dados);
  font-size: 20px;
  font-weight: 650;
}

.balao__foto figcaption {
  color: var(--tinta-2);
  font-size: 12px;
}

.balao__rodape {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 8px;
  margin-top: 6px;
  color: var(--tinta-3);
  font-family: var(--font-dados);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.balao__ligacao {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--musgo);
  font-family: var(--font-texto);
  font-weight: 600;
}
</style>
