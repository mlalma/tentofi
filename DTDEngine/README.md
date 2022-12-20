# Decentralized Token Depositoty

Decentralized Token Repository (DTD) is used for managing bilateral over-the-counter derivatives contracts.

It handles initiation, clearing and settelement of the contracts while trying to minimize the counterparty risk for participants.

## Introduction

## Example

## Considerations

## Potential Major Improvements

* Novation process: Enable transferring counterparty position to a new party (if allowed by contract)
* Provide netting to "stack" the marking-to-market of all contracts between two counterparties
* Provide portfolio margining for increasing capital efficiency or for simply notifying parties of potential defaulting
* Separate collateral (penalty margin) and the traded value from each other. Now they both use same token
* Allow e.g. NFTs representing real world assets or stakes on lending pools to be used as collateral
* Enable swapping collateral (if allowed by contract)
* Trade compression: Terminate offsetting contracts among two or more participants or replace them with smaller netted out contracts.
