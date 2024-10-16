import algosdk from 'algosdk'
import schema from '../../abi/arc200/index.js'
import schema2 from '../../abi/arc200nomd/index.js'
import { Contract, ContractBase } from '../../lib/arccjs/contract.js'
import { EventQuery, MethodResponse } from '../../lib/arccjs/types.js'
import { oneAddress } from '../../util.js'

const BalanceBoxCost = 28500n
const AllowanceBoxCost = 28100n

/**
 * This class provides methods for interacting with arc200 contract tokens.
 * @class
 */
class arc200 extends ContractBase {
  opts: {
    acc: algosdk.Account
    simulate: boolean
    formatBytes: boolean
    waitForConfirmation: boolean
    logToConsole: boolean
  }
  constructor(
    contractId: bigint | number,
    algodClient: algosdk.Algodv2,
    indexerClient: algosdk.Indexer,
    options?: Partial<{
      acc: algosdk.Account
      simulate: boolean
      formatBytes: boolean
      waitForConfirmation: boolean
      logToConsole: boolean
    }>
  ) {
    const acc = options?.acc ?? {
      addr: algosdk.Address.fromString(oneAddress),
      sk: new Uint8Array(),
    }
    super(
      contractId,
      algodClient,
      indexerClient,
      { ...schema, ...schema2 },
      acc,
      options
    )

    this.opts = {
      acc: options?.acc ?? {
        addr: algosdk.Address.fromString(oneAddress),
        sk: new Uint8Array(),
      },
      simulate: options?.simulate ?? true,
      formatBytes: options?.formatBytes ?? true,
      waitForConfirmation: options?.waitForConfirmation ?? false,
      logToConsole: options?.logToConsole ?? true,
    }
  }

  // Standard
  async arc200_name() {
    return await this.callMethod<string>('arc200_name')
  }

  async arc200_symbol() {
    return await this.callMethod<string>('arc200_symbol')
  }

  async arc200_decimals() {
    return await this.callMethod<bigint>('arc200_decimals')
  }

  async arc200_totalSupply() {
    return await this.callMethod<bigint>('arc200_totalSupply')
  }

  async arc200_balanceOf(owner: string) {
    return await this.callMethod<bigint>('arc200_balanceOf', owner)
  }

  async arc200_allowance(owner: string, spender: string) {
    return await this.callMethod<bigint>('arc200_allowance', owner, spender)
  }

  // Standard with Checks
  async arc200_transfer(to: string, value: bigint) {
    return await safe_arc200_transfer(this, to, value, this.opts)
  }

  async arc200_transferFrom(from: string, to: string, amount: bigint) {
    return await safe_arc200_transferFrom(this, from, to, amount, this.opts)
  }

  async arc200_approve(spender: string, value: bigint) {
    return await safe_arc200_approve(this, spender, value, this.opts)
  }

  // Extensions
  async hasBalance(addr: string) {
    return await safe_hasBalance(this, addr)
  }

  async hasAllowance(owner: string, spender: string) {
    return await safe_hasAllowance(this, owner, spender)
  }

  async touch() {
    return await this.callMethod<void>('touch')
  }

  async state() {
    return await this.callMethod<{
      name: string
      symbol: string
      decimals: bigint
      totalSupply: bigint
      owner: string
      minter: string
      paused: boolean
      frozen: boolean
    }>('state')
  }

  // Nomadex
  async createApplication(manager: string) {
    return await this.callMethod<boolean>('createApplication', manager)
  }

  async updateApplication() {
    return await this.callMethod<void>('updateApplication')
  }

  async setManager(manager: string) {
    return await this.callMethod<boolean>('setManager', manager)
  }

  async initialize(
    name: string,
    symbol: string,
    decimals: number,
    totalSupply: bigint,
    mintTo: string
  ) {
    return await this.callMethod<void>(
      'initialize',
      name,
      symbol,
      decimals,
      totalSupply,
      mintTo
    )
  }

  async deleteApplication() {
    return await this.callMethod<void>('deleteApplication')
  }

  // Events
  async arc200_Transfer(query?: EventQuery) {
    const events = await this.fetchEvents<[string, string, bigint]>(
      'arc200_Transfer',
      query
    )
    return events.map((event) => {
      return {
        txId: event[0],
        round: event[1],
        timestamp: event[2],
        from: event[3],
        to: event[4],
        value: event[5],
      }
    })
  }

