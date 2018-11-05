import { Connection, QueryRunner } from 'typeorm'
import { UnitOfWorkObject, UnitOfWorkTemplate } from 'uow-template'

export class TypeORMUnitOfWorkObject implements UnitOfWorkObject<QueryRunner> {
  public async createByTx(tx: QueryRunner) {
    await tx.manager.save(this)
  }

  public async updateByTx(tx: QueryRunner) {
    await tx.manager.save(this)
  }

  public async deleteByTx(tx: QueryRunner) {
    await tx.manager.remove(this)
  }
}

export class TypeORMUnitOfWorkTemplate extends UnitOfWorkTemplate<QueryRunner> {

  public constructor(private connection: Connection) {
    super()
  }

  protected async begin() {
    const tx = this.connection.createQueryRunner()
    await tx.startTransaction()
    return tx
  }

  protected commit(tx: QueryRunner) {
    return tx.commitTransaction()
  }

  protected rollback(tx: QueryRunner) {
    return tx.rollbackTransaction()
  }

  protected release(tx: QueryRunner) {
    return tx.release()
  }
}