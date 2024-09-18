# Decentralized Token Depository

Decentralized Token Depository (DTD) is used to manage bilateral over-the-counter (OTC) derivatives contracts.

It handles the initiation, clearing and settlement of the contracts while seeking to minimize the counterparty risk for participants.

## Introduction

A key feature of OTC contracts is that the exact details are negotiated directly between the two parties and are therefore not standardized, unlike exchange-traded instruments such as equities or vanilla options. Exchange-traded products also have a clearing house between the parties to ensure that settlement occurs and that all parties honor their contractual obligations.

In an OTC contract, the parties may agree to exchange cash flows (or in this case, token flows) periodically to reduce counterparty risk, or only at settlement. If the other party defaults, full settlement may not be possible, but in TradFi the parties usually know each other and can also take legal action to mitigate the situation. Nowadays in TradFi a lot of OTC contracts use and in some cases are required to use central counterparty clearing to reduce the risk.

In the blockchain world, the two parties may not have the slightest idea who exactly their counterparty is and how liquid they are. At the same time, blockchains can facilitate complex financial contracts very effectively. This can significantly reduce the notional amounts of the contracts, making OTC instruments available to a wider audience and making the whole process much more transparent.

DTD is a Solidity smart contract that facilitates the clearing and settlement of bilateral contracts. It does not contain any logic for handling OTC instruments (be it a non-deliverable swap or option, a target redemption forward, an interest rate swap or anything else). DTD facilitates the contract management for the exchange of token flows when marking-to-market, the settlement of the contracts and cases where a counterparty defaults.

## Usage

Before a party can create or become a counterparty to a contract that uses DTD for clearing and settlement, it must create a vault with DTD and deposit ERC20 tokens there. The deposited tokens are used as collateral during the lifetime of a contract. When the contract expires, DTD will move the tokens from one vault to another according to the rules of the OTC instrument.

The complete lifecycle of an OTC contract using the DTD is as follows:

1. The party that is the seller (short) calls the OTC instrument to create a new contract instance.
2. OTC instrument calls DTD to register new contract instance. Seller submits penalty margin.
3. Buyer (long) calls OTC instrument to lock the contract.
4. OTC instrument calls DTD to lock the contract. Buyer submits penalty margin. Contract is now in effect.
5. Either party can request mark-to-market event for the contract to change the vaults' minimum margin requirements.
6. The contract will be settled at the end of the maturity period or if there is a default as part of mark-to-market calls.

Note that while counterparties can directly call the DTD to create the vaults, they cannot register or lock the contract. These calls must come from smart contracts that contain the OTC instrument logic. Any OTC contract using the DTD must have **DTD_CONTRACT_ROLE** in the DTD to be able to call the required functions.

The penalty margin does not need to be equal for both sides, e.g. for a non-deliverable swap instrument, the short party needs to have a high enough penalty margin to ensure that the long party feels that the short party won't bail out immediately if volatility moves against the seller.

## Role of Minimum Margin and Penalty Margin

When a party enters into an OTC contract, they must have a sufficient amount of ERC20 tokens in the vault. In TradFi contracts, when marking to market, value (money) is often transferred from one party to another. In DTD this is not the case. The counterparties don't necessarily know each other, and there is no formal legal framework, such as an ISDA agreement, to ensure that both parties honor their commitments. Instead, the DTD model manages counterparty risk in two ways: 1) reserving the tokens by increasing the minimum margin of the losing party's vault, and 2) per-contract penalty margins to incentivize all parties to ensure that the minimum margin level doesn't exceed the token balance of their vault.

During a mark-to-market event on an OTC contract, the losing party's minimum margin requirement is increased to ensure that there are sufficient funds to cover it. The value is not transferred from one vault to another until the contract expires (or defaults), to prevent cases during the contract period where a winning party could "take the tokens and run".

If during a mark-to-mark event the minimum margin level of a vault exceeds the token balance, it means that a party has defaulted on a contract. In this case, the winning party will receive the losing party's penalty margin as well as the entire accumulated balance.

When the contract expires and the final mark-to-market event is completed, the token balances are moved from the losing party's vault to the winning party's vault. The penalty margins are also returned to both parties.

# DTDEngine

Key methods for contract administration:

| Method                  | Description                                          |
| :---------------------- | :--------------------------------------------------- |
| **modfiyPauseStatus()** | Only DTD admin can call this to pause / un-pause DTD |
| **grantRole()**         | To grant roles e.g. for OTC contract logic           |
| **enableEmergencyValve()** | Only DTD admin can call this after pausing the contract. It enables the vault owners to immediately withdraw the funds using **emergencyVaultTransfer()**. Note that after enabling the emergency valve the contract should not anymore be used. |

&nbsp;  
Key methods for creating and managing vaults:

| Method                     | Description                                                                                                                                                                                                                                                                                           |
| :------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **createVault()**          | Caller creates new vault to DTD contract                                                                                                                                                                                                                                                              |
| **changeDepositBalance()** | Add / reduce balance of a vault. Caller must be owner of the vault and if caller wants to move tokens then the **approve()** method of the appropriate ERC20 contract must be called first. Note that only excess balance (**depositBalance** - **minMarginLevel**) can be moved from vault to owner. |
| **getVault()**             | Returns the data of a vault                                                                                                                                                                                                                                                                           |

