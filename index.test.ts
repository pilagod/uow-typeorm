import sinon from 'sinon'
import {
  Column,
  Connection,
  createConnection,
  Entity,
  PrimaryColumn,
  Repository as Mapper
} from 'typeorm'
import { UowEntity, UowRepository } from './'

@Entity()
class TestEntity extends UowEntity {
  @PrimaryColumn('integer')
  public id: number = 0

  @Column('varchar', {
    length: 32
  })
  public name: string = ''
}

class TestRepository extends UowRepository {

  public constructor (connection: Connection) {
    super(connection)
  }

  public async create (entity: TestEntity) {
    await this.markCreate(entity)
  }

  public async update (entity: TestEntity) {
    await this.markUpdate(entity)
  }

  public async delete (entity: TestEntity) {
    await this.markDelete(entity)
  }
}

describe('uow typeorm', async () => {
  let connection: Connection
  let testEntityMapper: Mapper<TestEntity>

  beforeAll(async () => {
    connection = await createConnection({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      database: 'test',
      username: 'test',
      password: 'test',
      entities: [
        TestEntity
      ],
      dropSchema: true,
      synchronize: true
    })
    testEntityMapper = connection.getRepository(TestEntity)
  })

  afterAll(async () => {
    await testEntityMapper.query(`DROP TABLE test_entity;`)
    await connection.close()
  })

  beforeEach(async () => {
    await testEntityMapper.query(`TRUNCATE TABLE test_entity RESTART IDENTITY CASCADE;`)
  })

  function getTestRepository () {
    return new TestRepository(connection)
  }

  function getTestEntity (id: number, name: string) {
    const entity = new TestEntity()
    entity.id = id
    entity.name = name
    return entity
  }

  describe('without beginWork declaration', () => {
    it('should create entity properly', async () => {
      const repository = getTestRepository()
      const expected = getTestEntity(1, 'test')

      await repository.create(expected)

      const got = await testEntityMapper.findOne(1)

      expect(got).toEqual(expected)
    })

    it('should update entity properly', async () => {
      const repository = getTestRepository()
      const original = getTestEntity(1, 'test')
      const expected = getTestEntity(1, 'update successfully')

      await testEntityMapper.insert(original)
      await repository.update(expected)

      const got = await testEntityMapper.findOne(1)

      expect(got).toEqual(expected)
    })

    it('should delete entity properly', async () => {
      const repository = getTestRepository()
      const original = getTestEntity(1, 'test')
      const expected = getTestEntity(1, '')

      await testEntityMapper.insert(original)
      await repository.delete(expected)

      const got = await testEntityMapper.findOne(1)

      expect(got).toBeUndefined()
    })
  })

  describe('with beginWork declaration', () => {
    it('should do all actions in one transaction after beginWork declaration', async () => {
      const repository = getTestRepository()
      const entity1 = getTestEntity(1, 'first entity')
      const entity2 = getTestEntity(2, 'second entity')
      const entity2Update = getTestEntity(2, 'update entity')
      const entity3 = getTestEntity(3, 'third entity')

      await testEntityMapper.insert(entity2)
      await testEntityMapper.insert(entity3)

      repository.beginWork()
      await repository.create(entity1)
      await repository.update(entity2Update)
      await repository.delete(entity3)

      const countBeforeCommit = await testEntityMapper.count()

      expect(countBeforeCommit).toBe(2)

      await repository.commitWork()

      const countAfterCommit = await testEntityMapper.count()
      const entity1Got = await testEntityMapper.findOne(1)
      const entity2Got = await testEntityMapper.findOne(2)
      const entity3Got = await testEntityMapper.findOne(3)

      expect(countAfterCommit).toBe(2)
      expect(entity1Got).toEqual(entity1)
      expect(entity2Got).toEqual(entity2Update)
      expect(entity3Got).toBeUndefined()
    })

    it('should rollback all actions if any error occurs after beginWork declaration', async () => {
      const repository = getTestRepository()
      const entity1 = getTestEntity(1, 'first entity')
      const entity2 = getTestEntity(2, 'second entity')
      const entity2Update = getTestEntity(2, 'update entity')
      const entity3 = getTestEntity(3, 'third entity')

      sinon.stub(entity3, 'deleteByTx').throws(
        new Error('delete entity error')
      )
      await testEntityMapper.insert(entity2)
      await testEntityMapper.insert(entity3)

      const entitiesBeforeCommit = await testEntityMapper.find()

      repository.beginWork()
      await repository.create(entity1)
      await repository.update(entity2Update)
      await repository.delete(entity3)
      try {
        await repository.commitWork()
      } catch (e) {
        // catch error to keep test going
      }
      const entitiesAfterCommit = await testEntityMapper.find()

      expect(entitiesAfterCommit).toEqual(entitiesBeforeCommit)
    })
  })
})
