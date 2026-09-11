require('dotenv').config();

const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:8232';
const RPC_USER = process.env.RPC_USER;
const RPC_PASS = process.env.RPC_PASS;
const RPC_TIMEOUT = parseInt(process.env.RPC_TIMEOUT) || 30000;

let authHeader = null;
if (RPC_USER && RPC_PASS) {
  const credentials = Buffer.from(`${RPC_USER}:${RPC_PASS}`).toString('base64');
  authHeader = `Basic ${credentials}`;
}

async function rpcCall(method, params = []) {
  const body = JSON.stringify({
    jsonrpc: '2.0',
    id: Date.now(),
    method,
    params
  });

  const headers = {
    'Content-Type': 'application/json'
  };

  if (authHeader) {
    headers['Authorization'] = authHeader;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), RPC_TIMEOUT);

  try {
    console.log(`[RPC] Calling ${method}`, params);
    const response = await fetch(RPC_URL, {
      method: 'POST',
      headers,
      body,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`RPC HTTP error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`[RPC] ${method} success`);

    if (data.error) {
      const err = new Error(data.error.message || 'RPC error');
      err.code = data.error.code;
      throw err;
    }

    return data.result;
  } catch (err) {
    clearTimeout(timeoutId);
    console.error(`[RPC] ${method} failed:`, err.message);
    throw err;
  }
}

module.exports = { rpcCall, RPC_URL };