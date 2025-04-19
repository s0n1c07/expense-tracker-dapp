# Expense Tracker Dapp

This is a decentralized application (Dapp) for managing user registrations, debts, and transactions on the Ethereum blockchain. Users can view registered names, manage their debts, and settle payments easily through MetaMask.

---

## New Features Added

- **Get Total Number of Registered Users:**  
  Retrieve and display the total number of users who have registered on the platform.

- **Update User Name:**  
  Allow users to update their registered name on the blockchain.

- **Display Connected Wallet Address:**  
  Show the address of the currently connected Ethereum wallet.

- **Display Total Registered Users:**  
  Fetch and display the total number of users on the platform.

- **Show Current User’s Registered Name:**  
  Fetch and show the user's saved name from the blockchain.

- **Debt Reminder and Settle Prompt:**  
  Notify users if they owe any payments and allow them to settle directly through MetaMask with a simple prompt.

- **ETH/INR Toggle:**  
  Allow users to view monetary values in both ETH and approximate INR by fetching the real-time exchange rate from an API.

---

## Code Fixes Made

- Fixed issues with wallet reconnection on page reload.
- Corrected smart contract interaction methods to support updated user registration and updating names.
- Handled error states when a user is not yet registered.
- Improved UI handling for displaying debt notifications dynamically.
- Implemented real-time ETH to INR conversion using an external API.

---

## Project Structure

- `App.js` — Front-end logic handling MetaMask connection, blockchain interactions, user registration, debt reminders, and ETH/INR toggle.
- `Contract.sol` — Solidity smart contract code handling user data, debt tracking, and payment functions.
---

## How to Run the Dapp

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/expense-manager-dapp.git
   cd expense-manager-dapp

2. Install dependencies:
    npm install

3. Start the project:
    npm run dev
    
4. Connect your MetaMask wallet and interact with the app.