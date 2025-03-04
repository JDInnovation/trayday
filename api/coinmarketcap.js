// api/coinmarketcap.js
export default async function handler(req, res) {
    try {
      // Você pode receber parâmetros da query string, por exemplo:
      const limit = req.query.limit || 50;
  
      // Faz a requisição à API do CoinMarketCap
      const response = await fetch(
        `https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest?limit=${limit}`,
        {
          headers: {
            "X-CMC_PRO_API_KEY": "ed14d249-2ae2-4997-80d4-3c40ca02323d"
          }
        }
      );
  
      // Converte a resposta para JSON
      const data = await response.json();
  
      // Retorna o JSON ao navegador
      res.status(200).json(data);
    } catch (error) {
      res.status(500).json({ error: error.toString() });
    }
  }
  