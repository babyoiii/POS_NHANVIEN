export interface Province {
    id: number;
    name: string;
  }
  
  export interface Cinema {
    id: number;
    provinceId: number;
    name: string;
    address: string;
  }
  
  export interface User {
    id: number;
    email: string;
    name: string;
    role: 'staff' | 'manager' ;
  }
  