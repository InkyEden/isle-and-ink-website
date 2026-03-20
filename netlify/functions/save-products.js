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
    const currentContent = Buffer.from(fileData.content, 'base64').toString('utf8');
    const sha = fileData.sha;

    // Build new PRODUCTS block
    const productsJs = JSON.stringify(products, null, 2);
    const newBlock = `// <<PRODUCTS_START>>\nconst PRODUCTS = ${productsJs};\n// <<PRODUCTS_END>>`;

    // Replace between markers
    const newContent = currentContent.replace(
      /\/\/ <<PRODUCTS_START>>[\s\S]*?\/\/ <<PRODUCTS_END>>/,
      newBlock
    );

    if (newContent === currentContent) {
      return { statusCode: 500, body: 'Could not find PRODUCTS markers in file' };
    }

    // Commit updated file to GitHub
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
        content: Buffer.from(newContent).toString('base64'),
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
