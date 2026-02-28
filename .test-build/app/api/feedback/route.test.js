"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const promises_1 = require("node:fs/promises");
const node_os_1 = __importDefault(require("node:os"));
const node_path_1 = __importDefault(require("node:path"));
const node_test_1 = require("node:test");
const route_1 = require("./route");
const createTempPath = async () => {
    const dir = await (0, promises_1.mkdtemp)(node_path_1.default.join(node_os_1.default.tmpdir(), 'feedback-'));
    return node_path_1.default.join(dir, 'feedback.json');
};
(0, node_test_1.describe)('feedback api', () => {
    (0, node_test_1.it)('accepts feedback submissions', async () => {
        const storagePath = await createTempPath();
        process.env.FEEDBACK_STORAGE_PATH = storagePath;
        const response = await (0, route_1.POST)(new Request('http://localhost', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'Great roast, keep going.' }),
        }));
        strict_1.default.equal(response.status, 201);
        const raw = await (0, promises_1.readFile)(storagePath, 'utf-8');
        const entries = JSON.parse(raw);
        strict_1.default.equal(entries.length, 1);
        strict_1.default.equal(entries[0].message, 'Great roast, keep going.');
    });
    (0, node_test_1.it)('rejects short feedback', async () => {
        const storagePath = await createTempPath();
        process.env.FEEDBACK_STORAGE_PATH = storagePath;
        const response = await (0, route_1.POST)(new Request('http://localhost', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'hey' }),
        }));
        strict_1.default.equal(response.status, 400);
    });
});
