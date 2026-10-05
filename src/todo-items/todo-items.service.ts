import { Injectable, NotFoundException } from '@nestjs/common';
import { TodoItem } from './todo-items.model';

@Injectable()
export class TodoItemsService {
  // TODOオブジェクトの配列
  private todoItems: TodoItem[] = [];

  /**
   * toDoItems配列を取得
   *
   * @returns todoItems todoItems配列
   */
  getTodoItemsAll() {
    return this.todoItems;
  }

  getTodoItemsById(id: string): TodoItem {
    // find()は、配列内の各要素に対してコールバック関数を実行し、
    // 条件を満たす最初の要素を返します。一致する要素が見つからない場合は、undefinedを返します。
    const resultItem = this.todoItems.find((item) => item.id === id);
    if (!resultItem) {
      throw new NotFoundException('TODOが存在しません');
    }
    return resultItem;
  }

  /**
   * TODOオブジェクトを作成
   * @param todoItem TODOオブジェクト
   */
  add(todoItem: TodoItem): TodoItem {
    this.todoItems.push(todoItem);
    return todoItem;
  }

  /**
   * TodoItemを更新します。
   *
   * @param paramItem 更新内容
   */
  update(paramItem: TodoItem): void {
    // 以下のソースは古い。。。
    // for (let i = 0; i < this.todoItems.length; i++) {
    //   const item = this.todoItems[i];
    //   if (item.id === paramItem.id) {
    //     item.title = paramItem.title;
    //     item.description = paramItem.description;
    //     item.priority = paramItem.priority;
    //     item.deadlineDate = paramItem.deadlineDate;
    //   }
    // }

    // TodoItemの更新
    // 更新対象のItemオブジェクトのインデックスを抽出し、そのインデックスに紐づく
    // Itemオブジェクトを更新する。（インデックスの要素を更新)
    const index = this.todoItems.findIndex((item) => item.id === paramItem.id);
    if (index === -1) {
      throw new NotFoundException('更新対象のItemがありません。');
    }
    this.todoItems[index] = paramItem;
  }

  /**
   * 指定されたidに紐づくTodoItemを削除します。
   *
   * @param id ID
   */
  delete(id: string): void {
    // IDに紐づくTodoItemオブジェクトを削除
    // Arrayのfilter()にて、指定したidと異なるオブジェクトのみ残す。（=idが同じオブジェクトを削除）
    this.todoItems = this.todoItems.filter((item) => item.id !== id);
  }
}
