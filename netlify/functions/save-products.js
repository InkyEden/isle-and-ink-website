const ITEM_URL = 'https://isle-and-ink.netlify.app/';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return { statusCode: 500, body: 'GitHub token not configured' };
  }

  const repo = 'InkyEden/isle-and-ink-website';
  const filePath = 'index.html';

  try {
    const products = JSON.parse(event.body);

    // Get current file from GitHub
    const getRes = await fetch(`https://api.github.com/repos/${repo}/contents/${filePath}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'isle-and-ink-admin'
      }
    });

    if (!getRes.ok) {
      const err = await getRes.json();
      return { statusCode: 500, body: JSON.stringify(err) };
    }

    const fileData = await getRes.json();
    let currentContent = Buffer.from(fileData.content, 'base64').toString('utf8');
    const sha = fileData.sha;

    // ── 1. Update PRODUCTS block ──────────────────────────────────────────────
    const productsJs = JSON.stringify(products, null, 2);
    const newProductsBlock = `// <<PRODUCTS_START>>\nconst PRODUCTS = ${productsJs};\n// <<PRODUCTS_END>>`;

    currentContent = currentContent.replace(
      /\/\/ <<PRODUCTS_START>>[\s\S]*?\/\/ <<PRODUCTS_END>>/,
      newProductsBlock
    );

    // ── 2. Regenerate Snipcart validation buttons ─────────────────────────────
    const buttons = Object.entries(products).map(([id, p]) => {
      const desc = (p.eyebrow || '').replace(/'/g, '&#39;');
      const name = (p.name || '').replace(/'/g, '&#39;');
      return `  <button class="snipcart-add-item" data-item-id="${id}" data-item-name="${name}" data-item-price="${p.price}" data-item-url="${ITEM_URL}" data-item-description="${desc}"></button>`;
    }).join('\n');

    const newValidationBlock = `<!-- <<VALIDATION_START>> -->\n<div style="display:none" aria-hidden="true">\n${buttons}\n</div>\n<!-- <<VALIDATION_END>> -->`;

    currentContent = currentContent.replace(
      /<!-- <<VALIDATION_START>> -->[\s\S]*?<!-- <<VALIDATION_END>> -->/,
      newValidationBlock
    );

    // ── 3. Commit updated file to GitHub ──────────────────────────────────────
    const updateRes = await fetch(`https://api.github.com/repos/${repo}/contents/${filePath}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'isle-and-ink-admin'
      },
      body: JSON.stringify({
        message: 'Update products via admin panel',
        content: Buffer.from(currentContent).toString('base64'),
        sha: sha
      })
    });

    if (!updateRes.ok) {
      const err = await updateRes.json();
      return { statusCode: 500, body: JSON.stringify(err) };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true }),
      headers: { 'Access-Control-Allow-Origin': '*' }
    };

  } catch (err) {
    return { statusCode: 500, body: err.message };
  }
};
