/*
 * zeroAddress is the address of the account that holds 0 ALGOs and
 * cannot send transactions.
 */
export const zeroAddress =
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ'

/*
 * oneAddress is the address of the account that holds more
 * more than 0 ALGOs. This account is used to allow for simulation.
 */
export const oneAddress =
  'G3MSA75OZEJTCCENOJDLDJK7UD7E2K5DNC7FVHCNOV7E3I4DTXTOWDUIFQ'

/**
 * Prepares a string by removing any null characters ('\x00') from the given string.
 *
 * @param str - The string to be prepared.
 * @returns The prepared string with null characters removed.
 */
export const prepareString = (str: string) => {
  const index = str.indexOf('\x00')
  if (index > 0) {
    return str.slice(0, str.indexOf('\x00'))
  } else {
    return str
  }
}

/**
 * Generates an ARC2 prefix based on the provided agent and data format.
 * @param agent - The agent for the ARC2 prefix.
 * @param dataFormat - The data format for the ARC2 prefix. Defaults to 'u'.
 * @returns The generated ARC2 prefix.
 */
export const makeARC2Prefix = (agent: string, dataFormat = 'u') => {
  const dataFormatInput = dataFormat[0]
  let dataFormatEnum
  switch (dataFormatInput) {
    case 'm':
    case 'j':
    case 'b':
    case 'u':
      dataFormatEnum = dataFormatInput
      break
    default:
      dataFormatEnum = 'u'
  }
  return `${agent}:${dataFormatEnum}`
}
