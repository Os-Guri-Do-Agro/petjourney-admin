/**
 * Como o acesso temporário chama a espécie do pet.
 *
 * Para um pet `OUTRO`, a API manda em `tipoEspecie` o que o responsável digitou ("furão"), e
 * `especieLabel` continua sendo só o rótulo do enum ("Outro"). Lacuna L4, respondida em
 * 22/10 (card PJ-NZX554): com o tipo digitado, ele vale; sem ele, fica o rótulo de sempre.
 *
 * `tipoEspecie` é opcional porque a API de produção ainda não manda o campo.
 */
export function rotuloDaEspecie(acesso: {
  especie: string
  especieLabel: string
  tipoEspecie?: string | null
}): string {
  const digitado = acesso.tipoEspecie?.trim()

  /* Com inicial maiúscula, como "Cachorro" e "Gato" na linha de baixo: "furão" solto destoava. */
  return acesso.especie === 'OUTRO' && digitado
    ? digitado.charAt(0).toLocaleUpperCase() + digitado.slice(1)
    : acesso.especieLabel
}
