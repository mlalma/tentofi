// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockToken is ERC20 {
	constructor() ERC20("MockToken", "MOCK") {}

	// Anyone can mint some MOCK for themselves
	function faucet(uint256 amount) external {
		_mint(msg.sender, amount);
	}

	// To match USDC decimal count
	function decimals() public view virtual override returns (uint8) {
		return 6;
	}
}
