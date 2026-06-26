<template>
  <div class="app">
    <!-- sidebar -->
    <aside class="sidebar">
      <div class="sidebar-brand">
        <PawLogo :size="36" />
        <span class="brand-name">PetJourney</span>
      </div>

      <div class="nav-group-label">Operação</div>
      <nav class="nav">
        <a class="nav-item active">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>Dashboard
        </a>
        <a class="nav-item">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4.5" width="18" height="16" rx="2.5" /><path d="M3 9h18M8 3v3M16 3v3" /></svg>Agenda
        </a>
        <a class="nav-item">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><ellipse cx="6.5" cy="10" rx="1.7" ry="2.2" /><ellipse cx="11" cy="7.8" rx="1.8" ry="2.3" /><ellipse cx="15.5" cy="8.8" rx="1.7" ry="2.2" /><path d="M11.5 11.4c-2.4 0-4.4 1.9-4.4 4.1 0 1.7 1.4 2.6 3 2.2.9-.22 1.8-.22 2.7 0 1.6.4 3-.5 3-2.2 0-2.2-1.9-4.1-4.3-4.1z" /></svg>Pacientes
        </a>
        <a class="nav-item">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></svg>Prontuários
        </a>
        <a class="nav-item">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" /></svg>Atividades
        </a>
        <a class="nav-item">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>Relatórios
        </a>
      </nav>

      <div class="sidebar-foot">
        <div class="plan-card">
          <div class="plan-title">Plano Clínica Pro</div>
          <div class="plan-sub">Faturamento e estoque inclusos.</div>
        </div>
        <a class="nav-item small">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.6 1.6 0 0 0 .32 1.76l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.6 1.6 0 0 0-2.7.65 1.6 1.6 0 0 0-1.66 0 1.6 1.6 0 0 0-2.7-.65l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.6 1.6 0 0 0 4.6 15" /></svg>Configurações
        </a>
        <a class="nav-item small danger" @click="logout">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>Sair
        </a>
      </div>
    </aside>

    <!-- main -->
    <div class="main">
      <header class="topbar">
        <div class="topbar-ctx">
          <div class="ctx-eyebrow">Painel parceiro</div>
          <div class="ctx-title">Operação</div>
        </div>
        <div class="clock">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#84A59D" stroke-width="1.8"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
          <div>
            <div class="clock-time">{{ timeStr }}</div>
            <div class="clock-date">{{ dateStr }}</div>
          </div>
        </div>
        <button class="icon-btn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5C6B66" stroke-width="1.8"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
        </button>
        <button class="icon-btn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5C6B66" stroke-width="1.8"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" /></svg>
          <span class="badge-dot"></span>
        </button>
        <button class="account">
          <span class="account-av">M</span>
          <span class="account-meta">
            <span class="account-name">Dra. Marina</span>
            <span class="account-role">Conta parceiro</span>
          </span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8A9A94" stroke-width="2"><path d="m6 9 6 6 6-6" /></svg>
        </button>
      </header>

      <div class="content">
        <!-- greeting + next -->
        <section class="hero">
          <div class="hero-text">
            <div class="eyebrow">Visão geral</div>
            <h1 class="greet">{{ greeting }}</h1>
            <p class="greet-sub">Rotina clínica, agenda e pendências organizadas para o seu dia. Você tem <b>3 atendimentos</b> nas próximas horas.</p>
            <div class="hero-actions">
              <button class="btn btn-primary">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M12 5v14M5 12h14" /></svg>Novo atendimento
              </button>
              <button class="btn btn-ghost">Buscar paciente</button>
            </div>
          </div>

          <div class="next-card">
            <div class="next-glow"></div>
            <div class="next-head">
              <span class="next-eyebrow">Próximo atendimento</span>
              <span class="next-chip">em 18 min</span>
            </div>
            <div class="next-time">09:30</div>
            <div class="next-pat">
              <span class="next-av">L</span>
              <div>
                <div class="next-name">Luna</div>
                <div class="next-detail">Retorno · Canina · Sala 2</div>
              </div>
            </div>
            <button class="btn next-btn">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#5C7E76" stroke-width="1.9"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /></svg>Abrir prontuário
            </button>
          </div>
        </section>

        <!-- metrics -->
        <section class="metrics">
          <div class="metric" v-for="m in metrics" :key="m.label">
            <div class="metric-head">
              <span class="metric-label">{{ m.label }}</span>
              <span class="metric-icon" :style="{ background: m.iconBg }" v-html="m.icon"></span>
            </div>
            <div class="metric-num">{{ m.value }}</div>
            <div class="metric-sub">{{ m.sub }}</div>
            <span class="pill" :class="m.pill.variant">{{ m.pill.text }}</span>
          </div>
        </section>

        <!-- agenda + risk -->
        <section class="panels">
          <!-- agenda -->
          <div class="panel-card">
            <div class="card-head">
              <div>
                <div class="card-eyebrow">Agenda</div>
                <div class="card-title">Atendimentos de hoje</div>
              </div>
              <button class="btn btn-ghost small">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#84A59D" stroke-width="1.8"><rect x="3" y="4.5" width="18" height="16" rx="2.5" /><path d="M3 9h18M8 3v3M16 3v3" /></svg>Ver calendário
              </button>
            </div>
            <div class="agenda-list">
              <div class="agenda-item" v-for="a in agenda" :key="a.name" :class="a.priority">
                <div class="ag-time">
                  <div class="ag-hour">{{ a.time }}</div>
                  <div class="ag-dur">{{ a.dur }}</div>
                </div>
                <div class="ag-avatar" :class="a.avatar">{{ a.initial }}</div>
                <div class="ag-body">
                  <div class="ag-name">{{ a.name }}</div>
                  <div class="ag-meta">{{ a.meta }}</div>
                  <div class="ag-note">{{ a.note }}</div>
                </div>
                <div class="ag-right">
                  <span class="pill" :class="a.status.variant">{{ a.status.text }}</span>
                  <div class="ag-room">{{ a.room }}</div>
                  <div class="ag-vet">{{ a.vet }}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- risk -->
          <div class="panel-card">
            <div class="card-head">
              <div>
                <div class="card-eyebrow">Risco clínico</div>
                <div class="card-title">Pacientes em atenção</div>
              </div>
            </div>
            <div class="risk-list">
              <div class="risk-item" v-for="r in risks" :key="r.name">
                <div class="risk-head">
                  <span class="risk-av" :class="r.avatar">{{ r.initial }}</span>
                  <div class="risk-id">
                    <div class="risk-name">{{ r.name }}</div>
                    <div class="risk-owner">{{ r.owner }}</div>
                  </div>
                  <span class="pill" :class="r.level.variant">{{ r.level.text }}</span>
                </div>
                <div class="risk-note">{{ r.note }}</div>
                <div class="risk-foot">
                  <span :style="{ color: r.foot.color }">{{ r.foot.text }}</span>
                  <span class="risk-time">{{ r.time }}</span>
                </div>
              </div>
              <button class="btn btn-ghost btn-block">Ver todos os pacientes em atenção</button>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import PawLogo from '../components/PawLogo.vue'

