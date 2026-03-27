<div align="center">

# <img src="https://raw.githubusercontent.com/vrcx-team/VRCX/master/images/VRCX.ico" width="64" height="64"> VRCX-地雷Edition

[![GitHub Workflow Status](https://github.com/FuLuTang/VRCX-jirai/actions/workflows/github_actions.yml/badge.svg)](https://github.com/FuLuTang/VRCX-jirai/actions/workflows/github_actions.yml)

### **专为地雷人打造的视奸神器**

</div>

这是 [VRCX](https://github.com/vrcx-team/VRCX) 的魔改分支。原版 VRCX 已经很好用了，但要想成为一名合格的 **地雷男/女**，光知道朋友在不在线怎么够？

你还需要知道 TA 和谁在一起 ~~、去了哪里、待了多久、为什么不陪你玩~~ 👁️...

于是就有了这个版本。

- 可以从 [Releases](https://github.com/FuLuTang/VRCX-jirai/releases/latest) 页面下载最新安装包（`VRCX_Setup.exe`）直接安装。
- 如果想下载测试最新的构建版本，请点击 [GitHub Actions](https://github.com/FuLuTang/VRCX-jirai/actions/workflows/github_actions.yml)。
- 如需从源码构建，请参考下方"从源码构建"说明。

<div align="center">

> 抵制不良关系，拒绝盲目地雷。<br>注意自我保护，谨防受骗上当。<br>适度视奸益脑，沉迷VRC伤身。<br>合理安排关系，享受健康生活。<br><br>`功能仅供娱乐，勿用非法用途!`

</div>

> 叠甲：<br>本分支仅添加了更多的“数据展示”的功能。
所有的功能都是基于 VRCX 的原版数据库和原版接口API，没有实现任何有关“不该获取到的信息”。
所有抓取到的信息都是**公开**的，**不存在任何盗取隐私**的行为。
<br>如果你认为有任何不妥之处（如某类信息不该被获取），请向 `VRCX` 官方反馈，而不是向我。
而`VRCX`官方不同意此分支的意图与初衷。
<br>`VRCX-jirai`的使用者会自动加入`VRCX-jirai`的Group，理由为：**被视奸者亦有知情权**。这给了普通玩家自由选择是否被视奸的权利。

# 核心功能

<div align="left">

- :couple: **双人关系查询 (TwoPersonRelationship)** （核心推荐）
    - 从你的好友列表中任选两人，一键查询他们**共同在一个房间待过的所有记录**。
    - **极限细节**：不仅仅是共存时间，还能看到当时“房主是谁”、“最高达到过多少人数”，并且会标记**“你当时在不在场”**。
    - 换句话说：你想知道 A 和 B 到底有多熟吗？数据会告诉你答案。

- :detective: **像查代码一样查签名记录 (Bio Diff View)** （新！）
    - 去掉了原版干巴巴的简介历史，新增了一个类似 `Git Diff` 的界面。
    - 朋友改了简介，**红字**代表删掉的话，**绿字**代表加进来的话。到底暗戳戳加了谁的名字还是一眼就能看出来！
    - **24小时智能合并**：一天之内哪怕改了 10 次简介，也会自动合并成一条精简的差异记录。不再满屏垃圾信息。

- :hourglass_flowing_sand: **关系时间轴 (Relationship Timeline)**
    - 以时间流的形式，直观地列出你的时间分配都花在谁身上了。

- :footprints: **自动跟随好友实例 (Auto Follow)**
    - 在好友的个人信息卡片上，新增了一个“一键跟随”按钮。
    - 点击后，软件会自动检测该好友当前所在的实例类型：
        - 如果是**公共实例**，软件会直接尝试启动游戏并加入该实例。
        - 如果是**好友+实例**或**私密实例**，软件会先尝试直接打开实例链接；如果失败（例如游戏未运行或实例已关闭），则会自动退出当前游戏，并以**“带参数启动”**的方式重新运行游戏，从而加入该实例。
    - 完美解决“想跟好友去TA的房间，但游戏没开/实例已关，还得手动退游戏再启动”的繁琐步骤。
    `PC状态下为重新启动游戏加入实例，VR状态下为直接打开实例链接`

</div>

# 原版体验优化

- :fire: 解锁了 ~~不知为何原版做了但没开放的~~ **热门世界 (HotWorlds)** 功能
    - 统计你在一段时间内（7 天 / 30 天 / 90 天）去得最多的世界，顺便反省一下自己的 VRC 人生。

- :mag: **搜索功能 增强 (Quick Search)**
    - 在顶部的快捷搜索下拉列表中，额外展示了 **“最近遇到的人”** 和 **“最近加入的世界”**，方便快速查找刚才接触过的玩家和实例。

- :pencil2: **新增 好友签名存档工具 (System Tools)**
    - 在“系统工具”中新增了 **“批量拉取并保存好友简介”** 的功能。适合在新设备或者初次使用本软件时，一键将所有好友当前的签名留底存档，以便更好地配合“查简介日志（Bio Diff）”功能使用。

- :stopwatch: **状态持续时间 计时器修复**
    - 修复了原版 VRCX 在重启后，会把好友当前“在这个房间停留了多久”的计时器强制归零的问题。现在只要好友还在原先的实例中，即使重启软件也会从本地日志恢复真实的加入时间戳，让停留时长显示更加准确。

- **与原版 VRCX 同步**
    - 持续跟进上游 `vrcx-team/VRCX` 更新，比如原版最新的 Electron 40 内核、原版新增的好友热力图等，用着魔改版也能享受最新功能。

# 从源码构建

请参考上游仓库的 [Building from source](https://github.com/vrcx-team/VRCX/wiki/Building-from-source) 说明进行构建。

# Contact 社群
QQ群号: `1043634732`

---

> VRCX-jirai Edition is not endorsed by VRChat and does not reflect the views or opinions of VRChat or anyone officially involved in producing or managing VRChat properties. VRChat and all associated properties are trademarks or registered trademarks of VRChat Inc. VRChat © VRChat Inc.

## Star History

[![Star History Chart](https://api.star-history.com/image?repos=FuLuTang/VRCX-jirai&type=date&legend=top-left)](https://www.star-history.com/?repos=FuLuTang%2FVRCX-jirai&type=date&legend=top-left)
