import type { NewsItem, SourceId } from "@/lib/types";
import { makeItemId } from "@/lib/sources/base";

interface MockSeed {
  title: string;
  url: string;
  summary?: string;
  /** 距现在多少小时前发布 */
  hoursAgo: number;
  hotValue?: number;
}

/**
 * 示例数据：当信源网络不可达或页面结构变化导致抓取失败时使用。
 * 各信源之间刻意覆盖相同事件（价格战、智驾监管、出海关税、召回等），
 * 以便离线状态下也能演示跨信源聚类与热度排序。
 */
const MOCK_SEEDS: Record<SourceId, MockSeed[]> = {
  "36kr": [
    { title: "比亚迪宣布多款车型限时降价，最高优惠达 2 万元，价格战再度升温", url: "https://36kr.com/p/mock-byd-price-cut", summary: "比亚迪王朝网与海洋网多款车型推出限时一口价，业内认为新一轮价格战将在四季度全面展开。", hoursAgo: 3 },
    { title: "工信部就 L3 级智能驾驶准入管理征求意见，明确事故责任划分", url: "https://36kr.com/p/mock-l3-policy", summary: "征求意见稿要求车企对辅助驾驶功能命名和宣传进行规范，不得使用“自动驾驶”等误导性表述。", hoursAgo: 6 },
    { title: "小米 YU7 交付提速：单月交付破 3 万辆，雷军称产能仍是最大瓶颈", url: "https://36kr.com/p/mock-xiaomi-yu7", summary: "小米汽车二期工厂全面投产，YU7 累计锁单超过 30 万台。", hoursAgo: 10 },
    { title: "欧盟对中国电动汽车反补贴税复审启动，车企出海面临新一轮博弈", url: "https://36kr.com/p/mock-eu-tariff", summary: "多家中国车企已在欧洲本地化建厂，试图绕开关税壁垒。", hoursAgo: 20 },
    { title: "宁德时代固态电池中试线下线，能量密度突破 500Wh/kg", url: "https://36kr.com/p/mock-catl-solid", summary: "宁德时代表示全固态电池将于 2027 年小批量装车。", hoursAgo: 30 },
    { title: "蔚来三季度交付 8.7 万辆创历史新高，乐道 L90 贡献超三成", url: "https://36kr.com/p/mock-nio-q3", hoursAgo: 44 },
    { title: "零跑汽车连续三个月销量破 5 万辆，成为新势力销量冠军", url: "https://36kr.com/p/mock-leapmotor", hoursAgo: 52 },
  ],
  autohome: [
    { title: "比亚迪秦 PLUS、宋 PLUS 限时一口价 官降幅度最高 2 万元", url: "https://www.autohome.com.cn/news/mock/byd-price.html", summary: "[汽车之家 新车上市] 比亚迪官方宣布对部分主销车型进行限时调价，覆盖秦 PLUS、宋 PLUS、海豹 06 等。", hoursAgo: 2 },
    { title: "余承东：尊界 SUV 有望广州车展发布 明年一季度上市交付", url: "https://www.autohome.com.cn/news/mock/zunjie-suv.html", summary: "[汽车之家 资讯] 尊界 SUV 设计已定型，进入量产前最后准备阶段。", hoursAgo: 1 },
    { title: "全新一代宝马 3 系燃油版将于 9 月 30 日全球首发", url: "https://www.autohome.com.cn/news/mock/bmw-3.html", hoursAgo: 5 },
    { title: "新款问界 M8 内饰官图发布 新增沙砾棕与澜月白配色", url: "https://www.autohome.com.cn/news/mock/aito-m8.html", hoursAgo: 7 },
    { title: "小米 YU7 累计交付突破 10 万辆 新增两款车漆颜色", url: "https://www.autohome.com.cn/news/mock/xiaomi-yu7.html", hoursAgo: 12 },
    { title: "工信部拟出台智驾新规 辅助驾驶功能宣传将被严格规范", url: "https://www.autohome.com.cn/news/mock/adas-rule.html", summary: "[汽车之家 行业] 新规要求车企不得夸大宣传，功能名称需与实际能力一致。", hoursAgo: 8 },
    { title: "大众汽车全球召回约 286 万辆车 转向系统存在安全隐患", url: "https://www.autohome.com.cn/news/mock/vw-recall.html", hoursAgo: 15 },
    { title: "吉利银河 M9 上市 售价 17.38 万元起 搭载千里浩瀚智驾", url: "https://www.autohome.com.cn/news/mock/geely-m9.html", hoursAgo: 26 },
    { title: "特斯拉 Model Y L 六座版开启交付 售价 33.9 万元", url: "https://www.autohome.com.cn/news/mock/tesla-yl.html", hoursAgo: 38 },
  ],
  dongchedi: [
    { title: "懂车帝关注度榜第 1 名：小米 YU7（25.35-32.99万）", url: "https://www.dongchedi.com/auto/series/mock-yu7", summary: "日均关注度 1,250,000，较昨日上升 2 位。", hoursAgo: 4, hotValue: 1250000 },
    { title: "懂车帝关注度榜第 2 名：比亚迪 海鸥（6.98-8.58万）", url: "https://www.dongchedi.com/auto/series/mock-seagull", summary: "日均关注度 1,120,000，新款实车亮相带动关注。", hoursAgo: 4, hotValue: 1120000 },
    { title: "懂车帝关注度榜第 3 名：问界 M8（35.98-44.98万）", url: "https://www.dongchedi.com/auto/series/mock-m8", summary: "日均关注度 980,000。", hoursAgo: 4, hotValue: 980000 },
    { title: "懂车帝关注度榜第 4 名：特斯拉 Model Y（26.35-33.90万）", url: "https://www.dongchedi.com/auto/series/mock-model-y", summary: "日均关注度 910,000。", hoursAgo: 4, hotValue: 910000 },
    { title: "懂车帝关注度榜第 5 名：吉利银河 M9（17.38-22.88万）", url: "https://www.dongchedi.com/auto/series/mock-galaxy-m9", summary: "日均关注度 860,000，新上榜。", hoursAgo: 4, hotValue: 860000 },
    { title: "懂车帝销量榜第 1 名：比亚迪 秦 PLUS 销量 31,208 辆", url: "https://www.dongchedi.com/auto/series/mock-qin", summary: "上月销量，指导价 7.98-12.98万", hoursAgo: 4, hotValue: 31208 },
    { title: "懂车帝销量榜第 2 名：特斯拉 Model Y 销量 29,760 辆", url: "https://www.dongchedi.com/auto/series/mock-model-y-sales", summary: "上月销量", hoursAgo: 4, hotValue: 29760 },
    { title: "懂车帝销量榜第 3 名：零跑 C10 销量 18,420 辆", url: "https://www.dongchedi.com/auto/series/mock-c10", summary: "上月销量", hoursAgo: 4, hotValue: 18420 },
  ],
  "sina-auto": [
    { title: "比亚迪多车型官降 价格战蔓延至 10 万元级市场", url: "https://auto.sina.com.cn/news/mock/detail-byd.shtml", hoursAgo: 4 },
    { title: "工信部规范智驾宣传 “自动驾驶”“脱手”等表述被禁用", url: "https://auto.sina.com.cn/news/mock/detail-adas.shtml", hoursAgo: 9 },
    { title: "限时 27.98-35.98 万元 东风奕境 X9 正式上市", url: "https://auto.sina.com.cn/newcar/mock/detail-yijing.shtml", hoursAgo: 14 },
    { title: "广汽集团与一汽股份签署战略合作意向协议", url: "https://auto.sina.com.cn/news/mock/detail-gac-faw.shtml", hoursAgo: 40 },
    { title: "长安启源 Q06 上市 限时权益价 13.59 万元起", url: "https://auto.sina.com.cn/newcar/mock/detail-q06.shtml", hoursAgo: 60 },
    { title: "欧盟启动对华电动车关税复审 车企出海加速本地化", url: "https://auto.sina.com.cn/news/mock/detail-eu.shtml", hoursAgo: 22 },
    { title: "小米 YU7 单月交付破 3 万辆 产能爬坡仍在继续", url: "https://auto.sina.com.cn/news/mock/detail-yu7.shtml", hoursAgo: 11 },
  ],
  gasgoo: [
    { title: "中国车企在东南亚，开始为卖得太好“买单”", url: "https://auto.gasgoo.com/news/mock/sea.shtml", hoursAgo: 18 },
    { title: "美参议员推动禁止中国汽车法案，出海北美再添变数", url: "https://auto.gasgoo.com/news/mock/us-ban.shtml", hoursAgo: 19 },
    { title: "欧盟反补贴税复审：中国电动车出海欧洲的下一步", url: "https://auto.gasgoo.com/news/mock/eu-review.shtml", hoursAgo: 21 },
    { title: "全新一代智己 LS6 上市，售价 21.99 万元起", url: "https://auto.gasgoo.com/news/mock/im-ls6.shtml", hoursAgo: 28 },
    { title: "价格战再起：比亚迪官降之后，谁会跟进？", url: "https://auto.gasgoo.com/news/mock/price-war.shtml", hoursAgo: 5 },
    { title: "宁德时代固态电池中试线下线，产业化进程提速", url: "https://auto.gasgoo.com/news/mock/catl.shtml", hoursAgo: 31 },
    { title: "大众因转向系统隐患在全球召回约 286 万辆汽车", url: "https://auto.gasgoo.com/news/mock/vw-recall.shtml", hoursAgo: 16 },
    { title: "8 月动力电池装车量同比增长 38%，宁德时代份额回升", url: "https://auto.gasgoo.com/news/mock/battery-aug.shtml", hoursAgo: 50 },
  ],
  d1ev: [
    { title: "EV晨报 | 比亚迪多车官降；工信部规范智驾宣传；小米 YU7 交付破 3 万", url: "https://www.d1ev.com/news/shichang/mock-001", hoursAgo: 6 },
    { title: "重组大势下，僵而不死的哪吒众泰们，又要复活了？", url: "https://www.d1ev.com/news/shichang/mock-002", hoursAgo: 24 },
    { title: "全球动力电池装车量：前 8 个月同比增加 123GWh，七家中国企业合计新增 108.8GWh", url: "https://www.d1ev.com/news/shuju/mock-003", hoursAgo: 36 },
    { title: "中国车在欧洲便宜 30% 到 40%，现代 CEO 喊话美国守住关税护栏", url: "https://www.d1ev.com/news/qiye/mock-004", hoursAgo: 23 },
    { title: "宁德时代全固态电池中试下线，能量密度 500Wh/kg 意味着什么", url: "https://www.d1ev.com/news/jishu/mock-005", hoursAgo: 32 },
    { title: "9 月第三周新势力周销量：零跑、小米、问界位列前三", url: "https://www.d1ev.com/news/shuju/mock-006", hoursAgo: 46 },
    { title: "以旧换新补贴延续至年底，新能源渗透率有望站稳 55%", url: "https://www.d1ev.com/news/zhengce/mock-007", hoursAgo: 58 },
  ],
  chedongxi: [
    { title: "华为第二“境”首车开卖！限时 27.98 万，高管喊话：最好的华为在奕境", url: "https://chedongxi.com/p/mock-yijing", summary: "比预售降 2 万，上车华为六大解决方案。", hoursAgo: 13 },
    { title: "车东西对话黑芝麻智能高管：下一代芯片仍以汽车场景为核心，会向 AI 端侧推理发展", url: "https://chedongxi.com/p/mock-bst", hoursAgo: 27 },
    { title: "工信部 L3 准入新规落地在即，智驾行业进入“强监管”时代", url: "https://chedongxi.com/p/mock-l3", summary: "宣传口径、功能命名、数据记录三大方向被严格约束。", hoursAgo: 7 },
    { title: "小米 YU7 交付破 3 万背后：二期工厂满产，雷军亲自下车间", url: "https://chedongxi.com/p/mock-yu7", hoursAgo: 12 },
    { title: "特斯拉 FSD 入华再传新进展，年内或在部分城市开放试用", url: "https://chedongxi.com/p/mock-fsd", hoursAgo: 35 },
    { title: "Momenta 与多家车企签约，城区领航辅助进入 15 万级市场", url: "https://chedongxi.com/p/mock-momenta", hoursAgo: 48 },
  ],
  ithome: [
    { title: "因转向系统存在隐患，大众将在全球范围内召回约 286 万辆汽车", url: "https://www.ithome.com/0/mock/vw-recall.htm", summary: "德国联邦汽车运输管理局 KBA 发布声明，涉及多款途观、帕萨特等车型。", hoursAgo: 14 },
    { title: "小米汽车：YU7 单月交付突破 3 万辆，SU7 累计交付超 40 万辆", url: "https://www.ithome.com/0/mock/xiaomi.htm", hoursAgo: 11 },
    { title: "比亚迪多款车型限时优惠最高 2 万元，官方回应：正常促销策略", url: "https://www.ithome.com/0/mock/byd.htm", hoursAgo: 3 },
    { title: "工信部：辅助驾驶不得宣传为“自动驾驶”，L3 准入管理办法征求意见", url: "https://www.ithome.com/0/mock/miit.htm", hoursAgo: 8 },
    { title: "特斯拉中国推出 Model 3 长续航后驱版，售价 26.95 万元", url: "https://www.ithome.com/0/mock/tesla-m3.htm", hoursAgo: 33 },
    { title: "蔚来发布三季度交付数据：87,000 辆，同比增长 40%", url: "https://www.ithome.com/0/mock/nio.htm", hoursAgo: 43 },
  ],
  "baidu-hot": [
    { title: "比亚迪多款车型官方降价", url: "https://www.baidu.com/s?wd=%E6%AF%94%E4%BA%9A%E8%BF%AA%E9%99%8D%E4%BB%B7", summary: "比亚迪宣布对秦 PLUS、宋 PLUS 等热销车型限时调价，网友热议价格战是否卷土重来。", hoursAgo: 2, hotValue: 4850000 },
    { title: "工信部规范智驾宣传", url: "https://www.baidu.com/s?wd=%E5%B7%A5%E4%BF%A1%E9%83%A8%E8%A7%84%E8%8C%83%E6%99%BA%E9%A9%BE%E5%AE%A3%E4%BC%A0", summary: "新规拟禁止“自动驾驶”“脱手”等误导性宣传用语。", hoursAgo: 6, hotValue: 3120000 },
    { title: "小米YU7交付量破3万", url: "https://www.baidu.com/s?wd=%E5%B0%8F%E7%B1%B3YU7", hoursAgo: 10, hotValue: 2760000 },
    { title: "大众全球召回286万辆汽车", url: "https://www.baidu.com/s?wd=%E5%A4%A7%E4%BC%97%E5%8F%AC%E5%9B%9E", hoursAgo: 15, hotValue: 2210000 },
    { title: "尊界SUV广州车展发布", url: "https://www.baidu.com/s?wd=%E5%B0%8A%E7%95%8CSUV", hoursAgo: 1, hotValue: 1980000 },
  ],
  "weibo-hot": [
    { title: "比亚迪降价", url: "https://s.weibo.com/weibo?q=%23%E6%AF%94%E4%BA%9A%E8%BF%AA%E9%99%8D%E4%BB%B7%23", hoursAgo: 2, hotValue: 3560000 },
    { title: "小米YU7月交付破3万", url: "https://s.weibo.com/weibo?q=%23%E5%B0%8F%E7%B1%B3YU7%23", hoursAgo: 9, hotValue: 2890000 },
    { title: "余承东回应尊界SUV进展", url: "https://s.weibo.com/weibo?q=%23%E5%B0%8A%E7%95%8CSUV%23", hoursAgo: 1, hotValue: 2410000 },
    { title: "工信部拟禁用自动驾驶宣传用语", url: "https://s.weibo.com/weibo?q=%23%E6%99%BA%E9%A9%BE%E6%96%B0%E8%A7%84%23", hoursAgo: 7, hotValue: 1870000 },
    { title: "大众召回286万辆", url: "https://s.weibo.com/weibo?q=%23%E5%A4%A7%E4%BC%97%E5%8F%AC%E5%9B%9E%23", hoursAgo: 14, hotValue: 1520000 },
    { title: "特斯拉ModelYL开始交付", url: "https://s.weibo.com/weibo?q=%23ModelYL%23", hoursAgo: 37, hotValue: 980000 },
  ],
  wechat: [
    { title: "比亚迪海豹06：限时权益价 9.98 万起，重新定调 10 万级插混市场", url: "https://mp.weixin.qq.com/mock/byd-seal-06", summary: "某汽车公众号：月销破 3 万后，比亚迪把智驾下放至 10 万元级。", hoursAgo: 4 },
    { title: "华为智驾首搭东风奕境，激光雷达 + ADS 4.0 进入 20 万级", url: "https://mp.weixin.qq.com/mock/dongfeng-yijing-ads", summary: "某汽车公众号：余承东透露，四季度将有 5 个品牌上车华为乾崑智驾。", hoursAgo: 8 },
    { title: "欧盟对中国电动车反补贴税落地三个月后，中企建厂路线变清晰了", url: "https://mp.weixin.qq.com/mock/eu-tariff", summary: "某汽车公众号：比亚迪匈牙利、宁德时代德国项目提速，本地化被视作唯一出路。", hoursAgo: 18 },
    { title: "小米汽车第二款车 YU7 产能爬坡，雷军称二期工厂 24 小时满产", url: "https://mp.weixin.qq.com/mock/xiaomi-yu7", summary: "某汽车公众号：YU7 累计锁单 18 万，月交付目标站上 3 万辆。", hoursAgo: 22 },
    { title: "特斯拉 Model Y 焕新版进店，尾款立减 7000 元，价格战再燃", url: "https://mp.weixin.qq.com/mock/tesla-model-y", summary: "某汽车公众号：国庆前多家车企推限时权益，四季度开场即降。", hoursAgo: 28 },
  ],
  "weibo-topic": [
    { title: "微博话题：#新能源汽车#", url: "https://s.weibo.com/weibo?q=%23%E6%96%B0%E8%83%BD%E6%BA%90%E6%B1%BD%E8%BD%A6%23", hoursAgo: 1, hotValue: 2840000 },
    { title: "微博话题：#智能驾驶#", url: "https://s.weibo.com/weibo?q=%23%E6%99%BA%E8%83%BD%E9%A9%BE%E9%A9%B6%23", hoursAgo: 1, hotValue: 1960000 },
    { title: "微博话题：#汽车价格战#", url: "https://s.weibo.com/weibo?q=%23%E6%B1%BD%E8%BD%A6%E4%BB%B7%E6%A0%BC%E6%88%98%23", hoursAgo: 1, hotValue: 1520000 },
    { title: "微博话题：#比亚迪降价#", url: "https://s.weibo.com/weibo?q=%23%E6%AF%94%E4%BA%9A%E8%BF%AA%E9%99%8D%E4%BB%B7%23", hoursAgo: 1, hotValue: 1210000 },
    { title: "微博话题：#尊界SUV广州车展发布#", url: "https://s.weibo.com/weibo?q=%23%E5%B0%8A%E7%95%8CSUV%E5%B9%BF%E5%B7%9E%E8%BD%A6%E5%B1%95%E5%8F%91%E5%B8%83%23", hoursAgo: 1, hotValue: 980000 },
  ],
  bilibili: [
    { title: "1100 匹马力，27.98 万！比亚迪汉 L 开起来有多疯狂？", url: "https://www.bilibili.com/video/BV1XddPYjEq7", summary: "UP：极速拍档 · 播放量 1,390,798 · 弹幕 11,141 · 综合得分 304,862", hoursAgo: 6, hotValue: 304862 },
    { title: "我一定要让老外，都羡慕中国车！【宝骏享境】", url: "https://www.bilibili.com/video/BV1BqRUY5Eva", summary: "UP：极速拍档 · 播放量 853,112 · 弹幕 5,128 · 综合得分 367,022", hoursAgo: 10, hotValue: 367022 },
    { title: "上海街头开 007 特工超跑，有多帅？", url: "https://www.bilibili.com/video/BV17vRUY1EUa", summary: "UP：极速拍档 · 播放量 976,169 · 弹幕 3,819 · 综合得分 490,472", hoursAgo: 12, hotValue: 490472 },
    { title: "华为 ADS 4.0 智驾实测：城市 NOA 比老司机还稳？", url: "https://www.bilibili.com/video/BV1MockHuawei", summary: "UP：键盘车神教 · 播放量 620,000 · 弹幕 4,200", hoursAgo: 18, hotValue: 620000 },
    { title: "拆解小米 YU7：底盘用料比 Model Y 强在哪？", url: "https://www.bilibili.com/video/BV1MockXiaomi", summary: "UP：一鹿有车 · 播放量 540,000 · 弹幕 3,100", hoursAgo: 26, hotValue: 540000 },
  ],

};

export function getMockItems(sourceId: SourceId, now = new Date()): NewsItem[] {
  return (MOCK_SEEDS[sourceId] ?? []).map((seed) => ({
    id: makeItemId(sourceId, seed.url),
    sourceId,
    title: seed.title,
    url: seed.url,
    summary: seed.summary,
    publishedAt: new Date(now.getTime() - seed.hoursAgo * 3_600_000).toISOString(),
    hotValue: seed.hotValue,
  }));
}
