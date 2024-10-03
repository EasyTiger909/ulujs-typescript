import algosdk from 'algosdk'

export const combineABI = (
  abi: algosdk.ABIContractParams,
  abi2: algosdk.ABIContractParams
): algosdk.ABIContractParams => {
  const combinedABI = {
    name: abi.name,
    desc: abi.desc,
    methods: [...abi.methods, ...abi2.methods],
    events: [...(abi.events ?? []), ...(abi2.events ?? [])],
  }
  return combinedABI
}
