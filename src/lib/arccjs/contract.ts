import algosdk from 'algosdk'
import { Buffer } from 'buffer'
import { fetchEvents } from './events.js'
import { EventQuery, MethodResponse } from './types.js'
import { makeARC2Prefix, oneAddress, prepareString } from './util.js'
import { version } from './version.js'

// TODO allow switching between mainnet and testnet
const ctcInfoBc200 = 376092 // safe200 Voimain
const selNop = '58759fa2' // nop()void"

export abstract class ContractBase {
  contractId: bigint
  algodClient: algosdk.Algodv2
  indexerClient: algosdk.Indexer
  private spec: algosdk.ABIContractParams
  private contractABI: algosdk.ABIContract
  private sk: Uint8Array
  private paymentAmount: bigint
  private transfers: [bigint, string][]
  private assetTransfers: [bigint, bigint][]
  private accounts: algosdk.Address[]
  private fee: number
  private sender: algosdk.Address
  private extraTxns: algosdk.Transaction[]
  private enableGroupResourceSharing: boolean
  private beaconId: number
  private beaconSel: string
  private optIns: bigint[]
  private onComplete: algosdk.OnApplicationComplete
  private agentName: string
  private step: number
  options: {
    simulate: boolean
    waitForConfirmation: boolean
    formatBytes: boolean
    objectOnly: boolean
    logToConsole: boolean
  }

  constructor(
    contractId: bigint | number,
    algodClient: algosdk.Algodv2,
    indexerClient: algosdk.Indexer,
    spec: algosdk.ABIContractParams,
    acc?: algosdk.Account,
    options?: {
      simulate?: boolean
      waitForConfirmation?: boolean
      formatBytes?: boolean
      objectOnly?: boolean
      logToConsole?: boolean
    }
  ) {
    this.contractId = BigInt(contractId)
    this.algodClient = algodClient
    this.indexerClient = indexerClient
    this.spec = spec
    this.contractABI = new algosdk.ABIContract(spec)
    this.sk = acc?.sk ?? new Uint8Array()
    this.paymentAmount = 0n
    this.transfers = []
    this.assetTransfers = []
    this.accounts = []
    this.fee = 1000
    this.sender = acc?.addr ?? algosdk.Address.fromString(oneAddress)
    this.extraTxns = []
    this.enableGroupResourceSharing = false
    this.beaconId = ctcInfoBc200
    this.beaconSel = selNop
    this.optIns = []
    this.onComplete = algosdk.OnApplicationComplete.NoOpOC
    this.agentName = `arccjs-v${version}`
    this.step = 2
    this.options = {
      simulate: options?.simulate ?? true,
      waitForConfirmation: options?.waitForConfirmation ?? false,
      formatBytes: options?.formatBytes ?? true,
      objectOnly: options?.objectOnly ?? false,
      logToConsole: options?.logToConsole ?? true,
    }
  }

  getOptIns() {
    return this.optIns
  }

  getBeaconId() {
    return this.beaconId
  }

  getBeaconSelector() {
    return this.beaconSel
  }

  getEnableGroupResourceSharing() {
    return this.enableGroupResourceSharing
  }

  getExtraTxns() {
    return this.extraTxns
  }

  getSender() {
    return this.sender
  }

  getSk() {
    return this.sk
  }

  getSimulate() {
    return this.options.simulate
  }

  getOnComplete() {
    return this.onComplete
  }

  getAgentName() {
    return this.agentName
  }

  getStep() {
    return this.step
  }

  setStep(step: number) {
    this.step = step
  }

  setAgentName(agentName: string) {
    this.agentName = agentName
  }

  setOnComplete(onComplete: algosdk.OnApplicationComplete) {
    if (
      [
        algosdk.OnApplicationComplete.NoOpOC,
        algosdk.OnApplicationComplete.DeleteApplicationOC,
      ].includes(onComplete)
    ) {
      this.onComplete = onComplete
    }
  }

  setOptins(optIns: bigint[]) {
    this.optIns = optIns
  }

  setBeaconSelector(beaconSel: string) {
    this.beaconSel = beaconSel
  }

