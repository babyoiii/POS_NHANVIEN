export interface Province {
    id: number;
    name: string;
  }
  
  export interface Cinema {
    id: string;
    provinceId?: number;
    name: string;
    address: string;
    phoneNumber?: string;
    totalRooms?: number;
    status?: number;
  }
  
  export interface User {
    id: string;
    email?: string;
    userName: string;
    displayName: string;
    role?: string;
    roles?: string[];
    accessToken?: string;
    refreshToken?: string;
  }
  
  export interface LoginRequest {
    cinemaId: string;
    userName: string;
    passWord: string;
  }
  
  export interface LoginResponse {
    responseCode: number;
    message: string;
    data: {
      accessToken: string;
      refreshToken: string;
      roles: string[];
      userId: string;
      userName: string;
      displayName: string;
      email: string | null;
    }
  }
  