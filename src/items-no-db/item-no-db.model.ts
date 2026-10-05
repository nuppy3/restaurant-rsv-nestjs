export interface Item {
  id: string;
  name: string;
  price: number;
  description?: string;
  status: 'ON_SALE' | 'SOLD_OUT';
}

// 優先度
export enum Priority {
  Highest = 'Highest',
  Middle = 'Middle',
  High = 'High',
  Low = 'Low',
  Lowest = 'Lowest',
}
