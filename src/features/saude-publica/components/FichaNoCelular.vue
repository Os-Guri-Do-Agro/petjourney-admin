<script setup lang="ts">
/**
 * A ficha que o QR Code abre no celular do tutor (Ofício 002/2026, anexo, itens 1 a 3): o que foi
 * feito no atendimento, as datas dos próximos cuidados com o "Já fiz" de um toque, e a orientação
 * do SinPatinhas. Uma página no navegador, sem app nem senha, desenhada dentro de um celular, como
 * a prévia do aviso (`PreviaDoAviso`).
 *
 * `interativa`: na tela do piloto, quem apresenta faz o papel do tutor. Com o QR ainda não lido, a
 * tela pede para ler; depois, "Já fiz" e "Já cadastrei" respondem, e o painel da Subea anda junto.
 * Sem ela (a prévia da gaveta de registro), é só a imagem.
 */
import { computed } from 'vue'

import {
  dataCurta,
  procedimento,
  proximosCuidados,
  type Procedimento,
  type SituacaoNoPiloto,
} from '@/features/saude-publica/dados'

const props = withDefaults(
  defineProps<{
    animal: string
    especie: 'CACHORRO' | 'GATO'
    data: string
    procedimentos: Procedimento[]
    interativa?: boolean
    situacao?: SituacaoNoPiloto
    sinpatinhas?: boolean
  }>(),
  { interativa: false, situacao: 'abriu', sinpatinhas: false },
)

const emit = defineEmits<{ abrir: []; jaFiz: []; sinpatinhas: [] }>()

const feitos = computed(() => props.procedimentos.map(procedimento))
const cuidados = computed(() => proximosCuidados(props.data, props.procedimentos))
const nome = computed(() => props.animal.trim() || 'Seu animal')
const fechada = computed(() => props.interativa && props.situacao === 'nao-abriu')
</script>

<template>
  <figure class="fc" aria-label="Prévia da ficha no celular do tutor">
    <div class="fc__celular">
      <span class="fc__camera" aria-hidden="true" />
      <div class="fc__tela" :class="{ 'fc__tela--fechada': fechada }">
        <p class="fc__endereco" aria-hidden="true">
          <i class="ph ph-lock-simple" />
          petjourney.health
        </p>

        <header class="fc__cabeca">
          <span class="fc__rosto" aria-hidden="true">
            <i :class="especie === 'GATO' ? 'ph ph-cat' : 'ph ph-dog'" />
          </span>
          <span>
            <strong>{{ nome }}</strong>
            <small>Atendido pela Subea em {{ dataCurta(data) }}</small>
          </span>
        </header>

        <section class="fc__bloco">
          <h4>O que foi feito</h4>
          <ul class="fc__lista">
            <li v-for="item in feitos" :key="item.id">
              <i :class="item.icone" aria-hidden="true" />
              <span>{{ item.rotulo }}</span>
              <i class="ph ph-check fc__feito" aria-hidden="true" />
            </li>
          </ul>
        </section>

        <section v-if="cuidados.length" class="fc__bloco">
          <h4>Próximos cuidados</h4>
          <ul class="fc__lista">
            <li v-for="(cuidado, indice) in cuidados" :key="cuidado.rotulo">
              <i class="ph ph-calendar-blank" aria-hidden="true" />
              <span>
                {{ cuidado.rotulo }}
                <small>{{ dataCurta(cuidado.data) }}</small>
              </span>
              <template v-if="indice === 0">
                <span v-if="situacao === 'cumpriu'" class="fc__chip fc__chip--feito">
                  <i class="ph ph-check" aria-hidden="true" />
                  Feito
                </span>
                <span v-else-if="situacao === 'atrasado'" class="fc__chip fc__chip--venceu">
                  Venceu
                </span>
                <button
                  v-else
                  type="button"
                  class="fc__botao"
                  :disabled="!interativa || fechada"
                  @click="emit('jaFiz')"
                >
                  Já fiz
                </button>
              </template>
            </li>
          </ul>
        </section>

        <div class="fc__sinpatinhas">
          <i class="ph ph-identification-card" aria-hidden="true" />
          <span>
            Cadastre {{ nome }} no <strong>SinPatinhas</strong>, o cadastro nacional de cães e
            gatos.
          </span>
          <span v-if="sinpatinhas" class="fc__chip fc__chip--feito">
            <i class="ph ph-check" aria-hidden="true" />
            Informado
          </span>
          <button
            v-else-if="interativa"
            type="button"
            class="fc__botao fc__botao--claro"
            :disabled="fechada"
            @click="emit('sinpatinhas')"
          >
            Já cadastrei
          </button>
        </div>

        <!-- O QR ainda não lido: a ficha existe, mas o tutor ainda não abriu. -->
        <div v-if="fechada" class="fc__qr">
          <span class="fc__qr-icone" aria-hidden="true"><i class="ph ph-qr-code" /></span>
          <strong>O tutor ainda não leu o QR Code</strong>
          <button type="button" class="fc__botao fc__botao--grande" @click="emit('abrir')">
            <i class="ph ph-camera" aria-hidden="true" />
            Ler o QR Code
          </button>
        </div>
      </div>
    </div>
    <figcaption class="fc__legenda">
      {{
        interativa
          ? 'Toque no celular como se fosse o tutor'
          : 'O que o QR Code abre, sem baixar app nem criar senha'
      }}
    </figcaption>
  </figure>
</template>

<style scoped>
.fc {
  display: grid;
  justify-items: center;
  gap: 8px;
  margin: 0;
}

