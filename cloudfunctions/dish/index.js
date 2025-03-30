// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

// 云函数入口函数
exports.main = async (event, context) => {
  const { action, data } = event

  switch (action) {
    // 获取推荐菜品
    case 'getRecommends':
      return await getRecommendDishes()
    
    // 搜索菜品
    case 'searchDishes':
      return await searchDishes(data.keyword)
    
    // 获取分类菜品
    case 'getCategoryDishes':
      return await getCategoryDishes(data.categoryId)
    
    // 获取菜品详情
    case 'getDishDetail':
      return await getDishDetail(data.dishId)
    
    default:
      return {
        code: -1,
        msg: '未知的操作类型'
      }
  }
}

// 获取推荐菜品
async function getRecommendDishes() {
  try {
    const result = await db.collection('dishes')
      .where({
        isRecommended: true
      })
      .limit(5)
      .get()
    
    return {
      code: 0,
      data: result.data
    }
  } catch (err) {
    return {
      code: -1,
      msg: '获取推荐菜品失败',
      error: err
    }
  }
}

// 搜索菜品
async function searchDishes(keyword) {
  try {
    const result = await db.collection('dishes')
      .where({
        name: db.RegExp({
          regexp: keyword,
          options: 'i'
        })
      })
      .get()
    
    return {
      code: 0,
      data: result.data
    }
  } catch (err) {
    return {
      code: -1,
      msg: '搜索菜品失败',
      error: err
    }
  }
}

// 获取分类菜品
async function getCategoryDishes(categoryId) {
  try {
    const result = await db.collection('dishes')
      .where({
        categoryId: categoryId
      })
      .get()
    
    return {
      code: 0,
      data: result.data
    }
  } catch (err) {
    return {
      code: -1,
      msg: '获取分类菜品失败',
      error: err
    }
  }
}

// 获取菜品详情
async function getDishDetail(dishId) {
  try {
    const result = await db.collection('dishes')
      .doc(dishId)
      .get()
    
    return {
      code: 0,
      data: result.data
    }
  } catch (err) {
    return {
      code: -1,
      msg: '获取菜品详情失败',
      error: err
    }
  }
} 