&nbsp;  
Key methods for managing OTC contract lifecycle:

| Method               | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| :------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **createContract()** | Creates new contract instance to DTD. Caller is OTC instrument smart contract. Tx originator is the short party of the contract                                                                                                                                                                                                                                                                                                                                                             |
| **lockContract()**   | Locks the contract and makes it active. Caller is OTC instrument. Tx originator is the long party of the contract                                                                                                                                                                                                                                                                                                                                                                           |
| **markToMarket()**   | Marks the OTC instrument to market. DTD calls OTC instrument and receives from the instrument current PnL and uses it to update the minimum margin levels. Also handles defaulting and settlement once contract is not anymore active. When the contract is settled, penalty margin is released back to both parties and the tokens are moved from the vault of the losing party to the winning party. In case there is default, winning party gets the penalty margin of the losing party. |

## Example

There is a smart contract implementing non-deliverable swap (NDS) using DTD to manage clearing and settlement between the counterparties. NDS is an OTC instrument in foreign exchange markets used to hedge exposure against non-convertible currencies such as Indonesian rupiah, Korean won or Taiwanese dollar. It can be considered similar to one or more forward transactions with the difference that there is no settlement in the non-convertible currency. Instead, the whole transaction is settled in a convertible currency such as USD or EUR.

Let's assume two parties want to engage in a simple NDS transaction, which is settled in USDC and the underlying non-convertible currency is Korean won (KRW). The NDS contract reads the rate using Chainlink oracle's stream and the counterparties agree on following terms:

- Amount of underlying, KRW: 10 000 000 (around 7900 USD)
- Agreed exchange rate KRW / USD: 0.00079
- Contract duration: 30 days
- Penalty margin: 500 USD for both parties

To represent USD, both parties deposit USDC in their vaults and use the token as a proxy to USD. The counterparty creating the OTC contract sets the terms and being the seller of KRW (short party) posts the penalty margin and ensures to have enough deposit balance to not default if exchange rate moves against. After that the buyer (long party) locks the contract, deposits the penalty margin and makes sure that enough USDC is in vault to weather volatility. The contract is now in effect.

Either party can call DTD's mark-to-market functionality at will during contract's duration to ensure that enough margin is secured by the counterparties. Note that NDS contract logic can set limits on how often the contract can be marked to market (say e.g. once per hour). As an example, if the exchange rate goes up to 0.0008 and it is marked to market, then minimum margin level of short party's vault is increased by 100 USDC (8000 USDC - 7900 USDC). Similarly, if the rate drops to 0.00076 the minimum margin level of long party is increased by 300 USDC.

The rate fluctuates during the 30-day period and the counterparties keep on marking the contract value to market to reserve counterparty vault's USDC tokens in case they default.

If default doesn't happen to either party, then after 30 days the last mark-to-market is done and the NDS contract tells DTD to settle the contract. DTD moves the USDC according to final exchange rate to the winning party and releases the penalty margins back to the vaults of both parties by decreasing the minimum margin levels of both vaults by 500 USD.

In case the default happens, i.e. contract is marked to market and the minimum margin level of a vault would go over the deposit balance, DTD moves the penalty margin plus the reserved margin to an extent it can to the winning party. After that the contract is deleted and it is settled.

Note that critical part when negotiating any OTC contract is setting the penalty margin a) high enough to ensure that neither party wants to default and are motivated to increase the deposit balance of their vault in case default is about to happen and b) not setting the penalty margin too high to ensure that the contract is capital efficient.

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

1. Allow contract creator to define if it is going to be short party or long party
2. Novation process: Enable transferring counterparty position to a new party (if allowed by contract)
3. Provide netting to "stack" the marking-to-market of all contracts between two counterparties
4. Provide portfolio margining for increasing capital efficiency or for simply notifying parties of potential defaulting
5. Separate collateral (penalty margin) and the traded value from each other. Now they both use same token
6. Allow e.g. NFTs representing real world assets or stakes on lending pools to be used as collateral
7. Enable swapping collateral to another (if allowed by contract)
8. Trade compression: Terminate offsetting contracts among two or more participants or replace them with smaller netted out contracts
9. Limit the tokens allowed to be used as collateral

# References

[1] "Implementing a financial derivative as smart contract" (2019) - Christian Fries et al
https://arxiv.org/pdf/1903.00067.pdf

[2] "OTC Derivatives: Bilateral Trading and Central Clearing: An Introduction to Regulatory Policy, Market Impact and Systemic Risk" (2013) - David Murphy

[3] "Collateral Management: A Guide to Mitigating Counterparty Risk" (2019) - Michael Simmons

[4] "Bank For International Settlements: OTC Derivatives Settlement Procedures and Counterparty Risk Management" (1998)
https://www.bis.org/cpmi/publ/d27.pdf

[5] "ISDA Whitepaper: Smart Derivatives Contracts: From Concept to Construction" (2018)
https://www.isda.org/a/cHvEE/Smart-Derivatives-Contracts-From-Concept-to-Construction-Oct-2018.pdf

[6] "EIP 6123: Smart Derivative Contract" - Christian Fries et al
https://github.com/ethereum/EIPs/blob/master/EIPS/eip-6123.md