const router = useRouter()
function logout() { router.push('/login') }

/* live clock */
const now = ref(new Date())
let timer
onMounted(() => { timer = setInterval(() => (now.value = new Date()), 1000) })
onUnmounted(() => clearInterval(timer))

const timeStr = computed(() => now.value.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))
const dateStr = computed(() => {
  const d = now.value.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
  return d.charAt(0).toUpperCase() + d.slice(1)
})
const greeting = computed(() => {
  const h = now.value.getHours()
  const g = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
  return `${g}, Dra. Marina`
})

/* data */
const ic = {
  cal: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#84A59D" stroke-width="1.8"><rect x="3" y="4.5" width="18" height="16" rx="2.5"/><path d="M3 9h18M8 3v3M16 3v3"/></svg>',
  check: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#84A59D" stroke-width="1.8"><path d="M20 6 9 17l-5-5"/></svg>',
  alert: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#C99A4E" stroke-width="1.8"><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>',
  heart: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#D98E73" stroke-width="1.8"><path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 12 5 5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7z"/></svg>'
}

const metrics = [
  { label: 'Consultas hoje', value: '8', sub: '3 próximas até 12h', iconBg: '#EEF3F1', icon: ic.cal, pill: { text: '+2 vs. ontem', variant: 'pill-sage' } },
  { label: 'Atendidos', value: '5', sub: '2 prontuários completos', iconBg: '#EEF3F1', icon: ic.check, pill: { text: '62% do dia', variant: 'pill-soft' } },
  { label: 'Pendências', value: '6', sub: '4 exigem revisão clínica', iconBg: '#F7F0E0', icon: ic.alert, pill: { text: '2 urgentes', variant: 'pill-warm' } },
  { label: 'Em atenção', value: '3', sub: 'Risco, alergia ou retorno', iconBg: '#FBEEE8', icon: ic.heart, pill: { text: 'prioridade alta', variant: 'pill-warm' } }
]

