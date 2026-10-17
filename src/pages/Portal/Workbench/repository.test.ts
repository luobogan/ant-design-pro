import { beforeEach, describe, expect, it } from 'vitest';
import { PortalRepository, createMemoryStorage } from './repository';
import type { StorageLike } from './repository';

const SEED = [
  { title: '关于门户工作台上线的通知', category: '通知', status: '已发布', top: 1 },
  { title: '2026 年第三季度制度更新', category: '公告', status: '已发布', top: 0 },
  { title: '系统维护窗口说明', category: '新闻', status: '草稿', top: 0 },
];

let storage: StorageLike;

const newRepo = () => new PortalRepository('noticedetail', SEED, { storage });

beforeEach(() => {
  storage = createMemoryStorage();
});

describe('repository / 初始化', () => {
  it('以种子数据初始化并按序分配 id', () => {
    const repo = newRepo();
    const { list, total } = repo.list();
    expect(total).toBe(3);
    // list 默认按 id 倒序返回
    expect(list.map((r) => r.id)).toEqual([3, 2, 1]);
    expect(list[0].title).toBe(SEED[2].title);
  });

  it('空种子也能正常工作', () => {
    const repo = new PortalRepository('empty', [], { storage });
    expect(repo.list().total).toBe(0);
  });
});

describe('repository / 查询', () => {
  it('关键字跨字段匹配（忽略大小写）', () => {
    const repo = newRepo();
    expect(repo.list({ keyword: '通知' }).total).toBe(1);
    expect(repo.list({ keyword: '制度' }).total).toBe(1);
    expect(repo.list({ keyword: 'NOTHING' }).total).toBe(0);
  });

  it('精确过滤字段生效', () => {
    const repo = newRepo();
    expect(repo.list({ filters: { category: '新闻' } }).total).toBe(1);
    expect(repo.list({ filters: { status: '已发布' } }).total).toBe(2);
  });

  it('空值过滤条件被忽略', () => {
    const repo = newRepo();
    expect(repo.list({ filters: { category: '', status: undefined } }).total).toBe(3);
  });

  it('关键字与过滤条件叠加生效', () => {
    const repo = newRepo();
    const result = repo.list({ keyword: '制度', filters: { status: '已发布' } });
    expect(result.total).toBe(1);
    expect(result.list[0].title).toContain('制度');
  });

  it('按 id 倒序返回（最新在前）', () => {
    const repo = newRepo();
    expect(repo.list().list.map((r) => r.id)).toEqual([3, 2, 1]);
  });

  it('分页切片正确', () => {
    const repo = newRepo();
    const p1 = repo.list({ page: 1, pageSize: 2 });
    const p2 = repo.list({ page: 2, pageSize: 2 });
    expect(p1.list).toHaveLength(2);
    expect(p1.total).toBe(3);
    expect(p2.list).toHaveLength(1);
    expect(p2.list[0].id).toBe(1);
  });

  it('非法分页参数被兜底为合法值', () => {
    const repo = newRepo();
    const r = repo.list({ page: 0, pageSize: -5 });
    expect(r.page).toBe(1);
    expect(r.pageSize).toBe(1);
  });

  it('searchFields 限定关键字匹配范围', () => {
    const repo = new PortalRepository('noticedetail', SEED, { storage, searchFields: ['category'] });
    // '制度' 只出现在 title 而非 category，故不命中
    expect(repo.list({ keyword: '制度' }).total).toBe(0);
    expect(repo.list({ keyword: '新闻' }).total).toBe(1);
  });
});

describe('repository / 增删改', () => {
  it('create 分配递增 id 并入库', () => {
    const repo = newRepo();
    const created = repo.create({ title: '新增公告', category: '通知', status: '草稿', top: 0 });
    expect(created.id).toBe(4);
    expect(repo.list().total).toBe(4);
    expect(repo.list({ keyword: '新增公告' }).total).toBe(1);
  });

  it('update 局部覆盖且保持 id 不变', () => {
    const repo = newRepo();
    const updated = repo.update(2, { status: '已下线' });
    expect(updated?.id).toBe(2);
    expect(updated?.status).toBe('已下线');
    // 未传字段保持原值
    expect(updated?.title).toBe(SEED[1].title);
    expect(repo.get(2)?.status).toBe('已下线');
  });

  it('update 不存在的记录返回 undefined', () => {
    const repo = newRepo();
    expect(repo.update(999, { status: '已下线' })).toBeUndefined();
  });

  it('remove 删除指定记录并返回 true', () => {
    const repo = newRepo();
    expect(repo.remove(2)).toBe(true);
    expect(repo.list().total).toBe(2);
    expect(repo.get(2)).toBeUndefined();
  });

  it('remove 不存在的记录返回 false 且不改变总数', () => {
    const repo = newRepo();
    expect(repo.remove(999)).toBe(false);
    expect(repo.list().total).toBe(3);
  });

  it('删除后再新增不与已有 id 冲突', () => {
    const repo = newRepo();
    repo.remove(3);
    const created = repo.create({ title: '新记录' });
    expect(created.id).toBe(3);
  });
});

describe('repository / 持久化与重置', () => {
  it('同一存储下新实例可恢复已持久化的数据', () => {
    const first = newRepo();
    first.create({ title: '持久化公告', category: '通知', status: '草稿', top: 0 });
    const second = new PortalRepository('noticedetail', SEED, { storage });
    expect(second.list().total).toBe(4);
    expect(second.list({ keyword: '持久化公告' }).total).toBe(1);
  });

  it('不同模块 key 数据互相隔离', () => {
    newRepo().create({ title: '公告侧写入' });
    const other = new PortalRepository('synergy', [{ title: '协同区初始' }], { storage });
    expect(other.list().total).toBe(1);
    expect(other.list({ keyword: '公告侧写入' }).total).toBe(0);
  });

  it('reset 恢复种子数据并重排 id', () => {
    const repo = newRepo();
    repo.create({ title: '临时记录' });
    repo.reset(SEED);
    expect(repo.list().total).toBe(3);
    expect(repo.list().list.map((r) => r.id)).toEqual([3, 2, 1]);
  });

  it('存储内容损坏时降级为重新播种而非抛错', () => {
    storage.setItem('portal-workbench:v1:noticedetail', 'broken-json');
    const repo = new PortalRepository('noticedetail', SEED, { storage });
    expect(repo.list().total).toBe(3);
  });

  it('存储内容非数组时同样降级处理', () => {
    storage.setItem('portal-workbench:v1:noticedetail', 'not-an-array');
    const repo = new PortalRepository('noticedetail', SEED, { storage });
    expect(repo.list().total).toBe(3);
  });
});