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
    id: number;
    email: string;
    name: string;
    role: 'staff' | 'manager' ;
  }
  