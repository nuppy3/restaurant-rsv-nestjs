/**
 * ドロップダウン選択肢用のRead Model
 * 画面/APIに都合よく整形された、読み取り専用のModel
 *
 * 用途：Query ServiceにてDBからのデータを当Modelに詰め替えてControllerへ返却する。
 * 一覧画面(RegionListReadModel)とは異なり、ページネーションを行わず、
 * ドロップダウン表示に必要な最小限のフィールドのみを持つ。
 */
export type RegionOptionReadModel = {
  id: string;
  code: string;
  name: string;
};
