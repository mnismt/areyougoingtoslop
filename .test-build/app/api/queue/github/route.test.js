"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const route_1 = require("./route");
(0, node_test_1.describe)('queue github route', () => {
    (0, node_test_1.it)('returns disabled snapshot when queue mode is off', async () => {
        const previousRedisUrl = process.env.REDIS_URL;
        process.env.REDIS_URL = '';
        try {
            const response = await (0, route_1.GET)();
            strict_1.default.equal(response.status, 200);
            strict_1.default.equal(response.headers.get('cache-control'), 'no-store');
            const body = await response.json();
            strict_1.default.equal(body.enabled, false);
            strict_1.default.equal(body.health, 'disabled');
            strict_1.default.equal(JSON.stringify(body).includes('token'), false);
        }
        finally {
            process.env.REDIS_URL = previousRedisUrl;
        }
    });
});
