const MEAL_OPTIONS = [
  { label: '早餐', value: 'breakfast' },
  { label: '午餐', value: 'lunch' },
  { label: '晚餐', value: 'dinner' },
  { label: '加餐', value: 'snack' },
]

const EMPTY_TOTALS = {
  calories: 0,
  carbs: 0,
  protein: 0,
  fat: 0,
}

const DEFAULT_DAILY_TARGETS = {
  calories: 2000,
  carbs: 250,
  protein: 75,
  fat: 60,
}

function formatNumber(n) {
  n = n.toString()
  return n[1] ? n : `0${n}`
}

function formatDate(date) {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  return `${year}-${formatNumber(month)}-${formatNumber(day)}`
}

function formatTime(date) {
  const hour = date.getHours()
  const minute = date.getMinutes()
  const second = date.getSeconds()
  return `${formatDate(date)} ${[hour, minute, second].map(formatNumber).join(':')}`
}

function toFixedNumber(value) {
  const numberValue = Number(value)
  if (Number.isNaN(numberValue)) {
    return '0.0'
  }
  return numberValue.toFixed(1)
}

function normalizeTotals(totals = {}) {
  return {
    calories: Number(totals.calories) || 0,
    carbs: Number(totals.carbs) || 0,
    protein: Number(totals.protein) || 0,
    fat: Number(totals.fat) || 0,
  }
}

function enrichFood(food = {}) {
  return {
    name: food.name || '未命名食物',
    portionText: food.portionText || '',
    calories: Number(food.calories) || 0,
    carbs: Number(food.carbs) || 0,
    protein: Number(food.protein) || 0,
    fat: Number(food.fat) || 0,
  }
}

function mealLabelOf(value) {
  const matched = MEAL_OPTIONS.find((item) => item.value === value)
  return matched ? matched.label : '未标注'
}

function createZeroSummary(date) {
  return {
    date,
    totalCalories: 0,
    totalCarbs: 0,
    totalProtein: 0,
    totalFat: 0,
    mealBreakdown: {
      breakfast: { ...EMPTY_TOTALS },
      lunch: { ...EMPTY_TOTALS },
      dinner: { ...EMPTY_TOTALS },
      snack: { ...EMPTY_TOTALS },
    },
    recordCount: 0,
  }
}

function summaryRowFromData(summary = {}) {
  return {
    date: summary.date || '',
    totalCaloriesText: toFixedNumber(summary.totalCalories),
    totalCarbsText: toFixedNumber(summary.totalCarbs),
    totalProteinText: toFixedNumber(summary.totalProtein),
    totalFatText: toFixedNumber(summary.totalFat),
    recordCount: Number(summary.recordCount) || 0,
  }
}

module.exports = {
  DEFAULT_DAILY_TARGETS,
  EMPTY_TOTALS,
  MEAL_OPTIONS,
  createZeroSummary,
  enrichFood,
  formatDate,
  formatTime,
  mealLabelOf,
  normalizeTotals,
  summaryRowFromData,
  toFixedNumber,
}