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
  const productsJsonPath = 'netlify/functions/products.json';

  try {
    const products = JSON.parse(event.body);

    // Get current index.html from GitHub
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

    // ── 2. Commit updated index.html to GitHub ────────────────────────────────
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

    // ── 3. Build slim products.json (id, name, eyebrow, price only) ───────────
    const slim = {};
    for (const [id, p] of Object.entries(products)) {
      slim[id] = { name: p.name, eyebrow: p.eyebrow || '', price: p.price };
    }
    const slimJson = JSON.stringify(slim, null, 2);

    // ── 4. Get current products.json SHA from GitHub ──────────────────────────
    const getPjRes = await fetch(`https://api.github.com/repos/${repo}/contents/${productsJsonPath}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'isle-and-ink-admin'
      }
    });

    let pjSha = null;
    if (getPjRes.ok) {
      const pjData = await getPjRes.json();
      pjSha = pjData.sha;
    }

    // ── 5. Commit updated products.json to GitHub ─────────────────────────────
    const updatePjBody = {
      message: 'Update products.json via admin panel',
      content: Buffer.from(slimJson).toString('base64')
    };
    if (pjSha) updatePjBody.sha = pjSha;

    const updatePjRes = await fetch(`https://api.github.com/repos/${repo}/contents/${productsJsonPath}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'isle-and-ink-admin'
      },
      body: JSON.stringify(updatePjBody)
    });

    if (!updatePjRes.ok) {
      const err = await updatePjRes.json();
      return { statusCode: 500, body: JSON.stringify({ step: 'products.json', ...err }) };
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
