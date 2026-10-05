import { HttpStatus } from '@nestjs/common';

/**
 * DomainException
 * 純粋なJavaScriptの Error クラスを継承して、自作のエラー（カスタム例外）を実装
 */
export class DomainException extends Error {
  // ステータスのデフォルト:400 (必要に応じて子クラスで上書き)
  readonly status: number = HttpStatus.BAD_REQUEST;
  readonly errorCode: string = 'DOMAIN_ERROR';

  constructor(message: string) {
    super(message);
    // 解説: 通常、Error を継承しただけだと、エラーを console.log やログツールで
    // 出力した際に、エラー名が単なる "Error" と表示されてしまいます。
    // this.name に自身のクラス名を明示的に代入することで、ログに
    // Error: 何かしらのメッセージ ではなく、 DomainException: 何かしらのメッセージ と
    // 綺麗に表示されるようになります。
    this.name = 'DomainException';
    // これを書かないと、instanceof チェックがバグるので、それを防ぐための1行
    // 役割：れてしまったプロトタイプチェーン（継承関係）を正しい形に修復する
    // なぜこれが必要なのか？（背景）
    // JavaScriptの古い仕様（ES5以前）の制限により、Error や Array などの組み込みクラス
    // （Built-in classes）を継承した際、super() を呼ぶとプロトタイプチェーンが途切れて
    // しまうという致命的な挙動（不具合に近い仕様）があります。
    // コンパイルされたJavaScriptの内部では、super() を呼んだ瞬間に、なぜか
    // 子クラス（DomainException）ではなく、親クラス（Error）のプロトタイプがインスタンスに
    // 設定されてしまいます。
    //
    // イメージ例：
    // const error = new DomainException('エラーが発生しました');
    //
    // これを書かないと、TypeScript/JavaScriptは「これはDomainExceptionじゃない」と判定してしまう
    // console.log(error instanceof DomainException); // => false になってしまう！
    // console.log(error instanceof Error);           // => true
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
