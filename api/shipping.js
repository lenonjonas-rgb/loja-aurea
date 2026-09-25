module.exports = async (request, response) => {
  const { cepDestino, cepOrigem, peso, comprimento, largura, altura } = request.query;
  const token = process.env.CORREIOS_TOKEN;
  const serviceCode = process.env.CORREIOS_SERVICE_CODE || '03298';

  if (!token) return response.status(503).json({ error: 'Cálculo dos Correios ainda não foi configurado.' });
  if (!cepDestino || !cepOrigem) return response.status(400).json({ error: 'CEP de origem e destino são obrigatórios.' });

  const query = new URLSearchParams({
    cepOrigem: String(cepOrigem).replace(/\D/g, ''),
    cepDestino: String(cepDestino).replace(/\D/g, ''),
    psObjeto: String(Math.max(1, Math.round(Number(peso || 0.3) * 1000)),
    comprimento: String(comprimento || 20),
    largura: String(largura || 15),
    altura: String(altura || 5)
  });

  try {
    const correios = await fetch(`https://api.correios.com.br/preco/v1/nacional/${serviceCode}?${query}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
    });
    const data = await correios.json();
    if (!correios.ok) return response.status(502).json({ error: data?.mensagem || 'Os Correios não retornaram uma cotação.' });
    return response.status(200).json({ price: data.pcFinal || data.preco, days: data.prazoEntrega || data.prazo });
  } catch {
    return response.status(502).json({ error: 'Não foi possível consultar os Correios agora.' });
  }
};