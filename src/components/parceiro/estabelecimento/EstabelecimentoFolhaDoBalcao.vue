<script setup lang="ts">
/**
 * A folha do balcão: uma A4 com a cara da PetJourney para colar na recepção. No alto, a faixa
 * sálvia com os desenhos de traço do app, o nome da casa e a chamada; o QR grande num cartão branco
 * que avança sobre a faixa; os três passos para quem nunca leu um QR; o endereço; e, no pé, outra
 * faixa sálvia com a logo da PetJourney em creme.
 *
 * Não é tela: fica escondida e só aparece no papel, enquanto a página imprime
 * (`html.imprimindo-folha`, que a gaveta do QR liga e desliga). Imprimir daqui, e não de uma janela
 * nova, mantém as fontes, os desenhos e a pata da marca, e não esbarra em bloqueio de janela.
 */
import { useI18n } from 'vue-i18n'

import logoEmCreme from '@/assets/Logos/logo-pata-e-nome-creme.png'
import UiRabiscos from '@/components/ui/UiRabiscos.vue'
import type { LinkDaPaginaPublica } from '@/utils/parceiro/pagina-publica'

defineProps<{
  nome: string
  tipo: LinkDaPaginaPublica['tipo']
  endereco: string
  /** O QR já gerado, em PNG. */
  imagem: string
}>()

const { t } = useI18n()

const PASSOS = ['abrir', 'apontar', 'tocar'] as const
</script>

<template>
  <Teleport to="body">
    <div class="fb" aria-hidden="true">
      <article class="fb__folha">
        <header class="fb__faixa">
          <UiRabiscos />
          <h1 class="fb__nome">{{ nome }}</h1>
          <p class="fb__chamada">{{ t(`parceiro.estabelecimento.qr.folha.chamada.${tipo}`) }}</p>
        </header>

        <div class="fb__cartao">
          <img :src="imagem" alt="" class="fb__qr" />
        </div>

        <ol class="fb__passos">
          <li v-for="(passo, indice) in PASSOS" :key="passo" class="fb__passo">
            <span class="fb__numero">{{ indice + 1 }}</span>
            <span>{{ t(`parceiro.estabelecimento.qr.folha.passo.${passo}`) }}</span>
          </li>
        </ol>

        <p class="fb__endereco" dir="ltr">{{ endereco }}</p>

        <!-- A logo é creme (a pata com o sálvia dentro): pede o fundo sálvia, no papel branco sumia. -->
        <footer class="fb__pe">
          <UiRabiscos />
          <img :src="logoEmCreme" alt="PetJourney" class="fb__marca" />
        </footer>
      </article>
    </div>
  </Teleport>
</template>

<!--
  Sem escopo de propósito: a folha mora no `body` (Teleport) e quem a mostra é a classe no `<html>`.
  O `@page` não fica aqui: a gaveta o põe só durante a impressão, para não mexer na margem das
  outras impressões do portal.
-->
<style>
/* Na tela, nunca: a prévia do navegador já mostra a folha, e uma cópia atrás dela só atrapalhava. */
.fb {
  display: none;
}

@media print {
  html.imprimindo-folha body > *:not(.fb) {
    display: none !important;
  }

  /*
   * A impressão da Clínica (`clinic-tokens.css`) esconde tudo o que não é `.clinic-print-root`,
   * também com `!important`. Este seletor pesa mais que o dela, e a folha volta a aparecer.
   */
  html.imprimindo-folha body > .fb {
    display: block !important;
  }

  html.imprimindo-folha,
  html.imprimindo-folha body {
    height: auto !important;
    margin: 0 !important;
    padding: 0 !important;
    overflow: visible !important;
    background: #fff !important;
  }
}

/* A folha em milímetros: o mesmo desenho na tela e no papel. */
.fb__folha {
  display: flex;
  width: 210mm;
  height: 297mm;
  box-sizing: border-box;
  flex-direction: column;
  align-items: center;
  overflow: hidden;
  background: #fff;
  color: #10302a;
  font-family: var(--font-texto, system-ui, sans-serif);
  text-align: center;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

/* A faixa do app: sálvia lisa, os desenhos de traço em branco e os cantos de baixo arredondados. */
.fb__faixa {
  --rabiscos-forca: 0.24;

  position: relative;
  display: flex;
  width: 100%;
  height: 84mm;
  box-sizing: border-box;
  flex: none;
  flex-direction: column;
  align-items: center;
  padding: 20mm 18mm 0;
  overflow: hidden;
  isolation: isolate;
  border-radius: 0 0 12mm 12mm;
  background: #76938d;
  color: #fff;
}

.fb__nome {
  display: -webkit-box;
  max-width: 170mm;
  margin: 0;
  overflow: hidden;
  font-size: 34px;
  font-weight: 700;
  letter-spacing: -0.01em;
  line-height: 1.15;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.fb__chamada {
  margin: 3mm 0 0;
  font-size: 19px;
  font-weight: 500;
}

/* O QR num cartão branco que avança sobre a faixa, como o cartão do topo do app. */
.fb__cartao {
  position: relative;
  z-index: 1;
  display: grid;
  margin-top: -28mm;
  padding: 7mm;
  place-items: center;
  border: 0.4mm solid #dbe5e2;
  border-radius: 9mm;
  background: #fff;
}

.fb__qr {
  display: block;
  width: 116mm;
  height: 116mm;
}

.fb__passos {
  display: grid;
  width: 170mm;
  grid-template-columns: repeat(3, 1fr);
  gap: 6mm;
  margin: 12mm 0 0;
  padding: 0;
  list-style: none;
}

.fb__passo {
  display: grid;
  justify-items: center;
  gap: 3mm;
  font-size: 15px;
  font-weight: 500;
  line-height: 1.3;
}

.fb__numero {
  display: grid;
  width: 10mm;
  height: 10mm;
  place-items: center;
  border-radius: 50%;
  background: #e6eeeb;
  color: #3f5c55;
  font-size: 16px;
  font-weight: 700;
}

.fb__endereco {
  margin: 9mm 0 0;
  color: #3f5c55;
  font-family: var(--font-dados, var(--font-texto, system-ui, sans-serif));
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.01em;
}

/* O pé espelha o topo: a mesma sálvia com os desenhos, os cantos de cima arredondados. */
.fb__pe {
  --rabiscos-forca: 0.2;

  position: relative;
  display: grid;
  width: 100%;
  height: 40mm;
  flex: none;
  margin-top: auto;
  place-items: center;
  overflow: hidden;
  isolation: isolate;
  border-radius: 12mm 12mm 0 0;
  background: #76938d;
}

.fb__marca {
  display: block;
  width: 76mm;
  height: auto;
}
</style>
