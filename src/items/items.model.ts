/* istanbul ignore file */
// ↑ これだけで Jest に「このファイルは無視して！」指示！！！

//------------------------------------------
// ビジネスロジックやアプリ内で使う型定義
// type・interface・enum・union などをまとめる。
//------------------------------------------

// DBに登録するため不要
// export interface Item {
//   id: string;
//   name: string;
//   price: number;
//   description?: string;
//   status: 'ON_SALE' | 'SOLD_OUT';
// }

// 優先度
export enum Priority {
  Highest = 'Highest',
  Middle = 'Middle',
  High = 'High',
  Low = 'Low',
  Lowest = 'Lowest',
}
