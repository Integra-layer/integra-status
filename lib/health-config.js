// lib/health-config.js — Endpoint registry for Integra status page
'use strict';

const ENDPOINTS = [
  // Blockchain (Mainnet — integra-1, EVM chain 26217)
  { id: 'mainnet-evm-rpc', name: 'Mainnet EVM RPC', category: 'blockchain', url: 'https://evm.integralayer.com', checkType: 'evm-rpc', timeout: 10000, enabled: true, expectedChainId: '0x6669' },
  { id: 'mainnet-evm-ws', name: 'Mainnet EVM WebSocket', category: 'blockchain', url: 'wss://ws.integralayer.com', checkType: 'websocket', timeout: 10000, enabled: true },
  { id: 'mainnet-cosmos-rpc', name: 'Mainnet Cosmos RPC', category: 'blockchain', url: 'https://rpc.integralayer.com', checkType: 'cosmos-rpc', timeout: 10000, enabled: true },
  { id: 'mainnet-cosmos-rest', name: 'Mainnet REST/LCD', category: 'blockchain', url: 'https://api.integralayer.com', checkType: 'cosmos-rest', timeout: 10000, enabled: true },
  // Blockchain (Testnet — ormos-1, EVM chain 26218)
  { id: 'testnet-evm-rpc', name: 'Testnet EVM RPC', category: 'blockchain', url: 'https://testnet-evm.integralayer.com', checkType: 'evm-rpc', timeout: 10000, enabled: true, expectedChainId: '0x666a' },
  { id: 'testnet-cosmos-rpc', name: 'Testnet Cosmos RPC', category: 'blockchain', url: 'https://testnet-rpc.integralayer.com', checkType: 'cosmos-rpc', timeout: 10000, enabled: true },
  { id: 'testnet-cosmos-rest', name: 'Testnet REST/LCD', category: 'blockchain', url: 'https://testnet-api.integralayer.com', checkType: 'cosmos-rest', timeout: 10000, enabled: true },
  // Validators (mainnet)
  { id: 'validator-1', name: 'Validator 1', category: 'validators', url: 'http://165.227.118.77:26657', checkType: 'cosmos-rpc', timeout: 8000, enabled: true },
  { id: 'validator-2', name: 'Validator 2', category: 'validators', url: 'http://159.65.168.118:26657', checkType: 'cosmos-rpc', timeout: 8000, enabled: true },
  { id: 'validator-3', name: 'Validator 3', category: 'validators', url: 'http://104.131.34.167:26657', checkType: 'cosmos-rpc', timeout: 8000, enabled: true },
  { id: 'validator-adam', name: "Adam's Node (AWS SG)", category: 'validators', url: 'http://18.140.134.114:26657', checkType: 'cosmos-rpc', timeout: 8000, enabled: true },
  // Backend APIs
  { id: 'passport-api', name: 'Passport API', category: 'apis', url: 'https://822ktpcc2f.ap-south-1.awsapprunner.com/api/v1/health', checkType: 'http-get', timeout: 10000, enabled: true },
  // Frontends / Explorers
  { id: 'explorer-mainnet', name: 'Explorer (Mainnet)', category: 'frontends', url: 'https://explorer.integralayer.com', checkType: 'http-get', timeout: 10000, enabled: true },
  { id: 'explorer-testnet', name: 'Explorer (Testnet)', category: 'frontends', url: 'https://testnet-explorer.integralayer.com', checkType: 'http-get', timeout: 10000, enabled: true },
  { id: 'docs-site', name: 'Documentation', category: 'frontends', url: 'https://docs.integralayer.com', checkType: 'http-get', timeout: 10000, enabled: true },
  // External Dependencies
  { id: 'github-integra-layer', name: 'GitHub (Integra-layer)', category: 'external', url: 'https://api.github.com/orgs/Integra-layer', checkType: 'http-json', timeout: 10000, enabled: true, expectedField: 'login' },
  { id: 'github-polytrade', name: 'GitHub (polytrade-finance)', category: 'external', url: 'https://api.github.com/orgs/polytrade-finance', checkType: 'http-json', timeout: 10000, enabled: true, expectedField: 'login' },
];

const CHAIN_HALT_THRESHOLD_SECONDS = 60;
const CATEGORIES = ['blockchain', 'validators', 'apis', 'frontends', 'external'];

function getEndpoints(opts = {}) {
  let eps = ENDPOINTS;
  if (opts.enabledOnly !== false) eps = eps.filter(e => e.enabled);
  if (opts.category) eps = eps.filter(e => e.category === opts.category);
  return eps;
}

function getEndpoint(id) {
  return ENDPOINTS.find(e => e.id === id) || null;
}

module.exports = { ENDPOINTS, CATEGORIES, CHAIN_HALT_THRESHOLD_SECONDS, getEndpoints, getEndpoint };
