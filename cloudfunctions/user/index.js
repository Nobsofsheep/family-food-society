// 云函数入口文件
const cloud = require('wx-server-sdk')

// 初始化云环境
cloud.init({
  env: 'family-menu-01-1gjtmbob2bba8eb5',
  traceUser: true
})

const db = cloud.database()
const _ = db.command

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { action, data } = event

  switch (action) {
    // 获取openid
    case 'getOpenId':
      return {
        code: 0,
        data: {
          openid: wxContext.OPENID,
          appid: wxContext.APPID,
          unionid: wxContext.UNIONID,
          env: cloud.DYNAMIC_CURRENT_ENV
        },
        msg: '获取openid成功'
      }
    
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
    
    // 更新用户状态 (仅管理员)
    case 'updateUserStatus':
      return await updateUserStatus(wxContext.OPENID, data)
    
    // 获取手机号
    case 'getPhoneNumber':
      return await getPhoneNumber(data)
    
    // 手机号登录
    case 'phoneLogin':
      return await phoneLogin(wxContext.OPENID, data)
    
    // 获取用户列表（带分页、搜索和筛选）
    case 'getUsers':
      return await getUsers(wxContext.OPENID, data)
    
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
      // 用户已存在，更新信息
      const updateData = {
        updateTime: new Date()
      };
      
      // 只有在用户没有头像时才更新头像
      if (!userRes.data[0].avatar && data.avatar) {
        updateData.avatar = data.avatar;
      }
      
      await db.collection('users').where({
        openid: openid
      }).update({
        data: updateData
      });
      
      // 获取最新的用户信息
      const latestUserInfo = await db.collection('users').where({
        openid: openid
      }).get();
      
      return {
        code: 0,
        data: {
          userInfo: latestUserInfo.data[0]
        },
        msg: '登录成功'
      }
    } else {
      // 用户不存在，创建新用户
      const user = {
        openid: openid,
        nickname: data.nickname || '新用户',
        avatar: data.avatar || '',
        role: 'user',
        createTime: new Date(),
        updateTime: new Date()
      }
      
      await db.collection('users').add({
        data: user
      })
      
      return {
        code: 0,
        data: {
          userInfo: user
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
    
    // 如果更新了头像，删除旧的头像文件
    if (data.avatar && userRes.data[0].avatar && data.avatar !== userRes.data[0].avatar) {
      try {
        // 从旧头像URL中提取fileID
        const oldFileID = userRes.data[0].avatar;
        if (oldFileID && oldFileID.startsWith('cloud://')) {
          await cloud.deleteFile({
            fileList: [oldFileID]
          });
        }
      } catch (err) {
        console.error('删除旧头像失败：', err);
      }
    }
    
    // 更新用户信息
    const updateData = {
      ...data,
      updateTime: new Date()
    };
    
    await db.collection('users').where({
      openid: openid
    }).update({
      data: updateData
    });
    
    // 获取更新后的用户信息
    const updatedUser = await db.collection('users').where({
      openid: openid
    }).get();
    
    return {
      code: 0,
      data: updatedUser.data[0],
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
async function updateUserRole(operatorOpenid, data) {
  try {
    // 检查操作者是否为管理员
    const operatorRes = await db.collection('users').where({
      openid: operatorOpenid
    }).get();

    if (!operatorRes.data || operatorRes.data.length === 0 || operatorRes.data[0].role !== 'admin') {
      return {
        code: -1,
        msg: '无权限执行此操作'
      };
    }

    // 检查目标用户是否存在
    const targetUserRes = await db.collection('users').doc(data.userId).get();
    
    if (!targetUserRes.data) {
      return {
        code: -1,
        msg: '目标用户不存在'
      };
    }

    // 不允许修改自己的角色
    if (targetUserRes.data.openid === operatorOpenid) {
      return {
        code: -1,
        msg: '不能修改自己的角色'
      };
    }

    // 更新用户角色
    await db.collection('users').doc(data.userId).update({
      data: {
        role: data.role,
        updateTime: new Date()
      }
    });

    return {
      code: 0,
      msg: '更新角色成功'
    };
  } catch (err) {
    console.error('更新用户角色失败：', err);
    return {
      code: -1,
      msg: '更新角色失败',
      error: err
    };
  }
}

// 更新用户状态 (仅管理员)
async function updateUserStatus(operatorOpenid, data) {
  try {
    // 检查操作者是否为管理员
    const operatorRes = await db.collection('users').where({
      openid: operatorOpenid
    }).get();

    if (!operatorRes.data || operatorRes.data.length === 0 || operatorRes.data[0].role !== 'admin') {
      return {
        code: -1,
        msg: '无权限执行此操作'
      };
    }

    // 检查目标用户是否存在
    const targetUserRes = await db.collection('users').doc(data.userId).get();
    
    if (!targetUserRes.data) {
      return {
        code: -1,
        msg: '目标用户不存在'
      };
    }

    // 不允许修改自己的状态
    if (targetUserRes.data.openid === operatorOpenid) {
      return {
        code: -1,
        msg: '不能修改自己的状态'
      };
    }

    // 更新用户状态
    await db.collection('users').doc(data.userId).update({
      data: {
        status: data.status,
        updateTime: new Date()
      }
    });

    return {
      code: 0,
      msg: '更新状态成功'
    };
  } catch (err) {
    console.error('更新用户状态失败：', err);
    return {
      code: -1,
      msg: '更新状态失败',
      error: err
    };
  }
}

// 获取手机号
async function getPhoneNumber(data) {
  try {
    console.log("getPhoneNumber 函数被调用，传入数据:", data);
    
    if (!data || !data.cloudID) {
      console.error("无效的请求数据:", data);
      return {
        code: -1,
        msg: '无效的cloudID'
      }
    }

    console.log("准备解析cloudID:", data.cloudID);

    // 使用微信提供的接口解析手机号
    try {
      const phoneInfo = await cloud.getOpenData({
        list: [data.cloudID]
      });

      console.log('获取手机号原始结果:', JSON.stringify(phoneInfo));

      if (phoneInfo && phoneInfo.list && phoneInfo.list.length > 0 && phoneInfo.list[0].data) {
        // 解析成功，返回手机号
        const phoneData = phoneInfo.list[0].data;
        
        console.log('解析到的手机号:', JSON.stringify(phoneData));
        
        return {
          code: 0,
          data: {
            phoneNumber: phoneData.phoneNumber
          },
          msg: '获取手机号成功'
        }
      } else {
        console.error('获取手机号失败，数据不完整:', JSON.stringify(phoneInfo));
        return {
          code: -1,
          msg: '获取手机号失败，请重试'
        }
      }
    } catch (cloudErr) {
      console.error('云开发获取手机号错误:', cloudErr.message, cloudErr.stack);
      return {
        code: -1,
        msg: '解析手机号失败: ' + cloudErr.message,
        error: cloudErr
      }
    }
  } catch (err) {
    console.error('获取手机号错误:', err.message, err.stack);
    return {
      code: -1,
      msg: '获取手机号失败: ' + err.message,
      error: err
    }
  }
}

// 手机号登录
async function phoneLogin(openid, data) {
  try {
    if (!data.phoneNumber) {
      return {
        code: -1,
        msg: '手机号不能为空'
      }
    }

    // 检查用户是否已存在
    const userRes = await db.collection('users').where({
      openid: openid
    }).get()
    
    if (userRes.data && userRes.data.length > 0) {
      // 用户已存在，更新手机号信息
      const user = userRes.data[0]
      
      // 更新用户手机号
      await db.collection('users').where({
        openid: openid
      }).update({
        data: {
          phoneNumber: data.phoneNumber,
          updateTime: new Date()
        }
      })
      
      // 重新获取用户信息
      const updatedUser = await db.collection('users').where({
        openid: openid
      }).get()
      
      return {
        code: 0,
        data: {
          userInfo: updatedUser.data[0],
          isNew: false
        },
        msg: '登录成功'
      }
    } else {
      // 用户不存在，创建新用户
      const user = {
        openid: openid,
        nickname: '用户' + data.phoneNumber.substr(-4), // 使用手机号后4位作为昵称
        avatar: '',
        phoneNumber: data.phoneNumber,
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
          userInfo: user,
          isNew: true
        },
        msg: '创建用户成功'
      }
    }
  } catch (err) {
    console.error('手机号登录错误:', err)
    return {
      code: -1,
      msg: '手机号登录失败',
      error: err
    }
  }
}

// 获取用户列表（带分页、搜索和筛选）
async function getUsers(openid, data) {
  try {
    // 检查是否是管理员
    const adminCheck = await isAdmin(openid);
    if (!adminCheck) {
      return {
        code: -1,
        msg: '没有管理员权限'
      };
    }

    const {
      page = 1,
      pageSize = 20,
      keyword = '',
      role = ''
    } = data || {};

    // 构建查询条件
    let query = {};
    
    // 关键字搜索（昵称或手机号）
    if (keyword) {
      query = _.or([
        {
          nickname: db.RegExp({
            regexp: keyword,
            options: 'i'
          })
        },
        {
          phoneNumber: db.RegExp({
            regexp: keyword,
            options: 'i'
          })
        }
      ]);
    }

    // 角色筛选
    if (role) {
      query.role = role;
    }

    console.log('查询条件：', query);

    try {
      // 获取总数
      const countResult = await db.collection('users')
        .where(query)
        .count();

      console.log('总数：', countResult);

      // 获取用户列表
      const users = await db.collection('users')
        .where(query)
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .orderBy('createTime', 'desc')
        .get();

      console.log('查询结果：', users);

      // 格式化日期
      const formattedUsers = users.data.map(user => {
        try {
          return {
            ...user,
            createTime: user.createTime ? user.createTime.toLocaleString() : '未知',
            updateTime: user.updateTime ? user.updateTime.toLocaleString() : '未知'
          };
        } catch (err) {
          console.error('日期格式化错误：', err);
          return {
            ...user,
            createTime: '未知',
            updateTime: '未知'
          };
        }
      });

      return {
        code: 0,
        data: {
          users: formattedUsers,
          total: countResult.total,
          page,
          pageSize
        },
        msg: '获取用户列表成功'
      };
    } catch (queryErr) {
      console.error('数据库查询错误：', queryErr);
      throw queryErr;
    }
  } catch (err) {
    console.error('获取用户列表失败：', err);
    return {
      code: -1,
      msg: '获取用户列表失败',
      error: err.message
    };
  }
}

// 检查是否是管理员
async function isAdmin(openid) {
  try {
    const userRes = await db.collection('users')
      .where({
        openid: openid,
        role: 'admin'
      })
      .get();
    
    return userRes.data && userRes.data.length > 0;
  } catch (err) {
    console.error('检查管理员权限失败：', err);
    return false;
  }
} 