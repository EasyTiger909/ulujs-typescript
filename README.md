# ulujs

`ulujs` is a JavaScript & Typescript library for interacting with smart contracts on AVM blockchains. It provides a convenient interface for interacting with smart contract tokens, NFTs, and DEXes.

## Features

- Interaction with smart contract tokens (arc200, arc72)
- Query application events from Indexer
- Comprehensive methods for performing swaps and liquidity provision (swap200)

## Installation

Install `ulujs` in your project with:

```bash
npm install ulujs
```

## Usage

### Standard Contracts

- `arc200` - ARC200 Smart Contract Token [https://arc.algorand.foundation/ARCs/arc-0200]
- `arc72` - ARC72 Smart Contract NFT [https://arc.algorand.foundation/ARCs/arc-0072]

#### Import and initialize the `ulujs` library in your project:

```javascript
import algosdk from 'algosdk'
import { arc200 } from 'ulujs'

// Initialize Algod and Indexer clients
const algodClient = new algosdk.Algodv2(algodToken, algodServer, algodPort)
const indexerClient = new algosdk.Indexer(
  indexerToken,
  indexerServer,
  indexerPort
)
```

#### Initialize contract instance using `arc200` (standard):

```javascript
const tokenId = 123456 // Replace with your token ID

// Initialize Read-Only Contract Instance
const contract = new arc200(tokenId, algodClient, indexerClient)

// Read-Only Methods
const response = await contract.arc200_allowance('OWNER', 'SPENDER')
if (response.success) {
  console.log(
    `Spender allowed to spend ${response.returnValue} of owner's token`
  )
}

// Initialized Contract Instance with a sender account
const senderAccount = new algosdk.mnemonicToSecretKey('sender mnemonic ...')
const contract = new arc200(tokenId, algodClient, indexerClient, {
  acc: senderAccount,
})

// Application Call Methods
const response = await contract.arc200_transfer('RECEIVER', 1000n)
```

#### Query Events

`minRound` and `maxRound` can be used to specify a range of rounds to query events from. `address` can be used to filter events by address. `round` and `txid` can be used to retrieve events from a specific round or transaction ID.

```javascript
// Define Optional Filters
const query = { minRound, maxRound, address, round, txid, sender, limit }
const events = contract.arc200_Transfer(query)
```

### Predefined Contracts

- `hsv2` - HumbleSwap Protocol (v2)
- `swap200` - ARC200 Based Liqudity Pool (AMM)
- `nt200` - ARC200 Wrapped Network Token (wVOI)

```javascript
import algosdk from 'algosdk'
import { hsv2 } from 'ulujs'

// Initialize Contract instance
const tokenId = 123456 // Replace with your token ID
const contract = new hsv2(tokenId, algodClient, indexerClient)
```

### User-Defined Contracts

#### Option 1: Initialize a `Contract` from its ABI and access its methods and event queries directly.

```javascript
import { Contract } from 'ulujs'
import { abiSpec } from 'some/abi'

// Initialize Contract instance with imported ABI
const tokenId = 123456 // Replace with your token ID
const contract = new Contract(tokenId, algodClient, indexerClient, abiSpec)

const response = contract.someMethod(someArgument)
if (response.success) {
  console.log(`Response Success: ${response.returnValue}`)
} else {
  console.error(response.error)
}

const results = contract.someEvent({ minRound: 1234n })
console.log(results)
```

#### Option 2: Extend the `ContractBase` class with strongly typed methods.

This allows for extra logic and validation to be added.

```javascript
import { ContractBase } from 'ulujs';

// Define a new Class for instances of a custom contract
class SomeContract extends ContractBase {
  constructor(
    contractId: bigint | number,
    algodClient: algosdk.Algodv2,
    indexerClient: algosdk.Indexer,
  ) {
    super(
      contractId,
      algodClient,
      indexerClient,
      schema
    );
    //...
  }
  async some_method() {
    return await this.callMethod<string>('some_method');
  }
  // define events and other logic or validation needed
}
```

## API Reference

Each contract handled by `ulujs` also exposes the following:

- `callMethod(methodName, ...args)`: Calls a method by name of the smart contract.
- `callMethod<returnType>((methodName, ...args)`: Define return type if using Typescript

- `fetchEvents(eventName, query)`: Fetches Events from Indexer
- `fetchEvents<returnTupleType>(eventName, query)`: Define return type if using Typescript

## Contributing

Contributions to `ulujs` are welcome. Please adhere to the existing code style and ensure all tests pass.

## License

`ulujs` is [MIT licensed](./LICENSE).
