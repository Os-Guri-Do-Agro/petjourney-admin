<template>
  <main class="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
    <section class="max-w-xl space-y-4 text-center">
      <p class="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">404</p>

      <h1 class="text-3xl font-bold tracking-tight sm:text-4xl">Página não encontrada</h1>

      <p class="text-base leading-7 text-slate-300">
        A rota acessada não existe. Volte para o início ou crie uma nova página em
        <code>src/pages</code>.
      </p>

      <RouterLink
        class="inline-flex rounded-full bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
        to="/"
      >
        Voltar para o início
      </RouterLink>
    </section>
  </main>
</template>
