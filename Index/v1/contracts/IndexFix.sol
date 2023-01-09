// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "../interfaces/IIndexFix.sol";

// "No fix" index fix: The strikes are fixed based on fix parameters
contract NoFix is IIndexFix {
	constructor() {}

	function fixStrikes(AggregatorV3Interface[] calldata oracles, int256[] calldata fixParams)
		external
		pure
		returns (int256[] memory strikes)
	{
		require(fixParams.length == oracles.length);
		return fixParams;
	}
}

// "Spotfix" index fix: The strikes are fixed to current spot prices
contract SpotFix is IIndexFix {
	constructor() {}

	function fixStrikes(
		AggregatorV3Interface[] calldata oracles,
		int256[] calldata /*fixParams*/
	) public view virtual returns (int256[] memory strikes) {
		strikes = new int256[](oracles.length);
		for (uint256 i = 0; i < oracles.length; i++) {
			(, int256 price, , , ) = oracles[i].latestRoundData();
			strikes[i] = price;
		}
	}
}

// "Spotfix-plus" index fix: The strikes are spots plus a constant per strike
contract SpotFixPlus is SpotFix {
	constructor() SpotFix() {}

	function fixStrikes(AggregatorV3Interface[] calldata oracles, int256[] calldata fixParams)
		public
		view
		override
		returns (int256[] memory strikes)
	{
		strikes = super.fixStrikes(oracles, fixParams);
		require(strikes.length == fixParams.length);
		for (uint256 i = 0; i < strikes.length; i++) {
			strikes[i] += fixParams[i];
		}
	}
}

// "Spotfix-mul" index fix: The strikes are spots times a constant per strike. Constant must be in 240.16 fixed point format
contract SpotFixMul is SpotFix {
	constructor() SpotFix() {}

	function fixStrikes(AggregatorV3Interface[] calldata oracles, int256[] calldata fixParams)
		public
		view
		override
		returns (int256[] memory strikes)
	{
		strikes = super.fixStrikes(oracles, fixParams);
		require(strikes.length == fixParams.length);
		for (uint256 i = 0; i < strikes.length; i++) {
			strikes[i] = (strikes[i] * fixParams[i]) >> 16;
		}
	}
}

// "Spotfix-mul-plus" index fix: The strikes are spots times a constant per strike plus constant. Mul number must be in 240.16 fixed point format
// The order in fixParams is [mul for strike 0, add for strike 0, mul for strike 1, add for strike 1, ...]
contract SpotFixMulPlus is SpotFix {
	constructor() SpotFix() {}

	function fixStrikes(AggregatorV3Interface[] calldata oracles, int256[] calldata fixParams)
		public
		view
		override
		returns (int256[] memory strikes)
	{
		strikes = super.fixStrikes(oracles, fixParams);
		require(2 * strikes.length == fixParams.length);
		for (uint256 i = 0; i < strikes.length; i++) {
			strikes[i] = fixParams[i * 2 + 1] + ((strikes[i] * fixParams[i * 2]) >> 16);
		}
	}
}
