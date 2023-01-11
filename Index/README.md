# Index

Index project contains smart contracts for managing underlying indices of bilateral OTC contracts. The smart contract is used to value a contract and to define the PnL for the counterparties.

## Introduction

Index can be as simple as tracking a spot price of a single asset such as price of Bitcoin or a stock, but it can also be a more complex calculation. Other common ways to calculate an index of OTC instrument would be a basket of assets and the defining relative performance based on a criterion (best-of, worst-of or average).

Other way to calculate would be to use the spot prices to derive an index metric. An example of this would be calculating variance from source by storing the spot values and revising the realized variance estimate after each new data point is fetched from oracle. Variance is also an example of calculating a performance of a path dependent instrument: The index value is not only tied to the latest spot value, but to the history of values.

An important aspect of calculating the index is how often the sources are sampled and the index value is refreshed. The Index project supports "spot indices" where the performance can be calculated on every block. On some other indices it might be required that there is a minimum delay between two calculations or to set the maximum number of times the index calculation can be called during the lifetime of the contract.

One key feature of an index is that it has a base level against which its performance is measured. This is also required for OTC contracts where the base level defines the starting point against which the PnL of a contract is calculated: short party to gain if index value is below base level and vice versa for long party. In this project setting the base level is called "fixing" the index and it can be done multiple different ways to match locking the OTC contract for counterparties.

Currently Chainlink oracles are supported as the data sources for indices. In future data provider support can be extended.

## Usage

The lifecycle of an index can be divided to following steps:

1. Define oracles, fixing style and calculator for an index
2. Create Index
3. Fix Index
4. Calculate the index
5. Contract closed - no more calls needed

Index creation is started by creating an Oracle Storage. It consists of the static elements of an index, i.e., Chainlink oracle addresses, the fixing logic and the calculation logic. If other indices use same combinations, then they don't need to be stored again thus saving gas.

After the static elements are defined and the bundle has been stored to Oracle Storage, next step is to create the index. Index can be a "spot index" where it can be called at will, once per block, or regular index. For both types it is necessary to define component weights and additional parameters for the calculator. Component weights can be used to create long and short positions for individual sources in a basket and define how much each source matters for the overall performance of the index. For regular indices it is also necessary to define the maximum times the index value can be calculated ("mark count") and the minimum time delta between two calculations.

Before the index can be calculated, it needs to be fixed to a base level. The fixing step takes care of initializing the base level and it can be set to an arbitrary value or derived from spot price. New fixing styles can be added by creating a contract that implements `IIndexFix` interface.

Index calculation is done repeatedly during the lifetime of the contract. The calculator calls oracles to find the spot values and then subsequently calculates the index value based on the weights, calculator parameters and spot values. A new calculator should derive from `IndexCalculator` abstract class and implement the relevant missing methods. After the contract has been settled, the index is not anymore needed and can be discarded.

The steps can be also mapped to respective OTC contract lifecycle points. Steps 1 and 2 are done when OTC contract is being formed. Step 3 is done when contract is about to be locked and made active. When OTC instrument is active, it repeatedly calls to calculate index for PnL (Step 4). When OTC instrument has run its course and is settled the index is not needed anymore and it won't be active (Step 5).

## Contracts

### IndexTracker

Key contract for managing the indices. The main methods are:

| Method                     | Description                                                                                                             |
| :------------------------- | :---------------------------------------------------------------------------------------------------------------------- |
| **createOracleStorage()**  | Creates new Oracle Storage for static components of an index or returns the mapping key if one matching already exists. |
| **calculateOracleIndex()** | Helper method to calculate the mapping key for Oracle Storage (can be used e.g. in JS / TS code).                       |
| **createSpotIndex()**      | Creates a spot index based on the Oracle Storage key, weights for the sources and calculator parameters.                |
| **createIndex()**          | Creates index based on mark count, mark delta and the parameters defined in **createSpotIndex()**.                      |
| **fixIndex()**             | Fixes and index to set a base rate for it.                                                                              |
| **calculateIndex()**       | Calculates the new value for an index.                                                                                  |

### Index Fixers

Index fixers implement interface `IIndexFix`. The current implementation provides following fixers:

- **NoFix**: Base values are fixed to static values that are given as parameters on `fixIndex()` call.
- **SpotFix**: Base values are fixed to current spot values from oracles.
- **SpotFixPlus**: Base values are fixed to spot values and per-source constant is added (subtracted) to it
- **SpotFixMul**: Base values are fixed to spot values multiplied by per-source constant
- **SpotFixMulPlus**: Combination of **SpotFixPlus** and **SpotFixMul**. Spot values are multiplied by constants and then another constant is added

If you want to implement a new fixer, implement following method:

| Method           | Description                                                           |
| :--------------- | :-------------------------------------------------------------------- |
| **fixStrikes()** | Called to fix strikes containing the oracle contracts and parameters. |

### Index Calculator

Index calculators derive from base contract `IndexCalculator`. The current implementation provides following calculators:

- **AbsoluteSpotIndexCalculator**: Calculates the absolute difference between base level and current spot value. This should be used mainly for single-source indices since using it with multiple sources makes little sense.
- **RelativeSpotIndexCalculator**: Calculates relative difference between base level and current spot value. This works well with several sources and can be used to track the performance of a basket. Note that you need to give to it as a calculation parameter the exact calculation methodology: provide the worst-of, best-of or average value among sources (for a single-source index doesn't make a difference).

The index values are normalized to base 10^10 for the calculators.

If you want to implement a new calculator, following key methods to implement on derived contract are:

| Method                | Description                                                                                                                       |
| :-------------------- | :-------------------------------------------------------------------------------------------------------------------------------- |
| **prepareNewIndex()** | Called when index is created. Provides opportunity for the calculator to do initial preparations by e.g. reserving storage space. |
| **calculateIndex()**  | Calculates the index and returns the new index value.                                                                             |

Note that for both calls you should make sure that they have `isIndexContract` modifier to make sure that only registered `IndexTracker` contract can call them.

## Installation

1. First create file called **.env** containing two constants `API_URL` and `PRIVATE_KEY`. `API_URL` is endpoint url to Mumbai Testnet node (e.g. from Alchemy) and `PRIVATE_KEY` is the wallet private key containing enough (fake) MATIC for deploying contracts.
2. Download the dependencies for the project using npm `npm install`
3. You should now have everything for testing and deploying the contracts

## Running Tests

Run `npx hardhat test` to run all the unit tests. Make sure that all tests for all contracts pass.

## Deployment

Run `npx hardhat run ./scripts/deploy.ts --network polygon_mumbai`. Note that you need to have enough MATIC on your wallet to deploy the contracts. The script will print out the addresses for contracts and note them down!

Currently only Polygon Mumbai testnet is supported.

## Potential Improvements

1. Integrate other oracle providers in addition to Chainlink (UMA, NEST Protocol?, API3?, Band Protocol?)
2. Add more fix styles and more calculators
3. Define minimum counts before the index calculation is "valid" or provide confidence estimation. Needed for more complex calculators
4. Explore if on-chain protocols could provide reliable data sources, e.g., lending rates from Aave, Voltz, Sense Finance or options' prices from Lyra
5. For timing block.timestamp is used. Is there any better way to do it, e.g., using an oracle?
6. Index-of-indices, although these could also be constructed separately - main benefit is to use different calculators for different sub-indices.

# References

[1] "Implementing a financial derivative as smart contract" (2019) - Christian Fries et al
https://arxiv.org/pdf/1903.00067.pdf
