# OTC Contracts

This project contains various contracts that implement different OTC financial instruments. The contracts heavily rely on other Tentσ projects for the key parts of functionality: **DTDEngine** for clearing & settlement, **Index** for pricing and **OTCContractBase** for base functionality used across all OTC contracts.

## Non-Deliverable Swap

Contract for implementing a standard Non-Deliverable Swap instrument (NDS). This is a standard contract that can be used to implement whole lot of different variations of the swap instrument depending on the used index, fixing style and collateral calculation. With the right set of data sources, the contract can be used to create standard interest rate swaps, basket swaps in various forms (e.g. best-of or worst-of) and even volatility / variance / correlation swaps.

## Non-Deliverable Option

Non-Deliverable Option (NDO) works like a vanilla option, but it is cash-settled at maturity...(Note: Rest to be written after implementation completed)
