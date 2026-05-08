"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert = __importStar(require("assert"));
const axios_mock_adapter_1 = __importDefault(require("axios-mock-adapter"));
const axios_1 = __importDefault(require("axios"));
const gitlabClient_1 = require("../api/gitlabClient");
// One shared mock adapter for all tests
const mock = new axios_mock_adapter_1.default(axios_1.default);
suite('GitLabClient', () => {
    let client;
    // Create a fresh client before each test
    setup(() => {
        client = new gitlabClient_1.GitLabClient();
        mock.reset(); // clear any previous mock routes
    });
    // --- extractWpId ---
    test('extractWpId finds OP#123 in title', () => {
        const mr = { title: 'Fix bug OP#42', description: '', source_branch: 'main' };
        assert.strictEqual(client.extractWpId(mr), 42);
    });
    test('extractWpId finds wp-99 in branch name', () => {
        const mr = { title: 'some fix', description: '', source_branch: 'feature/wp-99-login' };
        assert.strictEqual(client.extractWpId(mr), 99);
    });
    test('extractWpId finds openproject#7 in description', () => {
        const mr = { title: 'some fix', description: 'Closes openproject#7', source_branch: 'main' };
        assert.strictEqual(client.extractWpId(mr), 7);
    });
    test('extractWpId returns null when no WP reference exists', () => {
        const mr = { title: 'chore: update deps', description: '', source_branch: 'chore/deps' };
        assert.strictEqual(client.extractWpId(mr), null);
    });
    // --- getMergeRequests ---
    test('getMergeRequests returns combined opened + merged results', async () => {
        mock.onGet(/merge_requests/).reply(200, [
            {
                id: 1, iid: 1, title: 'OP#10 fix', state: 'opened',
                source_branch: 'fix', description: '', web_url: 'http://localhost'
            }
        ]);
        const mrs = await client.getMergeRequests();
        // Two requests fired (opened + merged), each returns the same stub →
        // we get 2 entries (deduplication is not done in the client, that's fine)
        assert.ok(mrs.length >= 1);
        assert.strictEqual(mrs[0].iid, 1);
    });
    test('getMergeRequests returns empty array on network error', async () => {
        mock.onGet(/merge_requests/).networkError();
        const mrs = await client.getMergeRequests();
        assert.deepStrictEqual(mrs, []);
    });
});
//# sourceMappingURL=extension.test.js.map