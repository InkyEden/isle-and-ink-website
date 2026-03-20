const products = require('./products.json');

exports.handler = async (event) => {
  const id = event.queryStringParameters && event.queryStringParameters.id;
  if (!id) return { statusCode: 400, body: 'Missing product id' };

  const product = products[id];
  if (!product) return { statusCode: 404, body: 'Product not found' };

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({
      id: id,
      price: product.price,
      name: product.name,
      description: product.eyebrow || ''
    })
  };
};
