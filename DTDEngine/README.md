# Decentralized Token Depositoty

Decentralized Token Repository (DTD) is used for managing bilateral over-the-counter derivatives contracts.

It handles initiation, clearing and settelement of the contracts while trying to minimize the counterparty risk for participants.

## Introduction

The penalty margin does not need to be equal to both sides, e.g. for non-deliverable option instrument the short party needs to have high enough penalty margin to ensure that long party feels that short party won't bail out immediately if volatility moves against them.

## Example

Let's assume that there is a smart contract implementing non-deliverable forward (NDF) using DTD to manage clearing and settlement between the counterparties. NDF is a widely-used OTC instrument in foreign exchange markets as an efficient way to hedge exposure against non-convertible currencies such as Indonesian rupiah, Korean won or Taiwanese dollar. It is similar to a forward transaction with the difference that there is no settlement in the non-convertible currency. Instead, the whole transaction is settled in a convertible currency such as USD or EUR.

For the sake of this example, let's assume that two parties want to engagne in NDF transaction, which is settled in USDC and the underlying non-convertible currency is Korean won (KRW). The NDF contract reads the rate using Chainlink oracle's stream and the counterparties agree on following terms:

* Amount of underyling, KRW: 10 000 000 (around 7900 USD)
* Agreed exchange rate KRW / USD: 0.00079
* Contract duration: 30 days
* Penalty margin: 500 USD for both parties

To represent USD, both parties deposit USDC in their vaults and use the token as a proxy to USD. The counterparty creating the OTC contract terms and being the seller (short party) posts the penalty margin and ensures that they have enough deposit balance to not default. After that the buyer (long party) locks the contract, deposits the penalty margin and makes sure that they have enough USDC in vault. The contract is now in effect.

Either party can call DTD's mark-to-market functionality at will during contract's duration to ensure that enough margin is secured by the counterparties. Note that NDF contract logic can set limits on how often the contract can be marked to market (say e.g. once per hour). As an example if the exchange rate goes up to 0.0008 and it is marked to market, then minimum margin level of short party's vault is increased by 100 USDC (8000 USDC - 7900 USDC). Similarly if the rate drops to 0.00076 the minimum margin level of short party is increased by 300 USDC.

The rate flunctuates during the 30-day period and the counterparties keep on marking the contract value to market to reserve other counterparty vault's USDC tokens in case they default.

If default doesn't happen to either party then after 30 days the next time mark-to-market is done the NDF contract tells DTD to settle the contract. DTD moves the USDC accoding to final exchange rate to the winning party and releases the penalty margins back to the vaults of both parties by decreasing the minimum margin levels of both vaults by 500 USD.

In case the default happens, i.e. contract is marked to market and the minimum margin level of a vault would go over the deposit balance, DTD moves the penalty margin plus the reserved margin to an extent it can to the winning party. After that the contract is deleted and it is considered to be settled. Note that critical part when negotiating any OTC contract is setting of the penalty margin a) high enough to ensure that neither party wants to default and are motivated to increase the deposit balance of their vault in case default is about to happen and b) not setting the penalty margin too high to ensure that the contract is capital efficient.

## Considerations

## Potential Improvements

* Novation process: Enable transferring counterparty position to a new party (if allowed by contract)
* Provide netting to "stack" the marking-to-market of all contracts between two counterparties
* Provide portfolio margining for increasing capital efficiency or for simply notifying parties of potential defaulting
* Separate collateral (penalty margin) and the traded value from each other. Now they both use same token
* Allow e.g. NFTs representing real world assets or stakes on lending pools to be used as collateral
* Enable swapping collateral to another (if allowed by contract)
* Trade compression: Terminate offsetting contracts among two or more participants or replace them with smaller netted out contracts
