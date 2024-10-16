import algosdk from 'algosdk'
import schema from '../../abi/arc72/index.js'
import { Contract, ContractBase } from '../../lib/arccjs/contract.js'
import { EventQuery, MethodResponse } from '../../lib/arccjs/types.js'
import { oneAddress, prepareString } from '../../util.js'

const BalanceBoxCost = 28500n
const AllowanceBoxCost = 28500n

/**
 * This class provides methods for interacting with arc72 contract NFTs.
 * @class
 */
class arc72 extends ContractBase {
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
    super(contractId, algodClient, indexerClient, schema, acc, options)

    this.opts = {
      acc: options?.acc ?? {
        addr: algosdk.Address.fromString(oneAddress),
        sk: new Uint8Array(),
      },
      simulate: options?.simulate ?? true,
      formatBytes: options?.formatBytes ?? true,
      waitForConfirmation: options?.waitForConfirmation ?? true,
      logToConsole: options?.logToConsole ?? true,
    }
  }

  // Standard
  async arc72_balanceOf(addr: string): Promise<MethodResponse<bigint>> {
    return await this.callMethod<bigint>('arc72_balanceOf', addr)
  }

  async arc72_getApproved(tokenId: bigint) {
    return await this.callMethod<string>('arc72_getApproved', tokenId)
  }

  async arc72_isApprovedForAll(addr: string, spender: string) {
    return await this.callMethod<bigint>(
      'arc72_isApprovedForAll',
      addr,
      spender
    )
  }

  async arc72_ownerOf(tokenId: bigint) {
    return await this.callMethod<string>('arc72_ownerOf', tokenId)
  }

  async arc72_tokenByIndex(index: bigint) {
    return await this.callMethod<bigint>('arc72_tokenByIndex', index)
  }

  async arc72_totalSupply() {
    return await this.callMethod<bigint>('arc72_totalSupply')
  }

  async arc72_tokenURI(tokenId: bigint) {
    const res = await this.callMethod<string>('arc72_tokenURI', tokenId)
    if (!res.success) return res
    return {
      ...res,
      returnValue: this.options.formatBytes
        ? prepareString(res.returnValue)
        : res.returnValue,
    }
  }
  async supportsInterface(interfaceId: string) {
    return await this.callMethod<boolean>('supportsInterface', interfaceId)
  }

  async arc72_approve(addr: string, tokenId: bigint) {
    return safe_arc72_approve(this, addr, tokenId, this.opts)
  }

  async arc72_setApprovalForAll(spender: string, approve: boolean) {
    return safe_arc72_setApprovalForAll(this, spender, approve, this.opts)
  }

  async arc72_transferFrom(from: string, to: string, tokenId: bigint) {
    return safe_arc72_transferFrom(this, from, to, tokenId, this.opts)
  }

  // Events
  async arc72_Approval(query?: EventQuery) {
    return await this.fetchEvents<[string, string, bigint]>(
      'arc72_Approval',
      query
    )
  }

  async arc72_ApprovalForAll(query?: EventQuery) {
    return await this.fetchEvents<[string, string, boolean]>(
      'arc72_ApprovalForAll',
      query
    )
  }

  async arc72_Transfer(query?: EventQuery) {
    return await this.fetchEvents<[string, string, bigint]>(
      'arc72_Transfer',
      query
    )
  }
}

/**
 * Transfers tokens from one address to another using the ARC72 contract.
 *
 * @param ci - The ARC72 contract instance.
 * @param addrFrom - The address from which the tokens will be transferred.
 * @param addrTo - The address to which the tokens will be transferred.
 * @param tid - The token ID.
 * @param options - Additional options for the transfer.
 * @returns A promise that resolves to a MethodResponse<boolean> indicating the success of the transfer.
 */
