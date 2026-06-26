<template>
  <main class="min-h-screen bg-slate-950 px-6 py-10 text-white">
    <section class="mx-auto max-w-5xl space-y-6">
      <div class="space-y-3">
        <p class="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">Conta tutor</p>

        <h1 class="text-4xl font-bold tracking-tight sm:text-5xl">Área do tutor</h1>

        <p class="max-w-2xl text-base leading-7 text-slate-300">
          Central para gerenciar dados do tutor, pets vinculados, histórico de atendimentos e
          jornadas dentro da plataforma.
        </p>
      </div>

      <div class="grid gap-4 sm:grid-cols-2">
        <RouterLink
          class="rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-cyan-300/60"
          to="/perfil"
        >
          <h2 class="font-semibold">Perfil do usuário</h2>
          <p class="mt-2 text-sm leading-6 text-slate-400">Dados compartilhados da conta.</p>
        </RouterLink>

        <RouterLink
          class="rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-cyan-300/60"
          to="/settings"
        >
          <h2 class="font-semibold">Configurações</h2>
          <p class="mt-2 text-sm leading-6 text-slate-400">Preferências e segurança da conta.</p>
        </RouterLink>
      </div>
    </section>
  </main>
</template>
