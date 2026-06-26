<template>
  <div class="login-page">
    <div class="login-card">
      <!-- form -->
      <div class="login-form">
        <div class="brand">
          <PawLogo :size="40" />
          <span class="brand-name">PetJourney</span>
        </div>

        <div class="form-mid">
          <h1 class="h1">Bem-vindo de volta</h1>
          <p class="sub">
            Entre para acompanhar a agenda, os prontuários e o cuidado dos seus pacientes.
          </p>

          <form @submit.prevent="signIn">
            <div class="field">
              <label class="field-label">E-mail</label>
              <div class="field-row">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#9AA8A3"
                  stroke-width="1.8"
                >
                  <rect x="3" y="5" width="18" height="14" rx="2.5" />
                  <path d="m3.5 7 8.5 6 8.5-6" />
                </svg>
                <input
                  v-model="email"
                  type="email"
                  placeholder="voce@clinica.vet"
                  autocomplete="email"
                />
              </div>
            </div>

            <div class="field">
              <div class="field-head">
                <label class="field-label">Senha</label>
                <a class="link" href="#">Esqueceu a senha?</a>
              </div>
              <div class="field-row">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#9AA8A3"
                  stroke-width="1.8"
                >
                  <rect x="4" y="10" width="16" height="11" rx="2.5" />
                  <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                </svg>
                <input
                  v-model="password"
                  :type="show ? 'text' : 'password'"
                  placeholder="••••••••"
                  autocomplete="current-password"
                />
                <svg
                  class="eye"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#9AA8A3"
                  stroke-width="1.8"
                  @click="show = !show"
                >
                  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </div>
            </div>

            <label class="checkbox-row">
              <input type="checkbox" v-model="remember" hidden />
              <span class="checkbox-box" :class="{ on: remember }">
                <svg
                  v-if="remember"
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#fff"
                  stroke-width="3"
                >
                  <path d="m5 12 5 5 9-11" />
                </svg>
              </span>
              <span class="checkbox-text">Manter conectado neste computador</span>
            </label>

            <button class="btn btn-primary btn-block submit cursor-pointer" type="submit">
              Entrar no painel
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#fff"
                stroke-width="2"
              >
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </button>

            <div class="divider"><span>ou</span></div>

            <button class="btn btn-ghost btn-block" type="button">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#84A59D"
                stroke-width="1.8"
              >
                <rect x="3" y="4" width="18" height="16" rx="3" />
                <path d="M3 9h18M8 4v5" />
              </svg>
              Acessar com conta da clínica
            </button>
          </form>
        </div>

        <p class="login-foot">Novo por aqui? <a class="link" href="#">Fale com o suporte</a></p>
      </div>

      <!-- panel -->
      <div class="login-panel">
        <div class="blob blob-1"></div>
        <div class="blob blob-2"></div>
        <div class="ring"></div>
        <svg
          class="paw paw-1"
          width="34"
          height="34"
          viewBox="0 0 24 24"
          fill="rgba(255,255,255,.18)"
        >
          <ellipse cx="6.5" cy="10" rx="2.1" ry="2.7" />
          <ellipse cx="11" cy="7.4" rx="2.2" ry="2.9" />
          <ellipse cx="16" cy="8.6" rx="2.1" ry="2.7" />
          <ellipse cx="19.4" cy="12.6" rx="1.7" ry="2.2" />
          <path
            d="M11.7 11.4c-2.8 0-5.1 2.3-5.1 4.9 0 2 1.7 3.1 3.6 2.6 1-.26 2-.26 3 0 1.9.5 3.6-.6 3.6-2.6 0-2.6-2.3-4.9-5.1-4.9z"
          />
        </svg>

        <div class="panel-eyebrow">Painel parceiro</div>
        <div class="panel-mid">
          <h2 class="panel-title">Cuidado clínico organizado, do agendamento à alta.</h2>
          <p class="panel-text">
            Agenda, prontuários e acompanhamento de risco em um só lugar — para uma rotina mais leve
            e segura.
          </p>

          <ul class="feature-list">
            <li class="feature">
              <span class="feature-check"
                ><svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#fff"
                  stroke-width="3"
                >
                  <path d="m5 12 5 5 9-11" /></svg></span
              >Agenda inteligente por sala e profissional
            </li>
            <li class="feature">
              <span class="feature-check"
                ><svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#fff"
                  stroke-width="3"
                >
                  <path d="m5 12 5 5 9-11" /></svg></span
              >Prontuário completo e histórico clínico
            </li>
            <li class="feature">
              <span class="feature-check"
                ><svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#fff"
                  stroke-width="3"
                >
                  <path d="m5 12 5 5 9-11" /></svg></span
              >Alertas de risco, alergia e retorno
            </li>
          </ul>
        </div>

        <div class="panel-proof">
          <div class="avatar-stack">
            <span class="av" style="background: #b8cdc9">M</span>
            <span class="av" style="background: #cfe0db">R</span>
            <span class="av" style="background: #e6eeec">C</span>
          </div>
          <p>Mais de <b>2.400 atendimentos</b> acompanhados este mês.</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import PawLogo from '../components/PawLogo.vue'

