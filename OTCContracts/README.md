# OTC Contracts

This project contains various contracts that implement different OTC financial instruments. The contracts heavily rely on other Tentσ projects for the key parts of functionality: **DTDEngine** for clearing & settlement, **Index** for pricing and **OTCContractBase** for base functionality used across all OTC contracts.

## Non-Deliverable Swap

Contract for implementing a standard Non-Deliverable Swap instrument (NDS). This is a standard contract that can be used to implement whole lot of different variations of the swap instrument depending on the used index, fixing style and collateral calculation. With the right set of data sources, the contract can be used to create standard interest rate swaps, basket swaps in various forms (e.g. best-of or worst-of) and even volatility / variance / correlation swaps.

## Non-Deliverable Option

Non-Deliverable Option (NDO) works like a standard option, but it is cash-settled at maturity. Seller (short) takes risk as a considerable price move can cause significant loss. Currently supported are European put and call options. The option strike and valuation can be based on the absolute value of a single asset (vanilla option), average value of an asset during the lifetime of the option (Asian option) or best-of / worst-of / average value of basket of assets (basket option).
