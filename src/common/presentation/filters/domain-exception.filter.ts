import { ArgumentsHost, ExceptionFilter, HttpException } from '@nestjs/common';
import { Response } from 'express';
import { DomainException } from '../../../common/domain/errors/domain.exception';

/**
 * 自作のExceptionグローバルフィルター
 *
 * ⚠️ NestJSの仕組みとして、APP_FILTER（グローバルフィルター）を登録すると、自作の例外
 * （DomainException）だけでなく、NestJSが標準で投げるバリデーションエラー
 * （HttpException / BadRequestException）も含めて、すべてのエラーがこのフィルターを
 * 通過するようになります。
 *
 * 過去に、一律で exception.message（ここには "Bad Request Exception" という固定の
 * 文字列が入っています）をレスポンスに詰めてしまっているため、詳細なエラー配列が消えてしまって
 * いたという事件がありました。
 * →「バリデーションエラー（HttpException）の場合は、NestJSが作った詳細なメッセージを
 *  そのまま横流しする」 という処理をフィルターに追加。
 */
export class DomainExceptionFilter implements ExceptionFilter<DomainException> {
  // 以下のようにDomainExceptionだけをcatchするやり方だと、その他のExceptionで柔軟な
  // 対応ができないため、any→unknownにして柔軟に判断する。
  // catch(exception: DomainException, host: ArgumentsHost) {
  catch(exception: unknown, host: ArgumentsHost) {
    // ArgumentsHost(通信モード)をhttpに切り替え： そのほか、GraphQL/gRPC/WebSocket など
    const ctx = host.switchToHttp();
    // ExpressのResponseオブジェクトを取得
    const response = ctx.getResponse<Response>();

    // 💡 NestJS標準の HttpException（ValidationPipeのエラーなど）の判定
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const resContent = exception.getResponse();

      return response.status(status).json(
        typeof resContent === 'object' && resContent !== null
          ? { ...resContent, timestamp: new Date().toISOString() }
          : {
              statusCode: status,
              message: resContent,
              timestamp: new Date().toISOString(),
            },
      );
    }

    // 💡 自作のドメイン例外
    if (exception instanceof DomainException) {
      // ⭕ DomainException のインスタンスであることが確定しているため、
      // プロパティ（status等）へのアクセスは100%安全とみなされ、ESLintエラーになりません。
      return response.status(exception.status).json({
        // ステータス/エラーコード/メッセージ
        statusCode: exception.status,
        errorCode: exception.errorCode,
        message: exception.message,
        timestamp: new Date().toISOString(),
      });
    }

    // 💡 それ以外の未知のエラー（データベース接続エラー、シンタックスエラーなど）
    // 例外が「標準のErrorクラス、またはその派生（メッセージを持つもの）」であるかチェック
    const isStandardError = exception instanceof Error;
    const errorMessage = isStandardError
      ? exception.message
      : 'Internal server error';

    return response.status(500).json({
      statusCode: 500,
      errorCode: 'INTERNAL_SERVER_ERROR',
      message: errorMessage, // ⭕ exception.message を直接呼ばず、判定後の安全な文字列を渡す
      timestamp: new Date().toISOString(),
    });
  }
}
