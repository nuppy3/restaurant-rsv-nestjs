export interface TodoItem {
  id: string;
  title: string;
  description: string;
  deadLineDate: Date;
  priority: Priority;
}

// 優先度
export enum Priority {
  Highest = 'Highest',
  Middle = 'Middle',
  High = 'High',
  Low = 'Low',
  Lowest = 'Lowest',
}
