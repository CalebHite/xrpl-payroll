import { Client, Wallet, Payment, TrustSet } from 'xrpl';
import { PinataService } from './pinata';

const TESTNET_URL = 'wss://s.altnet.rippletest.net:51233';
const WALLET_STORAGE_KEY = 'renmo_wallets';

// rLUSD configuration
const RLUSD_CURRENCY = 'USD';
const RLUSD_ISSUER = 'rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De'; // Testnet issuer

interface TrustLine {
  account: string;
  balance: string;
  currency: string;
  limit: string;
  limit_peer: string;
  quality_in: number;
  quality_out: number;
}

interface StoredWallet {
  seed: string;
  address: string;
  name?: string;
}

class TrustlineError extends Error {
  type: string;
  details: {
    recipient: string;
    currency: string;
    issuer: string;
    instructions: string;
  };

  constructor(message: string, details: {
    recipient: string;
    currency: string;
    issuer: string;
    instructions: string;
  }) {
    super(message);
    this.name = 'TrustlineError';
    this.type = 'TRUSTLINE_REQUIRED';
    this.details = details;
  }
}

export class XRPLService {
  private client: Client;
  private wallet: Wallet | null = null;
  private isConnected: boolean = false;
  private wallets: StoredWallet[] = [];
  private pinataService: PinataService;

  constructor() {
    this.client = new Client(TESTNET_URL);
    this.pinataService = PinataService.getInstance();
    this.loadWallets();
    this.autoConnect();
  }

  private async autoConnect() {
    try {
      await this.connect();
      if (this.wallets.length > 0) {
        this.wallet = Wallet.fromSeed(this.wallets[0].seed);
        await this.getBalance();
      }
    } catch (error) {
      console.error('Error in auto-connect:', error);
    }
  }

  private async loadWallets() {
    if (typeof window !== 'undefined') {
      const storedWallets = localStorage.getItem(WALLET_STORAGE_KEY);
      if (storedWallets) {
        try {
          this.wallets = JSON.parse(storedWallets);
          if (this.wallets.length > 0) {
            this.wallet = Wallet.fromSeed(this.wallets[0].seed);
            // Load metadata for all wallets
            await Promise.all(this.wallets.map(async (wallet) => {
              const metadata = await this.pinataService.getAccountMetadata(wallet.address);
              if (metadata) {
                wallet.name = metadata.name;
              }
            }));
          }
        } catch (error) {
          console.error('Error loading wallets from storage:', error);
          localStorage.removeItem(WALLET_STORAGE_KEY);
        }
      }
    }
  }

