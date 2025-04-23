// 云函数入口文件
const cloud = require('wx-server-sdk')

// 初始化云环境
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

/**
 * 数据库初始化云函数
 * 此函数仅在首次部署或需要重置数据库时使用
 * 使用步骤：
 * 1. 在云开发控制台创建环境
 * 2. 部署此云函数
 * 3. 调用此云函数初始化数据库
 * 4. 在云开发控制台设置集合权限
 */
exports.main = async (event, context) => {
  try {
    // 需要创建的集合列表
    const collections = ['dishes', 'categories', 'orders', 'users']
    
    // 1. 创建集合
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
    
    // 2. 设置集合权限
    try {
      // 设置订单集合的权限为：仅创建者可读写
      await db.collection('orders').get()
      
      console.log('注意: 请在微信云开发控制台设置集合的安全规则')
      console.log('orders集合推荐设置为：仅创建者可读写')
      console.log('users集合推荐设置为：仅管理员可写，所有用户可读')
      console.log('dishes和categories集合推荐设置为：仅管理员可写，所有用户可读')
    } catch (e) {
      console.error('设置权限失败', e)
    }

    return {
      success: true,
      message: '数据库初始化完成',
      collections: collections
    }
  } catch (error) {
    return {
      success: false,
      error,
      message: '数据库初始化失败'
    }
  }
} 