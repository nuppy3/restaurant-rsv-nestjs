/**
 * ページネーションされた情報
 *
 * interfaceはimplementsしたサブクラスで再定義が必須なので、meta:{}の中身
 * (例: totalCount、page、size)をinterface内で定義する意味はないと思っていたが
 * swaggerなどのOpenAPIの「ドキュメント性」や、このオブジェクトには最低こう言った項目があるよ
 * という観点での型安全生を担保する意味で、meta:{}にするのではなく中身を定義することに
 * 意味はあるようだ。
 * →具体的に書くのがベスト というのがNestJS/TypeScript実務の主流意見です。
 *
 * → 20280807: View系のオブジェクト(Read Model)は振る舞いを持たない、ただのデータの形なので
 * typeが良い!(Entityと違ってカプセル化や「不正な状態を防ぐ」という関心事がそもそも存在しない
 * （QueryServiceが組み立てた時点で正しい値であることが前提）)のため、typeとする。
 */
// export interface PaginatedResult<T> {
export type PaginatedResult<T> = {
  data: T[];
  meta: {
    // 総件数
    totalCount: number;
    // ページ
    page: number;
    // 1ページあたりの件数
    size: number;
  };
};
