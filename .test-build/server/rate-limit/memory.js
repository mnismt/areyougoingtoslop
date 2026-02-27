"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryRateLimiter = void 0;
class MemoryRateLimiter {
    constructor(options) {
        this.entries = new Map();
        this.windowMs = options.windowMs;
        this.maxRequests = options.maxRequests;
    }
    check(key, now) {
        const entry = this.entries.get(key);
        if (!entry || entry.resetAt <= now) {
            const resetAt = now + this.windowMs;
            this.entries.set(key, { count: 1, resetAt });
            return {
                allowed: true,
                remaining: this.maxRequests - 1,
                resetAt,
            };
        }
        const updatedCount = entry.count + 1;
        entry.count = updatedCount;
        if (updatedCount > this.maxRequests) {
            return {
                allowed: false,
                remaining: 0,
                resetAt: entry.resetAt,
            };
        }
        return {
            allowed: true,
            remaining: this.maxRequests - updatedCount,
            resetAt: entry.resetAt,
        };
    }
}
exports.MemoryRateLimiter = MemoryRateLimiter;
