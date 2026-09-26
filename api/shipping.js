module.exports = async (request, response) => {
  const { cepDestino, cepOrigem, peso, comprimento, largura, altura } = request.query;
  const token = process.env.CORREIOS_TOKEN;
  const serviceCode = process.env.CORREIOS_SERVICE_CODE || '03298';

  if (!token) return response.status(503).json({ error: 'Cálculo dos Correios ainda não foi configurado.' });
  if (!cepDestino || !cepOrigem) return response.status(400).json({ error: 'CEP de origem e destino são obrigatórios.' });

  const originCep = String(cepOrigem).replace(/\D/g, '');
  const destinationCep = String(cepDestino).replace(/\D/g, '');
  const weightKg = Number(peso || 0.3);
  const dimensions = [comprimento || 20, largura || 15, altura || 5].map(Number);
  if (!/^\d{8}$/.test(originCep) || !/^\d{8}$/.test(destinationCep)) {
    return response.status(400).json({ error: 'Informe CEPs válidos com 8 dígitos.' });
  }
  if (!Number.isFinite(weightKg) || weightKg <= 0 || dimensions.some(value => !Number.isFinite(value) || value <= 0)) {
    return response.status(400).json({ error: 'Peso e dimensões devem ser valores válidos maiores que zero.' });
  }

  const query = new URLSearchParams({
    cepOrigem: originCep,
    cepDestino: destinationCep,
    psObjeto: String(Math.max(1, Math.round(weightKg * 1000))),
    comprimento: String(dimensions[0]),
    largura: String(dimensions[1]),
    altura: String(dimensions[2])
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