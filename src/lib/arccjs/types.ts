import algosdk from 'algosdk'

export type MethodResponse<T = unknown> =
  | { success: true; returnValue: T }
  | { success: false; error: unknown }

export type EventQuery = {
  minRound?: bigint | number
  maxRound?: bigint | number
  address?: string | algosdk.Address
  round?: bigint | number
  txid?: string
  sender?: string | algosdk.Address
  limit?: number
}

/** [ARC-28](https://arc.algorand.foundation/ARCs/arc-0028) event description */
export interface ARC28Event {
  name: string
  desc?: string
  args: {
    type: string
    name?: string
    desc?: string
  }[]
}
