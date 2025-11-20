"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const OPENPROJECT_URL = '';
const API_KEY = '';
const api = axios_1.default.create({
    baseURL: `${OPENPROJECT_URL}/api/v3`,
    timeout: 5000,
    headers: {
        '': '',
    },
});
//# sourceMappingURL=test.js.map