import { google } from 'googleapis';

// Google Drive API configuration
const GOOGLE_DRIVE_SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.file'
];

export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  webViewLink?: string;
  thumbnailLink?: string;
  parents?: string[];
}

export interface GoogleDriveFolder {
  id: string;
  name: string;
  mimeType: string;
  parents?: string[];
}

export class GoogleDriveService {
  private auth: any;
  private drive: any;
  private initialized: boolean = false;

  constructor() {
    // Don't initialize immediately - wait until first use
  }

  private initializeAuth() {
    if (this.initialized) {
      return;
    }

    // Determine the correct redirect URI based on environment
    const redirectUri = process.env.NODE_ENV === 'production' 
      ? 'https://sako-or.vercel.app/api/google-drive/callback'
      : 'http://localhost:3000/api/google-drive/callback';

    // Check if environment variables are available
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      throw new Error('Google OAuth credentials not configured. Please check your environment variables.');
    }

    // Initialize OAuth2 client
    this.auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      redirectUri
    );

    this.drive = google.drive({ version: 'v3', auth: this.auth });
    this.initialized = true;
  }

  // Get authorization URL for OAuth flow
  getAuthUrl(): string {
    try {
      // Initialize auth if not already done
      this.initializeAuth();

      return this.auth.generateAuthUrl({
        access_type: 'offline',
        scope: GOOGLE_DRIVE_SCOPES,
        prompt: 'consent'
      });
    } catch (error) {
      console.error('Error generating auth URL:', error);
      throw new Error('Failed to generate Google Drive authentication URL. Please check your configuration.');
    }
  }

  // Exchange authorization code for tokens
  async getTokens(code: string) {
    // Initialize auth if not already done
    this.initializeAuth();
    
    const { tokens } = await this.auth.getToken(code);
    this.auth.setCredentials(tokens);
    return tokens;
  }

  // Set credentials (for when tokens are already available)
  setCredentials(tokens: any) {
    // Initialize auth if not already done
    this.initializeAuth();
    this.auth.setCredentials(tokens);
  }

  // List files in a folder
  async listFiles(folderId?: string, pageToken?: string): Promise<{ files: GoogleDriveFile[], nextPageToken?: string }> {
    try {
      // Initialize auth if not already done
      this.initializeAuth();
      
      console.log('Google Drive Service - listFiles called with folderId:', folderId);
      
      const response = await this.drive.files.list({
        q: folderId ? `'${folderId}' in parents` : undefined,
        pageSize: 100,
        pageToken,
        fields: 'nextPageToken, files(id, name, mimeType, size, webViewLink, thumbnailLink, parents, imageMediaMetadata, thumbnailVersion)',
        orderBy: 'name'
      });

      console.log('Google Drive Service - API response received');
      console.log('Google Drive Service - Files count:', response.data.files?.length || 0);

      return {
        files: response.data.files || [],
        nextPageToken: response.data.nextPageToken
      };
    } catch (error) {
      console.error('Error listing Google Drive files:', error);
      
      // Check if it's an authentication error
      if (error instanceof Error && error.message.includes('401')) {
        throw new Error('Authentication failed. Please reconnect to Google Drive.');
      }
      
      // Check if it's a permission error
      if (error instanceof Error && error.message.includes('403')) {
        throw new Error('Permission denied. Please check your Google Drive API permissions.');
      }
      
      throw new Error(`Failed to list files from Google Drive: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Get file details
  async getFile(fileId: string): Promise<GoogleDriveFile> {
    try {
      const response = await this.drive.files.get({
        fileId,
        fields: 'id, name, mimeType, size, webViewLink, thumbnailLink, parents'
      });

      return response.data;
    } catch (error) {
      console.error('Error getting Google Drive file:', error);
      throw new Error('Failed to get file details from Google Drive');
    }
  }

  // Download file content
  async downloadFile(fileId: string): Promise<Buffer> {
    try {
      const response = await this.drive.files.get({
        fileId,
        alt: 'media'
      }, {
        responseType: 'arraybuffer'
      });

      return Buffer.from(response.data);
    } catch (error) {
      console.error('Error downloading Google Drive file:', error);
      throw new Error('Failed to download file from Google Drive');
    }
  }

  // Search for files by name
  async searchFiles(query: string, folderId?: string): Promise<GoogleDriveFile[]> {
    try {
      let searchQuery = `name contains '${query}'`;
      if (folderId) {
        searchQuery += ` and '${folderId}' in parents`;
      }

      const response = await this.drive.files.list({
        q: searchQuery,
        pageSize: 50,
        fields: 'files(id, name, mimeType, size, webViewLink, thumbnailLink, parents)',
        orderBy: 'name'
      });

      return response.data.files || [];
    } catch (error) {
      console.error('Error searching Google Drive files:', error);
      throw new Error('Failed to search files in Google Drive');
    }
  }

  // Get folder hierarchy
  async getFolderPath(folderId: string): Promise<string[]> {
    try {
      const path: string[] = [];
      let currentId = folderId;

      while (currentId) {
        const file = await this.getFile(currentId);
        path.unshift(file.name);
        
        if (file.parents && file.parents.length > 0) {
          currentId = file.parents[0];
        } else {
          break;
        }
      }

      return path;
    } catch (error) {
      console.error('Error getting folder path:', error);
      return ['Unknown'];
    }
  }

  // Check if file is an image
  isImageFile(file: GoogleDriveFile): boolean {
    return file.mimeType.startsWith('image/');
  }

  // Generate a better thumbnail URL for images
  getThumbnailUrl(fileId: string, size: number = 200): string {
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w${size}-h${size}`;
  }

  // Get thumbnail using Google Drive API
  async getThumbnail(fileId: string, size: number = 200): Promise<string | null> {
    try {
      const response = await this.drive.files.get({
        fileId,
        fields: 'thumbnailLink,thumbnailVersion'
      });

      if (response.data.thumbnailLink) {
        // Add size parameter to the thumbnail URL
        const thumbnailUrl = new URL(response.data.thumbnailLink);
        thumbnailUrl.searchParams.set('sz', `w${size}-h${size}`);
        return thumbnailUrl.toString();
      }

      return null;
    } catch (error) {
      console.error('Error getting thumbnail:', error);
      return null;
    }
  }

  // Get image files from a folder
  async getImageFiles(folderId?: string): Promise<GoogleDriveFile[]> {
    try {
      const { files } = await this.listFiles(folderId);
      return files.filter(file => this.isImageFile(file));
    } catch (error) {
      console.error('Error getting image files:', error);
      throw new Error('Failed to get image files from Google Drive');
    }
  }
}

// Create a singleton instance
export const googleDriveService = new GoogleDriveService();
