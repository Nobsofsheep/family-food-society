// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: 'family-menu-01-1gjtmbob2bba8eb5' })
const db = cloud.database()
const _ = db.command

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { action, data } = event

  switch (action) {
    // 用户登录
    case 'login':
      return await login(wxContext.OPENID, data)
    
    // 获取用户信息
    case 'getUserInfo':
      return await getUserInfo(wxContext.OPENID)
    
    // 注册用户
    case 'register':
      return await register(wxContext.OPENID, data)
    
    // 更新用户信息
    case 'updateUserInfo':
      return await updateUserInfo(wxContext.OPENID, data)
    
    // 获取用户列表 (仅管理员)
    case 'getUserList':
      return await getUserList(wxContext.OPENID)
    
    // 更新用户角色 (仅管理员)
    case 'updateUserRole':
      return await updateUserRole(wxContext.OPENID, data)
      
    default:
      return {
        code: -1,
        msg: '未知的操作类型'
      }
  }
}

// 用户登录
async function login(openid, data) {
  try {
    // 检查用户是否已存在
    const userRes = await db.collection('users').where({
      openid: openid
    }).get()
    
    if (userRes.data && userRes.data.length > 0) {
      // 用户已存在，返回用户信息
      return {
        code: 0,
        data: {
          userInfo: userRes.data[0],
          isNew: false
        },
        msg: '登录成功'
      }
    } else {
      // 用户不存在，创建新用户 - 始终创建为普通用户
      const user = {
        openid: openid,
        nickname: data.nickname || '新用户',
        avatar: data.avatar || '',
        role: 'user', // 设置为普通用户
        createTime: new Date(),
        updateTime: new Date()
      }
      
      await db.collection('users').add({
        data: user
      })
      
      return {
        code: 0,
        data: {
          userInfo: user,
          isNew: true
        },
        msg: '创建用户成功'
      }
    }
  } catch (err) {
    return {
      code: -1,
      msg: '登录失败',
      error: err
    }
  }
}

// 获取用户信息
async function getUserInfo(openid) {
  try {
    const userRes = await db.collection('users').where({
      openid: openid
    }).get()
    
    if (userRes.data && userRes.data.length > 0) {
      return {
        code: 0,
        data: userRes.data[0],
        msg: '获取用户信息成功'
      }
    } else {
      return {
        code: -1,
        msg: '用户不存在'
      }
    }
  } catch (err) {
    return {
      code: -1,
      msg: '获取用户信息失败',
      error: err
    }
  }
}

// 注册用户
async function register(openid, data) {
  try {
    // 检查用户是否已存在
    const userRes = await db.collection('users').where({
      openid: openid
    }).get()
    
    if (userRes.data && userRes.data.length > 0) {
      return {
        code: -1,
        msg: '用户已存在'
      }
    }
    
    // 创建新用户 - 始终设置为普通用户
    const user = {
      openid: openid,
      nickname: data.nickname || '新用户',
      avatar: data.avatar || '',
      role: 'user', // 设置为普通用户
      createTime: new Date(),
      updateTime: new Date()
    }
    
    const result = await db.collection('users').add({
      data: user
    })
    
    return {
      code: 0,
      data: {
        _id: result._id,
        ...user
      },
      msg: '注册成功'
    }
  } catch (err) {
    return {
      code: -1,
      msg: '注册失败',
      error: err
    }
  }
}

// 更新用户信息
async function updateUserInfo(openid, data) {
  try {
    // 检查用户是否存在
    const userRes = await db.collection('users').where({
      openid: openid
    }).get()
    
    if (!userRes.data || userRes.data.length === 0) {
      return {
        code: -1,
        msg: '用户不存在'
      }
    }
    
    // 不允许普通用户更改自己的角色
    if (data.role) {
      delete data.role
    }
    
    // 更新用户信息
    await db.collection('users').where({
      openid: openid
    }).update({
      data: {
        ...data,
        updateTime: new Date()
      }
    })
    
    return {
      code: 0,
      msg: '更新成功'
    }
  } catch (err) {
    return {
      code: -1,
      msg: '更新失败',
      error: err
    }
  }
}

// 获取用户列表 (仅管理员)
async function getUserList(openid) {
  try {
    // 检查请求者是否为管理员
    const requesterRes = await db.collection('users').where({
      openid: openid
    }).get()
    
    if (!requesterRes.data || requesterRes.data.length === 0 || requesterRes.data[0].role !== 'admin') {
      return {
        code: -1,
        msg: '权限不足'
      }
    }
    
    // 获取用户列表
    const userRes = await db.collection('users').get()
    
    return {
      code: 0,
      data: userRes.data,
      msg: '获取用户列表成功'
    }
  } catch (err) {
    return {
      code: -1,
      msg: '获取用户列表失败',
      error: err
    }
  }
}

// 更新用户角色 (仅管理员)
async function updateUserRole(openid, data) {
  try {
    // 检查请求者是否为管理员
    const requesterRes = await db.collection('users').where({
      openid: openid
    }).get()
    
    if (!requesterRes.data || requesterRes.data.length === 0 || requesterRes.data[0].role !== 'admin') {
      return {
        code: -1,
        msg: '权限不足'
      }
    }
    
    // 不能修改自己的角色
    if (data.targetOpenid === openid) {
      return {
        code: -1,
        msg: '不能修改自己的角色'
      }
    }
    
    // 检查目标用户是否存在
    const targetRes = await db.collection('users').where({
      openid: data.targetOpenid
    }).get()
    
    if (!targetRes.data || targetRes.data.length === 0) {
      return {
        code: -1,
        msg: '目标用户不存在'
      }
    }
    
    // 更新用户角色
    await db.collection('users').where({
      openid: data.targetOpenid
    }).update({
      data: {
        role: data.role,
        updateTime: new Date()
      }
    })
    
    return {
      code: 0,
      msg: '更新角色成功'
    }
  } catch (err) {
    return {
      code: -1,
      msg: '更新角色失败',
      error: err
    }
  }
} 