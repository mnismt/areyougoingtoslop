"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertValidGitHubUsername = exports.isValidGitHubUsername = void 0;
const errors_1 = require("./errors");
const USERNAME_REGEX = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37})$/;
const isValidGitHubUsername = (username) => {
    if (!USERNAME_REGEX.test(username)) {
        return false;
    }
    if (username.endsWith('-')) {
        return false;
    }
    if (username.includes('--')) {
        return false;
    }
    return true;
};
exports.isValidGitHubUsername = isValidGitHubUsername;
const assertValidGitHubUsername = (username) => {
    if (!(0, exports.isValidGitHubUsername)(username)) {
        throw new errors_1.GitHubValidationError('Invalid GitHub username format');
    }
};
exports.assertValidGitHubUsername = assertValidGitHubUsername;
