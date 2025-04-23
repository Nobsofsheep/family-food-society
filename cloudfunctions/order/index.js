// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

// 添加优化日志函数
const log = (message, data) => {
  console.log(`[ORDER] ${message}`, data || '');
};

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { action, data } = event
  
  log(`执行操作: ${action}`, data);
  
  // 记录操作开始时间
  const startTime = Date.now();

  let result;
  try {
    switch (action) {
      // 创建订单
      case 'createOrder':
        result = await createOrder(data, wxContext.OPENID);
        break;
      
      // 获取用户订单列表
      case 'getUserOrders':
        result = await getUserOrders(wxContext.OPENID);
        break;
      
      // 获取所有订单列表 (仅管理员)
      case 'getAllOrders':
        result = await getAllOrders(wxContext.OPENID);
        break;
      
      // 更新订单状态
      case 'updateOrderStatus':
        result = await updateOrderStatus(data.orderId, data.status, wxContext.OPENID);
        break;
      
      // 接收订单 (仅管理员)
      case 'acceptOrder':
        result = await acceptOrder(data.orderId, wxContext.OPENID);
        break;
      
      // 完成订单 (仅管理员)
      case 'completeOrder':
        result = await completeOrder(data.orderId, wxContext.OPENID);
        break;
      
      // 删除订单
      case 'deleteOrder':
        result = await deleteOrder(data.orderId, wxContext.OPENID);
        break;
      
      default:
        result = {
          code: -1,
          msg: '未知的操作类型'
        }
    }
  } catch (err) {
    log(`操作失败: ${action}`, err);
    result = {
      code: -1,
      msg: `操作失败: ${err.message}`,
      error: err
    };
  }
  
  // 记录操作耗时
  const endTime = Date.now();
  log(`操作完成: ${action}, 耗时: ${endTime - startTime}ms`);
  
  return result;
}

// 检查是否为管理员 (添加缓存机制)
const adminCache = new Map();
const ADMIN_CACHE_TTL = 5 * 60 * 1000; // 5分钟缓存有效期

async function isAdmin(openid) {
  try {
    // 检查缓存
    const cacheKey = `admin:${openid}`;
    const cachedResult = adminCache.get(cacheKey);
    
    if (cachedResult && (Date.now() - cachedResult.timestamp < ADMIN_CACHE_TTL)) {
      log(`使用缓存的管理员状态: ${openid}`, cachedResult.isAdmin);
      return cachedResult.isAdmin;
    }
    
    const userRes = await db.collection('users')
      .where({
        openid: openid,
        role: 'admin'
      })
      .get()
    
    const isAdminUser = userRes.data && userRes.data.length > 0;
    
    // 更新缓存
    adminCache.set(cacheKey, {
      isAdmin: isAdminUser,
      timestamp: Date.now()
    });
    
    return isAdminUser;
  } catch (err) {
    console.error('检查管理员权限失败：', err)
    return false
  }
}

// 获取所有订单（管理员功能）
async function getAllOrders(openid) {
  try {
    // 验证管理员权限
    const adminCheck = await isAdmin(openid)
    if (!adminCheck) {
      return {
        code: -1,
        msg: '无权限获取所有订单'
      }
    }

    // 使用聚合操作和分页优化获取订单
    const MAX_LIMIT = 100; // 设置一个较大的批次限制以减少请求
    const countResult = await db.collection('orders').count();
    const total = countResult.total;
    
    // 计算需要分几次请求
    const batchTimes = Math.ceil(total / MAX_LIMIT);
    let allOrders = [];
    
    // 批量获取数据
    const tasks = [];
    for (let i = 0; i < batchTimes; i++) {
      const promise = db.collection('orders')
        .orderBy('createTime', 'desc')
        .skip(i * MAX_LIMIT)
        .limit(MAX_LIMIT)
        .get();
      tasks.push(promise);
    }
    
    // 并行执行所有请求
    const results = await Promise.all(tasks);
    
    // 合并结果
    results.forEach(result => {
      allOrders = allOrders.concat(result.data);
    });
    
    return {
      code: 0,
      data: allOrders,
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
    // 使用索引优化查询
    const result = await db.collection('orders')
      .where({
        openid: openid
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

// 接收订单（管理员功能）
async function acceptOrder(orderId, openid) {
  try {
    // 验证管理员权限
    const adminCheck = await isAdmin(openid)
    if (!adminCheck) {
      return {
        code: -1,
        msg: '无权限接收订单'
      }
    }
    
    // 更新订单状态
    const updateResult = await db.collection('orders').doc(orderId).update({
      data: {
        status: '处理中',
        acceptTime: new Date(),
        acceptBy: openid
      }
    })
    
    // 如果更新失败，可能是订单不存在
    if (updateResult.stats.updated === 0) {
      return {
        code: -1,
        msg: '订单不存在或已被接收'
      }
    }
    
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

// 完成订单（管理员功能）
async function completeOrder(orderId, openid) {
  try {
    // 验证管理员权限
    const adminCheck = await isAdmin(openid)
    if (!adminCheck) {
      return {
        code: -1,
        msg: '无权限完成订单'
      }
    }
    
    // 查询订单当前状态
    const orderResult = await db.collection('orders').doc(orderId).get()
    
    if (!orderResult.data) {
      return {
        code: -1,
        msg: '订单不存在'
      }
    }
    
    // 订单必须先处于"处理中"状态才能标记为完成
    if (orderResult.data.status !== '处理中') {
      return {
        code: -1,
        msg: '只能完成处理中的订单'
      }
    }
    
    // 更新订单状态
    await db.collection('orders').doc(orderId).update({
      data: {
        status: '已完成',
        completeTime: new Date(),
        completeBy: openid
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
    // 先获取订单信息，检查权限
    const orderResult = await db.collection('orders').doc(orderId).get()
    
    if (!orderResult.data) {
      return {
        code: -1,
        msg: '订单不存在'
      }
    }
    
    // 验证操作权限：管理员可以删除任何订单，普通用户只能删除自己的订单
    const adminCheck = await isAdmin(openid)
    if (!adminCheck && orderResult.data.openid !== openid) {
      return {
        code: -1,
        msg: '无权限删除此订单'
      }
    }
    
    // 删除订单
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