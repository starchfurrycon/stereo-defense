# B 站 Web 接口现状核实

> 取证时间：**2026-11-02**（本机时钟）。文档基线：`bilibili-API-collect` 最后可用的完整快照（2026-01-25）。
> 标注「实测」的条目为本次真实发请求的结果：未登录、Chrome UA、`Referer: https://www.bilibili.com/`、Cookie 仅含 `buvid3` + `b_nut`、请求间隔 1.4–1.8 s、同一出口 IP。

## 0. 文档还能从哪里读

原仓库 `SocialSisterYi/bilibili-API-collect` 已于 **2026-01-28 收到 B 站委托律所的律师函**，仓库转为 `deprecated` 分支，文档与源码全部删除，只剩一纸说明：<https://github.com/SocialSisterYi/bilibili-API-collect/blob/deprecated/README.md>。

现存的完整镜像（本文所有条目均以此为准）：

- <https://github.com/pskdje/bilibili-API-collect>（master 分支同步至 2026-01-25，最完整）
- <https://gitee.com/liihoowii/bilibili-API-collect>
- <https://gitea.s1f.ren/shiran/bilibili-API-collect>

因此下文引用的「文档」即上述镜像里的 Markdown，行号对应该快照。

## 1. 结论速查

| # | 接口 | 免签 | 必须登录 | 需要 WBI | 只能查自己 | 现状 |
|---|------|------|----------|----------|------------|------|
| 1 | `/x/relation/modify` | ✗ | ✓ | ✗ | ✓（只操作自己） | 正常 |
| 1 | `/x/relation/batch/modify` | ✗ | ✓ | ✗ | ✓ | 正常（实测 -101 存在） |
| 1 | `/x/relation/blacks` | ✗ | ✓ | ✗ | ✓ | 正常（实测 -101） |
| 2 | `/x/relation/fans` | ✗ | ✓ | ✗ | ✗（别人可看前 100） | 正常，实测 -352 |
| 2 | `/x/relation/fans/stat` | — | — | — | — | **不存在，实测 HTTP 404** |
| 3 | `/x/relation/followings` | ✗ | ✓ | ✗ | ✗（别人前 100） | 正常，实测 -101 |
| 4 | `/x/v2/reply/wbi/main` | ✗ | 否 | ✓ | ✗ | 正常，无签名实测 -403 |
| 4 | `/x/v2/reply/reply` | ✓ | 否 | ✗ | ✗ | 正常，实测 0 |
| 4 | `/x/v2/reply`（旧） | ✓ | 否 | ✗ | ✗ | **仍可用**，实测 0 |
| 4 | `/x/v2/reply/main`（旧懒加载） | ✓ | 否 | ✗ | ✗ | **仍可用**，实测 0 |
| 4 | 按 mid 查全站评论 | — | — | — | — | **不存在**，实测 404 |
| 5 | `/x/web-interface/popular` | ✓ | 否 | ✗ | ✗ | 正常，实测 0 |
| 5 | `/x/web-interface/ranking/v2` | ✓ | 否 | ✗ | ✗ | 正常，实测 0 |
| 5 | `/x/web-interface/wbi/index/top/feed/rcmd` | ✓ | 否（登录才个性化） | 名义需要，实测不需要 | ✗ | 正常，实测 0 |
| 6 | `/x/web-interface/history/cursor` | ✗ | ✓ | ✗ | ✓ | 正常，实测 -101 |
| 7 | `/x/web-interface/card` | ✓ | 否 | ✗ | ✗ | 正常，实测 0 |
| 7 | `/x/space/wbi/acc/info` | ✗ | ✓ | ✓ | ✗ | 签名正确未登录仍 -352（实测） |
| 7 | `/x/relation/stat` | ✓ | 否 | ✗ | ✗ | 正常，实测 0 |
| 7 | `/x/space/navnum` | ✓ | 否 | ✗ | ✗ | 正常，实测 0 |
| 7 | 注册时间字段 | — | — | — | — | **全为 0，拿不到** |
| 8 | `/x/web-interface/view` | ✓ | 否（部分稿件要登录） | ✗ | ✗ | 正常，实测 0 |
| 8 | 商单/悬赏标志位 | — | — | — | — | **未查到** |
| 9 | `/x/polymer/web-dynamic/v1/feed/space` | 理论可 | 实际建议 | ✓ | ✗ | 实测 -352 |
| 10 | 风控码 | — | — | — | — | 见 §10 |

---

## 1. 拉黑 / 解除拉黑

### 单条：`POST https://api.bilibili.com/x/relation/modify`

- 认证：Cookie `SESSDATA` + `csrf`（= Cookie `bili_jct`）；或 APP `access_key`
- 正文（`application/x-www-form-urlencoded`）：

| 参数 | 类型 | 必要 | 说明 |
|------|------|------|------|
| `fid` | num | ✓ | 目标用户 mid |
| `act` | num | ✓ | 见下表 |
| `re_src` | num | 否 | 来源代码：个人空间 11、视频 14、评论区 15、搜索 120、H5 关注列表 106、活动页 222… |
| `csrf` | str | Cookie 方式必要 | `bili_jct` |
| `access_key` | str | APP 方式必要 | — |

**`act` 取值（已核实，与你原先的猜测一致）**：

| act | 含义 | 备注 |
|-----|------|------|
| 1 | 关注 | 无法对已注销/不存在用户 |
| 2 | 取关 | — |
| 3 | 悄悄关注 | **已下线**，请求返回「请求错误」 |
| 4 | 取消悄悄关注 | 文档保留，实际基本无用 |
| **5** | **拉黑** | 无法对已注销/不存在用户 |
| **6** | **取消拉黑** | — |
| 7 | 踢出粉丝（移除粉丝） | 不是拉黑 |

- 返回：`{code, message, ttl}`，成功 `code=0`
- 错误码（文档原表）：

