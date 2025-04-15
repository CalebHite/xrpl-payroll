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
      console.log('Attempting to pin JSON to IPFS:', {
        endpoint: '/pinning/pinJSONToIPFS',
        headers: this.pinataApi.defaults.headers,
        data: json
      });

      const response = await this.pinataApi.post(
        '/pinning/pinJSONToIPFS',
        json
      );
      
      console.log('Pinata API Response:', {
        status: response.status,
        statusText: response.statusText,
        data: response.data
      });

      return response.data.IpfsHash;
    } catch (error: any) {
      console.error('Error pinning to IPFS:', {
        error: error.message,
        response: error.response?.data,
        status: error.response?.status,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          headers: error.config?.headers,
          data: error.config?.data
        }
      });
      throw error;
    }
  }

  async saveAccountMetadata(address: string, metadata: AccountMetadata): Promise<void> {
    try {
      console.log('Saving account metadata:', {
        address,
        metadata,
        pinataJWT: PINATA_JWT ? 'JWT present' : 'JWT missing'
      });

      // Ensure we're using the provided name, not the address
      const metadataToSave = {
        ...metadata,
        name: metadata.name || `Account ${address.slice(0, 8)}...`
      };
      
      // Add metadata keyvalues for filtering
      const metadataWithKeyvalues = {
        pinataContent: metadataToSave,
        pinataMetadata: {
          name: metadata.name,
          keyvalues: {
            address: address,
            type: 'account'
          }
        }
      };
      
      console.log('Metadata to be saved:', metadataWithKeyvalues);
      
      const ipfsHash = await this.pinJSONToIPFS(metadataWithKeyvalues);
      this.metadataCache[address] = metadataToSave;
      
      console.log('Successfully saved metadata:', {
        address,
        ipfsHash,
        cacheSize: Object.keys(this.metadataCache).length
      });
      
      // Store the IPFS hash in localStorage for quick access
      if (typeof window !== 'undefined') {
        const storedHashes = JSON.parse(localStorage.getItem('account_metadata_hashes') || '{}');
        storedHashes[address] = ipfsHash;
        localStorage.setItem('account_metadata_hashes', JSON.stringify(storedHashes));
      }
    } catch (error: any) {
      console.error('Error saving account metadata:', {
        error: error.message,
        response: error.response?.data,
        status: error.response?.status,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          headers: error.config?.headers,
          data: error.config?.data
        }
      });
      throw error;
    }
  }

  async fetchAllFromIPFS(unitFilter?: string) {
    try {
      const params = {
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
      };

      console.log('Fetching from IPFS:', {
        endpoint: '/data/pinList',
        params,
        headers: this.pinataApi.defaults.headers
      });

      const response = await this.pinataApi.get('/data/pinList', { params });
      
      console.log('Pinata API Response:', {
        status: response.status,
        statusText: response.statusText,
        dataCount: response.data.rows?.length
      });
      
      return {
        success: true,
        data: response.data.rows
      };
    } catch (error: any) {
      console.error('Error fetching from IPFS:', {
        error: error.message,
        response: error.response?.data,
        status: error.response?.status,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          headers: error.config?.headers,
          params: error.config?.params
        }
      });
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

        console.log(accountsWithData)
        
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
      console.log('Fetching account metadata from pin:', {
        ipfsHash,
        endpoint: `/pinning/pinByHash/${ipfsHash}`,
        headers: this.pinataApi.defaults.headers
      });

      const response = await this.pinataApi.get(`/pinning/pinByHash/${ipfsHash}`);
      
      console.log('Pinata API Response:', {
        status: response.status,
        statusText: response.statusText,
        hasData: !!response.data?.pinataContent
      });
      
      if (response.data?.pinataContent) {
        return response.data.pinataContent;
      }
      
      console.log('Falling back to gateway for metadata:', {
        gatewayUrl: `https://gateway.pinata.cloud/ipfs/${ipfsHash}`
      });

      const gatewayResponse = await axios.get(`https://gateway.pinata.cloud/ipfs/${ipfsHash}`);
      return gatewayResponse.data;
    } catch (error: any) {
      console.error('Error fetching account metadata from pin:', {
        error: error.message,
        response: error.response?.data,
        status: error.response?.status,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          headers: error.config?.headers
        }
      });
      throw error;
    }
  }

  async removeAccount(address: string): Promise<void> {
    try {
      console.log('Removing wallet:', { address });

      // First, get the IPFS hash from localStorage
      if (typeof window !== 'undefined') {
        const storedHashes = JSON.parse(localStorage.getItem('account_metadata_hashes') || '{}');
        const ipfsHash = storedHashes[address];

        if (ipfsHash) {
          // Unpin from IPFS
          await this.pinataApi.delete(`/pinning/unpin/${ipfsHash}`);
          console.log('Successfully unpinned from IPFS:', { address, ipfsHash });

          // Remove from localStorage
          delete storedHashes[address];
          localStorage.setItem('account_metadata_hashes', JSON.stringify(storedHashes));
        }
      }

      // Remove from cache
      delete this.metadataCache[address];

      console.log('Successfully removed wallet:', { address });
    } catch (error: any) {
      console.error('Error removing wallet:', {
        error: error.message,
        response: error.response?.data,
        status: error.response?.status,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          headers: error.config?.headers
        }
      });
      throw error;
    }
  }
}