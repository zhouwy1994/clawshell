const ROLE_NAMES = {
  employee: '员工',
  assistant: '助理',
  partner: '搭子',
  friend: '好友',
  lover: '恋人',
  confidant: '知己',
}

function value(text, fallback = '未设定') {
  return String(text || '').trim() || fallback
}

function roleName(emp) {
  return ROLE_NAMES[emp.roleType] || ROLE_NAMES.employee
}

function soulSections(emp) {
  const name = value(emp.name)
  const base = [
    `# 角色灵魂`,
    `我是${name}，${value(emp.age)}岁，性别${value(emp.gender)}。我的角色类型是${roleName(emp)}。`,
  ]

  switch (emp.roleType) {
    case 'assistant':
      return [
        ...base,
        '',
        '# 协助方式',
        `我主要协助用户处理：${value(emp.duty)}。`,
        `我擅长的协助方向是：${value(emp.skills)}。`,
        `我的主动程度是：${value(emp.attitude)}。`,
        '',
        '# 性格与边界',
        `我的表达方式是：${value(emp.style)}。`,
        `我的协作原则是：${value(emp.principle)}。`,
        `我会避免：${value(emp.dislike)}。`,
      ]
    case 'partner':
      return [
        ...base,
        '',
        '# 陪伴关系',
        `我和用户的关系是：${value(emp.myRelation)}。`,
        `我适合陪用户一起做的事：${value(emp.hobby)}。`,
        `我常说的话是："${value(emp.motto)}"。`,
        '',
        '# 相处气质',
        `我的性格特质是：${value(emp.charm)}。`,
        `我的说话方式是：${value(emp.style)}。`,
        `我们的搭伙规则是：${value(emp.principle)}。`,
      ]
    case 'friend':
      return [
        ...base,
        '',
        '# 朋友关系',
        `我和用户的关系是：${value(emp.myRelation)}。`,
        `我会像真实朋友一样回应，性格特质是：${value(emp.charm)}。`,
        `我们常聊的话题是：${value(emp.hobby)}。`,
        '',
        '# 相处方式',
        `我的说话方式是：${value(emp.style)}。`,
        `我重视的相处边界是：${value(emp.principle)}。`,
        `我会避免：${value(emp.dislike)}。`,
      ]
    case 'lover':
      return [
        ...base,
        '',
        '# 亲密关系',
        `我和用户的关系是：${value(emp.myRelation)}。`,
        `我吸引人的特质是：${value(emp.charm)}。`,
        `我偏好的亲密日常是：${value(emp.hobby)}。`,
        '',
        '# 爱意表达',
        `我的亲密表达方式是：${value(emp.style)}。`,
        `我常用的亲密表达是："${value(emp.motto)}"。`,
        `我在关系中坚持的边界是：${value(emp.principle)}。`,
      ]
    case 'confidant':
      return [
        ...base,
        '',
        '# 精神连接',
        `我和用户的关系是：${value(emp.myRelation)}。`,
        `我理解用户的方式是：${value(emp.charm)}。`,
        `我适合陪用户聊：${value(emp.hobby)}。`,
        '',
        '# 陪伴原则',
        `我的安抚方式是：${value(emp.style)}。`,
        `我会坚持的守护原则是：${value(emp.principle)}。`,
        `我会避免：${value(emp.dislike)}。`,
      ]
    case 'employee':
    default:
      return [
        ...base,
        '',
        '# 工作定位',
        `我目前担任${value(emp.role)}。`,
        `我的核心职责是：${value(emp.duty)}。`,
        `我擅长的能力是：${value(emp.skills)}。`,
        '',
        '# 执行风格',
        `我的沟通方式是：${value(emp.style)}。`,
        `我的执行状态是：${value(emp.attitude)}。`,
        `我的工作原则是：${value(emp.principle)}。`,
      ]
  }
}

export function generateSoulMd(emp) {
  const sections = soulSections(emp)
  if (String(emp.extraInfo || '').trim()) {
    sections.push('', '# 其他信息', String(emp.extraInfo).trim())
  }
  return `${sections.join('\n')}\n`
}

export function generateIdentityMd(emp) {
  const lines = [
    '# 基础信息',
    `+ 姓名:${value(emp.name)}`,
    `+ 性别:${value(emp.gender)}`,
    `+ 年龄:${value(emp.age)}`,
    `+ 角色类型:${roleName(emp)}`,
  ]

  if (emp.roleType === 'employee') {
    lines.push(`+ 职位:${value(emp.role)}`, `+ 工作职责:${value(emp.duty)}`, `+ 擅长能力:${value(emp.skills)}`, `+ 执行状态:${value(emp.attitude)}`)
  } else if (emp.roleType === 'assistant') {
    lines.push(`+ 协助范围:${value(emp.duty)}`, `+ 擅长协助:${value(emp.skills)}`, `+ 主动程度:${value(emp.attitude)}`, `+ 避免方式:${value(emp.dislike)}`)
  } else {
    lines.push(`+ 与用户的关系:${value(emp.myRelation)}`, `+ 偏好话题/活动:${value(emp.hobby)}`, `+ 口头禅:${value(emp.motto)}`)
  }

  lines.push(
    '',
    '# 性格表达',
    `+ 核心特质:${value(emp.charm || emp.role)}`,
    `+ 说话风格:${value(emp.style)}`,
    `+ 重要原则:${value(emp.principle)}`,
    '',
    '# 人物关系',
    `+ 对用户的称呼:${value(emp.callMe)}`,
    `+ 与其他人的关系:${value(emp.othersRelation)}`
  )

  return `${lines.join('\n')}\n`
}

export function generateUserMd(emp) {
  const relation = emp.roleType === 'employee'
    ? `我是用户的${value(emp.role || emp.myRelation, '员工')}`
    : `我是用户的${value(emp.myRelation, roleName(emp))}`

  return `# 用户档案
+ 用户姓名:未知
+ 用户年龄:未知
+ 用户性别:未知
+ ${relation}
+ 我对用户的称呼:${value(emp.callMe)}
`
}
