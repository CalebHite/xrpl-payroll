import { Client, Wallet, Payment } from 'xrpl';
import { PinataService } from './pinata';

const TESTNET_URL = 'wss://s.altnet.rippletest.net:51233';
const WALLET_STORAGE_KEY = 'renmo_wallets';

interface StoredWallet {
  seed: string;
  address: string;
  name?: string;
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
        if (!newWallet.address) {
          throw new Error('Invalid wallet address generated from secret key');
        }
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
      if (!newWallet.address || !newWallet.seed) {
        throw new Error('Failed to generate a valid wallet address or seed');
      }
    }

    const walletData: StoredWallet = {
      seed: (secretKey || newWallet.seed) as string,
      address: newWallet.address as string,
      name: name || `Account ${this.wallets.length + 1}`
    };

    console.log('Saving wallet metadata to Pinata:', walletData);
    try {
      await this.pinataService.saveAccountMetadata(walletData.address, {
        name: walletData.name,
        address: walletData.address,
        createdAt: new Date().toISOString(),
        lastUsed: new Date().toISOString()
      });
      console.log('Wallet metadata saved to Pinata successfully');
    } catch (error) {
      console.error('Error saving wallet metadata to Pinata:', error);
      throw error;
    }

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
      
      await new Promise(resolve => setTimeout(resolve, 3000)); // Wait time of 3 seconds
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

  async sendPayment(destination: string, amount: string): Promise<any> {
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
      const response = await this.client.request({
        command: 'account_info',
        account: this.wallet.address,
        ledger_index: 'validated',
      });
      
      const xrpBalance = (parseInt(response.result.account_data.Balance) / 1000000).toString();
      
      return {
        xrp: xrpBalance
      };
    } catch (error) {
      console.error('Error getting balance:', error);
      throw error;
    }
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

  getWalletAddress() {
    return this.wallet?.address || null;
  }

  getSecretKey(address: string): string | null {
    const wallet = this.wallets.find(w => w.address === address);
    return wallet?.seed || null;
  }

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
          const amountField = tx.tx_json.Amount;
          if (amountField) {
            // XRP amount in drops, convert to XRP
            const drops = parseInt(amountField);
            const xrp = drops / 1000000;
            amount = `${xrp} XRP`;
            destination = tx.tx_json.Destination;
          }
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