// TODO - add conditional payment of box cost if ctcAddr balance - minBalance < box cost,
//        where box cost is 28500
export const safe_arc72_transferFrom = async (
  ci: arc72,
  addrFrom: string,
  addrTo: string,
  tid: bigint,
  options: typeof ci.opts
): Promise<MethodResponse<{ txId: string }>> => {
  try {
    const addrSpender = ci.getSender().toString()
    const contract = new Contract(
      ci.contractId,
      ci.algodClient,
      ci.indexerClient,
      schema,
      { addr: ci.getSender(), sk: ci.getSk() },
      {
        simulate: options.simulate,
        formatBytes: options.formatBytes,
        waitForConfirmation: options.waitForConfirmation,
      }
    )
    // Aust arc72 pays for the box cost if the ctcAddr balance - minBalance < box cost
    // Add payment if necessary
    const accInfo = await ci.algodClient
      .accountInformation(algosdk.getApplicationAddress(ci.contractId))
      .do()
    const availableBalance = accInfo.amount - accInfo.minBalance
    if (availableBalance < BalanceBoxCost) {
      contract.setPaymentAmount(BalanceBoxCost - availableBalance)
    }
    if (options.logToConsole)
      console.log(
        `TransferFrom spender: ${addrSpender} from: ${addrFrom} to: ${addrTo} token: ${tid}`
      )

    return await contract.callMethod<{ txId: string }>(
      'arc72_transferFrom',
      addrFrom,
      addrTo,
      tid
    )
  } catch (error) {
    console.log(error)
    return { success: false, error }
  }
}

/**
 * Approves the ARC72 transaction.
 *
 * @param ci - The ARC72 object.
 * @param addr - The address to approve.
 * @param tid - The token ID to approve.
 * @param options - The ARC72 options.
 * @returns A promise that resolves to a MethodResponse<boolean> indicating the success of the approval.
 */
// TODO - check if nft exits before attempting to improve
export const safe_arc72_approve = async (
  ci: arc72,
  addr: string,
  tid: bigint,
  options: typeof ci.opts
): Promise<MethodResponse<{ txId: string }>> => {
  try {
    const addrSelf = ci.getSender().toString()
    const contract = new Contract(
      ci.contractId,
      ci.algodClient,
      ci.indexerClient,
      schema,
      { addr: ci.getSender(), sk: ci.getSk() },
      {
        simulate: options.simulate,
        formatBytes: options.formatBytes,
        waitForConfirmation: options.waitForConfirmation,
      }
    )
    if (options.logToConsole)
      console.log(
        `Approval from: ${addrSelf} controller: ${addr} token: ${tid}`
      )

    return await contract.callMethod<{ txId: string }>(
      'arc72_approve',
      addr,
      tid
    )
  } catch (error) {
    console.log(error)
    return { success: false, error }
  }
}

/**
 * Sets the approval status for a specific address to operate on behalf of the caller.
 *
 * @param ci - The arc72 instance.
 * @param addr - The address to set the approval for.
 * @param approve - The approval status to set.
 * @param options - The options for the method.
 * @returns A promise that resolves to a MethodResponse<boolean> indicating the success of the operation.
 */
export const safe_arc72_setApprovalForAll = async (
  ci: arc72,
  addr: string,
  approve: boolean,
  options: typeof ci.opts
): Promise<MethodResponse<{ txId: string }>> => {
  try {
    const addrSelf = ci.getSender().toString()
    const contract = new Contract(
      ci.contractId,
      ci.algodClient,
      ci.indexerClient,
      schema,
      { addr: ci.getSender(), sk: ci.getSk() },
      {
        simulate: options.simulate,
        formatBytes: options.formatBytes,
        waitForConfirmation: options.waitForConfirmation,
      }
    )

    const all = await ci.arc72_isApprovedForAll(addrSelf, addr)
    const addPayment = !all.success || (all.success && all.returnValue === 0n)
    if (addPayment) contract.setPaymentAmount(AllowanceBoxCost)

    console.log(
      `Approval from: ${addrSelf} controller: ${addr} approve: ${approve}`
    )

    return contract.callMethod<{ txId: string }>(
      'arc72_setApprovalForAll',
      addr,
      approve
    )
  } catch (error) {
    console.log(error)
    return { success: false, error }
  }
}

export default arc72