/* O celular: a mesma moldura da prévia do aviso, com a tela branca de uma página aberta. */
.fc__celular {
  position: relative;
  width: 250px;
  padding: 26px 8px 10px;
  border: 7px solid #1b1f1d;
  border-radius: 34px;
  background: #1b1f1d;
  box-shadow: 0 18px 40px -22px rgb(0 0 0 / 55%);
}

/* No escuro, a moldura quase preta sumia no fundo da gaveta: ela clareia e ganha um fio. */
.app-dark .fc__celular {
  border-color: #3b4642;
  background: #3b4642;
  box-shadow:
    0 0 0 1px rgb(255 255 255 / 8%),
    0 18px 40px -22px rgb(0 0 0 / 70%);
}

.fc__camera {
  position: absolute;
  top: 8px;
  left: 50%;
  width: 64px;
  height: 14px;
  border-radius: 999px;
  background: #000;
  transform: translateX(-50%);
}

.fc__tela {
  position: relative;
  display: grid;
  overflow: hidden;
  gap: 10px;
  min-height: 330px;
  align-content: start;
  padding: 10px 10px 12px;
  border-radius: 20px;
  background: #fff;
  color: #1d3557;
  font-size: 11.5px;
  line-height: 1.35;
}

/* A ficha atrás do QR ainda não lido: aparece embaçada, para dizer que existe. */
.fc__tela--fechada > :not(.fc__qr) {
  filter: blur(3px);
  opacity: 0.55;
}

.fc__endereco {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 4px;
  margin: 0;
  padding: 3px 8px;
  border-radius: 999px;
  background: #f0f3f2;
  color: #5f6670;
  font-size: 10.5px;
}

.fc__cabeca {
  display: flex;
  align-items: center;
  gap: 10px;
}

.fc__cabeca > span:last-child {
  display: grid;
}

.fc__cabeca strong {
  font-size: 15px;
}

.fc__cabeca small {
  color: #5f6670;
  font-size: 10.5px;
}

.fc__rosto {
  display: grid;
  width: 38px;
  height: 38px;
  flex: none;
  place-items: center;
  border-radius: 12px;
  background: #d8ece6;
  color: #2c4741;
  font-size: 20px;
}

.fc__bloco {
  display: grid;
  gap: 5px;
}

.fc__bloco h4 {
  margin: 0;
  color: #5c736e;
  font-size: 10.5px;
  font-weight: 700;
}

.fc__lista {
  display: grid;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.fc__lista li {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 6px 8px;
  border-radius: 10px;
  background: #f5f8f7;
}

.fc__lista li > i:first-child {
  color: #5c736e;
  font-size: 14px;
}

.fc__lista li > span:not(.fc__chip) {
  display: grid;
  flex: 1;
  min-width: 0;
}

.fc__lista small {
  color: #5f6670;
  font-size: 10px;
}

.fc__feito {
  color: #2e7d5b;
  font-size: 13px;
}

/* O "Já fiz" do cuidado mais perto: o toque que confirma e conta no painel da Subea. */
.fc__botao {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border: 0;
  border-radius: 999px;
  background: #627a74;
  color: #fff;
  cursor: pointer;
  font: inherit;
  font-size: 10.5px;
  font-weight: 700;
  transition:
    transform 0.15s ease,
    background-color 0.15s ease;
}

.fc__botao:hover:not(:disabled) {
  background: #586e68;
}

.fc__botao:active:not(:disabled) {
  transform: scale(0.94);
}

.fc__botao:disabled {
  cursor: default;
}

.fc__botao:focus-visible {
  outline: 2px solid #2c4741;
  outline-offset: 2px;
}

.fc__botao--claro {
  background: #2f5f8f;
}

.fc__botao--claro:hover:not(:disabled) {
  background: #284f77;
}

.fc__botao--grande {
  padding: 8px 14px;
  font-size: 12px;
}

.fc__chip {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 3px;
  padding: 3px 8px;
  border-radius: 999px;
  font-size: 10.5px;
  font-weight: 700;
}

.fc__chip--feito {
  background: #dcefe4;
  color: #1f6b47;
}

.fc__chip--venceu {
  background: #fbe3d3;
  color: #8a4413;
}

.fc__sinpatinhas {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 7px;
  padding: 7px 8px;
  border-radius: 10px;
  background: #e8f1fb;
  color: #1d3557;
  font-size: 10.5px;
}

.fc__sinpatinhas > span:not(.fc__chip) {
  flex: 1 1 140px;
}

.fc__sinpatinhas > i {
  color: #2f5f8f;
  font-size: 14px;
}

.fc__sinpatinhas > .fc__botao,
.fc__sinpatinhas > .fc__chip {
  margin-inline-start: 21px;
}

/* O convite para ler o QR, por cima da ficha embaçada. */
.fc__qr {
  position: absolute;
  inset: 0;
  display: grid;
  align-content: center;
  justify-items: center;
  gap: 10px;
  padding: 16px;
  background: rgb(255 255 255 / 55%);
  text-align: center;
}

.fc__qr-icone {
  display: grid;
  width: 56px;
  height: 56px;
  place-items: center;
  border-radius: 16px;
  background: #1d3557;
  color: #fff;
  font-size: 30px;
}

.fc__qr strong {
  max-width: 16ch;
  font-size: 13px;
}

.fc__legenda {
  color: var(--tinta-2);
  font-size: 12px;
  text-align: center;
}

@media (prefers-reduced-motion: reduce) {
  .fc__botao {
    transition: none;
  }
}
</style>
