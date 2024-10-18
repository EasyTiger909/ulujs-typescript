import algosdk from 'algosdk'
import { Buffer } from 'buffer'
import sha512 from 'js-sha512'
import { ARC28Event, EventQuery } from './types'

const genericHash = (arr: sha512.Message) => {
  return sha512.sha512_256.array(arr)
}

const getEventSignature = (event: ARC28Event) => {
  return `${event.name}(${event.args.map((a) => a.type).join(',')})`
}

const getEventSelector = (event: ARC28Event) => {
  return Buffer.from(
    genericHash(getEventSignature(event)).slice(0, 4)
  ).toString('hex')
}

const uint8ArrayToHex = (uint8array: Uint8Array) => {
  return Array.from(uint8array)
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('')
}

const decodeEventArgs = (args: { type: string }[], argv: Uint8Array) => {
  let index = 4
  const encoded: unknown[] = []
  args.forEach(({ type }) => {
    switch (type) {
      case 'address':
        encoded.push(algosdk.encodeAddress(argv.slice(index, index + 32)))
        index += 32
        break
      case '(uint64)':
        encoded.push([algosdk.bytesToBigInt(argv.slice(index, index + 8))])
        index += 8
        break
      case 'uint64':
        encoded.push(algosdk.bytesToBigInt(argv.slice(index, index + 8)))
        index += 8
        break
      case '(uint256)':
        encoded.push([algosdk.bytesToBigInt(argv.slice(index, index + 32))])
        index += 32
        break
      case 'uint256':
        encoded.push(algosdk.bytesToBigInt(argv.slice(index, index + 32)))
        index += 32
        break
      case 'byte':
        encoded.push(uint8ArrayToHex(argv.slice(index, index + 1)))
        index += 1
        break
      case 'byte[8]':
        encoded.push(uint8ArrayToHex(argv.slice(index, index + 8)))
        index += 8
        break
      case 'byte[32]':
        encoded.push(uint8ArrayToHex(argv.slice(index, index + 32)))
        index += 32
        break
      case 'byte[64]':
        encoded.push(uint8ArrayToHex(argv.slice(index, index + 64)))
        index += 64
        break
      case 'byte[96]':
        encoded.push(uint8ArrayToHex(argv.slice(index, index + 96)))
        index += 96
        break
      case '(uint64,uint64,uint64)': {
        const a = algosdk.bytesToBigInt(argv.slice(index, index + 8))
        index += 8
        const b = algosdk.bytesToBigInt(argv.slice(index, index + 8))
        index += 8
        const c = algosdk.bytesToBigInt(argv.slice(index, index + 8))
        index += 8
        encoded.push([a, b, c])
        break
      }
      case '(byte,byte[256])': {
        const a = uint8ArrayToHex(argv.slice(index, index + 1))
        index += 1
        const b = uint8ArrayToHex(argv.slice(index, index + 256))
        index += 256
        encoded.push([a, b])
        break
      }
      case '(address,(uint256,uint256))': {
        const a = algosdk.encodeAddress(argv.slice(index, index + 32))
        index += 32
        const b = algosdk.bytesToBigInt(argv.slice(index, index + 32))
        index += 32
        const c = algosdk.bytesToBigInt(argv.slice(index, index + 32))
        index += 32
        encoded.push([a, [b, c]])
        break
      }
      case '(uint64,uint64,uint64,uint64,(uint64,uint64),uint64,(byte,byte[8]),byte[8],uint64,byte[8],uint64,byte[8],uint64,uint64,byte[8],uint64)': {
        const a = algosdk.bytesToBigInt(argv.slice(index, index + 8)) // uint64 ctInfo
        index += 8
        const b = algosdk.bytesToBigInt(argv.slice(index, index + 8)) // uint64 startBlock
        index += 8
        const c = algosdk.bytesToBigInt(argv.slice(index, index + 8)) // uint64 endBlock
        index += 8
        const d = algosdk.bytesToBigInt(argv.slice(index, index + 8)) // uint64 rewardTokenId
        index += 8
        const e = algosdk.bytesToBigInt(argv.slice(index, index + 8)) // (uint64,uint64) rewardsPerBlock
        index += 8
        const f = algosdk.bytesToBigInt(argv.slice(index, index + 8))
        index += 8
        const g = algosdk.bytesToBigInt(argv.slice(index, index + 8)) // uint64 stakedTokenId
        index += 8
        const h = uint8ArrayToHex(argv.slice(index, index + 1)) // (byte,byte[8]) pairTokenAId
        index += 1
        const i = uint8ArrayToHex(argv.slice(index, index + 8))
        index += 8
        const j = uint8ArrayToHex(argv.slice(index, index + 8)) // byte[8] pairTokenASymbol
        index += 8
        const k = algosdk.bytesToBigInt(argv.slice(index, index + 8)) // uint64 pairTokenBId
        index += 8
        const l = uint8ArrayToHex(argv.slice(index, index + 8)) // byte[8] pairTokenBSymbol
        index += 8
        const m = algosdk.bytesToBigInt(argv.slice(index, index + 8)) // uint64 rewardTokenDecimals
        index += 8
        const n = uint8ArrayToHex(argv.slice(index, index + 8)) // byte[8] rewardTokenSymbol
        index += 8
        const o = algosdk.bytesToBigInt(argv.slice(index, index + 8)) // uint64 stakedTokenDecimals
        index += 8
        const p = algosdk.bytesToBigInt(argv.slice(index, index + 8)) // uint64 stakedTokenPoolId
        index += 8
        const r = uint8ArrayToHex(argv.slice(index, index + 8)) // byte[8] stakedTokenSymbol
        index += 8
        const s = algosdk.bytesToBigInt(argv.slice(index, index + 8)) // uint64 stakedTokenTotalSupply
        index += 8
        encoded.push([
          a, // uint64 ctInfo
          b, // uint64 startBlock
          c, // uint64 endBlock
          d, // uint64 rewardTokenId
          [e, f], // (uint64,uint64) rewardsPerBlock
          g, // uint64 stakedTokenId
          [h, i], // (byte,byte[8]) pairTokenAId
          j, // byte[8] pairTokenASymbol
          k, // uint64 pairTokenBId
          l, // byte[8] pairTokenBSymbol
          m, // uint64 rewardTokenDecimals
          n, // byte[8] rewardTokenSymbol
          o, // uint64 stakedTokenDecimals
          p, // uint64 stakedTokenPoolId
          r, // byte[8] stakedTokenSymbol
          s, // uint64 stakedTokenTotalSupply
        ])
        break
      }
      case 'byte[0]': {
        encoded.push([])
        break
      }
      case 'bool': {
        encoded.push(algosdk.bytesToBigInt(argv.slice(0, 1)))
        break
      }
      case '(byte,byte[40])': {
        const a = uint8ArrayToHex(argv.slice(index, index + 1))
        index += 1
        if (a === '00') {
          const b = algosdk.bytesToBigInt(argv.slice(index, index + 8))
          encoded.push([a, b])
        } else {
          const b = uint8ArrayToHex(argv.slice(index, index + 8))
          const c = uint8ArrayToHex(argv.slice(index + 8, index + 40))
          encoded.push([a, b, c])
        }
        index += 40
        break
      }
      case 'uint64,(byte,byte[8]),uint64': {
        const a = algosdk.bytesToBigInt(argv.slice(index, index + 8))
        index += 8
        const b = uint8ArrayToHex(argv.slice(index, index + 1))
        index += 1
        const c = uint8ArrayToHex(argv.slice(index, index + 8))
        index += 8
        encoded.push([
          a,
          [b, c],
          algosdk.bytesToBigInt(argv.slice(index, index + 8)),
        ])
        break
      }
      case '(uint256,uint256)': {
        const a = algosdk.bytesToBigInt(argv.slice(index, index + 32))
        index += 32
        const b = algosdk.bytesToBigInt(argv.slice(index, index + 32))
        index += 32
        encoded.push([a, b])
        break
      }
      case '(uint64,uint64)': {
        const a = algosdk.bytesToBigInt(argv.slice(index, index + 8))
        index += 8
        const b = algosdk.bytesToBigInt(argv.slice(index, index + 8))
        index += 8
        encoded.push([a, b])
        break
      }
      case '((uint256),(uint256))': {
        const a = algosdk.bytesToBigInt(argv.slice(index, index + 32))
        index += 32
        const b = algosdk.bytesToBigInt(argv.slice(index, index + 32))
        index += 32
        encoded.push([[a], [b]])
        break
      }
      case '(uint256,uint256,uint256,address,byte)': {
        const a = algosdk.bytesToBigInt(argv.slice(index, index + 32))
        index += 32
        const b = algosdk.bytesToBigInt(argv.slice(index, index + 32))
        index += 32
        const c = algosdk.bytesToBigInt(argv.slice(index, index + 32))
        index += 32
        const d = algosdk.encodeAddress(argv.slice(index, index + 32))
        index += 32
        const e = uint8ArrayToHex(argv.slice(index, index + 1))
        index += 1
        encoded.push([a, b, c, d, e])
        break
      }
      default:
        throw new Error(`Unknown type: ${type}`)
    }
  })
  return encoded
}