const agenda = [
  { time: '09:30', dur: '45 min', initial: 'L', name: 'Luna', meta: 'Canina · Retorno', note: 'Evolução pós-operatória e revisão de curativo.', status: { text: 'Em sala', variant: 'pill-warm' }, room: 'Sala 2', vet: 'Marina Alves', priority: 'is-high', avatar: 'av-warm' },
  { time: '10:15', dur: '30 min', initial: 'T', name: 'Thor', meta: 'Felina · Vacina', note: 'Carteirinha e protocolo anual.', status: { text: 'Confirmado', variant: 'pill-green' }, room: 'Sala 1', vet: 'Rafael Lima', priority: 'is-normal', avatar: 'av-sage' },
  { time: '11:00', dur: '50 min', initial: 'M', name: 'Mel', meta: 'Canina · Consulta', note: 'Queixa dermatológica recorrente.', status: { text: 'Triagem', variant: 'pill-amber' }, room: 'Sala 3', vet: 'Carla Souza', priority: 'is-normal', avatar: 'av-sage' },
  { time: '11:45', dur: '40 min', initial: 'B', name: 'Bob', meta: 'Canina · Exame', note: 'Histórico de alergia antes da prescrição.', status: { text: 'Pendente', variant: 'pill-mute' }, room: 'Sala 1', vet: 'Paulo Mendes', priority: 'is-muted', avatar: 'av-sage' }
]

const risks = [
  { initial: 'L', name: 'Luna', owner: 'Tutora · Marina Alves', level: { text: 'Alto', variant: 'pill-warm' }, note: 'Revisar evolução pós-operatória antes da alta.', foot: { text: 'Retorno crítico', color: '#C5715A' }, time: 'Hoje, 09:30', avatar: 'av-warm' },
  { initial: 'N', name: 'Nina', owner: 'Tutora · Bianca Torres', level: { text: 'Médio', variant: 'pill-amber' }, note: 'Exame laboratorial aguardando conduta.', foot: { text: 'Exame pendente', color: '#B68A3E' }, time: 'Ontem, 17:10', avatar: 'av-amber' },
  { initial: 'B', name: 'Bob', owner: 'Tutor · Paulo Mendes', level: { text: 'Médio', variant: 'pill-amber' }, note: 'Histórico de alergia antes da prescrição.', foot: { text: 'Conferir histórico', color: '#84A59D' }, time: 'Hoje, 11:45', avatar: 'av-amber' }
]
</script>

<style scoped>
.app { display: flex; height: 100vh; background: var(--bg); }