  setEnableGroupResourceSharing(enableGroupResourceSharing: boolean) {
    this.enableGroupResourceSharing = enableGroupResourceSharing
  }

  setExtraTxns(extraTxns: algosdk.Transaction[]) {
    this.extraTxns = extraTxns
  }

  setAccounts(accounts: algosdk.Address[]) {
    this.accounts = accounts
  }

  setTransfers(transfers: [bigint, string][]) {
    this.transfers = transfers
  }

  setAssetTransfers(assetTransfers: [bigint, bigint][]) {
    this.assetTransfers = assetTransfers
  }

  setPaymentAmount(amount: bigint) {
    this.paymentAmount = amount
  }

  setSimulate(simulate: boolean) {
    this.options.simulate = simulate
  }

  setFee(fee: number) {
    this.fee = fee
  }

  setBeaconId(beaconId: number) {
    this.beaconId = beaconId
  }

  getAccounts() {
    return this.accounts
  }

  async callMethod<T>(
    methodName: string,
    ...args: algosdk.ABIValue[]
  ): Promise<MethodResponse<T>> {
    const methodSpec = this.spec.methods.find((x) => x.name === methodName)
    if (!methodSpec) return { success: false, error: 'Method not found' }

    const abiMethod = this.contractABI.getMethodByName(methodSpec.name)
    if (methodSpec.readonly) {
      const sim = await this.createAndSimulateTxn(abiMethod, args)
      if (sim) {
        return { success: true, returnValue: sim.handledResponse as T }
      } else {
        return {
          success: false,
          error: 'Failed to simulate for readonly method',
        }
      }
    }

    if (this.options.objectOnly)
      return {
        success: true,
        returnValue: this.createAppCallTxnObject(abiMethod, args),
      }

    if (this.options.simulate) {
      const sim = await this.createAndSimulateTxn(abiMethod, args)
      const uTxns = await this.createUtxns(abiMethod, args)
      if (sim) {
        return {
          success: true,
          returnValue: { response: sim.response, txns: uTxns ?? [] } as T,
        }
      } else {
        return {
          success: false,
          error: 'Failed to create transactions',
        }
      }
    }

    const res = await this.createAndSendTxn(abiMethod, args)
    if (res.success && this.options.waitForConfirmation) {
      const status = await this.algodClient.status().do()
      let lastRound = status.lastRound
      while (true) {
        const pendingInfo = await this.algodClient
          .pendingTransactionInformation(res.returnValue.txId)
          .do()
        if (pendingInfo.confirmedRound && pendingInfo.confirmedRound > 0) {
          console.log(
            'Transaction confirmed in round',
            pendingInfo.confirmedRound
          )
          break
        }
        lastRound++
        await this.algodClient.statusAfterBlock(lastRound).do()
      }
    }
    return res as MethodResponse<T>
  }

  async fetchEvents<T extends unknown[]>(
    eventName: string,
    query?: EventQuery
  ): Promise<[string, bigint, number, ...T][]> {
    if (this.spec.events) {
      return (
        (
          await fetchEvents<T>(
            this.indexerClient,
            this.contractId,
            this.spec.events,
            [eventName],
            query
          )
        )[eventName].events ?? []
      )
    } else return []
  }

  async fetchEventsAll<T extends unknown[]>(
    query?: EventQuery
  ): Promise<
    Record<
      string,
      {
        name: string
        signature: string
        selector: string
        events: [string, bigint, number, ...T][]
      }
    >
  > {
    if (this.spec.events) {
      return await fetchEvents(
        this.indexerClient,
        this.contractId,
        this.spec.events,
        this.spec.events.map((x) => x.name),
        query
      )
    } else return {}
  }

  async createAndSendTxn(
    abiMethod: algosdk.ABIMethod,
    args: algosdk.ABIValue[]
  ): Promise<
    MethodResponse<{
      txId: string
      response: algosdk.modelsv2.PostTransactionsResponse
    }>
  > {
    try {
      // logic to create and send a real transaction using simulationResult
      const utxns = await this.createUtxns(abiMethod, args)
      const stxns = this.signTxns(utxns ?? [], this.sk)
      const res = await this.algodClient.sendRawTransaction(stxns).do()
      return { success: true, returnValue: { txId: res.txid, response: res } }
    } catch (error) {
      console.error('Error in createAndSendTxn:', error)
      //throw error; // Re-throw the error after logging it
      return { success: false, error }
    }
  }

