// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { action, data } = event

  switch (action) {
    // 创建订单
    case 'createOrder':
      return await createOrder(data, wxContext.OPENID)
    
    // 获取用户订单列表
    case 'getUserOrders':
      return await getUserOrders(wxContext.OPENID)
    
    // 获取所有订单列表 (仅管理员)
    case 'getAllOrders':
      return await getAllOrders(wxContext.OPENID)
    
    // 更新订单状态
    case 'updateOrderStatus':
      return await updateOrderStatus(data.orderId, data.status, wxContext.OPENID)
    
    // 接收订单 (仅管理员)
    case 'acceptOrder':
      return await acceptOrder(data.orderId, wxContext.OPENID)
    
    // 完成订单 (仅管理员)
    case 'completeOrder':
      return await completeOrder(data.orderId, wxContext.OPENID)
    
    // 删除订单
    case 'deleteOrder':
      return await deleteOrder(data.orderId, wxContext.OPENID)
    
    default:
      return {
        code: -1,
        msg: '未知的操作类型'
      }
  }
}

// 检查用户是否为管理员
async function isAdmin(openid) {
  try {
    const userResult = await db.collection('users').where({
      openid: openid
    }).get()
    
    if (userResult.data && userResult.data.length > 0 && userResult.data[0].role === 'admin') {
      return true
    }
    return false
  } catch (err) {
    console.error('检查管理员权限失败:', err)
    return false
  }
}

// 获取所有订单 (仅管理员)
async function getAllOrders(openid) {
  try {
    // 验证是否为管理员
    const adminCheck = await isAdmin(openid)
    if (!adminCheck) {
      return {
        code: -1,
        msg: '权限不足'
      }
    }
    
    // 获取所有订单，按创建时间降序排列
    const result = await db.collection('orders')
      .orderBy('createTime', 'desc')
      .get()
    
    return {
      code: 0,
      data: result.data,
      msg: '获取全部订单成功'
    }
  } catch (err) {
    return {
      code: -1,
      msg: '获取订单失败',
      error: err
    }
  }
}

// 创建订单
async function createOrder(orderData, openid) {
  try {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1
    const day = now.getDate()
    const weekDay = ['日', '一', '二', '三', '四', '五', '六'][now.getDay()]
    const hours = now.getHours().toString().padStart(2, '0')
    const minutes = now.getMinutes().toString().padStart(2, '0')
    const seconds = now.getSeconds().toString().padStart(2, '0')
    const formattedTime = `${year}年${month}月${day}日 周${weekDay} ${hours}:${minutes}:${seconds}`
    
    // 直接使用客户端传来的数据，其中应该已经包含了用户昵称
    const order = {
      ...orderData,
      openid,
      status: orderData.status || '待处理',
      createTime: now,
      formattedTime,
      orderNumber: orderData.orderNumber || ('DD' + Date.now())
    }
    
    const result = await db.collection('orders').add({
      data: order
    })
    
    return {
      code: 0,
      data: {
        _id: result._id,
        orderNumber: order.orderNumber
      },
      msg: '创建订单成功'
    }
  } catch (err) {
    console.error('创建订单失败:', err);
    return {
      code: -1,
      msg: '创建订单失败',
      error: err
    }
  }
}

// 获取用户订单
async function getUserOrders(openid) {
  try {
    const result = await db.collection('orders')
      .where({
        openid
      })
      .orderBy('createTime', 'desc')
      .get()
    
    return {
      code: 0,
      data: result.data,
      msg: '获取订单成功'
    }
  } catch (err) {
    return {
      code: -1,
      msg: '获取订单失败',
      error: err
    }
  }
}

// 更新订单状态
async function updateOrderStatus(orderId, status, openid) {
  try {
    // 验证操作权限：管理员可以更新任何订单，普通用户只能更新自己的订单
    const adminCheck = await isAdmin(openid)
    
    if (!adminCheck) {
      // 如果不是管理员，检查订单是否属于该用户
      const order = await db.collection('orders').doc(orderId).get()
      if (!order.data || order.data.openid !== openid) {
        return {
          code: -1,
          msg: '无权限修改此订单'
        }
      }
    }
    
    await db.collection('orders').doc(orderId).update({
      data: {
        status,
        updateTime: new Date()
      }
    })
    
    return {
      code: 0,
      msg: '更新订单状态成功'
    }
  } catch (err) {
    return {
      code: -1,
      msg: '更新订单状态失败',
      error: err
    }
  }
}

// 接收订单 (仅管理员)
async function acceptOrder(orderId, openid) {
  try {
    // 验证是否为管理员
    const adminCheck = await isAdmin(openid)
    if (!adminCheck) {
      return {
        code: -1,
        msg: '权限不足'
      }
    }
    
    // 更新订单状态为"处理中"
    await db.collection('orders').doc(orderId).update({
      data: {
        status: '处理中',
        updateTime: new Date(),
        acceptedBy: openid
      }
    })
    
    return {
      code: 0,
      msg: '接收订单成功'
    }
  } catch (err) {
    return {
      code: -1,
      msg: '接收订单失败',
      error: err
    }
  }
}

// 完成订单 (仅管理员)
async function completeOrder(orderId, openid) {
  try {
    // 验证是否为管理员
    const adminCheck = await isAdmin(openid)
    if (!adminCheck) {
      return {
        code: -1,
        msg: '权限不足'
      }
    }
    
    // 更新订单状态为"已完成"
    await db.collection('orders').doc(orderId).update({
      data: {
        status: '已完成',
        updateTime: new Date(),
        completedBy: openid,
        completedTime: new Date()
      }
    })
    
    return {
      code: 0,
      msg: '完成订单成功'
    }
  } catch (err) {
    return {
      code: -1,
      msg: '完成订单失败',
      error: err
    }
  }
}

// 删除订单
async function deleteOrder(orderId, openid) {
  try {
    // 验证操作权限：管理员可以删除任何订单，普通用户只能删除自己的订单
    const adminCheck = await isAdmin(openid)
    
    if (!adminCheck) {
      // 如果不是管理员，检查订单是否属于该用户
      const order = await db.collection('orders').doc(orderId).get()
      if (!order.data || order.data.openid !== openid) {
        return {
          code: -1,
          msg: '无权限删除此订单'
        }
      }
    }
    
    await db.collection('orders').doc(orderId).remove()
    
    return {
      code: 0,
      msg: '删除订单成功'
    }
  } catch (err) {
    return {
      code: -1,
      msg: '删除订单失败',
      error: err
    }
  }
} 