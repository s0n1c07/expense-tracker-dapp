import React, { useState, useEffect } from "react";
import { ethers } from "ethers"; // Library for interacting with Ethereum blockchain
import "./App.css";
import ExpenseTrackerABI from "./ExpenseTrackerABI.json"; // This contains information about how to talk to our smart contract

function App() {
  // --- VARIABLES STORED IN THE COMPONENT (STATE) ---
  // These variables can change and when they do, the page will update
  const [showOverdueBox, setShowOverdueBox] = useState(false);
  const [overdueDebts, setOverdueDebts] = useState([]);
  const [isTxPending, setIsTxPending] = useState(false);
  const [totalRegistered, setTotalRegistered] = useState(0);
  const [ethInr, setEthInr] = useState(0);
  const [showInINR, setShowInINR] = useState(false);
  const [provider, setProvider] = useState(null); // Connection to the Ethereum network
  const [contract, setContract] = useState(null); // Our expense tracker smart contract
  const [account, setAccount] = useState(""); // User's Ethereum wallet address
  const [isConnected, setIsConnected] = useState(false); // Whether user connected their wallet
  const [isRegistered, setIsRegistered] = useState(false); // Whether user registered their name
  const [name, setName] = useState(""); // User's name
  const [expenses, setExpenses] = useState([]); // List of all expenses
  const [people, setPeople] = useState([]); // List of all registered people
  const [loadingExpenses, setLoadingExpenses] = useState(false); // Whether expenses are being loaded
  const [expenseLabel, setExpenseLabel] = useState(""); // Description for a new expense
  const [participants, setParticipants] = useState([
    { address: "", amountPaid: 0, amountOwed: 0 },
  ]); // People involved in a new expense
  const [showAddExpense, setShowAddExpense] = useState(false); // Whether to show the "Add Expense" form
  const contractAddress = "0x98BEEBB0d66B7F78CF69C5902C2Bd3110b4b484E"; // Paste the address recieved from Remix IDE here

  // --- RUNS WHEN THE PAGE FIRST LOADS ---
  // This connects to the user's Ethereum wallet (like MetaMask)
  useEffect(() => {
    const init = async () => {
      // Check if MetaMask (or similar wallet) is installed
      if (window.ethereum) {
        try {
          // Ask user permission to connect to their wallet
          await window.ethereum.request({ method: "eth_requestAccounts" });
          // Create a connection to Ethereum
          const providerInstance = new ethers.providers.Web3Provider(
            window.ethereum
          );
          setProvider(providerInstance);

          // Check if user is on the right Ethereum network (Sepolia test network)
          const network = await providerInstance.getNetwork();
          if (network.chainId !== 11155111) {
            // 11155111 is the ID for Sepolia testnet
            alert("Please connect to Sepolia testnet.");
            return;
          }

          // Get user's account and save it
          const signer = providerInstance.getSigner();
          const address = await signer.getAddress();
          setAccount(address);
          setIsConnected(true);

          // Connect to our expense tracker smart contract
          const contractInstance = new ethers.Contract(
            contractAddress,
            ExpenseTrackerABI,
            signer
          );
          setContract(contractInstance);

          // Listen for user changing their account in MetaMask
          window.ethereum.on("accountsChanged", (accounts) => {
            setAccount(accounts[0] || "");
            setIsConnected(accounts.length > 0);
          });
        } catch (error) {
          console.error("Initialization error:", error);
        }
      } else {
        // If MetaMask is not installed
        alert("Please install MetaMask.");
      }
    };

    init(); // Run the initialization function

    // Clean up when component unmounts (good practice to prevent memory leaks)
    return () => {
      if (window.ethereum) {
        window.ethereum.removeAllListeners("accountsChanged");
      }
    };
  }, []); // Empty array means this runs only once when page loads

  const loadTotalRegistered = async () => {
    if (!contract) return;
    try {
      const total = await contract.getTotalRegisteredPeople();
      console.log("Total registered from contract:", total.toNumber()); // <--- DEBUG LOG
      setTotalRegistered(total.toNumber());
    } catch (error) {
      console.error("Error fetching total registered people:", error);
    }
  };
  // --- RUNS WHEN CONTRACT OR ACCOUNT CHANGES ---
  // Checks if user is registered and loads their data
  useEffect(() => {
    const checkRegistration = async () => {
      if (!contract || !account) return; // Skip if contract or account isn't ready

      try {
        // Ask the contract if this user is registered
        const person = await contract.getPerson(account);
        const registered =
          person.walletAddress !== ethers.constants.AddressZero;
        setIsRegistered(registered);

        if (registered) {
          setName(person.name); // Save the user's name
          await loadExpenses(); // Load all expenses
          await loadPeople();
          await loadTotalRegistered(); // ✅ Make sure this is called!
        }
      } catch (error) {
        console.error("Error checking registration:", error);
      }
    };
    checkRegistration();
  }, [contract, account]); // Run this when contract or account changes
  useEffect(() => {
    const fetchPeopleAndCount = async () => {
      if (!contract) return;
      try {
        const addresses = await contract.getAllRegisteredPeople();
        const peopleData = await Promise.all(
          addresses.map(async (address) => {
            const [name, _] = await contract.getPerson(address); // We don't use netBalance here
            return {
              address,
              name,
            };
          })
        );
        setPeople(peopleData);
        setTotalRegistered(peopleData.length);
      } catch (error) {
        console.error("Failed to load people and total count", error);
      }
    };

    fetchPeopleAndCount();
  }, [contract]);

  useEffect(() => {
    const fetchETHINR = async () => {
      try {
        const response = await fetch(
          "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=inr"
        );
        const data = await response.json();
        setEthInr(data.ethereum.inr);
      } catch (error) {
        console.error("Failed to fetch ETH-INR rate:", error);
      }
    };

    fetchETHINR();
  }, []);

  // --- REGISTER NEW USER ---
  // Saves user's name to the blockchain
  const registerPerson = async () => {
    if (!name.trim()) {
      alert("Please enter your name.");
      return;
    }
    try {
      setIsTxPending(true); // 🚀 Start animation
      const tx = await contract.registerPerson(name.trim());
      await tx.wait(); // Wait for confirmation
      setIsRegistered(true);
      alert("Registration successful!");
      await loadPeople();
      await loadExpenses();
      await loadTotalRegistered();
    } catch (error) {
      console.error("Registration failed:", error);
      alert(`Registration failed: ${error.message}`);
    } finally {
      setIsTxPending(false); // 🛑 Stop animation
    }
  };
  const updateName = async () => {
    if (!name.trim()) {
      alert("Please enter a valid name.");
      return;
    }

    try {
      setIsTxPending(true);
      const tx = await contract.updateName(name.trim());
      await tx.wait();
      alert("Name updated successfully!");
      await loadPeople(); // refresh people list
    } catch (error) {
      console.error("Name update failed:", error);
      alert(`Update failed: ${error.message}`);
    } finally {
      setIsTxPending(false);
    }
  };

  // --- LOAD ALL EXPENSES ---
  // Gets all expenses from the blockchain
  const loadExpenses = async () => {
    if (!contract || !isRegistered) return; // Skip if not ready
    setLoadingExpenses(true); // Show loading indicator
    try {
      // Get the total number of expenses
      const count = await contract.expenseCount();
      const loaded = [];

      // Loop through each expense and load its details
      for (let i = 0; i < count; i++) {
        try {
          // Get basic expense info
          const [id, label, timestamp] = await contract.getExpenseBasicInfo(i);
          // Get list of addresses involved in this expense
          const participantsAddresses = await contract.getExpenseParticipants(
            i
          );

          // For each participant, get how much they paid and owe
          const participantsData = await Promise.all(
            participantsAddresses.map(async (address) => {
              try {
                const amountPaid = await contract.getAmountPaid(i, address);
                const amountOwed = await contract.getAmountOwed(i, address);
                return {
                  address,
                  amountPaid: ethers.utils.formatEther(amountPaid), // Convert from wei to ETH
                  amountOwed: ethers.utils.formatEther(amountOwed), // Convert from wei to ETH
                };
              } catch (error) {
                console.error(
                  `Error loading amounts for participant ${address}:`,
                  error
                );
                return { address, amountPaid: "0", amountOwed: "0" };
              }
            })
          );

          // Add this expense to our list
          loaded.push({
            id: id.toNumber(), // Convert from BigNumber to regular number
            label,
            timestamp: new Date(timestamp.toNumber() * 1000).toLocaleString(), // Convert timestamp to readable date
            participants: participantsData,
          });
        } catch (error) {
          console.error(`Error loading expense ${i}:`, error);
        }
      }

      setExpenses(loaded); // Save all expenses to state
    } catch (error) {
      console.error("Error loading expenses:", error);
      alert("Could not load expenses. Check console.");
    } finally {
      setLoadingExpenses(false); // Hide loading indicator
    }
  };

  const loadOverdueDebts = async () => {
    if (!contract || !account) return;
    try {
      const [creditors, _, daysOld] = await contract.getOverdueDebts(account); // Ignore 'amounts' now

      // Fetch debtor's net balance
      const netBalance = await contract.getNetBalance(account);
      const formattedNetBalance = ethers.utils.formatEther(netBalance);

      const debts = creditors.map((creditor, idx) => ({
        creditor,
        amount: Math.abs(formattedNetBalance), // ✅ use debtor's net balance as amount
        daysOld: daysOld[idx].toNumber(),
      }));

      setOverdueDebts(debts);
      setShowOverdueBox(true);

      setTimeout(promptAutoSettle, 1000); // small delay so UI is ready
    } catch (error) {
      console.error("Error loading overdue debts:", error);
    }
  };

  const promptAutoSettle = async () => {
    if (!contract || !account || overdueDebts.length === 0) return;

    for (const debt of overdueDebts) {
      if (debt.daysOld > 7) {
        const shouldSettle = window.confirm(
          `You owe ${debt.amount} ETH to ${debt.creditor.substring(
            0,
            8
          )}... for ${debt.daysOld} days.\nDo you want to settle now?`
        );
        if (shouldSettle) {
          try {
            setIsTxPending(true);
            const tx = await provider.getSigner().sendTransaction({
              to: debt.creditor,
              value: ethers.utils.parseEther(debt.amount),
            });
            await tx.wait();
            alert(
              `Successfully paid ${
                debt.amount
              } ETH to ${debt.creditor.substring(0, 8)}...!`
            );
            await loadOverdueDebts(); // Refresh the overdue debts list
          } catch (error) {
            console.error("Error during auto-settle payment:", error);
            alert(`Payment failed: ${error.message}`);
          } finally {
            setIsTxPending(false);
          }
        }
      }
    }
  };

  // --- LOAD ALL REGISTERED PEOPLE ---
  // Gets list of all registered users
  const loadPeople = async () => {
    if (!contract) return; // Skip if contract isn't ready
    try {
      // Get all registered addresses
      const addresses = await contract.getAllRegisteredPeople();
      // For each address, get their name and balance
      const peopleData = await Promise.all(
        addresses.map(async (address) => {
          const person = await contract.getPerson(address);
          const netBalance = await contract.getNetBalance(address);
          return {
            address,
            name: person.name,
            netBalance: ethers.utils.formatEther(netBalance), // Convert from wei to ETH
          };
        })
      );
      setPeople(peopleData); // Save people to state
      console.log("People List:", people);
    } catch (error) {
      console.error("Error loading people:", error);
    }
  };
  // --- ADD NEW EXPENSE ---
  // Creates a new expense on the blockchain
  const addExpense = async () => {
    // Input validation
    if (!expenseLabel.trim()) {
      alert("Enter an expense label.");
      return;
    }
    if (participants.length === 0) {
      alert("Add at least one participant.");
      return;
    }

    for (const participant of participants) {
      if (
        !participant.address ||
        participant.amountPaid < 0 ||
        participant.amountOwed < 0
      ) {
        alert("Participant details are invalid.");
        return;
      }
    }

    try {
      setIsTxPending(true); // 🚀 Start the animation

      // Prepare data for the smart contract
      const addresses = participants.map((p) => p.address.trim());
      const paidAmounts = participants.map((p) =>
        ethers.utils.parseEther(p.amountPaid.toString())
      ); // Convert ETH to wei
      const owedAmounts = participants.map((p) =>
        ethers.utils.parseEther(p.amountOwed.toString())
      ); // Convert ETH to wei

      // Call the addExpense function in our smart contract
      const tx = await contract.addExpense(
        expenseLabel,
        addresses,
        paidAmounts,
        owedAmounts
      );
      await tx.wait(); // Wait for transaction to be confirmed

      // Reset form and reload data
      setExpenseLabel("");
      setParticipants([{ address: "", amountPaid: 0, amountOwed: 0 }]);
      setShowAddExpense(false);
      await loadExpenses();
      await loadPeople();
    } catch (error) {
      console.error("Error adding expense:", error);
      alert(`Error: ${error.message}`);
    } finally {
      setIsTxPending(false); // 🛑 Stop the animation
    }
  };

  // --- HELPER FUNCTIONS FOR PARTICIPANTS ---
  // Add a new participant row to the form
  const addParticipant = () => {
    setParticipants([
      ...participants,
      { address: "", amountPaid: 0, amountOwed: 0 },
    ]);
  };

  // Update a participant's information
  const updateParticipant = (index, field, value) => {
    const updated = [...participants];
    updated[index][field] = value;
    setParticipants(updated);
  };

  // Remove a participant from the form
  const removeParticipant = (index) => {
    if (participants.length > 1) {
      setParticipants(participants.filter((_, i) => i !== index));
    }
  };

  // --- THE PAGE LAYOUT (USER INTERFACE) ---
  return (
    <div className={`App ${isTxPending ? "tx-pending-border" : ""}`}>
      <header className="App-header">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            width: "100%",
          }}
        >
          <h1>On-Chain Expense Tracker</h1>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              // border: "2px solid #ccc",
              borderRadius: "5px",
              padding: "5px 10px",
              backgroundColor: "darkcyan",
            }}
          >
            <p style={{ fontSize: "1rem", color: "#333", margin: 0 }}>
              Total Users: {people.length}
            </p>
          </div>
        </div>

        {/* STEP 1: CONNECT WALLET - Show if not connected */}
        {!isConnected ? (
          <button
            onClick={() =>
              window.ethereum.request({ method: "eth_requestAccounts" })
            }
          >
            Connect Wallet
          </button>
        ) : /* STEP 2: REGISTER - Show if connected but not registered */
        !isRegistered ? (
          <div>
            <h2>Register</h2>
            <input
              type="text"
              placeholder="Your Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <button onClick={registerPerson}>Register</button>
          </div>
        ) : (
          /* STEP 3: MAIN APP - Show if connected and registered */
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <h1 style={{ margin: 0, color: "white" }}>Welcome, {name}</h1>
              <button
                onClick={() => {
                  const newName = prompt("Enter your new name:", name);
                  if (newName && newName.trim() !== "" && newName !== name) {
                    setName(newName.trim());
                    updateName(); // This calls your smart contract update
                  }
                }}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                }}
                title="Edit your name"
              >
                <img
                  src="https://cdn-icons-png.flaticon.com/512/84/84380.png"
                  alt="Edit"
                  style={{ width: "18px", height: "18px", filter: "invert(1)" }}
                />
              </button>
            </div>

            <p>Connected Wallet: {account}</p>
            <button onClick={() => setShowAddExpense(!showAddExpense)}>
              {showAddExpense ? "Cancel" : "Add Expense"}
            </button>
            <button onClick={loadExpenses}>Show Expenses</button>

            {/* ADD EXPENSE FORM - Show when "Add Expense" is clicked */}
            {showAddExpense && (
              <div>
                <h3>New Expense</h3>
                <input
                  type="text"
                  placeholder="Expense Label"
                  value={expenseLabel}
                  onChange={(e) => setExpenseLabel(e.target.value)}
                />
                {/* For each participant, show input fields */}
                {participants.map((p, idx) => (
                  <div key={idx}>
                    <input
                      placeholder="Address"
                      value={p.address}
                      onChange={(e) =>
                        updateParticipant(idx, "address", e.target.value)
                      }
                    />
                    <input
                      type="number"
                      min="0"
                      placeholder="Paid"
                      value={p.amountPaid || ""}
                      onChange={(e) =>
                        updateParticipant(
                          idx,
                          "amountPaid",
                          Math.max(0, Number(e.target.value))
                        )
                      }
                    />
                    <input
                      type="number"
                      min="0"
                      placeholder="Owed"
                      value={p.amountOwed || ""}
                      onChange={(e) =>
                        updateParticipant(
                          idx,
                          "amountOwed",
                          Math.max(0, Number(e.target.value))
                        )
                      }
                    />

                    <button onClick={() => removeParticipant(idx)}>
                      Remove
                    </button>
                  </div>
                ))}
                <button onClick={addParticipant}>Add Participant</button>
                <button onClick={addExpense}>Save Expense</button>
              </div>
            )}

            {/* PEOPLE LIST - Show all registered users */}
            <h3>People</h3>
            <table style={{ borderCollapse: "collapse", margin: "10px 0" }}>
              <thead>
                <tr>
                  <th style={{ padding: "8px", border: "1px solid #ddd" }}>
                    Name
                  </th>
                  <th style={{ padding: "8px", border: "1px solid #ddd" }}>
                    Address
                  </th>
                  <th style={{ padding: "8px", border: "1px solid #ddd" }}>
                    Net Balance
                  </th>
                </tr>
              </thead>
              <tbody>
                {people.map((person, idx) => (
                  <tr key={idx}>
                    <td style={{ padding: "8px", border: "1px solid #ddd" }}>
                      {person.name}
                    </td>
                    <td style={{ padding: "8px", border: "1px solid #ddd" }}>
                      {person.address.substring(0, 8)}...
                    </td>
                    <td
                      style={{
                        padding: "8px",
                        border: "1px solid #ddd",
                        color:
                          parseFloat(person.netBalance) < 0 ? "red" : "green",
                      }}
                    >
                      {parseFloat(person.netBalance).toFixed(5)} ETH
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* <p>Connected Wallet: {account}</p> */}
            {/* <p>Total Registered Users: {people.length}</p> */}

            {/* EXPENSE HISTORY - Show all expenses */}
            <h2>
              Expense History
              <button onClick={() => setShowInINR(!showInINR)}>
                Show in {showInINR ? "ETH" : "INR"}
              </button>
              <button onClick={loadOverdueDebts}>Show Overdue Debts</button>
            </h2>
            <p style={{ fontSize: "0.9em", color: "white" }}>
              1 ETH ≈ ₹{ethInr.toLocaleString("en-IN")}
            </p>
            {showOverdueBox && (
              <div
                style={{
                  margin: "20px 0",
                  padding: "10px",
                  border: "1px solid #ddd",
                  backgroundColor: "rgba(34, 34, 34, 0.7)",
                  borderRadius: "8px",
                  boxShadow: "0 4px 8px rgba(0,0,0,0.3)",
                }}
              >
                <h3 style={{ color: "white" }}>Overdue Debts</h3>

                {overdueDebts.length === 0 ? (
                  <p style={{ color: "lightgreen", fontWeight: "bold" }}>
                    🎉 No overdue payments! All clear!
                  </p>
                ) : (
                  <ul style={{ listStyle: "none", padding: 0 }}>
                    {overdueDebts.map((debt, idx) => (
                      <li
                        key={idx}
                        style={{ color: "white", marginBottom: "8px" }}
                      >
                        <strong>Creditor:</strong>{" "}
                        {debt.creditor.substring(0, 8)}
                        ... |<strong> Amount:</strong>{" "}
                        {showInINR
                          ? `₹${(
                              parseFloat(debt.amount) * ethInr
                            ).toLocaleString("en-IN", {
                              maximumFractionDigits: 2,
                            })}`
                          : ` ${debt.amount} ETH `}
                        |<strong> Days Old:</strong> {debt.daysOld} days
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {loadingExpenses ? (
              <p>Loading...</p>
            ) : (
              expenses.map((expense) => (
                <div
                  key={expense.id}
                  style={{
                    border: "1px solid #ddd",
                    margin: "10px 0",
                    padding: "10px",
                  }}
                >
                  <h4>{expense.label}</h4>
                  <p>{expense.timestamp}</p>
                  <table style={{ borderCollapse: "collapse", width: "100%" }}>
                    <thead>
                      <tr>
                        <th
                          style={{ padding: "5px", border: "1px solid #ddd" }}
                        >
                          Participant
                        </th>
                        <th
                          style={{ padding: "5px", border: "1px solid #ddd" }}
                        >
                          Paid
                        </th>
                        <th
                          style={{ padding: "5px", border: "1px solid #ddd" }}
                        >
                          Owes
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {expense.participants.map((p, idx) => (
                        <tr key={idx}>
                          <td
                            style={{ padding: "5px", border: "1px solid #ddd" }}
                          >
                            {/* Show name if found, otherwise show shortened address */}
                            {people.find(
                              (person) => person.address === p.address
                            )?.name || p.address.substring(0, 8)}
                          </td>
                          <td
                            style={{ padding: "5px", border: "1px solid #ddd" }}
                          >
                            {showInINR
                              ? `₹${(
                                  parseFloat(p.amountPaid) * ethInr
                                ).toLocaleString("en-IN", {
                                  maximumFractionDigits: 2,
                                })}`
                              : `${p.amountPaid} ETH`}
                          </td>
                          <td
                            style={{ padding: "5px", border: "1px solid #ddd" }}
                          >
                            {showInINR
                              ? `₹${(
                                  parseFloat(p.amountOwed) * ethInr
                                ).toLocaleString("en-IN", {
                                  maximumFractionDigits: 2,
                                })}`
                              : `${p.amountOwed} ETH`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))
            )}
          </div>
        )}
      </header>
    </div>
  );
}

export default App;
