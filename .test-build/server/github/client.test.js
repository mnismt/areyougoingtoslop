"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const github_request_queue_1 = require("../queue/github-request-queue");
const client_1 = require("./client");
(0, node_test_1.describe)('createGitHubClient', () => {
    (0, node_test_1.it)('uses direct client when a custom fetcher is provided', async () => {
        const previousRedisUrl = process.env.REDIS_URL;
        process.env.REDIS_URL = 'redis://127.0.0.1:6379';
        let calls = 0;
        const mockFetch = async () => {
            calls += 1;
            return new Response('[]', {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                },
            });
        };
        try {
            const client = (0, client_1.createGitHubClient)({ fetcher: mockFetch });
            await client.listUserPublicEvents('octocat', 1);
            strict_1.default.equal(calls, 1);
        }
        finally {
            process.env.REDIS_URL = previousRedisUrl;
        }
    });
});
(0, node_test_1.describe)('isGitHubRequestQueueEnabled', () => {
    (0, node_test_1.it)('reflects REDIS_URL availability', () => {
        const previousRedisUrl = process.env.REDIS_URL;
        try {
            process.env.REDIS_URL = '';
            strict_1.default.equal((0, github_request_queue_1.isGitHubRequestQueueEnabled)(), false);
            process.env.REDIS_URL = 'redis://127.0.0.1:6379';
            strict_1.default.equal((0, github_request_queue_1.isGitHubRequestQueueEnabled)(), true);
        }
        finally {
            process.env.REDIS_URL = previousRedisUrl;
        }
    });
});
