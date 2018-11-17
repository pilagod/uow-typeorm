import { Connection, QueryRunner } from 'typeorm'
import { Uow, UowObject } from 'uow-template'

export class UowEntity implements UowObject<QueryRunner> {

  public async createByTx (tx: QueryRunner) {
    await tx.manager.insert(this.constructor, this)
  }

  public async updateByTx (tx: QueryRunner) {
    const metadata = tx.connection.getMetadata(this.constructor)
    await tx.manager.update(this.constructor, { ...metadata.getEntityIdMap(this) }, this)
  }

  public async deleteByTx (tx: QueryRunner) {
    await tx.manager.remove(this)
  }
}

export class UowRepository extends Uow<QueryRunner> {

  public constructor (private connection: Connection) {
    super()
  }

  protected async begin () {
    const tx = this.connection.createQueryRunner()
    await tx.startTransaction()
    return tx
  }

  protected commit (tx: QueryRunner) {
    return tx.commitTransaction()
  }

  protected rollback (tx: QueryRunner) {
    return tx.rollbackTransaction()
  }

  protected release (tx: QueryRunner) {
    return tx.release()
  }
}