const router = useRouter()
const email = ref('dra.marina@petjourney.vet')
const password = ref('')
const show = ref(false)
const remember = ref(true)

function signIn() {
  router.push('/dashboard')
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg);
  padding: 40px;
}
.login-card {
  display: flex;
  width: 100%;
  max-width: 1100px;
  height: 720px;
  background: #fff;
  border-radius: 22px;
  box-shadow: var(--shadow-card);
  overflow: hidden;
}

/* form side */
.login-form {
  width: 500px;
  flex: none;
  padding: 54px 56px;
  display: flex;
  flex-direction: column;
}
.brand {
  display: flex;
  align-items: center;
  gap: 11px;
}
.brand-name {
  font-size: 19px;
  font-weight: 700;
  letter-spacing: -0.01em;
}
.form-mid {
  margin: auto 0;
  padding: 38px 0;
}
.h1 {
  margin: 0;
  font-size: 30px;
  font-weight: 700;
  letter-spacing: -0.02em;
}
.sub {
  margin: 8px 0 0;
  font-size: 15px;
  line-height: 1.55;
  color: var(--ink-soft);
}

.field {
  margin-top: 22px;
}
.field:first-of-type {
  margin-top: 30px;
}
.field-label {
  font-size: 12.5px;
  font-weight: 600;
  color: #46544f;
}
.field-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.field-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 8px;
  height: 48px;
  padding: 0 14px;
  border: 1.5px solid #e2eae7;
  border-radius: var(--r-ctrl);
  background: var(--surface);
}
.field-row:focus-within {
  border-color: var(--primary);
  background: #fff;
}
.field-row input {
  border: none;
  outline: none;
  background: none;
  width: 100%;
  font-size: 14.5px;
  font-weight: 500;
  color: var(--ink);
}
.eye {
  cursor: pointer;
}
.link {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--primary);
  text-decoration: none;
}

.checkbox-row {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-top: 18px;
  cursor: pointer;
}
.checkbox-box {
  width: 18px;
  height: 18px;
  border-radius: 5px;
  border: 1.5px solid #cbd7d3;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: 0.15s;
}
.checkbox-box.on {
  background: var(--primary);
  border-color: var(--primary);
}
.checkbox-text {
  font-size: 13.5px;
  font-weight: 500;
  color: var(--ink-soft);
}

.submit {
  height: 50px;
  margin-top: 24px;
  font-size: 15px;
}
.divider {
  display: flex;
  align-items: center;
  gap: 14px;
  margin: 22px 0;
}
.divider::before,
.divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--line);
}
.divider span {
  font-size: 12px;
  font-weight: 500;
  color: #9aa8a3;
}

.login-foot {
  margin: 0;
  font-size: 13px;
  color: var(--muted);
}

/* panel side */
.login-panel {
  flex: 1;
  position: relative;
  overflow: hidden;
  padding: 54px 52px;
  display: flex;
  flex-direction: column;
  background: linear-gradient(155deg, #84a59d 0%, #6e9189 58%, #5c7e76 100%);
}
.blob {
  position: absolute;
  border-radius: 50%;
}
.blob-1 {
  width: 420px;
  height: 420px;
  background: rgba(255, 255, 255, 0.08);
  top: -120px;
  right: -90px;
}
.blob-2 {
  width: 300px;
  height: 300px;
  background: rgba(255, 255, 255, 0.06);
  bottom: -110px;
  left: -60px;
}
.ring {
  position: absolute;
  width: 170px;
  height: 170px;
  border-radius: 50%;
  border: 1.5px solid rgba(255, 255, 255, 0.16);
  top: 120px;
  left: 60px;
}
.paw-1 {
  position: absolute;
  top: 88px;
  right: 90px;
  transform: rotate(18deg);
}

.panel-eyebrow {
  position: relative;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.72);
}
.panel-mid {
  position: relative;
  margin-top: auto;
}
.panel-title {
  margin: 0;
  max-width: 420px;
  font-size: 34px;
  line-height: 1.25;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: #fff;
}
.panel-text {
  margin: 14px 0 0;
  max-width: 400px;
  font-size: 15px;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.82);
}
.feature-list {
  list-style: none;
  margin: 30px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 13px;
}
.feature {
  display: flex;
  align-items: center;
  gap: 11px;
  font-size: 14.5px;
  font-weight: 500;
  color: #fff;
}
.feature-check {
  width: 24px;
  height: 24px;
  flex: none;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.18);
  display: flex;
  align-items: center;
  justify-content: center;
}

.panel-proof {
  position: relative;
  margin-top: 34px;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 20px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.18);
}
.panel-proof p {
  margin: 0;
  font-size: 13px;
  line-height: 1.45;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
}
.panel-proof b {
  color: #fff;
}
.avatar-stack {
  display: flex;
}
.av {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 2px solid #6e9189;
  color: #3e5953;
  font-size: 13px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}
.av + .av {
  margin-left: -10px;
}
</style>
