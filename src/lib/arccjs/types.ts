export type MethodResponse<T = unknown> =
  | { success: true; returnValue: T }
  | { success: false; error: unknown }

export type EventQuery = {
  minRound?: bigint
  maxRound?: bigint
  address?: string
  round?: bigint
  txid?: string
  sender?: string
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
