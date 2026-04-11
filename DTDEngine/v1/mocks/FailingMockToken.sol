// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract FailingMockToken is ERC20 {
	bool public failTransfer;
	bool public failTransferFrom;

	constructor() ERC20("FailingMockToken", "FAIL") {}

	function faucet(uint256 amount) external {
		_mint(msg.sender, amount);
	}

	function setFailTransfer(bool shouldFail) external {
		failTransfer = shouldFail;
	}

	function setFailTransferFrom(bool shouldFail) external {
		failTransferFrom = shouldFail;
	}

	function transfer(address to, uint256 value) public override returns (bool) {
		if (failTransfer) {
			return false;
		}
		return super.transfer(to, value);
	}

	function transferFrom(address from, address to, uint256 value) public override returns (bool) {
		if (failTransferFrom) {
			return false;
		}
		return super.transferFrom(from, to, value);
	}
}
