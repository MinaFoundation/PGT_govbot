import { Model, ModelStatic, FindOptions } from 'sequelize';

export class PaginationLogic {
  static async getPaginatedResults<T extends Model>(
    model: ModelStatic<T>,
    page: number,
    pageSize: number,
    options: FindOptions<T> = {}
  ): Promise<{ results: T[]; totalPages: number; totalCount: number }> {
    const count = await model.count(options);
    const totalPages = Math.ceil(count / pageSize);

    const paginatedOptions: FindOptions<T> = {
      ...options,
      limit: pageSize,
      offset: page * pageSize,
    };

    const results = await model.findAll(paginatedOptions);

    return {
      results,
      totalPages,
      totalCount: count,
    };
  }
}