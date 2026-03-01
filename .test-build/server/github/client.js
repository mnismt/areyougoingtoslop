"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createGitHubClient = exports.getGitHubClientSelectionStats = void 0;
const github_request_queue_1 = require("../queue/github-request-queue");
const raw_client_1 = require("./raw-client");
const getSelectionState = () => {
    const globalState = globalThis;
    if (!globalState.__aysGitHubClientSelectionState) {
        globalState.__aysGitHubClientSelectionState = {
            queued: 0,
            raw_fetcher: 0,
            raw_queue_disabled: 0,
            last_selected: null,
            updated_at: null,
        };
    }
    return globalState.__aysGitHubClientSelectionState;
};
const recordSelection = (mode) => {
    const state = getSelectionState();
    state[mode] += 1;
    state.last_selected = mode;
    state.updated_at = new Date().toISOString();
};
const getGitHubClientSelectionStats = () => {
    const state = getSelectionState();
    return {
        queued: state.queued,
        raw_fetcher: state.raw_fetcher,
        raw_queue_disabled: state.raw_queue_disabled,
        last_selected: state.last_selected,
        updated_at: state.updated_at,
    };
};
exports.getGitHubClientSelectionStats = getGitHubClientSelectionStats;
const createGitHubClient = (options) => {
    if (options.fetcher) {
        recordSelection('raw_fetcher');
        return (0, raw_client_1.createRawGitHubClient)(options);
    }
    if (!(0, github_request_queue_1.isGitHubRequestQueueEnabled)()) {
        recordSelection('raw_queue_disabled');
        return (0, raw_client_1.createRawGitHubClient)(options);
    }
    recordSelection('queued');
    return (0, github_request_queue_1.createQueuedGitHubClient)(options);
};
exports.createGitHubClient = createGitHubClient;
