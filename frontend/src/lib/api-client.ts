const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || '/api/v1';

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: any;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const url = `${this.baseUrl}${endpoint}`;
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (options.headers) {
        Object.assign(headers, options.headers);
      }

      // Add auth token if available (skip for login)
      if (!endpoint.includes('/auth/login') && !endpoint.includes('/auth/register')) {
        const token = this.getToken();
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      }

      const response = await fetch(url, {
        ...options,
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        // Extract meaningful error message
        let errorMessage = `HTTP ${response.status}`;
        
        if (data.error) {
          if (typeof data.error === 'object' && data.error.message) {
            errorMessage = data.error.message;
          } else if (typeof data.error === 'string') {
            errorMessage = data.error;
          }
        } else if (data.message) {
          errorMessage = data.message;
        }
        
        return {
          success: false,
          error: errorMessage,
        };
      }

      return data; // Backend already returns { success, data }
    } catch (error: any) {
      console.error('API request failed:', error);
      return {
        success: false,
        error: error.message || 'Network error occurred',
      };
    }
  }

  private getToken(): string | null {
    if (typeof window === 'undefined') return null;
    // Check both locations for backwards compatibility
    return localStorage.getItem('accessToken') || localStorage.getItem('auth-token');
  }

  private saveToken(token: string): void {
    if (typeof window === 'undefined') return;
    // Save to both locations
    localStorage.setItem('accessToken', token);
    localStorage.setItem('auth-token', token);
  }

  private clearToken(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('accessToken');
    localStorage.removeItem('auth-token');
    localStorage.removeItem('auth-user');
    localStorage.removeItem('auth-storage');
  }

  async login(data: { its_id: string; password: string }): Promise<ApiResponse<{ token: string; user: any }>> {
    this.clearToken();
    
    const response = await this.request<{ token: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (response.success && response.data) {
      this.saveToken(response.data.token);
    }

    return response;
  }

  async logout(): Promise<void> {
    this.clearToken();
  }

  async get<T = any>(endpoint: string): Promise<T> {
    const response = await this.request<T>(endpoint, { method: 'GET' });
    if (!response.success) {
      throw new Error(response.error || 'Request failed');
    }
    return response.data as T;
  }

  async post<T = any>(endpoint: string, data?: any): Promise<T> {
    const response = await this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
    if (!response.success) {
      throw new Error(response.error || 'Request failed');
    }
    return response.data as T;
  }

  async put<T = any>(endpoint: string, data?: any): Promise<T> {
    const response = await this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
    if (!response.success) {
      throw new Error(response.error || 'Request failed');
    }
    return response.data as T;
  }

  async delete<T = any>(endpoint: string): Promise<T> {
    const response = await this.request<T>(endpoint, { method: 'DELETE' });
    if (!response.success) {
      throw new Error(response.error || 'Request failed');
    }
    return response.data as T;
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }
}

export const apiClient = new ApiClient();
