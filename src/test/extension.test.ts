import * as assert from 'assert';
import MockAdapter from 'axios-mock-adapter';
import axios from 'axios';
import { GitLabClient } from '../api/gitlabClient';

// One shared mock adapter for all tests
const mock = new MockAdapter(axios);

suite('GitLabClient', () => {

    let client: GitLabClient;

    // Create a fresh client before each test
    setup(() => {
        client = new GitLabClient();
        mock.reset(); // clear any previous mock routes
    });

    // --- extractWpId ---

    test('extractWpId finds OP#123 in title', () => {
        const mr = { title: 'Fix bug OP#42', description: '', source_branch: 'main' } as any;
        assert.strictEqual(client.extractWpId(mr), 42);
    });

    test('extractWpId finds wp-99 in branch name', () => {
        const mr = { title: 'some fix', description: '', source_branch: 'feature/wp-99-login' } as any;
        assert.strictEqual(client.extractWpId(mr), 99);
    });

    test('extractWpId finds openproject#7 in description', () => {
        const mr = { title: 'some fix', description: 'Closes openproject#7', source_branch: 'main' } as any;
        assert.strictEqual(client.extractWpId(mr), 7);
    });

    test('extractWpId returns null when no WP reference exists', () => {
        const mr = { title: 'chore: update deps', description: '', source_branch: 'chore/deps' } as any;
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