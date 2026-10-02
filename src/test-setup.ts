/**
 * O que o jsdom não tem e a biblioteca de componentes assume.
 *
 * `ResizeObserver` é API de navegador que o jsdom não implementa. Nenhum teste precisava dela até
 * o diálogo de alta usar um `Textarea` com `auto-resize` — que a mede no `mounted` e derruba a
 * montagem inteira com `ResizeObserver is not defined`, um erro que não tem relação nenhuma com o
 * que o teste está afirmando.
 *
 * O dublê não observa nada, e é isso mesmo: em teste de jsdom não há layout para observar, e o
 * que se quer provar é o comportamento do formulário, não a altura do campo. Deixar o
 * comportamento real exigiria um navegador de verdade — que é outro tipo de teste.
 */

if (!('ResizeObserver' in globalThis)) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
}

/**
 * `matchMedia` cai na mesma categoria, e chegou pelo mesmo caminho.
 *
 * O `Select` do PrimeVue consulta a orientação da tela ao montar, para decidir se abre a lista
 * como overlay ou em tela cheia. No jsdom não há tela, a função não existe e a montagem inteira
 * morre com `matchMedia is not a function` — um erro sobre viewport num teste que está afirmando
 * regra de cadastro.
 *
 * O dublê responde "não casa" e não notifica ninguém: sem layout, não há mudança de orientação
 * para ouvir.
 *
 * A guarda testa `typeof`, e não `in`: o jsdom **declara** `matchMedia` e a deixa `undefined`, de
 * modo que `'matchMedia' in globalThis` é verdadeiro e o dublê nunca seria instalado.
 */
/**
 * O registro global de gráficos do ApexCharts.
 *
 * Mesma categoria dos dois dublês acima, por um caminho um pouco mais torto. O Apex mantém a
 * lista de instâncias vivas em `window.Apex._chartInstances`, e só a **cria** dentro do
 * `render()`, depois de conferir que o elemento existe no documento. Em jsdom, `mount()` monta
 * fora do documento: a conferência falha, a lista nunca nasce — e a primeira reatividade que
 * chegar ao gráfico chama `updateOptions`, que percorre essa lista para sincronizar gráficos
 * agrupados e morre com `Cannot read properties of undefined (reading 'filter')`.
 *
 * O erro não tem relação com o que o teste afirma: ele vem de um recurso — gráficos em grupo —
 * que nenhuma tela do módulo usa. A lista vazia é a resposta correta para "quais gráficos estão
 * sincronizados com este": nenhum.
 */
if (typeof window !== 'undefined') {
  const apex = ((window as { Apex?: Record<string, unknown> }).Apex ??= {})

  apex._chartInstances ??= []
}

if (typeof globalThis.matchMedia !== 'function') {
  globalThis.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
  })) as unknown as typeof matchMedia
}