const getSelectors = (logs: Uint8Array[]) => {
  return logs.map((x) =>
    Array.from(x.slice(0, 4))
      .map((y) => y.toString(16).padStart(2, '0'))
      .join('')
  )
}

const isEvent = (selectors: string[], x: string[]) =>
  selectors.some((y) => x.includes(y))

const selectEvent = (selector: string, mSelectors: string[]) => {
  const index = mSelectors.indexOf(selector)
  return index
}

export const fetchEvents = async <T extends unknown[]>(
  indexerClient: algosdk.Indexer,
  contractId: bigint,
  eventsSpec: ARC28Event[],
  eventNames: string[],
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
> => {
  const selectorNameLookup: Record<string, string> = {}
  const selectorSignatureLookup: Record<string, string> = {}
  const selectors = eventNames.map((eventName) => {
    const selector = getEventByName(eventsSpec, eventName).getSelector()
    const signature = getEventSignature(
      eventsSpec.find((y) => y.name === eventName)!
    )
    selectorNameLookup[selector] = eventName
    selectorSignatureLookup[selector] = signature
    return selector
  })

  const eventData: Record<string, [string, bigint, number, Uint8Array][]> = {}
  selectors.forEach((selector) => (eventData[selector] = []))

  const { minRound, maxRound, address, round, txid, sender, limit } =
    query || {}

  // get txns
  let next: string | undefined
  const txns: algosdk.indexerModels.Transaction[] = []
  do {
    const itxn = indexerClient
      .searchForTransactions()
      .applicationID(contractId)
      .limit(1000)
    if (next) itxn.nextToken(next)
    if (minRound) itxn.minRound(minRound)
    if (maxRound) itxn.maxRound(maxRound)
    if (address) itxn.address(address)
    if (round) itxn.round(round)
    if (txid) itxn.txid(txid)
    if (limit) itxn.limit(limit)
    const res = await itxn.do()
    for (const txn of res.transactions) {
      txns.push(txn)
    }
    next = res.nextToken
  } while (next)

  // get logs
  next = undefined
  const logs = []
  const logS = new Set<string>()

  do {
    const ilog = indexerClient.lookupApplicationLogs(contractId).limit(1000)
    if (next) ilog.nextToken(next)
    if (minRound) ilog.minRound(minRound)
    if (maxRound) ilog.maxRound(maxRound)
    if (sender)
      ilog.sender(typeof sender === 'string' ? sender : sender.toString())
    if (txid) ilog.txid(txid)
    if (limit) ilog.limit(limit)
    const res = await ilog.do()
    if (next === res.nextToken) break
    const rLogData = res.logData
    const logData =
      rLogData?.map((el) => ({
        applicationId: res.applicationId,
        round: res.currentRound,
        txid: el.txid,
        logs: el.logs,
      })) || []
    for (const log of logData) {
      const key = log.txid + log.logs.join()
      if (logS.has(key)) continue
      const txn = txns.find((x) => x.id === log.txid)
      if (!txn) {
        const { transaction: txn } = await indexerClient
          .lookupTransactionByID(log.txid)
          .do()
        logs.push({
          ...log,
          round: txn.confirmedRound,
          roundTime: txn.roundTime,
        })
      } else {
        logs.push({
          ...log,
          round: txn.confirmedRound,
          roundTime: txn.roundTime,
        })
      }
      logS.add(key)
    }
    next = res.nextToken
  } while (next)

  // merge txns and logs adding round-time and confirmed-round to logdata
  const merged = []
  for (const log of logs) {
    const mergedLog = {
      applicationId: log.applicationId,
      id: log.txid,
      logs: log.logs,
      confirmedRound: log.round,
      roundTime: log.roundTime,
    }
    merged.push(mergedLog)
  }

  // get events
  for (const txn of merged) {
    const evts = getEvents(txn, selectors)
    for (const [k, v] of Object.entries(evts)) {
      if (!v.length) continue
      eventData[k].push(v)
    }
  }
  const events: Record<
    string,
    {
      name: string
      signature: string
      selector: string
      events: [string, bigint, number, ...T][]
    }
  > = {}

  Object.entries(eventData).forEach(([selector, data]) => {
    const name = selectorNameLookup[selector]
    data.sort((a, b) => a[2] - b[2]) // sort by timestamp

    const e = data.map((el) => [
      ...el.slice(0, 3),
      ...el
        .slice(3)
        .map((el) =>
          decodeEventArgs(
            eventsSpec?.find((el) => el.name === name)?.args ?? [],
            el as unknown as Uint8Array
          )
        )
        .flat(),
    ]) as [string, bigint, number, ...T][]

    events[name] = {
      name: name,
      signature: selectorSignatureLookup[selector],
      selector,
      events: e,
    }
  })

  return events
}

export const getEventByName = (events: ARC28Event[], name: string) => {
  const event = events.find((event) => event.name === name)
  if (!event) {
    throw new Error(`Event ${name} not found`)
  }
  return {
    getSelector: () => getEventSelector(event),
    next: () => {}, //() => Promise<Event<T>>,
    nextUpToTime: () => {}, //(t: Time) => Promise<undefined | Event<T>>,
    nextUpToNow: () => {}, //() => Promise<undefined | Event<T>>,
    seek: () => {}, //(t: Time) => void,
    seekNow: () => {}, //() => Promise<void>,
    lastTime: () => {}, //() => Promise<Time>,
    monitor: () => {}, //((Event<T>) => void) => Promise<void>,
  }
}

const getEvents = (
  txn: {
    applicationId: bigint
    id: string
    logs: Uint8Array[]
    confirmedRound: bigint | undefined
    roundTime: number | undefined
  },
  selectors: string[]
) => {
  const events: Record<string, [string, bigint, number, Uint8Array] | []> = {}
  selectors.forEach((x) => (events[x] = []))
  if (!txn.logs) return {}
  const mSelectors = getSelectors(txn.logs)
  if (!isEvent(selectors, mSelectors)) return {}
  selectors.forEach((x) => {
    const index = selectEvent(x, mSelectors)
    if (index === -1 || !txn.confirmedRound || !txn.roundTime) return
    events[x] = [
      txn.id,
      txn.confirmedRound,
      txn.roundTime,
      txn.logs?.[index] ?? [],
    ]
  })
  return events
}
