<template>
  <main class="min-h-screen bg-slate-950 px-6 py-10 text-white">
    <section class="mx-auto max-w-4xl space-y-6">
      <div class="space-y-3">
        <p class="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">
          Tela compartilhada
        </p>

        <h1 class="text-4xl font-bold tracking-tight">Settings</h1>

        <p class="max-w-2xl text-base leading-7 text-slate-300">
          Configurações gerais da conta, como preferências, notificações, segurança e privacidade.
        </p>
      </div>

      <div class="grid gap-4 sm:grid-cols-2">
        <article class="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h2 class="font-semibold">Preferências</h2>
          <p class="mt-2 text-sm leading-6 text-slate-400">Idioma, tema e comportamento do app.</p>
        </article>

        <article class="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h2 class="font-semibold">Segurança</h2>
          <p class="mt-2 text-sm leading-6 text-slate-400">Senha, sessões e autenticação.</p>
        </article>
      </div>
    </section>
  </main>
</template>
