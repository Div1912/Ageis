"""
AEGIS Vault Contract — AlgoKit smart contract (Puya).

Stores LP position parameters on Algorand Testnet with:
  - Agent key delegation: user signs once, AEGIS agent acts autonomously
  - Vault state: tracks deposited funds (ALGO + USDC)
  - Decision log: on-chain counter + last decision metadata
  - Withdrawal guard: agent can ONLY rebalance, never withdraw

Methods:
  - initialize()          : @create, sets all defaults to 0
  - set_position()        : stores entry price, bounds, and capital (creator only)
  - authorize_agent()     : sets the agent address (creator only)
  - trigger_rebalance()   : updates range, increments counter (creator OR agent)
  - deposit()             : record a deposit of funds (creator only)
  - withdraw()            : withdraw funds (creator only — agent CANNOT call)
  - log_decision()        : store a decision event on-chain (creator or agent)
  - get_position()        : readonly, returns all state fields
  - get_vault_state()     : readonly, returns vault balances + agent info
"""
from algopy import (
    ARC4Contract, UInt64, Txn, Global, Bytes, Account,
    arc4, op, log,
)


class AegisPosition(ARC4Contract):
    """Autonomous Liquidity Position Manager — Vault + Agent Key Delegation."""

    # ── Position state ──
    entry_price: UInt64             # entry ALGO/USDC price scaled x1000
    lower_bound: UInt64             # lower range bound scaled x1000
    upper_bound: UInt64             # upper range bound scaled x1000
    capital_usdc: UInt64            # position capital in cents (USD * 100)
    open_timestamp: UInt64          # unix epoch seconds, set at position open
    total_rebalances: UInt64        # cumulative rebalance counter
    last_rebalance_timestamp: UInt64

    # ── Vault state ──
    deposited_algo: UInt64          # deposited ALGO in microAlgo
    deposited_usdc: UInt64          # deposited USDC in micro-units
    total_deposits: UInt64          # deposit counter
    total_withdrawals: UInt64       # withdrawal counter

    # ── Agent delegation ──
    agent_address: Bytes            # authorized agent public key (32 bytes)
    agent_authorized: UInt64        # 1 if agent is set, 0 otherwise

    # ── Decision log ──
    total_decisions: UInt64         # decision counter
    last_decision_timestamp: UInt64
    last_decision_action: UInt64    # 0=HOLD, 1=REBALANCE, 2=ALERT, 3=SKIP

    @arc4.abimethod(create="require")
    def initialize(self) -> None:
        """Deploy the contract and zero-initialize all state."""
        self.entry_price = UInt64(0)
        self.lower_bound = UInt64(0)
        self.upper_bound = UInt64(0)
        self.capital_usdc = UInt64(0)
        self.open_timestamp = UInt64(0)
        self.total_rebalances = UInt64(0)
        self.last_rebalance_timestamp = UInt64(0)

        self.deposited_algo = UInt64(0)
        self.deposited_usdc = UInt64(0)
        self.total_deposits = UInt64(0)
        self.total_withdrawals = UInt64(0)

        self.agent_address = Bytes(b"")
        self.agent_authorized = UInt64(0)

        self.total_decisions = UInt64(0)
        self.last_decision_timestamp = UInt64(0)
        self.last_decision_action = UInt64(0)

    @arc4.abimethod
    def set_position(
        self,
        entry: UInt64,
        lower: UInt64,
        upper: UInt64,
        capital: UInt64,
    ) -> None:
        """
        Set or update the LP position parameters.
        Only the contract creator may call this method.

        Args:
            entry:   Entry ALGO/USDC price, scaled x1000 (e.g. 172 = $0.172)
            lower:   Lower bound price, scaled x1000
            upper:   Upper bound price, scaled x1000
            capital: Capital in USDC cents (e.g. 500000 = $5000.00)
        """
        assert Txn.sender == Global.creator_address, "Unauthorized"
        self.entry_price = entry
        self.lower_bound = lower
        self.upper_bound = upper
        self.capital_usdc = capital
        self.open_timestamp = Global.latest_timestamp

    @arc4.abimethod
    def authorize_agent(self, agent: Account) -> None:
        """
        Authorize an agent address to call trigger_rebalance and log_decision.
        The agent CANNOT call withdraw, set_position, or authorize_agent.
        Only the contract creator may call this method.

        Args:
            agent: The Algorand address to authorize as the AEGIS agent
        """
        assert Txn.sender == Global.creator_address, "Unauthorized"
        self.agent_address = agent.bytes
        self.agent_authorized = UInt64(1)

    @arc4.abimethod
    def revoke_agent(self) -> None:
        """
        Revoke agent authorization. Only the creator can do this.
        """
        assert Txn.sender == Global.creator_address, "Unauthorized"
        self.agent_address = Bytes(b"")
        self.agent_authorized = UInt64(0)

    @arc4.abimethod
    def trigger_rebalance(
        self,
        new_lower: UInt64,
        new_upper: UInt64,
    ) -> None:
        """
        Execute a range rebalance.
        Updates bounds, increments counter, logs timestamp.
        Can be called by creator OR authorized agent.

        Args:
            new_lower: New lower bound price, scaled x1000
            new_upper: New upper bound price, scaled x1000
        """
        # Allow creator or authorized agent
        is_creator = Txn.sender == Global.creator_address
        is_agent = self.agent_authorized == UInt64(1)
        if is_agent:
            is_agent = Txn.sender == Account(self.agent_address)
        assert is_creator or is_agent, "Unauthorized: not creator or agent"

        self.lower_bound = new_lower
        self.upper_bound = new_upper
        self.total_rebalances = self.total_rebalances + UInt64(1)
        self.last_rebalance_timestamp = Global.latest_timestamp

        # Auto-log the decision
        self.total_decisions = self.total_decisions + UInt64(1)
        self.last_decision_timestamp = Global.latest_timestamp
        self.last_decision_action = UInt64(1)  # 1 = REBALANCE

    @arc4.abimethod
    def deposit(
        self,
        algo_amount: UInt64,
        usdc_amount: UInt64,
    ) -> None:
        """
        Record a deposit of funds into the vault.
        PUBLIC: Any user can deposit into the pool.

        Args:
            algo_amount: ALGO in microAlgo
            usdc_amount: USDC in micro-units
        """
        self.deposited_algo = self.deposited_algo + algo_amount
        self.deposited_usdc = self.deposited_usdc + usdc_amount
        self.total_deposits = self.total_deposits + UInt64(1)

    @arc4.abimethod
    def withdraw(
        self,
        algo_amount: UInt64,
        usdc_amount: UInt64,
    ) -> None:
        """
        Withdraw funds from the vault.
        ONLY the creator can withdraw — agent is explicitly blocked.
        This is the core security guarantee of the AEGIS vault.

        Args:
            algo_amount: ALGO in microAlgo to withdraw
            usdc_amount: USDC in micro-units to withdraw
        """
        # CRITICAL: Only creator can withdraw. Agent key CANNOT withdraw.
        assert Txn.sender == Global.creator_address, "Only creator can withdraw"
        assert algo_amount <= self.deposited_algo, "Insufficient ALGO"
        assert usdc_amount <= self.deposited_usdc, "Insufficient USDC"

        self.deposited_algo = self.deposited_algo - algo_amount
        self.deposited_usdc = self.deposited_usdc - usdc_amount
        self.total_withdrawals = self.total_withdrawals + UInt64(1)

    @arc4.abimethod
    def log_decision(
        self,
        action: UInt64,
    ) -> None:
        """
        Log an agent decision on-chain.
        Can be called by creator or authorized agent.

        Args:
            action: 0=HOLD, 1=REBALANCE, 2=ALERT, 3=SKIP
        """
        is_creator = Txn.sender == Global.creator_address
        is_agent = self.agent_authorized == UInt64(1)
        if is_agent:
            is_agent = Txn.sender == Account(self.agent_address)
        assert is_creator or is_agent, "Unauthorized"

        self.total_decisions = self.total_decisions + UInt64(1)
        self.last_decision_timestamp = Global.latest_timestamp
        self.last_decision_action = action

    @arc4.abimethod(readonly=True)
    def get_position(self) -> arc4.Tuple[
        arc4.UInt64,
        arc4.UInt64,
        arc4.UInt64,
        arc4.UInt64,
        arc4.UInt64,
        arc4.UInt64,
        arc4.UInt64,
    ]:
        """
        Return all position fields as an ABI tuple.
        Returns: (entry_price, lower_bound, upper_bound, capital_usdc,
                  open_timestamp, total_rebalances, last_rebalance_timestamp)
        """
        return arc4.Tuple((
            arc4.UInt64(self.entry_price),
            arc4.UInt64(self.lower_bound),
            arc4.UInt64(self.upper_bound),
            arc4.UInt64(self.capital_usdc),
            arc4.UInt64(self.open_timestamp),
            arc4.UInt64(self.total_rebalances),
            arc4.UInt64(self.last_rebalance_timestamp),
        ))

    @arc4.abimethod(readonly=True)
    def get_vault_state(self) -> arc4.Tuple[
        arc4.UInt64,
        arc4.UInt64,
        arc4.UInt64,
        arc4.UInt64,
        arc4.UInt64,
        arc4.UInt64,
        arc4.UInt64,
        arc4.UInt64,
    ]:
        """
        Return vault state as an ABI tuple.
        Returns: (deposited_algo, deposited_usdc, total_deposits, total_withdrawals,
                  agent_authorized, total_decisions, last_decision_timestamp, last_decision_action)
        """
        return arc4.Tuple((
            arc4.UInt64(self.deposited_algo),
            arc4.UInt64(self.deposited_usdc),
            arc4.UInt64(self.total_deposits),
            arc4.UInt64(self.total_withdrawals),
            arc4.UInt64(self.agent_authorized),
            arc4.UInt64(self.total_decisions),
            arc4.UInt64(self.last_decision_timestamp),
            arc4.UInt64(self.last_decision_action),
        ))
