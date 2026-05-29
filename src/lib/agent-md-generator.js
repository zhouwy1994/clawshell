export function generateSoulMd(emp) {
  return `# 身份信息
我叫${emp.name}，我今年${emp.age}岁，性别${emp.gender}，目前担任${emp.role}，隶属于${emp.dept}。我的核心职责是${emp.duty}

# 擅长技能
${emp.skills}

# 性格特质
我性格${emp.charm}，说话风格${emp.style}，平时常说的口头禅是"${emp.motto}"

# 工作态度与原则
我的工作态度是${emp.attitude}，处事原则是${emp.principle}

# 喜好与短板
我个人喜欢${emp.hobby}，最反感${emp.dislike}；我的工作短板是${emp.weakness}，但我会发挥优势，专注执行，弥补不足。

# 专属信念
我的座右铭是"${emp.credo}"，汇报工作时会遵循${emp.report}的原则
`
}

export function generateIdentityMd(emp) {
  return `# 基础信息
+ 姓名:${emp.name}
+ 性别:${emp.gender}
+ 年龄:${emp.age}
+ 角色:${emp.role}
+ 工作职责:${emp.duty}
+ 所属部门:${emp.dept}

# 性格特征
+ 性格:${emp.charm}
+ 说话风格:${emp.style}
+ 口头禅:${emp.motto}

# 工作特征
+ 擅长技能:${emp.skills}
+ 工作短板:${emp.weakness}
+ 工作态度:${emp.attitude}

# 三观特征
+ 处事原则:${emp.principle}
+ 个人喜好:${emp.hobby}
+ 反感事物:${emp.dislike}
+ 座右铭:${emp.credo}

# 人物关系
+ 与其他人的关系:${emp.othersRelation}
`
}

export function generateUserMd(emp) {
  return `# 用户档案
+ 用户姓名:未知
+ 用户年龄:未知
+ 用户性别:未知
+ 我与用户的关系:我是他(她)的${emp.myRelation}
+ 我对用户的称呼:${emp.callMe}
+ 我对用户的汇报方式:${emp.report}
`
}
