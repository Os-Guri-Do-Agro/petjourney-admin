<script setup lang="ts">
/**
 * O aviso como o tutor recebe: a tela de bloqueio de um celular com a notificação do app
 * PetJourney. É o item 4d do ofício na frente de quem decide: a campanha chega no bolso de quem
 * precisa dela, e só de quem precisa.
 */
defineProps<{ titulo: string; texto: string }>()
</script>

<template>
  <figure class="previa" aria-label="Prévia do aviso no celular do tutor">
    <div class="previa__celular">
      <span class="previa__camera" aria-hidden="true" />
      <span class="previa__hora" aria-hidden="true">9:41</span>
      <span class="previa__data" aria-hidden="true">sábado, 6 de março</span>

      <div class="previa__aviso">
        <span class="previa__app" aria-hidden="true"><i class="ph ph-paw-print" /></span>
        <span class="previa__corpo">
          <span class="previa__cabeca">
            <strong>PetJourney</strong>
            <small>agora</small>
          </span>
          <strong class="previa__titulo">{{ titulo }}</strong>
          <span class="previa__texto">{{ texto }}</span>
        </span>
      </div>
    </div>
    <figcaption class="previa__legenda">Como o tutor recebe no celular</figcaption>
  </figure>
</template>

<style scoped>
.previa {
  display: grid;
  justify-items: center;
  gap: 8px;
  margin: 0;
}

/* O celular: um retângulo escuro de cantos grandes, com a tela em degradê do verde da marca. */
.previa__celular {
  position: relative;
  display: grid;
  align-content: start;
  justify-items: center;
  width: 250px;
  min-height: 300px;
  padding: 34px 12px 18px;
  border: 7px solid #1b1f1d;
  border-radius: 34px;
  background:
    radial-gradient(120% 70% at 50% 0%, #7fb8a8 0%, transparent 70%),
    linear-gradient(180deg, #2f5a4f 0%, #173029 100%);
  box-shadow: 0 18px 40px -22px rgb(0 0 0 / 55%);
  color: #fff;
}

.previa__camera {
  position: absolute;
  top: 9px;
  width: 64px;
  height: 16px;
  border-radius: 999px;
  background: #1b1f1d;
}

.previa__hora {
  font-family: var(--font-dados);
  font-size: 46px;
  font-weight: 700;
  line-height: 1;
}

.previa__data {
  margin-top: 4px;
  font-size: 12px;
  opacity: 0.85;
}

/* A notificação: o vidro claro das telas de bloqueio, com o ícone do app. */
.previa__aviso {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  width: 100%;
  margin-top: 26px;
  padding: 10px;
  border-radius: 16px;
  background: rgb(255 255 255 / 88%);
  color: #142721;
  text-align: start;
}

.previa__app {
  display: grid;
  flex: none;
  width: 30px;
  height: 30px;
  place-items: center;
  border-radius: 8px;
  background: #84c1b4;
  color: #10302a;
  font-size: 17px;
}

.previa__corpo {
  display: grid;
  min-width: 0;
  gap: 1px;
  font-size: 11.5px;
  line-height: 1.35;
}

.previa__cabeca {
  display: flex;
  justify-content: space-between;
  gap: 6px;
  color: #40524b;
  font-size: 10.5px;
}

.previa__cabeca strong {
  font-weight: 650;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.previa__titulo {
  font-size: 12px;
  font-weight: 750;
}

.previa__texto {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 5;
  line-clamp: 5;
}

.previa__legenda {
  color: var(--tinta-3);
  font-size: 12px;
}
</style>
