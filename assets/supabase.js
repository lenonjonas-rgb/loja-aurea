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
        ncm: product.ncm_code || '',
        cest: product.cest_code || '',
        origin: product.origin_code || '0',
        gtin: product.gtin || '',
        icmsCst: product.icms_cst || '',
        pisCst: product.pis_cst || '',
        cofinsCst: product.cofins_cst || '',
        ipiCst: product.ipi_cst || '',
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
    async taxSettings() {
      await ready;
      if (!client) return null;
      const { data, error } = await client.from('tax_settings').select('*').eq('id', true).maybeSingle();
      if (error) throw error;
      return data;
    },
    async saveTaxSettings(settings) {
      await ready;
      if (!client) throw new Error('Conexão com o Supabase indisponível.');
      const { data, error } = await client.from('tax_settings').upsert({ id: true, ...settings, updated_at: new Date().toISOString() }).select().single();
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
        image_url: product.image,
        ncm_code: product.ncm || null,
        cest_code: product.cest || null,
        origin_code: product.origin || '0',
        gtin: product.gtin || null,
        icms_cst: product.icmsCst || null,
        pis_cst: product.pisCst || null,
        cofins_cst: product.cofinsCst || null,
        ipi_cst: product.ipiCst || null
      }).select().single();
      if (error) throw error;
      return data;
    },
    async deleteProduct(id) {
      await ready;
      if (!client) throw new Error('Conexão com o Supabase indisponível.');
      const { error } = await client.from('products').delete().eq('id', id);
      if (error) throw error;
    },
    async updateProduct(id, product) {
      await ready;
      if (!client) throw new Error('Conexão com o Supabase indisponível.');
      const { data, error } = await client.from('products').update({
        name: product.name,
        category: product.category,
        price: product.price,
        cost_price: product.cost || 0,
        sizes: product.sizes || [],
        colors: product.colors || [],
        quantity: product.quantity,
        weight_kg: product.weight,
        dimensions: product.dimensions,
        image_url: product.image,
        ncm_code: product.ncm || null,
        cest_code: product.cest || null,
        origin_code: product.origin || '0',
        gtin: product.gtin || null,
        icms_cst: product.icmsCst || null,
        pis_cst: product.pisCst || null,
        cofins_cst: product.cofinsCst || null,
        ipi_cst: product.ipiCst || null
      }).eq('id', id).select().single();
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
    async signInCustomer(email, password) {
      await ready;
      if (!client) throw new Error('Conexão com o Supabase indisponível.');
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return this.customerProfile();
    },
    async signUpCustomer({ name, email, phone, password }) {
      await ready;
      if (!client) throw new Error('Conexão com o Supabase indisponível.');
      const emailRedirectTo = `${window.location.origin}${window.location.pathname}`;
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: { data: { full_name: name, phone }, emailRedirectTo }
      });
      if (error) throw error;
      return data;
    },
    async customerProfile() {
      await ready;
      if (!client) return null;
      const { data: { user } } = await client.auth.getUser();
      if (!user) return null;
      const [profileResult, addressResult, ordersResult] = await Promise.all([
        client.from('profiles').select('id,full_name,phone,loyalty_points,role').eq('id', user.id).maybeSingle(),
        client.from('addresses').select('*').eq('user_id', user.id).order('created_at', { ascending: true }),
        client.from('orders').select('id,status,total,created_at,shipping_address,order_items(product_name,quantity,unit_price)').eq('user_id', user.id).order('created_at', { ascending: false })
      ]);
      if (profileResult.error) throw profileResult.error;
      if (addressResult.error) throw addressResult.error;
      if (ordersResult.error) throw ordersResult.error;
      return {
        id: user.id,
        email: user.email,
        name: profileResult.data?.full_name || user.user_metadata?.full_name || '',
        phone: profileResult.data?.phone || user.user_metadata?.phone || '',
        points: Number(profileResult.data?.loyalty_points || 0),
        role: profileResult.data?.role || 'customer',
        addresses: addressResult.data || [],
        orders: (ordersResult.data || []).map(order => ({
          id: order.id,
          status: order.status,
          total: Number(order.total || 0),
          createdAt: new Date(order.created_at).getTime(),
          date: new Date(order.created_at).toLocaleDateString('pt-BR'),
          items: (order.order_items || []).reduce((count, item) => count + Number(item.quantity || 0), 0)
        }))
      };
    },
    async saveCustomerProfile(profile) {
      await ready;
      if (!client) throw new Error('Conexão com o Supabase indisponível.');
      const { data: { user } } = await client.auth.getUser();
      if (!user) throw new Error('Entre na sua conta para continuar.');
      const { data, error } = await client.from('profiles').update({ full_name: profile.name, phone: profile.phone }).eq('id', user.id).select().single();
      if (error) throw error;
      return data;
    },
    async saveAddress(address) {
      await ready;
      if (!client) throw new Error('Conexão com o Supabase indisponível.');
      const { data: { user } } = await client.auth.getUser();
      if (!user) throw new Error('Entre na sua conta para continuar.');
      const { data, error } = await client.from('addresses').upsert({ ...address, user_id: user.id }).select().single();
      if (error) throw error;
      return data;
    },
    async deleteAddress(id) {
      await ready;
      if (!client) throw new Error('Conexão com o Supabase indisponível.');
      const { error } = await client.from('addresses').delete().eq('id', id);
      if (error) throw error;
    },
    async createOrder({ address, cart, total }) {
      await ready;
      if (!client) throw new Error('Conexão com o Supabase indisponível.');
      const { data: { user } } = await client.auth.getUser();
      if (!user) throw new Error('Entre na sua conta para finalizar a compra.');
      const shippingAddress = {
        label: address.label,
        street: address.street,
        number: address.number,
        complement: address.complement || '',
        city: address.city,
        state: address.state,
        zip_code: address.zip_code || address.zip
      };
      const { data, error } = await client.rpc('create_customer_order', {
        p_address_id: address.id || null,
        p_shipping_address: shippingAddress,
        p_total: Number(total),
        p_items: cart.map(item => ({ product_id: item.id, quantity: 1, size: item.selectedSize || '', color: item.selectedColor || '' }))
      });
      if (error) throw error;
      return { id: data };
    },
    async adminOrders() {
      await ready;
      if (!client) return null;
      if (!(await this.adminSession())) return null;
      const { data, error } = await client.from('orders').select('*,order_items(*),profiles(full_name),addresses(*)').order('created_at', { ascending: false });
      if (error) throw error;
      const labels = { open: 'Em aberto', paid: 'Pedido concluído', separating: 'Em separação', shipped: 'Enviado', delivered: 'Entregue', cancelled: 'Cancelado' };
      return Promise.all((data || []).map(async order => {
        const address = order.shipping_address || order.addresses || null;
        let invoice = order.invoice_url || '';
        if (invoice && !invoice.startsWith('data:')) {
          const { data: signed } = await client.storage.from('invoices').createSignedUrl(invoice, 3600);
          invoice = signed?.signedUrl || '';
        }
        return {
          id: order.id,
          customer: order.customer_name || order.profiles?.full_name || order.customer_email || 'Cliente',
          total: Number(order.total || 0),
          status: labels[order.status] || 'Em aberto',
          dbStatus: order.status,
          items: (order.order_items || []).reduce((count, item) => count + Number(item.quantity || 0), 0),
          address: address ? { ...address, zip: address.zip || address.zip_code || '' } : null,
          products: (order.order_items || []).map(item => ({ name: item.product_name, quantity: item.quantity, price: Number(item.unit_price), size: item.product_size, color: item.product_color })),
          createdAt: new Date(order.created_at).getTime(),
          tracking: order.tracking_code || '',
          note: order.separation_note || '',
          invoice,
          invoicePath: order.invoice_url || '',
          shippingCost: Number(order.shipping_cost || 0)
        };
      }));
    },
    async uploadInvoice(orderId, file) {
      await ready;
      if (!client) throw new Error('Conexão com o Supabase indisponível.');
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${orderId}/${Date.now()}-${safeName}`;
      const { error } = await client.storage.from('invoices').upload(path, file, { upsert: false, contentType: file.type || 'application/octet-stream' });
      if (error) throw error;
      const { data, error: urlError } = await client.storage.from('invoices').createSignedUrl(path, 3600);
      if (urlError) throw urlError;
      return { path, url: data.signedUrl };
    },
    async updateOrder(orderId, changes) {
      await ready;
      if (!client) throw new Error('Conexão com o Supabase indisponível.');
      const statusValues = { 'Em aberto': 'open', 'Pedido concluído': 'paid', 'Em separação': 'separating', Enviado: 'shipped', Entregue: 'delivered', Cancelado: 'cancelled' };
      const payload = {};
      if (changes.status) payload.status = statusValues[changes.status] || changes.status;
      if (changes.note !== undefined) payload.separation_note = changes.note;
      if (changes.tracking !== undefined) payload.tracking_code = changes.tracking;
      if (changes.invoicePath !== undefined) payload.invoice_url = changes.invoicePath;
      else if (changes.invoice !== undefined) payload.invoice_url = changes.invoice;
      const { error } = await client.from('orders').update(payload).eq('id', orderId);
      if (error) throw error;
    },
    async sendPasswordReset(email) {
      await ready;
      if (!client) throw new Error('Conexão com o Supabase indisponível.');
      const redirectTo = `${window.location.origin}${window.location.pathname}`;
      const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;
    },
    async updatePassword(password) {
      await ready;
      if (!client) throw new Error('Conexão com o Supabase indisponível.');
      const { error } = await client.auth.updateUser({ password });
      if (error) throw error;
    },
    async adminSession() {
      await ready;
      if (!client) return null;
      const { data: { user } } = await client.auth.getUser();
      if (!user) return null;
      const { data: profile, error } = await client.from('profiles').select('full_name, role, admin_level').eq('id', user.id).maybeSingle();
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
        client.from('orders').select('id,total,tax_amount,shipping_cost,order_items(product_id,unit_cost,supply_cost,quantity)').in('status', ['paid','separating','shipped','delivered']).gte('paid_at', startDate).lt('paid_at', endDate),
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
      const taxes = orders.reduce((sum, order) => sum + Number(order.tax_amount || 0), 0);
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
    },
    async adminUsers() {
      await ready;
      if (!client) throw new Error('Conexão com o Supabase indisponível.');
      const { data: { session } } = await client.auth.getSession();
      if (!session) throw new Error('Sua sessão expirou. Entre novamente.');
      const response = await fetch('/api/admin-users', { headers: { Authorization: `Bearer ${session.access_token}` } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Não foi possível carregar os usuários.');
      return data.users || [];
    },
    async setAdminLevel(userId, adminLevel) {
      await ready;
      if (!client) throw new Error('Conexão com o Supabase indisponível.');
      const { data: { session } } = await client.auth.getSession();
      if (!session) throw new Error('Sua sessão expirou. Entre novamente.');
      const response = await fetch('/api/admin-users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ userId, adminLevel: Number(adminLevel) })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Não foi possível alterar o nível.');
      return data;
    }
  };
})();