  async arc200_Approval(query?: EventQuery) {
    const events = await this.fetchEvents<[string, string, bigint]>(
      'arc200_Approval',
      query
    )
    return events.map((event) => {
      return {
        txId: event[0],
        round: event[1],
        timestamp: event[2],
        owner: event[3],
        spender: event[4],
        value: event[5],
      }
    })
  }

  // Helpers
  async getMetadata(): Promise<
    MethodResponse<{
      name: string
      symbol: string
      totalSupply: bigint
      decimals: bigint
    }>
  > {
    const [name, symbol, totalSupply, decimals] = await Promise.all([
      this.arc200_name(),
      this.arc200_symbol(),
      this.arc200_totalSupply(),
      this.arc200_decimals(),
    ])
    if (
      !name.success ||
      !symbol.success ||
      !totalSupply.success ||
      !decimals.success
    ) {
      return {
        success: false,
        error: 'Failed to get metadata',
      }
    }
    return {
      success: true,
      returnValue: {
        name: name.returnValue,
        symbol: symbol.returnValue,
        totalSupply: totalSupply.returnValue,
        decimals: decimals.returnValue,
      },
    }
  }
}

/**
 * Checks if the given address has a balance in the specified contract.
 *
 * @param ci - The arc200 object.
 * @param addr - The address to check the balance for.
 * @returns A promise that resolves to a MethodResponse object indicating the success of the operation and the balance status.
 */
export const safe_hasBalance = async (ci: arc200, addr: string) => {
  const contract1 = new Contract(
    ci.contractId,
    ci.algodClient,
    ci.indexerClient,
    schema
  )
  const contract2 = new Contract(
    ci.contractId,
    ci.algodClient,
    ci.indexerClient,
    schema2
  )

  const hasBalanceP = await Promise.all([
    contract1.callMethod<boolean>('hasBalance', addr),
    contract2.callMethod<boolean>('hasBalance', addr),
  ])
  const hasBalanceR = hasBalanceP[0].success ? hasBalanceP[0] : hasBalanceP[1]
  if (hasBalanceR.success) {
    return {
      ...hasBalanceR,
      returnValue: !!hasBalanceR.returnValue,
    }
  }
  return hasBalanceR
}

/**
 * Checks if the given address has allowance for the spender.
 *
 * @param ci - The arc200 object.
 * @param addrFrom - The address from which the allowance is checked.
 * @param addrSpender - The address of the spender.
 * @returns A promise that resolves to a MethodResponse object containing a boolean indicating if the allowance exists.
 */
export const safe_hasAllowance = async (
  ci: arc200,
  addrFrom: string,
  addrSpender: string
) => {
  const contract1 = new Contract(
    ci.contractId,
    ci.algodClient,
    ci.indexerClient,
    schema
  )
  const contract2 = new Contract(
    ci.contractId,
    ci.algodClient,
    ci.indexerClient,
    schema2
  )

  const hasAllowanceR2 = await Promise.all([
    contract1.callMethod<boolean>('hasAllowance', addrFrom, addrSpender),
    contract2.callMethod<boolean>('hasAllowance', addrFrom, addrSpender),
  ])
  const hasAllowanceR = hasAllowanceR2[0].success
    ? hasAllowanceR2[0]
    : hasAllowanceR2[1]
  if (hasAllowanceR.success) {
    return {
      ...hasAllowanceR,
      returnValue: !!hasAllowanceR.returnValue,
    }
  }
  return hasAllowanceR
}

/**
 * Transfers a specified amount of ARC200 tokens from the caller's address to the specified address.
 *
 * @param ci - The instance of the arc200 class.
 * @param addrTo - The address to which the tokens will be transferred.
 * @param amt - The amount of tokens to transfer.
 * @param options - The options for the transfer.
 * @returns A promise that resolves to a MethodResponse<boolean> indicating the success of the transfer.
 */
export const safe_arc200_transfer = async (
  ci: arc200,
  addrTo: string,
  amt: bigint,
  options: typeof ci.opts
): Promise<MethodResponse<{ txId: string }>> => {
  try {
    const addrFrom = ci.getSender().toString()

    const contract = new Contract(
      ci.contractId,
      ci.algodClient,
      ci.indexerClient,
      { ...schema, ...schema2 },
      { addr: ci.getSender(), sk: ci.getSk() },
      {
        simulate: options.simulate,
        waitForConfirmation: options.waitForConfirmation,
      }
    )
    const contractReadOnly = new arc200(
      ci.contractId,
      ci.algodClient,
      ci.indexerClient
    )
    const balTo = await contractReadOnly.arc200_balanceOf(addrTo)
    const balFrom = await contractReadOnly.arc200_balanceOf(addrFrom)
    if (!balTo.success || !balFrom.success)
      throw new Error('Failed to get balance or allowance')

    let BoxCost = 0n
    if (balTo.returnValue === 0n) BoxCost += BalanceBoxCost
    if (balFrom.returnValue === 0n) BoxCost += BalanceBoxCost

    if (BoxCost > 0n) contract.setPaymentAmount(BoxCost)

    if (options.logToConsole)
      console.log(`Transfer from: ${addrFrom} to: ${addrTo} amount: ${amt}`)

    return contract.callMethod<{ txId: string }>('arc200_transfer', addrTo, amt)
  } catch (error) {
    console.error(error)
    return { success: false, error }
  }
}