  signTxns(utxnsB64: string[], sk: Uint8Array): Uint8Array[] {
    const txns = utxnsB64.map((utxn) =>
      algosdk.decodeUnsignedTransaction(Buffer.from(utxn, 'base64'))
    )
    const stxns = txns.map((txn) => txn.signTxn(sk))
    return stxns
  }

  async createAndSimulateTxn(
    abiMethod: algosdk.ABIMethod,
    args: algosdk.ABIValue[]
  ) {
    try {
      const response = await this.simulateTxn(abiMethod, args)
      const handledResponse = this.decodeSimulationResponse(response, abiMethod)

      return {
        response,
        handledResponse:
          typeof handledResponse === 'string'
            ? prepareString(handledResponse)
            : handledResponse,
      }
    } catch (error) {
      console.error('Error in createAndSimulateTxn:', error)
      //throw error; // Re-throw the error after logging it
    }
  }

  createAppCallTxnObject<T>(
    abiMethod: algosdk.ABIMethod,
    args: algosdk.ABIValue[]
  ): T {
    const appArgs = args.map((arg, index) => {
      return algosdk.ABIType.from(abiMethod.args[index].type as string).encode(
        arg
      )
    })
    return {
      from: this.sender,
      appIndex: this.contractId,
      appArgs: [abiMethod.getSelector(), ...appArgs],
    } as T
  }

