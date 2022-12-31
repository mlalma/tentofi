# Decentralized Token Depository

Decentralized Token Repository (DTD) is used for managing bilateral over-the-counter (OTC) derivatives contracts.

It handles initiation, clearing and settlement of the contracts while trying to minimize the counterparty risk for participants.

## Introduction

A key feature of the OTC contracts is that exact details are directly negotiated between the two parties and thus they are not standardized unlike exchange-traded instruments such as stocks or vanilla options. Exchange-traded products also have a clearing house between the parties to ensure the settlement happens and all parties honour their contractual obligations.

In an OTC contract the parties can agree to periodically exchange cash flows (or in this case token flows) to reduce counterparty risk or only at the settlement time. If other party defaults full settlement might not be possible, but in TradFi the parties usually know each other and can also take legal recourse to mitigate the situation. Nowadays in TradFi a lot of OTC contracts use and in some cases are mandated to use central counterparty clearing to reduce the risk.

In blockchain world the two parties might not have faintest idea who their counterparty exactly is and how liquid they are. At the same time blockchains can facilitate complex financial contracts very effectively. This can considerably decrease the notional amounts of the contracts making OTC instruments available to a larger audience and make the whole process much more transparent.

DTD is a Solidity smart contract to facilitate the clearing and settlement of bilateral contracts. It does not contain any logic for handling OTC instruments (be it non-deliverable swap or option, target redemption forward, interest rate swap or anything else), but it facilitates the contract management on exchanging the token flows, settling the contracts and defaulting.

## Usage

Before any party can create or become a counterparty of a contract that uses DTD for clearing and settlement, they must create a vault on DTD and post ERC20 tokens there. The deposited tokens are used as collateral during the lifetime of the contract and once the contract has ended, DTD moves the tokens from one vault to another according to rules of the OTC instrument.

The complete lifecycle of an OTC contract using DTD is as follows:

1. Party being the seller (short) calls OTC instrument to create new contract instance.
2. OTC instrument calls DTD to register the new contract instance. Seller submits penalty margin.
3. Buyer (long) calls OTC instrument to lock the contract.
4. OTC instrument calls DTD to lock the contract. Buyer submits the penalty margin. Contract is now in effect.
5. Either party can request to mark-to-market the contract to change the minimum margin requirements of vaults.
6. Contract gets settled in the end after the duration runs out or if there is default as a part of mark-to-market calls.

Note that while the counterparties directly call DTD to create the vaults they cannot register or lock the contract. Those calls must come from smart contracts containing the OTC instrument logic. Any OTC contract using DTD must have **CONTRACT_ROLE** in DTD to be able to call the required functions.

The penalty margin does not need to be equal to both sides, e.g., for non-deliverable swap instrument the short party needs to have high enough penalty margin to ensure that long party feels that short party won't bail out immediately if volatility moves against seller.

# DTDEngine

Key methods for contract administration:

| Method                  | Description                                          |
| :---------------------- | :--------------------------------------------------- |
| **modfiyPauseStatus()** | Only DTD admin can call this to pause / un-pause DTD |
| **grantRole()**         | To grant roles e.g. for OTC contract logic           |

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

Let's assume that there is a smart contract implementing non-deliverable swap (NDS) using DTD to manage clearing and settlement between the counterparties. NDS is an OTC instrument in foreign exchange markets used to hedge exposure against non-convertible currencies such as Indonesian rupiah, Korean won or Taiwanese dollar. It can be considered similar to multpile forward transactions with the difference that there is no settlement in the non-convertible currency. Instead, the whole transaction is settled in a convertible currency such as USD or EUR.

Let's assume two parties want to engage in NDS transaction, which is settled in USDC and the underlying non-convertible currency is Korean won (KRW). The NDS contract reads the rate using Chainlink oracle's stream and the counterparties agree on following terms:

- Amount of underlying, KRW: 10 000 000 (around 7900 USD)
- Agreed exchange rate KRW / USD: 0.00079
- Contract duration: 30 days
- Penalty margin: 500 USD for both parties

To represent USD, both parties deposit USDC in their vaults and use the token as a proxy to USD. The counterparty creating the OTC contract terms and being the seller (short party) posts the penalty margin and ensures to have enough deposit balance to not default if exchange rate moves against. After that the buyer (long party) locks the contract, deposits the penalty margin and makes sure to enough USDC in vault to weather volatility. The contract is now in effect.

Either party can call DTD's mark-to-market functionality at will during contract's duration to ensure that enough margin is secured by the counterparties. Note that NDS contract logic can set limits on how often the contract can be marked to market (say e.g. once per hour). As an example, if the exchange rate goes up to 0.0008 and it is marked to market, then minimum margin level of short party's vault is increased by 100 USDC (8000 USDC - 7900 USDC). Similarly, if the rate drops to 0.00076 the minimum margin level of short party is increased by 300 USDC.

The rate fluctuates during the 30-day period and the counterparties keep on marking the contract value to market to reserve other counterparty vault's USDC tokens in case they default.

If default doesn't happen to either party, then after 30 days the next time mark-to-market is done the NDS contract tells DTD to settle the contract. DTD moves the USDC according to final exchange rate to the winning party and releases the penalty margins back to the vaults of both parties by decreasing the minimum margin levels of both vaults by 500 USD.

In case the default happens, i.e. contract is marked to market and the minimum margin level of a vault would go over the deposit balance, DTD moves the penalty margin plus the reserved margin to an extent it can to the winning party. After that the contract is deleted and it is settled.

Note that critical part when negotiating any OTC contract is setting the penalty margin a) high enough to ensure that neither party wants to default and are motivated to increase the deposit balance of their vault in case default is about to happen and b) not setting the penalty margin too high to ensure that the contract is capital efficient.

## Potential Improvements

- Novation process: Enable transferring counterparty position to a new party (if allowed by contract)
- Provide netting to "stack" the marking-to-market of all contracts between two counterparties
- Provide portfolio margining for increasing capital efficiency or for simply notifying parties of potential defaulting
- Separate collateral (penalty margin) and the traded value from each other. Now they both use same token
- Allow e.g. NFTs representing real world assets or stakes on lending pools to be used as collateral
- Enable swapping collateral to another (if allowed by contract)
- Trade compression: Terminate offsetting contracts among two or more participants or replace them with smaller netted out contracts

# References

[1] "Implementing a financial derivative as smart contract" (2019) - Christian Fries et al
https://arxiv.org/pdf/1903.00067.pdf

[2] "OTC Derivatives: Bilateral Trading and Central Clearing: An Introduction to Regulatory Policy, Market Impact and Systemic Risk" (2013) - David Murphy

[3] "Collateral Management: A Guide to Mitigating Counterparty Risk" (2019) - Michael Simmons

[4] "Bank For International Settlements: OTC Derivatives Settlement Procedures and Counterparty Risk Management" (1998)
https://www.bis.org/cpmi/publ/d27.pdf

[5] "ISDA Whitepaper: Smart Derivatives Contracts: From Concept to Construction" (2018)
https://www.isda.org/a/cHvEE/Smart-Derivatives-Contracts-From-Concept-to-Construction-Oct-2018.pdf

[6] "EIP 6123: Smart Derivative Contract" - Christian Friest et al
https://github.com/ethereum/EIPs/blob/master/EIPS/eip-6123.md
