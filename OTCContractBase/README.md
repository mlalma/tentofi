# OTCContractBase

This project contains utility and base contracts for helping the development of OTC instruments.

## OTCContractBase

Base class from where the OTC instruments can be derived. It contains basic data structure of common elements that all OTC contracts need. It is also deriving from ```IDTDEngineContract```, which ties the derived contracts to using DTD for clearing and settlement.

## Collateral Calculators

When contract is active and it is marked to market, DTD Engine reserves collateral from the losing party's vault to ensure that they will be able to honor the agreement. The amount of collateral that should be reserved depends on multitude of factors such as how volatile the underlying index is, how long the contract still will be in running and how liquid the counterparties are.

The collateral calculation is usually simplified and the project provides two different strategies for managing the amount of value that should be reserved when contract performance is marked to market. First strategy is a flat percentage calculated from the given mark-to-market value and it can between 0% and 100%. The second strategy is linearly increasing collateral reservation with a constant base percentage until the contract is settled.

You can implement new collateralization strategiees by deriving a contract from ```ICollateralCalculator```.
