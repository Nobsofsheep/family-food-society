// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

// 云函数入口函数
exports.main = async (event, context) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // 获取今天的推荐菜品
    const todayRecommendResult = await db.collection('dishes')
      .where({
        isRecommend: true,
        recommendDate: db.command.gte(today)
      })
      .get();
    
    // 如果今天已经有推荐菜品，则不再更新
    if (todayRecommendResult.data && todayRecommendResult.data.length > 0) {
      return {
        code: 0,
        message: '今天已有推荐菜品，无需更新'
      };
    }
    
    // 获取昨天的推荐菜品ID
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayRecommendResult = await db.collection('dishes')
      .where({
        isRecommend: true,
        recommendDate: db.command.gte(yesterday).and(db.command.lt(today))
      })
      .get();
    
    const yesterdayRecommendIds = yesterdayRecommendResult.data 
      ? yesterdayRecommendResult.data.map(dish => dish._id) 
      : [];
    
    // 获取所有非自定义且非昨天推荐的菜品
    const dishesResult = await db.collection('dishes')
      .where({
        isCustom: _.neq(true),
        _id: _.nin(yesterdayRecommendIds)
      })
      .get();
    
    if (dishesResult.data && dishesResult.data.length > 0) {
      // 随机选择5个菜品
      const selectedDishes = [];
      const availableDishes = [...dishesResult.data];
      
      for (let i = 0; i < 5 && availableDishes.length > 0; i++) {
        const randomIndex = Math.floor(Math.random() * availableDishes.length);
        selectedDishes.push(availableDishes[randomIndex]);
        availableDishes.splice(randomIndex, 1);
      }
      
      // 更新选中的菜品为推荐菜品
      for (const dish of selectedDishes) {
        await db.collection('dishes').doc(dish._id).update({
          data: {
            isRecommend: true,
            recommendDate: today
          }
        });
      }
      
      // 清除昨天的推荐标记
      if (yesterdayRecommendResult.data) {
        for (const dish of yesterdayRecommendResult.data) {
          await db.collection('dishes').doc(dish._id).update({
            data: {
              isRecommend: false
            }
          });
        }
      }
      
      return {
        code: 0,
        message: '更新推荐菜品成功',
        data: selectedDishes
      };
    } else {
      return {
        code: -1,
        message: '没有可用的菜品用于推荐'
      };
    }
  } catch (err) {
    console.error('更新推荐菜品失败：', err);
    return {
      code: -1,
      message: '更新推荐菜品失败',
      error: err
    };
  }
} 