<template>
  <main class="min-h-screen bg-[#FAF9F6] px-6 py-10 text-[#1D3557]">
    <section class="mx-auto flex max-w-5xl flex-col gap-8">
      <span class="text-sm font-semibold uppercase tracking-[0.3em] text-[#84A59D]">
        PetJourney Admin
      </span>

      <div class="space-y-4">
        <h1 class="max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
          Admin veterinário para rotina clínica.
        </h1>

        <p class="max-w-2xl text-base leading-7 text-[#5B6B8C]">
          O ciclo inicial foca em agenda, pacientes, prontuário e pendências do veterinário. Fluxos
          completos de tutor ficam fora desta primeira etapa do admin.
        </p>
      </div>

      <div class="grid gap-4">
        <RouterLink
          class="rounded-3xl border border-[#B8CDC9]/70 bg-white p-6 transition hover:-translate-y-0.5 hover:border-[#84A59D]"
          to="/veterinario"
        >
          <p class="text-sm font-semibold uppercase tracking-[0.2em] text-[#84A59D]">Dashboard</p>
          <h2 class="mt-3 text-2xl font-bold">Veterinário</h2>
          <p class="mt-2 text-sm leading-6 text-[#5B6B8C]">
            Acesse a visão do dia, próximos atendimentos, pacientes em atenção e tarefas clínicas.
          </p>
        </RouterLink>
      </div>

      <div class="flex flex-wrap gap-3">
        <RouterLink
          class="rounded-full bg-[#84A59D] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#5B6B8C]"
          to="/auth/login"
        >
          Login
        </RouterLink>
        <RouterLink
          class="rounded-full border border-[#B8CDC9] bg-white px-4 py-2 text-sm font-bold text-[#1D3557] transition hover:border-[#84A59D]"
          to="/auth/register"
        >
          Criar conta
        </RouterLink>
        <RouterLink
          class="rounded-full border border-[#B8CDC9] bg-white px-4 py-2 text-sm font-bold text-[#1D3557] transition hover:border-[#84A59D]"
          to="/perfil"
        >
          Perfil
        </RouterLink>
        <RouterLink
          class="rounded-full border border-[#B8CDC9] bg-white px-4 py-2 text-sm font-bold text-[#1D3557] transition hover:border-[#84A59D]"
          to="/settings"
        >
          Settings
        </RouterLink>
      </div>
    </section>
  </main>
</template>
