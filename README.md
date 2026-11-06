# Milestone crowdfunding

A React and Vite frontend for the milestone-based crowdfunding contract. The local demo deploys the contract to a Hardhat blockchain, seeds a sample campaign, and starts the frontend.

## Run the demo

1. Install [Node.js](https://nodejs.org/) 20 or newer.
2. From this folder, run `npm install`.
3. Run `npm run dev` (or `npm run demo`) and open [http://127.0.0.1:5173](http://127.0.0.1:5173). Both commands start the local blockchain, deploy and seed the contract, and launch the frontend.
4. Stop the local blockchain and frontend together with `Ctrl+C`.

The demo wallet is a local Hardhat development account. Its test funds are not real cryptocurrency. To use MetaMask, connect it to the local Hardhat network (chain ID `31337`) and select one of its local development accounts.

The app opens with separate User Login and Admin Login choices. Admin Login checks the local deployer wallet and is the only role allowed to create projects; the contract enforces this rule. Published campaigns are stored on the shared blockchain and appear in the user campaign feed. Users accept a campaign first and can then optionally contribute. The admin dashboard polls the blockchain for acceptance and contribution events and shows them as notifications. Without a wallet extension, User Login lets you choose between separate local Hardhat test accounts. These browser-side checks are for the demo only; production use requires server-side authentication and authorization.

## Verify changes

- `npm test` runs the Solidity contract tests.
- `npm run build` creates a production frontend build in `dist/`.
