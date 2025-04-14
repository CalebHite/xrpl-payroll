import axios from 'axios';

const PINATA_API_KEY = process.env.NEXT_PUBLIC_PINATA_API_KEY;
const PINATA_SECRET_KEY = process.env.NEXT_PUBLIC_PINATA_SECRET_KEY;
const PINATA_GATEWAY = process.env.NEXT_PUBLIC_PINATA_GATEWAY || 'https://gateway.pinata.cloud/ipfs';

interface AccountMetadata {
  name: string;
  address: string;
  createdAt: string;
  lastUsed: string;
  tags?: string[];
}

export class PinataService {
  private static instance: PinataService;
  private metadataCache: { [address: string]: AccountMetadata } = {};

  private constructor() {}

  static getInstance(): PinataService {
    if (!PinataService.instance) {
      PinataService.instance = new PinataService();
    }
    return PinataService.instance;
  }

  private async pinJSONToIPFS(json: any): Promise<string> {
    try {
      const response = await axios.post(
        'https://api.pinata.cloud/pinning/pinJSONToIPFS',
        json,
        {
          headers: {
            'Content-Type': 'application/json',
            pinata_api_key: PINATA_API_KEY,
            pinata_secret_api_key: PINATA_SECRET_KEY,
          },
        }
      );
      return response.data.IpfsHash;
    } catch (error) {
      console.error('Error pinning to IPFS:', error);
      throw error;
    }
  }

  private async getJSONFromIPFS(hash: string): Promise<any> {
    try {
      const response = await axios.get(`${PINATA_GATEWAY}/${hash}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching from IPFS:', error);
      throw error;
    }
  }

  async saveAccountMetadata(address: string, metadata: AccountMetadata): Promise<void> {
    try {
      // Ensure we're using the provided name, not the address
      const metadataToSave = {
        ...metadata,
        name: metadata.name || `Account ${address.slice(0, 8)}...`
      };
      
      const ipfsHash = await this.pinJSONToIPFS(metadataToSave);
      this.metadataCache[address] = metadataToSave;
      
      // Store the IPFS hash in localStorage for quick access
      if (typeof window !== 'undefined') {
        const storedHashes = JSON.parse(localStorage.getItem('account_metadata_hashes') || '{}');
        storedHashes[address] = ipfsHash;
        localStorage.setItem('account_metadata_hashes', JSON.stringify(storedHashes));
      }
    } catch (error) {
      console.error('Error saving account metadata:', error);
      throw error;
    }
  }

  async getAccountMetadata(address: string): Promise<AccountMetadata | null> {
    // Check cache first
    if (this.metadataCache[address]) {
      return this.metadataCache[address];
    }

    try {
      if (typeof window !== 'undefined') {
        const storedHashes = JSON.parse(localStorage.getItem('account_metadata_hashes') || '{}');
        const ipfsHash = storedHashes[address];
        
        if (ipfsHash) {
          const metadata = await this.getJSONFromIPFS(ipfsHash);
          this.metadataCache[address] = metadata;
          return metadata;
        }
      }
      return null;
    } catch (error) {
      console.error('Error fetching account metadata:', error);
      return null;
    }
  }

  async updateAccountMetadata(address: string, updates: Partial<AccountMetadata>): Promise<void> {
    try {
      const existingMetadata = await this.getAccountMetadata(address);
      if (existingMetadata) {
        const updatedMetadata = { 
          ...existingMetadata, 
          ...updates, 
          lastUsed: new Date().toISOString(),
          // Preserve the existing name unless explicitly updated
          name: updates.name || existingMetadata.name
        };
        await this.saveAccountMetadata(address, updatedMetadata);
      }
    } catch (error) {
      console.error('Error updating account metadata:', error);
      throw error;
    }
  }
} 