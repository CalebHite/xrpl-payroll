import axios from 'axios';

const PINATA_API_KEY = process.env.NEXT_PUBLIC_PINATA_API_KEY;
const PINATA_SECRET_KEY = process.env.NEXT_PUBLIC_PINATA_SECRET_KEY;
const PINATA_JWT = process.env.NEXT_PUBLIC_PINATA_JWT;

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
  private pinataApi;

  private constructor() {
    this.pinataApi = axios.create({
      baseURL: 'https://api.pinata.cloud',
      headers: {
        'Authorization': `Bearer ${PINATA_JWT}`,
        'Content-Type': 'application/json',
      },
    });
  }

  static getInstance(): PinataService {
    if (!PinataService.instance) {
      PinataService.instance = new PinataService();
    }
    return PinataService.instance;
  }

  private async pinJSONToIPFS(json: any): Promise<string> {
    try {
      // Updated to use the pinataApi instance
      const response = await this.pinataApi.post(
        '/pinning/pinJSONToIPFS',
        json
      );
      return response.data.IpfsHash;
    } catch (error: any) {
      console.error('Error pinning to IPFS:', error);
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
      
      // Add metadata keyvalues for filtering
      const metadataWithKeyvalues = {
        pinataContent: metadataToSave,
        pinataMetadata: {
          name: `Account-${address}`,
          keyvalues: {
            address: address,
            type: 'account'
          }
        }
      };
      
      const ipfsHash = await this.pinJSONToIPFS(metadataWithKeyvalues);
      this.metadataCache[address] = metadataToSave;
      
      // Store the IPFS hash in localStorage for quick access
      if (typeof window !== 'undefined') {
        const storedHashes = JSON.parse(localStorage.getItem('account_metadata_hashes') || '{}');
        storedHashes[address] = ipfsHash;
        localStorage.setItem('account_metadata_hashes', JSON.stringify(storedHashes));
      }
    } catch (error: any) {
      console.error('Error saving account metadata:', error);
      throw error;
    }
  }

  async fetchAllFromIPFS(unitFilter?: string) {
    try {
      const response = await this.pinataApi.get('/data/pinList', {
        params: {
          status: 'pinned',
          pageLimit: 1000,
          metadata: unitFilter ? JSON.stringify({
            keyvalues: {
              unit: {
                value: unitFilter,
                op: 'eq'
              }
            }
          }) : JSON.stringify({
            keyvalues: {
              type: {
                value: 'account',
                op: 'eq'
              }
            }
          })
        }
      });
      
      return {
        success: true,
        data: response.data.rows
      };
    } catch (error: any) {
      console.error('Error fetching from IPFS:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  async getAllAccounts(unitFilter?: string) {
    try {
      const result = await this.fetchAllFromIPFS(unitFilter);
      if (result.success) {
        // Filter for account type rows
        const accountRows = result.data.filter((row: any) => {
          return row && row.metadata && row.metadata.keyvalues && 
                 row.metadata.keyvalues.type === 'account';
        });
        
        // If we have access to the CID/ipfs_pin_hash, fetch the full content for each
        const accountsWithData = await Promise.all(
          accountRows.map(async (row: any) => {
            try {
              // If the row already contains the data we need, use it
              if (row.metadata?.pinataContent) {
                return row.metadata.pinataContent;
              }
              
              // Otherwise fetch the data using the hash
              const ipfsHash = row.ipfs_pin_hash;
              if (ipfsHash) {
                const metadata = await this.getAccountMetadataFromPin(ipfsHash);
                return metadata;
              }
              
              // Return the row as-is if we can't get more data
              return row;
            } catch (error) {
              console.error(`Error fetching data for row:`, error);
              return row; // Return the original row if fetching fails
            }
          })
        );
        
        return accountsWithData;
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      console.error('Error getting all accounts:', error);
      throw error;
    }
  }
  
  async getAccountMetadataFromPin(ipfsHash: string): Promise<AccountMetadata> {
    try {
      // Fetch the metadata using the IPFS hash
      const response = await this.pinataApi.get(`/pinning/pinByHash/${ipfsHash}`);
      
      if (response.data?.pinataContent) {
        return response.data.pinataContent;
      }
      
      const gatewayResponse = await axios.get(`https://gateway.pinata.cloud/ipfs/${ipfsHash}`);
      return gatewayResponse.data;
    } catch (error: any) {
      console.error('Error fetching account metadata from pin:', error);
      throw error;
    }
  }
}