// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  try {
    // 在这里创建云数据库集合
    const collections = ['dishes', 'categories', 'orders']
    
    // 1. 创建集合及对应权限
    for (let collection of collections) {
      try {
        await db.createCollection(collection)
        console.log(`创建集合: ${collection} 成功`)
      } catch (e) {
        if (e.message.indexOf('collection already exists') > -1) {
          console.log(`集合: ${collection} 已存在`)
        } else {
          console.error(`创建集合: ${collection} 失败`, e)
        }
      }
    }
    
    // 2. orders集合添加权限，只能创建者可读写
    try {
      // 设置订单集合的权限为：仅创建者可读写
      await db.collection('orders').get()
      
      // 设置安全规则
      // 这里需要在微信云开发控制台进一步设置权限
      console.log('注意: 请在微信云开发控制台设置集合的安全规则')
      console.log('orders集合推荐设置为：仅创建者可读写')
    } catch (e) {
      console.error('设置权限失败', e)
    }

    return {
      success: true,
      message: '数据库初始化完成'
    }
  } catch (error) {
    return {
      success: false,
      error
    }
  }
} 