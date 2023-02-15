# Tentσ

This repository contains various EVM smart contract projects:

- **DTDEngine**: Decentralised Token Depository smart contract to help clearing and settling bespoke bilateral OTC instruments between counterparties
- **Index**: Smart contract for creating and tracking indices to measure the performance of underlying(s). The source for an index can be e.g. a single price index of an asset or multiple assets (basket). The index value can be spot price, best-of / worst-of / average in baskets or a path-dependent measure calculated from multiple source values (e.g. variance or TWAP).
- **OTCContractBase**: Base contract implementation for developing different kinds of OTC instruments. Uses **DTDEngine** for clearing & settlement and **Index** for tracking the performance.
- **OTCContracts**: Implementations of several different OTC instruments such as non-deliverable swaps and (exotic) options (Note: Work in progress)
