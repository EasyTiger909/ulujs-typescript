import { Address } from 'algosdk'

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

export const aToString = (addr: string | Address) =>
  typeof addr === 'string' ? addr : addr.toString()
