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
    }
  };
})();