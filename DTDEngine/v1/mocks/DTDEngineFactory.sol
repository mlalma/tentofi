// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import "../contracts/DTDEngine.sol";

contract DTDEngineFactory {
	address public lastEngine;

	function deployEngine() external {
		DTDEngine engine = new DTDEngine();
		lastEngine = address(engine);
	}

	function setPaused(address dtdEngine, bool paused) external {
		DTDEngine(dtdEngine).modifyPauseStatus(paused);
	}
}
