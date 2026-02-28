"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapScoreToTier = exports.computeSlopScore = exports.DEFAULT_SCORING_CONFIG = void 0;
var config_1 = require("./config");
Object.defineProperty(exports, "DEFAULT_SCORING_CONFIG", { enumerable: true, get: function () { return config_1.DEFAULT_SCORING_CONFIG; } });
var engine_1 = require("./engine");
Object.defineProperty(exports, "computeSlopScore", { enumerable: true, get: function () { return engine_1.computeSlopScore; } });
var tier_1 = require("./tier");
Object.defineProperty(exports, "mapScoreToTier", { enumerable: true, get: function () { return tier_1.mapScoreToTier; } });
