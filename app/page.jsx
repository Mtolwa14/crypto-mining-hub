
const plans = [
  { name: "STARTER", price: 10 },
  { name: "BASIC", price: 25 },
  { name: "PRO", price: 50 },
  { name: "PREMIUM", price: 100 },
  { name: "GOLD", price: 250 },
  { name: "PLATINUM", price: 500 },
  { name: "DIAMOND", price: 1000 },
  { name: "VIP", price: 2000 },
];

const DAILY_PROFIT_RATE = 0.10;
const LOCK_DAYS = 199;

const getPlanProfit = (price) => {
  const dailyProfit = price * DAILY_PROFIT_RATE;
  const totalProfit = dailyProfit * LOCK_DAYS;
  const totalReturn = price + totalProfit;

  return {
    dailyProfit,
    totalProfit,
    totalReturn,
  };
};