/**
 * Transfers a specified amount of tokens from one address to another.
 *
 * @param ci - The arc200 object.
 * @param addrFrom - The address from which the tokens will be transferred.
 * @param addrTo - The address to which the tokens will be transferred.
 * @param amt - The amount of tokens to transfer.
 * @param options - The options for the transfer.
 * @returns A promise that resolves to a MethodResponse<boolean> indicating the success of the transfer.
 */
export const safe_arc200_transferFrom = async (
  ci: arc200,
  addrFrom: string,
  addrTo: string,
  amt: bigint,
  options: typeof ci.opts
): Promise<MethodResponse<{ txId: string }>> => {
  try {
    const contract = new Contract(
      ci.contractId,
      ci.algodClient,
      ci.indexerClient,
      { ...schema, ...schema2 },
      { addr: ci.getSender(), sk: ci.getSk() },
      {
        simulate: options.simulate,
        waitForConfirmation: options.waitForConfirmation,
      }
    )
    const contractReadOnly = new arc200(
      ci.contractId,
      ci.algodClient,
      ci.indexerClient
    )
    const balTo = await contractReadOnly.arc200_balanceOf(addrTo)
    const balFrom = await contractReadOnly.arc200_balanceOf(addrFrom)
    const allowance = await contractReadOnly.arc200_allowance(addrFrom, addrTo)

    if (!balTo.success || !balFrom.success || !allowance.success)
      throw new Error('Failed to get balance or allowance')
    let BoxCost = 0n
    if (balTo.returnValue === 0n) BoxCost += BalanceBoxCost
    if (balFrom.returnValue === 0n) BoxCost += BalanceBoxCost
    if (allowance.returnValue === 0n) BoxCost += AllowanceBoxCost

    if (BoxCost > 0n) contract.setPaymentAmount(BoxCost)

    const addrSpender = contract.getSender().toString()

    if (options.logToConsole)
      console.log(
        `TransferFrom spender: ${addrSpender} from: ${addrFrom} to: ${addrTo} amount: ${amt}`
      )

    return contract.callMethod<{ txId: string }>(
      'arc200_transferFrom',
      addrFrom,
      addrTo,
      amt
    )
  } catch (error) {
    console.error(error)
    return { success: false, error }
  }
}

/**
 * Approves the spender to spend the specified amount of tokens on behalf of the caller.
 *
 * @param ci - The arc200 instance.
 * @param addrSpender - The address of the spender.
 * @param amt - The amount of tokens to approve.
 * @param options - The options for the approval.
 * @returns A promise that resolves to a MethodResponse indicating the success of the approval.
 */
export const safe_arc200_approve = async (
  ci: arc200,
  addrSpender: string,
  amt: bigint,
  options: typeof ci.opts
): Promise<MethodResponse<{ txId: string }>> => {
  try {
    const contract = new Contract(
      ci.contractId,
      ci.algodClient,
      ci.indexerClient,
      { ...schema, ...schema2 },
      { addr: ci.getSender(), sk: ci.getSk() },
      {
        simulate: options.simulate,
        waitForConfirmation: options.waitForConfirmation,
      }
    )
    const addrFrom = contract.getSender().toString()
    const all = await ci.arc200_allowance(addrFrom, addrSpender)

    const addPayment = !all.success || (all.success && all.returnValue === 0n)
    if (addPayment) contract.setPaymentAmount(AllowanceBoxCost)

    if (options.logToConsole)
      console.log(
        `Approval from: ${addrFrom} spender: ${addrSpender} amount: ${amt}`
      )

    return await contract.callMethod<{ txId: string }>(
      'arc200_approve',
      addrSpender,
      amt
    )
  } catch (error) {
    console.error(error)
    return { success: false, error }
  }
}

export default arc200
