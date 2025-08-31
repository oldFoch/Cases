import axios from 'axios';

axios.defaults.withCredentials = true;

export async function getWaxpeerPrices({ app = 730, currency = 'RUB' } = {}) {
  const { data } = await axios.get('/api/waxpeer/prices', {
    params: { app, currency, _ts: Date.now() },
  });
  return data;
}

export async function waxpeerBuy({ item_id, price, trade_url }) {
  const { data } = await axios.post('/api/waxpeer/buy', { item_id, price, trade_url });
  return data;
}