  async createUtxns(abiMethod: algosdk.ABIMethod, args: algosdk.ABIValue[]) {
    try {
      const sRes = await this.simulateTxn(abiMethod, args)

      if (!sRes) return

      // Get the suggested transaction parameters
      const params = await this.algodClient.getTransactionParams().do()

      // Encode arguments
      const encodedArgs = args.map((arg, index) => {
        return algosdk.ABIType.from(
          abiMethod.args[index].type as string
        ).encode(arg)
      })

      const txns: algosdk.Transaction[] = []

      // build group resource sharing txns in case of extra txns (only boxes)
      let grsOffset = 0
      if (this.enableGroupResourceSharing && this.extraTxns.length > 0) {
        const ura = {
          accounts: [],
          appLocals: [],
          apps: [],
          assetHoldings: [],
          assets: [],
          boxes: [],
          extraBoxRefs: [],
        }
        const gurs = sRes.txnGroups[0]?.unnamedResourcesAccessed ?? ura

        const accounts = gurs?.accounts || []

        const accountS = new Set(accounts)
        for (const account of this.getAccounts()) {
          accountS.add(account)
        }

        const apps = gurs?.apps || []
        const appS = new Set(apps)

        const assets = gurs?.assets || []
        const assetS = new Set(assets)
        const assetHoldings = gurs?.assetHoldings || []
        for (const assetHolding of assetHoldings) {
          const { asset } = assetHolding
          assetS.add(asset)
        }

        const boxes = gurs?.boxes || []
        const boxApps = boxes.map((x) => x.app)
        const boxNames = new Map<bigint, Uint8Array[]>()
        for (const box of boxes) {
          if (!boxNames.has(box.app)) {
            boxNames.set(box.app, [])
          }
          boxNames.get(box.app)?.push(box.name)
        }
        grsOffset += boxApps.length

        const appLocals = gurs?.appLocals || []
        const appLocalGroups = []
        const appLocalStep = 4
        for (let i = 0; i < appLocals.length; i += appLocalStep) {
          appLocalGroups.push(appLocals.slice(i, i + appLocalStep))
        }
        for (const appLocalGroup of appLocalGroups) {
          const appS = new Set<bigint>()
          const accountS = new Set<algosdk.Address>()
          for (const appLocal of appLocalGroup) {
            const { app, account } = appLocal
            appS.add(app)
            accountS.add(account)
          }
          const apps = Array.from(appS)
          const accounts = Array.from(accountS)
          const txn = algosdk.makeApplicationCallTxnFromObject({
            suggestedParams: {
              ...params,
              flatFee: true,
              fee: 1000,
            },
            sender: this.sender,
            appIndex: this.beaconId,
            appArgs: [new Uint8Array(Buffer.from(this.beaconSel, 'hex'))],
            accounts: accounts,
            foreignApps: apps,
            foreignAssets: [],
            boxes: [],
            onComplete: this.onComplete,
            note: this.makeUNote(
              `${abiMethod.name} Group resource sharing transaction. AppLocals: ${appLocalGroup.length}`
            ),
          })
          txns.push(txn)
        }

        const accountsGroups = []
        for (let i = 0; i < accounts.length; i += 4) {
          accountsGroups.push(accounts.slice(i, i + 4))
        }
        for (const accountsGroup of accountsGroups) {
          const foreignApps = Array.from(appS)
          const foreignAssets = Array.from(assetS)
          const txn = algosdk.makeApplicationCallTxnFromObject({
            suggestedParams: {
              ...params,
              flatFee: true,
              fee: 1000,
            },
            sender: this.sender,
            appIndex: this.beaconId,
            appArgs: [new Uint8Array(Buffer.from(this.beaconSel, 'hex'))],
            accounts: accountsGroup,
            foreignApps,
            foreignAssets: Array.from(assetS),
            boxes: [],
            onComplete: this.onComplete,
            note: this.makeUNote(
              `${abiMethod.name} Group resource sharing transaction. Accounts: ${accountsGroup.length} Assets: ${foreignAssets.length} Apps: ${foreignApps.length}`
            ),
          })
          txns.push(txn)
        }

        for (const app of boxNames.keys()) {
          // split box names into groups
          const boxNamesGroups = []
          for (let i = 0; i < boxNames.get(app)!.length; i += 7) {
            boxNamesGroups.push(boxNames.get(app)!.slice(i, i + 7))
          }
          for (const boxNamesGroup of boxNamesGroups) {
            const txn = algosdk.makeApplicationCallTxnFromObject({
              suggestedParams: {
                ...params,
                flatFee: true,
                fee: 1000,
              },
              sender: this.sender,
              appIndex: this.beaconId,
              appArgs: [new Uint8Array(Buffer.from(this.beaconSel, 'hex'))],
              accounts: [],
              foreignApps: [app],
              foreignAssets: [],
              boxes: boxNamesGroup.map((x) => ({ appIndex: app, name: x })),
              onComplete: this.onComplete,
              note: this.makeUNote(
                `${abiMethod.name} Group resource sharing transaction. Boxes: ${boxNamesGroup.length} Apps: 1 (${app})`
              ),
            })
            txns.push(txn)
          }
        }
      }

      this.assetTransfers.forEach(([amount, token]) => {
        const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          suggestedParams: {
            ...params,
            flatFee: true,
            fee: 1000,
          },
          sender: this.sender,
          receiver: algosdk.getApplicationAddress(this.contractId),
          amount,
          assetIndex: token,
        })
        txns.push(txn)
      })