| code | 含义 |
|------|------|
| -101 / -102 / -111 / -400 | 未登录 / 封停 / csrf 失败 / 请求错误 |
| 22001 | 不能对自己进行此操作 |
| 22002 | 因对方隐私设置，你还不能关注 |
| 22003 | 关注失败，请先移除黑名单 |
| **22008** | **黑名单达到上限** |
| 22009 | 已达关注上限 |
| 22013 | 账号已注销 |
| 22014 | 已关注，无法重复关注 |
| 22120 | 重复加入黑名单 |
| 40061 | 用户不存在 |

- 限制：**必须登录**、**只能改自己的关系**；无 WBI 要求。
- 来源：[relation.md#操作用户关系](https://github.com/pskdje/bilibili-API-collect/blob/master/docs/user/relation.md)（L1628–1692）；独立交叉验证：`bilibili-api` 17.4.2 `data/api/user.json` → `operate.modify`，注释写的 act 表为「1 关注 2 取关 3 悄悄关注 5 拉黑 6 取消拉黑 7 移除粉丝」。

### 批量：`POST https://api.bilibili.com/x/relation/batch/modify`（**官方批量接口，确实存在**）

- 参数：`fids`（逗号分隔，**最多 50 个，不能含自己**）、`act`（**仅 1 或 5**，即只能批量关注 / 批量拉黑）、`re_src`、`csrf`
- 返回：`data.failed_fids`（失败的 mid 数组）
- 局限：**批量解除拉黑没有官方接口**（act 只接受 1/5），只能单条 `act=6` 循环
- 实测：未登录 POST 返回 `{"code":-101,"message":"账号未登录"}` → 接口存活
- 来源：[relation.md#批量操作用户关系](https://github.com/pskdje/bilibili-API-collect/blob/master/docs/user/relation.md)（L1694–1766）

### 黑名单明细：`GET https://api.bilibili.com/x/relation/blacks`

- 参数：`ps`（默认 50，**最大 50**，超过按 50）、`pn`
- 返回：`data.list[]`（关系列表对象）、`data.total`（黑名单总数）、`data.re_version`
- 实测：未登录 `-101` → 存活
- 来源：[relation.md#查询黑名单明细](https://github.com/pskdje/bilibili-API-collect/blob/master/docs/user/relation.md)（L1499–1620）

### 节流 / 单账号能拉黑多少

- **官方文档只给了「22008 黑名单达到上限」，没有给出配额数字，也没有日配额说明 → 具体数字「未查到」官方来源。**
- 社区流传的经验公式（**未经官方确认，仅作参考**）：`上限 = 500 + int(粉丝数/10000) * 20`，且封顶 **5000**。来源：<https://github.com/asdfg231/bilibili_xiaofenhong>（README 首行原文）。另有讨论帖 <https://ngabbs.com/read.php?tid=34717488>。
- 结论：**真正的硬上限是「黑名单总数」，不是每日配额**；日常先撞到的是 IP/设备级风控（`-412` / `-799` / `-352`），而不是 22008。
- 实测节流（本次，未登录）：累计约 **25 次**请求（间隔 1.4–1.8 s）后，`/x/space/wbi/arc/search` 返回 **HTTP 412**。与本项目 README 里「约 25 次触发 -412、冷却约 60 s」的记录一致。
- 工程建议：批量走 `batch/modify`（50/次）+ 每次间隔 2–3 s + 遇 22008 立即停 + 遇 412 全停 60–120 s。

---

## 2. 粉丝列表

### `GET https://api.bilibili.com/x/relation/fans`

- 认证：Cookie `SESSDATA`；**且** `Referer` 必须是 `bilibili.com` 子域、**UA 不能含 `python`**，否则不返回列表
- 参数：

| 参数 | 必要 | 说明 |
|------|------|------|
| `vmid` | ✓ | 目标 mid |
| `ps` | 否 | 默认 50 |
| `pn` | 否 | 默认 1 |
| `offset` | 否 | 上次响应的 `data.offset`；有效且不为 `rcmd` 时忽略 `pn` |
| `last_access_ts` | 否 | 秒级时间戳，来自 `/x/relation/followers/unread/count` |
| `from` | 否 | `main` 且目标是自己时按智能推荐排序 |

> ⚠️ **没有 `order` 参数。** 你列的 `(vmid, pn, ps, order)` 里的 `order` 在这个接口上不存在（`order`/`order_type` 是关注列表那套）。排序只由 `from` + `offset` 决定。

- 返回关键字段：`data.list[]`、`data.offset`（`{最后一条 mtime}:{mid}` 或 `rcmd`）、`data.total`、`data.re_version`
- `list[]` 每项（关系列表对象，与关注列表同构）：

| 字段 | 说明 |
|------|------|
| `mid` / `uname` / `face` / `sign` | 基本资料 |
| `attribute` | 0 未关注 / 2 已关注 / 6 互粉 / **128 已拉黑** |
| `mtime` | **对方关注目标用户的时间**（秒级；互关后刷新；自己 `from=main` 时**不返回**） |
| `tag` | 目标用户给对方的关注分组 id 数组（无分组为 `null`） |
| `special` | **特别关注 0/1** |
| `contract_info` | 契约计划（老粉/契约者，`is_contract`/`is_contractor`/`ts`/`user_attr`） |
| `official_verify` | `type`(-1/0/1) + `desc` |
| `vip`、`face_nft`、`name_render`、`nft_icon` | 装扮类 |
| `rec_reason` / `track_id` | 仅 `from=main` 智能推荐时有值 |
| `follow_time` | 文档标「(?)」，含义不明 |

- 限制（**这条最容易踩**）：
  - **能否查别人**：能，但**别人的粉丝列表最多翻到前 100 名**（自己前 1000）。第 101 名之后返回空列表且 `code=0`（不报错，容易误判成「没有更多」）。
  - 目标用户设置了隐私 → `22118 由于该用户隐私设置，粉丝列表不可见`
  - `from=main` 且查自己 → 按智能推荐排序，**只给前 1000**，**且不含 `mtime`**
  - 未登录/UA 不对 → 常见 `-352`（**实测未登录直接 `-352`**，不是 `-101`）
- 配套：`GET /x/relation/followers/unread/count` → 自己的新增粉丝数与上次访问时间（**只能查自己**）
- **`/x/relation/fans/stat` 不存在**：实测 `GET https://api.bilibili.com/x/relation/fans/stat?vmid=2` → **HTTP 404**（返回 nginx HTML 错误页，不是 JSON）。要粉丝数用 `/x/relation/stat` 的 `follower`。
- 来源：[relation.md#查询用户粉丝明细（新）](https://github.com/pskdje/bilibili-API-collect/blob/master/docs/user/relation.md)（L74–240）；[#获取自己粉丝列表的未读状态](https://github.com/pskdje/bilibili-API-collect/blob/master/docs/user/relation.md)（L484–534）

---

## 3. 关注列表

### `GET https://api.bilibili.com/x/relation/followings`

- 认证：Cookie `SESSDATA`（或 APP `access_key`）；同样要求 `Referer` 为 B 站子域、UA 不含 `python`
- 参数：`vmid`、`ps`（默认 50）、`pn`、`order_type`（**仅目标是自己时有效**：留空=按关注顺序，`attention`=按最常访问）
  - 部分第三方库还传 `order=desc|asc`（`bilibili-api` 的 `followings`/`all_followings2` 就这么写），但**官方文档参数表里没有 `order`**，以 `order_type` 为准
- 返回：`data.list[]`（关系列表对象，同上）、`data.total`（关注总数）、`data.re_version`
- 限制：
  - **必须登录**（实测未登录 `-101`，注意与 fans 的 `-352` 不同）
  - **别人的关注列表只能看前 100 个**，超过返回空列表但 `code=0`
  - 对方隐私 → `22115 用户已设置隐私，无法查看`
  - `order_type=attention` 只对自己生效
- 相关（均**只能查自己**）：`/x/relation/tags`（分组）、`/x/relation/tags?act=1` 明细、`/x/relation/tag/special`（**所有特别关注 mid 数组**，登录后 `-101`）
- 想「免签看别人关注」：**没有**。`/x/web-interface/attentions?mid=2` 实测 `-101`（需登录），不是替代品
- 来源：[relation.md#查询用户关注明细](https://github.com/pskdje/bilibili-API-collect/blob/master/docs/user/relation.md)（L536–682）；[#查询所有特别关注 mid](https://github.com/pskdje/bilibili-API-collect/blob/master/docs/user/relation.md)（L2325–2396）

---

## 4. 评论区

### 主评论（懒加载）：`GET https://api.bilibili.com/x/v2/reply/wbi/main`

- 鉴权：**WBI 签名必须**（`w_rid` + `wts`）。文档特别注明：**WBI 签名错误时返回 `-403`，不是 `-352`**
- 参数：

| 参数 | 必要 | 说明 |
|------|------|------|
| `type` | ✓ | 评论区类型，`1` = 视频 |
| `oid` | ✓ | 目标 id（视频为 aid） |
| `mode` | 否 | `3` 仅按热度（默认）；`2` 仅按时间；`1` 热度+时间；`0` 同 3 |
| `pagination_str` | 否 | 翻页游标，见下 |
| `next` | 否 | 旧页码参数，**已弃用**，优先级高于 `pagination_str` |
| `plat` | 否 | 平台，如 `1` |
| `seek_rpid` | 否 | 第一页时可带空值 |
| `web_location` | 否 | `1315875` |
| `ps` | 否 | 文档未列；库标注 1–30 |

- 返回：`data.cursor{all_count, is_begin, prev, next, is_end, mode, mode_text, support_mode[], name, pagination_reply{next_offset, prev_offset}, session_id}`；`data.replies[]`、`data.hots[]`（禁用时 null）、`data.top{admin,upper,vote}`、`data.top_replies`、`data.config`、`data.control`、`data.upper{mid}`、`data.folder{has_folded,is_folded,rule}`、`data.notice`、`data.lottery_card`、`data.cm`（广告）、`data.cm_info`、`data.effects`、`data.blacklist`、`data.vote`
- 评论条目对象关键字段：`rpid, oid, type, mid, root, parent, dialog, count(楼中楼总数), rcount, state, fansgrade, attr, ctime, like, member{mid,uname,sex,sign,avatar,level_info,official_verify,vip,fans_detail,...}, content{message, members, jump_url, max_line}, replies[], up_action{like,reply}, reply_control{time_desc, sub_reply_entry_text, ...}, invisible, folder, track_info`
- **cursor 翻页（`pagination_str`）**：值是一个「套着字符串皮的 JSON」：
  - 第一次：`pagination_str={"offset":""}`
  - 之后：取上次响应 `data.cursor.pagination_reply.next_offset` 的值，填进 `{"offset":"<next_offset>"}`，**整个对象再被序列化成一个字符串当 query 参数**（所以要双重编码）
  - 里面 `offset` 自身的结构随 `mode` 变：`mode=3`（热度）→ `type=1` + `data.pn`；`mode=2`（时间）→ `type=3` + `Data.cursor`；`direction` 1 正序 / 2 倒序
- 限制：评论区关闭 `12002`；`type` 非法 `12009`；错误时 `data=null`；**第二页起建议带 Cookie**（`bilibili-api` 明确写「第二页以及往后需要提供 credential」）
- 实测：`oid=170001&type=1&mode=3&plat=1&web_location=1315875` 无签名 → **`-403 访问权限不足`**（与文档「签名错 → -403」一致）

### 楼中楼：`GET https://api.bilibili.com/x/v2/reply/reply`

- 认证：Cookie 可选（**免签可用**，实测 `code=0`）
- 参数：`type`、`oid`、`root`（根评论 rpid）、`ps`（默认 20，定义域 1–49 但实际最多返回 20）、`pn`
- 返回：`data.page{count(二级评论数), num, size}`、`data.replies[]`、`data.root`、`data.upper`、`data.config`、`data.control`
- 限制：按回复顺序排序；单次最多 20 条
- 来源：[list.md#获取指定评论的回复](https://github.com/pskdje/bilibili-API-collect/blob/master/docs/comment/list.md)（L1559–1652）

### 老旧但**仍然可用**的旁路（本次实测，重要）

| 接口 | 实测 | 说明 |
|------|------|------|
| `GET /x/v2/reply?type=1&oid=&pn=&ps=&sort=` | `code=0` | `sort=2` 热度 / `0` 时间；返回 `data.page{num,size,count,acount}` + `replies` |
| `GET /x/v2/reply/main?oid=&type=1&mode=3&next=0` | `code=0` | 旧懒加载；`cursor` 里**也有** `pagination_reply` |
| `GET /x/v2/reply/reply` | `code=0` | 楼中楼 |
| `GET /x/v2/reply/count?oid=&type=1` | `code=0` | 评论总数 |

→ 当 WBI 签名/风控导致 `wbi/main` 返回 `-403`/`-352` 时，可降级到 `/x/v2/reply` + `/x/v2/reply/main`（`-403` 不在这些路径上出现）。

### 「按用户查全站评论」：**没有这个接口**

实测三条最可能的路径，全部 **HTTP 404**（返回 HTML 错误页，不是 JSON）：

| 尝试 | 结果 |
|------|------|
| `/x/v2/reply/user?oid=1&type=1&pn=1&ps=1` | 404 |
| `/x/space/comment?mid=2&pn=1&ps=1` | 404 |
| `/x/v2/reply/member?mid=2&pn=1&ps=1` | 404 |

旁证：`bilibili-API-collect` 的 `docs/comment/` 全部条目里没有任何「按用户查评论」接口；`bilibili-api` 17.4.2 的 `comment.py` 也没有对应方法。

→ 覆盖一个「只评论不投稿」的账号，**只能**：① 扫已知视频的评论区（官方、可靠）；② 第三方评论索引/存档站（非官方、覆盖不全）。

来源：[list.md](https://github.com/pskdje/bilibili-API-collect/blob/master/docs/comment/list.md)、[bilibili-api comment.py](https://pypi.org/project/bilibili-api-python/)

---

## 5. 推荐流 / 热门

### `GET /x/web-interface/popular`（热门）

- 参数：`pn`（默认 1）、`ps`（默认 20）
- 返回：`data.list[]`（结构≈ view 的 data）、`data.no_more`（bool）
- 实测：**免签 `code=0`**，`list[0]` 字段：`aid, videos, tid, tname, copyright, pic, title, pubdate, ctime, desc, state, duration, mission_id, rights, owner, stat, dynamic, cid, dimension, season_id, short_link_v2, first_frame, pub_location, cover43, tidv2, tnamev2, pid_v2, pid_name_v2, attribute_v3, current_state, global_state, bvid, season_type, is_ogv, ogv_info, enable_vt, ai_rcmd, rcmd_reason`
- 限制：带 Cookie 时排序为**个性化**；无 Cookie 为通用热门
- 来源：[popular.md](https://github.com/pskdje/bilibili-API-collect/blob/master/docs/video_ranking/popular.md)（L5–55）

### `GET /x/web-interface/ranking/v2`（排行榜）

- 参数：`rid`（分区 tid，默认 0 全站，仅支持主分区）、`type`（`all` / `rookie` 新人 / `origin` 原创）、`web_location=333.934`、`w_rid`/`wts`（**非必要**）
- 返回：`data.note`（固定文案）、`data.list[]`（**固定 100 条**）
- 实测：**免签 `code=0`**，`list[0]` 比 popular 多一个 `score`
- 限制：只给前 100；鉴权要求仅「UA 非敏感字符串」
- 来源：[ranking.md](https://github.com/pskdje/bilibili-API-collect/blob/master/docs/video_ranking/ranking.md)（L9–58）

### `GET /x/web-interface/wbi/index/top/feed/rcmd`（首页推荐）

- 参数：`fresh_type`(默认 4)、`ps`(默认 12，**最大 30**)、`fresh_idx`、`fresh_idx_1h`、`brush`、`fetch_row`、`y_num`、`last_y_num`、`web_location=1430650`、`feed_version=V8`、`homepage_ver=1`、`screen`、`seo_info`、`last_showlist`、`uniq_id`、`w_rid`/`wts`（文档标注**非必要**）
- 返回：`data.item[]`、`data.business_card`、`data.floor_info`、`data.user_feature`、`data.preload_expose_pct`、`mid`（未登录为 0）
- `item[]` 字段：`id, bvid, cid, goto(av/ogv/live), uri, pic, pic_4_3, title, duration, pubdate, owner{mid,name,face}, stat, av_feature, is_followed, rcmd_reason{reason_type,content}, show_info, track_id, pos, room_info, ogv_info, **business_info**, is_stock, enable_vt, vt_display, dislike_switch, dislike_switch_pc`
- 实测：**无 `w_rid` 也返回 `code=0`**（`ps=3` 给 3 条）；`business_info` 为 `null`（非推广位）
- 限制：未登录 `mid=0`、无个性化；一次最多 30 条
- 来源：[recommend.md#获取首页视频推荐列表（web端）](https://github.com/pskdje/bilibili-API-collect/blob/master/docs/video/recommend.md)（L299–401）

---

## 6. 观看历史

### `GET https://api.bilibili.com/x/web-interface/history/cursor`

- 认证：Cookie `SESSDATA` → **只能查自己**（实测未登录 `-101`）
- 参数（`max`/`business`/`view_at` 三件套是「链表 next 指针」，要原样回传）：

| 参数 | 说明 |
|------|------|
| `max` | 截止目标 id：稿件=avid、剧集=ssid、直播=房间号、文集=rlid、文章=cvid；默认 0 |
| `business` | 截止业务：`archive`/`pgc`/`live`/`article-list`/`article` |
| `view_at` | 截止时间戳，0=当前 |
| `type` | 筛选：`all`(默认)/`archive`/`live`/`article` |
| `ps` | 每页项数，默认 20，**最大 30** |

- 返回：`data.cursor{max, view_at, business, ps}`、`data.tab[{type,name}]`、`data.list[]`
- `list[]` 字段：`title, long_title, cover, covers, uri, history{oid,epid,business,page,cid,...}, videos, author_name, author_face, author_mid, view_at, progress(秒), badge, show_title, duration, current, total, new_desc, is_finish, is_fav, kid`
- 特点：**能返回已失效稿件的信息**
- 来源：[history.md#获取历史记录列表_web端](https://github.com/pskdje/bilibili-API-collect/blob/master/docs/historytoview/history.md)（L1–100+）

---

## 7. 用户信息

### `GET /x/web-interface/card?mid=`（**免签，首选**）

- 实测：**`code=0`，无需登录、无需 WBI**
- 返回：`data.card{...}`、`data.following`（bool）、`data.archive_count`（投稿数）、`data.article_count`、`data.follower`、`data.like_num`
- `card` 字段：`mid(str), approve, name, sex, face, DisplayRank, **regtime(恒 0)**, **spacesta(0 正常 / -2 被封禁)**, birthday, place, description, article, attentions[], fans, friend, attention, sign, level_info{current_level,...}, pendant, nameplate, Official{role,title,desc,type}, official_verify, vip{...}, space`
- 用途：封禁状态、认证、粉丝数、签名、投稿数
- 来源：[info.md#用户名片信息](https://github.com/pskdje/bilibili-API-collect/blob/master/docs/user/info.md)（L518–750）

### `GET /x/space/wbi/acc/info?mid=&w_rid=&wts=`（字段最全，但**必须登录**）

- 鉴权：WBI 签名 + Cookie（需含 SESSDATA，且 Cookie 总项数 ≥3）
- 返回：`mid, name, sex, face, face_nft, sign, rank, level, **jointime(恒 0)**, moral(恒 0), silence(0 正常/1 封禁), coins(仅自己), fans_badge, fans_medal, official, vip, pendant, nameplate, user_honour_info, is_followed, top_photo, theme, sys_notice(小黄条/争议/纪念账号), live_room, birthday(MM-DD), school, profession, tags, series, is_senior_member, mcn_info, **gaia_res_type**, **gaia_data**, is_risk, elec, contract, certificate_show, name_render`
- **实测**：用真实签名（`mixin_key=ea1db124af3c7062474693fa704f4ff8`，与文档样例完全一致，说明算法没错）且未登录 → **`{"code":-352,"message":"风控校验失败","data":{"v_voucher":"voucher_..."}}`**
- 结论：**未登录时即使签名完全正确也会被 -352**，与项目 README 的判断一致；免签场景一律走 `card`
- 来源：[info.md#用户空间详细信息](https://github.com/pskdje/bilibili-API-collect/blob/master/docs/user/info.md)（L5–340）；[wbi.md](https://github.com/pskdje/bilibili-API-collect/blob/master/docs/misc/sign/wbi.md)；[v_voucher.md](https://github.com/pskdje/bilibili-API-collect/blob/master/docs/misc/sign/v_voucher.md)

### 注册时间（`jointime` / `regtime`）：**拿不到**

| 位置 | 字段 | 实况 |
|------|------|------|
| `/x/space/wbi/acc/info` | `jointime` | 文档原文「**此接口返回恒为 `0`**」；`moral` 同样恒 0 |
| `/x/web-interface/card` | `card.regtime` | 文档标「作用尚不明确」，实测 **0** |
| `/x/space/myinfo`（仅自己） | `jointime` | 文档标 0 / 作用不明 |
| `/x/space/upstat` | — | 无注册时间字段 |

→ **2025–2026 年没有任何公开接口给出注册时间**（`jointime` 曾是有效字段，早已被置 0）。此项结论：**未查到可用字段**，不要用 mid 推算时间戳（mid 不是纯雪花 id，误差极大）。

### `GET /x/relation/stat?vmid=`（**免签**）

- 实测 `code=0`，`code=0` 时返回：
  `mid, following(关注数), whisper(悄悄关注数), black(黑名单数), follower(粉丝数), fans_medal_toast, fans_effect`
- 注意 `black` 只有查自己时才有意义（别人看不到你的黑名单数，通常 0）
- 交叉验证：`bilibili-api` 的 `relation_stat` 明确 `verify: false`（不需登录）、参数仅 `vmid`

### `GET /x/space/navnum?mid=`（**免签，投稿数**）

- 实测 `code=0`，返回：
  `video, bangumi, cinema, channel, favourite, tag, article, playlist, album, audio, pugv, season_num, opus`
- 用途：不用 WBI 就能拿「投稿视频数」，比 `arc/search`（需 WBI）省事

### 其它

| 接口 | 状态 |
|------|------|
| `/x/space/upstat?mid=` | 免签 `code=0` 但**实测 `data:{}` 空对象**（播放量/阅读量需登录）→ 拿不到 |
| `/x/space/myinfo` | **只能查自己**，实测 `-101` |
| `/x/relation/tags`、`/x/relation/tag/special` | **只能查自己**，实测 `-101` |
| `/x/polymer/pc-electron/v1/user/cards` | 多用户批量资料（文档有，未实测） |

---

## 8. 视频详情里的「商单 / 广告」标记

### `GET /x/web-interface/view?aid=|bvid=`（**免签**）

- 实测 `code=0`。`data` 字段（本次真实响应，47 个）：
  `bvid, aid, videos, tid, tid_v2, tname, tname_v2, copyright, pic, title, pubdate, ctime, desc, desc_v2, state, duration, rights, owner, stat, argue_info, dynamic, cid, dimension, premiere, teenage_mode, is_chargeable_season, is_story, is_upower_exclusive, is_upower_play, is_upower_preview, enable_vt, vt_display, is_upower_exclusive_with_qa, is_hua_sheng, no_cache, pages, subtitle, is_season_display, user_garb, honor_reply, like_icon, need_jump_bv, disable_show_up_info, is_story_play, is_view_self`
- `data.rights` 18 个：`bp, elec, download, movie, pay, hd5, no_reprint, autoplay, ugc_pay, is_cooperation, ugc_pay_preview, no_background, clean_mode, is_stein_gate, is_360, no_share, arc_pay, free_watch`
- **`is_charge` 不存在**（既不在 `data` 也不在 `rights`；只有 `is_chargeable_season`、`is_upower_exclusive`、`rights.ugc_pay`、`rights.pay`、`rights.arc_pay`）
- **`honor_reply` 不是商单**：它是荣誉（`honor[]{aid, type, desc, weekly_recommend_num}`，`type`：1 入站必刷 / 2 第 N 期每周必看 / 3 全站排行榜最高第 N 名 / 4 热门）。实测该视频为 `{}`
- `argue_info{argue_msg, argue_type, argue_link}`：争议/警告信息，与广告无关（实测全空）
- **「商单」「悬赏计划」「商业推广」布尔字段：未查到。** `view` 响应里没有任何 ad/商单/business 字段；`bilibili-API-collect` 全库检索「商单」「悬赏」**0 命中**；`bilibili-api` 库里「商单」只出现在 `video_uploader.py` 的上传元数据（商单行业/商单形式），不是查询字段。

### 能拿到的、最接近的商业化信号

| 字段 / 位置 | 说明 |
|-------------|------|
| **`rcmd.item[].business_info`** | **唯一明确的「商业推广」标志**。`null` = 普通内容；非 `null` 时，被推广的视频信息在其 `archive` 属性下 |
| `data.mission_id` | 稿件参与的活动 id（不等于商单） |
| `data.rights.is_cooperation` | 联合投稿（≠ 商单） |
| `data.tags / tag_id / tag_type` | `/x/tag/archive/tags` 可拿；UP 主自填的「商单」标签不可当官方标识 |
| `data.desc` / `desc_v2[]` | 简介原文。`desc_v2` 每项 `{raw_text, type, biz_id}`，`type=2` 是 @某人。**淘宝客/带货链接没有结构化字段，只能从这里正则或 AI 抽取** |
| `comment.cm` / `cm_info` | 评论区广告位（评论列表里） |

→ 实操建议：商单判定 = `rcmd.business_info != null`（在推荐流里能抓到时）+ `desc` 里的短链/淘口令正则 + 标签白名单；**不存在一个「是不是商单」的官方布尔位**。

- 来源：[info.md#获取视频详细信息(web端)](https://github.com/pskdje/bilibili-API-collect/blob/master/docs/video/info.md)（L5–502）；[recommend.md](https://github.com/pskdje/bilibili-API-collect/blob/master/docs/video/recommend.md)（L355–385）

---

## 9. 动态

### `GET https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/space`

> 别名（同一份数据）：`https://api.bilibili.com/x/polymer/web-dynamic/desktop/v1/feed/space`

- 鉴权（文档原文）：
  - **未登录**：`User-Agent` 必须像浏览器，Cookie **需含 `buvid3`**，**WBI 签名**，外加 **`dm_img` 系列风控参数**
  - **已登录**：Cookie 含有效 `SESSDATA` 即可
- 参数：`host_mid`（✓）、`offset`、`timezone_offset`（默认 `-480`）、`platform`（`web`）、`features`（默认 `itemOpusStyle,listOnlyfans,opusBigCover,onlyfansVote,forwardListHidden,decorationCard,commentsNewVersion,onlyfansAssetsV2,ugcDelete,onlyfansQaCard`）、`web_location=333.1387`、`dm_img_switch`（登录时）、`dm_img_list`/`dm_img_str`/`dm_cover_img_str`/`dm_img_inter`（**未登录时**）、`x-bili-device-req-json`、`x-bili-web-req-json`、`w_rid`/`wts`
- 返回：`data{has_more, offset, items[]}`；`items[]` 形如 `{id_str, type, basic{comment_id_str, comment_type, rid_str, jump_url}, modules{module_author{mid,name,face,pub_time,pub_ts,...}, module_dynamic{desc{rich_text_nodes[]}, major{opus|archive|draw|article}}, module_stat{like,comment,forward}}}`（与 `/x/polymer/web-dynamic/v1/feed/all` 同构）
- 实测：未登录无签名 → **`-352`**（与本项目 README 中「`/x/polymer/web-dynamic/desktop/v1/feed/space` 正常」不矛盾：浏览器内带上 `buvid3`+`WBI`+`dm_img` 才通）
- 限制：文档明说「该接口现在有一些奇奇怪怪的校验，**存在一定运气成分**」，建议**登录后再调**（issue #686）
- 来源：[space.md#获取用户空间动态](https://github.com/pskdje/bilibili-API-collect/blob/master/docs/dynamic/space.md)（L1–46）

---

## 10. 风控

### 错误码（文档原文）

| code | 含义 |
|------|------|
| **-352** | 风控校验失败（UA 或 wbi 参数不合法） |
| **-412** | 请求被拦截（客户端 ip 被服务端风控） |
| **-799** | 请求过于频繁，请稍后再试 |
| -509 | 超出限制 |
| -111 | csrf 校验失败 |
| -403 | 访问权限不足（**WBI 签名错也走这里**） |

### -412 的实测特征（重要）

- 触发后返回 **HTTP 412 + HTML 错误页**（`<title>出错啦! - bilibili.com</title>`），**不是 JSON**
- → 客户端必须先看 HTTP 状态码 / `Content-Type`，否则 `JSON.parse` 直接抛异常
- 本次触发点：累计约 **25 次**请求（间隔 1.4–1.8 s，同一 IP）后，`/x/space/wbi/arc/search` 返回 412
- 退避：社区与库的一致说法是「IP 被临时封禁」，只能等或换代理（`bilibili-api` FAQ 原文：「你的 IP 会暂时被封禁而无法使用，你可以设置代理绕过」）。经验值 **60 s 起**，连续触发则 5–15 min

### -352 的实测特征（重要）

- 返回 JSON：`{"code":-352,"message":"风控校验失败","data":{"v_voucher":"voucher_<uuid>"}}`
- 触发条件不止「签名错」：**签名完全正确但未登录**，调 `/x/space/wbi/acc/info`、`/x/space/wbi/arc/search`、`/x/polymer/web-dynamic/v1/feed/space` 都会 -352
- 排查顺序（文档建议）：先查 WBI 签名 → 再查 `UA` / `Referer` → 再查 Cookie 里 `bili_ticket`、`b_nut`、`buvid3`、`buvid4` 是否齐 → 最后才是验证码

### gaia / v_voucher 验证流程（2024 后新增，文档专章）

1. 请求被风控 → `code=-352` 且 `data.v_voucher`（若 `data` 里没有，看响应头 **`x-bili-gaia-vvoucher`**）
2. `POST https://api.bilibili.com/x/gaia-vgate/v1/register`，body：`csrf`(可空) + `v_voucher` → 返回 `type:geetest`、`token`、`geetest{gt, challenge}`（`geetest` 为 null 说明该风控**无法**用验证码解除）
3. 按极验完成验证，拿 `validate` / `seccode`
4. `POST https://api.bilibili.com/x/gaia-vgate/v1/validate`，body：`challenge`、`token`、`validate`、`seccode`、`csrf` → 返回 `data.grisk_id`（即 `gaia_vtoken`）
5. 重放原请求：**URL 加 `gaia_vtoken`，Cookie 加 `x-bili-gaia-vtoken`**
- 注意：同一 `v_voucher` 只能用一次；验证码需人工

### WBI 签名实现要点（算法本次已验证未变）

1. `GET https://api.bilibili.com/x/web-interface/nav`（**无需登录**，返回 `-101` 也带 `wbi_img`）→ `data.wbi_img.img_url` / `sub_url`，取文件名（去 `.png`）即 `img_key` / `sub_key`
   - 实测未登录也能拿到：`img_url=.../7cd084941338484aae1ad9425b84077c.png`、`sub_url=.../4932caff0ff746eab6f01bf08b70ac45.png`
   - **按天轮换，必须缓存 + 定时刷新**；`bili_ticket` 接口的 `nav.img/sub` 也能拿到
2. `raw = img_key + sub_key`，用 64 长度重排表 `MIXIN_KEY_ENC_TAB` 取字符拼成 `mixin_key`，**截前 32 位**
   ```
   46,47,18,2,53,8,23,32,15,50,10,31,58,3,45,35,27,43,5,49,33,9,42,19,29,28,14,39,
   12,38,41,13,37,48,7,16,24,55,40,61,26,17,0,1,60,51,30,4,22,25,54,21,56,59,6,63,
   57,62,11,36,20,34,44,52
   ```
   实测 `7cd0... + 4932...` → `ea1db124af3c7062474693fa704f4ff8`，与文档样例一致
3. 参数加 `wts`（秒级时间戳）→ **按 key 升序** → 百分号编码 URL Query（**十六进制大写**、空格编 `%20` 不是 `+`、按 `encodeURIComponent` 口径）→ 末尾拼 `mixin_key` → **MD5** = `w_rid`
4. 把 `w_rid`、`wts` 追加到原始 query（原始参数顺序无需排序）

### 2024 年后需要的 Cookie / 头

| 名称 | 作用 | 获取 |
|------|------|------|
| `buvid3` | 设备指纹，**很多接口硬要求** | `GET https://api.bilibili.com/x/web-frontend/getbuvid`，或 `GET /` 的 `Set-Cookie` |
| `buvid4` | 更细设备指纹，降低风控概率 | `GET https://api.bilibili.com/x/frontend/finger/spi` → `data.b_3`(buvid3) / `data.b_4`(buvid4) |
| `b_nut` | 与 buvid3 配对的时间戳 | 同 `GET /` 的 `Set-Cookie`（不带 Cookie 时为当前时间戳；只带 buvid3 时为 100） |
| `bili_ticket` | **2024 新增**，JWT，有效期 259200 s（3 天），「非必需但存在可降低风控概率」 | `POST https://api.bilibili.com/bapis/bilibili.api.ticket.v1.Ticket/GenWebTicket?key_id=ec02&hexsign=<hmac_sha256("ts"+ts, key="XgwSnGZ1p")>&context[ts]=<ts>&csrf=<bili_jct>` |
| `SESSDATA` + `bili_jct` | 登录态与 csrf | 浏览器登录 |
| `x-bili-gaia-vtoken` | gaia 风控通过后的令牌（Cookie 同名 + URL `gaia_vtoken`） | 见上 gaia 流程 |
| `dm_img_list` / `dm_img_str` / `dm_cover_img_str` / `dm_img_inter` | **动态接口专用**风控参数（未登录时存在） | 文档未给生成算法 → **未查到** |
| `buvid_fp`、`_uuid` | 浏览器端指纹 | 文档未收录生成算法 → **未查到**（浏览器里由 JS 生成，用户脚本内可直接复用现成 Cookie，无需自造） |

### 建议的退避策略（工程实践，非官方数值）

- 单出口并发 1–2，串行间隔 ≥1.2 s；批量操作 ≥2 s
- 遇 `-799`：sleep 2–5 s 重试，连续 3 次则停 60 s
- 遇 `-352`：**不要重试**，检查签名/UA/Referer/Cookie 组合；同一 endpoint 连续 2 次则放弃该 endpoint
- 遇 `-412`：全站停 60–120 s（指数翻倍），并把 `-412` 当「IP 级」而非「接口级」
- 遇 `22008`：黑名单满，直接停并提示用户

---

## 11. 对本项目（立体防御）的直接影响

已核实的结论（对应 README「已知边界」）：

| README 说法 | 核实结果 |
|-------------|----------|
| 无「按 mid 查全站评论」接口，`/x/v2/reply/user`、`/x/space/comment` 均 404 | ✅ 实测 404（另测 `/x/v2/reply/member` 也 404） |
| `/x/space/wbi/acc/info` 即使签名正确也可能 -352 | ✅ 实测签名正确（mixin_key 与文档样例一致）仍 -352，且返回 `v_voucher` |
| 约 25 次快速请求触发 -412 | ✅ 本次同样在约第 25 次触发 |
| 412 后需冷却约 60 s | 与 `bilibili-api` FAQ 一致（IP 临时封禁），60 s 为经验下限 |

可以直接利用的新信息：

1. **批量拉黑有官方接口**：`POST /x/relation/batch/modify`，`fids` ≤50、`act=5`。比逐条 `modify` 快 50 倍，且同样只吃一次风控预算。**批量解除拉黑没有**（只能逐条 `act=6`）。
2. **`-403`/`-352` 时的评论降级路径**：`/x/v2/reply`、`/x/v2/reply/main`、`/x/v2/reply/reply`、`/x/v2/reply/count` 目前**全部免签可用**（实测 `code=0`）。`wbi/main` 挂了不必停扫。
3. **免签就能拿的账号画像字段**：`/x/relation/stat`（关注/粉丝/黑名单数）、`/x/space/navnum`（投稿数）、`/x/web-interface/card`（封禁 `spacesta`、认证、签名、粉丝数）。这三条不该占用 WBI 与风控预算。
4. **补充证据源（免签）**：`/x/web-interface/popular`、`/x/web-interface/ranking/v2`、`/x/web-interface/wbi/index/top/feed/rcmd` 实测均 `code=0`，可用作「同温层」信号。
5. **商单无法从 `view` 判定**：没有布尔位。要么抓 rcmd 的 `business_info`，要么正则 `desc`。
6. **`-412` 返回 HTML**：`transport.ts` 必须按 `content-type`/HTTP 状态分流，否则 JSON 解析抛错会被误判成「接口异常」并触发重试，进一步加重风控。
7. **参数修正**：`/x/relation/fans` **没有 `order`** 参数；`/x/relation/fans/stat` **不存在**（404）；关注/粉丝列表对「别人」都只到 100 条，且到顶返回空列表 + `code=0`（**不能靠 code 判断是否还有下一页**，要用 `total`/`offset` 或条数）。
8. **注册时间拿不到**，画像里不要设计「账号年龄」这一维（或改用「最早可见内容时间 / 关注时间 `mtime`」做代理变量）。

---

## 12. 来源

**接口文档（镜像，2026-01-25 快照）**

- 仓库总览：<https://github.com/pskdje/bilibili-API-collect>（原始仓库已关停：<https://github.com/SocialSisterYi/bilibili-API-collect/blob/deprecated/README.md>）
- 用户关系：<https://github.com/pskdje/bilibili-API-collect/blob/master/docs/user/relation.md>
- 用户信息：<https://github.com/pskdje/bilibili-API-collect/blob/master/docs/user/info.md>
- 评论区：<https://github.com/pskdje/bilibili-API-collect/blob/master/docs/comment/list.md>
- 视频信息：<https://github.com/pskdje/bilibili-API-collect/blob/master/docs/video/info.md>
- 热门：<https://github.com/pskdje/bilibili-API-collect/blob/master/docs/video_ranking/popular.md>
- 排行榜：<https://github.com/pskdje/bilibili-API-collect/blob/master/docs/video_ranking/ranking.md>
- 推荐流：<https://github.com/pskdje/bilibili-API-collect/blob/master/docs/video/recommend.md>
- 历史记录：<https://github.com/pskdje/bilibili-API-collect/blob/master/docs/historytoview/history.md>
- 用户动态：<https://github.com/pskdje/bilibili-API-collect/blob/master/docs/dynamic/space.md>
- WBI 签名：<https://github.com/pskdje/bilibili-API-collect/blob/master/docs/misc/sign/wbi.md>
- bili_ticket：<https://github.com/pskdje/bilibili-API-collect/blob/master/docs/misc/sign/bili_ticket.md>
- v_voucher / gaia：<https://github.com/pskdje/bilibili-API-collect/blob/master/docs/misc/sign/v_voucher.md>
- buvid3/4：<https://github.com/pskdje/bilibili-API-collect/blob/master/docs/misc/buvid3_4.md>
- 公共错误码：<https://github.com/pskdje/bilibili-API-collect/blob/master/docs/misc/errcode.md>

**库（交叉验证）**

- `bilibili-api-python` 17.4.2（本次下载 wheel 解包核对 `data/api/*.json`）：<https://pypi.org/project/bilibili-api-python/>
- 仓库（已 archive）：<https://github.com/Nemo2011/bilibili-api>
- 412 FAQ（原文「IP 会暂时被封禁…设置代理绕过」）：同上 README

**社区来源（非官方，已标注）**

- 黑名单上限经验公式 `500 + int(粉丝数/10000)*20`，封顶 5000：<https://github.com/asdfg231/bilibili_xiaofenhong>
- 黑名单上限讨论：<https://ngabbs.com/read.php?tid=34717488>
- 黑名单现状吐槽（仅佐证「有上限」）：<https://www.bilibili.com/opus/869689980783427602>
