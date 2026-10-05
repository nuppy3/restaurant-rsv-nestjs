import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import type { TodoItem } from './todo-items.model';
import { Priority } from './todo-items.model';
import { TodoItemsService } from './todo-items.service';

/**
 * TODO-ITEM Controller
 */
// rooting機能
@Controller('todo-items')
export class TodoItemsController {
  // DI:TodoItemsService
  constructor(private readonly todoItemsService: TodoItemsService) {}

  /**
   * TodoItemオブジェクト配列を取得します。
   * @returns TodoItems TodoItemオブジェクト配列
   */
  @Get()
  getTodoItemsAll(): TodoItem[] {
    return this.todoItemsService.getTodoItemsAll();
  }

  /**
   * 渡されたid(パスパラメータ)を元にTodoItemオブジェクト配列からTodoItemオブジェクトを
   * 特定し返却します。
   *
   * @param id ID
   * @returns TodoItem TodoItemオブジェクト
   */
  @Get(':id')
  getTodoItemsById(@Param('id') id: string): TodoItem {
    return this.todoItemsService.getTodoItemsById(id);

    // return {
    //   id: '',
    //   title: '',
    //   description: '',
    //   deadlineDate: new Date('2025-09-09'),
    //   priority: Priority.High,
    // };
  }

  /**
   * 渡されたパラメーター(POSTのBODY)を元に、TodoItemオブジェクトを追加(作成)します。
   *
   * @param todoItem 追加(作成)対象のTodoItemオブジェクト
   * @returns TodoItemオブジェクト
   */
  // POSTのBODYからパラメータを取得
  // <コンポジション>
  // 複数の小さなオブジェクトやデータ型を組み合わせて、より複雑なオブジェクトを構築する.
  // 以下の3つの部分から全体(item)を形成
  //  部分①: id,name,priceなどの個別の独立した値
  //  部分②: Itemという、オブジェクトの構造を定めたひな形
  //  部分③: status: 'ON_SALE'という静的な値
  @Post()
  add(
    @Body('id') id: string,
    @Body('title') title: string,
    @Body('description') description: string,
    @Body('deadLineDate') deadLineDate: Date,
    @Body('priority') priority: Priority,
  ): TodoItem {
    // TodoItemの初期化（リクストBodyをセット）
    const todoItem: TodoItem = {
      id,
      title,
      description,
      deadLineDate,
      priority,
    };

    return this.todoItemsService.add(todoItem);
  }

  /**
   * 渡されたパラメーター(パスパラメータ:idとPOSTのBODY)を元に
   * TodoItemオブジェクトを更新します。
   *
   * @param id ID
   * @param title タイトル
   * @param description 説明文
   * @param deadlineDate 期日
   * @param priority 優先度
   */
  @Put(':id')
  updateTodoItem(
    @Param('id') id: string,
    // @Body('id') id: string,
    @Body('title') title: string,
    @Body('description') description: string,
    @Body('deadLineDate') deadLineDate: Date,
    @Body('priority') priority: Priority,
  ): void {
    const paramItem: TodoItem = {
      id,
      title,
      description,
      deadLineDate,
      priority,
    };
    // 更新処理
    this.todoItemsService.update(paramItem);
    // 上記serviceの中で、更新対象のItemが存在しない場合NotFoundExceptionをthrowしているが
    // 呼び出し元でtry-catchしていないのは、NextJSが捕捉、吸収してくれているため。
    // Nextjsにて、JSONボディ: { "statusCode": 404, "message": "更新対象のItemがありません。" }
    // のような、標準的なエラーレスポンスを生成してくれる。
  }

  /**
   * 渡されたIDに紐づくTodoItemオブジェクトを削除します。
   *
   * @param id ID
   */
  @Delete(':id')
  delete(@Param('id') id: string): void {
    this.todoItemsService.delete(id);
  }
}