      this.transfers.forEach(([amount, addr]) => {
        const txn0 = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
          suggestedParams: {
            ...params,
            flatFee: true,
            fee: 1000,
          },
          sender: this.sender,
          receiver: addr,
          amount,
          note: this.makeUNote(
            `${abiMethod.name} Payment of ${(
              Number(amount) / 1e6
            ).toLocaleString()} from ${this.sender.toString()} to ${addr}`
          ),
        })
        txns.push(txn0)
      })

      if (this.paymentAmount > 0) {
        const txn1 = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
          sender: this.sender,
          receiver: algosdk.getApplicationAddress(this.contractId),
          amount: this.paymentAmount,
          suggestedParams: {
            ...params,
            flatFee: true,
            fee: 1000,
          },
          note: this.makeUNote(`${abiMethod.name} Payment to application`),
        })
        txns.push(txn1)
      }

      // transaction assets
      const appCallTxns: Array<
        algosdk.ApplicationCallTransactionParams &
          algosdk.CommonTransactionParams
      > = []

      // Create the application call transaction object
      if (abiMethod.name !== 'custom') {
        appCallTxns.push({
          suggestedParams: {
            ...params,
            flatFee: true,
            fee: this.fee,
          },
          sender: this.sender,
          appIndex: this.contractId,
          appArgs: [abiMethod.getSelector(), ...encodedArgs], // Adjust appArgs based on methodSpec and args
          note: this.makeUNote(`${abiMethod.name} transaction`),
          onComplete: algosdk.OnApplicationComplete.NoOpOC,
        })
      }

      if (this.extraTxns.length > 0) {
        this.extraTxns.forEach((txn) => {
          const customNote = !txn.note
            ? `extra transaction`
            : new TextDecoder().decode(txn.note)

          // conditionals added due to insufficient type narrowing available from the sdk (for now)
          let srcTxn =
            'approvalProgram' in txn && 'clearProgram' in txn
              ? algosdk.makeApplicationCreateTxnFromObject({
                  ...txn,
                  suggestedParams: {
                    ...params,
                    flatFee: true,
                    fee: txn.fee || this.fee,
                  },
                  onComplete: this.getOnComplete(),
                  note: this.makeUNote(`${abiMethod.name} ${customNote}`),
                  approvalProgram: txn.approvalProgram as Uint8Array,
                  clearProgram: txn.clearProgram as Uint8Array,
                })
              : undefined
          if ('appIndex' in txn)
            srcTxn = algosdk.makeApplicationCallTxnFromObject({
              ...txn,
              suggestedParams: {
                ...params,
                flatFee: true,
                fee: txn.fee || this.fee,
              },
              onComplete: this.getOnComplete(),
              note: this.makeUNote(`${abiMethod.name} ${customNote}`),
              sender: this.sender,
              appIndex: txn.appIndex as bigint,
            })
          if (
            'xaid' in txn &&
            'snd' in txn &&
            'arcv' in txn &&
            txn.snd === txn.arcv
          ) {
            txns.push(
              algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
                suggestedParams: {
                  ...params,
                  flatFee: true,
                  fee: 1000,
                },
                sender: txn.snd as string,
                receiver: txn.arcv as string,
                amount: 0,
                assetIndex: txn.xaid as bigint,
                note: this.makeUNote(
                  `${abiMethod.name} Asset optin for following transaction`
                ),
              })
            )
          }
          if (txn.payment && 'appIndex' in txn) {
            txns.push(
              algosdk.makePaymentTxnWithSuggestedParamsFromObject({
                suggestedParams: {
                  ...params,
                  flatFee: true,
                  fee: 1000,
                },
                sender: this.sender,
                receiver: algosdk.getApplicationAddress(txn.appIndex as bigint),
                amount: txn.payment.amount,
                note:
                  txn.note ||
                  this.makeUNote(`${abiMethod.name} Payment to application`),
              })
            )
          }
          if ('xaid' in txn && 'aamt' in txn && 'appIndex' in txn) {
            txns.push(
              algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
                suggestedParams: {
                  ...params,
                  flatFee: true,
                  fee: 1000,
                },
                sender: this.sender,
                receiver: algosdk.getApplicationAddress(txn.appIndex as bigint),
                amount: txn.aamt as bigint,
                assetIndex: txn.xaid as bigint,
                note: this.makeUNote(
                  `${abiMethod.name} Asset transfer to application`
                ),
              })
            )
          }
          if (!('ignore' in txn) || !txn.ignore) {
            if (srcTxn) txns.push(srcTxn)
          }
        })
      } else {
        // if we don't need to map references
        //
        // txns.push(
        //   ...appCallTxns.map((appCallTxn, i) =>
        //     algosdk.makeApplicationCallTxnFromObject(appCallTxn)
        //   )
        // );
        //
        // if single transaction not using group resource sharing
        //
        // Add the application call transactions to the list of transactions
        // with unnamed resources accessed added
        const offset = this.paymentAmount > 0 ? 1 : 0 // offset for payment transaction
        const index =
          grsOffset +
          offset +
          this.assetTransfers.length +
          this.transfers.length // index for appCallTxns
        // unnamedResourcesAccessed fallback
        const ura = {
          accounts: [],
          appLocals: [],
          apps: [],
          assetHoldings: [],
          assets: [],
          boxes: [],
          extraBoxRefs: [],
        }
        // group unnamedResourcesAccessed
        const gurs = sRes.txnGroups[0]?.unnamedResourcesAccessed ?? ura
        txns.push(
          ...appCallTxns.map((appCallTxn, j) =>
            algosdk.makeApplicationCallTxnFromObject(
              ((txn) => {
                const i = j + index
                // transaction unnamedResourcesAccessed raw
                const turs =
                  sRes.txnGroups[0]?.txnResults[i]?.unnamedResourcesAccessed ??
                  ura
                // transaction apps
                const tApps = Array.from(
                  new Set([
                    txn.appIndex,
                    ...(gurs?.apps ?? []),
                    ...(turs?.apps ?? []),
                  ])
                )
                // transaction boxes
                const tBoxes = this.enableGroupResourceSharing
                  ? []
                  : [...(gurs?.boxes ?? []), ...(turs?.boxes ?? [])]
                      .filter((x) => tApps.includes(x.app))
                      .map((x) => ({ appIndex: x.app, name: x.name }))
                // transaction accounts
                const tAccounts = Array.from(
                  new Set([
                    ...(gurs?.accounts ?? []),
                    ...(turs?.accounts ?? []),
                  ])
                )
                // transaction assets
                const tAssets = Array.from(
                  new Set([...(gurs?.assets ?? []), ...(turs?.assets ?? [])])
                )
                // transaction unnamedResourcesAccessed prepared
                const unnamedResourcesAccessed = {
                  accounts: tAccounts,
                  boxes: tBoxes,
                  foreignApps: tApps,
                  foreignAssets: tAssets,
                }
                // final transaction
                const ftxn = {
                  ...txn,
                  ...unnamedResourcesAccessed,
                  onComplete: this.getOnComplete(),
                  note: this.makeUNote(`${abiMethod.name} transaction`),
                }
                return ftxn
              })(appCallTxn)
            )
          )
        )
      }

      if (this.optIns.length > 0) {
        const optInTxns = this.optIns.map((optIn) => {
          return algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
            suggestedParams: {
              ...params,
              flatFee: true,
              fee: 1000,
            },
            sender: this.sender,
            receiver: this.sender,
            amount: 0,
            assetIndex: optIn,
            note: this.makeUNote(
              `${abiMethod.name} Asset optin for asset ${optIn}`
            ),
          })
        })
        txns.push(...optInTxns)
      }

      const utxns = algosdk
        .assignGroupID(txns)
        .map((t) =>
          Buffer.from(algosdk.encodeUnsignedTransaction(t)).toString('base64')
        )

      return utxns
    } catch (error) {
      console.error('Error in createAndSimulateTxn:', error)
      // throw error // Re-throw the error after logging it
    }
  }

  makeUNote(mgs: string) {
    return new TextEncoder().encode(
      `${makeARC2Prefix(this.getAgentName())} ${mgs}`
    )
  }

  getRIndex() {
    const offsets = [
      this.paymentAmount > 0 ? 1 : 0,
      this.assetTransfers.length,
      this.transfers.length,
    ]
    return offsets.reduce((a, b) => a + b, 0)
  }

  /*
   * simulateTxn
   * - Returns the simulation response
   * @param {Object} abiMethod - The ABI method object
   * @param {Array} args - The arguments to the method
   */
  async simulateTxn(
    abiMethod: algosdk.ABIMethod,
    args: algosdk.ABIValue[]
  ): Promise<algosdk.modelsv2.SimulateResponse> {
    try {
      // Get the suggested transaction parameters
      const params = await this.algodClient.getTransactionParams().do()

      const acctInfo = await this.algodClient
        .accountInformation(this.sender)
        .do()

      // TODO: make sure transactions below are getting signed with the correct account if rekeyed
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const authAddr =
        acctInfo.authAddr || algosdk.Address.fromString(acctInfo.address)

      // Encode arguments
      const encodedArgs = args.map((arg, index) => {
        return algosdk.ABIType.from(
          abiMethod.args[index].type as string
        ).encode(arg)
      })

      // begin build transaction list for group
      const txns: algosdk.Transaction[] = []

      // front load asset transfers from the sender to the contract
      // may depreciate this in the future for custom transactions with xaid and aamt set
      this.assetTransfers.forEach(([amount, token]) => {
        const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          suggestedParams: {
            ...params,
            flatFee: true,
            fee: 1000,
          },
          sender: this.sender,
          receiver: algosdk.getApplicationAddress(this.contractId),
          amount,
          assetIndex: token,
        })
        txns.push(txn)
      })

      // front load algos transfers from the sender to the contract
      // may depreciate this in the future for custom transactions with payment set
      this.transfers.forEach(([amount, addr]) => {
        const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
          suggestedParams: {
            ...params,
            flatFee: true,
            fee: 1000,
          },
          sender: this.sender,
          receiver: addr,
          amount,
        })
        txns.push(txn)
      })

      // conditionally add payment transaction
      // if payment amount is set
      if (this.paymentAmount > 0) {
        txns.push(
          algosdk.makePaymentTxnWithSuggestedParamsFromObject({
            sender: this.sender,
            receiver: algosdk.getApplicationAddress(this.contractId),
            amount: this.paymentAmount,
            suggestedParams: {
              ...params,
              flatFee: true,
              fee: 1000,
            },
          })
        )
      }

      // build application call transactions
      const appCallTxns: Array<
        algosdk.ApplicationCallTransactionParams &
          algosdk.CommonTransactionParams
      > = []

      if (abiMethod.name !== 'custom') {
        appCallTxns.push({
          suggestedParams: {
            ...params,
            flatFee: true,
            fee: this.fee,
          },
          sender: this.sender,
          appIndex: this.contractId,
          appArgs: [abiMethod.getSelector(), ...encodedArgs], // Adjust appArgs based on methodSpec and args
          onComplete: this.getOnComplete(),
        })
      }

      if (this.extraTxns.length > 0) {
        this.extraTxns.forEach((txn) => {
          if (
            'xaid' in txn &&
            'snd' in txn &&
            'arcv' in txn &&
            txn.snd === txn.arcv
          ) {
            txns.push(
              algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
                suggestedParams: {
                  ...params,
                  flatFee: true,
                  fee: 1000,
                },
                sender: txn.snd as string,
                receiver: txn.arcv as string,
                amount: 0,
                assetIndex: txn.xaid as bigint,
              })
            )
          }
          if (txn.payment && 'appIndex' in txn) {
            txns.push(
              algosdk.makePaymentTxnWithSuggestedParamsFromObject({
                suggestedParams: {
                  ...params,
                  flatFee: true,
                  fee: 1000,
                },
                sender: this.sender,
                receiver: algosdk.getApplicationAddress(txn.appIndex as bigint),
                amount: txn.payment.amount,
              })
            )
          }
          if ('xaid' in txn && 'aamt' in txn && 'appIndex' in txn) {
            txns.push(
              algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
                suggestedParams: {
                  ...params,
                  flatFee: true,
                  fee: 1000,
                },
                sender: this.sender,
                receiver: algosdk.getApplicationAddress(txn.appIndex as bigint),
                amount: txn.aamt as bigint,
                assetIndex: txn.xaid as bigint,
              })
            )
          }
          txns.push(
            algosdk.makeApplicationCallTxnFromObject({
              ...txn,
              suggestedParams: {
                ...params,
                flatFee: true,
                fee: txn.fee || this.fee,
              },
              appIndex: this.contractId,
              onComplete: algosdk.OnApplicationComplete.NoOpOC,
            })
          )
        })
      } else {
        txns.push(
          ...appCallTxns.map((appCallTxn) =>
            algosdk.makeApplicationCallTxnFromObject(appCallTxn)
          )
        )
      }

      // end build transaction list for group
      const group: algosdk.SignedTransaction[] = algosdk
        .assignGroupID(txns)
        .map((txn) => {
          return algosdk.decodeMsgpack(
            algosdk.encodeUnsignedTransaction(txn),
            algosdk.SignedTransaction
          )
        })

      const txnGroup = new algosdk.modelsv2.SimulateRequestTransactionGroup({
        txns: group,
      })

      // Construct the simulation request
      const request = new algosdk.modelsv2.SimulateRequest({
        txnGroups: [txnGroup],
        allowUnnamedResources: true,
        allowEmptySignatures: true,
      })

      // Simulate the transaction group
      const response = await this.algodClient.simulateTransactions(request).do()

      return response
    } catch (error) {
      console.error('Error in createAndSimulateTxn:', error)
      throw error // Re-throw the error after logging it
    }
  }

  decodeSimulationResponse(
    response: algosdk.modelsv2.SimulateResponse,
    abiMethod: algosdk.ABIMethod
  ) {
    try {
      // Handle the simulation results
      if (response.txnGroups[0].failureMessage) {
        throw new Error(response.txnGroups[0].failureMessage)
      }
      // -----------------------------------------
      // return type void handled before decoding to workaround
      // difference in compiler ouput
      //   puya genearted teal programs will fail to pop logs
      //   reachc generated teal programs will not produce an error
      // -----------------------------------------
      if (abiMethod.returns.type == 'void') {
        return null
      }
      // -----------------------------------------
      const index = this.getRIndex()
      const rlog =
        response.txnGroups[0]?.txnResults?.[index]?.txnResult?.logs?.pop() ??
        null
      const rlog_ui = rlog
        ? Uint8Array.from(Buffer.from(rlog.toString(), 'base64'))
        : new Uint8Array()
      const res_ui = rlog_ui.slice(4)
      // -----------------------------------------
      // Decode the response based on the methodSpec
      let result: algosdk.ABIValue | undefined
      // -----------------------------------------
      // special handling for decode method return type of bool
      // -----------------------------------------
      if (abiMethod.returns.type == algosdk.ABIType.from('bool')) {
        // HACK: Hacking this because some early arc72 forgot to cast to bool
        if (res_ui.length === 8) {
          const r = res_ui.slice(-1)
          switch (r[0]) {
            case 0:
              result = abiMethod.returns.type.decode(
                new Uint8Array(Buffer.from([0]))
              )
              break
            case 1:
              result = abiMethod.returns.type.decode(
                new Uint8Array(Buffer.from([128]))
              )
              break
          }
        } else {
          result = abiMethod.returns.type.decode(res_ui)
        }
      }
      // -----------------------------------------
      //HACK: Hacking this because the decode function doesn't work on bytes
      // -----------------------------------------
      else if (
        'childType' in abiMethod.returns.type &&
        abiMethod.returns.type.childType == 'byte'
      ) {
        result = new TextDecoder().decode(res_ui)
      }
      // -----------------------------------------
      else {
        result = abiMethod.returns.type.decode(res_ui)
      }

      return result
    } catch (error) {
      console.error('Error in handleSimulationResponse:', error)
      // throw error // Re-throw the error after logging it
    }
  }
}

export class Contract extends ContractBase {
  [key: string]: unknown

  constructor(
    contractId: bigint | number,
    algodClient: algosdk.Algodv2,
    indexerClient: algosdk.Indexer,
    spec: algosdk.ABIContractParams,
    acc?: algosdk.Account,
    options?: {
      simulate?: boolean
      waitForConfirmation?: boolean
      formatBytes?: boolean
      objectOnly?: boolean
      logToConsole?: boolean
    }
  ) {
    super(contractId, algodClient, indexerClient, spec, acc, options)

    // assign method names from ABI directly to class methods
    for (const methodSpec of spec.methods) {
      this[methodSpec.name] = async (...args: algosdk.ABIValue[]) => {
        await this.callMethod(methodSpec.name, ...args)
      }
    }

    // assign event names from ABI directly to class methods
    if (spec.events) {
      for (const eventSpec of spec.events) {
        this[eventSpec.name] = async (query: EventQuery) => {
          await this.fetchEvents(eventSpec.name, query)
        }
      }
    }
  }
}