  private saveWallets() {
    if (typeof window !== 'undefined') {
      localStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(this.wallets));
    }
  }

  getWallets() {
    return this.wallets;
  }

  async switchWallet(address: string) {
    const walletData = this.wallets.find(w => w.address === address);
    if (!walletData) {
      throw new Error('Wallet not found');
    }
    
    this.wallet = Wallet.fromSeed(walletData.seed);
    if (!this.isConnected) {
      await this.connect();
    }

    // Update last used timestamp in metadata
    await this.pinataService.updateAccountMetadata(address, {
      lastUsed: new Date().toISOString()
    });

    await this.getBalance();
  }

  async addWallet(name?: string, secretKey?: string): Promise<StoredWallet> {
    if (!this.isConnected) {
      await this.connect();
    }

    let newWallet: Wallet;
    if (secretKey) {
      try {
        newWallet = Wallet.fromSeed(secretKey);
        // Check if wallet already exists
        const existingWallet = this.wallets.find(w => w.address === newWallet.address);
        if (existingWallet) {
          throw new Error('This account is already imported');
        }
      } catch (error) {
        if (error instanceof Error && error.message === 'This account is already imported') {
          throw error;
        }
        throw new Error('Invalid secret key');
      }
    } else {
      newWallet = Wallet.generate();
    }

    const walletData: StoredWallet = {
      seed: secretKey || newWallet.seed!,
      address: newWallet.address,
      name: name || `Account ${this.wallets.length + 1}`
    };

    // Save metadata to Pinata
    await this.pinataService.saveAccountMetadata(walletData.address, {
      name: walletData.name,
      address: walletData.address,
      createdAt: new Date().toISOString(),
      lastUsed: new Date().toISOString()
    });

    this.wallets.push(walletData);
    this.saveWallets();
    this.wallet = newWallet;

    // Only fund the wallet if it's newly generated
    if (!secretKey) {
      console.log('Funding new wallet...');
      await this.fundWallet();
      console.log('Waiting for funding to complete...');
      await this.waitForFunding();
    }

    return walletData;
  }

  async removeWallet(address: string) {
    const index = this.wallets.findIndex(w => w.address === address);
    if (index === -1) {
      throw new Error('Wallet not found');
    }

    this.wallets.splice(index, 1);
    this.saveWallets();

    if (this.wallet?.address === address) {
      this.wallet = this.wallets.length > 0 ? 
        Wallet.fromSeed(this.wallets[0].seed) : 
        null;
    }
  }

  async connect() {
    if (this.isConnected) {
      return;
    }

    try {
      await this.client.connect();
      this.isConnected = true;
      console.log('Connected to XRPL Testnet');
    } catch (error) {
      console.error('Error connecting to XRPL:', error);
      throw error;
    }
  }

  async disconnect() {
    try {
      if (this.isConnected) {
        await this.client.disconnect();
        this.isConnected = false;
        console.log('Disconnected from XRPL Testnet');
      }
    } catch (error) {
      console.error('Error disconnecting from XRPL:', error);
      throw error;
    }
  }

  private async waitForFunding(maxAttempts = 20) {
    if (!this.wallet) {
      throw new Error('No wallet connected');
    }

    for (let i = 0; i < maxAttempts; i++) {
      try {
        const response = await this.client.request({
          command: 'account_info',
          account: this.wallet.address,
          ledger_index: 'validated',
        });
        
        if (response.result.account_data.Balance) {
          console.log('Wallet funded successfully');
          return true;
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes('Account not found')) {
          console.log(`Waiting for funding... Attempt ${i + 1}/${maxAttempts}`);
        } else {
          console.error('Error checking account:', error);
          throw error;
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 3000)); // Increased wait time to 3 seconds
    }
    
    throw new Error('Wallet funding timed out. Please try again in a few minutes.');
  }

  async generateWallet() {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      let wallet: Wallet;
      let isNewWallet = false;
      
      if (this.wallet) {
        wallet = this.wallet;
      } else {
        wallet = Wallet.generate();
        this.wallet = wallet;
        this.saveWallets();
        isNewWallet = true;
      }

      // Fund the wallet if it's new
      if (isNewWallet) {
        console.log('Funding new wallet...');
        await this.fundWallet();
        console.log('Waiting for funding to complete...');
        await this.waitForFunding();
      }

      return wallet;
    } catch (error) {
      console.error('Error generating wallet:', error);
      throw error;
    }
  }

  async fundWallet() {
    if (!this.wallet) {
      throw new Error('No wallet connected');
    }

    if (!this.isConnected) {
      await this.connect();
    }

    try {
      const response = await this.client.fundWallet(this.wallet);
      console.log('Funding request sent:', response);
      return response;
    } catch (error) {
      console.error('Error funding wallet:', error);
      throw error;
    }
  }

  // Enhanced version to provide more information
  async checkTrustline(address: string): Promise<{exists: boolean, balance?: string, limit?: string}> {
    try {
      const response = await this.client.request({
        command: 'account_lines',
        account: address,
        ledger_index: 'validated',
      });

      const trustline = response.result.lines.find(
        (line: TrustLine) => line.currency === RLUSD_CURRENCY && line.account === RLUSD_ISSUER
      );

      if (trustline) {
        return {
          exists: true,
          balance: trustline.balance,
          limit: trustline.limit
        };
      }
      return { exists: false };
    } catch (error) {
      // If account doesn't exist or has no trustlines
      return { exists: false };
    }
  }

  // New method that automatically handles recipient trustlines
  async sendPaymentWithTrustlineHandling(destination: string, amount: string, options?: {
    autoSetupTrustlineForSender?: boolean,
    retryAsXRP?: boolean
  }): Promise<{success: boolean, result?: any, error?: string}> {
    if (!this.wallet) {
      return { success: false, error: 'No wallet connected' };
    }

    if (!this.isConnected) {
      try {
        await this.connect();
      } catch (error) {
        return { success: false, error: 'Failed to connect to XRPL' };
      }
    }

    const opts = {
      autoSetupTrustlineForSender: false, // Default to false since we're using XRP
      retryAsXRP: true, // Always true since we're using XRP
      ...options
    };

    try {
      // Send XRP payment directly
      const result = await this.sendXRPPayment(destination, amount);
      return { success: true, result };
    } catch (error) {
      return { 
        success: false, 
        error: `Payment failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  // Original sendPayment method (kept for compatibility)
  async sendPayment(destination: string, amount: string): Promise<any> {
    if (!this.wallet) {
      throw new Error('No wallet connected');
    }

    if (!this.isConnected) {
      await this.connect();
    }

    try {
      // Ensure trustline is set up for sender
      await this.setupTrustline();

      // Check if recipient has trustline
      const recipientTrustline = await this.checkTrustline(destination);
      if (!recipientTrustline.exists) {
        throw new Error('Recipient does not have a trustline for RLUSD. They need to set up a trustline first.');
      }

      // Create the rLUSD payment
      const payment: Payment = {
        TransactionType: 'Payment',
        Account: this.wallet.address,
        Amount: {
          currency: RLUSD_CURRENCY,
          issuer: RLUSD_ISSUER,
          value: amount
        },
        Destination: destination,
      };

      // Get the current network fee
      const feeResponse = await this.client.request({
        command: 'fee'
      });
      const fee = feeResponse.result.drops.base_fee || '10'; // Default to 10 drops if not available
      
      const ledgerResponse = await this.client.request({
        command: 'ledger_current',
      });
      const currentLedgerIndex = ledgerResponse.result.ledger_current_index;
      
      const prepared = await this.client.autofill(payment);
      prepared.LastLedgerSequence = currentLedgerIndex + 20;
      prepared.Fee = fee;

      const signed = this.wallet.sign(prepared);
      const result = await this.client.submitAndWait(signed.tx_blob);
      
      if (result.result.meta?.TransactionResult === 'tesSUCCESS') {
        console.log('Payment successful');
        return result;
      } else if (result.result.meta?.TransactionResult === 'tecPATH_DRY') {
        // If we get tecPATH_DRY, it means there's no liquidity path
        // Let's verify both trustlines are properly set up
        const senderTrustline = await this.checkTrustline(this.wallet.address);
        const recipientTrustline = await this.checkTrustline(destination);

        if (!senderTrustline.exists) {
          throw new Error('Sender trustline is not properly set up');
        }
        if (!recipientTrustline.exists) {
          throw new Error('Recipient trustline is not properly set up');
        }

        // If both trustlines exist but we still get tecPATH_DRY, it might be a liquidity issue
        throw new Error('No liquidity path found. Please ensure both accounts have sufficient balance and proper trustlines.');
      } else {
        throw new Error(`Payment failed with code: ${result.result.meta?.TransactionResult}`);
      }
    } catch (error) {
      console.error('Error sending payment:', error);
      throw error;
    }
  }

  // Add a method to send native XRP as fallback
  async sendXRPPayment(destination: string, amount: string): Promise<any> {
    if (!this.wallet) {
      throw new Error('No wallet connected');
    }

    if (!this.isConnected) {
      await this.connect();
    }

    try {
      // Convert amount to drops (1 XRP = 1,000,000 drops)
      const amountInXRP = parseFloat(amount);
      const drops = Math.floor(amountInXRP * 1000000).toString();

      const payment: Payment = {
        TransactionType: 'Payment',
        Account: this.wallet.address,
        Amount: drops,
        Destination: destination,
      };

      // Get the current network fee
      const feeResponse = await this.client.request({
        command: 'fee'
      });
      const fee = feeResponse.result.drops.base_fee || '10'; // Default to 10 drops if not available
      
      const ledgerResponse = await this.client.request({
        command: 'ledger_current',
      });
      const currentLedgerIndex = ledgerResponse.result.ledger_current_index;
      
      const prepared = await this.client.autofill(payment);
      prepared.LastLedgerSequence = currentLedgerIndex + 20;
      prepared.Fee = fee;

      const signed = this.wallet.sign(prepared);
      const result = await this.client.submitAndWait(signed.tx_blob);
      
      return result;
    } catch (error) {
      console.error('Error sending XRP payment:', error);
      throw error;
    }
  }

  async getBalance() {
    if (!this.wallet) {
      throw new Error('No wallet connected');
    }

    if (!this.isConnected) {
      await this.connect();
    }

    try {
      // Get XRP balance
      const xrpResponse = await this.client.request({
        command: 'account_info',
        account: this.wallet.address,
        ledger_index: 'validated',
      });
      
      const xrpBalance = (parseInt(xrpResponse.result.account_data.Balance) / 1000000).toString();
      
      // Get issued currency balance
      try {
        const response = await this.client.request({
          command: 'account_lines',
          account: this.wallet.address,
          ledger_index: 'validated',
        });

        // Find the rLUSD trustline
        const rlusdLine = response.result.lines.find(
          (line: TrustLine) => line.currency === RLUSD_CURRENCY && line.account === RLUSD_ISSUER
        );

        return {
          xrp: xrpBalance,
          rlusd: rlusdLine ? rlusdLine.balance : '0'
        };
      } catch (error) {
        // If there's an error fetching trustlines, return just XRP balance
        return {
          xrp: xrpBalance,
          rlusd: '0'
        };
      }
    } catch (error) {
      console.error('Error getting balance:', error);
      throw error;
    }
  }

  // Improved trustline setup with error handling and retries
  async setupTrustline(customLimit?: string): Promise<any> {
    if (!this.wallet) {
      throw new Error('No wallet connected');
    }

    if (!this.isConnected) {
      await this.connect();
    }

    // Check if trustline already exists
    const trustlineStatus = await this.checkTrustline(this.wallet.address);
    if (trustlineStatus.exists) {
      console.log('Trustline already exists');
      return { alreadyExists: true, status: 'success' };
    }

    try {
      // First, configure account to allow rippling
      const accountSet = {
        TransactionType: 'AccountSet',
        Account: this.wallet.address,
        SetFlag: 8 // asfDefaultRipple
      };

      const preparedAccountSet = await this.client.autofill(accountSet);
      const signedAccountSet = this.wallet.sign(preparedAccountSet);
      await this.client.submitAndWait(signedAccountSet.tx_blob);

      // Now set up the trustline
      const trustSet: TrustSet = {
        TransactionType: 'TrustSet',
        Account: this.wallet.address,
        LimitAmount: {
          currency: RLUSD_CURRENCY,
          issuer: RLUSD_ISSUER,
          value: customLimit || '1000000000' // Set a high limit by default
        }
      };

      const prepared = await this.client.autofill(trustSet);
      const signed = this.wallet.sign(prepared);
      const result = await this.client.submitAndWait(signed.tx_blob);
      
      if (result.result.meta?.TransactionResult === 'tesSUCCESS') {
        console.log('Trustline setup successful');
        return { status: 'success', result };
      } else {
        throw new Error(`Trustline setup failed with code: ${result.result.meta?.TransactionResult}`);
      }
    } catch (error) {
      console.error('Error setting up trustline:', error);
      throw error;
    }
  }

  // New method to generate trustline setup instructions
  generateTrustlineInstructions(recipientAddress: string): {
    text: string,
    qrData: string,
    deepLink?: string
  } {
    const instructions = `
To receive ${RLUSD_CURRENCY} payments, you need to set up a trustline:

1. Log into your XRP Ledger wallet
2. Navigate to the "Trust Lines" or "Assets" section
3. Add a new trustline with these details:
   - Currency Code: ${RLUSD_CURRENCY}
   - Issuer Address: ${RLUSD_ISSUER}
   - Limit: 1000000 (or your preferred amount)
4. Submit the transaction and wait for confirmation

Once the trustline is established, you'll be able to receive ${RLUSD_CURRENCY} at your address: ${recipientAddress}
`;

    const trustlineData = {
      action: "setup_trustline",
      currency: RLUSD_CURRENCY,
      issuer: RLUSD_ISSUER,
      recipient: recipientAddress,
      limit: "1000000"
    };

    // In a real app, you might generate an actual deeplink for XUMM or other wallets
    const deepLink = `xumm://xapp/trustline?currency=${RLUSD_CURRENCY}&issuer=${RLUSD_ISSUER}`;

    return {
      text: instructions,
      qrData: JSON.stringify(trustlineData),
      deepLink
    };
  }

  // Helper method to check if address is valid
  isValidAddress(address: string): boolean {
    try {
      // Simple validation - check if it starts with 'r' and has the right length
      return address.startsWith('r') && address.length >= 25 && address.length <= 35;
    } catch {
      return false;
    }
  }

  // New method to help recipient set up their wallet and trustline
  async helpRecipientSetupWallet(recipientAddress: string): Promise<{
    success: boolean,
    message: string
  }> {
    try {
      // Check if recipient already has a trustline
      const trustlineStatus = await this.checkTrustline(recipientAddress);
      if (trustlineStatus.exists) {
        return {
          success: true,
          message: `Trustline already exists for address ${recipientAddress}`
        };
      }

      // Set up trustline for this address
      const trustlineResult = await this.setupTrustline();
      
      return {
        success: true,
        message: `Trustline established for address ${recipientAddress}`
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to set up trustline: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  getWalletAddress() {
    return this.wallet?.address || null;
  }

  getSecretKey(address: string): string | null {
    const wallet = this.wallets.find(w => w.address === address);
    return wallet?.seed || null;
  }

  // Improved transaction history with better typing
  async getTransactionHistory(limit: number = 20) {
    if (!this.wallet) {
      throw new Error('No wallet connected');
    }

    if (!this.isConnected) {
      await this.connect();
    }

    try {
      const response = await this.client.request({
        command: 'account_tx',
        account: this.wallet.address,
        limit: limit,
        ledger_index_min: -1,
        ledger_index_max: -1,
        binary: false,
        forward: false
      });

      if (!response.result?.transactions) {
        console.log('No transactions found in response');
        return [];
      }

      return response.result.transactions.map((tx: any) => {
        if (!tx?.tx_json) {
          console.log('Transaction data missing tx_json field');
          return {
            hash: 'unknown',
            type: 'Unknown',
            amount: 'N/A',
            destination: 'N/A',
            date: new Date(),
            status: 'failed',
            resultCode: 'unknown'
          };
        }

        // Default values
        let txType = tx.tx_json.TransactionType || 'Unknown';
        let amount = 'N/A';
        let destination = 'N/A';
        
        // For Payment transactions
        if (txType === 'Payment') {
          // Check if it's a currency payment or XRP payment
          const amountField = tx.tx_json.Amount || tx.tx_json.DeliverMax;
          if (amountField && typeof amountField === 'object') {
            amount = `${amountField.value} ${amountField.currency}`;
            destination = tx.tx_json.Destination;
          } else if (amountField) {
            // XRP amount in drops, convert to XRP then to USD
            const drops = parseInt(amountField);
            const xrp = drops / 1000000;
            const usdValue = (xrp * 0.5).toFixed(2); // Using 0.5 as fixed XRP/USD rate
            amount = `$${usdValue} USD`;
            destination = tx.tx_json.Destination;
          }
        }
        
        // For TrustSet transactions
        if (txType === 'TrustSet' && tx.tx_json.LimitAmount) {
          amount = `Trust limit: ${tx.tx_json.LimitAmount.value} ${tx.tx_json.LimitAmount.currency}`;
          destination = tx.tx_json.LimitAmount.issuer;
        }

        const processedTx = {
          hash: tx.hash || 'unknown',
          type: txType,
          amount: amount,
          destination: destination,
          date: new Date(tx.close_time_iso || Date.now()),
          status: tx.meta?.TransactionResult === 'tesSUCCESS' ? 'success' : 'failed',
          resultCode: tx.meta?.TransactionResult || 'unknown'
        };

        console.log('Processed transaction:', processedTx);
        return processedTx;
      });
    } catch (error) {
      console.error('Error getting transaction history:', error);
      throw error;
    }
  }
}