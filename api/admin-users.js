async function requireAdmin(request, requiredLevel = 3) {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = request.headers.authorization?.replace('Bearer ', '');
  if (!url || !serviceKey || !token) return null;
  const userResponse = await fetch(`${url}/auth/v1/user`, { headers: { apikey: serviceKey, Authorization: `Bearer ${token}` } });
  if (!userResponse.ok) return null;
  const user = await userResponse.json();
  const profileResponse = await fetch(`${url}/rest/v1/profiles?id=eq.${user.id}&select=role,admin_level`, { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } });
  const profiles = await profileResponse.json();
  const profile = profiles?.[0];
  return profile?.role === 'admin' && Number(profile.admin_level || 0) >= requiredLevel
    ? { url, serviceKey, user, profile }
    : null;
}

module.exports = async (request, response) => {
  const context = await requireAdmin(request);
  if (!context) return response.status(403).json({ error: 'Apenas administradores nível 3 podem gerenciar usuários.' });

  const serviceHeaders = { apikey: context.serviceKey, Authorization: `Bearer ${context.serviceKey}` };
  if (request.method === 'GET') {
    const [usersResponse, profilesResponse] = await Promise.all([
      fetch(`${context.url}/auth/v1/admin/users?page=1&per_page=1000`, { headers: serviceHeaders }),
      fetch(`${context.url}/rest/v1/profiles?select=id,full_name,role,admin_level,created_at`, { headers: serviceHeaders })
    ]);
    const usersData = await usersResponse.json();
    const profiles = await profilesResponse.json();
    if (!usersResponse.ok || !profilesResponse.ok) return response.status(502).json({ error: 'Não foi possível carregar os usuários.' });
    const profileById = new Map((profiles || []).map(profile => [profile.id, profile]));
    const users = (usersData.users || []).map(user => {
      const profile = profileById.get(user.id);
      return {
        id: user.id,
        email: user.email,
        fullName: profile?.full_name || user.user_metadata?.full_name || '',
        role: profile?.role || 'customer',
        adminLevel: Number(profile?.admin_level || 0),
        createdAt: user.created_at
      };
    });
    return response.status(200).json({ users });
  }

  if (request.method === 'POST') {
    const { email, password, fullName } = request.body || {};
    const adminLevel = Number(request.body?.adminLevel);
    if (!email || !password || password.length < 8 || !fullName || ![1, 2, 3].includes(adminLevel)) {
      return response.status(400).json({ error: 'Informe nome, e-mail, senha com ao menos 8 caracteres e nível 1, 2 ou 3.' });
    }
    const authResponse = await fetch(`${context.url}/auth/v1/admin/users`, {
      method: 'POST',
      headers: { ...serviceHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { full_name: fullName } })
    });
    const authData = await authResponse.json();
    if (!authResponse.ok) return response.status(400).json({ error: authData.message || 'Não foi possível criar a usuária.' });
    const profileResponse = await fetch(`${context.url}/rest/v1/profiles`, {
      method: 'POST',
      headers: { ...serviceHeaders, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({ id: authData.id, full_name: fullName, role: 'admin', admin_level: adminLevel })
    });
    if (!profileResponse.ok) return response.status(502).json({ error: 'Usuária criada, mas o perfil administrativo falhou.' });
    return response.status(201).json({ id: authData.id, email, fullName, adminLevel });
  }

  if (request.method === 'PATCH') {
    const { userId } = request.body || {};
    const adminLevel = Number(request.body?.adminLevel);
    if (!userId || !Number.isInteger(adminLevel) || adminLevel < 0 || adminLevel > 3) {
      return response.status(400).json({ error: 'Informe um usuário e um nível entre 0 e 3.' });
    }
    if (userId === context.user.id && adminLevel < 3) {
      const peersResponse = await fetch(`${context.url}/rest/v1/profiles?role=eq.admin&admin_level=eq.3&id=neq.${context.user.id}&select=id&limit=1`, { headers: serviceHeaders });
      const peers = await peersResponse.json();
      if (!peersResponse.ok || !peers?.length) return response.status(400).json({ error: 'Não é possível rebaixar o único administrador nível 3.' });
    }
    const authResponse = await fetch(`${context.url}/auth/v1/admin/users/${encodeURIComponent(userId)}`, { headers: serviceHeaders });
    const authData = await authResponse.json();
    if (!authResponse.ok) return response.status(404).json({ error: 'Usuário não encontrado.' });
    const profileResponse = await fetch(`${context.url}/rest/v1/profiles`, {
      method: 'POST',
      headers: { ...serviceHeaders, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        id: userId,
        full_name: authData.user?.user_metadata?.full_name || authData.user?.email?.split('@')[0] || 'Usuário',
        role: adminLevel ? 'admin' : 'customer',
        admin_level: adminLevel
      })
    });
    if (!profileResponse.ok) return response.status(502).json({ error: 'Não foi possível atualizar o nível do usuário.' });
    return response.status(200).json({ id: userId, adminLevel });
  }

  return response.status(405).json({ error: 'Método não permitido.' });
};