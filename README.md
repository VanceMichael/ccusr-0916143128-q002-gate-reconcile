# 场馆展品扫描服务

该服务接收进口展品在场馆内的在线扫描事件，并维护展品的当前位置和业务状态。当前接口要求事件按业务发生顺序到达：展品登记后可入场，在场内可转移库位，最后办理出境。每个 `event_id` 只会应用一次，状态变化与事件记录写入同一个 SQLite 事务。

## 初始化与启动

```bash
npm install
npm run db:migrate
npm run dev
```

数据库默认使用当前目录的 `exhibits.sqlite3`，可以通过 `EXHIBIT_DB_PATH` 改为其他本地路径。监听地址分别由 `HOST` 和 `PORT` 控制。

## 测试

```bash
npm test
```

测试直接调用 Fastify 的 HTTP 注入边界，并为每个用例创建独立的临时数据库。
