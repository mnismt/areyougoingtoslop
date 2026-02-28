"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createGitHubClient = void 0;
const github_request_queue_1 = require("../queue/github-request-queue");
const raw_client_1 = require("./raw-client");
const createGitHubClient = (options) => {
    if (options.fetcher || !(0, github_request_queue_1.isGitHubRequestQueueEnabled)()) {
        return (0, raw_client_1.createRawGitHubClient)(options);
    }
    return (0, github_request_queue_1.createQueuedGitHubClient)(options);
};
exports.createGitHubClient = createGitHubClient;
