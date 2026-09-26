window.AureaCloud = (() => {
  let client = null;

  const ready = fetch('/api/config')
    .then(response => response.ok ? response.json() : null)
    .then(config => {
      if (config && window.supabase) client = window.supabase.createClient(config.url, config.anonKey);
      return client;
    })
    .catch(() => null);

  async function query(table, transform) {
    await ready;
    if (!client) return null;
    const { data, error } = await client.from(table).select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data.map(transform);
  }

  return {
    ready,
    async products() {
      return query('products', product => ({
        id: product.id,
        name: product.name,
        type: product.category,
        price: Number(product.price),
        cost: Number(product.cost_price || 0),
        sizes: product.sizes || [],
        colors: product.colors || [],
        quantity: product.quantity,
        weight: product.weight_kg,
        dimensions: product.dimensions,
        image: product.image_url,
        tag: ''
      }));
    },
    async coupons() {
      return query('coupons', coupon => ({
        id: coupon.id,
        code: coupon.code,
        discount: Number(coupon.discount_percent),
        usesLimit: coupon.uses_limit,
        uses: coupon.uses_count,
        expiration: coupon.expires_at
      }));
    },
    async storeSettings() {
      await ready;
      if (!client) return null;
      const { data, error } = await client.from('store_settings').select('*').eq('id', true).maybeSingle();
      if (error) throw error;
      return data;
    },
    async saveStoreSettings(settings) {
      await ready;
      if (!client) throw new Error('Conexão com o Supabase indisponível.');
      const { data, error } = await client.from('store_settings').upsert({ id: true, ...settings, updated_at: new Date().toISOString() }).select().single();
      if (error) throw error;
      return data;
    },
    async saveProduct(product) {
      await ready;
      if (!client) return null;
      const { data, error } = await client.from('products').insert({
        name: product.name,
        category: product.category,
        price: product.price,
        cost_price: product.cost || 0,
        sizes: product.sizes || [],
        colors: product.colors || [],
        quantity: product.quantity,
        weight_kg: product.weight,
        dimensions: product.dimensions,
        image_url: product.image
      }).select().single();
      if (error) throw error;
      return data;
    },
    async saveCoupon(coupon) {
      await ready;
      if (!client) return null;
      const { data, error } = await client.from('coupons').insert({
        code: coupon.code,
        discount_percent: coupon.discount,
        uses_limit: coupon.usesLimit,
        expires_at: coupon.expiration
      }).select().single();
      if (error) throw error;
      return data;
    },
    async signIn(email, password) {
      await ready;
      if (!client) throw new Error('Conexão com o Supabase indisponível.');
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return this.adminSession();
    },
    async adminSession() {
      await ready;
      if (!client) return null;
      const { data: { user } } = await client.auth.getUser();
      if (!user) return null;
      const { data: profile, error } = await client.from('profiles').select('full_name, role').eq('id', user.id).maybeSingle();
      if (error || !profile || profile.role !== 'admin') return null;
      return { user, profile };
    },
    async signOut() {
      await ready;
      if (client) await client.auth.signOut();
    },
    async records(table) {
      await ready;
      if (!client) return [];
      const { data, error } = await client.from(table).select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    async saveRecord(table, record) {
      await ready;
      if (!client) throw new Error('Conexão com o Supabase indisponível.');
      const { data, error } = await client.from(table).upsert(record).select().single();
      if (error) throw error;
      return data;
    },
    async deleteRecord(table, id) {
      await ready;
      if (!client) throw new Error('Conexão com o Supabase indisponível.');
      const { error } = await client.from(table).delete().eq('id', id);
      if (error) throw error;
    },
    async financeSummary(startDate, endDate) {
      await ready;
      if (!client) throw new Error('Conexão com o Supabase indisponível.');
      const [ordersResult, expensesResult] = await Promise.all([
        client.from('orders').select('id,total,tax_amount,shipping_cost,shipping_state,order_items(product_id,unit_cost,supply_cost,quantity)').in('status', ['paid','separating','shipped','delivered']).gte('paid_at', startDate).lt('paid_at', endDate),
        client.from('store_expenses').select('amount').gte('expense_date', startDate.slice(0,10)).lt('expense_date', endDate.slice(0,10))
      ]);
      if (ordersResult.error) throw ordersResult.error;
      if (expensesResult.error) throw expensesResult.error;
      const orders = ordersResult.data || [];
      const sales = orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
      const productIds = [...new Set(orders.flatMap(order => (order.order_items || []).map(item => item.product_id).filter(Boolean)))];
      let productCosts = new Map();
      let supplyCosts = new Map();
      if (productIds.length) {
        const [productsResult, mappingsResult] = await Promise.all([
          client.from('products').select('id,cost_price').in('id', productIds),
          client.from('product_supplies').select('product_id,quantity_per_product,supplies(unit_cost)').in('product_id', productIds)
        ]);
        if (productsResult.error) throw productsResult.error;
        if (mappingsResult.error) throw mappingsResult.error;
        productCosts = new Map((productsResult.data || []).map(product => [product.id, Number(product.cost_price || 0)]));
        for (const mapping of mappingsResult.data || []) {
          const cost = Number(mapping.supplies?.unit_cost || 0) * Number(mapping.quantity_per_product || 0);
          supplyCosts.set(mapping.product_id, (supplyCosts.get(mapping.product_id) || 0) + cost);
        }
      }
      const cogs = orders.reduce((sum, order) => sum + (order.order_items || []).reduce((items, item) => {
        const productCost = Number(item.unit_cost || 0) || productCosts.get(item.product_id) || 0;
        const supplyCost = Number(item.supply_cost || 0) || supplyCosts.get(item.product_id) || 0;
        return items + (productCost + supplyCost) * Number(item.quantity || 0);
      }, 0), 0);
      const expenses = (expensesResult.data || []).reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
      const states = [...new Set(orders.map(order => order.shipping_state).filter(Boolean))];
      let rates = new Map();
      if (states.length) {
        const ratesResult = await client.from('state_tax_rates').select('state,rate_percent').in('state', states);
        if (ratesResult.error) throw ratesResult.error;
        rates = new Map((ratesResult.data || []).map(rate => [rate.state, Number(rate.rate_percent)]));
      }
      const taxes = orders.reduce((sum, order) => sum + (Number(order.tax_amount || 0) || Number(order.total || 0) * (rates.get(order.shipping_state) || 0) / 100), 0);
      return { sales, cogs, expenses, taxes, totalCosts: cogs + expenses, orderCount: orders.length };
    },
    async createAdminUser(payload) {
      await ready;
      if (!client) throw new Error('Conexão com o Supabase indisponível.');
      const { data: { session } } = await client.auth.getSession();
      if (!session) throw new Error('Sua sessão expirou. Entre novamente.');
      const response = await fetch('/api/admin-users', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Não foi possível criar a usuária.');
      return data;
    }
  };
})();