/* sidebar */
.sidebar { width: 256px; flex: none; background: #fff; border-right: 1px solid var(--line); display: flex; flex-direction: column; padding: 22px 16px; }
.sidebar-brand { display: flex; align-items: center; gap: 10px; padding: 6px 8px 22px; }
.brand-name { font-size: 17px; font-weight: 600; letter-spacing: -.01em; }
.nav-group-label { font-size: 11px; font-weight: 600; letter-spacing: .14em; text-transform: uppercase; color: var(--faint); padding: 8px 10px 6px; }
.nav { display: flex; flex-direction: column; gap: 3px; }
.nav-item { display: flex; align-items: center; gap: 11px; padding: 11px 12px; border-radius: 11px; color: var(--ink-soft); font-size: 14px; font-weight: 500; cursor: pointer; text-decoration: none; }
.nav-item svg { color: #7C8A85; }
.nav-item:hover { background: var(--bg); }
.nav-item.active { background: var(--primary-tint); color: #4F756B; font-weight: 600; }
.nav-item.active svg { color: #4F756B; }
.nav-item.small { font-size: 13.5px; padding: 10px 12px; }
.nav-item.danger { color: var(--warm); }
.nav-item.danger svg { color: var(--warm); }
.nav-item.danger:hover { background: var(--warm-bg); }
.sidebar-foot { margin-top: auto; display: flex; flex-direction: column; gap: 3px; }
.plan-card { background: var(--primary-tint); border-radius: var(--r-md); padding: 14px; margin-bottom: 10px; }
.plan-title { font-size: 12.5px; font-weight: 600; color: #4F756B; }
.plan-sub { font-size: 12px; line-height: 1.4; color: #7C8A85; margin-top: 3px; }

/* main */
.main { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.topbar { height: 72px; flex: none; border-bottom: 1px solid var(--line); background: #fff; display: flex; align-items: center; padding: 0 28px; gap: 18px; }
.topbar-ctx { flex: 1; min-width: 0; }
.ctx-eyebrow { font-size: 11px; font-weight: 600; letter-spacing: .12em; text-transform: uppercase; color: var(--faint); }
.ctx-title { font-size: 16px; font-weight: 600; }
.clock { display: flex; align-items: center; gap: 8px; height: 42px; padding: 0 16px; border: 1px solid var(--line); border-radius: 11px; background: var(--surface); }
.clock-time { font-size: 13px; font-weight: 600; line-height: 1.1; }
.clock-date { font-size: 11px; font-weight: 500; color: var(--muted); line-height: 1.1; }
.icon-btn { position: relative; width: 42px; height: 42px; border: 1px solid var(--line); border-radius: 11px; background: var(--surface); display: flex; align-items: center; justify-content: center; cursor: pointer; }
.icon-btn:hover { background: #F0F4F2; }
.badge-dot { position: absolute; top: 9px; right: 10px; width: 7px; height: 7px; border-radius: 50%; background: #D98E73; border: 1.5px solid var(--surface); }
.account { display: flex; align-items: center; gap: 10px; padding: 5px 8px 5px 5px; border: 1px solid var(--line); border-radius: 12px; background: #fff; cursor: pointer; }
.account:hover { background: var(--surface); }
.account-av { width: 34px; height: 34px; border-radius: 9px; background: var(--grad); color: #fff; font-size: 14px; font-weight: 600; display: flex; align-items: center; justify-content: center; }
.account-meta { display: flex; flex-direction: column; line-height: 1.15; text-align: left; }
.account-name { font-size: 13.5px; font-weight: 600; }
.account-role { font-size: 11.5px; font-weight: 500; color: var(--muted); }

/* content */
.content { flex: 1; overflow: auto; padding: 26px 28px; }

.hero { display: flex; gap: 24px; align-items: stretch; }
.hero-text { flex: 1; min-width: 0; }
.greet { margin: 6px 0 0; font-size: 30px; font-weight: 600; letter-spacing: -.02em; }
.greet-sub { margin: 7px 0 0; max-width: 560px; font-size: 15px; line-height: 1.55; color: var(--ink-soft); }
.greet-sub b { color: #4F756B; }
.hero-actions { display: flex; gap: 10px; margin-top: 18px; }
.hero-actions .btn { height: 42px; padding: 0 18px; font-size: 13.5px; }

.next-card { width: 328px; flex: none; border-radius: var(--r-card); background: linear-gradient(150deg, #84A59D, #6E9189 70%, #5C7E76); padding: 22px 24px; color: #fff; position: relative; overflow: hidden; }
.next-glow { position: absolute; width: 180px; height: 180px; border-radius: 50%; background: rgba(255,255,255,.08); top: -70px; right: -50px; }
.next-head { position: relative; display: flex; justify-content: space-between; align-items: center; }
.next-eyebrow { font-size: 11px; font-weight: 600; letter-spacing: .12em; text-transform: uppercase; color: rgba(255,255,255,.8); }
.next-chip { background: rgba(255,255,255,.18); border-radius: 20px; padding: 3px 9px; font-size: 11px; font-weight: 600; }
.next-time { position: relative; font-size: 46px; font-weight: 600; letter-spacing: -.02em; margin-top: 10px; }
.next-pat { position: relative; display: flex; align-items: center; gap: 11px; margin-top: 6px; }
.next-av { width: 38px; height: 38px; border-radius: 11px; background: rgba(255,255,255,.2); display: flex; align-items: center; justify-content: center; font-size: 15px; font-weight: 600; }
.next-name { font-size: 16px; font-weight: 600; }
.next-detail { font-size: 12.5px; font-weight: 500; color: rgba(255,255,255,.82); }
.next-btn { position: relative; width: 100%; height: 44px; margin-top: 18px; background: #fff; color: var(--primary-deep); font-size: 14px; }
.next-btn:hover { filter: brightness(.97); }

/* metrics */
.metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 18px; margin-top: 24px; }
.metric { background: #fff; border: 1px solid var(--line); border-radius: 16px; padding: 20px; }
.metric-head { display: flex; justify-content: space-between; align-items: center; }
.metric-label { font-size: 13px; font-weight: 600; color: var(--ink-soft); }
.metric-icon { width: 34px; height: 34px; border-radius: 10px; display: flex; align-items: center; justify-content: center; }
.metric-num { font-size: 34px; font-weight: 600; letter-spacing: -.02em; margin-top: 10px; }
.metric-sub { font-size: 13px; color: var(--muted); margin-top: 2px; }
.metric .pill { margin-top: 12px; }

/* panels */
.panels { display: grid; grid-template-columns: 1.65fr 1fr; gap: 24px; margin-top: 24px; }
.panel-card { background: #fff; border: 1px solid var(--line); border-radius: var(--r-card); padding: 22px; }
.card-head { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 18px; }
.card-eyebrow { font-size: 11px; font-weight: 600; letter-spacing: .12em; text-transform: uppercase; color: var(--faint); }
.card-title { font-size: 18px; font-weight: 600; margin-top: 3px; }
.btn.small { height: 38px; padding: 0 15px; font-size: 13px; }

/* agenda */
.agenda-list { display: flex; flex-direction: column; gap: 12px; }
.agenda-item { display: flex; gap: 16px; border: 1px solid var(--line); border-radius: var(--r-md); padding: 15px 16px; background: #fff; }
.agenda-item.is-high { border-color: #F1E2DA; background: #FDF8F5; }
.agenda-item.is-muted { border-color: #DDE5E2; }
.ag-time { width: 64px; flex: none; text-align: center; }
.ag-hour { font-size: 16px; font-weight: 600; }
.ag-dur { font-size: 11.5px; font-weight: 500; color: var(--muted); margin-top: 2px; }
.ag-avatar { width: 40px; height: 40px; flex: none; border-radius: 12px; font-size: 16px; font-weight: 600; display: flex; align-items: center; justify-content: center; }
.ag-body { flex: 1; min-width: 0; }
.ag-name { font-size: 15px; font-weight: 600; }
.ag-meta { font-size: 12.5px; font-weight: 500; color: var(--muted); margin-top: 1px; }
.ag-note { font-size: 13px; color: var(--ink-soft); margin-top: 7px; }
.ag-right { text-align: right; flex: none; }
.ag-room { font-size: 12.5px; font-weight: 600; color: #46544F; margin-top: 10px; }
.ag-vet { font-size: 11.5px; font-weight: 500; color: var(--muted); margin-top: 1px; }

/* risk */
.risk-list { display: flex; flex-direction: column; gap: 12px; }
.risk-item { border: 1px solid var(--line); border-radius: var(--r-md); padding: 15px 16px; }
.risk-head { display: flex; align-items: center; gap: 11px; }
.risk-av { width: 38px; height: 38px; flex: none; border-radius: 11px; font-size: 15px; font-weight: 600; display: flex; align-items: center; justify-content: center; }
.risk-id { flex: 1; }
.risk-name { font-size: 14.5px; font-weight: 600; }
.risk-owner { font-size: 12px; font-weight: 500; color: var(--muted); }
.risk-note { font-size: 12.5px; line-height: 1.5; color: var(--ink-soft); margin-top: 11px; }
.risk-foot { display: flex; justify-content: space-between; align-items: center; margin-top: 11px; padding-top: 11px; border-top: 1px solid var(--line-soft); font-size: 12px; font-weight: 600; }
.risk-time { font-size: 11.5px; font-weight: 500; color: var(--muted); }
.risk-list .btn { height: 42px; color: #4F756B; }

/* avatar variants */
.av-sage { background: var(--primary-tint); color: #4F756B; }
.av-warm { background: #F2DDD3; color: var(--warm); }
.av-amber { background: #F7EFDC; color: var(--amber); }

/* extra pill */
.pill-mute { background: #F0EFEC; color: #8A8579; }
</style>
